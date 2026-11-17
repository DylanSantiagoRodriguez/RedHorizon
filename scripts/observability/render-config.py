#!/usr/bin/env python3
"""Render nonsecret production config only. Explicit seven-node inventory required."""
import argparse,json,ipaddress
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('inventory');p.add_argument('output');a=p.parse_args()
i=json.loads(Path(a.inventory).read_text());nodes=i['nodes'];out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
ids=['rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator','rh-observability','rh-events']
assert set(nodes)==set(ids);assert i['origin']=='https://redhorizon.lat'
for n in nodes.values(): assert ipaddress.ip_address(n['privateIp']).is_private
obs=nodes['rh-observability']['privateIp'];broker=nodes['rh-events']['privateIp']+':9093'
def write(name,value): (out/name).write_text(json.dumps(value,indent=2)+'\n')
for id in ids:
 tls='/etc/redhorizon-observer/tls'
 write(id+'.agent.json',{'nginxLog':'/var/log/redhorizon-observer/nginx.log' if id=='rh-gateway' else None,'id':id,'host':nodes[id]['privateIp'],'port':9400,'tlsDir':tls,'kafka':{'brokers':[broker],'tlsDir':tls,'identity':id},'service': 'redhorizon-kafka' if id=='rh-events' else 'redhorizon-panel' if id=='rh-observability' else 'redhorizon-cluster','certificates':([{'purpose':'game','path':'/etc/redhorizon-cluster/tls/'+id+'.crt'}]+([{'purpose':'public','path':'/etc/redhorizon-observer/public.crt'}] if id=='rh-gateway' else [])) if id in ids[:5] else [],'revisionFile':'/srv/redhorizon-observability/current/runtime/release.json'})
write('panel.json',{'host':obs,'port':8444,'origin':i['origin'],'prometheus':'http://127.0.0.1:9090','dbPath':'/var/lib/redhorizon-panel/events.db','usersFile':'/etc/redhorizon-panel/users.json','awsMetrics':True,'tls':{k:'/etc/redhorizon-panel/tls/'+f for k,f in [('ca','ca.crt'),('cert','rh-observability.crt'),('key','rh-observability.key')]},'kafka':{'brokers':[broker],'tlsDir':'/etc/redhorizon-panel/tls','identity':'rh-panel-consumer'},'nodes':[dict(id=id,role='Entrada HTTPS/WSS' if id=='rh-gateway' else 'Simulación autoritativa' if id.startswith('rh-game') else 'Asignación de salas y Redis' if id=='rh-coordinator' else 'Métricas y panel' if id=='rh-observability' else 'Eventos Kafka',instanceId=nodes[id]['instanceId'],instanceType=nodes[id]['instanceType'],physicalId=nodes[id].get('physicalId'),kind=nodes[id].get('kind','vm')) for id in ids]})
jobs=[]
for id in ids:
 if nodes[id].get('physicalId'): continue
 jobs.append({'job_name':id,'scheme':'https','sample_limit':1024,'label_limit':8,'static_configs':[{'targets':[nodes[id]['privateIp']+':9400']}],'tls_config':{'ca_file':'/etc/prometheus/tls/ca.crt','cert_file':'/etc/prometheus/tls/rh-observability.crt','key_file':'/etc/prometheus/tls/rh-observability.key','server_name':id}})
jobs.append({'job_name':'panel','static_configs':[{'targets':['127.0.0.1:9401']}],'sample_limit':128})
write('prometheus.json',{'global':{'scrape_interval':'5s','scrape_timeout':'2s'},'scrape_configs':jobs})
write('hosts.json',{**{id:nodes[id]['privateIp'] for id in ids},'rh-panel-consumer':obs,'rh-kafka-admin':nodes['rh-events']['privateIp']})
props='''process.roles=broker,controller
node.id=1
controller.quorum.bootstrap.servers=127.0.0.1:9094
controller.listener.names=CONTROLLER
listeners=CLIENT://__IP__:9093,CONTROLLER://127.0.0.1:9094
advertised.listeners=CLIENT://__IP__:9093
listener.security.protocol.map=CLIENT:SSL,CONTROLLER:SSL
inter.broker.listener.name=CLIENT
ssl.keystore.type=PEM
ssl.keystore.location=/config/tls/rh-events.bundle.pem
ssl.truststore.type=PEM
ssl.truststore.location=/config/tls/ca.crt
ssl.client.auth=required
ssl.endpoint.identification.algorithm=https
ssl.enabled.protocols=TLSv1.2,TLSv1.3
authorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer
allow.everyone.if.no.acl.found=false
super.users=User:CN=rh-events;User:CN=rh-kafka-admin
log.dirs=/var/lib/kafka/data
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
default.replication.factor=1
min.insync.replicas=1
auto.create.topics.enable=false
num.partitions=1
log.retention.hours=24
log.retention.bytes=268435456
log.segment.bytes=16777216
log.retention.check.interval.ms=30000
message.max.bytes=65536
socket.request.max.bytes=1048576
queued.max.requests=20
num.network.threads=2
num.io.threads=2
group.initial.rebalance.delay.ms=1000
'''.replace('__IP__',nodes['rh-events']['privateIp'])
(out/'server.properties').write_text(props)
(out/'nginx-ops.conf').write_text(Path('deploy/observability/nginx-ops.conf').read_text().replace('__OBS_PRIVATE_IP__',obs))
print('Rendered nonsecret configuration for seven nodes:',out)
