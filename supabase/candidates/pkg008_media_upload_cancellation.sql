-- USKOČI PKG-008 / GAP-0036
-- SOURCE CANDIDATE ONLY. This file is intentionally outside supabase/migrations.
-- It must not be applied to canonical DEV until it is promoted as a forward-only
-- migration and the package/disposable-schema gates authorize that promotion.
--
-- Purpose: give the owner of an unconfirmed Task photo upload command an
-- authoritative cancellation inside the existing owned-media domain. An absent
-- command receives a durable tombstone that the service claim refuses, so a
-- delayed first send can never commit behind the cancellation; an already
-- admitted command is deselected through the existing removal writer. This is
-- NOT a second upload writer, NOT a Storage deleter, NOT a raw-photo persistence
-- policy and NOT a retention rule. The command identity is never erased by the
-- client merely because a read found no row.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $pkg008_preflight$
declare
  v_claim text;
begin
  if to_regclass('private.owned_media_assets') is null
     or to_regprocedure('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)') is null
     or to_regprocedure('public.rpc_read_media_upload(uuid)') is null
     or to_regprocedure('public.rpc_remove_task_photo(uuid,uuid)') is null
     or to_regprocedure('private.media_asset_document(private.owned_media_assets)') is null
     or to_regprocedure('private.closure_assert_open(uuid,uuid)') is null then
    raise exception 'PKG008_PREDECESSOR_MISMATCH: canonical owned-media authority is incomplete'
      using errcode = '55000';
  end if;
  if to_regclass('private.owned_media_cancellations') is not null
     or to_regprocedure('public.rpc_cancel_media_upload(uuid,uuid)') is not null then
    raise exception 'PKG008_ALREADY_PRESENT' using errcode = '55000';
  end if;
  v_claim := pg_get_functiondef('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)'::regprocedure);
  if position('MEDIA_COMMAND_CANCELLED' in v_claim) > 0 then
    raise exception 'PKG008_ALREADY_PRESENT: service claim already fenced' using errcode = '55000';
  end if;
  -- Snapshot the reviewed claim ACL; the rewrite below must not broaden or narrow it.
  perform set_config('pkg008.claim_acl',
    has_function_privilege('anon', 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', 'EXECUTE')::text
    || has_function_privilege('authenticated', 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', 'EXECUTE')::text
    || has_function_privilege('service_role', 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', 'EXECUTE')::text,
    true);
end
$pkg008_preflight$;

create table private.owned_media_cancellations (
  account_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  client_request_id uuid not null,
  cancelled_at timestamptz not null default clock_timestamp(),
  primary key (account_id, client_request_id)
);

alter table private.owned_media_cancellations enable row level security;
alter table private.owned_media_cancellations force row level security;
revoke all on table private.owned_media_cancellations from public, anon, authenticated, service_role;

comment on table private.owned_media_cancellations is
  'PKG-008 durable tombstones for owner-cancelled Task upload commands that never reached the service claim; the claim refuses these keys. Opaque identities only.';

-- The service claim gains exactly one fence, right after its per-command advisory
-- lock, so a delayed first send serializes behind the owner cancellation and then
-- meets the tombstone. The rest of the reviewed body is preserved verbatim and
-- CREATE OR REPLACE keeps its grants (verified in the postcondition).
do $pkg008_claim_fence$
declare
  v_def text;
  v_anchor text := $anchor$perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||p_account_id::text||':'||p_client_request_id::text,130));$anchor$;
  v_fence text := $fence$
 if exists(select 1 from private.owned_media_cancellations x where x.account_id=p_account_id and x.client_request_id=p_client_request_id) then raise exception 'MEDIA_COMMAND_CANCELLED' using errcode='55000'; end if;$fence$;
begin
  v_def := pg_get_functiondef('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'PKG008_CLAIM_ANCHOR_MISSING' using errcode = '55000';
  end if;
  execute replace(v_def, v_anchor, v_anchor || v_fence);
  v_def := pg_get_functiondef('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)'::regprocedure);
  if position('MEDIA_COMMAND_CANCELLED' in v_def) = 0 or position(v_anchor in v_def) = 0 then
    raise exception 'PKG008_CLAIM_FENCE_MISSING' using errcode = '55000';
  end if;
end
$pkg008_claim_fence$;

create function public.rpc_cancel_media_upload(
  p_conversation_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  a private.owned_media_assets;
  v_previous text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_conversation_id is null or p_client_request_id is null then
    raise exception 'MEDIA_INPUT_INVALID' using errcode = '22023';
  end if;
  perform private.closure_assert_open(v_uid);

  -- Only the owner's own intake conversation may host the command. This is not an
  -- editability check: a draft that can no longer be edited may still retire an
  -- unconfirmed command identity.
  perform 1 from public.ai_conversations c
   where c.id = p_conversation_id and c.account_id = v_uid and c.purpose = 'NEED_INTAKE';
  if not found then raise exception 'MEDIA_NOT_FOUND' using errcode = '42501'; end if;

  -- Same lock as the service claim: a delayed first send with this key waits here
  -- and then meets the tombstone instead of creating an asset.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||v_uid::text||':'||p_client_request_id::text,130));

  select * into a from private.owned_media_assets
   where account_id = v_uid and client_request_id = p_client_request_id for update;
  if not found then
    insert into private.owned_media_cancellations(account_id, conversation_id, client_request_id)
    values (v_uid, p_conversation_id, p_client_request_id)
    on conflict (account_id, client_request_id) do nothing;
    return jsonb_build_object(
      'accountId', v_uid, 'conversationId', p_conversation_id, 'clientRequestId', p_client_request_id,
      'previousState', null, 'assetId', null, 'selected', false, 'cancelled', true, 'authoritative', true);
  end if;

  if a.scope <> 'TASK' or a.conversation_id is distinct from p_conversation_id then
    raise exception 'MEDIA_COMMAND_CONFLICT' using errcode = '40001';
  end if;
  v_previous := a.state;
  if a.state = 'READY' then
    -- An admitted photograph leaves the draft through the existing removal writer
    -- (refs plus selected=false); no Storage object is deleted here.
    perform public.rpc_remove_task_photo(a.conversation_id, a.id);
  elsif a.selected then
    -- PROCESSING/STAGED: the dispatch may still settle, but it can never select
    -- this photograph into the draft. FAILED is already retired.
    update private.owned_media_assets set selected = false where id = a.id;
  end if;
  select * into a from private.owned_media_assets where id = a.id;
  return jsonb_build_object(
    'accountId', v_uid, 'conversationId', a.conversation_id, 'clientRequestId', a.client_request_id,
    'previousState', v_previous, 'assetId', a.id, 'selected', a.selected, 'cancelled', true, 'authoritative', true);
end
$function$;

revoke all on function public.rpc_cancel_media_upload(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_cancel_media_upload(uuid,uuid) to authenticated;

comment on function public.rpc_cancel_media_upload(uuid,uuid) is
  'PKG-008 owner-only cancellation of an unconfirmed Task upload command: durable tombstone for an absent key (refused by the service claim), deselection through the existing removal writer for an admitted one. Never a second upload, Storage delete or retention rule.';

do $pkg008_postcondition$
begin
  if to_regprocedure('public.rpc_cancel_media_upload(uuid,uuid)') is null then
    raise exception 'PKG008_POSTCONDITION_FAILED: cancellation writer missing';
  end if;
  if not has_function_privilege('authenticated', 'public.rpc_cancel_media_upload(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rpc_cancel_media_upload(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.rpc_cancel_media_upload(uuid,uuid)', 'EXECUTE') then
    raise exception 'PKG008_POSTCONDITION_FAILED: cancellation writer ACL mismatch';
  end if;
  if has_table_privilege('authenticated', 'private.owned_media_cancellations', 'SELECT')
     or has_table_privilege('authenticated', 'private.owned_media_cancellations', 'INSERT')
     or has_table_privilege('service_role', 'private.owned_media_cancellations', 'SELECT') then
    raise exception 'PKG008_POSTCONDITION_FAILED: tombstone ledger leaked to a client role';
  end if;
  if current_setting('pkg008.claim_acl', true) is distinct from
     (has_function_privilege('anon', 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', 'EXECUTE')::text
      || has_function_privilege('authenticated', 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', 'EXECUTE')::text
      || has_function_privilege('service_role', 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', 'EXECUTE')::text) then
    raise exception 'PKG008_POSTCONDITION_FAILED: service claim ACL changed';
  end if;
end
$pkg008_postcondition$;

commit;
