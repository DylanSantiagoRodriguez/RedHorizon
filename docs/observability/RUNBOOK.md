> **Acceso actualizado por solicitud del propietario:** el panel desplegado usa usuario y contraseña, sin código TOTP (`requireMfa: false`). Se conservan roles, límites de intentos, sesiones seguras y mTLS interno. Las referencias a MFA de abajo documentan la configuración y pruebas anteriores; no son un requisito de acceso actual.

# Despliegue y operación de observabilidad

**No ejecutar la fase AWS sin aprobar COSTOS.md.** No hay nuevas instancias ni URL activa todavía. Este procedimiento conserva el juego y el frontend actual; no despliega el bundle del juego como parte de publicar el panel.

## 1. Comprobar la entrega local

Desde la raíz del repositorio, con Node 22.23.5, Redis local, Python/OpenSSL, Docker y Chromium de Playwright:

```sh
npm ci
npm run check
python3 scripts/observability/local-kafka.py
```

El laboratorio crea únicamente `rh-observability-kafka-lab`, con puerto en `127.0.0.1:19093`; rechaza un contenedor previo del mismo nombre. Los certificados se generan en un subdirectorio único de `/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon`. No altera otros contenedores.

Preparar `.cluster-local/observability/bootstrap.json` con `brokers: ["127.0.0.1:19093"]`, `tlsDir` tomado de `lab.json` e `identity: "rh-kafka-admin"`; contiene rutas, no claves. Luego:

```sh
node scripts/observability/bootstrap-kafka.mjs .cluster-local/observability/bootstrap.json
node scripts/observability/verify-local.mjs
node scripts/observability/benchmark-local.mjs
```

`verify-local` crea Prometheus temporal, tres procesos de juego, agentes y panel local; comprueba navegador, mTLS, ACL, duplicados, inválidos, caída/recuperación Kafka y colector. Retira su Prometheus al terminar y restaura el broker si lo pausó. Utiliza un modo HTTP de laboratorio limitado a loopback; el ejecutable de producción del panel lo rechaza. Las cuentas de prueba viven en memoria y no se imprimen.

Para retirar el laboratorio, tras finalizar las pruebas:

```sh
docker rm -f rh-observability-kafka-lab
```

Solo borrar los subdirectorios de claves de prueba identificados en `lab.json`, después de retirar contenedores que los montan. Nunca borrar `llaveredhorizon` completo.

## 2. Preparar AWS después de la aprobación

1. Repetir inspección de cuota, tipos, AMI y créditos con `inspect-costs.py`. El script de inspección usa el perfil AWS vigente; no cambia permisos ni recursos.
2. La configuración compartida agrega 2 vCPU: 14 existentes + 2 = cuota actual de 16. No requiere aumento. No detener `redhorizon_last` ni `superkanes` para liberar cuota.
3. Crear el límite IAM `RedHorizonObservabilityRuntimeBoundary` con `deploy/observability/runtime-boundary.json`, mediante identidad administrativa de bootstrap. Es un límite de permisos, no credenciales.
4. Conceder temporalmente a un rol dedicado la política revisable `provisioner-policy.json`. No dar ese permiso de provisión a las máquinas. `iam:CreateRole` exige el límite anterior; las identidades runtime quedan limitadas a SSM y lectura básica de métricas, y únicamente la VM de observabilidad recibe GetMetricStatistics en su política efectiva.
5. Conservar `rh-cluster-operator` para operación y SSM. Verificar que puede administrar la instancia nueva etiquetadas `Project=RedHorizonCluster`; extender únicamente recursos/documentos necesarios si su política actual enumera IDs. Retirar permisos de provisión al completar el stack. No usar root en código, servidores, artefactos ni variables persistentes.

Provisión explícita, después de lo anterior:

```sh
python3 scripts/observability/provision.py --approved-monthly-usd 141 --profile rh-cluster-operator --ami ami-096d6538c463eb1db
```

