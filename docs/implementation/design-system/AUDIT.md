# USKOČI design, UX and component audit (step C)

2026-09-23 night, under the owner's master UI/UX directive. Sources: a code inventory of all 49 files under `src/app`
followed into `src/ui`, the card inventory of `src/ui` and `src/app`, 25 screens captured read-only on the owner's HONOR
phone (builds 80464ecc, d99afc2b, fbea3919), the owner's V46 prototype (`Downloads/USKOCI_V46.html`) as the calm target,
and the forensic UI/UX analysis doc. The owner-facing summary is the Claude Doc "USKOČI · Master dizajn"
(https://claude.ai/code/artifact/4e3c1c50-fa0b-48a7-b998-454e0b8b6923).

## Screen classes and chrome rule

| Class | Screens | Bottom tab bar | Top | Primary |
| --- | --- | --- | --- | --- |
| ROOT | `/` (Početna / Zadaci), `/mapa`, `/dogovori` | yes | ScreenHeader (profile · mark · bell), no big title | none, or the orange "+" |
| DETAIL | task (public and own), applications, my applications, activities, calendar, notifications, profile and its family, other person's profile | no | DetailTopBar: back, title in the content, bar title only after scrolling | one, sticky when it exists |
| FLOW | `/nova`, `/pregled-zadatka`, place, photos, apply, availability, worker profile, rating, pickers | no | back or close; progress when multi-step | one, sticky |
| CONTEXT | `/dogovor/[id]` (Pregled / Poruke), group chat, completion | no | back, person, state | one, by state |

Today 26 of the 37 screens registered in `src/app/(app)/_layout.tsx` are `PUSHED` (tab bar visible). Only the three
ROOT screens keep it; every other screen becomes `FULL`. Seven screens currently stack their own sticky footer on top of
the tab bar (`profil/radnik`, `profil/razgovor`, `profil/dostupnost`, `profil/izvoz`, `profil/pravna`, `podrska`,
`profil/obavestenja`). The tab bar also appears and disappears inside one flow (Dogovor → `/oceni-dogovor`; FULL task
screens → `/pitanja-zadatka`; `/nova` FULL vs `/profil/razgovor` PUSHED).

## Systemic findings

1. **Four "primary" styles:** green `brandAction`; ink `V2Action kind="primary"` in the location editors; the auth
   PrimaryButton; the orange Home tile and FAB. Keep only the green primary; the orange "+" is an accent, not a screen
   action.
2. **Said two or three times:** header + second title on nine settings screens ("Područje rada" + "Gde možeš da
   uskočiš?", "Ime na profilu" + "Ime za prikaz", "Blokirani korisnici" + "Tvoja blokiranja", "O aplikaciji" +
   "USKOČI", "Zahtev #N" + case title, "Podešavanja obaveštenja" + "Kanali obaveštenja"…); the place three times on a task
   detail (Lokacija fact, Mesto zadatka map, Mesto izvršenja disclosure); a draft's next step three times; the Dogovor's
   person and state in the bar and again in the body.
3. **Buttons that duplicate a tab or the back arrow:** "Idi na Početnu", "Istraži zadatke", "Otvori sve Dogovore",
   "Svi Dogovori" + the "Uskoči i zaradi" tile, "Nazad" on unavailable states, green "Nazad na Dogovor", "Nazad na
   pregled", "Podesi obaveštenja" next to the gear, "Odustani od filtera" next to the X.
4. **Card-built detail screens:** the task detail stacks the status strip, requirements panel, photos card, disclosure
   card and Q&A card; V46 shows the calm version (sections separated by space and hairlines, one sticky primary).
5. **Two control rows before content:** `/moje-aktivnosti` (underline tabs + Aktivno/Istorija pill).
6. **Status boxes that repeat the next line:** "Traži ponude · Prijave su otvorene" above "Tražim ponude";
   "Objavljen · Sledeće: …" above the facts.
7. **Big maps for approximate places:** half-screen maps on task details; a 160-high mini map with "Mapa →" is enough.

## Functional defects found by the audit (fix in step G, each with a regression)

- `/dogovor/[id]/grupa`: the back arrow pushes a new `/dogovor/[id]` instead of going back.
- `/mesto-zadatka` has no entry in the app; `/prilike` is a second copy of the Mapa tab (only entry: a fallback
  `router.replace('/prilike')` in `prijava.tsx`).
- "Dopuni radni profil" opens `/profil`, not `/profil/radnik`.
- "Pravila i saglasnosti" opens a screen titled "Pravna dokumenta".
- `/prilike/[id]` back label says "Nazad na Zadatke", a screen that no longer exists; `/potrebe/[id]/kandidati` back
  says "Nazad na zadatak" but returns to the list in the offer view.
- `/prilike/[id]/prijava` unavailable state is titled "Prijave".
- `AiConversationShell` applies only the top safe-area inset; on `/nova` (tab bar hidden) the composer may sit under the
  home indicator. Check on the phone.
- `PublicLegalModal` export is unused.
- Fixed tonight: `Podešavanja obaveštenja` failed to load when the build has no push provider (ae274c0f).

## Screen by screen

| Screen | Class | First focus | One primary | Remove or merge |
| --- | --- | --- | --- | --- |
| `/` Početna / Zadaci | ROOT | what waits for me, then my tasks and applications | none; "+" | depends on the owner's first-screen decision; the "Uskoči i zaradi" tile duplicates Mapa |
| `/mapa` | ROOT | pins and count | none; "+" | "Dodaj zadatak" in the legend (the "+" exists) |
| `/dogovori` | ROOT | Dogovori that wait for me | none | "N Dogovora" line (tabs carry counts); "Idi na Početnu" → "Pronađi zadatak" |
| `/prilike/[id]` | DETAIL | title and price | Sastavi prijavu | status box, second and third place, cards around photos and Q&A |
| `/potrebe/[id]/pregled` | DETAIL | title, state, application count | Pregledaj prijave · N | the body row that opens the same screen; edits into "…" |
| `/potrebe/[id]/kandidati` | DETAIL | offers, sorted | none in the list; "Izaberi" in the offer | repeated task title → one compact row |
| `/moje-prijave` | DETAIL | applications that wait for me | per card | "Nazad" button |
| `/moje-aktivnosti` | DETAIL | active | none | second control row; the role is on each row |
| `/potrebe` | DETAIL | active tasks | "+" | becomes the first tab if the owner picks V46 |
| `/raspored` | DETAIL | the week and today | none | "Otvori sve Dogovore" |
| `/dogovor/[id]` | CONTEXT | next step and terms | by state | people card repeating the name; state twice; "Otvori poruke" beside the tab |
| `/dogovor/[id]/izmene` | FLOW | current terms | Pregledaj radnju | one action, one name: "Otkaži Dogovor" |
| `/dogovor/[id]/lokacija` | CONTEXT | last shared point | Podeli trenutnu lokaciju | overlap with the Dogovor's location section |
| `/dogovor/[id]/grupa` | CONTEXT | messages | Pošalji | back defect |
| `/obavestenja` | DETAIL | unread | none | "Podesi obaveštenja" (the gear exists) |
| `/nova` | FLOW | the conversation | Send | safe-area check |
| `/pregled-zadatka` | FLOW | the task as others will see it | Objavi zadatak | three ways back to the chat → one; place editing as its own step (today up to three primaries) |
| `/fotografije-zadatka` | FLOW | photos | Izaberi iz galerije | second intro paragraph |
| `/prilike/[id]/prijava` | FLOW | your offer | Pregledaj → Pošalji | "Tvoja ponuda" twice; wrong error title |
| `/oceni-dogovor` | FLOW | stars | Sačuvaj ocenu | tab bar; green "Nazad na Dogovor" → back arrow; FactArt star |
| `/profil` | DETAIL | you and your state | none | "Uredi" and "Ime na profilu" lead to the same screen |
| `/profil/radnik` | FLOW | what is missing for activation | one, sticky | identity card (already on Profil); area and availability as rows |
| `/profil/razgovor` | FLOW | the conversation | Send | header and card both "Tvoj radni profil" |
| `/profil/lokacija`, `/dostupnost`, `/podaci`, `/fotografija` | FLOW | the field or the week | Sačuvaj | second title; "Osveži" below the sticky footer |
| `/profil/obavestenja` | DETAIL | switches | Sačuvaj podešavanja (today a secondary) | "Kanali obaveštenja" as second title |
| `/profil/privatnost`, `/izvoz`, `/blokirani`, `/pravna`, `/o-aplikaciji` | DETAIL | state | at most one | second titles; one name for the legal documents |
| `/podrska`, `/podrska/novi`, `/podrska/[id]`, `/podrska/operator` | DETAIL / FLOW | cases | Novi zahtev / Pošalji | card inside a card in "novi"; several operator primaries at once |
| `/pitanja-zadatka` | DETAIL | questions | Pošalji or Objavi odgovor | tab bar |
| `/bezbednost` | DETAIL | the two choices | Pošalji privatnu prijavu | tab bar |
| `/auth`, `/oporavak` | FLOW | one decision | one | titles repeated two or three times |

## Components (after tonight's token units)

Cards: `card` (panel) and `cardCompact` (list item) with V28's two-layer shadow, `inset` for notes, no card inside a
card; 19 hand-rolled cards moved onto the tokens. Fields: one `field`/`fieldBox` token. Chips: pills. Icons: FactArt
for facts (24 kinds), line icons for controls, pictograms for pickers (46 kinds, `src/ui/system/Pictogram.tsx`,
`PickerTile`). Remaining: sheets with a duplicate close; status boxes; detail screens built from cards; one
reduced-motion hook (`src/ui/system/motion.ts` and `src/hooks/useSystemReducedMotion.ts` both exist).
