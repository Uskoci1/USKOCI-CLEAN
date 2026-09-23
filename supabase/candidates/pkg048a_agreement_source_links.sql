-- PKG-048a candidate. F12 / control row D02 / gap PG04: a Dogovor does not say which Zadatak and which
-- Prijava it grew out of. Contract: docs/implementation/v5-ai-first/pkg048/PKG048_AGREEMENT_SOURCE_LINKS.md
--
-- What is missing today. public.rpc_get_agreement_workspace already joins public.needs on a.need_id and
-- already returns the task's title, area, city, slots and start, so both parties plainly see the task —
-- but not its id, and not the id of the offer that was selected. The screen therefore cannot offer "open
-- the Zadatak" or "open my Prijava", and the two ends of the one flow a person actually lived through stay
-- unlinked. Both ids are already known to both parties: the requester owns the task and selected that
-- offer, the worker wrote that offer and applied to that task. Nothing new is disclosed.
--
-- What this changes. Two keys in the same document, inserted before 'createdAt': needId and applicationId.
-- The body is otherwise verbatim — the transaction rewrites the live definition by replacing one anchor
-- that must occur exactly once, so no reviewed condition, join or authority is retyped. CREATE OR REPLACE
-- through pg_get_functiondef keeps the grants; the postconditions check them anyway.
--
-- Function-only: no table, column, constraint, trigger, table ACL or reviewed erasure function changes, so
-- the certified closure digest must NOT move. The candidate asserts that before and after, and refuses to
-- run twice.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg048_state(certified text not null, acl text not null) on commit drop;

do $pre$
declare v_certified text; v_src text;
begin
  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.rpc_get_agreement_workspace(uuid)');
  if v_src is null then
    raise exception 'PKG048_PREDECESSOR_MISSING' using errcode = '55000';
  end if;
  -- Not already applied, in any form.
  if position('''needId''' in v_src) > 0 or position('''applicationId''' in v_src) > 0 then
    raise exception 'PKG048_ALREADY_APPLIED' using errcode = '55000';
  end if;
  if md5(v_src) is distinct from '06a6485e5bf6c12b6d4c22d1668ecf76' then
    raise exception 'PKG048_PREDECESSOR_DRIFT: rpc_get_agreement_workspace' using errcode = '55000';
  end if;
  -- The two columns the new keys read, on the relation the function already joins.
  if (select count(*) from pg_attribute where attrelid = 'public.agreements'::regclass and not attisdropped
        and attname in ('need_id','selected_response_id')) <> 2 then
    raise exception 'PKG048_PREDECESSOR_DRIFT: public.agreements' using errcode = '55000';
  end if;
  -- One certified value, live, ready.
  select sha256 into strict v_certified from private.closure_source_v5 where singleton;
  if v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
     or private.closure_source_digest_v5() is distinct from v_certified
     or not private.retention_ai_source_ready() then
    raise exception 'PKG048_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg048_state(certified, acl)
  values (v_certified,
    has_function_privilege('anon', 'public.rpc_get_agreement_workspace(uuid)', 'EXECUTE')::text
    || has_function_privilege('authenticated', 'public.rpc_get_agreement_workspace(uuid)', 'EXECUTE')::text
    || has_function_privilege('service_role', 'public.rpc_get_agreement_workspace(uuid)', 'EXECUTE')::text);
end
$pre$;

-- The two source links, in the document that already carries everything else about this Dogovor.
do $links$
declare v_def text;
  v_anchor text := $anchor$'createdAt', a.created_at$anchor$;
  v_add text := $add$'needId', a.need_id,
      'applicationId', a.selected_response_id,
      $add$;
begin
  v_def := pg_get_functiondef('public.rpc_get_agreement_workspace(uuid)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'PKG048_ANCHOR_NOT_UNIQUE' using errcode = '55000';
  end if;
  execute replace(v_def, v_anchor, v_add || v_anchor);
end
$links$;

do $post$
declare s record; v_src text;
begin
  select * into strict s from pkg048_state;
  select prosrc into strict v_src from pg_proc where oid = to_regprocedure('public.rpc_get_agreement_workspace(uuid)');
  if md5(v_src) is distinct from 'afa60817d35f0efd1317e4b9915aa872' then
    raise exception 'PKG048_BODY_MISMATCH';
  end if;
  if position($k$'needId', a.need_id$k$ in v_src) = 0
     or position($k$'applicationId', a.selected_response_id$k$ in v_src) = 0 then
    raise exception 'PKG048_LINKS_NOT_PRESENT';
  end if;
  -- Authority is the predecessor's, unchanged.
  if not (select prosecdef from pg_proc where oid = to_regprocedure('public.rpc_get_agreement_workspace(uuid)'))
     or (select proconfig::text from pg_proc where oid = to_regprocedure('public.rpc_get_agreement_workspace(uuid)'))
        is distinct from '{search_path=pg_catalog}'
     or (select provolatile from pg_proc where oid = to_regprocedure('public.rpc_get_agreement_workspace(uuid)')) <> 's' then
    raise exception 'PKG048_FUNCTION_AUTHORITY_MISMATCH';
  end if;
  if s.acl is distinct from (has_function_privilege('anon', 'public.rpc_get_agreement_workspace(uuid)', 'EXECUTE')::text
      || has_function_privilege('authenticated', 'public.rpc_get_agreement_workspace(uuid)', 'EXECUTE')::text
      || has_function_privilege('service_role', 'public.rpc_get_agreement_workspace(uuid)', 'EXECUTE')::text) then
    raise exception 'PKG048_ACL_CHANGED';
  end if;
  -- Nothing the certificate watches was touched.
  if private.closure_source_digest_v5() is distinct from s.certified
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from s.certified
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from s.certified
     or not private.retention_ai_source_ready() then
    raise exception 'PKG048_CERTIFICATE_CHANGED';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
