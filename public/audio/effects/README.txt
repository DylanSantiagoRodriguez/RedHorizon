Efectos y música proporcionados para Red Horizon

instrumental_music.mp3: música en bucle durante la partida y el epílogo.
spaceship_fire.mp3: bucle junto al naufragio; se atenúa hasta silenciarse a 32 m
del centro de la nave. Paneo estéreo según la orientación de la cámara.
spaceship_aurora.mp3: propulsores en bucle únicamente durante el plano final de Aurora.
altar_boss.mp3: una reproducción al activar correctamente un altar.
beacon_launch.mp3: una reproducción al lanzar la baliza.

Los efectos de altar y lanzamiento sustituyen los tonos sintéticos de esos eventos.
La música y los propulsores de Aurora bajan de volumen durante la narración.
El volumen general controla todos los archivos. Se pausan con el juego y se
reinician al comenzar una partida nueva. No se modifica el MP3 original.
Implementación: src/audio/SceneAudio.js y AudioManager.js.
