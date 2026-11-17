# Costos de observabilidad — configuración compartida

Presupuesto incremental aprobado: **USD 141/mes**. Región `us-east-2`, 17/11/2026.

La cuota de 16 vCPU impide las dos EC2 inicialmente propuestas. Se implementa **una m7i-flex.large (2 vCPU, 8 GiB)** para panel, Prometheus y Kafka; mantiene las cinco máquinas del juego y no modifica las dos instancias ajenas. No se cambia el plan de cuenta.

| Concepto | Supuesto | USD/mes |
|---|---|---:|
| EC2 Linux | 730 h × 0,09576, tarifa consultada en AWS Pricing | 69,90 |
| EBS gp3 cifrado | 70 GiB × 0,08 | 5,60 |
| IPv4 de salida | 730 h × 0,005 | 3,65 |
| Salida administrativa | Reserva 10 GB × 0,09 | 0,90 |
| API CloudWatch | Reserva conservadora 254.040 consultas × 0,01/1.000 | 2,54 |
| **Estimación incremental** | Antes de impuestos | **82,60** |

Sin NAT Gateway, ALB, MSK, almacenamiento de logs CloudWatch ni monitoreo detallado nuevos. IPv4 solo para salida; los servicios nuevos no aceptan tráfico público. Comunicación privada en la misma zona. No se descuentan franquicias compartidas; más tráfico o almacenamiento retenido pueden aumentar el importe. El presupuesto no es un límite automático de facturación.

Crédito observado previamente: USD 67,47, vencimiento 10/05/2027; compartido con toda la cuenta. Elegibilidad Free Tier no significa costo cero. Cost Explorer devolvió “User not enabled for cost explorer access”; no hay gasto acumulado verificado de la ampliación. Las métricas de bytes del panel no representan una factura.

Kafka comparte host y disco con observabilidad: no tiene alta disponibilidad. Límites de memoria separados para Kafka, Prometheus, panel y agente; medir margen bajo uso real antes de aumentar retención. La pérdida de esta VM interrumpe observabilidad, no debe detener partidas.
