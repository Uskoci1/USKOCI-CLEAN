-- PKG-046a candidate. F16 / control row A05 / GAP-0036: the app's "Odustani od nepotvrđenog slanja" calls
-- public.rpc_cancel_media_upload(uuid,uuid), which does not exist on canonical DEV (read-only pg_proc count 0,
-- 2026-09-22). Contract/proof: docs/implementation/v5-ai-first/pkg046/PKG046_MEDIA_UPLOAD_CANCELLATION.md
--
-- Why the 2026-09-16 PKG-008 candidate cannot be applied as written: it creates private.owned_media_cancellations.
-- Since PKG-023f the certified closure source digest hashes every public/private table's columns, constraints and
-- triggers (private.closure_schema_digest_v5_139) and every table's ACL (private.closure_erasure_program_digest_v5).
-- Any durable record of a cancellation therefore moves the certificate, and a new account-keyed table would also
-- sit outside the 73 redaction relations of the erasure program. This candidate keeps the record INSIDE
-- private.owned_media_assets, the way private.agreement_photo_uploads_v5 already models cancellation:
--   - state 'CANCELLED' with null input columns is the durable tombstone of an absent command;
--   - the service claim refuses that key (MEDIA_COMMAND_CANCELLED) right after its per-command advisory lock;
--   - an admitted PROCESSING/STAGED command is deselected; a READY photograph leaves the draft through the
--     existing removal writer; rpc_read_media_upload never reports a tombstone as an asset.
-- The tombstone is owner-scoped, already inside a redaction relation (t.account_id=$1, DELETE unless protected),
-- and inherits the existing evidence/hold triggers unchanged. No trigger, redaction rule or Storage object changes.
--
-- Because the schema changes, the certificate is re-bound in its three places (PKG-032b pattern): before, the
-- live digest equals the certified value everywhere, the source is ready and no closure is executing; the new
-- digest differs, and undoing ONLY the schema change inside this transaction gives the old value back; after, the
-- three places hold the new live value, the readiness function differs by that constant alone, the source is
-- ready and the erasure binding carries the new value. Owner approval for this certificate movement is required
-- before application; the candidate refuses to run twice.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create temporary table pkg046_state(certified text not null, ready_masked text not null, claim_before text not null,
  read_before text not null, moved text) on commit drop;

do $pre$
declare v_certified text; v_ready_def text; v_claim text; v_read text;
  v_claim_sig text := 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)';
