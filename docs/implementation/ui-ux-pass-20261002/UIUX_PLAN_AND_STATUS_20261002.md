# UI/UX pass - the plan and where it stands (kept in the repository 2026-10-02)

This is the plan of the UI/UX pass the owner ordered on 2026-10-02 ("kreni sad", see `OWNER_START_AND_COMPLAINTS_20261002.md`). It is NOT a second master plan: the single status registry stays `docs/control/redovi.json` and the LIVE plan `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html` (its "next" block carries the current cursor). Until 2026-10-02 the plan lived only in a working folder; this file and the three JSON files beside it are the durable copy.

Files: `UIUX_PLAN_20261002.json` (waves, items with finding ids, conflicts resolved, items dropped, the 13 owner questions, the first visible win), `UIUX_AUDITS_20261002.json` (the per-area audits the plan was derived from: Home, Zadaci, Moji zadaci, Dogovori/chat, icons, motion), `UIUX_W1_RESULTS_20261002.json` (the four wave-1 authors and the two reviews). Finding ids (HP-, Z, MZ-, DG-F, ICO-, MO-M) point into the audits file.

## Later owner direction and evidence — 2026-10-02

The latest owner requests black primary text, gray supporting text, white surfaces, curated 2.5D artwork and stronger composition across every screen/flow. This supersedes green headings and blanket flat icons in the original wave recipes. Apple craft and the supplied Airbnb map/list/filter references are quality guidance adapted to USKOČI. Prioritize connected visual work and actual screen critique; focused existing tests protect behavior, without expanding test infrastructure for every style edit. See [direction and recovered earlier references](VISUAL_FINISHING_20261002.md).

The wave table below preserves its original checkpoint. Current status is solely in `docs/control/redovi.json`: W2 shell and the bounded own-task U16 controls have subsequent exact-APK emulator evidence in [W2/W8 receipt](W2_W8_CODEX_NATIVE_20261002.md). W5–W7 source `b574e118` plus correction `5bdeef52` now have scoped native UX/VISUAL evidence; connected Home/application/Agreement source `c81722a2` revealed a rail-reset defect, corrected in final `8d22ce0e`, build37012789559, with bounded native UX/VISUAL approval. The final build also verifies the compact black AI opening; natural generated responses and remaining AI work stay open. See [current visual receipt](VISUAL_FINISHING_20261002.md). None of these receipts closes every screen in a wave.

Screen reviews must consider the whole purpose and journey: information order, primary action, density, black/gray reading hierarchy, intentional card versus open section, illustration scale, selected/empty/loading/error state, Back/keyboard/scroll and reduced motion. Home, task detail/applications, Agreement/chat/AI and account/notifications each need their own populated-screen critique as the same plan continues. Profile/notification critique findings remain attached to their existing control rows; they are not omitted merely because the original wave table names them incompletely.

## Gde smo i šta završavamo — presek proizvoda 2.10.2026.

Ovo je čitljiv presek postojećeg plana, prema kodu `df5e2d31`, primenama zabeleženim u postojećim receipt-ima i poslednjem vizuelnom APK-u `8d22ce0e`. Nije novi master ni novo čitanje živog servera. Registar ostaje `docs/control/redovi.json`.

**Jezgro proizvoda je povezano za obe strane. Cela aplikacija još nije završena za javno izdanje.** Istorijski R18 tok je stvarno prošao od objave zadatka na daljinu do obe sačuvane ocene. Sadašnji APK ima ograničen pregled mapa/listi/detalja, prijava, Dogovora i početka AI unosa; nema novo prihvatanje celog poslovnog toka. Broj „41 problem / 21 nije provereno / 0 gotovo“ nije procenat dovršenosti niti dokaz da 41 funkcija ne radi: meša otvoren rad, stare nalaze i stroge zahteve za dokaz tačne verzije.

### Gde šta pripada

