# R10 — Home and responsive Discovery

Date: 2026-09-25. Final source `0f4d764464a33cd248726b46b261e63325fcbd49`, tree `0145815f81035fae2b139006a466b715a24c0c9a`.
Initial source `27415250` and its native observations are retained in the receipt.
Branch `work/uskoci-ui-unification-20260924`. This is a bounded client batch, not whole-app acceptance.

## Product decisions

| Surface | User's job | Compositions considered | Chosen approach |
| --- | --- | --- | --- |
| Home | Know what needs attention and recognise the next appointment. | Date tile is quick but cannot represent flexible or unknown dates truthfully; person-first invitation buries time; a calendar-led agenda card preserves the existing time phrase. | Time has its own tonal header; task, counterpart and role remain together on a refined white card. Both start actions, server-owned attention and own-list entries retain their hierarchy. |
| Search above the map | Reach the requested place, timing and filters while retaining room to see results. | Existing single cramped row; icon-only search; full-width summary with tools beside the quick-filter rail. | Adaptive full-width summary and a separate compact controls row for narrow or enlarged-text layouts. Existing full descriptions remain available to accessibility and the filter panel. |
| Map credits and preview | Read the map, recognise the selected task and reach attribution without overlay collisions. | Keep credits tied to zoom fit; draw credits above everything; reserve their own measured rail between tools/preview/sheet. | Attribution has its own full-width measured rail; optional zoom controls no longer determine whether credits exist. Bound list/preview geometry to the remaining space, preserving their internal scrolling. |
| Bottom navigation | Always recognise and reach Home, Tasks and Agreements. | Equal widths with broken names; icons alone at large text; content-aware width with measured label height. | Longer names receive more width at large text, decorative horizontal padding yields to words, and native text height determines bar height. No font shrinking, ellipsis or hidden labels. |

The white surface has restrained elevation and tonal boundaries. These choices serve reading and orientation,
not decoration. Existing press/sheet/camera motion remains the normal experience; system Reduce Motion is respected.

## Boundaries

Presentation and structured existing read fields only. No server/DEV/Edge/provider/payment/migration/dependency
change. No new state, date, count, address, person, rating or urgency is inferred for visual effect. Home attention
facts, routing, unavailable states, draft-before-Apply filters, map selection/camera/clustering and privacy remain
owned by their existing contracts. No fake account or task is inserted into DEV.

## Evidence

Work is not accepted from source alone. Focused checks, full types/Jest and bounded normal/large-text emulator
observations will be recorded against the exact source/build. Physical-phone and full two-party journey acceptance
remain separate. The original R7 Discovery large-text defects are the acceptance targets for this batch.

## Initial source and checks

The Home row keeps its existing spoken detail and route target, while separately exposing the same time phrase,
counterpart and role for composition. No displayed date is parsed or invented. Attention and own-list counts keep
their existing contracts. An internal-only Home gallery uses the real presentation with an inert header and actions;
it is not account data or a real journey, and production refusal is tested.

Discovery measures attribution independently from zoom. The selected preview keeps its registered scrolling and
close control. An oversized list header moves intact into the existing registered list; its identical width prevents
measurement oscillation. The available height, rather than header size, caps the full stop. Both populated and empty
results retain access to filter removal. Search and native navigation keep full accessible values and selected state.

The Agreement gallery removes an extra View above KeyboardAvoidingView so its origin matches the real route;
this fixes the fixture mismatch identified during R9. Product command behavior is unchanged.

`npx tsc --noEmit -p tsconfig.json`: exit 0.
`npx jest -w 3 --testTimeout=30000`: **312 suites / 6,063 tests passed**, 107.391 s, exit 0.
The existing worker teardown warning remains. Migration integrity passes with the unchanged 147-file inventory.
The first full run exposed a configuration-test harness directly invoking a React component; it now uses React's
lifecycle, with the same assertions. A full rerun passed. APK [36112841705](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36112841705)
is the combined emulator build. Its attestation, installation and bounded observations are recorded separately.

## Next visual batch — source read, not implemented here

- **Offers and candidate choice:** `CandidateCard` currently starts with a 40 dp portrait, identity/trust and value;
  enlarged text already gives price its own line. `CandidateCompareCard` already aligns price, people and time.
  Compare person-led cards, a dense price table and a larger editorial offer brief. Prefer person-led list cards
  plus optional aligned comparison; keep the existing explicit selection confirmation and unknown-outcome recovery.
  Full essential spoken facts are currently in the accessibility hint and should be reviewed with the candidate
  presentation, rather than claiming this UI batch fixed that existing concern.
