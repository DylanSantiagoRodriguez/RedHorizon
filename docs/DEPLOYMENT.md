# Despliegue cooperativo en EC2

Sitio: https://redhorizon.lat. EC2 (`3.138.154.61`, usuario SSH `ubuntu`) aloja **Node.js y Caddy**. Los jugadores y las pruebas gráficas ejecutan sus navegadores en equipos externos. No se ejecuta Chromium en producción: compartir la VM de dos núcleos con dos clientes 3D provocaba contención y expiraciones durante las comprobaciones.

## Publicar una revisión de main

Desde un equipo con capacidad gráfica, Node 22.12 o superior, dependencias de Playwright y la llave SSH:

```sh
bash scripts/deploy-ec2.sh
```

El checkout debe estar limpio y HEAD debe coincidir con `origin/main`. El script instala las dependencias exactas y ejecuta `npm run check`, integración, los dos escenarios cooperativos con backend real y el smoke de la compilación individual **en el equipo externo**. Los escenarios incluyen combate, reconexión, baliza y victoria con preparación controlada; no exponen utilidades administrativas en producción.

Solo después de aprobarlos se instala por SSH una constancia del commit exacto en `/var/lib/redhorizon-validation/<commit>.json`. Es propiedad de root, no modificable por el usuario de despliegue y válida durante 24 horas. Una revisión distinta, una constancia incompleta, caducada o con permisos inseguros no autoriza la publicación. No es un flag para omitir pruebas: el script la genera únicamente después de ejecutar todas las comprobaciones.

El timer sigue consultando main cada minuto. Una revisión sin constancia espera conservando la release actual. Una revisión ya publicada se omite. Para una revisión verificada, EC2 vuelve a ejecutar las pruebas Node, lint y compilación, prepara frontend y backend juntos y valida su salud antes de activar. Este flujo no depende de que GitHub Actions esté disponible; el workflow de CI permanece preparado para ejecutar las suites en un runner externo. Los cambios en main necesitan la validación externa antes de publicarse.

## Instalación y configuración

```sh
bash scripts/configure-ec2.sh
```

Instala las unidades y scripts revisados, valida Caddy/systemd en Linux y habilita el timer. La llave permanece fuera del repositorio. Para otro destino:

```sh
DEPLOY_HOST=ubuntu@NUEVA_IP DEPLOY_KEY=/ruta/redhorizon.pem bash scripts/configure-ec2.sh
```

La configuración del backend está en `/etc/redhorizon/backend.env`, basada en `deploy/ec2/backend.env.example`. `WS_ORIGINS=https://redhorizon.lat` es obligatorio en producción. El proceso escucha únicamente en `127.0.0.1:8787`; Caddy publica `/ws` mediante WSS y `/health` mediante HTTPS. No abrir 8787, 4173, 5173, 8080 ni 2019 a Internet. Las entradas públicas son TCP 80/443 y SSH 22 restringido al origen administrativo. Cambiar reglas del security group no requiere reiniciar la VM.

`redhorizon-backend.service` usa un usuario sin privilegios, reinicio automático y límite independiente de 1 GiB. El trabajador de compilación tiene 2 GiB, una cuota de una CPU, CPUWeight=25 y Nice=10. Son límites operativos, no una capacidad certificada de salas. Las frecuencias iniciales son 60 Hz de simulación y 20 Hz de snapshots; medir antes de aumentar la carga.

## Releases y rollback

Cada release en `/srv/redhorizon/releases/<fecha>-<commit>` contiene los archivos estáticos y `runtime/` con `server/`, `src/`, manifiestos y dependencias instaladas mediante `npm ci --omit=dev --ignore-scripts`. Caddy deniega `/runtime` y sus descendientes. El checkout de compilación en `/var/lib/redhorizon-deploy/repo` es desechable; el script privilegiado instalado está fuera de él en `/usr/local/lib/redhorizon`.

El backend empaquetado se comprueba primero en loopback 8789. Después se cambia atómicamente `/srv/redhorizon/current` y se escribe `/srv/redhorizon/backend-restart`. Una unidad systemd.path ejecuta un reinicio fijo sin conceder sudo al usuario de despliegue. La activación exige que `/health.buildId`, `runtime/release.json.commit` y `/deployment.json.commit` coincidan. Un fallo restaura la release anterior y verifica su backend. Se conservan cinco releases más la anterior si resulta necesario.

Una release antigua solo estática se reconstruye aunque ya tenga el commit solicitado. El backend solo arranca cuando existe `current/runtime/server/main.js`. Un rollback a una release estática conserva individual, pero no ofrece cooperativo.

SIGTERM avisa a los clientes y libera sockets y salas. **Las salas en memoria se pierden al reiniciar o desplegar.** Los 30 segundos de reconexión solo se aplican mientras vive el mismo proceso. No hay continuidad ni migración de salas entre releases. Incrementar PROTOCOL_VERSION/GAME_VERSION cuando cambien contratos o reglas incompatibles; el cliente recibe VERSION y debe recargar.

## Comprobación pública y operación

La prueba pública se ejecuta desde un equipo externo, usa dos contextos independientes y no usa fixtures ni globals QA:

```sh
SMOKE_URL=https://redhorizon.lat node scripts/smoke-online-production.mjs
```

Comprueba creación/unión, preparación, movimiento, enemigos y proyectiles compartidos, Escape local, recuperación de identidad al recargar y salida. La misión completa acelerada se verifica previamente en la suite cooperativa.

```sh
sudo systemctl status redhorizon-backend redhorizon-backend-restart.path
sudo systemctl list-timers redhorizon-deploy.timer
sudo journalctl -u redhorizon-deploy.service -n 80 --no-pager
curl -fsS http://127.0.0.1:8787/health
curl -fsS https://redhorizon.lat/health
curl -fsS https://redhorizon.lat/deployment.json
curl -I https://redhorizon.lat/runtime/package.json # 404
```

El servicio de despliegue es oneshot: `inactive` tras una ejecución correcta es normal; backend y timer deben seguir activos. Para rollback manual, sustituir RELEASE_ANTERIOR por un directorio existente:

```sh
sudo systemctl stop redhorizon-deploy.timer redhorizon-deploy.service
sudo ln -s /srv/redhorizon/releases/RELEASE_ANTERIOR /srv/redhorizon/rollback
sudo mv -Tf /srv/redhorizon/rollback /srv/redhorizon/current
sudo systemctl restart redhorizon-backend
curl -fsS https://redhorizon.lat/health
```

Corregir o revertir main, validar la revisión con `scripts/deploy-ec2.sh` y reactivar el timer. Conservar `/var/lib/caddy` para los certificados y revisar espacio de disco y journal. `www` redirige al dominio principal. DNS actual: `A @ → 3.138.154.61`, `CNAME www → redhorizon.lat`; si cambia la IP, actualizar DNS y DEPLOY_HOST.
