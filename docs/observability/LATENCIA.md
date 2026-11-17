# Control de ráfagas del cliente

Se limita el envío de inputs por tiempo real a 60/s, con ráfaga máxima de dos. Los pasos de simulación recuperados después de bloquearse el navegador no generan una cola ilimitada de comandos atrasados. Si hay más de 4 KiB pendientes, se conserva la acción todavía no enviada y se espera a que baje la cola. No cambia el protocolo, la simulación autoritativa ni los límites del servidor.

Validación: siete pruebas de cliente aprobadas, incluyendo 200 intentos con el mismo reloj y preservación de acciones bajo presión; compilación de producción y lint de los archivos cambiados aprobados. Despliegue solo del frontend con recarga gradual Nginx y conservación de assets anteriores. Las pestañas ya abiertas mantienen su código hasta que el jugador recargue voluntariamente.

Esto reduce una fuente de ráfagas y acumulación, pero no demuestra un RTT estable de 100 ms. El p95 del panel agrega conexiones durante cinco minutos; incluye picos de red y demoras del navegador. No se alteró el cálculo para ocultarlos. Se requiere observar nuevas sesiones con el frontend actualizado para medir el efecto real. La geografía, WiFi, ISP y carga del equipo siguen influyendo.
