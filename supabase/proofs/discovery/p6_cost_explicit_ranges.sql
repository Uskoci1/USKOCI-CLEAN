-- Included inside the paired proof immediately before measured samples.
-- Explicit dates normalize when='any'; do not confuse that with no date filter.
select format('select pg_temp.p6_pair_check(%L::jsonb);',jsonb_set(request,'{filter,dates}',d))
 from p6_cost_requests cross join unnest(array['{"from":"2026-09-28","to":"2026-09-30"}'::jsonb,'{"from":"2026-03-29","to":"2026-03-29"}'::jsonb]) d
 where label<>'EXACT_PUBLIC'
\gexec
\echo 'PASS P6_COST_EXPLICIT_RANGE_PARITY'
