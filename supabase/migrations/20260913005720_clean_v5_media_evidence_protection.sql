-- D0141 protection of existing selected Task photographs. No new upload purpose,
-- retention duration, release authority, public grant or policy activation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table private.agreement_media_snapshots_v5 (
 agreement_id uuid not null,agreement_version integer not null,account_id uuid not null references public.app_accounts(id),
 need_id uuid not null references public.needs(id),need_revision integer not null check(need_revision>0),
 state text not null check(state in('RESOLVED','UNRESOLVED')),assets jsonb not null check(jsonb_typeof(assets)='array'),
 content_sha256 text not null check(content_sha256~'^[0-9a-f]{64}$'),captured_at timestamptz not null default clock_timestamp(),
 primary key(agreement_id,agreement_version),
 foreign key(agreement_id,agreement_version) references public.agreement_versions(agreement_id,version) on delete restrict
);
create table private.media_evidence_refs_v5 (
 -- Deliberately no parent FK: capture owns the media barrier before reading an
 -- asset; an UPDATE already owns its row before its BEFORE trigger. The delete
 -- guard below protects lifetime without reversing that lock order via FK locks.
 asset_id uuid not null,
 account_id uuid not null references public.app_accounts(id),
 source_kind text not null check(source_kind in('AGREEMENT_VERSION','AGREEMENT_PROBLEM','SAFETY_REPORT','RETENTION_HOLD')),
 source_id uuid not null,source_version bigint not null check(source_version>0),
 created_at timestamptz not null default clock_timestamp(),primary key(asset_id,source_kind,source_id,source_version)
);
create index media_evidence_owner_v5 on private.media_evidence_refs_v5(account_id,asset_id);
create table private.media_evidence_gaps_v5 (
 account_id uuid not null references public.app_accounts(id),source_kind text not null check(source_kind='SAFETY_REPORT'),
 source_id uuid not null references private.safety_reports(id) on delete restrict,
 reason text not null check(reason='HISTORICAL_MEDIA_CONTEXT_UNPROVEN'),created_at timestamptz not null default clock_timestamp(),
 primary key(source_kind,source_id)
);
alter table private.agreement_media_snapshots_v5 enable row level security;
alter table private.agreement_media_snapshots_v5 force row level security;
alter table private.media_evidence_refs_v5 enable row level security;
alter table private.media_evidence_refs_v5 force row level security;
alter table private.media_evidence_gaps_v5 enable row level security;
alter table private.media_evidence_gaps_v5 force row level security;
revoke all on private.agreement_media_snapshots_v5,private.media_evidence_refs_v5,private.media_evidence_gaps_v5 from public,anon,authenticated,service_role;
comment on table private.media_evidence_refs_v5 is 'D0141 private evidence references. A resolved case or inactive hold does not invent an approved evidence expiry. No release/purge writer is installed. Private case IDs never enter owner/export/public projections.';

create function private.media_evidence_key_v5(a uuid) returns bigint language sql immutable strict set search_path=pg_catalog
as $f$ select hashtextextended('uskoci:media-evidence:'||a::text,10139) $f$;
create function private.media_evidence_immutable_v5() returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$ begin raise exception 'MEDIA_EVIDENCE_IMMUTABLE' using errcode='55000';end $f$;
create trigger media_snapshot_immutable_v5 before update or delete on private.agreement_media_snapshots_v5
 for each row execute function private.media_evidence_immutable_v5();
create trigger media_evidence_immutable_v5 before update or delete on private.media_evidence_refs_v5
 for each row execute function private.media_evidence_immutable_v5();
create trigger media_evidence_gap_immutable_v5 before update or delete on private.media_evidence_gaps_v5
 for each row execute function private.media_evidence_immutable_v5();

