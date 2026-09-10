-- W02: private owner-confirmed per-slot route pins in the existing V2 review/Need chain.
-- No geocoder authority, public precise payload, activation, second route store or historical backfill.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- CREATE OR REPLACE must preserve every predecessor ACL, including revoked inner writers.
create temporary table w02_resolved_predecessor_acl on commit drop as
select oid, proacl from pg_proc where oid in (to_regprocedure('private.validate_need_v2_fact(text,jsonb)'),to_regprocedure('private.normalize_need_location(jsonb)'),to_regprocedure('private.need_location_review_document(uuid)'),to_regprocedure('public.rpc_save_need_location_review(uuid,text,jsonb,boolean)'),to_regprocedure('private.need_material_snapshot(uuid)'),to_regprocedure('private.need_publication_fingerprint_snapshot(uuid)'),to_regprocedure('public.rpc_save_need_draft_from_review(uuid,uuid,text)'),to_regprocedure('public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'),to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)'),to_regprocedure('public.rpc_confirm_need_edit(uuid,integer,text,jsonb)'),to_regprocedure('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'),to_regprocedure('public.rpc_ai_correct_fact_v2(uuid,jsonb,text)'),to_regprocedure('public.rpc_ai_confirm_fact(uuid)'),to_regprocedure('public.rpc_set_contact_grant(uuid,text,boolean)'),to_regprocedure('public.rpc_reveal_contact(uuid,text)'),to_regprocedure('private.guard_ai_fact_schema()'),to_regprocedure('private.guard_ai_fact_write()'),to_regprocedure('private.guard_need_write()'));
do $preflight$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.validate_need_v2_fact(text,jsonb)')) is distinct from '9577e6d9f62f61da5ad0c10df98ba7ac' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.validate_need_v2_fact(text,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.normalize_need_location(jsonb)')) is distinct from '98794ce689ee7e071674ea97299b6bb2' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.normalize_need_location(jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_location_review_document(uuid)')) is distinct from 'ff8c8320e186bdd77eae6da195449ff2' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.need_location_review_document(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_save_need_location_review(uuid,text,jsonb,boolean)')) is distinct from 'cc81a9daf329efc9175447c301eca330' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_save_need_location_review(uuid,text,jsonb,boolean)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_material_snapshot(uuid)')) is distinct from 'eb5c9bbcf84f5bfbf793dd995602cd59' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.need_material_snapshot(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.need_publication_fingerprint_snapshot(uuid)')) is distinct from '4c0f9e422f4bd072931dfa347f31308d' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.need_publication_fingerprint_snapshot(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_save_need_draft_from_review(uuid,uuid,text)')) is distinct from '02aff3fd7d64d8d2b853325cb32c02fb' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_save_need_draft_from_review(uuid,uuid,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)')) is distinct from 'abf920cdae32ed109b35594efc7fdebd' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_open_need_edit_conversation_v2(uuid)')) is distinct from 'db4cda29b6a24fd29d53f8eebe66f333' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_ai_open_need_edit_conversation_v2(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_confirm_need_edit(uuid,integer,text,jsonb)')) is distinct from '31e96e6b55ed9fcd070e3b3193683e6a' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_confirm_need_edit(uuid,integer,text,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)')) is distinct from '9b87763c59ec6fb515c4128cc6864ad8' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_correct_fact_v2(uuid,jsonb,text)')) is distinct from '7342a40473c094f77adffee74fbb777b' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_ai_correct_fact_v2(uuid,jsonb,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_confirm_fact(uuid)')) is distinct from '4c982c3a2396cb4bf82543f8921fda42' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_ai_confirm_fact(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_set_contact_grant(uuid,text,boolean)')) is distinct from '98c9ba74d978fd5b77a69ef8a9e5b0ea' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_set_contact_grant(uuid,text,boolean)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_reveal_contact(uuid,text)')) is distinct from '4ff99d59c811f1e8638c62b48125f965' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='public.rpc_reveal_contact(uuid,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_ai_fact_schema()')) is distinct from 'b2386ca23e82d730f876ea18e8855616' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.guard_ai_fact_schema()'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_ai_fact_write()')) is distinct from 'e85a09a79a217d1ab7d350470875d437' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.guard_ai_fact_write()'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_need_write()')) is distinct from '4810335313b6a81666291e20a523f656' then
    raise exception 'W02_RESOLVED_PREDECESSOR_DRIFT' using detail='private.guard_need_write()'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='need_sensitive' and column_name='resolved_location') then
    raise exception 'W02_RESOLVED_ALREADY_PRESENT'; end if;
end;
$preflight$;

alter table public.need_sensitive add column resolved_location jsonb;
comment on column public.need_sensitive.resolved_location is 'Private slot-bound user-confirmed E6 points and preserved human confirmation. Provider hints are client reported, never server attestations. Existing EXACT_LOCATION grant applies.';
insert into private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
values('need.resolved_location','NEED_FACT_V2','OBJECT',false,'PRIVATE',true,'need_sensitive.resolved_location');

-- Helpers use existing normalized topology as a binding witness, never a second route owner.
create function private.normalize_resolved_location(value jsonb,country text,geo jsonb,address text)
returns jsonb language plpgsql stable set search_path=pg_catalog as $f$
declare item jsonb; origin jsonb; slot text; idx integer; seen text[]:='{}'; result jsonb:='[]'; clean jsonb;
  lat numeric; lng numeric; k text; detail jsonb; binding jsonb; expected jsonb; slots integer;
