-- P6 DEPLOYMENT CANDIDATE V3 - NOT APPLIED. Composed by scripts/proofs/build-p6-rollout-v3.mjs; do not edit by hand.
-- One transaction: (1) the FROZEN P6 rollout (sha256 ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c, bytes unchanged except its final commit),
-- (2) the proven visibility-cost layer (sha256 a988f403b419cc70b5c7f1f40101d566c58483781d1663b573910806880ecae3) with ONE change: its statement-level TEST-world set is DERIVED from the
--     account classifier (private.account_visibility_world(account)='TEST') instead of a fixed list of lineages, so it follows the classifier by construction.
--     (Canonical DEV holds OWNER_PERSONAL and OWNER_BUSINESS in the TEST world, PKG-029e; the fixed list of v2 was refused there with P6_VISIBILITY_SEMANTIC_MISMATCH:16.)
-- (3) the proven PLACES-cost layer (sha256 9297c4a1dda330969c79daf0af5a0752b02a496231978b240c35ca6dccb499f9),
-- with only the layers' disposable-only guard replaced by a postgres-only guard. Requires PKG045b already restricted.
-- P6 live apply still needs its package-specific authorization/procedure; this file only freezes the composed bytes.
-- P6 DEPLOYMENT CANDIDATE — NOT APPLIED.
-- Requires the already owner-approved PKG045b restriction AFTER its compatible-device gate is actually satisfied.
-- P6 itself still requires the active package-specific apply authorization/procedure. This file only freezes bytes.
-- Source stack proven before freezing:
--   p6_discovery_all.sql sha256 1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e
--   p6_discovery_cost_v2.sql sha256 4eae3b7befc498318c504bc40c344d72962c0a7e97dcb426bb65df3637944ba3
--   p6_discovery_cost_v3.sql sha256 88cc4d2271ac4a5695a7b831737f80ffcaecc40b2cc9e887200d90825191d05b
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table p6_rollout_before(cert text,erasure text,digest text,ready boolean,needs_acl text) on commit drop;
insert into p6_rollout_before
select (select sha256 from private.closure_source_v5 where singleton),
       (select sha256 from private.closure_erasure_source_v5 where singleton),
       private.closure_source_digest_v5(),private.retention_ai_source_ready(),
       (select relacl::text from pg_class where oid='public.needs'::regclass);
do $p6_rollout_pre$
declare c text;
begin
 if current_user<>'postgres' then raise exception 'P6_ROLLOUT_POSTGRES_ONLY'; end if;
 if to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null
    or exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'p6_discovery_%')
   then raise exception 'P6_ROLLOUT_ALREADY_INSTALLED'; end if;
 if to_regcollation('pg_catalog."sr-Latn-RS-x-icu"') is null then raise exception 'P6_SERBIAN_ICU_REQUIRED'; end if;
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure('public.covered_slots(public.needs)'))
    is distinct from 'cbeb8f2a3da7d08965ef0386cfc437ba' then raise exception 'P6_COVERAGE_AUTHORITY_DRIFT'; end if;
 select cert into strict c from p6_rollout_before;
 if c is null or (select erasure from p6_rollout_before) is distinct from c
    or (select digest from p6_rollout_before) is distinct from c or not (select ready from p6_rollout_before)
   then raise exception 'P6_CERTIFICATE_NOT_READY'; end if;
 -- Exact PKG045b privilege boundary: P6 must not roll out on the still-broad predecessor.
 if has_table_privilege('authenticated','public.needs','SELECT') or has_table_privilege('anon','public.needs','SELECT')
    or exists(select 1 from unnest(array['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason']) x
      where has_column_privilege('authenticated','public.needs',x,'SELECT') or has_column_privilege('anon','public.needs',x,'SELECT'))
   then raise exception 'P6_PKG045B_REQUIRED'; end if;
 if exists(select 1 from unnest(array['id','requester_profile_id','status','title','description','category','approximate_city','approximate_area','approximate_lat','approximate_lng','schedule_kind','starts_at','ends_at','required_slots','mode','requester_price_rsd','required_skills','required_tools','required_vehicles','verified_identity_required','urgent','public_photo_paths','revision','published_at','created_at','updated_at','response_deadline','urgent_activated_at','urgent_expires_at','urgent_policy_version','minimum_experience_years','execution_location_mode','approx_geog','required_licenses','remaining_search_closed_at','task_country_code','task_timezone','price_basis']) x
      where not has_column_privilege('authenticated','public.needs',x,'SELECT')
         or has_column_privilege('anon','public.needs',x,'SELECT'))
   then raise exception 'P6_PKG045B_ALLOWLIST_DRIFT'; end if;
