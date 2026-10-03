# Personal worker profile — 2026-10-03

## Owner decision and scope
The owner explicitly requested implementation of the preceding discussion: one personal worker profile, AI-led setup, no licenses and no permanent team size; people provided are specified for an individual task offer. Continue the existing white, dimensional USKOČI visual direction.

Initial runtime source: `4081d682f51045661d76b8f6e760db3dc6ee5f3e`; current corrected source: `95a99f065bbf6020fb0a72196d017f1a6600a979`. No new app, service, dependency or account role.

## Screen and flow
| Surface / entry | Goal and primary action | Secondary action / Back | Preserved state and exceptional paths |
| --- | --- | --- | --- |
| Profile hub → Radni profil | Read own capabilities; open AI conversation | Area, availability, calendar remain direct links | Current owned profile, loading/error/retry |
| Radni profil | AI conversation above a readable personal summary | Explicit edit buttons; one editor at a time | Local draft retained across section changes; pending term is revealed on failed save |
| Manual correction | Save only changed supported fields | Dirty Back requires discard confirmation | Busy/unknown save cannot be discarded by toolbar/hardware Back; readback decides success |
| AI conversation | Explain actual work and available resources; inspect draft | Existing manual and calendar editors | Legacy V1 envelope retained; no license/team provider patch; previous messages remain historical |
| Frozen AI review | Inspect full supported values, then save | New conversation after confirmed stale review | No silent normalization of an older reviewed license/team change; recovery and explicit confirmation retained |
| Application → selection | Commit people for this offer | Existing price and calendar semantics | Applied backend authority removes profile-capacity gate, preserving slot/price/ownership/revision guards |

## Design review
| Before | After | Why |
| --- | --- | --- |
| Permanent expanded fields and finite equipment catalogues | Summary, AI entry and deliberate manual corrections | An individual can describe equipment that no icon catalogue can exhaust |
| Team size and licenses dominate setup | Personal capabilities, area, availability, tools and vehicles | Matches the owner's new product model |
| Equal text treatment for identity and detail | Name emphasis, secondary biography, separated fact groups | Clearer scan without a card around every fact |
| Long lists can occupy many screens | Three-line long summaries with explicit full expansion | Area and availability remain reachable; full authored content stays available |
| Unfinished term hidden by switching editor | Save opens the editor containing it | Clear repair path without dropping input |
| Back can lose a local edit | Explicit discard sheet; unresolved save remains owned | Avoids accidental data loss |
| Seven empty weekday rows in AI review | Actual recurring rules and dated exceptions | Full schedule information without a wall of empty metadata |

Large-text/narrow mode stacks the conversation artwork and copy. Existing press/haptic behavior and shared reduced-motion policy remain; no ornamental input animation or extra dependency.

## Checks recorded before native review
- TypeScript passed.
- Main profile/hub/onboarding/presentation: 91 checks in four focused suites.
- AI review/manual: 12; recovery: 59.
- Worker Edge: 30; task Edge context: 81; focused registry assertions: 2.
These are scoped checks, not whole-app/native/provider/push acceptance.

## Backend and version compatibility
Candidate WPP01 changes eight existing function bodies: five offer-capacity authorities, two license matcher authorities and the AI review writer. It preserves legacy columns and snapshot history. New review saves cannot silently change hidden deprecated fields. Both closure digests and function metadata must remain unchanged; no certificate rebind is included.

The deployed interview bundles predate the separately prepared AI-availability diagnostics. The personal-profile deployment must preserve the exact deployed dependencies and apply only the current approved product delta; it must not smuggle in that unrelated pending bundle.

## Remaining connected product work
The existing nine-key WORKER_PROFILE_V1 envelope has no separate desired-work or notification-preference fields. `app_profiles.exclusions` is a hard eligibility block, including manual applications; it cannot be relabeled as “do not notify me”. `worker_match_preferences.proactive_notifications` and `same_day_urgent_notifications` exist but are not included in the current AI source hash or interview writer.

