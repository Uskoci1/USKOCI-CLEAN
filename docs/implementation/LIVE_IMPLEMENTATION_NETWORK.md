# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-03 23:20 Europe/Belgrade
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`
- Live production migrations: `58`
- Live production head: `20260903184545_clean_ru1_worker_readiness`
- Live Edge: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`

RU-0 and RU-1 are CLOSED. Do not reapply them.

## RU-2 — Need V2 + R02/R07 canonical DRAFT

State: `LIVE_PENDING`

Exact proven implementation head:
`d7eb80b3403e5549a78cec18b1c8c87f42d9cf99`

Network intent:
`authenticated R02 -> V2 conversation -> Edge server provider -> service-only typed proposal writer -> user R07 confirm/correct -> server Human Review -> idempotent canonical Need DRAFT -> R04; publish/admission remains a later authority boundary`

### Pending DB sources

1. `20260903190000_clean_ru2_need_v2_draft.sql`
   - MD5 `f95fadda53d8d803faac4498d860c31b`
   - creates/extends typed V2 registry and Human Review/DRAFT authority while preserving legacy data and flows.
2. `20260903190100_clean_ru2_ai_fact_transition_guard.sql`
   - MD5 `95145c601b6366f1a98e8566b3307515`
   - narrows AI fact transitions and permits only the legitimate V2 supersession/confirmation/DRAFT-binding contracts; no broad ambient bypass.

Neither is live yet.

### V2 fact authority

The V2 registry contains 20 typed facts. Required-for-DRAFT facts include title, description, category, price mode, schedule kind, people needed and task geography. Conditional server checks cover MY_PRICE amount and FIXED_WINDOW timestamps.

Fact truth remains:
`AI proposal -> HUMAN_CONFIRMED/corrected -> CANONICAL_SAVED`

Public task geography and private exact address/access notes remain separate. REMOTE does not fabricate a physical location.

### Edge v5 target

Source: `supabase/functions/uskoci-ai-interview/index.ts`

Target behavior:
- `LEGACY_TEXT_V1` -> existing legacy writer;
- `NEED_FACT_V2` -> typed V2 service writer;
- caller JWT/RLS verifies ownership before provider work;
- service role only persists server output;
- Gemini preferred when configured, OpenAI fallback;
- secrets remain server-side;
- PostgreSQL remains final type/enum/range authority.

Live is still v4. Edge v5 must not deploy before the RU-2 DB functions exist live.

### RN path

- R02: `src/app/(app)/nova.tsx`
- R07: `src/app/(app)/pregled-nacrta.tsx`
- typed adapter: `src/data/aiNeedV2Production.ts`
- shared contract: `src/contracts/needFactsV2.ts`

R02 does not publish. R07 final action is `Sačuvajte DRAFT`; it calls `rpc_save_need_draft_from_review`. If a conversation is already bound to a DRAFT, R07 reopens that DRAFT instead of making another.

## RU-2 proof

Combined disposable proof run `33806989549`: PASS.

Same-head proof includes:
- predecessor reconstruction through live-equivalent RU-1 58;
- RU-2 core + guard apply;
- owner/attacker/service;
- typed correction;
- Human Review and missing-required denial;
- idempotent DRAFT save;
- legacy/V2 coexistence;
- geography privacy;
- repeated-key V2 service supersession;
- service cannot bypass Human Review to bind a Need;
- rollback/zero residue;
- TypeScript;
- Deno Edge check;
- Jest 40/40;
- R02/R07 draft-only static contract.

Source proof run `33806867873`: PASS.
Raw migration checksum run `33807334733`: PASS.

## Current state

| Layer | State |
|---|---|
| Edge source reconciliation | DONE |
| RU-0 | CLOSED |
| RU-1 | CLOSED |
| RU-2 DB source | PROVEN / LIVE_PENDING |
| RU-2 owner-attacker-service | PASS |
| RU-2 zero residue | PASS |
| RU-2 Edge v5 source | DENO_PROVEN / NOT_DEPLOYED |
| RU-2 R02 -> R07 source | TSC+JEST_PROVEN |
| RU-2 production apply | NOT_APPLIED |
| RU-2 live structural proof | PENDING |
| RU-2 provenance | LIVE_58 + TWO_PENDING_FORWARD |

## Next allowed action

Run promotion integrity on the exact staging source. If green, promote exact source to canonical and immediately fresh-read GitHub + Supabase. Live writes are allowed only if production is still exactly `58 / 20260903184545` and live Edge remains v4. Any mismatch stops writes and requires reconciliation.

## DO NOT REDO / DO NOT TOUCH

- Do not reapply RU-0/RU-1.
- Do not deploy Edge v5 before RU-2 DB authority.
- Do not use quarantine branch `repair/ru0-ru1-backend-20260902`.
- Do not copy donor migrations blindly.
- Do not expose provider/service secrets.

Principle: **AI agent is replaceable. Canonical project state is not.**