create function private.resolve_media_snapshot_v5(owner_id uuid,paths jsonb) returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$ declare assets jsonb:='[]';value jsonb;p text;m private.owned_media_assets;resolved boolean:=true;begin
 if jsonb_typeof(paths) is distinct from 'array' then return jsonb_build_object('resolved',false,'assets',assets);end if;
 if jsonb_array_length(paths)>6 then return jsonb_build_object('resolved',false,'assets',assets);end if;
 for value in select x from jsonb_array_elements(paths) x loop
  if jsonb_typeof(value) is distinct from 'string' then resolved:=false;continue;end if;p:=value#>>'{}';
  select * into m from private.owned_media_assets where account_id=owner_id and storage_path=p and scope='TASK' and state='READY' and dispatch_outcome='STORED'
   and storage_path=account_id::text||'/v5/'||id::text||'/'||sanitized_sha256||'.jpg';
  if m.id is null or not exists(select 1 from storage.objects where bucket_id='profile-media' and name=p) then resolved:=false;continue;end if;
  assets:=assets||jsonb_build_array(jsonb_build_object('assetId',m.id,'path',m.storage_path,'sha256',m.sanitized_sha256,'width',m.width,'height',m.height,'byteSize',m.byte_size));
 end loop;
 if jsonb_array_length(paths)<>(select count(distinct x->>'assetId') from jsonb_array_elements(assets) x) then resolved:=false;end if;
 return jsonb_build_object('resolved',resolved,'assets',assets);
end $f$;

-- A historical reconstruction is admitted only from the same recorded revision.
-- Missing/malformed historical bytes produce UNRESOLVED, never an empty invented snapshot.
create function private.capture_agreement_media_v5(aid uuid,ver integer,strict_capture boolean) returns void
language plpgsql security definer set search_path=pg_catalog as $f$
declare a public.agreements;n public.needs;s public.need_selections;previous private.agreement_media_snapshots_v5;
 paths jsonb;assets jsonb:='[]';resolution jsonb;resolved boolean:=true;doc jsonb;
begin
 if exists(select 1 from private.agreement_media_snapshots_v5 where agreement_id=aid and agreement_version=ver) then return;end if;
 select * into a from public.agreements where id=aid;
 select * into n from public.needs where id=a.need_id;
 select * into s from public.need_selections where id=a.selection_id;
 if a.id is null or n.id is null or s.need_id is distinct from n.id or not exists(select 1 from public.agreement_versions where agreement_id=aid and version=ver)
 then raise exception 'MEDIA_EVIDENCE_CONTEXT_INVALID' using errcode='55000';end if;
 perform pg_advisory_xact_lock(private.media_evidence_key_v5(a.requester_account_id));
 if ver>1 then
  select * into previous from private.agreement_media_snapshots_v5 where agreement_id=aid and agreement_version<ver order by agreement_version desc limit 1;
  resolved:=previous.agreement_id is not null and previous.state='RESOLVED';assets:=coalesce(previous.assets,'[]');
 else
  if n.revision=s.need_revision then paths:=to_jsonb(n.public_photo_paths);
  else
   select previous_material_snapshot->'publicPhotoPaths' into paths from private.need_revision_events where need_id=n.id and from_revision=s.need_revision;
   if paths is null then select new_material_snapshot->'publicPhotoPaths' into paths from private.need_revision_events where need_id=n.id and to_revision=s.need_revision;end if;
  end if;
  resolution:=private.resolve_media_snapshot_v5(a.requester_account_id,paths);resolved:=(resolution->>'resolved')::boolean;assets:=resolution->'assets';
 end if;
 if strict_capture and not resolved then raise exception 'MEDIA_EVIDENCE_SOURCE_NOT_READY' using errcode='55000';end if;
 doc:=jsonb_build_object('agreementId',aid,'version',ver,'needId',n.id,'needRevision',s.need_revision,'state',case when resolved then 'RESOLVED' else 'UNRESOLVED' end,'assets',assets);
 insert into private.agreement_media_snapshots_v5(agreement_id,agreement_version,account_id,need_id,need_revision,state,assets,content_sha256)
 values(aid,ver,a.requester_account_id,n.id,s.need_revision,doc->>'state',assets,encode(extensions.digest(convert_to(doc::text,'UTF8'),'sha256'),'hex'));
 insert into private.media_evidence_refs_v5(asset_id,account_id,source_kind,source_id,source_version)
 select (x->>'assetId')::uuid,a.requester_account_id,'AGREEMENT_VERSION',aid,ver from jsonb_array_elements(assets) x on conflict do nothing;
