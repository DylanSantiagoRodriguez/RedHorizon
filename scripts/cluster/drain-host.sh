#!/usr/bin/env bash
# Execute on a worker through Session Manager. Does not force-kill active rooms.
set -euo pipefail
[ "$(id -u)" = 0 ]
install -m 0640 -o root -g redhorizon-cluster /dev/null /var/lib/redhorizon-cluster/drain
systemctl kill --kill-who=main --signal=SIGUSR1 redhorizon-cluster
limit="${DRAIN_TIMEOUT_SECONDS:-7500}"
[[ "$limit" =~ ^[0-9]+$ ]] || exit 2
end=$((SECONDS+limit))
while [ "$SECONDS" -lt "$end" ]; do
  if python3 - <<'PY'
import json,time,sys
try:
 s=json.load(open('/run/redhorizon-cluster/status.json'))
 sys.exit(0 if s['draining'] and s['rooms']==0 and time.time()*1000-s['recordedAt'] < 15000 else 1)
except (OSError,ValueError,KeyError): sys.exit(1)
PY
  then
    systemctl stop redhorizon-cluster
    echo 'Worker drained and stopped. Drain marker retained until explicit reopening.'
    exit 0
  fi
  sleep 5
done
echo 'Drain deadline reached; active games were not forcibly stopped.' >&2
exit 1
