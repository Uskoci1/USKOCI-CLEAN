-- N01 candidate: Agreement message -> durable counterpart event.
-- PROOF-ONLY CANDIDATE, NOT AN APPLIED OR PRODUCTION-ADMITTED MIGRATION.
-- Promote through a separately reviewed forward migration only after a permitted
-- fresh production preflight and all canonical gates. Never edit applied bytes.
-- Preserves current signature, Auth/party/state checks, 2000-char existing limit,
-- message writer and UUID result. No message-command retry/idempotency redesign.
-- Event dedupe is per persisted message; repeated sends remain separate messages.

begin;
do $n01_predecessor$
begin
  if to_regprocedure('public.rpc_send_agreement_message(uuid,text)') is null
     or to_regprocedure('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)') is null then
    raise exception 'N01_PREDECESSOR_MISSING' using errcode='55000';
  end if;
  if (select md5(prosrc) from pg_catalog.pg_proc
      where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure)
      is distinct from '705f19630e27792639d737bfa41d77c6' then
    raise exception 'N01_MESSAGE_WRITER_PREDECESSOR_MISMATCH' using errcode='55000';
  end if;
end
$n01_predecessor$;

create or replace function public.rpc_send_agreement_message(p_agreement_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 1 then
    raise exception 'MESSAGE_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(btrim(p_body)) > 2000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = '22001';
  end if;

  select * into v_agreement from public.agreements where id = p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id, v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;
  if v_agreement.status not in ('CONFIRMED','SUPERSEDED') then
    raise exception 'CHAT_NOT_AVAILABLE' using errcode = 'P0001', detail = v_agreement.status;
  end if;

  insert into public.agreement_messages(agreement_id, agreement_version, sender_account_id, body)
  values (p_agreement_id, v_agreement.current_version, v_uid, btrim(p_body))
  returning id into v_id;
  -- Durable domain event only; private.emit_event owns preference/delivery logic.
  -- Do not copy message text, contact details, location or task title into payload.
  perform private.emit_event(
    case when v_uid = v_agreement.requester_account_id
      then v_agreement.worker_account_id else v_agreement.requester_account_id end,
    case when v_uid = v_agreement.requester_account_id then 'WORKER' else 'REQUESTER' end,
    'MESSAGE_RECEIVED', 'AGREEMENT', p_agreement_id, v_agreement.current_version,
    'Nova poruka', 'Imate novu poruku u Dogovoru.',
    'agreement_message:' || v_id::text,
    'NORMAL', jsonb_build_object('message_id', v_id)
  );
  return v_id;
end;
$function$;

-- Preserve the admitted caller boundary. The service-only emitter remains private.
revoke all on function public.rpc_send_agreement_message(uuid,text) from public, anon;
grant execute on function public.rpc_send_agreement_message(uuid,text) to authenticated;
commit;
