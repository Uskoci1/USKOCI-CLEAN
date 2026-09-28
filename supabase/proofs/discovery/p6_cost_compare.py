"""Round47: compare a guarded P6-only cost delta with its frozen original.
Both run on one disposable stack, under the same existing authorization.
"""
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
from urllib.parse import urlparse
from p6_cost_parse import internal_plans, summarize

PREFIX='supabase/proofs/discovery/'
ROOT=Path.cwd()
PRIVATE=Path('/tmp/p6-discovery-private')
PUBLIC=Path('/tmp/p6-discovery-evidence')
BASE='supabase/candidates/p6_discovery_all.sql'
DELTA='supabase/candidates/p6_discovery_cost_v2.sql'
ORIGINAL_PROOF=PREFIX+'p6_discovery_all_proof.sql'
FILES=[BASE,DELTA,ORIGINAL_PROOF,PREFIX+'p6_cost_compare.py',PREFIX+'p6_cost_compare.sql',
 PREFIX+'p6_cost_parse.py',PREFIX+'p6_needs_columns_observed.json',PREFIX+'p6_discovery_parity_vectors.mjs',
 '.github/workflows/p6-cost-optimization-proof.yml','package.json','package-lock.json']
GROUPS=['CURRENT_CLIENT_ORACLE_208_VECTORS','HELPERS_AND_INVOKER_ENVELOPE','1004_ROWS_TIES_MICROSECONDS_SCOPES_EXACT_ALLOWLIST',
 'ZERO_ONE_AND_STRICT_CURSOR_ANCHOR_REFUSALS','MAP_0_1_100_1000_3000_BOUNDED_COMPLETE_COVERAGE',
 'MAP_DENSE_SPARSE_WRAPPED_REMOTE_AND_STRICT_REQUEST','PLACES_EXACT_COUNTS_COMPLETE_TUPLE_PAGING_AND_SCOPE_BINDING',
 'AUTH_AND_ANON_REFUSALS','COVERAGE_WITH_RESTRICTED_COLUMNS','EXISTING_AUTHORITY_UNCHANGED',
 'ROLLBACK_NO_RPC_OR_FIXTURES_RETAINED','COST_HELPER_AND_FILTER_PARITY','COST_PAIRED_30_PER_MODE']
r={'unit':'P6_COST_OPTIMIZATION_PAIRED','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL','sourceHashes':{},
 'liveAccess':False,'serverApplied':False,'providerCalled':False,'native':False,'productionWired':False,'releaseReady':False}
stage='ADMISSION'

def sql(text,name,timeout=90):
    cp=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
        input=text,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    (PRIVATE/(name+'.stdout')).write_text(cp.stdout);(PRIVATE/(name+'.stderr')).write_text(cp.stderr)
    if cp.returncode:
        m=re.search(r'(?:ERROR|FATAL):\s+([A-Z0-9]{5}):',cp.stderr)
        if m:r['sqlState']=m[1]
        raise ValueError('P6_LOCAL_SQL_REFUSED')
    return cp.stdout.strip()

