-- W05 publication admission extends the existing B06/B07 authority.
-- No policy text, active policy, decision, publication, or geographic data is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $w05_predecessors$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_need_write()')) is distinct from '4810335313b6a81666291e20a523f656' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='private.guard_need_write()'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.publication_policy_bundle_ready(uuid,text,timestamptz)')) is distinct from '41c5cb2ae28b4ca275caa3984724f559' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='private.publication_policy_bundle_ready(uuid,text,timestamptz)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.current_publication_policy_bundle(text,text,timestamptz)')) is distinct from '03c1856348fa12dd4d1f9ba7823bede8' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='private.current_publication_policy_bundle(text,text,timestamptz)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_publication_fingerprint_snapshot(uuid)')) is distinct from 'c6dab63a70732d0cb1fcc657baaa2490' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='private.need_publication_fingerprint_snapshot(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)')) is distinct from '5caaa2284e75084ce682d96ebc759a77' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)')) is distinct from 'bf84266913d3c1f4e06257c7a037abfc' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)')) is distinct from 'd4b3fdcd302ced380531fd3b0a0b6efd' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='public.rpc_ai_open_need_edit_conversation_v2(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)')) is distinct from 'c500c41c8f1ac72b4d52412c6227c7d1' then raise exception 'W05_PREDECESSOR_DRIFT' using detail='public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'; end if;
end;
$w05_predecessors$;

