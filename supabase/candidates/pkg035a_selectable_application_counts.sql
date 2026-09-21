-- PKG-035a: separate actionable applications from history (deep read 7.32).
-- Read-only product change: no row writes, table/trigger changes or certificate rebind.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table pkg035_before(signature text primary key,acl aclitem[],definer boolean,config text[],digest text) on commit drop;
do $pre$
begin
  if to_regprocedure('private.need_candidate_states_v5(uuid)') is not null
    or to_regprocedure('public.selectable_application_count(public.needs)') is not null then
    raise exception 'PKG035A_ALREADY_APPLIED'; end if;
  if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
    (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG035A_CLOSURE_NOT_READY'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure)
    is distinct from '7cbb83905c1c983be4a7d92ff505411e' then raise exception 'PKG035A_PREDECESSOR_DRIFT: public.rpc_select_response(uuid,integer,uuid,integer,text,text)'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='private.assert_application_price_v5(public.needs,integer,integer)'::regprocedure)
    is distinct from 'bd7ef02925c03d99ff7fd549219214cb' then raise exception 'PKG035A_PREDECESSOR_DRIFT: private.assert_application_price_v5(public.needs,integer,integer)'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz)'::regprocedure)
    is distinct from '781956cab666befab216b3ce2334ca1d' then raise exception 'PKG035A_PREDECESSOR_DRIFT: private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz)'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='private.match_detail_without_calendar(uuid,uuid)'::regprocedure)
    is distinct from '9180606a038f3606b0906ab4aefdd0c1' then raise exception 'PKG035A_PREDECESSOR_DRIFT: private.match_detail_without_calendar(uuid,uuid)'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_list_need_candidates(uuid)'::regprocedure)
    is distinct from '0b0d789cd5c4b8adcf0d025d4a5810e7' then raise exception 'PKG035A_PREDECESSOR_DRIFT: public.rpc_list_need_candidates(uuid)'; end if;
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_home_attention()'::regprocedure)
    is distinct from '7371d4cddcebead2cb86d8f795d2ee01' then raise exception 'PKG035A_PREDECESSOR_DRIFT: public.rpc_home_attention()'; end if;
  insert into pkg035_before select 'public.rpc_list_need_candidates(uuid)',proacl,prosecdef,proconfig,private.closure_source_digest_v5()
    from pg_proc where oid='public.rpc_list_need_candidates(uuid)'::regprocedure;
  insert into pkg035_before select 'public.rpc_home_attention()',proacl,prosecdef,proconfig,private.closure_source_digest_v5()
    from pg_proc where oid='public.rpc_home_attention()'::regprocedure;
end
$pre$;
create function private.need_candidate_states_v5(p_need_id uuid)
returns table(response_id uuid,candidate_state text)
language plpgsql stable security definer set search_path='pg_catalog'
as $function$
declare
  n public.needs; c record; remaining integer; s timestamptz; e timestamptz; eligible boolean;
