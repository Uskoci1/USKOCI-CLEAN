<!-- CDL_A01_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A01 AGREEMENT WORKSPACE READS CLOSED / CANONICAL

- canonical code promotion: `5e387aa7890a35d87fcb1844b16f9e4943967595`
- continuity ledger commit after promotion: `fa6ad9685cdaca1d55637ab4a6796230e73b66e0`
- proof branch/head: `proof/client-data-agreement-read-20260905 @ 0b84c3b4f792fe228d263762df9514cc277afa34`
- proof PR: `#4`, squash-promoted only after deletion gates were green
- pre-deletion old-vs-new equivalence: GitHub Actions `33952203946` — PASS
- post-owner migration proof: `33952346007` — PASS
- final physical-deletion proof: `33952603276` — PASS (migration integrity, TypeScript, full regression)
- `mojiDogovori` and `dogovor` now have one canonical production owner: `src/data/agreementClientService.ts`
- exact backend authority remains `rpc_list_my_agreements()` and `rpc_get_agreement_workspace(p_agreement_id)`
- old direct-table Agreement read implementations were physically removed from `src/data/supabaseIzvor.ts`
- `src/data/agreementProductionOverrides.ts` no longer owns Agreement reads; it retains only Agreement mutations
- no Supabase migration/write, Edge change, RU-4/RU-4B semantic change, D0140 activation or monetization change
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- production D0140 publication remains **FAIL_CLOSED**
- exact next cursor: **CDL-A02 — AGREEMENT MUTATION OVERRIDES (`posaljiPoruku`, `predloziIzmenu`, `odgovoriNaIzmenu`) / PROOF-FIRST / NO BACKEND WRITE**

<!-- RU4B_LIVE_FOUNDATION_CHECKPOINT_20260905 -->
## LATEST PHYSICAL CHECKPOINT — RU-4B PRESELECTION Q&A FOUNDATION LIVE / ACTIVATION BLOCKED

This block supersedes older next-cursor text that pointed directly from RU-4 to an unresolved next unit.

- canonical foundation promotion: `240e5b2e06f9bef2d4c4d0c6effb1d971efd55b7`
- proof branch/head: `proof/ru4b-public-preselection-qa-20260905 @ bb3677d8fbb2775ade2d02195769954366fb4e33`
- exhaustive disposable proof: GitHub Actions `33950965667` — PASS (live-68 replay, fail-closed dependency gates, active Worker, owner-only answer, anonymous asker/no identity leak, exact policy/materiality gates, MATERIAL -> RU-4, append-only answer history, edited marker, ignore/report nonpublic, PII floor, idempotency, Inbox events, zero residue, TypeScript, regression)
- clean promotion builder: `33951166457` — PASS
- canonical post-push integrity: `33951231623` — PASS
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migration count: `71`
- live head: `20260905070046_clean_ru4b_inbox_event_contract`
- RU-4B live applies, all exact-byte MD5 mirrors:
  - `20260905070010_clean_ru4b_preselection_qa_foundation` <- source `20260905060000`, MD5 `4f7df9ffed48a9cfd35592706e8175c1`
  - `20260905070029_clean_ru4b_service_boundary` <- source `20260905060100`, MD5 `ee041bed805dbcdc016e8f9e0ab85f74`
  - `20260905070046_clean_ru4b_inbox_event_contract` <- source `20260905060200`, MD5 `9182fb1c347ac1abc889cc6e0554cc2b`
- post-live business rows preserved: `needs=6`, `marketplace_responses=4`, `agreements=2`, `app_profiles=6`
- RU-4B runtime ledgers remain zero: questions `0`, answer versions `0`, policy decisions `0`, materiality decisions `0`, commands `0`
- D-0140 production rows remain zero; production Need publication remains `FAIL_CLOSED`
- service decision/materiality wrappers are service-role only; authenticated/anon cannot execute the service policy writer
- Inbox event contract now admits `CLARIFICATION_CREATED`, `CLARIFICATION_ANSWERED` and entity `CLARIFICATION` while preserving all prior event/entity values
- public Q&A activation remains intentionally blocked. Missing governed dependencies: account-block authority, owner-approved numeric Q&A rate policy, reviewed/current PRESELECTION_QA production ALLOW policy and production-trusted materiality authority.
- no placeholder ALLOW, rate number or block behavior was invented.
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**.
- RU-4B verdict: **LIVE_FOUNDATION / ACTIVATION_BLOCKED / NOT CLOSED AS USER-FACING FEATURE**.
- planned next engineering track after this reconciled checkpoint: **CLIENT DATA LAYER CONSOLIDATION / OVERRIDES ELIMINATION**, in a fresh chat, with no behavior reinterpretation and no big-bang rewrite.

