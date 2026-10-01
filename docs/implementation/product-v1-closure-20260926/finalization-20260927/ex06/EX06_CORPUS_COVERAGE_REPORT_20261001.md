# EX-06 S02: synthetic contract corpus v1, coverage report (2026-10-01)

**Status: DATA + VALIDATOR PACKAGE (SOURCE level only). Not EX-06 progress, not a quality measurement.** Nothing was applied to DEV, no provider was called, no dependency was added, no matcher or database was run, nothing was published.
Levels (LIVE plan 4.2): SOURCE new files only | CI one Jest file, not yet run in CI | DEV-APPLIED no | CLIENT-WIRED no | DEVICE no | PROVIDER no | MATCHER no.

This is slice S02 of `EX06_CANONICAL_SCOPE_20261001.md` section 6 (gap G01). It answers runbook P5 item 1 ("Build a local/offline contract corpus from safe examples ... Document expected structured facts, not exact prose") and the P5 Exit sentence ("Report corpus size/failures and untested categories without claiming general perfection").

## 1. What exists

| File | Role |
| --- | --- |
| `supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json` | the corpus (66 cases, about 270 KB). Placed beside the existing AI proofs because `supabase/proofs/ai` already exists; the scope document asks for "next to supabase/proofs/ai, not under docs". |
| `src/data/__tests__/ex06-corpus-contract.test.ts` | offline validator, 25 tests: schema, anchoring to the real contract sources, plan-coverage completeness, and 15 negative tests that prove it rejects broken corpora |
| this report | size, coverage matrix, untested areas, source-level observations |

The corpus was assembled with a throwaway generator that is not committed; the JSON is the artifact. Derived fields (review state, hidden-kind probe, reference-worker eligibility labels) are stored as literal data, and the validator recomputes the derivable ones, so a hand edit that desynchronises a case is reported as an error.

## 2. The honest statement

* The corpus has **not been run** against any provider (Gemini or other) and **not been run** against the matcher or any database. There is **no pass rate, no threshold, no score**: none is canonical (runbook asks to report only; plan 21.2 forbids invented percentages), and the header and the validator both refuse a `passRate`/`threshold` field.
* Every expected value is a **contract expectation read from source** (fact registry, Edge enums and guards, matcher gate codes, PKG-031b stems, owner-locked policy minimum). It is not observed behaviour. A synthetic corpus proves nothing about model obedience (AGENTS 3.2.4 evidence honesty; the 355 offline Edge tests have the same limit).
* Failures: **none observed, because nothing ran**. The five failure classes of runbook P5 item 2 (display/composition, controller/state, server fact contract, prompt/provider behaviour, geocoding) are empty buckets by construction. They fill only when a later slice runs the cases.
* Reference-worker eligibility labels are a **SOURCE reading** of the matcher (baseline engine migration, W02 calendar integrity, W02 persistent availability, PKG-031b kinds). Later packages (pkg015b, pkg027a, pkg029a, pkg033a, B24) were not re-read for the scheduling gates, and radius is predicted by city-name equality although the live gate uses a geodesic distance when both positions exist. Slice S03 must diff these labels against the real bodies (md5-pinned by S01); a mismatch is a finding, not a corpus bug.

## 3. Privacy

Every message is invented for this corpus. No stored conversation, no real user text, no real name, phone, e-mail or street address was used. Places are cities, neighbourhoods and two public parks; there is no street name and no house number anywhere. Contact and address cases use the literal tokens `<TELEFON_PLACEHOLDER>` and `<ADRESA_PLACEHOLDER>`. The one invented person name is "Mika Primerović". The validator scans every message, title and must-not line for e-mail-like, phone-like (7 or more digits, also separated), URL-like and street-and-number-like patterns and has negative tests for each.

Real user text found in the repository: none was copied. The existing acceptance harness has six invented worker turns and four invented task turns (`scripts/acceptance/dev_ai_acceptance.mjs`), the registry names one published painting task title from the owner's QA account (`redovi.json` A02), and the 2026-09-22 diagnostic holds 8 synthetic cases without text. None of it was reused; the A02 case here is newly worded. Policy-document example sentences (`RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md`) were reworded, not copied.

## 4. Size