Jedan nalog, dve namere; nema globalnog prebacivanja uloge. Donja navigacija je **Početna · Zadaci · Dogovori**. Profil i zvonce su zajednički ulazi; u Zadatcima kroz „Još mogućnosti“.

| Celina | Svrha i ulaz | Izlaz / sledeća odluka |
| --- | --- | --- |
| Početna | Dve namere, šta čeka baš mene, naredni Dogovor; ulazi u Moje zadatke i Moje prijave | Nastavi posao koji traži reakciju ili pokreni novi |
| Novi zadatak | Objavi zadatak → AI razgovor; mesto i fotografije pripadaju tom nacrtu | Pregledaj stvarne činjenice, ispravi, sačuvaj nacrt ili objavi |
| Potvrđena objava | Trenutni kod vodi u Zadaci sa tačnim ID-jem zadatka | Izabrani zadatak na mapi/listi; ne vraćati završen razgovor pritiskom Nazad |
| Moji zadaci → moj zadatak | Moje objave, nacrti i istorija; stanje i prijave na konkretnu objavu | Pristigle prijave, dopuna nacrta ili dozvoljeno upravljanje zadatkom |
| Prijave → poređenje / jedna prijava | Ko nudi da uradi posao, po kojim uslovima i sa koliko ljudi | Potvrdi tačne prihvaćene uslove → Dogovor |
| Radni profil | Profil → Veštine, alat i tim; AI i ručno uređivanje istog profila | Područje rada, dostupnost i aktiviranje; kalendar je pregled prihvaćenih obaveza |
| Zadaci → javni detalj | Mapa i lista istih poslova; pretraga i filteri; da li mi ovaj posao odgovara | Pitanje, javni profil ili sastavljanje prijave |
| Sastavi prijavu → pregled | Moj iznos i osnova, ljudi, termin i poruka | Potvrđeno slanje → konkretna prijava u Mojim prijavama; poseban oporavak neizvesnog ishoda |
| Moje prijave | Moje poslate prijave, njihovo stanje i dozvoljena naredna radnja | Izmena/povlačenje ili Otvori Dogovor |
| Dogovor → Pregled / Poruke | Zajednički posao: trenutni korak, prihvaćeni uslovi, osoba i razgovor | Izmene, kontakt/adresa po dozvoli, završetak i ocena |
| Obaveštenja | Šta se desilo i na šta treba reagovati | Otvaranje odgovarajućeg zadatka/prijave/Dogovora; nisu drugi spisak razgovora |
| Profil, podrška i privatnost | Trajna podešavanja, identitet, bezbednost i prava nad podacima | Povratak na posao; status zahteva i jasan oporavak |

**Četiri slična naziva imaju četiri različita posla:** Zadaci = tržište; Moji zadaci = moje objave; Prijave = ponude drugih na jedan moj zadatak; Moje prijave = ono što sam ja poslao. U završnom UX-u nazivi i povratci moraju očuvati tu razliku. `/mapa`, `/prilike` i `/moje-aktivnosti` su kompatibilna preusmerenja, ne nove glavne destinacije. Ponuda osobe u toku izbora sada je panel. Pregled/Poruke su vidljivi na pregledu Dogovora; poruke imaju svoj povratak, nije ista stalna traka na oba prikaza.

### Funkcionalno stanje koje određuje dizajn

