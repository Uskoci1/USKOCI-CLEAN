-- Client command authority closure.
--
-- Adds the three server-owned commands required by the canonical native client:
-- 1. requester marks a Response viewed without direct table UPDATE;
-- 2. a party grants/revokes only their own directional contact datum;
-- 3. worker profile activation validates matchmaking minimums on the server.
--
-- This is forward-only. It does not rewrite any predecessor migration or
-- mutate existing business rows during deployment.

create or replace function public.rpc_mark_response_viewed(p_response_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_requester uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select r.status, n.requester_account_id
    into v_status, v_requester
    from public.marketplace_responses r
    join public.needs n on n.id = r.need_id
   where r.id = p_response_id
   for update of r;

  if not found then
    raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_requester <> v_uid then
    raise exception 'NOT_REQUESTER' using errcode = '42501';
  end if;
  if v_status = 'DRAFT' then
    raise exception 'RESPONSE_NOT_SUBMITTED' using errcode = 'P0001';
  end if;

  update public.marketplace_responses
     set status = case
                    when status in ('SUBMITTED', 'DELIVERED') then 'VIEWED'
                    else status
                  end,
         viewed_at = coalesce(viewed_at, statement_timestamp())
   where id = p_response_id;
end;
$function$;

revoke all on function public.rpc_mark_response_viewed(uuid) from public, anon;
grant execute on function public.rpc_mark_response_viewed(uuid) to authenticated;

comment on function public.rpc_mark_response_viewed(uuid) is
  'Requester-only, replay-idempotent Response viewed transition; direct authenticated Response UPDATE remains closed.';

create or replace function public.rpc_set_contact_grant(
  p_agreement_id uuid,
  p_channel text,
  p_granted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_to uuid;
  v_grant_id uuid;
  v_phone text;
  v_address text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_channel not in ('PHONE', 'EXACT_LOCATION') then
    raise exception 'UNSUPPORTED_CHANNEL' using errcode = '22023';
  end if;
  if p_granted is null then
    raise exception 'GRANT_DECISION_REQUIRED' using errcode = '22004';
  end if;

  select *
    into v_agreement
    from public.agreements
   where id = p_agreement_id
   for update;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_uid not in (v_agreement.requester_account_id, v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  v_to := case
            when v_uid = v_agreement.requester_account_id then v_agreement.worker_account_id
            else v_agreement.requester_account_id
          end;

  -- Revocation is deliberately allowed after cancellation/completion so a
  -- user can always close their own grant. New grants require a live agreement.
  if p_granted and v_agreement.status <> 'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode = 'P0001', detail = v_agreement.status;
  end if;

  if p_channel = 'PHONE' and p_granted then
    select nullif(btrim(a.phone), '')
      into v_phone
      from public.app_accounts a
     where a.id = v_uid;
    if v_phone is null then
      raise exception 'PHONE_NOT_SET' using errcode = 'P0001';
    end if;
  end if;

  -- Exact Need location belongs to the requester. A worker cannot grant a
  -- requester's address back to them or to anyone else.
  if p_channel = 'EXACT_LOCATION' then
    if v_uid <> v_agreement.requester_account_id then
      raise exception 'NOT_LOCATION_OWNER' using errcode = '42501';
    end if;
    if p_granted then
      select nullif(btrim(s.exact_address), '')
        into v_address
        from public.need_sensitive s
       where s.need_id = v_agreement.need_id;
      if v_address is null then
        raise exception 'LOCATION_NOT_SET' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if p_granted then
    insert into public.access_grants (
      agreement_id,
      channel,
      granted_by_account_id,
      granted_to_account_id,
      status,
      granted_at,
      revoked_at,
      expires_at
    ) values (
      p_agreement_id,
      p_channel,
      v_uid,
      v_to,
      'GRANTED',
      statement_timestamp(),
      null,
      null
    )
    on conflict (agreement_id, channel, granted_by_account_id, granted_to_account_id)
    do update set
      status = 'GRANTED',
      granted_at = statement_timestamp(),
      revoked_at = null,
      expires_at = null
    returning id into v_grant_id;
  else
    update public.access_grants
       set status = 'REVOKED',
           revoked_at = coalesce(revoked_at, statement_timestamp())
     where agreement_id = p_agreement_id
       and channel = p_channel
       and granted_by_account_id = v_uid
       and granted_to_account_id = v_to
    returning id into v_grant_id;
  end if;

  return jsonb_build_object(
    'agreementId', p_agreement_id,
    'channel', p_channel,
    'grantedByAccountId', v_uid,
    'grantedToAccountId', v_to,
    'granted', p_granted,
    'grantId', v_grant_id,
    'authoritative', true
  );
end;
$function$;

revoke all on function public.rpc_set_contact_grant(uuid, text, boolean) from public, anon;
grant execute on function public.rpc_set_contact_grant(uuid, text, boolean) to authenticated;

comment on function public.rpc_set_contact_grant(uuid, text, boolean) is
  'Directional, owner-only, revocable contact grant command. Replays converge to the requested authoritative state.';

create or replace function public.rpc_complete_worker_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.app_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_profile
    from public.app_profiles
   where id = p_profile_id
   for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.account_id <> v_uid or v_profile.kind <> 'WORKER' then
    raise exception 'NOT_WORKER_PROFILE_OWNER' using errcode = '42501';
  end if;
  if v_profile.profile_status = 'SUSPENDED' then
    raise exception 'PROFILE_SUSPENDED' using errcode = 'P0001';
  end if;
  if char_length(btrim(v_profile.display_name)) < 2 then
    raise exception 'DISPLAY_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(btrim(v_profile.city)) < 2 then
    raise exception 'CITY_REQUIRED' using errcode = 'P0001';
  end if;
  if cardinality(v_profile.skills) < 1 then
    raise exception 'SKILL_REQUIRED' using errcode = 'P0001';
  end if;

  update public.app_profiles
     set profile_status = 'ACTIVE'
   where id = p_profile_id;
end;
$function$;

revoke all on function public.rpc_complete_worker_profile(uuid) from public, anon;
grant execute on function public.rpc_complete_worker_profile(uuid) to authenticated;

comment on function public.rpc_complete_worker_profile(uuid) is
  'Owner-only worker activation after server-side matchmaking minimum validation.';

