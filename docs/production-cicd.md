# Production CI/CD

Cyclome production is deployed to the Chowdhury Lab workstation behind Cloudflare Tunnel.

Public URL:

```text
https://cyclome930.structf.studio
```

Production paths on the workstation:

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

## Workflows

- `Frontend CI` builds `frontend/` on pull requests and pushes to `main`.
- `Backend Smoke` checks the Express entrypoint and compiles backend Python on pull requests and pushes to `main`.
- `Deploy Production` runs on every push to `main` and can also be started manually with `workflow_dispatch`.

The deploy workflow expects a self-hosted GitHub Actions runner on the workstation with the label:

```text
cyclome-workstation
```

The deploy script is:

```text
scripts/deploy-production.sh
```

## Runner Requirements

The runner user is expected to be `chowdhurylab01`.

Required local tools:

```text
node
npm
rsync
curl
flock
sudo
```

Required Python environment:

```text
/home/chowdhurylab01/miniforge3/envs/cyclome-backend
```

Required noninteractive sudo commands:

```text
/usr/bin/systemctl restart cyclome-flask.service
/usr/bin/systemctl restart cyclome-express.service
/usr/bin/systemctl restart cyclome-worker.service
/usr/bin/systemctl reload nginx.service
/usr/bin/systemctl is-active cyclome-flask.service
/usr/bin/systemctl is-active cyclome-express.service
/usr/bin/systemctl is-active cyclome-worker.service
/usr/sbin/nginx -t
```

The macOS backup command for retrieving the remote sudo password is:

```zsh
security find-generic-password -a chowdhurylab01 -s openclaw-remote-sudo -w
```

Do not commit that password or place it in GitHub secrets.

## Runner Registration

The production deploy workflow will not run until the Cyclome repository has a self-hosted runner registered with this label:

```text
cyclome-workstation
```

Create a repository runner token from GitHub:

```bash
gh api -X POST repos/ctph/Cyclome-Database/actions/runners/registration-token --jq .token
```

This requires repository admin or self-hosted runner permission. A normal write token is not enough.

On the workstation, install the runner outside the production app directory:

```bash
mkdir -p /home/chowdhurylab01/work/Cyclome-Database-runner/actions-runner
cd /home/chowdhurylab01/work/Cyclome-Database-runner/actions-runner

curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.334.0/actions-runner-linux-x64-2.334.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

./config.sh \
  --url https://github.com/ctph/Cyclome-Database \
  --token RUNNER_TOKEN_FROM_GITHUB \
  --name cyclome-workstation \
  --labels cyclome-workstation \
  --unattended

sudo ./svc.sh install chowdhurylab01
sudo ./svc.sh start
```

Verify:

```bash
sudo systemctl status 'actions.runner.ctph-Cyclome-Database.cyclome-workstation.service' --no-pager
```

## Limited Sudo

The deploy workflow uses `sudo -n`, so the runner must be able to restart Cyclome services without an interactive password.

First make the frontend web root writable by the deploy user:

```bash
sudo chown -R chowdhurylab01:www-data /var/www/cyclome930.structf.studio
sudo find /var/www/cyclome930.structf.studio -type d -exec chmod 775 {} \;
sudo find /var/www/cyclome930.structf.studio -type f -exec chmod 664 {} \;
```

Then use a least-privilege sudoers file instead of full passwordless sudo:

```bash
sudo visudo -f /etc/sudoers.d/91-cyclome-ci
```

Recommended contents:

```text
Cmnd_Alias CYCLOME_SYSTEMCTL = /usr/bin/systemctl restart cyclome-flask.service, /usr/bin/systemctl restart cyclome-express.service, /usr/bin/systemctl restart cyclome-worker.service, /usr/bin/systemctl reload nginx.service, /usr/bin/systemctl is-active cyclome-flask.service, /usr/bin/systemctl is-active cyclome-express.service, /usr/bin/systemctl is-active cyclome-worker.service
Cmnd_Alias CYCLOME_NGINX = /usr/sbin/nginx -t
chowdhurylab01 ALL=(root) NOPASSWD: CYCLOME_SYSTEMCTL, CYCLOME_NGINX
```

Verify:

```bash
sudo -n systemctl is-active cyclome-flask.service
sudo -n nginx -t
```

## Manual Verification

After deployment:

```bash
curl -fsS https://cyclome930.structf.studio/api/health
curl -fsS https://cyclome930.structf.studio/api/similarity/cyclic-sequence/health
curl -fsS https://cyclome930.structf.studio/api/similarity/criticl/health
curl -fsS https://cyclome930.structf.studio/api/similarity/stop2melt/health
```
