-- Discovery P0 exact-public-landing proof SOURCE ONLY. NOT EXECUTED.
-- Intended only for the existing disposable Supabase replay at 127.0.0.1:54322.
-- The candidate is replayed verbatim, fixture rows are rolled back, and successful
-- completion restores the predecessor reader. An early error may leave the candidate
-- on the DISPOSABLE database; discard that database rather than touching canonical DEV.
-- This is authenticated SQL/RLS proof source, not Auth/PostgREST/device/query-cost proof.
\set ON_ERROR_STOP on
\if :{?discovery_disposable}
\else
  \echo 'Set discovery_disposable=true only for the disposable replay.'
  \quit 3
\endif
\if :discovery_disposable
\else
  \quit 3
\endif
select :'HOST' = '127.0.0.1' and :'PORT' = '54322' and :'DBNAME' = 'postgres'
  and current_user = 'postgres' as discovery_local_replay
\gset
\if :discovery_local_replay
\else
  \echo 'Refusing non-disposable connection settings.'
  \quit 3
\endif

create temporary table discovery_p0_proof_before as
select pg_get_functiondef(p.oid) as definition, p.proowner, p.proacl,
  private.closure_source_digest_v5() as digest,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) as certificate,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure_certificate,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) as readiness_definition
from pg_proc p where p.oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure;

do $pre$
declare definition text;
begin
  select b.definition into strict definition from discovery_p0_proof_before b;
  if md5(definition) <> '8a47d061da5f9bd65b5e3cc6c947d5d7' then
    raise exception 'DISCOVERY_P0_PROOF_PREDECESSOR_DRIFT';
  end if;
  if private.retention_ai_source_ready() is distinct from true then raise exception 'DISCOVERY_P0_PROOF_CERT_NOT_READY'; end if;
  -- The untouched old body is the behavioral oracle. It runs as the same authenticated
  -- role under the same RLS, in this session's temporary schema only.
  execute replace(definition, 'FUNCTION public.rpc_list_open_tasks_v3(',
    'FUNCTION pg_temp.discovery_p0_before(');
  execute format('grant usage on schema %I to authenticated',
    (select nspname from pg_namespace where oid = pg_my_temp_schema()));
  grant execute on function pg_temp.discovery_p0_before(jsonb,jsonb,integer,timestamptz,uuid) to authenticated;
end
$pre$;

-- Exact candidate bytes; its own transaction also checks digest, certificates, ACL,
-- owner, readiness definition and the pinned new function body.
\ir ../../candidates/discovery_p0_exact_public_landing.sql

begin;
set local statement_timeout = '60s';

create function pg_temp.discovery_p0_assert_unchanged() returns void
language plpgsql as $body$
begin
  if private.closure_source_digest_v5() is distinct from (select digest from discovery_p0_proof_before)
     or (select to_jsonb(c) from private.closure_source_v5 c where singleton)
        is distinct from (select certificate from discovery_p0_proof_before)
     or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)
        is distinct from (select erasure_certificate from discovery_p0_proof_before)
     or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure)
        is distinct from (select readiness_definition from discovery_p0_proof_before)
     or private.retention_ai_source_ready() is distinct from true
     or (select count(*) from pg_proc p, discovery_p0_proof_before b
         where p.oid = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure
           and not p.prosecdef and p.provolatile='s' and p.proconfig=array['search_path=pg_catalog']::text[]
           and p.proowner=b.proowner and p.proacl is not distinct from b.proacl) <> 1 then
    raise exception 'DISCOVERY_P0_PROOF_AUTHORITY_CHANGED';
  end if;
end
$body$;
select pg_temp.discovery_p0_assert_unchanged();

