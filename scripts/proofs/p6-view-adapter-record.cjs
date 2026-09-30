'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_51_P6_VIEW_ADAPTER.md',receipt=dir+'/ROUND_51_P6_VIEW_ADAPTER_CHECKS.json';
function verify(){
 const allowed=new Set([report,receipt,'docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean)) assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean)) assert(allowed.has(p),'Unexpected untracked: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts']) assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'Production P6 wiring remains off');
}
function record(){
 const focused=JSON.parse(read('/tmp/p6-view-adapter/focused.json')),existing=JSON.parse(read('/tmp/p6-view-adapter/existing.json')),full=JSON.parse(read('/tmp/p6-view-adapter/full.json'));
 for(const r of [focused,existing,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={unit:'P6_VIEW_ADAPTER_AND_POINT_MEMBERS',source,run,result:'PASS',focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},existing:{suites:existing.numPassedTestSuites,tests:existing.numPassedTests},full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},pointMembersOwner:true,viewFilterAdapter:true,publicItemAdapter:true,productionWired:false,serverApplied:false,native:false,p6Finished:false};
 assert(!fs.existsSync(report)&&!fs.existsSync(receipt));write(receipt,JSON.stringify(facts,null,2)+'\n');
 const body='# Round51 — P6 view adapter and independent point-members paging\n\n'
  +'## Product / implementation\n\nThe current Discovery view carries search, price, work mode, people, date range, selected locality, map area and a chosen public point. Round51 defines one pure adapter from that existing state into the strict P6 filter and PAGE scope. Remote intent clears geographic scope; dates are one Kada choice and override a stale quick-date word; pinPlace owns POINT_LIST ahead of an area; malformed point state refuses instead of silently widening the market. POINT_MEMBERS is a separate scope for a selected shared map point.\n\n'
  +'The strict V1 task row maps into the current Prilika/TaskCard facts without inventing requester identity, rating, avatar or urgency. Those remain optional bounded enrichments for displayed IDs only. The adapter exports a <=100 enrichment target boundary and aggregate MAP markers: PLACE/CLUSTER never become fabricated TaskCards.\n\n'
  +'The Round50 owner now has an independent POINT_MEMBERS state/channel with its own sequence, AbortController and cursor flight. Opening a shared public point therefore cannot replace or repurpose the main PAGE list. A newer chosen point fences an older member response even when abort is ignored. Scope/filter retirement also retires member paging.\n\n'
  +'## Checks / exact source\n\nTested commit '+source+'; Actions run '+run+'. TypeScript PASS. Focused adapter+owner '+focused.numPassedTestSuites+' suites / '+focused.numPassedTests+' tests PASS; existing Discovery/map/view regressions '+existing.numPassedTestSuites+' suites / '+existing.numPassedTests+' tests PASS; full Jest '+full.numPassedTestSuites+' suites / '+full.numPassedTests+' tests PASS. rpc_discovery_v1 remains absent from app routes, supabaseIzvor and ports.\n\n'
  +'## Limits / next action\n\nThis is a production-shaped adapter contract, not production wiring. Current DiscoveryPresentation and DiscoveryMap still consume the old full task collection. Server MAP buckets are represented truthfully, but the map UI has not yet been converted to consume them. Profile/relation/urgency overlays still need bounded displayed-ID integration. Server rollout, broader performance/load, FULL-return after new reader wiring and exact native memory/ANR evidence remain open.\n\n'
  +'P6 remains OPEN and the owner stop condition is unchanged. Next: build the quarantined screen integration around this adapter and Round50 owner, including bounded enrichment and server MAP/PLACES state, while the production switch stays off until rollout/performance/native gates permit it.\n';
 write(report,body);
 const t=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round51={source,run,viewAdapter:true,pointMembersOwner:true,boundedEnrichmentTargets:true,productionWired:false,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.test=(f.test||'')+' Round51 '+source.slice(0,8)+' / run'+run+': focused '+focused.numPassedTestSuites+'/'+focused.numPassedTests+', existing '+existing.numPassedTestSuites+'/'+existing.numPassedTests+', full '+full.numPassedTestSuites+'/'+full.numPassedTests+' PASS.';
  f.status='P6 OWNER+VIEW ADAPTER PASS / QUARANTINED SCREEN INTEGRATION+ROLLOUT+NATIVE OPEN';
  row.sledece='P6 only: integrate owner/adapter with bounded overlay and server MAP/PLACES screen model under quarantine; production switch remains off pending rollout/performance/native acceptance.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
