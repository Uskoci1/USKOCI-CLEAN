# PKG-041 — relative-day evidence consistency

Status: proven and deployed on2026-09-22. Intake47 is ACTIVE, JWTtrue; all four returned assets
byte-equal source7b5f794b. Anonymous gateway request returns401. See EDGE_RECEIPT_20260922.json.
No SQL candidate, database write or client change.

PKG-038's short-utterance check did not cover the observed mechanism when a full sentence mentions
tomorrow but a schedule proposal says TODAY_FLEXIBLE and cites the exact word "sutra". Four new tests
fail on the former code; a fifth protects a correct negation/correction. All71 context tests and the
complete source-bound119-test proof pass after.

The added check is deliberately about a proposal's own evidence. For schedule_kind / starts_at only,
if its evidence is exactly danas/sutra/prekosutra (Latin or Cyrillic, optional final punctuation) and
that word occurs as a whole word in the current input, a contradictory typed value causes clarification.
Serbian server-local date determines consistency, including input after UTC midnight boundaries. The
whole turn's proposals are withheld. The reply asks for an exact date; it does not silently overwrite
facts or infer that the first word in a negated/alternative sentence is the intended day.

Existing safety BLOCK/REVIEW, simple-utterance date checks, no-op suppression, ownership, deadlines
and one-provider-call rules are unchanged. Complex evidence, quoted intent, ambiguous language and
general model correctness remain unproven. This closes the explicit single-word-evidence contradiction
inside a full sentence, not the entire relative-date interpretation problem. No paid provider test.

The source freeze records the previous pin and reason, retains every assertion and normalizes the
Windows checkout to committed LF. Run35677260496 binds source7b5f794b and passes all346 Edge tests,
including the five new cases. Run35677260602 (PKG-014B) also succeeds. Deployment stages exact
committed files; every returned byte, JWTtrue and anonymous401 were verified. Q&A PKG-040 has its own
proof, application and deployment receipts; those are recorded separately in its package directory.
