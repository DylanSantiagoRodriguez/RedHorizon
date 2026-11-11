# Arquitectura

## Responsabilidades

```text
src/
  core/          Game, Run, GameLoop, InputManager, StateManager
  graphics/      Renderer, CameraController, Models, EntityViews, ParticleSystem, AssetLoader
  world/         TerrainGenerator, WorldManager, DifficultyDirector
  entities/      Player, fábrica de Enemy
  combat/        DamageSystem, CombatSystem, WeaponSystem, AbilitySystem
  ai/            EnemyAI, BossController
  progression/   ExperienceSystem, UpgradeSystem, SaveSystem
  data/          armas, enemigos y mejoras
  physics/       CollisionSystem
  ui/            UI, HUD, Screens, estilos de interfaz
  audio/         AudioManager
  utils/         Random, ObjectPool
  config.js      límites y parámetros globales
```

`Game` conecta sistemas, gestiona estados de aplicación y ciclo de vida. `Run` contiene la simulación de una expedición y no importa Three.js ni el DOM. Los sistemas reciben la partida explícitamente; no hay un singleton global de producción. Los efectos se comunican mediante un callback `emit(event, data)`, suficiente para este alcance sin una infraestructura de eventos adicional.

`GameLoop` acumula tiempo a 60 pasos por segundo y limita la recuperación a seis pasos. El render se ejecuta mediante `WebGLRenderer.setAnimationLoop`. Si el equipo no puede seguir el ritmo, la simulación limita recuperación en lugar de dar saltos físicos grandes; el tiempo mostrado es tiempo simulado, no reloj real. Al pausar no se actualiza Run. La cámara se interpola, pero las entidades todavía se presentan en su último estado simulado.

Estados permitidos: menú → jugando → pausa/mejora/derrota/victoria. Pausa y mejora regresan a jugando; resultados permiten otra partida o menú. `StateManager` valida las transiciones. `Run.status` comunica resultados de simulación a `Game`, que es quien activa/desactiva entrada y pantallas.

## Mundo y física

`TerrainGenerator` crea una malla de alturas de 121×121 muestras en 240×240 m. El radio transitable es 90 m. El exterior contiene horizonte decorativo. `heightAt` interpola exactamente los triángulos de la malla usada para renderizar. Las dunas y depresiones no usan ruido no determinista.

Rocas y estructuras tienen volúmenes circulares conservadores en XZ. El jugador acelera, desacelera, integra gravedad y se apoya en el terreno. La resolución de colisiones se repite para contactos múltiples. Este modelo está destinado a un mapa de exterior, no a físicas rígidas arbitrarias o edificios transitables de varios pisos.

La cámara usa raycasts sobre superficies estáticas y mantiene margen respecto al terreno. El disparo parte del personaje y converge en el objetivo bajo la mira. Los proyectiles usan barrido segmento/esfera para enemigos y segmento/círculo para obstáculos, evitando saltarse blancos a alta velocidad.

La IA tiene Idle, Chase, Attack, Retreat, Stunned y Dead. Usa evasión tangencial de obstáculos más separación local entre enemigos. No implementa navegación global mediante navmesh; es adecuada para el campo abierto generado, pero puede atascarse temporalmente en geometría compleja.

## Datos y extensiones

### Añadir un arma

Añade una entrada a `src/data/weapons.js`: nombre, identificador corto, daño, intervalo, velocidad, alcance, número de proyectiles, dispersión, color, radio y radio de explosión. `WeaponSystem` y el HUD consumen esos datos. Para una cuarta tecla de selección, amplía el mapa de teclas de `Run.update`. Un modo de disparo radicalmente nuevo necesita un comportamiento adicional; no se oculta esa limitación tras la configuración.

### Añadir un enemigo

Añade estadísticas y `behavior`/`model` en `src/data/enemies.js`. Los comportamientos disponibles son melee, ranged y boss; modelos disponibles: crawler, brute, drone y titan. Ajusta las tablas temporales del director para introducirlo. Un comportamiento o rig nuevo se implementa en AI o Models, conservando el contrato del resto de sistemas.

### Añadir una mejora

Añade una entrada a `src/data/upgrades.js` con id único, nombre, icono, descripción, rareza, stat, amount y max. Para un efecto no representado en las estadísticas, añade primero su consumo al sistema correspondiente. `UpgradeSystem` excluye mejoras agotadas, evita duplicados y rechaza elecciones ajenas a la oferta actual. Agrega una prueba del efecto real.

### Importar GLB/GLTF

No se incluye ningún GLB externo. `src/graphics/AssetLoader.js` es un adaptador opcional que usa `GLTFLoader` y `AnimationMixer` reales. Para sustituir un modelo:

1. Obtén un archivo existente y verifica su licencia; añade atribución si procede.
2. Guarda el archivo en `public/models/` con su nombre real y comprueba que Vite lo sirve.
3. Llama a `loadAnimatedModel(urlReal)`, captura los errores y conserva el modelo procedural como alternativa.
4. Ajusta escala/origen y conecta los clips por sus nombres reales, consultando `actions`.
5. Ejecuta `update(dt)` y `dispose()` al terminar. Para múltiples rigs animados, clona con `SkeletonUtils` y administra cada mixer.

El adaptador no se usa en la partida predeterminada y no se ha validado con un recurso GLB externo.

## Recursos y rendimiento

