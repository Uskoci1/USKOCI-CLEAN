# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint time: 2026-09-03 20:22 Europe/Belgrade

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration count/head: `57 / 20260903160812_clean_ru0_authority_closure`
- Edge: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged
- Canonical HEAD before RU-1 source promotion: `1846fcbaaf50ef76b7e9686ff1f5d6cbd222ee83`

## Last fully completed live unit

`RU-0 — Authority Closure`

State: `CLOSED`

Source commit:
`ec8c5396d6aaa009f2979143bd41d311f5feaef0`

Physical source migration:
`supabase/migrations/20260903130355_clean_ru0_authority_closure.sql`

Live Supabase version:
`20260903160812_clean_ru0_authority_closure`

Version mapping is intentional and durably recorded. The connected Supabase deployment action assigned the live version. Raw-byte identity between live recorded statement and staged source is not claimed because the deployment payload omitted non-executable section comments; the executable RU-0 contract was preserved and passed embedded live postconditions.

## RU-0 proof

Disposable runtime proof:
- branch `proof/ru0-disposable-ci-20260903`
- head `6496065940dea7310152cdae23d3766a617398e7`
- GitHub Actions run `33769629283`
- owner/attacker/service PASS
- zero residue PASS

Live post-apply proof:
- migration count/head `57 / 20260903160812`
- public SECURITY DEFINER `32`
- private SECURITY DEFINER `23`
- authenticated public SECURITY DEFINER allowlist `25`
- private API-executable SECURITY DEFINER `0`
- retired RPC exposure `0`
- service AI writer service-role EXECUTE `true`
- service AI writer authenticated EXECUTE `false`
- Agreement v2 propose/respond authenticated EXECUTE `true / true`
- forbidden mutation policies on AI conversations/proposals/deliveries `0`
- DRAFT-only owner raw Need UPDATE present
- checked business rows unchanged `15 / 2 / 82 / 6 / 0 / 2 / 2`
- Edge unchanged ACTIVE v4 / JWT on

Production `execute_sql` is connector-enforced read-only, so rollback-only fixture INSERTs cannot be repeated live. The runtime authority scenarios were already proven before promotion in disposable Supabase/Postgres. This limitation does not reopen RU-0.

## Current unit — RU-1 Worker Readiness

State: `SOURCE_STAGED_RUNTIME_PROVEN`

Production applied: `NO`

Exact staged source:
- source migration commit: `5e586c63783b7743687224e3cc670e7ed52e4e48`
- migration: `supabase/migrations/20260903165700_clean_ru1_worker_readiness.sql`
- raw bytes: `13591`
- MD5: `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256: `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`
- provenance classification: `PENDING_FORWARD_MIGRATION`
- predecessor live state: `57 / 20260903160812`

RU-1 contract:
1. Existing profile/business rows are never rewritten by the migration.
2. New REQUESTER profiles derive `ACTIVE`.
3. New WORKER profiles derive `DRAFT`.
4. `app_profiles.profile_status` default becomes `DRAFT`.
5. Profile identity fields `account_id` and `kind` become immutable through the guard.
6. Direct client status activation is blocked.
7. Only owner `rpc_complete_worker_profile(uuid)` may perform WORKER `DRAFT -> ACTIVE`.
8. Completion validates display name, city and at least one skill.
9. Completion is replay-idempotent for an already ACTIVE Worker.
10. Authenticated direct DELETE on `app_profiles` is removed; owner SELECT/INSERT/UPDATE remains RLS-governed.
11. Existing ACTIVE workers remain ACTIVE; there is no mass downgrade.

## RU-1 proof

Disposable proof branch:
`proof/ru1-disposable-ci-20260903`

Final full-proof source head:
`339e08017e56ac01c5cbfa8e91e89db8233e97d8`

GitHub Actions full proof run:
`33790306570`

Result: `PASS`

Proved:
- predecessor fixture `57 / 20260903160812`;
- exact RU-1 DB apply;
- owner auth context;
- direct `DRAFT -> ACTIVE` denial;
- profile kind mutation denial;
- owner-only RPC activation;
- replay/idempotency;
- missing-skill denial leaving Worker DRAFT;
- client INSERT attempting ACTIVE is server-derived back to DRAFT;
- attacker cannot update victim Worker;
- direct authenticated profile DELETE denied;
- historical ACTIVE Worker preserved;
- zero proof residue;
- source checks PASS.

Durable rollback-only proof files:
- `supabase/proofs/ru1_targeted_predecessor_fixture.sql`
- `supabase/proofs/ru1_worker_readiness_runtime_proof.sql`

Exact checksum proof:
- GitHub Actions run `33790742908`
- bytes `13591`
- MD5 `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256 `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`

Promotion-integrity proof:
- branch `promotion/ru1-worker-readiness-20260903`
- GitHub Actions run `33791044226`
- migration-integrity PASS with live snapshot 57 + one pending RU-1 forward migration

### Important bug caught before production

Disposable proof found a real nullable-SQL authorization bug in an earlier candidate. A predicate using `NOT(token = ...)` could evaluate to SQL `NULL` when the token was absent, which is not the same as `TRUE` denial. The final proven guard uses explicit `IS DISTINCT FROM` checks, so absent or wrong tokens fail closed. Production was never exposed to the faulty candidate.

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` remains based on the 57-migration live state and records RU-1 only as a pending forward migration with `live_applied=false`.

`supabase/migrations/MD5_MANIFEST.txt` contains the exact RU-1 raw MD5. Existing migration-integrity checks passed after the RU-1 pending registration.

`docs/implementation/LIVE_MIGRATION_STATE.json` remains the compact machine-readable physical checkpoint and now carries a separate RU-1 staged/proven block without changing the live 57-migration head.

## Current status

- Edge source reconciliation: DONE — DO NOT REDO
- RU-0: CLOSED — DO NOT REAPPLY
- RU-1 source: STAGED
- RU-1 disposable DB apply: PASS
- RU-1 owner/attacker/replay runtime proof: PASS
- RU-1 zero-residue proof: PASS
- RU-1 production apply: NO
- Production state: still `57 / 20260903160812`

## Next allowed unit

1. Finish clean source promotion from `promotion/ru1-worker-readiness-20260903` to canonical `clean-alpha-backend` only after final diff/integrity verification.
2. Fresh read-only verify canonical GitHub HEAD and live Supabase still `57 / 20260903160812`.
3. STOP at the live boundary and obtain explicit owner approval before applying RU-1 to production.
4. If approved, apply exactly the proven RU-1 migration content, then fresh live structural/read-only proof.
5. Reconcile the live-assigned migration version if Supabase assigns a different timestamp, then update handoff/network/ledger/migration-state.

## DO NOT REDO / QUARANTINE

- DO NOT REAPPLY RU-0.
- Do not redo RU-1 disposable proof unless RU-1 source bytes change.
- Do not redo Edge reconciliation.
- Do not redeploy Edge for RU-1; RU-1 is DB profile-readiness authority only.
- `repair/ru0-ru1-backend-20260902` remains QUARANTINE: no merge/cherry-pick/apply.
- Do not copy donor 184 migrations as a stack.
- Do not expose secrets in GitHub, source, logs or mobile bundle.

## Continuity rule

`READ GOVERNING MASTER -> READ THIS HANDOFF -> READ LIVE NETWORK -> READ LEDGER -> READ LIVE_MIGRATION_STATE -> FRESH READ-ONLY GITHUB/SUPABASE VERIFY -> COMPARE -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
