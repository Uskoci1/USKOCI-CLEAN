# R17 phone captures — independent second review

25 September 2026. Read-only review of four existing PNGs with `view_image`; no device operations, source changes or new captures. Screenshots are 1264 × 2728 source pixels. This note evaluates these frames only; the parent receipt owns source/APK attestation.

## Map selection → task → return

Compared [map-pin.png](C:/Users/user/Documents/Codex/2026-09-19/supabase-app-store-ios-apple-store/outputs/r6-integration/r17-phone/map-pin.png) with [map-return.png](C:/Users/user/Documents/Codex/2026-09-19/supabase-app-store-ios-apple-store/outputs/r6-integration/r17-phone/map-return.png).

- The selected green **Ponude** pin remains in the same visible position relative to the Voždovac label, park edges, streets, zoom control and preview. The camera does not visibly jump back to the initial regional view. Preview identity, title, route, date/time, person, rating/count and two-person requirement remain the same.
- A read-only pixel check supports that bounded observation: selected green-body bounds are approximately `(442,826)–(822,964)` before and `(443,827)–(824,965)` after. A coarse ±2-pixel alignment of the central map region favors `+1 px x, 0 px y`. The roughly 1–2 source-pixel differences do not establish a meaningful reframe; they are not proof of numerically identical camera bounds.
- [task-from-pin.png](C:/Users/user/Documents/Codex/2026-09-19/supabase-app-store-ios-apple-store/outputs/r6-integration/r17-phone/task-from-pin.png) shows the same wardrobe-moving task. Work title, origin, exact displayed interval, two people/zero filled, offers basis, full description and publisher are readable. The description contains the destination shown in the pin preview. **Sastavi prijavu** is fully visible above the system gesture area, with no observed overlap. The capture proves a visible control, not a successful application flow.

This supports camera/selection continuity for **one observed selected-pin detail return**. It does not close every map-return path, motion quality, fallback-marker failure, clusters, process recreation or R16-N03 as a whole.

## Initial Discovery and residual observations

[discovery-ready.png](C:/Users/user/Documents/Codex/2026-09-19/supabase-app-store-ios-apple-store/outputs/r6-integration/r17-phone/discovery-ready.png) shows a loaded map, two visible clusters, an offers pin and the sheet summary **9 zadataka · 4 zadatka bez tačke na mapi**. No loading/error surface is visible in this frame. The regional framing here is an earlier selection state, not the expected return target. It does not establish why the older post-install load failed or prove that issue resolved.

Two minor visible follow-ups remain:

1. **At-rest attribution truncation:** the rightmost credit is cut as `OpenFreeM…` in all three map frames. A horizontal rail/scrollbar is visible, so these PNGs do not prove the complete credit is inaccessible. Verify its full horizontal reach before classifying this as missing attribution; the present composition does not show all credits simultaneously.
2. **Search-hint truncation:** the secondary line ends `Bilo kada · Dodaj uslo…`. The control remains identifiable through its heading and filter icon, but the clipped action phrase is visibly unfinished. A shorter hint is a possible later copy refinement, not an observed functional blocker. The partly visible next quick-filter chip is consistent with a horizontal strip and is not separately called a defect.

No new blocking visual defect is established by these four frames. Initials instead of a portrait do not prove photo failure, and static images do not establish touch targets, screen-reader delivery, smooth animation, keyboard behavior, long-content scrolling, successful mutations or owner visual acceptance. USB disconnection prevented further phone observations; none are inferred.
