# PKG-038 — conversation control and complete-registry review

Status: implementation and offline regressions; disposable proof pending. Nothing in this package is
deployed yet. Baseline: `8d51f6a2`, canonical DEV ledger192. Owner asked to repair the semantic audit
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

Local typecheck passed before the final plan addition; rerun required. Targeted current tests pass.
The broad AI test run initially found three current provider fixtures lacking the new plan (updated)
and the known foreign untracked migration inventory refusal (untouched). Do not report that broad
run as green. CI has only the tracked147 migrations.

The PKG-038 workflow reconstructs the exact source147 + recorded DEV chain through PKG-037, runs
the real full23-field review before/after, refuses tampered candidates and extra fields/foreign owners,
and checks exact function surface and unchanged closure. Fixtures exist only in rolled-back local SQL.
No provider, canonical DEV write, secret read or phone action occurs in the proof.

## Still required

Read the CI report before applying the candidate; recheck live pins, verify applied text and write a
receipt. Deploy/read back both exact Edge bundles with JWT unchanged after checks pass. Complete
native duplicate-display cleanup, interview timeout/recovery and the separate historical semantic
findings. Provider quality and phone latency cannot be marked verified by mocked transport tests.
