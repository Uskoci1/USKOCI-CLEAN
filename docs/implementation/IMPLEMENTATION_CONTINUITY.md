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

### Exact next cursor

`RU-5 — REMAINING MANUAL SELECTION GAPS — FRESH READ-ONLY PHYSICAL RECONCILIATION`

Before any new numbered unit, code or live write:

1. fresh-read the current `rpc_select_response` implementation and all production consumers;
2. inspect what it revalidates at selection time versus what P0C-02/P0D-01 already prove;
3. reconcile legacy over-capacity Applications without rewriting historical rows;
4. inspect exact Selection → Agreement creation/binding and idempotency behavior;
5. inspect calendar/double-booking dependencies only as read-only evidence; do not invent hard-conflict policy;
6. preserve exact version/hash/Need revision binding and existing authority boundaries;
7. only after a concrete remaining gap and governing scope are physically proven, admit the smallest next unit.

No RU-5B Application AI work is admissible until the remaining manual RU-5 Application/Selection lifecycle dependencies are proven.

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
