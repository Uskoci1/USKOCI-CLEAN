# EX-05 (Komunikacija) - canonical scope check, 2026-10-01

**Status: SCOPE RECORD ONLY (a documentation package, NOT EX-05 progress). Nothing was applied to DEV or PROD, no paid call, no account, no dependency, no code changed. DEV was not written by the workflow.**
Levels (LIVE plan 4.2): SOURCE no change | CI no | DEV-APPLIED no | CLIENT-WIRED no | DEVICE no | RELEASE no.

Why this exists: EX-05 is ONE row of LIVE Master Plan section 5.4, a plan-proposed work unit, not an owner-approved scope; the owner's standing order is not to expand scope by assumption, so it is handled like EX-04, EX-06 and EX-09 (a read-only canonical check first). Everything below is what the canonical sources say; what is proposed is labelled as a proposal.

## 0. How this was produced (provenance and limits)
* Workflow `canonical-scope-check-generic` (read-only): 8 areas, each area's findings re-checked by an independent skeptic, then a completeness critic and a synthesizer; every agent ran on the parent model (Sonnet 5.5; Fable 5.1 was not used).
* **Limits of this run (stated, not hidden): 6 of 8 areas completed with 238 findings and 0 refuted; 2 agent(s) were lost to an API outage (ECONNRESET): map:owner-gates, map:client-chat.** The synthesizer and the critic worked from the other areas; a resume of the same run fills the gap(s) from cache. Treat statements about the lost area(s) as lower-confidence until it runs.
* The skeptics partly corrected 29 findings (section 12). File names and line numbers are as cited by the agents; they were not re-verified one by one. Source text is not live behaviour. Raw result next to this file: `ex05/EX05_SCOPE_CHECK_WORKFLOW_RESULT_20261001.json`.

## 1. What EX-05 is
EX-05 'Komunikacija' is ONE row of the LIVE Master Plan section 5.4 table 'Predloženi radni paketi' (docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html, plain-data): deliverable 'Tekst/foto/VOICE/grupa + P4 isti događaj', precondition 'Server/native dependency odobrenje gde je potrebno', measure 'Two-device/platform lanac i mediji'. It is a plan-proposed work unit inside the existing plan, not an owner-approved scope and not a tracker. As of HEAD 13680e55 it has NO scope record (no EX05_* file, no finalization.ex05 block in docs/control/redovi.json; EX-03, EX-04, EX-06 and, since 13680e55, EX-09 have one) and no registry row. Its substance is traceable only to plan chapters 10 (P3 text/photo/voice/group) and 11 (P4 same-message push), cards D03, D04, D05, P01, P04, runbook P3/P4 and Appendix A, CHAT_VOICE_CONTRACT, NOTIFICATION_MATRIX, the Voice B1/B2 plan and checkpoint receipt (which names B2-b, B2-c and B4 as 'carried EX-05 blockers'), and master-plan-live-state.json next.note ('EX-05 Komunikacija / P3 glasovne poruke'). Canonical core rows: D03 (text+voice), D04 (photos), D05 (group), P01 (Inbox exact navigation) and the chat-message leg of P04. P02 and P03 are linked evidence preconditions that no source assigns to any EX row. P05 (reminder), N06, D08, A03 (AI dictation) and the opportunity-push leg of P04 are NOT assigned to EX-05 by any source (P05 and the opportunity leg are explicitly unowned or contested) and must not be added by assumption. State today (live DEV read-only 2026-10-01, ledger 219): text, photo, group, B3a/b/c, P4 resolver, P4 transport bridge and Voice B1 server are APPLIED; every communication flow is 'native' pending (done 0 of 62); nothing in EX-05 has two-device, native, iOS or same-event provider proof; the voice client is headless (B2-a) with the flag off in every build.

## 2. Exit criteria (what "done" means, from the canonical text)
1. P3 DONE (plan 10.4): text, photo and voice pass the same reliable lifecycle without loss or duplication; group has proven server membership; two devices and the required negative accesses (third account, withdrawn membership) are confirmed. An audio validator or a successful build is not delivered voice.
2. Voice acceptance (plan 10.3 row 'Prihvatanje'): a real voice message from account A to B, listening on Android AND iOS, reconnect, third account, deletion and repeated opening. Runbook P3 Exit: native record/play tests are mandatory; a structural AAC validator alone is insufficient. If the owner restates iOS scope, that is his explicit decision, not ours.
3. P4 DONE (plan 11.3, card P04, runbook P4 Exit): ONE real message ID correlated through durable event, push attempt/provider receipt, received notification, tap, authorized resolver, exact Agreement/message window and displayed ACK, on both release candidates, with Android and iOS reported separately; cold start, warm app, same chat open, other chat, signed-out/return-from-sign-in, wrong account and no-access account each recorded; Expo ticket, provider receipt, system display and user reading kept as distinct proof levels; a flag turned on alone does not close P4; a synthetic event pointing at unrelated old messages does not count.
4. Card DONE boxes: D03 not V1 DONE while voice is missing; D04 delivered into the authorized conversation with recovery and loss-of-rights on the device; D05 real multi-member flow and permission changes on the current candidate, separate from 1:1 proof; P01 exact navigation and read boundary on one new event; P04 whole chain on both release candidates.
5. Text lifecycle checks (plan 10.1, D03): double Send or reconnect creates no new message for the same command id; an incoming message does not move a user reading old history; an unseen message is not a read-ACK; logout removes private audio/draft; late response after account/group/access change restores nothing foreign.
6. Evidence discipline (plan 4.2, 19.3, 19.6, 21.2; AGENTS 3.2.4-3.2.5): levels SOURCE / CI-PROVEN / DEV-APPLIED / CLIENT-WIRED / DEVICE-PROVEN / PROVIDER-PROVEN / RELEASE-READY kept apart; each measurement records source SHA, build hash, backend versions, platform/OS/device, network, cold/warm, sample count; one receipt per batch; no private messages, tokens, JWTs or full addresses in repo, screenshots or CI; a screenshot proves appearance, not delivery; failed and rejected evidence kept.
7. Registry honesty (docs/control/README, AGENTS 2.3): the phone light turns green only with phone evidence for the exact current build; P03's green phone light is historical (26.09 APK) and DEV now has 0 active push registrations, so it must be re-proven, not inherited.
8. Closure form: like P6, an explicit 'closed with limits' receipt naming each limit (for example iOS, push-in-first-release, group media) is acceptable only if the owner decides it; absent that decision the EX-05 measure is not met.

## 3. Already done (do not redo)
* 1:1 text send, idempotent by sender-global client_message_id; PT409 on conflict
  * Evidence: APPLIED on DEV: rpc_send_agreement_message_v2 (source147 migration 20260907130151; body rewritten by B24 part 1, ledger 213). Live pg_proc read-only 2026-10-01: authenticated EXECUTE, PT409 present, no 40001. Authenticated clients have SELECT only on agreement_messages. Source: supabase/migrations/20260907110000_clean_d03_message_retry.sql line 28.
* B3a bounded history + exact displayed-ID ACK, B3b exact-message window
  * Evidence: APPLIED ledger 204/205 (migrations 20260927140148 / 20260927140231); receipt supabase/operations/dev-alpha/ledger/20260927_chat_b3_application.receipt.json; CI ROUND_09 (2/2 + 11/11 + 7/7 on run 36312570701); client services call them (src/data/agreementMessageHistoryService.ts). No native scroll/viewability proof (ROUND_14).
* B3c body-free invalidation (realtime hint) with client hook
  * Evidence: APPLIED ledger 209 (20260927201030); only table in supabase_realtime is public.agreement_invalidations_v1; trigger on every agreement_messages insert; client hook useAgreementIncomingRefresh wired in src/app/dogovor/[id].tsx; CI runs 36344033190 and 36345955454. Not device-proven; gap-free delivery explicitly not claimed (P3_PRIVATE_HISTORY_CONTRACT line 64).
* P4 exact-message resolver and compatible push transport bridge
  * Evidence: APPLIED ledger 207 (rpc_resolve_activity_message_v1, live md5 1769346f...) and ledger 210 + Edge uskoci-push-transport v22 byte-exact (ezbr f0038af8... equals receipt); receipts 20260927_p0_p4_p5_application and 20260927_chat_p4_push_transport_application; exactPushPayloadEnabled false, realProviderSend false, pushTapDeviceProof false. Client decoder/intent/ingress files exist and are wired (pushTarget.ts, useMessagePushIngress.ts, PushRuntime.tsx). CI: runs 36339724742 (13 checks) and 36345502344 (10+13+101, intercepted Expo).
* Private photo messages in Agreement chat
  * Evidence: APPLIED from source147 (migration 20260913065130): rpc_send_agreement_photo_message_v5, rpc_read_agreement_photo_messages_v5, service RPCs service_role only; Edge uskoci-media v14 (verify_jwt true, ezbr 34e4a231... equals voice receipt); client wired; stranger refusal proven in CI (v5_agreement_photos_proof.mjs line 55). DEV holds 0 photo messages and one CANCELLED upload tombstone: the success path has never run on hosted DEV.
