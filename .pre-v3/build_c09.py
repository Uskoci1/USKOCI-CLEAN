import subprocess,json,hashlib,re,pathlib
R=pathlib.Path.cwd()
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
def txt(*a):return git(*a).decode().strip()
CAN='916ffb498ba5ad47a307a3c66477757b6753095a';PR99='58e842e883db71f9118efc474c5011f3b261824c';PR100='df167547c469f5b4cb5679058526b697dae8ba48';PR101='1138d4f727735519b15d9b834bf261954e8013fe';ENG='94bda947c68b981972c53d4372a7e4bc8549b542';REPAIR='e5579800a066247a2e235883371be98bda5ed3d9';M05='60a3ce68e52cbf461639f392db877d93ba0405c7';INT='7226148406fa56a72f71164e7ff67f32674645f2';HEAD=txt('rev-parse','HEAD')
assert HEAD=='9426e46e40909189bf65ccd18d7d109a78782797'
lines=[('feat/v2-native-journey-closure-20260911',99,CAN,PR99),('feat/owner-completion-20260911',100,PR99,PR100),('work/pre-html-stabilization-20260911',101,PR100,PR101),('work/pre-v3-engine-closure-20260911',None,PR101,ENG),('work/pre-v3-proof-repair-20260911',None,PR101,REPAIR),('feat/v2-agreement-changes-20260911',None,txt('merge-base',M05,HEAD),M05),('work/pre-v3-engine-integration-20260911',None,ENG,HEAD)]
source_m05='supabase/migrations/20260911035330_clean_m05_agreement_change_authority.sql';dest_m05='supabase/migrations/20260911190000_clean_pre_v3_m05_admitted_source.sql'
assert git('show',M05+':'+source_m05)==git('show',HEAD+':'+dest_m05)
rows=[];merges=[]
def blob(ref,path):
 p=subprocess.run(['git','rev-parse','--verify',ref+':'+path],cwd=R,capture_output=True,text=True);return p.stdout.strip() if p.returncode==0 else None
def kind(p):
 if p.endswith('.sql') and p.startswith('supabase/migrations/'):return 'MIGRATION'
 if p.endswith(('MD5_MANIFEST.txt','MIGRATION_PROVENANCE.json')):return 'GENERATED_INVENTORY'
 if '__tests__/' in p or p.endswith(('.test.ts','.test.tsx','.test.mjs','.test.cjs')):return 'TEST'
 if p.startswith(('supabase/proofs/','scripts/','.github/')):return 'PROOF'
 if p.startswith('docs/') or p in ('AGENTS.md','HANDOFF.md','.gitattributes'):return 'DOCUMENTATION'
 if p.startswith('assets/'):return 'PRESENTATION_ASSET'
 return 'RUNTIME'
def package(p):
 s=p.lower()
 for terms,group in [(('workerprofile','workercapacity','worker_capacity','worker_single','worker_authority'),'P1/P2'),(('inbox','delivery_visibility'),'P4'),(('agreement','dogovor','m05','m06'),'P5'),(('needlifecycle','need_lifecycle','ai-owned-intake','intakepresentation','nova.tsx'),'P6'),(('auth','session','sesija','uloga','intentpreference','focused','profile'),'P7'),(('push','notifications'),'P11'),(('location','map'),'P1/P12'),(('legacy','retired','prijave.tsx'),'P3/P13'),(('entry','brandscene'),'PRESERVED_ENTRY'),(('myapplications','moje-prijave'),'PRESERVED_APPLICATIONS')]:
  if any(t in s for t in terms):return group
 return 'C09/P0'
