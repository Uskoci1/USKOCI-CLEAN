# Emulator critique of UI wave 1 (build 1f909660), 2026-10-02

Two independent read-only critics (UX and VISUAL, Sonnet 5.5 subagents) looked at 16 screenshots of the wave-1 DEV build on the Android emulator `USKOCI_V5_TEST` (360 dp wide, font scale 1.15, owner test account). The screenshots are NOT stored (they show the owner account); the two JSON files next to this page hold every finding. Evidence level: EMULATOR still images only, no motion, no phone.

| File | Findings | Severities |
| --- | --- | --- |
| `EMULATOR_CRITIQUE_W1_UX_20261002.json` | 30 | S1: 3, S2: 16, S3: 11 |
| `EMULATOR_CRITIQUE_W1_VISUAL_20261002.json` | 31 | S1: 7, S2: 17, S3: 7 |

Rules every fix must respect: `AGENTS.md` section 3.6, owner decisions U01-U19 (`finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`, section Appearance), B22 (no new Reanimated layout/entering/exiting animation), no new dependency, no server change; `src/ui/entry/**`, `src/ui/referenceEntry/**`, the mascot and the HOME signature are LOCKED.

## Top ten for the next wave - UX critic

1. **Tab rows that fit at 360 dp x 1.15** - UX-01 (S1): 'Istorija' shows as 'Is' and 'Završene' is off-screen
   - Do: Moji zadaci: tabs take the full row, Pretraga and Filteri move to a toolbar under it, counts only when they fit. Moje prijave: tab gap 20 to 12, remove fadingEdgeLength, four tabs fit, badge only the attention count. Add a render test at 360 dp x 1.15 for both screens.
2. **Own task cards and Pregled tell the truth about state** - UX-02 (S1), UX-07, UX-05: a full task says 'Tražim ponude', the waiting task is marked on its last line
   - Do: StatusChip at the top of own cards from fields already loaded ('Čeka te 1 prijava' in the attention tone, 'Dogovoreno 1 od 1', 'Nema prijava'); pricing mode only while offers are open; Pregled shows the agreed total (read from the Dogovor) when the places are filled; SlotMeter words instead of bare '1/1'.
3. **Own task detail: the right primary action by state** - UX-03 (S1): a green button that opens a list with nothing to choose, no link to the Dogovor
   - Do: Footer 'Otvori Dogovor' when the places are filled or nothing is selectable and an agreement exists (look the id up in the Dogovori read the app already makes); otherwise a grey footer with the reason beside it; row copy '1 prijava, izabrana'; keep one of row or footer.
4. **One meaning of 'Čeka te' and honest counts** - UX-04 (S2): 1 on Početna, 4 in Moje prijave, 16 on the bell, 'Aktivni 1' beside '2 zadatka'
   - Do: Count what the group draws (or draw the rating row outside it); Aktivni badge in the attention tone with words ('1 čeka izbor'); one shared definition of 'Čeka te'; the bell stays an inbox count and never uses the 'waits' tone.
5. **Dogovor workspace: Poruke, the term, rare actions** - UX-12, UX-06, UX-13, UX-19, UX-29 (S2)
   - Do: Render the existing AgreementTabs 'Pregled | Poruke' under the person bar and remove the icon-only chat; TermLine in muted ink; a quiet 'Dogovori termin' link into the existing Izmene screen; 'Kontakt' and 'Lokacija' the only disclosure rows, the other three behind '...'; shorten the header role line; drop repeated words.
6. **One AgreementRow everywhere** - UX-08, UX-28, UX-05 (S2): seven-line rows, three role phrasings, outcome last
   - Do: New AgreementRow: status chip first, time-first date, one role function in my terms, price at the right; Istorija leads with the outcome; rating-due Dogovori placed after the running ones; Home card and calendar row use the same parts; an application's status follows its Dogovor.
7. **Zadaci: pill, chips, card and sheet** - UX-10, UX-09 (S2)
   - Do: Pill without inner controls (drop 'Dodaj uslove'), a captioned 'Filteri' chip with a count, a visible 'Objavi', an orange dot on '...' while the inbox has items; card to 190-210 dp; strip tap opens the half stop; the 'Mapa' pill slides away on scroll; selected-pin linking as UI-only; no price on pins.
