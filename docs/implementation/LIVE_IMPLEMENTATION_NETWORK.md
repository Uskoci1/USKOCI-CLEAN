<!-- P0D03_REQUESTER_CONNECTION_ACTIVATION_V1_LIVE_CLOSURE_20260906 -->
## LATEST NETWORK CHECKPOINT — P0D-03 REQUESTER CONNECTION ACTIVATION V1 LIVE

This block supersedes older next-cursor text below for current physical state; all older checkpoint blocks remain historical evidence.

- frozen authority: `P0D-03 — requester_connection_activation_v1`
- final implementation/proof head: `01b514289091ad9c9ced7d1d5ed4598eaa2994c5`
- exact-head proof: `34026655155` PASS
- earlier locked proof: `06c60587b6af992d987052a4373f1cc8294df969` / `34026374264` / artifact `9987204281`
- implementation PR #28 PRE-P4 / CodeQL: `34026813290` / `34026811947` PASS
- canonical implementation merge: `e9d9fd065b0ea895dc37a32bc1707167cd3ed5ec`
- canonical PRE-P4 / CodeQL / Control-0: `34026900540` / `34026900127` / `34026900533` PASS
- live Supabase: `78 / 20260906102021_clean_p0d03_requester_connection_activation_v1`
- canonical migration: `20260906100000_clean_p0d03_requester_connection_activation_v1.sql` / `e6fb0cb596b51587958b92d08b36ce98` / `25525` bytes
- live recorded statement: `c77a5d4c6efec10c928f38c0542e593e` / `25524` bytes / terminal LF absent
- normalized transport proof: appending exactly one terminal LF yields canonical MD5 `e6fb0cb596b51587958b92d08b36ce98` and `25525` bytes; no semantic drift and no repair migration required
- live Selection/Candidate definition MD5s: `4c2b68cdee2fe66facf7fe1c46cef43f` / `1978ce1d5852cef46f94e81468d37bba`
- Povezivanje V1 policy: `REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`
- private connection policy/activation tables: RLS ON; activation rows `0`; no historical Povezivanje fabricated; anon/authenticated/service_role direct activation-ledger SELECT denied
- business/history unchanged: profiles `6`; needs `6`; responses `4`; selections `2`; agreements `2`
- D0140 production ALLOW remains fail-closed with policy bundles `0`; RU-4B remains activation-blocked; paid/wallet/checkout absent; Worker debit absent; Application AI gated
- verdict before this closure PR is canonical: **P0D-03 = CANONICAL / LIVE / POSTFLIGHT PROVEN / FORMAL CLOSURE PENDING**
- verdict after this closure payload is merged and canonical push gates pass: **P0D-03 = CLOSED / CANONICAL / LIVE / DO NOT REDO**
- next cursor after closure: fresh frozen-plan + current Agreement/calendar reconciliation; do not invent a new unit and do not interpret narrow P0D-03 activation as shared Dogovor or paid monetization

<!-- P0D02_SELECTION_SEMANTIC_IDEMPOTENCY_LIVE_CLOSURE_20260906 -->
## PREDECESSOR NETWORK CHECKPOINT — P0D-02 SELECTION SEMANTIC IDEMPOTENCY LIVE

- frozen authority: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip` / `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- exact proof: `c3ada4219b9c8427be0c7b35bc36afa30b4302cc` / `34023168764` PASS
- implementation PR #26 PRE-P4 / CodeQL: `34023318196` / `34023316595` PASS
- canonical implementation merge: `5faa7b5442d26b2c2d3ece3ed1b48b39a37d00d9`
- canonical PRE-P4 / CodeQL / Control-0: `34023411493` / `34023410485` / `34023411602` PASS
- live Supabase at that checkpoint: `77 / 20260906090451_clean_p0d02_selection_semantic_idempotency`
- canonical migration: `20260906080000_clean_p0d02_selection_semantic_idempotency.sql` / `065a6a172f1cea50b99c57f6759ef109` / `15516` bytes
- live recorded statement: `c267357c43e2c18448b46268ae458085` / `15513` bytes
- transport deviation: exactly three LF bytes omitted; whitespace-stripped MD5 `3433be65f949407f62f751dbf5b57a9d` identical canonical/live
- live Selection/Candidate definition MD5s at that checkpoint: `b1ca0a03ee075565c71b50f00d61dade` / `1978ce1d5852cef46f94e81468d37bba`
- verdict: **P0D-02 = CLOSED / CANONICAL / LIVE / DO NOT REDO**

