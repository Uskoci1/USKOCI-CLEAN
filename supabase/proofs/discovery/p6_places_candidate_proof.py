from __future__ import annotations
import hashlib,json,os,re,statistics,subprocess,time
from pathlib import Path
from urllib.parse import urlparse

LOAD_SQL=Path('supabase/proofs/discovery/p6_load_30k.sql')
ROLLOUT=Path('supabase/candidates/p6_discovery_rollout.sql')
VIS=Path('supabase/candidates/p6_discovery_visibility_cost_v1.sql')
PLACES=Path('supabase/candidates/p6_discovery_places_cost_v1.sql')
OWN=Path('supabase/proofs/discovery/p6_places_candidate_proof.py')
WORKFLOW=Path('.github/workflows/p6-round66-places-cost.yml')
PUBLIC=Path('/tmp/p6-places-evidence')
PRIVATE=Path('/tmp/p6-places-private')
EXPECTED_ROLLOUT_SHA='ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c'

def require(v,code):
    if not v: raise ValueError(code)
def sha(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def generated_sql()->str:
    src=LOAD_SQL.read_text()
    marker="select 'P6_LOAD_ENV '"
    require(src.count(marker)==1,'P6_PLACES_BASE_MARKER')
    prefix=src.split(marker,1)[0]
    candidate=PLACES.read_text()
    return prefix+r"""
reset role;
create temporary table p6_places_parity(
 name text primary key,request jsonb not null,anchored jsonb,baseline jsonb);
insert into p6_places_parity(name,request)
 select 'base',request from p6_load_cases where label='PLACES_SPARSE';
insert into p6_places_parity(name,request)
 select 'prefix_exact',jsonb_set(request,'{prefix}',to_jsonb(public.p6_discovery_key(current_setting('p6.load.prefix')||' Area 001')))
 from p6_load_cases where label='PLACES_SPARSE';
insert into p6_places_parity(name,request)
 select 'facet_area',jsonb_set(request,'{facetArea}','[19.83,45.25,19.83,45.25]'::jsonb)
 from p6_load_cases where label='PLACES_SPARSE';
insert into p6_places_parity(name,request)
 select 'people2',jsonb_set(request,'{filter,places}','2'::jsonb)
 from p6_load_cases where label='PLACES_SPARSE';
insert into p6_places_parity(name,request)
 select 'onsite',jsonb_set(request,'{filter,where}','"onsite"'::jsonb)
 from p6_load_cases where label='PLACES_SPARSE';
insert into p6_places_parity(name,request)
 select 'remote',jsonb_set(request,'{filter,where}','"remote"'::jsonb)
 from p6_load_cases where label='PLACES_SPARSE';
insert into p6_places_parity(name,request)
 select 'today',jsonb_set(request,'{filter,when}','"today"'::jsonb)
 from p6_load_cases where label='PLACES_SPARSE';
grant select,insert,update on p6_places_parity to authenticated;

create function pg_temp.p6_places_measure(stage text,sample integer,req jsonb) returns text
language plpgsql security invoker as $m$
declare began timestamptz; answer jsonb; elapsed numeric;
begin
 began:=clock_timestamp(); answer:=public.rpc_discovery_v1(req);
 elapsed:=round((extract(epoch from clock_timestamp()-began)*1000)::numeric,3);
 return 'P6_PLACES_SAMPLE stage='||stage||' sample='||sample||' ms='||elapsed;
end $m$;
grant execute on function pg_temp.p6_places_measure(text,integer,jsonb) to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);
do $baseline$
declare r record;answer jsonb;base_answer jsonb;base_req jsonb;
begin
 for r in select name,request from p6_places_parity order by name loop
  answer:=public.rpc_discovery_v1(r.request);
  update p6_places_parity set anchored=jsonb_set(r.request,'{anchor}',answer->'anchor'),
    baseline=pg_temp.p6_load_normalize(answer) where name=r.name;
 end loop;
 select anchored,baseline into strict base_req,base_answer from p6_places_parity where name='base';
 answer:=public.rpc_discovery_v1(base_req);
 if (answer->>'hasMore')::boolean then
  base_req:=jsonb_set(base_req,'{after}',answer->'nextCursor');
  insert into p6_places_parity(name,request,anchored,baseline)
   values('base_page2',base_req,base_req,pg_temp.p6_load_normalize(public.rpc_discovery_v1(base_req)));
 end if;
end $baseline$;
select pg_temp.p6_places_measure('baseline',s,(select anchored from p6_places_parity where name='base'))
 from generate_series(1,3) s;
reset role;
""" + candidate + r"""
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);
do $parity$
declare r record;answer jsonb;
begin
 for r in select name,anchored,baseline from p6_places_parity order by name loop
  answer:=public.rpc_discovery_v1(r.anchored);
  if pg_temp.p6_load_normalize(answer) is distinct from r.baseline
   then raise exception 'P6_PLACES_PAYLOAD_DRIFT:%',r.name; end if;
 end loop;
end $parity$;
select pg_temp.p6_places_measure('optimized',s,(select anchored from p6_places_parity where name='base'))
 from generate_series(1,3) s;
\echo 'PASS P6_PLACES_COST_PARITY'
rollback;
"""

def psql(text:str,timeout=30):
    return subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
      input=text,capture_output=True,text=True,timeout=timeout)

