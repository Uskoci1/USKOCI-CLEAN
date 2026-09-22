# Verification / coverage reconciliation — 2026-09-22

Root integration addendum (later same day): PKG-00635775426480 and PKG-00735775426473
both finished successfully on9286fdeb. APK35775425984 remains tracked in PRODUCT_EXECUTION_RECEIPT.
Root also added five My Applications trigger paths to PKG-006 and the completion component/workspace
test paths to PKG-007. Both YAML documents parse; assertions confirmed all additions exist, all prior
paths remain and jobs/permissions are unchanged. This closes the specific trigger omissions below,
not the separate frozen AI source-admission gap. The independent observations remain dated below.

This is a bounded independent verification-department record, not a new full-suite run, fresh DEV audit, all-workflow certification or device acceptance receipt. It supplements `REPORT.md`, `CLIENT_ENGINE_RECONCILIATION.md` and the current product receipts. Implementation/control ownership remains with the root agent.

## Source and evidence boundary

- Inspection began at `45a779c7357bae4ba495f335b3898849bf7fbcc2`; the integrated client changes were committed by root during this pass as **`9286fdebbb4b7afea7a5e67889cdafb89e1d6928`**. Branch: `work/pre-v3-engine-integration-20260911`.
- Read workflow bodies for PKG-006, PKG-007, PKG-008, PKG-010, PKG-014B, W03 AI context and Android development APK; read the PKG-004 trigger list. Read the PKG-010 chain manifest/runner, AI frozen-source manifest/runner, control-generation logic and selected substantive client assertions listed below. Other workflows were searched for relevant commands; they were not all semantically audited.
- GitHub metadata/failed-log observations below were collected read-only on **2026-09-22, through 19:44 UTC**. No workflows were dispatched/retried, artifacts downloaded, tests/builds run, manifests changed, DEV queried, provider called or device operated in this pass. Only this new document is written.
- The saved DEV snapshot remains `docs/control/dev_snapshot.json` dated **2026-09-22T13:49:06Z**, ledger **197 = historical147 + dev_alpha50**. Historical disposable proof success must not be described as a fresh proof of those 197 deployed entries.
- Root reports the combined source check passed TypeScript and **242 suites / 4,719 tests, natural exit 0**, with the known Jest teardown warning. The initially lingering runner subsequently exited normally; no force-exit or process termination was needed. This is root's observed execution, not a duplicate run by this department. See `PRODUCT_EXECUTION_RECEIPT.json` for hashes/log paths and the final updated runner wording.

## What the matrix lights actually mean

`scripts/control/osvezi.mjs:77–140` computes four useful but primarily structural checks:

| Light | Actual implementation | Limit |
| --- | --- | --- |
| Screen | A named route file resolves. | Does not render, navigate or prove a reachable entrance. |
| Code | Named service/import graph is reachable and callable RPC/Edge names occur in source; explicit overrides can apply. | Does not execute callbacks, validate runtime permissions or prove response compatibility. |
| Server | Names exist in the saved RPC/Edge inventory; declared new functions/missing service calls are red. | Name/catalog presence is not fresh deployment, authorization, body or behavior verification. |
| Test | At least one test file contains a service/RPC token (`:124–129`); note is “N test files.” | **No test is executed and no assertion/result is parsed. Green means a matching file exists, not that its tests passed or cover the flow.** |
| Phone | A manually recorded `DOKAZANO`/partial state. | Must name the exact artifact, participant/role, action and evidence. Another screen's install or screenshot does not extend it. |

The recent CI list at `osvezi.mjs:152–165` is separate metadata, not a binding between each green test light and a successful run on the current source. `COVERAGE.md`'s 48 matrix sections cover 48 tracked route files, not 48 separately exercised screens. It also records a then-local ignored fixture route; a clean CI checkout and a dirty local Expo bundle have different input boundaries. Do not reproduce its historical “waiting for approval” prose as a current blocker: subsequent implementation was authorized.

## CI run reconciliation

