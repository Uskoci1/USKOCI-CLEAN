# Round 05 — approved search disclosure and explicit location continuity

Date: 2026-09-27. Baseline: `b9c4dcdb` on `work/uskoci-ui-unification-20260924`.
Status: **SOURCE PREPARED / UNVERIFIED**. Native appearance, gestures and regression acceptance remain pending.

## Problem and decision

Search presented several editors at once rather than the owner's requested focused composition. The owner approved the white/green direction and supplied 13321.jpg: separated white groups, one expanded editor, summaries for the remaining choices, a blurred background. The user job is to choose the relevant place and conditions, understand the draft and apply it once.

The approved implementation keeps the actual USKOČI fields: place/query, time, work mode when applicable, group capacity and price mode. It does not add travel categories, invented recent searches or estimated counts. One footer action applies the whole draft; closing discards it. Existing TaskCard and DiscoveryPeek remain byte-unchanged.

A separate source defect was found in the explicit task-location action. Its loading render invalidated the render-bound callback that owned its pending GPS request. The correction binds that operation to a request, account revision, focus and edit intent. A returned position is still a proposal requiring the existing explicit confirmation.

## Implementation and files

| Surface | Source | Result |
| --- | --- | --- |
| Search | `src/ui/v2/discovery/DiscoverySearchPanel.tsx` | At most one expanded group; collapsed real summaries; retained filters/count readiness; restrained disclosure motion, keyboard/screen-reader handling and reduced-motion support. |
| Backdrop | Same panel and `src/ui/v2/DiscoveryPresentation.tsx` | A single fixed-intensity blur over the explicit underlying Discovery target. White cards remain opaque. Hardware-accelerated Android modal; SDK31+ texture support, older-version fallback; iOS reduced-transparency preference. |
| Dependency | `package.json`, `package-lock.json` | Exactly expo-blur57.0.3, explicitly approved and installed through Expo. No other dependency upgrade in the lockfile. |
| Task location | `src/ui/location/LocationPointEditor.tsx` | GPS request survives its own BUSY render; competing edits, account/focus changes and disabling retire it. A stale request cannot clear a newer operation. |

The blur target replaces the existing body View with identical style and layout callback. Search is outside that target, avoiding recursive capture. Installed Expo/Dimezis source supports the intended Android texture/window mechanism; that inspection is not evidence of successful pixels, frame rate or gesture behavior on a device.

## Backend / RPC

Existing filters, task data and location confirmation contracts remain in use. No DEV, Edge, SQL application, closure certificate, provider call, microphone, payment or account-data change occurred. GPS permission is requested only by the person's existing explicit action; no position was acquired during this work.

## Review, tests, device proof and regression

Source review covers draft preservation, apply/cancel, count authority, request ownership and installed blur API compatibility. Details and remaining cases: [SEARCH_ACCORDION_SOURCE.md](SEARCH_ACCORDION_SOURCE.md) and [P5_TASK_LOCATION_SOURCE.md](P5_TASK_LOCATION_SOURCE.md). The illustration and owner reference are design inputs, not screenshots of this code.

TypeScript, Jest, build, APK, phone/emulator, native location and end-to-end checks are **NOT RUN**, under the owner's current execution gate. Package installation/postinstall and dashboard generation are not app verification. Later consolidated checks must include accordion/calendar/rapid toggles, large text, keyboard, VoiceOver/TalkBack, map texture blur, Android Back, reduced motion/transparency, old-Android fallback and stale GPS completions. Existing test assumptions for simultaneously mounted search sections and Expo native-module mocks need review when test work resumes.

## Git, status and next step

This report is included in the source commit with `[skip ci]`, pushed to the existing UI branch. The single control tracker is updated and its matrix/state/page regenerated. Remote artifact publication must be reported separately from local generation.

P1 visual implementation is prepared, not accepted on a device. The earlier Round04 bounded public/message SQL candidates remain unexecuted and unapplied. Next priorities are exact-build consolidated acceptance when authorized, followed by the remaining P3/P4 message lifecycle and exact-message landing work. Voice, bounded Discovery at scale, complete matching and store readiness remain open; this package does not mark the overall product complete.
