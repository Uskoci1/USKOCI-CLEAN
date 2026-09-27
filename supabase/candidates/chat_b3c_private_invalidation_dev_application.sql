-- B3c application candidate. NOT APPLIED; explicit live certificate approval required.
-- One atomic DO statement: exact existing install delta + three-place rebind.
-- Fresh DEV predecessor: ledger 208, 2026-09-27; see B3C_DEV_APPLICATION_PREPARATION.json.
-- Its DEV certificate/readiness hashes remain mandatory fresh apply preflight.
-- Portable source/complete metadata pins allow the SAME BYTES to run in disposable
-- CI; no test mode, substituted future OID or certificate bypass exists here.
do $b3c_application$
declare
  pin record; prior record; actual jsonb; before_surface jsonb; after_surface jsonb;
  expected_datasets jsonb; prior_publication_tables jsonb;
  expected_publications jsonb; old_source text; new_source text; definition text;
  source_row jsonb; erasure_row jsonb; affected integer;
  surface_query text := $surface_query$
    select jsonb_build_object(
      'relations',(select jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relnamespace,c.relowner,c.relkind,c.relacl,
        c.relrowsecurity,c.relforcerowsecurity,c.relreplident,c.relispartition,c.reloptions) order by c.oid)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in('public','private','rls_private') and c.relkind in('r','p')
          and c.oid is distinct from to_regclass('public.agreement_invalidations_v1')),
      'columns',(select jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum)
        from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in('public','private','rls_private') and c.relkind in('r','p')
          and a.attnum>0 and not a.attisdropped and c.oid is distinct from to_regclass('public.agreement_invalidations_v1')),
      'constraints',(select jsonb_agg(to_jsonb(x) order by x.oid)
        from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in('public','private','rls_private') and c.oid is distinct from to_regclass('public.agreement_invalidations_v1')),
      'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid)
        from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
        where (n.nspname in('public','private','rls_private') or c.oid='storage.objects'::regclass) and not t.tgisinternal
          and not(t.tgrelid='public.agreement_messages'::regclass and t.tgname='chat_b3c_invalidation_after_message')
          and not(t.tgrelid='public.agreements'::regclass and t.tgname='chat_b3c_invalidation_lifecycle')),
      'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p
        where schemaname in('public','private','rls_private') and not(schemaname='public' and tablename='agreement_invalidations_v1')),
      'indexes',(select jsonb_agg(to_jsonb(i) order by schemaname,indexname) from pg_indexes i
        where schemaname in('public','private','rls_private') and not(schemaname='public' and tablename='agreement_invalidations_v1'))
    )
  $surface_query$;
