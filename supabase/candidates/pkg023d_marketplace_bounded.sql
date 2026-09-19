-- PKG-023d: the public marketplace read, bounded (V3 third slice, owner's addition 1 of 2026-09-19).
--
-- NOT APPLIED ANYWHERE. A candidate for canonical DEV, proven only on a disposable database.
--
-- Today Mapa and the list under it read EVERY open task: a direct table read of public.needs with
-- status in (PUBLISHED, SELECTION), ordered by created_at, no limit and no geography. This adds one
-- bounded reader beside it. The table read, its grants and its RLS policies are untouched, so an
-- installed APK keeps working exactly as it does; its retirement is a separate decision.
--
-- public.rpc_list_open_tasks_v3(p_bbox, p_filters, p_limit, p_before_at, p_before_id)
--
--   Visibility   SECURITY INVOKER. Which tasks a viewer may see is decided by the RLS policies that
--                decide it today (needs_public_discovery with the same-world boundary, and the
--                restrictive closed-account policy). The function restates none of them and cannot
--                widen them.
--   Geography    p_bbox = { west, south, east, north } in degrees, west < east, south < north, at most
--                3 degrees of latitude by 5 of longitude (about 330 x 390 km here): a viewport, never
--                a country. With a bbox only tasks that have a pin inside it are returned. Without a
--                bbox the reader is the list: every open task, REMOTE ones included.
--   Hard limit   p_limit 1..200, default 50. There is no way to ask for more.
--   Paging       keyset on (published_at, id), newest first. published_at is server-owned: only
--                rpc_publish_need_canonical sets it, guard_need_write refuses any client change
--                (PUBLISHED_AT_IS_SERVER_OWNED), and an edit takes the task out of the open set before
--                clearing it. created_at, which the legacy read sorts by, is NOT used: the owner can
--                rewrite it on an own DRAFT through the table grant. On a map, hasMore means "zoom in
--                or fetch the next page"; there is no server-side clustering in this version.
--   Filters      p_filters is an object with only these keys, anything else is INVALID_FILTER:
--                  category    text, exact match
--                  priceMode   'MY_PRICE' | 'OFFERS'
--                  urgentOnly  boolean
--                  remote      'INCLUDE' | 'ONLY' | 'EXCLUDE'   (list mode only; default INCLUDE)
--                  startsFrom, startsTo   timestamptz; a task with no start time matches neither
--                Always applied, as the legacy list applies it: remaining_search_closed_at is null.
--   Allowlist    Each item is built field by field from a fixed list. requester_account_id is NOT in
--                it (the public identity of who published is requesterProfileId, which is what the
--                public profile reader takes), nor is any exact coordinate, address, access note or
--                description. The pin is the coarse public point; pkg023c replaces this function to
--                prefer the ~100 m point where a task has one.
--   Overlay      Nothing in the result depends on who asks beyond RLS visibility. "Tvoj zadatak" and
--                "Prijava poslata" come from rpc_get_my_task_relations (pkg023b), asked separately for
--                the ids of the page.
--
-- Index. The existing GiST index needs_approx_geog_idx is partial on status = 'PUBLISHED'. The open
-- set is PUBLISHED and SELECTION, a predicate that index does not imply, so the planner cannot use it
-- for this reader; the proof shows that. needs_open_geog_idx covers the open set. needs_open_published_idx
-- serves the list order. Both are plain indexes: not constraints, not part of the closure schema digest.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg023d_predecessor(source_digest text) on commit drop;

do $pre$
begin
  if to_regprocedure('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)') is not null then
    raise exception 'PKG023D_ALREADY_APPLIED';
  end if;
  insert into pkg023d_predecessor values (private.closure_source_digest_v5());
end
$pre$;

create index needs_open_geog_idx
  on public.needs using gist (approx_geog)
  where status in ('PUBLISHED','SELECTION');

create index needs_open_published_idx
  on public.needs (published_at desc, id desc)
  where status in ('PUBLISHED','SELECTION');

create function public.rpc_list_open_tasks_v3(
  p_bbox jsonb default null, p_filters jsonb default '{}'::jsonb, p_limit integer default 50,
  p_before_at timestamptz default null, p_before_id uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_west numeric; v_south numeric; v_east numeric; v_north numeric;
  v_env extensions.geography;
  v_category text; v_price_mode text; v_urgent_only boolean := false; v_remote text := 'INCLUDE';
  v_starts_from timestamptz; v_starts_to timestamptz;
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  if jsonb_typeof(v_filters) is distinct from 'object'
     or v_filters - array['category','priceMode','urgentOnly','remote','startsFrom','startsTo'] <> '{}'::jsonb then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end if;
  if v_filters ? 'category' then
    if jsonb_typeof(v_filters->'category') <> 'string' or btrim(v_filters->>'category') = ''
       or char_length(v_filters->>'category') > 120 then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_category := btrim(v_filters->>'category');
  end if;
  if v_filters ? 'priceMode' then
    if jsonb_typeof(v_filters->'priceMode') <> 'string' or v_filters->>'priceMode' not in ('MY_PRICE','OFFERS') then
      raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_price_mode := v_filters->>'priceMode';
  end if;
  if v_filters ? 'urgentOnly' then
    if jsonb_typeof(v_filters->'urgentOnly') <> 'boolean' then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_urgent_only := (v_filters->>'urgentOnly')::boolean;
  end if;
  if v_filters ? 'remote' then
    if jsonb_typeof(v_filters->'remote') <> 'string' or v_filters->>'remote' not in ('INCLUDE','ONLY','EXCLUDE')
       or (p_bbox is not null and v_filters->>'remote' <> 'EXCLUDE') then
      raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_remote := v_filters->>'remote';
  end if;
  begin
    if v_filters ? 'startsFrom' then
      if jsonb_typeof(v_filters->'startsFrom') <> 'string' then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
      v_starts_from := (v_filters->>'startsFrom')::timestamptz;
    end if;
    if v_filters ? 'startsTo' then
      if jsonb_typeof(v_filters->'startsTo') <> 'string' then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
      v_starts_to := (v_filters->>'startsTo')::timestamptz;
    end if;
  exception when data_exception then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end;

  if p_bbox is not null then
    if jsonb_typeof(p_bbox) <> 'object'
       or p_bbox - array['west','south','east','north'] <> '{}'::jsonb
       or not (p_bbox ?& array['west','south','east','north'])
       or jsonb_typeof(p_bbox->'west') <> 'number' or jsonb_typeof(p_bbox->'south') <> 'number'
       or jsonb_typeof(p_bbox->'east') <> 'number' or jsonb_typeof(p_bbox->'north') <> 'number' then
      raise exception 'INVALID_BBOX' using errcode = '22023';
    end if;
    v_west := (p_bbox->>'west')::numeric; v_south := (p_bbox->>'south')::numeric;
    v_east := (p_bbox->>'east')::numeric; v_north := (p_bbox->>'north')::numeric;
    if v_west < -180 or v_east > 180 or v_south < -90 or v_north > 90
       or v_west >= v_east or v_south >= v_north
       or v_north - v_south > 3 or v_east - v_west > 5 then
      raise exception 'INVALID_BBOX' using errcode = '22023';
    end if;
    -- The index filters on the coarse point, which lies within one hundredth of a degree of the
    -- finer one; the margin keeps a task whose fine pin is inside the viewport from being cut off at
    -- its edge. The numeric comparison below is the exact test.
    v_env := extensions.ST_MakeEnvelope(
      greatest(v_west - 0.01, -180)::double precision, greatest(v_south - 0.01, -90)::double precision,
      least(v_east + 0.01, 180)::double precision, least(v_north + 0.01, 90)::double precision, 4326)::extensions.geography;
  end if;

  select coalesce(jsonb_agg(q.item order by q.published_at desc, q.id desc), '[]'::jsonb) into v_items
  from (
    select n.published_at, n.id, jsonb_build_object(
      'id', n.id, 'sortAt', n.published_at, 'publishedAt', n.published_at,
      'title', n.title, 'category', n.category, 'status', n.status, 'urgent', n.urgent,
      'scheduleKind', n.schedule_kind, 'startsAt', n.starts_at, 'endsAt', n.ends_at,
      'executionLocationMode', n.execution_location_mode,
      'approximateCity', nullif(btrim(n.approximate_city), ''), 'approximateArea', nullif(btrim(n.approximate_area), ''),
      'pin', case when n.approximate_lat is null or n.approximate_lng is null then null
        else jsonb_build_object('lat', n.approximate_lat, 'lng', n.approximate_lng, 'precision', 'COARSE_1KM') end,
      'requiredSlots', n.required_slots, 'coveredSlots', n.covered_slots,
      'requiredSkills', to_jsonb(n.required_skills), 'requiredTools', to_jsonb(n.required_tools),
      'requiredVehicles', to_jsonb(n.required_vehicles), 'requiredLicenses', to_jsonb(n.required_licenses),
      'minimumExperienceYears', n.minimum_experience_years,
      'priceMode', n.mode, 'requesterPriceRsd', n.requester_price_rsd,
      'requesterProfileId', n.requester_profile_id,
      'responseDeadline', n.response_deadline,
      'acceptsApplications', n.required_slots > n.covered_slots
        and (n.response_deadline is null or n.response_deadline > statement_timestamp()),
      'publicTopology', (select g.public_topology from public.need_geography g where g.need_id = n.id),
      'criticalConditions', (select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id = n.id)
    ) as item
    from (
      -- Two branches, one of which is switched off by a parameter-only condition before it reads
      -- anything, so each keeps its own index: the viewport its GiST index, the list its order.
      -- The limit is inside each branch: no branch can read more than p_limit + 1 rows' worth of items.
      (select m.* from public.needs m
        where p_bbox is not null
          and m.status in ('PUBLISHED','SELECTION')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
          and m.approx_geog OPERATOR(extensions.&&) v_env
          and m.approximate_lat between v_south - 0.01 and v_north + 0.01
          and m.approximate_lng between v_west - 0.01 and v_east + 0.01
        and (v_category is null or m.category = v_category)
        and (v_price_mode is null or m.mode = v_price_mode)
        and (not v_urgent_only or m.urgent)
        and (v_starts_from is null or m.starts_at >= v_starts_from)
        and (v_starts_to is null or m.starts_at <= v_starts_to)
        and (p_before_at is null or (m.published_at, m.id) < (p_before_at, p_before_id))
      order by m.published_at desc, m.id desc
      limit p_limit + 1)
      union all
      (select m.* from public.needs m
        where p_bbox is null
          and m.status in ('PUBLISHED','SELECTION')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
          and (v_remote = 'INCLUDE'
            or (v_remote = 'ONLY' and m.execution_location_mode = 'REMOTE')
            or (v_remote = 'EXCLUDE' and m.execution_location_mode <> 'REMOTE'))
        and (v_category is null or m.category = v_category)
        and (v_price_mode is null or m.mode = v_price_mode)
        and (not v_urgent_only or m.urgent)
        and (v_starts_from is null or m.starts_at >= v_starts_from)
        and (v_starts_to is null or m.starts_at <= v_starts_to)
        and (p_before_at is null or (m.published_at, m.id) < (p_before_at, p_before_id))
      order by m.published_at desc, m.id desc
      limit p_limit + 1)
    ) n
    order by n.published_at desc, n.id desc
    limit p_limit + 1
  ) q;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$;

revoke all on function public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid) to authenticated;

do $post$
begin
  if (select source_digest from pkg023d_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG023D_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
  if has_function_privilege('anon', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'PKG023D_GRANTS_NOT_EXACT';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
