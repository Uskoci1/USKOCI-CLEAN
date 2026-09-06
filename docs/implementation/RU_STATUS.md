# USKOČI RU status

Current authoritative RU matrix candidate after RU-5 Manual Selection Eligibility Revalidation live application. It becomes canonical status when the closure/provenance branch is promoted after gates pass.

| Unit | Status | Current rule |
|---|---|---|
| RU-0 | CLOSED / LIVE | Do not redo unless an actual regression is proven. |
| RU-1 | CLOSED / LIVE | Worker readiness authority remains required at relevant command boundaries. |
| RU-2 | CLOSED / LIVE | Need V2 draft/Human Review authority remains canonical. |
| RU-3 | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | D0140 production ALLOW remains fail-closed. |
| RU-4 | CLOSED / LIVE | Do not redo owner-edit/revision closure. |
| RU-4B | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | Do not activate public Q&A until all governing blockers are resolved. |
| Client Data Layer | CLOSED / CANONICAL | Specialized owners remain canonical; no fake production fallback. |
| RU-5 | IN PROGRESS | Continue dependency-by-dependency; no invented numbering. |
| RU-5 P0C-01 | CLOSED / LIVE | Public-safe profile projection canonical; raw `app_profiles` remains protected. |
| RU-5 P0C-02 | CLOSED / LIVE | Atomic Application submit canonical/live; no historical snapshot backfill. |
| RU-5 P0C-03 | CLOSED / LIVE | My Applications projection + existing withdraw authority canonical/live. |
| RU-5 P0D-01 | CLOSED / LIVE | Requester Candidate Projection canonical/live. |
| RU-5 Manual Selection Eligibility Revalidation | CLOSED / LIVE | Current RU-1 readiness + current team-capacity are revalidated at Selection and candidate projection boundaries; historical rows are untouched. |
| RU-5B | NOT STARTED / GATED | Manual canonical Application/Selection lifecycle dependencies must be proven first. |
| RU-6A | FOUNDATION ONLY / GATED BY RU-5 | Calendar/Agreement authority must not be claimed complete prematurely. |
| RU-6B | NOT STARTED / GATED BY RU-6A | Shared Dogovor/Povezivanje work remains later. |
| RU-7 | FOUNDATION ONLY / GATED BY RU-6A/RU-6B | Deferred. |
| RU-8 | NOT STARTED / MANDATORY PROOF TRACK | Required before release closure. |

## Live checkpoint

- Supabase: `76 / 20260906065758_clean_ru5_selection_eligibility_revalidation`
- source: `20260906010000_clean_ru5_selection_eligibility_revalidation.sql`
- canonical/live recorded MD5: `6ddb7d5d141e7cb3a454fa7e6ca1280d`
- canonical/live recorded bytes: `17954`
- exact-byte identity: `TRUE`
- canonical implementation merge: `c0dd1434c436578e0f517520a2156b72ec5d3eaa`
- proof head: `d71c6e08b518e2955020c21538c1238358b14df3`
- proof run: `34017442269` — PASS
- PR PRE-P4 / CodeQL: `34017443678` / `34017442615` — PASS
- canonical PRE-P4 / CodeQL / Control-0: `34017639405` / `34017639038` / `34017639343` — PASS
- live function MD5s: Selection `ea1c1c40783dbfb9eeab527c128f9dd0`; Candidate `1978ce1d5852cef46f94e81468d37bba`
- business rows: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- snapshot rows: `0`
- response history preserved: `2 SUBMITTED / 2 SELECTED`; selected `need_selections=2`
- both current SUBMITTED rows match the new current-read `STALE` branch (`2/2`)
- D0140 rows: `0 / 0 / 0`; production ALLOW remains `FAIL_CLOSED`
- RU-4B governed inventory rows: all `0`; public Q&A remains blocked
- monetization: `FREE / 0 RSD`
- Povezivanje: not activated

## Explicit non-claims

The Selection eligibility repair did **not** add durable Selection payload-idempotency receipts, fix R05 lost-response retry identity, implement hard calendar conflicts, redesign Agreement/shared Dogovor, activate Povezivanje, define bounded-note policy, activate D0140/RU-4B/monetization or implement Application AI.

## RU-4B activation blockers remain

1. governed account-block authority is not complete;
2. owner-approved numeric `PRESELECTION_QA` rate policy is not defined;
3. reviewed/current `PRESELECTION_QA` production ALLOW is not activated;
4. trusted materiality authority is not production-activated.

These do not authorize activation and do not justify inventing missing policy values.

## Exact next cursor

`FRESH FROZEN-PLAN + CURRENT PHYSICAL RECONCILIATION OF REMAINING MANUAL SELECTION / AGREEMENT DEPENDENCIES`

Do not invent a new P0D/RU identifier. The first physically proven unresolved Selection risk is durable command idempotency/client retry identity, but it must be admitted as a separate unit only after the governing dependency plan is freshly reconciled. Calendar/double-booking remains separate RU-6A work. RU-5B remains gated.
