# GUARDIÁN ZAFIRO — sapphire

Fuente: C:/Users/macab/Desktop/8. SAPPHIRE. Preparado en models/sapphire.

Entregables: sapphire.glb (modelo, PBR embebido, rig y todos los clips), sapphire.blend, animations.json y verification.json. Los archivos originales permanecen intactos.

| Clip | Duración | Reproducción | Evento (30 FPS, desde 0) |
|---|---:|---|---|
| idle | 2 s | Bucle | — |
| move | 1,2 s | Bucle | — |
| attack_melee | 1 s | Una vez | Contacto 18 / 0,6 s; termina 30 |
| attack_special | 1,5 s | Una vez | Descarga 30 / 1 s; termina 45 |
| summon | 1,5 s | Una vez | Llamada 30 / 1 s; termina 45 |
| death | 2,5 s | Una vez | Pose estable desde 65; termina 75 |
| reference_pose | 1/30 s | Estática | Pose de enlace original |

Los eventos los ejecuta el juego al cruzar el marcador de cada clip; no están embebidos como lógica de daño en el GLB. No hay clip spawn entre los archivos suministrados.

## Rig y movimiento

Los seis FBX comparten 33 huesos Mixamo, nombres, jerarquía y matrices de enlace verificadas. Se conserva la pose de referencia original con brazos bajos separados y equipo asimétrico. Escala uniforme a 7 m de altura de referencia, documentada en animations.json y común a todos los clips. GLB: +Z frontal, +Y arriba.

Clips remuestreados a 30 FPS; pelvis sin avance horizontal ni giro global, manteniendo articulaciones, inclinación y compresión. Se corrige el apoyo al suelo por muestra. Idle y move cierran con suavizado del último 20 %. La muerte mantiene su última pose. Pesos normalizados a cuatro influencias y animaciones de deformación horneadas; sin dependencias de IK.

## Identidad y sockets

El modelo suministrado es un caballero mecánico con maza y escudo. No tiene bobinas, giroscopios ni puerta articulados de forma independiente. Los gestos de ataque e invocación son los suministrados; no se ha añadido mecánica inexistente al rig. Se conservan las texturas PBR metálicas originales.

core_socket y muzzle_socket están sujetos al pecho (mixamorig:Spine1), con muzzle_socket adelantado y +Z local hacia la descarga. La electricidad azul, partículas, luz y apagado del núcleo se resuelven en el juego. No están horneados en el modelo.

## Verificación

GLB reimportado y comprobado: siete clips, 33 huesos, sockets presentes, bucles cerrados, deriva horizontal menor de 0,000002 m, apoyo al suelo y pose final de muerte estable. Inspección visual de referencia, movimiento, ataques, invocación y colapso. Las imágenes PNG acompañan la entrega.

Reproducir con Blender en background usando build.py y después verify.py. sapphire.blend contiene las acciones y pistas NLA; activar una acción para previsualizarla.

## Integración implementada

public/models/sapphire.glb sustituye al guardián del altar zafiro. SapphireAvatar conecta idle/move/ataques/summon/death con fundidos de 0,12 s (0,06 s al morir). SapphireActions serializa las acciones y ejecuta golpe en 18/30 s y descarga/llamada en 30/30 s una sola vez, con cancelación por muerte o aturdimiento. La descarga usa muzzle_socket muestreado en el fotograma 30, transformado a coordenadas mundiales y verificado contra el GLB en navegador. Se mantienen las chispas eléctricas azules y los colores de áreas y proyectiles ligados a la gema. El núcleo de core_socket pulsa durante la descarga y se apaga en 1,5 s al morir; el cuerpo permanece hasta completar death y mantener su pose final (3 s en total). El tiempo de simulación controla animación y efectos del núcleo, incluida la pausa. El juego controla desplazamiento, orientación y cadencia.

Validación de integración: 114 pruebas unitarias, lint y compilación correctos; pruebas de navegador de ZAFIRO y regresión de RUBÍ correctas. Captura: in-game.png.
