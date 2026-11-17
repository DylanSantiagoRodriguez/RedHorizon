#!/usr/bin/env python3
"""After owner changes DNS and legacy rooms finish, retire the old entry."""
import argparse,json,urllib.request
from pathlib import Path
from remote import aws,ssh
p=argparse.ArgumentParser();p.add_argument('--execute',action='store_true');a=p.parse_args()
i=json.loads(Path('.cluster-local/inventory.json').read_text());nodes=i['nodes'];gateway=nodes['rh-gateway']['publicIp']
for host in ['redhorizon.lat','www.redhorizon.lat']:
 for endpoint in ['https://dns.google/resolve','https://cloudflare-dns.com/dns-query']:
  for kind in ['A','AAAA']:
   request=urllib.request.Request(endpoint+'?name='+host+'&type='+kind,headers={'Accept':'application/dns-json'})
   response=json.load(urllib.request.urlopen(request,timeout=10));assert response['Status']==0
   addresses=[x['data'] for x in response.get('Answer',[]) if x['type']==(1 if kind=='A' else 28)]
   assert set(addresses)==({gateway} if kind=='A' else set()), 'DNS not converged: '+host+' '+kind
print('Two public resolvers return only the gateway for apex and www, and no stale IPv6.')
if a.execute:
 health=json.load(urllib.request.urlopen('https://redhorizon.lat/health',timeout=10))
 assert health['ok'] and 'connections' in health, 'Public health is not the gateway'
 # Old rooms cannot migrate to the new directory. Preserve their established
 # sockets until they finish; a DNS change alone does not move RAM sessions.
 ssh('rh-game-01',nodes['rh-game-01'],'''set -euo pipefail
curl -fsS localhost:8787/health | python3 -c 'import json,sys;assert json.load(sys.stdin)["rooms"]==0, "Legacy rooms still active"'
systemctl disable --now caddy redhorizon-backend redhorizon-deploy.timer
''')
 aws('ec2','modify-instance-attribute','--instance-id',nodes['rh-game-01']['instanceId'],'--groups',i['groups']['GameSecurityGroup'])
 print('Empty legacy service stopped; gateway group removed from game-01. Cluster workers were not restarted.')
