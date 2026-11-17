#!/usr/bin/env python3
"""Read-only budget evidence. No resources, sessions or credentials are printed."""
import json,subprocess,datetime
from pathlib import Path
out=Path('.cluster-local/observability');out.mkdir(parents=True,exist_ok=True)
def query(name,args):
 p=subprocess.run(['aws',*args,'--output','json','--no-cli-pager'],capture_output=True,text=True)
 if p.returncode: result={'available':False,'reason':p.stderr.strip()[:400]}
 else: result=json.loads(p.stdout)
 (out/(name+'.json')).write_text(json.dumps(result,indent=2));return result
query('quota',['service-quotas','get-service-quota','--service-code','ec2','--quota-code','L-1216C47A','--region','us-east-2'])
query('offerings',['ec2','describe-instance-type-offerings','--region','us-east-2','--location-type','availability-zone','--filters','Name=instance-type,Values=c7i-flex.large','Name=location,Values=us-east-2b'])
query('account-plan',['freetier','get-account-plan-state','--region','us-east-1'])
query('ami',['ssm','get-parameter','--name','/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id','--region','us-east-2'])
now=datetime.datetime.now(datetime.timezone.utc).date()
query('observed-cost',['ce','get-cost-and-usage','--region','us-east-1','--time-period',f'Start={now.replace(day=1)},End={now}','--granularity','MONTHLY','--metrics','UnblendedCost','--group-by','Type=DIMENSION,Key=SERVICE'])
query('template-validation',['cloudformation','validate-template','--template-body','file://deploy/observability/infrastructure.json','--region','us-east-2'])
print('Read-only AWS evidence saved under .cluster-local/observability; no resources created.')
