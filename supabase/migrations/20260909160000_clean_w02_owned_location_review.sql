-- W02 location: manual confirmed input uses the EXISTING V2 fact/review/draft
-- authority. No second geography model, geocoder, GPS requirement or publication.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
begin
  if to_regclass('public.need_geography') is null
    or to_regclass('public.need_sensitive') is null
    or to_regprocedure('private.worker_availability_document(uuid)') is null
    or to_regprocedure('private.validate_need_v2_fact(text,jsonb)') is null then
    raise exception 'W02_LOCATION_PREDECESSOR_MISSING';
  end if;
end;
$preflight$;

create function private.location_text_valid(value jsonb, max_length integer)
returns boolean language sql immutable set search_path=pg_catalog
as $f$
  select jsonb_typeof(value)='string' and length(btrim(value#>>'{}')) between 1 and max_length
    and not (value#>>'{}' ~ '[[:cntrl:]]');
$f$;
revoke all on function private.location_text_valid(jsonb,integer) from public,anon,authenticated,service_role;

create function private.location_private_text_valid(value jsonb, max_length integer)
returns boolean language sql immutable set search_path=pg_catalog
as $f$
  select jsonb_typeof(value)='string' and length(btrim(value#>>'{}')) between 1 and max_length
    and not (translate(value#>>'{}',chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]');
$f$;
revoke all on function private.location_private_text_valid(jsonb,integer) from public,anon,authenticated,service_role;

create function private.normalize_location_point(value jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog
as $f$
declare k text; result jsonb:='{}';
begin
  if value is null or value='null'::jsonb then return null; end if;
  if jsonb_typeof(value) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  if value-ARRAY['city','area','label']<>'{}'::jsonb or value='{}'::jsonb then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  foreach k in array ARRAY['city','area','label'] loop
    if value ? k then
      if private.location_text_valid(value->k,case k when 'label' then 240 else 160 end) is distinct from true then
        raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
      end if;
      result:=result||jsonb_build_object(k,btrim(value->>k));
    end if;
  end loop;
  return result;
end;
$f$;
revoke all on function private.normalize_location_point(jsonb) from public,anon,authenticated,service_role;

create function private.normalize_task_geography(value jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog
as $f$
declare mode text; a jsonb; b jsonb; area jsonb; points jsonb:='[]'; item jsonb; result jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  if value-ARRAY['mode','start','end','waypoints','serviceArea']<>'{}'::jsonb
    or jsonb_typeof(value->'mode') is distinct from 'string' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  mode:=value->>'mode';
  if mode not in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE') then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  a:=private.normalize_location_point(value->'start');
  b:=private.normalize_location_point(value->'end');
  area:=private.normalize_location_point(value->'serviceArea');
  if value->'waypoints' is not null and value->'waypoints'<>'null'::jsonb then
    if jsonb_typeof(value->'waypoints') is distinct from 'array' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    if jsonb_array_length(value->'waypoints')>20 then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    for item in select x from jsonb_array_elements(value->'waypoints') x loop
      item:=private.normalize_location_point(item);
      if item is null then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
      points:=points||jsonb_build_array(item);
    end loop;
  end if;
  if (mode='REMOTE' and (a is not null or b is not null or area is not null or points<>'[]'::jsonb))
    or (mode='STATIONARY' and (a is null or b is not null or area is not null or points<>'[]'::jsonb))
    or (mode='POINT_TO_POINT' and (a is null or b is null or area is not null or points<>'[]'::jsonb))
    or (mode='MULTI_STOP' and (a is null or area is not null or (b is null and points='[]'::jsonb)))
    or (mode='AREA_BASED' and (b is not null or points<>'[]'::jsonb or (a is null and area is null))) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  result:=jsonb_build_object('mode',mode);
  if a is not null then result:=result||jsonb_build_object('start',a); end if;
  if b is not null then result:=result||jsonb_build_object('end',b); end if;
  if area is not null then result:=result||jsonb_build_object('serviceArea',area); end if;
  if points<>'[]'::jsonb then result:=result||jsonb_build_object('waypoints',points); end if;
  return result;
end;
$f$;
revoke all on function private.normalize_task_geography(jsonb) from public,anon,authenticated,service_role;

-- Every V2 producer shares the same structural geography validation. The old
-- validator remains authoritative for all other fact types and FASTEST retirement.
-- No existing fact, Need, Agreement, Application or public location is rewritten.
alter function private.validate_need_v2_fact(text,jsonb) rename to validate_need_v2_fact_pre_location;
revoke all on function private.validate_need_v2_fact_pre_location(text,jsonb) from public,anon,authenticated,service_role;
create function private.validate_need_v2_fact(p_key text,p_value jsonb)
returns void language plpgsql security definer set search_path=pg_catalog
as $f$
begin
  if p_key='need.task_geography' then perform private.normalize_task_geography(p_value); end if;
  perform private.validate_need_v2_fact_pre_location(p_key,p_value);
end;
$f$;
revoke all on function private.validate_need_v2_fact(text,jsonb) from public,anon,authenticated,service_role;

create function private.normalize_need_location(value jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog
as $f$
declare geo jsonb; address jsonb; notes jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>32768 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if value-ARRAY['geography','exactAddress','accessNotes']<>'{}'::jsonb
    or not (value ?& ARRAY['geography','exactAddress','accessNotes']) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  geo:=private.normalize_task_geography(value->'geography');
  address:=value->'exactAddress';notes:=value->'accessNotes';
  if (address<>'null'::jsonb and private.location_private_text_valid(address,1000) is distinct from true)
    or (notes<>'null'::jsonb and private.location_private_text_valid(notes,2000) is distinct from true)
    or (geo->>'mode'='REMOTE' and (address<>'null'::jsonb or notes<>'null'::jsonb)) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  return jsonb_build_object('geography',geo,'exactAddress',case when address='null'::jsonb then null else btrim(address#>>'{}') end,
    'accessNotes',case when notes='null'::jsonb then null else btrim(notes#>>'{}') end);
end;
$f$;
revoke all on function private.normalize_need_location(jsonb) from public,anon,authenticated,service_role;

create function private.need_location_review_document(cid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $f$
  with material as (
    select c.id,c.account_id,c.status,c.bound_need_id,
      coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'key',f.fact_key,'value',f.fact_value,'status',f.status,
          'subjectNeedId',f.subject_need_id) order by f.fact_key)
        from public.ai_structured_facts f where f.conversation_id=c.id and f.superseded_at is null
          and f.fact_schema_version='NEED_FACT_V2'
          and f.fact_key in ('need.task_geography','need.exact_address','need.access_notes')),'[]'::jsonb) as facts
    from public.ai_conversations c where c.id=cid and c.purpose='NEED_INTAKE' and c.fact_schema_version='NEED_FACT_V2'
  ), projected as (
    select *,jsonb_build_object('geography',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.task_geography'),
      'exactAddress',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.exact_address'),
      'accessNotes',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.access_notes')) as value from material
  ) select jsonb_build_object('accountId',account_id,'conversationId',id,'editable',status='OPEN',
    'confirmed',value->'geography'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(facts) f where f->>'status'<>'CONFIRMED'),
    'value',value,'revision',encode(extensions.digest(jsonb_build_object('id',id,'status',status,'boundNeedId',bound_need_id,'facts',facts)::text,'sha256'),'hex'))
    from projected;
$f$;
revoke all on function private.need_location_review_document(uuid) from public,anon,authenticated,service_role;

create function public.rpc_get_need_location_review(p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.ai_conversations where id=p_conversation_id and account_id=auth.uid()
    and purpose='NEED_INTAKE' and fact_schema_version='NEED_FACT_V2') then
    raise exception 'LOCATION_REVIEW_NOT_FOUND' using errcode='42501';
  end if;
  return private.need_location_review_document(p_conversation_id);
end;
$f$;
revoke all on function public.rpc_get_need_location_review(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_need_location_review(uuid) to authenticated;

create function public.rpc_save_need_location_review(p_conversation_id uuid,p_expected_revision text,p_value jsonb,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare c public.ai_conversations; before_doc jsonb; wanted jsonb; k text; fv jsonb;
  old_fact public.ai_structured_facts; new_id uuid; display text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_confirmed is distinct from true then raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  wanted:=private.normalize_need_location(p_value);
  select * into c from public.ai_conversations where id=p_conversation_id and account_id=auth.uid() for update;
  if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then
    raise exception 'LOCATION_REVIEW_NOT_FOUND' using errcode='42501';
  end if;
  if c.status<>'OPEN' then raise exception 'LOCATION_REVIEW_NOT_EDITABLE' using errcode='55000'; end if;
  -- The conversation lock is also taken by the existing AI turn and reviewed-save
  -- commands. Each accepted write updates that row, fencing stale RR snapshots.
  before_doc:=private.need_location_review_document(c.id);
  if before_doc->'confirmed'='true'::jsonb and before_doc->'value'=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'review',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='40001'; end if;
  update public.ai_conversations set status='OPEN' where id=c.id;
  foreach k in array ARRAY['need.task_geography','need.exact_address','need.access_notes'] loop
    fv:=wanted->case k when 'need.task_geography' then 'geography' when 'need.exact_address' then 'exactAddress' else 'accessNotes' end;
    select * into old_fact from public.ai_structured_facts where conversation_id=c.id and fact_key=k and superseded_at is null for update;
    if found and old_fact.fact_value=fv and old_fact.status='CONFIRMED' then continue; end if;
    if old_fact.id is not null then
      update public.ai_structured_facts set superseded_at=statement_timestamp() where id=old_fact.id;
    end if;
    if fv='null'::jsonb then continue; end if;
    perform private.validate_need_v2_fact(k,fv);
    display:=case when k='need.task_geography' then
      case when fv->>'mode'='REMOTE' then 'Rad na daljinu' else
        coalesce(fv#>>'{start,city}',fv#>>'{serviceArea,city}',fv#>>'{start,area}',fv#>>'{serviceArea,area}',fv#>>'{start,label}',fv#>>'{serviceArea,label}') end
      else left(fv#>>'{}',1000) end;
    new_id:=extensions.gen_random_uuid();
    insert into public.ai_structured_facts(id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(new_id,auth.uid(),c.id,c.bound_need_id,k,fv,'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,auth.uid(),statement_timestamp(),
      'NEED_FACT_V2',case k when 'need.task_geography' then 'OBJECT' else 'TEXT' end,display);
    if old_fact.id is not null then update public.ai_structured_facts set superseded_by=new_id where id=old_fact.id; end if;
  end loop;
  return jsonb_build_object('saved',true,'idempotentReplay',false,'review',private.need_location_review_document(c.id));
end;
$f$;
revoke all on function public.rpc_save_need_location_review(uuid,text,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_need_location_review(uuid,text,jsonb,boolean) to authenticated;

-- Worker manual city/radius uses the existing coarse preference and public city.
-- An explicit manual edit can clear old coarse coordinates; none are invented.
create function private.worker_location_document(pid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $f$
  with material as (
    select jsonb_build_object('profileId',p.id,'accountId',p.account_id,'city',p.city,'radiusKm',p.radius_km,
      'approximatePosition',case when w.approximate_lat is not null and w.approximate_lng is not null then
        jsonb_build_object('latitude',w.approximate_lat,'longitude',w.approximate_lng) else null end) as doc
    from public.app_profiles p left join public.worker_match_preferences w on w.worker_profile_id=p.id where p.id=pid and p.kind='WORKER'
  ) select doc||jsonb_build_object('revision',encode(extensions.digest(doc::text,'sha256'),'hex')) from material;
$f$;
revoke all on function private.worker_location_document(uuid) from public,anon,authenticated,service_role;
create function public.rpc_get_worker_location()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare p public.app_profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER';
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  return private.worker_location_document(p.id);
end;
$f$;
revoke all on function public.rpc_get_worker_location() from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_worker_location() to authenticated;
create function public.rpc_save_worker_location(p_expected_revision text,p_value jsonb,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare p public.app_profiles; before_doc jsonb; wanted jsonb; v_city text; radius integer; coords jsonb; lat numeric; lng numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_confirmed is distinct from true then raise exception 'LOCATION_CONFIRMATION_REQUIRED' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>4096 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if p_value-ARRAY['city','radiusKm','approximatePosition']<>'{}'::jsonb or not (p_value ?& ARRAY['city','radiusKm','approximatePosition'])
    or private.location_text_valid(p_value->'city',160) is distinct from true
    or jsonb_typeof(p_value->'radiusKm') is distinct from 'number' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if (p_value->>'radiusKm')::numeric not between 1 and 200 or trunc((p_value->>'radiusKm')::numeric)<>(p_value->>'radiusKm')::numeric then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  v_city:=btrim(p_value->>'city');radius:=(p_value->>'radiusKm')::numeric::integer;coords:=p_value->'approximatePosition';
  if coords<>'null'::jsonb then
    if jsonb_typeof(coords) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    if coords-ARRAY['latitude','longitude']<>'{}'::jsonb or jsonb_typeof(coords->'latitude') is distinct from 'number'
      or jsonb_typeof(coords->'longitude') is distinct from 'number' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    lat:=(coords->>'latitude')::numeric;lng:=(coords->>'longitude')::numeric;
    if lat not between -90 and 90 or lng not between -180 and 180 or lat<>round(lat,2) or lng<>round(lng,2) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
  end if;
  wanted:=jsonb_build_object('city',v_city,'radiusKm',radius,'approximatePosition',coords);
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  before_doc:=private.worker_location_document(p.id);
  if before_doc-ARRAY['revision','accountId','profileId']=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'location',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='40001'; end if;
  update public.app_profiles set city=v_city, radius_km=radius where id=p.id;
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,approximate_lat,approximate_lng)
    values(p.id,auth.uid(),lat,lng) on conflict(worker_profile_id) do update set approximate_lat=excluded.approximate_lat,approximate_lng=excluded.approximate_lng;
  return jsonb_build_object('saved',true,'idempotentReplay',false,'location',private.worker_location_document(p.id));
end;
$f$;
revoke all on function public.rpc_save_worker_location(text,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_worker_location(text,jsonb,boolean) to authenticated;

comment on function public.rpc_save_need_location_review(uuid,text,jsonb,boolean) is
'Owner-confirmed manual location into existing V2 facts. No model authority, provider selection, GPS permission or direct Need publication. Private addresses stay private facts until the canonical reviewed save.';
commit;
