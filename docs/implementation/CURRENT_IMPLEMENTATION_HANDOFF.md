# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint time: 2026-09-03 17:42 Europe/Belgrade

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- RU-0 source baseline commit: `ec8c5396d6aaa009f2979143bd41d311f5feaef0`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration count/head at checkpoint: `56 / 20260901114029_clean_ai_fact_supersession_and_human_correction`

## Last fully completed unit

Edge source reconciliation is complete and must not be redone.
Canonical reconciliation commit: `25808ac2c0cb78450168e35548c6fc8d36a2ac05`.
No Edge redeploy was needed because deployed v4 already matched the target source semantics.

## Current partial unit

`RU-0 — Authority Closure`

State: `PROOF_PASS_LIVE_PENDING`

Source commit:
`ec8c5396d6aaa009f2979143bd41d311f5feaef0`

Primary migration:
`supabase/migrations/20260903130355_clean_ru0_authority_closure.sql`

Primary intended effects:
- own-read only for authenticated `ai_conversations` and `ai_action_proposals`
- own-read only for authenticated `notification_deliveries`
- raw owner `needs` UPDATE restricted to DRAFT
- retire legacy `rpc_ai_propose_fact`
- retire legacy `rpc_publish_need`
- retire unilateral legacy `rpc_propose_agreement_change`
- enforce SECURITY DEFINER execution manifest
- preserve service AI writer
- preserve Agreement v2 propose/respond
- no business-row rewrite

## Runtime proof already completed

Disposable proof branch:
`proof/ru0-disposable-ci-20260903`

Proof head:
`6496065940dea7310152cdae23d3766a617398e7`

GitHub Actions run:
`33769629283`

Result: `PASS`

Proof demonstrated:
- migration applied successfully to isolated Supabase/Postgres predecessor harness
- predecessor ledger `56/20260901114029`
- disposable post-apply ledger `57/20260903130355`
- owner/attacker/service rollback-only scenarios passed
- retired legacy RPC exposure = 0
- authenticated public SECURITY DEFINER allowlist count = 25
- private API-executable SECURITY DEFINER count = 0
- proof users after rollback = 0
- proof messages after rollback = 0
- disposable stack stopped cleanly

## Production state

RU-0 has NOT been applied to production.
Production is still at 56 migrations / head `20260901114029`.
Do not claim RU-0 CLOSED yet.

## Current blocker

The available connected migration deployment action may record a generated migration timestamp rather than the exact repository filename version `20260903130355`.
Do not create avoidable GitHub ↔ Supabase migration-head drift.

A $0 temporary Supabase project was considered for a deployment-mechanism test, but creation in the canonical organization was denied by connector permissions. No temporary project was created and no charge occurred.

## Next allowed unit

1. Fresh read-only production preflight.
2. Establish a migration apply/recording method that preserves a durable, reconcilable relation between repository migration `20260903130355_clean_ru0_authority_closure.sql` and live Supabase history.
3. Apply RU-0 only after that is resolved.
4. Run fresh post-apply read-only/live proof.
5. Update `LIVE_IMPLEMENTATION_NETWORK.md`, `IMPLEMENTATION_STATUS_LEDGER.csv`, and this handoff with the new canonical Git SHA and live migration head.
6. Mark RU-0 CLOSED only when production proof is PASS.
7. Then begin RU-1.

## DO NOT REDO / QUARANTINE

- Do not redo Edge reconciliation.
- Do not redeploy Edge as part of RU-0.
- `repair/ru0-ru1-backend-20260902` remains QUARANTINE: no merge, cherry-pick or apply.
- Do not copy donor 184 migrations as a stack.
- Do not test unproven SQL first on production.
- Do not expose secrets in GitHub, source, logs or mobile bundle.

## Continuity rule

On every new agent/session:
`READ GOVERNING MASTER -> READ THIS HANDOFF -> READ LIVE NETWORK -> READ LEDGER -> FRESH READ-ONLY GITHUB/SUPABASE VERIFY -> COMPARE -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