A versioned personal-profile contract is still required for separate desired work, explicit exclusions, relevant/HITNO preferences, source revision protection, review, persistence, export/erasure and matching consumption. No screen in this slice claims those settings were saved. Existing working push evidence is preserved; no provider call, new message or global push activation belongs to this slice.

## Native and server evidence
SQL proof [37142045047](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37142045047), source `29ae4f5237b182ff4891362da91fc9bbaa633025`, passed all **15** bounded checks in a disposable database. It covers relevant-function fidelity, real Auth/PostgREST submission/selection, review/save/replay, remaining slots, unchanged price authority and exact revert. It does not establish overall DEV equivalence, overlapping concurrency stress or model quality.

WPP01 was applied to canonical DEV as migration **20261003180006**, `dev_alpha_wpp01_personal_worker_profile`. The ledger statement SHA exactly matches candidate `a685f8867a9e94f0333b61d239950ed6fab1f410e934cc7e35fc56db04f17008`. All eight postimage pins match; source and erasure-program digests remain unchanged and ready. Twelve predecessor/dependency pins matched before apply; zero relevant active/idle-transaction calls were observed immediately before it. This is a point-in-time observation, not an exclusive traffic barrier.

Worker interview **v18** and task interview **v52** were deployed from the minimal live-base bundles, with JWT verification retained. Complete readback matched every candidate file; only the connector's `functions/` versus `supabase/functions/` path prefix was normalized. No availability diagnostic, provider/model, budget, credential or push setting was included. Exact receipt: [WPP01 application](../../../supabase/operations/dev-alpha/ledger/20261003_wpp01_application.receipt.json).

First native source `4081d682f51045661d76b8f6e760db3dc6ee5f3e`, tree `76131faa4b4d0efd56664f873da0b3df5a7b7aab`, emulator build **37141671693**, APK `d1fc3ec741b8c185835b38771756f688893b020802671d0f669777cff99e0088`: all recovery/icon/Reanimated attestations matched; install-r preserved UID10227 and the installed hash. Device emulator-5554/USKOCI_V5_TEST,1264×2728, density560 (361dp). Phone remains disconnected.

The actual owned profile was inspected at font1.0 and1.3: raised conversation entry, readable summary, separate manual editors, area/availability group, tools and vehicles. The biography field remains above the keyboard. Toolbar and Android Back open the actual discard sheet; cancellation keeps the local input. No Save, activation, offer, message or provider call was performed. A known synthetic biography was typed locally only.

Native critique found an actual cached-route defect: confirmed discard navigated to Profile, but reentry restored the supposedly discarded local biography. Source **95a99f065bbf6020fb0a72196d017f1a6600a979** resets the owned local draft to its initial snapshot before navigation and advances its generation, retiring old callbacks. Cancel, ordinary blur/background and unknown-save ownership remain unchanged. Its native suite **43/43** and TypeScript pass. Follow-up APK **37142990111** passed and is installed: tree `24809b66990e3377fae3a96df1e8e52de873a741`, SHA256 `b6d201de9baf3a8585c773d9b7bd003da2a6d54379ec7c414579a10184d3d23b`. All three attestations and installed hash match; UID10227 is preserved. The exact native sequence now passes: edit a local biography → toolbar Back → continue editing (input retained) → Android Back → discard → Profile → Radni profil (no draft or Save footer) → biography editor (empty initial value). No business save was made. The final real profile screenshot at font1.15 was inspected; font is restored to1.15. Private evidence: `worker-personal-fixed-retained`, `-hardware-back`, `-discard-result`, `-reentry`, `-reentry-editor`, `-final-115`, and verified/install/device JSON receipts.

The existing internal profile gallery also renders the real AI review component at font1.3: personal facts, equipment, working area, grouped recurring weekdays/dated exceptions and activation choice are readable. Gallery Save is inert; this is presentation evidence only, not a new interview or persisted profile. The extra top-right “Nazad” is gallery chrome, not the production review.