| Measure | Value |
| --- | --- |
| Cases | **66**: 50 task, 16 worker |
| Person messages | 70: 54 in task cases (46 cases are one message, 4 are multi-message dialogues with a scripted earlier AI proposal), 16 in worker cases |
| Reference worker shapes | 150 (50 task cases x FITS / DOES_NOT_FIT / UNKNOWN_CAPABILITY) |
| Reference task shapes | 32 (16 worker cases x 2) |
| Cyrillic cases | 2 (T-029, W-014); slang or no-diacritics cases: T-012, T-030 |
| Turn-guard cases | per-day rate T-039, hourly rate T-040, repeated visits T-045, different task T-044, finish-only T-043 and W-011 |
| Policy-gated task cases | BLOCK 3 (RS-MIN-007, -002, -008), REVIEW 3 (RS-MIN-014), ALLOW-with-condition 1 (T-047, RS-MIN-001 and -012) |
| Task review states | READY_FOR_REVIEW 37, COLLECTING 7, BLOCKED 3, NEEDS_POLICY_REVIEW 3 |

Matcher consumer classes (a case can carry several): SOFT 57, SCORE 54, HARD 16, APPLICATION_TIME 8, NONE (the matcher is never reached, policy gate first) 6. Vocabulary: HARD blocks manual application too; SOFT blocks only automatic dispatch; SCORE feeds the explainable ranking; APPLICATION_TIME is checked when applying or selecting (TEAM_CAPACITY_EXCEEDED).

Predicted reference-worker outcomes for the 37 READY task cases (111 shapes): FITS ELIGIBLE 37. DOES_NOT_FIT: MANUAL_ONLY 24, HARD_BLOCKED 9, ELIGIBLE 4 (headcount only, blocked at application time). UNKNOWN_CAPABILITY: MANUAL_ONLY 26, HARD_BLOCKED 8, ELIGIBLE 3 (undeclared team size, blocked at application time). The other 13 task cases carry NOT_PUBLISHABLE (6 cases) or NO_PUBLISHED_NEED (7 cases) labels because no Need can be dispatched from them. These are **predictions to be diffed, not results**.

## 5. Coverage matrix

Every row below is also asserted by the validator in both directions (every listed case exists and lists the item in its `planRefs`; every `planRefs` entry is declared in `planCoverage`).

### 5.1 Plan 12.5 (13 items)

| # | Plan item | Corpus cases |
| --- | --- | --- |
| 1 | ordinary service | T-001 cleaning, T-050 ironing |
| 2 | transport with two stops and a vehicle | T-002 pickup and drop-off with a van, T-003 multi-stop (start, waypoint, end) |
| 3 | several people | T-004 three people total price, T-005 two people per person, T-049 two people and an amount with no stated basis (must ask) |
| 4 | flexible time | T-006 this week and offers, T-007 today only |
| 5 | remote task | T-008 |
| 6 | missing capability | T-009 tools; capability gates also in T-002 (van), T-024 (tools), T-032 (licence), T-046 (experience), W-001 |
| 7 | synonym of an existing group | T-010, T-011, T-012 (one `synonymGroup`, same expected kind), W-012 (worker side, no duplicate skill) |
| 8 | genuinely new group | T-013 projector and screen set-up, T-031 model-kit assembly (new niche that trips an existing stem) |
| 9 | concurrent creation | T-014 and T-015 (one `concurrencyGroup`: same niche in other words, must land in one group) |
| 10 | forbidden or restricted service | T-016 intimidation (BLOCK RS-MIN-007), T-017 service offer (BLOCK RS-MIN-002), T-018 off-the-books workers (BLOCK RS-MIN-008); regulated areas under 12.6 item 9 |
| 11 | empty location | T-019 |
| 12 | contradictory time | T-020 end before start, T-021 two different days |
| 13 | user correction of a wrong AI proposal | T-022 (headcount, amount, day); worker side W-006 |

### 5.2 Plan 12.6 (10 items) and the registry A02 defect

| # | Plan item | Corpus cases |
| --- | --- | --- |
| 1 | move with two people and a van | T-023 |
| 2 | painting with or without tools | T-024 with tools, T-025 without tools |
| 3 | remote job without a pin | T-008, T-027 (home city mentioned, must not become a pin) |
| 4 | help only today | T-007 |
| 5 | overlapping schedule | T-028 (confirmed Agreement overlap); availability on the worker side W-005, W-006, W-007, W-016 |
| 6 | synonyms, Cyrillic, typos | T-010, T-011, T-012, T-029 Cyrillic, T-030 slang and dialect, W-014 Cyrillic worker |
| 7 | new niche | T-013, T-014, T-015, T-031 |
| 8 | unconfirmed licence | T-032 task side, W-008 worker side (named licence kept, vague one left unknown) |
| 9 | regulated service | T-033 injection at home, T-034 childcare, T-035 passenger transport for money (all REVIEW, RS-MIN-014) |
| 10 | need changed later | T-036 |
| - | A02: a clear painting description did not give a category | T-026 (expects `need.category` present, hidden kind MOLERSKI_RADOVI; 2 more painting cases above) |

