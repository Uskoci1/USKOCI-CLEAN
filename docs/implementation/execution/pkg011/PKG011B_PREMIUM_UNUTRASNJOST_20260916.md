# PKG-011B — Premium unutrašnjost prema V5 (2026-09-16)

Owner direction, 2026-09-16 (verbatim substance, after reviewing the web smoke of PKG-011):
"izgled i dalje jadan, previše nabijenog teksta, slaba jasnoća ekrana, AI ekran kao da nije
ubačen"; "svi ekrani premium, lepi, pregledni, privlačni, lepo složeni"; "HTML je osnova, ne
šablon, ima i on mane; sve ekrane detaljno osmisliti u skladu sa zatvorenim funkcijama: bela
pozadina, lep izgled kartica i ikonica, lepa slova, manje teksta koje kaže sve, ikonice i
simboli gde treba, boja i naglasak gde treba". No engine change, no new writer, no new flow.

Authority for the visual language: V5 CODEX §5 "Profesionalna unutrašnjost, ne slepa kopija
HTML-a" (white background, deep green, orange accent, clear typography, semantic icons; one
meaningful primary action per step; no every-fact-in-a-card, no endless badges, no tiny text),
`03_SPECIFIKACIJE/TOKENI_AI_FIRST.json`, `02_IZVOR/ai-first.css`, the V4.9 card/segment CSS
and the `05_PREGLED` screenshots. Owner-locked entry/HOME/mascot are untouched.

## Design system (implemented in `src/theme/tokens.ts` + `src/ui/system/tokens.ts`)

| Layer | Decision |
| --- | --- |
| Ground | White screens (`ground` = `#FFFFFF`). `wash #F2F7F4` is the only grouped-area tint. |
| Card | White, 22px corners, 1px `#DCE8DF`, V4.9 soft shadow (opacity .04, radius 22, y 6), padding 20. Compact: 18px, padding 16. No chip rows on list cards. |
| Type | display 32/37, hero 30/35, title 21/26, heading 18/24, body 16/24, bodyStrong 16/24 600, copy 15/22, note 14/20, meta 13/18 (labels only), label 12/16 700 tracked, action 16/22, price 23/28 tabular, cardTitle 20/25. All titles weight 700. |
| Radii | badge 9, chip 13, control 16, primary 17, cardCompact 18, card 22, sheet 28. |
| Colour | ink text; muted for facts; green = trust/orientation (status dots, active icon, links); orange = the one action and attention; money `#205C45`; danger/warn only with a word or symbol. |
| Controls | 44px icon wells `#F4F7F5` radius 15 (V5 head). Segmented = V4.9: track `#E6EDE8` radius 14, white pill radius 11, 14/600 → 700. One segmented control per screen. |
| Status | Shown only when it deviates from the section default (new applications, draft, filled/closed, awaiting confirmation). Dot + label, never colour alone. |

## Slices

1. **Temelj + liste** (this commit): tokens, `ScreenHeader` (+`HeaderIconButton`), `Segmented`,
   `Skeleton`, `InboxBell`, `TaskCard`, `NeedUrgencyBadge`, `MarketplacePresentation`
   (Zadaci: one segmented set switch Aktivni · Nacrti · Istorija with an attention badge,
   section row with count + quiet search/filter icon wells, collapsible search, attention
   filter inside the filter sheet, floating orange "+"; discovery keeps Lista · Mapa),
   `AgreementCollectionPresentation` (same anatomy, "Čeka moju potvrdu" as a chip).
   Before → after on Zadaci at 375×812: first card at y≈326 → y≈190; 4 control rows → 2;
   card text pieces 9 → 6 (no chips, no duplicated status).
2. Detail screens (own Task, public Task, Dogovor hero): one hero title 30, V5 fact grid
   (label 12 / value 16, hairlines), conditions as wash chips, one primary.
3. Prijave (moje-prijave), kandidati, sastavljanje prijave: same card anatomy.
4. Profil hub: avatar 96–104 rounded square, name 28, one segmented role switch, rows 17/14
   with 40px icon discs.
5. AI creation: "+" opens the conversation directly with manual entry inside options; intro
   32px title + two suggestions + 66px mic; tab bar hidden inside the creation flow; publish
   is the orange brand action. Owner decision recorded before this slice.
6. Auth sheet per the HTML comparison (grip + single title, tiles in one row, inline primary,
   64/90% heights, entry always behind). Owner decision on "ti/Vi" recorded before this slice.

## Verification per slice

TypeScript whole repo; targeted Jest suites; full Jest before commit; web smoke on the
DEV project with real reads at 375×812; device acceptance stays with PKG-017/PKG-021.
