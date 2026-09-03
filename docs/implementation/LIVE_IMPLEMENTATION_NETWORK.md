# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-03 20:22 Europe/Belgrade
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`
- Live production migrations: `57`
- Live production migration head: `20260903160812_clean_ru0_authority_closure`
- Live Edge Function: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged by RU-0/RU-1 source work
- Canonical HEAD before RU-1 source promotion: `1846fcbaaf50ef76b7e9686ff1f5d6cbd222ee83`

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

## RU-0 proof

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

## RU-1 — Worker Readiness

State: `SOURCE_STAGED_RUNTIME_PROVEN`

Production applied: `NO`

Network intent:

`auth user creation -> REQUESTER ACTIVE + WORKER DRAFT -> owner edits Worker under RLS -> rpc_complete_worker_profile -> server readiness checks -> narrow tokenized DRAFT-to-ACTIVE -> canonical reread`

Exact staged source:

- source migration commit: `5e586c63783b7743687224e3cc670e7ed52e4e48`
- source migration: `supabase/migrations/20260903165700_clean_ru1_worker_readiness.sql`
- source raw bytes: `13591`
- source raw MD5: `f80e2e721365ee07316a9c0e84ab593f`
- source SHA-256: `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`
- predecessor live state: `57 / 20260903160812`
- provenance classification: `PENDING_FORWARD_MIGRATION`
- `live_applied=false`

RU-1 staged effects when eventually applied:

1. New REQUESTER profiles derive `ACTIVE`.
2. New WORKER profiles derive `DRAFT`.
3. `app_profiles.profile_status` default becomes `DRAFT`.
4. Direct client WORKER `DRAFT -> ACTIVE` is denied.
5. `account_id` and `kind` are immutable profile identity.
6. Owner completion command is `rpc_complete_worker_profile(uuid)`.
7. Completion validates owner, WORKER kind, DRAFT state, display name, city and at least one skill.
8. RPC grants one narrow local `uskoci.profile_mutation=COMPLETE_WORKER_PROFILE` authority for the intended transition.
9. Already ACTIVE Worker replay is idempotent.
10. Authenticated direct DELETE on `app_profiles` is denied by table privileges.
11. Existing profile rows are preserved; historical ACTIVE Workers are not mass-downgraded.

### Fail-closed correction caught before production

An earlier RU-1 candidate used nullable boolean logic around the mutation token. With a NULL token, PostgreSQL could produce a NULL denial predicate instead of TRUE. Disposable proof caught this before production. The final proven guard uses explicit `IS DISTINCT FROM` checks, so absent/wrong tokens fail closed.

## RU-1 proof

Disposable runtime proof:
- branch `proof/ru1-disposable-ci-20260903`
- full-proof source head `339e08017e56ac01c5cbfa8e91e89db8233e97d8`
- GitHub Actions run `33790306570`
- candidate DB apply PASS
- owner auth context PASS
- direct status activation denial PASS
- profile identity mutation denial PASS
- owner-only completion RPC PASS
- replay/idempotency PASS
- missing-skill denial PASS
- forced ACTIVE insert -> DRAFT PASS
- attacker victim UPDATE -> zero rows PASS
- authenticated profile DELETE denial PASS
- historical ACTIVE Worker preservation PASS
- zero residue PASS
- source checks PASS

Durable proof artifacts:
- `supabase/proofs/ru1_targeted_predecessor_fixture.sql`
- `supabase/proofs/ru1_worker_readiness_runtime_proof.sql`

Exact checksum proof:
- GitHub Actions run `33790742908`
- bytes `13591`
- MD5 `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256 `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`

Promotion integrity proof:
- branch `promotion/ru1-worker-readiness-20260903`
- GitHub Actions run `33791044226`
- existing migration-integrity checker PASS
- live snapshot remains `57`
- pending forward migrations becomes `1` (RU-1 only)

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` remains normalized to current live state:
- live snapshot count `57`
- live last `20260903160812_clean_ru0_authority_closure`
- physical canonical RU-0 source remains `20260903130355_clean_ru0_authority_closure.sql`
- explicit live alias maps `20260903160812` to source version `20260903130355`
- raw-byte identity for RU-0 is not claimed
- RU-1 is recorded only as `PENDING_FORWARD_MIGRATION`
- RU-1 `live_applied=false`
- pending forward migrations `1`

## Current state

| Layer | State |
|---|---|
| Edge source reconciliation | DONE |
| RU-0 design | DONE |
| RU-0 source | SOURCE_COMMITTED |
| RU-0 static proof | PASS |
| RU-0 disposable DB apply | PASS |
| RU-0 owner/attacker/service runtime proof | PASS |
| RU-0 zero-residue proof | PASS |
| RU-0 production apply | APPLIED |
| RU-0 production structural/read-only proof | PASS |
| RU-0 production business-row preservation | PASS |
| RU-0 migration provenance | RECONCILED |
| RU-0 overall | CLOSED |
| RU-1 source | STAGED |
| RU-1 disposable DB apply | PASS |
| RU-1 owner/attacker/replay runtime proof | PASS |
| RU-1 zero-residue proof | PASS |
| RU-1 migration integrity | PASS |
| RU-1 canonical source promotion | IN_PROGRESS |
| RU-1 production apply | NOT_APPLIED |
| Production current migration state | `57 / 20260903160812` |

## Next allowed action

1. Finish final clean diff/integrity audit of `promotion/ru1-worker-readiness-20260903`.
2. Fast-forward only canonical Git source to the final clean promotion head; do not change live Supabase yet.
3. Fresh read-only GitHub + live Supabase verification after source promotion.
4. Confirm live remains `57 / 20260903160812` and RU-1 remains pending.
5. Obtain explicit owner approval before applying the single RU-1 production migration.
6. If approved, apply exact proven RU-1 bytes, perform fresh live structural/read-only proof, reconcile any live-assigned migration version and update all tracking.

## DO NOT REDO / DO NOT TOUCH

- DO NOT REAPPLY RU-0.
- Do not redo RU-1 disposable proof unless RU-1 source bytes change.
- Do not redo Edge reconciliation.
- Do not redeploy Edge v4 for RU-1.
- Do not merge/cherry-pick/apply `repair/ru0-ru1-backend-20260902`.
- Do not copy donor 184 migrations as a stack.
- Do not expose provider/service secrets.

Principle: **AI agent is replaceable. Canonical project state is not.**
