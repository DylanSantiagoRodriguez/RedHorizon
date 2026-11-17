# Resultados reales — 16 de noviembre de 2026, Bogotá

## Código y navegadores

- `npm run check`: 191 pruebas en 38 archivos, lint y build aprobados. Se repitieron después de compresión y precisión de snapshots.
- Redis real + mTLS: reservas atómicas, expiración, replay, reincarnación, certificados incorrectos, destinos arbitrarios, reconexión, drenaje y aislamiento de abuso.
- Playwright clúster: 1 escenario aprobado con tres contextos; incluye reconexión durante caída del coordinador. Suite anterior online: 2 escenarios aprobados.
- Navegadores contra AWS candidato con certificado válido y resolución local: creación/unión, movimiento y enemigos compartidos, disparos autoritativos, Escape, identidad tras recarga y salida; sin errores. Build `e1fb054af8a3a06f379a3d931ce18630f8e43583`.
- Linux: configuración Nginx y Caddy validada; servicios sin privilegios, release versionada y salud por mTLS.

## Calibración real y correcciones

Todos los ensayos de carga/fallos se ejecutaron contra el candidato aislado, antes de pasar tráfico público. Los scripts rechazan el destino de DNS productivo y también detectan si la IP antigua ya está actuando como puente al clúster.

El primer ensayo con 12 clientes falló: cinco errores LIMIT, solo dos conexiones vivas al final y RTT p99 de 7.175 ms. Se conservaron esos resultados. La compresión sola mantuvo las conexiones pero dejó p95 de 2.627 ms, también insuficiente. Los créditos de CPU no estaban agotados.

Se aplicó compresión sin historial compartido, precisión de red de 1 mm, reutilización del JSON por broadcast y snapshots a 10 Hz. La simulación sigue siendo autoritativa a 60 Hz. No se eliminaron los límites de mensajes/colas para ocultar el fallo.

Ensayo final: **120 s, tres salas en tres workers, cuatro jugadores por sala, 20 inputs/s por jugador, movimiento, disparos y mejoras**.

| Medida | Resultado |
|---|---:|
| Conexiones al final | 12/12 |
| Errores | 0 |
| RTT p95 desde el Mac en Colombia | 126,18 ms |
| RTT p99 | 140,61 ms |
| Muestras de RTT | 1.404 |
| Bytes WebSocket recibidos | 76.170.396 |
| Enemigos máximos observados por sala | 49 / 42 / 39 |

El criterio de aceptación exige p95 <= 400 ms y p99 <= 800 ms además de mantener las conexiones. Una prueba previa de ocho clientes con la corrección también pasó (p95 127,58 ms).

Picos de las muestras de worker de ese intervalo:

| Worker | CPU (fracción de un núcleo) | RSS | Máximo paso muestreado | Máximo p99 del event loop |
|---|---:|---:|---:|---:|
| Principal m7i-flex.large | 0,098 | 118,4 MB | 2,33 ms | 21,94 ms |
| game-02 t3.small | 0,257 | 109,6 MB | 14,65 ms | 37,88 ms |
| game-03 t3.small | 0,186 | 120,5 MB | 17,85 ms | 33,95 ms |

El monitor del event loop tiene resolución de 20 ms, que forma parte de su lectura base. Son muestras, no garantía para toda la campaña. Capacidad inicial habilitada: **una sala de hasta cuatro jugadores por worker**. La principal conserva margen mayor; no se habilitaron salas adicionales por intuición. Quedan pendientes campañas prolongadas, cargas mayores y medición sostenida hasta el agotamiento de créditos antes de aumentar capacidad o afirmar un SLO.

## Fallos, límites y despliegues

Prueba final en AWS aprobada a las 20:27 Bogotá:

- Tres salas asignadas a tres workers y dos clientes de cada código en el mismo owner.
- Coordinador detenido: túneles existentes y reconexión con hint siguen; nuevas creaciones fallan controladamente.
- Reinicio de game-02: su sala se pierde y la encarnación anterior queda invalidada; no se promete recuperar RAM.
- Drenaje de game-03: conserva su conexión y la sala nueva elige otro worker.
- Sesión que envía 160 mensajes en una ráfaga: limitada; otra sesión legítima sigue respondiendo.
- Mensaje comprimible de 5.000 bytes: rechazado por límite de tamaño descomprimido, código 1009.
- Actualización y rollback funcionales en game-02 y game-03, con cero salas y marcador de drenaje; vuelta a la release nueva tras verificar salud.
- Delta: tres archivos cambiados, unos 371 KB en vez de 219 MB; se comprobaron los hashes de los 18.649 archivos/enlaces de la release reconstruida. Se detectó y corrigió el manejo de metadatos AppleDouble antes de activar la principal. Un cierre de transporte SSM en el coordinador obligó a comprobar su estado y manifiesto mediante Run Command; estaba activo con la release correcta.

## Infraestructura y TLS

- Cinco EC2 del clúster registradas Online en SSM; las otras dos permanecen fuera de alcance.
- Cinco raíces activas gp3 de 20 GiB, cifradas; IMDSv2 obligatorio y hop limit 1.
- Principal conservada, mismo ID/IP. Snapshot consistente con filesystem congelado y watchdog; sustitución de raíz completada y hashes de configuración/manifiesto iguales tras reinicio. Raíz al 33 % inmediatamente después del cambio. Original separado conservado sin cifrar, pendiente de política de retención.
- Tres grupos nuevos; ninguna regla TCP22. Veinte sondas públicas a 22/8787/8443/6379 bloqueadas. Principal conserva entrada web temporal para la transición, que debe retirarse al completar DNS.
- Redis en loopback. Worker/coordinador requieren TLS y certificado de identidad permitido.
- Certificado público propio emitido para apex/www, vencimiento 14/02/2027. Renovación simulada aprobada; timer y hook de recarga activos. Certificados internos requieren rotación manual antes de sus 90 días.
- Cuatro PEM nuevas 600 en el directorio indicado 700; llave original 400 conservada. No se imprimieron ni incluyeron claves privadas en Git, artefactos o estado.

## Artefacto y evidencia

Release completa: `.cluster-local/artifacts/redhorizon-cluster-20261117T001501Z.tar.gz`.

Commit: `e1fb054af8a3a06f379a3d931ce18630f8e43583`.

SHA-256: `24e59134e9dc6a915452931f715f422de8a87604c8b67e8d451f1cd96c18cdaa`.

Informes locales ignorados por Git: `live-calibration*.json`, `live-metrics*.json`, `live-fault-checks.json`, `live-limits.json`, `rollouts.json`, `root-migration.json`, `observations.json`, `final-infrastructure-checks.json`. Las versiones borrador `-worktree` no se usaron como release final.

Limitaciones: un gateway, un coordinador y una AZ; no HA completa, autoscaling, alertas externas ni recuperación de partidas en RAM. Cost Explorer no está habilitado. MFA del operador, rotación de PKI, capacidad prolongada y cierre del puente tras DNS quedan explícitos. La compilación conserva el aviso de bundle grande del frontend.

## Límite de la validación pública

La prueba por la IP antigua a través de un puente falló al cargar los modelos 3D dentro del plazo, tanto con proxy completo como con frontend local; otra ejecución alcanzó el lobby pero no terminó de preparar modelos. No se contabilizaron como aprobadas. Se retiró el puente y se restauró Caddy/backend legado, conservando las cinco EC2 candidatas. El paso final de DNS y retiro de la entrada antigua sigue pendiente del propietario. No se declara completada la migración pública.

La repetición final de dos navegadores contra el gateway directo también pasó sin errores (informe `candidate-browser-final.log`, build e1fb054). El fallo de la entrada antigua no se reprodujo al acceder directamente al gateway.