end $p6_rollout_pre$;

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
 grid integer; grid_cells numeric; grid_w numeric; grid_e numeric; grid_s numeric; grid_n numeric; grid_width numeric;
 prefix_text text; facet_area jsonb; before_count bigint; before_text text; before_key text;
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
 elsif request_mode='MAP' then
  if r-array['mode','filter','anchor','bounds','grid']<>'{}' or not(r?&array['mode','filter','anchor','bounds','grid'])
    or jsonb_typeof(r->'grid') is distinct from 'number' or (r->>'grid')::numeric<>trunc((r->>'grid')::numeric)
    or (r->>'grid')::numeric not between 1 and 24 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  grid:=(r->>'grid')::integer; f:=r->'filter'; scope:=jsonb_build_object('kind','AREA','bounds',r->'bounds'); page_limit:=1;
 elsif request_mode='PLACES' then
  if r-array['mode','filter','anchor','prefix','facetArea','limit','after']<>'{}'
    or not(r?&array['mode','filter','anchor','prefix','facetArea','limit','after'])
    or jsonb_typeof(r->'prefix') is distinct from 'string' or length(r->>'prefix')>500
    or jsonb_typeof(r->'limit') is distinct from 'number' or (r->>'limit')::numeric<>trunc((r->>'limit')::numeric)
    or (r->>'limit')::numeric not between 1 and 30 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  prefix_text:=public.p6_discovery_key(r->>'prefix'); f:=r->'filter'; page_limit:=(r->>'limit')::integer;
  facet_area:=r->'facetArea';
  scope:=case when facet_area='null'::jsonb then '{"kind":"ALL"}'::jsonb else jsonb_build_object('kind','AREA','bounds',facet_area) end;
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
 if request_mode='PLACES' then query_text:=''; locality:=null; end if;
 if location_mode='remote' then
  locality:=null;
  if request_mode<>'MAP' then scope:='{"kind":"ALL"}'; facet_area:='null'::jsonb; end if;
 end if;
 f:=jsonb_build_object('text',query_text,'price',price,'where',location_mode,'places',people,'when',when_mode,
   'dates',case when range_from is null then null else jsonb_build_object('from',range_from,'to',range_to) end,'place',locality);
 -- PLACES binds its prefix/area too; the documented count/text/key cursor
 -- cannot be reused under another facet context without a fresh anchor.
 filter_key:=md5(case when request_mode='PLACES' then jsonb_build_object('filter',f,'prefix',prefix_text,'facetArea',facet_area)::text else f::text end);
 if request_mode in ('PAGE','MAP','PLACES') then
  if r->'anchor'='null'::jsonb then
   if request_mode<>'MAP' and r->'after'<>'null'::jsonb then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
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
 if request_mode='PLACES' and cursor_doc<>'null'::jsonb then
  if jsonb_typeof(cursor_doc) is distinct from 'object' or cursor_doc-array['count','text','key']<>'{}'
    or not(cursor_doc?&array['count','text','key']) or jsonb_typeof(cursor_doc->'count') is distinct from 'number'
    or (cursor_doc->>'count')::numeric<>trunc((cursor_doc->>'count')::numeric)
    or (cursor_doc->>'count')::numeric not between 1 and 9007199254740991
    or jsonb_typeof(cursor_doc->'text') is distinct from 'string' or length(cursor_doc->>'text') not between 1 and 500
    or jsonb_typeof(cursor_doc->'key') is distinct from 'string' or length(cursor_doc->>'key') not between 1 and 500
    or public.p6_discovery_key(cursor_doc->>'text') is distinct from cursor_doc->>'key'
    then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
  before_count:=(cursor_doc->>'count')::bigint; before_text:=cursor_doc->>'text'; before_key:=cursor_doc->>'key';
 end if;
 if request_mode='MAP' then
  -- World-anchored grid covers the whole box; never truncate the first N pins.
  loop
   grid_cells:=power(2::numeric,grid);
   grid_w:=least(grid_cells-1,floor((west+180)/360*grid_cells));
   grid_e:=least(grid_cells-1,floor((east+180)/360*grid_cells));
   grid_s:=least(grid_cells-1,floor((south+90)/180*grid_cells));
   grid_n:=least(grid_cells-1,floor((north+90)/180*grid_cells));
   grid_width:=case when west<=east then grid_e-grid_w+1 else least(grid_cells,grid_cells-grid_w+grid_e+1) end;
   exit when grid_width*(grid_n-grid_s+1)<=256;
   grid:=grid-1;
   if grid<1 then raise exception 'P6_GRID_BOUND_FAILED'; end if;
  end loop;
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
   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode in ('PAGE','MAP','PLACES') and n.published_at<=through_at)
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
  select * from scoped where request_mode in ('PAGE','EXACT_PUBLIC') and time_ok and (before_id is null or section>before_section or section=before_section and (published_at,id)<(before_at,before_id))
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
 ), map_points as materialized (
  select q.id,q.published_at,q.approximate_lat as lat,q.approximate_lng as lng,
   least(grid_cells-1,floor((q.approximate_lng+180)/360*grid_cells)) as gx,
   least(grid_cells-1,floor((q.approximate_lat+90)/180*grid_cells)) as gy
  from qualified q where request_mode='MAP' and time_ok and has_point and in_area
 ), map_representatives as (
  select distinct on(gx,gy) gx,gy,id,lat,lng from map_points order by gx,gy,published_at desc,id desc
 ), map_groups as (
  select gx,gy,count(*) as tasks,count(distinct (lat,lng)) as points,
   min(lng) as left_edge,min(lat) as bottom_edge,max(lng) as right_edge,max(lat) as top_edge
  from map_points group by gx,gy
 ), map_buckets as (
  select g.gx,g.gy,
   case when g.tasks=1 then jsonb_build_object('kind','TASK','key','task:'||m.id,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),'taskId',m.id)
    when g.points=1 then jsonb_build_object('kind','PLACE','key','place:'||m.lat||':'||m.lng,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),'taskCount',g.tasks)
    else jsonb_build_object('kind','CLUSTER','key','cluster:'||grid||':'||g.gx||':'||g.gy,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),
      'taskCount',g.tasks,'distinctPointCount',g.points,'memberBounds',jsonb_build_array(g.left_edge,g.bottom_edge,g.right_edge,g.top_edge)) end as bucket
  from map_groups g join map_representatives m using(gx,gy)
 ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as (
  select distinct on(key) key,text from facet_members order by key,published_at desc,id desc
 ), facet_counts as (select key,count(*) as count from facet_members group by key), facets as (
  select c.key,r.text,c.count from facet_counts c join facet_representatives r using(key)
 ), facet_page as materialized (
  select * from facets where before_count is null or count<before_count or count=before_count and
   (text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C")>(before_text collate pg_catalog."sr-Latn-RS-x-icu",before_key collate pg_catalog."C")
  order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C" limit page_limit+1
 ), facet_shown as (
  select * from facet_page order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C" limit page_limit
 ) select case when request_mode='MAP' then jsonb_build_object(
  'version','DISCOVERY_V1','mode','MAP','asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'coverageBounds',scope->'bounds','effectiveGrid',grid,
  'wholeBounds',(select case when count(*)=0 then null else jsonb_build_array(min(approximate_lng),min(approximate_lat),max(approximate_lng),max(approximate_lat)) end from qualified where time_ok and has_point),
  'buckets',coalesce((select jsonb_agg(bucket order by gx,gy) from map_buckets),'[]'::jsonb),
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,'mapped',(select count(*) from qualified where time_ok),
   'withoutPoint',(select count(*) from qualified where time_ok and not has_point)))
 when request_mode='PLACES' then jsonb_build_object(
  'version','DISCOVERY_V1','mode','PLACES','asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'items',coalesce((select jsonb_agg(jsonb_build_object('key',key,'text',text,'count',count) order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C") from facet_shown),'[]'::jsonb),
  'hasMore',(select count(*)>page_limit from facet_page),
  'nextCursor',case when (select count(*)>page_limit from facet_page) then
   (select jsonb_build_object('count',count,'text',text,'key',key) from facet_shown
    order by count,text collate pg_catalog."sr-Latn-RS-x-icu" desc,key collate pg_catalog."C" desc limit 1) else null end,
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,'everywhere',(select count(*) from qualified where time_ok),
   'inArea',case when scope_mode='ALL' then null else (select count(*) from qualified where time_ok and has_point and in_area) end))
 else jsonb_build_object('version','DISCOVERY_V1','mode',request_mode,'asOf',now_at,'filterKey',filter_key,
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
   'hasKnownSchedule',exists(select 1 from base where days is not null),'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from base) modes))) end into result;
 if request_mode='EXACT_PUBLIC' then return result-array['anchor','filterKey','counts','availability']; end if;
 if request_mode='MAP' and jsonb_array_length(result->'buckets')>256 then raise exception 'P6_MAP_BOUND_FAILED'; end if;
 if request_mode='PLACES' and exists(select 1 from jsonb_array_elements(result->'items') x
   where length(x->>'text')>500 or length(x->>'key')>500) then raise exception 'P6_PLACE_LABEL_TOO_LONG' using errcode='22023'; end if;
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


-- SOURCE-ONLY P6 cost delta, layered on the exact Round44 candidate.
-- It changes only the newly introduced P6 functions, not existing authority.
-- Requires the same disposable marker; NOT a canonical DEV apply migration.
do $p6_cost_v2$
declare signature text; definition text; before_body text;
begin
 if current_user<>'postgres' then raise exception 'P6_ROLLOUT_POSTGRES_ONLY'; end if;
 signature:='public.p6_discovery_unquote(text)';
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure(signature);
 if md5(replace(before_body,E'\r\n',E'\n'))<>'d9ab01e57fb2f667ee865f69aa246741' then raise exception 'P6_COST_SOURCE_DRIFT:%',signature; end if;
 if (length(definition)-length(replace(definition,$old$declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin$old$,'')))/length($old$declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$declare t text:=public.p6_discovery_trim(value); inner_text text; a text; b text;
begin$old$,$new$declare t text; inner_text text; a text; b text;
begin
 if value is null or value='' then return null; end if;
 t:=public.p6_discovery_trim(value);$new$);
 execute definition;
 signature:='public.p6_discovery_area(text,text,boolean)';
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure(signature);
 if md5(replace(before_body,E'\r\n',E'\n'))<>'65f41c2ec10d1bb926f34ecf04b36ec4' then raise exception 'P6_COST_SOURCE_DRIFT:%',signature; end if;
 if (length(definition)-length(replace(definition,$old$declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;$old$,'')))/length($old$declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$declare a text:=public.p6_discovery_unquote(area); c text:=public.p6_discovery_unquote(city);
begin
 if remote then return 'Na daljinu'; end if;$old$,$new$declare a text; c text;
begin
 if remote then return 'Na daljinu'; end if;
 a:=public.p6_discovery_unquote(area);
 if a is not null and (city is null or city='') then return a; end if;
 c:=public.p6_discovery_unquote(city);$new$);
 execute definition;
 signature:='public.rpc_discovery_v1(jsonb)';
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure(signature);
 if md5(replace(before_body,E'\r\n',E'\n'))<>'59dade053b40ebc72046c5397cc7622b' then raise exception 'P6_COST_SOURCE_DRIFT:%',signature; end if;
 if (length(definition)-length(replace(definition,$old$   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,$old$,'')))/length($old$   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) as covered_now,$old$,$new$   case when people>1 then public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) else null::integer end as covered_now,$new$);
 if (length(definition)-length(replace(definition,$old$   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,$old$,'')))/length($old$   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) as days,$old$,$new$   case when request_mode in ('MAP','PLACES') and when_mode='any' and range_from is null then null::text[] else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days,$new$);
 if (length(definition)-length(replace(definition,$old$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as ($old$,'')))/length($old$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as ($old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit), projected as ($old$,$new$ ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit),
 shown_covered as materialized (
  select s.*,coalesce(s.covered_now,public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',s.id)))) as projected_covered from shown s
 ), projected as ($new$);
 if (length(definition)-length(replace(definition,$old$'coveredSlots',s.covered_now,$old$,'')))/length($old$'coveredSlots',s.covered_now,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$'coveredSlots',s.covered_now,$old$,$new$'coveredSlots',s.projected_covered,$new$);
 if (length(definition)-length(replace(definition,$old$'acceptsApplications',s.required_slots>s.covered_now and$old$,'')))/length($old$'acceptsApplications',s.required_slots>s.covered_now and$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$'acceptsApplications',s.required_slots>s.covered_now and$old$,$new$'acceptsApplications',s.required_slots>s.projected_covered and$new$);
 if (length(definition)-length(replace(definition,$old$ as item from shown s
 ), map_points$old$,'')))/length($old$ as item from shown s
 ), map_points$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ as item from shown s
 ), map_points$old$,$new$ as item from shown_covered s
 ), map_points$new$);
 if (length(definition)-length(replace(definition,$old$ ), map_representatives as ($old$,'')))/length($old$ ), map_representatives as ($old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ ), map_representatives as ($old$,$new$ ), map_representatives as materialized ($new$);
 if (length(definition)-length(replace(definition,$old$ ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as ($old$,'')))/length($old$ ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as ($old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$ ), facet_members as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
   and public.p6_discovery_key(area_text) not in ('na daljinu','lokacija nije navedena')
   and (prefix_text='' or strpos(public.p6_discovery_key(area_text),prefix_text)>0)
 ), facet_representatives as ($old$,$new$ ), facet_keys as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
 ), facet_members as materialized (
  select * from facet_keys where key not in ('na daljinu','lokacija nije navedena') and (prefix_text='' or strpos(key,prefix_text)>0)
 ), facet_representatives as materialized ($new$);
 execute definition;
