-- Synthetic fixtures remain in the SAME local-only rolled-back transaction.
-- Run 36441177762: SQLSTATE23502; the required public city uses '' instead of null.
-- Run 36441957693: MAP through 3000 PASS; one DO containing every PLACES request
-- plus repeated oracle scans hit SQLSTATE57014. Keep 60s per statement unchanged.
-- Each page below is a separate statement, as in a real paging reader; no facets
-- are skipped. Compute the fixture oracle once, independently of RPC results.
reset role;
select set_config('p6.spatial_prefix','P6SPATIAL_'||gen_random_uuid()::text,true);
create function pg_temp.p6_spatial_seed(first_id integer,last_id integer) returns void
language plpgsql security invoker as $seed$
declare profile_id uuid;
begin
 if current_user<>'postgres' or current_setting('p6_discovery.disposable',true)<>'SOURCE_ONLY_ROLLBACK' then raise exception 'P6_SPATIAL_LOCAL_SEED_ONLY'; end if;
 select id into strict profile_id from public.app_profiles where account_id=current_setting('p6.owner')::uuid and kind='REQUESTER';
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
  schedule_kind,published_at,execution_location_mode,approximate_lat,approximate_lng,approximate_area,approximate_city,task_country_code,task_timezone)
 select gen_random_uuid(),current_setting('p6.owner')::uuid,profile_id,'PUBLISHED',current_setting('p6.spatial_prefix')||' task '||i,
  'PRIVATE_SPATIAL_MARKER','P6','OFFERS',2,1,'FLEXIBLE',statement_timestamp()-interval '3 days'+i*interval '1 microsecond',
  case when i>2950 then 'REMOTE' else 'STATIONARY' end,
  case when i>2900 then null when i=2897 then 90 when i=2898 then -90 when i in (2899,2900) then 10 when i<=1500 then 45.25 else round(-80::numeric+mod(i-1501,140)*160::numeric/139,2) end,
  case when i>2900 then null when i=2897 then 180 when i=2898 then -180 when i=2899 then 179.99 when i=2900 then -179.99 when i<=1500 then 19.83 else round(-175::numeric+((i-1501)/140)*350::numeric/9,2) end,
  current_setting('p6.spatial_prefix')||case when i<=1500 then ' Alpha' when i>2900 then ' NoPoint' when i in (2899,2900) then ' Dateline' else ' L'||lpad(mod(i,50)::text,2,'0') end,
  '','RS','Europe/Belgrade'
 from generate_series(first_id,last_id) i;
end $seed$;
create function pg_temp.p6_spatial_map_request(text_filter text,bounds jsonb) returns jsonb
language sql security invoker as $r$
 select jsonb_build_object('mode','MAP','filter',jsonb_build_object('text',text_filter,'price','all','where','any','places',1,'when','any','dates',null,'place',null),
  'anchor',null,'bounds',bounds,'grid',24)
