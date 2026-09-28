'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_52_P6_QUARANTINED_SCREEN.md',receipt=dir+'/ROUND_52_P6_QUARANTINED_SCREEN_CHECKS.json';
function verify(){
 const allowed=new Set([report,receipt,'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean))assert(allowed.has(p),'Unexpected untracked: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts'])assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'Production route/port reader must remain off');
 assert.equal(cp.spawnSync('grep',['-n','-F','rpc_discovery_v1','src/data/discoveryV1ClientTransport.ts']).status,0,'Quarantined transport missing');
}
function record(){
 const focused=JSON.parse(read('/tmp/p6-screen/focused.json')),existing=JSON.parse(read('/tmp/p6-screen/existing.json')),full=JSON.parse(read('/tmp/p6-screen/full.json'));
 for(const r of [focused,existing,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={unit:'P6_QUARANTINED_SCREEN_SESSION',source,run,result:'PASS',focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},existing:{suites:existing.numPassedTestSuites,tests:existing.numPassedTests},full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},realRpcTransportImplemented:true,routeUsesIt:false,serverApplied:false,native:false,p6Finished:false};
 assert(!fs.existsSync(report)&&!fs.existsSync(receipt));write(receipt,JSON.stringify(facts,null,2)+'\n');
 write(report,'# Round52 — quarantined P6 screen session and exact RPC transport\n\n'+
  '## Product / implementation\n\nA production-shaped but unreachable screen session now binds MarketplaceView, the Round50 owner and Round51 adapters into one state owner. Initial open is PAGE then MAP on the accepted anchor. A settled map move changes PAGE AREA scope and MAP coverage under that same browsing anchor. POINT_LIST changes only the list scope. PAGE and PLACES paging remain independent. TASK pins resolve EXACT_PUBLIC before a Peek exists; PLACE pins read a separate POINT_MEMBERS page; CLUSTER is only navigation geometry and cannot fabricate a task card. Cross-kind pin selection has its own sequence fence, so a late PLACE read cannot overwrite a newer TASK selection.\n\n'+
  'The new DiscoveryV1 client transport sends exactly one rpc_discovery_v1 call per owner request, passes AbortSignal when supported, checks abort again after a transport that ignores it, never retries an unknown read, and converts provider diagnostics to stable client errors. It is deliberately not exported through Izvor, supabaseIzvor or any app route.\n\n'+
  '## Checks / exact source\n\nTested commit '+source+'; Actions run '+run+'. TypeScript PASS. Focused transport/session/owner/adapter '+focused.numPassedTestSuites+' suites / '+focused.numPassedTests+' tests PASS; existing Discovery regressions '+existing.numPassedTestSuites+' suites / '+existing.numPassedTests+' tests PASS; full Jest '+full.numPassedTestSuites+' suites / '+full.numPassedTests+' tests PASS. The quarantine guard proves app routes, supabaseIzvor and ports still contain no rpc_discovery_v1 while the dedicated transport does.\n\n'+
  '## Limits / next action\n\nThis is not production wiring and does not close map/list/filter native acceptance. The current DiscoveryPresentation still renders the legacy full collection and builds pins from task rows. Optional public-profile, relation and urgency overlays need a bounded session owner; the server MAP marker path still needs a quarantine UI seam. Server rollout, wider performance/load, FULL return after real switch and native memory/ANR evidence remain open.\n\n'+
  'P6 remains OPEN. Continue only P6. Next: add bounded overlay ownership and an unreachable server-backed presentation seam using these exact models, while keeping the route switch off until server/performance/native gates are ready.\n');
 const t=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round52={source,run,screenSession:true,exactTransport:true,mapListFilterOwner:true,productionWired:false,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.test=(f.test||'')+' Round52 '+source.slice(0,8)+' / run'+run+': focused '+focused.numPassedTestSuites+'/'+focused.numPassedTests+', existing '+existing.numPassedTestSuites+'/'+existing.numPassedTests+', full '+full.numPassedTestSuites+'/'+full.numPassedTests+' PASS.';
  f.status='P6 QUARANTINED SCREEN SESSION+TRANSPORT PASS / OVERLAY+UI SEAM+ROLLOUT+NATIVE OPEN';
  row.sledece='P6 only: bounded overlay owner + unreachable server-backed presentation seam; keep route switch off pending rollout/performance/native gates.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
 write('AGENTS.md','FINALIZATION ROUND52 (2026-09-28): quarantined P6 screen session + exact rpc_discovery_v1 transport at '+source+', run'+run+'. PAGE/MAP/filter scope, TASK exact, PLACE POINT_MEMBERS, CLUSTER geometry and independent PLACES paging are one fenced state model. TypeScript/focused/existing/full Jest PASS. Transport is NOT referenced by routes/Izvor/ports; no server apply/native claim. P6 OPEN; owner stop condition unchanged. Read '+report+'.\n\n'+read('AGENTS.md'));
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
