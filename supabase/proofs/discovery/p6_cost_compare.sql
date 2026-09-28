-- Runs inside the original disposable rollback proof, after its spatial cases.
reset role;
-- Add two synthetic selection facts without running marketplace side effects.
-- This proves canonical capacity projection, not a selection business journey.
set local session_replication_role=replica;
insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,selection_mode,status)
 select id,revision,current_setting('p6.owner')::uuid,'p6-cost-'||gen_random_uuid(),1,'REQUESTER_SELECTS','SELECTED'
 from public.needs where title like current_setting('p6.spatial_prefix')||'%' order by published_at desc,id desc limit 2;
set local session_replication_role=origin;
analyze public.needs;
analyze public.need_selections;
analyze public.agreements;
analyze private.account_lineage_v5;
analyze private.account_closure_requests;
create temporary table p6_cost_requests(label text primary key, request jsonb not null, expected jsonb);
insert into p6_cost_requests(label,request)
select 'PAGE',jsonb_build_object('mode','PAGE','filter',f,'anchor',null,'scope','{"kind":"ALL"}'::jsonb,'limit',37,'after',null) from
 (select jsonb_build_object('text',current_setting('p6.spatial_prefix'),'price','all','where','any','places',1,'when','any','dates',null,'place',null) f) q
union all select 'MAP',pg_temp.p6_spatial_map_request(current_setting('p6.spatial_prefix'),'[-180,-90,180,90]')
union all select 'PLACES',jsonb_build_object('mode','PLACES','filter',jsonb_build_object('text','','price','all','where','any','places',1,'when','any','dates',null,'place',null),
 'anchor',null,'prefix',current_setting('p6.spatial_prefix'),'facetArea',null,'limit',3,'after',null)
union all select 'EXACT_PUBLIC',jsonb_build_object('mode','EXACT_PUBLIC','needId',current_setting('p6.extra1'));
create temporary table p6_cost_samples(variant text not null,label text not null,sample integer not null,ms numeric not null,response_bytes integer not null,result_size integer not null,
 primary key(variant,label,sample));
create function pg_temp.p6_normalize_cost_reply(j jsonb) returns jsonb language sql immutable security invoker as $norm$
 select case when j?'counts' then jsonb_set(j-'asOf','{counts}',(j->'counts')-'observedAt') else j-'asOf' end
$norm$;
create function pg_temp.p6_pair_check(r jsonb) returns void language plpgsql security invoker as $pair$
declare old jsonb; newer jsonb;
begin
 if r->>'mode'<>'EXACT_PUBLIC' then r:=jsonb_set(r,'{anchor}','null'); end if;
 old:=public.p6b_rpc_discovery_v1(r);
 if r->>'mode'<>'EXACT_PUBLIC' then r:=jsonb_set(r,'{anchor}',old->'anchor'); end if;
 newer:=public.rpc_discovery_v1(r);
 if pg_temp.p6_normalize_cost_reply(old) is distinct from pg_temp.p6_normalize_cost_reply(newer) then raise exception 'P6_COST_RESPONSE_PARITY'; end if;
