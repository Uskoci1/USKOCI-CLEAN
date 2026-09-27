# Round 15 — connected pins and application return

Date: 2026-09-27. Owner now requests continued implementation **with emulator checks**. This supersedes the historical build/install deferral for this consolidated emulator checkpoint; it does not authorize new DEV applications, provider calls or account/data deletion.

## Product and implementation

Discovery already knows which tasks belong to the viewer and which have a standing application, but its map did not display either fact. Rich individual pins now receive the same current-account overlay as the existing cards. A small green person/check glyph distinguishes these two positive facts. Unknown/pending relations never infer either status. Multiple tasks sharing a point retain their count, without assigning one participant's relationship to the entire group. No private overlay enters the public GeoJSON.

Selection retains the owner-approved white capsule, orange label/halo and six-percent measured enlargement. HITNO retains its independent lightning; selected outline takes precedence. TaskCard and DiscoveryPeek artwork/layout are unchanged. Account relation changes refresh the native bitmap; ordinary annotation identity changes with its visible relationship. Explicit inert DEV gallery scenes `relation=owned|applied` exercise the real overlay without creating data or accounts.

The [applications package](ROUND_15_APPLICATIONS.md) fixes a named application hidden by a retained filter; current-data reread on candidate foreground return; retained comparison/sort; and the in-flight selection label. Command identity/reconciliation and server authority remain intact.

## Verification

- Final TypeScript: `npx tsc --noEmit -p tsconfig.json` PASS, exit 0.
- Application package: four distinct targeted suites / 141 tests PASS (details in the linked report).
- Final map pin/gallery run: two suites / 71 tests PASS.
- Discovery presentation suite PASS in the preceding integrated map run. That first run exposed three historical assertions still demanding the superseded green selected fill / unscaled mark; they were corrected to the owner's already-implemented white/orange/six-percent design and the complete pin suite rerun passed. Test-only strict-null/type assertions were also corrected before the final passing TypeScript run.
- No whole-suite regression or native success is implied by these focused results. Consolidated APK/emulator result is recorded separately after the exact build is available.

At the pre-build checkpoint the old dcb19e97 gallery on emulator-5556 displayed `Mapa nije učitana`. This is a real observed old-build failure, not proof that current source fails. Its screenshot is preserved outside the repository under `outputs/finalization-20260927/before-map.png`; diagnosis/current-build recovery remain pending.

## Backend and remaining scope

No DEV, Edge, certificate, payment, dependency or business-data changes. P0 exact-ID candidate remains unapplied/unwired; its independent disposable proof is [Round15 P0](ROUND_15_P0_PROOF.md), source 98ce628a, run 36329640103. Current application publication remains on the compatible predecessor path until the candidate is proven and explicitly approved.

Still open: bounded server Discovery filtering/counts/paging, whole publication journey, direct chat realtime, voice, exact-message push resolution and whole-product release acceptance. Public map tiles are an external read; they are not a DEV mutation. Local gallery counts are fixtures, never production-load evidence.

Relevant implementation references: [React Native FlatList](https://reactnative.dev/docs/flatlist) and [Expo BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/). No library change was made in this round.
