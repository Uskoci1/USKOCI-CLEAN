// PKG-023 runtime proof. Disposable Auth/Postgres, real accounts, real RLS, real PostgREST, the real
// RPC authority with synthetic facts. No provider is called. Nothing here can reach a hosted project.
//
// The workflow runs this file twice on the same disposable database:
//   1. BEFORE the candidates are applied. It must FAIL. That run is the failing test.
//   2. AFTER they are applied. It must PASS, every section.
// Sections are independent: one failing does not hide the others.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {assert,rows,sql,ok,actor,randomUUID,q,profile,conversation,review,accept,context,claimEvaluation,evaluate,publish,
 publishedTask,readyWorker,apply,select,fingerprint,needRow,stationary,remote} from './pkg023_flow.mjs';
import {anon,out} from '../pre_v3/closure_runtime.mjs';

const legacy=JSON.parse(readFileSync(process.env.PKG023_LEGACY_FILE,'utf8'));
const checks=[],failures=[],notes={};
async function section(name,fn){
 try{await fn();checks.push({name,result:'PASS'});console.log('PASS '+name);}
 catch(e){failures.push({name,failure:String(e?.stack??e).slice(0,1800)});console.error('FAIL '+name+' :: '+String(e?.message??e).slice(0,700));}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const refused=async(p,message)=>{const r=await p;assert.ok(r.error,'EXPECTED_REFUSAL '+(message??''));if(message)assert.equal(r.error.message,message);return r.error;};
const resetTurns=a=>sql(`update private.ai_need_turn_commands set attempt_times='{}' where account_id=${q(a.id)}::uuid`);
const ids=page=>page.items.map(x=>x.id);
/** Walks a keyset-paged reader to its end and returns every page. `between` runs once, after page 1. */
async function walk(read,limit,between){
 const pages=[];let cursor=null;
 for(let i=0;i<50;i++){
  const page=await read(limit,cursor);pages.push(page);
  assert.ok(page.items.length<=limit,'a page is larger than its limit');
  if(i===0&&between)await between(page);
  if(!page.hasMore)break;
  const last=page.items.at(-1);assert.ok(last.sortAt&&last.id,'an item does not carry its cursor');
  cursor={at:last.sortAt,id:last.id};
 }
 return pages;
}
const flat=pages=>pages.flatMap(ids);
function assertExactlyOnce(seen,expected,label){
 assert.equal(new Set(seen).size,seen.length,label+': a row was returned twice');
 assert.deepEqual([...seen].sort(),[...expected].sort(),label+': the pages are not exactly the expected rows');
}

const present=sql(`select (to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)') is not null
 and to_regprocedure('public.rpc_list_my_applications_page(text,integer,timestamptz,uuid)') is not null
 and to_regprocedure('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)') is not null
 and to_regprocedure('public.rpc_get_my_task_relations(uuid[])') is not null
 and to_regprocedure('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)') is not null
 and (select count(*) from information_schema.columns where table_schema='public' and table_name='needs' and column_name in('public_lat','public_lng'))=2)::text`);

await section('S0_CANDIDATE_OBJECTS_PRESENT_WITH_EXACT_GRANTS',async()=>{
 assert.equal(present,'true','the candidates are not applied to this database');
 for(const f of ['public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)','public.rpc_list_my_applications_page(text,integer,timestamptz,uuid)',
  'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)','public.rpc_get_my_task_relations(uuid[])',
  'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)']){
  assert.equal(sql(`select has_function_privilege('anon',${q(f)},'EXECUTE')`),'f',f+' anon');
  assert.equal(sql(`select has_function_privilege('authenticated',${q(f)},'EXECUTE')`),'t',f+' authenticated');
 }
 assert.equal(sql(`select has_function_privilege('authenticated','private.my_application_state(text,integer,integer,text,boolean)','EXECUTE')`),'f');
});

if(present==='true'){
 // PostgREST learns of new functions asynchronously after NOTIFY pgrst.
 const probe=await actor('pkg023-probe');
 for(let i=0;i<60;i++){const r=await probe.client.rpc('rpc_list_open_tasks_v3',{p_limit:1});if(!r.error||r.error.code!=='PGRST202')break;await sleep(500);}

 const owner=await actor('pkg023-owner'),worker=await actor('pkg023-worker'),stranger=await actor('pkg023-stranger'),pager=await actor('pkg023-pager');
 let T1,T2,T3,wp,A1,A2,A3,G1,G2;

 await section('S2_REAL_FLOWS_THREE_TASKS_THREE_APPLICATIONS_TWO_DOGOVORI',async()=>{
  for(const n of [1,2,3]){resetTurns(owner);const t=await publishedTask(owner,{facts:{title:'PKG023 owner task '+n}});if(n===1)T1=t;else if(n===2)T2=t;else T3=t;}
  wp=await readyWorker(worker);
  A1=await apply(worker,wp,T1);A2=await apply(worker,wp,T2);A3=await apply(worker,wp,T3);
  G1=await select(owner,T1,A1);G2=await select(owner,T2,A2);
  assert.ok(G1&&G2);
 });

 await section('S3_PUBLIC_PIN_BOTH_GENERATIONS_FROM_ONE_PRIVATE_RECORD',async()=>{
  // NEW LOCATION -> the old client projection gets the legacy coarse point, the V3 projection the
  // ~100 m point, and both are the projection of the same confirmed private record.
  const row=needRow(T1.needId),record=row.resolved_location,point=record.value.points.find(p=>p.slot==='start');
  assert.equal(point.latitudeE6,45251234);assert.equal(point.longitudeE6,19831234);
  assert.ok(record.confirmedAt&&record.confirmedByAccountId===owner.id,'the record is not the owner\'s confirmed record');
  const projections=rows(`select n.approximate_lat::text a_lat,n.approximate_lng::text a_lng,n.public_lat::text p_lat,n.public_lng::text p_lng,
   round((p->>'latitudeE6')::numeric/1000000,2)::text r2_lat,round((p->>'longitudeE6')::numeric/1000000,2)::text r2_lng,
   round((p->>'latitudeE6')::numeric/1000000,3)::text r3_lat,round((p->>'longitudeE6')::numeric/1000000,3)::text r3_lng
   from public.needs n join public.need_sensitive s on s.need_id=n.id, jsonb_array_elements(s.resolved_location#>'{value,points}') p
   where n.id=${q(T1.needId)}::uuid and p->>'slot'='start'`)[0];
  assert.deepEqual(projections,{a_lat:'45.25',a_lng:'19.83',p_lat:'45.251',p_lng:'19.831',r2_lat:'45.25',r2_lng:'19.83',r3_lat:'45.251',r3_lng:'19.831'});
  assert.equal(row.exact_lat,'45.251234');
  // Old client: the direct table read an installed APK makes, column for column.
  const old=await ok(worker.client.from('needs').select('id,approximate_lat,approximate_lng').eq('id',T1.needId).single());
  assert.equal(Number(old.approximate_lat),45.25);assert.equal(Number(old.approximate_lng),19.83);
  // V3 client: the bounded reader.
  const v3=await ok(worker.client.rpc('rpc_list_open_tasks_v3',{p_bbox:{west:19.7,south:45.1,east:19.95,north:45.4},p_limit:200}));
  assert.equal(sql(`select status from public.needs where id=${q(T3.needId)}::uuid`),'PUBLISHED');
  assert.deepEqual(rows(`select approximate_lat::text a,public_lat::text p from public.needs where id=${q(T3.needId)}::uuid`)[0],{a:'45.25',p:'45.251'});
  const item=v3.items.find(x=>x.id===T3.needId);assert.ok(item,'the new task is not in its viewport');
  assert.ok(!v3.items.some(x=>x.id===T1.needId),'a task that is full is still advertised');
  assert.deepEqual(item.pin,{lat:45.251,lng:19.831,precision:'FINE_100M'});
  assert.deepEqual(item.legacyPin,{lat:45.25,lng:19.83,precision:'COARSE_1KM'});
  // No client is handed the exact coordinate to draw with.
  const wire=JSON.stringify(v3);
  for(const forbidden of ['45.251234','19.831234','latitudeE6','exact','requesterAccountId','requester_account_id',owner.id])
   assert.ok(!wire.includes(forbidden),'the public result carries '+forbidden);
  assert.equal((await worker.client.from('need_sensitive').select('exact_lat').eq('need_id',T1.needId)).data?.length??0,0,'a stranger can read the exact point');

  // Both projections are bound to the record: neither can be moved away from it.
  for(const tamper of ['public_lat=45.999','approximate_lat=45.99']){
   // The write guard is set aside so that the binding alone is what answers; the binding is a deferred
   // constraint trigger, made immediate here so that it answers inside this statement. All of it rolls back.
   assert.throws(()=>sql(`begin;alter table public.needs disable trigger needs_guard_write;set constraints all immediate;
    update public.needs set ${tamper} where id=${q(T1.needId)}::uuid;rollback;`),/LOCATION_BINDING_CHANGED/,tamper);
  }
  // Immutable after publication, through the existing guard.
  await refused(owner.client.from('needs').update({public_lat:45.0,public_lng:19.0}).eq('id',T3.needId).select('id').single());
  assert.equal(needRow(T3.needId).doc.public_lat,45.251);
  // A client can write the columns of its own DRAFT through the table grant. Without a confirmed
  // record there is nothing for the point to be the projection of, and the deferred binding refuses it.
  resetTurns(owner);const cid=await conversation(owner,{title:'PKG023 remote draft'}),r=await review(owner,cid,remote()),c=await accept(owner,r);
  const forged=await owner.client.from('needs').update({public_lat:45.1,public_lng:19.1}).eq('id',c.needId).select('id');
  assert.ok(forged.error||forged.data.length===0,'a client forged a public point on a draft without a confirmed record');
  assert.deepEqual(rows(`select public_lat,public_lng from public.needs where id=${q(c.needId)}::uuid`)[0],{public_lat:null,public_lng:null});

  // The new fingerprint binds the new projection.
  const fp=fingerprint(T1.needId);
  assert.equal(fp.publicGeography.publicLat,45.251);assert.equal(fp.publicGeography.publicLng,19.831);
  assert.equal(fp.publicGeography.approximateLat,45.25);

  // NO BACKFILL, and the old fingerprint is stable to the byte.
  const before=legacy.fingerprint,after=fingerprint(legacy.needId);
  assert.deepEqual(after,before,'the fingerprint of a task published before the candidates changed');
  assert.ok(!('publicLat' in after.publicGeography));
  assert.deepEqual(rows(`select public_lat,public_lng,approximate_lat::text,approximate_lng::text from public.needs where id=${q(legacy.needId)}::uuid`)[0],
   {public_lat:null,public_lng:null,approximate_lat:legacy.approximateLat,approximate_lng:legacy.approximateLng});
  assert.equal(sql(`select md5(private.need_material_snapshot(${q(legacy.needId)}::uuid)::text)`),legacy.draftFingerprintInputs);
  const oldItem=v3.items.find(x=>x.id===legacy.needId);assert.ok(oldItem,'the task published before the candidates is not in the viewport');
  assert.deepEqual(oldItem.pin,{lat:45.25,lng:19.83,precision:'COARSE_1KM'});assert.deepEqual(oldItem.legacyPin,oldItem.pin);

  // Account erasure covers the new columns.
  const patch=JSON.parse(sql(`select private.closure_redaction_patch_v5('public.needs',to_jsonb(n),n.requester_account_id,extensions.gen_random_uuid())
   from public.needs n where n.id=${q(T1.needId)}::uuid`));
  assert.equal(patch.operation,'UPDATE');assert.ok('public_lat' in patch.patch&&'public_lng' in patch.patch);
  assert.equal(patch.patch.public_lat,null);assert.equal(patch.patch.public_lng,null);assert.equal(patch.patch.approximate_lat,null);

  // The worker's own location stays on the coarse grid.
  const loc=await ok(worker.client.rpc('rpc_get_worker_location',{}));
  await refused(worker.client.rpc('rpc_save_worker_location',{p_expected_revision:loc.revision,
   p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.251,longitude:19.851}},p_confirmed:true}));
  assert.deepEqual(rows(`select format_type(atttypid,atttypmod) t from pg_attribute where attrelid='public.worker_match_preferences'::regclass and attname in('approximate_lat','approximate_lng') order by attname`),
   [{t:'numeric(6,2)'},{t:'numeric(7,2)'}]);
  assert.deepEqual(rows(`select format_type(atttypid,atttypmod) t from pg_attribute where attrelid='public.needs'::regclass and attname in('approximate_lat','approximate_lng') order by attname`),
   [{t:'numeric(6,2)'},{t:'numeric(7,2)'}]);

  // The closure source digest was re-bound from a ready predecessor, and is ready.
  assert.equal(legacy.closureSourceBound,'t');assert.equal(legacy.retentionReady,'t');
  assert.equal(sql('select (select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5()'),'t');
  assert.equal(sql('select private.retention_ai_source_ready()'),'t');
  assert.notEqual(sql('select private.closure_source_digest_v5()'),legacy.closureSourceDigest);
 });

 await section('S4_MARKETPLACE_BOUNDED_SCOPE_LIMIT_FILTERS_ALLOWLIST_PAGING_INDEX',async()=>{
  const pid=await profile(pager,'REQUESTER'),seeded=[];
  // Five open tasks far from everything else, with distinct server-owned publication instants.
  for(let i=0;i<5;i++){const id=randomUUID();seeded.push(id);
   sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind,
     execution_location_mode,approximate_city,approximate_lat,approximate_lng,published_at,urgent)
    values(${q(id)}::uuid,${q(pager.id)}::uuid,${q(pid)}::uuid,'PUBLISHED',${q('PKG023 far task '+i)},'proof',${q(i%2?'PKG023_ODD':'PKG023_EVEN')},
     ${q(i%2?'MY_PRICE':'OFFERS')},1,'FLEXIBLE','STATIONARY','Kragujevac',${44+i/100},${20+i/100},statement_timestamp()-make_interval(mins=>${10+i}),false);commit;`);}
  const remoteTask=randomUUID();sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
   insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind,execution_location_mode,published_at)
   values(${q(remoteTask)}::uuid,${q(pager.id)}::uuid,${q(pid)}::uuid,'PUBLISHED','PKG023 remote task','proof','PKG023_REMOTE','OFFERS',1,'FLEXIBLE','REMOTE',statement_timestamp()-interval '1 hour');commit;`);
  const far={west:19.9,south:43.9,east:20.1,north:44.1};
  const read=(client,limit,cursor,filters={},bbox=far)=>ok(client.rpc('rpc_list_open_tasks_v3',{p_bbox:bbox,p_filters:filters,p_limit:limit,
   p_before_at:cursor?.at??null,p_before_id:cursor?.id??null}));
  // Geographic scope: exactly the five, newest first, and nothing of the viewport around Novi Sad.
  const all=await read(worker.client,200);assert.deepEqual(ids(all),seeded);assert.equal(all.hasMore,false);
  assert.ok(!ids(all).includes(T3.needId)&&!ids(all).includes(remoteTask));
  // Stable paging: a task published between two pages neither repeats nor hides a row.
  let inserted;const pages=await walk((limit,cursor)=>read(worker.client,limit,cursor),2,async()=>{
   inserted=randomUUID();sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind,
     execution_location_mode,approximate_city,approximate_lat,approximate_lng,published_at)
    values(${q(inserted)}::uuid,${q(pager.id)}::uuid,${q(pid)}::uuid,'PUBLISHED','PKG023 far task between pages','proof','PKG023_EVEN','OFFERS',1,'FLEXIBLE',
     'STATIONARY','Kragujevac',44.02,20.02,statement_timestamp());commit;`);
   // A change to a row that is not its sort key, between pages, moves nothing.
   sql(`update public.needs set updated_at=statement_timestamp()+interval '1 second' where id=${q(seeded[4])}::uuid`);
  });
  assert.equal(pages.length,3);assertExactlyOnce(flat(pages),seeded,'marketplace');
  assert.deepEqual(ids(await read(worker.client,1)),[inserted],'a fresh first page does not start with the newest task');
  // published_at is server-owned: a client cannot move a row in the public order.
  await refused(pager.client.from('needs').update({published_at:new Date(Date.now()+86400000).toISOString()}).eq('id',seeded[0]).select('id').single());
  // Hard limit and input contract.
  for(const [args,message] of [[{p_limit:201},'INVALID_PAGE'],[{p_limit:0},'INVALID_PAGE'],[{p_before_at:new Date().toISOString()},'INVALID_PAGE'],
   [{p_bbox:{west:10,south:40,east:20,north:44}},'INVALID_BBOX'],[{p_bbox:{west:20,south:44,east:19,north:45}},'INVALID_BBOX'],
   [{p_bbox:{west:19,south:44,east:20}},'INVALID_BBOX'],[{p_filters:{requesterAccountId:pager.id}},'INVALID_FILTER'],
   [{p_filters:{priceMode:'FREE'}},'INVALID_FILTER'],[{p_bbox:far,p_filters:{remote:'ONLY'}},'INVALID_FILTER'],[{p_filters:{startsFrom:'not a time'}},'INVALID_FILTER']])
   await refused(worker.client.rpc('rpc_list_open_tasks_v3',args),message);
  await refused(anon.rpc('rpc_list_open_tasks_v3',{p_limit:1}));
  // Filter semantics.
  assert.deepEqual(ids(await read(worker.client,200,null,{category:'PKG023_ODD'})),[seeded[1],seeded[3]]);
  assert.deepEqual(ids(await read(worker.client,200,null,{priceMode:'OFFERS'})),[inserted,seeded[0],seeded[2],seeded[4]]);
  assert.deepEqual(ids(await read(worker.client,200,null,{urgentOnly:true})),[]);
  const list=await ok(worker.client.rpc('rpc_list_open_tasks_v3',{p_limit:200})),remoteOnly=await ok(worker.client.rpc('rpc_list_open_tasks_v3',{p_filters:{remote:'ONLY'},p_limit:200}));
  assert.ok(seeded.every(id=>ids(list).includes(id))&&ids(list).includes(T3.needId)&&ids(list).includes(remoteTask),'the list is not every open task');
  assert.ok(ids(remoteOnly).includes(remoteTask)&&remoteOnly.items.every(x=>x.executionLocationMode==='REMOTE'&&x.pin===null));
  const noRemote=await ok(worker.client.rpc('rpc_list_open_tasks_v3',{p_filters:{remote:'EXCLUDE'},p_limit:200}));
  assert.ok(!ids(noRemote).includes(remoteTask)&&ids(noRemote).includes(T3.needId));
  // Public-safe allowlist: the exact set of fields, nothing about the account behind the profile.
  assert.deepEqual(Object.keys(all.items[0]).sort(),['acceptsApplications','approximateArea','approximateCity','category','coveredSlots','criticalConditions',
   'endsAt','executionLocationMode','id','legacyPin','minimumExperienceYears','pin','priceMode','publicTopology','publishedAt','requesterPriceRsd',
   'requesterProfileId','requiredLicenses','requiredSkills','requiredSlots','requiredTools','requiredVehicles','responseDeadline','scheduleKind','sortAt',
   'startsAt','status','title','urgent'].sort());
  assert.ok(!JSON.stringify(list).includes(pager.id)&&!JSON.stringify(list).includes(owner.id),'an account id is in the public result');
  // The relation is an overlay: the public result is the same for whoever asks.
  assert.deepEqual((await read(pager.client,200)).items,(await read(worker.client,200)).items);
  // Index. The new partial GiST index serves the viewport; the existing one, partial on PUBLISHED alone, cannot.
  const viewport=`select m.id from public.needs m where m.status in ('PUBLISHED','SELECTION') and m.approx_geog OPERATOR(extensions.&&)
   extensions.ST_MakeEnvelope(19.89,43.89,20.11,44.11,4326)::extensions.geography`;
  // Two partial indexes match the open set. On a table of a few rows the planner rightly prefers the
  // small btree and filters; the question here is whether the GiST index CAN carry the viewport
  // condition, so the btree is set aside inside a transaction that rolls back.
  notes.viewportPlanAsPlannedToday=sql(`begin;set local enable_seqscan=off;explain ${viewport};rollback;`);
  const plan=sql(`begin;drop index public.needs_open_published_idx;set local enable_seqscan=off;explain ${viewport};rollback;`);
  assert.match(plan,/needs_open_geog_idx/,'the viewport query cannot use the new index: '+plan);
  assert.match(plan,/Index Cond: \(approx_geog && /,'the viewport condition is not an index condition: '+plan);
  const without=sql(`begin;drop index public.needs_open_geog_idx;drop index public.needs_open_published_idx;set local enable_seqscan=off;explain ${viewport};rollback;`);
  assert.ok(!/needs_approx_geog_idx/.test(without),'the existing partial index serves the open set after all: '+without);
  notes.viewportPlan=plan;notes.viewportPlanWithoutNewIndexes=without;
  // The same question for the list: can its index deliver the order, so that a page is an ordered index
  // scan that stops at the limit and never a sort of every open task.
  const ordered=sql(`begin;drop index public.needs_open_geog_idx;set local enable_seqscan=off;set local enable_bitmapscan=off;set local enable_sort=off;
   explain select m.id from public.needs m where m.status in ('PUBLISHED','SELECTION') order by m.published_at desc,m.id desc limit 51;rollback;`);
  assert.match(ordered,/Index (Only )?Scan using needs_open_published_idx/,'the list order cannot use its index: '+ordered);
  assert.ok(!/Sort/.test(ordered),'the list page still sorts: '+ordered);
  notes.listPlan=ordered;
 });

 await section('S5_TASK_RELATIONS_OVERLAY_NO_ORACLE',async()=>{
  // A draft of the owner's that nobody else can see, made here so the section stands on its own.
  const hiddenDraft=randomUUID(),nowhere=randomUUID(),ownerProfile=await profile(owner,'REQUESTER');
  sql(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind)
   values(${q(hiddenDraft)}::uuid,${q(owner.id)}::uuid,${q(ownerProfile)}::uuid,'DRAFT','PKG023 hidden draft','proof','PROOF','OFFERS',1,'FLEXIBLE')`);
  const asked=[T1.needId,T2.needId,T3.needId,hiddenDraft,nowhere,legacy.needId];
  const mine=await ok(owner.client.rpc('rpc_get_my_task_relations',{p_need_ids:asked}));
  assert.deepEqual(mine.items.map(x=>[x.needId,x.relation]).sort(),[[T1.needId,'OWNER'],[T2.needId,'OWNER'],[T3.needId,'OWNER'],[hiddenDraft,'OWNER']].sort());
  const theirs=await ok(worker.client.rpc('rpc_get_my_task_relations',{p_need_ids:asked}));
  const byNeed=Object.fromEntries(theirs.items.map(x=>[x.needId,x]));
  assert.deepEqual(Object.keys(byNeed).sort(),[T1.needId,T2.needId,T3.needId].sort());
  assert.deepEqual(byNeed[T1.needId],{needId:T1.needId,relation:'APPLIED',applicationId:A1.responseId,applicationState:'SELECTED',agreementId:G1});
  assert.deepEqual(byNeed[T3.needId],{needId:T3.needId,relation:'APPLIED',applicationId:A3.responseId,applicationState:'SUBMITTED',agreementId:null});
  // Not an oracle: a draft the caller cannot see, a task that does not exist and an unrelated task are all simply absent.
  const none=await ok(stranger.client.rpc('rpc_get_my_task_relations',{p_need_ids:asked}));assert.deepEqual(none.items,[]);
  assert.deepEqual(Object.keys(none).sort(),['asOf','items']);
  await refused(worker.client.rpc('rpc_get_my_task_relations',{p_need_ids:Array.from({length:101},()=>randomUUID())}),'INVALID_INPUT');
  await refused(worker.client.rpc('rpc_get_my_task_relations',{p_need_ids:[]}),'INVALID_INPUT');
  await refused(anon.rpc('rpc_get_my_task_relations',{p_need_ids:[T1.needId]}));
  // The same vocabulary as the unpaged list.
  const unpaged=await ok(worker.client.rpc('rpc_list_my_applications'));
  for(const item of theirs.items)assert.equal(item.applicationState,unpaged.find(x=>x.applicationId===item.applicationId).state);
 });

 await section('S6_OWN_READS_PAGED_KEYSET_IMMUTABLE_KEYS_SCOPES_PENDING_CHANGE',async()=>{
  const page=(client,fn)=>(limit,cursor,scope='ALL')=>ok(client.rpc(fn,{p_scope:scope,p_limit:limit,p_before_at:cursor?.at??null,p_before_id:cursor?.id??null}));
  // -- my tasks -----------------------------------------------------------------------------------
  const lister=await actor('pkg023-lister'),pid=await profile(lister,'REQUESTER'),drafts=[];
  for(let i=0;i<7;i++){const id=randomUUID();drafts.push(id);
   sql(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind,created_at)
    values(${q(id)}::uuid,${q(lister.id)}::uuid,${q(pid)}::uuid,'DRAFT',${q('PKG023 draft '+i)},'proof','PROOF','OFFERS',1,'FLEXIBLE',statement_timestamp()-make_interval(mins=>${100+i}))`);}
  const needs=page(lister.client,'rpc_list_my_needs_page');let late;
  const needPages=await walk((l,c)=>needs(l,c,'ACTIVE'),3,async first=>{
   assert.deepEqual(ids(first),drafts.slice(0,3));
   late=randomUUID();sql(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind)
    values(${q(late)}::uuid,${q(lister.id)}::uuid,${q(pid)}::uuid,'DRAFT','PKG023 draft between pages','proof','PROOF','OFFERS',1,'FLEXIBLE')`);
   await ok(lister.client.from('needs').update({title:'PKG023 draft 5 renamed between pages'}).eq('id',drafts[5]).select('id'));
  });
  const openBefore=(await needs(100,null,'ACTIVE')).items.map(x=>x.id).filter(id=>!drafts.includes(id)&&id!==late);
  assertExactlyOnce(flat(needPages).filter(id=>drafts.includes(id)),drafts,'my tasks');
  assert.ok(!flat(needPages).includes(late),'a task created between pages appeared in a later page');
  assert.equal((await needs(1,null,'ACTIVE')).items[0].id,late,'a fresh first page does not start with the newest task');
  // Scopes partition the rows.
  sql(`begin;select set_config('uskoci.need_lifecycle','CANCEL_NEED',true);update public.needs set status='CANCELLED' where id=${q(drafts[6])}::uuid;commit;`);
  const active=ids(await needs(100,null,'ACTIVE')),history=ids(await needs(100,null,'HISTORY')),every=ids(await needs(100,null,'ALL'));
  assert.ok(history.includes(drafts[6])&&!active.includes(drafts[6]));
  assert.deepEqual([...active,...history].sort(),[...every].sort());assert.equal(new Set(every).size,every.length);
  // Own rows only, and the input contract.
  assert.ok(!ids(await page(worker.client,'rpc_list_my_needs_page')(100,null)).some(id=>drafts.includes(id)),'another account received my tasks');
  for(const fn of ['rpc_list_my_needs_page','rpc_list_my_applications_page','rpc_list_my_agreements_page']){
   for(const args of [{p_limit:0},{p_limit:101},{p_before_at:new Date().toISOString()},{p_before_id:randomUUID()}])await refused(pager.client.rpc(fn,args),'INVALID_PAGE');
   await refused(pager.client.rpc(fn,{p_scope:'MINE'}),'INVALID_SCOPE');await refused(anon.rpc(fn,{}));
  }
  // What happens if the sort key of a row changes between two pages. No server function rewrites
  // needs.created_at; the owner of a DRAFT can, through the table grant. The proof records which.
  const firstTwo=await needs(2,null,'ACTIVE'),unseen=(await needs(100,null,'ACTIVE')).items.map(x=>x.id).find(id=>!ids(firstTwo).includes(id)&&drafts.includes(id));
  const moved=await lister.client.from('needs').update({created_at:new Date(Date.now()+3600000).toISOString()}).eq('id',unseen).select('id');
  notes.ownerCanRewriteCreatedAtOfOwnDraft=!moved.error&&moved.data.length===1;
  if(notes.ownerCanRewriteCreatedAtOfOwnDraft){
   const last=firstTwo.items.at(-1),rest=await walk((l,c)=>needs(l,c??{at:last.sortAt,id:last.id},'ACTIVE'),100);
   assert.ok(!flat(rest).includes(unseen),'the moved row should be absent from the remaining pages of that walk');
   assert.equal((await needs(1,null,'ACTIVE')).items[0].id,unseen,'and first in a fresh walk');
   assert.ok(!ids(await page(worker.client,'rpc_list_my_needs_page')(100,null)).includes(unseen),'only the owner\'s own list is affected');
  }

  // -- my applications ----------------------------------------------------------------------------
  const applications=page(worker.client,'rpc_list_my_applications_page'),expected=[A3.responseId,A2.responseId,A1.responseId];
  const applicationPages=await walk((l,c)=>applications(l,c),2,async first=>{
   assert.deepEqual(ids(first),expected.slice(0,2));
   // A re-submission rewrites submitted_at (rpc_submit_response, rpc_resolve_stale_response_after_need_edit).
   // The page is keyed on created_at, so the row that has not been seen yet stays where it was.
   sql(`begin;alter table public.marketplace_responses disable trigger user;update public.marketplace_responses set submitted_at=statement_timestamp()+interval '1 hour'
    where id=${q(A1.responseId)}::uuid;alter table public.marketplace_responses enable trigger user;commit;`);
  });
  assert.equal(applicationPages.length,2);assertExactlyOnce(flat(applicationPages),expected,'my applications');
  const unpaged=await ok(worker.client.rpc('rpc_list_my_applications'));
  for(const item of applicationPages.flatMap(p=>p.items)){const same=unpaged.find(x=>x.applicationId===item.applicationId);
   for(const key of ['needId','state','priceRsd','coveredSlots','agreementId','canWithdraw','attentionRequired','title'])assert.deepEqual(item[key],same[key],key);}
  assert.deepEqual(ids(await applications(100,null,'ACTIVE')).sort(),[...expected].sort());assert.deepEqual(ids(await applications(100,null,'HISTORY')),[]);
  assert.deepEqual(ids(await page(owner.client,'rpc_list_my_applications_page')(100,null)),[],'the owner of the tasks received the applications as its own');
  assert.match(sql(`begin;set local enable_seqscan=off;explain select r.id from public.marketplace_responses r where r.worker_account_id=${q(worker.id)}::uuid
   and r.status<>'DRAFT' order by r.created_at desc,r.id desc limit 31;rollback;`),/marketplace_responses_worker_idx/);

  // -- my Dogovori, both sides, and the pending change (C) ------------------------------------------
  const mineAsOwner=page(owner.client,'rpc_list_my_agreements_page'),mineAsWorker=page(worker.client,'rpc_list_my_agreements_page');
  const agreementPages=await walk((l,c)=>mineAsOwner(l,c),1);assert.equal(agreementPages.length,2);assertExactlyOnce(flat(agreementPages),[G1,G2],'my Dogovori');
  assert.deepEqual(ids(await mineAsWorker(100,null)),ids(await mineAsOwner(100,null)));assert.deepEqual(ids(await page(stranger.client,'rpc_list_my_agreements_page')(100,null)),[]);
  const legacyList=await ok(owner.client.rpc('rpc_list_my_agreements'));
  for(const item of (await mineAsOwner(100,null)).items){const same=legacyList.find(x=>x.id===item.id);
   for(const key of ['status','agreementStatus','title','startsAt','terms','requesterAccountId','workerAccountId','requesterName','workerName','currentVersion'])assert.deepEqual(item[key],same[key],key);
   assert.equal(item.pendingChange,null);}
  const proposal=await ok(worker.client.rpc('rpc_propose_agreement_change_v2',{p_agreement_id:G1,p_expected_version:1,p_patch:{price_rsd:3500},p_reason:'PKG023 proof',p_client_request_id:randomUUID()}));
  const seenByOwner=(await mineAsOwner(100,null)).items.find(x=>x.id===G1),seenByWorker=(await mineAsWorker(100,null)).items.find(x=>x.id===G1);
  assert.equal(seenByOwner.pendingChange.proposedByMe,false);assert.equal(seenByWorker.pendingChange.proposedByMe,true);
  assert.equal(seenByOwner.pendingChange.id,seenByWorker.pendingChange.id);notes.proposalReceipt=typeof proposal;
  assert.equal((await mineAsOwner(100,null)).items.find(x=>x.id===G2).pendingChange,null);
  await ok(owner.client.rpc('rpc_respond_agreement_change',{p_proposal_id:seenByOwner.pendingChange.id,p_accept:false}));
  assert.equal((await mineAsOwner(100,null)).items.find(x=>x.id===G1).pendingChange,null);
  assert.deepEqual(ids(await mineAsOwner(100,null,'ACTIVE')).sort(),[G1,G2].sort());assert.deepEqual(ids(await mineAsOwner(100,null,'HISTORY')),[]);
  void openBefore;
 });
}

const result={unit:'PKG023_V3_BACKEND',result:failures.length?'FAIL':'PASS',sourceSha:process.env.GITHUB_SHA,actualAuth:true,actualDatabase:true,
 liveAccess:false,providerCalled:false,candidatesPresent:present==='true',checks,failures,notes};
mkdirSync(out,{recursive:true});writeFileSync(out+'/pkg023-v3-backend-report.json',JSON.stringify(result,null,2)+'\n');
console.log(result.result+' PKG023_V3_BACKEND '+checks.length+' passed, '+failures.length+' failed');
if(failures.length)process.exitCode=1;
