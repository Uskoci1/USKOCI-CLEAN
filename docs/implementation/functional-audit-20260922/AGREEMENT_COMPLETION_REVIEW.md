# Agreement completion review — 2026-09-22

Status: implemented in the client; focused tests and types pass. Combined full suite,
exact-source APK, phone acceptance and independent Claude review remain pending.

## Decision and approved scope

Here the person verifies the accepted Agreement and explicitly confirms that the work is done.
The owner approved the functional analysis, including matrix section 21's missing completion
review and UX_NACRT §7's confirmations for both “Završio sam” and “Potvrdi završetak”.
The prior main button called the completion mutation immediately. It now opens a review;
only the explicit second button invokes the same completion function.

Read before implementation: OWNER_DESIGN_DIRECTION_20260922.md, UX_NACRT_20260922.md,
functional audit REPORT.md, matrix section 21, and control rows D02/D10/D11/D13.
This is the D10/D11 completion slice. D13 progress and D02 source links are still separate.

## Three compositions considered

1. Native alert: quick, but too little room for accepted terms and enlarged text.
2. Inline expanded card: retains context, but pushes confirmation among unrelated workspace actions.
3. Native page-sheet review, selected: a focused, scrollable accepted-terms view with Back and one
   fixed explicit confirmation. It uses the existing native Modal and respects reduced motion.

The layout is left aligned, with a green heading, a short consequence sentence, accepted task
and counterpart, illustrated term/people/total facts, and one orange confirmation. Inter and the
existing type scale remain; no text below 12dp or shrinking labels is introduced. Existing colors:
surface #FFFFFF, ink #202723, muted #5E6D64, green #076E4E, action #FA8229, warning #FFF4DF.
The decisive visual emphasis is the accepted facts; no fabricated progress/checkmark is shown.

Worker copy describes requesting the other person's confirmation. It does not fabricate the
future deadline or claim the Agreement is already complete. Requester copy describes confirming
the performed work. An existing problem remains visible and explains its different consequence;
it does not remove the server-authorized explicit requester confirmation.

## Authority and recovery

The review uses the Agreement workspace context and existing accepted-term projections in
DogovorProjekcija. Title comes from current task context, while price and time come from accepted
terms; people reuse the established coverage projection. It does not claim every displayed field
is an immutable snapshot of the original agreement.
It does not fetch or copy the current task, infer arrival or infer payment. No new business state,
source link, deadline, command identity, payload, service, server change or dependency is added.

The existing complete() body remains unchanged. Server actionState remains the permission
authority; useOwnedEditor still serializes writes, retains uncertainty and requires readback.
Worker success still requires AWAITING_REQUESTER or COMPLETED. Requester success still requires
COMPLETED after the validated completion receipt. Timeouts, known denials, pending changes,
account-incarnation checks, private context and recovery behavior are unchanged.

The presentation review has an identity token bound to the exact workspace object, its read
epoch and focus token. Any new read invalidates it synchronously before awaiting the server,
even when the same version returns. Blur and AppState changes invalidate it as well. Existing
account/revision ownership checks remain in force. Confirm consumes the token before starting
the existing command; a retained confirm or Back cannot act on a later review. An old opener
cannot revive a review after a new read. Dismissal performs no mutation.

## Owned files and verification

- src/app/dogovor/[id].tsx
- src/ui/agreements/AgreementCompletionReview.tsx
- src/data/__tests__/pkg011-agreement-workspace.test.tsx
- src/data/__tests__/agreement-screen-recovery.test.tsx
- this delivery note

Focused command:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/data/__tests__/pkg011-agreement-workspace.test.tsx src/data/__tests__/agreement-screen-recovery.test.tsx src/data/__tests__/pkg007-agreement-actions-read.test.ts src/data/__tests__/agreement-problem-client.test.ts --silent
```

Result: 4 suites / 126 tests pass, exit 0. Relevant new assertions cover no mutation on review,
UI/native Back, accepted amount/term, both motion preferences, a dismissed callback against a
new review, account ABA, focus return, background/resume, and a new same-version/version-changed/
permission-revoked read. Existing double-submit, cross-action serialization, unknown-result,
server-denial and terminal-readback assertions now use explicit confirmation.

Type command: `node node_modules/typescript/bin/tsc --noEmit` passes, exit 0.
No predecessor execution is claimed. The added no-write-on-first-press assertions exercise the
specific changed behavior; native rendering and real authenticated completion are still unverified.

## Remaining acceptance

Root integration owns the combined full suite, control rows D10/D11 and regenerated publication,
exact-source build and actual phone checks. Keep Telefon unset until the current build proves it.
Verify both roles, native Back, large text, long accepted terms, reduced motion, a problem-open
Agreement, an intervening terms change and unknown completion recovery. Independent Claude
screen review remains required. No DEV, device, provider, dependency, commit or push action was
performed by this implementation subtask.