Si el rol dedicado de provisión tiene otro perfil, usarlo en `--profile`. El script rechaza root, cuota insuficiente, duplicación de nodos y AMI ajena a Canonical. Genera una PEM única bajo `llaveredhorizon` (directorio 700/archivos 600), importa solo públicas y crea el stack `redhorizon-observability`. No imprime claves. Si falla CloudFormation, inspeccionar eventos y recursos retenidos; no repetir creando otra flota.

Esperar `CREATE_COMPLETE` mediante consultas de estado; después:

```sh
python3 scripts/observability/inventory.py
python3 scripts/observability/render-config.py .cluster-local/observability/inventory.json .cluster-local/observability/config
```

El inventario nuevo tiene exactamente los cinco nodos previos más una VM nueva y una identidad lógica rh-events en esa misma VM. El antiguo no se sustituye. Verificar los IDs, nombres y SG antes de cualquier escritura remota. Nunca usar `inventory-fixture.json` de pruebas para desplegar.

## 3. Certificados, acceso y artefacto

Generar **otra CA**, sin rotar la PKI actual del juego:

```sh
python3 scripts/cluster/pki.py /Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon/observability-FECHA-UNICA --hosts .cluster-local/observability/config/hosts.json
node scripts/observability/create-access.mjs /Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon/observability-acceso-FECHA-UNICA
```

Usar nombres únicos; los scripts rechazan sobrescrituras. `users.json` contiene hashes y secretos TOTP y va exclusivamente al panel con permisos restringidos. `enrollment.json` contiene los datos iniciales para inscribir el autenticador: abrirlo localmente, transferir al gestor de contraseñas/autenticador y retirarlo cuando esté inscrito. No subirlo ni pegarlo en chat. Distribuir las credenciales `reader` y `admin` por un canal seguro del propietario, no por Git.

La CA privada y `rh-kafka-admin.key` permanecen localmente. Cada VM recibe solamente certificados públicos y claves de sus identidades. El panel recibe identidad TLS de servidor y del consumidor, nunca la del administrador Kafka. El navegador recibe una sesión, nunca una credencial de Kafka.

Después de commits y pruebas, con árbol limpio:

```sh
bash scripts/observability/package.sh /Users/dylanrodriguez/Documents/redhorizon/RedHorizon/.cluster-local/observability/artifacts
```

El paquete contiene runtime Node Linux 22.23.5 con checksum fijado, dependencias de lockfile, código/panel y configuración. Prometheus 3.16.0 y Kafka 4.4.0 están fijados por digest. No hay compilación en servidores de partidas. El paquete **no contiene PEM, CA privada ni usuarios**. Guardar su SHA-256 con la evidencia del despliegue.

## 4. Desplegar servicios adicionales

Usar `stage.py` con inventario, artefacto, SHA/revisión y directorios privados. Ejemplo estructural — reemplazar REVISION y rutas por los artefactos reales:

```sh
python3 scripts/observability/stage.py .cluster-local/observability/inventory.json .cluster-local/observability/artifacts/redhorizon-observability-REVISION.tar.gz --config .cluster-local/observability/config --pki /Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon/observability-FECHA-UNICA --access /Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon/observability-acceso-FECHA-UNICA --revision REVISION --hosts rh-observability rh-gateway rh-game-01 rh-game-02 rh-game-03 rh-coordinator
```

Transporte: SSH/SCP dentro de Session Manager, con clave de host obtenida mediante SSM y verificación estricta. No abre 22 en Security Groups ni transporta claves en parámetros SSM. Usa la PEM correspondiente solo localmente. Staging no reinicia `redhorizon-cluster` ni modifica Nginx. El instalador retira las copias de claves/usuarios de staging después de instalarlas. Una ejecución fallida exige inspección; no sobreescribe una release existente.