end $f$;
create function private.capture_agreement_media_trigger_v5() returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$ begin perform private.capture_agreement_media_v5(new.agreement_id,new.version,true);return new;end $f$;
create trigger media_agreement_snapshot_v5 after insert on public.agreement_versions
 for each row execute function private.capture_agreement_media_trigger_v5();

-- Cases retain only already stored Task photographs in their actual context.
-- They never create new media uploads, expose reports, or send pixels to AI.
create function private.capture_case_media_v5(kind text,sid uuid,ver bigint,aid uuid,nid uuid,owner_id uuid,conversation uuid default null) returns void
language plpgsql security definer set search_path=pg_catalog as $f$
declare own uuid;n public.needs;
begin
 if kind='RETENTION_HOLD' then
  select h.account_id into own from private.retention_holds h where h.id=sid and h.account_id=owner_id and h.revision=ver and h.active and h.conversation_id is not distinct from conversation;
 elsif kind='SAFETY_REPORT' then
  if not exists(select 1 from private.safety_reports r where r.id=sid and r.agreement_id is not distinct from aid and r.need_id is not distinct from nid) then raise exception 'MEDIA_EVIDENCE_CONTEXT_INVALID';end if;
  if aid is not null then select a.requester_account_id,a.need_id into own,nid from public.agreements a where a.id=aid;
  elsif nid is not null then select requester_account_id into own from public.needs where id=nid;end if;
 elsif kind='AGREEMENT_PROBLEM' then
  select a.requester_account_id,a.need_id into own,nid from public.agreements a join public.agreement_execution e on e.agreement_id=a.id
  where a.id=aid and sid=aid and e.agreement_version=ver and e.problem_opened_at is not null;
 else raise exception 'MEDIA_EVIDENCE_CONTEXT_INVALID';end if;
 if own is null then return;end if;
 perform pg_advisory_xact_lock(private.media_evidence_key_v5(own));
 if kind='RETENTION_HOLD' then
  insert into private.media_evidence_refs_v5(asset_id,account_id,source_kind,source_id,source_version)
  select m.id,own,kind,sid,ver from private.owned_media_assets m where m.account_id=own and (conversation is null or m.conversation_id=conversation) on conflict do nothing;
 elsif aid is not null then
  insert into private.media_evidence_refs_v5(asset_id,account_id,source_kind,source_id,source_version)
  select distinct r.asset_id,own,kind,sid,ver from private.media_evidence_refs_v5 r where r.account_id=own and r.source_kind='AGREEMENT_VERSION' and r.source_id=aid on conflict do nothing;
 else
  select * into n from public.needs where id=nid;
  insert into private.media_evidence_refs_v5(asset_id,account_id,source_kind,source_id,source_version)
  select m.id,own,kind,sid,ver from private.owned_media_assets m where m.account_id=own and m.scope='TASK' and m.storage_path=any(n.public_photo_paths) on conflict do nothing;
 end if;
end $f$;
create function private.capture_case_media_trigger_v5() returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$ begin
 if tg_table_name='safety_reports' then perform private.capture_case_media_v5('SAFETY_REPORT',new.id,1,new.agreement_id,new.need_id,null);
 elsif tg_table_name='agreement_execution' then
  if new.problem_opened_at is not null and (tg_op='INSERT' or old.problem_opened_at is null) then perform private.capture_case_media_v5('AGREEMENT_PROBLEM',new.agreement_id,new.agreement_version,new.agreement_id,null,null);end if;
 elsif tg_table_name='retention_holds' then
  if new.active then perform private.capture_case_media_v5('RETENTION_HOLD',new.id,new.revision,null,null,new.account_id,new.conversation_id);end if;
 end if;return new;
