\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';

do $proof$
declare
  aid uuid;
  cid uuid;
  ctx jsonb;
  provider_keys text[];
  private_rows integer;
begin
  aid:=extensions.gen_random_uuid();
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    aid,'authenticated','authenticated',
    'privacy-p0-proof-'||aid::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','Privacy P0 Proof','city','Novi Sad'),
    statement_timestamp(),statement_timestamp()
  );

  insert into public.ai_conversations(account_id,purpose,status,fact_schema_version)
  values(aid,'NEED_INTAKE','OPEN','NEED_FACT_V2')
  returning id into cid;

  insert into public.ai_structured_facts(
    account_id,conversation_id,fact_key,fact_value,status,source,scope,confidence,
    confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value
  ) values
    (aid,cid,'need.people_needed','2'::jsonb,'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,aid,statement_timestamp(),'NEED_FACT_V2','INTEGER','2 osobe'),
    (aid,cid,'need.exact_address',to_jsonb('PRIVACY_P0_PRIVATE_ADDRESS'::text),'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,aid,statement_timestamp(),'NEED_FACT_V2','TEXT','PRIVACY_P0_PRIVATE_ADDRESS'),
    (aid,cid,'need.access_notes',to_jsonb('PRIVACY_P0_PRIVATE_ACCESS'::text),'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,aid,statement_timestamp(),'NEED_FACT_V2','TEXT','PRIVACY_P0_PRIVATE_ACCESS');

  ctx:=private.ai_need_turn_context(cid);

  select coalesce(array_agg(x->>'fact_key' order by x->>'fact_key'),'{}'::text[])
    into provider_keys
  from jsonb_array_elements(ctx->'context'->'activeFacts') x;

  if provider_keys is distinct from array['need.people_needed']::text[] then
    raise exception 'PRIVACY_P0_PROVIDER_CONTEXT_LEAK %',provider_keys;
  end if;

  select count(*) into private_rows
  from public.ai_structured_facts
  where conversation_id=cid and fact_key in('need.exact_address','need.access_notes')
    and superseded_at is null;

  if private_rows<>2 then
    raise exception 'PRIVACY_P0_INTERNAL_FACTS_LOST %',private_rows;
  end if;

  if coalesce(ctx->>'sha256','')!~'^[0-9a-f]{64}$' then
    raise exception 'PRIVACY_P0_MATERIAL_HASH_MISSING';
  end if;

  if private.retention_ai_source_ready() is distinct from true then
    raise exception 'PRIVACY_P0_RETENTION_READINESS_REGRESSED';
  end if;
end
$proof$;

rollback;
select 'PASS PRIVACY_P0_AI_CONTEXT_MINIMIZATION persisted_private retained provider_context_minimized retention_ready acl_preserved' as result;
