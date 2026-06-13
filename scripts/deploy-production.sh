#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/chowdhurylab01/work/Cyclome-Database}"
WEB_DIR="${WEB_DIR:-/var/www/cyclome930.structf.studio}"
BACKEND_ENV="${BACKEND_ENV:-/home/chowdhurylab01/miniforge3/envs/cyclome-backend}"
BACKEND_PYTHON="${BACKEND_PYTHON:-$BACKEND_ENV/bin/python}"
BACKEND_PIP="${BACKEND_PIP:-$BACKEND_ENV/bin/pip}"
LOCK_FILE="${LOCK_FILE:-/tmp/cyclome-production-deploy.lock}"
PUBLIC_URL="${PUBLIC_URL:-https://cyclome930.structf.studio}"

RSYNC="${RSYNC:-/usr/bin/rsync}"
SYSTEMCTL="${SYSTEMCTL:-/usr/bin/systemctl}"
NGINX="${NGINX:-/usr/sbin/nginx}"

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

wait_for_url() {
  local url="$1"
  local output="$2"
  local attempts="${3:-30}"
  local delay="${4:-2}"

  for attempt in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >"$output"; then
      return 0
    fi
    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$delay"
    fi
  done

  echo "Timed out waiting for $url" >&2
  return 1
}

expect_http_code_in() {
  local actual="$1"
  shift

  local expected
  for expected in "$@"; do
    if [ "$actual" = "$expected" ]; then
      return 0
    fi
  done

  echo "Unexpected HTTP status $actual; expected one of: $*" >&2
  return 1
}

exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another Cyclome production deploy is already running."
  exit 1
}

echo ">>> Deploying Cyclome from $SOURCE_DIR"
echo ">>> Production app dir: $APP_DIR"

test -x "$BACKEND_PYTHON"
test -x "$BACKEND_PIP"
test -x "$RSYNC"

echo ">>> Syncing application source"
mkdir -p "$APP_DIR"
"$RSYNC" -a --delete \
  --exclude ".git/" \
  --exclude ".github/" \
  --exclude ".DS_Store" \
  --exclude ".Rhistory" \
  --exclude "actions-runner/" \
  --exclude "node_modules/" \
  --exclude "frontend/build/" \
  --exclude "frontend/.cache/" \
  --exclude "frontend/public/static/.venv/" \
  --exclude "backend/.venv/" \
  --exclude "backend/__pycache__/" \
  --exclude "backend/migration/*.ipynb" \
  "$SOURCE_DIR"/ "$APP_DIR"/

echo ">>> Installing Express dependencies"
cd "$APP_DIR/backend"
npm ci

echo ">>> Installing Python dependencies"
"$BACKEND_PYTHON" --version
"$BACKEND_PIP" install -r requirements.txt

echo ">>> Building frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo ">>> Publishing frontend"
test -d "$WEB_DIR"
test -w "$WEB_DIR"
"$RSYNC" -a --delete "$APP_DIR/frontend/build"/ "$WEB_DIR"/
find "$WEB_DIR" -type d -exec chmod 755 {} \;
find "$WEB_DIR" -type f -exec chmod 644 {} \;

echo ">>> Restarting Cyclome services"
sudo -n "$SYSTEMCTL" restart cyclome-flask.service
sudo -n "$SYSTEMCTL" restart cyclome-express.service
sudo -n "$SYSTEMCTL" restart cyclome-worker.service
sudo -n "$NGINX" -t
sudo -n "$SYSTEMCTL" reload nginx.service

echo ">>> Verifying local services"
sudo -n "$SYSTEMCTL" is-active cyclome-flask.service
sudo -n "$SYSTEMCTL" is-active cyclome-express.service
sudo -n "$SYSTEMCTL" is-active cyclome-worker.service
wait_for_url http://127.0.0.1:5001/api/health /tmp/cyclome-express-health.json
wait_for_url http://127.0.0.1:5002/api/health /tmp/cyclome-flask-health.json

echo ">>> Verifying public Cloudflare route"
wait_for_url "$PUBLIC_URL/api/health" /tmp/cyclome-public-health.json
wait_for_url "$PUBLIC_URL/api/similarity/cyclic-sequence/health" /tmp/cyclome-cyclic-health.json
wait_for_url "$PUBLIC_URL/api/similarity/criticl/health" /tmp/cyclome-criticl-health.json
wait_for_url "$PUBLIC_URL/api/similarity/stop2melt/health" /tmp/cyclome-stop2melt-health.json
expect_http_code_in "$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$PUBLIC_URL/api/health")" 403 405
expect_http_code_in "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$PUBLIC_URL/api/predict/criticl" -H 'Content-Type: application/json' --data '{"sequence":"ACDEFGHIK"}')" 404
expect_http_code_in "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$PUBLIC_URL/api/similarity/criticl" -H 'Content-Type: application/json' --data '{"sequence":"ACDEFGHIK"}')" 400 403

echo ">>> Cyclome production deploy complete"
