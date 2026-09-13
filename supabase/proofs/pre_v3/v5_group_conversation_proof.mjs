// Actual disposable multi-account Auth, selections, group RPCs and SQL locks.
// No group/visibility RPC response is synthesized. No provider/live/device IO.
import {assert,sql,rows,q,ok,denied,requester,anon,service,requesterId,
 login,prove,apply,pass,need,actor,lockedRace,randomUUID} from './closure_runtime.mjs';
const R={id:requesterId,client:requester};
async function worker(label){
 const a=await actor(label),p=await ok(a.client.rpc('rpc_get_worker_profile_for_edit',{}));
 await ok(a.client.from('app_profiles').update({display_name:'Group worker '+label,skills:['Proof']}).eq('id',p.id));
 const location=await ok(a.client.rpc('rpc_get_worker_location',{}));
 await ok(a.client.rpc('rpc_save_worker_location',{p_expected_revision:location.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(a.client.rpc('rpc_complete_worker_profile',{p_profile_id:p.id}));return {...a,profileId:p.id};
}
const application=(a,n,slots=1)=>ok(a.client.rpc('rpc_submit_response',{p_need_id:n,p_need_revision:1,p_worker_profile_id:a.profileId,p_covered_slots:slots,
 p_price_rsd:8123,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:'PRIVATE_TERMS_ONLY_'+a.id,p_client_request_id:randomUUID()}));
const selectArgs=(n,p)=>({p_need_id:n,p_need_revision:p.needRevision,p_response_id:p.responseId,p_response_version:p.version,p_content_hash:p.contentHash,p_client_request_id:randomUUID()});
const select=(n,p)=>ok(requester.rpc('rpc_select_response',selectArgs(n,p)));
const context=(a,id,after=null)=>ok(a.client.rpc('rpc_read_group_context_v5',{p_expected_user_id:a.id,p_agreement_id:id,p_management_after_id:after}));
const sendArgs=(a,g,body,key=randomUUID())=>({p_expected_user_id:a.id,p_group_id:g,p_client_request_id:key,p_body:body});
const send=(a,g,body,key)=>ok(a.client.rpc('rpc_send_group_message_v5',sendArgs(a,g,body,key)));
const messages=(a,g,after=null,before=null)=>ok(a.client.rpc('rpc_read_group_messages_v5',{p_expected_user_id:a.id,p_group_id:g,p_after_sequence:after,p_before_sequence:before}));
const ids=page=>page.messages.map(m=>m.messageId);
const asActor=a=>`select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claim.role','authenticated',true);`;
async function block(a,b,value){const s=await ok(a.client.rpc('rpc_get_account_block',{p_target_account_id:b.id}));return ok(a.client.rpc('rpc_set_account_block',{p_target_account_id:b.id,p_blocked:value,p_expected_revision:s.revision,p_client_request_id:randomUUID()}));}
async function blockSql(a,b){const s=await ok(a.client.rpc('rpc_get_account_block',{p_target_account_id:b.id}));return `${asActor(a)}select public.rpc_set_account_block(${q(b.id)}::uuid,true,${s.revision},${q(randomUUID())}::uuid)`;}
const count=g=>Number(sql(`select count(*) from private.group_messages_v5 where group_id=${q(g)}::uuid`));
const granted=(m,a)=>sql(`select exists(select 1 from private.group_message_visibility_v5 where message_id=${q(m)}::uuid and account_id=${q(a.id)}::uuid)`)==='t';
await prove('V5_TASK_GROUP_CONVERSATION','v5-group-conversation-report.json',async report=>{
 await apply(report,'20260913002405_clean_v5_group_conversation.sql',136);await login();
 const A=await worker('137-a'),B=await worker('137-b'),C=await worker('137-c'),D=await worker('137-d'),E=await worker('137-e'),outsider=await actor('137-outsider');
 const capacity=await ok(A.client.rpc('rpc_get_worker_capacity',{}));await ok(A.client.rpc('rpc_save_worker_capacity',{p_expected_revision:capacity.revision,p_team_capacity:2}));
 const teamNeed=need('Group137 one account two people',2),teamAgreement=await select(teamNeed,await application(A,teamNeed,2));assert.equal((await context(A,teamAgreement)).available,false);
 const n=need('Group137 main',3),aid=await select(n,await application(A,n));
 assert.equal((await context(A,aid)).available,false);
 await ok(requester.rpc('rpc_send_agreement_message_v2',{p_expected_user_id:requesterId,p_agreement_id:aid,p_client_message_id:randomUUID(),p_body:'PRIVATE_BILATERAL_NOT_GROUP_HISTORY'}));
 const bid=await select(n,await application(B,n)),initial=await context(A,aid),g=initial.group.groupId;
 assert.equal(initial.available,true);assert.equal(initial.group.members.length,3);assert.equal(initial.group.management,null);assert.equal(initial.group.managementNextId,null);
 assert.equal((await context(B,bid)).group.groupId,g);assert.equal((await context(R,aid)).group.management.length,2);
 for(const table of ['group_conversations_v5','group_memberships_v5','group_messages_v5','group_message_visibility_v5']){
  assert.equal(sql(`select relrowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');
  for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
 }
 for(const client of [anon,service])await denied(client.rpc('rpc_read_group_context_v5',{p_expected_user_id:A.id,p_agreement_id:aid}));
 for(const fn of rows("select oid::regprocedure::text as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'rpc_%group%_v5'"))
  for(const role of ['anon','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(fn.signature)},'EXECUTE')`),'f');
 await denied(outsider.client.rpc('rpc_read_group_messages_v5',{p_expected_user_id:outsider.id,p_group_id:g}),'GROUP_NOT_AVAILABLE');
 await denied(B.client.rpc('rpc_read_group_context_v5',{p_expected_user_id:B.id,p_agreement_id:aid}),'GROUP_NOT_AVAILABLE');
 await denied(A.client.rpc('rpc_read_group_messages_v5',{p_expected_user_id:B.id,p_group_id:g}),'AUTH_CONTEXT_CHANGED');
 assert.ok(!JSON.stringify(initial).includes('PRIVATE_TERMS_ONLY'));assert.ok(!JSON.stringify(initial).includes('executionState'));
 assert.equal(count(g),0);assert.ok(!JSON.stringify(await messages(A,g)).includes('PRIVATE_BILATERAL_NOT_GROUP_HISTORY'));
 pass(report,'TWO_REAL_INDEPENDENT_SELECTIONS_ONE_GROUP_SINGLE_WORKER_PRIVATE_CHANNEL_NO_FOREIGN_GRANTS_OR_PRIVATE_TERMS');

 const key=randomUUID(),one=await send(A,g,'Group message before third member',key),two=await send(B,g,'Second early message');
 const replay=await send(A,g,'Group message before third member',key);assert.equal(replay.messageId,one.messageId);assert.equal(replay.idempotentReplay,true);assert.equal(count(g),2);
 await denied(A.client.rpc('rpc_send_group_message_v5',sendArgs(A,g,'Changed body',key)),'GROUP_MESSAGE_KEY_REUSED');
 const recovered=await ok(A.client.rpc('rpc_read_group_command_v5',{p_expected_user_id:A.id,p_group_id:g,p_client_request_id:key}));assert.equal(recovered.receipt.messageId,one.messageId);
 assert.equal((await ok(B.client.rpc('rpc_read_group_command_v5',{p_expected_user_id:B.id,p_group_id:g,p_client_request_id:key}))).found,false);
 await denied(A.client.rpc('rpc_read_group_command_v5',{p_expected_user_id:A.id,p_group_id:g,p_client_request_id:null}),'GROUP_MESSAGE_INVALID');
 const cid=await select(n,await application(C,n));assert.deepEqual(ids(await messages(C,g)),[]);assert.equal(granted(one.messageId,C),false);assert.equal(granted(two.messageId,C),false);
 const three=await send(C,g,'Third member after admission');assert.ok(ids(await messages(A,g)).includes(three.messageId));assert.deepEqual(ids(await messages(C,g)),[three.messageId]);
 const unreadBefore=(await context(R,aid)).group.unreadCount;await messages(R,g);assert.equal((await context(R,aid)).group.unreadCount,unreadBefore);
 const marked=await ok(requester.rpc('rpc_mark_group_messages_read_v5',{p_expected_user_id:requesterId,p_group_id:g,p_message_ids:[one.messageId]}));assert.equal(marked.markedCount,1);
 assert.equal((await context(R,aid)).group.unreadCount,unreadBefore-1);
 const markHidden=await ok(C.client.rpc('rpc_mark_group_messages_read_v5',{p_expected_user_id:C.id,p_group_id:g,p_message_ids:[one.messageId]}));assert.equal(markHidden.markedCount,0);assert.equal(granted(one.messageId,C),false);
 pass(report,'EXACT_ACTOR_KEY_REPLAY_RECOVERY_NEW_ADMISSION_NO_HISTORY_BACKFILL_READ_DOES_NOT_MARK_OR_GRANT');

 await ok(requester.rpc('rpc_cancel_agreement',{p_agreement_id:aid,p_reason:'Disposable group membership cutoff'}));
 const four=await send(R,g,'After first participant cancellation');assert.ok(!ids(await messages(A,g)).includes(four.messageId));assert.ok(ids(await messages(A,g)).includes(three.messageId));
 const former=await context(A,aid);assert.equal(former.group.canSend,false);assert.deepEqual(former.group.members,[]);assert.equal(former.group.management,null);
 await denied(A.client.rpc('rpc_send_group_message_v5',sendArgs(A,g,'Former member cannot send')),'GROUP_READ_ONLY');
 assert.equal((await send(A,g,'Group message before third member',key)).messageId,one.messageId);
 const appD=await application(D,n),selD=selectArgs(n,appD);
 const selectSql=`${asActor(R)}select public.rpc_select_response(${q(n)}::uuid,${selD.p_need_revision},${q(selD.p_response_id)}::uuid,${selD.p_response_version},${q(selD.p_content_hash)},${q(selD.p_client_request_id)})`;
 const joinMessage=await lockedRace(selectSql,()=>send(R,g,'Observed message after replacement admission'));
 const did=rows(`select id from public.agreements where need_id=${q(n)}::uuid and worker_account_id=${q(D.id)}::uuid order by created_at desc limit 1`)[0].id;
 assert.deepEqual(ids(await messages(D,g)),[joinMessage.messageId]);assert.equal(granted(four.messageId,D),false);
 assert.deepEqual((await context(A,aid)).group.members,[]);
 await ok(B.client.rpc('rpc_mark_work_done',{p_agreement_id:bid}));await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:bid}));
 assert.equal((await context(B,bid)).group.canSend,true);const completedMessage=await send(B,g,'Completed participant may coordinate until Task terminal');assert.ok(granted(completedMessage.messageId,D));
 pass(report,'CANCELLED_MEMBER_PAST_ONLY_REPLACEMENT_OBSERVED_ADMISSION_CUTOFF_COMPLETED_MEMBER_CONTINUES_UNTIL_TASK_TERMINAL');

 const pairGap=await lockedRace(await blockSql(B,C),()=>send(C,g,'Hidden from blocked peer'));assert.equal(granted(pairGap.messageId,B),false);assert.equal(granted(pairGap.messageId,R),true);
 const reverseGap=await send(B,g,'Hidden in other direction');assert.equal(granted(reverseGap.messageId,C),false);await block(B,C,false);
 assert.ok(!ids(await messages(B,g)).includes(pairGap.messageId));assert.ok(!ids(await messages(C,g)).includes(reverseGap.messageId));
 const beforeDenied=count(g);await denied(lockedRace(await blockSql(R,C),()=>C.client.rpc('rpc_send_group_message_v5',sendArgs(C,g,'Requester-blocked send'))),'GROUP_READ_ONLY');assert.equal(count(g),beforeDenied);
 const ownerGap=await send(R,g,'Requester message unavailable to blocked participant');assert.equal(granted(ownerGap.messageId,C),false);
 const continuing=await send(D,g,'Other participants continue');assert.equal(granted(continuing.messageId,R),true);
 await block(R,C,false);assert.ok(!ids(await messages(C,g)).includes(ownerGap.messageId));const afterUnblock=await send(R,g,'Fresh message after unblock');assert.equal(granted(afterUnblock.messageId,C),true);
 pass(report,'OBSERVED_PAIR_BLOCK_SEND_BARRIERS_IMMUTABLE_FUTURE_AUDIENCE_UNBLOCK_NO_BACKFILL_OTHER_PARTICIPANTS_CONTINUE');

 const cutoffSql=`${asActor(R)}select public.rpc_cancel_agreement(${q(cid)}::uuid,'Observed group cancellation')`;
 const afterCancel=await lockedRace(cutoffSql,()=>send(R,g,'Observed message after cancelled membership'));assert.equal(granted(afterCancel.messageId,C),false);
 assert.equal((await context(C,cid)).group.canSend,false);assert.ok(ids(await messages(C,g)).includes(afterUnblock.messageId));
 const closureBefore=rows(`select * from private.account_closure_requests where account_id=${q(D.id)}::uuid`)[0];
 const restriction=closureBefore?`update private.account_closure_requests set state='READY' where account_id=${q(D.id)}::uuid`:
  `insert into private.account_closure_requests(account_id,state,revision) values(${q(D.id)}::uuid,'READY',1)`;
 const unreadMessage=await send(R,g,'Unread before closure race');assert.equal(granted(unreadMessage.messageId,D),true);
 try{
  await denied(lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(D.id)}::uuid));${restriction}`,
   ()=>D.client.rpc('rpc_mark_group_messages_read_v5',{p_expected_user_id:D.id,p_group_id:g,p_message_ids:[unreadMessage.messageId]})),'ACCOUNT_CLOSING');
  assert.equal(sql(`select read_at is null from private.group_message_visibility_v5 where account_id=${q(D.id)}::uuid and message_id=${q(unreadMessage.messageId)}::uuid`),'t');
  await denied(D.client.rpc('rpc_read_group_messages_v5',{p_expected_user_id:D.id,p_group_id:g}),'GROUP_NOT_AVAILABLE');
 }finally{if(closureBefore)sql(`update private.account_closure_requests set state=${q(closureBefore.state)} where account_id=${q(D.id)}::uuid`);else sql(`delete from private.account_closure_requests where account_id=${q(D.id)}::uuid`);}
 pass(report,'OBSERVED_MEMBERSHIP_CANCEL_SEND_AND_CLOSURE_MARK_READ_RACES_NO_FUTURE_GRANT_OR_RESTRICTED_MUTATION');

 for(let i=0;i<53;i++)await send(R,g,'Pagination '+i);
 const latest=await messages(D,g);assert.equal(latest.messages.length,50);assert.ok(latest.nextBeforeSequence);assert.equal(latest.nextAfterSequence,null);
 for(const message of latest.messages)assert.deepEqual(Object.keys(message).sort(),['messageId','sequence','senderAccountId','body','createdAt','mine'].sort());
 const older=await messages(D,g,null,latest.nextBeforeSequence);assert.equal(new Set([...ids(latest),...ids(older)]).size,latest.messages.length+older.messages.length);
 const forward=await messages(D,g,'0');assert.equal(forward.messages.length,50);assert.ok(forward.nextAfterSequence);const rest=await messages(D,g,forward.nextAfterSequence);
 const expected=Number(sql(`select count(*) from private.group_message_visibility_v5 v join private.group_messages_v5 m on m.id=v.message_id where m.group_id=${q(g)}::uuid and v.account_id=${q(D.id)}::uuid`));
 assert.equal(new Set([...ids(forward),...ids(rest)]).size,expected);assert.equal(latest.messages.length+older.messages.length,expected);
 for(const patch of [{p_after_sequence:'00'},{p_before_sequence:'0'},{p_after_sequence:'-1'},{p_after_sequence:'1',p_before_sequence:'3'}])await denied(D.client.rpc('rpc_read_group_messages_v5',{p_expected_user_id:D.id,p_group_id:g,...patch}),'GROUP_CURSOR_INVALID');
 const management=await context(R,did);assert.ok(management.group.management.length<=50);assert.equal((await context(D,did)).group.management,null);
 const afterMember=management.group.management[0].agreementId;const nextManagement=await context(R,did,afterMember);assert.ok(nextManagement.group.management.every(m=>m.agreementId>afterMember));
 assert.ok(!JSON.stringify(await context(D,did)).includes('PRIVATE_TERMS_ONLY'));
 pass(report,'SERVER_BOUNDED50_HISTORY_BOTH_DIRECTIONS_NO_DUPLICATES_PRIVATE_OWNER_MANAGEMENT_CURSOR');

 // Complete the remaining selected coverage through canonical per-person
 // Agreements. The existing parent aggregator owns whole-Task completion.
 const eid=await select(n,await application(E,n));
 for(const [person,agreementId] of [[D,did],[E,eid]]){await ok(person.client.rpc('rpc_mark_work_done',{p_agreement_id:agreementId}));await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:agreementId}));}
 const terminal=await context(D,did);assert.equal(terminal.group.terminal,true);assert.equal(terminal.group.canSend,false);
 const visible=await messages(D,g);assert.ok(visible.messages.length>0);await denied(D.client.rpc('rpc_send_group_message_v5',sendArgs(D,g,'No terminal send')),'GROUP_READ_ONLY');
 pass(report,'CANONICAL_INDEPENDENT_AGREEMENT_COMPLETION_AGGREGATES_TERMINAL_TASK_AND_FREEZES_GROUP_WITH_HISTORY');

 const catalog=JSON.parse(sql('select private.data_export_dataset_catalog()'));assert.equal(catalog.length,39);assert.equal(sql('select private.data_export_policy_binding() is null'),'t');
 // Read-only compiled projection fixture, not a reviewed delivery activation.
 const fixture={delivery:{datasets:catalog.map(d=>({key:d.key,mode:'INCLUDE',fields:d.fields}))}};
 const snapshot=a=>JSON.parse(sql(`select private.data_export_snapshot(${q(a.id)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(fixture))}::jsonb,clock_timestamp())`));
 const da=snapshot(A),db=snapshot(B);assert.equal(da.projectionVersion,'OWN_ACCOUNT_V5_2');assert.equal(Object.keys(da.datasets).length,39);
 assert.ok(da.datasets.ownGroupMessages.some(m=>m.id===one.messageId));assert.ok(!db.datasets.ownGroupMessages.some(m=>m.id===one.messageId));
 assert.ok(da.datasets.ownGroupMemberships.some(m=>m.agreementId===aid));assert.ok(!db.datasets.ownGroupMemberships.some(m=>m.agreementId===aid));
 for(const message of da.datasets.ownGroupMessages)assert.deepEqual(Object.keys(message).sort(),['id','groupId','body','createdAt'].sort());
 assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 pass(report,'COMPILED39_OWN_AUTHOR_EXPORT_OLD136_BINDING_CLOSED_CLOSURE_SOURCE_REFRESH_NO_POLICY_ACTIVATION');
});
