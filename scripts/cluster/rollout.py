#!/usr/bin/env python3
"""Sequential artifact rollout with worker draining and authenticated health.

Entry/coordinator updates require an explicit maintenance flag and zero tunnels.
Transport is verified SSH (including an authorized /32 recovery window), never
open SSH or plaintext private keys in SSM payloads.
"""
import argparse
import hashlib
import json
import shlex
import time
from pathlib import Path
from remote import ssh, upload

p=argparse.ArgumentParser()
p.add_argument('artifact');p.add_argument('--release',required=True)
p.add_argument('--hosts',nargs='+',required=True)
p.add_argument('--allow-entry-interruption',action='store_true')
p.add_argument('--rollback-check',action='store_true')
p.add_argument('--delta',action='store_true')
args=p.parse_args()
assert args.release.replace('-','').replace('.','').isalnum()
nodes=json.loads(Path('.cluster-local/inventory.json').read_text())['nodes']
assert set(args.hosts)<=set(nodes)
artifact=Path(args.artifact).resolve()
digest=hashlib.file_digest(artifact.open('rb'),'sha256').hexdigest()
evidence_path=Path('.cluster-local/rollouts.json')
evidence=json.loads(evidence_path.read_text()) if evidence_path.exists() else []
for name in args.hosts:
    node=nodes[name]; worker=name.startswith('rh-game-')
    if not worker:
        assert args.allow_entry_interruption, 'Entry maintenance must be explicit'
        health=json.loads(ssh('rh-gateway',nodes['rh-gateway'],'curl -fsS localhost:8788/health').stdout)
        assert health['connections']==0, 'Active gateway tunnels; postpone maintenance'
    remote='/home/ubuntu/rh-stage/'
    files=[artifact,Path('scripts/cluster/activate.sh'),Path('scripts/cluster/activate-delta.py'),Path('scripts/cluster/drain-host.sh'),Path('scripts/cluster/reopen-host.sh')]
    if worker: files.append(Path('.cluster-local/config')/(name+'.json'))
    upload(name,node,files,remote)
    old=ssh(name,node,'readlink -f /srv/redhorizon-cluster/current').stdout.strip()
    stop='DRAIN_TIMEOUT_SECONDS=7500 bash '+remote+'drain-host.sh' if worker else 'systemctl stop redhorizon-cluster'
    config=f'install -m 0640 -o root -g redhorizon-cluster {remote}{name}.json /etc/redhorizon-cluster/cluster.json' if worker else ':'
    print('Activating '+name,flush=True)
    activate='python3 '+remote+'activate-delta.py' if args.delta else 'bash '+remote+'activate.sh'
    result=ssh(name,node,f'set -euo pipefail\n{stop}\n{config}\n{activate} {shlex.quote(remote+artifact.name)} {digest} {args.release}\nsleep 6\ncat /srv/redhorizon-cluster/current/runtime/release.json',check=False)
    if result.returncode:
        Path('.cluster-local/'+name+'-rollout-error.log').write_text(result.stdout+'\n'+result.stderr)
        raise RuntimeError(name+' activation stopped; inspect private rollout log before retrying')
    manifest=json.loads(result.stdout.splitlines()[-1])
    def health():
        if worker:
            script=f'curl --fail --silent --show-error --cacert /etc/redhorizon-cluster/tls/ca.crt --cert /etc/redhorizon-cluster/tls/rh-gateway.crt --key /etc/redhorizon-cluster/tls/rh-gateway.key https://{node["privateIp"]}:8787/health'
            return json.loads(ssh('rh-gateway',nodes['rh-gateway'],script).stdout)
        if name=='rh-gateway': return json.loads(ssh(name,node,'curl -fsS localhost:8788/health').stdout)
        # Coordinator's authenticated /lookup must reject an absent room, not TLS.
        ssh(name,node,'systemctl is-active --quiet redhorizon-cluster redis-server')
        return {'ok':True}
    check=health();assert check['ok']
    if name!='rh-coordinator': assert check['buildId']==manifest['commit']
    rolled_back=False
    if args.rollback_check and worker:
        # The drain marker stays in place throughout this functional rollback test.
        ssh(name,node,f'set -e\nsystemctl stop redhorizon-cluster\nln -s {shlex.quote(old)} /srv/redhorizon-cluster/rollback-check\nmv -Tf /srv/redhorizon-cluster/rollback-check /srv/redhorizon-cluster/current\nsystemctl start redhorizon-cluster\nsleep 6')
        assert health()['ok'];rolled_back=True
        ssh(name,node,f'set -e\nsystemctl stop redhorizon-cluster\nln -s /srv/redhorizon-cluster/releases/{args.release} /srv/redhorizon-cluster/restore-check\nmv -Tf /srv/redhorizon-cluster/restore-check /srv/redhorizon-cluster/current\nsystemctl start redhorizon-cluster\nsleep 6')
        assert health()['buildId']==manifest['commit']
    if worker:
        ssh(name,node,'bash '+remote+'reopen-host.sh')
        # Listening is not enough: a restarted incarnation is fenced until the
        # preceding heartbeat expires. Wait for the actual directory admission.
        time.sleep(2)
        boot=json.loads(ssh(name,node,'cat /run/redhorizon-cluster/status.json').stdout)['boot']
        expected=json.loads((Path('.cluster-local/config')/(name+'.json')).read_text())['capacity']
        for _ in range(8):
            code=f'import json,sys;print(json.dumps(json.load(sys.stdin)["workers"].get("{name}",{{}})))'
            command='redis-cli --raw GET rh:directory:v1 | python3 -c '+shlex.quote(code)
            registered=json.loads(ssh('rh-coordinator',nodes['rh-coordinator'],command).stdout)
            if registered.get('boot')==boot and not registered['draining'] and registered['capacity']==expected and time.time()*1000-registered['seen']<15000:break
            time.sleep(3)
        else:raise RuntimeError(name+' not admitted by coordinator after reopening')
    evidence.append({'host':name,'release':args.release,'sha256':digest,'commit':manifest['commit'],'previous':old,'healthy':True,'rollbackChecked':rolled_back})
    evidence_path.write_text(json.dumps(evidence,indent=2))
    print(name+' healthy; '+('reopened' if worker else 'entry restored'),flush=True)
