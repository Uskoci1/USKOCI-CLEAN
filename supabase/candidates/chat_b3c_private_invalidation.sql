-- Chat B3c PREPARATION ONLY / NOT RUN / NOT DEPLOYABLE.
-- Transaction fragment, not a migration. The disposable proof owns BEGIN/ROLLBACK.
-- No certificate update or replacement readiness function is present. The changed
-- schema must remain uncertified until a separately reviewed recertification.
-- The marker prevents accidental execution; it is NOT a security boundary or proof
-- that a database is disposable. A local-only harness must attest its target first.
do $admission$
begin
  if current_setting('uskoci.chat_b3c_disposable_proof',true) is distinct from 'LOCAL_ONLY_ROLLBACK' then
    raise exception 'CHAT_B3C_CERTIFICATE_REVIEW_REQUIRED' using errcode='55000';
  end if;
end
$admission$;
set local lock_timeout='5s';
set local statement_timeout='30s';
create temporary table chat_b3c_before on commit drop as
select (select to_jsonb(c) from private.closure_source_v5 c where singleton) certificate,
       (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure_certificate,
       pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness,
       (select relacl::text from pg_class where oid='public.agreement_messages'::regclass) message_acl,
       (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p
        where schemaname='public' and tablename='agreement_messages') message_policies;

do $pre$
declare pin record; certified text;
begin
  if to_regclass('public.agreement_invalidations_v1') is not null
     or to_regprocedure('public.rpc_agreement_invalidation_visible_v1(uuid)') is not null
     or to_regprocedure('private.agreement_message_invalidate_v1()') is not null
     or to_regprocedure('private.agreement_invalidation_cleanup_v1()') is not null
     or to_regprocedure('private.agreement_invalidation_surface_v1()') is not null then
    raise exception 'CHAT_B3C_ALREADY_PRESENT' using errcode='55000';
  end if;
  for pin in select * from (values
    ('private.support_auth_v5(uuid)','66773994698c60b9fab919f2a9fda93a','plpgsql','v','uuid'),
    ('private.push_session_valid(uuid,uuid)','3454eb7040f3dab3cb0c35b512b46859','sql','v','boolean'),
    ('private.closure_assert_open(uuid,uuid)','dc9bc4c718593850da4fdb49e612dbd2','plpgsql','v','void'),
    ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad','sql','s','boolean'),
    ('private.closure_redaction_relations_v5()','5e2454071c0d588db0586c0a9893989a','sql','i','text[]'),
    ('private.closure_redaction_scope_v5(text)','495cfafd032ff4e1e35d305a6b6bb485','plpgsql','i','text'),
    ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','e9c5b731154bd231f9096ad58807d7c1','plpgsql','s','jsonb'),
    ('private.closure_schema_digest_v5_139()','988b9d3ab9c0dc7341cd30a391184e40','sql','s','text'),
    ('private.closure_source_digest_v5()','7840a7e70cd12bd599fa6d3bb3300cc7','sql','s','text'),
    ('private.closure_erasure_program_digest_v5()','3ec8d244730415d3a047312366672375','sql','s','text'),
    ('private.closure_erasure_binding_v5()','d6d7e7f6f108fff45a4df5126949fa04','plpgsql','s','jsonb')
  ) p(signature,body_md5,language_name,volatility,result_type) loop
    if not exists(select 1 from pg_proc where oid=to_regprocedure(pin.signature)
      and md5(replace(prosrc,E'\r\n',E'\n'))=pin.body_md5 and prosecdef
      and proconfig=array['search_path=pg_catalog'] and proowner='postgres'::regrole
      and prolang=(select oid from pg_language where lanname=pin.language_name)
      and provolatile::text=pin.volatility and not proisstrict and prokind='f'
      and pg_get_function_result(oid)=pin.result_type
      and proacl::text='{postgres=X/postgres}') then
      raise exception 'CHAT_B3C_PREDECESSOR_DRIFT: %',pin.signature using errcode='55000';
    end if;
  end loop;
  certified:=(select certificate->>'sha256' from chat_b3c_before);
  -- The admitted disposable replay has its own exact digest (catalog OIDs can differ).
  -- Pin readiness source after replacing only its one certified literal, not its logic.
  if not exists(select 1 from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure
      and (length(prosrc)-length(replace(prosrc,certified,'')))=length(certified)
      and md5(replace(replace(prosrc,E'\r\n',E'\n'),certified,'__CERTIFIED_SOURCE__'))='bc85a1a744869abb6441e647b18b2195'
      and prolang=(select oid from pg_language where lanname='sql') and provolatile='s' and not proisstrict
      and prorettype='boolean'::regtype and prokind='f'
      and prosecdef and proconfig=array['search_path=pg_catalog'] and proowner='postgres'::regrole and proacl::text='{postgres=X/postgres}') then
    raise exception 'CHAT_B3C_READINESS_PREDECESSOR_DRIFT';end if;
  if certified is null or certified is distinct from private.closure_source_digest_v5()
     or certified is distinct from (select erasure_certificate->>'sha256' from chat_b3c_before)
     or private.retention_ai_source_ready() is distinct from true
     or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from certified then
    raise exception 'CHAT_B3C_CLOSURE_PREDECESSOR_NOT_READY' using errcode='55000';
  end if;
  if (select relations from private.closure_dataset_catalog_v5 where data_class='AGREEMENT_MESSAGES')
      is distinct from array['public.agreement_messages','private.group_messages_v5','private.group_message_visibility_v5']::text[] then
    raise exception 'CHAT_B3C_CATALOG_DRIFT' using errcode='55000';
  end if;
  if not exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables
      and pubinsert and pubupdate and pubdelete and pubtruncate)
     or exists(select 1 from pg_publication_tables where pubname='supabase_realtime') then
    raise exception 'CHAT_B3C_PUBLICATION_DRIFT' using errcode='55000';
  end if;
