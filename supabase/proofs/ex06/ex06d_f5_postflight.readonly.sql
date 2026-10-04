-- EX-06 ex06d-F5 read-only postflight.
with x as (select md5(replace(prosrc,E'\r','')) md5 from pg_proc where oid=to_regprocedure('private.dispatch_cheap_candidate_admitted(uuid,uuid)'))
select jsonb_build_object(
 'bodyMd5',(select md5 from x),
 'closureDigest',private.closure_source_digest_v5(),
 'certifiedDigest',(select sha256 from private.closure_source_v5 where singleton),
 'retentionReady',private.retention_ai_source_ready(),
 'liveResponseIndex',to_regclass('public.marketplace_responses_one_live_per_worker_need') is not null,
 'problems',to_jsonb(array_remove(array[
  case when (select md5 from x) <> '887c8b4c5cdc9062d04277bdd05d2167' then 'BODY_MISMATCH' end,
  case when private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then 'CLOSURE_DIGEST_MISMATCH' end,
  case when private.retention_ai_source_ready() is distinct from true then 'RETENTION_NOT_READY' end,
  case when to_regclass('public.marketplace_responses_one_live_per_worker_need') is null then 'LIVE_RESPONSE_INDEX_MISSING' end
 ]::text[],null))
);
