# EX-09 (Javna verzija: PROD, oba builda, forme, review i operativa) - canonical scope check, 2026-10-01

**Status: SCOPE RECORD ONLY (a documentation package, NOT EX-09 progress). Nothing was applied to DEV or PROD, no paid call, no account, no console action, no dependency, no code changed. DEV was not queried by the workflow.**
Levels (LIVE plan 4.2): SOURCE no change | CI no | DEV-APPLIED no | CLIENT-WIRED no | DEVICE no | RELEASE no (release is NOT READY: 0 of 62 flows DONE, no PROD project, no signed AAB, no iOS identity, no RC manifest).

Why this exists: EX-09 is ONE row of LIVE Master Plan section 5.4, a plan-proposed work unit with no scope record and no registry row; the owner's standing order is not to expand scope by assumption, so it is handled like EX-04 and EX-06 (a read-only canonical check first). In canonical order EX-09 is last: AGENTS.md 4.2 puts release preparation after UI/UX, and runbook 8.3(1) bars an RC freeze before P0-P7 and the owner-scheduled final privacy pass (EX-08) close. Only the plan 5.2/5.4 "side lane" (documentation, read-only checks, scripts, disposable-chain proofs) may run now.

## 0. How this was produced (provenance and limits)
* Workflow `canonical-scope-check-generic` (read-only), 7 areas (plan, release-docs, builds-signing-ios, legal-forms, ops, registry-blockers, owner-gates), each area's findings re-checked by an independent skeptic, then a completeness critic and a synthesizer; every agent ran on the parent model (Sonnet 5.5; Fable 5.1 was not used).
* **Limits of this run (stated, not hidden): 6 of 7 areas completed with 250 findings and 0 refuted; two agents were lost to an API outage (ECONNRESET): the mapper of the area `registry-blockers` (the 24 blockers, 24 store gates and 32 test steps of `docs/control/redovi.json`) and the skeptic of the area `plan`.** The synthesizer and the critic worked from the other areas and re-read the registry themselves; a resume of the same run fills the two gaps from cache. Treat statements about those two areas as lower-confidence until it runs.
* The skeptics partly corrected 16 findings (section 12). File names and line numbers are as cited by the agents; they were not re-verified one by one. Source text is not live behaviour. Raw result next to this file: `ex09/EX09_SCOPE_CHECK_WORKFLOW_RESULT_20261001.json`.

## 1. What EX-09 is
EX-09 "Javna verzija" is defined by ONE row of LIVE Master Plan section 5.4 (docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html, plain-data): PROD, both builds, forms, review and operations; precondition "accounts/toolchain/web texts are prepared earlier"; measure "one coherent release, J01-J22 and store controls". The plan says EX labels are work units inside the existing plan, not a tracker (output goes into existing control rows). I verified myself that git grep finds "EX-09" in no other file, and that docs/control/redovi.json `finalization` has ex04 and ex06 blocks but no ex09, so EX-09 has no scope record and no registry row (the EX-06 precedent EX06_CANONICAL_SCOPE_20261001.md has no EX-09 counterpart). The substance behind the row is traceable only through plan chapters 5.2, 15-21 and 24.3, runbook P7 and sections 8-9, AGENTS.md 3.1/4.x, and two 2026-09-30 documentation packages (docs/implementation/release-prep-20260930, legal-drafts-20260930) that no registry, plan, live-state or AGENTS file references. In canonical order EX-09 is last: AGENTS 4.2 puts release preparation after UI/UX, and runbook 8.3(1) forbids freezing a release candidate before P0-P7 and the final privacy gates (EX-08, owner-deferred) close. Today release is NOT READY (live-state: 0 of 62 flows DONE, store done null of 28, legal null of 20), there is no PROD project, no signed AAB, no iOS identity, no RC manifest, and DEV holds legal/retention/processor sets 0/0/0. Every PROD, account, signing, legal-text, price/payment, iOS, push and store-submit step is an explicit owner gate. What an engineer may do now is the plan 5.2/5.4 "side lane": documentation, read-only checks, scripts and disposable-chain proofs, with no DEV/PROD write and no console, account or paid-provider action.

## 2. Exit criteria (what "done" means, from the canonical text)
1. One frozen RC manifest (plan 20.1, runbook 9) ties one approved source snapshot, the exact backend environment/versions, and separate Android AAB and iOS archive artifacts with per-platform hashes/build numbers, flag states, known limits, J/gate results, public document versions, review access and rollback plan. No mixing of a rejected build's images, a new backend and an old APK.
2. J01-J22 (plan 19.2, runbook 7.2) each have a recorded result or a reasoned N/A, linked to the existing 32-step I01-I32 plan in docs/control/redovi.json (no third progress table); COVERED_IN_SPEC is not execution; an Android PASS is never an iOS PASS (plan 19.3).
3. Each applicable store control (APL/GPL/BOTH, 28 in plan 18.2-18.4) has evidence or a reasoned 'not applicable'; no PASS is invented for an area nobody can check; the registry store counter is evidence-based and mapped to the plan's 28 controls.
4. PROD (plan 17.4): the exact public environment is owner-approved, configuration checked, review/test data separated from real users (outside the TEST world), minimal operations working, restore/rollback limits known, and the public build does not depend on DEV secrets or a nonexistent provider. No PROD claim before a distinct PROD project (or an explicit formal promotion) exists.
5. Legal package (plan 16.4): public documents contain no internal Round/FAIL/donor notes or unfilled operator data; Privacy, Terms, UI, store answers and real processing do not contradict each other; versions are registered and acceptance proven; retention, export and closure have one executable contract.
6. Privacy gates (plan 15.4, runbook 8.3(1)): the two deferred privacy branches (d18e830a, 1ab01e78) are reconciled in the intended environment by the owner-scheduled final privacy pass (EX-08) BEFORE the RC freeze; store data declarations are provisional until then.
7. Operations minimum (plan 17.3, runbook 8.1(6)): a named moderation/support owner with a real intake channel, a way to see crash/ANR, failed commands, queue/cron lag, push failures and provider spend without collecting private messages, incident severity, rollback decision-maker and stop criteria defined BEFORE rollout.
8. Open release blockers are closed or explicitly dispositioned in the registry (at least B12 iOS, B13 legal/stores, B21 signing, B22/RNR-01), and every V1 surface has a disposition; any scope exclusion (iOS, voice, HITNO, push, written review) is an explicit owner decision made before UI/store copy changes (runbook 9).
9. The owner gives final authorization on the concrete packet; publication states are kept distinct (prepared, sent, reviewed, approved, published; plan 20.2); store review feedback is handled by the smallest sufficient correction with a new version/manifest and re-run of affected checks.
10. After public availability (plan 20.3, runbook 8.3(7)(9)): real download, new account, email, both AI flows, publish, application/Dogovor and push are verified in the release configuration, launch-watch checkpoints run, and an owner-facing summary lists what is released, deliberately unavailable and monitored. An AAB, TestFlight upload or store screenshots alone are not completion.

## 3. Already done (do not redo)
* Store identity decided and coded (SOURCE + guard tests only): package rs.uskoci applied only under EAS profile production; production profile = store AAB, remote credentials, autoIncrement; version 1.0.0, versionCode seed 35; pre-install hook admits only reviewed Android preview/production and has unit tests
  * Evidence: app.config.js lines 8 and 13; eas.json build.production; scripts/check-eas-preview.cjs lines 67-68, 77-78; scripts/__tests__/eas-preview-guard.test.ts. git diff e6490445..HEAD on these files is empty (two researchers). NOT proven by any build: EAS lists only two Android 'phone-test' builds (SDK 56, 2026-08-20), none for the current profiles.
* DEV baseline PROD must reproduce, applied on canonical DEV leqcwgzvjsxugfgzdmth (read-only live reads by two researchers 2026-10-01): ledger 219 (71 dev_alpha rows), closure certificate 58447d77 ready, B24 PT409 in 71 functions and none raising 40001, PKG-045b column privileges applied, 2 active cron jobs with 0 failures/24 h, 11 ACTIVE Edge functions, 3 private buckets, platform_payments off and price list 0 RSD
  * Evidence: docs/control/dev_snapshot.json (ledger_total 219, cron_failures_24h 0); ops and legal-forms live queries; AGENTS 3.1.4 and 4.4. DEV facts only, not PROD.
* Documentation side-lane delivered 2026-09-30 (DRAFT, nothing entered in any console): release-prep-20260930 (8 files: 58-row config matrix, 28 store gates at 0 DONE, 15 owner inputs, listing, data-declarations, screenshot plan, review notes, J01-J22 tester cards) and legal-drafts-20260930 (12 LEG files + README, 113 [[...]] placeholders in the five public-text drafts)
  * Evidence: STORE_GATES_STATUS.md 'Zbir: 0 DONE, 14 NOT STARTED, 3 DRAFT EXISTS, 4 BLOCKED BY OWNER INPUT, 4 BLOCKED BY PRODUCT WORK, 3 N/A'; legal-drafts README banner. Written at e6490445/ledger 212 with 'Nothing was re-read live', so STALE (see conflicts). Not referenced from redovi.json, live-state, plan or AGENTS (grep count 0).
* Legal/consent mechanism exists in source and is schema-applied on DEV, with zero live executions: rpc_get_legal_bundle returns LEGAL_DOCUMENTS_NOT_PUBLISHED until active TERMS and PRIVACY rows exist; acceptance binds to both shown SHA-256 hashes; retention and processor registries have service_role publish RPCs, the legal registry has none
  * Evidence: supabase/migrations/20260908130000_clean_p1_legal_consent_ledger.sql (lines 30-31, 149); live DEV counts legal_document_versions 0, account_legal_acceptance_events 0, retention_policy_sets 0, processor_map_sets 0 (three independent reads). In-app Profil > Pravila i saglasnosti says documents are not published (src/ui/legal/LegalDocuments.tsx line 31).
* In-app safety/closure/export surfaces exist but are not release proof: report/block with 5 categories, support topics and operator inbox (singleton PRIVATE_TEST_OWNER_SUPPORT grant, 0 grants/0 cases/0 reports on DEV), closure entry in Profil > Privatnost, data-export client that says export is unavailable until retention rules are published
  * Evidence: src/ui/safety/SafetyScreen.tsx; supabase/migrations/20260913045824_clean_v5_support_case_authority.sql line 22; src/data/dataExportClientService.ts line 14; registry N06/N07/N08 only DELIMIČNO, N09/N10 open.
* DEV APK pipeline with artifact attestations (recovery redirect compiled into Hermes bundle, launcher icon) and a push-capable preview proof workflow; Android push delivery observed once on rs.uskoci.preview (2026-09-26, one device, one event, tap opened Inbox); exact-message transport deliberately OFF
  * Evidence: .github/workflows/build-android-dev-apk.yml (flags lines 33-42, attestations); scripts/ci/attest_recovery_redirect.py; PUSH_REAL_DEVICE_EVIDENCE.md; registry P03 DOKAZANO, P04 DELIMIČNO. Does not transfer to the store package or iOS.
* Effective iOS floor of installed dependencies read from podspecs: Expo SDK 57 modules declare iOS 16.4; React Native 0.86.3 declares min iOS 15.1 and min Xcode 16.1; React Native source defaults minSdk 24, targetSdk 36, compileSdk 36
  * Evidence: node_modules/expo-notifications/ios/ExpoNotifications.podspec lines 13-15; node_modules/react-native/scripts/cocoapods/helpers.rb lines 83-89; node_modules/react-native/gradle/libs.versions.toml. Source defaults only; no artifact checked; Apple/Google rule dates are secondary-doc text dated 2026-09-30.
