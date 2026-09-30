'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_50_P6_CLIENT_OWNER.md',receipt=dir+'/ROUND_50_P6_CLIENT_OWNER_CHECKS.json';
function verify(){
 const allowed=new Set([report,receipt,'docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean)) assert(allowed.has(p),'Outside evidence package: '+p);
 for(const p of git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean)) assert(allowed.has(p),'Unexpected untracked file: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts']) assert.equal(cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p]).status,1,'P6 production wiring still forbidden');
}
function record(){
 const focused=JSON.parse(read('/tmp/p6-client-owner/focused.json')),contracts=JSON.parse(read('/tmp/p6-client-owner/contracts.json')),full=JSON.parse(read('/tmp/p6-client-owner/full.json'));
 for(const r of [focused,contracts,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={unit:'P6_CLIENT_OWNER_AND_STALE_FENCING',source,run,result:'PASS',focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},contracts:{suites:contracts.numPassedTestSuites,tests:contracts.numPassedTests},full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},productionWired:false,serverApplied:false,native:false,p6Finished:false,guarantees:['old filter response cannot publish','old map response cannot publish','old paging response cannot publish after scope change','one cursor has one paging owner','duplicate cross-page task IDs are deduplicated','places paging preserves prefix/facet area','account/focus guard fences ignored aborts','retire aborts and clears owner','PAGE owns PAGE/MAP browsing anchor']};
 assert(!fs.existsSync(report)&&!fs.existsSync(receipt),'Round50 already recorded');
 write(receipt,JSON.stringify(facts,null,2)+'\n');
 const body='# Round50 — P6 paging owner and stale-response fencing core\n\n'
  +'## Problem / product decision\n\nP6 cannot be wired merely because its decoders and SQL pass. A slow older PAGE/MAP/PLACES/EXACT response must never overwrite a newer filter, map move, scope, account or focus. One cursor must have one paging owner, and continuation must stay bound to the accepted anchor.\n\n'
  +'## Implementation\n\nAdded `src/data/discoveryV1Owner.ts` as a pure source owner over the existing strict PAGE/EXACT/MAP/PLACES decoders. It owns request epochs, per-channel sequences and AbortControllers; generation/account/focus fencing remains authoritative even when transport ignores abort. Filter/scope inputs are copied before IO. PAGE first response owns the PAGE/MAP anchor; MAP cannot run before that anchor. Scope changes keep the browsing anchor but retire the old list traversal. A cursor has one coalesced next request; cross-page task IDs are deduplicated. PLACES has its own prefix/facet-bound chain and cursor owner. Retire is terminal and clears snapshots.\n\n'
  +'This module does not call Supabase, does not replace the current route, and does not make a production-reader claim. The current full-collection reader remains active until server/performance/native gates permit an explicit wiring package.\n\n'
  +'## Checks / exact source\n\nTested commit `'+source+'`; Actions run `'+run+'`. TypeScript PASS. Focused owner: '+focused.numPassedTestSuites+' suite / '+focused.numPassedTests+' tests PASS. Existing PAGE/MAP/PLACES wire contracts: '+contracts.numPassedTestSuites+' suites / '+contracts.numPassedTests+' tests PASS. Full Jest: '+full.numPassedTestSuites+' suites / '+full.numPassedTests+' tests PASS. Production grep confirms `rpc_discovery_v1` is still absent from `src/app`, `src/data/supabaseIzvor.ts` and `src/data/ports.ts`.\n\n'
  +'Tests explicitly make old promises resolve after their AbortSignal was set, then require STALE with no publication. They cover filter replacement, two map requests, scope change during next-page IO, duplicate next-page calls, cross-page UUID dedupe, anchor drift refusal, locality query replacement and paging context, account/focus invalidation, terminal retire, latest-only EXACT and caller-object mutation after request start.\n\n'
  +'## Limits / next action\n\nThis closes the reusable client ownership/fencing core only. It does not yet connect PAGE/MAP/PLACES/EXACT_PUBLIC to the production route, make map/list/filter a real server-backed surface, prove FULL-return after that integration, provide large-data memory/ANR evidence, or authorize/apply the server package. Round49 performance limitations also remain.\n\n'
  +'P6 remains **OPEN**. Continue P6 only. Next is the bounded adapter/integration package: map/list/filter state must feed this owner, current UI state preservation must survive its paging model, and production switching stays disabled until server rollout/performance gates are satisfied. Do not move to another major phase. When every P6 condition is actually closed, stop and report **P6 ZAVRŠEN** to the owner.\n';
 write(report,body);
 const t=JSON.parse(read('docs/control/redovi.json'));
 t.finalization.p6_owner_stop={date:'2026-09-28',instruction:'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',evidence:report,completed:false};
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round50={source,run,pagingOwner:true,staleFencing:true,productionWired:false,serverApplied:false,native:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.test=(f.test||'')+' Round50 '+source.slice(0,8)+' / run'+run+': owner '+focused.numPassedTests+' focused tests; wire contracts '+contracts.numPassedTests+'; full Jest '+full.numPassedTestSuites+'/'+full.numPassedTests+' PASS.';
  f.status='P6 PAGING OWNER+STALE FENCING CORE PASS / PRODUCTION ADAPTER+ROLLOUT+NATIVE OPEN';
  row.sledece='P6 only: integrate PAGE/MAP/PLACES owner with real map/list/filter state while production switch remains off; then rollout/performance/native/FULL-return acceptance. STOP only after full P6.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
