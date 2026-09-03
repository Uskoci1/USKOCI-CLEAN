-- USKOČI RU-2 — rollback-only owner / attacker / service runtime proof.
-- Proves NEED_FACT_V2 coexistence, typed correction, R07 review, canonical DRAFT,
-- idempotency, public/private geography split, and negative authority paths.
\set ON_ERROR_STOP on

begin;

do $seed$
declare
  v_owner uuid:=extensions.gen_random_uuid();
  v_attacker uuid:=extensions.gen_random_uuid();
  v_owner_profile uuid;
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
  (
    v_owner,'authenticated','authenticated',
    'ru2-proof-owner-'||v_owner::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU2 Proof Owner','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  ),
  (
    v_attacker,'authenticated','authenticated',
    'ru2-proof-attacker-'||v_attacker::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU2 Proof Attacker','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  );

  select id into v_owner_profile
    from public.app_profiles
   where account_id=v_owner and kind='REQUESTER' and profile_status='ACTIVE';
  if v_owner_profile is null then raise exception 'RU2_PROOF_REQUESTER_PROFILE_NOT_READY'; end if;

  perform set_config('uskoci.ru2_owner',v_owner::text,true);
  perform set_config('uskoci.ru2_attacker',v_attacker::text,true);
  perform set_config('uskoci.ru2_owner_profile',v_owner_profile::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru2_owner'),true);
select set_config('request.jwt.claims','',true);

do $open_conversations$
declare
  v_v2 uuid;
  v_legacy uuid;
  v_schema text;
begin
  if auth.uid() is distinct from current_setting('uskoci.ru2_owner')::uuid then
    raise exception 'RU2_PROOF_OWNER_AUTH_CONTEXT_MISMATCH';
  end if;

  v_v2:=public.rpc_ai_open_need_conversation_v2();
  v_legacy:=public.rpc_ai_open_conversation('NEED_INTAKE');

  select fact_schema_version into v_schema from public.ai_conversations where id=v_v2;
  if v_schema<>'NEED_FACT_V2' then raise exception 'RU2_PROOF_V2_OPENER_SCHEMA_WRONG'; end if;
  select fact_schema_version into v_schema from public.ai_conversations where id=v_legacy;
  if v_schema<>'LEGACY_TEXT_V1' then raise exception 'RU2_PROOF_LEGACY_OPENER_CHANGED'; end if;

  perform set_config('uskoci.ru2_conv1',v_v2::text,true);
  perform set_config('uskoci.ru2_legacy_conv',v_legacy::text,true);
end
$open_conversations$;

reset role;
set local role service_role;

do $service_turn$
declare
  v_owner uuid:=current_setting('uskoci.ru2_owner')::uuid;
  v_attacker uuid:=current_setting('uskoci.ru2_attacker')::uuid;
  v_conv uuid:=current_setting('uskoci.ru2_conv1')::uuid;
  v_legacy uuid:=current_setting('uskoci.ru2_legacy_conv')::uuid;
  v_result jsonb;
  v_denied boolean:=false;
begin
  v_result:=public.rpc_ai_apply_interview_turn_v2_service(
    v_owner,v_conv,
    'RU2_PROOF_USER Treba mi prenos frižidera u Novom Sadu.',
    'RU2_PROOF_ASSISTANT Razumeo sam. Proverićemo još važne detalje.',
    'ALLOW',
    jsonb_build_array(
      jsonb_build_object('key','need.title','value',to_jsonb('Prenos frižidera u Novom Sadu'::text),'displayValue','Prenos frižidera u Novom Sadu','evidence','Treba mi prenos frižidera','confidence',0.98),
      jsonb_build_object('key','need.description','value',to_jsonb('Potrebno je preuzeti i preneti frižider. Treći sprat je bez lifta.'::text),'displayValue','Preuzimanje i prenos frižidera; treći sprat bez lifta.','evidence','prenos frižidera, treći sprat bez lifta','confidence',0.96),
      jsonb_build_object('key','need.category','value',to_jsonb('Prevoz i selidbe'::text),'displayValue','Prevoz i selidbe','evidence','prenos frižidera','confidence',0.94),
      jsonb_build_object('key','need.price_mode','value',to_jsonb('OFFERS'::text),'displayValue','Tražim ponude','evidence','želim ponude','confidence',0.99),
      jsonb_build_object('key','need.schedule_kind','value',to_jsonb('FLEXIBLE'::text),'displayValue','Fleksibilan termin','evidence','termin je fleksibilan','confidence',0.98),
      jsonb_build_object('key','need.people_needed','value','2'::jsonb,'displayValue','2 osobe','evidence','verovatno trebaju dvojica','confidence',0.91),
      jsonb_build_object('key','need.task_geography','value',jsonb_build_object('mode','STATIONARY','start',jsonb_build_object('label','Centar, Novi Sad','city','Novi Sad','area','Centar')),'displayValue','Centar, Novi Sad','evidence','u Novom Sadu, Centar','confidence',0.97),
      jsonb_build_object('key','need.exact_address','value',to_jsonb('Bulevar oslobođenja 1, stan 2'::text),'displayValue','Bulevar oslobođenja 1, stan 2','evidence','tačna adresa je Bulevar oslobođenja 1, stan 2','confidence',1),
      jsonb_build_object('key','need.required_skills','value','["prenošenje nameštaja"]'::jsonb,'displayValue','Prenošenje nameštaja','evidence','frižider treba preneti','confidence',0.9),
      jsonb_build_object('key','need.critical_conditions','value','["treći sprat bez lifta"]'::jsonb,'displayValue','Treći sprat bez lifta','evidence','treći sprat bez lifta','confidence',1)
    )
  );

  if (v_result->>'schemaVersion')<>'NEED_FACT_V2' or (v_result->>'proposedCount')::integer<>10 then
    raise exception 'RU2_PROOF_SERVICE_V2_TURN_RESULT_INVALID';
  end if;

  begin
    perform public.rpc_ai_apply_interview_turn_v2_service(
      v_attacker,v_conv,'wrong owner','must reject','ALLOW','[]'::jsonb
    );
  exception when insufficient_privilege then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'RU2_PROOF_SERVICE_WRONG_ACCOUNT_ALLOWED'; end if;

  v_denied:=false;
  begin
    perform public.rpc_ai_apply_interview_turn_v2_service(
      v_owner,v_conv,'blocked request','must reject proposals','BLOCK',
      jsonb_build_array(jsonb_build_object('key','need.title','value',to_jsonb('Ne sme'::text),'displayValue','Ne sme','evidence','blocked','confidence',1))
    );
  exception when sqlstate '22023' then
    if sqlerrm='BLOCK_CANNOT_PERSIST_PROPOSALS' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU2_PROOF_BLOCK_PERSISTED_PROPOSALS'; end if;

  -- Legacy path must still work during cutover.
  v_result:=public.rpc_ai_apply_interview_turn_service(
    v_owner,v_legacy,
    'RU2_PROOF_LEGACY_USER',
    'RU2_PROOF_LEGACY_ASSISTANT',
    'ALLOW',
    jsonb_build_array(jsonb_build_object('key','naslov','value','Legacy proof naslov','confidence',0.9,'evidence','legacy proof'))
  );
  if (v_result->>'proposedCount')::integer<>1 then raise exception 'RU2_PROOF_LEGACY_WRITER_BROKEN'; end if;

  v_denied:=false;
  begin
    perform public.rpc_ai_apply_interview_turn_v2_service(
      v_owner,v_legacy,'v2 on legacy','must reject','ALLOW','[]'::jsonb
    );
  exception when sqlstate 'P0001' then
    if sqlerrm='V2_CONVERSATION_REQUIRED' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU2_PROOF_V2_WRITER_ACCEPTED_LEGACY_CONVERSATION'; end if;
end
$service_turn$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru2_owner'),true);
select set_config('request.jwt.claims','',true);

do $owner_review_and_save$
declare
  v_conv uuid:=current_setting('uskoci.ru2_conv1')::uuid;
  v_legacy uuid:=current_setting('uskoci.ru2_legacy_conv')::uuid;
  v_profile uuid:=current_setting('uskoci.ru2_owner_profile')::uuid;
  v_people_old uuid;
  v_people_new uuid;
  v_fact uuid;
  v_review jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_need uuid;
  v_denied boolean:=false;
  v_count integer;
  v_old public.ai_structured_facts%rowtype;
  v_new public.ai_structured_facts%rowtype;
begin
  v_review:=public.rpc_ai_need_review_v2(v_conv);
  if coalesce((v_review->>'canSaveDraft')::boolean,false) then
    raise exception 'RU2_PROOF_REVIEW_READY_BEFORE_CONFIRMATION';
  end if;
  if jsonb_array_length(v_review->'missingRequired')<>7 then
    raise exception 'RU2_PROOF_REQUIRED_FACT_COUNT_WRONG' using detail=(v_review->'missingRequired')::text;
  end if;

  begin
    perform public.rpc_save_need_draft_from_review(v_conv,v_profile,'ru2-proof-command-0001');
  exception when sqlstate 'P0001' then
    if sqlerrm='REQUIRED_CONFIRMED_FACTS_MISSING' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU2_PROOF_MISSING_REQUIRED_DRAFT_ALLOWED'; end if;

  v_review:=public.rpc_ai_need_review_v2(v_legacy);
  if (v_review->>'schemaVersion')<>'LEGACY_TEXT_V1' or coalesce((v_review->>'canSaveDraft')::boolean,false) then
    raise exception 'RU2_PROOF_LEGACY_REVIEW_SEMANTICS_WRONG';
  end if;
  v_denied:=false;
  begin
    perform public.rpc_save_need_draft_from_review(v_legacy,v_profile,'ru2-proof-legacy-0001');
  exception when sqlstate 'P0001' then
    if sqlerrm='LEGACY_CONVERSATION_NOT_CANONICAL_SAVE_ELIGIBLE' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU2_PROOF_LEGACY_CANONICAL_SAVE_ALLOWED'; end if;

  select id into v_people_old
    from public.ai_structured_facts
   where conversation_id=v_conv and fact_key='need.people_needed' and superseded_at is null;
  if v_people_old is null then raise exception 'RU2_PROOF_PEOPLE_PROPOSAL_MISSING'; end if;

  v_people_new:=public.rpc_ai_correct_fact_v2(v_people_old,'3'::jsonb,'3 osobe');
  select * into v_old from public.ai_structured_facts where id=v_people_old;
  select * into v_new from public.ai_structured_facts where id=v_people_new;
  if v_old.superseded_at is null or v_old.superseded_by is distinct from v_people_new then
    raise exception 'RU2_PROOF_TYPED_CORRECTION_DID_NOT_SUPERSEDE';
  end if;
  if v_new.status<>'CONFIRMED' or v_new.source<>'EXPLICIT_USER_ANSWER'
     or v_new.value_type<>'INTEGER' or v_new.fact_value<>'3'::jsonb
     or v_new.confirmed_by_user_id is distinct from auth.uid() then
    raise exception 'RU2_PROOF_TYPED_CORRECTION_PROVENANCE_INVALID';
  end if;

  for v_fact in
    select id from public.ai_structured_facts
     where conversation_id=v_conv and superseded_at is null and status<>'CONFIRMED'
  loop
    perform public.rpc_ai_confirm_fact(v_fact);
  end loop;

  v_review:=public.rpc_ai_need_review_v2(v_conv);
  if not coalesce((v_review->>'canSaveDraft')::boolean,false)
     or jsonb_array_length(v_review->'missingRequired')<>0 then
    raise exception 'RU2_PROOF_REVIEW_NOT_READY_AFTER_CONFIRMATION' using detail=v_review::text;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_review->'facts') x
     where x->>'key'='need.exact_address' and x->>'privacyClass'='PRIVATE'
  ) then
    raise exception 'RU2_PROOF_PRIVATE_FACT_NOT_CLASSIFIED_PRIVATE';
  end if;

  v_result:=public.rpc_save_need_draft_from_review(v_conv,v_profile,'ru2-proof-command-0001');
  v_need:=(v_result->>'needId')::uuid;
  if v_need is null or v_result->>'status'<>'DRAFT' then raise exception 'RU2_PROOF_DRAFT_RESULT_INVALID'; end if;

  if not exists (
    select 1 from public.needs n
     where n.id=v_need and n.requester_account_id=auth.uid()
       and n.requester_profile_id=v_profile and n.status='DRAFT'
       and n.title='Prenos frižidera u Novom Sadu'
       and n.required_slots=3 and n.mode='OFFERS' and n.requester_price_rsd is null
       and n.execution_location_mode='STATIONARY'
       and n.approximate_city='Novi Sad' and n.approximate_area='Centar'
  ) then
    raise exception 'RU2_PROOF_CANONICAL_DRAFT_FIELDS_WRONG';
  end if;

  if not exists (
    select 1 from public.need_geography g
     where g.need_id=v_need
       and g.public_topology#>>'{start,city}'='Novi Sad'
       and g.public_topology#>>'{start,area}'='Centar'
       and g.public_topology::text not ilike '%address%'
       and g.public_topology::text not ilike '%latitude%'
       and g.public_topology::text not ilike '%longitude%'
  ) then
    raise exception 'RU2_PROOF_PUBLIC_GEOGRAPHY_INVALID';
  end if;

  if not exists (
    select 1 from public.need_sensitive s
     where s.need_id=v_need and s.exact_address='Bulevar oslobođenja 1, stan 2'
  ) then
    raise exception 'RU2_PROOF_PRIVATE_EXACT_ADDRESS_NOT_MATERIALIZED';
  end if;

  if not exists (
    select 1 from public.need_requirement_details d
     where d.need_id=v_need and d.critical_conditions=array['treći sprat bez lifta']::text[]
  ) then
    raise exception 'RU2_PROOF_CRITICAL_CONDITIONS_NOT_MATERIALIZED';
  end if;

  if not exists (
    select 1 from public.ai_conversations c
     where c.id=v_conv and c.status='COMPLETED' and c.bound_need_id=v_need and c.fact_schema_version='NEED_FACT_V2'
  ) then
    raise exception 'RU2_PROOF_CONVERSATION_NOT_BOUND_COMPLETED';
  end if;

  if exists (
    select 1 from public.ai_structured_facts f
     where f.conversation_id=v_conv and f.fact_schema_version='NEED_FACT_V2' and f.subject_need_id is distinct from v_need
  ) then
    raise exception 'RU2_PROOF_FACTS_NOT_BOUND_TO_NEED';
  end if;

  v_replay:=public.rpc_save_need_draft_from_review(v_conv,v_profile,'ru2-proof-command-0001');
  if (v_replay->>'needId')::uuid is distinct from v_need then raise exception 'RU2_PROOF_IDEMPOTENT_REPLAY_CHANGED_RESULT'; end if;
  select count(*) into v_count from public.needs where requester_account_id=auth.uid() and title='Prenos frižidera u Novom Sadu';
  if v_count<>1 then raise exception 'RU2_PROOF_IDEMPOTENT_REPLAY_DUPLICATED_NEED'; end if;

  perform set_config('uskoci.ru2_need',v_need::text,true);
  perform set_config('uskoci.ru2_people_fact',v_people_new::text,true);
