# Design pack interpretation and next design round

## Owner direction and evidence

On 2026-09-20 the owner clarified that the supplied HTML is a basic visual direction, not the final
appearance. Continue improving the design rather than treating the HTML as an immutable specification.
Preserve the original logo, wordmark, entry assets and business semantics. The first native Home
slice is an implemented baseline for evaluation, not approval of every final screen.

The owner re-supplied `USKOCI_ASTRA_DESIGN_PACK_2026-09-19 (1).html`. It was read end to end and its
SHA256 is `899686f0c7858debd47986b5b75e857b41dd96e393ebd5f62128b0bf31518f16`, identical to the
previously supplied `(2).html` design pack. Its embedded master prompt is reference material; it does
not supersede the owner's direct instructions or authorize purchases, dependencies or DEV writes.

## Actual tool state

| Tool/material | Observed status | Intended use |
|---|---|---|
| Figma MCP | Authenticated Full seat; a real design file now contains six editable empty-state explorations and six 360-width QA copies. See the checkpoint below. | Editable exploration, shared components, variables, states and reviewed frame screenshots. |
| Mobbin MCP | No callable tool in the current inventory. No search results or reference board claimed. | Exact mobile patterns once connected through the owner's account; never fabricate results or bypass access. |
| Code Connect | Mapping tools available; no mappings created. | Bind selected Figma components to inspected native APIs after component selection. |
| Reanimated / Gesture Handler | Installed: 4.5.1 / ~2.32.0; used by existing native code. | Existing press, transition, gesture and reduced-motion behavior first. |
| Phosphor | Installed and used throughout the app. | Keep a consistent icon family; Lucide in the pack is an optional alternative, not a required second family. |
| gluestack / Gorhom Bottom Sheet | Not dependencies in the current package manifest. | Evaluate only an identified native gap; no automatic UI-library migration. |
| 21st / web component catalogs | Reference candidates in the document. | Composition ideas; web components are not drop-in React Native code. |
| Apple / Material resources | Reference candidates in the document. | Platform conventions without replacing the USKOCI identity. |
| Rive / Lottie | Not introduced. | Consider a specific useful graphic animation only after compatibility, license and owner dependency decisions. |

These are observed project/tool facts, not a new verification of every vendor's public pricing or
capabilities. The new design frames are not yet implemented in the app or linked by Code Connect.

## First actual Figma checkpoint

File: https://www.figma.com/design/ATgMxtsCfMLPo8rq5N489u?node-id=4-40

| Direction | Home frame | AI frame | Narrow Home / AI |
|---|---|---|---|
| A: clear and quick | `14:3` | `14:4` | `19:3` / `19:469` |
| B: warm and local | `14:6` | `14:7` | `19:12` / `19:479` |
| C: calm and concise | `14:9` | `14:10` | `19:22` / `19:489` |

All six source frames use editable text, Auto Layout and component instances. Source-derived
foundations contain 44 variables across primitive/semantic collections (one mode each), seven Roboto
text styles for the Android system-font baseline and one soft effect style. Original brand vector
geometry was exported from the existing TS data; icons came from the installed Phosphor package.
No library was added to the application. Figma's available community libraries were inspected; no
USKOCI task/composer/token/style assets were found. No external Mobbin board is claimed.

Rendered screenshots were inspected and corrected for text sizing, action widths, variant text
inheritance and repetitive questions. All six 390-width frames and six 360-width copies pass a
readback check for Roboto text and children overflowing their Auto Layout parent. The B Home and C
AI narrow renders were visually inspected individually. These checks do not establish full native
accessibility, keyboard or speech behavior.

Initial design recommendation: Home B plus AI C. Empty-account and empty-intake states were used
explicitly; no real account details were uploaded. A complete state and interaction design remains
open: known/missing facts, expanded summary, keyboard, long conversation, errors, permissions,
dictation events and reduced-motion specification. There is no complete interactive prototype yet.
The APK installed on the owner's device still corresponds to application source `149502bb`; these
Figma explorations do not silently change it. Code Connect mapping remains unimplemented.

Durable local state: the task workspace's `work/uskoci-figma-state.json`; user-facing evidence and
review are under `outputs/USKOCI_FIGMA_DOKAZ_20260920.json` and
`outputs/USKOCI_FIGMA_PRVI_KRUG_20260920.md`.

## Next bounded design round

Before expanding the new visual system across other screens:

1. Collect a small set of accessible references for the exact Home, task summary, AI composer,
   keyboard, error and recovery problems. Identify each actual source and the principle borrowed.
   If Mobbin is unavailable, use the real app and accessible official examples; do not stall all work.
2. Develop three meaningful refinements of Home and AI task intake: clear/compact, warm/local,
   calm/spacious. Keep the same supported content and actions for comparison. The differences must
   affect composition and priority, not merely the palette. These are six comparison frames, not
   three implementations of the whole application.
3. Use editable Figma text, Auto Layout, components and variables. Map the first subset to the actual
   `HomePresentation`, `TaskCard`, `IntakePresentation`, `AiConversationShell`, `VoiceComposer`,
   `Press` and existing token files. Do not invent production component mappings.
4. Review 390/360 logical widths, enlarged text, keyboard, missing data, loading, errors and reduced
   motion. A diagram or static mock does not prove microphone, server or payment behavior.
5. Use the owner's feedback to refine the preferred composition, then implement and test one complete
   intake/review path before extending the system to discovery, applications, Agreements and profiles.

## Current decisions override older brief details

- First public release: dictation -> editable transcript -> explicit Send. Full spoken AI conversation,
  speaking/interruption states and hands-free turn-taking are a later design/functionality track.
- Visible primary actions: OBJAVI ZADATAK and USKOČI I ZARADI. Old internal side names in the embedded
  prompt are not UI copy authority.
- The server owns saved facts and command outcomes. Do not fabricate filled summaries, successful
  tasks, reviews or verified identities to make a design look finished.
- Paid connection service is the intended monetization; credits, work payouts and escrow are not
  implicitly approved by the design material.
- Other canonical DEV migrations, new dependencies and paid calls retain their separate boundaries.

Home attention aggregate integration, candidate-count correctness and bounded reads remain open
engineering work. Design exploration must record these dependencies instead of claiming them fixed.
