-- SOURCE ONLY / NOT RUN. psql disposable replay; entire candidate + fixtures roll back.
\set ON_ERROR_STOP on
\if :{?p6_disposable}
\else
 \quit 3
\endif
\if :{?p6_vectors_path}
\else
 \echo 'Generate the checked-out client oracle SQL first; pass p6_vectors_path.'
 \quit 3
\endif
select :'p6_disposable'='SOURCE_ONLY_ROLLBACK' and :'HOST'='127.0.0.1' and :'PORT'='54322'
 and :'DBNAME'='postgres' and current_user='postgres' as p6_allowed
\gset
\if :p6_allowed
\else
 \quit 3
\endif
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
set local p6_discovery.disposable='SOURCE_ONLY_ROLLBACK';
create temporary table p6_before as select
 private.closure_source_digest_v5() as digest,
 (select jsonb_agg(to_jsonb(c)) from private.closure_source_v5 c) as certificate,
 (select jsonb_agg(to_jsonb(c)) from private.closure_erasure_source_v5 c) as erasure_certificate,
 pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) as readiness_definition,
 private.retention_ai_source_ready() as ready,
 (select jsonb_agg(to_jsonb(p) order by oid) from pg_publication p) as publications,
 (select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p) as policies,
 (select jsonb_agg(jsonb_build_array(c.oid,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.oid)
  from pg_class c where c.relnamespace in ('public'::regnamespace,'private'::regnamespace)) as relations,
 (select jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attacl) order by a.attrelid,a.attnum) from pg_attribute a
  where a.attrelid in(select oid from pg_class where relnamespace in('public'::regnamespace,'private'::regnamespace))) as column_acl;
create temporary table p6_functions_before as select p.oid,pg_get_functiondef(p.oid) as definition,p.proacl,p.proowner
 from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace) and p.prokind='f';
\ir ../../candidates/p6_discovery_page.sql
\i :p6_vectors_path

do $pure$
begin
 if public.p6_discovery_area('„Vračar, Beograd“','Beograd',false)<>'Vračar, Beograd'
  or public.p6_discovery_area('"Vračar" i "Zvezdara"','Beograd',false)<>'"Vračar" i "Zvezdara", Beograd'
  or public.p6_discovery_key(U&'\00A0NOVI\00A0\0020SAD\FEFF')<>'novi sad'
  or not public.p6_discovery_civil('0000-02-29') or public.p6_discovery_civil('2026-02-29') then raise exception 'P6_TEXT_CIVIL_PARITY'; end if;
 if public.p6_discovery_days('FIXED_WINDOW','2026-03-28T23:00:00Z','2026-03-29T22:00:00.000999Z','Europe/Belgrade','2026-03-29T12:00:00Z')
    is distinct from array['2026-03-29','2026-03-29']
  or public.p6_discovery_days('FIXED_WINDOW',null,'2026-03-29T22:00:00Z','Europe/Belgrade','2026-03-29T12:00:00Z') is not null
  or public.p6_discovery_days('FLEXIBLE',null,null,'UTC','2026-09-27T12:00:00Z') is distinct from array['0000-01-01','9999-12-31']
  then raise exception 'P6_TIME_PARITY'; end if;
 if has_function_privilege('anon','public.rpc_discovery_v1(jsonb)','EXECUTE')
  or not has_function_privilege('authenticated','public.rpc_discovery_v1(jsonb)','EXECUTE')
  or exists(select 1 from pg_proc where pronamespace='public'::regnamespace and (proname='rpc_discovery_v1' or proname like 'p6_discovery_%') and prosecdef)
  then raise exception 'P6_RPC_AUTHORITY'; end if;
end $pure$;
\echo 'PASS P6_HELPERS_AND_INVOKER_ENVELOPE'