Private PNG/XML evidence is under the chat workspace `native-w2/worker-personal-*`; no raw account conversation or screenshot is committed. Stills do not establish motion smoothness, haptics, network performance or phone parity. Whole-app completion is not claimed.

## Next contract: concrete implementation boundary

**Design proposal only — not implemented, not a server application, and not approval for a certificate or export-policy binding update.** This is the bounded next contract after WPP01, not a new master plan. The findings below come from read-only canonical DEV function/schema metadata and the current client/Edge source. WPP01 is not reopened by this proposal.

### Product meaning and smallest canonical storage

Keep abilities, wishes, notification filtering and hard eligibility separate:

- `skills` describes what the person can do; a desired task does not prove a skill, tool, vehicle or availability.
- Desired and declined work affect automatic suggestions/dispatch only. They do not make a manual response ineligible. A declined kind wins over a desired kind.
- `app_profiles.exclusions` retains its current **hard** meaning: it blocks both manual response and automatic dispatch. Do not write it from ordinary “ne šalji mi selidbe”, reuse it as a notification preference, or silently soften historical exclusions. A new hard-exclusion editor is outside this bounded package.
- An individual declined application/offer is not a persistent work preference and must not automatically train one.

Add only these canonical fields to the existing `public.worker_match_preferences`, whose owner/erasure path already exists:

| Proposed field | Value and default | Meaning |
| --- | --- | --- |
| `desired_work_kinds` | bounded, distinct `text[]`, default `{}` | Existing reviewed canonical kinds wanted for automatic suggestions. Empty preserves the current skills-based routing; it does not mean “notify me about everything”. |
| `declined_work_kinds` | bounded, distinct `text[]`, default `{}` | Existing reviewed canonical kinds omitted from automatic suggestions. Empty adds no suppression. |
| `urgent_tasks_enabled` | nullable boolean, default `null` | Explicit V2 preference for **all** `needs.urgent` tasks. Null preserves the legacy same-day behavior without inventing a prior choice. |

Reuse `proactive_notifications` for the automatic-suggestion switch. Do not add a second competing stored copy. Keep `same_day_urgent_notifications` unchanged for legacy fallback: today it only affects urgent `TODAY_FLEXIBLE` tasks or tasks whose start is today in the worker timezone. It is **not** an all-HITNO opt-out. Proposed effective rule: for an urgent task, a non-null `urgent_tasks_enabled` controls that task; otherwise apply the existing same-day predicate exactly. An explicit V2 yes/no applies to all urgent tasks; the untouched legacy field remains historical compatibility. Neither flag makes someone available, bypasses resources/radius, activates HITNO on a task, or overrides quiet hours.

The kind list must come from the existing eleven-kind `private.work_kinds_v5` / EX06b registry, with its version recorded in the reviewed document. Do not introduce a competing taxonomy. Do not run arbitrary negative prose through its coarse alias matching: “ne prenosim klavire” must not silently disable every moving job. Only map a statement to an entire canonical kind when that scope is actually supported by the person's answer. A more specific limitation that the task facts/matcher cannot evaluate remains an explicit unresolved detail, with a short clarification or an honest explanation; no UI claim that its routing filter works. Recording such a limitation as an executable rule needs a separate, typed predicate contract, not a bio instruction that the matcher never reads.

### Versioned AI contract and save authority

Use `WORKER_PROFILE_V2` for new V2 sessions/reviews and add one nested `workPreferences` object. Keep the nine legacy profile keys on compatible read/review payloads for now; WPP01's no-license/no-team-write rule still applies. The new object carries `desiredWorkKinds`, `declinedWorkKinds`, `proactiveNotifications`, `urgentTasksEnabled`, the reviewed kind-registry version, and the narrowly editable WORKER notification choices described below. Unknown keys or kind codes must fail closed; no guessed defaults for a malformed/missing V2 document.