<!-- RU5_SELECTION_ELIGIBILITY_LIVE_CLOSURE_20260906 -->
## PREDECESSOR NETWORK CHECKPOINT — RU-5 MANUAL SELECTION ELIGIBILITY REVALIDATION LIVE

- governing frozen package: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`
- governing SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- canonical repository/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`
- proof head/run: `d71c6e08b518e2955020c21538c1238358b14df3` / `34017442269` PASS
- canonical implementation merge: `c0dd1434c436578e0f517520a2156b72ec5d3eaa`
- live at that checkpoint: `76 / 20260906065758_clean_ru5_selection_eligibility_revalidation`
- source MD5/bytes exact: `6ddb7d5d141e7cb3a454fa7e6ca1280d` / `17954`
- Selection/Candidate MD5s: `ea1c1c40783dbfb9eeab527c128f9dd0` / `1978ce1d5852cef46f94e81468d37bba`
- verdict: **RU-5 MANUAL SELECTION ELIGIBILITY REVALIDATION = CLOSED / LIVE / DO NOT REDO**

<!-- CDL_CLOSURE_MASTER_READMISSION_20260905 -->
## HISTORICAL NETWORK CHECKPOINT — CDL CLOSED / RU-5 ADMITTED

- canonical pre-doc reconciliation after A12: `40afb2ed654c9987f82e7cd3c120a5b60ccbcf11`
- governing master re-verified: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip` / SHA-256 `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- live Supabase at that checkpoint: `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- Edge: `uskoci-ai-interview` ACTIVE v5 / `verify_jwt=true` / EZBR `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`
- CDL-A11 canonical promotion: `1be672dc649fee102a66c826c86b0e5609a43315`; proofs `33966439120` + `33966556555` PASS; `aiProductionOverrides` sole owner of `otvoriRazgovor` + `razgovor`; stale `NEW_NEED` + null-read shadows deleted
- CDL-A12 canonical promotion: `40afb2ed654c9987f82e7cd3c120a5b60ccbcf11`; proofs `33967095683`, `33967215611`, exact final merge candidate `33967294217` PASS; `productionAuthorityOverrides` sole owner of legacy fail-closed `objaviPotrebu`; stale lower incomplete-parameter shadow deleted
- Client Data Layer Consolidation / Overrides Elimination: **CLOSED / CANONICAL**; no CDL-A13

<!-- CDL_A10_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A10 AI COMMAND SHADOW ELIMINATION CLOSED / CANONICAL

- pre-change canonical SHA: `11deb70fe8ebd92e7ebf0e9bbea4f20a90504db2`
- canonical code promotion: `24a08d6c6d90daa1dd88217ea4a4d0f82a5eaf5d`
- proof branch/head: `proof/client-data-ai-command-shadow-20260905 @ e85017b31c9f798829e00239242c4ed1ffb1e86c`
- pre-deletion equivalence run: `33965614404` — PASS
- final post-deletion run: `33965807723` — PASS
- canonical AI command owner: `src/data/aiCommandOverrides.ts`
- methods solely owned there: `posaljiKorisnikovuPoruku`, `ispraviCinjenicu`
- no backend migration or Edge deployment occurred in CDL-A10

<!-- CDL_A09_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A09 WORKER PROFILE MUTATION CLOSED / CANONICAL

- canonical code promotion: `ccdc5d75a9dcd11afc817f59905cb32f44579022`
- proof branch/head: `proof/client-data-worker-profile-20260905 @ ca941c4e9a6c7bb4885fb99d56860dbcbe03ea20`
- pre-deletion equivalence run: `33962358107` — PASS
- final post-deletion run: `33962499445` — PASS
- canonical Worker profile mutation owner: `src/data/workerProfileClientService.ts`
- no backend migration or Edge deployment occurred in CDL-A09

<!-- CDL_A08_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A08 EXACT-LOCATION REVEAL CLOSED / CANONICAL

- canonical code promotion: `5997459306165e9e79fb8a6dff1ebce015904c86`
- proof branch/head: `proof/client-data-exact-location-20260905 @ f940ffb55c8ebc7316fe74e1963c2d9dd1586bfc`
- pre-deletion equivalence run: `33961961032` — PASS
- final post-deletion run: `33962093949` — PASS
- canonical contact/privacy owner: `src/data/contactClientService.ts`
- exact authority remains `rpc_reveal_contact(p_agreement_id, p_channel='EXACT_LOCATION')`

<!-- CDL_A07_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A07 AGREEMENT COMPLETION MARK CLOSED / CANONICAL

- canonical code promotion: `fb59f44e4af3a2a9fce36b4ecdb910c790ff51d8`
- proof branch/head: `proof/client-data-completion-mark-20260905 @ 43e7c95c790423a21876bd5bbff9de65dfb74c6f`
- pre-deletion equivalence run: `33961448582` — PASS
- final post-deletion run: `33961594981` — PASS
- canonical Agreement owner: `src/data/agreementClientService.ts`
- exact backend authority remains `rpc_mark_work_done(p_agreement_id)`

<!-- CDL_A06_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A06 AGREEMENT PROBLEM REPORT CLOSED / CANONICAL

- canonical code promotion: `ff052c43cd26841f396f86942594163b9f08b1b7`
- proof branch/head: `proof/client-data-problem-report-20260905 @ 9952ab02d8b53d244e2501b4b7f1de6d41098bd2`
- pre-deletion equivalence run: `33959818756` — PASS
- final post-deletion run: `33959946664` — PASS
- canonical Agreement owner: `src/data/agreementClientService.ts`
- exact backend authority remains `rpc_report_problem(p_agreement_id, p_narrative)`

<!-- CDL_A05_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A05 PHONE GRANTS CLOSED / CANONICAL

- canonical code promotion: `d14ee1c9e451c6a462b174082e1b06a0fde35a88`
- proof branch/head: `proof/client-data-phone-grants-20260905 @ f95631d4d45f803efc70e098f922238d13b42fb4`
- pre-deletion equivalence run: `33957532925` — PASS
- final post-deletion run: `33957660880` — PASS
- canonical contact client owner: `src/data/contactClientService.ts`
- exact backend authority remains `rpc_set_contact_grant(p_agreement_id, p_channel='PHONE', p_granted)`

<!-- CDL_A04_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A04 RESPONSE VIEWED CLOSED / CANONICAL

- canonical code promotion: `36eaeefb5c053df051cfed445e106ca0663e36cc`
- proof branch/head: `proof/client-data-response-viewed-20260905 @ ecf7e7709c05d41481a9cc674a2b58042fedf1fa`
- pre-deletion equivalence run: `33956936388` — PASS
- final post-deletion run: `33957121385` — PASS
- canonical response command owner: `src/data/responseClientService.ts`
- exact backend authority remains `rpc_mark_response_viewed(p_response_id)`

<!-- CDL_A03_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A03 NEED READS CLOSED / CANONICAL

- canonical code promotion: `76b34791d4f372e2d0613377274f7b1038b82e9f`
- proof branch/head: `proof/client-data-need-reads-20260905 @ 0aeed66de8cb7b16b0a527fbf3ccad56ac985383`
- pre-deletion equivalence run: `33954247260` — PASS
- final post-deletion run: `33954495080` — PASS
- canonical Need client owner: `src/data/needClientService.ts`

<!-- CDL_A02_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A02 AGREEMENT MUTATIONS CLOSED / CANONICAL

- canonical code promotion: `603617d46059331641f445f32e515551a79da474`
- proof branch/head: `proof/client-data-agreement-mutations-20260905 @ de8d4af7f7fbe4c1cda1e02911ec0fe2436fab94`
- pre-deletion equivalence run: `33953071145` — PASS
- final post-deletion run: `33953836136` — PASS
- canonical Agreement client owner: `src/data/agreementClientService.ts`

<!-- CDL_A01_CANONICAL_CHECKPOINT_20260905 -->
## HISTORICAL CLIENT DATA LAYER CHECKPOINT — CDL-A01 AGREEMENT WORKSPACE READS CLOSED / CANONICAL

- canonical code promotion: `5e387aa7890a35d87fcb1844b16f9e4943967595`
- proof branch/head: `proof/client-data-agreement-read-20260905 @ 0b84c3b4f792fe228d263762df9514cc277afa34`
- proof PR: `#4`
- pre-deletion equivalence run: `33952203946` — PASS
- post-owner run: `33952346007` — PASS
- final physical-deletion run: `33952603276` — PASS
- canonical read owner: `src/data/agreementClientService.ts`

