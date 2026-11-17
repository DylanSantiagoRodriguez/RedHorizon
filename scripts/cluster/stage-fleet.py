#!/usr/bin/env python3
"""Upload an approved artifact and each host's own identity over verified SSH."""
import argparse,hashlib,json,shlex,subprocess
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from remote import ssh,upload,KEYS
p=argparse.ArgumentParser();p.add_argument('artifact');p.add_argument('--pki',required=True);p.add_argument('--release',required=True);args=p.parse_args()
artifact=Path(args.artifact).resolve();pki=Path(args.pki).resolve()
assert pki.is_relative_to(KEYS.resolve())
assert args.release.replace('-','').replace('.','').isalnum()
sha=hashlib.file_digest(artifact.open('rb'),'sha256').hexdigest()
inventory=json.loads(Path('.cluster-local/inventory.json').read_text())
setup=Path('.cluster-local/host-setup.tar.gz')
subprocess.run(['tar','-czf',str(setup),'scripts/cluster/install-host.sh','scripts/cluster/activate.sh','deploy/cluster/redhorizon-cluster.service','deploy/cluster/nginx.logrotate'],check=True)
def stage(item):
 name,node=item
 role='gateway' if name=='rh-gateway' else 'coordinator' if name=='rh-coordinator' else 'game'
 remote='/home/ubuntu/rh-stage'
 ssh(name,node,f'install -d -m 0700 -o ubuntu -g ubuntu {remote}')
 paths=[artifact,setup,Path('.cluster-local/config')/(name+'.json'),pki/'ca.crt',pki/(name+'.crt'),pki/(name+'.key')]
 if role=='gateway':
  paths += [KEYS/'public-tls-transition'/f'{domain}.{ext}' for domain in ['redhorizon.lat','www.redhorizon.lat'] for ext in ['crt','key']]
 upload(name,node,paths,remote+'/')
 command=f'''set -euo pipefail
cd {remote}
tar -xzf host-setup.tar.gz
bash scripts/cluster/install-host.sh {role}
install -m 0640 -o root -g redhorizon-cluster {name}.json /etc/redhorizon-cluster/cluster.json
install -m 0644 -o root -g root ca.crt {name}.crt /etc/redhorizon-cluster/tls/
install -m 0600 -o redhorizon-cluster -g redhorizon-cluster {name}.key /etc/redhorizon-cluster/tls/
rm -f {name}.key
bash scripts/cluster/activate.sh {shlex.quote(str(remote+'/'+artifact.name))} {sha} {args.release}
systemctl enable redhorizon-cluster
systemctl is-active redhorizon-cluster
'''
 if role=='gateway':
  command+='install -d -m 0700 /etc/redhorizon-cluster/public-tls\n'
  for domain in ['redhorizon.lat','www.redhorizon.lat']:
   for ext in ['crt','key']:
    command+=f'install -m 0600 -o root -g root {domain}.{ext} /etc/redhorizon-cluster/public-tls/\nrm -f {domain}.{ext}\n'
 result=ssh(name,node,command,check=False)
 Path('.cluster-local/'+name+'-install.log').write_text(result.stdout+'\n'+result.stderr)
 if result.returncode: raise RuntimeError(name+' installation failed; inspect local install log')
 return name+' staged and service started (capacity remains zero)'
with ThreadPoolExecutor(max_workers=5) as pool:
 for future in as_completed([pool.submit(stage,item) for item in inventory['nodes'].items()]): print(future.result(),flush=True)
