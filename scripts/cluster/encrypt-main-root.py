#!/usr/bin/env python3
"""One-time, guarded root migration. Keeps the original disk and public IP.

Requires the reviewed provisioning profile, not the day-to-day operator. All
evidence lives in ignored .cluster-local; no private material is printed.
"""
import argparse
import json
import selectors
import shlex
import subprocess
import time
from pathlib import Path
from remote import aws, ssh, options

p = argparse.ArgumentParser()
p.add_argument('phase', choices=['prepare', 'replace', 'restore-web'])
p.add_argument('--execute', action='store_true', required=True)
p.add_argument('--provisioning-profile', default='default')
args = p.parse_args()
name = 'rh-game-01'
node = json.loads(Path('.cluster-local/inventory.json').read_text())['nodes'][name]
assert node['instanceId'] == 'i-0db322d7e36dea80a'
evidence = Path('.cluster-local/root-migration.json')
state = json.loads(evidence.read_text()) if evidence.exists() else {}
def save():
    evidence.write_text(json.dumps(state, indent=2)); evidence.chmod(0o600)
def provision(*a):
    return aws(*a, profile=args.provisioning_profile)
def instance():
    return provision('ec2', 'describe-instances', '--instance-ids', node['instanceId'])['Reservations'][0]['Instances'][0]
def wait_resource(service, operation, field, identifier, collection, wanted):
    for _ in range(180):
        item = provision(service, operation, field, identifier)[collection][0]
        if item['State'] == wanted: return item
        if item['State'] in ['error', 'failed']: raise RuntimeError(item['State'])
        time.sleep(5)
    raise TimeoutError(identifier)