do $seed$
declare
  owner_id uuid := gen_random_uuid(); reader_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  owner_profile uuid; task_id uuid; label text;
  category text := 'P0-' || gen_random_uuid()::text;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select id,'authenticated','authenticated','discovery-p0-'||id||'@proof.invalid',statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Disposable Discovery proof"}'::jsonb,
    statement_timestamp(),statement_timestamp()
  from unnest(array[owner_id,reader_id,other_id]) id;
  select id into strict owner_profile from public.app_profiles where account_id=owner_id and kind='REQUESTER';
  insert into private.account_lineage_v5(account_id,lineage,reason,source_ref)
  values(other_id,'SYNTHETIC_ACCEPTANCE_FIXTURE','Disposable isolation proof','discovery-p0');
  perform set_config('discovery_p0.owner',owner_id::text,true);
  perform set_config('discovery_p0.reader',reader_id::text,true);
  perform set_config('discovery_p0.other',other_id::text,true);
  perform set_config('discovery_p0.category',category,true);
  perform set_config('discovery_p0.missing',gen_random_uuid()::text,true);
  -- Projection fixtures only. No publish/dispatch/notification workflow is invoked.
  -- Real PK/check/generated-column constraints remain; triggers are restored before reads.
  perform set_config('session_replication_role','replica',true);
  foreach label in array array['pinned','remote','pointfree','selection','draft','closed','completed'] loop
    task_id := gen_random_uuid();
    perform set_config('discovery_p0.'||label,task_id::text,true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,
      required_slots,revision,schedule_kind,starts_at,published_at,approximate_city,approximate_area,
      approximate_lat,approximate_lng,task_country_code,task_timezone,execution_location_mode,
      remaining_search_closed_at,remaining_search_close_reason,remaining_search_closed_by_account_id)
    values(task_id,owner_id,owner_profile,
      case label when 'draft' then 'DRAFT' when 'completed' then 'COMPLETED' when 'selection' then 'SELECTION' else 'PUBLISHED' end,
      'Disposable '||label,'PRIVATE_DESCRIPTION_MARKER',category,'OFFERS',2,7,'FLEXIBLE',
      statement_timestamp()+interval '1 day',
      case when label='draft' then null else statement_timestamp()-interval '1 day' end,
      case when label='remote' then '' else 'Novi Sad' end,
      case when label='remote' then '' else 'Liman' end,
      case when label in ('remote','pointfree') then null else 45.25 end,
      case when label in ('remote','pointfree') then null else 19.83 end,
      'RS','Europe/Belgrade',case when label='remote' then 'REMOTE' else 'STATIONARY' end,
      case when label='closed' then statement_timestamp() else null end,
      case when label='closed' then 'PROOF_SEARCH_CLOSED' else null end,
      case when label='closed' then owner_id else null end);
  end loop;
  insert into public.need_sensitive(need_id,exact_address,access_notes)
  values(current_setting('discovery_p0.pinned')::uuid,'PRIVATE_ADDRESS_MARKER','PRIVATE_ACCESS_MARKER');
  -- The landing task is older than a complete 200-item first page.
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,
    requester_price_rsd,required_slots,revision,schedule_kind,published_at,execution_location_mode,task_country_code,task_timezone)
  select gen_random_uuid(),owner_id,owner_profile,'PUBLISHED','Filler '||i,'Disposable fixture',category,'MY_PRICE',
    3000,1,3,'FLEXIBLE',statement_timestamp()-i*interval '1 second','REMOTE','RS','Europe/Belgrade'
  from generate_series(1,205) i;
  perform set_config('session_replication_role','origin',true);
end
$seed$;

create function pg_temp.discovery_p0_parity(
  filters jsonb, bbox jsonb default null, before_at timestamptz default null, before_id uuid default null
) returns void language plpgsql security invoker as $body$
declare old_page jsonb; next_page jsonb; stripped jsonb;
begin
  old_page := pg_temp.discovery_p0_before(bbox,filters,200,before_at,before_id);
  next_page := public.rpc_list_open_tasks_v3(bbox,filters,200,before_at,before_id);
  select coalesce(jsonb_agg(item-'revision' order by ordinal),'[]'::jsonb) into stripped
    from jsonb_array_elements(next_page->'items') with ordinality as t(item,ordinal);
  if (old_page-'asOf') is distinct from (jsonb_set(next_page,'{items}',stripped)-'asOf')
     or exists(select 1 from jsonb_array_elements(next_page->'items') item
       where jsonb_typeof(item->'revision') is distinct from 'number' or (item->>'revision')::integer <= 0) then
    raise exception 'DISCOVERY_P0_ORDINARY_PARITY_FAILED';
  end if;
end
$body$;
create function pg_temp.discovery_p0_invalid(
  filters jsonb, bbox jsonb default null, before_at timestamptz default null,
  before_id uuid default null, page_limit integer default 1, expected text default 'INVALID_FILTER'
) returns void language plpgsql security invoker as $body$
declare refused boolean := false;
begin
  begin
    perform public.rpc_list_open_tasks_v3(bbox,filters,page_limit,before_at,before_id);
  exception when sqlstate '22023' then
    if sqlerrm <> expected then raise; end if;
    refused := true;
  end;
  if not refused then raise exception 'DISCOVERY_P0_EXPECTED_INVALID_INPUT'; end if;
