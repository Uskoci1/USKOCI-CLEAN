--144 AF-D21/22. Private photographs in a real bilateral Agreement message.
-- No raw archive, public URL, provider, automatic retention or policy seed.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create temporary table photo144_predecessor(sha text,ready_definition text) on commit drop;
do $pre$ declare s text;d text;begin
 select sha256 into strict s from private.closure_source_v5 where singleton;
 if s is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then raise exception 'PHOTO_PREDECESSOR_NOT_READY';end if;
 select prosrc into d from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if md5(replace(replace(d,E'\r\n',E'\n'),s,'__SOURCE139_SHA256__'))<>'75b560d9a71baa045f8e7f80cd77aada'
 or jsonb_array_length(private.data_export_dataset_catalog())<>49
 or not exists(select 1 from storage.buckets where id='profile-media' and public=false) then raise exception 'PHOTO_PREDECESSOR_DRIFT';end if;
 insert into photo144_predecessor values(s,pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure));
 if (select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure)<>'d9a3733814e3101a3941284c07dc2bed'
 or not exists(select 1 from pg_constraint where conrelid='public.agreement_messages'::regclass and conname='agreement_messages_body_check'
 and pg_get_constraintdef(oid)='CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 2000)))') then raise exception 'PHOTO_MESSAGE_PREDECESSOR_DRIFT';end if;
end $pre$;

create table private.agreement_photo_uploads_v5(
 id uuid primary key default gen_random_uuid(),account_id uuid not null,agreement_id uuid not null,agreement_version integer not null check(agreement_version>0),
 client_request_id uuid not null,attempt_id uuid not null default gen_random_uuid(),state text not null check(state in('PROCESSING','STAGED','READY','FAILED','CANCELLED')),
 input_sha256 text check(input_sha256~'^[a-f0-9]{64}$'),input_bytes integer check(input_bytes between 1 and 10485760),input_type text check(input_type in('image/jpeg','image/png','image/webp')),
 admitted_at timestamptz,created_at timestamptz not null default clock_timestamp(),cancelled_at timestamptz,
 sanitized_sha256 text check(sanitized_sha256~'^[a-f0-9]{64}$'),storage_path text unique,width integer check(width between 1 and 1600),height integer check(height between 1 and 1600),byte_size integer check(byte_size between 1 and 5242880),
 dispatch_state text not null default 'NOT_DISPATCHED' check(dispatch_state in('NOT_DISPATCHED','DISPATCHING','SETTLED')),
 dispatch_outcome text check(dispatch_outcome in('STORED','REJECTED')),attached_message_id uuid,
 unique(account_id,client_request_id),
 check((input_sha256 is null and input_bytes is null and input_type is null and admitted_at is null and state='CANCELLED')
 or(input_sha256 is not null and input_bytes is not null and input_type is not null and admitted_at is not null)),
 check((storage_path is null and sanitized_sha256 is null and width is null and height is null and byte_size is null)
 or(storage_path is not null and storage_path=account_id::text||'/agreement-v5/'||id::text||'/'||sanitized_sha256||'.jpg' and sanitized_sha256 is not null and width is not null and height is not null and byte_size is not null)),
 check((dispatch_state='SETTLED')=(dispatch_outcome is not null)),check(dispatch_state='NOT_DISPATCHED' or storage_path is not null),
 check(state not in('STAGED','READY') or storage_path is not null),check(state<>'READY' or(dispatch_state='SETTLED' and dispatch_outcome='STORED')),
 check((state='CANCELLED')=(cancelled_at is not null)),check(attached_message_id is null or state='READY')
);
create index agreement_photo_owner_v5 on private.agreement_photo_uploads_v5(account_id,agreement_id,created_at desc);
create index agreement_photo_rate_v5 on private.agreement_photo_uploads_v5(account_id,admitted_at) where admitted_at is not null;
alter table private.agreement_photo_uploads_v5 enable row level security;
alter table private.agreement_photo_uploads_v5 force row level security;
revoke all on private.agreement_photo_uploads_v5 from public,anon,authenticated,service_role;
alter table public.agreement_messages add column photo_asset_ids uuid[] not null default '{}';
alter table public.agreement_messages drop constraint agreement_messages_body_check;
alter table public.agreement_messages add constraint agreement_messages_body_photo_check check(
 char_length(btrim(body))<=2000 and cardinality(photo_asset_ids) between 0 and 6
 and (char_length(btrim(body))>=1 or cardinality(photo_asset_ids)>=1));

create function private.agreement_photo_key_v5(a uuid) returns bigint language sql immutable strict set search_path=pg_catalog as $f$
 select hashtextextended('uskoci:agreement-photo:'||a::text,144);$f$;
create function private.agreement_photo_context_v5(a uuid,g uuid,v integer,writing boolean) returns public.agreements
 language plpgsql security definer set search_path=pg_catalog as $f$
