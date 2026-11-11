# Corrección del consumo de memoria durante el despliegue — 11 de noviembre de 2026

La integración del entorno añadió texturas de 4096×4096. En EC2, dos contextos de Chromium superaron los límites del trabajador de 2 GiB y posteriormente 5 GiB (`oom-kill` en el journal). La calidad baja ahora limita las texturas GLB a 1024 píxeles al cargarlas, comparte la imagen reducida entre materiales y cierra el bitmap original. Conserva geometría, reglas físicas y resolución original en calidad alta.

Validación local después del ajuste: `npm run check` correcto, 171 pruebas en 35 archivos, ESLint y build. `npx playwright test --config deploy/ec2/playwright.config.mjs`: dos escenarios correctos en 2,5 minutos, incluidos carga del entorno real, resolución de texturas, combate, reconexión, lanzamiento y victoria con preparación controlada. Un intento anterior fue interrumpido por suspensión del Mac y no cuenta como validación. El despliegue vuelve a ejecutar las suites en EC2 antes de activar; consultar el journal para el resultado de cada revisión y ejecutar el smoke público documentado en DEPLOYMENT.md.

Las verificaciones históricas siguientes conservan sus recuentos y alcance originales.

# Corrección del arranque local y del reintento inicial

Se reprodujo el fallo con Vite en 5174 y sin backend en 8787. `npm run dev` ahora inicia ambos servicios y configura el Origin con el puerto realmente asignado por Vite. `dev:frontend` permite utilizar un backend iniciado por separado. Una conexión que nunca recibió identidad ya no anuncia una sala expirada y se puede reintentar desde la misma pantalla; una identidad recuperada tras recargar conserva su token durante los reintentos.

Validación de esta corrección: `npm run check` correcto (158 pruebas, ESLint y build); `npm run test:integration` correcto (36 pruebas, incluidas en las 158); `npm run test:online` correcto (dos escenarios, expedición cooperativa y reintento tras un fallo inicial). Las regresiones de desarrollo ocupan el puerto solicitado, verifican el fallback de Vite mediante WebSocket real, conservan una lista explícita de Origin y prueban limpieza ante un backend ocupado. También se comprobó creación, unión, preparación e inicio de dos jugadores a través de `http://127.0.0.1:5174`, y la continuidad del proxy tras reiniciar Vite.

Las 27 pruebas individuales indicadas en la sección siguiente pertenecen a la validación previa; no se repitieron para esta corrección de arranque y conexión. No se modificó la simulación ni se desplegó infraestructura.

# Validación del cooperativo — 11 de noviembre de 2026

Resultados locales sobre esta implementación (macOS arm64, Node v26.11.1, Chromium de Playwright):

| Comando / comprobación | Resultado |
| --- | --- |
| `npm run check` | ESLint correcto, 152 pruebas Vitest correctas (29 archivos), build Vite correcto |
| `npm run test:integration` | 30 pruebas online correctas (3 archivos); son un subconjunto de las 152 |
| `PLAYWRIGHT_PORT=5181 npm run test:e2e` | 27 escenarios individuales correctos, aproximadamente 5 minutos |
| `npm run test:online` | Escenario cooperativo correcto, dos contextos independientes y backend real, aproximadamente 1,1 minutos |
| Runtime empaquetado con `npm ci --omit=dev --ignore-scripts` | Arranque en producción, health/buildId, ausencia de rutas de pruebas y cierre SIGTERM correctos |
| `bash -n` sobre scripts de despliegue | Correcto |
| Caddy/systemd, EC2 y dos redes públicas | No ejecutados; procedimiento preparado |

La prueba online cubre sala/código normalizado, apodos como texto, preparación e inicio, avatares independientes, movimiento remoto, combate compartido, menú Escape local, corte/reconexión sin duplicar jugador, recuperación tras recargar, estadísticas base pese a blindaje local y guardado individual intacto, guardianes/gemas, lanzamiento por el segundo participante y victoria. La preparación de combate y los relojes del final se aceleran mediante un proceso de fixture que no se incluye en las releases. Vitest comprueba además 60+24 segundos completos de simulación, plazo real de mejoras, tokens, límites y atribución de daño. No equivale a una expedición manual sin ayudas entre redes distintas.

En las primeras ejecuciones se detectó y corrigió un acceso al historial vacío durante reconexión, y el fallback de altares antes de inicializar miembros. Se aisló el puerto de Vite de otros proyectos locales y se repitieron las suites sin ejecuciones simultáneas que compartieran artefactos de Playwright. Los resultados de la tabla corresponden a las ejecuciones finales correctas. Chromium mantiene un aviso previo de Three.js sobre `PCFSoftShadowMap`; las pruebas no detectaron errores de JavaScript/WebGL.

