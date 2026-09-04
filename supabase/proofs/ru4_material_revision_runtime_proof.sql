-- USKOČI RU-4 rollback-only authenticated/two-account proof.
\set ON_ERROR_STOP on
begin;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker_a uuid := extensions.gen_random_uuid();
  worker_b uuid := extensions.gen_random_uuid();
  attacker uuid := extensions.gen_random_uuid();
  requester_profile uuid;
  worker_a_profile uuid;
  worker_b_profile uuid;
  need_a uuid;
  need_b uuid;
  response_a uuid;
  response_b_selected uuid;
  response_b_open uuid;
  selection_b uuid;
  agreement_b uuid;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru4-requester-'||requester::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_a,'authenticated','authenticated','ru4-worker-a-'||worker_a::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Worker A','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_b,'authenticated','authenticated','ru4-worker-b-'||worker_b::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Worker B','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (attacker,'authenticated','authenticated','ru4-attacker-'||attacker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Attacker','city','Novi Sad'),statement_timestamp(),statement_timestamp());

  select id into requester_profile from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_a_profile from public.app_profiles where account_id=worker_a and kind='WORKER';
  select id into worker_b_profile from public.app_profiles where account_id=worker_b and kind='WORKER';
  if requester_profile is null or worker_a_profile is null or worker_b_profile is null then
    raise exception 'RU4_PROOF_PROFILE_SETUP_FAILED';
  end if;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    requester_account_id, requester_profile_id, status, title, description, category,
    schedule_kind, required_slots, mode, requester_price_rsd, revision, published_at
  ) values (
    requester, requester_profile, 'PUBLISHED', 'RU4 proof published', 'Published revision proof', 'proof',
    'FLEXIBLE', 1, 'MY_PRICE', 5000, 1, statement_timestamp()
  ) returning id into need_a;

  insert into public.needs(
    requester_account_id, requester_profile_id, status, title, description, category,
    schedule_kind, required_slots, mode, requester_price_rsd, revision, published_at
  ) values (
    requester, requester_profile, 'PUBLISHED', 'RU4 proof partial selection', 'Partial selection proof', 'proof',
    'FLEXIBLE', 2, 'MY_PRICE', 7000, 1, statement_timestamp()
  ) returning id into need_b;
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values (
    need_a,worker_a,worker_a_profile,'OFFER','SUBMITTED',1,1,1,5000,'RU4 open response',statement_timestamp()
  ) returning id into response_a;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_a,1,1,5000,1,'RU4 open response',repeat('a',64));

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at,selected_at
  ) values (
    need_b,worker_a,worker_a_profile,'OFFER','SELECTED',1,1,1,7000,'RU4 selected response',statement_timestamp(),statement_timestamp()
  ) returning id into response_b_selected;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_b_selected,1,1,7000,1,'RU4 selected response',repeat('b',64));

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values (
    need_b,worker_b,worker_b_profile,'OFFER','SUBMITTED',1,1,1,7000,'RU4 unselected response',statement_timestamp()
  ) returning id into response_b_open;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_b_open,1,1,7000,1,'RU4 unselected response',repeat('c',64));

  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,
    worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    need_b,1,requester,'ru4-seed-selection',1,response_b_selected,
    worker_a,worker_a_profile,'REQUESTER_SELECTS','SELECTED'
  ) returning id into selection_b;

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    need_b,selection_b,response_b_selected,requester,requester_profile,
    worker_a,worker_a_profile,1,'CONFIRMED'
  ) returning id into agreement_b;
  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,created_by_account_id
  ) values (
    agreement_b,1,'CONFIRMED',jsonb_build_object('needRevision',1,'priceRsd',7000),repeat('d',64),requester
  );

  -- Move the second task to partial SELECTION using the canonical lifecycle token.
  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs set status='SELECTION' where id=need_b;
  perform set_config('uskoci.need_lifecycle','',true);

  insert into private.dispatch_schedule(need_id,next_run_at) values
    (need_a,statement_timestamp()),(need_b,statement_timestamp())
  on conflict (need_id) do update set next_run_at=excluded.next_run_at;

  perform set_config('uskoci.ru4_requester',requester::text,true);
  perform set_config('uskoci.ru4_attacker',attacker::text,true);
  perform set_config('uskoci.ru4_need_a',need_a::text,true);
  perform set_config('uskoci.ru4_need_b',need_b::text,true);
  perform set_config('uskoci.ru4_response_a',response_a::text,true);
  perform set_config('uskoci.ru4_response_b_selected',response_b_selected::text,true);
  perform set_config('uskoci.ru4_response_b_open',response_b_open::text,true);
  perform set_config('uskoci.ru4_selection_b',selection_b::text,true);
  perform set_config('uskoci.ru4_agreement_b',agreement_b::text,true);
