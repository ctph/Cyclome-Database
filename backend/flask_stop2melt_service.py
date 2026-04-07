from __future__ import annotations

import os
import re
import math
from collections import deque
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from huggingface_hub import hf_hub_download

_SIMPLE_PAIR_RE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*$")
_DEFAULT_REPO_ID = "KarunaAnna/STop2Melt"
_DEFAULT_FILENAME = "cycoffset_esmc_cymelt.pt"
_DEFAULT_MODEL_NAME = "esmc_300m"
_DEFAULT_DMAX = 10
_DEFAULT_N_LAYERS = 2
_DEFAULT_N_HEADS = 8
_DEFAULT_DROPOUT = 0.1


@dataclass
class PredictorConfig:
    checkpoint_path: str
    model_name: str = _DEFAULT_MODEL_NAME
    dmax: int = _DEFAULT_DMAX
    n_layers: int = _DEFAULT_N_LAYERS
    n_heads: int = _DEFAULT_N_HEADS
    dropout: float = _DEFAULT_DROPOUT
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


class RelativeBiasSelfAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int, dmax: int, dropout: float = 0.1):
        super().__init__()
        if d_model % n_heads != 0:
            raise ValueError("d_model must be divisible by n_heads")

        self.d_model = d_model
        self.n_heads = n_heads
        self.d_head = d_model // n_heads

        self.qkv = nn.Linear(d_model, 3 * d_model)
        self.out = nn.Linear(d_model, d_model)
        self.drop = nn.Dropout(dropout)

        self.rel_bias = nn.Embedding(dmax + 1, n_heads)

        self.ln = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, 4 * d_model),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(4 * d_model, d_model),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor, D: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        B, L, _ = x.shape
        h = self.ln(x)

        qkv = self.qkv(h)
        q, k, v = qkv.chunk(3, dim=-1)

        q = q.view(B, L, self.n_heads, self.d_head).transpose(1, 2)
        k = k.view(B, L, self.n_heads, self.d_head).transpose(1, 2)
        v = v.view(B, L, self.n_heads, self.d_head).transpose(1, 2)

        scores = torch.matmul(q, k.transpose(-1, -2)) / math.sqrt(self.d_head)

        rb = self.rel_bias(D).permute(0, 3, 1, 2).contiguous()
        scores = scores + rb

        key_mask = (~mask).view(B, 1, 1, L)
        scores = scores.masked_fill(key_mask, float("-inf"))

        attn = torch.softmax(scores, dim=-1)
        attn = self.drop(attn)

        out = torch.matmul(attn, v)
        out = out.transpose(1, 2).contiguous().view(B, L, self.d_model)
        out = self.out(out)
        out = self.drop(out)

        x = x + out
        x = x + self.ff(x)
        return x


