# Artefacto preparado para despliegue

**No desplegado en AWS.** Requiere la aprobación de [COSTOS.md](COSTOS.md), cuota suficiente y completar [RUNBOOK.md](RUNBOOK.md).

- Revisión de código: `4f77593ac7747ed3794fad5c6ed229b50d40d3fe`.
- Archivo local: `.cluster-local/observability/artifacts/redhorizon-observability-4f77593ac7747ed3794fad5c6ed229b50d40d3fe.tar.gz`.
- Tamaño: 65,883,445 bytes.
- SHA-256: `200e691a2e86e7737f48383e0683a2ace37c759a2e3bfce1a6f42edfb4def309`.
- Node Linux x64: 22.23.5, archivo oficial verificado por checksum.
- Kafka: 4.4.0, digest `sha256:833b867a9585a141da455dc2b57431c65cbccb27f11c91f694444cca9f777e0f`.
- Prometheus: 3.16.0, digest fijado en la unidad systemd.
- Plantilla: exactamente dos nuevas `c7i-flex.large`, sin gestionar las instancias existentes.

La inspección del tar confirmó runtime, panel, bootstrap Kafka, plantilla correcta y ausencia de archivos PEM, claves privadas, usuarios y datos de inscripción MFA. No se subió el binario a un bucket ni se creó almacenamiento de pago. El paquete anterior fue apartado en `artifacts/superseded/` y **no debe desplegarse**.

Las modificaciones posteriores a esta revisión que solo documenten el checksum no alteran el código empaquetado. La entrega de código, IaC y procedimientos está en `main`; este artefacto local está excluido de Git.
