-- Chat B3c disposable SQL proof SOURCE ONLY / NOT RUN.
-- Requires a harness that refuses non-loopback DB/Auth URLs before any IO.
-- Required psql vars: b3c_local_target_attested=true, requester_id, requester_session,
-- worker_id, worker_session, stranger_id, stranger_session, agreement_id,
-- foreign_agreement_id. Three real local Auth sessions; fresh open Agreement owned
-- by requester+worker; unrelated Agreement owned by neither. Never use DEV IDs.
-- Harness: private_invalidation_proof.mjs provisions local Auth actors with
-- canonical submit/select RPCs. chat-b3c-invalidation-proof.yml runs it manually.
-- This file proves SQL authorization/transaction behavior, NOT websocket delivery.
\set ON_ERROR_STOP on
\if :{?b3c_local_target_attested}
\else
  \echo CHAT_B3C_LOCAL_HARNESS_REQUIRED
  \quit 3
\endif
\if :b3c_local_target_attested
\else
  \echo CHAT_B3C_LOCAL_HARNESS_REQUIRED
  \quit 3
\endif

-- Independent connection admission before any application/catalog reads. The
-- harness must still reject remote DB/Auth URLs before creating clients or IO.
select :'HOST'='127.0.0.1' and :'PORT'='54322' and :'DBNAME'='postgres'
  and current_user='postgres' as b3c_local_replay
\gset
\if :b3c_local_replay
\else
  \echo CHAT_B3C_NONLOCAL_CONNECTION_REFUSED
  \quit 3
\endif

select private.closure_source_digest_v5() as b3c_original_digest,
  (select sha256 from private.closure_source_v5 where singleton) as b3c_original_certificate
