#!/usr/bin/env python3
"""Read-only reconciliation of new stack outputs with the existing five nodes."""
import json,subprocess,os
from pathlib import Path
profile=os.environ.get('RH_AWS_PROFILE','rh-cluster-operator')
def aws(*args):return json.loads(subprocess.check_output(['aws',*args,'--profile',profile,'--region','us-east-2','--output','json','--no-cli-pager']))
s=aws('cloudformation','describe-stacks','--stack-name','redhorizon-observability')['Stacks'][0];assert s['StackStatus'] in ['CREATE_COMPLETE','UPDATE_COMPLETE']
out={o['OutputKey']:o['OutputValue'] for o in s['Outputs']};i=json.loads(Path('.cluster-local/inventory.json').read_text())
assert set(i['nodes'])=={'rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator'}
for logical in ['Observability','Events']:
 id='rh-'+logical.lower();i['nodes'][id]={'instanceId':out[logical],'privateIp':out[logical+'PrivateIp'],'publicIp':out[logical+'PublicIp'],'instanceType':'c7i-flex.large','securityGroupId':out[logical+'Group']}
actual=aws('ec2','describe-instances','--instance-ids',*[n['instanceId'] for n in i['nodes'].values()])
for r in actual['Reservations']:
 for n in r['Instances']:
  target=next(v for v in i['nodes'].values() if v['instanceId']==n['InstanceId']);target['instanceType']=n['InstanceType'];target['privateIp']=n['PrivateIpAddress'];target['publicIp']=n.get('PublicIpAddress')
assert i['nodes']['rh-game-01']['instanceId']=='i-0db322d7e36dea80a'
Path('.cluster-local/observability/inventory.json').write_text(json.dumps(i,indent=2))
print('Seven-node inventory reconciled without modifying instances.')
