# Visual finishing — owner direction and first connected batch, 2026-10-02

The owner's latest message asks for black primary text, gray supporting text, white surfaces, curated premium 2.5D iconography, purposeful cards/open rows, and complete screen/flow critique. This explicitly supersedes green titles and blanket flat marks. Existing W5–W7 are the first implementation slice; W4/Home, remaining W8–W11 and the AI conversation keep their place in the same plan. No new product master or blanket acceptance.

## References recovered

- `outputs/design-v31-v28-20260922/PREDLOG.html` and `TOK.html`; rendered V28 screens in `docs/implementation/v5-ai-first/v28-reference/`.
- Owner's seven Airbnb references: `docs/implementation/design-system/OWNER_AIRBNB_REFERENCES_20260925.md`.
- Original local `C:/Users/user/Downloads/USKOCI_WEB_V59_PREMIUM_MAPA_I_DUBINA.html` and `USKOCI_WEB_V60_PREMIUM_MOTION_CLEAN.html`: inspected HTML/CSS, not accepted native renders. Useful: distinct white task card versus unboxed rows, one white map sheet, quiet assistant reading, accents instead of broad green fields. Their old cream/green text is superseded.
- Existing native `FactArt` has 30 SVG drawings with depth, edge and highlight. Reuse explicit art cuts; no new asset/package required. Rejected pin-reference card remains rejected; Catalog27 is not imported wholesale.
- The older donor design skill was relocated to `C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/donor/CLAUDE 30.08 USKOCI/.claude/skills/design/SKILL.md` and read by the independent visual reviewer.

## Screen purpose and draft agreement

Discovery lets a person find a suitable task, inspect its place/terms and open it. UX_NACRT §5 remains intact: map and list on one screen, search within reach, draft filters with an authoritative result-count action, selected-pin preview and task detail. Differences are visual hierarchy and shorter copy; no new filter, state, count, ordering, permission or business command.

| Before | Implemented direction | Why |
| --- | --- | --- |
| Large green title, price and offer wording compete | Full-width ink title, ink monetary amount, gray terms | Hierarchy comes from role/weight and spacing. |
| Wide separate rows and a footer for capacity alone | Compact logistics, one value/capacity group, footer only for person or useful next step | More of the list can be understood at once. |
| Tiny flat fact symbols dominate every row in green | Selected existing 2.5D illustrations, simple operational glyphs | Brand character with readable controls. |
| Search squeezed by multiple controls | Full-width search; separate labelled Filteri and quick choices | The query and its actions each have room. |
| Five floating filter cards | One white reading surface and divided sections | Current editor and choices lead, without nested card decoration. |
| Repeated 'Dodaj uslove' and technical area phrase | Current conditions only; 'Ova oblast' | Less competing instruction/copy. |

`sys.color.money` becomes ink for shared numeric roles; global green is unchanged. Task detail headings follow the ink direction. Entry/HOME signature, server readers, restore/snap-state logic, real facts, pricing basis and callbacks remain. Tests are existing focused behavior checks; style expectations updated only for the owner's explicit new direction. React component review uses native-relevant React best practices; no fetch/effect/animation engine added.

## Evidence checkpoint

TypeScript passes. Existing focused card/search/panel/token checks: 184/184 pass. Independent read-only source review on parent GPT-6 found no blocker or lost fact/action. The later pin composition correction retains the existing overflow/close/Back checks: 7/7 pass. Quick chips still fold intentionally. Native evidence below closes this bounded composition check only; whole-app and release acceptance remain separate.

## Exact APK and actual screens

First build [37005585355](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37005585355), source `b574e1185d850c8fa5a00aadfa197a7186d3fc72`, APK SHA-256 `ded04ac8d8e141fd6821687fff1ae7f90000f1881cd4c44c0b8b8c2d034588a8`. Native critique identified two actual finishing gaps: the pin preview still reserved a capacity-only footer, and detail artwork was flat beside illustrated cards. Both were corrected.

