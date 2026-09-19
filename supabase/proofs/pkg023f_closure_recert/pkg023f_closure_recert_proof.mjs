// PKG-023f proof. Disposable Auth/Postgres only (closure_runtime.mjs refuses any other target).
//
// It reproduces, on a source-147 database, what happened to canonical DEV on 2026-09-17, from the exact
// text the DEV ledger recorded, and then proves what the re-certification candidate does and refuses:
//   R  the dev_alpha migrations are replayed byte for byte (sha256 against the ledger manifest)
//   S1 the drift: the source is no longer ready, an account closure cannot start, and the read-only
//      reconstruction shows the reviewed additions are the only difference
//   S2 the candidate refuses every state that was not reviewed, and leaves nothing behind
//   S3 the candidate certifies the reviewed state and changes exactly one function body and one catalog row
//   S4 an account with lineage, measured usage and a settled reservation closes end to end afterwards
//   S5 it cannot be applied twice, and the guard is as live as before: a later addition drifts again
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {assert,randomUUID,sql,rows,q,ok,denied,service,actor,prove,pass,env,out} from '../pre_v3/closure_runtime.mjs';
import {loadClosureWorker} from '../pre_v3/v5_closure_edge_runtime.mjs';

const CANDIDATE='supabase/candidates/pkg023f_closure_recertification.sql';
const LEDGER='supabase/operations/dev-alpha/ledger';
const ADDITIONS=['private.account_lineage_v5','private.account_lineage_events_v5','private.ai_test_usage_v5'];
const sha256=x=>createHash('sha256').update(x).digest('hex');
const psql=(args,label)=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});}
 catch(e){const error=new Error(label+': '+String(e.stderr??e.message).slice(-1500));error.stderr=String(e.stderr??'');throw error;}};
// The ledger texts carry no transaction of their own (the tool that applied them wrapped each in one), and
// several rely on ON COMMIT DROP tables and SET LOCAL, so each runs in a single transaction, as it did on DEV.
const replay=file=>psql(['-1','-f',`${LEDGER}/${file}`],'PKG023F_LEDGER_REPLAY_FAILED '+file);
const applyCandidate=()=>psql(['-f',CANDIDATE],'PKG023F_CANDIDATE_FAILED');
const refuses=(code,label)=>{let failure=null;try{applyCandidate();}catch(e){failure=e;}
 assert.ok(failure,'PKG023F_CANDIDATE_CERTIFIED_'+label);assert.ok(failure.stderr.includes(code),`${label}: expected ${code}, got ${failure.stderr.slice(-600)}`);};
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const certificate=()=>rows(`select (select sha256 from private.closure_source_v5 where singleton) source,
 (select sha256 from private.closure_erasure_source_v5 where singleton) erasure,
 substring((select prosrc from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure) from '[0-9a-f]{64}') ready_constant,
 private.closure_source_digest_v5() live,private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5() is not null binding`)[0];
const reconstruction=()=>{
 const text=readFileSync('supabase/proofs/pkg023f_closure_recert/closure_drift_reconstruction.sql','utf8');
 const select=text.slice(text.indexOf('with src as ('),text.lastIndexOf('rollback;'));
 return JSON.parse(sql(`begin;set local search_path to pg_catalog;select to_jsonb(r) from (${select.trim().replace(/;$/,'')}) r;rollback;`));};
const prep=a=>ok(a.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:a.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
const review=a=>ok(a.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}));
const accountRows=id=>rows(`select 'lineage' kind,to_jsonb(t) value from private.account_lineage_v5 t where account_id=${q(id)}::uuid
 union all select 'lineageEvent',to_jsonb(t) from private.account_lineage_events_v5 t where account_id=${q(id)}::uuid
 union all select 'usage',to_jsonb(t) from private.ai_test_usage_v5 t where account_id=${q(id)}::uuid
 union all select 'reservation',to_jsonb(t) from private.ai_test_reservations_v5 t where account_id=${q(id)}::uuid order by 1,2`);

