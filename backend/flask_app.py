from __future__ import annotations

from typing import Any, Dict

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import BadRequest, NotFound

# geomscan
from pathlib import Path
import subprocess
import sys
import pandas as pd

from flask_criticl_service import (
    criticl_healthcheck,
    predict_criticl,
    predict_criticl_batch,
)
from flask_similarity_service import cyclicity_aware_similarity
from flask_stop2melt_service import (
    predict_stop2melt,
    predict_stop2melt_batch,
    stop2melt_healthcheck,
)
from jobs_routes import jobs_bp
from security_config import (
    CYCLIC_BATCH_MAX_ITEMS,
    CYCLIC_SEQUENCE_MAX_LENGTH,
    MODEL_BATCH_MAX_ITEMS,
    MODEL_SEQUENCE_MAX_LENGTH,
    validate_cyclization_pattern,
    validate_items,
    validate_sequence,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024
CORS(
    app,
    origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://cyclome930.structf.studio",
    ],
)
app.register_blueprint(jobs_bp)


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


def parse_similarity_request(payload: Dict[str, Any]):
    query_sequence = validate_sequence(
        require_string(payload, "query_sequence"),
        "query_sequence",
        max_length=CYCLIC_SEQUENCE_MAX_LENGTH,
    )
    template_sequence = validate_sequence(
        require_string(payload, "template_sequence"),
        "template_sequence",
        max_length=CYCLIC_SEQUENCE_MAX_LENGTH,
    )
    template_cyclization = validate_cyclization_pattern(
        payload.get("template_cyclization", ""),
        "template_cyclization",
    )

    match_score = optional_int(payload, "match_score", 2)
    mismatch_score = optional_int(payload, "mismatch_score", -1)
    gap_penalty = optional_int(payload, "gap_penalty", -2)

    return {
        "query_seq": query_sequence,
        "template_seq": template_sequence,
        "template_cyclization": template_cyclization,
        "match_score": match_score,
        "mismatch_score": mismatch_score,
        "gap_penalty": gap_penalty,
    }


@app.post("/api/similarity/cyclic-sequence")
def cyclic_sequence_similarity():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request body must be a JSON object", 400)

    try:
        result = cyclicity_aware_similarity(**parse_similarity_request(payload))
        return jsonify(result)
    except ValueError as exc:
        return json_error(str(exc), 400)
    except Exception:
        return json_error("Internal server error", 500)


@app.post("/api/similarity/cyclic-sequence/batch")
def cyclic_sequence_similarity_batch():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request body must be a JSON object", 400)

    try:
        items = validate_items(payload.get("items"), max_items=CYCLIC_BATCH_MAX_ITEMS)
    except ValueError as exc:
        return json_error(str(exc), 400)

    results = []
    errors = []

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append({"index": index, "error": "Each item must be a JSON object"})
            continue
        try:
            result = cyclicity_aware_similarity(**parse_similarity_request(item))
            results.append({"index": index, "result": result})
        except ValueError as exc:
            errors.append({"index": index, "error": str(exc)})
        except Exception:
            errors.append({"index": index, "error": "Internal server error"})

    status = 200 if not errors else 207
    return (
        jsonify(
            {
                "count": len(items),
                "success_count": len(results),
                "error_count": len(errors),
                "results": results,
                "errors": errors,
            }
        ),
        status,
    )


def parse_stop2melt_request(payload: Dict[str, Any]):
    sequence = validate_sequence(
        require_string(payload, "sequence"),
        "sequence",
        max_length=MODEL_SEQUENCE_MAX_LENGTH,
    )
    cyclization_pattern = validate_cyclization_pattern(
        payload.get("cyclization_pattern", ""),
        "cyclization_pattern",
    )

    return {
        "sequence": sequence,
        "cyclization_pattern": cyclization_pattern,
    }


@app.get("/api/predict/criticl/health")
def criticl_health():
    try:
        return jsonify(criticl_healthcheck())
    except FileNotFoundError as exc:
        return json_error(str(exc), 503)
    except Exception as exc:
        return json_error(f"CritiCL model unavailable: {exc}", 503)


@app.post("/api/predict/criticl")
def criticl_predict():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request body must be a JSON object", 400)

    try:
        result = predict_criticl(**parse_stop2melt_request(payload))
        return jsonify(result)
    except ValueError as exc:
        return json_error(str(exc), 400)
    except FileNotFoundError as exc:
        return json_error(str(exc), 503)
    except Exception as exc:
        return json_error(f"CritiCL inference failed: {exc}", 500)