El agente usa el usuario de servicio existente y socket `/run/redhorizon-observer/ingest.sock` con permisos 660. CPUQuota 10% y MemoryMax 128M aíslan la recolección. Solo la VM nueva instala Docker; contenedores sin root/capabilities, filesystem de imagen de solo lectura y volúmenes dedicados. Redis sigue como estaba.

Arrancar broker, comprobar TLS y almacenamiento, y aplicar topics/ACL/cuotas con el script específico:

```sh
python3 scripts/observability/bootstrap-remote.py .cluster-local/observability/inventory.json --pki /Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon/observability-FECHA-UNICA
```

Usa SCP dentro de SSM para una identidad administrativa **temporal**, no la CA privada. Ejecuta el cliente Node local del artefacto contra la IP privada y aplica cuotas mediante contenedores CLI efímeros. Retira la carpeta administrativa en `finally`, incluso si falla. No imprime claves ni las introduce en comandos/SSM; se mantiene validación de certificado y hostname. Si el transporte se pierde durante la limpieza, verificar y retirar la carpeta `rh-kafka-bootstrap-*` antes de cerrar la operación. Nunca subir esa identidad a workers/panel ni dejarla montada en el broker permanente.

Confirmar los 21 topics, 92 entradas ACL, cuotas de ocho identidades y rechazo de una identidad que escriba en un topic ajeno. El script `quotas.py` también permite administrar cuotas desde una instalación Kafka existente mediante un archivo cliente privado.

## 5. Instrumentar el juego sin cortar partidas

Añadir únicamente `"observability":{"socketPath":"/run/redhorizon-observer/ingest.sock"}` a las configuraciones actuales. Guardar copia de cada configuración. Mantener capacidades, tick/snapshot rates, rutas y PKI existentes. No regenerar configuraciones antiguas perdiendo ajustes de producción.

Construir el artefacto de backend fuera de las EC2 con el mecanismo existente. Desplegar workers **uno por uno**, usando el drenaje/rollout existente. Drenaje máximo documentado: 7.500 segundos. Si quedan salas, posponer; no forzar su cierre. Verificar salud, heartbeat, versión, métricas y una partida aislada antes de reabrir asignaciones y pasar al siguiente worker.

Gateway y coordinador requieren comprobar que no hay túneles activos antes de reiniciar su proceso para cargar instrumentación. Si hay usuarios, conservar el proceso actual hasta que terminen. Cambiar el symlink de la release sin reiniciar no activa instrumentación. No sustituir el frontend desplegado: sus texturas y animaciones tienen correcciones independientes.

La telemetría es opcional; si falla, dejar las partidas funcionando y corregir el agente/Kafka. No cambiar capacidad ni autoscaling a partir de esta muestra local.

## 6. Publicar el panel y validar

Primero comprobar `https://IP_PRIVADA_OBSERVABILITY:8444/ops/api/session` desde gateway con la CA/certificado de observabilidad y hostname verificado: debe devolver 401 sin sesión; un certificado de worker debe ser rechazado. Prometheus/Kafka/exporters no deben aceptar acceso desde Internet. Verificar Security Groups tanto de entrada como salida.

Preparar en el staging del gateway `nginx-ops.conf` renderizado, `nginx-telemetry-http.conf`, `gateway-config.py` y `activate-gateway.sh`. Ejecutar este último allí. Usa el archivo existente `/etc/nginx/conf.d/redhorizon.conf`, preserva frontend/TLS/rutas, guarda backup, ejecuta `nginx -t` y hace **reload**; restaura el anterior si falla. No modifica DNS. La copia pública del certificado HTTPS se actualiza mediante hook de renovación; no copia su clave privada al agente.

Comprobar `https://redhorizon.lat/ops/`: login contraseña+TOTP, cookie segura, reader sin seguridad detallada, admin con acceso de lectura; APIs sin sesión 401, origen incorrecto 403. No proporcionar credenciales en URL.

