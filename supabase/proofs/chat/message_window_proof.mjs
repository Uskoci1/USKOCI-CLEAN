// Chat B3b proof SOURCE ONLY — NOT RUN. No workflow, provider or Storage IO.
// Requires a separately prepared local predecessor through A1 AND amended B3a.
// This source applies only B3b to that disposable database; it does not replay DEV.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
const { assert, sql, rows, q, randomUUID, ok, denied, env }=rt;
const WINDOW='public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)';
const candidatePath='supabase/candidates/chat_b3b_message_window.sql';
const closure=()=>rows(`select private.closure_source_digest_v5() live,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) certificate,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
  private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5() binding,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition`)[0];
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const noReadEffects=()=>Object.fromEntries([
  ['messages','select id,read_at from public.agreement_messages order by id'],
  ['events','select * from public.user_activity_events order by id'],
  ['deliveries','select * from public.notification_deliveries order by id'],
  ['attempts','select * from public.notification_push_attempts order by id'],
].map(([name,query])=>[name,rows(query)]));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const idsOf=page=>page.messages.map(message=>message.messageId);
const cursorOf=message=>({createdAt:message.createdAt,messageId:message.messageId});

await rt.prove('CHAT_B3B_EXACT_MESSAGE_WINDOW','chat-b3b-report.json',async report=>{
  assert.equal(env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
  report.providerCalls=0;report.storageCalls=0;report.deviceProven=false;report.incomingStreamProven=false;
  report.requiredPredecessor='Separately replayed admitted chain through A1 plus amended B3a; no replay in this script.';
  report.sourceArtifactHashes={};
  for(const path of [candidatePath,'supabase/candidates/chat_b3a_private_history_read.sql',
    'supabase/proofs/chat/message_window_proof.mjs','supabase/proofs/pre_v3/closure_runtime.mjs',
    'supabase/proofs/pkg023/pkg023_surface.sql']){
    const bytes=readFileSync(path);
    assert.deepEqual(bytes,execFileSync('git',['show',env.GITHUB_SHA+':'+path]),'SOURCE_BYTES_DIFFER:'+path);
    report.sourceArtifactHashes[path]=createHash('sha256').update(bytes).digest('hex');
  }
  const candidate=readFileSync(candidatePath,'utf8'),before=surface(),certified=closure();
  report.candidateSha256=report.sourceArtifactHashes[candidatePath];report.closureBefore=certified;
  assert.equal(certified.ready,true);assert.equal(certified.live,certified.certificate.sha256);
  assert.equal(certified.live,certified.erasure.sha256);
  assert.equal(sql(`select (to_regprocedure(${q(WINDOW)}) is null)::text`),'true');
  const intact=()=>{assert.deepEqual(surface(),before);assert.deepEqual(closure(),certified);};
  assert.throws(()=>sql(candidate.replace('912f1c7e4df9c8c933351f45bd1fa1c5','0'.repeat(32))),/CHAT_B3B_PREDECESSOR_DRIFT/);intact();
  assert.throws(()=>sql(candidate.replace("'targetMessageId',p_target_message_id", "'targetMessageId', p_target_message_id")),/CHAT_B3B_FUNCTION_MISMATCH/);intact();
  sql(candidate);assert.throws(()=>sql(candidate),/CHAT_B3B_ALREADY_APPLIED/);await pause(1500);
  const after=surface(),added=after.filter(line=>!before.includes(line));
  assert.deepEqual(before.filter(line=>!after.includes(line)),[]);assert.equal(added.length,1);
  assert.ok(added[0].startsWith('function:public.rpc_read_agreement_message_window_v1('));
  assert.equal(sql(`select has_function_privilege('anon',${q(WINDOW)},'EXECUTE')::text||has_function_privilege('authenticated',${q(WINDOW)},'EXECUTE')::text||has_function_privilege('service_role',${q(WINDOW)},'EXECUTE')::text`),'falsetruefalse');
  assert.deepEqual(closure(),certified);report.surfaceAdded=added;
  rt.pass(report,'EXACT_B3A_AND_BODY_PINS_ONE_ADDITIVE_READ_RPC_UNCHANGED_CERTIFICATE_AND_AUTHORITY');

  const requester=await rt.actor('chat-b3b-requester'),worker=await rt.actor('chat-b3b-worker'),stranger=await rt.actor('chat-b3b-stranger');
  const profile=(actor,kind)=>rows(`select id from public.app_profiles where account_id=${q(actor.id)} and kind=${q(kind)}`)[0].id;
  const requesterProfile=profile(requester,'REQUESTER'),workerProfile=profile(worker,'WORKER');
  sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${q(workerProfile)}`);
  await ok(worker.client.rpc('rpc_complete_worker_profile',{p_profile_id:workerProfile}));
  async function agreement(label){
    const needId=randomUUID();
    sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
        approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
      values(${q(needId)},${q(requester.id)},${q(requesterProfile)},'PUBLISHED',${q(label)},'Disposable window proof',
        'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
    const offer=await ok(worker.client.rpc('rpc_submit_response',{p_need_id:needId,p_need_revision:1,p_worker_profile_id:workerProfile,
      p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()}));
    return ok(requester.client.rpc('rpc_select_response',{p_need_id:needId,p_need_revision:offer.needRevision,p_response_id:offer.responseId,
      p_response_version:offer.version,p_content_hash:offer.contentHash,p_client_request_id:randomUUID()}));
  }
  const agreementId=await agreement('Chat B3b window'),otherAgreementId=await agreement('Chat B3b foreign');
  const window=(target,actor=requester,beforeCount=24,afterCount=25,id=agreementId)=>actor.client.rpc('rpc_read_agreement_message_window_v1',{
    p_expected_user_id:actor.id,p_agreement_id:id,p_target_message_id:target,p_before_count:beforeCount,p_after_count:afterCount});
  const send=(actor,body,id=agreementId)=>ok(actor.client.rpc('rpc_send_agreement_message_v2',{
    p_expected_user_id:actor.id,p_agreement_id:id,p_client_message_id:randomUUID(),p_body:body}));
  const initial=noReadEffects();
  await denied(window(randomUUID()),'CHAT_MESSAGE_NOT_AVAILABLE');assert.deepEqual(noReadEffects(),initial);
  const fixtureIds=Array.from({length:121},()=>randomUUID());
  sql(`insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body,created_at)
    select x.id,${q(agreementId)},1,${q(worker.id)},'Window fixture '||x.ord,
      date_trunc('day',statement_timestamp())-interval '1 day'+((x.ord/3)::integer)*interval '1 microsecond'
    from unnest(array[${fixtureIds.map(q).join(',')}]::uuid[]) with ordinality x(id,ord);`);
  const expectedRows=rows(`select id,to_jsonb(created_at) as created_at from public.agreement_messages where agreement_id=${q(agreementId)} order by created_at,id`);
  const expected=expectedRows.map(row=>row.id),expectedTime=new Map(expectedRows.map(row=>[row.id,row.created_at]));
  assert.ok(expectedRows.some(row=>/\.000001[+-]/.test(row.created_at)));
  const oldTarget=expected[40],stable=noReadEffects();
  const newest=await ok(requester.client.rpc('rpc_read_agreement_messages_page_v1',{
    p_expected_user_id:requester.id,p_agreement_id:agreementId,p_limit:50}));
  assert.equal(idsOf(newest).includes(oldTarget),false);
  for(const [index,beforeCount,afterCount] of [[40,24,25],[0,24,25],[120,24,25],[40,0,0],[40,0,49],[80,49,0],[40,3,7]]){
    const target=expected[index],page=await ok(window(target,requester,beforeCount,afterCount));
    const low=Math.max(0,index-beforeCount),high=Math.min(expected.length,index+afterCount+1);
    assert.equal(page.schema,'AGREEMENT_MESSAGE_WINDOW_V1');assert.equal(page.accountId,requester.id);
    assert.equal(page.agreementId,agreementId);assert.equal(page.targetMessageId,target);assert.equal(page.authoritative,true);
    assert.equal(typeof page.asOf,'string');assert.deepEqual(idsOf(page),expected.slice(low,high));
    assert.equal(idsOf(page).filter(id=>id===target).length,1);assert.ok(page.messages.length<=50);
    assert.deepEqual(page.beforeCursor,low>0?cursorOf(page.messages[0]):null);
    assert.deepEqual(page.afterCursor,high<expected.length?cursorOf(page.messages.at(-1)):null);
    for(const message of page.messages){
      assert.equal(message.kind,'TEXT');assert.equal(message.mine,false);assert.deepEqual(message.photos,[]);
      assert.equal(message.createdAt,expectedTime.get(message.messageId)); // Raw timestamp precision; no JS Date conversion.
      assert.deepEqual(Object.keys(message).sort(),['messageId','agreementVersion','senderAccountId','clientMessageId','body','createdAt','kind','mine','photos'].sort());
    }
  }
  const centered=await ok(window(oldTarget));
  const older=await ok(requester.client.rpc('rpc_read_agreement_messages_page_v1',{
    p_expected_user_id:requester.id,p_agreement_id:agreementId,p_limit:50,
    p_before_created_at:centered.beforeCursor.createdAt,p_before_id:centered.beforeCursor.messageId}));
  assert.deepEqual(idsOf(older),expected.slice(0,16));
  const forward=await ok(window(centered.afterCursor.messageId,requester,0,49));
  assert.equal(forward.messages[0].messageId,centered.messages.at(-1).messageId);
  assert.deepEqual([...idsOf(centered),...idsOf(forward).slice(1)],expected.slice(16,115));
  assert.deepEqual(noReadEffects(),stable);
  rt.pass(report,'OLD_TARGET_NEAREST_BOUNDED_WINDOW_TIES_MICROSECONDS_EDGES_ZERO_SIDES_AND_INCLUSIVE_REANCHOR');

  const foreign=await send(worker,'Foreign target',otherAgreementId),unread=await send(worker,'Unread target'),own=await send(requester,'Own target');
  const beforeRefusals=noReadEffects();
  for(const [beforeCount,afterCount] of [[null,1],[1,null],[-1,1],[1,-1],[50,0],[0,50],[25,25],[2147483647,2147483647]])
    await denied(window(oldTarget,requester,beforeCount,afterCount),'CHAT_WINDOW_INVALID');
  for(const target of [null,randomUUID(),foreign])await denied(window(target),'CHAT_MESSAGE_NOT_AVAILABLE');
  await denied(window(oldTarget,stranger),'MEDIA_NOT_FOUND');
  await denied(window(oldTarget,requester,24,25,randomUUID()),'MEDIA_NOT_FOUND');
  await denied(requester.client.rpc('rpc_read_agreement_message_window_v1',{
    p_expected_user_id:worker.id,p_agreement_id:agreementId,p_target_message_id:oldTarget}),'AUTH_CONTEXT_CHANGED');
  await denied(rt.anon.rpc('rpc_read_agreement_message_window_v1',{
    p_expected_user_id:requester.id,p_agreement_id:agreementId,p_target_message_id:oldTarget}));
  assert.equal((await ok(window(own,requester,0,0))).messages[0].mine,true);
  assert.equal((await ok(window(own,worker,0,0))).messages[0].mine,false);
  await ok(window(unread));assert.deepEqual(noReadEffects(),beforeRefusals);
  rt.pass(report,'INVALID_BOUNDS_TARGET_SCOPE_EXPECTED_ACCOUNT_AND_ANON_REFUSALS_NO_READ_OR_DELIVERY_EFFECTS');

  for(const [column,remaining,restoreId] of [['requester_account_id',worker,requester.id],['worker_account_id',requester,worker.id]]){
    sql(`update public.agreements set ${column}=null where id=${q(agreementId)}`);
    try{
      const beforeNullReads=noReadEffects();
      await denied(window(oldTarget,stranger),'MEDIA_NOT_FOUND');
      assert.equal((await ok(window(oldTarget,remaining,0,0))).targetMessageId,oldTarget);
      assert.deepEqual(noReadEffects(),beforeNullReads);assert.deepEqual(closure(),certified);
    }finally{sql(`update public.agreements set ${column}=${q(restoreId)} where id=${q(agreementId)}`);}
  }
  sql(`update public.agreements set requester_account_id=null,worker_account_id=null where id=${q(agreementId)}`);
  try{
    const beforeBothNull=noReadEffects();
    for(const actor of [requester,worker,stranger])await denied(window(oldTarget,actor),'MEDIA_NOT_FOUND');
    assert.deepEqual(noReadEffects(),beforeBothNull);
  }finally{sql(`update public.agreements set requester_account_id=${q(requester.id)},worker_account_id=${q(worker.id)} where id=${q(agreementId)}`);}
  rt.pass(report,'EACH_AND_BOTH_NULL_PARTICIPANTS_REFUSE_OUTSIDERS_RETAIN_REMAINING_PARTY_NO_READ_EFFECT');

  // Metadata-only fixture. This does not upload, download or play private media.
  const assetId=randomUUID(),outputHash='b'.repeat(64);
  sql(`insert into private.agreement_photo_uploads_v5(id,account_id,agreement_id,agreement_version,client_request_id,state,
    input_sha256,input_bytes,input_type,admitted_at,sanitized_sha256,storage_path,width,height,byte_size,dispatch_state,dispatch_outcome)
    values(${q(assetId)},${q(worker.id)},${q(agreementId)},1,${q(randomUUID())},'READY',${q('a'.repeat(64))},12,'image/jpeg',clock_timestamp(),
      ${q(outputHash)},${q(worker.id+'/agreement-v5/'+assetId+'/'+outputHash+'.jpg')},10,10,12,'SETTLED','STORED');`);
  const photo=await ok(worker.client.rpc('rpc_send_agreement_photo_message_v5',{p_expected_user_id:worker.id,p_agreement_id:agreementId,
    p_expected_version:1,p_client_message_id:randomUUID(),p_body:'',p_asset_ids:[assetId]}));
  const photoState=noReadEffects(),photoPage=await ok(window(photo.messageId,requester,0,0)),photoRow=photoPage.messages[0];
  assert.equal(photoRow.kind,'PHOTO');assert.equal(photoRow.body,'');assert.equal(photoRow.messageId,photo.messageId);
  assert.deepEqual(photoRow.photos,[{assetId,width:10,height:10,byteSize:12,contentType:'image/jpeg'}]);
  assert.deepEqual(Object.keys(photoRow).sort(),['messageId','agreementVersion','senderAccountId','clientMessageId','body','createdAt','kind','mine','photos'].sort());
  assert.deepEqual(noReadEffects(),photoState);
  // Corrupt only the disposable attachment link, preserving table constraints.
  sql(`begin;set local session_replication_role=replica;update private.agreement_photo_uploads_v5 set attached_message_id=${q(oldTarget)} where id=${q(assetId)};commit;`);
  try{await denied(window(photo.messageId),'MEDIA_MESSAGE_LINK_INCOMPLETE');assert.deepEqual(noReadEffects(),photoState);}
  finally{sql(`begin;set local session_replication_role=replica;update private.agreement_photo_uploads_v5 set attached_message_id=${q(photo.messageId)} where id=${q(assetId)};commit;`);}
  rt.pass(report,'EXACT_PHOTO_TARGET_ALLOWLIST_AND_BAD_ATTACHMENT_REFUSAL_WITHOUT_ACKNOWLEDGEMENT');

  const earlier=await ok(window(oldTarget)),arrival=await send(worker,'Later arrival');
  const afterArrival=noReadEffects(),later=await ok(window(oldTarget));
  assert.deepEqual(idsOf(later),idsOf(earlier));assert.equal(later.targetMessageId,oldTarget);
  assert.equal((await ok(window(arrival,requester,0,0))).targetMessageId,arrival);
  assert.deepEqual(noReadEffects(),afterArrival);
  sql(`update public.agreements set status='COMPLETED' where id=${q(agreementId)}`);
  const terminal=noReadEffects();assert.equal((await ok(window(oldTarget))).targetMessageId,oldTarget);
  assert.deepEqual(noReadEffects(),terminal);
  const session=(await requester.client.auth.getSession()).data.session;assert.ok(session);
  const retired=rt.make();await ok(retired.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}));
  await ok(requester.client.auth.signOut());
  const afterLogout=noReadEffects();
  await denied(retired.rpc('rpc_read_agreement_message_window_v1',{
    p_expected_user_id:requester.id,p_agreement_id:agreementId,p_target_message_id:oldTarget}),'AUTH_REQUIRED');
  assert.deepEqual(noReadEffects(),afterLogout);assert.deepEqual(closure(),certified);report.closureAfter=closure();
  rt.pass(report,'LATER_COMMITTED_ARRIVAL_TERMINAL_HISTORY_RETIRED_SESSION_AND_UNCHANGED_READ_AND_CLOSURE');
});
