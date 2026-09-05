# USKOČI implementation continuity

## Current authoritative checkpoint — 2026-09-05 — POST RU-5 / P0C-03 LIVE

This file is the current forward continuity pointer. Older checkpoint sections in `HANDOFF.md`, `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md`, and earlier status files are retained as historical evidence even where they record live-71/live-72/live-73 or P0C-01/P0C-02/P0C-03-next state; they are superseded by this checkpoint, `CURRENT_IMPLEMENTATION_STATUS.md`, `RU_STATUS.md`, `LIVE_MIGRATION_STATE.json`, canonical GitHub state and fresh live Supabase reads.

### Canonical repository

- repository: `Uskoci1/USKOCI-CLEAN`
- branch: `clean-alpha-backend`
- P0C-03 final proof SHA: `bffc533996a7f629846eaf51de231320df41e09b`
- P0C-03 canonical merge: `3fe3768f1dde3aa32340c6bd60167fd9aa610c47`
- final proof run: `33988582621` — PASS
- PR PRE-P4: `33988584895` — PASS
- PR CodeQL: `33988582873` — JS/TS, Python and Actions PASS
- canonical push PRE-P4: `33988758024` — PASS
- canonical push CodeQL: `33988757345` — JS/TS, Python and Actions PASS
- canonical Control-0: `33988758119` — PASS

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- migration count: `74`
- head: `20260905200133_clean_ru5_my_applications_projection`
- canonical source migration: `20260905211500_clean_ru5_my_applications_projection.sql`
- canonical raw MD5: `868ef30987d3a62b84b41e93efeed047`
- canonical UTF-8 bytes: `6353`
- live recorded statement MD5: `868ef30987d3a62b84b41e93efeed047`
- live recorded statement UTF-8 bytes: `6353`
- raw exact-byte identity: `TRUE`

Fresh live postflight reconfirmed:

- `rpc_list_my_applications()` exists, is STABLE + SECURITY DEFINER and is executable by `authenticated` only;
- projection is bound to `worker_account_id = auth.uid()` and returns canonical Worker-facing lifecycle mapping;
- terminal `WITHDRAWN` takes precedence over stale-revision mapping;
- selected Applications expose exact Agreement link and cannot use standard withdrawal;
- standard withdrawal remains `rpc_withdraw_response`; stale resolution remains the separate RU-4 authority;
- authenticated direct INSERT/UPDATE remains denied on response authority tables;
- business counts remain `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`;
- D0140 inventory remains zero: `publication_policy_bundles=0`, `publication_policy_rule_refs=0`, `need_publication_decisions=0`;
- RU-4B governed inventory remains zero;
- D0140 production ALLOW remains fail-closed;
- RU-4B remains foundation-only / activation blocked;
- V1 monetization remains `FREE / 0 RSD`.

### RU-5 / P0C-03

Status: `CLOSED / CANONICAL / LIVE / DO NOT REDO`.

The closed unit proves a single production read owner for Worker My Applications, own-only privacy, canonical lifecycle mapping, selected Agreement navigation, standard withdrawal with exact request-key replay semantics, selected withdrawal denial, stale handoff to the existing RU-4 resolver, direct response-write denial and W06 client cutover. The old raw `ru4Production.mojePrijave()` shadow reader is physically removed.

P0C-03 does **not** change Selection/Agreement semantics or claim calendar, bounded-note, D0140, RU-4B, monetization, Application AI or legacy Application repair.

### Exact next cursor

`RU-5 / P0D-01 — CANDIDATE PROJECTION`

Before any code or live write:

1. fresh-read the current Requester-facing candidate/Application read path and all consumers;
2. identify exactly which Application version/hash/revision fields are needed for safe selection binding;
3. reconcile public-safe Worker/profile evidence with P0C-01 and private Application snapshot authority without exposing raw `app_profiles`;
4. inspect current ordering/ranking fields physically present; do not invent ranking policy;
5. inspect `rpc_select_response` prerequisites and current Selection/Agreement binding read-only; do not modify it in preflight;
6. prove requester ownership/visibility boundaries and direct-write denial;
7. only after a concrete physical gap is identified, open the smallest P0D-01 proof branch.

Known broader Selection gaps such as legacy over-capacity selection revalidation and calendar hard-conflict authority remain separately tracked; they must not be silently folded into Candidate Projection without a proven dependency and governing scope.

No RU-5B Application AI work is admissible until the manual RU-5 Application lifecycle dependencies are proven.

### Safety locks that remain in force

- no D0140 production ALLOW activation;
- no RU-4B public Q&A activation;
- no monetization activation;
- no raw public `app_profiles` exposure;
- no direct client write bypass where RPC authority exists;
- no fake production fallback;
- no live Supabase write before proof/promotion discipline is satisfied.
