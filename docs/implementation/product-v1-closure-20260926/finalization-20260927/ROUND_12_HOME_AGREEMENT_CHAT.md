# Round 12 — a clear job, a clear next action, a clear conversation

2026-09-27. Client continuation from `db078401`. The owner asked for a deeper composition review of Home, Agreements and chat, with useful implementation in the same round. These surfaces were read together with their actual projections, routes and the UX blueprint. TaskCard and DiscoveryPeek remain unchanged.

## Product review

| Surface and user intent | Source finding | Decision and placement | Contract / remaining boundary |
| --- | --- | --- | --- |
| Home: start something or handle what waits for me | Both entry actions, authoritative attention reasons, personal-list counts and an Agreement preview already exist. Attention mixes the job title into explanatory prose. Multiple unavailable sections repeat actions that all reread the same overview. | Preserve the two entry actions. Give each attention row a distinct real job title beneath its action. Keep unavailable-section explanations near their content and offer one overview refresh. | Existing reads only. No invented priorities, earnings, unread counts or server reasons. |
| Home: see the next appointment | The preview sorted all active Agreements by the source task's date, including past work awaiting completion. A past row could be called the next Agreement. | Prefer a genuinely upcoming confirmed accepted start. Otherwise use neutral active-Agreement wording; past work remains reachable. The local clock chooses a presentation only, never a completion deadline or permission. | Use accepted terms, not the parent task's date. Missing accepted timing stays unknown. |
| Agreements list: find the right accepted job | The row displayed the accepted time but sorted by the original task time. Accepted rescheduling could contradict the order. | Sort known accepted starts chronologically, preserve stable order when unknown, retain filters and actual state rules. | The existing list response already carries accepted terms. No new RPC. |
| Agreement: know what we accepted | Accepted `scope_note` was used in proposed-change comparisons but discarded from the live Agreement projection. After acceptance it was no longer visible. | Preserve accepted scope and place it within accepted terms. A long note is an explicit disclosure, not an oversized extra card or a silently truncated sentence. | Current accepted version only. No fallback to the source task description. |
| Agreement: contact the other person or reach the job | Application/change/cancel/safety rows stood before Contact and Location. Collapsed Contact described only my sharing direction. | Contact and Location now precede administrative rows. The contact summary reflects both actual sharing directions without drawing a phone number while closed. | Existing lazy disclosures, private-location grants, expiry, guards and mutations remain. |
| Chat: answer the right person about the right job | At ordinary text size the header named a person but not the job. The same person can have several Agreements. | Show the real job beneath the person in a single overview target. Keep the profile photo as a sibling so its retry is not swallowed by another accessible button. | Back and context open the same accepted overview. Large-text/keyboard context remains scrollable. |
| Chat: write without losing the conversation | Even a short draft used separate input and toolbar rows. | A short draft, photo action and send share one writing surface. At larger text scale the draft keeps full width above its controls. The photo glyph describes the supported action. | Same mounted input, draft, photo tray and exact send/retry lifecycle. No voice button without a supported voice-message contract. |

## Why this composition

The goal is to identify the work before adding decoration. White surfaces, the existing green own-message bubbles, real profile imagery, clear text hierarchy and restrained separators already provide a consistent language. More cards or status badges would repeat facts instead of helping a decision.

Google's first-party case study of Airbnb describes a unified interaction system and hierarchy through typography and clear wording. It is a historical design case study, not evidence of Airbnb's current build. The applicable principle here is one recognizable system across navigation, context and actions; we are not copying Airbnb's accommodation UI. [Google Design: Airbnb — Communicating Clarity and Charm](https://design.google/library/airbnb-invites-you-in).

The accepted job remains the product anchor: Home attention opens the relevant work; Agreement shows its current accepted record; chat retains that identity and a direct return. No secondary statistics were added simply to fill space.

## Deliberately still open

- B3a/B3b disposable SQL/Auth proof passed earlier, but the new history/window/acknowledgement contracts remain **NOT APPLIED / NOT CLIENT-WIRED** pending the owner's explicit `primeni`. Source UI work does not activate them.
- The current private chat is not yet proof of bounded old-message history, exact-message push navigation, delivery/read receipts or voice messages. Do not draw those states speculatively.
- Home still relies on complete existing personal lists for totals and appointment selection. Correct ordering does not make those reads bounded or prove large-user performance.
- This round does not invoke a paid AI provider or establish AI conversation quality. Earlier location editing/recovery changes retain their own source evidence and native limitations.
- Native keyboard geometry, long names, enlarged text, profile-photo retry and the changed Home hierarchy still require one consolidated exact-build device review. No APK/install/device execution is represented here.

## Delivery record

| Field | Outcome |
| --- | --- |
| Problem / cause | Mixed source-task and accepted-term chronology; accepted scope discarded; chat identity incomplete; repeated overview recovery and unnecessary composer height. |
| Product / UX decision | Actual job and next action first; accepted facts stay together; practical access precedes administrative rows; no speculative states or extra dashboard statistics. |
| Implementation / files | Home snapshot, attention decoder and presentation; Agreement projection/decoder/list/terms; Agreement route practical sections; private-chat thread/composer; bounded focused tests. Exact paths and hashes are recorded in `ROUND_12_CHECKS.json`. |
| Backend / RPC | Existing read payloads only; no DEV/Edge changes, migration, dependency or payment work. |
| Tests | TypeScript PASS; 11 distinct focused suites / 317 tests PASS. Initial route failures and the corrected rerun remain in `ROUND_12_CHECKS.json`, alongside exact commands and final-source hashes. Counts are deduplicated within this round, not cumulative acceptance. |
| Device proof | NOT RUN. Source and mocked component checks are not screenshots or native acceptance. |
| Regression | Same mounted chat input and photo tray through keyboard/text-scale changes; exact retries and terminal reading remain; actual attention and missing-data states remain distinct. Accepted timing/scope require valid source data. |
| Git | Base `db078401`; source commit is identified by the subsequent control refresh. No PR or force push. |
| Status | Scoped client implementation; no whole-product READY claim. |
| Next important step | Apply/connect B3 only after explicit approval; otherwise continue client composition/recovery and prepare a consolidated device pass when requested. |

The living 62-row matrix remains `docs/control/redovi.json` → generated `FINALIZATION_MATRIX.md`. Generating it locally is separate from uploading to the shared dashboard; the existing chooser failure remains a publication blocker.
