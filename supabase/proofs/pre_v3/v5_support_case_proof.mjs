// Actual disposable Auth/PostgREST/Postgres142→143. No live/provider/operator grant.
// The operator grant and quota rows below are explicitly disposable fixtures.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {assert,sql,rows,prove,pass,apply,actor,service,anon,ok,denied,randomUUID,q,lockedRace,login,agreement,requester,requesterId,worker,workerId} from './closure_runtime.mjs';
const file='20260913045824_clean_v5_support_case_authority.sql';
const createPayload=(body='Support143 private author sentinel',topic='TECHNICAL',context=null,evidence=[])=>({channel:topic==='PRIVACY_RIGHTS'?'LEGAL_PRIVACY':topic==='COLLABORATION'?'TASK':'SERVICE',topic,title:'Disposable private support',body,desiredOutcome:null,context,evidence});
const args=(a,kind,payload,caseId=null,revision=null,key=randomUUID())=>({p_expected_user_id:a.id,p_client_request_id:key,p_kind:kind,p_case_id:caseId,p_expected_revision:revision,p_payload_text:JSON.stringify(payload)});
const digest=c=>createHash('sha256').update(c.p_kind+'\n'+(c.p_case_id??'')+'\n'+(c.p_expected_revision??'')+'\n'+c.p_payload_text,'utf8').digest('hex');
const submit=(a,c)=>a.client.rpc('rpc_support_submit_v5',c);
const recover=(a,key)=>ok(a.client.rpc('rpc_support_read_command_v5',{p_expected_user_id:a.id,p_client_request_id:key}));
const cancel=(a,key)=>a.client.rpc('rpc_support_cancel_command_v5',{p_expected_user_id:a.id,p_client_request_id:key});
const detail=(a,id,after='0')=>ok(a.client.rpc('rpc_support_detail_v5',{p_expected_user_id:a.id,p_case_id:id,p_after_sequence:after}));
const inbox=(a,mode='OWN',before=null)=>ok(a.client.rpc('rpc_support_inbox_v5',{p_expected_user_id:a.id,p_mode:mode,p_before_case_number:before}));
const findContext=(a,kind,id)=>ok(a.client.rpc('rpc_support_find_context_v5',{p_expected_user_id:a.id,p_kind:kind,p_id:id}));
const grant=(a,active,revision,key=randomUUID())=>service.rpc('rpc_support_set_operator_service_v5',{p_account_id:a.id,p_active:active,p_expected_revision:revision,p_client_request_id:key});
async function claims(a){const session=(await a.client.auth.getSession()).data.session;assert.ok(session);const j=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());assert.equal(j.sub,a.id);assert.ok(j.session_id);return `select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:a.id,role:'authenticated',session_id:j.session_id}))},true);`;}
const submitSql=async(a,c)=>(await claims(a))+`select public.rpc_support_submit_v5(${q(a.id)}::uuid,${q(c.p_client_request_id)}::uuid,${q(c.p_kind)},${c.p_case_id?q(c.p_case_id)+'::uuid':'null'},${c.p_expected_revision??'null'},${q(c.p_payload_text)})`;
const cancelSql=async(a,key)=>(await claims(a))+`select public.rpc_support_cancel_command_v5(${q(a.id)}::uuid,${q(key)}::uuid)`;
const serviceSql="select set_config('request.jwt.claim.role','service_role',true);select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);";
const receipt=(c,r)=>{assert.deepEqual(Object.keys(r).sort(),['accountId','clientRequestId','kind','state','caseId','expectedRevision','inputSha256','receipt','authoritative'].sort());assert.equal(r.state,'COMMITTED');assert.equal(r.accountId,c.p_expected_user_id);assert.equal(r.clientRequestId,c.p_client_request_id);assert.equal(r.kind,c.p_kind);assert.equal(r.expectedRevision,c.p_expected_revision);assert.equal(r.inputSha256,digest(c));assert.deepEqual(Object.keys(r.receipt).sort(),['accountId','clientRequestId','kind','caseId','caseNumber','expectedRevision','inputSha256','eventId','sequence','caseRevision','createdAt','authoritative'].sort());for(const k of ['accountId','clientRequestId','kind','caseId','expectedRevision','inputSha256','authoritative'])assert.deepEqual(r.receipt[k],r[k]);assert.equal(r.authoritative,true);};
const forbidden=s=>{for(const x of ['Support143 private author sentinel','Support143 private operator sentinel','target_account_id','input_sha256','provider'])assert.ok(!JSON.stringify(s).includes(x));};
async function action(a,id,kind,payload){const d=await detail(a,id);const c=args(a,kind,payload,id,d.case.revision);const r=await ok(submit(a,c));receipt(c,r);return r;}