* Voice B1 and EX-04 are applied on DEV (ledger 215-219) but client flags: EXPO_PUBLIC_VOICE_MESSAGES is off in every build; P6 reader and the three EX-04 paged flags are '1' only in the DEV APK workflow, absent from eas.json production
  * Evidence: .github/workflows/build-android-dev-apk.yml lines 37-42; eas.json production env (only two Supabase values); dev_snapshot.json voice_b1.client_flag (its ex04.client_flags 'OFF in every build profile' text is stale for the DEV workflow).

## 4. Gaps
### G01 - No EX-09 scope record and no registry anchor
* Canonical basis: Plan 5.4 ('Izlaz se beleži u postojećim kontrolnim redovima'); AGENTS 2.1-2.2 (single registry); precedent EX06_CANONICAL_SCOPE_20261001.md
* Current state: EX-09 appears only in the plan HTML (git grep, verified by me). redovi.json finalization has ex04 and ex06, no ex09; live-state has no EX key. Plan EX labels already drift from registry usage (plan EX-04 'B09 authority...' vs registry EX-04 personal lists). Overlap with EX-07 (safety/support/export/closure) and EX-08 (retention, privacy) is unassigned.
* Size: S | autonomous: True
* Evidence: git grep -il EX-09 -> only the LIVE plan HTML; redovi.json finalization key list printed above.

### G02 - No PROD project; the only organization is on the free plan
* Canonical basis: Plan 17.1; runbook 8.1(2)-(3); AGENTS 3.1.3
* Current state: Exactly one Supabase project (canonical DEV, eu-central-1, 'My Project') in org 'Uskoci labaratorija', plan free/tier_free (two independent live reads: ops and critic). OPEN_INPUTS speaks of a 'plaćeni Uskoci-clean projekat' (ambiguous, likely the Gemini key). Region, plan and backup tier for PROD are undecided; the free plan's backup facts are vendor-doc claims dated 2026-09-30, not re-verified.
* Size: L | autonomous: False

### G03 - No repeatable PROD promotion package; the 71 dev_alpha ledger rows are unclassified and mostly product behaviour
* Canonical basis: Runbook 8.1(2) ('reproducible schema/config promotion from frozen source plus proven candidates'); AGENTS 3.3.2, 4.4; plan 17.1
* Current state: Tracked supabase/migrations = 147 .sql (verified: git ls-files); supabase/candidates = 90 entries (verified). A raw ls shows 148 because the forbidden untracked migration 20260913090000 is on disk and not in the ledger. Critic's live count: ledger 219 = 148 non-dev_alpha + 71 dev_alpha; of the 148, 59 match source by name+version, 88 by name only, 1 (clean_notification_push_event_type) has no tracked source file. Replay proofs cover source147 only; source 20260830191500 is a recorded-statement reconstruction; pkg028a hard-codes the DEV Vault URL; Realtime publication comes from a DEV-only candidate; LEDGER_MANIFEST.json is stale (160 rows vs 219). Many candidates carry DEV predecessor-hash pins. No classification of which of the 71 rows PROD needs; 60+ carry product behaviour (pkg015/015b lineage and world boundary, price list, dispatch, closure, P6 v3, B24, Voice B1, EX-04).
* Size: L | autonomous: True
* Evidence: MIGRATION_PROVENANCE.json; MIGRATION_RECONSTRUCTION_PROOF.md; supabase/proofs/pkg023j/replay_source147.py ('not a claim of a full DEV164 replay').

### G04 - No pkg029e removal candidate (owner accounts sit in the TEST world on DEV)
* Canonical basis: AGENTS 4.6; RELEASE_CHECKLIST_GOOGLE_PLAY_20260923.md blocker 2; matrix C-14
* Current state: Only the apply file pkg029e_owner_in_test_world.sql exists; no revert/removal file (searched candidates names and text with several patterns). Live DEV account_visibility_world body still contains OWNER_PERSONAL. Pre-image body is the pkg015b ledger text, so an exact revert is easy to write. Timing matters: applying it flips the owner's QA accounts to REAL and ends TEST-world QA; on a brand-new PROD project pkg029e is simply not applied.
* Size: S | autonomous: True
* Evidence: supabase/candidates listing; candidate header ('must be taken out again before real users arrive'); live pg_proc read.

### G05 - Store profile, hook and build identity are pinned to the DEV project and to Android
* Canonical basis: Plan 17.1-17.2 ('realni backend target'); runbook 8.1(2), 8.2 'Android binary'
* Current state: eas.json production env carries the DEV project URL; scripts/check-eas-preview.cjs requires exactly that project and refuses any non-android platform; scripts/build-identity.cjs line 5 pins the same host; guard tests pin it. A DEV-backed store AAB is valid only for the owner's 2026-09-23 internal-test arrangement. Retargeting needs a project ref that does not exist.
* Size: M | autonomous: False

### G06 - Recovery redirect missing from the production profile; no AAB-side attestation
* Canonical basis: OWNER_INPUTS_NEEDED closing paragraph (engineering item); plan 17.2; precedent attest_recovery_redirect.py
* Current state: configuredRecoveryRedirect() returns null without EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL (src/data/passwordRecoveryLink.ts line 9). It is set in four CI workflows (dev-apk, push-proof, p6-native-apk, p6-round58) but not in eas.json production and not checked by the hook. Whether the EAS console 'production' environment already holds it is unknown. Callback allowlist in Supabase Auth is console-only.
* Size: S | autonomous: True

### G07 - Which compile-time flags the public build ships is undecided
* Canonical basis: Plan 20.1 (manifest lists flags); AGENTS 4.1 ('eas.json unchanged'); workflow comment (flags need the matching server packages on the target backend)
* Current state: P6 reader and three EX-04 paged flags only in the DEV APK workflow; VOICE_MESSAGES nowhere; a store AAB built from eas.json would ship legacy readers, no paging, no voice while voice is mandatory V1 (plan 3.1). Matrix C-20 and dev_snapshot ex04.client_flags are stale.
* Size: M | autonomous: False

### G08 - No signed AAB, no production EAS build, no RC (B21 OPEN); current EAS profiles never exercised
* Canonical basis: Runbook 8.2 'Android binary', 7.1 'Store release candidate'; plan 20.1; registry blokade B21, prodavnice 'Potpisan Android AAB' NIJE DOKAZANO
* Current state: EAS build list for project 1e6cc490 (two reads): exactly two Android builds, profile 'phone-test' (not in current eas.json), SDK 56, 2026-08-20. So the SDK 57 / RN 0.86.3 toolchain, the pre-install hook and the postinstall step have never run on EAS for preview or production. Upload key existence unknown (PROVERITI). A personal EAS project with build 34 and another certificate for the same application ID was recorded 2026-09-07 and was not queryable.
* Size: L | autonomous: False

### G09 - No release-artifact verification tooling (target API, 16 KB alignment, 64-bit libs, merged manifest, debug routes)
* Canonical basis: Runbook 8.2 'Android binary' and line 539 (DEV galleries excluded or inaccessible); plan 18.1 ('ne pretpostavljati da JavaScript testovi to proveravaju'), 17.2 Build row; matrix C-51/C-52
* Current state: git grep for zipalign, check_elf, bundletool, 16 KB, page-size in scripts/.github finds nothing; existing checks are APK-only (aapt badging package grep, recovery-redirect and launcher-icon attestations, apkanalyzer in push-proof). 16 tracked src/app/dizajn-*.tsx routes ship in every JS bundle behind runtime package/__DEV__ guards; a 17th local dizajn-pregled.tsx is excluded only by .git/info/exclude. Source defaults say targetSdk 36 but no artifact was checked.
* Size: M | autonomous: True

### G10 - No RC manifest / release-packet generator and no clean-source cut procedure
* Canonical basis: Plan 20.1; runbook 9 (release packet list incl. 'resolved branch disposition; clean source diff'); runbook 8.3(1)
* Current state: No manifest, no packet index (git ls-files for rc_manifest/release_packet empty). Hazards found: forbidden untracked migration on disk; machine-local .git/info/exclude files; package.json postinstall reads tracked docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html (a docs file is a hard build input, cleanup DOCS.md finding 4). dev_snapshot and live-state lag HEAD (live-state head c97be190 vs HEAD fb656a4e).
* Size: M | autonomous: True

### G11 - iOS absent end to end (B12 OPEN)
* Canonical basis: Plan 5.2 closing paragraph, 17.2, 20.1; runbook 8.2 'iOS binary'; registry blokade B12
* Current state: app.json has only ios.icon (still the Expo template assets/expo.icon); no bundleIdentifier, buildNumber, ITSAppUsesNonExemptEncryption, privacyManifests, supportsTablet (git grep 0); hook rejects non-android; no iOS EAS profile or workflow; iOS microphone text arrives via expo-image-picker although voice capture is Android-only. Which EAS image/Xcode serves SDK 57 against Apple's Xcode 26 rule is unverified. Plan wants the iOS build/smoke at the first approved shared native checkpoint after P6, not last.
* Size: L | autonomous: False

### G12 - Store package rs.uskoci has no Firebase client; push in V1 undecided
* Canonical basis: AGENTS 3.1.7; OWNER_INPUTS item 12; EX-06 owner gate 11/Q2; matrix C-36..C-38
* Current state: config/firebase/google-services.json holds only rs.uskoci.preview (project uskoci-ed59b); app.config.js deletes googleServicesFile for every other package; hook forbids the store bundle carrying the preview client; nativePushDevice.ts degrades to UNCONFIGURED (code-read only). Exact-message transport last recorded OFF; no flag value read since 2026-09-27 (transport flag since 2026-09-21).
* Size: M | autonomous: False

### G13 - Operator unregistered, legal texts unpublished, legal registries 0/0/0 (B13 OPEN)
* Canonical basis: Plan 16.1-16.4; AGENTS 3.4.5; OPEN_INPUTS AF-D10; runbook P7 item 8
* Current state: No operator data anywhere in the repository (LEG-01: 31 OP fields pending); 12 LEG drafts are technical drafts with 113 placeholders in the five public texts; plan sources L01 (owner-reconciled RC2 docx), L02 (release gates), L03 (data-flow truth) are not in the repo (their manifest 23.2 gives line counts and SHA-256 for L02/L03, so a supplied copy can be verified byte-exact). The RC2 that exists (2026-08-18) says NOT LEGAL READY.
* Size: L | autonomous: False

### G14 - No publication path for legal documents
* Canonical basis: Plan 16.3 (version/hash, legal bundle); N04 card 'kroz odobren backend postupak'
* Current state: private.legal_document_versions is a trusted registry where no client role can publish; no publish RPC exists (searched rpc_publish_legal, publish_legal, insert into private.legal_document_versions; only proof fixtures insert); kinds are TERMS and PRIVACY only (Community Rules/Complaints would be annexes or a new kind); each row needs a public HTTPS URL and SHA-256. Retention and processor registries do have service_role publish RPCs.
* Size: M | autonomous: False

### G15 - No acceptance gate; sign-up shows a 'test version' line
* Canonical basis: Plan card N04 step 4; owner decision 2026-09-21 (AGENTS 3.5.2); LEG-13 5.2
* Current state: No command checks account_legal_acceptance_events (searched LEGAL_ACCEPTANCE_REQUIRED and similar). Recorded RC2 reconciliation infers no new global signup/route gate, so when/what-on-refusal is an owner decision. auth.tsx line 389 text must be replaced on publication. Belongs to flow N04 (EX-07), not EX-09.
* Size: M | autonomous: False