begin
  if value is null or value='null'::jsonb then return null; end if;
  if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>65536
    or value-ARRAY['version','binding','points']<>'{}'::jsonb or not(value ?& ARRAY['version','binding','points'])
    or value->'version'<>'1'::jsonb then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  geo:=private.normalize_task_geography(geo);
  if country is null or country !~ '^[A-Z]{2}$' or geo->>'mode'='REMOTE' then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  binding:=value->'binding';
  if jsonb_typeof(binding) is distinct from 'object' or binding-ARRAY['taskCountryCode','geography','exactAddress']<>'{}'::jsonb
    or not(binding ?& ARRAY['taskCountryCode','geography','exactAddress'])
    or jsonb_typeof(binding->'taskCountryCode') is distinct from 'string'
    or (binding->'exactAddress'<>'null'::jsonb and private.location_private_text_valid(binding->'exactAddress',1000) is distinct from true) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  expected:=jsonb_build_object('taskCountryCode',country,'geography',geo,'exactAddress',nullif(btrim(address),''));
  binding:=jsonb_build_object('taskCountryCode',upper(btrim(binding->>'taskCountryCode')),
    'geography',private.normalize_task_geography(binding->'geography'),'exactAddress',nullif(btrim(binding->>'exactAddress'),''));
  if binding is distinct from expected then raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  slots:=(case when geo ? 'start' then 1 else 0 end)+(case when geo ? 'end' then 1 else 0 end)
    +(case when geo ? 'serviceArea' then 1 else 0 end)+coalesce(jsonb_array_length(geo->'waypoints'),0);
  if jsonb_typeof(value->'points') is distinct from 'array' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  if jsonb_array_length(value->'points')<1 or jsonb_array_length(value->'points')>slots or slots>22 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  for item in select v from jsonb_array_elements(value->'points') v loop
    if jsonb_typeof(item) is distinct from 'object' or item-ARRAY['slot','latitudeE6','longitudeE6','origin','address','accessNotes']<>'{}'::jsonb
      or not(item ?& ARRAY['slot','latitudeE6','longitudeE6','origin']) or jsonb_typeof(item->'slot') is distinct from 'string' then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    slot:=item->>'slot';
    if slot=any(seen) then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    seen:=array_append(seen,slot);
    if slot in ('start','end','serviceArea') then
      if not(geo ? slot) then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    elsif slot ~ '^waypoints/(0|[1-9][0-9]?)$' then
      idx:=split_part(slot,'/',2)::integer;
      if idx>19 or idx>=coalesce(jsonb_array_length(geo->'waypoints'),0) then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    else raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    if jsonb_typeof(item->'latitudeE6') is distinct from 'number' or jsonb_typeof(item->'longitudeE6') is distinct from 'number' then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    lat:=(item->>'latitudeE6')::numeric;lng:=(item->>'longitudeE6')::numeric;
    if lat<>trunc(lat) or lng<>trunc(lng) or abs(lat)>90000000 or abs(lng)>180000000 then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    origin:=item->'origin';
    if jsonb_typeof(origin) is distinct from 'object' then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    if origin->>'kind'='MANUAL_PIN' then
      if origin<>jsonb_build_object('kind','MANUAL_PIN') then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    elsif origin->>'kind'='PROVIDER_CANDIDATE' then
      if origin-ARRAY['kind','providerHint','candidateHint']<>'{}'::jsonb or not(origin ?& ARRAY['kind','providerHint','candidateHint'])
        or jsonb_typeof(origin->'providerHint') is distinct from 'string' or btrim(origin->>'providerHint') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
        or (origin->'candidateHint'<>'null'::jsonb and private.location_text_valid(origin->'candidateHint',160) is distinct from true) then
        raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
      origin:=jsonb_build_object('kind','PROVIDER_CANDIDATE','providerHint',btrim(origin->>'providerHint'),'candidateHint',case when origin->'candidateHint'='null'::jsonb then null else btrim(origin->>'candidateHint') end);
    else raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    clean:=jsonb_build_object('slot',slot,'latitudeE6',lat::integer,'longitudeE6',lng::integer,'origin',origin);
    foreach k in array ARRAY['address','accessNotes'] loop
      detail:=item->k;
      if detail is not null and detail<>'null'::jsonb then
        if private.location_private_text_valid(detail,case k when 'address' then 1000 else 2000 end) is distinct from true then
          raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
        clean:=clean||jsonb_build_object(k,btrim(detail#>>'{}'));
      end if;
    end loop;
    result:=result||jsonb_build_array(clean);
  end loop;
  select jsonb_agg(v order by case v->>'slot' when 'start' then 0 when 'end' then 21 when 'serviceArea' then 22 else 1+split_part(v->>'slot','/',2)::integer end)
    into result from jsonb_array_elements(result) v;
  result:=jsonb_build_object('version',1,'binding',expected,'points',result);
  if octet_length(result::text)>65536 then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  return result;
end;
$f$;
revoke all on function private.normalize_resolved_location(jsonb,text,jsonb,text) from public,anon,authenticated,service_role;

create function private.guard_resolved_location_fact()
returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;
begin
  if new.fact_key<>'need.resolved_location' then return new; end if;
  if tg_op='UPDATE' then
    -- Existing immutable-content/subject-binding/supersession guard remains the owner.
    if new.status is distinct from old.status or new.source is distinct from old.source
      or new.confirmed_by_user_id is distinct from old.confirmed_by_user_id or new.confirmed_at is distinct from old.confirmed_at then
      raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
    return new;
  end if;
  select * into c from public.ai_conversations where id=new.conversation_id for update;
  if auth.uid() is null or new.account_id is distinct from auth.uid() or c.account_id is distinct from auth.uid()
    or c.status is distinct from 'OPEN' or c.purpose is distinct from 'NEED_INTAKE'
    or new.fact_schema_version<>'NEED_FACT_V2' or new.status<>'CONFIRMED' or new.source<>'EXPLICIT_USER_ANSWER'
    or new.confirmed_by_user_id is distinct from auth.uid() or new.confirmed_at is null
    or new.confirmed_at>statement_timestamp() or new.evidence_excerpt is not null then
    raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
  return new;
end;
$f$;
revoke all on function private.guard_resolved_location_fact() from public,anon,authenticated,service_role;
create trigger guard_resolved_location_fact_trg before insert or update on public.ai_structured_facts
for each row execute function private.guard_resolved_location_fact();

create function private.invalidate_resolved_location_fact()
returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
declare f public.ai_structured_facts; country text; geo jsonb; address text; wanted jsonb;
begin
  if new.fact_key not in ('need.task_country_code','need.task_geography','need.exact_address') or new.superseded_at is not null then return new; end if;
  perform 1 from public.ai_conversations where id=new.conversation_id for update;
  select * into f from public.ai_structured_facts where conversation_id=new.conversation_id and fact_key='need.resolved_location' and superseded_at is null for update;
  if not found then return new; end if;
  select fact_value#>>'{}' into country from public.ai_structured_facts where conversation_id=new.conversation_id and fact_key='need.task_country_code' and superseded_at is null;
  select fact_value into geo from public.ai_structured_facts where conversation_id=new.conversation_id and fact_key='need.task_geography' and superseded_at is null;
  select fact_value#>>'{}' into address from public.ai_structured_facts where conversation_id=new.conversation_id and fact_key='need.exact_address' and superseded_at is null;
  begin wanted:=private.normalize_resolved_location(f.fact_value,country,geo,address);
  exception when sqlstate '22023' then wanted:=null; end;
  if wanted is null then update public.ai_structured_facts set superseded_at=statement_timestamp() where id=f.id; end if;
  return new;
end;
$f$;
revoke all on function private.invalidate_resolved_location_fact() from public,anon,authenticated,service_role;
create trigger invalidate_resolved_location_fact_trg after insert or update on public.ai_structured_facts
for each row execute function private.invalidate_resolved_location_fact();

create function private.resolved_location_record_valid(record jsonb,country text,geo jsonb,address text,owner uuid)
returns boolean language plpgsql stable set search_path=pg_catalog as $f$
declare wanted jsonb;
begin
  if record is null then return true; end if;
  if jsonb_typeof(record) is distinct from 'object' or octet_length(record::text)>65536
    or record-ARRAY['value','confirmedByAccountId','confirmedAt']<>'{}'::jsonb
    or not(record ?& ARRAY['value','confirmedByAccountId','confirmedAt'])
    or jsonb_typeof(record->'confirmedByAccountId') is distinct from 'string'
    or record->>'confirmedByAccountId' is distinct from owner::text
    or jsonb_typeof(record->'confirmedAt') is distinct from 'string' then return false; end if;
  if (record->>'confirmedAt')::timestamptz>statement_timestamp() then return false; end if;
  wanted:=private.normalize_resolved_location(record->'value',country,geo,address);
  return wanted is not null and wanted=record->'value';
exception when data_exception then return false;
end;
$f$;
revoke all on function private.resolved_location_record_valid(jsonb,text,jsonb,text,uuid) from public,anon,authenticated,service_role;

create function private.materialize_resolved_location(nid uuid,cid uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $f$
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
    update public.needs set approximate_lat=round((anchor->>'latitudeE6')::numeric/1000000,2),
      approximate_lng=round((anchor->>'longitudeE6')::numeric/1000000,2) where id=nid;
  end if;
end;
$f$;
revoke all on function private.materialize_resolved_location(uuid,uuid) from public,anon,authenticated,service_role;

create function private.guard_need_resolved_location_write()
returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
declare n public.needs;
begin
  if (tg_op='INSERT' and new.resolved_location is not null) or (tg_op='UPDATE' and new.resolved_location is distinct from old.resolved_location) then
    select * into n from public.needs where id=new.need_id;
    if auth.uid() is null or n.requester_account_id is distinct from auth.uid() or n.status is distinct from 'DRAFT'
      or exists(select 1 from public.agreements where need_id=new.need_id) or exists(select 1 from public.need_selections where need_id=new.need_id) then
      raise exception 'LOCATION_REVIEW_NOT_EDITABLE' using errcode='42501'; end if;
  end if;
  return new;
end;
$f$;
revoke all on function private.guard_need_resolved_location_write() from public,anon,authenticated,service_role;
create trigger guard_need_resolved_location_write_trg before insert or update on public.need_sensitive
for each row execute function private.guard_need_resolved_location_write();

create function private.check_need_resolved_location_binding()
returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
declare nid uuid; n public.needs; s public.need_sensitive; geo jsonb; point jsonb; anchor jsonb;
begin
  if tg_table_name='needs' then nid:=new.id; else nid:=new.need_id; end if;
  select * into n from public.needs where id=nid;
  if not found then return null; end if;
  select * into s from public.need_sensitive where need_id=nid;
  if not found or s.resolved_location is null then return null; end if;
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
  return null;
end;
$f$;
revoke all on function private.check_need_resolved_location_binding() from public,anon,authenticated,service_role;
create constraint trigger resolved_location_sensitive_binding_trg after insert or update on public.need_sensitive deferrable initially deferred
for each row execute function private.check_need_resolved_location_binding();
create constraint trigger resolved_location_topology_binding_trg after insert or update on public.need_geography deferrable initially deferred
for each row execute function private.check_need_resolved_location_binding();
create constraint trigger resolved_location_need_binding_trg after insert or update on public.needs deferrable initially deferred
for each row execute function private.check_need_resolved_location_binding();

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: private.validate_need_v2_fact
create or replace function private.validate_need_v2_fact(p_key text,p_value jsonb)
returns void language plpgsql stable security definer set search_path=pg_catalog
as $f$
begin
  if p_key='need.resolved_location' then
    if p_value is null or p_value='null'::jsonb or private.normalize_resolved_location(p_value,
      p_value#>>'{binding,taskCountryCode}',p_value#>'{binding,geography}',p_value#>>'{binding,exactAddress}') is distinct from p_value then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
    return;
  end if;
  if p_key='need.task_country_code' then
    if p_value#>>'{}' is distinct from private.require_location_country(p_value) then
      raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
    end if;
    return;
  end if;
  perform private.validate_need_v2_fact_pre_country(p_key,p_value);
end;
$f$;

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: private.normalize_need_location
create or replace function private.normalize_need_location(value jsonb)
returns jsonb language plpgsql stable set search_path=pg_catalog
as $f$
declare geo jsonb; address jsonb; notes jsonb; country text;
begin
  if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>65536 then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  if value-ARRAY['taskCountryCode','geography','exactAddress','accessNotes','resolvedLocation']<>'{}'::jsonb
    or not (value ?& ARRAY['taskCountryCode','geography','exactAddress','accessNotes']) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  country:=private.require_location_country(value->'taskCountryCode');
  geo:=private.normalize_task_geography(value->'geography');
  address:=value->'exactAddress';notes:=value->'accessNotes';
  if (address<>'null'::jsonb and private.location_private_text_valid(address,1000) is distinct from true)
    or (notes<>'null'::jsonb and private.location_private_text_valid(notes,2000) is distinct from true)
    or (geo->>'mode'='REMOTE' and (address<>'null'::jsonb or notes<>'null'::jsonb)) then
    raise exception 'LOCATION_INPUT_INVALID' using errcode='22023';
  end if;
  return jsonb_build_object('taskCountryCode',country,'geography',geo,'exactAddress',case when address='null'::jsonb then null else btrim(address#>>'{}') end,
    'accessNotes',case when notes='null'::jsonb then null else btrim(notes#>>'{}') end,
    'resolvedLocation',private.normalize_resolved_location(value->'resolvedLocation',country,geo,case when address='null'::jsonb then null else btrim(address#>>'{}') end));
end;
$f$;

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: private.need_location_review_document
create or replace function private.need_location_review_document(cid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $f$
  with material as (
    select c.id,c.account_id,c.status,c.bound_need_id,
      coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'key',f.fact_key,'value',f.fact_value,'status',f.status,
          'subjectNeedId',f.subject_need_id) order by f.fact_key)
        from public.ai_structured_facts f where f.conversation_id=c.id and f.superseded_at is null
          and f.fact_schema_version='NEED_FACT_V2'
          and f.fact_key in ('need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location')),'[]'::jsonb) as facts
    from public.ai_conversations c where c.id=cid and c.purpose='NEED_INTAKE' and c.fact_schema_version='NEED_FACT_V2'
  ), projected as (
    select *,jsonb_build_object('taskCountryCode',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.task_country_code'),'geography',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.task_geography'),
      'exactAddress',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.exact_address'),
      'accessNotes',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.access_notes'),
      'resolvedLocation',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.resolved_location')) as value from material
  ) select jsonb_build_object('accountId',account_id,'conversationId',id,'editable',status='OPEN',
    'confirmed',value->'taskCountryCode'<>'null'::jsonb and value->'geography'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(facts) f where f->>'status'<>'CONFIRMED'),
    'value',value,'revision',encode(extensions.digest(jsonb_build_object('id',id,'status',status,'boundNeedId',bound_need_id,'facts',facts)::text,'sha256'),'hex'))
    from projected;
$f$;

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: public.rpc_save_need_location_review
create or replace function public.rpc_save_need_location_review(p_conversation_id uuid,p_expected_revision text,p_value jsonb,p_confirmed boolean)
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
  foreach k in array ARRAY['need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location'] loop
    fv:=wanted->case k when 'need.task_country_code' then 'taskCountryCode' when 'need.task_geography' then 'geography' when 'need.exact_address' then 'exactAddress' when 'need.resolved_location' then 'resolvedLocation' else 'accessNotes' end;
    select * into old_fact from public.ai_structured_facts where conversation_id=c.id and fact_key=k and superseded_at is null for update;
    if found and old_fact.fact_value=fv and old_fact.status='CONFIRMED' then continue; end if;
    if old_fact.id is not null then
      update public.ai_structured_facts set superseded_at=statement_timestamp() where id=old_fact.id;
    end if;
    if fv='null'::jsonb then continue; end if;
    perform private.validate_need_v2_fact(k,fv);
    display:=case when k='need.resolved_location' then 'Potvrđene tačke: '||jsonb_array_length(fv->'points')::text when k='need.task_geography' then
      case when fv->>'mode'='REMOTE' then 'Rad na daljinu' else
        coalesce(fv#>>'{start,city}',fv#>>'{serviceArea,city}',fv#>>'{start,area}',fv#>>'{serviceArea,area}',fv#>>'{start,label}',fv#>>'{serviceArea,label}') end
      else left(fv#>>'{}',1000) end;
    new_id:=extensions.gen_random_uuid();
    insert into public.ai_structured_facts(id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(new_id,auth.uid(),c.id,c.bound_need_id,k,fv,'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,auth.uid(),statement_timestamp(),
      'NEED_FACT_V2',case when k in ('need.task_geography','need.resolved_location') then 'OBJECT' else 'TEXT' end,display);
    if old_fact.id is not null then update public.ai_structured_facts set superseded_by=new_id where id=old_fact.id; end if;
  end loop;
  return jsonb_build_object('saved',true,'idempotentReplay',false,'review',private.need_location_review_document(c.id));
end;
$f$;

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: private.need_material_snapshot
create or replace function private.need_material_snapshot(p_need_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
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
  from public.needs n
  left join public.need_sensitive s on s.need_id = n.id
  where n.id = p_need_id
$$;

-- Reuses 20260904103000_clean_ru3_need_publication_decision.sql: private.need_publication_fingerprint_snapshot
create or replace function private.need_publication_fingerprint_snapshot(
  p_need_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $$
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
  );

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
$$;

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: public.rpc_save_need_draft_from_review
create or replace function public.rpc_save_need_draft_from_review(
  p_conversation_id uuid,
  p_requester_profile_id uuid,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_profile public.app_profiles%rowtype;
  v_facts jsonb;
  v_snapshot jsonb;
  v_missing text[];
  v_hash text;
  v_existing private.need_draft_save_commands%rowtype;
  v_need_id uuid;
  v_result jsonb;
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
  v_exec_mode text;
  v_start jsonb;
  v_service jsonb;
  v_city text;
  v_area text;
  v_exact_address text;
  v_access_notes text;
  v_key text;
  v_value jsonb;
  v_safety text;
  v_country text; v_timezone text; v_region_token text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_conversation_id is null or p_requester_profile_id is null then raise exception 'DRAFT_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_client_request_id)),0)<8 or char_length(btrim(p_client_request_id))>200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'LEGACY_CONVERSATION_NOT_CANONICAL_SAVE_ELIGIBLE' using errcode='P0001'; end if;

  select * into v_profile
    from public.app_profiles
   where id=p_requester_profile_id
   for share;
  if not found or v_profile.account_id<>v_uid or v_profile.kind<>'REQUESTER' or v_profile.profile_status<>'ACTIVE' then
    raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501';
  end if;

  if exists (
    select 1 from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version<>'NEED_FACT_V2'
  ) then
    raise exception 'MIXED_SCHEMA_CONVERSATION_NOT_SAVE_ELIGIBLE' using errcode='P0001';
  end if;

  for v_key,v_value in
    select fact_key,fact_value
      from public.ai_structured_facts
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
   where r.required_for_draft
     and not (v_facts ? r.fact_key);

  if cardinality(coalesce(v_missing,'{}'::text[]))>0 then
    raise exception 'REQUIRED_CONFIRMED_FACTS_MISSING'
      using errcode='P0001',detail=array_to_string(v_missing,',');
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
  v_exec_mode:=v_geo->>'mode';
  v_start:=coalesce(v_geo->'start','null'::jsonb);
  v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
  v_city:=coalesce(nullif(btrim(v_start->>'city'),''),nullif(btrim(v_service->>'city'),''));
  v_area:=coalesce(nullif(btrim(v_start->>'area'),''),nullif(btrim(v_service->>'area'),''));
  if v_exec_mode='REMOTE' then
    v_city:=''; v_area:='';
  end if;

  if v_facts ? 'need.exact_address' then v_exact_address:=v_facts->>'need.exact_address'; end if;
  if v_facts ? 'need.access_notes' then v_access_notes:=v_facts->>'need.access_notes'; end if;

  v_snapshot:=jsonb_build_object(
    'conversationId',p_conversation_id,
    'requesterProfileId',p_requester_profile_id,
    'confirmedFacts',v_facts
  );
  v_hash:=encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');

  select * into v_existing
    from private.need_draft_save_commands
   where account_id=v_uid
     and client_request_id=btrim(p_client_request_id)
   for update;

  if found then
    if v_existing.request_hash<>v_hash then
      raise exception 'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT' using errcode='22023';
    end if;
    return v_existing.result;
  end if;

  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;
  if v_conv.bound_need_id is not null then raise exception 'CONVERSATION_ALREADY_BOUND' using errcode='P0001'; end if;

  -- Successful semantic-command replay above remains an acknowledgment only.
  -- For every new DRAFT, recheck safety under the same conversation lock used
  -- by the service writer; a prior committed BLOCK cannot race past this gate.
  -- Ignore null/unsupported rows so they cannot clear an earlier BLOCK.
  -- No supported decision retains the existing conservative REVIEW fallback.
  select coalesce((
    select m.safety from public.ai_messages m
     where m.conversation_id=p_conversation_id
       and m.role='ASSISTANT'
       and m.safety in ('ALLOW','CLARIFY','REVIEW','BLOCK')
     order by m.sequence_no desc
     limit 1
  ),'REVIEW') into v_safety;
  if v_safety='BLOCK' then
    raise exception 'AI_NEED_DRAFT_BLOCKED' using errcode='P0001';
  end if;

  v_region_token:=current_setting('uskoci.need_region',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,starts_at,ends_at,required_slots,
    mode,requester_price_rsd,required_skills,required_tools,required_vehicles,
    required_licenses,verified_identity_required,minimum_experience_years,
    execution_location_mode,public_photo_paths,task_country_code,task_timezone
  ) values (
    v_uid,p_requester_profile_id,'DRAFT',v_title,v_description,v_category,
    coalesce(v_city,''),coalesce(v_area,''),v_schedule_kind,v_starts_at,v_ends_at,v_slots,
    v_mode,v_price,v_skills,v_tools,v_vehicles,v_licenses,v_verified,v_min_exp,
    v_exec_mode,v_photos,v_country,v_timezone
  )
  returning id into v_need_id;
  perform set_config('uskoci.need_region',coalesce(v_region_token,''),true);

  insert into public.need_geography(need_id,public_topology)
  values(v_need_id,v_geo);

  if v_exact_address is not null or v_access_notes is not null then
    insert into public.need_sensitive(need_id,exact_address,access_notes)
    values(v_need_id,coalesce(v_exact_address,''),coalesce(v_access_notes,''));
  end if;

  perform private.materialize_resolved_location(v_need_id,p_conversation_id);

  if cardinality(v_conditions)>0 then
    insert into public.need_requirement_details(need_id,critical_conditions)
    values(v_need_id,v_conditions);
  end if;

  update public.ai_structured_facts
     set subject_need_id=v_need_id
   where conversation_id=p_conversation_id
     and fact_schema_version='NEED_FACT_V2';

  update public.ai_conversations
     set bound_need_id=v_need_id,status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id;

  v_result:=jsonb_build_object(
    'needId',v_need_id,
    'status','DRAFT',
    'revision',1,
    'conversationId',p_conversation_id,
    'authoritative',true
  );

  insert into private.need_draft_save_commands(
    account_id,client_request_id,request_hash,conversation_id,requester_profile_id,need_id,result
  ) values (
    v_uid,btrim(p_client_request_id),v_hash,p_conversation_id,p_requester_profile_id,v_need_id,v_result
  );

  return v_result;
end
$function$;

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: public.rpc_confirm_need_edit_from_review
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
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;
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
   where n.id=v_need.id and n.revision=v_need.revision and n.status in ('PUBLISHED','SELECTION')
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
    v_need.id,p_expected_revision,v_need.revision,'PUBLISHED_OR_SELECTION',v_before,v_after,v_uid
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

-- Reuses 20260910121926_clean_w02_regional_country_authority.sql: public.rpc_ai_open_need_edit_conversation_v2
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

  select * into v_need from public.needs where id=p_need_id for share;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  select * into v_sensitive from public.need_sensitive where need_id=v_need.id;
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

-- Reuses 20260904214500_clean_ru4_owner_edit_lock.sql: public.rpc_confirm_need_edit
create or replace function public.rpc_confirm_need_edit(
  p_need_id uuid,
  p_expected_revision integer,
  p_client_request_id text,
  p_material jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
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
$$;

-- Reuses 20260903190000_clean_ru2_need_v2_draft.sql: public.rpc_ai_apply_interview_turn_v2_service
create or replace function public.rpc_ai_apply_interview_turn_v2_service(
  p_account_id uuid,
  p_conversation_id uuid,
  p_user_message text,
  p_assistant_message text,
  p_safety text,
  p_proposals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_conv public.ai_conversations%rowtype;
  v_item jsonb;
  v_key text;
  v_value jsonb;
  v_display text;
  v_evidence text;
  v_confidence numeric;
  v_value_type text;
  v_fact_id uuid;
  v_fact_ids uuid[]:='{}'::uuid[];
  v_previous_ids uuid[];
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_proposals jsonb:=coalesce(p_proposals,'[]'::jsonb);
begin
  if p_account_id is null or p_conversation_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_user_message)),0)<1 or char_length(btrim(p_user_message))>4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023'; end if;
  if coalesce(char_length(btrim(p_assistant_message)),0)<1 or char_length(btrim(p_assistant_message))>1500 then raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode='22023'; end if;
  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'SAFETY_DECISION_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_proposals)<>'array' or jsonb_array_length(v_proposals)>12 then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;
  if p_safety='BLOCK' and jsonb_array_length(v_proposals)>0 then raise exception 'BLOCK_CANNOT_PERSIST_PROPOSALS' using errcode='22023'; end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>p_account_id then raise exception 'CONVERSATION_OWNER_MISMATCH' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_CONVERSATION_REQUIRED' using errcode='P0001'; end if;
  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;

  for v_item in select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode='22023'; end if;
    v_key:=nullif(btrim(v_item->>'key'),'');
    v_value:=v_item->'value';
    v_display:=nullif(btrim(v_item->>'displayValue'),'');
    v_evidence:=nullif(btrim(v_item->>'evidence'),'');
    if v_key='need.resolved_location' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
    if v_key is null then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;
    if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023',detail=v_key; end if;
    if v_evidence is null or char_length(v_evidence)>500 then raise exception 'V2_FACT_EVIDENCE_INVALID' using errcode='22023',detail=v_key; end if;
    begin v_confidence:=(v_item->>'confidence')::numeric; exception when others then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end;
    if v_confidence is null or v_confidence<0 or v_confidence>1 then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end if;

    select value_type into v_value_type from private.need_fact_registry where fact_key=v_key;
    if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023',detail=v_key; end if;
    perform private.validate_need_v2_fact(v_key,v_value);

    v_fact_id:=extensions.gen_random_uuid();
    with superseded as (
      update public.ai_structured_facts
         set superseded_at=statement_timestamp(),superseded_by=null
       where conversation_id=p_conversation_id
         and fact_key=v_key
         and superseded_at is null
       returning id
    )
    select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

    insert into public.ai_structured_facts(
      id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,fact_schema_version,value_type,display_value
    ) values (
      v_fact_id,p_account_id,p_conversation_id,v_conv.bound_need_id,v_key,v_value,
      'NEEDS_CONFIRMATION','AI_INFERENCE','NEED_DRAFT',v_confidence,v_evidence,
      'NEED_FACT_V2',v_value_type,v_display
    );

    if cardinality(v_previous_ids)>0 then
      update public.ai_structured_facts set superseded_by=v_fact_id where id=any(v_previous_ids);
    end if;
    v_fact_ids:=array_append(v_fact_ids,v_fact_id);
  end loop;

  insert into public.ai_messages(account_id,conversation_id,role,body)
  values(p_account_id,p_conversation_id,'USER',btrim(p_user_message))
  returning id into v_user_message_id;

  insert into public.ai_messages(account_id,conversation_id,role,body,safety,proposed_fact_ids)
  values(p_account_id,p_conversation_id,'ASSISTANT',btrim(p_assistant_message),p_safety,v_fact_ids)
  returning id into v_assistant_message_id;

  return jsonb_build_object(
    'conversationId',p_conversation_id,
    'userMessageId',v_user_message_id,
    'assistantMessageId',v_assistant_message_id,
    'proposedCount',cardinality(v_fact_ids),
    'proposedFactIds',to_jsonb(v_fact_ids),
    'schemaVersion','NEED_FACT_V2',
    'safety',p_safety,
    'authoritative',true
  );
end
$function$;

-- Reuses 20260903190000_clean_ru2_need_v2_draft.sql: public.rpc_ai_correct_fact_v2
create or replace function public.rpc_ai_correct_fact_v2(
  p_fact_id uuid,
  p_value jsonb,
  p_display_value text
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_old public.ai_structured_facts%rowtype;
  v_conv public.ai_conversations%rowtype;
  v_display text:=nullif(btrim(p_display_value),'');
  v_new_id uuid:=extensions.gen_random_uuid();
  v_previous_ids uuid[];
  v_value_type text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023'; end if;

  select * into v_old from public.ai_structured_facts where id=p_fact_id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_old.fact_key='need.resolved_location' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
  if v_old.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;
  if v_old.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_FACT_REQUIRED' using errcode='P0001'; end if;
  if v_old.scope<>'NEED_DRAFT' then raise exception 'FACT_SCOPE_NOT_EDITABLE' using errcode='P0001'; end if;

  select * into v_conv from public.ai_conversations where id=v_old.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.purpose<>'NEED_INTAKE' or v_conv.status<>'OPEN' or v_conv.fact_schema_version<>'NEED_FACT_V2' then
    raise exception 'CONVERSATION_NOT_EDITABLE' using errcode='P0001';
  end if;

  select value_type into v_value_type from private.need_fact_registry where fact_key=v_old.fact_key;
  if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;
  perform private.validate_need_v2_fact(v_old.fact_key,p_value);

  with superseded as (
    update public.ai_structured_facts
       set superseded_at=statement_timestamp(),superseded_by=null
     where conversation_id=v_old.conversation_id
       and fact_key=v_old.fact_key
       and superseded_at is null
     returning id
  )
  select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

  insert into public.ai_structured_facts(
    id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
    confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
    fact_schema_version,value_type,display_value
  ) values (
    v_new_id,v_uid,v_old.conversation_id,v_old.subject_need_id,v_old.fact_key,p_value,
    'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,v_uid,statement_timestamp(),
    'NEED_FACT_V2',v_value_type,v_display
  );

  if cardinality(v_previous_ids)>0 then
    update public.ai_structured_facts set superseded_by=v_new_id where id=any(v_previous_ids);
  end if;

  return v_new_id;
end
$function$;

-- Reuses 20260901114029_clean_ai_fact_supersession_and_human_correction.sql: public.rpc_ai_confirm_fact
create or replace function public.rpc_ai_confirm_fact(p_fact_id uuid)
returns uuid language plpgsql security definer set search_path to 'pg_catalog'
as $function$
declare v_uid uuid:=auth.uid(); v_fact public.ai_structured_facts%rowtype; v_conv public.ai_conversations%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into v_fact from public.ai_structured_facts where id=p_fact_id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_fact.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_fact.fact_key='need.resolved_location' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
  if v_fact.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;
  select * into v_conv from public.ai_conversations where id=v_fact.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;
  if v_fact.status='CONFIRMED' then
    if v_fact.confirmed_at is null or v_fact.confirmed_by_user_id is null then raise exception 'CONFIRMED_PROVENANCE_INVALID' using errcode='P0001'; end if;
    return p_fact_id;
  end if;
  update public.ai_structured_facts set status='CONFIRMED',confirmed_at=statement_timestamp(),confirmed_by_user_id=v_uid where id=p_fact_id;
  return p_fact_id;
end;
$function$;

-- Reuses 20260901091438_client_command_authority_closure.sql: public.rpc_set_contact_grant
create or replace function public.rpc_set_contact_grant(
  p_agreement_id uuid,
  p_channel text,
  p_granted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_to uuid;
  v_grant_id uuid;
  v_phone text;
  v_address text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_channel not in ('PHONE', 'EXACT_LOCATION') then
    raise exception 'UNSUPPORTED_CHANNEL' using errcode = '22023';
  end if;
  if p_granted is null then
    raise exception 'GRANT_DECISION_REQUIRED' using errcode = '22004';
  end if;

  select *
    into v_agreement
    from public.agreements
   where id = p_agreement_id
   for update;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_uid not in (v_agreement.requester_account_id, v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  v_to := case
            when v_uid = v_agreement.requester_account_id then v_agreement.worker_account_id
            else v_agreement.requester_account_id
          end;

  -- Revocation is deliberately allowed after cancellation/completion so a
  -- user can always close their own grant. New grants require a live agreement.
  if p_granted and v_agreement.status <> 'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode = 'P0001', detail = v_agreement.status;
  end if;

  if p_channel = 'PHONE' and p_granted then
    select nullif(btrim(a.phone), '')
      into v_phone
      from public.app_accounts a
     where a.id = v_uid;
    if v_phone is null then
      raise exception 'PHONE_NOT_SET' using errcode = 'P0001';
    end if;
  end if;

  -- Exact Need location belongs to the requester. A worker cannot grant a
  -- requester's address back to them or to anyone else.
  if p_channel = 'EXACT_LOCATION' then
    if v_uid <> v_agreement.requester_account_id then
      raise exception 'NOT_LOCATION_OWNER' using errcode = '42501';
    end if;
    if p_granted then
      select nullif(btrim(s.exact_address), '')
        into v_address
        from public.need_sensitive s
       where s.need_id = v_agreement.need_id;
      if v_address is null and not exists (
        select 1 from public.need_sensitive s join public.needs n on n.id=s.need_id join public.need_geography g on g.need_id=n.id
        where s.need_id=v_agreement.need_id and s.resolved_location is not null
          and private.resolved_location_record_valid(s.resolved_location,n.task_country_code,g.public_topology,s.exact_address,n.requester_account_id)
      ) then
        raise exception 'LOCATION_NOT_SET' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if p_granted then
    insert into public.access_grants (
      agreement_id,
      channel,
      granted_by_account_id,
      granted_to_account_id,
      status,
      granted_at,
      revoked_at,
      expires_at
    ) values (
      p_agreement_id,
      p_channel,
      v_uid,
      v_to,
      'GRANTED',
      statement_timestamp(),
      null,
      null
    )
    on conflict (agreement_id, channel, granted_by_account_id, granted_to_account_id)
    do update set
      status = 'GRANTED',
      granted_at = statement_timestamp(),
      revoked_at = null,
      expires_at = null
    returning id into v_grant_id;
  else
    update public.access_grants
       set status = 'REVOKED',
           revoked_at = coalesce(revoked_at, statement_timestamp())
     where agreement_id = p_agreement_id
       and channel = p_channel
       and granted_by_account_id = v_uid
       and granted_to_account_id = v_to
    returning id into v_grant_id;
  end if;

  return jsonb_build_object(
    'agreementId', p_agreement_id,
    'channel', p_channel,
    'grantedByAccountId', v_uid,
    'grantedToAccountId', v_to,
    'granted', p_granted,
    'grantId', v_grant_id,
    'authoritative', true
  );
end;
$function$;

-- Reuses 20260830073615_clean_cancellation_privacy_and_wakeup.sql: public.rpc_reveal_contact
create or replace function public.rpc_reveal_contact(p_agreement_id uuid, p_channel text)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare
  u uuid := auth.uid(); a public.agreements; g public.access_grants;
  v_owner uuid; v_phone text; s public.need_sensitive;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if p_channel is null or p_channel not in ('PHONE','EXACT_LOCATION') then
    raise exception using errcode='22023', message='UNSUPPORTED_CHANNEL';
  end if;

  select * into a from public.agreements where id = p_agreement_id;
  if not found then raise exception using errcode='P0002', message='AGREEMENT_NOT_FOUND'; end if;
  if u not in (a.requester_account_id, a.worker_account_id) then
    raise exception using errcode='42501', message='NOT_PARTY';
  end if;
  -- Dozvola zivi samo dok Dogovor zivi.
  if a.status <> 'CONFIRMED' then
    raise exception using errcode='42501', message='AGREEMENT_NOT_ACTIVE';
  end if;

  select * into g from public.access_grants
   where agreement_id = p_agreement_id and channel = p_channel
     and granted_to_account_id = u and status = 'GRANTED'
     and (expires_at is null or expires_at > statement_timestamp())
   limit 1;
  if not found then raise exception using errcode='42501', message='NO_ACTIVE_GRANT'; end if;

  if not private.grant_is_ownable(p_agreement_id, p_channel, g.granted_by_account_id) then
    raise exception using errcode='42501', message='GRANT_NOT_FROM_DATA_OWNER';
  end if;
  if not private.grant_counterparty_ok(p_agreement_id, g.granted_by_account_id, u) then
    raise exception using errcode='42501', message='GRANT_NOT_TO_COUNTERPARTY';
  end if;

  if p_channel = 'PHONE' then
    v_owner := g.granted_by_account_id;
    select nullif(btrim(acc.phone),'') into v_phone from public.app_accounts acc where acc.id = v_owner;
    return jsonb_build_object('channel','PHONE','agreementId',a.id,'ownerAccountId',v_owner,
      'phone',v_phone,'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
  end if;

  select * into s from public.need_sensitive where need_id = a.need_id;
  if not found then raise exception using errcode='P0002', message='LOCATION_NOT_SET'; end if;
  if s.resolved_location is not null and not exists (
    select 1 from public.needs n join public.need_geography geo on geo.need_id=n.id where n.id=a.need_id
      and private.resolved_location_record_valid(s.resolved_location,n.task_country_code,geo.public_topology,s.exact_address,n.requester_account_id)
  ) then raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
  return jsonb_build_object('channel','EXACT_LOCATION','agreementId',a.id,
    'needId',a.need_id,'needRevision',(select revision from public.needs where id=a.need_id),
    'grantId',g.id,'ownerAccountId',g.granted_by_account_id,'resolvedLocation',s.resolved_location,
    'exactAddress',s.exact_address,'accessNotes',s.access_notes,
    'exactLat',s.exact_lat,'exactLng',s.exact_lng,
    'grantedAt',g.granted_at,'expiresAt',g.expires_at,'authoritative',true);
end;
$$;

-- Existing function ACLs are intentionally preserved by CREATE OR REPLACE.

do $postflight$
begin
  if exists(select 1 from w02_resolved_predecessor_acl baseline left join pg_proc p on p.oid=baseline.oid
    where p.oid is null or p.proacl is distinct from baseline.proacl) then raise exception 'W02_RESOLVED_PREDECESSOR_ACL_DRIFT'; end if;
  if not has_function_privilege('authenticated','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE') then raise exception 'W02_RESOLVED_WRITER_ACL_DRIFT'; end if;
  if has_table_privilege('authenticated','public.need_sensitive','INSERT') or has_table_privilege('authenticated','public.need_sensitive','UPDATE')
    or has_table_privilege('authenticated','public.need_sensitive','DELETE') then raise exception 'W02_RESOLVED_PRIVILEGE_DRIFT'; end if;
  if not exists(select 1 from private.need_fact_registry where fact_key='need.resolved_location' and privacy_class='PRIVATE' and value_type='OBJECT' and material and not required_for_draft) then
    raise exception 'W02_RESOLVED_REGISTRY_DRIFT'; end if;
end;
$postflight$;
commit;
