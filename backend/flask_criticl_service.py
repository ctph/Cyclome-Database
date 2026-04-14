from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import torch
from huggingface_hub import hf_hub_download

_DEFAULT_REPO_ID = "KarunaAnna/CritiCL"
_DEFAULT_MODEL_FILENAME = "model_XGB.joblib"
_DEFAULT_LABEL_ENCODER_FILENAME = "label_encoder.joblib"
_DEFAULT_MODEL_NAME = "esmc_300m"


@dataclass
class CritiCLConfig:
    model_path: str
    label_encoder_path: Optional[str] = None
    model_name: str = _DEFAULT_MODEL_NAME
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


def clean_sequence(seq: Any) -> str:
    if seq is None:
        return ""
    if pd.isna(seq):
        return ""
    return str(seq).strip().replace(" ", "").replace("\n", "").upper()


@lru_cache(maxsize=2)
def load_esmc(model_name: str, device: str):
    try:
        from esm.models.esmc import ESMC
    except ModuleNotFoundError:
        from esm.pretrained import ESMC

    model = ESMC.from_pretrained(model_name).to(device)
    model.eval()
    return model


@torch.no_grad()
def esmc_token_embeddings_aligned(model, sequence: str, device: str) -> torch.Tensor:
    from esm.sdk.api import ESMProtein, LogitsConfig

    sequence = clean_sequence(sequence)
    if not sequence:
        raise ValueError("Sequence is empty.")

    seq_len = len(sequence)
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

    token_len = emb.shape[0]
    if token_len == seq_len:
        return emb
    if token_len == seq_len + 2:
        return emb[1:-1, :]
    if token_len == seq_len + 1:
        return emb[1:, :]
    if token_len > seq_len:
        start = (token_len - seq_len) // 2
        return emb[start : start + seq_len, :]

    raise RuntimeError(f"Cannot align embeddings: tokens={token_len}, seq_len={seq_len}")


@torch.no_grad()
def sequence_to_embedding(sequence: str, model, device: str) -> np.ndarray:
    emb_ld = esmc_token_embeddings_aligned(model, sequence, device=device)
    pooled = emb_ld.mean(dim=0)
    return pooled.detach().cpu().numpy().astype(np.float32, copy=False)


class CritiCLPredictor:
    def __init__(self, config: CritiCLConfig):
        self.config = config
        self.device = config.device
        self.esmc = load_esmc(config.model_name, self.device)
        self.model = joblib.load(config.model_path)
        self.label_encoder = joblib.load(config.label_encoder_path) if config.label_encoder_path else None

    def _decode_predictions(self, predictions: np.ndarray) -> List[Any]:
        if self.label_encoder is None:
            return predictions.tolist()
        try:
            return self.label_encoder.inverse_transform(np.asarray(predictions, dtype=int)).tolist()
        except Exception:
            return predictions.tolist()

    def predict_batch(
        self,
        df: pd.DataFrame,
        seq_col: str = "Sequence",
        cycl_col: str = "CyclizationPattern",
    ) -> pd.DataFrame:
        if seq_col not in df.columns:
            raise ValueError(f"Missing required column: {seq_col}")

        work = df.copy()
        if cycl_col not in work.columns:
            work[cycl_col] = ""

        embeddings = []
        errors: List[Optional[str]] = []

        for sequence in work[seq_col]:
            try:
                embeddings.append(sequence_to_embedding(sequence, self.esmc, self.device))
                errors.append(None)
            except Exception as exc:
                embeddings.append(None)
                errors.append(str(exc))

        out = work.reset_index(drop=True).copy()
        out["error"] = errors
        ok_mask = [emb is not None for emb in embeddings]

        if any(ok_mask):
            valid_embeddings = np.vstack([emb for emb in embeddings if emb is not None])
            expected_features = getattr(self.model, "n_features_in_", valid_embeddings.shape[1])
            if valid_embeddings.shape[1] != expected_features:
                raise ValueError(
                    f"Feature shape mismatch, expected: {expected_features}, got {valid_embeddings.shape[1]}"
                )

            raw_predictions = self.model.predict(valid_embeddings)
            decoded_predictions = self._decode_predictions(raw_predictions)

            prediction_iter = iter(decoded_predictions)
            raw_iter = iter(np.asarray(raw_predictions).tolist())
            out["prediction"] = [next(prediction_iter) if ok else None for ok in ok_mask]
            out["prediction_raw"] = [next(raw_iter) if ok else None for ok in ok_mask]

            if hasattr(self.model, "predict_proba"):
                probabilities = self.model.predict_proba(valid_embeddings)
                class_names: List[str]
                if self.label_encoder is not None and hasattr(self.label_encoder, "classes_"):
                    class_names = [str(c) for c in self.label_encoder.classes_]
                elif hasattr(self.model, "classes_"):
                    class_names = [str(c) for c in self.model.classes_]
                else:
                    class_names = [f"class_{i}" for i in range(probabilities.shape[1])]

                proba_rows = iter(probabilities)
                confidence_values = []
                class_prob_columns = {f"proba_{name}": [] for name in class_names}
                for ok in ok_mask:
                    if not ok:
                        confidence_values.append(None)
                        for key in class_prob_columns:
                            class_prob_columns[key].append(None)
                        continue
                    row = next(proba_rows)
                    confidence_values.append(float(np.max(row)))
                    for idx, name in enumerate(class_names):
                        class_prob_columns[f"proba_{name}"].append(float(row[idx]))

                out["confidence_max"] = confidence_values
                for key, values in class_prob_columns.items():
                    out[key] = values
        else:
            out["prediction"] = None
            out["prediction_raw"] = None

        return out

    def predict_one(self, sequence: str, cyclization_pattern: Optional[str] = None) -> Dict[str, Any]:
        df = pd.DataFrame(
            [
                {
                    "Sequence": clean_sequence(sequence),
                    "CyclizationPattern": cyclization_pattern or "",
                }
            ]
        )
        result = self.predict_batch(df).replace({np.nan: None}).to_dict(orient="records")[0]
        return {
            "sequence": result.get("Sequence"),
            "cyclization_pattern": result.get("CyclizationPattern", ""),
            "prediction": result.get("prediction"),
            "prediction_raw": result.get("prediction_raw"),
            "confidence_max": result.get("confidence_max"),
            "probabilities": {
                key.removeprefix("proba_"): value
                for key, value in result.items()
                if key.startswith("proba_") and value is not None
            },
            **({"error": result["error"]} if result.get("error") else {}),
        }


