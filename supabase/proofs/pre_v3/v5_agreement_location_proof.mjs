// Actual disposable Auth/Postgres proof of D0144 foreground snapshots.
// No GPS, tracking, device permission, AI, provider or live endpoint is used.
import {createHash} from 'node:crypto';
import {assert,sql,rows,q,ok,denied,requester,worker,anon,service,requesterId,workerId,
 login,prove,apply,pass,agreement,actor,lockedRace,randomUUID} from './closure_runtime.mjs';
const R={client:requester,id:requesterId},W={client:worker,id:workerId};
const point=()=>({latitude:45.251234,longitude:19.841234,accuracyMeters:12.5,capturedAt:'2020-01-02T03:04:05.000Z'});
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const command=(a,id,kind='SHARE',p=kind==='SHARE'?point():null,version=1,key=randomUUID())=>({p_expected_user_id:a.id,p_agreement_id:id,
 p_agreement_version:version,p_client_request_id:key,p_kind:kind,p_input_sha256:digest({id,version,kind,point:p}),p_point:p,p_cancel:false});
const write=(a,c)=>a.client.rpc('rpc_write_agreement_current_location',c);
const read=(a,id)=>ok(a.client.rpc('rpc_read_agreement_current_location',{p_expected_user_id:a.id,p_agreement_id:id}));
const recover=(a,c)=>ok(a.client.rpc('rpc_read_agreement_location_command',{p_expected_user_id:a.id,p_agreement_id:c.p_agreement_id,p_client_request_id:c.p_client_request_id}));
async function closedHttp(p){const r=await p;await denied(Promise.resolve(r),'ACCOUNT_CLOSING');assert.equal(r.status,403);assert.equal(r.error.code,'42501');assert.equal(r.data,null);}
const asActor=a=>`select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claim.role','authenticated',true);`;
const writeSql=(a,c)=>`${asActor(a)}select public.rpc_write_agreement_current_location(${q(a.id)}::uuid,${q(c.p_agreement_id)}::uuid,${c.p_agreement_version},${q(c.p_client_request_id)}::uuid,${q(c.p_kind)},${q(c.p_input_sha256)},${c.p_point===null?'null':q(JSON.stringify(c.p_point))+'::jsonb'},${c.p_cancel})`;
const count=id=>Number(sql(`select count(*) from private.agreement_location_points p join private.agreement_location_commands c using(actor_account_id,client_request_id) where c.agreement_id=${q(id)}::uuid`));
const noAccess=r=>{assert.equal(r.canShare,false);assert.equal(r.canRequest,false);assert.equal(r.point,null);assert.equal(r.requestedAt,null);};
const receipt=r=>{assert.deepEqual(Object.keys(r).sort(),['agreementId','agreementVersion','clientRequestId','kind','state','inputSha256','recordedAt','authoritative'].sort());assert.equal(r.authoritative,true);assert.ok(!JSON.stringify(r).includes('latitude'));};
const blockState=()=>ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));
async function block(value){const s=await blockState();return ok(requester.rpc('rpc_set_account_block',{p_target_account_id:workerId,p_blocked:value,p_expected_revision:s.revision,p_client_request_id:randomUUID()}));}
async function blockSql(){const s=await blockState();return `${asActor(R)}select public.rpc_set_account_block(${q(workerId)}::uuid,true,${s.revision},${q(randomUUID())}::uuid)`;}