create function private.publication_policy_document(p_bundle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $w05$
declare b private.publication_policy_bundles; r record; head jsonb; item jsonb; rules jsonb:='[]';
  result jsonb; n integer:=0; v text; seen text[]; has_outcome boolean:=false;
begin
  select * into b from private.publication_policy_bundles where id=p_bundle_id;
  if not found then return null; end if;
  head:=b.review_provenance->'evaluatorPolicy';
  if jsonb_typeof(head) is distinct from 'object' or head-ARRAY['schemaVersion','instructions']<>'{}'::jsonb
    or not(head ?& ARRAY['schemaVersion','instructions']) or head->>'schemaVersion'<>'USKOCI_PUBLICATION_POLICY_V1'
    or jsonb_typeof(head->'instructions') is distinct from 'string'
    or char_length(head->>'instructions') not between 1 and 8000 or btrim(head->>'instructions')=''
    or translate(head->>'instructions',chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]'
    or octet_length(b.review_provenance::text)>65536 then return null; end if;
  for r in select rule_id,rule_provenance from private.publication_policy_rule_refs where bundle_id=p_bundle_id order by rule_id loop
    n:=n+1;item:=r.rule_provenance->'evaluation';
    if n>64 or r.rule_id !~ '^[A-Z][A-Z0-9_-]{0,63}$'
      or jsonb_typeof(item) is distinct from 'object' or item-ARRAY['instructions','outcomes','safeReasonCodes']<>'{}'::jsonb
      or not(item ?& ARRAY['instructions','outcomes','safeReasonCodes'])
      or jsonb_typeof(item->'instructions') is distinct from 'string'
      or char_length(item->>'instructions') not between 1 and 4000 or btrim(item->>'instructions')=''
      or translate(item->>'instructions',chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]'
      or jsonb_typeof(item->'outcomes') is distinct from 'array'
      or jsonb_typeof(item->'safeReasonCodes') is distinct from 'array'
      or octet_length(r.rule_provenance::text)>65536 then return null; end if;
    if jsonb_array_length(item->'outcomes')>4 or jsonb_array_length(item->'safeReasonCodes')>64 then return null; end if;
    has_outcome:=has_outcome or jsonb_array_length(item->'outcomes')>0;
    seen:='{}';
    for result in select value from jsonb_array_elements(item->'outcomes') loop
      v:=result#>>'{}';
      if jsonb_typeof(result)<>'string' or v not in ('ALLOW','CLARIFY','REVIEW','BLOCK') or v=any(seen) then return null; end if;
      seen:=array_append(seen,v);
    end loop;
    seen:='{}';
    for result in select value from jsonb_array_elements(item->'safeReasonCodes') loop
      v:=result#>>'{}';
      if jsonb_typeof(result)<>'string' or v !~ '^[A-Z][A-Z0-9_-]{0,63}$' or v=any(seen) then return null; end if;
      seen:=array_append(seen,v);
    end loop;
    rules:=rules||jsonb_build_array(jsonb_build_object('ruleId',r.rule_id,'instructions',item->>'instructions',
      'outcomes',item->'outcomes','safeReasonCodes',item->'safeReasonCodes'));
  end loop;
  if n<1 or not has_outcome then return null; end if;
  result:=head||jsonb_build_object('rules',rules);
  if octet_length(result::text)>65536 then return null; end if;
  -- Executable content is explicitly bound by its review record. Changing text
  -- while retaining old reviewed flags never implicitly reviews new rules.
  if coalesce(b.review_provenance->>'evaluatorContentSha256','') !~ '^[0-9a-f]{64}$'
    or b.review_provenance->>'evaluatorContentSha256' is distinct from encode(extensions.digest(convert_to(result::text,'UTF8'),'sha256'),'hex') then return null; end if;
  return result;
end;
$w05$;
revoke all on function private.publication_policy_document(uuid) from public,anon,authenticated,service_role;

create function private.need_publication_location_readiness(p_need_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $w05$
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
$w05$;
revoke all on function private.need_publication_location_readiness(uuid) from public,anon,authenticated,service_role;

-- Private common context owner. Policy/config table SHARE locks include insert
-- phantoms and always precede the Need lock. Existing child rows are locked too;
-- the parent FOR UPDATE also blocks insertion of a missing FK-bound child row.
create function private.need_publication_context(p_need_id uuid,p_expected_revision integer,p_owner uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $w05$
declare n public.needs; geo jsonb; loc jsonb; result jsonb; fp jsonb; b private.publication_policy_bundles;
  policy jsonb; policy_hash text; refs jsonb; conditions text[]; market private.location_market_configs;
begin
  if p_need_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'PUBLICATION_ID_REVISION_REQUIRED' using errcode='22023'; end if;
  lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
  select * into n from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if p_owner is not null and n.requester_account_id<>p_owner then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if n.status<>'DRAFT' then raise exception 'NEED_NOT_DRAFT' using errcode='P0001'; end if;
  if n.revision<>p_expected_revision then raise exception 'NEED_REVISION_STALE' using errcode='40001'; end if;
  perform 1 from public.need_geography where need_id=p_need_id for share;
  perform 1 from public.need_sensitive where need_id=p_need_id for share;
  perform 1 from public.need_requirement_details where need_id=p_need_id for share;
  result:=jsonb_build_object('kind','NOT_READY','needId',p_need_id,'needRevision',n.revision,'authoritativeDecision',false);
  select * into market from private.location_market_configs where country_code=n.task_country_code;
  if not found or market.product_status not in ('BUILDING','LIVE') or n.task_timezone is distinct from market.default_timezone then
    return result||jsonb_build_object('code','COUNTRY_NOT_READY'); end if;
  loc:=private.need_publication_location_readiness(p_need_id);
  if (loc->>'complete')::boolean is distinct from true then return result||jsonb_build_object('code','LOCATION_INCOMPLETE','missingSlots',loc->'missingSlots'); end if;
  if cardinality(coalesce(n.public_photo_paths,'{}'::text[]))>0 then return result||jsonb_build_object('code','PUBLIC_MEDIA_NOT_READY'); end if;
  select * into b from private.publication_policy_bundles where id=private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM',n.task_country_code,clock_timestamp());
  if not found then return result||jsonb_build_object('code','POLICY_NOT_READY'); end if;
  policy:=private.publication_policy_document(b.id);
  if policy is null then return result||jsonb_build_object('code','POLICY_CONTENT_NOT_READY'); end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.rule_id),'[]'::jsonb) into refs from private.publication_policy_rule_refs r where bundle_id=b.id;
  policy_hash:=encode(extensions.digest(convert_to(jsonb_build_object('bundle',to_jsonb(b),'ruleRefs',refs,'policy',policy)::text,'UTF8'),'sha256'),'hex');
  fp:=private.need_publication_fingerprint_snapshot(p_need_id);
  select public_topology into geo from public.need_geography where need_id=p_need_id;
  select critical_conditions into conditions from public.need_requirement_details where need_id=p_need_id;
  return jsonb_build_object('kind','READY','needId',p_need_id,'needRevision',n.revision,'authoritativeDecision',false,
    'binding',jsonb_build_object('needId',p_need_id,'needRevision',n.revision,'schemaVersion',fp->>'schemaVersion',
      'canonicalFingerprint',fp->>'canonicalFingerprint','privateMaterialityMarker',fp->>'privateMaterialityMarker',
      'taskCountryCode',n.task_country_code,'taskTimezone',n.task_timezone,'policyBundleId',b.id,'policyId',b.policy_id,
      'policyVersion',b.version,'jurisdiction',b.jurisdiction,'policyContentSha256',policy_hash),
    'publicNeed',jsonb_build_object('title',n.title,'description',n.description,'category',n.category,
      'scheduleKind',n.schedule_kind,'startsAt',n.starts_at,'endsAt',n.ends_at,'requiredSlots',n.required_slots,
      'priceMode',n.mode,'requesterPriceRsd',n.requester_price_rsd,'requiredSkills',to_jsonb(coalesce(n.required_skills,'{}'::text[])),
      'requiredTools',to_jsonb(coalesce(n.required_tools,'{}'::text[])),'requiredVehicles',to_jsonb(coalesce(n.required_vehicles,'{}'::text[])),
      'requiredLicenses',to_jsonb(coalesce(n.required_licenses,'{}'::text[])),'minimumExperienceYears',n.minimum_experience_years,
      'verifiedIdentityRequired',coalesce(n.verified_identity_required,false),'criticalConditions',to_jsonb(coalesce(conditions,'{}'::text[])),
      'publicGeography',fp->'publicGeography','publicMediaRefs',fp->'publicMediaRefs'),'location',loc,'policy',policy);
end;
$w05$;
revoke all on function private.need_publication_context(uuid,integer,uuid) from public,anon,authenticated,service_role;

create function public.rpc_get_need_publication_context(p_need_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $w05$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  return private.need_publication_context(p_need_id,p_expected_revision,auth.uid());
end;
$w05$;
revoke all on function public.rpc_get_need_publication_context(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_need_publication_context(uuid,integer) to authenticated;

create temporary table w05_predecessor_acl on commit drop as select oid,proacl from pg_proc where oid in (to_regprocedure('private.guard_need_write()'),to_regprocedure('public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'),to_regprocedure('public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)'),to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)'),to_regprocedure('public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'));


-- Existing conversation carries a server-originated base context for DRAFT
-- corrections. Historical and ordinary intake conversations retain NULL.
alter table public.ai_conversations add column need_edit_base_fingerprint text
  check(need_edit_base_fingerprint is null or need_edit_base_fingerprint ~ '^[0-9a-f]{64}$');

create function private.need_edit_base_marker(p_need_id uuid)
returns text language sql stable security definer set search_path=pg_catalog as $w05$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'fingerprint',private.need_publication_fingerprint_snapshot(n.id)->>'canonicalFingerprint',
    'taskCountryCode',n.task_country_code,'taskTimezone',n.task_timezone
  )::text,'UTF8'),'sha256'),'hex') from public.needs n where n.id=p_need_id;
