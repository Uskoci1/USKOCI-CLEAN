# Release and operations reconciliation — 2026-09-22

## Scope and evidence boundary

Bounded source/receipt pass while the parent task integrates client work and builds/tests the phone.
Checkout: `work/pre-v3-engine-integration-20260911`, observed HEAD
`45a779c7357bae4ba495f335b3898849bf7fbcc2`. The working tree contains concurrent authorized
client changes; this is not a release attestation of the eventual integrated commit.

Inspected: native/EAS/GitHub build configuration, Auth/session/logout, push registration/runtime
and transport admission, closure preparation/execution/journal, export/save, legal/operator/support
entrypoints, connection-charge source, the control snapshot and selected dated delivery records.
This is neither an exhaustive security review nor a current legal/store-policy assessment.

**No current DEV, provider, developer-console, device or production state was queried. No credentials
were read, tests/builds were run, dependencies changed, accounts modified, or commits made in this
pass. Only this document is written.** Source files establish implementation; saved receipts establish
what was recorded at their date. Neither establishes a fresh deployment, real delivery or native acceptance.

Useful anchors:

- `docs/control/dev_snapshot.json`, generated **2026-09-22T13:49:06Z**: recorded DEV ledger197,
  last `dev_alpha_pkg045a_task_read_contract`, two active minute schedules, 2,823 cron runs/zero
  failures over its preceding24h, closure digest65980fce… equal to certified. It does not prove
  today's function bodies or workers delivered anything. The snapshot's RPC inventory is structural.
- `docs/implementation/v5-ai-first/pkg042/DEVICE_INSTALLATION_RECEIPT_20260922.json`: source
  dfa54206, `rs.uskoci.dev`, installed hash/signature, existing session and Home launch observed;
  explicitly no full marketplace/AI/speech journey. Historical, not the current integrated build.
- `CLIENT_FOUNDATION_RECEIPT.json`: current retry correction had242 suites/4,698 tests and a
  built ARM APK; x86_64 emulator later launched welcome/sign-in only. `OFFER_READABILITY_RECEIPT.json`
  records242 suites/4,710 tests plus fixture rendering, with exact-build native acceptance pending
  at its recording. Parent-task later evidence may supersede these specific device limits.
- The current task's Agreement completion review has its own delivery note. Its126 focused checks
  do not certify the release/operations surfaces discussed here.

## Risk and remaining-gate matrix

