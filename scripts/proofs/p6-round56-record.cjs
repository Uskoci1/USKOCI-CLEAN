'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_56_P6_DEPLOYABLE_SERVER_CANDIDATE.md',receipt=dir+'/ROUND_56_P6_DEPLOYABLE_SERVER_CANDIDATE_CHECKS.json';

function verify(){
 const allowed=new Set([report,receipt,'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])
  assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'Production P6 wiring still forbidden');
}

function record(){
 const path='/tmp/p6-discovery-evidence/p6-rollout-candidate-receipt.json';
 const d=JSON.parse(read(path)),http=JSON.parse(read('/tmp/p6-discovery-evidence/p6-http-latest-receipt.json'));
 assert.equal(d.result,'PASS');assert.equal(d.sourceSha,git('rev-parse','HEAD'));
 assert.equal(d.liveAccess,false);assert.equal(d.serverApplied,false);assert.equal(d.native,false);assert.equal(d.p6Finished,false);
 assert.equal(d.currentDevAdmissible,false);assert.equal(d.currentDevObservation.pkg045bApplied,false);
 assert.equal(d.currentDevObservation.ledgerCount,210);assert.equal(d.postApply.exactBodyMatch,true);
 assert.equal(d.postApply.certificateUnchanged,true);assert.equal(d.postApply.needsAclUnchanged,true);
 assert.equal(d.repeatApply,'REFUSED_WITHOUT_DRIFT');assert.equal(Object.keys(d.expectedFinalBodyMd5).length,7);
 assert.equal(http.result,'PASS');assert.equal(http.actualAuth,true);assert.equal(http.postgrestProven,true);assert.equal(http.clientWireProven,true);
 assert.equal(read('/tmp/p6-discovery-evidence/stages.txt').includes('teardown exit=0'),true);
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 d.run=run;d.teardown='PASS';d.candidatePath='supabase/candidates/p6_discovery_rollout.sql';
 d.candidateSha256=hash(d.candidatePath);write(receipt,JSON.stringify(d,null,2)+'\n');
 write(report,'# Round56 — deployable P6 server candidate frozen; current DEV intentionally inadmissible\n\n'
 +'## Product / rollout decision\n\nThe proved P6 server stack is now frozen as one deployment candidate: supabase/candidates/p6_discovery_rollout.sql. It is not a live migration and was not applied to canonical DEV. The candidate composes the exact four-mode Round44 source plus the proved cost_v2/cost_v3 deltas, then enforces deployment preconditions and postconditions in the same transaction. Candidate SHA256: '+d.candidateSha256+'.\n\n'
 +'The candidate deliberately requires the PKG045b column-privacy boundary to be already active. It refuses the broad predecessor. That dependency is intentional: the real local Auth/PostgREST proof and all later P6 SQL proofs were run on the restricted target, and P6 must not become a reason to preserve the three directly readable internal Need columns. PKG045b was previously owner-approved only after compatible-device verification; that device condition is still not evidenced here. No duplicate approval is requested and no apply is attempted.\n\n'
 +'## Exact disposable proof\n\nTested source '+source+'; Actions run '+run+'. The workflow reconstructs the approved historical predecessor through PKG045b on a disposable local Supabase stack. The exact base+v2+v3 stack first passes the refreshed real local Auth/PostgREST/current-decoder harness: 11 groups, '+http.authenticatedAccounts+' distinct authenticated sessions and '+http.localHttpRequests+' local HTTP requests. Candidate functions are removed by that harness before deployment-candidate testing.\n\n'
 +'A separate transaction then builds the expected seven normalized function-body MD5 values from the exact proved stack and rolls it back. The frozen deployment candidate is applied normally and committed on the disposable stack. All seven installed body hashes equal that expected stack exactly. Every P6 function remains SECURITY INVOKER with fixed pg_catalog, authenticated EXECUTE only; anon/service_role execute is absent. The Need ACL and closure certificate/digest do not move. A second application is refused as P6_ROLLOUT_ALREADY_INSTALLED, followed by exact no-drift readback. Teardown without backup PASS.\n\n'
 +'## Fresh canonical DEV observation\n\nRead-only observation '+d.currentDevObservation.observedAt+': PostgreSQL '+d.currentDevObservation.postgresVersion+', ledger '+d.currentDevObservation.ledgerCount+', rpc_discovery_v1(jsonb) absent, covered_slots normalized body MD5 '+d.currentDevObservation.coveredSlotsNormalizedBodyMd5+', closure source/erasure certificate '+d.currentDevObservation.closureSourceSha256+'. Authenticated still has whole-table Need SELECT and the internal requester/remaining-search columns; therefore PKG045b is not applied. No private rows were read.\n\n'
 +'This means current DEV is not yet an admissible predecessor for the P6 rollout candidate. The refusal is a safety gate, not a failure to prepare P6. Compatible app/native verification must happen before the already-approved conditional PKG045b application, and P6 live apply still requires its package-specific fresh-precondition/authorization procedure.\n\n'
 +'## What this does not close\n\nNo canonical DEV mutation, ledger row, provider, route switch, APK/IPA or native acceptance occurred. This package does not prove wider distributions/concurrency/30k performance, production map/list/FULL return, or memory/ANR. P6 remains OPEN.\n\n'
 +'Next P6 work: larger sparse/dense/skewed/capacity/load measurements against the exact rollout bytes and a guarded native-route candidate. Then verify the compatible app condition for PKG045b, obtain/execute the specific P6 server-apply procedure when all apply gates are ready, switch the reader, and run exact native FULL-return/memory/ANR acceptance. Do not move to another major phase.\n');
 const t=JSON.parse(read('docs/control/redovi.json'));
 t.finalization.p6_owner_stop={date:'2026-09-29',instruction:'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',evidence:report,completed:false};
 for(const id of ['B04','B05']){
  const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round56={source,run,deployableCandidate:true,candidateSha256:d.candidateSha256,exactBodies:true,httpRefresh:true,
    currentDevAdmissible:false,pkg045bLive:false,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.backend='Round56 freezes exact deployable P6 bytes and proves body/ACL/certificate equivalence on disposable PKG045b target. Current DEV ledger210 has no P6 and no PKG045b; no live apply.';
  f.test=(f.test||'')+' Round56 '+source.slice(0,8)+' / run'+run+': 11 real local Auth/PostgREST/current-decoder groups; exact seven-function rollout equivalence, idempotent refusal, certificate/ACL no-drift PASS.';
  f.status='P6 DEPLOYABLE SERVER CANDIDATE PROVEN / LIVE PKG045B+P6 APPLY+LOAD+NATIVE OPEN';
  row.sledece='P6 only: wider large/distribution/capacity/load proof on frozen rollout bytes; guarded native route candidate; satisfy compatible-device PKG045b gate before any live apply.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md','FINALIZATION ROUND56 (2026-09-29): frozen deployable P6 server candidate at '+source+', run'+run+', candidate SHA256 '+d.candidateSha256+'. Exact seven function bodies match proved base+cost_v2+cost_v3; local real Auth/PostgREST/current-decoder 11 groups PASS; certificate and Need ACL unchanged; repeat apply refuses. Fresh canonical DEV remains ledger210, P6 absent, PKG045b absent/broad Need grants, so live rollout is deliberately inadmissible. No DEV/native/production wiring. P6 OPEN; owner stop condition binding. Read '+report+'.\n\n'+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
