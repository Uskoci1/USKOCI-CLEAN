-- SOURCE ONLY / DISPOSABLE P6 PLACES cost candidate. Not a live migration.
-- Specialize PLACES before the wide generic projection so locality facets do not
-- materialize TaskCard-only columns for every matching Need.
do $p6_places_cost$
declare definition text; before_body text; anchor text; replacement text;
begin
 if current_user<>'postgres'
    or current_setting('p6_discovery.disposable',true) is distinct from 'SOURCE_ONLY_ROLLBACK'
  then raise exception 'P6_PLACES_COST_DISPOSABLE_ONLY'; end if;
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition
 from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)');
 if md5(replace(before_body,E'\r\n',E'\n'))<>'b26bd4eaaaf9aac612499a15c55c8eb5'
  then raise exception 'P6_PLACES_COST_SOURCE_DRIFT'; end if;
 anchor:=E' with base as materialized (\n';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'P6_PLACES_COST_ANCHOR_DRIFT'; end if;
 replacement:=$new$ if request_mode='PLACES' then
  with place_base as materialized (
   select n.id,n.published_at,n.execution_location_mode,n.approximate_city,n.approximate_area,
    n.approximate_lat,n.approximate_lng,n.required_slots,n.mode,n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,
    case when when_mode='any' and range_from is null then null::text[]
      else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days,
    case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,
    (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today
   from public.needs n
   where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
    and n.remaining_search_closed_at is null and n.published_at<=through_at
    and (price='all' or n.mode=price)
    and (location_mode='any' or location_mode='remote' and n.execution_location_mode='REMOTE'
      or location_mode='onsite' and n.execution_location_mode is not null and n.execution_location_mode<>'REMOTE')
    and (people=1 or greatest(0,coalesce(nullif(n.required_slots,0),1)
      -coalesce(public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))),0))>=people)
  ), place_wanted as materialized (
   select b.*,case when range_from is not null then array[range_from,range_to] else case when_mode
    when 'today' then array[today::text,today::text]
    when 'tomorrow' then array[(today+1)::text,(today+1)::text]
    when 'week' then array[today::text,(today+7-extract(isodow from today)::integer)::text]
    when 'next7' then array[today::text,(today+6)::text]
    when 'weekend' then array[(today+greatest(0,6-extract(isodow from today)::integer))::text,
                              (today+7-extract(isodow from today)::integer)::text]
    else null end end as wanted,
    case when scope_mode='ALL' then true when not has_point then false else
      approximate_lat between south and north and
      (west<=east and approximate_lng between west and east or west>east and (approximate_lng>=west or approximate_lng<=east))
    end as in_area
   from place_base b
  ), place_qualified as materialized (
   select w.*,(wanted is null or days[1]<=wanted[2] and days[2]>=wanted[1]) is true as time_ok
   from place_wanted w
  ), facet_source as materialized (
   select id,published_at,public.p6_discovery_area(approximate_area,approximate_city,false) as area_text
   from place_qualified where time_ok and execution_location_mode is distinct from 'REMOTE'
  ), facet_keys as materialized (
   select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at from facet_source
  ), facet_members as materialized (
   select * from facet_keys
   where key not in ('na daljinu','lokacija nije navedena')
    and (prefix_text='' or strpos(key,prefix_text)>0)
  ), facet_representatives as materialized (
   select distinct on(key) key,text from facet_members order by key,published_at desc,id desc
  ), facet_counts as materialized (
   select key,count(*) as count from facet_members group by key
  ), facets as materialized (
   select c.key,r.text,c.count from facet_counts c join facet_representatives r using(key)
  ), facet_page as materialized (
   select * from facets
   where before_count is null or count<before_count or count=before_count and
    (text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C")>
    (before_text collate pg_catalog."sr-Latn-RS-x-icu",before_key collate pg_catalog."C")
   order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C"
   limit page_limit+1
  ), facet_shown as materialized (
   select * from facet_page
   order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C"
   limit page_limit
  )
  select jsonb_build_object(
   'version','DISCOVERY_V1','mode','PLACES','asOf',now_at,'filterKey',filter_key,
   'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,
    'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
   'items',coalesce((select jsonb_agg(jsonb_build_object('key',key,'text',text,'count',count)
     order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C") from facet_shown),'[]'::jsonb),
   'hasMore',(select count(*)>page_limit from facet_page),
   'nextCursor',case when (select count(*)>page_limit from facet_page) then
    (select jsonb_build_object('count',count,'text',text,'key',key) from facet_shown
     order by count,text collate pg_catalog."sr-Latn-RS-x-icu" desc,key collate pg_catalog."C" desc limit 1)
    else null end,
   'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,
    'everywhere',(select count(*) from place_qualified where time_ok),
    'inArea',case when scope_mode='ALL' then null else
      (select count(*) from place_qualified where time_ok and has_point and in_area) end)
  ) into result;
  if exists(select 1 from jsonb_array_elements(result->'items') x
    where length(x->>'text')>500 or length(x->>'key')>500)
   then raise exception 'P6_PLACE_LABEL_TOO_LONG' using errcode='22023'; end if;
  return result;
 end if;
 with base as materialized (
$new$;
 definition:=replace(definition,anchor,replacement);
 execute definition;
end $p6_places_cost$;
