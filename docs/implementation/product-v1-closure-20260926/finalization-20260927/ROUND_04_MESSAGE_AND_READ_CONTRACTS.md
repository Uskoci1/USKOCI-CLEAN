# Round 04 — connected reads, message intent and bounded server preparation

Date: 2026-09-27. Baseline client commit: `a1fe01e4edf7d91da4dcb6a02d55500cc82982bb`.
Status: **SOURCE PREPARED / UNVERIFIED**. No release, server application or device acceptance is claimed.

## Problem / cause

Opening a message notification acknowledged it before its destination was resolved. A failed landing could therefore remove an unread indication without showing the conversation. A queued native push tap also checked its effect's session but omitted the latest rendered router-readiness state. Separately, manual worker-interview correction stripped Unicode whitespace from already valid capability terms, unlike the canonical profile editor.

P0 currently needs a complete public-list read to find the published item. Private chat currently reads its entire history and acknowledges at Agreement scope. Those need bounded server contracts before a scalable client can replace them.

Calendar and support also requested per-Agreement ratings they never display, while Home requested per-task urgency it does not consume. Map renders repeated geometry serialization and initial-camera calculations. In deep account surfaces, a failed foreground closure read retained an old ready review, and an export expiring during a failed local-file cleanup suppressed the existing cleanup warning.

## Product / UX / UI decisions

- A MESSAGE_RECEIVED notification tap resolves the destination; the shown conversation owns its automatic read acknowledgment. Explicit Inbox read-all is still an explicit bulk notification action.
- Auth/recovery rendering retires a queued push navigation before passive cleanup. Keep the same Inbox fallback and strict current payload.
- An unrelated manual profile correction preserves the existing authored capability terms.
- Consumers explicitly skip only unused enrichment; missing facts stay unknown and all actual rows remain. Map geometry work follows data changes, not selection/layout rerenders.
- Closure re-entry must obtain a fresh review before offering a start. The durable intent/replay contract is preserved. An expired export cannot claim success, but the current owner must still hear about failed local cleanup.
- No card, map, route, layout or labels are redesigned by these client changes. The separate search proposal is now approved with the owner's accordion clarification (13321.jpg); its implementation belongs to the next source package.

## Implementation / files

| File | Change |
| --- | --- |
| `src/data/inboxModel.ts` | MESSAGE_RECEIVED open bypasses individual read/count mutation; current-row admission and awaited resolver ownership remain. Other events and explicit read-all retain their prior behavior. |
| `src/ui/notifications/PushRuntime.tsx` | Native tap checks rendered ready/account/revision/session before pending-route or navigation actions. |
| `src/ui/workerProfile/WorkerAiPresentation.tsx` | Capability lines trim ASCII spaces as the shared canonical validator does; no silent Unicode-edge normalization. |
| `src/data/ports.ts`, `agreementClientService.ts`, `needClientService.ts`, `src/app/(app)/index.tsx`, `raspored.tsx`, `src/ui/support/SupportNewScreen.tsx` | Explicit rating/urgency enrichment opt-outs only for consumers that do not use those facts. Defaults, all rows and existing guards remain. |
| `src/ui/v2/DiscoveryMap.tsx` | Memoize exact geometry fingerprint; lazily initialize the first camera state. No map/pin appearance or camera policy change. |
| `src/ui/closure/ClosureDialog.tsx` | A current restore clears prior review/execution eligibility before journal and server reads; failed refresh cannot reuse an old ready review. |
| `src/app/(app)/profil/izvoz.tsx` | Only current-owner CLEANUP_FAILED may remain visible after artifact expiry; stale ownership and expired success remain rejected. |
| `supabase/candidates/discovery_p0_exact_public_landing.sql` | Prepared exclusive exact-ID mode in the existing public reader, using the same public predicates/projection and additive revision. Not applied or client-wired. |
| `supabase/proofs/discovery/discovery_p0_exact_public_landing_proof.sql` | Disposable-only proof source with predecessor oracle, incompatible-input/RLS/projection checks and fixture rollback. Not executed. |
| `supabase/candidates/chat_b3a_private_history_read.sql` | Prepared bounded newest/older private message reader and exact displayed-ID event receipt. Not applied or client-wired. |
| `supabase/proofs/chat/private_history_read_proof.mjs` | Disposable-only proof source with Git-byte attribution, ordering/privacy/receipt/closure cases. Not executed. |
| `supabase/candidates/chat_b3b_message_window.sql`, `supabase/proofs/chat/message_window_proof.mjs` | One bounded authorized window around a known message, including old targets and exact two-sided cursors. Source only; no event resolver, stream, read write or client wiring. |

