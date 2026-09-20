-- USKOČI PKG-008 / GAP-0036 — rollback-only disposable runtime proof.
-- Requires the current canonical owned-media authority plus the source candidate
-- supabase/candidates/pkg008_media_upload_cancellation.sql.
-- No Storage object, Edge deploy, provider, production data or canonical DEV
-- mutation is used; the service chain is driven with synthetic digests only.
\set ON_ERROR_STOP on

begin;

do $seed$
declare
  v_owner uuid := extensions.gen_random_uuid();
  v_attacker uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
  (
    v_owner,'authenticated','authenticated',
    'pkg008-proof-owner-'||v_owner::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','PKG008 Proof Owner','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  ),
  (
    v_attacker,'authenticated','authenticated',
    'pkg008-proof-attacker-'||v_attacker::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','PKG008 Proof Attacker','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  );
  perform set_config('uskoci.pkg008_owner',v_owner::text,true);
  perform set_config('uskoci.pkg008_attacker',v_attacker::text,true);
  perform set_config('uskoci.pkg008_key_absent',extensions.gen_random_uuid()::text,true);
  perform set_config('uskoci.pkg008_key_processing',extensions.gen_random_uuid()::text,true);
  perform set_config('uskoci.pkg008_key_ready',extensions.gen_random_uuid()::text,true);
end
$seed$;

-- 1. The owner opens a NEED_FACT_V2 intake conversation and cancels an ABSENT command.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg008_owner'),true);
select set_config('request.jwt.claims','',true);

do $absent$
declare
  v_owner uuid := current_setting('uskoci.pkg008_owner')::uuid;
  v_key uuid := current_setting('uskoci.pkg008_key_absent')::uuid;
  v_open jsonb;
  v_conv uuid;
  v_receipt jsonb;
  v_replay jsonb;
  v_denied boolean := false;
begin
  v_open := public.rpc_ai_open_need_conversation_owned_v2(extensions.gen_random_uuid());
  v_conv := nullif(v_open->>'conversationId','')::uuid;
  if v_conv is null or (v_open->>'authoritative')::boolean is distinct from true then
    raise exception 'PKG008_OPEN_RECEIPT_INVALID';
  end if;
  perform set_config('uskoci.pkg008_conv',v_conv::text,true);

  v_receipt := public.rpc_cancel_media_upload(v_conv, v_key);
  if (select count(*) from jsonb_object_keys(v_receipt)) <> 8
     or (v_receipt->>'accountId')::uuid <> v_owner
     or (v_receipt->>'conversationId')::uuid <> v_conv
     or (v_receipt->>'clientRequestId')::uuid <> v_key
     or v_receipt->'previousState' <> 'null'::jsonb
     or v_receipt->'assetId' <> 'null'::jsonb
     or (v_receipt->>'selected')::boolean is distinct from false
     or (v_receipt->>'cancelled')::boolean is distinct from true
     or (v_receipt->>'authoritative')::boolean is distinct from true then
    raise exception 'PKG008_ABSENT_RECEIPT_INVALID' using detail = v_receipt::text;
  end if;

  v_replay := public.rpc_cancel_media_upload(v_conv, v_key);
  if v_replay <> v_receipt then
    raise exception 'PKG008_ABSENT_REPLAY_NOT_IDEMPOTENT' using detail = v_replay::text;
  end if;

  -- Absence stays absence: the tombstone never masquerades as an asset.
  begin
    perform public.rpc_read_media_upload(v_key);
  exception when others then
    v_denied := (sqlerrm = 'MEDIA_NOT_FOUND');
  end;
  if not v_denied then raise exception 'PKG008_TOMBSTONE_INVENTED_ASSET'; end if;

  -- A foreign conversation cannot host the cancellation.
  v_denied := false;
  begin
    perform public.rpc_cancel_media_upload(extensions.gen_random_uuid(), v_key);
  exception when others then
    v_denied := (sqlerrm = 'MEDIA_NOT_FOUND');
  end;
  if not v_denied then raise exception 'PKG008_FOREIGN_CONVERSATION_ACCEPTED'; end if;
end
$absent$;

-- 2. A delayed first send of the cancelled key is refused by the service claim;
--    a fresh key is still admitted (the fence is per command, not per account).
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);

do $late$
declare
  v_owner uuid := current_setting('uskoci.pkg008_owner')::uuid;
  v_conv uuid := current_setting('uskoci.pkg008_conv')::uuid;
  v_key uuid := current_setting('uskoci.pkg008_key_absent')::uuid;
  v_processing uuid := current_setting('uskoci.pkg008_key_processing')::uuid;
  v_claim jsonb;
  v_denied boolean := false;
