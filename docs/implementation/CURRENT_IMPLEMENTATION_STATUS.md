# USKOČI current implementation status

Authoritative current status as of `2026-09-06`, after canonical/live closure of the RU-5 Manual Selection Eligibility Revalidation.

## Current platform checkpoint

- canonical repo: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- Selection eligibility canonical implementation merge: `c0dd1434c436578e0f517520a2156b72ec5d3eaa`
- closure/provenance canonical merge: `cc507910a10515db52f0b0db6d86478cfd19ea05`
- final exact-head proof SHA: `d71c6e08b518e2955020c21538c1238358b14df3`
- proof run: `34017442269` — PASS
- PR #23 PRE-P4: `34017443678` — PASS
- PR #23 CodeQL: `34017442615` — Actions, Python and JavaScript/TypeScript PASS
- implementation canonical push PRE-P4: `34017639405` — PASS
- implementation canonical push CodeQL: `34017639038` — Actions, Python and JavaScript/TypeScript PASS
- implementation canonical Control-0: `34017639343` — PASS
- closure PR #24 PRE-P4: `34018929991` — PASS
- closure PR #24 CodeQL: `34018929257` — Actions, Python and JavaScript/TypeScript PASS
- closure canonical push PRE-P4: `34019026629` — PASS
- closure canonical push CodeQL: `34019026435` — Actions, Python and JavaScript/TypeScript PASS
- closure canonical Control-0: `34019026661` — PASS
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migrations: `76`
- live head: `20260906065758_clean_ru5_selection_eligibility_revalidation`
- source migration: `20260906010000_clean_ru5_selection_eligibility_revalidation.sql`
- canonical/live recorded MD5: `6ddb7d5d141e7cb3a454fa7e6ca1280d`
- canonical/live recorded UTF-8 bytes: `17954`
- exact-byte identity: `TRUE`
- business counts after final fresh live postflight: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- Application snapshot rows: `0`; no historical backfill was performed
- response states remain `2 SUBMITTED / 2 SELECTED`; historical selected rows were not rewritten

## Selection eligibility closure

- `rpc_select_response(uuid,integer,uuid,integer,text,text)` revalidates current RU-1 minimum Worker readiness and current `covered_slots <= team_capacity` immediately before Selection write authority;
- `rpc_list_need_candidates(uuid)` applies the same current-read checks and reuses existing `STALE / canSelect=false` rather than introducing a new state;
- live Selection function MD5: `ea1c1c40783dbfb9eeab527c128f9dd0`;
- live Candidate function MD5: `1978ce1d5852cef46f94e81468d37bba`;
- current live legacy SUBMITTED rows matching the new STALE branch: `2/2`;
- authenticated direct response INSERT/UPDATE/DELETE remains denied;
- `need_selections` RLS remains enabled with one authenticated SELECT policy and zero DML policies;
- Selection grant boundary remains authenticated + service_role, anon denied;
- Candidate projection remains authenticated-only, anon/service_role denied.

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`
- D0140 inventories: `0 / 0 / 0`
- RU-4B public preselection Q&A: `ACTIVATION_BLOCKED / DEFERRED`
- all RU-4B governed inventories: `0`
- monetization: `FREE / 0 RSD`
- urgent production activation: unchanged/disabled
- raw cross-account `app_profiles`: forbidden; owner/private projection boundaries remain
- production fake source fallback: forbidden
- Povezivanje: not activated
- Application AI / RU-5B: gated by remaining manual lifecycle dependencies

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
- RU-5 Manual Selection Eligibility Revalidation — `CLOSED / CANONICAL / LIVE / DO NOT REDO`
- RU-5B — `NOT STARTED / GATED BY MANUAL RU-5`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## Explicit non-claims

This unit does not close Selection durable idempotency/client retry identity, calendar hard-conflict authority, Agreement/shared-Dogovor redesign, Povezivanje, bounded-note policy, D0140, RU-4B, monetization or Application AI.

The live SQL inspection connector runs as `supabase_read_only_user` and therefore cannot execute the requester-only candidate RPC. No grant or production privilege was widened merely to manufacture a live authenticated replay. Authenticated behavior was already proved on the disposable proof stack; live closure uses exact-byte migration identity, exact function definitions/grants, preserved live rows and direct current-row classification.

## Exact next action

Fresh-read the frozen dependency plan plus current canonical/live Selection and Agreement state. Do not invent a new numbered P0D unit.

The first physically proven unresolved Selection risk to reconcile is durable command identity/idempotency: the server currently replays by `(need_id, client_request_id)` without a durable payload hash/receipt and R05 generates a fresh Selection request ID per press. Admit it as a separate unit only if the governing dependency read confirms it as next.

Hard calendar/double-booking authority remains separate RU-6A work and must be closed before claiming confirmed Agreements are collision-safe. Shared Dogovor/Povezivanje remains later and must not be activated by implication. RU-5B Application AI remains gated.