Exact contracts and review findings are in [P0_EXACT_PUBLIC_CONTRACT.md](P0_EXACT_PUBLIC_CONTRACT.md), [P3_PRIVATE_HISTORY_CONTRACT.md](P3_PRIVATE_HISTORY_CONTRACT.md), [P4_EXACT_MESSAGE_LANDING_CONTRACT.md](P4_EXACT_MESSAGE_LANDING_CONTRACT.md) and [P5_WORKER_FACT_SOURCE.md](P5_WORKER_FACT_SOURCE.md).

Additional evidence: [P3_MESSAGE_WINDOW_CONTRACT.md](P3_MESSAGE_WINDOW_CONTRACT.md), [P6_RATINGS_SOURCE.md](P6_RATINGS_SOURCE.md), [P7_EXPORT_SOURCE.md](P7_EXPORT_SOURCE.md), and [PRIVATE_PHOTO_MEMBERSHIP_FINDING.md](PRIVATE_PHOTO_MEMBERSHIP_FINDING.md). The existing photo helper's nullable-participant predicate is a separate conditional source defect; normal soft-delete closure does not create that state. Live affected rows/disclosure are unknown. New B3 readers use positive membership, but the existing sealed helper remains unchanged and needs a separately proven, explicitly approved certificate transition.

## Backend / RPC

**No canonical DEV/Edge changes.** Candidate/proof source does not authorize execution or `primeni`. Existing client RPCs remain in use; no caller invokes a prepared endpoint. No dependency, provider, payment, key, certificate or customer-data change occurred.

The exact public read is only a P0 landing primitive, not complete bounded Discovery search/count/cluster infrastructure. B3a is only history and displayed-ID event receipt, not voice, realtime, sender delivery/read ticks or exact push-message landing. Current generic native pushes still open Inbox. The live private thread acknowledgment remains coarse until the separately proven successor replaces it.

## Tests / device proof / regression

TypeScript, Jest, SQL proof, builds, APK, device and paid application-AI checks: **NOT RUN**, following the current owner gate. No earlier green run certifies these bytes. Root and independent-agent source reviews are review evidence only.

Deferred client cases: MESSAGE_RECEIVED resolve success/failure/unavailable without premature read; explicit read-all and non-message behavior; account/focus retirement during resolution; queued native tap at rendered ready=false and session switch; current warm/cold fallback; Unicode capability preservation through unrelated manual correction. SQL-specific later cases and proof limitations are documented with each candidate. Do not silently rewrite unrelated test expectations during execution.

Also deferred: default versus explicit enrichment options and complete-list parity; map data/selection/remount camera behavior; closure ready review → background → failed restore (no stale start) and durable unknown-intent recovery; current-owner expired export cleanup failure versus cleanup success, expired success, or retired owner. These are proposed checks, not executed assertions.

The visual proposal was created with the built-in image tool, repaired for white background and corrected to remove an invented price implication. It is not a native screenshot. The owner's subsequent 13321.jpg reference supersedes the flat section layout with one expanded group and summary rows.

## Git / control / status / next

The commit containing this report is source-only and uses `[skip ci]` on the existing UI-unification branch. `docs/control/redovi.json` remains the sole living tracker; refreshed matrix/state do not promote this package to READY. The authenticated remote Claude artifact still shows its old state: supported chooser attempts did not select the file, so remote publication is pending.

Next highest-value work: approved search accordion composition, task-AI continuity and P4 event-resolution/transport identity after the prepared message-window primitive. The owner approved the search direction and clarified it with 13321.jpg during this source round: one expanded white group, real summaries for the rest. Its implementation is the next separately reported source package; TaskCard stays unchanged. The owner separately approved expo-blur57.0.3 for that package. Consolidated verification is still pending. Voice, full bounded Discovery, exact-message push, matching quality and release gates remain open.