end
$owner_review_and_save$;

-- Open a second valid V2 conversation to prove semantic request-key collision rejection.
do $open_second$
declare v_conv uuid;
begin
  v_conv:=public.rpc_ai_open_need_conversation_v2();
  perform set_config('uskoci.ru2_conv2',v_conv::text,true);
end
$open_second$;

reset role;
set local role service_role;

do $second_service_turn$
declare
  v_owner uuid:=current_setting('uskoci.ru2_owner')::uuid;
  v_conv uuid:=current_setting('uskoci.ru2_conv2')::uuid;
  v_result jsonb;
  v_denied boolean:=false;
begin
  v_result:=public.rpc_ai_apply_interview_turn_v2_service(
    v_owner,v_conv,'RU2_PROOF_SECOND_USER','RU2_PROOF_SECOND_ASSISTANT','ALLOW',
    jsonb_build_array(
      jsonb_build_object('key','need.title','value',to_jsonb('Drugi proof zadatak'::text),'displayValue','Drugi proof zadatak','evidence','drugi zadatak','confidence',1),
      jsonb_build_object('key','need.description','value',to_jsonb('Drugi validan proof zadatak.'::text),'displayValue','Drugi validan proof zadatak.','evidence','drugi zadatak','confidence',1),
      jsonb_build_object('key','need.category','value',to_jsonb('Ostala pomoć'::text),'displayValue','Ostala pomoć','evidence','drugi zadatak','confidence',1),
      jsonb_build_object('key','need.price_mode','value',to_jsonb('OFFERS'::text),'displayValue','Tražim ponude','evidence','ponude','confidence',1),
      jsonb_build_object('key','need.schedule_kind','value',to_jsonb('FLEXIBLE'::text),'displayValue','Fleksibilan termin','evidence','fleksibilno','confidence',1),
      jsonb_build_object('key','need.people_needed','value','1'::jsonb,'displayValue','1 osoba','evidence','jedna osoba','confidence',1),
      jsonb_build_object('key','need.task_geography','value',jsonb_build_object('mode','REMOTE'),'displayValue','Na daljinu','evidence','može na daljinu','confidence',1)
    )
  );
  if (v_result->>'proposedCount')::integer<>7 then raise exception 'RU2_PROOF_SECOND_SERVICE_TURN_FAILED'; end if;

  begin
    perform public.rpc_ai_apply_interview_turn_v2_service(
      current_setting('uskoci.ru2_attacker')::uuid,v_conv,'wrong account','reject','ALLOW','[]'::jsonb
    );
  exception when insufficient_privilege then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'RU2_PROOF_SECOND_WRONG_SERVICE_ACCOUNT_ALLOWED'; end if;
