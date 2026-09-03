-- USKOČI RU-1 — WORKER READINESS AUTHORITY
--
-- Forward-only candidate from the physically verified production predecessor:
--   57 migrations / 20260903160812_clean_ru0_authority_closure
--
-- Existing profile/business rows are never rewritten. New REQUESTER profiles
-- derive ACTIVE; new WORKER profiles derive DRAFT. Only the owner-only
-- rpc_complete_worker_profile command may perform WORKER DRAFT -> ACTIVE.

begin;

do $ru1_predecessor$
declare
  v_count integer;
  v_head text;
  v_default text;
  v_guard text;
  v_rpc text;
begin
  select count(*), max(version)
    into v_count, v_head
    from supabase_migrations.schema_migrations;

  if v_count <> 57 or v_head <> '20260903160812' then
    raise exception using
      errcode = '55000',
      message = format(
        'RU1_PREDECESSOR_MISMATCH: expected 57/20260903160812, got %s/%s',
        v_count, coalesce(v_head, '<null>')
      );
  end if;

  select pg_get_expr(d.adbin, d.adrelid)
    into v_default
    from pg_attrdef d
    join pg_attribute a
      on a.attrelid = d.adrelid and a.attnum = d.adnum
   where d.adrelid = 'public.app_profiles'::regclass
     and a.attname = 'profile_status';

  if v_default is distinct from '''ACTIVE''::text' then
    raise exception 'RU1_PREDECESSOR_MISMATCH: profile_status default drift';
  end if;

  v_guard := pg_get_functiondef('private.guard_profile_write()'::regprocedure);
  if position('new.profile_status := ''ACTIVE''' in v_guard) = 0
     or position('uskoci.profile_mutation' in v_guard) > 0 then
    raise exception 'RU1_PREDECESSOR_MISMATCH: profile guard drift';
  end if;

  v_rpc := pg_get_functiondef(
    'public.rpc_complete_worker_profile(uuid)'::regprocedure
  );
  if position('SKILL_REQUIRED' in v_rpc) = 0
     or position('set profile_status = ''ACTIVE''' in lower(v_rpc)) = 0
     or position('uskoci.profile_mutation' in v_rpc) > 0 then
    raise exception 'RU1_PREDECESSOR_MISMATCH: worker completion RPC drift';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.app_profiles'::regclass
       and conname = 'app_profiles_status_check'
       and pg_get_constraintdef(oid, true) like '%DRAFT%'
       and pg_get_constraintdef(oid, true) like '%ACTIVE%'
  ) then
    raise exception 'RU1_PREDECESSOR_MISMATCH: profile status constraint drift';
  end if;
end
$ru1_predecessor$;

lock table public.app_profiles in share row exclusive mode;

create temporary table ru1_preserved_profile_state (
  total_rows bigint not null,
  requester_active bigint not null,
  worker_active bigint not null,
  worker_draft bigint not null,
  row_fingerprint text not null
) on commit drop;

insert into ru1_preserved_profile_state
select
  count(*),
  count(*) filter (where kind = 'REQUESTER' and profile_status = 'ACTIVE'),
  count(*) filter (where kind = 'WORKER' and profile_status = 'ACTIVE'),
  count(*) filter (where kind = 'WORKER' and profile_status = 'DRAFT'),
  md5(coalesce(string_agg(
    id::text || '|' || account_id::text || '|' || kind || '|' || profile_status ||
    '|' || display_name || '|' || city || '|' || array_to_string(skills, ','),
    E'\n' order by id
  ), ''))
from public.app_profiles;

create temporary table ru1_preserved_function_hashes (
  function_identity text primary key,
  definition_md5 text not null
) on commit drop;

insert into ru1_preserved_function_hashes(function_identity, definition_md5)
values
  (
    'public.handle_uskoci_auth_user_created()',
    md5(pg_get_functiondef('public.handle_uskoci_auth_user_created()'::regprocedure))
  ),
  (
    'public.metadata_text_array(jsonb)',
    md5(pg_get_functiondef('public.metadata_text_array(jsonb)'::regprocedure))
  );

alter table public.app_profiles
  alter column profile_status set default 'DRAFT';

create or replace function private.guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  token text := nullif(
    current_setting('uskoci.profile_mutation', true),
    ''
  );