* Group conversation server and client
  * Evidence: APPLIED from source147 (migration 20260913002405): five authenticated RPCs (read_context, send, read_command, read_messages, mark_read); client src/data/groupConversationService.ts, src/ui/groups/*, route src/app/dogovor/[id]/grupa.tsx; pre_v3 proof in the pkg010 chain (run 36095780738, 2026-09-25). Text-only (body 1..2000). DEV holds 0 groups, 0 memberships, 0 group messages.
* Voice B1 SERVER package
  * Evidence: APPLIED ledger 215 (migration 20261001065800) on the owner's PRIMENI; Edge uskoci-media v14 and uskoci-account-closure-worker v4 byte-exact; certificate 58447d77 in closure_source_v5, closure_erasure_source_v5 and the readiness literal; receipt supabase/operations/dev-alpha/ledger/20261001_chat_voice_b1_application.receipt.json. Live read-only: bucket agreement-voice private 4 MiB audio/mp4; three authenticated RPCs (send, page_v2, window_v2) and two service-only RPCs; 0 voice uploads, 0 voice messages. CI: 16/16, 21/21 (36786883950), DEV-form 17/17 (36788595185), revert 16/16 (36789867392), Edge offline 79/79. Revert exists, NOT applied.
* Voice client B2-a (headless)
  * Evidence: SOURCE only: src/features/voiceMessages/{ports,voiceMessageComposer,voiceMessagePlayback,nativeVoiceFiles,voiceCopy}.ts, src/data/agreementVoiceClientService.ts, voiceBinaryRead.ts (VOICE_MAX_BYTES 4,194,304), voiceMessagesGate.ts (EXPO_PUBLIC_VOICE_MESSAGES, set by no workflow); 182 Jest tests per the checkpoint receipt; no screen imports it; no expo-audio.
* Event, Inbox, preferences and push-device server contracts
  * Evidence: APPLIED: private.emit_event engine, rpc_list_inbox/rpc_mark_inbox_read/rpc_resolve_activity_event, rpc_get/set_notification_preferences, owned push-device RPCs, transport RPCs service-only, pkg050a rpc_mark_agreement_messages_read (ledger 201). Live DEV: category_of_event(MESSAGE_RECEIVED)=dogovor.
* B24: deterministic conflicts raise PT409 across the chat/media/push writers
  * Evidence: APPLIED ledger 213/214; postflight functionsMentioning40001 0 (voice receipt); live scan found 0 functions mentioning 40001. Current client accepts PT409 (agreementMessageClientService.ts line 65). HTTP 409 on DEV not yet observed (registry B24.sada).
* Closure/export/retention integration of chat data including voice
  * Evidence: Certified in the disposable chain: two full canonical closures through the real worker source, 52 export datasets, MEDIA_OBJECTS includes agreement_voice_uploads_v1. A real account closure after the re-bind has NOT been run (receipt section 7).
* Historic phone/emulator evidence (kept, not acceptance of current build)
  * Evidence: R18 (74f514d7): text both directions with manual refresh (REAL_JOURNEY.md); TWO_PARTY_RECEIPT 2026-09-23 (332d285f): in-app MESSAGE_RECEIVED opened Poruke; 2026-09-26 Android push arrival of a synthetic event (PUSH_REAL_DEVICE_EVIDENCE.md, explicitly 'not yet a single-chain proof'); 2026-09-27 existing READ notification opened the exact window (PHONE_ROUND27_RECEIPT.json, not push-tap acceptance); d03-chat-mobile-proof run 34146855714 on old source 6ef2c654.
* Observed push transport state on DEV
  * Evidence: Read-only net._http_response: 180 of 180 worker responses 16:58Z-19:57Z on 2026-10-01 were HTTP 200 body {"kind":"DISABLED"} (index.ts line 85). The raw env value is still unread; the exact-payload flag was last seen absent by name on 2026-09-27 20:12:44Z.

## 4. Gaps
### G01 - No EX-05 scope record or package form
* Canonical basis: Plan 4.1 (package form), 5.4, 21.2; AGENTS 2.1 and 1.1; EX06/EX09 precedent files
* Current state: git ls-files/grep: no EX05_* file, no finalization.ex05 block; EX-05 appears only as a pointer in ex04.not_in_scope, ex06.not_in_scope/Q2 and master-plan-live-state next.note
* Size: S | autonomous: True
* Evidence: docs/control/redovi.json finalization (keys ex04, ex06; ex09 anchor added by commit 13680e55); finalization-20260927 directory lists EX03_, EX04_, EX06_, EX09_ files

### G02 - Row membership of EX-05 undecided
* Canonical basis: Plan 5.4 row says only 'P4 isti događaj'; registry ex04.not_in_scope '(EX-05 / EX-07 / P4)'; ex06.not_in_scope; runbook P4 item 6
* Current state: P4 is eight flows (D03-D05, P01-P05); P02/P03 are in no EX row; P05 has no owner (EX-06 Q3); opportunity push leg contested with EX-06 (Q2 unanswered); N06 EX-05/EX-07 ambiguous; D08 and A03 not assigned
* Size: S | autonomous: False
* Evidence: docs/control/redovi.json finalization.ex04.not_in_scope[2] and finalization.ex06.not_in_scope[0]; EX06_CANONICAL_SCOPE G11

### G03 - Voice native recorder/player (B2-b)
* Canonical basis: Plan 10.3; runbook P3 Exit; VOICE_B1_B2_PLAN B2-b; VOICE_AUDIO_STACK_DECISION
* Current state: expo-audio not installed (package.json has expo-file-system only); searches for expo-audio, expo-av, useAudioRecorder, useAudioPlayer, createAudioPlayer in src/modules/plugins find only a comment in ports.ts; UskociVoice is Android-only PCM speech-to-text, no file, no playback; registry state B2B_NATIVE_B2C_UI_NOT_STARTED
* Size: L | autonomous: False
* Evidence: src/features/voiceMessages/ports.ts line 3; docs/control/redovi.json finalization.voice_b1_b2.state

### G04 - Voice UI in AgreementChat (B2-c)
* Canonical basis: Plan D03 card UI details; VOICE_B1_B2_PLAN B2-c; AGENTS 2.4 (audit row vs UX_NACRT), 3.2.2, 3.6.3
* Current state: AgreementChat.tsx and src/app/dogovor/** contain no voice/glasovn/mikrofon reference; UX_NACRT_20260922 has no voice message at all and specifies a push with sender name and message start; owner UI proposal gate open; tap/review flow conflicts with the hold-to-talk-sends rule
* Size: L | autonomous: False
* Evidence: docs/control/redovi.json D03.sledece; docs/implementation/v5-ai-first/UX_NACRT_20260922.md section 4 step 11

### G05 - Voice never exercised at the hosted boundary
* Canonical basis: VOICE_B1_DEV_APPLICATION_RECEIPT section 7; plan 21.2
* Current state: 0 voice uploads, 0 voice messages, 0 storage objects on DEV; no HTTP/JWT call of the new RPCs or Edge voice ops; hosted Deno runtime unproven; the proven revert refuses once voice data exists, so the first voice row removes the clean rollback
* Size: M | autonomous: False
* Evidence: VOICE_B1_DEV_APPLICATION_RECEIPT_20261001.md section 7; master-plan-live-state.json next.note (revert run 36789867392)

### G06 - Validator never saw real recorder output
* Canonical basis: CHAT_VOICE_CONTRACT line 5; runbook P3 Exit
* Current state: The narrow AAC-LC/M4A validator (inspectVoiceM4a, B0 36/36) was proven on constructed structures only; no real Android/iOS recorder or decoder acceptance; the first real file will meet the server only at B4
* Size: M | autonomous: False
* Evidence: docs/control/redovi.json D03.finalization.voice ('B0 struktura AAC36/36PASS, bez dekodiranja ili pravog snimka')

### G07 - Voice deletion semantics unmapped
* Canonical basis: Plan 10.3 acceptance names 'brisanje'; CHAT_VOICE_CONTRACT (pre-send preview delete and account-closure erasure only)
* Current state: No per-message voice delete/retract RPC (searched rpc_(delete|remove|retract)_(agreement_)?(voice|message), the B1 function list, contract); storage guard refuses delete outside a closure (MEDIA_ASSET_IMMUTABLE); audio retention/expiry periods do not exist and must not be invented (AGENTS 3.4.5; LEG-11: 0 retention policy rows)
* Size: S | autonomous: False
* Evidence: VOICE_B1_B2A_CHECKPOINT_RECEIPT section 7 finding 4; LEG-11 processor-map table (0 rows)

### G08 - Voice legal and store-declaration texts contradict shipped behaviour
* Canonical basis: AGENTS 3.4.5, 3.5.1; plan 3.1, 10.3, 16.3; LEG-04/09/10/11/12; D-12
* Current state: LEG-04 line 66, LEG-09 line 85, LEG-10 AF-D02 say audio is not stored (written about AI speech input); LEG-11 and LEG-12 N-03 say chat voice needs a separate text; LEG-04 line 124 is a placeholder; DATA_DECLARATIONS_DRAFT D-12 still asks whether voice messages are in the first release although AGENTS 3.5.1 and plan 3.1 say mandatory V1; microphone permission string is the AI-assistant text
* Size: S | autonomous: False
* Evidence: docs/implementation/release-prep-20260930/DATA_DECLARATIONS_DRAFT.md line 206; app.config.js line 43

### G09 - Photos in messages: no device proof, success path never run on hosted DEV
* Canonical basis: Card D04; plan 10.2; J12
* Current state: D04 phone light grey (telefon null); DEV agreement_photo_uploads_v5 has exactly one row (CANCELLED), 0 photo messages (14 READY rows are TASK photos); R18 lists photographs and upload cancellation as not exercised
* Size: M | autonomous: False
* Evidence: docs/control/redovi.json D04.finalization.device_proof; REAL_JOURNEY.md line 67

### G10 - Photo/group/text SQL proofs predate B24 and Voice B1
* Canonical basis: Runbook P4/P3 proof discipline; B24_IMPACT line 33; AGENTS 3.2.5
* Current state: Latest pkg010 chain run (carries photo and group proofs) is 36095780738 on 3fdbe559 from 2026-09-25; B24 rewrote rpc_send_agreement_message_v2 and rpc_send_agreement_photo_message_v5 later; push_event_transport_proof.mjs line 215 asserts 40001; push/resolver proofs cover text and photo targets only, no voice case
* Size: M | autonomous: True
* Evidence: docs/implementation/product-v1-closure-20260926/finalization-20260927/b24/B24_IMPACT.md lines 33 and 42; supabase/proofs/chat/push_event_transport_proof.mjs line 215

### G11 - RC-02 media-cancel lock order: no concurrent proof
* Canonical basis: Plan 10.2 ('mora dobiti trenutnu ciljanu konkurentnu proveru'); RELEASE_CONTRACTS RC-02 'Unchanged/open'; REPORT.md line 50 (source proof, not observed deadlock)
* Current state: Live rpc_cancel_media_upload locks the asset row FOR UPDATE then calls rpc_remove_task_photo -> media_assert_task_edit (locks ai_conversations FOR UPDATE): asset-then-conversation. The inversion is in the TASK-photo path (registry A05/PG08); Agreement photo/voice CANCEL paths take the per-account advisory lock then the upload row FOR UPDATE with no parent lock after it (source read only, MEDIUM). git grep over supabase/proofs found only sequential cancel proofs
* Size: M | autonomous: True
* Evidence: docs/implementation/audit-20260924/RELEASE_CONTRACTS.md line 162; docs/control/redovi.json A05.problem

### G12 - Text chat: no current two-device native proof
* Canonical basis: Card D03; plan 10.1; J12/J13/J18; two-phone steps I20/I30/I31
* Current state: D03 phone light yellow; latest phone evidence R19 a69a26c6 (empty conversation, keyboard, Back) and R18 74f514d7 manual refresh; no automatic arrival, reconnect, older/newer anchor or displayed-ACK on any current build; of 32 two-phone steps only I20 (older run) is recorded for communication
* Size: L | autonomous: False
* Evidence: docs/control/redovi.json D03.problem and test_dva_telefona_izvrseno keys (I06,I09,I11,I12,I13,I17,I19,I20,I26,I27,I32)

### G13 - Reconnect completeness vs the B3 contract
* Canonical basis: Runbook P3 item 3 ('durable cursor/watermark'); plan 10.1; P3_PRIVATE_HISTORY_CONTRACT line 64; P3_MESSAGE_WINDOW_CONTRACT line 46
* Current state: B3a/B3b have no forward 'after' cursor and a late-committing transaction can appear behind an observed tuple; the contract says incremental-arrival semantics need a separate reviewed design; current reconnect can only be a bounded newest-window re-read with ID de-duplication; no review has recorded whether that leaves a reachable gap
* Size: M | autonomous: True
* Evidence: docs/implementation/product-v1-closure-20260926/finalization-20260927/P3_PRIVATE_HISTORY_CONTRACT.md line 64

### G14 - Full client regression is not bound to HEAD for the chat client
* Canonical basis: AGENTS 3.2.3-3.2.4; plan 4.2
* Current state: 342 suites / 7,214 tests PASS is bound to b0648051 (run 36400916665 in the Discovery-named workflow r20-discovery-retained-mount-proof.yml); agreementMessageClientService/HistoryService/Outbox changed afterwards (B24 82f85f31/170fa86d, voice B2-a cb586834/3aaeceb0); later runs: 366/7,542 at bb8d3a9b and a local 376 of 377
* Size: S | autonomous: True
* Evidence: ROUND_37 line 62; EX03_CLOSURE_RECEIPT_20261001.md line 17; VOICE_B1_B2A_CHECKPOINT_RECEIPT section 4

### G15 - Group: no group exists on DEV; real multi-member native proof absent
* Canonical basis: Card D05; plan 10.4; runbook P3 item 8
* Current state: 0 groups/memberships/messages; group exists only with 2+ distinct non-cancelled workers on one need; live read-only: two ACTIVE needs with required_slots 2, each with one CONFIRMED agreement and one worker (a third multi-slot need is CANCELLED/COMPLETED); the client entry renders only when pokrivenost.ukupno > 1; D05 phone light grey; three accounts needed
* Size: L | autonomous: False
* Evidence: src/app/dogovor/[id].tsx line 476; supabase/migrations/20260913002405_clean_v5_group_conversation.sql line 52

### G16 - Group has no notification, realtime or media path
* Canonical basis: Card D05 step 4 ('Proveri fan-out obaveštenja'); plan 10.4; runbook P3 item 8 ('separate contract rather than fake a room'); card D03 step 5
* Current state: Live pg_proc: rpc_send_group_message_v5 does not mention emit_event, notification or MESSAGE_RECEIVED; no triggers on private.group_* tables; B3c trigger exists only on public.agreement_messages; user_activity_events_event_type_check lists 24 types, none for groups (entity_type allows NEED, RESPONSE, AGREEMENT, CLARIFICATION); group messages are text-only; the group screen refreshes only by tap/AppState/ACK
* Size: L | autonomous: False
* Evidence: Live DEV catalog read-only 2026-10-01; src/ui/groups/GroupConversationScreen.tsx onRefresh

### G17 - No single-target push admission mechanism
* Canonical basis: CODEX_HANDOFF P1B/P1C; EX06_CANONICAL_SCOPE G11; runbook P4 items 2-3; AGENTS 3.1.7
* Current state: rpc_claim_push_transport(p_kind text) claims up to 64 oldest deliveries across all recipients (live: NO_ACTIVE_DEVICE branch, active-device filter, no expiry check); Edge accepts only {action: tick|probe}; the 2026-09-26 one-shot used a temporary Edge worker that was never committed; supabase/candidates has chat_p4_push_event_transport.sql (applied) and no admission candidate; with the transport off every tick returns DISABLED
* Size: L | autonomous: True
* Evidence: supabase/migrations/20260910193029_clean_n09_expo_push_transport.sql lines 174 and ~190 ('limit 64'); CODEX_HANDOFF.md lines 49-62

### G18 - Stale push backlog and unsettled attempt on DEV
* Canonical basis: CODEX_HANDOFF P1; AGENTS 3.1.7-3.1.8; EX06 scope
* Current state: 2 PUSH deliveries CREATED/unstarted (WORKER, RESPONSE_VIEWED 2026-09-30 04:11Z and RESPONSE_SELECTED 13:45Z, no expiry) belong to the only account with push-enabled preference rows and with both inactive device rows; 1 attempt TICKET_PENDING since 2026-09-26, receipt never checked. Enable with 0 devices consumes them as NO_ACTIVE_DEVICE (the withdrawn zero-device retirement); register first and they are sent to the proof device first
* Size: S | autonomous: False
* Evidence: Live read-only counts 2026-10-01; PUSH_REAL_DEVICE_EVIDENCE.md 'One-shot real send'

### G19 - Push flags not readable; exact flag last confirmed absent 2026-09-27
* Canonical basis: P4_PUSH_EVENT_TRANSPORT; runbook P4 item 2 ('confirm the actual current flag immediately before an authorized change')
* Current state: Transport observed DISABLED via worker response bodies; EXPO_PUSH_MESSAGE_TARGET_ENABLED name absent on 2026-09-27 20:12:44Z (names only, values not read); the connector exposes no names-only secret listing
* Size: S | autonomous: False
* Evidence: supabase/operations/dev-alpha/ledger/20260927_chat_p4_push_transport_application.receipt.json secretNameCheck

### G20 - No push-capable build at current HEAD; HONOR runs a package that cannot register a token
* Canonical basis: PUSH_PROOF_APK.md; app.config.js lines 49-60; runbook P4
* Current state: Firebase client only for rs.uskoci.preview (googleServicesFile deleted for rs.uskoci.dev, rs.uskoci and unknown); only build-android-push-proof.yml (USKOCI_PUSH_PROOF_BUILD=1, ARM64) can initialise Firebase; its newest run 36355441615 on 2b2cf4d7 is the REJECTED ANR candidate (AGENTS 3.2.5: never install); HONOR rounds 74-79 used rs.uskoci.dev; whether rs.uskoci.preview is still installed is unverified; the dev workflow sets neither the push-proof nor the voice flag
* Size: M | autonomous: False
* Evidence: app.config.js; .github/workflows/build-android-push-proof.yml; gh run list (read-only) per EX05-PUSH-23

### G21 - Same-event chain has no receipt at any level; provider receipt stage never completed
* Canonical basis: Plan 11.1-11.3; runbook P4 items 3, 6 and Exit; card P04
* Current state: 0 active push devices (2 ANDROID rows inactive, last seen 13.09 and 26.09); 1 attempt ever; synthetic one-shot only; recipient-role preference row required (only 2 preference rows on DEV; 49 of 52 PUSH deliveries are PUSH_OFF); push_runtime_readiness empty; no exact-payload send ever
* Size: L | autonomous: False
* Evidence: PUSH_REAL_DEVICE_EVIDENCE.md line 61; docs/control/redovi.json P04.sledece; live counts 2026-10-01

### G22 - Push-ON / in-app-OFF accounts may not resolve the exact target (source-derived, not executed)
* Canonical basis: Plan 11.2 negative matrix; runbook P4
* Current state: emit_event creates the IN_APP delivery SUPPRESSED (IN_APP_OFF) but the PUSH delivery CREATED; rpc_resolve_activity_message_v1 and the displayed-ACK require an IN_APP delivery with suppression_reason null; the client exposes the in_app switch; no live preference row has this combination; client fallback for UNAVAILABLE not examined
* Size: S | autonomous: True
* Evidence: supabase/candidates/chat_p4_exact_message_event_resolver.sql lines ~108-111; supabase/migrations/20260829210536_clean_emit_event_engine.sql line 94

### G23 - Return-from-sign-in path of a push tap has Jest only
* Canonical basis: Plan 11.2 ('Povratak iz prijave čuva dozvoljenu nameru, ali ponovo autorizuje cilj')
* Current state: PushRuntime/useMessagePushIngress handle auth readiness and discard a late response on an account ABA switch in Jest (push-runtime.test.tsx line 106); no device proof of signed-out cold start then sign-in
* Size: S | autonomous: False
* Evidence: src/data/__tests__/push-runtime.test.tsx; src/ui/notifications/PushRuntime.tsx

### G24 - iOS has no identity, signing, APNs or build
* Canonical basis: Plan 11.3, 10.3, 19.3, 21.1; runbook P4 item 6; RELEASE_CONFIG_MATRIX
* Current state: app.json ios block holds only icon; no bundleIdentifier, aps-environment, GoogleService-Info; EAS pre-install check refuses non-Android; registry B12 OPEN; UskociVoice is Android-only
* Size: L | autonomous: False
* Evidence: app.json expo.ios; RELEASE_CONFIG_MATRIX rows C-02, C-38

### G25 - Store package rs.uskoci has no push configuration; push-in-first-release undecided
* Canonical basis: RELEASE_CONFIG_MATRIX C-36/C-37; legal-drafts README question 21
* Current state: No Firebase client for rs.uskoci; EXPO_ACCESS_TOKEN from the owner's account; without push the app is silent apart from the in-app Inbox
* Size: M | autonomous: False
* Evidence: docs/implementation/release-prep-20260930/RELEASE_CONFIG_MATRIX.md rows C-36, C-37

### G26 - P05 reminder not implemented and unowned
* Canonical basis: Plan 3.2 and 11.3, card P05; runbook Appendix A
* Current state: git grep (appointment_reminder, REMINDER_DUE, agreement_reminder, reminder_event, podsetnik) over src, functions, candidates, migrations: nothing; cron has only uskoci_edge_workers and uskoci_marketplace_tick; registry status 'SERVER/EVENT PACKAGE REQUIRED / NOT IMPLEMENTED'; plan says delivery or explicit deferral must stay visible
* Size: L | autonomous: False
* Evidence: docs/control/redovi.json P05.problem; ROUND_38 'Reminder P05'

### G27 - Two-phone plan has no voice step and most communication steps are unexecuted
* Canonical basis: Plan 19.2 (J12-J14 linked to the existing 32-step plan, no third table); runbook 7.2
* Current state: test_dva_telefona lists I20, I21, I24, I28-I31 and no voice step; test_dva_telefona_izvrseno has 11 keys, only I20 for communication; I21, I22, I24, I28-I31 absent
* Size: S | autonomous: True
* Evidence: docs/control/redovi.json test_dva_telefona / test_dva_telefona_izvrseno; runbook line 343

### G28 - Two-device QA lane not ready
* Canonical basis: AGENTS 3.2.1; qa-robot README section 5 (E2E-3, E2E-4 'later'); RNR-01
* Current state: AVD USKOCI_V5_TEST uses a google_apis_playstore system image (FCM-capable in principle, not proven) but its session was lost 2026-09-30; E2E-4 push needs rs.uskoci.preview on both devices; CI-emulator numbers are kept apart because of RNR-01 (Reanimated dead-tag ANR, owner dependency decision open); HONOR window of 2026-10-01 yielded 274 s after a first attempt found ADB invisible
* Size: M | autonomous: False
* Evidence: C:/Users/user/.android/avd/USKOCI_V5_TEST.avd/config.ini; docs/implementation/qa-robot/README.md section 5; master-plan-live-state.json evidence EX04-OPTION-A-WINDOW-RUN1-20261001

### G29 - Real account closure after the Voice B1 re-bind not run
* Canonical basis: CHAT_VOICE_CONTRACT hard gate; runbook section 1 (destructive tests); AGENTS 3.1.4
* Current state: Only the in-transaction accounting and two disposable canonical closures exist; registry notes it only in D03/B24/voice block, not in N09/N10/N11 (they never mention voice or 58447d77)
* Size: M | autonomous: False
* Evidence: VOICE_B1_DEV_APPLICATION_RECEIPT_20261001.md section 7; docs/control/redovi.json N10/N11

### G30 - Stale status text that will mislead the next reader
* Canonical basis: AGENTS 1.4 (actual newer state wins); registry honesty
* Current state: CHAT_VOICE_CONTRACT line 3 'B1/B2 NOT IMPLEMENTED'; NOTIFICATION_MATRIX line 5 'pending ... primeni' (push v21 deployed, DEV runs v22); redovi.json round27 'transport nije primenjen' and P04.problem 'nije kanonski clean DEV'; finalization header 'Krug32' and B04 ledger 210; plan section 0 'P6 je i dalje otvoren' and static D03 card (2026-09-29 snapshot); LEDGER_MANIFEST.json (readAt 2026-09-19, 160 rows); LEG-09/04 voice-not-stored wording (owner text, not ours)
* Size: S | autonomous: True
* Evidence: docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md line 3; docs/implementation/product-v1-closure-20260926/NOTIFICATION_MATRIX.md line 5; supabase/operations/dev-alpha/ledger/LEDGER_MANIFEST.json

## 5. Disagreements between sources (and the proposed resolution)
1. **Which flows belong to EX-05 (and the opportunity-push leg)**
   * Sources: Plan 5.4 row ('P4 isti događaj') vs registry ex04.not_in_scope '(EX-05 / EX-07 / P4)' vs ex06.not_in_scope 'tačna poruka čet push (EX-05)' vs ex06.flows listing P04 vs runbook P4 item 6 (chat push, opportunity push, reminders each need their own event evidence) vs EX06 Q2/Q3
   * Proposed resolution: S00 records: EX-05 = D03, D04, D05, P01 and the CHAT-MESSAGE leg of P04; P02/P03 as evidence preconditions; EX-06 keeps the opportunity leg (its own default recommendation); P05, N06, D08, A03 listed as 'unassigned, owner decides' with no work started. The owner confirms or changes this.
2. **Push enablement route**
   * Sources: AGENTS 3.1.7 ('documented zero-device backlog retirement') vs CODEX_HANDOFF line 12 ('withdrawn', 'A brief global enable window is NOT a one-event send limit') vs MEDIA_PUSH_PREFLIGHT header (withdrawn at 11:55Z; the AGENTS sentence was copied from the 10:53Z block) vs PLAN.md line 69 vs MEDIA_PUSH_APPLY (retirement executed afterwards via temporary Edge v15)
   * Proposed resolution: Follow the strictest common rule: no global enable, no blanket window, one owner device, one event, only after approval, enforced by an admission mechanism (S06). Neither enable order is safe on today's DEV (order A consumes the 2 stale WORKER deliveries, order B sends them first). The owner decides whether to correct the AGENTS sentence; we do not edit AGENTS.md.
3. **AGENTS 3.1.3 reads like a standing DEV authorization while 3.1.2 says there is none**
   * Sources: AGENTS.md 3.1.2 vs 3.1.3; owner decisions of 2026-10-01 (for example 'PKG-049 se NE primenjuje na osnovu te poruke')
   * Proposed resolution: Treat every EX-05 server or Edge candidate as needing the owner's exact 'primeni'.
4. **Voice storage vs legal drafts and declarations**
   * Sources: Applied Voice B1 (audio stored privately for both participants) vs LEG-04 line 66, LEG-09 line 85, LEG-10 AF-D02 ('not stored'); LEG-11/LEG-12 N-03 say chat voice needs a separate text; DATA_DECLARATIONS_DRAFT D-12/GS-15/AP-12 treat voice as undecided; AGENTS 3.5.1 and plan 3.1 say mandatory V1
   * Proposed resolution: Do not edit legal drafts. Voice is built and proven (flag OFF) but not exposed until the owner replaces the texts; the owner closes D-12 so scope and store answers agree.
5. **Voice record flow**
   * Sources: Plan D03 card / CHAT_VOICE_CONTRACT UX states ('tap starts, Završi opens a review, Pošalji sends'; 'recorded preview with play/delete/send') vs AGENTS 3.6.3 ('hold-to-talk SENDS on release, accessible mode keeps review', derived from the AI-voice analysis)
   * Proposed resolution: S05 lays both flows side by side in the proposal; the owner chooses before B2-c. No code until then.
6. **UX_NACRT_20260922 versus the applied contracts**
   * Sources: AGENTS 2.4 makes the draft the comparison base; the draft has no voice message and shows MESSAGE_RECEIVED push as '{ime}: {početak poruke}'; NOTIFICATION_MATRIX line 42 and the Edge copy table say 'Nova poruka u Dogovoru / Imaš novu poruku.', never message text
   * Proposed resolution: Record both as dispositioned deviations in S00 (voice: missing capability; push copy: matrix and applied neutral copy win for privacy, plan 11.3). Disclose before any UI work.
7. **RC-02 placement**
   * Sources: Plan 10.2 puts it in the chat-photo chapter; the finding (RELEASE_CONTRACTS RC-02) and registry A05/PG08 concern the TASK-photo cancel path; Agreement photo/voice cancel paths show no inversion in source (not run)
   * Proposed resolution: S02 proves both paths on a disposable chain, so the plan's requirement is met whichever package owns the fix; a fix would be a gated server candidate.
8. **Microphone and expo-audio condition**
   * Sources: AGENTS 3.1.5 (conditional) vs VOICE_AUDIO_STACK_DECISION (check recorded by the agent, nothing installed; the 2026-09-24 'approved wording' is the AI hold-to-talk notice, not chat voice); LEG-12 N-03; pkg002-app-config.test.ts pins the image-picker microphone copy while two plugins write NSMicrophoneUsageDescription; plugin default enableBackgroundPlayback true would add FOREGROUND_SERVICE
   * Proposed resolution: Ask for a one-line owner confirmation that the condition is met and for the chat-voice microphone text before S08; set enableBackgroundRecording/Playback false; update the pinned test with the approved text.
9. **Stale or contradicted status statements (do not repeat them)**
   * Sources: See G30. Also: the task brief says EX-09 has no scope record, but HEAD 13680e55 adds EX09_CANONICAL_SCOPE_20261001.md and a registry anchor; P03's green phone light is historical while DEV now has 0 active registrations; registry round27 and P04.problem predate ledger 210/Edge v22; LEDGER_MANIFEST.json is a 2026-09-19 index
   * Proposed resolution: S00 lists the corrections; status is taken from the ledger receipts, master-plan-live-state.json and live read-only checks. The static plan cards are a 2026-09-29 snapshot, the LIVE status layer was refreshed (60da5a05) and is current.
10. **Corrections of area-report claims (refuted or overstated; must not enter the scope record)**
   * Sources: Skeptic and critic notes: (a) 'enabling the flag starts sending next minute' is wrong without an active device; (b) EXPO_PUSH_TRANSPORT_ENABLED is observed DISABLED, not merely inferred; (c) the HONOR 'ADB absent' statement is stale (274 s window ran); (d) the live layer is not stale, only the static cards; (e) entity_type CHECK has four values; (f) 'no source mentions group media/push' is false (plan 10.4, D05, runbook P3.8); (g) LEG-11/LEG-12 already carve chat voice out; (h) rpc ACLs: three voice RPCs are authenticated, two service-only; (i) B3a/B3b ledger counts were 203->204->205; (j) run 36400916665 belongs to the Discovery-named workflow; (k) the D03 server light is not blind to voice; (l) EX-07 also appears in ex04.not_in_scope
   * Proposed resolution: Use the corrected statements.
11. **Statements that stay INFERRED or UNVERIFIABLE (label them so in every receipt)**
   * Sources: Raw env values of EXPO_PUSH_TRANSPORT_ENABLED and EXPO_PUSH_MESSAGE_TARGET_ENABLED; whether rs.uskoci.preview is still installed on the HONOR; whether the AVD can receive FCM (image is google_apis_playstore, nothing proven); push-ON/in-app-OFF resolver behaviour (source-derived); Agreement photo/voice CANCEL lock order (source read, not run); that the P4 chain behaves on post-B24 bodies (proofs predate B24); whether widening a CHECK needs a re-bind is settled by the pkg046a header (yes, digest hashes constraints) but never exercised for this CHECK
   * Proposed resolution: Each is closed only by the named slice (S00 baseline, S01, S02, S12) or marked 'not proven'.

## 6. Proposed slices (work units; all inside the single 5.4 row)
### EX05-S00 - Scope record, registry anchor and read-only DEV baseline
* Scope: Documentation package following the EX-06/EX-09 precedent: EX05_CANONICAL_SCOPE_<date>.md beside the other EX files (definition, exit criteria, already done, gaps, conflicts, owner gates, questions), the raw workflow result JSON in an ex05/ folder, a finalization.ex05 anchor in docs/control/redovi.json (flows, not_in_scope, owner_gates, owner_questions; nothing marked done), a LIVE-state evidence entry. Includes: row membership table with citations (in: D03, D04, D05, P01, P04 chat leg; evidence preconditions P02/P03; unassigned P05, N06, D08, A03, opportunity leg); J12/J13/J14/J16/J18 to I20/I21/I24/I28-I31 mapping with the explicit absence of a voice I-step (no 33rd step added); AGENTS 2.4 audit-row records (agreement, missing capability, deviation) for D03 voice and push copy against UX_NACRT; the stale-text correction list of G30 (no legal text edits); a read-only DEV baseline (ledger and last migration, Edge versions, voice/photo/group counts, push devices/attempts/deliveries, push_runtime_readiness, net._http_response bodies, the two ACTIVE required_slots=2 needs, preference-row count) with timestamps.
* Canonical basis: Plan 4.1 (package form), 5.4, 21.2; AGENTS 1.4, 2.1, 2.4; EX06_CANONICAL_SCOPE_20261001.md and EX09_CANONICAL_SCOPE_20261001.md as format precedent; owner rule 'every item traceable, no scope by assumption'
* Deliverables: Scope record, ex05 workflow result JSON, registry anchor, live-state evidence entry, regenerated tracker/plan views, correction list for stale text
* Proof plan: node scripts/control/osvezi.mjs and node scripts/control/osvezi-master-plan.mjs --html ... --redovi ... --state ... then the same with --check; every claim carries file+locator or a read-only SQL receipt; an independent re-read of the registry rows; no DEV write, no phone, no provider call. Registry edits go in one commit by one writer after fetching (EX-04/EX-06 also touch redovi.json).
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: Not a gate on writing; the owner's confirmation of row membership, P05 and scheduling (questions 1-2) is needed before slices S06 onward start
* Not in scope: No status change to any flow, no new owner decision recorded as made, no AGENTS.md edit, no legal text edit, no DEV write, no scope added for P05/N06/D08/A03

### EX05-S01 - Disposable re-proof of the chat server legs on the post-B24 and Voice B1 chain
* Scope: Dispatch (workflow_dispatch) the existing chat proofs and the pkg010 chain proofs for photo and group on the current head; where a harness hard-codes 40001 on a chain that now replays B24, make it accept PT409 only (B24_IMPACT line 33); extend the resolver/transport proofs with PHOTO and VOICE message targets and with a push-ON/in-app-OFF recipient (record actual behaviour; if a defect is real, write it up and stop at an unapplied candidate decision); keep failed runs as evidence.
* Canonical basis: Runbook P4 items 3 and Exit; plan 11.2 negative matrix; B24_IMPACT.md; AGENTS 3.2.3 (full gates at integration), 3.2.5 (keep failed evidence)
* Deliverables: Updated proof files, run receipt with run ids and counts, finding note for G22
* Proof plan: CI runs on a disposable local Supabase chain with real Auth and an intercepted synthetic Expo; counts and run ids recorded; no DEV connection; proofs name what each case would have caught (corpus-style negatives).
* Autonomous: True | needs the phone: False | depends on: EX05-S00 (baseline) preferred, not required
* First owner boundary: None for the proof. A confirmed contract defect (for example G22) becomes a server candidate that needs 'primeni' to apply
* Not in scope: No server change applied, no real provider call, no matcher/EX-06 file touched, no change to production bodies

### EX05-S02 - RC-02 targeted concurrent proof for media cancellation
* Scope: Disposable-chain proof with two concurrent sessions that tries to reproduce a lock-order deadlock between rpc_cancel_media_upload and rpc_remove_task_photo/complete (task path) and between the Agreement photo and voice CANCEL service operations and their send/settle paths; records either a reproduced 40P01/wait or a closure receipt. If it reproduces, a fix candidate with exact revert, unapplied.
* Canonical basis: Plan 10.2; RELEASE_CONTRACTS RC-02; audit-20260924 REPORT.md line 50; MEDIA_PUSH_PREFLIGHT section 6
* Deliverables: Proof script, workflow run receipt, RC-02 disposition note for plan 10.2 and registry A05/PG08
* Proof plan: Deterministic interleaving using advisory-lock gates or lock_timeout on a disposable DB; assert outcomes of both orders; run before/after any candidate; attach run id; no DEV.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: Applying any fix needs 'primeni' and a check of the certified digest
* Not in scope: Applying a fix, changing task-photo product behaviour, EX-04 list work

### EX05-S03 - Reconnect, anchor and unknown-outcome review with focused client tests
* Scope: Written review of how the client reconnects with only a newest-window re-read and ID de-dup (no forward cursor), against runbook P3 items 2-5 and plan 10.1; add focused Jest/disposable cases for any untested path (same command id after unknown timeout, de-dup after reconnect, scroll anchor with arriving messages, cache scoping per account+Agreement, late response after account switch). The review states whether a reachable gap exists; if it does, it only drafts the design question for a later gated server candidate.
* Canonical basis: Runbook P3 items 2-5, 9; plan 10.1; P3_PRIVATE_HISTORY_CONTRACT line 64; P3_MESSAGE_WINDOW_CONTRACT line 46
* Deliverables: Review note, added tests, CI run id
* Proof plan: Focused Jest suites plus review note; CI client-final-check on the head that contains the new tests (binds G14); no device claim.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: None; a forward-reader server candidate would need 'primeni' and maybe a re-bind
* Not in scope: New server reader, native verification, any visual design change

### EX05-S04 - Voice validator acceptance with real-encoder AAC-LC M4A samples (de-risk only)
* Scope: In the disposable chain, feed inspectVoiceM4a and the Edge voice upload path with M4A files produced by a real AAC encoder (mono, 64 kbps, 300 ms to 5 min, moov at start and at end) plus malformed variants, so a validator rejection is not discovered first on the HONOR. Uses only CI-runner tooling; if that tooling is judged a dependency, drop the slice (nothing else depends on it).
* Canonical basis: CHAT_VOICE_CONTRACT line 5 ('no real Android/iOS recording or decoder acceptance yet'); runbook P3 Exit; plan 10.3 row 'Format i limiti'
* Deliverables: Sample generator script, proof run receipt
* Proof plan: CI run listing each sample, accept/reject outcome and reason; clearly labelled 'does not close native record/play'.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: None
* Not in scope: Any claim about Android MediaRecorder or iOS AVAudioRecorder output, expo-audio, transcoding, transcription

### EX05-S05 - Voice UI proposal pack for owner review
* Scope: A proposal document (states, copy, accessibility labels, Android Back with a recorder, pending/unknown rows, permission denial, one active audio, no autoplay, no mic button unless the whole flow is supported) with both record flows (tap/review/send and hold-to-send-on-release) compared side by side, mapped to the D03 card, CHAT_VOICE_CONTRACT, plan 10.3 and AGENTS 2.4 deviation records. No app code, no placeholder button.
* Canonical basis: VOICE_B1_B2_PLAN B2-c ('the owner UI proposal comes first'); registry D03.sledece; plan D03 card UI details; AGENTS 2.4, 3.6.3
* Deliverables: Proposal document under docs/implementation/product-v1-closure-20260926/finalization-20260927/
* Proof plan: Document review against the sources; every state traced to a contract line; no device claim.
* Autonomous: True | needs the phone: False | depends on: EX05-S00 for the deviation records
* First owner boundary: The owner's approval of the proposal (question 7) before any B2-c code
* Not in scope: Implementation, TaskCard/Peek visuals, final visual design decisions

### EX05-S06 - Single-target push admission candidate (P1B)
* Scope: Generated candidate with exact revert and read-only postflight (the EX-04 pattern): a service-only way to admit exactly one named delivery (account, role, device revision, event) with a hard maximum of one provider dispatch, durable attempt identity and replay protection, no claim/send/ack/suppression of unrelated rows, conflicts as PT409, written against the live post-B24 bodies, plus the Edge change and offline Edge tests. Design constraint: no new table, column, CHECK or trigger so the closure digest does not move; if the design needs one, stop and escalate. The cron minute tick stays unchanged.
* Canonical basis: CODEX_HANDOFF P1B/P1C (lines 49-62); EX06_CANONICAL_SCOPE G11; runbook P4 items 2-3; AGENTS 3.1.7, 4.4; PUSH_REAL_DEVICE_EVIDENCE (one-shot precedent whose worker was never committed)
* Deliverables: Candidate SQL, revert SQL, postflight SQL, Edge source and tests, proof workflow and run receipt, application checklist
* Proof plan: Disposable chain with intercepted synthetic Expo only: admitted target dispatches once; replay and second call dispatch nothing; wrong account/role/revision/delivery refused with nothing claimed; seeded unrelated CREATED rows (modelled on the 2 stale WORKER rows) untouched and not suppressed; transport flag off sends nothing; PT409 not 40001; closure digest asserted unchanged; revert round trip; read-only postflight query pack; Edge byte-exact readback plan (CLI route, connector escape-sequence caveat).
* Autonomous: True | needs the phone: False | depends on: EX05-S00; EX05-S01 (post-B24 proof base); owner's route answer (question 3b) before authoring to avoid rework
* First owner boundary: 'primeni' for the SQL and the Edge deploy; owner-set Edge secrets afterwards
* Not in scope: Applying anything to DEV, setting any flag, a real provider send, touching the 2 stale deliveries, global enable

### EX05-S07 - Hosted voice smoke on DEV (HTTP/JWT, synthetic M4A)
* Scope: With an owner-provided signed-in TEST-world session and the owner's word, call the new voice RPCs and Edge voice operations over HTTP once with a synthetic valid M4A (upload, send, page_v2/window_v2 read, v1 reader placeholder, third-account refusal), then read back counts. No real closure here.
* Canonical basis: VOICE_B1_DEV_APPLICATION_RECEIPT section 7 (not proven); plan 21.2; AGENTS 3.1.8
* Deliverables: Smoke receipt, DEV baseline diff
* Proof plan: Receipt with request ids, outcomes, read-back counts and the statement that the first voice rows now block the proven revert; evidence level DEV-HTTP-PROVEN, never device.
* Autonomous: False | needs the phone: False | depends on: EX05-S04 (so a validator surprise is known first); owner's word
* First owner boundary: The owner's word for a state-changing DEV action and his acceptance that the clean revert path ends with the first voice row; an owner-provided session (no password entry by agents)
* Not in scope: Real account closure after the re-bind (separate disposable-target approval), phone, push, any flag change

### EX05-S08 - B2-b native voice recorder and player behind the compile-time flag
* Scope: After the owner confirms the expo-audio condition: install expo-audio with expo install, adapters implementing the existing ports (record, play, one active audio, cache temp file deleted on stop/blur/logout), plugin flags enableBackgroundRecording/Playback false, migrate the Android hold-to-talk capture behind NativeSpeechAdapter on useAudioStream with the 7-row parity list evidenced on the physical phone, keep UskociVoice as a build-time fallback until parity, approved chat-voice microphone text and pinned test update; everything behind EXPO_PUBLIC_VOICE_MESSAGES.
* Canonical basis: AGENTS 3.1.5; VOICE_AUDIO_STACK_DECISION sections 4-8; VOICE_B1_B2_PLAN B2-b; plan 10.3 rows Snimanje, Životni vek, Player
* Deliverables: Adapters, config plugin settings, tests, device receipt
* Proof plan: Jest on the adapters and parity tests, Android build, then the HONOR window for recording, playback, permission denial, call/background/lock interruption, logout purge and the A03 parity list; AVD secondary.
* Autonomous: False | needs the phone: True | depends on: EX05-S05 approval is not required for B2-b; owner's expo-audio confirmation and microphone text
* First owner boundary: Owner confirmation that the conditional expo-audio approval is satisfied and the approved microphone text
* Not in scope: UI, expo-speech, TTS, transcription, iOS result

### EX05-S09 - B2-c voice UI in AgreementChat behind the flag
* Scope: Implement the owner-approved S05 proposal: record, review, send, player, pending/unknown rows with command identity, spoken labels, permission-denied states, Android Back with a recorder; screen loop per AGENTS 3.2.2 (screenshot, separate UX and visual critique, fix).
* Canonical basis: VOICE_B1_B2_PLAN B2-c; plan D03 card; AGENTS 3.2.2; registry D03.sledece
* Deliverables: UI code behind the flag, tests, screenshot critique records
* Proof plan: Jest and screenshot loop on the AVD, then HONOR in a granted window; the flag stays OFF in release profiles until the legal gate is cleared.
* Autonomous: False | needs the phone: True | depends on: EX05-S05 approved; EX05-S08
* First owner boundary: Owner approval of the UI proposal
* Not in scope: TaskCard/Peek visuals, enabling the flag in a store profile, legal texts

### EX05-S10 - Two-device text and photo chain on the current build (HONOR A, AVD B)
* Scope: Scenarios J12 (text/photo with offline and reconnect), J13 (older history while new arrives, anchor and read boundary), J16/I31 third-account refusal, J18/I30 A to B to A, using one of the 3 CONFIRMED agreements; I20, I21; double Send and reconnect for the same command id; late response after account switch; logout removes draft/outbox.
* Canonical basis: Cards D03/D04; plan 10.1-10.2, 19.2-19.3; runbook P3 Exit, 7.2; two-phone steps I20, I21, I30, I31
* Deliverables: Receipt, registry I20/I21/I30/I31 rows and D03/D04 phone evidence
* Proof plan: Current DEV APK (PT409-aware source) by adb install -r in an owner window; one receipt per batch with source SHA, build hash, device, OS, network, p50/p95; correlation ids only, no content or tokens; levels labelled DEVICE-PROVEN for the exact build.
* Autonomous: False | needs the phone: True | depends on: EX05-S00; owner-provided sessions on both devices; EX05-S01/S03 green first
* First owner boundary: HONOR window plus the owner's word for DEV message/photo writes and signed-in accounts
* Not in scope: Voice, push, group, iOS, any data clearing on the phone

### EX05-S11 - Voice B4: two-device voice chain
* Scope: Real voice A to B on the S08/S09 build: record, review, send, playback, one active audio, reconnect, third-account refusal, discard before send, reopen, logout purge, call/background interruption; deletion only as far as the owner defines it (account-closure erasure on an approved disposable subject); iOS recorded separately and honestly absent.
* Canonical basis: Plan 10.3 row 'Prihvatanje'; runbook P3 Exit; VOICE_B1_B2_PLAN B4
* Deliverables: B4 receipt, D03 voice evidence, registry update
* Proof plan: HONOR (primary) plus AVD; receipt as in S10; the first voice rows end the clean revert path.
* Autonomous: False | needs the phone: True | depends on: EX05-S07, S08, S09; legal gate before any exposure beyond test accounts
* First owner boundary: HONOR window, DEV write word, signed-in accounts; legal text before exposure
* Not in scope: iOS result, transcription, moderator listening

### EX05-S12 - P4 same-event push chain on Android (one real message)
* Scope: One real message from account B (AVD) to account A (HONOR) through event, attempt, Expo ticket and receipt, system display, tap, resolver, exact window and displayed ACK, correlated by private ids; cold, warm, same chat open, other chat, signed-out then sign-in, wrong account, no-access, expired/deleted target; flag restored OFF with readback; Expo ticket, receipt, display and read kept separate. Prerequisites: S06 applied on PRIMENI, a push-proof rs.uskoci.preview ARM64 APK built at the exact head by the dedicated workflow (not 2b2cf4d7), owner-set secrets with a names-only check, recipient-role preference row (dogovor push on, quiet hours off), exactly one compatible active device after an inventory of all registrations, an owner decision on the 2 stale WORKER deliveries and the 26.09 attempt.
* Canonical basis: Plan 11.1-11.3, card P04/P01; runbook P4 items 2-3 and Exit; CODEX_HANDOFF P1/P1B/P1C; AGENTS 3.1.7
* Deliverables: Same-event receipt, registry P01/P03/P04 phone evidence, flag-restore readback
* Proof plan: Receipt per scenario with levels PROVIDER-PROVEN and DEVICE-PROVEN stated separately; Android only; negative results kept; iOS recorded as separate and absent unless the owner supplies it.
* Autonomous: False | needs the phone: True | depends on: EX05-S06 (applied), EX05-S10 (text path proven first), owner answers to questions 3-4
* First owner boundary: PRIMENI for S06, owner-set Edge secrets, a push-capable install in his window, the stale-backlog decision
* Not in scope: Global enable, mass notification, opportunity push (EX-06), P05, iOS, rs.uskoci store push

### EX05-S13 - Group multi-member native proof, with a conditional server extension
* Scope: Seed a real group by one extra applicant plus selection on one of the two ACTIVE required_slots=2 needs (state-changing, owner accounts); show the 'not available' entry state on existing data without writes; then three-account scenario: two members send/receive text, third account refused, member removed by cancelling an Agreement keeps no active window, reconnect without duplicates, per-member ACK, history rights; documented limit that the group screen refreshes only on tap. Conditional second part ONLY if the owner decides group push/realtime/media is V1: a gated server candidate (event type, fan-out, B3c-style invalidation), noting that a CHECK widening moves the certified digest.
* Canonical basis: Card D05; plan 10.4; runbook P3 item 8; registry D05.sledece
* Deliverables: Group receipt, D05 phone evidence, optional gated candidate
* Proof plan: HONOR plus AVD plus a third signed-in session; receipt as in S10; a 1:1 Agreement is never group proof; the server extension (if chosen) follows the EX-04 candidate pattern and S01-style disposable proof.
* Autonomous: False | needs the phone: True | depends on: EX05-S01 (group proof refreshed), S10; owner decisions on group scope and test accounts
* First owner boundary: Owner scope answer (question 8), the second applicant account and his word for the DEV writes
* Not in scope: Group photo/voice unless the owner scopes it, add-member/invitation/admin features, new room system

### EX05-S14 - EX-05 closure receipt with limits
* Scope: Final integration: full client regression at the closing head, regenerated registry and plan, one table of levels per flow (SOURCE / CI / DEV-APPLIED / APP WIRED / APK / EMULATOR / PHYSICAL / iOS / RELEASE), named limits (for example iOS, push in first release, group media, P05), carried QA debt; modelled on P6_CLOSURE_RECEIPT.
* Canonical basis: Plan 4.2, 19.6, 21.2, 24.3; AGENTS 2.1-2.3, 3.2.3-3.2.5; P6_CLOSURE_RECEIPT as precedent
* Deliverables: Closure receipt, registry and live-state refresh
* Proof plan: Registry and plan regenerated and --check green; every DONE or limit statement traced to a receipt; the owner decides whether 'closed with limits' stands.
* Autonomous: False | needs the phone: False | depends on: S10-S13 or the owner's explicit descoping of them
* First owner boundary: The owner's closure decision
* Not in scope: Marking anything DONE without the exact receipt

## 7. Recommended order and the first owner boundary
1. EX05-S00 first: scope record, registry anchor and read-only baseline (docs only, one registry writer after fetch; EX-04 and EX-06 also edit redovi.json). It ends in the owner's confirmation of row membership and scheduling.
2. Autonomous side lane, parallel and file-disjoint, no DEV write: EX05-S01 (re-proof on the post-B24/Voice B1 chain), EX05-S02 (RC-02), EX05-S03 (reconnect review and tests), EX05-S04 (validator samples, optional), EX05-S05 (voice UI proposal). These do not displace EX-04/EX-06, which the owner ordered first, and each leaves a receipt.
3. EX05-S06 (single-target admission candidate) after the owner's route answer, as the only autonomous slice that ends at a PRIMENI.
4. First owner-window work, in this order: EX05-S10 (text and photo two-device, no new dependency), then EX05-S07 (hosted voice smoke, only with his word and the revert trade-off accepted), then EX05-S08 and EX05-S09 once the expo-audio confirmation, microphone text and UI proposal are approved, then EX05-S11 (voice B4).
5. EX05-S12 (same-event push) only after S06 is applied and the owner has handled the stale backlog, secrets and the push-capable install; EX05-S13 (group) after his scope answer and accounts.
6. EX05-S14 closure receipt with limits; iOS stays a separately recorded absent result unless the owner supplies devices and accounts.

**First owner boundary.** Everything up to a not-applied candidate with a disposable proof (S00-S06) is autonomous and needs no owner word. The first real owner boundary is a DECISION at the end of S00 (which rows EX-05 owns, P05 in or out, when EX-05 starts relative to the in-progress EX-04/EX-06). The first hard gates after that are the owner's exact 'primeni' to apply the S06 candidate and Edge change, and, for any two-device work (S07, S10-S13), his word for state-changing DEV actions plus an HONOR window and owner-provided signed-in accounts.

## 8. Owner gates (every one stays the owner's)
* **Server/Edge application: explicit 'primeni' per package** - source: AGENTS.md 3.1.2; owner practice 2026-10-01 (each decision says it does not authorize application); AGENTS 3.1.3 (AF-D26) is NOT a standing pre-authorization because 3.1.2 says the older general authorization does not override the newer boundary. Blocks: Applying any candidate to DEV: single-target push admission (S06), any group event/realtime package, P05, RC-02 fix, any Voice B1 revert or Edge redeploy
* **Closure certificate re-bind** - source: AGENTS 3.1.4; pkg046a_media_upload_cancellation.sql header lines 5-7 (digest hashes every table's columns, constraints, triggers and ACLs); EX06_CANONICAL_SCOPE item 10; AGENTS 4.4 (PT409, never 40001). Blocks: Any new table, column, CHECK widening (for example a group event_type in user_activity_events_event_type_check), trigger. Function-only changes outside the certified set do not move it; a new candidate must prove the digest unchanged or stop and escalate
* **Dependencies: expo-audio conditional, expo-speech not approved** - source: AGENTS 3.1.5; VOICE_AUDIO_STACK_DECISION_20260930.md (compatibility check written by the agent; no recorded owner acknowledgement). Blocks: B2-b native recorder/player (S08); also migrates the Android AI hold-to-talk capture (A03) behind NativeSpeechAdapter with a 7-row physical-Android parity list
* **Push enablement: no global enable, one owner device, one event, only after approval; Edge secrets set by the owner** - source: AGENTS 3.1.7 (its 'zero-device backlog retirement' clause is withdrawn by CODEX_HANDOFF line 12, MEDIA_PUSH_PREFLIGHT line 3, PLAN.md line 69); plan 5.2; CODEX_HANDOFF P1B/P1C. Blocks: Any real provider send (S12); EXPO_PUSH_TRANSPORT_ENABLED and EXPO_PUSH_MESSAGE_TARGET_ENABLED values; EXPO_ACCESS_TOKEN
* **Push in the first store release is undecided; store package rs.uskoci has no Firebase client; Firebase/FCM/Expo token/APNs are owner accounts** - source: RELEASE_CONFIG_MATRIX C-36/C-37/C-38; legal-drafts README question 21; DATA_DECLARATIONS_DRAFT; AGENTS 3.1.1. Blocks: Scope of P4 DONE for the store build; any rs.uskoci push; iOS push
* **State-changing DEV actions need the owner's prior word (the clause names 'sending a message')** - source: AGENTS 3.1.8; runbook section 1 (new test accounts need specific approval; destructive/third-account cases use disposable CI fixtures unless a separate live scope is approved). Blocks: Every two-device message/photo/voice run on DEV, group seeding, push preference rows, voice smoke, any real account closure
* **Physical HONOR only in a window the owner grants ('sad' = 6 min); no clear/sign-out/data change; updates only with adb install -r** - source: AGENTS 3.2.1; qa-robot README section 5; ROUND_79 (the EX-04 test APK 9ef10b67 stays on the phone until the next normal DEV build). Blocks: S08-S13 acceptance; any phone proof
* **Accounts and sign-in: agents may not create accounts or enter passwords; AVD session was lost 2026-09-30** - source: system rule on credentials; qa-robot README section 5; AGENTS 3.4.1. Blocks: Person B on the AVD, a signed-in rs.uskoci.preview install, the third account for group/negative cases, the second worker applicant for group seeding
* **Legal/privacy texts for chat voice and the microphone text** - source: AGENTS 3.1.1, 3.4.5; plan 10.3 and 16 (LEG-09..12); legal-drafts LEG-04 line 66/124, LEG-09 line 85, LEG-10 AF-D02, LEG-12 N-03; DATA_DECLARATIONS_DRAFT D-12, GS-15, AP-12; app.config.js line 43 is the AI-assistant text. Blocks: Exposing voice to any user and any store declaration; building and CI proofs are not blocked (plan 16.3)
* **Voice UI proposal (record/review/player in AgreementChat) and which record flow governs** - source: VOICE_B1_B2_PLAN B2-c and owner gates; registry D03 'sledece' (no fake mic button); AGENTS 3.6.3 (hold-to-talk sends on release) vs plan D03 card/CHAT_VOICE_CONTRACT (tap, review, send). Blocks: B2-c UI code (S09)
* **iOS: real iPhone, Apple developer account, bundle identifier, APNs key** - source: plan 19.3, 21.1; RELEASE_CONFIG_MATRIX C-02/C-38; registry B12 OPEN; Voice plan owner gate 6. Blocks: Any iOS push/audio result; P4 and voice DONE as the plan words them
* **Paid AI / transcription of voice** - source: plan 10.3 closing paragraph; AGENTS 3.1.6. Blocks: Any transcription, AI processing of audio messages, training use. No budget gate binds EX-05 directly (the budget sentence sits on EX-06 and the P5 entry)
* **Processor-inventory privacy branch deferred (1ab01e78); Expo/FCM terms and retention are PROVERITI** - source: AGENTS 4.5; LEG-11 R-04/R-05; legal-drafts README line 53. Blocks: Any public claim about push/processors; a real provider send stays inside the owner's TEST-world accounts
* **Destructive tests: account-closure after the voice re-bind needs a specifically approved disposable target; no adb uninstall/pm clear/factory reset; never delete the owner's account to simplify a test** - source: runbook section 1; plan 19.3. Blocks: Real closure with a voice object on DEV (not run since the re-bind to 58447d77)
* **Plan, README and this scope check are not approvals** - source: plan 24.5; AGENTS 1.1. Blocks: Treating any slice as authorized beyond its stated autonomy

## 9. Questions for the owner (none is answered by this record; each decides a variant)
1. Scheduling and scope: do you want the autonomous side lane (S00-S05, no DEV write, no gate) to run now in parallel with EX-04/EX-06, and may EX-05 own D03, D04, D05, P01 and the chat-message leg of P04 (P02/P03 only as evidence preconditions)? Should P05 (reminder before the appointment) be in V1 or explicitly deferred, and should N06, D08, A03 and the opportunity-push leg stay outside EX-05 (the EX-06 default)?
2. Push in the first store release (RELEASE_CONFIG_MATRIX C-36, legal question 21): yes or no? If yes you must supply a Firebase Android app for rs.uskoci, an FCM credential in Expo and EXPO_ACCESS_TOKEN; if no, please restate what the P4 'both release candidates' DONE becomes (for example an Android proof on rs.uskoci.preview only).
3. Push enablement route: (a) may we prepare the single-target admission package (S06: candidate, revert, postflight, disposable proof, to be applied only on your PRIMENI) instead of any global or windowed enable, and will you correct the AGENTS 3.1.7 sentence about 'zero-device backlog retirement' that its own source withdrew; (b) what should happen to the 2 stale WORKER push deliveries and the unsettled 26.09 attempt on DEV, and which account is the proof recipient; (c) will you do a names-only check or tell us the values of EXPO_PUSH_TRANSPORT_ENABLED and EXPO_PUSH_MESSAGE_TARGET_ENABLED before any proof?
4. iOS: will you provide a real iPhone, an Apple developer account, a bundle identifier and an APNs key so voice and push can get the separate iOS results the plan requires, or should EX-05 close Android-only with iOS recorded as an explicit limit?
5. expo-audio: does the 2026-09-30 compatibility check satisfy your conditional approval so `npx expo install expo-audio ~57.0.4` may run in S08, including the migration of the Android AI hold-to-talk capture behind NativeSpeechAdapter with a physical-phone parity list? Please also supply or approve the chat-voice microphone permission text (the current string is the AI-assistant text).
6. Voice legal and privacy: your texts for LEG-04/09/10/11/12 and the store declarations (D-12 still asks whether voice is in the first release, while AGENTS says mandatory V1); audio retention and expiry periods (none may be invented); whether a reported voice message may ever be heard by support (the receipt says no in V1, which sits uneasily with the store report-handling control GPL-06); acceptance of the live old-client placeholder 'Glasovna poruka. Ažuriraj aplikaciju da je poslušaš.'; and confirmation that 'brisanje' in the plan means pre-send discard plus account-closure erasure, since no per-message delete exists.
7. Voice UI: will you review the S05 proposal, and which record flow governs chat voice: tap, review, send (plan D03 card, contract) or hold-to-talk sends on release with an accessible review mode (AGENTS 3.6.3)?
8. Group scope: is the current text-only group with refresh on tap enough for V1, or do you want group push, realtime or media (a new server package that, if it widens the event-type CHECK, moves the certified closure digest and needs a re-bind and compatible APK)?
9. DEV test actions: do you approve, per slice, the state-changing DEV steps (messages, photos, voice rows, push preference rows, group seeding by a second applicant) and will you provide the signed-in sessions (the AVD session was lost on 2026-09-30, a third account is needed for group and negative cases) and HONOR windows? Note that the first voice row on DEV ends the proven clean revert of Voice B1.

## 10. Proposals that are NOT canonical (recorded, not adopted)
* Adding a 33rd voice step to the 32-step two-phone plan: the plan says to link J-families to the existing steps and not to create another progress table; S00 only records the absence.
* Any group photo/voice contract or group push event type: no source requires it (plan 10.4 and D05 only say check fan-out and 'where the contract allows'); it exists as a conditional slice part behind an owner scope decision.
* Sender-visible read/seen receipt, edit/unsend, online presence: card D03 forbids them unless approved; agreement_messages.read_at has no writer by design.
* A per-message voice delete/retract RPC: not in CHAT_VOICE_CONTRACT; only gated by the owner's definition of 'brisanje'.
* PG07 'Poruke kao zaseban spisak' and PG06 exact in-screen target: PROPOSED/OPEN gap rows with no owner decision and no EX assignment.
* Retiring the broad rpc_mark_agreement_messages_read (RC-01, registry B16/PG12/S04): still callable on DEV, no production caller, but its removal is another package's scope.
* Tightening anon table-level privileges on public.agreement_messages and neighbours (LOW hygiene observation, RLS blocks it): in no source.
* Voice transcription, AI processing of voice messages, expo-speech/TTS, voice for training: forbidden without separate approval (plan 10.3, AGENTS 3.1.5).
* A time-window or global transport enable, a zero-device backlog retirement tick, or reusing MEDIA_PUSH_PREFLIGHT section 5 steps 2 and 8: withdrawn by their own sources.
* Combining the push-proof build and the voice build into one APK, or building any APK before a granted window: a packaging choice for the owner (AGENTS 3.2.3 prefers coherent batches).
* Using the CI emulator as the evidence device for a two-account chat or push journey: RNR-01 and AGENTS 3.2.1 keep its numbers apart.
* A reconnect forward-cursor server reader: the runbook asks for a durable cursor, but the means is a new server package; only the review (S03) is canonical now.
* Marking P03's phone light or any flow DONE/green from historical evidence.

## 11. Risks
* The first voice message on shared DEV removes the proven clean revert of Voice B1 (the revert refuses while voice data exists); the 2026-10-01 B1 certificate re-bind is untested by a real closure.
* Push enablement has no safe order today: enabling with 0 devices silently consumes the 2 stale WORKER deliveries (the withdrawn retirement); registering first sends them to the proof device ahead of the real event; the cron ticks every minute and the claim takes 64 oldest rows. Any admission design must not touch unrelated rows.
* The admission candidate or a group event could move the closure digest if it adds a table, column, CHECK or trigger; every candidate must assert the digest and PT409 semantics before it is offered for PRIMENI.
* Edge deploy through the connector resolves literal escape sequences; byte-compare on readback and prefer the owner's CLI deploy (project memory uskoci-edge-deploy-via-connector-caveat).
* B2-b changes the shipped AI dictation capture (A03) behind NativeSpeechAdapter; regression risk with no EX row or registry row that records it; two plugins write NSMicrophoneUsageDescription and a test pins the current copy; expo-audio background playback defaults to true and would add FOREGROUND_SERVICE permissions.
* Device evidence is scarce: HONOR only in granted windows (the 2026-10-01 window gave 274 s after a failed first attempt), the EX-04 test APK stays installed until the next DEV build, the AVD session is lost, RNR-01 invalidates CI-emulator numbers, DEV accounts live in the owner's temporary TEST world (pkg029e).
* No push-capable build exists for the head; the newest push-proof APK is the rejected 2b2cf4d7 (never install); rs.uskoci.dev cannot register a token.
* Android-only results cannot satisfy the plan's P4 and voice DONE as worded; closing without an explicit owner restatement would be dishonest evidence.
* Static plan cards, CHAT_VOICE_CONTRACT and NOTIFICATION_MATRIX headers, registry round27/P04.problem and LEDGER_MANIFEST are stale; reading headers instead of receipts and live checks produces false claims (the owner has caught surface reads before).
* One-writer rule: docs/control/redovi.json and the live-state are edited by EX-04, EX-06 and EX-09 work in the same worktree line; S00 must fetch first and commit alone.
* Source-derived items are not facts yet: the push-ON/in-app-OFF resolver gap and the Agreement photo/voice CANCEL lock order were read, not run.
* Scope drift: P05, N06, D08, A03 and the opportunity-push leg are tempting to absorb; none is assigned to EX-05 by any source.
* Reconnect relies on a bounded newest-window re-read with de-dup because B3 has no forward cursor and late commits can appear behind an observed tuple; a real gap would need a new gated server package.

## 12. Findings the skeptics partly corrected (the synthesizer used the corrected claim)
* [plan EX05-02] Neighbouring rows are correct. The order claim is not: AGENTS.md section 4.2 only has the coarse order (checkpoint, C0, EX-03, other V1 flows, UI/UX, release). The sequence Voice B1 -> EX-03 -> EX-04 -> EX-06 is in VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md section 8. The live next.note lists EX-05 before EX-04 and EX-06, so it is not an execution order either.
  * Corrected claim: Rows EX-01..EX-09 are as stated; the table order is not an execution order. The owner's order (Voice stops, then EX-03, then EX-04, then EX-06; B2-b/B2-c/B4 carried as EX-05 blockers) is recorded in VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md section 8, not in AGENTS.md, which gives only the coarse order.
* [plan EX05-24] The core claim holds: no EX-01..EX-09 row names P05, N06, D08, P02 or P03. The locator is imprecise. P05 appears in section 3.2, section 11.3 and its card. N06 appears in sections 18.2 and 18.3 and in cards B08, D05, D08, N06 and N07. D08 appears only in cards A04, D02, D08, N06 and N11. Section 13.3 describes report/block but does not name N06.
  * Corrected claim: No EX row in section 5.4 names or owns P05, N06, D08, P02 or P03. P05 appears only in sections 3.2 and 11.3 and its card; N06 only in 18.2/18.3 and flow cards; D08 only in flow cards. The EX-06 registry block also says no EX row owns the P05 decision.
* [plan EX05-26] The 32-step plan is correct (I01..I32; I20, I21, I22, I24, I28..I31 verified at the stated indices). The description of test_dva_telefona_izvrseno is wrong. Its keys are exactly I06, I09, I11, I12, I13, I17, I19, I20, I26, I27 and I32 (11 keys), not I06-I13. I07, I08 and I10 are absent, and I27 and I32 are present. All point to REAL_JOURNEY.md, R18 74f514d7, with the note 'samo opisani remote/1 osoba/ponuda tok, ne ceo plan'.
  * Corrected claim: redovi.json test_dva_telefona has 32 steps. test_dva_telefona_izvrseno records only I06, I09, I11, I12, I13, I17, I19, I20, I26, I27, I32, all from the older R18 74f514d7 partial journey. Of the communication steps only I20 (Poruke) has any record. I21, I22, I24 and I28-I31 have none.
* [plan EX05-39] The static-versus-live contrast is right (header 'Presek: 29.09.2026', D03 card 'VOICE B1/B2 otvoreni'). The claim that the live layer is stale is not. Commit 60da5a05 changed both the HTML and master-plan-live-state.json (it added the EX04-OPTION-A-WINDOW-RUN1 evidence). The source.head field only records the head at generation. Commits 852cf658 and b00f62f3 do not touch the HTML or live-state (EX-06 and B09 proof files only).
  * Corrected claim: The static plain-data cards and chapters are a 2026-09-29 snapshot. The live-state layer was refreshed in 60da5a05 (after c97be190) and is current for EX-05-relevant status at HEAD b00f62f3. source.head c97be190 is the generation-time head, not staleness. For implementation facts the registry and live state win (AGENTS.md section 1.4).
* [runbook F01] Row text, 'Oznake EX su samo radne celine' and the receipt section 8 quote all verified; no dedicated EX-05 scope document exists (searched EX-05/EX05/'EX 05' across non-HTML repo, plain-data of LIVE plan: one hit, the 5.4 row). But the blockers B2-b/B2-c/B4 are not in master-plan-live-state.json; they come from VOICE_B1_B2A_CHECKPOINT_RECEIPT section 8.
  * Corrected claim: EX-05 is defined by exactly one canonical row (LIVE plan 5.4, 'Oznake EX su samo radne celine unutar postojeceg plana'). No EX-05 scope record exists. EX-05 appears as a pointer in redovi.json/stanje.json not_in_scope lists (EX-04: 'D03-D05 ... (EX-05 / EX-07 / P4)'; EX-06: 'tacna poruka cet push (EX-05)'), in EX04_PERSONAL_LISTS_PLAN line 35, in EX06_CANONICAL_SCOPE (assigns the exact-message P04 flow to EX-05), and in master-plan-live-state.json next.note as 'EX-05 Komunikacija / P3 glasovne poruke' (an open row carrying the Voice B1 status; owner gates named there: UI proposal, LEG-09..12, iOS microphone text). The blockers 'B2-b, B2-c, B4' are stated only in VOICE_B1_B2A_CHECKPOINT_RECEIPT section 8.
* [runbook F34] LEG-04 line 66 ('ne cuva audio snimke'), the placeholder at LEG-04 line 124, the receipt owner-gate lists and the plan owner gate 5 verified. But the claim that LEG-09..12 all state voice is not stored is too broad: LEG-11 line 85 and LEG-12 N-03 explicitly say chat voice messages do not exist yet and need a separate text; the 'not stored' statements are LEG-04 line 66, LEG-09 line 85 ('Glas se ne cuva') and LEG-10 AF-D02 ('Audio je prolazan'), all written about AI speech input.
  * Corrected claim: Voice owner gates still open after B1: (1) recording/review/player UI proposal; (2) legal drafts: LEG-04 line 66, LEG-09 line 85 and LEG-10 AF-D02 say audio is not stored (scoped to AI speech input, false for chat voice once shipped), LEG-04 line 124 holds the chat-voice paragraph as an owner-decision placeholder, LEG-11 line 85 and LEG-12 N-03 already carve chat voice out and require a separate text; (3) iOS microphone usage text; (4) a real iPhone; (5) HONOR window for B4. The unapplied revert and any redeploy of Edge worker v3/media v13 each need a separate PRIMENI.
* [runbook F35] AGENTS 3.2.1 and qa-robot README line 59 verified, but 'the last HONOR attempt on 2026-10-01 found ADB absent' is stale: live-state evidence EX04-OPTION-A-WINDOW-RUN1-20261001 records that after the failed first attempt the owner's SAD window ran for 274 s (run 36873169662, test APK 9ef10b67 via adb install -r, session and data preserved).
  * Corrected claim: HONOR/two-device gates: the phone is the owner's and used only in a window he grants ('sad'); never clear data or sign out. On 2026-10-01 a first SAD attempt found ADB absent, then a later SAD window worked (274 s) and left the rs.uskoci.dev EX-04 test APK 9ef10b67 (PAGE_LIMIT=2 test instrument, not push-capable) installed until the next normal DEV build. Unmet for the two-device lane per qa-robot README: two signed-in TEST-world accounts on two devices (AVD session lost 2026-09-30), a current build carrying the feature, and push configuration for rs.uskoci.preview; E2E-4 push needs a push-capable package on both devices.
* [runbook F40] LIVE plan 10.3 table rows and acceptance quote verified. The second evidence quote ('Real-device recording awaits the owner's explicit readiness to speak.') is not in CHAT_VOICE_CONTRACT.md; it is CHAT_IMPLEMENTATION_BASELINE.md line 65 (the 'where' field says so, the 'file' field is wrong).
  * Corrected claim: Same claim; cite docs/implementation/product-v1-closure-20260926/CHAT_IMPLEMENTATION_BASELINE.md line 65 for 'Real-device recording awaits the owner's explicit readiness to speak.' and LIVE plan 10.3 for the nine step rows.
* [server-chat EX05-S21] Core MISSING claim re-verified with new searches (live pg_proc: no function mentioning emit_event and group; GROUP_MESSAGE_RECEIVED, group_invalidat, rpc_resolve_activity_group, group push strings: no hit; group_messages_v5 columns have no asset). Two errors: entity_type CHECK also allows CLARIFICATION (four values, not three), and 'no source states group media/push' is too strong: plan 10.4, card D05 and Runbook P3 item 8 do mention group media rights, notification fan-out and 'tekst/slika/glas gde ugovor dopusta'.
  * Corrected claim: Group has no server notification fan-out, no realtime/invalidation signal, no media columns and no exact-event resolver (live-verified). The live user_activity_events entity_type CHECK allows NEED, RESPONSE, AGREEMENT, CLARIFICATION and the event_type list has no group type. The plan asks to CHECK fan-out and media access (10.4 'prava na istoriju i medije', D05 step 4, D05 scenario 'gde ugovor dopusta') and Runbook P3.8 says to prepare a separate contract if the server cannot support the visible group promise. Whether group push/photo/voice is REQUIRED (vs text-only) is therefore an owner scope question, and a new event_type changes a CHECK hashed by the certified digest (moves 58447d77, isolated recertification plus owner approval).
* [server-chat EX05-S27] MISSING confirmed with six more patterns in migrations/candidates/functions/src plus live pg_proc name/body scan; cron has no reminder job. But the recommendation 'do not include in EX-05 without owner decision' misreads the plan: section 11.3 and card P05 (badge P4) say it stays a visible dependency unless explicitly deferred.
  * Corrected claim: P05 reminder has no server artifact anywhere (re-verified). Plan 11.3 and card P05: if in confirmed V1 scope it needs scheduler->event->recipient->transport; 'Ako nije izričito odložen, ostaje vidljiva zavisnost; ne sakrivati ga'; P05 DONE = implemented or 'izričito zaključana druga V1 odluka'. The EX-05 row says only 'P4 isti događaj'. So it is a P4 item whose V1-scope decision belongs to the owner and must be surfaced as an explicit decision, neither silently added to nor silently dropped from EX-05.
* [server-chat EX05-S29] The AGENTS quotes are accurate, but the 'documented zero-device backlog retirement' route they cite is WITHDRAWN by CODEX_HANDOFF (line 12), MEDIA_PUSH_PREFLIGHT (header) and PLAN.md (line 69). The finding presents it as the live path.
  * Corrected claim: Gates stand (explicit primeni, separate dependency approval, certificate moves need recertification, state-changing DEV needs prior word, exact flag is an owner console value, do not globally enable sending). But AGENTS 3.1.7 conflicts with newer release-hardening docs: the zero-device/global-tick backlog retirement is withdrawn; the documented enablement path is a separately approved single-target admission package (CODEX_HANDOFF P1B/P1C) that does not exist yet. See add-01 and add-02.
* [edge-push EX05-PUSH-01] Quotes verified (LIVE plan plain-data offset 21616, EX04 plan line 35, redovi.json 4705 and 4546). But 'No EX-05 scope document exists / only registry cross-references' is wrong. master-plan-live-state.json names 'EX-05 Komunikacija / P3 glasovne poruke (plan B1/B2: VOICE_B1_B2_PLAN_20260930.md ...)'. VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md section 8 says B2-b, B2-c and B4 'stay carried as EX-05 blockers'. LIVE plan sections 10.x (P3) and 11 (P4) and runbook P3/P4 are the content sources. There is no single EX05_*scope* document like EX03/EX04/EX06, so the researcher is right on that narrow point.
  * Corrected claim: EX-05 is one row of LIVE plan 5.4 (a proposal). There is no dedicated EX05 scope document, but its voice leg has a named plan (VOICE_B1_B2_PLAN_20260930.md) and named EX-05 blockers (B2-b expo-audio, B2-c AgreementChat UI, B4 HONOR with two accounts) in the Voice B1/B2a receipt section 8 and in master-plan-live-state.json. Registry rows D03-D05, P01, N06, P05 and the exact-message chat push are assigned to EX-05 / EX-07.
* [edge-push EX05-PUSH-06] Conclusion (DISABLED) correct, but 'inferred from effects, cannot be read' understates it. net._http_response on DEV holds the worker's actual response bodies: 180 of 180 responses between 2026-10-01 16:58Z and 19:57Z are status 200 with body {"kind":"DISABLED"}, which is exactly the index.ts line 85 branch (only the closure worker shares that body, and it is called only when a closure is EXECUTING; 0 now). Readiness table empty (0 rows) and cron active confirmed. The env value itself is still unread.
  * Corrected claim: Effective DEV push transport state is DISABLED, directly observed in the HTTP response bodies stored in net._http_response (180/180 {"kind":"DISABLED"}, one per minute, 16:58Z-19:57Z). The raw env value EXPO_PUSH_TRANSPORT_ENABLED is still not readable with this tool set, and the body retention window is only a few hours.
* [edge-push EX05-PUSH-07] cron.job uskoci_edge_workers '* * * * *' active, command 'select private.edge_worker_tick_v5()', and the PUSH has-work predicate verified from the live function body. But 'enabling the flag starts sending on the very next minute with no further switch' is overstated. rpc_claim_push_transport creates attempts only for devices with x.active and bound_revision=revision and a valid bound session. DEV has 0 active devices (both ANDROID rows inactive, no session binding), so an enabled tick would send nothing: it would mark the 2 CREATED deliveries SUPPRESSED/NO_ACTIVE_DEVICE and settle the 26.09 TICKET_PENDING attempt to UNKNOWN. A tick also does at most one RECEIPT and one SEND claim.
  * Corrected claim: Scheduler path confirmed. Enabling EXPO_PUSH_TRANSPORT_ENABLED makes the next minute tick process the queue, but a provider send happens only for deliveries whose recipient has an active, revision-bound, session-bound device. With 0 active devices today the first enabled tick would irreversibly retire the 2 backlog deliveries (NO_ACTIVE_DEVICE) and the old attempt without any Expo call.
* [edge-push EX05-PUSH-09] Facts verified: 2 CREATED unstarted PUSH deliveries (RESPONSE_VIEWED 30.09 04:11Z, RESPONSE_SELECTED 30.09 13:45Z), recipient role WORKER, expires_at NULL, one distinct recipient who owns both device rows, private.push_suppression returns NULL for both (sendable). The conclusion 'a one-event proof is impossible without first dealing with them' is order-dependent: the claim takes oldest first, so once the device is active and the flag on, these go first, one per tick; but if the flag is enabled while 0 devices are active they are suppressed without a send (the zero-device retirement that CODEX_HANDOFF withdrew). The 26.09 attempt would settle to UNKNOWN without a provider call (confirmed from claim body).
  * Corrected claim: Backlog is 2 sendable WORKER-role deliveries (not zero) on the same account that owns the device rows. They would be sent ahead of any newer event once that account has an active device and the transport is on; they would be consumed by NO_ACTIVE_DEVICE suppression if the transport ticks while no device is active. Either way a clean one-event proof needs an explicit decision about them.
* [edge-push EX05-PUSH-15] The receipt secretNameCheck (EXPO_PUSH_MESSAGE_TARGET_ENABLED, 'No results found', valuesRead false, 2026-09-27 20:12:44 UTC) is verified and the connector has no secrets listing. But 'EXPO_PUSH_TRANSPORT_ENABLED has never been directly read, only inferred' is outdated in effect: the live HTTP bodies show DISABLED (see EX05-PUSH-06 and add-01). The exact-payload flag has no equivalent observable, because no begin receipt with a MESSAGE_RECEIVED eventId has been sent.
  * Corrected claim: EXPO_PUSH_MESSAGE_TARGET_ENABLED: absent per the 27.09 names-only check, never rechecked, not observable now. EXPO_PUSH_TRANSPORT_ENABLED: env value not read, but the effective state is directly observed as DISABLED in the worker responses.
* [edge-push EX05-PUSH-23] Core claim verified: newest run of build-android-push-proof.yml is 36355441615 (2b2cf4d7, 27.09 22:29Z, success, REJECTED per AGENTS 3.2.5), nothing newer, so no push-capable APK for HEAD 7a5712b8; ARM64-only line 103; env lacks the P6 and EX-04 flags that build-android-dev-apk.yml sets; artifact retention 14 days. But 'five successes' is wrong: gh run list shows 8 successes in the last 12 runs (36355441615, 36353187030, 36351037945, 36345891205, 36269145651, 36265299721, 36252278794, 36246861282), plus 3 failures and 1 cancelled. 36252278794 (463215ef, push-triggered) is the corrected APK behind the 26.09 delivery. The workflow also auto-builds on push to the work branch when app.config.js, firebase-config.test.ts or the workflow file changes.
  * Corrected claim: No push-capable APK exists for current HEAD; the newest push-proof run (2b2cf4d7, 27.09) is the rejected one. The workflow has 8 successful runs in its last 12, all 26-27.09, and also triggers on pushes to the work branch that touch app.config.js, the Firebase test or the workflow file.
* [edge-push EX05-PUSH-35] The step list is a synthesis, not a canonical sequence, and it cites MEDIA_PUSH_PREFLIGHT section 5 (verified) as support although that section's step 2 (one global tick with no active device) and step 8 (short global transport window) are the global-tick approach that CODEX_HANDOFF says is withdrawn. It also omits the sequencing facts that decide the backlog problem: a tick with 0 active devices sends nothing and consumes the backlog, and only one account on DEV has push-enabled preference rows.
  * Corrected claim: Needs (canonical sources only): a push-capable rs.uskoci.preview proof APK built at an exact current source (none exists; not 36355441615), the owner's HONOR window, explicit notification enablement leaving exactly one active session-bound device for the recipient, an owner decision on the 2 backlog deliveries and the 26.09 attempt, a bounded admission mechanism proven on a disposable chain against post-B24 bodies or an explicit owner acceptance of residual global-window risk, 'primeni' for any Edge or server change, owner-set Edge secrets (names-only recheck first), one real message from a second account, full-chain ID correlation with cold/warm/open cases and negatives, flag off afterwards, iOS separate.
* [proofs EX05-TEXT-01] CI 2/2 + 11/11 + 7/7 on run 36312570701 @be72a1bd, the Round14 'no native scroll or viewability check' sentence, the registry D03 status and the DEV application are all confirmed. One numeric error: the B3 receipt shows the ledger count moving 203 -> 204 (B3a, 20260927140148) -> 205 (B3b, 20260927140231), not '204->205'. Run 36400916665 (Round37 full Jest 342/7214) is real and PASS, but it lives in the workflow 'R20 Discovery retained-mount proof' (job exact-client-proof, step 'Full regression'), not a chat workflow.
  * Corrected claim: TEXT/HISTORY (B3a bounded history + displayed-ID ACK, B3b exact-message window): SOURCE yes; CI yes (run 36312570701 @be72a1bd: 2/2 + 11/11 + 7/7); DEV_APPLIED yes (ledger 203->204->205, migrations 20260927140148 and 20260927140231, receipt 20260927_chat_b3_application); CLIENT_WIRED yes; full Jest 342/7214 at b0648051 is run 36400916665 in the Discovery-named workflow; APK/EMULATOR/PHYSICAL for paging, anchor and displayed-ACK: none.
* [proofs EX05-TEXT-05] Displayed-ID ACK and the 'foreign IDs refused' proof line are real (private_history_read_proof.mjs line 135; client uses rpc_mark_displayed_agreement_messages_v1 at agreementMessageHistoryService.ts:193). But 'the broad RPC is replaced' omits that rpc_mark_agreement_messages_read still exists on DEV (SECURITY DEFINER, EXECUTE for authenticated, live catalog) and is still defined in supabaseIzvor.ts:438-441; only tests reference oznaciPorukeProcitanim. The audit RC-01 row 'Unchanged/open' (2026-09-24) pre-dates B3.
  * Corrected claim: RC-01 is mitigated at the client: no production caller of the Agreement-ID-only acknowledgment remains (orphan port method only), and the displayed-ID ACK is SOURCE+CI+DEV+CLIENT_WIRED; the broad server RPC rpc_mark_agreement_messages_read is still present and callable on DEV; measured-visibility ACK on a real scroll is native-unproven.
* [proofs EX05-P4-05] Live counts confirmed: 0 active devices, 2 total, 1 lifetime attempt, 2 PUSH deliveries CREATED/unstarted with expires_at NULL (WORKER RESPONSE_VIEWED 2026-09-30 04:11Z, RESPONSE_SELECTED 2026-09-30 13:45Z). But the cited MEDIA_PUSH_PREFLIGHT section is explicitly HISTORICAL (banner line 3: global backlog/tick/window WITHDRAWN, 'Merodavni su PUSH_ROLE_RECHECK.json i azurirani CODEX_HANDOFF.md'); the 9 old rows it mentions were REQUESTER rows and have since become SUPPRESSED (49 PUSH suppressed). 'Transport effectively not claiming' is an inference.
  * Corrected claim: DEV today: 0 active push devices, 1 lifetime attempt (TICKET_PENDING), 2 new WORKER PUSH deliveries CREATED with no expiry; the authoritative preconditions for a controlled send are in CODEX_HANDOFF.md P1/P1B/P1C (role-matching preference row, bounded one-event isolation, push-capable package, OS permission), not in the withdrawn 2026-09-26 preflight tick procedure.
* [proofs EX05-P4-06] app.config.js guard, build-android-push-proof package rs.uskoci.preview, build-android-dev-apk package rs.uskoci.dev, absence of any VOICE_MESSAGES flag in workflows, AGENTS rejection of 36355441615 @2b2cf4d7, and CI run list all verified. The sub-claim that 36353187030 @10739a44 is 'verified but not confirmed installed' has no source: no repo doc mentions that run id (only the emulator build 36353185115 for 10739a44 is recorded as installed).
  * Corrected claim: Push needs the dedicated push-proof build (rs.uskoci.preview + Firebase); the newest push-proof run 36355441615 @2b2cf4d7 is the REJECTED ANR candidate; no push-capable build from current HEAD exists, and no push-proof workflow sets EXPO_PUSH/VOICE flags for a combined text+photo+voice+push acceptance.
* [proofs EX05-CI-01] Every listed latest run and sha re-verified with gh run list (success): b3 36312570701, b3c 36344033190 and 36345955454, p4 resolver 36339724742, p4 transport 36345502344, voice b0/b1/dev-app/revert/b1c 36719907370/36786883950/36788595185/36789867392/36786887149, a1 36344974505, n10 36265280227, pkg010 36095780738. Errors: d03-chat-mobile-proof newest two runs are CANCELLED (last success 34146855714 earlier that day), not success. The 'not queried' set: n04 success 2026-09-07; n05 latest runs failure/cancelled on feat/v2-agreement-changes-20260911 (last success 2026-09-07 on a proof branch); n06 success 2026-09-10; n07 and n08 success 2026-09-07.
  * Corrected claim: Latest runs of the chat-b3/b3c/p4/voice proof workflows, notification-a1, n10 and pkg010 are success, bound to their own commits. d03-chat-mobile-proof's newest runs are cancelled (last success run 34146855714 @6ef2c654); notifications-n05's newest runs are failure/cancelled (last success 2026-09-07); n01-n04 and n06-n08 last successes are 2026-09-07..10 on old proof branches.
* [proofs EX05-QA-01] No automated two-DEVICE chat journey exists and the robot has no chat stage (E2E-3/E2E-4 later; p6 journey has 0 mentions of poruk/message/chat; no workflow runs the .maestro flows). But 'no two-account chat journey' is overstated: scripts/d03_chat_android_journey.py is documented as 'Actual two-party Android chat' and uses switch_account on one emulator (run 34146855714, historical, local restricted server, old source); ru5-two-account-auth-journey and ru5-physical-android-device-ui workflows also exist on 2026-09-06 proof branches.
  * Corrected claim: No automated two-device (HONOR + emulator) chat journey exists. A historical single-emulator two-account chat journey (d03_chat_android_journey.py, run 34146855714 @6ef2c654) exists but is not bound to current source; Maestro flows are manual and unreferenced by any workflow.
* [registry EX5-02] EX-05 appears exactly three times in redovi.json, all inside other blocks, and finalization has no ex05 key (confirmed; no 'Komunikacija' hit at all). EX-09 has zero hits (confirmed). Error: EX-07 is not only inside ex06.not_in_scope; it also appears in finalization.ex04.not_in_scope[2] ('EX-05 / EX-07 / P4'). EX-08 appears once, in ex06.not_in_scope.
  * Corrected claim: The registry has no EX-05 scope record (no ex05 key; 3 hits of 'EX-05', all in ex04.not_in_scope[2], ex06.owner_questions Q2 and ex06.not_in_scope[0]). EX-07 appears in ex04.not_in_scope[2] and ex06.not_in_scope; EX-08 only in ex06.not_in_scope; EX-09 nowhere. The ex04 line is sourced from EX04_PERSONAL_LISTS_PLAN_20260930.md line 35 ('No — EX-05 / EX-07 | registry priorities'), a predecessor proposal, not an owner decision.
* [registry EX5-04] The D03 card 'Povezani tokovi' quote is exact. D05 card links N06; D04 card links A05/D03/D05/S02; P01 and P04 cards link P03 (P04 also B00, N11); P05 card links P03/P04. But P02 is not cross-linked by any of these cards, and the I29-I31 mapping to S02/S03 is not canonical: S02 is 'A to B to A on one phone' (matches I30), S03 is background/offline/double tap (no I-step), while I29 is cold start of both phones and I31 is a third account.
  * Corrected claim: EX-05 rows by plan cross-links: D03, D04, D05, P01, P04 (chat-event part only), with P03 (device registration) as a linked precondition and S02/S03 as cross-cutting rows; N06 is linked from D05 but the registry ex04 line routes it to 'EX-05 / EX-07'; P05 is linked from the P04 card, not D03. P02 is not named by any card (only the P4 text 'važeća dozvola'). I30 maps to S02; I29 and I31 have no canonical mapping to S02/S03.
* [registry EX5-05] Applied-on-DEV facts confirmed: dev_snapshot voice_b1 (migration 20261001065800, Edge worker v4 and media v14), ledger_total 219, certificate_live 58447d77. My own read-only SELECT on DEV: agreements 8, agreement_messages 10, voice_asset_id not null 0. Wrong detail: dev_snapshot rpc_authenticated contains all THREE new RPCs (send voice, page_v2, window_v2); only the two service RPCs are service-role only. The B1 receipt also says 'three authenticated voice/history RPCs'.
  * Corrected claim: Voice B1 is applied on canonical DEV (ledger 215, now 219 after EX-04). Three new RPCs are callable by authenticated (rpc_send_agreement_voice_message_v1, rpc_read_agreement_messages_page_v2, rpc_read_agreement_message_window_v2); rpc_agreement_voice_upload_service_v1 and rpc_agreement_voice_read_service_v1 are service-role only. Live DEV: 8 agreements, 10 messages, 0 voice rows. Not proven: HTTP/JWT call of the RPCs or Edge ops, real closure after the re-bind.
* [registry EX5-06] No screen or UI component imports any voice module and AgreementChat.tsx has no voice reference (confirmed); EXPO_PUBLIC_VOICE_MESSAGES is set in no workflow, eas.json or config (grep confirmed). But the importer list is incomplete: voice-aware code also sits in shared existing files.
  * Corrected claim: Headless client B2-a exists but is not wired to any screen. Voice-aware code: src/features/voiceMessages/{nativeVoiceFiles,ports,voiceCopy,voiceMessageComposer,voiceMessagePlayback}.ts; src/data/agreementVoiceClientService.ts and voiceBinaryRead.ts; voice send path in agreementMessageClientService.ts (line 46); voice reader branch in agreementMessageHistoryService.ts behind voiceMessagesGate; voice union in agreementOutbox.ts, voice journal in agreementPhotoJournal.ts, and an unused useAgreementVoiceOutbox hook in src/hooks/useAgreementOutbox.ts. The only runtime hook outside tests is authClientService (gate plus a dynamic require of nativeVoiceFiles.purgeVoiceFiles at line 123).
* [registry EX5-13] D03.server lists only four text RPCs and D03.servisi no voice service (confirmed). But the server light is not blind to voice: osvezi.mjs scans each listed service file for rpc_* literals and turns server red if DEV lacks one (brokenCalls). agreementMessageClientService.ts (in D03.servisi) already contains rpc_send_agreement_voice_message_v1 and the history service the v2 readers, so the green server light already requires them to exist on DEV. The kod light is file-level reachability via relative imports from route files, so adding the voice RPCs to D03.server would keep kod green even though no screen calls voice.
  * Corrected claim: D03's server light already depends on the voice RPCs existing on DEV (service-file literal scan), but the row's server/servisi lists omit voice, kod reachability is file-level (stays green with no UI path to voice) and the test light only needs any test file touching a service. No light can express voice completeness; the plan says D03 is not V1 DONE while voice is missing, and only the yellow phone light and the status text carry it.
