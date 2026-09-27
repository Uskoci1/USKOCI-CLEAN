# Search composition proposal

Date: 2026-09-27. **DIRECTION APPROVED; SOURCE IMPLEMENTATION IN ROUND05; NATIVE ACCEPTANCE PENDING.**

User job: choose where, when and under which existing conditions to find a suitable task, then apply those choices together.

The generated `P1_SEARCH_PROPOSAL.png` is an illustrative direction, not a screenshot of the running app. It was prepared from the current `DiscoverySearchPanel.tsx` / `discoveryWords.ts` contract. Historical R10 and R21 screenshots were inspected but are not presented as current-build comparisons. No app was launched or captured in this round.

## Proposed change

The original image proposed one white surface with section separators. The owner's subsequent 13321.jpg reference replaces that composition with separated white groups over a blurred background: one expanded editor, the remaining groups showing summaries of the real draft. Tapping a group switches editors without applying the search. Use location, time, work mode, group capacity and price mode already supported by USKOČI; do not import travel categories or fabricated suggestions. Keep green selected choices, one bottom apply action, secondary reset and explicit close. Existing public-task filters/count authority and draft/apply/cancel semantics remain unchanged. No result count is invented.

Preserve the existing TaskCard, DiscoveryPeek, map/pin, routes, backend and facts. Use the repository's FactArt and Inter tokens, not the generated pictograms or a new icon family. The image is a composition reference, not a pixel or accessibility specification. Allow wrap/scroll and the existing large-text footer behavior; never squeeze three choices into a row on a small phone or reduce text to match the raster. Do not enlarge the current type indiscriminately.

The concept's people filter means **enough available places for the group**. It does not alter price. An intermediate generated image incorrectly implied a price effect; that image was rejected and is not the implementation reference. Only the final file above is retained.

## Approval and continuation

The owner approved the white/green direction in the async reply, requested better icon quality, and then supplied 13321.jpg to explain the accordion interaction. A separate async reply explicitly approved adding expo-blur57.0.3: “Da, dodaj zamućenje”. Existing FactArt and Inter remain; the generated pictograms are not assets. See SEARCH_ACCORDION_SOURCE.md for the implemented source and native limitations. This approval does not authorize unrelated card changes, tests, APK installation or server application.

## Image provenance

Built-in image generation was used, followed by a white-background repair and one exact-copy correction. Final generation instruction: replace the incorrect helper sentence with **Dovoljno slobodnih mesta za sve vas.**, preserving all other content. Final output was copied from `exec-03be23f1-2a35-4e61-b435-91072851e1c1.png` into this directory. The image has no application data, true result count or device-proof status.
