# USKOČI RU status

Current authoritative RU matrix after RU-5 P0C-02 live closure.

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
| RU-5 P0C-02 | CLOSED / LIVE | Atomic Application submit is canonical/live with current Worker readiness, team/remaining capacity, fixed MY_PRICE equality, durable replay, private per-version snapshot and deduplicated RESPONSE_RECEIVED event. Historical Applications are not backfilled. |
| RU-5 P0C-03 | NEXT | My Applications projection + withdrawal port: fresh read-only physical preflight before any proof branch or live write. |
| RU-5B | NOT STARTED / GATED | Manual canonical Application contract must be proven first. |
| RU-6A | FOUNDATION ONLY / GATED BY RU-5 | Do not advance before RU-5 dependency is satisfied. |
| RU-6B | NOT STARTED / GATED BY RU-6A | Deferred. |
| RU-7 | FOUNDATION ONLY / GATED BY RU-6A/RU-6B | Deferred. |
| RU-8 | NOT STARTED / MANDATORY PROOF TRACK | Required before release closure. |

## Live checkpoint

- Supabase: `73 / 20260905190040_clean_ru5_atomic_application_submit`
- P0C-02 source: `20260905190000_clean_ru5_atomic_application_submit.sql`
- canonical raw MD5: `1a397f893deb3109b8984035c19111bb` (`18107` bytes including terminal LF)
- live recorded statement MD5: `e573341dad8ed303d4c72f234e11b761` (`18106` bytes)
- transport reconciliation: live recorded statement omits only the terminal LF; `md5(live_statement || E'\n') = 1a397f893deb3109b8984035c19111bb`
- P0C-02 provenance: live alias `20260905190040` must be treated as terminal-LF-normalized semantic identity, not raw exact-byte identity
- business counts after live apply: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- new `private.response_application_snapshots` rows: `0` (no historical backfill)
- D0140 rows: `0 / 0 / 0`
- RU-4B governed inventory rows: all `0`
- monetization: `FREE / 0 RSD`

## P0C-02 explicit non-claims

P0C-02 did **not** activate or silently solve calendar hard-conflict authority, bounded-note policy, D0140, RU-4B, monetization, Application AI, or historical snapshot backfill. Those remain separate governed work.

## RU-4B activation blockers

1. governed account-block authority is not complete;
2. owner-approved numeric `PRESELECTION_QA` rate policy is not defined;
3. reviewed/current `PRESELECTION_QA` production ALLOW is not activated;
4. trusted materiality authority is not production-activated.

These blockers do not block RU-5 foundation/integrity work and do not authorize RU-4B activation.

## Exact next cursor

`RU-5 / P0C-03 — MY APPLICATIONS PROJECTION + WITHDRAW PORT — FRESH READ-ONLY PHYSICAL PREFLIGHT`
