# Artefacto preparado para despliegue

**No desplegado en AWS.** El presupuesto de [COSTOS.md](COSTOS.md) ya está aprobado; requiere cuota suficiente y completar [RUNBOOK.md](RUNBOOK.md).

- Revisión de código: `3c9a02d4be540f0178712111f5ab6f671fe4e343`.
- Archivo local: `.cluster-local/observability/artifacts/redhorizon-observability-3c9a02d4be540f0178712111f5ab6f671fe4e343.tar.gz`.
- Tamaño: 65,885,066 bytes.
- SHA-256: `770fdade8b436b2d415454b5893babc6a5abc12181dfe2e5b1bdff1a3396bfa8`.
- Node Linux x64: 22.23.5, archivo oficial verificado por checksum.
- Kafka: 4.4.0, digest `sha256:833b867a9585a141da455dc2b57431c65cbccb27f11c91f694444cca9f777e0f`.
- Prometheus: 3.16.0, digest fijado en la unidad systemd.
- Plantilla: exactamente dos nuevas `c7i-flex.large`, sin gestionar las instancias existentes.

La inspección del tar confirmó runtime, panel, bootstrap Kafka, plantilla correcta y ausencia de archivos PEM, claves privadas, usuarios y datos de inscripción MFA. No se subió el binario a un bucket ni se creó almacenamiento de pago. El paquete anterior fue apartado en `artifacts/superseded/` y **no debe desplegarse**.

Las modificaciones posteriores a esta revisión que solo documenten el checksum no alteran el código empaquetado. La entrega de código, IaC y procedimientos está en `main`; este artefacto local está excluido de Git.

Incluye el mapa de flujo de servidores, flechas asociadas a tráfico medido y estados sin muestras. Se verificó su carga en Chromium sin repetir la batería completa.
