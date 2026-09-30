-- Chat voice B1 pre-image capture. READ-ONLY: one SELECT. It records, from the state the ONE-statement DEV application starts from, the exact text the revert package has to restore:
-- the complete definition of every function the application rewrites (and of the readiness function whose one certified literal it replaces), the two CHECK constraints it replaces,
-- the retention catalog row it extends and the certified digest. The revert package is GENERATED from this capture and proves, on its own disposable run, that restoring it yields the same state.
select jsonb_build_object(
  'unit', 'CHAT_VOICE_B1_PREIMAGE',
  'certifiedDigest', private.closure_source_digest_v5(),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'signature', s.signature,
      'definition', pg_get_functiondef(p.oid),
      'bodyMd5', md5(replace(p.prosrc, E'\r\n', E'\n')),
      'hasCarriageReturn', position(E'\r' in p.prosrc) > 0) order by s.ord)
    from unnest(array[
      'private.closure_redaction_relations_v5()',
      'private.closure_redaction_scope_v5(text)',
      'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)',
      'private.closure_blockers_v5(uuid)',
      'public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)',
      'private.support_reference_v5(uuid,jsonb)',
      'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)',
      'private.data_export_dataset_catalog()',
      'private.data_export_policy_binding()',
      'private.closure_source_digest_v5()',
      'private.closure_erasure_program_digest_v5()',
      'public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)',
      'public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)',
      'private.retention_ai_source_ready()'
    ]::text[]) with ordinality s(signature, ord)
    join pg_proc p on p.oid = to_regprocedure(s.signature)),
  'constraints', jsonb_build_object(
    'agreement_messages_body_photo_check', (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid = 'public.agreement_messages'::regclass and c.conname = 'agreement_messages_body_photo_check'),
    'closure_action_shape146', (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid = 'private.closure_actions_v5'::regclass and c.conname = 'closure_action_shape146')),
  'mediaObjectsRelations', (select to_jsonb(c.relations) from private.closure_dataset_catalog_v5 c where c.data_class = 'MEDIA_OBJECTS')
) as preimage;
