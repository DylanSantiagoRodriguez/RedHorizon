#!/usr/bin/env bash
# On gateway only, after private panel mTLS smoke passes. Graceful Nginx reload.
set -euo pipefail
input="${1:?directory with rendered nginx-ops.conf and deployment files}"
[ "$(id -u)" = 0 ]
config=/etc/nginx/conf.d/redhorizon.conf
[ -f "$config" ]
[ ! -e /etc/nginx/conf.d/00-redhorizon-observability.conf ]
backup="$config.before-observability.$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$config" "$backup"
python3 "$input/gateway-config.py" "$config" "$input/nginx-candidate.conf"
install -m 0644 "$input/nginx-ops.conf" /etc/nginx/redhorizon-ops.inc
install -m 0644 "$input/nginx-telemetry-http.conf" /etc/nginx/conf.d/00-redhorizon-observability.conf
install -m 0644 "$input/nginx-candidate.conf" "$config"
if ! nginx -t; then
  cp -p "$backup" "$config"
  rm /etc/nginx/conf.d/00-redhorizon-observability.conf /etc/nginx/redhorizon-ops.inc
  exit 1
fi
# Copy only the public certificate for expiry monitoring; never its private key.
install -m 0644 /etc/letsencrypt/live/redhorizon.lat/fullchain.pem /etc/redhorizon-observer/public.crt
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/redhorizon-observer <<'HOOK'
#!/bin/sh
set -eu
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/redhorizon.lat ]; then
  install -m 0644 "$RENEWED_LINEAGE/fullchain.pem" /etc/redhorizon-observer/public.crt
fi
HOOK
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/redhorizon-observer
if ! systemctl reload nginx; then
  cp -p "$backup" "$config"
  rm /etc/nginx/conf.d/00-redhorizon-observability.conf /etc/nginx/redhorizon-ops.inc
  systemctl reload nginx
  exit 1
fi
printf 'Gateway reloaded. Previous configuration retained at %s\n' "$backup"
