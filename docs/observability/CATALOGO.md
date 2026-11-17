# Catálogo de métricas, eventos y permisos

Todo lo descrito aquí corresponde al código preparado; consultar [estado de despliegue](ESTADO.md) antes de atribuirlo al clúster AWS.

## Métricas

| Familia | Origen / VM | Unidad y significado |
|---|---|---|
| `rh_host_cpu_*_ticks` | Agente, siete VM | Contadores `/proc/stat`; CPU se calcula con diferencias de un minuto, sin doble contar guest. |
| `rh_host_memory_*_bytes` | Agente | MemTotal/MemAvailable Linux; bytes. |
| `rh_host_disk_*_bytes` | Agente | Tamaño y espacio disponible del filesystem raíz; bytes. Los datos nuevos están en ese EBS. |
| `rh_host_network_*_bytes_total` | Agente | Interfaz principal eth/ens/enp; excluye loopback y bridges Docker. No equivale a bytes facturados. |
| `rh_service_up`, `rh_service_restarts_total` | Agente/systemd | Estado y reinicios automáticos de la unidad principal configurada. No es disponibilidad funcional del juego ni todos los procesos de la VM. |
| `rh_host_sample_timestamp_seconds`, `rh_application_report_timestamp_seconds` | Agente | Frescura de host/aplicación por separado. Métricas de aplicación dejan de exponerse tras 15 s sin reporte. |
| `rh_application_build_info`, `rh_service_build_info` | Runtime / agente nuevo | Revisión de artefacto. Etiqueta constante `revision`, no un ID de jugador. |
| `rh_game_rooms`, `players`, `capacity`, `draining` | Tres workers | Salas, jugadores, techo configurado de salas y drenaje (1/0). No aumenta capacidad automáticamente. |
| `rh_game_step_mean_ms`, `step_max_ms`, `event_loop_p99_ms` | Workers | Ventana del muestreo de estado; duración de simulación y retraso del proceso. |
| `rh_game_messages`, `rejected`, `bytes_in`, `bytes_out` | Workers | Contadores del backend; mensajes y bytes de payload, no red EC2. |
| `rh_gateway_connections`, `worker_connections` | Gateway | Túneles totales y por worker permitido. |
| `rh_gateway_logical_*_bytes_total` | Gateway | Payload de mensajes WebSocket descomprimidos, separados por worker; no incluye handshake HTTP ni overhead TLS. |
| `rh_gateway_transport_*_bytes_total` + `transport_open_*_bytes` | Gateway | Bytes del socket en el tramo **Nginx ↔ Node gateway**, cerrados + abiertos. Incluye framing/compresión negociada; no mide el cifrado TLS externo ni tráfico EC2 completo. |
| `rh_gateway_messages_*_total` | Gateway | Frecuencia de mensajes de aplicación. |
| `rh_websocket_transport_rtt_ms_*` | Gateway | Histograma ping/pong WebSocket al cliente, cada 10 s; p50/p95/p99 sobre 5 min. No es latencia de simulación ni ping de red puro. |
| `rh_coordinator_request_bytes_total`, `response_bytes_total` | Gateway/workers | Bytes JSON del cliente API hacia/desde coordinador; sin overhead TLS. |
| `rh_coordinator_requests_total` | Cliente API / coordinador | Contador de solicitudes; distinguir nodo origen y etiquetas para no sumar ambos lados como transacciones distintas. |
| `rh_nginx_responses_total`, `rate_rejected_total` | Gateway | Respuestas por clase HTTP/categoría fija; rechazos de limit_req. WebSocket se registra al cerrar. |
| `rh_nginx_http_sent_bytes_total` | Gateway | `$bytes_sent` de Nginx; respuesta/framing visto por Nginx, sin equivalencia con EC2/factura. |
| `rh_nginx_request_duration_ms_*` | Gateway | Tiempo de solicitud HTTP completo; excluye conexiones WebSocket largas. |
| `rh_nginx_log_*` | Gateway | Frescura, errores y bytes descartados del lector de log; lectura máxima 256 KiB/5 s. |
| `rh_tls_failures_total`, `rh_handshake_rejected_total` | Aplicaciones | Rechazos de TLS o upgrade observados por Node. |
| `rh_certificate_expires_seconds`, `rh_certificate_named_expires_seconds` | Agente | Vencimiento del certificado del agente y certificados públicos configurados. Incluye juego y, tras activar gateway, copia pública renovable de HTTPS. |
| `rh_events_pending`, `delivered_total`, `dropped_total` | Agentes | Cola/envíos/descartes de eventos hacia Kafka. |
| `rh_application_telemetry_dropped_total`, `rh_collector_errors_total` | Aplicación | Pérdidas/fallos del primer salto al socket local. No se confunden con pérdidas del agente. |
| `rh_kafka_produced_bytes_total`, `rh_kafka_consumed_bytes_total` | Agentes / panel | Bytes JSON de valores de eventos confirmados/procesados; excluye clave, protocolo Kafka y TLS. |
| `rh_kafka_consumer_lag`, `consumer_up` | Panel | Diferencia entre offsets finales y consumidos/confirmados; chequeo cada 10 s. Frescura del chequeo separada. |
| `rh_events_consumed_total`, `duplicates_total`, `invalid_total` | Panel | Inserciones, duplicados y mensajes inválidos. |
| `rh_panel_login_rejected_total`, `rh_panel_tls_failures_total` | Panel | Fallos de acceso o TLS; sin nombre de usuario, IP ni credenciales como etiquetas. |
| AWS CPUUtilization, NetworkIn/Out, CPUCreditBalance, CPUSurplusCreditBalance | CloudWatch | Periodo de 300 s, timestamp AWS explícito. Créditos solo T3. Valores ausentes permanecen ausentes, no cero. |