Add `private.worker_ai_sessions.contract_version` with existing rows explicitly retaining `WORKER_PROFILE_V1`. Reuse the existing conversations, turns, reviews, receipts and recovery machinery. Do not clone the whole interview stack. New V2 entry/read/patch/prepare/save facades should select the version deliberately; shared internal helpers may dispatch by the stored immutable session version. The old V1 entrypoints retain V1 shapes and must refuse a V2 session with a concrete upgrade error instead of projecting away preference fields that the owner would not see. The new client can read historical V1 reviews/receipts. Never rewrite their frozen envelopes or displayed digests.

Do not upgrade an open session in place while a turn is unsettled. A V1 → V2 transition must preserve recovery first, then deliberately finish/abandon the old draft and open V2 from canonical data. An unchanged V1 save preserves new canonical preferences; it cannot reset fields it never reviewed. An old successful receipt remains replayable before current-source checks, as in WPP01.

Required function surface:

| Surface | Concrete function changes |
| --- | --- |
| Owned preference document and writer | Add `private.worker_work_preferences_document_v2(uuid)` and a bounded validator; add `public.rpc_get_worker_work_preferences_v2()` and `public.rpc_save_worker_work_preferences_v2(...)`, with captured owner, expected document hash and exact readback. Writer changes only its owned fields and uses the same profile-row lock as location/availability. Protect the new arrays and relevant booleans in `private.guard_worker_preference_authority()`; do not rely on an SDK allow-list. |
| AI source and initial value | Preserve V1 `private.worker_ai_source` / `_hash`; add V2 source/hash over the canonical profile, area, availability, new matching preferences and relevant WORKER notification document/revision. Add version-aware initial/document helpers. Preferences must be in the base hash before the model proposes them. |
| Review and persistence | Version-aware `private.worker_ai_patch`, `public.rpc_patch_worker_ai`, `rpc_prepare_worker_ai_review`, `rpc_save_worker_ai_review`, plus V2 entry facades. The final displayed digest includes the exact preference choices. V2 save validates all, locks all relevant authorities, writes profile + work preferences + explicitly reviewed notification choices atomically, then returns one receipt. Do not call separate client saves and show partial success as one saved profile. |
| Turn and recovery | Audit/version-dispatch `private.worker_ai_document`, `worker_ai_turn_recovery_v5`, `rpc_open_worker_ai`, `rpc_read_worker_ai`, `rpc_read_worker_ai_context_service`, `rpc_claim_worker_ai_turn_service`, `rpc_complete_worker_ai_turn_service`, `rpc_dispatch_worker_ai_turn_service`, `rpc_read_worker_ai_turn_recovery` and cancellation/abandon paths. In particular, provider dispatch and recovery currently compare the V1 source hash; changing only the final save is insufficient. Preserve existing leases, dispatch-once and request identity. |
| Matching consumers | Add one shared read-only preference predicate used by `private.match_detail_without_calendar` and `private.dispatch_cheap_candidate_admitted`; desired/declined/all-urgent checks are dispatch blockers only, with consistent outcomes. Keep `responseAllowed`, existing hard exclusions, tools/vehicles, calendar, prices and current ranking weights unchanged. `private.dispatch_next_wave` should continue through those existing consumers, not receive a second routing implementation. |

The existing preferences table still grants authenticated table writes under owner RLS; its current trigger protects location/timezone, not these booleans. Either strengthen the existing trigger for this exact writer or perform a separately reviewed ACL change. The proposed minimum is the existing trigger plus the bounded RPC; no broad new grant. A trigger/ACL change is part of the certificate gate below.

### Notification choices are not device permission

Today `worker_match_preferences.proactive_notifications` filters dispatch, while `public.notification_preferences` separately owns role-specific delivery (`opportunities_enabled`), push choice (`push_enabled`), quiet hours and `urgent_overrides_quiet_hours`. Both matching booleans currently default true; push defaults false. `private.emit_event` persists the domain event first and separately marks delivery channels created/suppressed. Turning delivery off does not erase the event or an existing opportunity.

