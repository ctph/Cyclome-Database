from __future__ import annotations

import os
import re
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


MODEL_SEQUENCE_MIN_LENGTH = env_int("CYCLOME_MODEL_SEQUENCE_MIN_LENGTH", 1)
MODEL_SEQUENCE_MAX_LENGTH = env_int("CYCLOME_MODEL_SEQUENCE_MAX_LENGTH", 2048)
CYCLIC_SEQUENCE_MAX_LENGTH = env_int("CYCLOME_CYCLIC_SEQUENCE_MAX_LENGTH", 5000)
MODEL_BATCH_MAX_ITEMS = env_int("CYCLOME_MODEL_BATCH_MAX_ITEMS", 25)
CYCLIC_BATCH_MAX_ITEMS = env_int("CYCLOME_CYCLIC_BATCH_MAX_ITEMS", 50)
CYCLIZATION_PATTERN_MAX_LENGTH = env_int("CYCLOME_CYCLIZATION_PATTERN_MAX_LENGTH", 500)


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
