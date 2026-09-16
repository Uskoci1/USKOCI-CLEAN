# USKOČI — PKG-001..PKG-024 reconciliation against current source, Ledger and CI

Recorded: 2026-09-16 (Europe/Belgrade). Written at head `f7c7a3ee38e5e1d6df4fc185dd94b567e0e98ba3` and updated in place through `bdcb2c834add973b8a8b14445a9791f766c47a24` on `work/pre-v3-engine-integration-20260911` (PR #102, draft, mergeable). Each package section names the exact candidate its status is bound to.

Authority order used: current source on the branch, PR #102, `EXECUTION_LEDGER.jsonl` (7 events), executed GitHub Actions runs, live DEV/ALPHA reads dated 2026-09-15, then V19 (snapshot `45e0f31`, 76 commits behind head) only for package definitions, gaps and predecessors. Where V19 and current source disagree, current source and executed proof win. This file derives status; it does not rewrite V19 or any Ledger event.

## Status vocabulary

Ledger statuses only. "Fresh" means the package's changed files and their production importers are unchanged between the proof candidate and head, or the suites were re-executed on head. "Executed" means a GitHub hosted runner ran the step; a skipped or never-started step is not proof.

## Summary

| Status | Packages |
|---|---|
| DONE_VERIFIED, fresh on head | PKG-002, PKG-003 (as of `ddae0c5`, run 35037260591), PKG-004 (as of `bdcb2c8`, run 35038650179; re-verified on `ba098b8`, run 35042851321 and on `089527a`, run 35056728310), PKG-005, PKG-006 (as of `089527a`, run 35056728390), PKG-007 (as of `ba098b8`, run 35042851269), PKG-008 (as of `f833cd4`, run 35045306378; candidate SQL disposable-proven, unapplied on DEV), PKG-010 (as of `7403270`, run 35066812081; closure execution on DEV still waits for PKG-014), PKG-009 |
| DONE_VERIFIED (audit only), inventory stale | PKG-001 |
| IMPLEMENTED_PENDING_VERIFICATION | none |
| MISSING_PROOF (mechanism exists, not yet executed on head) | PKG-013 |
| BLOCKED | PKG-014 (needs PKG-013 + owner batch approval), PKG-018 (provider diagnosis + AF-D04) |
| IN_PROGRESS (read-only reconciliation delivered, no UI change yet) | PKG-011 |
| NOT_STARTED | PKG-012, 015, 016, 017, 019, 020, 021, 022, 023, 024 |

Order of the next work per V19 topology: PKG-003 → PKG-004 → PKG-007 → PKG-008 → PKG-006 → PKG-010 → PKG-011 → PKG-012 → PKG-013 → PKG-014 → … PKG-009 is already fresh and is skipped. PKG-003, PKG-004, PKG-007, PKG-008, PKG-006 and PKG-010 are done; the next package is PKG-011.

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
- Review, 2026-09-16: the executed suites were mapped to the three GAP definitions. Pre-fix witness executed locally: with the five runtime files checked out from `cb8c32d` (parent of the first PKG-004 commit) the current suites fail 36 tests in 5 of 6 files; only `application-composer-read` passes, so its closed-gate refusal is positive coverage, not a repro. Two Definition-of-Done criteria were still open in source: GAP-0026 "retain the pending command key" (`pregled.tsx` minted a new `clientRequestId` on every press, so the decoder's already-closed replay path was unreachable from the screen) and GAP-0030 "closed-search RPC rejection is a known client error" (`NEED_REMAINING_SEARCH_CLOSED` was absent from `applicationSelectionErrors`, so `readOwnedResult` classified a definitive rejection as an unconfirmed outcome and the composer kept offering the same replay). Both were closed in `bdcb2c8` with failing-then-passing tests (`pkg004-close-attempt`, `pkg004-lifecycle-wiring`, `application-selection-client`, `application-composer-read`; 3 failures on the pre-fix runtime, 55/55 after).
- Executed proof: run 35038650179 on `bdcb2c8`, 13/13 steps: TypeScript, focused 11 suites 197/197, full regression 213 suites 4186/4186. Ledger `PKG-004-RECEIPT-20260916-002`.
- Current status: DONE_VERIFIED, resolving GAP-0025, GAP-0026 and GAP-0030 on the exact candidate. Physical device restart/route restoration proof stays with PKG-017/PKG-021.

### PKG-005 — Worker onboarding and Worker-only calendar
- Gaps: GAP-0027, GAP-0028.
- Last exact proof: run 35031818085 on `b2f72b7`, 16/16 steps, full regression 4181/4181; Ledger `PKG-005-RECEIPT-20260916-003`.
- Current status: DONE_VERIFIED, fresh. Next: none.

### PKG-006 — Durable application identity and concurrent selection
- Gaps: GAP-0031, GAP-0023.
- Implementation present (before 2026-09-16): partial signals only. `prilike/[id]/prijava.tsx` created a `clientRequestId` but kept the frozen command only in the per-instance session object (EVID-0078: a remount lost the identity and a retry allocated a new key). Server-side selection idempotency (P0D-02), worker capacity CAS (pre-V3) and calendar conflicts (W02) were live but no current-source concurrency proof bound them to head.
- Implementation, 2026-09-16 (`089527a`): `src/data/applicationCommandJournal.ts` keeps the exact frozen `rpc_submit_response` command per account and Need, written before any I/O (without it nothing is sent), replaced only by its own key, retired only on the command's own receipt or a known refusal after readback, and discarded when corrupt. The composer restores the command on remount/cold restore, shows its terms read-only, never resends it automatically and replays it explicitly with the same key; another account cannot see or erase it and a journal read landing after an account change is not applied. GAP-0023: `supabase/proofs/pkg006/pkg006_selection_concurrency_proof.mjs` runs on the fully replayed 147-file disposable history with the two real fixture accounts plus a canonically activated second Worker (`9` checks: submit replay/changed-payload denial also in parallel, same-key concurrent Selection → one Agreement, one-seat race → one winner, observed Need row-lock wait, two Workers cannot over-allocate and a two-slot Need yields one Agreement per accepted Selection, Worker capacity CAS, overlapping fixed intervals → one Agreement and blocked application path, final invariant over every proof Need). No SQL, Edge, provider or live change.
- Pre-fix witness (local, base `34539d2`, before any source change): `Tests: 6 failed, 35 passed, 41 total` (`evidence/PKG006_VERIFIED_20260916_35056728390.json`).
- Last exact proof: run 35056728390 (`pkg006-application-selection-proof`) on `089527a`: disposable proof PASS, TypeScript, focused `Test Suites: 4 passed, 4 total | Tests: 104 passed, 104 total`, full `Test Suites: 216 passed, 216 total | Tests: 4290 passed, 4290 total`.
- Current status: DONE_VERIFIED (Ledger `PKG-006-RECEIPT-20260916-001`). Because `application-composer-read.test.tsx` is in the PKG-004 proof path filter, the PKG-004 workflow re-ran automatically on `089527a` (run 35056728310, success) and is recorded as a re-verification receipt.
- Blocker: none. Real cold-launch acceptance stays with the device packages (PKG-017/PKG-021). Next: PKG-010 per topology.

### PKG-007 — Agreement completion and server permissions
- Gaps: GAP-0032, GAP-0033.
- Implementation present (before 2026-09-16): no for GAP-0032. `src/app/dogovor/[id].tsx:153` derived `canComplete` from status (`active && me && (requester || stanje === 'CONFIRMED')`) while `agreementClientService.ts:283` already parsed the server `actionState`; the completion buttons ignored it (DRIFT-0013). GAP-0033: `supabaseIzvor.potvrdiZavrsetak` read only the error and returned `ok/null` for any receipt; the route's generic `mutate` accepted any fresh workspace.
- Implementation, 2026-09-16 (`ba098b8`): `DogovorProjekcija.radnje` is projected from `rpc_get_agreement_workspace.actionState` through the shared `decodeActionState` (authoritative, exact Agreement/version/account, boolean capabilities, ≤1 pending change); the list RPC carries none, so list rows are `null`. The route enables both completion CTAs only from `radnje` (status/party remain a necessary display condition), fails closed with "Osveži dozvole za završetak" when permissions are missing, and explains a pending change. `potvrdiZavrsetak` moved to `agreementClientService` with a structured terminal receipt (original and already-completed replay), known completion denials (`agreementCompletion.ts`, including `AGREEMENT_CHANGE_PENDING`) and no detail leak; the route confirms only by reading COMPLETED (requester) or AWAITING_REQUESTER/COMPLETED (worker) back. No SQL, Edge, provider or live change.
- Pre-fix witness (local, base `d1c3ba4`, before any source change): new/extended suites `Tests: 49 failed, 46 passed, 95 total` (`evidence/PKG007_VERIFIED_20260916_35042851269.json`).
- Last exact proof: run 35042851269 (`pkg007-agreement-completion-proof`) on `ba098b8`: TypeScript, focused `Test Suites: 8 passed, 8 total | Tests: 185 passed, 185 total`, full `Test Suites: 215 passed, 215 total | Tests: 4237 passed, 4237 total`.
- Current status: DONE_VERIFIED (Ledger `PKG-007-RECEIPT-20260916-001`). Because `supabaseIzvor.ts` is in the PKG-004 proof path filter, the PKG-004 workflow re-ran automatically on `ba098b8` (run 35042851321, success) and its re-verification is recorded as `PKG-004-RECEIPT-20260916-003`.
- Blocker: none. Next: PKG-008 per topology.
- Addendum 2026-09-16 (PKG-010): the node source-boundary gate, first executed on head by `pkg010-system-contracts-proof`, showed that the DB-free loaders `supabase/proofs/pre_v3/client_runtime.mjs` and `supabase/proofs/calendar/w02_calendar_integrity_proof.mjs` did not declare `src/data/agreementCompletion.ts` (added by `ba098b8`); `7403270` declares it in both loaders and the calendar loader test. PKG-007 behaviour is unchanged; its exact workflow runs TypeScript and Jest only, so this gate belongs to the PKG-010 workflow and the PKG-013 re-baseline.

### PKG-008 — Unconfirmed photo recovery
- Gap: GAP-0036 (Task photo screen SCR-003, FUNC-3758, EVID-0114).
- Implementation present (before 2026-09-16): partial. `fotografije-zadatka.tsx` read the upload command receipt and offered "Nastavi slanje iste fotografije" only while the bytes were still in memory; after remount `rpc_read_media_upload` → `MEDIA_NOT_FOUND` left the identity pending with the picker disabled and no cancel, and the general owned-media chain had no cancellation fence (the Agreement photo chain already has one). `AgreementPhotoComposer`/`useAgreementPhotos` were re-reviewed: remount without pixels, ABSENT + explicit cancel tombstone, PROCESSING no-retry and reserved-asset fences are already covered by `agreement-photos-hook`; no Agreement-side change was needed.
- Implementation, 2026-09-16 (`f833cd4`): candidate `supabase/candidates/pkg008_media_upload_cancellation.sql` (SOURCE CANDIDATE ONLY, outside migrations, unapplied on DEV) adds `private.owned_media_cancellations` and owner-only `rpc_cancel_media_upload(conversation, key)`: an absent key gets a durable tombstone under the same per-command advisory lock the service claim uses, and `rpc_claim_media_upload_service` is rewritten by anchor to refuse tombstoned keys (`MEDIA_COMMAND_CANCELLED`), so a delayed first send cannot commit behind the cancellation; an admitted PROCESSING/STAGED key is deselected and a READY one leaves the draft through the existing `rpc_remove_task_photo` writer. `mediaClientService.cancelUploadCommand` decodes the exact receipt; the screen offers "Odustani od nepotvrđenog slanja" whenever the identity is unconfirmed, names absence honestly, keeps the same-key retry while bytes exist, retires the journal only on the server's confirmation, and discards a non-UUID journal value instead of stranding the picker. No Edge, provider or live change.
- Pre-fix witness (local, base `de5c8a1`, before any source change): `Tests: 23 failed, 33 passed, 56 total` (`evidence/PKG008_VERIFIED_20260916_35045306378.json`).
- Last exact proof: run 35045306378 (`pkg008-task-photo-recovery-proof`) on `f833cd4`: full 147-file disposable replay, candidate applied only there, rollback-only runtime proof PASS (absent tombstone, idempotent replay, late claim refused, fresh claim admitted, PROCESSING deselected, READY removed, owner-only, ACL, zero residue), TypeScript, focused `Test Suites: 6 passed, 6 total | Tests: 89 passed, 89 total`, full `Test Suites: 215 passed, 215 total | Tests: 4261 passed, 4261 total`.
- Current status: DONE_VERIFIED (Ledger `PKG-008-RECEIPT-20260916-001`). The candidate SQL is not applied to canonical DEV; its promotion belongs to the PKG-014 batch (AF-D07/AF-D26 boundary), and until then the private APK's cancel button reports an unconfirmed outcome and keeps the identity.
- Blocker: none. Next: PKG-006 per topology.

### PKG-009 — User-editable notification preferences
- Gap: GAP-0034.
- Last exact proof: Ledger `PKG-009-RECEIPT-20260915-001` at `592786a`, run 34946355138.
- Fresh: yes. `PushPreferences.tsx`, its test and its importers unchanged since `5dee665`; re-executed in the full regression on `b2f72b7`.
- Current status: DONE_VERIFIED. Next: none (physical push delivery belongs to PKG-020).

### PKG-010 — Safety, support, export and closure contracts
- Gap: GAP-0020.
- Implementation present (before 2026-09-16): support inbox/new/detail/operator screens and controller, export screen with authenticated download and readback, legal/processor screens, safety and blocked-accounts screens, all nine formerly orphan services with production importers, 17 client suites and the V5 disposable proofs. Nothing had executed green on the current head: every recorded run of the V5 control chain (`work/pre-v3-proof-runner-20260911`, `.pre-v3/run.json`) failed in CI; the last one (34779136162 on `45e0f31`, byte-identical proofs/worker/migrations) reached `v5_account_erasure_proof.mjs` and failed with `AUTH_SOFT_DELETE_PHONE_NOT_CLEARED`.
- Implementation, 2026-09-16 (`17de27b`, `8c59157`, `360ba9e`, `ee8e7ff`, `7403270`): `supabase/proofs/pkg010/chain.py` + `chain.json` + workflow `pkg010-system-contracts-proof` execute the ordered 31-proof V5 chain on the exact candidate in the disposable live79 database (live80-116 replayed by psql, each later proof applies its own migration at its recorded predecessor with git-blob equality, final history 147/20260913081242), then TypeScript, every node test file under `scripts/` and `supabase/`, the 17 client suites and the full Jest regression. The driver pauses the disposable minute scheduler `uskoci_marketplace_tick` for the chain (the same `cron.alter_job` form `v5_retention_compatibility_proof.mjs` uses for itself): under chain load one tick held locks for 10+ seconds and made proof RPCs (57014) and the erasure drift DDL (20 s bound) time out (runs 35060803243, 35061654279); this tick duration under load is recorded as an open observation for PKG-013/PKG-004 owners, not fixed here. The defects the chain exposed are fixed: the erasure proof demanded an empty `auth.users.phone` and zero `auth.identities` rows after soft deletion, but GoTrue `SoftDeleteUser`/`SoftDeleteUserIdentities` store one-way tokens derived from the user id in email, phone (15 characters) and identity `provider_id`, keep the identity rows with empty `identity_data`, remove factors and log out sessions; the assertions now state that contract (phone empty or a non-phone token different from the original; identities retained but erased) and the DB-free mirror test pins it. The erasure business fixture also lacked the W02 confirmed-review region token for its `task_country_code` seed (check 10 had never executed); it now publishes like the three other proofs that seed regional needs. Outside the PKG-010 domain but inside the chain, the final `v5_qa_owner_activation_proof.mjs` (migration 147) expected the dedicated `QA_OWNER_PRIVATE_POLICY_EXPOSED` code for a grant drift that the 146 closure seal (hashing every private/public table ACL) refuses first as `QA_OWNER_SOURCE_NOT_READY`; the proof now asserts the guard that actually fires. Migrations 146/147 are unchanged. The node source-boundary gate (every `*.test.mjs`/`*.test.cjs` under `scripts/` and `supabase/`, first executed on head by this package) also exposed PKG-007 residue: the DB-free loaders in `pre_v3/client_runtime.mjs` and `calendar/w02_calendar_integrity_proof.mjs` did not declare `src/data/agreementCompletion.ts` (added by `ba098b8`); both now declare it, nothing was removed, and PKG-007's behaviour is unchanged (its exact workflow never ran this gate, which the PKG-007 section records). Closure worker, SQL, Edge and client source are unchanged; account closure execution stays hardcoded not ready in the client until SQL 146 is applied on DEV (PKG-014).
- Pre-fix witness: run 35062304342 (`pkg010-system-contracts-proof` on `ee8e7ff`, unchanged proofs): chain FAIL inside `v5_account_erasure_proof.mjs` (`AUTH_SOFT_DELETE_PHONE_NOT_CLEARED`) after five PASS checks; corroborated by control run 34779136162 (`evidence/PKG010_VERIFIED_20260916_35066812081.json`).
- Last exact proof: run 35066812081 (`pkg010-system-contracts-proof`) on `7403270`: chain PASS (31 proofs, erasure proof 12 checks), node tests `880 tests, 880 pass, 0 fail`, TypeScript, focused `Test Suites: 17 passed, 17 total | Tests: 520 passed, 520 total`, full `Test Suites: 216 passed, 216 total | Tests: 4290 passed, 4290 total`.
- Current status: DONE_VERIFIED (Ledger `PKG-010-RECEIPT-20260916-001`).
- Blocker: none for the package. Closure execution on DEV depends on PKG-014 (SQL 146 unapplied); the exact chain is also the re-baseline input for PKG-013. Next: PKG-011 per topology.

### PKG-011 — Coherent screens over the same engine
- Implementation present: 47 routes + 2 layouts + native-intent handler (49 surfaces) and UI modules for aiFirst, agreements, calendar, closure, groups, legal, location, media, needs, notifications, qa, reviews, safety, settings, support, workerProfile.
- Read-only reconciliation, 2026-09-16 (owner-mandated pre-UI step, one agent, no subagents, V9 web prototype excluded as authority): `docs/implementation/execution/pkg011/` — `PKG011_FLOW_FIRST_RECONCILIATION_20260916.md` (user → ideal flow → current map → gaps, per flow), `CURRENT_SCREEN_BINDING_MASTER_20260916.md/.json` (49 surfaces: 39 CURRENT_COMPLETE, 5 CURRENT_BUT_UI_WEAK, 3 CURRENT_BUT_BINDING_INCOMPLETE because SQL 145–147 and the PKG-003/PKG-008 candidates are not live on DEV, 2 LEGACY), `CURRENT_NAVIGATION_MASTER_20260916.md` (shell/guards/graph; `/pregled-nacrta` and `/prijave` unreachable; center-zone canon conflict), `CURRENT_WRITE_AUTHORITY_MAP_20260916.md`, `CURRENT_READBACK_MAP_20260916.md`, `CURRENT_UI_STATE_GAP_MAP_20260916.md`, `V9_TO_NATIVE_SCREEN_MAPPING_20260916.md` (NOT_APPLICABLE), `PKG011_UI_REPLACEMENT_PLAN_20260916.md` (lists H/I/J, dependency-safe order, required proofs).
- Owner decisions required before any production UI change: center zone semantics (canon `U / Novi` / `U / Zadaci` vs current shared `Mapa` tab, requester discovery inside Zadaci), implicit intent switches (`/prilike` `+`/`Moji`, inbox open), TARG-034 candidate comparison and TARG-050 public profile as new presentations, permissions primer (canon S05), retirement of `/pregled-nacrta` and the Google/Apple placeholders.
- Owner decisions 2026-09-16 (`pkg011/PKG011_OWNER_DECISIONS_20260916.md`): zones Zadaci|Mapa|Dogovori and Prijave|Mapa|Dogovori (already the current shell); no silent intent switch; candidate comparison and public profile in scope as presentation over existing reads; contextual permissions only; `/pregled-nacrta` retirement candidate, `/prijave` kept, Google/Apple PENDING_INTEGRATION visible but disabled. Production UI authorized.
- Slice 1 delivered 2026-09-16 (`pkg011/PKG011_SLICE1_ZADACI_DOGOVORI_20260916.md`): `src/ui/system/*` tokens and primitives, Zadaci/Mapa presentation + TaskCard, Dogovori collection + Agreement hero, tab bar, explicit `IntentTransition` on `/prilike` and the inbox. Presentation/navigation only; state owners and writers untouched.
- Slice 2 delivered 2026-09-16 (`pkg011/PKG011_SLICE2_DOGOVOR_WORKSPACE_20260916.md`): Dogovor workspace presentation (`src/ui/agreements/AgreementWorkspace.tsx`), chat, izmene/lokacija/grupa screens and review on the shared system; one brand action per Agreement state. State owners, journals and copies untouched.
- Slice 3 delivered 2026-09-16 (`pkg011/PKG011_SLICE3_PRIJAVE_ZADATAK_KANDIDATI_20260916.md`): Prijave, public Task detail, application composer, candidates with comparison, shared `PublicProfileSheet` over the existing `javniProfil` read (owner decision 3; TARG-034/TARG-050 as presentation). Binding gap recorded: participants and own applications carry account ids, not public profile ids, so the profile sheet is not yet reachable from Dogovor or Prijave.
- Slice 4 delivered 2026-09-16 (`pkg011/PKG011_SLICE4_ZADATAK_KREIRANJE_20260916.md`): own Task detail, New Task chooser, location controls/form, lifecycle panel, manual entry grouped into topic cards (still PKG-014-dependent for the live RPC). `/nova` and `/pregled-zadatka` left as the owner-approved V5 experience.
- Current status: IN_PROGRESS (slices 1–4 candidates; parity suites, neighbours and tsc green locally; full Jest recorded per slice; PRE-P4 green on `866f05d`). Next: worker profile suite, then the shared settings system. Live binding of manual entry, photo cancellation, Q&A activation and closure execution still waits for PKG-014.

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
