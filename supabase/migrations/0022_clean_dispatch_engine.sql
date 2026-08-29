-- 17b: motor isporuke prilika.
-- Donorov finalni ugovor (hardBlockers / dispatchBlockers / reasonCodes / score),
-- clean ulazi. Gde clean sema nema ulaz, kapija je zatvorena i razlog imenovan —
-- tvrda kvalifikacija se nikad ne relaksira.

create or replace function private.lower_arr(a text[])
returns text[] language sql immutable set search_path to 'pg_catalog' as $$
  select coalesce(array(select lower(btrim(x)) from unnest(coalesce(a,'{}'::text[])) x where x is not null), '{}'::text[]);
$$;

-- GAP: clean set nema sistem verifikacije identiteta. Fail-closed: Potreba koja
-- trazi verifikovan identitet ne dobija nijednog kandidata dok se sistem ne uvede.
create or replace function private.identity_admitted(p_account uuid)
returns boolean language sql immutable set search_path to 'pg_catalog' as $$
  select false;
$$;

comment on function private.identity_admitted(uuid) is
  'FAIL-CLOSED PLACEHOLDER. Verifikacija identiteta ne postoji u clean setu. Vraca false namerno: bolje nula kandidata nego tiho relaksirana tvrda kapija.';

create or replace function private.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric language sql immutable set search_path to 'pg_catalog' as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else round((6371.0 * 2 * asin(least(1, sqrt(
        power(sin(radians((lat2-lat1)::double precision)/2),2) +
        cos(radians(lat1::double precision))*cos(radians(lat2::double precision)) *
        power(sin(radians((lng2-lng1)::double precision)/2),2)
      ))))::numeric, 2)
  end;
$$;

create or replace function private.effective_radius_km(base_radius integer)
returns numeric language sql immutable set search_path to 'pg_catalog' as $$
  select greatest(1, least(300, coalesce(base_radius, 15)))::numeric;
$$;

-- Fail-closed kao kod donora: bez pokrivajuceg prozora ili pravila -> false.
create or replace function private.schedule_fit(pid uuid, s timestamptz, e timestamptz, tz text)
returns boolean language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare
  ls timestamp; le timestamp; ld date; dw integer; st time; et time;
  live_now boolean; live_until timestamptz;
begin
  if s is null or e is null then return true; end if;   -- fleksibilna Potreba
  if s >= e or tz is null then return false; end if;

  select coalesce(p.available_now,false), p.available_now_expires_at
    into live_now, live_until
  from public.app_profiles p where p.id = pid and p.kind = 'WORKER';

  if coalesce(live_now,false) and live_until is not null
     and s >= statement_timestamp() and e <= live_until then
    return true;
  end if;

  ls := s at time zone tz; le := e at time zone tz;
  if ls::date <> le::date then return false; end if;
  ld := ls::date;
  dw := extract(dow from ls)::integer;   -- 0=nedelja, sto je opseg u profile_availability_rules
  st := ls::time; et := le::time;

  if exists (select 1 from public.profile_availability_windows w
             where w.profile_id=pid and w.availability_state='UNAVAILABLE'
               and w.starts_at < e and w.ends_at > s) then
    return false;
  end if;

  if exists (select 1 from public.profile_availability_windows w
             where w.profile_id=pid and w.availability_state='AVAILABLE'
               and w.starts_at <= s and w.ends_at >= e) then
    return true;
  end if;

  return exists (select 1 from public.profile_availability_rules r
                 where r.profile_id=pid and r.active=true
                   and dw = any(r.weekdays)
                   and r.starts_on <= ld and (r.ends_on is null or r.ends_on >= ld)
                   and r.start_time <= st and r.end_time >= et);
end;
$$;

