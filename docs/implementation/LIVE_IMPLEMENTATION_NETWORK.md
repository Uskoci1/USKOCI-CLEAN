<!-- RU4_OWNER_LOCK_20260904 -->
## CURRENT RU-4 OWNER LOCK — PRODUCT TARGET, NOT LIVE MIGRATION

Canonical decision: `docs/implementation/ru4/RU4_OWNER_LOCK_V1.md`.

This owner lock supersedes older RU-4/COV-028 semantics wherever they allowed one parent Zadatak to carry materially changed terms after the first Dogovor.

Target network:

`no Dogovor yet -> owner may edit -> confirmed content/terms change creates new Need revision -> all old unselected Prijave = STALE_REVIEW_REQUIRED/non-selectable -> each Worker must explicitly accept/revise/withdraw -> accepted/rebased Prijava may become current again`

`first Dogovor formed -> parent Zadatak content edit LOCKED for V1 -> remaining capacity continues on same terms -> Ne traži više nikoga may close remaining search -> different remaining terms require a new Zadatak -> already-selected participant term changes go through Dogovor change`

No live RU-4 migration has been applied. Existing `proof/ru4-material-revision-20260904` work must be reconciled because its post-Dogovor parent-edit semantics are now superseded.

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

# USKOČI — LIVE IMPLEMENTATION NETWORK

Last reconciled: 2026-09-04 after B07 proof work + minimum D-0140 owner policy lock.
Authority: governing master + latest explicit owner locks + fresh physical GitHub/Supabase reads.

## Governing master

`USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`

SHA-256:

`e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`

## Canonical physical baseline at reconciliation

- Repository: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Canonical base observed before this docs-only reconciliation: `7d2ad4ad774eab29acafc0deac623744a691628d`
- Supabase: `leqcwgzvjsxugfgzdmth`
- Live migrations: `62`
- Live head: `20260904102429_clean_ru3_need_publication_decision`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

Resolve the current Git HEAD physically before every write; the base SHA above is only the observed start of this reconciliation.

## Dependency chain

`RU-0 CLOSED -> RU-1 CLOSED -> RU-2 CLOSED -> RU-3/B05 LIVE_STRUCTURAL_PROVEN -> RU-3/B06 LIVE_STRUCTURAL_PROVEN -> D-0140 minimum owner policy canonical docs/staging (NOT ACTIVATED) -> RU-3/B07 PROOF_ONLY -> B07 concurrency proof -> B07 promotion -> RU-4`

RU-3 is **not** closed.

## B05/B06 live network

B05:
- private policy-bundle metadata + rule-reference foundation exists;
- no production bundle/rules were seeded by the migration;
- publication remains fail-closed.

B06:
`DRAFT Zadatak exact revision -> canonical public-content/geography/media fingerprint + private-materiality digest -> current reviewed complete policy bundle + exact rule provenance -> immutable decision record -> production ALLOW disabled -> publish remains closed`

Live invariants preserved at the last proof:
- 0 publication decision rows after B06 live apply;
- RLS enabled on the private decision table;
- anon/authenticated/service_role direct table CRUD denied;
- private fingerprint helper EXECUTE denied to anon/authenticated/service_role;
- service decision writer EXECUTE only for service_role;
- service writer contains `RU3_ALLOW_NOT_ENABLED`;
- authenticated legacy `rpc_publish_need` remains unavailable;
- legacy AI publish contains `PACKAGE_4_NOT_READY`;
- B05 policy tables remained empty after structural migration;
- existing business rows preserved;
- Edge v5 unchanged.

## Minimum D-0140 owner policy now carried in canonical source

Files:

- `docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md`
- `supabase/staging/ru3/rs_publication_policy_minimum_owner_lock_v1.json`

State:

`OWNER_LOCKED_MINIMUM / NOT_PRODUCTION_ACTIVATED`

Key product boundary:

- Marketplace/map/cards = requested **Zadaci** only;
- no provider/service-offer listing inventory;
- worker capabilities belong to **Radni profil**;
- only `ALLOW` may publish;
- `CLARIFY`, `REVIEW`, `BLOCK` remain non-public;
- broader regulated/legal categories are deferred and fail-closed;
- broad earlier 46-rule candidate remains research/proof material, not production authority.

## B07 proof-only network

Branch:

`proof/ru3-b07-canonical-publish-20260904`

Head:

`33d688eb41d081ae1e9491001e16fda1974b5bf4`

Candidate:

`supabase/staging/ru3/20260904111500_clean_ru3_canonical_publish.sql`

Candidate introduces:
- private publish-command idempotency owner;
- authenticated canonical publish RPC;
- exact owner/DRAFT/revision/fingerprint/current-decision/current-reviewed-bundle/rule-provenance checks;
- atomic publish + dispatch;
- no policy seeding and no synthetic `ALLOW` creation.

Proof:
- corrected green runtime proof `33870266770`;
- persistence proof `33870598378`.

Remaining gap:
- true concurrent sessions for same-key/same-payload, same-key/different-payload, and different-key/same-Zadatak publish behavior are not yet proven.

B07 is **NOT canonical and NOT live**.

## Production policy/publication state

No real production Serbia policy bundle is activated from the owner minimum lock. Production admission remains fail-closed. Do not seed fake production `ALLOW` decisions.

Disposable TEST_ONLY fixtures are allowed only in isolated proof environments and must leave zero residue.

## Next allowed action

1. Fresh read-only physical preflight.
2. Reconcile RU-4 implementation/proofs to `RU4_OWNER_LOCK_V1.md`.
3. Preserve pre-Dogovor revision + stale/reconfirmation mechanics.
4. Remove/supersede post-Dogovor parent-Zadatak edit behavior.
5. Prove old Prijave stay non-selectable until each Worker explicitly accepts/revises the exact current revision.
6. Prove first Dogovor locks parent edit, partial capacity stays on unchanged terms, and remaining-search closure does not rewrite historical terms.
7. Keep production policy activation fail-closed.

Principle: **AI agent is replaceable. Canonical project state is not.**
