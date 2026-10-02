CREATE OR REPLACE FUNCTION private.closure_source_digest_v5()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select encode(extensions.digest(convert_to(private.closure_schema_digest_v5_139()||':'||private.closure_erasure_program_digest_v5()||':'||private.agreement_invalidation_surface_v1()||':'||private.agreement_voice_surface_v1()||':'||string_agg(signature||':'||md5(p.prosrc),E'\n' order by signature),'UTF8'),'sha256'),'hex')
 from unnest(array['private.capture_agreement_media_v5(uuid,integer,boolean)','private.capture_case_media_v5(text,uuid,bigint,uuid,uuid,uuid,uuid)',
 'private.media_owner_protected_v5(uuid)','private.media_evidence_key_v5(uuid)','private.closure_blockers_v5(uuid)','private.resolve_media_snapshot_v5(uuid,jsonb)',
 'private.support_auth_v5(uuid)','private.support_operator_key_v5()','private.support_command_key_v5(uuid,uuid)',
 'private.support_safe_exit_v5(uuid,uuid)','private.support_operator_revision_v5(uuid)','private.support_immutable_v5()',
 'private.support_case_guard_v5()','private.support_command_document_v5(uuid,uuid)',
 'public.rpc_support_read_command_v5(uuid,uuid)','public.rpc_support_cancel_command_v5(uuid,uuid)',
 'private.support_reference_v5(uuid,jsonb)','private.support_capture_media_v5(uuid,integer,jsonb)',
 'private.support_safety_case_v5(private.safety_reports,boolean)','private.support_safety_capture_v5()','private.support_safety_closure_v5()',
 'private.support_event_document_v5(private.support_events_v5)','private.support_decision_document_v5(private.support_decisions_v5)',
 'private.support_allowed_actions_v5(private.support_cases_v5,uuid,integer)',
 'public.rpc_support_set_operator_service_v5(uuid,boolean,integer,uuid)','public.rpc_support_submit_v5(uuid,uuid,text,uuid,integer,text)',
 'public.rpc_support_capabilities_v5(uuid)','public.rpc_support_inbox_v5(uuid,text,text)',
 'public.rpc_support_detail_v5(uuid,uuid,text)','public.rpc_support_mark_read_v5(uuid,uuid,text)',
 'public.rpc_support_find_context_v5(uuid,text,uuid)','public.rpc_support_media_service_v5(uuid,uuid,uuid,uuid)',
 'public.rpc_closure_api_guard()',
 'private.agreement_photo_key_v5(uuid)','private.agreement_photo_context_v5(uuid,uuid,integer,boolean)',
 'private.agreement_photo_document_v5(private.agreement_photo_uploads_v5)','private.agreement_photo_transfer_v5(private.agreement_photo_uploads_v5)',
 'private.agreement_photo_message_guard_v5()','private.agreement_photo_link_guard_v5()','private.agreement_photo_asset_guard_v5()','private.agreement_photo_storage_guard_v5()',
 'public.rpc_agreement_photo_upload_service_v5(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_photo_read_service_v5(uuid,uuid,uuid,uuid,uuid)',
 'public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])','public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])','private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)','private.closure_redaction_relations_v5()','private.closure_erasure_media_protected_v5(uuid,text)','private.closure_erasure_agreement_protected_v5(uuid)','private.closure_erasure_scope_author_v5(uuid,integer)','private.closure_erasure_exceptions_v5(uuid)','private.closure_redaction_scope_v5(text)','private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','private.closure_erasure_lock_v5(uuid)','private.closure_erasure_hard_blockers_v5(uuid)','private.closure_erasure_binding_v5()','private.closure_erasure_assert_current_v5(private.closure_executions_v5)','private.closure_erasure_progress_v5(private.closure_executions_v5)','private.closure_erasure_refresh_steps_v5(private.closure_executions_v5)','private.closure_auth_dispatched_v5(uuid)','private.closure_support_source_fence_v5(uuid,text,uuid)','public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid)','public.rpc_review_account_closure_execution(uuid)','public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)','public.rpc_claim_account_closure_action_service(uuid,uuid)','public.rpc_dispatch_account_closure_action_service(uuid,uuid,uuid,uuid)','public.rpc_complete_account_closure_action_service(uuid,uuid,uuid,uuid,text)','public.rpc_finalize_account_closure_service(uuid,uuid)','public.rpc_read_account_closure_execution(uuid,uuid)','public.rpc_list_account_closure_work_service(integer)','public.handle_uskoci_auth_user_updated()','private.closure_assert_current_v5(private.closure_executions_v5)',
 'public.rpc_agreement_invalidation_visible_v1(uuid)','private.agreement_message_invalidate_v1()',
 'private.agreement_invalidation_cleanup_v1()','private.agreement_invalidation_surface_v1()','private.agreement_voice_key_v1(uuid)','private.agreement_voice_context_v1(uuid,uuid,integer,boolean)','private.agreement_voice_document_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_message_guard_v1()','private.agreement_voice_link_guard_v1()','private.agreement_voice_asset_guard_v1()','private.agreement_voice_storage_guard_v1()','public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)','public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)','private.agreement_voice_surface_v1()']) signature
 join pg_proc p on p.oid=to_regprocedure(signature) having count(*)=88
$function$
