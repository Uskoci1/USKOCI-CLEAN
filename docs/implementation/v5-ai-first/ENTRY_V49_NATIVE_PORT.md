# Native V4.9 entry correction

The owner V5 command preserves the original V4.9 entry, photographs, handwritten
notes, mascot, timing and HOME signature. Checkpoint138 still used an older SPOJ
V2 final composition. This source correction ports the actual V4.9 composition
to React Native, Expo Image and SVG; it imports no HTML/demo navigation or parser.

Source: `USKOCI_V5_AI_FIRST_PAKET/07_REFERENCA/USKOCI_SPOJ_V4_9_COMPOSITION.html`,
2241863 bytes, SHA256
`e272a5bf81971765d871bdf8ad9e16a02b9a731bec835477f0cda09415f2dcdc`.
The package's V5 HTML preserves this original prefix. Real Google Chrome
152.0.7977.83 executed the exact source with external requests blocked at390×844.

## Original assets and geometry

The four local assets in `assets/brand/entry-v49/` are extracted without
re-encoding. `provenance.json` records each exact byte count and SHA256.
`scripts/extract-entry-v49-assets.cjs` requires the exact source hash before any
output. `entryV49Notes.ts` contains the same self-contained SVG bytes for native
SvgXml; photographs remain the original WebP73762B and JPEG239882B.
The donor labels the worker data URI `image/png`, but its unchanged payload is
JPEG. The native asset is therefore `worker.jpg`; provenance retains both the
declared and actual MIME. The SHA256 remains
`c25266122c8c47f96994c6cff05f9e5e5b7428de4a9d78521eb6f4084612d3d3`.
No pixel or compressed byte is changed by this extension correction.

`entryV49Layout` ports `s37Layout` and the final V396 correction exactly once.
With the reference's real text measurements at390×844: white brand plate74%
wide, y33.93; copy y204.93; photos x7.41 per half, y308.93,180.18×357.404902;
notes y678.61268; auth footer y760. Photographs use cover at50%/4%, radius22.
The center seam is a full-height3px white line with the three original glows.
The two fields retain their original colors, gradient and subtle ellipse.

Native text is measured rather than assuming Chrome's font metrics. Actual safe
insets and larger48px auth hit targets extend scrollable content; they do not
shrink the authored photographs or clamp text scaling. At large text, both
columns and photographs remain, arrows move below titles, and both SVG captions
become reflowing native text, following the source's accessibility treatment.
The tagline also honors the native system font setting.

## Motion and authority

`BrandScene`, `spojBrandMath`, the original4380ms clock, native splash preparation
and draw handoff remain unchanged. New pure worklet geometry follows the final
`s37IntroParts` windows: photo3730–4270, copy3840–4210, note4020–4380. The final
seam uses smoothstep3970–4400. Actual settled frame4380 and reduced-motion final
state are separately tested.

The760ms choice sweep moves the original selected scene into the expanding
color field, scales its photograph uniformly from its top center, moves the
note, and opens the original pale doorway from below. The final CSS hides the
footer immediately, overriding an older JS fade. The final photo is12px taller
than `S37.size.photoH`; note travel deliberately uses the original unadjusted
height, confirmed by executed reference samples.

Existing real intent callbacks, revision/ABA fences, one pending callback,
background/unmount cancellation, error handling, and reduced motion remain.
Viewport/font changes also cancel an incomplete sweep. Both auth controls use
existing auth sheet callbacks. The only auth route change adds `onSignUp` →
the existing SIGNUP mode. No server command runs on mounting the welcome.

## Verification and motion review

`scripts/capture-entry-v49-reference.cjs` records11 intro frames,7 choice frames,
normal/large text geometry and screenshots from actual Chrome. The checked
fixture is `src/data/__tests__/fixtures/entry-v49-chrome.json`; tests compare
these observed values to the native pure adapter, not to a copied mock engine.
Reference screenshots are in ignored `artifacts/v5-native-smoke/`:
`v49-reference390-entry.png`, `v49-reference390-large200.png`,
`v49-reference390-requester500.png`.

| Before | After | Why |
| --- | --- | --- |
| Older text-only final composition and generic intent motif | Original photographs, vector notes and selected-scene movement | Owner's protected V4.9 identity |
| Both intent scenes vanished immediately | Selected scene continues while the opposite scene fades | Exact source spatial continuity |
| Only sign-in available in welcome footer | Existing sign-in and signup sheets have their source entry actions | Complete source flow without new auth behavior |
| Fixed older geometry | Measured source layout, real safe insets and scrollable text | Preserve identity while keeping enlarged controls reachable |

Source verdict: approved within the owner's explicit original-motion exception.
The4380ms intro and760ms scene selection are authored identity timing, not new
high-frequency animations. Selection uses UI-thread transform/opacity; only
the existing source panel shadow and the short doorway corner interpolation
remain paint properties. No frame-rate/device feel claim is made from unit tests.
Reduced motion bypasses the choice animation and exposes static complete artwork.

Local verification: whole-repository TypeScript passed;11 focused entry/auth/
splash/clock/client suites passed198 tests. New assertions cover exact asset
hashes, actual Chrome frames, large text/safe insets, pending callback/session
fences, and the real signup sheet callback. No live or provider calls.

**Native visual fidelity remains pending until a new exact-source signed APK is
built, installed and compared with these references.** Checkpoint138 evidence
continues to describe only the old APK and is not retroactively promoted to PASS.

## Rejected mixed-source Android package, 2026-09-13

The first4a06c9cd5b169d029f6a085f1a809e80aa8c28c1 build in detached `u50`
completed all normal release tasks, with matching signer and config identity.
The resource check then found the original portraits absent. The packager map
proved that231 first-party modules still came from `uskoci-v5-apk138`, including
its older EntryWelcome, through the shared Expo Router transform cache. This is
a real wrong-source package, not merely renamed Android resources. It was not
installed or declared a valid source4a APK.

The rejected APK, packager map and hash receipt are retained locally under
`artifacts/v5-native-smoke/rejected-4a06c9c-mixed-router-source/`. A second
cache-reset attempt produced the same rejected bytes: the installed Expo
export command ignores resetCache under CI=1. A third attempt with CI=false
actually rebuilt the cache and restored the exact4a JS graph and original
assets, then failed AAPT because worker.png contained JPEG bytes. Its exit1,
map-only source proof and logs remain in
`artifacts/v5-native-smoke/rejected-4a06c9c-invalid-asset/`. Neither result was
installed or promoted to an APK or visual PASS.

The source correction isolates Metro transform cacheVersion by absolute logical
project root, preserving Expo's cache version/stores and the existing bounded
Windows I/O wrapper. An installed Metro/Expo regression reproduces identical
baseline keys for two checkouts sharing Router dependencies, verifies different
Babel app-root output, then verifies stable distinct project keys. Eight tests
pass. The asset extension correction additionally passes three entry suites /
79 tests, including both actual portrait headers and original hashes.

Admission of the next saved-source build requires every first-party map module
to match its Git blob and checkout root. The one named ignored reference module
must match regeneration from that commit's exact generator and donor, with its
derivation recorded separately. Both original portrait formats/bytes, packaged
pixels, packager/final Hermes maps, signer/config and packaged Hermes bytes are
verified. All normal release tasks remain enabled; native cache reuse is
recorded separately. Native fidelity still requires an actual installed build
and observed frame comparisons.