end
$seed$;

-- Attacker cannot revise somebody else's Zadatak.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_attacker'),true);
do $attacker$
declare
  denied boolean := false;
begin
  begin
    perform public.rpc_revise_need_to_draft(
      current_setting('uskoci.ru4_need_a')::uuid,1,'ru4-attacker-key','attack'
    );
  exception when insufficient_privilege then denied := true;
            when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'RU4_PROOF_ATTACKER_REVISE_ALLOWED'; end if;
end
$attacker$;

-- Owner: a public task must not be directly edited in place through client RLS.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_requester'),true);
do $direct_edit$
declare touched integer;
begin
  update public.needs set title='UNSAFE DIRECT PUBLIC EDIT'
   where id=current_setting('uskoci.ru4_need_a')::uuid;
  get diagnostics touched=row_count;
  if touched <> 0 then raise exception 'RU4_PROOF_DIRECT_PUBLIC_EDIT_ALLOWED'; end if;
end
$direct_edit$;

-- Owner PUBLISHED -> DRAFT: exact +1 revision, stale unselected response, no dispatch.
do $published$
declare
  nid uuid:=current_setting('uskoci.ru4_need_a')::uuid;
  rid uuid:=current_setting('uskoci.ru4_response_a')::uuid;
  r jsonb; r2 jsonb; s text; rev integer; cnt integer;
begin
  r := public.rpc_revise_need_to_draft(nid,1,'ru4-published-key','owner edits task');
  if r->>'status' <> 'DRAFT' or (r->>'revision')::integer <> 2
     or not (r->>'requiresReadmission')::boolean then
    raise exception 'RU4_PROOF_PUBLISHED_BAD_RESULT' using detail=r::text;
  end if;
  select status,revision into s,rev from public.needs where id=nid;
  if s<>'DRAFT' or rev<>2 then raise exception 'RU4_PROOF_PUBLISHED_NOT_DRAFT_REV2'; end if;
  select status into s from public.marketplace_responses where id=rid;
  if s<>'STALE_REVIEW_REQUIRED' then raise exception 'RU4_PROOF_OPEN_RESPONSE_NOT_STALE_REVIEW'; end if;
  select count(*) into cnt from private.dispatch_schedule where need_id=nid;
  if cnt<>0 then raise exception 'RU4_PROOF_DISPATCH_NOT_STOPPED'; end if;
  select count(*) into cnt from private.need_revision_events where need_id=nid and from_revision=1 and to_revision=2;
  if cnt<>1 then raise exception 'RU4_PROOF_REVISION_EVENT_MISSING'; end if;

  r2 := public.rpc_revise_need_to_draft(nid,1,'ru4-published-key','owner edits task');
  if not coalesce((r2->>'idempotentReplay')::boolean,false)
     or (r2->>'revision')::integer<>2 then
    raise exception 'RU4_PROOF_REPLAY_NOT_STABLE' using detail=r2::text;
  end if;

  begin
    perform public.rpc_revise_need_to_draft(nid,1,'ru4-published-key','different payload');
    raise exception 'RU4_PROOF_REUSED_KEY_DIFFERENT_PAYLOAD_ALLOWED';
  exception when sqlstate '22023' then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;
end
$published$;

