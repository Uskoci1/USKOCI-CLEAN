-- P6 ROLLOUT V2 REVERT (source only, NOT APPLIED). Removes exactly what p6_discovery_rollout_v2.sql added or changed: the seven P6 functions, the
-- rls_private world-set helper, and the two `needs` policies it rewrote (restored to their previous text). It leaves the restricted Need ACL, the
-- certificate and every other object alone: PKG-045b has its own revert (pkg045b_revert_p0.sql), and this rollout never moved the certificate.
-- Client builds compiled with EXPO_PUBLIC_P6_DISCOVERY_READER=1 stop working against a backend where this has been applied: rebuild them without the
-- flag (the legacy readers are untouched) before or together with applying it.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create temporary table p6_revert_before(cert text, erasure text, digest text, ready boolean, needs_acl text) on commit drop;
insert into p6_revert_before select (select sha256 from private.closure_source_v5 where singleton),(select sha256 from private.closure_erasure_source_v5 where singleton),
  private.closure_source_digest_v5(), private.retention_ai_source_ready(), (select relacl::text from pg_class where oid='public.needs'::regclass);
do $pre$
begin
  if to_regprocedure('public.rpc_discovery_v1(jsonb)') is null or to_regprocedure('rls_private.p6_discovery_test_world_accounts()') is null
    then raise exception 'P6_REVERT_NOT_APPLIED'; end if;
  if (select cert from p6_revert_before) is distinct from (select digest from p6_revert_before)
    or (select erasure from p6_revert_before) is distinct from (select digest from p6_revert_before)
    or (select ready from p6_revert_before) is distinct from true then raise exception 'P6_REVERT_CERTIFICATE_NOT_READY'; end if;
  if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'P6_REVERT_CLOSURE_IN_FLIGHT'; end if;
  -- The two policies must be EXACTLY what this rollout wrote (md5 of pg_policies.qual, as recorded by its proof); anything else is drift that a
  -- revert must not overwrite blindly.
  if (select md5(pg_get_expr(polqual,polrelid)) from pg_policy where polrelid='public.needs'::regclass and polname='needs_public_discovery')
       is distinct from '7d2b4a721dfb96bc3a5cac893aefe939'
    or (select md5(pg_get_expr(polqual,polrelid)) from pg_policy where polrelid='public.needs'::regclass and polname='v5_closed_account_visibility')
       is distinct from '27782111557095551c5a184087afd5bc'
    then raise exception 'P6_REVERT_POLICY_NOT_APPLIED'; end if;
end;
$pre$;
alter policy needs_public_discovery on public.needs using (((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND private.viewer_same_world(requester_account_id)));
alter policy v5_closed_account_visibility on public.needs using (rpc_storage_account_open());
do $policies$
begin
  if (select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy
      where polrelid='public.needs'::regclass and polname='needs_public_discovery') is distinct from 'ed00926507c77f66cae00b9bb1658260'
    or (select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy
      where polrelid='public.needs'::regclass and polname='v5_closed_account_visibility') is distinct from '4ebb7084e0f62d4fd302bab52be65594'
    then raise exception 'P6_REVERT_POLICY_TEXT_MISMATCH'; end if;
end;
$policies$;
drop function public.rpc_discovery_v1(jsonb);
drop function public.p6_discovery_civil(text);
drop function public.p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone);
drop function public.p6_discovery_area(text,text,boolean);
drop function public.p6_discovery_unquote(text);
drop function public.p6_discovery_key(text);
drop function public.p6_discovery_trim(text);
drop function rls_private.p6_discovery_test_world_accounts();
do $post$
declare b record;
begin
  select * into strict b from p6_revert_before;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'p6\_discovery\_%')
      or (n.nspname='public' and p.proname='rpc_discovery_v1') or (n.nspname='rls_private' and p.proname='p6_discovery_test_world_accounts'))
    then raise exception 'P6_REVERT_FUNCTIONS_REMAIN'; end if;
  if (select sha256 from private.closure_source_v5 where singleton) is distinct from b.cert
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from b.erasure
    or private.closure_source_digest_v5() is distinct from b.digest or private.retention_ai_source_ready() is distinct from true
    or (select relacl::text from pg_class where oid='public.needs'::regclass) is distinct from b.needs_acl
    then raise exception 'P6_REVERT_CERTIFICATE_OR_ACL_MOVED'; end if;
end;
$post$;
notify pgrst, 'reload schema';
commit;
