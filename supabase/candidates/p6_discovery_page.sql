-- SOURCE ONLY / LOCAL DISPOSABLE ROLLBACK FRAGMENT. Not a deployment migration.
-- Include inside the dedicated proof transaction; no existing authority is replaced.
do $guard$
begin
  if current_setting('p6_discovery.disposable',true) is distinct from 'SOURCE_ONLY_ROLLBACK'
     or current_user <> 'postgres' then raise exception 'P6_DISPOSABLE_ONLY'; end if;
  if to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null
     or exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'p6_discovery_%') then
    raise exception 'P6_ADDITIVE_SURFACE_ALREADY_EXISTS'; end if;
  if to_regcollation('pg_catalog."sr-Latn-RS-x-icu"') is null then raise exception 'P6_SERBIAN_ICU_REQUIRED'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.covered_slots(public.needs)'::regprocedure)
     is distinct from 'cbeb8f2a3da7d08965ef0386cfc437ba' then raise exception 'P6_COVERAGE_AUTHORITY_DRIFT'; end if;
end $guard$;

-- ECMAScript trim/\s characters, not PostgreSQL's narrower ASCII trim default.
create function public.p6_discovery_trim(value text) returns text language sql immutable security invoker set search_path=pg_catalog as $f$
 select btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$f$;
