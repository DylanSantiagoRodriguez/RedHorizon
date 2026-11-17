#!/usr/bin/env python3
"""Read standard CloudWatch metrics and host status without custom metric charges."""
import argparse,json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from pathlib import Path
from remote import aws,ssh
p=argparse.ArgumentParser();p.add_argument('--output',default='.cluster-local/observations.json');a=p.parse_args()
nodes=json.loads(Path('.cluster-local/inventory.json').read_text())['nodes']
end=datetime.now(timezone.utc);start=end-timedelta(hours=2)
def collect(item):
 name,node=item;metrics={}
 for metric in ['CPUUtilization','CPUCreditBalance','NetworkIn','NetworkOut']:
  statistic='Sum' if metric.startswith('Network') else 'Average'
  r=aws('cloudwatch','get-metric-statistics','--namespace','AWS/EC2','--metric-name',metric,'--dimensions','Name=InstanceId,Value='+node['instanceId'],'--start-time',start.isoformat(),'--end-time',end.isoformat(),'--period','300','--statistics',statistic)
  metrics[metric]=sorted(r['Datapoints'],key=lambda p:p['Timestamp'])
 status=json.loads(ssh(name,node,'cat /run/redhorizon-cluster/status.json').stdout) if name.startswith('rh-game-') else None
 return name,{'instanceId':node['instanceId'],'metrics':metrics,'workerStatus':status}
with ThreadPoolExecutor(max_workers=5) as pool: observations=dict(pool.map(collect,nodes.items()))
Path(a.output).write_text(json.dumps({'at':end.isoformat(),'start':start.isoformat(),'nodes':observations},indent=2))
print('Saved CPU, credits, network and worker status to '+a.output)
