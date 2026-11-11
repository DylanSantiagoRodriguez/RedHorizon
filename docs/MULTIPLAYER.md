# Cooperativo online

## Ejecutar y jugar

Node 22.12+ y WebGL2. `npm ci` y `npm run dev` inician Vite y el backend persistente; `npm run dev:online` conserva el mismo comportamiento. Abrir la URL que imprime Vite (por defecto `http://127.0.0.1:5173`). Si ese puerto está ocupado, Vite selecciona otro y el backend autoriza automáticamente el origen realmente utilizado, incluido su equivalente localhost/127.0.0.1. También se puede elegir uno con `npm run dev -- --port 5190 --strictPort`. Una lista explícita WS_ORIGINS se respeta sin ampliarla.

Por separado: `npm run server` y `npm run dev:frontend`. En ese caso configura WS_ORIGINS con el puerto real del frontend si difiere de 5173. Vite reenvía `/ws` y `/health` al backend loopback 8787; RH_BACKEND_PORT permite cambiarlo. El arranque conjunto falla claramente si ese backend ya está ocupado y cierra el frontend que acaba de iniciar, sin detener la otra instancia.

Si aparece `ECONNREFUSED 127.0.0.1:8787`, el backend no está escuchando: reinicia con `npm run dev` o inicia `npm run server` si mantienes un frontend separado. Un fallo antes de recibir identidad se muestra como servidor no disponible y permite reintentar Crear/Unirse en la misma pantalla. Solo una identidad previamente establecida está sujeta al plazo de reconexión de 30 segundos.

Menú → Multijugador → apodo opcional → Crear sala. Compartir el código de seis caracteres y pulsar Listo en cada equipo; el creador inicia con 2–4 conectados y listos. La otra persona usa Unirse con código. Los espacios y minúsculas se normalizan. El código no recupera identidades: solo permite incorporaciones al lobby.

Online no se usa ni modifica el blindaje, los fragmentos o los registros del guardado individual. Cada jugador comienza con estadísticas base. Armas, vida, pulso y aumentos son individuales. No hay fuego amigo. Las bajas dan XP de equipo una sola vez. Cada nivel pausa el combate para todos mientras cada jugador elige su propia oferta, hasta 15 segundos de reloj real. Al vencer se asigna la primera opción válida. Se conserva la protección de 700 ms tras soltar el disparo antes de seleccionar.

Los suministros curan al recolector; relés, altares, gemas y baliza se comparten. Cualquier jugador vivo puede lanzar la baliza con las cinco gemas. Morir permite observar al primer compañero vivo; no hay reanimación. Antes del lanzamiento se pierde cuando todos mueren o abandonan definitivamente. Después se conservan los 60 segundos de cuenta atrás y 24 de epílogo aunque muera todo el equipo.

Escape, pérdida de foco o de captura del ratón abren un menú **local**: el mundo continúa y el personaje sigue vulnerable. Una desconexión neutraliza entradas y disparo automático. El personaje permanece en la simulación; se puede reconectar durante 30 segundos desde que el servidor detecta la desconexión. El token aleatorio se guarda en sessionStorage de la pestaña, nunca en URL, lobby o snapshots. Tras recargar, abrir Multijugador recupera la identidad. Cerrar la pestaña elimina normalmente esa identidad temporal; no hay recuperación por correo. Se rechaza una segunda conexión activa con el mismo token. Si sale el creador, administra otro participante conectado.

## Organización y autoridad

- `WorldModel`: terreno, alturas, obstáculos, POI y suministros con IDs estables. Flujo aleatorio `-supplies` independiente de `-decoration`. `WorldManager` construye mallas sobre estos datos; no decide el mundo físico.
- `Run`: reglas comunes del jugador, combate, interacciones, recogida de gemas y avance de misión. `CoopRun` coordina jugadores, XP de equipo, derrota colectiva y ofertas individuales. Su adaptador síncrono `withPlayer` proporciona el contexto individual a los sistemas existentes; comparte una única IA, director, colección de enemigos, pool y misión. No crea partidas individuales por jugador.
- `CombatSystem`: ownerId de proyectiles y atacante explícito para daño, robo de vida y explosiones encadenadas. IA/jefes eligen un vivo próximo; zonas de área y melee de Dust revisan a todos los vivos. El director elige orígenes entre vivos y evita aparecer junto a otro jugador.
- `RoomManager`: permisos, identidad, colisiones de códigos, tiempos de gracia, vencimientos, entradas y snapshots. Un único proceso Node y mapas en memoria, sin BD.
- `server.js`: HTTP health, upgrade WebSocket, Origin, cuotas, heartbeat, backpressure, temporizador fijo y cierre controlado. `main.js` lee configuración y señales.
- `protocol.js` y `snapshot.js`: versiones explícitas y DTO de campos permitidos. `Connection`: transporte, heartbeat y reconexión progresiva. `OnlineGame`: predicción/reconciliación, búfer de interpolación de 100 ms, lobby, equipo y adaptación de snapshots al render existente.

