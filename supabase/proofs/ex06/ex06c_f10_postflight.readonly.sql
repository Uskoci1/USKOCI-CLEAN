-- EX-06 ex06c-F10 read-only postflight. Safe on DEV or a disposable chain.
with f as (
  select n.nspname||'.'||p.proname as fn,
         md5(replace(p.prosrc,E'\r','')) as prosrc_md5,
         p.prosecdef,
         p.provolatile,
         p.proconfig,
         p.proacl::text as acl,
         pg_get_userbyid(p.proowner) as owner_name
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname,p.proname) in (
    ('private','dispatch_next_wave'),
    ('private','dispatch_tick')
  )
),
checks as (
  select
    (select prosrc_md5 from f where fn='private.dispatch_next_wave') as wave_md5,
    (select prosrc_md5 from f where fn='private.dispatch_tick') as tick_md5,
    private.closure_source_digest_v5() as live_digest,
    (select sha256 from private.closure_source_v5 where singleton) as certified_digest,
    private.retention_ai_source_ready() as retention_ready,
    exists(
      select 1 from pg_trigger t
      where t.tgfoid in (
        to_regprocedure('private.dispatch_next_wave(uuid)')::oid,
        to_regprocedure('private.dispatch_tick(integer,timestamptz)')::oid
      ) and not t.tgisinternal
    ) as target_is_trigger
)
select jsonb_build_object(
  'waveMd5',wave_md5,
  'tickMd5',tick_md5,
  'closureDigest',live_digest,
  'certifiedDigest',certified_digest,
  'retentionReady',retention_ready,
  'problems',to_jsonb(array_remove(array[
    case when wave_md5 <> '3cc3af3cdbafbfbc51a491ac2ce6581d' then 'WAVE_BODY_MISMATCH' end,
    case when tick_md5 <> '1600e4e3402d59c3ada13e3226a467c1' then 'TICK_BODY_MISMATCH' end,
    case when live_digest is distinct from certified_digest then 'CLOSURE_DIGEST_MISMATCH' end,
    case when retention_ready is distinct from true then 'RETENTION_NOT_READY' end,
    case when target_is_trigger then 'TARGET_IS_TRIGGER' end
  ]::text[],null))
)
from checks;
