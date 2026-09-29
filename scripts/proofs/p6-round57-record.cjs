'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_57_P6_30000_LOAD.md',receipt=dir+'/ROUND_57_P6_30000_LOAD_CHECKS.json';
function verify(){
 const allowed=new Set([report,receipt,dir+'/round57/p6-load-30k-samples.json','AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'Production reader still quarantined');
}
function record(){
 const d=JSON.parse(read('/tmp/p6-discovery-evidence/p6-load-30k-receipt.json'));
 assert.equal(d.result,'PASS');assert.equal(d.sourceSha,git('rev-parse','HEAD'));
 assert.equal(d.metrics.samples,720);assert.equal(d.environment.syntheticNeeds,30000);assert.equal(d.environment.rlsBypassed,false);
 assert.equal(d.serverApplied,false);assert.equal(d.liveAccess,false);assert.equal(d.native,false);assert.equal(d.productionWired,false);assert.equal(d.p6Finished,false);
 assert(read('/tmp/p6-discovery-evidence/stages.txt').includes('teardown exit=0'));
 const samples='/tmp/p6-discovery-evidence/p6-load-30k-samples.json';assert.equal(fs.existsSync(samples),true);
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 fs.mkdirSync(dir+'/round57',{recursive:true});fs.copyFileSync(samples,dir+'/round57/p6-load-30k-samples.json');
 d.run=run;d.teardown='PASS';d.samplePath=dir+'/round57/p6-load-30k-samples.json';write(receipt,JSON.stringify(d,null,2)+'\n');
 const rows=d.metrics.cases.map(x=>'| '+x.case+' | '+x.blocks.map(b=>b.p95Ms).join(' | ')+' | '+x.worstP95Ms+' | '+(x.under1000Ms?'PASS':'FAIL')+' |').join('\n');
 const performance=d.performanceScreeningPass?'PASS in this 30k SQL screen':'BLOCKER: at least one 30k RPC case exceeds 1000ms';
 write(report,'# Round57 — 30k mixed distribution and capacity load evidence\n\n'
 +'## Why this package exists\n\nRound49 proved same-run repeatability only around the 3k/4k scale. P6 cannot claim growth readiness from that. This package uses the exact frozen rollout candidate on a disposable PKG045b predecessor and adds 30,000 synthetic public Needs: 12k coincident dense, 12k sparse world-distributed, 3k remote and 3k on-site without a public point. Three thousand rows carry one selected slot so the two-person availability path is exercised.\n\n'
 +'## Method and correctness\n\nSource '+source+'; Actions run '+run+'. No live DEV mutation. Candidate SHA256 '+d.sourceHashes['supabase/candidates/p6_discovery_rollout.sql']+'. Every timed read runs as authenticated with RLS active and normal replication mode. PAGE_ALL must report exactly30,000 and emit <=50 rows. PAGE_PEOPLE2 must report27,000. MAP_DENSE and MAP_SPARSE each account for all12,000 spatial tasks and emit <=256 server buckets. PLACES_SPARSE emits <=30 locality facets while its exact everywhere count remains30,000. EXACT_PUBLIC returns one exact public Need. SCAN and COVERAGE_SCAN are diagnostic controls, not product readers. Every sampled response equals its initially frozen authoritative payload after observation timestamps only.\n\n'
 +'Eight cases x three blocks x30 samples =720 measured calls after three warmups/case. Percentiles are nearest-rank per block; no pooled p95. One backend connection, warm cache, no network/native render/concurrency. Statement timeout remains30 seconds; a timeout fails the evidence rather than being omitted.\n\n'
 +'| Case | Block1 p95 ms | Block2 p95 ms | Block3 p95 ms | Worst p95 ms | <=1000ms |\n| --- | ---: | ---: | ---: | ---: | --- |\n'+rows+'\n\n'
 +'Performance screening: **'+performance+'**. Same-run RPC p95 spread <=25% for all six RPC cases: '+d.sameRunnerStabilityPass+'. The 1000ms number is the existing SQL screening ceiling, not a final network/device SLA. A correctness evidence PASS does not turn a failed performance screen into readiness.\n\n'
 +'## Limits and next action\n\nThis is 30k stored synthetic Needs, not 30k concurrent users. It is SQL-only, warm-cache and single-connection. HTTP concurrency, cold-cache, network, render, map memory and Android/iOS remain separate. Canonical DEV, provider flags and production routes were untouched.\n\n'
 +'P6 remains OPEN. If the30k screen fails, optimize the measured blocker against the retained controls/plans before rollout rather than lowering the threshold. If it passes, proceed to guarded production-route/native candidate preparation while retaining the PKG045b and live-apply gates. Do not start another major phase.\n');
 const t=JSON.parse(read('docs/control/redovi.json'));
 t.finalization.p6_owner_stop={date:'2026-09-29',instruction:'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',evidence:report,completed:false};
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round57={source,run,syntheticNeeds:30000,samples:720,performanceScreeningPass:d.performanceScreeningPass,sameRunnerStabilityPass:d.sameRunnerStabilityPass,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.performance='Round57 30k mixed dataset /720 SQL samples: RPC <=1000ms all blocks '+d.performanceScreeningPass+'; same-run spread<=25% '+d.sameRunnerStabilityPass+'. SQL-only, warm, concurrency1; native/network open.';
  f.test=(f.test||'')+' Round57 '+source.slice(0,8)+' / run'+run+':30k correctness, dense/sparse/map/place/capacity/exact + diagnostic controls;720 samples PASS evidence.';
  f.status=d.performanceScreeningPass?'P6 30K SQL SCREEN PASS / LIVE ROUTE+NATIVE OPEN':'P6 30K PERFORMANCE BLOCKER / OPTIMIZATION REQUIRED / LIVE ROUTE+NATIVE OPEN';
  row.sledece=d.performanceScreeningPass?'P6 only: guarded production route/native candidate, compatible-device PKG045b gate, live apply then FULL/memory/ANR acceptance.':'P6 only: diagnose/repair 30k SQL blocker using retained controls; rerun exact 30k proof before rollout/native closure.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md','FINALIZATION ROUND57 (2026-09-29): P6 30k mixed distribution/capacity proof at '+source+', run'+run+';720 authenticated RLS-active SQL samples. Performance screen '+d.performanceScreeningPass+', same-run stability '+d.sameRunnerStabilityPass+'. No DEV/native/production switch. P6 OPEN; owner stop condition binding. Read '+report+'.\n\n'+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
