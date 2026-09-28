# Round35 — P2 application compose / edit / withdraw source closure

Date: 2026-09-28. Current branch is code-equivalent for these surfaces to tested code `b06480512d197168c0ef857bb151a0e143b3a667`; later commits in this session only update control/evidence documents.

## Product review

The current application path already follows the runbook's intended order: task context → total offer / people / time / optional message → explicit review sheet → send → confirmed facts. It does not silently submit from field editing. Fixed task pricing is presented from the same Need revision as the command; current client semantics support explicit TOTAL / PER_PERSON / OFFERS and do not restore the withdrawn historical people-count gate.

The current sent/unknown/rejected states are separate. The durable command identity is saved before I/O, unknown outcome reuses the same immutable command only after owned readback, and confirmed refusal opens a new reviewed intent rather than mutating the old command.

The stale-application surface supports KEEP / UPDATE / WITHDRAW with exact Need/application versions. Ordinary withdrawal has a consequence-aware confirmation and sends nothing before confirm. Cancellation, double answer, blur/refocus, background, account incarnation, late read/write, malformed receipts and failed readback are fenced.

## Exact source proof

GitHub Actions run [36400916665](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36400916665), full Jest **342 suites / 7,214 tests PASS**, includes:

- `application-selection-native.test.tsx` — PASS. Relevant cases include explicit offer review, exact interval send, duplicate-tap serialization, unknown-submit readback, fixed TOTAL and PER_PERSON pricing presentation, confirmed sent result and exact Agreement routing.
- `my-applications-native.test.tsx` — PASS. Relevant cases include withdrawal only after explicit confirmation, cancellation with no write, double-answer fencing, stale WITHDRAW authority, unknown UPDATE identical retry, late/account/background retirement and exact saved-interval comparison including microseconds.
- `application-selection-client.test.ts`, `my-applications-command-state.test.ts`, `my-applications-interval-client.test.ts` — PASS.
- TypeScript exact candidate — PASS.

No application UI/business source change was required in Round35 because the current implementation already satisfies these client contracts. The old tracker value `NIJE POKRETANO` was stale relative to the current branch/full run.

## Deliberate backend boundary

This does **not** close the independent server price-authority question for a task whose requester sets a price. The client derives and locks the price from the current Need, but a modified client must not be treated as proof that the server enforces the same commercial rule. No PKG-049/price package is applied here; prior owner constraints require a separate explicit server-application authorization. The previously withdrawn rule `people_needed > 1 => OFFERS` is not reintroduced.

## Device status

Historical real sends and withdrawals/read-only surfaces remain historical. No exact current APK was installed in this execution session. Native proof still needs the consolidated candidate: compose/review/send, reopen My applications, withdraw on a disposable application, cancellation path, background/return and unknown-outcome recovery where safely reproducible.
