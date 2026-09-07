"""Deterministic docs-only reconciliation; optional authorized GitHub tree publish.
Requires an immutable source checkout. Never reads or writes Supabase.
"""
import csv, hashlib, io, json, os, urllib.request
from pathlib import Path
BASE='940fd1fdf34a314f5d8a0c0fdb9cc3753e55ce01'
TREE='281876d3c232a4cc04b804b9104eef2caf48fe3e'
PROOF='65443681732fe6b290a8216d72d045a1c1b2f840'
REPO='Uskoci1/USKOCI-CLEAN'
BRANCH='proof/ru5-physical-continuity-20260907'
source=Path(os.environ.get('SOURCE_DIR','/mnt/data/ru5-source-review/proof'))
out=Path(os.environ.get('OUTPUT_DIR','/mnt/data/ru5-continuity-minimal'))
out.mkdir(parents=True,exist_ok=True)
evidence=json.loads(Path(os.environ.get('EVIDENCE_FILE','/mnt/data/ru5-evidence-34086225039/inspection-manifest.json')).read_text())
assert evidence['proof_sha']==PROOF and evidence['manual_visual_review']=='PASS'
assert len(evidence['records'])==13
record={
 'status':'PROVEN_CANONICAL','aggregate_ru5':'NOT_CLOSED_BOUNDED_NOTE_DECISION_REQUIRED',
 'canonical_sha':BASE,'proof_head':PROOF,'pr':37,'proof_run':34086225039,'proof_job':101630669388,
 'artifact_id':10005719123,'artifact_zip_sha256':evidence['zip_sha256'],
 'apk_sha256_recorded':evidence['apk_sha256_as_recorded_by_ci'],
 'required_states':13,'png_xml_review':'PASS','proof_log':'PASS','disposable_business_postflight':'PASS',
 'pr_pre_p4_run':34086227221,'pr_codeql_run':34086225561,'pr_security_check':101630762720,
 'canonical_pre_p4_run':34087979355,'canonical_codeql_run':34087978664,'canonical_control0_run':34087979396,
 'post_merge_gates':'SUCCESS','environment':'STANDALONE_ANDROID_API35_X86_64_PIXEL6_EMULATOR_LOCAL_SUPABASE',
 'live_migration_required':False,'live_writes':False,'fresh_live_preflight':'SAFETY_BLOCKED_NOT_FRESHLY_VERIFIED',
 'bounded_note_claimed':False,'Application_AI_activation':False,
 'closure_doc':'docs/implementation/RU5_PHYSICAL_ANDROID_PROOF_ACCEPTANCE_20260907.md'}
summary=f'''<!-- RU5_PHYSICAL_CANONICAL_20260907 -->
## CURRENT CHECKPOINT — 2026-09-07

This checkpoint supersedes older active-cursor claims below; all retained sections are historical provenance, not instructions to repeat closed RU/CDL/P0C/P0D units.

- Canonical merge `{BASE}` / PR #37 preserves proof lineage ending `{PROOF}`.
- Physical Android run `34086225039`, job `101630669388`: SUCCESS. All 13 original PNG/XML pairs reviewed; final PASS and disposable business postflight verified.
- PR PRE-P4 `34086227221`, CodeQL `34086225561` and actual security-result check `101630762720`: GREEN. Canonical PRE-P4 `34087979355`, CodeQL `34087978664`, Control-0 `34087979396`: GREEN.
- Physical happy-path unit: **PROVEN / CANONICAL**. Aggregate RU-5: **NOT CLOSED / bounded-note DECISION-REQUIRED**. Application AI stays gated.
- **Fresh live Supabase preflight was safety-blocked; no SQL executed and no alternative access attempted.** Prior `79 / 20260906141409_clean_ru5_fastest_autofill_retirement` is historical, not a current production observation. No live migration or activation occurred.
- Evidence: `docs/implementation/RU5_PHYSICAL_ANDROID_PROOF_ACCEPTANCE_20260907.md` and `RU5_PHYSICAL_ANDROID_EVIDENCE_20260907.json`.
- Next: retain the outstanding permitted live read as OWNER-ACTION, resolve bounded-note authority only from an approved owner source, and proceed with independent current-source gap reconstruction / Notifications-Inbox-Push proof units. No live promotion while its preflight is blocked. Do not rerun the accepted physical journey solely because an older section says pending.

'''
files={}
for path in ['AGENTS.md','HANDOFF.md','docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md','docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md']:
 old=(source/path).read_text();assert '<!-- RU5_PHYSICAL_CANONICAL_20260907 -->' not in old
 files[path]=summary+old
