# R19 native review — first build and follow-up

## Exact first build, observed 2026-09-25 22:08–22:17 UTC

Source `3cdb3005c393c2a47572452d3704c69de9799d25`, tree `1fa68354519fefc4bcfa6e1428433ab786bc6951`, emulator run `36193917101`, installed APK SHA-256 `a9328dc60c55bc38c4fe3ec946fa53f08518b3e9c411d56151cf8e1df3f86177`. Artifact source/tree/run, both attestations, ABI, downloaded SHA and installed base.apk SHA were checked. Installation used `adb install -r`, with no uninstall or data clear.

Device: USKOCI_V5_TEST / emulator-5556, 1080×2424, density 420, font scale 1. Actual PNG/XML and per-image hashes are in the outer workspace `outputs/r6-integration/r19-emulator/CAPTURES.json`. Phone run `36193913047` produced and verified the ARM64 artifact, SHA-256 `1f269b870969e4070b012d4e2db455ca93b4caf0a8fa763cfc915b3bfef0f1e6`; the physical phone was disconnected, so it was not installed or accepted there.

## Observations

| Surface | Actual result | Boundary |
| --- | --- | --- |
| Existing avatar | `profile-first` and `profile-photo-existing` visibly render the existing stored image; R18's same profile/editor showed a missing image. Publisher thumbnails also render in task/Agreement lists. | Read only; no new photo upload, removal or apply. The binary transport repair is demonstrated for existing JPEG reads. |
| Task list | `discovery-list-expanded` shows capacity `0/2` and `0/3` bottom-right, actual author photo/rating and active Zadaci navigation. Count tap moved compact→half→full below search. | The filename `discovery-list-full` is the intermediate half-height capture; expanded is the full-height one. |
| Agreement | `agreement-completed` begins with the accepted-terms task card, shows the saved rating state, and has a header chat action. Tapping the card opens the matching source task (`agreement-source-task`), and Back returns. | Source task has a flexible deadline and OFFERS budget; accepted Agreement shows its own 100 RSD and no exact appointment. Do not overwrite the immutable snapshot with current task fields. |
| Real chat | `agreement-chat-closed` displays both previously saved R18 messages, disables composition for the closed Agreement, and header Back returns to overview (`agreement-chat-back`). | Opening may settle notifications through the existing route. No new message or rating was sent. Incoming realtime/push delivery was not exercised. |
| Inert active chat | `inert-chat-keyboard` shows a two-line draft without clipping the first line; compact header Back returns to the inert overview. | Development-only fixture; no DEV/API writes, no send. It proves presentation, not message delivery. The gallery scene's below-fold footer is not an assertion about the production active route. |
| Remote choice | After narrowing the map, `remote-independent` replaces the area label with Na daljinu, expands the list, removes Nearby and shows an honest empty state. | The current live open set has no matching remote task. No synthetic live task was created to make this screen populated. Exact remote membership is additionally covered by local fixtures. |

## Native defects that prevent claiming the map complete

1. `discovery-first` and `discovery-cluster-zoom` show blank disks and no base-map labels. The native cluster-count font prop has a separately demonstrated Android bridge/parser defect; the explicit literal correction is in subsequent source, not this first APK. Whole-map symbol rendering may also be affected by the emulator renderer. See MAP_AUDIT and the upstream issue cited there; neither explanation alone proves the full cause here.
2. A rapid map-collapse/card-navigation sequence followed by Android Back left the sheet entirely absent (`discovery-return-from-task`, then `discovery-cluster-zoom`). The map, controls and filters remained. This is a real lifecycle defect; a passing sheet mock was insufficient. The focused correction and rebuilt APK must be recorded separately.

The capture `discovery-after-map-return` actually shows the public detail opened by the rapid second tap, not the discovery route. The manifest is corrected to reflect that observed screen. One UI-structure dump failed during navigation; no screenshot was saved for that failed attempt. The later successful capture is retained without claiming the failed attempt passed.

## Same-APK renderer isolation

The AVD configuration had `hw.gpu.enabled=no` / `hw.gpu.mode=auto`. After a normal emulator shutdown, the same AVD was started with `-gpu host -no-snapshot-load -no-snapshot-save -no-window`, without wiping or clearing app data. The installed APK SHA remained exactly `a9328dc6…`. Startup identified Intel Iris Xe with the Android OpenGL ES translator. In `discovery-host-renderer`, `discovery-host-novi-sad`, and `discovery-host-selected`, place/road labels, native cluster counts, the fallback USKOČI mark and the rich selected logo/Ponude annotation all appear.

This is measured same-APK evidence that the global blank-symbol observation was resolved by the emulator restart/graphics change. It is not evidence that the later font-literal source normalization repaired those blank symbols. The old APK already draws its counts in this renderer. No map library, renderer dependency, native production configuration or base-style label rewrite was changed. The physical phone still needs its own check.

Cluster navigation narrowed the footer from 10 total tasks to **3 tasks in the viewed area plus 4 without a map point**. Selecting the actual Novi Sad task showed its logo marker and bottom preview; the other group remained clustered. This demonstrates the live small-set geographic composition, not server paging or a 1,000-row performance result.

## Scope and further acceptance

No paid AI call, database/schema/Edge deployment, new test record, message send, account deletion or payment operation was made. R18's completed two-account scenario remains historical evidence for its exact build. This review is not the 1,000-user load test, the complete multi-person/offline/cancellation matrix, iOS acceptance or store readiness.
