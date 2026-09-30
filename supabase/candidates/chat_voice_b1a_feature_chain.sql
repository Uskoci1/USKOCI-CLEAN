-- Chat voice B1-a SOURCE CANDIDATE. NOT RUN / NOT APPLIED. Plan: docs/implementation/product-v1-closure-20260926/finalization-20260927/VOICE_B1_B2_PLAN_20260930.md
-- The feature chain only: private upload table, private bucket, message binding, guards, upload/read services, send RPC and the versioned history readers.
-- NOT in this file (B1-b): closure / export / retention / support integration and the closure-certificate re-bind. A new table and a changed constraint move the closure schema
-- digest, so the certificate is UNCERTIFIED after this file by design (readiness false, binding null) until B1-b re-binds it; this file must never reach DEV on its own.
-- Conflicts raise PT409, never 40001 (PostgREST 14 re-executes 40001 without end; registry blocker B24).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path = pg_catalog;

create temporary table voice_b1a_before(digest text, ready boolean) on commit drop;
do $pre$
declare pin record; s text;
begin
  if to_regclass('private.agreement_voice_uploads_v1') is not null
     or exists(select 1 from pg_attribute where attrelid = 'public.agreement_messages'::regclass and attname = 'voice_asset_id' and not attisdropped)
     or to_regprocedure('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)') is not null
     or to_regprocedure('public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)') is not null
     or exists(select 1 from storage.buckets where id = 'agreement-voice') then
    raise exception 'VOICE_B1A_ALREADY_APPLIED' using errcode = '55000';
  end if;
  for pin in select * from (values
    ('public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)', '912f1c7e4df9c8c933351f45bd1fa1c5'),
    ('public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)', '9ae403a4c1ba9130e18cdd5b3dd831f6')
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'VOICE_B1A_PREDECESSOR_DRIFT: %', pin.signature using errcode = '55000';
    end if;
  end loop;
  -- Functions and tables this file only calls or reads must exist (their bodies are not patched here).
  for pin in select * from (values
    ('private.support_auth_v5(uuid)'), ('private.closure_assert_open(uuid,uuid)'), ('private.safety_assert_pair(uuid,uuid)'),
    ('private.push_session_valid(uuid,uuid)'), ('private.media_evidence_key_v5(uuid)'), ('private.closure_account_key(uuid)'),
    ('private.closure_assert_current_v5(private.closure_executions_v5)'), ('public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])')
  ) p(signature) loop
    if to_regprocedure(pin.signature) is null then raise exception 'VOICE_B1A_PREDECESSOR_MISSING: %', pin.signature using errcode = '55000'; end if;
  end loop;
  if to_regclass('private.closure_actions_v5') is null or to_regclass('private.retention_holds') is null
     or not exists(select 1 from storage.buckets where id = 'profile-media' and public = false) then
    raise exception 'VOICE_B1A_PREDECESSOR_MISSING: tables or bucket' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_constraint where conrelid = 'public.agreement_messages'::regclass and conname = 'agreement_messages_body_photo_check') then
    raise exception 'VOICE_B1A_PREDECESSOR_DRIFT: agreement_messages_body_photo_check' using errcode = '55000';
  end if;
  s := private.closure_source_digest_v5();
  insert into voice_b1a_before values (s, private.retention_ai_source_ready());
end
$pre$;

