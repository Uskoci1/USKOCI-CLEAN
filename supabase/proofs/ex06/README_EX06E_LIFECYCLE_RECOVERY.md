# EX-06E — bounded Lifecycle Recovery

**Status: SOURCE CANDIDATE / EXACT REVERT / DISPOSABLE PROOF HARNESS PREPARED. NOT APPLIED TO CANONICAL DEV.**

This package deliberately replaces the isolated F10 promotion path. F5 stays outside this package.

## Authority model

- **Coverage** = `required_slots - SELECTED covered_slots`.
- **Search authority** = requester-owned `remaining_search_closed_at`; Agreement cancellation never clears it.
- **Time authority** = existing `response_deadline` when present, Need execution end for bounded schedules, and at most 24h after a cancelled Agreement's accepted end when that end exists.
- Unscheduled FLEXIBLE/REMOTE work gets no invented deadline.
- No new Need status or execution FSM.

## Server delta if later approved

Existing function bodies:
1. `private.dispatch_next_wave(uuid)`
2. `private.dispatch_tick(integer,timestamptz)`
3. `private.guard_remaining_search_close_fields()`
4. `public.rpc_cancel_agreement(uuid,text)`

New private objects:
- `private.need_search_time_admitted_v1(uuid,timestamptz)`
- existing `private.remaining_search_close_commands` is reused with a `reopen:` request-key namespace; no new table/schema delta.

New authenticated command:
- `public.rpc_reopen_remaining_search(uuid,integer,text,text)`

The reopen command is revision-bound, owner-only, replay-safe, requires missing capacity, preserves task terms, refuses a closed time window, clears only the three remaining-search closure fields and enqueues the existing dispatch.

## Minimal client/UI contract after server approval

No new read RPC is required. Reuse the existing authoritative `remainingSearchState(needId)` readback:
- client retains one `clientRequestId` exactly like close;
- write = `rpc_reopen_remaining_search`;
- success is shown only after fresh readback says `closed=false`;
- unknown outcome replays the same key;
- owner detail shows `Preostala potraga je zatvorena · nedostaje N` plus `Ponovo traži ljude` only when server time authority admits it.

Execution-time next action stays in the existing Dogovor completion/problem/cancel/change flow. EX06E does not add execution milestones.

## DEV boundary

Do **not** apply this package to `leqcwgzvjsxugfgzdmth` without a later explicit owner approval after the disposable suite is green.
