# Diseño de juego

## Identidad

Un explorador aislado en Aster Planitia debe convertir tecnología recuperada en capacidad de supervivencia. Arenas rojizas, roca volcánica, trajes cerámicos y señales turquesa definen una estética de baja poligonización. Todos los modelos se construyen mediante piezas originales; no se reutilizan diseños de los juegos de referencia.

## Ciclo

1. Iniciar con semilla aleatoria o elegida y blindaje permanente adquirido.
2. Explorar, mantener distancia de la horda y alternar tres armas.
3. Las bajas conceden XP inmediata; al alcanzar el umbral se pausa para escoger un módulo.
4. Visitar relés y suministros para experiencia/curación. Activar tres relés adelanta el jefe.
5. Si no se adelanta, el jefe aparece a los 360 segundos simulados.
6. Derrotar al jefe concede victoria; vida cero concede derrota.
7. Depositar fragmentos y preparar otra expedición.

No hay munición limitada ni recarga. El ritmo lo controlan cadencia, posicionamiento y enfriamiento del pulso. F mantiene el disparo hacia la mira; no busca blancos automáticamente. La asistencia opcional amplía la adquisición de blancos próximos a la mira y respeta la primera superficie que bloquea la vista.

## Armas iniciales

| Arma | Daño base | Intervalo | Velocidad | Alcance | Particularidad |
|---|---:|---:|---:|---:|---|
| Plasma | 20 | 0,19 s | 65 m/s | 75 m | Precisión y cadencia |
| Escopeta | 15 por perdigón | 0,72 s | 53 m/s | 32 m | 6 proyectiles, dispersión 0,16 |
| Explosivo | 62 | 1,05 s | 28 m/s | 65 m | Explosión de radio 4,8 m, una instancia de daño |

Los impactos pueden hacer crítico. El crítico inicial es 6% con multiplicador 1,8. Perforación y rebote se aplican a proyectiles no explosivos; el lanzador detona al primer impacto. Los módulos de esas propiedades no se excluyen porque se puede cambiar de arma en cualquier momento.

## Explorador

120 de vida inicial, 7 m/s andando, 10,5 m/s corriendo, salto con velocidad vertical 9 m/s y gravedad 23 m/s². Invulnerabilidad de 0,65 s después de daño. El escudo de módulos se regenera a 8/s tras 6 s sin impactos. Los suministros curan 45; cada relé cura 30, concede 35 XP y 15 fragmentos.

**Pulso de resonancia (Q):** radio 10 m, 60 de daño, aturdimiento 1,8 s (0,3 s al jefe), 30 puntos de escudo temporal durante 3 s y enfriamiento 14 s. Radio, daño y enfriamiento se benefician de módulos.

## Progresión

Umbral de experiencia en nivel L: `20 + 12L + 3(L−1)²`. Se conservan excedentes y se encolan elecciones si una recompensa otorga varios niveles. Las 15 mejoras se definen en `data/upgrades.js`; sus textos muestran el efecto real y el número de acumulaciones.

Pesos de selección: común 6, poco común 4, rara 2 y legendaria 0,7. Son pesos relativos entre candidatos elegibles, no probabilidades fijas. Las tres ofertas son diferentes. Cuando se agota todo el catálogo, los niveles pendientes curan al máximo y no bloquean la partida.

Sinergias disponibles: multishot + rebote, críticos + explosiones por bajas, cadencia + robo de vida, área + lanzador/pulso. El robo de vida usa daño efectivo, sin curación por exceso de daño. Las explosiones por muerte no disparan nuevas cadenas recursivas. Los límites están definidos por mejora; por ejemplo multishot 3, perforación 3, rebote 3, crítico máximo 66% y robo de vida máximo 8%.

## Amenazas y director

| Enemigo | Vida base | Rol |
|---|---:|---|
| Stalker | 35 | Persecución rápida, cuerpo a cuerpo |
| Brute | 180 | Lento, resistente, golpe fuerte |
| Spitter | 65 | Proyectil tóxico verde y retirada |
| Drone | 55 | Vuelo visual, mantiene distancia, disparos |
| Elite | 220 | Sobrecarga: velocidad alta, resistencia y silueta violeta |

La variedad se introduce a los 22/40/65/120 s. Aumentan la frecuencia, tamaño de grupo, salud y daño, y el nivel del jugador reduce moderadamente el intervalo de aparición. Los puntos de aparición se validan fuera de obstáculos y a 24–36 m del jugador, dentro del perímetro. Hay seis etiquetas de presión temporal.

## THE TITAN OF DUST

4200 de vida, mecánica de cuerpo a cuerpo y gran silueta mecánica. A los 50% de vida entra en sobrecarga: más velocidad, más proyectiles, tres áreas de impacto y refuerzos más frecuentes. Los anillos anticipan el impacto durante 1,6 s; salir del radio o saltar suficientemente alto evita el daño. Los refuerzos respetan el límite global.

El jefe es alcanzable con las estadísticas normales, pero las simulaciones automatizadas usan puntería perfecta y no sustituyen el ajuste con jugadores. El balance inicial está orientado a exploración y combinaciones poderosas; se necesita más validación humana de dificultad y duración.

## Metaprogresión

Al finalizar se depositan fragmentos: normalmente uno por baja, cinco por élite, 15 por relé, tres por suministro y 50 extra por jefe. Blindaje permanente tiene cinco niveles (+5 de vida cada uno), con costes 25, 40, 55, 70 y 85. Datos guardados solo en el navegador actual.
