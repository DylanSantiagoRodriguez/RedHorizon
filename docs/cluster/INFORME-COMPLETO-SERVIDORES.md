# Red Horizon — Implementaciones por servidor

Resumen de los 18 puntos solicitados, basado en la implementación y las verificaciones del 17 de noviembre de 2026. La numeración corresponde a la lista original.

## Máquinas virtuales

| VM | Tipo | Función |
|---|---|---|
| **rh-gateway** | `t3.micro` | Sirve la web mediante Nginx y dirige las conexiones de los jugadores al servidor de su sala. |
| **rh-game-01** | `m7i-flex.large` | Instancia principal conservada; ejecuta partidas autoritativas. |
| **rh-game-02** | `t3.small` | Ejecuta partidas adicionales para distribuir la carga. |
| **rh-game-03** | `t3.small` | Ejecuta partidas adicionales para distribuir la carga. |
| **rh-coordinator** | `t3.micro` | Asigna salas a workers y mantiene el directorio de propietarios en Redis local. |

En la tabla siguiente, **workers** significa `rh-game-01`, `rh-game-02` y `rh-game-03`; **todas** significa las cinco VM anteriores.

## Dónde, cómo y por qué está implementado

| N.º | Implementación | VM o ubicación | Cómo está implementado | Para qué sirve |
|---:|---|---|---|---|
| **1** | **Criptografía** | Todas; generación de certificados y artefactos en el Mac. | Certificados TLS por servicio; tokens aleatorios de reserva en el coordinador y de reconexión en workers; SHA-256 para verificar artefactos. | Proteger comunicaciones, acreditar identidades y detectar alteraciones en los archivos desplegados. |
| **2** | **Cifrado simétrico y asimétrico** | Gateway, workers y coordinador. | TLS combina certificados y mecanismos asimétricos de autenticación/acuerdo de claves con cifrado simétrico de los datos de la conexión. | Cifrar el tráfico de manera eficiente y autenticar los extremos. El tramo Nginx → Node del gateway es local y no usa TLS. |
| **5** | **OpenSSL** | Principalmente en el **Mac** para generar la PKI; certificados utilizados en todas las VM. | `pki.py` invoca la herramienta `openssl` disponible —LibreSSL en el Mac usado— para generar CA e identidades. Se verificaron cadenas y extensiones X.509 estrictas. | Crear y comprobar los certificados internos. La clave privada de la CA permanece en el Mac. |
| **11** | **HTTP y HTTPS** | Gateway; HTTPS interno también en workers y coordinador. | Nginx recibe HTTP/HTTPS en 80/443 y redirige a HTTPS, salvo desafíos de certificados. Reenvía al router Node mediante HTTP/WS en `127.0.0.1:8788`. | Entregar la aplicación y establecer conexiones seguras sin exponer directamente el router interno. |
| **12** | **TLS y mTLS** | Todas. | HTTPS/WSS público en gateway; WSS con mTLS hacia workers en 8787 y HTTPS con mTLS hacia coordinador en 8443. Se comprueban CA, SAN e identidad del servicio. | Evitar conexiones sin identidad válida y proteger los datos en tránsito. Se usa TLS, no SSL antiguo. |
| **13** | **Firewalls** | Capa de red AWS asociada a todas las VM. | Security Groups: Gateway permite 80/443 públicos; Game permite 8787 desde Gateway; Coordinator permite 8443 desde Gateway y Game. Sin entrada SSH pública. | Restringir qué componentes pueden comunicarse y por qué puertos. El filtrado implementado es de AWS; nftables no tiene reglas activas. |
| **20** | **IAM** | Servicio IAM de AWS y perfil operativo del Mac; administración de las cinco VM. | Identidad dedicada y asunción de un rol operativo acotado mediante el perfil `rh-cluster-operator`; acceso administrativo con Session Manager. | Separar la operación habitual de root y controlar las acciones sobre el clúster. El MFA humano sigue pendiente. |
| **27** | **Principio de mínimo privilegio** | Todas y la identidad operativa AWS. | Node se ejecuta como `redhorizon-cluster`; permisos operativos acotados; autorización por identidad mTLS y reglas específicas entre grupos. | Reducir el alcance de un error o una cuenta comprometida. Las tareas administrativas autorizadas siguen teniendo privilegios elevados cuando los requieren. |
| **28** | **Bastionado de servidores** | Todas. | systemd aplica `NoNewPrivileges`, `ProtectSystem`, aislamiento de temporales/dispositivos y límites de recursos. IMDSv2 es obligatorio. El proceso tiene un límite de 650 MiB en gateway/coordinador y 1.200 MiB en workers. | Dificultar escaladas de privilegios y contener consumo de recursos y modificaciones del sistema. |
| **32** | **Cabeceras HTTP de seguridad** | **rh-gateway**, en Nginx. | CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options` y `Referrer-Policy`. La CSP permite `blob:` en `connect-src` para las texturas GLB. | Restringir recursos y conexiones del navegador, proteger la navegación y permitir los recursos legítimos del juego. |
| **36** | **Gestión de parches** | Todas. | Instalación de `unattended-upgrades`, configuración sin reinicio automático del sistema y `needrestart` en modo informativo. Los reinicios se coordinan con el drenaje. | Mantener actualizaciones de seguridad sin cortar partidas por un reinicio automático. No acredita por sí solo que nunca existan parches pendientes. |
| **39** | **Git y GitHub** | Repositorio del **Mac** y **GitHub**, no un servicio en cada VM. | Cambios versionados, commits con autoría del propietario y publicación en `main`; los servidores reciben artefactos identificados por revisión. | Mantener trazabilidad, revisar cambios y recuperar versiones anteriores. |
| **44** | **Seguridad cloud** | Todas y servicios de AWS. | IAM, Security Groups, Session Manager, IMDSv2 obligatorio con hop limit 1 y discos raíz activos EBS cifrados. | Proteger administración, exposición de red, metadatos y almacenamiento del clúster. |
| **45** | **Infraestructura como código** | Repositorio y **CloudFormation en AWS**; describe recursos del clúster. | `deploy/cluster/infrastructure.json` define el aprovisionamiento; scripts reproducen configuración y despliegue. La principal existente se conserva mediante procedimientos específicos. | Repetir y revisar la infraestructura sin depender exclusivamente de cambios manuales. No significa que todos los cambios históricos estén gestionados por el mismo stack. |
| **60** | **Rate limiting** | **rh-gateway y los tres workers**. | Límites separados de conexiones, creación/unión y reconexión. Máximo de 150 mensajes/s por sesión y 4 KiB por mensaje entrante; colas pendientes acotadas. | Contener abuso y clientes defectuosos sin permitir que consuman recursos ilimitadamente. El coordinador queda detrás de esta entrada autenticada. |
| **61** | **Nginx `limit_req`** | **rh-gateway**. | HTTP: 30 solicitudes/s por IP, con ráfaga 100 en contenido. Inicio WebSocket: 1/s por IP, con ráfaga 10. Rechazos de tasa con HTTP 429. | Frenar ráfagas abusivas antes de que alcancen Node.js, permitiendo picos legítimos de carga. |
| **62** | **Control por dirección IP** | **rh-gateway y workers**. | Hasta 12 conexiones simultáneas por IP; presupuestos por operación. Nginx sobrescribe las cabeceras de IP y los workers solo aceptan la identidad del gateway. | Aplicar límites al origen observado y evitar que el cliente elija una IP falsa para eludirlos. Usuarios bajo un mismo NAT comparten presupuesto. |
| **63** | **Controles preventivos, detectivos y correctivos** | Todas; herramientas de operación en el Mac y métricas AWS. | Preventivos: SG, mTLS y límites. Detectivos: logs, métricas y heartbeats. Correctivos: drenaje, rollback, reinicio por fallo y procedimientos de recuperación. | Prevenir incidentes, identificar síntomas y restaurar el servicio. No hay SOC ni alertas externas automáticas implementadas. |

## Valores principales de los limitadores

| Control | Gateway | Workers |
|---|---|---|
| Conexiones simultáneas por IP | 12 | 12 por worker |
| Nuevas conexiones | Nginx: 1/s con ráfaga 10; Node añade su propio presupuesto | 60/min por IP |
| Creación de salas | Token bucket: ráfaga 4, recarga 8/min por IP | Máximo 8/min por IP, además del presupuesto de acceso |
| Unión y reconexión | Presupuestos separados: ráfaga 12, recarga 40/min por IP | Presupuesto compartido de acceso a salas: 40/min por IP |
| Mensajes WebSocket | 150/s por conexión | 150/s por conexión |
| Mensaje entrante | 4.096 bytes después de descomprimir | 4.096 bytes |
| Datos pendientes | 64 KiB hacia worker; 1 MiB hacia jugador | 1 MiB hacia jugador |

Las tasas de token bucket permiten ráfagas iniciales; no son ventanas rígidas con ese mismo máximo. La capacidad habilitada del juego es **una sala de hasta cuatro jugadores por worker: tres salas y doce jugadores en total**. Los topes defensivos de conexiones no representan capacidad de juego certificada.

## Precisiones sobre la implementación

- **No existe una VM bastión adicional:** la administración utiliza Session Manager.
- **La principal conserva temporalmente Game + Gateway**, así como Caddy/backend legados. La retirada de esa entrada sigue pendiente; el dominio ya apunta a `rh-gateway`.
- **Redis permanece en loopback** dentro del coordinador, sin puerto expuesto a Internet.
- **Los discos raíz activos están cifrados**, pero el volumen original separado y el snapshot histórico de la principal, anteriores al cifrado, siguen retenidos.
- **GitHub Actions está configurado**, pero las últimas ejecuciones no iniciaron por un bloqueo de facturación de GitHub. Esto es independiente de la publicación en `main`.
- **No hay alta disponibilidad completa:** gateway, coordinador y AZ únicos. Un worker perdido pierde sus partidas en memoria; rollback y reinicio no recuperan esas salas.
- **Kafka y un panel adicional de observabilidad no forman parte de esta implementación**: se preparó un prompt para ese trabajo, no se desplegaron esos componentes.

## Referencias del repositorio

- [Inventario de instancias y grupos](INVENTORY.md).
- [Procedimientos de operación, despliegue y recuperación](RUNBOOK.md).
- [Resultados de pruebas reales](PRUEBAS-EC2-2026-11-17.md).
- [Estimación histórica de costos](COSTS.md).
- [Configuración Nginx](../../deploy/cluster/nginx.conf).
- [Bastionado systemd](../../deploy/cluster/redhorizon-cluster.service).
- [Configuración inicial de los hosts](../../scripts/cluster/install-host.sh).
- [Generación de PKI](../../scripts/cluster/pki.py).
- [Infraestructura CloudFormation](../../deploy/cluster/infrastructure.json).
- [Gateway, coordinador y limitadores](../../server/cluster).
- [Backend WebSocket](../../server/server.js).
