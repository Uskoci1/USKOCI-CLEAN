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