declare ag public.agreements;begin
 select * into ag from public.agreements where id=g;
 if not found or a not in(ag.requester_account_id,ag.worker_account_id) then raise exception 'MEDIA_NOT_FOUND' using errcode='42501';end if;
 if writing then
  perform private.closure_assert_open(ag.requester_account_id,ag.worker_account_id);
  perform pg_advisory_xact_lock(private.agreement_photo_key_v5(a));
  select * into ag from public.agreements where id=g for share;
  perform private.safety_assert_pair(ag.requester_account_id,ag.worker_account_id);
  if ag.status not in('CONFIRMED','SUPERSEDED') then raise exception 'MEDIA_NOT_EDITABLE' using errcode='42501';end if;
  if v is null or v<>ag.current_version then raise exception 'MEDIA_VERSION_CONFLICT' using errcode='40001';end if;
  if not exists(select 1 from public.agreement_versions where agreement_id=g and version=v and status in('CONFIRMED','SUPERSEDED')) then raise exception 'MEDIA_NOT_EDITABLE' using errcode='42501';end if;
 end if;return ag;
end $f$;

create function private.agreement_photo_message_guard_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
declare x uuid;a private.agreement_photo_uploads_v5;begin
 if tg_op='UPDATE' then
  if old.photo_asset_ids is distinct from new.photo_asset_ids or(cardinality(old.photo_asset_ids)>0 and
   (new.id,new.agreement_id,new.agreement_version,new.sender_account_id,new.client_message_id,new.body) is distinct from
   (old.id,old.agreement_id,old.agreement_version,old.sender_account_id,old.client_message_id,old.body)) then raise exception 'MEDIA_MESSAGE_IMMUTABLE' using errcode='55000';end if;
  return new;
 end if;
 if cardinality(new.photo_asset_ids)=0 then return new;end if;
 if cardinality(new.photo_asset_ids)>6 or array_ndims(new.photo_asset_ids)<>1 or array_lower(new.photo_asset_ids,1)<>1
 or array_position(new.photo_asset_ids,null) is not null or(select count(distinct u) from unnest(new.photo_asset_ids)u)<>cardinality(new.photo_asset_ids)
 or auth.uid() is distinct from new.sender_account_id or new.client_message_id is null then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
 perform private.agreement_photo_context_v5(new.sender_account_id,new.agreement_id,new.agreement_version,true);
 foreach x in array new.photo_asset_ids loop
  select * into a from private.agreement_photo_uploads_v5 where id=x for update;
  if not found or a.account_id<>new.sender_account_id or a.agreement_id<>new.agreement_id or a.agreement_version<>new.agreement_version
  or a.state<>'READY' or a.attached_message_id is not null then raise exception 'MEDIA_NOT_EDITABLE' using errcode='42501';end if;
 end loop;return new;
end $f$;
create trigger agreement_photo_message_guard_v5 before insert or update on public.agreement_messages for each row execute function private.agreement_photo_message_guard_v5();
create function private.agreement_photo_link_guard_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if exists(select 1 from unnest(new.photo_asset_ids)x left join private.agreement_photo_uploads_v5 a on a.id=x
  where a.id is null or a.attached_message_id is distinct from new.id or a.account_id<>new.sender_account_id or a.agreement_id<>new.agreement_id
  or a.agreement_version<>new.agreement_version or a.state<>'READY') then raise exception 'MEDIA_MESSAGE_LINK_INCOMPLETE' using errcode='55000';end if;
 return new;
