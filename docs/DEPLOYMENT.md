# Producción y despliegue automático

Sitio: https://redhorizon.lat. `www` redirige al dominio principal; Caddy gestiona HTTPS y la renovación del certificado.

## Flujo de un PR

1. Abrir o actualizar un PR dirigido a `main` ejecuta `.github/workflows/ci.yml`: ESLint, pruebas unitarias, compilación y prueba de la compilación en Chromium (personaje, recursos, inicio, pausa y continuación).
2. Al fusionar el PR, el `push` a `main` vuelve a ejecutar CI sobre el commit exacto que se publicará. Los pushes directos a `main` siguen el mismo proceso.
3. El timer `redhorizon-deploy.timer` consulta `main` cada 60 segundos. Solo acepta un resultado exitoso del workflow `ci.yml`, evento `push`, para ese commit y esa rama.
4. El EC2 descarga el commit, ejecuta nuevamente `npm ci` y `npm run check`, y prepara una nueva release. Si `main` cambia durante la compilación, espera al siguiente ciclo.
5. Se activa la release mediante un cambio atómico de `/srv/redhorizon/current`. Se verifica HTTP interno y HTTPS público; si fallan, se restaura el enlace anterior.

La publicación ocurre normalmente en el siguiente minuto después de CI, más el tiempo de compilación. Un PR abierto no reemplaza producción. Un fallo en CI, instalación o compilación conserva la versión publicada; los errores de GitHub/red también impiden publicar. El timer vuelve a intentarlo en el siguiente ciclo. No hay alertas externas configuradas: revisar GitHub Actions y el journal del servicio.

La automatización usa un usuario Linux sin sudo (`redhorizon-deploy`) y el repositorio público con acceso de lectura. No requiere secretos de GitHub, webhooks, runners dentro de producción ni puertos adicionales. No depende de que el equipo local esté encendido. El servicio solo escribe en sus directorios de compilación, caché y releases.

Las reglas de protección de la rama no se modifican: CI aparece en los PR, pero hacer obligatorio ese check para permitir el merge requiere configurarlo en GitHub. La publicación sí espera a que CI termine correctamente aunque se haya permitido fusionar antes.

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

Se conservan cinco releases y, si hace falta, la release anterior adicional para recuperación. La aplicación se ejecuta en el navegador y guarda las partidas localmente; no utiliza base de datos ni backend de juego. Node.js se usa únicamente para comprobar y compilar.

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

El servidor debe tener `caddy`, `git`, `curl`, `nodejs` (22.12 o superior) y `npm`. La llave está fuera del repositorio y nunca se copia al servidor.

Desde una copia de confianza del repositorio:

```sh
bash scripts/configure-ec2.sh
```

Esto instala las unidades systemd, el script del servicio y el Caddyfile, habilita el timer e inicia una comprobación. Los cambios en `deploy/ec2` requieren ejecutar este comando: el servicio no se reescribe a sí mismo desde GitHub.

Para cambiar la llave o el destino:

```sh
DEPLOY_HOST=ubuntu@NUEVA_IP DEPLOY_KEY=/ruta/redhorizon.pem bash scripts/configure-ec2.sh
```

Para solicitar una comprobación inmediata, respetando el requisito de CI:

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

El servicio es `oneshot`: es normal verlo `inactive` después de completar una ejecución; el timer debe permanecer `active`. `/deployment.json` muestra el commit publicado y la fecha UTC. Un commit con CI fallida no llegará a ese archivo.

Para suspender publicaciones y volver a una release anterior (sustituir `RELEASE_ANTERIOR` por un directorio existente):

```sh
sudo systemctl stop redhorizon-deploy.timer redhorizon-deploy.service
sudo ln -s /srv/redhorizon/releases/RELEASE_ANTERIOR /srv/redhorizon/rollback
sudo mv -Tf /srv/redhorizon/rollback /srv/redhorizon/current
curl -I https://redhorizon.lat
```

Corregir o revertir el commit en GitHub y reactivar con `sudo systemctl start redhorizon-deploy.timer`. Reactivar sin corregir `main` permite que el timer vuelva a publicar el mismo commit.

Conservar `/var/lib/caddy` para mantener los certificados. Revisar el espacio en disco y los logs periódicamente.