| ID / priority | Current source evidence | Recorded DEV/build/device evidence | Remaining gate and concrete continuation |
| --- | --- | --- | --- |
| RO01 — release build identity; launch gate | `.github/workflows/build-android-dev-apk.yml` overwrites the package to **rs.uskoci.dev**, builds ARM64 or x86_64 APKs, skips `lintVitalAnalyzeRelease`, and attests recovery redirect/icon. `app.config.js` attaches Firebase only for **rs.uskoci.preview**, deleting that file reference for other packages. | Recent receipts prove selected DEV APK source/hash/install/UI checks. `EAS_EXISTING_PREVIEW_IDENTITY_20260907.md` records a separate preview signing lineage; those old metadata are not a current APK certificate. | DEV APK acceptance cannot establish preview FCM configuration or store distribution. Select the intended artifact identity, validate its actual package/version/signature/native manifest and preserve upgrade data. Keep DEV and preview receipts separate. Do not treat package equality alone as signing compatibility. |
| RO02 — iOS and store distribution; launch gate | `eas.json` contains only `preview` / internal / Android APK. `scripts/check-eas-preview.cjs` explicitly admits only profilepreview/platformandroid. `app.json` has an iOS icon but no explicit `ios.bundleIdentifier`; inspected workflows contain no iOS/store submission pipeline. | No current iOS build, APNs artifact, signing or store-account evidence inspected. September7 EAS metadata are historical. | Prepare the actual Android store/iOS identity and build/submit route under owner choices. Inspect generated target/build SDK and privacy manifests in the real artifacts; app/package version alone proves none of them. Do not run this Android-only hook unchanged as an assumed iOS release gate. |
| RO03 — exact-source CI versus successful APK; integration gate | APK workflow performs install/prebuild/Gradle and artifact attestation, but contains no TypeScript/Jest job or dependency on PRE-P4. `pre-p4-integrity.yml` separately runs TypeScript/scoped tests and emits a source-bound receipt; push trigger names `clean-alpha-backend`, so this work branch needs dispatch/equivalent explicit checks. | Existing receipts attest specific earlier SHAs. Parent is now collecting integrated checks/builds; no fresh run status was queried here. | Bind full required checks, selected domain proofs and APK to the same final commit/tree. A green build is insufficient evidence of tests. Use the read-only CI commands below before any claim. |
| RO04 — push configuration, activation and delivery; release gate | `nativePushDevice.ts` requires a physical device, project ID, native permission and a real Expo token; read-only entry does not prompt. Android channel is DEFAULT/PRIVATE. Enrollment plugin disables Firebase automatic enrollment/analytics. `PushRuntime.tsx` allows fixed public copy only, rotates an existing explicit registration and opens account-owned Inbox; it accepts no payload destination URL. | PKG030's final recorded check accepted worker authentication but returned push `DISABLED`; saved minute schedules are not notification delivery. Snapshot records pushv14/verify_jwtfalse. No current device token/FCM/APNs/provider receipt or delivery observed. | Use a push-capable intended build (RO01), preserve explicit opt-in, review controlled recipients/backlog, then perform the separately authorized real-event delivery test. Verify foreground/background/cold start, denied permission, account change/logout and old payload compatibility. General activation remains distinct. Transport readiness explicitly says `TRANSPORT_ONLY`; provider acceptance is also not device receipt. |
| RO05 — password recovery and access; device gate | `authClientService.ts`, `passwordRecoveryLink.ts`, `supabaseClient.ts` keep recovery on a nonpersistent isolated transport; session restore has an8s bound and account revisions survive A→B→A. GitHub APK workflow injects/attests `uskociapp://oporavak`. The EAS preview preflight does not check this recovery variable or attest the built bundle. | GitHub recovery attestations prove compiled configuration on their own SHAs, not email delivery/deep-link behavior. No current EAS environment or Auth redirect allowlist inspected. | Verify EAS recovery configuration separately if that route is used. On final native builds test email arrival, warm/cold link, expired/malformed link, already-signed-in isolation, password update and safe return. Do not infer email transport from an APK string. |
| RO06 — logout and local privacy; targeted follow-up | `authClientService.signOutLocal` checks account/revision before and after SDK session read, bounds push revocation to4s, then calls SDK `signOut({scope:'local'})`; only Auth events clear the session. Successful logout tries to forget Agreement outbox text; storage failure is intentionally best effort. Auth persists via AsyncStorage. Closure intent intentionally retains opaque recovery coordinates per account. | `auth-client.test.ts` contains stale-account, unconfirmed push revoke and SDK error tests; this pass did not run them or exercise native offline logout. | Verify final-build logout with expired/offline session and storage failure, then another account. Source exposes no application deadline around SDK getSession/signOut (only around push revoke): reproduce a hanging SDK promise before deciding a bounded client fix. This is a source follow-up, not a claimed phone incident. Privacy inventory must distinguish removed message text, necessary recovery journals, persisted Auth and user-saved export files. |
| RO07 — closure on another device; unresolved contract gate | `ClosureDialog.restore` loads `closureIntentJournal` and reads execution only with its saved START clientRequestId; without that record it reads execution review. `accountClosureClientService` deliberately accepts only legacy `restricted:false`, nonexecuting preparation. | PKG034 proves/applies preparation blocker parity only. `NEXT_AI_HANDOFF_20260921_CODEX.md` records the restricted-account API guard blocking ordinary getter/review, while execution reader cannot discover a missing START key. Both relevant reader/guard are certified. PKG032/045 disposable closure success does not settle cross-device recovery. | Design a permitted, account-owned discovery/readback path; preserve receipt versus execution distinction and erasure exceptions. Prove lost local journal/new device/restricted Auth on a disposable stack. A future certified reader/guard change needs its own explicit approval/rebind; PKG045b approval does not authorize it. Keep controlN10's complete-flow acceptance open despite its empty problem field. |
| RO08 — export, retention and native save; policy/device gate | `dataExportClientService` maps DATA_EXPORT_POLICY_NOT_READY. `dataExportDeliveryService` owns preparation/download; route validates receipt/generation/hash and aborts stale download. Native file adapter uses explicit directory selection, no overwrite, size/MD5 verification and cleanup; already saved user files remain user-owned. | PKG029d receipt proves/applies refusal of new export requests when delivery binding is absent; existing request replay/cancel is preserved. September21 audit recorded no bound export policy. Historical P2/EXPORT_PROJECTION notes cover earlier partial proofs and must not override later source/receipts. No final native save or current policy read performed here. | Obtain reviewed operator/Privacy/retention/dataset/lifetime inputs; bind through a separate proven package. Then verify real owner-only export, unsupported/cancelled picker, interruption, expiry/revocation and saved-file integrity on Android/iOS. Do not repeat the old claim that new requests are accepted indefinitely; PKG029d corrected that. |
| RO09 — legal and public operator contact; owner-input gate | Sign-up explicitly says test version and documents before public launch (`auth.tsx:379`); no fake acceptance checkbox remains. `profil/pravna.tsx` has hashed reviewed acceptance and owned receipt recovery. `o-aplikaciji.tsx` links legal/privacy and build identity but does not itself provide operator contact details. | Lawyer worksheet20260921 records missing operator and undecided exception lifetimes. Deep-read record had no published legal/processor/retention rows. These are dated facts; current publication was not checked. | Obtain real operator/contact and reviewed content/retention/processor choices, publish the approved bundle and prove its exact acceptance. Verify public support/privacy/deletion-request URLs and their reachability separately. No externally hosted deletion site was investigated here; absence in inspected app config is not proof no site exists. |
| RO10 — staffed support/moderation; operating gate | Operator route exists. Support clients/controllers use server capabilities, allowed actions, revisioned commands and receipt recovery. `operatorAvailable` governs operator entry; its name is not a claim that someone is currently staffing support. Decisions shown in support do not automatically change Agreement price/state or settle debt. | September21 deep read recorded0 operator grants; later app copy mitigation exists. No fresh grant/staffing read, real case lifecycle or response-time observation in this pass. | Owner identifies the operator and process. Verify customer report→assigned operator inbox→authorized decision/reconsideration→customer-visible outcome on chosen test accounts; verify ordinary accounts cannot use operator actions. Test confidential safety handling separately. Do not promise operational support from route existence. |
| RO11 — paid connection service; explicit launch-scope gap | Frozen connection activation V1 has `PROMOTIONAL_FREE` and a0-RSD constraint (`20260906100000_clean_p0d03_requester_connection_activation_v1.sql`); its historic closure expressly excludes paid checkout. Targeted current TS/service search found no paid checkout/provider adapter, while selection retains CONNECTION_POLICY_NOT_READY refusal. This search is bounded, not proof that every possible external commerce mechanism is absent. | APP_FINISHING_PLAN requires paid connection-service monetization before public release, with payer/amount/method/refund undecided. No fresh payment-provider or store-commercial review evidence obtained. | Decide the concrete paid connection flow and obtain the needed provider/platform assessment; then implement/prove charges, immutable receipts, failures, retry/refund and user copy. Task work price is separate. Existing free activation receipts do not meet the owner's paid-launch requirement. |
| RO12 — test/production separation and privacy rollout; launch gate | PKG029e intentionally maps OWNER_PERSONAL/BUSINESS into TEST world while testing. PKG045A/client readers do not revoke broad task-column access; B performs that restriction with compatible rollout/certificate handling. Current build points at canonical DEV. | PKG029 receipt records owner/test visibility as applied. PKG045 records A applied, B proved and owner-approved **after compatible new-app verification**. Snapshot last row is A. No production project/capacity/backup-restore evidence inspected. | Before real users, replace the temporary test-world rule through its proven migration path; establish production/environment/monitoring/restore/incident ownership. Complete compatible phone inventory/reads before exact approved B application/readback. Do not ask for B approval again; do not infer its device condition has been met from unrelated APK/UI screenshots. |