end $f$;
create constraint trigger agreement_photo_link_guard_v5 after insert on public.agreement_messages deferrable initially deferred for each row execute function private.agreement_photo_link_guard_v5();
create function public.rpc_send_agreement_photo_message_v5(p_expected_user_id uuid,p_agreement_id uuid,p_expected_version integer,p_client_message_id text,p_body text,p_asset_ids uuid[])
 returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);ag public.agreements;m public.agreement_messages;b text:=btrim(coalesce(p_body,''));begin
 if p_client_message_id is null or p_client_message_id!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$' or p_expected_version is null or p_expected_version<1
 or char_length(b)>2000 or p_asset_ids is null or cardinality(p_asset_ids) not between 1 and 6 or array_ndims(p_asset_ids)<>1 or array_lower(p_asset_ids,1)<>1
 or array_position(p_asset_ids,null) is not null or(select count(distinct x) from unnest(p_asset_ids)x)<>cardinality(p_asset_ids) then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
 ag:=private.agreement_photo_context_v5(u,p_agreement_id,null,false);
 perform private.closure_assert_open(ag.requester_account_id,ag.worker_account_id);
 perform pg_advisory_xact_lock(private.agreement_photo_key_v5(u));
 perform pg_advisory_xact_lock(hashtextextended('uskoci:message:'||u::text||':'||p_client_message_id,0));
 select * into ag from public.agreements where id=p_agreement_id for share;
 select * into m from public.agreement_messages where sender_account_id=u and client_message_id=p_client_message_id;
 if found then
  if m.agreement_id<>p_agreement_id or m.agreement_version<>p_expected_version or m.body<>b or m.photo_asset_ids<>p_asset_ids then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode='40001';end if;
 else
  perform private.agreement_photo_context_v5(u,p_agreement_id,p_expected_version,true);
  -- Existing text writers stay unchanged. This attachment-specific writer uses
  -- the same canonical table, existing safety/closure triggers and one event.
  insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,client_message_id,body,photo_asset_ids)
  values(p_agreement_id,p_expected_version,u,p_client_message_id,b,p_asset_ids) returning * into m;
  update private.agreement_photo_uploads_v5 set attached_message_id=m.id where id=any(p_asset_ids);
  perform private.emit_event(case when u=ag.requester_account_id then ag.worker_account_id else ag.requester_account_id end,
   case when u=ag.requester_account_id then 'WORKER' else 'REQUESTER' end,'MESSAGE_RECEIVED','AGREEMENT',ag.id,p_expected_version,
   'Nova poruka','Imate novu poruku u Dogovoru.','agreement_message:'||m.id::text,'NORMAL',jsonb_build_object('message_id',m.id));
 end if;
 perform private.support_auth_v5(u);
 return jsonb_build_object('messageId',m.id,'agreementId',m.agreement_id,'agreementVersion',m.agreement_version,'clientMessageId',m.client_message_id,'body',m.body,'assetIds',to_jsonb(m.photo_asset_ids));
end $f$;
create function public.rpc_read_agreement_photo_messages_v5(p_expected_user_id uuid,p_agreement_id uuid,p_message_ids uuid[])
 returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);items jsonb;begin
 perform private.agreement_photo_context_v5(u,p_agreement_id,null,false);
 if p_message_ids is null or cardinality(p_message_ids) not between 1 and 50 or array_ndims(p_message_ids)<>1 or array_lower(p_message_ids,1)<>1
 or array_position(p_message_ids,null) is not null or(select count(distinct x) from unnest(p_message_ids)x)<>cardinality(p_message_ids)
 then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
 if(select count(*) from public.agreement_messages where agreement_id=p_agreement_id and id=any(p_message_ids))<>cardinality(p_message_ids)
 then raise exception 'MEDIA_NOT_FOUND' using errcode='42501';end if;
 if exists(select 1 from public.agreement_messages m cross join lateral unnest(m.photo_asset_ids)x left join private.agreement_photo_uploads_v5 a on a.id=x
  where m.id=any(p_message_ids) and(a.id is null or a.attached_message_id is distinct from m.id or a.agreement_id<>m.agreement_id or a.agreement_version<>m.agreement_version or a.state<>'READY'))
 then raise exception 'MEDIA_MESSAGE_LINK_INCOMPLETE' using errcode='55000';end if;
 select jsonb_agg(jsonb_build_object('messageId',m.id,'agreementVersion',m.agreement_version,'clientMessageId',m.client_message_id,'body',m.body,'assetIds',to_jsonb(m.photo_asset_ids),
 'photos',(select coalesce(jsonb_agg(jsonb_build_object('assetId',a.id,'width',a.width,'height',a.height,'byteSize',a.byte_size,'contentType','image/jpeg') order by ord),'[]')
 from unnest(m.photo_asset_ids) with ordinality x(id,ord) join private.agreement_photo_uploads_v5 a on a.id=x.id)) order by array_position(p_message_ids,m.id)) into items
 from public.agreement_messages m where m.id=any(p_message_ids);
 perform private.support_auth_v5(u);return jsonb_build_object('accountId',u,'agreementId',p_agreement_id,'messages',items,'authoritative',true);
end $f$;
create function public.rpc_agreement_photo_read_service_v5(p_account_id uuid,p_session_id uuid,p_agreement_id uuid,p_asset_id uuid,p_message_id uuid)
 returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.agreement_photo_uploads_v5;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if not private.push_session_valid(p_account_id,p_session_id) then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 perform private.agreement_photo_context_v5(p_account_id,p_agreement_id,null,false);
 select * into a from private.agreement_photo_uploads_v5 where id=p_asset_id and agreement_id=p_agreement_id and state='READY';
 if not found or(p_message_id is null and(a.account_id<>p_account_id or a.attached_message_id is not null))
 or(p_message_id is not null and not exists(select 1 from public.agreement_messages m where m.id=p_message_id and m.agreement_id=p_agreement_id
  and m.agreement_version=a.agreement_version and a.attached_message_id=m.id and a.id=any(m.photo_asset_ids))) then raise exception 'MEDIA_NOT_FOUND' using errcode='42501';end if;
 return jsonb_build_object('assetId',a.id,'agreementId',a.agreement_id,'messageId',p_message_id,'bucket','profile-media','path',a.storage_path,'sha256',a.sanitized_sha256,'contentType','image/jpeg','byteSize',a.byte_size,'authoritative',true);