begin
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
    if not (
      token = 'COMPLETE_WORKER_PROFILE'
      and old.kind = 'WORKER'
      and old.profile_status = 'DRAFT'
      and new.profile_status = 'ACTIVE'
    ) then
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

revoke all on function private.guard_profile_write()
  from public, anon, authenticated, service_role;

drop trigger if exists guard_profile_write_trg on public.app_profiles;
create trigger guard_profile_write_trg
before insert or update on public.app_profiles
for each row execute function private.guard_profile_write();

create or replace function public.rpc_complete_worker_profile(
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.app_profiles%rowtype;
  v_previous_token text :=
    coalesce(current_setting('uskoci.profile_mutation', true), '');
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_profile
    from public.app_profiles
   where id = p_profile_id
   for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_profile.account_id <> v_uid or v_profile.kind <> 'WORKER' then
    raise exception 'NOT_WORKER_PROFILE_OWNER' using errcode = '42501';
  end if;

  if v_profile.profile_status = 'ACTIVE' then
    return;
  end if;

  if v_profile.profile_status <> 'DRAFT' then
    raise exception 'PROFILE_NOT_ACTIVATABLE'
      using errcode = 'P0001',
            detail = v_profile.profile_status;
  end if;

  if char_length(btrim(v_profile.display_name)) < 2 then
    raise exception 'DISPLAY_NAME_REQUIRED' using errcode = 'P0001';
  end if;

  if char_length(btrim(v_profile.city)) < 2 then
    raise exception 'CITY_REQUIRED' using errcode = 'P0001';
  end if;

  if cardinality(v_profile.skills) < 1 then
    raise exception 'SKILL_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config(
    'uskoci.profile_mutation',
    'COMPLETE_WORKER_PROFILE',
    true
  );

  update public.app_profiles
     set profile_status = 'ACTIVE'
   where id = p_profile_id
     and profile_status = 'DRAFT';

  if not found then
    raise exception 'PROFILE_ACTIVATION_RACE' using errcode = 'P0001';
  end if;

  perform set_config(
    'uskoci.profile_mutation',
    v_previous_token,
    true
  );
exception
  when others then
    perform set_config(
      'uskoci.profile_mutation',
      v_previous_token,
      true
    );
    raise;
end;
$function$;

revoke all on function public.rpc_complete_worker_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_complete_worker_profile(uuid)
  to authenticated, service_role;

revoke all privileges on table public.app_profiles
  from public, anon;
revoke delete on table public.app_profiles
  from authenticated;
grant select, insert, update on table public.app_profiles
  to authenticated;
grant select, insert, update, delete on table public.app_profiles
  to service_role;

comment on function private.guard_profile_write() is
  'RU-1: REQUESTER ACTIVE on creation; WORKER DRAFT on creation; profile identity immutable; only tokenized owner WORKER DRAFT->ACTIVE is allowed.';

comment on function public.rpc_complete_worker_profile(uuid) is
  'RU-1: owner-only replay-idempotent WORKER DRAFT->ACTIVE after display_name, city and skill readiness validation.';

do $ru1_postconditions$
declare
  v_default text;
  v_guard text;
  v_rpc text;
  v_before ru1_preserved_profile_state%rowtype;
  v_total bigint;
  v_requester_active bigint;
  v_worker_active bigint;
  v_worker_draft bigint;
  v_fingerprint text;
