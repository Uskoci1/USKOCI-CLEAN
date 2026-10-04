-- EX-06E Lifecycle Recovery — SOURCE CANDIDATE ONLY / NOT APPLIED TO LIVE DEV.
-- Scope:
--   * keep coverage independent from requester search authority;
--   * make remaining_search_closed_at a hard dispatch stop;
--   * keep Agreement cancellation from silently reopening a requester-closed search;
--   * stop cancellation/replacement matching after the admitted execution/replacement time window;
--   * add one canonical requester-owned reopen command with replay-safe receipt semantics.
-- No new Need status, no event vocabulary change, no response-deadline product expansion, no parallel execution FSM.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table ex06e_before(
  signature text primary key,
  prosrc text not null,
  metadata jsonb not null
) on commit drop;

create temporary table ex06e_patch(
  ord integer primary key,
  signature text not null,
  anchor text not null,
  replacement text not null
) on commit drop;

create temporary table ex06e_closure(digest text not null) on commit drop;

do $pre$
declare r record;
begin
  if to_regprocedure('private.need_search_time_admitted_v1(uuid,timestamptz)') is not null
     or to_regprocedure('public.rpc_reopen_remaining_search(uuid,integer,text,text)') is not null then
    raise exception 'EX06E_ALREADY_OR_PARTIALLY_APPLIED';
  end if;

  for r in
    select * from (values
      ('private.dispatch_next_wave(uuid)', '1fd8c51ef026ece24471e2f68250ecc5'),
      ('private.dispatch_tick(integer,timestamptz)', 'e568b033b9457736869fc5829ffc5511'),
      ('private.guard_remaining_search_close_fields()', 'ce59ad1cdee98518950e289aa5c329a4'),
      ('public.rpc_cancel_agreement(uuid,text)', 'f3ca4d5f8bdf324d5773d887d0a2d093')
    ) x(signature, expected_md5)
  loop
    if to_regprocedure(r.signature) is null then
      raise exception 'EX06E_TARGET_MISSING: %', r.signature;
    end if;
    if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_md5 then
      raise exception 'EX06E_PREDECESSOR_DRIFT: %', r.signature;
    end if;
    insert into ex06e_before(signature,prosrc,metadata)
    select r.signature,p.prosrc,to_jsonb(p)-'prosrc'
    from pg_proc p where p.oid=to_regprocedure(r.signature);
  end loop;

  if to_regprocedure('private.relative_schedule_end_v5(text,timestamptz,text)') is null then
    raise exception 'EX06E_RELATIVE_TIME_HELPER_MISSING';
  end if;

  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06E_CLOSURE_NOT_READY';
  end if;
  insert into ex06e_closure values(private.closure_source_digest_v5());
end
$pre$;

create function private.need_search_time_admitted_v1(
  p_need_id uuid,
  p_at timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $fn$
declare
  n public.needs%rowtype;
  execution_end timestamptz;
  replacement_until timestamptz;
  candidate_end timestamptz;
  r record;
begin
  if p_need_id is null or p_at is null then return false; end if;

  select * into n from public.needs where id=p_need_id;
  if not found then return false; end if;

  -- Existing response_deadline stays an authority when present, but EX06E does not expose or extend it as a new V1 feature.
  if n.response_deadline is not null and n.response_deadline <= p_at then
    return false;
  end if;

  execution_end := case
    when n.schedule_kind='FIXED_WINDOW' then coalesce(n.ends_at,n.starts_at)
    when n.schedule_kind in ('TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE')
      then private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone)
    else null
  end;

  if execution_end is not null and p_at <= execution_end then
    return true;
  end if;

  -- Replacement is bounded by the accepted window of a cancelled Agreement when that window exists.
  -- Malformed historical JSON never opens a window and never aborts cancellation.
  for r in
    select v.terms->>'proposed_end_at' raw_end
    from public.agreements a
    join public.agreement_versions v
      on v.agreement_id=a.id and v.version=a.current_version
    where a.need_id=n.id
      and a.status='CANCELLED'
      and jsonb_typeof(v.terms->'proposed_end_at')='string'
  loop
    begin
      candidate_end := r.raw_end::timestamptz;
    exception when others then
      candidate_end := null;
    end;
    if candidate_end is not null then
      replacement_until := greatest(
        coalesce(replacement_until,candidate_end + interval '24 hours'),
        candidate_end + interval '24 hours'
      );
    end if;
  end loop;

  -- Unscheduled FLEXIBLE/REMOTE work has no bounded execution end to invent.
  if execution_end is null and replacement_until is null then
    return true;
  end if;

  return replacement_until is not null and p_at <= replacement_until;
