<!-- CDL_A09_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A09 WORKER PROFILE MUTATION CLOSED / CANONICAL

This block supersedes CDL-A08/A07 next-cursor text for the consolidation track.

- canonical code promotion: `ccdc5d75a9dcd11afc817f59905cb32f44579022`
- proof branch/head: `proof/client-data-worker-profile-20260905 @ ca941c4e9a6c7bb4885fb99d56860dbcbe03ea20`
- pre-deletion equivalence run: `33962358107` — PASS
- final post-deletion run: `33962499445` — PASS
- canonical Worker profile mutation owner: `src/data/workerProfileClientService.ts`
- method now owned there: `azurirajRadnikProfil`
- active auth/profile read/create/update behavior is preserved exactly
- new Worker profiles remain DRAFT; completion authority remains `rpc_complete_worker_profile(p_profile_id)` with the actual profile id
- old active duplicate is physically removed from `productionAuthorityOverrides.ts`
- stale lower-precedence mutation is physically removed from `supabaseIzvor.ts`, including its broken no-id activation RPC call
- Worker profile read projection and AI paths were not changed
- no backend migration or Edge deployment occurred in CDL-A09
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **fresh post-A09 shadow inventory; stop cleanup unless another comparable high-risk production shadow remains; otherwise return to governing MASTER implementation track**

<!-- CDL_A08_CANONICAL_CHECKPOINT_20260905 -->
## CLIENT DATA LAYER CHECKPOINT — CDL-A08 EXACT-LOCATION REVEAL CLOSED / CANONICAL

- canonical code promotion: `5997459306165e9e79fb8a6dff1ebce015904c86`
- proof branch/head: `proof/client-data-exact-location-20260905 @ f940ffb55c8ebc7316fe74e1963c2d9dd1586bfc`
- pre-deletion equivalence run: `33961961032` — PASS
- final post-deletion run: `33962093949` — PASS
- canonical contact/privacy owner: `src/data/contactClientService.ts`
- method added there: `otkrijTacnuLokaciju`
- exact authority remains `rpc_reveal_contact(p_agreement_id, p_channel='EXACT_LOCATION')`
- dead `rpc_r24_reveal_exact_location` path and fake generic address are physically removed
- no backend migration or Edge deployment occurred in CDL-A08

<!-- CDL_A07_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A07 AGREEMENT COMPLETION MARK CLOSED / CANONICAL

This block supersedes CDL-A06 next-cursor text for the consolidation track.

- canonical code promotion: `fb59f44e4af3a2a9fce36b4ecdb910c790ff51d8`
- proof branch/head: `proof/client-data-completion-mark-20260905 @ 43e7c95c790423a21876bd5bbff9de65dfb74c6f`
- pre-deletion equivalence run: `33961448582` — PASS
- final post-deletion run: `33961594981` — PASS
- canonical Agreement owner: `src/data/agreementClientService.ts`
- method now owned there: `oznaciZavrsetak`
- exact backend authority remains `rpc_mark_work_done(p_agreement_id)`
- server-returned requester deadline remains authoritative and is returned unchanged to the client
- stale lower-precedence local `new Date().toISOString()` deadline path is physically removed from `supabaseIzvor.ts`
- duplicate active implementation is physically removed from `productionAuthorityOverrides.ts`
- `potvrdiZavrsetak`, exact-location, worker-profile and AI paths were not changed
- no backend migration or Edge deployment occurred in CDL-A07
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **fresh post-A07 shadow inventory, then select CDL-A08 only if a high-value risk remains**

<!-- CDL_A06_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A06 AGREEMENT PROBLEM REPORT CLOSED / CANONICAL

This block supersedes CDL-A05 next-cursor text for the consolidation track.

- canonical code promotion: `ff052c43cd26841f396f86942594163b9f08b1b7`
- proof branch/head: `proof/client-data-problem-report-20260905 @ 9952ab02d8b53d244e2501b4b7f1de6d41098bd2`
- pre-deletion equivalence run: `33959818756` — PASS
- final post-deletion run: `33959946664` — PASS
- canonical Agreement owner: `src/data/agreementClientService.ts`
- method now owned there: `prijaviProblem`
- exact backend authority remains `rpc_report_problem(p_agreement_id, p_narrative)`
- exact trim + blank `NARRATIVE_REQUIRED` validation remains unchanged
- stale lower-precedence `p_description` path is physically removed from `supabaseIzvor.ts`
- duplicate active implementation is physically removed from `productionAuthorityOverrides.ts`
- completion, exact-location, worker-profile and AI paths were not changed
- no backend migration or Edge deployment occurred in CDL-A06
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **fresh post-A06 shadow inventory, then select CDL-A07 by lowest-risk high-value slice**

<!-- CDL_A05_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A05 PHONE GRANTS CLOSED / CANONICAL

This block supersedes CDL-A04 next-cursor text for the consolidation track.

- canonical code promotion: `d14ee1c9e451c6a462b174082e1b06a0fde35a88`
- proof branch/head: `proof/client-data-phone-grants-20260905 @ f95631d4d45f803efc70e098f922238d13b42fb4`
- pre-deletion equivalence run: `33957532925` — PASS
- final post-deletion run: `33957660880` — PASS
- canonical contact client owner: `src/data/contactClientService.ts`
- methods now owned there: `podeliTelefon`, `opoziviTelefon`
- exact backend authority remains `rpc_set_contact_grant(p_agreement_id, p_channel='PHONE', p_granted)`
- fake-success/no-op legacy methods are physically removed from `supabaseIzvor.ts`
- duplicate active methods are physically removed from `productionAuthorityOverrides.ts`
- exact-location path was not changed in CDL-A05
- no backend migration or Edge deployment occurred in CDL-A05
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **fresh post-A05 shadow inventory, then select CDL-A06 by lowest-risk proven slice**

