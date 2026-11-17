#!/usr/bin/env python3
"""Build a small, verifiable delta locally from trusted full release artifacts."""
import argparse,hashlib,io,json,tarfile
from pathlib import Path,PurePosixPath
p=argparse.ArgumentParser();p.add_argument('target');p.add_argument('output');p.add_argument('--base',action='append',required=True);a=p.parse_args()
def scan(path):
 entries={};commit=None
 with tarfile.open(path,'r:gz') as archive:
  for m in archive:
   name=str(PurePosixPath(m.name))
   assert not name.startswith('/') and '..' not in PurePosixPath(name).parts
   if m.isfile():
    content=archive.extractfile(m).read();entries[name]={'type':'file','sha256':hashlib.sha256(content).hexdigest(),'mode':m.mode}
    if name=='runtime/release.json':commit=json.loads(content)['commit']
   elif m.issym():entries[name]={'type':'link','link':m.linkname,'mode':m.mode}
   else:assert m.isdir(), 'Unexpected archive member'
 assert commit and not commit.endswith('-worktree')
 return commit,entries
bases=[scan(path) for path in a.base];commit,entries=scan(a.target)
changed={name for name,value in entries.items() if any(base.get(name)!=value for _,base in bases)}
removed=sorted({name for _,base in bases for name in base if name not in entries})
full_sha=hashlib.file_digest(open(a.target,'rb'),'sha256').hexdigest()
manifest={'commit':commit,'baseCommits':[c for c,_ in bases],'fullArtifactSha256':full_sha,'entries':entries,'changed':sorted(changed),'removed':removed}
with tarfile.open(a.output,'w:gz') as out:
 data=json.dumps(manifest,separators=(',',':')).encode();info=tarfile.TarInfo('delta.json');info.size=len(data);info.mode=0o644;out.addfile(info,io.BytesIO(data))
 with tarfile.open(a.target,'r:gz') as archive:
  for m in archive:
   if str(PurePosixPath(m.name)) in changed:out.addfile(m,archive.extractfile(m) if m.isfile() else None)
print(json.dumps({'commit':commit,'changedFiles':len(changed),'bytes':Path(a.output).stat().st_size,'fullArtifactSha256':full_sha}))