for branch,pr,base,head in lines:
 for sha in txt('rev-list','--reverse','--topo-order',base+'..'+head).splitlines():
  parents=txt('show','-s','--format=%P',sha).split()
  if len(parents)!=1:
   merges.append(dict(sourceBranch=branch,sourcePr=pr,commit=sha,parents=parents,classification='DOCS-PROOF-ONLY',reason='Historical lineage edge only; runtime/file hunks are indexed from their non-merge source commits. No merge authorized by this ledger.'));continue
  for line in txt('diff','--name-status',parents[0],sha).splitlines():
   status,path=line.split('\t',1)
   if '\t' in path:path=path.split('\t')[-1]
   destination=dest_m05 if branch==lines[5][0] and path==source_m05 else path
   source_blob=blob(sha,path);target_blob=blob(HEAD,destination)
   patch=git('diff','--no-ext-diff','--binary','--unified=3',parents[0],sha,'--',path)
   typ=kind(path);cl='DOCS-PROOF-ONLY' if typ in ('TEST','PROOF','DOCUMENTATION','GENERATED_INVENTORY') else 'ACCEPT'
   missing=[];superseded=None;integrated=INT
   reason='Preserve the owner-accepted existing slice; no new presentation or domain rewrite. Current source baseline is separate from provider/native evidence.'
   if typ in ('TEST','PROOF','DOCUMENTATION','GENERATED_INVENTORY'):
    reason='Retained source/evidence only. A test, inventory, archived decision or historical result does not declare current live/provider/device readiness.'
   if target_blob!=source_blob:
    later=txt('log','-1','--format=%H',HEAD,'--',destination) if target_blob else None
    superseded=later
    if typ in ('RUNTIME','MIGRATION','PRESENTATION_ASSET'):
     cl='FIX';reason='Retained source lineage with later per-file corrections; the original blob is not byte-identical to this target. Follow the indexed later hunk chain rather than counting this whole file as an unchanged admission.'
   if source_blob is None and target_blob is None:
    cl='ACCEPT';reason='Retired source remains absent in the candidate. Retirement preserved, not an active runtime capability.'
   if 'ResolvedPinMap' in path or 'resolved-location-pin' in path:
    if typ in ('RUNTIME','PRESENTATION_ASSET'):cl='FIX'
    missing.append('Physical pin drag/user-confirmed save not proven by current source tests; no redesign authorized.')
   if path.startswith('docs/'):
    missing.append('Historical assertions are not refreshed production truth; current owner continuation overrides older SAFE STOP and conflicting proposals.')
   if branch==lines[5][0]:
    integrated=None
    if path==source_m05:
     cl='ACCEPT';reason='Exact byte-identical M05/SQL109 body selectively admitted under ordered candidate filename; execution guards remain a separate following migration.';integrated=INT;superseded=None
    elif path.startswith('src/app/'):
     cl='REJECT';reason='Not admitted into PRE-V3 presentation. Preserve saved M05/M06 screen source for future V3 functional mapping, not current visual adoption.';missing=['V3 HTML and future seam admission; later is not removed.']
    elif path=='src/data/agreementClientService.ts':
     cl='FIX';reason='Saved change/cancellation adapter requires selective integration preserving PR101 safe errors and new server capability truth; no whole-file overwrite.';missing=['P5 service/capability admission on integration line.']
    elif 'source_boundary' in path or 'owned-intake' in path:
     cl='SUPERSEDED';reason='Do not replace frozen108 planners with saved-branch109 admission changes. Current integration has explicit historical fixtures and separate ordered candidate SQL proof.';superseded='9426e46e40909189bf65ccd18d7d109a78782797';missing=[]
    else:
     cl='DOCS-PROOF-ONLY';reason='Saved-only supporting source, not a current passing proof or applied migration inventory.';missing=['Only admit independently justified supporting hunks; no blanket saved-branch merge.']
   if branch==lines[4][0]:
    reason='Seven-file proof repair selectively admitted with exact blobs at72261484; engine parent paths were unchanged from PR101. Later capacity-loader/frozen108 repairs are separately indexed.'
   if branch==lines[6][0]:
    integrated=sha
    if sha==INT:
     reason='Exact admission of repair e5579800 onto engine94. References repair-origin rows, not a second independently invented implementation.'
   tests=['Source baseline9426e46: TypeScript PASS; Jest136 suites/2790 PASS,0 skipped/todo; Node/syntheticEdge483 PASS,0 skipped/todo; lock/inventory/migration integrity PASS. Applies to source target, not historical SHA.']
   if branch==lines[5][0] and path!=source_m05:tests=['Saved source only; current source baseline does not cover unadmitted saved hunks.']
   row={'SOURCE_BRANCH':branch,'SOURCE_PR':pr,'SOURCE_COMMIT':sha,'SOURCE_FILE/HUNK':{'path':path,'status':status,'sourceBlob':source_blob,'hunks':re.findall(r'^@@.*@@.*$',patch.decode(errors='replace'),re.M),'diffSha256':hashlib.sha256(patch).hexdigest()},'DESTINATION_FILE':destination,'CLASSIFICATION':cl,'REASON':reason,'TESTS':tests,'SUPERSEDED_BY':superseded,'DESTINATION_PACKAGE':package(destination),'INTEGRATED_COMMIT':integrated,'STILL_MISSING':missing,'KIND':typ,'TARGET_BLOB':target_blob,'TARGET_BYTE_IDENTICAL':source_blob==target_blob}
   rows.append(row)
for number in (99,100,101):
 rows.append({'SOURCE_BRANCH':lines[number-99][0],'SOURCE_PR':number,'SOURCE_COMMIT':lines[number-99][3],'SOURCE_FILE/HUNK':{'path':None,'hunks':['whole-branch merge proposal']},'DESTINATION_FILE':None,'CLASSIFICATION':'REJECT','REASON':'Owner explicitly forbids broad merge into canonical; only tracked slices are preserved in the integration candidate.','TESTS':['Canonical ref refreshed unchanged; no canonical write.'],'SUPERSEDED_BY':'Itemized source/file rows','DESTINATION_PACKAGE':'NONE','INTEGRATED_COMMIT':None,'STILL_MISSING':[],'KIND':'DECISION'})
