#!/usr/bin/env python3
"""Render Nginx with the exact domain and an optional temporary trusted proxy."""
import argparse,ipaddress,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('domain');p.add_argument('output');p.add_argument('--legacy-proxy-ip');a=p.parse_args()
assert re.fullmatch(r'[a-z0-9]+(?:[-.][a-z0-9]+)+',a.domain)
text=Path('deploy/cluster/nginx.conf').read_text().replace('__DOMAIN__',a.domain)
if a.legacy_proxy_ip:
    ip=ipaddress.ip_address(a.legacy_proxy_ip);assert ip.version==4 and ip.is_private
    text=text.replace('    listen 443 ssl;',f'    listen 443 ssl;\n    set_real_ip_from {ip};\n    real_ip_header X-Forwarded-For;\n    real_ip_recursive on;')
text+=f'''
server {{
    listen 443 ssl;
    server_name www.{a.domain};
    ssl_certificate /etc/letsencrypt/live/{a.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{a.domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;
    return 301 https://{a.domain}$request_uri;
}}
'''
Path(a.output).write_text(text)
