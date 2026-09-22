-- PKG-045: public task column boundary. Forward-only candidate, source147 remains frozen.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
create temporary table pkg045_closure on commit drop as select private.closure_source_digest_v5() digest;
do $pre$
begin
  if (select digest from pkg045_closure) is null or
     (select digest from pkg045_closure) is distinct from (select sha256 from private.closure_source_v5 where singleton) or
     not private.retention_ai_source_ready() then raise exception 'PKG045_CERTIFICATE_NOT_READY'; end if;
end;
$pre$;
-- Apply ONLY after the compatible APK is installed. Older whole-row readers lose access.
do $pre$
begin
  if not has_table_privilege('authenticated','public.needs','SELECT') then raise exception 'PKG045B_ALREADY_RESTRICTED'; end if;
end;
$pre$;
do $bodies$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)')) is distinct from '18b5518140c519b96728d1e25fa3c29d' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)')) is distinct from 'dad1de3234e72d4e2f44be5e920eda61' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_resolve_activity_event(uuid)')) is distinct from 'e5dc05773da08471db572194caf467e2' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.is_my_task(uuid)')) is distinct from '42b6802d2f3114d1e211025c4c475e55' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_read_task(uuid)')) is distinct from '1e01db5140248f27ab374187f01fded3' then raise exception 'PKG045_BODY_MISMATCH'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_list_my_tasks()')) is distinct from '2a8ff0fa8a1211414e5e1fc69c6fb4f7' then raise exception 'PKG045_BODY_MISMATCH'; end if;
end;
$bodies$;
do $policies$
declare actual text; previous text; previous_check text; expected text;
begin
  select pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid) into previous,previous_check
    from pg_policy where polrelid='public.need_sensitive'::regclass and polname='need_sensitive_owner';
  if md5(coalesce(previous,'')||'|'||coalesce(previous_check,'')) is distinct from '973eb03ede831c85e08335ba1350f556'
    then raise exception 'PKG045B_POLICY_DRIFT:need_sensitive_owner'; end if;
  execute 'alter policy need_sensitive_owner on public.need_sensitive using ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_sensitive.need_id) AND public.is_my_task(n.id)))))';
  execute 'alter policy need_sensitive_owner on public.need_sensitive with check ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_sensitive.need_id) AND public.is_my_task(n.id)))))';
  select pg_get_expr(polqual,polrelid)||coalesce(pg_get_expr(polwithcheck,polrelid),'') into actual
    from pg_policy where polrelid='public.need_sensitive'::regclass and polname='need_sensitive_owner';
  if position('n.requester_account_id' in actual)>0 or position('is_my_task(n.id)' in actual)=0
    then raise exception 'PKG045B_POLICY_MISMATCH:need_sensitive_owner'; end if;
  select pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid) into previous,previous_check
    from pg_policy where polrelid='public.marketplace_responses'::regclass and polname='responses_requester_read';
  if md5(coalesce(previous,'')||'|'||coalesce(previous_check,'')) is distinct from 'bd713a683bef6c822d63dbf4a95b25f7'
    then raise exception 'PKG045B_POLICY_DRIFT:responses_requester_read'; end if;
  execute 'alter policy responses_requester_read on public.marketplace_responses using (((status <> ''DRAFT''::text) AND (EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = marketplace_responses.need_id) AND public.is_my_task(n.id))))))';
  select pg_get_expr(polqual,polrelid)||coalesce(pg_get_expr(polwithcheck,polrelid),'') into actual
    from pg_policy where polrelid='public.marketplace_responses'::regclass and polname='responses_requester_read';
  if position('n.requester_account_id' in actual)>0 or position('is_my_task(n.id)' in actual)=0
    then raise exception 'PKG045B_POLICY_MISMATCH:responses_requester_read'; end if;
  select pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid) into previous,previous_check
    from pg_policy where polrelid='public.marketplace_response_versions'::regclass and polname='response_versions_read';
  if md5(coalesce(previous,'')||'|'||coalesce(previous_check,'')) is distinct from '4ae9744f3dd3afde8c0a7f0812e21024'
    then raise exception 'PKG045B_POLICY_DRIFT:response_versions_read'; end if;
  execute 'alter policy response_versions_read on public.marketplace_response_versions using ((EXISTS ( SELECT 1
   FROM marketplace_responses r
  WHERE ((r.id = marketplace_response_versions.response_id) AND ((r.worker_account_id = auth.uid()) OR ((r.status <> ''DRAFT''::text) AND (EXISTS ( SELECT 1
           FROM needs n
          WHERE ((n.id = r.need_id) AND public.is_my_task(n.id))))))))))';
  select pg_get_expr(polqual,polrelid)||coalesce(pg_get_expr(polwithcheck,polrelid),'') into actual
    from pg_policy where polrelid='public.marketplace_response_versions'::regclass and polname='response_versions_read';
  if position('n.requester_account_id' in actual)>0 or position('is_my_task(n.id)' in actual)=0
    then raise exception 'PKG045B_POLICY_MISMATCH:response_versions_read'; end if;
  select pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid) into previous,previous_check
    from pg_policy where polrelid='public.need_geography'::regclass and polname='need_geography_owner_read';
  if md5(coalesce(previous,'')||'|'||coalesce(previous_check,'')) is distinct from '307ad5849a171a98ababcce2d07a74af'
    then raise exception 'PKG045B_POLICY_DRIFT:need_geography_owner_read'; end if;
  execute 'alter policy need_geography_owner_read on public.need_geography using ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_geography.need_id) AND public.is_my_task(n.id)))))';
  select pg_get_expr(polqual,polrelid)||coalesce(pg_get_expr(polwithcheck,polrelid),'') into actual
    from pg_policy where polrelid='public.need_geography'::regclass and polname='need_geography_owner_read';
  if position('n.requester_account_id' in actual)>0 or position('is_my_task(n.id)' in actual)=0
    then raise exception 'PKG045B_POLICY_MISMATCH:need_geography_owner_read'; end if;
  select pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid) into previous,previous_check
    from pg_policy where polrelid='public.need_requirement_details'::regclass and polname='need_requirement_details_owner_read';
  if md5(coalesce(previous,'')||'|'||coalesce(previous_check,'')) is distinct from 'fdc2e0cba21e37a36fcd878e005abd52'
    then raise exception 'PKG045B_POLICY_DRIFT:need_requirement_details_owner_read'; end if;
  execute 'alter policy need_requirement_details_owner_read on public.need_requirement_details using ((EXISTS ( SELECT 1
   FROM needs n
  WHERE ((n.id = need_requirement_details.need_id) AND public.is_my_task(n.id)))))';
  select pg_get_expr(polqual,polrelid)||coalesce(pg_get_expr(polwithcheck,polrelid),'') into actual
    from pg_policy where polrelid='public.need_requirement_details'::regclass and polname='need_requirement_details_owner_read';
  if position('n.requester_account_id' in actual)>0 or position('is_my_task(n.id)' in actual)=0
    then raise exception 'PKG045B_POLICY_MISMATCH:need_requirement_details_owner_read'; end if;