## Corrections to older summaries

1. The main status/finishing-plan statements that notification error retry is still disabled are stale:
   current `PushPreferences.tsx:146` uses `disabled={busy}` on “Proveri stanje”; writes still use
   `busy || error`. CLIENT_FOUNDATION carries its proof. This does not prove push delivery.
2. PKG029d's source and application receipt supersede the old export “accepted but never delivered”
   defect for new requests. The policy and physical delivery gates remain.
3. PKG030's earlier “stopped part-way” and “waiting for key” paragraphs are superseded by its final
   same-day check. Three worker gateway JWT settings are deliberatelyfalse with worker-owned key/Auth
   admission; the download function remainstrue. Do not label all Edge functions JWTtrue or report
   those approved worker settings as an accidental authentication regression. No fresh recertification here.
4. EAS Firebase September7 says no notifications SDK then. Current package/source includes
   expo-notifications/native token registration. Keep its still-valid package/config distinction,
   not its obsolete SDK-absence statement.
5. Do not reuse old DEVICE/CLAUDE pending or pass fields for a newer integrated source. Parent work
   can supersede the inspected receipt's narrow limits only with new evidence.

## Exact bounded continuation commands

These commands are proposals for the integrating task, **not executed by this audit**. Run only the
relevant set; do not rerun all tests merely for this prose. Repository paths are relative to its root.