end $f$;
create function private.agreement_photo_document_v5(a private.agreement_photo_uploads_v5) returns jsonb language sql stable set search_path=pg_catalog as $f$
 select jsonb_build_object('accountId',a.account_id,'agreementId',a.agreement_id,'agreementVersion',a.agreement_version,'clientRequestId',a.client_request_id,
 'assetId',a.id,'state',a.state,'attachedMessageId',a.attached_message_id,'photo',case when a.state='READY' then jsonb_build_object('assetId',a.id,'width',a.width,'height',a.height,'byteSize',a.byte_size,'contentType','image/jpeg') else null end,'authoritative',true);$f$;
create function private.agreement_photo_transfer_v5(a private.agreement_photo_uploads_v5) returns jsonb language sql stable set search_path=pg_catalog as $f$
 select jsonb_build_object('receipt',private.agreement_photo_document_v5(a),'attemptId',a.attempt_id,'path',a.storage_path,'sha256',a.sanitized_sha256,
 'byteSize',a.byte_size,'dispatchState',a.dispatch_state,'dispatchOutcome',a.dispatch_outcome);$f$;

-- Internal upload protocol. Only positive exact dispatch settlement bypasses
-- session/closure gates, and can never attach a photograph or create a message.
create function public.rpc_agreement_photo_upload_service_v5(p_account_id uuid,p_session_id uuid,p_operation text,p_agreement_id uuid,p_version integer,p_key uuid,p_input jsonb)
 returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.agreement_photo_uploads_v5;ag public.agreements;v jsonb:=coalesce(p_input,'{}');acquired boolean:=false;items jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if p_account_id is null or p_agreement_id is null or jsonb_typeof(v)<>'object' or p_operation is null
 or p_operation not in('CLAIM','READ','CANCEL','LIST','STAGE','DISPATCH','SETTLE','FAIL') then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
 if p_operation<>'SETTLE' and not private.push_session_valid(p_account_id,p_session_id) then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 if p_operation='LIST' then
  if v<>'{}' then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
  perform private.agreement_photo_context_v5(p_account_id,p_agreement_id,null,false);
  select coalesce(jsonb_agg(private.agreement_photo_document_v5(x) order by x.created_at desc),'[]') into items
  from(select * from private.agreement_photo_uploads_v5 where account_id=p_account_id and agreement_id=p_agreement_id and state not in('FAILED','CANCELLED') and attached_message_id is null order by created_at desc limit 120)x;
  return jsonb_build_object('accountId',p_account_id,'agreementId',p_agreement_id,'uploads',items,'authoritative',true);
 end if;
 if p_key is null or p_version is null or p_version<1 then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
 if p_operation in('CLAIM','STAGE','DISPATCH') then
  ag:=private.agreement_photo_context_v5(p_account_id,p_agreement_id,p_version,true);
 elsif p_operation<>'SETTLE' then
  perform private.agreement_photo_context_v5(p_account_id,p_agreement_id,null,false);
 end if;
 perform pg_advisory_xact_lock(private.agreement_photo_key_v5(p_account_id));
 select * into a from private.agreement_photo_uploads_v5 where account_id=p_account_id and client_request_id=p_key for update;
 if found and(a.agreement_id<>p_agreement_id or a.agreement_version<>p_version) then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode='40001';end if;
 if p_operation in('READ','CANCEL','DISPATCH','FAIL') and v<>'{}' then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
 if p_operation='READ' then
  if a.id is null then return jsonb_build_object('receipt',jsonb_build_object('accountId',p_account_id,'agreementId',p_agreement_id,'agreementVersion',p_version,'clientRequestId',p_key,
   'assetId',null,'state','ABSENT','attachedMessageId',null,'photo',null,'authoritative',true));end if;
 elsif p_operation='CANCEL' then
  if a.id is null then insert into private.agreement_photo_uploads_v5(account_id,agreement_id,agreement_version,client_request_id,state,cancelled_at)
   values(p_account_id,p_agreement_id,p_version,p_key,'CANCELLED',clock_timestamp()) returning * into a;
  elsif a.attached_message_id is null and a.state<>'CANCELLED' then update private.agreement_photo_uploads_v5 set state='CANCELLED',cancelled_at=clock_timestamp() where id=a.id returning * into a;end if;
 elsif p_operation='CLAIM' then
  if v-array['sha256','byteSize','contentType']<>'{}' or not(v?&array['sha256','byteSize','contentType'])
  or jsonb_typeof(v->'sha256')<>'string' or coalesce(v->>'sha256','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(v->'byteSize')<>'number' or(v->>'byteSize')!~'^[1-9][0-9]{0,7}$' or(v->>'byteSize')::integer>10485760
  or jsonb_typeof(v->'contentType')<>'string' or v->>'contentType' not in('image/jpeg','image/png','image/webp') then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
  if a.id is not null then
   if a.state<>'CANCELLED' and(a.input_sha256<>v->>'sha256' or a.input_bytes<>(v->>'byteSize')::integer or a.input_type<>v->>'contentType') then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode='40001';end if;
  else
   if(select count(*) from private.agreement_photo_uploads_v5 where account_id=p_account_id and admitted_at>clock_timestamp()-interval '24 hours')>=120
   or(select count(*) from private.agreement_photo_uploads_v5 where account_id=p_account_id and admitted_at>clock_timestamp()-interval '1 minute')>=12 then raise exception 'MEDIA_RATE_LIMITED' using errcode='54000';end if;
   insert into private.agreement_photo_uploads_v5(account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,admitted_at)
   values(p_account_id,p_agreement_id,p_version,p_key,'PROCESSING',v->>'sha256',(v->>'byteSize')::integer,v->>'contentType',clock_timestamp()) returning * into a;acquired:=true;
  end if;
 elsif a.id is null then raise exception 'MEDIA_NOT_FOUND' using errcode='42501';
 elsif p_operation='STAGE' then
  if v-array['attemptId','sha256','width','height','byteSize']<>'{}' or not(v?&array['attemptId','sha256','width','height','byteSize'])
  or jsonb_typeof(v->'attemptId')<>'string' or v->>'attemptId' is distinct from a.attempt_id::text
  or jsonb_typeof(v->'sha256')<>'string' or coalesce(v->>'sha256','')!~'^[a-f0-9]{64}$'
  or exists(select 1 from unnest(array['width','height','byteSize'])k where jsonb_typeof(v->k)<>'number' or(v->>k)!~'^[1-9][0-9]{0,7}$')
  or(v->>'width')::integer>1600 or(v->>'height')::integer>1600 or(v->>'byteSize')::integer>5242880 then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
  if a.state='PROCESSING' then update private.agreement_photo_uploads_v5 set state='STAGED',sanitized_sha256=v->>'sha256',storage_path=p_account_id::text||'/agreement-v5/'||a.id::text||'/'||(v->>'sha256')||'.jpg',
   width=(v->>'width')::integer,height=(v->>'height')::integer,byte_size=(v->>'byteSize')::integer where id=a.id returning * into a;
  elsif a.state<>'CANCELLED' and(a.sanitized_sha256 is distinct from v->>'sha256' or a.width is distinct from(v->>'width')::integer or a.height is distinct from(v->>'height')::integer or a.byte_size is distinct from(v->>'byteSize')::integer) then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode='40001';end if;
 elsif p_operation='DISPATCH' then
  if a.state='STAGED' and a.dispatch_state='NOT_DISPATCHED' then update private.agreement_photo_uploads_v5 set dispatch_state='DISPATCHING' where id=a.id returning * into a;acquired:=true;end if;
 elsif p_operation='SETTLE' then
  if v-array['sha256','outcome']<>'{}' or not(v?&array['sha256','outcome']) or jsonb_typeof(v->'sha256')<>'string'
  or v->>'sha256' is distinct from a.sanitized_sha256 or v->>'outcome' not in('STORED','REJECTED') or jsonb_typeof(v->'outcome')<>'string'
  or a.dispatch_state='NOT_DISPATCHED' then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023';end if;
  if a.dispatch_state='SETTLED' and a.dispatch_outcome<>v->>'outcome' then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode='40001';end if;
  update private.agreement_photo_uploads_v5 set dispatch_state='SETTLED',dispatch_outcome=v->>'outcome',
   state=case when state='CANCELLED' then state when v->>'outcome'='STORED' then 'READY' else 'FAILED' end where id=a.id returning * into a;
 elsif p_operation='FAIL' then
  if a.state='PROCESSING' then update private.agreement_photo_uploads_v5 set state='FAILED' where id=a.id returning * into a;end if;
 end if;
 return private.agreement_photo_transfer_v5(a)||jsonb_build_object('acquired',acquired);
end $f$;

create function private.agreement_photo_asset_guard_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
begin
 perform pg_advisory_xact_lock(private.media_evidence_key_v5(old.account_id));
 if tg_op='DELETE' then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode='55000';end if;
 if(new.id,new.account_id,new.agreement_id,new.agreement_version,new.client_request_id,new.attempt_id,new.input_sha256,new.input_bytes,new.input_type,new.admitted_at,new.created_at)
 is distinct from(old.id,old.account_id,old.agreement_id,old.agreement_version,old.client_request_id,old.attempt_id,old.input_sha256,old.input_bytes,old.input_type,old.admitted_at,old.created_at)
 or(old.storage_path is not null and(new.storage_path,new.sanitized_sha256,new.width,new.height,new.byte_size) is distinct from(old.storage_path,old.sanitized_sha256,old.width,old.height,old.byte_size))
 or(old.attached_message_id is not null and(new.attached_message_id,new.state) is distinct from(old.attached_message_id,old.state))
 or(old.cancelled_at is not null and(new.cancelled_at,new.state) is distinct from(old.cancelled_at,old.state))
 or(old.dispatch_state='SETTLED' and(new.dispatch_state,new.dispatch_outcome) is distinct from(old.dispatch_state,old.dispatch_outcome))
 or(old.dispatch_state='DISPATCHING' and new.dispatch_state='NOT_DISPATCHED')
 or(old.state='FAILED' and new.state not in('FAILED','CANCELLED'))
 or(old.state='READY' and new.state not in('READY','CANCELLED'))
 or(old.state='STAGED' and new.state='PROCESSING')
 then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode='55000';end if;
 if new.attached_message_id is not null and not exists(select 1 from public.agreement_messages m where m.id=new.attached_message_id
  and m.sender_account_id=new.account_id and m.agreement_id=new.agreement_id and m.agreement_version=new.agreement_version and new.id=any(m.photo_asset_ids))
 then raise exception 'MEDIA_MESSAGE_LINK_INCOMPLETE' using errcode='55000';end if;
 return new;
end $f$;
create trigger agreement_photo_asset_guard_v5 before update or delete on private.agreement_photo_uploads_v5 for each row execute function private.agreement_photo_asset_guard_v5();
create policy agreement_photo_no_client_insert_v5 on storage.objects as restrictive for insert to authenticated
 with check(not(bucket_id='profile-media' and split_part(name,'/',2)='agreement-v5'));
create policy agreement_photo_no_client_update_v5 on storage.objects as restrictive for update to authenticated
 using(not(bucket_id='profile-media' and split_part(name,'/',2)='agreement-v5')) with check(not(bucket_id='profile-media' and split_part(name,'/',2)='agreement-v5'));
create policy agreement_photo_no_client_delete_v5 on storage.objects as restrictive for delete to authenticated
 using(not(bucket_id='profile-media' and split_part(name,'/',2)='agreement-v5'));
create function private.agreement_photo_storage_guard_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
declare a private.agreement_photo_uploads_v5;e private.closure_executions_v5;begin
 if old.bucket_id<>'profile-media' or split_part(old.name,'/',2)<>'agreement-v5' then return case when tg_op='DELETE' then old else new end;end if;
 select * into a from private.agreement_photo_uploads_v5 where storage_path=old.name;
 if not found then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode='55000';end if;
 if tg_op='UPDATE' then
  if(to_jsonb(new)-array['last_accessed_at']) is distinct from(to_jsonb(old)-array['last_accessed_at']) then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode='55000';end if;
  return new;
 end if;
 -- History is not deleted while the account is open. At closure the existing
 -- reviewed policy/generation and a dispatched exact object action are required.
 perform pg_advisory_xact_lock_shared(private.closure_account_key(a.account_id));
 select x.* into e from private.closure_executions_v5 x join private.closure_actions_v5 c on c.generation=x.generation and c.account_id=x.account_id
 where x.account_id=a.account_id and x.state='EXECUTING' and c.kind='STORAGE_DELETE' and c.state='DISPATCHED' and c.bucket=old.bucket_id and c.object_path=old.name;
 if not found then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode='55000';end if;
 perform private.closure_assert_current_v5(e);
 perform pg_advisory_xact_lock(private.media_evidence_key_v5(a.account_id));
 if exists(select 1 from private.media_evidence_refs_v5 where asset_id=a.id) or exists(select 1 from private.retention_holds where account_id=a.account_id and active)
 then raise exception 'MEDIA_EVIDENCE_POLICY_NOT_READY' using errcode='55000';end if;
 return old;
end $f$;
create trigger agreement_photo_storage_guard_v5 before update or delete on storage.objects for each row execute function private.agreement_photo_storage_guard_v5();

-- Only photographs of an explicitly selected, visible canonical message are
-- captured by support. Existing Task/Review reference behavior is unchanged.
do $support$ declare d text;needle text;begin
 d:=pg_get_functiondef('private.support_reference_v5(uuid,jsonb)'::regprocedure);
 needle:=$a$content:=jsonb_build_object('agreementId',m.agreement_id,'body',m.body,'createdAt',m.created_at,'mine',m.sender_account_id=a);$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_SUPPORT_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,needle||$a$
  if cardinality(m.photo_asset_ids)>0 then
   if exists(select 1 from unnest(m.photo_asset_ids)x left join private.agreement_photo_uploads_v5 p on p.id=x where p.id is null or p.attached_message_id is distinct from m.id or p.state<>'READY') then raise exception 'SUPPORT_MEDIA_REFERENCE_NOT_AVAILABLE' using errcode='55000';end if;
   content:=content||jsonb_build_object('media',(select jsonb_agg(jsonb_build_object('assetId',p.id,'sha256',p.sanitized_sha256,'width',p.width,'height',p.height) order by ord)
    from unnest(m.photo_asset_ids) with ordinality x(id,ord) join private.agreement_photo_uploads_v5 p on p.id=x.id));
  end if;$a$);
 d:=pg_get_functiondef('private.support_capture_media_v5(uuid,integer,jsonb)'::regprocedure);
 needle:=$a$declare x jsonb;m private.owned_media_assets;begin$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_SUPPORT_PREDECESSOR_DRIFT';end if;
 d:=replace(d,needle,'declare x jsonb;m private.owned_media_assets;p private.agreement_photo_uploads_v5;begin');
 needle:=$a$  select * into m from private.owned_media_assets where id=(x->>'assetId')::uuid;$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_SUPPORT_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,$a$  if snapshot->>'kind'='AGREEMENT_MESSAGE' then
   select * into p from private.agreement_photo_uploads_v5 where id=(x->>'assetId')::uuid and attached_message_id=(snapshot->>'id')::uuid and agreement_version=(snapshot->>'revision')::integer;
   if not found then raise exception 'SUPPORT_MEDIA_REFERENCE_NOT_AVAILABLE' using errcode='55000';end if;
   perform pg_advisory_xact_lock(private.media_evidence_key_v5(p.account_id));
   if p.state<>'READY' or p.sanitized_sha256 is distinct from x->>'sha256' or not exists(select 1 from storage.objects where bucket_id='profile-media' and name=p.storage_path) then raise exception 'SUPPORT_MEDIA_REFERENCE_NOT_AVAILABLE' using errcode='55000';end if;
   insert into private.media_evidence_refs_v5(asset_id,account_id,source_kind,source_id,source_version) values(p.id,p.account_id,'SUPPORT_CASE',cid,ver) on conflict do nothing;
   continue;
  end if;
