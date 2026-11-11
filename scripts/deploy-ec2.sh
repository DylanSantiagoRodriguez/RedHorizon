#!/usr/bin/env bash
# Request the same locally validated deployment used by the automatic timer.
set -euo pipefail
cd "$(dirname "$0")/.."
deployment_host="${DEPLOY_HOST:-ubuntu@3.138.154.61}"
deployment_key="${DEPLOY_KEY:-../llaveredhorizon/redhorizon.pem}"
ssh -i "$deployment_key" -o BatchMode=yes -o ConnectTimeout=15 "$deployment_host" \
  'sudo systemctl start redhorizon-deploy.service && sudo journalctl -u redhorizon-deploy.service -n 25 --no-pager'
curl --fail --silent --show-error --max-time 20 https://redhorizon.lat/deployment.json