| Evidence | Observed result | What may be claimed |
| --- | --- | --- |
| [PKG-006 35773399611](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35773399611), source `45a779c7` | Success; actual disposable selection/concurrency step, types and full Jest succeeded. | Source-bound predecessor selection/client regression evidence. Does not include the later completion review/accessibility changes. |
| [APK 35773412874](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35773412874), source `45a779c7` | Success. | Predecessor ARM64 build. Root's separate product receipt records actual selected-offer phone observation; this department did not perform it. |
| [PKG-010 35676936960](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35676936960), source `ec3b3d43` | Latest run of this workflow is green. Job steps show chain, types, Node tests, focused client regressions and full Jest succeeded. | Historical-source full workflow completion. Not a current-`9286fdeb` or deployed197 proof. No artifact was downloaded to independently recheck the selected-proofs receipt. |
| [PKG-010 35676222560](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35676222560) / [35675491771](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35675491771) | Earlier failures in `v5_worker_turn_recovery_proof.mjs`, checks9, history141/20260913022110, state assertion expecting FAILED. | Preserve as historical recovery-proof failures, superseded by the later green run. The inspected failure is not an AI fingerprint-manifest failure. |
| [PKG-014B 35704252850](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35704252850), source `d73d8c5a` | Latest run red. Disposable SQL usage proof and types succeeded; Node tests **355 passed / 0 failed**; subsequent frozen-source runner failed. Full Jest was skipped. | SQL usage/callback evidence only within that candidate's disposable boundary, plus passing Node assertions. Overall package verification remains red. |
| [PKG-006 35775426480](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35775426480), [PKG-007 35775426473](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35775426473), [APK 35775425984](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35775425984), source `9286fdeb` | In progress at this inspection. | Root/next agent must record final results; no success inferred from dispatch or predecessor success. |

## Confirmed AI fingerprint gap

The latest PKG-014B failed step is “Edge handler and fingerprint proofs on the changed helper” (`pkg014b-ai-provider-usage-proof.yml:182–186`). The test command completed with 355 passing tests, then `supabase/proofs/ai/ai_edge_context_proof.mjs:31–40` compared LF-normalized file bytes/hashes to `ai_edge_context_files.json` and failed before its own targeted handler test subprocess:

`FROZEN_SOURCE_CHANGED:supabase/functions/uskoci-ai-interview/index.ts`

Read-only recalculation against the current working tree confirms **two** mismatches; the first assertion masks the second:

| File | Manifest bytes / SHA-256 | Current LF bytes / SHA-256 |
| --- | --- | --- |
| `supabase/functions/uskoci-ai-interview/index.ts` | 56948 / `7e8c3c1838726580fef89fdc919892c1ebc595d01a907cf60aa7f5e8bca3b77e` | 59108 / `eb0a73ace538d1096e96e8890079e308529ae1c4dbbae3b456c96b4ce11522a2` |
| `supabase/proofs/ai/ai_edge_context.test.mjs` | 32745 / `e8f4c3b5039421afc52e7be2e3e897c30a6a80bfca3a396cb8f30d20a2fd4916` | 35663 / `47f3c831d260fb9020d539000d48bd0ab37a5f3c99dff0522ddff3e7342456cd` |

This is an unresolved source-admission discrepancy, not evidence that the 355 assertions failed. It must not be bypassed because they passed. Next authorized proof-maintenance task: review the exact handler/test diff since the manifest freeze, preserve the new meaningful regressions, document the admitted semantic change, then deliberately re-freeze the exact bytes and rerun the same source-bound gate. Do not bulk regenerate allowlists or weaken the equality check.

Also inspect `.github/workflows/ai-edge-context-proof.yml:59`, which requires `testsPassed === 92`. It consumes the same runner and is a second count-sensitive admission boundary. This pass did not execute that targeted subprocess or determine its current runtime test count; a count of textual `test()` declarations is insufficient because tests are parameterized. Reconcile the exact actual targeted result and its intended boundary during the same review, not by choosing a number to make CI green.

PKG-010 executes discovered `*.test.cjs/*.test.mjs` files; PKG-014B separately invokes the non-test `ai_edge_context_proof.mjs` runner. Therefore a green PKG-010 Node step cannot substitute for the frozen-source runner or erase PKG-014B's red gate. No additional current PKG-010 manifest failure was established by the bounded metadata/log inspection.

## Workflow strength and limits

