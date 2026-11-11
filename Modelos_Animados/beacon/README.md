# Baliza de lanzamiento

Fuente: C:/Users/macab/Downloads/beacon.glb. Preparación reproducible en build.py; entregables beacon.glb y beacon.blend. Altura total 5 m, escala uniforme, materiales originales conservados.

Jerarquía:
- launch_beacon
  - beacon_base: tripo_part_0 (fija)
  - beacon_capsule: tripo_part_1, tripo_part_2, tripo_part_3 (un conjunto rígido)

Las tres piezas móviles conservan geometría, materiales y posiciones relativas; no se fusionan destructivamente. El pivote de la cápsula está en la parte inferior de part_1. engine_socket y cinco gem_socket_* son hijos de la cápsula. Los sockets de gema se distribuyen por el anillo de part_3.

Integración en MissionView mediante BeaconModel: la base permanece en el terreno, la cápsula sigue el recorrido de lanzamiento existente y transporta las cinco gemas y el escape. La pausa detiene el recorrido. Carga tardía recupera el estado de misión; al abandonar partida se liberan recursos. El modelo procedural sirve de respaldo si falla la carga.

Verificación: lint, 124 pruebas unitarias y compilación correctos; navegador comprueba padres de las cuatro piezas, inmovilidad de part_0, desplazamiento idéntico de las otras tres, pausa y gemas. Captura launch.png.
