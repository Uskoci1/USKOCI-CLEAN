-- Chat voice B1-b SOURCE CANDIDATE. NOT RUN / NOT APPLIED. Plan: docs/implementation/product-v1-closure-20260926/finalization-20260927/VOICE_B1_B2_PLAN_20260930.md
-- Runs AFTER chat_voice_b1a_feature_chain.sql in the same atomic application. It integrates the voice message into account closure, export, retention and support:
--   * the erasure program: the upload table joins the ordered redaction roster, its exact owner scope and a DELETE plan that refuses while a transfer is in flight or an object
--     still exists; an own VOICE message is redacted like any own message (placeholder body, no voice asset);
--   * the closure blockers and the start planner: the new private bucket is an allowed owned bucket, a DISPATCHING voice upload blocks the closure like a photo one, and every
--     tracked voice object becomes a STORAGE_DELETE action (the SQL CHECK on action shapes admits the bucket);
--   * the retention catalog: the upload table is part of MEDIA_OBJECTS;
--   * the export: a new dataset ownAgreementVoice (metadata only, never bytes), one new field on ownAgreementMessages, projection version OWN_ACCOUNT_V5_9, 52 datasets;
--   * support: a voice message referenced in a report carries a fixed label, never an empty body and never audio;
--   * the certificate: a surface helper binds the bucket row and its storage policies, the 12 new functions join BOTH rosters, and the certificate is UNCERTIFIED after this file
--     (readiness false, binding null) until the exact three-place re-bind. This file never moves the certificate and never reaches DEV on its own.
-- Every rewritten function is changed by ONE exact anchor replace on its current definition (each anchor must occur exactly once) after its predecessor body is pinned.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path = pg_catalog;

create temporary table voice_b1b_before(digest text, ready boolean) on commit drop;
do $pre$
declare pin record; actual text; bad text[] := '{}';
begin
  if to_regprocedure('private.agreement_voice_surface_v1()') is not null then
    raise exception 'VOICE_B1B_ALREADY_APPLIED' using errcode = '55000';
  end if;
  if to_regclass('private.agreement_voice_uploads_v1') is null
     or not exists(select 1 from pg_attribute where attrelid = 'public.agreement_messages'::regclass and attname = 'voice_asset_id' and not attisdropped)
     or to_regprocedure('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)') is null
     or to_regprocedure('private.agreement_voice_storage_guard_v1()') is null
     or not exists(select 1 from storage.buckets where id = 'agreement-voice') then
    raise exception 'VOICE_B1B_B1A_MISSING' using errcode = '55000';
  end if;
  if exists(select 1 from private.closure_executions_v5 where state = 'EXECUTING') then
    raise exception 'VOICE_B1B_CLOSURE_IN_FLIGHT' using errcode = '55000';
  end if;
  -- Each predecessor body is pinned (every mismatch is listed at once). The two functions that the B24 part 2 package rewrote (a conflict code only, at other sites than the
  -- anchors below) also accept their pre-B24 body, so the disposable chain, which does not replay B24, runs the very same bytes; the DEV application pins the DEV body exactly.
  for pin in select * from (values
    ('private.closure_redaction_relations_v5()', 'c6d687219096c03371560cabb961cb0e', null::text),
    ('private.closure_redaction_scope_v5(text)', '3197a4c47582823d4474027bc49b4f84', null),
    ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)', '0779e304e719774679d8ffb2d7c67fd9', null),
    ('private.closure_blockers_v5(uuid)', 'dc78d910fde458c18e25c732888fa93a', null),
    ('public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)', '4e24973f86127de890d4cb77ab1b6e14', 'c26b69083508cdaf08fb216845914921'),
    ('private.support_reference_v5(uuid,jsonb)', '907b383f500a91d3cf436448b1146295', 'cdc5890d7481b454f4eb5b63e5c0d5a8'),
    ('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', 'b3c4b64a4c3afc98bd7a9aa12314bea5', null),
    ('private.data_export_dataset_catalog()', 'c3d3a109d8e765ae1ad78910c320248d', null),
    ('private.data_export_policy_binding()', '2dbe3d1f343c37c5b3d722c97d9bcb70', null),
    ('private.closure_source_digest_v5()', 'd67d37e2ebc5d9f85448693c0772f663', null),
    ('private.closure_erasure_program_digest_v5()', '3ec8d244730415d3a047312366672375', null)
  ) p(signature, body_md5, alternative_md5) loop
    actual := (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = to_regprocedure(pin.signature));
    if actual is distinct from pin.body_md5 and actual is distinct from pin.alternative_md5 then
      bad := array_append(bad, pin.signature || '=' || coalesce(actual, 'MISSING'));
    end if;
  end loop;
  if cardinality(bad) > 0 then
    raise exception 'VOICE_B1B_PREDECESSOR_DRIFT: %', array_to_string(bad, ' ') using errcode = '55000';
  end if;
  if (select array_agg(pg_get_constraintdef(oid)) from pg_constraint where conrelid = 'private.closure_actions_v5'::regclass and conname = 'closure_action_shape146')
     is distinct from array[$c$CHECK ((((kind = 'STORAGE_DELETE'::text) AND (bucket = ANY (ARRAY['profile-media'::text, 'data-export-artifacts'::text])) AND (object_path IS NOT NULL)) OR ((kind = ANY (ARRAY['RELATIONAL_REDACT'::text, 'AUTH_IDENTITY_ERASE'::text])) AND (bucket IS NULL) AND (object_path IS NULL))))$c$]::text[] then
    raise exception 'VOICE_B1B_PREDECESSOR_DRIFT: closure_action_shape146' using errcode = '55000';
  end if;
  if (select relations from private.closure_dataset_catalog_v5 where data_class = 'MEDIA_OBJECTS')
     is distinct from array['private.owned_media_assets','private.agreement_media_snapshots_v5','private.media_evidence_refs_v5','private.media_evidence_gaps_v5','private.agreement_photo_uploads_v5']::text[] then
    raise exception 'VOICE_B1B_PREDECESSOR_DRIFT: MEDIA_OBJECTS catalog' using errcode = '55000';
  end if;
  insert into voice_b1b_before values (private.closure_source_digest_v5(), private.retention_ai_source_ready());
