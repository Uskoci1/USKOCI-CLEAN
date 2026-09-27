# Catalog 27: selective artwork and motion review

2026-09-27. **SOURCE ASSET INSPECTION ONLY — NOT INTEGRATED OR NATIVELY ACCEPTED.**

Repository base: `be03fcc4e7bdf0a9ad689a05b20498bfac60e6a7`. Concurrent AI-location work is independent of this catalog review. Scope: this document, `CATALOG27_MANIFEST.json`, two byte-exact user-reference copies and their README. No UI, application assets, dependencies, server, TaskCard, DiscoveryPeek, avatars, or branded map pins were changed. No tests, builds, installs, network/provider requests, or commits were run by this review.

## Inputs and evidence boundary

| Supplied input | Exact bytes | SHA-256 |
| --- | ---: | --- |
| `Downloads/CODEX_START.md` | 5,553 | `e2e7e231301687361b1ee6ce4ddee5b13d38ac0a59d0981b26af49486b136d1c` |
| `Downloads/USKOCI_KATALOG_27.html` | 3,714,993 | `24a0fa9ac11fadd94b74fb3ef5fa5ce8170af58f46310a0b20fb2ff76228897a` |

The HTML browser open was blocked by file URL policy. It was not served, executed, or opened through a workaround. The literal `window.USKOCI_DATA` assignment was decoded with Python's standard JSON parser, without `eval`. Original embedded PNGs extracted by root into the outer `outputs/catalog27-review` directory were inspected directly as images. The supplied document is resource handoff data, not authorization to overwrite local adapters or change business behavior.

The two originals are preserved under [`docs/implementation/design-system/catalog27-reference/`](../../design-system/catalog27-reference/README.md), with byte equality and SHA-256 checked against the supplied Downloads files. They are untrusted data-only references, have no application import, and do not depend on Downloads for future handoffs. Each repository reference path is recorded in the manifest.

Measured inventory: **54 entries = 49 base families + 5 alternate states; 28 animated motifs; 55 animation JSON objects**. Alternate states reuse family IDs, so map by unique `name`, not `id` alone. All 55 objects declare export schema `v: "5.13.0"`; this is **not** a requirement to install player version 5.13.0. The application declares `lottie-react-native ~7.3.8`, and both lockfile and installed package metadata say `7.3.8`. No font or glyph payloads were found.

`messages` has only `feature64`: six embedded PNG assets and approximately 1.31 MB of normalized JSON, unlike the smaller vector motifs. No `messages.app32` export was supplied. The manifest records every animation's dimensions, frames, duration, layer/type counts, asset metadata and SHA-256, plus each decoded still's hash. Animation hashes use the documented normalized JSON serialization; they are not claimed as original standalone export-file byte hashes.

| New optional motif | `app32` duration | `feature64` duration |
| --- | ---: | ---: |
| lock | 333.333 ms | 583.333 ms |
| shield | 316.667 ms | 566.667 ms |
| support | 350 ms | 600 ms |
| document | 333.333 ms | 566.667 ms |

The full `integration/`, `static/`, mini20/mini24 and controlled-microphone pack mentioned by the handoff was **not supplied**. Its claims of 216 SVG and 756 PNG resources are not independently verified by these two files. The supplied custom preview is not proof of standard Lottie playback, native gradient/path fidelity, matching end/still frames, or low-end-device performance.

