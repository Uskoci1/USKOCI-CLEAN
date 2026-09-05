# USKOČI RU status

Current authoritative RU matrix after RU-5 P0C-01 live closure.

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
| RU-5 P0C-02 | NEXT | Atomic Application submit read-only preflight, then smallest proof branch only if a real gap is proven. |
| RU-5B | NOT STARTED / GATED | Manual canonical Application contract must be proven first. |
| RU-6A | FOUNDATION ONLY / GATED BY RU-5 | Do not advance before RU-5 dependency is satisfied. |
| RU-6B | NOT STARTED / GATED BY RU-6A | Deferred. |
| RU-7 | FOUNDATION ONLY / GATED BY RU-6A/RU-6B | Deferred. |
| RU-8 | NOT STARTED / MANDATORY PROOF TRACK | Required before release closure. |

## Live checkpoint

- Supabase: `72 / 20260905163927_clean_ru5_public_profile_projection`
- P0C-01 source: `20260905133000_clean_ru5_public_profile_projection.sql`
- source/live MD5: `6fe4a4f013debb262700fbbe2e76c33e`
- P0C-01 provenance: `CLOSED_LIVE`, no longer pending
- D0140 rows: `0 / 0 / 0`
- RU-4B governed inventory rows: all `0`
- monetization: `FREE / 0 RSD`

## RU-4B activation blockers

1. governed account-block authority is not complete;
2. owner-approved numeric `PRESELECTION_QA` rate policy is not defined;
3. reviewed/current `PRESELECTION_QA` production ALLOW is not activated;
4. trusted materiality authority is not production-activated.

These blockers do not block RU-5 foundation/integrity work and do not authorize RU-4B activation.

## Exact next cursor

`RU-5 / P0C-02 — ATOMIC APPLICATION SUBMIT — FRESH READ-ONLY PHYSICAL PREFLIGHT`