path='docs/implementation/LIVE_MIGRATION_STATE.json';j=json.loads((source/path).read_text());old=json.loads(json.dumps(j))
j['updated_at']='2026-09-07';j['canonical_physical_ui_proof_merge_head']=BASE
j['ru5']['physical_device_ui_proof']=record
j['production_observation']={'status':'OWNER_ACTION_SAFETY_BLOCKED_NOT_FRESHLY_VERIFIED','date':'2026-09-07','sql_executed':False,'live_writes':False,'note':'Existing live/edge/gated inventory fields are preserved prior observations, not a new production preflight. No alternate transport or promotion authorized.'}
j['status']['RU-5']='NOT_CLOSED_BOUNDED_NOTE_DECISION_REQUIRED';j['status']['RU-5_PHYSICAL_DEVICE_UI_PROOF']='PROVEN_CANONICAL_LIVE_PREFLIGHT_OWNER_ACTION';j['status']['LIVE_PREFLIGHT']='OWNER_ACTION_SAFETY_BLOCKED'
j['next_allowed_action']='Independent current-canonical product gap reconstruction and Notifications/Inbox/Push proof units; obtain permitted fresh production read before any promotion. RU-5 bounded-note owner decision unresolved; Application AI and forbidden features stay unactivated.'
assert j['live']==old['live'] and j['edge']==old['edge']
files[path]=json.dumps(j,ensure_ascii=False,indent=2)+'\n'
path='docs/implementation/IMPLEMENTATION_STATUS_LEDGER.csv';r=csv.DictReader(io.StringIO((source/path).read_text()));columns=r.fieldnames;rows=list(r);assert len(columns)==11
row=dict(zip(columns,['RU-5_PHYSICAL_ANDROID_DEVICE_UI_PROOF','PROVEN_CANONICAL_LIVE_PREFLIGHT_OWNER_ACTION',f'proof={PROOF};canonical={BASE}','NONE','Existing real Auth / Application / Selection / Agreement RPCs','W03 W04 W05 W06 R05 selected W06 actual Dogovor','run=34086225039;job=101630669388;artifact=10005719123;pr=37;canonical_pre_p4=34087979355;canonical_codeql=34087978664;canonical_control0=34087979396','DEVICE_PROVEN+13_PNG_XML_REVIEWED+DB_POSTFLIGHT+P0D03_ZERO_RSD','NO','Aggregate RU5 bounded-note DECISION_REQUIRED; permitted fresh live preflight safety-blocked','FRESH_ALLOWED_LIVE_READ_AND_INDEPENDENT_NOTIFICATIONS_GAP_CLOSURE']))
assert not any(x[columns[0]]==row[columns[0]] for x in rows)
for x in rows:
 if x[columns[0]]=='MASTER_READMISSION_RU5':
  x['blocker']='Bounded/preselection-note authority unresolved; physical proof canonical/proven; fresh live preflight safety-blocked'
  x['next_action']='INDEPENDENT_GAPS_AND_PERMITTED_FRESH_LIVE_PREFLIGHT'