### G16 - No public web: domain, Privacy/Terms/Support URLs, out-of-app account-deletion request page
* Canonical basis: Plan GPL-04/GPL-03; runbook 8.2 'Deletion'; LEG-08; registry prodavnice 'Zahtev za brisanje preko veba'
* Current state: No product domain in the repo (git grep of TLDs/mailto found only test strings); no web deletion path in src or supabase/functions (7 term search). Owner's Desktop has USKOCI-SAJT (Vercel-linked) and SAJT folders: unreferenced, not canonical, only listed (LOW-confidence lead). Cross-device closure recovery (N10) and disposable closure E2E are open.
* Size: L | autonomous: False

### G17 - Retention periods undecided; export blocked by policy (N09)
* Canonical basis: AF-D22 (OWNER_PRIVATE_TEST_DECISIONS_20260913); LEG-10 sec.6 (12 decisions); registry N09
* Current state: retention_policy_sets 0; export returns EXPORT_POLICY_NOT_READY until an active Privacy Policy and a retention schedule with export binding exist. Closure review depends on the certificate, not on the schedule (CLOSURE_POLICY_NOT_READY), and has 0 live executions. Owned by EX-07/EX-08 in the plan.
* Size: M | autonomous: False

### G18 - No moderation/support operator, channel or procedure (LEG-14 NOT-STARTED)
* Canonical basis: Plan 17.3, 13.3; runbook P7 item 5, 8.1(6); APL-06/GPL-06
* Current state: Report/block/support rows are written but nobody is named to process them; support operator grants are a PRIVATE_TEST_OWNER_SUPPORT singleton (0 grants live); NOTIFICATION_MATRIX has no operator alert; no filter on chat/profile text and no report control on the AI assistant (searched several names).
* Size: M | autonomous: False

### G19 - Operations minimum absent: monitoring/alerts, crash reporting, backups, OTA, budget alarms
* Canonical basis: Plan 17.3-17.4, 20.5; runbook 8.1(5)-(6), 8.3(7)-(8); matrix C-45..C-49, C-56
* Current state: package.json has none of sentry/crashlytics/bugsnag/datadog/expo-updates/expo-dev-client; only a UI AppErrorBoundary; no scheduled workflow among 139; no restore proof; Supabase plan free; AI test budget row has ceiling 5,000,000 microusd, reserved 14,194,455, cap enforcement off (owner request 2026-09-20), price_valid_until 2027-01-01 (paid AI then returns AI_TEST_BUDGET_NOT_READY). Existing cheap signals: cron.job_run_details, net._http_response (360 responses all 200), push readiness rows. Owner-history 2026-09-03: observability provider deliberately not selected.
* Size: L | autonomous: False

### G20 - Missing legal/store drafts: LEG-14, LEG-15, LEG-19, LEG-20 as one review package; LEG-16/17 only provisional
* Canonical basis: Plan 16.2; legal-drafts README index (NOT-STARTED rows); runbook 8.2
* Current state: No LEG-14/15/19 files; LEG-20 only partly covered by REVIEW_NOTES_DRAFT; Apple age rating / IARC answers not drafted; AI rows in DATA_DECLARATIONS are PROVISIONAL until EX-08; text-AI notice (LEG-12 N-01/N-02) is a proposal, Apple 5.1.2(i) risk.
* Size: M | autonomous: True

### G21 - Existing drafts and registry views are stale or inconsistent
* Canonical basis: AGENTS 1.4 (actual newer state wins); plan 18.4 (no invented PASS)
* Current state: Drafts cite ledger 212/e6490445: J07 'P6 reader not applied', J12 'voice not implemented', APL-10 'P6 otvoren', C-13 counts (147/74), C-20 flags, LEG-09 'PKG045b not applied' (applied 2026-09-30), LEG-04/09/10/12 'audio not stored' vs Voice B1. Registry prodavnice has 24 rows (not 23), all in the stanje_16_09 field but partly edited in place; row 'Android oznaka aplikacije' still BLOKIRANO though rs.uskoci is decided; README says 21 blockers/24 gates while blokade has 24 rows; plan counts 28 controls with no 1:1 mapping; blocker IDs B12/B13/B21 collide with flow IDs B12 etc.; plan static prose still says P6 open.
* Size: M | autonomous: True

### G22 - J01-J22 are not mapped in the registry and barely executed
* Canonical basis: Plan 19.2-19.3; runbook 7.2-7.3
* Current state: Only 11 of the 32 two-phone steps are marked executed, all from one R18 one-person remote/offers journey (blocker B09 says so). TESTER_SCENARIOS (draft) rates 8 RUNNABLE, 11 PARTIAL, 3 BLOCKED (J14 push, J17 export, J21 needs two builds on a test track); J22 needs a store-installed candidate. No J-to-I mapping exists in redovi.json (J ids only inside ex06). Needs two participants + a third approved probe account + a disposable closure subject; J-scenarios touching session/data/permissions need explicit owner OK on the HONOR.
* Size: M | autonomous: True

### G23 - REAL world has never been exercised; reviewer/test account supply undefined
* Canonical basis: Runbook 8.1(3); plan 19.3; P6_CLOSURE_RECEIPT limit L6 (QAD-04)
* Current state: Critic's live read: 5 auth users, all TEST (account_visibility_world); 36 needs, 8 agreements, 104 delivery rows; world-boundary proof 'prepared, not run'. Review/demo accounts must be pre-confirmed, outside the TEST world, credentials only in consoles; the AI is the only way to create a task, so reviewers need live paid AI.
* Size: M | autonomous: False

### G24 - Permission truth fails: microphone text vs hold-to-talk sends on release; iOS microphone declaration
* Canonical basis: AGENTS 3.6.3; LEG-12 N-03; STORE_GATES BOTH-01
* Current state: app.config.js line 43 says the message is sent only on Pošalji while default behaviour sends on release (in-app notice already corrected); iOS gets a microphone usage text through expo-image-picker though voice capture is Android-only. expo-audio (Voice B2) would change plugins and merged manifest (enableBackgroundPlayback default adds foreground-service permissions); nothing installed.
* Size: S | autonomous: False

### G25 - V1 scope questions that change store truth: HITNO, written review (D12), voice, P05
* Canonical basis: Plan 3.1, 3.2, card A16, P05; runbook 8.2 'Product truth', 9; D12_WRITTEN_REVIEW_DESIGN_20261001.md
* Current state: Voice B1 server/Edge applied on DEV, client flag off, B2 native/UI not started, iOS voice absent; HITNO off by policy on DEV; P05 reminder NOT IMPLEMENTED (blocked); D12 (owner wants a star-rating comment in V1) moves the closure digest and has no review report/hide/remove path; Apple 1.2 UGC rules apply if it ships.
* Size: M | autonomous: False

### G26 - Store forms cannot be final before the EX-08 privacy pass; closed-test ordering risk
* Canonical basis: AGENTS 4.5; runbook 8.3(1); plan 15.4, 16.3, 18.1, 5.4 ('Sa strane sada')
* Current state: Every AI-touching Data Safety/App Privacy answer is PROVISIONAL (d18e830a and 1ab01e78 not integrated; private exact_address/access_notes can enter AI context). Plan lets the closed test start with account+candidate, but a draft INFERS (not console-verified) that Google requires Data safety and a privacy URL for closed tracks too, putting operator data and a domain on the critical path before the 14-day count; the 12-tester/14-day rule applies only to personal accounts opened after 2023-11-13 and the exemption for organizations is INFER.
* Size: M | autonomous: False

### G27 - Production runtime switch states, test limits and AI admission model undecided
* Canonical basis: Matrix C-19, C-29, C-30; AGENTS 3.1.6; plan 17.4 (no new remote control just to hide an unverified feature)
* Current state: Seven fail-closed Edge flags with TEST names (USKOCI_GEMINI_PAID_TEST_ENABLED gates five AI functions); no production value decided and no value read after 2026-09-27; temporary media limits (120/24 h, 12/min); paid AI needs private.ai_test_accounts_v5 admission (3 active rows) so real users would get no AI without an owner-decided public admission/budget model; no general DB maintenance switch.
* Size: M | autonomous: False

### G28 - Accessibility/localization matrix, performance and scale limits unrun on the final UI
* Canonical basis: Runbook 8.2 'Accessibility/localization', 7.3, 9 (performance datasets); P6_CLOSURE_RECEIPT L4/L5/L6; registry 'Pristupačnost i brzina'
* Current state: Registry row NIJE DOKAZANO; L4 30,000-task scale gate fails at jit=off, L5 limited concurrency not run, L6 mixed-world proof prepared not run; EX-03 numbers are one phone, one account, quiet database; TaskCard/Peek visuals frozen until the UI/UX pass (AGENTS 4.2).
* Size: M | autonomous: False

### G29 - Auth/email and Edge/Auth console configuration is unreadable from the repo
* Canonical basis: Matrix C-22..C-24; registry N02; OWNER_INPUTS item 7
* Current state: No supabase/config.toml; Site URL, redirect allowlist, SMTP sender and domain are console-only; Supabase built-in mail serves team members only at 2 per hour (vendor claim); advisor: leaked password protection disabled, 170 authenticated-callable SECURITY DEFINER functions (plan 15.3 asks for a compatible package, not a mass revoke); N02/J02 only PARTIAL.
* Size: M | autonomous: False

### G30 - Source-of-truth conflict on RNR-01 / B22 and a few smaller stale statements
* Canonical basis: AGENTS 1.1 (latest explicit owner decision wins); registry B22; EX03_CLOSURE_RECEIPT line 41
* Current state: B22 'sada' (verified by me) says OTVORENO and 'Ostaje vlasnikova odluka o zavisnosti ... blokira izlazak'; the later EX03 receipt says the owner decided 2026-09-30/10-01 not to introduce patch-package and that it reopens only on a concrete reproduced crash/ANR/UX problem. Flood is reduced, not zero (HONOR: 37,135 -> 5,956 -> 2,811 failed lines, 0 ANR); Play vitals thresholds (crash 1.09%, ANR 0.47%) apply after release.
* Size: S | autonomous: False

## 5. Disagreements between sources (and the proposed resolution)
1. **RNR-01 / B22: open owner decision that blocks release (registry B22, AGENTS 4.2) vs owner decision not to introduce patch-package (EX03 closure receipt). Three area reports carried the older side.**
   * Sources: docs/control/redovi.json blokade B22; AGENTS.md 4.2; docs/implementation/product-v1-closure-20260926/finalization-20260927/EX03_CLOSURE_RECEIPT_20261001.md line 41 (all three read by me)
   * Proposed resolution: Per AGENTS 1.1 the later explicit owner decision wins: do not list RNR-01 as an open owner gate; keep it as a monitored limit that reopens on a reproduced crash/ANR/UX problem. Ask the owner one confirming line, then update B22 and AGENTS 4.2 together (registry edit, no code).
2. **'Oba builda' / 'obe dogovorene platforme' (EX-09 row, plan 20.1/20.3) vs iOS-in-first-release still open (OWNER_INPUTS item 3, registry B12 and iOS bundle-id rows).**
   * Sources: Plan 5.4 and 20.3; OWNER_INPUTS_NEEDED item 3; registry blokade B12, prodavnice 'iOS oznaka aplikacije'
   * Proposed resolution: Treat the platform set as unconfirmed; the scope record must carry two variants (Android only / Android+iOS) until the owner answers. APL-01..12 and the iOS parts of J14/J22 are in scope only in the second.