-- 1. The private upload lifecycle: a clone of the photo table with audio columns. No foreign key, no client privilege, forced RLS.
create table private.agreement_voice_uploads_v1(
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  agreement_id uuid not null,
  agreement_version integer not null check(agreement_version > 0),
  client_request_id uuid not null,
  attempt_id uuid not null default gen_random_uuid(),
  state text not null check(state in ('PROCESSING','STAGED','READY','FAILED','CANCELLED')),
  input_sha256 text check(input_sha256 ~ '^[a-f0-9]{64}$'),
  input_bytes integer check(input_bytes between 1 and 4194304),
  input_type text check(input_type = 'audio/mp4'),
  admitted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz,
  validated_sha256 text check(validated_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text unique,
  byte_size integer check(byte_size between 1 and 4194304),
  duration_ms integer check(duration_ms between 300 and 300000),
  dispatch_state text not null default 'NOT_DISPATCHED' check(dispatch_state in ('NOT_DISPATCHED','DISPATCHING','SETTLED')),
  dispatch_outcome text check(dispatch_outcome in ('STORED','REJECTED')),
  attached_message_id uuid,
  unique(account_id, client_request_id),
  check((input_sha256 is null and input_bytes is null and input_type is null and admitted_at is null and state = 'CANCELLED')
    or (input_sha256 is not null and input_bytes is not null and input_type is not null and admitted_at is not null)),
  check((storage_path is null and validated_sha256 is null and byte_size is null and duration_ms is null)
    or (storage_path is not null and storage_path = account_id::text || '/agreement-voice-v1/' || id::text || '/' || validated_sha256 || '.m4a'
        and validated_sha256 is not null and byte_size is not null and duration_ms is not null)),
  check((dispatch_state = 'SETTLED') = (dispatch_outcome is not null)),
  check(dispatch_state = 'NOT_DISPATCHED' or storage_path is not null),
  check(state not in ('STAGED','READY') or storage_path is not null),
  check(state <> 'READY' or (dispatch_state = 'SETTLED' and dispatch_outcome = 'STORED')),
  check((state = 'CANCELLED') = (cancelled_at is not null)),
  check(attached_message_id is null or state = 'READY')
);
create index agreement_voice_owner_v1 on private.agreement_voice_uploads_v1(account_id, agreement_id, created_at desc);
create index agreement_voice_rate_v1 on private.agreement_voice_uploads_v1(account_id, admitted_at) where admitted_at is not null;
alter table private.agreement_voice_uploads_v1 enable row level security;
alter table private.agreement_voice_uploads_v1 force row level security;
revoke all on private.agreement_voice_uploads_v1 from public, anon, authenticated, service_role;

-- 2. The message binding: one nullable voice asset, exclusive with a body and with photos.
alter table public.agreement_messages add column voice_asset_id uuid;
alter table public.agreement_messages drop constraint agreement_messages_body_photo_check;
alter table public.agreement_messages add constraint agreement_messages_body_media_check check(
  char_length(btrim(body)) <= 2000 and cardinality(photo_asset_ids) between 0 and 6
  and ((voice_asset_id is null and (char_length(btrim(body)) >= 1 or cardinality(photo_asset_ids) >= 1))
    or (voice_asset_id is not null and btrim(body) = '' and cardinality(photo_asset_ids) = 0)));

-- 3. The private bucket: no client policy of any kind (a restrictive policy keeps it so whatever permissive policy exists or is added).
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('agreement-voice', 'agreement-voice', false, 4194304, array['audio/mp4']);
create policy agreement_voice_no_client_v1 on storage.objects as restrictive for all to authenticated
  using(bucket_id <> 'agreement-voice') with check(bucket_id <> 'agreement-voice');

create function private.agreement_voice_key_v1(a uuid) returns bigint language sql immutable strict set search_path = pg_catalog as $f$
  select hashtextextended('uskoci:agreement-voice:' || a::text, 1);$f$;
-- Participant gate. A POSITIVE membership test: the photo gate uses NOT IN, which passes when a participant is NULL.
create function private.agreement_voice_context_v1(a uuid, g uuid, v integer, writing boolean) returns public.agreements
  language plpgsql security definer set search_path = pg_catalog as $f$
declare ag public.agreements;
begin
  select * into ag from public.agreements where id = g;
  if not found or (a is distinct from ag.requester_account_id and a is distinct from ag.worker_account_id) then
    raise exception 'MEDIA_NOT_FOUND' using errcode = '42501';
  end if;
  if writing then
    perform private.closure_assert_open(ag.requester_account_id, ag.worker_account_id);
    perform pg_advisory_xact_lock(private.agreement_voice_key_v1(a));
    select * into ag from public.agreements where id = g for share;
    perform private.safety_assert_pair(ag.requester_account_id, ag.worker_account_id);
    if ag.status not in ('CONFIRMED','SUPERSEDED') then raise exception 'MEDIA_NOT_EDITABLE' using errcode = '42501'; end if;
    if v is null or v <> ag.current_version then raise exception 'MEDIA_VERSION_CONFLICT' using errcode = 'PT409'; end if;
    if not exists(select 1 from public.agreement_versions where agreement_id = g and version = v and status in ('CONFIRMED','SUPERSEDED')) then
      raise exception 'MEDIA_NOT_EDITABLE' using errcode = '42501';
    end if;
  end if;
  return ag;
end $f$;

create function private.agreement_voice_document_v1(a private.agreement_voice_uploads_v1) returns jsonb language sql stable set search_path = pg_catalog as $f$
  select jsonb_build_object('accountId', a.account_id, 'agreementId', a.agreement_id, 'agreementVersion', a.agreement_version, 'clientRequestId', a.client_request_id,
    'assetId', a.id, 'state', a.state, 'attachedMessageId', a.attached_message_id,
    'voice', case when a.state = 'READY' then jsonb_build_object('assetId', a.id, 'durationMs', a.duration_ms, 'byteSize', a.byte_size, 'contentType', 'audio/mp4') else null end,
    'authoritative', true);$f$;
create function private.agreement_voice_transfer_v1(a private.agreement_voice_uploads_v1) returns jsonb language sql stable set search_path = pg_catalog as $f$
  select jsonb_build_object('receipt', private.agreement_voice_document_v1(a), 'attemptId', a.attempt_id, 'path', a.storage_path, 'sha256', a.validated_sha256,
    'byteSize', a.byte_size, 'durationMs', a.duration_ms, 'dispatchState', a.dispatch_state, 'dispatchOutcome', a.dispatch_outcome);$f$;

-- 4. Guards. The message guard covers BOTH insert and update of a voice row (the photo guard returns early for a row without photos).
create function private.agreement_voice_message_guard_v1() returns trigger language plpgsql security definer set search_path = pg_catalog as $f$
declare a private.agreement_voice_uploads_v1;
begin
  if tg_op = 'UPDATE' then
    if old.voice_asset_id is distinct from new.voice_asset_id
       or (old.voice_asset_id is not null and (new.id, new.agreement_id, new.agreement_version, new.sender_account_id, new.client_message_id, new.body, new.photo_asset_ids)
           is distinct from (old.id, old.agreement_id, old.agreement_version, old.sender_account_id, old.client_message_id, old.body, old.photo_asset_ids)) then
      raise exception 'MEDIA_MESSAGE_IMMUTABLE' using errcode = '55000';
    end if;
    return new;
  end if;
  if new.voice_asset_id is null then return new; end if;
  if auth.uid() is distinct from new.sender_account_id or new.client_message_id is null or btrim(new.body) <> '' or cardinality(new.photo_asset_ids) <> 0 then
    raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023';
  end if;
  perform private.agreement_voice_context_v1(new.sender_account_id, new.agreement_id, new.agreement_version, true);
  select * into a from private.agreement_voice_uploads_v1 where id = new.voice_asset_id for update;
  if not found or a.account_id <> new.sender_account_id or a.agreement_id <> new.agreement_id or a.agreement_version <> new.agreement_version
     or a.state <> 'READY' or a.attached_message_id is not null then
    raise exception 'MEDIA_NOT_EDITABLE' using errcode = '42501';
  end if;
  return new;
end $f$;
create trigger agreement_voice_message_guard_v1 before insert or update on public.agreement_messages
  for each row execute function private.agreement_voice_message_guard_v1();
create function private.agreement_voice_link_guard_v1() returns trigger language plpgsql security definer set search_path = pg_catalog as $f$
begin
  if new.voice_asset_id is not null and not exists(select 1 from private.agreement_voice_uploads_v1 a
      where a.id = new.voice_asset_id and a.attached_message_id = new.id and a.account_id = new.sender_account_id
        and a.agreement_id = new.agreement_id and a.agreement_version = new.agreement_version and a.state = 'READY') then
    raise exception 'MEDIA_MESSAGE_LINK_INCOMPLETE' using errcode = '55000';
  end if;
  return new;
end $f$;
create constraint trigger agreement_voice_link_guard_v1 after insert on public.agreement_messages
  deferrable initially deferred for each row execute function private.agreement_voice_link_guard_v1();
create function private.agreement_voice_asset_guard_v1() returns trigger language plpgsql security definer set search_path = pg_catalog as $f$
begin
  perform pg_advisory_xact_lock(private.media_evidence_key_v5(old.account_id));
  if tg_op = 'DELETE' then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode = '55000'; end if;
  if (new.id, new.account_id, new.agreement_id, new.agreement_version, new.client_request_id, new.attempt_id, new.input_sha256, new.input_bytes, new.input_type, new.admitted_at, new.created_at)
     is distinct from (old.id, old.account_id, old.agreement_id, old.agreement_version, old.client_request_id, old.attempt_id, old.input_sha256, old.input_bytes, old.input_type, old.admitted_at, old.created_at)
     or (old.storage_path is not null and (new.storage_path, new.validated_sha256, new.byte_size, new.duration_ms) is distinct from (old.storage_path, old.validated_sha256, old.byte_size, old.duration_ms))
     or (old.attached_message_id is not null and (new.attached_message_id, new.state) is distinct from (old.attached_message_id, old.state))
     or (old.cancelled_at is not null and (new.cancelled_at, new.state) is distinct from (old.cancelled_at, old.state))
     or (old.dispatch_state = 'SETTLED' and (new.dispatch_state, new.dispatch_outcome) is distinct from (old.dispatch_state, old.dispatch_outcome))
     or (old.dispatch_state = 'DISPATCHING' and new.dispatch_state = 'NOT_DISPATCHED')
     or (old.state = 'FAILED' and new.state not in ('FAILED','CANCELLED'))
     or (old.state = 'READY' and new.state not in ('READY','CANCELLED'))
     or (old.state = 'STAGED' and new.state = 'PROCESSING') then
    raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode = '55000';
  end if;
  if new.attached_message_id is not null and not exists(select 1 from public.agreement_messages m where m.id = new.attached_message_id
      and m.sender_account_id = new.account_id and m.agreement_id = new.agreement_id and m.agreement_version = new.agreement_version and m.voice_asset_id = new.id) then
    raise exception 'MEDIA_MESSAGE_LINK_INCOMPLETE' using errcode = '55000';
  end if;
  return new;
end $f$;
create trigger agreement_voice_asset_guard_v1 before update or delete on private.agreement_voice_uploads_v1
  for each row execute function private.agreement_voice_asset_guard_v1();
-- An object of this bucket is immutable while the account is open; it can go only under an EXECUTING closure generation with a DISPATCHED exact-object action.
create function private.agreement_voice_storage_guard_v1() returns trigger language plpgsql security definer set search_path = pg_catalog as $f$
declare a private.agreement_voice_uploads_v1; e private.closure_executions_v5;
begin
  if old.bucket_id <> 'agreement-voice' then return case when tg_op = 'DELETE' then old else new end; end if;
  select * into a from private.agreement_voice_uploads_v1 where storage_path = old.name;
  if not found then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode = '55000'; end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['last_accessed_at']) is distinct from (to_jsonb(old) - array['last_accessed_at']) then
      raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode = '55000';
    end if;
    return new;
  end if;
  perform pg_advisory_xact_lock_shared(private.closure_account_key(a.account_id));
  select x.* into e from private.closure_executions_v5 x join private.closure_actions_v5 c on c.generation = x.generation and c.account_id = x.account_id
    where x.account_id = a.account_id and x.state = 'EXECUTING' and c.kind = 'STORAGE_DELETE' and c.state = 'DISPATCHED' and c.bucket = old.bucket_id and c.object_path = old.name;
  if not found then raise exception 'MEDIA_ASSET_IMMUTABLE' using errcode = '55000'; end if;
  perform private.closure_assert_current_v5(e);
  perform pg_advisory_xact_lock(private.media_evidence_key_v5(a.account_id));
  if exists(select 1 from private.retention_holds where account_id = a.account_id and active) then
    raise exception 'MEDIA_EVIDENCE_POLICY_NOT_READY' using errcode = '55000';
  end if;
  return old;
