# B09 / PKG-049 price authority: characterization proof (no server change)

Owner decision 2026-10-01: server price authority in V1, but do not apply PKG-049 on the old text. Finding: the authority is already live for MY_PRICE
(`private.assert_application_price_v5`, md5 `bd7ef029`, since ledger 189). This folder is the evidence refresh, not a candidate. Workflow: `.github/workflows/pkg049-price-authority-characterization.yml`.
Round 2 (after the three-lens review R1): every review finding is dispositioned in `B09_REVIEW_DISPOSITION_R1.md`.

**Evidence honesty.** Nothing in this folder had run against a database when it was written: the unit tests run offline, the proof itself needs the disposable chain, so the first CI run is the first
observation of every database and HTTP assertion. A green run is evidence about the disposable CHAIN. It is evidence about DEV only where the label at the top of the report says so (see below).

**Read the label first.** The pin gate compares the md5 of every price-chain body on the chain with the 2026-10-01 DEV readback. `CHAIN == DEV` means every pinned body is byte-equal. Otherwise the label
separates the CORE price chain from the adjacent pins, e.g. `CORE price chain 7/8 equal (stale_resolver PRE_B24); adjacent 2/3 equal (confirm_need_edit PRE_B24)`. The gate FAILS the run when a core pin is
missing or differs without an explanation, when the helper vocabulary differs from the pinned (message, SQLSTATE) pairs, or when a `need_candidate_states_v5` swallow list has a gap. Only the two documented
PRE_B24 differences may differ.

**Proven (on the disposable chain, actual Auth + PostgREST, real JWTs, real client TypeScript)**
- P0 the exact EX-04D candidate text is applied and asserted (the second `need_candidate_states_v5` overload and the page reader are mandatory); a tolerant in-proof stage converts exactly the two PRE_B24
  price-chain bodies (stale resolver `d37c4f7c` -> DEV `96cb9aac`, `rpc_confirm_need_edit` `dfa1a809` -> DEV `450b6f8d`) with B24 Part 1's own mechanics, after measuring that the converted md5 equals the DEV md5.
  The derivation is also proved offline from the repository sources (ru4 / w02 migrations + pkg033a patches + the ledger 214 receipt: `pkg049_pins.test.mjs`).
- P1 pins, helper vocabulary, swallow lists and authority (anon none, helper not callable). Historical applications and Agreements are seeded through the RPCs before the neutrality snapshot.
- P2 modified-client matrix (model in `pkg049_lib.mjs`): 11 task shapes, 21 covered cases, 142 refusals (exact message, SQLSTATE, HTTP 400, DETAIL, nothing written) and 23 amounts stored verbatim with a hash that
  binds them and the exact eleven-key success receipt; capacity checks (remaining, covered slots, team capacity) precede the price; exact outcomes for the anonymous caller, a foreign profile and an amount above int4.
- P3 replay precedes the price check; a refused key is reusable; a double tap gives one version. P4 stale KEEP/UPDATE are judged against the CURRENT task (exact refusals, still stale, nothing written, capacity before
  price, through the real `ru4Production.resolveChangedApplication` too); with the in-proof conversion a stale version or revision answers HTTP 409 (PT409) at once.
- P5 selection has no price argument, copies the stored version price, is bound to the pinned (revision, version, content hash) (a forged hash, even one that binds another price, is refused), re-asserts the rule
  against the CURRENT task (both candidate readers say STALE, `rpc_read_task` shows the computed count follow), and two partial applications on one task each become their own Agreement at their own price.
- P6 the real client services: the task as the applicant's app decodes it (`needClientService.potreba` over `rpc_read_task`), the composed price, submit, every readback, and the refusals against the LITERAL Serbian sentences.
- P7 Agreement change CHARACTERISED as today (any whole number 1..2147483647 by consent, accept carries no amount, readbacks show the last accepted amount, the offer card keeps the application price): **OPEN OWNER DECISION D3**.
- P8 non-vacuity: six weakening probes (the helper, and each of the five doors including BOTH candidate readers); a probe is detected only when each primary door is OBSERVED to give the outcome the weakened rule gives
  (corroborated by the database), a single-door probe leaves the other doors holding, a probe that cannot be applied is a failure, the exact restore makes every door hold again; the coupling probe shows an unlisted
  helper message breaks the list, the page and the task read. P9 existing and seeded price tuples, certificate and whole catalog unchanged.

**Open owner decisions are labelled, not judged.** Report rows carry `{defined, decision}`: `CANON` or `PINNED_TO_TODAY (open D1|D3|D4|D6)`. D1 NULL basis with more than one person, D6 one-person PER_PERSON / TOTAL,
D4 which OFFERS amounts are accepted (1, 7777, int4 max), D3 the Agreement amendment. A later owner decision turns exactly those rows red, by design.

**Not proven**
- DEV itself (0 open MY_PRICE tasks there), native screens, old APKs on a phone. HTTP only on the disposable stack; the PostgREST version is not pinned (header recorded; DEV runs 14.5).
- The chain is not DEV. It lacks pkg051a, A1/P0/P4/P5/B3a-c, PKG-045b P0 (needs column ACL: the chain still has table-level SELECT on `public.needs`, which is why the proof reads the computed count only through
  `rpc_read_task`), P6 rollout v3, B24 Part 1/2 (except the two functions above), Voice B1 and EX-04A-C. Its certified set and certificate are chain-internal (before = after), never equal to DEV's `58447d77`.
- B24 Part 1 as a whole cannot apply on the chain even in relaxed mode: relaxed mode skips only the md5 pins and the closed name lists, not existence (`private.platform_price_add_version` exists only after pkg051a),
  uniqueness, the quoted-site count (later push bodies drift it) or the "no PT409 yet" check. The report records the measured applicability.
- The task edit is a fixture (guard token plus untriggered republish) and the basis/price flips are fixtures with triggers disabled (defence in depth, R10). A price patch `100.0` cannot be sent through JSON.
- A refused RPC rolls its own transaction back, so "nothing written" is a transactional invariant, not independent evidence: the exact outcome is the evidence. The SQLSTATE of an amount above int4 (22003) is observed
  for the first time by this proof (22003 and 22P02 are tolerated, PGRST202 is not).

**Reuse by a later residual-hardening candidate** (reject vs derive D2, OFFERS bound D4, Agreement price lock D3, NULL basis for multi-person tasks D1, one-person basis D6)
1. Pin the CURRENT md5s in `PINS`; a new helper message needs BOTH `need_candidate_states_v5` overloads patched in one package (P8 coupling probe, `swallowListMissing`).
2. Add the candidate stage next to the EX-04D replay; the matrix, replay, stale, selection and probes are the before/after regression net. RED-before cases exist only for the behaviour the owner selects (the rows labelled PINNED_TO_TODAY).
3. Keep errors at 22023/P0001 with existing names; a new deterministic conflict raises PT409, never 40001. Function-only, so the certificate stays unchanged (P9).

**Known open points**: client does not treat the five price codes as conclusive on the new-offer path (recorded in `report.client.refusals`, finding D10); `price_basis` is outside the guard's material list and the snapshot (R10); 4 of 14 DEV versions lack a snapshot (cause unknown).
Unit tests (no database; they load the real client modules, so run `npm ci` first): `node --test supabase/proofs/pkg049/*.test.mjs`.
