# R13 — measured first map framing

## Proven source defect

`DiscoveryPresentation` begins with a 124 dp tools estimate and no body measurement. Its half-sheet fallback uses
half of the entire window rather than half of the actual map body. `DiscoveryMap` previously captured those estimates
in a `useRef` and supplied them as the immutable native `initialViewState`; later layout never corrected them.

The regression reproduces a 924 dp window and a 790 dp map body. Before layout, the screen sends `fitBottom=534`;
the old camera adds its margin and freezes top 199 + bottom 558, leaving only 33 dp for the geographic bounds. After
layout the half-sheet is 395 dp and `fitBottom=467`. The intended measured padding is top 199 + bottom 491, leaving 100 dp.
`publicInitialBounds` separately adds 0.02 degrees around the real coarse public points; that geographic margin is
unchanged. This explains a credible excessive-zoom-out mechanism, not an independently measured native zoom value.

Installed MapLibre v11 source was inspected: `CameraOptions.padding` uses points, Android converts them by density,
and `CameraStop.clippedPadding` only prevents completely invalid padding by leaving roughly one physical pixel when
the requested edges consume the map. That native guard does not maintain a useful map window.

## Change

- The screen supplies `cameraLayoutReady` only after both its body and floating tools have measured.
- A remembered viewport remains the exact initial center and zoom. It never receives an automatic first fit.
- A new map's provisional bounds use small fixed margins, never the unmeasured overlays. Once the native map is
  ready, its frame exists and screen layout is ready, one imperative `fitBounds` uses the current real public points
  and measured overlays. It is instantaneous because it finishes initial layout rather than expressing a user gesture.
- The provisional viewport cannot be saved upward or become the list's area while this first fit is pending.
- A user pan, zoom/cluster choice, selected pin, Nearby request or explicit search fit takes priority and retires the
  pending automatic fit. Later dataset, sheet, tool or frame changes do not fit again.
- Explicit search fits also wait for native frame and measured overlays and share the same padding budget. When
  overlay measurements exceed the available map, padding is bounded to leave at least 96 dp (or half a smaller frame),
  rather than relying on the SDK's one-pixel fallback. This cannot create physical space where large controls cover
  the map; native large-text inspection remains necessary.
- Explicit fit acknowledgement, saved viewport, area debounce, Nearby consumption, selection callbacks and
  Reduce Motion behavior otherwise retain their existing contracts. No geographic filter, task data or server changes.

## Regression coverage

The tests drive native load, native frame, delayed overlay measurements and then camera dispatch; they do not merely
assert the constructor's padding. They cover provisional viewport suppression, one measured fit, no later refit,
minimum visible window, saved viewport, pan/zoom/pin/Nearby/explicit-fit precedence, a selection before readiness,
explicit-fit layout delay and the presentation's real 924 → 790 dp measurement sequence.

Targeted command:

`npx jest src/data/__tests__/discovery-map.test.tsx src/data/__tests__/discovery-map-pills.test.tsx src/data/__tests__/discovery-presentation.test.tsx -w 1 --testTimeout=30000`

Passed: 3 suites / 108 tests, 27.561 seconds. The first run exposed a test fixture whose map projection mock returned
no coordinate; the pin-priority scenario now supplies the same valid project/unproject results as a native map.

Full gates and fresh-scope native map screenshots belong to the R13 integrator. Returning to an existing map can
restore its saved viewport and therefore does not demonstrate the new first-fit path. No device, build, database,
dependency or paid-provider action was performed by this scoped task.

## Native follow-up: explicit selected-pin framing

The integrator's `be72399d` APK capture (`outputs/r6-integration/r13-experience/map-pin.png`, in the outer workspace)
shows a selected Belgrade task while the map still spans much of the Balkans. The original selected-pin effect moved
the center but supplied no zoom, so a coarse saved overview remained coarse after selection. This is separate from
the first-layout padding defect above.

An explicit new task or stacked-point selection now sends one native camera command with:

- the existing rounded public point, unchanged;
- zoom 12 or the closer saved/native-settled/user-requested zoom, bounded by the existing maximum 18;
- measured, bounded padding between tools and selected preview;
- the existing eased motion, or `jumpTo` for the system Reduce Motion preference.

Installed MapLibre `CameraOptions` and Android `CameraStop.toCameraUpdate` support center, zoom and padding in one
command. Using them together removes the previous asynchronous project/unproject offset, which would have been
computed at the old zoom and therefore wrong after zooming in. No exact address or additional location source is used.

A selection may wait for native readiness and measured layout, but is consumed once. A new selection replaces it;
pan, zoom, clear, a new dataset/scope, blur or an explicit search/Nearby destination retires it. An already-restored
selection is not replayed. Consumed search/Nearby requests do not block later pin selections. Later list, sheet or
frame changes do not move or zoom the camera again. Selection cancels pending area debounce and keeps `intent=0`, so
its settled bounds do not become an area filter. The current native settled zoom is held in a ref as well as the
existing viewport state, so an old incoming saved viewport cannot undo a closer native view.

Scoped verification:

`npx jest src/data/__tests__/discovery-map.test.tsx src/data/__tests__/discovery-map-pills.test.tsx -w 1 --testTimeout=30000`

Passed: 2 suites / 66 tests, 12.945 seconds. Coverage includes coarse-view selection, precise-input/coarse-output
coordinates, native/saved/in-flight closer zoom, stacked points, Reduce Motion, bounded large-overlay padding,
layout/readiness deferral, area-debounce cancellation, retired requests and no replay after ordinary updates.
`git diff --check` passed for the two changed source/test files (only the repository's LF-to-CRLF warnings).

This refinement changes only `DiscoveryMap.tsx`, its focused pill tests and this note. Full type/Jest gates, correction
APK and the resulting native screenshot remain the integrator's next checks; this note does not claim them completed.
