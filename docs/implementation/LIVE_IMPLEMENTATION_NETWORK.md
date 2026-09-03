# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-03 18:12 Europe/Belgrade
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- RU-0 source commit: `ec8c5396d6aaa009f2979143bd41d311f5feaef0`
- Pre-closure tracking parent: `a96cf9a198fe732aa5ab0d2e01507f79238c1361`
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`
- Live production migrations: `57`
- Live production migration head: `20260903160812_clean_ru0_authority_closure`
- Live Edge Function: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged by RU-0

## RU-0 — Authority Closure

Network intent:

`authenticated client -> narrow RPC/read projection -> RLS/grants -> server authority -> canonical reread`

Staged source:

- Source migration committed before production promotion: `supabase/migrations/20260903130355_clean_ru0_authority_closure.sql`
- Staged source raw MD5: `23a60f86bdb952f1dbf62990f2f800cc`
- SECURITY DEFINER manifest: `supabase/RU0_SECURITY_DEFINER_EXECUTION_MANIFEST.csv`
- Static proof: `supabase/proofs/check_ru0_static.py`
- Runtime proof: `supabase/proofs/ru0_authority_closure_runtime_proof.sql`

Live promotion recording:

- Supabase-assigned live version: `20260903160812`
- Live migration name: `clean_ru0_authority_closure`
- Live migration statement count: `1`
- Live recorded statement MD5: `4c0d630d93f8fdfc6e683dcfd8a9895a`
- Live recorded statement chars: `21495`
- Raw-byte identity with the staged source file is NOT claimed because the connected deployment payload omitted non-executable section comments and Supabase assigned the live timestamp. The executable RU-0 authority contract was preserved.
- Durable version mapping: `docs/implementation/LIVE_MIGRATION_STATE.json`

RU-0 closes these predecessor mutation/authority gaps:

1. `ai_conversations`: authenticated is own-SELECT only; mutation server-owned.
2. `ai_action_proposals`: authenticated is own-SELECT only; mutation server-owned.
3. `notification_deliveries`: authenticated is own-SELECT only; delivery mutation server-owned.
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

Observed disposable proof assertions:

- static contract: PASS
- predecessor state: `56/20260901114029`
- RU-0 migration applied in isolated Supabase/Postgres
- owner / attacker / service rollback-only proof: PASS
- `proof_users_after_rollback=0`
- `proof_messages_after_rollback=0`
- `retired_rpc_exposure=0`
- `authenticated_public_sd=25`
- `private_api_executable_sd=0`
- disposable Supabase stack stopped after proof

## Fresh production preflight and live proof

Pre-apply production read:

- migration state: `56/20260901114029`
- public SECURITY DEFINER: `35`
- private SECURITY DEFINER: `23`
- broad predecessor policies present as expected
- business rows before apply: AI conversations `15`, AI proposals `2`, AI facts `82`, Needs `6`, deliveries `0`, Agreements `2`, Agreement versions `2`

Post-apply production read:

- migration state: `57/20260903160812_clean_ru0_authority_closure`
- public SECURITY DEFINER: `32`
- private SECURITY DEFINER: `23`
- authenticated public SECURITY DEFINER allowlist: `25`
- private API-executable SECURITY DEFINER: `0`
- retired legacy RPC exposure: `0`
- service AI writer executable by service role: `true`
- service AI writer exposed to authenticated: `false`
- Agreement v2 propose executable: `true`
- Agreement v2 respond executable: `true`
- forbidden non-SELECT policies on AI conversations/proposals/deliveries: `0`
- DRAFT-only raw owner Need UPDATE policy present: `true`
- checked business row counts unchanged: `15 / 2 / 82 / 6 / 0 / 2 / 2`
- Edge Function remains ACTIVE v4 with JWT verification enabled

The connected production `execute_sql` path is enforced read-only, so the already-proven rollback-only owner/attacker/service fixture could not be repeated against production because even fixture INSERT is rejected by the connector. This is not a RU-0 failure. Runtime behavior was proven in disposable Supabase/Postgres before promotion, and the production migration itself committed only after its embedded predecessor and postcondition assertions passed.

## Current state

| Layer | State |
|---|---|
| RU-0 design | DONE |
| RU-0 source | SOURCE_COMMITTED |
| Static proof | PASS |
| Disposable DB apply | PASS |
| Owner/attacker/service runtime proof | PASS |
| Zero-residue proof | PASS |
| Production Supabase apply | APPLIED |
| Production structural/read-only proof | PASS |
| Production business-row preservation | PASS |
| RU-0 overall | CLOSED |
| RU-1 | NOT STARTED |

## Migration provenance note

`supabase/migrations/MIGRATION_PROVENANCE.json` was generated before RU-0 live promotion and still contains the pre-live pending snapshot. For RU-0 current/live truth, this LIVE network, `CURRENT_IMPLEMENTATION_HANDOFF.md`, `IMPLEMENTATION_STATUS_LEDGER.csv`, and `LIVE_MIGRATION_STATE.json` supersede that stale pending status. Before creating the next forward migration, normalize the historical provenance file to the new 57-migration live snapshot without changing production.

## Next allowed action

1. Normalize repository migration provenance metadata to the live `57 / 20260903160812` state; metadata-only, no database change.
2. Fresh read-only preflight after that Git commit.
3. Read governing dependency order and begin RU-1 only from that verified state.
4. Continue updating LIVE network, ledger and handoff after every unit.

## DO NOT REDO / DO NOT TOUCH

- Do not reapply RU-0.
- Do not redo the already-completed Edge prompt-copy reconciliation.
- Do not redeploy Edge v4 for RU-0.
- Do not merge/cherry-pick/apply `repair/ru0-ru1-backend-20260902`.
- Do not copy donor 184 migrations as a stack.
- Do not expose provider/service secrets.

Principle: **AI agent is replaceable. Canonical project state is not.**