\gset
begin;
set local uskoci.chat_b3c_disposable_proof='LOCAL_ONLY_ROLLBACK';
create temporary table b3c_fixture(
 requester_id uuid, requester_session uuid, worker_id uuid, worker_session uuid,
 stranger_id uuid, stranger_session uuid, agreement_id uuid, foreign_agreement_id uuid
) on commit drop;
insert into b3c_fixture values(
 :'requester_id',:'requester_session',:'worker_id',:'worker_session',
 :'stranger_id',:'stranger_session',:'agreement_id',:'foreign_agreement_id'
);
grant select on b3c_fixture to authenticated,anon;
create function pg_temp.expect(value boolean,label text) returns void language plpgsql as $f$
begin if value is distinct from true then raise exception 'CHAT_B3C_PROOF_FAILED: %',label;end if;end
$f$;
create function pg_temp.actor(account_id uuid,session_id uuid) returns void language plpgsql as $f$
begin
 perform set_config('request.jwt.claim.sub',account_id::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',account_id,'role','authenticated','session_id',session_id)::text,true);
end
$f$;
-- SET ROLE must retain only the access required for assertions. The actor helper
-- remains owner-only; it must never become an authenticated claim-setting RPC.
do $temp_access$
begin
 execute format('grant usage on schema %I to authenticated',
  (select nspname from pg_namespace where oid=pg_my_temp_schema()));
end
$temp_access$;
revoke all on function pg_temp.expect(boolean,text),pg_temp.actor(uuid,uuid)
from public,anon,authenticated,service_role;
grant execute on function pg_temp.expect(boolean,text) to authenticated;

do $fixtures$
declare f b3c_fixture;
begin
 select * into strict f from b3c_fixture;
 if f.requester_id=f.worker_id or f.stranger_id in(f.requester_id,f.worker_id)
   or f.agreement_id=f.foreign_agreement_id then raise exception 'CHAT_B3C_FIXTURES_NOT_DISTINCT';end if;
 if not exists(select 1 from public.agreements where id=f.agreement_id
   and requester_account_id=f.requester_id and worker_account_id=f.worker_id and status='CONFIRMED')
   or not exists(select 1 from public.agreements where id=f.foreign_agreement_id
     and requester_account_id not in(f.requester_id,f.worker_id) and worker_account_id not in(f.requester_id,f.worker_id))
   or exists(select 1 from public.agreement_messages where agreement_id=f.agreement_id)
   or exists(select 1 from private.account_closure_requests where account_id in(f.requester_id,f.worker_id,f.stranger_id)) then
   raise exception 'CHAT_B3C_FIXTURE_CONTEXT_INVALID';end if;
 if not private.push_session_valid(f.requester_id,f.requester_session)
   or not private.push_session_valid(f.worker_id,f.worker_session)
   or not private.push_session_valid(f.stranger_id,f.stranger_session) then raise exception 'CHAT_B3C_REAL_LOCAL_SESSIONS_REQUIRED';end if;
end
$fixtures$;

-- Exact source include: no statement stripping, marker replacement or rewritten candidate.
\ir ../../candidates/chat_b3c_private_invalidation.sql

-- All four new functions, including the surface helper itself, must bind their
-- metadata into both the surface and closure source digests. Use supported DDL
-- only; each mutant is rolled back in a subtransaction before behavioral proof.
-- Full pg_proc capture also binds language/argument/result/source fields that
-- cannot all be changed independently with ALTER FUNCTION on dependent functions.
do $metadata_mutations$
declare signature text; mutation record; before_surface text; before_source text;
begin
 before_surface:=private.agreement_invalidation_surface_v1();
 before_source:=private.closure_source_digest_v5();
 perform pg_temp.expect(before_surface is not null and before_source is not null,'METADATA_BASELINES_PRESENT');
 for signature in select unnest(array[
  'public.rpc_agreement_invalidation_visible_v1(uuid)',
  'private.agreement_message_invalidate_v1()',
  'private.agreement_invalidation_cleanup_v1()',
  'private.agreement_invalidation_surface_v1()']::text[]) loop
  for mutation in select * from (values
   ('DEFINER','alter function '||signature||' security invoker'),
   ('STRICT','alter function '||signature||' strict'),
   ('VOLATILITY','alter function '||signature||case
     when signature='private.agreement_invalidation_surface_v1()' then ' volatile' else ' stable' end),
   ('SEARCH_PATH','alter function '||signature||' set search_path=pg_catalog,public'),
   ('PARALLEL','alter function '||signature||' parallel restricted'),
   ('COST','alter function '||signature||' cost 101'),
   ('ACL','grant execute on function '||signature||' to anon')
  ) changes(label,command) loop
   begin
    execute mutation.command;
    perform pg_temp.expect(private.agreement_invalidation_surface_v1() is not null
     and private.closure_source_digest_v5() is not null
     and private.agreement_invalidation_surface_v1() is distinct from before_surface
     and private.closure_source_digest_v5() is distinct from before_source,
     'METADATA_DIGEST_CHANGED_'||mutation.label||'_'||signature);
    raise exception 'CHAT_B3C_METADATA_MUTANT_ROLLBACK' using errcode='PZ002';
   exception when sqlstate 'PZ002' then null;
   end;
   perform pg_temp.expect(private.agreement_invalidation_surface_v1()=before_surface
    and private.closure_source_digest_v5()=before_source,
    'METADATA_DIGEST_RESTORED_'||mutation.label||'_'||signature);
  end loop;
 end loop;
end
$metadata_mutations$;

select pg_temp.expect(
 (select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid='public.agreement_invalidations_v1'::regclass and attnum>0 and not attisdropped)=array['agreement_id','revision'],
 'ONLY_TWO_BODY_FREE_COLUMNS');
select pg_temp.expect(not has_table_privilege('anon','public.agreement_invalidations_v1','SELECT')
 and has_table_privilege('authenticated','public.agreement_invalidations_v1','SELECT')
 and not has_table_privilege('authenticated','public.agreement_invalidations_v1','INSERT,UPDATE,DELETE')
 and not has_table_privilege('service_role','public.agreement_invalidations_v1','INSERT,UPDATE,DELETE'),
 'ONLY_AUTHENTICATED_SELECT');
select pg_temp.expect(
 (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.agreement_invalidations_v1'::regclass)
 and (select count(*) from pg_policies where schemaname='public' and tablename='agreement_invalidations_v1')=1,
 'FORCED_RLS_SINGLE_PARTICIPANT_POLICY');
select pg_temp.expect(
 (select count(*) from pg_publication_tables where pubname='supabase_realtime')=1
 and not exists(select 1 from pg_publication_tables where tablename='agreement_messages')
 and (select not pubdelete and not pubtruncate and pubinsert and pubupdate and not puballtables from pg_publication where pubname='supabase_realtime'),
 'NO_RAW_MESSAGE_OR_DELETE_PUBLICATION');

-- SQL fixture insertion is NOT proof of send-RPC/provider acceptance.
select pg_temp.actor(worker_id,worker_session) from b3c_fixture;
insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,body)
select f.agreement_id,g.current_version,f.worker_id,'B3c disposable private body sentinel'
from b3c_fixture f join public.agreements g on g.id=f.agreement_id;
select pg_temp.expect((select revision=1 from public.agreement_invalidations_v1 where agreement_id=:'agreement_id'),'FIRST_MESSAGE_INVALIDATES');
insert into public.agreement_invalidations_v1(agreement_id,revision) select foreign_agreement_id,7 from b3c_fixture;

-- Rollback of the source INSERT also rolls back its invalidation.
do $rollback$
declare f b3c_fixture; v integer;
begin
 select * into strict f from b3c_fixture;
 select current_version into v from public.agreements where id=f.agreement_id;
 begin
  insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,body)
  values(f.agreement_id,v,f.worker_id,'This source message must roll back');
  perform pg_temp.expect((select revision=2 from public.agreement_invalidations_v1 where agreement_id=f.agreement_id),'SECOND_REVISION_INSIDE_TX');
  raise exception 'CHAT_B3C_INTENTIONAL_ROLLBACK' using errcode='PZ001';
 exception when sqlstate 'PZ001' then null;
 end;
 perform pg_temp.expect((select revision=1 from public.agreement_invalidations_v1 where agreement_id=f.agreement_id),'MESSAGE_AND_REVISION_ROLL_BACK');
