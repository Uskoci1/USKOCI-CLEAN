# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-03 20:22 Europe/Belgrade
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`
- Live production migrations: `57`
- Live production migration head: `20260903160812_clean_ru0_authority_closure`
- Live Edge Function: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged
- Canonical HEAD before RU-1 source promotion: `1846fcbaaf50ef76b7e9686ff1f5d6cbd222ee83`

## RU-0 — Authority Closure

State: `CLOSED`

Network intent:

`authenticated client -> narrow RPC/read projection -> RLS/grants -> server authority -> canonical reread`

Staged source:
- source commit: `ec8c5396d6aaa009f2979143bd41d311f5feaef0`
- source migration: `supabase/migrations/20260903130355_clean_ru0_authority_closure.sql`
- source raw MD5: `23a60f86bdb952f1dbf62990f2f800cc`

Live Supabase recording:
- live version: `20260903160812`
- live name: `clean_ru0_authority_closure`

RU-0 is closed and must not be reapplied.

## RU-1 — Worker Readiness

State: `SOURCE_STAGED_RUNTIME_PROVEN`

Live applied: `NO`

Network intent:

`auth user creation -> REQUESTER ACTIVE + WORKER DRAFT -> owner edits Worker profile under RLS -> rpc_complete_worker_profile -> server readiness validation -> tokenized DRAFT-to-ACTIVE -> canonical reread`

Exact staged source:
- source migration commit: `5e586c63783b7743687224e3cc670e7ed52e4e48`
- migration: `supabase/migrations/20260903165700_clean_ru1_worker_readiness.sql`
- raw bytes: `13591`
- raw MD5: `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256: `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`
- predecessor live state: `57 / 20260903160812`
- provenance: `PENDING_FORWARD_MIGRATION`, `live_applied=false`

RU-1 authority effects when applied:
1. New REQUESTER profile -> server-derived `ACTIVE`.
2. New WORKER profile -> server-derived `DRAFT`.
3. Direct client WORKER `DRAFT -> ACTIVE` -> denied.
4. Profile identity (`account_id`, `kind`) -> immutable.
5. Owner completion command -> `rpc_complete_worker_profile(uuid)`.
6. Completion validates owner, WORKER kind, DRAFT state, display name, city and at least one skill.
7. RPC sets a narrow local mutation token only for the intended `DRAFT -> ACTIVE` transition.
8. Already ACTIVE Worker replay -> idempotent success/no rewrite.
9. Authenticated direct profile DELETE -> denied by table privileges.
10. Existing profiles remain byte/row-state preserved by migration postconditions; no historical ACTIVE Worker downgrade.

### Fail-closed correction caught by proof

An earlier candidate used nullable boolean logic around the mutation token. With a NULL token, PostgreSQL could evaluate the denial predicate to NULL rather than TRUE. Disposable runtime proof caught this before production. The final candidate uses explicit `IS DISTINCT FROM` checks, so absent/wrong tokens fail closed.

## RU-1 proof

Disposable proof branch:
- `proof/ru1-disposable-ci-20260903`
- full-proof source head: `339e08017e56ac01c5cbfa8e91e89db8233e97d8`
- GitHub Actions run: `33790306570`
- result: `PASS`

Proved:
- predecessor fixture PASS;
- candidate DB apply PASS;
- owner auth context PASS;
- direct status activation denied;
- profile kind mutation denied;
- owner-only activation RPC PASS;
- replay/idempotency PASS;
- missing-skill denial PASS;
- forced ACTIVE insert derives DRAFT;
- attacker victim-update attempt affects zero rows;
- authenticated profile DELETE denied;
- historical ACTIVE Worker preserved;
- zero residue PASS;
- source checks PASS.

Durable proof artifacts:
- `supabase/proofs/ru1_targeted_predecessor_fixture.sql`
- `supabase/proofs/ru1_worker_readiness_runtime_proof.sql`

Exact checksum proof:
- GitHub Actions run `33790742908`
- bytes `13591`
- MD5 `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256 `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`

Promotion metadata proof:
- promotion branch `promotion/ru1-worker-readiness-20260903`
- migration-integrity run `33791044226` PASS
- `MIGRATION_PROVENANCE.json` records exactly one pending forward migration
- live history remains 57 and unchanged

## Current state

| Layer | State |
|---|---|
| Edge source reconciliation | DONE |
| RU-0 overall | CLOSED |
| RU-1 source design | DONE |
| RU-1 exact source bytes | STAGED |
| RU-1 migration integrity | PASS |
| RU-1 disposable DB apply | PASS |
| RU-1 owner/attacker/replay runtime proof | PASS |
| RU-1 zero-residue proof | PASS |
| RU-1 source promotion | IN_PROGRESS |
| Production Supabase RU-1 apply | NOT_APPLIED |
| Production current state | `57 / 20260903160812` |

## Next allowed action

1. Compare clean RU-1 promotion branch against canonical and confirm only intended source/proof/tracking files remain.
2. Verify migration integrity on final promotion contents.
3. Fast-forward canonical source branch only; do not change live Supabase yet.
4. Fresh read-only verify canonical GitHub and live Supabase still `57 / 20260903160812`.
5. Obtain explicit owner approval before the single live RU-1 migration apply.
6. After live apply, prove structural/read-only postconditions, reconcile any Supabase-assigned live version, and update all tracking.

## DO NOT REDO / DO NOT TOUCH

- DO NOT REAPPLY RU-0.
- Do not redo RU-1 disposable proof unless source bytes change.
- Do not redo Edge reconciliation.
- Do not redeploy Edge for RU-1.
- Do not merge/cherry-pick/apply `repair/ru0-ru1-backend-20260902`.
- Do not copy donor 184 migrations as a stack.
- Do not expose provider/service secrets.

Principle: **AI agent is replaceable. Canonical project state is not.**
