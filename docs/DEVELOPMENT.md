# Registro de desarrollo por fases

Fecha de la sesión: 9 de noviembre de 2026 (America/Bogota). Directorio inicial `D:\triyies`: vacío, sin proyecto ni repositorio Git. Node 24.21.0 y npm 11.19.0 disponibles. Trabajo local; ningún despliegue.

## Fase 1 — Base técnica

**A. Resumen:** Vite, Three.js, renderizador, luz solar/ambiental, ciclo fijo, estados y semilla.

**B. Implementación:** `package.json`, lockfile, index, configuración Vite/ESLint, `src/config.js`, `core/GameLoop.js`, `core/StateManager.js`, `graphics/Renderer.js`, `utils/Random.js`, main y estilos. Vitest y Playwright son herramientas de desarrollo; no se incorpora framework de UI.

**C. Verificación:** `npm install`, `npm run check`. ESLint y 3 pruebas pasaron; la primera compilación falló por `manualChunks` como objeto en Vite 8. Se cambió a función y compiló. La instalación inicial notificó vulnerabilidades en ESLint 10; se fijó ESLint/@eslint/js 9.39.5, con auditoría posterior sin vulnerabilidades. Esa versión de ESLint emite aviso de fin de soporte, registrado como deuda de herramientas.

**D. Estado:** aplicación compilable; validación de navegador aún pendiente en ese momento.

**E. Continuación:** entrada, personaje y física; sin bloqueos.

## Fase 2 — Personaje

**A. Resumen:** movimiento, carrera, salto físico, contacto con suelo, invulnerabilidad y cámara orbital.

**B. Implementación:** `Player.js`, `CollisionSystem.js`, `InputManager.js`, `Models.js`, `CameraController.js`, `Game.js`; actualización de main. Personaje original compuesto por casco, visor, traje, mochila, extremidades y arma. Animación procedural articulada.

**C. Verificación:** `npm run check`: lint, 7 pruebas y build correctos. Pruebas de salto sin repetición aérea, aterrizaje, resolución circular, daño, escudo e invulnerabilidad.

**D. Estado:** lógica validada; comodidad de cámara pendiente de navegador.

**E. Continuación:** terreno reproducible y escenario.

## Fase 3 — Mundo marciano

**A. Resumen:** terreno irregular, cráteres, rocas, cordillera, estación, ruinas, naufragio, cristales, relés y suministros.

**B. Implementación:** `TerrainGenerator.js`, `WorldManager.js`, conexión en Game y tests del mundo. Altura compartida entre render y física; espacios mínimos entre obstáculos; decoración repetida con instancias.

**C. Verificación:** `npm run check`: 9 pruebas, lint y build correctos tras corregir precedencia del operador de potencia y una comparación de cero negativo demasiado estricta en el test.

**D. Estado:** exterior explorable compacto. Sin red de cuevas, interiores de varios pisos ni navegación global.

**E. Continuación:** combate e impactos.

## Fase 4 — Combate

**A. Resumen:** armas configurables, proyectiles visibles, impactos barridos, críticos, vida y muerte.

**B. Implementación:** datos de armas/enemigos, DamageSystem, WeaponSystem, CombatSystem, EnemyAI, Enemy, Run, ObjectPool y EntityViews. Se reutilizan geometrías/materiales y se agrupan proyectiles con InstancedMesh.

**C. Verificación:** `npm run check`: 12 pruebas, lint y build correctos. Se ejecutó una prueba de proyectil real de plasma que reduce la vida de un objetivo.

**D. Estado:** combate implementado; interfaz y audio todavía mínimos en esa fase.

**E. Continuación:** aparición progresiva y final de partida.

## Fase 5 — Supervivencia

**A. Resumen:** director, variedad temporal, límite de horda, menús básicos, pausa, derrota y reinicio.

**B. Implementación:** DifficultyDirector y UI inicial; Game y Run gestionan estados y sesiones. El director valida posiciones antes de generar enemigos.

**C. Verificación:** `npm run check`: 15 pruebas, lint y build correctos; se verificaron presión creciente, variedad, límites y reinicio de datos.

**D. Estado:** ciclo de supervivencia disponible; progresión y jefe aún pendientes en ese momento.

