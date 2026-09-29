from __future__ import annotations
import hashlib, json, os, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlparse

BASE=Path('supabase/proofs/discovery/p6_load_30k.py')
SQL=Path('supabase/proofs/discovery/p6_load_30k.sql')
ROLLOUT=Path('supabase/candidates/p6_discovery_rollout.sql')
VIS=Path('supabase/candidates/p6_discovery_visibility_cost_v1.sql')
OWN=Path('supabase/proofs/discovery/p6_load_30k_visibility.py')
WORKFLOW=Path('.github/workflows/p6-round65-load-visibility.yml')
BASE_PUBLIC=Path('/tmp/p6-discovery-evidence')
PUBLIC=Path('/tmp/p6-load-visibility-evidence')
PRIVATE=Path('/tmp/p6-load-visibility-private')

def require(v,code):
    if not v: raise ValueError(code)
def sha(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def sql(text:str,timeout=30):
    return subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-c',text],
      capture_output=True,text=True,timeout=timeout)

def main()->int:
    PUBLIC.mkdir(parents=True,exist_ok=True);PRIVATE.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    report={'unit':'P6_30000_LOAD_WITH_VISIBILITY_COST','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL',
      'liveAccess':False,'serverApplied':False,'productionWired':False,'native':False,'p6Finished':False}
    try:
        require(os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true','P6_VIS_LOAD_CI_ONLY')
        u=urlparse(os.environ['DB_URL'])
        require(u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres','P6_VIS_LOAD_LOCAL_ONLY')
        require(os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL'],'P6_VIS_LOAD_TARGET')
        head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
        require(head==report['sourceSha'],'P6_VIS_LOAD_HEAD')
        for p in (BASE,SQL,ROLLOUT,VIS,OWN,WORKFLOW):
            raw=p.read_bytes()
            require(raw==subprocess.check_output(['git','show',head+':'+str(p)]),'P6_VIS_LOAD_UNCOMMITTED')
        report['sourceHashes']={str(p):sha(p) for p in (BASE,SQL,ROLLOUT,VIS,OWN,WORKFLOW)}

        admission=sql("""select
          to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null
          and to_regprocedure('rls_private.p6_discovery_test_world_accounts()') is not null
          and position('p6_discovery_test_world_accounts' in (select qual from pg_policies
            where schemaname='public' and tablename='needs' and policyname='needs_public_discovery'))>0
          and position('rpc_storage_account_open' in (select qual from pg_policies
            where schemaname='public' and tablename='needs' and policyname='v5_closed_account_visibility'))>0""")
        require(admission.returncode==0 and admission.stdout.strip()=='t','P6_VIS_LOAD_CANDIDATE_NOT_APPLIED')

        run=subprocess.run([sys.executable,'-B',str(BASE)],capture_output=True,text=True,timeout=2400)
        (PRIVATE/'base.stdout').write_text(run.stdout);(PRIVATE/'base.stderr').write_text(run.stderr)
        require((BASE_PUBLIC/'p6-load-30k-receipt.json').exists(),'P6_VIS_LOAD_BASE_RECEIPT_MISSING')
        base=json.loads((BASE_PUBLIC/'p6-load-30k-receipt.json').read_text())
        report['baseResult']=base.get('result')
        report['baseReceiptSha256']=sha(BASE_PUBLIC/'p6-load-30k-receipt.json')
        report['visibilityCandidateSha256']=sha(VIS)
        report['baseFailure']=base.get('failure')
        if run.returncode or base.get('result')!='PASS':
            raise ValueError('P6_VIS_LOAD_BASE_FAILED')
        samples=BASE_PUBLIC/'p6-load-30k-samples.json'
        require(samples.exists(),'P6_VIS_LOAD_SAMPLES_MISSING')
        report.update(result='PASS',
          environment=base.get('environment'),metrics=base.get('metrics'),
          performanceScreeningPass=base.get('performanceScreeningPass'),
          sameRunnerStabilityPass=base.get('sameRunnerStabilityPass'),
          sampleSha256=base.get('sampleSha256'),visibilityCandidateApplied=True)
        (PUBLIC/'p6-load-30k-samples.json').write_bytes(samples.read_bytes())
        (PUBLIC/'p6-base-load-receipt.json').write_text(json.dumps(base,indent=2)+'\n')
    except subprocess.TimeoutExpired:
        report['failure']={'code':'P6_VIS_LOAD_HARNESS_TIMEOUT'}
    except Exception as e:
        report['failure']={'code':str(e) if re.fullmatch(r'P6_[A-Z0-9_]+',str(e)) else 'P6_VIS_LOAD_FAILED'}
    finally:
        report['wallSeconds']=round(time.monotonic()-started,3)
        report['limits']=[
          'Disposable local 30000-Need sustained proof with the source-only visibility-cost candidate; no canonical DEV/live mutation.',
          'The inherited benchmark is 720 SQL-only warm single-backend samples; it is not 30000 concurrent users.',
          'HTTP/network/native rendering and concurrent load remain separate.',
          'The 1000ms RPC screening ceiling remains diagnostic, not an owner-approved end-to-end SLA.'
        ]
        (PUBLIC/'p6-load-30k-visibility-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report['result']+' P6_30000_LOAD_WITH_VISIBILITY_COST')
    return 0 if report['result']=='PASS' else 1
if __name__=='__main__': raise SystemExit(main())
