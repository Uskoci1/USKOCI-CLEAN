# EX05-S01: disposable re-proof of the chat server legs on the post-B24 and Voice B1 chain

Status 2026-10-02: SOURCE AND OFFLINE ONLY. Nothing here has run in CI yet, nothing was applied to DEV or PROD, no function body changed. A disposable chain is NOT DEV, a source or CI result is NOT device proof.

Binding scope: `docs/implementation/product-v1-closure-20260926/finalization-20260927/EX05_CANONICAL_SCOPE_20261001.md` (gap G10, slice EX05-S01). Round note: `docs/implementation/product-v1-closure-20260926/finalization-20260927/ex05/EX05_S01_ROUND_NOTE_20261002.md`.
Evidence table (generated, results read `NOT RUN` until the workflow ran): `docs/implementation/product-v1-closure-20260926/finalization-20260927/ex05/EX05_S01_EVIDENCE_TABLE_20261002.md`.

## The question and the structural answer

The SQL proofs of text, photo, group and voice chat were last run before B24 (SQLSTATE 40001 became PT409 on DEV, ledger 213/214) and before Voice B1 (ledger 215). The frozen originals each apply the candidate they prove at a recorded
predecessor position and assert the state before it, so none of them can run unchanged on a chain that already carries B24 and Voice B1. They stay valid evidence at their own position. The post-state behaviour is re-asserted by the
UPDATED COPIES in this folder (the frozen originals are never edited), each with its diff against the original written in its header. Per proof: `proof_matrix.json` (single source) -> the evidence table.

## What is here

| File | What it is |
| --- | --- |
| `ex05_s01_text_proof.mjs` | text send: one message, one body-free event, two deliveries; replay; PT409 (never 40001) for changed body/agreement, concurrent and lock-held waiters; rollback on event failure; terminal agreement; legacy broad mark-read; B3c counts |
| `ex05_s01_readers_proof.mjs` | B3a page + exact-ID acknowledgement and B3b window ported to the post-Voice V1 readers |
| `ex05_s01_photo_proof.mjs` | photo upload/send with real Storage; the four PT409 sites of the upload service; cancel/late store; block/terminal; quota; support snapshot; own export |
| `ex05_s01_group_proof.mjs` | group conversation on the final chain; G16 recorded (a group send emits no event, no delivery, no invalidation row) |
| `ex05_s01_voice_proof.mjs` | voice on the DEV-application chain: service protocol, real Storage, send atomic/idempotent, guards, V2/V1 readers, paging, B3c, the cross-kind key space, rate limit |
| `ex05_s01_push_proof.mjs` | begin receipt (opaque eventId) for text/photo/voice, PT409 leases through PostgREST and the ACTUAL Edge handler, neutral copy and exact-target data, resolver and windows per kind, G22 recorded, device/preference revision PT409 |
| `derive_b24_part1_chain.mjs` | derives the B24 Part 1 CHAIN VARIANT from the committed candidate (only the target table and its two count guards change; refuses to continue if a CRITICAL target cannot be converted) |
| `pin_gate.mjs`, `dev_pins.json` | the 60 chat-surface functions read from the chain and compared with the 2026-10-02 DEV capture (core difference fails in `enforce`, adjacent warns, any B24 conversion difference fails) |
| `proof_matrix.json`, `render_evidence.mjs` | the evidence matrix and its renderer (`--write`, `--check`, `--reports-dir <downloaded artifacts> --run-id <id>`) |
| `offline_report.mjs` | TAP summary to the small report the OFFLINE_RERUN row reads |
| `lib/*.mjs` | pure, unit-tested modules (runner, harness, fixtures, SQL builders, pins, findings, matrix); `lib/*.test.mjs` are the offline tests |
| `.github/workflows/ex05-s01-chat-reproof.yml` | jobs `offline`, `chain`, `d03-position`, `evidence` |

Every proof runs ALL its checks even after an earlier one failed (a dependent check is SKIPPED, never green), records observations with `characterize` (only an UNEXPECTED_SHAPE fails), redacts keys/JWTs from messages, binds its sources to `git show $GITHUB_SHA:path`,
checks the chain facts before it starts and ends with a catalog guard that proves it changed no function body, table authority, policy, publication or certificate. Reports go to `EX05_S01_ARTIFACT_DIR`.

## Run it (first cycle)