begin
  -- Predecessors: the reviewed owned-media authority, exactly as on DEV.
  if to_regclass('private.owned_media_assets') is null
     or to_regprocedure(v_claim_sig) is null
     or to_regprocedure('public.rpc_read_media_upload(uuid)') is null
     or to_regprocedure('public.rpc_read_task_photos(uuid)') is null
     or to_regprocedure('public.rpc_remove_task_photo(uuid,uuid)') is null
     or to_regprocedure('private.media_asset_document(private.owned_media_assets)') is null
     or to_regprocedure('private.media_task_refs(uuid)') is null
     or to_regprocedure('private.closure_assert_open(uuid,uuid)') is null then
    raise exception 'PKG046_PREDECESSOR_MISSING' using errcode = '55000';
  end if;
  select prosrc into strict v_claim from pg_proc where oid = to_regprocedure(v_claim_sig);
  select prosrc into strict v_read from pg_proc where oid = to_regprocedure('public.rpc_read_media_upload(uuid)');
  -- Not already present, in any form (checked before the drift pins: an applied fence is not drift).
  if to_regprocedure('public.rpc_cancel_media_upload(uuid,uuid)') is not null
     or to_regclass('private.owned_media_cancellations') is not null
     or position('MEDIA_COMMAND_CANCELLED' in v_claim) > 0
     or exists (select 1 from pg_constraint where conrelid = 'private.owned_media_assets'::regclass
                  and conname = 'owned_media_assets_cancelled_tombstone_check') then
    raise exception 'PKG046_ALREADY_APPLIED' using errcode = '55000';
  end if;
  if md5(v_claim) is distinct from '81962817e4f67b1e2663da0828f0da90' then
    raise exception 'PKG046_PREDECESSOR_DRIFT: %', v_claim_sig using errcode = '55000';
  end if;
  if md5(v_read) is distinct from '63ed40f2d8c4b7cc8805730f29046dcc' then
    raise exception 'PKG046_PREDECESSOR_DRIFT: public.rpc_read_media_upload(uuid)' using errcode = '55000';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'private.owned_media_assets'::regclass
        and conname = 'owned_media_assets_state_check')
     is distinct from $c$CHECK ((state = ANY (ARRAY['PROCESSING'::text, 'STAGED'::text, 'READY'::text, 'FAILED'::text])))$c$ then
    raise exception 'PKG046_PREDECESSOR_DRIFT: owned_media_assets_state_check' using errcode = '55000';
  end if;
  if (select count(*) from pg_attribute where attrelid = 'private.owned_media_assets'::regclass
        and attname in ('input_sha256','input_bytes','input_type') and attnotnull and not attisdropped) <> 3 then
    raise exception 'PKG046_PREDECESSOR_DRIFT: input columns' using errcode = '55000';
  end if;
  if exists (select 1 from private.owned_media_assets where state = 'CANCELLED') then
    raise exception 'PKG046_PREDECESSOR_DRIFT: unexpected CANCELLED rows' using errcode = '55000';
  end if;
  -- The claim ACL is snapshotted; CREATE OR REPLACE below must not move it.
  perform set_config('pkg046.claim_acl',
    has_function_privilege('anon', v_claim_sig, 'EXECUTE')::text
    || has_function_privilege('authenticated', v_claim_sig, 'EXECUTE')::text
    || has_function_privilege('service_role', v_claim_sig, 'EXECUTE')::text, true);
  perform set_config('pkg046.read_acl',
    has_function_privilege('anon', 'public.rpc_read_media_upload(uuid)', 'EXECUTE')::text
    || has_function_privilege('authenticated', 'public.rpc_read_media_upload(uuid)', 'EXECUTE')::text
    || has_function_privilege('service_role', 'public.rpc_read_media_upload(uuid)', 'EXECUTE')::text, true);
  -- One certified value, in all three places, equal to the live digest, and the source ready.
  select sha256 into strict v_certified from private.closure_source_v5 where singleton;
  if v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton) then
    raise exception 'PKG046_CERTIFIED_VALUES_DISAGREE';
  end if;
  v_ready_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if (length(v_ready_def) - length(replace(v_ready_def, v_certified, ''))) <> length(v_certified)
     or (select count(*) from regexp_matches(v_ready_def, '[0-9a-f]{64}', 'g')) <> 1 then
    raise exception 'PKG046_READY_BINDING_INVALID';
  end if;
  if private.closure_source_digest_v5() is distinct from v_certified or not private.retention_ai_source_ready() then
    raise exception 'PKG046_CLOSURE_SOURCE_NOT_READY';
  end if;
  if exists (select 1 from private.closure_executions_v5 where state = 'EXECUTING') then
    raise exception 'PKG046_CLOSURE_IN_FLIGHT';
  end if;
  insert into pkg046_state(certified, ready_masked, claim_before, read_before)
    select v_certified,
      (select md5(regexp_replace(prosrc, '[0-9a-f]{64}', '<CERTIFIED>', 'g')) from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure),
      v_claim, v_read;
end
$pre$;

-- a. Schema: a CANCELLED tombstone is a TASK row with no input, never selected, never dispatched, never stored.
alter table private.owned_media_assets
  alter column input_sha256 drop not null,
  alter column input_bytes drop not null,
  alter column input_type drop not null;
