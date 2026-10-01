# B09 / PKG-049 price authority: characterization proof (no server change)

Owner decision 2026-10-01: server price authority in V1, but do not apply PKG-049 on the old text. Finding: the authority is already live for MY_PRICE
(`private.assert_application_price_v5`, md5 `bd7ef029`, since ledger 189). This folder is the evidence refresh, not a candidate. Workflow: `.github/workflows/pkg049-price-authority-characterization.yml`.
Round 2 (after the three-lens review R1): every finding is dispositioned in `B09_REVIEW_DISPOSITION_R1.md`. Round 3 (after review R2, 24 findings): `B09_REVIEW_DISPOSITION_R2.md`.

**Evidence honesty.** Nothing in this folder had run against a database when it was written: the unit tests run offline (`node --test supabase/proofs/pkg049/*.test.mjs`, 40 tests, including dry runs of the P0 stage loop, of P4(h) and of the P1b phase against the real supabase-js client with a mock fetch: they prove the code, not the database), the proof itself needs the
disposable chain, so the first CI run is the first observation of every database and HTTP assertion. A green run is evidence about the disposable CHAIN. It is never evidence about DEV.

**Read the label first.** The pin gate compares the md5 of every pinned price-chain body (12 functions: 8 core, 4 adjacent) on the chain with the 2026-10-01 DEV readback.
`PRICE-CHAIN BODIES == DEV (12/12 pinned bodies; the chain is NOT DEV)` means ONLY that those function bodies are byte-equal. It does not say the chain is DEV: the chain lacks pkg051a, A1/P0/P4/P5/B3a-c,
PKG-045b P0 (the needs column ACL), P6 rollout v3, B24 Part 1 (except the two converted bodies) and Part 2, Voice B1 and EX-04A-C, and its certificate is chain-internal. Every pass line starts with the short label
(`PASS [<label>] <name>`), the P0 and P1 pass names and the markdown header name what the chain lacks. When a body differs, the label separates the CORE price chain from the adjacent pins, e.g.
`CORE price chain 7/8 equal (stale_resolver PRE_B24); adjacent 3/4 equal (confirm_need_edit PRE_B24)`. The gate FAILS the run when a core pin is missing or differs without an explanation, when the helper vocabulary
(message, SQLSTATE) or its raise count (7, every raise statement parsed in any layout) differs, or when a `need_candidate_states_v5` swallow list (parsed from the handler) has a gap. `rpc_read_task` is pinned (adjacent).

**Result.** `PASS` only when nothing designed to be demonstrated was left out. `PASS_WITH_GAPS` lists the gaps in the markdown and the workflow summary (today's only gap: PT409 / HTTP 409 when the stale resolver is not the DEV body).
Structural limits of the chain are in "Not verified", not in the gaps.

**Proven (on the disposable chain, actual Auth + PostgREST, real JWTs, real client TypeScript)**
- P0 people and historical applications and Agreements are created through the real Auth path and RPCs BEFORE any chain stage and BEFORE the neutrality snapshot; then the exact EX-04D candidate text is applied (the second
  `need_candidate_states_v5` overload and the page reader are mandatory) and exactly two PRE_B24 price-chain bodies are converted, ONE TRANSACTION EACH, with B24 Part 1's own mechanics (stale resolver `d37c4f7c` -> DEV `96cb9aac`,
  `rpc_confirm_need_edit` `dfa1a809` -> DEV `450b6f8d`) after measuring that the converted md5 equals the DEV md5. Only the four documented chain-drift guards are tolerated (and not on a body that was the known pre-image); any other
  failure of the stage fails the run. The derivation is also proved offline from the repository sources (`pkg049_pins.test.mjs`).
