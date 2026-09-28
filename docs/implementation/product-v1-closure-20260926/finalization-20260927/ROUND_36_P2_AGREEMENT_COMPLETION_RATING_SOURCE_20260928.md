# Round36 — P2 Agreement problem / completion / next-step / rating source closure

Date: 2026-09-28. Tested production source is `b06480512d197168c0ef857bb151a0e143b3a667`; current branch is source-equivalent for the files reviewed here, with later commits limited to control/evidence documentation.

## Scope reviewed

- `src/app/dogovor/[id].tsx`
- `src/ui/agreements/AgreementWorkspace.tsx`
- `src/ui/agreements/AgreementCompletionReview.tsx`
- `src/data/agreementClientService.ts`
- rating route/client/presentation
- exact Agreement completion/problem/rating tests

## Current product contract

### Problem report

The active Agreement exposes a separate problem surface, distinct from support/safety. The person must enter a narrative before submission. The first immutable narrative is retained after an unknown outcome; a different second description cannot silently replace it. After a receipt, the screen reads the canonical report back and verifies who opened it and when. The report is visible to both Agreement participants and explicitly says that it is not a confidential support report and does not itself determine fault or debt.

An open problem stops automatic completion but does not remove an explicitly permitted completion action. Historical/legacy reports that lack readable detail remain reported without fabricating text.

### Completion

The current route uses the Agreement participant role from the workspace, never the selected app intent. The server `actionState` is the sole permission authority; missing permissions fail closed and offer an explicit refresh.

Before either completion command, a dedicated review surface shows the accepted task title, other participant, accepted time, people and total amount. A pending change blocks completion until resolved. The review is bound to the exact Agreement read/focus epoch and is discarded on refresh/blur/account change. Double confirmation cannot reuse it.

Worker action:
`rpc_mark_work_done` is accepted only after readback reaches `AWAITING_REQUESTER` or `COMPLETED`.

Requester action:
`rpc_confirm_completion` requires the structured authoritative COMPLETED receipt and the screen still requires canonical workspace readback to display completion. An unchanged readback remains unconfirmed.

Known server denials keep their specific copy; other/timeout outcomes become unknown and require explicit reconciliation rather than optimistic success.

### Next step / progress

The old control claim that "Koraci napretka" are not implemented is no longer true for the current branch.

`agreementNextStep` presents only state that the Agreement actually knows:
- pending change: who must answer, and completion is blocked;
- CONFIRMED worker: mark done when work is complete;
- CONFIRMED requester: explicit completion remains allowed under server permission;
- AWAITING_REQUESTER: requester confirmation / worker wait, with the actual stored deadline;
- COMPLETED: rating prompt only if the own-review read says it is due/unknown;
- CANCELLED: terminal state.

There are no fabricated movement/arrival/start-work milestones. The separate chronology renders only saved events supplied by the Agreement projection.

### Rating

The rating route independently re-reads its exact Agreement/review context. It requires an explicit integer 1–5 selection, validates only server-provided tag catalog values, serializes double taps, accepts only matching authoritative readback and handles unknown/lost acknowledgement with readback before retry. No-review is distinct from 0.0.

The Agreement footer no longer keeps offering a rating after the own-review read says it is GIVEN/CLOSED.

**Written free-text rating comment is not part of this closure.** It remains a separate server/schema/privacy/moderation package and is not applied in Round36.

## Exact test evidence

GitHub Actions run [36400916665](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36400916665), exact code `b0648051`, TypeScript PASS and full Jest **342 suites / 7,214 tests PASS**. Included:

- `agreement-screen-recovery.test.tsx` — PASS; role authority, completion review lifetime, double completion, unknown/reconcile, report problem, report+completion, missing/denied actions, terminal readback, account/background fences.
- `agreement-problem-client.test.ts` — PASS; exact report receipt/read, Unicode bound, malformed/foreign rejection, account/timeout fences.
- `pkg007-completion-receipt.test.ts` — PASS; authoritative COMPLETED receipt/replay and malformed/unknown/account-change rejection.
- `agreement-overview-presentation.test.tsx` — PASS.
- `agreement-workspace-announcements.test.tsx` — PASS.
- `reviews-authority.test.ts` — PASS.
- `ui/reviews/__tests__/review-screen.test.tsx` — PASS.
- `oceni-dogovor-route.test.tsx` — PASS.

## Native boundary

This is still not a new exact-device acceptance. Current source needs one consolidated two-account disposable Agreement pass on the exact APK:
1. worker opens completion review and marks done;
2. requester sees AWAITING_REQUESTER and confirms;
3. both reopen completed Agreement;
4. each rates once on disposable review context;
5. a separate disposable active Agreement checks problem-report copy and that auto-completion stops without removing explicitly allowed completion;
6. capture build/hash/device evidence.

No destructive action is requested against the owner's real production-like history.
