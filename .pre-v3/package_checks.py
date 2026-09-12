import json,os,re,subprocess,sys,time
from pathlib import Path
out=Path(os.environ['RUNNER_TEMP'])/'pre-v3-evidence';out.mkdir(exist_ok=True)
config=json.loads(Path('../control/.pre-v3/run.json').read_text())
source=os.environ['PRE_V3_SOURCE_SHA']
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==source
mode=sys.argv[1]
if mode=='source':
 tests=sorted(str(p) for base in ('scripts','supabase') for p in Path(base).rglob('*') if p.is_file() and p.name.endswith(('.test.cjs','.test.mjs')))
 (out/'node-test-manifest.json').write_text(json.dumps(tests,indent=2)+'\n')
 commands=[('typescript',['npx','--no-install','tsc','--noEmit']),('jest',['npx','--no-install','jest','--runInBand','--silent','--json','--outputFile='+str(out/'jest-results.json')]),
  ('node_edge',['node','--test','--test-concurrency=2','--test-reporter=tap',*tests]),
  ('source_inventory',['node','scripts/pre_html_source_inventory.cjs',str(out/'source-inventory.json')]),
  ('migration_integrity',['python3','supabase/migrations/check_migration_integrity.py']),
  ('provenance',['python3','-m','json.tool','docs/implementation/pre-v3/C09_PROVENANCE_LEDGER.json']),
  ('diff_check',['git','diff','--check','06d51ecb1438a93a4ecce64692ff868474fca598','HEAD']),
  ('dependency_lock',['git','diff','--exit-code','06d51ecb1438a93a4ecce64692ff868474fca598','HEAD','--','package.json','package-lock.json']),
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
 receipt={'sourceCommit':source,'sourceTree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),'runId':os.environ['GITHUB_RUN_ID'],'gates':gates,'jest':jest,'node':node,'nodeFiles':len(tests),'result':'PASS' if passed else 'FAIL','liveChanged':False}
 (out/'source-baseline-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');sys.exit(0 if passed else 1)
elif mode=='extras':
 for item in config['proofs']:
  name=item['script'];assert re.fullmatch('[a-z_]+_proof[.]mjs',name)
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