Correction build [37008069654](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37008069654), source `5bdeef524c90ad066d3e31cacfc8fb928f03ae72`, tree `60b31d6555009057d5a740242f6208fa8202ae3a`, APK SHA-256 `7272c1308a28765b4caa6666a23908733311edb32b020392c7a1d0ccf8b301ad`. Recovery, launcher and Reanimated attestations pass and bind to each artifact's source tree; certificate matches the installed app. Both installed with `adb install -r`; installed hashes match and the signed-in session survives.

Observed on `USKOCI_V5_TEST`, 1264×2728 / 560 dpi (361.14 dp): own active cards at font1.0/1.15/1.3, draft and history at1.15, Discovery half/full list and filter sections at1.15/1.3, corrected pin/detail at1.15/1.3. Full titles/facts wrap; price and capacity group or stack; the own-task applications footer scrolls fully above the gesture area. Pin correction reduced its observed height from880 to660 physical pixels at1.15 for the same task, exposing more map. Detail now shares the24dp art treatment.

Actual navigation: list→detail→Back preserves list; cancel of a draft Today filter preserves the previous8-task/Bilo kada set; pin→detail→Back preserves the selected preview. Two independent reviewers returned scoped UX and VISUAL **PASS WITH LIMITS** after the correction. UID log sampling since correction installation found0 `FATAL EXCEPTION` and0 `Unable to find a viewState`; that is not a full ANR/performance test. Font restored1.15; animations remain1.

Sanitized build/device/capture hashes: [VISUAL_NATIVE_20261002.json](VISUAL_NATIVE_20261002.json). Raw owner screenshots/XML remain private outside Git. No application, rating, completion or message was submitted. Opening an existing conversation used its normal read behavior. No paid AI generation or physical-phone action.

## Connected Home, application and Agreement pass

Actual broader screenshots were critiqued before changes. Profile was already substantially aligned, so it was not redesigned for novelty. The following work stays inside the existing waves and destinations:

| Before | Source change | Why |
| --- | --- | --- |
| Application offer label, amount and people dispersed | One labelled offer group with full amount/basis and wrapping people group; full title/place/time | Read the proposal as one decision, preserving exact facts and guarded footer. |
| Application edge fade weakens labels; underline differs from own tasks | Capsule rail, complete scrollable labels/counts, no edge fade | Consistent selection without tiny text or lost destinations. |
| Agreement title squeezed beside56dp avatar | Full-width title before40dp person block; quieter illustrated logistics | Work, person, terms and next action have distinct roles. |
| Unconfirmed Home/Agreement time strongly green | Gray terms, neutral calendar art; modest Home section spacing reduction | Missing confirmation does not resemble a positive outcome. |
| Conversation is an icon-only control beside a crowded person header | Visible Pregled/Poruke capsules below the person; existing guarded tab transition | The conversation is discoverable. Chat retains its existing overview return. |

Source `c81722a2` includes the independent review's long-amount wrapping correction and explicit reset of flex basis for large text. Existing application/Agreement/recovery checks140/140 pass, plus the Home, overview and paging suites; TypeScript passes. Exact build [37009600771](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37009600771), APK SHA-256 `6a12f186827a41a7bfc84ec75300f5c28dd8e215c26f305d9719f123ae124837`, was installed and reviewed at1.15/1.3. Cards stack naturally without an oversized flex-basis gap. Actual Pregled→Poruke→Back restores the overview; the thread retains the complete m² unit. One initial visual-review concern about the superscript was rejected after full-resolution root inspection and the independent UX review.

Native review found an actual selection defect: choosing Završene loaded the right rows, but loading unmounted the rail and hid the selected capsule after its scroll offset reset. Source `0889c819` keeps the rail mounted during loading and preserves server-owned counts; stale cards still disappear. The same bounded correction lets two Agreement capsules fill their track while four application capsules can overflow. The existing paging test now checks rail identity across a loading cycle;14 focused checks and TypeScript pass. Superseded builds37009527309 and37012040450 were cancelled before acceptance; the latter correction is included in the final connected build below.