end $f$;
create trigger agreement_voice_storage_guard_v1 before update or delete on storage.objects
  for each row execute function private.agreement_voice_storage_guard_v1();

-- 5. Send. The same sender-global message key and lock as every writer; the message, the attachment and the event commit atomically.
create function public.rpc_send_agreement_voice_message_v1(p_expected_user_id uuid, p_agreement_id uuid, p_expected_version integer, p_client_message_id text, p_asset_id uuid)
  returns jsonb language plpgsql security definer set search_path = pg_catalog as $f$
declare u uuid := private.support_auth_v5(p_expected_user_id); ag public.agreements; m public.agreement_messages;
begin
  if p_client_message_id is null or p_client_message_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$' or p_expected_version is null or p_expected_version < 1 or p_asset_id is null then
    raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023';
  end if;
  ag := private.agreement_voice_context_v1(u, p_agreement_id, null, false);
  perform private.closure_assert_open(ag.requester_account_id, ag.worker_account_id);
  perform pg_advisory_xact_lock(private.agreement_voice_key_v1(u));
  perform pg_advisory_xact_lock(hashtextextended('uskoci:message:' || u::text || ':' || p_client_message_id, 0));
  select * into ag from public.agreements where id = p_agreement_id for share;
  select * into m from public.agreement_messages where sender_account_id = u and client_message_id = p_client_message_id;
  if found then
    if m.agreement_id <> p_agreement_id or m.agreement_version <> p_expected_version or m.voice_asset_id is distinct from p_asset_id
       or btrim(m.body) <> '' or cardinality(m.photo_asset_ids) <> 0 then
      raise exception 'MEDIA_COMMAND_CONFLICT' using errcode = 'PT409';
    end if;
  else
    perform private.agreement_voice_context_v1(u, p_agreement_id, p_expected_version, true);
    insert into public.agreement_messages(agreement_id, agreement_version, sender_account_id, client_message_id, body, voice_asset_id)
      values (p_agreement_id, p_expected_version, u, p_client_message_id, '', p_asset_id) returning * into m;
    update private.agreement_voice_uploads_v1 set attached_message_id = m.id where id = p_asset_id;
    perform private.emit_event(case when u = ag.requester_account_id then ag.worker_account_id else ag.requester_account_id end,
      case when u = ag.requester_account_id then 'WORKER' else 'REQUESTER' end, 'MESSAGE_RECEIVED', 'AGREEMENT', ag.id, p_expected_version,
      'Nova poruka', 'Imate novu poruku u Dogovoru.', 'agreement_message:' || m.id::text, 'NORMAL', jsonb_build_object('message_id', m.id));
  end if;
  perform private.support_auth_v5(u);
  return jsonb_build_object('messageId', m.id, 'agreementId', m.agreement_id, 'agreementVersion', m.agreement_version,
    'clientMessageId', m.client_message_id, 'voiceAssetId', m.voice_asset_id);