end
$pre$;

-- 1. The erasure program: ordered relation, exact owner scope, DELETE plan for the upload table, and the own-message redaction carries the voice asset.
do $erasure$
declare d text; anchor text;
begin
  d := pg_get_functiondef('private.closure_redaction_relations_v5()'::regprocedure);
  anchor := $a$'private.owned_media_assets','private.agreement_photo_uploads_v5',$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_RELATIONS_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$'private.owned_media_assets','private.agreement_photo_uploads_v5','private.agreement_voice_uploads_v1',$a$);

  d := pg_get_functiondef('private.closure_redaction_scope_v5(text)'::regprocedure);
  anchor := $a$'private.owned_media_assets','private.agreement_photo_uploads_v5',$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_SCOPE_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$'private.owned_media_assets','private.agreement_photo_uploads_v5','private.agreement_voice_uploads_v1',$a$);

  d := pg_get_functiondef('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure);
  anchor := $a$if r in('private.owned_media_assets','private.agreement_photo_uploads_v5') then$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_PATCH_UPLOAD_ANCHOR_DRIFT'; end if;
  -- A voice upload is never evidence (Support cannot capture one): it goes once its object is gone, and never while a transfer is in flight.
  d := replace(d, anchor, $a$if r='private.agreement_voice_uploads_v1' then
  if t->>'dispatch_state'='DISPATCHING' then raise exception 'ERASURE_PRODUCER_UNSETTLED';end if;
  if exists(select 1 from storage.objects where bucket_id='agreement-voice' and name=t->>'storage_path') then raise exception 'ERASURE_STORAGE_NOT_CLEAN';end if;
  return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 end if;
 $a$ || anchor);
  anchor := $a$p:=jsonb_build_object('body','Sadržaj uklonjen pri zatvaranju naloga.','photo_asset_ids','[]'::jsonb);$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_PATCH_MESSAGE_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$p:=jsonb_build_object('body','Sadržaj uklonjen pri zatvaranju naloga.','photo_asset_ids','[]'::jsonb,'voice_asset_id',null);$a$);
end
$erasure$;