Keep this separation visible and use the existing notification writer, not a second notification-preference table. In V2, the narrowly reviewed notification subset is `opportunitiesEnabled` and, only after explicit opt-in, `urgentDuringQuietHours` for WORKER. “Želim odgovarajuće zadatke i obaveštenja” may propose both proactive suggestions and the opportunity category, but both changes must appear in the frozen review. A mismatch with an existing channel setting must be explained, not silently changed. Keep the global push toggle, OS prompt, token registration and transport readiness in the existing device flow. A saved work preference must never be described as proof that push is enabled or delivered.

Reuse `public.rpc_get_notification_preferences(uuid,text)` / `rpc_set_notification_preferences(uuid,text,jsonb,bigint)`. Their existing exact settings shape and revision must remain compatible. The AI save must merge only its explicitly reviewed subset into the locked WORKER settings and preserve all other categories. Bind the relevant notification state/revision into V2 source hash and review, and reject a stale review if it changed meanwhile. Use the writer's existing `uskoci:notification-prefs:<account>:WORKER` advisory lock before reading/rechecking that state; document one consistent lock order with the profile/session locks and prove overlapping settings-save versus AI-save behavior. Merely hashing preferences without locking the independent writer does not prevent a stale overwrite.

### Client and Edge file boundary

Recommended existing files: `src/data/workerAiClientService.ts` (strict V1/V2 decoding and facades), `src/data/workerAiTurnIntentJournal.ts` (version-bound recovered intent), `src/app/(app)/profil/razgovor.tsx`, `src/ui/workerProfile/WorkerAiPresentation.tsx` (compact extracted preferences, individual corrections and complete review), `src/app/(app)/profil/radnik.tsx`, `src/ui/workerProfile/WorkerProfilePresentation.tsx`, `src/ui/profile/ProfileWorkSummary.tsx` (owned saved summary and AI entry), `src/ui/notifications/PushPreferences.tsx` and `src/app/(app)/profil/obavestenja.tsx` (honest matching-versus-channel status and links). Add one small typed `src/contracts/workerWorkPreferences.ts` and owned RPC adapter only if existing service reuse would obscure authority. Do not route these preferences through `workerProfileClientService`'s direct profile-table patch.

`supabase/functions/uskoci-worker-interview/index.ts` must select schema/prompt/parser by the server's stored contract version. V2 should distinguish ability from desired work, accept negative preferences only in their actual scope, ask one useful question at a time, ask urgent/notification choices without implying consent, and stop at the existing final review. It still proposes only; SQL owns persistence and matching. Keep the current paid-provider, budget, dispatch and diagnostics scope unchanged. A version added only to the TypeScript decoder or prompt is not this contract.

### Export, erasure and certificate gates

Export is allow-listed, not automatic. Current `private.data_export_snapshot` omits canonical matching preferences; `private.data_export_worker_candidate_v5` discards unknown preference keys from AI drafts/reviews. Extend the existing `profiles` export dataset with an owned nested `workPreferences` field and extend the draft/review candidate projection by version. This avoids a new dataset and can preserve the current **52-dataset** inventory. Update `private.data_export_dataset_catalog`, `private.data_export_snapshot`, `private.data_export_worker_candidate_v5` and their exact projection binding together.

`private.data_export_projection_sha_v5()` pins those bodies. `private.data_export_policy_binding()` currently requires `OWN_ACCOUNT_V5_10`, its projection SHA, the exact delivery content SHA and dataset field selections. A projection change therefore needs a separately reviewed forward export version/binding refresh in the existing retention policy, including the new selected field. Do not change privacy text, legal attestation or retention durations incidentally, and do not fake export readiness by changing only one hash. Previously frozen export artifacts retain their original projection identity.