await prove('PKG023F_CLOSURE_RECERTIFICATION','pkg023f-closure-recertification-report.json',async report=>{
 report.disposableDbOnly=true;report.liveAccess=false;report.providerCalled=false;

 // ---- source 147: certified and ready, and the readiness function is the one canonical DEV has, constant aside
 const source147=certificate();
 assert.equal(source147.ready,true);assert.equal(source147.binding,true);
 assert.equal(source147.source,source147.live);assert.equal(source147.erasure,source147.live);assert.equal(source147.ready_constant,source147.live);
 assert.equal(sql(`select md5(regexp_replace(prosrc,'[0-9a-f]{64}','<CERTIFIED>','g')) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure`),
  '397094d2982821e4f2c48c02fb073c7c','the readiness function of canonical DEV differs from source 147 only in its certified constant');
 const surface147=surface();assert.ok(surface147.length>1000);
 pass(report,'SOURCE_147_IS_CERTIFIED_AND_ITS_READINESS_FUNCTION_IS_THE_ONE_ON_CANONICAL_DEV_CONSTANT_ASIDE');

 // ---- R. replay the dev_alpha migrations from the exact ledger text
 const manifest=JSON.parse(readFileSync(`${LEDGER}/LEDGER_MANIFEST.json`,'utf8'));
 for(const m of manifest.migrations){
  const bytes=readFileSync(m.exactTextInRepo,'utf8');
  const text=m.candidateComparedWithLedger==='IDENTICAL_WITHOUT_THE_FINAL_NEWLINE'?bytes.replace(/\n$/,''):bytes;
  assert.equal(sha256(text),m.sha256,'PKG023F_LEDGER_TEXT_IS_NOT_WHAT_THE_DATABASE_RECORDED '+m.name);
 }
 report.ledgerTextsVerified=manifest.migrations.length;
 // Not replayed, and why: both are data operations on named canonical accounts. They create no object.
 report.notReplayed=['dev_alpha_confirmed_qa_ai_budget_activation','dev_alpha_owner_ai_test_admission'];
 replay('20260917053239_dev_alpha_pkg015_account_lineage.sql');
 replay('20260917055559_dev_alpha_pkg014b_ai_provider_usage.sql');
 replay('20260917104027_dev_alpha_pkg019_profile_bootstrap_truthful.sql');
 // pkg019b refuses any database that is not in the state canonical DEV was in: a full 5 000 000 budget held
 // by twenty worst-case LLM reservations, one of them with measured usage. Disposable rows reproduce it.
 const holder=await actor('pkg023f-holder');
 const operations=Array.from({length:20},()=>randomUUID());
 sql(`begin;update private.ai_test_budget_v5 set reserved_microusd=5000000 where singleton;
  insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd)
   select o::uuid,${q(holder.id)}::uuid,'LLM',250000 from unnest(array[${operations.map(q).join(',')}]) o;
  insert into private.ai_test_usage_v5(operation_id,account_id,model,prompt_tokens,output_tokens,total_tokens)
   values(${q(operations[0])}::uuid,${q(holder.id)}::uuid,'pkg023f-disposable-model',1200,300,1500);commit;`);
 replay('20260917112919_dev_alpha_pkg019b_ai_test_reservation_settlement.sql');
 // pkg019c refuses a database with nothing to release: two failed speech holds, older than five minutes.
 sql(`begin;insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd,created_at)
   select gen_random_uuid(),${q(holder.id)}::uuid,'STT',200000,statement_timestamp()-interval '10 minutes' from generate_series(1,2);
  update private.ai_test_budget_v5 set reserved_microusd=(select sum(coalesce(settled_microusd,max_cost_microusd)) from private.ai_test_reservations_v5) where singleton;commit;`);
 replay('20260917142520_dev_alpha_pkg019c_failed_reservation_release.sql');
 replay('20260917173759_dev_alpha_pkg019d_stt_audio_duration_settlement.sql');
 replay('20260917181212_dev_alpha_pkg015b_gap0042_world_boundary.sql');
 replay('20260917230145_dev_alpha_pkg021_need_timestamp_fact_iso8601.sql');
 for(const c of ['pkg023a_own_reads_paged','pkg023b_task_relations','pkg023d_marketplace_bounded'])psql(['-f',`supabase/candidates/${c}.sql`],'PKG023F_PKG023_REPLAY_FAILED '+c);
 pass(report,'EIGHT_DEV_ALPHA_MIGRATIONS_REPLAYED_FROM_THE_EXACT_LEDGER_TEXT_THEN_PKG023_A_B_D');

 // The replayed database has the surface canonical DEV has: same objects, same bodies, same grants.
 const replayed=surface(),dev=readFileSync('supabase/proofs/pkg023f_closure_recert/evidence/dev_surface_20260919_after_pkg023abd.txt','utf8').split('\n').filter(Boolean);
 const environment=/^function:(private\.retention_ai_source_ready|public\.rls_auto_enable)\(/;
 const onlyReplayed=replayed.filter(l=>!dev.includes(l)&&!environment.test(l)),onlyDev=dev.filter(l=>!replayed.includes(l)&&!environment.test(l));
 report.surfaceAgainstCanonicalDev={replayedObjects:replayed.length,devObjects:dev.length,onlyInReplay:onlyReplayed,onlyOnDev:onlyDev};
 assert.deepEqual(onlyReplayed,[],'PKG023F_REPLAY_HAS_AN_OBJECT_CANONICAL_DEV_DOES_NOT');
 assert.deepEqual(onlyDev,[],'PKG023F_CANONICAL_DEV_HAS_AN_OBJECT_THE_LEDGER_DOES_NOT_EXPLAIN');
 pass(report,'SOURCE_147_PLUS_THE_LEDGER_IS_THE_WHOLE_SURFACE_OF_CANONICAL_DEV_NOTHING_UNLEDGERED');

 // ---- S1. the drift
 const drifted=certificate();
 assert.equal(drifted.ready,false);assert.equal(drifted.binding,false);assert.notEqual(drifted.live,source147.live);
 assert.equal(drifted.source,source147.live);assert.equal(drifted.erasure,source147.live);assert.equal(drifted.ready_constant,source147.live);
 const r=reconstruction();report.reconstruction=r;
 for(const needle of ['columns_needle_in_schema','constraints_needle_in_schema','relkind_needle_in_schema','relkind_needle_in_program','trigger_state_needle_in_program'])assert.equal(r[needle],1,needle);
 assert.equal(r.control_digest,drifted.live);assert.equal(r.reconstructed_digest,source147.live);assert.equal(r.ready,false);
 const closing=await actor('pkg023f-closing');
 await ok(service.rpc('rpc_admit_account_lineage_service',{p_account_id:closing.id,p_lineage:'SYNTHETIC_ACCEPTANCE_FIXTURE',
  p_reason:'PKG023f disposable closure proof',p_source_ref:'pkg023f_closure_recert_proof',p_expected_revision:0}));
 const operation=randomUUID();
 sql(`begin;insert into private.ai_test_accounts_v5(account_id) values(${q(closing.id)}::uuid);
  insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd,settled_microusd,settlement_basis,settled_at)
   values(${q(operation)}::uuid,${q(closing.id)}::uuid,'LLM',250000,1234,'MEASURED',statement_timestamp());
  insert into private.ai_test_usage_v5(operation_id,account_id,model,prompt_tokens,output_tokens,total_tokens)
   values(${q(operation)}::uuid,${q(closing.id)}::uuid,'pkg023f-disposable-model',900,100,1000);commit;`);
 await prep(closing);
 const blocked=await review(closing);
 assert.equal(blocked.ready,false);assert.equal(blocked.code,'CLOSURE_POLICY_NOT_READY');
 pass(report,'DRIFT_REPRODUCED_SOURCE_NOT_READY_CLOSURE_CANNOT_START_AND_THE_REVIEWED_ADDITIONS_ARE_THE_ONLY_DIFFERENCE');

 // ---- S2. what the candidate refuses. Each change is made, refused, undone; the certificate never moves.
 const tampers=[
  ['AN_UNREVIEWED_TABLE','create table private.pkg023f_unreviewed(id integer)','drop table private.pkg023f_unreviewed','PKG023F_UNREVIEWED_CHANGE'],
  ['AN_UNREVIEWED_COLUMN_ON_AN_EXISTING_TABLE','alter table public.needs add column pkg023f_unreviewed text','alter table public.needs drop column pkg023f_unreviewed','PKG023F_UNREVIEWED_CHANGE'],
  ['ROW_SECURITY_SWITCHED_OFF_ELSEWHERE','alter table private.ai_test_budget_v5 disable row level security','alter table private.ai_test_budget_v5 enable row level security','PKG023F_UNREVIEWED_CHANGE'],
  ['A_DISABLED_TRIGGER','alter table public.needs disable trigger needs_guard_write','alter table public.needs enable trigger needs_guard_write','PKG023F_UNREVIEWED_CHANGE'],
  ['A_COLUMN_ADDED_TO_A_REVIEWED_TABLE','alter table private.account_lineage_v5 add column pkg023f_note text','alter table private.account_lineage_v5 drop column pkg023f_note','PKG023F_REVIEWED_ADDITIONS_CHANGED_SHAPE'],
  ['THE_APPEND_ONLY_TRIGGER_REMOVED','alter table private.account_lineage_events_v5 disable trigger account_lineage_events_v5_append_only','alter table private.account_lineage_events_v5 enable trigger account_lineage_events_v5_append_only','PKG023F_REVIEWED_ADDITIONS_CHANGED_SHAPE'],
  ['A_REVIEWED_TABLE_OPENED_TO_AN_API_ROLE','grant select on private.ai_test_usage_v5 to service_role','revoke select on private.ai_test_usage_v5 from service_role','PKG023F_REVIEWED_ADDITIONS_ARE_REACHABLE_BY_AN_API_ROLE'],
  ['THE_TWO_CERTIFIED_TABLES_DISAGREE',`update private.closure_erasure_source_v5 set sha256='${'0'.repeat(64)}' where singleton`,`update private.closure_erasure_source_v5 set sha256='${source147.live}' where singleton`,'PKG023F_CERTIFIED_VALUES_DISAGREE'],
 ];
 report.refusals=[];
 for(const [label,change,undo,code] of tampers){
  sql(change);refuses(code,label);sql(undo);
  assert.deepEqual(certificate(),drifted,'PKG023F_REFUSAL_LEFT_SOMETHING_BEHIND '+label);
  report.refusals.push({state:label,refusedWith:code});
 }
 assert.deepEqual(surface(),replayed,'PKG023F_REFUSALS_CHANGED_THE_SURFACE');
 pass(report,'CANDIDATE_REFUSES_EVERY_UNREVIEWED_STATE_AND_LEAVES_NOTHING_BEHIND');

 // ---- S3. the candidate certifies the reviewed state, and nothing else changes
 const catalogBefore=rows(`select data_class,relations from private.closure_dataset_catalog_v5 order by data_class`);
 applyCandidate();
 const certified=certificate();
 assert.equal(certified.ready,true);assert.equal(certified.binding,true);assert.equal(certified.live,drifted.live);
 assert.equal(certified.source,drifted.live);assert.equal(certified.erasure,drifted.live);assert.equal(certified.ready_constant,drifted.live);
 const after=surface(),changed=l=>l.replace(/^(function:[a-z_.0-9]+\().*/,'$1');
 assert.deepEqual(after.filter(l=>!replayed.includes(l)).map(changed),['function:private.retention_ai_source_ready(']);
 assert.deepEqual(replayed.filter(l=>!after.includes(l)).map(changed),['function:private.retention_ai_source_ready(']);
 const catalogAfter=rows(`select data_class,relations from private.closure_dataset_catalog_v5 order by data_class`);
 for(const before of catalogBefore){
  const now=catalogAfter.find(c=>c.data_class===before.data_class);
  if(before.data_class==='AUDIT_SECURITY_LOGS')assert.deepEqual(now.relations,[...before.relations,'private.ai_test_usage_v5','private.account_lineage_v5','private.account_lineage_events_v5']);
  else assert.deepEqual(now,before);
 }
 assert.equal(catalogAfter.length,catalogBefore.length);
 // No account-linked table is outside the catalog any more.
 assert.deepEqual(rows(`select n.nspname||'.'||c.relname relation from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in('public','private') and c.relkind in('r','p') and (n.nspname||'.'||c.relname)=any(${q('{'+ADDITIONS.join(',')+'}')}::text[])
  and not exists(select 1 from private.closure_dataset_catalog_v5 k where (n.nspname||'.'||c.relname)=any(k.relations))`),[]);
 pass(report,'CANDIDATE_CERTIFIES_THE_REVIEWED_STATE_ONE_FUNCTION_CONSTANT_AND_ONE_CATALOG_ROW_NOTHING_ELSE');

 // ---- S4. an account with lineage, usage and a reservation closes end to end
 const before=accountRows(closing.id);assert.equal(before.length,4);
 const ready=await review(closing);
 assert.equal(ready.ready,true);assert.equal(ready.adapterVersion,'OWNER_AF_D22_EVENT_ERASURE_V1');assert.deepEqual(ready.exceptions,[]);
 const args={p_expected_user_id:closing.id,p_request_id:ready.requestId,p_expected_revision:ready.revision,p_client_request_id:randomUUID(),p_policy_sha256:ready.policySha256};
 const started=await ok(closing.client.rpc('rpc_start_account_closure_execution',args)),g=started.generation;
 assert.equal(started.state,'EXECUTING');
 const runtime=loadClosureWorker({env:name=>({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED:'true',SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,
  SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY})[name],
  fetch:async(url,init)=>{assert.equal(new URL(url).origin,new URL(env.RU5_DEVICE_SUPABASE_URL).origin);return fetch(url,init);}});
 const invoke=()=>runtime.handler(new Request('http://127.0.0.1/closure',{method:'POST',headers:{authorization:`Bearer ${env.RU5_DEVICE_SERVICE_ROLE_KEY}`,'content-type':'application/json'},
  body:JSON.stringify({accountId:closing.id,generation:g})}));
 const actionArgs=x=>({p_account_id:closing.id,p_generation:g,p_action_id:x.actionId,p_attempt_id:x.attemptId});
 let next=await ok(service.rpc('rpc_claim_account_closure_action_service',{p_account_id:closing.id,p_generation:g}));
 for(let i=0;next.kind==='STORAGE_DELETE'&&i<8;i++){const s=await invoke();assert.equal(s.status,200);next=await ok(service.rpc('rpc_claim_account_closure_action_service',{p_account_id:closing.id,p_generation:g}));}
 assert.equal(next.kind,'RELATIONAL_REDACT');
 if(next.state==='PENDING')await ok(service.rpc('rpc_dispatch_account_closure_action_service',actionArgs(next)));
 const total=Number(sql('select cardinality(private.closure_redaction_relations_v5())'));let finished=false;
 for(let i=0;i<total+25;i++){const step=await ok(service.rpc('rpc_redact_account_closure_step_service',actionArgs(next)));if(step.state==='VERIFIED'){finished=true;break;}}
 assert.ok(finished,'PKG023F_RELATIONAL_ERASURE_DID_NOT_FINISH');
 let closed=null;const kinds=[];
 for(let i=0;i<6&&!closed;i++){const response=await invoke();assert.equal(response.status,200);const body=await response.json();kinds.push(body.kind??body.state);if(body.state==='CLOSED')closed=body;}
 assert.ok(closed,'PKG023F_CLOSURE_DID_NOT_CLOSE '+kinds.join(','));
 assert.equal(closed.relationalOutcome,'ORDINARY_PERSONAL_CONTENT_ERASED');assert.deepEqual(closed.exceptions,[]);
 // The auth identity is erased and the subject row retained. That is an UPDATE: the ON DELETE CASCADE of the
 // three tables does not fire, and the append-only trigger of the lineage history is never asked to delete.
 assert.equal(sql(`select deleted_at is not null from auth.users where id=${q(closing.id)}::uuid`),'t');
 assert.equal(sql(`select email='' and full_name='' from public.app_accounts where id=${q(closing.id)}::uuid`),'t');
 assert.equal(sql(`select retired_at is not null from private.ai_test_accounts_v5 where account_id=${q(closing.id)}::uuid`),'t');
 // What stays, exactly as the review says: the operator's lineage record and the metering rows, keyed by the
 // retained pseudonymous subject id. None of them holds anything the person wrote.
 assert.deepEqual(accountRows(closing.id),before);
 report.afterClosure={authSubjectRetainedAndErased:true,testAdmissionRetired:true,lineageRowsKept:2,usageRowsKept:1,reservationRowsKept:1,workerSteps:kinds};
 pass(report,'ACCOUNT_WITH_LINEAGE_USAGE_AND_RESERVATION_CLOSES_END_TO_END_AND_THE_REVIEWED_ROWS_STAY_AS_DOCUMENTED');

 // ---- S5. once only, and the guard is as live as it was
 refuses('PKG023F_NOTHING_TO_RECERTIFY','A_SECOND_APPLICATION');
 assert.deepEqual(certificate(),certified);
 assert.equal(sql(`begin;create table private.pkg023f_later_addition(id integer);select private.retention_ai_source_ready()::text||':'||(private.closure_erasure_binding_v5() is null)::text;rollback;`),'false:true');
 assert.equal(sql(`begin;alter table private.ai_test_usage_v5 add column later_note text;select private.retention_ai_source_ready()::text;rollback;`),'false');
 assert.deepEqual(certificate(),certified);
 pass(report,'NOT_APPLICABLE_TWICE_AND_A_LATER_ADDITION_EVEN_TO_A_REVIEWED_TABLE_DRIFTS_AGAIN');
 writeFileSync(out+'/pkg023f-surface-after.txt',after.join('\n')+'\n');
});
