# USKOČI current implementation status

Authoritative current status as of `2026-09-05`, after RU-5 P0C-02 canonical promotion, live apply and structural postflight.

## Current platform checkpoint

- canonical repo: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- RU-5 P0C-02 canonical merge: `bc784f3ed65d3a053195789740fae17e4df235d3`
- final P0C-02 proof SHA: `2d6b1a64d9760bddcca1e4751945fdccc8a5e6ba`
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migrations: `73`
- live head: `20260905190040_clean_ru5_atomic_application_submit`
- P0C-02 source migration: `20260905190000_clean_ru5_atomic_application_submit.sql`
- canonical raw MD5: `1a397f893deb3109b8984035c19111bb` / `18107` bytes including terminal LF
- live recorded statement MD5: `e573341dad8ed303d4c72f234e11b761` / `18106` bytes
- transport reconciliation: the live recorded statement omits only the final LF; appending it produces canonical MD5 `1a397f893deb3109b8984035c19111bb`
- business counts after live postflight: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- P0C-02 snapshot rows after migration: `0` (historical Applications were not backfilled)

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`
- RU-4B public preselection Q&A: `ACTIVATION_BLOCKED / DEFERRED`
- monetization: `FREE / 0 RSD`
- urgent activation: disabled; category allowlist empty
- raw cross-account `app_profiles`: forbidden; owner-only RLS remains
- production fake source fallback: forbidden
- bounded preselection-note policy: unresolved / not silently activated by P0C-02
- hard calendar-conflict authority for Application submit: unresolved / separate governed work

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
- RU-5 P0C-03 — `NEXT: READ-ONLY PHYSICAL PREFLIGHT`
- RU-5B — `NOT STARTED / GATED BY MANUAL RU-5`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## P0C-02 proof and promotion evidence

- disposable proof workflow: `33982216558` — migration/provenance integrity, live-72 predecessor replay, candidate apply, authenticated rollback-only runtime proof, TypeScript and full regression all PASS on proof SHA `2d6b1a64...`
- PR PRE-P4: `33982373215` — PASS
- PR CodeQL: `33982372198` — JavaScript/TypeScript, Python and Actions PASS
- canonical push PRE-P4: `33985675818` — PASS
- canonical push CodeQL: `33985675330` — JavaScript/TypeScript, Python and Actions PASS
- live postflight: 73 migration state, correct grants/RLS/function markers, zero snapshot backfill, business counts unchanged, D0140/RU-4B inventories still zero

## Exact next action

Open only `RU-5 / P0C-03 — MY APPLICATIONS PROJECTION + WITHDRAW PORT` and begin with fresh read-only physical reconciliation of the existing own-Application read model, `rpc_withdraw_response`, response/version state semantics, ownership/RLS/idempotency and the W06 client consumer. Do not code until the actual physical gap versus the frozen P0C-03 contract is proven.

P0C-03 is the next unit in the frozen forward blueprint. Bounded-note policy and calendar hard-conflict authority remain separate unresolved work and are not to be smuggled into P0C-03 unless a newer explicit owner decision admits them.

Historical handoff/network sections that show live `71`, `72`, P0C-01 next or P0C-02 next are retained as historical checkpoints, not current authority. Current authority is this file plus `IMPLEMENTATION_CONTINUITY.md`, `RU_STATUS.md`, `LIVE_MIGRATION_STATE.json`, canonical GitHub state, governing master/owner decisions and fresh live Supabase reads.
