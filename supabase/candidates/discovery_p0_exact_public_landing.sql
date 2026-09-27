-- Discovery P0 exact public landing. REVIEW-ONLY CANDIDATE; NOT APPLIED OR PROVEN.
-- Latest pinned DEV metadata: 2026-09-27 07:12:19.517218+00, leqcwgzvjsxugfgzdmth.
-- Full definition MD5 8a47d061da5f9bd65b5e3cc6c947d5d7; normalized body MD5 below.
-- One function replacement. No new endpoint, table, index, grant, policy or certificate movement.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table discovery_p0_predecessor on commit drop as
select private.closure_source_digest_v5() as source_digest,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) as certificate,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure_certificate,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) as readiness_definition,
  p.proowner as reader_owner, p.proacl as reader_acl
from pg_proc p
where p.oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure;

do $pre$
begin
  if (select count(*) from discovery_p0_predecessor) <> 1
     or (select source_digest from discovery_p0_predecessor) is null
     or (select source_digest from discovery_p0_predecessor)
        is distinct from (select sha256 from private.closure_source_v5 where singleton)
     or (select source_digest from discovery_p0_predecessor)
        is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
     or private.retention_ai_source_ready() is distinct from true then
    raise exception 'DISCOVERY_P0_CERTIFICATE_NOT_READY';
  end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
      where oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure)
     is distinct from '18b5518140c519b96728d1e25fa3c29d'
     or md5(pg_get_functiondef('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure))
        <> '8a47d061da5f9bd65b5e3cc6c947d5d7' then
    raise exception 'DISCOVERY_P0_PREDECESSOR_DRIFT';
  end if;
  if (select count(*) from pg_proc where oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure
      and not prosecdef and provolatile = 's' and proconfig = array['search_path=pg_catalog']::text[]) <> 1
     or has_function_privilege('anon', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'DISCOVERY_P0_READER_ENVELOPE_DRIFT';
  end if;
  if not exists (
    select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attname = 'id'
    where i.indrelid = 'public.needs'::regclass and i.indisprimary and i.indisvalid and i.indisready
      and i.indnkeyatts = 1 and i.indkey[0] = a.attnum
  ) then raise exception 'DISCOVERY_P0_REQUIRES_NEEDS_PRIMARY_KEY'; end if;
end
$pre$;

CREATE OR REPLACE FUNCTION public.rpc_list_open_tasks_v3(p_bbox jsonb DEFAULT NULL::jsonb, p_filters jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 50, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_west numeric; v_south numeric; v_east numeric; v_north numeric;
  v_env extensions.geography;
  v_category text; v_price_mode text; v_urgent_only boolean := false; v_remote text := 'INCLUDE';
  v_starts_from timestamptz; v_starts_to timestamptz;
  v_items jsonb;
  v_need_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  if jsonb_typeof(v_filters) is distinct from 'object'
     or v_filters - array['category','priceMode','urgentOnly','remote','startsFrom','startsTo','needId'] <> '{}'::jsonb then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end if;
  -- Exact public landing is a separate mode, not another arbitrary search combination.
  -- Retain the existing page validation above, including paired cursor validation.
  if v_filters ? 'needId' then
    if jsonb_typeof(v_filters->'needId') is distinct from 'string'
       or (v_filters->>'needId') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       or v_filters - 'needId' <> '{}'::jsonb
       or p_bbox is not null or p_before_at is not null or p_before_id is not null then
      raise exception 'INVALID_FILTER' using errcode = '22023';
    end if;
    v_need_id := (v_filters->>'needId')::uuid;
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
      'id', n.id, 'sortAt', n.published_at, 'publishedAt', n.published_at, 'revision', n.revision,
      'title', n.title, 'category', n.category, 'status', n.status, 'urgent', n.urgent,
      'scheduleKind', n.schedule_kind, 'startsAt', n.starts_at, 'endsAt', n.ends_at,
      'executionLocationMode', n.execution_location_mode,
      'taskCountryCode', n.task_country_code, 'taskTimezone', n.task_timezone,
      'verifiedIdentityRequired', n.verified_identity_required,
      'approximateCity', nullif(btrim(n.approximate_city), ''), 'approximateArea', nullif(btrim(n.approximate_area), ''),
      'pin', case when n.approximate_lat is null or n.approximate_lng is null then null
        else jsonb_build_object('lat', n.approximate_lat, 'lng', n.approximate_lng, 'precision', 'COARSE_1KM') end,
      'requiredSlots', n.required_slots, 'coveredSlots', n.covered_now,
      'requiredSkills', to_jsonb(n.required_skills), 'requiredTools', to_jsonb(n.required_tools),
      'requiredVehicles', to_jsonb(n.required_vehicles), 'requiredLicenses', to_jsonb(n.required_licenses),
      'minimumExperienceYears', n.minimum_experience_years,
      'priceMode', n.mode, 'requesterPriceRsd', n.requester_price_rsd, 'priceBasis', n.price_basis,
      'requesterProfileId', n.requester_profile_id,
      'responseDeadline', n.response_deadline,
      'acceptsApplications', n.required_slots > n.covered_now
        and (n.response_deadline is null or n.response_deadline > statement_timestamp()),
      'publicTopology', (select g.public_topology from public.need_geography g where g.need_id = n.id),
      'criticalConditions', (select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id = n.id)
    ) as item
    from (
      -- Parameter-only gates select the ordinary viewport/list branch or exact-ID branch.
      -- Ordinary predicates and page limits are unchanged; exact landing uses the existing PK.
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', m.id))) as covered_now from public.needs m
        where v_need_id is null and p_bbox is not null
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
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', m.id))) as covered_now from public.needs m
        where v_need_id is null and p_bbox is null
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
      union all
      -- A primary-key predicate bounds exact landing to one candidate before the shared
      -- public JSON projection. Ordinary list/map branches are disabled in this mode.
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', m.id))) as covered_now from public.needs m
        where v_need_id is not null and m.id = v_need_id
          and m.status in ('PUBLISHED','SELECTION')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
        limit 1)
    ) n
    order by n.published_at desc, n.id desc
    limit p_limit + 1
  ) q;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$
;

do $post$
begin
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
      where oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure)
     is distinct from '602113d52d64c775893752ff74bfc324' then
    raise exception 'DISCOVERY_P0_BODY_NOT_AS_REVIEWED';
  end if;
  if (select count(*) from pg_proc p, discovery_p0_predecessor b
      where p.oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure
        and not p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog']::text[]
        and p.proowner = b.reader_owner and p.proacl is not distinct from b.reader_acl) <> 1
     or has_function_privilege('anon', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'DISCOVERY_P0_READER_ENVELOPE_CHANGED';
  end if;
  if private.closure_source_digest_v5() is distinct from (select source_digest from discovery_p0_predecessor)
     or (select to_jsonb(c) from private.closure_source_v5 c where singleton)
        is distinct from (select certificate from discovery_p0_predecessor)
     or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)
        is distinct from (select erasure_certificate from discovery_p0_predecessor)
     or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure)
        is distinct from (select readiness_definition from discovery_p0_predecessor)
     or private.retention_ai_source_ready() is distinct from true then
    raise exception 'DISCOVERY_P0_CERTIFICATE_CHANGED';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