end
$pre$;

create table public.agreement_invalidations_v1(
  agreement_id uuid primary key references public.agreements(id) on delete cascade,
  revision bigint not null check(revision>0)
);
comment on table public.agreement_invalidations_v1 is
  'Ephemeral body-free private-chat invalidation. Revision counts message inserts since this cache row was created; it resets after cache removal. Not a receipt or outbox. No history/backfill.';
alter table public.agreement_invalidations_v1 enable row level security;
alter table public.agreement_invalidations_v1 force row level security;
revoke all on public.agreement_invalidations_v1 from public,anon,authenticated,service_role;
grant select on public.agreement_invalidations_v1 to authenticated;

create function public.rpc_agreement_invalidation_visible_v1(p_agreement_id uuid)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog
as $visible$
declare u uuid; ag public.agreements;
begin
  if p_agreement_id is null then return false; end if;
  begin
    u:=private.support_auth_v5(auth.uid());
    select * into ag from public.agreements where id=p_agreement_id;
    if not found or (u is distinct from ag.requester_account_id and u is distinct from ag.worker_account_id)
      or ag.status not in('CONFIRMED','SUPERSEDED') then return false; end if;
    -- Per-event RLS: no cached channel-membership decision and no client-supplied account ID.
    perform private.closure_assert_open(ag.requester_account_id,ag.worker_account_id);
    perform private.support_auth_v5(u);
    return true;
  exception when sqlstate '28000' or sqlstate '42501' then return false;
  end;
end
$visible$;
revoke all on function public.rpc_agreement_invalidation_visible_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_agreement_invalidation_visible_v1(uuid) to authenticated;
create policy agreement_invalidations_read_v1 on public.agreement_invalidations_v1
for select to authenticated using(public.rpc_agreement_invalidation_visible_v1(agreement_id));

