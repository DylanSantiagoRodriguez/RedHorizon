#!/usr/bin/env bash
# Runs on one host after verified upload. Never restarts the game or changes Nginx.
set -euo pipefail
role="${1:?agent|observability|events}"; archive="${2:?archive}"; sha="${3:?sha256}"; revision="${4:?commit}"; input="${5:?staging directory}"
[[ "$role" =~ ^(agent|observability|events)$ && "$sha" =~ ^[a-f0-9]{64}$ && "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 2
[ "$(id -u)" = 0 ]
printf '%s  %s\n' "$sha" "$archive" | sha256sum -c -
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then exit 2; fi
base=/srv/redhorizon-observability
[ ! -e "$base/releases/$revision" ] || { echo 'Release already staged; inspect before retry.' >&2; exit 1; }
install -d -m 0755 "$base/releases/$revision"
tar --no-same-owner -xzf "$archive" -C "$base/releases/$revision"
id redhorizon-cluster >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin redhorizon-cluster
install -d -m 0750 -o root -g redhorizon-cluster /etc/redhorizon-observer /etc/redhorizon-observer/tls
name="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$input/agent.json")"
[[ "$name" =~ ^rh-(gateway|game-0[123]|coordinator|observability|events)$ ]] || exit 2
install -m 0640 -o root -g redhorizon-cluster "$input/agent.json" /etc/redhorizon-observer/
install -m 0644 "$input/ca.crt" "$input/$name.crt" /etc/redhorizon-observer/tls/
install -m 0600 -o redhorizon-cluster -g redhorizon-cluster "$input/$name.key" /etc/redhorizon-observer/tls/
units="$base/releases/$revision/deploy/observability"
install -m 0644 "$units/redhorizon-observer.service" /etc/systemd/system/
if [ "$name" = rh-gateway ]; then
  install -d -m 0750 -o root -g redhorizon-cluster /var/log/redhorizon-observer
  [ -f /var/log/redhorizon-observer/nginx.log ] || install -m 0640 -o root -g redhorizon-cluster /dev/null /var/log/redhorizon-observer/nginx.log
  install -m 0644 "$units/nginx-telemetry.logrotate" /etc/logrotate.d/redhorizon-observer
fi
if [ "$role" != agent ]; then
  export NEEDRESTART_MODE=l
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io unattended-upgrades
  install -d -m 0755 /etc/needrestart/conf.d /etc/systemd/journald.conf.d
  printf '\044nrconf{restart} = "l";\n' >/etc/needrestart/conf.d/99-redhorizon.conf
  printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' >/etc/apt/apt.conf.d/20auto-upgrades
  printf 'Unattended-Upgrade::Automatic-Reboot "false";\n' >/etc/apt/apt.conf.d/99-redhorizon-no-reboot
  printf '[Journal]\nSystemMaxUse=100M\nMaxRetentionSec=7day\n' >/etc/systemd/journald.conf.d/redhorizon-observability.conf
  systemctl enable --now docker
fi
if [ "$role" = events ]; then
  install -d -m 0700 -o 1000 -g 1000 /etc/redhorizon-kafka /etc/redhorizon-kafka/tls /var/lib/redhorizon-kafka
  install -m 0644 "$input/server.properties" "$units/start-kafka.sh" /etc/redhorizon-kafka/
  install -m 0644 "$input/ca.crt" /etc/redhorizon-kafka/tls/
  install -m 0400 -o 1000 -g 1000 "$input/rh-events.bundle.pem" /etc/redhorizon-kafka/tls/
  docker pull apache/kafka@sha256:833b867a9585a141da455dc2b57431c65cbccb27f11c91f694444cca9f777e0f
  install -m 0644 "$units/redhorizon-kafka.service" /etc/systemd/system/
fi
if [ "$role" = observability ]; then
  id redhorizon-panel >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin redhorizon-panel
  install -d -m 0750 -o root -g redhorizon-panel /etc/redhorizon-panel /etc/redhorizon-panel/tls
  install -m 0640 -o root -g redhorizon-panel "$input/panel.json" "$input/users.json" /etc/redhorizon-panel/
  install -m 0644 "$input/ca.crt" "$input/rh-observability.crt" "$input/rh-panel-consumer.crt" /etc/redhorizon-panel/tls/
  install -m 0600 -o redhorizon-panel -g redhorizon-panel "$input/rh-observability.key" "$input/rh-panel-consumer.key" /etc/redhorizon-panel/tls/
  install -d -m 0700 -o 65534 -g 65534 /etc/redhorizon-prometheus /etc/redhorizon-prometheus/tls /var/lib/redhorizon-prometheus
  install -m 0644 "$input/prometheus.json" /etc/redhorizon-prometheus/
  install -m 0644 "$input/ca.crt" "$input/rh-observability.crt" /etc/redhorizon-prometheus/tls/
  install -m 0400 -o 65534 -g 65534 "$input/rh-observability.key" /etc/redhorizon-prometheus/tls/
  docker pull prom/prometheus@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06
  install -m 0644 "$units/redhorizon-panel.service" "$units/redhorizon-prometheus.service" /etc/systemd/system/
fi
previous="$(readlink -f "$base/current" || true)"
ln -s "$base/releases/$revision" "$base/next"
mv -Tf "$base/next" "$base/current"
[ -z "$previous" ] || printf '%s\n' "$previous" > "$base/previous"
systemctl daemon-reload
if [ "$role" = events ]; then systemctl enable redhorizon-kafka; systemctl restart redhorizon-kafka; fi
if [ "$role" = observability ]; then systemctl enable redhorizon-prometheus redhorizon-panel; systemctl restart redhorizon-prometheus redhorizon-panel; fi
systemctl enable redhorizon-observer
systemctl restart redhorizon-observer
# Uploaded private materials have now been installed into restricted service directories.
find "$input" -maxdepth 1 -type f \( -name '*.key' -o -name '*.bundle.pem' -o -name 'users.json' \) -delete
systemctl is-active redhorizon-observer
