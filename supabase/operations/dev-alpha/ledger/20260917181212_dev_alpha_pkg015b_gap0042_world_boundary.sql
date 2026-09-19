-- PKG-015B / GAP-0042: synthetic acceptance data must never reach a real user.
--
-- Owner decision 2026-09-17, variant B: the owner's own accounts sit on the REAL side,
-- so the owner sees the app exactly as a stranger would. The TEST world is the dedicated
-- QA account, the synthetic fixtures and operators. Anything unclassified is REAL, so an
-- unregistered classification degrades to today's behaviour rather than to an exemption.
--
-- One rule at the boundary, applied where a person can find, be offered, apply to or look
-- at the other world: discovery, dispatch admission, response submission, public profile.
-- Nothing is deleted, no writer's data changes, and reputation, agreements, reviews and
-- the push transport are untouched, because discovery is the door to all of them.
--
-- Preflight on canonical DEV: zero cross-world agreements, responses or deliveries, so the
-- boundary breaks no existing relationship. Proven before writing, in a rolled-back
-- transaction under the authenticated role: owner 4 -> 0, business 4 -> 0, unclassified
-- stranger 0, QA 4 -> 4, fixture 4 -> 4.

DO $pre$
DECLARE v_cross bigint;
BEGIN
  select count(*) into v_cross from (
    select 1 from public.agreements a
     where coalesce(private.account_lineage(a.requester_account_id),'U') in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR')
        <> coalesce(private.account_lineage(a.worker_account_id),'U') in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR')
    union all
    select 1 from public.marketplace_responses mr join public.needs nd on nd.id = mr.need_id
     where coalesce(private.account_lineage(nd.requester_account_id),'U') in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR')
        <> coalesce(private.account_lineage(mr.worker_account_id),'U') in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR')
  ) x;
  IF v_cross <> 0 THEN RAISE EXCEPTION 'PRECONDITION_FAILED: % cross-world relationships exist and would break', v_cross; END IF;

  IF (select qual from pg_policies where schemaname='public' and tablename='needs' and policyname='needs_public_discovery')
     <> '(status = ANY (ARRAY[''PUBLISHED''::text, ''SELECTION''::text]))' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: needs_public_discovery changed since preflight'; END IF;
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_get_public_profile') <> '0b205a38d7722db8b2210dee7f6972d7' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: rpc_get_public_profile changed since preflight'; END IF;
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_submit_response') <> 'c8ff325885a8b8834fa3b90aff1b27e1' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: rpc_submit_response changed since preflight'; END IF;
END
$pre$;

create or replace function private.account_visibility_world(p_account_id uuid)
returns text language sql stable security definer set search_path = 'pg_catalog' as $w$
  select case when coalesce(private.account_lineage(p_account_id), 'UNCLASSIFIED')
                in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR') then 'TEST' else 'REAL' end;
$w$;
revoke all on function private.account_visibility_world(uuid) from public;

-- Two-account form, for definer functions only. Not granted to authenticated, so a user
-- cannot probe which world an arbitrary account belongs to.
create or replace function private.accounts_same_world(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = 'pg_catalog' as $s$
  select private.account_visibility_world(p_a) = private.account_visibility_world(p_b);
$s$;
revoke all on function private.accounts_same_world(uuid, uuid) from public;

-- Viewer form for row security: it only ever compares against the caller.
create or replace function private.viewer_same_world(p_account_id uuid)
returns boolean language sql stable security definer set search_path = 'pg_catalog' as $v$
  select auth.uid() is not null and private.accounts_same_world(p_account_id, auth.uid());
$v$;
revoke all on function private.viewer_same_world(uuid) from public;
grant execute on function private.viewer_same_world(uuid) to authenticated;

-- 1. Discovery: the door.
alter policy needs_public_discovery on public.needs
  using (status = any (array['PUBLISHED'::text, 'SELECTION'::text])
         and private.viewer_same_world(requester_account_id));

-- 2-4. The three functions, each changed by exactly one inserted guard.
DO $fn$
DECLARE def text; anchor text; added text;
BEGIN
  -- 2. Dispatch admission: nobody is offered work from the other world.
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='dispatch_cheap_candidate_admitted';
  anchor := E'      and p.account_id <> n.requester_account_id\n';
  IF (length(def) - length(replace(def, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'ANCHOR_NOT_UNIQUE: dispatch_cheap_candidate_admitted'; END IF;
  added := anchor || E'      and private.accounts_same_world(n.requester_account_id, p.account_id)\n';
  execute replace(def, anchor, added);

  -- 3. Public profile: the other world's profiles read as absent.
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='rpc_get_public_profile';
  anchor := E'  if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;\n';
  IF (length(def) - length(replace(def, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'ANCHOR_NOT_UNIQUE: rpc_get_public_profile'; END IF;
  added := anchor || E'  if not private.accounts_same_world(v_actor, v_profile.account_id) then return null; end if;\n';
  execute replace(def, anchor, added);

  -- 4. Response submission: a need in the other world is reported as not found, so its
  -- existence is not disclosed.
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='rpc_submit_response';
  anchor := E'    raise exception using errcode=''P0002'', message=''NEED_NOT_FOUND'';\n  end if;\n\n  select * into v_command';
  IF (length(def) - length(replace(def, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'ANCHOR_NOT_UNIQUE: rpc_submit_response'; END IF;
  added := E'    raise exception using errcode=''P0002'', message=''NEED_NOT_FOUND'';\n  end if;\n\n'
        || E'  if not private.accounts_same_world(n.requester_account_id, u) then\n'
        || E'    raise exception using errcode=''P0002'', message=''NEED_NOT_FOUND'';\n  end if;\n\n'
        || E'  select * into v_command';
  execute replace(def, anchor, added);
END
$fn$;

DO $post$
BEGIN
  IF position('viewer_same_world' in (select qual from pg_policies where schemaname='public' and tablename='needs' and policyname='needs_public_discovery')) = 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: discovery policy lacks the boundary'; END IF;
  IF (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where (n.nspname,p.proname) in (('private','dispatch_cheap_candidate_admitted'),('public','rpc_get_public_profile'),('public','rpc_submit_response'))
         and position('accounts_same_world' in pg_get_functiondef(p.oid)) > 0) <> 3 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: a function lacks the boundary guard'; END IF;
  IF (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where (n.nspname,p.proname) in (('private','dispatch_cheap_candidate_admitted'),('public','rpc_get_public_profile'),('public','rpc_submit_response'))
         and prosecdef) <> 3 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: a security envelope changed'; END IF;
  IF (select count(*) from pg_policies where schemaname='public' and tablename='needs') <> 6 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: needs policy set changed'; END IF;
END
$post$;