end $f$;

-- 6. Playback authorization (service role). The Edge function fetches the bytes with the service key after this answer; no URL is ever produced.
create function public.rpc_agreement_voice_read_service_v1(p_account_id uuid, p_session_id uuid, p_agreement_id uuid, p_asset_id uuid, p_message_id uuid)
  returns jsonb language plpgsql security definer set search_path = pg_catalog as $f$
declare a private.agreement_voice_uploads_v1;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  if not private.push_session_valid(p_account_id, p_session_id) then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  perform private.agreement_voice_context_v1(p_account_id, p_agreement_id, null, false);
  select * into a from private.agreement_voice_uploads_v1 where id = p_asset_id and agreement_id = p_agreement_id and state = 'READY';
  if not found or (p_message_id is null and (a.account_id <> p_account_id or a.attached_message_id is not null))
     or (p_message_id is not null and not exists(select 1 from public.agreement_messages m where m.id = p_message_id and m.agreement_id = p_agreement_id
         and m.agreement_version = a.agreement_version and a.attached_message_id = m.id and m.voice_asset_id = a.id)) then
    raise exception 'MEDIA_NOT_FOUND' using errcode = '42501';
  end if;
  return jsonb_build_object('assetId', a.id, 'agreementId', a.agreement_id, 'messageId', p_message_id, 'bucket', 'agreement-voice', 'path', a.storage_path,
    'sha256', a.validated_sha256, 'contentType', 'audio/mp4', 'byteSize', a.byte_size, 'durationMs', a.duration_ms, 'authoritative', true);
end $f$;

-- 7. The upload protocol (service role only). Only a positive exact settlement bypasses the session and closure gates, and it can never attach a message.
create function public.rpc_agreement_voice_upload_service_v1(p_account_id uuid, p_session_id uuid, p_operation text, p_agreement_id uuid, p_version integer, p_key uuid, p_input jsonb)
  returns jsonb language plpgsql security definer set search_path = pg_catalog as $f$
