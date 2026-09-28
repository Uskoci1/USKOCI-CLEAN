-- Full-field substring semantics: title shortcut must not remove area/tool
-- searches, remote labels or matches crossing the title/locality separator.
reset role;
set local session_replication_role=replica;
update public.needs set required_tools=array['P6_SAW_TOOL'],title=title||' ΣΟΣ Łódź'
 where id=current_setting('p6.extra1')::uuid;
set local session_replication_role=origin;
set local role authenticated;
select format('select pg_temp.p6_pair_check(%L::jsonb);',jsonb_set(request,'{filter,text}',to_jsonb(term)))
 from p6_cost_requests cross join unnest(array['literal %_','čć žž','žž vračar','vračar','beograd','na daljinu','p6_saw_tool','σος','łódź','']) term
 where label in ('PAGE','MAP')
\gexec
-- The fixture change must not invalidate the measured EXACT expected payload.
-- Re-freeze only after direct full equality has been checked by the two RPCs.
do $refreeze$
declare req jsonb; answer jsonb;
begin
 select request into strict req from pg_temp.p6_cost_requests where label='EXACT_PUBLIC';
 perform pg_temp.p6_pair_check(req);
 answer:=public.p6b_rpc_discovery_v1(req);
 update pg_temp.p6_cost_requests set expected=pg_temp.p6_normalize_cost_reply(answer) where label='EXACT_PUBLIC';
end $refreeze$;
select format('select pg_temp.p6_pair_check(%L::jsonb);',jsonb_set(request,'{filter,place}',to_jsonb('Vračar, Beograd'::text)))
 from p6_cost_requests where label in ('PAGE','MAP')
\gexec
\echo 'PASS P6_COST_TEXT_SHORTCUT_AND_FALLBACK_PARITY'