def main()->int:
    PUBLIC.mkdir(parents=True,exist_ok=True);PRIVATE.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    report={'unit':'P6_PLACES_COST_CANDIDATE','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL',
      'liveAccess':False,'serverApplied':False,'productionWired':False,'native':False,'p6Finished':False}
    try:
        require(os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true','P6_PLACES_CI_ONLY')
        u=urlparse(os.environ['DB_URL'])
        require(u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres','P6_PLACES_LOCAL_ONLY')
        require(os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL'],'P6_PLACES_TARGET')
        head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
        require(head==report['sourceSha'],'P6_PLACES_HEAD')
        for p in (LOAD_SQL,ROLLOUT,VIS,PLACES,OWN,WORKFLOW):
            raw=p.read_bytes();require(raw==subprocess.check_output(['git','show',head+':'+str(p)]),'P6_PLACES_UNCOMMITTED')
        require(sha(ROLLOUT)==EXPECTED_ROLLOUT_SHA,'P6_PLACES_ROLLOUT_DRIFT')
        report['sourceHashes']={str(p):sha(p) for p in (LOAD_SQL,ROLLOUT,VIS,PLACES,OWN,WORKFLOW)}
        admission=psql("""select to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null
          and to_regprocedure('rls_private.p6_discovery_test_world_accounts()') is not null""")
        require(admission.returncode==0 and admission.stdout.strip()=='t','P6_PLACES_PREDECESSOR_MISSING')

        path=PRIVATE/'places.generated.sql';path.write_text(generated_sql())
        run=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',str(path)],
          capture_output=True,text=True,timeout=900)
        (PRIVATE/'stdout').write_text(run.stdout);(PRIVATE/'stderr').write_text(run.stderr)
        lines=[x.strip() for x in run.stdout.splitlines()]
        rx=re.compile(r'^P6_PLACES_SAMPLE stage=(baseline|optimized) sample=(\d+) ms=([0-9.]+)$')
        samples=[]
        for line in lines:
            m=rx.match(line)
            if m:samples.append({'stage':m.group(1),'sample':int(m.group(2)),'ms':float(m.group(3))})
        report['samples']=samples
        if run.returncode:
            m=re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):',run.stderr)
            if m:report['sqlState']=m.group(1)
            m=re.search(r'(P6_[A-Z0-9_]+(?::[^\n]*)?)',run.stderr)
            if m:report['diagnostic']=m.group(1)[:240]
            raise ValueError('P6_PLACES_SQL_REFUSED')
        require('PASS P6_PLACES_COST_PARITY' in lines,'P6_PLACES_PASS_MARKER')
        require(len(samples)==6,'P6_PLACES_SAMPLE_COUNT')
        baseline=sorted(x['ms'] for x in samples if x['stage']=='baseline')
        optimized=sorted(x['ms'] for x in samples if x['stage']=='optimized')
        bmed=statistics.median(baseline);omed=statistics.median(optimized)
        report.update(result='PASS',parityCases=8,baselineMedianMs=bmed,optimizedMedianMs=omed,
          speedup=round(bmed/omed,3),under1000Ms=omed<1000,sourceOnly=True)
        require(omed<1000,'P6_PLACES_STILL_OVER_1000MS')
    except subprocess.TimeoutExpired:
        report['failure']={'code':'P6_PLACES_HARNESS_TIMEOUT'}
    except Exception as e:
        report['failure']={'code':str(e) if re.fullmatch(r'P6_[A-Z0-9_]+',str(e)) else 'P6_PLACES_PROOF_FAILED'}
    finally:
        report['wallSeconds']=round(time.monotonic()-started,3)
        report['limits']=[
          'Disposable rollback-only PLACES parity/performance proof; no canonical DEV/live mutation.',
          'Seven first-page variants plus a second-page cursor are compared byte-semantically after observation timestamps are removed.',
          'Three samples are a fast screen only; sustained 720-sample acceptance remains separate.'
        ]
        (PUBLIC/'p6-places-cost-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report['result']+' P6_PLACES_COST_CANDIDATE')
    return 0 if report['result']=='PASS' else 1
if __name__=='__main__': raise SystemExit(main())