end $f$;
create trigger media_safety_evidence_v5 after insert on private.safety_reports for each row execute function private.capture_case_media_trigger_v5();
create trigger media_problem_evidence_v5 after insert or update of problem_opened_at on public.agreement_execution for each row execute function private.capture_case_media_trigger_v5();
create trigger media_hold_evidence_v5 after insert or update on private.retention_holds for each row execute function private.capture_case_media_trigger_v5();
-- Assets created while a hold is active are covered too, including pending uploads.
create function private.capture_media_active_hold_v5() returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$ begin
 perform pg_advisory_xact_lock(private.media_evidence_key_v5(new.account_id));
 insert into private.media_evidence_refs_v5(asset_id,account_id,source_kind,source_id,source_version)
 select new.id,new.account_id,'RETENTION_HOLD',h.id,h.revision from private.retention_holds h where h.account_id=new.account_id and h.active and (h.conversation_id is null or h.conversation_id=new.conversation_id) on conflict do nothing;
 return new;
end $f$;
create trigger media_new_asset_hold_v5 after insert on private.owned_media_assets for each row execute function private.capture_media_active_hold_v5();

-- Historical evidence is reconstructed before the destructive guard is admitted.
do $backfill$ declare x record;begin
 for x in select agreement_id,version from public.agreement_versions order by agreement_id,version loop perform private.capture_agreement_media_v5(x.agreement_id,x.version,false);end loop;
 for x in select * from private.safety_reports order by id loop
  if x.agreement_id is not null then perform private.capture_case_media_v5('SAFETY_REPORT',x.id,1,x.agreement_id,x.need_id,null);
  elsif x.need_id is not null then
   insert into private.media_evidence_gaps_v5(account_id,source_kind,source_id,reason)
   select requester_account_id,'SAFETY_REPORT',x.id,'HISTORICAL_MEDIA_CONTEXT_UNPROVEN' from public.needs where id=x.need_id;
  end if;
 end loop;
 for x in select * from public.agreement_execution where problem_opened_at is not null order by agreement_id loop perform private.capture_case_media_v5('AGREEMENT_PROBLEM',x.agreement_id,x.agreement_version,x.agreement_id,null,null);end loop;
 for x in select * from private.retention_holds where active order by id loop perform private.capture_case_media_v5('RETENTION_HOLD',x.id,x.revision,null,null,x.account_id,x.conversation_id);end loop;
end $backfill$;