8. **Početna composition** - UX-11, UX-30 (S2)
   - Do: Bounded white doors with the entry photographs (FactArt fallback), one bounded 'Čeka te' group with verb-first rows ('Izaberi izvođača'), a door block trimmed so the Dogovor card starts above the fold, reserved skeleton height.
9. **One glossary: time, price, 'prijava', plain words** - UX-17, UX-16, UX-15, UX-26 (S2/S3)
   - Do: One phrase for flexible time and one for not agreed; non-breaking space between day and month; separate the safety nouns from 'prijava' (owner's wording check, no legal claim); price words ('Ukupno', 'Cena nije navedena'); the detail's top fact uses the card's route string; capacity in words; plain words for 'Lokacija i pristup', 'Tok Dogovora', 'Od mesta do mesta'.
10. **Shell: flat tab icons and words on controls** - UX-21, UX-22 (S3 but on every screen)
   - Do: Finish plan 2.1-2.3: flat tab marks with a quiet inactive tone and a top indicator; a captioned pill for every non-universal control (Kalendar, Poruke, Filteri, the '...' menus); one transition language on RN Animated, no new Reanimated layout or exiting animations.

## Top ten for the next wave - VISUAL critic

1. **Colour truth pass: one TermLine, one calendar tone, one green, one brown** (covers VIS-02, VIS-08, VIS-09, VIS-14, VIS-16, VIS-12 (colour part), VIS-15 (chevron part))
   - Do: New TermLine (exact = green 600 + brand calendar; unconfirmed/flexible/absent = muted #525252 600 + quiet calendar) used on every term row; price = sys.color.green; orange #FA8229 only for dot/badge/star, one text brown #8A5100; chevrons #525252; History rows muted.
2. **Tab bar: flat quiet marks, selected capsule + indicator, readable labels, grid alignment** (covers VIS-01, VIS-23)
   - Do: Plan 2.1 with U18: inactive = flat mark 24 dp tone quiet, selected = brand + 20x3 indicator (RN Animated, no Reanimated layout), label 14/20 600, pill inset to the 20-dp gutter; dock only under the U04 condition.
3. **Type ramp + typography helpers (nbsp, balanced titles, one ellipsis)** (covers VIS-07, VIS-18, VIS-19)
   - Do: Ramp: door 22/26 800, card title 20/25 700, heading 17/24 600, body 16/24 500, meta/status 13 600; U+00A0 between number and unit, 'u'/'i' and the next word, day and month; route origin/destination stacked; a real '…' at every weight.
4. **Home: bounded photo doors and one bounded 'Čeka te' group** (covers VIS-03, VIS-24)
   - Do: Plan 4.1 with U02: two bounded white doors (r24, cardLine edge) with a cropped entry photo, title 22/26 800, 36-px green disc arrow; 'Čeka te' as one group with hairlines, one icon cell and one text start, count as an orange pill; FactArt art as the fallback if the owner rejects photos on the phone.
5. **One card anatomy: StatusChip, price anchor, no capacity-only footer, one object-title rule** (covers VIS-04, VIS-13, VIS-15, VIS-31)
   - Do: Plan 5.1/5.2/8.3/10.1: StatusChip (shape + 13 sp 600) first; title green 700; price right-aligned tabular; 'Tražim ponude' trailing label; capacity in words/SlotMeter; offer row baseline-aligned; target 190-210 dp (Moje prijave <= 260 dp).
6. **Icon call-site clean-up: every row icon a flat 24-dp mark; avatars and bell fixed** (covers VIS-10, VIS-12 (bell), VIS-21, VIS-25)
   - Do: Call sites 26/30/32 -> 24 (flat mark, brand tone, no ground ellipse); bell tone brand on settings; shield without tick on the safety row; default avatar = drawn person mark on a tinted disc; deterministic initials tint; one 40-dp icon cell for FactRow and Disclosure.
7. **Tab rows that fit and read** (covers VIS-06, VIS-26)
   - Do: Plan 8.1 with U16: remove fadingEdgeLength, gap 12 dp, tabs full width, filters/search leave the tab row (captioned 'Filteri' control), attention counts only, selected count pill #E8E8E8 + green digit.
8. **Chrome and header: bold glyphs, captions, header fade, hairline hero card** (covers VIS-11, VIS-28, VIS-20)
   - Do: Plan 2.3 + 10.2 with U11/U15: Glyph wrapper (bold 24, stroke 2 dp), ring #CDCDCD or well, caption pill for Kalendar/Poruke, 8-dp fade under the compact header; workspace summary card to the hairline recipe or a plain block; visible 'Pregled | Poruke' tabs.
9. **Zadaci top: text-only pill, captioned Filteri chip, state pins, compact credits** (covers VIS-05, VIS-17, VIS-22)
   - Do: Plan 6.1 + 7.2 with U06/U07/U17: full-width pill with the where and conditions, a captioned 'Filteri' chip with count, 24-dp glyphs stroke 2; pins show state (selected radius 16 -> 20 + halo, no palette change); 16-dp clearance around controls; credits as one muted 12-13 sp line + (i) on both maps.
10. **Profil and Obaveštenja pass (not in the plan yet)** (covers VIS-12, VIS-29, VIS-30)
   - Do: Add as a new wave: section heading style for group labels, tiles with a 24-dp mark and no chevron, orange unread dot + read titles 500, date headings 600 with group spacing, hairlines between groups.

## Patterns the critics saw

- (UX) Screen ids in findings are the t1_NN prefix of the file names; dp = px / 3 at 360 dp, font 1.15; sizes come from uiautomator bounds, 'spoken' marks accessibility text that is not visible.
- (UX) DENSITY: the same unit costs very different space (inbox row about 100 dp, task card about 250-330, Dogovor row 240-300, application card 383): one to two objects per screen on every list, so the missing overview is a card-anatomy problem before it is a visual one (plan 5.2, 8.3, 10.1).
- (UX) STATE IS THE QUIET, LAST OR MISSING ELEMENT (none on Moji zadaci cards, a small label on Moje prijave, line four on Dogovori, a dot line on Pregled, a heading in the workspace) and its words differ per list (UX-02, UX-05, UX-07).
- (UX) ONE WORD, MANY MEANINGS: 'Čeka te' (1 / 4 / 16), 'Aktivni' (holds a finished Dogovor; the Moji zadaci badge counts waiting tasks), 'prijava' (application and report), 'Termin' (label and value), 'Dogovoreno' three times on one screen.
- (UX) ONE-WAY LINKS: Dogovor to task exists ('Otvori zadatak'), task to Dogovor does not; inbox rows carry no subject; Dogovori rows show no unread cue; a job cannot be followed through its life by tapping.
- (UX) COLOUR CARRIES MEANING IT SHOULD NOT: green = action, money, selection and an unconfirmed term; orange = what waits but also the bell badge, the profile rating star and the settings bell; title colour has no written rule.
- (UX) CLIPPING AT THE OWNER'S GEOMETRY: tab labels ('Is', 'Završene'), header role line ('zad..'), search pill ('uslo..'), chips ('mest'), dates split over two lines ('Do 31.' / 'dec'). Layouts were tuned for 380 dp and up; 360 dp x 1.15 is the real case, so make it a render gate for every list and header test and for the emulator tour.
- (UX) NO EYEBROW OR ORIENTATION COPY appears on any of the 16 screens (explanatory lines state a rule or a consequence); the owner's rule holds and the problem is information scent and state, not missing orientation text.
- (UX) DECISIONS U01-U19, VISIBLE AND HOLDING: U03 (price-tag glyph on prijave and ponude, bubble+check Dogovori tab), U13 and U17 (no photo on cards, plain logo-disc pins), U15 (Dogovor is a white reading surface), U07 partly (map palette unchanged).
- (UX) DECISIONS NOT YET VISIBLE (planned wave): U01 partly (marks at 24 px and below are flat single-green, 28-32 px icons are still stickers; W1.3/W2.3), U02 (doors are unbounded art, no photos; W4.1), U04 (floating pill bar remains; W6.4), U11 (chat is an icon; W10.2), U16 (all segments are underline tabs; W8.1), U18 (tab icons are stickers, greyed when inactive; W2.1 in flight), U07 stronger control edges (W6.1).
- (UX) DECISIONS AT RISK OR VIOLATED: U14 (ink titles on Dogovor, application and Početna rows beside green task titles: write the rule or unify), U01 (orange on things that do not wait: profile rating star, settings bell, bell badge 16).
- (UX) DECISIONS NOT TESTABLE IN STILLS: U05, U06, U08, U09, U10, U12, U19.
- (UX) CAPTURE QUALITY: t1_04 duplicates t1_05; every list is short test data (2 tasks, 2-4 agreements, 6 applications, 16 notifications), so long lists, empty and first-run states are unseen.
- (VISUAL) Colour is told per screen, not per meaning: the same fact (term, flexible, unconfirmed, waits, unread, title) has two to four looks across screens.
- (VISUAL) Two icon dialects share lists: flat 20-dp marks and glossy 26-32 dp stickers, split by a 24/26 dp threshold; paper stickers look washed, solid ones heavy.
- (VISUAL) Bold is the default weight and the middle of the ramp (16 to 12 dp cap) is compressed, so hierarchy leans on colour.
- (VISUAL) Same object, different surface: bordered card (Home), unboxed row (Dogovori), shadowed card (workspace), bordered tile (Profil).
- (VISUAL) Wraps and truncation ignore pairs (number+unit, route, date) and use at least three ellipsis idioms.
- (VISUAL) Edges: floating bar, chrome rings, hairlines and rows use 16, 20 and 24 dp insets and 2-8 dp text-start steps.
- (VISUAL) Wave-1 rules (quiet calendar, flat marks, token colours) reached TaskFace and the 16-24 dp card rows only; Home, Dogovori, Profil, Inbox and the application card still use the old looks.

## Keep as it is

- (UX) Sub-screen header = round back button + title in the content's own name, no eyebrow, no orientation copy (t1_11, t1_14, t1_15, t1_16); collapsing title on scroll (t1_06, t1_13).
- (UX) Tab bar only on the three roots with the selected tab named in green: 'the bottom navigation always shows where you are' holds.
- (UX) One pinned full-width green primary with a white label at the foot of detail screens (t1_05, t1_08, t1_12): thumb-reachable, one per screen; keep the pattern and fix the label by state (UX-03).
- (UX) Privacy lines with a lock: 'Približno područje. Tačna adresa se deli tek u Dogovoru.' and 'Tvoj broj nije podeljen'; the approximate map.
- (UX) Verb-first attention copy: 'Oceni završen Dogovor', 'Oceni saradnju / Čeka tvoju ocenu' (reason and action in one strip).
- (UX) Fact stack with one glyph and one line per fact, price as the single green number on the detail.
- (UX) 'ti' voice without grammatical gender on all 16 screens ('Imaš novu poruku', 'Tvoja ponuda', 'Završetak možeš potvrditi', 'Čeka tvoj izbor') and no 'server' wording.
- (UX) One time format ('26. sep · 16:00–17:30', 'Danas, 06:52') wherever an exact time exists.
- (UX) Inbox day groups, the quiet 'Označi sve kao pročitano', unread dot with a heavier title.
- (UX) Moje prijave footer 'Otvori Dogovor ›' as the one next step of the card (keep the idea, move it up: UX-18).
- (UX) Početna keeps two big doors above the group that waits and the two quiet list rows at the end (locked IA), 'Čeka te' above the next Dogovor.
- (UX) Honest data statements: no invented price, 'Tražim ponude' for an open price, counts spoken as words to screen readers.
- (VISUAL) Flat 20-dp one-tone marks on card rows and detail facts (pin, calendar, users, money, tag, remote): crisp and nameable (t1_05, t1_10, t1_12).
- (VISUAL) Detail type ramp: hero green 700 > money 700 > h2 > body (t1_05, t1_12), and the sticky full-width green primary with white label (6.3:1).
- (VISUAL) White reading surfaces with 1-px #DEDEDE r24 list cards and 20-dp gutters; sheet handle and r28 sheet.
- (VISUAL) Wordmark-centred root chrome and the 48-dp circle positions; compact header title collapse on scroll.
- (VISUAL) Segmented tabs with a green underline and count pill; the orange pill for 'Čeka te 4' is the right use of orange.
- (VISUAL) Map palette (near-white ground, blue water, green parks) and brand pin discs (U07); credits remain visible (legal).
- (VISUAL) Pale hairlines between disclosure/inbox rows and the consistent 60-px left gutter.

## Direction proposed by the VISUAL critic

- One calm icon family: flat one-tone marks up to 24 dp everywhere (UI green #076E4E), stickers only as art at 48 dp and up; the tab bar uses quiet flat marks (U01, U18).
- A real ramp: door/hero 22-26 800, card title 17-20 700, body 16 500, meta/status 13 600; price right-aligned tabular in the one green; status chip first.
- Colour = meaning: green do/confirmed/money, muted for unknown/flexible/unconfirmed/history, orange only for dot/badge/star, one brown for words.
- Surfaces: white; hairline r24 cards for list items, unboxed rows with hairlines for details, shadow only for what floats (tab bar, map controls, sheets) (U15).
- Home as a poster: two bounded photo doors (U02) and one bounded 'Čeka te' group with an orange count pill.
- Chrome with weight: bold 24 glyphs in #CDCDCD rings with captions for non-universal controls, visible 'Poruke' tab, header fade (U11).
- Brand character from entry photography and the handshake mark, state-aware pins, tinted initials avatars instead of identical gray discs.
- Motion later and only transform/opacity (B22): selection capsule, list-swap fade, arrival fade; not judgeable from stills.

## Not verified by either critic

- (UX) Zadaci with the sheet expanded, the 'Mapa' pill and its slide-away (U06), the pin card, the filter sheet, the empty state with 'Osveži zadatke' (U08) and any error or loading state (t1_04 is a duplicate of t1_05).
- (UX) Početna first-run hero, loading skeleton and 'trenutno nisu učitani' states; the Dogovori, Moji zadaci, Moje prijave and inbox empty and error states.
- (UX) All motion (tab switch, push, Back, sheet, press give), haptics (U10) and Reduce Motion: a still shows none of it.
- (UX) Chat thread, bubbles (U12), composer, photos, voice; the apply flow ('Sastavi prijavu'), publish, Kandidati and compare, Izmene, the completion review and the rating flow.
- (UX) The content of the '⋯' ('Više radnji') menus on the details, which may hold a link to the Dogovor (UX-03).
- (UX) Podrška, Privatnost and Pravna dokumenta (U09, Catalog27 retirement), Kalendar obaveza, Dostupnost, Veštine and the other profile screens.
- (UX) What the other three 'Čeka te' applications are, and which inbox tab 'Nova poruka' lands in.
- (UX) Whether 'msljivic031' is a stored display name from sign-up, and whether 'Veštine: Krečenje' is a free requirement or the canonical work kind (rule: no category shown to people).
- (UX) Text scale 1.3, 320 dp phones, landscape and tablet; real lists (many pins, many tasks, long titles) and real photos: the data is the owner's small test set.
- (UX) Anything about speed: software-GL emulator under load, jank and frame timing were ignored on purpose.
- (VISUAL) Motion, press and disabled states, haptics, skeleton/loading, scroll edge behaviour and the edge fade at other scroll offsets: a still image cannot show them.
- (VISUAL) Real HONOR rendering: the emulator is 3.0 px/dp software-GL; the phone is ~3.5 px/dp, so 20-dp marks are 60 px here and ~70 px there; colour profile and daylight legibility unchecked.
- (VISUAL) Whether the 'Is' tab and the 4th tab 'Završene' are reachable by scrolling, and whether the two-dot truncation is a font-glyph or a code path (cause unverified).
- (VISUAL) Screens not in the set (filters, Pregled applications, chat, composer, empty/error states, AI flow), dark mode, text scale 1.3 and 320 dp stacking.
- (VISUAL) Screen-reader labels and focus order; WCAG results above are computed on white from sampled pixels, not from the token source.
- (VISUAL) t1_04 is identical to t1_05, so the Zadaci list-full state was not captured.
- (VISUAL) The checkout has uncommitted edits by other agents: the build 1f909660 may differ from the current tree; re-read files before editing.

## UX critic notes for the next agent (Codex)

**context**
- USKOČI Expo/React Native marketplace, Serbian Latin copy. Checkout: C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN/.claude/worktrees/uskoci-kompletan-audit-2e715e on branch work/uskoci-ui-unification-20260924. The 16 screenshots are 1080x2424 px = 360 dp x 808 dp (density 3) at font scale 1.15, the owner's phone geometry; build = DEV 1f909660 (UI wave 1) on the Android emulator, signed in as the owner test account, test data. Folder: <scratchpad>/emu_shots/ (t1_01_home_top.png ... t1_16_obavestenja.png); per-screen uiautomator text and pixel bounds are the key 'inv' of emu_tour1.json one folder up (dp = px / 3). If that temp folder is gone, ask the root for a copy.

**readFirst**
- AGENTS.md section 3.6 (binding UI rules) and section 3.1 (owner gates)
- docs/implementation/ui-ux-pass-20261002/UIUX_PLAN_AND_STATUS_20261002.md (waves W1-W12), UIUX_PLAN_20261002.json (items with finding ids), UIUX_AUDITS_20261002.json (finding ids HP-, Z, MZ-/S1.., DG-/F.., ICO-, MO-/M..), OWNER_START_AND_COMPLAINTS_20261002.md
- docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md section 'Appearance (U01-U19)'
- docs/implementation/product-v1-closure-20260926/finalization-20260927/b22/window7_w1_first_look_20261002.json (the owner's phone, same build family)

**decisionsLegend**
- U01: one brand tone in small icons (UI green #076E4E), orange only for what waits
- U02: Home doors use the entry photographs on bounded white doors, FactArt art as fallback
- U03: Dogovori tab keeps the bubble-and-check icon; offers and applications get a price-tag glyph
- U04: docked full-width 64 dp tab bar only if the Zadaci sheet geometry stays unchanged
- U05: Zadaci keeps the server order (own tasks only labelled, no client reordering)
- U06: one tap on the Zadaci strip opens the full list; the 'Mapa' pill slides away on scroll
- U07: no map palette change (darker ground only as an A/B), stronger control edges
- U08: empty Zadaci: green primary 'Osveži zadatke', quiet 'Dopuni radni profil'
- U09: Catalog27 PNGs retire from Podrška, Privatnost and Pravna dokumenta
- U10: haptics only for state changes and confirmed outcomes, none on navigation touch-down
- U11: a visible 'Poruke' tab in the Dogovor workspace
- U12: own chat bubble becomes #076E4E
- U13: no task photo on cards and no price label on pins for now
- U14: titles and prices stay green (ink titles rejected)
- U15: the Dogovor stays a white reading surface
- U16: capsule segments yes; capsule actions as an A/B
- U17: price-capsule pin later, as an A/B
- U18: flat tab icons
- U19: no offline-source dependency now

**constraints**
- Nothing is applied to DEV or PROD; no server, Edge or certificate change from a UI wave; no new npm package; no paid call; no new account or key.
- B22 motion constraint: no new Reanimated layout, entering or exiting animations; new motion uses RN Animated with the native driver or View transform/opacity; avoid animated SVG draws; keep list rows mounted; Reduce Motion honoured.
- LOCKED, never edit: src/ui/entry/**, src/ui/referenceEntry/**, EntryWelcome, the mascot and HOME signature and the original assets.
- Copy and look: 'ti' voice without grammatical gender, no 'server' wording, one vreme() time format, no eyebrow or orientation copy, text never below 12 px at ordinary size, the primary action green with a white label, orange only for what waits, white reading surfaces, no invented data (a missing price never looks like an amount), no category shown to people; legal and privacy wording needs the owner.
- Process: test-first; run only the relevant files with npx jest <paths> and finish with npx tsc --noEmit -p tsconfig.json; screen suites crash if a screen transitively imports supabaseClient (copy the mocking pattern of the neighbouring tests); the one-token-source ratchets in src/ui/system/__tests__ are tight both ways; one writer per file; do not edit package.json, patches/**, .github/**, docs/control/**, AGENTS.md.
- Verify on the Android emulator at 360 dp wide, font scale 1.15 (the HONOR phone is the owner's: never touch it) and re-capture the same 16 screens as the AFTER; judge layout and content, ignore software-GL jank.

**inFlight**
- Uncommitted work by other agents in the same checkout (one writer per file; check git status before touching): src/ui/v2/ownTaskTabs.ts, src/ui/v2/MarketplacePresentation.tsx and src/data/__tests__/moji-zadaci-tabrow.test.tsx (plan 8.1, Moji zadaci tabs); src/ui/system/TabBarItem.tsx, Glyph.tsx, src/app/(app)/_layout.tsx, ScreenChrome.tsx, ScreenHeader.tsx (plan 2.1 and 2.3).

**outsideTheWave**
- UX-14 (inbox rows with a subject) needs the server package 'obaveštenja sa imenom' and the owner's exact PRIMENI; UX-16 safety wording needs the owner's wording check (no legal claim); UX-04 reverses a code comment ('never counted with them') so the owner should see it; the waiting-first order in UX-07 is a server-order question for the owner.

