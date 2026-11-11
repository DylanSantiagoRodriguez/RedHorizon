# Evolución del despliegue para cooperativo

La configuración cooperativa se instala en EC2 mediante `scripts/configure-ec2.sh`. La instalación de las unidades no implica que una release esté activa: comprobar el servicio y que `/health.buildId` coincida con `/deployment.json.commit`. Las validaciones impiden publicar una revisión que falle las pruebas.

Cada release mantiene los archivos estáticos en su raíz e incluye `runtime/` con `server/`, `src/`, manifiestos y `npm ci --omit=dev --ignore-scripts`. Caddy deniega `/runtime` y sus descendientes y reenvía `/ws` y `/health` a `127.0.0.1:8787`; HTTPS aporta wss. No abrir el puerto Node al exterior. `redhorizon-backend.service` usa un usuario propio sin privilegios y `/etc/redhorizon/backend.env` (plantilla `backend.env.example`). En producción WS_ORIGINS es obligatorio y debe enumerar exactamente los orígenes permitidos.

`deploy-main.sh` ejecuta check, integración, navegador online real y smoke de la compilación antes de activar. Luego valida el backend **empaquetado** en 8789, cambia atómicamente `current`, toca `/srv/redhorizon/backend-restart` y espera que `/health` informe el commit esperado. Una unidad systemd.path activa un servicio fijo de reinicio; el usuario de despliegue no recibe sudo. Fallar restaura el enlace anterior, solicita otro reinicio y comprueba la salud anterior. Frontend y backend pertenecen a la misma release; durante el breve reinicio puede haber desconexión. Los clientes incompatibles reciben VERSION y deben recargar. Incrementar PROTOCOL_VERSION/GAME_VERSION al cambiar contratos/reglas incompatibles.

El perfil `deploy/ec2/playwright.config.mjs` ejecuta los mismos escenarios online con calidad baja, ventana de 960×600 y hasta seis minutos por escenario porque EC2 renderiza Chromium por CPU. No cambia los plazos del servidor. La preparación de pruebas inicia los encuentros de forma explícita para que la carga del navegador no cause daño antes de las comprobaciones.

Primera migración desde releases solo estáticas: instalar las unidades, plantilla y Caddyfile desde una copia revisada usando el procedimiento de instalación existente. Una release estática se reconstruye aunque su commit ya coincida con `main`; solo se omite cuando también existen el backend y su manifiesto coincidente. El backend solo arranca cuando existe `current/runtime/server/main.js`. Un rollback a una release estática conserva individual, pero **no** ofrece online. No se garantiza disponibilidad continua durante activación ni rollback. Las releases posteriores permiten validar ambos componentes juntos.

SIGTERM avisa a los clientes, cierra WebSocket y limpia salas/timers. El estado en memoria **no sobrevive** despliegues, fallos o reinicios. La reconexión de 30 segundos solo funciona mientras vive el mismo proceso. Comunicar mantenimientos; no prometer migración o continuidad de expediciones.

Validación operativa después de instalar:

```sh
sudo systemctl status redhorizon-backend redhorizon-backend-restart.path
sudo journalctl -u redhorizon-backend -n 80 --no-pager
curl -fsS http://127.0.0.1:8787/health
curl -fsS https://redhorizon.lat/health
curl -I https://redhorizon.lat/runtime/package.json # debe devolver 404
```

La comprobación pública reproducible usa dos contextos independientes, sin fixtures ni acceso QA:

```sh
SMOKE_URL=https://redhorizon.lat node scripts/smoke-online-production.mjs
```

Crea una sala temporal, comprueba movimiento, disparos, enemigos compartidos, Escape local y recuperación de identidad al recargar; al terminar abandona la sala. La expedición completa con preparación controlada se comprueba durante las pruebas previas a publicar.

Para rollback manual, detener el timer, cambiar `current` como se describe abajo, ejecutar `sudo systemctl restart redhorizon-backend` y validar que `/health.buildId` coincide con `current/runtime/release.json`. Reiniciar también la unidad backend es obligatorio; cambiar únicamente el enlace deja al proceso anterior ejecutándose. Las salas activas se pierden en ambos sentidos.

