-- AF-D07: trusted sanitized media in the existing private Storage bucket.
-- No public bucket, retention duration, cleanup scheduler or paid provider call.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table private.owned_media_assets (
 id uuid primary key default extensions.gen_random_uuid(), account_id uuid not null,
 scope text not null check(scope in('TASK','AVATAR')), conversation_id uuid, profile_id uuid,
 client_request_id uuid not null, input_sha256 text not null check(input_sha256~'^[a-f0-9]{64}$'),
 input_bytes integer not null check(input_bytes between 1 and 10485760), input_type text not null check(input_type in('image/jpeg','image/png','image/webp')),
 state text not null default 'PROCESSING' check(state in('PROCESSING','STAGED','READY','FAILED')),
 attempt_id uuid not null default extensions.gen_random_uuid(), selected boolean not null default true,
 dispatch_state text not null default 'NOT_DISPATCHED' check(dispatch_state in('NOT_DISPATCHED','DISPATCHING','SETTLED')),
 dispatch_outcome text check(dispatch_outcome in('STORED','REJECTED')),
 avatar_source_marker text check(avatar_source_marker~'^[a-f0-9]{64}$'), avatar_apply_receipt jsonb,
 sanitized_sha256 text check(sanitized_sha256~'^[a-f0-9]{64}$'), storage_path text unique,
 width integer check(width between 1 and 1600), height integer check(height between 1 and 1600),
 byte_size integer check(byte_size between 1 and 5242880), created_at timestamptz not null default clock_timestamp(),
 unique(account_id,client_request_id),
 check((dispatch_state='SETTLED')=(dispatch_outcome is not null)),
 check((scope='TASK' and conversation_id is not null and profile_id is null) or (scope='AVATAR' and conversation_id is null and profile_id is not null)),
 check((state in('STAGED','READY'))=(sanitized_sha256 is not null and storage_path is not null and width is not null and height is not null and byte_size is not null))
);
create index owned_media_conversation on private.owned_media_assets(account_id,conversation_id,created_at,id);
create index owned_media_profile on private.owned_media_assets(account_id,profile_id,created_at,id);
alter table private.owned_media_assets enable row level security;
revoke all on private.owned_media_assets from public,anon,authenticated,service_role;

-- Existing clients retain the legacy owner path policies. New immutable V5 paths
-- are writable only by the trusted Storage service, never the bearer owner.
create policy v5_media_no_client_insert on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'profile-media' or (storage.foldername(name))[2] is distinct from 'v5');
create policy v5_media_no_client_update on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'profile-media' or (storage.foldername(name))[2] is distinct from 'v5')
 with check(bucket_id<>'profile-media' or (storage.foldername(name))[2] is distinct from 'v5');
create policy v5_media_no_client_delete on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'profile-media' or (storage.foldername(name))[2] is distinct from 'v5');

create function private.media_asset_document(a private.owned_media_assets) returns jsonb
language sql immutable set search_path=pg_catalog as $f$
 select jsonb_build_object('assetId',a.id,'accountId',a.account_id,'scope',a.scope,'conversationId',a.conversation_id,'profileId',a.profile_id,
  'clientRequestId',a.client_request_id,'state',a.state,'selected',a.selected,'ref',case when a.state='READY' then a.storage_path else null end,
  'sha256',case when a.state='READY' then a.sanitized_sha256 else null end,'width',case when a.state='READY' then a.width else null end,
  'height',case when a.state='READY' then a.height else null end,'byteSize',case when a.state='READY' then a.byte_size else null end,
  'contentType','image/jpeg','authoritative',true);
$f$;
create function private.media_task_refs(cid uuid) returns text[] language sql stable security definer set search_path=pg_catalog as $f$
 select coalesce(array(select jsonb_array_elements_text(f.fact_value) from public.ai_structured_facts f where f.conversation_id=cid
  and f.fact_key='need.public_photo_paths' and f.superseded_at is null order by f.id),'{}'::text[]);
$f$;
create function private.media_refs_ready(aid uuid,refs text[]) returns boolean language sql stable security definer set search_path=pg_catalog as $f$
 select cardinality(coalesce(refs,'{}'::text[]))<=6 and cardinality(coalesce(refs,'{}'::text[]))=(select count(distinct x) from unnest(refs) x)
  and not exists(select 1 from unnest(refs) x where not exists(select 1 from private.owned_media_assets a
   where a.account_id=aid and a.scope='TASK' and a.state='READY' and a.storage_path=x));
