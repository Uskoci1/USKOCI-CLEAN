'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_46_P6_CURRENT_DEPENDENCY_AND_COST.md',receipt=dir+'/ROUND_46_P6_COST_CHECKS.json';
const extra=['p6-cost-samples.json','p6-internal-plans.json','p6-pre-column-catalog.json','p6-post-column-catalog.json'];
function verify(){
 const allowed=new Set([report,receipt,...extra.map(x=>dir+'/round46/'+x),'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'P6 production wiring forbidden');
}
function record(){
 const d=JSON.parse(read('/tmp/p6-discovery-evidence/p6-current-cost-receipt.json'));
 assert.equal(d.result,'PASS');assert.equal(d.sourceSha,git('rev-parse','HEAD'));assert.equal(d.measuredSamples,120);
 assert.equal(d.sqlGroups,11);assert.equal(d.queryPlansCaptured,true);assert.equal(d.liveAccess,false);assert.equal(d.serverApplied,false);
 assert.equal(d.summary.length,4);assert(d.summary.every(x=>x.n===30));assert(read('/tmp/p6-discovery-evidence/stages.txt').includes('teardown exit=0'));
 const run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);assert(!fs.existsSync(report)&&!fs.existsSync(receipt));
 fs.mkdirSync(dir+'/round46',{recursive:true});for(const file of extra)fs.copyFileSync('/tmp/p6-discovery-evidence/'+file,dir+'/round46/'+file);
 write(receipt,JSON.stringify({...d,run,teardown:'PASS',evidencePaths:extra.map(x=>dir+'/round46/'+x)},null,2)+'\n');
 const rows=d.summary.map(x=>`| ${x.mode} | ${x.n} | ${x.p50Ms} | ${x.p95Ms} | ${x.maxMs} | ${x.maxResponseBytes} | ${x.screeningBudgetPass?'PASS':'FAIL'} |`).join('\n');
 const match=d.dependencyComparison.matches?'MATCH in the declared fingerprint dimensions':'DIFFERENCES PRESENT; inspect the receipt before any current-baseline claim';
 const budget=d.screeningBudgetPass?'All four SQL screening cases fit 1000ms; this is not end-to-end acceptance.':'At least one SQL screening case exceeds 1000ms; P6 performance is NOT accepted.';
 write(report,`# Round46 — current read-dependency comparison and measured P6 query cost

## Problem / user impact / current baseline

Round44/45 covered an isolated historical target, not today's DEV. A fresh read-only canonical observation at 2026-09-28T16:00:41.850113Z and follow-up 16:01:15.571531Z confirm ledger210, PostgreSQL17.6, and whole-table/protected-column SELECT privileges still present for authenticated. PKG045b is not in the live ledger. This matches the existing documented conditional compatible-device rollout gate; it is not a new approval request or a claim that every row is exposed to every account. No private user rows were read.

The new harness replays historical042a/045a, compares11 relevant function bodies and columns/policies/indexes of7 read-dependency tables with those observations, then replays the already-frozen045b only on the disposable stack. Comparison: ${match}. This is scoped metadata, not an attestation of all current210 packages, certificates, constraints, consumer devices or runtime data.

## Implementation / exact checks

Source ${d.sourceSha}; Actions run${run}. New p6_current_cost.py, p6_cost_probe.sql, p6_dependency_snapshot.sql and typed evidence parser extend the existing11-group SQL proof without changing the candidate or original assertions. Candidate SHA256 remains1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e. Ten parser regressions reject insufficient/duplicate samples, non-finite timings, wrapper-only EXPLAIN and unsafe payload fields.

All11 original SQL groups passed with120 additional measured calls:30 per mode after5 unmeasured warmups. Each call is a separate top-level statement under the original60-second timeout; the earlier aggregate-loop timeout is not hidden by increasing it. ANALYZE is limited to the disposable fixture tables. Metadata, samples and public-safe nested plan trees are retained under round46/.

## Measurements (milliseconds; nearest-rank percentiles)

| Mode | n | p50 | p95 | max | Max JSON bytes | SQL <=1000ms screening |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

${budget}

Environment: ${d.measurementEnvironment.postgres}, ${d.measurementEnvironment.os}, ${d.measurementEnvironment.cpuCount} reported CPUs; ${d.measurementEnvironment.totalNeeds} total Need rows,3000 matching the skewed spatial fixture. PAGE/MAP use its task filter; PLACES intentionally ignores task text and uses the independent prefix. EXACT targets one original public fixture. Dataset includes1500 coincident points plus sparse and point-free work. Concurrency1; warm cache; SQL-only elapsed time excludes connection creation, HTTP/Auth, network and native rendering. Samples are collected before instrumentation. No cold-cache, percentile over unspecified networks, large-user-count or full-app performance claim is made.

For PAGE/MAP/PLACES, actual nested main-query plans are captured with auto_explain ANALYZE+BUFFERS and per-node TIMING OFF after sampling. The parser requires the candidate's internal WITH base query and real needs scan/row/loop/buffer nodes; SELECT rpc_discovery_v1(...) alone cannot pass. Published projections keep node structure and measurements but omit query text, filter constants, user IDs and output expressions. Query text is hash-bound instead. Official method: https://www.postgresql.org/docs/17/auto-explain.html .

## Backend / privacy / rollback / limits

No live apply, new certificate authorization, provider call, production reader wiring, native dependency or visual change. Historical045b movement remains confined to its disposable replay; all existing authority, policies and grants pass the original unchanged/rollback checks. Stack teardown without backup passed. Actual local Auth/PostgREST belongs to Round45's exact source; this package does not re-label it as new provider or device proof.

## Control / status / next highest-impact work

B04/B05 are updated and the existing generator runs before its views are committed. Hosted publication is not verified. P6 remains OPEN. Current SQL screening outcome: ${d.screeningBudgetPass?'PASS within this narrow scenario':'FAIL; optimize only after inspecting retained internal plans'}. The known live045b condition is a real device rollout boundary, not permission to force its old preconditions or rerun an applied package.

Next: resolve any dependency differences and diagnosed query hot spots in a separate reviewable candidate with semantic before/after proof; then sparse/dense/load budgets, paging ownership/stale fences, map/locality adapters and exact native acceptance. No owner action is needed for safe proof/candidate preparation. Live045b/P6 application, provider and devices retain their separate concrete gates.
`);
 const t=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){const r=t.redovi.find(x=>x.id===id);assert(r);const f=r.finalization;
  f.round46={source:d.sourceSha,run,dependencyMatch:d.dependencyComparison.matches,sqlSamples:120,internalPlans:true,screeningBudgetPass:d.screeningBudgetPass,live045b:false,applied:false,native:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.performance='Round46 actual SQL timing: 30 samples per PAGE/EXACT/MAP/PLACES, skewed fixture, nested ANALYZE BUFFERS. SQL1000ms screening '+(d.screeningBudgetPass?'PASS (not end-to-end acceptance)':'FAIL; optimize measured plan')+'. Native/network/load unproved.';
  f.backend='Fresh DEV ledger210 still has broad needs column grants; known PKG045b compatible-device gate remains. Scoped11-function/7-table fingerprint comparison '+(d.dependencyComparison.matches?'MATCH':'DIFF')+'. No live P6 apply or production wiring.';
  f.test+=' Round46 '+d.sourceSha.slice(0,8)+' / run'+run+': 11 SQL groups, 10 parser checks, 120 samples, 3 internal plans; correctness PASS is not performance acceptance.';
  f.status='P6 MEASURED / SQL SCREENING '+(d.screeningBudgetPass?'PASS':'FAIL')+' / 045B ROLLOUT+ADAPTER+NATIVE OPEN';
  r.sledece='Inspect Round46 dependency deltas/internal plans; fix measured P6 cost without changing authority; retain PKG045b device-rollout gate and keep production wiring off.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md',`FINALIZATION ROUND46 (2026-09-28): measured P6 SQL cost/source${d.sourceSha}, run${run};120 samples,11 SQL groups,3 internal ANALYZE BUFFERS plans. SQL1000ms screening ${d.screeningBudgetPass?'PASS':'FAIL'}; scoped current read-dependency comparison ${d.dependencyComparison.matches?'MATCH':'DIFF'}. Live DEV210 has NOT applied045b; existing conditional compatible-device gate remains. Read ${report}. No DEV/provider/native/wiring/release claim.\n\n`+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
