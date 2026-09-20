-- V5 distinct owned PROFILE conversation. AI proposes; only the reviewed owner
-- command updates the existing profile/location/availability/capacity writers.
-- Technical leases/expiry are freshness bounds, not retention policy.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $pre$ begin
 if to_regprocedure('private.closure_assert_open(uuid,uuid)') is null
 or to_regprocedure('public.rpc_save_worker_capacity(text,jsonb)') is null
 or to_regprocedure('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)') is null
 then raise exception 'V5_WORKER_PREDECESSOR_REQUIRED'; end if;
end $pre$;

create table private.worker_ai_sessions (
 conversation_id uuid primary key, account_id uuid not null, open_request_id uuid not null,
 profile_id uuid not null, base_hash text not null, candidate jsonb not null,
 revision integer not null default 0 check(revision>=0), safety text not null default 'ALLOW'
 check(safety in ('ALLOW','CLARIFY','REVIEW','BLOCK')),
 created_at timestamptz not null default clock_timestamp(), unique(account_id,open_request_id),
 check(octet_length(candidate::text)<=524288)
);
create table private.worker_ai_turns (
 turn_id uuid primary key default extensions.gen_random_uuid(), account_id uuid not null,
 conversation_id uuid not null references private.worker_ai_sessions(conversation_id), client_request_id uuid not null,
 body_hash text not null, source_revision integer not null, attempt_id uuid not null default extensions.gen_random_uuid(),
 state text not null check(state in ('PROCESSING','SUCCEEDED','FAILED')), lease_expires_at timestamptz not null,
 completion_hash text, created_at timestamptz not null default clock_timestamp(), unique(account_id,client_request_id)
);
create index worker_ai_turns_conversation on private.worker_ai_turns(conversation_id,created_at desc);
create table private.worker_ai_reviews (
 id uuid primary key default extensions.gen_random_uuid(), account_id uuid not null, conversation_id uuid not null,
 revision integer not null, base_hash text not null, envelope jsonb not null,
 expires_at timestamptz not null, created_at timestamptz not null default clock_timestamp(),
 check(octet_length(envelope::text)<=524288)
);
create index worker_ai_reviews_latest on private.worker_ai_reviews(account_id,conversation_id,created_at desc);
create table private.worker_ai_saves (
 review_id uuid primary key references private.worker_ai_reviews(id), account_id uuid not null,
 client_request_id uuid not null, receipt jsonb not null, created_at timestamptz not null default clock_timestamp(),
 unique(account_id,client_request_id)
);
alter table private.worker_ai_sessions enable row level security;
alter table private.worker_ai_turns enable row level security;
alter table private.worker_ai_reviews enable row level security;
alter table private.worker_ai_saves enable row level security;
revoke all on private.worker_ai_sessions,private.worker_ai_turns,private.worker_ai_reviews,private.worker_ai_saves
 from public,anon,authenticated,service_role;
create trigger worker_ai_review_immutable before update on private.worker_ai_reviews
 for each row execute function private.ai_task_review_immutable();

