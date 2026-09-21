-- PKG-033a: admission parity after task edits (deep read 3.1 / 12.6).
-- No existing data rewrite. No table, trigger, closure-program or privilege changes.
-- Contract: docs/implementation/v5-ai-first/pkg033/PKG033_APPLICATION_ADMISSION.md
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table pkg033a_before(signature text primary key, prosrc text, acl aclitem[], definer boolean, config text[]) on commit drop;
create temporary table pkg033a_patch(ord integer primary key, signature text, anchor text, replacement text) on commit drop;
create temporary table pkg033a_closure(digest text) on commit drop;
do $pre$
declare pin record;
begin
  if to_regprocedure('private.assert_application_price_v5(public.needs,integer,integer)') is not null then raise exception 'PKG033A_ALREADY_APPLIED'; end if;
  for pin in select * from (values
    ('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)','7d8d9673c1de83adfa6667aadc0736e9'),
    ('public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)','77390882ec8d5bd391859447184ed41e'),
    ('public.rpc_select_response(uuid,integer,uuid,integer,text,text)','22a27e65592eb11ce1df486185b08d0a')
  ) pins(signature,digest) loop
    if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG033A_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg033a_before select pin.signature,prosrc,proacl,prosecdef,proconfig from pg_proc where oid=to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
    (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG033A_CLOSURE_SOURCE_NOT_READY'; end if;
  insert into pkg033a_closure values(private.closure_source_digest_v5());
end
$pre$;

create function private.assert_application_price_v5(n public.needs,p_covered_slots integer,p_price_rsd integer)
returns void language plpgsql immutable set search_path='pg_catalog'
as $function$
begin
  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode='22023', message='INVALID_PRICE';
  end if;

  if n.mode = 'MY_PRICE' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode='P0001', message='FIXED_PRICE_NOT_READY';
    end if;
    -- pkg025b. A null basis is the rule this product has always had: the application's price is
    -- the task's price, whatever it covers. A basis says what that price is FOR.
    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = 'TOTAL' then
      -- The price of the whole task, so one application carries the whole task. No split, no
      -- rounding: owner's decision of 2026-09-19. Hiring people separately is what PER_PERSON is for.
      if p_covered_slots <> n.required_slots then
        raise exception using
          errcode='22023',
          message='TOTAL_PRICE_REQUIRES_ALL_SLOTS',
          detail=format('required=%s,covered=%s', n.required_slots, p_covered_slots);
      end if;
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,sent=%s', n.requester_price_rsd, p_price_rsd);
      end if;
    else
      -- Unreachable while the CHECK holds. A basis nobody has reviewed is refused, never guessed.
      raise exception using errcode='22023', message='UNKNOWN_PRICE_BASIS';
    end if;
  end if;

end;
$function$;
revoke all on function private.assert_application_price_v5(public.needs,integer,integer) from public,anon,authenticated,service_role;

insert into pkg033a_patch values
(1,'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)',$a$  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode='22023', message='INVALID_PRICE';
  end if;

  if n.mode = 'MY_PRICE' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode='P0001', message='FIXED_PRICE_NOT_READY';
    end if;
    -- pkg025b. A null basis is the rule this product has always had: the application's price is
    -- the task's price, whatever it covers. A basis says what that price is FOR.
    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = 'TOTAL' then
      -- The price of the whole task, so one application carries the whole task. No split, no
      -- rounding: owner's decision of 2026-09-19. Hiring people separately is what PER_PERSON is for.
      if p_covered_slots <> n.required_slots then
        raise exception using
          errcode='22023',
          message='TOTAL_PRICE_REQUIRES_ALL_SLOTS',
          detail=format('required=%s,covered=%s', n.required_slots, p_covered_slots);
      end if;
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,sent=%s', n.requester_price_rsd, p_price_rsd);
      end if;
    else
      -- Unreachable while the CHECK holds. A basis nobody has reviewed is refused, never guessed.
      raise exception using errcode='22023', message='UNKNOWN_PRICE_BASIS';
    end if;
  end if;
$a$,$b$  perform private.assert_application_price_v5(n, p_covered_slots, p_price_rsd);
$b$),
(2,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)',$a$  v_match jsonb;$a$,$b$  v_match jsonb;
  v_profile public.app_profiles;
  v_selected_slots integer;
  v_remaining_slots integer;$b$),
(3,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)',$a$    if not exists (
      select 1 from public.app_profiles p
       where p.id = v_response.worker_profile_id
         and p.account_id = v_actor
         and p.kind = 'WORKER'
    ) then
      raise exception 'PROFILE_NOT_OWNED_BY_ACCOUNT' using errcode='42501';
    end if;

    v_match := private.match_detail(v_need.id, v_response.worker_profile_id);
    if not coalesce((v_match->>'responseAllowed')::boolean,false) then
      raise exception 'WORKER_NOT_ELIGIBLE' using errcode='P0001', detail=coalesce((v_match->'hardBlockers')::text,'[]');
    end if;