await prove('V5_AGREEMENT_LOCATION_SNAPSHOT','v5-agreement-location-report.json',async report=>{
 await apply(report,'20260913002428_clean_v5_agreement_location_snapshot.sql',137);await login();
 const outsider=await actor('location138-outsider'),g=await agreement('location138 physical'),id=g.id;
 for(const table of ['agreement_location_commands','agreement_location_points']){
  assert.equal(sql(`select relrowsecurity and relforcerowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');
  for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
 }
 const c=command(W,id),absent=await recover(W,c);assert.deepEqual(absent,{found:false,command:null});assert.equal(count(id),0);
 for(const client of [anon,service]){
  await denied(client.rpc('rpc_read_agreement_current_location',{p_expected_user_id:workerId,p_agreement_id:id}));
  await denied(client.rpc('rpc_write_agreement_current_location',c));
  await denied(client.rpc('rpc_read_agreement_location_command',{p_expected_user_id:workerId,p_agreement_id:id,p_client_request_id:c.p_client_request_id}));
 }
 await denied(outsider.client.rpc('rpc_read_agreement_current_location',{p_expected_user_id:outsider.id,p_agreement_id:id}),'AGREEMENT_NOT_AVAILABLE');
 await denied(outsider.client.rpc('rpc_write_agreement_current_location',{...c,p_expected_user_id:outsider.id}),'AGREEMENT_NOT_AVAILABLE');
 await denied(requester.rpc('rpc_read_agreement_current_location',{p_expected_user_id:workerId,p_agreement_id:id}),'AUTH_CONTEXT_CHANGED');
 const wr=await read(W,id),rr=await read(R,id);assert.equal(wr.canShare,true);assert.equal(wr.canRequest,false);assert.equal(rr.canRequest,true);assert.equal(rr.canShare,false);assert.equal(rr.point,null);
 pass(report,'ACTUAL_AUTH_PARTICIPANTS_ONLY_PRIVATE_FORCE_RLS_NO_SERVICE_OR_ANON_OWNED_ABSENT_READ');

 const eventsBefore=sql(`select count(*) from public.user_activity_events`),request=command(R,id,'REQUEST');
 const requested=await ok(write(R,request));receipt(requested);assert.equal(requested.kind,'REQUEST');assert.equal(count(id),0);assert.equal((await read(W,id)).requestedAt,requested.recordedAt);
 assert.equal((await read(R,id)).point,null);assert.deepEqual(await ok(write(R,request)),requested);
 await denied(write(W,command(W,id,'REQUEST')),'LOCATION_NOT_AVAILABLE');await denied(write(R,command(R,id)),'LOCATION_NOT_AVAILABLE');
 await denied(write(R,{...command(R,id,'REQUEST'),p_point:point()}),'LOCATION_INPUT_INVALID');
 const shared=await ok(write(W,c));receipt(shared);assert.equal(shared.state,'COMMITTED');assert.equal(count(id),1);assert.deepEqual(await recover(W,c),{found:true,command:shared});
 assert.deepEqual(await recover(R,c),{found:false,command:null});
 const snapshot=(await read(R,id)).point;assert.deepEqual(Object.keys(snapshot).sort(),['latitude','longitude','accuracyMeters','capturedAt','sharedAt'].sort());
 assert.equal(snapshot.latitude,c.p_point.latitude);assert.equal(snapshot.longitude,c.p_point.longitude);assert.equal(snapshot.accuracyMeters,12.5);
 assert.equal(Date.parse(snapshot.capturedAt),Date.parse(c.p_point.capturedAt));assert.ok(Date.parse(snapshot.sharedAt)>Date.parse(snapshot.capturedAt));
 assert.deepEqual(await ok(write(W,c)),shared);assert.equal(count(id),1);assert.equal(sql(`select count(*) from public.user_activity_events`),eventsBefore);
 await denied(write(W,{...c,p_point:{...point(),latitude:46}}),'LOCATION_KEY_REUSED');await denied(write(W,{...c,p_input_sha256:'f'.repeat(64)}),'LOCATION_KEY_REUSED');
 pass(report,'REQUEST_WRITES_NO_POINT_SHARE_EXACT_PRIVATE_SNAPSHOT_OLD_CAPTURE_REMAINS_OLD_IMMUTABLE_RECEIPT_NO_PUSH');

 for(const p of [null,[],{...point(),extra:'PRIVATE'},{...point(),latitude:'45'},{...point(),longitude:181},{...point(),accuracyMeters:-1},{...point(),capturedAt:'infinity'},{...point(),capturedAt:{private:'SECRET'}}])
  await denied(write(W,command(W,id,'SHARE',p)),'LOCATION_INPUT_INVALID');
 assert.equal(count(id),1);
 const tomb=command(W,id),late=await lockedRace(writeSql(W,{...tomb,p_point:null,p_cancel:true}),()=>write(W,tomb));const cancelled=await ok(Promise.resolve(late));receipt(cancelled);assert.equal(cancelled.state,'CANCELLED');
 assert.deepEqual((await recover(W,tomb)).command,cancelled);assert.equal(count(id),1);
 const winner=command(W,id,'SHARE',{...point(),latitude:45.26});const cancelledAfterCommit=await ok(lockedRace(writeSql(W,winner),()=>write(W,{...winner,p_point:null,p_cancel:true})));
 assert.equal(cancelledAfterCommit.state,'COMMITTED');assert.deepEqual((await recover(W,winner)).command,cancelledAfterCommit);assert.equal(count(id),2);
 assert.deepEqual(await ok(write(W,{...winner,p_point:null,p_cancel:true})),cancelledAfterCommit);
 pass(report,'STRICT_POINT_SHAPE_AND_OBSERVED_CANCEL_SHARE_BOTH_ORDERS_NO_LATE_RESURRECTION_OR_FALSE_CANCEL');

 const race=command(W,id,'SHARE',{...point(),latitude:45.27});await denied(lockedRace(await blockSql(),()=>write(W,race)),'INTERACTION_BLOCKED');
 noAccess(await read(R,id));noAccess(await read(W,id));assert.equal(count(id),2);await block(false);
 const afterUnblock=await read(R,id);assert.equal(afterUnblock.canRequest,true);assert.equal(afterUnblock.point,null);assert.equal(afterUnblock.requestedAt,null);
 assert.deepEqual(await ok(write(W,winner)),cancelledAfterCommit);assert.equal((await read(R,id)).point,null);
 const fresh=command(W,id,'SHARE',{...point(),latitude:45.28}),freshReceipt=await ok(write(W,fresh));assert.equal((await read(R,id)).point.latitude,45.28);
 pass(report,'OBSERVED_PAIR_BLOCK_RACE_OLD_SHARE_AND_REQUEST_PERMANENTLY_REVOKED_AFTER_UNBLOCK_FRESH_EXPLICIT_SHARE_ONLY');

 // Explicit disposable restriction fixtures, restored after each assertion.
 for(const account of [requesterId,workerId]){
  const before=rows(`select * from private.account_closure_requests where account_id=${q(account)}::uuid`)[0];
  const restriction=before?`update private.account_closure_requests set state='READY',closed_at=null where account_id=${q(account)}::uuid`:
   `insert into private.account_closure_requests(account_id,state,revision) values(${q(account)}::uuid,'READY',1)`;
  try{
   await denied(lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(account)}::uuid));${restriction}`,()=>write(W,command(W,id))),'ACCOUNT_CLOSING');
   //131 rejects a restricted caller before the138 RPC body. The open peer
   // reaches the body and receives a DTO with no location or affordances.
   for(const a of [R,W]){
    if(a.id===account)await closedHttp(a.client.rpc('rpc_read_agreement_current_location',{p_expected_user_id:a.id,p_agreement_id:id}));
    else noAccess(await read(a,id));
   }
   if(account===workerId){
    await closedHttp(worker.rpc('rpc_read_agreement_location_command',{p_expected_user_id:workerId,p_agreement_id:id,p_client_request_id:fresh.p_client_request_id}));
    await closedHttp(write(W,fresh));
   }else{assert.deepEqual((await recover(W,fresh)).command,freshReceipt);await denied(write(W,fresh),'ACCOUNT_CLOSING');}
   assert.equal(count(id),3);
  }finally{if(before)sql(`update private.account_closure_requests set state=${q(before.state)},closed_at=${before.closed_at?q(before.closed_at)+'::timestamptz':'null'} where account_id=${q(account)}::uuid`);else sql(`delete from private.account_closure_requests where account_id=${q(account)}::uuid`);}
  assert.deepEqual(await recover(W,fresh),{found:true,command:freshReceipt});
 }
 pass(report,'BOTH_PARTICIPANT_CLOSURE_BARRIERS_CLOSED_CALLER_HTTP403_OPEN_PEER_NO_POINT_NO_WRITE_EXACT_RECEIPT_AFTER_RESTORE');

 const proposal=await ok(requester.rpc('rpc_propose_agreement_change_v2',{p_agreement_id:id,p_expected_version:1,p_patch:{price_rsd:4321},p_reason:'Disposable location version proof',p_client_request_id:randomUUID()}));
 const accepted=await ok(worker.rpc('rpc_respond_agreement_change',{p_proposal_id:proposal,p_accept:true}));assert.equal(accepted.agreementVersion,2);
 const versioned=await read(R,id);assert.equal(versioned.agreementVersion,2);assert.equal(versioned.point,null);assert.equal(versioned.requestedAt,null);
 await denied(write(W,command(W,id)),'VERSION_CONFLICT');assert.deepEqual(await ok(write(W,fresh)),(await recover(W,fresh)).command);
 assert.equal((await read(R,id)).point,null);const v2=command(W,id,'SHARE',{...point(),latitude:45.29},2);await ok(write(W,v2));assert.equal((await read(R,id)).point.latitude,45.29);
 pass(report,'CANONICAL_ACCEPTED_AGREEMENT_REVISION_HIDES_OLD_POINTS_EXACT_REPLAY_DOES_NOT_REGRANT_OLD_VERSION');

 await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:id}));assert.equal((await read(R,id)).canRequest,true);
 await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:id}));noAccess(await read(R,id));noAccess(await read(W,id));await denied(write(W,command(W,id,'SHARE',point(),2)),'LOCATION_NOT_AVAILABLE');
 assert.deepEqual((await recover(W,v2)).command,await ok(write(W,v2)));
 const cg=await agreement('location138 cancellation');await ok(write(W,command(W,cg.id)));await ok(requester.rpc('rpc_cancel_agreement',{p_agreement_id:cg.id,p_reason:'Disposable location gate'}));noAccess(await read(R,cg.id));
 const remote=await agreement('location138 remote');sql(`update public.agreement_execution set mode='REMOTE' where agreement_id=${q(remote.id)}::uuid`);noAccess(await read(R,remote.id));noAccess(await read(W,remote.id));
 await denied(write(W,command(W,remote.id)),'LOCATION_NOT_AVAILABLE');await denied(write(R,command(R,remote.id,'REQUEST')),'LOCATION_NOT_AVAILABLE');assert.equal(count(remote.id),0);
  pass(report,'COMPLETION_AND_CANCELLATION_REVOKE_ACCESS_REMOTE_HAS_NO_LOCATION_AFFORDANCE_OR_WRITE');
 const catalog=JSON.parse(sql('select private.data_export_dataset_catalog()'));assert.equal(catalog.length,41);
 assert.equal(sql('select private.data_export_policy_binding() is null'),'t');
 // Privileged read-only projection fixture. It does not activate a delivery
 // policy, prepare an export, call a worker or create an artifact/download.
 const projectionFixture={delivery:{datasets:catalog.map(d=>({key:d.key,mode:'INCLUDE',fields:d.fields}))}};
 const projection=a=>JSON.parse(sql(`select private.data_export_snapshot(${q(a)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(projectionFixture))}::jsonb,clock_timestamp())`));
 const wd=projection(workerId),rd=projection(requesterId);assert.equal(wd.projectionVersion,'OWN_ACCOUNT_V5_3');assert.equal(Object.keys(wd.datasets).length,41);
 const ownPoints=wd.datasets.ownLocationSnapshots.filter(x=>x.agreementId===id);assert.equal(ownPoints.length,count(id));assert.ok(ownPoints.some(x=>x.latitude===45.29));
 assert.ok(!rd.datasets.ownLocationSnapshots.some(x=>x.agreementId===id));assert.ok(rd.datasets.ownLocationCommands.some(x=>x.agreementId===id&&x.kind==='REQUEST'));
 for(const row of ownPoints)assert.deepEqual(Object.keys(row).sort(),['agreementId','agreementVersion','latitude','longitude','accuracyMeters','capturedAt','sharedAt'].sort());
 for(const doc of [wd,rd])for(const row of doc.datasets.ownLocationCommands)assert.deepEqual(Object.keys(row).sort(),['agreementId','agreementVersion','kind','state','createdAt'].sort());
 for(const [name,kind] of [['agreement_location_points','NEED_SENSITIVE'],['agreement_location_commands','COMMAND_LEDGERS']])
  assert.equal(sql(`select ${q('private.'+name)}=any(relations) from private.closure_dataset_catalog_v5 where data_class=${q(kind)}`),'t');
 pass(report,'PRIVATE41_DATASET_OWN_ACCOUNT_V5_3_PROJECTION_EXPORTS_OWN_WORKER_POINT_ONLY_OLD_DELIVERY_BINDING_CLOSED');
 assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 pass(report,'TECHNICAL_CLOSURE_SOURCE_CURRENT_NO_RETENTION_DURATION_PROVIDER_OR_LOCATION_TRACKING');
});
