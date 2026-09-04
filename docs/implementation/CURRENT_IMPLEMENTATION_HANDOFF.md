<!-- RU3_B07_LIVE_CHECKPOINT_20260904 -->
## LATEST PHYSICAL CHECKPOINT — RU-3/B07 LIVE

This block supersedes older B07 proof-only/concurrency-pending cursor text below.

- canonical source promotion: `d2c077d90c6410dc0737916df13b257389c6cb3b`
- B07 source: `supabase/migrations/20260904111500_clean_ru3_canonical_publish.sql` (`17468983d28cddfe4948c3866a96e813` raw MD5)
- true concurrency/idempotency proof: GitHub Actions `33903129202` — PASS
- clean promotion integrity: `33905242409` — PASS
- canonical push integrity: `33905436213` — PASS
- live Supabase migration: `20260904182402_clean_ru3_canonical_publish`
- live migration count: `63`
- live structural proof: PASS; zero publish-command rows; zero policy bundles/rules/publication decisions; business counts preserved
- production publication remains `FAIL_CLOSED`; no reviewed Serbia policy/evaluator activation and B06 production ALLOW writer remains disabled
- RU-3/B05, B06 and B07 infrastructure are live/structurally proven; RU-3 overall remains OPEN only for deferred production policy/evaluator/release activation
- exact next implementation cursor: **RU-4 Material Revision / Re-admission** after a fresh physical preflight

# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint: 2026-09-04 continuity reconciliation after B07 proof work + minimum D-0140 owner lock.

## Governing master

Frozen governing package:

`USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`

SHA-256:

`e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`

The master remains the complete product/system baseline. This file records implementation progress that happened after that freeze.

## Canonical identity / fresh reconciliation baseline

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Canonical base observed before this docs-only continuity reconciliation: `7d2ad4ad774eab29acafc0deac623744a691628d`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration state: `62 / 20260904102429_clean_ru3_need_publication_decision`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR SHA-256 `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

Always resolve the physical current Git HEAD fresh; do not treat the static base SHA above as a substitute for preflight.

## Closed units — DO NOT REDO

- Edge source reconciliation: DONE
- RU-0 Authority Closure: CLOSED
- RU-1 Worker Readiness: CLOSED
- RU-2 Need V2 + R02/R07 DRAFT: CLOSED
- RU-3/B05 structural foundation: LIVE_STRUCTURAL_PROVEN
- RU-3/B06 structural decision/fingerprint: LIVE_STRUCTURAL_PROVEN

Quarantine remains quarantine: `repair/ru0-ru1-backend-20260902` — no merge/cherry-pick/apply.

## RU-3/B05 live contract

- private policy bundle metadata + rule-reference structure exists;
- fail-closed readiness/current helpers exist;
- no production policy bundle/rule content was seeded by B05;
- B05 is infrastructure only.

## RU-3/B06 live contract

- `private.need_publication_decisions` exists as an append-only decision ledger;
- table remained at 0 decision rows after live apply;
- RLS/ACL direct CRUD is closed;
- private fingerprint helper is not directly executable by anon/authenticated/service_role;
- service writer is service-role only;
- service writer requires exact current Need revision, canonical geography, reviewed+complete active policy bundle and exact rule provenance;
- public media remains fail-closed until review authority exists;
- production `ALLOW` is explicitly disabled with `RU3_ALLOW_NOT_ENABLED`;
- authenticated legacy `rpc_publish_need` remains unavailable;
- legacy AI publish remains fail-closed with `PACKAGE_4_NOT_READY`;
- existing business rows were preserved at the last live proof.

B06 canonical source head: `4d735390e32c530a323b24dad95ddaa0422bd493`.

## Minimum D-0140 owner policy — now canonical documentation, not activation

Owner-approved minimum publication policy is carried in canonical documentation/staging:

- `docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md`
- `supabase/staging/ru3/rs_publication_policy_minimum_owner_lock_v1.json`

State: `OWNER_LOCKED_MINIMUM / NOT_PRODUCTION_ACTIVATED`.

Critical boundary:

- public Marketplace inventory contains requested **Zadaci only**;
- no public provider/service-offer listing type;
- skills/tools/vehicles/experience/availability belong to **Radni profil**;
- ordinary clear requested Zadatak can be `ALLOW` at policy level;
- service-offer ads, classified sales/rentals and spam/promotion are not supported inventory;
- profanity in otherwise acceptable public task text requires cleanup (`CLARIFY`);
- targeted abuse, violence/threats, fraud/theft/evasion, stalking/doxxing, sexual exploitation and core dangerous/prohibited objectives are `BLOCK` in the minimum platform policy;
- unresolved high-risk/regulated categories remain `REVIEW` / non-public until reviewed rules exist;
- `HITNO` never bypasses policy;
- only `ALLOW` is publishable.

The broader earlier 46-rule candidate remains research/proof material and is NOT current production authority.

## RU-3/B07 — canonical publish proof work

State: `PROOF_ONLY / NOT_CANONICAL / NOT_LIVE`.

Branch:

`proof/ru3-b07-canonical-publish-20260904`

Proof branch head:

`33d688eb41d081ae1e9491001e16fda1974b5bf4`

Candidate source:

`supabase/staging/ru3/20260904111500_clean_ru3_canonical_publish.sql`

Candidate behavior:

- private idempotency owner for publish commands;
- authenticated-only `public.rpc_publish_need_canonical(...)`;
- checks owner, DRAFT state, exact revision/fingerprint, exact current decision, current reviewed active bundle/policy jurisdiction/rule provenance;
- publishes atomically and dispatches only from exact current `ALLOW` authority;
- does not seed policy and does not manufacture an `ALLOW`;
- legacy/AI publish paths remain disabled.

Known proof:

- corrected green runtime proof: GitHub Actions run `33870266770`;
- persistence proof: run `33870598378`;
- proof branch head after persistence: `33d688eb41d081ae1e9491001e16fda1974b5bf4`.

Remaining proof-quality gap before promotion:

- true concurrent publish sessions are not yet proven;
- prove same-key/same-payload replay;
- same-key/different-payload rejection;
- different-key/same-Need concurrency without duplicate publish/dispatch.

Do not promote B07 merely because the single-session proof is green.

## Production publication state

Production canonical publication remains fail-closed.

The owner minimum policy is not itself a production Serbia legal-policy activation. No reviewed/current/applicable Serbia bundle has been activated in live Supabase, so do not issue or seed a fake production `ALLOW`.

Disposable TEST_ONLY policy fixtures may be used in isolated proof environments to prove downstream mechanics, but must never become production authority and must leave zero residue.

## Exact next cursor

1. Fresh physical read-only preflight against current canonical Git HEAD + live `62 / 20260904102429` + Edge v5.
2. Continue existing B07 proof branch; add true concurrency/idempotency proof only.
3. If B07 proof is fully green, promote only intended B07 source/tests — no proof-only helper residue.
4. Rebaseline before any live migration; apply forward-only only if exact proof/promotion state is preserved.
5. Keep production D-0140 policy activation fail-closed/deferred.
6. Then continue RU-4 material revision/re-admission according to the governing master.
7. After RU-4 continue RU-5 → RU-6A → RU-6B → RU-7 → RU-8, each with its own required proof.

Continuity rule:

`READ MASTER -> AGENTS/HANDOFF -> LIVE NETWORK -> MIGRATION STATE -> LEDGER -> FRESH PHYSICAL READ -> CONTINUE OR RECONCILE`

After every promoted unit update all four continuity files.

**AI agent is replaceable. Canonical project state is not.**
