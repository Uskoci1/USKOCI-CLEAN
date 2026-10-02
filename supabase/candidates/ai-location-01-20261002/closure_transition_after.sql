
-- Extend only the two explicit function inventories: 9 new helpers/RPCs and 2 changed legacy functions.
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
 'private.agreement_invalidation_cleanup_v1()','private.agreement_invalidation_surface_v1()','private.agreement_voice_key_v1(uuid)','private.agreement_voice_context_v1(uuid,uuid,integer,boolean)','private.agreement_voice_document_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_message_guard_v1()','private.agreement_voice_link_guard_v1()','private.agreement_voice_asset_guard_v1()','private.agreement_voice_storage_guard_v1()','public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)','public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)','private.agreement_voice_surface_v1()','private.ai_location_context_valid(jsonb)','private.ai_location_request_hash(uuid,text,jsonb)','private.ai_location_review_matches(uuid,jsonb)','private.ai_location_turn_document(uuid,uuid,uuid)','private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)','public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb)','public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)','public.rpc_ai_read_need_location_turn_v1(uuid,uuid)','public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid)','public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)','private.ai_need_turn_status(uuid,uuid,uuid)']) signature
 join pg_proc p on p.oid=to_regprocedure(signature) having count(*)=99
$function$;
CREATE OR REPLACE FUNCTION private.closure_erasure_program_digest_v5()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select encode(extensions.digest(convert_to(jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'source',md5(p.prosrc),'owner',p.proowner,'acl',p.proacl::text,'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'language',p.prolang,'config',p.proconfig,'args',p.proargtypes::text,'result',p.prorettype) order by p.oid::regprocedure::text)
 from pg_proc p where p.oid in(select to_regprocedure(x) from unnest('{"private.capture_agreement_media_v5(uuid,integer,boolean)","private.capture_case_media_v5(text,uuid,bigint,uuid,uuid,uuid,uuid)",private.media_owner_protected_v5(uuid),private.media_evidence_key_v5(uuid),private.closure_blockers_v5(uuid),"private.resolve_media_snapshot_v5(uuid,jsonb)",private.support_auth_v5(uuid),private.support_operator_key_v5(),"private.support_command_key_v5(uuid,uuid)","private.support_safe_exit_v5(uuid,uuid)",private.support_operator_revision_v5(uuid),private.support_immutable_v5(),private.support_case_guard_v5(),"private.support_command_document_v5(uuid,uuid)","public.rpc_support_read_command_v5(uuid,uuid)","public.rpc_support_cancel_command_v5(uuid,uuid)","private.support_reference_v5(uuid,jsonb)","private.support_capture_media_v5(uuid,integer,jsonb)","private.support_safety_case_v5(private.safety_reports,boolean)",private.support_safety_capture_v5(),private.support_safety_closure_v5(),private.support_event_document_v5(private.support_events_v5),private.support_decision_document_v5(private.support_decisions_v5),"private.support_allowed_actions_v5(private.support_cases_v5,uuid,integer)","public.rpc_support_set_operator_service_v5(uuid,boolean,integer,uuid)","public.rpc_support_submit_v5(uuid,uuid,text,uuid,integer,text)",public.rpc_support_capabilities_v5(uuid),"public.rpc_support_inbox_v5(uuid,text,text)","public.rpc_support_detail_v5(uuid,uuid,text)","public.rpc_support_mark_read_v5(uuid,uuid,text)","public.rpc_support_find_context_v5(uuid,text,uuid)","public.rpc_support_media_service_v5(uuid,uuid,uuid,uuid)",public.rpc_closure_api_guard(),private.agreement_photo_key_v5(uuid),"private.agreement_photo_context_v5(uuid,uuid,integer,boolean)",private.agreement_photo_document_v5(private.agreement_photo_uploads_v5),private.agreement_photo_transfer_v5(private.agreement_photo_uploads_v5),private.agreement_photo_message_guard_v5(),private.agreement_photo_link_guard_v5(),private.agreement_photo_asset_guard_v5(),private.agreement_photo_storage_guard_v5(),"public.rpc_agreement_photo_upload_service_v5(uuid,uuid,text,uuid,integer,uuid,jsonb)","public.rpc_agreement_photo_read_service_v5(uuid,uuid,uuid,uuid,uuid)","public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])","public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])","private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)",private.closure_redaction_relations_v5(),"private.closure_erasure_media_protected_v5(uuid,text)",private.closure_erasure_agreement_protected_v5(uuid),"private.closure_erasure_scope_author_v5(uuid,integer)",private.closure_erasure_exceptions_v5(uuid),private.closure_redaction_scope_v5(text),"private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)",private.closure_erasure_lock_v5(uuid),private.closure_erasure_hard_blockers_v5(uuid),private.closure_erasure_binding_v5(),private.closure_erasure_assert_current_v5(private.closure_executions_v5),private.closure_erasure_progress_v5(private.closure_executions_v5),private.closure_erasure_refresh_steps_v5(private.closure_executions_v5),private.closure_auth_dispatched_v5(uuid),"private.closure_support_source_fence_v5(uuid,text,uuid)","public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid)",public.rpc_review_account_closure_execution(uuid),"public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)","public.rpc_claim_account_closure_action_service(uuid,uuid)","public.rpc_dispatch_account_closure_action_service(uuid,uuid,uuid,uuid)","public.rpc_complete_account_closure_action_service(uuid,uuid,uuid,uuid,text)","public.rpc_finalize_account_closure_service(uuid,uuid)","public.rpc_read_account_closure_execution(uuid,uuid)",public.rpc_list_account_closure_work_service(integer),public.handle_uskoci_auth_user_updated(),private.closure_assert_current_v5(private.closure_executions_v5),private.closure_source_digest_v5(),private.closure_erasure_program_digest_v5(),private.agreement_voice_key_v1(uuid),"private.agreement_voice_context_v1(uuid,uuid,integer,boolean)",private.agreement_voice_document_v1(private.agreement_voice_uploads_v1),private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1),private.agreement_voice_message_guard_v1(),private.agreement_voice_link_guard_v1(),private.agreement_voice_asset_guard_v1(),private.agreement_voice_storage_guard_v1(),"public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)","public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)","public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)",private.agreement_voice_surface_v1(),private.ai_location_context_valid(jsonb),"private.ai_location_request_hash(uuid,text,jsonb)","private.ai_location_review_matches(uuid,jsonb)","private.ai_location_turn_document(uuid,uuid,uuid)","private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)","public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb)","public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)","public.rpc_ai_read_need_location_turn_v1(uuid,uuid)","public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid)","public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)","private.ai_need_turn_status(uuid,uuid,uuid)"}'::text[]) x)
 or p.oid in(select tgfoid from pg_trigger where not tgisinternal and tgrelid in(select unnest(private.closure_redaction_relations_v5())::regclass))),
 'tables',(select jsonb_agg(jsonb_build_array(c.oid::regclass::text,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by c.oid::regclass::text)
 from pg_class c where c.relnamespace in('private'::regnamespace,'public'::regnamespace) and c.relkind in('r','p')),
 'triggerState',(select jsonb_agg(jsonb_build_array(t.tgrelid::regclass::text,t.tgname,t.tgenabled) order by t.tgrelid::regclass::text,t.tgname)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal
 and (c.relnamespace in('private'::regnamespace,'public'::regnamespace) or t.tgrelid='storage.objects'::regclass))
 )::text,'UTF8'),'sha256'),'hex')
 $function$;