def resolve_model_path() -> str:
    explicit_path = os.getenv("CRITICL_MODEL_PATH", "").strip()
    if explicit_path:
        if not os.path.exists(explicit_path):
            raise FileNotFoundError(f"CRITICL_MODEL_PATH does not exist: {explicit_path}")
        return explicit_path

    repo_id = os.getenv("CRITICL_HF_REPO_ID", _DEFAULT_REPO_ID)
    filename = os.getenv("CRITICL_HF_MODEL_FILENAME", _DEFAULT_MODEL_FILENAME)
    return hf_hub_download(repo_id=repo_id, filename=filename, repo_type="model")


def resolve_label_encoder_path() -> Optional[str]:
    explicit_path = os.getenv("CRITICL_LABEL_ENCODER_PATH", "").strip()
    if explicit_path:
        if not os.path.exists(explicit_path):
            raise FileNotFoundError(f"CRITICL_LABEL_ENCODER_PATH does not exist: {explicit_path}")
        return explicit_path

    filename = os.getenv("CRITICL_HF_LABEL_ENCODER_FILENAME", _DEFAULT_LABEL_ENCODER_FILENAME).strip()
    if not filename:
        return None

    repo_id = os.getenv("CRITICL_HF_REPO_ID", _DEFAULT_REPO_ID)
    try:
        return hf_hub_download(repo_id=repo_id, filename=filename, repo_type="model")
    except Exception:
        return None


@lru_cache(maxsize=1)
def get_predictor() -> CritiCLPredictor:
    config = CritiCLConfig(
        model_path=resolve_model_path(),
        label_encoder_path=resolve_label_encoder_path(),
        model_name=os.getenv("CRITICL_ESMC_MODEL", _DEFAULT_MODEL_NAME),
        device=os.getenv("CRITICL_DEVICE", "cuda" if torch.cuda.is_available() else "cpu"),
    )
    return CritiCLPredictor(config)


def criticl_healthcheck() -> Dict[str, Any]:
    configured_device = os.getenv("CRITICL_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
    model_path = Path(resolve_model_path())
    label_encoder_path = resolve_label_encoder_path()
    return {
        "ok": True,
        "ready": model_path.exists(),
        "predictor_loaded": False,
        "device": configured_device,
        "model_name": os.getenv("CRITICL_ESMC_MODEL", _DEFAULT_MODEL_NAME),
        "model_path": str(model_path),
        "model_exists": model_path.exists(),
        "label_encoder_path": label_encoder_path,
        "label_encoder_exists": bool(label_encoder_path and Path(label_encoder_path).exists()),
    }


def predict_criticl(sequence: str, cyclization_pattern: Optional[str] = None) -> Dict[str, Any]:
    predictor = get_predictor()
    return predictor.predict_one(sequence=sequence, cyclization_pattern=cyclization_pattern)


def predict_criticl_batch(
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

    result_df = predictor.predict_batch(pd.DataFrame(normalized_rows))
    records = result_df.replace({np.nan: None}).to_dict(orient="records")
    return {
        "count": len(items),
        "results": [
            {
                "sequence": row.get("Sequence"),
                "cyclization_pattern": row.get("CyclizationPattern", ""),
                "prediction": row.get("prediction"),
                "prediction_raw": row.get("prediction_raw"),
                "confidence_max": row.get("confidence_max"),
                "probabilities": {
                    key.removeprefix("proba_"): value
                    for key, value in row.items()
                    if key.startswith("proba_") and value is not None
                },
                **({"error": row["error"]} if row.get("error") else {}),
            }
            for row in records
        ],
    }
