# USKOČI implementation continuity

## Current authoritative checkpoint — 2026-09-05 — POST RU-5 / P0C-01 LIVE

This file is the current forward continuity pointer. Older checkpoint sections in `HANDOFF.md`, `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, and `docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md` are retained as historical evidence even where they record the earlier live-71 / P0C-01-next state; they are superseded by this checkpoint, `CURRENT_IMPLEMENTATION_STATUS.md`, `RU_STATUS.md`, and `LIVE_MIGRATION_STATE.json`.

### Canonical repository

- repository: `Uskoci1/USKOCI-CLEAN`
- branch: `clean-alpha-backend`
- P0C-01 functional promotion: `366561e74a088d55d816d3795cba5f2299e3283c`
- first post-promotion continuity commit observed: `23f9756cbd9dec38d05161d60007d0fb15edbe0c`
- all work after `366561e...` before this closure was documentation/provenance continuity only; no later functional implementation was found in the fresh reconciliation.

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- migration count: `72`
- head: `20260905163927_clean_ru5_public_profile_projection`
- canonical source migration: `20260905133000_clean_ru5_public_profile_projection.sql`
- exact byte identity: `TRUE`
- canonical raw MD5: `6fe4a4f013debb262700fbbe2e76c33e`
- live recorded statement MD5: `6fe4a4f013debb262700fbbe2e76c33e`
- recorded statement UTF-8 bytes: `2458`

Fresh live read-only postflight reconfirmed:

- `rpc_get_public_profile(uuid)` exists, is `STABLE`, `SECURITY DEFINER`, `authenticated EXECUTE = YES`, `anon EXECUTE = NO`;
- raw `public.app_profiles` remains RLS enabled and `app_profiles_select_own` remains owner-only;
- business counts at this checkpoint: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`;
- D0140 inventory remains zero: `publication_policy_bundles=0`, `publication_policy_rule_refs=0`, `need_publication_decisions=0`;
- RU-4B inventory remains zero: questions/answers/policy decisions/materiality decisions/commands all `0`;
- D0140 production ALLOW remains fail-closed; `rpc_record_need_publication_decision_service` still rejects `ALLOW` with `RU3_ALLOW_NOT_ENABLED`;
- RU-4B remains foundation-only / activation blocked;
- V1 monetization remains `FREE / 0 RSD`;
- urgent activation remains disabled and its category allowlist remains empty.

### RU-5 / P0C-01

Status: `CLOSED / CANONICAL / LIVE / DO NOT REDO`.

Public-safe profile projection remains intentionally narrow. Trust fields without a governing authority remain fail-closed. Raw cross-account `app_profiles` exposure remains forbidden.

P0C-01 provenance is no longer pending. `supabase/migrations/MIGRATION_PROVENANCE.json` records the live alias and exact-byte identity.

### Exact next cursor

`RU-5 / P0C-02 — ATOMIC APPLICATION SUBMIT`

Before any code or live write:

1. perform exhaustive read-only physical preflight of `marketplace_responses`, constraints/indexes/triggers/RLS/grants;
2. inspect `rpc_submit_response` and `private.response_submit_commands` idempotency semantics;
3. inspect Need eligibility/lifecycle/deadline rules;
4. prove `covered_slots` versus Worker/team capacity semantics;
5. inspect withdraw + selection compatibility;
6. inspect Opportunity/Application client ports and W03/W04/W05/R05/R06 consumers;
7. only after the preflight identifies a concrete gap, open a small proof branch.

No RU-5B Application AI work is admissible until the manual canonical Application contract is proven.

### Safety locks that remain in force

- no D0140 production ALLOW activation;
- no RU-4B public Q&A activation;
- no monetization activation;
- no raw public `app_profiles` exposure;
- no direct client write bypass where RPC authority exists;
- no fake production fallback;
- no live Supabase write before proof/promotion discipline is satisfied.