declare a private.agreement_voice_uploads_v1; ag public.agreements; v jsonb := coalesce(p_input, '{}'); acquired boolean := false; items jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  if p_account_id is null or p_agreement_id is null or jsonb_typeof(v) <> 'object' or p_operation is null
     or p_operation not in ('CLAIM','READ','CANCEL','LIST','STAGE','DISPATCH','SETTLE','FAIL') then
    raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023';
  end if;
  if p_operation <> 'SETTLE' and not private.push_session_valid(p_account_id, p_session_id) then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_operation = 'LIST' then
    if v <> '{}' then raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023'; end if;
    perform private.agreement_voice_context_v1(p_account_id, p_agreement_id, null, false);
    select coalesce(jsonb_agg(private.agreement_voice_document_v1(x) order by x.created_at desc), '[]') into items
      from (select * from private.agreement_voice_uploads_v1 where account_id = p_account_id and agreement_id = p_agreement_id
              and state not in ('FAILED','CANCELLED') and attached_message_id is null order by created_at desc limit 20) x;
    return jsonb_build_object('accountId', p_account_id, 'agreementId', p_agreement_id, 'uploads', items, 'authoritative', true);
  end if;
  if p_key is null or p_version is null or p_version < 1 then raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023'; end if;
  if p_operation in ('CLAIM','STAGE','DISPATCH') then
    ag := private.agreement_voice_context_v1(p_account_id, p_agreement_id, p_version, true);
  elsif p_operation <> 'SETTLE' then
    perform private.agreement_voice_context_v1(p_account_id, p_agreement_id, null, false);
  end if;
  perform pg_advisory_xact_lock(private.agreement_voice_key_v1(p_account_id));
  select * into a from private.agreement_voice_uploads_v1 where account_id = p_account_id and client_request_id = p_key for update;
  if found and (a.agreement_id <> p_agreement_id or a.agreement_version <> p_version) then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode = 'PT409'; end if;
  if p_operation in ('READ','CANCEL','DISPATCH','FAIL') and v <> '{}' then raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023'; end if;
  if p_operation = 'READ' then
    if a.id is null then
      return jsonb_build_object('receipt', jsonb_build_object('accountId', p_account_id, 'agreementId', p_agreement_id, 'agreementVersion', p_version, 'clientRequestId', p_key,
        'assetId', null, 'state', 'ABSENT', 'attachedMessageId', null, 'voice', null, 'authoritative', true));
    end if;
  elsif p_operation = 'CANCEL' then
    if a.id is null then
      insert into private.agreement_voice_uploads_v1(account_id, agreement_id, agreement_version, client_request_id, state, cancelled_at)
        values (p_account_id, p_agreement_id, p_version, p_key, 'CANCELLED', clock_timestamp()) returning * into a;
    elsif a.attached_message_id is null and a.state <> 'CANCELLED' then
      update private.agreement_voice_uploads_v1 set state = 'CANCELLED', cancelled_at = clock_timestamp() where id = a.id returning * into a;
    end if;
  elsif p_operation = 'CLAIM' then
    if v - array['sha256','byteSize','contentType'] <> '{}' or not (v ?& array['sha256','byteSize','contentType'])
       or jsonb_typeof(v->'sha256') <> 'string' or coalesce(v->>'sha256', '') !~ '^[a-f0-9]{64}$'
       or jsonb_typeof(v->'byteSize') <> 'number' or (v->>'byteSize') !~ '^[1-9][0-9]{0,7}$' or (v->>'byteSize')::integer > 4194304
       or jsonb_typeof(v->'contentType') <> 'string' or v->>'contentType' <> 'audio/mp4' then
      raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023';
    end if;
    if a.id is not null then
      if a.state <> 'CANCELLED' and (a.input_sha256 <> v->>'sha256' or a.input_bytes <> (v->>'byteSize')::integer or a.input_type <> v->>'contentType') then
        raise exception 'MEDIA_COMMAND_CONFLICT' using errcode = 'PT409';
      end if;
    else
      if (select count(*) from private.agreement_voice_uploads_v1 where account_id = p_account_id and admitted_at > clock_timestamp() - interval '24 hours') >= 60
         or (select count(*) from private.agreement_voice_uploads_v1 where account_id = p_account_id and admitted_at > clock_timestamp() - interval '1 minute') >= 6 then
        raise exception 'MEDIA_RATE_LIMITED' using errcode = '54000';
      end if;
      insert into private.agreement_voice_uploads_v1(account_id, agreement_id, agreement_version, client_request_id, state, input_sha256, input_bytes, input_type, admitted_at)
        values (p_account_id, p_agreement_id, p_version, p_key, 'PROCESSING', v->>'sha256', (v->>'byteSize')::integer, v->>'contentType', clock_timestamp()) returning * into a;
      acquired := true;
    end if;
  elsif a.id is null then raise exception 'MEDIA_NOT_FOUND' using errcode = '42501';
  elsif p_operation = 'STAGE' then
    -- No transformation is made in V1: the validated bytes ARE the input bytes, so the staged hash and size must equal the claimed ones.
    if v - array['attemptId','sha256','byteSize','durationMs'] <> '{}' or not (v ?& array['attemptId','sha256','byteSize','durationMs'])
       or jsonb_typeof(v->'attemptId') <> 'string' or v->>'attemptId' is distinct from a.attempt_id::text
       or jsonb_typeof(v->'sha256') <> 'string' or coalesce(v->>'sha256', '') !~ '^[a-f0-9]{64}$'
       or exists(select 1 from unnest(array['byteSize','durationMs']) k where jsonb_typeof(v->k) <> 'number' or (v->>k) !~ '^[1-9][0-9]{0,7}$')
       or (v->>'byteSize')::integer > 4194304 or (v->>'durationMs')::integer not between 300 and 300000
       or (a.input_sha256 is not null and (v->>'sha256' is distinct from a.input_sha256 or (v->>'byteSize')::integer is distinct from a.input_bytes)) then
      raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023';
    end if;
    if a.state = 'PROCESSING' then
      update private.agreement_voice_uploads_v1 set state = 'STAGED', validated_sha256 = v->>'sha256',
        storage_path = p_account_id::text || '/agreement-voice-v1/' || a.id::text || '/' || (v->>'sha256') || '.m4a',
        byte_size = (v->>'byteSize')::integer, duration_ms = (v->>'durationMs')::integer where id = a.id returning * into a;
    elsif a.state <> 'CANCELLED' and (a.validated_sha256 is distinct from v->>'sha256' or a.byte_size is distinct from (v->>'byteSize')::integer
        or a.duration_ms is distinct from (v->>'durationMs')::integer) then
      raise exception 'MEDIA_COMMAND_CONFLICT' using errcode = 'PT409';
    end if;
  elsif p_operation = 'DISPATCH' then
    if a.state = 'STAGED' and a.dispatch_state = 'NOT_DISPATCHED' then
      update private.agreement_voice_uploads_v1 set dispatch_state = 'DISPATCHING' where id = a.id returning * into a; acquired := true;
    end if;
  elsif p_operation = 'SETTLE' then
    if v - array['sha256','outcome'] <> '{}' or not (v ?& array['sha256','outcome']) or jsonb_typeof(v->'sha256') <> 'string'
       or v->>'sha256' is distinct from a.validated_sha256 or v->>'outcome' not in ('STORED','REJECTED') or jsonb_typeof(v->'outcome') <> 'string'
       or a.dispatch_state = 'NOT_DISPATCHED' then
      raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023';
    end if;
    if a.dispatch_state = 'SETTLED' and a.dispatch_outcome <> v->>'outcome' then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode = 'PT409'; end if;
    update private.agreement_voice_uploads_v1 set dispatch_state = 'SETTLED', dispatch_outcome = v->>'outcome',
      state = case when state = 'CANCELLED' then state when v->>'outcome' = 'STORED' then 'READY' else 'FAILED' end where id = a.id returning * into a;
  elsif p_operation = 'FAIL' then
    if a.state = 'PROCESSING' then update private.agreement_voice_uploads_v1 set state = 'FAILED' where id = a.id returning * into a; end if;
  end if;
  return private.agreement_voice_transfer_v1(a) || jsonb_build_object('acquired', acquired);