La entrega AWS requiere probar con una partida de prueba real: dos clientes en la misma sala/worker, distinta sala en otro worker, contadores y eventos correspondientes, reconexión y ausencia de códigos/token en logs. Verificar recursos y latencia comparando ventanas similares antes/después. **No hacer fallos ni saturación sobre partidas de usuarios**: usar entorno aislado; las pruebas locales adjuntas no sustituyen las de red/SSM/roles EC2.

## Recuperación, rollback y rotación

- Agente/Kafka caídos: las partidas continúan; colas acotadas descartan y cuentan pérdidas. Reiniciar solo servicio adicional afectado; comprobar TLS, disco, crédito CPU y frescura antes de considerar recuperado.
- Broker: conservar `/var/lib/redhorizon-kafka` y su `meta.properties`. No reformatear al reiniciar. Un disco perdido implica perder los eventos retenidos; no hay replicación ni backup externo automático.
- Panel: detener únicamente panel, hacer backup consistente de SQLite con la API `.backup` de sqlite3 o con el servicio parado incluyendo WAL, y restaurar permisos. No copiar solo `events.db` mientras escribe. Guardar backups en directorio privado cifrado del propietario; no introducir snapshots S3/EBS de pago automáticamente.
- Si SQLite se restaura a un punto anterior, los offsets Kafka pueden estar más adelantados: detener consumidor, resetear **solo `rh-panel-v1`** al timestamp necesario con identidad administrativa temporal y reanudar. Deduplicación absorbe reenvíos. Solo se recupera lo que conserve Kafka (24 h).
- Revertir panel/agente: detener sus unidades, restaurar symlink guardado en `/srv/redhorizon-observability/previous`, arrancar y comprobar. No cambiar symlinks del juego para revertir el panel.
- Revertir Nginx: restaurar backup `redhorizon.conf.before-observability.*`, retirar include nuevo y archivo `00-redhorizon-observability.conf`, ejecutar `nginx -t` y reload. El juego conserva su entrada anterior. No restaurar una copia que pierda cambios posteriores.
- Revertir backend instrumentado: drenaje normal, cero salas, release anterior/configuración anterior, salud y reapertura. No reiniciar workers activos por una incidencia de métricas.
- Certificados de observabilidad duran 90 días; CA 365. Rotar antes de vencer, manteniendo CN/SAN y ACL. Generar nuevas claves en directorio local único, distribuir por SSM, renovar consumidores/productores/exporters de forma escalonada. Para cambio de CA, distribuir confianza de ambas durante transición y retirar la vieja después de verificar todos los clientes. No rotar PKI de juego junto con esta operación.
- Contraseñas/TOTP: regenerar acceso en directorio nuevo, actualizar `users.json`, reiniciar solo panel para invalidar sesiones. El contador anti-replay de OTP persiste en SQLite; al reemplazar semilla del mismo usuario, revisar su contador antes de probar el código del intervalo actual. No imprimir semillas.

## Apagado del laboratorio AWS

Apagar exclusivamente `rh-observability` usando su ID confirmado; `rh-events` comparte esa misma EC2. Retirar `/ops/` de Nginx con reload, detener agentes si ya no se desean reintentos, conservar juego/coordinador y retirar permisos de provisión temporales. No usar comodines de nombres ni apagar todas las instancias con etiqueta Project.

EC2 detenidas conservan EBS facturable; las IP públicas automáticas cambian al volver a iniciar. Las IP privadas persisten en stop/start. Revalidar inventario/SSM. Para eliminar definitivamente: copia autorizada de datos, desactivar protección de terminación solo en esa EC2, terminar, revisar y eliminar únicamente sus volúmenes retenidos si ya no hacen falta y retirar reglas/SG/roles de la ampliación. Una eliminación de stack con Retain no hace ese trabajo automáticamente.

No declarar terminado hasta registrar pruebas AWS, URL operativa, inventario definitivo y medición real. Véase [PRUEBAS](PRUEBAS.md).
