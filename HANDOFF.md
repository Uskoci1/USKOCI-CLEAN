# USKOČI — CURRENT HANDOFF POINTER

Status: `CURRENT CONTINUITY ENTRY / 2026-09-04`

This file supersedes the obsolete 30.08.2026 root handoff. Do not use the old local-folder, no-remote or old-migration-count claims as current truth.

## Governing master

Use this frozen package as the product/system authority:

`USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`

SHA-256:

`e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`

The master is the complete frozen baseline. Implementation progress after that freeze is tracked in the live GitHub continuity files below.

## Canonical identity

- GitHub: `Uskoci1/USKOCI-CLEAN`
- branch: `clean-alpha-backend`
- Supabase: `leqcwgzvjsxugfgzdmth`
- quarantine: `repair/ru0-ru1-backend-20260902` — no merge/cherry-pick/apply

## Read this before continuing

1. `AGENTS.md`
2. `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`
3. `docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md`
4. `docs/implementation/LIVE_MIGRATION_STATE.json`
5. `docs/implementation/IMPLEMENTATION_STATUS_LEDGER.csv`
6. relevant section of the governing master for the next RU/unit

Then perform a fresh physical GitHub/Supabase preflight before writes.

## Current physical baseline at this reconciliation

- canonical pre-reconciliation base: `7d2ad4ad774eab29acafc0deac623744a691628d`
- live migrations: `62`
- live migration head: `20260904102429_clean_ru3_need_publication_decision`
- Edge `uskoci-ai-interview`: ACTIVE v5, `verify_jwt=true`
- Edge EZBR SHA-256: `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Closed / proven units — do not redo

- Edge source reconciliation — DONE
- RU-0 Authority Closure — CLOSED
- RU-1 Worker Readiness — CLOSED
- RU-2 Need V2 + R02/R07 DRAFT — CLOSED
- RU-3/B05 policy-bundle foundation — LIVE_STRUCTURAL_PROVEN
- RU-3/B06 publication decision + canonical fingerprint — LIVE_STRUCTURAL_PROVEN

RU-3 as a whole is still OPEN.

## Owner-locked D-0140 minimum now carried forward

Canonical documentation/staging contains the minimum owner publication policy:

- `docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md`
- `supabase/staging/ru3/rs_publication_policy_minimum_owner_lock_v1.json`

Important product boundary:

- public Marketplace inventory = requested **Zadaci only**;
- no public "nudim uslugu" listing type;
- skills/tools/vehicles/experience/availability belong to **Radni profil**;
- only `ALLOW` may publish;
- `CLARIFY`, `REVIEW`, `BLOCK` are non-public;
- the minimum policy is OWNER_LOCKED but NOT production activated;
- broader 46-rule legal/research candidate remains proof/research material, not current production authority.

## B07 proof-only work

Branch:

`proof/ru3-b07-canonical-publish-20260904`

Proof branch head:

`33d688eb41d081ae1e9491001e16fda1974b5bf4`

Candidate:

`supabase/staging/ru3/20260904111500_clean_ru3_canonical_publish.sql`

Known proof:

- corrected green runtime proof: `33870266770`
- persistence proof: `33870598378`

B07 is NOT canonical and NOT live. Remaining proof-quality gap: true concurrent publish sessions for same-key/same-payload, same-key/different-payload and different-key/same-Need behavior.

## Production publication state

Production publication remains fail-closed:

- no reviewed/current/applicable Serbia policy bundle is active;
- B06 still refuses production `ALLOW`;
- no fake production policy fixture may be used;
- disposable TEST_ONLY policy fixtures may be used only in isolated proof environments and must leave zero residue.

## Exact next cursor

1. Fresh physical preflight.
2. Finish B07 concurrency/idempotency proof on the existing B07 proof branch.
3. Promote only intended B07 artifacts after proof and rebaseline.
4. Keep real Serbia policy activation fail-closed/deferred.
5. Continue RU-4 material revision/re-admission.
6. Then continue RU-5 → RU-6A → RU-6B → RU-7 → RU-8 according to the governing master.

After every promoted unit, update the four continuity files so the next AI can resume without reconstructing the project.

**AI agent is replaceable. Canonical project state is not.**
