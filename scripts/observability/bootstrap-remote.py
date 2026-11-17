#!/usr/bin/env python3
"""Bootstrap the new broker over SSM using a temporary scoped admin certificate."""
import argparse,json,shlex,sys,uuid
from pathlib import Path
sys.path.insert(0,str(Path('scripts/cluster').resolve()))
from remote import ssh,upload,pin_host,KEYS
p=argparse.ArgumentParser();p.add_argument('inventory');p.add_argument('--pki',required=True);a=p.parse_args()
nodes=json.loads(Path(a.inventory).read_text())['nodes'];node=nodes['rh-events'];pki=Path(a.pki).resolve();assert pki.is_relative_to(KEYS.resolve())
pin_host('rh-events',node);remote='/home/ubuntu/rh-kafka-bootstrap-'+uuid.uuid4().hex
ssh('rh-events',node,f'install -d -m 0700 -o ubuntu -g ubuntu {remote}')
try:
 upload('rh-events',node,[pki/'ca.crt',pki/'rh-kafka-admin.crt',pki/'rh-kafka-admin.key'],remote+'/')
 config={'brokers':[node['privateIp']+':9093'],'tlsDir':remote,'identity':'rh-kafka-admin'}
 # Config contains paths only; key bytes never enter a shell command or SSM parameter.
 script=f'''set -euo pipefail
umask 077
cd {remote}
cat rh-kafka-admin.key rh-kafka-admin.crt > rh-kafka-admin.bundle.pem
cat > client.json <<'JSON'
{json.dumps(config)}
JSON
cat > admin.properties <<'PROPS'
security.protocol=SSL
ssl.keystore.type=PEM
ssl.keystore.location=/admin/rh-kafka-admin.bundle.pem
ssl.truststore.type=PEM
ssl.truststore.location=/admin/ca.crt
ssl.endpoint.identification.algorithm=https
PROPS
/srv/redhorizon-observability/current/node/bin/node /srv/redhorizon-observability/current/runtime/scripts/observability/bootstrap-kafka.mjs client.json
'''
 for identity in ['rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator','rh-observability','rh-events','rh-panel-consumer']:
  quota='consumer_byte_rate=1048576,request_percentage=10' if identity=='rh-panel-consumer' else 'producer_byte_rate=262144,request_percentage=5'
  args=['docker','run','--rm','--network','host','--user','1000:1000','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','512m','--cpus','0.5','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--tmpfs','/opt/kafka/logs:rw,nosuid,size=16m,uid=1000','-v',remote+':/admin:ro','apache/kafka@sha256:0bc1bb2478f45b6cea78864df86acdc11e8df2c5172477819a4d12942cbe5d40','/opt/kafka/bin/kafka-configs.sh','--bootstrap-server',node['privateIp']+':9093','--command-config','/admin/admin.properties','--alter','--entity-type','users','--entity-name','CN='+identity,'--add-config',quota]
  script+=shlex.join(args)+'\n'
 # Config files are root-created, readable only by temporary CLI UID.
 script=script.replace('/srv/redhorizon-observability/current/node/bin/node', 'chown -R 1000:1000 '+remote+'\n/srv/redhorizon-observability/current/node/bin/node',1)
 result=ssh('rh-events',node,script,check=False)
 Path('.cluster-local/observability/broker-bootstrap.log').write_text(result.stdout+'\n'+result.stderr)
 if result.returncode:raise RuntimeError('Broker bootstrap failed; inspect private log before retrying')
 print('Topics, ACL and quotas configured; administrative material removed from broker.')
finally:
 ssh('rh-events',node,'rm -rf -- '+shlex.quote(remote))