$a$||needle);
 d:=pg_get_functiondef('public.rpc_support_media_service_v5(uuid,uuid,uuid,uuid)'::regprocedure);
 needle:='declare c private.support_cases_v5;g integer;m private.owned_media_assets;begin';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_SUPPORT_PREDECESSOR_DRIFT';end if;
 d:=replace(d,needle,'declare c private.support_cases_v5;g integer;m private.owned_media_assets;p private.agreement_photo_uploads_v5;begin');
 needle:=$a$ select * into m from private.owned_media_assets where id=p_asset_id and state='READY' and dispatch_outcome='STORED';$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_SUPPORT_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,$a$ select * into p from private.agreement_photo_uploads_v5 where id=p_asset_id and state='READY' and attached_message_id is not null;
 if found then
  if c.account_id<>p_account_id then insert into private.support_operator_audit_v5(actor_account_id,action,case_id,grant_revision) values(p_account_id,'MEDIA_READ',c.id,g);end if;
  if not private.push_session_valid(p_account_id,p_session_id) then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
  return jsonb_build_object('assetId',p.id,'caseId',c.id,'bucket','profile-media','path',p.storage_path,'sha256',p.sanitized_sha256,'contentType','image/jpeg','byteSize',p.byte_size,'authoritative',true);
 end if;
