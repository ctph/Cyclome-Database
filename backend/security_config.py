from __future__ import annotations

import os
import re
import json
import urllib.parse
import urllib.request
from typing import Any, Iterable, List

AMINO_ACID_RE = re.compile(r"^[ACDEFGHIKLMNPQRSTVWYX]+$")


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


MODEL_SEQUENCE_MIN_LENGTH = env_int("CYCLOME_MODEL_SEQUENCE_MIN_LENGTH", 1)
MODEL_SEQUENCE_MAX_LENGTH = env_int("CYCLOME_MODEL_SEQUENCE_MAX_LENGTH", 2048)
CYCLIC_SEQUENCE_MAX_LENGTH = env_int("CYCLOME_CYCLIC_SEQUENCE_MAX_LENGTH", 5000)
MODEL_BATCH_MAX_ITEMS = env_int("CYCLOME_MODEL_BATCH_MAX_ITEMS", 25)
CYCLIC_BATCH_MAX_ITEMS = env_int("CYCLOME_CYCLIC_BATCH_MAX_ITEMS", 50)
CYCLIZATION_PATTERN_MAX_LENGTH = env_int("CYCLOME_CYCLIZATION_PATTERN_MAX_LENGTH", 500)
TURNSTILE_SECRET_KEY = os.getenv("CYCLOME_TURNSTILE_SECRET_KEY", "").strip()
TURNSTILE_REQUIRED = env_bool("CYCLOME_TURNSTILE_REQUIRED", bool(TURNSTILE_SECRET_KEY))
TURNSTILE_EXPECTED_HOSTNAME = os.getenv(
    "CYCLOME_TURNSTILE_EXPECTED_HOSTNAME",
    "cyclome930.structf.studio",
).strip()
TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def clean_sequence(value: Any) -> str:
    return str(value or "").strip().replace(" ", "").replace("\n", "").upper()


def validate_sequence(
    value: Any,
    field: str = "sequence",
    *,
    max_length: int = MODEL_SEQUENCE_MAX_LENGTH,
    min_length: int = MODEL_SEQUENCE_MIN_LENGTH,
) -> str:
    sequence = clean_sequence(value)
    if len(sequence) < min_length:
        raise ValueError(f"{field} is required")
    if len(sequence) > max_length:
        raise ValueError(f"{field} exceeds maximum length of {max_length}")
    if not AMINO_ACID_RE.fullmatch(sequence):
        raise ValueError(
            f"{field} contains unsupported characters; allowed amino acids are ACDEFGHIKLMNPQRSTVWYX"
        )
    return sequence


def validate_cyclization_pattern(value: Any, field: str = "cyclization_pattern") -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    pattern = value.strip()
    if len(pattern) > CYCLIZATION_PATTERN_MAX_LENGTH:
        raise ValueError(f"{field} exceeds maximum length of {CYCLIZATION_PATTERN_MAX_LENGTH}")
    if pattern and not re.fullmatch(r"[0-9,\-\s]+", pattern):
        raise ValueError(f"{field} contains unsupported characters")
    return pattern


def validate_items(items: Any, *, max_items: int) -> List[Any]:
    if not isinstance(items, list) or len(items) == 0:
        raise ValueError("items must be a non-empty array")
    if len(items) > max_items:
        raise ValueError(f"items exceeds maximum length of {max_items}")
    return items


def validate_ids(values: Iterable[Any], *, max_items: int = 500) -> List[str]:
    ids: List[str] = []
    for value in values:
        cleaned = str(value or "").strip().lower()
        if re.fullmatch(r"[a-z0-9_]+", cleaned):
            ids.append(cleaned)
        if len(ids) >= max_items:
            break
    return ids


def verify_turnstile_token(token: str, *, remote_ip: str = "") -> None:
    if not TURNSTILE_REQUIRED:
        return
    if not TURNSTILE_SECRET_KEY:
        raise ValueError("Verification is not configured")
    if not token:
        raise ValueError("Verification token is required")

    body = {
        "secret": TURNSTILE_SECRET_KEY,
        "response": token,
    }
    if remote_ip:
        body["remoteip"] = remote_ip

    request = urllib.request.Request(
        TURNSTILE_SITEVERIFY_URL,
        data=urllib.parse.urlencode(body).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise ValueError("Verification service unavailable") from exc

    if not result.get("success"):
        raise ValueError("Verification failed")

    if TURNSTILE_EXPECTED_HOSTNAME:
        hostname = str(result.get("hostname") or "")
        if hostname and hostname != TURNSTILE_EXPECTED_HOSTNAME:
            raise ValueError("Verification hostname mismatch")