| Workflow/source | Actual exercised boundary | Evidence that remains outside it |
| --- | --- | --- |
| PKG-006 | Historical live79 reconstructed, aliases80–87 and pending provenance migrations applied to147; real disposable Auth fixture; exact application/selection/capacity/calendar concurrency proof; types, four focused files and full Jest (`pkg006-application-selection-proof.yml:69–150`). | Current dev_alpha50, installed-app submit/notification landing, native virtualization or visual acceptance. |
| PKG-007 | Types plus eight focused client files and full Jest (`pkg007-agreement-completion-proof.yml:63–79`). | **No database is started in this workflow.** Server completion authority and real requester/worker transitions require separate database/device evidence. “Agreement completion proof” is not itself a live two-party completion test. |
| PKG-008 | Applies `supabase/candidates/pkg008_media_upload_cancellation.sql` to disposable147, asserts RPC/ACL/claim refusal, runs rollback-only owner/attacker/service cancellation proof, then client/full Jest. | Candidate admission does not mean the function exists in DEV. Saved catalog still records missing `rpc_cancel_media_upload`; mocked client success cannot close that gap. |
| PKG-010 | `chain.json` fixes final147/version20260913081242, 31 ordered V5 proof scripts, predecessor counts and migration ownership. Runner checks proof result/source binding and history; Node and client gates follow. | Not deployed197 coverage, provider quality, actual push/export/closure workers or phone. During the disposable chain cron drains/tick scheduling are paused to avoid interference; this is not scheduler-load testing. |
| PKG-010 dispatch options | `chain.py:17–20,108`: only `all` is receipt-grade FULL_CHAIN; subsets replay omitted migrations and record DIAGNOSTIC_SUBSET. Workflow `source_gates:false` skips types/Node/focused/full gates. | A green manually dispatched diagnostic job must not be summarized as full package verification. Inspect mode, selected proofs and step outcomes. |
| PKG-014B SQL | Reservation-required, first-report-wins/idempotency, overwrite/malformed/client refusal, accounting/report shape and unchanged budget ceiling; synthetic rows rolled back (`pkg014b_ai_provider_usage_runtime_proof.sql`). | A real provider token bill, cost accuracy, model meaning, deployed usage reporting or production spend. |
| PKG-014B “touches no existing object” step | Compares function **identity signatures**, table names and policy names (`pkg014b-ai-provider-usage-proof.yml:112–156`). | Does not fingerprint existing function bodies, column definitions, policy expressions, ACLs or triggers. Wording overstates this particular check. For a future candidate touching this surface, compare the relevant definitions/privileges explicitly before claiming no changes. No present body alteration was inferred solely from this weakness. |
| W03 AI context | Actual Edge handler loaded with synthetic environment/fetch; runner records provider=false, database=false, deployed=false. Optional intake scope adds historical disposable SQL106. | Actual Gemini output quality, real timezone interpretation across arbitrary language/history, deployed Edge behavior or real-provider usage. |
| Android DEV APK | Locked dependency install, asset WebP check, Expo native prebuild, selected ARM64/x86_64 ABI, Gradle assembleRelease, compiled recovery/icon attestations and APK checksum. | Workflow contains no TypeScript/Jest command or app interaction; lintVitalAnalyzeRelease is excluded. Build success proves packaging/selected attestations, not phone acceptance or store readiness. |

Several workflows write/upload receipts under `if: always()`. An artifact or receipt's existence is therefore not a PASS signal: PKG-014B uploaded its receipt despite failure and skipped full Jest. Bind source SHA/tree, step conclusions, proof report result and test totals together.

## Selected flow assertions versus remaining acceptance

This is an assertion-level sample across high-risk flow families, not an exhaustive enumeration of all 4,719 tests.