$a$||needle);
end $support$;

do $closure$ declare d text;needle text;begin
 d:=pg_get_functiondef('private.closure_blockers_v5(uuid)'::regprocedure);needle:=' return codes;';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_CLOSURE_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,E' if exists(select 1 from private.agreement_photo_uploads_v5 where account_id=a and dispatch_state=''DISPATCHING'') then codes:=array_append(codes,''MEDIA_UPLOAD_PENDING'');end if;\n return codes;');
 d:=pg_get_functiondef('public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)'::regprocedure);
 needle:=$a$  union select 'profile-media',storage_path from private.owned_media_assets where account_id=u and storage_path is not null$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_CLOSURE_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,needle||E'\n  union select ''profile-media'',storage_path from private.agreement_photo_uploads_v5 where account_id=u and storage_path is not null');
end $closure$;
update private.closure_dataset_catalog_v5 set relations=relations||array['private.agreement_photo_uploads_v5'] where data_class='MEDIA_OBJECTS';

do $export$ declare catalog jsonb;d text;needle text;replacement text;begin
 catalog:=private.data_export_dataset_catalog();
 if jsonb_array_length(catalog)<>49 then raise exception 'PHOTO_EXPORT_PREDECESSOR_DRIFT';end if;
 select jsonb_agg(case when x->>'key'='ownAgreementMessages' then jsonb_set(x,'{fields}',x->'fields'||'["agreementVersion","assetIds"]'::jsonb) else x end order by ord) into catalog from jsonb_array_elements(catalog) with ordinality t(x,ord);
 catalog:=catalog||'[{"key":"ownAgreementPhotos","dataClass":"MEDIA_OBJECTS","fields":["id","agreementId","agreementVersion","messageId","state","width","height","byteSize","createdAt","cancelledAt","bytesIncluded"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"}]'::jsonb;
 execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$',catalog::text);
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 needle:=$a$select 'ownAgreementMessages' as key,jsonb_build_object('id',t.id,'agreementId',t.agreement_id,'body',t.body,'createdAt',t.created_at)$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'PHOTO_EXPORT_PREDECESSOR_DRIFT';end if;
 d:=replace(d,needle,$a$select 'ownAgreementMessages' as key,jsonb_build_object('id',t.id,'agreementId',t.agreement_id,'body',t.body,'createdAt',t.created_at,'agreementVersion',t.agreement_version,'assetIds',to_jsonb(t.photo_asset_ids))$a$);
 needle:='from private.support_read_markers_v5 t where t.account_id=p_account_id),';
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'''OWN_ACCOUNT_V5_6''')=0 then raise exception 'PHOTO_EXPORT_PREDECESSOR_DRIFT';end if;
 replacement:=$rows$from private.support_read_markers_v5 t where t.account_id=p_account_id