-- 2. The blockers and the start planner: the new bucket is an owned bucket, an in-flight voice transfer blocks, every tracked voice object becomes a STORAGE_DELETE action.
do $closure$
declare d text; anchor text;
begin
  d := pg_get_functiondef('private.closure_blockers_v5(uuid)'::regprocedure);
  anchor := $a$bucket_id not in('profile-media','data-export-artifacts')$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_BLOCKERS_BUCKET_ANCHOR_DRIFT'; end if;
  d := replace(d, anchor, $a$bucket_id not in('profile-media','data-export-artifacts','agreement-voice')$a$);
  anchor := $a$if exists(select 1 from private.agreement_photo_uploads_v5 where account_id=a and dispatch_state='DISPATCHING') then$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_BLOCKERS_PENDING_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$if exists(select 1 from private.agreement_photo_uploads_v5 where account_id=a and dispatch_state='DISPATCHING')
 or exists(select 1 from private.agreement_voice_uploads_v1 where account_id=a and dispatch_state='DISPATCHING') then$a$);

  d := pg_get_functiondef('public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)'::regprocedure);
  anchor := $a$union select 'data-export-artifacts',object_path from private.data_export_artifacts where account_id=u) x$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_START_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$union select 'agreement-voice',storage_path from private.agreement_voice_uploads_v1 where account_id=u and storage_path is not null
  union select 'data-export-artifacts',object_path from private.data_export_artifacts where account_id=u) x$a$);
end
$closure$;

alter table private.closure_actions_v5 drop constraint closure_action_shape146;
alter table private.closure_actions_v5 add constraint closure_action_shape146 check(
  (kind = 'STORAGE_DELETE' and bucket in ('profile-media', 'data-export-artifacts', 'agreement-voice') and object_path is not null)
  or (kind in ('RELATIONAL_REDACT', 'AUTH_IDENTITY_ERASE') and bucket is null and object_path is null));

-- 3. The retention catalog: the upload table is a media object like the photo one.
update private.closure_dataset_catalog_v5 set relations = relations || array['private.agreement_voice_uploads_v1'] where data_class = 'MEDIA_OBJECTS';

-- 4. The export: one new dataset (metadata only), one new field, projection version 9, 52 datasets. An export contains a field only when the active policy lists it.
do $export$
declare catalog jsonb; d text; anchor text;
begin
  catalog := private.data_export_dataset_catalog();
  if jsonb_array_length(catalog) <> 51 then raise exception 'VOICE_B1B_EXPORT_PREDECESSOR_DRIFT'; end if;
  catalog := (select jsonb_agg(case when e->>'key' = 'ownAgreementMessages' then jsonb_set(e, '{fields}', (e->'fields') || '"voiceAssetId"'::jsonb) else e end order by ord)
    from jsonb_array_elements(catalog) with ordinality t(e, ord));
  catalog := catalog || '[{"key":"ownAgreementVoice","dataClass":"MEDIA_OBJECTS","fields":["id","agreementId","agreementVersion","messageId","state","durationMs","byteSize","createdAt","cancelledAt","bytesIncluded"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"}]'::jsonb;
  execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$', catalog::text);

  d := pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
  anchor := $a$'agreementVersion',t.agreement_version,'assetIds',to_jsonb(t.photo_asset_ids)) as value from public.agreement_messages t$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_EXPORT_MESSAGES_ANCHOR_DRIFT'; end if;
  d := replace(d, anchor, $a$'agreementVersion',t.agreement_version,'assetIds',to_jsonb(t.photo_asset_ids),'voiceAssetId',t.voice_asset_id) as value from public.agreement_messages t$a$);
  anchor := $a$from private.agreement_photo_uploads_v5 t where t.account_id=p_account_id