$f$;
create function private.media_assert_task_edit(aid uuid,cid uuid) returns public.ai_conversations
language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;
begin
 perform private.closure_assert_open(aid);
 select * into c from public.ai_conversations where id=cid and account_id=aid for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 if c.status<>'OPEN' then raise exception 'MEDIA_NOT_EDITABLE' using errcode='55000'; end if;
 if exists(select 1 from private.ai_need_turn_commands where conversation_id=cid and state='PROCESSING') then raise exception 'MEDIA_TURN_PENDING' using errcode='55000'; end if;
 return c;
end $f$;
create function private.media_write_task_refs(c public.ai_conversations,refs text[]) returns void
language plpgsql security definer set search_path=pg_catalog as $f$
declare old_fact public.ai_structured_facts; fid uuid:=extensions.gen_random_uuid();
begin
 if not private.media_refs_ready(c.account_id,refs) then raise exception 'PUBLIC_MEDIA_NOT_READY' using errcode='22023'; end if;
 select * into old_fact from public.ai_structured_facts where conversation_id=c.id and fact_key='need.public_photo_paths' and superseded_at is null for update;
 if found and old_fact.fact_value=to_jsonb(refs) then return; end if;
 if old_fact.id is not null then update public.ai_structured_facts set superseded_at=clock_timestamp() where id=old_fact.id; end if;
 insert into public.ai_structured_facts(id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
  confidence,fact_schema_version,value_type,display_value)
 values(fid,c.account_id,c.id,c.bound_need_id,'need.public_photo_paths',to_jsonb(refs),'NEEDS_CONFIRMATION','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,
  'NEED_FACT_V2','TEXT_ARRAY',case when cardinality(refs)=0 then 'Bez fotografija' else cardinality(refs)::text||' fotografija' end);
 if old_fact.id is not null then update public.ai_structured_facts set superseded_by=fid where id=old_fact.id; end if;
 update public.ai_conversations set status='OPEN' where id=c.id;
end $f$;

