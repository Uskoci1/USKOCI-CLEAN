# Round 07 — return from task review to the same AI intake

Date: 2026-09-27. Base: `4bc70af4`. Client source only; consolidated verification belongs to the root integration pass.

## Evidence and behavior

`nova.tsx` keys its owned intake by account/revision, the original `conversationId` route parameter and `entryKey`. A newly started conversation receives its server ID inside that mounted intake; its original route still has no `conversationId`. The review's Back action always replaced `/nova` with the new canonical ID, also dropping an original `entryKey`. This changed the component key, erased unsent composer text and reset the conversation presentation. A resumed route without an entry key did not exhibit the same remount.

The ready state already has one primary review action beside the composer. The compact card does not duplicate it. This package preserves that composition and fixes the return identity only.

Opening the review now creates a bounded in-memory return context from the current mounted intake. Its URL carries only an opaque token alongside the existing conversation ID. The context contains only account/revision, conversation ID and original route identity; no transcript, draft text, facts, address or credential. Review Back resolves it against the current account revision and exact conversation, then replaces the review with the original `/nova` parameters. The retained intake keeps its own text/disclosure/reading state and still executes its existing focus read before allowing edits or sends.

A new review visit supersedes the old token. Returning to the intake (including native Back), unmounting its owner or switching account revision retires/rejects that context. A direct, restored, external, mismatched or stale review falls back to the canonical conversation ID. Existing current-view/current-focus and command guards remain; no AI request, fact correction, acceptance or publication is initiated by returning.

## Files

- `src/data/intakeReviewReturn.ts`: bounded route-identity context and account/visit fences.
- `src/app/(app)/nova.tsx`: capture the original identity on explicit review and retire it with the mounted owner.
- `src/app/(app)/pregled-zadatka.tsx`: restore that identity on Back, retain canonical fallback.
- `src/data/__tests__/intake-review-return.test.ts`: identity, token, retirement and account ABA regressions.
- `src/data/__tests__/ai-owned-intake-screen.test.tsx`: new/resumed/entry-key conversation → review → canonical changed facts plus retained unsent text/disclosure → editing → second review; no extra sends; unmount retirement.
- `src/data/__tests__/v5-review-screen.test.tsx`: exact return destination, direct/stale/mismatched link fallback and stale Back callback/account ABA rejection.

## Review and verification boundary

Applied the existing mobile design guidance: preserve the person's input and place in the task, keep the single next action, and use the existing native composition. No new visual treatment, dependencies or provider behavior were introduced.

Source diff reviewed; `git diff --check` passed. Tests, TypeScript, builds, native keyboard/scroll, device/provider execution and paid AI calls were **not run by this agent**. The three affected Jest suites and TypeScript are for root's authorized consolidated pass. Exact native route/keyboard/scroll acceptance remains separate.

This is retained-route continuity, not durable draft persistence. Process restart, deliberate new-conversation navigation or owner unmount still clears local unsent AI text. No server/RPC/prompt/DEV/Edge/payment/TaskCard/DiscoveryPeek/Agreement change belongs to this package.

## Root consolidated pass follow-up

The first root-run `ROUND_07_JEST.log` passes the intake-return helper and owned-intake suites. The review suite fails one existing publication-navigation expectation: it omitted the already implemented P0 `publishedHandoff` parameter. The fixture now expects that opaque token and additionally resolves it through the real publication handoff reader to assert the exact account/revision, Need and Need revision. No runtime change was made in response. This corrected assertion awaits root's rerun; the first consolidated invocation remains a failed invocation.
