# CURRENT_WRITE_AUTHORITY_MAP — 20260916

Canonical writers are the `src/data/*ClientService*` modules (composed into `izvor` by `src/data/index.ts`; `lazniIzvor` only in tests or with `EXPO_PUBLIC_USE_FAKE_SOURCE=1`). Screens never write through PostgREST tables except the listed reads. Execute grants: V5 migrations grant `authenticated` to non-`_service` functions and `service_role` to `_service` functions via a loop (`grant execute on function %s to %I`); `rpc_get_legal_bundle` is the only RPC also granted to `anon`. Live = migration version ≤ `20260913065130`.

| Service module | RPC / Edge / table | Defining migration | Live on DEV | Execute | Screens reaching it |
|---|---|---|---|---|---|
| `accountClosureClientService.ts` | `rpc_get_account_closure` | 20260912130000_clean_pre_v3_account_closure_preparation.sql | LIVE | authenticated | /profil/privatnost |
| `accountClosureClientService.ts` | `rpc_get_account_closure_receipt` | 20260912130000_clean_pre_v3_account_closure_preparation.sql | LIVE | authenticated | /profil/privatnost |
| `accountClosureClientService.ts` | `rpc_prepare_account_closure` | 20260912130000_clean_pre_v3_account_closure_preparation.sql | LIVE | authenticated | /profil/privatnost |
| `agreementClientService.ts` | `rpc_cancel_agreement` | 20260830172000_clean_p1_cancel_withdraw_closure.sql | LIVE | authenticated | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /prilike, /prilike/[id], /prilike/[id]/prijava, /profil/radnik, /raspored |
| `agreementClientService.ts` | `rpc_confirm_completion` | 20260908120000_clean_p0e_completion_guards.sql | LIVE | authenticated,service_role | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | `rpc_get_agreement_workspace` | 20260901101056_client_agreement_workspace_closure.sql | LIVE | authenticated | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | `rpc_list_my_agreements` | 20260901101056_client_agreement_workspace_closure.sql | LIVE | authenticated | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | `rpc_mark_work_done` | 20260908120000_clean_p0e_completion_guards.sql | LIVE | authenticated,service_role | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | `rpc_propose_agreement_change_v2` | 20260911190000_clean_pre_v3_m05_admitted_source.sql | LIVE | authenticated | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | `rpc_report_problem` | 20260908120000_clean_p0e_completion_guards.sql | LIVE | authenticated,service_role | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | `rpc_respond_agreement_change` | 20260911190000_clean_pre_v3_m05_admitted_source.sql | LIVE | authenticated | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | `rpc_withdraw_agreement_change` | 20260911190100_clean_pre_v3_agreement_execution_guards.sql | LIVE | authenticated | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /raspored |
| `agreementClientService.ts` | table `agreement_change_proposals.select` | RLS | LIVE | RLS | — |
| `agreementClientService.ts` | table `agreement_execution.select` | RLS | LIVE | RLS | — |
| `agreementCurrentLocationService.ts` | `rpc_read_agreement_current_location` | 20260913002428_clean_v5_agreement_location_snapshot.sql | LIVE | authenticated | /dogovor/[id]/lokacija |
| `agreementCurrentLocationService.ts` | `rpc_read_agreement_location_command` | 20260913002428_clean_v5_agreement_location_snapshot.sql | LIVE | authenticated | /dogovor/[id]/lokacija |
| `agreementCurrentLocationService.ts` | `rpc_write_agreement_current_location` | 20260913002428_clean_v5_agreement_location_snapshot.sql | LIVE | authenticated | /dogovor/[id]/lokacija |
| `agreementPhotoClientService.ts` | `rpc_read_agreement_photo_messages_v5` | 20260913065130_clean_v5_agreement_private_photos.sql | LIVE | authenticated (loop grant) | /dogovor/[id] |
| `agreementPhotoClientService.ts` | Edge `uskoci-media` | supabase/functions/uskoci-media | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `aiCommandOverrides.ts` | `rpc_ai_correct_fact` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated | — |
| `aiCommandOverrides.ts` | Edge `uskoci-ai-interview` | supabase/functions/uskoci-ai-interview | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `aiNeedV2Production.ts` | `rpc_ai_abandon_need_conversation_v2` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_cancel_need_turn_v2` | 20260913044510_clean_v5_unknown_ai_turn_exit.sql | LIVE | authenticated | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_confirm_fact` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated | /dogovor/[id], /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /prilike, /prilike/[id], /prilike/[id]/prijava, /profil/radnik, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_correct_fact_v2` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated,service_role | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_need_review_v2` | 20260907120000_clean_ai_need_draft_safety_authority.sql | LIVE | authenticated,service_role | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_open_need_conversation_owned_v2` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_open_need_edit_conversation_v2` | 20260910144644_clean_w05_publication_evaluator_authority.sql | LIVE | authenticated | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_read_need_turn_v2` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_ai_recover_need_turn_v2` | 20260913044510_clean_v5_unknown_ai_turn_exit.sql | LIVE | authenticated | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_confirm_need_edit_from_review_v2` | 20260904230500_clean_ru4_ai_edit_replay_boundary.sql | LIVE | authenticated | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | `rpc_save_need_draft_from_review` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated,service_role | /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /rucni-zadatak |
| `aiNeedV2Production.ts` | Edge `uskoci-ai-interview` | supabase/functions/uskoci-ai-interview | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `aiNeedV2Production.ts` | table `ai_conversations.select` | RLS | LIVE | RLS | — |
| `aiNeedV2Production.ts` | table `ai_messages.select` | RLS | LIVE | RLS | — |
| `aiNeedV2Production.ts` | table `app_profiles.select` | RLS | LIVE | RLS | — |
| `aiProductionOverrides.ts` | table `ai_conversations.select` | RLS | LIVE | RLS | — |
| `aiProductionOverrides.ts` | table `ai_messages.select` | RLS | LIVE | RLS | — |
| `aiProductionOverrides.ts` | table `ai_structured_facts.select` | RLS | LIVE | RLS | — |
| `aiTaskReviewClientService.ts` | Edge `uskoci-publication-evaluate` | supabase/functions/uskoci-publication-evaluate | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `applicationClientService.ts` | `rpc_list_my_applications` | 20260905211500_clean_ru5_my_applications_projection.sql | LIVE | authenticated | /moje-prijave, /prilike/[id]/prijava |
| `applicationClientService.ts` | `rpc_withdraw_response` | 20260830172000_clean_p1_cancel_withdraw_closure.sql | LIVE | authenticated | /moje-prijave, /prilike/[id]/prijava |
| `applicationSelectionClientService.ts` | table `need_selections.select` | RLS | LIVE | RLS | — |
| `candidateClientService.ts` | `rpc_list_need_candidates` | 20260906010000_clean_ru5_selection_eligibility_revalidation.sql | LIVE | authenticated | /potrebe/[id]/kandidati |
| `closureExecutionClientService.ts` | `rpc_read_account_closure_execution` | 20260912230039_clean_v5_policy_bound_closure.sql | LIVE | authenticated | /profil/privatnost |
| `closureExecutionClientService.ts` | `rpc_review_account_closure_execution` | 20260913081147_clean_v5_event_bound_account_erasure.sql | SOURCE_ONLY_NOT_LIVE | authenticated (loop grant) | /profil/privatnost |
| `closureExecutionClientService.ts` | `rpc_start_account_closure_execution` | 20260913081147_clean_v5_event_bound_account_erasure.sql | SOURCE_ONLY_NOT_LIVE | authenticated (loop grant) | /profil/privatnost |
| `contactClientService.ts` | `rpc_reveal_contact` | 20260910130851_clean_w02_resolved_location_authority.sql | LIVE | authenticated | /dogovor/[id] |
| `contactClientService.ts` | `rpc_set_contact_grant` | 20260910130851_clean_w02_resolved_location_authority.sql | LIVE | authenticated | /dogovor/[id] |
| `contactClientService.ts` | table `access_grants.select` | RLS | LIVE | RLS | — |
| `dataExportClientService.ts` | `rpc_cancel_data_export` | 20260908160000_clean_p2_data_export_requests.sql | LIVE | authenticated | /profil/izvoz |
| `dataExportClientService.ts` | `rpc_get_data_export_status` | 20260910153005_clean_p2_export_delivery_authority.sql | LIVE | authenticated | /profil/izvoz |
| `dataExportClientService.ts` | `rpc_request_data_export` | 20260908160000_clean_p2_data_export_requests.sql | LIVE | authenticated | /profil/izvoz |
| `dataExportClientService.ts` | `rpc_revoke_data_export_download` | 20260910153005_clean_p2_export_delivery_authority.sql | LIVE | authenticated | /profil/izvoz |
| `dataExportDeliveryService.ts` | Edge `uskoci-data-export-download` | supabase/functions/uskoci-data-export-download | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `dataExportDeliveryService.ts` | Edge `uskoci-data-export-worker` | supabase/functions/uskoci-data-export-worker | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `groupConversationService.ts` | `rpc_mark_group_messages_read_v5` | 20260913002405_clean_v5_group_conversation.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa |
| `groupConversationService.ts` | `rpc_read_group_command_v5` | 20260913002405_clean_v5_group_conversation.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa |
| `groupConversationService.ts` | `rpc_read_group_context_v5` | 20260913002405_clean_v5_group_conversation.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa |
| `groupConversationService.ts` | `rpc_read_group_messages_v5` | 20260913002405_clean_v5_group_conversation.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa |
| `groupConversationService.ts` | `rpc_send_group_message_v5` | 20260913002405_clean_v5_group_conversation.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa |
| `inboxClientService.ts` | `rpc_list_inbox` | 20260911183000_clean_pre_v3_inbox_delivery_visibility.sql | LIVE | authenticated | /dogovori, /moje-prijave, /obavestenja, /potrebe, /prilike |
| `inboxClientService.ts` | `rpc_mark_activity_event_read` | 20260911183000_clean_pre_v3_inbox_delivery_visibility.sql | LIVE | authenticated | /dogovori, /moje-prijave, /obavestenja, /potrebe, /prilike |
| `inboxClientService.ts` | `rpc_mark_inbox_read` | 20260911183000_clean_pre_v3_inbox_delivery_visibility.sql | LIVE | authenticated | /dogovori, /moje-prijave, /obavestenja, /potrebe, /prilike |
| `inboxClientService.ts` | `rpc_resolve_activity_event` | 20260912090000_clean_pre_v3_event_semantics.sql | LIVE | authenticated | /dogovori, /moje-prijave, /obavestenja, /potrebe, /prilike |
| `legalClientService.ts` | `rpc_accept_legal_bundle` | 20260908130000_clean_p1_legal_consent_ledger.sql | LIVE | authenticated | /auth, /profil/pravna |
| `legalClientService.ts` | `rpc_accept_reviewed_legal_bundle` | 20260912222338_clean_v5_owner_safety_legal_reads.sql | LIVE | authenticated | /auth, /profil/pravna |
| `legalClientService.ts` | `rpc_get_legal_bundle` | 20260908130000_clean_p1_legal_consent_ledger.sql | LIVE | anon,authenticated | /auth, /profil/pravna |
| `legalClientService.ts` | `rpc_read_my_legal_acceptance` | 20260912222338_clean_v5_owner_safety_legal_reads.sql | LIVE | authenticated | /auth, /profil/pravna |
| `locationClientService.ts` | `rpc_get_need_location_review` | 20260909160000_clean_w02_owned_location_review.sql | LIVE | authenticated | /mesto-zadatka, /pregled-zadatka, /profil/lokacija |
| `locationClientService.ts` | `rpc_get_worker_location` | 20260909160000_clean_w02_owned_location_review.sql | LIVE | authenticated | /mesto-zadatka, /pregled-zadatka, /profil/lokacija |
| `locationClientService.ts` | `rpc_save_need_location_review` | 20260910130851_clean_w02_resolved_location_authority.sql | LIVE | authenticated | /mesto-zadatka, /pregled-zadatka, /profil/lokacija |
| `locationClientService.ts` | `rpc_save_worker_location` | 20260910121926_clean_w02_regional_country_authority.sql | LIVE | authenticated | /mesto-zadatka, /pregled-zadatka, /profil/lokacija |
| `manualNeedFactClientService.ts` | `rpc_set_manual_need_fact_v2` | supabase/candidates/* | CANDIDATE_NOT_LIVE | candidate SQL (authenticated per candidate) | /rucni-zadatak |
| `marketClientService.ts` | `rpc_list_location_markets` | 20260910121926_clean_w02_regional_country_authority.sql | LIVE | authenticated | /mesto-zadatka, /pregled-zadatka, /profil/lokacija |
| `mediaClientService.ts` | `rpc_cancel_media_upload` | supabase/candidates/* | CANDIDATE_NOT_LIVE | candidate SQL (authenticated per candidate) | /dogovor/[id], /dogovor/[id]/grupa, /fotografije-zadatka, /podrska/[id], /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-zadatka, /prilike/[id], /profil, /profil/fotografija |
| `mediaClientService.ts` | `rpc_clear_profile_avatar` | 20260912224647_clean_v5_owned_media.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa, /fotografije-zadatka, /podrska/[id], /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-zadatka, /prilike/[id], /profil, /profil/fotografija |
| `mediaClientService.ts` | `rpc_read_media_upload` | 20260912224647_clean_v5_owned_media.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa, /fotografije-zadatka, /podrska/[id], /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-zadatka, /prilike/[id], /profil, /profil/fotografija |
| `mediaClientService.ts` | `rpc_read_profile_avatar` | 20260912224647_clean_v5_owned_media.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa, /fotografije-zadatka, /podrska/[id], /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-zadatka, /prilike/[id], /profil, /profil/fotografija |
| `mediaClientService.ts` | `rpc_read_task_photos` | 20260912224647_clean_v5_owned_media.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa, /fotografije-zadatka, /podrska/[id], /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-zadatka, /prilike/[id], /profil, /profil/fotografija |
| `mediaClientService.ts` | `rpc_remove_task_photo` | 20260912224647_clean_v5_owned_media.sql | LIVE | authenticated (loop grant) | /dogovor/[id], /dogovor/[id]/grupa, /fotografije-zadatka, /podrska/[id], /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-zadatka, /prilike/[id], /profil, /profil/fotografija |
| `mediaClientService.ts` | Edge `uskoci-media` | supabase/functions/uskoci-media | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `myApplicationsClientService.ts` | table `marketplace_responses.select` | RLS | LIVE | RLS | — |
| `needClientService.ts` | table `needs.select` | RLS | LIVE | RLS | — |
| `needLifecycleClientService.ts` | `rpc_cancel_need` | 20260830172000_clean_p1_cancel_withdraw_closure.sql | LIVE | authenticated | /potrebe/[id]/pregled |
| `needLifecycleClientService.ts` | `rpc_delete_draft_need` | 20260830172000_clean_p1_cancel_withdraw_closure.sql | LIVE | authenticated | /potrebe/[id]/pregled |
| `needLifecycleClientService.ts` | `rpc_get_need_lifecycle_receipt` | 20260911210000_clean_pre_v3_need_lifecycle_receipt.sql | LIVE | authenticated | /potrebe/[id]/pregled |
| `needUrgencyClientService.ts` | `fn_need_urgency` | 20260829212807_clean_advisor_hardening.sql | LIVE | authenticated | /dogovor/[id], /potrebe, /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /prilike, /prilike/[id], /prilike/[id]/prijava, /profil/radnik |
| `notificationPreferencesClientService.ts` | `rpc_get_notification_preferences` | 20260907100000_clean_n08_notification_preferences.sql | LIVE | authenticated | /profil/obavestenja |
| `notificationPreferencesClientService.ts` | `rpc_set_notification_preferences` | 20260907100000_clean_n08_notification_preferences.sql | LIVE | authenticated | /profil/obavestenja |
| `ownProfileClientService.ts` | table `app_profiles.select` | RLS | LIVE | RLS | — |
| `preselectionQaClientService.ts` | `rpc_ru4b_answer_preselection_question` | 20260905060000_clean_ru4b_preselection_qa_foundation.sql | LIVE | authenticated | /pitanja-zadatka |
| `preselectionQaClientService.ts` | `rpc_ru4b_ask_preselection_question` | 20260905060000_clean_ru4b_preselection_qa_foundation.sql | LIVE | authenticated | /pitanja-zadatka |
| `preselectionQaClientService.ts` | `rpc_ru4b_disposition_preselection_question` | 20260905060000_clean_ru4b_preselection_qa_foundation.sql | LIVE | authenticated | /pitanja-zadatka |
| `preselectionQaClientService.ts` | `rpc_ru4b_owner_preselection_questions` | 20260905060000_clean_ru4b_preselection_qa_foundation.sql | LIVE | authenticated | /pitanja-zadatka |
| `preselectionQaClientService.ts` | `rpc_ru4b_public_preselection_qa` | 20260912234201_clean_v5_owned_qa_recovery.sql | LIVE | authenticated | /pitanja-zadatka |
| `processorMapClientService.ts` | `rpc_get_processor_map_status` | 20260908140000_clean_p4_processor_map_registry.sql | LIVE | authenticated | /profil/pravna |
| `productionAuthorityOverrides.ts` | `rpc_ai_publish_need` | 20260830202733_clean_pre_p4_provenance_reconciliation.sql | LIVE | authenticated,service_role | — |
| `productionAuthorityOverrides.ts` | table `app_profiles.select` | RLS | LIVE | RLS | — |
| `productionLocationResolver.ts` | Edge `uskoci-location-search` | supabase/functions/uskoci-location-search | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `publicProfileClientService.ts` | `rpc_get_public_profile` | 20260905133000_clean_ru5_public_profile_projection.sql | LIVE | authenticated | /dogovor/[id], /potrebe/[id]/kandidati, /prilike, /prilike/[id], /prilike/[id]/prijava, /profil/radnik |
| `publicationClientService.ts` | `rpc_publish_need_canonical` | 20260910144644_clean_w05_publication_evaluator_authority.sql | LIVE | authenticated | /pregled-zadatka |
| `publicationClientService.ts` | Edge `uskoci-publication-evaluate` | supabase/functions/uskoci-publication-evaluate | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `pushDeviceClientService.ts` | `rpc_get_push_device_owned` | 20260910193029_clean_n09_expo_push_transport.sql | LIVE | authenticated | /_layout, /auth, /profil, /profil/obavestenja, /profil/privatnost |
| `pushDeviceClientService.ts` | `rpc_get_push_session_device` | 20260910193029_clean_n09_expo_push_transport.sql | LIVE | authenticated | /_layout, /auth, /profil, /profil/obavestenja, /profil/privatnost |
| `pushDeviceClientService.ts` | `rpc_revoke_push_session` | 20260910193029_clean_n09_expo_push_transport.sql | LIVE | authenticated | /_layout, /auth, /profil, /profil/obavestenja, /profil/privatnost |
| `pushDeviceClientService.ts` | `rpc_rotate_push_device_owned` | 20260910193029_clean_n09_expo_push_transport.sql | LIVE | authenticated | /_layout, /auth, /profil, /profil/obavestenja, /profil/privatnost |
| `pushDeviceClientService.ts` | `rpc_set_push_device_owned` | 20260910193029_clean_n09_expo_push_transport.sql | LIVE | authenticated | /_layout, /auth, /profil, /profil/obavestenja, /profil/privatnost |
| `pushReadinessClientService.ts` | `rpc_get_push_readiness` | 20260912131000_clean_pre_v3_push_readiness.sql | LIVE | authenticated,service_role | /profil/obavestenja |
| `qaRecoveryClientService.ts` | `rpc_read_preselection_qa_command` | 20260912234201_clean_v5_owned_qa_recovery.sql | LIVE | authenticated | /pitanja-zadatka |
| `qaRecoveryClientService.ts` | `rpc_read_preselection_qa_context` | 20260912234201_clean_v5_owned_qa_recovery.sql | LIVE | authenticated | /pitanja-zadatka |
| `qaSubmissionClientService.ts` | `rpc_cancel_qa_classification` | 20260913000144_clean_v5_qa_classifier_authority.sql | LIVE | authenticated | /pitanja-zadatka |
| `qaSubmissionClientService.ts` | `rpc_read_qa_classification` | 20260913000144_clean_v5_qa_classifier_authority.sql | LIVE | authenticated | /pitanja-zadatka |
| `qaSubmissionClientService.ts` | Edge `uskoci-qa-classify` | supabase/functions/uskoci-qa-classify | (Edge inventory: see GAP-0002/0019) | JWT | — |
| `requesterProfileClientService.ts` | `rpc_get_requester_profile_for_edit` | 20260911220000_clean_pre_v3_requester_identity.sql | LIVE | authenticated | /profil/podaci |
| `requesterProfileClientService.ts` | `rpc_save_requester_profile` | 20260911220000_clean_pre_v3_requester_identity.sql | LIVE | authenticated | /profil/podaci |
| `responseClientService.ts` | `rpc_mark_response_viewed` | 20260912090000_clean_pre_v3_event_semantics.sql | LIVE | authenticated | /potrebe/[id]/kandidati |
| `retentionPolicyClientService.ts` | `rpc_get_retention_execution_status` | 20260910162955_clean_p3_retention_execution_authority.sql | LIVE | authenticated | /profil/privatnost |
| `retentionPolicyClientService.ts` | `rpc_get_retention_policy_status` | 20260908150000_clean_p3_retention_schedule_registry.sql | LIVE | authenticated | /profil/privatnost |
| `reviewsClientService.ts` | `rpc_get_account_reputation` | 20260912100000_clean_pre_v3_reviews_authority.sql | LIVE | authenticated | /oceni-dogovor, /profil |
| `reviewsClientService.ts` | `rpc_get_my_agreement_review` | 20260912100000_clean_pre_v3_reviews_authority.sql | LIVE | authenticated | /oceni-dogovor, /profil |
| `reviewsClientService.ts` | `rpc_submit_agreement_review` | 20260912100000_clean_pre_v3_reviews_authority.sql | LIVE | authenticated | /oceni-dogovor, /profil |
| `ru4Production.ts` | `rpc_close_remaining_search` | 20260904223000_clean_ru4_close_remaining_search.sql | LIVE | authenticated | /moje-prijave, /potrebe/[id]/pregled |
| `ru4Production.ts` | `rpc_resolve_stale_response_after_need_edit` | 20260904214500_clean_ru4_owner_edit_lock.sql | LIVE | authenticated | /moje-prijave, /potrebe/[id]/pregled |
| `ru4Production.ts` | table `needs.select` | RLS | LIVE | RLS | — |
| `safetyClientService.ts` | `rpc_get_account_block` | 20260912091000_clean_pre_v3_safety_authority.sql | LIVE | authenticated | /bezbednost, /profil/blokirani |
| `safetyClientService.ts` | `rpc_list_my_account_blocks` | 20260912222338_clean_v5_owner_safety_legal_reads.sql | LIVE | authenticated | /bezbednost, /profil/blokirani |
| `safetyClientService.ts` | `rpc_read_my_safety_report_command` | 20260912222338_clean_v5_owner_safety_legal_reads.sql | LIVE | authenticated | /bezbednost, /profil/blokirani |
| `safetyClientService.ts` | `rpc_set_account_block` | 20260912091000_clean_pre_v3_safety_authority.sql | LIVE | authenticated | /bezbednost, /profil/blokirani |
| `safetyClientService.ts` | `rpc_submit_safety_report` | 20260912091000_clean_pre_v3_safety_authority.sql | LIVE | authenticated | /bezbednost, /profil/blokirani |
| `supabaseIzvor.ts` | `rpc_ai_confirm_fact` | 20260910172132_clean_w03_owned_ai_intake_authority.sql | LIVE | authenticated | /dogovor/[id], /nova, /novi-zadatak, /potrebe/[id]/pregled, /pregled-nacrta, /pregled-zadatka, /prilike, /prilike/[id], /prilike/[id]/prijava, /profil/radnik, /rucni-zadatak |
| `supabaseIzvor.ts` | `rpc_cancel_agreement` | 20260830172000_clean_p1_cancel_withdraw_closure.sql | LIVE | authenticated | /dogovor/[id], /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /podrska/novi, /prilike, /prilike/[id], /prilike/[id]/prijava, /profil/radnik, /raspored |
| `supabaseIzvor.ts` | `rpc_get_worker_profile_for_edit` | 20260911174500_clean_pre_v3_worker_capacity.sql | LIVE | authenticated | /dogovor/[id], /prilike, /prilike/[id], /prilike/[id]/prijava, /profil/radnik |
| `supabaseIzvor.ts` | table `agreement_messages.select` | RLS | LIVE | RLS | — |
| `supabaseIzvor.ts` | table `needs.select` | RLS | LIVE | RLS | — |
| `workerAiClientService.ts` | `rpc_abandon_worker_ai` | 20260912220506_clean_v5_owned_worker_profile.sql | LIVE | authenticated (loop grant) | /profil/razgovor |
| `workerAiClientService.ts` | `rpc_open_worker_ai` | 20260912220506_clean_v5_owned_worker_profile.sql | LIVE | authenticated (loop grant) | /profil/razgovor |
| `workerAiClientService.ts` | `rpc_patch_worker_ai` | 20260912220506_clean_v5_owned_worker_profile.sql | LIVE | authenticated (loop grant) | /profil/razgovor |
| `workerAiClientService.ts` | `rpc_prepare_worker_ai_review` | 20260912220506_clean_v5_owned_worker_profile.sql | LIVE | authenticated (loop grant) | /profil/razgovor |
| `workerAiClientService.ts` | `rpc_read_worker_ai` | 20260912220506_clean_v5_owned_worker_profile.sql | LIVE | authenticated (loop grant) | /profil/razgovor |
| `workerAiClientService.ts` | `rpc_save_worker_ai_review` | 20260912220506_clean_v5_owned_worker_profile.sql | LIVE | authenticated (loop grant) | /profil/razgovor |
| `workerAvailabilityClientService.ts` | `rpc_get_worker_availability` | 20260909140000_clean_w02_availability_commands.sql | LIVE | authenticated | /profil/dostupnost |
| `workerAvailabilityClientService.ts` | `rpc_save_worker_availability` | 20260909140000_clean_w02_availability_commands.sql | LIVE | authenticated | /profil/dostupnost |
| `workerCalendarClientService.ts` | `rpc_get_worker_calendar` | 20260909110000_clean_w02_calendar_authority.sql | LIVE | authenticated | /raspored |
| `workerCapacityClientService.ts` | `rpc_get_worker_capacity` | 20260911174500_clean_pre_v3_worker_capacity.sql | LIVE | authenticated | /profil/radnik |
| `workerCapacityClientService.ts` | `rpc_save_worker_capacity` | 20260911174500_clean_pre_v3_worker_capacity.sql | LIVE | authenticated | /profil/radnik |
| `workerProfileClientService.ts` | `rpc_complete_worker_profile` | 20260903165700_clean_ru1_worker_readiness.sql | LIVE | authenticated,service_role | /profil/radnik |
| `workerProfileClientService.ts` | table `app_profiles.insert` | RLS | LIVE | RLS | — |
| `workerProfileClientService.ts` | table `app_profiles.select` | RLS | LIVE | RLS | — |
| `workerProfileClientService.ts` | table `app_profiles.update` | RLS | LIVE | RLS | — |

## Not live on canonical DEV (source 145–147 and candidates)

- `rpc_cancel_media_upload` — supabase/candidates (PKG-003 manual fact v2 / PKG-008 media cancellation) — screens: /dogovor/[id], /dogovor/[id]/grupa, /fotografije-zadatka, /podrska/[id], /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /pregled-zadatka, /prilike/[id], /profil, /profil/fotografija
- `rpc_review_account_closure_execution` — 20260913081147_clean_v5_event_bound_account_erasure.sql — screens: /profil/privatnost
- `rpc_set_manual_need_fact_v2` — supabase/candidates (PKG-003 manual fact v2 / PKG-008 media cancellation) — screens: /rucni-zadatak
- `rpc_start_account_closure_execution` — 20260913081147_clean_v5_event_bound_account_erasure.sql — screens: /profil/privatnost

## Legacy / parallel writers observed

- `src/data/supabaseIzvor.ts` remains the baseline adapter for reads (`otvorenePrilike`, `prilika`, `poruke`, `mojRadnikProfil`, `potvrdiCinjenicu`, `otkaziDogovor`) while strict canonical closures own writes (`needClientService`, `responseClientService`, `contactClientService`, `workerProfileClientService`, `agreementClientService`…). PKG-007 removed the legacy `potvrdiZavrsetak` from it. V19 REPL-018/REPL-039 ask for a single public eligibility DTO and strict result decoders; no second writer path exists for the same command.
- `src/data/aiCommandOverrides.ts`, `aiProductionOverrides.ts`, `productionAuthorityOverrides.ts` (V19 REPL-093 DELETE_AFTER_PARITY / REPL-015 AUDIT_FIRST): composed older AI projection/publish adapters still in the `izvor` composition; retire only after consumer/ACL proof.
- `src/app/(app)/pregled-nacrta.tsx` uses non-uuid `requestId`/`editRequestId` built with `Date.now()+Math.random()` (CodeQL insecure-randomness alerts share the `src/lib/idempotencija.ts` fallback root); every other writer uses `noviUuidZahtevId`/`noviZahtevId`.

