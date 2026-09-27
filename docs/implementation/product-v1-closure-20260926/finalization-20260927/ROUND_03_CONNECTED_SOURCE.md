# Round 03 — connected source and bounded reads

Date: 2026-09-27. Baseline: `6bf4e0a06b870d5277cef9b0011c6ac76dacb05c`.
Status: **SOURCE PREPARED / UNVERIFIED**. This is a client source package, not release acceptance.

## Problem and cause

- Discovery accepted some malformed pagination envelopes as successful termination, and did not validate strict page progress. Its page walk could continue after the initiating account revision changed.
- A map-area change rebuilt the full shared-filter collection and therefore its downstream map source, despite area membership affecting the list only.
- A notification row or route callback retained across a page/filter/focus change could still initiate a read acknowledgement or navigation. Profile and notification settings had related retained-callback ownership gaps.
- Group read acknowledgements shared the same lock as user commands; a slow receipt could suppress a send/refresh tap. An optional context response could overtake newer work.
- The private Agreement's coarse read acknowledgement could run when messages arrived before the Agreement workspace was ready, even though the conversation was not yet shown.

## Product / UX decision

Keep the existing cards, layout, colours, navigation destinations and business commands. An action belongs to the account, screen visit and event that presented it. A list is complete only after valid progressing pages. Background work must not take the user command lock or settle a hidden conversation. The existing work-mode filter applies to all public tasks, including the owner's tasks; ownership changes their label/destination, not their visibility.

No new visual composition is applied. The approved white/orange pin and P0 publication landing remain separate earlier packages. The rejected card proposal remains rejected.

## Implementation / files

| Scope | Source and change |
| --- | --- |
| Discovery reader | `src/data/supabaseIzvor.ts`: validate object envelope, bounded page size, boolean continuation, timestamp, exact UUID/microsecond order and duplicate identity. Bind the walk and enrichment boundary to the initiating account ID/revision. |
| Map/list work | `src/data/marketplaceView.ts`, `src/ui/v2/DiscoveryPresentation.tsx`: separate shared filtering from geographic partitioning, retaining the same order and point-free tail. Removing a chip retires pending publication focus; full-list spoken count retains geographic context. |
| Existing filter consistency | `src/ui/v2/discovery/DiscoverySearchPanel.tsx`: work-mode availability reads the same public collection, without excluding the owner's rows. No new filter or layout. |
| Profile/settings | `src/app/(app)/profil.tsx`, `src/app/(app)/profil/obavestenja.tsx`: bind callbacks to the rendered focus/account and, for discard decisions, the rendered role/dirty/writing state. |
| Agreement | `src/app/dogovor/[id].tsx`: rating/safety navigation uses existing focus authority; coarse read acknowledgement requires a shown, ready, current-member conversation. Exact-message acknowledgement remains server contract work. |
| Inbox | `src/app/obavestenja.tsx`: rendered visit fences navigation, awaited resolution, role switch, paging, read-all and refresh. `src/data/inboxModel.ts`: only a currently loaded event with matching immutable ID/type/role/time can start open/read. Server resolution still owns the destination. |
| Group chat | `src/ui/groups/GroupConversationController.ts`: separate bounded receipt queue/lock; revalidate visible IDs and fence optional context refresh by operation revision and context identity. Existing denied-read clearing and send recovery remain. |

## Backend / RPC

No server mutation, migration, Edge deployment, new dependency, key or customer-data change. Fresh read-only metadata for `rpc_list_open_tasks_v3` is recorded in [P1_DATA_CONTRACT.md](P1_DATA_CONTRACT.md): full definition MD5 `8a47d061da5f9bd65b5e3cc6c947d5d7`, normalized body MD5 `18b5518140c519b96728d1e25fa3c29d`. These are different hashes of two explicitly different representations of the same function.

Existing pagination still reads up to 25 pages of 200. This package does not establish server filtering parity, stable snapshots, global counts, bounded map clusters or load capacity. Private history still needs a bounded server reader. Push remains the existing generic Inbox transport, not a demonstrated same-message deep link.

## Tests / device proof / regression

**NOT RUN**: TypeScript, Jest, disposable proof, build, installation and device acceptance remain deferred by the owner. An optional request to authorize consolidated verification is pending; elapsed time is not approval. No old test/APK/device receipt certifies this source.

Root source review and independent agent reviews cover Discovery ordering/geography, notification ownership and the group receipt lock. Detailed findings and deferred cases are in [P1_DATA_CONTRACT.md](P1_DATA_CONTRACT.md), [P2_SOURCE_ROUND.md](P2_SOURCE_ROUND.md) and [P3_SOURCE_ROUND.md](P3_SOURCE_ROUND.md). No execution result is inferred from those reviews.

When authorized, cover malformed/empty/repeated/oversized/out-of-order pages, exact microseconds and UUID ties, account changes between pages/enrichment, map pan retaining the shared source, existing filters with own-only known work modes, stale Inbox events/role/back/read-all callbacks, delayed resolution after blur/refocus, private acknowledgement before workspace readiness, and group receipt/send races. Existing synthetic Discovery reader fixtures must adopt valid UUIDs and progressing cursor keys before testing their original intent. P0/pin fixtures from the preceding package also require their documented update.

## Commit / control / next

The commit containing this report is source-only with `[skip ci]`, on the existing UI-unification branch. The 62-row tracker is refreshed with no READY or new phone evidence. The remote Claude artifact import remains pending after the previously recorded supported file-chooser timeout; generated/committed state is not remote publication.

Next prepared work: additive exact public publication lookup and bounded private chat history/exact displayed-ID receipt candidates, each with isolated proof **source**. They require separate proof execution and explicit owner `primeni` before DEV application. Full voice, same-message push, matching/taxonomy, growth and release gates remain open; this report does not close the whole product.
