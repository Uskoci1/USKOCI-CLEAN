from __future__ import annotations
import json, os, re, subprocess, time, hashlib
from pathlib import Path
from urllib.parse import urlparse

BASE=Path('supabase/proofs/discovery/p6_load_30k.sql')
ROLLOUT=Path('supabase/candidates/p6_discovery_rollout.sql')
OWN=Path('supabase/proofs/discovery/p6_load_30k_rls_components.py')
WORKFLOW=Path('.github/workflows/p6-round61-rls-components.yml')
PUBLIC=Path('/tmp/p6-rls-components-evidence')
PRIVATE=Path('/tmp/p6-rls-components-private')
EXPECTED_ROLLOUT_SHA='ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c'
CASES=('PAGE_ALL','SCAN')
STAGES=('account_once','no_world_guard','participant_public_short_circuit','owner_uid_once')

def require(v,code):
    if not v: raise ValueError(code)

def sha(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def sample_sql(stage:str,block:int)->str:
    return f"""
select format(
 'select %L; select pg_temp.p6_load_once(%L,{block},%s); select %L||elapsed_ms from pg_temp.p6_load_samples where block={block} and label=%L and sample=%s;',
 'P6_RLS_COMPONENT_START stage={stage} sample='||s||' case='||label,label,s,
 'P6_RLS_COMPONENT stage={stage} sample='||s||' case='||label||' ms=',label,s)
from p6_load_cases cross join generate_series(1,2) s
where label in ('PAGE_ALL','SCAN')
order by s,label
\\gexec
"""

def refresh_page()->str:
    return r"""
select pg_temp.p6_load_refresh_anchor('PAGE_ALL');
"""

def generated_sql()->str:
    src=BASE.read_text()
    marker="select 'P6_LOAD_ENV '"
    require(src.count(marker)==1,'P6_RLS_COMPONENT_BASE_MARKER')
    prefix=src.split(marker,1)[0]
    tail=r"""
-- Seed expected replies only for the two diagnostic cases.
select pg_temp.p6_load_once('PAGE_ALL',0,0);
select pg_temp.p6_load_once('SCAN',0,0);

reset role;
alter policy v5_closed_account_visibility on public.needs
 using ((select public.rpc_storage_account_open()));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);
""" + refresh_page() + sample_sql('account_once',1) + r"""
reset role;
-- Diagnostic only: same-world fixture, so this removes only the per-row cost while
-- preserving this fixture's visible row set. Never a production proposal by itself.
alter policy needs_public_discovery on public.needs
 using (status = any (array['PUBLISHED'::text,'SELECTION'::text]));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);
""" + refresh_page() + sample_sql('no_world_guard',2) + r"""
reset role;
-- Public statuses are already admitted by needs_public_discovery. Gate the participant
-- helper to non-public states so the row-dependent helper is not evaluated on public discovery rows.
alter policy needs_participant_read on public.needs
 using (status not in ('PUBLISHED','SELECTION') and public.fn_need_participant_can_read(id));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);
""" + refresh_page() + sample_sql('participant_public_short_circuit',3) + r"""
reset role;
alter policy needs_owner_select on public.needs
 using (requester_account_id = (select auth.uid()));
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);
""" + refresh_page() + sample_sql('owner_uid_once',1) + r"""
\echo 'PASS P6_30000_RLS_COMPONENTS'
rollback;
"""
    return prefix+tail

def main()->int:
    PUBLIC.mkdir(parents=True,exist_ok=True); PRIVATE.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    report={'unit':'P6_30000_RLS_COMPONENTS','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL',
      'diagnosticOnly':True,'liveAccess':False,'serverApplied':False,'productionWired':False,'p6Finished':False}
    try:
        require(os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true','P6_RLS_COMPONENT_CI_ONLY')
        u=urlparse(os.environ['DB_URL'])
        require(u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres','P6_RLS_COMPONENT_LOCAL_ONLY')
        require(os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL'],'P6_RLS_COMPONENT_TARGET')
        head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
        require(head==report['sourceSha'],'P6_RLS_COMPONENT_HEAD')
        for p in (BASE,ROLLOUT,OWN,WORKFLOW):
            raw=p.read_bytes()
            require(raw==subprocess.check_output(['git','show',head+':'+str(p)]),'P6_RLS_COMPONENT_UNCOMMITTED')
        require(sha(ROLLOUT)==EXPECTED_ROLLOUT_SHA,'P6_RLS_COMPONENT_ROLLOUT_DRIFT')
        probe=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-c',
          "select to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null"],capture_output=True,text=True,timeout=30)
        require(probe.returncode==0 and probe.stdout.strip()=='t','P6_RLS_COMPONENT_ROLLOUT_NOT_INSTALLED')

        path=PRIVATE/'rls_components.generated.sql'; path.write_text(generated_sql())
        run=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',str(path)],
          capture_output=True,text=True,timeout=900)
        (PRIVATE/'stdout').write_text(run.stdout);(PRIVATE/'stderr').write_text(run.stderr)
        lines=[x.strip() for x in run.stdout.splitlines()]
        rx=re.compile(r'^P6_RLS_COMPONENT stage=([a-z_]+) sample=(\d+) case=([A-Z0-9_]+) ms=([0-9.]+)$')
        samples=[]
        for line in lines:
            m=rx.match(line)
            if m: samples.append({'stage':m.group(1),'sample':int(m.group(2)),'case':m.group(3),'ms':float(m.group(4))})
        report['samples']=samples
        starts=[x for x in lines if x.startswith('P6_RLS_COMPONENT_START ')]
        if starts: report['lastStart']=starts[-1]
        if run.returncode:
            m=re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):',run.stderr)
            if m: report['sqlState']=m.group(1)
            m=re.search(r'(P6_[A-Z0-9_]+(?::[^\n]*)?)',run.stderr)
            if m: report['diagnostic']=m.group(1)[:240]
            raise ValueError('P6_RLS_COMPONENT_SQL_REFUSED')
        require('PASS P6_30000_RLS_COMPONENTS' in lines,'P6_RLS_COMPONENT_PASS_MARKER')
        require(len(samples)==16,'P6_RLS_COMPONENT_SAMPLE_COUNT')
        summary=[]
        for stage in STAGES:
            for case in CASES:
                xs=sorted(x['ms'] for x in samples if x['stage']==stage and x['case']==case)
                require(len(xs)==2,'P6_RLS_COMPONENT_CASE_COUNT')
                summary.append({'stage':stage,'case':case,'minMs':xs[0],'maxMs':xs[1],'meanMs':round(sum(xs)/2,3)})
        report.update(result='PASS',summary=summary,allPayloadsStable=True)
    except subprocess.TimeoutExpired:
        report['failure']={'code':'P6_RLS_COMPONENT_HARNESS_TIMEOUT'}
    except Exception as e:
        report['failure']={'code':str(e) if re.fullmatch(r'P6_[A-Z0-9_]+',str(e)) else 'P6_RLS_COMPONENT_FAILED'}
    finally:
        report['wallSeconds']=round(time.monotonic()-started,3)
        report['limits']=[
          'All policy edits are inside one disposable transaction and roll back.',
          'Removing the world guard is diagnostic only on a same-world synthetic fixture; it is not a production candidate.',
          'Two samples per stage/case identify cost components only, not final acceptance.',
          'No canonical DEV, certificate, live data or production policy was changed.'
        ]
        (PUBLIC/'p6-30k-rls-components.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report['result']+' P6_30000_RLS_COMPONENTS')
    return 0 if report['result']=='PASS' else 1

if __name__=='__main__':
    raise SystemExit(main())