$w05$;
revoke all on function private.need_edit_base_marker(uuid) from public,anon,authenticated,service_role;

create function private.guard_need_edit_base_marker()
returns trigger language plpgsql security definer set search_path=pg_catalog as $w05$
declare n public.needs;
begin
  if tg_op='UPDATE' then
    if new.need_edit_base_fingerprint is distinct from old.need_edit_base_fingerprint
       or (old.need_edit_base_fingerprint is not null and (
         new.bound_need_id is distinct from old.bound_need_id or new.account_id is distinct from old.account_id
         or new.purpose is distinct from old.purpose or new.fact_schema_version is distinct from old.fact_schema_version)) then
      raise exception 'EDIT_BASE_CONTEXT_SERVER_OWNED' using errcode='42501';
    end if;
    return new;
  end if;
  if new.need_edit_base_fingerprint is not null then raise exception 'EDIT_BASE_CONTEXT_SERVER_OWNED' using errcode='42501'; end if;
  if new.bound_need_id is not null and new.purpose='NEED_INTAKE' and new.fact_schema_version='NEED_FACT_V2' then
    select * into n from public.needs where id=new.bound_need_id for update;
    if found and n.status='DRAFT' then
      if auth.uid() is null or n.requester_account_id is distinct from auth.uid() or new.account_id is distinct from auth.uid()
         or new.status<>'OPEN' then raise exception 'EDIT_BASE_CONTEXT_SERVER_OWNED' using errcode='42501'; end if;
      perform 1 from public.need_geography where need_id=n.id for share;
      perform 1 from public.need_sensitive where need_id=n.id for share;
      perform 1 from public.need_requirement_details where need_id=n.id for share;
      new.need_edit_base_fingerprint:=private.need_edit_base_marker(n.id);
    end if;
  end if;
  return new;
end;
$w05$;
revoke all on function private.guard_need_edit_base_marker() from public,anon,authenticated,service_role;
create trigger guard_need_edit_base_marker_trg before insert or update on public.ai_conversations
for each row execute function private.guard_need_edit_base_marker();


