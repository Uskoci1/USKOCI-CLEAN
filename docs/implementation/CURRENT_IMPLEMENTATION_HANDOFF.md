# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint time: 2026-09-03 18:19 Europe/Belgrade

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration count/head: `57 / 20260903160812_clean_ru0_authority_closure`
- Edge: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged

## Last fully completed unit

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

## Migration provenance

`supabase/migrations/MIGRATION_PROVENANCE.json` is normalized to the 57-migration live state and contains the explicit staged-source→live-version alias.

`supabase/migrations/check_migration_integrity.py` supports explicit physical `file` aliases on live history entries so GitHub does not need a duplicate migration file and RU-0 cannot be accidentally replayed.

`docs/implementation/LIVE_MIGRATION_STATE.json` is the compact current machine-readable live migration checkpoint.

## Current status

- Edge source reconciliation: DONE — DO NOT REDO
- RU-0: CLOSED — DO NOT REAPPLY
- RU-1: READY_NOT_STARTED

## Next allowed unit

1. Fresh read-only GitHub/Supabase preflight.
2. Read the governing master dependency order for RU-1 from the actual governing package/current canonical materials.
3. Do not infer RU-1 from `repair/ru0-ru1-backend-20260902`; that branch remains quarantine.
4. If preflight matches `57 / 20260903160812`, begin RU-1 exactly in governing order.
5. Prove before live promotion and update all implementation tracking afterward.

## DO NOT REDO / QUARANTINE

- DO NOT REAPPLY RU-0.
- Do not redo Edge reconciliation.
- Do not redeploy Edge for RU-0.
- `repair/ru0-ru1-backend-20260902` remains QUARANTINE: no merge/cherry-pick/apply.
- Do not copy donor 184 migrations as a stack.
- Do not expose secrets in GitHub, source, logs or mobile bundle.

## Continuity rule

`READ GOVERNING MASTER -> READ THIS HANDOFF -> READ LIVE NETWORK -> READ LEDGER -> READ LIVE_MIGRATION_STATE -> FRESH READ-ONLY GITHUB/SUPABASE VERIFY -> COMPARE -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
