# USKOČI — PKG-001..PKG-024 reconciliation against current source, Ledger and CI

Recorded: 2026-09-16 (Europe/Belgrade). Head: `f7c7a3ee38e5e1d6df4fc185dd94b567e0e98ba3` on `work/pre-v3-engine-integration-20260911` (PR #102, draft, mergeable). Code candidate: `b2f72b78772f29c1da3fa7d3d17c48902a46171c` / tree `34b56db7881623ce496d0652b793f854c08eedca`.

Authority order used: current source on the branch, PR #102, `EXECUTION_LEDGER.jsonl` (7 events), executed GitHub Actions runs, live DEV/ALPHA reads dated 2026-09-15, then V19 (snapshot `45e0f31`, 76 commits behind head) only for package definitions, gaps and predecessors. Where V19 and current source disagree, current source and executed proof win. This file derives status; it does not rewrite V19 or any Ledger event.

## Status vocabulary

Ledger statuses only. "Fresh" means the package's changed files and their production importers are unchanged between the proof candidate and head, or the suites were re-executed on head. "Executed" means a GitHub hosted runner ran the step; a skipped or never-started step is not proof.

## Summary

| Status | Packages |
|---|---|
| DONE_VERIFIED, fresh on head | PKG-002, PKG-003 (as of `ddae0c5`, run 35037260591), PKG-005, PKG-009 |
| DONE_VERIFIED (audit only), inventory stale | PKG-001 |
| IMPLEMENTED_PENDING_VERIFICATION | PKG-004 (executed, unreviewed) |
| MISSING_PROOF (mechanism exists, not yet executed on head) | PKG-013 |
| BLOCKED | PKG-014 (needs PKG-013 + owner batch approval), PKG-018 (provider diagnosis + AF-D04) |
| NOT_STARTED | PKG-006, 007, 008, 010, 011, 012, 015, 016, 017, 019, 020, 021, 022, 023, 024 |

Order of the next work per V19 topology: PKG-003 → PKG-004 → PKG-007 → PKG-008 → PKG-006 → PKG-010 → PKG-011 → PKG-012 → PKG-013 → PKG-014 → … PKG-009 is already fresh and is skipped.

## Per package

### PKG-001 — Coverage / lineage audit
- Gaps: GAP-0017 (RESOLVED in V18/V19).
- Implementation present: audit only, no app source.
- Last exact proof: EVID-0189 at `45e0f31` (V19).
- Fresh / source changed: inventory drifted. 29 files added and 27 modified since `45e0f31` (14 tests, 4 evidence files, 3 workflows, 2 app routes `novi-zadatak.tsx` and `rucni-zadatak.tsx`, 1 data service `manualNeedFactClientService.ts`, 1 SQL candidate, 1 SQL proof, 2 ledger files, 1 CI test).
- Current status: DONE_VERIFIED (AUDIT_ONLY) with STALE inventory.
- Missing proof: classification of the 29 new files.
- Blocker: none. Next: extend coverage at the next control snapshot; no code work.

### PKG-002 — Strict response boundaries and safe copy
- Gaps: GAP-0029, GAP-0035, GAP-0037, GAP-0038.
- Implementation present: yes. Files `app.config.js`, `src/data/aiNeedTurnStream.ts`, `src/data/authClientService.ts`, `src/data/processorMapClientService.ts`; suites `pkg002-ai-stream-boundary`, `pkg002-app-config`, `pkg002-auth-safe-errors`, `pkg002-processor-map`.
- Last exact proof: Ledger `PKG-002-RECEIPT-20260915-001`, candidate `592786a` (GitHub pull_request merge ref of branch commit `5dee665`), PRE-P4 run 34946355138 success.
- Fresh / source changed: fresh. None of the four files, and no production importer of them, changed between `5dee665` and head; the suites were re-executed in the full regression on `b2f72b7` (run 35031818085, 4181/4181).
- Current status: DONE_VERIFIED.
- Missing proof: none. Note: the receipt binds to a merge ref, not a branch commit; freshness was checked against `5dee665`.
- Blocker: none. Next: none.

### PKG-003 — One task entry: AI and manual path
- Gaps: GAP-0015, GAP-0039, GAP-0040.
- Implementation present: yes. 20 commits since V19: `novi-zadatak.tsx` chooser (AI-first primary, manual branch), `rucni-zadatak.tsx` manual route, `manualNeedFactClientService.ts`, deterministic civil-time/DST correction, location return to canonical review, SQL candidate `supabase/candidates/pkg003_manual_need_fact_v2.sql`, runtime proof SQL; suites `pkg003-location-return`, `pkg003-manual-entry-source`, `pkg003-manual-need-fact`, `pkg003-timezone` executed and passing in the full regression on `b2f72b7`.
- Last exact proof: Ledger `PKG-003-RECEIPT-20260915-001` IMPLEMENTED_PENDING_VERIFICATION at `592786a` with GAP-0015 open. The dedicated workflow (disposable database, replay of all exact source migrations, candidate SQL, rollback-only attacker/replay proof, app tests) never executed before: runs 34976683832 and 34986621155 ended with zero steps under the GitHub billing lock.
- Executed now: run 35033856315 dispatched on `f7c7a3e` — FAILURE at step "Start disposable database and replay exact source migrations". `supabase db reset --local` replayed the raw migrations directory on Postgres image `17.6.1.167` (CLI `version: latest`) and stopped at the third migration, `20260829183528_clean_security_hardening.sql`, with `function public.rls_auto_enable() does not exist (42883)`. That function is a hosted-project helper, created in the repository only by the proof shim `supabase/proofs/ru2_predecessor_bootstrap.sql`. Every other replay workflow (P0D-02, RU-2, RU-5 proofs, and the shared `ru5_device_ui_live79_env.sh` used by the PRE-P4 domain proofs) copies that shim as the earliest migration before reset and most pin CLI `2.116.0`; the PKG-003 workflow does neither. This is a defect of the PKG-003 proof workflow, not of the migrations or the candidate SQL, and none of the PKG-003 SQL or app steps executed.
- Update, 2026-09-16 (three further runs, all workflow/proof-only changes): `fb07ca5` added the shim and pinned CLI 2.116.0; run 35035407188 then passed 54 files and stopped at `20260901105922_clean_completion_and_writer_authenticated_proof.sql` (`AUTH_PROOF_FIXTURE_REQUIRED`), which is why every replay workflow substitutes the three 2026-09-01 proof files, and from migration 57 each file asserts the exact history count and the live alias version of its predecessor, so a raw source-timestamp replay can never pass 57. `2552b1a` switched the workflow to the shared `ru5_device_ui_live79_env.sh` reconstruction plus a provenance-driven replay of the recorded live80-87 aliases and all 60 pending files; run 35035945857 replayed all 147 source files (`history=147/20260913081242`), applied the candidate, passed every owner/attacker/replay/location/review check and failed only in the final ACL guard, because the proof still impersonated `authenticated` when resolving `private.*` names. `ddae0c5` added `reset role;` before that guard.
- Executed proof: run 35037260591 on `ddae0c5`, 19/19 steps, no failures: live79 reconstruction, replay to 147, candidate SQL, `PASS PKG003_MANUAL_NEED_FACT provider_independent owner_only idempotent one_live_fact location_authority canonical_review canonical_draft zero_residue`, TypeScript, focused 4 suites 24/24, full regression 212 suites 4181/4181; artifact 10423821504.
- Current status: DONE_VERIFIED, Ledger `PKG-003-RECEIPT-20260916-003`, resolving GAP-0015, GAP-0039 and GAP-0040 on the exact candidate. The candidate SQL remains unapplied on DEV; its promotion belongs to PKG-014.
- Side finding for PKG-013: this is the first disposable database built from all 147 source files, using the recorded aliases for 57-87 and source versions for 88-147; the ordered chain including 145→146→147 replays cleanly under that reconstruction.

### PKG-004 — Task lifecycle and remaining-search closure
- Gaps: GAP-0025, GAP-0026, GAP-0030.
- Implementation present: yes. 14 commits: lifecycle recovery mounted outside the Need-success branch, strict close receipt/readback, closed public projection and application refusal; suites `pkg004-lifecycle-recovery`, `pkg004-lifecycle-wiring`, `pkg004-remaining-search` plus 6 related suites.
- Last exact proof: run 35031817969 on `b2f72b7` (13/13 steps executed; focused 9 suites 152/152; full 212/4181). Ledger `PKG-004-RECEIPT-20260916-001`.
- Fresh / source changed: fresh (nothing changed after the run except documentation).
- Current status: IMPLEMENTED_PENDING_VERIFICATION.
- Missing proof: review of suite-to-GAP mapping, positive scenarios and replay/account guards; the harness defect (react-native mock) fixed in `b2f72b7` means these suites had never executed before.
- Blocker: none. Next: review, then DONE_VERIFIED receipt bound to run 35031817969 or a fresh exact run.

### PKG-005 — Worker onboarding and Worker-only calendar
- Gaps: GAP-0027, GAP-0028.
- Last exact proof: run 35031818085 on `b2f72b7`, 16/16 steps, full regression 4181/4181; Ledger `PKG-005-RECEIPT-20260916-003`.
- Current status: DONE_VERIFIED, fresh. Next: none.

### PKG-006 — Durable application identity and concurrent selection
- Gaps: GAP-0031, GAP-0023.
- Implementation present: partial signals only. `prilike/[id]/prijava.tsx` creates a `clientRequestId` via `noviZahtevId` but has no persistence/journal across remount (no AsyncStorage or journal reference), so GAP-0031 is not addressed in source. Server-side selection idempotency (P0D-02, live) and worker capacity CAS (`clean_pre_v3_worker_capacity`, live) exist, but no current-source concurrency proof binds them to head.
- Last exact proof: none for the package. Historical P0D-02 proof run 34023168764 on `c3ada42` (2026-09-06) predates the branch.
- Current status: NOT_STARTED.
- Missing proof: all V19 tests (lost ACK/remount/A→B→A, same-key replay, overlapping Agreements, simultaneous selections and capacity CAS).
- Blocker: predecessor PKG-004 pending. Next: after PKG-007 and PKG-008 per topology.

### PKG-007 — Agreement completion and server permissions
- Gaps: GAP-0032, GAP-0033.
- Implementation present: no for GAP-0032. `src/app/dogovor/[id].tsx:153` derives `canComplete` from status (`active && me && (requester || stanje === 'CONFIRMED')`) while `agreementClientService.ts:283` already parses the server `actionState`; the completion buttons ignore it (DRIFT-0013 still present on head). GAP-0033 (structured completion receipt / terminal readback) not re-inspected.
- Last exact proof: none.
- Current status: NOT_STARTED.
- Blocker: PKG-002 done, so ready after PKG-004 in order. Next: bounded source change plus guard tests.

### PKG-008 — Unconfirmed photo recovery
- Gap: GAP-0036.
- Implementation present: partial. `fotografije-zadatka.tsx` reads the upload command receipt and offers "Nastavi slanje iste fotografije"; `AgreementPhotoComposer` shows unconfirmed states and same-key retry. This source existed at V19 (2026-09-13), so V19 judged the gap on the same code: the remount-after-lost-bytes cancel/reconcile boundary is what remains unreviewed.
- Current status: NOT_STARTED. Blocker: none after PKG-002. Next: after PKG-007.

### PKG-009 — User-editable notification preferences
- Gap: GAP-0034.
- Last exact proof: Ledger `PKG-009-RECEIPT-20260915-001` at `592786a`, run 34946355138.
- Fresh: yes. `PushPreferences.tsx`, its test and its importers unchanged since `5dee665`; re-executed in the full regression on `b2f72b7`.
- Current status: DONE_VERIFIED. Next: none (physical push delivery belongs to PKG-020).

### PKG-010 — Safety, support, export and closure contracts
- Gap: GAP-0020.
- Implementation present: partial. Support inbox/new/detail/operator screens and controller, export screen with authenticated download and readback, legal/processor screens, safety and blocked-accounts screens all exist and all nine formerly orphan services now have production importers. Account closure execution is hardcoded not ready (`canExecute:false`, `executionReady:false`) and depends on SQL 146, which is not applied on DEV.
- Last exact proof: historical P1/P2/P3/P4 domain proofs on older shas; nothing on head.
- Current status: NOT_STARTED (as a package). Blocker: predecessor PKG-008; closure execution also depends on PKG-014.

### PKG-011 — Coherent screens over the same engine
- Implementation present: the V5 route inventory has 49 routes and UI modules for aiFirst, agreements, calendar, closure, groups, legal, location, media, needs, notifications, qa, reviews, safety, settings, support, workerProfile. The package itself (flow-by-flow parity, state owner extraction) is not started.
- Current status: NOT_STARTED. Blocker: PKG-002..PKG-010.

### PKG-012 — Documentation, test simulation and legacy isolation
- Gap: GAP-0012.
- Implementation present: no. `docs/implementation/v5-ai-first/EXECUTION.md` still opens with the 2026-09-13 "FINAL STOP CHECKPOINT"; V19 remains historical by design; 19 cleanup candidates, 0 retirement-eligible (V18).
- Current status: NOT_STARTED. Blocker: PKG-011.

### PKG-013 — Exact source: regression and full schema147 disposable integration
- Gap: GAP-0005.
- Implementation present (mechanism): `PRE-P4 integrity` on `workflow_dispatch` with `level=release` runs the full Jest suite and all nine domain disposable proofs (push, w03, auth, export, retention, consent, processors, policy, w02); on draft-PR and push events those jobs are skipped by `scripts/ci/scope.cjs`. The PKG-003 workflow additionally replays all exact source migrations into a disposable database. The former PRE-V3 staged-SQL workflows are no longer on the branch.
- Last exact proof: full Jest on `b2f72b7` passed (4181/4181, three runs). No release-level PRE-P4 run existed on any current commit before today; last per-domain disposable successes date from 2026-09-03..06 on older shas.
- Executed now: PRE-P4 release dispatch on `f7c7a3e`, run 35034055981 — FAILURE after 440 s. `pre-p4-integrity` (TypeScript, full Jest 4181/4181, build receipt) succeeded; the nine domain proofs then ran for the first time on this branch with this result:

| Domain job | Result | Cause on head (from logs and evidence artifacts) | Class |
|---|---|---|---|
| domain-processors (P4) | success | — | proof of head |
| domain-auth / isolated-auth-recovery (W01) | success | — | proof of head |
| domain-auth / android-auth-recovery | failure | `android-actions/setup-android` sdkmanager exit 1 before any project step | infrastructure |
| domain-retention (P3) | failure | `W03_EXACT_SOURCE108_REQUIRED: 147 !== 108` | harness frozen at source108 |
| domain-export (P2) | failure | `W03_EXACT_SOURCE108_REQUIRED: 147 !== 108` | harness frozen at source108 |
| domain-w02 (calendar) | failure | `W03_EXACT_SOURCE108_REQUIRED` | harness frozen at source108 |
| domain-w03 (ai-edge-context) | failure | `FROZEN_SOURCE_CHANGED: supabase/functions/uskoci-ai-interview/index.ts` expected 38731 bytes, actual 40847 (sha `dfe9fec7…`, the 2026-09-13 Gemini 3.8 wire change) | harness frozen Edge fingerprint |
| domain-policy (D-0140-A) | failure | `publication_evaluator_edge.test.mjs` passed 40/40, then the workflow's TAP verifier requires exactly `tests 31` | harness frozen test count |
| domain-push (N09 transport) | failure | `ACTUAL_HANDLER_REAL_DATABASE_SYNTHETIC_EXPO_MINIMAL_PAYLOAD` ERR_ASSERTION at `n09_push_transport_proof.mjs:114`; actual handler, real disposable DB, synthetic Expo; six earlier checks passed | UNREVIEWED: candidate defect or stale expectation not determined |
| domain-consent (P1) | failure | `ADMITTED_SUCCESSOR_DOMAIN_INTEGRATION`: `DOMAIN_STATE_SECURITY_OR_RPC_CHANGED_BY_SUCCESSOR` (columnGrants diff on `private.legal_document_kind_version_uq…`) with SQLSTATE 23505; the ten P1 checks themselves passed | UNREVIEWED: a successor migration changes legal-domain state the proof expects unchanged; whether that change is intended has not been reviewed |

  The source108 boundary is deliberate: the harnesses contain passing tests named "expanded current source is rejected by the unchanged SQL108 boundary", so they refuse source147 by design until re-baselined. These proofs therefore currently prove the historical source108 boundary, not the head candidate.
- Current status: MISSING_PROOF for the disposable boundary on head, now with executed evidence of why; formally BLOCKED_DEPENDENCIES per V19 (PKG-003..PKG-012).
- Missing proof: re-baselined domain harnesses (source147 admission, current Edge fingerprints, current TAP counts), the two unreviewed failures explained, and hostile/replay/concurrency/Storage cases on head. No release-level PRE-P4 had ever run on this branch before this run because PR #102 is a draft and pushes do not run domains.
- Partial positive evidence, 2026-09-16: the PKG-003 workflow (`.github/workflows/pkg003-manual-task-proof.yml` at `ddae0c5`) now reconstructs the recorded live79 through the shared environment and replays live80-87 with their provenance aliases and all 60 pending files in order; run 35037260591 reached `history=147/20260913081242` in a disposable database, so the ordered chain through 145→146→147 is replayable under that reconstruction. That covers the schema chain only, not the domain harnesses' hostile/replay/Storage cases.

### PKG-014 — Canonical DEV alignment and Edge deployment
- Gaps: GAP-0001, GAP-0002, GAP-0019 — all confirmed live on 2026-09-15: 146 migrations applied, `clean_v5_self_reported_identity_requirement`, `clean_v5_event_bound_account_erasure`, `clean_v5_qa_owner_product_activation` not applied; `uskoci-account-closure-worker` present in source, absent from the 10 deployed functions; `uskoci-ai-interview` v32 (deployed 2026-09-13 13:33Z) rewrites the Gemini stream URL to `generateContent` and emits one text delta, while the repository helper (2026-09-13 15:46Z) parses SSE progressively.
- Current status: BLOCKED. Blocker: PKG-013 result and owner batch approval (AF-D07) for the exact 145→147 + Edge batch; AF-D26 already authorizes DEV/ALPHA changes with reconstructible source.

### PKG-015 — DEV data lineage and isolated test accounts
- Gap: GAP-0018.
- Implementation present: no lineage table. DEV rows on 2026-09-15: 5 accounts, 10 profiles, 7 needs, 2 agreements, 2 agreement messages, 31 AI conversations, 145 AI facts, 0 push attempts. AF-D20 approved one labelled internal QA account; `dev_alpha_owner_ai_test_admission` exists live.
- Current status: NOT_STARTED. Blocker: PKG-014.

### PKG-016 — Source-bound Android artifact
- Gaps: GAP-0007, GAP-0041.
- Implementation present: build workflow exists. Last attempt: `944fee9` (2026-09-13) recorded as `LOCAL_SIGNED_APK_FINAL_ATTESTATION_FAILED`, package `rs.uskoci.preview`. `app.json` still points launcher/adaptive/favicon to Expo template assets (`assets/images/icon.png`, `android-icon-foreground.png`, `favicon.png`); no USKOČI launcher asset exists in the repository, so GAP-0041 is confirmed on head.
- Current status: NOT_STARTED. Blocker: PKG-013, PKG-014; owner-approved launcher art.

### PKG-017 — Auth, intents, deep links and restart on device
- Gaps: GAP-0008, GAP-0022.
- Implementation present in source: account revision fencing, `oporavak.tsx` recovery route, `+native-intent.tsx`; no device proof after V19.
- Current status: NOT_STARTED. Blocker: PKG-015, PKG-016.

### PKG-018 — One controlled Requester AI, then Worker AI
- Gaps: GAP-0003, GAP-0004.
- Live on 2026-09-15: `private.ai_need_turn_commands` 15 turns, 0 SUCCEEDED (8 FAILED not dispatched, 6 FAILED dispatched, 1 PROCESSING with lease expired 2026-09-13 13:44Z); `private.worker_ai_turns` 3 FAILED. Edge gate requires `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`, `USKOCI_GEMINI_PAID_TEST_ENABLED=true` and a budget reservation; provider inventory lists GOOGLE_GEMINI_AI active.
- Current status: BLOCKED. Blocker: PKG-014/016/017; diagnosis of the six dispatched failures (receipts empty); AF-D04 model availability on the account. Next: one bounded diagnosis, no blind retries.

### PKG-019 — Real voice, location, map and media
- Gaps: GAP-0010, GAP-0011, GAP-0021.
- Implementation present in source: `src/features/voice/*` with native module `modules/uskoci-voice` (Android, Kotlin) and Edge `uskoci-speech-session` (Gemini BidiGenerateContent, transient processing approved by AF-D24); `uskoci-location-search` v13; MapLibre `DiscoveryMap`; `uskoci-media` Edge with `clean_v5_owned_media` live. No device or provider proof.
- Current status: NOT_STARTED (proof). Blocker: PKG-014, PKG-016, PKG-017. STT provider is decided, not open.

### PKG-020 — Real push ticket, receipt and display
- Gap: GAP-0009.
- Live: `notification_push_attempts` 0 rows, 1 registered device, EXPO_PUSH inactive in the processor inventory; `uskoci-push-transport` v11 deployed; `clean_n09_expo_push_transport` live.
- Current status: NOT_STARTED (proof). Blocker: PKG-014, PKG-016, PKG-017 (PKG-009 done).

### PKG-021 — Full marketplace A/B acceptance
- Gap: GAP-0006. Current status: NOT_STARTED. Blocker: PKG-003..008, PKG-015..020.

### PKG-022 — Runtime UI, accessibility and performance
- Gaps: GAP-0013, GAP-0014. Current status: NOT_STARTED. Blocker: PKG-011, PKG-016, PKG-021.

### PKG-023 — Safe retirement of legacy paths
- Gap: GAP-0016. 19 cleanup candidates, 0 retirement-eligible (V18). Current status: NOT_STARTED. Blocker: PKG-012, PKG-014, PKG-021, PKG-022.

### PKG-024 — Final candidate and owner acceptance
- Current status: NOT_STARTED. Blocker: PKG-013..PKG-023.

## Corrections to the V19 snapshot that this reconciliation establishes

- V19 lists PKG-002, PKG-003, PKG-004, PKG-005 and PKG-009 as NOT_STARTED; the Ledger and executed runs above supersede that.
- V19's 45-screen matrix (2026-09-08) marks 11 screens NOT IMPLEMENTED; on head 9 of them have source (password recovery, settings hub, privacy, AI worker profile, search/filters, reputation, task photos, voice), account closure is partial (execution gated on SQL 146), identity verification is intentionally absent per AF-D23.
- The V4.6 forensic claim that nine client services have no production importer is false on head; all nine are imported.
- Earlier Ledger receipts bind to `592786a`, a pull_request merge ref; later receipts bind to branch commits.

## Not re-adjudicated here

Gap-by-gap repro reviews for PKG-004, PKG-006, PKG-007, PKG-008 and PKG-010 were limited to source signals named above; they are not DONE/NOT-DONE verdicts. Live reads are from 2026-09-15 and were not repeated for this file. No production, provider, device or live mutation occurred.
