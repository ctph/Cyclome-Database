from __future__ import annotations

from typing import Any, Dict

from flask import Flask, jsonify, request

from flask_similarity_service import cyclicity_aware_similarity

app = Flask(__name__)


def json_error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def require_string(payload: Dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if value is None:
        raise ValueError(f"{field} is required")
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    if field != "template_cyclization" and not value.strip():
        raise ValueError(f"{field} cannot be empty")
    return value


def optional_int(payload: Dict[str, Any], field: str, default: int) -> int:
    value = payload.get(field, default)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{field} must be an integer")
    return value


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.post("/api/similarity/cyclic-sequence")
def cyclic_sequence_similarity():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request body must be a JSON object", 400)

    try:
        query_sequence = require_string(payload, "query_sequence")
        template_sequence = require_string(payload, "template_sequence")
        template_cyclization = payload.get("template_cyclization", "")
        if template_cyclization is None:
            template_cyclization = ""
        if not isinstance(template_cyclization, str):
            raise ValueError("template_cyclization must be a string")

        match_score = optional_int(payload, "match_score", 2)
        mismatch_score = optional_int(payload, "mismatch_score", -1)
        gap_penalty = optional_int(payload, "gap_penalty", -2)

        result = cyclicity_aware_similarity(
            query_seq=query_sequence,
            template_seq=template_sequence,
            template_cyclization=template_cyclization,
            match_score=match_score,
            mismatch_score=mismatch_score,
            gap_penalty=gap_penalty,
        )
        return jsonify(result)
    except ValueError as exc:
        return json_error(str(exc), 400)
    except Exception:
        return json_error("Internal server error", 500)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