$r$;
create function pg_temp.p6_spatial_check(expected bigint) returns void
language plpgsql security invoker as $check$
declare response jsonb; b jsonb; total bigint;
begin
 response:=public.rpc_discovery_v1(pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[-180,-90,180,90]'));
 if (response#>>'{counts,mapped}')::bigint<>expected or (response#>>'{counts,withoutPoint}')::bigint<>greatest(0,expected-2900)
  or jsonb_array_length(response->'buckets')>256 or (response->>'effectiveGrid')::integer not between 1 and 24 then raise exception 'P6_SPATIAL_VOLUME_COUNTS'; end if;
 select coalesce(sum(case when x->>'kind'='TASK' then 1 else (x->>'taskCount')::bigint end),0) into total from jsonb_array_elements(response->'buckets') x;
 if total<>least(2900,expected) then raise exception 'P6_SPATIAL_FULL_COVERAGE_LOSS'; end if;
 for b in select value from jsonb_array_elements(response->'buckets') loop
  if b->>'kind'='TASK' and b-array['kind','key','point','taskId']<>'{}'
   or b->>'kind'='PLACE' and b-array['kind','key','point','taskCount']<>'{}'
   or b->>'kind'='CLUSTER' and b-array['kind','key','point','taskCount','distinctPointCount','memberBounds']<>'{}'
   or b->>'kind' not in ('TASK','PLACE','CLUSTER') then raise exception 'P6_SPATIAL_PUBLIC_ALLOWLIST'; end if;
  if round((b#>>'{point,lat}')::numeric,2)<>(b#>>'{point,lat}')::numeric or round((b#>>'{point,lng}')::numeric,2)<>(b#>>'{point,lng}')::numeric
   then raise exception 'P6_SPATIAL_PUBLIC_PRECISION'; end if;
 end loop;
 if expected=0 and response->'wholeBounds'<>'null'::jsonb then raise exception 'P6_SPATIAL_EMPTY_BOUNDS'; end if;
 if expected=1 and response#>>'{buckets,0,kind}'<>'TASK' then raise exception 'P6_SPATIAL_ONE_TASK'; end if;
 if expected in (100,1000) and (jsonb_array_length(response->'buckets')<>1 or response#>>'{buckets,0,kind}'<>'PLACE') then raise exception 'P6_SPATIAL_COINCIDENT_PLACE'; end if;
end $check$;
grant execute on function pg_temp.p6_spatial_map_request(text,jsonb),pg_temp.p6_spatial_check(bigint) to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.reader'),true);
select pg_temp.p6_spatial_check(0);
reset role;
set local session_replication_role=replica;
select pg_temp.p6_spatial_seed(1,1);
set local session_replication_role=origin;
set local role authenticated;
select pg_temp.p6_spatial_check(1);
reset role;
set local session_replication_role=replica;
select pg_temp.p6_spatial_seed(2,100);
set local session_replication_role=origin;
set local role authenticated;
select pg_temp.p6_spatial_check(100);
reset role;
set local session_replication_role=replica;
select pg_temp.p6_spatial_seed(101,1000);
set local session_replication_role=origin;
set local role authenticated;
select pg_temp.p6_spatial_check(1000);
reset role;
set local session_replication_role=replica;
select pg_temp.p6_spatial_seed(1001,3000);
set local session_replication_role=origin;
set local role authenticated;
select pg_temp.p6_spatial_check(3000);
\echo 'PASS P6_MAP_0_1_100_1000_3000_BOUNDED_COMPLETE_COVERAGE'

do $spatial_cases$
declare r jsonb; response jsonb; total bigint;
begin
 r:=pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[19.83,45.25,19.83,45.25]'); response:=public.rpc_discovery_v1(r);
 if jsonb_array_length(response->'buckets')<>1 or response#>>'{buckets,0,kind}'<>'PLACE' or response#>>'{buckets,0,taskCount}'<>'1500'
  then raise exception 'P6_MAP_DENSE_EQUAL_EDGE'; end if;
 r:=pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[179,-11,-179,11]'); response:=public.rpc_discovery_v1(r);
 select coalesce(sum(case when x->>'kind'='TASK' then 1 else (x->>'taskCount')::bigint end),0) into total from jsonb_array_elements(response->'buckets') x;
 if total<>2 then raise exception 'P6_MAP_WRAPPED_COVERAGE'; end if;
 r:=pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[180,90,180,90]'); response:=public.rpc_discovery_v1(r);
 if jsonb_array_length(response->'buckets')<>1 or response#>>'{buckets,0,kind}'<>'TASK' then raise exception 'P6_MAP_WORLD_EDGE'; end if;
 r:=pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[-180,-90,180,90]'); r:=jsonb_set(r,'{filter,where}','"remote"'); response:=public.rpc_discovery_v1(r);
 if response#>>'{counts,mapped}'<>'50' or response#>>'{counts,withoutPoint}'<>'50' or response->'buckets'<>'[]'::jsonb then raise exception 'P6_MAP_REMOTE_NOT_SPATIAL'; end if;
 perform pg_temp.p6_refuses(jsonb_set(r,'{grid}','25'),'P6_INVALID_REQUEST');
 perform pg_temp.p6_refuses(jsonb_set(r,'{grid}','0'),'P6_INVALID_REQUEST');
 perform pg_temp.p6_refuses(jsonb_set(r,'{bounds}','[181,0,0,1]'),'P6_INVALID_SCOPE');
 perform pg_temp.p6_refuses(r||'{"after":null}','P6_INVALID_REQUEST');
end $spatial_cases$;
\echo 'PASS P6_MAP_DENSE_SPARSE_WRAPPED_REMOTE_AND_STRICT_REQUEST'

reset role;
-- Fixture oracle is computed once, not once per returned row and page.
create temporary table p6_facet_expected as
 select public.p6_discovery_key(public.p6_discovery_area(t.approximate_area,t.approximate_city,false)) as key,count(*) as count
 from public.needs t where t.title like current_setting('p6.spatial_prefix')||'%' and t.execution_location_mode<>'REMOTE'
 group by 1;
create unique index on p6_facet_expected(key);
create temporary table p6_facet_state(
 id integer primary key check(id=1), original jsonb not null, request jsonb not null,
 anchor jsonb, last_item jsonb, seen text[] not null default '{}', pages integer not null default 0,
 done boolean not null default false, durations_ms numeric[] not null default '{}');
insert into p6_facet_state(id,original,request)
 select 1,r,r from (select jsonb_build_object('mode','PLACES','filter',jsonb_build_object('text','must be ignored','price','all','where','any','places',1,'when','any','dates',null,'place','must be ignored'),
  'anchor',null,'prefix',current_setting('p6.spatial_prefix'),'facetArea','[19.83,45.25,19.83,45.25]'::jsonb,'limit',3,'after',null) as r) q;
grant select on p6_facet_expected to authenticated;
grant select,update on p6_facet_state to authenticated;
create function pg_temp.p6_spatial_facets_page() returns void language plpgsql security invoker as $page$
declare st pg_temp.p6_facet_state%rowtype; response jsonb; x jsonb; expected_count bigint; began timestamptz; elapsed numeric;
begin
 select * into strict st from pg_temp.p6_facet_state where id=1;
 if st.done then return; end if;
 st.pages:=st.pages+1; if st.pages>30 then raise exception 'P6_PLACES_PAGING_LOOP'; end if;
 began:=clock_timestamp(); response:=public.rpc_discovery_v1(st.request);
 elapsed:=round((extract(epoch from clock_timestamp()-began)*1000)::numeric,3);
 if st.anchor is null then st.anchor:=response->'anchor'; elsif response->'anchor'<>st.anchor then raise exception 'P6_PLACES_ANCHOR_DRIFT'; end if;
 if jsonb_array_length(response->'items')>3 then raise exception 'P6_PLACES_UNBOUNDED'; end if;
 for x in select value from jsonb_array_elements(response->'items') loop
  if x-array['key','text','count']<>'{}' or public.p6_discovery_key(x->>'text') is distinct from x->>'key' or x->>'key'=any(st.seen)
   then raise exception 'P6_PLACES_DUPLICATE_OR_SHAPE'; end if;
  select count into strict expected_count from pg_temp.p6_facet_expected where key=x->>'key';
  if (x->>'count')::bigint<>expected_count then raise exception 'P6_PLACES_EXACT_COUNT'; end if;
  if st.last_item is not null and ((st.last_item->>'count')::bigint<(x->>'count')::bigint or (st.last_item->>'count')::bigint=(x->>'count')::bigint and
   ((st.last_item->>'text') collate pg_catalog."sr-Latn-RS-x-icu",(st.last_item->>'key') collate pg_catalog."C")>((x->>'text') collate pg_catalog."sr-Latn-RS-x-icu",(x->>'key') collate pg_catalog."C"))
   then raise exception 'P6_PLACES_TUPLE_ORDER'; end if;
  st.seen:=array_append(st.seen,x->>'key'); st.last_item:=x;
 end loop;
 if (response->>'hasMore')::boolean then
  if response->'nextCursor' is distinct from st.last_item then raise exception 'P6_PLACES_CURSOR_NOT_TAIL'; end if;
  st.request:=jsonb_set(jsonb_set(st.request,'{anchor}',response->'anchor'),'{after}',response->'nextCursor');
 else
  if response->'nextCursor'<>'null'::jsonb then raise exception 'P6_PLACES_TERMINAL_CURSOR'; end if;
  st.done:=true;
 end if;
 update pg_temp.p6_facet_state set request=st.request,anchor=st.anchor,last_item=st.last_item,seen=st.seen,pages=st.pages,
  done=st.done,durations_ms=array_append(st.durations_ms,elapsed) where id=1;
end $page$;
grant execute on function pg_temp.p6_spatial_facets_page() to authenticated;
set local role authenticated;
-- psql gexec issues distinct statements; the original 60s timeout stays intact.
-- Calls after terminal state send no RPC. Failing to reach terminal still fails.
select 'select pg_temp.p6_spatial_facets_page();' from generate_series(1,30)
\gexec

do $facets$
declare r jsonb; original jsonb; response jsonb; st pg_temp.p6_facet_state%rowtype; expected_count bigint;
begin
 select * into strict st from pg_temp.p6_facet_state where id=1;
 select count(*) into expected_count from pg_temp.p6_facet_expected;
 if not st.done or cardinality(st.seen)<>expected_count or cardinality(st.seen)<50 then raise exception 'P6_PLACES_MISSING_FACETS'; end if;
 original:=st.original; response:=public.rpc_discovery_v1(original);
 r:=jsonb_set(jsonb_set(original,'{anchor}',response->'anchor'),'{after}',response->'nextCursor');
 perform pg_temp.p6_refuses(jsonb_set(r,'{after}',(r->'after')-'text'),'P6_INVALID_CURSOR');
 perform pg_temp.p6_refuses(jsonb_set(r,'{prefix}','"changed"'),'P6_INVALID_ANCHOR');
 perform pg_temp.p6_refuses(jsonb_set(r,'{facetArea}','[0,0,0,0]'),'P6_INVALID_ANCHOR');
 perform pg_temp.p6_refuses(jsonb_set(r,'{anchor}','null'),'P6_INVALID_CURSOR');
 perform pg_temp.p6_refuses(jsonb_set(original,'{limit}','31'),'P6_INVALID_REQUEST');
 r:=jsonb_set(original,'{prefix}',to_jsonb(current_setting('p6.spatial_prefix')||' never exists'));
 response:=public.rpc_discovery_v1(r);
 if response->'items'<>'[]'::jsonb or response->'hasMore'<>'false'::jsonb or response->'nextCursor'<>'null'::jsonb then raise exception 'P6_PLACES_EMPTY'; end if;
end $facets$;
-- Numeric fixture-only diagnostics, not percentiles, latency or scale acceptance.
select 'P6_FACET_DIAGNOSTIC '||jsonb_build_object('samples',pages,'facets',cardinality(seen),
 'minMs',(select min(x) from unnest(durations_ms) x),'maxMs',(select max(x) from unnest(durations_ms) x),
 'totalMs',(select sum(x) from unnest(durations_ms) x))::text from pg_temp.p6_facet_state;
\echo 'PASS P6_PLACES_EXACT_COUNTS_COMPLETE_TUPLE_PAGING_AND_SCOPE_BINDING'

