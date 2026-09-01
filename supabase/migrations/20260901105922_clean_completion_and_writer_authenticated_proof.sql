-- USKOCI clean build authenticated runtime proof.
-- No fixture rows survive. Successful RPC mutations run inside a PL/pgSQL
-- exception subtransaction that is intentionally rolled back after assertions.

-- Dynamically bind one existing fully-covered active Agreement. Never hardcode
-- generated business IDs into migration source.
do $proof_seed$
declare
  v_agreement_id uuid;
  v_need_id uuid;
  v_requester_id uuid;
  v_worker_id uuid;
  v_version integer;
begin
  select a.id, a.need_id, a.requester_account_id, a.worker_account_id, a.current_version
    into v_agreement_id, v_need_id, v_requester_id, v_worker_id, v_version
    from public.agreements a
    join public.need_selections s on s.id = a.selection_id
    join public.needs n on n.id = a.need_id
   where a.status = 'CONFIRMED'
     and s.status = 'SELECTED'
     and n.status in ('ACTIVE','SELECTION')
     and s.covered_slots >= n.required_slots
   order by a.created_at
   limit 1;

  if v_agreement_id is null then
    raise exception 'AUTH_PROOF_FIXTURE_REQUIRED: no fully-covered active Agreement exists';
  end if;

  perform set_config('uskoci.proof_agreement_id', v_agreement_id::text, true);
  perform set_config('uskoci.proof_need_id', v_need_id::text, true);
  perform set_config('uskoci.proof_requester_id', v_requester_id::text, true);
  perform set_config('uskoci.proof_worker_id', v_worker_id::text, true);
  perform set_config('uskoci.proof_agreement_version', v_version::text, true);
end
$proof_seed$;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  current_setting('uskoci.proof_requester_id', true),
  true
);
select set_config('request.jwt.claims', '', true);

-- Direct chat INSERT must be denied even for a valid Agreement participant.
do $direct_message_denial$
declare
  v_denied boolean := false;
  v_agreement_id uuid := current_setting('uskoci.proof_agreement_id', true)::uuid;
  v_requester_id uuid := current_setting('uskoci.proof_requester_id', true)::uuid;
  v_version integer := current_setting('uskoci.proof_agreement_version', true)::integer;
