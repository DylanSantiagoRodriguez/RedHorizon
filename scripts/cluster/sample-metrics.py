#!/usr/bin/env python3
import json,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from remote import ssh
nodes=json.loads(Path('.cluster-local/inventory.json').read_text())['nodes'];samples=[]
def sample(item):
 name,node=item
 r=ssh(name,node,'cat /run/redhorizon-cluster/status.json')
 return json.loads(r.stdout)
with ThreadPoolExecutor(max_workers=3) as pool:
 for i in range(26):
  samples.extend(pool.map(sample,[(n,v) for n,v in nodes.items() if n.startswith('rh-game-')]))
  Path('.cluster-local/live-metrics.json').write_text(json.dumps(samples,indent=2))
  time.sleep(5)
print('Collected',len(samples),'worker metric samples')
