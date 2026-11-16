#!/usr/bin/env python3
"""Stop only the four newly tagged nodes. Primary and other workloads are excluded."""
import argparse,json,subprocess
p=argparse.ArgumentParser();p.add_argument('--execute',action='store_true');a=p.parse_args()
r=json.loads(subprocess.check_output(['aws','ec2','describe-instances','--region','us-east-2','--filters','Name=tag:Project,Values=RedHorizonCluster','--output','json','--no-cli-pager']))
allowed={'rh-gateway','rh-game-02','rh-game-03','rh-coordinator'}
ids=[]
for reservation in r['Reservations']:
 for i in reservation['Instances']:
  tags={t['Key']:t['Value'] for t in i.get('Tags',[])}
  if tags.get('Name') in allowed and i['State']['Name']=='running': ids.append(i['InstanceId'])
assert not set(ids)&{'i-0db322d7e36dea80a','i-040ec54792a8b4446','i-0b97588c8e4e85881'}
print(json.dumps({'action':'stop','instances':ids,'execute':a.execute}))
if a.execute and ids:
 subprocess.run(['aws','ec2','stop-instances','--region','us-east-2','--instance-ids',*ids,'--no-cli-pager'],check=True)