union all
select 'ownErasureSteps'$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_EXPORT_ROWS_ANCHOR_DRIFT'; end if;
  d := replace(d, anchor, $a$from private.agreement_photo_uploads_v5 t where t.account_id=p_account_id
union all
select 'ownAgreementVoice',jsonb_build_object('id',t.id,'agreementId',t.agreement_id,'agreementVersion',t.agreement_version,'messageId',t.attached_message_id,'state',t.state,
 'durationMs',t.duration_ms,'byteSize',t.byte_size,'createdAt',t.created_at,'cancelledAt',t.cancelled_at,'bytesIncluded',false) from private.agreement_voice_uploads_v1 t where t.account_id=p_account_id
union all
select 'ownErasureSteps'$a$);
  anchor := $a$'OWN_ACCOUNT_V5_8'$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_EXPORT_VERSION_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$'OWN_ACCOUNT_V5_9'$a$);

  d := pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
  if length(d) - length(replace(d, $a$'OWN_ACCOUNT_V5_8'$a$, '')) <> length($a$'OWN_ACCOUNT_V5_8'$a$)
     or length(d) - length(replace(d, $a$jsonb_array_length(m->'datasets')<>51$a$, '')) <> length($a$jsonb_array_length(m->'datasets')<>51$a$)
     or length(d) - length(replace(d, $a$in('mediaMetadata','ownedMediaAssets','ownAgreementPhotos','ownSupportEvidence')$a$, '')) <> length($a$in('mediaMetadata','ownedMediaAssets','ownAgreementPhotos','ownSupportEvidence')$a$) then
    raise exception 'VOICE_B1B_EXPORT_BINDING_ANCHOR_DRIFT';
  end if;
  d := replace(d, $a$'OWN_ACCOUNT_V5_8'$a$, $a$'OWN_ACCOUNT_V5_9'$a$);
  d := replace(d, $a$jsonb_array_length(m->'datasets')<>51$a$, $a$jsonb_array_length(m->'datasets')<>52$a$);
  execute replace(d, $a$in('mediaMetadata','ownedMediaAssets','ownAgreementPhotos','ownSupportEvidence')$a$, $a$in('mediaMetadata','ownedMediaAssets','ownAgreementPhotos','ownAgreementVoice','ownSupportEvidence')$a$);
end
$export$;

-- 5. Support: a reported voice message keeps its exact identity and revision, carries a fixed label instead of an empty body, and never audio.
do $support$
declare d text; anchor text;
begin
  d := pg_get_functiondef('private.support_reference_v5(uuid,jsonb)'::regprocedure);
  anchor := $a$content:=jsonb_build_object('agreementId',m.agreement_id,'body',m.body,'createdAt',m.created_at,'mine',m.sender_account_id=a);$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_SUPPORT_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$content:=jsonb_build_object('agreementId',m.agreement_id,'body',case when m.voice_asset_id is not null then 'Glasovna poruka (zvuk nije deo prijave).' else m.body end,'createdAt',m.created_at,'mine',m.sender_account_id=a);$a$);
end
$support$;

-- 6. The certificate surface: the bucket row and the storage policies that keep it private are not covered by the schema or program digests, so one helper binds them.
create function private.agreement_voice_surface_v1() returns text language sql stable security definer set search_path = pg_catalog as $surface$
select encode(extensions.digest(convert_to(jsonb_build_object(
 'bucket',(select jsonb_build_object('id',b.id,'name',b.name,'public',b.public,'fileSizeLimit',b.file_size_limit,'allowedMimeTypes',b.allowed_mime_types)
   from storage.buckets b where b.id='agreement-voice'),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.policyname,'permissive',p.permissive,'roles',p.roles,'cmd',p.cmd,'qual',p.qual,'withCheck',p.with_check)
   order by p.policyname),'[]'::jsonb) from pg_policies p where p.schemaname='storage' and p.tablename='objects'
   and (p.permissive='RESTRICTIVE' or coalesce(p.qual,'')||coalesce(p.with_check,'') like '%agreement-voice%')),
 'rowSecurity',(select jsonb_build_array(c.relrowsecurity,c.relforcerowsecurity) from pg_class c where c.oid='storage.objects'::regclass)
 )::text,'UTF8'),'sha256'),'hex')
$surface$;
revoke all on function private.agreement_voice_surface_v1() from public, anon, authenticated, service_role;

