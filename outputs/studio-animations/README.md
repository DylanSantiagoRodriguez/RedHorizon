# Studio Creature — BASE

Entregables: studio-model-animated.glb y studio-model-animated.blend.
Fuente original conservada en Downloads/studio-model.glb.

30 FPS. Misma escala, materiales y esqueleto del original. Frente +X; GLB arriba +Y.

| Clip | Duración | Reproducción |
|---|---:|---|
| idle | 2 s | Bucle |
| move | 0,8 s | Bucle, en el sitio |
| attack_melee | 1,2 s | Una vez; contacto aproximado 0,46 s |
| death | 2,4 s | Una vez; conservar último fotograma |

En Three.js usar LoopRepeat para idle/move; LoopOnce y clampWhenFinished=true para death. El movimiento de persecución y el daño se controlan desde el juego. Los clips no sustituyen automáticamente a ningún enemigo del proyecto.

En Blender seleccionar StudioCreatureRig y la acción deseada en el editor de acciones. Las cuatro acciones también están guardadas en pistas NLA silenciadas para exportación separada.

Regenerar con Blender --background --factory-startup --python build_animations.py.