| Oblast | Šta postoji | Šta stvarno ostaje |
| --- | --- | --- |
| Nalog i sesija | Prijava, registracija, oporavak, email callback i vraćanje sesije | Stvaran email → povratak u trenutni APK; neuspeh EX07-S03 provere nije dokaz kvara registracije |
| Objavljivanje | AI → ispravka → pregled → evaluacija/objava; mesto i slike | Kvalitet novog AI razgovora i aktuelni ceo tok; RC02 konkurentne operacije nad slikom imaju reprodukovan defekt |
| Lične liste i ocene za reakciju | EX04 je primenjen; sve tri paged zastavice uključene u DEV APK-u, zbirne ocene povezane | Veći skupovi, druga strana i svi pozitivni slučajevi čekanja ocene; ne praviti ponovo straničenje |
| Mapa/pretraga/filteri | P6 čitač uključen; EX03 zatvoren sa dokumentovanim granicama; aktuelna kompozicija viđena | Završni raspored kontrola, širi uslovi i fluidnost; ne predstavljati serversku pretragu kao nepostojeću |
| Radni profil i pronalaženje odgovarajućih ljudi | AI/ručno uređivanje, veštine, alat, tim, područje, dostupnost, matcher i trajni Inbox događaji | EX06 nije zatvoren: alias kandidat, jedan vremenski kraj, računanje relativnog dana i reprodukovani F5–F12 nalazi; lepši AI ekran to ne rešava |
| Prijava, izbor i Dogovor | Slanje/povlačenje, pitanja, poređenje, izbor, prihvaćeni uslovi, izmene, otkazivanje, završetak i zvezdice | Završna kompozicija odluke; aktuelni višekorisnički, konkurentni i oporavak-tokovi |
| Tekst, fotografije i grupa | B3 istorija/ACK, tekst/foto put i tekstualna grupa povezani | Stvaran sadašnji prijem, prekid/povratak veze, slike i više članova; grupa V1 ostaje tekstualna sa ručnim osvežavanjem |
| Glasovna poruka u Dogovoru | Server B1 i delovi logike klijenta postoje | Recorder/player još nisu u korisničkom razgovoru, flag je OFF; Android glas je obavezan V1. To nije isto što i AI govorni unos |
| Pisani komentari uz ocene | Server i deo klijenta postoje; stari „NO CLIENT“ opis nije tačan | Nezavisan pregled, javni profil, izmene za ulogu/blokiranje, DEV uključivanje i dokaz; javna aktivacija čeka pravne uslove |
| Bezbednost/podrška/privatnost | Ekrani i ugovori za prijavu/blokiranje, podršku, izvoz i zatvaranje naloga | Safety-name kandidat nije primenjen; završni EX08 prolaz, pravni/operativni uslovi i dokazi oporavka |

Snimak kataloga i pregled dostupnih poziva trenutno ne prijavljuju klijentski poziv bez serverskog ugovora. Pregledani dostupni pozivi imaju odgovarajuće ugovore u snimku; to ne dokazuje njihovo uspešno izvršenje ili poslovnu ispravnost svih kombinacija. Poslednje posebno DEV čitanje u ovom nastavku ostaje ono iz `CODEX_CONTINUATION_20261002.md`, 2.10. u 10:35:43 UTC; ovaj presek ne tvrdi novo živo čitanje.

**Već prihvaćene granice prvog izdanja:** Android prvi, besplatan početak; push, HITNO, podsetnik pred termin, plaćanja i iOS su odloženi prema 75 prihvaćenih odluka. Ne prikazivati ih ponovo kao neodgovorena pitanja ili obavezan rad pre prvog Android izdanja. Glasovne poruke nisu odložene. Javno izdanje još traži završnu privatnost, pravne/operativne podatke, novi produkcioni projekat i potpisani paket.

### Završna kompozicija: odluka prvo, sadržaj zatim

Sledeći povezani zahvat unutar postojećih W5/W8/W9/W10 završava **odluku koja stvara Dogovor**. Prvi paket obuhvata javni detalj → prijavu/pregled → moju prijavu, i moj zadatak → pristigle prijave/poređenje → potvrdu izbora → Dogovor. Posle toga isti postupak za AI nacrt/radni profil, svakodnevni razgovor i završetak, zatim profil/obaveštenja/pomoć.