Antes de publicar: comprobar scripts con `bash -n`, unidades con `systemd-analyze verify` en Linux, Caddyfile con `caddy validate`, y ejecutar las suites en la máquina objetivo. La instalación valida Caddy y las unidades systemd en el host Linux; después de cada publicación hay que comprobar también HTTPS y WebSocket públicos. Las cuotas configuradas no equivalen a una capacidad probada: medir CPU, cola y ancho de banda antes de elegir MAX_ROOMS. Ver [MULTIPLAYER.md](MULTIPLAYER.md).

# Producción y despliegue automático

Sitio: https://redhorizon.lat. `www` redirige al dominio principal; Caddy gestiona HTTPS y la renovación del certificado.

## Flujo de un PR

1. Abrir o actualizar un PR dirigido a `main` ejecuta `.github/workflows/ci.yml`: ESLint, pruebas unitarias, compilación y prueba de la compilación en Chromium (personaje, recursos, inicio, pausa y continuación).
2. Al fusionar el PR, el `push` a `main` también solicita CI en GitHub. Los pushes directos a `main` siguen el mismo proceso.
3. El timer `redhorizon-deploy.timer` consulta `main` cada 60 segundos y descarga el commit exacto que se publicará.
4. El EC2 ejecuta `npm ci`, `npm run check`, integración online, dos escenarios cooperativos de Chromium y la prueba de producción contra un preview local. Todas deben pasar antes de preparar una release. Si `main` cambia durante la validación, espera al siguiente ciclo.
5. Se activa la release mediante un cambio atómico de `/srv/redhorizon/current`. Se verifica HTTP interno y HTTPS público; si fallan, se restaura el enlace anterior.

La publicación ocurre después del siguiente ciclo de consulta, más el tiempo de validación. Un PR abierto no reemplaza producción. Un fallo en descarga, instalación, pruebas, compilación o Chromium en el EC2 conserva la versión publicada. El timer vuelve a intentarlo en el siguiente ciclo. No hay alertas externas configuradas: revisar el journal del servicio.

