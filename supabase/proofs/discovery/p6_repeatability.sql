-- Added inside the existing local, rolled-back P6 proof after spatial cases.
-- No policy, function authority, production table, role or grant is changed.
reset role;
analyze public.needs;
analyze public.need_selections;
analyze public.agreements;
analyze private.account_lineage_v5;
analyze private.account_closure_requests;
create temporary table p6_repeat_config(cutoff timestamptz not null);
insert into p6_repeat_config values(statement_timestamp());
create temporary table p6_repeat_cases(label text primary key,request jsonb,expected jsonb);
insert into p6_repeat_cases(label,request)
 select 'PAGE',jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope','{"kind":"ALL"}'::jsonb,'limit',37,'after',null)
 from (select jsonb_build_object('text',current_setting('p6.spatial_prefix'),'price','all','where','any','places',1,'when','any','dates',null,'place',null) f) q
 union all select 'MAP',pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[-180,-90,180,90]')
 union all select 'PLACES',jsonb_build_object('mode','PLACES','filter',jsonb_build_object('text','','price','all','where','any','places',1,'when','any','dates',null,'place',null),
   'anchor',null,'prefix',current_setting('p6.spatial_prefix'),'facetArea',null,'limit',3,'after',null)
 union all select 'EXACT_PUBLIC',jsonb_build_object('mode','EXACT_PUBLIC','needId',current_setting('p6.extra1'));
insert into p6_repeat_cases(label,request) select 'PAGE_PEOPLE2',jsonb_set(request,'{filter,places}','2') from p6_repeat_cases where label='PAGE';
insert into p6_repeat_cases(label) values('SCAN'),('AREA'),('COVERAGE');
create temporary table p6_repeat_samples(
 block integer not null check(block between 1 and 3),label text not null,sample integer not null check(sample between 1 and 30),
 elapsed_ms numeric not null check(elapsed_ms>=0),response_bytes integer not null,result_size integer not null,
 primary key(block,label,sample));
create function pg_temp.p6_repeat_normalize(j jsonb) returns jsonb language sql immutable security invoker as $n$
 select case when j?'counts' then jsonb_set(j-'asOf','{counts}',(j->'counts')-'observedAt') else j-'asOf' end
$n$;
create function pg_temp.p6_repeat_once(kind text,batch integer,sequence integer) returns void
language plpgsql security invoker as $once$
declare req jsonb; expected_reply jsonb; answer jsonb; started timestamptz; elapsed numeric;
 horizon timestamptz; size integer; visible_rows bigint; folded bigint;