begin
  begin
    perform public.rpc_claim_media_upload_service(v_owner,'TASK',v_conv,v_key,repeat('a',64),1024,'image/jpeg');
  exception when others then
    v_denied := (sqlerrm = 'MEDIA_COMMAND_CANCELLED');
  end;
  if not v_denied then raise exception 'PKG008_LATE_CLAIM_NOT_FENCED'; end if;

  v_claim := public.rpc_claim_media_upload_service(v_owner,'TASK',v_conv,v_processing,repeat('b',64),2048,'image/jpeg');
  if (v_claim->>'acquired')::boolean is distinct from true
     or v_claim->'asset'->>'state' <> 'PROCESSING'
     or (v_claim->'asset'->>'selected')::boolean is distinct from true then
    raise exception 'PKG008_FRESH_CLAIM_INVALID' using detail = v_claim::text;
  end if;
  perform set_config('uskoci.pkg008_processing_asset',v_claim->'asset'->>'assetId',true);
  perform set_config('uskoci.pkg008_processing_attempt',v_claim->>'attemptId',true);
end
$late$;

reset role;
do $late_residue$
declare
  v_owner uuid := current_setting('uskoci.pkg008_owner')::uuid;
  v_key uuid := current_setting('uskoci.pkg008_key_absent')::uuid;
begin
  if exists(select 1 from private.owned_media_assets where account_id=v_owner and client_request_id=v_key) then
    raise exception 'PKG008_LATE_CLAIM_WROTE_ASSET';
  end if;
  if (select count(*) from private.owned_media_cancellations where account_id=v_owner) <> 1 then
    raise exception 'PKG008_TOMBSTONE_COUNT_INVALID';
  end if;
end
$late_residue$;

-- 3. Cancelling an admitted PROCESSING command deselects it; the dispatch may still
--    settle to READY but the photograph never enters the draft.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg008_owner'),true);
select set_config('request.jwt.claims','',true);

do $processing$
declare
  v_conv uuid := current_setting('uskoci.pkg008_conv')::uuid;
  v_key uuid := current_setting('uskoci.pkg008_key_processing')::uuid;
  v_asset uuid := current_setting('uskoci.pkg008_processing_asset')::uuid;
  v_receipt jsonb;
begin
  v_receipt := public.rpc_cancel_media_upload(v_conv, v_key);
  if v_receipt->>'previousState' <> 'PROCESSING'
     or (v_receipt->>'assetId')::uuid <> v_asset
     or (v_receipt->>'selected')::boolean is distinct from false
     or (v_receipt->>'cancelled')::boolean is distinct from true then
    raise exception 'PKG008_PROCESSING_RECEIPT_INVALID' using detail = v_receipt::text;
  end if;
end
$processing$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);

do $settle_deselected$
declare
  v_owner uuid := current_setting('uskoci.pkg008_owner')::uuid;
  v_conv uuid := current_setting('uskoci.pkg008_conv')::uuid;
  v_asset uuid := current_setting('uskoci.pkg008_processing_asset')::uuid;
  v_attempt uuid := current_setting('uskoci.pkg008_processing_attempt')::uuid;
  v_ready uuid := current_setting('uskoci.pkg008_key_ready')::uuid;
  v_staged jsonb;
  v_done jsonb;
  v_claim jsonb;
begin
  v_staged := public.rpc_stage_media_upload_service(v_owner, v_asset, v_attempt, repeat('c',64), 800, 600, 4096);
  if public.rpc_dispatch_media_upload_service(v_owner, v_asset, v_attempt) is distinct from true then
    raise exception 'PKG008_DESELECTED_DISPATCH_INVALID';
  end if;
  if public.rpc_settle_media_upload_service(v_owner, v_asset, repeat('c',64), 'STORED') is distinct from true then
    raise exception 'PKG008_DESELECTED_SETTLE_INVALID';
  end if;
  v_done := public.rpc_complete_media_upload_service(v_owner, v_asset, repeat('c',64));
  if v_done->>'state' <> 'READY' or (v_done->>'selected')::boolean is distinct from false then
    raise exception 'PKG008_DESELECTED_COMPLETION_SELECTED' using detail = v_done::text;
  end if;

  -- 4. A fully admitted photograph (READY, selected, in the draft refs).
  v_claim := public.rpc_claim_media_upload_service(v_owner,'TASK',v_conv,v_ready,repeat('d',64),4096,'image/jpeg');
  perform public.rpc_stage_media_upload_service(v_owner, (v_claim->'asset'->>'assetId')::uuid, (v_claim->>'attemptId')::uuid, repeat('e',64), 1024, 768, 8192);
  perform public.rpc_dispatch_media_upload_service(v_owner, (v_claim->'asset'->>'assetId')::uuid, (v_claim->>'attemptId')::uuid);
  perform public.rpc_settle_media_upload_service(v_owner, (v_claim->'asset'->>'assetId')::uuid, repeat('e',64), 'STORED');
  v_done := public.rpc_complete_media_upload_service(v_owner, (v_claim->'asset'->>'assetId')::uuid, repeat('e',64));
  if v_done->>'state' <> 'READY' or (v_done->>'selected')::boolean is distinct from true then
    raise exception 'PKG008_READY_ADMISSION_INVALID' using detail = v_done::text;
  end if;
  perform set_config('uskoci.pkg008_ready_asset',v_done->>'assetId',true);
  perform set_config('uskoci.pkg008_ready_path',v_done->>'ref',true);
end
$settle_deselected$;