- Geometrías y materiales de Models compartidos durante toda la aplicación.
- Pool fijo de 220 proyectiles y 260 partículas.
- Proyectiles, partículas y 450 piedras pequeñas mediante InstancedMesh.
- Reutilización de modelos de enemigos por tipo durante la partida.
- Máximo de 64 enemigos, reservando un espacio para el jefe.
- HUD actualizado a aproximadamente 12,5 Hz; máximo de 24 números de daño.
- Dispose explícito de instancias, geometrías y materiales propios al reiniciar; modelos compartidos al cerrar.
- Audio de osciladores desconectado al terminar; ruido ambiente compartido.
- Listeners cancelables y limpieza en hot reload.

`SaveSystem` es el único consumidor de localStorage. Guarda versión, estadísticas, fragmentos, blindaje y opciones; tolera datos corruptos o almacenamiento bloqueado. No guarda partidas activas.

El stalker carga `public/models/stalker.glb` con rigs independientes y recursos visuales compartidos. `StalkerActions` resuelve el contacto del ataque en el fotograma 12 (0,4 s a 30 FPS), validando alcance, altura y frente al golpear. `StalkerAvatar` sincroniza el clip con ese reloj, mezcla transiciones y conserva death antes de devolver la vista al pool. Muerte/aturdimiento cancelan el ataque; pausa congela los clips.

El BRUTE carga `public/models/brute.glb` con `BruteAvatar` y sincroniza su daño en `BruteActions` al fotograma 18 (0,6 s), una vez por ataque y sujeto a alcance, altura y frente. Mezcla estados en 0,16 s (0,08 s hacia muerte), mantiene el cadáver 3 s y reutiliza su vista. El reloj de simulación controla pausa y velocidad de ataque.

El SPITTER carga `public/models/spitter.glb` y distingue avance/retirada. `SpitterActions` crea el proyectil al fotograma 15 (0,5 s) usando el socket de esa pose, extraído en `spitterMuzzle.json` y transformado por la simulación. No depende del render ni de la carga del GLB. `CombatSystem.enemyShot` acepta ese origen y mantiene daño por impacto. La prueba de navegador compara el origen con `muzzle_socket` real, con orientación rotada.

El DRONE usa `DroneAvatar` y `DroneActions`: vuelo estacionario, avance/retirada y disparo desde el socket muestreado a 12/30 s con Three.js. La muerte retiene la vista y aplica gravedad desde la altura real, corrigiendo contra el terreno mediante límites de la malla animada. Se actualizan matrices de skinning antes de medir; el cadáver se libera solo tras terminar el clip y permanecer 0,5 s en el suelo. Pausa detiene ambos relojes.

ELTE conserva la clave interna `elite` y cambia su nombre visible a `ELTE · Sobrecarga`. `ElteActions` alterna ataques por instancia y resuelve daño una vez en los fotogramas 12 y 16, validando alcance/altura/frente. `ElteAvatar` carga `public/models/elte.glb`, sincroniza el clip elegido y mezcla transiciones de 0,08 s. Pausa congela los clips; muerte/aturdimiento cancelan golpes pendientes y el cadáver termina su animación antes de volver al pool.

### Guardián Rubí

`RubyActions` serializa spawn, melee, descarga e invocación. Los eventos usan tiempo de simulación (fotograma/30), cruzan el marcador una sola vez y se cancelan por muerte o aturdimiento. El altar inicia spawn durante 2 s; BossController espera a que termine cualquier acción antes de iniciar otra. Golpe en 18; descarga y llamada en 30. `rubyMuzzle.json` guarda el socket muestreado desde el GLB en ese instante, transformado por posición/yaw al emitir la descarga. `RubyAvatar` reproduce el GLB con transiciones, conserva la muerte y controla el núcleo rojo en core_socket: encendido durante spawn y apagado en 1,5 s al morir. EntityViews mantiene el cadáver hasta 3 s y libera sus recursos propios.

### Guardián Zafiro

`SapphireActions` serializa melee, descarga e invocación: contacto 18/30 s, descarga y llamada 30/30 s. Cancela eventos pendientes por muerte/aturdimiento y usa tiempo de simulación y velocidad de acción. `sapphireMuzzle.json` contiene el socket del GLB en el fotograma de descarga; la transformación mundial está verificada en navegador. `SapphireAvatar` carga los seis clips, mezcla transiciones, añade núcleo y luz azules al pecho y apaga su emisión durante death. EntityViews conserva el cadáver durante 3 s antes de liberar recursos. Los efectos eléctricos de ParticleSystem, proyectiles y áreas conservan el color de la gema. No hay clip spawn suministrado: el altar mantiene su activación habitual.

### Guardián Esmeralda

`EmeraldActions` serializa golpe, especial e invocación con marcadores 18/30, 24/30 y 30/30 s. El especial dura 1,2 s. Muerte y aturdimiento cancelan eventos pendientes. `emeraldMuzzle.json` procede del socket del GLB en el fotograma 24; la descarga transforma esa posición al mundo. `EmeraldAvatar` reproduce y mezcla los seis clips, añade núcleo y luz verdes al pecho y los apaga durante death. EntityViews mantiene el cadáver 3 s y libera sus recursos. Los efectos existentes de vapor ascendente, áreas y proyectiles usan el color esmeralda.

### Guardián Amatista

`AmethystActions` sincroniza golpe 18/30 s y descarga/invocación 30/30 s, serializando las acciones. El modelo longitudinal se escala uniformemente por 8; `amethystMuzzle.json` se transforma con esa misma escala. `AmethystAvatar` reproduce los clips y efectos del núcleo violeta. La muerte usa gravedad desde la altura capturada por EntityViews, limita la malla deformada contra alturas del terreno y espera al fin del clip y medio segundo de reposo tras aterrizar. El reloj de simulación gobierna pausa y caída. Los fragmentos y proyectiles mantienen el color de la gema.
