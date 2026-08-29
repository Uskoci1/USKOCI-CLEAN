-- Uskladjivanje sa migracijom 14: pokrivenost se sada racuna iz
-- need_selections.status, pa izbor mora da popuni nove kolone, a otkazivanje
-- mora da postavi status='CANCELLED'. Bez ovoga otkazivanje ne oslobadja mesto.

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

  update public.needs
     set status = case when v_covered + v_resp.covered_slots >= v_need.required_slots
                       then 'ACTIVE' else 'SELECTION' end
   where id = p_need_id;

  return v_agreement_id;
end;
$fn$;

revoke all on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) from public, anon;
grant execute on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) to authenticated;

-- Otkazivanje mora da oslobodi mesto u novom izvoru istine.
create or replace function public.rpc_cancel_agreement(p_agreement_id uuid, p_reason text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare uid uuid := auth.uid(); v_agr public.agreements%rowtype;
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

  -- Prijava se vraca u opticaj kao neizabrana.
  update public.marketplace_responses
     set status = 'NOT_SELECTED', selected_at = null
   where id = v_agr.selected_response_id;

  update public.needs n
     set status = case when n.status = 'ACTIVE' then 'SELECTION' else n.status end
   where n.id = v_agr.need_id and public.fn_need_covered_slots(n.id) < n.required_slots;
end;
$fn$;

revoke all on function public.rpc_cancel_agreement(uuid,text) from public, anon;
grant execute on function public.rpc_cancel_agreement(uuid,text) to authenticated;
