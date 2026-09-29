from __future__ import annotations
import hashlib, json, math, os, re, subprocess, time
from pathlib import Path
from urllib.parse import urlparse

BASE=Path('supabase/proofs/discovery/p6_load_30k.sql')
ROLLOUT=Path('supabase/candidates/p6_discovery_rollout.sql')
CANDIDATE=Path('supabase/candidates/p6_discovery_visibility_cost_v1.sql')
OWN=Path('supabase/proofs/discovery/p6_visibility_candidate_proof.py')
WORKFLOW=Path('.github/workflows/p6-round64-visibility-candidate.yml')
PUBLIC=Path('/tmp/p6-visibility-evidence')
PRIVATE=Path('/tmp/p6-visibility-private')
EXPECTED_ROLLOUT_SHA='ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c'
CASES=('PAGE_ALL','PAGE_PEOPLE2','MAP_DENSE','MAP_SPARSE','PLACES_SPARSE','EXACT_PUBLIC','SCAN','COVERAGE_SCAN')

def require(v,code):
    if not v: raise ValueError(code)
def sha(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()
def psql(source:str,timeout=120)->subprocess.CompletedProcess:
    return subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
      input=source,capture_output=True,text=True,timeout=timeout)

def apply_candidate()->None:
    source="begin;\nset local p6_discovery.disposable='SOURCE_ONLY_ROLLBACK';\n"+CANDIDATE.read_text()+"\ncommit;\n"
    r=psql(source,120)
    (PRIVATE/'apply.stdout').write_text(r.stdout);(PRIVATE/'apply.stderr').write_text(r.stderr)
    require(r.returncode==0,'P6_VISIBILITY_APPLY_REFUSED')
    repeat=psql(source,60)
    (PRIVATE/'repeat.stdout').write_text(repeat.stdout);(PRIVATE/'repeat.stderr').write_text(repeat.stderr)
    require(repeat.returncode!=0 and 'P6_VISIBILITY_ALREADY_INSTALLED' in repeat.stderr,'P6_VISIBILITY_REPEAT_NOT_REFUSED')

def generated_load()->str:
    src=BASE.read_text();marker="select 'P6_LOAD_ENV '"
    require(src.count(marker)==1,'P6_VISIBILITY_BASE_MARKER')
    prefix=src.split(marker,1)[0]
    labels=",".join(repr(x) for x in CASES)
    refresh=r"""
select pg_temp.p6_load_refresh_anchor('PAGE_ALL');
select pg_temp.p6_load_refresh_anchor('PAGE_PEOPLE2');
select pg_temp.p6_load_refresh_anchor('MAP_DENSE');
select pg_temp.p6_load_refresh_anchor('MAP_SPARSE');
select pg_temp.p6_load_refresh_anchor('PLACES_SPARSE');
"""
    tail=r"""
select format('select pg_temp.p6_load_once(%L,0,0);',label)
from p6_load_cases order by label
\gexec
"""+refresh+f"""
select format(
 'select pg_temp.p6_load_once(%L,1,%s); select %L||elapsed_ms from pg_temp.p6_load_samples where block=1 and label=%L and sample=%s;',
 label,s,'P6_VISIBILITY_SAMPLE sample='||s||' case='||label||' ms=',label,s)
from p6_load_cases cross join generate_series(1,3) s
where label in ({labels})
order by s,label
\gexec
\echo 'PASS P6_VISIBILITY_30K_SHORT'
rollback;
"""
    return prefix+tail