create or replace function private.match_detail(nid uuid, pid uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare
  n public.needs; p public.app_profiles; pref public.worker_match_preferences;
  hard text[] := '{}'; disp text[] := '{}'; reasons text[] := '{}';
  tz text; local_day date;
  svc boolean; toolsok boolean; licok boolean; vehok boolean; expok boolean;
  sched boolean; dist numeric; radiusok boolean; feeok boolean;
  effective_radius numeric; exposure integer;
  cap numeric := 0; ss numeric := 0; ds numeric := 0; rs numeric := 0;
  rels numeric := 0; fair numeric := 0;
begin
  select * into n from public.needs where id = nid;
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('NEED_NOT_FOUND'));
  end if;
  select * into p from public.app_profiles where id = pid and kind = 'WORKER';
  if not found then
    return jsonb_build_object('responseAllowed',false,'dispatchEligible',false,
      'hardBlockers',jsonb_build_array('WORKER_PROFILE_NOT_FOUND'));
  end if;
  select * into pref from public.worker_match_preferences where worker_profile_id = pid;

  tz := coalesce(nullif(pref.timezone,''), 'Europe/Belgrade');
  local_day := case when n.starts_at is not null then (n.starts_at at time zone tz)::date end;

  svc := cardinality(n.required_skills) = 0
         or private.lower_arr(p.skills) && private.lower_arr(n.required_skills);
  toolsok := private.lower_arr(p.tools) @> private.lower_arr(n.required_tools);
  licok := private.lower_arr(p.licenses) @> private.lower_arr(n.required_licenses);
  vehok := private.lower_arr(p.vehicles) @> private.lower_arr(n.required_vehicles);
  expok := coalesce(n.minimum_experience_years,0) = 0
           or coalesce(p.years_experience,0) >= n.minimum_experience_years;
  sched := private.schedule_fit(pid, n.starts_at, n.ends_at, tz);
  effective_radius := private.effective_radius_km(p.radius_km);

  if n.execution_location_mode = 'REMOTE' then
    dist := null; radiusok := true;
  else
    dist := private.haversine_km(n.approximate_lat, n.approximate_lng,
                                 pref.approximate_lat, pref.approximate_lng);
    radiusok := case
      when dist is not null then dist <= effective_radius
      else btrim(coalesce(n.approximate_city,'')) <> ''
           and lower(coalesce(n.approximate_city,'')) = lower(coalesce(p.city,''))
    end;
  end if;

  feeok := n.mode = 'OFFERS'
           or coalesce(p.minimum_fee_rsd,0) = 0
           or (n.requester_price_rsd is not null and n.requester_price_rsd >= p.minimum_fee_rsd);

  -- TVRDE kapije: blokiraju i rucni odgovor, ne samo automatski dispatch.
  if p.profile_status <> 'ACTIVE' then hard := array_append(hard,'ACCOUNT_OR_PROFILE_RESTRICTED'); end if;
  if n.requester_account_id = p.account_id then hard := array_append(hard,'OWN_NEED'); end if;
  if n.verified_identity_required and not private.identity_admitted(p.account_id)
    then hard := array_append(hard,'IDENTITY_VERIFICATION_NOT_ADMITTED'); end if;
  if not toolsok then hard := array_append(hard,'MISSING_REQUIRED_TOOL'); end if;
  if not licok  then hard := array_append(hard,'MISSING_REQUIRED_LICENSE'); end if;
  if not vehok  then hard := array_append(hard,'MISSING_REQUIRED_VEHICLE'); end if;
  if not expok  then hard := array_append(hard,'INSUFFICIENT_EXPERIENCE'); end if;
  if private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category, n.required_skills))
    then hard := array_append(hard,'PROFILE_EXCLUSION'); end if;

  -- MEKE kapije: blokiraju samo automatsku isporuku. Rucno pretrazivanje ostaje otvoreno.
  if not coalesce(p.available_now,false) then disp := array_append(disp,'CURRENT_AVAILABILITY_PAUSED');
  elsif p.available_now_expires_at is null or p.available_now_expires_at <= statement_timestamp()
    then disp := array_append(disp,'AVAILABILITY_FRESHNESS_EXPIRED'); end if;
  if not coalesce(pref.proactive_notifications,true) then disp := array_append(disp,'PROACTIVE_NOTIFICATIONS_PAUSED'); end if;
  if n.urgent
     and (n.schedule_kind = 'TODAY_FLEXIBLE'
          or (n.starts_at is not null and (n.starts_at at time zone tz)::date = (statement_timestamp() at time zone tz)::date))
     and not coalesce(pref.same_day_urgent_notifications,true)
    then disp := array_append(disp,'SAME_DAY_URGENT_NOTIFICATIONS_PAUSED'); end if;
  if not svc then disp := array_append(disp,'SERVICE_NOT_IN_WORK_PROFILE'); end if;
  if not sched then disp := array_append(disp,'OUTSIDE_AVAILABILITY'); end if;
  if not radiusok then disp := array_append(disp,'OUTSIDE_PREFERRED_RADIUS'); end if;
  if not feeok then disp := array_append(disp,'BELOW_MINIMUM_FEE'); end if;

  -- Bodovanje: donorove tezine 30/25/15/15/10/5.
  if svc then reasons := array_append(reasons,'SERVICE_MATCH'); cap := 30; end if;
  if sched then reasons := array_append(reasons,'SCHEDULE_MATCH'); ss := 25; end if;
  if radiusok then
    reasons := array_append(reasons, case when n.execution_location_mode='REMOTE'
                 then 'REMOTE_LOCATION_NOT_REQUIRED' else 'START_PROXIMITY_MATCH' end);
    ds := case
      when n.execution_location_mode='REMOTE' then 15
      when dist is null or effective_radius is null or effective_radius <= 0 then 10
      else round(15 * (1 - 0.55 * least(1, greatest(0, dist/effective_radius))), 1)
    end;
  end if;
  if toolsok and licok and vehok then reasons := array_append(reasons,'RESOURCES_MATCH'); rs := 15; end if;

  rels := round(greatest(0, least(100, coalesce(p.rating_worker*20, 50)))/10, 1);
  select count(*) into exposure from public.opportunity_deliveries d
   where d.worker_account_id = p.account_id
     and d.created_at > statement_timestamp() - interval '7 days';
  fair := case when p.rating_worker is null then 5 else greatest(0, 5 - least(5, exposure)) end;
  if p.rating_worker is null then reasons := array_append(reasons,'NEWCOMER_FAIRNESS'); end if;

  return jsonb_build_object(
    'workerAccountId', p.account_id,
    'workerProfileId', p.id,
    'responseAllowed', cardinality(hard) = 0,
    'dispatchEligible', cardinality(hard) = 0 and cardinality(disp) = 0,
    'hardBlockers', to_jsonb(hard),
    'dispatchBlockers', to_jsonb(disp),
    'reasonCodes', to_jsonb(reasons),
    'distanceToStartKm', dist,
    'effectiveRadiusKm', effective_radius,
    'taskLocationMode', n.execution_location_mode,
    'distanceSource', case when dist is null then null else 'GEODESIC' end,
    'routingProvider', null,
    'liveStateDate', local_day,
    'score', round(least(100, cap+ss+ds+rs+rels+fair), 1),
    'scoreComponents', jsonb_build_object(
      'capability', cap, 'schedule', ss, 'distanceToStart', ds,
      'resources', rs, 'reliability', rels, 'fairness', fair)
  );
