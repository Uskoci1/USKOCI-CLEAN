-- USKOČI RU-4 — AI-assisted edit of an existing Zadatak before first Dogovor.
-- PROOF CANDIDATE ONLY. Opening/chatting never mutates the public Zadatak.
-- Only rpc_confirm_need_edit_from_review creates the next DRAFT revision.

create or replace function private.need_full_edit_snapshot(p_need_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select private.need_material_snapshot(n.id)
    || jsonb_build_object(
      'publicTopology', g.public_topology,
      'criticalConditions', to_jsonb(coalesce(d.critical_conditions,'{}'::text[]))
    )
  from public.needs n
  left join public.need_geography g on g.need_id=n.id
  left join public.need_requirement_details d on d.need_id=n.id
  where n.id=p_need_id
$$;
revoke all on function private.need_full_edit_snapshot(uuid) from public, anon, authenticated, service_role;

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

revoke all on function public.rpc_ai_open_need_edit_conversation_v2(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_open_need_edit_conversation_v2(uuid)
  to authenticated;

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
     and v_geo is not distinct from v_old_geo then
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

  perform set_config('uskoci.need_lifecycle','CONFIRM_EDIT',true);
  update public.needs n
     set title=btrim(v_title),description=btrim(v_description),category=btrim(v_category),
         required_slots=v_slots,mode=v_mode,requester_price_rsd=v_price,
         required_skills=v_skills,required_tools=v_tools,required_vehicles=v_vehicles,required_licenses=v_licenses,
         minimum_experience_years=v_min_exp,verified_identity_required=v_verified,
         schedule_kind=v_schedule_kind,starts_at=v_starts_at,ends_at=v_ends_at,
         execution_location_mode=v_exec_mode,
         approximate_lat=case when v_geo is not distinct from v_old_geo then v_need.approximate_lat else null end,
         approximate_lng=case when v_geo is not distinct from v_old_geo then v_need.approximate_lng else null end,
         approximate_city=coalesce(v_city,''),approximate_area=coalesce(v_area,''),
         public_photo_paths=v_photos,status='DRAFT',revision=v_need.revision+1,
         published_at=null,response_deadline=null,urgent=false,urgent_activated_at=null,urgent_expires_at=null,urgent_policy_version=null,
         updated_at=statement_timestamp()
   where n.id=v_need.id and n.revision=v_need.revision and n.status in ('PUBLISHED','SELECTION')
   returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle','',true);
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

revoke all on function public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)
  to authenticated;

comment on function public.rpc_ai_open_need_edit_conversation_v2(uuid) is
  'RU-4 owner-only edit-session opener. Seeds current canonical Zadatak facts as confirmed SYSTEM_DERIVED context. Does not mutate/unpublish Zadatak.';
comment on function public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text) is
  'RU-4 final human-confirmed AI edit command. Requires every live proposed fact confirmed, then atomically creates next DRAFT revision; permanently blocked after first Dogovor.';

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.rpc_ai_open_need_edit_conversation_v2(uuid)','EXECUTE')
     or has_function_privilege('anon','public.rpc_ai_open_need_edit_conversation_v2(uuid)','EXECUTE') then
    raise exception 'RU4_AI_EDIT_POSTCONDITION: opener grants wrong';
  end if;
  if not has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE') then
    raise exception 'RU4_AI_EDIT_POSTCONDITION: confirmer grants wrong';
  end if;
end
$postconditions$;
