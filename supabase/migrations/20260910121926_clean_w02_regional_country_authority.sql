-- W02: explicit task and worker country through existing location/fact owners.
-- R47 semantics adapted; no historical backfill, market activation, money change,
-- provider, GPS, calendar mutation, or replacement geography/matching engine.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.validate_need_v2_fact(text,jsonb)')) is distinct from '6bfc84d00aaf74ea1f057053c92b4649' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='private.validate_need_v2_fact(text,jsonb)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.normalize_need_location(jsonb)')) is distinct from '7d20da483ae3ac0562b6999a61df6005' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='private.normalize_need_location(jsonb)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_location_review_document(uuid)')) is distinct from '1c832ec744335ae309615f662b120f2d' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='private.need_location_review_document(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_save_need_location_review(uuid,text,jsonb,boolean)')) is distinct from '798ed413b279c527ca18a3395b33fcaf' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='public.rpc_save_need_location_review(uuid,text,jsonb,boolean)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.worker_location_document(uuid)')) is distinct from '76d58ac710da162dd3a401732466a35b' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='private.worker_location_document(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_save_worker_location(text,jsonb,boolean)')) is distinct from 'fc498ca9f8870aa5809a0c7b72512841' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='public.rpc_save_worker_location(text,jsonb,boolean)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_profile_write()')) is distinct from 'b6730366a944b83e9ad454dae3ae6b3a' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='private.guard_profile_write()';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_need_write()')) is distinct from '9bca287576f86e442901f428097cfa70' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='private.guard_need_write()';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_material_snapshot(uuid)')) is distinct from '276a367b30ff42abfd3becc246f799f2' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='private.need_material_snapshot(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_save_need_draft_from_review(uuid,uuid,text)')) is distinct from 'ea7ed77204774f618c1748831a1032d1' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='public.rpc_save_need_draft_from_review(uuid,uuid,text)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)')) is distinct from 'cc0dde41267b4af82f2d352e4608d738' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='public.rpc_ai_open_need_edit_conversation_v2(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)')) is distinct from '0031ded75c5a44c6d3a6ab229708ae2e' then
    raise exception 'W02_COUNTRY_PREDECESSOR_DRIFT' using detail='public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)';
  end if;
end;
$preflight$;

create table private.location_market_configs (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  product_status text not null check (product_status in ('BUILDING','LIVE','WAITLIST','COMING')),
  default_currency_code text not null check (default_currency_code ~ '^[A-Z]{3}$'),
  default_language_tag text not null check (length(default_language_tag)<=35 and default_language_tag ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  default_timezone text not null
);
alter table private.location_market_configs enable row level security;
revoke all on table private.location_market_configs from public,anon,authenticated,service_role;
-- Metadata for current Serbian preparation only. This is not a LIVE declaration,
-- pricing configuration, legal admission, publication policy or geocoder approval.
insert into private.location_market_configs values ('RS','BUILDING','RSD','sr-Latn-RS','Europe/Belgrade');

alter table public.app_profiles add column operating_country_code text
  check (operating_country_code is null or operating_country_code ~ '^[A-Z]{2}$');
alter table public.needs add column task_country_code text
  check (task_country_code is null or task_country_code ~ '^[A-Z]{2}$'),
  add column task_timezone text;
comment on column public.app_profiles.operating_country_code is 'Explicit WORKER operating country; independent from requester/account location. Historical unknowns remain NULL.';
comment on column public.needs.task_country_code is 'Explicit confirmed execution country from NEED_FACT_V2; never inferred from account or city.';
comment on column public.needs.task_timezone is 'Market display metadata captured with explicit task country; does not reschedule UTC instants.';

create function private.require_location_country(value jsonb)
returns text language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare country text;
begin
  if value is null or value='null'::jsonb then raise exception 'LOCATION_COUNTRY_REQUIRED' using errcode='22023'; end if;
  if jsonb_typeof(value) is distinct from 'string' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  country:=btrim(value#>>'{}');
  if country !~ '^[A-Za-z]{2}$' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  country:=upper(country);
  if not exists(select 1 from private.location_market_configs where country_code=country and product_status in ('BUILDING','LIVE')) then
    raise exception 'LOCATION_COUNTRY_UNAVAILABLE' using errcode='55000';
  end if;
  return country;
end;
$f$;
revoke all on function private.require_location_country(jsonb) from public,anon,authenticated,service_role;

create function public.rpc_list_location_markets()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('countryCode',country_code,'productStatus',product_status,
    'defaultCurrencyCode',default_currency_code,'defaultLanguageTag',default_language_tag,'defaultTimezone',default_timezone)
    order by country_code),'[]'::jsonb) from private.location_market_configs);
end;
$f$;
revoke all on function public.rpc_list_location_markets() from public,anon,authenticated,service_role;
grant execute on function public.rpc_list_location_markets() to authenticated;

insert into private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
values('need.task_country_code','NEED_FACT_V2','TEXT',true,'PUBLIC',true,'needs.task_country_code');
alter function private.validate_need_v2_fact(text,jsonb) rename to validate_need_v2_fact_pre_country;
revoke all on function private.validate_need_v2_fact_pre_country(text,jsonb) from public,anon,authenticated,service_role;
create function private.validate_need_v2_fact(p_key text,p_value jsonb)
returns void language plpgsql stable security definer set search_path=pg_catalog
as $f$
begin
  if p_key='need.task_country_code' then
    if p_value#>>'{}' is distinct from private.require_location_country(p_value) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
    return;
  end if;
  perform private.validate_need_v2_fact_pre_country(p_key,p_value);
end;
$f$;
revoke all on function private.validate_need_v2_fact(text,jsonb) from public,anon,authenticated,service_role;