<!-- RU4B_LIVE_FOUNDATION_CHECKPOINT_20260905 -->
## HISTORICAL PHYSICAL CHECKPOINT — RU-4B PRESELECTION Q&A FOUNDATION LIVE / ACTIVATION BLOCKED

- canonical foundation promotion: `240e5b2e06f9bef2d4c4d0c6effb1d971efd55b7`
- proof branch/head: `proof/ru4b-public-preselection-qa-20260905 @ bb3677d8fbb2775ade2d02195769954366fb4e33`
- exhaustive disposable proof: `33950965667` PASS
- clean promotion builder: `33951166457` PASS
- canonical post-push integrity: `33951231623` PASS
- live at that checkpoint: `71 / 20260905070046_clean_ru4b_inbox_event_contract`
- public Q&A activation remained intentionally blocked; no placeholder ALLOW/rate/block behavior was invented
- RU-4 remained **CLOSED / LIVE / DO NOT REDO**

<!-- RU4_LIVE_CHECKPOINT_20260905 -->
## HISTORICAL PHYSICAL CHECKPOINT — RU-4 OWNER EDIT LOCK LIVE / RECONCILED

- functional canonical source promotion: `a271d6084b4648e757d2230d0a208f558c802a14`
- exact clean production proof: `33946688625` PASS
- live transfer reconciliation proof: `33947156991` PASS
- live at that checkpoint: `68 / 20260905052713_clean_ru4_ai_edit_replay_boundary`
- business rows preserved and D0140 remained fail-closed
- RU-4 verdict: **CLOSED / LIVE_STRUCTURAL_PROVEN / DO NOT REDO**

