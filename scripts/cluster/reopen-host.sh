#!/usr/bin/env bash
# Only after release verification. New allocations resume after the next heartbeat.
set -euo pipefail
[ "$(id -u)" = 0 ]
# Draining is deliberately sticky per process; reopen requires an empty worker restart.
python3 - <<'PY'
import json,time
s=json.load(open('/run/redhorizon-cluster/status.json'))
assert s['draining'] and s['rooms']==0 and time.time()*1000-s['recordedAt'] < 15000
PY
rm -f /var/lib/redhorizon-cluster/drain
systemctl restart redhorizon-cluster
