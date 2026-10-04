# EX-06 ex06c-F10 — closed remaining-search dispatch

**Status: SOURCE CANDIDATE PREPARED / STATIC CHECK PENDING / DISPOSABLE PROOF PENDING / NOT APPLIED TO DEV.**

## Problem

EX-06 S04 finding F10 proved on disposable chain that cancelling an Agreement can re-enqueue a task
whose `remaining_search_closed_at` is already set. The next dispatch attempts to insert a delivery,
the closed-search trigger refuses it, `dispatch_tick` records `ERROR`, and the queue retries every
10 minutes. A FLEXIBLE task may therefore retry indefinitely.

## Minimal correction

1. `private.dispatch_next_wave(uuid)` returns `STOPPED / REMAINING_SEARCH_CLOSED` before it creates a
   dispatch round when `remaining_search_closed_at` is not null.
2. `private.dispatch_tick(integer,timestamptz)` treats that stop reason as terminal, like
   `SLOTS_FILLED` and `NEED_NOT_OPEN`, and removes the schedule row.

No Agreement semantics, selection semantics, matching rule, notification rule, table, trigger, policy,
ACL, data row, cron or Edge function changes.

## Fresh canonical DEV preflight — 2026-10-04

Read-only against `leqcwgzvjsxugfgzdmth`:

- `dispatch_next_wave` predecessor prosrc md5: `1fd8c51ef026ece24471e2f68250ecc5`
- `dispatch_tick` predecessor prosrc md5: `e568b033b9457736869fc5829ffc5511`
- one exact anchor in each body
- predicted new hashes: `3cc3af3cdbafbfbc51a491ac2ce6581d` and `1600e4e3402d59c3ada13e3226a467c1`
- closure live digest equals certified digest `3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23`
- `retention_ai_source_ready() = true`
- neither target is a trigger function and neither is named by the closure digest helpers.

## Proof still required before approval

A disposable DEV-equivalent chain must reproduce S04 `T04b` before, apply this exact candidate, show
`tick.failed = 0`, no `ERROR` schedule row and no repeat failure, then run the exact revert and reproduce
the old finding. Exact function metadata/ACL and the closure digest must remain unchanged.

Only after that proof and an independent review may an approval block be promoted.

## DEV boundary

This document **does not authorize application**. Applying the candidate to canonical DEV requires the
owner's exact named word after the proof, proposed wording:

`PRIMENI EX-06 ex06c-F10`

A revert, if ever needed, is a separate state-changing action and also requires explicit approval.
