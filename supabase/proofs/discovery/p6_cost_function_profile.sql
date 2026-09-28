-- One instrumented diagnostic after all uninstrumented paired samples.
-- No privilege elevation: unavailable SET permission is reported, never granted.
reset role;
select has_parameter_privilege(current_user,'track_functions','SET') as p6_functions_allowed
\gset
\if :p6_functions_allowed
select current_setting('track_functions') as p6_prior_track
\gset
set local track_functions='all';
create temporary table p6_function_before as
 select funcid,calls,total_time,self_time from pg_stat_xact_user_functions;
set local role authenticated;
select pg_temp.p6_cost_once('PLACES',0,'AFTER');
reset role;
select 'P6_FUNCTION_PROFILE '||jsonb_build_object('available',true,'mode','PLACES','samples',1,'instrumented',true,
 'functions',coalesce((select jsonb_agg(jsonb_build_object('function',f.funcid::regprocedure::text,'calls',f.calls-coalesce(b.calls,0),
   'totalMs',round((f.total_time-coalesce(b.total_time,0))::numeric,3),'selfMs',round((f.self_time-coalesce(b.self_time,0))::numeric,3))
   order by (f.self_time-coalesce(b.self_time,0)) desc,f.funcid::regprocedure::text)
  from pg_stat_xact_user_functions f left join p6_function_before b using(funcid)
  join pg_proc p on p.oid=f.funcid join pg_namespace n on n.oid=p.pronamespace
  where f.calls>coalesce(b.calls,0) and n.nspname in ('public','private','rls_private','auth')),'[]'::jsonb),
 'limits','Single instrumented call; not a percentile. Nested totalMs must not be summed. Inlined SQL functions are not tracked.')::text;
select set_config('track_functions',:'p6_prior_track',true);
\else
select 'P6_FUNCTION_PROFILE {"available":false,"reason":"NO_EXISTING_SET_PRIVILEGE","samples":0}';
\endif
set local role authenticated;