end;
$policies$;
revoke select on public.needs from public, anon, authenticated;
revoke select (id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, approximate_lat, approximate_lng, schedule_kind, starts_at, ends_at, required_slots, mode, requester_price_rsd, required_skills, required_tools, required_vehicles, verified_identity_required, urgent, public_photo_paths, revision, published_at, created_at, updated_at, response_deadline, urgent_activated_at, urgent_expires_at, urgent_policy_version, minimum_experience_years, execution_location_mode, approx_geog, required_licenses, remaining_search_closed_at, task_country_code, task_timezone, price_basis, requester_account_id, remaining_search_closed_by_account_id, remaining_search_close_reason) on public.needs from public, anon, authenticated;
grant select (id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, approximate_lat, approximate_lng, schedule_kind, starts_at, ends_at, required_slots, mode, requester_price_rsd, required_skills, required_tools, required_vehicles, verified_identity_required, urgent, public_photo_paths, revision, published_at, created_at, updated_at, response_deadline, urgent_activated_at, urgent_expires_at, urgent_policy_version, minimum_experience_years, execution_location_mode, approx_geog, required_licenses, remaining_search_closed_at, task_country_code, task_timezone, price_basis) on public.needs to authenticated;
do $grants$
begin
  if has_table_privilege('authenticated','public.needs','SELECT') or has_table_privilege('anon','public.needs','SELECT') or
     exists(select 1 from unnest(array['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason']) c
       where has_column_privilege('authenticated','public.needs',c,'SELECT') or has_column_privilege('anon','public.needs',c,'SELECT'))
  then raise exception 'PKG045B_PRIVATE_COLUMNS_READABLE'; end if;
end;
$grants$;
do $post$
begin
  if private.closure_source_digest_v5() is distinct from (select digest from pkg045_closure)
    or not private.retention_ai_source_ready() then raise exception 'PKG045_CERTIFICATE_CHANGED'; end if;
end;
$post$;
notify pgrst, 'reload schema';
commit;
