# Continue after R19 without repeating the audit

Updated 2026-09-26 against installed runtime source `a69a26c6`. This is the current work order; dated reports remain evidence, and `docs/control/redovi.json` remains the single tracker.

## First: improve deep-return speed, preserving the now-correct position

Both exact `a69a26c6` APKs are installed with attested and installed hashes:

| Device | Run | Observed result |
| --- | --- | --- |
| Phone | `36229901348` | Real-list detail/Back restores 749 dp (native ACK 749.1). Android Back from existing active chat hides the empty keyboard, then returns the same overview, then the list. No typing/sending. |
| Emulator | `36229903151` | Deep local 1,000-row return now restores 9,914 dp (ACK 9,913.9), same rows 41–43 within 3–4 px on two settled replays. Approximately 7.3-second reconstruction is not fluid/performance acceptance. |

Read `NATIVE_REVIEW.deep-return-chat.md`, `RECEIPT.json` and the matching APK/capture/numeric-trace manifests. The logical target now survives successive partially measured windows and clamps only at an actually measured data end; Android chat Back also passes on the phone. Prior failures remain in `NATIVE_REVIEW.explicit-viewport.md` and earlier versioned reports. Current tests: clean types and 321 suites / 6,326 tests; the incomplete Windows logging-harness attempt is recorded separately.

The remaining speed cause has a concrete source boundary: `if (focused) sheetMount.current = coverageOwner.sequence` and `<DiscoveryListSheet key={sheetMount.current}>` replace the native FlatList at each focus return, discarding measured cell geometry. The next bounded experiment separates native mount identity from fresh callback/focus ownership only after a verified settled departure with unchanged account scope, row content and layout. Keep remount fallback for interrupted springs or changed inputs, along with existing camera, coverage, readiness, portrait and drag guards. Prove the formerly failing interrupted-return cases as well as faster deep return; do not guess fixed row heights or merely remove ownership guards. Test the local large fixture on the physical phone too. Backend load/paging remains separate.

## Implemented: preserve these, do not prepare them again

| Surface | Current state | Still separate |
| --- | --- | --- |
| Task / Agreement / media | Task-led Agreement, contextual messages, actual photographs, compact capacity, remote filtering and rising/dimming list are implemented. JPEG reading preserves binary bytes. See `REPORT.md`, `MAP_AUDIT.md`, `MEDIA_BINARY_READ.md`. | Whole-app/phone acceptance and interrupted media recovery. |
| Rich selected pin | Existing vector BrandMark replaces the async image. `ba3f7dc3` native detail/Back kept the logo visible. | Recheck current APK. Older global missing labels/symbols were an emulator GPU issue, not the same defect. |
| Selection success, R18-V02 | One receipt-derived success row is now beside the pinned Open Agreement button. `ba3f7dc3` native inert gallery passed normal/1.3 font. | Post-selection Back stack and latest-build acceptance. Preserve `confirmed`, `fresh={!confirmedAtMount}`, accepted terms and manual navigation; the button was never missing. |
| Block confirmation, part of SF-02 | `SafetyScreen.tsx` asks before a new block. Cancel sends nothing; focus/account/target/context/read changes retire the question. Exact command/revision retry and explicit unblock are preserved. | Native confirmation acceptance and verified target name. Generic context remains honest; SF-02 is only partly closed. |
| Avatar discard binding | `mediaClientService.discardAvatar` validates expected profile + asset + current account. Initial and retained DISCARD calls provide that profile. | READY-only eligibility is unchanged. Unknown upload recovery remains open; mismatch retains uncertainty/journal. |
| Bounded optional reads / lifetime | R18 rating pool and retained chat refresh; R19 four-reader/four-second publisher pool, retired safety entry and Inbox reuse are implemented. | Per-invocation bounds start after collection loading; total per-row reads remain. They are not server aggregates, incoming chat or push delivery. |
| Local large-list harness | DEV-only `dizajn-mapa?count=1|1000`; `b5a82f69` natively exercised clusters, area counts, remote/onsite membership and empty state. | Not deep-scroll/frame-time/backend/concurrent-user proof. Fixtures stay local; ordinary map resources and session runtime still operate. |

See `CLIENT_GUARDS_AND_VIEWPORT.md` and `NATIVE_REVIEW.vector-diagnostic.md` for the implemented changes and exact evidence. Their older preparation paragraphs must not override these statuses.

## Next client work, after the APK result

1. **Feedback truth: R18-E01/E02.** Show allowlisted eligibility blockers and useful correction links without discarding uncertain commands. `serverReceipt.readOwnedResult` retains an allowlisted error message, not SQLSTATE/details; matching text is not a definitive refusal receipt. The inspected submit SQL replays saved success before eligibility and raises `WORKER_NOT_ELIGIBLE` before writes. Immediate journal release requires narrowly validated, account/request-owned refusal evidence. Timeout, malformed/absent receipt and reused key remain uncertain.

   Bounded source review on 26 September: the submit adapter retains calendar details but drops eligibility `hardBlockers`; useful guidance can be added there and in `ApplicationComposerPresentation` without a server change. Permit only known blocker codes and authored text, never raw details or private names. A secondary `/profil/radnik` link must remain available alongside a pending request. Preserve its amount, people, time and request key across profile return/remount. The current composer derives refusal from error-map membership (including `IDEMPOTENCY_KEY_REUSED`) and offers reset after collection refresh; that refresh is not an owned refusal receipt. Add regressions that eligibility text/reused-key plus a fresh list cannot alone release an uncertain journal. This is a next-package finding, not an applied fix or fresh DEV-body verification.
