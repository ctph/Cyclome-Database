from __future__ import annotations

from typing import Any, Dict, List

from rq import get_current_job

from flask_criticl_service import predict_criticl, predict_criticl_batch


def _set_progress(pct: float, message: str | None = None):
    job = get_current_job()
    if not job:
        return
    job.meta["progress"] = max(0, min(100, round(float(pct), 1)))
    if message is not None:
        job.meta["message"] = message
    job.save_meta()


def task_criticl_predict(sequence: str, cyclization_pattern: str = "") -> Dict[str, Any]:
    _set_progress(5, "loading model")
    result = predict_criticl(sequence=sequence, cyclization_pattern=cyclization_pattern)
    _set_progress(100, "done")
    return result


def task_criticl_batch(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not items:
        raise ValueError("No items provided")

    _set_progress(5, "loading model")
    result = predict_criticl_batch(items)
    _set_progress(100, "done")
    return result
