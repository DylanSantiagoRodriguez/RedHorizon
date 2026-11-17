#!/usr/bin/env python3
"""Syntax validation of the patched real gateway config using isolated paths and lab PKI."""
import argparse,json,subprocess,tempfile,importlib.util
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('original');a=p.parse_args()
spec=importlib.util.spec_from_file_location('gateway','scripts/observability/gateway-config.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
lab=json.loads(Path('.cluster-local/observability/lab.json').read_text());keys=Path(lab['keys'])
with tempfile.TemporaryDirectory(prefix='rh-ops-nginx-') as d:
 tmp=Path(d);ops=Path('deploy/observability/nginx-ops.conf').read_text().replace('__OBS_PRIVATE_IP__','127.0.0.1').replace('/etc/redhorizon-observer/tls/',str(keys)+'/')
 (tmp/'ops.conf').write_text(ops)
 text=module.patch(Path(a.original).read_text()).replace('/etc/nginx/redhorizon-ops.inc',str(tmp/'ops.conf')).replace('/var/log/redhorizon-observer/nginx.log',str(tmp/'access.log')).replace('/etc/letsencrypt/live/redhorizon.lat/fullchain.pem',str(keys/'rh-gateway.crt')).replace('/etc/letsencrypt/live/redhorizon.lat/privkey.pem',str(keys/'rh-gateway.key')).replace('listen 80;','listen 18080;').replace('listen 443 ssl;','listen 18443 ssl;')
 pre=f'pid {tmp}/nginx.pid;\nerror_log stderr;\nevents {{ worker_connections 128; }}\nhttp {{\naccess_log off;\n'
 for kind in ['client_body','proxy','fastcgi','uwsgi','scgi']:pre+=f'{kind}_temp_path {tmp}/{kind};\n'
 (tmp/'nginx.conf').write_text(pre+Path('deploy/observability/nginx-telemetry-http.conf').read_text()+text+'\n}\n')
 subprocess.run(['nginx','-t','-p',str(tmp),'-c',str(tmp/'nginx.conf'),'-e','stderr'],check=True)
