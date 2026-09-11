"""Fixed draft branch, immutable SQL history, metadata-only source preparation."""
import json,hashlib,subprocess,os,re
from pathlib import Path
BASE='1138d4f727735519b15d9b834bf261954e8013fe'
APP='72cdc8cc4bbf4d1876bb742ca40218e2426cf612'
BRANCH='work/pre-v3-engine-closure-20260911'
def git(*a):return subprocess.check_output(['git',*a],text=True).strip()
def digest(data,kind):return hashlib.new(kind,data).hexdigest()
expected=os.environ['SOURCE_SHA'];assert re.fullmatch('[a-f0-9]{40}',expected)
assert git('rev-parse','HEAD')==expected and git('merge-base',BASE,'HEAD')==BASE
assert not git('status','--porcelain')
for f in git('ls-tree','-r','--name-only',BASE,'supabase/migrations').splitlines():
 if f.endswith('.sql'):assert Path(f).read_bytes()==subprocess.check_output(['git','show',f'{BASE}:{f}']),f
subprocess.run(['git','diff','--exit-code',APP,'HEAD','--','src','package.json','package-lock.json','supabase/functions'],check=True)
mdir=Path('supabase/migrations');mp=mdir/'MIGRATION_PROVENANCE.json';m=json.loads(mp.read_text())
historical=json.loads(subprocess.check_output(['git','show',f'{BASE}:{mp}']))
assert m['live_history_snapshot']==historical['live_history_snapshot']
oldfiles={x['file'] for x in historical['pending_forward_migrations']}
assert [x for x in m['pending_forward_migrations'] if x['file'] in oldfiles]==historical['pending_forward_migrations']
known={x['file'] for x in m['pending_forward_migrations']}
for f in sorted(mdir.glob('20260911*.sql')):
 if f.name[:14]<'20260911174500':continue
 data=f.read_bytes();entry=next((x for x in m['pending_forward_migrations'] if x['file']==f.name),None)
 if entry is None:
  entry={'version':f.name[:14],'name':f.name[15:-4],'file':f.name,'classification':'PENDING_FORWARD_MIGRATION',
   'live_applied':False,'predecessor_live_migration_count':87,'predecessor_live_head':historical['live_history_snapshot']['last']['version'],
   'note':'Unapplied PRE-V3 candidate. Historical87 replay metadata is not the current live108 count. Exact predecessor/rollout admission required.'}
  m['pending_forward_migrations'].append(entry)
 else:
  assert not entry['live_applied'] and entry['raw_md5']==digest(data,'md5')
 entry.update(raw_md5=digest(data,'md5'),raw_sha256=digest(data,'sha256'),raw_bytes=len(data))
 entry.pop('sha256',None);entry.pop('bytes',None)
m['pending_forward_migrations'].sort(key=lambda x:x['version'])
mp.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
(mdir/'MD5_MANIFEST.txt').write_text(''.join(digest(f.read_bytes(),'md5')+'  '+f.name+'\n' for f in sorted(mdir.glob('*.sql'))))
changed=git('diff','--name-only').splitlines();assert set(changed)<= {str(mp),str(mdir/'MD5_MANIFEST.txt')}
if changed:
 git('config','user.name','USKOCI owner-authorized candidate runner');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 subprocess.run(['git','add',*changed],check=True)
 subprocess.run(['git','commit','-m','Record candidate-only migration inventory with canonical hash fields\n\nOld applied SQL and historical manifest entries remain byte-identical. No live migration.'],check=True)
 # A branch update preserves an already explicit metadata edit only. No merge,
 # force push, business endpoint or production secret exists in this workflow.
 remote=git('ls-remote','origin','refs/heads/'+BRANCH).split()[0];assert remote==expected,'DRAFT_BRANCH_MOVED'
 subprocess.run(['git','push','origin','HEAD:refs/heads/'+BRANCH],check=True)
head=git('rev-parse','HEAD')
with open(os.environ['GITHUB_ENV'],'a') as f:f.write('PRE_V3_SOURCE_SHA='+head+'\n')
p=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';p.mkdir(exist_ok=True)
p.joinpath('candidate.json').write_text(json.dumps({'sourceSha':head,'sourceTree':git('rev-parse','HEAD^{tree}'),'sourceTestsFrom':APP,
 'sourceTestRun':34632479450,'liveChanged':False,'deviceProven':False,'providerProven':False},indent=2)+'\n')
subprocess.run(['git','bundle','create',str(p/'candidate.bundle'),'HEAD','^'+BASE],check=True)
print('PRE_V3_SOURCE_SHA='+head)
