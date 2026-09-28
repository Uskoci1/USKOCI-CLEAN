'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_54_P6_PRESENTATION_SEAM.md',receipt=dir+'/ROUND_54_P6_PRESENTATION_SEAM_CHECKS.json',failReceipt=dir+'/ROUND_54_FAIL_36492982087.json';
function verify(){
 const allowed=new Set([report,receipt,failReceipt,'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])
  assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'P6 production reader still quarantined');
 assert.equal(cp.spawnSync('grep',['-R','-n','-F','DiscoveryV1PresentationBridge','src/app']).status,1,'P6 presentation bridge must remain unreachable');
}
function record(){
 const focused=JSON.parse(read('/tmp/p6-round54/focused.json')),existing=JSON.parse(read('/tmp/p6-round54/existing.json')),full=JSON.parse(read('/tmp/p6-round54/full.json'));
 for(const r of [focused,existing,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={unit:'P6_QUARANTINED_REAL_PRESENTATION_SEAM',source,run,result:'PASS',
  focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},existing:{suites:existing.numPassedTestSuites,tests:existing.numPassedTests},
  full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},
  existingPresentationUsed:true,serverMapBypassesLegacyClustering:true,exactCountsAdmitted:true,boundedPagingAdmitted:true,
  productionRouteUsesBridge:false,serverApplied:false,native:false,p6Finished:false};
 write(receipt,JSON.stringify(facts,null,2)+'\n');
 write(failReceipt,JSON.stringify({unit:'ROUND54_FIRST_ATTEMPT',source:'03ad62803a502bbe28af351c9cc0b82fb5ce36f9',run:'36492982087',result:'FAIL',
  completed:{checkout:true,dependencies:true,typeScript:false},failure:{step:'TypeScript',codes:['TS2353','TS2339'],
   detail:'DiscoveryV1ScreenSnapshot was missing wireItems required by the new presentation bridge/test.'},
  artifact:null,repair:'Add strict PAGE wireItems to the existing screen snapshot; no server/app-route/native behavior changed by this repair.',
  productionWired:false,serverApplied:false,native:false,p6Finished:false},null,2)+'\n');
 write(report,'# Round54 — quarantined P6 seam through the real Discovery presentation\n\n'
 +'## Problem / decision\n\nRound52/53 owned server state and bounded overlays, but the actual DiscoveryMap/DiscoveryPresentation still had no path for server MAP buckets, exact PAGE counts or the session-owned TASK/PLACE Peek. A separate visual prototype would not close that gap. This package adds an optional P6 seam to the existing production components while keeping every production route on the legacy reader.\n\n'
 +'## Implementation\n\nDiscoveryMap now has an optional p6Server contract. When present, server TASK/PLACE/CLUSTER buckets are rendered through the Round53 marker layer and the legacy GeoJSONSource/native clustering/pill stack is not mounted. Geometry ownership excludes selection callbacks, so choosing a marker cannot remount the map or discard viewport. Initial server fit uses server wholeBounds only; absence of public bounds falls back to the neutral overview instead of inventing geography. Empty-map taps clear the server Peek; settled user camera moves still use the existing bounded area callback. Legacy behavior is unchanged when p6Server is absent.\n\n'
 +'DiscoveryPresentation now has an optional p6Seam. Its list rows come from the server PAGE slice rather than re-filtering membership; exact server listed/inArea/withoutPoint/undated counts drive count semantics even while only bounded pages are loaded. FlatList end-reach can request exactly the next PAGE through the owner. Session TASK/POINT_MEMBERS Peek replaces legacy inferred pin selection only in this mode. Area/show-point/show-all/clear actions are callbacks to the P6 session; no optimistic server truth is invented.\n\n'
 +'DiscoveryV1PresentationBridge maps the Round52 screen snapshot plus Round53 bounded overlays into these exact real-component props. Strict wireItems are retained in the screen snapshot solely for bounded overlay ownership; mapWholeBounds is carried separately. The bridge is deliberately unreachable from src/app.\n\n'
 +'## Checks / exact source\n\nTested commit '+source+'; Actions run '+run+'. TypeScript PASS. Focused bridge/server-marker checks: '+focused.numPassedTestSuites+' suites / '+focused.numPassedTests+' tests PASS. Existing P6 plus legacy Discovery map/presentation regressions: '+existing.numPassedTestSuites+' suites / '+existing.numPassedTests+' tests PASS. Full Jest: '+full.numPassedTestSuites+' suites / '+full.numPassedTests+' tests PASS. CI also proves rpc_discovery_v1 remains absent from app routes/supabaseIzvor/ports and DiscoveryV1PresentationBridge is not imported by app routes.\n\n'
 +'## Preserved first failure\n\nThe first Round54 attempt, source 03ad62803 / run36492982087, stopped at TypeScript with TS2353/TS2339 because DiscoveryV1ScreenSnapshot did not yet expose the strict PAGE wireItems consumed by the new bridge. No focused/full tests, evidence publication or control update ran and no artifact was produced. ROUND_54_FAIL_36492982087.json preserves that result. The repair adds the already-decoded PAGE rows to the screen snapshot; it does not change server state or production route reachability.\n\n## Limits / next action\n\nThis is still quarantine, not the production reader switch and not native acceptance. The search panel still needs authoritative server PLACES/count/availability ownership instead of deriving all choices from a bounded loaded PAGE. A route coordinator must own session reopen/filter lifecycle without turning viewport-only changes into new search sessions. Server rollout/performance, FULL-return under the new reader, large-data memory/ANR and exact device build remain open.\n\n'
 +'P6 remains OPEN. Continue only P6. Next: server-owned search/facet model plus the unreachable route coordinator around this real presentation seam; then refresh load/performance and prepare the protected rollout/native gates. Do not advance to another large phase.\n');
 const t=JSON.parse(read('docs/control/redovi.json'));
 t.finalization.p6_owner_stop={date:'2026-09-28',instruction:'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',evidence:report,completed:false};
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round54={source,run,realPresentationSeam:true,serverMapBypassesLegacyClustering:true,exactCounts:true,pagingHook:true,productionWired:false,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.test=(f.test||'')+' Round54 '+source.slice(0,8)+' / run'+run+': focused '+focused.numPassedTestSuites+'/'+focused.numPassedTests+', existing '+existing.numPassedTestSuites+'/'+existing.numPassedTests+', full '+full.numPassedTestSuites+'/'+full.numPassedTests+' PASS.';
  f.status='P6 REAL PRESENTATION SEAM PASS / SEARCH OWNER+ROUTE SWITCH+ROLLOUT+NATIVE OPEN';
  row.sledece='P6 only: authoritative server search/facets and quarantined route coordinator next; production reader switch remains off until rollout/performance/native/FULL-return gates close.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md','FINALIZATION ROUND54 (2026-09-28): optional P6 path now reaches the real DiscoveryPresentation/DiscoveryMap through an unreachable bridge at '+source+', run'+run+'. Server MAP bypasses legacy client clustering; exact PAGE counts, bounded next-page and session TASK/PLACE Peek have real component seams. TypeScript/focused/existing/full Jest PASS. App routes still do not import bridge or rpc_discovery_v1; no DEV/native claim. P6 OPEN; owner stop condition binding. Read '+report+'.\n\n'+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
