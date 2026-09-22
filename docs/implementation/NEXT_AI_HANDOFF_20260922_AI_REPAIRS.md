# AI repairs continuation — 2026-09-22

Read the owner's latest instructions, mandatory 20260921_2145 handoff and AGENTS.md first. This is a
state supplement, not a permission grant. Work solo in the canonical checkout on
`work/pre-v3-engine-integration-20260911`. Commit/push allowed; no PR, force-push or repair branch.

## Current measured state

- DEV `leqcwgzvjsxugfgzdmth`: ledger195 =147 source +48 dev_alpha after PKG-040.
- Certified closure `65980fce17030f1d8b34177b8989549c2144bf806478238af39dec04b137a591` unchanged.
  Candidate transactions assert live=certified and readiness before/after. Direct private digest calls
  through the connector are denied; do not claim independent postflight execution.
- Intake47, worker interview17, Q&A classifier13, publication14. New bundles read back byte-for-byte,
  ACTIVE and verify_jwt=true; anonymous401. No credentials were inspected, printed or changed.
- Types clean, full Jest241 suites /4652 tests pass, process exit0 (a delayed-exit warning was emitted).
- PKG-040 proof35677596411 on2263772e:346 offline Edge tests and17 SQL/Auth/REST checks pass.
- PKG-01035676936960 and PKG-014B35677260602 pass. Historical worker recovery proof now expects FAILED
  for definite dispatched failure and reads nested `unknownRecovery.turn.state`; no protection removed.
- APK35677195929 sourceec3b3d43 succeeded. Downloaded68,549,871 bytes, SHA256
  `5568feb7d16083be8b7232795c78a98e1a23bf697d956629f2bbba9b41b8fa93`, checksum/source/tree and both
  recovery/icon attestations match. Native source unchanged between build commit and2263772e.
  Local file `artifacts/apk-35677195929/USKOCI-DEV.apk`. NOT installed/tested. No real-provider probe.

## What changed

1. PKG-038: typed dialogue decisions, one next material question, finish handoff, no raw prose before
   successful owned completion, complete known-fact context, material no-op filtering, full23-field
   review cap and native transcript/UNKNOWN cleanup. SQL applied at ledger193, later Edge superseded.
2. PKG-039: owned failure retirement after dispatch without paid retry; independent5s cleanup in
   intake/worker; provider30s, native55s, ordinary reads15s. SQL applied at ledger194.16-check proof.
3. PKG-040: service-only Q&A failure settlement using existing CANCELLED + QA_PROCESSING_FAILED;
   binding/locks/terminal-state preservation, independent5s cleanup, provider30s/native55s. Keeps the
   draft and requires explicit resubmission. Lost completion/publication ACK preserves READY/COMMITTED.
   SQL applied as20260922020108 dev_alpha_pkg040a_qa_failure_settlement, ledger195. Exact ledger SHA256
   `a47d403705447ef89e35a6f08c5eccc7c3fbd42f44deec45a2dab97a723e31e9`.
4. PKG-041: intake detects contradictory literal danas/sutra/prekosutra evidence and asks for an exact
   date. Whole-input day words are not naively converted; negation case preserved. Four old-code failing
   regressions plus one correct-case regression. Edge-only deployment; no SQL/client change.

Read package039/040/041 docs and receipts, and the semantic audit's REPAIR_COVERAGE_20260922.md.
The audit REPORT.md is the historical baseline; its header links follow-up implementation.

## Limits and next work

- Do not call the AI conversation fully validated. Paid provider calls were forbidden; offline tests
  exercise supplied outputs. Actual Gemini understanding, complex dates, task switching and natural
  dialogue require approved real-use evaluation. History beyond30 messages and persistent declines
  are not fully solved. Avoid claiming a strict dialogue schema guarantees semantic quality.
- Handler recovery does not cover every abrupt process death/unknown claim ACK/unreachable cleanup.
  Existing durable sweep grace remains. Worker expired-lease cleanup also retains its existing limits.
- Daily/multiday work decision is still pending: whole-job total plus separate daily tasks, or first-class
  daily rates/repeated shifts. Current guard asks clarification; never silently multiplies or activates
  recurring work. Do not implement based on silence.
- Ask for phone readiness only when ready to use it; APK is concrete and verified. Do not uninstall,
  clear data or run speech tests without explicit readiness. Profile phone8.4 also awaits decision.
- Other engineering remains: public task column privacy7.17 and compatibility proof; closure legacy
  readiness7.41/second-device8.18; rest of RPC family audit7.1; full Home aggregate integration.
- Operator/legal/retention/support, monetization route, complete two-device marketplace journey,
  design exploration and public release/production/load preparation remain separate gates. Read
  USKOCI_CURRENT_STATUS.md and APP_FINISHING_PLAN_20260922.md. No completion percentage/capacity claim.

## Boundaries and reproduction

No new dependency, paid call, DEV synthetic account/data, real row rewrite or phone operation was used
in these packages. Certificate movement and disabling JWT still need fresh explicit owner permission.
Source147 remains frozen. Leave the foreign untracked
`supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql` untouched and
excluded. Its presence makes local inventory/all-Edge inventory test refuse; tracked CI inventory
passes. Do not weaken the inventory or claim the local whole set passed.

PKG-040 first CI fixture failure assumed absent historical device credentials; second reused an actor
inside a real cooldown. Both were fixed in disposable scenario setup; no product cooldown bypass.
Final downloaded report is checked into pkg040/DISPOSABLE_PROOF_RECEIPT_20260922.json. Disposable
closure digest is different from DEV due to runtime/catalog context; each remains unchanged/ready.

Verify fresh git status/live state before new changes; another agent has historically worked here.
Do not reapply these packages. Secrets stay out of source, tools, receipts and reports.
