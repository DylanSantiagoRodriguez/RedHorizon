#!/usr/bin/env python3
"""Rotate a candidate fleet's service PKI only with zero rooms/connections.

Uses SSM transport for files, never includes private keys in Run Command text.
Keeps the previous per-host identities for rollback; CA private key stays local.
"""
import argparse,json,re,time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from remote import KEYS,ssh,upload,ssm
p=argparse.ArgumentParser();p.add_argument('pki');p.add_argument('--execute',action='store_true',required=True);a=p.parse_args()
pki=Path(a.pki).resolve();assert pki.is_relative_to(KEYS.resolve())
tag=pki.name;assert re.fullmatch(r'[a-zA-Z0-9-]+',tag)
nodes=json.loads(Path('.cluster-local/inventory.json').read_text())['nodes']
def command(name,script):return ssm(nodes[name]['instanceId'],script)
def idle():
    h=json.loads(command('rh-gateway','curl -fsS localhost:8788/health'));assert h['connections']==0
    for name in ['rh-game-01','rh-game-02','rh-game-03']:
        s=json.loads(command(name,'cat /run/redhorizon-cluster/status.json'))
        assert s['rooms']==0 and s['players']==0 and time.time()*1000-s['recordedAt']<15000,name+' is not idle'
idle()
def stage(item):
    name,node=item;dest='/home/ubuntu/'+tag
    ssh(name,node,f'install -d -m 0700 -o ubuntu -g ubuntu {dest}')
    upload(name,node,[pki/'ca.crt',pki/(name+'.crt'),pki/(name+'.key')],dest+'/')
    script=f'''set -euo pipefail
test ! -e /etc/redhorizon-cluster/tls-before-{tag}
openssl verify -x509_strict -CAfile {dest}/ca.crt -purpose sslserver -verify_ip {node['privateIp']} {dest}/{name}.crt
python3 - <<'PY'
import ssl
ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER).load_cert_chain('{dest}/{name}.crt','{dest}/{name}.key')
PY
install -d -m 0750 -o root -g redhorizon-cluster /etc/redhorizon-cluster/tls-next-{tag}
install -m 0644 -o root -g root {dest}/ca.crt {dest}/{name}.crt /etc/redhorizon-cluster/tls-next-{tag}/
install -m 0600 -o redhorizon-cluster -g redhorizon-cluster {dest}/{name}.key /etc/redhorizon-cluster/tls-next-{tag}/
rm -f {dest}/{name}.key
'''
    result=ssh(name,node,script,check=False)
    if result.returncode:raise RuntimeError(name+' staging failed: '+result.stderr[-700:])
    return name+' strict chain and matching private key verified'
with ThreadPoolExecutor(max_workers=5) as pool:
    for result in pool.map(stage,nodes.items()):print(result,flush=True)
idle()
stopped=False
try:
    stopped=True
    for name in ['rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator']:
        command(name,'systemctl stop redhorizon-cluster')
    for name in nodes:
        command(name,f'set -e\nmv /etc/redhorizon-cluster/tls /etc/redhorizon-cluster/tls-before-{tag}\nmv /etc/redhorizon-cluster/tls-next-{tag} /etc/redhorizon-cluster/tls')
    for name in ['rh-coordinator','rh-game-01','rh-game-02','rh-game-03','rh-gateway']:
        command(name,'systemctl start redhorizon-cluster; systemctl is-active redhorizon-cluster')
    print('New PKI active on five hosts; legacy backend and public certificate unchanged.',flush=True)
except BaseException:
    for name in nodes:command(name,'systemctl stop redhorizon-cluster')
    for name in nodes:
        command(name,f'if [ -d /etc/redhorizon-cluster/tls-before-{tag} ]; then mv /etc/redhorizon-cluster/tls /etc/redhorizon-cluster/tls-failed-{tag}; mv /etc/redhorizon-cluster/tls-before-{tag} /etc/redhorizon-cluster/tls; fi')
    raise
finally:
    if stopped:
        for name in ['rh-coordinator','rh-game-01','rh-game-02','rh-game-03','rh-gateway']:
            command(name,'systemctl start redhorizon-cluster')