end
$rollback$;

select pg_temp.actor(requester_id,requester_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=1,'REQUESTER_SEES_ONLY_OWN_AGREEMENT');
do $dml$
begin
 begin
  update public.agreement_invalidations_v1 set revision=999;
  raise exception 'CHAT_B3C_CLIENT_DML_WAS_ALLOWED';
 exception when insufficient_privilege then null;
 end;
end
$dml$;
reset role;
select pg_temp.actor(worker_id,worker_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=1,'WORKER_SEES_ONLY_OWN_AGREEMENT');
reset role;
select pg_temp.actor(stranger_id,stranger_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect(not exists(select 1 from public.agreement_invalidations_v1 where agreement_id=:'agreement_id'),'INTRUDER_CANNOT_READ_TARGET');
reset role;

set local role anon;
do $anon$
begin
 begin
  perform 1 from public.agreement_invalidations_v1;
  raise exception 'CHAT_B3C_ANON_READ_WAS_ALLOWED';
 exception when insufficient_privilege then null;
 end;
end
$anon$;
reset role;

-- A real actor UUID with someone else's valid session must not pass.
select pg_temp.actor(requester_id,stranger_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'WRONG_ACCOUNT_SESSION_DENIED');
reset role;
select pg_temp.actor(requester_id,null) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'MISSING_SESSION_DENIED');
reset role;
select pg_temp.actor(requester_id,requester_session) from b3c_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',requester_id,'role','authenticated','session_id','malformed')::text,true) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'MALFORMED_SESSION_DENIED');
reset role;

savepoint expired_session;
update auth.sessions set not_after=clock_timestamp()-interval '1 second'
where id=(select requester_session from b3c_fixture);
select pg_temp.actor(requester_id,requester_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'EXPIRED_SESSION_DENIED');
reset role;
rollback to expired_session;

savepoint revoked_session;
delete from auth.sessions where id=(select requester_session from b3c_fixture);
select pg_temp.actor(requester_id,requester_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'REVOKED_SESSION_DENIED');
reset role;
rollback to revoked_session;

savepoint banned_account;
update auth.users set banned_until=clock_timestamp()+interval '1 hour'
where id=(select requester_id from b3c_fixture);
select pg_temp.actor(requester_id,requester_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'BANNED_ACCOUNT_DENIED');
reset role;
rollback to banned_account;

