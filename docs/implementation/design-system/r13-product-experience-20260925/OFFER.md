# R13 — offer composition

## User job

Send a precise offer in one short pass, review the price/people/time/message, and know exactly what was sent.

## Compositions considered

| Composition | Strength | Cost | Decision |
| --- | --- | --- | --- |
| Sequential wizard: amount → people → time → message | Each step has very little visual noise. | Extra taps for a small offer; obscures how the amount and people relate; adds UI state to a well-guarded command. | Reject. |
| Dashboard of equal tiles for every term | Easy access to any term and attractive at normal text size. | Treats money, optional message and time as equal priorities; narrow and enlarged text make the grid fragile. | Reject. |
| Open offer sheet: compact task context, dominant amount, people/time group, optional message, explicit receipt | One reading order and one action; the amount has clear scope; shared review/result anatomy makes the sent terms recognizable. | Requires ordinary scrolling for long task titles, large text and long messages. | Implement. |

The choice follows the blueprint's worker path, step 3. No new step, route, command or backend fact is introduced.

## What changed

- Task context now identifies the task quietly above the editable amount. Public place, time and available places remain visible and spoken as one group. Fixed task prices are still not repeated in the context.
- The offer amount has a larger Inter numeral, an explicit currency and its unchanged total-price explanation. Empty input has a text placeholder, never a fake zero. Focus has a clear edge; missing and invalid prices retain the original blocked action and recovery.
- People and time belong to one open white terms group. At less than 390 dp or text scale 1.3 and above, the stepper moves below its question. The controls retain their existing touch feedback and haptics. The time row has a modest 0.99 press response; the existing sheet owns the transition.
- Message entry has a visible optional label, a comfortable writing area and a focus edge. The 4,000-character limit and remaining-character behavior are unchanged.
- Review, saved intent and confirmed result share the same amount/people/time drawing. They also show the same trimmed message the command sends; previously the confirmed and unresolved receipt omitted that message.
- A confirmed result leads with its outcome and one existing success spring/haptic. It returns to the top of the replaced draft without animating or counting up any fact. Reopening an already-confirmed result remains still.
- Main action, summary suppression while the keyboard is shown, disabled reasons and all recovery branches remain in place.

## Boundaries checked in source

The route `src/app/(app)/prilike/[id]/prijava.tsx` remains unchanged. It still owns the active account and focus, need revision, fixed-price derivation, whole-number validation, availability and deadline, durable command, exact request identity, unknown-outcome readback, known refusal and exact replay. `composerDraftIssue`, `wholePrice`, `wholePeople`, `windowText`, the review key and final confirmation guard are unchanged.

`TOTAL` still locks the number of people to the full task; `PER_PERSON` still derives the total from the route's unchanged helper. Flexible time does not become an invented interval. An absent price remains ordinary text. The result is not shown on a tap: only the existing confirmed property admits it.

No server, service, dependency, provider, payment, device or real-data operation was performed by this scoped worker.

## Verification

- Existing composer read/selection and internal-gallery suites: **3 suites, 69 tests passed** with `-w 1 --testTimeout=30000`. Existing delayed-Jest-teardown warning was reported after successful tests.
- New receipt regressions cover the exact trimmed message in confirmed/unknown-outcome states, the explicit no-message case and truthful unknown-price wording: **1 suite, 4 tests passed**. The added unknown-price assertion failed before correction and passed afterward; no predecessor run is claimed for the other three.
- Integrator type check and full suite pass: **314 suites / 6,098 tests**. Native screenshots and source-bound APK remain separately recorded integrator gates.

## Native review targets

Inspect the actual gallery component with offered price, fixed `PER_PERSON`, locked `TOTAL`, review, confirmed outcome and uncertain/replay states. Check the 390-dp responsive boundary, 320-dp/font-2 rendering, focused amount/note with the keyboard, and preserved access to every message line. Success, price and count are fixture facts during gallery inspection, never evidence of a real submission.
