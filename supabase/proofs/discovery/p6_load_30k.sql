\set ON_ERROR_STOP on
select :'HOST'='127.0.0.1' and :'PORT'='54322' and :'DBNAME'='postgres' and current_user='postgres' as p6_load_allowed
\gset
\if :p6_load_allowed
\else
 \quit 3
\endif
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
set local p6_discovery.disposable='SOURCE_ONLY_ROLLBACK';

do $actors$
declare owner_id uuid:=gen_random_uuid(); reader_id uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select id,'authenticated','authenticated','p6-load-'||id||'@proof.invalid',statement_timestamp(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Disposable P6 load proof"}',statement_timestamp(),statement_timestamp()
 from unnest(array[owner_id,reader_id]) id;
 perform set_config('p6.load.owner',owner_id::text,true);
 perform set_config('p6.load.reader',reader_id::text,true);
 perform set_config('p6.load.prefix','P6L57_'||replace(gen_random_uuid()::text,'-',''),true);
end $actors$;

set local session_replication_role=replica;
do $seed$
declare profile_id uuid; exact_id uuid:=gen_random_uuid(); p text:=current_setting('p6.load.prefix');
begin
 select id into strict profile_id from public.app_profiles where account_id=current_setting('p6.load.owner')::uuid and kind='REQUESTER';
 perform set_config('p6.load.exact',exact_id::text,true);

 -- 12k dense at one public point.
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
  schedule_kind,published_at,execution_location_mode,approximate_lat,approximate_lng,approximate_area,approximate_city,task_country_code,task_timezone)
 select case when i=1 then exact_id else gen_random_uuid() end,current_setting('p6.load.owner')::uuid,profile_id,'PUBLISHED',
  p||' DENSE task '||i,'P6_LOAD_PRIVATE','P6LOAD','OFFERS',2,1,'FLEXIBLE',statement_timestamp()-interval '4 days'+i*interval '1 microsecond',
  'STATIONARY',45.25,19.83,p||' Dense','Novi Sad','RS','Europe/Belgrade'
 from generate_series(1,12000) i;

 -- 12k sparse points across 120 localities and the world.
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
  schedule_kind,published_at,execution_location_mode,approximate_lat,approximate_lng,approximate_area,approximate_city,task_country_code,task_timezone)
 select gen_random_uuid(),current_setting('p6.load.owner')::uuid,profile_id,'PUBLISHED',p||' SPARSE task '||i,'P6_LOAD_PRIVATE',
  'P6LOAD','OFFERS',2,1,'FLEXIBLE',statement_timestamp()-interval '3 days'+i*interval '1 microsecond','STATIONARY',
  round((-80::numeric+mod(i,140)*160::numeric/139),2),
  round((-175::numeric+mod((i*17),350)*350::numeric/349),2),
  p||' Area '||lpad(mod(i,120)::text,3,'0'),'Grad '||lpad(mod(i,30)::text,2,'0'),'RS','Europe/Belgrade'
 from generate_series(1,12000) i;

 -- 3k remote; never spatially bucketed.
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
  schedule_kind,published_at,execution_location_mode,approximate_area,approximate_city,task_country_code,task_timezone)
 select gen_random_uuid(),current_setting('p6.load.owner')::uuid,profile_id,'PUBLISHED',p||' REMOTE task '||i,'P6_LOAD_PRIVATE',
  'P6LOAD','OFFERS',2,1,'REMOTE_ANYTIME',statement_timestamp()-interval '2 days'+i*interval '1 microsecond','REMOTE',
  p||' Remote','', 'RS','Europe/Belgrade'
 from generate_series(1,3000) i;

 -- 3k on-site point-free rows; counted, never put in MAP buckets.
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
  schedule_kind,published_at,execution_location_mode,approximate_area,approximate_city,task_country_code,task_timezone)
 select gen_random_uuid(),current_setting('p6.load.owner')::uuid,profile_id,'PUBLISHED',p||' NOPOINT task '||i,'P6_LOAD_PRIVATE',
  'P6LOAD','OFFERS',2,1,'FLEXIBLE',statement_timestamp()-interval '1 day'+i*interval '1 microsecond','STATIONARY',
  p||' NoPoint','Novi Sad','RS','Europe/Belgrade'
 from generate_series(1,3000) i;

 -- 3k rows have one covered slot, so a 2-person filter must exclude them while a 1-person filter keeps them.
 insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,selection_mode,status)
 select id,revision,current_setting('p6.load.owner')::uuid,'p6-load-'||row_number() over(order by published_at,id),1,'REQUESTER_SELECTS','SELECTED'
 from public.needs where title like p||'%' order by published_at,id limit 3000;
end $seed$;
set local session_replication_role=origin;

analyze public.needs;
analyze public.need_selections;
analyze public.agreements;
analyze private.account_lineage_v5;
analyze private.account_closure_requests;