Erasure already deletes `public.worker_match_preferences` and replaces the entire `private.worker_ai_sessions.candidate` / `private.worker_ai_reviews.envelope`, subject to existing holds. These new fields should follow those paths. Do not create a sidecar outside that inventory or change the hard-exclusion erasure behavior. Verify new canonical values and V2 review/draft values are actually removed by the existing paths.

Two closure digest boundaries necessarily move: `private.closure_schema_digest_v5_139()` includes public/private table columns, constraints and trigger definitions/bodies; `private.closure_erasure_program_digest_v5()` includes table ACL/RLS, trigger state and the trigger functions of redacted relations. New columns/session version change the former; strengthening the existing preference trigger changes the latter. `private.closure_source_digest_v5()` incorporates both. `private.retention_ai_source_ready()` pins the complete source digest (read at review time: `3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23`), and both `private.closure_source_v5` and `private.closure_erasure_source_v5` must match the newly admitted program. **This package cannot be certificate-neutral like WPP01.** It requires an isolated exact recertification proposal and the separate explicit certificate decision, plus a compatible APK rollout. Fresh metadata must replace these review-time pins before a candidate is generated.

### Bounded proof and rollout order

1. Freeze the V2 fields, canonical-kind semantics, all-HITNO fallback and version transition above. Capture exact current functions/columns/ACLs/export bindings and write one forward candidate/revert with explicit delta accounting; preserve WPP01 postimages.
2. On the established disposable chain, prove V1 unchanged reads/saves/receipt replay, V2 strict decoding, owner isolation, no direct-write bypass, no hidden retired-field writes and no unsupported fine-grained routing claim. Prove profile/preferences/review commit atomically, including actual overlapping settings-save and AI-save sessions, missing preference-row creation, stale review refusal and unknown-outcome recovery. No paid provider is needed for these contract proofs.
3. Prove desired/declined canonical-kind cases on detailed and cheap matchers; decline wins; empty preferences preserve baseline; manual responses stay allowed absent an existing hard blocker; hard exclusions still block both. Prove all urgent schedule kinds against null/true/false, the legacy same-day flag, availability, category delivery switches and quiet-hour override. Test event/delivery outcomes on synthetic rows, not a real push.
4. Prove canonical + draft/review export, old export binding refusal until the exact new binding, erasure/holds, both changed digests and the full admitted closure readiness. Verify exact revert limits, particularly existing V2 drafts and saved preferences; do not drop their data in a rollback.
5. Ship a client that understands both versions and the upgrade/recovery boundary; build and visually check the interview → complete review → saved profile → notification settings flow on the emulator. Apply the reviewed DB/certificate/export bundle only within its separately authorized window, then deploy the narrowly version-aware Edge and verify byte-exact readback before enabling V2 entry. Calls already in flight may finish old bodies; keep the existing serialized deployment discipline.
6. Any real provider conversation or one-device push observation is a separate bounded evidence step under its existing approval. Passing this contract proof does not assert real push delivery, whole-app completion or store readiness.

## Control publication attempt

Late CI reconciliation: P5 run37141652015 (initial4081) failed one outdated source assertion that still required licenses/team in the provider allow-list;193 other focused cases passed. The corrected contract test distinguishes the seven-field provider proposal from the compatible nine-field V1 SQL envelope, inventories the exact WPP01 candidate/revert/postflight files, and labels the older baseline pins as historical. Its50 local cases pass. No runtime/Edge/SQL artifact changed in this follow-up; the95a99 APK evidence remains applicable. Fresh P5 CI result is recorded below when complete.

Local62-row registry, generated dashboard and LIVE projection are refreshed. Existing owner artifact was opened at its established URL; it still showed2026-10-02/b2fa3f60. Both the accessible upload control and its observed input[type=file] reached a file-chooser timeout in the in-app browser; no file was transferred and no shared-storage success occurred. Publication remains pending. No new dashboard, sharing change or Claude message was created.
