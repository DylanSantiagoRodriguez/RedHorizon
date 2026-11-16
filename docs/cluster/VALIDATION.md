# Evidencia local — 16 de noviembre de 2026

## Resultados ejecutados

- `npm run check`: **191 pruebas en 38 archivos**, ESLint y build aprobados en la ejecución final (18:24 Bogotá).
- Integración de clúster: Redis real y WebSockets con mTLS. Cobertura de distribución, dos jugadores en la misma sala, reconexión sin coordinador, certificados no autorizados, rutas arbitrarias, reservas concurrentes/expiradas, replay, encarnaciones, drenaje, fallo de worker y abuso con tráfico legítimo.
- `npm run test:cluster:browser`: **1 escenario aprobado**, tres contextos Chromium, 33,5 s. Creación/unión, distribución, inicio compartido y recarga/reconexión durante caída del coordinador.
- `npm run test:online`: **2 escenarios aprobados**, 39,1 s. Expedición cooperativa completa y reintento de conexión. Conserva regresiones del modo previo.
- `nginx -t`: plantilla renderizada con certificados de prueba, sintaxis válida. No se inició un Nginx permanente ni se probó aún TLS público de AWS.
- CloudFormation `validate-template`: infraestructura y rol aceptados. Esto verifica estructura básica, **no** ejecución ni permisos suficientes para aprovisionar.
- Sintaxis Python/Bash y `git diff --check`: correctos.
- Artefacto inspeccionado: sin archivos PEM/KEY ni tests; dependencias de producción instaladas fuera de las EC2.

## Artefacto de revisión

Ruta local: `.cluster-local/artifacts/redhorizon-cluster-20261116T232422Z.tar.gz`.

SHA-256: `6b6e8c5863e00968c539ccb4affebda30fc159d98f6dd49fa6ad20d26eb76732`.

Manifiesto: `{"commit": "fe29dd62d420bd961e05b0ae8df37fd5d41743bf-worktree", "builtAt": "2026-11-16T23:24:22.002Z"}`.

Es un artefacto de checkout modificado (`-worktree`), no una publicación aprobada. Las versiones anteriores en .cluster-local son borradores y no deben desplegarse.

## Medición local limitada

Tres workers y seis clientes en un mismo proceso de prueba en el Mac, aproximadamente 10.45 s. RTT p95 observado 22.53 ms con polling de 20 ms. CPU/RSS son compartidos por el proceso y **no se interpretan como capacidad de tres EC2 independientes**. La prueba no representa combate sostenido a máxima carga ni agotamiento de créditos T3.

El build advierte sobre un bundle mayor de 650 kB. Se observó un EPIPE en Vite al cerrar el escenario de clúster; el escenario pasó y la conexión ya se estaba cerrando. La suite previa también muestra el aviso existente de Three.js sobre PCFSoftShadowMap.

## Producción y pendientes

Última consulta pública: `/health` devuelve ok y buildId `fe29dd62d420bd961e05b0ae8df37fd5d41743bf`. AWS sigue mostrando solo las tres instancias originales, encendidas. No se cambiaron DNS, reglas SG, perfil IAM, servicios productivos o instancias.

Pendientes tras presupuesto: crear cuatro nodos, configurar IAM con MFA y SSM, instalar certificados de servicio y HTTPS público, validar Linux/systemd, medir capacidad real, probar aislamiento de red y rollback en EC2, completar el cifrado del disco principal durante mantenimiento y aprobar el cambio de DNS. No se declara terminada la migración ni verificada la operación extremo a extremo en AWS.

Para las pruebas se instalaron Redis y Nginx mediante Homebrew, sin habilitar servicios permanentes. Las claves temporales de prueba se eliminaron. `llaveredhorizon` tiene modo 700 y la llave existente `redhorizon.pem` conserva su modo 400. Las cuatro nuevas PEM de AWS aún no se generaron; el script preparado las guarda con modo 600 en esa carpeta.
