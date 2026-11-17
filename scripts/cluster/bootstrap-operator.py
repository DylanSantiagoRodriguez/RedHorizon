#!/usr/bin/env python3
"""Bootstrap a scoped role and a dedicated user that can only assume it.
Access credentials stay in the local AWS credentials file and are never printed.
"""
import configparser,json,os,subprocess,tempfile
from pathlib import Path
account='670036769494'
role='RedHorizonClusterBootstrapOperator'
user='redhorizon-cluster-operator'
user_arn=f'arn:aws:iam::{account}:user/{user}'
inventory=json.loads(Path('.cluster-local/inventory.json').read_text())
instances=[f'arn:aws:ec2:us-east-2:{account}:instance/'+n['instanceId'] for n in inventory['nodes'].values()]
groups=[f'arn:aws:ec2:us-east-2:{account}:security-group/'+g for g in inventory['groups'].values()]
trust={'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'AWS':f'arn:aws:iam::{account}:root'},'Action':'sts:AssumeRole','Condition':{'ArnEquals':{'aws:PrincipalArn':user_arn}}}]}
policy={'Version':'2012-10-17','Statement':[
 {'Effect':'Allow','Action':['ec2:Describe*','ssm:DescribeInstanceInformation','ssm:GetCommandInvocation','ssm:ListCommandInvocations','cloudwatch:GetMetricData','cloudwatch:GetMetricStatistics','cloudformation:DescribeStacks','cloudformation:DescribeStackEvents','cloudformation:DescribeStackResources'],'Resource':'*'},
 {'Effect':'Allow','Action':['ssm:SendCommand','ssm:StartSession'],'Resource':instances+[f'arn:aws:ssm:us-east-2:{account}:document/SSM-SessionManagerRunShell','arn:aws:ssm:us-east-2::document/AWS-RunShellScript','arn:aws:ssm:us-east-2::document/AWS-StartSSHSession']},
 {'Effect':'Allow','Action':['ssm:TerminateSession','ssm:ResumeSession','ssmmessages:OpenDataChannel'],'Resource':f'arn:aws:ssm:us-east-2:{account}:session/*','Condition':{'StringEquals':{'ssm:resourceTag/aws:ssmmessages:session-id':'${aws:userid}'}}},
 {'Effect':'Allow','Action':['ec2:StartInstances','ec2:StopInstances','ec2:RebootInstances','ec2:ModifyInstanceAttribute','ec2:ModifyInstanceMetadataOptions','ec2:CreateTags'],'Resource':instances},
 {'Effect':'Allow','Action':['ec2:AuthorizeSecurityGroupIngress','ec2:RevokeSecurityGroupIngress','ec2:ModifyInstanceAttribute'],'Resource':groups}
]}
for name,data in [('operator-trust',trust),('operator-policy',policy)]: Path('.cluster-local/'+name+'.json').write_text(json.dumps(data,indent=2))
def aws(*args): return subprocess.run(['aws',*args,'--no-cli-pager'],check=True,stdout=subprocess.DEVNULL)
user_exists=subprocess.run(['aws','iam','get-user','--user-name',user,'--no-cli-pager'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
if not user_exists: aws('iam','create-user','--user-name',user,'--tags','Key=Project,Value=RedHorizonCluster')
exists=subprocess.run(['aws','iam','get-role','--role-name',role,'--no-cli-pager'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
if not exists: aws('iam','create-role','--role-name',role,'--assume-role-policy-document','file://.cluster-local/operator-trust.json','--max-session-duration','3600','--tags','Key=Project,Value=RedHorizonCluster')
else: aws('iam','update-assume-role-policy','--role-name',role,'--policy-document','file://.cluster-local/operator-trust.json')
aws('iam','put-role-policy','--role-name',role,'--policy-name','OperateFiveNodesOnly','--policy-document','file://.cluster-local/operator-policy.json')
aws('configure','set','profile.rh-cluster-operator.role_arn',f'arn:aws:iam::{account}:role/{role}')
user_policy={'Version':'2012-10-17','Statement':[{'Effect':'Allow','Action':'sts:AssumeRole','Resource':f'arn:aws:iam::{account}:role/{role}'}]}
Path('.cluster-local/operator-user-policy.json').write_text(json.dumps(user_policy))
aws('iam','put-user-policy','--user-name',user,'--policy-name','AssumeClusterRoleOnly','--policy-document','file://.cluster-local/operator-user-policy.json')
credentials=Path.home()/'.aws'/'credentials'
config=configparser.RawConfigParser(); config.read(credentials)
if not config.has_section('rh-cluster-source'):
    key=json.loads(subprocess.check_output(['aws','iam','create-access-key','--user-name',user,'--output','json','--no-cli-pager']))['AccessKey']
    config.add_section('rh-cluster-source')
    config.set('rh-cluster-source','aws_access_key_id',key['AccessKeyId'])
    config.set('rh-cluster-source','aws_secret_access_key',key['SecretAccessKey'])
    fd,temp=tempfile.mkstemp(prefix='.credentials-',dir=credentials.parent)
    with os.fdopen(fd,'w') as f: config.write(f)
    os.replace(temp,credentials); credentials.chmod(0o600)
aws('configure','set','profile.rh-cluster-operator.source_profile','rh-cluster-source')
aws('configure','set','profile.rh-cluster-operator.region','us-east-2')
print('Configured rh-cluster-operator; temporary role credentials, exact five instance IDs, no IAM permissions.')