alter table private.owned_media_assets drop constraint owned_media_assets_state_check;
alter table private.owned_media_assets add constraint owned_media_assets_state_check
  check (state = any (array['PROCESSING'::text, 'STAGED'::text, 'READY'::text, 'FAILED'::text, 'CANCELLED'::text]));
alter table private.owned_media_assets add constraint owned_media_assets_cancelled_tombstone_check
  check ((state = 'CANCELLED'::text) = (input_sha256 is null and input_bytes is null and input_type is null)
     and (state <> 'CANCELLED'::text or (scope = 'TASK'::text and not selected
          and dispatch_state = 'NOT_DISPATCHED'::text and storage_path is null)));

-- b. The new digest reflects the schema change and only the schema change: undoing (a) inside a rolled-back
--    sub-transaction gives the certified value back.
do $isolate$
declare v_old text; v_new text; v_back text; v_again text;
begin
  select certified into strict v_old from pkg046_state;
  v_new := private.closure_source_digest_v5();
  if v_new is null then raise exception 'PKG046_SOURCE_DIGEST_UNAVAILABLE'; end if;
  if v_new = v_old then raise exception 'PKG046_SCHEMA_CHANGE_NOT_IN_THE_DIGEST'; end if;
  begin
    alter table private.owned_media_assets drop constraint owned_media_assets_cancelled_tombstone_check;
    alter table private.owned_media_assets drop constraint owned_media_assets_state_check;
    alter table private.owned_media_assets add constraint owned_media_assets_state_check
      check (state = any (array['PROCESSING'::text, 'STAGED'::text, 'READY'::text, 'FAILED'::text]));
    alter table private.owned_media_assets
      alter column input_sha256 set not null, alter column input_bytes set not null, alter column input_type set not null;
    raise exception 'PKG046_PROBE' using detail = private.closure_source_digest_v5();
  exception when others then
    if sqlerrm <> 'PKG046_PROBE' then raise; end if;
    get stacked diagnostics v_back = pg_exception_detail;
  end;
  if v_back is distinct from v_old then
    raise exception 'PKG046_UNREVIEWED_CHANGE: with the old schema the digest is %, the certified value is %', v_back, v_old;
  end if;
  v_again := private.closure_source_digest_v5();
  if v_again is distinct from v_new then raise exception 'PKG046_DIGEST_NOT_STABLE'; end if;
  update pkg046_state set moved = v_new;
end
$isolate$;

-- c. The service claim gains exactly one fence, right after its per-command advisory lock: a delayed first send
--    serializes behind the owner's cancellation and then meets the tombstone. The rest of the body is verbatim and
--    CREATE OR REPLACE keeps the grants (checked below).
do $claim$
declare v_def text;
  v_anchor text := $anchor$perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||p_account_id::text||':'||p_client_request_id::text,130));$anchor$;
  v_fence text := $fence$
 if exists(select 1 from private.owned_media_assets x where x.account_id=p_account_id and x.client_request_id=p_client_request_id and x.state='CANCELLED') then raise exception 'MEDIA_COMMAND_CANCELLED' using errcode='55000'; end if;$fence$;