2. **Native continuity/accessibility.** Improve the remaining deep-return speed above, preserving its confirmed position and camera/selection/coverage/resets. Then verify/fix R18-E04's stale spoken Active count, R18-V01's docked multiline composer clipping and post-selection Back. The fresh phone empty-chat keyboard pass does not prove multiline sending. Its illustration clips slightly at the top and the normal person-bar subtitle ellipsizes; keep these polish items visible. A green test run does not close device findings.
3. **Safety target context.** Confirmation exists; `readBlock`/`readTarget` do not supply a uniform verified name. Correlate any displayed name with authorized Agreement participants or public-profile + target reads. Do not trust route labels, walk all blocked pages for a name, or disable reporting if the name is unavailable.
4. **Avatar recovery.** Keep the fixed binary read and profile-bound receipt. Before extending READY-only discard to known PROCESSING/STAGED assets, verify the active contract. Unknown/absent upload receipts retain the journal. TASK cancellation is not an avatar cancellation fence; no fake successful cancellation.
5. **Application facts: R18-E03.** Execution mode, end-only deadline and timezone need the additive projection below before truthful shared formatting. Never infer REMOTE from missing coordinates.

`moje-prijave.tsx` already reads `readApplicationCommandState(pending.row)` independently of the list. Preserve that named-row reconciliation when paging; the old list-only warning is superseded.

## Server proposals — proof first, explicit `primeni` before DEV / Edge

| Package | Required contract / disposable proof |
| --- | --- |
| Discovery pages/count/publisher | Same filters and visible area, whole-country zoom, remote versus on-site missing points, flexible/end-only/date overlap and stable cursor/counts; public approximate locations only. Existing RPC has a **3-by-5-degree bbox limit**, start-only predicates and no total count. Do not blindly forward client bounds/filters. Prove 0/1/1,000-row parity, RLS and query cost; current client still walks up to its 5,000-row guard. |
| Home / Agreements / reviews | Bounded next work and all four attention reasons/counts; unavailable is not zero. Prove active work and pending commands survive 0/1/1,000 completed rows. Existing pools are mitigation only. |
| Application facts / candidate paging | Add real mode/end/timezone; page the candidate aggregate while preserving selectable/historical counts, response hash/version, task revision, both price bases, team slots and competing final-slot selections. Virtualization does not bound SQL/network work. |
| Human chat | Latest/older pages, incoming reconciliation and exact displayed-message acknowledgement. Prove reordering/duplicates, arrivals during acknowledgement, long history, offline commands and account retirement. Notification settlement is not a read receipt. |
| Closure / media recovery | Discover account-owned closure without the original local START key; correct media cancellation lock ordering. Disposable concurrency/erasure proofs and separate approval for any protected certificate movement. Never delete a real account to test it. |
| Review comment | Define length, audience, report/moderation, retention and erasure; candidate SQL + clean proof + client contract before an input. Saved ratings already exist; a comment RPC is not implied. |

Keep packages independent from visual work. Payment/PKG-051 belongs to its owner.

## Non-negotiable evidence and release boundaries

- **R18 succeeded within its scope:** two accounts, one-person REMOTE/flexible-end-only/OFFERS task through both saved ratings. Preserve that result; do not restart it as unproved or call it real paid work. `Zatvoren` is a grouped terminal label, not proof of raw `COMPLETED`.
- **The R18 paid-AI allowance is used.** New task/worker provider trials need separate approval; worker interview-to-activation and representative quality remain unaccepted. Microphone tests require owner readiness. Android dictation, unavailable iOS dictation and future spoken AI replies are separate.
- **Preserve privacy/recovery:** account/incarnation fences, exact receipts and journals; no invented names/reputation/counts/permission. Private report text, contact/address and legal data stay out of push payloads. A form is not staffed moderation.
- **Remaining acceptance:** onsite/private address, competing/team offers, changed terms, cancellation/disputes, offline/replay and third-account isolation. Use approved scenarios and disposable databases for destructive/concurrent permutations. Real push needs permission → registration → authorized delivery/receipt → lock-screen display → warm/cold tap to the correct account/destination; no blanket sending activation.
- **Release gates remain:** operator/legal consent/publication, retention and actual export delivery, support/moderation ownership, production configuration, signed AAB, iOS/TestFlight, payment decision/implementation and store evidence. A price-list proof is not checkout/refunds or store acceptance.
- **DEV observations are dated:** R19 ledger 202; fresh private certificate/retention query denied. September 24 snapshot is historical, not refreshed by dashboard generation. No secrets handling, JWT weakening, certificate movement or DEV/Edge application without the required approval. Frozen/applied migrations and real records are not cleanup material.

Use `FUNCTIONAL_RECONCILIATION.md`, `AI_ACCOUNT_AUDIT.md`, `FLOWS_AUDIT.md` plus later addenda as bounded evidence, not a reason to repeat the entire audit or count every old R6 row as a current defect. Finish coherent batches; bind acceptance to exact source/tree/APK/device and preserve failed iterations. Update the single tracker and run `node scripts/control/osvezi.mjs` after actual work; remote publication requires an observed successful import.
