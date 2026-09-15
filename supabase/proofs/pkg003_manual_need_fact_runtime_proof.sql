-- USKOČI PKG-003 / GAP-0015 — rollback-only disposable runtime proof.
-- Requires the current canonical NEED_FACT_V2/location/review authority plus the
-- source candidate supabase/candidates/pkg003_manual_need_fact_v2.sql.
-- No provider, Edge deploy, production data or canonical DEV mutation is used.
\set ON_ERROR_STOP on

begin;

do $seed$
declare
  v_owner uuid := extensions.gen_random_uuid();
  v_attacker uuid := extensions.gen_random_uuid();
  v_profile uuid;
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
  (
    v_owner,'authenticated','authenticated',
    'pkg003-proof-owner-'||v_owner::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','PKG003 Proof Owner','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  ),
  (
    v_attacker,'authenticated','authenticated',
    'pkg003-proof-attacker-'||v_attacker::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','PKG003 Proof Attacker','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  );

  select id into v_profile
    from public.app_profiles
   where account_id=v_owner and kind='REQUESTER' and profile_status='ACTIVE';
  if v_profile is null then raise exception 'PKG003_REQUESTER_PROFILE_NOT_READY'; end if;

  perform set_config('uskoci.pkg003_owner',v_owner::text,true);
  perform set_config('uskoci.pkg003_attacker',v_attacker::text,true);
  perform set_config('uskoci.pkg003_profile',v_profile::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg003_owner'),true);
select set_config('request.jwt.claims','',true);

do $manual_bootstrap$
declare
  v_owner uuid := current_setting('uskoci.pkg003_owner')::uuid;
  v_open jsonb;
  v_conv uuid;
  v_review jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_title_req uuid := extensions.gen_random_uuid();
  v_title_old uuid;
  v_title_new uuid;
  v_denied boolean := false;
  v_active integer;
  v_messages_before integer;
begin
  v_open := public.rpc_ai_open_need_conversation_owned_v2(extensions.gen_random_uuid());
  v_conv := nullif(v_open->>'conversationId','')::uuid;
  if v_conv is null or (v_open->>'authoritative')::boolean is distinct from true then
    raise exception 'PKG003_OPEN_RECEIPT_INVALID';
  end if;
  perform set_config('uskoci.pkg003_conv',v_conv::text,true);

  select count(*) into v_messages_before from public.ai_messages where conversation_id=v_conv;
  if v_messages_before<>0 then raise exception 'PKG003_EMPTY_MANUAL_CONVERSATION_HAS_MESSAGES'; end if;

  v_review := public.rpc_ai_need_review_v2(v_conv);
  if coalesce((v_review->>'canSaveDraft')::boolean,false) then
    raise exception 'PKG003_EMPTY_REVIEW_ALREADY_SAVEABLE';
  end if;
  if not (v_review->'missingRequired' ? 'need.title')
     or not (v_review->'missingRequired' ? 'need.task_geography') then
    raise exception 'PKG003_EMPTY_REVIEW_MISSING_SET_INVALID' using detail=(v_review->'missingRequired')::text;
  end if;

  v_result := public.rpc_set_manual_need_fact_v2(v_conv,v_title_req,'need.title',to_jsonb('Prenos ormara'::text),'Prenos ormara');
  v_title_old := (v_result->>'factId')::uuid;
  if v_title_old is null or (v_result->>'authoritative')::boolean is distinct from true
     or (v_result->>'idempotentReplay')::boolean is distinct from false then
    raise exception 'PKG003_TITLE_RECEIPT_INVALID';
  end if;

  v_replay := public.rpc_set_manual_need_fact_v2(v_conv,v_title_req,'need.title',to_jsonb('Prenos ormara'::text),'Prenos ormara');
  if (v_replay->>'idempotentReplay')::boolean is distinct from true
     or (v_replay->>'factId')::uuid is distinct from v_title_old then
    raise exception 'PKG003_EXACT_REPLAY_INVALID';
  end if;

  begin
    perform public.rpc_set_manual_need_fact_v2(v_conv,v_title_req,'need.title',to_jsonb('Druga vrednost'::text),'Druga vrednost');
  exception when sqlstate '22023' then
    if sqlerrm='CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'PKG003_REQUEST_ID_REUSE_ALLOWED'; end if;

  v_result := public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.title',to_jsonb('Prenos ormara i stola'::text),'Prenos ormara i stola');
  v_title_new := (v_result->>'factId')::uuid;
  if v_title_new is null or v_title_new=v_title_old then raise exception 'PKG003_TITLE_REPLACEMENT_INVALID'; end if;
  if not exists(select 1 from public.ai_structured_facts where id=v_title_old and superseded_at is not null and superseded_by=v_title_new) then
    raise exception 'PKG003_OLD_TITLE_NOT_CANONICALLY_SUPERSEDED';
  end if;
  select count(*) into v_active from public.ai_structured_facts
   where conversation_id=v_conv and fact_key='need.title' and superseded_at is null;
  if v_active<>1 then raise exception 'PKG003_TITLE_ONE_LIVE_FACT_BROKEN'; end if;
  if not exists(select 1 from public.ai_structured_facts where id=v_title_new and account_id=v_owner
      and status='CONFIRMED' and source='EXPLICIT_USER_ANSWER' and scope='NEED_DRAFT'
      and confirmed_by_user_id=v_owner and confirmed_at is not null and fact_value=to_jsonb('Prenos ormara i stola'::text)) then
    raise exception 'PKG003_MANUAL_PROVENANCE_INVALID';
  end if;

  perform public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.description',
    to_jsonb('Potrebno je preneti ormar i sto.'::text),'Potrebno je preneti ormar i sto.');
  perform public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.category',
    to_jsonb('Prevoz i selidbe'::text),'Prevoz i selidbe');
  perform public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.price_mode',
    to_jsonb('OFFERS'::text),'Ponude');
  perform public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.schedule_kind',
    to_jsonb('REMOTE_ANYTIME'::text),'Daljinski bilo kada');
  perform public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.people_needed','1'::jsonb,'1');

  v_denied:=false;
  begin
    perform public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.task_geography',
      jsonb_build_object('mode','REMOTE'),'Rad na daljinu');
  exception when insufficient_privilege then
    if sqlerrm='MANUAL_FACT_USE_LOCATION_EDITOR' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'PKG003_MANUAL_WRITER_BYPASSED_LOCATION_AUTHORITY'; end if;

  if (select count(*) from public.ai_messages where conversation_id=v_conv)<>v_messages_before then
    raise exception 'PKG003_MANUAL_FACT_WRITE_CREATED_AI_MESSAGES';
  end if;
