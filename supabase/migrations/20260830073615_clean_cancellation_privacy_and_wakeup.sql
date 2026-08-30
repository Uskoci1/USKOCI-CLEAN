-- Tri potvrdjena nalaza u lancu otkazivanja. Sva tri provereno postoje.
--
-- 1) FOREVER GRANT: need_sensitive politika je gledala samo access_grants.status.
--    rpc_cancel_agreement nikad nije opozivao grantove, pa je otkazan Uskocer
--    ZAUVEK zadrzavao tacne koordinate Narucioca. Najteziji od tri.
--
-- 2) STARVATION KOD VISE MESTA: otkazivanje postavlja needs.status na 'SELECTION',
--    ali ako je vec bio 'SELECTION' trigger needs_enqueue_dispatch ne vidi
--    promenu (is distinct from) i motor se nikad ne budi. Oslobodjeno mesto
--    ostaje nepopunjeno zauvek.
--
-- 3) GHOST NOTIFIKACIJE: neisporucene notifikacije otkazanog Dogovora su ostajale
--    u redu i stizale posle otkazivanja.

-- (1) Dozvola prestaje da vazi kad Dogovor prestane da bude CONFIRMED.
drop policy if exists need_sensitive_granted_read on public.need_sensitive;
create policy need_sensitive_granted_read on public.need_sensitive
  for select to authenticated
  using (exists (
    select 1 from public.agreements a
      join public.access_grants g on g.agreement_id = a.id
    where a.need_id = need_sensitive.need_id
      and a.status = 'CONFIRMED'                              -- otkazan Dogovor gasi pristup
      and g.channel = 'EXACT_LOCATION'
      and g.status = 'GRANTED'
      and (g.expires_at is null or g.expires_at > statement_timestamp())
      and g.granted_to_account_id = auth.uid()
      and g.granted_by_account_id = a.requester_account_id
      and a.worker_account_id = auth.uid()
  ));

-- Isti uslov i u autoritativnom RPC-u.
create or replace function public.rpc_reveal_contact(p_agreement_id uuid, p_channel text)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare
  u uuid := auth.uid(); a public.agreements; g public.access_grants;
  v_owner uuid; v_phone text; s public.need_sensitive;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if p_channel is null or p_channel not in ('PHONE','EXACT_LOCATION') then
    raise exception using errcode='22023', message='UNSUPPORTED_CHANNEL';
  end if;

  select * into a from public.agreements where id = p_agreement_id;
  if not found then raise exception using errcode='P0002', message='AGREEMENT_NOT_FOUND'; end if;
  if u not in (a.requester_account_id, a.worker_account_id) then
    raise exception using errcode='42501', message='NOT_PARTY';
  end if;
  -- Dozvola zivi samo dok Dogovor zivi.
  if a.status <> 'CONFIRMED' then
    raise exception using errcode='42501', message='AGREEMENT_NOT_ACTIVE';
  end if;

  select * into g from public.access_grants
   where agreement_id = p_agreement_id and channel = p_channel
     and granted_to_account_id = u and status = 'GRANTED'
     and (expires_at is null or expires_at > statement_timestamp())
   limit 1;
  if not found then raise exception using errcode='42501', message='NO_ACTIVE_GRANT'; end if;

  if not private.grant_is_ownable(p_agreement_id, p_channel, g.granted_by_account_id) then
    raise exception using errcode='42501', message='GRANT_NOT_FROM_DATA_OWNER';
  end if;
  if not private.grant_counterparty_ok(p_agreement_id, g.granted_by_account_id, u) then
    raise exception using errcode='42501', message='GRANT_NOT_TO_COUNTERPARTY';
  end if;

  if p_channel = 'PHONE' then
    v_owner := g.granted_by_account_id;
    select nullif(btrim(acc.phone),'') into v_phone from public.app_accounts acc where acc.id = v_owner;
    return jsonb_build_object('channel','PHONE','agreementId',a.id,'ownerAccountId',v_owner,
      'phone',v_phone,'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
  end if;

  select * into s from public.need_sensitive where need_id = a.need_id;
  if not found then raise exception using errcode='P0002', message='LOCATION_NOT_SET'; end if;
  return jsonb_build_object('channel','EXACT_LOCATION','agreementId',a.id,
    'exactAddress',s.exact_address,'accessNotes',s.access_notes,
    'exactLat',s.exact_lat,'exactLng',s.exact_lng,
    'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
end;
$$;
revoke all on function public.rpc_reveal_contact(uuid,text) from public, anon;
grant execute on function public.rpc_reveal_contact(uuid,text) to authenticated;

-- (1+2+3) Otkazivanje sada zatvara privatnost, budi motor i cisti red notifikacija.
create or replace function public.rpc_cancel_agreement(p_agreement_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare uid uuid := auth.uid(); v_agr public.agreements%rowtype; v_covered integer; v_need public.needs%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_agr from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.fn_is_party(p_agreement_id, uid) then raise exception 'NOT_PARTY' using errcode = '42501'; end if;
  if v_agr.status = 'COMPLETED' then raise exception 'ALREADY_COMPLETED' using errcode = 'P0001'; end if;

  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
  update public.agreement_execution set state = 'CANCELLED' where agreement_id = p_agreement_id;

  -- M06: oslobadja se SAMO ova alokacija.
  update public.need_selections set status = 'CANCELLED' where id = v_agr.selection_id;

  update public.marketplace_responses
     set status = 'NOT_SELECTED', selected_at = null
   where id = v_agr.selected_response_id;

  -- (1) Privatnost se povlaci odmah, ne ceka se istek.
  update public.access_grants
     set status = 'REVOKED', revoked_at = coalesce(revoked_at, statement_timestamp())
   where agreement_id = p_agreement_id and status = 'GRANTED';

  -- (3) Neisporucene notifikacije ovog Dogovora se gase.
  update public.notification_deliveries d
     set state = 'EXPIRED'
    from public.user_activity_events e
   where d.event_id = e.id
     and e.entity_type = 'AGREEMENT' and e.entity_id = p_agreement_id
     and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');

  select * into v_need from public.needs where id = v_agr.need_id for update;
  v_covered := public.fn_need_covered_slots(v_agr.need_id);

  if v_covered < v_need.required_slots and v_need.status in ('ACTIVE','SELECTION') then
    update public.needs set status = 'SELECTION' where id = v_need.id;
    -- (2) Trigger ne vidi promenu ako je status vec bio SELECTION.
    --     Motor se budi izricito, inace oslobodjeno mesto ostaje prazno zauvek.
    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
end;
$fn$;

revoke all on function public.rpc_cancel_agreement(uuid,text) from public, anon;
grant execute on function public.rpc_cancel_agreement(uuid,text) to authenticated;

comment on function public.rpc_cancel_agreement(uuid,text) is
  'M06 jednostrano otkazivanje. Oslobadja SAMO svoju alokaciju, opoziva sve dozvole tog Dogovora, gasi neisporucene notifikacije i IZRICITO budi dispatch (trigger ne vidi SELECTION->SELECTION).';
