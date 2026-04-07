from __future__ import annotations

from typing import Any, Dict, List

from flask import Blueprint, jsonify, request
from redis import Redis
from rq import Queue
from rq.job import Job
from werkzeug.exceptions import BadRequest, NotFound

from flask_stop2melt_service import predict_stop2melt, predict_stop2melt_batch

REDIS_URL = "redis://localhost:6379/0"
RQ_DEFAULT_TIMEOUT = 60 * 60

jobs_bp = Blueprint("jobs", __name__)


def _redis() -> Redis:
    return Redis.from_url(REDIS_URL)


def _queue(name: str) -> Queue:
    return Queue(name, connection=_redis(), default_timeout=RQ_DEFAULT_TIMEOUT)


def _job_json(job: Job) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "id": job.get_id(),
        "status": job.get_status(refresh=True),
        "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "ended_at": job.ended_at.isoformat() if job.ended_at else None,
        "progress": job.meta.get("progress"),
        "message": job.meta.get("message"),
    }
    if job.is_failed:
        data["error"] = job.exc_info or "failed"
    if job.is_finished:
        data["result"] = job.result
    return data


def _require_json_object() -> Dict[str, Any]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise BadRequest("Request body must be a JSON object")
    return payload


@jobs_bp.route("/jobs/stop2melt", methods=["POST"])
def enqueue_stop2melt_single():
    payload = _require_json_object()
    sequence = payload.get("sequence", "")
    cyclization_pattern = payload.get("cyclization_pattern", "")

    if not isinstance(sequence, str) or not sequence.strip():
        raise BadRequest("sequence is required")
    if cyclization_pattern is not None and not isinstance(cyclization_pattern, str):
        raise BadRequest("cyclization_pattern must be a string")

    job = _queue("stop2melt").enqueue(
        "tasks_stop2melt.task_stop2melt_predict",
        sequence.strip(),
        (cyclization_pattern or "").strip(),
    )
    return jsonify({"task_id": job.get_id(), "status": "accepted"}), 202


@jobs_bp.route("/jobs/stop2melt/batch", methods=["POST"])
def enqueue_stop2melt_batch():
    payload = _require_json_object()
    items = payload.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise BadRequest("items must be a non-empty array")

    normalized_items: List[Dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise BadRequest(f"items[{index}] must be a JSON object")

        sequence = item.get("sequence", "")
        cyclization_pattern = item.get("cyclization_pattern", "")

        if not isinstance(sequence, str) or not sequence.strip():
            raise BadRequest(f"items[{index}].sequence is required")
        if cyclization_pattern is not None and not isinstance(cyclization_pattern, str):
            raise BadRequest(f"items[{index}].cyclization_pattern must be a string")

        normalized_items.append(
            {
                "sequence": sequence.strip(),
                "cyclization_pattern": (cyclization_pattern or "").strip(),
            }
        )

    job = _queue("stop2melt").enqueue(
        "tasks_stop2melt.task_stop2melt_batch",
        normalized_items,
    )
    return jsonify({"task_id": job.get_id(), "status": "accepted"}), 202


@jobs_bp.route("/jobs/<job_id>", methods=["GET"])
def get_job(job_id: str):
    try:
        job = Job.fetch(job_id, connection=_redis())
    except Exception:
        raise NotFound(f"Job {job_id} not found")
    return jsonify(_job_json(job)), 200


@jobs_bp.route("/jobs/<job_id>/cancel", methods=["POST"])
def cancel_job(job_id: str):
    try:
        job = Job.fetch(job_id, connection=_redis())
    except Exception:
        raise NotFound(f"Job {job_id} not found")

    if job.get_status() in ("queued", "started", "deferred"):
        job.cancel()
        return jsonify({"status": "canceled", "id": job_id}), 200
    return jsonify({"status": "not_cancelable", "id": job_id}), 409
