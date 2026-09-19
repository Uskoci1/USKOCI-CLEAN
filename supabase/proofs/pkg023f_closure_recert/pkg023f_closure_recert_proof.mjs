// PKG-023f proof. Disposable Auth/Postgres only (closure_runtime.mjs refuses any other target).
//
// It reproduces, on a source-147 database, what happened to canonical DEV on 2026-09-17, from the exact
// text the DEV ledger recorded, and then proves what the re-certification candidate does and refuses:
//   R  the dev_alpha migrations are replayed from the exact ledger text (sha256 against the ledger manifest),
//      every pinned predecessor md5 matching what the replay has - the substitution below must stay empty
//   S1 the drift: the source is no longer ready, an account closure cannot start, and the read-only
//      reconstruction shows the reviewed additions are the only difference
//   S2 the candidate refuses every state that was not reviewed, and leaves nothing behind
//   S3 the candidate certifies the reviewed state, changing four program bodies, one constant and one
//      catalog row, and nothing else
//   S4 an account with lineage, measured usage and a settled reservation closes end to end afterwards, and
//      the operator's free text does NOT survive it while the structured audit metadata does
//   S5 the history is append-only again the moment the closure is over
//   S6 the candidate cannot be applied twice, and the guard is as live as before: a later addition drifts
//   S7 F4: the two service-only functions stop being executable by anon and authenticated (pkg023g)
//   S8 F2: the export stops claiming that no charge was ever measured (pkg023h)
//   S9 the bounded marketplace reader carries the three fields a task card needs (pkg023i)
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {assert,randomUUID,sql,rows,q,ok,denied,service,actor,prove,pass,env,out} from '../pre_v3/closure_runtime.mjs';
import {loadClosureWorker} from '../pre_v3/v5_closure_edge_runtime.mjs';

const CANDIDATE='supabase/candidates/pkg023f_closure_recertification.sql';
const LEDGER='supabase/operations/dev-alpha/ledger';
const ADDITIONS=['private.account_lineage_v5','private.account_lineage_events_v5','private.ai_test_usage_v5'];
// Stands for what an operator would really type about a person. Not one character of it may outlive a closure.
const OPERATOR_NOTE_FRAGMENT='operator note about this person';
const sha256=x=>createHash('sha256').update(x).digest('hex');
const psql=(args,label)=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});}
 catch(e){const error=new Error(label+': '+String(e.stderr??e.message).slice(-1500));error.stderr=String(e.stderr??'');throw error;}};