union all
select 'ownAgreementPhotos',jsonb_build_object('id',t.id,'agreementId',t.agreement_id,'agreementVersion',t.agreement_version,'messageId',t.attached_message_id,'state',t.state,
 'width',t.width,'height',t.height,'byteSize',t.byte_size,'createdAt',t.created_at,'cancelledAt',t.cancelled_at,'bytesIncluded',false) from private.agreement_photo_uploads_v5 t where t.account_id=p_account_id),$rows$;
 execute replace(replace(d,needle,replacement),'''OWN_ACCOUNT_V5_6''','''OWN_ACCOUNT_V5_7''');
 d:=pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
 if strpos(d,'''OWN_ACCOUNT_V5_6''')=0 or strpos(d,'jsonb_array_length(m->''datasets'')<>49')=0 then raise exception 'PHOTO_EXPORT_PREDECESSOR_DRIFT';end if;
 execute replace(replace(replace(d,'''OWN_ACCOUNT_V5_6''','''OWN_ACCOUNT_V5_7'''),'jsonb_array_length(m->''datasets'')<>49','jsonb_array_length(m->''datasets'')<>50'),'''mediaMetadata'',''ownedMediaAssets''','''mediaMetadata'',''ownedMediaAssets'',''ownAgreementPhotos''');