## AI opening composition

Actual native review found that a large green invitation and three large green example cards competed with the composer. Source `8d22ce0e` uses a smaller black invitation, compact black example labels,24dp art without a second surrounding well, smaller static brand presence and shorter introductory copy. The voice introduction is black too. Full48dp targets, multiline composer geometry, insertion-and-focus behavior, send guards and real streamed text remain unchanged. No example sends itself. Existing conversation layout/behavior suite40/40 and TypeScript pass; independent source review approved after correcting the art-cut prop.

Final connected build [37012789559](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37012789559), source `8d22ce0e15d1fc952204aad91a4a8818dfb3183f`, is installed and verified on USKOCI_V5_TEST. APK SHA-256 `9f97c49ff4019636271a43e9d4fee437b5983fcdee98d56883a9b90a14a9adbb`, tree `1ed55c50fe2aaedddf147caa2d42bd1dc3a33c98`. All three artifact attestations pass, signer matches, installed hash matches and the session survives. The application/Agreement rail corrections and AI opening were inspected on this exact build; see the sanitized interaction record and separate scoped UX/VISUAL reviews. No paid AI generation was run; opening polish is not proof of AI response quality.

Remaining limits: crowded Discovery quick-control rail/count spacing, broader empty/error/candidate/account flows, AI response quality and remaining whole-app composition, actual large-price native fixture, TalkBack, motion measurements, iOS/HONOR and release. No blanket completion of W4–W10 or all62 control rows is implied.

Next concrete work remains in the same waves: quiet the sparse Agreement thread refresh control; align the unconfirmed term weight across Home/list/overview; finish worker AI summary typography (`WorkerAiPresentation.skillHeading` still green); review existing AI entering/typing motion against B22 and focus/background behavior. The existing worker conversation was opened for inspection of its recorded messages, summary and closed-conversation recovery controls. This does not prove an empty worker opening or a newly generated answer. No new worker conversation, generation, profile update or activation was performed.

Final native health sample: 0 FATAL EXCEPTION and 0 missing-viewState entries since installation, not a full performance/ANR acceptance. Font restored1.15 and animation scales1. Local before/after viewer stays outside Git with private screenshots.

## Existing CI contract reconciliation after native acceptance

Automatic P5 run37012789208 (source8d22ce0e) and PKG006 run37012041861 exposed six existing Jest suites still asserting the previous visual contract. This was caused by this UI batch, not classified as an unrelated baseline failure. TypeScript and their focused checks passed; full Jest did not. The correction changes tests only: current area copy and ink choices, current value/capacity and offer composition, and the reduced glyph allowance. Discovery folding still keeps its48dp Filteri toolbar; the synthetic116dp measured rail leaves68dp to reclaim and the existing8dp hysteresis, preserving both fold and return-at-top assertions.

Obsolete CardHead title/price adjacency estimates were retired because it has no production consumer. Independent review caught a still-live dependency of ownTaskTabs on textWidth: the independent TrueType reader and bundled Inter table, alphabet, proportional/tabular width and unknown-glyph fallback checks were restored. Facts, commands, accessible descriptions, full amounts/basis and responsive composition checks remain. These are structural safeguards, not native pixel-fit evidence.

Validation: the first six-suite local run passed307/309 checks across five passing suites; one Discovery case hit the local5s timeout and its following case suffered timer spill. Discovery alone with a CLI20s timeout passed159/159, without changing test timing assertions. The final card-layout and own-task-tab run passed115/115 including the restored font guard. TypeScript also passed after the final guard restoration. Independent read-only review found no remaining blocker. No full-Jest green claim is made for the final reconciliation commit; earlier failed CI remains visible in the control state. No new APK is required for these test/documentation-only changes, and native acceptance stays bound to8d22ce0e.
