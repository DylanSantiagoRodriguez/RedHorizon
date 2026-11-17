#!/usr/bin/env python3
"""Stop only the four newly tagged nodes. Primary and other workloads are excluded."""
import argparse,json,time
from pathlib import Path
from remote import aws,ssm
p=argparse.ArgumentParser();p.add_argument('--execute',action='store_true');a=p.parse_args()
r=aws('ec2','describe-instances','--filters','Name=tag:Project,Values=RedHorizonCluster')
allowed={'rh-gateway','rh-game-02','rh-game-03','rh-coordinator'}
ids=[]
for reservation in r['Reservations']:
 for i in reservation['Instances']:
  tags={t['Key']:t['Value'] for t in i.get('Tags',[])}
  if tags.get('Name') in allowed and i['State']['Name']=='running': ids.append(i['InstanceId'])
assert not set(ids)&{'i-0db322d7e36dea80a','i-040ec54792a8b4446','i-0b97588c8e4e85881'}
print(json.dumps({'action':'stop','instances':ids,'execute':a.execute}))
if a.execute and ids:
 nodes=json.loads(Path('.cluster-local/inventory.json').read_text())['nodes']
 assert set(ids)=={nodes[n]['instanceId'] for n in allowed}, 'Inventory mismatch or partially stopped fleet; review individually'
 for name in ['rh-game-01','rh-game-02','rh-game-03']:
  # SIGUSR1 leaves the process running; do not use drain-host.sh (which stops it)
  # until this preflight has read its final, fresh status.
  s=json.loads(ssm(nodes[name]['instanceId'],'cat /run/redhorizon-cluster/status.json'))
  assert s['draining'] and s['rooms']==0 and time.time()*1000-s['recordedAt']<15000, name+' must be drained first'
 h=json.loads(ssm(nodes['rh-gateway']['instanceId'],'curl -fsS localhost:8788/health'))
 assert h['connections']==0, 'Active gateway connections'
 aws('ec2','stop-instances','--instance-ids',*ids)