1. Offline (this machine, no database): `node --test supabase/proofs/ex05_s01/lib/*.test.mjs` (pglast: `python -m pip install pglast==8.4` enables the SQL-grammar test, otherwise it is skipped), `node supabase/proofs/ex05_s01/render_evidence.mjs --check`.
2. Push the branch. The workflow also starts on a push that touches this folder or itself. `workflow_dispatch` inputs: `pin_gate_mode` (`report` is the default: prints every pin difference and never stops; use `enforce` once the first cycle is understood), `run_chain`, `run_d03_position`.
3. Read the run: the `evidence` job prints the table with the run id in the step summary and uploads `ex05-s01-evidence-table-*`. To regenerate it locally from downloaded artifacts: `node supabase/proofs/ex05_s01/render_evidence.mjs --reports-dir <dir> --run-id <id> --out <file>`.
4. Fill the run id into the committed table only after a run: keep the committed table equal to `render_evidence.mjs --write` (the unit test compares it byte for byte) and record the run id in the round note, not by hand-editing the table.

## What is expected to break on the first cycle (read this before debugging)

- The chain is built from the stages the D12 workflow records plus the P4 transport candidate and the B24 Part 1 variant; it was NOT run end to end by the author. Likely first-run problems: the pin gate differences (use `report`), a stage tolerance (EX-04a-d are tolerated), fixture timing in the proofs (collect-all logs print the last 60 lines of every proof).
- Proof checks that RECORD (G16 group, G22 push-on/in-app-off) pass by design; read `observations` in `ex05-s01-group-report.json` and `ex05-s01-push-report.json` for the actual behaviour.
- The d03 job reuses the original d03 workflow steps minus tsc/jest; if the live79 baseline moved since 2026-09-07 it can fail for reasons unrelated to B24.

## NOT re-established (stated, not hidden)

Realtime WebSocket delivery of the B3c hint; real account closures of any chat participant after the Voice B1 and D12 re-binds (a group member's closure has no proof at all); the hosted Deno runtime and HTTP/JWT calls against DEV; a real recorder file/decoder, iOS, devices, any provider send;
photo/voice cancel lock order (that is EX05-S02); the client code; and the pkg010 positions of the frozen photo and group proofs (next section).

## Open finding: the PKG-010 chain driver does not plan on the head

`python3 supabase/proofs/pkg010/chain.py --plan` (offline, authoring checkout, 2026-10-02) stops with `PKG010_UNKNOWN_MIGRATION push_readiness_proof.mjs 20260926175504_clean_notification_push_event_type.sql`. Cause: commit 0ffb5281 (2026-09-26) made `push_readiness_proof.mjs` apply an A1 file that now lives in
`supabase/candidates/` (`closure_runtime.apply` special-cases it at line 92) and is not in `supabase/migrations/MIGRATION_PROVENANCE.json`; the last recorded chain run (36095780738) predates it, and in a full chain the extra history row would also shift every later hard-coded predecessor by one. So the scope item "dispatch the pkg010 photo/group proofs on the current head"
could not be met through the existing driver, and this slice did not edit the frozen driver or proof. How to continue (a root decision, not done here): write a derived position driver under `supabase/proofs/ex05_s01/` that copies `chain.py` but drops only the A1 target of `push_readiness_proof.mjs` from the plan, and runs the two proofs in diagnostic-subset mode
(group needs history 136, photo 143, positions that exclude the A1 file); add it as a `pkg010-position` job and switch the PH-01/GR-01 rows of `proof_matrix.json` from NOT_RERUN to RERUN_AT_POSITION (job `pkg010-position`, report `pkg010-chain-summary.json#<script>`, which `render_evidence.mjs` already understands).

## Findings recorded, not fixed (nothing applied)

- G22 (push ON, in-app OFF): by the SQL and the DEV bodies the PUSH delivery is CREATED while the IN_APP delivery is SUPPRESSED (IN_APP_OFF); the resolver and the displayed-ACK need an unsuppressed IN_APP delivery, so the exact target would be UNAVAILABLE and the ACK would mark 0. The proof records the actual behaviour and the classifier names it
  (`CONTRACT_GAP_PUSH_ARRIVES_BUT_EXACT_TARGET_UNAVAILABLE` or `NO_GAP_EXACT_TARGET_SERVED`). If the run confirms the gap, the options and the draft owner block are in the round note; no candidate was written (that needs the owner's "primeni" for any server change).
- G16 (group): a group send emits no event, no delivery and no invalidation row (recorded; `GAP_REPRODUCED_GROUP_SEND_EMITS_NO_EVENT_OR_DELIVERY` unless it changed).
- Stale by later packages: the Voice B1 revert (D12 rewrote the same closure/export functions); the P4 resolver candidate's window pin 9ae403a4 (Voice B1 moved the window to 706735a0).