Ver [MULTIPLAYER.md](MULTIPLAYER.md) para comandos, microbenchmark, latencia, límites y pruebas manuales pendientes; [DEPLOYMENT.md](DEPLOYMENT.md) para instalación/rollback. Las secciones siguientes conservan evidencia histórica del modo individual y sus recuentos anteriores.

# Verificación y evidencias

## Entorno

Sesión local de Windows, Node 24.21.0, npm 11.19.0, Chromium instalado por Playwright. Fecha local: 9 de noviembre de 2026. Todas las pruebas son locales. No se ha desplegado el proyecto.

## Comandos reproducibles

```sh
npm install
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Con `npm run dev -- --port 5173` activo:

```sh
node scripts/benchmark.mjs
node scripts/simulate.mjs
```

El benchmark necesita Vite; la simulación no usa navegador ni Three.js. Sus resultados se escriben en `docs/qa/`. El modo de inspección `/?qa` expone `window.__RED_HORIZON__` exclusivamente en desarrollo mediante `import.meta.env.DEV`; no existe en el build de producción.

## Lógica automatizada

La batería incluye pruebas en 8 archivos; los resultados finales se indican en el cierre de este documento.

| Archivo | Qué verifica |
|---|---|
| core.test.js | Semilla, transiciones válidas/inválidas y límite de recuperación del loop |
| player.test.js | Salto, rechazo de salto aéreo, aterrizaje, obstáculos, impacto barrido, daño y muerte |
| world.test.js | Reproducción de terreno/rocas, diferencia entre semillas y separación transitable |
| combat.test.js | Críticos, muerte única, proyectil real, cadencia, robo de vida efectivo y explosión única |
| director.test.js | Presión temporal, variedad, límite de horda, derrota y reinicio |
| progression.test.js | Excedentes de XP, niveles pendientes, ofertas, 15 mejoras y límites |
| content.test.js | Pulso, enfriamiento, interacción única, jefe de dos fases, invocación, victoria y tres armas |
| save.test.js | Persistencia, compra de blindaje, coste, almacenamiento corrupto/bloqueado |

`npm audit` y `npm audit --omit=dev` informaron **0 vulnerabilidades**. ESLint 9.39.5 funciona pero npm informa que está fuera de soporte; se eligió porque la versión 10 instalada inicialmente tenía un aviso de dependencia vulnerable. Revisar una actualización corregida antes de mantenimiento a largo plazo.

## Navegador

`tests/browser/game.spec.js` contiene escenarios de:

1. Carga, movimiento con teclado, observación de salto, pausa sin avance de tiempo, daño letal y reinicio.
2. Controles, calidad, asistencia y persistencia después de recargar.
3. Baja causada por un proyectil del arma, XP, tres ofertas, elección y Q.
4. Interacción con los tres relés, jefe, fase II, victoria por proyectiles y nueva expedición.
5. Colisiones de jugador/cámara y tres reinicios comprobando estabilidad del número de geometrías.

Cada escenario escucha errores de consola y excepciones de página. Los escenarios 3 y 4 preparan objetivos con posiciones y vida controladas mediante el acceso QA; la selección de menú y el disparo usan la ruta normal de juego. No se presentan como partidas humanas completas ni como pruebas de balance del jefe con 4200 HP.

Última ejecución completa de Playwright: **5 pruebas correctas en 1,4 minutos**, sin errores de consola ni excepciones. Se comprobó colisión de cámara con los obstáculos ya agrupados, y el número de geometrías permaneció estable tras tres reinicios.

Capturas generadas por las pruebas:

- [Menú](screenshots/menu.png)
- [Juego](screenshots/gameplay.png)
- [Mejoras](screenshots/upgrades.png)
- [Jefe](screenshots/titan.png)
- [Victoria](screenshots/victory.png)

Se inspeccionaron visualmente menú, juego, mejoras y jefe. La revisión llevó a desplazar la cámara al hombro, despejar la mira y mejorar el contraste del HUD. No se realizó una evaluación auditiva humana de los sonidos; se validan creación y ejecución del código de Web Audio sin excepciones.

## Rendimiento medido

Prueba local a **1920×1080**, 64 enemigos, muestras de seis segundos por calidad. El navegador reporta **ANGLE / SwiftShader Device (Subzero)**: renderizado por CPU. No es una prueba de GPU de gama media.

| Medida | Antes alta | Después alta | Antes baja | Después baja |
|---|---:|---:|---:|---:|
| FPS medio | 3,9 | 5,3 | 4,0 | 5,7 |
| Frame p95 (ms) | 266,7 | 200,0 | 266,7 | 183,4 |
| Draw calls | 1097 | 200 | 388 | 93 |
| Triángulos | 108576 | 126284 | 84948 | 94120 |

Evidencia: [antes](qa/benchmark-before.json), [después](qa/benchmark.json). La agrupación redujo draw calls; el triángulo de entidades compactadas se evalúa como bloque y puede aumentar los triángulos visibles frente al culling de piezas individuales. El benchmark usa enemigos quietos, sin toda la carga de combate/partículas y con invulnerabilidad para conservar el escenario. No representa el peor caso completo ni una medición estadística extensa.

**No se ha cumplido ni certificado el objetivo de 60 FPS en este entorno de software.** Para validarlo, ejecutar en un navegador con GPU, repetir el benchmark y hacer una sesión de combate real con efectos. Un build correcto no demuestra rendimiento.

## Simulación completa

`scripts/simulate.mjs` ejecuta tres semillas con un piloto de QA, estadísticas normales, terreno/rocas reales, puntería perfecta, movimiento automatizado y elección automática de módulos. No usa curaciones de suministros ni adelanta al jefe con relés. El registro está en [simulation.json](qa/simulation.json).

Las simulaciones previas al ajuste completaron las tres expediciones, pero acumularon 48–59 niveles; esto motivó un umbral cuadrático y correcciones de daño/robo de vida. Después del ajuste, el piloto que siempre atacaba al enemigo más cercano ganó dos semillas y agotó 12 minutos en la tercera sin morir: seguía eliminando minions e ignorando al jefe. Se modificó la estrategia del piloto para priorizar al Titán después de su aparición, sin cambiar estadísticas del juego. Los resultados finales del archivo JSON corresponden a la última ejecución del script, no a una prueba humana.

Resultados finales con prioridad al jefe, daño y vida normales:

| Semilla | Resultado | Tiempo simulado | Bajas | Nivel | Vida mínima |
|---|---|---:|---:|---:|---:|
| ASTER-09 | Victoria | 428,4 s | 487 | 20 | 77 |
| RED-2026 | Victoria | 371,3 s | 517 | 20 | 112,6 |
| DUST-42 | Victoria | 385,3 s | 669 | 23 | 85 |

Las tres alcanzaron el límite de 64 enemigos y redujeron a cero los 4200 HP originales del jefe. Esto demuestra recorrido mecánico completo en esas semillas con el piloto descrito, no balance humano garantizado.

## Criterios de aceptación y límites

| Criterio | Evidencia |
|---|---|
| Instalar y ejecutar Vite | Instalación npm, servidor local y pruebas de carga |
| Carga sin errores críticos | Listeners de consola/excepciones en Playwright |
| Movimiento y salto | player.test y entrada real de teclado en Chromium |
| Cámara y colisiones | Raycaster implementado, pruebas físicas y escenario de cámara |
| Enemigos aparecen/atacan | Director/AI en simulación y pruebas de daño |
| Causar/recibir daño y matar | combat/player tests y escenario de proyectil real |
| XP y selección de mejoras | progression tests y elección visible en Chromium |
| Dificultad creciente | director.test y simulación temporal |
| Derrota, jefe, victoria y reinicio | content/director tests y escenarios de navegador |
| Pruebas implementadas pasan | Comandos y resultados de esta sesión; ver cierre final |
| Completar una expedición | Simulación automática; victoria abreviada en navegador |

No se conocen bloqueos críticos tras las comprobaciones indicadas, pero eso no prueba ausencia de errores en todas las semillas o navegadores. Pendientes explícitos: juego humano de principio a fin, validación de audio percibido, GPUs distintas, Firefox/Safari y adaptador GLTF con un recurso real.

## Cierre de verificaciones

- `npm run lint`: correcto, sin errores.
- `npm test -- --reporter=default --reporter=json --outputFile=docs/qa/unit-tests.json`: **28/28 pruebas correctas, 8 archivos**. [Informe JSON](qa/unit-tests.json).
- `npm run build`: correcto; aproximadamente 615 KB de JavaScript antes de gzip (Three.js separado), 16 KB de CSS.
- `npm run test:e2e`: **5/5 escenarios correctos**, sin errores de consola/WebGL o excepciones.
- `npm audit` y auditoría de producción: cero vulnerabilidades en la ejecución registrada.
- Capturas revisadas: menú, juego, mejoras, jefe y victoria.
- El objetivo de 60 FPS continúa sin validación en GPU; la medición de SwiftShader no lo cumple.

## Errores encontrados y corregidos

- Incompatibilidad `manualChunks` con Vite 8: función en lugar de objeto.
- Expresión exponencial y comparación `-0` en terreno: corregidas.
- Exceso de draw calls: instancias de escenario y anatomías compactadas de enemigos.
- Doble daño de lanzador y robo de vida sobre exceso de daño: pruebas de regresión.
- Posible resultado terminal sobrescrito durante el mismo tick: detener daño después de victoria/derrota.
- Limpieza incompleta de buffers de instancias: `dispose()` por sesión.
- Tests iniciales de navegador: se corrigió sincronización de salto, objetivo de puntería y XP esperada por relé; se mantuvieron los criterios funcionales.