<!-- CDL_A04_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A04 RESPONSE VIEWED CLOSED / CANONICAL

This block supersedes CDL-A03 next-cursor text for the consolidation track.

- canonical code promotion: `36eaeefb5c053df051cfed445e106ca0663e36cc`
- proof branch/head: `proof/client-data-response-viewed-20260905 @ ecf7e7709c05d41481a9cc674a2b58042fedf1fa`
- pre-deletion equivalence run: `33956936388` — PASS
- final post-deletion run: `33957121385` — PASS
- canonical response command owner: `src/data/responseClientService.ts`
- method now owned there: `oznaciPrijavuVidjenom`
- exact backend authority remains `rpc_mark_response_viewed(p_response_id)`
- fake-success/no-op legacy method is physically removed from `supabaseIzvor.ts`
- duplicate active implementation is physically removed from `productionAuthorityOverrides.ts`
- no backend migration or Edge deployment occurred in CDL-A04
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **fresh post-A04 shadow inventory, then select CDL-A05 by lowest-risk proven slice**

<!-- CDL_A03_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A03 NEED READS CLOSED / CANONICAL

This block supersedes CDL-A02 next-cursor text for the consolidation track.

- canonical code promotion: `76b34791d4f372e2d0613377274f7b1038b82e9f`
- proof branch/head: `proof/client-data-need-reads-20260905 @ 0aeed66de8cb7b16b0a527fbf3ccad56ac985383`
- pre-deletion equivalence run: `33954247260` — PASS
- final post-deletion run: `33954495080` — PASS
- canonical Need client owner: `src/data/needClientService.ts`
- methods now owned there: `mojePotrebe`, `potreba`
- live database authority remains in `public.needs` RLS SELECT policies; no client authority gain
- old `needProductionOverrides` layer is physically gone and legacy Need reads are physically removed from `supabaseIzvor.ts`
- auth/error/query/mapping behavior preserved exactly; fail-loud backend and unsupported-status behavior retained
- no backend migration or Edge deployment occurred in CDL-A03
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **fresh post-A03 shadow inventory, then select CDL-A04 by lowest-risk proven slice**

<!-- CDL_A02_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A02 AGREEMENT MUTATIONS CLOSED / CANONICAL

This block supersedes CDL-A01 next-cursor text for the consolidation track.

- canonical code promotion: `603617d46059331641f445f32e515551a79da474`
- proof branch/head: `proof/client-data-agreement-mutations-20260905 @ de8d4af7f7fbe4c1cda1e02911ec0fe2436fab94`
- pre-deletion equivalence run: `33953071145` — PASS
- final post-deletion run: `33953836136` — PASS
- canonical Agreement client owner: `src/data/agreementClientService.ts`
- methods now owned there: `mojiDogovori`, `dogovor`, `posaljiPoruku`, `predloziIzmenu`, `odgovoriNaIzmenu`
- exact mutation authority remains `rpc_send_agreement_message`, `rpc_propose_agreement_change_v2`, `rpc_respond_agreement_change`
- `agreementProductionOverrides.ts` is physically deleted
- duplicate Agreement mutations are physically removed from `productionAuthorityOverrides.ts` and `supabaseIzvor.ts`
- no backend migration or Edge deployment occurred in CDL-A02
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **CDL-A03 — Need reads: `mojePotrebe`, `potreba`; equivalence-first, no backend write**

<!-- CDL_A01_CANONICAL_CHECKPOINT_20260905 -->
## LATEST CLIENT DATA LAYER CHECKPOINT — CDL-A01 AGREEMENT WORKSPACE READS CLOSED / CANONICAL

This block supersedes older generic next-track text for client data-layer consolidation.

- canonical code promotion: `5e387aa7890a35d87fcb1844b16f9e4943967595`
- proof branch/head: `proof/client-data-agreement-read-20260905 @ 0b84c3b4f792fe228d263762df9514cc277afa34`
- proof PR: `#4`, squash-promoted after all deletion gates were green
- pre-deletion equivalence run: `33952203946` — PASS
- post-owner run: `33952346007` — PASS
- final physical-deletion run: `33952603276` — PASS
- canonical read owner: `src/data/agreementClientService.ts`
- methods: `mojiDogovori`, `dogovor`
- backend authority preserved exactly: `rpc_list_my_agreements()` + `rpc_get_agreement_workspace(p_agreement_id)`
- shadowed direct-table Agreement reads are physically removed from `src/data/supabaseIzvor.ts`
- `agreementProductionOverrides` now retains Agreement mutations only
- production composition has one owner for these reads; no spread-shadow winner remains for them
- no backend migration or Edge deployment occurred in CDL-A01
- live Supabase remains `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- RU-4 remains **CLOSED / LIVE / DO NOT REDO**
- RU-4B remains **LIVE_FOUNDATION / ACTIVATION_BLOCKED**
- D0140 production publication remains **FAIL_CLOSED**
- exact next cursor: **CDL-A02 — Agreement mutations: `posaljiPoruku`, `predloziIzmenu`, `odgovoriNaIzmenu`; proof-first, no backend write**

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