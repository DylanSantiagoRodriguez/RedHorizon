#!/usr/bin/env python3
"""Render the four NEW nodes; the primary instance is deliberately not managed here."""
import json
from pathlib import Path
R = {}
def ref(name): return {'Ref': name}
def get(name, attr): return {'Fn::GetAtt': [name, attr]}
def resource(name, kind, props): R[name] = {'Type': kind, 'Properties': props}
tags = [{'Key':'Project','Value':'RedHorizonCluster'}]
for name in ['Gateway', 'Game', 'Coordinator']:
    resource(name+'SecurityGroup','AWS::EC2::SecurityGroup',{
        'GroupDescription': 'Red Horizon cluster '+name, 'VpcId':ref('VpcId'), 'Tags':tags,
        'SecurityGroupEgress':[{'IpProtocol':'tcp','FromPort':443,'ToPort':443,'CidrIp':'0.0.0.0/0'}, {'IpProtocol':'tcp','FromPort':80,'ToPort':80,'CidrIp':'0.0.0.0/0'}]})
for port in [80,443]:
    resource('Public'+str(port),'AWS::EC2::SecurityGroupIngress',{'GroupId':get('GatewaySecurityGroup','GroupId'),'IpProtocol':'tcp','FromPort':port,'ToPort':port,'CidrIp':'0.0.0.0/0'})
for name,source,target,port in [('GatewayGame','Gateway','Game',8787),('GatewayCoordinator','Gateway','Coordinator',8443),('GameCoordinator','Game','Coordinator',8443)]:
    resource(name+'In','AWS::EC2::SecurityGroupIngress',{'GroupId':get(target+'SecurityGroup','GroupId'),'IpProtocol':'tcp','FromPort':port,'ToPort':port,'SourceSecurityGroupId':get(source+'SecurityGroup','GroupId')})
    resource(name+'Out','AWS::EC2::SecurityGroupEgress',{'GroupId':get(source+'SecurityGroup','GroupId'),'IpProtocol':'tcp','FromPort':port,'ToPort':port,'DestinationSecurityGroupId':get(target+'SecurityGroup','GroupId')})
# No inbound SSH. Existing VPC DNS resolver remains available.
resource('NodeRole','AWS::IAM::Role',{'AssumeRolePolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':'ec2.amazonaws.com'},'Action':'sts:AssumeRole'}]},'ManagedPolicyArns':['arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'],'Tags':tags})
resource('NodeProfile','AWS::IAM::InstanceProfile',{'Roles':[ref('NodeRole')]})
for logical,name,kind,sg in [('Gateway','rh-gateway','t3.micro','Gateway'),('Game02','rh-game-02','t3.small','Game'),('Game03','rh-game-03','t3.small','Game'),('Coordinator','rh-coordinator','t3.micro','Coordinator')]:
    resource(logical,'AWS::EC2::Instance',{
        'ImageId':ref('UbuntuAmi'),'InstanceType':kind,'KeyName':ref(logical+'KeyName'),
        'IamInstanceProfile':ref('NodeProfile'),'MetadataOptions':{'HttpTokens':'required','HttpEndpoint':'enabled','HttpPutResponseHopLimit':1},
        'CreditSpecification':{'CPUCredits':'standard'},'DisableApiTermination':True,
        'NetworkInterfaces':[{'DeviceIndex':'0','AssociatePublicIpAddress':True,'SubnetId':ref('SubnetId'),'GroupSet':[get(sg+'SecurityGroup','GroupId')]}],
        'BlockDeviceMappings':[{'DeviceName':'/dev/sda1','Ebs':{'VolumeSize':20,'VolumeType':'gp3','Encrypted':True,'DeleteOnTermination':True}}],
        'Tags':tags+[{'Key':'Name','Value':name}],
        'UserData':{'Fn::Base64':'#!/bin/bash\nset -euo pipefail\n# Ubuntu AWS AMI includes SSM agent. No secrets or application code in user-data.\nsystemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service\n'}})
    R[logical]['DeletionPolicy']='Retain'; R[logical]['UpdateReplacePolicy']='Retain'
params={'VpcId':{'Type':'AWS::EC2::VPC::Id','Default':'vpc-0acc002bf61620138'},'SubnetId':{'Type':'AWS::EC2::Subnet::Id','Default':'subnet-0fde15f950925cb60'},'UbuntuAmi':{'Type':'AWS::EC2::Image::Id','Description':'Pin verified Canonical Ubuntu 24.04 amd64 AMI in us-east-2'}}
for n in ['Gateway','Game02','Game03','Coordinator']: params[n+'KeyName']={'Type':'AWS::EC2::KeyPair::KeyName'}
outputs={n:{'Value':ref(n)} for n in ['Gateway','Game02','Game03','Coordinator','NodeProfile']}
for n in ['Gateway','Game02','Game03','Coordinator']:
    for attr in ['PrivateIp','PublicIp']: outputs[n+attr]={'Value':get(n,attr)}
for n in ['Gateway','Game','Coordinator']: outputs[n+'SecurityGroup']={'Value':get(n+'SecurityGroup','GroupId')}
Path('deploy/cluster/infrastructure.json').write_text(json.dumps({'AWSTemplateFormatVersion':'2010-09-09','Description':'Red Horizon: four additional nodes; primary stays outside stack lifecycle.','Parameters':params,'Resources':R,'Outputs':outputs},indent=2)+'\n')