- P1 pins, helper vocabulary and raise count, swallow lists and authority (anon none, helper not callable).
- P1b DIRECT PostgREST TABLE WRITES as a modified client (price integrity is claimed to be RPC-only): 18 attacks (worker: update, insert, delete on the response head and version tables; requester: update, insert, delete on
  `agreements`, `agreement_versions`, `need_selections`; requester: update of `requester_price_rsd` and of `price_basis` and delete on a PUBLISHED task that has an application) each give the pinned outcome (`permission denied` 42501 / HTTP 403,
  an RLS-filtered empty representation, or `new row violates row-level security policy` 42501 / 403) and leave the stored price surface byte-identical; a positive control (an owner PATCH of a DRAFT task writes) shows the empty
  representations are the policy and not a broken request; read controls show the same people can read what they cannot write. The expected outcome of every attack is derived from the migration sources by a unit test
  (grants, RLS, policies). The needs rows are chain-specific: the chain has table-level privileges on `public.needs`, DEV has the PKG-045b P0 column privileges, which are not observed.
- P2 modified-client matrix (model in `pkg049_lib.mjs`): 11 task shapes, 21 covered cases, 142 refusals (exact message, SQLSTATE, HTTP 400, DETAIL, nothing written) and 23 amounts stored verbatim with a hash that
  binds them and the exact eleven-key success receipt; capacity checks (remaining, covered slots, team capacity with its DETAIL `covered=3,teamCapacity=1`) precede the price; exact outcomes for the anonymous caller, a foreign profile and an amount above int4.
- P3 replay precedes the price check; a refused key is reusable; a double tap gives one version. P4 stale KEEP/UPDATE are judged against the CURRENT task (exact refusals, still stale, nothing written, capacity before
  price, through the real `ru4Production.resolveChangedApplication` too); whenever the stale resolver IS the DEV body (read from the catalog) a stale version or revision answers HTTP 409 (PT409) at once.
