from __future__ import annotations

import hashlib
import os
import secrets
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request
from redis import Redis
from rq import Queue
from rq.job import Job
from werkzeug.exceptions import BadRequest, NotFound

from security_config import (
    MODEL_BATCH_MAX_ITEMS,
    MODEL_SEQUENCE_MAX_LENGTH,
    validate_cyclization_pattern,
    validate_items,
    validate_sequence,
    verify_turnstile_token,
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RQ_DEFAULT_TIMEOUT = int(os.getenv("CYCLOME_RQ_DEFAULT_TIMEOUT", str(60 * 60)))
JOB_RESULT_TTL = int(os.getenv("CYCLOME_JOB_RESULT_TTL", str(60 * 60 * 24)))
JOB_FAILURE_TTL = int(os.getenv("CYCLOME_JOB_FAILURE_TTL", str(60 * 60 * 24)))

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
        data["error"] = job.meta.get("message") or "job failed"
    if job.is_finished:
        data["result"] = job.result
    return data


def _require_json_object() -> Dict[str, Any]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise BadRequest("Request body must be a JSON object")
    return payload


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _issue_job_token(job: Job) -> str:
    token = secrets.token_urlsafe(32)
    job.meta["client_token_hash"] = _hash_token(token)
    job.save_meta()
    return token


def _request_job_token() -> str:
    return (
        request.headers.get("X-Cyclome-Job-Token")
        or request.args.get("job_token")
        or ""
    ).strip()


def _request_turnstile_token() -> str:
    return (
        request.headers.get("X-Cyclome-Turnstile-Token")
        or request.form.get("cf-turnstile-response")
        or ""
    ).strip()


def _request_remote_ip() -> str:
    return (
        request.headers.get("CF-Connecting-IP")
        or request.headers.get("X-Forwarded-For", "").split(",", 1)[0]
        or request.remote_addr
        or ""
    ).strip()


def _require_turnstile() -> None:
    try:
        verify_turnstile_token(
            _request_turnstile_token(),
            remote_ip=_request_remote_ip(),
        )
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc


def _require_job_access(job: Job) -> None:
    token_hash = job.meta.get("client_token_hash")
    if not token_hash:
        return
    token = _request_job_token()
    if not token or not secrets.compare_digest(_hash_token(token), str(token_hash)):
        raise NotFound(f"Job {job.get_id()} not found")


def _enqueue_with_token(queue_name: str, func_name: str, *args: Any):
    job = _queue(queue_name).enqueue(
        func_name,
        *args,
        result_ttl=JOB_RESULT_TTL,
        failure_ttl=JOB_FAILURE_TTL,
    )
    token = _issue_job_token(job)
    return jsonify({"task_id": job.get_id(), "status": "accepted", "job_token": token}), 202


def _parse_model_payload(payload: Dict[str, Any], *, index_label: str | None = None) -> Dict[str, str]:
    prefix = f"{index_label}." if index_label else ""
    sequence = validate_sequence(
        payload.get("sequence", ""),
        f"{prefix}sequence",
        max_length=MODEL_SEQUENCE_MAX_LENGTH,
    )
    cyclization_pattern = validate_cyclization_pattern(
        payload.get("cyclization_pattern", ""),
        f"{prefix}cyclization_pattern",
    )
    return {
        "sequence": sequence,
        "cyclization_pattern": cyclization_pattern,
    }


@jobs_bp.route("/jobs/criticl", methods=["POST"])
def enqueue_criticl_single():
    payload = _require_json_object()
    try:
        parsed = _parse_model_payload(payload)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc

    _require_turnstile()
    return _enqueue_with_token(
        "criticl",
        "tasks_criticl.task_criticl_predict",
        parsed["sequence"],
        parsed["cyclization_pattern"],
    )


@jobs_bp.route("/jobs/criticl/batch", methods=["POST"])
def enqueue_criticl_batch():
    payload = _require_json_object()
    try:
        items = validate_items(payload.get("items"), max_items=MODEL_BATCH_MAX_ITEMS)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc

    normalized_items: List[Dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise BadRequest(f"items[{index}] must be a JSON object")

        try:
            normalized_items.append(_parse_model_payload(item, index_label=f"items[{index}]"))
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc

    _require_turnstile()
    return _enqueue_with_token(
        "criticl",
        "tasks_criticl.task_criticl_batch",
        normalized_items,
    )


@jobs_bp.route("/jobs/stop2melt", methods=["POST"])
def enqueue_stop2melt_single():
    payload = _require_json_object()
    try:
        parsed = _parse_model_payload(payload)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc

    _require_turnstile()
    return _enqueue_with_token(
        "stop2melt",
        "tasks_stop2melt.task_stop2melt_predict",
        parsed["sequence"],
        parsed["cyclization_pattern"],
    )


@jobs_bp.route("/jobs/stop2melt/batch", methods=["POST"])
def enqueue_stop2melt_batch():
    payload = _require_json_object()
    try:
        items = validate_items(payload.get("items"), max_items=MODEL_BATCH_MAX_ITEMS)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc

    normalized_items: List[Dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise BadRequest(f"items[{index}] must be a JSON object")

        try:
            normalized_items.append(_parse_model_payload(item, index_label=f"items[{index}]"))
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc

    _require_turnstile()
    return _enqueue_with_token(
        "stop2melt",
        "tasks_stop2melt.task_stop2melt_batch",
        normalized_items,
    )


@jobs_bp.route("/jobs/<job_id>", methods=["GET"])
def get_job(job_id: str):
    try:
        job = Job.fetch(job_id, connection=_redis())
    except Exception:
        raise NotFound(f"Job {job_id} not found")
    _require_job_access(job)
    return jsonify(_job_json(job)), 200


@jobs_bp.route("/jobs/<job_id>/cancel", methods=["POST"])
def cancel_job(job_id: str):
    try:
        job = Job.fetch(job_id, connection=_redis())
    except Exception:
        raise NotFound(f"Job {job_id} not found")
    _require_job_access(job)

    if job.get_status() in ("queued", "started", "deferred"):
        job.cancel()
        return jsonify({"status": "canceled", "id": job_id}), 200
    return jsonify({"status": "not_cancelable", "id": job_id}), 409
