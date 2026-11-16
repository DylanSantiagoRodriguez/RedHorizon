# Presupuesto previo a aprobación

Consulta del 16 de noviembre de 2026. Free Plan ACTIVE, crédito restante observado **USD 74,06**, vencimiento informado `2027-05-10T20:16:19.490Z` (15:16 hora Bogotá), o antes al agotar créditos. Cost Explorer respondió `AccessDeniedException: User not enabled for cost explorer access`; no se obtuvo gasto histórico real. No se habilitó el servicio ni se cambió el plan.

Tarifas On-Demand Linux Shared de Ohio consultadas con AWS Pricing API: t3.micro 0,0104 USD/h; t3.small 0,0208 USD/h; m7i-flex.large 0,09576 USD/h. gp3: 0,08 USD/GiB-mes, sin IOPS ni throughput extra. IPv4: 0,005 USD/h según [AWS VPC](https://aws.amazon.com/vpc/pricing/).

Base de cálculo: 730 h/mes, sin impuestos, transferencias, snapshots temporales, servicios opcionales ni descuentos/créditos.

| Recurso | USD/mes |
|---|---:|
| 2 nuevas t3.micro + 2 nuevas t3.small | 45,55 |
| 4 discos nuevos gp3 de 20 GiB | 6,40 |
| 4 IPv4 nuevas | 14,60 |
| **Incremento por las cuatro nuevas** | **66,55** |
| Principal existente: EC2 + 8 GiB + IPv4 | 74,19 |
| **Arquitectura de cinco EC2** | **140,75** |
| Otras dos instancias existentes, fuera de alcance | 86,08 |
| **Cuenta con siete EC2 encendidas** | **226,82** |

A ese consumo base de toda la cuenta, USD 74,06 equivaldrían aproximadamente a **9,9 días**. Es una proyección, no una garantía de vencimiento: otras cargas y beneficios pueden cambiarla.

Laboratorio: cuatro nuevas encendidas 8 h consumen aproximadamente **USD 0,66** en EC2+IPv4, además del almacenamiento prorrateado. Detenerlas mantiene **USD 6,40/mes** de discos mientras existan. Una IP pública automática se libera al detener la instancia; no se propone reservar EIP.

La principal requiere plan aparte para cifrar/reemplazar su disco. Llevarlo de 8 a 20 GiB suma unos **USD 0,96/mes**; snapshots y coexistencia de volúmenes son adicionales y requieren estimación final antes de ejecutar.

## Tráfico y conectividad

[AWS EC2](https://aws.amazon.com/ec2/pricing/on-demand/) indica 100 GB/mes de salida gratuita agregada por cuenta, no por instancia; después, el primer tramo aplicable de Ohio es aproximadamente 0,09 USD/GB. Ejemplo: 200 GB totales y sin otros consumos del cupo implicarían unos 9 USD adicionales. No es una predicción de tráfico del juego. Entre IP privadas en la misma AZ no se propone cruzar AZ ni usar IP públicas para las llamadas internas.

Comparación: cuatro IP para los nodos que podrían ser privados cuestan 14,60 USD/mes; un NAT Gateway en Ohio parte de 32,85 USD/mes más su IPv4 (3,65) y procesamiento (0,045 USD/GB). Los endpoints de interfaz tienen precio por AZ/hora y datos, con al menos los servicios necesarios para SSM y salida adicional para paquetes. Se elige IPv4 restringida para el laboratorio; se debe revisar el aislamiento antes de producción permanente.

T3 Standard evita el cargo de créditos excedentes de Unlimited, pero al agotar créditos puede limitar CPU. No equivale a CPU sostenida garantizada. No activar Unlimited automáticamente.

Reproducir cálculo: `python3 scripts/cluster/estimate.py`.

**Pendiente aprobar:** cuatro nuevas por laboratorio temporal o funcionamiento continuo, límite de gasto y horario de apagado. Esta aprobación no incluye detener las otras dos instancias, cambiar el plan AWS o contratar servicios adicionales.
