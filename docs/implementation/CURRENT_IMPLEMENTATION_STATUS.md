# USKOČI current implementation status

Authoritative current status as of `2026-09-05`, after RU-5 P0C-03 canonical promotion, live apply and exact-byte structural postflight.

## Current platform checkpoint

- canonical repo: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- RU-5 P0C-03 canonical merge: `3fe3768f1dde3aa32340c6bd60167fd9aa610c47`
- final P0C-03 proof SHA: `bffc533996a7f629846eaf51de231320df41e09b`
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migrations: `74`
- live head: `20260905200133_clean_ru5_my_applications_projection`
- P0C-03 source migration: `20260905211500_clean_ru5_my_applications_projection.sql`
- canonical/live recorded MD5: `868ef30987d3a62b84b41e93efeed047`
- canonical/live recorded UTF-8 bytes: `6353`
- byte identity: `TRUE`
- business counts after live postflight: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`
- RU-4B public preselection Q&A: `ACTIVATION_BLOCKED / DEFERRED`
- monetization: `FREE / 0 RSD`
- urgent activation: disabled; category allowlist empty
- raw cross-account `app_profiles`: forbidden; owner-only RLS remains
- production fake source fallback: forbidden
- bounded preselection-note policy: unresolved / separate governed work
- hard calendar-conflict authority: unresolved / separate governed work
- candidate selection semantics: unchanged by P0C-03

## RU status summary

- RU-0 — `CLOSED / LIVE / DO NOT REDO`
- RU-1 — `CLOSED / LIVE / DO NOT REDO`
- RU-2 — `CLOSED / LIVE / DO NOT REDO`
- RU-3 — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- RU-4 — `CLOSED / LIVE / DO NOT REDO`
- RU-4B — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- Client Data Layer — `CLOSED / CANONICAL / DO NOT REDO`
- RU-5 — `IN PROGRESS`
- RU-5 P0C-01 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0C-02 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0C-03 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0D-01 — `NEXT: READ-ONLY PHYSICAL PREFLIGHT`
- RU-5B — `NOT STARTED / GATED BY MANUAL RU-5`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## P0C-03 proof and promotion evidence

- final security-pinned disposable proof workflow: `33988582621` — live-73 predecessor replay, checksum, projection-only guard, authenticated own-only lifecycle proof, withdrawal replay/denial proof, rollback/zero residue, TypeScript and full regression PASS on `bffc5339...`
- PR PRE-P4: `33988584895` — PASS
- PR CodeQL: `33988582873` — JavaScript/TypeScript, Python and Actions PASS
- canonical push PRE-P4: `33988758024` — PASS
- canonical push CodeQL: `33988757345` — JavaScript/TypeScript, Python and Actions PASS
- canonical Control-0: `33988758119` — PASS
- live postflight: 74 migration state, authenticated-only projection execute, direct response writes still denied, exact source/live MD5 and byte identity, business counts unchanged, D0140/RU-4B inventories still zero

## Exact next action

Open only `RU-5 / P0D-01 — CANDIDATE PROJECTION` and begin with fresh read-only physical reconciliation of the current Requester-facing candidate list, Application/version binding, public-safe Worker evidence, ranking/order fields actually present, selection prerequisites and privacy boundaries. Do not change `rpc_select_response`, Agreement creation, capacity/calendar authority or product semantics until a concrete P0D-01 gap is physically proven.

P0C-03 is closed and must not be redone. Bounded-note policy, calendar hard-conflict authority, D0140, RU-4B, monetization and Application AI remain separate governed work.

Historical handoff/network sections that show live `71`, `72`, `73`, P0C-01/P0C-02/P0C-03 next are retained as historical checkpoints, not current authority. Current authority is this file plus `IMPLEMENTATION_CONTINUITY.md`, `RU_STATUS.md`, `LIVE_MIGRATION_STATE.json`, canonical GitHub state, governing master/owner decisions and fresh live Supabase reads.