create function private.media_owner_protected_v5(a uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $f$
 select exists(select 1 from private.media_evidence_refs_v5 where account_id=a)
 or exists(select 1 from private.agreement_media_snapshots_v5 where account_id=a and state='UNRESOLVED')
 or exists(select 1 from private.media_evidence_gaps_v5 where account_id=a) $f$;
create function private.guard_media_evidence_storage_v5() returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$ declare own uuid;protected boolean;begin
 if old.bucket_id<>'profile-media' then return case when tg_op='DELETE' then old else new end;end if;
 if split_part(old.name,'/',1)~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then own:=split_part(old.name,'/',1)::uuid;end if;
 if own is null then return case when tg_op='DELETE' then old else new end;end if;
 perform pg_advisory_xact_lock(private.media_evidence_key_v5(own));
 select exists(select 1 from private.owned_media_assets m join private.media_evidence_refs_v5 r on r.asset_id=m.id and r.account_id=m.account_id where m.account_id=own and m.storage_path=old.name)
 or exists(select 1 from private.agreement_media_snapshots_v5 where account_id=own and state='UNRESOLVED')
 or exists(select 1 from private.media_evidence_gaps_v5 where account_id=own)
 or exists(select 1 from private.retention_holds h where h.account_id=own and h.active and (h.conversation_id is null or exists(select 1 from private.owned_media_assets m where m.account_id=own and m.storage_path=old.name and m.conversation_id=h.conversation_id))) into protected;
 if protected and (tg_op='DELETE' or (to_jsonb(new)-array['last_accessed_at']) is distinct from (to_jsonb(old)-array['last_accessed_at']))
 then raise exception 'MEDIA_EVIDENCE_POLICY_NOT_READY' using errcode='55000';end if;
 return case when tg_op='DELETE' then old else new end;
end $f$;
create trigger media_evidence_storage_v5 before delete or update on storage.objects for each row execute function private.guard_media_evidence_storage_v5();

-- UI detachment stays possible. A protected, staged immutable derivative cannot
-- be redirected to another path/hash/owner to evade the physical object guard.
create function private.guard_media_evidence_asset_v5() returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$ begin
 perform pg_advisory_xact_lock(private.media_evidence_key_v5(old.account_id));
 if (exists(select 1 from private.media_evidence_refs_v5 where asset_id=old.id)
 or exists(select 1 from private.media_evidence_gaps_v5 where account_id=old.account_id)
 or exists(select 1 from private.agreement_media_snapshots_v5 where account_id=old.account_id and state='UNRESOLVED')) and
 (tg_op='DELETE' or (new.id,new.account_id,new.scope,new.conversation_id,new.profile_id) is distinct from (old.id,old.account_id,old.scope,old.conversation_id,old.profile_id)
 or (old.storage_path is not null and (new.storage_path,new.sanitized_sha256,new.width,new.height,new.byte_size) is distinct from (old.storage_path,old.sanitized_sha256,old.width,old.height,old.byte_size))
 or (old.state='READY' and new.state is distinct from old.state))
 then raise exception 'MEDIA_EVIDENCE_IMMUTABLE' using errcode='55000';end if;
 return case when tg_op='DELETE' then old else new end;
end $f$;
create trigger media_evidence_asset_v5 before update or delete on private.owned_media_assets for each row execute function private.guard_media_evidence_asset_v5();

do $closure$ declare d text;needle text;begin
 d:=pg_get_functiondef('private.closure_blockers_v5(uuid)'::regprocedure);needle:=' return codes;';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'MEDIA_CLOSURE_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,E' if private.media_owner_protected_v5(a) then codes:=array_append(codes,''MEDIA_EVIDENCE_POLICY_NOT_READY'');end if;\n return codes;');
 d:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
 needle:='n.nspname in(''public'',''private'') and c.relkind in(''r'',''p'')';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'MEDIA_CLOSURE_SOURCE_DRIFT';end if;
 execute replace(d,needle,'(n.nspname in(''public'',''private'') or c.oid=''storage.objects''::regclass) and c.relkind in(''r'',''p'')');
end $closure$;
-- Trigger topology alone does not attest helpers called by those triggers.
-- Bind their exact source as well; a changed helper closes the reviewed policy.
do $digest$ begin execute replace(pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure),'private.closure_source_digest_v5()','private.closure_schema_digest_v5_139()');end $digest$;
create or replace function private.closure_source_digest_v5() returns text language sql stable security definer set search_path=pg_catalog as $f$
 select encode(extensions.digest(convert_to(private.closure_schema_digest_v5_139()||':'||string_agg(signature||':'||md5(p.prosrc),E'\n' order by signature),'UTF8'),'sha256'),'hex')
 from unnest(array['private.capture_agreement_media_v5(uuid,integer,boolean)','private.capture_case_media_v5(text,uuid,bigint,uuid,uuid,uuid,uuid)',
 'private.media_owner_protected_v5(uuid)','private.media_evidence_key_v5(uuid)','private.closure_blockers_v5(uuid)','private.resolve_media_snapshot_v5(uuid,jsonb)']) signature
 join pg_proc p on p.oid=to_regprocedure(signature) having count(*)=6
