# PKG-013 — exact source147 re-baseline of the proof harness (2026-09-16)

Package: V19 PKG-013 "Exact source: regression and full schema147 disposable integration"
(GAP-0005). Authority order: current source > PR > Ledger/contract/evidence > V19.
Nothing here applies a migration to DEV/ALPHA; every database in this package is disposable
and built in CI. No guard is relaxed: every count, byte and identity check below is exact,
only its recorded expectation moved from the frozen 2026-09-10 state to the current source.

## Why the release-level chain was red on `32ec78c` (run 35108674872)

| Job | Failure | Cause in current source |
| --- | --- | --- |
| domain-retention, domain-export, domain-w02 | `W03_EXACT_SOURCE108_REQUIRED` | `ownedIntakeSourceBoundary` accepted only the frozen 108-file source; the repository has 147. |
| domain-w03 / source-proof | `FROZEN_SOURCE_CHANGED: supabase/functions/uskoci-ai-interview/index.ts` | The Edge fingerprint manifest was frozen at `0b0de80`; ten commits of 2026-09-12/13 (Gemini 3.8 wire, AF-D23 identity, V5 flows) changed six of the seven files. |
| domain-policy | TAP `tests 31` expected | `publication_evaluator_edge.test.mjs` has 40 tests on head. |
| domain-consent (P1) | `DOMAIN_STATE_SECURITY_OR_RPC_CHANGED_BY_SUCCESSOR` on `columnGrants` | The successor replay now reaches head; later migrations (`20260912130000`, `20260912222338`, `20260912230039`, `20260913001000`, `20260913014627`) intentionally touch legal objects. |
| domain-push (N09) | handler returned 503 in `ACTUAL_HANDLER_REAL_DATABASE_SYNTHETIC_EXPO_MINIMAL_PAYLOAD` | Since `eb7af88` the push handler records readiness through `rpc_record_push_readiness`; the proof's transport mock only admitted the three transport RPCs, so the handler's own catch produced 503. |
| domain-auth / android | `sdkmanager --licenses` exit 1 | `android-actions/setup-android` v3.2.0 (2023) installs cmdline-tools 11.0, which fails on the new Google TV licence. |

## What changed

### Exact current source admission (`scripts/ci/owned-intake-source.mjs`)

- `supabase/proofs/source147_admission.json` records the current source: 147 files, the
  MD5 manifest sha256, and every successor after the frozen 108 with file, md5, sha256 and
  bytes (39 entries, unit `EXACT_CURRENT_SOURCE147_ADMISSION`).
- `admitExactCurrentSource(plan)` admits a plan only when its count, inventory sha, manifest
  sha and every successor identity equal that record and the files on disk. Any other count
  fails with `CURRENT_SOURCE_COUNT_NOT_ADMITTED`; any byte or order change with
  `CURRENT_SOURCE_INVENTORY_CHANGED`.
- `ownedIntakeSourceBoundary` keeps the frozen 108 view as `historicalPlan` and runs the
  unchanged 105/106/107/108 identity checks on it. `fullPlan` is now the admitted current
  source; `deferredSuccessors` keeps its historical shape (two entries) so every existing
  report gate stays exact; `currentSourceAdmission` lists the 39 admitted successors.
- P2, P3 and W05 wrappers pass `historicalPlan` and `currentSourceAdmission` through. The four
  "expanded source is rejected" tests became "exact 147 admitted / 146, mutated or reordered
  rejected".

### Successor replay to head with recorded deltas (`supabase/proofs/legal/pending_domain_replay.mjs`)

- `assertDomainSnapshotAfterSuccessors` is the single comparison used by P1, P4, D0140A
  (through `replayPendingDomain`) and now by P2 and P3 (their bespoke asserts moved onto it
  with the same keys). Without a manifest it is strict, as before.
- A domain may admit an intentional later change only through
  `<domain>_successor_delta.json` naming the successor files with md5 and the exact
  before/after sha256 of each changed key. Unknown keys, other values, other successors or
  another source count still fail. On failure the exact divergence (keys, digests, values)
  is written to `successor_divergence` in the report so the next manifest is authored from
  evidence, never from memory.
- Reports gain `domain_state_matches_admitted_source` (true in both modes) and keep
  `domain_state_security_and_projection_unchanged` truthful (false when a delta is admitted).
  P1, P4 and D0140A workflows check the new flag; P2 and P3 workflows still require every
  `*_unchanged` flag until a delta exists for them.
- Unit test: `supabase/proofs/legal/pending_domain_replay.test.mjs` (run by PRE-P4).

### N09 push transport proof

The transport mock now admits `rpc_record_push_readiness` (successor SQL `20260912131000`,
proven against a real database by `pre_v3/push_readiness_proof.mjs`) and answers it with a
synthetic receipt, because the exact107 disposable database has no readiness RPC. The
report records `readiness_rpc_stubbed: true` and `readiness_observations: ['TICK_OK']`;
claim, begin and complete stay real. This is a labelled boundary, not a claim.

### Refrozen Edge fingerprint (`supabase/proofs/ai/ai_edge_context_files.json`)

