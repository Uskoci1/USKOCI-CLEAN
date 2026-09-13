"""Read-only exact-source inventory validation. No repository mutation or push."""
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
 assert re.fullmatch('20260912[0-9]{6}_clean_pre_v3_[a-z0-9_]+[.]sql',p.name) or p.name in ('20260912213702_clean_v5_review_acceptance.sql','20260912214126_clean_v5_bounded_ai_test_budget.sql','20260912220506_clean_v5_owned_worker_profile.sql','20260912222338_clean_v5_owner_safety_legal_reads.sql','20260912224647_clean_v5_owned_media.sql','20260912230039_clean_v5_policy_bound_closure.sql','20260912233901_clean_v5_ai_turn_restart_recovery.sql','20260912234201_clean_v5_owned_qa_recovery.sql','20260913000109_clean_v5_approved_qa_limits.sql','20260913000144_clean_v5_qa_classifier_authority.sql','20260913001000_clean_v5_owned_export_projection.sql','20260913002405_clean_v5_group_conversation.sql','20260913002428_clean_v5_agreement_location_snapshot.sql','20260913005720_clean_v5_media_evidence_protection.sql','20260913014627_clean_v5_retention_source_compatibility.sql'),p.name
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
assert mp.read_bytes()==(json.dumps(m,indent=2,ensure_ascii=False)+'\n').encode(), 'CANDIDATE_PROVENANCE_BYTES_MISMATCH'
assert manifest.read_bytes()==''.join(hashlib.md5(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in sorted(mdir.glob('*.sql'))).encode(), 'CANDIDATE_MD5_MANIFEST_MISMATCH'
assert not git('status','--porcelain'), 'EXACT_SOURCE_CHANGED'
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
with open(os.environ['GITHUB_ENV'],'a') as f: f.write('PRE_V3_SOURCE_SHA='+head+'\n')
out=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';out.mkdir(exist_ok=True)
(out/'candidate-admission.json').write_text(json.dumps({'inputSource':expected,'sourceCommit':head,'sourceTree':tree,'metadataOnlyCommit':head!=expected,'branch':BRANCH,'liveChanged':False},indent=2)+'\n')
(out/'source-commit.txt').write_text(head+'\n');(out/'source-tree.txt').write_text(tree+'\n')
subprocess.run(['git','bundle','create',str(out/'candidate.bundle'),'HEAD','^'+BASE],check=True)