### 5.3 Runbook P5 item 1 topics

| Topic | Cases |
| --- | --- |
| category and subcategory | T-001, T-010, T-011, T-012, T-013, T-024, T-026, T-046, T-050 |
| free text | T-001, T-008, T-010, T-011, T-012, T-026, T-029, T-043, T-044, T-047, T-048 |
| slang and typos | T-012, T-029, T-030 |
| dates, timezone, duration | T-001, T-002, T-020, T-021, T-022, T-028, T-036, T-037 (duration), T-038 (offset +01:00 after the October clock change), T-045 |
| price versus offers | T-001, T-003, T-004, T-005, T-006, T-007, T-022, T-023, T-039, T-040, T-049 |
| people | T-001, T-004, T-005, T-006, T-022, T-023, T-036, T-037, T-042, T-049, T-050 |
| equipment, tools, vehicle | T-002, T-009, T-023, T-024, T-025, T-030, T-032, T-041, T-046 |
| urgency | T-003, T-007 (the word "hitno" must not become a flag; HITNO is off by policy) |
| remote versus on-site | T-008, T-019, T-027 |
| access constraints | T-002, T-041, T-047, T-048 |
| multiple stops | T-002, T-003, T-032 |

### 5.4 Worker side (WORKER_PROFILE_V1)

| Topic | Cases |
| --- | --- |
| skills | W-001, W-009, W-012, W-013, W-014 |
| tools | W-001, W-009 |
| vehicle | W-002 |
| availability (weekly rules, correction, live flag, dated exception) | W-005, W-006, W-007, W-016 |
| radius and work area | W-003 (country not stated, must not be assumed), W-004, W-009 |
| licence is self-declared | W-008 |
| draft is not ACTIVE | W-009 (complete draft, an AI turn never activates it), W-010 (vague, nothing invented) |
| team capacity | W-002, W-015 |
| correction | W-006 |
| finish-only command | W-011 |
| preference the profile cannot store | W-013 |

## 6. Hidden kinds (the eleven PKG-031b kinds) and the owner veto

Expected hidden-kind outcome per task case: CISCENJE 7, BASTA_DVORISTE 7, SELIDBE_PREVOZ 6, FIZICKI_POSLOVI 4, MONTAZA_NAMESTAJA 4, MOLERSKI_RADOVI 4, DOSTAVA 1, SITNE_POPRAVKE 1, PRANJE_PEGLANJE 1, unclassified 9, refused 6 (the three BLOCK and three REVIEW cases). Worker expected sets use MONTAZA_NAMESTAJA (W-001, W-012, W-013), SELIDBE_PREVOZ (W-001) and MOLERSKI_RADOVI (W-009, W-011, W-014).

**Kinds with no case: ELEKTRO and VODOINSTALATER.** Whether ordinary electrical or plumbing work is an ordinary task or a regulated one is not decided in the canonical sources (RS-MIN-014 sends "regulated or high-risk categories without a reviewed specific rule" to REVIEW; LEG-05 section 6 is a draft that is not legally reviewed and says licences for electrical and gas work "ostaju obavezni"). Any expected outcome I wrote would be invented policy, so no case exists. This is an owner question for the policy track, not a corpus gap to fill by guess.

