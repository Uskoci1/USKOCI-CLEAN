-- Source candidate only. Both endpoints READ; neither ever executes/retries a command.
create function public.rpc_get_need_search_state(p_need_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog'
as $r3_state$
declare
  actor uuid := auth.uid(); n public.needs%rowtype;
  covered integer; missing integer; timed boolean; closing boolean; allowed boolean;
  why text; next_action text; total_agreements integer; active_agreements integer;
  awaiting integer; problems integer; at_now timestamptz := statement_timestamp();
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null then raise exception 'NEED_ID_REQUIRED' using errcode='22023'; end if;
  select * into n from public.needs where id=p_need_id and requester_account_id=actor;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  covered := public.fn_need_covered_slots(n.id);
  missing := greatest(0,n.required_slots-covered);
  timed := private.need_search_time_admitted_v1(n.id,at_now);
  closing := private.closure_account_restricted(actor);
  allowed := n.status in ('PUBLISHED','SELECTION') and missing>0
    and n.remaining_search_closed_at is not null and timed and not closing;
  why := case when closing then 'ACCOUNT_CLOSING'
    when n.status not in ('PUBLISHED','SELECTION','ACTIVE') then 'TASK_NOT_OPEN'
    when missing=0 then 'NO_MISSING_CAPACITY'
    when not timed then 'SEARCH_WINDOW_CLOSED'
    when n.remaining_search_closed_at is null then 'SEARCH_ALREADY_OPEN'
    when n.status not in ('PUBLISHED','SELECTION') then 'TASK_NOT_REOPENABLE'
    else 'CAN_REOPEN' end;
  select count(*)::integer,
    count(*) filter(where a.status in ('CONFIRMED','SUPERSEDED'))::integer,
    count(*) filter(where a.status='CONFIRMED' and x.state='AWAITING_REQUESTER')::integer,
    count(*) filter(where a.status='CONFIRMED' and x.problem_opened_at is not null)::integer
    into total_agreements,active_agreements,awaiting,problems
    from public.agreements a left join public.agreement_execution x on x.agreement_id=a.id
    where a.need_id=n.id;
  -- Navigation guidance only; existing Agreement workspace still authorizes its actions.
  next_action := case when closing then 'REVIEW_ACCOUNT' when why='TASK_NOT_OPEN' then 'VIEW_TASK_HISTORY'
    when problems>0 or awaiting>0 then 'OPEN_AGREEMENTS'
    when allowed then 'REOPEN_SEARCH'
    when active_agreements>0 then 'OPEN_AGREEMENTS'
    when not timed then 'REVIEW_TASK_TIME'
    when n.remaining_search_closed_at is not null then 'REVIEW_TASK'
    when missing>0 then 'SEARCH_IN_PROGRESS' else 'VIEW_TASK' end;
  return jsonb_build_object('schemaVersion',1,'authoritative',true,'serverAsOf',at_now,
    'needId',n.id,'revision',n.revision,'status',n.status,
    'requiredSlots',n.required_slots,'coveredSlots',covered,'missingSlots',missing,
    'searchAuthority',case when n.remaining_search_closed_at is null then 'OPEN' else 'CLOSED' end,
    'closedAt',n.remaining_search_closed_at,'searchTimeAdmitted',timed,
    'canReopen',allowed,'reason',why,'nextAction',next_action,
    'agreementCount',total_agreements,'activeAgreementCount',active_agreements,
    'awaitingConfirmationCount',awaiting,'openProblemCount',problems);
end
$r3_state$;
revoke all on function public.rpc_get_need_search_state(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_need_search_state(uuid) to authenticated;

create function public.rpc_get_reopen_remaining_search_receipt(
  p_need_id uuid,p_expected_revision integer,p_expected_closed_at timestamptz,
  p_client_request_id text,p_reason text default '')
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog'
as $r3_receipt$
declare
  actor uuid := auth.uid(); request_id text:=btrim(coalesce(p_client_request_id,''));
  reason_text text:=left(btrim(coalesce(p_reason,'')),500); request_hash text;
  stored private.remaining_search_close_commands%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision<1
     or p_expected_closed_at is null or not isfinite(p_expected_closed_at)
     or char_length(request_id) not between 8 and 193 then
    raise exception 'SEARCH_RECEIPT_INPUT_INVALID' using errcode='22023';
  end if;
  perform 1 from public.needs where id=p_need_id and requester_account_id=actor;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'command','REOPEN_REMAINING_SEARCH_V1','needId',p_need_id,'expectedRevision',p_expected_revision,
    'reason',reason_text,'expectedClosedAtEpoch',extract(epoch from p_expected_closed_at)
  )::text,'UTF8'),'sha256'),'hex');
  select * into stored from private.remaining_search_close_commands
    where requester_account_id=actor and client_request_id='reopen:'||request_id;
  if not found then
    return jsonb_build_object('authoritative',true,'command','REOPEN_REMAINING_SEARCH_V1',
      'needId',p_need_id,'state','NOT_CONFIRMED','receipt',null);
  end if;
  if stored.request_hash is distinct from request_hash or stored.need_id<>p_need_id
     or stored.result->>'command' is distinct from 'REOPEN_REMAINING_SEARCH_V1'
     or stored.result->'remainingSearchClosed' is distinct from 'false'::jsonb
     or stored.result->'authoritative' is distinct from 'true'::jsonb then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='PT409';
  end if;
  return jsonb_build_object('authoritative',true,'command','REOPEN_REMAINING_SEARCH_V1',
    'needId',p_need_id,'state','CONFIRMED','receipt',stored.result||jsonb_build_object('idempotentReplay',true));
end
$r3_receipt$;
revoke all on function public.rpc_get_reopen_remaining_search_receipt(uuid,integer,timestamptz,text,text) from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_reopen_remaining_search_receipt(uuid,integer,timestamptz,text,text) to authenticated;