begin
  select pg_get_expr(d.adbin, d.adrelid)
    into v_default
    from pg_attrdef d
    join pg_attribute a
      on a.attrelid = d.adrelid and a.attnum = d.adnum
   where d.adrelid = 'public.app_profiles'::regclass
     and a.attname = 'profile_status';

  if v_default is distinct from '''DRAFT''::text' then
    raise exception 'RU1_POSTCONDITION_FAILED: default not DRAFT';
  end if;

  v_guard := pg_get_functiondef('private.guard_profile_write()'::regprocedure);
  if position('COMPLETE_WORKER_PROFILE' in v_guard) = 0
     or position('PROFILE_IDENTITY_IMMUTABLE' in v_guard) = 0
     or position('when new.kind = ''REQUESTER'' then ''ACTIVE''' in v_guard) = 0
     or position('when new.kind = ''WORKER'' then ''DRAFT''' in v_guard) = 0 then
    raise exception 'RU1_POSTCONDITION_FAILED: guard contract mismatch';
  end if;

  v_rpc := pg_get_functiondef(
    'public.rpc_complete_worker_profile(uuid)'::regprocedure
  );
  if position('COMPLETE_WORKER_PROFILE' in v_rpc) = 0
     or position('SKILL_REQUIRED' in v_rpc) = 0
     or position('PROFILE_NOT_ACTIVATABLE' in v_rpc) = 0 then
    raise exception 'RU1_POSTCONDITION_FAILED: completion RPC mismatch';
  end if;

  if has_function_privilege(
       'anon', 'public.rpc_complete_worker_profile(uuid)', 'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated', 'public.rpc_complete_worker_profile(uuid)', 'EXECUTE'
     )
     or not has_function_privilege(
       'service_role', 'public.rpc_complete_worker_profile(uuid)', 'EXECUTE'
     ) then
    raise exception 'RU1_POSTCONDITION_FAILED: completion RPC grants mismatch';
  end if;

  if has_function_privilege(
       'anon', 'private.guard_profile_write()', 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', 'private.guard_profile_write()', 'EXECUTE'
     )
     or has_function_privilege(
       'service_role', 'private.guard_profile_write()', 'EXECUTE'
     ) then
    raise exception 'RU1_POSTCONDITION_FAILED: private guard API exposure';
  end if;

  if has_table_privilege('anon', 'public.app_profiles', 'SELECT')
     or has_table_privilege('anon', 'public.app_profiles', 'INSERT')
     or has_table_privilege('anon', 'public.app_profiles', 'UPDATE')
     or has_table_privilege('anon', 'public.app_profiles', 'DELETE')
     or not has_table_privilege('authenticated', 'public.app_profiles', 'SELECT')
     or not has_table_privilege('authenticated', 'public.app_profiles', 'INSERT')
     or not has_table_privilege('authenticated', 'public.app_profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.app_profiles', 'DELETE')
     or not has_table_privilege('service_role', 'public.app_profiles', 'SELECT')
     or not has_table_privilege('service_role', 'public.app_profiles', 'INSERT')
     or not has_table_privilege('service_role', 'public.app_profiles', 'UPDATE')
     or not has_table_privilege('service_role', 'public.app_profiles', 'DELETE') then
    raise exception 'RU1_POSTCONDITION_FAILED: app_profiles grants mismatch';
  end if;

  select *
    into v_before
    from ru1_preserved_profile_state;

  select
    count(*),
    count(*) filter (where kind = 'REQUESTER' and profile_status = 'ACTIVE'),
    count(*) filter (where kind = 'WORKER' and profile_status = 'ACTIVE'),
    count(*) filter (where kind = 'WORKER' and profile_status = 'DRAFT'),
    md5(coalesce(string_agg(
      id::text || '|' || account_id::text || '|' || kind || '|' || profile_status ||
      '|' || display_name || '|' || city || '|' || array_to_string(skills, ','),
      E'\n' order by id
    ), ''))
    into v_total, v_requester_active, v_worker_active, v_worker_draft, v_fingerprint
    from public.app_profiles;

  if v_total <> v_before.total_rows
     or v_requester_active <> v_before.requester_active
     or v_worker_active <> v_before.worker_active
     or v_worker_draft <> v_before.worker_draft
     or v_fingerprint <> v_before.row_fingerprint then
    raise exception 'RU1_POSTCONDITION_FAILED: existing profile rows changed';
  end if;

  if md5(pg_get_functiondef('public.handle_uskoci_auth_user_created()'::regprocedure))
       <> (select definition_md5 from ru1_preserved_function_hashes
            where function_identity = 'public.handle_uskoci_auth_user_created()')
     or md5(pg_get_functiondef('public.metadata_text_array(jsonb)'::regprocedure))
       <> (select definition_md5 from ru1_preserved_function_hashes
            where function_identity = 'public.metadata_text_array(jsonb)') then
    raise exception 'RU1_POSTCONDITION_FAILED: preserved auth creation path changed';
  end if;
end
$ru1_postconditions$;

commit;
