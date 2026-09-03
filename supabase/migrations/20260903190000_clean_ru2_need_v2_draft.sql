-- USKOČI RU-2 — NEED V2 INTAKE + R07 CANONICAL DRAFT
-- Forward-only candidate from verified production predecessor:
--   58 migrations / 20260903184545_clean_ru1_worker_readiness
--
-- Scope:
-- - preserve every existing AI fact/conversation and every existing Need row;
-- - introduce an explicit V2 fact registry and typed service writer;
-- - typed human correction;
-- - owner-only Human Review projection;
-- - idempotent server materialization of a DRAFT only;
-- - coarse/public task geography stays separate from exact/private facts;
-- - no publish/admission behavior (RU-3 remains fail-closed owner).

begin;

do $ru2_predecessor$
declare
  v_count integer;
  v_head text;
  v_ai_facts bigint;
  v_ai_conversations bigint;
  v_needs bigint;
begin
  select count(*), max(version)
    into v_count, v_head
    from supabase_migrations.schema_migrations;

  if v_count <> 58 or v_head <> '20260903184545' then
    raise exception using
      errcode='55000',
      message=format('RU2_PREDECESSOR_MISMATCH: expected 58/20260903184545, got %s/%s',
                     v_count, coalesce(v_head,'<null>'));
  end if;

  select count(*) into v_ai_facts from public.ai_structured_facts;
  select count(*) into v_ai_conversations from public.ai_conversations;
  select count(*) into v_needs from public.needs;

  if v_ai_facts <> 82 or v_ai_conversations <> 15 or v_needs <> 6 then
    raise exception using
      errcode='55000',
      message=format('RU2_PREDECESSOR_MISMATCH: expected facts/conversations/needs 82/15/6, got %s/%s/%s',
                     v_ai_facts,v_ai_conversations,v_needs);
  end if;

  if exists (select 1 from public.needs where status='DRAFT') then
    raise exception 'RU2_PREDECESSOR_MISMATCH: unexpected existing DRAFT Need';
  end if;
end
$ru2_predecessor$;

create temporary table ru2_preserved_state (
  ai_fact_count bigint not null,
  ai_fact_fingerprint text not null,
  conversation_count bigint not null,
  conversation_fingerprint text not null,
  need_count bigint not null,
  need_fingerprint text not null
) on commit drop;

insert into ru2_preserved_state
select
  (select count(*) from public.ai_structured_facts),
  (select md5(coalesce(string_agg(
      id::text || '|' || account_id::text || '|' || conversation_id::text || '|' ||
      coalesce(subject_need_id::text,'') || '|' || fact_key || '|' ||
      coalesce(fact_value::text,'null') || '|' || status || '|' || source || '|' ||
      scope || '|' || coalesce(confidence::text,'') || '|' ||
      coalesce(evidence_excerpt,'') || '|' || coalesce(confirmed_by_user_id::text,'') ||
      '|' || coalesce(confirmed_at::text,'') || '|' || coalesce(superseded_at::text,'') ||
      '|' || coalesce(superseded_by::text,''),
      E'\n' order by id
    ),'')) from public.ai_structured_facts),
  (select count(*) from public.ai_conversations),
  (select md5(coalesce(string_agg(
      id::text || '|' || account_id::text || '|' || purpose || '|' || status || '|' ||
      coalesce(bound_need_id::text,'') || '|' || created_at::text || '|' ||
      coalesce(completed_at::text,''),
      E'\n' order by id
    ),'')) from public.ai_conversations),
  (select count(*) from public.needs),
  (select md5(coalesce(string_agg(to_jsonb(n)::text, E'\n' order by id),'')) from public.needs n);

alter table public.ai_conversations
  add column fact_schema_version text not null default 'LEGACY_TEXT_V1';

alter table public.ai_conversations
  add constraint ai_conversations_fact_schema_version_check
  check (fact_schema_version in ('LEGACY_TEXT_V1','NEED_FACT_V2'));

alter table public.ai_structured_facts
  add column fact_schema_version text not null default 'LEGACY_TEXT_V1',
  add column value_type text not null default 'TEXT',
  add column display_value text;

alter table public.ai_structured_facts
  add constraint ai_structured_facts_schema_version_check
  check (fact_schema_version in ('LEGACY_TEXT_V1','NEED_FACT_V2')),
  add constraint ai_structured_facts_value_type_check
  check (value_type in ('TEXT','INTEGER','BOOLEAN','TEXT_ARRAY','ENUM','TIMESTAMPTZ','OBJECT')),
  add constraint ai_structured_facts_display_value_check
  check (display_value is null or char_length(btrim(display_value)) between 1 and 1000);