create temporary table p6_load_cases(label text primary key,request jsonb,expected jsonb);
create temporary table p6_load_samples(
 block integer not null check(block between 1 and 3),label text not null,sample integer not null check(sample between 1 and 30),
 elapsed_ms numeric not null check(elapsed_ms>=0),response_bytes integer not null,result_size integer not null,
 primary key(block,label,sample));

create function pg_temp.p6_load_filter(text_value text,people integer default 1) returns jsonb language sql immutable security invoker as $f$
 select jsonb_build_object('text',text_value,'price','all','where','any','places',people,'when','any','dates',null,'place',null)
$f$;
create function pg_temp.p6_load_normalize(j jsonb) returns jsonb language sql immutable security invoker as $f$
 select case when j?'counts' then jsonb_set((j-'asOf')#-'{counts,observedAt}','{anchor,timeAt}','"FIXED"',true)
   #-'{anchor,publishedThrough}'#-'{anchor,expiresAt}' else j-'asOf' end
$f$;
create function pg_temp.p6_load_page_anchor(f jsonb) returns jsonb language plpgsql security invoker as $f$
declare r jsonb;
begin
 r:=public.rpc_discovery_v1(jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope','{"kind":"ALL"}'::jsonb,'limit',1,'after',null));
 return r->'anchor';
end $f$;

-- GRANT does not resolve the pg_temp alias, while SET ROLE authenticated still needs USAGE on this session's
-- real temporary schema to call the explicitly granted proof functions/tables. Resolve only this local session schema.
do $temp_acl$
declare temp_schema text;
begin
 select nspname into strict temp_schema from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to authenticated',temp_schema);
end $temp_acl$;
grant execute on function pg_temp.p6_load_filter(text,integer),pg_temp.p6_load_normalize(jsonb),pg_temp.p6_load_page_anchor(jsonb) to authenticated;
grant select,insert,update on p6_load_cases to authenticated;
grant select,insert on p6_load_samples to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('p6.load.reader'),true);

do $cases$
declare p text:=current_setting('p6.load.prefix'); f jsonb; a jsonb;
begin
 f:=pg_temp.p6_load_filter(lower(p),1);
 insert into p6_load_cases(label,request) values('PAGE_ALL',
  jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope','{"kind":"ALL"}'::jsonb,'limit',50,'after',null));

 f:=pg_temp.p6_load_filter(lower(p),2);
 insert into p6_load_cases(label,request) values('PAGE_PEOPLE2',
  jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope','{"kind":"ALL"}'::jsonb,'limit',50,'after',null));

 f:=pg_temp.p6_load_filter(lower(p)||' dense',1); a:=pg_temp.p6_load_page_anchor(f);
 insert into p6_load_cases(label,request) values('MAP_DENSE',
  jsonb_build_object('mode','MAP','filter',f,'anchor',a,'bounds','[-180,-90,180,90]'::jsonb,'grid',24));

 f:=pg_temp.p6_load_filter(lower(p)||' sparse',1); a:=pg_temp.p6_load_page_anchor(f);
 insert into p6_load_cases(label,request) values('MAP_SPARSE',
  jsonb_build_object('mode','MAP','filter',f,'anchor',a,'bounds','[-180,-90,180,90]'::jsonb,'grid',24));

 f:=pg_temp.p6_load_filter('',1);
 insert into p6_load_cases(label,request) values('PLACES_SPARSE',
  jsonb_build_object('mode','PLACES','filter',f,'anchor',null,'prefix',public.p6_discovery_key(p||' Area'),'facetArea',null,'limit',30,'after',null));

 insert into p6_load_cases(label,request) values('EXACT_PUBLIC',
  jsonb_build_object('mode','EXACT_PUBLIC','needId',current_setting('p6.load.exact')::uuid));

 insert into p6_load_cases(label,request) values('SCAN',null),('COVERAGE_SCAN',null);
end $cases$;

create function pg_temp.p6_load_once(kind text,batch integer,sequence integer) returns void language plpgsql security invoker as $run$
declare req jsonb; expected_reply jsonb; answer jsonb; started timestamptz; elapsed numeric;
 size integer; visible bigint; folded bigint; cursor_anchor jsonb; p text:=current_setting('p6.load.prefix');
begin
 if current_user<>'authenticated' or auth.uid() is distinct from current_setting('p6.load.reader')::uuid
    or not row_security_active('public.needs') or current_setting('row_security')<>'on' or current_setting('session_replication_role')<>'origin'
  then raise exception 'P6_LOAD_AUTHORITY_REQUIRED'; end if;
 select request,expected into strict req,expected_reply from pg_temp.p6_load_cases where label=kind;
 started:=clock_timestamp();
 if kind='SCAN' then
  select count(*) into visible from public.needs n where n.status in('PUBLISHED','SELECTION') and n.published_at is not null
    and n.remaining_search_closed_at is null and n.title like p||'%';
  answer:=jsonb_build_object('rows',visible);
 elsif kind='COVERAGE_SCAN' then
  select count(*),coalesce(sum(public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id)))),0)
   into visible,folded from public.needs n where n.status in('PUBLISHED','SELECTION') and n.published_at is not null
    and n.remaining_search_closed_at is null and n.title like p||'%';
  answer:=jsonb_build_object('rows',visible,'covered',folded);
 else
  answer:=public.rpc_discovery_v1(req);
 end if;
 elapsed:=round((extract(epoch from clock_timestamp()-started)*1000)::numeric,3);

 if expected_reply is null then
  if kind='PAGE_ALL' and ((answer#>>'{counts,listed}')::integer<>30000 or jsonb_array_length(answer->'items')<>50) then raise exception 'P6_LOAD_PAGE_ALL'; end if;
  if kind='PAGE_PEOPLE2' and ((answer#>>'{counts,listed}')::integer<>27000 or jsonb_array_length(answer->'items')<>50) then raise exception 'P6_LOAD_PAGE_PEOPLE2'; end if;
  if kind='MAP_DENSE' then
   select coalesce(sum(case when x->>'kind'='TASK' then 1 else (x->>'taskCount')::integer end),0) into folded from jsonb_array_elements(answer->'buckets') x;
   if (answer#>>'{counts,mapped}')::integer<>12000 or (answer#>>'{counts,withoutPoint}')::integer<>0 or folded<>12000
      or jsonb_array_length(answer->'buckets')>256 then raise exception 'P6_LOAD_MAP_DENSE'; end if;
  end if;
  if kind='MAP_SPARSE' then
   select coalesce(sum(case when x->>'kind'='TASK' then 1 else (x->>'taskCount')::integer end),0) into folded from jsonb_array_elements(answer->'buckets') x;
   if (answer#>>'{counts,mapped}')::integer<>12000 or (answer#>>'{counts,withoutPoint}')::integer<>0 or folded<>12000
      or jsonb_array_length(answer->'buckets')>256 then raise exception 'P6_LOAD_MAP_SPARSE'; end if;
  end if;
  if kind='PLACES_SPARSE' and (jsonb_array_length(answer->'items')<>30 or (answer#>>'{counts,everywhere}')::integer<>30000)
    then raise exception 'P6_LOAD_PLACES'; end if;
  if kind='EXACT_PUBLIC' and jsonb_array_length(answer->'items')<>1 then raise exception 'P6_LOAD_EXACT'; end if;
  if kind in ('SCAN','COVERAGE_SCAN') and visible<>30000 then raise exception 'P6_LOAD_SCAN_COUNT'; end if;
  if kind='COVERAGE_SCAN' and folded<>3000 then raise exception 'P6_LOAD_COVERAGE_SUM'; end if;
  update pg_temp.p6_load_cases set expected=pg_temp.p6_load_normalize(answer),
    request=case when answer?'anchor' and request?'anchor' and request->'anchor'='null'::jsonb
      then jsonb_set(request,'{anchor}',answer->'anchor') else request end
   where label=kind;
 else
  if pg_temp.p6_load_normalize(answer) is distinct from expected_reply then raise exception 'P6_LOAD_RESPONSE_DRIFT:%',kind; end if;
 end if;
 size:=case when kind like 'MAP_%' then jsonb_array_length(answer->'buckets')
  when kind in ('PAGE_ALL','PAGE_PEOPLE2','PLACES_SPARSE','EXACT_PUBLIC') then jsonb_array_length(answer->'items')
  else visible::integer end;
 if sequence>0 then insert into pg_temp.p6_load_samples values(batch,kind,sequence,elapsed,octet_length(answer::text),size); end if;
end $run$;
grant execute on function pg_temp.p6_load_once(text,integer,integer) to authenticated;

select 'P6_LOAD_ENV '||jsonb_build_object('postgres',current_setting('server_version'),'jit',current_setting('jit'),'workMem',current_setting('work_mem'),
 'sharedBuffers',current_setting('shared_buffers'),'statementTimeout',current_setting('statement_timeout'),'syntheticNeeds',30000,
 'dense',12000,'sparse',12000,'remote',3000,'pointFreeOnsite',3000,'selectedOneSlot',3000,'concurrency',1,'blocks',3,
 'warmupsPerCase',3,'samplesPerBlockCase',30,'network','SQL_only','rlsBypassed',false)::text;

select format('select pg_temp.p6_load_once(%L,0,0);',label) from p6_load_cases cross join generate_series(1,3) w order by w,label
\gexec
select format('select pg_temp.p6_load_once(%L,%s,%s);',label,b,s) from p6_load_cases
 cross join generate_series(1,3) b cross join generate_series(1,30) s
 order by b,s,case when (b+s)%2=0 then label end asc,case when (b+s)%2<>0 then label end desc
\gexec

select 'P6_LOAD_SAMPLES '||jsonb_agg(jsonb_build_object('block',block,'case',label,'sample',sample,'ms',elapsed_ms,
 'responseBytes',response_bytes,'resultSize',result_size) order by block,label,sample)::text from p6_load_samples;
\echo 'PASS P6_LOAD_30000_CORRECTNESS_AND_720_SAMPLES'
rollback;
