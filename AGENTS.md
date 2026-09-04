# USKOČI — AGENT ENTRY POINT

This file is the repository entry point for Codex, Claude, ChatGPT or any other implementation agent.

## 1. Governing product/system master

Frozen governing package:

`USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`

SHA-256:

`e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`

The package defines product canon, owner decisions, 28-surface model, machine-readable matrices, backend/Supabase reconciliation, RU/PP execution plans, D-0140 architecture, proof standard and visual handoff. It is a frozen baseline; current implementation progress after the freeze is tracked in GitHub continuity files below.

## 2. Canonical implementation identity

- repository: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- quarantine branch: `repair/ru0-ru1-backend-20260902` — never merge/cherry-pick/apply

## 3. Mandatory current-state read order before any write

Read these exact files first:

1. `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`
2. `docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md`
3. `docs/implementation/LIVE_MIGRATION_STATE.json`
4. `docs/implementation/IMPLEMENTATION_STATUS_LEDGER.csv`
5. relevant governing-master section for the unit being continued

Then perform a fresh physical read-only preflight against GitHub + live Supabase. If physical state differs from the continuity files, stop writes and reconcile first.

## 4. Current continuity rule

Do not reconstruct USKOČI from old donor files or old handoffs. Latest explicit owner closure wins over older plans/research. Historical files are provenance only unless the current master explicitly promotes them.

The root `HANDOFF.md` is only a pointer/current summary. It no longer carries the obsolete 30.08.2026 implementation truth.

## 5. Current cursor as of 2026-09-04 continuity reconciliation

- RU-0: CLOSED
- RU-1: CLOSED
- RU-2: CLOSED
- RU-3/B05: LIVE_STRUCTURAL_PROVEN
- RU-3/B06: LIVE_STRUCTURAL_PROVEN
- live Supabase: `62 / 20260904102429_clean_ru3_need_publication_decision`
- Edge `uskoci-ai-interview`: ACTIVE v5, `verify_jwt=true`, EZBR SHA-256 `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`
- D-0140 minimum owner publication policy: OWNER_LOCKED, checked into canonical docs/staging, NOT production activated
- B07 canonical publish: PROOF_ONLY on `proof/ru3-b07-canonical-publish-20260904`; not canonical/live; true concurrent publish proof still required

Production publication remains fail-closed until a reviewed/current/applicable server-owned policy bundle is activated. Do not invent legal rules and do not seed a fake production ALLOW.

## 6. Immediate next implementation cursor

1. Rebaseline fresh physical state.
2. Finish B07 true concurrency/idempotency proof on the B07 proof branch.
3. Promote only intended B07 artifacts after proof; update continuity files.
4. Keep production D-0140 activation fail-closed.
5. Continue to RU-4 material revision/re-admission mechanics, using disposable test-only policy fixtures for E2E proof where needed.

RU-8 remains the final cross-wave proof after RU-7; it is not a prerequisite to every earlier RU migration.

## 7. Hard engineering rules

- forward-only migrations; never rewrite an applied migration
- server authority over client/AI authority
- service secrets server-side only; never in Expo/source/GitHub/logs
- proof means exact asserted behavior, including auth negatives, service positives, idempotency/concurrency where relevant and zero residue
- no mutation merely because a UI path appears ready
- after each promoted unit update all four continuity files listed in section 3

## 8. Expo note

Expo has changed. Before Expo-specific implementation, read the exact versioned documentation for the repository's installed/current Expo version rather than assuming older APIs.
