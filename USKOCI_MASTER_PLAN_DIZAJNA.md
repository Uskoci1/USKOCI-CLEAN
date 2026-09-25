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

#### AI conversations — owner-prioritized batch, 25 September (R8)

Task conversation: describe a job, correct its draft, then review before publication. Worker conversation: describe
skills, equipment, team and availability, then review the saved profile. Both keep the existing server commands,
intent journals, privacy notice, microphone contract and recovery. This batch changes their presentation.

Three compositions were considered: a step wizard (clear progression but restricts free corrections), a large
permanent draft dashboard (visible facts but crowds messages and keyboard), and a conversation with a compact
live summary. Selected the third: full-width writing area with a separate action row, clear opening choices,
clear USKOČI speaker identity, quiet user bubbles, and one review target. The summary becomes compact on short
screens, with large text, while typing or while a turn is pending. Reading old messages offers an explicit return
to the newest message without moving the reader unexpectedly.

The worker review presents every frozen fact in open sections: skills/equipment, people, work area, availability,
regular week and exceptional dates. Licences, paused rules, time zone and missing requirements stay visible.
Completed assistant answers announce once by durable message ID. Streaming fragments, loaded history and the
replacement of a visible local message remain still; normal fresh arrivals retain soft motion.

Evidence: `docs/implementation/design-system/r8-ai-conversations-20260925/REPORT.md`. Native acceptance and real
provider/microphone testing remain separate. This batch does not implement spoken AI responses or iOS speech.

#### Map, cards and movement — owner steering, 25 September

The owner wants larger coherent batches before an APK, and soft, responsive motion throughout normal use.
System Reduce Motion remains an individual accessibility preference, not the default visual direction.
Design skills guide usability and implementation; they do not override product facts or the owner's direction.

The Discovery problem: recognise the right task and its terms, then move between the map, preview and list without
losing context. Three materially different compositions were compared:

| Composition | Strength | Cost |
| --- | --- | --- |
| Logo teardrop, terms only in the preview | Strong location silhouette and little horizontal clutter | Every price comparison requires opening a task |
| Logo + exact-price capsule | Brand recognition and comparison together; fits the current selection contract | Wider marks need clustering and a bounded rich-label budget |
| Logo tile with a caption underneath | Compact width, room for the mark | Taller footprint covers streets and separates the price from its touch target |

Selected: logo + price capsule, with a static native logo marker for points beyond the 40 rich-label budget.
Missing prices remain logo-only; offers remain words, never formatted as an amount. Shared public points retain
their count and place list. Remote tasks and tasks with no public point never acquire invented map coordinates.
Recolor only verified Positron layer colors: warmer ground, clearer blue water, pale green parks, legible streets.
Keep sources, geometry, Latin names, clustering and camera ownership unchanged. Selected previews use the same
facts as list cards, with more legible illustrated place/time rows and light press feedback.

Motion decision: retain the existing UI-thread sheet springs, camera easing and interruptible press feedback.
Native bitmap pins stay still; animating every pin would spend frames without helping selection.
Do not remove the preview lifecycle key merely to avoid an entrance animation: dismiss callbacks, changed content
height and scroll ownership must be proven first. No new library is needed for this batch.

