#!/usr/bin/env python3
"""Apply a verified frontend delta and gracefully reload Nginx; never stop games.

The caller must verify protocol compatibility with the currently running backend.
Old hashed assets remain available for tabs opened before this release.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile

p = argparse.ArgumentParser()
p.add_argument('archive'); p.add_argument('sha256'); p.add_argument('release')
p.add_argument('--compatible-runtime', required=True)
a = p.parse_args()
assert os.geteuid() == 0
assert re.fullmatch(r'[a-f0-9]{40}', a.release)
assert hashlib.file_digest(open(a.archive, 'rb'), 'sha256').hexdigest() == a.sha256
assert json.loads(Path('/etc/redhorizon-cluster/cluster.json').read_text())['id'] == 'rh-gateway'
base = Path('/srv/redhorizon-cluster')
runtime = json.loads((base / 'current/runtime/release.json').read_text())['commit']
assert runtime == a.compatible_runtime
config = Path('/etc/nginx/conf.d/redhorizon.conf')
old = config.read_text()
roots = re.findall(r'^\s*root (/srv/redhorizon-cluster/[^;]+);', old, re.M)
assert len(roots) == 1
source = Path(roots[0]).resolve()
assert source.is_relative_to(base) and (source / 'index.html').is_file()
target = base / 'frontend-releases' / a.release
assert not target.exists()
target.parent.mkdir(mode=0o755, exist_ok=True)
with tarfile.open(a.archive, 'r:gz') as archive:
    manifest = json.load(archive.extractfile('delta.json'))
    assert manifest['commit'] == a.release
    # The delta's unchanged files must match the running full release baseline.
    assert runtime in manifest['baseCommits']
    subprocess.run(['cp', '-al', str(source), str(target)], check=True)
    def destination(name):
        parts = PurePosixPath(name).parts
        assert parts[0] == 'frontend' and len(parts) > 1 and '..' not in parts
        result = target.joinpath(*parts[1:])
        assert not result.is_symlink()
        for parent in result.parents:
            if parent == target: break
            assert not parent.is_symlink()
        return result
    for name in manifest['changed']:
        if not name.startswith('frontend/'): continue
        member = archive.getmember(name)
        assert member.isfile()
        path = destination(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Unlink inherited hard links so the previous frontend is unchanged.
        path.unlink(missing_ok=True)
        with path.open('xb') as output: output.write(archive.extractfile(member).read())
        path.chmod(0o644)
    verified = 0
    for name, entry in manifest['entries'].items():
        if not name.startswith('frontend/'): continue
        path = destination(name)
        assert entry['type'] == 'file'
        assert hashlib.file_digest(path.open('rb'), 'sha256').hexdigest() == entry['sha256'], name
        verified += 1
    # Keep only obsolete content-addressed JS/CSS assets for already-open tabs.
    for name in manifest['removed']:
        if not name.startswith('frontend/'): continue
        path = destination(name)
        if name.startswith('frontend/assets/') and re.search(r'-[A-Za-z0-9_-]{8,}\.(js|css)$', name): continue
        path.unlink(missing_ok=True)
(target / 'frontend-release.json').write_text(json.dumps({'commit': a.release, 'compatibleRuntime': runtime, 'artifactSha256': a.sha256}) + '\n')
backup = base / ('nginx-before-frontend-' + a.release + '.conf')
with backup.open('x') as output: output.write(old)
new = old.replace('root ' + roots[0] + ';', 'root ' + str(target) + ';')
assert new != old
try:
    config.write_text(new)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except BaseException:
    config.write_text(old)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print(json.dumps({'frontend': a.release, 'runtimeUnchanged': runtime, 'filesVerified': verified, 'previousRoot': str(source), 'nginxRollback': str(backup)}))