end
$body$;
grant execute on function pg_temp.discovery_p0_parity(jsonb,jsonb,timestamptz,uuid),
  pg_temp.discovery_p0_invalid(jsonb,jsonb,timestamptz,uuid,integer,text) to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('discovery_p0.reader'),true);
select set_config('request.jwt.claims','',true);

do $normal_and_exact$
declare
  category text := current_setting('discovery_p0.category');
  filters jsonb; before_page jsonb; row jsonb; exact_page jsonb; label text;
  target uuid := current_setting('discovery_p0.pinned')::uuid;
  before_at timestamptz; before_id uuid;
begin
  perform pg_temp.discovery_p0_parity('{}');
  perform pg_temp.discovery_p0_parity(null);
  foreach filters in array array[
    jsonb_build_object('category',category),
    jsonb_build_object('category',category,'priceMode','OFFERS'),
    jsonb_build_object('category',category,'priceMode','MY_PRICE'),
    jsonb_build_object('category',category,'urgentOnly',true),
    jsonb_build_object('category',category,'remote','ONLY'),
    jsonb_build_object('category',category,'remote','EXCLUDE'),
    jsonb_build_object('category',category,'startsFrom',(statement_timestamp()-interval '1 day')::text),
    jsonb_build_object('category',category,'startsTo',(statement_timestamp()+interval '2 days')::text)
  ] loop perform pg_temp.discovery_p0_parity(filters); end loop;
  perform pg_temp.discovery_p0_parity(jsonb_build_object('category',category,'remote','EXCLUDE'),
    '{"west":19.7,"south":45.1,"east":19.9,"north":45.4}');
  before_page := pg_temp.discovery_p0_before(null,jsonb_build_object('category',category),200,null,null);
  if (before_page->>'hasMore')::boolean is distinct from true
     or exists(select 1 from jsonb_array_elements(before_page->'items') i where i->>'id'=target::text) then
    raise exception 'DISCOVERY_P0_FIXTURE_NOT_BEYOND_FIRST_PAGE';
  end if;
  row := before_page->'items'->199;
  before_at := (row->>'sortAt')::timestamptz; before_id := (row->>'id')::uuid;
  perform pg_temp.discovery_p0_parity(jsonb_build_object('category',category),null,before_at,before_id);
  before_page := pg_temp.discovery_p0_before(null,jsonb_build_object('category',category),200,before_at,before_id);

  foreach label in array array['pinned','remote','pointfree','selection'] loop
    target := current_setting('discovery_p0.'||label)::uuid;
    exact_page := public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',upper(target::text)),200,null,null);
    if jsonb_array_length(exact_page->'items') <> 1 or exact_page->>'hasMore' <> 'false'
       or (exact_page->>'asOf')::timestamptz is null
       or exact_page->'items'->0->>'id' <> target::text
       or (exact_page->'items'->0->>'revision')::integer <> 7 then
      raise exception 'DISCOVERY_P0_EXACT_ID_REVISION_BOUND_FAILED';
    end if;
    select item into strict row from jsonb_array_elements(before_page->'items') item where item->>'id'=target::text;
    if ((exact_page->'items'->0)-'revision') is distinct from row then raise exception 'DISCOVERY_P0_EXACT_ROW_PARITY_FAILED'; end if;
    if (exact_page->'items'->0) ?| array['description','requester_account_id','exact_address','access_notes',
       'public_photo_paths','marketplace_responses','remaining_search_close_reason','remaining_search_closed_by_account_id'] then
      raise exception 'DISCOVERY_P0_PRIVATE_FIELDS_EXPOSED';
    end if;
    if label in ('remote','pointfree') and exact_page->'items'->0->'pin' <> 'null'::jsonb then
      raise exception 'DISCOVERY_P0_INVENTED_POINT';
    end if;
    if (public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',target),1,null,null)->'items') <>
       (exact_page->'items') then raise exception 'DISCOVERY_P0_LIMIT_CHANGED_EXACT_RESULT'; end if;
  end loop;
  foreach label in array array['draft','closed','completed','missing'] loop
    exact_page := public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',current_setting('discovery_p0.'||label)),1,null,null);
    if exact_page->'items' <> '[]'::jsonb or exact_page->>'hasMore' <> 'false' then
      raise exception 'DISCOVERY_P0_NON_DISCOVERY_ROW_EXPOSED';
    end if;
  end loop;
end
$normal_and_exact$;

do $invalid$
declare filters jsonb; target uuid := current_setting('discovery_p0.pinned')::uuid;
begin
  foreach filters in array array[
    '{"needId":null}'::jsonb,'{"needId":123}','{"needId":true}','{"needId":[]}','{"needId":{}}',
    '{"needId":""}','{"needId":"not-a-uuid"}',jsonb_build_object('needId',' '||target),
    jsonb_build_object('needId',target,'category',current_setting('discovery_p0.category')),
    jsonb_build_object('needId',target,'remote','ONLY'),jsonb_build_object('needId',target,'unknown',true)
  ] loop perform pg_temp.discovery_p0_invalid(filters); end loop;
  filters := jsonb_build_object('needId',target);
  perform pg_temp.discovery_p0_invalid(filters,'{"west":19.7,"south":45.1,"east":19.9,"north":45.4}');
  perform pg_temp.discovery_p0_invalid(filters,null,statement_timestamp(),target);
  perform pg_temp.discovery_p0_invalid(filters,null,statement_timestamp(),null,1,'INVALID_PAGE');
  perform pg_temp.discovery_p0_invalid(filters,null,null,target,1,'INVALID_PAGE');
  perform pg_temp.discovery_p0_invalid(filters,null,null,null,0,'INVALID_PAGE');
  perform pg_temp.discovery_p0_invalid(filters,null,null,null,201,'INVALID_PAGE');
  perform pg_temp.discovery_p0_invalid(filters,null,null,null,null,'INVALID_PAGE');
end
$invalid$;

-- Owner visibility of drafts/history must never be enough to create a Discovery row.
select set_config('request.jwt.claim.sub',current_setting('discovery_p0.owner'),true);
do $owner$
declare label text; page jsonb;
begin
  foreach label in array array['draft','closed','completed'] loop
    page := public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',current_setting('discovery_p0.'||label)),1,null,null);
    if page->'items' <> '[]'::jsonb then raise exception 'DISCOVERY_P0_OWNER_BYPASSED_PUBLIC_PREDICATE'; end if;
  end loop;
end
$owner$;
-- Different data worlds must retain the same RLS exclusion as the predecessor.
select set_config('request.jwt.claim.sub',current_setting('discovery_p0.other'),true);
do $other_world$
declare page jsonb;
begin
  perform pg_temp.discovery_p0_parity(jsonb_build_object('category',current_setting('discovery_p0.category')));
  page := public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',current_setting('discovery_p0.pinned')),1,null,null);
  if page->'items' <> '[]'::jsonb then raise exception 'DISCOVERY_P0_WORLD_ISOLATION_FAILED'; end if;
end
$other_world$;

select set_config('request.jwt.claim.sub','',true);
do $unsigned$
declare refused boolean := false;
begin
  begin
    perform public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',current_setting('discovery_p0.pinned')),1,null,null);
  exception when sqlstate '28000' then refused := true;
  end;
  if not refused then raise exception 'DISCOVERY_P0_UNSIGNED_AUTHENTICATED_ROLE_ALLOWED'; end if;
end
$unsigned$;

reset role;
set local role anon;
do $anon$
declare refused boolean := false;
begin
  begin
    perform public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',current_setting('discovery_p0.pinned')),1,null,null);
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'DISCOVERY_P0_ANON_EXECUTE_ALLOWED'; end if;
end
$anon$;
reset role;
select pg_temp.discovery_p0_assert_unchanged();

rollback; -- All synthetic account/task/private-marker fixtures and proof helper functions are gone.

-- Successful proof restores the original reader. Never use this restore on canonical DEV.
begin;
do $restore$
begin
  execute (select definition from discovery_p0_proof_before);
  if md5(pg_get_functiondef('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure))
       <> '8a47d061da5f9bd65b5e3cc6c947d5d7'
     or private.closure_source_digest_v5() is distinct from (select digest from discovery_p0_proof_before)
     or (select to_jsonb(c) from private.closure_source_v5 c where singleton) is distinct from (select certificate from discovery_p0_proof_before)
     or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) is distinct from (select erasure_certificate from discovery_p0_proof_before)
     or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) is distinct from (select readiness_definition from discovery_p0_proof_before)
     or private.retention_ai_source_ready() is distinct from true then
    raise exception 'DISCOVERY_P0_PROOF_RESTORE_OR_CERTIFICATE_FAILED';
  end if;
end
$restore$;
commit;
drop function pg_temp.discovery_p0_before(jsonb,jsonb,integer,timestamptz,uuid);
drop table discovery_p0_proof_before;
\echo 'DISCOVERY_P0_EXACT_PUBLIC_LANDING_PROOF_PASS'