end;
$$;

comment on function private.match_detail(uuid,uuid) is
  'GAP u odnosu na donora: nema r31 deep capability bonusa, nema kalendarskog konflikta (worker_calendar_events ne postoji), nema live resource override-a i nema routing provajdera. Sve odsutno je izostavljeno, nista nije aproksimirano.';

-- Jedan vlasnik jeftine admisije. Deli ga i pretraga i talas, pa ne mogu da se raziđu.
create or replace function private.dispatch_cheap_candidate_admitted(nid uuid, pid uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog' as $$
  select exists (
    select 1
    from public.needs n
    join public.app_profiles p on p.id = pid
    left join public.worker_match_preferences pref on pref.worker_profile_id = p.id
    where n.id = nid
      and p.kind = 'WORKER'
      and p.profile_status = 'ACTIVE'
      and p.available_now = true
      and p.available_now_expires_at > statement_timestamp()
      and p.account_id <> n.requester_account_id
      and coalesce(pref.proactive_notifications, true) = true
      and (not n.verified_identity_required or private.identity_admitted(p.account_id))
      and (cardinality(n.required_skills) = 0
           or private.lower_arr(p.skills) && private.lower_arr(n.required_skills))
      and private.lower_arr(p.licenses) @> private.lower_arr(n.required_licenses)
      and private.lower_arr(p.tools) @> private.lower_arr(n.required_tools)
      and private.lower_arr(p.vehicles) @> private.lower_arr(n.required_vehicles)
      and (coalesce(n.minimum_experience_years,0) = 0
           or coalesce(p.years_experience,0) >= n.minimum_experience_years)
      and not (private.lower_arr(p.exclusions)
               && private.lower_arr(array_prepend(n.category, n.required_skills)))
      and (n.mode = 'OFFERS' or coalesce(p.minimum_fee_rsd,0) = 0
           or (n.requester_price_rsd is not null and n.requester_price_rsd >= p.minimum_fee_rsd))
      and not exists (
        select 1 from public.opportunity_deliveries od
        where od.worker_account_id = p.account_id
          and od.need_id = n.id
          and od.need_revision = n.revision)
  );
$$;

-- Streaming: KNN se cita redom i staje cim se budzet napuni. Nikad pun scan.
create or replace function private.candidate_profile_ids(nid uuid, p_limit integer)
returns table (worker_profile_id uuid)
language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare
  n public.needs; admitted integer := 0; c record; task_geog extensions.geography;
begin
  select * into n from public.needs where id = nid;
  if not found or p_limit is null or p_limit < 1 then return; end if;

  if n.execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED')
     and n.approx_geog is not null then
    task_geog := n.approx_geog;

    for c in
      select pref.worker_profile_id as pid
      from public.worker_match_preferences pref
      where pref.approximate_geog is not null
        and extensions.ST_DWithin(pref.approximate_geog, task_geog, 300000.0)
      order by pref.approximate_geog OPERATOR(extensions.<->) task_geog, pref.worker_profile_id
    loop
      if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
        worker_profile_id := c.pid; return next;
        admitted := admitted + 1;
        exit when admitted >= p_limit;
      end if;
    end loop;

    if admitted < p_limit then
      for c in
        select p.id as pid
        from public.app_profiles p
        left join public.worker_match_preferences pref on pref.worker_profile_id = p.id
        where p.kind = 'WORKER'
          and (pref.worker_profile_id is null or pref.approximate_geog is null)
        order by p.id
      loop
        if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
          worker_profile_id := c.pid; return next;
          admitted := admitted + 1;
          exit when admitted >= p_limit;
        end if;
      end loop;
    end if;
    return;
  end if;

  -- Nefizicka Potreba ili bez koordinata: rotacija zasejana ID-jem Potrebe,
  -- da isti radnici ne budu uvek prvi.
  for c in
    select p.id as pid from public.app_profiles p
    where p.kind = 'WORKER'
    order by case when p.id >= n.id then 0 else 1 end, p.id
  loop
    if private.dispatch_cheap_candidate_admitted(n.id, c.pid) then
      worker_profile_id := c.pid; return next;
      admitted := admitted + 1;
      exit when admitted >= p_limit;
    end if;
  end loop;
end;
$$;

revoke all on function private.lower_arr(text[]) from public, anon, authenticated;
revoke all on function private.identity_admitted(uuid) from public, anon, authenticated;
revoke all on function private.haversine_km(numeric,numeric,numeric,numeric) from public, anon, authenticated;
revoke all on function private.effective_radius_km(integer) from public, anon, authenticated;
revoke all on function private.schedule_fit(uuid,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function private.match_detail(uuid,uuid) from public, anon, authenticated;
revoke all on function private.dispatch_cheap_candidate_admitted(uuid,uuid) from public, anon, authenticated;
revoke all on function private.candidate_profile_ids(uuid,integer) from public, anon, authenticated;