3. **Free 0 RSD launch (plan 3.2, LEG-02, OP-31, PKG-051 price list at 0, platform_payments off) vs 'owner requires paid connection-service monetization before the first public release' (APP_FINISHING_PLAN 2026-09-22; registry prodavnice 'Plaćanje'). No later owner statement found.**
   * Sources: Plan 3.2 and 20.3; APP_FINISHING_PLAN_20260922.md section 1 line 16; redovi.json prodavnice 'Plaćanje'; LEG-01 OP-31
   * Proposed resolution: Do not assume either. Store copy/Terms/APL-11/12 stay parameterised on the answer; ask the owner for one explicit word (money/prices are owner-only).
4. **Which RC2 is the legal base: plan card N04/L01 calls an owner-reconciled 2026-09-10 DOCX an approved baseline (incl. 18+ and 0 RSD); the DOCX is not in the repo or on the Desktop; the RC2 that exists (2026-08-18) says NOT LEGAL READY; AUTHORITY_INDEX (2026-09-11) says exact approved text not recovered; AGENTS 1.3.7 says RC2 content was received.**
   * Sources: Plan N04 card and source card L01; AUTHORITY_INDEX.md line 35; legal-drafts README section 1; AGENTS.md 1.3.7
   * Proposed resolution: Do not re-request the RC2 package (AGENTS: old missing-package requests are historical). Keep drafts on the 08-18 master, flag them as unreconciled against L01, and ask the owner only whether L02/L03 exist or whether plan tables 18.2-18.4 are the accepted base.
5. **Store/blocker counts disagree: plan and live-state 28 controls; registry prodavnice 24 rows (counted by me; critic: partly edited in place, not purely 16.09); README '21 blockers, 24 gates' while blokade has 24 rows (counted by me); no 1:1 mapping. Blocker ids B12/B13/B21 collide with flow ids B12 etc.**
   * Sources: master-plan-live-state.json release; docs/control/README.md lines 8-10; redovi.json prodavnice/blokade
   * Proposed resolution: Refresh in place in the single registry (no new tracker): namespace blockers (e.g. blocker B12 vs row B12), add a control-id mapping to the 28, and update stale rows with evidence (S00).
6. **Migration provenance arithmetic: reports say '148 source migrations'; tracked source is 147 (verified); the 148th .sql on disk is the forbidden untracked migration, absent from the ledger; ledger 219 = 148 non-dev_alpha + 71 dev_alpha but only 59 match source by name+version.**
   * Sources: git ls-files supabase/migrations; runbook section 1 (do not commit 20260913090000); critic live ledger read; MIGRATION_PROVENANCE.json
   * Proposed resolution: Use git ls-files, never a folder glob, for any promotion package or RC; reconcile name/version aliases explicitly in S04.
7. **Is the PROD promotion package 'autonomous'? One report says yes; another shows the route is undecided and replay does not reproduce DEV; binding rules forbid PROD writes without cost approval and 'primeni'.**
   * Sources: AGENTS 3.1.3, 3.1.8, 3.3.2; runbook 6 step 6 and 8.1(2)
   * Proposed resolution: Autonomous means authoring plus disposable-chain equivalence proof only; any write to a PROD project is an owner gate.
8. **Microphone permission text (send only on Pošalji, 2026-09-13 era) vs hold-to-talk sends on release (owner 2026-09-23).**
   * Sources: app.config.js line 43; AGENTS 3.6.3; OPEN_INPUTS line 33; LEG-12 N-03
   * Proposed resolution: The later owner rule wins; the text change is still an owner-approved permission text.
9. **Legal drafts say audio is never stored (AF-D02) vs Voice B1, applied to DEV 2026-10-01, which stores user voice messages (flag off).**
   * Sources: Voice B1 receipt notDone[2]; LEG-09/10/12; VOICE_B1_B2_PLAN line 26
   * Proposed resolution: Write voice-branch variants of LEG-04/09/10/12 and Data Safety rows; choose when voice scope is decided.
10. **Plan chapter prose (29.09) still says P6 open and 'STOP after P6'; live-state/AGENTS say P6 closed with limits 2026-09-30; live-state itself lags HEAD; dev_snapshot ex04.client_flags 'OFF in every build' predates commit bf48a5db (DEV workflow turns EX-04 flags on).**
   * Sources: Plan chapter 0 and 24.3; AGENTS 4.1; master-plan-live-state.json source.head; dev_snapshot.json; build-android-dev-apk.yml
   * Proposed resolution: AGENTS 4.1 and the live-state win; regenerate the projections (osvezi scripts) and read flag state only from workflow/eas.json when building the RC manifest.
11. **Closed-test timing: plan 5.2/18.1 start the test with an account and a usable candidate; a draft infers Google needs Data safety and a privacy URL for closed tracks too.**
   * Sources: Plan 5.2, 16.3, 18.1; STORE_GATES_STATUS.md section 7 item 2 (labelled INFER)
   * Proposed resolution: UNVERIFIABLE without the Play Console; the owner reads the console before scheduling. Do not claim either.
12. **Overlapping ownership: EX-07 (auth/safety/support/export/closure), EX-08 (retention periods, two privacy branches) and EX-09 (forms, review, operativa) all touch moderation operator, email sender, retention, export, closure web path, store data declarations.**
   * Sources: Plan 5.4 rows EX-07/08/09; runbook P7 items 5 and 8; plan 'Redosled bez dvostrukog zatvaranja'
   * Proposed resolution: The EX-09 scope record assigns each shared item to exactly one unit: consent gate, export gating, retention, closure web path -> EX-07/EX-08; store data declarations, review notes, release packet -> EX-09.
13. **EX label drift: plan EX-04 'B09 authority, projekcije, pun P2 lifecycle' vs registry/AGENTS EX-04 = personal-list paging (A09/B10/A11); EX-06 was narrowed by its scope record.**
   * Sources: Plan 5.4; AGENTS 4.3; EX06_CANONICAL_SCOPE_20261001.md
   * Proposed resolution: Same treatment for EX-09: read scope from the record, not from the one plan row.
14. **Supabase organization on the free plan (two live reads) vs OPEN_INPUTS 'plaćeni Uskoci-clean projekat'.**
   * Sources: get_organization result; OPEN_INPUTS.md lines 44-45
   * Proposed resolution: Treat plan tier as free until the owner states otherwise; any 'internal track over DEV' or review-period uptime claim must disclose it.
15. **AF-D26 sentence 'do not ask again or create a new paid project' could be misread as covering PROD; AF-D16 (email-only auth) and the AF-D decisions are scoped to the private-test cycle.**
   * Sources: OWNER_PRIVATE_TEST_DECISIONS_20260913.md AF-D26 lines 15-19; OPEN_INPUTS line 37; plan 17.1
   * Proposed resolution: AF-D26 covers canonical DEV only; PROD project/cost stays a separate decision; AF-D16 is an inherited constraint (no social login/Sign in with Apple) that the owner should re-confirm for public release.
16. **expo-audio: AGENTS 'approved CONDITIONALLY'; decision record says compatibility condition checked and compatible, nothing installed; no statement that installation is now authorized.**
   * Sources: AGENTS.md 3.1.5; VOICE_AUDIO_STACK_DECISION_20260930.md
   * Proposed resolution: Ask for one clear word before Voice B2 or the permission/manifest freeze depends on it.

## 6. Proposed slices (work units; all inside the single 5.4 row)
### EX09-S00 - EX-09 canonical scope record and registry anchor
* Scope: Write an EX-09 scope record in the finalization-20260927 folder in the EX06_CANONICAL_SCOPE format and add a finalization.ex09 block to redovi.json (inputs, owner gates, not-in-scope, open questions). Map each shared item to exactly one EX unit (EX-07/08/09), map J01-J22 to I01-I32, map the 24 registry store rows to the plan's 28 controls, namespace blocker ids vs flow ids, correct registry rows that evidence already contradicts (e.g. package id decided, iOS/store rows), register release-prep-20260930 and legal-drafts-20260930 as inputs. Documentation and registry only.
* Canonical basis: Plan 5.4 ('Izlaz se beleži u postojećim kontrolnim redovima'); AGENTS 2.1-2.2; precedent EX06_CANONICAL_SCOPE_20261001.md; legal-drafts README section 5 (proposed annotations, not applied)
* Deliverables: EX09_CANONICAL_SCOPE_<date>.md; finalization.ex09 in redovi.json; refreshed docs/control views via the two osvezi scripts
* Proof plan: Every statement cites file+locator; run node scripts/control/osvezi.mjs and osvezi-master-plan.mjs (--html ... then --check) clean; diff shows only docs/control and docs changes; no code, no DEV call; skeptic re-read of quotes (<=25 words).
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: None for the document; its content branches on the owner answers about iOS, free vs paid launch and PROD topology (carried as variants, not assumed).
* Not in scope: Any status upgrade without evidence; new tracker; PASS counters; scope beyond plan/runbook/AGENTS.

### EX09-S01 - Refresh the 2026-09-30 release-prep and legal drafts to current HEAD and DEV
* Scope: Re-read repo and (read-only) DEV and update stale statements: ledger 219, 147 tracked migrations/90 candidates, 3 buckets, P6 closed, Voice B1 applied/flag off, EX-04 flags, J07/J12/APL-10, C-13/C-20, LEG-09 PKG045b applied, voice-branch variants of 'audio not stored'. Add a dated re-read stamp to each draft; keep DRAFT banners and placeholders.
* Canonical basis: Plan 5.2 and 5.4 'Sa strane sada'; AGENTS 1.4 (actual newer state wins); plan 18.4
* Deliverables: Edited drafts under docs/implementation/release-prep-20260930 and legal-drafts-20260930 with a change list
* Proof plan: Per-claim verification table (claim, file/query, result); read-only SELECT/catalog queries only (counts and catalog, no personal content); git diff limited to docs.
* Autonomous: True | needs the phone: False | depends on: EX09-S00 (preferred, not required)
* First owner boundary: Console facts (Play, Apple, EAS, Firebase, Auth settings, Edge env values) cannot be read here and stay marked PROVERITI.
* Not in scope: Entering anything in a console; filling operator data; claiming any gate PASS.

### EX09-S02 - Release-artifact audit script and CI step (target SDK, 16 KB, ABIs, merged manifest, debug routes, recovery redirect)
* Scope: Add a script (pattern: scripts/ci/attest_recovery_redirect.py) that inspects an APK/AAB: target/min SDK, 64-bit libs, 16 KB page alignment of native libraries, merged-manifest permissions/allowBackup/cleartext, presence and inertness of dizajn-* routes for non-.dev packages, recovery redirect compiled in. Run it in CI on the APK the DEV workflow already builds (no download) and, if feasible with Android SDK tools already on the runner, on a Gradle-built audit-only bundle labelled non-release.
* Canonical basis: Runbook 8.2 'Android binary' and line 539; plan 18.1 ('ne pretpostavljati da JavaScript testovi to proveravaju'), 17.2 Build row; matrix C-51/C-52; STORE_GATES GPL-01/GPL-07
* Deliverables: scripts/ci/audit_release_artifact.* plus unit tests with fixtures; workflow step; sample report
* Proof plan: Unit tests (fail-closed, mutated fixtures fail); one exact-source Linux CI run on the DEV APK; report states it audits the DEV APK, not a store AAB. No new repo dependency.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: Running it on the real signed AAB needs the owner's EAS build; the audit-only bundle must never be called a release artifact.
* Not in scope: Producing or signing a store AAB; compiling dizajn routes out (not a canonical decision, see notCanonicalProposals); any new dependency.

