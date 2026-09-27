# Round29 — compact AI location and Catalog27 review

2026-09-27. CLIENT SOURCE / TARGETED CHECKS PASS. New native acceptance pending.

## Problem and cause

The AI conversation already had the task's location words and an automatically seeded
geocoder lookup, but exposed the full manual editor and required another candidate click
before showing a pin. A precise start street could also omit the already-known city.
The new visual reference is an asset collection, not an implemented or native-accepted UI.

## Product and UX decision

The existing active-point lookup now proposes a small map immediately, asks whether this
is the place, and waits for an explicit confirmation. Alternatives and natural-language
correction stay available behind a secondary action. Each route point remains independently
confirmed; the full manual form and existing save/recovery contract remain available.
Known locality joins the start street; the start's private address never seeds a destination.

Catalog27 is selected for selective surface trials: clean white base, a limited number of
colored illustrations, static small controls, and one meaningful response to a real event.
It is not imported wholesale. TaskCard, DiscoveryPeek and the existing branded map pin
remain unchanged. Detailed mapping and measured packaging limits: CATALOG27_REVIEW.md and
CATALOG27_MANIFEST.json.

## Implementation and files

LocationPointEditor adds an explicit conversation presentation, leaving the full form intact.
ConversationPointAsk keeps the ownership/close/save path and multi-stop selection, removes
the redundant single-slot selector and composes the existing location words more precisely.
IntakePresentation removes a repeated introduction. Three existing regression files cover
the changed route/editor behavior. See AI_LOCATION_COMPACT_SOURCE.md for exact boundaries.

## Backend / RPC / state synchronization

No new AI or geocoder call, server change, dependency, prompt, route mutation, certificate
change or data write is part of this package. The existing location lookup remains an
unconfirmed provider proposal, not an AI coordinate or proof of accuracy. The same explicit
confirmation, expected review revision and save receipt remain. Focus/account/background
retirement and uncertain-save recovery stay in place. Natural-language correction closes
the owned location decision through its existing discard guard before enabling composition.

Live state remains the Round28 verified DEV210 / push Edge22, compatible transport flag OFF.
That earlier live application does not prove the new client on a device.

## Tests and regression

Four distinct existing suites cover 231 tests: initial combined 230 PASS; the expanded
locality case then passed the affected 50-test suite. Integrated TypeScript PASS after those
source changes. No full Jest or paid AI/provider scenario was run. Gallery/native evidence,
if added, is recorded separately with its exact source; it cannot turn fixtures into an E2E
claim. Source review confirms candidate labels are not adopted as private addresses and
multiple candidates are not described as uniquely correct.

## Device proof and status

The previously installed physical phone is b589994e, emulator04b66de6. Neither includes
this AI change or B3c client. One consolidated checkpoint must verify new native map density,
correction/drag behavior and retained session. Existing source and prior native evidence
remain scoped; whole-product, live realtime, exact provider push, voice and iOS are open.

## Next highest-impact step

Verify the compact real component with inert native scenes, install a consolidated client
on the connected phone, then continue B3c arrival/reconnect in an authorized active Agreement.
For Catalog27, start with static privacy/help/documents and one event-owned success surface;
native rendering must precede promoting animations to production. The existing LottieArt's
frame-zero fallback and default looping are incompatible with blindly plugging this pack in.

The control table is regenerated locally. Hosted import remains separately pending because
the supported file chooser timed out; no fresh hosted publication is claimed.

## Inert native scene preparation

Added src/app/dizajn-ai-mesto.tsx, exact rs.uskoci.dev package only, four allowlisted scenes using the real compact editor with an in-memory resolver. Confirm/correction are local only; no conversation read, AI, geocoder, GPS or save. Public map tiles still load. Gallery admission checks10/10PASS after one test-only hoisted-mock correction; final integrated TypeScriptPASS. Preview/store routes are rejected; no auth bypass. Native execution not yet performed.

## Latest owner regression report

Owner reports slow pin-to-card response on the installed phone, unclear locationless tasks and an expanded list that does not meet the top search. This is the next priority; do not call Catalog27 artwork a fix for the regression. Reproduce installed behavior and implement the bounded Discovery correction before a consolidated build.
