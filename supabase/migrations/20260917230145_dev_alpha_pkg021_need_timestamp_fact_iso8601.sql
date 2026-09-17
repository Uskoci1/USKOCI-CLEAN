-- PKG-021: a saved draft can be reviewed for publishing again.
--
-- Two changes, both minimal.
--
-- 1. rpc_ai_open_need_edit_conversation_v2 seeded need.starts_at / need.ends_at as
--    `v_need.starts_at::text`. Postgres renders a timestamptz cast to text as
--    `2026-09-18 08:00:00+00` - a space instead of `T`, and `+00` instead of `+00:00`.
--    The client decoder requires strict ISO 8601 (src/data/serverReceipt.ts, timestamp()),
--    rejected the fact, and because one bad fact discards the whole review envelope the
--    review screen rendered blank with "Server je vratio necitljive podatke". Every other
--    field in the same case block already used to_jsonb(<native value>); only these two
--    cast to text first. Proven on canonical DEV: to_jsonb(timestamptz) renders
--    `2026-09-18T08:00:00+00:00`, which the client accepts.
--
-- 2. private.validate_need_v2_fact accepted the bad shape, because TIMESTAMPTZ shared a
--    branch with TEXT and ENUM that only checks for a non-blank string. The server could
--    therefore write what the client cannot read. The rule is added in the top layer, so the
--    historical validator chain is still delegated to unchanged.
--
-- The function body below is the live definition with exactly two lines changed.

do $preflight$
declare
  v_rpc_md5       text;
  v_validator_md5 text;
  v_rpc_def       text;
begin
  select md5(pg_get_functiondef(p.oid)), pg_get_functiondef(p.oid)
    into v_rpc_md5, v_rpc_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'rpc_ai_open_need_edit_conversation_v2';
  if v_rpc_md5 is distinct from 'b18fbaf486ab6acdc3e3bf105e37cb1b' then
    raise exception 'PKG021_PREFLIGHT_RPC_DIGEST_MISMATCH' using detail = coalesce(v_rpc_md5, 'ABSENT');
  end if;

  select md5(pg_get_functiondef(p.oid)) into v_validator_md5
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'validate_need_v2_fact';
  if v_validator_md5 is distinct from 'fdeb471b2a4ddcea19ec1c0a75a2457e' then
    raise exception 'PKG021_PREFLIGHT_VALIDATOR_DIGEST_MISMATCH' using detail = coalesce(v_validator_md5, 'ABSENT');
  end if;

  -- The defect must actually be present, so this cannot be replayed onto an already-fixed
  -- database and silently claim to have repaired something.
  if v_rpc_def not like '%starts_at::text%' or v_rpc_def not like '%ends_at::text%' then
    raise exception 'PKG021_PREFLIGHT_DEFECT_ABSENT';
  end if;

  -- The rule being added governs exactly the keys the registry calls TIMESTAMPTZ.
  if (select count(*) from private.need_fact_registry
       where schema_version = 'NEED_FACT_V2' and value_type = 'TIMESTAMPTZ') <> 2 then
    raise exception 'PKG021_PREFLIGHT_TIMESTAMPTZ_KEY_SET_CHANGED';
  end if;
end
$preflight$;

