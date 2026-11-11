# GUARDIÁN RUBÍ — ruby

Rama models/ruby. Fuente: C:/Users/macab/Desktop/7. RUBY.

Entregables: ruby.glb, ruby.blend, animations.json, verification.json, reference_pose-0.png y vistas de las acciones.

| Clip | Reproducción | Duración | Último fotograma | Evento |
|---|---|---:|---:|---|
| idle | Bucle | 2 s | 60 | Reposo mecánico |
| move | Bucle | 1,2 s | 36 | Marcha en el sitio |
| attack_melee | Una vez | 1 s | 30 | Contacto: 18 / 0,6 s |
| attack_special | Una vez | 1,5 s | 45 | Descarga: 30 / 1 s |
| summon | Una vez | 1,5 s | 45 | Llamada: 30 / 1 s |
| death | Una vez | 2,5 s | 75 | Pose estable desde 65 / 2,167 s |
| spawn | Una vez | 2 s | 60 | Activación desde el altar |
| reference_pose | Estática | 1/30 s | 1 | Reposo original, brazos bajos separados |

Fotogramas desde 0; 30 FPS. Los siete FBX comparten 33 huesos Mixamo, jerarquía y matrices de enlace, comprobados antes de consolidar. Se conserva la pose de referencia original. La pequeña escala de los FBX se normaliza uniformemente a 7 m de altura de referencia, igual en todos los clips; el multiplicador está en animations.json. Frente +Z y arriba +Y en GLB.

Se elimina el desplazamiento horizontal de la pelvis y su componente de giro global sobre el eje vertical. Se mantienen inclinación, articulaciones y compresión vertical. La armadura no se desplaza ni gira; el juego determina el recorrido. Se corrige el apoyo al suelo por fotograma. Los ciclos cierran suavizando el último 20 %; los demás clips se remuestrean desde las acciones suministradas, con retención de la última pose de muerte.

Texturas PBR originales embebidas, pesos normalizados a cuatro influencias, sin dependencias de IK o restricciones. El OBJ y los FBX originales permanecen intactos. No se incluyen partículas, proyectiles, humo, explosiones, luces ni cámaras en el GLB; la iluminación del .blend es de presentación.

## Núcleo e identidad visual

core_socket y muzzle_socket son objetos separados sujetos a mixamorig:Spine1. El segundo está adelantado hacia la salida frontal; el eje local +Z indica descarga. muzzle-socket.png muestra una esfera de inspección que no está en los entregables.

Se conserva el aspecto metálico azulado/violeta de las texturas suministradas. El rig no tiene una puerta de horno independiente: attack_special usa el gesto de descarga del FBX, sin abrir literalmente una compuerta. death reproduce el colapso; el apagado luminoso y la activación del horno, el rojo rubí, brasas y humo se controlan desde el juego utilizando los sockets. No se han añadido luces o efectos horneados para simularlos.

## Integración implementada

public/models/ruby.glb sustituye al guardián ruby del juego. Al activar el altar reproduce spawn durante 2 s en el punto despejado de invocación y transiciona a idle/move. Melee, special y summon se serializan. Daño en 18/30 s; descarga e invocación en 30/30 s, una sola vez al cruzar sus marcadores, con velocidad de reproducción y pausa controladas por simulación. Muerte o aturdimiento cancelan eventos pendientes. death tiene prioridad y conserva la pose final antes de retirar el cuerpo.

Se usa LoopRepeat para idle/move y LoopOnce para los demás. La velocidad de desplazamiento y cadencia siguen siendo mecánicas del juego. Los efectos y proyectiles conservan el rojo rubí. La descarga usa la posición de muzzle_socket muestreada en el fotograma 30 y transformada al mundo, verificada contra el GLB en navegador. El núcleo añadido a core_socket se enciende durante spawn, pulsa al descargar y se apaga progresivamente en los primeros 1,5 s de death. El cuerpo se retira a los 3 s, después de mantener la pose final.

## Verificación y reproducción

El GLB reimportado a 30 FPS pasa comprobaciones de ocho clips, 33 huesos, sockets presentes, cierre de los bucles, pelvis sin deriva horizontal, apoyo al suelo por muestra y muerte estable. Se inspeccionaron referencia, fases de ataque, invocación, aparición, muerte y socket frontal.

Blender --background --factory-startup --python build.py
Blender --background --factory-startup --python verify.py

Integración verificada: 110 pruebas unitarias, lint y compilación; pruebas de navegador de transiciones, pausa, socket real, núcleo apagado y retirada del cadáver. Regresión de Dust también correcta.
