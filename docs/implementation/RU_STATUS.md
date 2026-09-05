# USKOČI RU status

Current authoritative RU matrix after RU-5 P0D-01 live closure.

| Unit | Status | Current rule |
|---|---|---|
| RU-0 | CLOSED / LIVE | Do not redo unless an actual regression is proven. |
| RU-1 | CLOSED / LIVE | Worker readiness authority remains required. |
| RU-2 | CLOSED / LIVE | Need V2 draft/Human Review authority remains canonical. |
| RU-3 | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | D0140 production ALLOW remains fail-closed. |
| RU-4 | CLOSED / LIVE | Do not redo owner-edit/revision closure. |
| RU-4B | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | Do not activate public Q&A until all four governing blockers are resolved. |
| Client Data Layer | CLOSED / CANONICAL | Do not invent CDL-A13; specialized owners remain canonical. |
| RU-5 | IN PROGRESS | Continue unit-by-unit. |
| RU-5 P0C-01 | CLOSED / LIVE | Public-safe profile projection is canonical; raw app_profiles remains owner-only. |
| RU-5 P0C-02 | CLOSED / LIVE | Atomic Application submit is canonical/live; historical Applications remain unbackfilled. |
| RU-5 P0C-03 | CLOSED / LIVE | Own-Worker My Applications projection + existing withdrawal authority are canonical/live. |
| RU-5 P0D-01 | CLOSED / LIVE | Requester Candidate Projection is canonical/live; exact Application version/hash binding is exposed without changing Selection semantics. |
| RU-5B | NOT STARTED / GATED | Manual canonical Application/Selection lifecycle dependencies must be proven first. |
| RU-6A | FOUNDATION ONLY / GATED BY RU-5 | Do not advance before RU-5 dependency is satisfied. |
| RU-6B | NOT STARTED / GATED BY RU-6A | Deferred. |
| RU-7 | FOUNDATION ONLY / GATED BY RU-6A/RU-6B | Deferred. |
| RU-8 | NOT STARTED / MANDATORY PROOF TRACK | Required before release closure. |

## Live checkpoint

- Supabase: `75 / 20260905230326_clean_ru5_candidate_projection`
- P0D-01 source: `20260905223000_clean_ru5_candidate_projection.sql`
- canonical/live recorded MD5: `e69c6037c876ca4c0fb48409ab68ab45`
- canonical/live recorded bytes: `8246`
- exact-byte identity: `TRUE`
- canonical promotion SHA: `de3e25ce248d745d5a908fe1edf0a3e7b44d53c1`
- proof SHA: `bc4dacbd853ca506845e8bf0253b91cd55f6629a`
- business counts after live apply: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- Application snapshot rows remain `0`; no historical backfill was performed
- authenticated-only `rpc_list_need_candidates(uuid)` exists; anon/service execute remain denied
- authenticated direct response INSERT/UPDATE and response-version INSERT remain denied
- existing `rpc_select_response` definition MD5 remains `90332c500eb8fe9f1b7379fa382af3b6`
- D0140 rows: `0 / 0 / 0`
- RU-4B governed inventory rows: all `0`
- monetization: `FREE / 0 RSD`

## P0D-01 explicit non-claims

P0D-01 did **not** change Selection semantics, repair legacy over-capacity selection behavior, redesign Agreement creation/snapshots, activate calendar hard-conflict authority, Povezivanje, bounded-note policy, D0140, RU-4B, monetization or Application AI. Those remain separate governed work.

## RU-4B activation blockers

1. governed account-block authority is not complete;
2. owner-approved numeric `PRESELECTION_QA` rate policy is not defined;
3. reviewed/current `PRESELECTION_QA` production ALLOW is not activated;
4. trusted materiality authority is not production-activated.

These blockers do not block RU-5 foundation/integrity work and do not authorize RU-4B activation.

## Exact next cursor

`RU-5 — REMAINING MANUAL SELECTION GAPS — FRESH READ-ONLY PHYSICAL RECONCILIATION`

Do not invent a new numbered P0D unit from this status file. Fresh-read the current `rpc_select_response` revalidation, legacy over-capacity behavior, Agreement binding and calendar dependencies first; admit the smallest next unit only after a concrete gap and governing scope are physically proven.
