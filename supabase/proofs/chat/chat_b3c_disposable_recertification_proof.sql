-- B3c disposable recertification ONLY. Not a candidate for DEV application.
-- The exact-source, loopback-only harness owns BEGIN/COMMIT (or rollback for a
-- refused mutation). The expected digests/metadata come from the unchanged
-- complete catalog handoff of this run's already-passing SQL + Realtime proof.
-- This file never discovers a replacement accepted digest by itself.
\if :b3c_local_target_attested
\else
  \quit 3
\endif
select :'HOST'='127.0.0.1' and :'PORT'='54322'
  and :'DBNAME'='postgres' and current_user='postgres' as b3c_local_connection
\gset
\if :b3c_local_connection
\else
  \quit 3
\endif
set local lock_timeout='5s';
set local statement_timeout='30s';
do $admission$
begin
  if current_setting('uskoci.chat_b3c_disposable_recertification',true)
      is distinct from 'LOCAL_ONLY_CERTIFIED_ERASURE' then
    raise exception 'CHAT_B3C_DISPOSABLE_RECERTIFICATION_ONLY' using errcode='55000';
  end if;
end
$admission$;

create temporary table chat_b3c_recert_state on commit drop as
select :'b3c_expected_old'::text expected_old, :'b3c_expected_new'::text expected_new,
  :'b3c_expected_readiness_md5'::text expected_readiness_md5,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) source,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness,
  (select to_jsonb(p) from pg_proc p where oid='private.retention_ai_source_ready()'::regprocedure) readiness_metadata;

do $pre$
declare s record;
begin
  select * into strict s from chat_b3c_recert_state;
  if s.expected_old!~'^[0-9a-f]{64}$' or s.expected_new!~'^[0-9a-f]{64}$'
      or s.expected_readiness_md5!~'^[0-9a-f]{32}$' or s.expected_old=s.expected_new then
    raise exception 'CHAT_B3C_RECERT_INPUT_INVALID' using errcode='55000';
  end if;
  if (select count(*) from private.closure_source_v5)<>1
      or (select count(*) from private.closure_erasure_source_v5)<>1
      or s.source->>'sha256' is distinct from s.expected_old
      or s.erasure->>'sha256' is distinct from s.expected_old
      or private.closure_source_digest_v5() is distinct from s.expected_new
      or private.retention_ai_source_ready() is distinct from false
      or private.closure_erasure_binding_v5() is not null
      or to_regclass('public.agreement_invalidations_v1') is null then
    raise exception 'CHAT_B3C_RECERT_PREDECESSOR_DRIFT' using errcode='55000';
  end if;
  if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then
    raise exception 'CHAT_B3C_RECERT_CLOSURE_IN_FLIGHT' using errcode='55000';
  end if;
  if (select md5(to_jsonb(p)::text) from pg_proc p where oid='private.retention_ai_source_ready()'::regprocedure)
      is distinct from s.expected_readiness_md5
      or not exists(select 1 from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure
        and (length(prosrc)-length(replace(prosrc,s.expected_old,'')))=length(s.expected_old)
        and md5(replace(replace(prosrc,E'\r\n',E'\n'),s.expected_old,'__CERTIFIED_SOURCE__'))='bc85a1a744869abb6441e647b18b2195'
        and prolang=(select oid from pg_language where lanname='sql') and provolatile='s' and not proisstrict
        and prorettype='boolean'::regtype and prokind='f' and prosecdef
        and proconfig=array['search_path=pg_catalog'] and proowner='postgres'::regrole
        and proacl::text='{postgres=X/postgres}')
      or (length(s.readiness)-length(replace(s.readiness,s.expected_old,'')))<>length(s.expected_old)
      or (select count(*) from regexp_matches(s.readiness,'[0-9a-f]{64}','g'))<>1 then
    raise exception 'CHAT_B3C_RECERT_READINESS_DRIFT' using errcode='55000';
  end if;
end
$pre$;

-- The already-proven candidate is installed. Only these three bindings move;
-- no schema, erasure roster, policy, publication, grants or personal row changes.
do $rebind$
declare s record; affected integer;
begin
  select * into strict s from chat_b3c_recert_state;
  update private.closure_source_v5 set sha256=s.expected_new where singleton and sha256=s.expected_old;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CHAT_B3C_RECERT_SOURCE_ROW_COUNT' using errcode='55000';end if;
  update private.closure_erasure_source_v5 set sha256=s.expected_new where singleton and sha256=s.expected_old;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CHAT_B3C_RECERT_ERASURE_ROW_COUNT' using errcode='55000';end if;
  execute replace(s.readiness,s.expected_old,s.expected_new);
end
$rebind$;

do $post$
declare s record; current_metadata jsonb;
begin
  select * into strict s from chat_b3c_recert_state;
  select to_jsonb(p) into strict current_metadata from pg_proc p where oid='private.retention_ai_source_ready()'::regprocedure;
  if (select to_jsonb(c) from private.closure_source_v5 c where singleton)
      is distinct from jsonb_set(s.source,'{sha256}',to_jsonb(s.expected_new))
      or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)
      is distinct from jsonb_set(s.erasure,'{sha256}',to_jsonb(s.expected_new))
      or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure)
      is distinct from replace(s.readiness,s.expected_old,s.expected_new)
      or current_metadata-'prosrc' is distinct from s.readiness_metadata-'prosrc'
      or current_metadata->>'prosrc' is distinct from replace(s.readiness_metadata->>'prosrc',s.expected_old,s.expected_new)
      or private.closure_source_digest_v5() is distinct from s.expected_new
      or private.retention_ai_source_ready() is distinct from true
      or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from s.expected_new then
    raise exception 'CHAT_B3C_RECERT_POSTCONDITION' using errcode='55000';
  end if;
  if has_function_privilege('anon','private.retention_ai_source_ready()','EXECUTE')
      or has_function_privilege('authenticated','private.retention_ai_source_ready()','EXECUTE') then
    raise exception 'CHAT_B3C_RECERT_AUTHORITY_CHANGED' using errcode='55000';
  end if;
end
$post$;
-- No COMMIT. Only the independently attested disposable harness can commit.
