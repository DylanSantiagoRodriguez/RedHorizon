#!/usr/bin/env bash
# Local-on-host setup. Staging only: does not start services or change primary Caddy.
set -euo pipefail
export NEEDRESTART_MODE=l
role="${1:?gateway, game or coordinator required}"
case "$role" in gateway|game|coordinator) ;; *) exit 2;; esac
[ "$(id -u)" = 0 ]
base="$(cd "$(dirname "$0")/../.." && pwd)"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl xz-utils unattended-upgrades
install -d -m 0755 /etc/needrestart/conf.d
printf '\044nrconf{restart} = "l";\n' >/etc/needrestart/conf.d/99-redhorizon.conf
printf 'Unattended-Upgrade::Automatic-Reboot "false";\n' >/etc/apt/apt.conf.d/99-redhorizon-no-reboot
if [ "$role" = gateway ]; then
  # Use on NEW gateway only; installing nginx can start it on port 80.
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot
  install -m 0644 "$base/deploy/cluster/nginx.logrotate" /etc/logrotate.d/nginx
  install -d /etc/systemd/system/logrotate.timer.d
  printf '[Timer]\nOnCalendar=\nOnCalendar=hourly\n' >/etc/systemd/system/logrotate.timer.d/redhorizon.conf
  systemctl daemon-reload
  systemctl restart logrotate.timer
fi
if [ "$role" = coordinator ]; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server
  install -d -m 0750 -o redis -g redis /var/lib/redis
  cat >/etc/redis/redis.conf <<'REDIS'
bind 127.0.0.1
protected-mode yes
port 6379
supervised systemd
daemonize no
dir /var/lib/redis
appendonly yes
appendfsync everysec
maxmemory 128mb
maxmemory-policy noeviction
logfile ""
REDIS
  systemctl restart redis-server
fi
id redhorizon-cluster >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin redhorizon-cluster
install -d -m 0755 /srv/redhorizon-cluster/releases
install -d -m 0750 -o root -g redhorizon-cluster /etc/redhorizon-cluster /etc/redhorizon-cluster/tls
install -d -m 0750 -o root -g redhorizon-cluster /var/lib/redhorizon-cluster
install -m 0644 "$base/deploy/cluster/redhorizon-cluster.service" /etc/systemd/system/
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=100M\nMaxRetentionSec=7day\n' >/etc/systemd/journald.conf.d/redhorizon-cluster.conf
systemctl restart systemd-journald
if [ "$role" = game ]; then
  install -d /etc/systemd/system/redhorizon-cluster.service.d
  printf '[Service]\nMemoryMax=1200M\n' >/etc/systemd/system/redhorizon-cluster.service.d/memory.conf
fi
systemctl daemon-reload
# Explicit activation occurs only after artifact, identity and TLS config installation.