Entradas secuenciadas: el servidor consume como máximo una entrada de cada jugador por paso fijo, confirma `ack` y mantiene el estado continuo hasta 250 ms sin entradas. Las acciones de un mensaje consumido no se vuelven a ejecutar. Una elección se identifica por ronda y solo se acepta una opción ofrecida una vez. El navegador no decide dt, posición, HP, daño, XP, recompensas, lanzamiento ni resultado. Predice únicamente el estado local mediante la física compartida y vuelve al snapshot antes de reproducir entradas pendientes. Los enemigos y los otros jugadores se interpolan; los proyectiles se presentan desde snapshots. Eventos con ID creciente impiden repetir audio/partículas; al reconectar se descartan efectos históricos. Un snapshot completo reconstruye misión, jugadores, enemigos, proyectiles e interactuables.

`PROTOCOL_VERSION=1`, `GAME_VERSION=coop-2`: incrementar la versión correspondiente cuando cambie el contrato o las reglas físicas que deben compartir cliente/servidor. Un cliente antiguo recibe un error antes de entrar. No se admite mezclar versiones dentro de una sala. La versión coop-2 incorpora las alturas de las arenas importadas, las colisiones de Aurora y la colección compartida de peluches.

## Balance y límites configurables

Frecuencias iniciales: simulación 60 Hz, snapshots 20 Hz. La carga de mensajes no acelera la simulación; el acumulador limita recuperaciones tras bloqueos a 250 ms. Bajo sobrecarga se pierde tiempo simulado en lugar de ejecutar pasos grandes; los plazos de mejora y reconexión siguen usando tiempo real.

HP de enemigos = HP individual × `[1 + HEALTH_PER_PLAYER × (jugadores al iniciar − 1)]`. Con 0,65: 2 jugadores 1,65×; 3, 2,30×; 4, 2,95×. El daño y la frecuencia de oleadas conservan su progresión individual. El tamaño del equipo queda fijado al inicio: desconectarse o abandonar no cura enemigos ni baja el escalado. Límites compartidos de 64 enemigos (reserva para los cinco guardianes), 220 proyectiles y 260 partículas por navegador.

Valores iniciales, **límites de protección, no capacidad medida**:

| Variable | Predeterminado |
| --- | --- |
| PORT (solo 127.0.0.1) | 8787 |
| WS_ORIGINS | origen real de Vite con npm run dev; localhost/127.0.0.1:5173 con npm run server; obligatorio en producción |
| TICK_HZ / SNAPSHOT_HZ | 60 / 20 |
| MAX_ROOMS / MAX_CONNECTIONS | 64 / 256 |
| MAX_CONNECTIONS_PER_IP | 12 |
| MAX_BUFFERED_BYTES | 1048576 |
| HEALTH_PER_PLAYER | 0.65 |
| TRUST_PROXY | 0; 1 únicamente detrás de Caddy local |

Payload máximo 4096 bytes, 150 mensajes/s/conexión, cola de 90 entradas, salto máximo de secuencia 180, 60 conexiones/min/IP, 40 accesos/min/IP y 8 creaciones/min/IP. Origin se compara con una lista exacta; no sustituye al token. Con TRUST_PROXY se utiliza la última IP añadida por el proxy loopback. No activar detrás de proxies no controlados. Los apodos se insertan con textContent. Los clientes con cola de salida excesiva se desconectan. Los lobbies vencen a los 15 minutos, expediciones a las 2 horas y resultados tras un minuto; sin participantes recuperables se limpia la sala. Un socket sin incorporarse se cierra en el heartbeat. Ping cada 10 segundos en servidor; entradas caducan en 250 ms; reconexión 300 ms–4 s con jitter hasta 30 segundos.

## Pruebas reproducibles

```
npm run check
npm run test:integration
npx playwright install chromium
npm run test:online
PLAYWRIGHT_PORT=5181 npm run test:e2e
node scripts/benchmark-online.mjs
```

