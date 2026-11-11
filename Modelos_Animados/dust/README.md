# TITÁN DEL POLVO — dust

`dust.glb` contiene el modelo de **3Dmodels/sand boss**, un único rig de 57 huesos,
materiales PBR, siete clips BASE y `reference_pose`. La copia usada por el juego
está en `public/models/dust.glb`.

- Unidades: metros. Altura de referencia: **7 m**; en reposo flexionado, aproximadamente **6,5 m**.
- Frente: **+Z**. Arriba: **+Y**. Suelo: **Y = 0**.
- Muestreo: **30 FPS**. Los fotogramas se cuentan desde **0**.
- Referencia: pose de reposo simétrica en A baja del modelo original, incluida como clip y en `reference-pose.png`.
- Los clips comparten nombres, jerarquía, matrices de enlace y escala. Se conservan también los huesos terminales sin pesos.
- Raíz inmóvil: sin pistas de traslación o giro global; pelvis sin desplazamiento horizontal. Se conserva la compresión vertical y el balanceo de articulaciones.

| Clip | Reproducción | Duración | Último fotograma | Evento |
|---|---|---:|---:|---|
| idle | Bucle | 2 s | 60 | Motor y mecanismos en reposo |
| move | Bucle | 1,0333 s | 31 | Marcha en el sitio |
| attack_melee | Una vez | 1 s | 30 | Contacto: **14 / 0,4667 s** |
| attack_special | Una vez | 1,4 s | 42 | Descarga: **20 / 0,6667 s** |
| summon | Una vez | 1,5 s | 45 | Llamada: **24 / 0,8 s** |
| stunned | Bucle | 0,8 s | 24 | Atasco breve, interrumpible |
| death | Una vez | 2,4 s | 72 | Apagado y pose final estable desde **63 / 2,1 s** |

`animations.json` y `src/data/dustAnimations.js` contienen los mismos tiempos para integración.
Los bucles tienen extremos coincidentes. Los ataques se han remuestreado desde los FBX;
sus duraciones originales eran más largas. El FBX `Stunned` acababa en caída:
el clip entregado usa su reacción inicial de 0,22 s, recorrida de ida y vuelta.
La muerte incluye corrección vertical para evitar que el cuerpo atraviese el suelo.

## Materiales y puntos de anclaje

Los originales contienen un material gris sin mapas de textura. Se añadieron materiales
de bronce, hierro y latón, un núcleo dorado, dos taladros y un engranaje posterior.
Los mecanismos son objetos rígidos sujetos al rig existente; sus giros están horneados
en las pistas de los clips. No requieren IK, restricciones, texturas externas ni luces.
El núcleo se apaga durante la muerte. No se incluyen partículas ni proyectiles.

- `core_socket`: centro frontal del pecho; sigue `mixamorigSpine1`.
- `muzzle_socket`: salida frontal del núcleo, eje local +Z.
- `drill_mount_left` / `drill_mount_right`: soportes en las manos.
- `drill_left` / `drill_right`, `back_gear` y `core_rotor`: piezas animadas.

La conversión conserva las cuatro influencias principales por vértice y normaliza sus pesos,
que es el formato de skinning usado por el juego. Los nombres Mixamo se normalizan al
importar (por ejemplo `mixamorig:Hips` → `mixamorigHips`) de manera idéntica en todos los clips.

## Integración y archivos fuente

El juego carga este GLB para el guardián `dust`, con respaldo procedural si falla la carga.
La simulación dispara el daño y las habilidades en los tiempos indicados, sin depender de
los FPS de renderizado. Aturdir cancela un ataque pendiente; muerte tiene prioridad.
Las transiciones duran 0,12 s (0,06 s hacia aturdimiento). La muerte termina y permanece
0,5 s en su pose final antes de retirar la instancia. La fase 2 acelera la marcha en ejecución.
Los efectos conservan el color dorado de la gema. Los otros guardianes conservan sus modelos.

Los FBX y el OBJ comprimido originales se conservan sin cambios en `3Dmodels/sand boss/`.
Los dos FBX de aparición quedan como fuentes opcionales, fuera de esta entrega BASE.
La fuente editable del montaje y la conversión es `scripts/export-dust.mjs`, junto con
`src/data/dustAnimations.js`; no se utilizó Blender y no se genera un `.blend`.

Desde la raíz del proyecto:

```sh
node scripts/export-dust.mjs
npm run check
npx playwright test tests/browser/dust.spec.js tests/browser/enemies.spec.js
```

Para revisar y mover la cámara: ejecutar `npm run dev` y abrir
`http://127.0.0.1:5173/scripts/preview-dust.html`. El selector permite inspeccionar cada
clip, detenerlo por fotograma y reproducir los bucles.

Validación: reimportación del GLB, jerarquía y clips, fotogramas a 30 FPS, bucles cerrados,
raíz inmóvil, muerte sin penetración, pose final estable, eventos únicos e interrupciones;
además, carga, transiciones, pausa y retirada del cadáver en el navegador.
`clip-review.png` muestra las siete secuencias y `in-game.png` el modelo integrado.
