-- PKG-023c: the ~100 m public task location (V3 third slice, D; owner's addition 4 of 2026-09-19).
--
-- NOT APPLIED ANYWHERE, AND ON HOLD FOR CANONICAL DEV. Proven only on a disposable database.
-- Requires pkg023d (it replaces the marketplace reader so that it prefers the new point).
--
-- WHY IT IS ON HOLD FOR DEV. This candidate adds two columns and a constraint to public.needs and
-- changes two trigger functions and the erasure patch. private.closure_schema_digest_v5_139() hashes
-- every column, constraint and trigger function of every table, and the erasure program digest hashes
-- closure_redaction_patch_v5. A change like this therefore has to RE-BIND the closure source digest, as
-- source migration 145 does, and a re-bind is only honest from a predecessor that is READY. On the
-- disposable database (source 147) the predecessor is ready and this candidate re-binds it. On canonical
-- DEV it is NOT: closure_source_digest_v5() has differed from the pinned value, and
-- retention_ai_source_ready() has been false, since the dev_alpha migrations of 2026-09-17 changed tables
-- without re-binding. This candidate refuses to run there (PKG023C_CLOSURE_SOURCE_NOT_READY) rather than
-- certify, in passing, schema changes it did not make. That drift needs its own review and decision.
--
-- WHAT IT DOES.
--   Two nullable columns, public.needs.public_lat numeric(7,3) and public_lng numeric(8,3). No default,
--   no table rewrite, NO BACKFILL: every existing row keeps public_* = null.
--   approximate_lat/lng numeric(6,2)/(7,2), the generated approx_geog and its indexes are untouched, so
--   the coarse point an installed APK reads stays exactly what it is, for old and new tasks alike.
--   private.materialize_resolved_location is the only writer of either projection, and writes both from
--   the same confirmed record in need_sensitive.resolved_location: round(anchor, 2) and round(anchor, 3).
--   The exact point stays in need_sensitive and is given to no client for drawing.
--   public_* follows the life of approximate_*: cleared where that is cleared, kept where that is kept,
--   immutable after publication, erased with the account, null for a REMOTE task, never accepted from a
--   client, and bound to the confirmed record by the same constraint trigger.
--   The publication fingerprint and the material snapshot include publicLat/publicLng ONLY where they
--   exist, so the fingerprint of every task published before this is unchanged to the byte, and the
--   fingerprint of a task that has the new point binds it.
--   Matching and the worker's own location are not touched: candidate_profile_ids,
--   match_detail_without_calendar, worker_match_preferences numeric(6,2) and rpc_save_worker_location
--   stay on the ~1 km grid.
--
-- Every replaced body below is the live definition of 2026-09-19 with exact substitutions and nothing
-- retyped. The md5 of each predecessor body is checked before, and of each new body after.
--
-- PREVIOUS BODIES, md5(prosrc), for the successor that would restore them:
--   cee9fed5ae6fecad3de73e1537bbac99  private.materialize_resolved_location(uuid,uuid)
--   002e289036ba9e6bce3592c83fb22824  private.check_need_resolved_location_binding()
--   314b93f7f89d3d52dbcf17a2a2552502  private.guard_need_write()
--   dfa1a8096380772a9ac60283bebfaf3d  public.rpc_confirm_need_edit(uuid,integer,text,jsonb)
--   2126c67488394a63a5cbbee0b7facffb  public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)
--   727fe2de07adc99d1140db9c1996a46f  private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)
--   7838967d0edc8a1ca1a497752efc189d  private.need_material_snapshot(uuid)
--   c6dab63a70732d0cb1fcc657baaa2490  private.need_publication_fingerprint_snapshot(uuid)
--   be11fb7f7d1b37e9f970545aeac20b98  private.need_publication_location_readiness(uuid)
--   069edd186cc4033fcb0ab19fa4ac78fb  public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)   (pkg023d)
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create temporary table pkg023c_predecessor(sha text, ready_definition text) on commit drop;

do $pre$
declare s text;
begin
  select sha256 into strict s from private.closure_source_v5 where singleton;
  if s is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then
    raise exception 'PKG023C_CLOSURE_SOURCE_NOT_READY';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'needs' and column_name in ('public_lat','public_lng')) then
    raise exception 'PKG023C_ALREADY_APPLIED';
  end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.materialize_resolved_location(uuid,uuid)'::regprocedure)
     is distinct from 'cee9fed5ae6fecad3de73e1537bbac99' then raise exception 'PKG023C_PREDECESSOR_DRIFT private.materialize_resolved_location'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.check_need_resolved_location_binding()'::regprocedure)
     is distinct from '002e289036ba9e6bce3592c83fb22824' then raise exception 'PKG023C_PREDECESSOR_DRIFT private.check_need_resolved_location_binding'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.guard_need_write()'::regprocedure)
     is distinct from '314b93f7f89d3d52dbcf17a2a2552502' then raise exception 'PKG023C_PREDECESSOR_DRIFT private.guard_need_write'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.rpc_confirm_need_edit(uuid,integer,text,jsonb)'::regprocedure)
     is distinct from 'dfa1a8096380772a9ac60283bebfaf3d' then raise exception 'PKG023C_PREDECESSOR_DRIFT public.rpc_confirm_need_edit'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure)
     is distinct from '2126c67488394a63a5cbbee0b7facffb' then raise exception 'PKG023C_PREDECESSOR_DRIFT public.rpc_confirm_need_edit_from_review'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure)
     is distinct from '727fe2de07adc99d1140db9c1996a46f' then raise exception 'PKG023C_PREDECESSOR_DRIFT private.closure_redaction_patch_v5'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.need_material_snapshot(uuid)'::regprocedure)
     is distinct from '7838967d0edc8a1ca1a497752efc189d' then raise exception 'PKG023C_PREDECESSOR_DRIFT private.need_material_snapshot'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.need_publication_fingerprint_snapshot(uuid)'::regprocedure)
     is distinct from 'c6dab63a70732d0cb1fcc657baaa2490' then raise exception 'PKG023C_PREDECESSOR_DRIFT private.need_publication_fingerprint_snapshot'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.need_publication_location_readiness(uuid)'::regprocedure)
     is distinct from 'be11fb7f7d1b37e9f970545aeac20b98' then raise exception 'PKG023C_PREDECESSOR_DRIFT private.need_publication_location_readiness'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
       where oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure)
     is distinct from '069edd186cc4033fcb0ab19fa4ac78fb' then raise exception 'PKG023C_REQUIRES_PKG023D_AS_WRITTEN'; end if;
  insert into pkg023c_predecessor values (s, pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure));
end
$pre$;

alter table public.needs
  add column public_lat numeric(7,3),
  add column public_lng numeric(8,3),
  add constraint needs_public_pin_pair_check check (
    (public_lat is null) = (public_lng is null)
    and (public_lat is null or (public_lat between -90 and 90 and public_lng between -180 and 180)));

comment on column public.needs.public_lat is 'V3 public projection, about 100 m: round(confirmed anchor, 3). Written only by private.materialize_resolved_location. Null for a task published before it existed.';
comment on column public.needs.public_lng is 'V3 public projection, about 100 m: round(confirmed anchor, 3). Written only by private.materialize_resolved_location. Null for a task published before it existed.';

