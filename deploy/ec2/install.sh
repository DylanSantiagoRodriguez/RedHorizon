#!/usr/bin/env bash
# Run as root from a trusted copy of deploy/ec2, after installing Caddy, nodejs and npm.
set -euo pipefail
cd "$(dirname "$0")"
test "$(id -u)" -eq 0
command -v caddy >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
command -v git >/dev/null
bash -n deploy-main.sh
bash -n validate-backend.sh
caddy validate --config "$PWD/Caddyfile" --adapter caddyfile

systemctl stop redhorizon-deploy.timer 2>/dev/null || true
systemctl stop redhorizon-deploy.service 2>/dev/null || true
if ! id redhorizon-deploy >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/redhorizon-deploy --shell /usr/sbin/nologin redhorizon-deploy
fi
install -d -m 755 /usr/local/lib/redhorizon /srv/redhorizon/releases
install -d -o redhorizon-deploy -g redhorizon-deploy -m 750 /var/lib/redhorizon-deploy /var/cache/redhorizon-deploy
chown -R redhorizon-deploy:redhorizon-deploy /srv/redhorizon
install -m 755 deploy-main.sh validate-backend.sh /usr/local/lib/redhorizon/
install -m 644 playwright.config.mjs /usr/local/lib/redhorizon/
if ! id redhorizon-backend >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin redhorizon-backend
fi
install -d -m 755 /etc/redhorizon
if [ ! -f /etc/redhorizon/backend.env ]; then
  install -m 640 -o root -g redhorizon-backend backend.env.example /etc/redhorizon/backend.env
fi
install -m 644 redhorizon-backend.service redhorizon-backend-restart.service redhorizon-backend-restart.path /etc/systemd/system/
touch /srv/redhorizon/backend-restart
chown redhorizon-deploy:redhorizon-deploy /srv/redhorizon/backend-restart
install -m 644 redhorizon-deploy.service redhorizon-deploy.timer /etc/systemd/system/
cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-automation-$(date -u +%Y%m%dT%H%M%SZ)"
install -m 644 Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/redhorizon-deploy.service /etc/systemd/system/redhorizon-deploy.timer /etc/systemd/system/redhorizon-backend.service /etc/systemd/system/redhorizon-backend-restart.service /etc/systemd/system/redhorizon-backend-restart.path
systemctl enable --now redhorizon-backend.service
systemctl enable --now redhorizon-backend-restart.path
systemctl enable --now redhorizon-deploy.timer
systemctl start redhorizon-deploy.service