<!-- RU4_LIVE_CHECKPOINT_20260905 -->
## LATEST PHYSICAL CHECKPOINT — RU-4 OWNER EDIT LOCK LIVE / RECONCILED

This block supersedes all older RU-4 target/proof-only/no-live cursor text below.

- functional canonical source promotion: `a271d6084b4648e757d2230d0a208f558c802a14`
- exact clean production proof: GitHub Actions `33946688625` — PASS (live-63 replay, owner edit authority, stale/reconfirm, first-Dogovor lock, close remaining search, AI authority, true concurrency, zero residue, D0140 fail-closed, TypeScript, regression)
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migration count: `68`
- live head: `20260905052713_clean_ru4_ai_edit_replay_boundary`
- RU-4 live applies:
  - `20260905052130_clean_ru4_owner_edit_lock` <- canonical `20260904214500_clean_ru4_owner_edit_lock.sql` (MD5 exact)
  - `20260905052224_clean_ru4_close_remaining_search` <- canonical `20260904223000_clean_ru4_close_remaining_search.sql` (MD5 exact)
  - `20260905052336_clean_ru4_ai_edit_conversation` <- canonical source had one live-transport identifier deviation; historical live migration preserved
  - `20260905052651_clean_ru4_ai_edit_conversation_live_transfer_reconcile` <- canonical `20260904230200_clean_ru4_ai_edit_conversation_live_transfer_reconcile.sql`, forward-only reconciliation, proof `33947156991` PASS, MD5 exact
  - `20260905052713_clean_ru4_ai_edit_replay_boundary` <- canonical `20260904230500_clean_ru4_ai_edit_replay_boundary.sql` (MD5 exact)
- post-live structural/auth proof: PASS
- business rows preserved: `needs=6`, `marketplace_responses=4`, `agreements=2`, `app_profiles=6`
- RU-4 command/revision ledgers after deployment: all `0`
- D-0140 production rows: policy bundles `0`, policy rule refs `0`, publication decisions `0`; production publication remains `FAIL_CLOSED`
- authenticated owner boundaries are exposed only where intended; anon is denied; inner AI writer is not authenticated-executable and replay-safe v2 wrapper is the public authenticated boundary
- owner contract now live: edit only before first Dogovor; explicit confirmation -> next DRAFT revision; old unselected Prijave -> `STALE_REVIEW_REQUIRED`; explicit KEEP/UPDATE/WITHDRAW; no auto-republish; first Dogovor permanently locks ordinary parent-Zadatak edit; `Ne traži više nikoga` closes remaining search without rewriting terms
- RU-4 verdict: **CLOSED / LIVE_STRUCTURAL_PROVEN / DO NOT REDO**
- exact next cursor: fresh physical preflight from live `68 / 20260905052713`; resolve the next implementation unit from the governing master/current network; keep D-0140 production policy activation deferred/fail-closed.

<!-- RU4_OWNER_LOCK_20260904 -->
## LATEST OWNER PRODUCT LOCK — RU-4 V1 ZADATAK EDIT

This block supersedes older RU-4/COV-028 interpretations wherever they allowed parent-Zadatak content editing after the first Dogovor.

Canonical owner-lock document:

`docs/implementation/ru4/RU4_OWNER_LOCK_V1.md`

Current V1 rule:

- Zadatak may be edited only while no Dogovor has ever been formed from it.
- Before first Dogovor, a confirmed content/terms edit creates a new revision; every existing unselected Prijava becomes `STALE_REVIEW_REQUIRED`, disappears from the current selectable candidate set, and returns only after that worker explicitly accepts the changed Zadatak revision or submits a revised Prijava.
- Old Prijave are preserved as history; they are not silently deleted or silently reconfirmed.
- Once the first Dogovor is formed, ordinary `Izmeni Zadatak` is locked for V1 permanently for that Zadatak, including after later cancellation/replacement.
- Partial coverage stays on the same locked terms, e.g. `Dogovoreno 2/3 · traži se još 1`.
- `Ne traži više nikoga` is a lifecycle/coverage close action, not a rewrite of historical Zadatak terms.
- Materially different remaining work becomes a new Zadatak; changes affecting already-selected participants go through the governed Dogovor-change path.
- Existing `proof/ru4-material-revision-20260904` work is proof history only until reconciled to this new lock; do not promote its older post-Dogovor edit semantics.

Exact next cursor: rebuild/reconcile RU-4 proof to this owner lock, preserving useful pre-Dogovor revision + stale/reconfirm mechanics and removing post-Dogovor parent-edit behavior.

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
