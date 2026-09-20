-- USKOČI PKG-015 / GAP-0018 — rollback-only disposable runtime proof.
-- Requires the current canonical account authority plus the source candidate
-- supabase/candidates/pkg015_dev_data_lineage.sql.
-- No Edge deploy, provider call, Storage object, production data or canonical DEV
-- mutation. Every account below is a synthetic row created inside this transaction
-- and discarded by the final rollback.
\set ON_ERROR_STOP on

begin;

do $seed$
declare
  v_fixture uuid := gen_random_uuid();
  v_real uuid := gen_random_uuid();
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
  (
    v_fixture,'authenticated','authenticated',
    'pkg015-proof-fixture-'||v_fixture::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','PKG015 Proof Fixture'),
    statement_timestamp(),statement_timestamp()
  ),
  (
    v_real,'authenticated','authenticated',
    'pkg015-proof-real-'||v_real::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','PKG015 Proof Real'),
    statement_timestamp(),statement_timestamp()
  );
  perform set_config('uskoci.pkg015_fixture',v_fixture::text,true);
  perform set_config('uskoci.pkg015_real',v_real::text,true);
  perform set_config('uskoci.pkg015_absent',gen_random_uuid()::text,true);
end
$seed$;

-- 1. An account nobody classified is UNCLASSIFIED, and that is never treated as
--    non-production. The safe default is to look like a real user.
do $unclassified$
declare
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_receipt jsonb;
begin
  if private.account_lineage(v_fixture) <> 'UNCLASSIFIED' then
    raise exception 'PKG015_UNKNOWN_ACCOUNT_NOT_UNCLASSIFIED';
  end if;
  if private.account_is_non_production(v_fixture) then
    raise exception 'PKG015_UNCLASSIFIED_TREATED_AS_TEST';
  end if;
  v_receipt := public.rpc_read_account_lineage_service(v_fixture);
  if v_receipt->>'lineage' <> 'UNCLASSIFIED' or (v_receipt->>'revision')::int <> 0
     or (v_receipt->>'nonProduction')::boolean is distinct from false
     or (v_receipt->>'authoritative')::boolean is distinct from true then
    raise exception 'PKG015_UNCLASSIFIED_RECEIPT_INVALID';
  end if;
end
$unclassified$;

-- 2. A first admission needs expected revision 0; anything else is a conflict, and
--    a conflict must leave no row behind.
do $first_admission$
declare
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_receipt jsonb;
  v_conflict boolean := false;
begin
  begin
    perform public.rpc_admit_account_lineage_service(
      v_fixture,'SYNTHETIC_ACCEPTANCE_FIXTURE','wrong expected revision','PKG-015 proof',7);
  exception when sqlstate '40001' then v_conflict := true;
  end;
  if not v_conflict then raise exception 'PKG015_FIRST_ADMISSION_ACCEPTED_STALE_REVISION'; end if;
  if exists(select 1 from private.account_lineage_v5 where account_id=v_fixture) then
    raise exception 'PKG015_CONFLICT_LEFT_A_ROW';
  end if;

  v_receipt := public.rpc_admit_account_lineage_service(
    v_fixture,'SYNTHETIC_ACCEPTANCE_FIXTURE','adversarial pair left by an early test run','PKG-015 census 2026-09-17',0);
  if v_receipt->>'lineage' <> 'SYNTHETIC_ACCEPTANCE_FIXTURE' or (v_receipt->>'revision')::int <> 1
     or (v_receipt->>'changed')::boolean is distinct from true then
    raise exception 'PKG015_FIRST_ADMISSION_RECEIPT_INVALID';
  end if;
  if not private.account_is_non_production(v_fixture) then
    raise exception 'PKG015_FIXTURE_NOT_NON_PRODUCTION';
  end if;
  if (select count(*) from private.account_lineage_events_v5 where account_id=v_fixture) <> 1
     or exists(select 1 from private.account_lineage_events_v5
               where account_id=v_fixture and from_lineage is not null) then
    raise exception 'PKG015_FIRST_HISTORY_ENTRY_INVALID';
  end if;
end
$first_admission$;

