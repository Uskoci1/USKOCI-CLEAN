# Round32 native acceptance failure and rollback

Candidate2b2cf4d7/run36355439009 was installed with-r on emulator5556; installed SHA and compiled flag=false were verified. Opening FULL, scrolling and pressing More produced an Android ANR. Choosing Wait restored the visible list, but the next More attempt showed the ANR again. No business data was changed.

## Direct evidence

- PID1912,2026-09-28 00:48:01+02: input MotionEvent waited5002ms.
- Main thread: `Log.w` → `NativeProxy.synchronouslyUpdateUIProps` → `NodesManager.performNonLayoutOperations` during `VirtualView.setClientRect`/SVG drawing and Fabric event dispatch.
- App-only warning window00:48:04.081–00:48:09.168:839 synchronous-update warnings across19 tags;840 missing-surface exception matches,8GC cycles and771 skipped frames.
- Exact error: `RetryableMountingLayerException: Unable to find SurfaceMountingManager for tag`.
- The sampled JS/native-module queues were waiting in nativePollOnce; RenderThread was waiting. This does not prove a global mutex deadlock or attribute the failure solely to emulator load.

Only the numeric summary, bounded explicit DEV trace and relevant UI evidence are committed. Raw Android/system diagnostics remain local. See [native receipt](ROUND_32_NATIVE_RECEIPT.json).

## Installed SDK source explains the repeated work

Reanimated4.5.1 `NodesManager.kt:129–134` calls the non-layout path during draw events. `ReanimatedModuleProxy.cpp:815–823` unconditionally applies synchronous updates from the animated registry. `UpdatesRegistry.cpp:165–174` returns all retained entries. `NativeProxy.kt:254–258` logs each failed native update. Failure does not remove the entry from this registry.

Disabling `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS` disables its timed cleanup, retaining entries for subsequent draw-pass updates. This is consistent with the recorded repeated missing-tag work and warning flood. Why each of the19 tags became unavailable is not fully established. The original Round31 hidden-body failure and this ANR must not be collapsed into one proved cause.

`ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` is already false in the installed defaults and gates ordinary updates, not this unconditional draw-pass path. Flipping it would not address the measured path. No second speculative flag or dependency upgrade was applied.

## Decision and verified rollback

Reject this candidate for phone rollout. Reverse exactly its four source/test changes and retain the diagnostic evidence. Runtime/config/assets/test/workflow source then matches10739a44; the remaining tracked changes are documentation only.

Restore exact10739a44 APK/run36353185115 with-r: installed SHA4c476cffb61ee40f25aee99b0d522723aafd60ae2314541ed1aaa1174b528a4e matched. Existing session and data remain. Map and10-task count loaded; count→FULL, the same scroll→More action and Back were observed with visible cards and no ANR in that bounded follow-up. This is scoped rollback recovery, not a performance benchmark or whole-app acceptance.

Candidate phone artifact36355441615 is verified but **WITHHELD / DO NOT INSTALL**. Physical phone remains USB absent. Previous10739a44 phone artifact36353187030 remains the finished-runtime candidate; native phone acceptance is still pending.

The original FULL-list disappearance after gallery navigation remains **OPEN**. Its next repair must target the measured property handoff/lifetime behavior without restoring this rejected global cleanup opt-out. The342-suite/7216-test candidate CI success does not override native failure.
