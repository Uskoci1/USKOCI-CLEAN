-- RU-0 disposable/rollback-only runtime proof.
--
-- Preconditions:
--   1. Run only after 20260903130355_clean_ru0_authority_closure has been
--      applied to a disposable environment.
--   2. Execute as the database administration role.
--
-- Every fixture and positive mutation is enclosed by this transaction and the
-- final statement is ROLLBACK. Never change the final statement to COMMIT.

begin;

do $seed$
declare
  v_owner uuid := extensions.gen_random_uuid();
  v_attacker uuid := extensions.gen_random_uuid();
  v_owner_profile uuid;
  v_conversation uuid;
  v_proposal uuid;
  v_draft_need uuid;
  v_published_need uuid;
  v_event uuid;
  v_delivery uuid;
begin
  insert into auth.users(
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (
      v_owner, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'ru0-owner-' || v_owner || '@proof.invalid', '', statement_timestamp(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"RU0 Owner"}'::jsonb,
      statement_timestamp(), statement_timestamp()
    ),
    (
      v_attacker, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'ru0-attacker-' || v_attacker || '@proof.invalid', '', statement_timestamp(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"RU0 Attacker"}'::jsonb,
      statement_timestamp(), statement_timestamp()
    );

  select id into strict v_owner_profile
    from public.app_profiles
   where account_id = v_owner and kind = 'REQUESTER';

  insert into public.ai_conversations(account_id, purpose)
  values (v_owner, 'NEED_INTAKE') returning id into v_conversation;

  insert into public.ai_action_proposals(
    conversation_id, account_id, action_kind, payload
  ) values (
    v_conversation, v_owner, 'PROOF_ONLY', '{"proof":true}'::jsonb
  ) returning id into v_proposal;

  insert into public.needs(
    requester_account_id, requester_profile_id, status,
    title, description, category, mode
  ) values (
    v_owner, v_owner_profile, 'DRAFT',
    'RU0 draft before', 'Rollback-only proof', 'PROOF', 'OFFERS'
  ) returning id into v_draft_need;

  perform set_config('uskoci.need_lifecycle', 'PUBLISH', true);
  insert into public.needs(
    requester_account_id, requester_profile_id, status,
    title, description, category, mode, published_at
  ) values (
    v_owner, v_owner_profile, 'PUBLISHED',
    'RU0 published before', 'Rollback-only proof', 'PROOF', 'OFFERS',
    statement_timestamp()
  ) returning id into v_published_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  insert into public.user_activity_events(
    recipient_user_id, recipient_role, event_type, entity_type,
    entity_id, dedupe_key
  ) values (
    v_owner, 'REQUESTER', 'NEED_CANCELLED', 'NEED',
    v_draft_need, 'ru0-event-' || extensions.gen_random_uuid()
  ) returning id into v_event;

  insert into public.notification_deliveries(
    event_id, recipient_user_id, recipient_role, channel,
    state, title, body, dedupe_key
  ) values (
    v_event, v_owner, 'REQUESTER', 'IN_APP',
    'CREATED', 'RU0 proof', 'Rollback-only proof',
    'ru0-delivery-' || extensions.gen_random_uuid()
  ) returning id into v_delivery;

  perform set_config('uskoci.ru0.owner', v_owner::text, true);
  perform set_config('uskoci.ru0.attacker', v_attacker::text, true);
  perform set_config('uskoci.ru0.conversation', v_conversation::text, true);
  perform set_config('uskoci.ru0.proposal', v_proposal::text, true);
  perform set_config('uskoci.ru0.draft_need', v_draft_need::text, true);
  perform set_config('uskoci.ru0.published_need', v_published_need::text, true);
  perform set_config('uskoci.ru0.delivery', v_delivery::text, true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('uskoci.ru0.owner'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $owner_read_and_draft_write$
declare
  v_rows bigint;
begin
  select count(*) into v_rows
    from public.ai_conversations
   where id = current_setting('uskoci.ru0.conversation')::uuid;
  if v_rows <> 1 then
    raise exception 'RU0_PROOF_FAILED: owner cannot read own conversation';
  end if;

  select count(*) into v_rows
    from public.ai_action_proposals
   where id = current_setting('uskoci.ru0.proposal')::uuid;
  if v_rows <> 1 then
    raise exception 'RU0_PROOF_FAILED: owner cannot read own proposal';
  end if;

  select count(*) into v_rows
    from public.notification_deliveries
   where id = current_setting('uskoci.ru0.delivery')::uuid;
  if v_rows <> 1 then
    raise exception 'RU0_PROOF_FAILED: owner cannot read own delivery';
  end if;

  update public.needs
     set title = 'RU0 draft after'
   where id = current_setting('uskoci.ru0.draft_need')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'RU0_PROOF_FAILED: legitimate owner DRAFT update was denied';
  end if;

  update public.needs
     set title = 'RU0 published attack'
   where id = current_setting('uskoci.ru0.published_need')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'RU0_PROOF_FAILED: raw owner UPDATE changed a PUBLISHED Need';
  end if;
end
$owner_read_and_draft_write$;

do $direct_mutation_denials$
declare
  v_denied boolean;
begin
  v_denied := false;
  begin
    insert into public.ai_conversations(account_id, purpose)
    values (current_setting('uskoci.ru0.owner')::uuid, 'NEED_INTAKE');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: direct conversation INSERT allowed'; end if;

  v_denied := false;
  begin
    update public.ai_conversations set status = 'ABANDONED'
     where id = current_setting('uskoci.ru0.conversation')::uuid;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: direct conversation UPDATE allowed'; end if;

  v_denied := false;
  begin
    delete from public.ai_conversations
     where id = current_setting('uskoci.ru0.conversation')::uuid;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: direct conversation DELETE allowed'; end if;

  v_denied := false;
  begin
    update public.ai_action_proposals set status = 'CONFIRMED'
     where id = current_setting('uskoci.ru0.proposal')::uuid;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: direct proposal UPDATE allowed'; end if;

  v_denied := false;
  begin
    delete from public.ai_action_proposals
     where id = current_setting('uskoci.ru0.proposal')::uuid;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: direct proposal DELETE allowed'; end if;

  v_denied := false;
  begin
    update public.notification_deliveries
       set state = 'READ', read_at = statement_timestamp()
     where id = current_setting('uskoci.ru0.delivery')::uuid;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: direct delivery UPDATE allowed'; end if;
end
$direct_mutation_denials$;

do $retired_rpc_denials$
declare
  v_denied boolean;
begin
  v_denied := false;
  begin
    perform public.rpc_ai_propose_fact(
      current_setting('uskoci.ru0.conversation')::uuid,
      'naslov', to_jsonb('attack'::text), 'SYSTEM_DERIVED', 'NEED_DRAFT', 1, null
    );
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: legacy AI proposal RPC executable'; end if;

  v_denied := false;
  begin
    perform public.rpc_publish_need(
      current_setting('uskoci.ru0.draft_need')::uuid, null
    );
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: legacy publish RPC executable'; end if;

  v_denied := false;
  begin
    perform public.rpc_propose_agreement_change(
      extensions.gen_random_uuid(), 1, '{}'::jsonb, 'proof', 'ru0-proof-client'
    );
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'RU0_PROOF_FAILED: legacy Agreement RPC executable'; end if;
end
$retired_rpc_denials$;

select set_config('request.jwt.claim.sub', current_setting('uskoci.ru0.attacker'), true);

do $attacker_read_denials$
declare
  v_rows bigint;
begin
  select count(*) into v_rows from public.ai_conversations
   where id = current_setting('uskoci.ru0.conversation')::uuid;
  if v_rows <> 0 then raise exception 'RU0_PROOF_FAILED: attacker read conversation'; end if;

  select count(*) into v_rows from public.ai_action_proposals
   where id = current_setting('uskoci.ru0.proposal')::uuid;
  if v_rows <> 0 then raise exception 'RU0_PROOF_FAILED: attacker read proposal'; end if;

  select count(*) into v_rows from public.notification_deliveries
   where id = current_setting('uskoci.ru0.delivery')::uuid;
  if v_rows <> 0 then raise exception 'RU0_PROOF_FAILED: attacker read delivery'; end if;
end
$attacker_read_denials$;

reset role;
set local role service_role;

do $service_writer_positive$
declare
  v_result jsonb;
begin
  v_result := public.rpc_ai_apply_interview_turn_service(
    current_setting('uskoci.ru0.owner')::uuid,
    current_setting('uskoci.ru0.conversation')::uuid,
    'RU0 rollback-only user message',
    'RU0 rollback-only assistant message',
    'ALLOW',
    '[]'::jsonb
  );
  if coalesce((v_result->>'authoritative')::boolean, false) is not true then
    raise exception 'RU0_PROOF_FAILED: service AI writer did not remain authoritative';
  end if;
end
$service_writer_positive$;

reset role;

do $final_contract$
begin
  if not has_function_privilege(
       'authenticated',
       'public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.rpc_respond_agreement_change(uuid,boolean)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)',
       'execute'
     ) then
    raise exception 'RU0_PROOF_FAILED: preserved command grants mismatch';
  end if;
end
$final_contract$;

rollback;