create function public.rpc_claim_media_upload_service(p_account_id uuid,p_scope text,p_target_id uuid,p_client_request_id uuid,
 p_input_sha256 text,p_input_bytes integer,p_input_type text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets; c public.ai_conversations; refs text[]; avatar_marker text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_account_id is null or p_target_id is null or p_client_request_id is null or p_scope is null or p_scope not in('TASK','AVATAR')
  or p_input_sha256 is null or p_input_sha256!~'^[a-f0-9]{64}$' or p_input_bytes is null or p_input_bytes not between 1 and 10485760
  or p_input_type is null or p_input_type not in('image/jpeg','image/png','image/webp') then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023'; end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||p_account_id::text||':'||p_client_request_id::text,130));
 select * into a from private.owned_media_assets where account_id=p_account_id and client_request_id=p_client_request_id;
 if found then
  if a.scope is distinct from p_scope or coalesce(a.conversation_id,a.profile_id) is distinct from p_target_id or a.input_sha256 is distinct from p_input_sha256
   or a.input_bytes is distinct from p_input_bytes or a.input_type is distinct from p_input_type then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
  return jsonb_build_object('acquired',false,'attemptId',null,'asset',private.media_asset_document(a),'staged',case when a.state='STAGED' then
   jsonb_build_object('path',a.storage_path,'sha256',a.sanitized_sha256,'byteSize',a.byte_size,'dispatchState',a.dispatch_state,'dispatchOutcome',a.dispatch_outcome) else null end);
 end if;
 if p_scope='TASK' then
  c:=private.media_assert_task_edit(p_account_id,p_target_id); refs:=private.media_task_refs(c.id);
  if cardinality(refs)+(select count(*) from private.owned_media_assets where conversation_id=c.id and selected and state in('PROCESSING','STAGED'))>=6
   then raise exception 'MEDIA_LIMIT_REACHED' using errcode='22023'; end if;
 else
  perform 1 from public.app_profiles where id=p_target_id and account_id=p_account_id and profile_status in('DRAFT','ACTIVE') for update;
  if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
  if exists(select 1 from private.owned_media_assets where profile_id=p_target_id and selected and state in('PROCESSING','STAGED'))
   then raise exception 'MEDIA_UPLOAD_PENDING' using errcode='55000'; end if;
  select encode(extensions.digest(to_jsonb(p)::text,'sha256'),'hex') into avatar_marker from public.app_profiles p where p.id=p_target_id;
 end if;
 insert into private.owned_media_assets(account_id,scope,conversation_id,profile_id,client_request_id,input_sha256,input_bytes,input_type,avatar_source_marker)
 values(p_account_id,p_scope,case when p_scope='TASK' then p_target_id end,case when p_scope='AVATAR' then p_target_id end,p_client_request_id,p_input_sha256,p_input_bytes,p_input_type,avatar_marker) returning * into a;
 return jsonb_build_object('acquired',true,'attemptId',a.attempt_id,'asset',private.media_asset_document(a),'staged',null);
end $f$;

create function public.rpc_stage_media_upload_service(p_account_id uuid,p_asset_id uuid,p_attempt_id uuid,p_sha256 text,p_width integer,p_height integer,p_byte_size integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets; path text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=p_account_id for update;
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 if p_attempt_id is null or a.attempt_id is distinct from p_attempt_id then raise exception 'MEDIA_ATTEMPT_STALE' using errcode='40001'; end if;
 if p_sha256 is null or p_sha256!~'^[a-f0-9]{64}$' or p_width is null or p_width not between 1 and 1600 or p_height is null or p_height not between 1 and 1600
  or p_byte_size is null or p_byte_size not between 1 and 5242880 then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023'; end if;
 path:=a.account_id::text||'/v5/'||a.id::text||'/'||p_sha256||'.jpg';
 if a.state in('STAGED','READY') then
  if a.storage_path is distinct from path or a.width is distinct from p_width or a.height is distinct from p_height or a.byte_size is distinct from p_byte_size
  then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
 elsif a.state='PROCESSING' then
  update private.owned_media_assets set state='STAGED',sanitized_sha256=p_sha256,storage_path=path,width=p_width,height=p_height,byte_size=p_byte_size where id=a.id;
 else raise exception 'MEDIA_NOT_EDITABLE' using errcode='55000'; end if;
 return jsonb_build_object('path',path,'sha256',p_sha256,'byteSize',p_byte_size);
end $f$;

create function public.rpc_complete_media_upload_service(p_account_id uuid,p_asset_id uuid,p_storage_sha256 text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets; c public.ai_conversations; refs text[];
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=p_account_id;
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 -- Match conversation -> asset ordering with removal and final review.
 if a.scope='TASK' then select * into c from public.ai_conversations where id=a.conversation_id and account_id=p_account_id for update;
 else perform 1 from public.app_profiles where id=a.profile_id and account_id=p_account_id for update; end if;
 select * into a from private.owned_media_assets where id=p_asset_id for update;
 if a.state not in('STAGED','READY') or a.sanitized_sha256 is distinct from p_storage_sha256 or a.dispatch_state<>'SETTLED' or a.dispatch_outcome<>'STORED'
 then raise exception 'MEDIA_STORAGE_UNCONFIRMED' using errcode='40001'; end if;
 if a.state='READY' then return private.media_asset_document(a); end if;
 update private.owned_media_assets set state='READY',selected=case when scope='TASK' and (c.id is null or c.status<>'OPEN') then false else selected end where id=a.id returning * into a;
 if a.scope='TASK' and a.selected then
  refs:=private.media_task_refs(c.id);
  if not(a.storage_path=any(refs)) then refs:=array_append(refs,a.storage_path); end if;
  perform private.media_write_task_refs(c,refs);
 end if;
 return private.media_asset_document(a);
end $f$;

create function public.rpc_fail_media_upload_service(p_account_id uuid,p_asset_id uuid,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=p_account_id for update;
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 if p_attempt_id is null or a.attempt_id is distinct from p_attempt_id then raise exception 'MEDIA_ATTEMPT_STALE' using errcode='40001'; end if;
 if a.state='PROCESSING' then update private.owned_media_assets set state='FAILED',selected=false where id=a.id returning * into a; end if;
 return private.media_asset_document(a);
end $f$;

create function public.rpc_dispatch_media_upload_service(p_account_id uuid,p_asset_id uuid,p_attempt_id uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=p_account_id for update;
 if not found or p_attempt_id is null or a.attempt_id is distinct from p_attempt_id then raise exception 'MEDIA_ATTEMPT_STALE' using errcode='40001'; end if;
 if a.state<>'STAGED' or a.dispatch_state<>'NOT_DISPATCHED' then return false; end if;
 update private.owned_media_assets set dispatch_state='DISPATCHING' where id=a.id;
 return true;
end $f$;
-- A definitive Storage ACK/readback can settle the same producer during account
-- closure. This narrow recovery cannot attach/select a photo or update a profile.
create function public.rpc_settle_media_upload_service(p_account_id uuid,p_asset_id uuid,p_storage_sha256 text,p_outcome text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=p_account_id for update;
 if not found or a.sanitized_sha256 is distinct from p_storage_sha256 or p_storage_sha256 is null
  or p_outcome is null or p_outcome not in('STORED','REJECTED') then raise exception 'MEDIA_STORAGE_UNCONFIRMED' using errcode='40001'; end if;
 if a.dispatch_state='SETTLED' then
  if a.dispatch_outcome is distinct from p_outcome then raise exception 'MEDIA_STORAGE_UNCONFIRMED' using errcode='40001'; end if;
  return true;
 end if;
 if a.dispatch_state<>'DISPATCHING' then raise exception 'MEDIA_STORAGE_UNCONFIRMED' using errcode='40001'; end if;
 update private.owned_media_assets set dispatch_state='SETTLED',dispatch_outcome=p_outcome,
  selected=case when p_outcome='REJECTED' then false else selected end where id=a.id;
 return true;
end $f$;
create function public.rpc_read_media_upload(p_client_request_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into a from private.owned_media_assets where account_id=auth.uid() and client_request_id=p_client_request_id;
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 return private.media_asset_document(a);
end $f$;
create function public.rpc_read_task_photos(p_conversation_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations; refs text[]; photos jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=auth.uid();
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 refs:=private.media_task_refs(c.id);
 select coalesce(jsonb_agg(private.media_asset_document(a)||jsonb_build_object('selected',a.storage_path=any(refs) or (a.conversation_id=c.id and a.selected and a.state in('PROCESSING','STAGED'))) order by a.created_at,a.id),'[]'::jsonb)
 into photos from private.owned_media_assets a where a.account_id=auth.uid() and a.scope='TASK'
  and (a.storage_path=any(refs) or (a.conversation_id=c.id and a.selected and a.state in('PROCESSING','STAGED')));
 return jsonb_build_object('conversationId',c.id,'accountId',auth.uid(),'photos',photos,'ready',private.media_refs_ready(auth.uid(),refs)
  and not exists(select 1 from private.owned_media_assets where conversation_id=c.id and selected and state in('PROCESSING','STAGED')),'authoritative',true);
end $f$;
create function public.rpc_remove_task_photo(p_conversation_id uuid,p_asset_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations; a private.owned_media_assets; refs text[];
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 c:=private.media_assert_task_edit(auth.uid(),p_conversation_id); refs:=private.media_task_refs(c.id);
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=auth.uid() and scope='TASK' for update;
 if not found or (a.conversation_id<>c.id and not(a.storage_path=any(refs))) then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 if a.conversation_id=c.id then update private.owned_media_assets set selected=false where id=a.id; end if;
 perform private.media_write_task_refs(c,array_remove(refs,a.storage_path));
 return public.rpc_read_task_photos(c.id);
end $f$;

create function public.rpc_apply_profile_avatar(p_asset_id uuid,p_expected_avatar_path text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets; p public.app_profiles; receipt jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=auth.uid() and scope='AVATAR' and state='READY';
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 select * into p from public.app_profiles where id=a.profile_id and account_id=auth.uid() and profile_status in('DRAFT','ACTIVE') for update;
 if not found then raise exception 'MEDIA_NOT_EDITABLE' using errcode='42501'; end if;
 select * into a from private.owned_media_assets where id=a.id for update;
 if a.avatar_apply_receipt is not null then return a.avatar_apply_receipt; end if;
 if not a.selected then raise exception 'MEDIA_NOT_EDITABLE' using errcode='55000'; end if;
 if p.avatar_path is distinct from p_expected_avatar_path or a.avatar_source_marker is distinct from encode(extensions.digest(to_jsonb(p)::text,'sha256'),'hex')
 then raise exception 'MEDIA_VERSION_CONFLICT' using errcode='40001'; end if;
 update public.app_profiles set avatar_path=a.storage_path where id=p.id;
 receipt:=jsonb_build_object('profileId',p.id,'accountId',auth.uid(),'assetId',a.id,'avatarPath',a.storage_path,'saved',true,'authoritative',true);
 update private.owned_media_assets set avatar_apply_receipt=receipt where id=a.id;
 return receipt;
end $f$;
create function public.rpc_discard_profile_avatar(p_asset_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into a from private.owned_media_assets where id=p_asset_id and account_id=auth.uid() and scope='AVATAR';
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 perform 1 from public.app_profiles where id=a.profile_id and account_id=auth.uid() for update;
 select * into a from private.owned_media_assets where id=p_asset_id for update;
 if a.avatar_apply_receipt is not null then raise exception 'MEDIA_NOT_EDITABLE' using errcode='55000'; end if;
 update private.owned_media_assets set selected=false where id=a.id;
 return jsonb_build_object('assetId',a.id,'profileId',a.profile_id,'accountId',auth.uid(),'discarded',true,'authoritative',true);
end $f$;
create function public.rpc_read_profile_avatar(p_profile_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare p public.app_profiles;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into p from public.app_profiles where id=p_profile_id and account_id=auth.uid();
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 return jsonb_build_object('profileId',p.id,'accountId',auth.uid(),'avatarPath',p.avatar_path,'authoritative',true);
end $f$;
create function public.rpc_clear_profile_avatar(p_profile_id uuid,p_expected_avatar_path text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare p public.app_profiles;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(auth.uid());
 select * into p from public.app_profiles where id=p_profile_id and account_id=auth.uid() and profile_status in('DRAFT','ACTIVE') for update;
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 if p.avatar_path is not null then
  if p.avatar_path is distinct from p_expected_avatar_path then raise exception 'MEDIA_VERSION_CONFLICT' using errcode='40001'; end if;
  update public.app_profiles set avatar_path=null where id=p.id;
 end if;
 return public.rpc_read_profile_avatar(p.id);
end $f$;

-- Service read does not by itself grant public visibility. The Edge checks the
-- caller's canonical Need RLS / public-profile RPC before requesting this row.
create function public.rpc_read_media_asset_service(p_asset_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare a private.owned_media_assets;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 select * into a from private.owned_media_assets where id=p_asset_id and state='READY';
 if not found then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 return private.media_asset_document(a);
end $f$;
create function public.rpc_read_need_media_assets_service(p_need_id uuid,p_expected_revision integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare n public.needs; result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 select * into n from public.needs where id=p_need_id;
 if not found or n.revision is distinct from p_expected_revision then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 if not private.media_refs_ready(n.requester_account_id,n.public_photo_paths) then raise exception 'PUBLIC_MEDIA_NOT_READY' using errcode='55000'; end if;
 select coalesce(jsonb_agg(private.media_asset_document(a) order by position(a.storage_path in array_to_string(n.public_photo_paths,','))),'[]'::jsonb)
 into result from private.owned_media_assets a where a.storage_path=any(n.public_photo_paths);
 return result;
end $f$;

-- Bind every pending selection to the immutable Task review source. An upload
-- begun after review changes its digest; unfinished or foreign refs fail closed.
alter function private.ai_task_review_source(uuid) rename to ai_task_review_source_before_media;
create function private.ai_task_review_source(cid uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare d jsonb; aid uuid; refs text[];
begin
 d:=private.ai_task_review_source_before_media(cid); aid:=(d#>>'{conversation,accountId}')::uuid; refs:=private.media_task_refs(cid);
 if not private.media_refs_ready(aid,refs) or exists(select 1 from private.owned_media_assets where conversation_id=cid and selected and state in('PROCESSING','STAGED'))
 then raise exception 'PUBLIC_MEDIA_NOT_READY' using errcode='55000'; end if;
 return d||jsonb_build_object('media',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'ref',a.storage_path,'sha256',a.sanitized_sha256,
  'width',a.width,'height',a.height,'bytes',a.byte_size) order by a.storage_path) from private.owned_media_assets a where a.storage_path=any(refs)),'[]'::jsonb));
end $f$;

-- Replace only the two explicit former NOT_READY media gates. Context and B06
-- continue checking the existing canonical snapshot / policy / evaluator refs.
do $patch$ declare d text; needle text; replacement text;
begin
 d:=pg_get_functiondef('private.ai_need_turn_context(uuid)'::regprocedure);
 needle:=$n$where f.value->>'fact_key'<>'need.resolved_location';$n$;
 replacement:=$n$where f.value->>'fact_key' not in('need.resolved_location','need.public_photo_paths');$n$;
 if strpos(d,needle)=0 then raise exception 'V5_MEDIA_AI_CONTEXT_PREDECESSOR_DRIFT'; end if;
 execute replace(d,needle,replacement);
 d:=pg_get_functiondef('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure);
 needle:=$n$if v_key='need.resolved_location' then$n$;
 if strpos(d,needle)=0 then raise exception 'V5_MEDIA_AI_WRITER_PREDECESSOR_DRIFT'; end if;
 execute replace(d,needle,$n$if v_key in('need.resolved_location','need.public_photo_paths') then$n$);
 d:=pg_get_functiondef('public.rpc_ai_correct_fact_v2(uuid,jsonb,text)'::regprocedure);
 needle:=$n$if v_old.fact_key='need.resolved_location' then$n$;
 if strpos(d,needle)=0 then raise exception 'V5_MEDIA_MANUAL_WRITER_PREDECESSOR_DRIFT'; end if;
 execute replace(d,needle,$n$if v_old.fact_key in('need.resolved_location','need.public_photo_paths') then$n$);
 d:=pg_get_functiondef('private.need_publication_context(uuid,integer,uuid)'::regprocedure);
 needle:=$n$if cardinality(coalesce(n.public_photo_paths,'{}'::text[]))>0 then return result||jsonb_build_object('code','PUBLIC_MEDIA_NOT_READY'); end if;$n$;
 replacement:=$n$if not private.media_refs_ready(n.requester_account_id,n.public_photo_paths) then return result||jsonb_build_object('code','PUBLIC_MEDIA_NOT_READY'); end if;$n$;
 if strpos(d,needle)=0 then raise exception 'V5_MEDIA_CONTEXT_PREDECESSOR_DRIFT'; end if;
 execute replace(d,needle,replacement);
 d:=pg_get_functiondef('public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'::regprocedure);
 needle:=$n$if cardinality(coalesce(v_need.public_photo_paths, '{}'::text[])) > 0 then$n$;
 replacement:=$n$if not private.media_refs_ready(v_need.requester_account_id,v_need.public_photo_paths) then$n$;
 if strpos(d,needle)=0 then raise exception 'V5_MEDIA_B06_PREDECESSOR_DRIFT'; end if;
 execute replace(d,needle,replacement);
end $patch$;

do $acl$ declare f record;
begin
 for f in select oid::regprocedure as sig from pg_proc where pronamespace='private'::regnamespace and
  (proname like 'media_%' or proname in('ai_task_review_source','ai_task_review_source_before_media')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
 for f in select oid::regprocedure as sig,proname from pg_proc where pronamespace='public'::regnamespace and proname in(
  'rpc_claim_media_upload_service','rpc_stage_media_upload_service','rpc_complete_media_upload_service','rpc_fail_media_upload_service',
  'rpc_read_media_asset_service','rpc_read_task_photos','rpc_remove_task_photo','rpc_apply_profile_avatar','rpc_read_media_upload',
  'rpc_dispatch_media_upload_service','rpc_settle_media_upload_service','rpc_read_profile_avatar','rpc_clear_profile_avatar','rpc_discard_profile_avatar','rpc_read_need_media_assets_service') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  execute format('grant execute on function %s to %I',f.sig,case when f.proname like '%_service' then 'service_role' else 'authenticated' end);
 end loop;
end $acl$;
commit;