@app.post("/api/predict/criticl/batch")
def criticl_predict_batch_route():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request body must be a JSON object", 400)

    try:
        items = validate_items(payload.get("items"), max_items=MODEL_BATCH_MAX_ITEMS)
    except ValueError as exc:
        return json_error(str(exc), 400)

    normalized_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            return json_error(f"items[{index}] must be a JSON object", 400)
        try:
            normalized_items.append(parse_stop2melt_request(item))
        except ValueError as exc:
            return json_error(f"items[{index}]: {exc}", 400)

    try:
        result = predict_criticl_batch(normalized_items)
        return jsonify(result)
    except FileNotFoundError as exc:
        return json_error(str(exc), 503)
    except Exception as exc:
        return json_error(f"CritiCL batch inference failed: {exc}", 500)

@app.post("/api/geomscan/run")
def run_geomscan():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    pdb_file = payload.get("pdb_file")

    if not pdb_file:
        return json_error("pdb_file is required", 400)

    base_dir = Path(__file__).resolve().parent
    pdb_path = base_dir / pdb_file
    templates_dir = base_dir / "geomscan_data"

    if not pdb_path.exists():
        return json_error(f"PDB file not found: {pdb_file}", 404)

    out_hits = base_dir / "geomscan_hits.tsv"
    out_all = base_dir / "geomscan_all.tsv"
    out_pml = base_dir / "geomscan_hits.pml"

    cmd = [
        sys.executable,
        str(base_dir / "geomscan.py"),
        "--pdb-file", str(pdb_path),
        "--templates-dir", str(templates_dir),
        "--out-hits", str(out_hits),
        "--out-all", str(out_all),
        "--out-pml", str(out_pml),
        "--workers", "1",
    ]

    try:
        completed = subprocess.run(
            cmd,
            cwd=base_dir,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )

        if completed.returncode != 0:
            return json_error(completed.stderr or "geomscan failed", 500)

        if out_hits.exists() and out_hits.stat().st_size > 0:
            hits = pd.read_csv(out_hits, sep="\t").to_dict(orient="records")
        else:
            hits = []

        return jsonify({
            "ok": True,
            "pdb_file": pdb_file,
            "hits_count": len(hits),
            "hits": hits,
            "stdout": completed.stdout,
        })

    except subprocess.TimeoutExpired:
        return json_error("geomscan timed out", 504)

@app.get("/api/predict/stop2melt/health")
def stop2melt_health():
    try:
        return jsonify(stop2melt_healthcheck())
    except FileNotFoundError as exc:
        return json_error(str(exc), 503)
    except Exception as exc:
        return json_error(f"Stop2Melt model unavailable: {exc}", 503)


@app.post("/api/predict/stop2melt")
def stop2melt_predict():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request body must be a JSON object", 400)

    try:
        result = predict_stop2melt(**parse_stop2melt_request(payload))
        return jsonify(result)
    except ValueError as exc:
        return json_error(str(exc), 400)
    except FileNotFoundError as exc:
        return json_error(str(exc), 503)
    except Exception as exc:
        return json_error(f"Stop2Melt inference failed: {exc}", 500)


@app.post("/api/predict/stop2melt/batch")
def stop2melt_predict_batch_route():
    if not request.is_json:
        return json_error("Request body must be JSON", 400)

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request body must be a JSON object", 400)

    try:
        items = validate_items(payload.get("items"), max_items=MODEL_BATCH_MAX_ITEMS)
    except ValueError as exc:
        return json_error(str(exc), 400)

    normalized_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            return json_error(f"items[{index}] must be a JSON object", 400)
        try:
            normalized_items.append(parse_stop2melt_request(item))
        except ValueError as exc:
            return json_error(f"items[{index}]: {exc}", 400)

    try:
        result = predict_stop2melt_batch(normalized_items)
        return jsonify(result)
    except FileNotFoundError as exc:
        return json_error(str(exc), 503)
    except Exception as exc:
        return json_error(f"Stop2Melt batch inference failed: {exc}", 500)


@app.errorhandler(BadRequest)
def handle_bad_request(exc: BadRequest):
    return json_error(str(exc.description or exc), 400)


@app.errorhandler(NotFound)
def handle_not_found(exc: NotFound):
    return json_error(str(exc.description or exc), 404)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5002, debug=False)
