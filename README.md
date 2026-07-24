# Cyclome Database

[website](https://cyclome930.structf.studio/)

## Installation

### Local Server

1. Clone the GitHub repo:

```bash
git clone https://github.com/ctph/Cyclome-Database
cd ./Cyclome-Database
```

2. Open a terminal, install backend requirements, and start the Flask model API:

```bash
cd ./backend
python -m venv venv

# if you're on Windows
.\venv\Scripts\activate

# if you're on Mac or Linux
source ./venv/bin/activate

pip install -r requirements.txt
flask --app flask_app run --host 127.0.0.1 --port 5002
```

3. Open another terminal, install Express packages, and start the API gateway:

```bash
cd ./backend
npm install
npm run dev
```

4. Open another terminal, install frontend packages, and start the web UI:

```bash
cd ./frontend
npm install
npm start
```

Open a browser with url [localhost](http://localhost:3000/).

## Production Deployment

The production site is served through Cloudflare Tunnel at:

```text
https://cyclome930.structf.studio
```

Production runs on the Chowdhury Lab workstation:

```text
/home/chowdhurylab01/work/Cyclome-Database
/var/www/cyclome930.structf.studio
```

Production services:

```text
cyclome-flask.service
cyclome-express.service
cyclome-worker.service
nginx.service
cloudflared.service
redis-server.service
```

Deployment is handled by GitHub Actions on the self-hosted runner labeled:

```text
cyclome-workstation
```

The deploy script is:

```text
scripts/deploy-production.sh
```

## Production Security Notes

Production clients should call the API through same-origin routes:

```text
https://cyclome930.structf.studio/api/*
```

Direct public non-health `/api/predict/*` routes are intentionally blocked. The frontend uses `/api/similarity/*`, which proxies to the Flask model backend.

The active Cloudflare rate-limit rule protects expensive model enqueue routes:

```text
POST /api/similarity/criticl
POST /api/similarity/criticl/batch
POST /api/similarity/stop2melt
POST /api/similarity/stop2melt/batch
```

Polling and canceling queued jobs requires the returned job token:

```text
X-Cyclome-Job-Token
```

Cloudflare WAF also blocks obvious bad paths and disallowed HTTP methods.

Rate-limited requests return `429`. If disallowed methods or bad paths return `403`, that is expected.

After deployment, verify:

```bash
curl -i https://cyclome930.structf.studio/api/health
curl -i https://cyclome930.structf.studio/api/similarity/criticl/health
curl -i https://cyclome930.structf.studio/api/similarity/stop2melt/health
curl -i -X DELETE https://cyclome930.structf.studio/api/health
```

Expected result: health endpoints return JSON, while disallowed methods are blocked.