-- 3. Restating the identical classification is a no-op: no new revision, no new
--    history row. Replaying an admission must not inflate the record.
do $idempotent$
declare
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_receipt jsonb;
begin
  v_receipt := public.rpc_admit_account_lineage_service(
    v_fixture,'SYNTHETIC_ACCEPTANCE_FIXTURE','adversarial pair left by an early test run','PKG-015 census 2026-09-17',1);
  if (v_receipt->>'changed')::boolean is distinct from false or (v_receipt->>'revision')::int <> 1 then
    raise exception 'PKG015_RESTATEMENT_NOT_IDEMPOTENT';
  end if;
  if (select count(*) from private.account_lineage_events_v5 where account_id=v_fixture) <> 1 then
    raise exception 'PKG015_RESTATEMENT_WROTE_HISTORY';
  end if;
end
$idempotent$;

-- 4. A real reclassification advances the revision and records what it used to be.
do $reclassify$
declare
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_receipt jsonb;
  v_stale boolean := false;
begin
  v_receipt := public.rpc_admit_account_lineage_service(
    v_fixture,'DEV_ACCEPTANCE_QA','owner confirmed it as the acceptance account','PKG-015 owner decision',1);
  if (v_receipt->>'revision')::int <> 2 or v_receipt->>'lineage' <> 'DEV_ACCEPTANCE_QA'
     or (v_receipt->>'changed')::boolean is distinct from true then
    raise exception 'PKG015_RECLASSIFY_RECEIPT_INVALID';
  end if;
  if (select count(*) from private.account_lineage_events_v5 where account_id=v_fixture) <> 2
     or not exists(select 1 from private.account_lineage_events_v5
                   where account_id=v_fixture and revision=2
                     and from_lineage='SYNTHETIC_ACCEPTANCE_FIXTURE' and to_lineage='DEV_ACCEPTANCE_QA') then
    raise exception 'PKG015_RECLASSIFY_HISTORY_INVALID';
  end if;

  -- The superseded revision can no longer be used to write.
  begin
    perform public.rpc_admit_account_lineage_service(
      v_fixture,'OPERATOR','stale writer','PKG-015 proof',1);
  exception when sqlstate '40001' then v_stale := true;
  end;
  if not v_stale then raise exception 'PKG015_STALE_REVISION_ACCEPTED'; end if;
  if private.account_lineage(v_fixture) <> 'DEV_ACCEPTANCE_QA' then
    raise exception 'PKG015_STALE_WRITE_CHANGED_LINEAGE';
  end if;
end
$reclassify$;

-- 5. REAL_USER is classified but never non-production, so the predicate cannot be
--    used to quietly exempt a real account.
do $real_user$
declare
  v_real uuid := current_setting('uskoci.pkg015_real')::uuid;
begin
  perform public.rpc_admit_account_lineage_service(
    v_real,'REAL_USER','an ordinary account','PKG-015 proof',0);
  if private.account_lineage(v_real) <> 'REAL_USER' then
    raise exception 'PKG015_REAL_USER_NOT_RECORDED';
  end if;
  if private.account_is_non_production(v_real) then
    raise exception 'PKG015_REAL_USER_REPORTED_NON_PRODUCTION';
  end if;
end
$real_user$;

-- 6. Rejections: an account that does not exist, and a class outside the reviewed set.
do $rejections$
declare
  v_absent uuid := current_setting('uskoci.pkg015_absent')::uuid;
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_not_found boolean := false;
  v_bad_class boolean := false;
  v_bad_input boolean := false;
begin
  begin
    perform public.rpc_admit_account_lineage_service(
      v_absent,'SYNTHETIC_ACCEPTANCE_FIXTURE','no such account','PKG-015 proof',0);
  exception when sqlstate '42501' then v_not_found := true;
  end;
  if not v_not_found then raise exception 'PKG015_UNKNOWN_ACCOUNT_ADMITTED'; end if;

  begin
    perform public.rpc_admit_account_lineage_service(
      v_fixture,'SOMETHING_ELSE','invented class','PKG-015 proof',2);
  exception when check_violation then v_bad_class := true;
  end;
  if not v_bad_class then raise exception 'PKG015_UNREVIEWED_CLASS_ACCEPTED'; end if;

  begin
    perform public.rpc_admit_account_lineage_service(v_fixture,'OPERATOR','ok','x',null);
  exception when sqlstate '22023' then v_bad_input := true;
  end;
  if not v_bad_input then raise exception 'PKG015_NULL_REVISION_ACCEPTED'; end if;

  if private.account_lineage(v_fixture) <> 'DEV_ACCEPTANCE_QA' then
    raise exception 'PKG015_REJECTED_WRITE_CHANGED_LINEAGE';
  end if;