-- All synthetic actors/rows exist only in this transaction, on the admitted local replay.
do $actors$
declare owner_id uuid:=gen_random_uuid(); reader_id uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select id,'authenticated','authenticated','p6-'||id||'@proof.invalid',statement_timestamp(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Disposable P6 proof"}',statement_timestamp(),statement_timestamp()
 from unnest(array[owner_id,reader_id]) id;
 perform set_config('p6.owner',owner_id::text,true); perform set_config('p6.reader',reader_id::text,true);
 perform set_config('p6.prefix','P6_'||gen_random_uuid()::text,true);
end $actors$;
set local session_replication_role=replica;
do $seed$
declare profile_id uuid; task_id uuid;
begin
 select id into strict profile_id from public.app_profiles where account_id=current_setting('p6.owner')::uuid and kind='REQUESTER';
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
  schedule_kind,published_at,execution_location_mode,task_country_code,task_timezone)
 select gen_random_uuid(),current_setting('p6.owner')::uuid,profile_id,'PUBLISHED',current_setting('p6.prefix')||' task '||i,
  'PRIVATE_P6_DESCRIPTION','P6','OFFERS',2,1,'FLEXIBLE',statement_timestamp()-interval '2 days'+(i/5)*interval '1 microsecond','REMOTE','RS','Europe/Belgrade'
 from generate_series(1,1001) i;
 for i in 1..3 loop
  task_id:=gen_random_uuid(); perform set_config('p6.extra'||i,task_id::text,true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
   schedule_kind,published_at,execution_location_mode,approximate_lat,approximate_lng,approximate_area,approximate_city,task_country_code,task_timezone)
  values(task_id,current_setting('p6.owner')::uuid,profile_id,'PUBLISHED',current_setting('p6.prefix')||' literal %_ čĆ Žž','PRIVATE_P6_DESCRIPTION',
   'P6','OFFERS',2,1,'FLEXIBLE',statement_timestamp()-interval '1 day','STATIONARY',case when i<3 then 45.25 end,case when i<3 then 19.83 end,
   '„Vračar, Beograd“','Beograd','RS','Europe/Belgrade');
 end loop;
end $seed$;
set local session_replication_role=origin;
create function pg_temp.p6_refuses(request jsonb,expected text) returns void language plpgsql security invoker as $f$
declare refused boolean:=false;
begin
 begin perform public.rpc_discovery_v1(request);
 exception when sqlstate '22023' then
  if sqlerrm is distinct from expected then raise; end if;
  refused:=true;
 end;
 if not refused then raise exception 'P6_EXPECTED_REFUSAL:%',expected; end if;
end $f$;
do $grant_temp$ begin
 execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema()));
 grant execute on function pg_temp.p6_refuses(jsonb,text) to authenticated;
end $grant_temp$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.reader'),true);
do $coverage_boundary$
declare whole_row_denied boolean:=false; covered integer;
begin
 begin
  perform public.covered_slots(n) from public.needs n where n.id=current_setting('p6.extra1')::uuid;
 exception when insufficient_privilege then whole_row_denied:=true; end;
 if not whole_row_denied then raise exception 'P6_WHOLE_ROW_GRANT_UNEXPECTED'; end if;
 select public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) into strict covered
  from public.needs n where n.id=current_setting('p6.extra1')::uuid;
 if covered is distinct from 0 then raise exception 'P6_CANONICAL_COVERAGE_ARGUMENT'; end if;
end $coverage_boundary$;
\echo 'PASS P6_COVERAGE_WITH_RESTRICTED_COLUMNS'
do $pages$
declare f jsonb:=jsonb_build_object('text',current_setting('p6.prefix'),'price','all','where','any','places',1,'when','any','dates',null,'place',null);
 r jsonb; p jsonb; seen uuid[]:='{}'; row_value jsonb; trips integer:=0; n integer; ids uuid[];
