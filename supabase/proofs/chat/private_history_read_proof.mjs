// Chat B3a proof SOURCE ONLY — NOT RUN. No workflow is attached.
// Requires a separately prepared disposable predecessor through admitted A1.
// The existing runtime refuses non-local Auth/Postgres targets before IO.
// Fixtures below write only that disposable database; no provider or Storage IO.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
const { assert, sql, rows, q, randomUUID, ok, denied, env } = rt;
const PAGE='public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)';
const READ='public.rpc_mark_displayed_agreement_messages_v1(uuid,uuid,uuid[])';
const candidatePath='supabase/candidates/chat_b3a_private_history_read.sql';
const closure=()=>rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,(select sha256 from private.closure_erasure_source_v5 where singleton) erasure,private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5() binding")[0];
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const exists=signature=>sql(`select (to_regprocedure(${q(signature)}) is not null)::text`)==='true';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

await rt.prove('CHAT_B3A_PRIVATE_HISTORY_AND_EXACT_READ','chat-b3a-report.json',async report=>{
  assert.equal(env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
  report.providerCalls=0;report.storageCalls=0;report.voiceProven=false;report.deviceProven=false;
  report.requiredPredecessor='Separately replayed admitted source and dev_alpha chain through Notification A1; no automatic replay in this script.';
  report.sourceArtifactHashes={};
  for(const path of [candidatePath,'supabase/proofs/chat/private_history_read_proof.mjs',
    'supabase/proofs/pre_v3/closure_runtime.mjs','supabase/proofs/pkg023/pkg023_surface.sql']){
    const bytes=readFileSync(path);
    assert.deepEqual(bytes,execFileSync('git',['show',env.GITHUB_SHA+':'+path]),'SOURCE_BYTES_DIFFER:'+path);
    report.sourceArtifactHashes[path]=createHash('sha256').update(bytes).digest('hex');
  }
  const candidate=readFileSync(candidatePath,'utf8');
  report.candidateSha256=report.sourceArtifactHashes[candidatePath];
  const before=surface(),certified=closure();report.closureBefore=certified;
  assert.equal(certified.ready,true);assert.equal(certified.live,certified.certified);assert.equal(certified.live,certified.erasure);
  assert.equal(exists(PAGE),false);assert.equal(exists(READ),false);
  const intact=()=>{assert.deepEqual(surface(),before);assert.deepEqual(closure(),certified);};
  assert.throws(()=>sql(candidate.replace('66773994698c60b9fab919f2a9fda93a','0'.repeat(32))),/CHAT_B3A_PREDECESSOR_DRIFT/);intact();
  assert.throws(()=>sql(candidate.replace("and e.event_type='MESSAGE_RECEIVED' and e.read_at is null","and e.event_type='MESSAGE_RECEIVED'  and e.read_at is null")),/CHAT_B3A_FUNCTION_MISMATCH/);intact();
  rt.pass(report,'PREDECESSOR_AND_BODY_DRIFT_ROLL_BACK_WITH_UNCHANGED_CERTIFICATE');
  sql(candidate);assert.throws(()=>sql(candidate),/CHAT_B3A_ALREADY_APPLIED/);await pause(1500);
  const after=surface(),added=after.filter(line=>!before.includes(line));
  assert.deepEqual(before.filter(line=>!after.includes(line)),[]);assert.equal(added.length,2);
  assert.ok(added.some(line=>line.startsWith('function:public.rpc_read_agreement_messages_page_v1(')));
  assert.ok(added.some(line=>line.startsWith('function:public.rpc_mark_displayed_agreement_messages_v1(')));
  for(const signature of [PAGE,READ])assert.equal(sql(`select has_function_privilege('anon',${q(signature)},'EXECUTE')::text||has_function_privilege('authenticated',${q(signature)},'EXECUTE')::text||has_function_privilege('service_role',${q(signature)},'EXECUTE')::text`),'falsetruefalse');
  assert.deepEqual(closure(),certified);report.surfaceAdded=added;
  rt.pass(report,'ONLY_TWO_ADDITIVE_FUNCTIONS_WITH_AUTHENTICATED_ACL_AND_NO_CERTIFICATE_MOVEMENT');

  const requester=await rt.actor('chat-b3a-requester'),worker=await rt.actor('chat-b3a-worker'),stranger=await rt.actor('chat-b3a-stranger');
  const profile=(actor,kind)=>rows(`select id from public.app_profiles where account_id=${q(actor.id)} and kind=${q(kind)}`)[0].id;
  const requesterProfile=profile(requester,'REQUESTER'),workerProfile=profile(worker,'WORKER');
  sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${q(workerProfile)}`);
  await ok(worker.client.rpc('rpc_complete_worker_profile',{p_profile_id:workerProfile}));
  async function agreement(label){
    const needId=randomUUID();
    sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
        approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
      values(${q(needId)},${q(requester.id)},${q(requesterProfile)},'PUBLISHED',${q(label)},'Disposable chat proof',
        'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
    const offer=await ok(worker.client.rpc('rpc_submit_response',{p_need_id:needId,p_need_revision:1,p_worker_profile_id:workerProfile,
      p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()}));
    return ok(requester.client.rpc('rpc_select_response',{p_need_id:needId,p_need_revision:offer.needRevision,p_response_id:offer.responseId,
      p_response_version:offer.version,p_content_hash:offer.contentHash,p_client_request_id:randomUUID()}));
  }
  const agreementId=await agreement('Chat B3a history'),otherAgreementId=await agreement('Chat B3a other Agreement');
  const page=(actor=requester,cursor=null,limit=50,id=agreementId)=>actor.client.rpc('rpc_read_agreement_messages_page_v1',{
    p_expected_user_id:actor.id,p_agreement_id:id,p_limit:limit,p_before_created_at:cursor?.createdAt??null,p_before_id:cursor?.messageId??null});
  const mark=(ids,actor=requester,id=agreementId)=>actor.client.rpc('rpc_mark_displayed_agreement_messages_v1',{
    p_expected_user_id:actor.id,p_agreement_id:id,p_message_ids:ids});
  const send=(actor,body,id=agreementId)=>ok(actor.client.rpc('rpc_send_agreement_message_v2',{
    p_expected_user_id:actor.id,p_agreement_id:id,p_client_message_id:randomUUID(),p_body:body}));
  const idsOf=p=>p.messages.map(m=>m.messageId);
  const empty=await ok(page());assert.deepEqual(empty.messages,[]);assert.equal(empty.olderCursor,null);

  // SQL-only ordering fixtures deliberately include exact timestamp ties and
  // adjacent PostgreSQL microseconds. They are not send/event acceptance.
  const historyIds=Array.from({length:121},()=>randomUUID());
  sql(`insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body,created_at)
    select x.id,${q(agreementId)},1,${q(worker.id)},'History fixture '||x.ord,
      date_trunc('day',statement_timestamp())-interval '1 day'+((x.ord/3)::integer)*interval '1 microsecond'
    from unnest(array[${historyIds.map(q).join(',')}]::uuid[]) with ordinality x(id,ord);`);
  const expected=rows(`select id from public.agreement_messages where agreement_id=${q(agreementId)} order by created_at,id`).map(m=>m.id);
  const newest=await ok(page());assert.equal(newest.schema,'AGREEMENT_MESSAGES_PAGE_V1');assert.deepEqual(idsOf(newest),expected.slice(-50));
  assert.equal(newest.accountId,requester.id);assert.equal(newest.agreementId,agreementId);assert.equal(newest.authoritative,true);
  const arrived=await send(worker,'Arrival after the first page');
  const older=await ok(page(requester,newest.olderCursor)),oldest=await ok(page(requester,older.olderCursor));
  assert.deepEqual([...idsOf(oldest),...idsOf(older),...idsOf(newest)],expected);assert.equal(oldest.olderCursor,null);
  assert.equal(new Set([...idsOf(oldest),...idsOf(older),...idsOf(newest)]).size,121);
  assert.equal((await ok(page())).messages.at(-1).messageId,arrived);
  assert.equal((await ok(page(requester,null,1))).messages.length,1);
  const first=oldest.messages[0];assert.deepEqual((await ok(page(requester,{createdAt:first.createdAt,messageId:first.messageId}))).messages,[]);
  rt.pass(report,'EMPTY_NEWEST_OLDER_TIED_MICROSECOND_PAGES_AND_LATER_NEWEST_REFRESH');

  await denied(page(requester,null,0),'CHAT_CURSOR_INVALID');await denied(page(requester,null,51),'CHAT_CURSOR_INVALID');
  await denied(page(requester,{createdAt:null,messageId:first.messageId}),'CHAT_CURSOR_INVALID');
  await denied(page(requester,{createdAt:first.createdAt,messageId:randomUUID()}),'CHAT_CURSOR_INVALID');
  await denied(page(requester,{createdAt:'infinity',messageId:first.messageId}),'CHAT_CURSOR_INVALID');
  await denied(page(stranger),'MEDIA_NOT_FOUND');
  await denied(requester.client.rpc('rpc_read_agreement_messages_page_v1',{p_expected_user_id:worker.id,p_agreement_id:agreementId}),'AUTH_CONTEXT_CHANGED');
  await denied(rt.anon.rpc('rpc_read_agreement_messages_page_v1',{p_expected_user_id:requester.id,p_agreement_id:agreementId}));
  rt.pass(report,'CURSOR_LIMIT_SCOPE_EXPECTED_ACCOUNT_AND_ANON_REFUSALS');

  const a=await send(worker,'Displayed A'),b=await send(worker,'Not displayed B'),own=await send(requester,'Own message'),foreign=await send(worker,'Other Agreement',otherAgreementId);
  const eventRead=id=>rows(`select read_at from public.user_activity_events where dedupe_key=${q('agreement_message:'+id)}`)[0].read_at;
  const eventSnapshot=()=>rows(`select id,read_at from public.user_activity_events order by id`);
  const untouched=eventSnapshot();
  for(const bad of [null,[],[a,a],[a,null],historyIds.slice(0,51)])await denied(mark(bad),'CHAT_DISPLAYED_IDS_INVALID');
  await denied(mark([[a,b]]));
  await denied(mark([a,randomUUID()]),'CHAT_MESSAGE_NOT_AVAILABLE');
  await denied(mark([a,foreign]),'CHAT_MESSAGE_NOT_AVAILABLE');
  const foreignRow=(await ok(page(requester,null,50,otherAgreementId))).messages[0];
  await denied(page(requester,{createdAt:foreignRow.createdAt,messageId:foreignRow.messageId}),'CHAT_CURSOR_INVALID');
  await denied(mark([a],stranger),'MEDIA_NOT_FOUND');
  await denied(requester.client.rpc('rpc_mark_displayed_agreement_messages_v1',{p_expected_user_id:worker.id,p_agreement_id:agreementId,p_message_ids:[a]}),'AUTH_CONTEXT_CHANGED');
  await denied(rt.anon.rpc('rpc_mark_displayed_agreement_messages_v1',{p_expected_user_id:requester.id,p_agreement_id:agreementId,p_message_ids:[a]}));
  assert.deepEqual(eventSnapshot(),untouched);
  const receipt=await ok(mark([a,own]));assert.deepEqual(receipt,{schema:'AGREEMENT_MESSAGE_READ_V1',accountId:requester.id,
    agreementId,displayedMessageIds:[a,own],markedEventCount:1,authoritative:true});
  assert.ok(eventRead(a));assert.equal(eventRead(b),null);assert.equal(eventRead(own),null);assert.equal(eventRead(foreign),null);
  assert.equal(eventRead(arrived),null);assert.equal((await ok(mark([a]))).markedEventCount,0);
  const changed=eventSnapshot().filter(row=>JSON.stringify(row)!==JSON.stringify(untouched.find(previous=>previous.id===row.id)));
  assert.equal(changed.length,1);
  assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id=${q(agreementId)} and read_at is not null`),'0');
  assert.equal((await ok(mark([own],worker))).markedEventCount,1);assert.ok(eventRead(own));assert.equal(eventRead(b),null);
  rt.pass(report,'EXACT_IDS_ONLY_NO_PARTIAL_BATCH_WRITES_NO_OTHER_RECIPIENT_OR_EVENT_SWEEP_AND_IDEMPOTENT_REPLAY');

  const suppressed=await send(worker,'Suppressed in-app delivery'),missing=await send(worker,'No in-app delivery'),mismatch=await send(worker,'Wrong event-message link');
  sql(`update public.notification_deliveries d set state='SUPPRESSED',suppression_reason='DISPOSABLE_PROOF'
    from public.user_activity_events e where e.id=d.event_id and e.dedupe_key=${q('agreement_message:'+suppressed)} and d.channel='IN_APP';
    delete from public.notification_deliveries d using public.user_activity_events e
      where e.id=d.event_id and e.dedupe_key=${q('agreement_message:'+missing)} and d.channel='IN_APP';
    update public.user_activity_events set payload=jsonb_build_object('message_id',${q(b)}::uuid) where dedupe_key=${q('agreement_message:'+mismatch)};`);
  assert.equal((await ok(mark([suppressed,missing,mismatch]))).markedEventCount,0);
  for(const id of [suppressed,missing,mismatch])assert.equal(eventRead(id),null);
  rt.pass(report,'SUPPRESSED_MISSING_IN_APP_AND_MISMATCHED_EVENT_LINKS_REMAIN_UNREAD');

  // Metadata fixture only: no Storage object or image bytes are created/read.
  const assetId=randomUUID(),uploadId=randomUUID(),inputHash='a'.repeat(64),outputHash='b'.repeat(64);
  sql(`insert into private.agreement_photo_uploads_v5(id,account_id,agreement_id,agreement_version,client_request_id,state,
    input_sha256,input_bytes,input_type,admitted_at,sanitized_sha256,storage_path,width,height,byte_size,dispatch_state,dispatch_outcome)
    values(${q(assetId)},${q(worker.id)},${q(agreementId)},1,${q(uploadId)},'READY',${q(inputHash)},12,'image/jpeg',clock_timestamp(),
      ${q(outputHash)},${q(worker.id+'/agreement-v5/'+assetId+'/'+outputHash+'.jpg')},10,10,12,'SETTLED','STORED');`);
  const photo=await ok(worker.client.rpc('rpc_send_agreement_photo_message_v5',{p_expected_user_id:worker.id,p_agreement_id:agreementId,
    p_expected_version:1,p_client_message_id:randomUUID(),p_body:'',p_asset_ids:[assetId]}));
  const photoRow=(await ok(page())).messages.find(m=>m.messageId===photo.messageId);
  assert.equal(photoRow.kind,'PHOTO');assert.equal(photoRow.body,'');assert.deepEqual(photoRow.photos,[{assetId,width:10,height:10,byteSize:12,contentType:'image/jpeg'}]);
  assert.deepEqual(Object.keys(photoRow).sort(),['messageId','agreementVersion','senderAccountId','clientMessageId','body','createdAt','kind','mine','photos'].sort());
  const textRow=(await ok(page())).messages.find(m=>m.messageId===b);assert.equal(textRow.kind,'TEXT');assert.deepEqual(textRow.photos,[]);
  assert.equal((await ok(mark([photo.messageId]))).markedEventCount,1);
  rt.pass(report,'EXPLICIT_TEXT_PHOTO_KIND_ORDERED_PRIVATE_METADATA_AND_PHOTO_EVENT_ID');

  const closingMessage=await send(worker,'Unread while the requester closes');
  assert.equal(rows(`select account_id from private.account_closure_requests where account_id=${q(requester.id)}`).length,0);
  const beforeClosingMark=eventSnapshot();
  try{
    await denied(rt.lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(requester.id)}::uuid));
      insert into private.account_closure_requests(account_id,state,revision) values(${q(requester.id)},'READY',1);`,
      ()=>mark([closingMessage])),'ACCOUNT_CLOSING');
    assert.deepEqual(eventSnapshot(),beforeClosingMark);assert.equal(eventRead(closingMessage),null);
    assert.deepEqual(closure(),certified);
  }finally{sql(`delete from private.account_closure_requests where account_id=${q(requester.id)}`);}
  rt.pass(report,'RESTRICTED_ACCOUNT_REFUSES_EXACT_READ_WITHOUT_EVENT_OR_CERTIFICATE_MUTATION');

  // Nullable participant columns are admitted by the existing ON DELETE SET NULL
  // schema. These are isolated SQL fixtures, not an account-erasure execution.
  const forWorker=await send(requester,'Nullable requester fixture',otherAgreementId);
  const forRequester=await send(worker,'Nullable worker fixture',otherAgreementId);
  for(const [column,remaining,displayed,restoreId] of [
    ['requester_account_id',worker,forWorker,requester.id],
    ['worker_account_id',requester,forRequester,worker.id],
  ]){
    sql(`update public.agreements set ${column}=null where id=${q(otherAgreementId)}`);
    try{
      const beforeRefusal=eventSnapshot();
      await denied(page(stranger,null,50,otherAgreementId),'MEDIA_NOT_FOUND');
      await denied(mark([displayed],stranger,otherAgreementId),'MEDIA_NOT_FOUND');
      assert.deepEqual(eventSnapshot(),beforeRefusal);
      assert.ok(idsOf(await ok(page(remaining,null,50,otherAgreementId))).includes(displayed));
      assert.deepEqual(eventSnapshot(),beforeRefusal);
      assert.equal((await ok(mark([displayed],remaining,otherAgreementId))).markedEventCount,1);
      const changed=eventSnapshot().filter(row=>JSON.stringify(row)!==JSON.stringify(beforeRefusal.find(old=>old.id===row.id)));
      assert.equal(changed.length,1);assert.ok(eventRead(displayed));
      assert.deepEqual(closure(),certified);
    }finally{sql(`update public.agreements set ${column}=${q(restoreId)} where id=${q(otherAgreementId)}`);}
  }
  rt.pass(report,'EACH_NULL_PARTICIPANT_REFUSES_OUTSIDER_WITH_NO_READ_CHANGE_AND_RETAINS_REMAINING_PARTY');

  // A terminal Agreement retains history. New writes are not added by B3a.
  sql(`update public.agreements set status='COMPLETED' where id=${q(agreementId)}`);
  assert.ok((await ok(page())).messages.length>0);assert.equal((await ok(mark([b]))).markedEventCount,1);
  assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id=${q(agreementId)} and read_at is not null`),'0');
  const session=(await requester.client.auth.getSession()).data.session;assert.ok(session);
  const retired=rt.make();await ok(retired.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}));
  await ok(requester.client.auth.signOut());
  await denied(retired.rpc('rpc_read_agreement_messages_page_v1',{p_expected_user_id:requester.id,p_agreement_id:agreementId}),'AUTH_REQUIRED');
  await denied(retired.rpc('rpc_mark_displayed_agreement_messages_v1',{p_expected_user_id:requester.id,p_agreement_id:agreementId,p_message_ids:[a]}),'AUTH_REQUIRED');
  assert.deepEqual(closure(),certified);report.closureAfter=closure();
  rt.pass(report,'TERMINAL_HISTORY_CURRENT_SESSION_FENCE_AND_FINAL_UNCHANGED_CERTIFICATE');
});