end
$rejections$;

-- 7. The history is immutable at the schema level, not by convention.
do $append_only$
declare
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_update_blocked boolean := false;
  v_delete_blocked boolean := false;
begin
  begin
    update private.account_lineage_events_v5 set to_lineage='REAL_USER' where account_id=v_fixture;
  exception when sqlstate '55000' then v_update_blocked := true;
  end;
  begin
    delete from private.account_lineage_events_v5 where account_id=v_fixture;
  exception when sqlstate '55000' then v_delete_blocked := true;
  end;
  if not v_update_blocked or not v_delete_blocked then
    raise exception 'PKG015_HISTORY_NOT_APPEND_ONLY';
  end if;
  if (select count(*) from private.account_lineage_events_v5 where account_id=v_fixture) <> 2 then
    raise exception 'PKG015_HISTORY_MUTATED';
  end if;
end
$append_only$;

-- 8. A client role cannot call either service function, even though both are
--    SECURITY DEFINER.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg015_fixture'),true);

do $client_denied$
declare
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_write_denied boolean := false;
  v_read_denied boolean := false;
begin
  begin
    perform public.rpc_admit_account_lineage_service(v_fixture,'REAL_USER','client tries to relabel itself','x',2);
  exception when insufficient_privilege then v_write_denied := true;
  end;
  begin
    perform public.rpc_read_account_lineage_service(v_fixture);
  exception when insufficient_privilege then v_read_denied := true;
  end;
  if not v_write_denied or not v_read_denied then
    raise exception 'PKG015_CLIENT_REACHED_LINEAGE_FUNCTIONS';
  end if;
end
$client_denied$;

reset role;

-- 9. Privilege and residue guard.
do $acl_guard$
declare
  v_fixture uuid := current_setting('uskoci.pkg015_fixture')::uuid;
  v_real uuid := current_setting('uskoci.pkg015_real')::uuid;
begin
  if has_function_privilege('anon','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
     or has_function_privilege('anon','public.rpc_read_account_lineage_service(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.rpc_read_account_lineage_service(uuid)','EXECUTE') then
    raise exception 'PKG015_LINEAGE_FUNCTIONS_OPENED';
  end if;
  if not has_function_privilege('service_role','public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.rpc_read_account_lineage_service(uuid)','EXECUTE') then
    raise exception 'PKG015_SERVICE_WRITER_MISSING';
  end if;
  if has_table_privilege('anon','private.account_lineage_v5','SELECT')
     or has_table_privilege('authenticated','private.account_lineage_v5','SELECT')
     or has_table_privilege('service_role','private.account_lineage_v5','SELECT')
     or has_table_privilege('authenticated','private.account_lineage_events_v5','SELECT')
     or has_table_privilege('service_role','private.account_lineage_events_v5','SELECT') then
    raise exception 'PKG015_LINEAGE_REGISTRY_LEAKED';
  end if;

  -- Exactly the two proof accounts are classified; the registry invented nothing.
  if (select count(*) from private.account_lineage_v5 where account_id in (v_fixture,v_real)) <> 2
     or (select count(*) from private.account_lineage_events_v5 where account_id in (v_fixture,v_real)) <> 3 then
    raise exception 'PKG015_REGISTRY_RESIDUE_INVALID';
  end if;

  -- The registry gates nothing: it must not have attached itself to any domain table.
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and t.tgname like '%account_lineage%'
      and (n.nspname, c.relname) not in (('private','account_lineage_events_v5'))) then
    raise exception 'PKG015_REGISTRY_TOUCHED_A_DOMAIN_TABLE';
  end if;
end
$acl_guard$;

rollback;

select 'PASS PKG015_DEV_DATA_LINEAGE unclassified_fails_closed first_admission revision_control idempotent_restatement reclassification_history stale_revision_refused unknown_account_refused unreviewed_class_refused append_only_history client_denied acl zero_domain_coupling' as result;