<!-- RU4_OWNER_LOCK_20260904 -->
## HISTORICAL RU-4 OWNER LOCK — PRODUCT TARGET

Canonical decision: `docs/implementation/ru4/RU4_OWNER_LOCK_V1.md`.

Target network:

`no Dogovor yet -> owner may edit -> confirmed content/terms change creates new Need revision -> all old unselected Prijave = STALE_REVIEW_REQUIRED/non-selectable -> each Worker must explicitly accept/revise/withdraw -> accepted/rebased Prijava may become current again`

`first Dogovor formed -> parent Zadatak content edit LOCKED for V1 -> remaining capacity continues on same terms -> Ne traži više nikoga may close remaining search -> different remaining terms require a new Zadatak -> already-selected participant term changes go through Dogovor change`

<!-- RU3_B07_LIVE_CHECKPOINT_20260904 -->
## HISTORICAL PHYSICAL CHECKPOINT — RU-3/B07 LIVE

- canonical source promotion: `d2c077d90c6410dc0737916df13b257389c6cb3b`
- B07 source: `supabase/migrations/20260904111500_clean_ru3_canonical_publish.sql` (`17468983d28cddfe4948c3866a96e813` raw MD5)
- true concurrency/idempotency proof: `33903129202` PASS
- clean promotion integrity: `33905242409` PASS
- canonical push integrity: `33905436213` PASS
- live at that checkpoint: `63 / 20260904182402_clean_ru3_canonical_publish`
- production publication remained fail-closed

# USKOČI — LIVE IMPLEMENTATION NETWORK — HISTORICAL BASELINE

The following baseline is retained as historical provenance and must not override newer checkpoint blocks above.

## Governing master

`USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`

SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`

## Historical canonical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Supabase: `leqcwgzvjsxugfgzdmth`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

Principle: **AI agent is replaceable. Canonical project state is not.**
