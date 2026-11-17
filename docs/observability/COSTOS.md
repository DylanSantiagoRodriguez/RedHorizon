# Ampliación de observabilidad: presupuesto para aprobar

Inspección: **17 de noviembre de 2026**, `us-east-2`. **No se ha aprobado ni provisionado esta ampliación.** La aprobación del clúster anterior no se reutiliza.

## Estimación incremental

Linux On-Demand, 730 horas/mes, dos nodos en `us-east-2b`, EBS gp3 con rendimiento base, sin snapshots adicionales. No incluye el costo del clúster existente ni de `redhorizon_last` y `superkanes`.

| Recurso | Supuesto | USD/mes |
|---|---|---:|
| rh-observability | c7i-flex.large, 2 vCPU / 4 GiB, USD 0,08479/h | 61,90 |
| rh-events | c7i-flex.large, 2 vCPU / 4 GiB, USD 0,08479/h | 61,90 |
| EBS cifrado | 30 + 40 GiB gp3 × USD 0,08 | 5,60 |
| IPv4 públicas para salida | 2 × 730 h × USD 0,005; sin entrada pública | 7,30 |
| **Base incremental** | Cálculo antes de redondear filas | **136,69** |
| Tráfico administrativo saliente | Reserva de 10 GB × USD 0,09, sin descontar franquicia compartida | 0,90 |
| API CloudWatch | Hasta 254.040 GetMetricStatistics/mes × USD 0,01/1.000 si la franquicia está agotada | 2,54 |
| **Escenario conservador** | Sin impuestos | **140,13** |

**Importe propuesto para autorización: USD 141/mes adicionales, antes de impuestos**, bajo esos supuestos. Es una estimación, no un límite automático de factura. Tráfico mayor, recursos retenidos, reintentos adicionales o cambios de arquitectura pueden aumentarlo. No hay NAT Gateway, ALB, MSK, Cognito, CloudWatch Logs ni monitoreo detallado nuevos.

Los 100 GB de salida gratuita se comparten a nivel de cuenta/servicios/regiones; no se presupuestan como disponibles. GetMetricStatistics permite aprovechar la franquicia compartida de un millón de solicitudes; no se usa GetMetricData. Se consultan tres métricas de cada C7i-flex/M7i-flex y cinco de cada T3, cada cinco minutos; los reintentos son limitados. CloudWatch puede retrasar muestras.

Las dos nuevas C7i-flex no usan créditos T3 ni llevan CreditSpecification. Las T3 existentes conservan su configuración y sus métricas de créditos; esta ampliación no cambia su modo. La familia Flex tiene rendimiento base y capacidad de ráfaga: medir CPU sostenida, no prometer rendimiento ilimitado.

## Créditos y cuotas comprobados

- Plan de cuenta: `FREE`, `ACTIVE`.
- Crédito restante informado por `freetier:GetAccountPlanState`: **USD 67,47**.
- Vencimiento informado: **2027-05-10 20:16:19 UTC**.
- Ese saldo es compartido con los recursos existentes; no cubre un mes completo de esta ampliación por sí solo.
- Cuota regional Standard On-Demand: **16 vCPU**, ajustable. Las siete EC2 actualmente encendidas consumen 14 vCPU; agregar las dos propuestas requiere **18**. Solicitar 20 antes de provisionar, sin detener las instancias ajenas.
- `c7i-flex.large` figura ofertado en `us-east-2b`; no equivale a reservar capacidad física. DescribeInstanceTypes confirmó 2 vCPU/4 GiB y FreeTierEligible=true. Para `t3.medium` confirmó FreeTierEligible=false. El dry-run de t3.medium comprobó autorización IAM, no resuelve esa elegibilidad ni autoriza consumo. Se cambió la propuesta a C7i-flex para conservar el plan actual, sin pasar la cuenta a Paid.
- AMI Canonical observada: `ami-096d6538c463eb1db`, Ubuntu 24.04 amd64. Verificar nuevamente dueño, estado y versión al ejecutar.
- Cost Explorer rechazó la consulta: **“User not enabled for cost explorer access”**. No hay cifra verificada de gasto acumulado; no se activó un servicio de facturación para obtenerla.
- Consumo AWS incremental de esta implementación: **ningún recurso nuevo creado**.

Las respuestas completas están en `.cluster-local/observability/`, excluidas de Git. `inspect-costs.py` permite repetir la inspección sin mutaciones.

## Alternativa más barata que no se ejecuta automáticamente

Dos t3.medium tendrían base aproximada de USD 73,64/mes y un escenario de USD 78/mes con reservas, pero no figuran elegibles para el plan Free de esta cuenta. No se cambia el plan de facturación para utilizarlas. La propuesta que se solicita aprobar es la compatible con el plan actual: USD 141/mes de consumo incremental estimado. Los créditos son compartidos y se agotan; no se promete que continúen los recursos después de agotarlos.

## Por qué dos máquinas y estos tamaños

Kafka se separa de Prometheus/panel para que JVM, recuperación del broker y escritura de segmentos no compitan con consultas ni simulación. Una sola VM abarataría EC2/IPv4, pero compartiría memoria, disco y fallos; no es la opción propuesta.

En el laboratorio corto, Kafka utilizó aproximadamente 0,4 GiB y Prometheus entre 0,04 y 0,13 GiB. **Esto no dimensiona siete días de producción.** La configuración reserva hasta 2,5 GiB al contenedor Kafka, heap máximo 768 MiB y margen para page cache/OS. En observabilidad, Prometheus tiene techo 1,2 GiB, panel 512 MiB y agente 128 MiB; 4 GiB deja margen para OS, Docker y crecimiento. Revisar a las 24–72 horas reales antes de reducir tamaños. No se modifica la capacidad de partidas existente.

## Salida y apagado

Dos IPv4 con Security Groups cerrados de entrada cuestan USD 7,30/mes. Un NAT Gateway en Ohio añade aproximadamente USD 32,85/mes de horas, su IPv4 y procesamiento por GB; no se introduce. Endpoints privados de SSM tampoco sustituyen automáticamente la descarga de paquetes/imágenes y tienen cargos por endpoint/hora y datos. Esta propuesta conserva salida 80/443 y DNS de la VPC, además de flujos privados expresos.

Las EC2 quedan en la misma AZ para no introducir transferencia entre AZ en la telemetría. No ofrece tolerancia a perder esa AZ.

Al detener ambas EC2 cesa cómputo; las IPv4 automáticas se liberan, pero **EBS continúa facturando USD 5,60/mes**. La plantilla retiene instancias/volúmenes: borrar el stack no es un mecanismo de apagado ni garantiza eliminar costos. Véase RUNBOOK.

## Fuentes

- Precio c7i-flex.large consultado en AWS Pricing API, Ohio/Linux/Shared; evidencia local `c7i-pricing.json`. El precio alternativo t3.medium está en `observability-pricing.json`.
- [Tipos elegibles y duración del plan Free](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html).
- [EBS gp3 y precio base](https://aws.amazon.com/ebs/general-purpose/).
- [IPv4 y NAT Gateway](https://aws.amazon.com/vpc/pricing/).
- [Transferencia de EC2](https://aws.amazon.com/ec2/pricing/on-demand/).
- [GetMetricStatistics y franquicia de solicitudes](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_billing.html).
- [Precios CloudWatch](https://aws.amazon.com/cloudwatch/pricing/).
