-- USKOČI RU-2 — rollback-only service-role repeated V2 proposal proof.
\set ON_ERROR_STOP on

begin;

do $seed$
declare
  v_owner uuid:=extensions.gen_random_uuid();
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    v_owner,'authenticated','authenticated',
    'ru2-service-proof-'||v_owner::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU2 Service Proof','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  );
  perform set_config('uskoci.ru2_service_owner',v_owner::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru2_service_owner'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('uskoci.ru2_service_owner'),'role','authenticated')::text,true);

do $open$
declare v_conv uuid;
begin
  v_conv:=public.rpc_ai_open_need_conversation_v2();
  perform set_config('uskoci.ru2_service_conv',v_conv::text,true);
end
$open$;

reset role;
set local role service_role;
-- Simulate the Edge service-role JWT: service authority, no user UUID identity.
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);

do $repeated_service_turn$
declare
  v_owner uuid:=current_setting('uskoci.ru2_service_owner')::uuid;
  v_conv uuid:=current_setting('uskoci.ru2_service_conv')::uuid;
  v_first uuid;
  v_second uuid;
  v_result jsonb;
  v_denied boolean:=false;
begin
  v_result:=public.rpc_ai_apply_interview_turn_v2_service(
    v_owner,v_conv,'RU2_SERVICE_USER_1','RU2_SERVICE_ASSISTANT_1','ALLOW',
    jsonb_build_array(
      jsonb_build_object(
        'key','need.title','value',to_jsonb('Prvi AI naslov'::text),
        'displayValue','Prvi AI naslov','evidence','prvi naslov','confidence',0.8
      )
    )
  );
  if (v_result->>'proposedCount')::integer<>1 then
    raise exception 'RU2_SERVICE_FIRST_TURN_FAILED';
  end if;

  select id into v_first
    from public.ai_structured_facts
   where conversation_id=v_conv and fact_key='need.title' and superseded_at is null;
  if v_first is null then raise exception 'RU2_SERVICE_FIRST_FACT_MISSING'; end if;

  v_result:=public.rpc_ai_apply_interview_turn_v2_service(
    v_owner,v_conv,'RU2_SERVICE_USER_2','RU2_SERVICE_ASSISTANT_2','ALLOW',
    jsonb_build_array(
      jsonb_build_object(
        'key','need.title','value',to_jsonb('Bolji AI naslov'::text),
        'displayValue','Bolji AI naslov','evidence','bolji naslov','confidence',0.95
      )
    )
  );
  if (v_result->>'proposedCount')::integer<>1 then
    raise exception 'RU2_SERVICE_SECOND_TURN_FAILED';
  end if;

  select id into v_second
    from public.ai_structured_facts
   where conversation_id=v_conv and fact_key='need.title' and superseded_at is null;
  if v_second is null or v_second=v_first then
    raise exception 'RU2_SERVICE_REPLACEMENT_FACT_MISSING';
  end if;

  if not exists (
    select 1 from public.ai_structured_facts
     where id=v_first and superseded_at is not null and superseded_by=v_second
  ) then
    raise exception 'RU2_SERVICE_OLD_FACT_NOT_SUPERSEDED';
  end if;
  if not exists (
    select 1 from public.ai_structured_facts
     where id=v_second and fact_value=to_jsonb('Bolji AI naslov'::text)
       and fact_schema_version='NEED_FACT_V2' and value_type='TEXT'
       and status='NEEDS_CONFIRMATION' and source='AI_INFERENCE'
  ) then
    raise exception 'RU2_SERVICE_NEW_FACT_INVALID';
  end if;
  if (select count(*) from public.ai_structured_facts
       where conversation_id=v_conv and fact_key='need.title' and superseded_at is null)<>1 then
    raise exception 'RU2_SERVICE_ONE_LIVE_FACT_INVARIANT_FAILED';
  end if;

  -- Even trusted service transport cannot invent the canonical Need binding.
  begin
    update public.ai_structured_facts
       set subject_need_id=extensions.gen_random_uuid()
     where id=v_second;
  exception when insufficient_privilege then
    if sqlerrm='FACT_SUBJECT_BIND_REQUIRES_OWNER_COMMAND' then
      v_denied:=true;
    else
      raise;
    end if;
  end;
  if not v_denied then
    raise exception 'RU2_SERVICE_DIRECT_SUBJECT_BIND_ALLOWED';
  end if;
end
$repeated_service_turn$;

reset role;
rollback;

do $zero$
begin
  if exists(select 1 from auth.users where email like 'ru2-service-proof-%@proof.invalid') then
    raise exception 'RU2_SERVICE_AUTH_USER_RESIDUE';
  end if;
  if exists(select 1 from public.ai_messages where body like 'RU2_SERVICE_%') then
    raise exception 'RU2_SERVICE_MESSAGE_RESIDUE';
  end if;
end
$zero$;

select 'PASS RU2_V2_SERVICE_SUPERSESSION repeated_key one_live_fact service_cannot_bind_need zero_residue' as proof_result;
