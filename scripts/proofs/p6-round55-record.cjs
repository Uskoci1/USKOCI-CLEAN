'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_55_P6_SEARCH_AND_ROUTE_COORDINATOR.md',receipt=dir+'/ROUND_55_P6_SEARCH_AND_ROUTE_COORDINATOR_CHECKS.json';

function verify(){
 const allowed=new Set([report,receipt,'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])
  assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'Production RPC remains quarantined');
 for(const symbol of ['DiscoveryV1PresentationBridge','createDiscoveryV1RouteCoordinator'])
  assert.equal(cp.spawnSync('grep',['-R','-n','-F',symbol,'src/app']).status,1,'P6 route coordinator/bridge remains unreachable');
}

function record(){
 const focused=JSON.parse(read('/tmp/p6-round55/focused.json')),existing=JSON.parse(read('/tmp/p6-round55/existing.json')),full=JSON.parse(read('/tmp/p6-round55/full.json'));
 for(const r of [focused,existing,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={unit:'P6_SERVER_SEARCH_AND_ROUTE_COORDINATOR',source,run,result:'PASS',
  focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},
  existing:{suites:existing.numPassedTestSuites,tests:existing.numPassedTests},
  full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},
  serverOwnedSearchPreview:true,placePaging:true,viewportDoesNotReopen:true,routeCoordinator:true,
  productionWired:false,serverApplied:false,native:false,p6Finished:false};
 write(receipt,JSON.stringify(facts,null,2)+'\n');
 write(report,'# Round55 — authoritative search/facet preview and quarantined route coordinator\n\n'
 +'## Problem / product decision\n\nA bounded PAGE cannot answer the search panel by counting its loaded rows or deriving locality suggestions from only those rows. Also, the real Discovery presentation needs one route owner that distinguishes a server-search intent from passive UI memory: viewport, sheet height and list offset must not restart PAGE/MAP, while applying a new search must.\n\n'
 +'## Implementation\n\nAdded discoveryV1SearchOwner.ts. One generation owns an exact PAGE limit-1 count preview plus an independent PLACES facet read. PAGE supplies exact listed/undated counts and whole-collection availability. PLACES supplies locality rows, Everywhere and map-area counts under the non-geographic conditions, with count/text/key continuation. A newer draft aborts and fences both reads; ignored abort cannot publish. PLACES failure does not fabricate zero or disable a separately authoritative PAGE count. Remote preview sends no locality request.\n\n'
 +'DiscoverySearchPanel now has an optional P6 seam. While present it never falls back to the bounded loaded rows for count, locality facets or availability. A stale preview says loading. The selected locality remains removable even if a live facet refresh no longer returns it, and PLACES continuation is explicit. Legacy search behavior is unchanged without the seam.\n\n'
 +'Added discoveryV1RouteCoordinator.ts. Its server-intent key contains the normalized P6 filter and PAGE scope only. Viewport, sheet and listOffset are passive route memory and do not reopen the traversal. Search/filter changes do reopen; settled map bounds use the existing shared anchor; TASK selection uses EXACT_PUBLIC; paging refreshes only a capped optional overlay slice. Search preview is independent from displayed PAGE membership. The coordinator snapshot feeds the existing Round54 presentation bridge, including the server search seam.\n\n'
 +'Round53 overlay application now admits a bounded metadata slice without rejecting a longer accumulated PAGE traversal: exact item id/revision/profile/urgent fingerprints decide which rows may receive metadata; all other rows remain valid base task rows with UNKNOWN/unavailable overlays. Membership is still P6 PAGE authority.\n\n'
 +'## Checks / exact source\n\nTested commit '+source+'; Actions run '+run+'. TypeScript PASS. Focused search owner/coordinator/overlay/search-panel/bridge suites: '+focused.numPassedTestSuites+' suites / '+focused.numPassedTests+' tests PASS. Existing P6 + Discovery regressions: '+existing.numPassedTestSuites+' suites / '+existing.numPassedTests+' tests PASS. Full Jest: '+full.numPassedTestSuites+' suites / '+full.numPassedTests+' tests PASS.\n\n'
 +'Focused checks prove exact server count can be 37 while one local row is loaded; stale preview never falls back to local count; locality failure leaves PAGE count usable; PLACES continuation keeps prefix/facetArea/cursor and deduplicates; remote sends one PAGE only; newer drafts fence older reads; viewport/sheet/offset create no transport calls; a search intent creates a new PAGE/MAP traversal; map-area changes retain the accepted anchor and passive viewport/offset; the bridge receives the coordinator search snapshot; optional metadata remains bounded after more than 100 PAGE rows.\n\n'
 +'## Limits / next action\n\nThis remains an unreachable source/CI route coordinator. src/app still imports neither the coordinator nor the P6 bridge, and rpc_discovery_v1 remains absent from app routes/Izvor/ports. Canonical DEV has not received the P6 server package. No Android/iOS build is evidence for this source. Stable cross-environment performance, wider load/capacity distributions, server rollout, actual production reader switch, FULL-return on that switch and native memory/ANR acceptance remain open.\n\n'
 +'P6 remains OPEN. Continue P6 only. Next: freeze a deployable combined P6 server package from the proved original+cost deltas, refresh current DEV/certificate/ACL preconditions and larger/distribution performance proof without applying it; in parallel prepare the guarded route switch/native checkpoint contract. Stop only when the full owner-defined P6 condition is satisfied and report P6 ZAVRŠEN.\n');
 const t=JSON.parse(read('docs/control/redovi.json'));
 t.finalization.p6_owner_stop={date:'2026-09-29',instruction:'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',evidence:report,completed:false};
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round55={source,run,serverSearch:true,routeCoordinator:true,viewportPassive:true,productionWired:false,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.test=(f.test||'')+' Round55 '+source.slice(0,8)+' / run'+run+': focused '+focused.numPassedTestSuites+'/'+focused.numPassedTests+', existing '+existing.numPassedTestSuites+'/'+existing.numPassedTests+', full '+full.numPassedTestSuites+'/'+full.numPassedTests+' PASS.';
  f.status='P6 SEARCH+ROUTE COORDINATOR PASS / DEPLOYABLE SERVER+ROUTE SWITCH+NATIVE OPEN';
  row.sledece='P6 only: freeze deployable combined server candidate and current preconditions/performance proof without apply; prepare guarded production route switch and exact native/FULL-return/memory acceptance.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md','FINALIZATION ROUND55 (2026-09-29): P6 authoritative search/facet preview + unreachable route coordinator at '+source+', run'+run+'. Search count/facets never derive from bounded PAGE; draft/place paging fenced; viewport/sheet/listOffset do not reopen server traversal; search/map scope do. Bounded overlays now tolerate longer accumulated PAGE without enriching unadmitted rows. TypeScript/focused/existing/full Jest PASS. No src/app route switch, DEV apply or native claim. P6 OPEN; owner stop condition binding. Read '+report+'.\n\n'+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
