# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint time: 2026-09-03 20:22 Europe/Belgrade

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
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

RU-0 is closed and must not be reapplied.

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
- predecessor: `57 / 20260903160812`

RU-1 contract:
1. Existing profile/business rows are not rewritten.
2. New REQUESTER profiles derive `ACTIVE`.
3. New WORKER profiles derive `DRAFT`.
4. `app_profiles.profile_status` default becomes `DRAFT`.
5. `account_id` and `kind` are immutable profile identity.
6. Direct client status activation is blocked.
7. Only owner `rpc_complete_worker_profile(uuid)` may perform WORKER `DRAFT -> ACTIVE`.
8. Completion requires display name, city and at least one skill.
9. Completion is replay-idempotent for already ACTIVE workers.
10. Authenticated direct DELETE on `app_profiles` is removed; owner read/insert/update stays RLS-governed.
11. Existing ACTIVE workers remain ACTIVE; no mass downgrade or business-row rewrite.

## RU-1 proof

Disposable proof branch:
`proof/ru1-disposable-ci-20260903`

Final full proof source head:
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
- client insert requesting ACTIVE is derived back to DRAFT;
- attacker cannot update victim Worker;
- direct authenticated profile DELETE denied;
- historical ACTIVE Worker preserved;
- zero proof residue;
- source checks PASS.

Durable rollback-only proof files:
- `supabase/proofs/ru1_targeted_predecessor_fixture.sql`
- `supabase/proofs/ru1_worker_readiness_runtime_proof.sql`

Exact source checksum was independently recorded by GitHub Actions run `33790742908`.

### Important bug caught before production

Disposable proof found a real nullable-SQL authorization bug in an earlier RU-1 candidate: `NOT(NULL)` does not become `TRUE`, so a NULL mutation token could fail open. The final proven guard is explicitly fail-closed with `IS DISTINCT FROM` checks. Production was never exposed to the faulty candidate.

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` remains normalized to the live 57-migration production state and now records RU-1 as one pending forward migration with `live_applied=false`.

`supabase/migrations/MD5_MANIFEST.txt` contains the exact RU-1 raw MD5. Existing migration-integrity checker passed on the promotion branch after pending metadata was registered.

## Current status

- Edge source reconciliation: DONE — DO NOT REDO
- RU-0: CLOSED — DO NOT REAPPLY
- RU-1 source: STAGED
- RU-1 disposable DB apply: PASS
- RU-1 owner/attacker/replay proof: PASS
- RU-1 zero-residue proof: PASS
- RU-1 production apply: NO
- Production state: still `57 / 20260903160812`

## Next allowed action

1. Finish clean source promotion from `promotion/ru1-worker-readiness-20260903` to canonical `clean-alpha-backend` only after branch diff/integrity verification.
2. Fresh read-only verify canonical GitHub HEAD and live Supabase still `57 / 20260903160812`.
3. STOP at the live boundary and obtain explicit owner approval before applying RU-1 to production.
4. If approved, apply exactly the proven RU-1 migration content, then fresh live structural/read-only proof.
5. Reconcile live-assigned migration version if Supabase assigns a different timestamp, and update handoff/network/ledger/migration-state.

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
