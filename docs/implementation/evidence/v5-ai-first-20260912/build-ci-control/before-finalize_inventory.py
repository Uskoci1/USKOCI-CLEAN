"""Inventory-only commit. Never writes SQL/source, live DB, canonical or another branch."""
import hashlib,json,os,re,subprocess
from pathlib import Path
BASE='06d51ecb1438a93a4ecce64692ff868474fca598'
BRANCH='work/pre-v3-engine-integration-20260911'
def git(*args): return subprocess.check_output(['git',*args],text=True).strip()
def raw(ref,path): return subprocess.check_output(['git','show',ref+':'+str(path)])
expected=os.environ['SOURCE_SHA'];assert re.fullmatch('[a-f0-9]{40}',expected)
assert git('rev-parse','HEAD')==expected and not git('status','--porcelain')
subprocess.run(['git','merge-base','--is-ancestor',BASE,'HEAD'],check=True)
mdir=Path('supabase/migrations');mp=mdir/'MIGRATION_PROVENANCE.json';manifest=mdir/'MD5_MANIFEST.txt'
previous=json.loads(raw(BASE,mp));m=json.loads(mp.read_text())
assert m['live_history_snapshot']==previous['live_history_snapshot']
old={x['file']:x for x in previous['pending_forward_migrations']}
assert {x['file']:x for x in m['pending_forward_migrations'] if x['file'] in old}==old
old_names=git('ls-tree','-r','--name-only',BASE,'supabase/migrations').splitlines()
for name in old_names:
 if name.endswith('.sql'): assert Path(name).read_bytes()==raw(BASE,name),name
for p in sorted(mdir.glob('*.sql')):
 if str(p) in old_names: continue
 assert re.fullmatch('20260912[0-9]{6}_clean_pre_v3_[a-z0-9_]+[.]sql',p.name),p.name
 b=p.read_bytes();entry=next((x for x in m['pending_forward_migrations'] if x['file']==p.name),None)
 if entry is None:
  entry={'version':p.name[:14],'name':p.name[15:-4],'file':p.name,'classification':'PENDING_FORWARD_MIGRATION','live_applied':False,
   'predecessor_live_migration_count':previous['live_history_snapshot']['migration_count'],
   'predecessor_live_head':previous['live_history_snapshot']['last']['version'],
   'note':'Unapplied PRE-V3 candidate. Historical87 inventory metadata is preserved; actual observed production is108. Deployment gate required.'}
  m['pending_forward_migrations'].append(entry)
 assert entry['live_applied'] is False
 entry.update(raw_md5=hashlib.md5(b).hexdigest(),raw_sha256=hashlib.sha256(b).hexdigest(),raw_bytes=len(b))
m['pending_forward_migrations'].sort(key=lambda x:x['version'])
mp.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
manifest.write_text(''.join(hashlib.md5(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in sorted(mdir.glob('*.sql'))))
changed=git('diff','--name-only').splitlines();assert set(changed)<={str(mp),str(manifest)}
if changed:
 assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==expected,'INTEGRATION_HEAD_MOVED'
 git('config','user.name','USKOCI candidate verifier');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 subprocess.run(['git','add',*changed],check=True)
 subprocess.run(['git','commit','-m','chore(pre-v3): record unapplied candidate migration hashes'],check=True)
 subprocess.run(['git','push','origin','HEAD:refs/heads/'+BRANCH],check=True)
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
with open(os.environ['GITHUB_ENV'],'a') as f: f.write('PRE_V3_SOURCE_SHA='+head+'\n')
out=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';out.mkdir(exist_ok=True)
(out/'candidate-admission.json').write_text(json.dumps({'inputSource':expected,'sourceCommit':head,'sourceTree':tree,'metadataOnlyCommit':head!=expected,'branch':BRANCH,'liveChanged':False},indent=2)+'\n')
(out/'source-commit.txt').write_text(head+'\n');(out/'source-tree.txt').write_text(tree+'\n')
subprocess.run(['git','bundle','create',str(out/'candidate.bundle'),'HEAD','^'+BASE],check=True)