end $f$;

-- 8. Versioned history reads. V2 adds kind VOICE and a voice object; V1 keeps serving builds that only know TEXT and PHOTO.
create function public.rpc_read_agreement_messages_page_v2(p_expected_user_id uuid, p_agreement_id uuid, p_limit integer default 50,
  p_before_created_at timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $page$
declare
  u uuid := private.support_auth_v5(p_expected_user_id); ag public.agreements;
  selected jsonb; page_rows jsonb; photo_rows jsonb; messages jsonb;
  ids uuid[]; older jsonb := null; has_older boolean;
begin
  ag := private.agreement_voice_context_v1(u, p_agreement_id, null, false);
  if p_limit is null or p_limit not between 1 and 50
     or (p_before_created_at is null) <> (p_before_id is null)
     or (p_before_created_at is not null and not isfinite(p_before_created_at)) then
    raise exception 'CHAT_CURSOR_INVALID' using errcode = '22023';
  end if;
  if p_before_id is not null and not exists(select 1 from public.agreement_messages m
      where m.agreement_id = p_agreement_id and m.id = p_before_id and m.created_at = p_before_created_at) then
    raise exception 'CHAT_CURSOR_INVALID' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'messageId', m.id, 'agreementVersion', m.agreement_version, 'senderAccountId', m.sender_account_id,
      'clientMessageId', m.client_message_id, 'body', m.body, 'createdAt', m.created_at,
      'kind', case when m.voice_asset_id is not null then 'VOICE' when cardinality(m.photo_asset_ids) > 0 then 'PHOTO' else 'TEXT' end,
      'mine', m.sender_account_id = u,
      'voice', (select jsonb_build_object('assetId', a.id, 'durationMs', a.duration_ms, 'byteSize', a.byte_size, 'contentType', 'audio/mp4')
                from private.agreement_voice_uploads_v1 a where a.id = m.voice_asset_id and a.attached_message_id = m.id
                  and a.agreement_id = m.agreement_id and a.agreement_version = m.agreement_version and a.state = 'READY')
    ) order by m.created_at desc, m.id desc), '[]'::jsonb)
  into selected from (select x.* from public.agreement_messages x
    where x.agreement_id = p_agreement_id and (p_before_id is null or (x.created_at, x.id) < (p_before_created_at, p_before_id))
    order by x.created_at desc, x.id desc limit p_limit + 1) m;
  has_older := jsonb_array_length(selected) > p_limit;
  select coalesce(jsonb_agg(value order by ord desc), '[]'::jsonb), array_agg((value->>'messageId')::uuid order by ord desc)
    into page_rows, ids from jsonb_array_elements(selected) with ordinality r(value, ord) where ord <= p_limit;
  if cardinality(ids) > 0 then
    photo_rows := public.rpc_read_agreement_photo_messages_v5(u, p_agreement_id, ids)->'messages';
    select jsonb_agg(r.value || jsonb_build_object('photos', p.value->'photos') order by r.ord)
      into messages from jsonb_array_elements(page_rows) with ordinality r(value, ord)
      join jsonb_array_elements(photo_rows) p(value) on p.value->>'messageId' = r.value->>'messageId'
        and p.value->>'agreementVersion' = r.value->>'agreementVersion'
        and p.value->'clientMessageId' = r.value->'clientMessageId' and p.value->>'body' = r.value->>'body';
    if messages is null or jsonb_array_length(messages) <> cardinality(ids)
       or exists(select 1 from jsonb_array_elements(messages) x where x->>'kind' = 'VOICE' and jsonb_typeof(x->'voice') <> 'object') then
      raise exception 'CHAT_MESSAGE_PROJECTION_CHANGED' using errcode = '55000';
    end if;
    if has_older then older := jsonb_build_object('createdAt', page_rows->0->'createdAt', 'messageId', page_rows->0->'messageId'); end if;
  else messages := '[]'::jsonb; end if;
  perform private.support_auth_v5(u);
  return jsonb_build_object('schema', 'AGREEMENT_MESSAGES_PAGE_V2', 'accountId', u, 'agreementId', p_agreement_id,
    'messages', messages, 'olderCursor', older, 'asOf', statement_timestamp(), 'authoritative', true);
