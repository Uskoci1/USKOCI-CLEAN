# R19 native corrective build — observed 2026-09-26

Source `cb8ea1b9fc4fd96ff1736ec399772da76367d649`, tree `fbd0fa0ae607efcfc1d07fc9a8a5c5579b9a940f`. Emulator run `36197219982`, APK SHA-256 `122e467559f50d94a77048daa72f667616ba8e24e1b82a67b0a8ff5e9ae46bbe`, installed using `adb install -r` at 05:21 UTC; installed base.apk hash matches. Both attestations bind source/tree/run/hash; ABI is x86_64. Same USKOCI_V5_TEST emulator, host GPU, 1080×2424/density420/font1. Phone run `36197222607` succeeded and its ARM64 artifact is verified, SHA-256 `24789ac5b5853de43f3105b5105c84ad49cc8c84e73cda0892f5e76fc9550289`; ADB still lists only two emulators, so it is not installed on the phone.

## What actually passed

- `discovery-entry` → `discovery-half` → `discovery-full`: count opens the list in stops below search, real task capacities remain bottom-right. First frame of an unselected rich marker did not yet show its logo; do not claim immediate annotation readiness.
- `rapid-open-task` → `rapid-back-restored`: replayed the former failing sequence (full list → Map → immediate tap on still-moving task → Android Back). The compact list/count is restored. This closes the observed missing-sheet regression for this sequence.
- `discovery-novi-sad`: cluster tap narrows the count to 3 tasks in the viewed area plus4 without a point; native brand mark and cluster2/place labels render.
- `selected-task` → `selected-task-detail` → `selected-task-back`: the actual task/camera/selection survive. `selected-close-restores-list` restores compact list/count after closing the preview.
- `geographic-before-remote` → `remote-independent`: explicit remote choice clears the previous map-area label, hides geographic map/Nearby controls and shows the truthful empty current remote set. Local fixture evidence supplies remote membership cases; an empty live screen is not populated-remote acceptance.

## Residual defects found instead of declaring full acceptance

1. **Scroll is not restored on actual native return.** `stable-scrolled` clips the first title to its last line; after opening the own second task and returning, `stable-back` is back at the first title's beginning. Full height and geography survive. An earlier fast half→full drag also returned to the old half stop (`scrolled-before`/`scrolled-after-back`), consistent with the separately recorded requested-versus-physical stop issue. A mocked scroll command did not prove native acknowledgement. The scroll follow-up needs physical extension/content readiness and acknowledgement before retiring its restore target.
2. **Individual annotation image can disappear while map labels still render.** `selected-task` has the colored mark; `selected-task-back` has an empty white circle in the green Ponude annotation, although the map labels, preview and camera are present. `rapid-back-restored` has a colored unselected mark. This is a separate image/annotation lifetime observation, not the earlier global emulator renderer failure. The current onLoad/one-frame refresh does not close this native case.

An independent agent visually rechecked the selected/closed-pin, rapid return, scrolled before/after and remote captures and confirmed these bounded results. No device operation was delegated. No new message, account, task, provider call or backend change was made. Current source fixes, later tests/build and further native acceptance must be recorded separately from this build.
