#!/usr/bin/env python3
"""Run only as part of the approved provisioning step. Import public keys, never private."""
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone
root=Path('/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon')
root.mkdir(mode=0o700,parents=True,exist_ok=True); root.chmod(0o700); os.umask(0o077)
suffix=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
for role in ['gateway','game-02','game-03','coordinator']:
    name=f'rh-{role}-{suffix}'
    private=root/(name+'.pem')
    if private.exists(): raise SystemExit('Refusing to overwrite key')
    subprocess.run(['ssh-keygen','-q','-t','rsa','-b','3072','-m','PEM','-N','','-C',name,'-f',str(private)],check=True)
    private.chmod(0o600)
    subprocess.run(['aws','ec2','import-key-pair','--region','us-east-2','--key-name',name,'--public-key-material','fileb://'+str(private)+'.pub','--query','KeyName','--output','text','--no-cli-pager'],check=True)
