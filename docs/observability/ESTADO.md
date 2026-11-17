# Observabilidad — diseño inicial y estado real

Fecha: 17/11/2026. **Trabajo incompleto; no desplegado.**

## Diseño previsto

- `rh-observability`: Prometheus para métricas, colector/consumidor de eventos y panel administrativo. Evaluar Grafana para gráficos y una vista propia para topología. Acceso autenticado del lado servidor, con roles lector/administrador y MFA.
- `rh-events`: Kafka KRaft con broker único, mTLS y ACL por identidad/topic/grupo. Sin alta disponibilidad. Separarlo evita que la JVM y el almacenamiento de eventos compitan con la simulación y las consultas del panel.
- Métricas consultadas cada 5 segundos; métricas AWS con su intervalo y demora reales. Eventos operativos por Kafka; nunca cada input ni snapshot.
- Red privada, nuevos grupos específicos, exporters y broker sin entrada pública. No alterar la entrada del juego hasta completar pruebas y preparar rollback.
- Dimensionamiento, costos y cuotas pendientes de verificar; no se ha aprobado presupuesto para esta ampliación.

## Implementación realizada

`server/observability/events.js` proporciona un esquema inicial con lista cerrada de fuentes, tipos y campos, UUID por evento, timestamp y versión. Descarta campos adicionales, no copia tokens ni códigos públicos de sala, y normaliza motivos de error a valores permitidos.

La cola tiene capacidad y lotes acotados, un único envío en vuelo, señal de cancelación y contadores de descarte/entrega. Si un transporte no respeta la cancelación, queda como máximo un lote en vuelo; la publicación síncrona continúa y la cola pendiente sigue acotada. El transporte Kafka deberá respetar abort/timeouts y aplicar su política limitada de reintentos.

No se ha instrumentado todavía el juego ni se ha conectado esta cola a Kafka. No hay URL administrativa nueva.

## Validación realizada

Tres pruebas aprobadas: exclusión de campos sensibles/orígenes inválidos, presión de cola con destino caído y cancelación de transporte lento. ESLint aprobado para ambos archivos. No son pruebas de integración con Kafka, autenticación web ni AWS.

## Acceso observado

- `rh-cluster-operator` asume correctamente el rol operativo.
- `servicequotas:GetServiceQuota` está denegado para ese rol.
- Las consultas con la sesión AWS administrativa disponible responden que la sesión venció y requieren `aws login`.
- Docker local responde, versión 29.4.0.
- No se crearon recursos, se ampliaron permisos, reiniciaron servidores ni alteraron partidas.

## Trabajo restante

1. Completar inspección de cuota, precios, proveedor OIDC/MFA y presupuesto.
2. Implementar instrumentación y exporters autenticados, almacenamiento temporal y catálogo de métricas.
3. Implementar Kafka real, certificados, ACL, topics, cuotas, retención, consumidor, deduplicación y lag.
4. Implementar panel, autenticación/autorización y vistas de datos reales con frescura explícita.
5. Completar IaC, configuración reproducible, empaquetado y rollback.
6. Probar localmente TLS, permisos, flujos reales, pérdida de broker y ausencia de impacto en el juego.
7. Presentar estimación concreta y solicitar aprobación económica antes de provisionar.
8. Desplegar y validar extremo a extremo después de esa aprobación.

## Documentación técnica consultada

- [Seguridad y autorización de Kafka](https://kafka.apache.org/44/security/security-model/).
- [TLS y autenticación de Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/https/).
- [Retención y almacenamiento de Prometheus](https://prometheus.io/docs/prometheus/latest/storage/).