### EX09-S03 - Recovery redirect in the production profile with hook check and tests
* Scope: Add EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL (uskociapp://oporavak) to eas.json production env, make check-eas-preview.cjs fail closed when it is missing for production, extend guard tests. Backend target and flags unchanged.
* Canonical basis: OWNER_INPUTS_NEEDED closing paragraph (listed as engineering); plan 17.2; src/data/passwordRecoveryLink.ts line 9; workflow comment lines 29-33
* Deliverables: eas.json and hook diff, tests in scripts/__tests__/eas-preview-guard.test.ts
* Proof plan: Offline Jest guard tests (admit with variable, refuse without); full CI on exact commit; no EAS build.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: Console 'production' environment variables and the Supabase Auth allowlist are the owner's; whether the console already holds the variable cannot be read here.
* Not in scope: Changing the Supabase URL, adding P6/EX-04/voice flags, building.

### EX09-S04 - Migration provenance reconciliation and classification of the 71 dev_alpha rows
* Scope: Read-only: reconcile 147 tracked source vs ledger 219 by name/version/alias (59 / 88 / 1 per critic, to be re-derived), list files on disk not in git (forbidden migration), classify each dev_alpha row as PRODUCT (needed on PROD), DEV_OPERATOR_METADATA or ENVIRONMENT, and list the objects that live only in ledger texts (Realtime publication, Vault URL, account-lineage world boundary).
* Canonical basis: Runbook 8.1(2); AGENTS 3.3.2; PKG015_PROMOTION_PLAN_20260917.md (DEV-only metadata category); pkg015b ('a future production project must carry the same rule'); LEDGER_MANIFEST.json (stale)
* Deliverables: Classification table and provenance report under docs/implementation, regenerated manifest
* Proof plan: Read-only catalog/ledger queries plus git ls-files; table reproducible by script; every row cites its ledger name and receipt.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: None for the read-only table; the owner's PROD topology decision chooses which classification drives a build.
* Not in scope: Any DB write, applying or reverting anything, rewriting an applied migration.

### EX09-S05 - PROD promotion package and disposable-chain equivalence proof
* Scope: Using the S04 table, generate an ordered, parameterised promotion package (source147 + product candidates/ledger texts in applied order, project URL/Vault/Realtime parameterised, pkg029e omitted, B24 and Voice B1 included in order, per-package certificate re-bind plan with PROD's own certified digest) and prove it on a disposable CI chain: catalog/surface diff against DEV (ENVIRONMENT-only differences listed), fail-before/pass-after proofs. Generated candidate + exact revert + read-only postflight, the EX-04 pattern.
* Canonical basis: Runbook 8.1(2), 8.3 and section 6 step 6 (recorded dev_alpha procedure, no new mechanism); AGENTS 4.4, 4.6, 3.1.4; plan 17.1
* Deliverables: Package generator, ordered SQL, exact revert, postflight SQL, CI proof workflow and report
* Proof plan: Exact-source Linux CI run on a disposable local Supabase; surface diff vs DEV catalog (read-only); proofs for B24 PT409, certificate binding, world boundary (REAL vs TEST), Realtime publication; kept failed attempts per AGENTS 3.2.5.
* Autonomous: True | needs the phone: False | depends on: EX09-S04
* First owner boundary: PROD topology/cost decision and the exact 'primeni' before any write to a PROD project; creating the project and its Vault/Edge secrets (worker key, Gemini, LocationIQ, flags) are owner steps; Edge deploy must be byte-exact (owner CLI).
* Not in scope: Any DEV or PROD write; creating a project; Edge deployment; certificate application on a live project.

### EX09-S06 - pkg029e removal candidate with exact revert and disposable proof (conditional on formal promotion of DEV)
* Scope: Generate a function-body-only candidate that restores private.account_visibility_world to the pkg015b pre-image (owner accounts REAL), with exact revert (current pkg029e body), read-only postflight, disposable fail-before/pass-after proof and an assertion that the closure digest does not move.
* Canonical basis: AGENTS 4.6; RELEASE_CHECKLIST_GOOGLE_PLAY_20260923.md blocker 2; matrix C-14; NEXT_AI_HANDOFF_20260921_2145.md section 5.5 item 5
* Deliverables: supabase/candidates/pkg029f_*.sql (name to follow convention), revert, postflight, proof workflow
* Proof plan: Disposable chain with TEST/REAL fixture accounts; asserts function body hash, digest unchanged, P6 TEST set follows; nothing against DEV.
* Autonomous: True | needs the phone: False | depends on: EX09-S05 route decision (moot on a brand-new PROD project where pkg029e is never applied)
* First owner boundary: 'primeni' AND timing at cutover: applying on DEV flips the owner's accounts to REAL and ends TEST-world QA.
* Not in scope: Applying it; deleting any account or data; reviewer-account design.

### EX09-S07 - RC manifest and release-packet generator, fail-closed, with a clean-source guard
* Scope: Script that emits the plan 20.1 / runbook 9 manifest from inputs: source commit/tag, clean-tree and untracked-file check (refuses when the forbidden migration or local-only excludes would influence the cut), tracked-file list for the postinstall docs input, per-platform artifact hashes/build numbers, flags from eas.json/workflow, DEV/PROD config identity, ledger/candidate hashes, Edge versions, J/gate result links, public document versions, review access, rollback plan. Every missing input prints NOT PROVIDED and the manifest can never self-label READY.
* Canonical basis: Plan 20.1; runbook 9 and 8.3(1); AGENTS 3.2.4 (acceptance only from exact receipt); cleanup DOCS.md finding 4
* Deliverables: scripts/release/rc_manifest.* with tests and a template packet index
* Proof plan: Unit tests with fixtures (missing field fails, dirty tree fails); dry run against HEAD producing a manifest full of NOT PROVIDED; offline mode needs no DEV access.
* Autonomous: True | needs the phone: False | depends on: EX09-S00 (J/gate mapping); EX09-S02 for the audit field
* First owner boundary: Real hashes need artifacts built with the owner's EAS login; the owner authorizes the concrete packet.
* Not in scope: Tagging or freezing an RC (runbook 8.3(1) needs P0-P7 and EX-08 closed); claiming release readiness.

### EX09-S08 - J01-J22 linkage into the existing 32-step plan, account and phone requirements
* Scope: Add J01-J22 links to the I01-I32 plan in redovi.json (no third table): per J its I-steps, control rows, required accounts (two participants, third probe, disposable closure subject), device (HONOR/emulator/iPhone/store install), owner-OK actions (session, permissions, installs), paid-AI need, current status RUNNABLE/PARTIAL/BLOCKED with the blocking item; refresh TESTER_SCENARIOS accordingly. No execution claims.
* Canonical basis: Plan 19.2-19.3; runbook 7.2-7.3; AGENTS 3.2.1, 3.1.6, 3.1.8
* Deliverables: redovi.json J mapping; refreshed TESTER_SCENARIOS.md
* Proof plan: Docs/registry only; osvezi scripts clean; every J row cites runbook 7.2 text.
* Autonomous: True | needs the phone: False | depends on: EX09-S00
* First owner boundary: Executing any J on the HONOR needs his window and per-action OK; creating accounts is a state-changing DEV action needing his word.
* Not in scope: Running scenarios; marking any J PASS.

### EX09-S09 - Operations and launch runbook drafts with read-only monitoring queries
* Scope: Draft: minimum operations checklist (plan 17.3 signals: crash/ANR via store consoles, failed commands, API/Edge latency, queue/cron lag via cron.job_run_details and net._http_response, push readiness, AI spend, stuck export/closure jobs) as saved read-only SQL plus a manual review routine; incident severity, rollback decision-maker and stop criteria template; rollback matrix (existing exact reverts, flags, cron.unschedule, recompile without a client flag); launch-watch checkpoints; review-rejection loop; post-launch verification scenario; owner summary template; backup/restore decision options. Monitoring must not collect private messages.
* Canonical basis: Plan 17.3-17.4, 20.2, 20.5, 24.3 ('Review odbijen'); runbook 8.1(5)-(6), 8.3(6)-(9)
* Deliverables: docs/implementation/release-prep-.../OPERATIONS_AND_LAUNCH_RUNBOOK_DRAFT.md and a queries file
* Proof plan: Each query dry-run read-only on DEV (counts only, no personal content); every procedure cites the plan/runbook clause; marked DRAFT.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: Named responsible person and channel, choice of tooling (possible new dependency), budget alarms and backup plan are owner decisions; scheduled alerts would be state-changing.
* Not in scope: Installing a crash SDK or OTA; scheduling jobs; designing a new remote control (plan 17.4 forbids it); staged rollout assumptions.

### EX09-S10 - Missing legal and store drafts: LEG-14, LEG-15, LEG-19, LEG-20 review package, refreshed LEG-16/17
* Scope: Draft LEG-14 (moderation/support procedure and J16 scenario), LEG-15 (rights/export procedure), LEG-19 (age/content/audience questionnaire pre-answers for Apple age rating and IARC), assemble LEG-20 (review package: notes, access, walkthrough, truth checklist), refresh DATA_DECLARATIONS_DRAFT with ONLY-IF-SHIPPED and AI rows PROVISIONAL. Placeholders for operator data; no retention periods, no legal conclusions, no invented operator details.
* Canonical basis: Plan 16.2 (LEG-14/15/16/17/19/20); runbook P7 item 8, 8.2; legal-drafts README index; AGENTS 3.4.5
* Deliverables: Draft files under legal-drafts-20260930 / release-prep-20260930
* Proof plan: Every statement cites code or a plan clause; placeholder count reported; skeptic read for invented facts.
* Autonomous: True | needs the phone: False | depends on: EX09-S01
* First owner boundary: Operator identity, retention, legal basis, countries/age and counsel review; final store answers wait for EX-08.
* Not in scope: Publishing, entering anything in a console, legal advice, choosing countries/age.

### EX09-S11 - iOS read-only toolchain and minimum-version review plus iOS config proposal
* Scope: Read-only review: effective iOS floor from podspecs (16.4 found), RN 0.86.3/Expo SDK 57 requirements, which app.json/app.config.js keys an iOS build needs (bundleIdentifier, buildNumber, ITSAppUsesNonExemptEncryption, privacyManifests, supportsTablet, brand icon vs expo.icon template), what the hook would have to allow. Proposal document only; no edits to build config.
* Canonical basis: Plan 5.2 closing paragraph and row 'Produkciona priprema' ('read-only iOS/toolchain provera'); STORE_GATES APL-01 'Može bez vlasnika'; runbook 8.2 'iOS binary'
* Deliverables: IOS_TOOLCHAIN_REVIEW.md
* Proof plan: Cite podspec/helper file lines; flag EAS image/Xcode 26 question as UNVERIFIABLE here.
* Autonomous: True | needs the phone: False | depends on: none
* First owner boundary: iOS-in-V1 decision, bundle id (OP-40) and Apple account.
* Not in scope: Editing app.json/eas.json for iOS, any build, any Apple account action.

### EX09-S12 - Retarget EAS profile, hook and build identity to the PROD project
* Scope: Parameterise the pinned project ref in eas.json, scripts/check-eas-preview.cjs, scripts/build-identity.cjs and their tests for the approved PROD project; keep DEV profile intact; decide the flag set with the matching server packages present.
* Canonical basis: Plan 17.1-17.2; runbook 8.1(2), 8.2; OWNER_INPUTS 'inženjering' list
* Deliverables: Config/hook/test diffs
* Proof plan: Offline guard tests, full CI on exact commit; no EAS build until the owner runs it.
* Autonomous: False | needs the phone: False | depends on: Owner PROD topology/cost decision; EX09-S05; EX09-S03
* First owner boundary: PROD project decision and cost approval (and the project ref); EAS production environment variables.
* Not in scope: Pointing any public binary at DEV or test-world data; building.

### EX09-S13 - iOS identity, EAS iOS profile and hook extension
* Scope: After the owner decides iOS is in V1 and chooses the bundle id: add the iOS identity keys, brand icon, privacy manifest/encryption declaration, EAS iOS profile and hook admission, permission-text review; plan the iOS smoke at the first shared native checkpoint.
* Canonical basis: Plan 5.2, 17.2, 20.1; runbook 8.2 'iOS binary'; registry B12
* Deliverables: Config diffs, tests, iOS smoke plan
* Proof plan: Offline guard tests; first iOS build/smoke on the owner's EAS/Apple account; iPhone proof for J22/J14 iOS halves.
* Autonomous: False | needs the phone: True | depends on: EX09-S11; owner iOS decision, bundle id, Apple account
* First owner boundary: iOS in V1, bundle id (OP-40), Apple Developer account (99 USD, D-U-N-S if organization), iPhone.
* Not in scope: Android-only evidence as iOS PASS; APNs enabling.

### EX09-S14 - Web account-deletion request path and public legal pages hosting
* Scope: Design and, after owner decisions, implement the out-of-app deletion request page, request record contract (candidate + exact revert + postflight + disposable proof; closure-covered relations may move the certificate, so check first), and hosting of Privacy/Terms/Support pages with the legal-document publication procedure.
* Canonical basis: Plan GPL-04/GPL-03; runbook 8.2 'Deletion'; LEG-08 section 3; registry prodavnice 'Zahtev za brisanje preko veba'
* Deliverables: Design record, candidate, proofs, page content
* Proof plan: EX-04-style disposable proof; hosted pages verified without sign-in; N10 cross-device recovery tracked separately.
* Autonomous: False | needs the phone: False | depends on: Owner: domain/hosting, request handler and identity-check rule, operator data; EX09-S10
* First owner boundary: Domain/hosting and the named handler; any server write needs 'primeni'.
* Not in scope: Publishing placeholder legal pages; using the unreferenced Vercel folder as host without the owner's word.

### EX09-S15 - Execute RUNNABLE J scenarios on the HONOR against the release candidate
* Scope: After the RC exists, run the J01-J22 scenarios marked RUNNABLE/PARTIAL (e.g. J01, J03, J04, J06, J08, J10, J18, J19) in owner-granted windows, with the third probe account and a disposable closure subject; record results in the registry; J21 needs two builds on a test track, J22 a store-installed candidate.
* Canonical basis: Plan 19.2-19.3; runbook 7.1-7.3; AGENTS 3.2.1, 3.2.4
* Deliverables: Round document and registry entries with exact build hash
* Proof plan: Exact-build HONOR evidence per scenario, failures kept; no inference from emulator or CI.
* Autonomous: False | needs the phone: True | depends on: RC (EX09-S07 inputs), EX-05/07/08 closed, owner accounts and allowances
* First owner boundary: His phone window and per-action OK; paid-AI allowance; account creation approval.
* Not in scope: Clearing app data, signing out, resetting the phone or deleting his account to simplify a test.

## 7. Recommended order and the first owner boundary
1. EX09-S00 scope record and registry anchor (docs only; fixes the shared-ownership and counting ambiguity first)
2. Owner answers batch 1 (iOS in V1; free vs paid launch; PROD topology; confirm RNR-01 line; confirm side-lane preparation may run now): needed to choose variants, not to start S01-S04
3. EX09-S01 refresh stale drafts and EX09-S04 provenance/classification (read-only, parallel)
4. EX09-S02 artifact audit script, EX09-S03 recovery redirect, EX09-S08 J mapping (small, independent, parallel)
5. EX09-S07 RC manifest generator after S00/S02
6. EX09-S05 PROD promotion package and disposable proof after S04 (authoring only; first PROD write is an owner gate)
7. EX09-S09 operations/launch runbook drafts and EX09-S10 missing legal/store drafts
8. EX09-S11 iOS read-only review
9. EX09-S06 pkg029e removal candidate only if the owner chooses formal promotion of DEV
10. Hold until the owner's order reaches release preparation (AGENTS 4.2) and EX-05/EX-07/EX-08 are scoped and closed: S12 retarget, S13 iOS, S14 web deletion/hosting, then owner steps (accounts, PROD project, 'primeni' applications, EAS build, internal then closed track), RC freeze, S15 HONOR scenarios, final owner authorization, submit, post-launch verification

**First owner boundary.** None blocks the documentation, read-only and disposable-chain slices S00-S04, S07-S11. The first hard owner boundary is the PROD topology and cost decision (new Supabase project vs formal promotion of DEV): it gates S12, any write to a PROD project, reviewer/REAL accounts and the exact 'primeni' for the promotion package. Beyond it, in order of lead time: the operator's legal form/data (root of legal texts, developer-account type and domain), the Google Play account with confirmation of rs.uskoci, the iOS-in-V1 decision, the free-vs-paid launch word, and the owner's own EAS build and final authorization of the concrete packet. Sequencing caveat: AGENTS 4.2 places release preparation after UI/UX, and runbook 8.3(1) bars an RC freeze before P0-P7 and the EX-08 privacy pass close, so only the plan 5.2/5.4 side lane may run now.

## 8. Owner gates (every one stays the owner's)
* **Store/production release, and final authorization of the concrete release packet (candidate, countries/audience, submit moment)** - source: AGENTS.md 3.1.1; runbook 8.3(5); plan 18.4, 20.2, 21.1. Blocks: Any public submit, controlled rollout, production resource creation; preparing a store package is not permission to submit
* **Play Console app, listing and privacy URL; confirmation that package rs.uskoci is permanent (OP-41); Google Play developer account type and creation date** - source: AGENTS.md 3.1.1; RELEASE_CHECKLIST_GOOGLE_PLAY_20260923.md; OWNER_INPUTS_NEEDED item 2. Blocks: First upload, internal/closed tracks, GPL-01/GPL-13/BOTH-03, 12-tester rule applicability
* **EAS production environment variables and the production build under the owner's EAS login (upload key lives in EAS remote credentials; agents never create or print keys)** - source: AGENTS.md 3.1.1; runbook 1 hard rules (login/signing by owner); matrix C-05/C-07. Blocks: Signed AAB, B21, any real production build, EAS-side recovery-redirect variable
* **PROD environment: new separate Supabase project (plan recommendation) or explicit formal promotion of DEV; organization, plan, region and cost approval** - source: AGENTS.md 3.1.3; plan 17.1; runbook 8.1(2); OWNER_INPUTS item 5. Blocks: Any PROD write, retargeting eas.json/guard to a production project, reviewer accounts, PROD E2E; creating paid resources needs its own decision
* **Server/Edge/certificate application to any environment needs explicit 'primeni'; certificate-moving change needs isolated recertification plus approval; B24 (both parts) and Voice B1 must be applied to any production project before its first real user; pkg029e removal** - source: AGENTS.md 3.1.2, 3.1.4, 4.4, 4.6; Voice B1 receipt line 64. Blocks: Every promotion step, TEST-world removal, D12-style digest moves
* **Destructive production migrations or data deletion (relevant if DEV is formally promoted: DEV holds 5 TEST-world accounts and test rows per critic's live read)** - source: AGENTS.md 3.1.1; runbook 8.1(2). Blocks: Formal-promotion route, neutralising test-world data
* **Any state-changing DEV/PROD action, including creating review/probe/disposable accounts and any first REAL-world account** - source: AGENTS.md 3.1.8; plan 19.3. Blocks: J-scenario account supply, reviewer access, closure E2E subject
* **New dependencies: crash/error reporter, OTA channel, expo-audio installation (approved only conditionally), patch-package** - source: AGENTS.md 3.1.5; VOICE_AUDIO_STACK_DECISION_20260930.md. Blocks: Operations tooling choice, Voice B2, permission/manifest freeze
* **Paid AI / providers / budgets: any new paid call (J03/J04 on a candidate, reviewer AI use, screenshots with live AI, post-launch verification of both AI flows), production Gemini account/billing, LocationIQ plan, Supabase plan with backups, EAS plan, SMTP, domain, store fees** - source: AGENTS.md 3.1.1, 3.1.6; plan 5.2 'Produkciona priprema'; OWNER_INPUTS item 11. Blocks: J03-J06, APL-08/GPL-10 review access, budget alarms, backups
* **Push in the first release (yes/no) and enabling: new Firebase Android app for rs.uskoci, FCM V1 credential and EXPO_ACCESS_TOKEN in the owner's accounts, APNs if iOS; no global enable, one-device/one-event proof only after approval** - source: AGENTS.md 3.1.7; OWNER_INPUTS item 12; EX-06 owner question Q2. Blocks: J14, P03/P04 store acceptance, C-36..C-38
* **Legal texts, operator identity and company data (OP-01..OP-05, OP-07), retention periods (12 decisions in LEG-10), legal basis, processor contracts/regions; never invented by an agent** - source: AGENTS.md 3.1.1, 3.4.5; OPEN_INPUTS (AF-D10 operator not registered); runbook P7 item 8. Blocks: LEG-02/04/05/07/08, APL-02, GPL-02/03/13, export N09, publication of any legal document
* **Prices, payments, payment provider and core business model: free 0 RSD launch vs a connection fee required before the first public release** - source: AGENTS.md 3.1.1; plan 3.2 vs APP_FINISHING_PLAN_20260922.md sec.1; registry prodavnice 'Plaćanje'; OP-31. Blocks: Terms, store listing, APL-11/12, GPL-11/12
* **External accounts: Apple Developer (99 USD/yr; organization needs legal entity, D-U-N-S, public site), domain/hosting, email sender with SPF/DKIM/DMARC, Supabase Auth console (Site URL, redirect allowlist, leaked-password protection)** - source: AGENTS.md 3.1.1; OWNER_INPUTS items 3, 4, 7; matrix C-22..C-24. Blocks: iOS, public web pages, N02/J02, store contact fields
* **iOS in the first release (and iOS bundleIdentifier, iPhone for proof); any scope exclusion needs an explicit product decision before UI/store copy changes** - source: OWNER_INPUTS item 3; runbook 9; plan 20.3 'obe dogovorene platforme'; registry B12. Blocks: APL-01..12, iOS half of J14/J22, iOS voice, Apple screenshots
* **Permissions with privacy consequences / new permission texts (microphone text vs hold-to-talk-sends-on-release; iOS mic declaration)** - source: AGENTS.md 3.1.1, 3.6.3; LEG-12 N-03; STORE_GATES BOTH-01. Blocks: BOTH-01, BOTH-02, merged-manifest freeze
* **Physical HONOR phone: only in a window the owner grants; never clear app data/session, sign out or change data without his explicit OK; installs only via adb install -r; iPhone for iOS proof** - source: AGENTS.md 3.2.1; plan 19.3. Blocks: J01, J17-J19, J22 and any physical-device proof
* **Final privacy pass (EX-08) for the two deferred branches, scheduled by the owner before public release** - source: AGENTS.md 4.5; runbook 8.3(1); plan 15.4. Blocks: RC freeze, final Data Safety/App Privacy and Privacy Policy wording
* **Named moderation/support owner and real intake channel; staffed multi-operator support would be a table-DDL change (certificate re-bind)** - source: plan 17.3, 13.3; OPEN_INPUTS AF-D17-18; OP-07/OP-13. Blocks: APL-06, GPL-06, J16, 'operativa' DONE
* **Countries, minimum age (18+ is an RC2 proposal, no age check exists) and list of forbidden job kinds** - source: OWNER_INPUTS item 8; registry prodavnice 'Uzrast i vrste poslova'; plan LEG-19. Blocks: APL-09, GPL-08, GPL-09, LEG-19, EU/DSA trader question
* **Geocoder for production (state address register vs LocationIQ) and map-tile provider (public OpenFreeMap has no SLA)** - source: OWNER_DECISIONS_20260924.md decision 8; matrix C-32/C-33. Blocks: Production location search, LEG-11 processor entries
* **V1 scope of HITNO, written review comment (D12, moves the closure certificate), voice, P05 reminder: delivered or explicitly deferred by owner** - source: plan 3.1, 3.2, card A16, P05; D12_WRITTEN_REVIEW_DESIGN_20261001.md; runbook 9. Blocks: Store copy, Terms, review notes, certificate re-bind
* **Restrict or rotate two publicly leaked active Google API keys; GitHub repo settings (repo is public)** - source: cleanup-inventory-20260930/SUMMARY.md findings 2-3. Blocks: Google/Firebase account hygiene before public release
* **RNR-01 status: registry B22 and AGENTS 4.2 list the dependency decision as open and release-blocking; EX03 closure receipt says the owner decided not to introduce patch-package** - source: docs/control/redovi.json blokade B22; AGENTS.md 4.2; EX03_CLOSURE_RECEIPT_20261001.md line 41. Blocks: B22 disposition in the release blocker list

## 9. Questions for the owner (none blocks the side lane; each decides a variant)
1. Is iOS part of the first public release (EX-09 says 'oba builda'), or Android first? If iOS: which bundle id and which Apple account (personal or organization)?
2. Free launch at 0 RSD (plan 3.2, price list at 0, payments off) or the paid connection-service fee you required before the first public release (APP_FINISHING_PLAN, registry 'Plaćanje')? One explicit word, since it changes Terms, store copy and APL/GPL-11/12.
3. PROD environment: a new separate Supabase project (organization, plan, region, cost) or an explicit formal promotion of canonical DEV (which would require neutralising test data and removing pkg029e)? Is a paid Supabase plan with backups intended (the only organization is on the free plan)?
4. Operator: legal form and data (OP-01..OP-05, OP-07), or a decision to register first; and who is the named person and channel for moderation/support and incidents?
5. Google Play developer account: personal or organization, and when was it opened (decides the 12-testers/14-days closed test)? Do you confirm rs.uskoci as the permanent package? Who are the 12 testers if needed?
6. Countries offered, minimum age (RC2 proposes 18+, the app has no age check) and the list of forbidden job kinds.
7. Push in the first release (new Firebase app for rs.uskoci, FCM V1 credential and Expo token from your accounts, APNs if iOS)? If no, push moves out of store copy and J14.
8. Voice messages: ship in V1 on both platforms, Android only, or formally defer; and do you approve new microphone/permission texts (hold-to-talk sends on release) and installation of expo-audio now that the compatibility check is documented?
9. V1 scope of HITNO, the written review comment with the star rating (D12, moves the closure certificate) and the P05 reminder: deliver or explicitly defer?
10. Retention periods (12 decisions) and legal review by counsel; and may legal documents be published into the registry only after your explicit word on a domain and text?
11. Paid resources and allowances: production Gemini account/billing, bounded paid-AI allowance for reviewer accounts, screenshots, J03/J04 and post-launch verification, LocationIQ vs state address register, map-tile provider, email sender and domain, EAS plan.
12. Crash/ANR visibility: store consoles only, or approve a crash-reporting/OTA dependency (changes Data Safety/App Privacy answers)? And please confirm the RNR-01 line: is your decision not to introduce patch-package current, so B22 stops being an open owner gate?
13. Please restrict or rotate the two publicly leaked Google API keys flagged in the cleanup inventory, and confirm whether the unreferenced USKOCI-SAJT/Vercel folder is meant as the host for public pages.
14. Confirm that the documentation/read-only/disposable-proof side lane (S00-S11) may start now, ahead of EX-05/EX-07, even though your order of work puts release preparation last?

## 10. Proposals that are NOT canonical (recorded, not adopted)
* Add *.keystore and credentials.json to .gitignore (hygiene idea from one researcher; no canonical source names it).
* Compile the 16 dizajn-* gallery routes out of the store bundle instead of keeping the runtime guard (cleanup inventory proposes a gate helper/exclusion; the canonical requirement is only to prove them excluded or inaccessible, runbook line 539).
* Gate or remove the BuildIdentity block and the sign-up 'Ovo je test verzija' line in the store build (listed as must-not-appear in REVIEW_NOTES_DRAFT; J22 'no DEV-only routes or debug controls' is only a partial basis; the sign-up line is already owner-locked until legal documents are published).
* Replace the brand iOS icon (ios.icon still points at the Expo template assets/expo.icon); flagged only in the cleanup inventory as REVIEW (release).
* A TEST-world seed so reviewers see content, and any design for review/demo accounts beyond the runbook's 'outside the TEST world, pre-confirmed' rule.
* Re-enabling a server-side AI cost cap or adding a public AI admission model for PROD (DEV cap was disabled by owner request 2026-09-20; no canonical PROD design exists).
* Staffed multi-operator support (contract/DDL change) beyond the private-test singleton operator.
* A simulator iOS build for layout/screenshots without an Apple account (marked INFER in one draft; Apple screenshots must come from iOS anyway).
* Using the owner's Desktop Vercel folders (USKOCI-SAJT, SAJT) as the hosting for public pages (LOW-confidence lead, not canonical).
* Starting the closed test before a privacy URL and Data safety form exist, or the reverse (depends on an unverified console fact).
* Any remote-config/OTA kill switch: plan 17.4 explicitly says not to design a new remote control just to cover an unverified feature; the approved set is existing Edge flags, DB config rows, cron unschedule and compile-time client flags.
* Assuming a staged rollout for the first release on every platform (plan 20.5 says not to assume it).

## 11. Risks
* Scope assumption risk: EX-09 is one plan row with no scope record; reading its 'oba builda', 'forme, review i operativa' literally would pull in iOS, push, voice, web and legal work that the owner has not scoped. Mitigate with S00 and the variants.
* Stale evidence used as fact: the 2026-09-30 drafts and dev_snapshot/live-state predate ledger 215-219, P6 closure and the EX-04 flags; the registry store rows are mixed-date. A refresh (S01) must precede any use.
* First production build is an unknown-risk event: the SDK 57/RN 0.86.3 toolchain, pre-install hook and postinstall have never run on EAS for preview or production, and the postinstall reads a docs HTML file, so docs archiving or a clean-room build can break it.
* DEV-backed store AAB would ship test-world data and legacy readers if built from today's eas.json; 'DEV renamed as production' is forbidden (plan 17.1, runbook 8.1(2)).
* REAL world has never been exercised on any live database (all 5 DEV accounts are TEST); the first public user is the first REAL account, and the P6 TEST-world derivation, pkg029e removal timing and B24/Voice B1 ordering are untested on a real topology.
* A PROD built from source147 alone lacks most product behaviour (60+ product rows are in the DEV-only ledger); a glob of the migrations folder wrongly includes the forbidden untracked migration; B24 candidates refuse to run twice so ordering vs a schema dump matters; the closure digest is different in every database and each certificate-moving package needs re-bind.
* Time-varying store rules (Play API 36, 16 KB for updates from 2027-02-01, Apple Xcode 26/iOS 13 floor, 12-tester rule, quality thresholds crash 1.09%/ANR 0.47%) come from secondary notes dated 2026-09-30 and must be re-checked in the consoles at submit.
* Long lead-time owner items (operator registration, D-U-N-S, Apple/Google accounts, 14-day closed test, legal review) may dominate the schedule even if engineering is ready; no empty APK may be used to pass the calendar (plan 5.4/18.1).
* Paid AI dependency: reviewers and J03-J06 need live AI, DEV budget cap is off, price_valid_until is 2027-01-01 (paid AI then returns AI_TEST_BUDGET_NOT_READY), and no public admission/budget model exists.
* Privacy declarations drift: Data Safety/App Privacy and Privacy Policy cannot be final before EX-08; claims such as 'AI never sees your address' are unsafe today; voice storage contradicts the 'audio not stored' drafts; Apple 5.1.2(i) AI-notice and UGC (Apple 1.2/Google UGC) gaps are likely review findings (INFER).
* Unreadable console state (Play, Apple, EAS production environment and upload key, Firebase, Supabase Auth settings, Edge env flag values, backup tier) means several 'missing' items are UNVERIFIABLE from the repo and must be read by the owner.
* Single-owner phone and account constraints: J-scenarios on the HONOR need windows and per-action OK; closure E2E must use a disposable subject, never the owner's account; two-phone, push and iOS proof remain open (blocker B09).
* Scope overlap with EX-07/EX-08 can cause double-closure or items falling between units if the scope record does not assign each item once.

## 12. Findings the skeptics partly corrected (the synthesizer used the corrected claim)
* [release-docs EX09-15] Type, fee, D-U-N-S and the closed-test rule are correct (STORE_GATES lines 214 and 272 flag the organization exemption as INFER). But 'recorded nowhere' is too strong: EAS_EXISTING_PREVIEW_IDENTITY_20260907.md line 19 records that after the owner's Google login a browser inspection showed a Play developer-account signup page with no existing account accessible, while stating this does not prove no account exists elsewhere.
  * Corrected claim: No Play developer account type, verification or creation date is recorded in the repository. The only trace is a weak 2026-09-07 observation (signup page shown after the owner's Google login, no account accessible, explicitly not proof of absence). Type and date still decide the 12-testers/14-days rule.
* [release-docs EX09-19] True for the repository: git grep of domain TLDs, mailto, support@, privacy@ and info@ in src, app configs, supabase/functions and plugins returns only test package strings (rs.uskoci.app.dev). OWNER_INPUTS item 4 and matrix C-40 verified. But the owner's Desktop (outside the repo) has SAJT (a Next.js project) and USKOCI-SAJT (with a .vercel folder and index.html); only a directory listing was taken and no file was opened, so whether a site or hosting exists is unverified (see add-11).
  * Corrected claim: No domain, hosting or public Privacy/Terms/Support/deletion URL is recorded in the repository or configs. A possible website project exists outside the repo on the owner's Desktop and has not been assessed; ask the owner before declaring hosting absent.
* [builds-signing-ios B13] Substance holds, details differ. The push-proof env block has 5 variables, not 4. The newest runs are 2026-09-27 dispatches as stated. Repo HEAD is b00f62f3, not 852cf658. 'EX-05 will need a fresh preview build' is an inference: registry P04 says phone build b589994e already carries a compatible same-message client with Inbox-to-exact-message native PASS, and EX-05 has no scope record. The workflow also auto-fires on pushes to the work branch that touch app.config.js, firebase-config.test.ts or itself.
  * Corrected claim: A push-capable rs.uskoci.preview build exists only as the GitHub workflow build-android-push-proof.yml (dispatch, plus push to the work branch touching app.config.js, firebase-config.test.ts or the workflow). Its env block has 5 variables (Supabase URL, publishable key, USE_FAKE_SOURCE=0, AUTH_RECOVERY_REDIRECT_URL, CI), so no P6 or EX-04 flags. Last runs 2026-09-27 (36355441615 on 2b2cf4d7, 36353187030 on 10739a44, 36351037945 on baa32832, 36345891205 on b589994e). None from HEAD b00f62f3. Registry P04 records b589994e as having the compatible same-message client, so a fresh preview build for EX-05 is a prudent inference, not a documented requirement. The DEV APK is rs.uskoci.dev with no Firebase client.
* [builds-signing-ios B20] Core claim holds: nothing checks target API, 16 KB alignment, merged permissions or debug content, and there is no AAB tooling (grep for bundletool, zipalign, check_elf and similar found only workflow aapt/apkanalyzer use). The 'only manifest-analysis call' wording is wrong: p6-native-apk.yml, p6-round58-native-proof-build.yml and p6-native-journey.yml run 'aapt dump badging' (package-name grep only), and the DEV workflow adds recovery-redirect and launcher-icon attestations. All are APK-only.
  * Corrected claim: No tooling verifies an AAB or a release artefact for target API, 16 KB alignment, merged permissions or debug/log content. Existing checks are APK-only and narrow: apkanalyzer manifest checks in build-android-push-proof.yml, aapt dump badging package-name greps in three p6 workflows, and recovery-redirect and launcher-icon attestations in the DEV workflow. Matrix C-52 confirms no 16 KB check exists.
* [builds-signing-ios B27] No crash or ANR in the two latest owner-window checks is right. '10/10 open/Back loops' is imprecise: in Round 77 only the S1 loop completed 10/10, the S2 loop ran 4 cycles before an incoming call and the Kandidati loop was not run. Round 79 did S2 6/6 but S4, pull-to-refresh and the candidate loop were not proven. Single phone, small windows, no soak test.
  * Corrected claim: No crash or ANR in the two latest owner-window HONOR checks. Round 77 (APK 93e48799): no exit-info entry after the update, no FATAL EXCEPTION or ANR in the uid log; S1 loop 10/10, S2 loop only 4 of 10 cycles, Kandidati loop not run; one unanalysed Reanimated dead-tag burst. Round 79 (test APK 9ef10b67): none; S2 6/6 cycles; S4, pull-to-refresh and the candidate loop NOT proven. EX-03d recorded ANR 0. One phone, small windows, no leak or soak test.
* [builds-signing-ios B31] Repo is public (gh repo view isPrivate=false). Only DEV_ACCEPTANCE_PASSWORD is referenced as a secret. .gitignore rules match. But the canonical publishable key literal is in 3 workflows (dev-apk, push-proof, p6-round58) plus eas.json, not 11; the canonical URL is in 11 workflows, and other APK workflows use local demo JWTs or env from the disposable chain. The hygiene statement also misses that .gitignore has no *.keystore or credentials.json rule (see add-01).
  * Corrected claim: The GitHub repo is public. CI holds no signing secrets; the only secret name in workflows is DEV_ACCEPTANCE_PASSWORD. The canonical Supabase URL appears in 11 workflows; the canonical publishable key literal in 3 workflows and eas.json by design. .gitignore excludes *.jks, *.p8, *.p12, *.key, *.pem, *.mobileprovision and /android, but not *.keystore or credentials.json. The store profile uses credentialsSource remote.
* [builds-signing-ios B36] DEV workflow: checkout@v4, setup-node@v4, setup-java@v5, ubuntu-latest, top-level contents: write all confirmed. The push-proof workflow pins checkout, setup-node and upload-artifact to SHAs but still uses setup-java@v5 and ubuntu-latest, so 'pins SHAs' is only partly true. WORKFLOWS.md finding 8 says 5 of 10 external actions are floating repo-wide.
  * Corrected claim: build-android-dev-apk.yml uses floating tags (checkout@v4, setup-node@v4, setup-java@v5), ubuntu-latest and top-level contents: write. build-android-push-proof.yml pins checkout, setup-node and upload-artifact by SHA but keeps setup-java@v5 and ubuntu-latest, with contents: read. Matrix C-06 says a release must not come from the CI DEV workflow; EAS image and toolchain pinning is unknown.
* [legal-forms LF-15] Researcher's 'RC2 proposes 18+' understates the plan's L01 card; see add-09.
  * Corrected claim: Age and countries are not recorded as an explicit owner decision in the repo (registry row 'Uzrast i vrste poslova: TVOJA ODLUKA', dated 16.09; STORE_GATES APL-09 and OP-30), but the plan's source card L01 says the owner-reconciled RC2 keeps 'lični 18+ V1', and the RC2 text itself states 18+. So 18+ is an RC2 baseline that probably was approved in an unreadable DOCX; what is open is the explicit confirmation (plan LEG-19: 'odluka o public regionima i uzrastu je eksplicitna'), the countries, and the in-app age declaration mechanism.
* [legal-forms LF-39] PKG-031 receipt exists (ledger 20260921_pkg031_application).
  * Corrected claim: (1) Confirmed: LEG-02 section 19 (Otkazivanje) says each party should cancel and does not carry the applied PKG-031 rule (no requester cancel after the worker says done, 48 h auto-completion); LEG-02 has no 48 h text. (2) Weaker: the owner decision of 2026-09-22 concerns the app learning the account id behind a profile for report/block (a disclosure like a Dogovor already makes). LEG-05 section 9 already states the reported person gets no report text, number or reporter identity; whether the public Privacy/Community text must additionally disclose account-id keying is a drafting judgment, not a source requirement.
* [legal-forms LF-43] LEG-02 line 23 and OP-31 verified.
  * Corrected claim: The registry cell 'Plaćanje' (state 16.09) says the owner asked for a connection fee before the first public release and the model is undecided, while plan 3.2 states launch basis PROMOTIONAL_FREE / 0 RSD, plan 'Odobrene granice ne proglašavati ponovo neodlučenim', PKG-051 set 0 RSD and the RC2 reconciliation records 0 RSD. The registry cell is older than those, so this is mainly a stale registry cell plus OP-31 (owner must confirm the free-launch wording), not a live contradiction.
* [legal-forms LF-46] Also relevant: EX-07 and EX-08 already own parts of this legal scope (add-02).
  * Corrected claim: Scope discipline stands, but two items OWNER_INPUTS_NEEDED lists as 'engineering' are not purely engineering: the consent gate needs the owner's rule first (LEG-13 5.2; RC2 reconciliation infers no new global gate; add-06) and the web deletion path needs an owner-owned handler, identity-check rule and domain (LEG-08 section 3, README question 19). The verbatim AGENTS 3.1.2 quote and the eas.json production env without AUTH_RECOVERY_REDIRECT_URL are verified.
* [ops PO-14] Incomplete rather than wrong. Live DEV tick body is pkg028a as later changed by pkg030a (ledger dev_alpha_pkg030a_edge_workers_apikey: sends the sb_secret key on the apikey header). pkg028a hard-codes the DEV URL in vault.create_secret and its own post-check asserts that exact URL, so it cannot be applied to PROD verbatim. Live Vault has both names (uskoci_edge_base_url, uskoci_edge_worker_key); values not read.
  * Corrected claim: uskoci_marketplace_tick comes from source migration 20260829212158. uskoci_edge_workers comes from the DEV-only candidate pkg028a plus pkg030a (apikey header, owner-stored sb_secret key). pkg028a hard-codes https://leqcwgzvjsxugfgzdmth.supabase.co and asserts it afterwards, so PROD needs an edited copy; the tick returns NOT_CONFIGURED unless base URL matches https://<20 chars>.supabase.co and a key of 16-4096 chars is in Vault name uskoci_edge_worker_key (owner action). Both jobs are active on DEV.
* [ops PO-16] Seven fail-closed flags confirmed by reading each call site (all compare === or !== 'true'). Chronology is wrong: PKG-030 (push DISABLED, closure switch on) is dated 2026-09-21, EARLIER than the 2026-09-27T20:12:44Z 'exact payload OFF' note, not later. EX06_CANONICAL_SCOPE says the transport flag value was never read since 2026-09-21. Edge env values remain unreadable.
  * Corrected claim: Seven Edge flags, all fail-closed (unset or not 'true' = disabled). Last recorded states: EXPO_PUSH_TRANSPORT_ENABLED off by owner decision at PKG-030 (2026-09-21, not re-read since per EX06 scope doc); exact-payload/message-target flag OFF at 2026-09-27T20:12:44Z (redovi.json live_dev_scope); USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED on at PKG-030 (2026-09-21). No flag value has been read after 2026-09-27. USKOCI_GEMINI_PAID_TEST_ENABLED is checked by 5 AI Edge functions (see add-05).
* [owner-gates EX9-02] Core MISSING is confirmed: git grep 'EX-09' = only the LIVE HTML; 0 hits for EX-09/ex09/EX09 and for release-prep, release_prep, STORE_GATES_STATUS, TESTER_SCENARIOS, OWNER_INPUTS_NEEDED, legal-drafts in redovi.json (json-dumped); finalization block has ex04 and ex06 but no ex09 (master-plan-live-state.json also has ex04/ex06 only). Two imprecisions: (1) 'release.status NOT READY' lives in master-plan-live-state.json (the HTML projection state), not in redovi.json; (2) 'the only registry release content' is too strong: redovi.json also carries N02, N09, P03, P04 and other rows that bear on release, plus 24 'prodavnice' conditions and blokade B09/B12/B13/B21/B22. EX-05 and EX-07 DO appear in redovi.json (67 'EX-0x' hits), EX-09 does not.
  * Corrected claim: No EX-09 scope record or registry row exists (git grep EX-09 matches only the LIVE HTML; redovi.json and master-plan-live-state.json have 0 hits; finalization has ex04/ex06 only). The release-prep and legal-drafts files are not referenced from redovi.json. Release-related registry content is spread over the 24 'prodavnice' conditions, blokade B09/B12/B13/B21/B22 and rows such as N02/N09/P03/P04; the 'NOT READY' status and 'done: null' counters are in docs/control/master-plan-live-state.json.
* [owner-gates EX9-10] Substance holds: eas.json production env has only the two Supabase values, matrix C-23 and OWNER_INPUTS last paragraph quotes verified. Detail wrong: EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL is not 'only in the DEV workflow'; it is set in four CI workflows (build-android-dev-apk.yml:33, build-android-push-proof.yml:20, p6-native-apk.yml:36, p6-round58-native-proof-build.yml:25), still never in eas.json. Also relevant: scripts/ci/attest_recovery_redirect.py already attests the redirect inside a built APK (history: a 2026-09-13 signed build shipped with recovery dead), a pattern reusable for the AAB.
  * Corrected claim: EAS production env holds only the two Supabase public values; EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL (uskociapp://oporavak) is set in four CI APK workflows but not in eas.json, so a store build gets configuredRecoveryRedirect()=null unless the EAS console already carries it (not verifiable from the repo). Adding it is engineering; the console variable is the owner's. An APK-level attestation script exists (scripts/ci/attest_recovery_redirect.py) but no AAB equivalent.
* [owner-gates EX9-43] Confirmed: USKOCI_APPLE_GOOGLE_RELEASE_GATES_2026-09-28.md, USKOCI_DATA_FLOW_TRUTH_2026-09-27.md and USKOCI_LEGAL_RC2_OWNER_RECONCILED_2026-09-10.docx are not tracked in git (ls-files, git log --all names) nor found on the Desktop to depth 6. Wrong implication: the owner has already said RC2 content was delivered and must not be re-requested (AGENTS 1.3.7 'Old missing-package requests are historical'; OPEN_INPUTS 'RC2 sadržaj je dostavljen i pročitan; ne tražiti paket ponovo'). The 2026-08-18 RC2 master, a zip and a RECONCILIATION.md exist in the owner's folder Desktop/USKOCI ZAVRSAVANJE/V5_RC2_APPROVED_SOURCE (outside the repo; the legal README read from it).
  * Corrected claim: The three plan-named source documents (L01 owner-reconciled RC2 docx, L02 Apple/Google gates, L03 Data Flow Truth) are not in the repository. Do not re-request the RC2 package (owner: already delivered); the RC2 2026-08-18 master sits outside the repo in USKOCI ZAVRSAVANJE/V5_RC2_APPROVED_SOURCE. If the owner is asked anything, ask only whether L02 and L03 exist or whether the plan chapter-18 tables and the code-derived registers are the accepted base.
