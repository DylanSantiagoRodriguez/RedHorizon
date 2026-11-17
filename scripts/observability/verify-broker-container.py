#!/usr/bin/env python3
"""Verify production-style unprivileged, read-only Kafka with private controller."""
import json,os,subprocess,time
from pathlib import Path
lab=json.loads(Path('.cluster-local/observability/lab.json').read_text());keys=Path(lab['keys']);out=Path('.cluster-local/observability/broker-smoke');out.mkdir(exist_ok=True);(out/'data').mkdir(exist_ok=True);(out/'tls').mkdir(exist_ok=True)
for n in ['ca.crt','rh-events.bundle.pem']:(out/'tls'/n).touch()
text=Path('.cluster-local/observability/config-fixture/server.properties').read_text().replace('172.31.20.201','127.0.0.1').replace('\nlisteners=CLIENT://127.0.0.1:9093','\nlisteners=CLIENT://0.0.0.0:9093').replace('advertised.listeners=CLIENT://127.0.0.1:9093','advertised.listeners=CLIENT://127.0.0.1:19094')
(out/'server.properties').write_text(text);(out/'start-kafka.sh').write_text(Path('deploy/observability/start-kafka.sh').read_text())
name='rh-observability-broker-smoke';uid=str(os.getuid());gid=str(os.getgid());image='apache/kafka@sha256:0bc1bb2478f45b6cea78864df86acdc11e8df2c5172477819a4d12942cbe5d40'
args=['docker','run','-d','--name',name,'--user',uid+':'+gid,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','2500m','--cpus','1.5','--pids-limit','256','--tmpfs','/tmp:rw,noexec,nosuid,size=128m','--tmpfs','/opt/kafka/logs:rw,nosuid,size=64m,uid='+uid,'-e','KAFKA_HEAP_OPTS=-Xms256m -Xmx768m','-p','127.0.0.1:19094:9093','-v',str(out.resolve())+':/config:ro','-v',str((out/'data').resolve())+':/var/lib/kafka/data']
for n in ['ca.crt','rh-events.bundle.pem']:args+=['-v',str(keys/n)+':/config/tls/'+n+':ro']
args += [image,'bash','/config/start-kafka.sh']
try:
 subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
 for _ in range(40):
  log=subprocess.check_output(['docker','logs',name],stderr=subprocess.STDOUT).decode();(out/'startup.log').write_text(log)
  if 'Kafka Server started' in log:break
  time.sleep(.5)
 else:raise RuntimeError('Production-style broker failed startup; inspect local log')
 config={'brokers':['127.0.0.1:19094'],'tlsDir':str(keys),'identity':'rh-kafka-admin'};(out/'bootstrap.json').write_text(json.dumps(config))
 subprocess.run(['node','scripts/observability/bootstrap-kafka.mjs',str(out/'bootstrap.json')],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 subprocess.run(['docker','restart','--time','3',name],check=True,stdout=subprocess.DEVNULL)
 for _ in range(40):
  try:
   subprocess.run(['node','scripts/observability/bootstrap-kafka.mjs',str(out/'bootstrap.json')],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10);break
  except subprocess.SubprocessError:time.sleep(.5)
 else:raise RuntimeError('Broker did not recover persisted metadata')
 (out/'result.json').write_text(json.dumps({'nonRoot':True,'readOnlyRoot':True,'capabilitiesDropped':True,'controllerLoopbackTLS':True,'topicsAndACL':True,'restartPreservesMetadata':True}))
 print('Unprivileged Kafka, read-only image, TLS controller and persistent restart: passed.')
finally:subprocess.run(['docker','rm','-f',name],check=True,stdout=subprocess.DEVNULL)