Implementation references: [MapLibre images](https://maplibre.org/maplibre-react-native/docs/components/images/)
and [annotations](https://maplibre.org/maplibre-react-native/docs/guides/annotations/).
This is a USKOČI design decision, not a claim to have reproduced another application's current UI.

| Surface / user's job | What is implemented | Current decision and next acceptance |
| --- | --- | --- |
| Home: decide what needs attention | Two entry actions; four server-owned attention reasons; next Agreement; own tasks and applications. | Keep this hierarchy and the quiet first-run illustration. Do not add motion to static obligations. Group the attention heading/count for speech. Recheck narrow/large-text layout on the new APK. |
| Discovery: find a suitable nearby task | Shared map/list, explicit-tap Nearby with one ephemeral foreground observation, clustering, shared-point groups, draft filters and honest result counts. Illustrated preview facts, one set of map credits and 48 dp quick filters are implemented. | Combined APK `43535736` inspected on the emulator: real map, selected card and filter panel. At 320 dp / font 2 the search header is too tall and navigation wraps; compact that composition without shrinking text. Real GPS success remains unproven: the interim run demonstrated timeout recovery only. Keep query/ownership work separate. |
| Pins and map color | USKOČI logo + truthful price capsules, native logo fallback beyond the 40-label cap, selected green capsule, count clusters and rounded public points. Shared warmer map palette and Serbian Latin labels. | Rich logo/selection and both shared map surfaces rendered on the final emulator APK. Credits fit at normal width, wrap at 320 dp / font 1.3, and are not visible at font 2: repair/accept that layout. Native fallback beyond 40 rich markers and physical-device fluidity remain unobserved. No invented distance, position, urgency or rating. |
| Filters and changing views | Draft-before-Apply search, place/date/price/work-mode/free-place choices, chip removal, clear-all and unavailable counts. | Existing records revealed by a changed filter should appear immediately, not replay arrival motion. A genuinely arriving record may animate once. Sorting, saved-search alerts and server pagination remain separate verified-contract work. |
| Task cards and detail | Shared truthful value slots, FactArt, requirements, availability, publisher; photos only inside task detail. | List head stays compact; the pin preview stacks the same title/value head to reserve its close control and long title. Place/time use separate illustrated rows. Keep exact address protected and missing price in ordinary text. |
| Location forms | Separate public place/private address, point validation and command recovery. | Save itself is the confirmation (`confirmed: true`); the redundant checkbox is removed. Pending-point and unknown-outcome guards remain. Verify onsite, remote and worker area visually. |
| Offers and candidate choice | Price/people/note, review before send, candidate comparison and explicit acceptance. | Retain approved acceptance wording and pricing semantics. Inter must also reach native amount/input fields with the correct bold face. Current-build real offer/selection acceptance is still owed. |
| Agreement and messages | State-dependent next action, accepted terms, thread, contact and protected task address. Current-location sharing route/entries retired; server records preserved. | Exact task-location disclosure and telephone consent remain. Keyboard, long thread, reconnect and terminal-media recovery require explicit acceptance. |
| AI task and worker interview | Real owned conversation clients, review, correction, save/publication and durable recovery. Independent typed-draft ownership, safe exit from a pending worker interview and one availability scroll are implemented. | Current-build real provider, microphone and full journey acceptance remain separate. See AI table below. |
| Profile, calendar, support/settings | Native screens and corresponding galleries already exist. | Apply the shared Inter face to input controls, then verify actual focused inputs, fixed footers, large text and all loading/error states. Do not infer whole-flow completion from galleries. |
| Motion and accessibility | Shared durations, press feedback, live reduced-motion store and root gating, sheet springs, bounded map annotations, interrupted-bell reset, contextual spoken counts and no false arrival replay after filters. | Normal motion stays enabled. Verify final native transitions; improve AI answer completion announcements and stream-to-record continuity without decorative replay. |

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

1. The combined package has exact-source types/full Jest and an attested, installed APK; bounded emulator checks
   are recorded in the R7 receipt. Next acceptance: narrow/large-text search/navigation/credits, high-density
   fallback markers, real GPS branches and physical-device interaction. Batch related fixes before another APK.
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

### Reconciliation of the 24 historical R6 major entries

Read-only recheck at `3fdbe559` on 25 September. Indices are **zero-based `findings[]` indices** in
`docs/implementation/design-system/r6-sweep/FINDINGS.json`, not newly assigned bug IDs. Five are fixed in current
source, seventeen underlying mechanisms remain, and two performance patterns need profiling before their original
major severity can be accepted. These are source judgments, not 24 fresh device observations or a whole-app count.

| Index | Current evidence | Assessment / next action |
| --- | --- | --- |
| 0 | `tokens.ts:203` field and named custom inputs use `withInter` | Fixed in source; current APK typography acceptance below. |
| 1 | Worker `profil/razgovor.tsx:213` uses a non-scrolling frame and direct availability form | Fixed in source; narrow/large-text footer acceptance below. |
| 2 | `ProductDetails.tsx:226,333` fades the entire disabled footer to 0.45 | Still present; keep the label/reason readable while showing disabled state. |
| 3 | `ConversationPointAsk.tsx:132,156` uses ink-filled primary return actions | Still present; align secondary return actions with the common hierarchy. |
| 48 | `ApplicationSelectionPresentation.tsx:303–318` shows the offer without the retired capabilities block | Fixed in source before this package. |
| 49 | `PublicNeedPresentation.tsx:135` retains gendered relation-error copy | Still present; neutral Serbian copy. |
| 50 | `WorkerAiPresentation.tsx:46` prints raw rule times | Still present; use the shared civil-time format. |
| 85 | `AiConversationShell.tsx:139,238–244` does not announce completed answers | Still present; announce each new completed answer once, never history or every streamed fragment. |
| 86 | `ApplicationSelectionPresentation.tsx:69,319,325` uses role-only outcome alerts | Still present; reachable and announced selection result/recovery. |
| 87 | `dogovor/[id].tsx:416` leaves command errors at the scroll bottom | Still present; expose recovery at the action and announce the changed state. |
| 88 | `ClosurePresentation.tsx:102` changes successful closure status without announcing it | Still present; announce status transition without changing the closure program. |
| 89 | `CandidateFace.tsx:167,206` puts offer facts only in hints | Still present; essential facts must remain available when hints are disabled. |
| 90 | `IntakePresentation.tsx:186,201` has role-only safety/error feedback | Still present; announce relevant new feedback without repeating history. |
| 91 | `MyApplicationsPresentation.tsx:44,143` has role-only validation/missing-row feedback | Still present; keep a visible and announced correction path. |
| 92 | `ApplicationFace.tsx:99,203` removes the focused disclosure trigger when expanded | Still present; retain a named expanded control or deliberately transfer focus. |
| 93 | `V2Action.tsx:71,86,111` makes the initial disabled reason hint-only | Still present; reason must be available on first focus. |
| 143 | `potrebe/[id]/kandidati.tsx:142,155` replaces a Tabs route with a root Agreement | Source concern remains; reproduce actual native return stack before choosing a navigation change. |
| 144 | `AgreementCompletionReview.tsx:19` retains its custom page-sheet modal | Still present; consolidate after preserving the complete confirm/cancel contract. |
| 145 | Worker `profil/razgovor.tsx:152` can retire the view while preserving the pending journal | Fixed in source with predecessor-failing tests; actual provider/phone acceptance remains separate. |
| 146 | `dogovor/[id].tsx:173,291,416` disables primary action while recovery sits below | Still present; surface reason/loading/recovery beside the affected action. |
| 167 | Root `_layout.tsx:131` selects no transition under reduced motion | Fixed in source; live preference behavior tested. |
| 168 | `AiConversationShell.tsx:70,133,239` animates persisted turns after stream replacement | Still present; measure and avoid reintroducing an already visible answer. |
| 169 | `calendarPresentation.ts:14,54` allocates formatters repeatedly | Pattern present; no measured major lag. Profile representative native calendar data first. |
| 170 | `AgreementChat.tsx:186,254` redraws an unpaged message ScrollView with draft changes | Pattern present; profile realistic long history and keyboard latency, then bound/virtualize without breaking recovery. |

Next client priority is action/recovery visibility and return navigation, then AI response announcements and motion,
then wording/time/sheet consistency. Unprofiled performance claims are not accepted as measured defects. The older
R6 severity labels do not automatically make every wording or styling mismatch a release blocker.

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