$a$,$b$    -- PKG-033: reconfirmation is an application to today's task, not a bypass.
    -- Withdrawal stays possible without a ready profile or matching world.
    if not private.accounts_same_world(v_need.requester_account_id, v_actor) then
      raise exception 'NEED_NOT_FOUND' using errcode='P0002';
    end if;
    if v_need.response_deadline is not null and v_need.response_deadline <= statement_timestamp() then
      raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode='22023';
    end if;
    select * into v_profile from public.app_profiles p
      where p.id = v_response.worker_profile_id for update;
    if not found or v_profile.account_id <> v_actor or v_profile.kind <> 'WORKER' then
      raise exception 'PROFILE_NOT_OWNED_BY_ACCOUNT' using errcode='42501';
    end if;
    if v_profile.profile_status is distinct from 'ACTIVE'
       or char_length(btrim(coalesce(v_profile.display_name,''))) < 2
       or char_length(btrim(coalesce(v_profile.city,''))) < 2
       or cardinality(coalesce(v_profile.skills,'{}')) < 1 then
      raise exception 'WORKER_PROFILE_NOT_READY' using errcode='P0001';
    end if;
    select coalesce(sum(s.covered_slots),0)::integer into v_selected_slots
      from public.need_selections s where s.need_id=v_need.id and s.status='SELECTED';
    v_remaining_slots := greatest(0, v_need.required_slots-v_selected_slots);
    if v_remaining_slots < 1 then raise exception 'NEED_FULL' using errcode='P0001'; end if;

$b$),
(4,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)',$a$    if v_covered is null or v_covered < 1 or v_covered > v_need.required_slots then
      raise exception 'INVALID_COVERED_SLOTS' using errcode='22023';
    end if;
    if v_price is null or v_price <= 0 then raise exception 'INVALID_PRICE' using errcode='22023'; end if;
    if v_end is not null and v_start is not null and v_end <= v_start then raise exception 'INVALID_PROPOSED_WINDOW' using errcode='22023'; end if;
    if char_length(coalesce(v_note,'')) > 1200 then raise exception 'SCOPE_NOTE_TOO_LONG' using errcode='22023'; end if;

$a$,$b$    if v_covered is null or v_covered < 1 then
      raise exception 'INVALID_COVERED_SLOTS' using errcode='22023';
    end if;
    if v_covered > v_profile.team_capacity then
      raise exception 'TEAM_CAPACITY_EXCEEDED' using errcode='22023';
    end if;
    if v_covered > v_remaining_slots then
      raise exception 'NEED_REMAINING_CAPACITY_EXCEEDED' using errcode='22023';
    end if;
    perform private.assert_application_price_v5(v_need, v_covered, v_price);
    if (v_start is null) <> (v_end is null)
       or (v_start is not null and v_end is not null and v_start >= v_end) then
      raise exception 'INVALID_PROPOSED_INTERVAL' using errcode='22023';
    end if;
    if char_length(coalesce(v_note,'')) > 1200 then raise exception 'SCOPE_NOTE_TOO_LONG' using errcode='22023'; end if;
    if v_start is null and v_need.schedule_kind='FIXED_WINDOW'
      and (v_need.starts_at is null or v_need.ends_at is null or not isfinite(v_need.starts_at)
        or not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at) then
      raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
    end if;
    v_match := private.match_detail_for_calendar_interval(v_need.id, v_response.worker_profile_id,
      coalesce(v_start,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.starts_at end),
      coalesce(v_end,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.ends_at end));
    if not coalesce((v_match->>'responseAllowed')::boolean,false) then
      raise exception 'WORKER_NOT_ELIGIBLE' using errcode='P0001', detail=coalesce((v_match->'hardBlockers')::text,'[]');
    end if;

$b$),
(5,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)',$a$    v_content_hash := encode(extensions.digest(convert_to(
      v_price::text || '|' || v_covered::text || '|' ||
      coalesce(v_start::text,'') || '|' || coalesce(v_end::text,'') || '|' ||
      coalesce(btrim(v_note),'') || '|' || v_need.revision::text,
      'UTF8'), 'sha256'), 'hex');

$a$,$b$  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', v_need.revision,
    'pricingMode', v_need.mode,
    'priceRsd', v_price,
    'coveredSlots', v_covered,
    'proposedStartAt', v_start,
    'proposedEndAt', v_end,
    'scopeNote', coalesce(btrim(v_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', to_jsonb(v_profile.tools),
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', to_jsonb(v_profile.vehicles)
  )::text, 'UTF8')), 'hex');

$b$),
(6,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)',$a$      v_start, v_end, coalesce(v_note,''), v_content_hash
    );
