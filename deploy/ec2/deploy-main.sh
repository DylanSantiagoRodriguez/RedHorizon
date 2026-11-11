#!/usr/bin/env bash
# Installed outside the checkout; runs as redhorizon-deploy, without sudo.
set -Eeuo pipefail
umask 022

state=/var/lib/redhorizon-deploy
site=/srv/redhorizon
repository=https://github.com/DylanSantiagoRodriguez/RedHorizon.git
exec 9>"$state/deploy.lock"
flock -n 9 || exit 0

previous=''
activated=false
staging=''
preview_pid=''
on_failure() {
  local status="$1"
  trap - ERR INT TERM
  if [ -n "$preview_pid" ]; then
    kill "$preview_pid" 2>/dev/null || true
    wait "$preview_pid" 2>/dev/null || true
  fi
  if "$activated" && [ -n "$previous" ]; then
    ln -s "$previous" "$site/rollback-$$"
    mv -Tf "$site/rollback-$$" "$site/current"
    echo "Deployment failed; restored $previous" >&2
  fi
  [ -z "$staging" ] || rm -rf -- "$staging"
  exit "$status"
}
trap 'on_failure $?' ERR
trap 'on_failure 130' INT
trap 'on_failure 143' TERM

if [ ! -d "$state/repo/.git" ]; then
  git clone --depth 1 --branch main "$repository" "$state/repo"
fi
cd "$state/repo"
git fetch --quiet --depth 1 origin +refs/heads/main:refs/remotes/origin/main
revision="$(git rev-parse refs/remotes/origin/main)"
if [ -f "$site/current/deployment.json" ] && node -e '
  const fs = require("node:fs");
  process.exit(JSON.parse(fs.readFileSync(process.argv[1])).commit === process.argv[2] ? 0 : 1);
' "$site/current/deployment.json" "$revision"; then
  echo "Already deployed: $revision"
  exit 0
fi

echo "Checking main at $revision"
# This disposable checkout belongs only to the deployment service.
git checkout --quiet --force --detach "$revision"
npm ci --no-audit --no-fund
npm run check
test -s dist/index.html
npx --no-install playwright install chromium
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort > "$state/preview.log" 2>&1 &
preview_pid=$!
node scripts/smoke-production.mjs
kill "$preview_pid"
wait "$preview_pid" 2>/dev/null || true
preview_pid=''

# Do not publish an obsolete build if main advanced while checks ran.
latest="$(git ls-remote origin refs/heads/main | cut -f1)"
if [ "$latest" != "$revision" ]; then
  echo 'main changed during the build; the next timer run will check the new revision.'
  exit 0
fi

release="$(date -u +%Y%m%dT%H%M%SZ)-$revision"
staging="$(mktemp -d "$site/releases/.build-XXXXXX")"
cp -a dist/. "$staging/"
node -e '
  const fs = require("node:fs");
  fs.writeFileSync(process.argv[1], JSON.stringify({commit: process.argv[2], deployedAt: new Date().toISOString()}) + "\n");
' "$staging/deployment.json" "$revision"
chmod -R a+rX "$staging"
mv "$staging" "$site/releases/$release"
staging=''
previous="$(readlink "$site/current" || true)"
ln -s "$site/releases/$release" "$site/activate-$$"
activated=true
mv -Tf "$site/activate-$$" "$site/current"

curl --fail --silent --show-error --max-time 15 http://127.0.0.1:8080/ -o /dev/null
curl --fail --silent --show-error --max-time 20 https://redhorizon.lat/deployment.json |
  node -e '
    let body = "";
    process.stdin.on("data", chunk => body += chunk);
    process.stdin.on("end", () => {
      if (JSON.parse(body).commit !== process.argv[1]) process.exit(1);
    });
  ' "$revision"
activated=false
echo "Deployed successfully: $revision https://redhorizon.lat"

# Retain five releases, plus the previous target if it falls outside that set.
while IFS= read -r old; do
  [[ "$old" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$ ]] || continue
  candidate="$site/releases/$old"
  if [ "$candidate" != "$previous" ] && [ "$candidate" != "$(readlink "$site/current")" ]; then
    rm -rf -- "$candidate"
  fi
done < <(find "$site/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +6)
