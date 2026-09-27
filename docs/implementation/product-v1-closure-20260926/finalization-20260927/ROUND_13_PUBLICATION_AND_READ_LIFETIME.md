# Round 13 — publication intent and Discovery read lifetime

Date: 2026-09-27. Base: `3d15390e` (`work/uskoci-ui-unification-20260924`).

## Problem and cause

After a confirmed publication, the route waits for a fresh public collection before selecting the real task. During that wait the person can already search, drag the map/list or open another destination. The delayed completion previously reset their newer query, area and reading position. A background/foreground visit could also accept the old visit's completion before the replacement read finished.

The collection reader ignored retired results at the route, but still fetched later pages and profile/urgency enrichments after blur or the 15-second timeout. Relationship batches had the same missing cancellation path. Suppressing the result alone did not stop the extra client work.

## Product and UX decision

Automatic publication positioning is subordinate to a newer explicit action. Search opening/application, quick filters, map manipulation, list interaction or navigation consume that automatic positioning. Automatic map layout and viewport observations do not. The publication handoff still proves ownership; consuming positioning does not hide the task or remove the direct owner-detail recovery.

An unfinished publication read is retried under a fresh foreground/focus visit. A completed or explicitly retired landing is not rearmed by Back. A stale retry callback cannot revive it. Existing TaskCard, DiscoveryPeek, colors, pin artwork and layout are unchanged.

## Implementation and files

- `src/app/(app)/zadaci.tsx`: publication reads are bound to the current focus/foreground visit; explicit intent retires their positioning; completed-token guards cover read start, completion and missing/error retry. Both Discovery loaders pass their read signal through the existing 15-second boundary.
- `src/ui/v2/DiscoveryPresentation.tsx`, `DiscoveryMap.tsx`, `DiscoveryMap.types.ts`: report explicit user intent, including immediate map gestures before the delayed area update. Native callbacks from a departed visit remain fenced. Programmatic viewport observations do not consume publication intent.
- `src/data/focusedResource.ts`, `src/hooks/useFocusedResource.ts`: per-read cancellation on replacement, stop, forget and settlement. Existing account/generation guards and coalesced trailing refresh remain authoritative even when a transport ignores abort.
- `src/data/ports.ts`, `supabaseIzvor.ts`: optional read signal reaches RPC pages and relationship batches; account/revision checks remain at stage boundaries. An aborted walk refuses instead of publishing a partial collection or overlay.
- `src/data/publicProfileEnrichment.ts`, `needUrgencyClientService.ts`: cancellation reaches in-flight transport where supported and prevents queued enrichment from starting.
- Focused tests cover the corresponding route, map, presentation, resource and reader behavior. The Reanimated test double now supports the installed builder's `withCallback` method; it does not simulate native animation completion.

## Backend / RPC

No SQL, DEV, Edge, certificate, dependency or payment change. Existing `rpc_list_open_tasks_v3`, `rpc_get_my_task_relations`, public profile reads and `fn_need_urgency` retain their contracts. Cancellation asks the transport to stop and blocks subsequent client stages; it is not evidence that already-dispatched SQL execution was interrupted.

This package does **not** introduce bounded server filtering, a market-wide total, server facets or an exact publication lookup. The reader still walks its current collection within the existing limit. `discovery_p0_exact_public_landing.sql` remains source-only / not proven / not applied / not client-wired. Chat B3a/B3b retains its separate disposable proof and still needs explicit `primeni` before DEV application.

## Tests, regression and device proof

TypeScript PASS and **11 distinct focused suites / 279 tests PASS**. Exact commands, failures, corrected reruns, final results and source hashes are in `ROUND_13_CHECKS.json`. The new delayed-publication search tests failed before the production fix. Later fixture corrections preserve real constraints: canonical task IDs, one-shot publication token, explicitly opened accordion sections, enabled three-person filtering and the new optional signal argument. The large presentation suite required its requested 30-second test timeout; the default-5-second failures and unchanged-source rerun are preserved.

Coverage includes map/list landing, forged handoff refusal, blur/foreground races, old callbacks, stale retries, manual-versus-automatic map movement, route ownership, timeout/abort, account A→B→A, token refresh, subsequent pages/batches and hydration. Scope is focused client behavior, not all-app acceptance.

No full Jest suite, APK build/install, native screenshot, physical phone, emulator, provider, paid AI or whole-product load check was performed in this round. Earlier device receipts remain historical and cannot accept this source. No visual change or native success is claimed.

## Status and next step

Source and focused checks are recorded independently from release acceptance. Git source identity is the commit containing this report and its CHECKS; `docs/control/redovi.json.finalization.source_head` records that exact code commit in the subsequent generated-control update.

Next P0/P1 work: prove the exact-public-row candidate on a disposable database, then prepare the bounded Discovery predicate/cursor/count/map contract without dropping point-free work or changing the current filter meanings. DEV application remains separately gated. Chat B3 integration and mandatory voice remain later unfinished packages, not implied by this round.

Control rows A07/B04/B05 are updated in the same living matrix. Local generation is not remote publication: the previously recorded dashboard file-chooser failure remains pending; no unchanged upload attempt is retried here.
