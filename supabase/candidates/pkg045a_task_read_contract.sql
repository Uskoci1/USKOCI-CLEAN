-- PKG-045: public task column boundary. Forward-only candidate, source147 remains frozen.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
create temporary table pkg045_closure on commit drop as select private.closure_source_digest_v5() digest;
do $pre$
begin
  if (select digest from pkg045_closure) is null or
     (select digest from pkg045_closure) is distinct from (select sha256 from private.closure_source_v5 where singleton) or
     not private.retention_ai_source_ready() then raise exception 'PKG045_CERTIFICATE_NOT_READY'; end if;
end;
$pre$;
do $pre$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)')) is distinct from '20b5d1193357c43de14d68d6fdcfb911' then raise exception 'PKG045A_PREDECESSOR_DRIFT'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)')) is distinct from 'efb305257be41a978b6204b7d45e8793' then raise exception 'PKG045A_PREDECESSOR_DRIFT'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_resolve_activity_event(uuid)')) is distinct from '12ab04311b85ee482bc9e647b8f92738' then raise exception 'PKG045A_PREDECESSOR_DRIFT'; end if;
  if to_regprocedure('public.is_my_task(uuid)') is not null then raise exception 'PKG045A_PREDECESSOR_DRIFT'; end if;
  if to_regprocedure('public.rpc_read_task(uuid)') is not null then raise exception 'PKG045A_PREDECESSOR_DRIFT'; end if;
  if to_regprocedure('public.rpc_list_my_tasks()') is not null then raise exception 'PKG045A_PREDECESSOR_DRIFT'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure('public.selectable_application_count(needs)')) is distinct from 'fe53442f8b661d6f33d22a54e2a468a8' then raise exception 'PKG045A_DEPENDENCY_DRIFT'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure('public.covered_slots(needs)')) is distinct from 'cbeb8f2a3da7d08965ef0386cfc437ba' then raise exception 'PKG045A_DEPENDENCY_DRIFT'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure('public.rpc_storage_account_open()')) is distinct from '7350621ef256678e209aa6a28c79b58b' then raise exception 'PKG045A_DEPENDENCY_DRIFT'; end if;
