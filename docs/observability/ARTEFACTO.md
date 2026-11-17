# Artefacto desplegado

Revisión de runtime y panel: `c32a58f60c44644e59a4f65c0cb2fce5098957ab`.

- Node Linux 22.23.5, SHA-256 comprobado antes de empaquetar.
- Kafka 4.4.0 y Prometheus 3.16.0 fijados por digest en unidades systemd.
- Dependencias instaladas desde package-lock.json fuera de las EC2.
- Observabilidad se instala en `/srv/redhorizon-observability/releases/<revision>`.
- Backend del juego actualizado mediante delta verificado de 17 archivos (382.263 bytes), preservando Node, dependencias y frontend de la versión anterior. No compila en máquinas de juego.
- El Nginx público conserva el frontend separado `46db0d794527c7bb084fab4db518f544c7efc723` y sus arreglos de texturas/animación.
- CloudFormation agrega una m7i-flex.large de 8 GiB con EBS gp3 cifrado de 70 GiB. Kafka comparte VM; no se duplica la medición física.
- Certificados, usuarios y llaves se distribuyen por separado, nunca dentro de artefactos o Git.

El mapa SVG incluye gateway, tres workers, coordinador, Kafka y observabilidad. Las flechas solo se animan con actividad medida reciente; valores ausentes se indican como tales.
