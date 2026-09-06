# USKOČI implementation continuity

## Current authoritative checkpoint — 2026-09-06 — POST RU-5 / P0D-01 LIVE

This file is the current forward continuity pointer. Older checkpoint sections in `HANDOFF.md`, `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md`, and earlier status files are retained as historical evidence even where they record live-71/live-72/live-73/live-74 or earlier RU-5-next states; they are superseded by this checkpoint, `CURRENT_IMPLEMENTATION_STATUS.md`, `RU_STATUS.md`, `LIVE_MIGRATION_STATE.json`, canonical GitHub state and fresh live Supabase reads.

### Canonical repository

- repository: `Uskoci1/USKOCI-CLEAN`
- branch: `clean-alpha-backend`
- P0D-01 final proof SHA: `bc4dacbd853ca506845e8bf0253b91cd55f6629a`
- P0D-01 canonical merge: `de3e25ce248d745d5a908fe1edf0a3e7b44d53c1`
- final proof run: `33993116261` — PASS
- PR PRE-P4: `33993284041` — PASS
- PR CodeQL: `33993283308` — JS/TS, Python and Actions PASS
- canonical push PRE-P4: `33997533070` — PASS
- canonical push CodeQL: `33997532816` — JS/TS, Python and Actions PASS
- canonical Control-0: `33997533227` — PASS

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- migration count: `75`
- head: `20260905230326_clean_ru5_candidate_projection`
- canonical source migration: `20260905223000_clean_ru5_candidate_projection.sql`
- canonical raw MD5: `e69c6037c876ca4c0fb48409ab68ab45`
- canonical UTF-8 bytes: `8246`
- live recorded statement MD5: `e69c6037c876ca4c0fb48409ab68ab45`
- live recorded statement UTF-8 bytes: `8246`
- raw exact-byte identity: `TRUE`

Fresh live postflight reconfirmed:

- `rpc_list_need_candidates(uuid)` exists, is STABLE + SECURITY DEFINER and is executable by `authenticated` only;
- the projection is Requester-owner locked through `auth.uid()` and does not expose a cross-account raw `app_profiles` path;
- canonical candidate states are `SELECTABLE / STALE / OVERFILL / SELECTED / WITHDRAWN / CLOSED / FULL`;
- exact Need revision + Application version/content hash are returned for binding to the existing Selection authority;
- P0C-01 public-safe Worker projection is reused;
- P0C-02 per-version Application evidence is projected when present; legacy rows without snapshot remain `LEGACY_UNPROVEN`;
- no historical snapshot backfill occurred; live snapshot rows remain `0`;
- `rpc_select_response` was not changed; its definition MD5 remains `90332c500eb8fe9f1b7379fa382af3b6`;
- authenticated direct response INSERT/UPDATE and response-version INSERT remain denied;
- business counts remain `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`;
- D0140 inventory remains zero: `publication_policy_bundles=0`, `publication_policy_rule_refs=0`, `need_publication_decisions=0`;
- RU-4B governed inventory remains zero;
- D0140 production ALLOW remains fail-closed;
- RU-4B remains foundation-only / activation blocked;
- V1 monetization remains `FREE / 0 RSD`.

### RU-5 / P0D-01

Status: `CLOSED / CANONICAL / LIVE / DO NOT REDO`.

The closed unit establishes one Requester-facing production owner for candidate reads, canonical server-owned selectability states, Requester ownership/privacy boundaries, public-safe Worker evidence, exact current Application version/hash/Need-revision binding, V1-vs-legacy evidence semantics and R05 client cutover. The old raw `marketplace_responses` candidate reader is physically removed from `supabaseIzvor`; `candidateClientService` owns the production candidate read port.

P0D-01 does **not** change `rpc_select_response`, Selection/Agreement semantics, legacy over-capacity revalidation, calendar hard-conflict authority, bounded-note policy, Povezivanje, D0140, RU-4B, monetization or Application AI.

## Current WIP handoff — RU-5 manual Selection eligibility revalidation

This section records current proof-branch work only. It does **not** promote the unit to canonical/live and does not supersede the closed P0D-01 live state above.

### Proof branch

- branch: `proof/ru5-selection-eligibility-revalidation-20260906`
- base / canonical closure: `ba636e2ddae66013bfa1cc6e5ebdcb5dbd15a0fe`
- current proof head after CI signature repair: `ae11ebab6dc4d57ac37cbef816f5c9171aabd673`
- candidate migration: `supabase/migrations/20260906010000_clean_ru5_selection_eligibility_revalidation.sql`
- candidate migration MD5 from first proof artifact: `e7bf018eac3545ea6b0c53e48b31279e`
- candidate migration bytes: `17953`
- focused rollback proof: `supabase/proofs/ru5_selection_eligibility_revalidation_runtime_proof.sql`
- proof workflow: `.github/workflows/ru5-selection-eligibility-revalidation-proof.yml`
- first run: `33998505410` — predecessor/checksum/narrow-scope PASS; failed before candidate SQL execution because the workflow guard referenced a non-existent old `rpc_withdraw_response(uuid,integer,text)` signature
- physically verified live withdraw signature: `rpc_withdraw_response(uuid,integer,integer,text,text)`, definition MD5 `c27fafad76fe046323d7b52c6614a5b1`
- second run: `34005973596` — started after workflow-only signature repair; treat its eventual result as authoritative for the current proof head