do $roster$
declare d text; anchor text; extra text[];
begin
  extra := array['private.agreement_voice_key_v1(uuid)','private.agreement_voice_context_v1(uuid,uuid,integer,boolean)',
    'private.agreement_voice_document_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1)',
    'private.agreement_voice_message_guard_v1()','private.agreement_voice_link_guard_v1()','private.agreement_voice_asset_guard_v1()','private.agreement_voice_storage_guard_v1()',
    'public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)',
    'public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)','private.agreement_voice_surface_v1()'];
  if cardinality(extra) <> 12 or exists(select 1 from unnest(extra) x where to_regprocedure(x) is null) then raise exception 'VOICE_B1B_ROSTER_FUNCTION_MISSING'; end if;

  d := pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
  anchor := $a$private.agreement_invalidation_surface_v1()||':'||string_agg($a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_SOURCE_SURFACE_ANCHOR_DRIFT'; end if;
  d := replace(d, anchor, $a$private.agreement_invalidation_surface_v1()||':'||private.agreement_voice_surface_v1()||':'||string_agg($a$);
  anchor := $a$'private.agreement_invalidation_surface_v1()']) signature$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) or strpos(d, 'having count(*)=76') = 0 then raise exception 'VOICE_B1B_SOURCE_ROSTER_ANCHOR_DRIFT'; end if;
  d := replace(d, anchor, $a$'private.agreement_invalidation_surface_v1()',$a$ || (select string_agg(quote_literal(x), ',' order by ord) from unnest(extra) with ordinality t(x, ord)) || $a$]) signature$a$);
  execute replace(d, 'having count(*)=76', 'having count(*)=' || (76 + cardinality(extra))::text);

  d := pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure);
  anchor := $a$,private.closure_source_digest_v5(),private.closure_erasure_program_digest_v5()}'::text[]) x)$a$;
  if length(d) - length(replace(d, anchor, '')) <> length(anchor) then raise exception 'VOICE_B1B_PROGRAM_ROSTER_ANCHOR_DRIFT'; end if;
  execute replace(d, anchor, $a$,private.closure_source_digest_v5(),private.closure_erasure_program_digest_v5(),$a$
    || (select string_agg(case when x like '%,%' then '"' || x || '"' else x end, ',' order by ord) from unnest(extra) with ordinality t(x, ord)) || $a$}'::text[]) x)$a$);
end
$roster$;

do $post$
declare s text; b record;
begin
  select * into b from voice_b1b_before;
  s := private.closure_source_digest_v5();
  if s is null or s = b.digest then raise exception 'VOICE_B1B_DIGEST_DID_NOT_MOVE' using errcode = '55000'; end if;
  if private.retention_ai_source_ready() is distinct from false or private.closure_erasure_binding_v5() is not null then
    raise exception 'VOICE_B1B_UNCERTIFIED_STATE_NOT_CLOSED' using errcode = '55000';
  end if;
  if has_function_privilege('anon', 'private.agreement_voice_surface_v1()', 'EXECUTE') or has_function_privilege('authenticated', 'private.agreement_voice_surface_v1()', 'EXECUTE')
     or has_function_privilege('service_role', 'private.agreement_voice_surface_v1()', 'EXECUTE') then
    raise exception 'VOICE_B1B_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
  if not ('private.agreement_voice_uploads_v1' = any(private.closure_redaction_relations_v5()))
     or private.closure_redaction_scope_v5('private.agreement_voice_uploads_v1') is distinct from 't.account_id=$1'
     or not exists(select 1 from pg_constraint where conrelid = 'private.closure_actions_v5'::regclass and conname = 'closure_action_shape146' and convalidated
        and pg_get_constraintdef(oid) like '%agreement-voice%')
     or jsonb_array_length(private.data_export_dataset_catalog()) <> 52
     or not exists(select 1 from jsonb_array_elements(private.data_export_dataset_catalog()) e where e->>'key' = 'ownAgreementVoice')
     or (select relations from private.closure_dataset_catalog_v5 where data_class = 'MEDIA_OBJECTS') is distinct from
        array['private.owned_media_assets','private.agreement_media_snapshots_v5','private.media_evidence_refs_v5','private.media_evidence_gaps_v5','private.agreement_photo_uploads_v5','private.agreement_voice_uploads_v1']::text[] then
    raise exception 'VOICE_B1B_POSTCONDITION' using errcode = '55000';
  end if;
end
$post$;
commit;
