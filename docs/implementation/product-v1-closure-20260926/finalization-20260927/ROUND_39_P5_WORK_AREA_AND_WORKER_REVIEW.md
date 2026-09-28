# Round39 — work-area camera and worker AI review

Tested source: `1b11e046643c0f50cfa8eede360d03c0752eaab7`. GitHub Actions run 36415825211.

## User intention and changes

Discovery optionally reads the existing owned work area once on a pristine entry. A city name without an explicit coarse point is not geocoded. Saved point/radius supplies only a first camera footprint, never an applied filter, task pin or matching decision. Publication/search/selection/Nearby, remembered viewport, manual gestures, account changes and departure take precedence. The optional read has a four-second wait bound and never blocks the task list. A timeout does not claim cancellation of server execution. No GPS permission or location write is introduced; map tile requests may disclose the viewed coarse area to the existing map provider.

Worker AI uses one visible Pregledaj profil action above the composer, through the existing shell and guarded prepare/save/activation path. The compact draft still expands independently. The frozen review renders its own read-only coarse map, 220dp, with no invented point and no claim that candidate data is already saved. Review remains distinct from save/activation.

## Evidence

Before production changes: 8 regression failures, no test-suite runtime errors. After: TypeScript PASS; 8 focused suites/348 tests PASS; full Jest 344 suites/7259 tests PASS. The source commit above predates those checks. Exact hashes are in ROUND_39_P5_CLIENT_CHECKS.json.

The narrow execution script verifies exact predecessor bytes and allowed paths. The final push refuses a concurrently moved canonical branch and is fast-forward only. It invokes no business, provider or server commands.

## Boundaries

No TaskCard/Peek, DEV/Edge/certificate/dependency/payment change. No APK, phone, emulator, new screenshot, native latency or provider proof. The previous FULL-return source fix is retained, not declared device-accepted. Personal locality is separate from work area. The two privacy branches remain deferred. Web fallback is not claimed as native camera evidence.

P5 is not complete: task ready-card refinement, AI extraction/geocoding, real worker activation and field-to-matching proof remain. P6 bounded collection/load, voice B1/B2, account/privacy/legal/store/operations requirements remain open.

## Next exact-build native scenarios

1. Fresh entry with saved work point/radius: camera moves, criteria/task IDs do not silently change.
2. No point, read error or timeout: existing list/map remains usable without GPS.
3. Search/pan/pin/publication before a late response wins. Detail/Back preserves later viewport/list offset.
4. Worker AI review remains reachable above keyboard; its map belongs to the frozen review. Back sends nothing; save/activation remains explicit.
5. Small width, large text, reduced motion and actual map rendering on the same recorded APK.

Hosted control publication remains pending; the prior invalid_argument is not declared repaired.
