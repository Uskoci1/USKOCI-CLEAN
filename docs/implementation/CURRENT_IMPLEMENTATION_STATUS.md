# USKOČI current implementation status

Authoritative current status as of `2026-09-06`, after RU-5 P0D-01 canonical promotion, live apply and exact-byte structural postflight.

## Current platform checkpoint

- canonical repo: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- RU-5 P0D-01 canonical merge: `de3e25ce248d745d5a908fe1edf0a3e7b44d53c1`
- final P0D-01 proof SHA: `bc4dacbd853ca506845e8bf0253b91cd55f6629a`
- final P0D-01 proof run: `33993116261` — PASS
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migrations: `75`
- live head: `20260905230326_clean_ru5_candidate_projection`
- P0D-01 source migration: `20260905223000_clean_ru5_candidate_projection.sql`
- canonical/live recorded MD5: `e69c6037c876ca4c0fb48409ab68ab45`
- canonical/live recorded UTF-8 bytes: `8246`
- byte identity: `TRUE`
- business counts after live postflight: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- P0C-02 Application snapshot rows remain `0`; no historical backfill was performed

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`
- RU-4B public preselection Q&A: `ACTIVATION_BLOCKED / DEFERRED`
- monetization: `FREE / 0 RSD`
- urgent activation: disabled; category allowlist empty
- raw cross-account `app_profiles`: forbidden; owner-only RLS remains
- production fake source fallback: forbidden
- bounded preselection-note policy: unresolved / separate governed work
- hard calendar-conflict authority: unresolved / separate governed work
- Selection semantic repair and legacy over-capacity revalidation: unresolved / separate governed work
- Povezivanje activation: not activated
- Application AI: gated by remaining manual RU-5 dependencies

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
- RU-5 P0D-01 — `CLOSED / LIVE / DO NOT REDO`
- RU-5B — `NOT STARTED / GATED BY MANUAL RU-5`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## P0D-01 proof and promotion evidence

- final proof SHA: `bc4dacbd853ca506845e8bf0253b91cd55f6629a`
- final security-pinned disposable proof workflow: `33993116261` — migration/provenance integrity, live-74 predecessor replay, exact checksum, projection-only guard, authenticated Requester ownership/privacy proof, canonical candidate-state mapping, V1/legacy evidence proof, exact version/hash Selection binding, rollback/zero residue, TypeScript and full regression PASS
- PR #22 PRE-P4: `33993284041` — PASS
- PR #22 CodeQL: `33993283308` — JavaScript/TypeScript, Python and Actions PASS
- canonical merge: `de3e25ce248d745d5a908fe1edf0a3e7b44d53c1`
- canonical push PRE-P4: `33997533070` — PASS
- canonical push CodeQL: `33997532816` — JavaScript/TypeScript, Python and Actions PASS
- canonical Control-0: `33997533227` — PASS
- live postflight: 75 migration state, authenticated Requester-owner projection execute only, direct response writes still denied, exact source/live MD5 and byte identity, business counts unchanged, D0140/RU-4B inventories still zero
- existing `rpc_select_response` definition MD5 remains `90332c500eb8fe9f1b7379fa382af3b6`
- live candidate function definition MD5: `3ae7a217d0a7901b31edb75501fa6d5a`

## Exact next action

Begin only a **fresh read-only physical reconciliation of the remaining manual Selection gaps after P0D-01**. Inspect the current `rpc_select_response` implementation and its consumers, legacy over-capacity revalidation, exact Agreement creation/binding behavior and calendar dependencies. Do not assign a new numbered P0D unit, change Selection semantics, add calendar authority or write live state until a concrete physical gap and governing scope are proven.

P0D-01 is closed and must not be redone. Bounded-note policy, calendar hard-conflict authority, D0140, RU-4B, monetization, Povezivanje activation and Application AI remain separate governed work.

Historical handoff/network sections that show live `71`, `72`, `73`, `74`, or P0C/P0D-01-next states are retained as historical checkpoints, not current authority. Current authority is this file plus `IMPLEMENTATION_CONTINUITY.md`, `RU_STATUS.md`, `LIVE_MIGRATION_STATE.json`, canonical GitHub state, governing master/owner decisions and fresh live Supabase reads.
