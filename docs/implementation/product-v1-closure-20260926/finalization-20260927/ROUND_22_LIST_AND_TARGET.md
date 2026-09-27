# Round 22 — task-list continuity and prepared exact-message client

2026-09-27. **CLIENT SOURCE/CHECKS PASS; NATIVE PENDING. P4 ADAPTER UNWIRED.**

## Problem, cause and product/UX decision

My Tasks retained the native scroll offset while a changed section, search or applied filter replaced the result set. A new set must start at its first task; refresh and returning from a task must preserve the current place. The list now sends a nonanimated scroll-to-zero only when those applied criteria change. Unapplied filter drafts, cancel and unchanged Apply do not reset it. Existing TaskCard/Peek, ordering, actual/unknown application counts and navigation callbacks are unchanged. A virtualized list still mounts a bounded set of rows; this is not backend pagination or a load claim. Reference: https://reactnative.dev/docs/flatlist#scrolltooffset.

P4's prepared client reads only the candidate's exact account/event-bound message identifiers, with separate authoritative UNAVAILABLE, malformed and transport outcomes. It refuses extra body/media fields and stale account revisions, bounds the read to the existing15-second receipt deadline and supports immediate caller cancellation. It neither navigates, marks read, retries nor imports into a runtime route. The server resolver remains UNAPPLIED. Its pending disposable proof and future DEV approval are independent of passing decoder tests.

## Control-table correction

The scan previously described every source RPC string as a live app call, including unconnected prepared adapters. It now preserves all missing references but splits route-reachable and unconnected modules, using its existing static relative-import graph. Unconnected references remain visible with their file paths; no RPC is marked applied and no row/device is promoted to DONE. Static reachability does not prove runtime execution and needs review for unresolved dynamic imports. The generated JSON and executable page script parse; an initial verification command mistakenly parsed the embedded JSON as JavaScript, corrected by admitting each script type separately. Hosted publication is still blocked; changing the template requires a real republish, not merely local generation/upload of data.

## Files, checks and acceptance

- MarketplacePresentation + its presentation tests: four initial scroll regressions failed; final presentation/owned-route/memoized-row suites58/58PASS.
- activityMessageTargetService + focused decoder/service test:41/41PASS. Existing readOwnedResult15s timeout/account fence reused.
- Integrated TypeScript PASS. No full Jest repetition, paid AI/provider call, dependency, payment, DEV/Edge/certificate change.
- Round21 APK36339245682/f526a736 is building separately. It excludes this newer list/adapter work; no native acceptance is assigned to this source yet.

Next: verify the consolidated Round21 emulator build; finish exact-message SQL/Auth proof and the separately prepared owned-license projection. Bind client only after explicit server application approval. No whole-product READY claim.