Root consulted the primary [lottie-react-native Usage documentation](https://github.com/lottie-react-native/lottie-react-native#usage), which describes declarative JSON sources and imperative `play(startFrame, endFrame)` control. That API reference supports explicit playback ownership; it does not prove these particular exports render correctly. No package upgrade is proposed.

## Visual assessment — subjective, from stills and source

Strengths: rounded volumes, restrained contact shadows and a consistent light direction give the artwork more material character than the existing small SVG drawings. The blue support ring and white/blue message bubbles read well as occasional larger illustrations on a white surface. Task/document, gallery/camera and privacy/security are usefully distinguished. The shield avoids a false verification check.

Root separately inspected 22 original stills, including the four new motifs, and particularly favored task, home, support, photo and location for their recognizable color and material. This is a subjective visual preference, not acceptance of their motion or permission for global replacement.

Weaknesses: glossy detail can become noisy or disappear at 16–24 dp; the larger stills do not substitute for the missing mini assets. The bright orange location drawing would compete with the existing branded map-pin system if substituted globally. Mixing these illustrations indiscriminately with small line controls and current FactArt would produce multiple visual densities. The large messages illustration is attractive as a focal point but too heavy for repeated rows. These judgments do not establish motion quality: no standard player was exercised.

## Eight selective surface opportunities

| Existing surface / anchor | Catalog mapping | Intended behavior and boundary |
| --- | --- | --- |
| Deep privacy, help, rules and safety surfaces; `SettingsPresentation.tsx:90`, `SupportPresentation.tsx:134` | lock, support, document, shield | Start with static 24–32 dp artwork. An optional larger panel introduction may play once for that explicit presentation. No identity, encryption, moderation outcome or support-presence claim. |
| Confirmed application, selection and rating receipts; `ApplicationComposerPresentation.tsx:357`, `ApplicationSelectionPresentation.tsx:310`, `AgreementReviewPresentation.tsx:84` | check | One confirmation event using existing `fresh` ownership. Reopened receipts remain still. Keep one haptic; do not stack the current spring and a second whole-icon bounce. |
| Error, unknown outcome and waiting-for-person states; `StateView.tsx:14`, `AgreementActionsPresentation.tsx:145` | error, warning, waiting | Distinguish known failure, uncertainty and a request awaiting the other person. An hourglass is static after entry and is never a network spinner or countdown. Successful submission of changed terms is not their acceptance. |
| Empty conversations and empty task lists; `StateView.tsx:46` | messages, task | One static focal illustration beside the existing title/action. No animation on each list row, task card or repeated render. No invented typing signal. |
| Worker profile sections; `WorkerProfilePresentation.tsx:119`, `:282` | skills, tools, radius | Static section artwork and a clear work-area symbol. Optional first section presentation only. A bag does not certify expertise; a radius ring is not live tracking or measured GPS accuracy. |
| Search and filters; `discovery/DiscoverySearchPanel.tsx:57` | filters, calendar | Static section icons; optional short filters response after an actual changed selection is applied. Counts, dates and active state remain real application data. Do not animate each calendar cell or reopening. |
| Rating choice; `AgreementReviewPresentation.tsx:105` | star, star-empty | Matching full/empty stills. An optional 283 ms response belongs only to the star deliberately selected, not all five. Selection remains distinct from saving the review. Preserve radio accessibility and touch targets. |
| Photo selection and upload recovery; `objava/TaskPhotosPresentation.tsx:62`, `media/AuthorizedPhoto.tsx:90` | photo, camera | Distinguish gallery from camera. Show the actual selected photograph once available; artwork never represents successful upload, camera permission or a saved attachment. Preserve existing media recovery. |

## Integration findings

| Before / concrete risk | Required integration decision | Why |
| --- | --- | --- |
| `LottieArt.tsx:29` sets `progress=0` when reduced motion or autoplay is off. In `check.app32`, all three visible artwork layers have opacity 0 at frame 0; messages bubbles also begin hidden. | Use each motif's matching static PNG for rest/reduced motion, not frame 0. | Direct use can hide the confirmation symbol or show an incomplete illustration. Source inspection confirms the incompatible initial values; native behavior remains untested. |
| `LottieArt.tsx:16` defaults to `loop=true` and `autoPlay=true`; it has no focused/foreground/event owner. No production use was found, only its tests. | Add explicit presentation-event ownership for any future adapter; default to still, stop offscreen/in background, and do not replay missed decoration on return. | The current wrapper is not a drop-in implementation of the package's optional-once semantics. |
| `SuccessMark.tsx:19` already animates and sends a success haptic. | Preserve its existing confirmed-outcome/fresh boundary and choose one motion treatment. Animation finish must never navigate, send, save or alter state. | Decoration cannot become command authority or duplicate feedback. |
| `SettingsPresentation.tsx:90` automatically mutes only an element whose type is exactly `FactArt`. | Pass disabled/muted tone explicitly to new artwork. | A new component otherwise retains full-color emphasis beside a disabled row. |
| `InboxPresentation.tsx:86` uses `check` for `COMPLETION_REQUIRED`; this is an action request, not completed work. | Do not map every existing `FactArt kind="check"` to a success animation. Audit semantic call sites individually. | A moving success check would assert an outcome the event does not establish. |
| `FactArt.tsx:20` is shared by TaskCard, DiscoveryPeek, profile fallbacks and many facts; artwork also appears at 16 dp. | Introduce a selective mapping rather than globally replacing FactArt. Preserve real avatars, small controls and existing task-card artwork. | A central substitution changes unrelated approved surfaces and can harm small-size legibility. |
| Catalog location is an orange pictorial pin. | Keep the existing USKOČI brand pin, selection highlight and cluster logic. A catalog location illustration may be considered separately in the AI location preview. | A section illustration is not a replacement for the map's identity and selection system. |
| `messages.feature64` embeds six raster layers and has no compact animated variant. | Prefer its static PNG; lazy-load animation only for a justified isolated presentation. | Repeated list/tab animation adds parsing, decoding and rendering cost without improving the task. |
| Four new app variants last 317–350 ms; feature variants last 567–600 ms. | Keep normal menu symbols static. Any optional larger introduction must not delay input, navigation or content. | These are illustrative presentations, not suitable default response times for frequent controls. |

**Selective integration recommendation:** start with static artwork in deep settings/help/rules and one existing confirmed receipt. Blanket animated replacement is not recommended: first provide controlled playback ownership and a matching still fallback, then check the target native player. This is implementation guidance within already authorized ordinary UI work, not a new user-approval gate. No new dependency is indicated by this inspection. The catalog's controls, suggestions and QA statements do not override current product contracts or establish APK readiness.
