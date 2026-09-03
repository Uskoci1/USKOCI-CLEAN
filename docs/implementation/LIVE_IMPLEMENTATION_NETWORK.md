# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-03 20:52 Europe/Belgrade
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- Canonical Supabase project: `leqcwgzvjsxugfgzdmth`
- Live production migrations: `58`
- Live production migration head: `20260903184545_clean_ru1_worker_readiness`
- Live Edge Function: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged by RU-1

## RU-0 — Authority Closure

State: `CLOSED`

Network intent:
`authenticated client -> narrow RPC/read projection -> RLS/grants -> server authority -> canonical reread`

Live version: `20260903160812_clean_ru0_authority_closure`

Proof:
- disposable owner/attacker/service run `33769629283`: PASS
- live structural proof: PASS
- migration provenance: RECONCILED

DO NOT REAPPLY RU-0.

## RU-1 — Worker Readiness

State: `CLOSED`

Network intent:
`auth user creation -> REQUESTER ACTIVE + WORKER DRAFT -> owner edits under RLS -> rpc_complete_worker_profile -> server readiness checks -> narrow tokenized DRAFT-to-ACTIVE -> canonical reread`

Canonical DB source:
- implementation commit: `5e586c63783b7743687224e3cc670e7ed52e4e48`
- migration: `supabase/migrations/20260903165700_clean_ru1_worker_readiness.sql`
- bytes: `13591`
- MD5: `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256: `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`

RN consumer alignment:
- commit: `ebabc6a48a9712ea34043b63dd7f6867e88691a2`
- `src/app/(app)/profil/radnik.tsx`
- UI requires name + city + at least one skill before activation, matching server readiness.

Live Supabase recording:
- live version: `20260903184545`
- live name: `clean_ru1_worker_readiness`
- statement count: `1`
- recorded UTF-8 bytes: `13591`
- recorded MD5: `f80e2e721365ee07316a9c0e84ab593f`
- exact byte identity with canonical source: `true`

RU-1 live effects:
1. New REQUESTER profiles derive `ACTIVE`.
2. New WORKER profiles derive `DRAFT`.
3. `profile_status` default is `DRAFT`.
4. Direct client status activation fails closed.
5. `account_id` and `kind` are immutable through the guard.
6. Owner-only completion RPC is `rpc_complete_worker_profile(uuid)`.
7. Completion requires display name, city and >=1 skill.
8. Already ACTIVE replay is idempotent.
9. Authenticated direct DELETE on `app_profiles` is revoked.
10. Existing ACTIVE Workers were preserved; no mass downgrade occurred.

### Fail-closed bug caught before production

Disposable proof found an earlier nullable-token SQL bug where a NULL boolean expression could avoid an intended denial. The final live guard uses explicit `IS DISTINCT FROM`, so absent/wrong mutation tokens fail closed. The faulty candidate was never applied to production.

## RU-1 proof

Disposable runtime proof:
- branch `proof/ru1-disposable-ci-20260903`
- source head `339e08017e56ac01c5cbfa8e91e89db8233e97d8`
- run `33790306570`: PASS
- DB apply PASS
- owner/attacker/replay PASS
- direct activation denial PASS
- identity mutation denial PASS
- missing-skill denial PASS
- forced ACTIVE insert -> DRAFT PASS
- authenticated DELETE denial PASS
- historical ACTIVE Worker preserved PASS
- zero residue PASS

Checksum proof:
- run `33790742908`: PASS
- bytes `13591`
- MD5 `f80e2e721365ee07316a9c0e84ab593f`
- SHA-256 `71c2ec459e4cb986698856194017c71661769c236434fbbc2505ae5aed3190a0`

Promotion integrity:
- run `33791044226`: PASS
- minimal-provenance run `33791592988`: PASS

Fresh production post-apply proof:
- migration state `58 / 20260903184545`
- profile default `'DRAFT'::text`
- fail-closed token guard present
- REQUESTER→ACTIVE insert derivation present
- WORKER→DRAFT insert derivation present
- identity immutability guard present
- completion RPC contract present
- completion RPC EXECUTE anon/auth/service `false/true/true`
- private guard EXECUTE anon/auth/service `false/false/false`
- anon `app_profiles` SELECT `false`
- authenticated `app_profiles` SELECT/INSERT/UPDATE/DELETE `true/true/true/false`
- service-role DELETE `true`
- guard trigger present
- profile counts before/after preserved: total `6`; REQUESTER ACTIVE `3`; WORKER ACTIVE `3`; WORKER DRAFT `0`; WORKER other `0`
- embedded migration postconditions passed before commit.

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` is normalized to the live state:
- live snapshot count `58`
- live last `20260903184545_clean_ru1_worker_readiness`
- RU-1 source version `20260903165700` maps to live version `20260903184545`
- exact byte identity `true`
- pending forward migrations `0`

## Current state

| Layer | State |
|---|---|
| Edge source reconciliation | DONE |
| RU-0 overall | CLOSED |
| RU-1 DB source | CANONICAL |
| RU-1 disposable DB apply | PASS |
| RU-1 owner/attacker/replay proof | PASS |
| RU-1 zero-residue proof | PASS |
| RU-1 production apply | APPLIED |
| RU-1 production structural proof | PASS |
| RU-1 RN readiness alignment | COMMITTED |
| RU-1 migration provenance | RECONCILED |
| RU-1 overall | CLOSED |

## Next allowed action

1. Fresh read-only GitHub + Supabase preflight against `58 / 20260903184545`.
2. Read the governing master RU-2 dependency contract from current canonical/governing materials.
3. If physical state matches, begin RU-2 exactly in dependency order.
4. Proof before live promotion; update network, ledger, migration state and handoff after the unit.

## DO NOT REDO / DO NOT TOUCH

- DO NOT REAPPLY RU-0 or RU-1.
- Do not redo RU-1 proof unless its source bytes change.
- Do not redeploy Edge v4 for RU-1.
- Do not merge/cherry-pick/apply `repair/ru0-ru1-backend-20260902`.
- Do not copy donor 184 migrations as a stack.
- Do not expose provider/service secrets.

Principle: **AI agent is replaceable. Canonical project state is not.**
