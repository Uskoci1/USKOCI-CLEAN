-- PKG-050a candidate. Control rows D03 / P01, two-party run of 2026-09-23: reading a Dogovor's conversation
-- leaves its "Nova poruka" notification unread. Contract:
-- docs/implementation/v5-ai-first/pkg050/PKG050_AGREEMENT_MESSAGES_READ.md
--
-- What is broken today. A MESSAGE_RECEIVED event is marked read in exactly one place: rpc_mark_activity_event_read,
-- which the inbox screen calls when a person taps that one notification. A person who is already in the
-- conversation — the owner had it open when the reply arrived, pulled down, read it — never taps the
-- notification, so it stays unread on the server, in the inbox and in every count built on it. The only
-- other writer, rpc_mark_inbox_read, sweeps everything up to a moment, which would also silence notifications
-- about other tasks and Agreements the person has not seen. The owner decided on 2026-09-23: seeing the
-- conversation settles its message notifications.
--
-- What this adds. One authenticated writer, keyed by the Agreement, that marks read the caller's own unread
-- MESSAGE_RECEIVED events about that Agreement — nothing about any other Agreement, task or event kind, and
-- nothing of the other party's. It repeats rpc_mark_activity_event_read's visibility rule (an event counts
-- only with an in-app delivery that was not suppressed) and refuses anyone who is not a party the same way
-- the workspace does. It returns how many it settled, so a caller can tell "nothing was unread" from "done".
--
-- Function-only: no table, column, constraint, trigger, table ACL or reviewed erasure function changes, so the
-- certified closure digest must NOT move. The candidate asserts that before and after, and refuses to run twice.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg050_state(certified text not null) on commit drop;

do $pre$
declare v_certified text;
begin
  -- Not already applied, in any form.
  if to_regprocedure('public.rpc_mark_agreement_messages_read(uuid)') is not null then
    raise exception 'PKG050_ALREADY_APPLIED' using errcode = '55000';
  end if;
  -- The two existing read writers whose rule this repeats, exactly as read on 2026-09-23.
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_mark_activity_event_read(uuid)'))
       is distinct from '89729d590c7e402a45a2ac60d516cae3' then
    raise exception 'PKG050_PREDECESSOR_DRIFT: rpc_mark_activity_event_read' using errcode = '55000';
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_mark_inbox_read(timestamptz,text)'))
       is distinct from '577d1582d5109f34fa0991e65af29f9d' then
    raise exception 'PKG050_PREDECESSOR_DRIFT: rpc_mark_inbox_read' using errcode = '55000';
  end if;
  -- The certificate is consistent and ready before anything is written.
  v_certified := private.closure_source_digest_v5();
  if v_certified is distinct from (select sha256 from private.closure_source_v5 where singleton)
     or v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG050_CERTIFICATE_NOT_READY' using errcode = '55000';
  end if;
  insert into pkg050_state(certified) values (v_certified);
end
$pre$;

create function public.rpc_mark_agreement_messages_read(p_agreement_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_agreement_id is null then raise exception 'INVALID_AGREEMENT' using errcode = '22023'; end if;
  -- Only a party of this Dogovor may settle its notifications; anyone else is told what the workspace tells them.
  if not exists (select 1 from public.agreements a where a.id = p_agreement_id
                   and v_uid in (a.requester_account_id, a.worker_account_id)) then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- The same visibility rule as rpc_mark_activity_event_read: only an event with an in-app delivery counts.
  update public.user_activity_events e set read_at = statement_timestamp()
    where e.recipient_user_id = v_uid and e.entity_type = 'AGREEMENT' and e.entity_id = p_agreement_id
      and e.event_type = 'MESSAGE_RECEIVED' and e.read_at is null
      and exists (select 1 from public.notification_deliveries visible
        where visible.event_id = e.id and visible.recipient_user_id = v_uid
          and visible.channel = 'IN_APP' and visible.state <> 'SUPPRESSED');
  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

revoke all on function public.rpc_mark_agreement_messages_read(uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_mark_agreement_messages_read(uuid) to authenticated;
comment on function public.rpc_mark_agreement_messages_read(uuid) is
  'PKG-050 marks read the caller''s own unread MESSAGE_RECEIVED events about one Agreement, with the same in-app visibility rule as rpc_mark_activity_event_read. Parties only; returns the number settled.';

do $post$
declare v_certified text; v_acl text;
begin
  select certified into strict v_certified from pkg050_state;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_mark_agreement_messages_read(uuid)'))
       is distinct from '725de3a6132fba68b98a09fb2b66ae7a' then
    raise exception 'PKG050_BODY_MISMATCH';
  end if;
  if not (select prosecdef from pg_proc where oid = to_regprocedure('public.rpc_mark_agreement_messages_read(uuid)'))
     or (select proconfig::text from pg_proc where oid = to_regprocedure('public.rpc_mark_agreement_messages_read(uuid)'))
        is distinct from '{search_path=pg_catalog}'
     or (select provolatile from pg_proc where oid = to_regprocedure('public.rpc_mark_agreement_messages_read(uuid)')) <> 'v' then
    raise exception 'PKG050_FUNCTION_AUTHORITY_MISMATCH';
  end if;
  v_acl := has_function_privilege('anon', 'public.rpc_mark_agreement_messages_read(uuid)', 'EXECUTE')::text
        || has_function_privilege('authenticated', 'public.rpc_mark_agreement_messages_read(uuid)', 'EXECUTE')::text
        || has_function_privilege('service_role', 'public.rpc_mark_agreement_messages_read(uuid)', 'EXECUTE')::text;
  if v_acl is distinct from 'falsetruefalse' then
    raise exception 'PKG050_ACL_MISMATCH: %', v_acl;
  end if;
  -- Nothing the certificate watches was touched.
  if private.closure_source_digest_v5() is distinct from v_certified
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from v_certified
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_certified
     or not private.retention_ai_source_ready() then
    raise exception 'PKG050_CERTIFICATE_CHANGED';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
