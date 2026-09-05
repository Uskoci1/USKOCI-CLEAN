-- USKOČI RU-4 — forward-only live transfer reconciliation.
-- Repairs one non-canonical identifier introduced during live SQL transport.
-- Never edits historical migration bytes.

do $ru4_live_transfer_reconcile$
declare
  v_def text;
begin
  select pg_get_functiondef('public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure)
    into v_def;

  if position('v_need.requester_rsd::text' in v_def) > 0 then
    v_def := replace(
      v_def,
      'v_need.requester_rsd::text',
      'v_need.requester_price_rsd::text'
    );
    execute v_def;
  end if;

  select pg_get_functiondef('public.rpc_ai_open_need_edit_conversation_v2(uuid)'::regprocedure)
    into v_def;

  if position('v_need.requester_rsd::text' in v_def) > 0
     or position('v_need.requester_price_rsd::text' in v_def) = 0 then
    raise exception 'RU4_LIVE_TRANSFER_RECONCILE_FAILED';
  end if;
end
$ru4_live_transfer_reconcile$;
