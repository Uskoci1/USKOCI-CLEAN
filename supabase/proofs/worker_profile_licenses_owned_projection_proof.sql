-- P5 isolated SQL-role scaffold, NOT RUN. No Auth HTTP / PostgREST / device claim.
-- Runner: worker_profile_licenses_owned_projection_proof.mjs. Existing live79 +
-- source147 through PKG050 + A1/B3a/B3b disposable setup; no PKG051/P0/B3c needed.
-- Everything below BEGIN, including the exact candidate and synthetic fixtures,
-- rolls back. ON_ERROR_STOP plus connection disposal also rolls back on failure.
\set ON_ERROR_STOP on
\if :{?worker_profile_licenses_local_attested}
\else
  \quit 3
\endif
\if :worker_profile_licenses_local_attested
\else
  \quit 3
\endif
select :'HOST'='127.0.0.1' and :'PORT'='54322' and :'DBNAME'='postgres'
  and current_user='postgres' as worker_profile_licenses_local
\gset
\if :worker_profile_licenses_local
\else
  \quit 3
\endif

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=pg_catalog;
set local uskoci.worker_profile_licenses_proof='LOCAL_ONLY_ROLLBACK';
create temporary table worker_profile_licenses_fixture(label text primary key,account_id uuid not null,profile_id uuid);
create function pg_temp.worker_profile_licenses_expect(value boolean,label text) returns void language plpgsql as $f$
begin if value is distinct from true then raise exception 'WORKER_PROFILE_LICENSES_PROOF: %',label; end if; end
$f$;
create function pg_temp.worker_profile_licenses_actor(account_id uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub',coalesce(account_id::text,''),true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',account_id,'role','authenticated')::text,true);
end
$f$;
do $oracle$
begin
  execute replace(pg_get_functiondef('public.rpc_get_worker_profile_for_edit()'::regprocedure),
    'FUNCTION public.rpc_get_worker_profile_for_edit()', 'FUNCTION pg_temp.worker_profile_licenses_before()');
  execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema()));
end
$oracle$;
revoke all on function pg_temp.worker_profile_licenses_expect(boolean,text),
  pg_temp.worker_profile_licenses_actor(uuid),pg_temp.worker_profile_licenses_before()
  from public,anon,authenticated,service_role;
grant execute on function pg_temp.worker_profile_licenses_expect(boolean,text),pg_temp.worker_profile_licenses_before() to authenticated;
grant select on worker_profile_licenses_fixture to authenticated;

\ir ../candidates/worker_profile_licenses_owned_projection.sql
\echo PASS WORKER_PROFILE_LICENSES_EXACT_PREDECESSOR_AUTHORITY_AND_UNMOVED_CERTIFICATES

-- Fresh synthetic local identities only. Ordinary auth trigger creates the profiles;
-- ordinary field validation stays on for all self-declared license writes.
do $fixtures$
declare who record;
begin
  insert into worker_profile_licenses_fixture(label,account_id)
    select label,gen_random_uuid() from unnest(array['owner','foreign','empty','missing']) label;
  for who in select * from worker_profile_licenses_fixture where label<>'missing' loop
    insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values(who.account_id,'authenticated','authenticated','p5-'||who.account_id||'@proof.invalid',statement_timestamp(),
        '{"provider":"email","providers":["email"]}','{"full_name":"Disposable P5 proof"}',statement_timestamp(),statement_timestamp());
  end loop;
  update worker_profile_licenses_fixture f set profile_id=p.id from public.app_profiles p
    where p.account_id=f.account_id and p.kind='WORKER';
  if (select count(*) from worker_profile_licenses_fixture where profile_id is not null)<>3 then
    raise exception 'WORKER_PROFILE_LICENSES_FIXTURE_PROFILES';
  end if;
  update public.app_profiles set city='Novi Sad',skills=array['Fizicki poslovi'],
    licenses=array['Vozačka dozvola B','Sertifikat za viljuškar']
    where id=(select profile_id from worker_profile_licenses_fixture where label='owner');
  update public.app_profiles set licenses=array['Druga dozvola']
    where id=(select profile_id from worker_profile_licenses_fixture where label='foreign');
end
$fixtures$;
select pg_temp.worker_profile_licenses_actor((select account_id from worker_profile_licenses_fixture where label='owner'));
set local role authenticated;
select pg_temp.worker_profile_licenses_expect(
  public.rpc_get_worker_profile_for_edit()-'licenses'=pg_temp.worker_profile_licenses_before()
  and public.rpc_get_worker_profile_for_edit()->'licenses'='["Vozačka dozvola B","Sertifikat za viljuškar"]'::jsonb
  and public.rpc_get_worker_profile_for_edit()->>'profile_status'='DRAFT', 'draft exact additive projection');
reset role;
\echo PASS WORKER_PROFILE_LICENSES_DRAFT_EXACT_OLD_OUTPUT_PLUS_SELF_DECLARED_ARRAY

select pg_temp.worker_profile_licenses_actor((select account_id from worker_profile_licenses_fixture where label='foreign'));
set local role authenticated;
select pg_temp.worker_profile_licenses_expect(public.rpc_get_worker_profile_for_edit()->'licenses'='["Druga dozvola"]'::jsonb
  and public.rpc_get_worker_profile_for_edit()->>'account_id'=(select account_id::text from worker_profile_licenses_fixture where label='foreign')
  and public.rpc_get_worker_profile_for_edit()-'licenses'=pg_temp.worker_profile_licenses_before(),'foreign cannot read owner');
