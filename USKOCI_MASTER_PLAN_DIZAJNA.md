# USKOČI — glavni plan dizajna (UI/UX nastavak)

Radna grana: `work/uskoci-ui-unification-20260924` (od `724f4ed1`; glavna grana `clean-alpha-backend` se ne dira).
Ovaj fajl je glavni plan za UI/UX nastavak. Detalji i slike: Claude Doc „USKOČI · Master dizajn“, kartica
„Plan ekrana (23. sep)“ (https://claude.ai/code/artifact/4e3c1c50-fa0b-48a7-b998-454e0b8b6923) i skice
(https://claude.ai/artifact/B2YMSAQVPz7iuq6TXHgZLf). Istraživanja: `docs/implementation/research/`.

Cilj: jedna ujednačena, moderna, premium, čista BELA aplikacija; tamnozelena osnova (`#076E4E` za glavnu radnju,
naslove i izbor), narandžasta samo kao kontrolisani akcenat (objava zadatka, „Čeka te“, „+“). Zadatak, Prijava i
Dogovor pripadaju istoj aplikaciji, ali svako ima jasnu namenu. Poslovna logika, statusi, navigacija, privatnost,
ID veze, baza i tokovi ostaju, osim kad je greška dokazana. Ništa se ne izmišlja: ocene, GPS, uspešan upis, status.

## Current execution checkpoint — 2026-09-25

This section is the current design/AI continuation plan. The dated audit below is history, not a list of defects
that all still exist. `docs/control/redovi.json` remains the execution tracker; this file explains the design
decisions. Exact-source checks, APK and device evidence belong in `docs/implementation/design-system/r7-cohesion-20260925/`.
No completion percentage is inferred from passing tests or the historical 181 R6 entries.

### Implemented foundation and remaining visual work

| Surface / user's job | What is implemented | Current decision and next acceptance |
| --- | --- | --- |
| Home: decide what needs attention | Two entry actions; four server-owned attention reasons; next Agreement; own tasks and applications. | Keep this hierarchy and the quiet first-run illustration. Do not add motion to static obligations. Group the attention heading/count for speech. Recheck narrow/large-text layout on the new APK. |
| Discovery: find a suitable nearby task | Shared map/list, price pins, clustering, multiple tasks on one point, draft filters and honest result counts. | Add explicit-tap Nearby, one ephemeral foreground observation. Keep the quiet map ground so green selection and urgency remain legible. Reuse illustrated card facts on the selected preview. Complete map credits and remove the duplicate native credit control. |
| Pins and map color | Public rounded coordinates; selected green price/place pill; count clusters; Serbian Latin labels; approximate area on read-only task maps. | Keep amount, offer and missing-price pins semantically distinct. No invented distance, live position, urgent status or rating. Tune contrast only after actual map screenshots; a wholesale green map would compete with selected tasks. |
| Filters and changing views | Draft-before-Apply search, place/date/price/work-mode/free-place choices, chip removal, clear-all and unavailable counts. | Existing records revealed by a changed filter should appear immediately, not replay arrival motion. A genuinely arriving record may animate once. Sorting, saved-search alerts and server pagination remain separate verified-contract work. |
| Task cards and detail | Shared truthful value slots, FactArt, requirements, availability, publisher; photos only inside task detail. | List head stays compact; the pin preview stacks the same title/value head to reserve its close control and long title. Place/time use separate illustrated rows. Keep exact address protected and missing price in ordinary text. |
| Location forms | Separate public place/private address, point validation and command recovery. | Save itself is the confirmation (`confirmed: true`); the redundant checkbox is removed. Pending-point and unknown-outcome guards remain. Verify onsite, remote and worker area visually. |
| Offers and candidate choice | Price/people/note, review before send, candidate comparison and explicit acceptance. | Retain approved acceptance wording and pricing semantics. Inter must also reach native amount/input fields with the correct bold face. Current-build real offer/selection acceptance is still owed. |
| Agreement and messages | State-dependent next action, accepted terms, thread, contact and protected task address. | Retire current-location sharing route and entries only, per owner decision. Keep exact task-location disclosure, telephone consent and all server records. Keyboard, long thread, reconnect and terminal-media recovery require explicit acceptance. |
| AI task and worker interview | Real owned conversation clients, review, correction, save/publication and durable recovery. | Preserve typed drafts when speech completes; allow safe exit from a running worker interview; remove the worker availability panel's nested vertical scroll. See AI table below. |
| Profile, calendar, support/settings | Native screens and corresponding galleries already exist. | Apply the shared Inter face to input controls, then verify actual focused inputs, fixed footers, large text and all loading/error states. Do not infer whole-flow completion from galleries. |
| Motion and accessibility | Shared durations, press feedback, live reduced-motion store, sheets, bounded map annotations. | Gate root-stack transitions, reset interrupted bell motion, suppress false arrivals, speak contextual badge counts and hide a sunk sheet completely from accessibility. Retain the existing restrained success/empty-state assets. |

### AI: implementation is not activation or device acceptance

| Capability | Evidence / state | Work still needed |
| --- | --- | --- |
| Task interview by text | Source `nova.tsx`, `aiNeedV2Production`, `aiTaskReviewClientService`; historical task-to-publication phone evidence on 23 September. Speech/draft ownership is now corrected with predecessor-failing regression tests. | Recheck category inference and corrections against owner-approved real conversations. The old phone run does not accept today's build. |
| Worker interview → profile | Source supports interview, manual edits, tools/team/availability, frozen review, save/activate and recovery. Historical v17 Edge receipt exists. Safe Back, availability scroll and independent typed-draft preservation during speech/recovery are corrected in source and predecessor-failing tests. | Full current-build interview→review→activate journey still needs device evidence. |
| Dictation / held microphone | Native Android speech adapter + authenticated speech-session path. Held microphone sends on release; accessible dictation appends to the editable draft and uses Send. | Real microphone, denial, interruption, background, retry and latency checks only when the owner is ready. Mocked voice-controller tests are not microphone acceptance. iOS native speech is not implemented. |
| AI speaking aloud / full voice conversation | Not implemented. Voice-mode UI still sends speech as text and renders text answers. `isAiSpeaking` is only a guard hook. | Separate approved runtime/provider, audio focus, stop/interruption, text fallback and cost/privacy decision. `expo-speech` is not approved. Do not call this activated. |
| Provider/admission/budget | Source checks provider configuration, admitted account and policy validity; IDs/revisions bind each turn; unknown outcomes are reconciled rather than blindly replayed. Historical receipts are source-compatible. | A fresh operational read and an explicitly permitted real call are needed before claiming current provider availability. Do not read/print keys, enable gates, spend provider money or declare all registrations admitted. |
| Screen-reader responses | Existing typing status and accessible controls; new completed answers do not yet have a dedicated one-time announcement. | Add a completion announcement that does not re-read history or every fragment, then test with a screen reader. |

### Finish order after this client package

1. Exact-source typecheck/full Jest, matched CI and APK; inspect native map/card/filter/form states and large text.
2. Reconcile remaining R6 majors against current bodies. Preserve refuted findings as refuted: the list sinking
   behind a pin preview is approved V47 behavior; the old selected-cluster claim was refuted. Do not redo recovered agents.
3. Close remaining client defects one coherent flow at a time, with keyboard, offline, stale/unknown-outcome and
   return paths. R6 source findings and the 24 September independent contract audit are separate evidence sets.
4. Propose server work separately (discovery/paging, review enrichment, new rating-comment contract). Candidate SQL
   and disposable proof first; **nothing applied to DEV without the owner's “primeni”**. Payments/PKG-051 stay with
   the other session.
5. Current-build two-party journey: publish → apply → choose → agree/message → complete/confirm → both ratings;
   cancellation/problem branches, notifications and actual push, privacy/export/closure must each be accepted.
6. Legal/operator/retention, payment-provider decisions, production environment, iOS acceptance and store gates remain
   release work. Finishing visual polish alone does not make the application ready for public release.

## 1. Audit (24. sep, merenje na `724f4ed1`)

**Dobro i ostaje**
- Jedan sistem boja i slova u `src/ui/system/tokens.ts` (`sys`), koji koristi 68 fajlova. Inter font, V28 paleta, provereni kontrasti.
- FactArt (24 dvobojne ikonice za činjenice) i Pictogram (46 slika za biranje), provereni na telefonu od 20 do 64 px.
- Server, zaštite i oporavak: svaki ekran čita i piše kroz postojeće klijente sa rokovima, revizijama i proverom naloga.
- Donja traka samo na glavnim ekranima (G.0). Novi detalj zadatka, kartica, alatke liste i pregled Dogovora (G.2, G.3, G.5, G.7) su mirniji i bez kutija.

**Konfliktno (isto rešeno na više načina)**
| Oblast | Stanje | Posledica |
| --- | --- | --- |
| Tokeni | `sys` u 68 fajlova, ali stari `theme/tokens` još u 14 (prijava, Press, Button, Text, Segmented, mapa), `aiFirst` i `v2` tokeni u 4 | dve lestvice boja i razmaka; AI ekran i fotografije boje iz trećeg izvora |
| Ručne boje | 23 ručna hex zapisa van tokena (Početna, ilustracija, Detail, Text, TaskCard, ulaz) | boje koje ne prate temu |
| Zaglavlja | 6 načina: `ScreenHeader` (3), `DetailTopBar` (19), `ProductHeader` (8), `AgreementPersonBar`, `SettingsScreen` zaglavlje (16), ručna zaglavlja (raspored, prijava) | različita visina, strelica i naslov od ekrana do ekrana |
| Prozori | 9 ručnih `Modal` (profil osobe, izbor prijave, kalendar, lokacija, zatvaranje naloga, pravna dokumenta, AI, pregled završetka) + 1 donji panel (`ProductSheet`) + 9 sistemskih `Alert.alert` potvrda | tri različita izgleda za istu stvar: „potvrdi“, „izaberi“, „pogledaj“ |
| Dugmad | `V2Action` (36 fajlova) i stari `Button` (3 fajla: lokacija rada, privatna lokacija, pretraga područja) | dva izgleda dugmeta |
| Otvaranje u mestu | 16 ručnih „otvori/zatvori“ blokova | različite strelice i razmaci |
| Smanjen pokret | 21 mesto, tri izvora (`motion.ts`, `useSystemReducedMotion`, Reanimated) | neki ekrani ignorišu podešavanje telefona |
| Kartice | TaskCard, kartica prijave, kartica Dogovora crtane odvojeno | nije jedan sistem |

**Zamenjuje se zajedničkom komponentom**
1. `ScreenChrome`: jedno zaglavlje za tri vrste ekrana — glavni (profil · znak · zvonce), detalj (strelica · naslov koji se pojavi pri pomeranju · „···“), tok (zatvori · korak). Zamenjuje `ScreenHeader`, `DetailTopBar`, `ProductHeader`, zaglavlje `SettingsScreen` i ručna zaglavlja.
2. `Sheet`: jedan donji panel (gorhom, odobren) sa varijantama `ActionSheet` („···“ radnje), `ConfirmSheet` (umesto `Alert.alert`), `PickerSheet` (izbor), `PeekSheet` (kartica tačke na mapi, bez zatamnjenja). Zamenjuje 9 `Modal` i 9 `Alert.alert`.
3. `Action`: jedno dugme (`V2Action` ostaje ime) sa jasnim stanjima: obično, isključeno uz razlog, u toku, greška, uspeh; dodir najmanje 48; stari `Button` se gasi.
4. `Disclosure`: jedno otvaranje u mestu sa istom strelicom i pokretom.
5. `CardFace`: jedna anatomija kartice (stanje → naslov → činjenice → uslovi → vrednost → dno) za Zadatak, Prijavu i Dogovor; svaka ima svoju boju namene (zadatak: cena zeleno; prijava: tvoja ponuda; Dogovor: osoba i termin).
6. `StateView`: prazno, učitavanje, greška i „bez veze“ na jedan način (ikonica, jedna rečenica, jedna radnja).
7. Tokeni: `theme/tokens`, `aiFirst` i `v2` tokeni se svode na `sys`; ručne hex boje idu u tokene.
8. Pokret: jedan izvor za „smanji pokret“, kratke tranzicije vezane samo za stvarnu promenu stanja.

## 2. Redosled (tvoj, 24. sep)

1. **Audit** — ovaj odeljak.
2. **Design system i zajedničke komponente** (tačke 1–8 iznad), uz tablu na emulatoru.
3. **Glavna navigacija, zaglavlja, donja traka:** Početna | Zadaci | Dogovori; Početna kao pregled (dva velika dugmeta, „Čeka te“, sledeći Dogovor, Moji zadaci, Moje prijave); „Moje aktivnosti“ se gasi; `/mapa` i `/prilike` vode na Zadatke.
4. **Mapa, tačka, filteri, Dodaj zadatak:** Zadaci kao jedan ekran (mapa preko celog ekrana, lista koja se izvlači odozdo), kartica tačke bez zatamnjenja, filteri u odeljcima (Kada · Gde se radi · Cena · Slobodna mesta), „+“ u zaglavlju liste; nazivi na mapi na srpskoj latinici; zadaci na istoj tački dostupni.
5. **Zadaci i Moje prijave:** kartica kao sistem, detalj zadatka (naslov u zaglavlju pri pomeranju, retke radnje iza „···“, razlog kad prijava nije moguća), moje prijave.
6. **AI Novi zadatak:** živa kartica nacrta, plutajuće polje za pisanje (+ · tekst · mikrofon · glas) po uzoru na Gemini, glasovni razgovor (govor aplikacije traži odobren paket).
7. **Pristigle prijave i izbor kandidata.**
8. **Dogovori, Pregled, Poruke.**
9. **Profil, radni profil, vozila, alat, tim** (biranje sa slikama u dve kolone).
10. **Kalendar, dostupnost, izuzeci.**
11. **Obaveštenja, podešavanja, privatnost, podrška.**
12. **Kompletna regresija i završni vizuelni polish.**

Svaka celina: tipovi i testovi → build → **emulator** (320 / 360 / 390 / 430 px, uvećan tekst, dugi nazivi) →
slika → odvojena kritika toka i izgleda → ispravka → nova slika → commit po celini. Ništa nije završeno samo zato
što test prolazi.

## 3. Šta ostaje vlasniku

Plaćanje (ko plaća, cena, dobavljač, Google Play naplata, fiskalni račun), pretraga adresa za javno puštanje
(plaćeni LocationIQ ili državni Adresni registar), paketi koji traže odobrenje (govor aplikacije, provera mreže),
serverski paketi (obaveštenja sa imenom, poslednja poruka na Dogovorima) i iste reči za vozila i alat kod pomoćnika.
Sve ostalo je odluka tima.
