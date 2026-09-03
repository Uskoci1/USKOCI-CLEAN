# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-03 18:19 Europe/Belgrade
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`
- Live production migrations: `57`
- Live production migration head: `20260903160812_clean_ru0_authority_closure`
- Live Edge Function: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged by RU-0

## RU-0 — Authority Closure

State: `CLOSED`

Network intent:

`authenticated client -> narrow RPC/read projection -> RLS/grants -> server authority -> canonical reread`

Staged source:

- source commit: `ec8c5396d6aaa009f2979143bd41d311f5feaef0`
- source migration: `supabase/migrations/20260903130355_clean_ru0_authority_closure.sql`
- source raw MD5: `23a60f86bdb952f1dbf62990f2f800cc`
- SECURITY DEFINER manifest: `supabase/RU0_SECURITY_DEFINER_EXECUTION_MANIFEST.csv`
- static proof: `supabase/proofs/check_ru0_static.py`
- runtime proof: `supabase/proofs/ru0_authority_closure_runtime_proof.sql`

Live Supabase recording:

- live version: `20260903160812`
- live name: `clean_ru0_authority_closure`
- recorded statement count: `1`
- recorded statement MD5: `4c0d630d93f8fdfc6e683dcfd8a9895a`
- recorded statement chars: `21495`
- exact raw-byte identity with staged source: `false`
- explicit staged→live version alias is recorded in `MIGRATION_PROVENANCE.json` and `docs/implementation/LIVE_MIGRATION_STATE.json`

RU-0 live effects:

1. authenticated `ai_conversations`: own SELECT only; mutation server-owned.
2. authenticated `ai_action_proposals`: own SELECT only; mutation server-owned.
3. authenticated `notification_deliveries`: own SELECT only; mutation server-owned.
4. raw owner `needs` UPDATE restricted to `DRAFT`.
5. legacy `rpc_ai_propose_fact` retired fail-closed.
6. legacy `rpc_publish_need` retired fail-closed.
7. legacy unilateral `rpc_propose_agreement_change` retired fail-closed.
8. SECURITY DEFINER execution allowlist enforced.
9. service-owned AI writer preserved.
10. Agreement v2 propose/respond preserved.

## Proof

Disposable runtime proof:
- branch `proof/ru0-disposable-ci-20260903`
- head `6496065940dea7310152cdae23d3766a617398e7`
- GitHub Actions run `33769629283`
- owner/attacker/service: PASS
- zero residue: PASS

Fresh production post-apply proof:
- migration state `57/20260903160812`
- public SECURITY DEFINER `32`
- private SECURITY DEFINER `23`
- authenticated public SECURITY DEFINER allowlist `25`
- private API-executable SECURITY DEFINER `0`
- retired legacy RPC exposure `0`
- service AI writer service-role EXECUTE `true`
- service AI writer authenticated EXECUTE `false`
- Agreement v2 propose/respond authenticated EXECUTE `true/true`
- forbidden mutation policies on AI conversations/proposals/deliveries `0`
- DRAFT-only raw Need UPDATE policy present
- checked business row counts unchanged `15 / 2 / 82 / 6 / 0 / 2 / 2`
- Edge ACTIVE v4 / JWT verification ON / unchanged

Production `execute_sql` is connector-enforced read-only, so the rollback-only fixture cannot be repeated live. Runtime behavior was proven before promotion in disposable Supabase/Postgres. The live migration itself committed only after embedded predecessor and postcondition assertions passed.

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` is normalized to current live state:
- live snapshot count `57`
- live last `20260903160812_clean_ru0_authority_closure`
- pending forward migrations `0`
- physical canonical source file remains `20260903130355_clean_ru0_authority_closure.sql`
- explicit live alias maps `20260903160812` to source version `20260903130355`
- raw-byte identity is not claimed
- integrity checker supports an explicit `file` alias for live history entries

## Current state

| Layer | State |
|---|---|
| Edge source reconciliation | DONE |
| RU-0 design | DONE |
| RU-0 source | SOURCE_COMMITTED |
| Static proof | PASS |
| Disposable DB apply | PASS |
| Owner/attacker/service runtime proof | PASS |
| Zero-residue proof | PASS |
| Production Supabase apply | APPLIED |
| Production structural/read-only proof | PASS |
| Production business-row preservation | PASS |
| Migration provenance | RECONCILED |
| RU-0 overall | CLOSED |
| RU-1 | READY_NOT_STARTED |

## Next allowed action

1. Fresh read-only GitHub + live Supabase preflight against this checkpoint.
2. Read governing master dependency order for RU-1; do not infer RU-1 from quarantine/history.
3. If physical state matches, begin RU-1 exactly in dependency order.
4. Proof before live promotion; update LIVE network, ledger, migration state and handoff after the unit.

## DO NOT REDO / DO NOT TOUCH

- DO NOT REAPPLY RU-0.
- Do not redo Edge reconciliation.
- Do not redeploy Edge v4 for RU-0.
- Do not merge/cherry-pick/apply `repair/ru0-ru1-backend-20260902`.
- Do not copy donor 184 migrations as a stack.
- Do not expose provider/service secrets.

Principle: **AI agent is replaceable. Canonical project state is not.**
