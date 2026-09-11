"""SQL-only followup, exact carrier hashes, no production or canonical writes."""
import hashlib,json,os,subprocess
from pathlib import Path
CONTROL=Path(__file__).resolve().parents[1]
BASE='72cdc8cc4bbf4d1876bb742ca40218e2426cf612'
PR101='1138d4f727735519b15d9b834bf261954e8013fe'
def git(*args):return subprocess.check_output(['git',*args],encoding='utf8').strip()
def sha(data):return hashlib.sha256(data).hexdigest()
assert os.environ['GITHUB_REPOSITORY']=='Uskoci1/USKOCI-CLEAN'
assert git('rev-parse','HEAD')==BASE
assert not git('status','--porcelain')
git('config','user.name','USKOCI owner-authorized candidate runner');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
p=Path('supabase/proofs/pre_v3/worker_authority_proof.mjs')
assert sha(p.read_bytes())=='7524fbfcc3720b3bf60699d9c3f18719927cd7f7f63685047f363e1fba21361f'
s=p.read_text()
s=s.replace("assert.ok(r.error,'EXPECTED_DENIAL');","assert.ok(r.error,'EXPECTED_DENIAL:'+(code??'NO_CODE'));")
old=" await denied(A.client.from('worker_match_preferences').delete().eq('worker_profile_id',A.profile.id),'WORKER_PREFERENCES_REQUIRE_AUTHORITY');"
new=""" const noDelete=await A.client.from('worker_match_preferences').delete().eq('worker_profile_id',A.profile.id).select('worker_profile_id');
 assert.ok(noDelete.error || (Array.isArray(noDelete.data)&&noDelete.data.length===0),'DELETE_MUST_NOT_CHANGE_PREFS');
 assert.equal(Number(sql(`select count(*) from public.worker_match_preferences where worker_profile_id=${lit(A.profile.id)}::uuid`)),1);"""
assert s.count(old)==1;s=s.replace(old,new)
assert sha(s.encode())=='28542542dc78c159c5e385d8a46a9027f0c124c0339702c314a6911c303b2541'
p.write_text(s)
subprocess.run(['git','add',str(p)],check=True)
subprocess.run(['git','commit','-m','Test: accept zero affected rows as RLS denial only with preserved database record\n\nNo runtime SQL change or weakened no-write invariant. Old explicit-error assertion incorrectly excluded a valid RLS filter. Keep original failing run.'],check=True)
files={
 '.pre-v3/new/inbox.sql':('supabase/migrations/20260911183000_clean_pre_v3_inbox_delivery_visibility.sql','0f7470f6d95c79b0c6d93384f797dbf0397033e21c2316f649d8b31f59f3c3f4'),
 '.pre-v3/new/inbox-proof.mjs':('supabase/proofs/pre_v3/inbox_visibility_proof.mjs','c12ccc75db32286cda712f8ab208f27e33d9b9d75ea7e4adba38ebbd3e873241')}
for carrier,(target,expected) in files.items():
 data=(CONTROL/carrier).read_bytes();assert sha(data)==expected,carrier
 assert not Path(target).exists();Path(target).write_bytes(data)
mdir=Path('supabase/migrations');mp=mdir/'MIGRATION_PROVENANCE.json';m=json.loads(mp.read_text())
f=mdir/'20260911183000_clean_pre_v3_inbox_delivery_visibility.sql';data=f.read_bytes()
assert not any(row['version']==f.name[:14] for row in m['pending_forward_migrations'])
m['pending_forward_migrations'].append({'version':f.name[:14],'name':f.name[15:-4],'file':f.name,
 'classification':'PENDING_FORWARD_MIGRATION','raw_md5':hashlib.md5(data).hexdigest(),'sha256':sha(data),'bytes':len(data),
 'live_applied':False,'predecessor_live_migration_count':m['live_history_snapshot']['migration_count'],
 'predecessor_live_head':m['live_history_snapshot']['last']['version'],
 'note':'PRE-V3 delivery-aware Inbox candidate; historic87 replay metadata is not current live count. Independently body-bound to existing Inbox functions; no production activation yet.'})
mp.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
(mdir/'MD5_MANIFEST.txt').write_text(''.join(hashlib.md5(f.read_bytes()).hexdigest()+'  '+f.name+'\n' for f in sorted(mdir.glob('*.sql'))))
for file in git('ls-tree','-r','--name-only',BASE,'supabase/migrations').splitlines():
 if file.endswith('.sql'):assert Path(file).read_bytes()==subprocess.check_output(['git','show',f'{BASE}:{file}']),file
subprocess.run(['git','add',*[v[0] for v in files.values()],str(mp),str(mdir/'MD5_MANIFEST.txt')],check=True)
git('diff','--cached','--check')
subprocess.run(['git','commit','-m','P04: enforce IN_APP visibility consistently in Inbox pages, unread and read commands\n\nPreserve durable events and existing valid IN_APP deliveries during PUSH quiet hours; freeze clarification category. Actual disposable SQL verdict follows in run artifact.'],check=True)
subprocess.run(['git','diff','--exit-code',BASE,'HEAD','--','src','package.json','package-lock.json','supabase/functions'],check=True)
head=git('rev-parse','HEAD')
with open(os.environ['GITHUB_ENV'],'a') as out:out.write('PRE_V3_SOURCE_SHA='+head+'\n')
evidence=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';evidence.mkdir(exist_ok=True)
(evidence/'candidate.json').write_text(json.dumps({'sourceSha':head,'sourceTree':git('rev-parse','HEAD^{tree}'),'base':BASE,
 'pr101':PR101,'sourceTestsInheritedFrom':BASE,'identicalSourceScope':['src','package.json','package-lock.json','supabase/functions'],
 'proofs':{'workerSha256':sha(p.read_bytes()),'inboxSha256':files['.pre-v3/new/inbox-proof.mjs'][1]},
 'liveChanged':False,'deviceProven':False,'providerProven':False},indent=2)+'\n')
print('PRE_V3_SOURCE_SHA='+head)
