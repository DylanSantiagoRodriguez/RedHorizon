#!/usr/bin/env python3
"""Isolated TLS Kafka laboratory; never touches AWS or existing containers."""
import json,os,sys,subprocess,uuid
from pathlib import Path
sys.path.insert(0,str(Path('scripts/cluster').resolve()))
from pki import generate,ROOT
out=Path('.cluster-local/observability');out.mkdir(parents=True,exist_ok=True)
names=['rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator','rh-observability','rh-events','rh-kafka-admin','rh-panel-consumer']
keys=ROOT/('observability-lab-'+str(uuid.uuid4()))
generate(keys,{n:'127.0.0.1' for n in names})
# Bundle only each identity's own key and certificate. Never copy the CA private key.
for n in names:
 p=keys/(n+'.bundle.pem');p.write_bytes((keys/(n+'.key')).read_bytes()+(keys/(n+'.crt')).read_bytes());p.chmod(0o600)
props='''process.roles=broker,controller
node.id=1
controller.quorum.bootstrap.servers=rh-events:9094
controller.listener.names=CONTROLLER
listeners=CLIENT://0.0.0.0:9093,INTERNAL://0.0.0.0:9095,CONTROLLER://0.0.0.0:9094
advertised.listeners=CLIENT://127.0.0.1:19093,INTERNAL://rh-events:9095
listener.security.protocol.map=CLIENT:SSL,INTERNAL:SSL,CONTROLLER:SSL
inter.broker.listener.name=INTERNAL
ssl.keystore.type=PEM
ssl.keystore.location=/tls/rh-events.bundle.pem
ssl.truststore.type=PEM
ssl.truststore.location=/tls/ca.crt
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
num.partitions=3
log.retention.hours=24
log.retention.bytes=268435456
log.segment.bytes=16777216
log.retention.check.interval.ms=30000
message.max.bytes=65536
socket.request.max.bytes=1048576
num.network.threads=2
num.io.threads=2
group.initial.rebalance.delay.ms=0
'''
(out/'server.properties').write_text(props)
(out/'admin.properties').write_text('security.protocol=SSL\nssl.keystore.type=PEM\nssl.keystore.location=/tls/rh-kafka-admin.bundle.pem\nssl.truststore.type=PEM\nssl.truststore.location=/tls/ca.crt\nssl.endpoint.identification.algorithm=https\n')
image='apache/kafka@sha256:833b867a9585a141da455dc2b57431c65cbccb27f11c91f694444cca9f777e0f'
# Bind only localhost. A dedicated container is recreated only by explicit cleanup.
container='rh-observability-kafka-lab'
assert subprocess.run(['docker','inspect',container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0,'Existing lab: stop/remove it explicitly before recreating'
mounts=[]
for n in ['rh-events.bundle.pem','rh-kafka-admin.bundle.pem','ca.crt']:
 mounts+=['-v',str((keys/n).resolve())+':/tls/'+n+':ro']
args=['docker','run','-d','--name',container,'--hostname','rh-events','--cpus','2','--memory','2500m','--user','0','-p','127.0.0.1:19093:9093','-e','KAFKA_HEAP_OPTS=-Xms256m -Xmx768m',*mounts,'-v',str(out.resolve())+':/config:ro',image,'bash','-ec','mkdir -p /var/lib/kafka/data; [ -f /var/lib/kafka/data/meta.properties ] || /opt/kafka/bin/kafka-storage.sh format --standalone -t $(/opt/kafka/bin/kafka-storage.sh random-uuid) -c /config/server.properties; exec /opt/kafka/bin/kafka-server-start.sh /config/server.properties']
subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
(out/'lab.json').write_text(json.dumps({'keys':str(keys),'container':container,'broker':'127.0.0.1:19093'},indent=2))
print('Isolated Kafka started; keys stored in approved directory; configuration in',out)