-- Preserves owner from 20260904103000_clean_ru3_need_publication_decision.sql
create or replace function public.rpc_record_need_publication_decision_service(
  p_need_id uuid,
  p_expected_revision integer,
  p_policy_id text,
  p_jurisdiction text,
  p_outcome text,
  p_rule_ids text[],
  p_decision_source text,
  p_safe_reason_codes text[] default '{}'::text[],
  p_provider_ref text default null,
  p_model_ref text default null,
  p_reviewer_provenance jsonb default '{}'::jsonb,
  p_service_provenance jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_need public.needs%rowtype;
  v_bundle_id uuid;
  v_policy_id text;
  v_policy_version integer;
  v_jurisdiction text;
  v_rule_ids text[];
  v_safe_reason_codes text[];
  v_rule_count integer;
  v_rule_snapshot jsonb;
  v_fp jsonb;
  v_identity_payload jsonb;
  v_identity text;
  v_decision_id uuid;
  v_sequence bigint;
  v_context jsonb;
  v_decision_at timestamptz;
begin
  if p_need_id is null or p_expected_revision is null then
    raise exception 'DECISION_NEED_REVISION_REQUIRED' using errcode='22004';
  end if;
  if coalesce(btrim(p_policy_id), '') = ''
     or coalesce(btrim(p_jurisdiction), '') = '' then
    raise exception 'POLICY_ID_JURISDICTION_REQUIRED' using errcode='22023';
  end if;
  if p_outcome is null or p_outcome not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then
    raise exception 'DECISION_OUTCOME_INVALID' using errcode='22023';
  end if;
  if p_decision_source is distinct from 'PUBLICATION_EVALUATOR_V1' then
    raise exception 'DECISION_SOURCE_REQUIRED' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(p_reviewer_provenance, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_service_provenance, 'null'::jsonb)) <> 'object'
     or coalesce(p_service_provenance, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'DECISION_PROVENANCE_INVALID' using errcode='22023';
  end if;

  if p_rule_ids is null or cardinality(p_rule_ids) not between 1 and 64 or array_ndims(p_rule_ids)<>1
     or exists(select 1 from unnest(p_rule_ids) r where r is null or r !~ '^[A-Z][A-Z0-9_-]{0,63}$')
     or (select count(distinct r) from unnest(p_rule_ids) r)<>cardinality(p_rule_ids)
     or p_safe_reason_codes is null or cardinality(p_safe_reason_codes)>64 or coalesce(array_ndims(p_safe_reason_codes),1)<>1
     or exists(select 1 from unnest(p_safe_reason_codes) r where r is null or r !~ '^[A-Z][A-Z0-9_-]{0,63}$')
     or (select count(distinct r) from unnest(p_safe_reason_codes) r)<>cardinality(p_safe_reason_codes)
     or octet_length(p_service_provenance::text)>65536 or octet_length(p_reviewer_provenance::text)>8192 then
    raise exception 'DECISION_OUTPUT_INVALID' using errcode='22023';
  end if;
  v_context:=private.need_publication_context(p_need_id,p_expected_revision,null);
  if v_context->>'kind'<>'READY' then raise exception 'PUBLICATION_CONTEXT_NOT_READY' using errcode='P0001',detail=v_context->>'code'; end if;
  if p_service_provenance is distinct from jsonb_build_object('evaluationContext',v_context->'binding') then
    raise exception 'PUBLICATION_CONTEXT_STALE' using errcode='40001';
  end if;
  if p_policy_id is distinct from v_context#>>'{binding,policyId}' or p_jurisdiction is distinct from v_context#>>'{binding,jurisdiction}' then
    raise exception 'PUBLICATION_POLICY_STALE' using errcode='40001';
  end if;
  if exists(select 1 from unnest(p_rule_ids) id where not exists(
       select 1 from jsonb_array_elements(v_context#>'{policy,rules}') r where r->>'ruleId'=id and (r->'outcomes') ? p_outcome))
     or exists(select 1 from unnest(p_safe_reason_codes) code where not exists(
       select 1 from jsonb_array_elements(v_context#>'{policy,rules}') r where r->>'ruleId'=any(p_rule_ids) and (r->'safeReasonCodes') ? code)) then
    raise exception 'DECISION_OUTPUT_NOT_IN_POLICY' using errcode='22023';
  end if;

  select * into v_need
    from public.needs
   where id = p_need_id
   for update;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.status <> 'DRAFT' then
    raise exception 'NEED_NOT_DRAFT' using errcode='P0001';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;

  if not exists (
    select 1 from public.need_geography g
     where g.need_id = p_need_id
       and jsonb_typeof(g.public_topology) = 'object'
  ) then
    raise exception 'PUBLIC_GEOGRAPHY_NOT_CANONICAL' using errcode='P0001';
  end if;

  if cardinality(coalesce(v_need.public_photo_paths, '{}'::text[])) > 0 then
    raise exception 'PUBLIC_MEDIA_REVIEW_AUTHORITY_NOT_READY' using errcode='P0001';
  end if;

  v_bundle_id := private.current_publication_policy_bundle(
    btrim(p_policy_id),
    btrim(p_jurisdiction),
    clock_timestamp()
  );
  if v_bundle_id is null then
    raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;

  select b.policy_id, b.version, b.jurisdiction
    into v_policy_id, v_policy_version, v_jurisdiction
    from private.publication_policy_bundles b
   where b.id = v_bundle_id;

  select coalesce(array_agg(x.rule_id order by x.rule_id), '{}'::text[])
    into v_rule_ids
    from (
      select distinct btrim(rid) as rule_id
        from unnest(coalesce(p_rule_ids, '{}'::text[])) rid
       where btrim(rid) <> ''
    ) x;

  if cardinality(v_rule_ids) = 0 then
    raise exception 'RULE_PROVENANCE_REQUIRED' using errcode='22023';
  end if;

  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'ruleId', r.rule_id,
               'provenance', r.rule_provenance
             ) order by r.rule_id
           ),
           '[]'::jsonb
         )
    into v_rule_count, v_rule_snapshot
    from private.publication_policy_rule_refs r
   where r.bundle_id = v_bundle_id
     and r.rule_id = any(v_rule_ids);

  if v_rule_count <> cardinality(v_rule_ids) then
    raise exception 'RULE_PROVENANCE_MISMATCH' using errcode='P0001';
  end if;

  select coalesce(array_agg(x.reason_code order by x.reason_code), '{}'::text[])
    into v_safe_reason_codes
    from (
      select distinct btrim(rc) as reason_code
        from unnest(coalesce(p_safe_reason_codes, '{}'::text[])) rc
       where btrim(rc) <> ''
    ) x;

  v_fp := private.need_publication_fingerprint_snapshot(p_need_id);
  if (v_fp->>'needRevision')::integer <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;

  v_identity_payload := jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_expected_revision,
    'canonicalFingerprint', v_fp->>'canonicalFingerprint',
    'policyBundleId', v_bundle_id,
    'policyId', v_policy_id,
    'policyVersion', v_policy_version,
    'jurisdiction', v_jurisdiction,
    'ruleIds', to_jsonb(v_rule_ids),
    'outcome', p_outcome,
    'safeReasonCodes', to_jsonb(v_safe_reason_codes),
    'decisionSource', btrim(p_decision_source),
    'providerRef', nullif(btrim(coalesce(p_provider_ref,'')),''),
    'modelRef', nullif(btrim(coalesce(p_model_ref,'')),''),
    'reviewerProvenance', p_reviewer_provenance,
    'serviceProvenance', p_service_provenance
  );
  v_identity := encode(
    extensions.digest(convert_to(v_identity_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  if not private.publication_policy_bundle_ready(v_bundle_id,v_jurisdiction,clock_timestamp()) then raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001'; end if;

  insert into private.need_publication_decisions(
    need_id,
    need_revision,
    fingerprint_schema_version,
    canonical_fingerprint,
    private_materiality_marker,
    public_geography_snapshot,
    public_media_refs,
    policy_bundle_id,
    policy_id,
    policy_version,
    jurisdiction,
    rule_ids,
    rule_provenance_snapshot,
    outcome,
    safe_reason_codes,
    decision_source,
    provider_ref,
    model_ref,
    reviewer_provenance,
    service_provenance,
    decision_identity
  ) values (
    p_need_id,
    p_expected_revision,
    'NEED_PUBLICATION_FINGERPRINT_V1',
    v_fp->>'canonicalFingerprint',
    v_fp->>'privateMaterialityMarker',
    v_fp->'publicGeography',
    array(select jsonb_array_elements_text(v_fp->'publicMediaRefs')),
    v_bundle_id,
    v_policy_id,
    v_policy_version,
    v_jurisdiction,
    v_rule_ids,
    v_rule_snapshot,
    p_outcome,
    v_safe_reason_codes,
    btrim(p_decision_source),
    nullif(btrim(coalesce(p_provider_ref,'')),''),
    nullif(btrim(coalesce(p_model_ref,'')),''),
    p_reviewer_provenance,
    p_service_provenance,
    v_identity
  )
  on conflict (decision_identity) do nothing
  returning id, decision_sequence, created_at into v_decision_id, v_sequence, v_decision_at;

  if v_decision_id is null then
    select d.id, d.decision_sequence, d.created_at
      into v_decision_id, v_sequence, v_decision_at
      from private.need_publication_decisions d
     where d.decision_identity = v_identity;
  end if;

  return jsonb_build_object(
    'decisionId', v_decision_id,
    'decisionSequence', v_sequence,
    'needId', p_need_id,
    'needRevision', p_expected_revision,
    'canonicalFingerprint', v_fp->>'canonicalFingerprint',
    'policyBundleId', v_bundle_id,
    'policyVersion', v_policy_version,
    'jurisdiction', v_jurisdiction,
    'outcome', p_outcome,
    'decisionAt', v_decision_at,
    'ruleIds', to_jsonb(v_rule_ids),
    'safeReasonCodes', to_jsonb(v_safe_reason_codes),
    'publishable', p_outcome='ALLOW',
    'authoritative', true
  );
end;
$$;

-- Preserves owner from 20260904111500_clean_ru3_canonical_publish.sql
create or replace function public.rpc_publish_need_canonical(
  p_need_id uuid,
  p_expected_revision integer,
  p_decision_sequence bigint,
  p_response_deadline timestamptz,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_request_payload jsonb;
  v_request_hash text;
  v_existing private.need_publish_commands%rowtype;
  v_need public.needs%rowtype;
  v_decision private.need_publication_decisions%rowtype;
  v_bundle private.publication_policy_bundles%rowtype;
  v_fp jsonb;
  v_context jsonb;
  v_public_media text[];
  v_rule_count integer;
  v_rule_snapshot jsonb;
  v_result jsonb;
  v_now timestamptz := statement_timestamp();
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_need_id is null or p_expected_revision is null or p_decision_sequence is null then
    raise exception 'PUBLISH_ID_REVISION_DECISION_REQUIRED' using errcode='22004';
  end if;
  if p_expected_revision <= 0 or p_decision_sequence <= 0 then
    raise exception 'PUBLISH_REVISION_DECISION_INVALID' using errcode='22023';
  end if;
  if char_length(v_request_id) < 8 or char_length(v_request_id) > 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  v_request_payload := jsonb_build_object(
    'needId', p_need_id,
    'expectedRevision', p_expected_revision,
    'decisionSequence', p_decision_sequence,
    'responseDeadline', p_response_deadline
  );
  v_request_hash := encode(
    extensions.digest(convert_to(v_request_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || E'\n' || v_request_id, 0)
  );

  select * into v_existing
    from private.need_publish_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if p_response_deadline is not null and p_response_deadline <= clock_timestamp() then
    raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023';
  end if;

  -- A recorded successful command is returned above even after its deadline or
  -- policy expiry; a new command must satisfy the entire current context.
  v_context:=private.need_publication_context(p_need_id,p_expected_revision,v_actor);
  if v_context->>'kind'<>'READY' then raise exception 'PUBLICATION_CONTEXT_NOT_READY' using errcode='P0001',detail=v_context->>'code'; end if;

  select * into v_need
    from public.needs n
   where n.id = p_need_id
   for update;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception 'NEED_NOT_OWNED' using errcode='42501';
  end if;
  if v_need.status <> 'DRAFT' then
    raise exception 'NEED_NOT_DRAFT' using errcode='P0001';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;

  v_fp := private.need_publication_fingerprint_snapshot(p_need_id);
  if (v_fp->>'needRevision')::integer <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;
  v_public_media := array(
    select jsonb_array_elements_text(v_fp->'publicMediaRefs')
  );

  select * into v_decision
    from private.need_publication_decisions d
   where d.decision_sequence = p_decision_sequence;
  if not found then
    raise exception 'PUBLICATION_DECISION_NOT_FOUND' using errcode='P0002';
  end if;
  if v_decision.need_id <> p_need_id
     or v_decision.need_revision <> p_expected_revision then
    raise exception 'PUBLICATION_DECISION_SCOPE_MISMATCH' using errcode='P0001';
  end if;
  if v_decision.service_provenance->'evaluationContext' is distinct from v_context->'binding' then
    raise exception 'PUBLICATION_DECISION_CONTEXT_STALE' using errcode='40001';
  end if;
  if v_decision.canonical_fingerprint <> v_fp->>'canonicalFingerprint'
     or v_decision.private_materiality_marker <> v_fp->>'privateMaterialityMarker'
     or v_decision.public_geography_snapshot is distinct from v_fp->'publicGeography'
     or v_decision.public_media_refs is distinct from v_public_media then
    raise exception 'PUBLICATION_DECISION_FINGERPRINT_STALE' using errcode='P0001';
  end if;

  if exists (
    select 1
      from private.need_publication_decisions newer
     where newer.need_id = p_need_id
       and newer.need_revision = p_expected_revision
       and newer.decision_sequence > v_decision.decision_sequence
  ) then
    raise exception 'PUBLICATION_DECISION_STALE' using errcode='P0001';
  end if;

  if v_decision.outcome <> 'ALLOW' then
    raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='P0001';
  end if;

  if not private.publication_policy_bundle_ready(
       v_decision.policy_bundle_id,
       v_decision.jurisdiction,
       v_now
     ) then
    raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;

  if private.current_publication_policy_bundle(
       v_decision.policy_id,
       v_decision.jurisdiction,
       v_now
     ) is distinct from v_decision.policy_bundle_id then
    raise exception 'PUBLICATION_POLICY_STALE' using errcode='P0001';
  end if;

  select * into v_bundle
    from private.publication_policy_bundles b
   where b.id = v_decision.policy_bundle_id;
  if not found
     or v_bundle.policy_id <> v_decision.policy_id
     or v_bundle.version <> v_decision.policy_version
     or v_bundle.jurisdiction <> v_decision.jurisdiction then
    raise exception 'PUBLICATION_POLICY_PROVENANCE_MISMATCH' using errcode='P0001';
  end if;

  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'ruleId', r.rule_id,
               'provenance', r.rule_provenance
             ) order by r.rule_id
           ),
           '[]'::jsonb
         )
    into v_rule_count, v_rule_snapshot
    from private.publication_policy_rule_refs r
   where r.bundle_id = v_decision.policy_bundle_id
     and r.rule_id = any(v_decision.rule_ids);

  if v_rule_count <> cardinality(v_decision.rule_ids)
     or v_rule_snapshot is distinct from v_decision.rule_provenance_snapshot then
    raise exception 'PUBLICATION_POLICY_RULE_PROVENANCE_STALE' using errcode='P0001';
  end if;

  if not private.publication_policy_bundle_ready(v_decision.policy_bundle_id,v_decision.jurisdiction,clock_timestamp()) then raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001'; end if;
  if p_response_deadline is not null and p_response_deadline<=clock_timestamp() then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;

  perform set_config('uskoci.need_lifecycle', 'PUBLISH', true);
  update public.needs n
     set status = 'PUBLISHED',
         published_at = v_now,
         response_deadline = p_response_deadline
   where n.id = p_need_id
     and n.status = 'DRAFT'
     and n.revision = p_expected_revision
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then
    raise exception 'NEED_PUBLISH_CONFLICT' using errcode='40001';
  end if;

  if not exists (
    select 1 from private.dispatch_schedule s where s.need_id = p_need_id
  ) then
    raise exception 'DISPATCH_SCHEDULE_MISSING' using errcode='P0001';
  end if;

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'status', v_need.status,
    'publishedAt', v_need.published_at,
    'responseDeadline', v_need.response_deadline,
    'idempotentReplay', false
  );

  insert into private.need_publish_commands(
    requester_account_id,
    client_request_id,
    request_hash,
    need_id,
    expected_revision,
    decision_id,
    decision_sequence,
    canonical_fingerprint,
    policy_bundle_id,
    response_deadline,
    result
  ) values (
    v_actor,
    v_request_id,
    v_request_hash,
    p_need_id,
    p_expected_revision,
    v_decision.id,
    v_decision.decision_sequence,
    v_decision.canonical_fingerprint,
    v_decision.policy_bundle_id,
    p_response_deadline,
    v_result
  );

  return v_result;
end;
$$;

-- Preserves owner from 20260910121926_clean_w02_regional_country_authority.sql
create or replace function private.guard_need_write()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  token text := current_setting('uskoci.need_lifecycle', true);
  material boolean;
begin
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
$$;

-- Preserves owner from 20260910130851_clean_w02_resolved_location_authority.sql
create or replace function public.rpc_ai_open_need_edit_conversation_v2(p_need_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_uid uuid:=auth.uid();
  v_need public.needs%rowtype;
  v_sensitive public.need_sensitive%rowtype;
  v_geo jsonb;
  v_conditions text[]:='{}'::text[];
  v_conversation_id uuid;
  v_key text;
  v_type text;
  v_value jsonb;
  v_display text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null then raise exception 'NEED_ID_REQUIRED' using errcode='22004'; end if;

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.status not in ('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  perform 1 from public.need_geography where need_id=v_need.id for share;
  perform 1 from public.need_requirement_details where need_id=v_need.id for share;
  select * into v_sensitive from public.need_sensitive where need_id=v_need.id for share;
  select g.public_topology into v_geo from public.need_geography g where g.need_id=v_need.id;
  select coalesce(d.critical_conditions,'{}'::text[]) into v_conditions
    from public.need_requirement_details d where d.need_id=v_need.id;
  if not found then v_conditions:='{}'::text[]; end if;

  if v_geo is null then
    if v_need.execution_location_mode='REMOTE' then
      v_geo:=jsonb_build_object('mode','REMOTE','start',null,'end',null,'waypoints','[]'::jsonb,'serviceArea',null);
    else
      raise exception 'NEED_EDIT_GEOGRAPHY_NOT_READY' using errcode='P0001';
    end if;
  end if;
  perform private.validate_need_v2_fact('need.task_geography',v_geo);

  insert into public.ai_conversations(account_id,purpose,status,bound_need_id,fact_schema_version)
  values(v_uid,'NEED_INTAKE','OPEN',v_need.id,'NEED_FACT_V2')
  returning id into v_conversation_id;

  for v_key,v_type in
    select fact_key,value_type from private.need_fact_registry
     where schema_version='NEED_FACT_V2'
     order by fact_key
  loop
    v_value:=null;
    v_display:=null;

    case v_key
      when 'need.title' then v_value:=to_jsonb(v_need.title); v_display:=v_need.title;
      when 'need.description' then v_value:=to_jsonb(v_need.description); v_display:=v_need.description;
      when 'need.category' then v_value:=to_jsonb(v_need.category); v_display:=v_need.category;
      when 'need.price_mode' then v_value:=to_jsonb(v_need.mode); v_display:=v_need.mode;
      when 'need.price_rsd' then
        if v_need.requester_price_rsd is not null then v_value:=to_jsonb(v_need.requester_price_rsd); v_display:=v_need.requester_price_rsd::text||' RSD'; end if;
      when 'need.schedule_kind' then v_value:=to_jsonb(v_need.schedule_kind); v_display:=v_need.schedule_kind;
      when 'need.starts_at' then
        if v_need.starts_at is not null then v_value:=to_jsonb(v_need.starts_at::text); v_display:=v_need.starts_at::text; end if;
      when 'need.ends_at' then
        if v_need.ends_at is not null then v_value:=to_jsonb(v_need.ends_at::text); v_display:=v_need.ends_at::text; end if;
      when 'need.people_needed' then v_value:=to_jsonb(v_need.required_slots); v_display:=v_need.required_slots::text;
      when 'need.required_skills' then v_value:=to_jsonb(coalesce(v_need.required_skills,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_skills,'{}'::text[]),', ');
      when 'need.required_tools' then v_value:=to_jsonb(coalesce(v_need.required_tools,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_tools,'{}'::text[]),', ');
      when 'need.required_vehicles' then v_value:=to_jsonb(coalesce(v_need.required_vehicles,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_vehicles,'{}'::text[]),', ');
      when 'need.required_licenses' then v_value:=to_jsonb(coalesce(v_need.required_licenses,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_licenses,'{}'::text[]),', ');
      when 'need.minimum_experience_years' then
        if v_need.minimum_experience_years is not null then v_value:=to_jsonb(v_need.minimum_experience_years); v_display:=v_need.minimum_experience_years::text; end if;
      when 'need.verified_identity_required' then v_value:=to_jsonb(coalesce(v_need.verified_identity_required,false)); v_display:=case when coalesce(v_need.verified_identity_required,false) then 'Da' else 'Ne' end;
      when 'need.task_country_code' then
        if v_need.task_country_code is not null then v_value:=to_jsonb(v_need.task_country_code); v_display:=v_need.task_country_code; end if;
      when 'need.task_geography' then v_value:=v_geo; v_display:=coalesce(v_geo->'start'->>'label',v_geo->'serviceArea'->>'label',v_geo->>'mode');
      when 'need.critical_conditions' then v_value:=to_jsonb(v_conditions); v_display:=array_to_string(v_conditions,', ');
      when 'need.public_photo_paths' then v_value:=to_jsonb(coalesce(v_need.public_photo_paths,'{}'::text[])); v_display:=case when cardinality(coalesce(v_need.public_photo_paths,'{}'::text[]))=0 then 'Bez fotografija' else cardinality(v_need.public_photo_paths)::text||' fotografija' end;
      when 'need.exact_address' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.exact_address),'') is not null then v_value:=to_jsonb(v_sensitive.exact_address); v_display:=v_sensitive.exact_address; end if;
      when 'need.access_notes' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.access_notes),'') is not null then v_value:=to_jsonb(v_sensitive.access_notes); v_display:=v_sensitive.access_notes; end if;
      else null;
    end case;

    if v_value is not null and v_value<>'null'::jsonb then
      perform private.validate_need_v2_fact(v_key,v_value);
      insert into public.ai_structured_facts(
        account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
        confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
        fact_schema_version,value_type,display_value
      ) values (
        v_uid,v_conversation_id,v_need.id,v_key,v_value,'CONFIRMED','SYSTEM_DERIVED','NEED_DRAFT',
        1,null,v_uid,statement_timestamp(),'NEED_FACT_V2',v_type,
        coalesce(nullif(left(v_display,1000),''),'—')
      );
    end if;
  end loop;

  -- Clone the already-confirmed private value last, after its public binding facts.
  -- Preserve the original human's provenance; do not manufacture a new confirmation.
  if v_sensitive.resolved_location is not null then
    if private.resolved_location_record_valid(v_sensitive.resolved_location,v_need.task_country_code,v_geo,
      v_sensitive.exact_address,v_uid) is distinct from true then
      raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
    insert into public.ai_structured_facts(account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(v_uid,v_conversation_id,v_need.id,'need.resolved_location',v_sensitive.resolved_location->'value','CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',
      1,null,(v_sensitive.resolved_location->>'confirmedByAccountId')::uuid,(v_sensitive.resolved_location->>'confirmedAt')::timestamptz,
      'NEED_FACT_V2','OBJECT','Potvrđene tačke: '||jsonb_array_length(v_sensitive.resolved_location#>'{value,points}')::text);
  end if;

  return jsonb_build_object(
    'conversationId',v_conversation_id,
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'authoritative',true
  );
end;
$$;

-- Preserves owner from 20260910130851_clean_w02_resolved_location_authority.sql
create or replace function public.rpc_confirm_need_edit_from_review(
  p_need_id uuid,
  p_expected_revision integer,
  p_conversation_id uuid,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
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
$$;

-- Existing CREATE OR REPLACE definitions preserve their ACLs. New helper ACLs
-- are explicitly closed; the authenticated context RPC is the only new surface.
do $w05_postconditions$
begin
  if exists(select 1 from w05_predecessor_acl old left join pg_proc p on p.oid=old.oid where p.oid is null or p.proacl is distinct from old.proacl) then raise exception 'W05_PREDECESSOR_ACL_CHANGED'; end if;
  if not has_function_privilege('authenticated','public.rpc_get_need_publication_context(uuid,integer)','EXECUTE')
    or has_function_privilege('anon','public.rpc_get_need_publication_context(uuid,integer)','EXECUTE')
    or has_function_privilege('service_role','public.rpc_get_need_publication_context(uuid,integer)','EXECUTE') then raise exception 'W05_CONTEXT_ACL_INVALID'; end if;
  if not has_function_privilege('service_role','public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)','EXECUTE') then raise exception 'W05_DECISION_ACL_INVALID'; end if;
  if not has_function_privilege('authenticated','public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)','EXECUTE')
    or has_function_privilege('anon','public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)','EXECUTE')
    or has_function_privilege('service_role','public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)','EXECUTE') then raise exception 'W05_PUBLISH_ACL_INVALID'; end if;
  if has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text)','EXECUTE') then raise exception 'W05_EDIT_ACL_INVALID'; end if;
end;
$w05_postconditions$;
commit;
