# Alcance y siguientes pasos

## Implementado

- Aplicación local Vite/Three.js, simulación de paso fijo y estados validados.
- Explorador procedural articulado, movimiento, salto, gravedad y cámara con colisión.
- Mapa compacto con terreno irregular, dunas, cráteres, cordillera, rocas, cristales, ruinas, estación y naufragio.
- Combate con tres armas, cinco amenazas, élites, pulso y proyectiles agrupados.
- Director temporal, límite de entidades, experiencia y 15 mejoras con rarezas.
- Jefe de dos fases, refuerzos, ataques anticipados, derrota, victoria y reinicio.
- Menús, HUD, radar, opciones, audio sintetizado, partículas y metaprogresión local.
- Pruebas unitarias, navegador, capturas y herramientas reproducibles de medición.

## Limitaciones conocidas

- Arte procedural estilizado de primera versión. No hay animaciones de captura, texturas pintadas, cinemáticas ni música compuesta; el jefe usa percusión/síntesis mínima.
- Un solo entorno. No hay chunks, biomas diferenciados, red de cuevas, interiores transitables de varios pisos ni cañones complejos. Las ruinas y edificios son puntos de interés de exterior.
- Colisiones conservadoras en XZ y navegación local; los enemigos pueden tardar en rodear una agrupación rocosa. No hay físicas de cuerpos rígidos ni escalada.
- Las posiciones de los tres puntos de interés son fijas; alturas, cráteres, rocas, suministros y decoración cambian con la semilla.
- No hay guardado de expedición activa, mando, controles táctiles, multijugador ni localización fuera del español.
- El adaptador GLTF existe, pero no se ha probado con archivos externos. La partida no depende de él.
- Pruebas de navegador usan Chromium. Falta validación específica en Firefox, Safari y hardware de gama media independiente.
- Las pruebas del jefe en navegador preparan un encuentro abreviado. La simulación completa usa un piloto automático de puntería perfecta; no equivale a completar una partida humana.
- Los 60 FPS a 1080p son un objetivo sujeto a medición, no una promesa universal. Consulta `docs/qa/benchmark.json` y TESTING.

## Próximas iteraciones ejecutables

1. Sesiones de juego humanas para ajustar apuntado, duración, dificultad y frecuencia de elecciones; registrar semilla, arma, muerte y causa.
2. Perfilar draw calls de modelos articulados con una horda máxima; agrupar partes estáticas y evaluar LOD de enemigos distantes si la medida lo justifica.
3. Añadir navegación global si se amplían estructuras; definir pendientes y volúmenes verticales antes de introducir cuevas o edificios accesibles.
4. Variar ubicaciones de puntos de interés manteniendo distancias de seguridad y pruebas de conectividad.
5. Incorporar modelos GLB propios o con licencia comprobada, manteniendo las alternativas procedurales; validar animaciones y liberación de texturas.
6. Añadir armas y patrones de élite mediante los contratos documentados, con pruebas del comportamiento nuevo.
7. Validar navegador y GPU adicionales, reducir movimiento, personalización de teclas y opciones de accesibilidad.

No hay despliegue configurado. Publicar requiere una solicitud explícita del propietario.
