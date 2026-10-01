# EX-06 S03 - second section: the extension for public.rpc_begin_push_send

**Label: MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (12 pins; helper functions, config rows and triggers not pinned)**

Read AFTER the non-blocking extension stages. The corpus result of the first section was produced BEFORE them, on the ex04d-proven chain.

## Extension stages (from the workflow)
- 19-ex06-s03-proof exit=0
- 20-a1-preparation exit=0
- 21-b3a exit=0
- 22-b3b exit=0
- 23-p0 exit=0
- 24-p4-resolver exit=0
- 25-p5 exit=0
- 26-b3c-application exit=0
- 27-p4-push-transport exit=0
- 28-pkg051a-price-list exit=0
- 29-b24-part1-relaxed exit=0

## The 12th pin
| function | role | S01 pin | chain | verdict | explanation |
| --- | --- | --- | --- | --- | --- |
| public.rpc_begin_push_send | PUSH | fc76b3444e312e589255cccb2b0749c0 | fc76b3444e312e589255cccb2b0749c0 | EQUAL |  |

## Objects the extension changed (catalog fingerprint before / after)
Before sha256 f26d7f02205f8dbe02c38a17ead77c77e2cd4d7d04366c8f2a646e32679a8cd9 (496 functions, 109 triggers); after sha256 67ad83fd68f4b48e6a9ff3df37aeb68738f03e69136c977559be2f6ac11e1af6 (509 functions, 111 triggers).
Added 15, removed 0, changed 60.
- ADDED function:private.agreement_invalidation_cleanup_v1()
- ADDED function:private.agreement_invalidation_surface_v1()
- ADDED function:private.agreement_message_invalidate_v1()
- ADDED function:private.platform_payments_enabled()
- ADDED function:private.platform_price_add_version(p_product text, p_expected_latest_version integer, p_amount_minor bigint, p_payer_role text, p_unit_basis text, p_effective_at timestamp with time zone, p_currency text)
- ADDED function:private.platform_price_canonical(p_product text, p_version integer, p_amount_minor bigint, p_currency text, p_payer_role text, p_unit_basis text, p_effective_at timestamp with time zone, p_recorded_at timestamp with time zone, p_previous_sha256 text)
- ADDED function:private.platform_price_list_at(p_at timestamp with time zone)
- ADDED function:private.platform_price_versions()
- ADDED function:public.rpc_agreement_invalidation_visible_v1(p_agreement_id uuid)
- ADDED function:public.rpc_mark_displayed_agreement_messages_v1(p_expected_user_id uuid, p_agreement_id uuid, p_message_ids uuid[])
- ADDED function:public.rpc_read_agreement_message_window_v1(p_expected_user_id uuid, p_agreement_id uuid, p_target_message_id uuid, p_before_count integer, p_after_count integer)
- ADDED function:public.rpc_read_agreement_messages_page_v1(p_expected_user_id uuid, p_agreement_id uuid, p_limit integer, p_before_created_at timestamp with time zone, p_before_id uuid)
- ADDED function:public.rpc_resolve_activity_message_v1(p_expected_user_id uuid, p_event_id uuid)
- ADDED trigger:public.agreement_messages.chat_b3c_invalidation_after_message
- ADDED trigger:public.agreements.chat_b3c_invalidation_lifecycle
- CHANGED function:private.closure_redaction_patch_v5(r text, t jsonb, a uuid, g uuid): e9c5b731 -> 0779e304
- CHANGED function:private.closure_redaction_relations_v5(): 5e245407 -> c6d68721
- CHANGED function:private.closure_redaction_scope_v5(r text): 495cfafd -> 3197a4c4
- CHANGED function:private.closure_source_digest_v5(): 7840a7e7 -> d67d37e2
- CHANGED function:private.execute_retention_job(p_job_id uuid, p_attempt_id uuid): 1125b86e -> 2842dd02
- CHANGED function:private.need_publication_context(p_need_id uuid, p_expected_revision integer, p_owner uuid): d3904a6c -> 47c471ed
- CHANGED function:private.retention_ai_source_ready(): 2357dbbb -> f2068807
- CHANGED function:private.worker_ai_patch(base jsonb, patch jsonb, pid uuid, aid uuid, manual boolean): 934f8762 -> dd722193
- CHANGED function:private.worker_ai_turn_recovery_v5(aid uuid, cid uuid, request_id uuid): c08d6ef8 -> a9b12ee0
- CHANGED function:public.rpc_accept_ai_task_review(p_review_id uuid, p_displayed_content_digest text, p_client_request_id uuid): 7ce9555a -> 3d1265c4
- CHANGED function:public.rpc_accept_reviewed_legal_bundle(p_client_request_id text, p_terms_sha256 text, p_privacy_sha256 text): 2a34e57c -> 3dbfb787
- CHANGED function:public.rpc_activate_urgent(p_need_id uuid, p_expected_revision integer): 209115e0 -> e3d13df0
- CHANGED function:public.rpc_admit_account_lineage_service(p_account_id uuid, p_lineage text, p_reason text, p_source_ref text, p_expected_revision integer): 040bdd20 -> 1e15a064
- CHANGED function:public.rpc_apply_profile_avatar(p_asset_id uuid, p_expected_avatar_path text): a52192a5 -> bb219571
- CHANGED function:public.rpc_authorize_data_export_download(p_receipt_id uuid, p_artifact_generation uuid): c17ceee9 -> 22825b5b
- CHANGED function:public.rpc_begin_push_send(p_attempt_id uuid, p_lease_id uuid): b8e7537d -> fc76b344
- CHANGED function:public.rpc_cancel_media_upload(p_conversation_id uuid, p_client_request_id uuid): f2937930 -> bf8c2431
- CHANGED function:public.rpc_cancel_worker_ai_turn(p_expected_user_id uuid, p_conversation_id uuid, p_client_request_id uuid): 4b5a7406 -> a153f585
- CHANGED function:public.rpc_claim_ai_task_review_evaluation_service(p_account_id uuid, p_review_id uuid, p_need_id uuid, p_need_revision integer, p_binding jsonb): 8c830df4 -> 875d96bd
- CHANGED function:public.rpc_claim_worker_ai_turn_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_text text): d7265c97 -> 87132d4d
- CHANGED function:public.rpc_clear_profile_avatar(p_profile_id uuid, p_expected_avatar_path text): e3ae01e6 -> 11405c11
- CHANGED function:public.rpc_close_remaining_search(p_need_id uuid, p_expected_revision integer, p_client_request_id text, p_reason text): 1e3e98db -> 39fa8301
- CHANGED function:public.rpc_complete_ai_task_review_evaluation_service(p_account_id uuid, p_review_id uuid, p_attempt_id uuid, p_outcome text, p_rule_ids text[], p_safe_reason_codes text[], p_provider_ref text, p_model_ref text, p_not_ready_code text): d8ace4d5 -> 15fe2096
- CHANGED function:public.rpc_complete_data_export_cleanup(p_receipt_id uuid, p_artifact_generation uuid, p_cleanup_attempt_id uuid, p_deleted boolean): 11ad5e39 -> 1a922ab9
- CHANGED function:public.rpc_complete_data_export(p_receipt_id uuid, p_attempt_id uuid, p_byte_length bigint, p_sha256 text): 10b1ca23 -> daabd698
- CHANGED function:public.rpc_complete_media_upload_service(p_account_id uuid, p_asset_id uuid, p_storage_sha256 text): d8d5e301 -> 4526db14
- CHANGED function:public.rpc_complete_push_transport(p_attempt_id uuid, p_lease_id uuid, p_result text, p_ticket_id text): 05d2e7a8 -> 705df6b9
- CHANGED function:public.rpc_complete_worker_ai_turn_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_output jsonb): bc494881 -> 13ca82b7
- CHANGED function:public.rpc_confirm_need_edit_from_review(p_need_id uuid, p_expected_revision integer, p_conversation_id uuid, p_client_request_id text): 2b7ee495 -> e24c7b0b
- CHANGED function:public.rpc_confirm_need_edit(p_need_id uuid, p_expected_revision integer, p_client_request_id text, p_material jsonb): dfa1a809 -> 450b6f8d
- CHANGED function:public.rpc_dispatch_media_upload_service(p_account_id uuid, p_asset_id uuid, p_attempt_id uuid): f988775c -> fc5d7649
- CHANGED function:public.rpc_fail_data_export(p_receipt_id uuid, p_attempt_id uuid, p_failure_code text, p_retryable boolean): aef391ed -> dda6e789
- CHANGED function:public.rpc_fail_media_upload_service(p_account_id uuid, p_asset_id uuid, p_attempt_id uuid): f34f3678 -> 976a9722
- CHANGED function:public.rpc_get_worker_profile_for_edit(): 12ce3262 -> 61e77f00
- CHANGED function:public.rpc_list_open_tasks_v3(p_bbox jsonb, p_filters jsonb, p_limit integer, p_before_at timestamp with time zone, p_before_id uuid): 18b55181 -> 602113d5
- CHANGED function:public.rpc_patch_worker_ai(p_conversation_id uuid, p_expected_revision integer, p_patch jsonb): 10bd1d30 -> 6d9a43f4
- CHANGED function:public.rpc_prepare_account_closure(p_expected_user_id uuid, p_expected_revision integer, p_client_request_id uuid): 1a3a1b59 -> 6d4cdb48
- CHANGED function:public.rpc_prepare_ai_task_review(p_conversation_id uuid, p_response_deadline timestamp with time zone, p_location jsonb): 61cf7f94 -> 908e8e72
- CHANGED function:public.rpc_prepare_worker_ai_review(p_conversation_id uuid, p_expected_revision integer, p_activate boolean): 2260d3f1 -> baf3734a
- CHANGED function:public.rpc_publish_accepted_ai_task_review(p_review_id uuid, p_client_request_id uuid): c05ec7de -> 610a2f0e
- CHANGED function:public.rpc_publish_need_canonical(p_need_id uuid, p_expected_revision integer, p_decision_sequence bigint, p_response_deadline timestamp with time zone, p_client_request_id text): a2704487 -> 71db46f2
- CHANGED function:public.rpc_record_need_publication_decision_service(p_need_id uuid, p_expected_revision integer, p_policy_id text, p_jurisdiction text, p_outcome text, p_rule_ids text[], p_decision_source text, p_safe_reason_codes text[], p_provider_ref text, p_model_ref text, p_reviewer_provenance jsonb, p_service_provenance jsonb): 4699297e -> f6c506b0
- CHANGED function:public.rpc_renew_data_export_lease(p_receipt_id uuid, p_attempt_id uuid): 8580d91f -> 1e57fb6d
- CHANGED function:public.rpc_resolve_stale_response_after_need_edit(p_response_id uuid, p_expected_response_version integer, p_expected_need_revision integer, p_client_request_id text, p_action text, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text): d37c4f7c -> 96cb9aac
- CHANGED function:public.rpc_rotate_push_device_owned(p_expected_user_id uuid, p_previous_device_id uuid, p_previous_revision bigint, p_expo_push_token text, p_platform text): 395a2925 -> dbbc0f23
- CHANGED function:public.rpc_save_need_location_review(p_conversation_id uuid, p_expected_revision text, p_value jsonb, p_confirmed boolean): 4b2ce86f -> ef37c505
- CHANGED function:public.rpc_save_requester_profile(p_expected_revision text, p_display_name jsonb, p_client_request_id uuid): c4c0e39b -> cb27877d
- CHANGED function:public.rpc_save_worker_ai_review(p_review_id uuid, p_displayed_digest text, p_client_request_id uuid): 67d015b0 -> 3a2d7afd
- CHANGED function:public.rpc_save_worker_availability(p_expected_revision text, p_value jsonb): 1d558d6a -> e3534058
- CHANGED function:public.rpc_save_worker_capacity(p_expected_revision text, p_team_capacity jsonb): 9fd012b7 -> 54736d1a
- CHANGED function:public.rpc_save_worker_location(p_expected_revision text, p_value jsonb, p_confirmed boolean): 7566cf23 -> 12b4505d
- CHANGED function:public.rpc_send_agreement_message_v2(p_expected_user_id uuid, p_agreement_id uuid, p_client_message_id text, p_body text): 8020a937 -> 7c2546fd
- CHANGED function:public.rpc_set_account_block(p_target_account_id uuid, p_blocked boolean, p_expected_revision integer, p_client_request_id uuid): 43b3b050 -> 8700f2ab
- CHANGED function:public.rpc_set_notification_preferences(p_expected_user_id uuid, p_role text, p_settings jsonb, p_expected_revision bigint): 34a307e2 -> d07d80e3
- CHANGED function:public.rpc_set_push_device_owned(p_expected_user_id uuid, p_expo_push_token text, p_platform text, p_active boolean, p_expected_revision bigint): d70a7341 -> 66d1fca6
- CHANGED function:public.rpc_set_push_device(p_expo_push_token text, p_platform text, p_active boolean, p_expected_revision bigint): 3b97a22d -> da218bcf
- CHANGED function:public.rpc_set_retention_hold(p_account_id uuid, p_conversation_id uuid, p_hold_key text, p_active boolean, p_expected_revision bigint): f8703855 -> 2399ebe6
- CHANGED function:public.rpc_settle_media_upload_service(p_account_id uuid, p_asset_id uuid, p_storage_sha256 text, p_outcome text): c8099b03 -> ce5feb6b
- CHANGED function:public.rpc_stage_media_upload_service(p_account_id uuid, p_asset_id uuid, p_attempt_id uuid, p_sha256 text, p_width integer, p_height integer, p_byte_size integer): 905706af -> c3bf6565
- CHANGED function:public.rpc_write_agreement_current_location(p_expected_user_id uuid, p_agreement_id uuid, p_agreement_version integer, p_client_request_id uuid, p_kind text, p_input_sha256 text, p_point jsonb, p_cancel boolean): 45211908 -> 59ff01ee

Certificate after the extension: {"live":"f4bda08195ac58c10c4c9b57dff38c501921e075f6589aa066dab15fd091f693","ready":true,"binding":"f4bda08195ac58c10c4c9b57dff38c501921e075f6589aa066dab15fd091f693","erasure":"f4bda08195ac58c10c4c9b57dff38c501921e075f6589aa066dab15fd091f693","certified":"f4bda08195ac58c10c4c9b57dff38c501921e075f6589aa066dab15fd091f693"}
