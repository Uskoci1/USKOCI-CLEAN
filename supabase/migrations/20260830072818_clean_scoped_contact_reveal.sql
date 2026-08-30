-- B: scoped reveal privatnog podatka + zatvaranje latentne rupe u izdavanju granta.
--
-- Zatecено stanje, provereno napadom sa dva stvarno prijavljena naloga:
--   1. access_grants INSERT je dozvoljavao BILO KOJOJ strani Dogovora da izda
--      grant BILO KOME — ukljucujuci trece lice van Dogovora. Dokazano.
--   2. Citanje tacne lokacije se NIJE ostvarilo samo zato sto trece lice ne vidi
--      red u agreements. To je slucajna odbrana, ne projektovana.
--   3. PHONE grant je bio potpuno INERTAN: nijedna funkcija ni politika ga nije
--      citala, pa deljenje broja nije otkrivalo nista.
--
-- Ispravka ne olabavljuje app_accounts RLS. Telefon i dalje niko ne cita direktno.

alter table public.access_grants
  add column if not exists expires_at timestamptz;

comment on column public.access_grants.expires_at is
  'Opciono trajanje dozvole. NULL = bez roka. Reveal je fail-closed na istek.';

-- Vlasnistvo nad podatkom po kanalu: tacnu lokaciju deli SAMO Narucilac,
-- jer je to njegova adresa. Telefon deli svako svoj.
create or replace function private.grant_is_ownable(p_agreement_id uuid, p_channel text, p_granter uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog' as $$
  select exists (
    select 1 from public.agreements a
    where a.id = p_agreement_id
      and case p_channel
        when 'EXACT_LOCATION' then a.requester_account_id = p_granter
        when 'PHONE' then p_granter in (a.requester_account_id, a.worker_account_id)
        else false
      end
  );
$$;

-- Primalac mora biti DRUGA strana istog Dogovora. Nikad trece lice.
create or replace function private.grant_counterparty_ok(p_agreement_id uuid, p_granter uuid, p_grantee uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog' as $$
  select exists (
    select 1 from public.agreements a
    where a.id = p_agreement_id
      and p_granter <> p_grantee
      and ((a.requester_account_id = p_granter and a.worker_account_id = p_grantee)
        or (a.worker_account_id = p_granter and a.requester_account_id = p_grantee))
  );
$$;

revoke all on function private.grant_is_ownable(uuid,text,uuid) from public, anon, authenticated;
revoke all on function private.grant_counterparty_ok(uuid,uuid,uuid) from public, anon, authenticated;

drop policy if exists access_grants_grant on public.access_grants;
create policy access_grants_grant on public.access_grants
  for insert to authenticated
  with check (
    granted_by_account_id = auth.uid()
    and private.grant_is_ownable(agreement_id, channel, auth.uid())
    and private.grant_counterparty_ok(agreement_id, auth.uid(), granted_to_account_id)
  );

comment on policy access_grants_grant on public.access_grants is
  'Dozvolu izdaje SAMO vlasnik podatka i SAMO drugoj strani istog Dogovora. Tacnu lokaciju deli iskljucivo Narucilac.';

-- Odbrana u dubini: ne oslanjati se na to sto trece lice ne vidi agreements.
drop policy if exists need_sensitive_granted_read on public.need_sensitive;
create policy need_sensitive_granted_read on public.need_sensitive
  for select to authenticated
  using (exists (
    select 1 from public.agreements a
      join public.access_grants g on g.agreement_id = a.id
    where a.need_id = need_sensitive.need_id
      and g.channel = 'EXACT_LOCATION'
      and g.status = 'GRANTED'
      and (g.expires_at is null or g.expires_at > statement_timestamp())
      and g.granted_to_account_id = auth.uid()
      and g.granted_by_account_id = a.requester_account_id   -- izdao ga vlasnik adrese
      and a.worker_account_id = auth.uid()                    -- primalac je izvrsilac tog Dogovora
  ));

-- Jedini autoritativni put od granta do podatka. Vraca SAMO trazeni kanal.
create or replace function public.rpc_reveal_contact(p_agreement_id uuid, p_channel text)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare
  u uuid := auth.uid();
  a public.agreements;
  g public.access_grants;
  v_owner uuid;
  v_phone text;
  s public.need_sensitive;
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

  select * into g from public.access_grants
   where agreement_id = p_agreement_id
     and channel = p_channel
     and granted_to_account_id = u
     and status = 'GRANTED'
     and (expires_at is null or expires_at > statement_timestamp())
   limit 1;
  if not found then raise exception using errcode='42501', message='NO_ACTIVE_GRANT'; end if;

  -- Izdavalac mora i ovde biti vlasnik podatka, ne samo bilo koja strana.
  if not private.grant_is_ownable(p_agreement_id, p_channel, g.granted_by_account_id) then
    raise exception using errcode='42501', message='GRANT_NOT_FROM_DATA_OWNER';
  end if;
  if not private.grant_counterparty_ok(p_agreement_id, g.granted_by_account_id, u) then
    raise exception using errcode='42501', message='GRANT_NOT_TO_COUNTERPARTY';
  end if;

  if p_channel = 'PHONE' then
    v_owner := g.granted_by_account_id;
    select nullif(btrim(acc.phone),'') into v_phone from public.app_accounts acc where acc.id = v_owner;
    -- SAMO telefon. Bez email-a, bez lokacije, bez ostatka profila.
    return jsonb_build_object(
      'channel','PHONE','agreementId',a.id,'ownerAccountId',v_owner,
      'phone',v_phone,'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
  end if;

  select * into s from public.need_sensitive where need_id = a.need_id;
  if not found then raise exception using errcode='P0002', message='LOCATION_NOT_SET'; end if;
  return jsonb_build_object(
    'channel','EXACT_LOCATION','agreementId',a.id,
    'exactAddress',s.exact_address,'accessNotes',s.access_notes,
    'exactLat',s.exact_lat,'exactLng',s.exact_lng,
    'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
end;
$$;

revoke all on function public.rpc_reveal_contact(uuid,text) from public, anon;
grant execute on function public.rpc_reveal_contact(uuid,text) to authenticated;

comment on function public.rpc_reveal_contact(uuid,text) is
  'Jedini put od directional granta do privatnog podatka. Vraca ISKLJUCIVO trazeni kanal: PHONE grant nikad ne otkriva email ni tacnu lokaciju. Fail-closed na: nije strana, nema granta, opozvan, istekao, izdao ga ne-vlasnik, primalac nije druga strana.';