begin
 r:=jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope',jsonb_build_object('kind','ALL'),'limit',37,'after',null);
 loop
  p:=public.rpc_discovery_v1(r); trips:=trips+1;
  if jsonb_array_length(p->'items')>37 or (p#>>'{counts,listed}')::integer<>1004 then raise exception 'P6_PAGE_COUNT_OR_BOUND'; end if;
  for row_value in select value from jsonb_array_elements(p->'items') loop
   if (row_value->>'id')::uuid=any(seen) then raise exception 'P6_DUPLICATE_KEYSET'; end if;
   if row_value ?| array['requesterAccountId','description','exactAddress','accessNotes'] or row_value::text like '%PRIVATE_P6_%' then raise exception 'P6_PRIVATE_PROJECTION'; end if;
   seen:=array_append(seen,(row_value->>'id')::uuid);
  end loop;
  exit when not (p->>'hasMore')::boolean;
  if trips>30 then raise exception 'P6_NONTERMINATING_CURSOR'; end if;
  r:=jsonb_set(jsonb_set(r,'{anchor}',p->'anchor'),'{after}',p->'nextCursor');
 end loop;
 if cardinality(seen)<>1004 then raise exception 'P6_INCOMPLETE_TRAVERSAL'; end if;
 r:=jsonb_set(jsonb_set(r,'{after}','null'),'{scope}','{"kind":"AREA","bounds":[19.83,45.25,19.83,45.25]}');
 p:=public.rpc_discovery_v1(r);
 if (p#>>'{counts,inArea}')::integer<>2 or (p#>>'{counts,withoutPoint}')::integer<>1002 then raise exception 'P6_EQUAL_BOX_POINTFREE'; end if;
 r:=jsonb_set(r,'{scope}','{"kind":"AREA","bounds":[170,-90,-170,90]}'); p:=public.rpc_discovery_v1(r);
 if (p#>>'{counts,inArea}')::integer<>0 or (p#>>'{counts,listed}')::integer<>1002 then raise exception 'P6_WRAPPED_BOX'; end if;
 r:=jsonb_set(r,'{scope}','{"kind":"POINT_MEMBERS","point":{"lat":45.25,"lng":19.83}}'); p:=public.rpc_discovery_v1(r);
 if (p#>>'{counts,listed}')::integer<>2 or jsonb_array_length(p->'items')<>2 then raise exception 'P6_POINT_MEMBERS'; end if;
 p:=public.rpc_discovery_v1(jsonb_build_object('mode','EXACT_PUBLIC','needId',current_setting('p6.extra1')));
 if jsonb_array_length(p->'items')<>1 then raise exception 'P6_EXACT_PUBLIC'; end if;
 p:=public.rpc_discovery_v1(jsonb_build_object('mode','EXACT_PUBLIC','needId',gen_random_uuid()));
 if jsonb_array_length(p->'items')<>0 then raise exception 'P6_MISSING_PUBLIC'; end if;
 -- Literal wildcard characters remain substrings, not SQL LIKE patterns.
 f:=jsonb_set(f,'{text}',to_jsonb(current_setting('p6.prefix')||' literal %_'));
 r:=jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope',jsonb_build_object('kind','ALL'),'limit',100,'after',null);
 p:=public.rpc_discovery_v1(r); if (p#>>'{counts,listed}')::integer<>3 then raise exception 'P6_LITERAL_TEXT'; end if;
end $pages$;
\echo 'PASS P6_1004_ROWS_TIES_MICROSECONDS_SCOPES_EXACT_ALLOWLIST'

do $boundaries$
declare f jsonb:=jsonb_build_object('text',current_setting('p6.prefix'),'price','all','where','any','places',1,'when','any','dates',null,'place',null);
 request jsonb; page jsonb; continuation jsonb; changed jsonb; expired jsonb;
begin
 request:=jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope',jsonb_build_object('kind','ALL'),'limit',1,'after',null);
 page:=public.rpc_discovery_v1(jsonb_set(request,'{filter,text}',to_jsonb(current_setting('p6.prefix')||' absent')));
 if page->'items' is distinct from '[]'::jsonb or (page->>'hasMore')::boolean is distinct from false
  or page->'nextCursor' is distinct from 'null'::jsonb or (page#>>'{counts,listed}')::integer is distinct from 0
  then raise exception 'P6_ZERO_PAGE'; end if;
 page:=public.rpc_discovery_v1(jsonb_set(request,'{filter,text}',to_jsonb(current_setting('p6.prefix')||' task 1001')));
 if jsonb_array_length(page->'items') is distinct from 1 or (page->>'hasMore')::boolean is distinct from false
  or page->'nextCursor' is distinct from 'null'::jsonb or (page#>>'{counts,listed}')::integer is distinct from 1
  then raise exception 'P6_ONE_PAGE'; end if;
 page:=public.rpc_discovery_v1(request);
 if not(page->>'hasMore')::boolean or page->'nextCursor'='null' then raise exception 'P6_CURSOR_REQUIRED'; end if;
 continuation:=jsonb_set(jsonb_set(request,'{anchor}',page->'anchor'),'{after}',page->'nextCursor');
 perform pg_temp.p6_refuses(jsonb_set(continuation,'{after,scopeKey}','"different"'),'P6_INVALID_CURSOR');
 perform pg_temp.p6_refuses(jsonb_set(continuation,'{scope}','{"kind":"AREA","bounds":[-180,-90,180,90]}'),'P6_INVALID_CURSOR');
 perform pg_temp.p6_refuses(jsonb_set(continuation,'{filter,text}','"different"'),'P6_INVALID_ANCHOR');
 perform pg_temp.p6_refuses(jsonb_set(continuation,'{anchor}','null'),'P6_INVALID_CURSOR');
 perform pg_temp.p6_refuses(jsonb_set(request,'{limit}','0'),'P6_INVALID_REQUEST');
 perform pg_temp.p6_refuses(jsonb_set(request,'{limit}','101'),'P6_INVALID_REQUEST');
 perform pg_temp.p6_refuses(jsonb_set(request,'{filter,price}','null'),'P6_INVALID_FILTER');
 perform pg_temp.p6_refuses('{"mode":"MAP"}','P6_MODE_NOT_IMPLEMENTED');
 expired:=jsonb_set(jsonb_set(jsonb_set(page->'anchor','{timeAt}',to_jsonb(to_char((statement_timestamp()-interval '31 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),
  '{publishedThrough}',to_jsonb(to_char((statement_timestamp()-interval '31 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),
  '{expiresAt}',to_jsonb(to_char((statement_timestamp()-interval '1 minute') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
 perform pg_temp.p6_refuses(jsonb_set(request,'{anchor}',expired),'P6_ANCHOR_EXPIRED');
end $boundaries$;
\echo 'PASS P6_ZERO_ONE_AND_STRICT_CURSOR_ANCHOR_REFUSALS'

select set_config('request.jwt.claim.sub','',true);
do $auth$ declare refused boolean:=false; begin
 begin perform public.rpc_discovery_v1('{"mode":"EXACT_PUBLIC","needId":"11111111-1111-4111-8111-111111111111"}');
 exception when sqlstate '28000' then refused:=sqlerrm='AUTH_REQUIRED'; end;
 if not refused then raise exception 'P6_AUTH_REQUIRED_MISSING'; end if;
end $auth$;
reset role;
set local role anon;
do $anon$ declare refused boolean:=false; begin
 begin perform public.rpc_discovery_v1('{"mode":"EXACT_PUBLIC","needId":"11111111-1111-4111-8111-111111111111"}');
 exception when insufficient_privilege then refused:=true; end;
 if not refused then raise exception 'P6_ANON_EXECUTE_ALLOWED'; end if;
end $anon$;
reset role;
\echo 'PASS P6_AUTH_AND_ANON_REFUSALS'

do $unchanged$
begin
 if current_setting('session_replication_role')<>'origin' then raise exception 'P6_TRIGGER_MODE'; end if;
 if exists(select 1 from p6_functions_before b left join pg_proc p on p.oid=b.oid
  where p.oid is null or pg_get_functiondef(p.oid) is distinct from b.definition or p.proacl is distinct from b.proacl or p.proowner<>b.proowner)
  then raise exception 'P6_EXISTING_FUNCTION_CHANGED'; end if;
 if private.closure_source_digest_v5() is distinct from(select digest from p6_before)
  or (select jsonb_agg(to_jsonb(c)) from private.closure_source_v5 c) is distinct from(select certificate from p6_before)
  or (select jsonb_agg(to_jsonb(c)) from private.closure_erasure_source_v5 c) is distinct from(select erasure_certificate from p6_before)
  or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) is distinct from(select readiness_definition from p6_before)
  or private.retention_ai_source_ready() is distinct from(select ready from p6_before)
  or (select jsonb_agg(to_jsonb(p) order by oid) from pg_publication p) is distinct from(select publications from p6_before)
  or (select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p) is distinct from(select policies from p6_before)
  or (select jsonb_agg(jsonb_build_array(c.oid,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.oid) from pg_class c
    where c.relnamespace in('public'::regnamespace,'private'::regnamespace)) is distinct from(select relations from p6_before)
  or (select jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attacl) order by a.attrelid,a.attnum) from pg_attribute a where a.attrelid in
    (select oid from pg_class where relnamespace in('public'::regnamespace,'private'::regnamespace))) is distinct from(select column_acl from p6_before)
  then raise exception 'P6_EXISTING_AUTHORITY_CHANGED'; end if;
end $unchanged$;
\echo 'PASS P6_EXISTING_AUTHORITY_UNCHANGED'
rollback;
select to_regprocedure('public.rpc_discovery_v1(jsonb)') is null and current_setting('session_replication_role')='origin' as p6_clean
\gset
\if :p6_clean
 \echo 'PASS P6_ROLLBACK_NO_RPC_OR_FIXTURES_RETAINED'
\else
 \quit 4
\endif
