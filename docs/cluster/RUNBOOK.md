# Procedimiento de despliegue, migración y recuperación

No ejecutar creación hasta aprobar COSTS.md. Los comandos con nombres de llaves/stack/dominio requieren valores reales del inventario; no son un despliegue ya realizado.

## 1. Identidad y plan

1. Confirmar cuenta `670036769494`, región Ohio, saldo, horario y presupuesto.
2. Crear/configurar identidad administrativa dedicada con MFA; no publicar credenciales. El operador diario usa el rol de `operator-role.json`, que exige MFA y limita start/stop/SSM a tags del clúster. No tiene permisos IAM, de creación de flota ni de cambios de red. El bootstrap de infraestructura requiere una identidad de aprovisionamiento revisada; no reutilizar root en instancias ni CI.
3. Validar plantillas con `aws cloudformation validate-template`. La plantilla principal **solo crea cuatro nodos**. La EC2 existente no entra en su ciclo de borrado/reemplazo. Los cuatro nuevos tienen protección contra terminación y Retain.
4. Crear las cuatro llaves con `python3 scripts/cluster/create-keys.py`. Son RSA 3072 PEM sin sobrescritura, 600 dentro de llaveredhorizon 700. Solo se importa la parte pública en AWS. Guardar nombres devueltos para parámetros GatewayKeyName, Game02KeyName, Game03KeyName y CoordinatorKeyName.
5. Crear y revisar un change set de CloudFormation para `deploy/cluster/infrastructure.json`, parámetros de llaves reales y UbuntuAmi `ami-096d6538c463eb1db`, CAPABILITY_IAM. Revalidar AMI Canonical antes. Ejecutarlo solo dentro del presupuesto acordado.

## 2. Inventario, configuración y certificados

```sh
python3 scripts/cluster/inventory.py NOMBRE_STACK > .cluster-local/inventory.json
python3 scripts/cluster/render-config.py .cluster-local/inventory.json .cluster-local/config
python3 scripts/cluster/pki.py /Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon/cluster-FECHA --hosts .cluster-local/config/hosts.json
```

La ruta de PKI debe ser nueva. Cada servidor recibe solo `ca.crt`, su certificado y su clave privada; nunca `ca.key` ni la identidad de otro servidor. Instalar en `/etc/redhorizon-cluster/tls`, clave con propietario del servicio y modo 600. Config `/etc/redhorizon-cluster/cluster.json`, root:servicio 640. Las claves de prueba se generan en subdirectorios temporales dentro de llaveredhorizon y se eliminan al terminar las pruebas.

La capacidad por defecto es cero. Para el laboratorio aislado se habilita una sala por nodo, se prueba y después se calibra. No abrir producción con una capacidad inventada. Para cambios de capacidad, actualizar config durante drenaje/reinicio.

Registrar nuevas EC2 en SSM. Para la principal, instalar/habilitar agente y asociar el perfil aprobado sin tocar su servicio actual. Comprobar inicio de sesión SSM antes de retirar SSH. La plantilla no cambia automáticamente el perfil, los tags ni SG de la principal.

## 3. Preparar hosts y artefactos

`install-host.sh` es un script para ejecutar como root dentro de cada host. Usa `gateway`, `game` o `coordinator`. Instala unidades pero no arranca el runtime. **No usar el rol gateway en la principal**, porque instalar Nginx puede ocupar el puerto 80.

```sh
bash scripts/cluster/package.sh /RUTA/ABSOLUTA/artefactos
```

Ejecuta check local y empaqueta frontend, runtime, dependencias de producción y Node Linux 22.23.5 verificado contra SHA-256 fijado. Una compilación de checkout modificado se etiqueta `-worktree`; tratarla como artefacto de revisión, no como release final. Antes de producción, fijar revisión y registrar SHA-256 exacto aprobado.

Transferir el artefacto mediante una sesión SSM con túnel o canal SSH autorizado, sin abrir SSH global. Verificar digest recibido por canal confiable. Ejecutar `activate.sh ARCHIVO SHA256 RELEASE` en un servicio detenido; conserva el enlace anterior. No extraer código en el árbol de producción legado.

Para game-01, el proceso legado ocupa `127.0.0.1:8787`; el nuevo puede usar `172.31.16.183:8787` con mTLS durante preparación. Medir memoria y CPU de la convivencia. El código nuevo usa `/srv/redhorizon-cluster`, no `/srv/redhorizon/current`.

## 4. Entrada HTTPS y prueba previa al DNS

Renderizar `nginx.conf` con el dominio real. Instalar un certificado público válido antes de habilitar 443. Obtenerlo mediante desafío DNS controlado o trasladar de forma segura el certificado vigente y su clave desde Caddy para la transición; cualquier copia privada temporal se guarda solo en llaveredhorizon. Configurar renovación ACME en el gateway antes de retirar el origen antiguo.

Las rutas de la plantilla son `/etc/letsencrypt/live/DOMINIO/fullchain.pem` y `privkey.pem`. Si se usa un certificado trasladado, ajustar las rutas a su ubicación privada real: copiar archivos no crea automáticamente una configuración de renovación de Certbot.