create function public.p6_discovery_key(value text) returns text language sql immutable security invoker set search_path=pg_catalog as $f$
 select lower(regexp_replace(public.p6_discovery_trim(value),U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+',' ','g') collate pg_catalog."sr-Latn-RS-x-icu")
$f$;
create function public.p6_discovery_unquote(value text) returns text language plpgsql immutable security invoker set search_path=pg_catalog as $f$
declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin
 if length(t)>1 then
  a:=left(t,1); b:=right(t,1);
  if (a,b) in (('"','"'),('„','“'),('“','”'),('''','''')) then
   inner_text:=substr(t,2,length(t)-2);
   if inner_text !~ '["„“”]' and (a<>'''' or strpos(inner_text,'''')=0) then
    return nullif(public.p6_discovery_trim(inner_text),'');
   end if;
  end if;
 end if;
 return nullif(t,'');
end $f$;
create function public.p6_discovery_area(area text,city text,remote boolean) returns text language plpgsql immutable security invoker set search_path=pg_catalog as $f$
declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;
 if a is null then return coalesce(c,'Lokacija nije navedena'); end if;
 if c is null or exists(select 1 from unnest(string_to_array(a,',')) s
   where lower(public.p6_discovery_trim(s) collate pg_catalog."sr-Latn-RS-x-icu")=lower(c collate pg_catalog."sr-Latn-RS-x-icu")) then return a; end if;
 return a||', '||c;
end $f$;
create function public.p6_discovery_days(kind text,starts timestamptz,ends timestamptz,zone text,anchor_at timestamptz)
returns text[] language plpgsql stable security invoker set search_path=pg_catalog as $f$
declare first_day text; last_day text; today date; instant timestamptz; local_time timestamp; z text:=coalesce(zone,'UTC');
begin
 if starts is not null and isfinite(starts) then
  first_day:=to_char(date_trunc('milliseconds',starts) at time zone z,'YYYY-MM-DD');
 end if;
 if ends is not null and isfinite(ends) then
  instant:=date_trunc('milliseconds',ends); local_time:=instant at time zone z;
  if to_char(local_time,'HH24:MI:SS')='00:00:00' then instant:=instant-interval '1 millisecond'; end if;
  last_day:=to_char(instant at time zone z,'YYYY-MM-DD');
 end if;
 if first_day is not null then return array[first_day,case when last_day>=first_day then last_day when kind='FIXED_WINDOW' then first_day else '9999-12-31' end]; end if;
 if last_day is not null then return case when kind='FIXED_WINDOW' then null else array['0000-01-01',last_day] end; end if;
 today:=(anchor_at at time zone z)::date;
 return case kind
  when 'TODAY_FLEXIBLE' then array[today::text,today::text]
  when 'TOMORROW_FLEXIBLE' then array[(today+1)::text,(today+1)::text]
  when 'WEEK_FLEXIBLE' then array[today::text,(today+(7-extract(isodow from today)::integer))::text]
  when 'FLEXIBLE' then array['0000-01-01','9999-12-31']
  when 'REMOTE_ANYTIME' then array['0000-01-01','9999-12-31'] else null end;
exception when invalid_parameter_value or datetime_field_overflow then return null;
end $f$;
create function public.p6_discovery_civil(value text) returns boolean language plpgsql immutable security invoker set search_path=pg_catalog as $f$
declare y integer; m integer; d integer; last_day integer;
begin
 if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
 y:=left(value,4)::integer; m:=substr(value,6,2)::integer; d:=right(value,2)::integer;
 if m<1 or m>12 then return false; end if;
 last_day:=(array[31,case when y%4=0 and (y%100<>0 or y%400=0) then 29 else 28 end,31,30,31,30,31,31,30,31,30,31])[m];
 return d between 1 and last_day;
end $f$;

create function public.rpc_discovery_v1(p_request jsonb) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog as $f$
declare
 r jsonb:=p_request; f jsonb; a jsonb; scope jsonb; cursor_doc jsonb; result jsonb;
 query_text text; locality text; price text; location_mode text; when_mode text; scope_mode text; request_mode text;
 filter_key text; scope_key text; need_id uuid; people integer; page_limit integer;
 now_at timestamptz:=statement_timestamp(); time_at timestamptz; through_at timestamptz; expires_at timestamptz;
 before_at timestamptz; before_id uuid; before_section integer;
 west numeric; south numeric; east numeric; north numeric; point_lat numeric; point_lng numeric;
 range_from text; range_to text; iso_pattern text:='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$';
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(r) is distinct from 'object' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
 request_mode:=r->>'mode';
 if request_mode='EXACT_PUBLIC' then
  if r-array['mode','needId']<>'{}' or not(r?&array['mode','needId']) or jsonb_typeof(r->'needId')<>'string'
    or r->>'needId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  need_id:=(r->>'needId')::uuid; time_at:=now_at; through_at:=now_at; page_limit:=1;
  f:='{"text":"","price":"all","where":"any","places":1,"when":"any","dates":null,"place":null}';
  scope:='{"kind":"ALL"}';
 elsif request_mode='PAGE' then
  if r-array['mode','filter','anchor','scope','limit','after']<>'{}' or not(r?&array['mode','filter','anchor','scope','limit','after'])
    or jsonb_typeof(r->'limit')<>'number' or (r->>'limit')::numeric<>trunc((r->>'limit')::numeric)
    or (r->>'limit')::numeric not between 1 and 100 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  page_limit:=(r->>'limit')::integer; f:=r->'filter'; scope:=r->'scope';
 else raise exception 'P6_MODE_NOT_IMPLEMENTED' using errcode='22023'; end if;
 if jsonb_typeof(f) is distinct from 'object' or f-array['text','price','where','places','when','dates','place']<>'{}'
   or not(f?&array['text','price','where','places','when','dates','place'])
   or jsonb_typeof(f->'text')<>'string' or octet_length(f->>'text')>16000
   or coalesce(f->>'price','') not in ('all','MY_PRICE','OFFERS') or coalesce(f->>'where','') not in ('any','onsite','remote')
   or coalesce(f->>'when','') not in ('any','today','tomorrow','week','weekend','next7')
   or jsonb_typeof(f->'places')<>'number' or (f->>'places')::numeric<>trunc((f->>'places')::numeric)
   or (f->>'places')::numeric not between 1 and 10 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
 query_text:=lower(public.p6_discovery_trim(f->>'text') collate pg_catalog."sr-Latn-RS-x-icu");
 price:=f->>'price'; location_mode:=f->>'where'; people:=(f->>'places')::integer; when_mode:=f->>'when';
 if f->'dates'<>'null'::jsonb then
  if jsonb_typeof(f->'dates')<>'object' or (f->'dates')-array['from','to']<>'{}'
    or not public.p6_discovery_civil(f#>>'{dates,from}') or not public.p6_discovery_civil(f#>>'{dates,to}')
    or f#>>'{dates,from}'>f#>>'{dates,to}' then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  range_from:=f#>>'{dates,from}'; range_to:=f#>>'{dates,to}'; when_mode:='any';
 end if;
 if f->'place'<>'null'::jsonb then
  if jsonb_typeof(f->'place')<>'string' or octet_length(f->>'place')>16000 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  locality:=nullif(public.p6_discovery_key(f->>'place'),'');
 end if;
 if location_mode='remote' then locality:=null; scope:='{"kind":"ALL"}'; end if;
 f:=jsonb_build_object('text',query_text,'price',price,'where',location_mode,'places',people,'when',when_mode,
   'dates',case when range_from is null then null else jsonb_build_object('from',range_from,'to',range_to) end,'place',locality);
 filter_key:=md5(f::text);
 if request_mode='PAGE' then
  if r->'anchor'='null'::jsonb then
   if r->'after'<>'null'::jsonb then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
   time_at:=now_at; through_at:=now_at; expires_at:=now_at+interval '30 minutes';
  else
   a:=r->'anchor';
   if jsonb_typeof(a)<>'object' or a-array['version','filterKey','timeAt','publishedThrough','expiresAt']<>'{}'
     or not(a?&array['version','filterKey','timeAt','publishedThrough','expiresAt'])
     or a->>'version' is distinct from 'DISCOVERY_V1' or a->>'filterKey' is distinct from filter_key
     or coalesce(a->>'timeAt','')!~iso_pattern or coalesce(a->>'publishedThrough','')!~iso_pattern or coalesce(a->>'expiresAt','')!~iso_pattern
     then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;
   time_at:=(a->>'timeAt')::timestamptz; through_at:=(a->>'publishedThrough')::timestamptz; expires_at:=(a->>'expiresAt')::timestamptz;
   if not isfinite(time_at) or time_at>now_at or through_at<>time_at or expires_at<>time_at+interval '30 minutes' then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;
   if expires_at<=now_at then raise exception 'P6_ANCHOR_EXPIRED' using errcode='22023'; end if;
  end if;
 end if;
 if jsonb_typeof(scope) is distinct from 'object' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 scope_mode:=scope->>'kind';
 if scope_mode='ALL' then
  if scope-array['kind']<>'{}' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 elsif scope_mode='AREA' then
  if scope-array['kind','bounds']<>'{}' or jsonb_typeof(scope->'bounds') is distinct from 'array' or jsonb_array_length(scope->'bounds')<>4
    or exists(select 1 from jsonb_array_elements(scope->'bounds') x where jsonb_typeof(x)<>'number') then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  west:=(scope#>>'{bounds,0}')::numeric; south:=(scope#>>'{bounds,1}')::numeric; east:=(scope#>>'{bounds,2}')::numeric; north:=(scope#>>'{bounds,3}')::numeric;
  if abs(west)>180 or abs(east)>180 or south< -90 or north>90 or south>north then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  scope:=jsonb_build_object('kind',scope_mode,'bounds',jsonb_build_array(west::double precision,south::double precision,east::double precision,north::double precision));
 elsif scope_mode in ('POINT_LIST','POINT_MEMBERS') then
  if scope-array['kind','point']<>'{}' or jsonb_typeof(scope->'point') is distinct from 'object' or (scope->'point')-array['lat','lng']<>'{}'
    or jsonb_typeof(scope#>'{point,lat}') is distinct from 'number' or jsonb_typeof(scope#>'{point,lng}') is distinct from 'number' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  point_lat:=(scope#>>'{point,lat}')::numeric; point_lng:=(scope#>>'{point,lng}')::numeric;
  if abs(point_lat)>90 or abs(point_lng)>180 or round(point_lat,2)<>point_lat or round(point_lng,2)<>point_lng then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  scope:=jsonb_build_object('kind',scope_mode,'point',jsonb_build_object('lat',point_lat::double precision,'lng',point_lng::double precision));
 else raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 scope_key:=md5(jsonb_build_object('filterKey',filter_key,'scope',scope,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text);
 cursor_doc:=r->'after';
 if request_mode='PAGE' and cursor_doc<>'null'::jsonb then
  if jsonb_typeof(cursor_doc)<>'object' or cursor_doc-array['scopeKey','section','sortAt','id']<>'{}'
    or not(cursor_doc?&array['scopeKey','section','sortAt','id']) or cursor_doc->>'scopeKey' is distinct from scope_key
    or cursor_doc->'section' not in ('0'::jsonb,'1'::jsonb) or coalesce(cursor_doc->>'sortAt','')!~iso_pattern
    or coalesce(cursor_doc->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
  before_at:=(cursor_doc->>'sortAt')::timestamptz; before_id:=(cursor_doc->>'id')::uuid; before_section:=(cursor_doc->>'section')::integer;
  if before_at>through_at or (scope_mode in ('ALL','POINT_MEMBERS') and before_section<>0) then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
 end if;
 with base as materialized (
  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.urgent,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,
   n.task_country_code,n.task_timezone,n.verified_identity_required,n.approximate_city,n.approximate_area,n.approximate_lat,n.approximate_lng,
   n.required_slots,n.required_skills,n.required_tools,n.required_vehicles,n.required_licenses,n.minimum_experience_years,n.mode,
   n.requester_price_rsd,n.price_basis,n.requester_profile_id,n.response_deadline,
   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,
   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,
   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,
   case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,
   (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today
  from public.needs n where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null
   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode='PAGE' and n.published_at<=through_at)
 ), shared as materialized (
  select b.*,case when range_from is not null then array[range_from,range_to] else case when_mode
   when 'today' then array[today::text,today::text] when 'tomorrow' then array[(today+1)::text,(today+1)::text]
   when 'week' then array[today::text,(today+7-extract(isodow from today)::integer)::text]
   when 'next7' then array[today::text,(today+6)::text]
   when 'weekend' then array[(today+greatest(0,6-extract(isodow from today)::integer))::text,(today+7-extract(isodow from today)::integer)::text] else null end end as wanted
  from base b where (price='all' or b.mode=price)
   and (location_mode='any' or location_mode='remote' and b.execution_location_mode='REMOTE'
     or location_mode='onsite' and b.execution_location_mode is not null and b.execution_location_mode<>'REMOTE')
   and (people=1 or greatest(0,coalesce(nullif(b.required_slots,0),1)-coalesce(b.covered_now,0))>=people)
   and (locality is null or b.execution_location_mode is distinct from 'REMOTE' and public.p6_discovery_key(b.area_text)=locality
     and public.p6_discovery_key(b.area_text) not in ('na daljinu','lokacija nije navedena'))
   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text||' '||array_to_string(coalesce(b.required_skills,'{}')||coalesce(b.required_tools,'{}')||coalesce(b.required_vehicles,'{}'),' ')) collate pg_catalog."sr-Latn-RS-x-icu"),query_text)>0)
 ), qualified as materialized (
  select s.*,(wanted is null or days[1]<=wanted[2] and days[2]>=wanted[1]) is true as time_ok,
   case when scope_mode='ALL' then true when not has_point then false when scope_mode='AREA' then
    approximate_lat between south and north and (west<=east and approximate_lng between west and east or west>east and (approximate_lng>=west or approximate_lng<=east))
    else approximate_lat=point_lat and approximate_lng=point_lng end as in_area
  from shared s
 ), scoped as materialized (
  select q.*,case when scope_mode in ('AREA','POINT_LIST') and not has_point then 1 else 0 end as section
  from qualified q where in_area or not has_point and scope_mode in ('AREA','POINT_LIST')
 ), page as materialized (
  select * from scoped where time_ok and (before_id is null or section>before_section or section=before_section and (published_at,id)<(before_at,before_id))
  order by section,published_at desc,id desc limit page_limit+1
 ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as (
  select s.section,s.published_at,s.id,jsonb_build_object(
   'id',s.id,'revision',s.revision,'sortAt',to_char(s.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedAt',s.published_at,'title',s.title,'category',s.category,'status',s.status,'urgent',s.urgent,
   'scheduleKind',s.schedule_kind,'startsAt',s.starts_at,'endsAt',s.ends_at,'executionLocationMode',s.execution_location_mode,
   'taskCountryCode',s.task_country_code,'taskTimezone',s.task_timezone,'verifiedIdentityRequired',s.verified_identity_required,
   'approximateCity',nullif(btrim(s.approximate_city),''),'approximateArea',nullif(btrim(s.approximate_area),''),
   'pin',case when not s.has_point then null else jsonb_build_object('lat',s.approximate_lat,'lng',s.approximate_lng,'precision','COARSE_1KM') end,
   'requiredSlots',s.required_slots,'coveredSlots',s.covered_now,'requiredSkills',to_jsonb(s.required_skills),'requiredTools',to_jsonb(s.required_tools),
   'requiredVehicles',to_jsonb(s.required_vehicles),'requiredLicenses',to_jsonb(s.required_licenses),'minimumExperienceYears',s.minimum_experience_years,
   'priceMode',s.mode,'requesterPriceRsd',s.requester_price_rsd,'priceBasis',s.price_basis,'requesterProfileId',s.requester_profile_id,
   'responseDeadline',s.response_deadline,'acceptsApplications',s.required_slots>s.covered_now and (s.response_deadline is null or s.response_deadline>now_at),
   'publicTopology',(select g.public_topology from public.need_geography g where g.need_id=s.id),
   'criticalConditions',(select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id=s.id)) as item from shown s
 ) select jsonb_build_object('version','DISCOVERY_V1','mode',request_mode,'asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'items',coalesce((select jsonb_agg(item order by section,published_at desc,id desc) from projected),'[]'::jsonb),
  'hasMore',(select count(*)>page_limit from page),
  'nextCursor',case when (select count(*)>page_limit from page) then (select jsonb_build_object('scopeKey',scope_key,'section',section,
   'sortAt',to_char(published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'id',id) from shown order by section desc,published_at,id limit 1) else null end,
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,
   'mapped',case when scope_mode='POINT_MEMBERS' then (select count(*) from scoped where time_ok) else (select count(*) from qualified where time_ok) end,
   'listed',(select count(*) from scoped where time_ok),'inArea',(select count(*) from scoped where time_ok and in_area),
   'withoutPoint',(select count(*) from scoped where time_ok and section=1),
   'undated',(select count(*) from scoped where wanted is not null and days is null)),
  'availability',jsonb_build_object('hasKnownWorkMode',exists(select 1 from base where execution_location_mode is not null),
   'hasKnownSchedule',exists(select 1 from base where days is not null),'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from base) modes))) into result;
 if request_mode='EXACT_PUBLIC' then return result-array['anchor','filterKey','counts','availability']; end if;
 return result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
 raise exception 'P6_INVALID_REQUEST' using errcode='22023';
end $f$;

revoke all on function public.p6_discovery_trim(text),public.p6_discovery_key(text),public.p6_discovery_unquote(text),
 public.p6_discovery_area(text,text,boolean),public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz),
 public.p6_discovery_civil(text),public.rpc_discovery_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.p6_discovery_trim(text),public.p6_discovery_key(text),public.p6_discovery_unquote(text),
 public.p6_discovery_area(text,text,boolean),public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz),
 public.p6_discovery_civil(text),public.rpc_discovery_v1(jsonb) to authenticated;
