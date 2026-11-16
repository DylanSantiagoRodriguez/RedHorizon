#!/usr/bin/env bash
# Run ON ONE HOST after drain has completed; TLS/config installation is separate.
set -euo pipefail
archive="${1:?archive path}"; expected="${2:?sha256}"; release="${3:?release id}"
[[ "$expected" =~ ^[a-f0-9]{64}$ && "$release" =~ ^[a-zA-Z0-9._-]+$ ]] || exit 2
[ "$(id -u)" = 0 ]
printf '%s  %s\n' "$expected" "$archive" | sha256sum -c -
base=/srv/redhorizon-cluster
[ ! -e "$base/releases/$release" ]
# A live worker must be drained and have zero rooms before activation.
if systemctl is-active --quiet redhorizon-cluster; then
  echo 'Stop this service only after authenticated health confirms drained and zero rooms.' >&2
  exit 1
fi
install -d -m 0755 "$base/releases/$release"
# Accept only archives built locally with the expected top-level directories.
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then exit 1; fi
tar --no-same-owner -xzf "$archive" -C "$base/releases/$release"
[ -x "$base/releases/$release/node/bin/node" ]
[ -f "$base/releases/$release/runtime/server/cluster/main.js" ]
previous="$(readlink -f "$base/current" || true)"
ln -s "$base/releases/$release" "$base/next"
mv -Tf "$base/next" "$base/current"
if ! systemctl start redhorizon-cluster; then
  if [ -n "$previous" ]; then ln -s "$previous" "$base/rollback"; mv -Tf "$base/rollback" "$base/current"; systemctl start redhorizon-cluster; fi
  exit 1
fi
echo 'Service started; verify mTLS health and room smoke before reopening allocations.'
