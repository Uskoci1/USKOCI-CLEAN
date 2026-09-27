# Round 17 — native calendar containment and consolidated client check

## Problem and evidence

APK run36330066989, source dfe2836ea522d3f61b7dafb449dbee4bc9c8105f, was hash-verified and installed with `adb install -r` on emulator-5556. APK SHA256: `197df5a50264ec10b767e286b27e94e99e446107dd366b4c527304d6d5a00cff`; 72,762,517 bytes. No app data or sessions were reset.

In the inert 1,000-item map scene, Search → Kada → Datumi → scroll reproduced a containment failure: the Kada card ended at native y1378px; day28–30 targets were clipped to58px instead of126px (48dp), and the helper began at1466px outside its ancestor. The last row visibly painted outside the white card. Evidence: `outputs/finalization-20260927/search-calendar-scrolled.png` and XML in the task workspace, outside the repository.

## Decision and implementation

The calendar already uses ordinary five/six-week rows. The likely fault is competing animated parent geometry during nested expansion; the exact native animation mechanism was not isolated. Native Yoga now owns the card/body intrinsic height. Press feedback, caret movement, modal transition and actual blur remain. No fixed height or overflow mask hides missing content. One guarded next-frame reveal waits for the current group/body/calendar measurements, retires on a new intent, drag, reader change or unmount, and does not depend on a content-size event always firing.

The ready AI review action now uses the existing brand-green primary treatment. Its action/admission remains unchanged. The inert Agreement gallery now places contact/location before administration, matching the already-shipped real route; the previous gallery ordering was stale and is not proof of current route composition.

Files: `DiscoverySearchPanel.tsx`, its existing regression suite, `IntakePresentation.tsx`, `dizajn-dogovori.tsx`. TaskCard and DiscoveryPeek are unchanged. No dependency, DEV, Edge, payment or certificate changes.

## Checks and limits

- Search baseline before edits:10 failed/15 passed because older tests still expected all sections open. Updated interactions explicitly open the approved accordion section; no domain assertions were removed. Intermediate24/25 failure was a shared listener mock. Final34/34 pass includes nine reveal/ownership regressions.
- AI layout:38/38 pass. No full-suite rerun.
- Initial integrated TypeScript failed on the new test's nullable animation-frame mock handle. The narrow mock correction was followed by a clean integrated TypeScript run (exit0).
- Native dfe scenes: map loaded; ordinary/owned pin and selected orange halo visible; pin opens the same task card; inert detail Back retains selected card; AI ready/recovery and keyboard composer reachable; Agreement overview/chat inspected. These use clearly identified local fixtures and are **not** proof of a newly created real task, live AI, photo upload, push delivery, realtime, account deletion or backend scale. The 1,000-card scene is not a concurrent-user benchmark.
- New calendar source, Round16 retained-tab fix and exact-lookup adapter are not yet in the installed dfe APK. Calendar native acceptance remains blocked until the next exact-source build is installed and containment rechecked.

## Backend and next step

P0 exact lookup has a9/9 disposable SQL proof but still awaits explicit `primeni`; its client adapter remains unused. Chat B3a/B3b remains applied under the prior approval. B3c invalidation source is prepared but unrun/not deployable; its metadata/target/rollback gates are separate from client tests. No certificate rebind is authorized by ordinary product work.

Next: consolidated APK, native five/six-week date containment and interaction, then continue map/list continuity and the separate realtime proof preparation. Dashboard generation is local; the known same-address file-chooser publication failure remains open.
