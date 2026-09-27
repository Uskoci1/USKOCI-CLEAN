-- USKOČI P0-02 — technical processor inventory truth reconciliation.
-- Candidate only. It updates the technical inventory, not the reviewed legal processor map.
-- No legal entity, DPA, transfer mechanism or legal-basis assertion is published here.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $pre$
declare
  codes text[];
  maps integer;
  before_owner oid;
  before_acl aclitem[];
  before_rls boolean;
  before_force boolean;
begin
  select array_agg(code order by code) into codes
  from private.processor_provider_inventory;

  if codes is distinct from array[
    'EXPO_PUSH','GOOGLE_GEMINI_AI','OPENAI_AI','SUPABASE_PLATFORM'
  ]::text[] then
    raise exception 'P0_02_PROVIDER_PREDECESSOR_DRIFT' using detail=coalesce(codes::text,'NULL');
  end if;

  if not exists(
    select 1 from private.processor_provider_inventory
    where code='OPENAI_AI' and active and required_current
  ) or not exists(
    select 1 from private.processor_provider_inventory
    where code='GOOGLE_GEMINI_AI' and active and required_current
  ) or not exists(
    select 1 from private.processor_provider_inventory
    where code='EXPO_PUSH' and not active and not required_current
  ) then
    raise exception 'P0_02_PROVIDER_STATE_PREDECESSOR_DRIFT';
  end if;

  select count(*) into maps from private.processor_map_sets;
  if maps<>0 then
    raise exception 'P0_02_LEGAL_MAP_ALREADY_PUBLISHED' using detail=maps::text;
  end if;

  select c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
    into before_owner,before_acl,before_rls,before_force
  from pg_class c
  where c.oid='private.processor_provider_inventory'::regclass;

  update private.processor_provider_inventory
     set technical_purpose='Historical AI adapter inventory row retained for provenance; no current canonical NEED_FACT_V2 provider route uses OpenAI.',
         physical_evidence='Current canonical supabase/functions/uskoci-ai-interview/index.ts contains no callOpenAI and no api.openai.com/v1/responses route. New NEED_FACT_V2 inference is admitted only for AI_PROVIDER=gemini with the approved Gemini model.',
         required_current=false,
         active=false,
         updated_at=statement_timestamp()
   where code='OPENAI_AI';

  update private.processor_provider_inventory
     set technical_purpose='Current external AI provider for NEED_FACT_V2 interview inference and Gemini speech transcription sessions.',
         physical_evidence='Canonical uskoci-ai-interview admits current inference only for AI_PROVIDER=gemini and calls generativelanguage.googleapis.com; uskoci-speech-session opens the Google Generative Language bidirectional WebSocket.',
         required_current=true,
         active=true,
         updated_at=statement_timestamp()
   where code='GOOGLE_GEMINI_AI';

  update private.processor_provider_inventory
     set technical_purpose='Current Expo push transport for queued push tickets and provider receipts.',
         physical_evidence='Canonical uskoci-push-transport posts to https://exp.host/--/api/v2/push/send and getReceipts. Canonical DEV has recorded an EXPO_PUSH queued attempt with a provider ticket.',
         required_current=true,
         active=true,
         updated_at=statement_timestamp()
   where code='EXPO_PUSH';

  insert into private.processor_provider_inventory(
    code,display_name,technical_purpose,physical_evidence,required_current,active
  ) values (
    'LOCATIONIQ','LocationIQ',
    'Current forward and reverse geocoding provider used by the authenticated location-search Edge adapter.',
    'Canonical uskoci-location-search uses fixed EU endpoints https://eu1.locationiq.com/v1/search and /v1/reverse with a server-side LOCATIONIQ_ACCESS_TOKEN; submitted address text or coordinates are not logged by the Edge adapter.',
    true,true
  );

  if (select count(*) from private.processor_provider_inventory)<>5
     or (select count(*) from private.processor_provider_inventory where active and required_current)<>4
     or exists(
       select 1 from private.processor_provider_inventory
       where (code='OPENAI_AI' and (active or required_current))
          or (code in('SUPABASE_PLATFORM','GOOGLE_GEMINI_AI','EXPO_PUSH','LOCATIONIQ')
              and (not active or not required_current))
     ) then
    raise exception 'P0_02_PROVIDER_POSTCONDITION_FAILED';
  end if;

  if exists(select 1 from private.processor_map_sets)
     or exists(select 1 from private.processor_map_entries) then
    raise exception 'P0_02_LEGAL_MAP_CHANGED';
  end if;

  if exists(
    select 1
    from pg_class c
    where c.oid='private.processor_provider_inventory'::regclass
      and (c.relowner is distinct from before_owner
        or c.relacl is distinct from before_acl
        or c.relrowsecurity is distinct from before_rls
        or c.relforcerowsecurity is distinct from before_force)
  ) then
    raise exception 'P0_02_PROVIDER_AUTHORITY_DRIFT';
  end if;
end
$pre$;

commit;
