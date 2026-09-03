# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-03 17:42 Europe/Belgrade
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- RU-0 source baseline commit: `ec8c5396d6aaa009f2979143bd41d311f5feaef0`
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`
- Live production migrations: `56`
- Live production migration head: `20260901114029_clean_ai_fact_supersession_and_human_correction`
- Live Edge Function: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`

## RU-0 — Authority Closure

Network intent:

`authenticated client -> narrow RPC/read projection -> RLS/grants -> server authority -> canonical reread`

RU-0 source:

- Migration: `supabase/migrations/20260903130355_clean_ru0_authority_closure.sql`
- SECURITY DEFINER manifest: `supabase/proofs/RU0_SECURITY_DEFINER_EXECUTION_MANIFEST.csv`
- Static proof: `supabase/proofs/check_ru0_static.py`
- Runtime proof: `supabase/proofs/ru0_authority_closure_runtime_proof.sql`

RU-0 closes these predecessor mutation/authority gaps:

1. `ai_conversations`: authenticated becomes own-SELECT only; mutation server-owned.
2. `ai_action_proposals`: authenticated becomes own-SELECT only; mutation server-owned.
3. `notification_deliveries`: authenticated becomes own-SELECT only; delivery mutation server-owned.
4. raw owner `needs` UPDATE is restricted to `DRAFT`.
5. legacy `rpc_ai_propose_fact` is retired fail-closed.
6. legacy `rpc_publish_need` is retired fail-closed.
7. legacy unilateral `rpc_propose_agreement_change` is retired fail-closed.
8. explicit SECURITY DEFINER execution manifest is enforced.
9. service-owned AI writer remains preserved.
10. Agreement v2 propose/respond remains preserved.

## Disposable runtime proof

- Proof branch: `proof/ru0-disposable-ci-20260903`
- Proof head: `6496065940dea7310152cdae23d3766a617398e7`
- GitHub Actions run: `33769629283`
- Result: `PASS`

Observed proof assertions:

- static contract: PASS
- predecessor state: `56/20260901114029`
- exact pending RU-0 migration applied in isolated Supabase/Postgres
- post-migration state in disposable DB: `57/20260903130355`
- owner / attacker / service rollback-only proof: PASS
- `proof_users_after_rollback=0`
- `proof_messages_after_rollback=0`
- `retired_rpc_exposure=0`
- `authenticated_public_sd=25`
- `private_api_executable_sd=0`
- disposable Supabase stack stopped after proof

## Current state

| Layer | State |
|---|---|
| RU-0 design | DONE |
| RU-0 source | SOURCE_COMMITTED |
| Static proof | PASS |
| Disposable DB apply | PASS |
| Owner/attacker/service runtime proof | PASS |
| Zero-residue proof | PASS |
| Production Supabase apply | NOT APPLIED |
| Production runtime proof | NOT RUN |
| RU-0 overall | IN PROGRESS — LIVE PROMOTION PENDING |
| RU-1 | NOT STARTED |

## Current blocker / reconciliation item

The connected `apply_migration` deployment mechanism may generate its own migration version instead of preserving the repository filename version `20260903130355`. Production promotion must not create GitHub ↔ Supabase migration-head divergence.

A separate $0 temporary Supabase project was proposed only to test that deployment mechanism. Creation in the canonical organization was not permitted by the available connector permissions; no project was created and no charge occurred.

## Next allowed action

1. Fresh read-only preflight production immediately before promotion.
2. Resolve an exact, durable migration-version recording strategy so repository and live Supabase remain reconcilable.
3. Apply only the already-proven RU-0 authority closure to production.
4. Fresh post-apply read-only proof: migration head/count, RLS/grants, legacy RPC retirement, preserved narrow RPCs, business-row preservation, Edge unchanged.
5. Update this file, ledger and current handoff.
6. Mark `RU-0 = CLOSED` only after live proof PASS.
7. Only then proceed to RU-1.

## DO NOT REDO / DO NOT TOUCH

- Do not redo the already-completed Edge prompt-copy reconciliation.
- Do not redeploy Edge v4 for RU-0.
- Do not merge/cherry-pick/apply `repair/ru0-ru1-backend-20260902`.
- Do not treat disposable proof as production apply.
- Do not mark RU-0 DONE while production remains on 56 migrations.
- Do not expose provider/service secrets.

Principle: **AI agent is replaceable. Canonical project state is not.**