end
$second_service_turn$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru2_owner'),true);
select set_config('request.jwt.claims','',true);

do $collision$
declare
  v_conv uuid:=current_setting('uskoci.ru2_conv2')::uuid;
  v_profile uuid:=current_setting('uskoci.ru2_owner_profile')::uuid;
  v_fact uuid;
  v_denied boolean:=false;
begin
  for v_fact in
    select id from public.ai_structured_facts
     where conversation_id=v_conv and superseded_at is null and status<>'CONFIRMED'
  loop
    perform public.rpc_ai_confirm_fact(v_fact);
  end loop;

  if not coalesce((public.rpc_ai_need_review_v2(v_conv)->>'canSaveDraft')::boolean,false) then
    raise exception 'RU2_PROOF_SECOND_CONVERSATION_NOT_READY';
  end if;

  begin
    perform public.rpc_save_need_draft_from_review(v_conv,v_profile,'ru2-proof-command-0001');
  exception when sqlstate '22023' then
    if sqlerrm='CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU2_PROOF_IDEMPOTENCY_KEY_COLLISION_ALLOWED'; end if;
end
$collision$;

-- Attacker and client-authority negatives.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru2_attacker'),true);
select set_config('request.jwt.claims','',true);

do $attacker$
declare
  v_conv uuid:=current_setting('uskoci.ru2_conv1')::uuid;
  v_need uuid:=current_setting('uskoci.ru2_need')::uuid;
  v_fact uuid:=current_setting('uskoci.ru2_people_fact')::uuid;
  v_profile uuid:=current_setting('uskoci.ru2_owner_profile')::uuid;
  v_denied boolean;
  v_count integer;
