-- PKG-023a: own reads, bounded and paged (V3 third slice, A + C).
--
-- NOT APPLIED ANYWHERE. A candidate for canonical DEV, proven only on a disposable database
-- (.github/workflows/pkg023-v3-reads-and-pin-proof.yml). Applying it needs the owner's own word.
--
-- Today an account reads all of its tasks (a direct table read), all of its applications
-- (rpc_list_my_applications) and all of its Dogovori (rpc_list_my_agreements), whole, to show ten rows.
-- This adds three paged readers beside them. Nothing that exists is altered or dropped, so an installed
-- APK keeps calling what it calls today and receives what it receives today.
--
-- Paging contract, the one rpc_list_inbox already uses:
--   p_limit 1..100; p_before_at and p_before_id together or not at all, else INVALID_PAGE (22023);
--   keyset (sort_at, id) < (p_before_at, p_before_id), order sort_at desc, id desc, limit p_limit + 1;
--   returns { items, hasMore, asOf }; each item carries sortAt and id, which are the next cursor.
--   asOf is when the page was read. It is not a snapshot and does not parameterise later pages: what
--   makes the pages consistent is the sort key, which no server function rewrites after insert:
--     tasks         needs.created_at                  (the owner can rewrite it on an own DRAFT through
--                                                      the table grant; that reorders that owner's list
--                                                      and nobody else's)
--     applications  marketplace_responses.created_at  (NOT submitted_at: rpc_submit_response and
--                                                      rpc_resolve_stale_response_after_need_edit
--                                                      rewrite submitted_at on a re-submission)
--     Dogovori      agreements.created_at             (no client UPDATE policy, no server writer)
--
-- p_scope: ALL | ACTIVE | HISTORY, else INVALID_SCOPE. The vocabularies are the live CHECK constraints.
--
-- C: the Dogovor page carries pendingChange = null | { id, proposedByMe, createdAt }. The start instant
-- was already in rpc_list_my_agreements; ordering by it is a client mapping and needs nothing here.
--
-- Closure source digest: this candidate adds functions and one plain index. Tables, columns,
-- constraints, triggers and the erasure program are untouched, and the candidate proves it on itself:
-- it raises if private.closure_source_digest_v5() is different after it than before it.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg023a_predecessor(source_digest text) on commit drop;

do $pre$
begin
  -- The paged readers restate the payload and the state vocabulary of their unpaged siblings. They
  -- are written against these exact bodies; a different body means the restatement must be re-read.
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.rpc_list_my_applications()'::regprocedure)
       is distinct from '6ce809c2939714451e60876ab3885115'
     or (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.rpc_list_my_agreements()'::regprocedure)
       is distinct from 'f4c56eca5c3c247ffb284e91265d81b0' then
    raise exception 'PKG023A_PREDECESSOR_DRIFT';
  end if;
  if to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)') is not null
     or to_regprocedure('public.rpc_list_my_applications_page(text,integer,timestamptz,uuid)') is not null
     or to_regprocedure('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)') is not null
     or to_regprocedure('private.my_application_state(text,integer,integer,text,boolean)') is not null then
    raise exception 'PKG023A_ALREADY_APPLIED';
  end if;
  insert into pkg023a_predecessor values (private.closure_source_digest_v5());
end
$pre$;

-- The exact CASE of rpc_list_my_applications, in one place, so the paged read and the relation read
-- (pkg023b) cannot drift apart. The unpaged function keeps its own inline copy, untouched.
create function private.my_application_state(
  p_raw_status text, p_submitted_revision integer, p_current_revision integer, p_need_status text, p_has_agreement boolean
) returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case
    when p_has_agreement or p_raw_status = 'SELECTED' then 'SELECTED'
    when p_raw_status = 'WITHDRAWN' then 'WITHDRAWN'
    when p_raw_status in ('STALE','STALE_REVIEW_REQUIRED')
         or p_submitted_revision is distinct from p_current_revision then 'STALE_REVIEW_REQUIRED'
    when p_raw_status in ('NOT_SELECTED','EXPIRED')
         or p_need_status not in ('PUBLISHED','SELECTION') then 'CLOSED'
    when p_raw_status = 'VIEWED' then 'VIEWED'
    when p_raw_status = 'SHORTLISTED' then 'SHORTLISTED'
    when p_raw_status in ('SUBMITTED','DELIVERED') then 'SUBMITTED'
    else 'CLOSED'
  end
$function$;

-- My tasks. SECURITY INVOKER on purpose: today this read stands on RLS (needs_owner_select and the
-- restrictive closed-account policy), and an invoker function inherits exactly those policies instead
-- of restating them. The application count is what the owner's embedded read counts today, under the
-- same policies of marketplace_responses.
create function public.rpc_list_my_needs_page(
  p_scope text default 'ALL', p_limit integer default 30,
  p_before_at timestamptz default null, p_before_id uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(q.item order by q.created_at desc, q.id desc), '[]'::jsonb) into v_items
  from (
    select n.created_at, n.id, jsonb_build_object(
      'id', n.id, 'sortAt', n.created_at, 'revision', n.revision,
      'title', n.title, 'description', n.description, 'category', n.category, 'status', n.status,
      'urgent', n.urgent, 'scheduleKind', n.schedule_kind, 'startsAt', n.starts_at, 'endsAt', n.ends_at,
      'taskCountryCode', n.task_country_code, 'taskTimezone', n.task_timezone,
      'executionLocationMode', n.execution_location_mode,
      'approximateArea', n.approximate_area, 'approximateCity', n.approximate_city,
      'requiredSlots', n.required_slots, 'coveredSlots', n.covered_slots,
      'requiredSkills', to_jsonb(n.required_skills), 'requiredTools', to_jsonb(n.required_tools),
      'requiredVehicles', to_jsonb(n.required_vehicles), 'requiredLicenses', to_jsonb(n.required_licenses),
      'minimumExperienceYears', n.minimum_experience_years,
      'verifiedIdentityRequired', n.verified_identity_required,
      'mode', n.mode, 'requesterPriceRsd', n.requester_price_rsd,
      'applicationCount', (select count(*) from public.marketplace_responses r where r.need_id = n.id),
      'publicTopology', (select g.public_topology from public.need_geography g where g.need_id = n.id),
      'criticalConditions', (select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id = n.id)
    ) as item
    from public.needs n
    where n.requester_account_id = v_uid
      and (p_scope = 'ALL' or (p_scope = 'ACTIVE') = (n.status in ('DRAFT','PUBLISHED','SELECTION','ACTIVE')))
      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))
    order by n.created_at desc, n.id desc
    limit p_limit + 1
  ) q;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$;