end
$page$;

create function public.rpc_read_agreement_message_window_v2(p_expected_user_id uuid, p_agreement_id uuid, p_target_message_id uuid,
  p_before_count integer default 24, p_after_count integer default 25)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $window$
declare
  u uuid := private.support_auth_v5(p_expected_user_id); ag public.agreements;
  target_at timestamptz; page_rows jsonb; photo_rows jsonb; messages jsonb; ids uuid[];
  has_before boolean; has_after boolean; before_cursor jsonb := null; after_cursor jsonb := null;
begin
  ag := private.agreement_voice_context_v1(u, p_agreement_id, null, false);
  if p_before_count is null or p_after_count is null or p_before_count not between 0 and 49 or p_after_count not between 0 and 49
     or p_before_count + p_after_count > 49 then
    raise exception 'CHAT_WINDOW_INVALID' using errcode = '22023';
  end if;
  select m.created_at into target_at from public.agreement_messages m where m.id = p_target_message_id and m.agreement_id = p_agreement_id;
  if not found then raise exception 'CHAT_MESSAGE_NOT_AVAILABLE' using errcode = '42501'; end if;
  with before_rows as materialized (
    select m.* from public.agreement_messages m where m.agreement_id = p_agreement_id and (m.created_at, m.id) < (target_at, p_target_message_id)
    order by m.created_at desc, m.id desc limit p_before_count + 1
  ), after_rows as materialized (
    select m.* from public.agreement_messages m where m.agreement_id = p_agreement_id and (m.created_at, m.id) > (target_at, p_target_message_id)
    order by m.created_at, m.id limit p_after_count + 1
  ), window_rows as (
    (select * from before_rows order by created_at desc, id desc limit p_before_count)
    union all
    (select m.* from public.agreement_messages m where m.id = p_target_message_id and m.agreement_id = p_agreement_id and m.created_at = target_at)
    union all
    (select * from after_rows order by created_at, id limit p_after_count)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'messageId', m.id, 'agreementVersion', m.agreement_version, 'senderAccountId', m.sender_account_id,
      'clientMessageId', m.client_message_id, 'body', m.body, 'createdAt', m.created_at,
      'kind', case when m.voice_asset_id is not null then 'VOICE' when cardinality(m.photo_asset_ids) > 0 then 'PHOTO' else 'TEXT' end,
      'mine', m.sender_account_id = u,
      'voice', (select jsonb_build_object('assetId', a.id, 'durationMs', a.duration_ms, 'byteSize', a.byte_size, 'contentType', 'audio/mp4')
                from private.agreement_voice_uploads_v1 a where a.id = m.voice_asset_id and a.attached_message_id = m.id
                  and a.agreement_id = m.agreement_id and a.agreement_version = m.agreement_version and a.state = 'READY')
    ) order by m.created_at, m.id), '[]'::jsonb),
    array_agg(m.id order by m.created_at, m.id),
    (select count(*) > p_before_count from before_rows), (select count(*) > p_after_count from after_rows)
    into page_rows, ids, has_before, has_after from window_rows m;
  if cardinality(ids) is null or cardinality(ids) > 50 or not p_target_message_id = any(ids) then
    raise exception 'CHAT_MESSAGE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  photo_rows := public.rpc_read_agreement_photo_messages_v5(u, p_agreement_id, ids)->'messages';
  select jsonb_agg(r.value || jsonb_build_object('photos', p.value->'photos') order by r.ord)
    into messages from jsonb_array_elements(page_rows) with ordinality r(value, ord)
    join jsonb_array_elements(photo_rows) p(value) on p.value->>'messageId' = r.value->>'messageId'
      and p.value->>'agreementVersion' = r.value->>'agreementVersion'
      and p.value->'clientMessageId' = r.value->'clientMessageId' and p.value->>'body' = r.value->>'body';
  if messages is null or jsonb_array_length(messages) <> cardinality(ids)
     or exists(select 1 from jsonb_array_elements(messages) x where x->>'kind' = 'VOICE' and jsonb_typeof(x->'voice') <> 'object') then
    raise exception 'CHAT_MESSAGE_PROJECTION_CHANGED' using errcode = '55000';
  end if;
  if has_before then before_cursor := jsonb_build_object('createdAt', page_rows->0->'createdAt', 'messageId', page_rows->0->'messageId'); end if;
  if has_after then after_cursor := jsonb_build_object('createdAt', page_rows->-1->'createdAt', 'messageId', page_rows->-1->'messageId'); end if;
  perform private.support_auth_v5(u);
  return jsonb_build_object('schema', 'AGREEMENT_MESSAGE_WINDOW_V2', 'accountId', u, 'agreementId', p_agreement_id,
    'targetMessageId', p_target_message_id, 'messages', messages, 'beforeCursor', before_cursor, 'afterCursor', after_cursor,
    'asOf', statement_timestamp(), 'authoritative', true);
end
$window$;