class CycOffsetRegressor(nn.Module):
    def __init__(self, d_model: int, n_heads: int, dmax: int, n_layers: int = 2, dropout: float = 0.1):
        super().__init__()
        self.blocks = nn.ModuleList(
            [
                RelativeBiasSelfAttention(
                    d_model=d_model,
                    n_heads=n_heads,
                    dmax=dmax,
                    dropout=dropout,
                )
                for _ in range(n_layers)
            ]
        )
        self.final_ln = nn.LayerNorm(d_model)
        self.mlp = nn.Sequential(
            nn.Linear(2 * d_model, d_model),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model, 1),
        )

    def forward(self, x: torch.Tensor, D: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        for blk in self.blocks:
            x = blk(x, D, mask)

        x = self.final_ln(x)

        m = mask.unsqueeze(-1)
        x_masked = x * m
        lengths = m.sum(dim=1).clamp(min=1.0)

        mean_pool = x_masked.sum(dim=1) / lengths

        x_for_max = x.masked_fill(~mask.unsqueeze(-1), float("-inf"))
        max_pool = torch.max(x_for_max, dim=1).values
        max_pool = torch.where(torch.isfinite(max_pool), max_pool, torch.zeros_like(max_pool))

        z = torch.cat([mean_pool, max_pool], dim=-1)
        return self.mlp(z)


def clean_sequence(seq: str) -> str:
    return str(seq).strip().replace(" ", "").replace("\n", "").upper()


def parse_simple_cyclization_pairs(cyclization_pattern: Any) -> List[Tuple[int, int]]:
    if cyclization_pattern is None:
        return []

    s = str(cyclization_pattern).strip()
    if not s or s.lower() in {"none", "linear", "nan"}:
        return []

    pairs = []
    for token in s.split(","):
        token = token.strip()
        if not token:
            continue
        m = _SIMPLE_PAIR_RE.match(token)
        if not m:
            raise ValueError(
                f"Invalid cyclization token '{token}'. Expected format like '1-8' or '1-8, 2-40'."
            )
        i, j = int(m.group(1)), int(m.group(2))
        if i == j:
            raise ValueError(f"Invalid cyclization pair '{token}': residues cannot be identical.")
        pairs.append((i, j))
    return pairs


def build_adjacency(n: int, pairs_1based: List[Tuple[int, int]]) -> List[List[int]]:
    adj = [[] for _ in range(n)]

    for i in range(n - 1):
        adj[i].append(i + 1)
        adj[i + 1].append(i)

    for i, j in pairs_1based:
        if not (1 <= i <= n and 1 <= j <= n):
            raise ValueError(f"Cyclization pair ({i}, {j}) is outside sequence length {n}.")
        a, b = i - 1, j - 1
        if a != b:
            adj[a].append(b)
            adj[b].append(a)

    return [sorted(set(nei)) for nei in adj]


def shortest_path_matrix(adj: List[List[int]]) -> np.ndarray:
    n = len(adj)
    D = np.full((n, n), fill_value=10**9, dtype=np.int32)

    for s in range(n):
        D[s, s] = 0
        q = deque([s])
        while q:
            u = q.popleft()
            du = D[s, u]
            for v in adj[u]:
                if D[s, v] > du + 1:
                    D[s, v] = du + 1
                    q.append(v)
    return D


@lru_cache(maxsize=2)
def load_esmc(model_name: str, device: str):
    from esm.models.esmc import ESMC

    model = ESMC.from_pretrained(model_name).to(device)
    model.eval()
    return model


@torch.no_grad()
def esmc_token_embeddings(model, sequence: str, device: str) -> torch.Tensor:
    from esm.sdk.api import ESMProtein, LogitsConfig

    sequence = clean_sequence(sequence)
    L = len(sequence)

    protein = ESMProtein(sequence=sequence)
    protein_tensor = model.encode(protein).to(device)
    out = model.logits(protein_tensor, LogitsConfig(sequence=True, return_embeddings=True))
    emb = out.embeddings

    if isinstance(emb, np.ndarray):
        emb = torch.from_numpy(emb)

    emb = emb.to(device).detach()

    if emb.dim() == 3:
        if emb.shape[0] != 1:
            raise RuntimeError(f"Expected batch=1, got shape {tuple(emb.shape)}")
        emb = emb.squeeze(0)

    if emb.dim() != 2:
        raise RuntimeError(f"Expected 2D embeddings, got {tuple(emb.shape)}")

    T = emb.shape[0]

    if T == L:
        return emb
    if T == L + 2:
        return emb[1:-1, :]
    if T == L + 1:
        return emb[1:, :]
    if T > L + 2:
        start = (T - L) // 2
        return emb[start : start + L, :]

    raise RuntimeError(f"Cannot align embeddings: tokens={T}, seq_len={L}")


class Stop2MeltPredictor:
    def __init__(self, config: PredictorConfig):
        self.config = config
        self.device = config.device
        self.esmc = load_esmc(config.model_name, self.device)

        dummy_seq = "ACDEFGHIK"
        dummy_emb = esmc_token_embeddings(self.esmc, dummy_seq, self.device)
        d_model = dummy_emb.shape[1]

        self.model = CycOffsetRegressor(
            d_model=d_model,
            n_heads=config.n_heads,
            dmax=config.dmax,
            n_layers=config.n_layers,
            dropout=config.dropout,
        ).to(self.device)

        state = torch.load(config.checkpoint_path, map_location=self.device)
        self.model.load_state_dict(state)
        self.model.eval()

    @torch.no_grad()
    def predict_one(self, sequence: str, cyclization_pattern: Optional[str] = None) -> Dict[str, Any]:
        sequence = clean_sequence(sequence)
        if len(sequence) == 0:
            raise ValueError("Sequence is empty.")

        pairs = parse_simple_cyclization_pairs(cyclization_pattern)
        adj = build_adjacency(len(sequence), pairs)
        D = shortest_path_matrix(adj)
        D = np.clip(D, 0, self.config.dmax).astype(np.int64)

        tok = esmc_token_embeddings(self.esmc, sequence, self.device)

        L = tok.shape[0]
        X = tok.unsqueeze(0).to(dtype=torch.float32, device=self.device)
        D_tensor = torch.from_numpy(D).unsqueeze(0).to(self.device)
        mask = torch.ones((1, L), dtype=torch.bool, device=self.device)

        pred = self.model(X, D_tensor, mask).squeeze().item()

        return {
            "sequence": sequence,
            "cyclization_pattern": cyclization_pattern if cyclization_pattern is not None else "",
            "pred_stop2melt": float(pred),
        }

    @torch.no_grad()
    def predict_batch(
        self,
        df: pd.DataFrame,
        seq_col: str = "Sequence",
        cycl_col: str = "CyclizationPattern",
    ) -> pd.DataFrame:
        if seq_col not in df.columns:
            raise ValueError(f"Missing required column: {seq_col}")

        if cycl_col not in df.columns:
            df = df.copy()
            df[cycl_col] = ""

        results = []
        for _, row in df.iterrows():
            seq = row[seq_col]
            cyc = row[cycl_col]
            try:
                out = self.predict_one(seq, cyc)
                results.append(out)
            except Exception as exc:
                results.append(
                    {
                        "sequence": seq,
                        "cyclization_pattern": cyc,
                        "pred_stop2melt": np.nan,
                        "error": str(exc),
                    }
                )

        return pd.DataFrame(results)


def resolve_checkpoint_path() -> str:
    explicit_path = os.getenv("STOP2MELT_CHECKPOINT_PATH", "").strip()
    if explicit_path:
        if not os.path.exists(explicit_path):
            raise FileNotFoundError(
                f"STOP2MELT_CHECKPOINT_PATH does not exist: {explicit_path}"
            )
        return explicit_path

    repo_id = os.getenv("STOP2MELT_HF_REPO_ID", _DEFAULT_REPO_ID)
    filename = os.getenv("STOP2MELT_HF_FILENAME", _DEFAULT_FILENAME)
    return hf_hub_download(repo_id=repo_id, filename=filename, repo_type="model")


@lru_cache(maxsize=1)
def get_predictor() -> Stop2MeltPredictor:
    checkpoint_path = resolve_checkpoint_path()
    config = PredictorConfig(
        checkpoint_path=checkpoint_path,
        model_name=os.getenv("STOP2MELT_ESMC_MODEL", _DEFAULT_MODEL_NAME),
        dmax=int(os.getenv("STOP2MELT_DMAX", str(_DEFAULT_DMAX))),
        n_layers=int(os.getenv("STOP2MELT_N_LAYERS", str(_DEFAULT_N_LAYERS))),
        n_heads=int(os.getenv("STOP2MELT_N_HEADS", str(_DEFAULT_N_HEADS))),
        dropout=float(os.getenv("STOP2MELT_DROPOUT", str(_DEFAULT_DROPOUT))),
        device=os.getenv(
            "STOP2MELT_DEVICE",
            "cuda" if torch.cuda.is_available() else "cpu",
        ),
    )
    return Stop2MeltPredictor(config)


def stop2melt_healthcheck() -> Dict[str, Any]:
    checkpoint_path = Path(resolve_checkpoint_path())
    configured_device = os.getenv(
        "STOP2MELT_DEVICE",
        "cuda" if torch.cuda.is_available() else "cpu",
    )
    return {
        "ok": True,
        "ready": True,
        "predictor_loaded": False,
        "device": configured_device,
        "model_name": os.getenv("STOP2MELT_ESMC_MODEL", _DEFAULT_MODEL_NAME),
        "checkpoint_path": str(checkpoint_path),
        "checkpoint_exists": checkpoint_path.exists(),
        "dmax": int(os.getenv("STOP2MELT_DMAX", str(_DEFAULT_DMAX))),
        "n_layers": int(os.getenv("STOP2MELT_N_LAYERS", str(_DEFAULT_N_LAYERS))),
        "n_heads": int(os.getenv("STOP2MELT_N_HEADS", str(_DEFAULT_N_HEADS))),
    }


def predict_stop2melt(sequence: str, cyclization_pattern: Optional[str] = None) -> Dict[str, Any]:
    predictor = get_predictor()
    return predictor.predict_one(sequence, cyclization_pattern)


def predict_stop2melt_batch(
    items: List[Dict[str, Any]],
    sequence_field: str = "sequence",
    cyclization_field: str = "cyclization_pattern",
) -> Dict[str, Any]:
    predictor = get_predictor()

    normalized_rows = []
    for item in items:
        normalized_rows.append(
            {
                "Sequence": item.get(sequence_field, ""),
                "CyclizationPattern": item.get(cyclization_field, ""),
            }
        )

    df = pd.DataFrame(normalized_rows)
    result_df = predictor.predict_batch(df)

    records = result_df.replace({np.nan: None}).to_dict(orient="records")
    return {
        "count": len(items),
        "results": records,
    }