begin
  if auth.uid() is distinct from current_setting('uskoci.ru2_attacker')::uuid then
    raise exception 'RU2_PROOF_ATTACKER_AUTH_CONTEXT_MISMATCH';
  end if;

  select count(*) into v_count from public.ai_conversations where id=v_conv;
  if v_count<>0 then raise exception 'RU2_PROOF_ATTACKER_RLS_READ_CONVERSATION'; end if;
  select count(*) into v_count from public.ai_structured_facts where conversation_id=v_conv;
  if v_count<>0 then raise exception 'RU2_PROOF_ATTACKER_RLS_READ_FACTS'; end if;

  v_denied:=false;
  begin perform public.rpc_ai_need_review_v2(v_conv);
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU2_PROOF_ATTACKER_REVIEW_ALLOWED'; end if;

  v_denied:=false;
  begin perform public.rpc_ai_correct_fact_v2(v_fact,'4'::jsonb,'4 osobe');
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU2_PROOF_ATTACKER_CORRECTION_ALLOWED'; end if;

  v_denied:=false;
  begin perform public.rpc_save_need_draft_from_review(v_conv,v_profile,'ru2-proof-attacker-0001');
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU2_PROOF_ATTACKER_SAVE_ALLOWED'; end if;

  v_denied:=false;
  begin
    perform public.rpc_ai_apply_interview_turn_v2_service(
      auth.uid(),current_setting('uskoci.ru2_conv2')::uuid,'client writer','must not execute','ALLOW','[]'::jsonb
    );
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU2_PROOF_AUTHENTICATED_EXECUTED_SERVICE_WRITER'; end if;

  v_denied:=false;
  begin update public.need_sensitive set exact_address='ATTACKED' where need_id=v_need;
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU2_PROOF_AUTHENTICATED_DIRECT_PRIVATE_UPDATE_ALLOWED'; end if;
end
$attacker$;

reset role;

-- Ensure all proof rows are inside this transaction, then remove them atomically.
rollback;

-- Zero-residue verification runs after rollback as postgres.
do $zero_residue$
begin
  if exists(select 1 from auth.users where email like 'ru2-proof-%@proof.invalid') then
    raise exception 'RU2_PROOF_AUTH_USER_RESIDUE';
  end if;
  if exists(select 1 from public.ai_messages where body like 'RU2_PROOF_%') then
    raise exception 'RU2_PROOF_MESSAGE_RESIDUE';
  end if;
  if exists(select 1 from public.needs where title in ('Prenos frižidera u Novom Sadu','Drugi proof zadatak')) then
    raise exception 'RU2_PROOF_NEED_RESIDUE';
  end if;
  if exists(select 1 from private.need_draft_save_commands where client_request_id like 'ru2-proof-%') then
    raise exception 'RU2_PROOF_COMMAND_RESIDUE';
  end if;
end
$zero_residue$;

select 'PASS RU2_RUNTIME owner_attacker_service typed_correction review draft idempotency legacy_coexistence privacy zero_residue' as proof_result;
