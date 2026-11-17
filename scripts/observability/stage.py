#!/usr/bin/env python3
"""Deploy additive telemetry services over SSH carried by SSM. Game unchanged."""
import argparse,hashlib,json,os,shlex,sys
from pathlib import Path
sys.path.insert(0,str(Path('scripts/cluster').resolve()))
from remote import ssh,upload,pin_host,KEYS
p=argparse.ArgumentParser();p.add_argument('inventory');p.add_argument('artifact');p.add_argument('--config',required=True);p.add_argument('--pki',required=True);p.add_argument('--access',required=True);p.add_argument('--revision',required=True);p.add_argument('--hosts',nargs='+',required=True);a=p.parse_args()
assert len(a.revision)==40 and all(c in '0123456789abcdef' for c in a.revision)
nodes=json.loads(Path(a.inventory).read_text())['nodes'];allowed={'rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator','rh-observability','rh-events'}
assert set(nodes)==allowed and set(a.hosts)<=allowed
assert all(not nodes[name].get('physicalId') for name in a.hosts), 'Deploy physical hosts only, never a shared service alias'
artifact=Path(a.artifact).resolve();pki=Path(a.pki).resolve();access=Path(a.access).resolve();config=Path(a.config).resolve()
assert pki.is_relative_to(KEYS.resolve()) and access.is_relative_to(KEYS.resolve())
digest=hashlib.file_digest(artifact.open('rb'),'sha256').hexdigest();os.environ['RH_TRANSPORT']='ssm'
for name in a.hosts:
 node=nodes[name];pin_host(name,node)
 destination='/home/ubuntu/rh-observability-stage'
 ssh(name,node,f'install -d -m 0700 -o ubuntu -g ubuntu {destination}')
 files=[artifact,Path('scripts/observability/install-host.sh'),config/(name+'.agent.json'),pki/'ca.crt',pki/(name+'.crt'),pki/(name+'.key')]
 role='agent'
 if name=='rh-events' or (name=='rh-observability' and nodes['rh-events'].get('physicalId')==name):
  role='events';bundle=pki/'rh-events.bundle.pem'
  if not bundle.exists():
   with bundle.open('xb') as f:f.write((pki/'rh-events.key').read_bytes()+(pki/'rh-events.crt').read_bytes())
   bundle.chmod(0o600)
  files += [bundle,config/'server.properties']
 if name=='rh-observability':
  role='combined' if role=='events' else 'observability';files += [config/'panel.json',config/'prometheus.json',access/'users.json',pki/'rh-panel-consumer.crt',pki/'rh-panel-consumer.key']
 upload(name,node,files,destination+'/')
 command=f'set -euo pipefail\ncd {destination}\nmv {name}.agent.json agent.json\nbash install-host.sh {role} {shlex.quote(str(destination+"/"+artifact.name))} {digest} {a.revision} {destination}'
 result=ssh(name,node,command,check=False)
 log=Path('.cluster-local/observability')/(name+'-stage.log');log.write_text(result.stdout+'\n'+result.stderr)
 if result.returncode:raise RuntimeError(name+' staging failed; inspect private log before continuing')
 print(name+' telemetry staged; game and Nginx unchanged',flush=True)
