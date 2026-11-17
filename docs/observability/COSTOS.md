# Ampliación de observabilidad: presupuesto para aprobar

Inspección: **17 de noviembre de 2026**, `us-east-2`. **No se ha aprobado ni provisionado esta ampliación.** La aprobación del clúster anterior no se reutiliza.

## Estimación incremental

Linux On-Demand, 730 horas/mes, dos nodos en `us-east-2b`, EBS gp3 con rendimiento base, sin snapshots adicionales. No incluye el costo del clúster existente ni de `redhorizon_last` y `superkanes`.

| Recurso | Supuesto | USD/mes |
|---|---|---:|
| rh-observability | t3.medium, 2 vCPU / 4 GiB, USD 0,0416/h | 30,37 |
| rh-events | t3.medium, 2 vCPU / 4 GiB, USD 0,0416/h | 30,37 |
| EBS cifrado | 30 + 40 GiB gp3 × USD 0,08 | 5,60 |
| IPv4 públicas para salida | 2 × 730 h × USD 0,005; sin entrada pública | 7,30 |
| **Base incremental** | Cálculo antes de redondear filas | **73,64** |
| Tráfico administrativo saliente | Reserva de 10 GB × USD 0,09, sin descontar franquicia compartida | 0,90 |
| API CloudWatch | Hasta 289.080 GetMetricStatistics/mes × USD 0,01/1.000 si la franquicia está agotada | 2,89 |
| **Escenario conservador** | Sin impuestos | **77,43** |

**Importe propuesto para autorización: USD 78/mes adicionales, antes de impuestos**, bajo esos supuestos. Es una estimación, no un límite automático de factura. Tráfico mayor, recursos retenidos, reintentos adicionales o cambios de arquitectura pueden aumentarlo. No hay NAT Gateway, ALB, MSK, Cognito, CloudWatch Logs ni monitoreo detallado nuevos.

Los 100 GB de salida gratuita se comparten a nivel de cuenta/servicios/regiones; no se presupuestan como disponibles. GetMetricStatistics permite aprovechar la franquicia compartida de un millón de solicitudes; no se usa GetMetricData. Se consultan tres métricas de la principal y cinco de cada T3, cada cinco minutos; los reintentos son limitados. CloudWatch puede retrasar muestras.

T3 queda en modo **standard**, sin cargos Unlimited por créditos excedentes. Si agota créditos, puede reducir rendimiento: hay que observar CPUCreditBalance antes de aumentar carga.

## Créditos y cuotas comprobados

- Plan de cuenta: `FREE`, `ACTIVE`.
- Crédito restante informado por `freetier:GetAccountPlanState`: **USD 67,47**.
- Vencimiento informado: **2027-05-10 20:16:19 UTC**.
- Ese saldo es compartido con los recursos existentes; no cubre un mes completo de esta ampliación por sí solo.
- Cuota regional Standard On-Demand: **16 vCPU**, ajustable. Las siete EC2 actualmente encendidas consumen 14 vCPU; agregar las dos propuestas requiere **18**. Solicitar 20 antes de provisionar, sin detener las instancias ajenas.
- `t3.medium` figura disponible como tipo ofertado en `us-east-2b`; no equivale a reservar capacidad física.
- AMI Canonical observada: `ami-096d6538c463eb1db`, Ubuntu 24.04 amd64. Verificar nuevamente dueño, estado y versión al ejecutar.
- Cost Explorer rechazó la consulta: **“User not enabled for cost explorer access”**. No hay cifra verificada de gasto acumulado; no se activó un servicio de facturación para obtenerla.
- Consumo AWS incremental de esta implementación: **ningún recurso nuevo creado**.

Las respuestas completas están en `.cluster-local/observability/`, excluidas de Git. `inspect-costs.py` permite repetir la inspección sin mutaciones.

## Por qué dos máquinas y estos tamaños

Kafka se separa de Prometheus/panel para que JVM, recuperación del broker y escritura de segmentos no compitan con consultas ni simulación. Una sola VM abarataría EC2/IPv4, pero compartiría memoria, disco y fallos; no es la opción propuesta.

En el laboratorio corto, Kafka utilizó aproximadamente 0,4 GiB y Prometheus entre 0,04 y 0,13 GiB. **Esto no dimensiona siete días de producción.** La configuración reserva hasta 2,5 GiB al contenedor Kafka, heap máximo 768 MiB y margen para page cache/OS. En observabilidad, Prometheus tiene techo 1,2 GiB, panel 512 MiB y agente 128 MiB; 4 GiB deja margen para OS, Docker y crecimiento. Revisar a las 24–72 horas reales antes de reducir tamaños. No se modifica la capacidad de partidas existente.

## Salida y apagado

Dos IPv4 con Security Groups cerrados de entrada cuestan USD 7,30/mes. Un NAT Gateway en Ohio añade aproximadamente USD 32,85/mes de horas, su IPv4 y procesamiento por GB; no se introduce. Endpoints privados de SSM tampoco sustituyen automáticamente la descarga de paquetes/imágenes y tienen cargos por endpoint/hora y datos. Esta propuesta conserva salida 80/443 y DNS de la VPC, además de flujos privados expresos.

Las EC2 quedan en la misma AZ para no introducir transferencia entre AZ en la telemetría. No ofrece tolerancia a perder esa AZ.

Al detener ambas EC2 cesa cómputo; las IPv4 automáticas se liberan, pero **EBS continúa facturando USD 5,60/mes**. La plantilla retiene instancias/volúmenes: borrar el stack no es un mecanismo de apagado ni garantiza eliminar costos. Véase RUNBOOK.

## Fuentes

- Precio t3.medium consultado en AWS Pricing API, Ohio/Linux/Shared; evidencia local `observability-pricing.json`.
- [EBS gp3 y precio base](https://aws.amazon.com/ebs/general-purpose/).
- [IPv4 y NAT Gateway](https://aws.amazon.com/vpc/pricing/).
- [Transferencia de EC2](https://aws.amazon.com/ec2/pricing/on-demand/).
- [GetMetricStatistics y franquicia de solicitudes](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_billing.html).
- [Precios CloudWatch](https://aws.amazon.com/cloudwatch/pricing/).