No se muestrean paquetes completos ni contenido privado. Los contadores son desde arranque; usar `rate` para reinicios. Los gráficos de transporte suman sockets abiertos/cerrados y usan derivada acotada: alrededor de un reinicio o scraping intermedio pueden perder precisión; no son contabilidad de red.

Las métricas de proceso del laboratorio comparten el proceso Node de la prueba; **no** deben interpretarse como consumo individual de una VM. Las métricas AWS y del host no son intercambiables.

## Eventos y topics

Envelope: `schemaVersion: 1`, `eventId` UUID, `timestamp` en milisegundos, `source` en lista cerrada, `type`, `data` filtrado. Clave de partición: UUID interno de sala cuando existe; en los demás casos ID fijo del servidor. Un productor por agente y una partición por topic. No hay orden total entre topics o servidores; reloj y timestamp no garantizan causalidad global.

| Tipo | Campos admitidos | Familia del topic |
|---|---|---|
| `room.created` | UUID interno de sala | lifecycle |
| `room.closed` | UUID interno, duración en segundos | lifecycle |
| `connection.opened` | Ninguno | lifecycle |
| `connection.closed` | Motivo enumerado | lifecycle |
| `connection.reconnected` | Ninguno | lifecycle |
| `security.rejected` | Motivo enumerado | security |
| `deployment.changed` | Revisión Git de 40 caracteres | deployment |

Para cada fuente `rh-gateway`, `rh-game-01`, `rh-game-02`, `rh-game-03`, `rh-coordinator`, `rh-observability`, `rh-events` se crean:

- `rh.<fuente>.lifecycle.v1`
- `rh.<fuente>.security.v1`
- `rh.<fuente>.deployment.v1`

Total: **21 topics**, una partición por topic, replicación 1, min.insync.replicas 1, sin creación automática. Las tres familias separan finalidad; la separación por fuente permite que una ACL impida escribir eventos como otra VM.

## Permisos Kafka y garantías

| Identidad X.509 | Acceso |
|---|---|
| Cada servidor `CN=rh-*` | WRITE/DESCRIBE únicamente sus tres topics, IDEMPOTENT_WRITE de clúster. Sin lectura de otros topics. |
| `CN=rh-panel-consumer` | READ/DESCRIBE de los 21 topics; READ del grupo `rh-panel-v1`. Sin producción ni administración. |
| `CN=rh-kafka-admin` | Bootstrap/recuperación; clave conservada localmente y usada mediante acceso privado controlado. No permanece en workers/panel. |
| `CN=rh-events` | Identidad del broker/controlador, superusuario de su propio broker. |

Productores KafkaJS idempotentes, un envío en vuelo, dos reintentos de cliente y timeout de solicitud de 2 s. La cola Node utiliza cancelación; KafkaJS termina según sus timeouts internos y puede superar el timeout externo de un lote. Siempre se conserva como máximo un lote en vuelo, sin bloqueos síncronos de simulación ni reintento ilimitado de eventos.

Cada cola: 256 eventos pendientes y lotes de 32. Se descarta bajo presión o fallo y se cuentan las pérdidas. Es telemetría best effort, **no un registro de auditoría durable garantizado**. La idempotencia del productor no equivale a exactamente-una-vez extremo a extremo.

El consumidor deduplica por eventId en SQLite. Comprueba fuente/tipo/campos/topic; los inválidos se cuentan y se omiten, sin registrar cuerpos ni reenviarlos indefinidamente. Tras un fallo entre insert y commit del offset, el reenvío se reconoce como duplicado.

Cuotas por identidad: productor 256 KiB/s y request_percentage 5; consumidor 1 MiB/s y request_percentage 10. Aplicadas y verificadas en el broker local; pendientes en AWS. Mensaje Kafka máximo 64 KiB; consumidor admite eventos individuales de hasta 16 KiB; entradas al agente hasta 128 KiB por lote.

## Retención y almacenamiento

- Kafka: 24 h **o** 256 MiB por partición; segmentos 16 MiB, limpieza periódica. Aproximadamente 5,25 GiB nominales de topics de aplicación, más segmentos activos, índices y topics internos; no es un límite exacto del filesystem.
- Prometheus: 7 días **o** 10 GB de bloques. WAL/head/cache y compactaciones añaden uso; se reservan 30 GiB de EBS y se vigila espacio libre.
- SQLite: 7 días y máximo 50.000 filas después de limpieza cada minuto; máximo 200 eventos por respuesta, WAL/checkpoint acotado por poda. La base puede superar temporalmente el límite de filas entre limpiezas.
- journald nuevo: 100 MB, 7 días. Docker: 3 archivos de 10 MB por contenedor. Log HTTP dedicado: 3 rotaciones de 10 MB, comprobadas por logrotate; puede superar tamaño entre ejecuciones.
- Las métricas del panel y agentes nunca se etiquetan por IP, token, jugador o código de sala. Los UUID de sala solo aparecen en eventos filtrados.

No hay copias externas automáticas ni tolerancia a pérdida del broker/disco. Eventos descartados o fuera de retención no se reconstruyen. Un host sin observabilidad debe seguir atendiendo partidas: validado localmente; pendiente comprobarlo en las EC2 nuevas.
