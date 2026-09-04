# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint: 2026-09-04T09:06:24Z

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- RU-3/B05 canonical source promotion head: `ac70e1e66375a9e1be602808a3d4d3a2735f1b3b`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration state: `61 / 20260904090147_clean_ru3_policy_bundle_foundation`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR SHA-256 `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Current live unit

`RU-3 / B05 — publication policy bundle foundation`

State: `LIVE_STRUCTURAL_PROVEN`

Important: **RU-3 as a whole is still OPEN.** B05 only creates the safe server-side structure for future reviewed policy bundles. It seeds no policy content and creates no ALLOW rule.

Canonical source migration:
- `20260904090000_clean_ru3_policy_bundle_foundation.sql` — raw MD5 `e65a1d1658938ffdca07c88c246e660c`

Live Supabase alias:
- source `20260904090000` -> live `20260904090147_clean_ru3_policy_bundle_foundation`; recorded 1 statement; 8506 UTF-8 bytes; recorded MD5 `6ca4db41a4c23dd9bd85fc2e76ea2af8`; exact raw-byte identity with canonical source `false` (semantic/live structural reconciliation only).

## B05 contract now live

- Private policy bundle and rule-reference tables exist.
- RLS is enabled.
- `anon`, `authenticated` and `service_role` have no direct table access.
- Private readiness/current-bundle helpers are not executable by those roles.
- Live tables contain **0 policy bundles and 0 rule references**.
- Missing/unreviewed/incomplete policy cannot activate publication.
- Retired legacy publish remains unavailable to authenticated users.
- Legacy AI publish remains fail-closed with `PACKAGE_4_NOT_READY`.
- Existing business rows remain preserved: 82 AI facts, 15 conversations, 6 Needs, 6 profiles.

## Proof

- Disposable B05 runtime proof run `33854188735`: PASS, including fail-closed behavior, invalid activation rejection, jurisdiction isolation, one-active constraint and zero residue.
- Canonical PRE-P4 run `33855138395` on `ac70e1e66375a9e1be602808a3d4d3a2735f1b3b`: PASS — migration integrity, TypeScript and regression tests.
- Fresh production preflight before live write: PASS.
- Live apply: PASS -> `20260904090147_clean_ru3_policy_bundle_foundation`.
- Live structural post-apply: PASS — zero policy rows, RLS/ACL closed, legacy publish still closed, business rows preserved.
- Edge v5 unchanged since RU-2.

## Closed units — DO NOT REDO

- Edge source reconciliation: DONE
- RU-0 Authority Closure: CLOSED
- RU-1 Worker Readiness: CLOSED
- RU-2 Need V2 + R02/R07 DRAFT: CLOSED

Quarantine remains quarantine: `repair/ru0-ru1-backend-20260902` — no merge/cherry-pick/apply.

## Current blocker / next dependency

There is still no reviewed, versioned and applicable D-0140 policy content. Therefore public admission/publish must remain fail-closed.

Next safe unit: **B06 — immutable admission/publication decision + canonical input fingerprint**, built so it cannot emit/activate ALLOW without a current reviewed complete applicable policy bundle.

Do not activate canonical publish yet. Do not invent legal/safety policy content.

Continuity rule:
`READ MASTER -> HANDOFF -> LIVE NETWORK -> LEDGER -> LIVE MIGRATION STATE -> FRESH PHYSICAL READ -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