if args.phase == 'prepare':
    assert not state, 'Existing migration evidence: do not overwrite or repeat'
    i = instance()
    root = next(b['Ebs']['VolumeId'] for b in i['BlockDeviceMappings'] if b['DeviceName'] == i['RootDeviceName'])
    assert root == 'vol-0cb0eae776043b3fd'
    assert i['PublicIpAddress'] == node['publicIp']
    # Gate only new legacy WebSockets. Existing connections would remain alive;
    # checks on both sides of the gate prevent stopping an active room.
    script = r'''set -euo pipefail
curl -fsS localhost:8787/health | python3 -c 'import sys,json;assert json.load(sys.stdin)["rooms"] == 0'
python3 - <<'PY'
import json,time
s=json.load(open('/run/redhorizon-cluster/status.json'))
assert s['rooms']==0 and s['players']==0 and time.time()*1000-s['recordedAt']<15000
PY
! systemctl is-active --quiet apt-daily.service
! systemctl is-active --quiet apt-daily-upgrade.service
test ! -e /etc/caddy/Caddyfile.pre-root-encryption
cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.pre-root-encryption
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/caddy/Caddyfile');s=p.read_text()
assert '\t@backend path /ws /health' in s
p.write_text(s.replace('\t@backend path /ws /health', '\t@maintenance path /ws\n\trespond @maintenance "Mantenimiento breve" 503\n\t@backend path /ws /health'))
PY
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy
curl -fsS localhost:8787/health | python3 -c 'import sys,json;assert json.load(sys.stdin)["rooms"] == 0'
systemctl disable --now redhorizon-deploy.timer
install -m 0640 -o root -g redhorizon-cluster /dev/null /var/lib/redhorizon-cluster/drain
systemctl kill --kill-who=main --signal=SIGUSR1 redhorizon-cluster
sleep 6
python3 - <<'PY'
import json,time
s=json.load(open('/run/redhorizon-cluster/status.json'))
assert s['draining'] and s['rooms']==0 and s['players']==0 and time.time()*1000-s['recordedAt']<15000
PY
systemctl stop redhorizon-backend redhorizon-cluster
sync
sha256sum /etc/caddy/Caddyfile.pre-root-encryption /etc/redhorizon-cluster/cluster.json /srv/redhorizon-cluster/current/runtime/release.json
'''
    state = {'instanceId': node['instanceId'], 'oldVolume': root, 'publicIp': node['publicIp'], 'az': i['Placement']['AvailabilityZone'], 'rootDevice': i['RootDeviceName']}
    save()
    result = ssh(name, node, script)
    state['checksums'] = result.stdout.strip(); save()
    # Keep a pre-opened SSH stream: no login/SSM writes while the root is frozen.
    # Both a watchdog and shell trap guarantee thaw even if the local process dies.
    freeze = '''set -eu
(sleep 25; /usr/sbin/fsfreeze -u / >/dev/null 2>&1 || true) &
watchdog=$!
trap '/usr/sbin/fsfreeze -u / >/dev/null 2>&1 || true; kill "$watchdog" 2>/dev/null || true' EXIT HUP INT TERM
/usr/sbin/fsfreeze -f /
echo FROZEN
read -r -t 20 reply || true
'''
    proc = subprocess.Popen(['ssh', *options(name), 'ubuntu@'+node['publicIp'], 'sudo bash -c '+shlex.quote(freeze)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        sel = selectors.DefaultSelector(); sel.register(proc.stdout, selectors.EVENT_READ)
        assert sel.select(30), 'Filesystem freeze did not acknowledge'
        assert proc.stdout.readline().strip() == 'FROZEN'
        snap = provision('ec2', 'create-snapshot', '--volume-id', root, '--description', 'Red Horizon consistent pre-encryption root 20261117', '--tag-specifications', json.dumps([{'ResourceType':'snapshot','Tags':[{'Key':'Project','Value':'RedHorizonCluster'},{'Key':'Name','Value':'rh-main-pre-encryption'}]}]))
        state['snapshot'] = snap['SnapshotId']; save()
    finally:
        if proc.poll() is None:
            proc.stdin.write('THAW\n'); proc.stdin.flush()
        proc.communicate(timeout=35)
    print('Consistent snapshot requested; filesystem thawed.', flush=True)
    # Start the legacy backend for health/single-player availability; new WS stay gated.
    ssh(name, node, 'systemctl start redhorizon-backend')
    wait_resource('ec2','describe-snapshots','--snapshot-ids',state['snapshot'],'Snapshots','completed')
    volume = provision('ec2','create-volume','--snapshot-id',state['snapshot'],'--availability-zone',state['az'],'--volume-type','gp3','--size','20','--encrypted','--client-token','rh-main-encryption-20261117','--tag-specifications',json.dumps([{'ResourceType':'volume','Tags':[{'Key':'Project','Value':'RedHorizonCluster'},{'Key':'Name','Value':'rh-game-01-encrypted-root'}]}]))
    state['newVolume'] = volume['VolumeId']; save()
    v = wait_resource('ec2','describe-volumes','--volume-ids',state['newVolume'],'Volumes','available')
    assert v['Encrypted'] and v['Size']==20
    print('Encrypted replacement prepared: '+state['newVolume'])
elif args.phase == 'replace':
    i=instance()
    assert i['PublicIpAddress']==state['publicIp']
    assert any(b['Ebs']['VolumeId']==state['oldVolume'] for b in i['BlockDeviceMappings'])
    result=provision('ec2','create-replace-root-volume-task','--instance-id',node['instanceId'],'--volume-id',state['newVolume'],'--no-delete-replaced-root-volume','--client-token','rh-main-root-replacement-20261117')
    state['task']=result['ReplaceRootVolumeTask']['ReplaceRootVolumeTaskId']; save()
    for _ in range(180):
        task=provision('ec2','describe-replace-root-volume-tasks','--replace-root-volume-task-ids',state['task'])['ReplaceRootVolumeTasks'][0]
        if task['TaskState']=='succeeded': break
        if task['TaskState'].startswith('fail'): raise RuntimeError(task['TaskState'])
        time.sleep(5)
    else: raise TimeoutError(state['task'])
    i=instance(); assert i['PublicIpAddress']==state['publicIp']
    assert any(b['Ebs']['VolumeId']==state['newVolume'] for b in i['BlockDeviceMappings'])
    state['replacement']='succeeded'; save()
    print('Encrypted root attached; instance identity and IP retained. Verify boot before restoring WebSockets.')
else:
    assert state.get('replacement')=='succeeded'
    result=ssh(name,node,'''set -euo pipefail
test -e /etc/caddy/Caddyfile.pre-root-encryption
sha256sum /etc/caddy/Caddyfile.pre-root-encryption /etc/redhorizon-cluster/cluster.json /srv/redhorizon-cluster/current/runtime/release.json
systemctl is-active caddy redhorizon-backend redhorizon-cluster
df -h /
''')
    assert result.stdout.startswith(state['checksums']), 'Post-boot checksum mismatch'
    print(result.stdout)
    print(ssh(name,node,'''set -euo pipefail
cp -a /etc/caddy/Caddyfile.pre-root-encryption /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy
rm -f /var/lib/redhorizon-cluster/drain
systemctl restart redhorizon-cluster
curl -fsS localhost:8787/health
''').stdout)
    state['verified']=True; save()