reset role;
select pg_temp.worker_profile_licenses_actor((select account_id from worker_profile_licenses_fixture where label='empty'));
set local role authenticated;
select pg_temp.worker_profile_licenses_expect(public.rpc_get_worker_profile_for_edit() ? 'licenses'
  and public.rpc_get_worker_profile_for_edit()->'licenses'='[]'::jsonb
  and public.rpc_get_worker_profile_for_edit()-'licenses'=pg_temp.worker_profile_licenses_before(),'stored empty is explicit');
reset role;
select pg_temp.worker_profile_licenses_actor((select account_id from worker_profile_licenses_fixture where label='missing'));
set local role authenticated;
select pg_temp.worker_profile_licenses_expect(public.rpc_get_worker_profile_for_edit() is null
  and pg_temp.worker_profile_licenses_before() is null,'missing remains null, never invented empty profile');
reset role;
\echo PASS WORKER_PROFILE_LICENSES_OWNERSHIP_EMPTY_AND_MISSING_PROFILE

-- Canonical DRAFT -> ACTIVE completion, not a synthetic status assignment.
select pg_temp.worker_profile_licenses_actor((select account_id from worker_profile_licenses_fixture where label='owner'));
set local role authenticated;
do $complete$
begin perform public.rpc_complete_worker_profile((select profile_id from worker_profile_licenses_fixture where label='owner')); end
$complete$;
select pg_temp.worker_profile_licenses_expect(public.rpc_get_worker_profile_for_edit()->>'profile_status'='ACTIVE'
  and public.rpc_get_worker_profile_for_edit()->'licenses'='["Vozačka dozvola B","Sertifikat za viljuškar"]'::jsonb
  and public.rpc_get_worker_profile_for_edit()-'licenses'=pg_temp.worker_profile_licenses_before(),'canonical active exact output');
reset role;
\echo PASS WORKER_PROFILE_LICENSES_CANONICAL_COMPLETION_PRESERVES_ARRAY_AND_OUTPUT

-- Synthetic status matrix only: no suspension/closure command or real account closure.
-- Same top-level local fixture mechanism as Discovery P0; no permanent trigger/ACL bypass.
set local session_replication_role=replica;
update public.app_profiles set profile_status='SUSPENDED'
  where id=(select profile_id from worker_profile_licenses_fixture where label='owner');
set local session_replication_role=origin;
set local role authenticated;
select pg_temp.worker_profile_licenses_expect(public.rpc_get_worker_profile_for_edit()->>'profile_status'='SUSPENDED'
  and public.rpc_get_worker_profile_for_edit()->'licenses'='["Vozačka dozvola B","Sertifikat za viljuškar"]'::jsonb
  and public.rpc_get_worker_profile_for_edit()-'licenses'=pg_temp.worker_profile_licenses_before(),'synthetic suspended exact output');
reset role;
set local session_replication_role=replica;
update public.app_profiles set profile_status='CLOSED'
  where id=(select profile_id from worker_profile_licenses_fixture where label='owner');
set local session_replication_role=origin;
set local role authenticated;
do $closed$
begin
  begin perform public.rpc_get_worker_profile_for_edit(); raise exception 'EXPECTED_CLOSED_REFUSAL';
  exception when insufficient_privilege then
    if sqlerrm<>'WORKER_PROFILE_RESTRICTED' then raise; end if;
  end;
  begin perform pg_temp.worker_profile_licenses_before(); raise exception 'EXPECTED_OLD_CLOSED_REFUSAL';
  exception when insufficient_privilege then
    if sqlerrm<>'WORKER_PROFILE_RESTRICTED' then raise; end if;
  end;
end
$closed$;
reset role;
\echo PASS WORKER_PROFILE_LICENSES_SYNTHETIC_SUSPENDED_AND_CLOSED_STATUS_MATRIX

select pg_temp.worker_profile_licenses_actor(null);
set local role authenticated;
do $no_subject$
begin
  begin perform public.rpc_get_worker_profile_for_edit(); raise exception 'EXPECTED_AUTH_REFUSAL';
  exception when insufficient_privilege then if sqlerrm<>'AUTH_REQUIRED' then raise; end if; end;
end
$no_subject$;
reset role;
set local role anon;
do $anon$
begin
  begin perform public.rpc_get_worker_profile_for_edit(); raise exception 'EXPECTED_ANON_ACL_REFUSAL';
  exception when insufficient_privilege then null; end;
end
$anon$;
reset role;
set local role service_role;
do $service$
begin
  begin perform public.rpc_get_worker_profile_for_edit(); raise exception 'EXPECTED_SERVICE_ACL_REFUSAL';
  exception when insufficient_privilege then null; end;
end
$service$;
reset role;
select pg_temp.worker_profile_licenses_expect(
  (select licenses=array['Vozačka dozvola B','Sertifikat za viljuškar'] from public.app_profiles
    where id=(select profile_id from worker_profile_licenses_fixture where label='owner')),
  'reads and refusals never clear stored licenses');
\echo PASS WORKER_PROFILE_LICENSES_AUTH_AND_EXECUTE_DENIALS_NEVER_CLEAR_DATA
rollback;
-- Independent runner connection compares the complete catalog/history and local
-- fixture-bearing tables even when this file fails before the explicit ROLLBACK.
