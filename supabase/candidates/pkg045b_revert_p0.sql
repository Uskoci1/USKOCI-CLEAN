-- PKG-045b REVERT (source only, NOT APPLIED). Restores exactly what pkg045b_task_column_privileges_p0.sql changed: the whole-table SELECT of
-- public.needs for anon and authenticated, the five owner predicates in their previous text, and the closure/erasure certificate binding.
-- Purpose: a proven way back if the restricted Need ACL ever has to be lifted (it is the only reversible half of the P6 rollout; the P6 functions
-- themselves are additive and are removed by dropping them). Apply ONLY together with the decision to lift the restriction: older whole-row
-- readers regain access and any reader that relies on the restriction (rpc_discovery_v1's visibility layer keeps working, it does not need it).
-- Optional pin: run `select set_config('pkg045.revert_expected_digest','<64 hex>',false);` first in the same session (the setting must outlive its own
-- statement, so it is session-level, not transaction-local) to require that the restored state reproduces exactly the certificate that was ready before PKG-045b.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $pre$
declare digest text;
begin
  if has_table_privilege('authenticated','public.needs','SELECT') or has_table_privilege('anon','public.needs','SELECT')
    then raise exception 'PKG045B_REVERT_NOT_APPLIED'; end if;
  digest:=private.closure_source_digest_v5();
  if digest is null or digest is distinct from (select sha256 from private.closure_source_v5 where singleton)
    or digest is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
    or not private.retention_ai_source_ready() then raise exception 'PKG045B_REVERT_CERTIFICATE_NOT_READY'; end if;
  if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'PKG045B_REVERT_CLOSURE_IN_FLIGHT'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.is_my_task(uuid)')) is distinct from '42b6802d2f3114d1e211025c4c475e55'
    then raise exception 'PKG045B_REVERT_HELPER_DRIFT'; end if;
end;
$pre$;
create temporary table pkg045_revert(new_digest text, ready_masked text) on commit drop;
insert into pkg045_revert select private.closure_source_digest_v5(),
  (select md5(regexp_replace(prosrc,'[0-9a-f]{64}','<CERTIFIED>','g')) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure);
do $policies$
declare actual text;
begin
  -- Every predicate must be in its PKG-045b form before it is put back; a drifted one is never overwritten blindly.
  for actual in
    select pg_get_expr(polqual,polrelid)||coalesce(pg_get_expr(polwithcheck,polrelid),'') from pg_policy
    where (polrelid,polname) in (('public.need_sensitive'::regclass,'need_sensitive_owner'),('public.marketplace_responses'::regclass,'responses_requester_read'),
      ('public.marketplace_response_versions'::regclass,'response_versions_read'),('public.need_geography'::regclass,'need_geography_owner_read'),
      ('public.need_requirement_details'::regclass,'need_requirement_details_owner_read'))
  loop
    if position('n.requester_account_id' in actual)>0 or position('is_my_task(n.id)' in actual)=0 then raise exception 'PKG045B_REVERT_POLICY_NOT_APPLIED'; end if;
  end loop;
  if (select count(*) from pg_policy where (polrelid,polname) in (('public.need_sensitive'::regclass,'need_sensitive_owner'),
      ('public.marketplace_responses'::regclass,'responses_requester_read'),('public.marketplace_response_versions'::regclass,'response_versions_read'),
      ('public.need_geography'::regclass,'need_geography_owner_read'),('public.need_requirement_details'::regclass,'need_requirement_details_owner_read'))) is distinct from 5
    then raise exception 'PKG045B_REVERT_POLICY_MISSING'; end if;
  execute 'alter policy need_sensitive_owner on public.need_sensitive using ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_sensitive.need_id) AND (n.requester_account_id = auth.uid())))))';
  execute 'alter policy need_sensitive_owner on public.need_sensitive with check ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_sensitive.need_id) AND (n.requester_account_id = auth.uid())))))';
  execute 'alter policy responses_requester_read on public.marketplace_responses using (((status <> ''DRAFT''::text) AND (EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = marketplace_responses.need_id) AND (n.requester_account_id = auth.uid()))))))';
  execute 'alter policy response_versions_read on public.marketplace_response_versions using ((EXISTS ( SELECT 1
   FROM marketplace_responses r
  WHERE ((r.id = marketplace_response_versions.response_id) AND ((r.worker_account_id = auth.uid()) OR ((r.status <> ''DRAFT''::text) AND (EXISTS ( SELECT 1
           FROM needs n
          WHERE ((n.id = r.need_id) AND (n.requester_account_id = auth.uid()))))))))))';
  execute 'alter policy need_geography_owner_read on public.need_geography using ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_geography.need_id) AND (n.requester_account_id = auth.uid())))))';
  execute 'alter policy need_requirement_details_owner_read on public.need_requirement_details using ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_requirement_details.need_id) AND (n.requester_account_id = auth.uid())))))';
  if (select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy
      where polrelid='public.need_sensitive'::regclass and polname='need_sensitive_owner') is distinct from '973eb03ede831c85e08335ba1350f556'
    or (select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy
      where polrelid='public.marketplace_responses'::regclass and polname='responses_requester_read') is distinct from 'bd713a683bef6c822d63dbf4a95b25f7'
    or (select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy
      where polrelid='public.marketplace_response_versions'::regclass and polname='response_versions_read') is distinct from '4ae9744f3dd3afde8c0a7f0812e21024'
    or (select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy
      where polrelid='public.need_geography'::regclass and polname='need_geography_owner_read') is distinct from '307ad5849a171a98ababcce2d07a74af'
    or (select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy
      where polrelid='public.need_requirement_details'::regclass and polname='need_requirement_details_owner_read') is distinct from 'fdc2e0cba21e37a36fcd878e005abd52'
    then raise exception 'PKG045B_REVERT_POLICY_TEXT_MISMATCH'; end if;