begin
  v_def := pg_get_functiondef('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'PKG046_CLAIM_ANCHOR_MISSING' using errcode = '55000';
  end if;
  execute replace(v_def, v_anchor, v_anchor || v_fence);
end
$claim$;

-- d. A tombstone never reads as an asset: the owner read of one command skips CANCELLED rows (MEDIA_NOT_FOUND).
do $read$
declare v_def text;
  v_anchor text := $anchor$ where account_id=auth.uid() and client_request_id=p_client_request_id;$anchor$;
  v_after text := $after$ where account_id=auth.uid() and client_request_id=p_client_request_id and state<>'CANCELLED';$after$;
begin
  v_def := pg_get_functiondef('public.rpc_read_media_upload(uuid)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'PKG046_READ_ANCHOR_MISSING' using errcode = '55000';
  end if;
  execute replace(v_def, v_anchor, v_after);
end
$read$;

-- e. The owner's cancellation of one unconfirmed TASK upload command.
create function public.rpc_cancel_media_upload(p_conversation_id uuid, p_client_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare v_uid uuid := auth.uid(); c public.ai_conversations; a private.owned_media_assets; v_previous text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_conversation_id is null or p_client_request_id is null then raise exception 'MEDIA_INPUT_INVALID' using errcode='22023'; end if;
 perform private.closure_assert_open(v_uid);
 -- Only the owner's own intake conversation may host the command. This is not an editability check: a draft
 -- that can no longer be edited may still retire an unconfirmed command identity.
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=v_uid;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'MEDIA_NOT_FOUND' using errcode='42501'; end if;
 -- Same lock as the service claim: a delayed first send with this key waits here and then meets the tombstone.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||v_uid::text||':'||p_client_request_id::text,130));
 select * into a from private.owned_media_assets where account_id=v_uid and client_request_id=p_client_request_id for update;
 if not found then
  insert into private.owned_media_assets(account_id,scope,conversation_id,client_request_id,state,selected,dispatch_state)
  values(v_uid,'TASK',c.id,p_client_request_id,'CANCELLED',false,'NOT_DISPATCHED');
  return jsonb_build_object('accountId',v_uid,'conversationId',c.id,'clientRequestId',p_client_request_id,
   'previousState',null,'assetId',null,'selected',false,'cancelled',true,'authoritative',true);
 end if;
 if a.scope<>'TASK' or a.conversation_id is distinct from c.id then raise exception 'MEDIA_COMMAND_CONFLICT' using errcode='40001'; end if;
 if a.state='CANCELLED' then
  return jsonb_build_object('accountId',v_uid,'conversationId',c.id,'clientRequestId',p_client_request_id,
   'previousState',null,'assetId',null,'selected',false,'cancelled',true,'authoritative',true);
 end if;
 v_previous := a.state;
 if a.state='READY' then
  -- An admitted photograph leaves the draft through the existing removal writer (refs plus selected=false);
  -- no Storage object is deleted here.
  perform public.rpc_remove_task_photo(a.conversation_id,a.id);
 elsif a.selected then
  -- PROCESSING/STAGED: the dispatch may still settle, but it can never select this photograph into the draft.
  -- FAILED is already retired.
  update private.owned_media_assets set selected=false where id=a.id;
 end if;
 select * into a from private.owned_media_assets where id=a.id;
 return jsonb_build_object('accountId',v_uid,'conversationId',a.conversation_id,'clientRequestId',a.client_request_id,
  'previousState',v_previous,'assetId',a.id,'selected',a.selected,'cancelled',true,'authoritative',true);
end $function$;

revoke all on function public.rpc_cancel_media_upload(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_cancel_media_upload(uuid,uuid) to authenticated;
comment on function public.rpc_cancel_media_upload(uuid,uuid) is
  'PKG-046 owner-only cancellation of an unconfirmed Task upload command: a CANCELLED tombstone row for an absent key (refused by the service claim), deselection or the existing removal writer for an admitted one. Never a second upload, a Storage delete or a retention rule.';

-- f. The certified value, in its three places, for the state this transaction now holds.
do $rebind$
declare v_old text; v_new text; v_def text;
begin
  select certified, moved into strict v_old, v_new from pkg046_state;
  if v_new is distinct from private.closure_source_digest_v5() then raise exception 'PKG046_DIGEST_NOT_STABLE'; end if;
  v_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  update private.closure_source_v5 set sha256 = v_new where singleton and sha256 = v_old;
  if not found then raise exception 'PKG046_CERTIFIED_VALUES_DISAGREE'; end if;
  update private.closure_erasure_source_v5 set sha256 = v_new where singleton and sha256 = v_old;
  if not found then raise exception 'PKG046_CERTIFIED_VALUES_DISAGREE'; end if;
  execute replace(v_def, v_old, v_new);
end
$rebind$;

do $post$
declare s record; v_live text; v_ready text; v_claim text; v_read text;
  v_claim_sig text := 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)';
  v_anchor text := $anchor$perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||p_account_id::text||':'||p_client_request_id::text,130));$anchor$;
  v_fence text := $fence$
 if exists(select 1 from private.owned_media_assets x where x.account_id=p_account_id and x.client_request_id=p_client_request_id and x.state='CANCELLED') then raise exception 'MEDIA_COMMAND_CANCELLED' using errcode='55000'; end if;$fence$;