do $cert_rebind$
declare before_row record;new_sha text;new_source text;new_program text;ready text;
begin
 select * into strict before_row from location_ai_cert_before;
 if (select proacl::text from pg_proc where oid='public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)'::regprocedure) is distinct from before_row.old_claim_acl
 or (select proacl::text from pg_proc where oid='private.ai_need_turn_status(uuid,uuid,uuid)'::regprocedure) is distinct from before_row.old_status_acl
 then raise exception 'LOCATION_AI_LEGACY_ACL_DRIFT' using errcode='PT409';end if;
 new_sha:=private.closure_source_digest_v5();
 if new_sha is null or new_sha=before_row.certified then raise exception 'LOCATION_AI_DIGEST_NOT_CHANGED' using errcode='PT409';end if;
 new_source:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
 new_program:=pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure);
 -- Transaction-local inverse: removing ONLY the new roster entries must restore
 -- the exact old certified source/program. No broader runtime access is granted.
 execute before_row.source_def;execute before_row.program_def;
 if private.closure_source_digest_v5() is distinct from before_row.certified
 or private.closure_erasure_program_digest_v5() is distinct from before_row.program
 then raise exception 'LOCATION_AI_UNREVIEWED_CERT_DELTA' using errcode='PT409';end if;
 execute new_source;execute new_program;
 if private.closure_source_digest_v5() is distinct from new_sha then raise exception 'LOCATION_AI_DIGEST_UNSTABLE' using errcode='PT409';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton and sha256=before_row.certified;
 if not found then raise exception 'LOCATION_AI_CERT_CAS_FAILED' using errcode='PT409';end if;
 update private.closure_erasure_source_v5 set sha256=new_sha where singleton and sha256=before_row.certified;
 if not found then raise exception 'LOCATION_AI_CERT_CAS_FAILED' using errcode='PT409';end if;
 execute replace(before_row.ready_def,before_row.certified,new_sha);
 select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if md5(replace(ready,new_sha,'<CERTIFIED>')) is distinct from before_row.ready_masked
 or private.closure_source_digest_v5() is distinct from new_sha
 or (select sha256 from private.closure_source_v5 where singleton) is distinct from new_sha
 or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from new_sha
 or private.retention_ai_source_ready() is distinct from true
 or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from new_sha
 or private.closure_erasure_binding_v5()->'legalPolicyAttested' is distinct from 'false'::jsonb
 then raise exception 'LOCATION_AI_REBIND_INCOMPLETE' using errcode='PT409';end if;
end $cert_rebind$;