La comprobación inicial de GitHub Actions fue rechazada antes de iniciar por un bloqueo de facturación de la cuenta: [ejecución](https://github.com/DylanSantiagoRodriguez/RedHorizon/actions/runs/42973008466). El despliegue no depende de Actions: ejecuta las mismas validaciones en el EC2. El workflow queda preparado para los PR y pushes cuando se resuelva la facturación. Un resultado de Actions no sustituye las comprobaciones obligatorias del servidor.

La automatización usa un usuario Linux sin sudo (`redhorizon-deploy`) y el repositorio público con acceso de lectura. No requiere secretos de GitHub, webhooks, runners dentro de producción ni puertos adicionales. No depende de que el equipo local esté encendido. El servicio solo escribe en sus directorios de compilación, caché y releases.

Las reglas de protección de la rama no se modifican: hacer obligatorio el check de GitHub para permitir un merge requiere configurarlo en GitHub después de resolver el bloqueo de Actions. La publicación siempre exige que las comprobaciones del EC2 terminen correctamente.

## Infraestructura

| Recurso | Valor |
|---|---|
| Repositorio | https://github.com/DylanSantiagoRodriguez/RedHorizon |
| Instancia | `i-040ec54792a8b4446`, Ubuntu, `us-east-2` |
| IPv4 / SSH | `3.138.154.61` / `ubuntu` |
| Security Group | `sg-005cf11f460d4bbea` (`launch-wizard-2`) |
| Archivos publicados | `/srv/redhorizon/current` |
| Releases | `/srv/redhorizon/releases/<fecha-UTC>-<commit>` |
| Checkout desechable | `/var/lib/redhorizon-deploy/repo` |
| Script instalado | `/usr/local/lib/redhorizon/deploy-main.sh` |
| Configuración web | `/etc/caddy/Caddyfile` |
| Versión pública | https://redhorizon.lat/deployment.json |

Se conservan cinco releases y, si hace falta, la release anterior adicional para recuperación. El modo individual se ejecuta en el navegador. El cooperativo requiere Node.js persistente en loopback, WebSocket mediante Caddy y salas en memoria. No utiliza base de datos; un reinicio pierde las salas.

## Puertos y DNS

| Entrada | Protocolo | Puerto | Origen |
|---|---|---|---|
| SSH | TCP | 22 | Tu IP pública `/32` |
| HTTP | TCP | 80 | `0.0.0.0/0` |
| HTTPS | TCP | 443 | `0.0.0.0/0` |

Mantener la salida predeterminada permitida para GitHub, npm, DNS, certificados y actualizaciones. No abrir 3000, 4173, 5173, 8080 ni 2019. Los dos últimos escuchan solo en loopback. Caddy usa HTTP/1.1 y HTTP/2, sin requerir UDP 443. No hay IPv6 configurado.

Porkbun: `A @ → 3.138.154.61`, `CNAME www → redhorizon.lat`. La IP actual es automática. Si se asocia una Elastic IP, actualizar el registro A y `DEPLOY_HOST` al ejecutar scripts desde el equipo local.

Fuentes: [reglas de AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html), [HTTPS de Caddy](https://caddyserver.com/docs/automatic-https), [eventos de GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Instalación o actualización de la infraestructura

El servidor debe tener `caddy`, `git`, `curl`, `nodejs` (22.12 o superior), `npm` y las dependencias de sistema de Chromium. Estas últimas se instalan una vez mediante `playwright install-deps chromium` desde una instalación de confianza de las dependencias del proyecto. El servicio descarga el navegador en `/var/cache/redhorizon-deploy/browsers`. La llave está fuera del repositorio y nunca se copia al servidor.

Desde una copia de confianza del repositorio:

```sh
bash scripts/configure-ec2.sh
```

Esto instala las unidades systemd, el script del servicio y el Caddyfile, habilita el timer e inicia una comprobación. Los cambios en `deploy/ec2` requieren ejecutar este comando: el servicio no se reescribe a sí mismo desde GitHub.

Para cambiar la llave o el destino:

```sh
DEPLOY_HOST=ubuntu@NUEVA_IP DEPLOY_KEY=/ruta/redhorizon.pem bash scripts/configure-ec2.sh
```

Para solicitar una comprobación y publicación inmediata, con las mismas validaciones:

```sh
bash scripts/deploy-ec2.sh
```

No sube cambios locales sin commit: producción siempre viene de `main` en GitHub.

## Operación y recuperación

```sh
ssh -i ../llaveredhorizon/redhorizon.pem ubuntu@3.138.154.61
sudo systemctl list-timers redhorizon-deploy.timer
sudo journalctl -u redhorizon-deploy.service -n 80 --no-pager
sudo systemctl status caddy
curl -fsS https://redhorizon.lat/deployment.json
```

El servicio es `oneshot`: es normal verlo `inactive` después de completar una ejecución; el timer debe permanecer `active`. `/deployment.json` muestra el commit publicado y la fecha UTC. Un commit que falle las validaciones del EC2 no llegará a ese archivo.

Para suspender publicaciones y volver a una release anterior (sustituir `RELEASE_ANTERIOR` por un directorio existente):

```sh
sudo systemctl stop redhorizon-deploy.timer redhorizon-deploy.service
sudo ln -s /srv/redhorizon/releases/RELEASE_ANTERIOR /srv/redhorizon/rollback
sudo mv -Tf /srv/redhorizon/rollback /srv/redhorizon/current
sudo systemctl restart redhorizon-backend
curl -fsS https://redhorizon.lat/health
curl -I https://redhorizon.lat
```

Corregir o revertir el commit en GitHub y reactivar con `sudo systemctl start redhorizon-deploy.timer`. Reactivar sin corregir `main` permite que el timer vuelva a publicar el mismo commit.

Conservar `/var/lib/caddy` para mantener los certificados. Revisar el espacio en disco y los logs periódicamente.
