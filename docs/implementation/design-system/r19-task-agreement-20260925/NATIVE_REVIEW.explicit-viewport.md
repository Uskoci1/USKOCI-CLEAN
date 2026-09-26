# Exact 03cc3e48 native acceptance — 2026-09-26

Source `03cc3e48a47cc7b3ee3c6e2a14bc1aa4debaaf2d`, tree `9b129d0bb8fb7282c75e4aacd430ab884efd46d1`.
Both ABI builds passed source/tree/run/hash attestations and installed-base hash verification using `adb install -r`.
No uninstall, data clear or font change. Phone retained its owner's font scale 1.15; emulator used 1.0.

| Target | Run / installed UTC | APK SHA256 |
| --- | --- | --- |
| HONOR VKP_NX9 | 36227403801 / 07:51:27 | c7434dd8b784d2c1d7c67d99b77fe85af7f07ffc39d6b1628dabb869f8876653 |
| USKOCI_V5_TEST emulator | 36227405570 / 07:52:15 | bcaa0e472778a2a61eaf92d5b9bc67eddb168a2949dfd9f624abad12580757c2 |

## Passed within the observed scope

- Actual ten-task Discovery retains its scrolled position through detail/Back on both devices. Phone numeric events 75–77 and 92–94 request 459 dp and acknowledge 459.1 dp; both quick return during loading and return after a settled detail were exercised. Emulator events 68–69 request 642 dp and acknowledge 641.9 dp. Same row tails, full row and following row remain at approximately the same pixel bounds.
- An independent reviewer inspected phone `map-offset`, `map-return`, `map-return-settled`, `task-detail-settled` and `map-entry`. No new blocking clipping was found. The floating Map button covers a partly visible lower row; that ordinary overlay is not evidence that all end-of-list content is reachable.
- Phone map renders clusters, the vector USKOČI mark, labels, attribution and zoom controls. Own tasks retain their label; compact capacity appears at the lower right.
- The completed R18 Agreement starts with its accepted task/terms card. Tapping the card opens the matching source task; current task terms are distinct from the accepted Agreement snapshot. Contextual chat shows the actual two historical test messages and the terminal read-only state. The in-app header Back returns to the Agreement overview.
- Existing authorized publisher photos render on the emulator. This is a binary-read observation, not a new upload or all interrupted-upload recovery.

## Two failures still present on this exact APK

1. **Deep virtualized list return.** In the inert 1,000-row native gallery, 21 swipes reached rows 0041–0043. Opening row 0042 and returning settled at rows 0010–0012. `thousand-deep-final`, `thousand-detail` and `thousand-return` prove the mismatch. Initial hierarchy capture during return failed; the later settled capture is the actual result. Gallery tracing was not enabled/implemented in this APK, so there is no numeric trace for this failure. The source's early content-height clamp and RN's partial measured tail require a separate correction; the ten-row pass must not hide it.
2. **Android hardware Back from chat.** On the phone's closed R18 Agreement, `keyevent 4` from contextual chat popped the whole route to Agreement history. The header Back correctly stayed inside the route. `agreement-chat`, `agreement-chat-back`, `agreement-chat-reentry` and `agreement-header-back` distinguish these cases. Keyboard-first behavior was not exercised by this read-only terminal chat.

## Evidence and limits

Versioned APK/CAPTURES/TRACE files beside this report bind evidence to source. Original images and XML are under the outer workspace `outputs/r6-integration/r19f-phone` and `r19f-emulator`; manifests record their hashes. Names ending in `entry` or `detail` can capture a loading transition; the settled captures take precedence.

No new task, offer, rating, message, report, block, provider call, microphone use, location permission or server/schema/Edge deployment was performed. Opening existing chat may perform its normal read acknowledgement. Local gallery fixtures are never inserted into DEV. Rendering 1,000 local rows is not a backend/concurrent-user load test. No full-app, owner visual, iOS or store acceptance is implied. Preserve these failed cases even after a later APK fixes them.
