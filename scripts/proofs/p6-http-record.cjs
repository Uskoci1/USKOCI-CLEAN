'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_45_P6_HTTP_BOUNDARY.md',receipt=dir+'/ROUND_45_P6_HTTP_CHECKS.json';
function verify(){
 const allowed=new Set([report,receipt,'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside package: '+p);
 for(const p of git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean))assert(allowed.has(p),'Unexpected untracked: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'P6 production wiring forbidden');
}
function record(){
 const d=JSON.parse(read('/tmp/p6-discovery-evidence/p6-http-boundary-receipt.json'));
 assert.equal(d.result,'PASS');assert.equal(d.sourceSha,git('rev-parse','HEAD'));
 for(const key of ['actualAuth','postgrestProven','clientWireProven','localCandidateRemoved'])assert.equal(d[key],true,key);
 assert.equal(d.liveAccess,false);assert.equal(d.providerCalled,false);assert.equal(d.authenticatedAccounts,3);
 assert.equal(d.checks.length,11);assert(d.checks.every(c=>c.result==='PASS'));
 const stages=read('/tmp/p6-discovery-evidence/stages.txt');assert(stages.includes('teardown exit=0'));
 const run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);assert(!fs.existsSync(report)&&!fs.existsSync(receipt));
 write(receipt,JSON.stringify({...d,run,teardown:'PASS',liveApplied:false,scaleReady:false,releaseReady:false},null,2)+'\n');
 write(report,`# Round45 — real local Auth / PostgREST / current client wire

## Problem / user impact and decision

SQL role switching does not exercise GoTrue JWT issuance, HTTP role selection, PostgREST schema discovery, or the actual client decoder. The four-mode candidate remains quarantined until these boundaries and query cost/native ownership are proven. This package tests the first boundary without changing product screens or connecting the production reader.

## Exact implementation and proof

Tested commit ${d.sourceSha}; Actions run ${run}; 11 boundary groups PASS. Three distinct disposable users are created through the local Auth admin API solely as fixtures; three password logins and getUser reads establish real user JWTs. The service key is never used for marketplace reads. Four PUBLISHED and two non-public fixtures have a private sentinel; PAGE, EXACT_PUBLIC, MAP and PLACES go through actual anon-key authenticated PostgREST requests and the checked-out strict TypeScript decoders. PAGE and PLACES traverse real cursors; all three accounts must see only public exact tasks. Anonymous calls in every mode, malformed JWT, excessive limits, null input, the private account-ID column and other people's sensitive address rows are refused or hidden by the existing boundary.

The local candidate bytes are bound to Round44 SHA256 1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e. No SQL semantic change is made here. The runner allows only explicit loopback Auth/REST origins with redirects rejected. Fixture writes do not retry automatically. Public output contains hashes, boolean checks and counts, not passwords, JWTs, service keys, rows or addresses.

## Backend / environment / cleanup

Historical source147 plus PKG045b disposable baseline, not current DEV compatibility acceptance. Actual local PostgreSQL ${d.localPostgresVersion}, Node ${d.nodeVersion}, ${d.localHttpRequests} local HTTP requests. Candidate functions are added only to the disposable stack, then explicitly removed. Existing public/private function definitions, ACL/RLS, column grants and closure certificate/readiness fingerprints are unchanged after removal. The isolated stack is stopped with no backup; test identities and rows do not leave it. No canonical DEV package, ledger write, paid provider, push flag, native dependency or payment change is involved.

## Checks / limits / regression

The 11 Round44 SQL groups remain separate exact-source evidence on 7b75631b, run36443089843. The previous malformed city fixture and aggregate PLACES-loop timeout remain historical failures, not retroactive successes. Round43's 347 suites / 7299 tests cover its exact client source; this SQL/HTTP harness does not claim a fresh full app regression or native pass.

Actual local Auth PASS is NOT signup/email-provider N02 PASS, password-recovery acceptance, application session A→B→A, or a two-user marketplace journey. Admin confirmation is fixture setup, not proof of delivered email. Removing local test resources is NOT product account deletion. Small HTTP fixtures are not performance/load or native acceptance.

## Control / status / next highest-impact action

B04/B05 are reconciled and the existing control generator runs before commit. Hosted control publication remains unverified. Status: P6 FOUR-MODE SQL + LOCAL AUTH/POSTGREST/CURRENT WIRE PASS; NOT APPLIED; NOT WIRED; P6 OPEN.

Next: current-predecessor compatibility and internal EXPLAIN ANALYZE BUFFERS, measured 30-sample query budgets across sparse/dense/skewed datasets, then paging ownership, stale-request fences and native map/locality adapters. Device tests, exact provider delivery, whole-app privacy/legal and stores remain separate. No owner approval is requested for mere proof preparation; a later canonical live apply still needs its specific authorization and procedure.
`);
 const data=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){
  const row=data.redovi.find(r=>r.id===id);assert(row);const f=row.finalization;
  f.round45={source:d.sourceSha,run,actualAuth:true,postgrest:true,currentClientWire:true,authenticatedAccounts:3,applied:false,native:false,queryCost:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.backend='P6 four-mode candidate: Round44 disposable SQL and Round45 real local Auth/PostgREST/current decoder proof PASS on historical PKG045b. No current-DEV compatibility acceptance, live apply, production reader wiring or query-cost/native proof.';
  f.test+=' Round45 '+d.sourceSha.slice(0,8)+' / run'+run+': 11 real local Auth/PostgREST/wire groups PASS, 3 distinct password sessions, no N02 email/provider or native acceptance.';
  f.status='P6 SQL+LOCAL AUTH+POSTGREST+WIRE PASS / CURRENT BASELINE+QUERY COST+ADAPTER+NATIVE PENDING';
  row.sledece='Current-predecessor compatibility and internal query-cost/performance proof; then paging owner/stale fences/map/facet adapters and exact native large-data acceptance. Keep P6 production wiring off.';
 }
 write('docs/control/redovi.json',JSON.stringify(data,null,2)+'\n');
 write('AGENTS.md',`FINALIZATION ROUND45 (2026-09-28): P6 real LOCAL Auth/PostgREST/current client wire proof PASS at ${d.sourceSha}, run${run}; 11 groups, 3 distinct password sessions. Read ${report}. Historical PKG045b only; no current DEV apply/compatibility, query cost, native or N02 email proof. Candidate removed and stack teardown PASS. Production Discovery remains on existing reader.\n\n`+read('AGENTS.md'));
}
if(process.argv[2]==='verify')verify();else if(process.argv[2]==='record')record();else throw Error('Expected verify/record');
