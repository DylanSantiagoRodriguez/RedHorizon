#!/usr/bin/env bash
# Run after npm run check and the isolated integration test. Build off game hosts.
set -euo pipefail
cd "$(dirname "$0")/../.."
out="${1:?absolute output directory}"
[[ "$out" = /* ]] || exit 2
[ -z "$(git status --porcelain)" ] || { echo 'Commit the reviewed changes before packaging.' >&2; exit 1; }
mkdir -p "$out"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/runtime" "$stage/node"
cp -R server src web package.json package-lock.json "$stage/runtime/"
(cd "$stage/runtime" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
cp -R deploy "$stage/"
mkdir -p "$stage/runtime/scripts/observability"
cp scripts/observability/bootstrap-kafka.mjs "$stage/runtime/scripts/observability/"
revision="$(git rev-parse HEAD)"
printf '{"commit":"%s"}\n' "$revision" > "$stage/runtime/release.json"
archive=node-v22.23.5-linux-x64.tar.xz
curl --fail --silent --show-error --location "https://nodejs.org/dist/v22.23.5/$archive" -o "$stage/$archive"
printf '%s  %s\n' cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8 "$stage/$archive" | shasum -a 256 -c -
tar -xJf "$stage/$archive" -C "$stage/node" --strip-components=1
rm "$stage/$archive"
COPYFILE_DISABLE=1 tar -czf "$out/redhorizon-observability-$revision.tar.gz" -C "$stage" runtime node deploy
shasum -a 256 "$out/redhorizon-observability-$revision.tar.gz" > "$out/redhorizon-observability-$revision.tar.gz.sha256"
printf 'Artifact prepared for revision %s\n' "$revision"
