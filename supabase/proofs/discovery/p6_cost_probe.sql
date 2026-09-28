-- Injected before the existing auth/authority/rollback checks. Fixture-only.
reset role;
analyze public.needs;
analyze public.need_selections;
analyze public.agreements;
analyze private.account_lineage_v5;
analyze private.account_closure_requests;
create temporary table p6_cost_requests(label text primary key, request jsonb not null);
insert into p6_cost_requests
select 'PAGE',jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope','{"kind":"ALL"}'::jsonb,'limit',37,'after',null) from
 (select jsonb_build_object('text',current_setting('p6.spatial_prefix'),'price','all','where','any','places',1,'when','any','dates',null,'place',null) f) q
union all select 'MAP',pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[-180,-90,180,90]')
union all select 'PLACES',jsonb_build_object('mode','PLACES','filter',jsonb_build_object('text','','price','all','where','any','places',1,'when','any','dates',null,'place',null),
 'anchor',null,'prefix',current_setting('p6.spatial_prefix'),'facetArea',null,'limit',3,'after',null)
union all select 'EXACT_PUBLIC',jsonb_build_object('mode','EXACT_PUBLIC','needId',current_setting('p6.extra1'));
create temporary table p6_cost_samples(label text not null, sample integer not null, ms numeric not null, response_bytes integer not null, result_size integer not null,
 primary key(label,sample));
grant select on p6_cost_requests to authenticated;
grant select,insert on p6_cost_samples to authenticated;
create function pg_temp.p6_cost_once(kind text,sequence integer) returns void language plpgsql security invoker as $cost$
declare r jsonb; answer jsonb; started timestamptz; elapsed numeric; size integer;
begin
 select request into strict r from pg_temp.p6_cost_requests where label=kind;
 started:=clock_timestamp(); answer:=public.rpc_discovery_v1(r);
 elapsed:=round((extract(epoch from clock_timestamp()-started)*1000)::numeric,3);
 size:=jsonb_array_length(case when kind='MAP' then answer->'buckets' else answer->'items' end);
 if kind='PAGE' and (answer#>>'{counts,listed}'<>'3000' or size<>37)
  or kind='MAP' and (answer#>>'{counts,mapped}'<>'3000' or answer#>>'{counts,withoutPoint}'<>'100' or size>256)
  or kind='PLACES' and size<>3 or kind='EXACT_PUBLIC' and size<>1 then raise exception 'P6_COST_RESPONSE_CHANGED'; end if;
 if sequence>0 then insert into pg_temp.p6_cost_samples values(kind,sequence,elapsed,octet_length(answer::text),size); end if;
end $cost$;
grant execute on function pg_temp.p6_cost_once(text,integer) to authenticated;
select 'P6_COST_ENV '||jsonb_build_object('postgres',current_setting('server_version'),'jit',current_setting('jit'),
 'planCacheMode',current_setting('plan_cache_mode'),'workMem',current_setting('work_mem'),
 'sharedBuffers',current_setting('shared_buffers'),'statementTimeout',current_setting('statement_timeout'),
 'totalNeeds',(select count(*) from public.needs),'fixtureMatched',3000,'distribution','skewed_1500_coincident_sparse_100_pointfree',
 'network','none_SQL_execution_only','concurrency',1,'warmupPerCase',5,'samplesPerCase',30)::text;
set local role authenticated;
-- Preserve statement timeouts: each invocation is its own top-level statement.
select format('select pg_temp.p6_cost_once(%L,0);',label) from p6_cost_requests cross join generate_series(1,5) i order by label,i
\gexec
select format('select pg_temp.p6_cost_once(%L,%s);',label,i) from p6_cost_requests cross join generate_series(1,30) i order by label,i
\gexec
select 'P6_COST_SAMPLES '||jsonb_agg(jsonb_build_object('mode',label,'sample',sample,'ms',ms,'responseBytes',response_bytes,'resultSize',result_size) order by label,sample)::text from p6_cost_samples;
reset role;
-- Trace only after the uninstrumented samples. PostgreSQL 17 supports nested
-- auto_explain plans; a top-level SELECT function(...) is not internal proof.
-- Supabase already preloads auto_explain; LOAD itself requires superuser.
-- Do not grant superuser/role privileges just to collect a plan.
do $loaded$ begin
 if current_setting('auto_explain.log_min_duration',true) is null then raise exception 'P6_AUTO_EXPLAIN_NOT_PRELOADED'; end if;
end $loaded$;
set local auto_explain.log_analyze=on;
set local auto_explain.log_buffers=on;
set local auto_explain.log_timing=off;
set local auto_explain.log_nested_statements=on;
set local auto_explain.log_parameter_max_length=0;
set local auto_explain.log_format=json;
set local auto_explain.log_level=notice;
set local auto_explain.log_min_duration=1;
set local role authenticated;
do $tag$ begin raise notice 'P6_TRACE_BEGIN_PAGE'; end $tag$;
select pg_temp.p6_cost_once('PAGE',0);
do $tag$ begin raise notice 'P6_TRACE_BEGIN_MAP'; end $tag$;
select pg_temp.p6_cost_once('MAP',0);
do $tag$ begin raise notice 'P6_TRACE_BEGIN_PLACES'; end $tag$;
select pg_temp.p6_cost_once('PLACES',0);
do $tag$ begin raise notice 'P6_TRACE_END'; end $tag$;
reset role;
set local auto_explain.log_min_duration=-1;
set local role authenticated;
\echo 'PASS P6_COST_MEASURED_30_PER_MODE'
