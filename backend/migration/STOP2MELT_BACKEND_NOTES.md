# Stop2Melt backend notes

## What was added

A Flask service module was added at `flask_stop2melt_service.py` and wired into `flask_app.py`.

Endpoints:
- `GET /api/predict/stop2melt/health`
- `POST /api/predict/stop2melt`
- `POST /api/predict/stop2melt/batch`

## Request shapes

### Single prediction

```json
{
  "sequence": "AKLAFKKLFQLICCCFK",
  "cyclization_pattern": "1-8"
}
```

### Batch prediction

```json
{
  "items": [
    {
      "sequence": "AKLAFKKLFQLICCCFK",
      "cyclization_pattern": ""
    },
    {
      "sequence": "ACDEFGHIK",
      "cyclization_pattern": "1-9"
    }
  ]
}
```

## Model/checkpoint resolution

The service resolves the checkpoint in this order:

1. `STOP2MELT_CHECKPOINT_PATH`
2. Hugging Face download using:
   - `STOP2MELT_HF_REPO_ID` (default: `KarunaAnna/STop2Melt`)
   - `STOP2MELT_HF_FILENAME` (default: `cycoffset_esmc_cymelt.pt`)

Optional runtime env vars:
- `STOP2MELT_DEVICE` (`cpu` or `cuda`)
- `STOP2MELT_ESMC_MODEL` (default `esmc_300m`)
- `STOP2MELT_DMAX`
- `STOP2MELT_N_LAYERS`
- `STOP2MELT_N_HEADS`
- `STOP2MELT_DROPOUT`

## Important deployment caveats

- First startup may download large pretrained weights.
- CPU inference is supported but may be slow.
- The Flask app loads the predictor lazily on first Stop2Melt request or health check.
- If the model repo is private, Hugging Face auth may be required in the runtime environment.

## Suggested local setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python flask_app.py
```

Then test:

```bash
curl http://localhost:5002/api/predict/stop2melt/health
```
