from __future__ import annotations
import json, os, platform, re, subprocess, time, hashlib
from pathlib import Path
from urllib.parse import urlparse

BASE=Path('supabase/proofs/discovery/p6_load_30k.sql')
ROLLOUT=Path('supabase/candidates/p6_discovery_rollout.sql')
OWN=Path('supabase/proofs/discovery/p6_load_30k_diag.py')
WORKFLOW=Path('.github/workflows/p6-round59-diagnostic.yml')
PUBLIC=Path('/tmp/p6-diag-evidence')
PRIVATE=Path('/tmp/p6-diag-private')
EXPECTED_ROLLOUT_SHA='ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c'
CASES=('PAGE_ALL','PAGE_PEOPLE2','MAP_DENSE','MAP_SPARSE','PLACES_SPARSE','EXACT_PUBLIC','SCAN','COVERAGE_SCAN')

def require(v,code):
    if not v: raise ValueError(code)

def sha(path:Path)->str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def diagnostic_sql()->str:
    source=BASE.read_text()
    marker="select 'P6_LOAD_ENV '"
    require(source.count(marker)==1,'P6_DIAG_BASE_MARKER')
    prefix=source.split(marker,1)[0]
    require("set local statement_timeout='30s';" in prefix,'P6_DIAG_TIMEOUT_ANCHOR')
    prefix=prefix.replace("set local statement_timeout='30s';","set local statement_timeout='12s';",1)
    tail=r"""
select 'P6_DIAG_ENV '||jsonb_build_object(
 'postgres',current_setting('server_version'),'statementTimeout',current_setting('statement_timeout'),
 'syntheticNeeds',30000,'dense',12000,'sparse',12000,'remote',3000,'pointFreeOnsite',3000,
 'selectedOneSlot',3000,'concurrency',1,'warmupsPerCase',1,'samplesPerCase',3,
 'network','SQL_only','rlsBypassed',false)::text;

select format('select %L; select pg_temp.p6_load_once(%L,0,0);',
 'P6_DIAG_WARMUP_START case='||label,label)
from p6_load_cases order by label
\gexec

select format('select %L; select pg_temp.p6_load_refresh_anchor(%L);',
 'P6_DIAG_ANCHOR_REFRESH case='||label,label)
from p6_load_cases
where request is not null and request->>'mode' in ('PAGE','MAP','PLACES')
order by label
\gexec

select format(
 'select %L; select pg_temp.p6_load_once(%L,1,%s); select %L||elapsed_ms||%L||response_bytes||%L||result_size from pg_temp.p6_load_samples where block=1 and label=%L and sample=%s;',
 'P6_DIAG_CASE_START sample='||s||' case='||label,
 label,s,
 'P6_DIAG_SAMPLE sample='||s||' case='||label||' ms=',
 ' responseBytes=',' resultSize=',label,s)
from p6_load_cases cross join generate_series(1,3) s
order by s,label
\gexec

\echo 'PASS P6_30000_SHORT_DIAGNOSTIC'
rollback;
"""
    return prefix+tail