Six of seven files refrozen to the current bytes; the `refrozen` block records the previous
freeze commit `0b0de80`, the ten source commits, the previous file fingerprints and the
handler test count 98 → 92 (two renamed, one renamed, three added tests; the count is
whatever `node --test` reports on head with zero failures). Workflows `ai-edge-context-proof`
and `w02-calendar-authority-proof` expect 92.

### Constants moved from the frozen state to the current source

| Place | From | To |
| --- | --- | --- |
| `p2-data-export-proof.yml`, `p3-retention-schedule-proof.yml`, `d0140a-bundle-registration-proof.yml` (`full_source_plan.source_migration_count`) | 108 | 147 |
| `d0140a-bundle-registration-proof.yml` (`admitted_source_count`, TAP totals) | 108, 31 | 147, 40 |
| `p2_export_delivery_report_gate.mjs`, `p3_retention_execution_proof.mjs`, `p3_retention_execution_report_gate.mjs` | 108 | 147 |
| W02 dispatch-lock proof/manifest/test, W02 authority and integrity reports (`admitted_source_count`) | 108 | 147 (applied authority `REGISTRY105_PLUS_UNRECORDED_DISPATCH108` unchanged) |
| `w01-auth-recovery-proof.yml` `android-actions/setup-android` | v3.2.0 `07976c6` | v4.0.1 `40fd30f` (cmdline-tools 20.0) |

Historical fixtures keep 108: `historical_source108_fixture.mjs`, the pre_v3 and D03 history
counts are disposable database history counts, not source counts.

## Rounds 2 and 3 (from the release runs 35111501474 and 35113177025)

- **P1 recorded delta** (`supabase/proofs/legal/p1_legal_consent_successor_delta.json`): two new
  SECURITY DEFINER functions executable by `authenticated`
  (`rpc_accept_reviewed_legal_bundle`, `rpc_read_my_legal_acceptance`, from `20260912222338`)
  and one RESTRICTIVE SELECT policy `v5_closed_account_visibility` on
  `public.account_legal_acceptance_events` (from `20260912230039`). The two original P1
  functions are byte-identical before and after. Both digests come from run evidence.
- **Declared view for catalog OIDs**: the two runs produced identical rows except the `oid` of
  the two new functions (24133/24134 vs 24116/24117). A manifest may declare
  `view: STRIP_CATALOG_OID` for one changed key; it removes only `oid` from each row before
  digesting (owner, ACL, security definer, source and config stay). Unchanged keys are never
  normalised; an unknown view name fails.
- **W02 shared capability**: the current typed client saves owned capacity through
  `rpc_save_worker_capacity` (SQL `20260911174500`), which the historical registry105 +
  unrecorded dispatch108 database does not have. The proof now applies every later file in
  order with a registry row (`applyPendingSuccessors`, shared with the domain replay) and
  asserts history 147 before exercising the client. SQL108 is already applied there, unrecorded,
  by the dispatch-lock proof and asserts its own predecessor bodies, so it is not run twice:
  106 and 107 are applied, 108 is recorded exactly (bytes, md5, sha256, both current bodies
  checked against `w02_dispatch_lock_files.json`), then 109-147 follow in order. The loader
  also admits the two capacity modules added on 2026-09-11.
- **W02 shared capability, stage 1**: the current client refuses `grad`/`radijusKm` itself
  (`PROFILE_LOCATION_REQUIRES_REVIEW`, since `72cdc8c`: geography has its own revision-bound
  writer); the 2026-09-10 proof still sent both. The capability save now carries identity and
  resources only; location stays with `w02_location_proof`. Found through the recorded
  assertion text (`ACTUAL_CLIENT_REFUSED:<code>`), which the proof now writes to its report.
- **W01 Android**: with setup-android v4.0.1 and `platform-tools` the proof APK builds again
  (`BUILD SUCCESSFUL`, run 35113177025) and the emulator boots; the native proof then lost
  `Zaboravili ste lozinku?` because the login sheet now animates in (`AuthSheet`, 2026-09-13)
  and the proof scrolled only downwards past it. The UI helper now waits 6 s before scrolling
  and alternates direction; the app is unchanged.
- **P3 source-pinning test** follows the shared helper; **D0140A** gate expects the 147-file
  inventory; **setup-android v4** installs `platform-tools` only (the legacy `tools` package no
  longer exists in the SDK repository).

## Not changed on purpose

- No migration was applied to DEV/ALPHA; SQL 146/147 stay pending for PKG-014 with owner batch approval.
- The frozen 108 fixture and every 103/104/105/106/107/108 identity assertion stay as they are.
- Legal content, provider calls, physical push and device claims are still not proven.

## Verification

Local: `node --test scripts/ci/*.test.cjs` 31/31; proof unit tests green (source plan,
replay helper incl. the OID view, four boundaries, W02 dispatch lock, N09 edge, P3 pinning); `publication_evaluator_edge`
40/40; `ai_edge_context_proof.mjs` PASS with 92 handler tests.

CI: the exact head must pass `PRE-P4 integrity` at `level=release` (nine domain proofs). The
first release run after this change is the evidence input; any `successor_divergence` it
records becomes a recorded delta in a follow-up commit, with its attributed successors.
The PKG-013 Ledger receipt is written only from a green release run on the exact candidate.
