# GUARDIÁN ESMERALDA — emerald

Fuente: C:/Users/macab/Desktop/9. EMERALD. Rama models/emerald.

Entregables: emerald.glb, emerald.blend, animations.json, verification.json y vistas PNG. GLB con modelo, materiales PBR y texturas embebidas, esqueleto y todas las acciones. Los originales permanecen intactos.

| Clip | Duración | Reproducción | Evento, 30 FPS desde 0 |
|---|---:|---|---|
| idle | 2 s | Bucle | — |
| move | 1,2 s | Bucle | — |
| attack_melee | 1 s | Una vez | Contacto 18 / 0,6 s; termina 30 |
| attack_special | 1,2 s | Una vez | Descarga 24 / 0,8 s; termina 36 |
| summon | 1,5 s | Una vez | Llamada 30 / 1 s; termina 45 |
| death | 2,5 s | Una vez | Pose estable desde 65; termina 75 |
| reference_pose | 1/30 s | Estática | Pose de enlace original |

## Ataque especial abreviado

El FBX de origen contiene 15,267 s (fotogramas 1–459 a 30 FPS). La entrega adapta la preparación y descarga a una acción breve de 1,2 s: 20 % más corta que el especial de 1,5 s de los guardianes anteriores. Se redistribuye el tiempo: preparación y elevación hasta 18, compresión/descarga en 24 y recuperación suavizada hasta 36, sustituyendo el tramo final largo del origen. No es una reproducción del original a velocidad normal. Los eventos se ejecutan desde la simulación al cruzar el marcador; no ejecutan daño dentro del GLB.

## Rig y locomoción

Los seis FBX comparten 33 huesos Mixamo, nombres y matrices de enlace comprobadas. Se conserva la pose de referencia de brazos bajos separados. Escala uniforme común a 7 m de altura de referencia; factor exacto en animations.json. GLB orientado +Z frontal, +Y arriba.

Animaciones remuestreadas y horneadas a 30 FPS; pesos normalizados a cuatro influencias. Sin desplazamiento horizontal de pelvis ni giro global, manteniendo inclinación y articulaciones. Apoyo al suelo corregido por muestra, cierre suave del último 20 % de idle/move y pose estable al final de death. El juego controla recorrido y orientación.

## Anatomía y efectos

El modelo suministrado es un bípedo acorazado con puños mecánicos y depósitos en hombros. Se mantienen los gestos suministrados; no dispone de varias patas, válvulas o calderas articuladas independientes. No se simula su apertura mediante huesos inexistentes.

core_socket y muzzle_socket se sujetan al pecho (mixamorig:Spine1), con el segundo adelantado y +Z local hacia delante. Materiales originales conservados. Vapor verde, luz del núcleo y proyectiles se generan en el juego; no están incluidos en el GLB.

## Verificación y entrega

verify.py reimporta el GLB y comprueba los siete clips, los 33 huesos, sockets, cierre de bucles, ausencia de deriva horizontal, apoyo al suelo y estabilidad de la pose de muerte. build.py reproduce la preparación y exportación con Blender en background. El archivo .blend conserva acciones y pistas NLA.

## Integración implementada

public/models/emerald.glb sustituye al guardián del altar esmeralda. EmeraldAvatar mezcla idle/move/ataques/summon/death con fundidos de 0,12 s (0,06 s al morir). EmeraldActions serializa acciones y aplica golpe en 18/30 s, descarga en 24/30 s e invocación en 30/30 s. Cada evento se ejecuta una sola vez y se cancela por muerte o aturdimiento. El especial conserva su duración reducida de 1,2 s.

emeraldMuzzle.json guarda muzzle_socket muestreado desde el GLB en el fotograma 24; se transforma al mundo al emitir la descarga. Las áreas y proyectiles conservan el color de gema y ParticleSystem emite vapor verde ascendente en descarga e invocación. El núcleo verde se sujeta a core_socket, pulsa con el especial y se apaga durante los primeros 1,5 s de death. El cadáver se conserva 3 s antes de liberar sus recursos. Animación y núcleo usan tiempo de simulación y respetan la pausa. No hay spawn entre los clips entregados.