await prove('V5_PRIVATE_SUPPORT_CASE_AUTHORITY','v5-support-case-report.json',async report=>{
 report.actualStorage=false;report.actualProvider=false;report.actualPush=false;
 const beforePolicy=sql("select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from private.retention_policy_sets t"),beforeSource=sql('select sha256 from private.closure_source_v5 where singleton');
 const safetyBefore=Number(sql('select count(*) from private.safety_reports'));
 await apply(report,file,142);
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.notEqual(sql('select sha256 from private.closure_source_v5 where singleton'),beforeSource);
 assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 assert.equal(sql("select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from private.retention_policy_sets t"),beforePolicy);
 assert.equal(sql('select private.closure_binding_v5() is null and private.data_export_policy_binding() is null'),'t');assert.equal(sql('select jsonb_array_length(private.data_export_dataset_catalog())'),'49');
 assert.equal(sql("begin;create or replace function private.support_operator_key_v5() returns bigint language sql immutable set search_path=pg_catalog as $drift$ select hashtextextended('SYNTHETIC_SOURCE_DRIFT',10143) $drift$;select private.retention_ai_source_ready() is not true;rollback;"),'t');assert.equal(sql('select private.retention_ai_source_ready()'),'t');
 assert.equal(Number(sql('select count(*) from private.support_cases_v5 where safety_report_id is not null')),safetyBefore);assert.equal(sql('select count(*) from private.support_operator_grants_v5'),'0');
 const tables=['support_operator_grants_v5','support_cases_v5','support_events_v5','support_decisions_v5','support_appeals_v5','support_evidence_v5','support_commands_v5','support_read_markers_v5','support_operator_audit_v5','support_grant_commands_v5'];
 for(const table of tables){assert.equal(sql(`select relrowsecurity and relforcerowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');}
 const a=await actor('support143-author'),b=await actor('support143-foreign'),op=await actor('support143-operator');
 const caps=await ok(op.client.rpc('rpc_support_capabilities_v5',{p_expected_user_id:op.id}));assert.equal(caps.operatorAvailable,false);
 const c=args(a,'CREATE',createPayload());for(const client of [anon,service])await denied(client.rpc('rpc_support_submit_v5',c));await denied(op.client.rpc('rpc_support_set_operator_service_v5',{p_account_id:op.id,p_active:true,p_expected_revision:0,p_client_request_id:randomUUID()}));
 assert.throws(()=>sql(`begin;select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:a.id,role:'authenticated'}))},true);select public.rpc_support_capabilities_v5(${q(a.id)}::uuid);rollback;`));
 pass(report,'EXACT142_140_SOURCE_SEAL49_EXPORT_OLD_BINDINGS_CLOSED_HISTORICAL_SAFETY_LINK_NO_GRANT_REAL_SESSION_PRIVATE_RLS');

 const absent=await recover(a,c.p_client_request_id);assert.deepEqual(absent,{accountId:a.id,clientRequestId:c.p_client_request_id,kind:null,state:'ABSENT',caseId:null,expectedRevision:null,inputSha256:null,receipt:null,authoritative:true});
 const pair=await Promise.all([ok(submit(a,c)),ok(submit(a,c))]);assert.deepEqual(pair[0],pair[1]);receipt(c,pair[0]);const id=pair[0].caseId;assert.deepEqual(await recover(a,c.p_client_request_id),pair[0]);
 assert.equal((await recover(b,c.p_client_request_id)).state,'ABSENT');await denied(submit(a,{...c,p_payload_text:JSON.stringify(createPayload('changed'))}),'SUPPORT_KEY_REUSED');
 await denied(submit(a,args(a,'CREATE',createPayload())),'SUPPORT_CREATE_COOLDOWN');
 for(const client of [anon,service])await denied(client.rpc('rpc_support_detail_v5',{p_expected_user_id:a.id,p_case_id:id,p_after_sequence:'0'}));
 await denied(b.client.rpc('rpc_support_detail_v5',{p_expected_user_id:b.id,p_case_id:id,p_after_sequence:'0'}),'SUPPORT_CASE_NOT_AVAILABLE');
 await denied(op.client.rpc('rpc_support_inbox_v5',{p_expected_user_id:op.id,p_mode:'OPERATOR',p_before_case_number:null}),'SUPPORT_OPERATOR_REQUIRED');
 forbidden(pair[0]);forbidden(await inbox(a));const owned=await detail(a,id);assert.equal(owned.viewerRole,'AUTHOR');assert.equal(owned.events[0].body,'Support143 private author sentinel');assert.equal(owned.case.status,'RECEIVED');
 pass(report,'CANONICAL_CREATE_CONCURRENT_ONE_RECEIPT_EXACT_UTF8_DIGEST_REPLAY_CHANGED_BODY_FOREIGN_ABSENCE_MINIMAL_INBOX');

 const gi=randomUUID(),gr=await ok(grant(op,true,0,gi));assert.equal(gr.revision,1);assert.deepEqual(await ok(grant(op,true,0,gi)),gr);
 await denied(grant(b,true,1),'SUPPORT_OPERATOR_ALREADY_GRANTED');assert.equal((await ok(op.client.rpc('rpc_support_capabilities_v5',{p_expected_user_id:op.id}))).operatorAvailable,true);
 const ob=await inbox(op,'OPERATOR');assert.ok(ob.cases.some(x=>x.id===id));forbidden(ob);
 const beforeReads=Number(sql(`select count(*) from private.support_operator_audit_v5 where actor_account_id=${q(op.id)} and action='DETAIL_READ'`));
 const viewed=await detail(op,id);assert.equal(viewed.viewerRole,'OPERATOR');assert.deepEqual(viewed.allowedActions,['CLAIM']);assert.equal(viewed.case.status,'RECEIVED');
 assert.equal(Number(sql(`select count(*) from private.support_operator_audit_v5 where actor_account_id=${q(op.id)} and action='DETAIL_READ'`)),beforeReads+1);
 await action(op,id,'CLAIM',{});const response=await action(op,id,'REQUEST_INFO',{body:'Support143 private operator sentinel'});assert.equal((await detail(a,id)).case.status,'WAITING_FOR_AUTHOR');
 assert.equal((await inbox(a)).cases.find(x=>x.id===id).unread,true);const read=await ok(a.client.rpc('rpc_support_mark_read_v5',{p_expected_user_id:a.id,p_case_id:id,p_sequence:response.receipt.sequence}));assert.equal(read.sequence,response.receipt.sequence);assert.equal((await inbox(a)).cases.find(x=>x.id===id).unread,false);
 const follow=await action(a,id,'AUTHOR_REPLY',{body:'A real private followup',evidence:[]});assert.equal((await detail(a,id)).case.status,'IN_REVIEW');
 const stale=args(op,'DECIDE',{outcome:'ACCEPTED',reasonCode:'REVIEWED_REQUEST',body:'Reasoned answer',evidenceIds:[],appealId:null},id,follow.receipt.caseRevision-1);await denied(submit(op,stale),'SUPPORT_REVISION_STALE');
 const dc=await action(op,id,'DECIDE',{outcome:'ACCEPTED',reasonCode:'REVIEWED_REQUEST',body:'Reasoned first answer',evidenceIds:[],appealId:null});const dec=(await detail(a,id)).decisions[0];assert.equal(dec.effect,'NONE');assert.equal(dec.reviewType,'INITIAL');
 await action(op,id,'CLOSE',{});assert.equal((await detail(a,id)).case.status,'CLOSED');
 const appeal=await action(a,id,'APPEAL',{decisionId:dec.id,body:'Please consider these additional facts'});const ap=(await detail(a,id)).appeals[0];assert.equal(ap.status,'RECEIVED');
 await denied(submit(a,args(a,'APPEAL',{decisionId:dec.id,body:'Duplicate open appeal'},id,appeal.receipt.caseRevision)),'SUPPORT_ACTION_NOT_AVAILABLE');
 await action(op,id,'CLAIM_APPEAL',{appealId:ap.id});await action(op,id,'DECIDE_APPEAL',{outcome:'REJECTED',reasonCode:'RECONSIDERED_REQUEST',body:'Separate explanation after rereview',evidenceIds:[],appealId:ap.id});
 const rereview=await detail(a,id);assert.equal(rereview.appeals[0].status,'DECIDED');assert.equal(rereview.decisions.length,2);assert.equal(rereview.decisions[1].priorDecisionId,dec.id);assert.equal(rereview.decisions[1].reviewType,'RECONSIDERATION');assert.equal(rereview.decisions[1].effect,'NONE');
 assert.throws(()=>sql(`update private.support_decisions_v5 set explanation='rewrite' where id=${q(dec.id)}::uuid`));assert.throws(()=>sql(`delete from private.support_events_v5 where id=${q(dc.receipt.eventId)}::uuid`));
 pass(report,'REAL_OPERATOR_GRANT_AUDITED_READ_EXPLICIT_CLAIM_REPLY_UNREAD_ACK_CAS_REASONED_DECISION_CLOSE_EXACT_APPEAL_REREVIEW_NO_EFFECT');

 const tomb=args(b,'CREATE',createPayload('late cancelled'));
 const cancelled=await ok(lockedRace(await cancelSql(b,tomb.p_client_request_id),()=>submit(b,tomb)));assert.equal(cancelled.state,'CANCELLED');assert.equal((await recover(b,tomb.p_client_request_id)).state,'CANCELLED');
 const wins=args(b,'CREATE',createPayload('commit wins','PRIVACY_RIGHTS'));
 const committed=await ok(lockedRace(await submitSql(b,wins),()=>cancel(b,wins.p_client_request_id)));receipt(wins,committed);assert.equal(committed.state,'COMMITTED');
 const active=await detail(op,committed.caseId);const claim=args(op,'CLAIM',{},active.case.id,active.case.revision);
 const revoke=serviceSql+`select public.rpc_support_set_operator_service_v5(${q(op.id)}::uuid,false,1,${q(randomUUID())}::uuid)`;
 await denied(lockedRace(revoke,()=>submit(op,claim)),'SUPPORT_CASE_NOT_AVAILABLE');assert.equal((await recover(op,claim.p_client_request_id)).state,'ABSENT');
 assert.equal((await ok(cancel(op,claim.p_client_request_id))).state,'CANCELLED');assert.equal((await recover(op,response.clientRequestId)).state,'COMMITTED');
 await denied(op.client.rpc('rpc_support_detail_v5',{p_expected_user_id:op.id,p_case_id:id,p_after_sequence:'0'}),'SUPPORT_CASE_NOT_AVAILABLE');await ok(grant(op,true,2));
 const current=await detail(op,committed.caseId);const sameA=args(op,'CLAIM',{},committed.caseId,current.case.revision),sameB=args(op,'CLAIM',{},committed.caseId,current.case.revision);
 const raced=await Promise.all([submit(op,sameA),submit(op,sameB)]);assert.equal(raced.filter(x=>!x.error).length,1);assert.equal(raced.find(x=>x.error).error.message,'SUPPORT_REVISION_STALE');
 pass(report,'OBSERVED_CANCEL_COMMIT_BOTH_ORDERS_REVOKE_LATE_OPERATOR_DENIAL_OWN_METADATA_RECOVERY_AND_COMPETING_CAS');

 // Synthetic, isolated quota history exercises the actual canonical final gate.
 const quota=await actor('support143-quota');
 sql(`insert into private.support_cases_v5(account_id,channel,topic,title,context,ordinary,created_at,updated_at)
 select ${q(quota.id)}::uuid,'SERVICE','TECHNICAL','SYNTHETIC QUOTA FIXTURE','{}',true,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '2 hours' from generate_series(1,5)`);
 await denied(submit(quota,args(quota,'CREATE',createPayload())),'SUPPORT_CASE_DAILY_LIMIT');await denied(submit(quota,args(quota,'CREATE',createPayload('Consumer notice','SERVICE_COMPLAINT'))),'SUPPORT_CASE_DAILY_LIMIT');
 const privacyCommand=args(quota,'CREATE',createPayload('Rights request remains available','PRIVACY_RIGHTS'));const privacy=await ok(submit(quota,privacyCommand));receipt(privacyCommand,privacy);
 const ordinaryCase=rows(`select id from private.support_cases_v5 where account_id=${q(quota.id)} and ordinary limit 1`)[0].id;
 sql(`insert into private.support_events_v5(case_id,sequence,actor_account_id,author_role,kind,body,created_at) select ${q(ordinaryCase)}::uuid,n,${q(quota.id)}::uuid,'AUTHOR','AUTHOR_REPLY','SYNTHETIC QUOTA FOLLOWUP',clock_timestamp()-interval '1 hour' from generate_series(2,51)n;update private.support_cases_v5 set sequence=51,revision=51 where id=${q(ordinaryCase)}::uuid`);
 await denied(submit(quota,args(quota,'AUTHOR_REPLY',{body:'Over daily quota',evidence:[]},ordinaryCase,51)),'SUPPORT_REPLY_DAILY_LIMIT');await action(quota,privacy.caseId,'AUTHOR_REPLY',{body:'Exempt rights followup',evidence:[]});
 for(const [field,value] of [['title','č'.repeat(201)],['body','😀'.repeat(4001)],['desiredOutcome','a'.repeat(1001)]])await denied(submit(quota,args(quota,'CREATE',{...createPayload('limits','PRIVACY_RIGHTS'),[field]:value})),'SUPPORT_INPUT_INVALID');
 const unicode=args(quota,'CREATE',{...createPayload('😀'.repeat(4000),'PRIVACY_RIGHTS'),title:'č'.repeat(200),desiredOutcome:'a'.repeat(1000)});receipt(unicode,await ok(submit(quota,unicode)));
 pass(report,'EXPLICIT_SYNTHETIC_QUOTA_HISTORY_ACTUAL5_50_60S_UNICODE200_4000_1000_REPLAY_FREE_ONLY_APPROVED_EXEMPTIONS');

 for(let i=0;i<53;i++)await action(quota,privacy.caseId,'AUTHOR_REPLY',{body:'Pagination '+i,evidence:[]});
 const first=await detail(quota,privacy.caseId);assert.equal(first.events.length,50);assert.ok(first.nextAfterSequence);const second=await detail(quota,privacy.caseId,first.nextAfterSequence);assert.equal(second.events.length,5);assert.equal(second.nextAfterSequence,null);assert.ok(second.events.every(x=>BigInt(x.sequence)>BigInt(first.nextAfterSequence)));
 assert.equal(new Set([...first.events,...second.events].map(x=>x.id)).size,55);
 await denied(b.client.rpc('rpc_support_mark_read_v5',{p_expected_user_id:b.id,p_case_id:privacy.caseId,p_sequence:first.events[0].sequence}),'SUPPORT_CASE_NOT_AVAILABLE');
 // More than50 real accepted exempt cases, not fictional client inbox entries.
 for(let i=0;i<51;i++)await ok(submit(quota,args(quota,'CREATE',createPayload('Inbox pagination '+i,'PRIVACY_RIGHTS'))));
 const page1=await inbox(quota);assert.equal(page1.cases.length,50);assert.ok(page1.nextBeforeCaseNumber);const page2=await inbox(quota,'OWN',page1.nextBeforeCaseNumber);assert.ok(page2.cases.length>0);assert.ok(page2.cases.every(x=>BigInt(x.caseNumber)<BigInt(page1.nextBeforeCaseNumber)));forbidden(page1);
 pass(report,'ACTUAL_TIMELINE_AND_INBOX_MORE_THAN50_STABLE_SERVER_CURSORS_NO_IMPLICIT_ACK_FOREIGN_CURSOR_NO_ACCESS');

 await login();const ag=await agreement('support143 evidence');const ra={client:requester,id:requesterId},wa={client:worker,id:workerId};
 // Actual visible selected message, plus an adjacent private sentinel excluded.
 const selected=randomUUID(),adjacent=randomUUID();sql(`insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body) values(${q(selected)}::uuid,${q(ag.id)}::uuid,1,${q(requesterId)}::uuid,'INTENTIONALLY_SELECTED_SUPPORT_EVIDENCE'),(${q(adjacent)}::uuid,${q(ag.id)}::uuid,1,${q(workerId)}::uuid,'ADJACENT_PRIVATE_MESSAGE_NEVER_CAPTURED')`);
 const ref={kind:'AGREEMENT_MESSAGE',id:selected,revision:1},context={kind:'AGREEMENT',id:ag.id,revision:1};const evidenceCmd=args(ra,'CREATE',createPayload('Selected message only','COLLABORATION',context,[ref]));const ec=await ok(submit(ra,evidenceCmd));
 const ed=await detail(op,ec.caseId);assert.equal(ed.evidence.length,1);assert.equal(ed.evidence[0].reference.content.body,'INTENTIONALLY_SELECTED_SUPPORT_EVIDENCE');assert.ok(!JSON.stringify(ed).includes('ADJACENT_PRIVATE_MESSAGE_NEVER_CAPTURED'));assert.ok(!JSON.stringify(ed).includes('price_rsd'));
 assert.deepEqual(await findContext(ra,'AGREEMENT',ag.id),{accountId:ra.id,caseId:ec.caseId,authoritative:true});
 assert.deepEqual(await findContext(ra,'AGREEMENT_MESSAGE',selected),{accountId:ra.id,caseId:ec.caseId,authoritative:true});
 for(const foreign of [b,wa,op])assert.deepEqual(await findContext(foreign,'AGREEMENT_MESSAGE',selected),{accountId:foreign.id,caseId:null,authoritative:true});
 assert.equal((await findContext(ra,'AGREEMENT_MESSAGE',adjacent)).caseId,null);
 assert.equal((await findContext(ra,'TASK',selected)).caseId,null);
 // A second explicit rights case uses the existing approved quota exemption;
 // lookup must select the newest matching OWN case across context/evidence.
 const newestEvidence=await ok(submit(ra,args(ra,'CREATE',createPayload('Second explicit selected evidence case','PRIVACY_RIGHTS',null,[ref]))));
 assert.deepEqual(await findContext(ra,'AGREEMENT_MESSAGE',selected),{accountId:ra.id,caseId:newestEvidence.caseId,authoritative:true});
 assert.equal((await findContext(ra,'AGREEMENT',ag.id)).caseId,ec.caseId);
 assert.equal((await findContext(ra,'AGREEMENT_MESSAGE',adjacent)).caseId,null);
 pass(report,'OWN_CASE_CONTEXT_OR_EXPLICIT_EVIDENCE_NEWEST_MATCH_NO_ADJACENT_KIND_FOREIGN_OR_OPERATOR_FALLBACK');
 await denied(submit(b,args(b,'CREATE',createPayload('Foreign ref','PRIVACY_RIGHTS',null,[ref]))),'SUPPORT_REFERENCE_NOT_AVAILABLE');
 await denied(submit(b,args(b,'CREATE',createPayload('Extra private field','PRIVACY_RIGHTS',null,[{...ref,privateTranscript:'SECRET'}]))),'SUPPORT_REFERENCE_INVALID');
 const sr=await ok(requester.rpc('rpc_submit_safety_report',{p_target_account_id:workerId,p_need_id:ag.needId,p_agreement_id:ag.id,p_category:'OTHER',p_reason:'Synthetic143 safety reason',p_narrative:'SAFETY143_PRIVATE_NARRATIVE',p_client_request_id:randomUUID()}));
 const sc=await ok(requester.rpc('rpc_support_find_context_v5',{p_expected_user_id:requesterId,p_kind:'SAFETY_REPORT',p_id:sr.reportId}));assert.ok(sc.caseId);assert.equal(sql(`select count(*) from private.support_cases_v5 where safety_report_id=${q(sr.reportId)}`),'1');assert.equal((await detail(ra,sc.caseId)).events[0].body,'SAFETY143_PRIVATE_NARRATIVE');
 assert.equal((await ok(worker.rpc('rpc_support_find_context_v5',{p_expected_user_id:workerId,p_kind:'SAFETY_REPORT',p_id:sr.reportId}))).caseId,null);
 const safetyInbox=await inbox(op,'SAFETY');assert.ok(safetyInbox.cases.some(x=>x.id===sc.caseId));assert.ok(!JSON.stringify(safetyInbox).includes('SAFETY143_PRIVATE_NARRATIVE'));
 const bs=await ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));await ok(requester.rpc('rpc_set_account_block',{p_target_account_id:workerId,p_blocked:true,p_expected_revision:bs.revision,p_client_request_id:randomUUID()}));await action(ra,ec.caseId,'AUTHOR_REPLY',{body:'Support exit remains after peer block',evidence:[]});
 const ub=await ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));await ok(requester.rpc('rpc_set_account_block',{p_target_account_id:workerId,p_blocked:false,p_expected_revision:ub.revision,p_client_request_id:randomUUID()}));
 pass(report,'EXPLICIT_VISIBLE_REFERENCE_ONLY_NO_ADJACENT_CHAT_PRIVATE_TERMS_FOREIGN_EVIDENCE_SAFETY_ATOMIC_UNIQUE_LINK_AND_BLOCK_SAFE_EXIT');

 const gw=await actor('support143-group-worker'),gp=await ok(gw.client.rpc('rpc_get_worker_profile_for_edit',{}));
 await ok(gw.client.from('app_profiles').update({display_name:'Synthetic143 group worker',skills:['Proof']}).eq('id',gp.id));
 const gl=await ok(gw.client.rpc('rpc_get_worker_location',{}));await ok(gw.client.rpc('rpc_save_worker_location',{p_expected_revision:gl.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));await ok(gw.client.rpc('rpc_complete_worker_profile',{p_profile_id:gp.id}));
 const ga=await ok(gw.client.rpc('rpc_submit_response',{p_need_id:ag.needId,p_need_revision:1,p_worker_profile_id:gp.id,p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()}));
 await ok(requester.rpc('rpc_select_response',{p_need_id:ag.needId,p_need_revision:ga.needRevision,p_response_id:ga.responseId,p_response_version:ga.version,p_content_hash:ga.contentHash,p_client_request_id:randomUUID()}));
 const gc=await ok(worker.rpc('rpc_read_group_context_v5',{p_expected_user_id:workerId,p_agreement_id:ag.id,p_management_after_id:null}));assert.equal(gc.available,true);const groupId=gc.group.groupId;
 const gs=body=>requester.rpc('rpc_send_group_message_v5',{p_expected_user_id:requesterId,p_group_id:groupId,p_client_request_id:randomUUID(),p_body:body});
 const beforeCutoff=await ok(gs('Selected group history before cancellation'));
 await ok(requester.rpc('rpc_cancel_agreement',{p_agreement_id:ag.id,p_reason:'Synthetic143 historical-reference cutoff'}));const afterCutoff=await ok(gs('Unseen group history after cancellation'));
 const historical=args(wa,'CREATE',createPayload('Historical message remains evidence','PRIVACY_RIGHTS',null,[{kind:'GROUP_MESSAGE',id:beforeCutoff.messageId,revision:null}]));const hc=await ok(submit(wa,historical));assert.equal((await detail(wa,hc.caseId)).evidence[0].reference.content.body,'Selected group history before cancellation');
 await denied(submit(wa,args(wa,'CREATE',createPayload('Unseen group evidence','PRIVACY_RIGHTS',null,[{kind:'GROUP_MESSAGE',id:afterCutoff.messageId,revision:null}]))),'SUPPORT_REFERENCE_NOT_AVAILABLE');
 pass(report,'ACTUAL_CANONICAL_GROUP_MEMBERSHIP_CANCELLED_MEMBER_RETAINS_SELECTED_OLD_VISIBILITY_UNSEEN_NEW_REFERENCE_DENIED');

 // Genuine local sanitized Storage bytes, with conspicuously synthetic SQL
 // published Task/media fixtures; support capture/read/delete guards are real.
 const magick=await import('@imagemagick/magick-wasm'),require=createRequire(import.meta.url);await magick.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
 const {sanitizeImage}=await import('../../functions/_shared/mediaImageSanitizer.mjs');const original=magick.ImageMagick.read(magick.MagickColors.Orange,24,16,i=>i.write(magick.MagickFormat.Png,b=>new Uint8Array(b)));
 const picture=sanitizeImage(original,'image/png',magick),imageSha=createHash('sha256').update(picture.bytes).digest('hex'),ma=await actor('support143-media'),mid=randomUUID();
 sql(`insert into public.app_profiles(account_id,kind,display_name,city) values(${q(ma.id)},'REQUESTER','Synthetic143 media owner','Novi Sad') on conflict(account_id,kind) do nothing`);
 const cid=await ok(ma.client.rpc('rpc_ai_open_need_conversation_v2')),path=`${ma.id}/v5/${mid}/${imageSha}.jpg`;
 await ok(service.storage.from('profile-media').upload(path,picture.bytes,{contentType:'image/jpeg',upsert:false}));report.actualStorage=true;
 const mp=rows(`select id from public.app_profiles where account_id=${q(ma.id)} and kind='REQUESTER'`)[0].id,nid=randomUUID();
 sql(`insert into private.owned_media_assets(id,account_id,scope,conversation_id,client_request_id,input_sha256,input_bytes,input_type,state,dispatch_state,dispatch_outcome,sanitized_sha256,storage_path,width,height,byte_size)
 values(${q(mid)},${q(ma.id)},'TASK',${q(cid)},${q(randomUUID())},${q('a'.repeat(64))},${original.length},'image/png','READY','SETTLED','STORED',${q(imageSha)},${q(path)},${picture.width},${picture.height},${picture.bytes.length});
 begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at,public_photo_paths)
 values(${q(nid)},${q(ma.id)},${q(mp)},'PUBLISHED','Synthetic143 selected photo Task','Disposable selected evidence','PROOF','Novi Sad','Liman','OFFERS',2,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp(),array[${q(path)}]);commit;`);
 const mc=args(ma,'CREATE',createPayload('I select this Task and its existing photo','PRIVACY_RIGHTS',{kind:'TASK',id:nid,revision:1}));const mr=await ok(submit(ma,mc));
 const mediaDetail=await detail(op,mr.caseId);assert.deepEqual(mediaDetail.case.context.content.media,[{assetId:mid,sha256:imageSha,width:picture.width,height:picture.height}]);assert.ok(!JSON.stringify(mediaDetail).includes(path));
 assert.equal(sql(`select count(*) from private.media_evidence_refs_v5 where asset_id=${q(mid)} and source_kind='SUPPORT_CASE' and source_id=${q(mr.caseId)}`),'1');
 const sessionId=async actor=>JSON.parse(Buffer.from((await actor.client.auth.getSession()).data.session.access_token.split('.')[1],'base64url').toString()).session_id;
 const mediaArgs=async actor=>({p_account_id:actor.id,p_session_id:await sessionId(actor),p_case_id:mr.caseId,p_asset_id:mid});
 const mediaReceipt=await ok(service.rpc('rpc_support_media_service_v5',await mediaArgs(op)));assert.equal(mediaReceipt.path,path);assert.equal(mediaReceipt.sha256,imageSha);
 await denied(service.rpc('rpc_support_media_service_v5',await mediaArgs(b)),'SUPPORT_REFERENCE_NOT_AVAILABLE');
 await denied(service.rpc('rpc_support_media_service_v5',{...await mediaArgs(op),p_session_id:randomUUID()}),'AUTH_REQUIRED');
 await ok(grant(op,false,3));await denied(service.rpc('rpc_support_media_service_v5',await mediaArgs(op)),'SUPPORT_REFERENCE_NOT_AVAILABLE');await ok(grant(op,true,4));
 await action(op,mr.caseId,'CLAIM',{});await action(op,mr.caseId,'DECIDE',{outcome:'ACCEPTED',reasonCode:'EVIDENCE_REVIEWED',body:'Evidence reference received and reviewed',evidenceIds:[],appealId:null});await action(op,mr.caseId,'CLOSE',{});
 assert.ok((await service.storage.from('profile-media').remove([path])).error);const actualBytes=new Uint8Array(await(await ok(service.storage.from('profile-media').download(path))).arrayBuffer());assert.equal(createHash('sha256').update(actualBytes).digest('hex'),imageSha);
 assert.throws(()=>sql(`delete from private.media_evidence_refs_v5 where source_kind='SUPPORT_CASE' and source_id=${q(mr.caseId)}`));
 pass(report,'ACTUAL_SANITIZED_STORAGE_SELECTED_TASK_MEDIA_EXACT143_HOLD_NO_NATIVE_PATH_LIVE_SESSION_AND_REVOKABLE_CASE_MEDIA_AUTHORIZATION');
 const beforeRevoke=await detail(op,committed.caseId),winningReply=args(op,'OPERATOR_REPLY',{body:'Commit precedes grant revocation'},committed.caseId,beforeRevoke.case.revision);
 const revokedAfterCommit=await ok(lockedRace(await submitSql(op,winningReply),()=>grant(op,false,5)));assert.equal(revokedAfterCommit.revision,6);receipt(winningReply,await recover(op,winningReply.p_client_request_id));assert.ok((await detail(b,committed.caseId)).events.some(x=>x.body==='Commit precedes grant revocation'));await ok(grant(op,true,6));
 pass(report,'OBSERVED_OPERATOR_REPLY_COMMIT_BEFORE_REVOKE_ORIGINAL_RECEIPT_SURVIVES_WITH_NO_FALSE_CANCEL_OR_SECOND_WRITE');

 const closing=await actor('support143-closing');const cc=args(closing,'CREATE',createPayload('Closure safe support','PRIVACY_RIGHTS'));const cr=await ok(submit(closing,cc));
 assert.ok(JSON.parse(sql(`select to_jsonb(private.closure_blockers_v5(${q(closing.id)}::uuid))`)).includes('SUPPORT_RETENTION_POLICY_NOT_READY'));
 sql(`insert into private.account_closure_requests(account_id,state,revision) values(${q(closing.id)}::uuid,'READY',1)`);await action(closing,cr.caseId,'AUTHOR_REPLY',{body:'READY retains safe exit',evidence:[]});
 const pending=args(closing,'AUTHOR_REPLY',{body:'Must not arrive after execution starts',evidence:[]},cr.caseId,(await detail(closing,cr.caseId)).case.revision);
 await denied(lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(closing.id)}::uuid));update private.account_closure_requests set state='EXECUTING' where account_id=${q(closing.id)}::uuid`,()=>submit(closing,pending)),'ACCOUNT_CLOSING');
 assert.equal((await ok(cancel(closing,pending.p_client_request_id))).state,'CANCELLED');assert.deepEqual(await recover(closing,cc.p_client_request_id),cr);assert.equal((await detail(closing,cr.caseId)).allowedActions.length,0);
 const config=JSON.parse(sql("select jsonb_build_object('delivery',jsonb_build_object('datasets',(select jsonb_agg(jsonb_build_object('key',x->'key','mode','INCLUDE','fields',x->'fields')) from jsonb_array_elements(private.data_export_dataset_catalog()) x)))"));
 const snap=owner=>JSON.parse(sql(`select private.data_export_snapshot(${q(owner)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(config))}::jsonb,clock_timestamp())`));
 const own=snap(a.id),foreign=snap(b.id),operator=snap(op.id);assert.equal(own.projectionVersion,'OWN_ACCOUNT_V5_6');assert.ok(own.datasets.ownSupportCases.some(x=>x.id===id));assert.ok(own.datasets.ownSupportEvents.some(x=>x.body==='Support143 private operator sentinel'));
 assert.ok(!JSON.stringify(foreign).includes('Support143 private author sentinel'));assert.ok(!JSON.stringify(operator).includes('Support143 private author sentinel'));assert.ok(!Object.keys(own.datasets).some(x=>/operator|grant/i.test(x)));assert.ok(!JSON.stringify(own.datasets.ownSupportCommands).includes('inputSha256'));
 assert.equal(sql('select private.data_export_policy_binding() is null and private.closure_binding_v5() is null'),'t');
 pass(report,'OBSERVED_CLOSURE_RESTRICTION_SAFE_READY_EXIT_EXECUTION_DENIES_NEW_TEXT_CANCEL_RECOVERY_SURVIVE_OWN49_DATASETS_NO_OPERATOR_INTERNAL_AUDIT');
 report.operatorGrantFixture='EXPLICIT_DISPOSABLE_AUTH_ACCOUNT_ONLY';
});