**E. Continuación:** experiencia y módulos.

## Fase 6 — Roguelite

**A. Resumen:** experiencia, niveles pendientes, tres ofertas ponderadas, 15 mejoras, rarezas, acumulación y compatibilidad.

**B. Implementación:** ExperienceSystem, UpgradeSystem, catálogo upgrades; pantallas de elección y conexión a bajas. Validación de ofertas para impedir aplicaciones repetidas.

**C. Verificación:** `npm run check`: 19 pruebas, lint y build correctos. Pruebas de excedentes, niveles consecutivos, límites y todas las mejoras.

**D. Estado:** progresión funcional; ajuste con jugadores pendiente.

**E. Continuación:** habilidad, interacciones y jefe.

## Fase 7 — Contenido

**A. Resumen:** tres armas seleccionables, pulso, relés, suministros, jefe de dos fases, ataques anticipados, invocaciones y victoria.

**B. Implementación:** AbilitySystem y BossController; Run/WorldManager ampliados; tests de contenido. El jefe aparece a los seis minutos o al activar tres relés.

**C. Verificación:** `npm run check`: 23 pruebas, lint y build correctos. Primera prueba de navegador: carga, movimiento, salto, pausa, daño y reinicio, sin excepciones.

**D. Estado:** ciclo completo implementado; presentación y comprobación detallada de jefe pendientes en ese momento.

**E. Continuación:** presentación y QA ampliada.

## Fase 8 — Presentación

**A. Resumen:** HUD, radar, brújula, menús, tarjetas, audio sintetizado, partículas, números de daño, opciones y metaprogresión.

**B. Implementación:** HUD, Screens, UI revisada, estilos, AudioManager, ParticleSystem, SaveSystem y adaptador opcional AssetLoader. Cámara desplazada al hombro después de revisar capturas; disparos convergen en la mira. Recursos originales sin descargas artísticas.

**C. Verificación:** 25 pruebas de lógica y compilación. Cuatro pruebas de navegador llegaron a pasar: movimiento/reinicio, opciones persistentes, combate/mejoras y relés/jefe/victoria. Se revisaron capturas de menú, juego, tarjetas y jefe. Hubo fallos iniciales en los tests por observación tardía de salto, puntería de escenario de prueba y suposición incorrecta de un nivel por cada relé; se corrigieron los escenarios y la sincronización.

**D. Estado:** presentación funcional. Audio generado comprobado técnicamente, sin valoración auditiva humana. Adaptador GLTF no probado con archivos externos.

**E. Continuación:** balance, rendimiento y documentación.

## Fase 9 — Calidad

**A. Resumen:** pruebas ampliadas, simulación de partidas completas, correcciones de balance, agrupación de geometrías, limpieza y documentación.

**B. Implementación:** scripts de simulación/benchmark, pruebas adicionales, limpieza de instancias/listeners, seis documentos. El robo de vida usa daño efectivo; el lanzador no aplica dos veces el daño; umbral de niveles avanzado crece cuadráticamente. La horda reserva un espacio para el jefe. La terminal de victoria no puede convertirse en derrota por un proyectil posterior del mismo tick.

**C. Verificación:** resultados finales, comandos y métricas en `TESTING.md` y `docs/qa/`. El primer benchmark a 1080p con 64 enemigos detectó 1097 draw calls y ~4 FPS en SwiftShader. Se agruparon anatomías estáticas por tipo en dos buffers y se instanciaron partes repetidas del escenario. Se midió de nuevo, sin prometer 60 FPS por extrapolación.

**D. Estado:** 28 pruebas unitarias y 5 escenarios de navegador pasan, sin errores de consola; lint y build correctos. Consultar evidencias finales y límites en TESTING. La simulación con puntería perfecta no sustituye el balance humano ni la prueba en una GPU de gama media. Los 60 FPS no se alcanzaron en SwiftShader.

**E. Continuación:** ROADMAP enumera pasos ejecutables. La última simulación completó las tres semillas en 371–428 segundos simulados, con estadísticas normales y prioridad al jefe. El servidor local respondió HTTP 200 al cerrar la verificación. No hay bloqueo de instalación ni publicación pendiente.