reset role;
do $ready_refs$
declare
  v_conv uuid := current_setting('uskoci.pkg008_conv')::uuid;
  v_path text := current_setting('uskoci.pkg008_ready_path');
begin
  if not (v_path = any(private.media_task_refs(v_conv))) then
    raise exception 'PKG008_READY_NOT_IN_DRAFT_REFS';
  end if;
end
$ready_refs$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg008_owner'),true);
select set_config('request.jwt.claims','',true);

do $ready_cancel$
declare
  v_conv uuid := current_setting('uskoci.pkg008_conv')::uuid;
  v_key uuid := current_setting('uskoci.pkg008_key_ready')::uuid;
  v_asset uuid := current_setting('uskoci.pkg008_ready_asset')::uuid;
  v_receipt jsonb;
  v_photos jsonb;
begin
  v_photos := public.rpc_read_task_photos(v_conv);
  if jsonb_array_length(v_photos->'photos') <> 1 or (v_photos->'photos'->0->>'assetId')::uuid <> v_asset then
    raise exception 'PKG008_DRAFT_BEFORE_CANCEL_INVALID' using detail = v_photos::text;
  end if;
  v_receipt := public.rpc_cancel_media_upload(v_conv, v_key);
  if v_receipt->>'previousState' <> 'READY'
     or (v_receipt->>'assetId')::uuid <> v_asset
     or (v_receipt->>'selected')::boolean is distinct from false
     or (v_receipt->>'cancelled')::boolean is distinct from true then
    raise exception 'PKG008_READY_RECEIPT_INVALID' using detail = v_receipt::text;
  end if;
  v_photos := public.rpc_read_task_photos(v_conv);
  if jsonb_array_length(v_photos->'photos') <> 0 or (v_photos->>'ready')::boolean is distinct from true then
    raise exception 'PKG008_DRAFT_AFTER_CANCEL_INVALID' using detail = v_photos::text;
  end if;
end
$ready_cancel$;

-- 5. Another account can neither cancel nor read the owner's commands.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.pkg008_attacker'),true);
select set_config('request.jwt.claims','',true);

do $attacker$
declare
  v_conv uuid := current_setting('uskoci.pkg008_conv')::uuid;
  v_key uuid := current_setting('uskoci.pkg008_key_processing')::uuid;
  v_denied boolean := false;
begin
  begin
    perform public.rpc_cancel_media_upload(v_conv, v_key);
  exception when others then
    v_denied := (sqlerrm = 'MEDIA_NOT_FOUND');
  end;
  if not v_denied then raise exception 'PKG008_ATTACKER_CANCEL_ACCEPTED'; end if;
  v_denied := false;
  begin
    perform public.rpc_read_media_upload(v_key);
  exception when others then
    v_denied := (sqlerrm = 'MEDIA_NOT_FOUND');
  end;
  if not v_denied then raise exception 'PKG008_ATTACKER_READ_ACCEPTED'; end if;
end
$attacker$;

-- 6. ACL/privacy guard and raw-state assertions run as the proof superuser.
reset role;
do $acl_guard$
declare
  v_owner uuid := current_setting('uskoci.pkg008_owner')::uuid;
  v_attacker uuid := current_setting('uskoci.pkg008_attacker')::uuid;
  v_conv uuid := current_setting('uskoci.pkg008_conv')::uuid;
  v_ready_path text := current_setting('uskoci.pkg008_ready_path');
begin
  if has_function_privilege('anon','public.rpc_cancel_media_upload(uuid,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_cancel_media_upload(uuid,uuid)','EXECUTE') then
    raise exception 'PKG008_CANCEL_WRITER_OPENED';
  end if;
  if not has_function_privilege('authenticated','public.rpc_cancel_media_upload(uuid,uuid)','EXECUTE') then
    raise exception 'PKG008_CANCEL_WRITER_MISSING';
  end if;
  if has_table_privilege('authenticated','private.owned_media_cancellations','SELECT')
     or has_table_privilege('anon','private.owned_media_cancellations','SELECT')
     or has_table_privilege('service_role','private.owned_media_cancellations','SELECT') then
    raise exception 'PKG008_TOMBSTONE_LEDGER_LEAKED';
  end if;
  if (select count(*) from private.owned_media_cancellations where account_id=v_owner) <> 1
     or exists(select 1 from private.owned_media_cancellations where account_id=v_attacker) then
    raise exception 'PKG008_TOMBSTONE_RESIDUE_INVALID';
  end if;
  if (select count(*) from private.owned_media_assets where account_id=v_owner and selected) <> 0 then
    raise exception 'PKG008_CANCELLED_ASSET_STILL_SELECTED';
  end if;
  if v_ready_path = any(private.media_task_refs(v_conv)) then
    raise exception 'PKG008_READY_STILL_IN_DRAFT_REFS';
  end if;
end
$acl_guard$;

rollback;

select 'PASS PKG008_MEDIA_UPLOAD_CANCELLATION absent_tombstone idempotent late_claim_refused fresh_claim_admitted processing_deselected ready_removed owner_only acl zero_residue' as result;