end $pair$;
create function pg_temp.p6_cost_once(kind text,sequence integer,v text) returns void language plpgsql security invoker as $cost$
declare r jsonb; expected_reply jsonb; answer jsonb; started timestamptz; elapsed numeric; size integer;
begin
 select request,expected into strict r,expected_reply from pg_temp.p6_cost_requests where label=kind;
 started:=clock_timestamp();
 if v='BEFORE' then answer:=public.p6b_rpc_discovery_v1(r);
 elsif v='AFTER' then answer:=public.rpc_discovery_v1(r);
 else raise exception 'P6_COST_INVALID_VARIANT'; end if;
 elapsed:=round((extract(epoch from clock_timestamp()-started)*1000)::numeric,3);
 if pg_temp.p6_normalize_cost_reply(answer) is distinct from expected_reply then raise exception 'P6_COST_MEASURED_RESPONSE_PARITY'; end if;
 size:=jsonb_array_length(case when kind='MAP' then answer->'buckets' else answer->'items' end);
 if kind='PAGE' and (answer#>>'{counts,listed}'<>'3000' or size<>37)
  or kind='MAP' and (answer#>>'{counts,mapped}'<>'3000' or answer#>>'{counts,withoutPoint}'<>'100' or size>256)
  or kind='PLACES' and size<>3 or kind='EXACT_PUBLIC' and size<>1 then raise exception 'P6_COST_RESPONSE_CHANGED'; end if;
 if sequence>0 then insert into pg_temp.p6_cost_samples values(v,kind,sequence,elapsed,octet_length(answer::text),size); end if;
end $cost$;
grant select,update on p6_cost_requests to authenticated;
grant select,insert on p6_cost_samples to authenticated;
grant execute on function pg_temp.p6_normalize_cost_reply(jsonb),pg_temp.p6_pair_check(jsonb),pg_temp.p6_cost_once(text,integer,text) to authenticated;
set local role authenticated;
-- Freeze one shared legitimate anchor and exact expected payload per case.
do $anchors$
declare t record; answer jsonb;
begin
 for t in select label,request from pg_temp.p6_cost_requests loop
  answer:=public.p6b_rpc_discovery_v1(t.request);
  update pg_temp.p6_cost_requests set request=case when label='EXACT_PUBLIC' then t.request else jsonb_set(t.request,'{anchor}',answer->'anchor') end,
   expected=pg_temp.p6_normalize_cost_reply(answer) where label=t.label;
 end loop;
end $anchors$;
-- Helper fast paths must preserve null, whitespace, quoting and remote semantics.
do $helpers$
declare a text; c text; is_remote boolean;
begin
 foreach a in array array[null,'','  ','Novi Sad','„Vračar, Beograd“','"Vračar" i "Zvezdara"','''Bor''',U&'\00A0\FEFF','İ I ı','Na daljinu'] loop
  if public.p6_discovery_unquote(a) is distinct from public.p6b_discovery_unquote(a) then raise exception 'P6_COST_UNQUOTE_PARITY'; end if;
  foreach c in array array[null,'','  ','Novi Sad','„Vračar, Beograd“','"Vračar" i "Zvezdara"','''Bor''',U&'\00A0\FEFF','İ I ı','Na daljinu'] loop
   foreach is_remote in array array[null,false,true] loop
    if public.p6_discovery_area(a,c,is_remote) is distinct from public.p6b_discovery_area(a,c,is_remote) then raise exception 'P6_COST_AREA_PARITY'; end if;
   end loop;
  end loop;
 end loop;
end $helpers$;
-- Separate top-level statements preserve the original per-request timeout.
select format('select pg_temp.p6_pair_check(%L::jsonb);',jsonb_set(request,'{filter,places}',to_jsonb(n)))
 from p6_cost_requests cross join generate_series(1,3) n where label<>'EXACT_PUBLIC'
\gexec
select format('select pg_temp.p6_pair_check(%L::jsonb);',jsonb_set(request,'{filter,when}',to_jsonb(w)))
 from p6_cost_requests cross join unnest(array['today','tomorrow','next7']) w where label<>'EXACT_PUBLIC'
\gexec
select format('select pg_temp.p6_pair_check(%L::jsonb);',jsonb_set(request,'{filter,where}',to_jsonb(w)))
 from p6_cost_requests cross join unnest(array['remote','onsite']) w where label<>'EXACT_PUBLIC'
\gexec
-- Exact projection must retain real nonzero coveredSlots (the late-read path).
do $capacity$
declare t record; answer jsonb;
begin
 for t in select id from public.needs where title like current_setting('p6.spatial_prefix')||'%' order by published_at desc,id desc limit 2 loop
  answer:=public.rpc_discovery_v1(jsonb_build_object('mode','EXACT_PUBLIC','needId',t.id));
  if answer#>>'{items,0,coveredSlots}'<>'1' then raise exception 'P6_COST_LATE_CAPACITY_LOST'; end if;
  perform pg_temp.p6_pair_check(jsonb_build_object('mode','EXACT_PUBLIC','needId',t.id));
 end loop;
end $capacity$;
\echo 'PASS P6_COST_HELPER_AND_FILTER_PARITY'
select 'P6_COST_ENV '||jsonb_build_object('postgres',current_setting('server_version'),'jit',current_setting('jit'),
 'planCacheMode',current_setting('plan_cache_mode'),'workMem',current_setting('work_mem'),'sharedBuffers',current_setting('shared_buffers'),
 'statementTimeout',current_setting('statement_timeout'),'fixtureMatched',3000,'distribution','skewed_1500_coincident_sparse_100_pointfree',
 'network','none_SQL_execution_only','concurrency',1,'warmupPerCase',5,'samplesPerCase',30,'interleaved',true)::text;
select format('select pg_temp.p6_cost_once(%L,0,%L);',label,v) from p6_cost_requests cross join generate_series(1,5) i cross join unnest(array['BEFORE','AFTER']) v order by label,i,v
\gexec
-- Alternating first variant reduces fixed ordering bias. Both read the SAME rows.
select format('select pg_temp.p6_cost_once(%L,%s,%L);',label,i,v) from p6_cost_requests cross join generate_series(1,30) i cross join unnest(array['BEFORE','AFTER']) v
 order by label,i,case when i%2=0 then v='BEFORE' else v='AFTER' end
\gexec
select 'P6_COST_SAMPLES '||jsonb_agg(jsonb_build_object('variant',variant,'mode',label,'sample',sample,'ms',ms,'responseBytes',response_bytes,'resultSize',result_size) order by variant,label,sample)::text from p6_cost_samples;
reset role;
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
select pg_temp.p6_cost_once('PAGE',0,'AFTER');
do $tag$ begin raise notice 'P6_TRACE_BEGIN_MAP'; end $tag$;
select pg_temp.p6_cost_once('MAP',0,'AFTER');
do $tag$ begin raise notice 'P6_TRACE_BEGIN_PLACES'; end $tag$;
select pg_temp.p6_cost_once('PLACES',0,'AFTER');
do $tag$ begin raise notice 'P6_TRACE_END'; end $tag$;
reset role;
set local auto_explain.log_min_duration=-1;
set local role authenticated;
\echo 'PASS P6_COST_PAIRED_30_PER_MODE'
