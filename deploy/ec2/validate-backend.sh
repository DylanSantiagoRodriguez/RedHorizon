#!/usr/bin/env bash
set -euo pipefail
manifest="$1"
backend_port="${BACKEND_PORT:-8787}"
for attempt in {1..30}; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$backend_port/health" | node --input-type=module -e '
    import fs from "node:fs";
    const expected = JSON.parse(fs.readFileSync(process.argv[1])).commit;
    let data = "";
    for await (const chunk of process.stdin) data += chunk;
    try { const health = JSON.parse(data); process.exit(health.ok && health.buildId === expected ? 0 : 1); } catch { process.exit(1); }
  ' "$manifest"; then exit 0; fi
  sleep 1
done
echo 'Backend release health validation failed' >&2
exit 1
