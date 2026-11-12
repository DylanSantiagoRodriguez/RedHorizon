#!/usr/bin/env bash
# Validate the exact main revision locally; EC2 validates Node and activates it.
set -euo pipefail
cd "$(dirname "$0")/.."
deployment_host="${DEPLOY_HOST:-ubuntu@77.113.171.135}"
deployment_key="${DEPLOY_KEY:-../llaveredhorizon/redhorizon.pem}"
ssh_options=(-i "$deployment_key" -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
if [ -n "$(git status --porcelain)" ]; then echo 'Commit or stash local changes before deploying.' >&2; exit 1; fi
git fetch --quiet origin main
revision="$(git rev-parse HEAD)"
if [ "$revision" != "$(git rev-parse origin/main)" ]; then echo 'HEAD must match origin/main.' >&2; exit 1; fi
validation_dir="$(mktemp -d)"
preview_pid=''
cleanup() { if [ -n "$preview_pid" ]; then kill "$preview_pid" 2>/dev/null || true; wait "$preview_pid" 2>/dev/null || true; fi; rm -rf -- "$validation_dir"; }
trap cleanup EXIT
npm ci --no-audit --no-fund
npm run check
npm run test:integration
npx --no-install playwright install chromium
npx --no-install playwright test --config deploy/ec2/playwright.config.mjs
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4189 --strictPort > "$validation_dir/preview.log" 2>&1 &
preview_pid=$!
SMOKE_URL=http://127.0.0.1:4189 node scripts/smoke-production.mjs
kill "$preview_pid"; wait "$preview_pid" 2>/dev/null || true; preview_pid=''
if [ -n "$(git status --porcelain)" ] || [ "$revision" != "$(git rev-parse HEAD)" ]; then echo 'Checkout changed during validation.' >&2; exit 1; fi
node --input-type=module - "$validation_dir/proof.json" "$revision" <<'JS'
import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], JSON.stringify({ version: 1, commit: process.argv[3], validatedAt: Date.now(), checks: ['check', 'integration', 'online', 'production-smoke'] }));
JS
remote_report="$(ssh "${ssh_options[@]}" "$deployment_host" 'mktemp /tmp/redhorizon-proof.XXXXXXXX')"
[[ "$remote_report" =~ ^/tmp/redhorizon-proof\.[a-zA-Z0-9]+$ ]]
scp "${ssh_options[@]}" "$validation_dir/proof.json" "$deployment_host:$remote_report"
ssh "${ssh_options[@]}" "$deployment_host" "sudo install -d -o root -g root -m 0755 /var/lib/redhorizon-validation && sudo install -o root -g root -m 0644 '$remote_report' '/var/lib/redhorizon-validation/$revision.json' && rm -f '$remote_report' && sudo systemctl start redhorizon-deploy.service && sudo journalctl -u redhorizon-deploy.service -n 20 --no-pager"
# Check the actual destination externally, retaining normal certificate validation.
curl --fail --silent --show-error --max-time 20 --resolve "redhorizon.lat:443:${DEPLOY_VERIFY_IP:-${deployment_host#*@}}" https://redhorizon.lat/deployment.json |
  node -e 'let body=""; process.stdin.on("data",c=>body+=c); process.stdin.on("end",()=>{ const data=JSON.parse(body); if(data.commit!==process.argv[1]) process.exit(1); console.log(JSON.stringify(data)); });' "$revision"
