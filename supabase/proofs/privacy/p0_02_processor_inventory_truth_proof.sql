\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';

do $seed$
declare
  aid uuid:=extensions.gen_random_uuid();
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    aid,'authenticated','authenticated',
    'processor-truth-proof-'||aid::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),statement_timestamp()
  );
  perform set_config('uskoci.processor_truth_aid',aid::text,true);
end
$seed$;

do $server_truth$
declare
  codes text[];
begin
  select array_agg(code order by code) into codes
  from private.processor_provider_inventory
  where active and required_current;

  if codes is distinct from array[
    'EXPO_PUSH','GOOGLE_GEMINI_AI','LOCATIONIQ','SUPABASE_PLATFORM'
  ]::text[] then
    raise exception 'P0_02_REQUIRED_SET_INVALID %',codes;
  end if;

  if not exists(
    select 1 from private.processor_provider_inventory
    where code='OPENAI_AI' and not active and not required_current
  ) then raise exception 'P0_02_OPENAI_NOT_RETIRED'; end if;

  if (select count(*) from private.processor_map_sets)<>0
     or (select count(*) from private.processor_map_entries)<>0 then
    raise exception 'P0_02_LEGAL_CONTENT_INVENTED';
  end if;

  if has_table_privilege('anon','private.processor_provider_inventory','SELECT')
     or has_table_privilege('authenticated','private.processor_provider_inventory','SELECT')
     or has_table_privilege('service_role','private.processor_provider_inventory','SELECT') then
    raise exception 'P0_02_PRIVATE_TABLE_EXPOSED';
  end if;
end
$server_truth$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.processor_truth_aid'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('uskoci.processor_truth_aid'),'role','authenticated')::text,true);

do $status$
declare
  s jsonb;
begin
  s:=public.rpc_get_processor_map_status();
  if s->>'ready'<>'false'
     or s->>'reason'<>'PROCESSOR_MAP_NOT_PUBLISHED'
     or (s->>'technicalProviderCount')::integer<>5
     or (s->>'requiredCurrentProviders')::integer<>4
     or s->>'runtimeProviderGateAdmitted'<>'false' then
    raise exception 'P0_02_STATUS_INVALID %',s;
  end if;
end
$status$;

reset role;
rollback;

select 'PASS P0_02_PROCESSOR_INVENTORY_TRUTH current4 total5 openai_retired expo_locationiq_admitted legal_map_unpublished private_acl_preserved' as result;