-- My applications. Definer, as its sibling: it must read a task that has left PUBLISHED, which RLS
-- hides from the applicant. Own rows only: worker_account_id = auth.uid().
create function public.rpc_list_my_applications_page(
  p_scope text default 'ALL', p_limit integer default 30,
  p_before_at timestamptz default null, p_before_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  with own_rows as (
    select
      r.id as application_id, r.created_at as sort_at, r.need_id,
      n.revision as current_need_revision, r.submitted_against_need_revision, r.current_version,
      r.status as raw_response_status, r.price_rsd, r.covered_slots, r.scope_note, r.submitted_at,
      n.title, n.description, n.status as raw_need_status, n.approximate_city, n.approximate_area, n.starts_at,
      ag.id as agreement_id, ag.live as agreement_live
    from public.marketplace_responses r
    join public.needs n on n.id = r.need_id
    left join lateral (
      select a.id, coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER') as live
        from public.agreements a
        left join public.agreement_execution ae on ae.agreement_id = a.id
       where a.selected_response_id = r.id
       order by a.created_at desc, a.id desc
       limit 1
    ) ag on true
    where r.worker_account_id = v_actor
      and r.status <> 'DRAFT'
  ), mapped as (
    select o.*, private.my_application_state(
      o.raw_response_status, o.submitted_against_need_revision, o.current_need_revision,
      o.raw_need_status, o.agreement_id is not null) as application_state
    from own_rows o
  ), scoped as (
    select m.*,
      (m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED')
        or (m.application_state = 'SELECTED' and coalesce(m.agreement_live, true))) as is_active
    from mapped m
  )
  select coalesce(jsonb_agg(q.item order by q.sort_at desc, q.application_id desc), '[]'::jsonb) into v_items
  from (
    select s.sort_at, s.application_id, jsonb_build_object(
      'applicationId', s.application_id, 'id', s.application_id, 'sortAt', s.sort_at,
      'needId', s.need_id, 'needRevision', s.current_need_revision,
      'submittedNeedRevision', s.submitted_against_need_revision, 'version', s.current_version,
      'state', s.application_state, 'title', s.title, 'description', s.description,
      'approximateCity', nullif(btrim(s.approximate_city), ''), 'approximateArea', nullif(btrim(s.approximate_area), ''),
      'startsAt', s.starts_at, 'priceRsd', s.price_rsd, 'coveredSlots', s.covered_slots,
      'scopeNote', coalesce(s.scope_note, ''), 'agreementId', s.agreement_id,
      'requiresStaleReview', s.application_state = 'STALE_REVIEW_REQUIRED',
      'attentionRequired', s.application_state in ('STALE_REVIEW_REQUIRED','SELECTED'),
      'canWithdraw',
        s.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
        and s.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
        and s.submitted_against_need_revision = s.current_need_revision
        and s.raw_need_status in ('PUBLISHED','SELECTION')
        and s.agreement_id is null,
      'submittedAt', s.submitted_at
    ) as item
    from scoped s
    where (p_scope = 'ALL' or (p_scope = 'ACTIVE') = s.is_active)
      and (p_before_at is null or (s.sort_at, s.application_id) < (p_before_at, p_before_id))
    order by s.sort_at desc, s.application_id desc
    limit p_limit + 1
  ) q;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$;

-- My Dogovori, both sides. Definer, as its sibling, with the same participant condition and the same
-- phone rule. pendingChange is the one addition (C).
create function public.rpc_list_my_agreements_page(
  p_scope text default 'ALL', p_limit integer default 30,
  p_before_at timestamptz default null, p_before_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(x.payload order by x.created_at desc, x.id desc), '[]'::jsonb) into v_items
  from (
    select a.created_at, a.id,
      jsonb_build_object(
        'id', a.id, 'sortAt', a.created_at,
        'currentVersion', a.current_version,
        'status', coalesce(ae.state, a.status),
        'agreementStatus', a.status,
        'title', n.title,
        'approximateArea', n.approximate_area,
        'approximateCity', n.approximate_city,
        'requiredSlots', n.required_slots,
        'startsAt', n.starts_at,
        'terms', av.terms,
        'requesterAccountId', a.requester_account_id,
        'workerAccountId', a.worker_account_id,
        'requesterName', rp.display_name,
        'workerName', wp.display_name,
        'executionMode', ae.mode,
        'requesterDeadlineAt', ae.requester_deadline_at,
        'problemOpened', (ae.problem_opened_at is not null),
        'myPhoneShared', exists (
          select 1 from public.access_grants g
           where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_by_account_id = v_uid
             and g.status = 'GRANTED' and (g.expires_at is null or g.expires_at > statement_timestamp())),
        'theirPhone', case
          when a.status = 'CONFIRMED' and exists (
            select 1 from public.access_grants g
             where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_to_account_id = v_uid
               and g.status = 'GRANTED' and (g.expires_at is null or g.expires_at > statement_timestamp())
          ) then (
            select nullif(btrim(acc.phone), '') from public.app_accounts acc
             where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end)
          else null
        end,
        'pendingChange', (
          select jsonb_build_object('id', c.id, 'proposedByMe', c.proposed_by_account_id = v_uid, 'createdAt', c.created_at)
            from public.agreement_change_proposals c
           where c.agreement_id = a.id and c.status = 'PENDING'
           order by c.created_at desc, c.id desc
           limit 1),
        'createdAt', a.created_at
      ) as payload
    from public.agreements a
    join public.agreement_versions av on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
    where v_uid in (a.requester_account_id, a.worker_account_id)
      and (p_scope = 'ALL' or (p_scope = 'ACTIVE') = (coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')))
      and (p_before_at is null or (a.created_at, a.id) < (p_before_at, p_before_id))
    order by a.created_at desc, a.id desc
    limit p_limit + 1
  ) x;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$;

-- No index leads with worker_account_id today, so "my applications" scans the table. This serves the
-- paged read, the relation read and, as a side effect, the old unpaged read. A plain index: it is not
-- a constraint and is not part of the closure schema digest.
create index marketplace_responses_worker_idx
  on public.marketplace_responses (worker_account_id, created_at desc, id desc)
  where status <> 'DRAFT';

-- Supabase default privileges grant EXECUTE on new public functions to anon, authenticated and
-- service_role. Take everything back, then give exactly what is meant.
revoke all on function private.my_application_state(text,integer,integer,text,boolean) from public, anon, authenticated, service_role;
revoke all on function public.rpc_list_my_needs_page(text,integer,timestamptz,uuid) from public, anon, authenticated, service_role;
revoke all on function public.rpc_list_my_applications_page(text,integer,timestamptz,uuid) from public, anon, authenticated, service_role;
revoke all on function public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_my_needs_page(text,integer,timestamptz,uuid) to authenticated;
grant execute on function public.rpc_list_my_applications_page(text,integer,timestamptz,uuid) to authenticated;
grant execute on function public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid) to authenticated;

do $post$
begin
  if (select source_digest from pkg023a_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG023A_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
  if has_function_privilege('anon', 'public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rpc_list_my_applications_page(text,integer,timestamptz,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.my_application_state(text,integer,integer,text,boolean)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_list_my_applications_page(text,integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'PKG023A_GRANTS_NOT_EXACT';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