create table private.need_fact_registry (
  fact_key text primary key,
  schema_version text not null,
  value_type text not null,
  required_for_draft boolean not null default false,
  privacy_class text not null,
  material boolean not null default true,
  target_owner text not null,
  check (schema_version='NEED_FACT_V2'),
  check (value_type in ('TEXT','INTEGER','BOOLEAN','TEXT_ARRAY','ENUM','TIMESTAMPTZ','OBJECT')),
  check (privacy_class in ('PUBLIC','PRIVATE')),
  check (char_length(btrim(target_owner)) >= 1)
);

alter table private.need_fact_registry enable row level security;
alter table private.need_fact_registry force row level security;
revoke all on table private.need_fact_registry from public, anon, authenticated, service_role;

insert into private.need_fact_registry
  (fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
values
  ('need.title','NEED_FACT_V2','TEXT',true,'PUBLIC',true,'needs.title'),
  ('need.description','NEED_FACT_V2','TEXT',true,'PUBLIC',true,'needs.description'),
  ('need.category','NEED_FACT_V2','TEXT',true,'PUBLIC',true,'needs.category'),
  ('need.price_mode','NEED_FACT_V2','ENUM',true,'PUBLIC',true,'needs.mode'),
  ('need.price_rsd','NEED_FACT_V2','INTEGER',false,'PUBLIC',true,'needs.requester_price_rsd'),
  ('need.schedule_kind','NEED_FACT_V2','ENUM',true,'PUBLIC',true,'needs.schedule_kind'),
  ('need.starts_at','NEED_FACT_V2','TIMESTAMPTZ',false,'PUBLIC',true,'needs.starts_at'),
  ('need.ends_at','NEED_FACT_V2','TIMESTAMPTZ',false,'PUBLIC',true,'needs.ends_at'),
  ('need.people_needed','NEED_FACT_V2','INTEGER',true,'PUBLIC',true,'needs.required_slots'),
  ('need.required_skills','NEED_FACT_V2','TEXT_ARRAY',false,'PUBLIC',true,'needs.required_skills'),
  ('need.required_tools','NEED_FACT_V2','TEXT_ARRAY',false,'PUBLIC',true,'needs.required_tools'),
  ('need.required_vehicles','NEED_FACT_V2','TEXT_ARRAY',false,'PUBLIC',true,'needs.required_vehicles'),
  ('need.required_licenses','NEED_FACT_V2','TEXT_ARRAY',false,'PUBLIC',true,'needs.required_licenses'),
  ('need.minimum_experience_years','NEED_FACT_V2','INTEGER',false,'PUBLIC',true,'needs.minimum_experience_years'),
  ('need.verified_identity_required','NEED_FACT_V2','BOOLEAN',false,'PUBLIC',true,'needs.verified_identity_required'),
  ('need.task_geography','NEED_FACT_V2','OBJECT',true,'PUBLIC',true,'need_geography.public_topology'),
  ('need.critical_conditions','NEED_FACT_V2','TEXT_ARRAY',false,'PUBLIC',true,'need_requirement_details.critical_conditions'),
  ('need.public_photo_paths','NEED_FACT_V2','TEXT_ARRAY',false,'PUBLIC',true,'needs.public_photo_paths'),
  ('need.exact_address','NEED_FACT_V2','TEXT',false,'PRIVATE',true,'need_sensitive.exact_address'),
  ('need.access_notes','NEED_FACT_V2','TEXT',false,'PRIVATE',true,'need_sensitive.access_notes');

create table public.need_geography (
  need_id uuid primary key references public.needs(id) on delete cascade,
  public_topology jsonb not null,
  updated_at timestamptz not null default statement_timestamp(),
  check (jsonb_typeof(public_topology)='object')
);

alter table public.need_geography enable row level security;
revoke all on table public.need_geography from public, anon, authenticated;
grant select on table public.need_geography to authenticated;
grant select,insert,update,delete on table public.need_geography to service_role;

create policy need_geography_owner_read
on public.need_geography for select to authenticated
using (
  exists (
    select 1 from public.needs n
     where n.id=need_geography.need_id
       and n.requester_account_id=auth.uid()
  )
);

create policy need_geography_market_read
on public.need_geography for select to authenticated
using (
  exists (
    select 1 from public.needs n
     where n.id=need_geography.need_id
       and n.status in ('PUBLISHED','SELECTION')
  )
);

create table public.need_requirement_details (
  need_id uuid primary key references public.needs(id) on delete cascade,
  critical_conditions text[] not null default '{}',
  updated_at timestamptz not null default statement_timestamp()
);

alter table public.need_requirement_details enable row level security;
revoke all on table public.need_requirement_details from public, anon, authenticated;
grant select on table public.need_requirement_details to authenticated;
grant select,insert,update,delete on table public.need_requirement_details to service_role;

create policy need_requirement_details_owner_read
on public.need_requirement_details for select to authenticated
using (
  exists (
    select 1 from public.needs n
     where n.id=need_requirement_details.need_id
       and n.requester_account_id=auth.uid()
  )
);

create policy need_requirement_details_market_read
on public.need_requirement_details for select to authenticated
using (
  exists (
    select 1 from public.needs n
     where n.id=need_requirement_details.need_id
       and n.status in ('PUBLISHED','SELECTION')
  )
);

create table private.need_draft_save_commands (
  account_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text not null,
  request_hash text not null,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  requester_profile_id uuid not null references public.app_profiles(id) on delete restrict,
  need_id uuid not null references public.needs(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(account_id,client_request_id),
  check (char_length(btrim(client_request_id)) between 8 and 200),
  check (char_length(request_hash)=64)
);

alter table private.need_draft_save_commands enable row level security;
alter table private.need_draft_save_commands force row level security;
revoke all on table private.need_draft_save_commands from public, anon, authenticated, service_role;

create or replace function private.need_v2_location_ref_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v_key text;
begin
  if p_value is null or p_value='null'::jsonb then return true; end if;
  if jsonb_typeof(p_value) <> 'object' then return false; end if;

  for v_key in select jsonb_object_keys(p_value)
  loop
    if v_key not in ('label','city','area') then return false; end if;
  end loop;

  if coalesce(char_length(btrim(p_value->>'label')),0) > 240
     or coalesce(char_length(btrim(p_value->>'city')),0) > 160
     or coalesce(char_length(btrim(p_value->>'area')),0) > 160 then
    return false;
  end if;

  return coalesce(nullif(btrim(p_value->>'label'),''),nullif(btrim(p_value->>'city'),''),nullif(btrim(p_value->>'area'),'')) is not null;
end
$function$;

revoke all on function private.need_v2_location_ref_valid(jsonb)
from public, anon, authenticated, service_role;

create or replace function private.validate_need_v2_fact(p_key text,p_value jsonb)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_type text;
  v_text text;
  v_num numeric;
  v_item jsonb;
  v_geo jsonb;
  v_mode text;
  v_start jsonb;
  v_end jsonb;
  v_service jsonb;
  v_waypoints jsonb;
  v_key text;
begin
  select value_type into v_type
    from private.need_fact_registry
   where fact_key=p_key and schema_version='NEED_FACT_V2';

  if not found then
    raise exception 'V2_FACT_KEY_INVALID' using errcode='22023',detail=coalesce(p_key,'NULL');
  end if;
  if p_value is null or p_value='null'::jsonb then
    raise exception 'V2_FACT_VALUE_REQUIRED' using errcode='22023',detail=p_key;
  end if;

  if v_type in ('TEXT','ENUM','TIMESTAMPTZ') then
    if jsonb_typeof(p_value)<>'string' then
      raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key;
    end if;
    v_text:=nullif(btrim(p_value#>>'{}'),'');
    if v_text is null then raise exception 'V2_FACT_VALUE_REQUIRED' using errcode='22023',detail=p_key; end if;
  elsif v_type='INTEGER' then
    if jsonb_typeof(p_value)<>'number' then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end if;
    begin v_num:=(p_value#>>'{}')::numeric; exception when others then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end;
    if trunc(v_num)<>v_num then raise exception 'V2_FACT_INTEGER_REQUIRED' using errcode='22023',detail=p_key; end if;
  elsif v_type='BOOLEAN' then
    if jsonb_typeof(p_value)<>'boolean' then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end if;
  elsif v_type='TEXT_ARRAY' then
    if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>50 then
      raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key;
    end if;
    for v_item in select value from jsonb_array_elements(p_value)
    loop
      if jsonb_typeof(v_item)<>'string'
         or coalesce(char_length(btrim(v_item#>>'{}')),0)<1
         or char_length(v_item#>>'{}')>500 then
        raise exception 'V2_FACT_ARRAY_ITEM_INVALID' using errcode='22023',detail=p_key;
      end if;
    end loop;
  elsif v_type='OBJECT' then
    if jsonb_typeof(p_value)<>'object' then raise exception 'V2_FACT_TYPE_INVALID' using errcode='22023',detail=p_key; end if;
  end if;

  case p_key
    when 'need.title' then
      if char_length(v_text)>140 then raise exception 'V2_TITLE_INVALID' using errcode='22023'; end if;
    when 'need.description' then
      if char_length(v_text)>6000 then raise exception 'V2_DESCRIPTION_INVALID' using errcode='22023'; end if;
    when 'need.category' then
      if char_length(v_text)>120 then raise exception 'V2_CATEGORY_INVALID' using errcode='22023'; end if;
    when 'need.price_mode' then
      if v_text not in ('FASTEST','MY_PRICE','OFFERS') then raise exception 'V2_PRICE_MODE_INVALID' using errcode='22023'; end if;
    when 'need.price_rsd' then
      if v_num<1 or v_num>100000000 then raise exception 'V2_PRICE_INVALID' using errcode='22023'; end if;
    when 'need.schedule_kind' then
      if v_text not in ('FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME','TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
        raise exception 'V2_SCHEDULE_KIND_INVALID' using errcode='22023';
      end if;
    when 'need.starts_at','need.ends_at' then
      begin perform v_text::timestamptz; exception when others then raise exception 'V2_TIMESTAMP_INVALID' using errcode='22023',detail=p_key; end;
    when 'need.people_needed' then
      if v_num<1 or v_num>50 then raise exception 'V2_PEOPLE_INVALID' using errcode='22023'; end if;
    when 'need.minimum_experience_years' then
      if v_num<0 or v_num>60 then raise exception 'V2_EXPERIENCE_INVALID' using errcode='22023'; end if;
    when 'need.exact_address' then
      if char_length(v_text)>1000 then raise exception 'V2_EXACT_ADDRESS_INVALID' using errcode='22023'; end if;
    when 'need.access_notes' then
      if char_length(v_text)>2000 then raise exception 'V2_ACCESS_NOTES_INVALID' using errcode='22023'; end if;
    when 'need.task_geography' then
      v_geo:=p_value;
      for v_key in select jsonb_object_keys(v_geo)
      loop
        if v_key not in ('mode','start','end','waypoints','serviceArea') then
          raise exception 'V2_TASK_GEOGRAPHY_KEY_INVALID' using errcode='22023',detail=v_key;
        end if;
      end loop;
      v_mode:=nullif(btrim(v_geo->>'mode'),'');
      if v_mode not in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE') then
        raise exception 'V2_TASK_GEOGRAPHY_MODE_INVALID' using errcode='22023';
      end if;
      v_start:=coalesce(v_geo->'start','null'::jsonb);
      v_end:=coalesce(v_geo->'end','null'::jsonb);
      v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
      v_waypoints:=coalesce(v_geo->'waypoints','[]'::jsonb);
      if jsonb_typeof(v_waypoints)<>'array' or jsonb_array_length(v_waypoints)>20 then
        raise exception 'V2_TASK_GEOGRAPHY_WAYPOINTS_INVALID' using errcode='22023';
      end if;
      if not private.need_v2_location_ref_valid(v_start)
         or not private.need_v2_location_ref_valid(v_end)
         or not private.need_v2_location_ref_valid(v_service) then
        raise exception 'V2_TASK_GEOGRAPHY_LOCATION_INVALID' using errcode='22023';
      end if;
      for v_item in select value from jsonb_array_elements(v_waypoints)
      loop
        if not private.need_v2_location_ref_valid(v_item) then
          raise exception 'V2_TASK_GEOGRAPHY_LOCATION_INVALID' using errcode='22023';
        end if;
      end loop;
      if v_mode='REMOTE' and (v_start<>'null'::jsonb or v_end<>'null'::jsonb or v_service<>'null'::jsonb or jsonb_array_length(v_waypoints)>0) then
        raise exception 'V2_REMOTE_MUST_HAVE_NO_PHYSICAL_GEOGRAPHY' using errcode='22023';
      elsif v_mode='STATIONARY' and (v_start='null'::jsonb or v_end<>'null'::jsonb or v_service<>'null'::jsonb or jsonb_array_length(v_waypoints)>0) then
        raise exception 'V2_STATIONARY_GEOGRAPHY_INVALID' using errcode='22023';
      elsif v_mode='POINT_TO_POINT' and (v_start='null'::jsonb or v_end='null'::jsonb or v_service<>'null'::jsonb or jsonb_array_length(v_waypoints)>0) then
        raise exception 'V2_POINT_TO_POINT_GEOGRAPHY_INVALID' using errcode='22023';
      elsif v_mode='MULTI_STOP' and (v_start='null'::jsonb or v_service<>'null'::jsonb or (v_end='null'::jsonb and jsonb_array_length(v_waypoints)=0)) then
        raise exception 'V2_MULTI_STOP_GEOGRAPHY_INVALID' using errcode='22023';
      elsif v_mode='AREA_BASED' and (v_end<>'null'::jsonb or jsonb_array_length(v_waypoints)>0 or (v_start='null'::jsonb and v_service='null'::jsonb)) then
        raise exception 'V2_AREA_GEOGRAPHY_INVALID' using errcode='22023';
      end if;
    else null;
  end case;
end
$function$;

revoke all on function private.validate_need_v2_fact(text,jsonb)
from public, anon, authenticated, service_role;

create or replace function private.guard_ai_fact_schema()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_conversation_schema text;
  v_registry_type text;
begin
  select fact_schema_version
    into v_conversation_schema
    from public.ai_conversations
   where id=new.conversation_id;

  if not found then
    raise exception 'AI_CONVERSATION_NOT_FOUND' using errcode='23503';
  end if;

  if v_conversation_schema is distinct from new.fact_schema_version then
    raise exception 'AI_FACT_SCHEMA_MISMATCH' using errcode='22023';
  end if;

  if new.fact_schema_version='NEED_FACT_V2' then
    select value_type into v_registry_type
      from private.need_fact_registry
     where fact_key=new.fact_key;
    if not found or v_registry_type is distinct from new.value_type then
      raise exception 'V2_FACT_REGISTRY_MISMATCH' using errcode='22023',detail=new.fact_key;
    end if;
    if coalesce(char_length(btrim(new.display_value)),0)<1 then
      raise exception 'V2_FACT_DISPLAY_REQUIRED' using errcode='22023',detail=new.fact_key;
    end if;
    perform private.validate_need_v2_fact(new.fact_key,new.fact_value);
  end if;

  return new;
end
$function$;

revoke all on function private.guard_ai_fact_schema()
from public, anon, authenticated, service_role;

drop trigger if exists guard_ai_fact_schema_trg on public.ai_structured_facts;
create trigger guard_ai_fact_schema_trg
before insert or update of conversation_id,fact_key,fact_value,fact_schema_version,value_type,display_value
on public.ai_structured_facts
for each row execute function private.guard_ai_fact_schema();

create or replace function public.rpc_ai_open_conversation(p_purpose text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_id uuid;
  v_schema text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_purpose not in ('NEED_INTAKE','APPLICATION','PROFILE') then
    raise exception 'BAD_PURPOSE' using errcode='P0001';
  end if;

  v_schema:=case when p_purpose='NEED_INTAKE' then 'NEED_FACT_V2' else 'LEGACY_TEXT_V1' end;

  insert into public.ai_conversations(account_id,purpose,fact_schema_version)
  values(v_uid,p_purpose,v_schema)
  returning id into v_id;

  return v_id;
end
$function$;

revoke all on function public.rpc_ai_open_conversation(text) from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_open_conversation(text) to authenticated, service_role;

create or replace function public.rpc_ai_apply_interview_turn_v2_service(
  p_account_id uuid,
  p_conversation_id uuid,
  p_user_message text,
  p_assistant_message text,
  p_safety text,
  p_proposals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_conv public.ai_conversations%rowtype;
  v_item jsonb;
  v_key text;
  v_value jsonb;
  v_display text;
  v_evidence text;
  v_confidence numeric;
  v_value_type text;
  v_fact_id uuid;
  v_fact_ids uuid[]:='{}'::uuid[];
  v_previous_ids uuid[];
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_proposals jsonb:=coalesce(p_proposals,'[]'::jsonb);
begin
  if p_account_id is null or p_conversation_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_user_message)),0)<1 or char_length(btrim(p_user_message))>4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023'; end if;
  if coalesce(char_length(btrim(p_assistant_message)),0)<1 or char_length(btrim(p_assistant_message))>1500 then raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode='22023'; end if;
  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'SAFETY_DECISION_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_proposals)<>'array' or jsonb_array_length(v_proposals)>12 then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;
  if p_safety='BLOCK' and jsonb_array_length(v_proposals)>0 then raise exception 'BLOCK_CANNOT_PERSIST_PROPOSALS' using errcode='22023'; end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>p_account_id then raise exception 'CONVERSATION_OWNER_MISMATCH' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_CONVERSATION_REQUIRED' using errcode='P0001'; end if;
  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;

  for v_item in select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode='22023'; end if;
    v_key:=nullif(btrim(v_item->>'key'),'');
    v_value:=v_item->'value';
    v_display:=nullif(btrim(v_item->>'displayValue'),'');
    v_evidence:=nullif(btrim(v_item->>'evidence'),'');
    if v_key is null then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;
    if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023',detail=v_key; end if;
    if v_evidence is null or char_length(v_evidence)>500 then raise exception 'V2_FACT_EVIDENCE_INVALID' using errcode='22023',detail=v_key; end if;
    begin v_confidence:=(v_item->>'confidence')::numeric; exception when others then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end;
    if v_confidence is null or v_confidence<0 or v_confidence>1 then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end if;

    select value_type into v_value_type from private.need_fact_registry where fact_key=v_key;
    if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023',detail=v_key; end if;
    perform private.validate_need_v2_fact(v_key,v_value);

    v_fact_id:=extensions.gen_random_uuid();
    with superseded as (
      update public.ai_structured_facts
         set superseded_at=statement_timestamp(),superseded_by=null
       where conversation_id=p_conversation_id
         and fact_key=v_key
         and superseded_at is null
       returning id
    )
    select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

    insert into public.ai_structured_facts(
      id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,fact_schema_version,value_type,display_value
    ) values (
      v_fact_id,p_account_id,p_conversation_id,v_conv.bound_need_id,v_key,v_value,
      'NEEDS_CONFIRMATION','AI_INFERENCE','NEED_DRAFT',v_confidence,v_evidence,
      'NEED_FACT_V2',v_value_type,v_display
    );

    if cardinality(v_previous_ids)>0 then
      update public.ai_structured_facts set superseded_by=v_fact_id where id=any(v_previous_ids);
    end if;
    v_fact_ids:=array_append(v_fact_ids,v_fact_id);
  end loop;

  insert into public.ai_messages(account_id,conversation_id,role,body)
  values(p_account_id,p_conversation_id,'USER',btrim(p_user_message))
  returning id into v_user_message_id;

  insert into public.ai_messages(account_id,conversation_id,role,body,safety,proposed_fact_ids)
  values(p_account_id,p_conversation_id,'ASSISTANT',btrim(p_assistant_message),p_safety,v_fact_ids)
  returning id into v_assistant_message_id;

  return jsonb_build_object(
    'conversationId',p_conversation_id,
    'userMessageId',v_user_message_id,
    'assistantMessageId',v_assistant_message_id,
    'proposedCount',cardinality(v_fact_ids),
    'proposedFactIds',to_jsonb(v_fact_ids),
    'schemaVersion','NEED_FACT_V2',
    'safety',p_safety,
    'authoritative',true
  );
end
$function$;

revoke all on function public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)
to service_role;

create or replace function public.rpc_ai_correct_fact_v2(
  p_fact_id uuid,
  p_value jsonb,
  p_display_value text
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_old public.ai_structured_facts%rowtype;
  v_conv public.ai_conversations%rowtype;
  v_display text:=nullif(btrim(p_display_value),'');
  v_new_id uuid:=extensions.gen_random_uuid();
  v_previous_ids uuid[];
  v_value_type text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023'; end if;

  select * into v_old from public.ai_structured_facts where id=p_fact_id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_old.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;
  if v_old.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_FACT_REQUIRED' using errcode='P0001'; end if;
  if v_old.scope<>'NEED_DRAFT' then raise exception 'FACT_SCOPE_NOT_EDITABLE' using errcode='P0001'; end if;

  select * into v_conv from public.ai_conversations where id=v_old.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.purpose<>'NEED_INTAKE' or v_conv.status<>'OPEN' or v_conv.fact_schema_version<>'NEED_FACT_V2' then
    raise exception 'CONVERSATION_NOT_EDITABLE' using errcode='P0001';
  end if;

  select value_type into v_value_type from private.need_fact_registry where fact_key=v_old.fact_key;
  if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;
  perform private.validate_need_v2_fact(v_old.fact_key,p_value);

  with superseded as (
    update public.ai_structured_facts
       set superseded_at=statement_timestamp(),superseded_by=null
     where conversation_id=v_old.conversation_id
       and fact_key=v_old.fact_key
       and superseded_at is null
     returning id
  )
  select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

  insert into public.ai_structured_facts(
    id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
    confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
    fact_schema_version,value_type,display_value
  ) values (
    v_new_id,v_uid,v_old.conversation_id,v_old.subject_need_id,v_old.fact_key,p_value,
    'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,v_uid,statement_timestamp(),
    'NEED_FACT_V2',v_value_type,v_display
  );

  if cardinality(v_previous_ids)>0 then
    update public.ai_structured_facts set superseded_by=v_new_id where id=any(v_previous_ids);
  end if;

  return v_new_id;
end
$function$;

revoke all on function public.rpc_ai_correct_fact_v2(uuid,jsonb,text)
from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_correct_fact_v2(uuid,jsonb,text)
to authenticated, service_role;

create or replace function public.rpc_ai_need_review_v2(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_facts jsonb;
  v_missing jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',f.id,
      'key',f.fact_key,
      'value',f.fact_value,
      'displayValue',coalesce(f.display_value,
        case when jsonb_typeof(f.fact_value)='string' then f.fact_value#>>'{}' else f.fact_value::text end),
      'status',f.status,
      'source',f.source,
      'evidence',f.evidence_excerpt,
      'schemaVersion',f.fact_schema_version,
      'valueType',f.value_type,
      'privacyClass',coalesce(r.privacy_class,'PRIVATE'),
      'requiredForDraft',coalesce(r.required_for_draft,false),
      'material',coalesce(r.material,true)
    ) order by f.created_at,f.fact_key
  ),'[]'::jsonb)
    into v_facts
    from public.ai_structured_facts f
    left join private.need_fact_registry r
      on r.fact_key=f.fact_key and f.fact_schema_version='NEED_FACT_V2'
   where f.conversation_id=p_conversation_id
     and f.superseded_at is null;

  if v_conv.fact_schema_version='NEED_FACT_V2' then
    select coalesce(jsonb_agg(r.fact_key order by r.fact_key),'[]'::jsonb)
      into v_missing
      from private.need_fact_registry r
     where r.required_for_draft
       and not exists (
         select 1 from public.ai_structured_facts f
          where f.conversation_id=p_conversation_id
            and f.fact_key=r.fact_key
            and f.fact_schema_version='NEED_FACT_V2'
            and f.status='CONFIRMED'
            and f.superseded_at is null
       );
  else
    v_missing:='[]'::jsonb;
  end if;

  return jsonb_build_object(
    'conversationId',v_conv.id,
    'schemaVersion',v_conv.fact_schema_version,
    'status',v_conv.status,
    'boundNeedId',v_conv.bound_need_id,
    'facts',v_facts,
    'missingRequired',v_missing,
    'canSaveDraft',
      v_conv.fact_schema_version='NEED_FACT_V2'
      and v_conv.status='OPEN'
      and jsonb_array_length(v_missing)=0
  );
end
$function$;

revoke all on function public.rpc_ai_need_review_v2(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_need_review_v2(uuid)
to authenticated, service_role;

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

  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,starts_at,ends_at,required_slots,
    mode,requester_price_rsd,required_skills,required_tools,required_vehicles,
    required_licenses,verified_identity_required,minimum_experience_years,
    execution_location_mode,public_photo_paths
  ) values (
    v_uid,p_requester_profile_id,'DRAFT',v_title,v_description,v_category,
    coalesce(v_city,''),coalesce(v_area,''),v_schedule_kind,v_starts_at,v_ends_at,v_slots,
    v_mode,v_price,v_skills,v_tools,v_vehicles,v_licenses,v_verified,v_min_exp,
    v_exec_mode,v_photos
  )
  returning id into v_need_id;

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

revoke all on function public.rpc_save_need_draft_from_review(uuid,uuid,text)
from public, anon, authenticated, service_role;
grant execute on function public.rpc_save_need_draft_from_review(uuid,uuid,text)
to authenticated, service_role;

-- Exact/private Need data becomes server-command owned for new writes.
-- Existing grant-driven SELECT behavior remains intact.
revoke insert,update,delete on table public.need_sensitive from authenticated;
grant select on table public.need_sensitive to authenticated;
grant select,insert,update,delete on table public.need_sensitive to service_role;

comment on table private.need_fact_registry is
  'RU-2 server-owned typed Need V2 fact registry. Unknown keys fail closed.';
comment on function public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb) is
  'RU-2 service-only typed Need V2 turn persistence. Client roles cannot execute.';
comment on function public.rpc_ai_correct_fact_v2(uuid,jsonb,text) is
  'RU-2 owner-only typed human correction with supersession/provenance.';
comment on function public.rpc_ai_need_review_v2(uuid) is
  'RU-2 owner Human Review projection. LEGACY_TEXT_V1 is readable but never canonical-save eligible.';
comment on function public.rpc_save_need_draft_from_review(uuid,uuid,text) is
  'RU-2 R07 server materializer: exact confirmed V2 snapshot -> owner DRAFT only; never publishes.';

do $ru2_postconditions$
declare
  v_before ru2_preserved_state%rowtype;
  v_fact_count bigint;
  v_fact_fingerprint text;
  v_conv_count bigint;
  v_conv_fingerprint text;
  v_need_count bigint;
  v_need_fingerprint text;
  v_registry_count integer;
begin
  select * into v_before from ru2_preserved_state;

  select count(*),
         md5(coalesce(string_agg(
      id::text || '|' || account_id::text || '|' || conversation_id::text || '|' ||
      coalesce(subject_need_id::text,'') || '|' || fact_key || '|' ||
      coalesce(fact_value::text,'null') || '|' || status || '|' || source || '|' ||
      scope || '|' || coalesce(confidence::text,'') || '|' ||
      coalesce(evidence_excerpt,'') || '|' || coalesce(confirmed_by_user_id::text,'') ||
      '|' || coalesce(confirmed_at::text,'') || '|' || coalesce(superseded_at::text,'') ||
      '|' || coalesce(superseded_by::text,''),
      E'\n' order by id
    ),''))
    into v_fact_count,v_fact_fingerprint
    from public.ai_structured_facts;

  select count(*),
         md5(coalesce(string_agg(
      id::text || '|' || account_id::text || '|' || purpose || '|' || status || '|' ||
      coalesce(bound_need_id::text,'') || '|' || created_at::text || '|' ||
      coalesce(completed_at::text,''),
      E'\n' order by id
    ),''))
    into v_conv_count,v_conv_fingerprint
    from public.ai_conversations;

  select count(*),md5(coalesce(string_agg(to_jsonb(n)::text,E'\n' order by id),''))
    into v_need_count,v_need_fingerprint
    from public.needs n;

  if v_fact_count<>v_before.ai_fact_count or v_fact_fingerprint<>v_before.ai_fact_fingerprint then
    raise exception 'RU2_POSTCONDITION_FAILED: existing AI fact rows changed';
  end if;
  if v_conv_count<>v_before.conversation_count or v_conv_fingerprint<>v_before.conversation_fingerprint then
    raise exception 'RU2_POSTCONDITION_FAILED: existing AI conversations changed';
  end if;
  if v_need_count<>v_before.need_count or v_need_fingerprint<>v_before.need_fingerprint then
    raise exception 'RU2_POSTCONDITION_FAILED: existing Need rows changed';
  end if;

  if (select count(*) from public.ai_structured_facts where fact_schema_version='LEGACY_TEXT_V1')<>82
     or (select count(*) from public.ai_conversations where fact_schema_version='LEGACY_TEXT_V1')<>15 then
    raise exception 'RU2_POSTCONDITION_FAILED: legacy classification mismatch';
  end if;

  select count(*) into v_registry_count from private.need_fact_registry;
  if v_registry_count<>20 then raise exception 'RU2_POSTCONDITION_FAILED: fact registry count mismatch'; end if;

  if has_function_privilege('authenticated',
       'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
     or has_function_privilege('anon',
       'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)','EXECUTE') then
    raise exception 'RU2_POSTCONDITION_FAILED: V2 service writer grants mismatch';
  end if;

  if not has_function_privilege('authenticated','public.rpc_ai_correct_fact_v2(uuid,jsonb,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_ai_need_review_v2(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE') then
    raise exception 'RU2_POSTCONDITION_FAILED: user V2 command grants missing';
  end if;

  if has_table_privilege('authenticated','public.need_sensitive','INSERT')
     or has_table_privilege('authenticated','public.need_sensitive','UPDATE')
     or has_table_privilege('authenticated','public.need_sensitive','DELETE') then
    raise exception 'RU2_POSTCONDITION_FAILED: direct private Need mutation still exposed';
  end if;

  if (select count(*) from public.needs where status='DRAFT')<>0 then
    raise exception 'RU2_POSTCONDITION_FAILED: migration created a business DRAFT';
  end if;

  if position('PACKAGE_4_NOT_READY' in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure))=0 then
    raise exception 'RU2_POSTCONDITION_FAILED: legacy AI publish no longer fail-closed';
  end if;
end
$ru2_postconditions$;

commit;
