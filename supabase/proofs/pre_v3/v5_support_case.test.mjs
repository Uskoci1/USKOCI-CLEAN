// Source guards complement the separately executable real Auth/SQL proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync(new URL('../../migrations/20260913045824_clean_v5_support_case_authority.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
const proof=readFileSync(new URL('./v5_support_case_proof.mjs',import.meta.url),'utf8');
const body=name=>{const marker='create function '+name+'(';const start=sql.indexOf(marker);assert.ok(start>=0,name);const a=sql.indexOf('as $f$',start)+6,b=sql.indexOf('$f$;',a);assert.ok(b>a);return sql.slice(a,b);};
test('143 admits exact142 cancellation sources and preserves normalized140 candidate predicate',()=>{
 const old=readFileSync(new URL('../../migrations/20260913044510_clean_v5_unknown_ai_turn_exit.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
 for(const name of ['public.rpc_ai_cancel_need_turn_v2','public.rpc_cancel_worker_ai_turn']){const start=old.indexOf('create or replace function '+name+'('),a=old.indexOf('as $f$',start)+6,b=old.indexOf('$f$;',a);assert.ok(start>=0);assert.ok(sql.includes(createHash('md5').update(old.slice(a,b)).digest('hex')));}
 assert.ok(sql.includes('75b560d9a71baa045f8e7f80cd77aada'));assert.ok(sql.includes('execute replace(d,old_sha,new_sha)'));assert.ok(!sql.includes('create or replace function private.retention_ai_candidate'));
 assert.ok(sql.includes("'having count(*)=6','having count(*)=33'"));assert.ok(proof.includes('SYNTHETIC_SOURCE_DRIFT'));
});

test('HTTP closure fence composes only eight exact support exits with live Auth; ordinary data and revoked sessions stay denied',()=>{
 const start=sql.indexOf('create or replace function public.rpc_closure_api_guard()');assert.ok(start>=0);
 const a=sql.indexOf('as $f$',start)+6,b=sql.indexOf('$f$;',a),guard=sql.slice(a,b);
 assert.ok(sql.includes('abb246e71fa5ad4ac4664db31a5cc065'));
 assert.deepEqual([...guard.matchAll(/\/rpc\/rpc_support_([a-z_]+)_v5/g)].map(x=>x[1]).sort(),
  ['capabilities','inbox','detail','find_context','mark_read','read_command','cancel_command','submit'].sort());
 assert.ok(guard.includes('perform private.support_auth_v5(u);return;'));assert.ok(guard.includes("raise exception 'ACCOUNT_CLOSING' using errcode='42501'"));
 assert.ok(!guard.includes(' like '));assert.ok(sql.includes("'public.rpc_closure_api_guard()']$sources$"));
 for(const x of ['private.closure_executions_v5',"state in('EXECUTING','CLOSED')"])
  assert.ok(body('private.support_safe_exit_v5').includes(x));
 assert.ok(proof.includes('SUPPORT_SAFE_EXIT_HTTP_FENCE'));assert.ok(proof.includes("'AUTH_REQUIRED'"));
});
test('real Auth session and exact expected account precede user entrypoints; no operator seed or metadata identity',()=>{
 const auth=body('private.support_auth_v5');for(const x of ["auth.role() is distinct from 'authenticated'",'u is distinct from expected','private.push_session_valid(u,sid)'])assert.ok(auth.includes(x));
 for(const name of ['submit','read_command','cancel_command','capabilities','inbox','detail','mark_read','find_context'])assert.match(body('public.rpc_support_'+name+'_v5'),/private.support_auth_v5\(p_expected_user_id\)/);
 assert.ok(!/user_metadata|raw_user_meta_data|@[^\s]+\.(com|rs)/.test(sql));assert.ok(!/^insert into private\.support_operator_grants_v5/m.test(sql));
 assert.ok(sql.includes("'PRIVATE_TEST_OWNER_SUPPORT'"));assert.ok(sql.includes("then 'service_role' else 'authenticated'"));
});
test('command binds received UTF8 payload bytes and exact context; cancel serializes same actor key and never changes committed history',()=>{
 const submit=body('public.rpc_support_submit_v5'),cancel=body('public.rpc_support_cancel_command_v5');
 assert.ok(submit.includes("p_kind||E'\\n'||coalesce(p_case_id::text,'')||E'\\n'||coalesce(p_expected_revision::text,'')||E'\\n'||p_payload_text"));
 assert.ok(submit.includes("cmd.input_sha256<>h"));assert.ok(submit.indexOf('select * into cmd')<submit.indexOf('support:quota:'));
 for(const b of [submit,cancel])assert.ok(b.includes('pg_advisory_xact_lock(private.support_command_key_v5(u,p_client_request_id))'));
 assert.ok(cancel.includes("'CANCELLED') on conflict do nothing"));assert.ok(!cancel.includes('update private.support_commands'));
 assert.ok(!cancel.includes('support_operator_revision'));assert.ok(!cancel.includes('support_safe_exit_v5'));
});
test('grant revocation and writes share short exclusive barrier; terminal command reads never grant case content',()=>{
 for(const n of ['public.rpc_support_submit_v5','public.rpc_support_set_operator_service_v5'])assert.ok(body(n).includes('pg_advisory_xact_lock(private.support_operator_key_v5())'));
 const r=body('public.rpc_support_read_command_v5');assert.ok(!r.includes('support_cases_v5'));assert.ok(!r.includes('support_operator_revision'));
 const d=body('private.support_command_document_v5');assert.ok(!/body|narrative|snapshot/.test(d));assert.ok(d.includes("'expectedRevision',c.expected_revision,'inputSha256',c.input_sha256"));
 assert.ok(body('public.rpc_support_detail_v5').includes("'DETAIL_READ'"));assert.ok(body('public.rpc_support_media_service_v5').includes("'MEDIA_READ'"));
});
test('approved limits are final canonical gates, only safety and rights exempt, snapshots and decision refs bounded',()=>{
 const b=body('public.rpc_support_submit_v5');for(const x of ["ordinary:=p->>'topic'<>'PRIVACY_RIGHTS'",">=5",">=50","interval '24 hours'","interval '60 seconds'","between 1 and 200","between 1 and 4000",'>1000',"jsonb_array_length(p->'evidence')>50","jsonb_array_length(p->'evidenceIds')>50"])assert.ok(b.includes(x),x);
 assert.ok(sql.includes("values(r.reporter_account_id,'SAFETY','SAFETY_REPORT'"));assert.ok(sql.includes('r.id,false,r.created_at'));
 assert.ok(sql.includes("effect='NONE'"));assert.ok(!/rpc_publish_need_canonical\(|rpc_cancel_agreement\(|rpc_ru4b_ask_preselection_question\(/.test(sql));
});
test('evidence is an explicit owned-visible snapshot, not adjacent chat, raw client object or provider payload',()=>{
 const b=body('private.support_reference_v5');assert.ok(b.includes("v-array['kind','id','revision']"));assert.ok(b.includes('group_message_visibility_v5 where message_id=i and account_id=a'));assert.ok(b.includes('private.group_member_v5(g,a)'));
 assert.ok(b.includes("'need.exact_address','need.access_notes','need.resolved_location','need.public_photo_paths'"));assert.ok(!b.includes('ownerPrivateProjection'));assert.ok(!b.includes('ai_messages'));assert.ok(!b.includes('provider_ref'));
 assert.ok(sql.includes("source_kind in('AGREEMENT_VERSION','AGREEMENT_PROBLEM','SAFETY_REPORT','RETENTION_HOLD','SUPPORT_CASE')"));assert.ok(body('private.support_capture_media_v5').includes('pg_advisory_xact_lock(private.media_evidence_key_v5(m.account_id))'));
});
test('context recovery searches newest own case and its explicit evidence without operator or adjacent-message expansion',()=>{
 const b=body('public.rpc_support_find_context_v5');
 for(const x of ['where c.account_id=u and(',"c.context->>'kind'=p_kind","c.context->>'id'=p_id::text",
  'from private.support_evidence_v5 e where e.case_id=c.id and e.submitted_by_account_id=u',
  'e.source_kind=p_kind and e.source_id=p_id','order by c.case_number desc limit 1'])assert.ok(b.includes(x),x);
 assert.ok(!/support_operator_revision|agreement_messages|group_messages|snapshot->|grant/.test(b));
 for(const x of ["findContext(ra,'AGREEMENT_MESSAGE',selected)","findContext(ra,'AGREEMENT_MESSAGE',adjacent)",
  'for(const foreign of [b,wa,op])','caseId:newestEvidence.caseId'])assert.ok(proof.includes(x),x);
});
test('safety admission closure lock precedes139 after-insert media capture; safe cancellation does not release evidence',()=>{
 assert.ok(sql.includes('support_safety_closure_v5 before insert on private.safety_reports'));assert.ok(body('private.support_safety_closure_v5').includes('private.support_safe_exit_v5(new.reporter_account_id)'));
 assert.ok(sql.includes('SUPPORT_RETENTION_POLICY_NOT_READY'));assert.ok(!/delete from private\.(support_|media_evidence)/i.test(sql));
 assert.ok(sql.includes("'ownSupportEvidence'"));assert.ok(sql.includes("'bytesIncluded',false"));assert.ok(sql.includes("'OWN_ACCOUNT_V5_6'"));assert.ok(sql.includes("jsonb_array_length(m->''datasets'')<>49"));
});
test('actual proof uses real Auth, witnessed cancel/revoke/closure races and separate policy/Storage claims',()=>{
 for(const s of ['await apply(report,file,142)','await claims(a)','lockedRace(await cancelSql','lockedRace(revoke','SUPPORT_REVISION_STALE','SNAPSHOT','operatorGrantFixture']){if(s==='SNAPSHOT')assert.ok(proof.includes('private.data_export_snapshot'));else assert.ok(proof.includes(s),s);}
 assert.ok(proof.includes('report.actualStorage=false'));assert.ok(proof.includes('report.actualProvider=false'));assert.ok(proof.includes('report.actualPush=false'));
 assert.ok(!proof.includes('GEMINI_API_KEY'));assert.ok(!proof.includes('fetch('));
});
