'use strict';
// One bounded, source-only correction. Does not call DEV, Auth or a provider.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const BASE='4523d501c0022f89bf2104343a3661f260cc2a40';
const source='src/data/discoveryV1SpatialContract.ts',test='src/data/__tests__/discovery-v1-spatial-contract.test.ts';
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_43_P6_SPATIAL_GUARDS.md',receipt=dir+'/ROUND_43_P6_SPATIAL_CHECKS.json';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pin={ [source]:'c63d611a344ee7e376e26c5b2d44882e46bd277194953223b8f932c427d656c3', [test]:'4357c56bc938f86ca6a5f7aec70ff8366eb4bfd388a54535763bb375e6d1be17' };
function replace(old,next){const s=read(source);assert.equal(s.split(old).length,2,'Exact source anchor required');write(source,s.replace(old,next));}
function tests(){
 git('merge-base','--is-ancestor',BASE,'HEAD');for(const p of [source,test])assert.equal(hash(p),pin[p],p+' drift');
 assert(!fs.existsSync(report)&&!fs.existsSync(receipt),'Round43 already exists');
 write(test,read(test).trimEnd()+`\n
// P6 guard: invalid server output must be refused, never repaired or sorted.
it.each([
 ['wrong count',(v:any)=>{v.nextCursor.count=3;}],
 ['earlier row',(v:any)=>{v.nextCursor={...v.items[0]};}],
 ['display drift with identical key',(v:any)=>{v.nextCursor.text='BEOGRAD, VRAČAR';}],
 ['empty continuation',(v:any)=>{v.items=[];}],
])('P6 guard: cursor must be the exact emitted tail: %s',(_name,corrupt)=>{
 const v=places();corrupt(v);expect(()=>decodeDiscoveryV1Places(v)).toThrow('DISCOVERY_V1_PLACE_CURSOR_TAIL');
});
it.each([
 ['one facet exceeds total',(v:any)=>{v.items[0].count=21;}],
 ['sum exceeds total',(v:any)=>{v.counts.everywhere=11;v.counts.inArea=null;}],
])('P6 guard: impossible locality counts: %s',(_name,corrupt)=>{
 const v=places();corrupt(v);expect(()=>decodeDiscoveryV1Places(v)).toThrow('DISCOVERY_V1_PLACE_COUNTS');
});
it('P6 guard: point-free tasks cannot contribute to spatial buckets',()=>{
 const v=map();v.counts.withoutPoint=9;expect(()=>decodeDiscoveryV1Map(v)).toThrow('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
});
it('P6 guard: aggregated bucket counts must stay safe integers',()=>{
 const v=map();v.counts.mapped=Number.MAX_SAFE_INTEGER;v.counts.withoutPoint=0;v.buckets[1].taskCount=Number.MAX_SAFE_INTEGER;
 expect(()=>decodeDiscoveryV1Map(v)).toThrow('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
});
it('P6 guard: a task UUID cannot recur under another bucket key',()=>{
 const v=map();v.counts.withoutPoint=0;v.buckets.push({...v.buckets[0],key:'another-key'});
 expect(()=>decodeDiscoveryV1Map(v)).toThrow('DISCOVERY_V1_MAP_TASK_DUPLICATE');
});
it('P6 guard: short continuing and terminal empty pages remain valid',()=>{
 expect(decodeDiscoveryV1Places(places(),30).hasMore).toBe(true);
 const v=places();v.hasMore=false;v.nextCursor=null;expect(decodeDiscoveryV1Places(v).items).toHaveLength(2);
 v.items=[];expect(decodeDiscoveryV1Places(v).items).toEqual([]);
});
it('P6 guard: point-free-only and empty viewport responses remain valid',()=>{
 const v=map();v.buckets=[];v.wholeBounds=null;v.counts.withoutPoint=v.counts.mapped;
 expect(decodeDiscoveryV1Map(v).buckets).toEqual([]);v.counts.withoutPoint=0;expect(decodeDiscoveryV1Map(v).buckets).toEqual([]);
});
`);
}
function apply(){
 assert.equal(hash(source),pin[source],'Source drift');
 replace("  if(bucketTasks>mapped) invalid('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');",`  // mapped includes point-free rows; these cannot contribute to a spatial bucket.
  if(!Number.isSafeInteger(bucketTasks) || bucketTasks>mapped-withoutPoint)
    invalid('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
  const taskIds=buckets.flatMap(item=>item.kind==='TASK'?[item.taskId]:[]);
  if(new Set(taskIds).size!==taskIds.length) invalid('DISCOVERY_V1_MAP_TASK_DUPLICATE');`);
 replace("  if(hasMore!==(nextCursor!==null)) invalid('DISCOVERY_V1_PLACE_CURSOR_PRESENCE');",`  if(hasMore!==(nextCursor!==null)) invalid('DISCOVERY_V1_PLACE_CURSOR_PRESENCE');
  // Continue after exactly the emitted tail, never a plausible unrelated tuple.
  if(nextCursor!==null){
    const last=items[items.length-1];
    if(!last || last.count!==nextCursor.count || last.text!==nextCursor.text || last.key!==nextCursor.key)
      invalid('DISCOVERY_V1_PLACE_CURSOR_TAIL');
  }`);
 replace("  if(inArea!==null && inArea>everywhere) invalid('DISCOVERY_V1_PLACE_COUNTS');",`  if(inArea!==null && inArea>everywhere) invalid('DISCOVERY_V1_PLACE_COUNTS');
  // A task contributes to at most one locality, including on a filtered page.
  const listed=items.reduce((sum,item)=>sum+item.count,0);
  if(!Number.isSafeInteger(listed) || listed>everywhere) invalid('DISCOVERY_V1_PLACE_COUNTS');`);
}
function record(){
 const before=JSON.parse(read('outputs/p6-spatial/before.json')),focused=JSON.parse(read('outputs/p6-spatial/focused.json')),full=JSON.parse(read('outputs/p6-spatial/full.json'));
 assert.equal(before.numFailedTests,8);assert.equal(before.numRuntimeErrorTestSuites,0);
 for(const r of [focused,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const tested=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={base:BASE,testedSource:tested,run,scope:'QUARANTINED_CLIENT_ONLY',typecheck:'PASS',before:{failed:8,runtimeErrors:0},focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},hashes:{[source]:hash(source),[test]:hash(test)},serverApplied:false,providerCalled:false,nativeTested:false,releaseReady:false};
 write(receipt,JSON.stringify(facts,null,2)+'\n');
 write(report,`# Round43 — P6 spatial continuation and count guards

## Problem / user impact and cause

The quarantined PLACES decoder accepted an unrelated continuation tuple and even an empty page with hasMore=true. Future paging could repeat or skip localities. MAP accepted a bucket population that spent point-free rows and repeated the same task UUID under different bucket keys. PLACES accepted facet totals beyond Everywhere. Eight malformed-input regressions reproduce acceptance on the exact predecessor; three positive/existing-control regressions preserve valid cases.

## Product / UX decision and implementation

Refuse contradictions at the existing strict decoder boundary; never silently repair, sort, duplicate or display fabricated counts. Cursor count+text+key must equal the last emitted row. Short valid continuing pages remain valid. Bucket sums cannot exceed mapped minus withoutPoint; duplicate TASK IDs are refused. Locality counts cannot exceed the exact whole-filter total.

Files: ${source}, ${test}. No screen, TaskCard/Peek, production reader, navigation, account, dependency, payment or motion change.

## Backend / applied or not

No SQL candidate changed or applied. P6 remains quarantined. The read-only canonical DEV check at 2026-09-28T14:38:29.918002Z found rpc_discovery_v1(jsonb) absent, covered_slots body MD5 cbeb8f2a3da7d08965ef0386cfc437ba, and Serbian ICU collation present. Reader role was supabase_read_only_user. This is a metadata check, not Auth/PostgREST, database proof or live state mutation.

## Checks / exact source

Tested commit: ${tested}; Actions run ${run}. Before: 8 failed assertions, 0 runtime-suite errors. After: TypeScript PASS; ${focused.numPassedTestSuites} focused suites / ${focused.numPassedTests} tests PASS; full Jest ${full.numPassedTestSuites} suites / ${full.numPassedTests} tests PASS. See ROUND_43_P6_SPATIAL_CHECKS.json for hashes. Source is committed before checking. The same workflow generates the existing tracker and refuses a non-fast-forward or moved-branch push.

## Device / provider proof and limits

No APK, Android/iOS device, provider, latency, scale, exact push, email delivery or live matching proof. Historical native evidence stays bound to its old binary. SOURCE/CI PASS does not close P6, the native FULL-return gate or any store gate.

## Control / publication / next action

Existing B04/B05 rows are reconciled; node scripts/control/osvezi.mjs must run before committing generated views. Hosted Claude publication remains unverified. The highest remaining P6 work is the complete PAGE+EXACT+MAP+PLACES server candidate, disposable SQL and Auth/PostgREST proof, query-cost evidence, paging owner and native adapters. This is engineering work, not a ready migration waiting only for approval. No owner input is needed for that preparation; live apply and additional provider/native-dependency permissions remain separate.
`);
 const data=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B04','B05']){
  const row=data.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round43=facts;f.evidence=[f.evidence,report].filter(Boolean).join('; ');
  f.test=`Round43 ${tested.slice(0,8)} / run${run}: 8 RED-before; TypeScript PASS; focused ${focused.numPassedTestSuites}/${focused.numPassedTests}; full Jest ${full.numPassedTestSuites}/${full.numPassedTests}. Quarantine only; no native/server proof.`;
  f.status='P6 SPATIAL GUARDS SOURCE/CI PASS / COMPLETE SERVER+PERFORMANCE+NATIVE PENDING';
  f.backend='P0 exact public lookup remains applied. P6 PAGE/EXACT has historical rollback proof; complete MAP/PLACES server, Auth/PostgREST and cost proof remain engineering work. rpc_discovery_v1 absent on DEV at 2026-09-28T14:38:29Z; no application or production wiring.';
  row.sledece='Complete P6 PAGE+EXACT+MAP+PLACES candidate and isolated proof without live apply; then paging ownership/adapters and native large-data acceptance. Round43 guards must remain.';
  if(id==='B04')f.ux='Round33 preserves logical FULL, offset, viewport and selection across a fresh native mount. Round39 adds optional saved work-area initial camera; explicit user intent/publication/remembered viewport wins. These are source/CI facts, not current native acceptance. Personal locality and GPS remain separate.';
 }
 write('docs/control/redovi.json',JSON.stringify(data,null,2)+'\n');
}
function verify(){
 const allowed=new Set([source,test,report,receipt,'docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html','scripts/proofs/p6-spatial-hardening.cjs','.github/workflows/p6-spatial-hardening.yml']);
 git('merge-base','--is-ancestor',BASE,'HEAD');for(const p of git('diff','--name-only',BASE).split('\n').filter(Boolean))assert(allowed.has(p),'Outside package: '+p);
 for(const p of git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean))assert(allowed.has(p)||p.startsWith('outputs/p6-spatial/'),'Unexpected: '+p);
 for(const p of ['src/app','src/data/supabaseIzvor.ts','src/data/ports.ts']){const result=cp.spawnSync('grep',['-R','-n','-F','rpc_discovery_v1',p],{encoding:'utf8'});assert.equal(result.status,1,'P6 production wiring forbidden');}
}
const phase=process.argv[2];if(phase==='tests')tests();else if(phase==='apply')apply();else if(phase==='record')record();else if(phase==='verify')verify();else throw Error('Expected tests/apply/record/verify');
