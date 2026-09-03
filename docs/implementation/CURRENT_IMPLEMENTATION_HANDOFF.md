# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint time: 2026-09-03 18:12 Europe/Belgrade

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- RU-0 source commit: `ec8c5396d6aaa009f2979143bd41d311f5feaef0`
- Pre-closure tracking parent: `a96cf9a198fe732aa5ab0d2e01507f79238c1361`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration count/head at checkpoint: `57 / 20260903160812_clean_ru0_authority_closure`
- Edge: `uskoci-ai-interview` ACTIVE v4, `verify_jwt=true`, unchanged

## Last fully completed unit

`RU-0 — Authority Closure`

State: `CLOSED`

Staged source migration:
`supabase/migrations/20260903130355_clean_ru0_authority_closure.sql`

Staged source raw MD5:
`23a60f86bdb952f1dbf62990f2f800cc`

Actual live Supabase migration recording:
- version: `20260903160812`
- name: `clean_ru0_authority_closure`
- statement count: `1`
- recorded statement MD5: `4c0d630d93f8fdfc6e683dcfd8a9895a`
- recorded statement chars: `21495`

The connected migration action assigned the live timestamp and the deployment payload was not byte-identical to the staged file because non-executable section comments were omitted. Do not claim exact-byte identity. The executable RU-0 authority contract was preserved. Current mapping is recorded in `docs/implementation/LIVE_MIGRATION_STATE.json`.

## What RU-0 now enforces live

- authenticated `ai_conversations`: own SELECT only; mutation server-owned
- authenticated `ai_action_proposals`: own SELECT only; mutation server-owned
- authenticated `notification_deliveries`: own SELECT only; mutation server-owned
- raw owner `needs` UPDATE: DRAFT only
- legacy `rpc_ai_propose_fact`: retired / no API-role execution
- legacy `rpc_publish_need`: retired / no API-role execution
- legacy unilateral `rpc_propose_agreement_change`: retired / no API-role execution
- explicit SECURITY DEFINER execution allowlist
- service-owned AI interview writer preserved
- Agreement v2 propose/respond preserved
- no business-row rewrite

## Proof completed

Disposable proof:
- branch: `proof/ru0-disposable-ci-20260903`
- proof head: `6496065940dea7310152cdae23d3766a617398e7`
- GitHub Actions run: `33769629283`
- result: PASS
- owner/attacker/service rollback-only scenarios: PASS
- zero proof residue: PASS

Fresh production preflight immediately before apply:
- `56 / 20260901114029`
- public SECURITY DEFINER `35`
- private SECURITY DEFINER `23`
- expected predecessor broad policies present
- checked business rows: conversations `15`, proposals `2`, facts `82`, Needs `6`, deliveries `0`, Agreements `2`, Agreement versions `2`

Fresh production post-apply proof:
- `57 / 20260903160812_clean_ru0_authority_closure`
- public SECURITY DEFINER `32`
- private SECURITY DEFINER `23`
- authenticated public SECURITY DEFINER allowlist `25`
- private API-executable SECURITY DEFINER `0`
- retired RPC exposure `0`
- service AI writer service-role EXECUTE `true`
- service AI writer authenticated EXECUTE `false`
- Agreement v2 propose/respond authenticated EXECUTE `true / true`
- forbidden mutation policies on AI conversations/proposals/deliveries `0`
- DRAFT-only raw Need UPDATE policy present
- checked business rows unchanged: `15 / 2 / 82 / 6 / 0 / 2 / 2`
- Edge remains ACTIVE v4/JWT on

Production `execute_sql` is connector-enforced read-only, so rollback-only fixture INSERTs cannot be repeated live. That is a connector limitation, not an RU-0 failure. Runtime owner/attacker/service behavior was proven before promotion in disposable Supabase/Postgres, while the live migration committed only after its own embedded predecessor/postcondition assertions passed.

## Important migration provenance reconciliation

`supabase/migrations/MIGRATION_PROVENANCE.json` still reflects the pre-live 56-migration snapshot and staged RU-0 as pending. That file is stale for current RU-0 live status.

For current truth use, in order:
1. this `CURRENT_IMPLEMENTATION_HANDOFF.md`
2. `LIVE_IMPLEMENTATION_NETWORK.md`
3. `IMPLEMENTATION_STATUS_LEDGER.csv`
4. `LIVE_MIGRATION_STATE.json`
5. fresh physical Supabase/GitHub read

Before creating the next forward migration, normalize `MIGRATION_PROVENANCE.json` to the live 57-migration state. This is metadata-only and MUST NOT reapply RU-0 or mutate production.

## Next allowed unit

1. Normalize migration provenance metadata to `57 / 20260903160812` and record the staged→live version mapping.
2. Commit/push that metadata-only reconciliation.
3. Fresh read-only GitHub + live Supabase preflight.
4. If clean, read governing dependency order and begin RU-1.
5. After every unit update LIVE network, ledger and this handoff.

## DO NOT REDO / QUARANTINE

- **DO NOT REAPPLY RU-0.**
- Do not redo Edge reconciliation.
- Do not redeploy Edge as part of RU-0.
- `repair/ru0-ru1-backend-20260902` remains QUARANTINE: no merge, cherry-pick or apply.
- Do not copy donor 184 migrations as a stack.
- Do not expose secrets in GitHub, source, logs or mobile bundle.

## Continuity rule

On every new agent/session:
`READ GOVERNING MASTER -> READ THIS HANDOFF -> READ LIVE NETWORK -> READ LEDGER -> READ LIVE_MIGRATION_STATE -> FRESH READ-ONLY GITHUB/SUPABASE VERIFY -> COMPARE -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
