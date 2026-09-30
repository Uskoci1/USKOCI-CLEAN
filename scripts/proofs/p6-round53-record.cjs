'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_53_P6_BOUNDED_OVERLAYS_AND_MAP_SEAM.md',receipt=dir+'/ROUND_53_P6_BOUNDED_OVERLAYS_AND_MAP_SEAM_CHECKS.json',failReceipt=dir+'/ROUND_53_FAIL_36491107610.json',failReceipt2=dir+'/ROUND_53_FAIL_36491390975.json';

function verify(){
 const allowed=new Set([report,receipt,failReceipt,failReceipt2,'docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'P6 production reader still quarantined');
 for(const p of ['src/app','src/ui/v2/DiscoveryMap.tsx','src/ui/v2/DiscoveryPresentation.tsx'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','DiscoveryV1ServerMarkerLayer',p]).status,1,'Server marker seam must remain unreachable');
}

function record(){
 const focused=JSON.parse(read('/tmp/p6-round53/focused.json')),existing=JSON.parse(read('/tmp/p6-round53/existing.json')),full=JSON.parse(read('/tmp/p6-round53/full.json'));
 for(const r of [focused,existing,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={unit:'P6_BOUNDED_OVERLAYS_AND_SERVER_MAP_SEAM',source,run,result:'PASS',
  focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},existing:{suites:existing.numPassedTestSuites,tests:existing.numPassedTests},
  full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},overlayBound:100,profileConcurrency:4,mapBucketBound:256,
  productionWired:false,serverApplied:false,native:false,p6Finished:false};
 write(receipt,JSON.stringify(facts,null,2)+'\n');
 write(failReceipt2,JSON.stringify({unit:'ROUND53_SECOND_ATTEMPT',source:'40361f2f4b29888ebad56f1fdc10b424f31c6bca',run:'36491390975',result:'FAIL',typeScript:'PASS',overlayTests:{suites:1,tests:6,result:'PASS'},markerSuite:{suites:1,tests:3,result:'FAIL',category:'REACT_TEST_RENDERER_NOT_WRAPPED_IN_ACT'},artifact:{id:11001239213,digest:'sha256:af77ae71d4511daf8140c89b2cab4ec862c4fd5d1d464cca0d9f6be55e076c5c'},repair:'Move marker validation/projection to a pure data seam and test that seam directly; native component remains source-compiled and unreachable.',p6Finished:false},null,2)+'\n');
 write(failReceipt,JSON.stringify({unit:'ROUND53_FIRST_ATTEMPT',source:'982a768082a2cb3dd3d16fa944e079e4530da89a',run:'36491107610',result:'FAIL',typeScript:'PASS',overlayTests:{suites:1,tests:6,result:'PASS'},markerSuite:{result:'RUNTIME_ERROR',category:'JEST_MOCK_FACTORY_OUT_OF_SCOPE'},artifact:{id:11000994400,digest:'sha256:acddd59baee0362e4a1d8c2c33f5b8ebdfed9fec576aeb0e4c23642e5a10b267'},repair:'Mock factory now requires React inside its own scope; no product source behavior changed by the repair.',p6Finished:false},null,2)+'\n');
 write(report,'# Round53 — bounded optional overlays and quarantined server MAP seam\n\n'
 +'## Problem / product decision\n\nP6 PAGE owns marketplace membership, but TaskCard may optionally show account relation, public requester identity/rating and server-owned HITNO. Those reads must never become an unbounded N+1 layer or let a late old slice decorate a newer list. MAP already returns bounded TASK/PLACE/CLUSTER buckets and must not be converted into fabricated TaskCards.\n\n'
 +'## Implementation\n\nAdded discoveryV1OverlayOwner.ts. One admitted visible slice is capped at 100 Need rows. Relations use one bounded existing relation read; public profiles are deduplicated and capped at four concurrent reads; urgency uses the existing authoritative urgency reader. Generation/account/focus fencing remains authoritative even if transport ignores abort. Optional overlay failure never removes PAGE rows: relation becomes UNKNOWN, profile/trust stays unavailable, urgency is absent. Avatar storage paths are never copied into task projections.\n\n'
 +'Added an unreachable DiscoveryV1ServerMarkerLayer using the existing native PillAnnotation primitive. It consumes at most 256 decoded P6 MAP buckets directly. TASK, PLACE and CLUSTER retain server meanings; aggregate buckets have only count/geometry and never task-card identity. The layer does not re-cluster server buckets and is not imported by DiscoveryMap, DiscoveryPresentation or app routes yet.\n\n'
 +'## Checks / exact source\n\nTested commit '+source+'; Actions run '+run+'. TypeScript PASS. Focused overlay+marker seam: '+focused.numPassedTestSuites+' suites / '+focused.numPassedTests+' tests PASS. Existing P6/Discovery regressions: '+existing.numPassedTestSuites+' suites / '+existing.numPassedTests+' tests PASS. Full Jest: '+full.numPassedTestSuites+' suites / '+full.numPassedTests+' tests PASS.\n\n'
 +'## Preserved first failure\n\nThe first Round53 attempt, source 982a768082a2cb3dd3d16fa944e079e4530da89a / run36491107610, passed TypeScript and all six overlay-owner tests but the marker-layer suite failed before running assertions because Jest rejected an out-of-scope React reference in the mock factory. The workflow failed and published no control/evidence commit. ROUND_53_FAIL_36491107610.json preserves that disposition and artifact id/digest. The repair changed only the test mock factory scope. The second attempt, source40361f2f / run36491390975, then exposed a React19 test-renderer contract problem: all six overlay tests passed, while three marker component assertions ran without an act-mounted renderer and failed. ROUND_53_FAIL_36491390975.json preserves that result and artifact digest. The final repair moves marker shape/bound validation into a pure projection seam used by the native layer, so its semantics are testable without pretending a native map mount occurred.\n\n## Limits / next action\n\nNo production route uses the overlay owner, P6 transport or server marker layer. Server candidate is not applied to canonical DEV. This is source/CI only, not native map acceptance. FULL-return, scroll/viewport/selection restoration under the new reader, large-data memory/ANR, rollout and stable cross-environment performance remain open.\n\n'
 +'P6 remains OPEN. Continue P6 only. Next is the quarantined DiscoveryPresentation integration seam: current list/peek components must consume session+overlay state and the map must host the server marker layer without enabling the production route. Stop only at the owner-defined complete P6 and report P6 ZAVRŠEN.\n');
 const t=JSON.parse(read('docs/control/redovi.json'));
 t.finalization.p6_owner_stop={date:'2026-09-28',instruction:'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',evidence:report,completed:false};
 for(const id of ['B04','B05']){
  const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round53={source,run,overlayBound:100,profileConcurrency:4,mapBucketBound:256,staleFencing:true,productionWired:false,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.test=(f.test||'')+' Round53 '+source.slice(0,8)+' / run'+run+': focused '+focused.numPassedTestSuites+'/'+focused.numPassedTests+', existing '+existing.numPassedTestSuites+'/'+existing.numPassedTests+', full '+full.numPassedTestSuites+'/'+full.numPassedTests+' PASS.';
  f.status='P6 BOUNDED OVERLAY+SERVER MAP SEAM PASS / PRESENTATION INTEGRATION+ROLLOUT+NATIVE OPEN';
  row.sledece='P6 only: integrate quarantined session+overlays with actual DiscoveryPresentation/map seam without route switch; then performance/load, rollout, FULL-return and native/memory/ANR acceptance.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
}

if(process.argv[2]==='record')record();
else if(process.argv[2]==='verify')verify();
else throw Error('Expected record/verify');
