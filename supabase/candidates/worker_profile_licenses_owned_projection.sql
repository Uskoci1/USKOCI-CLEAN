-- P5 SOURCE-ONLY candidate. NOT APPLIED / NOT RUNTIME-PROVEN / NOT CLIENT-WIRED.
-- Canonical DEV catalog read through the Supabase connector on 2026-09-27.
-- One atomic statement; the isolated proof includes it verbatim inside BEGIN/ROLLBACK.
-- Deliberately admitted only by the disposable proof. Future application requires
-- an explicitly approved application wrapper/revision and fresh predecessor checks.
-- Existing self-declared licenses are returned unchanged; no verification claim,
-- capability normalization, defaulting missing fields, profile write or new authority.
do $worker_profile_licenses$
declare
  target oid := to_regprocedure('public.rpc_get_worker_profile_for_edit()');
  before_proc jsonb; after_proc jsonb; before_comment text;
  definition text; expected_body text; source_digest text;
  certificate jsonb; erasure_certificate jsonb; readiness text; binding jsonb;
  anchor text := '''vehicles'',p.vehicles,''profile_status'',p.profile_status';
  replacement text := '''vehicles'',p.vehicles,''licenses'',p.licenses,''profile_status'',p.profile_status';
  pin record;
begin
  if current_setting('uskoci.worker_profile_licenses_proof',true) is distinct from 'LOCAL_ONLY_ROLLBACK' then
    raise exception 'WORKER_PROFILE_LICENSES_APPLICATION_NOT_ADMITTED' using errcode='55000';
  end if;
  select to_jsonb(p),obj_description(p.oid,'pg_proc') into before_proc,before_comment
    from pg_proc p where p.oid=target;
  if before_proc is null
    or md5(replace(before_proc->>'prosrc',E'\r\n',E'\n')) is distinct from '12ce32620e04ad369ccc239234d4213a'
    or before_comment is not null
    or (before_proc-array['oid','pronamespace','proowner','prolang','prorettype','prosrc']) is distinct from
      '{"proname":"rpc_get_worker_profile_for_edit","proacl":["postgres=X/postgres","authenticated=X/postgres"],
        "probin":null,"procost":100,"prokind":"f","prorows":0,"pronargs":0,
        "proconfig":["search_path=pg_catalog"],"proretset":false,"prosecdef":true,"prosqlbody":null,
        "prosupport":"-","proargmodes":null,"proargnames":null,"proargtypes":[],"proisstrict":false,
        "proparallel":"u","protrftypes":null,"provariadic":"0","provolatile":"s","proleakproof":false,
        "proallargtypes":null,"proargdefaults":null,"pronargdefaults":0}'::jsonb
    or not exists(select 1 from pg_proc p where p.oid=target and p.pronamespace='public'::regnamespace
      and p.proowner='postgres'::regrole and p.prolang=(select oid from pg_language where lanname='plpgsql')
      and p.prorettype='jsonb'::regtype)
    or has_function_privilege('anon',target,'EXECUTE')
    or has_function_privilege('service_role',target,'EXECUTE')
    or not has_function_privilege('authenticated',target,'EXECUTE') then
    raise exception 'WORKER_PROFILE_LICENSES_PREDECESSOR_DRIFT' using errcode='55000';
  end if;
  if not exists(select 1 from pg_attribute where attrelid='public.app_profiles'::regclass
      and attname='licenses' and atttypid='text[]'::regtype and attnotnull and not attisdropped) then
    raise exception 'WORKER_PROFILE_LICENSES_COLUMN_DRIFT' using errcode='55000';
  end if;
  -- These exact sources enumerate certified functions / relation triggers.
  -- The reader is in neither set. Fail closed if the source inventory changes.
  for pin in select * from (values
    ('private.closure_schema_digest_v5_139()','988b9d3ab9c0dc7341cd30a391184e40'),
    ('private.closure_source_digest_v5()','7840a7e70cd12bd599fa6d3bb3300cc7'),
    ('private.closure_erasure_program_digest_v5()','3ec8d244730415d3a047312366672375')
  ) pins(signature,body_md5) loop
    if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure(pin.signature))
        is distinct from pin.body_md5 then
      raise exception 'WORKER_PROFILE_LICENSES_CERTIFICATE_INVENTORY_DRIFT' using errcode='55000';
    end if;
  end loop;
  if exists(select 1 from pg_trigger where tgfoid=target and not tgisinternal) then
    raise exception 'WORKER_PROFILE_LICENSES_CERTIFIED_TRIGGER_REFUSED' using errcode='55000';
  end if;
  source_digest:=private.closure_source_digest_v5();
  select to_jsonb(c) into certificate from private.closure_source_v5 c where singleton;
  select to_jsonb(c) into erasure_certificate from private.closure_erasure_source_v5 c where singleton;
  readiness:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  binding:=private.closure_erasure_binding_v5();
  if source_digest is null or certificate->>'sha256' is distinct from source_digest
    or erasure_certificate->>'sha256' is distinct from source_digest
    or binding->>'sourceSha256' is distinct from source_digest
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'WORKER_PROFILE_LICENSES_CERTIFICATE_NOT_READY' using errcode='55000';
  end if;
  definition:=pg_get_functiondef(target);
  if length(definition)-length(replace(definition,anchor,'')) <> length(anchor) then
    raise exception 'WORKER_PROFILE_LICENSES_ANCHOR_DRIFT' using errcode='55000';
  end if;
  expected_body:=replace(before_proc->>'prosrc',anchor,replacement);
  execute replace(definition,anchor,replacement);
  select to_jsonb(p) into after_proc from pg_proc p where p.oid=target;
  if after_proc-'prosrc' is distinct from before_proc-'prosrc'
    or after_proc->>'prosrc' is distinct from expected_body
    or md5(replace(after_proc->>'prosrc',E'\r\n',E'\n')) is distinct from '61e77f00205f93704af5951c112f38d3'
    or obj_description(target,'pg_proc') is distinct from before_comment then
    raise exception 'WORKER_PROFILE_LICENSES_OUTPUT_OR_AUTHORITY_DRIFT' using errcode='55000';
  end if;
  if private.closure_source_digest_v5() is distinct from source_digest
    or (select to_jsonb(c) from private.closure_source_v5 c where singleton) is distinct from certificate
    or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) is distinct from erasure_certificate
    or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) is distinct from readiness
    or private.closure_erasure_binding_v5() is distinct from binding
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'WORKER_PROFILE_LICENSES_CERTIFICATE_CHANGED' using errcode='55000';
  end if;
end
$worker_profile_licenses$;