def main()->int:
    PUBLIC.mkdir(parents=True,exist_ok=True);PRIVATE.mkdir(parents=True,exist_ok=True)
    report={'unit':'P6_VISIBILITY_COST_CANDIDATE','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL',
      'liveAccess':False,'serverApplied':False,'productionWired':False,'native':False,'p6Finished':False}
    started=time.monotonic()
    try:
        require(os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true','P6_VISIBILITY_CI_ONLY')
        u=urlparse(os.environ['DB_URL'])
        require(u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres','P6_VISIBILITY_LOCAL_ONLY')
        require(os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL'],'P6_VISIBILITY_TARGET')
        head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
        require(head==report['sourceSha'],'P6_VISIBILITY_HEAD')
        for p in (BASE,ROLLOUT,CANDIDATE,OWN,WORKFLOW):
            raw=p.read_bytes();require(raw==subprocess.check_output(['git','show',head+':'+str(p)]),'P6_VISIBILITY_UNCOMMITTED')
        require(sha(ROLLOUT)==EXPECTED_ROLLOUT_SHA,'P6_VISIBILITY_ROLLOUT_DRIFT')
        report['sourceHashes']={str(p):sha(p) for p in (BASE,ROLLOUT,CANDIDATE,OWN,WORKFLOW)}

        probe=psql("select to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null",30)
        require(probe.returncode==0 and probe.stdout.strip()=='t','P6_VISIBILITY_ROLLOUT_NOT_INSTALLED')
        before=psql("select private.closure_source_digest_v5()||'|'||(select sha256 from private.closure_source_v5 where singleton)||'|'||(select sha256 from private.closure_erasure_source_v5 where singleton)",30)
        require(before.returncode==0,'P6_VISIBILITY_CERT_BEFORE')
        apply_candidate()
        after=psql("select private.closure_source_digest_v5()||'|'||(select sha256 from private.closure_source_v5 where singleton)||'|'||(select sha256 from private.closure_erasure_source_v5 where singleton)",30)
        require(after.returncode==0 and after.stdout.strip()==before.stdout.strip(),'P6_VISIBILITY_CERT_MOVED')

        api=psql("select current_setting('pgrst.db_schemas',true)",30)
        report['rlsPrivatePostgrestExposed']='rls_private' in api.stdout
        require(not report['rlsPrivatePostgrestExposed'],'P6_VISIBILITY_PRIVATE_SCHEMA_EXPOSED')

        sql=PRIVATE/'load.generated.sql';sql.write_text(generated_load())
        run=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',str(sql)],
          capture_output=True,text=True,timeout=900)
        (PRIVATE/'load.stdout').write_text(run.stdout);(PRIVATE/'load.stderr').write_text(run.stderr)
        lines=[x.strip() for x in run.stdout.splitlines()]
        rx=re.compile(r'^P6_VISIBILITY_SAMPLE sample=(\d+) case=([A-Z0-9_]+) ms=([0-9.]+)$')
        samples=[]
        for line in lines:
            m=rx.match(line)
            if m:samples.append({'sample':int(m.group(1)),'case':m.group(2),'ms':float(m.group(3))})
        report['samples']=samples
        if run.returncode:
            m=re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):',run.stderr)
            if m:report['sqlState']=m.group(1)
            m=re.search(r'(P6_[A-Z0-9_]+(?::[^\n]*)?)',run.stderr)
            if m:report['diagnostic']=m.group(1)[:240]
            raise ValueError('P6_VISIBILITY_LOAD_REFUSED')
        require('PASS P6_VISIBILITY_30K_SHORT' in lines,'P6_VISIBILITY_PASS_MARKER')
        require(len(samples)==24,'P6_VISIBILITY_SAMPLE_COUNT')
        summary=[]
        for c in CASES:
            xs=sorted(x['ms'] for x in samples if x['case']==c)
            require(len(xs)==3,'P6_VISIBILITY_CASE_COUNT')
            summary.append({'case':c,'minMs':xs[0],'medianMs':xs[1],'maxMs':xs[2]})
        report.update(result='PASS',summary=summary,certificateUnchanged=True,repeatApplyRefused=True,
          payloadStableAcrossThreeSamples=True)
    except subprocess.TimeoutExpired:
        report['failure']={'code':'P6_VISIBILITY_HARNESS_TIMEOUT'}
    except Exception as e:
        report['failure']={'code':str(e) if re.fullmatch(r'P6_[A-Z0-9_]+',str(e)) else 'P6_VISIBILITY_PROOF_FAILED'}
    finally:
        report['wallSeconds']=round(time.monotonic()-started,3)
        report['limits']=[
          'Disposable local candidate proof only; no canonical DEV/live mutation.',
          'The candidate changes only two Need SELECT policy expressions and adds one non-PostgREST rls_private helper.',
          'The closure digest/certificate and Need ACL must remain byte-identical.',
          'Three 30k samples per case are a fast correctness/performance screen, not final sustained acceptance.'
        ]
        (PUBLIC/'p6-visibility-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report['result']+' P6_VISIBILITY_COST_CANDIDATE')
    return 0 if report['result']=='PASS' else 1

if __name__=='__main__': raise SystemExit(main())