- P5 selection has no price argument, copies the stored version price, has exactly one activation row per Agreement (platform cost 0 is that table's own CHECK, not the price rule), refuses a second selection with the PINNED message and
  DETAIL per scenario, is bound to the pinned (revision, version, content hash) (each forged attempt is refused by its OWN guard, told apart by the DETAIL: `content_hash` x2, `response_version`, `need_revision`),
  re-asserts the rule against the CURRENT task (both candidate readers say STALE, `rpc_read_task` shows the computed count follow), and two partial applications on one task each become their own Agreement at their own price.
- P6 the real client services: the task as the applicant's app decodes it (`needClientService.potreba` over `rpc_read_task`), the composed price, submit, every readback, and the refusals against the LITERAL Serbian sentences.
- P7 Agreement change CHARACTERISED as today (any whole number 1..2147483647 by consent, accept carries no amount, readbacks incl. the agreements page reader show the last accepted amount, the offer card keeps the application
  price: ASSERTED, with the key and the integer checked): **OPEN OWNER DECISION D3**.
- P8 non-vacuity: six weakening probes (the helper, and each of the five doors including BOTH candidate readers); a probe is detected only when each primary door is OBSERVED to give the outcome the weakened rule gives
  (corroborated by the database), a single-door probe leaves the other doors holding, a probe that cannot be applied is a failure, the exact restore makes every door hold again; the coupling probe shows an unlisted
  helper message breaks the list, the page and the task read. The select, candidates and page predicates set their state with a trigger-off fixture (defence in depth, R10): said in the pass name and the report.
- P9 two snapshots so the comparison can fail: the price tuples of every row that existed before the chain stages (seeded applications and Agreements included) and of every row created in P1b..P7 (taken immediately before P8),
  plus the certificate and the whole function catalog, are unchanged.

**Open owner decisions are labelled, not judged.** Report rows carry `{defined, decision, status}`: `CANON` or `PINNED_TO_TODAY (open D1|D3|D4|D6)`. D1 NULL basis with more than one person (matrix, P4(d), P6), D6 one-person PER_PERSON / TOTAL,
D4 which OFFERS amounts are accepted (1, 5000, 7777, 12345, int4 max: matrix, P4(f), P5, P6), D3 the Agreement amendment. The refusals of a zero, negative or null price are canon in every shape and keep the neutral label.
A later owner decision turns exactly the labelled rows red, by design.

**Not proven**
- DEV itself (0 open MY_PRICE tasks there), native screens, old APKs on a phone. HTTP only on the disposable stack; the PostgREST version is not pinned (header recorded; DEV runs 14.5).
- The chain is not DEV. It lacks pkg051a, A1/P0/P4/P5/B3a-c, PKG-045b P0 (needs column ACL: the chain still has table-level SELECT on `public.needs`, which is why the proof reads the computed count only through
  `rpc_read_task`, SECURITY INVOKER: on DEV under the column grants, on the chain under table-level SELECT), P6 rollout v3, B24 Part 1/2 (except the two functions above), Voice B1 and EX-04A-C. Its certified set and certificate
  are chain-internal (before = after), never equal to DEV's `58447d77`. The agreements page reader is the pkg023a version (replayed by stage 04); the EX-04C version (rating state) is not on the chain.
- B24 Part 1 as a whole cannot apply on the chain even in relaxed mode: relaxed mode skips only the md5 pins and the closed name lists, not existence (`private.platform_price_add_version` exists only after pkg051a),
  uniqueness, the quoted-site count (later push bodies drift it) or the "no PT409 yet" check. The report records the measured applicability.
- NOT DEMONSTRATED (T6 / R10): a `price_basis`-only task edit through the REAL command (it is outside the guard's material list, the legacy command carries no basis, the owner's direct update is DRAFT-only, the edit fixture always bumps the revision).
- The task edit is a fixture (guard token plus untriggered republish) and the basis/price flips are fixtures with triggers disabled (defence in depth, R10). A price patch `100.0` cannot be sent through JSON.
- A refused RPC rolls its own transaction back, so "nothing written" is a transactional invariant, not independent evidence: the exact outcome is the evidence. The SQLSTATE of an amount above int4 (22003) is observed
  for the first time by this proof (22003 and 22P02 are tolerated, PGRST202 is not). The expected outcomes of the P1b attacks are derived from sources and are first observed by CI.

**Reuse by a later residual-hardening candidate** (reject vs derive D2, OFFERS bound D4, Agreement price lock D3, NULL basis for multi-person tasks D1, one-person basis D6)
1. Pin the CURRENT md5s in `PINS`; a new helper message needs BOTH `need_candidate_states_v5` overloads patched in one package (P8 coupling probe, `swallowListMissing`, the raise-count check).
2. Add the candidate stage in P0 next to the EX-04D replay: the historical rows are seeded BEFORE it and compared after the whole run (P9), so a candidate that rewrote data turns the neutrality check red; the matrix, replay, stale, selection and probes
   are the before/after regression net. RED-before cases exist only for the behaviour the owner selects (the rows labelled PINNED_TO_TODAY).
3. Keep errors at 22023/P0001 with existing names; a new deterministic conflict raises PT409, never 40001. Function-only, so the certificate stays unchanged (P9).

**Path filter.** The workflow runs on a push that touches the proof, its tests, the client module graph (29 sources), AND the files that define the chain: every migration, every `pkg*` candidate, the replay and stage proof scripts and the
directories they read, the Edge sources, the ledger and the few non-supabase inputs. A unit test walks the stage scripts and fails when a file they name is outside the filter. Documents that only mention a path are intentionally outside.

**Known open points**: client does not treat the five price codes as conclusive on the new-offer path (recorded in `report.client.refusals`, finding D10); `price_basis` is outside the guard's material list and the snapshot (R10); 4 of 14 DEV versions lack a snapshot (cause unknown).
Unit tests (no database; they load the real client modules, so run `npm ci` first; line endings of the sources are normalised, so a CRLF checkout works): `node --test supabase/proofs/pkg049/*.test.mjs`.
