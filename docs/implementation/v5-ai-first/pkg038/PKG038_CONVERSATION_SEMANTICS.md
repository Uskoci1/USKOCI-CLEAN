# PKG-038 — conversation control and complete-registry review

Status: proven and DEV applied; native cleanup implemented/tested, APK/device pending. Baseline:
`8d51f6a2`, preflight ledger192, now193. Owner asked to repair the semantic audit
findings on 2026-09-22. Existing proof/DEV/certificate/cost/device boundaries remain in force.

## Behavior

- Task model output must include a bounded dialogue plan: next action/question key, same versus
  different task, whole-job versus daily/hourly price, and single versus repeated schedule.
  Invalid or absent plans fail parsing. This metadata is not an authority to save/publish or new
  database state; the existing service writer receives only the checked message/facts/safety.
- ASK selects one missing topic after merging current facts and this turn's proposals. A known-field
  question falls back to a genuinely missing topic. ACK and REVIEW use short application-owned wording.
  CLARIFY/ANSWER still permit model wording; model interpretation and these replies require later
  authorized provider-quality evaluation. No claim of universal natural-language correctness.
- DIFFERENT_TASK/UNCLEAR, daily/hourly pricing and repeating shifts produce a clarification with no
  fact changes. The previous task stays intact; the existing New task action owns a separate task.
  This does not implement recurring shifts or a new pricing unit. The owner's multi-day decision is
  still pending. It does not rewrite historical bad drafts.
- Exact finish-only phrases hand off to review without new facts or profile patches. Negations and
  sentences containing corrections are not swallowed. Review remains explicit and may list missing data.
- A narrow deterministic relative-day check catches contradictory enums/starts for standalone day
  answers (including Serbian Cyrillic), anchored to the Serbian server date. It asks for clarification,
  rather than silently changing a date. Complex clauses remain a separate semantic limitation.
- Known facts are complete typed JSON, without duplicate display labels or the destructive8k substring.
  The existing overall request byte cap still applies. Equal typed fact proposals are omitted;
  UNKNOWN facts remain eligible for explicit replacement.
- Map/photo prompting belongs to native controls; the model is no longer told to claim an unseen map
  is missing. Both prompts prohibit repeated summaries and per-field reconfirmation; profile uses ti.
- Both interview handlers buffer provider prose until output validation and the exact owned SQL
  completion receipt. Malformed, truncated or unconfirmed output emits no text. The stream still reports
  accepted immediately; typing text begins later. No extra provider call is introduced.
- Candidate `pkg038a_review_registry_limit.sql` changes one pinned function: the full-review cap derives
  from the23-key registry. It preserves ACL/config/owner and asserts unchanged ready closure certification.

## Verification

New worker regressions first failed five cases on unchanged production source: finish opened another
question/applied a fabricated patch, and malformed output leaked prose. They pass after the change.
The initial task regressions reproduced rich-context truncation, unchanged proposals, wrong day,
finish mutation and pre-validation text. Later strict-plan tests cover known-field selection,
material-ambiguity refusal, malformed plans and concise acknowledgment. Fixtures supplying ANSWER
preserve unrelated transport-test wording; they are not model-quality evidence.

Fresh local typecheck passes. Full Jest: 241 suites / 4648 tests, exit0; the focused intake screen
passes81 tests. The broad initial AI run found three obsolete provider fixtures (corrected) and the
known foreign untracked migration refusal (untouched). CI with tracked147 passes all321 Edge tests.
PKG-014B initially stopped at the old PKG-025d source fingerprint after all321 tests passed. The manifest
is explicitly re-frozen for this owner-authorized package, including the new fixture/shared imports;
the runner compares UTF-8/LF content across Windows/Linux. Its114 tests now pass locally. Historical
freeze metadata remains preserved; this is not deployed-byte equivalence.

The PKG-038 workflow reconstructs the exact source147 + recorded DEV chain through PKG-037, runs
the real full23-field review before/after, refuses tampered candidates and extra fields/foreign owners,
and checks exact function surface and unchanged closure. Fixtures exist only in rolled-back local SQL.
No provider, canonical DEV write, secret read or phone action occurs in the proof.

## DEV application and native cleanup

Run [35674102419](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35674102419), source87e3651c,
passed321 Edge tests and11 SQL checks. The downloaded proof report is preserved alongside this document.
The candidate was applied as `20260922010531_dev_alpha_pkg038a_review_registry_limit`; ledger193 =147+46.
Readback SQL text is exact and hashes to `db37458e063955135ff5ef233d1411b2f3f9cd27e6a71ce9fe9620ca783fe914`.
Function MD5 `61cf7f94032dbdfec2d5294c480a90e8`, ACL/owner/config unchanged. The transaction asserts closure
readiness and unchanged digest before commit; certified65980fce reads back unchanged. No user rows rewritten.

Intake v45 and worker interview v16 are ACTIVE with verify_jwt=true. All four intake / three worker assets
read back byte-identical to the proven commit; both unauthenticated gateway probes return401. Exact hashes
are in `EDGE_RECEIPT_20260922.json`. No paid provider call, credential read or phone action.

The client no longer decorates old assistant messages with current fact values. Current public values
remain on the live card; the complete review remains accessible. UNKNOWN fields neither appear as known
card values nor disappear from missing data. Two new regressions cover changed historical facts and UNKNOWN.

## Still required

Build the native cleanup, finish interview timeout/recovery and the remaining semantic quality work.
Provider quality and phone latency cannot be marked verified by mocked transport tests. Multi-day pricing
decision remains pending; complex temporal expressions and the30-message history window are not closed.