// The ledger texts carry no transaction of their own (the tool that applied them wrapped each in one), and
// several rely on ON COMMIT DROP tables and SET LOCAL, so each runs in a single transaction, as it did on DEV.
// Several ledger texts refuse to run unless a predecessor function has the md5(pg_get_functiondef) it had on
// canonical DEV. Since the mojibake in the 2026-08-25 source file was repaired, a source-147 replay has exactly
// those bodies and no pin has to be touched. The mechanism stays as the detector: if a replay's predecessor ever
// differs again, the pin - and nothing else - is replaced by the replay's own value and the difference is
// reported, never hidden. The assertion below requires the list to be empty.
const PINS={
 '20260917104027_dev_alpha_pkg019_profile_bootstrap_truthful.sql':[['f4a758af24314b204978eef26fa13929','public.handle_uskoci_auth_user_created()']],
 '20260917112919_dev_alpha_pkg019b_ai_test_reservation_settlement.sql':[['0cee88305ac38bc78f2c341583aa5d0e','public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)'],
  ['6cd527442c55a96a81bf885084755451','public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)']],
 '20260917142520_dev_alpha_pkg019c_failed_reservation_release.sql':[['6cd527442c55a96a81bf885084755451','public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)']],
 '20260917173759_dev_alpha_pkg019d_stt_audio_duration_settlement.sql':[['6cd527442c55a96a81bf885084755451','public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)'],
  ['d11f2625c54e4c7716bcbf645a6e3ec7','public.rpc_ai_test_budget_report_service()']],
 '20260917181212_dev_alpha_pkg015b_gap0042_world_boundary.sql':[['0b205a38d7722db8b2210dee7f6972d7','public.rpc_get_public_profile(uuid)'],
  ['c8ff325885a8b8834fa3b90aff1b27e1','public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)']],
};
const substitutions=[];
const replay=file=>{
 let text=readFileSync(`${LEDGER}/${file}`,'utf8'),path=`${LEDGER}/${file}`;
 for(const [pinned,signature] of PINS[file]??[]){
  assert.ok(text.includes(`'${pinned}'`),'PKG023F_PIN_NOT_IN_THE_LEDGER_TEXT '+file);
  const inReplay=sql(`select md5(pg_get_functiondef(${q(signature)}::regprocedure))`);
  if(inReplay!==pinned){text=text.replaceAll(`'${pinned}'`,`'${inReplay}'`);substitutions.push({file,predecessor:signature,pinnedOnCanonicalDev:pinned,inTheReplay:inReplay});}
 }
 if(text!==readFileSync(`${LEDGER}/${file}`,'utf8')){path=`${out}/pkg023f-replayed-${file}`;writeFileSync(path,text);}
 return psql(['-1','-f',path],'PKG023F_LEDGER_REPLAY_FAILED '+file);
};
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
 // No pin may differ any more. The 2026-08-25 file now carries the canonical UTF-8 text that canonical DEV
 // actually ran, proven by the two md5 values in docs/.../F7_SOURCE_REPAIR_20260919.md, so the replay's
 // predecessor of pkg019 is byte for byte the function pkg019 was written against.
 report.predecessorPinsThatDifferInTheReplay=substitutions;
 assert.deepEqual(substitutions,[],'PKG023F_PREDECESSOR_PIN_STILL_DIFFERS '+JSON.stringify(substitutions));
 assert.equal(sql("select md5(pg_get_functiondef('public.handle_uskoci_auth_user_created()'::regprocedure))"),'734ca70188a3cab8cef2f8b38bcd8ca6',
  'after pkg019 the replayed bootstrap function is the one canonical DEV has');
 pass(report,'EIGHT_DEV_ALPHA_MIGRATIONS_REPLAYED_FROM_THE_EXACT_LEDGER_TEXT_EVERY_PREDECESSOR_PIN_MATCHING_THEN_PKG023_A_B_D');

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
 // An operator's note in the shape of the real thing: free text a person typed about a person.
 await ok(service.rpc('rpc_admit_account_lineage_service',{p_account_id:closing.id,p_lineage:'SYNTHETIC_ACCEPTANCE_FIXTURE',
  p_reason:`${OPERATOR_NOTE_FRAGMENT} - admitted by the disposable proof`,p_source_ref:`${OPERATOR_NOTE_FRAGMENT}/source`,p_expected_revision:0}));
 const lineageBefore=rows(`select admitted_at from private.account_lineage_v5 where account_id=${q(closing.id)}::uuid`)[0];
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
 const relationsBefore=Number(sql('select cardinality(private.closure_redaction_relations_v5())'));
 applyCandidate();
 const certified=certificate();
 assert.equal(certified.ready,true);assert.equal(certified.binding,true);
 // The candidate changed the erasure program itself, so the digest moved once more: what it certifies is a
 // third value, neither the last certified one nor the drifted one, and it holds in all three places.
 assert.notEqual(certified.live,drifted.live);assert.notEqual(certified.live,source147.live);
 assert.equal(certified.source,certified.live);assert.equal(certified.erasure,certified.live);assert.equal(certified.ready_constant,certified.live);
 const after=surface(),changed=l=>l.replace(/^(function:[a-z_.0-9]+\().*/,'$1');
 // Four bodies of the erasure program and the one certified constant. No table, column, constraint, policy,
 // grant, index or other function may appear here.
 const EXPECTED=['function:private.account_lineage_events_append_only(','function:private.closure_redaction_patch_v5(',
  'function:private.closure_redaction_relations_v5(','function:private.closure_redaction_scope_v5(','function:private.retention_ai_source_ready('];
 assert.deepEqual(after.filter(l=>!replayed.includes(l)).map(changed).sort(),EXPECTED);
 assert.deepEqual(replayed.filter(l=>!after.includes(l)).map(changed).sort(),EXPECTED);
 // The erasure program now walks the two lineage relations, and only those two are new.
 assert.equal(Number(sql('select cardinality(private.closure_redaction_relations_v5())')),relationsBefore+2);
 for(const relation of ['private.account_lineage_v5','private.account_lineage_events_v5']){
  assert.equal(sql(`select ${q(relation)}=any(private.closure_redaction_relations_v5())`),'t',relation);
  assert.equal(sql(`select private.closure_redaction_scope_v5(${q(relation)})`),'t.account_id=$1',relation);
 }
 // private.ai_test_usage_v5 is metering, not narrative: catalogued, never redacted.
 assert.equal(sql("select 'private.ai_test_usage_v5'=any(private.closure_redaction_relations_v5())"),'f');
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
 pass(report,'CANDIDATE_CERTIFIES_THE_REVIEWED_STATE_FOUR_PROGRAM_BODIES_ONE_CONSTANT_ONE_CATALOG_ROW_NOTHING_ELSE');

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
 assert.equal(total,relationsBefore+2);
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
 // What stays and what does not (the owner's F1 condition): every row is still there, keyed by the retained
 // pseudonymous subject id, and the structured audit metadata is untouched - but the operator's free text is
 // gone, replaced by a fixed code that carries no content.
 const afterRows=accountRows(closing.id);
 assert.equal(afterRows.length,before.length);
 const kind=k=>afterRows.filter(r=>r.kind===k),kindBefore=k=>before.filter(r=>r.kind===k);
 assert.deepEqual(kind('usage'),kindBefore('usage'));
 assert.deepEqual(kind('reservation'),kindBefore('reservation'));
 assert.deepEqual(rows(`select reason,source_ref from private.account_lineage_v5 where account_id=${q(closing.id)}::uuid
  union all select reason,source_ref from private.account_lineage_events_v5 where account_id=${q(closing.id)}::uuid`),
  [{reason:'CLOSURE_ERASED_OPERATOR_NOTE',source_ref:'CLOSURE_ERASED_SOURCE_REF'},
   {reason:'CLOSURE_ERASED_OPERATOR_NOTE',source_ref:'CLOSURE_ERASED_SOURCE_REF'}]);
 // Not a substring of what the operator typed survives anywhere in those two tables.
 assert.equal(sql(`select count(*) from (select reason,source_ref from private.account_lineage_v5 where account_id=${q(closing.id)}::uuid
  union all select reason,source_ref from private.account_lineage_events_v5 where account_id=${q(closing.id)}::uuid) x
  where x.reason||' '||x.source_ref like '%${OPERATOR_NOTE_FRAGMENT}%'`),'0');
 // The class, the revision, the history's own from/to and the timestamps are the audit metadata that stays.
 assert.deepEqual(rows(`select lineage,revision from private.account_lineage_v5 where account_id=${q(closing.id)}::uuid`),
  [{lineage:'SYNTHETIC_ACCEPTANCE_FIXTURE',revision:1}]);
 assert.deepEqual(rows(`select from_lineage,to_lineage,revision from private.account_lineage_events_v5 where account_id=${q(closing.id)}::uuid`),
  [{from_lineage:null,to_lineage:'SYNTHETIC_ACCEPTANCE_FIXTURE',revision:1}]);
 assert.equal(sql(`select bool_and(admitted_at=${q(lineageBefore.admitted_at)}::timestamptz) from private.account_lineage_v5 where account_id=${q(closing.id)}::uuid`),'t');
 report.afterClosure={authSubjectRetainedAndErased:true,testAdmissionRetired:true,lineageRowsKept:2,usageRowsKept:1,reservationRowsKept:1,
  operatorFreeTextErased:true,structuredClassKept:'SYNTHETIC_ACCEPTANCE_FIXTURE',workerSteps:kinds};
 pass(report,'CLOSES_END_TO_END_THE_OPERATOR_FREE_TEXT_IS_ERASED_AND_THE_STRUCTURED_AUDIT_METADATA_STAYS');

 // ---- S5. the history is append-only again the moment the closure is over
 for(const statement of [`update private.account_lineage_events_v5 set reason='PKG023F_MUST_NOT_LAND' where account_id=${q(closing.id)}::uuid`,
  `delete from private.account_lineage_events_v5 where account_id=${q(closing.id)}::uuid`,
  `update private.account_lineage_events_v5 set to_lineage='REAL_USER' where account_id=${q(closing.id)}::uuid`]){
  assert.throws(()=>sql(statement),/ACCOUNT_LINEAGE_HISTORY_IMMUTABLE/,statement);
 }
 assert.deepEqual(accountRows(closing.id),afterRows);
 pass(report,'THE_HISTORY_IS_APPEND_ONLY_AGAIN_OUTSIDE_THE_CLOSURE_NO_UPDATE_AND_NO_DELETE_FOR_ANYONE');

 // ---- S6. once only, and the guard is as live as it was
 refuses('PKG023F_NOTHING_TO_RECERTIFY','A_SECOND_APPLICATION');
 assert.deepEqual(certificate(),certified);
 assert.equal(sql(`begin;create table private.pkg023f_later_addition(id integer);select private.retention_ai_source_ready()::text||':'||(private.closure_erasure_binding_v5() is null)::text;rollback;`),'false:true');
 assert.equal(sql(`begin;alter table private.ai_test_usage_v5 add column later_note text;select private.retention_ai_source_ready()::text;rollback;`),'false');
 assert.deepEqual(certificate(),certified);
 pass(report,'NOT_APPLICABLE_TWICE_AND_A_LATER_ADDITION_EVEN_TO_A_REVIEWED_TABLE_DRIFTS_AGAIN');
 writeFileSync(out+'/pkg023f-surface-after.txt',after.join('\n')+'\n');

 // ---- S7. F4 (pkg023g). Both functions refuse a non-service caller in their body today; after the candidate
 // they are not callable by those roles at all, and the caller that exists keeps working.
 const settledOperation=sql('select operation_id from private.ai_test_reservations_v5 where settled_microusd is not null order by created_at, operation_id limit 1');
 const release=`select public.rpc_ai_test_release_unused_reservation_service(${q(settledOperation)}::uuid)`;
 const settle=`select public.rpc_ai_test_settle_audio_service(${q(settledOperation)}::uuid,32000,10)`;
 const asRole=(role,statement)=>`begin;select set_config('request.jwt.claims',${q('{"role":"ROLE"}')},true);set local role ROLE;${statement};rollback;`
  .replaceAll('ROLE',role);
 for(const role of ['anon','authenticated'])for(const statement of [release,settle]){
  assert.throws(()=>sql(asRole(role,statement)),/SERVICE_ROLE_REQUIRED/,`${role} before pkg023g`);
 }
 psql(['-f','supabase/candidates/pkg023g_ai_test_service_least_privilege.sql'],'PKG023G_CANDIDATE_FAILED');
 for(const role of ['anon','authenticated'])for(const statement of [release,settle]){
  assert.throws(()=>sql(asRole(role,statement)),/permission denied for function/,`${role} after pkg023g`);
 }
 // The canonical caller reaches the body and gets the body's own answer, not a permission error.
 assert.match(sql(asRole('service_role',release)),/AI_RELEASE_ALREADY_SETTLED|AI_RELEASE_REFUSED_USAGE_EXISTS/);
 assert.match(sql(asRole('service_role',settle)),/"settled"|SETTLE|settled/);
 assert.deepEqual(certificate(),certified);
 pass(report,'F4_ANON_AND_AUTHENTICATED_LOSE_EXECUTE_THE_SERVICE_CALLER_KEEPS_IT_AND_THE_CERTIFICATE_DOES_NOT_MOVE');

 // ---- S8. F2 (pkg023h). The projection is asked for the account that holds the settled reservations.
 const exportBinding=fields=>`jsonb_build_object('delivery',jsonb_build_object('datasets',jsonb_build_array(jsonb_build_object('key','testAllocations','mode','INCLUDE','fields',${fields}))))`;
 const exported=fields=>JSON.parse(sql(`select private.data_export_snapshot(${q(holder.id)}::uuid,gen_random_uuid(),${exportBinding(fields)},statement_timestamp())`)).datasets.testAllocations;
 const OLD_FIELDS=`jsonb_build_array('kind','allocatedMaximumMicrousd','measuredProviderCharge','createdAt')`;
 const NEW_FIELDS=`jsonb_build_array('kind','allocatedMaximumMicrousd','measuredProviderCharge','createdAt','settlementBasis','settledMicrousd','settledAt')`;
 const measured=Number(sql(`select count(*) from private.ai_test_reservations_v5 where account_id=${q(holder.id)}::uuid and settlement_basis='MEASURED'`));
 assert.equal(measured,1);
 const exportBefore=exported(OLD_FIELDS);
 assert.ok(exportBefore.length>=20);
 // The claim that is not true: one of these rows was settled from the provider's own usage metadata.
 assert.equal(exportBefore.every(row=>row.measuredProviderCharge===false),true,'F2_EXPORT_ALREADY_TRUTHFUL');
 psql(['-f','supabase/candidates/pkg023h_export_settlement_truthful.sql'],'PKG023H_CANDIDATE_FAILED');
 const exportAfter=exported(NEW_FIELDS);
 assert.equal(exportAfter.length,exportBefore.length);
 assert.equal(exportAfter.filter(row=>row.measuredProviderCharge===true).length,measured);
 assert.ok(exportAfter.every(row=>(row.measuredProviderCharge===true)===(row.settlementBasis==='MEASURED')));
 assert.ok(exportAfter.every(row=>row.settlementBasis===null||typeof row.settledMicrousd==='number'));
 report.exportF2={rows:exportAfter.length,measuredProviderCharge:exportAfter.filter(r=>r.measuredProviderCharge).length,
  bases:[...new Set(exportAfter.map(r=>r.settlementBasis))].sort()};
 assert.deepEqual(certificate(),certified);
 pass(report,'F2_THE_EXPORT_NO_LONGER_CLAIMS_NOTHING_WAS_MEASURED_AND_CARRIES_THE_SETTLEMENT_THAT_EXISTS');

 // ---- S9. pkg023i. The public list reader cannot replace the legacy table read until a card can render
 // the time it shows. The three fields are already public on the detail; the description stays out.
 const viewer=await actor('pkg023f-viewer');
 const asViewer=async()=>ok(viewer.client.rpc('rpc_list_open_tasks_v3',{}));
 const beforeItem=(await asViewer()).items[0];
 assert.ok(beforeItem,'PKG023I_NO_OPEN_TASK_TO_READ');
 for(const key of ['taskTimezone','taskCountryCode','verifiedIdentityRequired'])assert.equal(key in beforeItem,false,key);
 psql(['-f','supabase/candidates/pkg023i_open_tasks_timezone.sql'],'PKG023I_CANDIDATE_FAILED');
 const afterItem=(await asViewer()).items[0];
 assert.equal(Object.keys(afterItem).length,Object.keys(beforeItem).length+3);
 // The values are the row's own, not a default, and the description is still not in the list.
 const row=rows(`select task_timezone,task_country_code,verified_identity_required from public.needs where id=${q(afterItem.id)}::uuid`)[0];
 assert.equal(afterItem.taskTimezone,row.task_timezone);
 assert.equal(afterItem.taskCountryCode,row.task_country_code);
 assert.equal(afterItem.verifiedIdentityRequired,row.verified_identity_required);
 assert.ok(afterItem.taskTimezone,'a card needs a real zone, not null');
 for(const key of ['description','opis','requesterAccountId','exactAddress'])assert.equal(key in afterItem,false,key);
 assert.deepEqual(certificate(),certified);
 pass(report,'THE_BOUNDED_MARKETPLACE_READER_CARRIES_THE_ZONE_A_CARD_NEEDS_AND_STILL_NO_DESCRIPTION');
});
