# Stop2Melt integration

## Recommended API surface

Use the existing Node backend as the public API surface and let it proxy to Flask.

Node routes added:
- `GET /api/similarity/stop2melt/health`
- `POST /api/similarity/stop2melt`
- `POST /api/similarity/stop2melt/batch`
- `POST /api/similarity/cyclic-sequence`
- `POST /api/similarity/cyclic-sequence/batch`
- `GET /api/similarity/cyclic-sequence/health`

This keeps the frontend talking to one backend origin.

## Environment

Node proxy target:

```bash
FLASK_BACKEND_URL=http://127.0.0.1:5002
```

If unset, the proxy defaults to `http://127.0.0.1:5002`.

## Frontend request examples

### Stop2Melt single

```http
POST /api/similarity/stop2melt
Content-Type: application/json

{
  "sequence": "AKLAFKKLFQLICCCFK",
  "cyclization_pattern": ""
}
```

### Stop2Melt batch

```http
POST /api/similarity/stop2melt/batch
Content-Type: application/json

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

### Cyclic sequence similarity single

```http
POST /api/similarity/cyclic-sequence
Content-Type: application/json

{
  "query_sequence": "ACDEFG",
  "template_sequence": "CDEFGA",
  "template_cyclization": "1-6"
}
```

## Operational notes

- The Flask server must be running for proxy routes to work.
- The first Stop2Melt request may be slow because model assets are loaded lazily.
- If you want faster first-response time, warm the model at deploy time by calling:

```bash
curl http://127.0.0.1:5002/api/predict/stop2melt/health
```

## Recommendation

For production, run Flask behind a process manager and avoid Flask debug mode.
