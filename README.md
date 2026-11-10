# RED HORIZON

Roguelite 3D de supervivencia en tercera persona, construido con JavaScript, Three.js y Vite. Recursos visuales procedurales originales y sonido sintetizado: no requiere descargar modelos, texturas, fuentes ni audio al jugar.

![Pantalla de inicio](docs/screenshots/menu.png)

## Ejecutar

Requiere Node.js 22.12 o superior y un navegador de escritorio con WebGL2 y aceleración gráfica.

```sh
npm install
npm run dev
```

Abre la dirección local que imprime Vite (normalmente http://127.0.0.1:5173). El servidor escucha solamente en localhost. No se ha publicado ni desplegado el proyecto.

```sh
npm run check       # ESLint, Vitest y compilación de producción
npx playwright install chromium
npm run test:e2e    # Pruebas funcionales; inicia Vite si hace falta
npm run build
npm run preview    # Comprobar dist localmente
```

## La expedición

Sobrevive en Aster Planitia. Elimina criaturas para obtener experiencia y elige uno de tres módulos cada vez que subes de nivel. Hay 15 mejoras acumulables, cuatro rarezas y tres armas disponibles desde el inicio.

El Titán del Polvo llega a los **06:00 de tiempo de simulación**. También puedes despertarlo antes reconectando los tres relés turquesa del radar con **E**. Los relés dan experiencia, fragmentos y curación. Los contenedores verdes curan 45 puntos. Derrotar al Titán completa la partida; perder toda la vida termina la expedición. Pausa y elecciones detienen la simulación.

Los fragmentos obtenidos al finalizar se guardan localmente. En el menú puedes invertirlos en hasta cinco módulos de blindaje permanente (+5 de vida inicial cada uno). No hay cuentas, servidor ni compras. Abandonar desde pausa no deposita fragmentos.

## Controles

| Entrada | Acción |
|---|---|
| WASD | Movimiento relativo a la cámara |
| Ratón | Girar cámara después de capturarlo con clic |
| Shift izquierdo | Correr |
| Espacio | Saltar; no hay salto aéreo |
| Clic izquierdo | Disparar; captura el ratón |
| Clic derecho | Apuntar con cámara cercana |
| 1 / 2 / 3 | Plasma / escopeta / lanzador explosivo |
| Q | Pulso de daño, aturdimiento y escudo temporal |
| E | Interactuar con relés o suministros |
| F | Alternar disparo continuo hacia la mira |
| Escape | Pausar, continuar y liberar el ratón |

Opciones: volumen, sensibilidad, distancia de cámara, calidad alta/baja y asistencia de apuntado. El audio se inicia después de pulsar Iniciar expedición. Si el navegador rechaza la captura del ratón, se puede girar manteniendo un botón sobre el lienzo. La pérdida de foco pausa la partida.

## Estado y alcance

Versión jugable inicial con ciclo completo, mapa compacto con semilla, cinco tipos de enemigo, jefe de dos fases, evolución, victoria/derrota y reinicio. No es una versión comercial final. El arte es de baja poligonización y las animaciones son procedurales.

La evidencia, resultados exactos y límites de las pruebas están en [TESTING](docs/TESTING.md). El objetivo de 60 FPS depende del equipo; no se garantiza por la compilación o las pruebas de lógica. La calidad baja desactiva sombras y limita la densidad de píxeles.

Documentación:

- [Arquitectura](docs/ARCHITECTURE.md)
- [Diseño y balance](docs/GAME_DESIGN.md)
- [Desarrollo por fases](docs/DEVELOPMENT.md)
- [Pruebas y evidencias](docs/TESTING.md)
- [Limitaciones y próximos pasos](docs/ROADMAP.md)

Las versiones exactas están fijadas por `package-lock.json`. Three.js y Vite se usan conforme a sus [documentaciones oficiales](https://threejs.org/docs/pages/WebGLRenderer) y [guía de Vite](https://vite.dev/guide/). No hay recursos artísticos externos ni rutas de modelos ficticias.
