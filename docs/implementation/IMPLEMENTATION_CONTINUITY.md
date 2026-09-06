# USKOČI implementation continuity

## Current authoritative checkpoint — 2026-09-06 — RU-5 MANUAL SELECTION ELIGIBILITY REVALIDATION CLOSED / CANONICAL / LIVE

This is the current forward continuity pointer. The governing frozen package remains unchanged and older checkpoints remain available in Git history and their original evidence artifacts. They must not override this newer physically proven state.

### Frozen authority

- package: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`
- SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- rule: frozen MASTER defines product/system intent; current GitHub/live state defines what is already physically implemented; latest explicit owner decisions supersede older conflicting product/UI material.

### Canonical GitHub implementation

- repository: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- Selection eligibility proof branch final gated head: `d71c6e08b518e2955020c21538c1238358b14df3`
- implementation PR: `#23`
- canonical implementation merge: `c0dd1434c436578e0f517520a2156b72ec5d3eaa`
- closure/provenance PR: `#24`
- closure/provenance canonical merge: `cc507910a10515db52f0b0db6d86478cfd19ea05`
- locked source migration: `supabase/migrations/20260906010000_clean_ru5_selection_eligibility_revalidation.sql`
- canonical raw MD5: `6ddb7d5d141e7cb3a454fa7e6ca1280d`
- canonical UTF-8 bytes: `17954`

### Proof and promotion gates

- exact-head Selection proof: `34017442269` — PASS
  - predecessor replay: PASS
  - narrow two-function scope: PASS
  - unready Worker -> existing `STALE`: PASS
  - current team-capacity drift -> existing `STALE`: PASS
  - ready Worker -> `SELECTABLE`: PASS
  - invalid Selection denied with zero partial writes: PASS
  - exact Agreement binding: PASS
  - P0D-01 regression: PASS
  - TypeScript: PASS
  - Jest: `21/21` suites, `136/136` tests PASS
- implementation PR PRE-P4: `34017443678` — PASS
- implementation PR CodeQL: `34017442615` — Actions/Python/JavaScript-TypeScript PASS
- implementation canonical push PRE-P4: `34017639405` — PASS
- implementation canonical push CodeQL: `34017639038` — Actions/Python/JavaScript-TypeScript PASS
- implementation canonical Control-0: `34017639343` — PASS
- closure PR PRE-P4: `34018929991` — PASS
- closure PR CodeQL: `34018929257` — Actions/Python/JavaScript-TypeScript PASS
- closure canonical push PRE-P4: `34019026629` — PASS
- closure canonical push CodeQL: `34019026435` — Actions/Python/JavaScript-TypeScript PASS
- closure canonical Control-0: `34019026661` — PASS

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- live migration count: `76`
- live head: `20260906065758_clean_ru5_selection_eligibility_revalidation`
- canonical source version: `20260906010000`
- live recorded statement count: `1`
- live recorded statement MD5: `6ddb7d5d141e7cb3a454fa7e6ca1280d`
- live recorded statement UTF-8 bytes: `17954`
- canonical/live byte identity: `TRUE`

Final fresh live postflight after closure promotion:

- `rpc_select_response(uuid,integer,uuid,integer,text,text)` definition MD5: `ea1c1c40783dbfb9eeab527c128f9dd0`;
- `rpc_list_need_candidates(uuid)` definition MD5: `1978ce1d5852cef46f94e81468d37bba`;
- Selection EXECUTE: authenticated `TRUE`, service_role `TRUE`, anon `FALSE`;
- Candidate projection EXECUTE: authenticated `TRUE`, service_role `FALSE`, anon `FALSE`;
- authenticated direct `marketplace_responses` INSERT/UPDATE/DELETE remains denied;
- `need_selections` keeps RLS enabled; authenticated has one SELECT policy and zero DML policies;
- business rows are unchanged: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`;
- historical state is unchanged: `2` SELECTED responses, `2` SELECTED `need_selections`, `2` Agreements;
- legacy open Applications remain rows rather than being rewritten: `2` SUBMITTED;
- snapshot rows remain `0`; no backfill occurred;
- both current SUBMITTED rows satisfy the new current-read `STALE` branch (`2/2`);
- D0140 inventories remain `0/0/0`;
- all RU-4B governed inventories remain `0`;
- D0140 production ALLOW remains fail-closed;
- RU-4B public Q&A remains activation blocked;
- monetization remains `FREE / 0 RSD`;
- Povezivanje remains not activated;
- Application AI remains gated.

The connected SQL inspection channel executes as `supabase_read_only_user`, which intentionally does not have EXECUTE on requester-only `rpc_list_need_candidates`. Therefore live authenticated RPC replay was not fabricated by changing grants or escalating that channel. The exact live function bytes/definition, authenticated grant, current live rows and prior authenticated disposable proof together establish the closure evidence without weakening production access boundaries.

## Unit verdict

`RU-5 MANUAL SELECTION ELIGIBILITY REVALIDATION` — `CLOSED / CANONICAL / LIVE / DO NOT REDO`.

The unit changes only the two admitted Selection functions. It does not rewrite historical Applications/Selections/Agreements and does not introduce a new product state.

### Explicit non-claims / separate dependencies

This closure does **not** claim or implement:

- durable Selection request-payload idempotency / command receipt;
- durable R05 retry identity after a lost network response;
- calendar hard double-book prevention;
- Agreement/shared-Dogovor redesign;
- Povezivanje activation;
- bounded-note policy;
- D0140 production ALLOW;
- RU-4B public Q&A activation;
- monetization;
- Application AI / RU-5B.

## Exact continuation cursor after closure

Do **not** invent a new P0D/RU number. Fresh-read the frozen dependency plan and current physical Selection/Agreement state before admitting another unit.

The first already-proven unresolved manual Selection risk to reconcile is durable command idempotency/client retry identity: server replay currently keys Selection by `(need_id, client_request_id)` without a durable payload hash/receipt, while R05 currently creates a new Selection request ID per press. Treat that only as a candidate next unit after governing-plan reconciliation, not as part of this closed eligibility repair.

Calendar/double-booking remains a separate RU-6A dependency and must precede any claim that confirmed Agreements are collision-safe. Shared Dogovor/Povezivanje remains later and must not be activated by implication.

### Safety locks that remain in force

- no D0140 production ALLOW activation;
- no RU-4B public Q&A activation;
- no monetization activation;
- no Povezivanje activation by implication;
- no raw public `app_profiles` exposure;
- no direct-client write bypass where RPC authority exists;
- no fake production fallback;
- no invented ranking/note/calendar/selection policy;
- no RU-5B Application AI until the manual lifecycle dependency boundary is closed.
