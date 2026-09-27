# Catalog27 selective source integration

2026-09-27, based on `2c4b6e843489a56509778177b74f8a3dc8245a33`.
**Client source implemented; native appearance and playback acceptance pending.**

The existing help, privacy and legal screens now share a fixed 32 dp decorative
`CatalogArt` adapter. Adjacent text remains the accessible label and authoritative state.
The mapping is deliberately limited to the supplied lock, support, document and shield:

| Production presentation | Placement |
| --- | --- |
| `SupportCaseRow` | Support ring for service/task help; lock for privacy; shield for safety. Disabled rows pass an explicit muted tone. |
| `PrivacyBody` | Lock beside “Lokacija i kontakt”, whose existing text explains conditional access. |
| `LegalDocumentRows` | Document for terms, shield for the privacy policy. Busy rows and unavailable/unpublished document decoration are explicitly muted. |

The artwork does not assert identity verification, encryption, operator presence,
request receipt, published documents or accepted terms. Existing text, commands,
controller ownership, state and accessibility labels are retained. No shared FactArt,
TaskCard, DiscoveryPeek, avatar, map pin, dependency or backend change belongs to this slice.

## Source provenance

Four PNGs were decoded from literal `window.USKOCI_DATA` JSON in the preserved
`docs/implementation/design-system/catalog27-reference/USKOCI_KATALOG_27.html`.
Python's standard JSON decoder and strict base64 decoder were used; the HTML was
never executed, browsed or served. Each PNG hash was checked against
`CATALOG27_MANIFEST.json`; original pixels and transparency are unchanged.
HTML SHA-256: `24a0fa9ac11fadd94b74fb3ef5fa5ce8170af58f46310a0b20fb2ff76228897a`.

| Bundled asset under `assets/catalog27/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `lock.png` | 22,904 | `7622c1f5922cb8ed11549ee8f8833f6b330a88a82b94e4cccc81a7d8ccc59ba8` |
| `support.png` | 34,354 | `4750a65529ad5d6d4437358c940786ecdb722494dae8c45000cf211cbf1210cd` |
| `document.png` | 15,466 | `b66904ea737a3a85aaec3ad53d106b479f04da08d3bbeecb1527de55188c5b44` |
| `shield.png` | 24,793 | `826a0a28105a719155a0f71ea73f4b664778cfb781aaa6572c7e160b2dbcec92` |
| `support.app32.json` | 14,881 | `1de7cadb16d3a0092955776ffe25fc938d63aa0a38a957e3edcba533e877866d` |

The animation uses the manifest's normalized serialization: UTF-8, sorted keys,
compact separators, Unicode preserved, no non-finite JSON values, no trailing newline.
Its hash matches the recorded embedded `support.app32` export; it is not claimed as
an unavailable original standalone file. Total bundled payload: 112,398 bytes.

## Motion trial

Only the exact `rs.uskoci.dev`-package-gated `/dizajn-katalog27` route uses `CatalogMoment`.
It shows all four colored/muted stills and one explicit-tap support trial, using the
already installed `lottie-react-native` 7.3.8. There are no data reads or business writes.
The 350 ms animation is not wired into a production flow.

Each presentation event is consumed once. Blur, background/inactive, reduced motion,
muting, completion and player failure show the matching PNG. Returning to the route
or foreground does not replay an event. A stale native completion cannot cancel a
newer event. There are no loops, frame-zero fallbacks, completion callbacks to callers,
navigation, haptics or business actions owned by the animation.

## Verification boundary

Source asset inspection and hash checks passed. Five focused suites passed, 118 tests
(the original 115 plus three additional package-admission refusal cases):
`catalog-moment`, `dizajn-katalog27`, `legalScreens`, `SupportScreens`, and
`privacy-retention-screen`. These cover event retirement, stale callbacks, exact PNG
fallback, disabled tone, development-package admission and existing screen behavior.
The final gallery suite has five tests and explicitly refuses store, preview,
unrelated `.dev`, and missing package IDs; only `rs.uskoci.dev` is admitted.
Root owns integrated TypeScript and exact-build/device checks. No build, install,
server/provider call or commit was performed by this slice.

Native verification must still inspect 32 dp artwork, disabled tone and text scaling
on the three production presentations, then use the inert gallery for Lottie paths,
gradients, timing, completion-to-still continuity, reduced motion, blur and background.
Source tests do not establish native animation fidelity or whole-product acceptance.