-- Owner partial SELECTION -> DRAFT: selected Agreement snapshot remains frozen;
-- only the other unselected old-revision Prijava becomes review-required.
do $partial$
declare
  nid uuid:=current_setting('uskoci.ru4_need_b')::uuid;
  selected_rid uuid:=current_setting('uskoci.ru4_response_b_selected')::uuid;
  open_rid uuid:=current_setting('uskoci.ru4_response_b_open')::uuid;
  sid uuid:=current_setting('uskoci.ru4_selection_b')::uuid;
  aid uuid:=current_setting('uskoci.ru4_agreement_b')::uuid;
  r jsonb; s text; rev integer; cnt integer; h text;
begin
  r := public.rpc_revise_need_to_draft(nid,1,'ru4-partial-key','revise remaining task scope');
  if r->>'status'<>'DRAFT' or (r->>'revision')::integer<>2 then
    raise exception 'RU4_PROOF_PARTIAL_BAD_RESULT' using detail=r::text;
  end if;
  select status,revision into s,rev from public.needs where id=nid;
  if s<>'DRAFT' or rev<>2 then raise exception 'RU4_PROOF_PARTIAL_NOT_DRAFT_REV2'; end if;
  select status into s from public.marketplace_responses where id=selected_rid;
  if s<>'SELECTED' then raise exception 'RU4_PROOF_SELECTED_RESPONSE_MUTATED'; end if;
  select status into s from public.marketplace_responses where id=open_rid;
  if s<>'STALE_REVIEW_REQUIRED' then raise exception 'RU4_PROOF_UNSELECTED_RESPONSE_NOT_STALE_REVIEW'; end if;
  select count(*) into cnt from public.need_selections where id=sid and status='SELECTED' and need_revision=1;
  if cnt<>1 then raise exception 'RU4_PROOF_SELECTION_SNAPSHOT_MUTATED'; end if;
  select count(*) into cnt from public.agreements where id=aid and status='CONFIRMED' and current_version=1;
  if cnt<>1 then raise exception 'RU4_PROOF_AGREEMENT_MUTATED'; end if;
  select content_hash into h from public.agreement_versions where agreement_id=aid and version=1;
  if h<>repeat('d',64) then raise exception 'RU4_PROOF_AGREEMENT_VERSION_MUTATED'; end if;
  select count(*) into cnt from private.dispatch_schedule where need_id=nid;
  if cnt<>0 then raise exception 'RU4_PROOF_PARTIAL_DISPATCH_NOT_STOPPED'; end if;
end
$partial$;

-- A DRAFT may now be edited by its owner without another revision bump; it
-- cannot return public except through later D-0140/B07 admission.
do $draft_edit$
declare nid uuid:=current_setting('uskoci.ru4_need_a')::uuid; rev integer; s text;
begin
  update public.needs set title='RU4 edited safely while DRAFT' where id=nid;
  select revision,status into rev,s from public.needs where id=nid;
  if rev<>2 or s<>'DRAFT' then raise exception 'RU4_PROOF_DRAFT_EDIT_CHANGED_REVISION_OR_STATUS'; end if;
end
$draft_edit$;

reset role;

-- Structural authority checks outside authenticated role.
do $authority$
begin
  if has_function_privilege('anon','public.rpc_revise_need_to_draft(uuid,integer,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_revise_need_to_draft(uuid,integer,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_revise_need_to_draft(uuid,integer,text,text)','EXECUTE') then
    raise exception 'RU4_PROOF_RPC_GRANTS_WRONG';
  end if;
  if has_table_privilege('authenticated','private.need_revision_events','SELECT')
     or has_table_privilege('authenticated','private.need_revision_commands','SELECT') then
    raise exception 'RU4_PROOF_PRIVATE_TABLE_EXPOSURE';
  end if;
end
$authority$;

select 'PASS RU4 material_revision owner_attacker revise_to_draft exact_revision stale_unselected preserve_selected_agreement idempotent no_public_window no_dispatch private_audit' as result;
rollback;