end
$manual_bootstrap$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg003_attacker'),true);
select set_config('request.jwt.claims','',true);

do $attacker_guard$
declare
  v_conv uuid := current_setting('uskoci.pkg003_conv')::uuid;
  v_denied boolean := false;
begin
  begin
    perform public.rpc_set_manual_need_fact_v2(v_conv,extensions.gen_random_uuid(),'need.title',to_jsonb('Napad'::text),'Napad');
  exception when sqlstate 'P0002' then
    if sqlerrm='CONVERSATION_NOT_FOUND' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'PKG003_CROSS_ACCOUNT_MANUAL_WRITE_ALLOWED'; end if;
end
$attacker_guard$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg003_owner'),true);
select set_config('request.jwt.claims','',true);

do $location_review_and_draft$
declare
  v_conv uuid := current_setting('uskoci.pkg003_conv')::uuid;
  v_profile uuid := current_setting('uskoci.pkg003_profile')::uuid;
  v_location jsonb;
  v_saved_location jsonb;
  v_review jsonb;
  v_draft jsonb;
  v_need uuid;
  v_before_needs integer;
begin
  select count(*) into v_before_needs from public.needs where requester_account_id=auth.uid();
  if v_before_needs<>0 then raise exception 'PKG003_MANUAL_WRITER_CREATED_NEED_BEFORE_REVIEW'; end if;

  v_location := public.rpc_get_need_location_review(v_conv);
  if coalesce(v_location->>'revision','') !~ '^[0-9a-f]{64}$' then
    raise exception 'PKG003_LOCATION_REVISION_INVALID';
  end if;

  v_saved_location := public.rpc_save_need_location_review(
    v_conv,
    v_location->>'revision',
    jsonb_build_object(
      'taskCountryCode','RS',
      'geography',jsonb_build_object('mode','REMOTE'),
      'exactAddress',null,
      'accessNotes',null,
      'resolvedLocation',null
    ),
    true
  );
  if (v_saved_location->>'saved')::boolean is distinct from true
     or (v_saved_location#>>'{review,confirmed}')::boolean is distinct from true then
    raise exception 'PKG003_LOCATION_SAVE_INVALID';
  end if;

  v_review := public.rpc_ai_need_review_v2(v_conv);
  if jsonb_array_length(v_review->'missingRequired')<>0
     or coalesce((v_review->>'canSaveDraft')::boolean,false) is distinct from true then
    raise exception 'PKG003_MANUAL_CANONICAL_REVIEW_NOT_READY' using detail=v_review::text;
  end if;

  v_draft := public.rpc_save_need_draft_from_review(v_conv,v_profile,'pkg003-proof-draft-0001');
  v_need := nullif(v_draft->>'needId','')::uuid;
  if v_need is null or v_draft->>'status'<>'DRAFT' or (v_draft->>'authoritative')::boolean is distinct from true then
    raise exception 'PKG003_CANONICAL_DRAFT_RECEIPT_INVALID' using detail=v_draft::text;
  end if;
  if (select count(*) from public.needs where id=v_need and requester_account_id=auth.uid() and status='DRAFT')<>1 then
    raise exception 'PKG003_CANONICAL_DRAFT_READBACK_MISSING';
  end if;
  if (select count(*) from public.ai_messages where conversation_id=v_conv)<>0 then
    raise exception 'PKG003_PROVIDER_INDEPENDENCE_BROKEN';
  end if;
end
$location_review_and_draft$;

-- ACL/privacy guard: the authenticated caller may execute only the RPC, never
-- inspect the private replay ledger directly. Service-only AI writer stays closed.
-- The privilege lookups below resolve private.* names, which needs USAGE on the
-- schema; run them as the proof superuser, not as the last impersonated owner
-- (run 35035945857 failed here with "permission denied for schema private").
reset role;
do $acl_guard$
begin
  if has_table_privilege('authenticated','private.manual_need_fact_commands','SELECT')
     or has_table_privilege('authenticated','private.manual_need_fact_commands','INSERT') then
    raise exception 'PKG003_PRIVATE_COMMAND_LEDGER_LEAKED';
  end if;
  if has_function_privilege('anon','public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text)','EXECUTE') then
    raise exception 'PKG003_ANON_MANUAL_WRITER_ALLOWED';
  end if;
  if not has_function_privilege('authenticated','public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text)','EXECUTE') then
    raise exception 'PKG003_AUTHENTICATED_MANUAL_WRITER_MISSING';
  end if;
  if has_function_privilege('authenticated','public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)','EXECUTE') then
    raise exception 'PKG003_SERVICE_AI_WRITER_OPENED_TO_CLIENT';
  end if;
end
$acl_guard$;

rollback;

select 'PASS PKG003_MANUAL_NEED_FACT provider_independent owner_only idempotent one_live_fact location_authority canonical_review canonical_draft zero_residue' as result;
