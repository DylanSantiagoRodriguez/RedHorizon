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
release_path=''
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
    printf '%s\n' "$previous" > "$site/backend-restart"
    if [ -f "$previous/runtime/release.json" ]; then
      /usr/local/lib/redhorizon/validate-backend.sh "$previous/runtime/release.json" || echo 'Backend rollback health check failed' >&2
    fi
    echo "Deployment failed; restored $previous" >&2
  fi
  if "$activated" && [ -z "$previous" ]; then
    rm -f -- "$site/current"
    printf 'no-release\n' > "$site/backend-restart"
  fi
  [ -z "$staging" ] || rm -rf -- "$staging"
  if [ -n "$release_path" ] && [ "$(readlink "$site/current" || true)" != "$release_path" ]; then
    rm -rf -- "$release_path"
  fi
  rm -f -- "$site/activate-$$"
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
if [ -f "$site/current/deployment.json" ] && [ -f "$site/current/runtime/release.json" ] && [ -f "$site/current/runtime/server/main.js" ] && node -e '
  const fs = require("node:fs");
  const published = JSON.parse(fs.readFileSync(process.argv[1]));
  const runtime = JSON.parse(fs.readFileSync(process.argv[3]));
  process.exit(published.commit === process.argv[2] && runtime.commit === process.argv[2] ? 0 : 1);
' "$site/current/deployment.json" "$revision" "$site/current/runtime/release.json"; then
  echo "Already deployed: $revision"
  exit 0
fi

echo "Checking main at $revision"
# This disposable checkout belongs only to the deployment service.
git checkout --quiet --force --detach "$revision"
npm ci --no-audit --no-fund
npm run check
npm run test:integration
test -s dist/index.html
npx --no-install playwright install chromium
npx --no-install playwright test --config /usr/local/lib/redhorizon/playwright.config.mjs
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
mkdir "$staging/runtime"
cp -a server src package.json package-lock.json "$staging/runtime/"
cp "$staging/deployment.json" "$staging/runtime/release.json"
(cd "$staging/runtime" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
# Validate the actual packaged backend on a separate loopback port before activation.
PORT=8789 WS_ORIGINS=https://redhorizon.lat NODE_ENV=production node "$staging/runtime/server/main.js" > "$state/backend-preview.log" 2>&1 &
preview_pid=$!
BACKEND_PORT=8789 /usr/local/lib/redhorizon/validate-backend.sh "$staging/runtime/release.json"
kill "$preview_pid"
wait "$preview_pid" 2>/dev/null || true
preview_pid=''
chmod -R a+rX "$staging"
mv "$staging" "$site/releases/$release"
release_path="$site/releases/$release"
staging=''
previous="$(readlink "$site/current" || true)"
ln -s "$site/releases/$release" "$site/activate-$$"
activated=true
mv -Tf "$site/activate-$$" "$site/current"
printf '%s\n' "$revision" > "$site/backend-restart"
/usr/local/lib/redhorizon/validate-backend.sh "$site/current/runtime/release.json"

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