begin
 -- Every timed read must retain the real application role and active RLS.
 if current_user<>'authenticated' or auth.uid() is distinct from current_setting('p6.reader')::uuid
   or not row_security_active('public.needs') or current_setting('row_security')<>'on'
   or current_setting('session_replication_role')<>'origin' then raise exception 'P6_REPEAT_AUTHORITY_REQUIRED'; end if;
 select request,expected into strict req,expected_reply from pg_temp.p6_repeat_cases where label=kind;
 select cutoff into strict horizon from pg_temp.p6_repeat_config;
 started:=clock_timestamp();
 if kind='SCAN' then
  select count(n.id) into visible_rows from public.needs n
   where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
     and n.remaining_search_closed_at is null and n.published_at<=horizon;
  answer:=jsonb_build_object('rows',visible_rows);
 elsif kind='AREA' then
  select count(n.id),coalesce(sum(length(public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE'))),0)
   into visible_rows,folded from public.needs n
   where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
     and n.remaining_search_closed_at is null and n.published_at<=horizon;
  answer:=jsonb_build_object('rows',visible_rows,'folded',folded);
 elsif kind='COVERAGE' then
  select count(n.id),coalesce(sum(public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id)))),0)
   into visible_rows,folded from public.needs n
   where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
     and n.remaining_search_closed_at is null and n.published_at<=horizon;
  answer:=jsonb_build_object('rows',visible_rows,'folded',folded);
 else
  answer:=public.rpc_discovery_v1(req);
 end if;
 elapsed:=round((extract(epoch from clock_timestamp()-started)*1000)::numeric,3);
 if expected_reply is null then
  if kind in ('PAGE','PAGE_PEOPLE2') and (answer#>>'{counts,listed}')::integer<>3000
   or kind='MAP' and ((answer#>>'{counts,mapped}')::integer<>3000 or (answer#>>'{counts,withoutPoint}')::integer<>100)
   or kind='EXACT_PUBLIC' and jsonb_array_length(answer->'items')<>1
   or kind='PLACES' and jsonb_array_length(answer->'items')<>3
   or kind in ('SCAN','AREA','COVERAGE') and visible_rows<4004 then raise exception 'P6_REPEAT_FIXTURE_COUNT'; end if;
  update pg_temp.p6_repeat_cases set expected=pg_temp.p6_repeat_normalize(answer),
   request=case when answer?'anchor' then jsonb_set(req,'{anchor}',answer->'anchor') else req end where label=kind;
 elsif pg_temp.p6_repeat_normalize(answer) is distinct from expected_reply then raise exception 'P6_REPEAT_RESPONSE_DRIFT'; end if;
 size:=case when kind='MAP' then jsonb_array_length(answer->'buckets')
  when kind in ('PAGE','PAGE_PEOPLE2','PLACES','EXACT_PUBLIC') then jsonb_array_length(answer->'items') else visible_rows end;
 if size is null or kind='MAP' and size>256 or kind in ('PAGE','PAGE_PEOPLE2') and size>37 or kind='PLACES' and size>3 then raise exception 'P6_REPEAT_RESULT_BOUND'; end if;
 if sequence>0 then insert into pg_temp.p6_repeat_samples values(batch,kind,sequence,elapsed,octet_length(answer::text),size); end if;
end $once$;
grant select on p6_repeat_config to authenticated;
grant select,update on p6_repeat_cases to authenticated;
grant select,insert on p6_repeat_samples to authenticated;
grant execute on function pg_temp.p6_repeat_normalize(jsonb),pg_temp.p6_repeat_once(text,integer,integer) to authenticated;
select 'P6_REPEAT_ENV '||jsonb_build_object('postgres',current_setting('server_version'),'jit',current_setting('jit'),
 'planCacheMode',current_setting('plan_cache_mode'),'workMem',current_setting('work_mem'),'sharedBuffers',current_setting('shared_buffers'),
 'statementTimeout',current_setting('statement_timeout'),'totalNeeds',(select count(*) from public.needs),'matchedNeeds',3000,
 'distribution','1500_coincident_sparse_and_100_pointfree','concurrency',1,'blocks',3,'warmupsPerCase',5,'samplesPerBlockCase',30,
 'network','SQL_only','rlsBypassed',false)::text;
set local role authenticated;
-- Warmups include the first authoritative expected payload; no sampled timings yet.
select format('select pg_temp.p6_repeat_once(%L,0,0);',label)
 from p6_repeat_cases cross join generate_series(1,5) w order by w,label
\gexec
-- Three blocks on one runner/backend, balanced interleaving of the eight cases.
-- psql gexec uses one statement per invocation and preserves the 60s timeout.
select format('select pg_temp.p6_repeat_once(%L,%s,%s);',label,b,s)
 from p6_repeat_cases cross join generate_series(1,3) b cross join generate_series(1,30) s
 order by b,s,case when (b+s)%2=0 then label end asc,case when (b+s)%2<>0 then label end desc
\gexec
select 'P6_REPEAT_SAMPLES '||jsonb_agg(jsonb_build_object('block',block,'case',label,'sample',sample,'ms',elapsed_ms,
 'responseBytes',response_bytes,'resultSize',result_size) order by block,label,sample)::text from p6_repeat_samples;
\echo 'PASS P6_REPEAT_720_SAMPLES_RLS_AND_PAYLOAD_GUARDS'