end $p6_cost_v2$;

-- SOURCE ONLY: layer on the exact P6 original plus cost_v2. Not a live migration.
-- Avoid locality normalization only when no consumer needs it, retaining the
-- complete original concatenated-text fallback, including cross-field matches.
do $p6_cost_v3$
declare definition text; before_body text;
begin
 if current_user<>'postgres' then raise exception 'P6_ROLLOUT_POSTGRES_ONLY'; end if;
 select prosrc,pg_get_functiondef(oid) into strict before_body,definition from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)');
 if md5(replace(before_body,E'\r\n',E'\n'))<>'008c92e33b8edfbe3cc7b5263b99dac8' then raise exception 'P6_COST_V2_SOURCE_DRIFT'; end if;
 if (length(definition)-length(replace(definition,$old$   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,$old$,'')))/length($old$   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE') as area_text,$old$,$new$   case when request_mode='PLACES' or locality is not null
     or query_text<>'' and strpos(lower(coalesce(n.title,'') collate pg_catalog."sr-Latn-RS-x-icu"),query_text)=0
    then public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE')
    else null::text end as area_text,$new$);
 if (length(definition)-length(replace(definition,$old$   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text$old$,'')))/length($old$   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text$old$)<>1 then raise exception 'P6_COST_ANCHOR_DRIFT'; end if;
 definition:=replace(definition,$old$   and (query_text='' or strpos(lower((coalesce(b.title,'')||' '||b.area_text$old$,$new$   and (query_text='' or strpos(lower(coalesce(b.title,'') collate pg_catalog."sr-Latn-RS-x-icu"),query_text)>0
    or strpos(lower((coalesce(b.title,'')||' '||b.area_text$new$);
 execute definition;
end $p6_cost_v3$;


do $p6_rollout_post$
declare c text; fn text;
begin
 select cert into strict c from p6_rollout_before;
 if private.closure_source_digest_v5() is distinct from c
    or (select sha256 from private.closure_source_v5 where singleton) is distinct from c
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from c
    or private.retention_ai_source_ready() is distinct from true
   then raise exception 'P6_ROLLOUT_CERTIFICATE_MOVED'; end if;
 if (select relacl::text from pg_class where oid='public.needs'::regclass) is distinct from (select needs_acl from p6_rollout_before)
   then raise exception 'P6_ROLLOUT_NEEDS_ACL_MOVED'; end if;
 foreach fn in array array['public.p6_discovery_trim(text)','public.p6_discovery_key(text)','public.p6_discovery_unquote(text)','public.p6_discovery_area(text,text,boolean)','public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)','public.p6_discovery_civil(text)','public.rpc_discovery_v1(jsonb)'] loop
  if to_regprocedure(fn) is null then raise exception 'P6_ROLLOUT_FUNCTION_MISSING:%',fn; end if;
  if not has_function_privilege('authenticated',fn,'EXECUTE')
     or has_function_privilege('anon',fn,'EXECUTE')
     or has_function_privilege('service_role',fn,'EXECUTE')
   then raise exception 'P6_ROLLOUT_FUNCTION_ACL:%',fn; end if;
 end loop;
 if exists(select 1 from pg_proc where oid in (
      to_regprocedure('public.p6_discovery_trim(text)'),to_regprocedure('public.p6_discovery_key(text)'),
      to_regprocedure('public.p6_discovery_unquote(text)'),to_regprocedure('public.p6_discovery_area(text,text,boolean)'),
      to_regprocedure('public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)'),
      to_regprocedure('public.p6_discovery_civil(text)'),to_regprocedure('public.rpc_discovery_v1(jsonb)'))
    and (prosecdef or proconfig is distinct from array['search_path=pg_catalog']))
   then raise exception 'P6_ROLLOUT_SECURITY_MODE'; end if;
end $p6_rollout_post$;

-- ===== v3 layer 1: visibility cost (statement-level TEST world set derived from the classifier; REAL/TEST boundary preserved) =====
-- SOURCE ONLY / DISPOSABLE P6 visibility-cost candidate. Not a live migration.
-- Preserve the existing REAL/TEST boundary exactly, but evaluate the tiny TEST account set
-- once per statement instead of calling the nested lineage classifier once per Need row.
do $p6_visibility_pre$
declare public_qual text; closed_qual text;
begin
  if current_user<>'postgres'
    then raise exception 'P6_VISIBILITY_POSTGRES_ONLY'; end if;
  if to_regprocedure('rls_private.p6_discovery_test_world_accounts()') is not null
    then raise exception 'P6_VISIBILITY_ALREADY_INSTALLED'; end if;
  select qual into strict public_qual from pg_policies
    where schemaname='public' and tablename='needs' and policyname='needs_public_discovery';
  select qual into strict closed_qual from pg_policies
    where schemaname='public' and tablename='needs' and policyname='v5_closed_account_visibility';
  if position('private.viewer_same_world(requester_account_id)' in public_qual)=0
    then raise exception 'P6_VISIBILITY_WORLD_PREDECESSOR_DRIFT'; end if;
  if position('rpc_storage_account_open()' in closed_qual)=0
    then raise exception 'P6_VISIBILITY_CLOSURE_PREDECESSOR_DRIFT'; end if;
  create temporary table p6_visibility_before(source_digest text,certificate text,erasure text,needs_acl text) on commit drop;
  insert into p6_visibility_before
    select private.closure_source_digest_v5(),
      (select sha256 from private.closure_source_v5 where singleton),
      (select sha256 from private.closure_erasure_source_v5 where singleton),
      (select relacl::text from pg_class where oid='public.needs'::regclass);
end $p6_visibility_pre$;

create function rls_private.p6_discovery_test_world_accounts()
returns uuid[]
language sql
stable
security definer
set search_path=pg_catalog
as $f$
  select coalesce(array_agg(l.account_id order by l.account_id),array[]::uuid[])
  from private.account_lineage_v5 l
  where private.account_visibility_world(l.account_id)='TEST'
$f$;
revoke all on function rls_private.p6_discovery_test_world_accounts()
  from public,anon,authenticated,service_role;
grant execute on function rls_private.p6_discovery_test_world_accounts() to authenticated;
comment on function rls_private.p6_discovery_test_world_accounts() is
  'P6 internal RLS helper. The rls_private schema is not a PostgREST API schema. Used only as an uncorrelated policy InitPlan.';

alter policy v5_closed_account_visibility on public.needs
  using ((select public.rpc_storage_account_open()));

alter policy needs_public_discovery on public.needs
  using (
    status=any(array['PUBLISHED'::text,'SELECTION'::text])
    and (select auth.uid()) is not null
    and (
      requester_account_id=any(coalesce((select rls_private.p6_discovery_test_world_accounts()),array[]::uuid[]))
    ) = (
      (select auth.uid())=any(coalesce((select rls_private.p6_discovery_test_world_accounts()),array[]::uuid[]))
    )
  );

do $p6_visibility_post$
declare before_row p6_visibility_before%rowtype; mismatch bigint; helper record; public_qual text;
begin
  select * into strict before_row from p6_visibility_before;
  if private.closure_source_digest_v5() is distinct from before_row.source_digest
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from before_row.certificate
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from before_row.erasure
     or (select relacl::text from pg_class where oid='public.needs'::regclass) is distinct from before_row.needs_acl
    then raise exception 'P6_VISIBILITY_AUTHORITY_MOVED'; end if;
  if before_row.source_digest is distinct from before_row.certificate or before_row.source_digest is distinct from before_row.erasure
    then raise exception 'P6_VISIBILITY_PREDECESSOR_NOT_CERTIFIED'; end if;

  select prosecdef,provolatile,proconfig,
    has_function_privilege('authenticated',oid,'EXECUTE') auth_exec,
    has_function_privilege('anon',oid,'EXECUTE') anon_exec,
    has_function_privilege('service_role',oid,'EXECUTE') service_exec
    into strict helper
  from pg_proc where oid='rls_private.p6_discovery_test_world_accounts()'::regprocedure;
  if helper.prosecdef is distinct from true or helper.provolatile is distinct from 's'
     or helper.proconfig is distinct from array['search_path=pg_catalog']
     or helper.auth_exec is distinct from true or helper.anon_exec or helper.service_exec
    then raise exception 'P6_VISIBILITY_HELPER_SECURITY'; end if;

  with ids as (
    select account_id from private.account_lineage_v5
    union select '00000000-0000-4000-8000-000000000001'::uuid
  ), pairs as (
    select left_ids.account_id as left_id,right_ids.account_id as right_id
    from ids left_ids cross join ids right_ids
  )
  select count(*) into mismatch from pairs
  where private.accounts_same_world(left_id,right_id) is distinct from (
    (left_id=any(rls_private.p6_discovery_test_world_accounts()))
    =
    (right_id=any(rls_private.p6_discovery_test_world_accounts()))
  );
  if mismatch<>0 then raise exception 'P6_VISIBILITY_SEMANTIC_MISMATCH:%',mismatch; end if;

  select qual into strict public_qual from pg_policies
    where schemaname='public' and tablename='needs' and policyname='needs_public_discovery';
  if position('p6_discovery_test_world_accounts' in public_qual)=0
     or position('auth.uid()' in public_qual)=0
    then raise exception 'P6_VISIBILITY_POLICY_POSTCONDITION'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='needs')<>6
    then raise exception 'P6_VISIBILITY_POLICY_SET_MOVED'; end if;
end $p6_visibility_post$;

-- ===== v3 layer 2: PLACES facets specialised before the wide generic projection =====
-- SOURCE ONLY / DISPOSABLE P6 PLACES cost candidate. Not a live migration.
-- Specialize PLACES before the wide generic projection so locality facets do not
-- materialize TaskCard-only columns for every matching Need.
do $p6_places_cost$
declare definition text; before_body text; anchor text; replacement text;
begin
 if current_user<>'postgres'
  then raise exception 'P6_PLACES_COST_POSTGRES_ONLY'; end if;
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
  ), facet_raw_counts as materialized (
   select approximate_area,approximate_city,count(*)::bigint as raw_count
   from place_qualified
   where time_ok and execution_location_mode is distinct from 'REMOTE'
   group by approximate_area,approximate_city
  ), facet_raw_representatives as materialized (
   select distinct on(approximate_area,approximate_city)
    approximate_area,approximate_city,published_at,id
   from place_qualified
   where time_ok and execution_location_mode is distinct from 'REMOTE'
   order by approximate_area,approximate_city,published_at desc,id desc
  ), facet_raw as materialized (
   select c.approximate_area,c.approximate_city,c.raw_count,r.published_at,r.id,
    public.p6_discovery_area(c.approximate_area,c.approximate_city,false) as area_text
   from facet_raw_counts c join facet_raw_representatives r using(approximate_area,approximate_city)
  ), facet_keys as materialized (
   select public.p6_discovery_key(area_text) as key,area_text as text,raw_count,id,published_at
   from facet_raw
  ), facet_members as materialized (
   select * from facet_keys
   where key not in ('na daljinu','lokacija nije navedena')
    and (prefix_text='' or strpos(key,prefix_text)>0)
  ), facet_representatives as materialized (
   select distinct on(key) key,text from facet_members order by key,published_at desc,id desc
  ), facet_counts as materialized (
   select key,sum(raw_count)::bigint as count from facet_members group by key
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

-- ===== v3 postconditions =====
do $p6_rollout_v3_post$
declare c text;
begin
 select cert into strict c from p6_rollout_before;
 if private.closure_source_digest_v5() is distinct from c
    or (select sha256 from private.closure_source_v5 where singleton) is distinct from c
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from c
    or private.retention_ai_source_ready() is distinct from true
   then raise exception 'P6_ROLLOUT_V3_CERTIFICATE_MOVED'; end if;
 if (select relacl::text from pg_class where oid='public.needs'::regclass) is distinct from (select needs_acl from p6_rollout_before)
   then raise exception 'P6_ROLLOUT_V3_NEEDS_ACL_MOVED'; end if;
 if position('if request_mode=''PLACES'' then' in (select prosrc from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')))=0
   then raise exception 'P6_ROLLOUT_V3_PLACES_BRANCH_MISSING'; end if;
 if to_regprocedure('rls_private.p6_discovery_test_world_accounts()') is null
   then raise exception 'P6_ROLLOUT_V3_HELPER_MISSING'; end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='needs')<>6
   then raise exception 'P6_ROLLOUT_V3_POLICY_SET_MOVED'; end if;
end $p6_rollout_v3_post$;
commit;
