#!/usr/bin/env python3
"""Billable step: run ONLY after explicit approval of COSTOS.md, never from tests."""
import argparse,datetime,json,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--approved-monthly-usd',required=True,type=float);p.add_argument('--profile',default='rh-cluster-operator');p.add_argument('--ami',required=True);a=p.parse_args()
assert a.approved_monthly_usd>=141.0,'Review the concrete USD 141/month estimate before provisioning'
def aws(*args):return json.loads(subprocess.check_output(['aws',*args,'--profile',a.profile,'--region','us-east-2','--output','json','--no-cli-pager']))
identity=aws('sts','get-caller-identity');assert ':assumed-role/' in identity['Arn'],'Use a dedicated role, not root or static user credentials'
quota=aws('service-quotas','get-service-quota','--service-code','ec2','--quota-code','L-1216C47A')['Quota']['Value']
reservations=aws('ec2','describe-instances','--filters','Name=instance-state-name,Values=pending,running')['Reservations'];instances=[i for r in reservations for i in r['Instances']]
assert any(i['InstanceId']=='i-0db322d7e36dea80a' for i in instances)
assert not any(t.get('Value') in ['rh-observability','rh-events'] for i in instances for t in i.get('Tags',[]) if t['Key']=='Name'),'New nodes already exist; inspect and resume rather than duplicate'
types=aws('ec2','describe-instance-types','--instance-types',*sorted({i['InstanceType'] for i in instances}))['InstanceTypes'];cpus={t['InstanceType']:t['VCpuInfo']['DefaultVCpus'] for t in types}
assert sum(cpus[i['InstanceType']] for i in instances)+2<=quota,'Insufficient regional vCPU quota; request increase separately'
chosen=aws('ec2','describe-instance-types','--instance-types','m7i-flex.large')['InstanceTypes'][0];assert chosen['FreeTierEligible'] and chosen['MemoryInfo']['SizeInMiB']>=8192
image=aws('ec2','describe-images','--image-ids',a.ami)['Images'][0];assert image['OwnerId']=='099720109477' and image['Architecture']=='x86_64' and image['State']=='available' and image.get('FreeTierEligible')
root=Path('/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon');root.mkdir(mode=0o700,exist_ok=True,parents=True);root.chmod(0o700);os.umask(0o077)
suffix=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');parameters=[{'ParameterKey':'UbuntuAmi','ParameterValue':a.ami}]
for logical in ['Observability']:
 name='rh-'+logical.lower()+'-'+suffix;private=root/(name+'.pem');assert not private.exists()
 subprocess.run(['ssh-keygen','-q','-t','rsa','-b','3072','-m','PEM','-N','','-C',name,'-f',str(private)],check=True);private.chmod(0o600)
 aws('ec2','import-key-pair','--key-name',name,'--public-key-material','fileb://'+str(private)+'.pub')
 parameters.append({'ParameterKey':logical+'KeyName','ParameterValue':name})
local=Path('.cluster-local/observability');local.mkdir(parents=True,exist_ok=True);(local/'parameters.json').write_text(json.dumps(parameters))
result=aws('cloudformation','create-stack','--stack-name','redhorizon-observability','--template-body','file://deploy/observability/infrastructure.json','--parameters','file://'+str(local/'parameters.json'),'--capabilities','CAPABILITY_IAM','--enable-termination-protection','--tags','Key=Project,Value=RedHorizonCluster')
(local/'stack.json').write_text(json.dumps(result));print('Stack creation submitted. Monitor events; do not duplicate resources on failure.')
