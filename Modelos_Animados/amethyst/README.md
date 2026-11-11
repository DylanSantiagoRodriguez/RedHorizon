# GUARDIÁN AMATISTA — amethyst

Rama models/amethyst. Fuente principal: C:/Users/macab/Downloads/amethyst-rigged.fbx. Referencia: ballena mecánica suministrada por el usuario.

Entregables: amethyst.glb, amethyst.blend, animations.json, verification.json, build.py, verify.py y vistas PNG. El GLB contiene modelo, rig, PBR con texturas embebidas y siete acciones.

| Clip | Duración | Reproducción | Evento (30 FPS, desde 0) |
|---|---:|---|---|
| idle | 2 s | Bucle | Flotación local, cola y aletas |
| move | 1,2 s | Bucle | Inclinación y propulsión en el sitio |
| attack_melee | 1 s | Una vez | Contacto 18 / 0,6 s; termina 30 |
| attack_special | 1,5 s | Una vez | Descarga 30 / 1 s; termina 45 |
| summon | 1,5 s | Una vez | Llamada 30 / 1 s; termina 45 |
| death | 2,5 s | Una vez | Pose estable desde 51; termina 75 |
| reference_pose | 1/30 s | Estática | Reposo original de la criatura |

## Animación y rig

Se han creado las seis acciones sobre los 33 huesos originales, conservando nombres, jerarquía, pose de enlace y escala. Root permanece fijo en posición, orientación y escala. La pelvis solo inclina el cuerpo; cuello, mandíbula, cola y aletas articulan los gestos. Los bucles cierran exactamente y los ataques recuperan su postura inicial. Death pliega aletas, inclina el casco y curva la cola sin hornear una caída global; la caída según altura se resolverá al integrar.

Escala original: longitud aproximada 1 m, anchura 0,50 m y altura 0,32 m en reposo. El juego aplica un multiplicador uniforme de 8: longitud aproximada 8 m. Frente +Z, arriba +Y en GLB. No se ha normalizado a 7 m como a los guardianes humanoides: este modelo tiene proporciones longitudinales.

## Materiales y sockets

Se recuperaron UV coincidentes desde C:/Users/macab/Downloads/amethyst.glb, verificando coincidencia geométrica, y PBR desde amethyst.zip situado junto al FBX. Los mapas originales se conservan en source y se embeben en los entregables. Pesos normalizados a cuatro influencias; malla soldada en vértices coincidentes y normales suavizadas.

muzzle_socket está sujeto a head en la salida frontal. core_socket está sujeto a pelvis en la zona interna delantera. No hay cristales ni fragmentos separados en el rig suministrado: attack_special abre la estructura frontal y despliega aletas; summon eleva la cabeza y canaliza con las aletas. Se mantiene la intención adaptada a la ballena mecánica.

El aspecto azul/dorado de las texturas originales se conserva. Energía violeta, fragmentos, iluminación del núcleo y apagado se generan en el juego, sin partículas ni luces horneadas en el GLB. Las luces y cámara del .blend son de presentación.

## Verificación

GLB reimportado: siete acciones, 33 huesos, sockets presentes, deriva horizontal de raíz nula, cierre exacto de idle/move y pose final de death estable. Inspeccionados referencia, especial y muerte. build.py genera clips, exporta y guarda Blender; verify.py valida el archivo final.

## Integración implementada

public/models/amethyst.glb sustituye al guardián del altar amatista. AmethystAvatar conecta los seis clips con fundidos (0,12 s; 0,06 s para muerte), LoopRepeat en locomoción y LoopOnce en acciones. AmethystActions serializa los eventos: golpe 18/30 s, descarga e invocación 30/30 s. Muerte y aturdimiento cancelan los eventos pendientes. El socket de descarga se muestrea desde el GLB en el fotograma 30 y se transforma a escala 8 y coordenadas mundiales; la comparación con el modelo animado pasa en navegador.

Los efectos de fragmentos, áreas y proyectiles conservan el color violeta de la gema. Un núcleo luminoso sujeto a core_socket pulsa al descargar y se apaga en 1,5 s al morir.

La caída usa la altura real al morir y gravedad 9,81 m/s², sin trasladar el clip. El contacto se resuelve con los límites deformados de la malla y altura del terreno bajo su centro y esquinas. El cuerpo se retira cuando termina death y han transcurrido al menos 0,5 s desde el contacto, incluso si la caída dura más que el clip. Pausar congela animación, núcleo y caída. EntityViews conserva el instante de muerte también durante una carga tardía del modelo.

Validación: 122 pruebas unitarias, lint y compilación; navegador verifica clips, pausa, socket, apagado y caídas desde 7 y 60 m sobre terreno elevado.