| Ekran | Šta mora da bude jasno na prvom pogledu | Raspored pri završnoj obradi |
| --- | --- | --- |
| Javni detalj | Šta radim, gde/kada, za koliko i da li ispunjavam uslove | Sažetak posla i uslovi → objašnjenje/fotografije → osoba/pitanja; jedna jasna radnja za prijavu |
| Prijava i pregled | Šta tačno nudim i šta ću poslati | Iznos/osnova + ljudi/termin → poruka → jedan pregled; bez dva konkurentna sažetka |
| Moj zadatak | Da li treba da dopunim, izaberem nekoga ili nastavim ugovoreni posao | Stanje i sledeća radnja → prijave/kapacitet → detalji objave; retke radnje u meniju |
| Pristigle prijave | Razlika između ljudi i njihovih ponuda | Osoba → ukupni uslovi → poruka → izbor; poređenje poravnava ista polja, ne ponavlja čitave kartice |
| Potvrda izbora | Ko dolazi i koje uslove prihvatam | Jedan kompletan sažetak prihvaćenih uslova i potvrda; posle uspeha jasan Dogovor |
| Dogovor | Šta sada čeka mene | Sledeći korak → prihvaćeni uslovi i osoba → poruke; izmene/otkazivanje ne konkurišu svakodnevnom radu |

Konkretan otvoren UX spoj: `NeedPresentation` i dalje bira „Pregledaj prijave“ za objavljen zadatak sa prijavama, čak i kada nema novih za izbor; dodatni meni otvara opštu listu Dogovora. Završiti put prema stvarno povezanom Dogovoru/izboru više Dogovora iz postojećih ovlašćenih podataka; ne pretpostaviti prvi ID i ne izmišljati cenu ugovorenog rada iz cene objave. Ovo je definisan sledeći zahvat, nije tvrdnja da je već implementiran.

Crn glavni tekst, siv prateći, bele površine; ilustracije i akcije nose boju. Kartica grupiše jednu odluku, otvoren red služi pregledu, panel kratkom izboru. Skinuti duplirane naslove i objašnjenja, sačuvati činjenice, razloge nedostupnosti i oporavak. Svaki ekran pregledati u kontekstu ulaza, narednog koraka, Nazad, tastature i učitavanja. Rad se prihvata na povezanom toku, uz ciljane postojeće provere; bez novih testnih projekata za kozmetiku.

Izvori: `src/app/`, `src/ui/v2/NeedPresentation.tsx`, `src/ui/profile/ProfileHubPresentation.tsx`, `.github/workflows/build-android-dev-apk.yml`; `VISUAL_FINISHING_20261002.md` i `VISUAL_NATIVE_20261002.json`; `CODEX_CONTINUATION_20261002.md`; `OWNER_DECISIONS_20261002_ALL75.md`, `EX03_CLOSURE_RECEIPT_20261001.md`, `EX04_S1_S4_DEV_APPLICATION_RECEIPT_20261001.md`. Dve nezavisne read-only provere (GPT-6 kao roditelj) proverile su funkcionalne celine i stvarne korisničke putanje; nisu pokretale testove niti menjale DEV. Starije talasne tabele ispod ostaju označeni istorijski presek.


## Diagnosis (from the audits)