savepoint closing_account;
insert into private.account_closure_requests(account_id,state,revision)
select requester_id,'READY',1 from b3c_fixture;
select pg_temp.actor(requester_id,requester_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'CLOSING_ACCOUNT_DENIED');
reset role;
select pg_temp.actor(worker_id,worker_session) from b3c_fixture;
set local role authenticated;
select pg_temp.expect((select count(*) from public.agreement_invalidations_v1)=0,'CLOSING_COUNTERPART_DENIED');
reset role;
rollback to closing_account;

-- Cert remains untouched and full closure execution refuses the changed source.
-- Exercise only the exact new relation's scope/delete plan, not the full engine.
do $erasure$
declare f b3c_fixture; predicate text; found_rows integer; relation text:='public.agreement_invalidations_v1';
begin
 select * into strict f from b3c_fixture;
 perform pg_temp.expect(relation=any(private.closure_redaction_relations_v5()),'RELATION_IN_ERASURE_ROSTER');
 perform pg_temp.expect((select count(*) from private.closure_dataset_catalog_v5 c,unnest(c.relations) r where r=relation)=1,'RELATION_IN_ONE_CLOSURE_CLASS');
 predicate:=private.closure_redaction_scope_v5(relation);
 execute 'select count(*) from public.agreement_invalidations_v1 t where '||predicate into found_rows using f.requester_id;
 perform pg_temp.expect(found_rows=1,'REQUESTER_ERASURE_SCOPE');
 execute 'select count(*) from public.agreement_invalidations_v1 t where '||predicate into found_rows using f.worker_id;
 perform pg_temp.expect(found_rows=1,'WORKER_ERASURE_SCOPE');
 perform pg_temp.expect(private.closure_redaction_patch_v5(relation,
  jsonb_build_object('agreement_id',f.agreement_id,'revision',1),f.requester_id,gen_random_uuid())='{"operation":"DELETE","patch":{}}'::jsonb,'CACHE_ERASURE_IS_DELETE');
 execute 'delete from public.agreement_invalidations_v1 t where '||predicate using f.requester_id;
 perform pg_temp.expect(not exists(select 1 from public.agreement_invalidations_v1 where agreement_id=f.agreement_id),'CACHE_ERASED');
 perform pg_temp.expect(exists(select 1 from public.agreement_invalidations_v1 where agreement_id=f.foreign_agreement_id),'UNRELATED_CACHE_PRESERVED');
end
$erasure$;

-- Canonical cancellation drives lifecycle cleanup; no trigger disabling or direct
-- status override. Any refusal is a proof failure, not silently treated as success.
select pg_temp.actor(worker_id,worker_session) from b3c_fixture;
insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,body)
select f.agreement_id,g.current_version,f.worker_id,'B3c lifecycle fixture'
from b3c_fixture f join public.agreements g on g.id=f.agreement_id;
select pg_temp.actor(requester_id,requester_session) from b3c_fixture;
set local role authenticated;
select public.rpc_cancel_agreement(:'agreement_id','Disposable B3c lifecycle proof');
reset role;
select pg_temp.expect(not exists(select 1 from public.agreement_invalidations_v1 where agreement_id=:'agreement_id'),'CANCELLED_AGREEMENT_CACHE_CLEANED');
select pg_temp.expect(private.retention_ai_source_ready() is false and private.closure_erasure_binding_v5() is null,'CERTIFICATE_GATE_REMAINS_CLOSED');
select pg_temp.expect((select certificate from chat_b3c_before)=(select to_jsonb(c) from private.closure_source_v5 c where singleton)
 and (select erasure_certificate from chat_b3c_before)=(select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton),'CERTIFICATES_UNCHANGED');
rollback;

-- This is an SQL-only result; never label it a websocket/native/provider proof.
select to_regclass('public.agreement_invalidations_v1') is null
 and private.closure_source_digest_v5()=:'b3c_original_digest'
 and (select sha256 from private.closure_source_v5 where singleton)=:'b3c_original_certificate'
 as b3c_rollback_ok
\gset
\if :b3c_rollback_ok
 \echo CHAT_B3C_SQL_PROOF_ROLLED_BACK
\else
 \echo CHAT_B3C_SQL_PROOF_ROLLBACK_FAILED
 \quit 1
\endif
