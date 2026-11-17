# Operación de las cinco EC2

Inventario e IDs en [INVENTORY.md](INVENTORY.md); costos en [COSTS.md](COSTS.md). Ejecutar desde la raíz del repositorio. El perfil cotidiano es `rh-cluster-operator`; no usar root para operación. Las otras dos EC2 quedan excluidas.

## Acceso y estado

AWS CLI y Session Manager Plugin 1.2.896.0 están instalados en el Mac. El plugin se verificó por SHA-256 y firma/notarización de Amazon. `remote.py` usa SSH dentro de Session Manager, con clave de host verificada y PEM local; no necesita abrir TCP 22. Para comandos habituales usar SSM Run Command o una sesión de consola. Las llaves y la CA nunca entran en payloads SSM, Git ni artefactos.

```sh
aws sts get-caller-identity --profile rh-cluster-operator
aws ssm describe-instance-information --region us-east-2 --profile rh-cluster-operator
python3 scripts/cluster/observe.py
```

`observe.py` guarda métricas estándar de CloudWatch y estado del worker en `.cluster-local/observations.json`. No habilita métricas personalizadas ni alarmas de pago. Métricas de juego cada 5 s en `/run/redhorizon-cluster/status.json` y journald; retención 7 días/100 MiB. Nginx rota hasta siete archivos, umbral 10 MiB evaluado cada hora. Los parches no reinician automáticamente el juego: needrestart informa servicios pendientes y los reinicios requieren drenaje; no hay reboot automático. Revisar CPUCreditBalance en T3 Standard: agotar créditos reduce CPU. No hay alertas externas automáticas ni respuesta operativa 24/7.