### Read-only physical findings that admitted this smallest repair

- live `rpc_select_response` already revalidates Need status/deadline/revision, exact Application status/version/hash, `private.match_detail`, and remaining Need capacity;
- live `rpc_select_response` does **not** revalidate the current RU-1 minimum Worker readiness (`display_name`, `city`, at least one skill) and does not revalidate `covered_slots <= current team_capacity`;
- `private.match_detail(uuid,uuid)` checks ACTIVE/profile/resource eligibility but does not cover current `team_capacity` or the full RU-1 minimum readiness contract;
- live has two still-`SUBMITTED` legacy Applications with `covered_slots=2` while the current Worker `team_capacity=1`;
- the same current Worker profile has `skills_count=0`, so it also fails the current RU-1 minimum even though the legacy profile remains ACTIVE;
- historical already-SELECTED rows with the same legacy facts are evidence only and MUST NOT be rewritten/backfilled;
- P0D-01 candidate projection currently lacks those two current-read revalidations, so the repair aligns read-model selectability with Selection authority by mapping such drifted open Applications to the existing `STALE` state.

### Exact admitted scope

The candidate migration may change only:

1. `public.rpc_select_response(uuid,integer,uuid,integer,text,text)` — add current RU-1 minimum readiness + current team-capacity revalidation immediately before Selection write authority;
2. `public.rpc_list_need_candidates(uuid)` — apply the same current-read checks when deriving `SELECTABLE`, mapping drifted legacy Applications to existing `STALE` / `canSelect=false`.

No new table, no historical row rewrite, no snapshot backfill, no new candidate state, no Agreement redesign, no calendar implementation, no Povezivanje activation, no D0140/RU-4B/monetization/Application-AI activation.

### Explicitly observed but OUT OF THIS UNIT

- Selection idempotency is currently only `UNIQUE (need_id, client_request_id)` and replay returns an existing Agreement without a durable request-payload hash/receipt; this needs a separate reconciliation/unit;
- current R05 generates a new Selection `clientRequestId` on each press, so lost-response retry cannot safely replay the same durable command; separate unit only;
- hard calendar/double-booking authority is not yet physically implemented; availability rules/windows exist but no final commitment/conflict owner is proven; separate RU-6A/calendar work only;
- MY_PRICE is not an admitted Selection gap: P0C-02 enforces requester fixed price on submit, and material Need edits increment revision/re-admit, while Selection binds exact Need revision + Application version/hash.

### Exact immediate continuation cursor

1. Read run `34005973596` on head `ae11ebab6dc4d57ac37cbef816f5c9171aabd673`.
2. If it fails, fetch exact failing step/log and repair only the physically demonstrated proof/migration defect on the proof branch.
3. Do not change live Supabase or canonical `clean-alpha-backend` while proof is not fully green.
4. If proof becomes fully green, lock exact migration MD5/bytes, add pending provenance/integrity only after content is stable, then rerun same-head proof.
5. Only after same-head proof + TypeScript + regressions PASS: open PR to `clean-alpha-backend`, require PRE-P4 + all CodeQL jobs PASS, merge, run canonical push gates, fresh live preflight, then apply only the proven forward migration.
6. After live postflight, close provenance/status/docs through a separate closure step and only then mark this Selection eligibility repair `CLOSED_LIVE`.
7. After closure, perform a fresh read-only reconciliation to choose the next manual Selection/Agreement dependency from the frozen MASTER plan; do not invent numbering or merge idempotency/calendar/Povezivanje into this unit.

### Frozen MASTER source rule

The governing frozen package remains `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip` with SHA-256 `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`.

The ZIP is a frozen product/system/execution authority, not a stale physical-state override. Its own start command requires a fresh physical preflight and rebaseline whenever GitHub/Supabase are newer than the freeze. Latest explicit owner decisions override older conflicting visual/donor/source details. Physical GitHub/live evidence determines what is already implemented and must not be redone.

### Safety locks that remain in force

- no D0140 production ALLOW activation;
- no RU-4B public Q&A activation;
- no monetization activation;
- no Povezivanje activation by implication;
- no raw public `app_profiles` exposure;
- no direct client write bypass where RPC authority exists;
- no fake production fallback;
- no invented ranking/note/calendar/selection policy;
- no live Supabase write before proof/promotion discipline is satisfied.