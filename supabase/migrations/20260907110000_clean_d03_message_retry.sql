-- D03 stable message command, source/disposable candidate; not live.
-- Keep the existing message/event writer and participant-visible history.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.agreement_messages in share row exclusive mode;
do $guard$
begin
  if (select md5(prosrc) from pg_proc where oid=
      to_regprocedure('public.rpc_send_agreement_message(uuid,text)'))
      is distinct from 'd9a3733814e3101a3941284c07dc2bed'
    or (select count(*) from pg_attribute where attrelid='public.agreement_messages'::regclass
      and attnum>0 and not attisdropped)<>7
    or exists(select 1 from pg_attribute where attrelid='public.agreement_messages'::regclass
      and attname='client_message_id' and not attisdropped)
    or to_regprocedure('public.rpc_send_agreement_message_v2(uuid,uuid,text,text)') is not null then
    raise exception 'D03_MESSAGE_RETRY_PREDECESSOR_MISMATCH' using errcode='55000';
  end if;
end
$guard$;

alter table public.agreement_messages add column client_message_id text
  check(client_message_id is null or client_message_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$');
create unique index agreement_messages_sender_client_id_unique
  on public.agreement_messages(sender_account_id,client_message_id)
  where client_message_id is not null;

create function public.rpc_send_agreement_message_v2(
  p_expected_user_id uuid,p_agreement_id uuid,p_client_message_id text,p_body text)
returns uuid language plpgsql security definer set search_path=pg_catalog
as $message$
declare
  v_uid uuid:=auth.uid();
  v_body text:=btrim(coalesce(p_body,''));
  v_agreement public.agreements%rowtype;
  v_previous public.agreement_messages%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_expected_user_id is null or p_expected_user_id<>v_uid then
    raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
  if p_client_message_id is null or p_client_message_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$' then
    raise exception 'INVALID_CLIENT_MESSAGE_ID' using errcode='22023'; end if;
  if char_length(v_body)<1 then raise exception 'MESSAGE_REQUIRED' using errcode='P0001'; end if;
  if char_length(v_body)>2000 then raise exception 'MESSAGE_TOO_LONG' using errcode='22001'; end if;

  -- Sender-global command ownership: moving the same key to another agreement
  -- is a conflict, never a second message. Identical concurrent retries wait.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:message:'||v_uid::text||':'||p_client_message_id,0));
  -- Serialize against current lifecycle changes before invoking the unchanged
  -- writer. A replay still requires current membership, but may acknowledge a
  -- previously committed message after the agreement became read-only.
  select * into v_agreement from public.agreements where id=p_agreement_id for share;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id,v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode='42501'; end if;

  select * into v_previous from public.agreement_messages
    where sender_account_id=v_uid and client_message_id=p_client_message_id;
  if found then
    if v_previous.agreement_id<>p_agreement_id or v_previous.body<>v_body then
      raise exception 'MESSAGE_COMMAND_CONFLICT' using errcode='40001'; end if;
    return v_previous.id;
  end if;

  -- The proven legacy function remains the sole domain writer: same validation,
  -- agreement version, message UUID and one durable counterpart event.
  v_id:=public.rpc_send_agreement_message(p_agreement_id,v_body);
  update public.agreement_messages set client_message_id=p_client_message_id
    where id=v_id and sender_account_id=v_uid and agreement_id=p_agreement_id
      and client_message_id is null;
  if not found then raise exception 'MESSAGE_COMMAND_PERSISTENCE_FAILED' using errcode='55000'; end if;
  return v_id;
end
$message$;
revoke all on function public.rpc_send_agreement_message_v2(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.rpc_send_agreement_message_v2(uuid,uuid,text,text) to authenticated;
commit;