buf=io.StringIO();w=csv.DictWriter(buf,fieldnames=columns,lineterminator='\n');w.writeheader();w.writerows(rows+[row]);files[path]=buf.getvalue()
public_evidence={k:v for k,v in evidence.items() if k!='records'}
public_evidence['records']=[{k:v for k,v in x.items() if k!='labels'} for x in evidence['records']]
public_evidence['canonical_acceptance']=record
files['docs/implementation/RU5_PHYSICAL_ANDROID_EVIDENCE_20260907.json']=json.dumps(public_evidence,ensure_ascii=False,indent=2)+'\n'
files['docs/implementation/RU5_PHYSICAL_ANDROID_PROOF_ACCEPTANCE_20260907.md']=summary+f'''## Immutable physical evidence

ZIP SHA-256 `{record['artifact_zip_sha256']}`. Recorded APK SHA-256 `{record['apk_sha256_recorded']}`; the evidence ZIP contains the APK digest, not the APK binary. The installed proof APK uses only `http://10.0.2.2:54321`, fake source disabled and proof-only Android package/cleartext configuration.

Worker authenticates through real UI, submits 3000 RSD / one slot, views the Application. Requester authenticates through real UI, selects that candidate, then Worker clean-authenticates, sees Izabrani ste and opens the actual bound Dogovor. Response `6e047376-7d4d-4d52-b1d3-dc40d301c61f`; Agreement `e73d3ead-5056-4857-bd8f-ed37c6de6e6f`. The postflight checks exact Need/Requester/Worker/selected-response binding and SELECTED status. P0D03 remains REQUESTER_SELECTION_V1/v1/REQUESTER/SELECTION/PROMOTIONAL_FREE/HEADCOUNT/0 RSD, units=1, SATISFIED. Application price is not a platform charge. Nine gated/retired disposable inventories remain zero.

`AGREEMENT_created` PNG is a post-selection home frame, not an Agreement screen. Creation is proven by its correlated DB assertion and the later actual `DOGOVOR_worker_opened` frame. All 13 pairs are visually and structurally reviewed. No Auth injection, business-RPC shortcut, hidden test control or production business data.

## Reviewed changes

Complete branch: 17 files; only two production source files change, existing entry and tab safe-area layouts. No migration, Edge, Auth implementation, business RPC or dependency changes. Commit `{PROOF}` removes credential-derived diagnostic metadata and pins Supabase setup to the exact prior proven Action revision. The original flagged logs contained a field flag and lengths, not a demonstrated production password value. Native input/readback semantics are unchanged. Both CodeQL findings were automatically resolved by GitHub Advanced Security; no dismissal/suppression.

Local repeat checks: 79 source migration integrity, 17 input harness tests, 19 local-target guard tests and Python compilation PASS. All 290 proof and 275 original canonical Git blobs verified; full patch applies cleanly. Source counts do not constitute fresh live DB counts.

## Remaining UI/canon and release gaps

Frozen CURRENT_PRODUCT_CANON and OWNER_IMPLEMENTATION_CLOSURE specify three primary destinations with secondary Inbox bell/avatar and W03 Lista/Mapa only. Existing production UI still has five baseline tabs, Combined mode and a map placeholder. This proof preserves/tests existing behavior, not final master navigation/terminology/design conformance. Reconcile that gap in a separate focused unit, not by silently rewriting canon.

This is an emulator happy-path proof, not hardware-phone testing, completed Inbox/Push, chat delivery/read semantics, Reviews/Trust, hard calendar conflict protection, account closure, OAuth/identity provider configuration, Application AI or Store readiness. Bounded-note input stayed empty; no missing note policy was invented. Aggregate RU-5 is NOT CLOSED.

D0140 production ALLOW, RU-4B public Q&A, HITNO, paid monetization/payments/subscriptions and Application AI were not activated; FASTEST/AUTO_FILL remain retired. Production flags were not freshly observed because the read was safety-blocked. No live write/deployment or bypass occurred.
'''
for path,text in files.items():
 p=out/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
# Preservation and format assertions before any remote mutation.
assert len(files)==8 and all(x.endswith(('.md','.json','.csv')) for x in files)
for path in ['AGENTS.md','HANDOFF.md','docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md','docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md']:
 assert files[path].endswith((source/path).read_text())
manifest={path:hashlib.sha1(b'blob '+str(len(text.encode())).encode()+b'\0'+text.encode()).hexdigest() for path,text in files.items()}
(out/'expected-blobs.json').write_text(json.dumps(manifest,indent=2)+'\n')
if os.environ.get('PUBLISH_DOCS')!='1':
 print('PASS local docs reconciliation',len(files),'files; old prose and historical live data preserved')
 raise SystemExit(0)
token=os.environ['GH_TOKEN']
def api(method,path,data=None):
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,method=method,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'})
 with urllib.request.urlopen(req,timeout=30) as resp:return json.load(resp)
assert api('GET','git/ref/heads/clean-alpha-backend')['object']['sha']==BASE,'canonical moved; do not publish'
assert api('GET','git/commits/'+BASE)['tree']['sha']==TREE
newtree=api('POST','git/trees',{'base_tree':TREE,'tree':[{'path':p,'mode':'100644','type':'blob','content':t} for p,t in files.items()]})['sha']
commit=api('POST','git/commits',{'message':'docs(ru5): reconcile canonical physical proof and preserve unresolved gates','tree':newtree,'parents':[BASE]})['sha']
# Create-only reference; never overwrite or force-update an existing work branch.
assert api('GET','git/ref/heads/clean-alpha-backend')['object']['sha']==BASE,'canonical moved during preparation'
api('POST','git/refs',{'ref':'refs/heads/'+BRANCH,'sha':commit})
result={'branch':BRANCH,'sha':commit,'base':BASE,'tree':newtree,'files':manifest,'source_only':True,'live_access':False}
(out/'publish-result.json').write_text(json.dumps(result,indent=2)+'\n')
print('PUBLISHED_DOCS_BRANCH',BRANCH,commit)