La suite online inicia backend real en 18787, control de fixture en 18788 y Vite en 5179; los puertos deben estar libres. Son distintos del backend de producción (8787), para poder validar la siguiente release sin interrumpir las salas activas. Usa dos contextos Chromium independientes, lobby/preparación, movimiento observado por el compañero, daño compartido, Escape local, corte/reconexión, recarga de identidad, cinco guardianes, gemas, lanzamiento y victoria. La preparación acorta combate y final para que el escenario sea reproducible: no representa una expedición completa sin ayudas. Las duraciones reales 60+24 y los 15 s de mejora se prueban con pasos/reloj controlados en Vitest. `tests/browser/online-server.mjs` es un proceso de prueba separado; sus rutas de preparación no existen en `server/main.js`, el protocolo no admite comandos administrativos y las releases no copian `tests/`.

Las pruebas de integración cubren además capacidad/aislamiento, permisos/traspaso, tokens/expiración, mensajes inválidos/duplicados/cuotas, igualdad del mundo físico y visual, atribución de daño y curación, interacciones simultáneas, mejoras individuales/plazo, derrota colectiva, baliza/victoria y cierre. Las pruebas existentes del modo individual permanecen.

Microbenchmark ejecutado localmente en darwin/arm64, Node v26.11.1: una sala, cuatro jugadores, 59 stalkers, 3600 pasos; simulación media 0,472 ms/paso, p95 1,019 ms, máximo 36,645 ms; serialización media 0,274 ms, p95 0,562 ms; snapshot máximo 48263 bytes. No mide sockets, TLS, Internet, GPU ni carga de múltiples salas. JSON completo a 20 Hz tiene un coste de ancho de banda apreciable. Medir en la instancia objetivo antes de aumentar límites; no se ha certificado capacidad de salas.

## Dos equipos en redes distintas y latencia (procedimiento manual pendiente)

1. Instalar una release de prueba en un host HTTPS público siguiendo DEPLOYMENT.md, con dominio y Origin propios. Abrir únicamente 80/443; Node queda en loopback. Verificar `/health` y que la conexión del navegador es `wss://dominio/ws`.
2. Equipo A en su red habitual y equipo B en otra conexión (por ejemplo un hotspot móvil). Crear sala en A, compartir el código fuera del juego, unirse desde B, preparar e iniciar. Comprobar nombres, movimiento y enemigos comunes, daño/XP, recogida única de suministros y ofertas individuales.
3. En A pulsar Escape, cambiar de pestaña y liberar el puntero: B debe seguir moviéndose y sufriendo daño. Desconectar A unos 5 s; verificar en B que su personaje sigue presente/vulnerable, y al volver que no aparece un tercero. Repetir con recarga; luego superar 30 s y comprobar rechazo. Abandonar el creador y comprobar continuidad y administración transferida.
4. En un proxy de pruebas o emulador de red del sistema añadir 100–200 ms RTT y jitter de 30–50 ms. DevTools no aplica necesariamente su throttling HTTP a WebSocket; verificar latencia en la herramienta usada. Registrar correcciones visibles, RTT, bytes/s, retraso de snapshots y CPU del backend. Con latencia mayor que el timeout de entradas habrá frenadas; no se implementó compensación histórica de impactos.
5. Completar los cinco altares sin utilidades de prueba y lanzar desde B. Morir tras lanzar debe conservar cuenta atrás y epílogo. Reiniciar el backend en una sala aparte: se recibe aviso y se pierde la sala; no debe aparentar recuperación persistente.

No se han comprobado manualmente dos redes reales ni una expedición completa sin aceleración. Reconexión y misión sí se automatizan localmente. No hay continuidad entre reinicios/despliegues, migración de salas, reanimación, matchmaking, voz ni compensación de lag de disparos. El servidor es autoritativo, pero no pretende detectar bots o apuntado automatizado.

Al recargar una pestaña que conserva una identidad online, el cliente intenta recuperarla automáticamente antes de iniciar el bucle de renderizado. No exige volver a pulsar Multijugador. El servidor mantiene el plazo de 30 segundos y el personaje sigue siendo vulnerable. Una sala expirada muestra el error y permite volver al menú.

El heartbeat del navegador detecta pausas largas de su propio hilo y envía una sonda antes de cerrar el socket por falta de mensajes. Si no responde durante los 15 segundos siguientes, lo cierra. Esto no amplía el plazo de identidad del servidor ni el timeout de entradas: el personaje permanece vulnerable.
