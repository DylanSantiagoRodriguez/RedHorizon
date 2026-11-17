#!/usr/bin/env bash
# Build locally. Deployment hosts only unpack verified artifacts.
set -euo pipefail
cd "$(dirname "$0")/../.."
output="${1:?absolute artifact directory outside source required}"
[[ "$output" = /* ]] || exit 2
mkdir -p "$output"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
npm run check
mkdir -p "$stage/runtime" "$stage/frontend" "$stage/node"
cp -R server src package.json package-lock.json "$stage/runtime/"
(cd "$stage/runtime" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
cp -R dist/. "$stage/frontend/"
node_archive='node-v22.23.5-linux-x64.tar.xz'
node_sha='cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8'
curl --fail --silent --show-error --location "https://nodejs.org/dist/v22.23.5/$node_archive" -o "$stage/$node_archive"
printf '%s  %s\n' "$node_sha" "$stage/$node_archive" | shasum -a 256 -c -
tar -xJf "$stage/$node_archive" -C "$stage/node" --strip-components=1
rm "$stage/$node_archive"
revision="$(git rev-parse HEAD)"
if [ -n "$(git status --porcelain)" ]; then revision="${revision}-worktree"; fi
node --input-type=module - "$stage/runtime/release.json" "$revision" <<'JS'
import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], JSON.stringify({ commit: process.argv[3], builtAt: new Date().toISOString() }));
JS
archive="$output/redhorizon-cluster-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
COPYFILE_DISABLE=1 tar -czf "$archive" -C "$stage" runtime frontend node
shasum -a 256 "$archive" >"$archive.sha256"
printf 'Artifact: %s\n' "$archive"