create or replace function private.normalize_need_location(value jsonb)
returns jsonb language plpgsql stable set search_path=pg_catalog
as $f$
declare geo jsonb; address jsonb; notes jsonb; country text;
begin
  if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>32768 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if value-ARRAY['taskCountryCode','geography','exactAddress','accessNotes']<>'{}'::jsonb
    or not (value ?& ARRAY['taskCountryCode','geography','exactAddress','accessNotes']) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  country:=private.require_location_country(value->'taskCountryCode');
  geo:=private.normalize_task_geography(value->'geography');
  address:=value->'exactAddress';notes:=value->'accessNotes';
  if (address<>'null'::jsonb and private.location_private_text_valid(address,1000) is distinct from true)
    or (notes<>'null'::jsonb and private.location_private_text_valid(notes,2000) is distinct from true)
    or (geo->>'mode'='REMOTE' and (address<>'null'::jsonb or notes<>'null'::jsonb)) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  return jsonb_build_object('taskCountryCode',country,'geography',geo,'exactAddress',case when address='null'::jsonb then null else btrim(address#>>'{}') end,
    'accessNotes',case when notes='null'::jsonb then null else btrim(notes#>>'{}') end);
end;
$f$;

create or replace function private.need_location_review_document(cid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $f$
  with material as (
    select c.id,c.account_id,c.status,c.bound_need_id,
      coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'key',f.fact_key,'value',f.fact_value,'status',f.status,
          'subjectNeedId',f.subject_need_id) order by f.fact_key)
        from public.ai_structured_facts f where f.conversation_id=c.id and f.superseded_at is null
          and f.fact_schema_version='NEED_FACT_V2'
          and f.fact_key in ('need.task_country_code','need.task_geography','need.exact_address','need.access_notes')),'[]'::jsonb) as facts
    from public.ai_conversations c where c.id=cid and c.purpose='NEED_INTAKE' and c.fact_schema_version='NEED_FACT_V2'
  ), projected as (
    select *,jsonb_build_object('taskCountryCode',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.task_country_code'),'geography',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.task_geography'),
      'exactAddress',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.exact_address'),
      'accessNotes',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.access_notes')) as value from material
  ) select jsonb_build_object('accountId',account_id,'conversationId',id,'editable',status='OPEN',
    'confirmed',value->'taskCountryCode'<>'null'::jsonb and value->'geography'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(facts) f where f->>'status'<>'CONFIRMED'),
    'value',value,'revision',encode(extensions.digest(jsonb_build_object('id',id,'status',status,'boundNeedId',bound_need_id,'facts',facts)::text,'sha256'),'hex'))
    from projected;
$f$;

