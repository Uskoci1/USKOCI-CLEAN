'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_47_P6_COST_OPTIMIZATION.md',receipt=dir+'/ROUND_47_P6_COST_COMPARE.json';
const extra=['p6-paired-samples.json','p6-optimized-plans.json','p6-needs-column-detail.json'];
function verify(){
 const allowed=new Set([report,receipt,...extra.map(x=>dir+'/round47/'+x),'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'P6 production wiring forbidden');
}
function record(){
 const d=JSON.parse(read('/tmp/p6-discovery-evidence/p6-cost-compare-receipt.json'));
 assert.equal(d.result,'PASS');assert.equal(d.sourceSha,git('rev-parse','HEAD'));assert.equal(d.measuredSamples,240);
 assert.equal(d.normalizedPayloadParity,true);assert.equal(d.internalPlans,true);assert.equal(d.checks.length,13);assert(d.checks.every(x=>x.result==='PASS'));
 assert.equal(d.liveAccess,false);assert.equal(d.serverApplied,false);assert(read('/tmp/p6-discovery-evidence/stages.txt').includes('teardown exit=0'));
 const run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);assert(!fs.existsSync(report)&&!fs.existsSync(receipt));
 fs.mkdirSync(dir+'/round47',{recursive:true});for(const name of extra)fs.copyFileSync('/tmp/p6-discovery-evidence/'+name,dir+'/round47/'+name);
 write(receipt,JSON.stringify({...d,run,teardown:'PASS',evidencePaths:extra.map(x=>dir+'/round47/'+x)},null,2)+'\n');
 const rows=d.summary.map(x=>`| ${x.mode} | 30 + 30 | ${x.before.p95Ms} | ${x.after.p95Ms} | ${x.after.maxMs} | ${x.after.screeningBudgetPass?'PASS':'FAIL'} |`).join('\n');
 write(report,`# Round47 — remove unnecessary P6 work with paired response and timing proof

## Problem / evidence

Round46 measured SQL p95 PAGE 1019.168ms, MAP 1065.423ms and PLACES 1202.442ms on 4004 total / 3000 matching synthetic Needs. Those three cases failed the 1000ms SQL screening ceiling; EXACT was 2.655ms. Internal plans showed base projection across all 4004 rows, repeated map representative Unique nodes (160 loops) and locality representative Unique nodes (53 loops). No JIT or storage-I/O cause was inferred: costs, buffers and loops were measured, while per-node timing was deliberately off.

## Product / contract / implementation

A guarded source-only delta, supabase/candidates/p6_discovery_cost_v2.sql, layers on the exact original p6_discovery_all.sql. It changes only three newly proposed P6 function bodies after strict predecessor hashes and exact replacement checks. It does not edit covered_slots, closure/world guards, ACL/RLS, certificate definitions or live packages. Public response shapes, sorting, cursors, counts and selection-time authority remain unchanged.

Capacity is evaluated over the whole qualifying set only when a multi-person filter actually needs it; TaskCard/EXACT projection still uses authoritative coverage, once per returned row. Date work is skipped only for MAP/PLACES with no date filter, never for PAGE availability. Null/empty and remote locality fast paths avoid unused normalization. Map/locality representatives are materialized once, and a facet's normalized key is calculated once rather than repeatedly. This is not permission to omit facts or trust a cached selection result.

## Exact proof and measured result

Source ${d.sourceSha}; Actions run ${run}. All 13 SQL groups PASS, including the original 11 correctness/authorization/rollback groups, helper/filter parity and 240 paired timed calls. The original candidate is cloned only by a documented public P6 helper/RPC namespace rename; its helper bodies stay original, so the comparison is not an old RPC accidentally using optimized helpers. Both variants query the same transaction, synthetic actors, data and authorization.

The additional helper matrix covers 300 area/city/remote combinations and 10 unquote values. Filter comparisons cover people, date and remote/on-site contexts. Two selected-slot fixtures verify that a late EXACT projection keeps real nonzero coverage; they are math fixtures, not marketplace selection E2E. Every warmup and timed response is compared against the original full payload, removing only asOf/counts.observedAt and retaining a common legitimate anchor. No prices, IDs, counts, permissions or cursor fields are dropped from comparison.

| Mode | Before + after samples | Before p95 ms | After p95 ms | After max ms | After SQL <=1000ms |
| --- | --- | --- | --- | --- | --- |
${rows}

Screening ${d.screeningBudgetPass?'PASS':'FAIL'}; at least 10% p95 reduction in all three collection modes: ${d.improvementProven?'YES':'NO'}. These are nearest-rank, single-connection, warm SQL measurements, with five warmups per case/variant and alternating before/after order. Environment: ${d.measurementEnvironment.postgres}, ${d.measurementEnvironment.os}, ${d.measurementEnvironment.cpuCount} reported CPUs. No HTTP transfer, concurrent traffic, native render, cold-cache or 30000-scale claim is made. Optimized nested ANALYZE BUFFERS plans, original/optimized samples and exact hashes are retained under round47/.

## Scoped current-column diagnostic

Fresh read-only DEV column hashes at ${d.columnComparison.observedAt} cover 41 Need columns. Isolated pre045b comparison has ${d.columnComparison.actualColumns} columns and ${d.columnComparison.differences.length} per-column difference(s). Read the receipt and column-detail artifact rather than treating an aggregate hash mismatch as a known schema cause. All live definitions remain unchanged. The existing conditional PKG045b compatible-device rollout gate remains; no new broad approval is requested or exercised.

## Backend / rollback / limits / control

No canonical DEV apply, provider or device action, native dependency, money/flag change or production reader wiring. Original before-apply function/policy/ACL/certificate checks and transaction rollback pass; disposable stack teardown without backup passes. The original Round44 and Round45 receipts remain exact historical evidence; actual Auth/PostgREST must be refreshed against the optimized candidate before rollout. This package is not native, latest-ledger or store acceptance.

Existing B04/B05 control rows are reconciled and node scripts/control/osvezi.mjs generates their views. Hosted publication is not established. P6 remains OPEN. Next work: resolve the precise column comparison, refresh actual HTTP/negative-auth proof for the optimized candidate, cover sparse/dense and larger-volume/capacity-filter timing, then paging owner/stale fences/map/locality adapters and exact native acceptance. Apply still requires fresh canonical preconditions and the existing owner/certificate procedure.
`);
 const t=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round47={source:d.sourceSha,run,samples:240,parity:true,sqlScreening:d.screeningBudgetPass,improved:d.improvementProven,applied:false,native:false,columnDifferences:d.columnComparison.differences.length};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.performance='Round47 paired before/after SQL: 30 samples per mode per variant, same skewed 3000-matched fixture, full normalized payload parity; SQL1000ms '+(d.screeningBudgetPass?'PASS':'FAIL')+'. Network/native/concurrency/larger distributions still open.';
  f.backend='P6 original plus guarded cost_v2 delta: no existing authority/ACL change, not live-applied. Optimized real HTTP checkpoint and known PKG045b compatible-device rollout still required.';
  f.test+=' Round47 '+d.sourceSha.slice(0,8)+' / run'+run+': 13 SQL groups PASS; 240 paired timings; helper/filter/nonzero coverage parity; nested plans retained.';
  f.status='P6 OPTIMIZED SQL PARITY PASS / SCREENING '+(d.screeningBudgetPass?'PASS':'FAIL')+' / HTTP REFRESH+SCALE+NATIVE OPEN';
  row.sledece='Review Round47 column difference; real HTTP refresh for cost_v2; further distributions/capacity cost and paging/map/facet adapters before native/rollout. Keep P6 wiring off.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md',`FINALIZATION ROUND47 (2026-09-28): guarded P6 cost_v2 delta at ${d.sourceSha}, run${run};13 SQL groups and240 paired samples PASS, full normalized payload parity. SQL1000ms screening ${d.screeningBudgetPass?'PASS':'FAIL'}, collection improvement ${d.improvementProven?'PROVEN':'NOT_PROVEN'}. Read ${report}. No DEV/provider/native/production wiring. Optimized HTTP refresh and PKG045b compatible-device gate remain.\n\n`+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