required={
'PR99_ENTRY':['useEntryIntro','useEntrySplashReady','BrandScene','EntryWelcome'],
'PR99_LOCATION_PIN':['ResolvedPinMap','resolved-location-pin'],
'PR99_STALE_APPLICATION_INTERVAL':['myApplicationsClientService'],
'PR99_MY_APPLICATIONS':['moje-prijave','MyApplicationsPresentation'],
'PR99_AGREEMENT_LIST':['dogovori.tsx','AgreementCollection'],
'PR99_PROOF_HARNESS':['android_journey','harness'],
'PR100_SIGNUP_FULL_NAME':['authClientService'],
'PR100_FOCUS_BACKGROUND':['focusedResource','useFocusedResource'],
'PR100_AUTHORITY_DOCS':['docs/authority/','AGENTS.md'],
'PR101_ACCOUNT_INTENT':['accountIntentPreference','sesija.ts','uloga.ts'],
'PR101_SECOND_TASK':['nova.tsx','IntakePresentation'],
'PR101_SAFE_ERRORS':['legacyRpcFailure','agreementClientService'],
'PR101_AI_HTTP':['aiNeedV2Production'],
'PR101_CLIENT_LEGACY_REFUSAL':['aiProductionOverrides','agreementClientService'],
'PR101_ROUTE_RETIREMENT':['src/app/prijave.tsx'],
'PR101_PUSH_FOREGROUND':['PushRuntime','uskoci-push-transport'],
'PR101_SOURCE_INVENTORY':['pre_html_source_inventory'],
'PR101_DONOR_REMOVALS':['brandSvg','figmaSplashTracks'],
'ENGINE_CAPACITY_LOCATION_AVAILABILITY':['worker_capacity.sql','worker_single_authority.sql','worker_authority_proof'],
'ENGINE_INBOX':['inbox_delivery_visibility','inbox_visibility_proof'],
'ENGINE_M05_GUARDS':['m05_admitted_source','agreement_execution_guards','agreement_core_proof'],
'REPAIR_HISTORICAL_FIXTURES':['historical_predecessor_fixture','historical_source108_fixture'],
'REPAIR_SOURCE_LOADERS':['task_detail_read_preflight','w02_calendar_integrity_proof'],
'SAVED_M05_M06':['dogovor/izmene','agreement-cancellation-screen','clean_m05_agreement_change_authority.sql']}
coverage={key:[i+1 for i,row in enumerate(rows) if any(term in (row['SOURCE_FILE/HUNK']['path'] or '') for term in terms)] for key,terms in required.items()}
assert all(coverage.values()),[k for k,v in coverage.items() if not v]
for i,row in enumerate(rows,1):row['ROW_ID']=f'C09-{i:04d}'
data={'schemaVersion':2,'scope':'Current source provenance, not authorization for broad merge, deployment or provider use.','sourceTarget':{'branch':lines[-1][0],'commit':HEAD,'tree':txt('rev-parse',HEAD+'^{tree}')},'supersedes':'C09_PROVENANCE_LEDGER_20260911.json as current ledger; preserve that earlier file as historical evidence.','historicalEvidenceCorrection':'Original exactPR101 fullJest pass did not imply fullNode pass. New original baseline found473 PASS/4 FAIL; separate repair479 PASS. Initial integrated722 had456/479 Node PASS;9426 has483/483 PASS. None is SQL/provider/native proof.','scopeTypes':['RUNTIME','MIGRATION','TEST','PROOF','DOCUMENTATION','GENERATED_INVENTORY','PRESENTATION_ASSET'],'classificationMeaning':'ACCEPT means keep the identified slice. FIX means preserve admitted origin but follow later corrections or finish a saved-only admission; it never means an entire branch was approved. DOCS-PROOF-ONLY does not claim runtime completion.','migrationLiveStatus':'Read2026-09-11T21:09:22Z:108; PRE-V3 candidates not applied by this continuation. File presence is not live authority.','m05ByteIdentity':{'sourceCommit':M05,'sourceFile':source_m05,'targetFile':dest_m05,'sha256':hashlib.sha256(git('show',HEAD+':'+dest_m05)).hexdigest(),'identical':True},'sourceLines':[dict(branch=b,pr=p,base=x,head=h) for b,p,x,h in lines],'requiredSliceCoverage':coverage,'historicalMergeEdges':merges,'rows':rows}
path=R/'docs/implementation/pre-v3/C09_PROVENANCE_LEDGER.json';path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('rows',len(rows),'coverage groups',len(coverage),'bytes',path.stat().st_size)
