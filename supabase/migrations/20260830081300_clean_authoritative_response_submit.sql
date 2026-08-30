-- Nalaz F, potvrdjen i tezi nego sto je prijavljen.
--
-- marketplace_response_versions ima SAMO SELECT politiku — nijedan prijavljen
-- korisnik ne moze da upise verziju. Uskocer je mogao da napravi red u
-- marketplace_responses (politika je bila ALL), ali nikad i njegovu verziju.
-- Posto izbor zahteva verziju, nijedna prijava nikad nije mogla da bude
-- izabrana. To nije samo nedostatak atomicnosti nego funkcionalni blokator.

create or replace function public.rpc_submit_response(
  p_need_id uuid,
  p_need_revision integer,
  p_worker_profile_id uuid,
  p_covered_slots integer,
  p_price_rsd integer,
  p_proposed_start_at timestamptz,
  p_proposed_end_at timestamptz,
  p_scope_note text,
  p_client_request_id text
) returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  u uuid := auth.uid();
  n public.needs;
  v_resp public.marketplace_responses;
  v_match jsonb;
  v_hash text;
  v_version integer;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id)) < 8 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  -- Profil mora pripadati pozivaocu i biti WORKER profil.
  if not exists (select 1 from public.app_profiles p
                 where p.id = p_worker_profile_id and p.account_id = u and p.kind = 'WORKER') then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  select * into n from public.needs where id = p_need_id for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;
  if n.status not in ('PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_OPEN';
  end if;
  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;
  -- Rok se proverava u istoj transakciji.
  if n.response_deadline is not null and n.response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='RESPONSE_WINDOW_EXPIRED';
  end if;
  -- Prijava se uvek vezuje za TACNU reviziju.
  if n.revision <> p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;
  if p_covered_slots is null or p_covered_slots < 1 or p_covered_slots > n.required_slots then
    raise exception using errcode='22023', message='INVALID_COVERED_SLOTS';
  end if;

  -- Tvrda kvalifikacija i pri slanju, ne samo pri izboru.
  v_match := private.match_detail(p_need_id, p_worker_profile_id);
  if not coalesce((v_match->>'responseAllowed')::boolean,false) then
    raise exception using errcode='P0001', message='WORKER_NOT_ELIGIBLE',
      detail = coalesce((v_match->'hardBlockers')::text,'[]');
  end if;

  -- Idempotencija: isti zahtev ne pravi drugu prijavu.
  select * into v_resp from public.marketplace_responses
   where need_id = p_need_id and worker_account_id = u
     and status not in ('WITHDRAWN','NOT_SELECTED','STALE')
   limit 1;

  v_hash := encode(sha256(convert_to(
      coalesce(p_price_rsd,0)::text||'|'||p_covered_slots::text||'|'||
      coalesce(p_proposed_start_at::text,'')||'|'||coalesce(p_proposed_end_at::text,'')||'|'||
      coalesce(btrim(p_scope_note),'')||'|'||n.revision::text, 'UTF8')),'hex');

  if v_resp.id is null then
    insert into public.marketplace_responses (need_id, worker_account_id, worker_profile_id,
      response_kind, status, submitted_against_need_revision, current_version, covered_slots,
      price_rsd, proposed_start_at, proposed_end_at, scope_note, submitted_at)
    values (p_need_id, u, p_worker_profile_id, 'OFFER', 'SUBMITTED', n.revision, 1,
      p_covered_slots, p_price_rsd, p_proposed_start_at, p_proposed_end_at,
      coalesce(p_scope_note,''), statement_timestamp())
    returning * into v_resp;
    v_version := 1;
  else
    -- Izmena postojece zive prijave: nova verzija, ista prijava.
    v_version := v_resp.current_version + 1;
    update public.marketplace_responses
       set current_version = v_version, status = 'SUBMITTED',
           submitted_against_need_revision = n.revision,
           covered_slots = p_covered_slots, price_rsd = p_price_rsd,
           proposed_start_at = p_proposed_start_at, proposed_end_at = p_proposed_end_at,
           scope_note = coalesce(p_scope_note,''), submitted_at = statement_timestamp()
     where id = v_resp.id returning * into v_resp;
  end if;

  -- Verzija nastaje ATOMSKI sa prijavom, u istoj transakciji.
  insert into public.marketplace_response_versions
    (response_id, version, need_revision, covered_slots, price_rsd,
     proposed_start_at, proposed_end_at, scope_note, content_hash)
  values (v_resp.id, v_version, n.revision, p_covered_slots, p_price_rsd,
     p_proposed_start_at, p_proposed_end_at, coalesce(p_scope_note,''), v_hash);

  update public.opportunity_deliveries
     set status = 'RESPONDED', responded_at = statement_timestamp()
   where need_id = p_need_id and need_revision = n.revision
     and worker_account_id = u and status in ('READY','SEEN');

  return jsonb_build_object('responseId',v_resp.id,'version',v_version,
    'needRevision',n.revision,'contentHash',v_hash,'status',v_resp.status,'authoritative',true);
end;
$$;

revoke all on function public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) from public, anon;
grant execute on function public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) to authenticated;

-- Direktan INSERT vise nije put. Kreiranje ide iskljucivo kroz RPC.
-- UPDATE ostaje dok ne stigne rpc_withdraw_response, da korisnik ne ostane zarobljen.
drop policy if exists responses_worker_all on public.marketplace_responses;
create policy responses_worker_read on public.marketplace_responses
  for select to authenticated using (worker_account_id = auth.uid());
create policy responses_worker_update on public.marketplace_responses
  for update to authenticated
  using (worker_account_id = auth.uid()) with check (worker_account_id = auth.uid());

comment on function public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) is
  'F: atomsko slanje/izmena prijave. Prijava i verzija nastaju u istoj transakciji. Proverava vlasnistvo profila, otvorenost Potrebe, rok, tacnu reviziju i tvrdu kvalifikaciju.';