1) The owner's phone (about 361 dp) falls on the "large text" side of ad-hoc breakpoints (TaskCard `width < 380`, search bar and panels `< 360`, while Home and the tab bar use `< 340`), so he permanently sees stacked, 290-330 dp cards (1.1 to 1.5 per screen) and a crammed search pill, never the compact layouts the design was made for, and that is what reads as poor overview and "big and repetitive". 2) There is no icon system: five drawing dialects share one screen (FactArt 2.5D stickers, flat HomeLaunchArt, gradient Pictogram, glossy Catalog27 PNGs, thin Phosphor lines), the sticker detail turns to mush at the 16-20 px it is actually used at, hue alternates orange/green per kind against the project's own one-accent rule, one bubble silhouette means three things, ticks sit on unconfirmed terms, and primary controls (filters, calendar) are icon-only. 3) Hierarchy is flat and colour is overloaded: titles, section headings and prices are all bold 20 px ink or green, status is the smallest element on every card, green means action, selection, money and an unconfirmed time at once, and the urgent "Čeka te" list is drawn quieter than the less urgent next Dogovor. 4) Motion exists only as press-scale and late-row fades while every state change is a cut: tab switch, push (fades in from white), Back (hard cut), the 1-2 s skeleton rebuild when returning to Zadaci, data arrival, photo pop-in, chip fold and sheet-end pops, plus a haptic and a shrink on touch-down that fire when a scroll merely starts; all fixes must obey the B22 Reanimated constraint (fewer long-lived views, RN Animated native driver for new motion, no layout or exiting animations). 5) Screens were guarded piece by piece but never composed as one product: the Home doors dropped the entry's photographic warmth and look like clip-art, the Zadaci map and list behave like two screens joined by a floating button, the cards are text-only twins, and the compare screen is a grid of pale panels rather than a comparison. 6) Several screens are unclear for plain reasons that are cheap to fix: wrong empty states (a filter reset on a section with no filter), contradicting counts, a ragged state line on the task detail, prijava/ponuda and five phrasings of "flexible", orphan dots and dates broken mid-date, and a conversation that has no visible name on the Dogovor screen.

## Waves and status

Binding rules for every wave: `AGENTS.md` 3.6 (white reading surfaces, green primary with a white label, no eyebrow copy, text no smaller than 12 px, a missing price never looks like an amount), the B22 motion constraint (no layout/exiting animations, avoid animated SVG draws, keep rows mounted, reduced motion honoured), the phone is the owner's (windows by his word "sad"), one writer per file, no new package, no server change from a UI wave (item 12.4 is a server candidate behind his "primeni").