Validar `nginx -t` en Linux y probar sin cambiar DNS:

```sh
curl --fail --resolve redhorizon.lat:443:IP_GATEWAY https://redhorizon.lat/health
```

No usar `-k` ni desactivar verificación TLS. Probar frontend y WebSocket con resolución local del dominio a la IP candidata. Verificar puertos desde Internet y desde cada SG. Ejecutar dos navegadores reales, reconexión, tres salas distribuidas y el smoke de producción contra la candidata. No ejecutar estrés sobre el dominio productivo.

## 5. Calibración y cambio

Hacer carga controlada por nodo: una sala con cuatro jugadores, combate/guardianes, luego incrementar salas. Medir p95/p99 de RTT, tiempo de paso, retraso del event loop, memoria y CPU durante un período que incluya consumo sostenido de créditos T3. Reservar margen y volver a probar mezclando abuso con usuarios legítimos, incluidos varios jugadores tras una IP.

Los benchmarks locales de 10 s no certifican esa capacidad. Consultar CPUCreditBalance, CPUUtilization, NetworkIn/Out en CloudWatch sin habilitar métricas personalizadas automáticamente. Definir alertas y retención según el presupuesto; actualmente solo hay métricas estructuradas y logs locales.

Antes de cambiar DNS, impedir nuevas salas en el legado y esperar las existentes, con mantenimiento anunciado si se necesita reinicio. El backend legado no tiene el nuevo drenaje: no suponer que SIGUSR1 lo implementa. Puede restringirse creación mediante un cambio específico y validado o realizar una ventana de corte cuando no haya jugadores.

En la transición, los clientes del servidor legado no conocen el directorio nuevo: una sala antigua no migra. Evitar que códigos se compartan entre destinos durante propagación; conservar origen legado para rollback. Solo después de comprobar el gateway, retirar exposición directa y detener el timer de despliegue legado para que no publique versiones incompatibles. Ningún paso está automatizado sobre la principal sin esa transición.

## 6. Actualización gradual

Para cada worker, uno por vez:

1. Ejecutar `drain-host.sh` mediante SSM. Mantiene un marcador que sobrevive reinicios y espera cero salas; plazo predeterminado 7.500 s. Al vencer, **no mata** las partidas.
2. El script detiene el servicio después de comprobar un status reciente, draining=true y rooms=0.
3. Instalar artefacto nuevo con `activate.sh`; el marcador conserva el estado drenado.
4. Comprobar health por mTLS desde gateway y estado/registro local. El identificador de revisión debe coincidir con el artefacto aprobado.
5. Ejecutar `reopen-host.sh` solo después de validar; exige cero salas y reinicia con nuevas asignaciones habilitadas. El coordinador puede esperar hasta 15 s para aceptar una nueva encarnación.

Gateway y coordinador únicos requieren mantenimiento o tolerancia de reconexión: no prometer actualización sin interrupción. No activar autoscaling con sesiones activas.

## 7. Rollback

Si el nuevo worker no pasa salud, mantenerlo drenado, detenerlo y restaurar el symlink anterior en `/srv/redhorizon-cluster/current`; reiniciar, verificar salud y luego reabrir. `activate.sh` revierte automáticamente solo si systemd falla al iniciar; fallos funcionales requieren esta comprobación explícita. No se recuperan partidas si se fuerza una parada con salas activas.

Un cambio de protocolo incompatible requiere versión nueva y recarga de clientes. Esta implementación conserva el protocolo existente y añade un campo opcional de ruta en welcome.

Rollback de migración: restaurar DNS hacia la principal y su servicio/Caddy original, que deben conservarse hasta aprobar el cambio. Las salas del clúster no se transfieren al legado. Conservar copia del registro DNS anterior y TTL real antes de modificarlo.

## 8. Cifrado del disco principal

El volumen actual no puede cifrarse in situ. Planificar snapshot consistente, copia cifrada y volumen gp3 de destino en la misma AZ, conservando el volumen viejo para rollback. Requiere parada/control de montajes, verificación del arranque, filesystem y aplicación. Estimar snapshot y volumen coexistente antes de ejecutar. No declarar toda la flota cifrada mientras este paso siga pendiente.

## 9. Apagado y costos residuales

```sh
python3 scripts/cluster/stop-lab.py
# Solo tras drenaje y dentro del horario aprobado:
python3 scripts/cluster/stop-lab.py --execute
```

Solo selecciona los cuatro nodos nuevos etiquetados y excluye los tres IDs existentes. Detener gateway/coordinador interrumpe el servicio nuevo: volver al legado primero si ya se migró DNS. Los discos siguen facturando y las IP públicas automáticas cambian al arrancar. Regenerar inventario, certificados si cambian IP privadas y config cuando corresponda.

Retain y protección contra terminación impiden tratar `delete-stack` como limpieza completa. Para retirada definitiva, revisar inventario, respaldos, volúmenes, llaves públicas y roles; eliminar únicamente recursos nuevos autorizados. No automatizar borrado de recursos existentes.
