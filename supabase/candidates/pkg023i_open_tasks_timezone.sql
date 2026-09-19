-- PKG-023i: the bounded marketplace reader carries the three fields a task card cannot render without.
--
-- A CANDIDATE. NOT APPLIED ANYWHERE. It exists because wiring the client to pkg023d found a gap, and the
-- gap is not a client problem: the reader cannot replace the legacy table read until it carries these.
--
-- What is missing. public.rpc_list_open_tasks_v3 (pkg023d) returns an allowlisted item. The client's shared
-- public projection (src/data/supabaseIzvor.ts publicTaskContext, src/data/needDetailPresentation.ts
-- readPublicNeedDetail) needs three fields that are not in it:
--
--   task_timezone              needScheduleText falls back to UTC without it, so a task at 15:00 in
--                              Belgrade would be shown to everyone as 13:00. A wrong time on a card is
--                              worse than no card.
--   task_country_code          the same projection reads it beside the timezone
--   verified_identity_required a condition of the task, shown with the other conditions
--
-- All three are already public on the task detail that any signed-in viewer can open, and none of them
-- names a person or a place: this is the same disclosure, moved to the row where the card needs it.
--
-- What stays out, deliberately. `description` is NOT added. The list would then ship fifty descriptions to
-- every viewer of every page, and the client's list does not use it: the marketplace search matches title,
-- area and conditions (src/data/marketplaceView.ts), and the description is read by the detail screen, for
-- one task, when a person opens it. requester_account_id and every exact coordinate, address and access
-- note stay out for the reasons pkg023d gives.
--
-- It replaces one function body and nothing else. It is not part of the closure source digest, which it
-- asserts on itself, and it changes no table, policy, grant or index.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table pkg023i_predecessor(source_digest text not null) on commit drop;

do $pre$
declare v_body text;
begin
  if to_regprocedure('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)') is null then
    raise exception 'PKG023I_REQUIRES_PKG023D';
  end if;
  -- The body this edits is the body pkg023d applied on 2026-09-19 and nothing else.
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure)
     is distinct from '04a8f14a385b468ef1be847c8f4482c0' then
    raise exception 'PKG023I_BODY_IS_NOT_THE_REVIEWED_ONE';
  end if;
  select prosrc into strict v_body from pg_proc where oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure;
  if position('taskTimezone' in v_body) > 0 then raise exception 'PKG023I_ALREADY_APPLIED'; end if;
  insert into pkg023i_predecessor values (private.closure_source_digest_v5());
end
$pre$;

do $change$
declare def text; anchor constant text := $a$'executionLocationMode', n.execution_location_mode,$a$;
begin
  def := pg_get_functiondef('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure);
  if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then raise exception 'PKG023I_ANCHOR_NOT_UNIQUE'; end if;
  execute replace(def, anchor, anchor || $a$
      'taskCountryCode', n.task_country_code, 'taskTimezone', n.task_timezone,
      'verifiedIdentityRequired', n.verified_identity_required,$a$);
end
$change$;

do $post$
declare v_body text;
begin
  select prosrc into strict v_body from pg_proc where oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure;
  -- Exactly the three keys, each once, and nothing the allowlist refuses.
  if (length(v_body) - length(replace(v_body, 'taskTimezone', ''))) <> length('taskTimezone')
     or (length(v_body) - length(replace(v_body, 'taskCountryCode', ''))) <> length('taskCountryCode')
     or (length(v_body) - length(replace(v_body, 'verifiedIdentityRequired', ''))) <> length('verifiedIdentityRequired')
     or position('n.description' in v_body) > 0
     or position('requester_account_id' in v_body) > 0
     or position('exact_address' in v_body) > 0 then
    raise exception 'PKG023I_BODY_NOT_AS_REVIEWED';
  end if;
  -- The security envelope of a reader that stands on RLS is not a detail.
  if (select count(*) from pg_proc p where p.oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure
       and not p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog']::text[]) <> 1 then
    raise exception 'PKG023I_ENVELOPE_CHANGED';
  end if;
  if has_function_privilege('anon', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'PKG023I_GRANTS_NOT_EXACT';
  end if;
  if (select source_digest from pkg023i_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG023I_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