- **Public profile:** `PublicProfileSheet` already uses the shared sheet, truthful trust availability, biography and
  safety entry. Callers may supply a 96 dp portrait, while the initials fallback is 56 dp. Compare a portrait-led
  profile, trust-dashboard tiles and a compact identity/experience layout. Keep a strong, consistent portrait and
  grouped trust facts; never manufacture ratings, verification or review content to fill empty space.
- **Worker profile/settings:** `WorkerProfileFrame` already owns safe-area/keyboard geometry and keeps save/error
  feedback visible while actions step aside during typing. Preserve this behavior. Compose its entry around work
  identity and completion needs, with grouped editing sections; do not replace the existing draft, activation or
  pending-save contracts during visual work. The AI interview and frozen review have their own R8 evidence.

These are bounded reads of the current implementations, not a new whole-repository audit or acceptance of those
flows. The master plan and control rows retain the remaining functional, provider, phone and release work.

## Native finding and bounded correction

Initial APK `36112841705` was attested and installed without clearing data. Actual existing DEV Home and Tasks,
normal docked chat keyboard, complete navigation labels at 320 dp/font 2, independently scrollable map attribution
and the inert long-appointment gallery were observed. These exact captures belong to source `27415250`.

Opening the search panel at 320 dp/font 2 exposed a concrete defect: the clear action consumed nearly all footer
width and squeezed the main label into a column of letters. Source `0f4d7644` gives both actions their own full
width below 360 dp or at text scale 1.3+, with no vertical flex growth that would consume filter space. Draft,
cancel, result-count and Apply behavior are unchanged. Four resize regressions preserve a typed query without
applying it; focused 22/22 pass. Final types pass; the full suite passes **312 suites / 6,067 tests**, 110.282 s,
exit 0, with the existing worker teardown warning. Correction APK `36115051955` passed both attestations and was installed preserving app data; bounded observations follow.

Extreme-layout limit still open: human chat at 320 dp/font 2 with docked Gboard leaves too little history space,
and the lower attachment/send row is partly covered. Reopening the keyboard did not resolve it. The identity
subtitle also truncates. This is recorded as a separate responsive-composition follow-up, not a whole-chat pass.
Normal docked keyboard and its visible commands are independently observed; no message or microphone action
was sent. The fixture uses real presentation with inert controllers, not a real two-party conversation.

## Final APK observation

Final emulator APK `36115051955`, source `0f4d764464a33cd248726b46b261e63325fcbd49`, tree `0145815f81035fae2b139006a466b715a24c0c9a`, SHA256 `7aef1b6305b60f4ed2ac701acdb23502c6a0e06a3fbd33122a1d71aad76d8be4`, 72,416,700 bytes. Both build attestations match.

- Normal existing DEV Home: both main actions, actual own task/application counts and active Home navigation visible. This account has no attention or upcoming Agreement; no filler is invented.
- Normal existing DEV Tasks: logo/offer pin, map/list, accessible tools, three map credits and selected Tasks navigation visible. No application or task write executed.
- 320 dp/font 2: search has its own row, tools remain separate, the credit rail remains above the list, and all three bottom navigation names are fully visible. Horizontal credit access is additionally demonstrated on the initial R10 APK.
- Search correction PASS on this exact APK: normal actions share a readable row; at 320 dp/font 2 both actions have their own full width. Prikazi 5 zadataka is fully visible, no vertical column of letters. Filter body can scroll to later timing/work-mode/person controls while the actions remain fixed. Back discards the untouched draft.
- Normal human-chat gallery: the full-width input, photograph entry and Send are visible above docked Gboard. Pending/failed fixture messages retain their status and retry entry. No text, attachment, retry or Send command was executed.
- Gallery observations use real presentation components with inert controllers; they do not prove the live two-party journey or extreme-text keyboard history. The latter remains an explicitly recorded limitation.
- Settings restored: physical density 420, font scale 1.0, original Gboard stylus-writing option ON. Only emulator-5554 is attached; no physical phone acceptance.

Normal display density/font and the original enabled Gboard stylus-writing option were restored. No paid provider, microphone, real send/application or database mutation was performed. Phone and actual screen-reader acceptance remain open.

The control table was refreshed locally; the existing Claude page was not updated because its authenticated file chooser previously timed out. No remote publication is claimed. The saved DEV catalog remains dated 2026-09-24.