$a$,$b$      v_start, v_end, coalesce(v_note,''), v_content_hash
    );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_response.id, v_new_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, v_covered,
    v_need.required_slots, v_selected_slots, v_remaining_slots,
    v_need.mode, v_need.requester_price_rsd,
    v_profile.skills, v_profile.tools, v_profile.licenses, v_profile.vehicles
  );

$b$),
(7,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)',$a$  if v_action = 'WITHDRAW' then
$a$,$b$  if v_action = 'WITHDRAW' then
    update public.notification_deliveries d set state='EXPIRED'
      from public.user_activity_events e
      where d.event_id=e.id and e.entity_type='RESPONSE' and e.entity_id=v_response.id
        and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');
$b$),
(8,'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)',$a$     returning * into v_response;

    v_result := jsonb_build_object($a$,$b$     returning * into v_response;

    perform private.emit_event(v_need.requester_account_id,'REQUESTER','RESPONSE_WITHDRAWN',
      'RESPONSE',v_response.id,v_response.current_version,
      'Prijava je povučena','Prijava za tvoj zadatak je povučena.',
      'response-withdrawn:'||v_response.id::text||':'||v_response.current_version::text,
      'NORMAL',jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision),null);
    if (v_need.response_deadline is null or v_need.response_deadline > statement_timestamp())
       and public.fn_need_covered_slots(v_need.id) < v_need.required_slots then
      perform private.enqueue_dispatch(v_need.id,statement_timestamp());
    end if;

    v_result := jsonb_build_object($b$),
(9,'public.rpc_select_response(uuid,integer,uuid,integer,text,text)',$a$  select * into v_policy
$a$,$b$  -- PKG-033: historical/reconfirmed offers cannot bypass today's fixed-price rule at selection.
  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);

  select * into v_policy
$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg033a_patch order by ord loop
    def:=pg_get_functiondef(to_regprocedure(p.signature));
    if length(def)-length(replace(def,p.anchor,''))<>length(p.anchor) then raise exception 'PKG033A_ANCHOR: % #%',p.signature,p.ord; end if;
    execute replace(def,p.anchor,p.replacement);
  end loop;
end
$patch$;
do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg033a_before loop
    expected:=s.prosrc;
    for p in select * from pkg033a_patch where signature=s.signature order by ord loop
      expected:=replace(expected,p.anchor,p.replacement);
    end loop;
    select prosrc,proacl,prosecdef,proconfig into actual from pg_proc where oid=to_regprocedure(s.signature);
    if md5(actual.prosrc) is distinct from md5(expected) or actual.prosrc is distinct from expected then raise exception 'PKG033A_BODY_MISMATCH: %',s.signature; end if;
    if (actual.proacl,actual.prosecdef,actual.proconfig) is distinct from (s.acl,s.definer,s.config) then raise exception 'PKG033A_AUTHORITY_CHANGED: %',s.signature; end if;
  end loop;
  if (select md5(prosrc) from pg_proc where oid='private.assert_application_price_v5(public.needs,integer,integer)'::regprocedure)
     is distinct from md5($expected$
begin
  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode='22023', message='INVALID_PRICE';
  end if;

  if n.mode = 'MY_PRICE' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode='P0001', message='FIXED_PRICE_NOT_READY';
    end if;
    -- pkg025b. A null basis is the rule this product has always had: the application's price is
    -- the task's price, whatever it covers. A basis says what that price is FOR.
    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = 'TOTAL' then
      -- The price of the whole task, so one application carries the whole task. No split, no
      -- rounding: owner's decision of 2026-09-19. Hiring people separately is what PER_PERSON is for.
      if p_covered_slots <> n.required_slots then
        raise exception using
          errcode='22023',
          message='TOTAL_PRICE_REQUIRES_ALL_SLOTS',
          detail=format('required=%s,covered=%s', n.required_slots, p_covered_slots);
      end if;
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,sent=%s', n.requester_price_rsd, p_price_rsd);
      end if;
    else
      -- Unreachable while the CHECK holds. A basis nobody has reviewed is refused, never guessed.
      raise exception using errcode='22023', message='UNKNOWN_PRICE_BASIS';
    end if;
  end if;

end;
$expected$) then raise exception 'PKG033A_HELPER_BODY_MISMATCH'; end if;
  if has_function_privilege('anon','private.assert_application_price_v5(public.needs,integer,integer)','EXECUTE')
     or has_function_privilege('authenticated','private.assert_application_price_v5(public.needs,integer,integer)','EXECUTE')
     or has_function_privilege('service_role','private.assert_application_price_v5(public.needs,integer,integer)','EXECUTE') then raise exception 'PKG033A_HELPER_EXPOSED'; end if;
  if private.closure_source_digest_v5() is distinct from (select digest from pkg033a_closure)
    or not private.retention_ai_source_ready() then raise exception 'PKG033A_CHANGED_CLOSURE_SOURCE'; end if;
end
$post$;
notify pgrst,'reload schema';
commit;