create function private.agreement_message_invalidate_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog as $arrival$
declare ag public.agreements;
begin
  -- No NEW row field except its Agreement ID enters the projection or any log.
  -- Serialize with lifecycle cleanup: a message cannot recreate the cache from a
  -- pre-terminal snapshot after the closing transaction deleted it.
  select * into ag from public.agreements where id=new.agreement_id for share;
  if not found or ag.status not in('CONFIRMED','SUPERSEDED')
    or private.closure_account_restricted(ag.requester_account_id)
    or private.closure_account_restricted(ag.worker_account_id) then return new; end if;
  insert into public.agreement_invalidations_v1 as cache(agreement_id,revision) values(ag.id,1)
  on conflict(agreement_id) do update set revision=cache.revision+1;
  return new;
end
$arrival$;
revoke all on function private.agreement_message_invalidate_v1() from public,anon,authenticated,service_role;
create trigger chat_b3c_invalidation_after_message after insert on public.agreement_messages
for each row execute function private.agreement_message_invalidate_v1();

create function private.agreement_invalidation_cleanup_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog as $cleanup$
begin
  if new.status not in('CONFIRMED','SUPERSEDED')
    or new.requester_account_id is distinct from old.requester_account_id
    or new.worker_account_id is distinct from old.worker_account_id then
    delete from public.agreement_invalidations_v1 where agreement_id=new.id;
  end if;
  return new;
end
$cleanup$;
revoke all on function private.agreement_invalidation_cleanup_v1() from public,anon,authenticated,service_role;
create trigger chat_b3c_invalidation_lifecycle after update of status,requester_account_id,worker_account_id
on public.agreements for each row execute function private.agreement_invalidation_cleanup_v1();

-- Integrate the account-linked cache into the existing class, ordered erasure
-- roster, exact party-owned scope and ordinary DELETE plan. Never retain it as evidence.
update private.closure_dataset_catalog_v5
set relations=relations||array['public.agreement_invalidations_v1'] where data_class='AGREEMENT_MESSAGES';
do $erasure$
declare def text; anchor text;
begin
  def:=pg_get_functiondef('private.closure_redaction_relations_v5()'::regprocedure);
  anchor:=$a$'public.agreement_messages','private.group_messages_v5'$a$;
  if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'CHAT_B3C_RELATIONS_ANCHOR_DRIFT';end if;
  execute replace(def,anchor,$a$'public.agreement_invalidations_v1',$a$||anchor);

  def:=pg_get_functiondef('private.closure_redaction_scope_v5(text)'::regprocedure);
  anchor:=$a$ when r='public.app_accounts' then 't.id=$1'$a$;
  if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'CHAT_B3C_SCOPE_ANCHOR_DRIFT';end if;
  execute replace(def,anchor,$a$ when r='public.agreement_invalidations_v1' then
  't.agreement_id in(select id from public.agreements where requester_account_id=$1 or worker_account_id=$1)'
$a$||anchor);

  def:=pg_get_functiondef('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure);
  anchor:=$a$ h:=encode(extensions.digest($a$;
  if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'CHAT_B3C_PATCH_ANCHOR_DRIFT';end if;
  execute replace(def,anchor,$a$ if r='public.agreement_invalidations_v1' then
  return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);end if;
$a$||anchor);
end
$erasure$;

-- Raw agreement_messages stays unpublished. The only two wire columns are UUID + revision.
-- Supabase DELETE changes do not evaluate row policies. This publication was
-- proved empty above, so disable DELETE/TRUNCATE before admitting its sole table.
-- The approved deployment contract must retain these flags for future additions.
alter publication supabase_realtime set(publish='insert,update');
alter publication supabase_realtime add table public.agreement_invalidations_v1;

-- Existing schema digest does not cover RLS policy expressions/publication membership.
-- Bind those plus the complete pg_proc rows of all four new functions, including
-- this digest helper itself. Reading its source/metadata does not execute it again.
-- The predecessor erasure-program roster is fixed, so adding source-body entries
-- there would not by itself bind new function volatility, language or other metadata.
create function private.agreement_invalidation_surface_v1() returns text
language sql stable security definer set search_path=pg_catalog as $surface$
select encode(extensions.digest(convert_to(jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'metadata',to_jsonb(p)) order by p.oid::regprocedure::text)
   from pg_proc p where p.oid in(select to_regprocedure(signature) from unnest(array[
     'public.rpc_agreement_invalidation_visible_v1(uuid)',
     'private.agreement_message_invalidate_v1()',
     'private.agreement_invalidation_cleanup_v1()',
     'private.agreement_invalidation_surface_v1()']::text[]) signature)
   having count(*)=4),
 'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p
   where schemaname='public' and tablename='agreement_invalidations_v1'),
 'publications',(select jsonb_agg(to_jsonb(p) order by pubname) from pg_publication_tables p
   where schemaname='public' and tablename in('agreement_invalidations_v1','agreement_messages')),
 'publicationFlags',(select jsonb_build_array(puballtables,pubinsert,pubupdate,pubdelete,pubtruncate)
   from pg_publication where pubname='supabase_realtime')
 )::text,'UTF8'),'sha256'),'hex')
