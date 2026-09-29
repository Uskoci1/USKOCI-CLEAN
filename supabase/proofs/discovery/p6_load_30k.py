from __future__ import annotations
import hashlib, json, math, os, platform, re, subprocess, sys
from pathlib import Path
from urllib.parse import urlparse

PRIVATE=Path('/tmp/p6-load-private')
PUBLIC=Path('/tmp/p6-discovery-evidence')
SQL=Path('supabase/proofs/discovery/p6_load_30k.sql')
ROLLOUT=Path('supabase/candidates/p6_discovery_rollout.sql')
OWN=Path('supabase/proofs/discovery/p6_load_30k.py')
WORKFLOW=Path('.github/workflows/p6-round57-load-proof.yml')
CASES=('PAGE_ALL','PAGE_PEOPLE2','MAP_DENSE','MAP_SPARSE','PLACES_SPARSE','EXACT_PUBLIC','SCAN','COVERAGE_SCAN')
RPC_CASES=CASES[:6]
EXPECTED_ROLLOUT_SHA='ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c'

def require(value,code):
    if not value: raise ValueError(code)

def sha(path:Path)->str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def summarize(samples:list[dict])->dict:
    require(len(samples)==720,'P6_LOAD_SAMPLE_COUNT')
    seen=set(); rows=[]
    keys={'block','case','sample','ms','responseBytes','resultSize'}
    for x in samples:
        require(isinstance(x,dict) and set(x)==keys,'P6_LOAD_SAMPLE_SHAPE')
        require(type(x['block']) is int and x['block'] in (1,2,3),'P6_LOAD_BLOCK')
        require(type(x['sample']) is int and 1<=x['sample']<=30 and x['case'] in CASES,'P6_LOAD_CASE')
        ident=(x['block'],x['case'],x['sample']);require(ident not in seen,'P6_LOAD_DUPLICATE');seen.add(ident)
        require(type(x['ms']) in (int,float) and not isinstance(x['ms'],bool) and math.isfinite(x['ms']) and x['ms']>=0,'P6_LOAD_TIME')
        for f in ('responseBytes','resultSize'):
            require(type(x[f]) is int and x[f]>=0,'P6_LOAD_SIZE')
    for case in CASES:
        blocks=[]
        for block in (1,2,3):
            subset=[x for x in samples if x['case']==case and x['block']==block]
            require(len(subset)==30,'P6_LOAD_INCOMPLETE_BLOCK')
            t=sorted(x['ms'] for x in subset)
            blocks.append({'block':block,'n':30,'p50Ms':t[14],'p95Ms':t[28],'maxMs':t[-1],
                'maxResponseBytes':max(x['responseBytes'] for x in subset),'maxResultSize':max(x['resultSize'] for x in subset)})
        p=[x['p95Ms'] for x in blocks];low,high=min(p),max(p)
        spread=high/low if low>0 else (1 if high==0 else None)
        rows.append({'case':case,'blocks':blocks,'worstP95Ms':high,'p95SpreadRatio':None if spread is None else round(spread,6),
            'within25Percent':spread is not None and spread<=1.25,'under1000Ms':high<=1000})
    rpc=[x for x in rows if x['case'] in RPC_CASES]
    return {'samples':720,'cases':rows,'allRpcUnder1000Ms':all(x['under1000Ms'] for x in rpc),
      'allRpcSpreadWithin25Percent':all(x['within25Percent'] for x in rpc),
      'productionPerformanceAccepted':False,'p6Finished':False}

