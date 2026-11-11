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
caddy validate --config "$PWD/Caddyfile" --adapter caddyfile

systemctl stop redhorizon-deploy.timer 2>/dev/null || true
systemctl stop redhorizon-deploy.service 2>/dev/null || true
if ! id redhorizon-deploy >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/redhorizon-deploy --shell /usr/sbin/nologin redhorizon-deploy
fi
install -d -m 755 /usr/local/lib/redhorizon /srv/redhorizon/releases
install -d -o redhorizon-deploy -g redhorizon-deploy -m 750 /var/lib/redhorizon-deploy /var/cache/redhorizon-deploy
chown -R redhorizon-deploy:redhorizon-deploy /srv/redhorizon
install -m 755 deploy-main.sh /usr/local/lib/redhorizon/deploy-main.sh
install -m 644 redhorizon-deploy.service redhorizon-deploy.timer /etc/systemd/system/
cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-automation-$(date -u +%Y%m%dT%H%M%SZ)"
install -m 644 Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/redhorizon-deploy.service /etc/systemd/system/redhorizon-deploy.timer
systemctl enable --now redhorizon-deploy.timer
systemctl start redhorizon-deploy.service
