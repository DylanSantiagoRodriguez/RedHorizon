#!/usr/bin/env python3
"""Validate the nginx template without starting a service or using production keys."""
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4
import os
import tempfile
import sys
import shutil
import subprocess
if sys.platform != 'darwin':
    os.environ.setdefault('RH_KEY_ROOT', str(Path(tempfile.gettempdir())/'rh-test-keys'))
from pki import generate, ROOT
keys=ROOT/('nginx-test-'+str(uuid4()))
try:
    generate(keys, {'rh-gateway':'127.0.0.1'})
    with TemporaryDirectory(prefix='rh-nginx-') as directory:
        tmp=Path(directory)
        config=Path('deploy/cluster/nginx.conf').read_text().replace('__DOMAIN__','rh-gateway')
        config=config.replace('/etc/letsencrypt/live/rh-gateway/fullchain.pem',str(keys/'rh-gateway.crt')).replace('/etc/letsencrypt/live/rh-gateway/privkey.pem',str(keys/'rh-gateway.key'))
        config=config.replace('listen 80;','listen 18080;').replace('listen 443 ssl;','listen 18443 ssl;')
        pre=f'pid {tmp}/nginx.pid;\nerror_log stderr;\nevents {{ worker_connections 128; }}\nhttp {{\naccess_log off;\n'
        for kind in ['client_body','proxy','fastcgi','uwsgi','scgi']: pre+=f'{kind}_temp_path {tmp}/{kind};\n'
        (tmp/'nginx.conf').write_text(pre+config+'\n}\n')
        subprocess.run(['nginx','-t','-p',str(tmp),'-c',str(tmp/'nginx.conf'),'-e','stderr'],check=True)
finally:
    if keys.exists(): shutil.rmtree(keys)