begin
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','30s',true);
  perform set_config('search_path','pg_catalog',true);
  if current_user<>'postgres' then raise exception 'CHAT_B3C_APPLICATION_OWNER_REQUIRED' using errcode='55000';end if;
  -- Hold closure writes until this atomic change commits. A check without this
  -- lock could admit a closure between the check and the certificate replacement.
  lock table private.closure_executions_v5 in share mode;
  lock table private.closure_source_v5,private.closure_erasure_source_v5,
    private.closure_dataset_catalog_v5 in share row exclusive mode;
  if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then
    raise exception 'CHAT_B3C_APPLICATION_CLOSURE_IN_FLIGHT' using errcode='55000';end if;
  if (select count(*) from private.closure_source_v5)<>1
    or (select count(*) from private.closure_erasure_source_v5)<>1 then
    raise exception 'CHAT_B3C_APPLICATION_CERTIFICATE_CARDINALITY' using errcode='55000';end if;
  for pin in select * from (values
    ('private.closure_account_restricted(uuid)','814dfd0286240ae2eec5a2d2a56bbe51'),
    ('private.closure_assert_open(uuid,uuid)','7b0a4e1be3205b5de509ddfc726e406a'),
    ('private.closure_erasure_binding_v5()','5b8021c77f85c119e95a41bbac2da3b1'),
    ('private.closure_erasure_program_digest_v5()','3b5059bc329407eface02b5b631d709d'),
    ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','6f2f71c85685d1c34f07c6b7eb8efc64'),
    ('private.closure_redaction_relations_v5()','30967acfddf4a189e7d97f1230ce286b'),
    ('private.closure_redaction_scope_v5(text)','1d9ea6d4b770cb0da939e87b2218e1eb'),
    ('private.closure_schema_digest_v5_139()','226adf4b6cd896c5fa48fcab19780f35'),
    ('private.closure_source_digest_v5()','7ade1ea4e26aa1f5a7fb8a84553b89d4'),
    ('private.push_session_valid(uuid,uuid)','b69a146d12476af01fc7f89b1228f537'),
    ('private.retention_ai_source_ready()','60d41c1d50dbaedd8cbcd7a580fc21d2'),
    ('private.support_auth_v5(uuid)','9437ac188420363cf6e3d13f7b4b4668')
  ) p(signature,metadata_md5) loop
    if (select md5(((to_jsonb(p)-'oid'-'pronamespace'-'proowner'-'prolang'-'proacl'-'prosrc')
        ||jsonb_build_object('namespace',n.nspname,'owner',pg_get_userbyid(p.proowner),
          'language',l.lanname,'acl',p.proacl::text))::text)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
      where p.oid=to_regprocedure(pin.signature)) is distinct from pin.metadata_md5 then
      raise exception 'CHAT_B3C_APPLICATION_METADATA_DRIFT' using errcode='55000';end if;
  end loop;
  execute surface_query into before_surface;
  create temporary table chat_b3c_application_functions on commit drop as
    select p.oid,p.oid::regprocedure::text signature,to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in('public','private','rls_private');
  select jsonb_agg(case when c.data_class='AGREEMENT_MESSAGES' then
    jsonb_set(to_jsonb(c),'{relations}',to_jsonb(c.relations||array['public.agreement_invalidations_v1']))
    else to_jsonb(c) end order by data_class) into expected_datasets from private.closure_dataset_catalog_v5 c;
  select jsonb_agg(case when pubname='supabase_realtime' then
      to_jsonb(p)||'{"pubdelete":false,"pubtruncate":false}'::jsonb else to_jsonb(p) end order by pubname)
    into expected_publications from pg_publication p;
  select jsonb_agg(to_jsonb(p) order by pubname,schemaname,tablename)
    into prior_publication_tables from pg_publication_tables p;
  select to_jsonb(c),sha256 into source_row,old_source from private.closure_source_v5 c where singleton;
  select to_jsonb(c) into erasure_row from private.closure_erasure_source_v5 c where singleton;
  select pg_get_functiondef(p.oid) into definition
    from pg_proc p where oid='private.retention_ai_source_ready()'::regprocedure;

  -- BEGIN EXACT PROVED INSTALL FRAGMENT (only the disposable admission is absent).
  execute $b3c_install$
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
$b3c_install$;
  -- END EXACT PROVED INSTALL FRAGMENT.
  -- Its existing preconditions proved both certificates/readiness/binding and
  -- all body/authority pins; its postconditions proved the closed uncertified state.
  new_source:=private.closure_source_digest_v5();
  if new_source is null or new_source=old_source or new_source!~'^[0-9a-f]{64}$' then
    raise exception 'CHAT_B3C_APPLICATION_NEW_SOURCE_INVALID' using errcode='55000';end if;
  if (length(definition)-length(replace(definition,old_source,'')))<>length(old_source)
    or (select count(*) from regexp_matches(definition,'[0-9a-f]{64}','g'))<>1 then
    raise exception 'CHAT_B3C_APPLICATION_READINESS_LITERAL_DRIFT' using errcode='55000';end if;

  update private.closure_source_v5 set sha256=new_source where singleton and sha256=old_source;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CHAT_B3C_APPLICATION_SOURCE_ROW_COUNT' using errcode='55000';end if;
  update private.closure_erasure_source_v5 set sha256=new_source where singleton and sha256=old_source;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'CHAT_B3C_APPLICATION_ERASURE_ROW_COUNT' using errcode='55000';end if;
  execute replace(definition,old_source,new_source);

  -- Compare the complete old function metadata. Only four exactly pinned bodies
  -- and the readiness literal may change; all other fields/old functions survive.
  for prior in select * from chat_b3c_application_functions loop
    select to_jsonb(p) into actual from pg_proc p where oid=prior.oid;
    if prior.signature='private.retention_ai_source_ready()' then
      if actual is distinct from jsonb_set(prior.metadata,'{prosrc}',
        to_jsonb(replace(prior.metadata->>'prosrc',old_source,new_source))) then
        raise exception 'CHAT_B3C_APPLICATION_READINESS_DELTA' using errcode='55000';end if;
    elsif prior.signature in('private.closure_redaction_relations_v5()','private.closure_redaction_scope_v5(text)',
      'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','private.closure_source_digest_v5()') then
      if actual-'prosrc' is distinct from prior.metadata-'prosrc' then
        raise exception 'CHAT_B3C_APPLICATION_FUNCTION_AUTHORITY_DELTA' using errcode='55000';end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'CHAT_B3C_APPLICATION_UNRELATED_FUNCTION_DELTA' using errcode='55000';
    end if;
  end loop;
  for pin in select * from (values
    ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','0779e304e719774679d8ffb2d7c67fd9'),
    ('private.closure_redaction_relations_v5()','c6d687219096c03371560cabb961cb0e'),
    ('private.closure_redaction_scope_v5(text)','3197a4c47582823d4474027bc49b4f84'),
    ('private.closure_source_digest_v5()','d67d37e2ebc5d9f85448693c0772f663')
  ) p(signature,body_md5) loop
    if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure(pin.signature))
      is distinct from pin.body_md5 then
      raise exception 'CHAT_B3C_APPLICATION_BODY_DELTA' using errcode='55000';end if;
  end loop;
  if (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','rls_private')
        and not exists(select 1 from chat_b3c_application_functions old where old.oid=p.oid))
      is distinct from array['private.agreement_invalidation_cleanup_v1()','private.agreement_invalidation_surface_v1()',
        'private.agreement_message_invalidate_v1()','public.rpc_agreement_invalidation_visible_v1(uuid)']::text[] then
    raise exception 'CHAT_B3C_APPLICATION_FUNCTION_ROSTER_DELTA' using errcode='55000';end if;
  execute surface_query into after_surface;
  -- New objects are constrained too; exclusion from the old-object comparison
  -- never admits extra columns, policies, grants, triggers or function metadata.
  for pin in select * from (values
    ('public.rpc_agreement_invalidation_visible_v1(uuid)','a6fa339bf03f8c8be69d9562d6c467c8','plpgsql','v','boolean','2950',array['p_agreement_id'],'{postgres=X/postgres,authenticated=X/postgres}'),
    ('private.agreement_message_invalidate_v1()','783b0c5322dfb1c1cbc0eec5df41c38f','plpgsql','v','trigger','',null,'{postgres=X/postgres}'),
    ('private.agreement_invalidation_cleanup_v1()','763c4e3a9499053b3884dec5723feed9','plpgsql','v','trigger','',null,'{postgres=X/postgres}'),
    ('private.agreement_invalidation_surface_v1()','a362fcc11419703eb07f07b4f82eebdb','sql','s','text','',null,'{postgres=X/postgres}')
  ) p(signature,body_md5,language_name,volatility,result_type,argtypes,argnames,acl) loop
    if not exists(select 1 from pg_proc p where p.oid=to_regprocedure(pin.signature)
      and md5(replace(prosrc,E'\r\n',E'\n'))=pin.body_md5 and prosecdef
      and proconfig=array['search_path=pg_catalog'] and proowner='postgres'::regrole
      and prolang=(select oid from pg_language where lanname=pin.language_name)
      and provolatile::text=pin.volatility and not proisstrict and prokind='f'
      and pg_get_function_result(oid)=pin.result_type and proargtypes::text=pin.argtypes
      and proargnames is not distinct from pin.argnames and proacl::text=pin.acl
      and procost=100 and prorows=0 and pronargdefaults=0 and not proretset and not proleakproof
      and proparallel='u' and prosupport=0 and provariadic=0 and probin is null and prosqlbody is null
      and protrftypes is null and proargdefaults is null and proallargtypes is null and proargmodes is null) then
      raise exception 'CHAT_B3C_APPLICATION_NEW_FUNCTION_DELTA' using errcode='55000';end if;
  end loop;
  if not exists(select 1 from pg_class where oid='public.agreement_invalidations_v1'::regclass
      and relowner='postgres'::regrole and relkind='r' and relpersistence='p' and not relispartition
      and relrowsecurity and relforcerowsecurity and relreplident='d' and reloptions is null
      and relacl=acldefault('r','postgres'::regrole)||array['authenticated=r/postgres'::aclitem])
    or (select array_agg(attname::text||':'||format_type(atttypid,atttypmod)||':'||attnotnull::text||':'||attidentity::text||':'||attgenerated::text order by attnum)
      from pg_attribute where attrelid='public.agreement_invalidations_v1'::regclass and attnum>0 and not attisdropped)
      is distinct from array['agreement_id:uuid:true::','revision:bigint:true::']::text[]
    or exists(select 1 from pg_attrdef where adrelid='public.agreement_invalidations_v1'::regclass)
    or (select array_agg(pg_get_constraintdef(oid) order by contype) from pg_constraint
      where conrelid='public.agreement_invalidations_v1'::regclass)
      is distinct from array['CHECK ((revision > 0))','FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE CASCADE','PRIMARY KEY (agreement_id)']::text[]
    or exists(select 1 from pg_constraint where conrelid='public.agreement_invalidations_v1'::regclass
      and (not convalidated or condeferrable or condeferred or not conislocal or coninhcount<>0))
    or (select count(*) from pg_index where indrelid='public.agreement_invalidations_v1'::regclass)<>1
    or not exists(select 1 from pg_index where indrelid='public.agreement_invalidations_v1'::regclass
      and indisprimary and indisunique and indisvalid and indisready and indnatts=1 and indnkeyatts=1
      and indkey='1'::int2vector and indexprs is null and indpred is null)
    or exists(select 1 from pg_trigger where tgrelid='public.agreement_invalidations_v1'::regclass and not tgisinternal)
    or (select count(*) from pg_policies where schemaname='public' and tablename='agreement_invalidations_v1')<>1
    or not exists(select 1 from pg_policies where schemaname='public' and tablename='agreement_invalidations_v1'
      and policyname='agreement_invalidations_read_v1' and permissive='PERMISSIVE' and roles=array['authenticated']::name[]
      and cmd='SELECT' and qual='public.rpc_agreement_invalidation_visible_v1(agreement_id)' and with_check is null) then
    raise exception 'CHAT_B3C_APPLICATION_NEW_TABLE_DELTA' using errcode='55000';end if;
  for pin in select * from (values
    ('public.agreement_messages','chat_b3c_invalidation_after_message','private.agreement_message_invalidate_v1()',5,array[]::text[]),
    ('public.agreements','chat_b3c_invalidation_lifecycle','private.agreement_invalidation_cleanup_v1()',17,array['requester_account_id','status','worker_account_id'])
  ) p(relation,trigger_name,signature,event_type,columns) loop
    if not exists(select 1 from pg_trigger t where tgrelid=pin.relation::regclass and tgname=pin.trigger_name
      and tgfoid=to_regprocedure(pin.signature) and tgtype=pin.event_type and tgenabled='O' and not tgisinternal
      and tgnargs=0 and octet_length(tgargs)=0 and tgqual is null and tgconstraint=0 and not tgdeferrable and not tginitdeferred
      and tgoldtable is null and tgnewtable is null and tgparentid=0
      and coalesce((select array_agg(a.attname::text order by a.attname) from unnest(t.tgattr) x(attnum)
        join pg_attribute a on a.attrelid=t.tgrelid and a.attnum=x.attnum),array[]::text[])=pin.columns) then
      raise exception 'CHAT_B3C_APPLICATION_NEW_TRIGGER_DELTA' using errcode='55000';end if;
  end loop;
  if after_surface is distinct from before_surface
    or (select jsonb_agg(to_jsonb(c) order by data_class) from private.closure_dataset_catalog_v5 c)
      is distinct from expected_datasets
    or (select jsonb_agg(to_jsonb(p) order by pubname) from pg_publication p)
      is distinct from expected_publications
    or (select jsonb_agg(to_jsonb(p) order by pubname,schemaname,tablename) from pg_publication_tables p
      where not(pubname='supabase_realtime' and schemaname='public' and tablename='agreement_invalidations_v1'))
      is distinct from prior_publication_tables
    or not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
      and tablename='agreement_invalidations_v1' and attnames=array['agreement_id','revision']::name[] and rowfilter is null) then
    raise exception 'CHAT_B3C_APPLICATION_UNRELATED_CATALOG_DELTA' using errcode='55000';end if;
  if (select to_jsonb(c) from private.closure_source_v5 c where singleton)
      is distinct from jsonb_set(source_row,'{sha256}',to_jsonb(new_source))
    or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)
      is distinct from jsonb_set(erasure_row,'{sha256}',to_jsonb(new_source))
    or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure)
      is distinct from replace(definition,old_source,new_source)
    or private.closure_source_digest_v5() is distinct from new_source
    or private.retention_ai_source_ready() is distinct from true
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from new_source then
    raise exception 'CHAT_B3C_APPLICATION_CERTIFIED_POSTCONDITION' using errcode='55000';end if;
  if exists(select 1 from private.closure_executions_v5 where state='EXECUTING')
    or exists(select 1 from public.agreement_invalidations_v1)
    or has_function_privilege('anon','private.retention_ai_source_ready()','EXECUTE')
    or has_function_privilege('authenticated','private.retention_ai_source_ready()','EXECUTE') then
    raise exception 'CHAT_B3C_APPLICATION_FINAL_AUTHORITY_OR_STATE_DRIFT' using errcode='55000';end if;
end
$b3c_application$;
