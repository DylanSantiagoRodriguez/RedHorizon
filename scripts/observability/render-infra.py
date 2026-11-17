#!/usr/bin/env python3
"""Additive CloudFormation; never manages the lifecycle of existing EC2."""
import json
from pathlib import Path
R={}
def ref(x):return {'Ref':x}
def get(x,y):return {'Fn::GetAtt':[x,y]}
def resource(n,t,p):R[n]={'Type':t,'Properties':p}
tags=[{'Key':'Project','Value':'RedHorizonCluster'},{'Key':'Component','Value':'Observability'}]
params={'VpcId':{'Type':'AWS::EC2::VPC::Id','Default':'vpc-0acc002bf61620138'},'SubnetId':{'Type':'AWS::EC2::Subnet::Id','Default':'subnet-0fde15f950925cb60'},'UbuntuAmi':{'Type':'AWS::EC2::Image::Id','Description':'Verified Canonical Ubuntu 24.04 amd64 in us-east-2'}}
for n,v in [('Gateway','sg-0929579efb3434239'),('Game','sg-09a457a3eab1df5bd'),('Coordinator','sg-01d10d3f03ff7797f')]:params[n+'Group']={'Type':'AWS::EC2::SecurityGroup::Id','Default':v}
for n in ['Observability','Events']:
 params[n+'KeyName']={'Type':'AWS::EC2::KeyPair::KeyName'}
 resource(n+'Group','AWS::EC2::SecurityGroup',{'VpcId':ref('VpcId'),'GroupDescription':'Red Horizon private '+n,'Tags':tags,'SecurityGroupEgress':[{'IpProtocol':'tcp','FromPort':p,'ToPort':p,'CidrIp':'0.0.0.0/0'} for p in [80,443]]})
def group(n):return get(n+'Group','GroupId') if n in ['Observability','Events'] else ref(n+'Group')
def link(n,src,dst,port):
 resource(n+'In','AWS::EC2::SecurityGroupIngress',{'GroupId':group(dst),'IpProtocol':'tcp','FromPort':port,'ToPort':port,'SourceSecurityGroupId':group(src)})
 resource(n+'Out','AWS::EC2::SecurityGroupEgress',{'GroupId':group(src),'IpProtocol':'tcp','FromPort':port,'ToPort':port,'DestinationSecurityGroupId':group(dst)})
link('Panel','Gateway','Observability',8444)
for n in ['Gateway','Game','Coordinator','Observability','Events']:
 link('Metrics'+n,'Observability',n,9400)
 link('Kafka'+n,n,'Events',9093)
for n in ['Observability','Events']:
 policy=[{'PolicyName':'ReadBasicMetrics','PolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Action':'cloudwatch:GetMetricStatistics','Resource':'*'}]}}] if n=='Observability' else []
 resource(n+'Role','AWS::IAM::Role',{'PermissionsBoundary':'arn:aws:iam::670036769494:policy/RedHorizonObservabilityRuntimeBoundary','AssumeRolePolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':'ec2.amazonaws.com'},'Action':'sts:AssumeRole'}]},'ManagedPolicyArns':['arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'],'Policies':policy,'Tags':tags})
 resource(n+'Profile','AWS::IAM::InstanceProfile',{'Roles':[ref(n+'Role')]})
 resource(n,'AWS::EC2::Instance',{'ImageId':ref('UbuntuAmi'),'InstanceType':'t3.medium','KeyName':ref(n+'KeyName'),'IamInstanceProfile':ref(n+'Profile'),'MetadataOptions':{'HttpTokens':'required','HttpEndpoint':'enabled','HttpPutResponseHopLimit':1},'CreditSpecification':{'CPUCredits':'standard'},'DisableApiTermination':True,'NetworkInterfaces':[{'DeviceIndex':'0','AssociatePublicIpAddress':True,'SubnetId':ref('SubnetId'),'GroupSet':[group(n)]}],'BlockDeviceMappings':[{'DeviceName':'/dev/sda1','Ebs':{'VolumeSize':30 if n=='Observability' else 40,'VolumeType':'gp3','Encrypted':True,'DeleteOnTermination':False}}],'Tags':tags+[{'Key':'Name','Value':'rh-'+n.lower()}],'UserData':{'Fn::Base64':'#!/bin/bash\nset -euo pipefail\nsystemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service\n'}})
 R[n].update(DeletionPolicy='Retain',UpdateReplacePolicy='Retain')
outputs={}
for n in ['Observability','Events']:
 outputs[n]={'Value':ref(n)}
 for a in ['PrivateIp','PublicIp']:outputs[n+a]={'Value':get(n,a)}
 outputs[n+'Group']={'Value':group(n)}
Path('deploy/observability/infrastructure.json').write_text(json.dumps({'AWSTemplateFormatVersion':'2010-09-09','Description':'Red Horizon observability: two additive nodes, no NAT/ALB/MSK; existing instances remain unmanaged.','Parameters':params,'Resources':R,'Outputs':outputs},indent=2)+'\n')