-- The V1 answer for builds that only know TEXT and PHOTO: a voice row goes out as TEXT with a fixed notice, so such a build never fails the page
-- (hiding the row would leave gaps in its paging and acknowledgements). Key sets, cursors and schema names are exactly the V1 contract.
create function private.agreement_messages_v1_view(v jsonb, schema_name text) returns jsonb language sql immutable set search_path = pg_catalog as $f$
  select (v - 'messages') || jsonb_build_object('schema', schema_name, 'messages', (
    select coalesce(jsonb_agg(case when m->>'kind' = 'VOICE'
        then (m - 'voice') || jsonb_build_object('kind', 'TEXT', 'body', 'Glasovna poruka. Ažuriraj aplikaciju da je poslušaš.')
        else m - 'voice' end order by o), '[]'::jsonb)
    from jsonb_array_elements(v->'messages') with ordinality t(m, o)));$f$;
create or replace function public.rpc_read_agreement_messages_page_v1(p_expected_user_id uuid, p_agreement_id uuid, p_limit integer default 50,
  p_before_created_at timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $page$
begin
  return private.agreement_messages_v1_view(public.rpc_read_agreement_messages_page_v2(p_expected_user_id, p_agreement_id, p_limit, p_before_created_at, p_before_id),
    'AGREEMENT_MESSAGES_PAGE_V1');
end
$page$;
create or replace function public.rpc_read_agreement_message_window_v1(p_expected_user_id uuid, p_agreement_id uuid, p_target_message_id uuid,
  p_before_count integer default 24, p_after_count integer default 25)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $window$
begin
  return private.agreement_messages_v1_view(public.rpc_read_agreement_message_window_v2(p_expected_user_id, p_agreement_id, p_target_message_id, p_before_count, p_after_count),
    'AGREEMENT_MESSAGE_WINDOW_V1');
end
$window$;

do $acl$
declare f record;
begin
  for f in select p.oid::regprocedure signature, p.proname, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'private' and p.proname in ('agreement_voice_key_v1','agreement_voice_context_v1','agreement_voice_document_v1','agreement_voice_transfer_v1',
          'agreement_voice_message_guard_v1','agreement_voice_link_guard_v1','agreement_voice_asset_guard_v1','agreement_voice_storage_guard_v1','agreement_messages_v1_view'))
         or (n.nspname = 'public' and p.proname in ('rpc_send_agreement_voice_message_v1','rpc_agreement_voice_upload_service_v1','rpc_agreement_voice_read_service_v1',
          'rpc_read_agreement_messages_page_v2','rpc_read_agreement_message_window_v2')) loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.signature);
    if f.nspname = 'public' then
      execute format('grant execute on function %s to %I', f.signature,
        case when f.proname in ('rpc_agreement_voice_upload_service_v1','rpc_agreement_voice_read_service_v1') then 'service_role' else 'authenticated' end);
    end if;
  end loop;
end
$acl$;

do $post$
declare f record; s text;
begin
  if not exists(select 1 from pg_class where oid = 'private.agreement_voice_uploads_v1'::regclass and relrowsecurity and relforcerowsecurity)
     or has_table_privilege('anon', 'private.agreement_voice_uploads_v1', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'private.agreement_voice_uploads_v1', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'private.agreement_voice_uploads_v1', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'VOICE_B1A_TABLE_AUTHORITY_MISMATCH' using errcode = '55000';
  end if;
  if not exists(select 1 from storage.buckets where id = 'agreement-voice' and public = false and file_size_limit = 4194304 and allowed_mime_types = array['audio/mp4'])
     or not exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'agreement_voice_no_client_v1' and permissive = 'RESTRICTIVE') then
    raise exception 'VOICE_B1A_BUCKET_MISMATCH' using errcode = '55000';
  end if;
  for f in select * from (values
    ('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)', false, true),
    ('public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)', true, false),
    ('public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)', true, false),
    ('public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)', false, true),
    ('public.rpc_read_agreement_message_window_v2(uuid,uuid,uuid,integer,integer)', false, true),
    ('public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)', false, true),
    ('public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)', false, true)
  ) p(signature, service_only, authenticated_only) loop
    if not exists(select 1 from pg_proc where oid = to_regprocedure(f.signature) and prosecdef and proconfig = array['search_path=pg_catalog'])
       or has_function_privilege('anon', f.signature, 'EXECUTE') or has_function_privilege('public', f.signature, 'EXECUTE')
       or has_function_privilege('service_role', f.signature, 'EXECUTE') is distinct from f.service_only
       or has_function_privilege('authenticated', f.signature, 'EXECUTE') is distinct from f.authenticated_only then
      raise exception 'VOICE_B1A_FUNCTION_AUTHORITY_MISMATCH: %', f.signature using errcode = '55000';
    end if;
  end loop;
  if not exists(select 1 from pg_constraint where conrelid = 'public.agreement_messages'::regclass and conname = 'agreement_messages_body_media_check' and convalidated)
     or exists(select 1 from pg_constraint where conrelid = 'public.agreement_messages'::regclass and conname = 'agreement_messages_body_photo_check') then
    raise exception 'VOICE_B1A_MESSAGE_CONSTRAINT_MISMATCH' using errcode = '55000';
  end if;
  -- The schema digest covers every table, constraint and trigger: the certificate is UNCERTIFIED now until B1-b re-binds it. Recorded, not asserted.
  s := private.closure_source_digest_v5();
  if s is null then raise exception 'VOICE_B1A_DIGEST_UNAVAILABLE' using errcode = '55000'; end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