| Flow / inspected test references | Concrete assertions present | Not established by those assertions; minimal next evidence |
| --- | --- | --- |
| Discovery/search, F06–F09 | `opportunities-read.test.ts:50–66` checks keyset cursor progression, exact200 limit, no duplicate row and refusal of endless pagination. `marketplace-presentation.test.tsx:40–79` checks common list/map result selection, query clear, filter removal, area and cancel/Apply behavior. | RPC/profile/map transports are mocked. Does not measure5000-task latency or prove server-side search/count semantics. Native map/font/keyboard and realistic large-list acceptance remain; preserve exact full-list semantics before introducing pagination. |
| Offer review/selection/landing, F10 | `application-selection-native.test.tsx:111–257` checks first review causes no write, exact reviewed terms, duplicate submit, named confirmed application navigation once, immutable unknown retry, blur/account-incarnation fences. Candidate/view tests at155–199 preserve intentional-open mutation. | Router/Press/Modal are mocked; FlatList renders only its initial viewport and Platform is web (`:11–34`). Does not prove retained real list offset, physical tap targets, accessibility announcement or actual native route restoration. No scroll bug was established in this pass. |
| Candidate accessible preview, F10/A11 | `application-selection-native.test.tsx:86–109` asserts actual total/people/time/note in hint, bounded long Unicode preview, no viewed/select call during reading, one viewed call on opening, full note preserved. Both strengthened/new cases failed before the correction; focused file37 passed afterward. | Real TalkBack/VoiceOver grouping/hint settings, long-name layout and native focus order still need exact-build acceptance. Accessible-prop inspection is not a screen-reader session. |
| My Applications, F10/B09–B10 | `my-applications-native.test.tsx` covers named row targeting, stale-only controls, exact command-state read, retained handlers, account/focus and unknown-outcome fences. `my-applications-command-state.test.ts` isolates exact owned recovery. | An older scrolled retained tab, a second named target, excluded current filter and notification entry need native observation. Pagination must continue named command readback even when the row is outside the current page. |
| Completion review, D10/D11 | `agreement-screen-recovery.test.tsx:174–276,488–559,619–688` exercises both roles, explicit confirmation, duplicate/cross-action serialization, dismissed/retained review, read/focus/background/account invalidation, unknown result and authoritative completion readback. `pkg011-agreement-workspace.test.tsx` covers displayed accepted terms, Back and motion preference. | New modal is mocked in renderer tests. Four focused suites126 passed with types (agent receipt); root combined full result is above. Real applicable Agreement for both participants, hardware Back, large text, intervening change and uncertain network require current APK acceptance. Browser fixture is not that acceptance. |
| Media, F16/A05 | `media-client.test.ts:20–35,86–116` proves exact upload identity, unknown same-key reads/no blind upload, cancellation RPC parameters, strict cancellation receipt and account ABA rejection. | `mockRpc` accepts the candidate cancellation shape although saved DEV lacks the function. Need separately admitted server package and late-upload/cancel race against its actual predecessor. |
| Safety, F05 | Existing safety service tests validate commands, ownership and uncertain outcomes; selected Agreement target contract is source-traced in the integration document. | Service token/test presence does not create a safe target account for public task/profile entrances. Add contract negatives and actual entrance/navigation coverage after target resolver/projection admission. |
| Inbox/push, F13/F14 | `inbox-client.test.ts:8–69` checks paired cursor, failure distinct from empty, authoritative mark timestamps, bounded unknown timeout and destination-kind rejection. `inbox-hook.test.tsx:23–46` checks account ABA, focus/background retirement. `push-runtime.test.tsx` simulates cold tap readiness, foreground teardown and unsupported web. | Mock Expo/native callbacks do not prove enabled transport, emitter→recipient parity, OS permission/token rotation, delivery or a destination for every24 UX events. Two-device warm/cold/background and exact subdestination matrix remain. |
| Closure/export/account | `account-closure.test.ts:17–74` and `closure-execution-client.test.ts:11–38` prove immutable request/policy binding, no invented readiness, exact-key recovery, safe denial and partial/complete receipt interpretation. PKG-010 includes relevant disposable/client families. | Exact-key recovery on one device does not establish START-key discovery on another empty-journal device or REST access while restricted. Policy publication, actual export delivery/download and closure worker execution require distinct approved operational evidence. |
| Reviews/reputation | `reviews-authority.test.ts:12–74` checks immutable review command, invalid input/receipt rejection, own context only, no fabricated zero rating and account fence. | Mocked RPC result does not prove delayed reveal/aggregation against deployed data, two-person completion/review journey or scheduler timing. Preserve unknown/unavailable rating copy. |

The approved report's unresolved safety target, media cancellation, closure recovery, paging and notification destination findings are not contradicted by green client tests. See `CLIENT_ENGINE_RECONCILIATION.md` for exact current callers/contracts and minimal implementation proposals.

