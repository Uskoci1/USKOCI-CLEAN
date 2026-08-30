-- Nalazi B + C, oba potvrdjena.
--
-- B: rpc_select_response nije proveravao sposobnosti U TRENUTKU IZBORA.
--    Uskocer je mogao da se prijavi sa kombijem, skloni kombi iz profila,
--    i svejedno bude izabran za Potrebu koja kombi zahteva.
-- C: rok za prijave se sprovodio samo kroz cron. Izmedju dva tick-a izbor je
--    prolazio i posle isteka roka.
--
-- Oba se resavaju u istoj transakciji kao izbor, sa statement_timestamp().

create or replace function public.rpc_select_response(
  p_need_id uuid, p_need_revision integer, p_response_id uuid,
  p_response_version integer, p_content_hash text, p_client_request_id text
) returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  uid uuid := auth.uid();
  v_need public.needs%rowtype;
  v_resp public.marketplace_responses%rowtype;
  v_ver public.marketplace_response_versions%rowtype;
  v_selection_id uuid; v_agreement_id uuid; v_covered integer; v_terms jsonb;
  v_match jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select a.id into v_agreement_id
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
   where s.need_id = p_need_id and s.client_request_id = p_client_request_id;
  if found then return v_agreement_id; end if;

  select * into v_need from public.needs where id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_need.requester_account_id <> uid then raise exception 'NOT_REQUESTER' using errcode = '42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_NOT_OPEN' using errcode = 'P0001', detail = v_need.status; end if;

  -- (C) Rok se proverava u istoj transakciji, ne ceka se cron.
  if v_need.response_deadline is not null
     and v_need.response_deadline <= statement_timestamp() then
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001',
      hint = 'Rok za prijave je istekao.';
  end if;

  if v_need.revision <> p_need_revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'need_revision',
      hint = 'Potreba je izmenjena. Pogledajte prijave ponovo.'; end if;

  select * into v_resp from public.marketplace_responses where id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_resp.need_id <> p_need_id then raise exception 'RESPONSE_NEED_MISMATCH' using errcode = 'P0001'; end if;
  if v_resp.status not in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then
    raise exception 'RESPONSE_NOT_SELECTABLE' using errcode = 'P0001', detail = v_resp.status; end if;

  if v_resp.current_version <> p_response_version then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_version',
      hint = 'Uskocer je izmenio prijavu. Proverite je ponovo.'; end if;

  select * into v_ver from public.marketplace_response_versions
   where response_id = p_response_id and version = p_response_version;
  if not found then raise exception 'RESPONSE_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ver.content_hash <> p_content_hash then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'content_hash',
      hint = 'Uslovi prijave su izmenjeni.'; end if;
  if v_ver.need_revision <> v_need.revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_need_revision'; end if;

  -- (B) Tvrda kvalifikacija se proverava SADA, ne u trenutku prijave.
  -- responseAllowed = nema nijednog hard blokera: profil aktivan, identitet,
  -- alat, dozvole, vozila, iskustvo, iskljucenja, nije sopstvena Potreba.
  v_match := private.match_detail(p_need_id, v_resp.worker_profile_id);
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception 'WORKER_NO_LONGER_ELIGIBLE' using errcode = 'P0001',
      detail = coalesce((v_match->'hardBlockers')::text,'[]'),
      hint = 'Uskocer vise ne ispunjava uslove Potrebe.';
  end if;

  v_covered := public.fn_need_covered_slots(p_need_id);
  if v_covered + v_resp.covered_slots > v_need.required_slots then
    raise exception 'OVERFILL' using errcode = 'P0001',
      hint = 'Ta prijava pokriva vise mesta nego sto je preostalo.'; end if;

  insert into public.need_selections
    (need_id, need_revision, selected_by_account_id, client_request_id, covered_slots,
     response_id, worker_account_id, worker_profile_id, selection_mode, status)
  values (p_need_id, v_need.revision, uid, p_client_request_id, v_resp.covered_slots,
     p_response_id, v_resp.worker_account_id, v_resp.worker_profile_id,
     case when v_need.mode = 'FASTEST' then 'AUTO_FILL' else 'REQUESTER_SELECTS' end,
     'SELECTED')
  returning id into v_selection_id;

  v_terms := jsonb_build_object(
    'price_rsd', v_ver.price_rsd, 'covered_slots', v_ver.covered_slots,
    'proposed_start_at', v_ver.proposed_start_at, 'proposed_end_at', v_ver.proposed_end_at,
    'scope_note', v_ver.scope_note, 'need_revision', v_need.revision,
    'response_version', v_ver.version);

  insert into public.agreements
    (need_id, selection_id, selected_response_id, requester_account_id, requester_profile_id,
     worker_account_id, worker_profile_id, current_version, status)
  values (p_need_id, v_selection_id, p_response_id, v_need.requester_account_id, v_need.requester_profile_id,
     v_resp.worker_account_id, v_resp.worker_profile_id, 1, 'CONFIRMED')
  returning id into v_agreement_id;

  insert into public.agreement_versions
    (agreement_id, version, status, terms, content_hash, created_by_account_id)
  values (v_agreement_id, 1, 'CONFIRMED', v_terms, v_ver.content_hash, uid);

  insert into public.agreement_execution (agreement_id, agreement_version, mode, state)
  values (v_agreement_id, 1,
    case when v_need.schedule_kind = 'REMOTE_ANYTIME' then 'REMOTE' else 'PHYSICAL' end, 'CONFIRMED');

  update public.marketplace_responses
     set status = 'SELECTED', selected_at = statement_timestamp()
   where id = p_response_id;

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs
     set status = case when v_covered + v_resp.covered_slots >= v_need.required_slots
                       then 'ACTIVE' else 'SELECTION' end
   where id = p_need_id;

  return v_agreement_id;
end;
$fn$;

revoke all on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) from public, anon;
grant execute on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) to authenticated;

comment on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) is
  'M02 atomski izbor. Dodato: rok za prijave se proverava u istoj transakciji (C) i tvrda kvalifikacija se revalidira u trenutku izbora (B).';
