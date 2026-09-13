import hashlib,json,os,re,subprocess,sys,time
from pathlib import Path
out=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';out.mkdir(exist_ok=True)
config=json.loads(Path('../control/.pre-v3/run.json').read_text())
source=os.environ['PRE_V3_SOURCE_SHA']
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==source
mode=sys.argv[1]
if mode=='source':
 # Optional source-only snapshot: tracked Git tree, never .git credentials or runtime secrets.
 # This export is evidence/input for offline work, never a test or deployment PASS.
 assert isinstance(config.get('exportSource',False),bool)
 if config.get('exportSource',False):
  archive=out/'exact-source.tar.gz'
  subprocess.run(['git','archive','--format=tar.gz','--output='+str(archive),'HEAD'],check=True)
  digest=hashlib.sha256(archive.read_bytes()).hexdigest()
  (out/'exact-source-snapshot.json').write_text(json.dumps({'sourceCommit':source,'sourceTree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),'archive':archive.name,'sha256':digest,'trackedOnly':True,'isTestVerdict':False},indent=2)+'\n')
 scope=config.get('regressionScope','FULL');assert scope in ('FULL','PACKAGE')
 focused=config.get('focusedJest',[])
 assert isinstance(focused,list) and (scope=='FULL' and not focused or scope=='PACKAGE' and focused)
 for p in focused: assert isinstance(p,str) and re.fullmatch(r'[a-zA-Z0-9_./-]+[.]test[.]tsx?',p) and '..' not in p and Path(p).is_file()
 tests=sorted(str(p) for base in ('scripts','supabase') for p in Path(base).rglob('*') if p.is_file() and p.name.endswith(('.test.cjs','.test.mjs')))
 (out/'node-test-manifest.json').write_text(json.dumps(tests,indent=2)+'\n')
 jest_command=['npx','--no-install','jest','--runInBand','--silent','--json','--outputFile='+str(out/'jest-results.json')]
 if focused: jest_command+=['--runTestsByPath',*focused]
 commands=[('typescript',['npx','--no-install','tsc','--noEmit']),('jest',jest_command),
  ('node_edge',['node','--test','--test-concurrency=2','--test-reporter=tap',*tests]),
  ('source_inventory',['node','scripts/pre_html_source_inventory.cjs',str(out/'source-inventory.json')]),
  ('migration_integrity',['sh','supabase/migrations/check_md5.sh']),
  ('provenance',['python3','-m','json.tool','docs/implementation/pre-v3/C09_PROVENANCE_LEDGER.json']),
  ('diff_check',['git','diff','--check','06d51ecb1438a93a4ecce64692ff868474fca598','HEAD']),
  ('dependency_contract_tests',['python3','../control/.pre-v3/validate-approved-dependencies.test.py']),
  ('dependency_lock',['python3','../control/.pre-v3/validate-approved-dependencies.py']),
  ('deno_media_runtime',['npx','--yes','deno@2.9.6','test','--no-lock','--node-modules-dir=none','--no-check','--allow-read','supabase/proofs/ai/v5_media_deno_runtime.test.ts']),
  ('tracked_source',['git','diff','--exit-code','HEAD'])]
 gates={}
 for name,cmd in commands:
  t=time.monotonic()
  with (out/(name+'.log')).open('w') as log:
   try: code=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=900).returncode
   except subprocess.TimeoutExpired: code=124
  gates[name]={'exitCode':code,'seconds':round(time.monotonic()-t,3)};print(name,gates[name],flush=True)
 j=json.loads((out/'jest-results.json').read_text()) if (out/'jest-results.json').exists() else {}
 jest={k:j.get(k) for k in ['success','numTotalTestSuites','numPassedTestSuites','numFailedTestSuites','numPendingTestSuites','numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTodoTests']}
 tap=(out/'node_edge.log').read_text();node={k:int(v) for k,v in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$',tap,re.M)}
 passed=all(x['exitCode']==0 for x in gates.values()) and jest.get('success') is True and all(jest.get(k)==0 for k in ['numFailedTestSuites','numPendingTestSuites','numFailedTests','numPendingTests','numTodoTests']) and node.get('tests',0)>0 and node.get('pass')==node.get('tests') and all(node.get(k)==0 for k in ['fail','cancelled','skipped','todo'])
 receipt={'sourceCommit':source,'sourceTree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),'runId':os.environ['GITHUB_RUN_ID'],'regressionScope':scope,'focusedJest':focused,'gates':gates,'jest':jest,'node':node,'nodeFiles':len(tests),'result':'PASS' if passed else 'FAIL','liveChanged':False}
 (out/'source-baseline-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');sys.exit(0 if passed else 1)
elif mode=='extras':
 for item in config['proofs']:
  name=item['script'];assert re.fullmatch('[a-z_]+_proof[.]mjs',name) or name in ('v5_review_acceptance_proof.mjs','v5_ai_test_budget_proof.mjs','v5_worker_profile_proof.mjs','v5_owner_safety_legal_proof.mjs','v5_owned_media_proof.mjs','v5_account_closure_execution_proof.mjs','v5_ai_turn_recovery_proof.mjs','v5_owned_qa_recovery_proof.mjs','v5_qa_limits_proof.mjs','v5_qa_classifier_proof.mjs','v5_owned_export_proof.mjs','v5_group_conversation_proof.mjs','v5_agreement_location_proof.mjs','v5_media_evidence_proof.mjs','v5_retention_compatibility_proof.mjs','v5_worker_turn_recovery_proof.mjs','v5_unknown_ai_turn_exit_proof.mjs','v5_support_case_proof.mjs','v5_agreement_photos_proof.mjs','v5_self_reported_identity_proof.mjs','v5_account_erasure_proof.mjs','v5_qa_owner_activation_proof.mjs')
  env=dict(os.environ,GITHUB_SHA=source,PRE_V3_ARTIFACT_DIR=str(out))
  with (out/(name+'.log')).open('w') as log:
   code=subprocess.run(['node','supabase/proofs/pre_v3/'+name],stdout=log,stderr=subprocess.STDOUT,env=env,timeout=600).returncode
  print(name,'PASS' if code==0 else 'FAIL',flush=True)
  if code: print((out/(name+'.log')).read_text()[-3000:]);sys.exit(code)
elif mode=='receipt':
 names=['worker-authority-report.json','inbox-visibility-report.json','agreement-core-report.json','need-lifecycle-report.json','agreement-client-report.json','requester-identity-report.json']+[i['report'] for i in config['proofs']]
 reports={name:json.loads((out/name).read_text()) if (out/name).exists() else {'result':'MISSING'} for name in names}
 passed=all(v.get('result')=='PASS' and v.get('sourceSha')==source for v in reports.values()) and reports[names[-1]].get('historyCount')==config['finalHistoryCount']
 source_report=json.loads((out/'source-baseline-receipt.json').read_text()) if (out/'source-baseline-receipt.json').exists() else {}
 passed=passed and source_report.get('result')=='PASS' and source_report.get('sourceCommit')==source
 receipt={'sourceCommit':source,'sourceTree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),'runId':os.environ['GITHUB_RUN_ID'],'reports':reports,'sourceRegression':source_report,'finalHistoryCount':reports[names[-1]].get('historyCount'),'result':'PASS' if passed else 'FAIL','liveChanged':False,'providerProven':False,'deviceProven':False}
 (out/'package-integration-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(receipt['result']);sys.exit(0 if passed else 1)
else: raise ValueError('UNKNOWN_MODE')
