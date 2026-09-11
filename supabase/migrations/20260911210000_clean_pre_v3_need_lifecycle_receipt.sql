-- Candidate only. Read the existing owner-bound audit authority; no new terminal writer.
-- Historical cancel/delete routines and applied migration bytes remain unchanged.
create function public.rpc_get_need_lifecycle_receipt(
  p_need_id uuid, p_need_revision integer, p_action text
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $fn$
declare
  u uuid := auth.uid();
  revision_now integer;
  receipt jsonb;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if p_need_id is null or p_need_revision is null or p_need_revision < 1
     or p_action is null or p_action not in ('CANCEL','DELETE_DRAFT') then
    raise exception using errcode='22023', message='NEED_COMMAND_INVALID_INPUT';
  end if;
  if p_action = 'DELETE_DRAFT' then
    if exists (select 1 from private.marketplace_audit_log a
      where a.actor_user_id=u and a.entity_type='NEED' and a.entity_id=p_need_id
        and a.entity_version=p_need_revision and a.event_type='NEED_DRAFT_DELETED') then
      receipt := jsonb_build_object('needId',p_need_id,'revision',p_need_revision,'deleted',true,'idempotentReplay',true);
    end if;
  else
    select n.revision into revision_now from public.needs n
      where n.id=p_need_id and n.requester_account_id=u and n.status='CANCELLED';
    if revision_now is not null and exists (select 1 from private.marketplace_audit_log a
      where a.actor_user_id=u and a.entity_type='NEED' and a.entity_id=p_need_id
        and a.entity_version=revision_now and a.event_type='NEED_CANCELLED') then
      receipt := jsonb_build_object('needId',p_need_id,'revision',revision_now,
        'status','CANCELLED','affectedResponses',0,'idempotentReplay',true);
    end if;
  end if;
  -- Absence is deliberately NOT a failure/deletion claim. A timed-out write can still commit later.
  return jsonb_build_object('authoritative',true,'action',p_action,
    'state',case when receipt is null then 'NOT_CONFIRMED' else 'CONFIRMED' end,
    'receipt',receipt);
end;
$fn$;
revoke all on function public.rpc_get_need_lifecycle_receipt(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.rpc_get_need_lifecycle_receipt(uuid,integer,text) to authenticated;
comment on function public.rpc_get_need_lifecycle_receipt(uuid,integer,text) is
  'Owner-only, audit-backed terminal readback. No private reason, no list-absence inference, no write or automatic retry.';
