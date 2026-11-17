#!/usr/bin/env python3
"""Render nonsecret configs from an approved inventory. Capacities default to zero."""
import argparse
import ipaddress
import json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('inventory');p.add_argument('output');args=p.parse_args()
i=json.loads(Path(args.inventory).read_text());nodes=i['nodes'];out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
ids=['rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator']
assert set(nodes)==set(ids)
for n in nodes.values(): ipaddress.ip_address(n['privateIp'])
coordinator=f"https://{nodes['rh-coordinator']['privateIp']}:8443"
for name in ids:
    c={'id':name,'tlsDir':'/etc/redhorizon-cluster/tls'}
    if name=='rh-coordinator': c.update(host=nodes[name]['privateIp'],port=8443,workers=ids[1:4],redisUrl='redis://127.0.0.1:6379')
    elif name=='rh-gateway': c.update(port=8788,trustProxy=True,origins=[i['origin']],coordinator=coordinator,workers={n:f"wss://{nodes[n]['privateIp']}:8787/ws" for n in ids[1:4]})
    else:
        capacity=nodes[name].get('measuredCapacity',0)
        assert isinstance(capacity,int) and 0 <= capacity <= 256
        c.update(host=nodes[name]['privateIp'],port=8787,coordinator=coordinator,origins=[i['origin']],capacity=capacity,statusFile='/run/redhorizon-cluster/status.json',tickHz=60,snapshotHz=10,maxConnections=256,perIp=12)
    (out/(name+'.json')).write_text(json.dumps(c,indent=2)+'\n')
(out/'hosts.json').write_text(json.dumps({n:nodes[n]['privateIp'] for n in ids},indent=2)+'\n')