**Does any case suggest a kind beyond the eleven?** Nine task cases expect `unclassified`. I did **not** add any kind (naming kinds is the owner's, PKG-029). Proposals for the owner to veto, working names only:

| Cases | What the person asked for | Possible reading |
| --- | --- | --- |
| T-008, T-027 | retyping a scanned document, translating a contract | one remote text-work kind |
| T-046 | laying parquet (also names a 5-year experience requirement) | a floor-laying or finishing-trades kind |
| T-014, T-015 | puppy training | a pets kind |
| T-021, T-040 | help with packing | either a packing kind or an extension of SELIDBE_PREVOZ / FIZICKI_POSLOVI |
| T-013, T-031 | projector set-up, model-kit assembly | too niche; correctly unclassified, no kind proposed |

The corpus can only show that a niche exists in this synthetic set; it cannot show demand. Per scope risk "corpus quality risk", the answer to "is a new kind needed" belongs to the coverage numbers of a run on real distributions, not to this file.

## 7. Source-level observations made while writing the cases

All are readings of repository text, not live behaviour, and none changes any code. They are the inputs S03/S04/S05/S06 should test.

1. **Stem false positive (T-031).** `sklapanj` makes "Sklapanje maketa" read as MONTAZA_NAMESTAJA; a furniture assembler would then pass the service gate of a model-kit task. T-031 stores the contract expectation (DOES_NOT_FIT, MANUAL_ONLY) and the source-reading prediction (ELIGIBLE) side by side.
2. **A kind is not a policy gate (T-035).** `prevoz` / `transport` yield SELIDBE_PREVOZ for "Prevoz putnika". Only the publication evaluator (REVIEW) stops it; the stems do not know about regulation.
3. **Cyrillic is not folded.** `work_kinds_v5` folds only č ć š đ ž. A category or skill stored in Cyrillic yields no kind (T-029, W-014 raw probes). Nothing in the Edge prompt or server converts script, so the corpus expects Latin canonical wording and records the Cyrillic yield as empty.
4. **Dialect verb and typo not matched.** "ofarba" / "ofarbati" yield nothing; "farbanje" does (T-030). "ikee" yields nothing; "namestaj" does (T-012).
5. **Tools, vehicles and licences are exact lowercase containment** (only skills and exclusions get the kind bridge). A worker "kombi vozilo" does not satisfy a task "kombi". The corpus gives both sides the same canonical string so S03 can separate wording drift from gate logic.
6. **A task with no required skills matches every worker on the service gate** (known gap G06). The corpus therefore lists `need.required_skills` as a soft fact wherever a trade is named, and reference workers are built so the gate is visible.
7. **A worker with no stored location cannot be dispatched a non-remote task** (city-text comparison with an empty city). Worker reference tasks assume a city and an ACTIVE profile and say so in `referenceAssumes`.
8. **`years_experience` and `exclusions` have no writer** (G04). T-046 and W-013 carry `writerlessFields`; the hard INSUFFICIENT_EXPERIENCE and PROFILE_EXCLUSION gates can only be exercised by a direct database write in S03.
9. **Server readiness and the Edge asking list differ.** `price_basis` is not `requiredForDraft`, but the Edge guard still asks for it when two or more people share an own price (T-049). The corpus calls that state COLLECTING.
10. **Title and category are not in the Edge guard's asking list** (they are synthesised by the model). T-026 pins the expectation that the category is present, which is the A02 dead end stated as a contract; the corpus cannot tell whether the product meets it.
11. **Live availability flag without expiry (W-007).** After the W02 persistent-availability patch the old freshness gate is gone from the patched bodies I read, but whether `availableNow` with no expiry clears the final live body is left as an `openQuestion` for S01.
12. **Country handling differs between the two interviews.** For workers the interview forbids assuming the country (W-003 expects the review to flag "Država i mesto rada"); for tasks the corpus expects `RS` when a Serbian locality or the Serbian market is named. That asymmetry is assumption A1 in the header.

## 8. Fields with no case, and other untested areas

Task facts (AI-proposable fields appear in 41 of the 50 task cases; counts are cases that expect the fact): title 41, description 41, category 41, required_skills 40, price_mode 41, price_rsd 39, schedule_kind 39, starts_at 33, ends_at 33, people_needed 41, task_country_code 40, task_geography 40, required_vehicles 5, price_basis 5 (4 TOTAL, 1 PER_PERSON), required_tools 3, access_notes 2, critical_conditions 2, required_licenses 1 (T-032), minimum_experience_years 1 (T-046), exact_address 1 (T-048, placeholder token).

* **No case as an expected fact:** `need.verified_identity_required` (manual-only; appears only as a must-not in T-032 and T-042), `need.public_photo_paths` and `need.resolved_location` (manual-only, never an AI proposal).
* **Single-case fields:** required_licenses, minimum_experience_years, exact_address, PER_PERSON basis.
* **Worker patch fields with no case:** `bio`, `availability.timezone`, `availability.windowIdsRemove`. Not coverable because no writer exists: years of experience, minimum fee, proactive-notification flags, exclusions (G04).

Other untested areas (not claimed, not planned as part of this slice):

* regulated trades (electrical, plumbing, gas) and any policy outcome beyond the three RS-MIN-014 examples;
* dialogues longer than three messages, an AI question followed by the person's answer, voice transcripts with recognition errors, photos, very long texts near the 4000-character limit;
* numbers written as words beyond "tri hiljade" and "hiljadu i po", other currencies, other languages;
* date edge cases beyond one relative date and the autumn clock change (spring clock change, midnight boundary, "ovog petka" ambiguity, other timezones);
* worker bounds (radius 1 and 200 km, team size 1 and 50, 50-item lists), several availability exceptions at once, removal of a dated window;
* the quality of any real provider output, geocoding, and every real-data distribution question (no stored data was used).

## 9. The validator

`src/data/__tests__/ex06-corpus-contract.test.ts` reads the corpus and the real sources as LF-normalised text (CRLF-safe; it uses only `fs` and `path`) and asserts:

* header: synthetic, zero provider calls, never run against provider or matcher, no pass rate or threshold, the Belgrade clock, the exact eleven kinds, case counts equal to the list;
* every case: unique id, family matches the id prefix, plan references, consumer classes from the fixed set, a must-not list, privacy scan of every message, title, note and must-not line;
* every expected fact: key present in the fact registry parsed from `needFactsV2.ts`, not manual-only, value type right (integer ranges, enums read from the Edge `Set`s, ISO instants with an explicit offset, valid task geography per the Edge `geographyValid` port), cross-field rules (a window needs both ends and end after start, an amount needs MY_PRICE, a basis needs more than one person, a remote task has no address or access notes);
* dialogue outcome: values from the Edge `DIALOGUE_VALUES`, question keys limited to what the interview would still ask (order pinned to the Edge guard text), guards consistent with the dialogue (withheld turns leave the facts exactly as before), review state and missing lists recomputed and compared;
* hidden kind: one of the eleven, `unclassified` or `refused`; the stem port is pinned to `private.work_kinds_v5` in the PKG-031b candidate (skipped, and said so, if that file is absent), and every stored probe yield is recomputed;
* three reference workers on every task case, real matcher reason codes only (checked against the matcher migrations), eligibility label consistent with its blocker lists and with the case state, FITS eligible, DOES_NOT_FIT and UNKNOWN_CAPABILITY never plainly eligible (T-031's contract-versus-source divergence is explicit);
* worker cases: patch fields from the real worker schema, availability rule and window shapes, review labels from the four the client decodes, an AI turn never activates a profile, finish-only means an empty patch;
* plan coverage: all 13 + 10 + A02 + 11 runbook topics + the worker topics have at least one case, both directions;
* groups: concurrency and synonym groups resolve to the same outcome; a variant case expects the same numbers as its origin.

Negative tests (15) prove the validator rejects: an unknown fact key, a wrong value type, an enum outside the Edge enum, a manual-only fact, an e-mail, a phone number and a street with a number, a duplicate id, a kind outside the eleven, a task case without three reference workers, an invented matcher code, a fitting worker that is not eligible, an incomplete plan list, a worker patch field the schema lacks, an AI-activated profile, a stale kind probe, and a score or threshold in the header.

`EX06_SOURCE_ROOT` (environment variable, optional) points the source-reading half of the test at another checkout; leave it unset in normal runs.

Command and result (run on 2026-10-01 in an isolated agent worktree whose own base predates the Edge dialogue contract, so the contract sources were read from the current checkout through `EX06_SOURCE_ROOT`):

```
npx jest src/data/__tests__/ex06-corpus-contract.test.ts --testTimeout=60000
Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
```

Without `EX06_SOURCE_ROOT` that stale worktree fails 4 tests and skips the stem pin, which is the intended drift detection (the old Edge function has no `DIALOGUE_VALUES`); in the integration checkout both are the same tree. A strict `tsc` check of the test file reported no error.

## 10. Hand-off to S03 and what stays open

* S03 can materialise each READY_FOR_REVIEW task case through the product's Need path from `expected.facts` (`canonicalText` and `canonicalItems` are the exact strings to store), create the three `referenceWorkers[].profile` rows, run the matcher, and diff `expect` (including `sourceReadingPrediction` where present). Worker cases carry `referenceTasks` for the reverse direction.
* The corpus decides nothing: the electrical and plumbing policy, any new kind, the country-asking rule (A1), the collect-or-drop decisions of G05 and the real-provider run (Q1, paid budget) all stay with the owner.
* No registry row was changed; recording this package in `docs/control/redovi.json` is the root integrator's step (S00), not part of this slice.
