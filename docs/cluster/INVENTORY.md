# Inventario AWS del despliegue

Estado al 16 de noviembre de 2026: cinco nodos en ejecución; cuatro nuevos y la principal conservada. DNS sigue apuntando a la principal y su cambio corresponde al propietario.

| Función | Instancia | Tipo | IP privada | IP pública |
|---|---|---|---|---|
| rh-game-01 | i-0db322d7e36dea80a | m7i-flex.large | 172.31.16.183 | 77.113.171.135 |
| rh-gateway | i-050759a4168f12f3b | t3.micro | 172.31.25.69 | 3.23.131.44 |
| rh-game-02 | i-0ee8a3a9d7cf9a1f6 | t3.small | 172.31.21.170 | 18.118.158.91 |
| rh-game-03 | i-0173a548389b00fb6 | t3.small | 172.31.22.129 | 3.128.120.165 |
| rh-coordinator | i-06bb1fd55f4634ed3 | t3.micro | 172.31.21.151 | 3.16.129.247 |

Stack: `redhorizon-cluster`, protección contra terminación habilitada. No modifica las otras dos instancias.

Grupos exclusivos:
- GameSecurityGroup: `sg-09a457a3eab1df5bd`
- GatewaySecurityGroup: `sg-0929579efb3434239`
- CoordinatorSecurityGroup: `sg-01d10d3f03ff7797f`

Las cuatro PEM se guardaron en `/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon`, con nombres que comienzan por el rol y terminan en `20261116T234246Z.pem`, modo 600. La llave existente de la principal se conserva.

La PKI interna está en `llaveredhorizon/cluster-20261117-strict`; se distribuye solo el certificado y clave de cada servicio. La CA privada no sale del Mac.

Perfil operativo: `rh-cluster-operator`. Su usuario dedicado solo puede asumir el rol acotado a los cinco IDs. Credenciales de origen en el archivo estándar local de AWS, sin imprimirlas ni copiarlas a EC2. Root se usó para bootstrap de IAM y CloudFormation; no puede asumir roles directamente. MFA del operador humano sigue requiriendo enrolamiento del propietario.

Los cinco nodos tienen SSM Online, IMDSv2 obligatorio/hop 1 y discos activos gp3 cifrados de 20 GiB. Se retiraron las tres reglas SSH temporales. La principal conserva Game + Gateway durante la transición; los otros workers solo Game.

Volumen principal activo: `vol-0ad96b0c2a48bea88`. Original conservado, separado y sin cifrar: `vol-0cb0eae776043b3fd`. Snapshot previo consistente: `snap-06ec86622619fd83b`; tarea `replacevol-00235f7ae161bf7aa` completada. El reinicio mantuvo IP y datos, comprobados con hashes y salud.

HTTPS público en Nginx: certificado propio de Let’s Encrypt para apex y www, vence 14 de febrero de 2027; `certbot.timer` activo y renovación simulada aprobada. PKI interna de 90 días: requiere rotación operativa antes del vencimiento; la CA permanece en el Mac.

Release del clúster en los cinco: `e1fb054af8a3a06f379a3d931ce18630f8e43583`. Capacidad inicial: una sala de cuatro jugadores por worker. El candidato se valida directamente en `3.23.131.44`. Se retiró el puente experimental porque la carga de modelos por la IP antigua no superó el plazo; Caddy/backend originales están restaurados y el timer legado permanece deshabilitado. DNS aún apunta a la IP antigua. Ejecutar `finalize-dns.py` después del cambio externo y de terminar las salas legadas.
