# CodeQL "Insecure randomness" — measured, understood, and accepted as debt

**Owner decision, 2026-09-21:** merge PR #102 into `clean-alpha-backend` and record this debt, rather
than fix it first. The fix needs a new dependency, which the owner's standing rule forbids
("CODEQL: Ne diraj sada. Ne dodaj `expo-crypto` niti novu dependency.").

This file is that record. It exists so the next person does not have to re-derive it, and so the
decision reads as a judgement with evidence behind it rather than as a deferral.

## What CodeQL reports

Six alerts on PR #102, five `high` and one `warning`:

| severity | rule | location |
| --- | --- | --- |
| high | Insecure randomness | `src/data/supportCaseJournal.ts:5` |
| high | Insecure randomness | `src/data/supportCaseJournal.ts:7` |
| high | Insecure randomness | `src/data/supportCaseJournal.ts:14` |
| high | Insecure randomness | `src/data/supportCaseJournal.ts:30` |
| high | Insecure randomness | `src/data/supportCaseWire.ts:8` |
| warning | Network data written to file | `scripts/acceptance/dev_ai_acceptance.mjs:332` |

## The first thing worth knowing

**Neither flagged file contains `Math.random()`.** Those five lines are sinks, not sources — CodeQL
tracks the value backwards to a single origin:

`src/lib/idempotencija.ts`, two functions, both shaped the same way: use `crypto.randomUUID()` when
it exists, fall back to `Math.random()` when it does not.

## Which branch actually runs on the phone

The fallback. Not assumed — established:

- React Native **0.86.3** defines `randomUUID` nowhere in its JS runtime (`Libraries/**`).
- No polyfill is installed: no `react-native-get-random-values`, no `expo-crypto`, nothing in
  `package.json` and nothing imported at an entry point.
- `crypto.subtle` appears in exactly one file in the whole project, `src/lib/dataExportFile.web.ts` —
  and that file is a `.web` platform variant, which exists precisely because native has no `crypto`.

So every one of the **81 call sites** of these two generators takes the `Math.random()` path on the
device.

## Why it is nevertheless not a vulnerability here

The value is a **`clientRequestId`: an idempotency key, not a secret.** Its whole job is to let the
server recognise "I have already processed this command". Every command table holding one is
account-scoped and behind RLS.

An attacker who predicts one gains nothing they do not already have by being authenticated as that
account. There is no path where guessing another account's key reaches that account's data — RLS
decides that, and it does not consult this value.

The generator's own comment already said this: *"ključ idempotencije traži jedinstvenost, ne
tajnost."* That reasoning is correct.

## The one failure mode that would actually hurt — and its measurement

If Hermes seeded `Math.random` deterministically, two cold starts would produce the same sequence,
two commands would collide, and a legitimate command could be refused as a duplicate or matched to
the wrong predecessor. That is a correctness failure, and it would be real.

Measured on canonical DEV, across every command table that stores a client request id, from real app
sessions including many cold starts:

| measured | value |
| --- | --- |
| client request ids | **258** |
| distinct | **258** |
| repeated | **0** |
| sharing a first-8-hex prefix | **0** |
| malformed version nibble | **0** |
| malformed variant nibble | **0** |

No sequence repetition, no collision, no structural defect. The failure mode that would matter is
absent in the data.

## The sixth alert

`scripts/acceptance/dev_ai_acceptance.mjs` is node tooling for the acceptance harness. The Metro
bundler ships what `src` imports; nothing imports `scripts/`, so it is not in the APK. It writes
acceptance output to a file on a developer machine.

## What would close this

One dependency providing a CSPRNG (`react-native-get-random-values` would be enough to make
`crypto.getRandomValues` real, and `crypto.randomUUID` follows). That is a one-line change in
`idempotencija.ts` plus an import at the entry point, and it would delete all five alerts at their
source rather than at the five sinks.

It is blocked only by the standing no-new-dependency rule. If that rule is lifted, this is a small,
well-understood piece of work — not a rewrite.

## Scope of this acceptance

This accepts **these six alerts, for this cause, on this evidence**. It is not a general waiver of
CodeQL, and a new alert of any kind is a new decision.
