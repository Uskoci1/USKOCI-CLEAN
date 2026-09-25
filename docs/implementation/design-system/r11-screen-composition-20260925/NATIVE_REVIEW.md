# R11 — native review and next batch

25 September 2026. Source `add23b4660304b3346e116fcdeb58150e26d382b`, APK run `36121421114`.
Exact hashes, counts and boundaries are in `RECEIPT.json`. This continues the source audit; it is not whole-app acceptance.

## Coverage

All 40 active destinations have a source-based purpose, controls/search inventory, state list and composition proposal.
**38 primary screenshots and ten additional states** were captured on the same Android emulator APK. The primary set
contains 32 inert shared-presentation examples and six existing-account read-only screens. Authentication and recovery
need an unauthenticated or valid recovery context. No logout, bypass, fake account or fabricated recovery filled those gaps.

The complete local atlas is `outputs/r6-integration/r11-atlas/PREGLED_EKRANA.html` in the outer Codex task workspace.
`CAPTURES.json` distinguishes actual routes, fixtures, full-resolution layout review and first-view contact-sheet review.
Original PNG/XML files remain there. Twelve inert examples are under `screens/`; existing-account images remain local
to the owner. Gallery footer/picker strips are test chrome; root galleries omit actual bottom tabs. A screenshot does
not establish working commands, legal consent, identity verification, push delivery or complete journeys.

## Observed progress

| Area | Observation | Limit |
| --- | --- | --- |
| Discovery | Search leads the map. Open task rows and quieter attribution leave more reading room. Actual task detail opens with one application action and no root bar. | Narrow/large-text camera framing remains a finding. Filtering and ownership behavior were not changed. |
| Offers | Larger initials, separate total/people row and longer message. Full offer and public-profile panels opened; profile initials remain 96 dp. | No actual selection or screen-reader acceptance. Fresh Android hierarchy was unavailable for these modals; only screenshots are claimed. |
| Human chat | Normal and 320 dp/font-2 docked Gboard leave writing and photo/send commands visible. History was independently scrolled. | Closes previous command occlusion in the shared fixture, not live delivery, read markers or pagination. |
| Recovery/closed chat | Failed-media recovery is reachable inside history. Closed example has a readable notice and no composer. | Status caption needs more width. No retry/delete/send command executed. |
| AI | Task and worker examples show quiet AI speaker identity, separated user text and summaries. | No provider, microphone, interview or activation call. Still images do not prove motion performance. |
| Whole app | Publication, applications, settings, privacy, support and operator first views compared in five contact sheets. | Not acceptance of all 292 gallery states, long content or every keyboard combination. |

## Follow-ups

| ID | Evidence and consequence | Next change / acceptance |
| --- | --- | --- |
| R11-N01 | Actual Safety names a generic user. `SafetyScreen.tsx` directly calls `editor.save(...setBlock)` from the button. Person and consequence are unclear. | First client priority: trusted target/context and explicit block confirmation. Preserve server-resolved identity, revision guard, unknown-outcome replay and contact consequences. Do not invent a name from an account UUID. New server work requires its separate contract/approval. |
| R11-N02 | `chat-large-media.png`: recovery scrolls, but status breaks words within the narrow photo tile. | Full-width status/recovery row with actual thumbnail/state/commands retained. Check 320 dp/font 2 with docked keyboard. |
| R11-N03 | `map-large.png`: camera frame is much wider in the narrow/large-text setup. Bounded camera-log check found no exception. | Reproduce and establish whether fit padding, restored viewport or another cause controls it. Change camera insets only if evidence supports that cause; preserve actual points and user camera intent. |
| R11-N04 | `filter-large.png`: both footer actions fit; flexible-date label breaks within a word. | Adapt segmented-choice layout at large text. Keep text size and draft/apply contract. |
| R11-N05 | Worker/place forms are long with repeated navigation. New support request spends its first viewport on seven topics and explanations. | Essentials first, optional sections grouped by purpose, compact topic choice. Keep privacy, true facts, recovery and one state-appropriate primary action. |
| R11-N06 | Group conversation has a large introduction/manual refresh. Support has separate title/decision/composer behavior. | Compact context and independently test each keyboard layout; repaired ordinary chat does not automatically repair these. |
| R11-N07 | Photo fixture illustration is cropped below the face. | Use suitable fixture art; inspect actual picker/crop separately before claiming a product upload bug. |

Next coherent batch: N01–N02 plus long-form/support composition N05–N06, then bounded camera/filter investigation N03–N04.
Keep search only where it retrieves something meaningful: jobs/places, one's own task list, or entered place/area lookup.
Do not add generic search to forms, chat or informational pages. Keep one production composition. Follow the owner's
larger-batch cadence: necessary focused tests, combined types/full Jest after integration, then exact-source APK/native review.

## Verification and restoration

Types and **313 suites / 6,083 tests** passed. Both artifact attestations match source, tree, run and APK hash.
`adb install -r` succeeded without clearing data. Workflow did **not** update `dev-latest`. Only `emulator-5554` is
attached; no physical-phone, iOS, TalkBack/VoiceOver or full two-account acceptance is claimed.

Density restored to 420; font scale 1.0. Original Gboard stylus-writing option restored ON, confirmed by a fresh
checked=true hierarchy; temporary OFF was only for docked-keyboard observation. No business commands, credentials,
server, Edge, frozen migrations, dependency or payment changes.

Local control state is refreshed separately. Remote upload remains unconfirmed: the authenticated Claude page's file
chooser timed out twice. Embedded-browser URL policy also rejected opening the local atlas. No alternate browser,
HTTP server or hidden API bypass was used. Saved HTML/images are delivered directly.
