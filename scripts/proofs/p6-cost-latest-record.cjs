'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_48_P6_LAZY_LOCALITY.md',receipt=dir+'/ROUND_48_P6_COST_CHECKS.json';
const files=['p6-paired-samples.json','p6-optimized-plans.json','p6-needs-column-detail.json','p6-normalized-catalog.json','p6-http-latest-receipt.json','p6-function-profile.json'];
function verify(){
 const allowed=new Set([report,receipt,...files.map(x=>dir+'/round48/'+x),'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'P6 wiring forbidden');
}
function record(){
 const d=JSON.parse(read('/tmp/p6-discovery-evidence/p6-cost-latest-receipt.json'));
 assert.equal(d.result,'PASS');assert.equal(d.sourceSha,git('rev-parse','HEAD'));assert.equal(d.measuredSamples,240);
 for(const key of ['normalizedPayloadParity','internalPlans','explicitRangeParity','textShortcutParity'])assert.equal(d[key],true,key);
 assert.equal(d.checks.length,13);assert(d.checks.every(x=>x.result==='PASS'));assert.equal(d.liveAccess,false);assert.equal(d.serverApplied,false);
 const h=JSON.parse(read('/tmp/p6-discovery-evidence/p6-http-latest-receipt.json'));
 assert.equal(h.result,'PASS');assert.equal(h.sourceSha,d.sourceSha);assert.equal(h.authenticatedAccounts,3);assert.equal(h.checks.length,11);
 for(const key of ['actualAuth','postgrestProven','clientWireProven','localCandidateRemoved'])assert.equal(h[key],true,key);
 assert.equal(h.liveAccess,false);assert.equal(h.providerCalled,false);
 d.httpRefresh={source:h.sourceSha,actualAuth:true,postgrest:true,clientWire:true,groups:11,accounts:3,requests:h.localHttpRequests,generatedHarnessSha256:h.generatedHarnessSha256};
 d.limits=d.limits.filter(x=>!x.includes('real Auth/PostgREST refresh still required'));
 d.limits.push('Real local Auth/PostgREST refreshed in this same run; external email/push providers and native acceptance remain separate.');
 assert(read('/tmp/p6-discovery-evidence/stages.txt').includes('teardown exit=0'));
 const run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);assert(!fs.existsSync(report)&&!fs.existsSync(receipt));
 fs.mkdirSync(dir+'/round48',{recursive:true});for(const name of files)fs.copyFileSync('/tmp/p6-discovery-evidence/'+name,dir+'/round48/'+name);
 write(receipt,JSON.stringify({...d,run,teardown:'PASS',evidencePaths:files.map(x=>dir+'/round48/'+x)},null,2)+'\n');
 const rows=d.summary.map(x=>`| ${x.mode} | 30 + 30 | ${x.before.p95Ms} | ${x.after.p95Ms} | ${x.after.maxMs} | ${x.after.screeningBudgetPass?'PASS':'FAIL'} |`).join('\n');
 const matched=d.normalizedDependencyComparison.matches;
 write(report,`# Round48 — lazy locality work, full text parity and normalized dependency comparison

## Problem / cause / product decision

The original P6 candidate computed display locality for every public Need before filtering, even when a query was already satisfied by its title or no locality consumer existed. Round46/47 measurement showed that bounded output alone did not establish acceptable query cost. Preserve the original public payload, authorization, filter and counting semantics while avoiding unnecessary projection work.

## Implementation

New source-only delta supabase/candidates/p6_discovery_cost_v3.sql layers on the exact original plus cost_v2 and checks the preceding RPC body MD5 008c92e33b8edfbe3cc7b5263b99dac8. It changes only the proposed P6 RPC, not covered_slots, policies, grants, closure certificates or other canonical authority. Locality is still computed for PLACES, an active locality filter, or a text search not already satisfied by the title. The full original concatenated title/locality/capability substring search remains as fallback, including matches crossing field boundaries. No new native dependency or production reader call is added.

## Exact functional and measured proof

Source ${d.sourceSha}; Actions run ${run}. Original candidate bytes and both deltas are hash-bound. Thirteen SQL groups pass, including the original eleven groups, helper/filter/capacity parity and paired measurement. Explicit date ranges are checked separately and cannot enter the no-date fast path. Twenty additional PAGE/MAP text comparisons cover title, locality-only, title/locality boundary, wildcard literals, Serbian and Greek/Polish characters, remote labels, tool-only matching and empty text; two active locality-filter comparisons and an EXACT recheck accompany them.

Every measured response equals its original full payload after removing only observation timestamps and using a shared legitimate anchor. Both variants use the same synthetic actors, rows and current authorization in one transaction. 240 timed calls: 30 before and 30 after for each mode, alternating order, following five warmups per variant and mode. Original and optimized plans are not used as substitutes for measured duration.

| Mode | Before + after n | Original p95 ms | Latest p95 ms | Latest max ms | SQL <=1000ms screening |
| --- | --- | --- | --- | --- | --- |
${rows}

SQL screening ${d.screeningBudgetPass?'PASS':'FAIL'}; collection-mode p95 improvement threshold: ${d.improvementProven?'PASS':'NOT MET'}. Dataset remains 4004 total / 3000 matched Need rows, including 1500 coincident points, sparse points and point-free/remote work. PostgreSQL ${d.measurementEnvironment.postgres}, ${d.measurementEnvironment.cpuCount} reported CPUs, warm-cache single-connection SQL. These numbers exclude HTTP/network, authentication startup and native rendering. They do not prove concurrent production load, cold cache, all distributions, multi-person filter cost or 30000-scale readiness.

An additional PLACES-only function-cost diagnostic is ${d.functionProfileAvailable?'available':'unavailable because the existing local role cannot enable tracking'}. It runs after the 240 uninstrumented samples. It never grants a privilege or changes a canonical definition; only an already-permitted transaction-local tracking setting may be used. The retained function names/call counts/self and total times contain no user payload. One instrumented call is not a percentile, nested total time must not be summed, and inlined SQL functions are not tracked. Method: https://www.postgresql.org/docs/17/runtime-config-statistics.html .

## Current read-dependency comparison

The earlier aggregate column mismatch is retained in Round46/47 evidence. The detailed comparison identified approx_geog's deparsed expression as the difference: the local connection included extensions in search_path, so PostgreSQL printed unqualified function/type names; the DEV connection did not. This package sets search_path=public only inside the local read transaction and repeats the original fingerprint method without modifying schema or the stored observation.

Normalized comparison of eleven function bodies and columns/policies/indexes on seven read-dependency tables: ${matched?'MATCH':'DIFFERENCES REMAIN'}. Individual Need-column comparison: ${d.columnComparison.perColumnMatch?'41 MATCH':'DIFFERENCES REMAIN'}. This closes only those observed metadata dimensions, not current entire ledger/certificate/runtime/old-device acceptance. Catalog details and difference arrays are retained. DEV still has the known pending PKG045b compatible-device rollout condition; neither045b nor P6 is applied by this package.

## Backend / checks / limits / control

Original unchanged-authority/ACL/policy/certificate assertions and transaction rollback pass; stack teardown without backup passes. No real user data, provider, payment, push flag, live ledger, Android/iOS binary or visual surface is changed. The exact optimized stack also passes eleven real local Auth/PostgREST/current-decoder groups through three separate password sessions (${h.localHttpRequests} local HTTP requests). The frozen Round45 harness is reused via a hash-bound additive-stack wrapper, not altered retroactively; its generated bytes are bound in the new receipt. Candidate functions are removed and existing authority fingerprints match afterward. This is local Auth, not email-provider/signup proof. This is not a fresh full Jest/native result and not release readiness.

Existing B04/B05 rows and generated control outputs are updated through node scripts/control/osvezi.mjs. Hosted publication is unverified. P6 stays OPEN. Next: distribution/capacity/load budgets and current rollout compatibility, then paging ownership/stale fences/map/locality adapters and exact native acceptance. Any live package still requires fresh canonical preconditions and the established authorization procedure.
`);
 const t=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round48={source:d.sourceSha,run,samples:240,payloadParity:true,textParity:true,explicitRanges:true,normalizedDependencyMatch:matched,screening:d.screeningBudgetPass,httpRefresh:true,applied:false,native:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.performance='Round48 original vs cost_v2+v3: 240 paired SQL timings/full payload parity; SQL1000ms '+(d.screeningBudgetPass?'PASS':'FAIL')+'. Other distributions, capacity filters, concurrency and HTTP/native latency remain unmeasured.';
  f.backend='Scoped 11-function/7-table current read-dependency fingerprints after normalized expression deparse '+(matched?'MATCH':'DIFF')+'. Known045b compatible-device rollout remains. Latest optimized real local Auth/PostgREST/current wire PASS. No live P6 apply/wiring.';
  f.test+=' Round48 '+d.sourceSha.slice(0,8)+' / run'+run+': 13 SQL groups + explicit-range/text/locality parity; 240 samples; nested plans/rollback PASS.';
  f.status='P6 LAZY LOCALITY PARITY PASS / SQL SCREENING '+(d.screeningBudgetPass?'PASS':'FAIL')+' / HTTP REFRESH PASS / SCALE+NATIVE OPEN';
  row.sledece='Optimized HTTP now PASS; remaining distribution/capacity/performance and native/client adapters; retain045b compatible-device gate and production wiring quarantine.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md',`FINALIZATION ROUND48 (2026-09-28): P6 cost_v3 lazy locality at ${d.sourceSha}, run${run};13 SQL groups, explicit date/text parity and240 paired samples PASS. SQL1000ms ${d.screeningBudgetPass?'PASS':'FAIL'}; normalized scoped dependency comparison ${matched?'MATCH':'DIFF'}. Read ${report}. Not applied/wired/native/release; optimized local HTTP11 groups also PASS; scale/native/045b device rollout remain.\n\n`+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