## Jest process evidence

- `jest.config.cjs:25–29` selects `**/__tests__/**/*.test.ts?(x)` under the Expo preset, with UTC explicitly set; it does not include the separate Node `.mjs/.cjs` proof suites. “Full Jest” does not mean all repository proof programs.
- `package.json` defines test as `jest`. Examined workflow invocations use `--runInBand`; repository workflow search and current audit receipt/doc search found no `--forceExit` usage. This does not reconstruct every past local shell command.
- Earlier `CLIENT_FOUNDATION_RECEIPT.json`, `DISCOVERY_SEARCH_RECEIPT.json`, `OFFER_LANDING_RECEIPT.json` and `OFFER_READABILITY_RECEIPT.json` explicitly record exit0 and teardown warnings. These are dated source-specific claims, not permission to assume that a later runner exits.
- The new root run completed4,719 assertions, initially lingered, then **returned exit0 naturally**, with the warning retained. Preserve both assertion result and process result in the final receipt.
- There is a distinct historical diagnosis in `docs/implementation/v5-ai-first/PR102_SOURCE_CHECK_REVIEW.md:19–35`: a partial React Native mock caused Expo lazy logger access during teardown; that issue was fixed with the absent optional TurboModule lookup and validated without forceExit. Do not reuse that old diagnosis as the cause of today's still-unattributed warning.
- If a later run truly hangs or exits nonzero, preserve its output and inspect handles on the smallest reproducing subset. Do not change production timers, mask console output, force exit, or rerun the entire suite repeatedly merely to turn the receipt green.

## Ranked continuation

1. **Finish current-source gates and artifact evidence.** Read final metadata for the three `9286fdeb` runs above; record any failing/skipped step and the final root runner exit. Bind APK hash/ABI/compiled attestations to that SHA, then record only the phone flows actually exercised. Keep predecessor phone observations separate.
2. **Resolve the proven PKG-014B source-admission discrepancy in a dedicated reviewed change.** Review/re-freeze the two exact changed files; verify W03's hardcoded targeted count; rerun the same package/source gate on the admitted commit. Do not call old355 Node passes a replacement for the failed manifest gate. No repair was made here.
3. **Close path-trigger omissions deliberately.** PKG-006's `paths` (`:7–17`) omits `src/ui/v2/MyApplicationsPresentation.tsx`, its route and its tests; a MyApplications-only change does not trigger that named workflow. PKG-007's `paths` (`:7–25`) omits new `src/ui/agreements/AgreementCompletionReview.tsx` and `pkg011-agreement-workspace.test.tsx`; this integrated change is covered because it also changed the watched Agreement route/recovery test, but a later component-only patch would not trigger it. Add the appropriate paths or document/verify another mandatory gate covering them; do not assume these omissions prove no other CI ran.
4. **Improve evidence naming before expanding claims.** Keep control “test file found” distinct from successful exact-source assertions and phone proof. For PKG-014B no-existing-object claims, compare relevant definitions/ACLs, not only catalog names. For PKG-010 require FULL_CHAIN and source gates, and state the historical147 boundary.
5. **Use decisive missing evidence for unresolved integration seams.** Media cancellation needs actual admitted server contract; public safety needs target authority; closure needs restricted empty-journal recovery; discovery needs filtered page/count/field parity; Inbox/push needs24-event/two-device evidence. These are separate packages/acceptance steps, not reasons to loosen existing tests.

Read-only continuation commands (not dispatch instructions):

```powershell
gh run view 35775426480 --json headSha,conclusion,jobs
gh run view 35775426473 --json headSha,conclusion,jobs
gh run view 35775425984 --json headSha,conclusion,jobs
gh run list --workflow pkg014b-ai-provider-usage-proof.yml --limit 3 --json databaseId,headSha,status,conclusion,createdAt
gh run list --workflow pkg010-system-contracts-proof.yml --limit 3 --json databaseId,headSha,status,conclusion,createdAt
```

For an actually failed gate, inspect only that run's failed-step log and preserve its boundary. This department did not run a new test/build or alter a proof manifest, workflow, control row, source file, server or dependency.