$surface$;
revoke all on function private.agreement_invalidation_surface_v1() from public,anon,authenticated,service_role;

do $source$
declare def text; anchor text;
begin
  def:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
  anchor:=$a$private.closure_erasure_program_digest_v5()||':'||$a$;
  if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'CHAT_B3C_SOURCE_ANCHOR_DRIFT';end if;
  def:=replace(def,anchor,anchor||$a$private.agreement_invalidation_surface_v1()||':'||$a$);
  anchor:=$a$'private.closure_assert_current_v5(private.closure_executions_v5)'])$a$;
  if length(def)-length(replace(def,anchor,''))<>length(anchor) or strpos(def,'having count(*)=72')=0 then
    raise exception 'CHAT_B3C_SOURCE_ROSTER_DRIFT';end if;
  def:=replace(def,anchor,$a$'private.closure_assert_current_v5(private.closure_executions_v5)',
 'public.rpc_agreement_invalidation_visible_v1(uuid)','private.agreement_message_invalidate_v1()',
 'private.agreement_invalidation_cleanup_v1()','private.agreement_invalidation_surface_v1()'])$a$);
  execute replace(def,'having count(*)=72','having count(*)=76');
end
$source$;

do $post$
declare after_digest text;
begin
  if (select certificate from chat_b3c_before) is distinct from (select to_jsonb(c) from private.closure_source_v5 c where singleton)
    or (select erasure_certificate from chat_b3c_before) is distinct from (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)
    or (select readiness from chat_b3c_before) is distinct from pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) then
    raise exception 'CHAT_B3C_CERTIFICATE_MUST_NOT_MOVE';end if;
  after_digest:=private.closure_source_digest_v5();
  if after_digest is null or after_digest=(select certificate->>'sha256' from chat_b3c_before)
    or private.retention_ai_source_ready() is distinct from false
    or private.closure_erasure_binding_v5() is not null then raise exception 'CHAT_B3C_UNCERTIFIED_STATE_NOT_CLOSED';end if;
  if (select message_acl from chat_b3c_before) is distinct from (select relacl::text from pg_class where oid='public.agreement_messages'::regclass)
    or (select message_policies from chat_b3c_before) is distinct from
      (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='agreement_messages')
    or exists(select 1 from pg_publication_tables where schemaname='public' and tablename='agreement_messages')
    or (select count(*) from pg_publication_tables where pubname='supabase_realtime')<>1
    or not exists(select 1 from pg_publication where pubname='supabase_realtime' and pubinsert and pubupdate and not pubdelete and not pubtruncate and not puballtables) then
    raise exception 'CHAT_B3C_RAW_MESSAGE_SURFACE_CHANGED';end if;
  if exists(select 1 from public.agreement_invalidations_v1) then raise exception 'CHAT_B3C_NO_BACKFILL_ALLOWED';end if;
end
$post$;
-- NO COMMIT. Disposable caller must now prove behavior and ROLLBACK.
-- Deployment/recertification and authenticated websocket delivery remain unfinished.