$f$;
revoke all on function private.closure_source_digest_v5(),private.closure_schema_digest_v5_139() from public,anon,authenticated,service_role;
update private.closure_dataset_catalog_v5 set relations=relations||array['private.agreement_media_snapshots_v5','private.media_evidence_refs_v5','private.media_evidence_gaps_v5'] where data_class='MEDIA_OBJECTS';

-- Owner export exposes own accepted Task media metadata only. It cannot reveal
-- a private report against the owner, its ID, source count, hold key or narrative.
do $export$ declare catalog jsonb;d text;needle text;replacement text;begin
 catalog:=private.data_export_dataset_catalog();
 if jsonb_array_length(catalog)<>41 then raise exception 'MEDIA_EXPORT_PREDECESSOR_DRIFT';end if;
 catalog:=catalog||'[{"key":"ownAcceptedTaskMedia","dataClass":"MEDIA_OBJECTS","fields":["agreementId","agreementVersion","needId","needRevision","state","assets","capturedAt","bytesIncluded"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT and a.requester_account_id=REQUEST_ACCOUNT"}]'::jsonb;
 execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$',catalog::text);
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 needle:='from private.agreement_location_commands t join public.agreements a on a.id=t.agreement_id where t.actor_account_id=p_account_id and p_account_id in(a.requester_account_id,a.worker_account_id)),';
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'''OWN_ACCOUNT_V5_3''')=0 then raise exception 'MEDIA_EXPORT_PREDECESSOR_DRIFT';end if;
 replacement:=$rows$from private.agreement_location_commands t join public.agreements a on a.id=t.agreement_id where t.actor_account_id=p_account_id and p_account_id in(a.requester_account_id,a.worker_account_id)
union all
select 'ownAcceptedTaskMedia' as key,jsonb_build_object('agreementId',t.agreement_id,'agreementVersion',t.agreement_version,'needId',t.need_id,'needRevision',t.need_revision,'state',t.state,'capturedAt',t.captured_at,'bytesIncluded',false,
 'assets',(select coalesce(jsonb_agg(jsonb_build_object('assetId',x->>'assetId','width',private.data_export_scalar_v5(x->'width','number'),'height',private.data_export_scalar_v5(x->'height','number'),'byteSize',private.data_export_scalar_v5(x->'byteSize','number')) order by ordinal),'[]') from jsonb_array_elements(t.assets) with ordinality as j(x,ordinal))) as value
 from private.agreement_media_snapshots_v5 t join public.agreements a on a.id=t.agreement_id where t.account_id=p_account_id and a.requester_account_id=p_account_id),$rows$;
 execute replace(replace(d,needle,replacement),'''OWN_ACCOUNT_V5_3''','''OWN_ACCOUNT_V5_4''');
 d:=pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
 if strpos(d,'''OWN_ACCOUNT_V5_3''')=0 or strpos(d,'jsonb_array_length(m->''datasets'')<>41')=0 then raise exception 'MEDIA_EXPORT_PREDECESSOR_DRIFT';end if;
 execute replace(replace(d,'''OWN_ACCOUNT_V5_3''','''OWN_ACCOUNT_V5_4'''),'jsonb_array_length(m->''datasets'')<>41','jsonb_array_length(m->''datasets'')<>42');
end $export$;
do $acl$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='private'::regnamespace and proname in('media_evidence_key_v5','media_evidence_immutable_v5','resolve_media_snapshot_v5','capture_agreement_media_v5','capture_agreement_media_trigger_v5','capture_case_media_v5','capture_case_media_trigger_v5','capture_media_active_hold_v5','media_owner_protected_v5','guard_media_evidence_storage_v5','guard_media_evidence_asset_v5') loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $acl$;
update private.closure_source_v5 set sha256=private.closure_source_digest_v5() where singleton;
notify pgrst,'reload schema';
commit;