Read source-bound CI states without dispatching or mutating anything:

```powershell
gh run list --branch work/pre-v3-engine-integration-20260911 --workflow pre-p4-integrity.yml --limit 10 --json databaseId,headSha,headBranch,status,conclusion,url
gh run list --branch work/pre-v3-engine-integration-20260911 --workflow build-android-dev-apk.yml --limit 10 --json databaseId,headSha,headBranch,status,conclusion,url
```

For a selected run, `gh run view RUN_ID --json headSha,headBranch,status,conclusion,url` must match
the selected commit. Keep artifact checksum, recovery/icon attestations, actual manifest and signing
inspection with that receipt; an old receipt cannot substitute. The existing attesters are
`scripts/ci/attest_recovery_redirect.py` and `scripts/ci/attest_launcher_icon.py`.

Focused source checks if build/push/Auth changes are made:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath scripts/__tests__/eas-preview-guard.test.ts scripts/__tests__/firebase-config.test.ts src/data/__tests__/native-push-device.test.ts src/data/__tests__/push-device-client.test.ts src/data/__tests__/push-runtime.test.tsx src/data/__tests__/push-preferences-native.test.tsx src/data/__tests__/auth-client.test.ts src/store/__tests__/session-epoch.test.ts src/data/__tests__/password-recovery-client.test.ts
```

Focused source checks for a closure/export continuation:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/data/__tests__/account-closure.test.ts src/data/__tests__/closure-execution-client.test.ts src/ui/closure/__tests__/closureIntent.test.ts src/ui/closure/__tests__/ClosureDialog.test.tsx src/data/__tests__/p2-data-export-client.test.ts src/data/__tests__/p2-data-export-delivery-client.test.ts src/data/__tests__/data-export-screen.test.tsx src/lib/__tests__/data-export-file-native.test.ts
```

For fresh DEV facts, use the approved connector to run the existing read-only
`docs/control/dev_snapshot.sql` plus Edge metadata, recording the observation time. Inspect specific
policy/operator/body facts through narrowly scoped read-only queries; never expose Vault/key contents
or call a worker merely to “see whether it works.” Schedule/metadata success cannot close actual
delivery or deletion gates. Any mutation/proof dispatch, controlled notification, certificate change,
production configuration, store publication or real account closure is outside this pass.

## Control-table continuation

The control table remains the sole living roadmap. This document adds evidence, not a second status
table or a completion percentage. Root should reconcile P03/P04, N04/N08/N09/N10/N11 and the applicable
store/production/payment rows with exact current receipts. In particular preserve N10 cross-device
recovery as open, distinguish P04 controlled test activation from general delivery, and retain
Telefon as unverified for untested current-build operations. This pass does not edit those rows.
