# Round 08 — separate task points in the AI conversation

2026-09-27. Source only, unverified. No tests, types, native/build, AI, geocoder/GPS/provider, database or server execution by this agent.

## Existing contract inspected

The conversation reads canonical `need.task_geography`; AI cannot create the manual-only `need.resolved_location` fact. The existing `rpc_get_need_location_review` returns the account/conversation, editable capability, revision and the current location facts. `rpc_save_need_location_review` requires that same expected revision and explicit confirmation. Its resolved value contains version 1, the country/geography/exact-address binding, and per-slot E6 coordinates, origin and optional private address/access notes. Client receipt decoding checks the returned confirmed value against the submitted value.

`locationSlots` follows the existing schema: STATIONARY uses `start`; POINT_TO_POINT uses `start` and `end`; MULTI_STOP uses `start`, ordered `waypoints/n`, and `end` when present. AREA_BASED may use `start`/`serviceArea`; REMOTE has no point. Pickup/dropoff are not additional fields. The existing labels are Mesto rada, Polazište, Stanica N, Odredište and Područje rada.

`LocationPointEditor` searches from the known slot text, lets the person select a real returned candidate or move/place a pin, and only emits a confirmed point after the explicit confirmation. GPS remains an explicit gesture and its Round 05 request-ownership correction is unchanged. No new provider behavior is introduced.

## Established gap and correction

`ConversationPointAsk` previously rendered only the first unconfirmed slot. Confirming the start removed it from the editor, so a person could not reopen/correct that point while confirming the rest of a route.

The conversation now keeps a separate compact row for every actual slot, in topology order, with its known location and confirmation state. There is still exactly one active map editor. Any row can be opened, including an already confirmed point. Opening it alone neither deletes the existing point nor writes. A changed point replaces the prior point only after explicit confirmation. Switching away from an unconfirmed edit asks before discarding that local proposal and retains previously confirmed points.

The added handlers are bound to the mounted account/revision, current focus visit and current editor view/slot. The location capability/revision remains server-owned. A synchronous save lock rejects repeated final confirmation. Refocusing cannot make an older callback current. Canonical reads still use the existing service and generation; server failures preserve the confirmed point set for explicit retry. The scope passed to the unchanged point editor includes the owner revision and local editor incarnation.

## Files and regression source

- `src/ui/location/ConversationPointAsk.tsx`
- `src/data/__tests__/conversation-point-ask.test.tsx`
- This report.

Regression source covers route rows and destination-first selection, reopening/moving an earlier confirmed point, discard/cancel while switching, multi-stop order/seeds, stale slot callbacks, duplicate final confirmation, blur and account ABA. Existing full-set save, same-value retry, confirmed reload and leave-confirmation tests remain. Root runs the authorized consolidated checks; no passing test/native result is claimed here.

## Explicit limit / smallest follow-up

The existing final-point auto-save remains: confirming the last missing point saves the complete set. This package does not add a separate all-points acceptance screen. If the product requires reviewing every completed point together before writing, the smallest next change is an explicit “Sačuvaj mesta” action after all point confirmations; that would change the current save semantics and was not silently included.

This inline prompt is mounted while the task still has missing points. Once the full set is saved, location changes remain reachable through the existing task review location editor. Task detail mini/full maps and external navigation belong to root's separate package; no public/private coordinate projection was changed here.