begin
  begin
    insert into public.agreement_messages(
      agreement_id, agreement_version, sender_account_id, body
    ) values (
      v_agreement_id, v_version, v_requester_id,
      'USKOCI_AUTH_PROOF_DIRECT_MESSAGE_MUST_NOT_PERSIST'
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;

  if not v_denied then
    raise exception 'AUTH_PROOF_FAILED: direct agreement_messages INSERT was allowed';
  end if;
end
$direct_message_denial$;

-- Direct grant INSERT must be denied for an otherwise valid direction.
do $direct_grant_denial$
declare
  v_denied boolean := false;
  v_agreement_id uuid := current_setting('uskoci.proof_agreement_id', true)::uuid;
  v_requester_id uuid := current_setting('uskoci.proof_requester_id', true)::uuid;
  v_worker_id uuid := current_setting('uskoci.proof_worker_id', true)::uuid;
begin
  begin
    insert into public.access_grants(
      agreement_id, channel, granted_by_account_id, granted_to_account_id
    ) values (
      v_agreement_id, 'PHONE', v_requester_id, v_worker_id
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;

  if not v_denied then
    raise exception 'AUTH_PROOF_FAILED: direct access_grants INSERT was allowed';
  end if;
end
$direct_grant_denial$;

-- The contact command remains executable through its SECURITY DEFINER RPC and
-- must fail closed on the real data precondition (the proof requester has no
-- configured phone). A different failure means authority wiring regressed.
do $grant_fail_closed_proof$
declare
  v_agreement_id uuid := current_setting('uskoci.proof_agreement_id', true)::uuid;
  v_message text;
begin
  begin
    perform public.rpc_set_contact_grant(v_agreement_id, 'PHONE', true);
    raise exception 'AUTH_PROOF_FAILED: expected PHONE_NOT_SET';
  exception when raise_exception then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'PHONE_NOT_SET' then
      raise;
    end if;
  end;
end
$grant_fail_closed_proof$;

-- Prove the positive authoritative writer and aggregate completion paths. The
-- P9001 exception intentionally rolls back both transient mutations after all
-- assertions pass.
do $rpc_and_completion_proof$
declare
  v_agreement_id uuid := current_setting('uskoci.proof_agreement_id', true)::uuid;
  v_need_id uuid := current_setting('uskoci.proof_need_id', true)::uuid;
  v_agreement_status text;
  v_execution_state text;
  v_need_status text;
  v_before_messages bigint;
  v_after_messages bigint;
begin
  select count(*) into v_before_messages
    from public.agreement_messages m
   where m.agreement_id = v_agreement_id;

  begin
    perform public.rpc_send_agreement_message(
      v_agreement_id,
      'USKOCI_AUTH_PROOF_RPC_MESSAGE_MUST_ROLLBACK'
    );

    perform public.rpc_confirm_completion(v_agreement_id);

    select a.status, e.state, n.status
      into v_agreement_status, v_execution_state, v_need_status
      from public.agreements a
      join public.agreement_execution e on e.agreement_id = a.id
      join public.needs n on n.id = a.need_id
     where a.id = v_agreement_id
       and n.id = v_need_id;

    if v_agreement_status <> 'COMPLETED'
       or v_execution_state <> 'COMPLETED'
       or v_need_status <> 'COMPLETED' then
      raise exception
        'AUTH_PROOF_FAILED: completion did not propagate agreement=%, execution=%, need=%',
        v_agreement_status, v_execution_state, v_need_status;
    end if;

    if not exists (
      select 1 from public.agreement_messages m
       where m.agreement_id = v_agreement_id
         and m.body = 'USKOCI_AUTH_PROOF_RPC_MESSAGE_MUST_ROLLBACK'
    ) then
      raise exception 'AUTH_PROOF_FAILED: rpc_send_agreement_message did not persist inside proof subtransaction';
    end if;

    raise exception using
      errcode = 'P9001',
      message = 'USKOCI_EXPECTED_AUTH_PROOF_ROLLBACK';
  exception when sqlstate 'P9001' then
    null;
  end;

  select count(*) into v_after_messages
    from public.agreement_messages m
   where m.agreement_id = v_agreement_id;

  select a.status, e.state, n.status
    into v_agreement_status, v_execution_state, v_need_status
    from public.agreements a
    join public.agreement_execution e on e.agreement_id = a.id
    join public.needs n on n.id = a.need_id
   where a.id = v_agreement_id
     and n.id = v_need_id;

  if v_after_messages <> v_before_messages then
    raise exception 'AUTH_PROOF_FAILED: proof message survived nested rollback';
  end if;

  if v_agreement_status <> 'CONFIRMED'
     or v_execution_state <> 'CONFIRMED'
     or v_need_status not in ('ACTIVE','SELECTION') then
    raise exception
      'AUTH_PROOF_FAILED: business lifecycle changed after rollback agreement=%, execution=%, need=%',
      v_agreement_status, v_execution_state, v_need_status;
  end if;
end
$rpc_and_completion_proof$;

reset role;

comment on function private.sync_need_completion(uuid) is
  'AUTHENTICATED_RUNTIME_PROVEN: requester completion of a fully-covered Agreement reached parent Need COMPLETED inside rollback-only proof; no proof business rows retained.';

comment on table public.access_grants is
  'AUTHENTICATED_RUNTIME_PROVEN: direct INSERT denied; rpc_set_contact_grant remained executable and fail-closed with PHONE_NOT_SET on an account without a phone. Authenticated reads remain RLS-governed.';

comment on table public.agreement_messages is
  'AUTHENTICATED_RUNTIME_PROVEN: direct INSERT denied; rpc_send_agreement_message succeeded inside rollback-only proof. Participant reads remain RLS-governed.';