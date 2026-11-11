# BRUTE — BASE

Entrega en la rama models/brute. Fuente: C:/Users/macab/Desktop/3. BRUTE.

- brute.glb: modelo con materiales PBR, cuatro texturas embebidas, esqueleto y clips.
- brute.blend: fuente editable; abre en reference_pose.
- reference_pose-0.png: pose de reposo original, simétrica, con brazos bajos.
- animations.json: tiempos, marcador del golpe y factor uniforme de escala.
- verification.json: comprobación del GLB reimportado a 30 FPS.

| Clip | Reproducción | Duración | Último fotograma | Evento |
|---|---|---:|---:|---|
| idle | Bucle | 3 s | 90 | Reposo pesado |
| move | Bucle | 1,2 s | 36 | Avance en el sitio |
| attack_melee | Una vez | 1,2 s | 36 | Contacto en 18 / 0,6 s |
| death | Una vez | 2,5 s | 75 | Pose estable desde 65 / 2,167 s |
| reference_pose | Estática | 1/30 s | 1 | Reposo de referencia |

Fotogramas desde 0; 30 FPS. El ataque se deja algo más largo que la orientación de 1 s para conservar la anticipación y el peso del golpe. Marcador 18 seleccionado en la fase descendente del golpe; ajustar al volumen de contacto del juego durante integración.

Se conservaron los 49 huesos Mixamo y su jerarquía; se comprobó que las matrices de referencia de los cuatro FBX coincidieran. El modelo riggeado incluido en los FBX se combina con las texturas de la carpeta modelo. El OBJ original permanece intacto.

Se normalizó una sola vez la escala diminuta de los FBX para una altura de referencia de 2,4 m, idéntica en todos los clips. Frente +Z y arriba +Y en GLB. La armadura no tiene pistas de desplazamiento ni giro global. La pelvis mantiene fija su posición horizontal y conserva compresión vertical y balanceo articular. Se corrige el apoyo al suelo por fotograma. Los pesos se limitan y normalizan a cuatro influencias por vértice antes de exportar.

Los ciclos se cierran suavizando su último 20 %. Las animaciones originales se remuestrean a sus duraciones de entrega. La muerte conserva el último estado desde el fotograma 65. Todas las transformaciones están horneadas; no hacen falta IK ni restricciones en ejecución. No se incluyen luces, cámaras ni efectos en el GLB; la escena de presentación solo existe en el .blend. Este enemigo no dispara y no requiere muzzle_socket.

## Integración

El juego carga public/models/brute.glb mediante BruteAvatar, manteniendo la altura de referencia de 2,4 m y el frente +Z. Cada instancia tiene rig y mezclador independientes y comparte geometría/texturas. idle/move usan LoopRepeat; attack_melee/death usan LoopOnce, con clampWhenFinished. Transiciones de 0,16 s, o 0,08 s al morir. El cadáver termina su clip de 2,5 s y conserva la pose otros 0,5 s antes de volver al pool. Si falla la carga se conserva el modelo procedural.

BruteActions aplica daño una sola vez al cruzar el fotograma 18 / 0,6 s, validando distancia, altura y frente. El ataque detiene avance y giro durante sus 1,2 s. Muerte o aturdimiento cancelan el golpe pendiente; el aturdimiento usa idle porque no se entregó un clip específico. enemy.attackSpeed ajusta juntos el tiempo de contacto y la animación, mientras enemy.cooldown mantiene la cadencia independiente. La pausa congela la reproducción al detener el reloj de simulación. La física y la IA controlan movimiento y giro; la gema controla sus efectos de color.

## Reproducción de la entrega

Blender --background --factory-startup --python build.py
Blender --background --factory-startup --python verify.py

Se verificaron los cinco clips reimportados, cierre de bucles, conservación horizontal de la pelvis, contacto con el suelo en los fotogramas de 30 FPS y estabilidad final de muerte. Las imágenes attack_melee muestran las fases del golpe. La interpolación entre muestras puede producir diferencias pequeñas de contacto; revisarlo al integrar colisiones.