def main()->int:
    report={'unit':'P6_30000_LOAD_DISTRIBUTIONS','sourceSha':os.getenv('GITHUB_SHA'),'result':'FAIL','sourceHashes':{},
      'serverApplied':False,'liveAccess':False,'providerCalled':False,'native':False,'productionWired':False,'p6Finished':False}
    stage='ADMISSION'
    try:
        require(os.getenv('CI')=='1' and os.getenv('GITHUB_ACTIONS')=='true','P6_LOAD_CI_ONLY')
        u=urlparse(os.environ['DB_URL']);require(u.hostname=='127.0.0.1' and u.port==54322 and u.path=='/postgres' and u.username=='postgres','P6_LOAD_LOCAL_ONLY')
        require(os.environ['DB_URL']==os.environ['RU5_DEVICE_DB_URL'],'P6_LOAD_TARGET_MISMATCH')
        PRIVATE.mkdir(exist_ok=True);PUBLIC.mkdir(exist_ok=True)
        head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();require(head==report['sourceSha'],'P6_LOAD_HEAD')
        for path in (SQL,ROLLOUT,OWN,WORKFLOW):
            raw=path.read_bytes();require(raw==subprocess.check_output(['git','show',head+':'+str(path)]),'P6_LOAD_UNCOMMITTED_SOURCE')
            report['sourceHashes'][str(path)]=hashlib.sha256(raw).hexdigest()
        require(report['sourceHashes'][str(ROLLOUT)]==EXPECTED_ROLLOUT_SHA,'P6_LOAD_ROLLOUT_DRIFT')

        stage='ROLLOUT_PRESENT'
        probe=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-c',
          "select to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null"],capture_output=True,text=True,timeout=30)
        require(probe.returncode==0 and probe.stdout.strip()=='t','P6_LOAD_ROLLOUT_NOT_INSTALLED')

        stage='SQL_LOAD'
        run=subprocess.run(['psql',os.environ['DB_URL'],'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',str(SQL)],
          capture_output=True,text=True,timeout=5400)
        (PRIVATE/'load.stdout').write_text(run.stdout);(PRIVATE/'load.stderr').write_text(run.stderr)
        if run.returncode:
            m=re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):',run.stderr)
            if m: report['sqlState']=m.group(1)
            m=re.search(r'(P6_LOAD_[A-Z0-9_]+(?::[^\n]*)?)',run.stderr)
            if m: report['diagnostic']=m.group(1)[:240]
            raise ValueError('P6_LOAD_SQL_REFUSED')
        require('PASS P6_LOAD_30000_CORRECTNESS_AND_720_SAMPLES' in run.stdout.splitlines(),'P6_LOAD_PASS_MARKER')

        stage='EVIDENCE'
        env=json.loads(next(x[len('P6_LOAD_ENV '):] for x in run.stdout.splitlines() if x.startswith('P6_LOAD_ENV ')))
        samples=json.loads(next(x[len('P6_LOAD_SAMPLES '):] for x in run.stdout.splitlines() if x.startswith('P6_LOAD_SAMPLES ')))
        metrics=summarize(samples)
        require(env['syntheticNeeds']==30000 and env['dense']==12000 and env['sparse']==12000 and env['remote']==3000 and env['pointFreeOnsite']==3000,'P6_LOAD_ENV_COUNTS')
        require(env['rlsBypassed'] is False and env['blocks']==3 and env['samplesPerBlockCase']==30,'P6_LOAD_ENV_AUTH')
        cpu=next((x.split(':',1)[1].strip() for x in Path('/proc/cpuinfo').read_text().splitlines() if x.startswith('model name')),'unknown')
        report.update(result='PASS',environment={**env,'os':platform.platform(),'cpuCount':os.cpu_count(),'cpuModel':cpu,
          'runner':os.getenv('RUNNER_NAME'),'quantiles':'nearest-rank; 30 per block/case; no pooled percentile',
          'cache':'warm after three warmups per case; single backend; no cold-cache claim'},metrics=metrics,
          performanceScreeningPass=metrics['allRpcUnder1000Ms'],sameRunnerStabilityPass=metrics['allRpcSpreadWithin25Percent'])
        payload=json.dumps(samples,indent=2)+'\n';(PUBLIC/'p6-load-30k-samples.json').write_text(payload)
        report['sampleSha256']=hashlib.sha256(payload.encode()).hexdigest()
    except Exception as e:
        report['failure']={'stage':stage,'category':'PROOF_REFUSED','code':str(e) if re.fullmatch(r'P6_[A-Z0-9_]+',str(e)) else 'P6_LOAD_PROOF_FAILED'}
    finally:
        report['limits']=[
          'Disposable local SQL-only benchmark; no canonical DEV mutation and no provider/native claim.',
          'Thirty thousand synthetic Needs are one bounded test volume, not 30000 concurrent users.',
          'One backend connection and warm cache; HTTP/network/rendering/concurrent load remain separate.',
          '1000ms is the existing SQL screening ceiling, not a final owner-approved end-to-end SLA.',
          'A PASS result means correctness/evidence integrity only; performanceScreeningPass can be false and P6 remains open.'
        ]
        (PUBLIC/'p6-load-30k-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report['result']+' P6_30000_LOAD_DISTRIBUTIONS')
    return 0 if report['result']=='PASS' else 1

if __name__=='__main__': raise SystemExit(main())
