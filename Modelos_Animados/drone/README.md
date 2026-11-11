# DRONE — BASE

Rama models/drone. Fuente riggeada: C:/Users/macab/Downloads/DRONE/drone-rig.fbx.

Entregables: drone.glb, drone.blend, animations.json, verification.json, reference_pose.png y muzzle-socket.png.

| Clip | Reproducción | Duración | Último fotograma | Evento |
|---|---|---:|---:|---|
| hover | Bucle | 2 s | 60 | Aletas y cola en vuelo estacionario |
| move_forward | Bucle | 1 s | 30 | Inclinación de aproximación |
| move_backward | Bucle | 1,2 s | 36 | Retirada manteniendo el frente |
| attack_ranged | Una vez | 1 s | 30 | Expulsión en 12 / 0,4 s |
| death | Una vez | 2,2 s | 66 | Pose estable desde 51 / 1,7 s |
| reference_pose | Estática | 1/30 s | 1 | Reposo original de la criatura |

Fotogramas desde 0, muestreo a 30 FPS. Se conservaron los 33 huesos, sus nombres, jerarquía, escala y pose de enlace. La raíz root mantiene posición y rotación constantes. No hay desplazamiento global ni trayectoria de caída; los gestos afectan pelvis, cabeza, mandíbula, aletas y cola. La muerte detiene los movimientos y pliega el cuerpo, sin transportar el personaje hasta el suelo.

Se conserva la escala original: aproximadamente 1 m de longitud y 0,745 m de altura de la malla sin deformar. Frente -Y en Blender / +Z en GLB; arriba +Z en Blender / +Y en GLB. El origen se conserva, no se centra automáticamente en el volumen del cuerpo. La integración debe aplicar la altura de vuelo y el offset visual apropiado.

Las UV del FBX no reproducían el acabado original. Se recuperaron por correspondencia exacta de triángulos del drone.glb suministrado en la misma carpeta, alineando sus ejes. Se corrigieron vértices duplicados por triángulo y sombreado; los pesos se normalizaron a cuatro influencias antes de exportar. Se usan las cuatro texturas PBR originales embebidas. No se modificaron los archivos fuente.

El disparo se adapta a la anatomía: apertura de mandíbula, preparación y retroceso breve, sin añadir un cañón externo. muzzle_socket es un objeto separado, hijo del hueso head; su eje local +Z indica la salida de la boca. La esfera blanca de muzzle-socket.png es solo una ayuda de inspección y no forma parte del GLB ni del .blend.

No se incluyen humo, partículas, proyectiles ni explosiones. El GLB no contiene luces ni cámaras; el .blend incluye la escena de presentación. El apagado se representa con cese de movimiento y colapso mecánico; la intensidad/color de efectos luminosos queda a cargo del juego.

## Integración en el juego

El juego carga public/models/drone.glb mediante DroneAvatar. Usa hover en reposo, move_forward al perseguir y move_backward al retirarse manteniendo el frente. Transiciones de 0,12 s y 0,06 s hacia muerte; ataque/muerte se reproducen una vez. Pausa congela clips y caída. Muerte o aturdimiento cancelan la expulsión pendiente. Cada instancia tiene rig independiente y comparte geometría/texturas; se mantiene un modelo procedural de respaldo si falla la carga.

DroneActions expulsa una vez al cruzar el fotograma 12 / 0,4 s. src/data/droneMuzzle.json se muestrea desde el GLB con Three.js y se transforma por posición y orientación del enemigo; funciona sin depender de carga o renderizado. La prueba de navegador compara ese origen con muzzle_socket animado. Regenerar con node Modelos_Animados/drone/export_muzzle.mjs si cambia el ataque. enemy.attackSpeed ajusta el tiempo de expulsión y reproducción; enemy.cooldown mantiene la cadencia. El daño ocurre al impactar el proyectil.

La caída usa y inicial real y gravedad 9,81 m/s², sin trayectoria global en el clip. Se actualizan las matrices del esqueleto antes de medir el volumen animado; el cuerpo se apoya sobre la cota máxima del terreno bajo el centro y esquinas de su volumen. Esta aproximación es conservadora en pendientes. No hay rebote. El cadáver termina el clip y permanece al menos 0,5 s tras el contacto, incluso desde alturas que requieren más tiempo que el clip. También existe caída procedural de respaldo. Los colores y efectos siguen ligados a la gema.

## Verificación y reproducción

Se reimportó el GLB a 30 FPS: seis clips, 33 huesos, socket presente, tres bucles cerrados, raíz sin avance horizontal y muerte estable. Se inspeccionaron vistas de referencia, desplazamientos, disparo, muerte y ubicación del socket.

Blender --background --factory-startup --python build.py
Blender --background --factory-startup --python verify.py