begin
  select * into n from public.needs where id=p_need_id;
  if not found then return; end if;
  remaining:=greatest(n.required_slots-public.fn_need_covered_slots(n.id),0);
  for c in
    select r.*, v.need_revision as version_revision, v.content_hash, v.price_rsd as version_price,
      v.covered_slots as version_slots, v.proposed_start_at, v.proposed_end_at,
      p.account_id as profile_account, p.kind, p.profile_status, p.display_name, p.city, p.skills, p.team_capacity,
      exists(select 1 from public.agreements a where a.selected_response_id=r.id) as has_agreement
    from public.marketplace_responses r
    left join public.marketplace_response_versions v on v.response_id=r.id and v.version=r.current_version
    left join public.app_profiles p on p.id=r.worker_profile_id
    where r.need_id=n.id and r.status<>'DRAFT'
  loop
    response_id:=c.id;
    candidate_state:=case
      when c.has_agreement or c.status='SELECTED' then 'SELECTED'
      when c.status='WITHDRAWN' then 'WITHDRAWN'
      when c.status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
      when n.status not in ('PUBLISHED','SELECTION')
        or (n.response_deadline is not null and n.response_deadline<=statement_timestamp()) then 'CLOSED'
      when c.kind is distinct from 'WORKER' or c.profile_account is distinct from c.worker_account_id
        or c.profile_status is distinct from 'ACTIVE'
        or char_length(btrim(coalesce(c.display_name,'')))<2
        or char_length(btrim(coalesce(c.city,'')))<2
        or cardinality(coalesce(c.skills,'{}'::text[]))<1 or c.team_capacity is null
        or c.version_slots is null or c.version_slots>c.team_capacity
        or c.status in ('STALE','STALE_REVIEW_REQUIRED') or c.current_version is null or c.content_hash is null
        or c.version_revision is distinct from n.revision
        or c.submitted_against_need_revision is distinct from n.revision then 'STALE'
      when remaining<=0 then 'FULL'
      when c.covered_slots>remaining or c.version_slots>remaining then 'OVERFILL'
      when c.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then 'SELECTABLE'
      else 'CLOSED' end;
    if candidate_state='SELECTABLE' then
      s:=coalesce(c.proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' then n.starts_at end);
      e:=coalesce(c.proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' then n.ends_at end);
      if (c.proposed_start_at is null)<>(c.proposed_end_at is null)
        or (s is null)<>(e is null)
        or (s is not null and (not isfinite(s) or not isfinite(e) or s>=e))
        or (c.proposed_start_at is null and n.schedule_kind='FIXED_WINDOW' and (s is null or e is null)) then
        candidate_state:='STALE';
      else
        eligible:=coalesce((private.match_detail_for_calendar_interval(n.id,c.worker_profile_id,s,e)->>'responseAllowed')::boolean,false);
        if not eligible then candidate_state:='STALE'; end if;
      end if;
      if candidate_state='SELECTABLE' then
        begin
          -- Use the final selection authority, including legacy null/TOTAL/PER_PERSON semantics.
          perform private.assert_application_price_v5(n,c.version_slots,c.version_price);
        exception when sqlstate '22023' or sqlstate 'P0001' then
          if sqlerrm not in ('INVALID_PRICE','FIXED_PRICE_NOT_READY','FIXED_PRICE_MISMATCH',
            'TOTAL_PRICE_REQUIRES_ALL_SLOTS','UNKNOWN_PRICE_BASIS') then raise; end if;
          candidate_state:='STALE';
        end;
      end if;
    end if;
    return next;
  end loop;
end;
$function$;
revoke all on function private.need_candidate_states_v5(uuid) from public,anon,authenticated,service_role;
create function public.selectable_application_count(n public.needs)
returns integer language plpgsql stable security definer set search_path='pg_catalog'
as $function$
declare actor uuid:=auth.uid(); actual public.needs; result integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;
  -- Only the ID is input. Never trust owner/status/price fields in a caller-supplied composite.
  select * into actual from public.needs t where t.id=n.id and t.requester_account_id=actor;
  if not found then return null; end if;
  select count(*)::integer into result from private.need_candidate_states_v5(actual.id) c
    where c.candidate_state='SELECTABLE';
  return result;
end;
$function$;
revoke all on function public.selectable_application_count(public.needs) from public,anon,authenticated,service_role;
grant execute on function public.selectable_application_count(public.needs) to authenticated;
do $patch$
declare def text; anchor text:=$anchor$      private.match_detail(p_need_id,r.worker_profile_id) as match_detail,
$anchor$;
begin
  def:=pg_get_functiondef('public.rpc_list_need_candidates(uuid)'::regprocedure);
  if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'PKG035A_ANCHOR'; end if;
  execute replace(def,anchor,$replacement$$replacement$);
end
$patch$;
do $patch$
declare def text; anchor text:=$anchor$      case
        when c.has_agreement or c.raw_response_status = 'SELECTED' then 'SELECTED'
        when c.raw_response_status = 'WITHDRAWN' then 'WITHDRAWN'
        when c.raw_response_status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
        when coalesce(v_need.status,'') in ('DRAFT','COMPLETED','CANCELLED','EXPIRED','ARCHIVED') then 'CLOSED'
        when v_need.response_deadline is not null
             and v_need.response_deadline <= statement_timestamp() then 'CLOSED'
        -- Reuse existing STALE for a current capability/readiness drift. No new
        -- product state is introduced by this safety repair.
        when c.current_profile_status is distinct from 'ACTIVE'
          or char_length(btrim(coalesce(c.current_display_name,''))) < 2
          or char_length(btrim(coalesce(c.current_city,''))) < 2
          or cardinality(coalesce(c.current_skills,'{}'::text[])) < 1
          or c.current_team_capacity is null
          or c.covered_slots > c.current_team_capacity
          or c.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
          or c.current_version is null
          or c.content_hash is null
          or c.version_need_revision is distinct from v_need.revision
          or c.submitted_against_need_revision is distinct from v_need.revision
          or coalesce((c.match_detail->>'responseAllowed')::boolean,false) is not true
          then 'STALE'
        when v_remaining_slots <= 0 then 'FULL'
        when c.covered_slots > v_remaining_slots then 'OVERFILL'
        when c.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then 'SELECTABLE'
        else 'CLOSED'
      end as candidate_state
    from candidate_rows c
$anchor$;
begin
  def:=pg_get_functiondef('public.rpc_list_need_candidates(uuid)'::regprocedure);
  if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'PKG035A_ANCHOR'; end if;
  execute replace(def,anchor,$replacement$      states.candidate_state
    from candidate_rows c
    join private.need_candidate_states_v5(p_need_id) states on states.response_id=c.response_id
$replacement$);
end
$patch$;
do $patch$
declare def text; anchor text:=$anchor$      -- Compatibility count: visible responses, NOT a claim that each is selectable (audit F02).
      -- An owner sees non-drafts; their own response is also visible under responses_worker_read.
      (select count(*) from public.marketplace_responses r where r.need_id = n.id
        and (r.status <> 'DRAFT' or r.worker_account_id = v_uid)) as application_count$anchor$;
begin
  def:=pg_get_functiondef('public.rpc_home_attention()'::regprocedure);
  if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'PKG035A_ANCHOR'; end if;
  execute replace(def,anchor,$replacement$      -- PKG-035: attention means an application the owner can currently select, not history.
      public.selectable_application_count(n)::bigint as application_count$replacement$);
end
$patch$;
do $post$
declare old record; actual record;
begin
  if (select md5(prosrc) from pg_proc where oid='private.need_candidate_states_v5(uuid)'::regprocedure) is distinct from 'dcadbeb34f599c4aad50c499e7fef1c6' then raise exception 'PKG035A_BODY_MISMATCH: private.need_candidate_states_v5(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.selectable_application_count(public.needs)'::regprocedure) is distinct from 'fe53442f8b661d6f33d22a54e2a468a8' then raise exception 'PKG035A_BODY_MISMATCH: public.selectable_application_count(public.needs)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_list_need_candidates(uuid)'::regprocedure) is distinct from '15cb0fd9d891a4ce6d4fdc7ea79abcd1' then raise exception 'PKG035A_BODY_MISMATCH: public.rpc_list_need_candidates(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_home_attention()'::regprocedure) is distinct from '239f2477ae58ec92254edfdeda0455e7' then raise exception 'PKG035A_BODY_MISMATCH: public.rpc_home_attention()'; end if;
  for old in select * from pkg035_before loop
    select proacl,prosecdef,proconfig into actual from pg_proc where oid=old.signature::regprocedure;
    if (actual.proacl,actual.prosecdef,actual.proconfig) is distinct from (old.acl,old.definer,old.config)
      then raise exception 'PKG035A_AUTHORITY_CHANGED'; end if;
    if private.closure_source_digest_v5() is distinct from old.digest or not private.retention_ai_source_ready()
      then raise exception 'PKG035A_CHANGED_CLOSURE_SOURCE'; end if;
  end loop;
end
$post$;
notify pgrst,'reload schema';
commit;
