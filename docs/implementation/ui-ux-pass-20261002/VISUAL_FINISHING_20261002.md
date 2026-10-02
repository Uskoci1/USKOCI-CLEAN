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

TypeScript passes. Existing focused card/search/panel/token checks: 184/184 pass. Independent read-only source review on parent GPT-6 found no blocker or lost fact/action. Native review must inspect map/list clearance, long titles/amounts, large text and filter section/footer boundaries. Quick chips still fold intentionally. Exact-source build and independent native UX/VISUAL critique pending. Passing source checks alone will not close this batch. Remaining whole-app composition, pin selection/density, motion performance, empty/error flows, AI quality, physical device and release acceptance are separate evidence levels.