El usuario IAM dedicado solo asume el rol acotado a las cinco instancias. La política permite cerrar únicamente las sesiones de su propia identidad, usando la condición recomendada por [AWS](https://docs.aws.amazon.com/systems-manager/latest/userguide/getting-started-restrict-access-examples.html). El MFA humano no está enrolado: es un pendiente del propietario, no una protección ya activa.

## Construcción y publicación

```sh
bash scripts/cluster/package.sh "$PWD/.cluster-local/artifacts"
```

Construye y prueba en el Mac; empaqueta frontend, runtime, dependencias de producción y Node Linux 22.23.5 con checksum fijado. No publica un checkout `-worktree` como release final. Guardar commit y SHA-256 del artefacto. `stage-fleet.py` sirve para la instalación inicial con servicios detenidos, no para actualizar partidas activas.

Para reducir transferencia por SSM, construir un delta local entre artefactos completos conocidos:

```sh
python3 scripts/cluster/make-delta.py NUEVO.tar.gz DELTA.tar.gz --base ANTERIOR.tar.gz
python3 scripts/cluster/rollout.py DELTA.tar.gz --delta --release REVISION --hosts rh-game-02 rh-game-03 rh-game-01
```

El delta copia mediante enlaces duros la versión anterior, desliga cada archivo modificado antes de escribirlo y verifica todos los hashes del resultado contra el artefacto completo. La versión de rollback permanece intacta. No recompila en las EC2. La activación se detiene ante cualquier discrepancia. Una interrupción puede dejar un directorio incompleto: revisar el log privado antes de reintentar; `activate-delta.py --resume-verification` solo verifica y activa una reconstrucción completa.

El rollout drena cada worker, espera cero salas, activa la release, comprueba salud mTLS desde gateway y reabre admisión. Espera que el coordinador acepte la nueva encarnación. El plazo de drenaje es 7.500 s; al vencer, no mata partidas. `--rollback-check` prueba retorno a la versión previa con el worker vacío y vuelve a la nueva. Gateway/coordinador requieren `--allow-entry-interruption`, cero túneles y una ventana de mantenimiento: son instancias únicas.

La configuración no secreta está en `/etc/redhorizon-cluster/cluster.json`. `render-config.py` usa capacidad cero si el inventario no incluye una medición aprobada. No confundir capacidad cero de una plantilla nueva con la configuración de los hosts ya calibrados. Respaldar inventario local antes de regenerarlo: `inventory.py` descubre recursos pero no certifica capacidad.

## Certificados

HTTPS público: `/etc/letsencrypt/live/redhorizon.lat/`, Certbot webroot `/var/lib/letsencrypt`, timer habilitado y hook de recarga Nginx. La emisión real y `certbot renew --dry-run` pasaron. Durante la transición el origen anterior deja llegar los desafíos al gateway; después del DNS llegan directamente. No copiar claves privadas a logs o Git.

Certificados internos: 90 días, CA de 365 días guardada solo en `llaveredhorizon/cluster-20261117-strict`. Antes de febrero de 2027, emitir nuevos certificados de servicio firmados por esa CA en un directorio nuevo dentro de llaveredhorizon; mantener CN fijo y SAN con IP privada del inventario. Distribuir únicamente el certificado/clave del host y el certificado público de CA. Rotar cada worker drenado; gateway/coordinador necesitan mantenimiento. Una rotación de CA exige primero confiar en ambas CA, luego cambiar identidades y finalmente retirar la anterior. No hay renovación ni revocación automática de esta PKI interna.

## DNS y transición

El propietario cambia `A @` a **3.23.131.44**, y `www` a CNAME `redhorizon.lat` o A a la misma IP. Retirar registros A/AAAA antiguos que compitan. Un TTL de 300 s facilita la transición. No se modificó DNS mediante herramientas.

Se conserva Caddy/backend legado en la principal hasta que el propietario cambie DNS. Se ensayó y retiró un puente temporal: la ruta por la IP antigua no superó la carga de modelos dentro del plazo. El acceso directo al gateway sí pasó. No reactivar ese puente como procedimiento de producción. El timer de despliegue legado queda deshabilitado para evitar publicar otra versión durante la transición.

Antes del cambio, realizar una ventana sin salas legadas o esperar que terminen. Las conexiones antiguas ya abiertas pueden continuar mientras viva el proceso, pero sus códigos/tokens no migran al directorio nuevo: durante propagación no se garantiza unión ni reconexión a salas antiguas. El cierre posterior se niega si quedan salas legadas.

Después de propagación, comprobar y retirar la entrada legada:

```sh
python3 scripts/cluster/finalize-dns.py
python3 scripts/cluster/finalize-dns.py --execute
```

Consulta dos resolutores públicos para apex/www y exige que solo devuelvan gateway, sin IPv6 antiguo. Comprueba salud pública del gateway y cero salas legadas, detiene Caddy/backend antiguos y deja en la principal únicamente GameSecurityGroup. No reinicia los workers ni mueve partidas. Hacerlo dentro de una ventana vigilada tras la propagación.

Los códigos/sesiones antiguos no migran; el cambio final de DNS todavía no se realizó. Los códigos nuevos siempre pertenecen a un único proceso. Las partidas en RAM se pierden si ese proceso cae; Redis no las reconstruye.

## Recuperación y rollback

Worker defectuoso: mantenerlo drenado, parar servicio, restaurar el symlink de `/srv/redhorizon-cluster/current` a la release previa, iniciar, verificar mTLS y reabrir. No forzar parada de una sala activa. `activate.sh`/`activate-delta.py` revierten automáticamente solo fallos de inicio; salud funcional debe verificarse aparte.

Coordinador caído: los túneles existentes siguen funcionando; reiniciar `redhorizon-cluster` y comprobar Redis loopback/AOF. Rechaza nuevas asignaciones mientras falla. Un gateway caído corta túneles: recuperación/reconexión depende del plazo de 30 s y de que el owner siga vivo. No hay alta disponibilidad completa.

Rollback público: drenar primero el clúster, restaurar `/etc/caddy/Caddyfile.pre-cluster-routing` en la principal, habilitar `redhorizon-backend` y Caddy; conservar temporalmente GatewaySecurityGroup y DNS antiguo según inventario. No activar automáticamente el viejo timer de despliegue. Las salas nuevas no se transfieren al legado.

La raíz principal se sustituyó mediante la [API de reemplazo de EBS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/replace-root.html), conservando instancia/IP. El script `encrypt-main-root.py` es una migración única, con ID de volumen original fijado, snapshot consistente, watchdog de descongelación y verificación de hashes tras reiniciar. No volver a ejecutarlo como rutina. Se conserva el volumen original separado y el snapshot previo; ambos son anteriores al cifrado. Para volver a esos datos, crear una copia **cifrada** en la misma AZ y usar root replacement: AWS no permite reemplazar una raíz cifrada por una sin cifrar.

## Apagado del laboratorio

Primero mantener o restaurar el servicio legado si se necesita conservar el sitio y resolver DNS. En cada uno de los tres workers marcar drenaje y enviar SIGUSR1 mediante SSM; esperar estado fresco con draining=true, rooms=0. Mantener los procesos vivos durante la comprobación del apagado. Entonces:

```sh
python3 scripts/cluster/stop-lab.py
python3 scripts/cluster/stop-lab.py --execute
```

El script exige cero salas drenadas y cero túneles, y solo detiene las cuatro EC2 nuevas; excluye la principal y las otras dos instancias. EBS sigue facturando. Al arrancar cambian las IP públicas automáticas: regenerar inventario, fijar nuevamente claves de host mediante SSM y corregir DNS. Las IP privadas suelen conservarse, pero deben verificarse. CloudFormation tiene Retain/protección: borrar el stack no equivale a limpiar todos los recursos. No borrar volúmenes originales como parte de una limpieza automática.

## Comprobación privada y rotación de PKI en candidato vacío

`python3 scripts/cluster/verify-private-network.py` ejecuta las sondas dentro de cada EC2 mediante SSM. Usa las IP privadas, valida SAN y cadenas X.509 estrictas y comprueba rutas permitidas y denegadas. No requiere resolver ni cambiar el dominio de la aplicación. Los códigos 400/405 son respuestas esperadas a peticiones de prueba que no crean salas; 403 y los fallos TLS/red también son éxitos cuando la prueba exige denegar el acceso.

La PKI activa desde el 17/11/2026 es `llaveredhorizon/cluster-20261117-strict`. El generador declara CA v3, Basic Constraints/Key Usage críticos y SKI/AKI explícitos; no depende de valores por defecto de LibreSSL. La prueba de regresión usa `VERIFY_X509_STRICT`, conforme al comportamiento documentado por [Python](https://docs.python.org/3/library/ssl.html) y las extensiones de [OpenSSL](https://docs.openssl.org/3.0/man5/x509v3_config/).

Para una futura rotación con todo el clúster vacío, generar otra PKI en un directorio nuevo y usar `rotate-idle-pki.py RUTA --execute`. Comprueba cero conexiones/salas, prepara solo la identidad de cada host, valida las cadenas y claves, detiene los cinco servicios de clúster, sustituye certificados y arranca de nuevo. Conserva los anteriores por host para rollback. Es mantenimiento del candidato, no rotación sin interrupciones de producción. No toca Caddy ni el backend legado. La CA privada nunca sale del Mac.

Después de restaurar un snapshot antiguo de la principal, reinstalar la PKI actual antes de habilitar admisión: ese snapshot conserva la identidad anterior, ya no aceptada por el clúster.


## Correcciones del frontend sin reiniciar partidas

Desde el 17/11/2026 el gateway puede servir una release estática independiente del runtime. El endpoint `/health` identifica el backend; `/frontend-release.json` identifica el frontend y su runtime compatible. No confundir los dos commits.

Para un cambio exclusivamente visual compatible con el protocolo que ya está ejecutándose:

```sh
bash scripts/cluster/package.sh "$PWD/.cluster-local/artifacts"
python3 scripts/cluster/deploy-frontend.py NUEVO.tar.gz --base ARTEFACTO_BASE.tar.gz --release COMMIT_COMPLETO --compatible-runtime COMMIT_BACKEND
```

El paquete completo se construye y prueba localmente. El despliegue transfiere un delta, copia el frontend anterior mediante enlaces duros, desliga los archivos modificados y verifica todos los hashes antes de cambiar el `root` de Nginx. Conserva assets JS/CSS anteriores para pestañas abiertas. Hace `nginx -t` y una recarga gradual; no reinicia Node ni los workers. No usar para cambios incompatibles de protocolo.

El frontend activo queda en `/srv/redhorizon-cluster/frontend-releases/COMMIT`. La configuración anterior se conserva en `/srv/redhorizon-cluster/nginx-before-frontend-COMMIT.conf`. Para rollback, restaurar esa configuración, ejecutar `nginx -t` y `systemctl reload nginx`. Si falla la validación o recarga durante el despliegue, el script restaura la configuración anterior.

Después de un rollout completo, revisar explícitamente el frontend: mientras Nginx apunte a una release estática independiente, cambiar el symlink `current` del backend no publica otra interfaz. Para volver al frontend de la release completa, restaurar el root `/srv/redhorizon-cluster/current/frontend`, validar y recargar Nginx en la misma operación de publicación.

La CSP debe permitir `blob:` en **connect-src**, además de **img-src**: GLTFLoader usa fetch para las imágenes embebidas antes de crear ImageBitmap. La prueba `graphics-policy.spec.js` aplica la política de la plantilla a un navegador real, comprueba imágenes decodificadas y verifica el avance del AnimationMixer entre snapshots. No basta con recibir HTTP 200 para un archivo GLB.
