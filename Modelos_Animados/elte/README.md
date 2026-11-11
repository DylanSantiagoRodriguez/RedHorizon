# ELTE — BASE + ataque alternativo

Nombre de entrega: ELTE. Rama models/elte. Fuente: C:/Users/macab/Desktop/6. ELTE.

Entregables: elte.glb, elte.blend, animations.json, verification.json y vistas PNG.

| Clip | Reproducción | Duración | Último fotograma | Evento |
|---|---|---:|---:|---|
| idle | Bucle | 2 s | 60 | Reposo tenso |
| move | Bucle | 0,6 s | 18 | Carrera en el sitio |
| attack_melee | Una vez | 0,8 s | 24 | Contacto en 12 / 0,4 s |
| attack_melee_alt | Una vez | 0,8 s | 24 | Contacto en 16 / 0,533333 s |
| death | Una vez | 2,2 s | 66 | Pose estable desde 54 / 1,8 s |
| reference_pose | Estática | 1/30 s | 1 | Reposo original, brazos bajos ligeramente separados |

Fotogramas desde 0; 30 FPS. Los dos marcadores se seleccionaron mediante inspección de las fases de los golpes y están en animations.json. Las imágenes attack_melee-12.png y attack_melee_alt-16.png muestran los contactos propuestos; calibrar alcance al integrar.

Los cinco FBX contienen el mismo modelo y rig de 33 huesos Mixamo. Se comprobaron nombres, jerarquía y matrices de enlace, y se conservan entre todas las acciones. La referencia mantiene la pose original sin cambiar la unión de la malla al esqueleto. Los originales y el OBJ permanecen intactos.

Se normalizó uniformemente la diminuta escala de los FBX a 2 m de altura de referencia; el multiplicador queda registrado en animations.json. Frente +Z y arriba +Y en GLB. La armadura permanece fija; se elimina la traslación horizontal de la pelvis conservando flexión, giro articular y compresión vertical. No hay recorrido global de salto ni caída. Se corrige el contacto con el suelo por fotograma.

Los cinco clips se remuestrean de los FBX suministrados. Los bucles se cierran suavizando su último 20 %. Los ataques se ajustan a 0,8 s para una lectura rápida; el alternativo sigue siendo un clip independiente y no fija cadencia. La muerte se estabiliza desde el fotograma 54.

Las cuatro texturas PBR originales están embebidas. Pesos normalizados a cuatro influencias por vértice. No se exportan IK, restricciones, partículas, proyectiles, luces ni cámaras. La iluminación del .blend es solo para las vistas previas. ELTE ataca cuerpo a cuerpo y no necesita muzzle_socket ni un arma separada del jugador. La desactivación visual de luces/efectos queda bajo control del juego.

## Integración en el juego

El juego carga public/models/elte.glb mediante ElteAvatar. El nombre visible es ELTE · Sobrecarga y se conserva la clave interna elite para compatibilidad con spawns y recompensas. Cada instancia tiene rig y mezclador independientes, compartiendo geometría y texturas. Si falla la carga se mantiene el modelo procedural.

idle/move usan LoopRepeat y ataques/death usan LoopOnce. ElteActions alterna principal y alternativo solo cuando acepta iniciar una acción; empieza por el principal y mantiene el turno por enemigo, también si un ataque es interrumpido. Los contactos ocurren en 12/30 s y 16/30 s respectivamente, una sola vez y comprobando distancia, altura y frente. Muerte/aturdimiento cancelan el golpe pendiente. Durante el ataque se detienen avance y giro. enemy.attackSpeed ajusta juntos reproducción y marcador, sin reemplazar enemy.cooldown.

Las transiciones duran 0,08 s, o 0,06 s hacia muerte. Sin clip stunned se usa idle durante aturdimiento. El cadáver termina death y mantiene la pose otros 0,5 s antes de reutilizarse. La pausa y la selección de aumentos congelan la animación mediante el reloj de simulación. La escala visual permanece en 2 m y se apoya en el terreno. El color de efectos sigue ligado a la gema.

## Verificación

verify.py reimporta el GLB a 30 FPS y comprueba seis clips, 33 huesos, cierre de idle/move, ausencia de deriva horizontal de la pelvis, apoyo al suelo en las muestras y estabilidad final de death. Se inspeccionaron referencia, carrera, ambos ataques y caída. La interpolación entre muestras puede variar ligeramente el apoyo al suelo.

Blender --background --factory-startup --python build.py
Blender --background --factory-startup --python verify.py
