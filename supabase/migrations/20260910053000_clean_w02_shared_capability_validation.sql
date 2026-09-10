-- W02 shared capabilities: reuse the existing V2 validator and profile guard.
-- No new taxonomy/table, no invented synonyms, licences or verification.
-- Existing comparison normalization remains private.lower_arr.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
begin
  if to_regprocedure('private.validate_need_v2_fact(text,jsonb)') is null
    or to_regprocedure('private.normalize_task_geography(jsonb)') is null
    or to_regprocedure('public.rpc_complete_worker_profile(uuid)') is null then
    raise exception 'W02_SHARED_PREDECESSOR_MISSING';
  end if;
  if (select md5(prosrc) from pg_proc where oid='private.guard_profile_write()'::regprocedure)
      is distinct from 'e224209e831680e5b67fe3aa4ea2c7e9' then
    raise exception 'W02_SHARED_PROFILE_GUARD_DRIFT';
  end if;
end;
$preflight$;

create or replace function private.guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  after_fields jsonb;
  before_fields jsonb := '{}'::jsonb;
  field text;
  validate_all boolean;
  token text := nullif(
    current_setting('uskoci.profile_mutation', true),
    ''
  );
begin
  -- Reuse the same V2 value validator and comparison vocabulary as a Need.
  -- Do not rewrite historical profiles or reject unrelated edits to old data.
  if new.kind = 'WORKER' then
    after_fields := to_jsonb(new);
    validate_all := tg_op = 'INSERT';
    if tg_op = 'UPDATE' then
      before_fields := to_jsonb(old);
      validate_all := old.profile_status = 'DRAFT' and new.profile_status = 'ACTIVE';
    end if;
    foreach field in array array['skills','tools','vehicles','licenses'] loop
      if validate_all or (after_fields->field) is distinct from (before_fields->field) then
        perform private.validate_need_v2_fact('need.required_' || field, after_fields->field);
      end if;
    end loop;
  end if;

  if tg_op = 'INSERT' then
    new.profile_status := case
      when new.kind = 'REQUESTER' then 'ACTIVE'
      when new.kind = 'WORKER' then 'DRAFT'
      else 'DRAFT'
    end;
    new.account_type := 'INDIVIDUAL';
    new.rating_requester := null;
    new.rating_worker := null;
    return new;
  end if;

  if new.account_id is distinct from old.account_id
     or new.kind is distinct from old.kind then
    raise exception 'PROFILE_IDENTITY_IMMUTABLE'
      using errcode = '42501';
  end if;

  if new.profile_status is distinct from old.profile_status then
    if token is distinct from 'COMPLETE_WORKER_PROFILE'
       or old.kind is distinct from 'WORKER'
       or old.profile_status is distinct from 'DRAFT'
       or new.profile_status is distinct from 'ACTIVE' then
      raise exception 'PROFILE_STATUS_IS_SERVER_DERIVED'
        using errcode = '42501';
    end if;
  end if;

  if new.account_type is distinct from old.account_type then
    raise exception 'ACCOUNT_TYPE_IS_SERVER_DERIVED'
      using errcode = '42501';
  end if;

  if new.rating_requester is distinct from old.rating_requester then
    raise exception 'RATING_REQUESTER_IS_SERVER_DERIVED'
      using errcode = '42501';
  end if;

  if new.rating_worker is distinct from old.rating_worker then
    raise exception 'RATING_WORKER_IS_SERVER_DERIVED'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_profile_write() from public, anon, authenticated, service_role;

do $postflight$
begin
  if not exists (select 1 from pg_proc where oid='private.guard_profile_write()'::regprocedure
    and prosecdef and proconfig=array['search_path=pg_catalog']
    and md5(prosrc)='b6730366a944b83e9ad454dae3ae6b3a') then
    raise exception 'W02_SHARED_PROFILE_GUARD_POSTCONDITION_FAILED';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.app_profiles'::regclass
    and tgname='guard_profile_write_trg' and tgfoid='private.guard_profile_write()'::regprocedure
    and tgenabled='O') then
    raise exception 'W02_SHARED_PROFILE_TRIGGER_MISSING';
  end if;
end;
$postflight$;

commit;