end $export$;

do $acl$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','public') and p.proname in('agreement_photo_key_v5','agreement_photo_context_v5','agreement_photo_document_v5','agreement_photo_transfer_v5',
 'agreement_photo_message_guard_v5','agreement_photo_link_guard_v5','agreement_photo_asset_guard_v5','agreement_photo_storage_guard_v5',
 'rpc_agreement_photo_upload_service_v5','rpc_agreement_photo_read_service_v5','rpc_send_agreement_photo_message_v5','rpc_read_agreement_photo_messages_v5') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.nspname='public' then execute format('grant execute on function %s to %I',f.signature,case when f.proname in('rpc_agreement_photo_upload_service_v5','rpc_agreement_photo_read_service_v5') then 'service_role' else 'authenticated' end);end if;
 end loop;
end $acl$;
-- Exact forward extension of143's33-source seal; preserve140's strict predicate.
do $source$ declare d text;needle text:='''public.rpc_closure_api_guard()'']';begin
 d:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'having count(*)=33')=0 then raise exception 'PHOTO_DIGEST_PREDECESSOR_DRIFT';end if;
 execute replace(replace(d,needle,$sources$'public.rpc_closure_api_guard()',
 'private.agreement_photo_key_v5(uuid)','private.agreement_photo_context_v5(uuid,uuid,integer,boolean)',
 'private.agreement_photo_document_v5(private.agreement_photo_uploads_v5)','private.agreement_photo_transfer_v5(private.agreement_photo_uploads_v5)',
 'private.agreement_photo_message_guard_v5()','private.agreement_photo_link_guard_v5()','private.agreement_photo_asset_guard_v5()','private.agreement_photo_storage_guard_v5()',
 'public.rpc_agreement_photo_upload_service_v5(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_photo_read_service_v5(uuid,uuid,uuid,uuid,uuid)',
 'public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])','public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])']$sources$),'having count(*)=33','having count(*)=45');
end $source$;
do $rebind$ declare old_sha text;new_sha text;d text;begin
 select sha,ready_definition into strict old_sha,d from photo144_predecessor;
 if(select sha256 from private.closure_source_v5 where singleton) is distinct from old_sha or length(d)-length(replace(d,old_sha,''))<>length(old_sha) then raise exception 'PHOTO_SOURCE_BINDING_INVALID';end if;
 new_sha:=private.closure_source_digest_v5();if new_sha is null then raise exception 'PHOTO_SOURCE_BINDING_INVALID';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton;execute replace(d,old_sha,new_sha);
 if private.retention_ai_source_ready() is distinct from true then raise exception 'PHOTO_SOURCE_NOT_READY';end if;
end $rebind$;
notify pgrst,'reload schema';
commit;