| wave | status | goal | items |
| --- | --- | --- | --- |
| W1 | DONE IN SOURCE, FIRST LOOK ON THE HONOR 2026-10-02 07:33 (see b22/window7_w1_first_look_20261002.json; motion not captured, no acceptance yet): committed 72d64fc4 (tokens + layout class, size-aware icon cut, press feel, card layout for the 361 dp phone; two review rounds, no blocker; 705 + 3,387 tests, tsc clean); the phone APK 71697bf2 (run 36963044604, patched, attestation pass) is installed on the HONOR. Item 1.1 (read-only device probes) needs an owner window. | Systemic foundations that every later screen inherits: one token/layout-class set, one size-aware icon cut with a single tone rule, one press-and-haptic feel, plus the BEFORE evidence. Order inside the wave: 1.1 and 1.2 first (small, tokens), then 1.3, 1.4 and 1.5 in parallel on disjoint files. | 1.1 BEFORE evidence and device facts; 1.2 Tokens, layout class, motion rules, colour meaning; 1.3 FactArt: flat mark cut at 24 px and below, one tone rule, no false ticks, distinct silhouettes; 1.4 Press feel: haptics are outcomes, one scale ladder, fewer animated views; 1.5 Show the designed card layout on the owner's phone (threshold flip) |
| W2 | SOURCE 2026-10-02 (commit c16f09c4): 2.1 tab bar (capsule fade, flat mark at rest, sticker when chosen, 14/20 label) and 2.3 chrome (closed `Glyph` registry of 30 names, bold 24 chrome glyphs, captioned pill, silent back and close, Phosphor-import ratchet) in source and jest (255 + 600 tests, tsc clean, 17 mutations killed); NOT seen on any device, no independent code review; 2.2 one transition language is DEFERRED (it needs the owner's device recordings). | Shell: the three things on screen in every root and every transition (tab bar, chrome, screen-to-screen motion), so Početna is no longer a hard cut with a template bar. | 2.1 Tab bar: animated selection, crisp inactive icons, readable labels; 2.2 One transition language for tab switches, push and Back; 2.3 Chrome: one Glyph wrapper, bold 24 px chrome glyphs, captioned primary controls, silent navigation |
| W3 | OPEN (not started) | Arrival, state surfaces and moments as shared components, so lists, photos and empty states stop popping in and every screen change inherits it. | 3.1 Arrival, photo wells, state surfaces, in-place reveals; 3.2 One success moment built from View transform/opacity only |
| W4 | OPEN (not started) | Početna, the first screen after the entry: bounded doors with character, an overview where the urgent thing leads, and a first impression that moves once. | 4.1 Home composition: two doors, one type ramp, bounded Čeka te, shaped skeleton, TermLine; 4.2 Root bar says 'you': own Avatar in the profile slot |
| W5 | OPEN (not started) | One task card for Zadaci, Moji zadaci and the pin card: state first, price as the anchor, places said in words, roughly 190-210 dp tall, so overview improves on every list. | 5.1 Shared primitives: StatusMark/StatusChip and SlotMeter; 5.2 TaskCard recomposition on the new anatomy; 5.3 Skeleton that matches the new card |
| W6 | OPEN (not started) | Zadaci list screen: a de-crowded search bar, honest counts, a sheet that moves with its parts, and honest states. | 6.1 Search pill, chip rail and count line; 6.2 Sheet and pill motion without pops; 6.3 Zadaci empty/error states and first-read ground; 6.4 Dock the tab bar (only if the owner agrees) |
| W7 | OPEN (not started) | Zadaci map: the pin card becomes a small decision card and pins say something. | 7.1 Compact pin card and pin-to-pin without replaying the slide; 7.2 Map pins: state and selection, UI-only |
| W8 | PARTIAL IN SOURCE 2026-10-02 (commit 9a1f37a3): 8.1 first half, the Moji zadaci tabs take the whole row, search and a captioned Filteri move to a toolbar, counts on tabs only where they fit (not seen on a device); Moje prijave tabs, fadingEdgeLength, the filter-sheet quick fixes and ListSwap are still open. | Moji zadaci and Moje prijave lists: tabs that fit, empty states that are true, one status anatomy, and set changes that do not cut. | 8.1 Tab rows, counts, filter entry, quick filter-sheet fixes, list swap; 8.2 True empty states and one copy glossary for time; 8.3 Application card on the new anatomy |
| W9 | OPEN (not started) | Candidates, compare and the owner's task detail: decide-by-price lists, a real comparison, and a Pregled that leads with who applied. | 9.1 Candidates list: one leader per row, visible sort, one star, one glossary; 9.2 Compare as a table; 9.3 Pregled zadatka: state line, applications first, one rule, capacity in dots |
| W10 | OPEN (not started) | Dogovori: one Dogovor drawn one way everywhere, a workspace that reads as a status board with a visible conversation. | 10.1 One AgreementRow and TermLine everywhere; 10.2 Workspace: visible Pregled/Poruke tabs, one summary block, rare actions behind the menu, state motion |
| W11 | OPEN (not started) | Conversation, photos and the one-job flows, so the most used part of a Dogovor feels alive and consistent. | 11.1 Chat bubbles, message arrival, photo viewer; 11.2 Izmene form and completion review consistency |
| W12 | OPEN (not started) | Backlog behind owner or server gates (not started without the named gate). | 12.1 One FilterSheet for Zadaci and Moji zadaci; 12.2 One composer for text, photo and voice; 12.3 Retire Catalog27 PNGs on Podrška, Privatnost, Pravna dokumenta; 12.4 Server-side pin price label and task photo thumbnail (candidates only) |

First visible win (the plan's own words): W1 item 1.3, the FactArt size-aware mark cut with the one-tone rule (no ground smudge, no ticks on calendars, orange only for what waits): one file changes every icon on every list card, row and the tab bar on the HONOR at once, with no screen redesigned; ship it with the one-line TaskCard layout-class flip (item 1.5, first confirm the phone's real font scale in 1.1) in the same first APK so cards also stop looking like the stacked 'large text' layout.

## The 13 owner questions: ACCEPTED as proposed on 2026-10-02

All 13 defaults below (U01-U13) and the six questions from the second design pass (U14-U19: green titles stay, the Dogovor stays a white surface, capsule segments yes and actions as A/B, price-capsule pin later, flat tab icons, no offline dependency) were accepted by the owner on 2026-10-02 (record: `docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`). Before that each was a default applied as an A/B.

1. Icon colour (reverses the 2026-09-22 two-tone 'identical look'): single brand tone in small icons, orange only for what waits, and which green (the FactArt #079C77 or the UI #076E4E). Default: yes, A/B card on the dizajn-tabla board, use the UI green so icons, titles and the primary button agree.
2. Home doors: entry photographs (requester teal, worker orange) vs FactArt-built art. Default: photos on bounded white doors, FactArt art as the fallback if he dislikes them on the phone.
3. Dogovor tab icon: handshake (the brand mark silhouette) vs the current bubble+check. Default: keep bubble+check, move 'offers' to a price tag, show the handshake as an A/B.
4. Tab bar: floating pill that reserves its own band vs a docked full-width 64 dp bar. Default: dock (option b), only if the Zadaci sheet geometry stays unchanged.
5. Zadaci order: own tasks first (today) vs after other people's tasks, per the locked IA. Default: leave the server order, label only, no client reordering.
6. Zadaci strip tap: one tap to the full list (today) vs the half stop with the map still visible. Default: keep full, make the Mapa pill slide away on scroll.
7. Map ground: keep the near-white palette or darken one step to a warm neutral (about #EDECE6 / #E6E5DF) so white controls separate. Default: no palette change, stronger control edges; A/B the darker ground.
8. Zadaci empty state: green primary 'Osveži zadatke' (quiet 'Dopuni radni profil') vs today's order. Default: Osveži primary.
9. Catalog27 PNGs (his supplied artwork) retired on Podrška, Privatnost and Pravna dokumenta in favour of FactArt. Default: yes, gallery keeps them.
10. Haptic policy: no tick on touch-down for navigation, ticks only for state toggles and confirmed outcomes. Default: yes.
11. Dogovor chat as a visible 'Poruke' tab instead of an icon (reverses an R21 team decision). Default: yes.
12. Own chat bubble colour unified with the brand green (#076E4E, white text 7:1 either way) instead of #07543F. Default: unify.
13. Task photo thumbnail on cards and a server price label on map pins (both need a server candidate and his 'primeni', and the thumbnail reverses his 2026-09-24 rule). Default: no for now.

## Conflicts the plan resolved and items it dropped

Sixteen conflicts between audits and fourteen dropped items are listed with their reasons in `UIUX_PLAN_20261002.json` (`conflicts`, `dropped`). The resolution that matters most for the build: motion uses React Native Animated or View transform/opacity, not new Reanimated layout animations (B22).

## Status at the handoff to Codex (2026-10-02, about 12:30)

- W1 built and seen on both devices (HONOR window 7, emulator tour 1); W2 and the Moji zadaci half of W8 are in source (commits above), not built into any APK yet.
- Emulator critique of wave 1 (two independent critics, 16 screenshots, 61 findings, top ten for the next wave each): `EMULATOR_CRITIQUE_W1_20261002.md` with the two JSON files beside it. Its UX top three: tab rows that fit at 360 dp x 1.15 (Moji zadaci done in source, Moje prijave open), own task cards and Pregled that tell the truth about state, the right primary action by state on the own task detail.
- Next in this pass: a DEV APK from the current head, an emulator look at wave 2 and the Moji zadaci fix, then W3 and the critique items in the order of the critics' top tens; the HONOR only in a window by his word "sad".
- The successor's reading list and work queue: `docs/implementation/handoff-codex-20261002/CODEX_HANDOFF_20261002.md`.

## What this document does not claim

Wave 1 had its FIRST LOOK on the HONOR on 2026-10-02 (four screens; motion not captured). It is source plus unit tests plus two review rounds plus that first look; the owner has not judged it. A wave is DONE only with phone evidence for the current build (`AGENTS.md` 3.2.1).
