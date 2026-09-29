from __future__ import annotations
import json, os, re, subprocess, time, hashlib
from pathlib import Path
from urllib.parse import urlparse

BASE=Path('supabase/proofs/discovery/p6_load_30k.sql')
ROLLOUT=Path('supabase/candidates/p6_discovery_rollout.sql')
OWN=Path('supabase/proofs/discovery/p6_load_30k_rls_probe.py')
WORKFLOW=Path('.github/workflows/p6-round60-rls-probe.yml')
PUBLIC=Path('/tmp/p6-rls-probe-evidence')
PRIVATE=Path('/tmp/p6-rls-probe-private')
EXPECTED_ROLLOUT_SHA='ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c'
CASES=('PAGE_ALL','PAGE_PEOPLE2','MAP_DENSE','MAP_SPARSE','PLACES_SPARSE','EXACT_PUBLIC','SCAN','COVERAGE_SCAN')

def require(v,code):
    if not v: raise ValueError(code)

def sha(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def generated_sql()->str:
    src=BASE.read_text()
    marker="select 'P6_LOAD_ENV '"
    require(src.count(marker)==1,'P6_RLS_BASE_MARKER')
    prefix=src.split(marker,1)[0]
    tail=r"""
select 'P6_RLS_PROBE_ENV '||jsonb_build_object(
 'postgres',current_setting('server_version'),'statementTimeout',current_setting('statement_timeout'),
 'syntheticNeeds',30000,'baselineSamplesPerCase',1,'optimizedSamplesPerCase',3,
 'network','SQL_only','rlsBypassed',false)::text;

-- One warmup seeds authoritative expected replies and legitimate anchors.
select format('select pg_temp.p6_load_once(%L,0,0);',label) from p6_load_cases order by label
\gexec

select format(
 'select %L; select pg_temp.p6_load_once(%L,1,1); select %L||elapsed_ms from pg_temp.p6_load_samples where block=1 and label=%L and sample=1;',
 'P6_RLS_SAMPLE_START phase=baseline case='||label,label,
 'P6_RLS_SAMPLE phase=baseline sample=1 case='||label||' ms=',label)
from p6_load_cases order by label
\gexec

-- Diagnostic-only equivalent policy shape: the account-open predicate has no row argument.
-- Evaluate it once as an initplan instead of once per Need row. This ALTER is inside the
-- disposable transaction and is rolled back; it is NOT an approved live/certificate change.
reset role;
do $guard$
declare q text;
begin
 select pg_get_expr(polqual,polrelid) into strict q from pg_policy
 where polrelid='public.needs'::regclass and polname='v5_closed_account_visibility';
 if q not like '%rpc_storage_account_open%' then raise exception 'P6_RLS_POLICY_SOURCE_DRIFT'; end if;
end $guard$;
alter policy v5_closed_account_visibility on public.needs
 using ((select public.rpc_storage_account_open()));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);

select format('select pg_temp.p6_load_refresh_anchor(%L);',label)
from p6_load_cases
where request is not null and request->>'mode' in ('PAGE','MAP','PLACES')
order by label
\gexec

select format(
 'select %L; select pg_temp.p6_load_once(%L,2,%s); select %L||elapsed_ms from pg_temp.p6_load_samples where block=2 and label=%L and sample=%s;',
 'P6_RLS_SAMPLE_START phase=optimized sample='||s||' case='||label,label,s,
 'P6_RLS_SAMPLE phase=optimized sample='||s||' case='||label||' ms=',label,s)
from p6_load_cases cross join generate_series(1,3) s
order by s,label
\gexec

\echo 'PASS P6_30000_RLS_VISIBILITY_PROBE'
rollback;
"""
    return prefix+tail

def main()->int:
    PUBLIC.mkdir(parents=True,exist_ok=True); PRIVATE.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    report={'unit':'P6_30000_RLS_VISIBILITY_PROBE','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL',
      'diagnosticOnly':True,'liveAccess':False,'serverApplied':False,'productionWired':False,'p6Finished':False}
    try:
        require(os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true','P6_RLS_CI_ONLY')
        u=urlparse(os.environ['DB_URL'])
        require(u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres','P6_RLS_LOCAL_ONLY')
        require(os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL'],'P6_RLS_TARGET_MISMATCH')
        head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
        require(head==report['sourceSha'],'P6_RLS_HEAD')
        for p in (BASE,ROLLOUT,OWN,WORKFLOW):
            raw=p.read_bytes()
            require(raw==subprocess.check_output(['git','show',head+':'+str(p)]),'P6_RLS_UNCOMMITTED_SOURCE')
        require(sha(ROLLOUT)==EXPECTED_ROLLOUT_SHA,'P6_RLS_ROLLOUT_DRIFT')
        probe=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-c',
          "select to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null"],capture_output=True,text=True,timeout=30)
        require(probe.returncode==0 and probe.stdout.strip()=='t','P6_RLS_ROLLOUT_NOT_INSTALLED')

        path=PRIVATE/'p6_rls_probe.generated.sql'; path.write_text(generated_sql())
        run=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',str(path)],
          capture_output=True,text=True,timeout=1200)
        (PRIVATE/'probe.stdout').write_text(run.stdout); (PRIVATE/'probe.stderr').write_text(run.stderr)
        lines=[x.strip() for x in run.stdout.splitlines()]
        rx=re.compile(r'^P6_RLS_SAMPLE phase=(baseline|optimized) sample=(\d+) case=([A-Z0-9_]+) ms=([0-9.]+)$')
        samples=[]
        for line in lines:
            m=rx.match(line)
            if m: samples.append({'phase':m.group(1),'sample':int(m.group(2)),'case':m.group(3),'ms':float(m.group(4))})
        report['samples']=samples
        starts=[x for x in lines if x.startswith('P6_RLS_SAMPLE_START ')]
        if starts: report['lastStart']=starts[-1]
        if run.returncode:
            m=re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):',run.stderr)
            if m: report['sqlState']=m.group(1)
            m=re.search(r'(P6_[A-Z0-9_]+(?::[^\n]*)?)',run.stderr)
            if m: report['diagnostic']=m.group(1)[:240]
            raise ValueError('P6_RLS_SQL_REFUSED')
        require('PASS P6_30000_RLS_VISIBILITY_PROBE' in lines,'P6_RLS_PASS_MARKER')
        require(len(samples)==32,'P6_RLS_SAMPLE_COUNT')
        summary=[]
        for case in CASES:
            b=[x['ms'] for x in samples if x['phase']=='baseline' and x['case']==case]
            o=sorted(x['ms'] for x in samples if x['phase']=='optimized' and x['case']==case)
            require(len(b)==1 and len(o)==3,'P6_RLS_CASE_COUNT')
            median=o[1]
            summary.append({'case':case,'baselineMs':b[0],'optimizedMedianMs':median,
              'optimizedMinMs':o[0],'optimizedMaxMs':o[2],
              'speedupX':round(b[0]/median,3) if median else None})
        report.update(result='PASS',summary=summary,allPayloadsStable=True,
          policyProbe='v5_closed_account_visibility USING ((select public.rpc_storage_account_open()))')
    except subprocess.TimeoutExpired:
        report['failure']={'code':'P6_RLS_HARNESS_TIMEOUT'}
    except Exception as e:
        report['failure']={'code':str(e) if re.fullmatch(r'P6_[A-Z0-9_]+',str(e)) else 'P6_RLS_PROBE_FAILED'}
    finally:
        report['wallSeconds']=round(time.monotonic()-started,3)
        report['limits']=[
          'Disposable rollback-only diagnostic; the policy alteration is never committed to the reconstructed database.',
          'This is not authorization to change the closure certificate, RLS policy, canonical DEV or production.',
          'One baseline and three optimized SQL samples per case are diagnostic, not final performance acceptance.',
          'Any production candidate requires separate exact source/certificate review and the established approval procedure.'
        ]
        (PUBLIC/'p6-30k-rls-visibility-probe.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report['result']+' P6_30000_RLS_VISIBILITY_PROBE')
    return 0 if report['result']=='PASS' else 1

if __name__=='__main__':
    raise SystemExit(main())
