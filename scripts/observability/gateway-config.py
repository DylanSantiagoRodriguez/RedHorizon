#!/usr/bin/env python3
"""Patch the inspected gateway config while preserving frontend, TLS and game routes."""
import argparse,re
from pathlib import Path
def patch(text):
 if 'redhorizon-ops.inc' in text:raise ValueError('Already configured; inspect before reapplying')
 candidates=[]
 for start in re.finditer(r'\bserver\s*\{',text):
  depth=1;end=start.end()
  while end<len(text) and depth:
   if text[end]=='{':depth+=1
   if text[end]=='}':depth-=1
   end+=1
  block=text[start.end():end-1]
  if re.search(r'\blisten\s+443\s+ssl\s*;',block) and re.search(r'\bserver_name\s+redhorizon\.lat\s*;',block):candidates.append((start.end(),end-1,block))
 if len(candidates)!=1:raise ValueError('Expected exactly one existing HTTPS apex server')
 begin,end,block=candidates[0]
 # The inspected /ws location explicitly disabled the original URL-bearing access log.
 block=block.replace('access_log off; # no room hints or tokens in access logs','access_log /var/log/redhorizon-observer/nginx.log rh_observability; # sanitized counters only')
 return text[:begin]+'\n    include /etc/nginx/redhorizon-ops.inc;\n    access_log /var/log/redhorizon-observer/nginx.log rh_observability;'+block+text[end:]
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('output');a=p.parse_args();Path(a.output).write_text(patch(Path(a.source).read_text()))
