import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8').replaceAll('\r\n','\n');
const sql=read('../../migrations/20260913081147_clean_v5_event_bound_account_erasure.sql');
const inventory=JSON.parse(read('../../../docs/implementation/v5-ai-first/AF22_CLOSURE_INVENTORY_144.json'));
const section=(from,to)=>{const a=sql.indexOf(from),b=sql.indexOf(to,a+from.length);assert.ok(a>=0&&b>a);return sql.slice(a,b);};
const roster=section('create function private.closure_redaction_relations_v5()','revoke all on function private.closure_redaction_relations_v5');
const relations=[...roster.matchAll(/'(public\.[a-z0-9_]+|private\.[a-z0-9_]+)'/g)].map(x=>x[1]);
test('finite erasure targets belong to the reviewed inventory and do not include global policy/budget tables',()=>{
 assert.ok(relations.length>50);assert.equal(new Set(relations).size,relations.length);
 const known=new Set(inventory.relations.map(r=>r.relation));for(const r of relations)assert.ok(known.has(r),r);
 for(const forbidden of ['private.retention_policy_sets','private.legal_document_versions','private.ai_test_reservations_v5','private.ai_test_budget_v5','private.support_events_v5','private.support_evidence_v5'])assert.ok(!relations.includes(forbidden),forbidden);
});
test('exact private PID transaction old-row certificate preserves ordinary trigger bodies without a client bypass',()=>{
 const gate=section('create function private.closure_redaction_allowed_v5','-- Static account-owned relation order');
 for(const token of ['pg_backend_pid()','txid_current()','c.relation_oid<>rel','c.operation<>op','c.old_sha256','after_row@>c.patch','a.state=\'DISPATCHED\''])assert.ok(gate.includes(token),token);
 assert.ok(gate.includes("keys:=keys||array['approx_geog']"));
 assert.doesNotMatch(sql,/disable\s+trigger|session_replication_role|set_config\(/i);
 assert.match(sql,/revoke all on private\.closure_redaction_certificate_v5[\s\S]*?from public,anon,authenticated,service_role/);
});
test('leaf constraints and per-field authorship are explicit, not generic NULL or whole-proposer redaction',()=>{
 assert.ok(relations.indexOf('public.data_export_requests')<relations.indexOf('private.data_export_artifacts'));
 assert.ok(relations.indexOf('public.agreement_versions')<relations.indexOf('public.agreement_change_proposals'));
 assert.ok(sql.includes("'email','','phone','','full_name','','city',''"));
 assert.ok(sql.includes("'remaining_search_close_reason',null"));
 assert.ok(sql.includes('where superseded_by=(t->>\'id\')::uuid'));
 assert.ok(sql.includes('ERASURE_FOREIGN_REFERENCE'));
 assert.ok(sql.includes("cur.terms->'scope_note' is distinct from prior.terms->'scope_note'"));
 assert.ok(sql.includes("ss.source_kind='PROPOSAL'"));
});
test('scoped cases, own operator narratives, copied source references and held review graph cannot become exception-free CLOSED',()=>{
 const exceptions=section('create function private.closure_erasure_exceptions_v5','-- Only a fixed server-owned relation enum');
 for(const token of ['actor_account_id=a and body is not null','operator_account_id=a',"r.kind='TASK'","r.kind='AGREEMENT_MESSAGE'","r.kind='GROUP_MESSAGE'","r.kind='TASK_REVIEW'",'SHARED_DECISION_REVIEW_REQUIRED'])assert.ok(exceptions.includes(token),token);
 assert.ok(sql.includes("r='private.ai_task_review_commands' and exists"));
 assert.ok(sql.includes("r='private.worker_ai_saves' and exists"));
});
test('photo Storage hold correction binds exact144 source and only changes the AF22 branch',()=>{
 const photo=section('do $photo_hold$','create function private.closure_erasure_hard_blockers_v5');
 assert.ok(photo.includes('8b182e1817cfdfdafb620fe92296bf51'));
 assert.ok(photo.includes("e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1'"));
 assert.ok(photo.includes('private.closure_erasure_media_protected_v5(a.account_id,old.name)'));
 assert.ok(photo.includes("e.binding->>'adapterVersion' is distinct from 'OWNER_AF_D22_EVENT_ERASURE_V1'"));
 assert.ok(photo.includes('exists(select 1 from private.media_evidence_refs_v5 where asset_id=a.id)'));
 assert.ok(photo.includes('exists(select 1 from private.retention_holds where account_id=a.account_id and active)'));
});
test('owner event provenance does not create a legal policy and exact predecessor source remains sealed',()=>{
 assert.ok(sql.includes('9da5b89c314e6a04b7ec48a16778eed2'));
 assert.ok(sql.includes("'legalPolicyAttested',false"));
 assert.ok(sql.includes('closure_erasure_program_digest_v5'));
 assert.ok(sql.includes('t.tgenabled'));
 assert.doesNotMatch(sql,/insert into private\.(retention_policy_sets|retention_policy_rules|legal_document_versions)/i);
 assert.ok(sql.includes('private.retention_ai_source_ready() is distinct from true'));
});
test('start exact metadata replay precedes live-session admission while new narratives stop after Auth dispatch',()=>{
 const start=section('create or replace function public.rpc_start_account_closure_execution','create function private.closure_erasure_progress_v5');
 assert.ok(start.indexOf("return c.receipt||")<start.indexOf('perform private.support_auth_v5'));
 assert.ok(start.includes("if c.input_sha256<>h then raise exception 'REQUEST_ID_REUSED'"));
 assert.ok(sql.includes('private.closure_auth_dispatched_v5(u)'));
 const locks=section('create function private.closure_erasure_lock_v5','--144 required any account hold');
 assert.ok(locks.indexOf('support_operator_key_v5')<locks.indexOf('closure_account_key'));
 assert.ok(locks.indexOf('closure_account_key')<locks.indexOf('uskoci:retention:'));
});
test('actual proof keeps bounded real Auth Storage RPC and witnessed lock coverage distinct from privileged fixtures',()=>{
 const proof=read('./v5_account_erasure_proof.mjs'),fixtures=read('./v5_erasure_content_fixtures.mjs');
 assert.ok(fixtures.includes('scope,display_value,evidence_excerpt'));
 for(const x of ['lockedRace','loadClosureWorker','seedContentCopies','assertContentCopiesErased','actualColumns','oldSession.refresh_token'])assert.ok(proof.includes(x),x);
 assert.ok(fixtures.includes('length:205'));
 assert.ok(fixtures.includes('liveFactId=factIds[0],supersededFactIds=factIds.slice(1)'));
 assert.ok(fixtures.includes('set superseded_by=${q(liveFactId)}::uuid'));
 assert.ok(fixtures.includes('active_export_attempt_id'));
 assert.ok(proof.includes('report.disposableContentFixture={privileged:true'));
 assert.ok(proof.includes('SYNTHETIC_LOST_ACK_AFTER_REAL_STORAGE_DELETE'));
 assert.ok(proof.includes('remainingAuthorCoverage'));
});
