"""Round46: scoped DEV catalog comparison plus exact-source disposable SQL timings.
No live connection, no provider, no production wiring. Historical replay only.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import platform
from urllib.parse import urlparse
from p6_cost_parse import internal_plans, summarize

ROOT=Path.cwd()
PREFIX='supabase/proofs/discovery/'
PRIVATE=Path('/tmp/p6-discovery-private')
PUBLIC=Path('/tmp/p6-discovery-evidence')
CANDIDATE='supabase/candidates/p6_discovery_all.sql'
PROOF=PREFIX+'p6_discovery_all_proof.sql'
FILES=[CANDIDATE,PROOF,PREFIX+'p6_current_cost.py',PREFIX+'p6_cost_probe.sql',PREFIX+'p6_cost_parse.py',
 PREFIX+'test_p6_cost_parse.py',PREFIX+'p6_dependency_snapshot.sql',PREFIX+'p6_live_dependency_observation.json',
 PREFIX+'p6_discovery_parity_vectors.mjs','supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql',
 'supabase/candidates/pkg045a_task_read_contract.sql','supabase/candidates/pkg045b_task_column_privileges.sql',
 '.github/workflows/p6-current-cost-proof.yml','package.json','package-lock.json']
EXPECTED=['CURRENT_CLIENT_ORACLE_208_VECTORS','HELPERS_AND_INVOKER_ENVELOPE','1004_ROWS_TIES_MICROSECONDS_SCOPES_EXACT_ALLOWLIST',
 'ZERO_ONE_AND_STRICT_CURSOR_ANCHOR_REFUSALS','MAP_0_1_100_1000_3000_BOUNDED_COMPLETE_COVERAGE',
 'MAP_DENSE_SPARSE_WRAPPED_REMOTE_AND_STRICT_REQUEST','PLACES_EXACT_COUNTS_COMPLETE_TUPLE_PAGING_AND_SCOPE_BINDING',
 'AUTH_AND_ANON_REFUSALS','COVERAGE_WITH_RESTRICTED_COLUMNS','EXISTING_AUTHORITY_UNCHANGED','ROLLBACK_NO_RPC_OR_FIXTURES_RETAINED']
report={'unit':'P6_CURRENT_DEPENDENCY_AND_COST','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL',
 'liveAccess':False,'serverApplied':False,'providerCalled':False,'deviceProven':False,'productionWired':False,
 'releaseReady':False,'historicalCertificateReplay':True,'sourceHashes':{},'checks':[]}
stage='LOCAL_ADMISSION'

def sql(text, name, timeout=90):
    cmd=['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
    ran=subprocess.run(cmd,input=text,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    (PRIVATE/(name+'.stdout')).write_text(ran.stdout);(PRIVATE/(name+'.stderr')).write_text(ran.stderr)
    if ran.returncode:
        m=re.search(r'(?:ERROR|FATAL):\s+([A-Z0-9]{5}):',ran.stderr)
        if m: report['sqlState']=m[1]
        raise ValueError('P6_LOCAL_SQL_REFUSED')
    return ran.stdout.strip()

def fingerprints(snapshot, observation):
    diffs=[]
    for sig,h in observation['functions'].items():
        got=snapshot['functions'].get(sig,{}).get('bodyMd5')
        if got!=h: diffs.append({'object':sig,'field':'bodyMd5','expected':h,'actual':got})
    for rel,hashes in observation['relations'].items():
        for field,h in zip(observation['relationHashOrder'],hashes):
            got=snapshot['relations'].get(rel,{}).get(field)
            if got!=h: diffs.append({'object':rel,'field':field,'expected':h,'actual':got})
    return diffs

try:
    assert os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true'
    assert os.getenv('PRE_V3_ARTIFACT_DIR')==str(PRIVATE) and os.getenv('P6_PUBLIC_ARTIFACT_DIR')==str(PUBLIC)
    u=urlparse(os.environ['DB_URL'])
    assert u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres'
    assert os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL']
    subprocess.run(['node','--input-type=module','-e',"import {assertLocalDeviceProofTargets} from './supabase/proofs/ru5_device_ui_local_guard.mjs';assertLocalDeviceProofTargets(process.env.RU5_DEVICE_SUPABASE_URL,process.env.RU5_DEVICE_DB_URL)"],check=True)
    PRIVATE.mkdir(exist_ok=True);PUBLIC.mkdir(exist_ok=True)
    stage='SOURCE_BINDING'
    assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==report['sourceSha']
    for path in FILES:
        b=Path(path).read_bytes();assert b==subprocess.check_output(['git','show',report['sourceSha']+':'+path])
        report['sourceHashes'][path]=hashlib.sha256(b).hexdigest()
    assert report['sourceHashes'][CANDIDATE]=='1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e'
    assert report['sourceHashes'][PROOF]=='007098b59de47872c726fe50a8ec92e1fc6fb2fe2e31595d0eb112c8bc345c59'
    stage='PRE_COLUMN_BOUNDARY_REPLAY'
    for path in FILES[9:11]:
        sql(Path(path).read_text(),Path(path).stem)
    observation=json.loads(Path(PREFIX+'p6_live_dependency_observation.json').read_text())
    before=json.loads(sql(Path(PREFIX+'p6_dependency_snapshot.sql').read_text(),'pre-column-catalog'))
    differences=fingerprints(before,observation)
    report['dependencyComparison']={'observedAt':observation['observedAt'],'functions':11,'relations':7,
      'dimensions':['normalized function bodies','column definitions and column grants','policy definitions and permissiveness','indexes'],
      'matches':not differences,'differences':differences,
      'scope':'P6 read-dependency metadata only, not complete current ledger/certificate/runtime parity'}
    report['liveColumnBoundary']={k:observation[k] for k in ['observedAt','ledgerCount','pkg045bApplied','authenticatedWholeRow','authenticatedRequesterAccountId','authenticatedCloseReason']}
    (PUBLIC/'p6-pre-column-catalog.json').write_text(json.dumps(before,indent=2)+'\n')
    stage='HISTORICAL_TARGET_COLUMN_BOUNDARY'
    sql(Path('supabase/candidates/pkg045b_task_column_privileges.sql').read_text(),'historical-pkg045b')
    after=json.loads(sql(Path(PREFIX+'p6_dependency_snapshot.sql').read_text(),'post-column-catalog'))
    (PUBLIC/'p6-post-column-catalog.json').write_text(json.dumps(after,indent=2)+'\n')
    report['historicalColumnBoundaryChangedObjects']=[k for k in before['relations'] if before['relations'][k]!=after['relations'][k]]
    stage='CLIENT_ORACLE'
    vectors=subprocess.check_output(['node',PREFIX+'p6_discovery_parity_vectors.mjs'],text=True,timeout=30)
    assert len(re.findall(r'^do \$p6_vector\$',vectors,re.M))==208
    vp=PRIVATE/'cost-vectors.sql';vp.write_text(vectors)
    stage='COMPOSE_UNCHANGED_PROOF_AND_COST'
    text=Path(PROOF).read_text();anchor="select set_config('request.jwt.claim.sub','',true);"
    assert text.count(anchor)==1 and text.count('\\ir ../../candidates/p6_discovery_all.sql')==1
    text=text.replace('\\ir ../../candidates/p6_discovery_all.sql',"\\i '"+str(ROOT/CANDIDATE)+"'")
    text=text.replace(anchor,Path(PREFIX+'p6_cost_probe.sql').read_text()+'\n'+anchor)
    composed=PRIVATE/'p6-cost-composed.sql';composed.write_text(text)
    report['composedProofSha256']=hashlib.sha256(text.encode()).hexdigest()
    stage='EXACT_SQL_AND_MEASUREMENTS'
    cmd=['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose',
       '-v','p6_disposable=SOURCE_ONLY_ROLLBACK','-v','p6_vectors_path='+str(vp),'-f',str(composed)]
    with (PRIVATE/'cost.stdout').open('w') as out,(PRIVATE/'cost.stderr').open('w') as err:
        ran=subprocess.run(cmd,stdout=out,stderr=err,timeout=1200)
    stdout=(PRIVATE/'cost.stdout').read_text();stderr=(PRIVATE/'cost.stderr').read_text()
    report['checks']=[{'name':name,'result':'PASS' if 'PASS P6_'+name in stdout.splitlines() else 'NOT_PASSED'} for name in EXPECTED]
    if ran.returncode:
        m=re.search(r'(?:ERROR|FATAL):\s+([A-Z0-9]{5}):',stderr)
        if m: report['sqlState']=m[1]
        raise ValueError('P6_COMPOSED_PROOF_REFUSED')
    assert all(x['result']=='PASS' for x in report['checks'])
    stage='PUBLIC_SAFE_MEASUREMENT_PROJECTION'
    environment=json.loads(next(x[len('P6_COST_ENV '):] for x in stdout.splitlines() if x.startswith('P6_COST_ENV ')))
    samples=json.loads(next(x[len('P6_COST_SAMPLES '):] for x in stdout.splitlines() if x.startswith('P6_COST_SAMPLES ')))
    stats=summarize(samples);plans=internal_plans(stderr)
    report.update(result='PASS',sqlGroups=11,measuredSamples=120,summary=stats,queryPlansCaptured=True,
      measurementEnvironment={**environment,'os':platform.platform(),'cpuCount':os.cpu_count(),
          'runner':os.getenv('RUNNER_NAME'),'runnerArch':os.getenv('RUNNER_ARCH'),'python':platform.python_version(),
          'quantileMethod':'nearest-rank','cache':'warm shared buffers; five warmups per case; no cold-cache claim',
          'instrumentation':'timings before auto_explain; plans after timings, TIMING OFF, ANALYZE+BUFFERS'},
      screeningBudgetPass=all(x['screeningBudgetPass'] for x in stats))
    for name,value in [('p6-cost-samples.json',samples),('p6-internal-plans.json',plans)]:
        content=json.dumps(value,indent=2)+'\n';(PUBLIC/name).write_text(content)
        report.setdefault('evidenceHashes',{})[name]=hashlib.sha256(content.encode()).hexdigest()
    report['checks'].extend([{'name':'30_SAMPLES_EACH_OF_FOUR_MODES','result':'PASS'},
      {'name':'INTERNAL_MAIN_QUERY_ANALYZE_BUFFERS_THREE_MODES','result':'PASS'}])
except Exception as exc:
    report['failure']={'stage':stage,'category':'PROOF_REFUSED'}
    if re.fullmatch(r'P6_[A-Z0-9_]+',str(exc)):report['failure']['code']=str(exc)
finally:
    PUBLIC.mkdir(exist_ok=True)
    report['limits']=['Historical target PKG045b is not applied on canonical DEV',
      'Metadata match is scoped; no complete latest-ledger/certificate/older-client acceptance',
      'Single-connection SQL timing excludes HTTP, network, authentication startup and native UI',
      'One skewed fixture distribution; not concurrent production load or 30000-scale proof',
      '1000ms is a necessary SQL screening ceiling from the API budget, not sufficient end-to-end performance acceptance']
    (PUBLIC/'p6-current-cost-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
    print(report['result']+' P6_CURRENT_DEPENDENCY_AND_COST')
    if report['result']!='PASS':sys.exit(1)