CREATE OR REPLACE FUNCTION private.materialize_resolved_location(nid uuid, cid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare n public.needs; s public.need_sensitive; f public.ai_structured_facts; geo jsonb; val jsonb; rec jsonb;
  exact_point jsonb; anchor jsonb; had_resolved boolean;
begin
  select * into n from public.needs where id=nid and requester_account_id=auth.uid() for update;
  if not found or n.status<>'DRAFT' or exists(select 1 from public.agreements where need_id=nid)
    or exists(select 1 from public.need_selections where need_id=nid) then raise exception 'LOCATION_REVIEW_NOT_EDITABLE' using errcode='42501'; end if;
  perform 1 from public.ai_conversations where id=cid and account_id=auth.uid() and status='OPEN' for update;
  if not found then raise exception 'LOCATION_REVIEW_NOT_FOUND' using errcode='42501'; end if;
  select * into s from public.need_sensitive where need_id=nid;
  had_resolved:=s.resolved_location is not null;
  select public_topology into geo from public.need_geography where need_id=nid;
  select * into f from public.ai_structured_facts where conversation_id=cid and fact_key='need.resolved_location' and superseded_at is null;
  if found then
    if f.status<>'CONFIRMED' or f.source<>'EXPLICIT_USER_ANSWER' or f.confirmed_by_user_id is distinct from auth.uid() or f.confirmed_at is null then
      raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
    val:=private.normalize_resolved_location(f.fact_value,n.task_country_code,geo,nullif(btrim(s.exact_address),''));
    rec:=jsonb_build_object('value',val,'confirmedByAccountId',f.confirmed_by_user_id,'confirmedAt',f.confirmed_at);
    if private.resolved_location_record_valid(rec,n.task_country_code,geo,s.exact_address,n.requester_account_id) is distinct from true then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    select p into exact_point from jsonb_array_elements(val->'points') p where p->>'slot'='start';
    select p into anchor from jsonb_array_elements(val->'points') p
      where p->>'slot'=case when geo->>'mode'='AREA_BASED' and geo ? 'serviceArea' then 'serviceArea' else 'start' end;
  end if;
  if rec is not null or had_resolved or (geo->>'mode'='REMOTE' and s.need_id is not null) then
    insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng,resolved_location)
    values(nid,coalesce(s.exact_address,''),coalesce(s.access_notes,''),
      (exact_point->>'latitudeE6')::numeric/1000000,(exact_point->>'longitudeE6')::numeric/1000000,rec)
    on conflict(need_id) do update set resolved_location=excluded.resolved_location,exact_lat=excluded.exact_lat,exact_lng=excluded.exact_lng,updated_at=statement_timestamp();
    -- Both public projections are written here and nowhere else, from the same confirmed record: the
    -- coarse point an installed APK reads, and the ~100 m point of V3.
    update public.needs set approximate_lat=round((anchor->>'latitudeE6')::numeric/1000000,2),
      approximate_lng=round((anchor->>'longitudeE6')::numeric/1000000,2),
      public_lat=round((anchor->>'latitudeE6')::numeric/1000000,3),
      public_lng=round((anchor->>'longitudeE6')::numeric/1000000,3) where id=nid;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.check_need_resolved_location_binding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare nid uuid; n public.needs; s public.need_sensitive; geo jsonb; point jsonb; anchor jsonb;
