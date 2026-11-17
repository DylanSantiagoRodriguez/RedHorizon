#!/usr/bin/env python3
"""Read only. Assemble the five-node inventory after the approved stack exists."""
import argparse,json
from remote import aws
p=argparse.ArgumentParser();p.add_argument('stack');args=p.parse_args()
s=aws('cloudformation','describe-stacks','--stack-name',args.stack)['Stacks'][0]
o={x['OutputKey']:x['OutputValue'] for x in s['Outputs']}
ids={'rh-game-01':'i-0db322d7e36dea80a','rh-gateway':o['Gateway'],'rh-game-02':o['Game02'],'rh-game-03':o['Game03'],'rh-coordinator':o['Coordinator']}
assert len(set(ids.values()))==5
instances=aws('ec2','describe-instances','--instance-ids',*ids.values())
by_id={i['InstanceId']:i for r in instances['Reservations'] for i in r['Instances']}
print(json.dumps({'origin':'https://redhorizon.lat','nodes':{name:{'instanceId':id,'privateIp':by_id[id]['PrivateIpAddress'],'publicIp':by_id[id].get('PublicIpAddress'),'type':by_id[id]['InstanceType'],'measuredCapacity':0} for name,id in ids.items()},'groups':{k:v for k,v in o.items() if k.endswith('SecurityGroup')}},indent=2))