def main()->int:
    PUBLIC.mkdir(parents=True,exist_ok=True); PRIVATE.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    report={'unit':'P6_30000_SHORT_DIAGNOSTIC','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL',
      'serverApplied':False,'liveAccess':False,'native':False,'productionWired':False,'p6Finished':False}
    try:
        require(os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true','P6_DIAG_CI_ONLY')
        u=urlparse(os.environ['DB_URL'])
        require(u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres','P6_DIAG_LOCAL_ONLY')
        require(os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL'],'P6_DIAG_TARGET_MISMATCH')
        head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
        require(head==report['sourceSha'],'P6_DIAG_HEAD')
        for p in (BASE,ROLLOUT,OWN,WORKFLOW):
            raw=p.read_bytes()
            require(raw==subprocess.check_output(['git','show',head+':'+str(p)]),'P6_DIAG_UNCOMMITTED_SOURCE')
        require(sha(ROLLOUT)==EXPECTED_ROLLOUT_SHA,'P6_DIAG_ROLLOUT_DRIFT')
        probe=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-c',
          "select to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null"],capture_output=True,text=True,timeout=30)
        require(probe.returncode==0 and probe.stdout.strip()=='t','P6_DIAG_ROLLOUT_NOT_INSTALLED')

        diag=PRIVATE/'p6_load_30k_diag.generated.sql'
        diag.write_text(diagnostic_sql())
        run=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',str(diag)],
          capture_output=True,text=True,timeout=1800)
        (PRIVATE/'diag.stdout').write_text(run.stdout); (PRIVATE/'diag.stderr').write_text(run.stderr)
        lines=[x.strip() for x in run.stdout.splitlines()]
        samples=[]
        rx=re.compile(r'^P6_DIAG_SAMPLE sample=(\d+) case=([A-Z0-9_]+) ms=([0-9.]+) responseBytes=(\d+) resultSize=(\d+)$')
        for line in lines:
            m=rx.match(line)
            if m:
                samples.append({'sample':int(m.group(1)),'case':m.group(2),'ms':float(m.group(3)),
                  'responseBytes':int(m.group(4)),'resultSize':int(m.group(5))})
        report['samplesObserved']=samples
        starts=[x for x in lines if x.startswith('P6_DIAG_CASE_START ')]
        refresh=[x for x in lines if x.startswith('P6_DIAG_ANCHOR_REFRESH ')]
        warmups=[x for x in lines if x.startswith('P6_DIAG_WARMUP_START ')]
        if starts: report['lastCaseStart']=starts[-1]
        if refresh: report['lastAnchorRefresh']=refresh[-1]
        if warmups: report['lastWarmupStart']=warmups[-1]
        if run.returncode:
            m=re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):',run.stderr)
            if m: report['sqlState']=m.group(1)
            m=re.search(r'(P6_[A-Z0-9_]+(?::[^\n]*)?)',run.stderr)
            if m: report['diagnostic']=m.group(1)[:240]
            raise ValueError('P6_DIAG_SQL_REFUSED')
        require('PASS P6_30000_SHORT_DIAGNOSTIC' in lines,'P6_DIAG_PASS_MARKER')
        require(len(samples)==24,'P6_DIAG_SAMPLE_COUNT')
        summary=[]
        for case in CASES:
            xs=sorted(x['ms'] for x in samples if x['case']==case)
            require(len(xs)==3,'P6_DIAG_CASE_COUNT')
            summary.append({'case':case,'n':3,'minMs':xs[0],'medianMs':xs[1],'maxMs':xs[2]})
        report.update(result='PASS',summary=summary,slowestByMedian=sorted(summary,key=lambda x:x['medianMs'],reverse=True))
    except subprocess.TimeoutExpired:
        report['failure']={'code':'P6_DIAG_HARNESS_TIMEOUT'}
    except Exception as e:
        report['failure']={'code':str(e) if re.fullmatch(r'P6_[A-Z0-9_]+',str(e)) else 'P6_DIAG_FAILED'}
    finally:
        report['wallSeconds']=round(time.monotonic()-started,3)
        report['environment']={'os':platform.platform(),'cpuCount':os.cpu_count(),'runner':os.getenv('RUNNER_NAME')}
        report['limits']=[
          'Disposable local 30000-Need diagnosis only; no canonical DEV mutation.',
          'Three samples per case identify a bottleneck; they are not final performance acceptance.',
          'Per-statement diagnostic timeout is 12 seconds only to fail fast while isolating the slow case.',
          'SQL-only, warm single backend; no HTTP/network/native/concurrent-load claim.'
        ]
        (PUBLIC/'p6-30k-short-diagnostic.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report['result']+' P6_30000_SHORT_DIAGNOSTIC')
    return 0 if report['result']=='PASS' else 1

if __name__=='__main__':
    raise SystemExit(main())
