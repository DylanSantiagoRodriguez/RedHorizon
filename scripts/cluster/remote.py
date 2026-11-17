#!/usr/bin/env python3
"""Private local transport helpers. Never put private keys in SSM command payloads."""
import json
import os
import shlex
from pathlib import Path
import subprocess
import time

REGION='us-east-2'
LOCAL=Path('.cluster-local')
KEYS=Path('/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon')
PROFILE=os.environ.get('RH_AWS_PROFILE','rh-cluster-operator')

def aws(*args, profile=PROFILE):
    command=['aws',*args,'--region',REGION,'--output','json','--no-cli-pager']
    if profile: command+=['--profile',profile]
    try: output=subprocess.check_output(command,stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as error: raise RuntimeError(error.stderr.decode()[:500]) from None
    return json.loads(output) if output.strip() else {}

def ssm(instance, command, timeout=120, profile=PROFILE):
    result=aws('ssm','send-command','--instance-ids',instance,'--document-name','AWS-RunShellScript','--parameters',json.dumps({'commands':[command],'executionTimeout':[str(timeout)]}),profile=profile)
    command_id=result['Command']['CommandId']
    end=time.monotonic()+timeout+30
    while time.monotonic()<end:
        try: result=aws('ssm','get-command-invocation','--command-id',command_id,'--instance-id',instance,profile=profile)
        except RuntimeError:
            time.sleep(2);continue
        if result['Status'] not in ['Pending','InProgress','Delayed']:
            if result['Status']!='Success': raise RuntimeError(result.get('StandardErrorContent','SSM failure'))
            return result['StandardOutputContent']
        time.sleep(2)
    raise TimeoutError(command_id)

def key_for(name):
    if name=='rh-game-01': return KEYS/'redhorizon.pem'
    matches=sorted(KEYS.glob(name+'-*.pem'))
    if not matches: raise RuntimeError('Missing local PEM for '+name)
    return matches[-1]

def pin_host(name,node):
    public_key=ssm(node['instanceId'],'cat /etc/ssh/ssh_host_ed25519_key.pub').strip()
    if not public_key.startswith('ssh-ed25519 '): raise RuntimeError('Unexpected host key')
    path=LOCAL/(name+'.known_hosts')
    path.write_text(node['publicIp']+' '+public_key+'\n');path.chmod(0o600)
    return path

def options(name,node=None):
    result=['-i',str(key_for(name)),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',f'UserKnownHostsFile={LOCAL/(name+".known_hosts")}','-o','ConnectTimeout=30','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=4']
    if os.environ.get('RH_TRANSPORT','ssm')=='ssm':
        node=node or json.loads((LOCAL/'inventory.json').read_text())['nodes'][name]
        proxy=['aws','ssm','start-session','--target',node['instanceId'],'--document-name','AWS-StartSSHSession','--parameters','portNumber=22','--region',REGION,'--profile',PROFILE]
        result+=['-o','ProxyCommand='+shlex.join(proxy)]
    return result

def ssh(name,node,script,check=True):
    return subprocess.run(['ssh',*options(name,node),'ubuntu@'+node['publicIp'],'sudo bash -s'],input=script,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=check)

def upload(name,node,paths,directory):
    subprocess.run(['scp',*options(name,node),*map(str,paths),'ubuntu@'+node['publicIp']+':'+directory],check=True,stdout=subprocess.DEVNULL)