create function private.worker_ai_source(aid uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('profile',to_jsonb(p),'location',private.worker_location_document(p.id),
  'availability',private.worker_availability_document(p.id),'capacity',private.worker_capacity_document(p.id))
 from public.app_profiles p where p.account_id=aid and p.kind='WORKER';
$f$;
create function private.worker_ai_source_hash(aid uuid) returns text
language sql stable security definer set search_path=pg_catalog as $f$
 select encode(extensions.digest(coalesce(private.worker_ai_source(aid),'null'::jsonb)::text,'sha256'),'hex');
$f$;
create function private.worker_ai_initial(aid uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare p public.app_profiles;
begin
 select * into p from public.app_profiles where account_id=aid and kind='WORKER';
 if found and p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 return jsonb_build_object('displayName',coalesce(p.display_name,''),'bio',coalesce(p.bio,''),
  'skills',coalesce(to_jsonb(p.skills),'[]'::jsonb),'tools',coalesce(to_jsonb(p.tools),'[]'::jsonb),
  'vehicles',coalesce(to_jsonb(p.vehicles),'[]'::jsonb),'licenses',coalesce(to_jsonb(p.licenses),'[]'::jsonb),
  'teamCapacity',coalesce(p.team_capacity,1),
  'location',coalesce(private.worker_location_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('operatingCountryCode',null,'city','','radiusKm',15,'approximatePosition',null)),
  'availability',coalesce(private.worker_availability_document(p.id)-array['profileId','accountId','revision'],
    jsonb_build_object('timezone','Europe/Belgrade','availableNow',false,'rules','[]'::jsonb,'windows','[]'::jsonb)));
end $f$;

-- Extract ONLY the existing canonical W02 read-only validation/normalization
-- block. The save RPC itself is unchanged. Marker/side-effect assertions fail
-- migration admission if its shape drifts; no speculative save is performed.
do $extract$
declare src text; declarations text; validation text; start_at integer; end_at integer;
begin
 select prosrc into src from pg_proc where oid='public.rpc_save_worker_availability(text,jsonb)'::regprocedure;
 start_at:=strpos(src,'  if p_expected_revision is null');
 end_at:=strpos(src,'  before_doc:=private.worker_availability_document(p.id);');
 if start_at=0 or end_at<=start_at or strpos(src,'declare')=0 then raise exception 'V5_WORKER_VALIDATOR_DRIFT'; end if;
 declarations:=substring(src from strpos(src,'declare')+7 for strpos(src,E'\nbegin')-strpos(src,'declare')-7);
 validation:=substring(src from start_at for end_at-start_at);
 if validation ~* '\m(insert|update|delete|perform|execute|set_config)\M' then raise exception 'V5_WORKER_VALIDATOR_NOT_PURE'; end if;
 execute 'create function private.normalize_worker_ai_availability(pid uuid,aid uuid,p_value jsonb) returns jsonb '
  ||'language plpgsql stable security definer set search_path=pg_catalog set timezone=''UTC'' set datestyle=''ISO, YMD'' as $body$ declare '
  ||declarations||' p_expected_revision text:=repeat(''0'',64); begin p.id:=pid; p.account_id:=aid; '
  ||validation||' return wanted-array[''profileId'',''accountId'']; end $body$';
end $extract$;

create function private.worker_ai_patch(base jsonb,patch jsonb,pid uuid,aid uuid,manual boolean default false) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare result jsonb:=base; k text; v jsonb; loc jsonb; av jsonb; op jsonb; old jsonb; item jsonb;
 rules jsonb; windows jsonb; wanted_days jsonb; remaining jsonb; next_id uuid;
begin
 if jsonb_typeof(patch) is distinct from 'object' or octet_length(patch::text)>262144
  or patch-array['displayName','bio','skills','tools','vehicles','licenses','teamCapacity','location','availability']<>'{}'::jsonb
 then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
 foreach k in array array['displayName','bio'] loop
  if not patch?k then continue; end if; v:=patch->k;
  if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>(case k when 'displayName' then 160 else 4000 end)
   or (case when k='bio' then regexp_replace(v#>>'{}',E'[\n\r\t]','','g') else v#>>'{}' end) ~ '[[:cntrl:]]' then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,array[k],to_jsonb(btrim(v#>>'{}')));
 end loop;
 foreach k in array array['skills','tools','vehicles','licenses'] loop
  if not patch?k then continue; end if; v:=patch->k;
  if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>50 then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) is distinct from 'string'
    or length(btrim(x#>>'{}')) not between 1 and 500 or (x#>>'{}') ~ '[[:cntrl:]]')
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,array[k],v);
 end loop;
 if patch?'teamCapacity' then
  if jsonb_typeof(patch->'teamCapacity') is distinct from 'number' or (patch->>'teamCapacity') !~ '^([1-9]|[1-4][0-9]|50)$'
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  result:=jsonb_set(result,'{teamCapacity}',patch->'teamCapacity');
 end if;
 if patch?'location' then
  v:=patch->'location';
  if jsonb_typeof(v) is distinct from 'object' or v-array['operatingCountryCode','city','radiusKm','approximatePosition']<>'{}'::jsonb
   or (not manual and v?'approximatePosition') then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  loc:=base->'location'||v;
  if jsonb_typeof(loc->'city') is distinct from 'string' or length(btrim(loc->>'city'))>160
   or (loc->>'city') ~ '[[:cntrl:]]' or jsonb_typeof(loc->'radiusKm') is distinct from 'number'
   or (loc->>'radiusKm') !~ '^([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$' then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  if loc->'operatingCountryCode'<>'null'::jsonb then perform private.require_location_country(loc->'operatingCountryCode'); end if;
  -- A changed textual origin invalidates the old coarse point. No AI geocoding.
  if (v?'city' and v->'city' is distinct from base#>'{location,city}') or
     (v?'operatingCountryCode' and v->'operatingCountryCode' is distinct from base#>'{location,operatingCountryCode}') then
   if not(manual and v?'approximatePosition') then loc:=jsonb_set(loc,'{approximatePosition}','null'); end if;
  end if;
  if loc->'approximatePosition'<>'null'::jsonb then
   item:=loc->'approximatePosition';
   if jsonb_typeof(item) is distinct from 'object' or item-array['latitude','longitude']<>'{}'::jsonb
    or jsonb_typeof(item->'latitude') is distinct from 'number' or jsonb_typeof(item->'longitude') is distinct from 'number'
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   if (item->>'latitude')::numeric not between -90 and 90 or (item->>'longitude')::numeric not between -180 and 180
    or (item->>'latitude')::numeric<>round((item->>'latitude')::numeric,2)
    or (item->>'longitude')::numeric<>round((item->>'longitude')::numeric,2) then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end if;
  result:=jsonb_set(result,'{location}',loc);
 end if;
 if patch?'availability' then
  v:=patch->'availability'; av:=base->'availability'; rules:=av->'rules'; windows:=av->'windows';
  if jsonb_typeof(v) is distinct from 'object' or v-array['timezone','availableNow','ruleChanges','windowsUpsert','windowIdsRemove']<>'{}'::jsonb
  then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  foreach k in array array['timezone','availableNow'] loop if v?k then av:=jsonb_set(av,array[k],v->k); end if; end loop;
  foreach k in array array['ruleChanges','windowsUpsert','windowIdsRemove'] loop
   if v?k and (jsonb_typeof(v->k) is distinct from 'array' or jsonb_array_length(v->k)>(case when k='ruleChanges' then 256 else 512 end))
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end loop;
  for op in select value from jsonb_array_elements(coalesce(v->'ruleChanges','[]')) loop
   if jsonb_typeof(op) is distinct from 'object' or op-array['ruleId','weekdays','value']<>'{}'::jsonb
    or not(op?&array['ruleId','weekdays','value']) or jsonb_typeof(op->'weekdays') is distinct from 'array'
    or jsonb_array_length(op->'weekdays') not between 1 and 7
    or exists(select 1 from jsonb_array_elements(op->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$')
   then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   wanted_days:=op->'weekdays';
   if jsonb_array_length(wanted_days)<>(select count(distinct d) from jsonb_array_elements(wanted_days) d) then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   if op->'ruleId'<>'null'::jsonb then
    select x into old from jsonb_array_elements(rules) x where x->'id'=op->'ruleId';
    if not found or not(old->'weekdays' @> wanted_days) then raise exception 'WORKER_AI_RULE_STALE' using errcode='40001'; end if;
    select coalesce(jsonb_agg(d),'[]') into remaining from jsonb_array_elements(old->'weekdays') d where not(wanted_days @> jsonb_build_array(d));
    select coalesce(jsonb_agg(x),'[]') into rules from jsonb_array_elements(rules) x where x->'id'<>old->'id';
    if jsonb_array_length(remaining)>0 then rules:=rules||jsonb_build_array(jsonb_set(old,'{weekdays}',remaining)); end if;
   end if;
   if op->'value'<>'null'::jsonb then
    item:=op->'value';
    if jsonb_typeof(item) is distinct from 'object' or item-array['startTime','endTime','startsOn','endsOn','label','active']<>'{}'::jsonb
    then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
    next_id:=extensions.gen_random_uuid();
    rules:=rules||jsonb_build_array(item||jsonb_build_object('id',next_id,'weekdays',wanted_days));
   elsif op->'ruleId'='null'::jsonb then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(v->'windowIdsRemove','[]')) loop
   if not exists(select 1 from jsonb_array_elements(windows) x where x->'id'=item) then raise exception 'WORKER_AI_WINDOW_STALE' using errcode='40001'; end if;
   select coalesce(jsonb_agg(x),'[]') into windows from jsonb_array_elements(windows) x where x->'id'<>item;
  end loop;
  for op in select value from jsonb_array_elements(coalesce(v->'windowsUpsert','[]')) loop
   if jsonb_typeof(op) is distinct from 'object' or not(op?'id') then raise exception 'WORKER_AI_PATCH_INVALID' using errcode='22023'; end if;
   item:=op;
   if op->'id'='null'::jsonb then item:=jsonb_set(op,'{id}',to_jsonb(extensions.gen_random_uuid()));
   elsif not exists(select 1 from jsonb_array_elements(windows) x where x->'id'=op->'id') then raise exception 'WORKER_AI_WINDOW_STALE' using errcode='40001';
   else select coalesce(jsonb_agg(x),'[]') into windows from jsonb_array_elements(windows) x where x->'id'<>op->'id'; end if;
   windows:=windows||jsonb_build_array(item);
  end loop;
  av:=av||jsonb_build_object('rules',rules,'windows',windows);
  av:=private.normalize_worker_ai_availability(pid,aid,av);
  result:=jsonb_set(result,'{availability}',av);
 end if;
 return result;
end $f$;

create function private.worker_ai_turn_document(tid uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('turnId',t.turn_id,'conversationId',t.conversation_id,'clientRequestId',t.client_request_id,
  'state',case when state='PROCESSING' and lease_expires_at<statement_timestamp() then 'UNKNOWN_OUTCOME' else state end,
  'attemptId',attempt_id,'retryAllowed',false,'authoritative',true)
 from private.worker_ai_turns t where turn_id=tid;
$f$;

create function private.worker_ai_document(cid uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','conversationId',s.conversation_id,'accountId',s.account_id,
  'profileId',s.profile_id,'status',c.status,'profileStatus',coalesce((select p.profile_status from public.app_profiles p where p.id=s.profile_id),'DRAFT'),
  'revision',s.revision,'candidate',s.candidate,'safety',s.safety,
  'stale',s.base_hash<>private.worker_ai_source_hash(s.account_id),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'body',m.body,'sequence',m.sequence_no) order by m.sequence_no)
    from (select * from public.ai_messages where conversation_id=cid order by sequence_no desc limit 100) m),'[]'::jsonb),
  'turn',(select private.worker_ai_turn_document(t.turn_id) from private.worker_ai_turns t where t.conversation_id=cid order by t.created_at desc,t.turn_id desc limit 1),
  'review',(select r.envelope from private.worker_ai_reviews r where r.conversation_id=cid order by
    exists(select 1 from private.worker_ai_saves z where z.review_id=r.id) desc,r.created_at desc,r.id desc limit 1),
  'saved',(select z.receipt from private.worker_ai_saves z join private.worker_ai_reviews r on r.id=z.review_id where r.conversation_id=cid limit 1))
 from private.worker_ai_sessions s join public.ai_conversations c on c.id=s.conversation_id and c.account_id=s.account_id and c.purpose='PROFILE'
 where s.conversation_id=cid;
$f$;

create function public.rpc_open_worker_ai(p_client_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); cid uuid; pid uuid; candidate jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_client_request_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023'; end if;
 perform private.closure_assert_open(u);
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-open:'||u::text,0));
 select s.conversation_id into cid from private.worker_ai_sessions s where s.account_id=u and s.open_request_id=p_client_request_id;
 if cid is not null then return private.worker_ai_document(cid); end if;
 select s.conversation_id into cid from private.worker_ai_sessions s join public.ai_conversations c on c.id=s.conversation_id
  where s.account_id=u and c.status='OPEN' order by s.created_at desc limit 1;
 if cid is not null then return private.worker_ai_document(cid); end if;
 select id into pid from public.app_profiles where account_id=u and kind='WORKER' for update;
 candidate:=private.worker_ai_initial(u); pid:=coalesce(pid,extensions.gen_random_uuid());
 insert into public.ai_conversations(account_id,purpose) values(u,'PROFILE') returning id into cid;
 insert into private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate)
 values(cid,u,p_client_request_id,pid,private.worker_ai_source_hash(u),candidate);
 return private.worker_ai_document(cid);
end $f$;

create function public.rpc_read_worker_ai(p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid())
 then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 return private.worker_ai_document(p_conversation_id);
end $f$;

create function public.rpc_read_worker_ai_context_service(p_account_id uuid,p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare doc jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id)
 then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 doc:=private.worker_ai_document(p_conversation_id);
 if doc is null or doc->>'status'<>'OPEN' or doc->>'safety' in ('BLOCK','REVIEW') or doc->'stale'='true'::jsonb then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 return doc-array['review','saved'];
end $f$;

create function public.rpc_claim_worker_ai_turn_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_text text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; t private.worker_ai_turns; hash text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 if p_client_request_id is null or p_text is null or length(btrim(p_text)) not between 1 and 4000
 then raise exception 'WORKER_AI_INPUT_INVALID' using errcode='22023'; end if;
 hash:=encode(extensions.digest(p_text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id;
 if found then
  if t.conversation_id<>p_conversation_id or t.body_hash<>hash then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;
  return jsonb_build_object('acquired',false,'turn',private.worker_ai_turn_document(t.turn_id));
 end if;
 perform public.rpc_read_worker_ai_context_service(p_account_id,p_conversation_id);
 perform 1 from public.ai_conversations where id=p_conversation_id for update;
 if exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING')
 then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if (select count(*) from private.worker_ai_turns where account_id=p_account_id and created_at>clock_timestamp()-interval '1 minute')>=6
 then raise exception 'WORKER_AI_RATE_LIMITED' using errcode='55000'; end if;
 insert into private.worker_ai_turns(account_id,conversation_id,client_request_id,body_hash,source_revision,state,lease_expires_at)
 values(p_account_id,p_conversation_id,p_client_request_id,hash,s.revision,'PROCESSING',clock_timestamp()+interval '60 seconds') returning * into t;
 insert into public.ai_messages(account_id,conversation_id,role,body) values(p_account_id,p_conversation_id,'USER',p_text);
 return jsonb_build_object('acquired',true,'turn',private.worker_ai_turn_document(t.turn_id));
end $f$;

create function public.rpc_complete_worker_ai_turn_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,p_output jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; t private.worker_ai_turns; hash text; next_candidate jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or t.conversation_id is distinct from p_conversation_id or t.attempt_id is distinct from p_attempt_id then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 hash:=encode(extensions.digest(p_output::text,'sha256'),'hex');
 if t.state='SUCCEEDED' then
  if t.completion_hash is distinct from hash then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;
  return private.worker_ai_turn_document(t.turn_id);
 end if;
 if t.state<>'PROCESSING' or t.lease_expires_at<clock_timestamp() or t.source_revision<>s.revision
 then raise exception 'WORKER_AI_TURN_STALE' using errcode='40001'; end if;
 perform public.rpc_read_worker_ai_context_service(p_account_id,p_conversation_id);
 perform 1 from public.ai_conversations where id=p_conversation_id for update;
 if jsonb_typeof(p_output) is distinct from 'object' or p_output-array['assistantMessage','safety','patch']<>'{}'::jsonb
  or not(p_output?&array['assistantMessage','safety','patch'])
  or jsonb_typeof(p_output->'assistantMessage') is distinct from 'string'
  or length(btrim(p_output->>'assistantMessage')) not between 1 and 1200
  or coalesce(p_output->>'safety','') not in ('ALLOW','CLARIFY','REVIEW','BLOCK')
 then raise exception 'WORKER_AI_OUTPUT_INVALID' using errcode='22023'; end if;
 next_candidate:=private.worker_ai_patch(s.candidate,p_output->'patch',s.profile_id,s.account_id,false);
 if p_output->>'safety' in ('BLOCK','REVIEW') then next_candidate:=s.candidate; end if;
 update private.worker_ai_sessions set candidate=next_candidate,revision=revision+1,safety=p_output->>'safety' where conversation_id=p_conversation_id;
 insert into public.ai_messages(account_id,conversation_id,role,body,safety)
 values(p_account_id,p_conversation_id,'ASSISTANT',p_output->>'assistantMessage',p_output->>'safety');
 update private.worker_ai_turns set state='SUCCEEDED',completion_hash=hash where turn_id=t.turn_id;
 return private.worker_ai_turn_document(t.turn_id);
end $f$;

create function public.rpc_fail_worker_ai_turn_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare t private.worker_ai_turns;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 select * into t from private.worker_ai_turns where account_id=p_account_id and conversation_id=p_conversation_id and client_request_id=p_client_request_id for update;
 if not found or t.attempt_id is distinct from p_attempt_id then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 if t.state='PROCESSING' and t.lease_expires_at>=clock_timestamp() then update private.worker_ai_turns set state='FAILED' where turn_id=t.turn_id; end if;
 return private.worker_ai_turn_document(t.turn_id);
end $f$;

create function public.rpc_patch_worker_ai(p_conversation_id uuid,p_expected_revision integer,p_patch jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; next_candidate jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='40001'; end if;
 if exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 next_candidate:=private.worker_ai_patch(s.candidate,p_patch,s.profile_id,s.account_id,true);
 if next_candidate<>s.candidate then update private.worker_ai_sessions set candidate=next_candidate,revision=revision+1 where conversation_id=p_conversation_id; end if;
 return private.worker_ai_document(p_conversation_id);
end $f$;

create function public.rpc_prepare_worker_ai_review(p_conversation_id uuid,p_expected_revision integer,p_activate boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; doc jsonb; missing jsonb:='[]'; expires timestamptz;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and status='OPEN' for update;
 if not found or s.safety in ('BLOCK','REVIEW') then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 perform 1 from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if s.revision is distinct from p_expected_revision or s.base_hash<>private.worker_ai_source_hash(auth.uid()) then raise exception 'WORKER_AI_STALE' using errcode='40001'; end if;
 if p_activate is null or exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING') then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if p_activate then
  if length(s.candidate->>'displayName')<2 then missing:=missing||'"Ime"'::jsonb; end if;
  if length(s.candidate#>>'{location,city}')<2 then missing:=missing||'"Mesto rada"'::jsonb; end if;
  if jsonb_array_length(s.candidate->'skills')<1 then missing:=missing||'"Veštine"'::jsonb; end if;
 end if;
 if (s.candidate->'location')<> (private.worker_ai_initial(auth.uid())->'location')
  and (s.candidate#>'{location,operatingCountryCode}'='null'::jsonb or length(s.candidate#>>'{location,city}')<1)
 then missing:=missing||'"Država i mesto rada"'::jsonb; end if;
 perform private.normalize_worker_ai_availability(s.profile_id,s.account_id,s.candidate->'availability');
 select * into r from private.worker_ai_reviews where conversation_id=p_conversation_id and revision=s.revision
  and base_hash=s.base_hash and envelope->'activate'=to_jsonb(p_activate) and expires_at>clock_timestamp() order by created_at desc limit 1;
 if found then return r.envelope; end if;
 r.id:=extensions.gen_random_uuid(); expires:=clock_timestamp()+interval '15 minutes';
 doc:=jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','reviewId',r.id,'conversationId',p_conversation_id,'accountId',auth.uid(),
  'profileId',s.profile_id,'revision',s.revision,'profile',s.candidate,'activate',p_activate,'missingRequired',missing,
  'canAccept',jsonb_array_length(missing)=0,'expiresAt',expires);
 doc:=doc||jsonb_build_object('displayedContentDigest',encode(extensions.digest((doc||jsonb_build_object('baseHash',s.base_hash))::text,'sha256'),'hex'));
 insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
 values(r.id,auth.uid(),p_conversation_id,s.revision,s.base_hash,doc,expires);
 return doc;
end $f$;

create function public.rpc_save_worker_ai_review(p_review_id uuid,p_displayed_digest text,p_client_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; r private.worker_ai_reviews; cmd private.worker_ai_saves; p public.app_profiles; value jsonb; receipt jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 if p_client_request_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-save:'||auth.uid()::text||p_client_request_id::text,0));
 select * into r from private.worker_ai_reviews where id=p_review_id and account_id=auth.uid();
 if not found or r.envelope->>'displayedContentDigest' is distinct from p_displayed_digest then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into s from private.worker_ai_sessions where conversation_id=r.conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into cmd from private.worker_ai_saves where account_id=auth.uid() and client_request_id=p_client_request_id;
 if found and cmd.review_id<>r.id then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;
 select * into cmd from private.worker_ai_saves where review_id=r.id;
 if found then return cmd.receipt; end if;
 perform 1 from public.ai_conversations where id=s.conversation_id and account_id=auth.uid() and purpose='PROFILE' and status='OPEN' for update;
 if not found then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
 if r.revision<>s.revision or r.base_hash<>private.worker_ai_source_hash(auth.uid()) or r.expires_at<clock_timestamp()
  or r.envelope->'profile'<>s.candidate or r.envelope->'canAccept'<>'true'::jsonb or s.safety in ('BLOCK','REVIEW')
  or exists(select 1 from private.worker_ai_turns where conversation_id=s.conversation_id and state='PROCESSING')
 then raise exception 'WORKER_AI_STALE' using errcode='40001'; end if;
 if p.id is not null and (p.id<>s.profile_id or p.profile_status not in ('DRAFT','ACTIVE')) then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 value:=r.envelope->'profile';
 if p.id is null then
  insert into public.app_profiles(id,account_id,kind,display_name,bio,skills,tools,vehicles,licenses)
  values(s.profile_id,auth.uid(),'WORKER',value->>'displayName',value->>'bio',
   array(select jsonb_array_elements_text(value->'skills')),array(select jsonb_array_elements_text(value->'tools')),
   array(select jsonb_array_elements_text(value->'vehicles')),array(select jsonb_array_elements_text(value->'licenses'))) returning * into p;
 else
  update public.app_profiles set display_name=value->>'displayName',bio=value->>'bio',
   skills=array(select jsonb_array_elements_text(value->'skills')),tools=array(select jsonb_array_elements_text(value->'tools')),
   vehicles=array(select jsonb_array_elements_text(value->'vehicles')),licenses=array(select jsonb_array_elements_text(value->'licenses')) where id=p.id;
 end if;
 if value->'location'<>private.worker_location_document(p.id)-array['profileId','accountId','revision'] then
  perform public.rpc_save_worker_location(private.worker_location_document(p.id)->>'revision',value->'location',true);
 end if;
 perform public.rpc_save_worker_availability(private.worker_availability_document(p.id)->>'revision',value->'availability');
 perform public.rpc_save_worker_capacity(private.worker_capacity_document(p.id)->>'revision',value->'teamCapacity');
 if (r.envelope->>'activate')::boolean then perform public.rpc_complete_worker_profile(p.id); end if;
 update public.ai_conversations set status='COMPLETED',completed_at=clock_timestamp() where id=s.conversation_id;
 receipt:=jsonb_build_object('reviewId',r.id,'conversationId',s.conversation_id,'accountId',auth.uid(),'profileId',p.id,
  'profileStatus',(select profile_status from public.app_profiles where id=p.id),'saved',true,'authoritative',true);
 insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt) values(r.id,auth.uid(),p_client_request_id,receipt);
 return receipt;
end $f$;

-- A deliberate restart abandons the candidate; it never erases messages/audio
-- policy, canonical profile data, or an unknown provider claim.
create function public.rpc_abandon_worker_ai(p_conversation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(auth.uid());
 perform 1 from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=auth.uid() for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 update public.ai_conversations set status='ABANDONED',completed_at=clock_timestamp() where id=p_conversation_id and account_id=auth.uid() and status='OPEN';
 return private.worker_ai_document(p_conversation_id);
end $f$;

do $acl$ declare r record; begin
 for r in select p.oid::regprocedure as sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='private' and p.proname in ('worker_ai_source','worker_ai_source_hash','worker_ai_initial','normalize_worker_ai_availability',
   'worker_ai_patch','worker_ai_turn_document','worker_ai_document')) or (n.nspname='public' and p.proname in
   ('rpc_open_worker_ai','rpc_read_worker_ai','rpc_read_worker_ai_context_service','rpc_claim_worker_ai_turn_service',
    'rpc_complete_worker_ai_turn_service','rpc_fail_worker_ai_turn_service','rpc_patch_worker_ai','rpc_prepare_worker_ai_review','rpc_save_worker_ai_review','rpc_abandon_worker_ai')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);
  if r.nspname='public' then execute format('grant execute on function %s to %I',r.sig,
   case when r.proname like '%_service' then 'service_role' else 'authenticated' end); end if;
 end loop;
end $acl$;
notify pgrst,'reload schema';
commit;