begin
 if auth.role()='service_role' then
  if TG_OP in ('UPDATE','DELETE') and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),case when TG_OP='UPDATE' then to_jsonb(NEW) else null end) then
   if TG_OP='DELETE' then return OLD;end if;return NEW;
  end if;
 end if;

  if tg_table_name='needs' then nid:=new.id; else nid:=new.need_id; end if;
  select * into n from public.needs where id=nid;
  if not found then return null; end if;
  select * into s from public.need_sensitive where need_id=nid;
  if not found or s.resolved_location is null then
    -- The ~100 m point exists only as the projection of a confirmed record. A client can write the
    -- columns of its own DRAFT through the table grant; without a record there is nothing for the
    -- point to be the projection of, and it is refused.
    if n.public_lat is not null or n.public_lng is not null then
      raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
    return null; end if;
  select public_topology into geo from public.need_geography where need_id=nid;
  if private.resolved_location_record_valid(s.resolved_location,n.task_country_code,geo,s.exact_address,n.requester_account_id) is distinct from true then
    raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  select p into point from jsonb_array_elements(s.resolved_location#>'{value,points}') p where p->>'slot'='start';
  if s.exact_lat is distinct from (point->>'latitudeE6')::numeric/1000000 or s.exact_lng is distinct from (point->>'longitudeE6')::numeric/1000000 then
    raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  select p into anchor from jsonb_array_elements(s.resolved_location#>'{value,points}') p
    where p->>'slot'=case when geo->>'mode'='AREA_BASED' and geo ? 'serviceArea' then 'serviceArea' else 'start' end;
  if n.approximate_lat is distinct from round((anchor->>'latitudeE6')::numeric/1000000,2)
    or n.approximate_lng is distinct from round((anchor->>'longitudeE6')::numeric/1000000,2) then
    raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  -- A task published before the ~100 m projection existed has none, and is never given one behind its
  -- owner's back. One that has it must have exactly the projection of the confirmed record.
  if (n.public_lat is not null or n.public_lng is not null)
    and (n.public_lat is distinct from round((anchor->>'latitudeE6')::numeric/1000000,3)
      or n.public_lng is distinct from round((anchor->>'longitudeE6')::numeric/1000000,3)) then
    raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_need_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  token text := current_setting('uskoci.need_lifecycle', true);
  material boolean;
begin
 if auth.role()='service_role' then
  if TG_OP in ('UPDATE','DELETE') and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),case when TG_OP='UPDATE' then to_jsonb(NEW) else null end) then
   if TG_OP='DELETE' then return OLD;end if;return NEW;
  end if;
 end if;

  if (tg_op='INSERT' and (new.task_country_code is not null or new.task_timezone is not null))
    or (tg_op='UPDATE' and (new.task_country_code is distinct from old.task_country_code or new.task_timezone is distinct from old.task_timezone)) then
    if current_setting('uskoci.need_region',true) is distinct from 'CONFIRMED_REVIEW' then
      raise exception 'NEED_COUNTRY_REQUIRES_CONFIRMED_REVIEW' using errcode='42501';
    end if;
    perform private.require_location_country(to_jsonb(new.task_country_code));
    if new.task_timezone is distinct from (select default_timezone from private.location_market_configs where country_code=new.task_country_code) then
      raise exception 'NEED_COUNTRY_TIMEZONE_MISMATCH' using errcode='22023';
    end if;
  end if;
  if not exists (
    select 1 from public.app_profiles p
     where p.id = new.requester_profile_id
       and p.account_id = new.requester_account_id
       and p.kind = 'REQUESTER'
  ) then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT'
       and not (new.status = 'PUBLISHED' and token = 'PUBLISH') then
      raise exception using errcode='22023', message='NEED_MUST_START_AS_DRAFT';
    end if;
    if token is null then
      new.urgent := false;
      new.urgent_activated_at := null;
      new.urgent_expires_at := null;
      new.urgent_policy_version := null;
      new.published_at := null;
      new.response_deadline := null;
    end if;
    return new;
  end if;

  if old.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
     and (
       (to_jsonb(new) - array['urgent','updated_at'])
         is distinct from
       (to_jsonb(old) - array['urgent','updated_at'])
       or (not coalesce(old.urgent, false) and coalesce(new.urgent, false))
     ) then
    raise exception using errcode='22023', message='NEED_TERMINAL_IMMUTABLE';
  end if;

  if new.requester_account_id <> old.requester_account_id then
    raise exception using errcode='42501', message='NEED_OWNER_IMMUTABLE';
  end if;

  material :=
       new.task_country_code is distinct from old.task_country_code
    or new.task_timezone is distinct from old.task_timezone
    or
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.required_slots is distinct from old.required_slots
    or new.mode is distinct from old.mode
    or new.requester_price_rsd is distinct from old.requester_price_rsd
    or new.required_skills is distinct from old.required_skills
    or new.required_tools is distinct from old.required_tools
    or new.required_vehicles is distinct from old.required_vehicles
    or new.required_licenses is distinct from old.required_licenses
    or new.minimum_experience_years is distinct from old.minimum_experience_years
    or new.verified_identity_required is distinct from old.verified_identity_required
    or new.schedule_kind is distinct from old.schedule_kind
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.execution_location_mode is distinct from old.execution_location_mode
    or new.approximate_lat is distinct from old.approximate_lat
    or new.approximate_lng is distinct from old.approximate_lng
    or new.public_lat is distinct from old.public_lat
    or new.public_lng is distinct from old.public_lng
    or new.approximate_city is distinct from old.approximate_city
    or new.approximate_area is distinct from old.approximate_area
    or new.public_photo_paths is distinct from old.public_photo_paths
    or new.response_deadline is distinct from old.response_deadline;

  if token = 'CONFIRM_EDIT' then
    if old.status not in ('DRAFT','PUBLISHED','SELECTION') or new.status <> 'DRAFT' then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_STATUS_INVALID';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_REVISION_INVALID';
    end if;
    if exists (select 1 from public.agreements a where a.need_id = old.id)
       or exists (select 1 from public.need_selections s where s.need_id = old.id)
       or exists (select 1 from public.marketplace_responses r where r.need_id = old.id and r.status = 'SELECTED') then
      raise exception using errcode='P0001', message='NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR';
    end if;
    if new.published_at is not null or new.response_deadline is not null then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_PUBLICATION_METADATA_NOT_CLEARED';
    end if;
    if coalesce(new.urgent, false)
       or new.urgent_activated_at is not null
       or new.urgent_expires_at is not null
       or new.urgent_policy_version is not null then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_URGENT_METADATA_NOT_CLEARED';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
         (token = 'PUBLISH' and old.status = 'DRAFT' and new.status = 'PUBLISHED')
      or (token = 'SELECT' and old.status in ('PUBLISHED','SELECTION') and new.status in ('SELECTION','ACTIVE'))
      or (token = 'CANCEL_NEED' and old.status in ('DRAFT','PUBLISHED','SELECTION') and new.status = 'CANCELLED')
      or (token = 'CANCEL_AGREEMENT' and old.status in ('ACTIVE','SELECTION') and new.status = 'SELECTION')
      or (token = 'EXPIRE' and old.status in ('PUBLISHED','SELECTION') and new.status = 'EXPIRED')
      or (token = 'COMPLETE' and old.status in ('ACTIVE','SELECTION') and new.status = 'COMPLETED')
    ) then
      raise exception using errcode='22023', message='NEED_STATUS_TRANSITION_REQUIRES_RPC';
    end if;
  end if;

  if token is null then
    if new.revision is distinct from old.revision then
      raise exception using errcode='42501', message='NEED_REVISION_IS_SERVER_OWNED';
    end if;
    if new.urgent is distinct from old.urgent then raise exception using errcode='42501', message='URGENT_IS_SERVER_OWNED'; end if;
    if new.urgent_activated_at is distinct from old.urgent_activated_at then raise exception using errcode='42501', message='URGENT_ACTIVATED_AT_IS_SERVER_OWNED'; end if;
    if new.urgent_expires_at is distinct from old.urgent_expires_at then raise exception using errcode='42501', message='URGENT_EXPIRES_AT_IS_SERVER_OWNED'; end if;
    if new.urgent_policy_version is distinct from old.urgent_policy_version then raise exception using errcode='42501', message='URGENT_POLICY_VERSION_IS_SERVER_OWNED'; end if;
    if new.published_at is distinct from old.published_at then raise exception using errcode='42501', message='PUBLISHED_AT_IS_SERVER_OWNED'; end if;
    if new.response_deadline is distinct from old.response_deadline then raise exception using errcode='42501', message='RESPONSE_DEADLINE_IS_SERVER_OWNED'; end if;
  end if;

  if material then
    if old.status in ('PUBLISHED','SELECTION') then
      raise exception using errcode='22023', message='PUBLIC_NEED_EDIT_REQUIRES_CONFIRM_COMMAND';
    elsif old.status <> 'DRAFT' then
      raise exception using errcode='P0001', message='NEED_NOT_EDITABLE';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_confirm_need_edit(p_need_id uuid, p_expected_revision integer, p_client_request_id text, p_material jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_request_hash text;
  v_existing private.need_edit_commands%rowtype;
  v_need public.needs%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_result jsonb;
  v_private jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'NEED_ID_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;
  if p_material is null or jsonb_typeof(p_material) <> 'object' then
    raise exception 'MATERIAL_OBJECT_REQUIRED' using errcode='22023';
  end if;

  if (p_material - array[
    'title','description','category','requiredSlots','mode','requesterPriceRsd',
    'requiredSkills','requiredTools','requiredVehicles','requiredLicenses',
    'minimumExperienceYears','verifiedIdentityRequired','scheduleKind','startsAt','endsAt',
    'executionLocationMode','approximateLat','approximateLng','approximateCity','approximateArea',
    'publicPhotoPaths','privateLocation'
  ]) <> '{}'::jsonb then
    raise exception 'UNSUPPORTED_MATERIAL_FIELD' using errcode='22023';
  end if;

  if not (p_material ?& array[
    'title','description','category','requiredSlots','mode','requesterPriceRsd',
    'requiredSkills','requiredTools','requiredVehicles','requiredLicenses',
    'minimumExperienceYears','verifiedIdentityRequired','scheduleKind','startsAt','endsAt',
    'executionLocationMode','approximateLat','approximateLng','approximateCity','approximateArea',
    'publicPhotoPaths','privateLocation'
  ]) then
    raise exception 'FULL_MATERIAL_SNAPSHOT_REQUIRED' using errcode='22023';
  end if;

  if jsonb_typeof(p_material->'requiredSkills') <> 'array'
     or jsonb_typeof(p_material->'requiredTools') <> 'array'
     or jsonb_typeof(p_material->'requiredVehicles') <> 'array'
     or jsonb_typeof(p_material->'requiredLicenses') <> 'array'
     or jsonb_typeof(p_material->'publicPhotoPaths') <> 'array' then
    raise exception 'MATERIAL_ARRAY_FIELD_INVALID' using errcode='22023';
  end if;

  if jsonb_typeof(p_material->'privateLocation') not in ('object','null') then
    raise exception 'PRIVATE_LOCATION_INVALID' using errcode='22023';
  end if;

  if p_material->'privateLocation' ? 'resolvedLocation' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'needId', p_need_id,
        'expectedRevision', p_expected_revision,
        'material', p_material
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4404));

  select * into v_existing
    from private.need_edit_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_need from public.needs n where n.id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id <> v_actor then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision <> p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists (select 1 from public.agreements a where a.need_id = v_need.id)
     or exists (select 1 from public.need_selections s where s.need_id = v_need.id)
     or exists (select 1 from public.marketplace_responses r where r.need_id = v_need.id and r.status = 'SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  v_before := private.need_material_snapshot(v_need.id);
  if v_before is null then raise exception 'NEED_SNAPSHOT_FAILED' using errcode='P0001'; end if;

  v_private := p_material->'privateLocation';

  perform set_config('uskoci.need_lifecycle', 'CONFIRM_EDIT', true);
  update public.needs n
     set title = btrim(p_material->>'title'),
         description = btrim(p_material->>'description'),
         category = btrim(p_material->>'category'),
         required_slots = (p_material->>'requiredSlots')::integer,
         mode = p_material->>'mode',
         requester_price_rsd = (p_material->>'requesterPriceRsd')::integer,
         required_skills = private.jsonb_text_array(p_material->'requiredSkills'),
         required_tools = private.jsonb_text_array(p_material->'requiredTools'),
         required_vehicles = private.jsonb_text_array(p_material->'requiredVehicles'),
         required_licenses = private.jsonb_text_array(p_material->'requiredLicenses'),
         minimum_experience_years = (p_material->>'minimumExperienceYears')::integer,
         verified_identity_required = (p_material->>'verifiedIdentityRequired')::boolean,
         schedule_kind = p_material->>'scheduleKind',
         starts_at = (p_material->>'startsAt')::timestamptz,
         ends_at = (p_material->>'endsAt')::timestamptz,
         execution_location_mode = p_material->>'executionLocationMode',
         approximate_lat = (p_material->>'approximateLat')::numeric,
         approximate_lng = (p_material->>'approximateLng')::numeric,
         -- The ~100 m point is never taken from a client. This legacy scalar edit cannot attest a pin.
         public_lat = null,
         public_lng = null,
         approximate_city = coalesce(p_material->>'approximateCity',''),
         approximate_area = coalesce(p_material->>'approximateArea',''),
         public_photo_paths = private.jsonb_text_array(p_material->'publicPhotoPaths'),
         status = 'DRAFT',
         revision = v_need.revision + 1,
         published_at = null,
         response_deadline = null,
         urgent = false,
         urgent_activated_at = null,
         urgent_expires_at = null,
         urgent_policy_version = null,
         updated_at = statement_timestamp()
   where n.id = v_need.id
     and n.revision = v_need.revision
     and n.status in ('PUBLISHED','SELECTION')
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then raise exception 'NEED_EDIT_CONFLICT' using errcode='40001'; end if;

  insert into public.need_sensitive(need_id, exact_address, access_notes, exact_lat, exact_lng, updated_at)
  values (
    v_need.id,
    case when jsonb_typeof(v_private)='object' then coalesce(v_private->>'exactAddress','') else '' end,
    case when jsonb_typeof(v_private)='object' then coalesce(v_private->>'accessNotes','') else '' end,
    case when jsonb_typeof(v_private)='object' then (v_private->>'exactLat')::numeric else null end,
    case when jsonb_typeof(v_private)='object' then (v_private->>'exactLng')::numeric else null end,
    statement_timestamp()
  )
  on conflict (need_id) do update
    set exact_address = excluded.exact_address,
        access_notes = excluded.access_notes,
        exact_lat = excluded.exact_lat,
        exact_lng = excluded.exact_lng,
        updated_at = excluded.updated_at;

  -- Legacy scalar edit remains available, but cannot attest or retain route pins.
  if exists(select 1 from public.need_sensitive where need_id=v_need.id and resolved_location is not null) then
    update public.needs set approximate_lat=null,approximate_lng=null where id=v_need.id;
  end if;
  update public.need_sensitive set resolved_location=null,exact_lat=null,exact_lng=null where need_id=v_need.id and resolved_location is not null;
  delete from private.dispatch_schedule where need_id = v_need.id;

  v_after := private.need_material_snapshot(v_need.id);
  if v_after is not distinct from v_before then
    raise exception 'NO_MATERIAL_CHANGE' using errcode='22023';
  end if;

  insert into private.need_revision_events(
    need_id, from_revision, to_revision, from_status,
    previous_material_snapshot, new_material_snapshot, created_by_account_id
  ) values (
    v_need.id, p_expected_revision, v_need.revision,
    case when v_need.status='DRAFT' then 'PUBLISHED_OR_SELECTION' else v_need.status end,
    v_before, v_after, v_actor
  ) returning id into v_event_id;

  perform private.audit_marketplace(
    v_actor,
    'NEED_EDIT_CONFIRMED',
    'NEED',
    v_need.id,
    v_need.revision,
    jsonb_build_object('fromRevision', p_expected_revision, 'toRevision', v_need.revision, 'revisionEventId', v_event_id)
  );

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'fromRevision', p_expected_revision,
    'revision', v_need.revision,
    'status', v_need.status,
    'revisionEventId', v_event_id,
    'requiresReadmission', true,
    'idempotentReplay', false,
    'authoritative', true
  );

  insert into private.need_edit_commands(
    requester_account_id, client_request_id, request_hash,
    need_id, from_revision, to_revision, revision_event_id, result
  ) values (
    v_actor, v_request_id, v_request_hash,
    v_need.id, p_expected_revision, v_need.revision, v_event_id, v_result
  );

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_confirm_need_edit_from_review(p_need_id uuid, p_expected_revision integer, p_conversation_id uuid, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_request_id text:=btrim(coalesce(p_client_request_id,''));
  v_request_hash text;
  v_existing private.need_edit_commands%rowtype;
  v_conv public.ai_conversations%rowtype;
  v_need public.needs%rowtype;
  v_old_sensitive public.need_sensitive%rowtype;
  v_facts jsonb;
  v_missing text[];
  v_key text;
  v_value jsonb;
  v_title text;
  v_description text;
  v_category text;
  v_mode text;
  v_price integer;
  v_schedule_kind text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_slots integer;
  v_skills text[];
  v_tools text[];
  v_vehicles text[];
  v_licenses text[];
  v_min_exp integer;
  v_verified boolean;
  v_photos text[];
  v_conditions text[];
  v_geo jsonb;
  v_old_geo jsonb;
  v_exec_mode text;
  v_start jsonb;
  v_service jsonb;
  v_city text;
  v_area text;
  v_exact_address text;
  v_access_notes text;
  v_country text; v_timezone text; v_region_token text;
  v_exact_lat numeric;
  v_exact_lng numeric;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_result jsonb;
  v_from_status text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_conversation_id is null or p_expected_revision is null or p_expected_revision<1 then
    raise exception 'EDIT_REVIEW_IDENTITY_REQUIRED' using errcode='22004';
  end if;
  if char_length(v_request_id) not between 8 and 200 then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023'; end if;

  select * into v_conv from public.ai_conversations where id=p_conversation_id for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' or v_conv.fact_schema_version<>'NEED_FACT_V2' or v_conv.status<>'OPEN' then
    raise exception 'EDIT_CONVERSATION_NOT_CONFIRMABLE' using errcode='P0001';
  end if;
  if v_conv.bound_need_id is distinct from p_need_id then raise exception 'EDIT_CONVERSATION_NEED_MISMATCH' using errcode='42501'; end if;

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision<>p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001'; end if;
  if v_need.status not in ('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;
  v_from_status:=v_need.status;
  perform 1 from public.need_geography where need_id=v_need.id for share;
  perform 1 from public.need_sensitive where need_id=v_need.id for share;
  perform 1 from public.need_requirement_details where need_id=v_need.id for share;
  if (v_need.status='DRAFT' and v_conv.need_edit_base_fingerprint is null) or (v_conv.need_edit_base_fingerprint is not null and v_conv.need_edit_base_fingerprint is distinct from private.need_edit_base_marker(v_need.id)) then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001';
  end if;
  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  if exists(
    select 1 from public.ai_structured_facts f
     where f.conversation_id=p_conversation_id
       and f.superseded_at is null
       and f.status<>'CONFIRMED'
  ) then
    raise exception 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' using errcode='P0001';
  end if;

  for v_key,v_value in
    select fact_key,fact_value from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version='NEED_FACT_V2'
       and status='CONFIRMED'
  loop
    perform private.validate_need_v2_fact(v_key,v_value);
  end loop;

  select coalesce(jsonb_object_agg(fact_key,fact_value),'{}'::jsonb)
    into v_facts
    from public.ai_structured_facts
   where conversation_id=p_conversation_id
     and superseded_at is null
     and fact_schema_version='NEED_FACT_V2'
     and status='CONFIRMED';

  select array_agg(r.fact_key order by r.fact_key)
    into v_missing
    from private.need_fact_registry r
   where r.required_for_draft and not (v_facts ? r.fact_key);
  if cardinality(coalesce(v_missing,'{}'::text[]))>0 then
    raise exception 'REQUIRED_CONFIRMED_FACTS_MISSING' using errcode='P0001',detail=array_to_string(v_missing,',');
  end if;

  v_title:=v_facts->>'need.title';
  v_description:=v_facts->>'need.description';
  v_category:=v_facts->>'need.category';
  v_mode:=v_facts->>'need.price_mode';
  if v_facts ? 'need.price_rsd' then v_price:=(v_facts->>'need.price_rsd')::integer; end if;
  if v_mode='MY_PRICE' and v_price is null then raise exception 'MY_PRICE_AMOUNT_REQUIRED' using errcode='P0001'; end if;
  if v_mode<>'MY_PRICE' then v_price:=null; end if;

  v_schedule_kind:=v_facts->>'need.schedule_kind';
  if v_facts ? 'need.starts_at' then v_starts_at:=(v_facts->>'need.starts_at')::timestamptz; end if;
  if v_facts ? 'need.ends_at' then v_ends_at:=(v_facts->>'need.ends_at')::timestamptz; end if;
  if v_schedule_kind='FIXED_WINDOW' and (v_starts_at is null or v_ends_at is null or v_ends_at<=v_starts_at) then
    raise exception 'FIXED_WINDOW_BOUNDS_REQUIRED' using errcode='P0001';
  end if;

  v_slots:=(v_facts->>'need.people_needed')::integer;
  select coalesce(array_agg(value),'{}'::text[]) into v_skills from jsonb_array_elements_text(coalesce(v_facts->'need.required_skills','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_tools from jsonb_array_elements_text(coalesce(v_facts->'need.required_tools','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_vehicles from jsonb_array_elements_text(coalesce(v_facts->'need.required_vehicles','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_licenses from jsonb_array_elements_text(coalesce(v_facts->'need.required_licenses','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_photos from jsonb_array_elements_text(coalesce(v_facts->'need.public_photo_paths','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_conditions from jsonb_array_elements_text(coalesce(v_facts->'need.critical_conditions','[]'::jsonb));
  if v_facts ? 'need.minimum_experience_years' then v_min_exp:=(v_facts->>'need.minimum_experience_years')::integer; end if;
  v_verified:=case when v_facts ? 'need.verified_identity_required' then (v_facts->>'need.verified_identity_required')::boolean else false end;

  v_country:=private.require_location_country(v_facts->'need.task_country_code');
  select default_timezone into v_timezone from private.location_market_configs where country_code=v_country;
  v_geo:=v_facts->'need.task_geography';
  perform private.validate_need_v2_fact('need.task_geography',v_geo);
  v_exec_mode:=v_geo->>'mode';
  v_start:=coalesce(v_geo->'start','null'::jsonb);
  v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
  v_city:=coalesce(nullif(btrim(v_start->>'city'),''),nullif(btrim(v_service->>'city'),''));
  v_area:=coalesce(nullif(btrim(v_start->>'area'),''),nullif(btrim(v_service->>'area'),''));
  if v_exec_mode='REMOTE' then v_city:=''; v_area:=''; end if;

  if v_facts ? 'need.exact_address' then v_exact_address:=v_facts->>'need.exact_address'; end if;
  if v_facts ? 'need.access_notes' then v_access_notes:=v_facts->>'need.access_notes'; end if;
  select * into v_old_sensitive from public.need_sensitive where need_id=v_need.id;
  select g.public_topology into v_old_geo from public.need_geography g where g.need_id=v_need.id;
  if v_old_sensitive.need_id is not null
     and coalesce(v_exact_address,'')=coalesce(v_old_sensitive.exact_address,'')
     and v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then
    v_exact_lat:=v_old_sensitive.exact_lat;
    v_exact_lng:=v_old_sensitive.exact_lng;
  end if;

  v_before:=private.need_full_edit_snapshot(v_need.id);
  if v_before is null then raise exception 'NEED_SNAPSHOT_FAILED' using errcode='P0001'; end if;

  v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'needId',p_need_id,'expectedRevision',p_expected_revision,'conversationId',p_conversation_id,'facts',v_facts
  )::text,'UTF8'),'sha256'),'hex');

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||E'\n'||v_request_id,4411));
  select * into v_existing from private.need_edit_commands c
   where c.requester_account_id=v_uid and c.client_request_id=v_request_id for update;
  if found then
    if v_existing.request_hash<>v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return v_existing.result||jsonb_build_object('idempotentReplay',true);
  end if;

  v_region_token:=current_setting('uskoci.need_region',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  perform set_config('uskoci.need_lifecycle','CONFIRM_EDIT',true);
  update public.needs n
     set title=btrim(v_title),description=btrim(v_description),category=btrim(v_category),
         required_slots=v_slots,mode=v_mode,requester_price_rsd=v_price,
         required_skills=v_skills,required_tools=v_tools,required_vehicles=v_vehicles,required_licenses=v_licenses,
         minimum_experience_years=v_min_exp,verified_identity_required=v_verified,
         schedule_kind=v_schedule_kind,starts_at=v_starts_at,ends_at=v_ends_at,
         execution_location_mode=v_exec_mode,task_country_code=v_country,task_timezone=v_timezone,
         approximate_lat=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.approximate_lat else null end,
         approximate_lng=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.approximate_lng else null end,
         public_lat=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.public_lat else null end,
         public_lng=case when v_geo is not distinct from v_old_geo and v_country is not distinct from v_need.task_country_code then v_need.public_lng else null end,
         approximate_city=coalesce(v_city,''),approximate_area=coalesce(v_area,''),
         public_photo_paths=v_photos,status='DRAFT',revision=v_need.revision+1,
         published_at=null,response_deadline=null,urgent=false,urgent_activated_at=null,urgent_expires_at=null,urgent_policy_version=null,
         updated_at=statement_timestamp()
   where n.id=v_need.id and n.revision=v_need.revision and n.status in ('DRAFT','PUBLISHED','SELECTION')
   returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle','',true);
  perform set_config('uskoci.need_region',coalesce(v_region_token,''),true);
  if not found then raise exception 'NEED_EDIT_CONFLICT' using errcode='40001'; end if;

  insert into public.need_geography(need_id,public_topology,updated_at)
  values(v_need.id,v_geo,statement_timestamp())
  on conflict(need_id) do update set public_topology=excluded.public_topology,updated_at=excluded.updated_at;

  insert into public.need_requirement_details(need_id,critical_conditions,updated_at)
  values(v_need.id,v_conditions,statement_timestamp())
  on conflict(need_id) do update set critical_conditions=excluded.critical_conditions,updated_at=excluded.updated_at;

  insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng,updated_at)
  values(v_need.id,coalesce(v_exact_address,''),coalesce(v_access_notes,''),v_exact_lat,v_exact_lng,statement_timestamp())
  on conflict(need_id) do update set exact_address=excluded.exact_address,access_notes=excluded.access_notes,
    exact_lat=excluded.exact_lat,exact_lng=excluded.exact_lng,updated_at=excluded.updated_at;

  perform private.materialize_resolved_location(v_need.id,p_conversation_id);

  delete from private.dispatch_schedule where need_id=v_need.id;

  v_after:=private.need_full_edit_snapshot(v_need.id);
  if v_after is not distinct from v_before then raise exception 'NO_MATERIAL_CHANGE' using errcode='22023'; end if;

  insert into private.need_revision_events(
    need_id,from_revision,to_revision,from_status,previous_material_snapshot,new_material_snapshot,created_by_account_id
  ) values (
    v_need.id,p_expected_revision,v_need.revision,case when v_from_status='DRAFT' then 'DRAFT' else 'PUBLISHED_OR_SELECTION' end,v_before,v_after,v_uid
  ) returning id into v_event_id;

  update public.ai_conversations
     set status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id and status='OPEN';

  perform private.audit_marketplace(v_uid,'NEED_AI_EDIT_CONFIRMED','NEED',v_need.id,v_need.revision,
    jsonb_build_object('fromRevision',p_expected_revision,'toRevision',v_need.revision,'revisionEventId',v_event_id,'conversationId',p_conversation_id));

  v_result:=jsonb_build_object(
    'needId',v_need.id,'fromRevision',p_expected_revision,'revision',v_need.revision,'status','DRAFT',
    'revisionEventId',v_event_id,'conversationId',p_conversation_id,'requiresReadmission',true,
    'idempotentReplay',false,'authoritative',true
  );

  insert into private.need_edit_commands(
    requester_account_id,client_request_id,request_hash,need_id,from_revision,to_revision,revision_event_id,result
  ) values(v_uid,v_request_id,v_request_hash,v_need.id,p_expected_revision,v_need.revision,v_event_id,v_result);

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.closure_redaction_patch_v5(r text, t jsonb, a uuid, g uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p jsonb:='{}';k text;h text;ag public.agreements;terms jsonb;
begin
 if r is null or t is null or a is null or g is null or not(r=any(private.closure_redaction_relations_v5()))
 then raise exception 'ERASURE_RELATION_NOT_ADMITTED';end if;
 h:=encode(extensions.digest(convert_to('AF-D22:ERASED:'||r||':'||coalesce(t->>'id',t->>'client_request_id',t->>'conversation_id',t->>'review_id',t->>'account_id','subject'),'UTF8'),'sha256'),'hex');
 -- Support command receipts are metadata only. A related scoped case keeps its
 -- exact recovery/hash contract until that exception is resolved; no narrative
 -- is copied into the redaction ledger. Cancelled opaque tombstones stay usable.
 if r in('private.support_commands_v5','private.support_grant_commands_v5') then return null;end if;
 if r in('public.ai_conversations','public.ai_messages','public.ai_structured_facts','public.ai_action_proposals',
  'private.ai_need_turn_commands','private.worker_ai_turns','private.worker_ai_sessions','private.ai_task_reviews','private.worker_ai_reviews','private.need_draft_save_commands')
 and exists(select 1 from private.retention_holds where account_id=a and active and conversation_id=
  case when r='public.ai_conversations' then (t->>'id')::uuid else (t->>'conversation_id')::uuid end) then return null;end if;
 if r='private.ai_task_review_commands' and exists(select 1 from private.ai_task_reviews v join private.retention_holds h on h.account_id=v.account_id and h.conversation_id=v.conversation_id and h.active
  where v.account_id=a and v.id=(t->>'review_id')::uuid) then return null;end if;
 if r='private.worker_ai_saves' and exists(select 1 from private.worker_ai_reviews v join private.retention_holds h on h.account_id=v.account_id and h.conversation_id=v.conversation_id and h.active
  where v.account_id=a and v.id=(t->>'review_id')::uuid) then return null;end if;
 if r='public.ai_structured_facts' then
  if t->'superseded_by'<>'null'::jsonb then return jsonb_build_object('operation','UPDATE','patch',jsonb_build_object('superseded_by',null));end if;
  if exists(select 1 from public.ai_structured_facts where superseded_by=(t->>'id')::uuid) then return null;end if;
 end if;
 if r in('public.ai_messages','public.ai_structured_facts','public.ai_action_proposals',
  'public.need_sensitive','public.need_geography','public.need_requirement_details',
  'private.data_export_artifacts','public.notification_push_attempts','public.notification_deliveries',
  'public.notification_push_devices','public.notification_preferences','public.opportunity_deliveries',
  'private.dispatch_schedule','public.access_grants','public.profile_availability_rules','public.profile_availability_windows',
  'public.worker_match_preferences','private.worker_calendar_events','private.worker_calendar_serialization',
  'private.support_read_markers_v5','private.group_message_visibility_v5') then
  if r='private.data_export_artifacts' and exists(select 1 from storage.objects where bucket_id='data-export-artifacts' and name=t->>'object_path')
  then raise exception 'ERASURE_STORAGE_NOT_CLEAN';end if;
  return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 end if;
 if r in('private.owned_media_assets','private.agreement_photo_uploads_v5') then
  if t->>'dispatch_state'='DISPATCHING' then raise exception 'ERASURE_PRODUCER_UNSETTLED';end if;
  if private.closure_erasure_media_protected_v5(a,t->>'storage_path') then return null;end if;
  if exists(select 1 from storage.objects where bucket_id='profile-media' and name=t->>'storage_path') then raise exception 'ERASURE_STORAGE_NOT_CLEAN';end if;
  return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 end if;
 if r='public.app_accounts' then p:=jsonb_build_object('email','','phone','','full_name','','city','');
 elsif r='public.app_profiles' then p:=jsonb_build_object('display_name','','city','','headline','','bio','','avatar_path',null,
  'portfolio','[]'::jsonb,'skills','[]'::jsonb,'tools','[]'::jsonb,'licenses','[]'::jsonb,'vehicles','[]'::jsonb,'exclusions','[]'::jsonb,
  'years_experience',0,'radius_km',1,'available_now',false,'available_now_expires_at',null,'team_capacity',1,
  'minimum_fee_rsd',0,'rating_requester',null,'rating_worker',null,'operating_country_code',null,'profile_status','CLOSED');
 elsif r='public.needs' then p:=jsonb_build_object('title','Obrisan zadatak','description','Sadržaj uklonjen pri zatvaranju naloga.','category','OBRISANO',
  'approximate_city','','approximate_area','','approximate_lat',null,'approximate_lng',null,'public_lat',null,'public_lng',null,
  'starts_at',null,'ends_at',null,'required_skills','[]'::jsonb,'required_tools','[]'::jsonb,'required_vehicles','[]'::jsonb,'required_licenses','[]'::jsonb,
  'public_photo_paths','[]'::jsonb,'requester_price_rsd',null,'response_deadline',null,'urgent',false,
  'urgent_activated_at',null,'urgent_expires_at',null,'urgent_policy_version',null,'remaining_search_close_reason',null);
 elsif r in('private.ai_task_reviews','private.worker_ai_reviews') then p:=jsonb_build_object('envelope',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.worker_ai_sessions' then p:=jsonb_build_object('candidate',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.ai_task_review_commands' then
  foreach k in array array['evaluation_binding','evaluation','published'] loop
   if t->k<>'null'::jsonb then p:=p||jsonb_build_object(k,jsonb_build_object('erasedBy','AF-D22'));end if;
  end loop;
 elsif r='private.need_revision_events' then p:=jsonb_build_object('previous_material_snapshot',jsonb_build_object('erasedBy','AF-D22'),'new_material_snapshot',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='public.data_export_requests' then p:=jsonb_build_object('active_export_attempt_id',null,
  'export_revoked_at',coalesce(nullif(t->'export_revoked_at','null'::jsonb),to_jsonb((select requested_at from private.closure_executions_v5 where generation=g and account_id=a))));
 elsif r='private.need_publication_decisions' then p:=jsonb_build_object('public_geography_snapshot',jsonb_build_object('erasedBy','AF-D22'),'public_media_refs','[]'::jsonb,'reviewer_provenance','{}'::jsonb,'service_provenance',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.preselection_qa_questions' then p:=jsonb_build_object('question_text','Sadržaj uklonjen pri zatvaranju naloga.');
 elsif r='private.preselection_qa_answer_versions' then p:=jsonb_build_object('answer_text','Sadržaj uklonjen pri zatvaranju naloga.');
 elsif r in('private.preselection_qa_policy_decisions','private.preselection_qa_materiality_decisions') then
  if exists(select 1 from private.qa_ai_commands q where q.account_id<>a and
   (case when r='private.preselection_qa_policy_decisions' then q.policy_decision_id else q.materiality_decision_id end)=(t->>'id')::uuid
   and not exists(select 1 from private.closure_executions_v5 e join private.closure_actions_v5 ac on ac.generation=e.generation
    where e.account_id=q.account_id and ac.kind='RELATIONAL_REDACT' and ac.state='VERIFIED')) then return null;end if;
  p:=jsonb_build_object('service_provenance',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.response_application_snapshots' then p:=jsonb_build_object('worker_skills','[]'::jsonb,'worker_tools','[]'::jsonb,'worker_licenses','[]'::jsonb,'worker_vehicles','[]'::jsonb);
 elsif r in('public.marketplace_responses','public.marketplace_response_versions') then
  if exists(select 1 from public.agreements x where x.selected_response_id=coalesce(t->>'response_id',t->>'id')::uuid and private.closure_erasure_agreement_protected_v5(x.id)) then return null;end if;
  p:=jsonb_build_object('scope_note','');if t?'bounded_message' then p:=p||jsonb_build_object('bounded_message','');end if;
 elsif r='public.agreement_messages' then
  -- A selected Support copy survives in its immutable scoped snapshot. The
  -- original ordinary chat row does not need the same plaintext forever.
  p:=jsonb_build_object('body','Sadržaj uklonjen pri zatvaranju naloga.','photo_asset_ids','[]'::jsonb);
 elsif r='private.group_messages_v5' then p:=jsonb_build_object('body','Sadržaj uklonjen pri zatvaranju naloga.');
 elsif r in('public.agreement_versions','public.agreement_change_proposals') then
  if private.closure_erasure_agreement_protected_v5((t->>'agreement_id')::uuid) then return null;end if;
  k:=case when r='public.agreement_versions' then 'terms' else 'proposed_terms' end;
  if exists(select 1 from private.closure_scope_sources_v5 where account_id=a and generation=g and agreement_id=(t->>'agreement_id')::uuid
   and source_kind=case when r='public.agreement_versions' then 'VERSION' else 'PROPOSAL' end
   and source_id=case when r='public.agreement_versions' then t->>'version' else t->>'id' end and scope_author=a) then
   terms:=(t->k)||jsonb_build_object('scope_note','');p:=jsonb_build_object(k,terms);
  end if;
  if r='public.agreement_change_proposals' and t->>'proposed_by_account_id'=a::text then p:=p||jsonb_build_object('reason','Sadržaj uklonjen pri zatvaranju naloga.');end if;
  if p='{}'::jsonb then return null;end if;
 elsif r='public.agreement_execution' then
  -- The source problem itself is an unresolved evidence exception.
  if t->'problem_opened_at'<>'null'::jsonb then return null;end if;
  p:=jsonb_build_object('problem_narrative',null);
 elsif r='private.agreement_location_points' then return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 elsif r='public.user_activity_events' then
  if t->>'recipient_user_id'=a::text then return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);end if;
  p:=jsonb_build_object('payload',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.marketplace_audit_log' then p:=jsonb_build_object('detail',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.retention_holds' then
  if t->'active'='true'::jsonb then return null;end if;
  p:=jsonb_build_object('hold_key','AF-D22:'||(t->>'id'));
 elsif r='private.ai_test_accounts_v5' then
  if t->'retired_at'='null'::jsonb then p:=jsonb_build_object('retired_at',(select requested_at from private.closure_executions_v5 where generation=g and account_id=a));end if;
 elsif r='private.support_operator_grants_v5' then
  if t->'active'='true'::jsonb then p:=jsonb_build_object('active',false,'revision',(t->>'revision')::integer+1,'updated_at',(select requested_at from private.closure_executions_v5 where generation=g and account_id=a));end if;
 end if;
 -- Content-derived request hashes are no longer original-content proofs after
 -- erasure. Policy/document/source-program digests and charged units are kept.
 foreach k in array array['request_hash','input_hash','input_sha256','text_sha256','semantic_hash','content_fingerprint',
  'question_fingerprint','answer_fingerprint','context_hash','body_hash','body_sha256','completion_hash','source_hash','base_hash',
  'canonical_fingerprint','private_materiality_marker','content_hash','evaluation_result_hash','need_edit_base_fingerprint'] loop
  if t?k and jsonb_typeof(t->k)='string' then p:=p||jsonb_build_object(k,h);end if;
 end loop;
 -- These JSON command results are private source copies, not immutable legal
 -- terms. Keep identity/state columns for anti-replay, never old narrative JSON.
 if r in('private.requester_identity_commands','private.worker_ai_saves','private.need_draft_save_commands',
  'private.ai_need_turn_commands','private.worker_ai_turns','private.qa_ai_commands',
  'private.need_edit_commands','private.need_publish_commands','private.response_submit_commands','private.response_withdraw_commands',
  'private.response_revision_resolution_commands','private.remaining_search_close_commands','private.preselection_qa_commands',
  'private.account_block_commands','private.retention_jobs','private.support_commands_v5','private.support_grant_commands_v5') then
  foreach k in array array['receipt','result'] loop
   if t?k and t->k<>'null'::jsonb then p:=p||jsonb_build_object(k,jsonb_build_object('erasedBy','AF-D22'));end if;
  end loop;
 end if;
 if p='{}'::jsonb or t@>p then return null;end if;
 return jsonb_build_object('operation','UPDATE','patch',p);
end $function$;

CREATE OR REPLACE FUNCTION private.need_material_snapshot(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select jsonb_build_object(
    'title', n.title,
    'taskCountryCode', n.task_country_code,
    'taskTimezone', n.task_timezone,
    'description', n.description,
    'category', n.category,
    'requiredSlots', n.required_slots,
    'mode', n.mode,
    'requesterPriceRsd', n.requester_price_rsd,
    'requiredSkills', to_jsonb(n.required_skills),
    'requiredTools', to_jsonb(n.required_tools),
    'requiredVehicles', to_jsonb(n.required_vehicles),
    'requiredLicenses', to_jsonb(n.required_licenses),
    'minimumExperienceYears', n.minimum_experience_years,
    'verifiedIdentityRequired', n.verified_identity_required,
    'scheduleKind', n.schedule_kind,
    'startsAt', n.starts_at,
    'endsAt', n.ends_at,
    'executionLocationMode', n.execution_location_mode,
    'approximateLat', n.approximate_lat,
    'approximateLng', n.approximate_lng,
    'approximateCity', n.approximate_city,
    'approximateArea', n.approximate_area,
    'publicPhotoPaths', to_jsonb(n.public_photo_paths),
    'privateLocation', case when s.need_id is null then null else jsonb_build_object(
      'exactAddress', s.exact_address,
      'accessNotes', s.access_notes,
      'resolvedLocation', s.resolved_location,
      'exactLat', s.exact_lat,
      'exactLng', s.exact_lng
    ) end
  )
  -- Added only where it exists, so the snapshot of a task without the ~100 m point is what it was.
  || case when n.public_lat is null and n.public_lng is null then '{}'::jsonb
       else jsonb_build_object('publicLat', n.public_lat, 'publicLng', n.public_lng) end
  from public.needs n
  left join public.need_sensitive s on s.need_id = n.id
  where n.id = p_need_id
$function$;

CREATE OR REPLACE FUNCTION private.need_publication_fingerprint_snapshot(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_need public.needs%rowtype;
  v_topology jsonb;
  v_conditions text[] := '{}'::text[];
  v_public_geography jsonb;
  v_private_payload jsonb;
  v_private_marker text;
  v_payload jsonb;
  v_fingerprint text;
  v_media text[];
begin
  select * into v_need
    from public.needs
   where id = p_need_id;

  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;

  select g.public_topology
    into v_topology
    from public.need_geography g
   where g.need_id = p_need_id;

  select coalesce(r.critical_conditions, '{}'::text[])
    into v_conditions
    from public.need_requirement_details r
   where r.need_id = p_need_id;
  v_conditions := coalesce(v_conditions, '{}'::text[]);

  select case
           when s.need_id is null then jsonb_build_object('present', false)
           else jsonb_build_object(
             'present', true,
             'exactAddress', s.exact_address,
             'accessNotes', s.access_notes,
             'exactLat', s.exact_lat,
             'exactLng', s.exact_lng
           ) || case when s.resolved_location is null then '{}'::jsonb
             else jsonb_build_object('resolvedLocation',s.resolved_location) end
         end
    into v_private_payload
    from (select p_need_id as need_id) q
    left join public.need_sensitive s on s.need_id = q.need_id;

  v_private_marker := encode(
    extensions.digest(convert_to(v_private_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  v_public_geography := jsonb_build_object(
    'executionLocationMode', v_need.execution_location_mode,
    'approximateCity', v_need.approximate_city,
    'approximateArea', v_need.approximate_area,
    'approximateLat', v_need.approximate_lat,
    'approximateLng', v_need.approximate_lng,
    'topology', coalesce(v_topology, 'null'::jsonb)
  )
  -- The ~100 m point is public material and is bound by the fingerprint of every task that has one.
  -- It is added only where it exists: the fingerprint of a task published before it is unchanged, to
  -- the byte, so nothing already accepted, evaluated or published is invalidated.
  || case when v_need.public_lat is null and v_need.public_lng is null then '{}'::jsonb
       else jsonb_build_object('publicLat', v_need.public_lat, 'publicLng', v_need.public_lng) end;

  v_media := coalesce(v_need.public_photo_paths, '{}'::text[]);

  v_payload := jsonb_build_object(
    'schemaVersion', 'NEED_PUBLICATION_FINGERPRINT_V1',
    'needId', v_need.id,
    'revision', v_need.revision,
    'title', v_need.title,
    'description', v_need.description,
    'category', v_need.category,
    'scheduleKind', v_need.schedule_kind,
    'startsAt', v_need.starts_at,
    'endsAt', v_need.ends_at,
    'requiredSlots', v_need.required_slots,
    'priceMode', v_need.mode,
    'requesterPriceRsd', v_need.requester_price_rsd,
    'requiredSkills', to_jsonb(v_need.required_skills),
    'requiredTools', to_jsonb(v_need.required_tools),
    'requiredVehicles', to_jsonb(v_need.required_vehicles),
    'requiredLicenses', to_jsonb(v_need.required_licenses),
    'minimumExperienceYears', v_need.minimum_experience_years,
    'verifiedIdentityRequired', v_need.verified_identity_required,
    'criticalConditions', to_jsonb(v_conditions),
    'publicGeography', v_public_geography,
    'publicMediaRefs', to_jsonb(v_media),
    'privateMaterialityMarker', v_private_marker
  );

  v_fingerprint := encode(
    extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  return jsonb_build_object(
    'schemaVersion', 'NEED_PUBLICATION_FINGERPRINT_V1',
    'needId', v_need.id,
    'needRevision', v_need.revision,
    'canonicalFingerprint', v_fingerprint,
    'privateMaterialityMarker', v_private_marker,
    'publicGeography', v_public_geography,
    'publicMediaRefs', to_jsonb(v_media)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.need_publication_location_readiness(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare n public.needs; s public.need_sensitive; geo jsonb; slots text[]:='{}'; missing text[]:='{}'; k text; i integer; valid boolean;
begin
  select * into n from public.needs where id=p_need_id;
  select * into s from public.need_sensitive where need_id=p_need_id;
  select public_topology into geo from public.need_geography where need_id=p_need_id;
  begin geo:=private.normalize_task_geography(geo);
  exception when data_exception then geo:=null; end;
  if geo is null or geo->>'mode' is distinct from n.execution_location_mode then
    return jsonb_build_object('mode',coalesce(n.execution_location_mode,'STATIONARY'),'complete',false,'missingSlots','[]'::jsonb);
  end if;
  if geo->>'mode'='REMOTE' then
    return jsonb_build_object('mode','REMOTE','complete',s.resolved_location is null and s.exact_lat is null and s.exact_lng is null
      and nullif(btrim(s.exact_address),'') is null and nullif(btrim(s.access_notes),'') is null
      and n.approximate_lat is null and n.approximate_lng is null
      and n.public_lat is null and n.public_lng is null
      and coalesce(n.approximate_city,'')='' and coalesce(n.approximate_area,'')='','missingSlots','[]'::jsonb);
  end if;
  if geo ? 'start' then slots:=array_append(slots,'start'); end if;
  for i in 0..coalesce(jsonb_array_length(geo->'waypoints'),0)-1 loop slots:=array_append(slots,'waypoints/'||i::text); end loop;
  if geo ? 'end' then slots:=array_append(slots,'end'); end if;
  if geo ? 'serviceArea' then slots:=array_append(slots,'serviceArea'); end if;
  valid:=s.resolved_location is not null and private.resolved_location_record_valid(s.resolved_location,n.task_country_code,geo,s.exact_address,n.requester_account_id);
  foreach k in array slots loop
    if not coalesce(valid,false) or not exists(select 1 from jsonb_array_elements(s.resolved_location#>'{value,points}') p where p->>'slot'=k) then
      missing:=array_append(missing,k);
    end if;
  end loop;
  return jsonb_build_object('mode',geo->>'mode','complete',coalesce(valid,false) and cardinality(slots)>0 and cardinality(missing)=0,'missingSlots',to_jsonb(missing));
end;
$function$;

create or replace function public.rpc_list_open_tasks_v3(
  p_bbox jsonb default null, p_filters jsonb default '{}'::jsonb, p_limit integer default 50,
  p_before_at timestamptz default null, p_before_id uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_west numeric; v_south numeric; v_east numeric; v_north numeric;
  v_env extensions.geography;
  v_category text; v_price_mode text; v_urgent_only boolean := false; v_remote text := 'INCLUDE';
  v_starts_from timestamptz; v_starts_to timestamptz;
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  if jsonb_typeof(v_filters) is distinct from 'object'
     or v_filters - array['category','priceMode','urgentOnly','remote','startsFrom','startsTo'] <> '{}'::jsonb then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end if;
  if v_filters ? 'category' then
    if jsonb_typeof(v_filters->'category') <> 'string' or btrim(v_filters->>'category') = ''
       or char_length(v_filters->>'category') > 120 then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_category := btrim(v_filters->>'category');
  end if;
  if v_filters ? 'priceMode' then
    if jsonb_typeof(v_filters->'priceMode') <> 'string' or v_filters->>'priceMode' not in ('MY_PRICE','OFFERS') then
      raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_price_mode := v_filters->>'priceMode';
  end if;
  if v_filters ? 'urgentOnly' then
    if jsonb_typeof(v_filters->'urgentOnly') <> 'boolean' then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_urgent_only := (v_filters->>'urgentOnly')::boolean;
  end if;
  if v_filters ? 'remote' then
    if jsonb_typeof(v_filters->'remote') <> 'string' or v_filters->>'remote' not in ('INCLUDE','ONLY','EXCLUDE')
       or (p_bbox is not null and v_filters->>'remote' <> 'EXCLUDE') then
      raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
    v_remote := v_filters->>'remote';
  end if;
  begin
    if v_filters ? 'startsFrom' then
      if jsonb_typeof(v_filters->'startsFrom') <> 'string' then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
      v_starts_from := (v_filters->>'startsFrom')::timestamptz;
    end if;
    if v_filters ? 'startsTo' then
      if jsonb_typeof(v_filters->'startsTo') <> 'string' then raise exception 'INVALID_FILTER' using errcode = '22023'; end if;
      v_starts_to := (v_filters->>'startsTo')::timestamptz;
    end if;
  exception when data_exception then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end;

  if p_bbox is not null then
    if jsonb_typeof(p_bbox) <> 'object'
       or p_bbox - array['west','south','east','north'] <> '{}'::jsonb
       or not (p_bbox ?& array['west','south','east','north'])
       or jsonb_typeof(p_bbox->'west') <> 'number' or jsonb_typeof(p_bbox->'south') <> 'number'
       or jsonb_typeof(p_bbox->'east') <> 'number' or jsonb_typeof(p_bbox->'north') <> 'number' then
      raise exception 'INVALID_BBOX' using errcode = '22023';
    end if;
    v_west := (p_bbox->>'west')::numeric; v_south := (p_bbox->>'south')::numeric;
    v_east := (p_bbox->>'east')::numeric; v_north := (p_bbox->>'north')::numeric;
    if v_west < -180 or v_east > 180 or v_south < -90 or v_north > 90
       or v_west >= v_east or v_south >= v_north
       or v_north - v_south > 3 or v_east - v_west > 5 then
      raise exception 'INVALID_BBOX' using errcode = '22023';
    end if;
    -- The index filters on the coarse point, which lies within one hundredth of a degree of the
    -- finer one; the margin keeps a task whose fine pin is inside the viewport from being cut off at
    -- its edge. The numeric comparison below is the exact test.
    v_env := extensions.ST_MakeEnvelope(
      greatest(v_west - 0.01, -180)::double precision, greatest(v_south - 0.01, -90)::double precision,
      least(v_east + 0.01, 180)::double precision, least(v_north + 0.01, 90)::double precision, 4326)::extensions.geography;
  end if;

  select coalesce(jsonb_agg(q.item order by q.published_at desc, q.id desc), '[]'::jsonb) into v_items
  from (
    select n.published_at, n.id, jsonb_build_object(
      'id', n.id, 'sortAt', n.published_at, 'publishedAt', n.published_at,
      'title', n.title, 'category', n.category, 'status', n.status, 'urgent', n.urgent,
      'scheduleKind', n.schedule_kind, 'startsAt', n.starts_at, 'endsAt', n.ends_at,
      'executionLocationMode', n.execution_location_mode,
      'approximateCity', nullif(btrim(n.approximate_city), ''), 'approximateArea', nullif(btrim(n.approximate_area), ''),
      -- The ~100 m point where the task has one; the coarse point for a task published before it existed.
      -- legacyPin is always the coarse point, so both generations can be compared in one answer.
      'pin', case when n.public_lat is not null and n.public_lng is not null
          then jsonb_build_object('lat', n.public_lat, 'lng', n.public_lng, 'precision', 'FINE_100M')
        when n.approximate_lat is null or n.approximate_lng is null then null
        else jsonb_build_object('lat', n.approximate_lat, 'lng', n.approximate_lng, 'precision', 'COARSE_1KM') end,
      'legacyPin', case when n.approximate_lat is null or n.approximate_lng is null then null
        else jsonb_build_object('lat', n.approximate_lat, 'lng', n.approximate_lng, 'precision', 'COARSE_1KM') end,
      'requiredSlots', n.required_slots, 'coveredSlots', n.covered_slots,
      'requiredSkills', to_jsonb(n.required_skills), 'requiredTools', to_jsonb(n.required_tools),
      'requiredVehicles', to_jsonb(n.required_vehicles), 'requiredLicenses', to_jsonb(n.required_licenses),
      'minimumExperienceYears', n.minimum_experience_years,
      'priceMode', n.mode, 'requesterPriceRsd', n.requester_price_rsd,
      'requesterProfileId', n.requester_profile_id,
      'responseDeadline', n.response_deadline,
      'acceptsApplications', n.required_slots > n.covered_slots
        and (n.response_deadline is null or n.response_deadline > statement_timestamp()),
      'publicTopology', (select g.public_topology from public.need_geography g where g.need_id = n.id),
      'criticalConditions', (select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id = n.id)
    ) as item
    from (
      -- Two branches, one of which is switched off by a parameter-only condition before it reads
      -- anything, so each keeps its own index: the viewport its GiST index, the list its order.
      -- The limit is inside each branch: no branch can read more than p_limit + 1 rows' worth of items.
      (select m.* from public.needs m
        where p_bbox is not null
          and m.status in ('PUBLISHED','SELECTION')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
          and m.approx_geog OPERATOR(extensions.&&) v_env
          and m.approximate_lat between v_south - 0.01 and v_north + 0.01
          and m.approximate_lng between v_west - 0.01 and v_east + 0.01
        and (v_category is null or m.category = v_category)
        and (v_price_mode is null or m.mode = v_price_mode)
        and (not v_urgent_only or m.urgent)
        and (v_starts_from is null or m.starts_at >= v_starts_from)
        and (v_starts_to is null or m.starts_at <= v_starts_to)
        and (p_before_at is null or (m.published_at, m.id) < (p_before_at, p_before_id))
      order by m.published_at desc, m.id desc
      limit p_limit + 1)
      union all
      (select m.* from public.needs m
        where p_bbox is null
          and m.status in ('PUBLISHED','SELECTION')
          and m.published_at is not null
          and m.remaining_search_closed_at is null
          and (v_remote = 'INCLUDE'
            or (v_remote = 'ONLY' and m.execution_location_mode = 'REMOTE')
            or (v_remote = 'EXCLUDE' and m.execution_location_mode <> 'REMOTE'))
        and (v_category is null or m.category = v_category)
        and (v_price_mode is null or m.mode = v_price_mode)
        and (not v_urgent_only or m.urgent)
        and (v_starts_from is null or m.starts_at >= v_starts_from)
        and (v_starts_to is null or m.starts_at <= v_starts_to)
        and (p_before_at is null or (m.published_at, m.id) < (p_before_at, p_before_id))
      order by m.published_at desc, m.id desc
      limit p_limit + 1)
    ) n
    order by n.published_at desc, n.id desc
    limit p_limit + 1
  ) q;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$;

-- Explicit source admission, as source migration 145 does it: the closure source digest is re-bound to
-- the schema and program as they now are, from a predecessor that was ready. No retention candidate,
-- hold or deletion rule is relaxed, and the erasure patch covers the two new columns.
do $rebind$
declare old_sha text; new_sha text; d text;
begin
  select sha, ready_definition into strict old_sha, d from pkg023c_predecessor;
  if (select sha256 from private.closure_source_v5 where singleton) is distinct from old_sha
     or length(d) - length(replace(d, old_sha, '')) <> length(old_sha) then
    raise exception 'PKG023C_SOURCE_BINDING_INVALID';
  end if;
  new_sha := private.closure_source_digest_v5();
  if new_sha is null or new_sha = old_sha then raise exception 'PKG023C_SOURCE_BINDING_INVALID'; end if;
  update private.closure_source_v5 set sha256 = new_sha where singleton;
  execute replace(d, old_sha, new_sha);
  if private.retention_ai_source_ready() is distinct from true then raise exception 'PKG023C_SOURCE_NOT_READY'; end if;
end
$rebind$;

do $post$
begin
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.materialize_resolved_location(uuid,uuid)'::regprocedure)
     is distinct from '00e5ae557dbd6468a63947613a892802' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN private.materialize_resolved_location'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.check_need_resolved_location_binding()'::regprocedure)
     is distinct from '33d75318b507498c0c35e40b160142a4' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN private.check_need_resolved_location_binding'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.guard_need_write()'::regprocedure)
     is distinct from '6630120ba2fb349a1b1801e99f0e42e4' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN private.guard_need_write'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.rpc_confirm_need_edit(uuid,integer,text,jsonb)'::regprocedure)
     is distinct from '8fdbecd3b6ed2421347411cd1cdfb285' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN public.rpc_confirm_need_edit'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure)
     is distinct from '964ff7dd9159151ac0e9cc37c7b10c57' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN public.rpc_confirm_need_edit_from_review'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure)
     is distinct from 'b76fe19c49010ce4ea49a9377a7047bb' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN private.closure_redaction_patch_v5'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.need_material_snapshot(uuid)'::regprocedure)
     is distinct from '8538e64f4f33f1c5907e8bb32f74a872' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN private.need_material_snapshot'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.need_publication_fingerprint_snapshot(uuid)'::regprocedure)
     is distinct from '7d276a2b9d2087f58c99b0fc82ad1b15' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN private.need_publication_fingerprint_snapshot'; end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'private.need_publication_location_readiness(uuid)'::regprocedure)
     is distinct from 'd9d56dc268b3f96e43a6916b3a94f382' then raise exception 'PKG023C_BODY_NOT_AS_WRITTEN private.need_publication_location_readiness'; end if;
  if exists (select 1 from public.needs where public_lat is not null or public_lng is not null) then
    raise exception 'PKG023C_BACKFILLED_A_ROW';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
