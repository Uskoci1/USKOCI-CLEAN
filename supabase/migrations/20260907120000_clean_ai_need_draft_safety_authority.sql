-- AI DRAFT authority repair: persistently blocked intake cannot materialize a new DRAFT.
-- Forward-only, two existing owner RPCs. No provider, schema, writer or publish activation.
-- Historical successful command acknowledgments retain their original result.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
begin
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_need_review_v2(uuid)'::regprocedure) is distinct from 'dd536d23cbe5685888376f6879745b8c' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_ai_need_review_v2(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure) is distinct from '982f807ea395610cbce0f95748f36598' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_save_need_draft_from_review(uuid,uuid,text)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure) is distinct from '9b87763c59ec6fb515c4128cc6864ad8' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_confirm_fact(uuid)'::regprocedure) is distinct from '4c982c3a2396cb4bf82543f8921fda42' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_ai_confirm_fact(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_correct_fact_v2(uuid,jsonb,text)'::regprocedure) is distinct from '7342a40473c094f77adffee74fbb777b' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_ai_correct_fact_v2(uuid,jsonb,text)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_publish_need(uuid,timestamptz)'::regprocedure) is distinct from '91ab1fadc4f681ed3c15aec53df41d33' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_publish_need(uuid,timestamptz)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_publish_need(uuid,uuid)'::regprocedure) is distinct from '1fca28c3d65f583c5ffc9258ce713f8e' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_ai_publish_need(uuid,uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)'::regprocedure) is distinct from 'bf84266913d3c1f4e06257c7a037abfc' then
    raise exception 'AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)';
  end if;
  if not exists(select 1 from pg_proc where oid='public.rpc_ai_need_review_v2(uuid)'::regprocedure and prosecdef and proconfig=array['search_path=pg_catalog']::text[])
     or has_function_privilege('anon','public.rpc_ai_need_review_v2(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_ai_need_review_v2(uuid)','EXECUTE') then
    raise exception 'AI_DRAFT_PREDECESSOR_AUTHORITY_MISMATCH';
  end if;
  if not exists(select 1 from pg_proc where oid='public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure and prosecdef and proconfig=array['search_path=pg_catalog']::text[])
     or has_function_privilege('anon','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE') then
    raise exception 'AI_DRAFT_PREDECESSOR_AUTHORITY_MISMATCH';
  end if;
  if has_table_privilege('authenticated','public.ai_messages','INSERT')
     or has_table_privilege('authenticated','public.ai_messages','UPDATE')
     or has_table_privilege('authenticated','public.ai_structured_facts','INSERT')
     or has_table_privilege('authenticated','public.ai_structured_facts','UPDATE') then
    raise exception 'AI_DRAFT_DIRECT_AI_WRITE_EXPOSED';
  end if;
end
$precondition$;

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
  v_safety text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for share;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;

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
    'safety',v_safety,
    'canSaveDraft',
      v_conv.fact_schema_version='NEED_FACT_V2'
      and v_conv.status='OPEN'
      and jsonb_array_length(v_missing)=0
      and v_safety<>'BLOCK'
  );
end
$function$;

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

do $postcondition$
begin
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_need_review_v2(uuid)'::regprocedure) is distinct from '1e6b3f195bb47e09a7bb7887f087b9cd' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_ai_need_review_v2(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure) is distinct from 'ea7ed77204774f618c1748831a1032d1' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_save_need_draft_from_review(uuid,uuid,text)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure) is distinct from '9b87763c59ec6fb515c4128cc6864ad8' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_confirm_fact(uuid)'::regprocedure) is distinct from '4c982c3a2396cb4bf82543f8921fda42' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_ai_confirm_fact(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_correct_fact_v2(uuid,jsonb,text)'::regprocedure) is distinct from '7342a40473c094f77adffee74fbb777b' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_ai_correct_fact_v2(uuid,jsonb,text)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_publish_need(uuid,timestamptz)'::regprocedure) is distinct from '91ab1fadc4f681ed3c15aec53df41d33' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_publish_need(uuid,timestamptz)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_ai_publish_need(uuid,uuid)'::regprocedure) is distinct from '1fca28c3d65f583c5ffc9258ce713f8e' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_ai_publish_need(uuid,uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)'::regprocedure) is distinct from 'bf84266913d3c1f4e06257c7a037abfc' then
    raise exception 'AI_DRAFT_POSTCONDITION_FUNCTION_MISMATCH' using detail='public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)';
  end if;
  if not exists(select 1 from pg_proc where oid='public.rpc_ai_need_review_v2(uuid)'::regprocedure and prosecdef and proconfig=array['search_path=pg_catalog']::text[])
     or has_function_privilege('anon','public.rpc_ai_need_review_v2(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_ai_need_review_v2(uuid)','EXECUTE') then
    raise exception 'AI_DRAFT_POSTCONDITION_AUTHORITY_MISMATCH';
  end if;
  if not exists(select 1 from pg_proc where oid='public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure and prosecdef and proconfig=array['search_path=pg_catalog']::text[])
     or has_function_privilege('anon','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE') then
    raise exception 'AI_DRAFT_POSTCONDITION_AUTHORITY_MISMATCH';
  end if;
  if has_table_privilege('authenticated','public.ai_messages','INSERT')
     or has_table_privilege('authenticated','public.ai_messages','UPDATE')
     or has_table_privilege('authenticated','public.ai_structured_facts','INSERT')
     or has_table_privilege('authenticated','public.ai_structured_facts','UPDATE') then
    raise exception 'AI_DRAFT_DIRECT_AI_WRITE_EXPOSED';
  end if;
end
$postcondition$;

commit;
