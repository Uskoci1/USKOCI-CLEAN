-- SOURCE ONLY / DISPOSABLE P6 visibility-cost candidate. Not a live migration.
-- Preserve the existing REAL/TEST boundary exactly, but evaluate the tiny TEST account set
-- once per statement instead of calling the nested lineage classifier once per Need row.
do $p6_visibility_pre$
declare public_qual text; closed_qual text;
begin
  if current_user<>'postgres'
     or current_setting('p6_discovery.disposable',true) is distinct from 'SOURCE_ONLY_ROLLBACK'
    then raise exception 'P6_VISIBILITY_DISPOSABLE_ONLY'; end if;
  if to_regprocedure('rls_private.p6_discovery_test_world_accounts()') is not null
    then raise exception 'P6_VISIBILITY_ALREADY_INSTALLED'; end if;
  select qual into strict public_qual from pg_policies
    where schemaname='public' and tablename='needs' and policyname='needs_public_discovery';
  select qual into strict closed_qual from pg_policies
    where schemaname='public' and tablename='needs' and policyname='v5_closed_account_visibility';
  if position('private.viewer_same_world(requester_account_id)' in public_qual)=0
    then raise exception 'P6_VISIBILITY_WORLD_PREDECESSOR_DRIFT'; end if;
  if position('rpc_storage_account_open()' in closed_qual)=0
    then raise exception 'P6_VISIBILITY_CLOSURE_PREDECESSOR_DRIFT'; end if;
  create temporary table p6_visibility_before(source_digest text,certificate text,erasure text,needs_acl text) on commit drop;
  insert into p6_visibility_before
    select private.closure_source_digest_v5(),
      (select sha256 from private.closure_source_v5 where singleton),
      (select sha256 from private.closure_erasure_source_v5 where singleton),
      (select relacl::text from pg_class where oid='public.needs'::regclass);
end $p6_visibility_pre$;

create function rls_private.p6_discovery_test_world_accounts()
returns uuid[]
language sql
stable
security definer
set search_path=pg_catalog
as $f$
  select coalesce(array_agg(l.account_id order by l.account_id),array[]::uuid[])
  from private.account_lineage_v5 l
  where l.lineage in('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR')
$f$;
revoke all on function rls_private.p6_discovery_test_world_accounts()
  from public,anon,authenticated,service_role;
grant execute on function rls_private.p6_discovery_test_world_accounts() to authenticated;
comment on function rls_private.p6_discovery_test_world_accounts() is
  'P6 internal RLS helper. The rls_private schema is not a PostgREST API schema. Used only as an uncorrelated policy InitPlan.';

alter policy v5_closed_account_visibility on public.needs
  using ((select public.rpc_storage_account_open()));

alter policy needs_public_discovery on public.needs
  using (
    status=any(array['PUBLISHED'::text,'SELECTION'::text])
    and (select auth.uid()) is not null
    and (
      requester_account_id=any(coalesce((select rls_private.p6_discovery_test_world_accounts()),array[]::uuid[]))
    ) = (
      (select auth.uid())=any(coalesce((select rls_private.p6_discovery_test_world_accounts()),array[]::uuid[]))
    )
  );

do $p6_visibility_post$
declare before_row p6_visibility_before%rowtype; mismatch bigint; helper record; public_qual text;
begin
  select * into strict before_row from p6_visibility_before;
  if private.closure_source_digest_v5() is distinct from before_row.source_digest
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from before_row.certificate
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from before_row.erasure
     or (select relacl::text from pg_class where oid='public.needs'::regclass) is distinct from before_row.needs_acl
    then raise exception 'P6_VISIBILITY_AUTHORITY_MOVED'; end if;
  if before_row.source_digest is distinct from before_row.certificate or before_row.source_digest is distinct from before_row.erasure
    then raise exception 'P6_VISIBILITY_PREDECESSOR_NOT_CERTIFIED'; end if;

  select prosecdef,provolatile,proconfig,
    has_function_privilege('authenticated',oid,'EXECUTE') auth_exec,
    has_function_privilege('anon',oid,'EXECUTE') anon_exec,
    has_function_privilege('service_role',oid,'EXECUTE') service_exec
    into strict helper
  from pg_proc where oid='rls_private.p6_discovery_test_world_accounts()'::regprocedure;
  if helper.prosecdef is distinct from true or helper.provolatile is distinct from 's'
     or helper.proconfig is distinct from array['search_path=pg_catalog']
     or helper.auth_exec is distinct from true or helper.anon_exec or helper.service_exec
    then raise exception 'P6_VISIBILITY_HELPER_SECURITY'; end if;

  with ids as (
    select account_id from private.account_lineage_v5
    union select '00000000-0000-4000-8000-000000000001'::uuid
  ), pairs as (
    select left_ids.account_id as left_id,right_ids.account_id as right_id
    from ids left_ids cross join ids right_ids
  )
  select count(*) into mismatch from pairs
  where private.accounts_same_world(left_id,right_id) is distinct from (
    (left_id=any(rls_private.p6_discovery_test_world_accounts()))
    =
    (right_id=any(rls_private.p6_discovery_test_world_accounts()))
  );
  if mismatch<>0 then raise exception 'P6_VISIBILITY_SEMANTIC_MISMATCH:%',mismatch; end if;

  select qual into strict public_qual from pg_policies
    where schemaname='public' and tablename='needs' and policyname='needs_public_discovery';
  if position('p6_discovery_test_world_accounts' in public_qual)=0
     or position('auth.uid()' in public_qual)=0
    then raise exception 'P6_VISIBILITY_POLICY_POSTCONDITION'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='needs')<>6
    then raise exception 'P6_VISIBILITY_POLICY_SET_MOVED'; end if;
end $p6_visibility_post$;
