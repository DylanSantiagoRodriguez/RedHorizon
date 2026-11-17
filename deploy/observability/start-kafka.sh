#!/usr/bin/env bash
set -euo pipefail
if [ ! -f /var/lib/kafka/data/meta.properties ]; then
  /opt/kafka/bin/kafka-storage.sh format --standalone -t "$(/opt/kafka/bin/kafka-storage.sh random-uuid)" -c /config/server.properties
fi
exec /opt/kafka/bin/kafka-server-start.sh /config/server.properties
