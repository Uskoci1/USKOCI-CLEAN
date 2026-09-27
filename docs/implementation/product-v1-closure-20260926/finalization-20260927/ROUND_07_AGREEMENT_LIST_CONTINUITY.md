# Round 07 — Agreement list choices across app return

2026-09-27. Source prepared after `4bc70af4`; no tests, typecheck, build, device or provider execution by this subtask. No server, dependency, service, TaskCard, Peek, Agreement detail or chat change.

## Observed source defect

`src/app/(app)/dogovori.tsx` deliberately unmounted its private `OwnedAgreements` reader whenever the app left the foreground and recreated it with a new foreground-generation key. The same component also owned `section` and `confirmationOnly`. A person viewing History or filtering work that needs confirmation could open an Agreement, switch apps briefly, and return to an unexpectedly reset Active/unfiltered list. Ordinary detail/Back without backgrounding already retained the choices and needed no new behavior.

The list uses the existing `mojiDogovori()` result. `agreementClientService.ts` walks the canonical `rpc_list_my_agreements_page` read and enriches completed Agreement rating eligibility; `AgreementCollectionPresentation.tsx` derives Active/History and requester confirmation from those rows. This change alters no row, total, rating state, sorting rule or RPC input. No customer data or live database was inspected.

## Bounded correction

An account-ID/account-revision-keyed `AgreementListSession` now retains only the section and confirmation-filter boolean above the foreground privacy gate. Private rows, read ownership, source/focus guards, foreground generation and navigation latches remain in the inner reader and still retire on background. Resume starts empty and needs a fresh owned read; a list behind an Agreement waits for focus before reading. Retained callbacks still pass the old ownership guard before they can change these choices. Account changes, including A → B → A, reset both choices.

This follows the already-read USKOČI guidance to preserve the person's work and position through ordinary navigation while showing only authorized data. It introduces no new visual controls or design tokens. It does not retain a transcript, Agreement rows, scroll offsets, or filters across process restart.

## Owned files and verification limits

- `src/app/(app)/dogovori.tsx`: display-choice lifetime separated from private-reader lifetime.
- `src/data/__tests__/agreement-collection-screen.test.tsx`: source witnesses cover Active/History choices across detail → background → foreground → return, no hidden read, empty rows until the fresh read, stale callbacks, fresh-row navigation and account ABA while backgrounded. Existing freshness, timeout, rating and navigation guards remain covered by the same suite.

No test was run here. The integrator should run the collection screen and presentation suites with its consolidated checks. Native navigation, recents privacy and scroll-position acceptance remain unverified. This is one display-state continuity correction, not pagination, exact-message landing or a general scalability claim.
