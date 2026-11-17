#!/usr/bin/env python3
"""Host-side activation: no build, no downloads, no secrets in release artifacts."""
import argparse,hashlib,json,os,re,subprocess,tarfile
from pathlib import Path,PurePosixPath
p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('sha256');p.add_argument('release');p.add_argument('--resume-verification',action='store_true');a=p.parse_args()
assert os.geteuid()==0 and re.fullmatch(r'[a-zA-Z0-9._-]+',a.release)
assert hashlib.file_digest(open(a.archive,'rb'),'sha256').hexdigest()==a.sha256
assert subprocess.run(['systemctl','is-active','--quiet','redhorizon-cluster']).returncode!=0
base=Path('/srv/redhorizon-cluster');previous=(base/'current').resolve();target=base/'releases'/a.release
assert target.exists() == a.resume_verification
with tarfile.open(a.archive,'r:gz') as archive:
 manifest=json.load(archive.extractfile('delta.json'))
 assert json.loads((previous/'runtime/release.json').read_text())['commit'] in manifest['baseCommits']
 def path(name):
  parts=PurePosixPath(name).parts
  assert parts and (parts[0] in ['runtime','frontend','node'] or len(parts)==1 and parts[0] in ['._runtime','._frontend','._node']) and '..' not in parts and not name.startswith('/')
  result=target.joinpath(*parts)
  # Never traverse inherited symlinks while writing.
  for ancestor in result.parents:
   if ancestor==target:break
   assert not ancestor.is_symlink()
  return result
 if not a.resume_verification:subprocess.run(['cp','-al',str(previous),str(target)],check=True)
 for name in ([] if a.resume_verification else manifest['removed']):
  destination=path(name);destination.unlink(missing_ok=True)
 for name in ([] if a.resume_verification else manifest['changed']):
  m=archive.getmember(name);destination=path(name);destination.parent.mkdir(parents=True,exist_ok=True)
  # Unlink first: writing through inherited hard links would mutate rollback data.
  destination.unlink(missing_ok=True)
  if m.isfile():
   with destination.open('xb') as out:out.write(archive.extractfile(m).read())
   destination.chmod(m.mode)
  elif m.issym():
   assert not m.linkname.startswith('/')
   assert (destination.parent/m.linkname).resolve().is_relative_to(target)
   destination.symlink_to(m.linkname)
  else:raise ValueError('Unsupported delta member')
 for name,entry in manifest['entries'].items():
  destination=path(name)
  if entry['type']=='file':
   assert not destination.is_symlink() and hashlib.file_digest(destination.open('rb'),'sha256').hexdigest()==entry['sha256'], name
   assert destination.stat().st_mode & 0o777 == entry['mode'] & 0o777
  else:assert destination.is_symlink() and os.readlink(destination)==entry['link']
 # Switch only after the entire reconstructed release matches the full artifact.
 next_link=base/'next';next_link.symlink_to(target);os.replace(next_link,base/'current')
 if subprocess.run(['systemctl','start','redhorizon-cluster']).returncode:
  next_link.symlink_to(previous);os.replace(next_link,base/'current');subprocess.run(['systemctl','start','redhorizon-cluster'],check=True)
  raise RuntimeError('Start failed; previous release restored')
 print('Every release file verified against the full artifact; service started.')
