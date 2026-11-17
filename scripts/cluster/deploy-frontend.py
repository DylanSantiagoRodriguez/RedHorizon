#!/usr/bin/env python3
"""Publish a frontend-only compatible fix without restarting WebSocket processes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
from remote import upload, ssm

p = argparse.ArgumentParser()
p.add_argument('artifact'); p.add_argument('--base', required=True)
p.add_argument('--release', required=True); p.add_argument('--compatible-runtime', required=True)
a = p.parse_args()
assert re.fullmatch(r'[a-f0-9]{40}', a.release)
assert re.fullmatch(r'[a-f0-9]{40}', a.compatible_runtime)
node = json.loads(Path('.cluster-local/inventory.json').read_text())['nodes']['rh-gateway']
delta = Path('.cluster-local/artifacts') / ('frontend-' + a.release + '.tar.gz')
assert not delta.exists()
subprocess.run(['python3', 'scripts/cluster/make-delta.py', a.artifact, str(delta), '--base', a.base], check=True)
digest = hashlib.file_digest(delta.open('rb'), 'sha256').hexdigest()
remote = '/home/ubuntu/rh-stage/'
upload('rh-gateway', node, [delta, Path('scripts/cluster/activate-frontend.py')], remote)
command = shlex.join(['python3', remote + 'activate-frontend.py', remote + delta.name, digest, a.release, '--compatible-runtime', a.compatible_runtime])
result = ssm(node['instanceId'], command, timeout=180)
Path('.cluster-local/frontend-deployment-' + a.release + '.json').write_text(result)
print(result)