create or replace function public.rpc_ai_open_need_edit_conversation_v2(p_need_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_uid uuid:=auth.uid();
  v_need public.needs%rowtype;
  v_sensitive public.need_sensitive%rowtype;
  v_geo jsonb;
  v_conditions text[]:='{}'::text[];
  v_conversation_id uuid;
  v_key text;
  v_type text;
  v_value jsonb;
  v_display text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null then raise exception 'NEED_ID_REQUIRED' using errcode='22004'; end if;

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.status not in ('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  perform 1 from public.need_geography where need_id=v_need.id for share;
  perform 1 from public.need_requirement_details where need_id=v_need.id for share;
  select * into v_sensitive from public.need_sensitive where need_id=v_need.id for share;
  select g.public_topology into v_geo from public.need_geography g where g.need_id=v_need.id;
  select coalesce(d.critical_conditions,'{}'::text[]) into v_conditions
    from public.need_requirement_details d where d.need_id=v_need.id;
  if not found then v_conditions:='{}'::text[]; end if;

  if v_geo is null then
    if v_need.execution_location_mode='REMOTE' then
      v_geo:=jsonb_build_object('mode','REMOTE','start',null,'end',null,'waypoints','[]'::jsonb,'serviceArea',null);
    else
      raise exception 'NEED_EDIT_GEOGRAPHY_NOT_READY' using errcode='P0001';
    end if;
  end if;
  perform private.validate_need_v2_fact('need.task_geography',v_geo);

  insert into public.ai_conversations(account_id,purpose,status,bound_need_id,fact_schema_version)
  values(v_uid,'NEED_INTAKE','OPEN',v_need.id,'NEED_FACT_V2')
  returning id into v_conversation_id;

  for v_key,v_type in
    select fact_key,value_type from private.need_fact_registry
     where schema_version='NEED_FACT_V2'
     order by fact_key
  loop
    v_value:=null;
    v_display:=null;

    case v_key
      when 'need.title' then v_value:=to_jsonb(v_need.title); v_display:=v_need.title;
      when 'need.description' then v_value:=to_jsonb(v_need.description); v_display:=v_need.description;
      when 'need.category' then v_value:=to_jsonb(v_need.category); v_display:=v_need.category;
      when 'need.price_mode' then v_value:=to_jsonb(v_need.mode); v_display:=v_need.mode;
      when 'need.price_rsd' then
        if v_need.requester_price_rsd is not null then v_value:=to_jsonb(v_need.requester_price_rsd); v_display:=v_need.requester_price_rsd::text||' RSD'; end if;
      when 'need.schedule_kind' then v_value:=to_jsonb(v_need.schedule_kind); v_display:=v_need.schedule_kind;
      when 'need.starts_at' then
        if v_need.starts_at is not null then v_value:=to_jsonb(v_need.starts_at); v_display:=to_jsonb(v_need.starts_at)#>>'{}'; end if;
      when 'need.ends_at' then
        if v_need.ends_at is not null then v_value:=to_jsonb(v_need.ends_at); v_display:=to_jsonb(v_need.ends_at)#>>'{}'; end if;
      when 'need.people_needed' then v_value:=to_jsonb(v_need.required_slots); v_display:=v_need.required_slots::text;
      when 'need.required_skills' then v_value:=to_jsonb(coalesce(v_need.required_skills,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_skills,'{}'::text[]),', ');
      when 'need.required_tools' then v_value:=to_jsonb(coalesce(v_need.required_tools,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_tools,'{}'::text[]),', ');
      when 'need.required_vehicles' then v_value:=to_jsonb(coalesce(v_need.required_vehicles,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_vehicles,'{}'::text[]),', ');
      when 'need.required_licenses' then v_value:=to_jsonb(coalesce(v_need.required_licenses,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_licenses,'{}'::text[]),', ');
      when 'need.minimum_experience_years' then
        if v_need.minimum_experience_years is not null then v_value:=to_jsonb(v_need.minimum_experience_years); v_display:=v_need.minimum_experience_years::text; end if;
      when 'need.verified_identity_required' then v_value:=to_jsonb(coalesce(v_need.verified_identity_required,false)); v_display:=case when coalesce(v_need.verified_identity_required,false) then 'Da' else 'Ne' end;
      when 'need.task_country_code' then
        if v_need.task_country_code is not null then v_value:=to_jsonb(v_need.task_country_code); v_display:=v_need.task_country_code; end if;
      when 'need.task_geography' then v_value:=v_geo; v_display:=coalesce(v_geo->'start'->>'label',v_geo->'serviceArea'->>'label',v_geo->>'mode');
      when 'need.critical_conditions' then v_value:=to_jsonb(v_conditions); v_display:=array_to_string(v_conditions,', ');
      when 'need.public_photo_paths' then v_value:=to_jsonb(coalesce(v_need.public_photo_paths,'{}'::text[])); v_display:=case when cardinality(coalesce(v_need.public_photo_paths,'{}'::text[]))=0 then 'Bez fotografija' else cardinality(v_need.public_photo_paths)::text||' fotografija' end;
      when 'need.exact_address' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.exact_address),'') is not null then v_value:=to_jsonb(v_sensitive.exact_address); v_display:=v_sensitive.exact_address; end if;
      when 'need.access_notes' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.access_notes),'') is not null then v_value:=to_jsonb(v_sensitive.access_notes); v_display:=v_sensitive.access_notes; end if;
      else null;
    end case;

    if v_value is not null and v_value<>'null'::jsonb then
      perform private.validate_need_v2_fact(v_key,v_value);
      insert into public.ai_structured_facts(
        account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
        confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
        fact_schema_version,value_type,display_value
      ) values (
        v_uid,v_conversation_id,v_need.id,v_key,v_value,'CONFIRMED','SYSTEM_DERIVED','NEED_DRAFT',
        1,null,v_uid,statement_timestamp(),'NEED_FACT_V2',v_type,
        coalesce(nullif(left(v_display,1000),''),'—')
      );
    end if;
  end loop;

  -- Clone the already-confirmed private value last, after its public binding facts.
  -- Preserve the original human's provenance; do not manufacture a new confirmation.
  if v_sensitive.resolved_location is not null then
    if private.resolved_location_record_valid(v_sensitive.resolved_location,v_need.task_country_code,v_geo,
      v_sensitive.exact_address,v_uid) is distinct from true then
      raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
    insert into public.ai_structured_facts(account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(v_uid,v_conversation_id,v_need.id,'need.resolved_location',v_sensitive.resolved_location->'value','CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',
      1,null,(v_sensitive.resolved_location->>'confirmedByAccountId')::uuid,(v_sensitive.resolved_location->>'confirmedAt')::timestamptz,
      'NEED_FACT_V2','OBJECT','Potvrđene tačke: '||jsonb_array_length(v_sensitive.resolved_location#>'{value,points}')::text);
  end if;

  return jsonb_build_object(
    'conversationId',v_conversation_id,
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'authoritative',true
  );
end;
$$;

create or replace function private.validate_need_v2_fact(p_key text, p_value jsonb)
returns void
language plpgsql
stable security definer
set search_path to 'pg_catalog'
as $function$
begin
  if p_key='need.resolved_location' then
    if p_value is null or p_value='null'::jsonb or private.normalize_resolved_location(p_value,
      p_value#>>'{binding,taskCountryCode}',p_value#>'{binding,geography}',p_value#>>'{binding,exactAddress}') is distinct from p_value then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    return;
  end if;
  if p_key='need.task_country_code' then
    if p_value#>>'{}' is distinct from private.require_location_country(p_value) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
    return;
  end if;

  -- A TIMESTAMPTZ fact must carry the exact ISO 8601 shape the client decoder accepts, so the
  -- server cannot store a value that discards the whole review envelope when it is read. The
  -- pattern is the one in src/data/serverReceipt.ts timestamp(); the two must stay identical.
  if exists(select 1 from private.need_fact_registry
             where fact_key=p_key and schema_version='NEED_FACT_V2' and value_type='TIMESTAMPTZ') then
    if jsonb_typeof(p_value) is distinct from 'string'
      or (p_value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
      raise exception 'V2_FACT_TIMESTAMP_SHAPE_INVALID' using errcode='22023', detail=p_key;
    end if;
  end if;

  perform private.validate_need_v2_fact_pre_country(p_key,p_value);
end;
$function$;


do $postconditions$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'rpc_ai_open_need_edit_conversation_v2';

  if v_def like '%starts_at::text%' or v_def like '%ends_at::text%' then
    raise exception 'PKG021_POST_TEXT_CAST_STILL_PRESENT';
  end if;
  if v_def not like '%to_jsonb(v_need.starts_at)%' or v_def not like '%to_jsonb(v_need.ends_at)%' then
    raise exception 'PKG021_POST_NATIVE_SEED_MISSING';
  end if;

  -- Minimality enforced rather than asserted: undoing exactly the two intended edits must
  -- reproduce the definition that was read during diagnosis, byte for byte. If anything else
  -- in this 129-line body differs by even one character, this migration refuses to commit.
  if md5(replace(replace(v_def,
        'to_jsonb(v_need.starts_at); v_display:=to_jsonb(v_need.starts_at)#>>''{}''',
        'to_jsonb(v_need.starts_at::text); v_display:=v_need.starts_at::text'),
        'to_jsonb(v_need.ends_at); v_display:=to_jsonb(v_need.ends_at)#>>''{}''',
        'to_jsonb(v_need.ends_at::text); v_display:=v_need.ends_at::text'))
     is distinct from 'b18fbaf486ab6acdc3e3bf105e37cb1b' then
    raise exception 'PKG021_POST_NOT_MINIMAL';
  end if;

  -- No other plpgsql function in public or private may still carry the cast.
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prokind = 'f'
       and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
       and n.nspname in ('public','private')
       and (pg_get_functiondef(p.oid) like '%starts_at::text%'
         or pg_get_functiondef(p.oid) like '%ends_at::text%')
  ) then
    raise exception 'PKG021_POST_ANOTHER_WRITER_STILL_CASTS';
  end if;

  -- The validator now refuses the exact shape that blanked the screen.
  begin
    perform private.validate_need_v2_fact('need.starts_at', to_jsonb('2026-09-18 08:00:00+00'::text));
    raise exception 'PKG021_POST_VALIDATOR_STILL_ACCEPTS_POSTGRES_TEXT';
  exception
    when sqlstate '22023' then null;
  end;

  -- And still accepts every offset form the client accepts.
  perform private.validate_need_v2_fact('need.starts_at', to_jsonb('2026-09-18T08:00:00+00:00'::text));
  perform private.validate_need_v2_fact('need.ends_at',   to_jsonb('2026-09-18T10:00:00+02:00'::text));
  perform private.validate_need_v2_fact('need.starts_at', to_jsonb('2026-09-18T08:00:00Z'::text));
  perform private.validate_need_v2_fact('need.starts_at', to_jsonb('2026-09-18T08:00:00.123456Z'::text));

  -- What the fixed seeding actually produces must pass its own validator.
  perform private.validate_need_v2_fact('need.starts_at', to_jsonb('2026-09-18 08:00:00+00'::timestamptz));
  perform private.validate_need_v2_fact('need.ends_at',   to_jsonb('2026-09-18 11:00:00+00'::timestamptz));

  -- Untouched neighbours: non-timestamp facts still validate exactly as before.
  perform private.validate_need_v2_fact('need.title', to_jsonb('Prevoz i prenos stvari'::text));
  perform private.validate_need_v2_fact('need.people_needed', to_jsonb(2));

  -- The ceiling of this change: exactly the two registry keys are governed.
  if (select count(*) from private.need_fact_registry
       where schema_version = 'NEED_FACT_V2' and value_type = 'TIMESTAMPTZ') <> 2 then
    raise exception 'PKG021_POST_TIMESTAMPTZ_KEY_SET_CHANGED';
  end if;
end
$postconditions$;
