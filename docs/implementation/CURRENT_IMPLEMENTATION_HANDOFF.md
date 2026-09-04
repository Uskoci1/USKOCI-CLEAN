# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint: 2026-09-04T10:29:18Z

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- RU-3/B06 canonical source promotion head: `4d735390e32c530a323b24dad95ddaa0422bd493`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration state: `62 / 20260904102429_clean_ru3_need_publication_decision`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR SHA-256 `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Current live unit

`RU-3 / B06 — immutable Need publication decision + canonical fingerprint`

State: `LIVE_STRUCTURAL_PROVEN`

Important: **RU-3 as a whole is still OPEN.** B05 and B06 are live/proven structural subunits only. No reviewed D-0140 policy content has been seeded and B06 explicitly refuses `ALLOW`.

Canonical source migration:
- `20260904103000_clean_ru3_need_publication_decision.sql` — raw MD5 `3974c57c159f3c7c9262db4b296729c3`

Live Supabase alias:
- source `20260904103000` -> live `20260904102429_clean_ru3_need_publication_decision`; recorded 1 statement; 19746 UTF-8 bytes; recorded MD5 `693e3c31a5647b8a63932f3b1ab13eb0`; exact raw-byte identity with canonical source `false` because the connected apply path did not preserve the terminal newline byte.

## B06 contract now live

- `private.need_publication_decisions` exists as an append-only decision ledger.
- The table contains **0 decision rows** after live apply.
- RLS is enabled and anon/authenticated/service_role have no direct table CRUD.
- The private fingerprint helper is not executable by anon/authenticated/service_role.
- Only `service_role` may execute the service decision writer.
- The service decision writer requires exact current Need revision, canonical geography, current reviewed+complete active policy bundle and exact rule provenance.
- Public media remains fail-closed until review authority exists.
- `ALLOW` is explicitly disabled with `RU3_ALLOW_NOT_ENABLED`.
- Authenticated legacy `rpc_publish_need` remains unavailable.
- Legacy AI publish remains fail-closed with `PACKAGE_4_NOT_READY`.
- Existing business rows remain preserved: 82 AI facts, 15 conversations, 6 Needs, 6 profiles.
- Edge v5 remains unchanged.

## Proof

- Disposable B06 runtime proof run `33857742442`: PASS — fail-closed policy, auth/service boundaries, stale revision, fingerprint materiality, immutable decision ledger, media gate and zero residue.
- Clean promotion run `33862361633`: PASS — clean 4-file promotion, migration integrity, TypeScript and regression tests.
- Canonical PRE-P4 run `33862478205` on `4d735390e32c530a323b24dad95ddaa0422bd493`: PASS — migration integrity, TypeScript and regression tests.
- Fresh production preflight before live write: PASS at 61 migrations with B06 absent.
- Live apply: PASS -> `20260904102429_clean_ru3_need_publication_decision`.
- Live structural post-apply: PASS — 0 decision rows, RLS/ACL closed, service-only writer, ALLOW disabled, legacy publish closed, business rows preserved.
- Edge v5 unchanged.

## Closed units — DO NOT REDO

- Edge source reconciliation: DONE
- RU-0 Authority Closure: CLOSED
- RU-1 Worker Readiness: CLOSED
- RU-2 Need V2 + R02/R07 DRAFT: CLOSED
- RU-3/B05 structural foundation: LIVE_STRUCTURAL_PROVEN
- RU-3/B06 structural decision/fingerprint: LIVE_STRUCTURAL_PROVEN

Quarantine remains quarantine: `repair/ru0-ru1-backend-20260902` — no merge/cherry-pick/apply.

## Current blocker / next dependency

There is still no reviewed, versioned and applicable D-0140 policy content. Therefore canonical admission/publish must remain fail-closed. B06 is intentionally unable to emit `ALLOW`.

Next allowed work: fresh physical preflight against live 62 + Edge v5, then continue only with fail-closed RU-3 structure or authoritative reviewed D-0140 policy/evaluator content. Do not activate canonical publish yet and do not invent legal/safety rules.

Continuity rule:
`READ MASTER -> HANDOFF -> LIVE NETWORK -> LEDGER -> LIVE MIGRATION STATE -> FRESH PHYSICAL READ -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