end;
$policies$;
-- Column grants were the allowlist; the table-level grant supersedes them and is what the certificate binds, so the column entries are removed too.
revoke select (id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, approximate_lat, approximate_lng, schedule_kind, starts_at, ends_at, required_slots, mode, requester_price_rsd, required_skills, required_tools, required_vehicles, verified_identity_required, urgent, public_photo_paths, revision, published_at, created_at, updated_at, response_deadline, urgent_activated_at, urgent_expires_at, urgent_policy_version, minimum_experience_years, execution_location_mode, approx_geog, required_licenses, remaining_search_closed_at, task_country_code, task_timezone, price_basis) on public.needs from authenticated;
grant select on public.needs to anon, authenticated;
do $rebind$
declare old_digest text; restored_digest text; definition text; ready text; pin text;
begin
  select new_digest into strict old_digest from pkg045_revert;
  restored_digest:=private.closure_source_digest_v5();
  if restored_digest is null or restored_digest=old_digest then raise exception 'PKG045B_REVERT_DIGEST_DID_NOT_MOVE'; end if;
  pin:=current_setting('pkg045.revert_expected_digest',true);
  if pin is not null and pin<>'' and pin is distinct from restored_digest then raise exception 'PKG045B_REVERT_DIGEST_PIN_MISMATCH'; end if;
  definition:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if (length(definition)-length(replace(definition,old_digest,'')))<>length(old_digest)
    or (select count(*) from regexp_matches(definition,'[0-9a-f]{64}','g'))<>1 then raise exception 'PKG045B_REVERT_READY_BINDING_INVALID'; end if;
  update private.closure_source_v5 set sha256=restored_digest where singleton and sha256=old_digest;
  if not found then raise exception 'PKG045B_REVERT_CERTIFICATES_DISAGREE'; end if;
  update private.closure_erasure_source_v5 set sha256=restored_digest where singleton and sha256=old_digest;
  if not found then raise exception 'PKG045B_REVERT_CERTIFICATES_DISAGREE'; end if;
  execute replace(definition,old_digest,restored_digest);
  select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
  if md5(regexp_replace(ready,'[0-9a-f]{64}','<CERTIFIED>','g')) is distinct from (select ready_masked from pkg045_revert)
    then raise exception 'PKG045B_REVERT_READY_BODY_CHANGED_BEYOND_CONSTANT'; end if;
  if private.closure_source_digest_v5() is distinct from restored_digest
    or (select sha256 from private.closure_source_v5 where singleton) is distinct from restored_digest
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from restored_digest
    or private.retention_ai_source_ready() is distinct from true
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from restored_digest then raise exception 'PKG045B_REVERT_REBIND_INCOMPLETE'; end if;
end;
$rebind$;
do $post$
begin
  if not has_table_privilege('authenticated','public.needs','SELECT') or not has_table_privilege('anon','public.needs','SELECT')
    then raise exception 'PKG045B_REVERT_GRANT_NOT_RESTORED'; end if;
end;
$post$;
notify pgrst, 'reload schema';
commit;
