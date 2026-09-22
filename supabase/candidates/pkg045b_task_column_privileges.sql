-- HOLD: fresh explicit owner approval of certificate movement and compatible APK rollout required.
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
-- The table ACL is part of the erasure-program digest. Separate owner approval required on DEV.
create temporary table pkg045_rebind(certified text, ready_masked text, table_acl text, moved text) on commit drop;
do $rebind_pre$
declare c text; definition text;
begin
  select sha256 into strict c from private.closure_source_v5 where singleton;
  if c is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton) then raise exception 'PKG045B_CERTIFICATES_DISAGREE'; end if;
  definition:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if (length(definition)-length(replace(definition,c,'')))<>length(c)
    or (select count(*) from regexp_matches(definition,'[0-9a-f]{64}','g'))<>1 then raise exception 'PKG045B_READY_BINDING_INVALID'; end if;
  if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'PKG045B_CLOSURE_IN_FLIGHT'; end if;
  if not has_table_privilege('anon','public.needs','SELECT') then raise exception 'PKG045B_TABLE_ACL_PREDECESSOR_DRIFT'; end if;
  insert into pkg045_rebind select c,
    (select md5(regexp_replace(prosrc,'[0-9a-f]{64}','<CERTIFIED>','g')) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure),
    (select relacl::text from pg_class where oid='public.needs'::regclass),null;
end;
$rebind_pre$;
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
do $isolate$
declare old_digest text; new_digest text;
begin
  select certified into strict old_digest from pkg045_rebind;
  new_digest:=private.closure_source_digest_v5();
  if new_digest is null or new_digest=old_digest then raise exception 'PKG045B_ACL_DID_NOT_MOVE_DIGEST'; end if;
  -- Transaction-local inverse: restoring ONLY the two table SELECT grants must reconstruct
  -- the exact certified digest. No committed window of broader access is created.
  grant select on public.needs to anon,authenticated;
  if (select relacl::text from pg_class where oid='public.needs'::regclass) is distinct from (select table_acl from pkg045_rebind)
    or private.closure_source_digest_v5() is distinct from old_digest then raise exception 'PKG045B_UNREVIEWED_CERTIFICATE_CHANGE'; end if;
  revoke select on public.needs from anon,authenticated;
  if private.closure_source_digest_v5() is distinct from new_digest then raise exception 'PKG045B_DIGEST_NOT_STABLE'; end if;
  update pkg045_rebind set moved=new_digest;
end;
$isolate$;
do $rebind$
declare old_digest text; new_digest text; definition text; ready text;
begin
  select certified,moved into strict old_digest,new_digest from pkg045_rebind;
  if new_digest is null or new_digest=old_digest or new_digest is distinct from private.closure_source_digest_v5() then raise exception 'PKG045B_DIGEST_NOT_STABLE'; end if;
  definition:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  update private.closure_source_v5 set sha256=new_digest where singleton and sha256=old_digest;
  if not found then raise exception 'PKG045B_CERTIFICATES_DISAGREE'; end if;
  update private.closure_erasure_source_v5 set sha256=new_digest where singleton and sha256=old_digest;
  if not found then raise exception 'PKG045B_CERTIFICATES_DISAGREE'; end if;
  execute replace(definition,old_digest,new_digest);
  select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
  if md5(regexp_replace(ready,'[0-9a-f]{64}','<CERTIFIED>','g')) is distinct from (select ready_masked from pkg045_rebind)
    then raise exception 'PKG045B_READY_BODY_CHANGED_BEYOND_CONSTANT'; end if;
  if private.closure_source_digest_v5() is distinct from new_digest
    or (select sha256 from private.closure_source_v5 where singleton) is distinct from new_digest
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from new_digest
    or private.retention_ai_source_ready() is distinct from true
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from new_digest then raise exception 'PKG045B_REBIND_INCOMPLETE'; end if;
end;
$rebind$;
notify pgrst, 'reload schema';
commit;
