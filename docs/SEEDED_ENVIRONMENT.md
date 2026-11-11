# Arenas por semilla y colección secreta

Los 3 world_*.glb se usan como arenas completas. La semilla elige variante, giro de 90 grados y escala vertical (35–50, escala horizontal 240). world_1 y world_3 tienen aspecto muy similar, pero sus archivos no son idénticos. Las 5 variantes de roca se distribuyen con posiciones, tamaño y giro reproducibles; se conservan sus proporciones mediante rockRatios.json.

worldHeights.json se extrae mediante rayos sobre los GLB originales con outputs/environment/heights.py. TerrainGenerator muestrea esas alturas con la misma transformación que el modelo visual. La física mantiene su interpolación de terreno; las rocas añadidas usan colisión circular conservadora. Los salientes/cuevas del modelo se representan como superficie superior (no son cuevas navegables). La misma semilla conserva arena, rocas y secretos; no garantiza unicidad matemática entre todas las semillas.

Los cinco peluches (Ichika, Nino, Miku, Yotsuba, Itsuki) miden 55 cm. Se colocan lejos del inicio, en la cara exterior de rocas altas, separados al menos 22 m, fuera de obstáculos y con pendiente local moderada. Sin radar ni resplandor. Interacción E a menos de 1,25 m y diferencia de altura menor de 0,9 m. El HUD muestra el aviso solo cerca; cada recogida anuncia el progreso.

Al recoger los cinco, una sola vez por partida: daño ×4, cadencia ×1,5, +500 vida máxima y curación completa, +300 escudo, +8 regeneración/s y velocidad ×1,2. La mejora dura hasta finalizar la partida; una nueva partida reinicia la colección. No altera las cinco gemas ni los objetivos de misión.

Carga asíncrona con geometría y texturas compartidas entre clones de roca. Liberación al reiniciar partida. Si falla una descarga se mantiene el respaldo y se registra environmentError. environmentReady permite esperar la carga en pruebas.

Validación: pruebas de repetibilidad y cinco escondites libres en 100 semillas, distancia de recogida y recompensa no duplicable; prueba de navegador de carga y colección completa. Los 13 GLB originales se conservan en public/models/environment y public/models/plushies.
