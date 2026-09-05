# USKOČI current implementation status

Authoritative current status as of `2026-09-05`, after RU-5 P0C-01 live promotion and continuity/provenance closure.

## Current platform checkpoint

- canonical repo: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- RU-5 P0C-01 functional promotion: `366561e74a088d55d816d3795cba5f2299e3283c`
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migrations: `72`
- live head: `20260905163927_clean_ru5_public_profile_projection`
- P0C-01 source migration: `20260905133000_clean_ru5_public_profile_projection.sql`
- source/live MD5: `6fe4a4f013debb262700fbbe2e76c33e`
- P0C-01 recorded statement bytes: `2458`
- business counts at fresh preflight: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`
- RU-4B public preselection Q&A: `ACTIVATION_BLOCKED / DEFERRED`
- monetization: `FREE / 0 RSD`
- urgent activation: disabled; category allowlist empty
- raw cross-account `app_profiles`: forbidden; owner-only RLS remains
- production fake source fallback: forbidden

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
- RU-5 P0C-02 — `NEXT: READ-ONLY PHYSICAL PREFLIGHT`
- RU-5B — `NOT STARTED / GATED BY MANUAL RU-5`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## Exact next action

Open only `RU-5 / P0C-02 — ATOMIC APPLICATION SUBMIT` and begin with exhaustive read-only reconciliation of the existing Application submit authority. Do not code until the actual gap versus current `rpc_submit_response` is proven.

Historical handoff/network sections that show live `71` or P0C-01 as next are retained as historical checkpoints, not current authority. Current authority is this file plus `IMPLEMENTATION_CONTINUITY.md`, `RU_STATUS.md`, `LIVE_MIGRATION_STATE.json`, the canonical repository state, and fresh live Supabase reads.