end
$fn$;
revoke all on function private.need_search_time_admitted_v1(uuid,timestamptz) from public,anon,authenticated,service_role;

insert into ex06e_patch values
(1,'private.dispatch_next_wave(uuid)',
$anchor$  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;
$anchor$,
$replacement$  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;

  if n.remaining_search_closed_at is not null then
    return jsonb_build_object('status','STOPPED','reason','REMAINING_SEARCH_CLOSED','inserted',0);
  end if;

  if not private.need_search_time_admitted_v1(n.id, statement_timestamp()) then
    return jsonb_build_object('status','STOPPED','reason','SEARCH_WINDOW_CLOSED','inserted',0);
  end if;
$replacement$),
(2,'private.dispatch_tick(integer,timestamptz)',
$anchor$      elsif reason in ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                       'RESPONSE_TARGET_AND_COVERAGE_REACHED') then
$anchor$,
$replacement$      elsif reason in ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                       'RESPONSE_TARGET_AND_COVERAGE_REACHED','REMAINING_SEARCH_CLOSED',
                       'SEARCH_WINDOW_CLOSED') then
$replacement$),
(3,'private.guard_remaining_search_close_fields()',
$anchor$    if current_setting('uskoci.need_lifecycle', true) is distinct from 'CLOSE_REMAINING_SEARCH' then
      raise exception 'REMAINING_SEARCH_STATE_IS_SERVER_OWNED' using errcode='42501';
    end if;
$anchor$,
$replacement$    if current_setting('uskoci.need_lifecycle', true) is distinct from 'CLOSE_REMAINING_SEARCH'
       and current_setting('uskoci.need_lifecycle', true) is distinct from 'REOPEN_REMAINING_SEARCH' then
      raise exception 'REMAINING_SEARCH_STATE_IS_SERVER_OWNED' using errcode='42501';
    end if;
$replacement$),
(4,'public.rpc_cancel_agreement(uuid,text)',
$anchor$  if v_covered < v_need.required_slots
     and v_need.status in ('ACTIVE','SELECTION')
     and not private.closure_account_restricted(v_need.requester_account_id) then
    perform set_config('uskoci.need_lifecycle', 'CANCEL_AGREEMENT', true);
    update public.needs set status = 'SELECTION' where id = v_need.id;
    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
$anchor$,
$replacement$  if v_covered < v_need.required_slots
     and v_need.status in ('ACTIVE','SELECTION')
     and not private.closure_account_restricted(v_need.requester_account_id) then
    -- Coverage truth changes even when search authority says do not search.
    perform set_config('uskoci.need_lifecycle', 'CANCEL_AGREEMENT', true);
    update public.needs set status = 'SELECTION' where id = v_need.id;

    -- Human search authority is independent from coverage. Cancellation never clears it.
    -- Time authority is also independent: no matching is reanimated after the admitted window.
    if v_need.remaining_search_closed_at is null
       and private.need_search_time_admitted_v1(v_need.id, statement_timestamp()) then
      perform private.enqueue_dispatch(v_need.id, statement_timestamp());
    end if;
  end if;
$replacement$);

do $patch$
declare p record; def text;
begin
  for p in select * from ex06e_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def)-length(replace(def,p.anchor,''))) <> length(p.anchor) then
      raise exception 'EX06E_ANCHOR_NOT_UNIQUE: % #% ',p.signature,p.ord;
    end if;
    execute replace(def,p.anchor,p.replacement);
  end loop;
end
$patch$;

