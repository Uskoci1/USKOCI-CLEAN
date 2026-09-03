# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint time: 2026-09-03 20:52 Europe/Belgrade

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration count/head: `58 / 20260903184545_clean_ru1_worker_readiness`
- Edge: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged

## Last fully completed unit

`RU-1 — Worker Readiness`

State: `CLOSED`

Canonical DB source:
- migration implementation commit: `5e586c63783b7743687224e3cc670e7ed52e4e48`
- migration: `supabase/migrations/20260903165700_clean_ru1_worker_readiness.sql`
- raw bytes: `13591`
- MD5: `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256: `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`

RN readiness alignment:
- commit: `ebabc6a48a9712ea34043b63dd7f6867e88691a2`
- file: `src/app/(app)/profil/radnik.tsx`
- activation UI now requires name + city + at least one skill, matching the server contract.

Live Supabase recording:
- live version: `20260903184545`
- live name: `clean_ru1_worker_readiness`
- statement count: `1`
- recorded UTF-8 bytes: `13591`
- recorded statement MD5: `f80e2e721365ee07316a9c0e84ab593f`
- exact-byte identity with canonical migration: `true`

## RU-1 contract now live

1. Existing profile/business rows are not rewritten by the migration.
2. New REQUESTER profiles derive `ACTIVE`.
3. New WORKER profiles derive `DRAFT`.
4. `app_profiles.profile_status` default is `DRAFT`.
5. `account_id` and `kind` are immutable through the profile guard.
6. Direct client WORKER `DRAFT -> ACTIVE` is denied fail-closed.
7. Only owner `rpc_complete_worker_profile(uuid)` may perform WORKER `DRAFT -> ACTIVE`.
8. Completion requires display name, city and at least one skill.
9. Repeating completion on an already ACTIVE Worker is idempotent.
10. Authenticated direct DELETE on `app_profiles` is revoked; SELECT/INSERT/UPDATE remain RLS-governed.
11. Existing ACTIVE Workers remain ACTIVE; there was no mass downgrade.

## RU-1 proof

Disposable runtime proof:
- branch `proof/ru1-disposable-ci-20260903`
- final proof source head `339e08017e56ac01c5cbfa8e91e89db8233e97d8`
- GitHub Actions run `33790306570`
- DB apply PASS
- owner/attacker/replay PASS
- direct activation denial PASS
- identity mutation denial PASS
- missing-skill denial PASS
- forced ACTIVE insert derives DRAFT PASS
- authenticated DELETE denial PASS
- historical ACTIVE Worker preservation PASS
- zero residue PASS

Checksum proof:
- run `33790742908`
- bytes `13591`
- MD5 `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256 `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`

Promotion integrity:
- runs `33791044226` and `33791592988`: PASS

Live post-apply structural proof:
- migration state `58 / 20260903184545`
- profile default `'DRAFT'::text`
- fail-closed `IS DISTINCT FROM` token guard present
- REQUESTER insert derives ACTIVE
- WORKER insert derives DRAFT
- profile identity immutability guard present
- completion RPC contract present
- anon completion RPC EXECUTE `false`
- authenticated completion RPC EXECUTE `true`
- service-role completion RPC EXECUTE `true`
- private guard API EXECUTE anon/auth/service `false/false/false`
- anon app_profiles SELECT `false`
- authenticated app_profiles SELECT/INSERT/UPDATE `true/true/true`
- authenticated app_profiles DELETE `false`
- service-role app_profiles DELETE `true`
- guard trigger present
- profile rows preserved: total `6`; REQUESTER ACTIVE `3`; WORKER ACTIVE `3`; WORKER DRAFT `0`; WORKER other `0`
- embedded migration postconditions also verified preserved auth-creation helper definitions before commit.

## Important bug caught before production

An earlier RU-1 candidate used nullable SQL boolean logic around the mutation token. With a NULL token, PostgreSQL could yield NULL instead of a positive denial condition. Disposable proof caught this before live promotion. The final live guard uses explicit `IS DISTINCT FROM`, so absent/wrong tokens fail closed.

## RU-0 remains closed

- RU-0 live version: `20260903160812_clean_ru0_authority_closure`
- RU-0 disposable proof run: `33769629283`
- RU-0 is not to be reapplied or redesigned.
- Edge v4 was not changed by RU-1.

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` is reconciled to live `58 / 20260903184545`.

RU-1 staged source version `20260903165700` maps to live Supabase version `20260903184545`; exact byte identity is proven by equal UTF-8 byte count and MD5.

Pending forward migrations after RU-1 closure: `0`.

## Current status

- Edge source reconciliation: DONE — DO NOT REDO
- RU-0: CLOSED — DO NOT REAPPLY
- RU-1 DB source: CANONICAL
- RU-1 disposable runtime proof: PASS
- RU-1 production apply: APPLIED
- RU-1 live structural proof: PASS
- RU-1 RN readiness alignment: COMMITTED
- RU-1 migration provenance: RECONCILED
- RU-1 overall: CLOSED

## Next allowed unit

1. Fresh read-only GitHub/Supabase preflight against this checkpoint.
2. Read the governing master RU-2 dependency contract from the actual canonical/governing materials; do not infer it from quarantine/history.
3. If physical state matches `58 / 20260903184545`, begin RU-2 exactly in governing order.
4. Continue proof-before-live and update all durable tracking after each unit.

## DO NOT REDO / QUARANTINE

- DO NOT REAPPLY RU-0 or RU-1.
- Do not redo RU-1 disposable proof unless RU-1 source bytes change.
- Do not redeploy Edge for RU-1.
- `repair/ru0-ru1-backend-20260902` remains QUARANTINE: no merge/cherry-pick/apply.
- Do not copy donor 184 migrations as a stack.
- Do not expose secrets in GitHub, source, logs or mobile bundle.

## Continuity rule

`READ GOVERNING MASTER -> READ THIS HANDOFF -> READ LIVE NETWORK -> READ LEDGER -> READ LIVE_MIGRATION_STATE -> FRESH READ-ONLY GITHUB/SUPABASE VERIFY -> COMPARE -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
