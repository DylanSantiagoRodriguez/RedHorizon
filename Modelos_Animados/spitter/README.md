# SPITTER — BASE

Fuente: C:/Users/macab/Desktop/5. SPITTER. Rama: models/spitter.

Entregables: spitter.glb, spitter.blend, animations.json, verification.json, reference_pose-0.png y muzzle-socket.png.

| Clip | Reproducción | Duración | Último fotograma | Evento |
|---|---|---:|---:|---|
| idle | Bucle | 3 s | 90 | Reposo |
| move_forward | Bucle | 1 s | 30 | Avance en el sitio |
| move_backward | Bucle | 1,2 s | 36 | Retirada de cara al objetivo |
| attack_ranged | Una vez | 1 s | 30 | Expulsión en 15 / 0,5 s |
| death | Una vez | 2,5 s | 75 | Pose estable desde 65 / 2,167 s |
| reference_pose | Estática | 1/30 s | 1 | T del modelo original |

Fotogramas desde 0, muestreo a 30 FPS. Los cinco FBX comparten los mismos 33 huesos y matrices de enlace; se conserva esa jerarquía. Se usó el modelo riggeado incluido en los FBX y las cuatro texturas PBR suministradas, embebidas en el GLB. Los originales y el OBJ se conservan intactos.

La pequeña escala de los FBX se normalizó uniformemente a 1,8 m de altura de referencia; animations.json registra el multiplicador. Frente +Z y arriba +Y en GLB. La armadura no tiene animación global de avance o giro; se elimina la traslación horizontal de la pelvis y se conserva su articulación. La retirada mantiene el frente. Las poses se apoyan en el suelo por fotograma. Pesos normalizados a cuatro influencias por vértice. Los bucles se cierran suavizando el último 20 %. Se conservan los gestos del ataque suministrado y se añade un retroceso breve de cabeza tras el marcador de expulsión.

muzzle_socket es un objeto separado, hijo del hueso mixamorig:Head, colocado en la boca. Su eje local +Z indica salida. Sigue la cabeza en todos los clips. La esfera de muzzle-socket.png solo sirve para inspección y NO está en los archivos entregados. No se incluyen proyectiles, partículas, cámaras o luces en el GLB. Las luces del .blend son solo para presentación.

## Integración en el juego

El juego carga public/models/spitter.glb mediante SpitterAvatar, conservando la altura de 1,8 m y el frente +Z. Usa move_forward al perseguir y move_backward al retirarse sin invertir la orientación. Los tres bucles usan LoopRepeat; ataque/muerte usan LoopOnce. Transiciones de 0,12 s, o 0,06 s hacia muerte. El cadáver termina sus 2,5 s y mantiene la pose otros 0,5 s antes de volver al pool. Cada enemigo tiene rig independiente y comparte geometría/texturas. La pausa congela los clips. Si falla la carga se mantiene el modelo procedural.

SpitterActions crea el proyectil una sola vez al cruzar el fotograma 15 / 0,5 s. src/data/spitterMuzzle.json contiene la posición de muzzle_socket extraída del GLB en esa muestra; la simulación la transforma con la posición, orientación y altura del enemigo, independientemente de carga y renderizado. La prueba de navegador compara este origen con el socket animado real. Regenerar ese JSON con node Modelos_Animados/spitter/export_muzzle.mjs (muestreo con Three.js) si se modifica el rig o el ataque. El daño ocurre al impactar el proyectil, no al expulsarlo. enemy.attackSpeed ajusta conjuntamente reproducción y momento de expulsión. El ataque fija posición y orientación durante 1 s; muerte/aturdimiento cancelan una expulsión pendiente. enemy.cooldown controla la cadencia. La simulación controla movimiento, giro, cadencia y pausas; los efectos verdes siguen controlados por el juego. No depender de los FPS de renderizado ni usar reference_pose como estado de combate.

## Verificación

verify.py reimporta el GLB a 30 FPS y comprueba seis clips, 33 huesos, socket presente, cierre de los tres bucles, pelvis sin desplazamiento horizontal, apoyo al suelo en cada muestra y muerte estable. Se inspeccionaron visualmente la referencia, las fases del disparo, la muerte y la ubicación del socket.

Regenerar: Blender --background --factory-startup --python build.py
Verificar: Blender --background --factory-startup --python verify.py