try:
    assert os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true'
    assert os.getenv('PRE_V3_ARTIFACT_DIR')==str(PRIVATE) and os.getenv('P6_PUBLIC_ARTIFACT_DIR')==str(PUBLIC)
    u=urlparse(os.environ['DB_URL']);assert u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres'
    assert os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL']
    subprocess.run(['node','--input-type=module','-e',"import {assertLocalDeviceProofTargets} from './supabase/proofs/ru5_device_ui_local_guard.mjs';assertLocalDeviceProofTargets(process.env.RU5_DEVICE_SUPABASE_URL,process.env.RU5_DEVICE_DB_URL)"],check=True)
    PRIVATE.mkdir(exist_ok=True);PUBLIC.mkdir(exist_ok=True)
    assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==r['sourceSha']
    for path in FILES:
        b=Path(path).read_bytes();assert b==subprocess.check_output(['git','show',r['sourceSha']+':'+path])
        r['sourceHashes'][path]=hashlib.sha256(b).hexdigest()
    assert r['sourceHashes'][BASE]=='1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e'
    assert r['sourceHashes'][ORIGINAL_PROOF]=='007098b59de47872c726fe50a8ec92e1fc6fb2fe2e31595d0eb112c8bc345c59'
    stage='HISTORICAL_BASELINE_AND_PRE_COLUMN_DIAGNOSTIC'
    for p in ['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql','supabase/candidates/pkg045a_task_read_contract.sql']:
        sql(Path(p).read_text(),Path(p).stem)
    observation=json.loads(Path(PREFIX+'p6_needs_columns_observed.json').read_text())
    columns=json.loads(sql("""select jsonb_build_object('searchPath',current_setting('search_path'),'columns',
      jsonb_object_agg(a.attname,jsonb_build_object('fingerprint',md5(jsonb_build_array(a.attname,t.typname,n.nspname,a.atttypmod,a.attnotnull,a.attacl::text,pg_get_expr(d.adbin,d.adrelid))::text),
      'number',a.attnum,'type',t.typname,'typeSchema',n.nspname,'typeMod',a.atttypmod,'notNull',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated)))
      from pg_attribute a join pg_type t on t.oid=a.atttypid join pg_namespace n on n.oid=t.typnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid='public.needs'::regclass and a.attnum>0 and not a.attisdropped;""",'column-detail'))
    differences=[{'column':k,'expected':observation['columnHashes'].get(k),'actual':columns['columns'].get(k)}
       for k in sorted(set(observation['columnHashes'])|set(columns['columns'])) if observation['columnHashes'].get(k)!=columns['columns'].get(k,{}).get('fingerprint')]
    r['columnComparison']={'observedAt':observation['observedAt'],'liveSearchPath':observation['searchPath'],
      'localSearchPath':columns['searchPath'],'expectedColumns':41,'actualColumns':len(columns['columns']),'differences':differences,'perColumnMatch':not differences}
    (PUBLIC/'p6-needs-column-detail.json').write_text(json.dumps(columns,indent=2)+'\n')
    sql(Path('supabase/candidates/pkg045b_task_column_privileges.sql').read_text(),'historical-pkg045b')
    stage='PAIRED_CANDIDATE_BINDING'
    original=Path(BASE).read_text()
    # Preserve original helper implementations too: no hybrid old RPC/new helper.
    before=original.replace('public.rpc_discovery_v1','public.p6b_rpc_discovery_v1').replace('public.p6_discovery_','public.p6b_discovery_').replace("'p6_discovery_%'","'p6b_discovery_%'")
    alias=PRIVATE/'p6-before.sql';alias.write_text(before)
    r['beforeAliasSha256']=hashlib.sha256(before.encode()).hexdigest()
    vectors=subprocess.check_output(['node',PREFIX+'p6_discovery_parity_vectors.mjs'],text=True,timeout=30)
    assert len(re.findall(r'^do \$p6_vector\$',vectors,re.M))==208
    vp=PRIVATE/'paired-vectors.sql';vp.write_text(vectors)
    proof=Path(ORIGINAL_PROOF).read_text();needle='\\ir ../../candidates/p6_discovery_all.sql'
    assert proof.count(needle)==1
    proof=proof.replace(needle,"\\i '"+str(alias)+"'\n\\i '"+str(ROOT/BASE)+"'\n\\i '"+str(ROOT/DELTA)+"'")
    anchor="select set_config('request.jwt.claim.sub','',true);";assert proof.count(anchor)==1
    proof=proof.replace(anchor,Path(PREFIX+'p6_cost_compare.sql').read_text()+'\n'+anchor)
    composed=PRIVATE/'paired.sql';composed.write_text(proof);r['composedProofSha256']=hashlib.sha256(proof.encode()).hexdigest()
    stage='PAIRED_SQL_FUNCTIONAL_AND_MEASURED'
    cmd=['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose',
      '-v','p6_disposable=SOURCE_ONLY_ROLLBACK','-v','p6_vectors_path='+str(vp),'-f',str(composed)]
    with (PRIVATE/'paired.stdout').open('w') as stdout,(PRIVATE/'paired.stderr').open('w') as stderr:
        done=subprocess.run(cmd,stdout=stdout,stderr=stderr,timeout=1200)
    stdout=(PRIVATE/'paired.stdout').read_text();stderr=(PRIVATE/'paired.stderr').read_text()
    r['checks']=[{'name':g,'result':'PASS' if 'PASS P6_'+g in stdout.splitlines() else 'NOT_PASSED'} for g in GROUPS]
    if done.returncode:
        m=re.search(r'(?:ERROR|FATAL):\s+([A-Z0-9]{5}):',stderr)
        if m:r['sqlState']=m[1]
        err=next((s for s in stderr.splitlines() if re.search(r'ERROR:\s+[A-Z0-9]{5}:',s)),None)
        if err:
            m=re.search(r'paired\.sql:(\d+):',err)
            if m:r['diagnosticLine']=int(m[1])
            m=re.search(r'(P6_[A-Z0-9_]+)',err)
            if m:r['diagnosticCode']=m[1]
        raise ValueError('P6_PAIRED_PROOF_REFUSED')
    assert all(x['result']=='PASS' for x in r['checks'])
    stage='EXACT_EVIDENCE'
    samples=json.loads(next(x[len('P6_COST_SAMPLES '):] for x in stdout.splitlines() if x.startswith('P6_COST_SAMPLES ')))
    assert len(samples)==240
    before_stats=summarize([x for x in samples if x['variant']=='BEFORE']);after_stats=summarize([x for x in samples if x['variant']=='AFTER'])
    plans=internal_plans(stderr)
    r['summary']=[{'mode':a['mode'],'before':b,'after':a,'p95Ratio':round(a['p95Ms']/b['p95Ms'],6)} for b,a in zip(before_stats,after_stats)]
    r['screeningBudgetPass']=all(x['screeningBudgetPass'] for x in after_stats)
    r['improvementProven']=all(x['p95Ratio']<.9 for x in r['summary'] if x['mode']!='EXACT_PUBLIC')
    r['measuredSamples']=240;r['normalizedPayloadParity']=True;r['internalPlans']=True
    env=json.loads(next(x[len('P6_COST_ENV '):] for x in stdout.splitlines() if x.startswith('P6_COST_ENV ')))
    r['measurementEnvironment']={**env,'os':platform.platform(),'cpuCount':os.cpu_count(),'runner':os.getenv('RUNNER_NAME'),
       'cache':'warm;5 warmups per variant per mode','quantileMethod':'nearest-rank','fullPayloadEquality':'all fields except asOf/counts.observedAt; shared valid anchors retained'}
    for name,data in [('p6-paired-samples.json',samples),('p6-optimized-plans.json',plans)]:
        value=json.dumps(data,indent=2)+'\n';(PUBLIC/name).write_text(value);r.setdefault('evidenceHashes',{})[name]=hashlib.sha256(value.encode()).hexdigest()
    r['result']='PASS'
except Exception as e:
    r['result']='FAIL';r['failure']={'stage':stage,'category':'PROOF_REFUSED'}
    if re.fullmatch('P6_[A-Z0-9_]+',str(e)):r['failure']['code']=str(e)
finally:
    PUBLIC.mkdir(exist_ok=True)
    r['limits']=['Historical PKG045b target; no canonical DEV or current-ledger acceptance','SQL-only single-connection timings, not HTTP/native or concurrent load',
      'Only skewed4004-total/3000-matched dataset; no 30000-scale acceptance','Two synthetic selection rows prove coverage math, not selection/Agreement E2E',
      'Round45 HTTP proof remains bound to original candidate; new candidate needs a refreshed real HTTP checkpoint']
    (PUBLIC/'p6-cost-compare-receipt.json').write_text(json.dumps(r,indent=2)+'\n')
    print(r['result']+' P6_COST_OPTIMIZATION_PAIRED')
    if r['result']!='PASS':sys.exit(1)
