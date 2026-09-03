# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint time: 2026-09-03 23:20 Europe/Belgrade

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration count/head: `58 / 20260903184545_clean_ru1_worker_readiness`
- Production Edge: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`
- RU-0: `CLOSED` — do not reapply
- RU-1: `CLOSED` — do not reapply

## Current unit

`RU-2 — Need V2 + R02/R07 canonical DRAFT`

State: `LIVE_PENDING`

No RU-2 production migration has been applied and Edge v5 has not been deployed at this checkpoint.

## RU-2 proven source

Exact combined proof head:
`d7eb80b3403e5549a78cec18b1c8c87f42d9cf99`

Pending physical migrations:
- `supabase/migrations/20260903190000_clean_ru2_need_v2_draft.sql`
  - raw MD5 `f95fadda53d8d803faac4498d860c31b`
- `supabase/migrations/20260903190100_clean_ru2_ai_fact_transition_guard.sql`
  - raw MD5 `95145c601b6366f1a98e8566b3307515`

Raw hashes were calculated by GitHub Actions run `33807334733` from the exact proof bytes.

## RU-2 combined proof

Proof branch: `proof/ru2-need-v2-r07-20260903`
Proof head: `d7eb80b3403e5549a78cec18b1c8c87f42d9cf99`
Combined run: `33806989549` — PASS.

The single run proved:
- real predecessor reconstruction `56 -> RU-0 57 -> RU-1 58`;
- exact RU-2 core apply to disposable `59/20260903190000`;
- exact RU-2 guard apply to disposable `60/20260903190100`;
- static authority/grant invariants;
- owner / attacker / service behavior;
- typed human correction;
- R07 Human Review;
- missing-required DRAFT denial;
- idempotent canonical DRAFT materialization;
- legacy/V2 coexistence;
- public coarse vs private exact geography;
- repeated V2 same-key service supersession with one-live-fact invariant;
- service cannot bind a fact to a Need outside the Human Review materializer;
- rollback / zero residue;
- RN TypeScript PASS;
- Deno Edge module check PASS;
- Jest `40/40` PASS;
- R02/R07 source contains no legacy direct-publish path.

Earlier source-only run `33806867873` also passed TypeScript, Deno, Jest and static R02/R07 contract on the same implementation family.

## Critical RU-2 bugs caught before production

1. The first R07 materializer attempted to bind `subject_need_id`, while the existing AI fact guard correctly treated that field as immutable. Runtime proof caught the conflict. The fix is a narrow forward guard contract; the guard was not disabled.
2. The first Edge v5 prompt used schedule/price enum names that did not match PostgreSQL authority. Before promotion, Edge was aligned to the exact DB values (`FASTEST/MY_PRICE/OFFERS` and the six canonical schedule kinds) and Deno/source proofs passed.

Neither faulty candidate reached production.

## RU-2 product/runtime contract

New path:
`R02 AI conversation -> R07 Human Review -> rpc_save_need_draft_from_review -> canonical Need DRAFT`

There is no direct publish from R02 or R07.

V2 fact registry has 20 typed fields, including public task geography and separate private exact address/access notes. AI proposals remain proposals; users confirm or correct before canonical save.

New Edge source is dual-mode:
- existing `LEGACY_TEXT_V1` conversations keep legacy writer compatibility;
- new `NEED_FACT_V2` conversations use the typed service writer;
- Gemini remains preferred when configured, OpenAI fallback remains server-side;
- no provider/service secret is placed in Expo/source/mobile bundle.

R02 source: `src/app/(app)/nova.tsx`
R07 source: `src/app/(app)/pregled-nacrta.tsx`
Typed adapter: `src/data/aiNeedV2Production.ts`
Shared registry: `src/contracts/needFactsV2.ts`

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` remains normalized to the actual live production state `58 / 20260903184545` and records two RU-2 migrations as pending forward candidates only.

`supabase/migrations/MD5_MANIFEST.txt` contains both raw source hashes.

Do not invent live versions for RU-2. Connected Supabase apply may assign different live timestamps; if so, capture explicit source->live aliases exactly as done for RU-0/RU-1.

## Next allowed action

1. Run migration integrity + TypeScript/tests on the exact promotion-staging head.
2. If green, promote that exact source state to `clean-alpha-backend` and mark source committed / live pending.
3. Immediately perform fresh read-only GitHub + live Supabase preflight.
4. Required live predecessor: exactly `58 / 20260903184545_clean_ru1_worker_readiness`; Edge must still be v4.
5. If any drift exists: STOP writes and reconcile actual state first.
6. If clean: apply RU-2 core, verify; apply RU-2 guard, verify; capture actual live timestamps/statements/provenance.
7. Only after DB V2 authority exists live, deploy Edge v5.
8. Fresh live structural/authority readback; update all durable tracking and provenance; then close RU-2.

## DO NOT REDO / QUARANTINE

- DO NOT REAPPLY RU-0 or RU-1.
- Do not deploy Edge v5 before RU-2 DB authority exists live.
- Do not use `repair/ru0-ru1-backend-20260902`.
- Do not copy donor 184 migrations as a stack.
- Do not expose secrets.
- Do not claim RU-2 live until production readback proves it.

Continuity rule:
`READ GOVERNING MASTER -> READ THIS HANDOFF -> READ LIVE NETWORK -> READ LEDGER -> READ LIVE_MIGRATION_STATE -> FRESH READ-ONLY GITHUB/SUPABASE VERIFY -> COMPARE -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