end;
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
      -- Two branches, one of which is switched off by a parameter-only condition before it reads
      -- anything, so each keeps its own index: the viewport its GiST index, the list its order.
      -- The limit is inside each branch: no branch can read more than p_limit + 1 rows' worth of items.
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', m.id))) as covered_now from public.needs m
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
      (select m.id, m.requester_profile_id, m.status, m.title, m.description, m.category, m.approximate_city, m.approximate_area, m.approximate_lat, m.approximate_lng, m.schedule_kind, m.starts_at, m.ends_at, m.required_slots, m.mode, m.requester_price_rsd, m.required_skills, m.required_tools, m.required_vehicles, m.verified_identity_required, m.urgent, m.public_photo_paths, m.revision, m.published_at, m.created_at, m.updated_at, m.response_deadline, m.urgent_activated_at, m.urgent_expires_at, m.urgent_policy_version, m.minimum_experience_years, m.execution_location_mode, m.approx_geog, m.required_licenses, m.remaining_search_closed_at, m.task_country_code, m.task_timezone, m.price_basis, public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', m.id))) as covered_now from public.needs m
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
$function$
;
CREATE OR REPLACE FUNCTION public.is_my_task(p_need_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;
  return exists(select 1 from public.needs n where n.id=p_need_id and n.requester_account_id=auth.uid());
end;
$function$;
CREATE OR REPLACE FUNCTION public.rpc_list_my_needs_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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

  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;

  select coalesce(jsonb_agg(q.item order by q.created_at desc, q.id desc), '[]'::jsonb) into v_items
  from (
    select n.created_at, n.id, jsonb_build_object(
      'id', n.id, 'sortAt', n.created_at, 'revision', n.revision,
      'title', n.title, 'description', n.description, 'category', n.category, 'status', n.status,
      'urgent', n.urgent, 'scheduleKind', n.schedule_kind, 'startsAt', n.starts_at, 'endsAt', n.ends_at,
      'taskCountryCode', n.task_country_code, 'taskTimezone', n.task_timezone,
      'executionLocationMode', n.execution_location_mode,
      'approximateArea', n.approximate_area, 'approximateCity', n.approximate_city,
      -- covered_slots is the existing computed field public.covered_slots(needs), not a column.
      'requiredSlots', n.required_slots, 'coveredSlots', public.covered_slots(n),
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
$function$
;
CREATE OR REPLACE FUNCTION public.rpc_resolve_activity_event(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  e public.user_activity_events%rowtype;
  a public.agreements%rowtype;
  r public.marketplace_responses%rowtype;
  n public.needs%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into e from public.user_activity_events where id=p_event_id and recipient_user_id=v_uid
    and exists(select 1 from public.notification_deliveries d where d.event_id=public.user_activity_events.id
      and d.recipient_user_id=v_uid and d.channel='IN_APP' and d.state<>'SUPPRESSED');
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode='P0002'; end if;
  if e.entity_type='AGREEMENT' then
    select * into a from public.agreements where id=e.entity_id
      and v_uid in (requester_account_id,worker_account_id);
    if found then return jsonb_build_object('kind','AGREEMENT','id',a.id,'role',e.recipient_role); end if;
  elsif e.entity_type='RESPONSE' then
    select * into r from public.marketplace_responses where id=e.entity_id;
    if found then
      select * into a from public.agreements where selected_response_id=r.id
        and v_uid in (requester_account_id,worker_account_id) order by created_at desc,id desc limit 1;
      if found then return jsonb_build_object('kind','AGREEMENT','id',a.id,'role',e.recipient_role); end if;
      if r.worker_account_id=v_uid then return jsonb_build_object('kind','APPLICATIONS','id',r.id,'role','WORKER'); end if;
      select id into n.id from public.needs where id=r.need_id and public.is_my_task(id);
      if found then return jsonb_build_object('kind','CANDIDATES','id',n.id,'role','REQUESTER'); end if;
    end if;
  elsif e.entity_type='CLARIFICATION' then
    -- Only the existing safe context ID; current Need RLS is checked again.
    if coalesce(e.payload->>'needId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return jsonb_build_object('kind','UNAVAILABLE'); end if;
    select id into n.id from public.needs where id=(e.payload->>'needId')::uuid;
    if found then return jsonb_build_object('kind',case when public.is_my_task(n.id) then 'OWN_NEED' else 'OPPORTUNITY' end,
      'id',n.id,'role',case when public.is_my_task(n.id) then 'REQUESTER' else 'WORKER' end); end if;
  elsif e.entity_type='NEED' then
    select id into n.id from public.needs where id=e.entity_id;
    if found then return jsonb_build_object('kind',case when public.is_my_task(n.id) then 'OWN_NEED' else 'OPPORTUNITY' end,
      'id',n.id,'role',case when public.is_my_task(n.id) then 'REQUESTER' else 'WORKER' end); end if;
  end if;
  return jsonb_build_object('kind','UNAVAILABLE');
end
$function$
;
CREATE OR REPLACE FUNCTION public.rpc_read_task(p_need_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog'
AS $function$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  -- RLS remains the authority for the task and all embedded relations.
  -- Composite computed fields receive ONLY an ID, never a whole-row reference.
  select jsonb_build_object(
    'id', n.id,
    'requester_profile_id', n.requester_profile_id,
    'status', n.status,
    'title', n.title,
    'description', n.description,
    'category', n.category,
    'approximate_city', n.approximate_city,
    'approximate_area', n.approximate_area,
    'approximate_lat', n.approximate_lat,
    'approximate_lng', n.approximate_lng,
    'schedule_kind', n.schedule_kind,
    'starts_at', n.starts_at,
    'ends_at', n.ends_at,
    'required_slots', n.required_slots,
    'mode', n.mode,
    'requester_price_rsd', n.requester_price_rsd,
    'required_skills', n.required_skills,
    'required_tools', n.required_tools,
    'required_vehicles', n.required_vehicles,
    'verified_identity_required', n.verified_identity_required,
    'urgent', n.urgent,
    'public_photo_paths', n.public_photo_paths,
    'revision', n.revision,
    'published_at', n.published_at,
    'created_at', n.created_at,
    'updated_at', n.updated_at,
    'response_deadline', n.response_deadline,
    'urgent_activated_at', n.urgent_activated_at,
    'urgent_expires_at', n.urgent_expires_at,
    'urgent_policy_version', n.urgent_policy_version,
    'minimum_experience_years', n.minimum_experience_years,
    'execution_location_mode', n.execution_location_mode,
    'required_licenses', n.required_licenses,
    'remaining_search_closed_at', n.remaining_search_closed_at,
    'task_country_code', n.task_country_code,
    'task_timezone', n.task_timezone,
    'price_basis', n.price_basis,
    'covered_slots', public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', n.id))),
    'selectable_application_count', public.selectable_application_count(jsonb_populate_record(null::public.needs, jsonb_build_object('id', n.id))),
    'marketplace_responses', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id) order by r.id), '[]'::jsonb) from public.marketplace_responses r where r.need_id=n.id),
    'need_geography', (select jsonb_build_object('public_topology', g.public_topology) from public.need_geography g where g.need_id=n.id),
    'need_requirement_details', (select jsonb_build_object('critical_conditions', d.critical_conditions) from public.need_requirement_details d where d.need_id=n.id)
  ) into result from public.needs n where n.id=p_need_id;
  return result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.rpc_list_my_tasks()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;
  -- The only elevated reader: no caller-supplied account; enumerate ONLY this account's own tasks.
  -- Its document reader omits internal account IDs, close reason and private location data.
  select coalesce(jsonb_agg(public.rpc_read_task(n.id) order by n.created_at desc, n.id desc), '[]'::jsonb)
    into result from public.needs n where n.requester_account_id=actor;
  return result;
end;
$function$;
revoke all on function public.rpc_read_task(uuid), public.rpc_list_my_tasks(), public.is_my_task(uuid) from public, anon, authenticated;
grant execute on function public.rpc_read_task(uuid), public.rpc_list_my_tasks(), public.is_my_task(uuid) to authenticated;
do $bodies$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)')) is distinct from '18b5518140c519b96728d1e25fa3c29d' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)')) is distinct from 'dad1de3234e72d4e2f44be5e920eda61' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_resolve_activity_event(uuid)')) is distinct from 'e5dc05773da08471db572194caf467e2' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.is_my_task(uuid)')) is distinct from '42b6802d2f3114d1e211025c4c475e55' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_read_task(uuid)')) is distinct from '1e01db5140248f27ab374187f01fded3' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_my_tasks()')) is distinct from '2a8ff0fa8a1211414e5e1fc69c6fb4f7' then raise exception 'PKG045_BODY_MISMATCH'; end if;
end;
$bodies$;
do $post$
begin
  if private.closure_source_digest_v5() is distinct from (select digest from pkg045_closure)
    or not private.retention_ai_source_ready() then raise exception 'PKG045_CERTIFICATE_CHANGED'; end if;
end;
$post$;
notify pgrst, 'reload schema';
commit;