begin
  select * into strict s from pkg046_state;
  -- Bodies: exactly the reviewed predecessor with the one fence / the one predicate; ACLs unchanged.
  select prosrc into strict v_claim from pg_proc where oid = to_regprocedure(v_claim_sig);
  select prosrc into strict v_read from pg_proc where oid = to_regprocedure('public.rpc_read_media_upload(uuid)');
  if v_claim is distinct from replace(s.claim_before, v_anchor, v_anchor || v_fence) or md5(v_claim) is distinct from '4f522b3df65e00f6985e50e66d388bbc' then
    raise exception 'PKG046_BODY_MISMATCH: claim';
  end if;
  if v_read is distinct from replace(s.read_before,
       $a$ where account_id=auth.uid() and client_request_id=p_client_request_id;$a$,
       $b$ where account_id=auth.uid() and client_request_id=p_client_request_id and state<>'CANCELLED';$b$)
     or md5(v_read) is distinct from '36d5647d8e4423c3f75bd13459ff524c' then
    raise exception 'PKG046_BODY_MISMATCH: read';
  end if;
  if current_setting('pkg046.claim_acl', true) is distinct from
       (has_function_privilege('anon', v_claim_sig, 'EXECUTE')::text || has_function_privilege('authenticated', v_claim_sig, 'EXECUTE')::text
        || has_function_privilege('service_role', v_claim_sig, 'EXECUTE')::text)
     or current_setting('pkg046.read_acl', true) is distinct from
       (has_function_privilege('anon', 'public.rpc_read_media_upload(uuid)', 'EXECUTE')::text
        || has_function_privilege('authenticated', 'public.rpc_read_media_upload(uuid)', 'EXECUTE')::text
        || has_function_privilege('service_role', 'public.rpc_read_media_upload(uuid)', 'EXECUTE')::text) then
    raise exception 'PKG046_ACL_CHANGED';
  end if;
  if not has_function_privilege('authenticated', 'public.rpc_cancel_media_upload(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rpc_cancel_media_upload(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.rpc_cancel_media_upload(uuid,uuid)', 'EXECUTE') then
    raise exception 'PKG046_ACL_MISMATCH: cancellation writer';
  end if;
  -- Certificate: three places hold the live value, the readiness function changed only by its constant,
  -- the source is ready and the erasure binding carries the new value.
  v_live := private.closure_source_digest_v5();
  select prosrc into strict v_ready from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure;
  if v_live is distinct from s.moved
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from v_live
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_live
     or position(s.certified in v_ready) > 0
     or (length(v_ready) - length(replace(v_ready, v_live, ''))) <> length(v_live) then
    raise exception 'PKG046_REBIND_INCOMPLETE';
  end if;
  if md5(regexp_replace(v_ready, '[0-9a-f]{64}', '<CERTIFIED>', 'g')) is distinct from s.ready_masked then
    raise exception 'PKG046_READINESS_FUNCTION_CHANGED_BEYOND_THE_CONSTANT';
  end if;
  if private.retention_ai_source_ready() is distinct from true then raise exception 'PKG046_SOURCE_NOT_READY'; end if;
  if private.closure_erasure_binding_v5() is null
     or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from v_live then
    raise exception 'PKG046_ERASURE_BINDING_NOT_READY';
  end if;
  if has_function_privilege('anon', 'private.retention_ai_source_ready()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.retention_ai_source_ready()', 'EXECUTE') then
    raise exception 'PKG046_GRANTS_NOT_EXACT';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
