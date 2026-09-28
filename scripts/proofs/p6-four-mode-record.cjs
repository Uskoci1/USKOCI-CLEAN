'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_44_P6_FOUR_MODE_SQL.md',receipt=dir+'/ROUND_44_P6_FOUR_MODE_CHECKS.json';
const generated=['supabase/candidates/p6_discovery_all.sql','supabase/proofs/discovery/p6_discovery_all_proof.sql','supabase/proofs/discovery/p6_discovery_all_run.mjs'];
function verify(){
 const allowed=new Set([...generated,'scripts/proofs/p6-four-mode-builder.py','scripts/proofs/p6-four-mode-record.cjs','supabase/proofs/discovery/p6_discovery_spatial_cases.sql','.github/workflows/p6-four-mode-proof.yml',report,receipt,'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside package: '+p);
 for(const p of git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean))assert(allowed.has(p),'Unexpected untracked file: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'Production P6 wiring remains forbidden');
}
function record(){
 const data=JSON.parse(read('/tmp/p6-discovery-evidence/p6-discovery-receipt.json'));
 assert.equal(data.result,'PASS');assert.equal(data.sourceSha,git('rev-parse','HEAD'));assert.equal(data.actualDatabase,true);assert.equal(data.sqlAuthenticatedRoles,true);
 assert.equal(data.checks.length,11);assert(data.checks.every(x=>x.result==='PASS'));assert.equal(data.liveAccess,false);assert.equal(data.providerCalled,false);
 const run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={...data,run,generatedStandaloneCandidate:true,productionWired:false,serverApplied:false,storeReady:false,sourcePublication:'CI fast-forward step must be independently verified',historicalPredecessor:'147 frozen sources plus PKG045b replay, not current live DEV',limits:['No actual Auth/PostgREST boundary proof','No internal EXPLAIN ANALYZE BUFFERS or percentile budget','No native map/facet adapter or large-data device proof','No live application authorization requested or exercised']};
 assert(!fs.existsSync(report)&&!fs.existsSync(receipt),'Round44 already exists');write(receipt,JSON.stringify(facts,null,2)+'\n');
 write(report,`# Round44 — four-mode P6 disposable SQL candidate

## Problem / user impact

The source-only candidate previously implemented PAGE and EXACT_PUBLIC, while MAP and PLACES only had strict client decoders. Paging one list page cannot substitute for complete spatial coverage or complete locality suggestions. The production reader remains unchanged.

## Product / contract decisions

PAGE/EXACT retain the existing predicates, public projection, microsecond keyset and capacity authority. MAP adds required bounds and grid (integer 1–24), reduces a world-anchored grid until the entire coverage fits at most 256 cells, groups every qualifying public point, and emits TASK / coincident PLACE / CLUSTER. A representative is a real newest public member point, never private coordinates or a fabricated centroid. Wrapped/equal/world-edge coverage is explicit; point-free/remote rows affect counts, never spatial membership.

PLACES adds required prefix, facetArea (bounds or null), limit 1–30 and after (null or count+text+key). Incoming task text/selected locality are deliberately removed from facet predicates. Other work/time/price/capacity filters remain. Prefix is literal normalized substring, not SQL wildcard search. Every sort component participates in the keyset. Serbian display collation is followed by the normalized key. The PLACES anchor additionally binds prefix and facetArea; changing either starts a new paging sequence. Counts are exact-live, not a frozen marketplace snapshot.

## Implementation / files

Standalone candidate: supabase/candidates/p6_discovery_all.sql. Standalone proof and runner: supabase/proofs/discovery/p6_discovery_all_proof.sql and p6_discovery_all_run.mjs. The bounded builder pins and preserves the previous candidate/proof/runner, writes separate reviewable files, and commits them before execution. Existing frozen migrations, authority functions, ACL/RLS, certificates and old failure evidence are untouched.

## Checks / exact source

Tested source ${data.sourceSha}; Actions run ${run}; ${data.checks.length} SQL groups PASS. The 208 vectors execute current client text/time/filter semantics. The original 1004-row PAGE/EXACT traversal remains covered. Additional MAP datasets 0/1/100/1000/3000 include 1500 coincident tasks, sparse points, 50 on-site point-free tasks and 50 remote tasks. The complete locality set is traversed three entries at a time with count/text/key order and no duplicates or omissions. Authenticated SQL role, anon/auth-null refusal, unchanged existing authority and transaction rollback checks remain. Exact source hashes and narrower proof flags are in the JSON receipt.

These are functional SQL proofs on the historical disposable PKG045b predecessor. They are not actual Auth/PostgREST, live latest-DEV compatibility, internal query-cost measurements, native speed/memory or release acceptance. The known client protocol checks remain quarantined. A functional 3000-row pass does not prove readiness for 30000 users/tasks or concurrent production traffic.

## Backend / application / rollback

No DEV/Edge/provider call or live mutation is performed by this package. The generated candidate requires the explicit disposable marker and postgres; it is not a canonical deployment migration. SQL changes and synthetic fixtures roll back together, and the isolated stack is stopped without retaining it. A later live package still requires fresh definitions/ACL/certificate preconditions, complete boundary/performance proof, specific authorization where required, canonical apply/readback and ledger receipt. No fake ledger row is created.

## Control / publication / status / next action

B04/B05 are updated and the existing generator must run before committing its output. Hosted control publication is not proven. Status: FOUR-MODE SQL CANDIDATE PROVEN ON DISPOSABLE HISTORICAL BASELINE; NOT APPLIED; NOT WIRED; P6 OPEN.

Next: complete real Auth/PostgREST and current-predecessor compatibility, internal EXPLAIN ANALYZE BUFFERS with measured datasets and budgets, stale-request/paging ownership and map/locality adapters. Then an exact Android/iOS large-data checkpoint. No owner approval is needed merely to prepare those proofs; live apply, new native dependencies and paid providers remain separate boundaries.
`);
 const tracker=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){
  const row=tracker.redovi.find(r=>r.id===id);assert(row);const f=row.finalization;
  f.round44={tested_source:data.sourceSha,run,sql_groups:11,actualAuth:false,postgrest:false,queryCost:false,device:false,applied:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.backend='P6 four-mode standalone candidate and disposable SQL proof now exist; 11 groups including preserved PAGE/EXACT and bounded MAP/PLACES pass on historical PKG045b. No live apply, production wiring, Auth/PostgREST or current-DEV compatibility acceptance.';
  f.performance='Functional datasets 0/1/100/1000/3000 prove bounded complete map coverage; not latency/load/memory acceptance. Internal EXPLAIN ANALYZE BUFFERS, 30-sample budgets and current native remain.';
  f.test+=' Round44 '+data.sourceSha.slice(0,8)+' / run'+run+': 11 SQL groups PASS; 208 client vectors; 1004-row PAGE and 3000-row spatial fixtures. SQL roles are not real Auth/PostgREST.';
  f.status='P6 FOUR-MODE DISPOSABLE SQL PASS / AUTH+QUERY COST+ADAPTER+NATIVE PENDING / NOT APPLIED';
  row.sledece='Real Auth/PostgREST/current-predecessor compatibility and internal query-cost proof; then paging owner/map/facet adapters and native large-data acceptance. Keep production reader unchanged until gates close.';
 }
 write('docs/control/redovi.json',JSON.stringify(tracker,null,2)+'\n');
 write('AGENTS.md',`FINALIZATION ROUND44 (2026-09-28): four-mode P6 standalone candidate on ${data.sourceSha}, run${run}, 11 disposable SQL groups PASS. Read ${report}. Historical PKG045b predecessor only; no actual Auth/PostgREST/current DEV apply/query cost/native proof, no production wiring. PAGE/EXACT historical proof retained; MAP 0/1/100/1000/3000 and PLACES complete count/text/key paging added. P6 remains OPEN.\n\n`+read('AGENTS.md'));
}
if(process.argv[2]==='verify')verify();else if(process.argv[2]==='record')record();else throw Error('Expected verify/record');