create or replace function public.rpc_save_need_location_review(p_conversation_id uuid,p_expected_revision text,p_value jsonb,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare c public.ai_conversations; before_doc jsonb; wanted jsonb; k text; fv jsonb;
  old_fact public.ai_structured_facts; new_id uuid; display text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_confirmed is distinct from true then raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  wanted:=private.normalize_need_location(p_value);
  select * into c from public.ai_conversations where id=p_conversation_id and account_id=auth.uid() for update;
  if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then
    raise exception 'LOCATION_REVIEW_NOT_FOUND' using errcode='42501';
  end if;
  if c.status<>'OPEN' then raise exception 'LOCATION_REVIEW_NOT_EDITABLE' using errcode='55000'; end if;
  -- The conversation lock is also taken by the existing AI turn and reviewed-save
  -- commands. Each accepted write updates that row, fencing stale RR snapshots.
  before_doc:=private.need_location_review_document(c.id);
  if before_doc->'confirmed'='true'::jsonb and before_doc->'value'=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'review',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='40001'; end if;
  update public.ai_conversations set status='OPEN' where id=c.id;
  foreach k in array ARRAY['need.task_country_code','need.task_geography','need.exact_address','need.access_notes'] loop
    fv:=wanted->case k when 'need.task_country_code' then 'taskCountryCode' when 'need.task_geography' then 'geography' when 'need.exact_address' then 'exactAddress' else 'accessNotes' end;
    select * into old_fact from public.ai_structured_facts where conversation_id=c.id and fact_key=k and superseded_at is null for update;
    if found and old_fact.fact_value=fv and old_fact.status='CONFIRMED' then continue; end if;
    if old_fact.id is not null then
      update public.ai_structured_facts set superseded_at=statement_timestamp() where id=old_fact.id;
    end if;
    if fv='null'::jsonb then continue; end if;
    perform private.validate_need_v2_fact(k,fv);
    display:=case when k='need.task_geography' then
      case when fv->>'mode'='REMOTE' then 'Rad na daljinu' else
        coalesce(fv#>>'{start,city}',fv#>>'{serviceArea,city}',fv#>>'{start,area}',fv#>>'{serviceArea,area}',fv#>>'{start,label}',fv#>>'{serviceArea,label}') end
      else left(fv#>>'{}',1000) end;
    new_id:=extensions.gen_random_uuid();
    insert into public.ai_structured_facts(id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(new_id,auth.uid(),c.id,c.bound_need_id,k,fv,'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,auth.uid(),statement_timestamp(),
      'NEED_FACT_V2',case k when 'need.task_geography' then 'OBJECT' else 'TEXT' end,display);
    if old_fact.id is not null then update public.ai_structured_facts set superseded_by=new_id where id=old_fact.id; end if;
  end loop;
  return jsonb_build_object('saved',true,'idempotentReplay',false,'review',private.need_location_review_document(c.id));
end;
$f$;

create or replace function private.worker_location_document(pid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $f$
  with material as (
    select jsonb_build_object('profileId',p.id,'accountId',p.account_id,'operatingCountryCode',p.operating_country_code,'city',p.city,'radiusKm',p.radius_km,
      'approximatePosition',case when w.approximate_lat is not null and w.approximate_lng is not null then
        jsonb_build_object('latitude',w.approximate_lat,'longitude',w.approximate_lng) else null end) as doc
    from public.app_profiles p left join public.worker_match_preferences w on w.worker_profile_id=p.id where p.id=pid and p.kind='WORKER'
  ) select doc||jsonb_build_object('revision',encode(extensions.digest(doc::text,'sha256'),'hex')) from material;
$f$;

create or replace function public.rpc_save_worker_location(p_expected_revision text,p_value jsonb,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare p public.app_profiles; before_doc jsonb; wanted jsonb; v_city text; radius integer; coords jsonb; lat numeric; lng numeric; country text; previous_token text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_confirmed is distinct from true then raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>4096 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if p_value-ARRAY['operatingCountryCode','city','radiusKm','approximatePosition']<>'{}'::jsonb or not (p_value ?& ARRAY['operatingCountryCode','city','radiusKm','approximatePosition'])
    or private.location_text_valid(p_value->'city',160) is distinct from true
    or jsonb_typeof(p_value->'radiusKm') is distinct from 'number' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if (p_value->>'radiusKm')::numeric not between 1 and 200 or trunc((p_value->>'radiusKm')::numeric)<>(p_value->>'radiusKm')::numeric then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  country:=private.require_location_country(p_value->'operatingCountryCode');
  v_city:=btrim(p_value->>'city');radius:=(p_value->>'radiusKm')::numeric::integer;coords:=p_value->'approximatePosition';
  if coords<>'null'::jsonb then
    if jsonb_typeof(coords) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    if coords-ARRAY['latitude','longitude']<>'{}'::jsonb or jsonb_typeof(coords->'latitude') is distinct from 'number'
      or jsonb_typeof(coords->'longitude') is distinct from 'number' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    lat:=(coords->>'latitude')::numeric;lng:=(coords->>'longitude')::numeric;
    if lat not between -90 and 90 or lng not between -180 and 180 or lat<>round(lat,2) or lng<>round(lng,2) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
  end if;
  wanted:=jsonb_build_object('operatingCountryCode',country,'city',v_city,'radiusKm',radius,'approximatePosition',coords);
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  before_doc:=private.worker_location_document(p.id);
  if before_doc-ARRAY['revision','accountId','profileId']=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'location',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='40001'; end if;
  previous_token:=current_setting('uskoci.profile_mutation',true);
  perform set_config('uskoci.profile_mutation','LOCATION_REVIEW',true);
  update public.app_profiles set operating_country_code=country, city=v_city, radius_km=radius where id=p.id;
  perform set_config('uskoci.profile_mutation',coalesce(previous_token,''),true);
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
    values(p.id,auth.uid(),lat,lng) on conflict(worker_profile_id) do update set approximate_lat=excluded.approximate_lat,approximate_lng=excluded.approximate_lng;
  return jsonb_build_object('saved',true,'idempotentReplay',false,'location',private.worker_location_document(p.id));
end;
$f$;

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
  if (tg_op='INSERT' and new.operating_country_code is not null)
    or (tg_op='UPDATE' and new.operating_country_code is distinct from old.operating_country_code) then
    if token is distinct from 'LOCATION_REVIEW' or new.kind is distinct from 'WORKER' then
      raise exception 'PROFILE_COUNTRY_REQUIRES_LOCATION_REVIEW' using errcode='42501';
    end if;
    perform private.require_location_country(to_jsonb(new.operating_country_code));
  end if;
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

create or replace function private.guard_need_write()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  token text := current_setting('uskoci.need_lifecycle', true);
  material boolean;
begin
  if (tg_op='INSERT' and (new.task_country_code is not null or new.task_timezone is not null))
    or (tg_op='UPDATE' and (new.task_country_code is distinct from old.task_country_code or new.task_timezone is distinct from old.task_timezone)) then
    if current_setting('uskoci.need_region',true) is distinct from 'CONFIRMED_REVIEW' then
      raise exception 'NEED_COUNTRY_REQUIRES_CONFIRMED_REVIEW' using errcode='42501';
    end if;
    perform private.require_location_country(to_jsonb(new.task_country_code));
    if new.task_timezone is distinct from (select default_timezone from private.location_market_configs where country_code=new.task_country_code) then
      raise exception 'NEED_COUNTRY_TIMEZONE_MISMATCH' using errcode='22023';
    end if;
  end if;
  if not exists (
    select 1 from public.app_profiles p
     where p.id = new.requester_profile_id
       and p.account_id = new.requester_account_id
       and p.kind = 'REQUESTER'
  ) then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT'
       and not (new.status = 'PUBLISHED' and token = 'PUBLISH') then
      raise exception using errcode='22023', message='NEED_MUST_START_AS_DRAFT';
    end if;
    if token is null then
      new.urgent := false;
      new.urgent_activated_at := null;
      new.urgent_expires_at := null;
      new.urgent_policy_version := null;
      new.published_at := null;
      new.response_deadline := null;
    end if;
    return new;
  end if;

  if old.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
     and (
       (to_jsonb(new) - array['urgent','updated_at'])
         is distinct from
       (to_jsonb(old) - array['urgent','updated_at'])
       or (not coalesce(old.urgent, false) and coalesce(new.urgent, false))
     ) then
    raise exception using errcode='22023', message='NEED_TERMINAL_IMMUTABLE';
  end if;

  if new.requester_account_id <> old.requester_account_id then
    raise exception using errcode='42501', message='NEED_OWNER_IMMUTABLE';
  end if;

  material :=
       new.task_country_code is distinct from old.task_country_code
    or new.task_timezone is distinct from old.task_timezone
    or
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.required_slots is distinct from old.required_slots
    or new.mode is distinct from old.mode
    or new.requester_price_rsd is distinct from old.requester_price_rsd
    or new.required_skills is distinct from old.required_skills
    or new.required_tools is distinct from old.required_tools
    or new.required_vehicles is distinct from old.required_vehicles
    or new.required_licenses is distinct from old.required_licenses
    or new.minimum_experience_years is distinct from old.minimum_experience_years
    or new.verified_identity_required is distinct from old.verified_identity_required
    or new.schedule_kind is distinct from old.schedule_kind
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.execution_location_mode is distinct from old.execution_location_mode
    or new.approximate_lat is distinct from old.approximate_lat
    or new.approximate_lng is distinct from old.approximate_lng
    or new.approximate_city is distinct from old.approximate_city
    or new.approximate_area is distinct from old.approximate_area
    or new.public_photo_paths is distinct from old.public_photo_paths
    or new.response_deadline is distinct from old.response_deadline;

  if token = 'CONFIRM_EDIT' then
    if old.status not in ('PUBLISHED','SELECTION') or new.status <> 'DRAFT' then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_STATUS_INVALID';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_REVISION_INVALID';
    end if;
    if exists (select 1 from public.agreements a where a.need_id = old.id)
       or exists (select 1 from public.need_selections s where s.need_id = old.id)
       or exists (select 1 from public.marketplace_responses r where r.need_id = old.id and r.status = 'SELECTED') then
      raise exception using errcode='P0001', message='NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR';
    end if;
    if new.published_at is not null or new.response_deadline is not null then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_PUBLICATION_METADATA_NOT_CLEARED';
    end if;
    if coalesce(new.urgent, false)
       or new.urgent_activated_at is not null
       or new.urgent_expires_at is not null
       or new.urgent_policy_version is not null then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_URGENT_METADATA_NOT_CLEARED';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
         (token = 'PUBLISH' and old.status = 'DRAFT' and new.status = 'PUBLISHED')
      or (token = 'SELECT' and old.status in ('PUBLISHED','SELECTION') and new.status in ('SELECTION','ACTIVE'))
      or (token = 'CANCEL_NEED' and old.status in ('DRAFT','PUBLISHED','SELECTION') and new.status = 'CANCELLED')
      or (token = 'CANCEL_AGREEMENT' and old.status in ('ACTIVE','SELECTION') and new.status = 'SELECTION')
      or (token = 'EXPIRE' and old.status in ('PUBLISHED','SELECTION') and new.status = 'EXPIRED')
      or (token = 'COMPLETE' and old.status in ('ACTIVE','SELECTION') and new.status = 'COMPLETED')
    ) then
      raise exception using errcode='22023', message='NEED_STATUS_TRANSITION_REQUIRES_RPC';
    end if;
  end if;

  if token is null then
    if new.revision is distinct from old.revision then
      raise exception using errcode='42501', message='NEED_REVISION_IS_SERVER_OWNED';
    end if;
    if new.urgent is distinct from old.urgent then raise exception using errcode='42501', message='URGENT_IS_SERVER_OWNED'; end if;
    if new.urgent_activated_at is distinct from old.urgent_activated_at then raise exception using errcode='42501', message='URGENT_ACTIVATED_AT_IS_SERVER_OWNED'; end if;
    if new.urgent_expires_at is distinct from old.urgent_expires_at then raise exception using errcode='42501', message='URGENT_EXPIRES_AT_IS_SERVER_OWNED'; end if;
    if new.urgent_policy_version is distinct from old.urgent_policy_version then raise exception using errcode='42501', message='URGENT_POLICY_VERSION_IS_SERVER_OWNED'; end if;
    if new.published_at is distinct from old.published_at then raise exception using errcode='42501', message='PUBLISHED_AT_IS_SERVER_OWNED'; end if;
    if new.response_deadline is distinct from old.response_deadline then raise exception using errcode='42501', message='RESPONSE_DEADLINE_IS_SERVER_OWNED'; end if;
  end if;

  if material then
    if old.status in ('PUBLISHED','SELECTION') then
      raise exception using errcode='22023', message='PUBLIC_NEED_EDIT_REQUIRES_CONFIRM_COMMAND';
    elsif old.status <> 'DRAFT' then
      raise exception using errcode='P0001', message='NEED_NOT_EDITABLE';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.need_material_snapshot(p_need_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select jsonb_build_object(
    'title', n.title,
    'taskCountryCode', n.task_country_code,
    'taskTimezone', n.task_timezone,
    'description', n.description,
    'category', n.category,
    'requiredSlots', n.required_slots,
    'mode', n.mode,
    'requesterPriceRsd', n.requester_price_rsd,
    'requiredSkills', to_jsonb(n.required_skills),
    'requiredTools', to_jsonb(n.required_tools),
    'requiredVehicles', to_jsonb(n.required_vehicles),
    'requiredLicenses', to_jsonb(n.required_licenses),
    'minimumExperienceYears', n.minimum_experience_years,
    'verifiedIdentityRequired', n.verified_identity_required,
    'scheduleKind', n.schedule_kind,
    'startsAt', n.starts_at,
    'endsAt', n.ends_at,
    'executionLocationMode', n.execution_location_mode,
    'approximateLat', n.approximate_lat,
    'approximateLng', n.approximate_lng,
    'approximateCity', n.approximate_city,
    'approximateArea', n.approximate_area,
    'publicPhotoPaths', to_jsonb(n.public_photo_paths),
    'privateLocation', case when s.need_id is null then null else jsonb_build_object(
      'exactAddress', s.exact_address,
      'accessNotes', s.access_notes,
      'exactLat', s.exact_lat,
      'exactLng', s.exact_lng
    ) end
  )
  from public.needs n
  left join public.need_sensitive s on s.need_id = n.id
  where n.id = p_need_id
$$;

create or replace function public.rpc_save_need_draft_from_review(
  p_conversation_id uuid,
  p_requester_profile_id uuid,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_profile public.app_profiles%rowtype;
  v_facts jsonb;
  v_snapshot jsonb;
  v_missing text[];
  v_hash text;
  v_existing private.need_draft_save_commands%rowtype;
  v_need_id uuid;
  v_result jsonb;
  v_title text;
  v_description text;
  v_category text;
  v_mode text;
  v_price integer;
  v_schedule_kind text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_slots integer;
  v_skills text[];
  v_tools text[];
  v_vehicles text[];
  v_licenses text[];
  v_min_exp integer;
  v_verified boolean;
  v_photos text[];
  v_conditions text[];
  v_geo jsonb;
  v_exec_mode text;
  v_start jsonb;
  v_service jsonb;
  v_city text;
  v_area text;
  v_exact_address text;
  v_access_notes text;
  v_key text;
  v_value jsonb;
  v_safety text;
  v_country text; v_timezone text; v_region_token text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_conversation_id is null or p_requester_profile_id is null then raise exception 'DRAFT_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_client_request_id)),0)<8 or char_length(btrim(p_client_request_id))>200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'LEGACY_CONVERSATION_NOT_CANONICAL_SAVE_ELIGIBLE' using errcode='P0001'; end if;

  select * into v_profile
    from public.app_profiles
   where id=p_requester_profile_id
   for share;
  if not found or v_profile.account_id<>v_uid or v_profile.kind<>'REQUESTER' or v_profile.profile_status<>'ACTIVE' then
    raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501';
  end if;

  if exists (
    select 1 from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version<>'NEED_FACT_V2'
  ) then
    raise exception 'MIXED_SCHEMA_CONVERSATION_NOT_SAVE_ELIGIBLE' using errcode='P0001';
  end if;

  for v_key,v_value in
    select fact_key,fact_value
      from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version='NEED_FACT_V2'
       and status='CONFIRMED'
  loop
    perform private.validate_need_v2_fact(v_key,v_value);
  end loop;

  select coalesce(jsonb_object_agg(fact_key,fact_value),'{}'::jsonb)
    into v_facts
    from public.ai_structured_facts
   where conversation_id=p_conversation_id
     and superseded_at is null
     and fact_schema_version='NEED_FACT_V2'
     and status='CONFIRMED';

  select array_agg(r.fact_key order by r.fact_key)
    into v_missing
    from private.need_fact_registry r
   where r.required_for_draft
     and not (v_facts ? r.fact_key);

  if cardinality(coalesce(v_missing,'{}'::text[]))>0 then
    raise exception 'REQUIRED_CONFIRMED_FACTS_MISSING'
      using errcode='P0001',detail=array_to_string(v_missing,',');
  end if;

  v_title:=v_facts->>'need.title';
  v_description:=v_facts->>'need.description';
  v_category:=v_facts->>'need.category';
  v_mode:=v_facts->>'need.price_mode';
  if v_facts ? 'need.price_rsd' then v_price:=(v_facts->>'need.price_rsd')::integer; end if;
  if v_mode='MY_PRICE' and v_price is null then raise exception 'MY_PRICE_AMOUNT_REQUIRED' using errcode='P0001'; end if;
  if v_mode<>'MY_PRICE' then v_price:=null; end if;

  v_schedule_kind:=v_facts->>'need.schedule_kind';
  if v_facts ? 'need.starts_at' then v_starts_at:=(v_facts->>'need.starts_at')::timestamptz; end if;
  if v_facts ? 'need.ends_at' then v_ends_at:=(v_facts->>'need.ends_at')::timestamptz; end if;
  if v_schedule_kind='FIXED_WINDOW' and (v_starts_at is null or v_ends_at is null or v_ends_at<=v_starts_at) then
    raise exception 'FIXED_WINDOW_BOUNDS_REQUIRED' using errcode='P0001';
  end if;

  v_slots:=(v_facts->>'need.people_needed')::integer;

  select coalesce(array_agg(value),'{}'::text[]) into v_skills from jsonb_array_elements_text(coalesce(v_facts->'need.required_skills','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_tools from jsonb_array_elements_text(coalesce(v_facts->'need.required_tools','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_vehicles from jsonb_array_elements_text(coalesce(v_facts->'need.required_vehicles','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_licenses from jsonb_array_elements_text(coalesce(v_facts->'need.required_licenses','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_photos from jsonb_array_elements_text(coalesce(v_facts->'need.public_photo_paths','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_conditions from jsonb_array_elements_text(coalesce(v_facts->'need.critical_conditions','[]'::jsonb));

  if v_facts ? 'need.minimum_experience_years' then v_min_exp:=(v_facts->>'need.minimum_experience_years')::integer; end if;
  v_verified:=case when v_facts ? 'need.verified_identity_required' then (v_facts->>'need.verified_identity_required')::boolean else false end;

  v_country:=private.require_location_country(v_facts->'need.task_country_code');
  select default_timezone into v_timezone from private.location_market_configs where country_code=v_country;
  v_geo:=v_facts->'need.task_geography';
  v_exec_mode:=v_geo->>'mode';
  v_start:=coalesce(v_geo->'start','null'::jsonb);
  v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
  v_city:=coalesce(nullif(btrim(v_start->>'city'),''),nullif(btrim(v_service->>'city'),''));
  v_area:=coalesce(nullif(btrim(v_start->>'area'),''),nullif(btrim(v_service->>'area'),''));
  if v_exec_mode='REMOTE' then
    v_city:=''; v_area:='';
  end if;

  if v_facts ? 'need.exact_address' then v_exact_address:=v_facts->>'need.exact_address'; end if;
  if v_facts ? 'need.access_notes' then v_access_notes:=v_facts->>'need.access_notes'; end if;

  v_snapshot:=jsonb_build_object(
    'conversationId',p_conversation_id,
    'requesterProfileId',p_requester_profile_id,
    'confirmedFacts',v_facts
  );
  v_hash:=encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');

  select * into v_existing
    from private.need_draft_save_commands
   where account_id=v_uid
     and client_request_id=btrim(p_client_request_id)
   for update;

  if found then
    if v_existing.request_hash<>v_hash then
      raise exception 'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT' using errcode='22023';
    end if;
    return v_existing.result;
  end if;

  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;
  if v_conv.bound_need_id is not null then raise exception 'CONVERSATION_ALREADY_BOUND' using errcode='P0001'; end if;

  -- Successful semantic-command replay above remains an acknowledgment only.
  -- For every new DRAFT, recheck safety under the same conversation lock used
  -- by the service writer; a prior committed BLOCK cannot race past this gate.
  -- Ignore null/unsupported rows so they cannot clear an earlier BLOCK.
  -- No supported decision retains the existing conservative REVIEW fallback.
  select coalesce((
    select m.safety from public.ai_messages m
     where m.conversation_id=p_conversation_id
       and m.role='ASSISTANT'
       and m.safety in ('ALLOW','CLARIFY','REVIEW','BLOCK')
     order by m.sequence_no desc
     limit 1
  ),'REVIEW') into v_safety;
  if v_safety='BLOCK' then
    raise exception 'AI_NEED_DRAFT_BLOCKED' using errcode='P0001';
  end if;

  v_region_token:=current_setting('uskoci.need_region',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,starts_at,ends_at,required_slots,
    mode,requester_price_rsd,required_skills,required_tools,required_vehicles,
    required_licenses,verified_identity_required,minimum_experience_years,
    execution_location_mode,public_photo_paths,task_country_code,task_timezone
  ) values (
    v_uid,p_requester_profile_id,'DRAFT',v_title,v_description,v_category,
    coalesce(v_city,''),coalesce(v_area,''),v_schedule_kind,v_starts_at,v_ends_at,v_slots,
    v_mode,v_price,v_skills,v_tools,v_vehicles,v_licenses,v_verified,v_min_exp,
    v_exec_mode,v_photos,v_country,v_timezone
  )
  returning id into v_need_id;
  perform set_config('uskoci.need_region',coalesce(v_region_token,''),true);

  insert into public.need_geography(need_id,public_topology)
  values(v_need_id,v_geo);

  if v_exact_address is not null or v_access_notes is not null then
    insert into public.need_sensitive(need_id,exact_address,access_notes)
    values(v_need_id,coalesce(v_exact_address,''),coalesce(v_access_notes,''));
  end if;

  if cardinality(v_conditions)>0 then
    insert into public.need_requirement_details(need_id,critical_conditions)
    values(v_need_id,v_conditions);
  end if;

  update public.ai_structured_facts
     set subject_need_id=v_need_id
   where conversation_id=p_conversation_id
     and fact_schema_version='NEED_FACT_V2';

  update public.ai_conversations
     set bound_need_id=v_need_id,status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id;

  v_result:=jsonb_build_object(
    'needId',v_need_id,
    'status','DRAFT',
    'revision',1,
    'conversationId',p_conversation_id,
    'authoritative',true
  );

  insert into private.need_draft_save_commands(
    account_id,client_request_id,request_hash,conversation_id,requester_profile_id,need_id,result
  ) values (
    v_uid,btrim(p_client_request_id),v_hash,p_conversation_id,p_requester_profile_id,v_need_id,v_result
  );

  return v_result;
end
$function$;

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

  select * into v_need from public.needs where id=p_need_id for share;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  select * into v_sensitive from public.need_sensitive where need_id=v_need.id;
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
        if v_need.starts_at is not null then v_value:=to_jsonb(v_need.starts_at::text); v_display:=v_need.starts_at::text; end if;
      when 'need.ends_at' then
        if v_need.ends_at is not null then v_value:=to_jsonb(v_need.ends_at::text); v_display:=v_need.ends_at::text; end if;
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

  return jsonb_build_object(
    'conversationId',v_conversation_id,
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'authoritative',true
  );
end;
$$;

create or replace function public.rpc_confirm_need_edit_from_review(
  p_need_id uuid,
  p_expected_revision integer,
  p_conversation_id uuid,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_uid uuid:=auth.uid();
  v_request_id text:=btrim(coalesce(p_client_request_id,''));
  v_request_hash text;
  v_existing private.need_edit_commands%rowtype;
  v_conv public.ai_conversations%rowtype;
  v_need public.needs%rowtype;
  v_old_sensitive public.need_sensitive%rowtype;
  v_facts jsonb;
  v_missing text[];
  v_key text;
  v_value jsonb;
  v_title text;
  v_description text;
  v_category text;
  v_mode text;
  v_price integer;
  v_schedule_kind text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_slots integer;
  v_skills text[];
  v_tools text[];
  v_vehicles text[];
  v_licenses text[];
  v_min_exp integer;
  v_verified boolean;
  v_photos text[];
  v_conditions text[];
  v_geo jsonb;
  v_old_geo jsonb;
  v_exec_mode text;
  v_start jsonb;
  v_service jsonb;
  v_city text;
  v_area text;
  v_exact_address text;
  v_access_notes text;
  v_country text; v_timezone text; v_region_token text;
  v_exact_lat numeric;
  v_exact_lng numeric;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_conversation_id is null or p_expected_revision is null or p_expected_revision<1 then
    raise exception 'EDIT_REVIEW_IDENTITY_REQUIRED' using errcode='22004';
  end if;
  if char_length(v_request_id) not between 8 and 200 then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023'; end if;

  select * into v_conv from public.ai_conversations where id=p_conversation_id for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' or v_conv.fact_schema_version<>'NEED_FACT_V2' or v_conv.status<>'OPEN' then
    raise exception 'EDIT_CONVERSATION_NOT_CONFIRMABLE' using errcode='P0001';
  end if;
  if v_conv.bound_need_id is distinct from p_need_id then raise exception 'EDIT_CONVERSATION_NEED_MISMATCH' using errcode='42501'; end if;

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision<>p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;
  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  if exists(
    select 1 from public.ai_structured_facts f
     where f.conversation_id=p_conversation_id
       and f.superseded_at is null
       and f.status<>'CONFIRMED'
  ) then
    raise exception 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' using errcode='P0001';
  end if;

  for v_key,v_value in
    select fact_key,fact_value from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version='NEED_FACT_V2'
       and status='CONFIRMED'
  loop
    perform private.validate_need_v2_fact(v_key,v_value);
  end loop;

  select coalesce(jsonb_object_agg(fact_key,fact_value),'{}'::jsonb)
    into v_facts
    from public.ai_structured_facts
   where conversation_id=p_conversation_id
     and superseded_at is null
     and fact_schema_version='NEED_FACT_V2'
     and status='CONFIRMED';

  select array_agg(r.fact_key order by r.fact_key)
    into v_missing
    from private.need_fact_registry r
   where r.required_for_draft and not (v_facts ? r.fact_key);
  if cardinality(coalesce(v_missing,'{}'::text[]))>0 then
    raise exception 'REQUIRED_CONFIRMED_FACTS_MISSING' using errcode='P0001',detail=array_to_string(v_missing,',');
  end if;

  v_title:=v_facts->>'need.title';
  v_description:=v_facts->>'need.description';
  v_category:=v_facts->>'need.category';
  v_mode:=v_facts->>'need.price_mode';
  if v_facts ? 'need.price_rsd' then v_price:=(v_facts->>'need.price_rsd')::integer; end if;
  if v_mode='MY_PRICE' and v_price is null then raise exception 'MY_PRICE_AMOUNT_REQUIRED' using errcode='P0001'; end if;
  if v_mode<>'MY_PRICE' then v_price:=null; end if;

  v_schedule_kind:=v_facts->>'need.schedule_kind';
  if v_facts ? 'need.starts_at' then v_starts_at:=(v_facts->>'need.starts_at')::timestamptz; end if;
  if v_facts ? 'need.ends_at' then v_ends_at:=(v_facts->>'need.ends_at')::timestamptz; end if;
  if v_schedule_kind='FIXED_WINDOW' and (v_starts_at is null or v_ends_at is null or v_ends_at<=v_starts_at) then
    raise exception 'FIXED_WINDOW_BOUNDS_REQUIRED' using errcode='P0001';
  end if;

  v_slots:=(v_facts->>'need.people_needed')::integer;
  select coalesce(array_agg(value),'{}'::text[]) into v_skills from jsonb_array_elements_text(coalesce(v_facts->'need.required_skills','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_tools from jsonb_array_elements_text(coalesce(v_facts->'need.required_tools','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_vehicles from jsonb_array_elements_text(coalesce(v_facts->'need.required_vehicles','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_licenses from jsonb_array_elements_text(coalesce(v_facts->'need.required_licenses','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_photos from jsonb_array_elements_text(coalesce(v_facts->'need.public_photo_paths','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_conditions from jsonb_array_elements_text(coalesce(v_facts->'need.critical_conditions','[]'::jsonb));
  if v_facts ? 'need.minimum_experience_years' then v_min_exp:=(v_facts->>'need.minimum_experience_years')::integer; end if;
  v_verified:=case when v_facts ? 'need.verified_identity_required' then (v_facts->>'need.verified_identity_required')::boolean else false end;

  v_country:=private.require_location_country(v_facts->'need.task_country_code');
  select default_timezone into v_timezone from private.location_market_configs where country_code=v_country;
  v_geo:=v_facts->'need.task_geography';
  perform private.validate_need_v2_fact('need.task_geography',v_geo);
  v_exec_mode:=v_geo->>'mode';
  v_start:=coalesce(v_geo->'start','null'::jsonb);
  v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
  v_city:=coalesce(nullif(btrim(v_start->>'city'),''),nullif(btrim(v_service->>'city'),''));
  v_area:=coalesce(nullif(btrim(v_start->>'area'),''),nullif(btrim(v_service->>'area'),''));
  if v_exec_mode='REMOTE' then v_city:=''; v_area:=''; end if;

  if v_facts ? 'need.exact_address' then v_exact_address:=v_facts->>'need.exact_address'; end if;
  if v_facts ? 'need.access_notes' then v_access_notes:=v_facts->>'need.access_notes'; end if;
  select * into v_old_sensitive from public.need_sensitive where need_id=v_need.id;
  select g.public_topology into v_old_geo from public.need_geography g where g.need_id=v_need.id;
  if v_old_sensitive.need_id is not null
     and coalesce(v_exact_address,'')=coalesce(v_old_sensitive.exact_address,'')
     and v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then
    v_exact_lat:=v_old_sensitive.exact_lat;
    v_exact_lng:=v_old_sensitive.exact_lng;
  end if;

  v_before:=private.need_full_edit_snapshot(v_need.id);
  if v_before is null then raise exception 'NEED_SNAPSHOT_FAILED' using errcode='P0001'; end if;

  v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'needId',p_need_id,'expectedRevision',p_expected_revision,'conversationId',p_conversation_id,'facts',v_facts
  )::text,'UTF8'),'sha256'),'hex');

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||E'\n'||v_request_id,4411));
  select * into v_existing from private.need_edit_commands c
   where c.requester_account_id=v_uid and c.client_request_id=v_request_id for update;
  if found then
    if v_existing.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return v_existing.result||jsonb_build_object('idempotentReplay',true);
  end if;

  v_region_token:=current_setting('uskoci.need_region',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  perform set_config('uskoci.need_lifecycle','CONFIRM_EDIT',true);
  update public.needs n
     set title=btrim(v_title),description=btrim(v_description),category=btrim(v_category),
         required_slots=v_slots,mode=v_mode,requester_price_rsd=v_price,
         required_skills=v_skills,required_tools=v_tools,required_vehicles=v_vehicles,required_licenses=v_licenses,
         minimum_experience_years=v_min_exp,verified_identity_required=v_verified,
         schedule_kind=v_schedule_kind,starts_at=v_starts_at,ends_at=v_ends_at,
         execution_location_mode=v_exec_mode,task_country_code=v_country,task_timezone=v_timezone,
         approximate_lat=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.approximate_lat else null end,
         approximate_lng=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.approximate_lng else null end,
         approximate_city=coalesce(v_city,''),approximate_area=coalesce(v_area,''),
         public_photo_paths=v_photos,status='DRAFT',revision=v_need.revision+1,
         published_at=null,response_deadline=null,urgent=false,urgent_activated_at=null,urgent_expires_at=null,urgent_policy_version=null,
         updated_at=statement_timestamp()
   where n.id=v_need.id and n.revision=v_need.revision and n.status in ('PUBLISHED','SELECTION')
   returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle','',true);
  perform set_config('uskoci.need_region',coalesce(v_region_token,''),true);
  if not found then raise exception 'NEED_EDIT_CONFLICT' using errcode='40001'; end if;

  insert into public.need_geography(need_id,public_topology,updated_at)
  values(v_need.id,v_geo,statement_timestamp())
  on conflict(need_id) do update set public_topology=excluded.public_topology,updated_at=excluded.updated_at;

  insert into public.need_requirement_details(need_id,critical_conditions,updated_at)
  values(v_need.id,v_conditions,statement_timestamp())
  on conflict(need_id) do update set critical_conditions=excluded.critical_conditions,updated_at=excluded.updated_at;

  insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng,updated_at)
  values(v_need.id,coalesce(v_exact_address,''),coalesce(v_access_notes,''),v_exact_lat,v_exact_lng,statement_timestamp())
  on conflict(need_id) do update set exact_address=excluded.exact_address,access_notes=excluded.access_notes,
    exact_lat=excluded.exact_lat,exact_lng=excluded.exact_lng,updated_at=excluded.updated_at;

  delete from private.dispatch_schedule where need_id=v_need.id;

  v_after:=private.need_full_edit_snapshot(v_need.id);
  if v_after is not distinct from v_before then raise exception 'NO_MATERIAL_CHANGE' using errcode='22023'; end if;

  insert into private.need_revision_events(
    need_id,from_revision,to_revision,from_status,previous_material_snapshot,new_material_snapshot,created_by_account_id
  ) values (
    v_need.id,p_expected_revision,v_need.revision,'PUBLISHED_OR_SELECTION',v_before,v_after,v_uid
  ) returning id into v_event_id;

  update public.ai_conversations
     set status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id and status='OPEN';

  perform private.audit_marketplace(v_uid,'NEED_AI_EDIT_CONFIRMED','NEED',v_need.id,v_need.revision,
    jsonb_build_object('fromRevision',p_expected_revision,'toRevision',v_need.revision,'revisionEventId',v_event_id,'conversationId',p_conversation_id));

  v_result:=jsonb_build_object(
    'needId',v_need.id,'fromRevision',p_expected_revision,'revision',v_need.revision,'status','DRAFT',
    'revisionEventId',v_event_id,'conversationId',p_conversation_id,'requiresReadmission',true,
    'idempotentReplay',false,'authoritative',true
  );

  insert into private.need_edit_commands(
    requester_account_id,client_request_id,request_hash,need_id,from_revision,to_revision,revision_event_id,result
  ) values(v_uid,v_request_id,v_request_hash,v_need.id,p_expected_revision,v_need.revision,v_event_id,v_result);

  return v_result;
end;
$$;

revoke all on function private.validate_need_v2_fact(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.normalize_need_location(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.need_location_review_document(uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_save_need_location_review(uuid,text,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_need_location_review(uuid,text,jsonb,boolean) to authenticated;
revoke all on function private.worker_location_document(uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_save_worker_location(text,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_worker_location(text,jsonb,boolean) to authenticated;
revoke all on function private.guard_profile_write() from public,anon,authenticated,service_role;
revoke all on function private.guard_need_write() from public,anon,authenticated,service_role;
revoke all on function private.need_material_snapshot(uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_save_need_draft_from_review(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_need_draft_from_review(uuid,uuid,text) to authenticated;
revoke all on function public.rpc_ai_open_need_edit_conversation_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_ai_open_need_edit_conversation_v2(uuid) to authenticated;
revoke all on function public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text) from public,anon,authenticated,service_role;

do $postflight$
begin
  if exists(select 1 from private.location_market_configs where product_status='LIVE')
    or exists(select 1 from private.location_market_configs m where not exists(select 1 from pg_timezone_names t where t.name=m.default_timezone))
    or has_table_privilege('authenticated','private.location_market_configs','UPDATE')
    or has_function_privilege('anon','public.rpc_list_location_markets()','EXECUTE')
    or has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE') then
    raise exception 'W02_COUNTRY_SECURITY_POSTCONDITION';
  end if;
end;
$postflight$;
commit;
