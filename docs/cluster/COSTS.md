# Costos y consumo observado

Consulta del 16 de noviembre de 2026. Free Plan ACTIVE, crédito restante observado **USD 74,06**, vencimiento informado `2027-05-10T20:16:19.490Z` (15:16 hora Bogotá), o antes al agotar créditos. Cost Explorer respondió `AccessDeniedException: User not enabled for cost explorer access`; no se obtuvo gasto histórico real. No se habilitó el servicio ni se cambió el plan.

Tarifas On-Demand Linux Shared de Ohio consultadas con AWS Pricing API: t3.micro 0,0104 USD/h; t3.small 0,0208 USD/h; m7i-flex.large 0,09576 USD/h. gp3: 0,08 USD/GiB-mes, sin IOPS ni throughput extra. IPv4: 0,005 USD/h según [AWS VPC](https://aws.amazon.com/vpc/pricing/).

Base de cálculo: 730 h/mes, sin impuestos, transferencias, snapshots temporales, servicios opcionales ni descuentos/créditos.

| Recurso | USD/mes |
|---|---:|
| 2 nuevas t3.micro + 2 nuevas t3.small | 45,55 |
| 4 discos nuevos gp3 de 20 GiB | 6,40 |
| 4 IPv4 nuevas | 14,60 |
| **Incremento por las cuatro nuevas** | **66,55** |
| Principal: EC2 + 20 GiB cifrados + IPv4 | 75,15 |
| Disco original de 8 GiB conservado para recuperación | 0,64 |
| **Arquitectura de cinco EC2** | **142,35** |
| Otras dos instancias existentes, fuera de alcance | 86,08 |
| **Cuenta con siete EC2 encendidas** | **228,42** |

A ese consumo base de toda la cuenta, USD 74,06 equivaldrían aproximadamente a **9,9 días aproximadamente**. Es una proyección, no una garantía de vencimiento: otras cargas y beneficios pueden cambiarla.

Laboratorio: cuatro nuevas encendidas 8 h consumen aproximadamente **USD 0,66** en EC2+IPv4, además del almacenamiento prorrateado. Detenerlas mantiene **USD 6,40/mes** de discos mientras existan. Una IP pública automática se libera al detener la instancia; no se propone reservar EIP.

La principal ya usa un volumen cifrado de 20 GiB. Se conserva el original de 8 GiB, por lo que el incremento frente al diseño con raíz de 8 GiB es **USD 1,60/mes**. El snapshot previo añade hasta unos **USD 0,40/mes** con tarifa estándar de 0,05 USD/GB-mes; se factura el espacio efectivamente almacenado. No se habilitó Fast Snapshot Restore ni inicialización de pago.

## Tráfico y conectividad

[AWS EC2](https://aws.amazon.com/ec2/pricing/on-demand/) indica 100 GB/mes de salida gratuita agregada por cuenta, no por instancia; después, el primer tramo aplicable de Ohio es aproximadamente 0,09 USD/GB. Ejemplo: 200 GB totales y sin otros consumos del cupo implicarían unos 9 USD adicionales. No es una predicción de tráfico del juego. Entre IP privadas en la misma AZ no se propone cruzar AZ ni usar IP públicas para las llamadas internas.

Comparación: cuatro IP para los nodos que podrían ser privados cuestan 14,60 USD/mes; un NAT Gateway en Ohio parte de 32,85 USD/mes más su IPv4 (3,65) y procesamiento (0,045 USD/GB). Los endpoints de interfaz tienen precio por AZ/hora y datos, con al menos los servicios necesarios para SSM y salida adicional para paquetes. Se elige IPv4 restringida para el laboratorio; se debe revisar el aislamiento antes de producción permanente.

T3 Standard evita el cargo de créditos excedentes de Unlimited, pero al agotar créditos puede limitar CPU. No equivale a CPU sostenida garantizada. No activar Unlimited automáticamente.

Reproducir cálculo: `python3 scripts/cluster/estimate.py`.

La ejecución continuó por instrucción del propietario después de presentar la estimación. Las cuatro nuevas permanecen encendidas; no se cambió el plan AWS ni se detuvieron las otras dos. Saldo consultado de nuevo a las 19:19 Bogotá: **USD 74,06**, sin asumir facturación en tiempo real. No se pudo obtener consumo monetario histórico de Cost Explorer. `observe.py` guarda CPU, créditos y tráfico realmente observados en CloudWatch; esas métricas no equivalen a una factura.

## Transferencia medida del ensayo

Con 12 jugadores simultáneos durante 120 s, la prueba final recibió 76.170.396 bytes de WebSocket (unos 5,1 Mbit/s agregados), sin contar descarga inicial de recursos. Mantener exactamente ese tráfico 24/7 durante 730 h proyectaría unos 1.668 GB/mes: aproximadamente **USD 141 adicionales** después de un cupo agregado de 100 GB, si sigue disponible íntegro. Es un escenario de ocupación continua, no consumo mensual observado. Los estados comprimidos y de precisión acotada redujeron el tráfico frente al primer ensayo; los recursos estáticos también consumen transferencia.
