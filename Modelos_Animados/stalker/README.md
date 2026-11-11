# STALKER — entrega BASE

`stalker.glb`: modelo, materiales, texturas embebidas, rig de 38 huesos y cinco clips.
`stalker.blend`: fuente editable, abre en pose de referencia.
`reference_pose.png`: vista de la pose de reposo original de la criatura.

## Clips y eventos

30 FPS; fotogramas contados desde 0. Misma escala y pose de enlace del GLB original.

| Clip | Reproducción | Duración | Último fotograma | Evento |
|---|---|---:|---:|---|
| idle | Bucle | 2 s | 60 | Reposo mecánico |
| move | Bucle | 0,8 s | 24 | Persecución en el sitio |
| attack_melee | Una vez | 1 s | 30 | Contacto en 12 / 0,4 s |
| death | Una vez | 2,4 s | 72 | Pose definitiva desde 51 / 1,7 s |
| reference_pose | Estática | 1/30 s | 1 | Reposo original; no usar como acción de combate |

Frente del modelo: +X. Arriba en GLB: +Y; arriba en Blender: +Z.
La raíz no se traslada ni rota en ningún clip. La pelvis absorbe balanceo, ataque y colapso local, incluida la corrección contra el suelo. El juego determina posición y orientación globales.
La referencia conserva la anatomía y las pequeñas asimetrías del original, sin alterar su rig ni pose de enlace.
Las acciones están muestreadas cada fotograma y no necesitan IK ni restricciones en ejecución.

## Integración en el juego

El juego carga public/models/stalker.glb. StalkerAvatar comparte geometría y texturas, pero cada enemigo tiene esqueleto y mezclador independientes. Corrige el frente +X a +Z y aplica escala visual 1,7 para la altura de juego. idle/move usan LoopRepeat; attack_melee/death usan LoopOnce. Las transiciones duran 0,1 s (0,06 s hacia muerte). El cadáver conserva la pose final durante 0,5 s tras el clip y se reutiliza después. Si la carga falla se conserva el modelo procedural de respaldo. La pausa y la selección de aumentos congelan la reproducción mediante el reloj de simulación.

StalkerActions aplica el daño una sola vez al cruzar el fotograma 12 / 0,4 s, comprobando alcance, altura y que el jugador siga delante. El ataque detiene desplazamiento y giro hasta terminar. Muerte o aturdimiento cancelan el golpe; sin clip stunned, el aturdimiento transiciona a idle. La cadencia sigue controlada por enemy.cooldown; enemy.attackSpeed ajusta conjuntamente la reproducción y el marcador de contacto. Las animaciones y el daño no dependen de los FPS de renderizado.

No requiere weapon_socket, muzzle_socket ni core_socket: es un enemigo de pinzas sin disparo. No se incluyen VFX, luces ni cámaras en el GLB. Las luces/cámara del .blend son solo para las vistas previas. Los efectos de gema y color se mantienen bajo control del juego.

## Verificación

`verification.json` registra cuatro acciones BASE y reference_pose, texturas embebidas, 38 huesos con los mismos nombres, raíz fija, extremos de bucles coincidentes y muerte estable desde 1,7 s. Se comprobó también la posición global de los huesos de enlace frente al original: diferencia máxima inferior a 0,000001 unidades. Las vistas PNG muestran referencia, reposo, movimiento, contacto y muerte.

Regenerar: Blender --background --factory-startup --python build_animations.py
Verificar: node verify.mjs
La fuente original permanece en C:/Users/macab/Downloads/studio-model.glb.