create function public.rpc_reopen_remaining_search(
  p_need_id uuid,
  p_expected_revision integer,
  p_client_request_id text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $fn$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id,''));
  v_reason text := left(btrim(coalesce(p_reason,'')),500);
  v_request_hash text;
  v_existing private.remaining_search_close_commands%rowtype;
  v_need public.needs%rowtype;
  v_selected_slots integer := 0;
  v_remaining integer := 0;
  v_at timestamptz := statement_timestamp();
  v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'NEED_ID_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 193 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  v_request_hash := encode(
    extensions.digest(convert_to(jsonb_build_object(
      'needId',p_need_id,'expectedRevision',p_expected_revision,'reason',v_reason
    )::text,'UTF8'),'sha256'),'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\\n' || v_request_id, 4411));

  select * into v_existing
  from private.remaining_search_close_commands c
  where c.requester_account_id=v_actor and c.client_request_id='reopen:'||v_request_id
  for update;
  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay',true);
  end if;

  select * into v_need from public.needs n where n.id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id <> v_actor then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision <> p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  if v_need.remaining_search_closed_at is null then
    raise exception 'REMAINING_SEARCH_ALREADY_OPEN' using errcode='P0001';
  end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_REMAINING_SEARCH_NOT_REOPENABLE' using errcode='P0001';
  end if;

  select coalesce(sum(s.covered_slots),0)::integer into v_selected_slots
  from public.need_selections s
  where s.need_id=v_need.id and s.status='SELECTED';

  v_remaining := greatest(v_need.required_slots-v_selected_slots,0);
  if v_remaining < 1 then raise exception 'NO_REMAINING_SEARCH' using errcode='P0001'; end if;
  if not private.need_search_time_admitted_v1(v_need.id,v_at) then
    raise exception 'REMAINING_SEARCH_REOPEN_WINDOW_CLOSED' using errcode='P0001';
  end if;
  if private.closure_account_restricted(v_actor) then
    raise exception 'ACCOUNT_CLOSING' using errcode='P0001';
  end if;

  perform set_config('uskoci.need_lifecycle','REOPEN_REMAINING_SEARCH',true);
  update public.needs
     set remaining_search_closed_at=null,
         remaining_search_closed_by_account_id=null,
         remaining_search_close_reason=null,
         updated_at=v_at
   where id=v_need.id;
  perform set_config('uskoci.need_lifecycle','',true);

  perform private.enqueue_dispatch(v_need.id,v_at);

  perform private.audit_marketplace(
    v_actor,'REMAINING_SEARCH_REOPENED','NEED',v_need.id,v_need.revision,
    jsonb_build_object(
      'requiredSlots',v_need.required_slots,
      'selectedSlots',v_selected_slots,
      'reopenedRemainingSlots',v_remaining,
      'reasonProvided',v_reason<>''
    )
  );

  v_result := jsonb_build_object(
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'requiredSlots',v_need.required_slots,
    'selectedSlots',v_selected_slots,
    'reopenedRemainingSlots',v_remaining,
    'remainingSearchClosed',false,
    'reopenedAt',v_at,
    'idempotentReplay',false,
    'authoritative',true
  );

  insert into private.remaining_search_close_commands(
    requester_account_id,client_request_id,request_hash,need_id,need_revision,result
  ) values(v_actor,'reopen:'||v_request_id,v_request_hash,v_need.id,v_need.revision,v_result);

  return v_result;
end
$fn$;

revoke all on function public.rpc_reopen_remaining_search(uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.rpc_reopen_remaining_search(uuid,integer,text,text) to authenticated;

do $post$
declare r record; actual jsonb;
begin
  for r in select * from (values
    ('private.dispatch_next_wave(uuid)', 'c37d672ccaf44e86b5e83b117156cdb8'),
    ('private.dispatch_tick(integer,timestamptz)', '8798cb6b6f004ecd5d88dd472cd6de0b'),
    ('private.guard_remaining_search_close_fields()', 'c2d5e8ad7398f25a026d9bfd333efa8b'),
    ('public.rpc_cancel_agreement(uuid,text)', 'f23a499bdd57d68476c126232645a139')
  ) x(signature, expected_md5)
  loop
    if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_md5 then
      raise exception 'EX06E_POST_BODY_MISMATCH: %',r.signature;
    end if;
    select to_jsonb(p)-'prosrc' into actual from pg_proc p where p.oid=to_regprocedure(r.signature);
    if actual is distinct from (select metadata from ex06e_before where signature=r.signature) then
      raise exception 'EX06E_TARGET_METADATA_CHANGED: %',r.signature;
    end if;
  end loop;

  if not has_function_privilege('authenticated','public.rpc_reopen_remaining_search(uuid,integer,text,text)','EXECUTE')
     or has_function_privilege('anon','public.rpc_reopen_remaining_search(uuid,integer,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_reopen_remaining_search(uuid,integer,text,text)','EXECUTE') then
    raise exception 'EX06E_REOPEN_GRANTS_WRONG';
  end if;
  if has_function_privilege('authenticated','private.need_search_time_admitted_v1(uuid,timestamptz)','EXECUTE')
     or has_function_privilege('anon','private.need_search_time_admitted_v1(uuid,timestamptz)','EXECUTE') then
    raise exception 'EX06E_TIME_HELPER_EXPOSED';
  end if;

  if private.closure_source_digest_v5() is distinct from (select digest from ex06e_closure)
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
     or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06E_CLOSURE_MOVED';
  end if;
end
$post$;

notify pgrst,'reload schema';
commit;
