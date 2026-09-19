# PKG-011 — Rekoncilijacija trenutne mobilne površine, tok po tok (read-only)

Datum: 2026-09-16 (Europe/Belgrade). Grana `work/pre-v3-engine-integration-20260911`, head `97b3cb0` (PR #102, draft, mergeable). Autor: jedan glavni agent, bez subagenata (odluka vlasnika 2026-09-16). Ovaj dokument ne menja izvor, engine ni UI; on je obavezni ulaz pre prve production UI izmene u PKG-011.

## 0. Metod i autoritet

- Redosled autoriteta: stvarni izvor na grani → PR #102 → Ledger/ugovor/evidence → V19 (istorijski plan, `USKOCI_MASTER_IMPLEMENTATION_PLAN_V19.md`, `USKOCI_MASTER_CONTROL_V19.xlsx`, `USKOCI_TARGET_PRODUCT_V19.md`, workbook podaci) → product canon (`docs/product-design-truth/USKOCI_PRODUCT_CANON.md`, IA, user flows) → starije matrice. „Stara matrica kaže MISSING" nije dokaz; „ekran postoji" nije „ekran kompletan".
- Odluke vlasnika 2026-09-16 koje ovaj dokument sprovodi: (1) `USKOCI_WEB_PROTOTIP_V9` je web/sajt prototip i NIJE UI/UX autoritet za mobilnu aplikaciju — ignorisan (vidi `V9_TO_NATIVE_SCREEN_MAPPING_20260916.md`); (2) prvo korisnik i namera, zatim prirodan idealan tok i potrebne funkcije, tek onda mapiranje trenutnog koda — current code je činjenica, canon i prirodan tok su cilj; (3) ne izmišlja se novi proizvod, verifikovani engine se ne menja; dobra logika se zadržava, popravlja se prezentacija/navigacija; nelogičan tok se označava kao UX/product gap sa minimalnom predloženom korekcijom, bez samostalne izmene engine-a.
- Statusi površina (vokabular vlasnika): CURRENT_COMPLETE, CURRENT_BUT_UI_WEAK, CURRENT_BUT_BINDING_INCOMPLETE, CURRENT_BUT_RECOVERY_INCOMPLETE, LEGACY, RETIREMENT_CANDIDATE, MISSING, NEEDS_DEVICE_PROOF (kao sekundarna zastavica gde je primarni status drugi).
- Live stanje (čitanje DEV/ALPHA `leqcwgzvjsxugfgzdmth` od 2026-09-15, potvrđeno u rekoncilijaciji PKG-014): primenjena izvorna migracija 144 (`20260913065130`); nisu live 145 (self-reported identity), 146 (event-bound erasure / closure execution), 147 (QA owner activation), ni kandidati `supabase/candidates/pkg003_manual_need_fact_v2.sql` i `pkg008_media_upload_cancellation.sql`. Njihova promocija je PKG-014 (AF-D07/AF-D26). Edge inventar: `uskoci-account-closure-worker` nije u live listi (GAP-0002).
- Dokazi na koje se oslanja mapiranje: PKG-002..PKG-010 DONE_VERIFIED receipti; PKG-010 lanac od 31 V5 proof-a zelen na exact head (run 35066812081); 202 Jest suite fajla (216 suita / 4290 testova zeleno na `7403270`); 880 node testova.

## 1. Šta stvarno postoji (brojke iz izvora, ne iz matrica)

- 47 ruta u `src/app` + 2 layout-a + 1 native-intent handler = 49 površina u masteru (`CURRENT_SCREEN_BINDING_MASTER_20260916.md/.json`), plus 3 komponente bez sopstvene rute (MarketplacePresentation, AgreementChat/outbox/photos, PushRuntime).
- Status: CURRENT_COMPLETE 39 · CURRENT_BUT_UI_WEAK 5 (`/(app)/_layout`, `/potrebe`, `/fotografije-zadatka`, `/profil`, `/profil/fotografija`) · CURRENT_BUT_BINDING_INCOMPLETE 3 (`/rucni-zadatak`, `/pitanja-zadatka`, `/profil/privatnost` — sve zbog SQL-a koji nije live, ne zbog nedostajućeg client bindinga) · LEGACY 2 (`/pregled-nacrta`, `/prijave`).
- Nedostižne rute iz current izvora: `/pregled-nacrta` (stari R07 per-fact pregled; `/nova` sada vodi na `/pregled-zadatka`) i `/prijave` (penzionisani redirect za stare linkove).
- Engine i vlasnici stanja koji moraju da ostanu: `useOwnedEditor`, `useFocusedResource`, sesija/uloga/povratniCilj/accountIntentPreference/passwordRecoveryIntent store-ovi, `useAuthFormCommand`/`useAuthAvailability`, trajni dnevnici komandi pisani pre I/O (`aiTurnIntentJournal`, `workerAiTurnIntentJournal`, `applicationCommandJournal`, `qaIntentJournal`, `supportCaseJournal`, `closureIntentJournal`, agreement action/location/group dnevnici, `agreementPhotoJournal`, media upload dnevnik, safety command id, avatar intent), kontroleri `AgreementActionsController`, `AgreementLocationController`, `GroupConversationController`, `SupportController`, `LegalReviewController`, `agreementOutbox`, i svi `src/data/*ClientService` zapisivači. Svi zapisi potvrđuju uspeh isključivo canonical readback-om (UX-001), nepoznat ishod zadržava identitet komande, poznata odbijanja nose sopstvene poruke.

## 2. MENI TREBA (Naručilac)

### 2.1 Ulaz, prijava, povratak (deljeno sa JA MOGU)

- Korisnik i namera: osoba otvara aplikaciju da bi dobila pomoć ili je ponudila; ima jedan nalog i dve namere; hoće da uđe brzo, bez gubitka onoga što je krenula da radi, i da se vrati posle prekida (pozadina, restart, promena naloga).
- Prirodan tok i funkcije: prepoznatljiv ulaz (originalna kompozicija V4.9/V5, maskota, HOME) → izbor namere → prijava/registracija/oporavak → povratak na cilj koji je osoba imala (nacrt, Zadatak, Dogovor) → nikad sirova greška provajdera; jasno šta je dostupno (email, telefon, Google/Apple).
- Trenutno: `/auth` (618 L) + `EntryWelcome` + `useAuthFormCommand`/`useAuthAvailability` + `entryIntentClientService`→`povratniCilj`; `/oporavak` + `+native-intent` + `passwordRecoveryIntent`; RootLayout sa `Stack.Protected`, konzumacija završene namere jednom, ključevanje po nalogu (A→B→A). Sve komande idu kroz Supabase Auth; sigurne poruke za 429/5xx/pogrešne podatke; Google/Apple prikazani kao „trenutno nije dostupno" (OAuth klijent nije spreman); registracija bez sesije vodi na „Proverite email".
- Gapovi: nema product gapa u toku; ostaje device dokaz (PKG-017: restore, A→B→A, hladni start), launcher ikonica (GAP-0041, PKG-016). Prezentacija je owner-locked (V5 entry/HOME/maskota) — PKG-011 je ne dira osim defekata pristupačnosti.
- Status: CURRENT_COMPLETE (`/auth`, `/oporavak`, `/`, `/+native-intent`, root layout).

### 2.2 Novi zadatak: razgovor ili ručni unos → pregled → objava

- Korisnik i namera: naručiocu treba pomoć; želi da opiše šta mu treba svojim rečima (glasom ili tekstom), da mu aplikacija složi zadatak, da proveri šta će drugi videti, doda mesto i fotografije, i tek onda svesno objavi. Ako AI nije dostupan ili ne želi AI, isti zadatak mora da unese ručno, bez drugog puta.
- Prirodan tok i funkcije: jedan ulaz „Novi zadatak" → razgovor (tekst/glas, ispravke, otkazivanje slanja, napuštanje) ili ručni obrazac (isti V2 nacrt) → mesto (bezbedna geografija, privatna adresa) → fotografije → jedan zajednički pregled (javno/privatno, rok za prijave, uslov identiteta) → eksplicitna objava → čitanje ishoda (objavljeno / potrebna dopuna / pregled) → otvaranje Zadatka.
- Trenutno: `/novi-zadatak` (izbor puta) → `/nova` (OwnedIntake + `aiTurnIntentJournal` + `useOwnedEditor` + `useHoldToTalk`; `aiNeedV2Production`: open/recover/load/send(stream)/cancel/abandon; Edge `uskoci-ai-interview`) ili `/rucni-zadatak` (15 polja, `manualNeedFactClientService.save` → `rpc_set_manual_need_fact_v2`) → `/mesto-zadatka` / inline `NeedLocationForm` → `/fotografije-zadatka` (`mediaClientService` + Edge `uskoci-media` + Storage `profile-media`) → `/pregled-zadatka` (`aiTaskReviewClientService` prepare/acceptAndPublish/resume; Edge `uskoci-publication-evaluate`; readback objavljenog Zadatka) → `/potrebe/[id]/pregled`. Sve nepotvrđene komande zadržavaju ključ i nude „Proveri ishod".
- Gapovi: (a) binding-live: `rpc_set_manual_need_fact_v2` je samo kandidat (PKG-003 dokazan u disposable bazi) → na privatnom APK-u svako ručno čuvanje polja pada do PKG-014; (b) otkazivanje nepotvrđenog slanja fotografije zavisi od kandidata PKG-008 (isto PKG-014); (c) UX: ručni unos je 15 vertikalnih polja bez grupisanja i koraka; fotografije su „settings lista" bez mreže/pregleda; pregled zadatka je gust sa mnogo tihih akcija; (d) `/pregled-nacrta` (stari per-fact pregled) nema više ulaz — legacy, povlačenje tek posle pariteta (`confirmFact`/`saveDraft`/`confirmEdit` sada žive u `/pregled-zadatka`/`/nova` toku; proveriti da ništa ne koristi `saveDraft` put pre brisanja); (e) provider/glas/mapa ostaju device dokazi (PKG-019).
- Status: `/nova`, `/novi-zadatak`, `/mesto-zadatka`, `/pregled-zadatka` CURRENT_COMPLETE (UI rework kandidati); `/rucni-zadatak` CURRENT_BUT_BINDING_INCOMPLETE; `/fotografije-zadatka` CURRENT_BUT_UI_WEAK; `/pregled-nacrta` LEGACY.

### 2.3 Moji zadaci i detalj mog zadatka

- Korisnik i namera: naručilac hoće da vidi svoje zadatke po stanju (aktivni, nacrti, istorija), otvori jedan, izmeni ga, otkaže, zatvori preostalu potragu, ode na kandidate ili pitanja.
- Prirodan tok i funkcije: lista sa jasnim stanjima i onim što traži moju radnju → detalj sa jednom dominantnom radnjom po stanju (nacrt: pregledaj/objavi; objavljen: kandidati; popunjen: Dogovori) → izmene idu kroz isti pregled pre ponovne objave.
- Trenutno: `/potrebe` (`useFocusedResource(izvor.mojePotrebe)`, MarketplacePresentation owned mode, sekcije, „Treba moja radnja") → `/potrebe/[id]/pregled` (OwnedNeed, `ru4Production` remaining search close sa zadržanim ključem, `openEditConversation` sa proverom revizije, `NeedLifecycleActions` PKG-004) → `/potrebe/[id]/kandidati`, `/pitanja-zadatka`.
- Gapovi: canon kaže da je Zadaci ulaz naručioca i za otkrivanje (Lista/Mapa) i za svoje Zadatke; trenutno „Zadaci" tab pokazuje samo svoje, a otkrivanje je preko „Istraži" (→ skrivena `/prilike`) ili centralnog taba Mapa → UX/product gap (OWNER_DECISION: centralna zona). Detalj je funkcionalno kompletan, vizuelno V2 tokeni.
- Status: `/potrebe` CURRENT_BUT_UI_WEAK (canon odstupanje + UI); `/potrebe/[id]/pregled` CURRENT_COMPLETE.

### 2.4 Pitanja o zadatku (Q&A pre Dogovora)

- Korisnik i namera: uskočer pita pre prijave; naručilac odgovara javno, ignoriše ili prijavljuje pitanje; oboje hoće da znaju da li je poruka poslata/objavljena.
- Prirodan tok: pitanje/odgovor sa jasnim limitima → klasifikacija (AI) → objava ili razlog odbijanja → nepoznat ishod se proverava istim zahtevom.
- Trenutno: `TaskQaScreen` (qaIntentJournal sa hash-om teksta; recovery/context/submit/cancel/disposition; Edge `uskoci-qa-classify`) iz `/potrebe/[id]/pregled` i `/prilike/[id]`.
- Gapovi: live — aktivacija QA politike (migracija 147) nije primenjena → server odbija sa „policy not ready"; UI je settings lista, ne nit razgovora; provider dokaz otvoren.
- Status: CURRENT_BUT_BINDING_INCOMPLETE (live), UI slab.

### 2.5 Kandidati i izbor

- Korisnik i namera: naručilac hoće da uporedi prijave, otvori ponudu, vidi profil i reputaciju, izabere jednog ili više (mesta) i odmah dođe u Dogovor.
- Prirodan tok: lista kandidata sa poređenjem (cena, ljudi, termin, reputacija) → otvaranje ponude (označi viđeno) → izbor sa potvrdom → Dogovor.
- Trenutno: `/potrebe/[id]/kandidati` (session sa zamrznutom IzborKomandom, viewed map, STALE_REVIEW_REQUIRED, `rpc_select_response` P0D-02/03, `readSelectedAgreement`) → `/dogovor/[id]`.
- Gapovi: TARG-034 „Poređenje kandidata" ne postoji kao prikaz (lista + pojedinačna ponuda) → MISSING prezentacija (bez engine izmene: podaci postoje u projekciji); javni profil se čita, ali nema zasebnu površinu javnog profila (TARG-050) → product/UX gap za odluku.
- Status: CURRENT_COMPLETE (binding), prezentacija: rework + nedostajući prikaz poređenja.

### 2.6 Dogovor: pregled, poruke, kontakt, izmene, lokacija, problem, završetak, ocena

- Korisnik i namera: obe strane hoće jedno mesto gde vide uslove, ljude, poruke, kontakt (deljenje broja), mesto, tok događaja; da predlože/prihvate izmene ili otkažu; da označe/potvrde završetak; da prijave problem; da ocene saradnju.
- Prirodan tok: detalj sa jasnim stanjem i jednom dominantnom radnjom (poruke ili završetak) → grupisane sekundarne radnje (izmene/otkazivanje, lokacija, bezbednost, kontakt) → poruke sa fotografijama i sigurnim ponovnim slanjem → završetak samo kad server dozvoli → ocena posle završetka.
- Trenutno: `/dogovori` (kolekcija, sekcije, retire u pozadini) → `/dogovor/[id]` (workspace `useOwnedEditor`, `useFocusedResource` poruke, `useAgreementOutbox` + `useAgreementPhotos`, server `radnje` actionState PKG-007, problem report sa zadržanim opisom, kontakt grant) → `/dogovor/[id]/izmene` (AgreementActionsController, dnevnik sa hash-om, poznata odbijanja) → `/dogovor/[id]/lokacija` (jedna dobrovoljna tačka) → `/dogovor/[id]/grupa` (grupni razgovor kad ima ≥2 učesnika) → `/oceni-dogovor` (ocena i oznake, nepromenljiva) → `/bezbednost`.
- Gapovi: nema binding gapa; UI: dug jednostubni scroll sa mnogo tihih akcija, chat osnovan; izmene tekstualne; grupni razgovor osnovan. Device dokazi (chat/foto/GPS/MapLibre) ostaju u PKG-019/021.
- Status: sve CURRENT_COMPLETE (UI rework kandidati).

## 3. JA MOGU (Uskočer)

### 3.1 Radni profil (ručno ili razgovorom), područje, kapacitet, dostupnost, raspored

- Korisnik i namera: uskočer hoće da brzo napravi upotrebljiv profil (šta zna, gde radi, koliko ljudi, kad je slobodan), da ga aktivira i posle menja, i da vidi svoje potvrđene termine.
- Prirodan tok: vođena aktivacija sa jednom dominantnom sledećom radnjom → područje rada (bez kućne adrese) → kapacitet → dostupnost → aktivacija sa potvrdom; opciono AI razgovor koji predlaže profil, a čovek prihvata; raspored prikazuje samo potvrđene termine.
- Trenutno: `/profil/radnik` (pending Attempt sa readback-om, dinamički primarni CTA po stanju, `azurirajRadnikProfil` 4-operacije), `/profil/lokacija` (CAS revizija, WorkerAreaSearch → Edge `uskoci-location-search`, ResolvedPinMap), `/profil/dostupnost` (AvailabilityForm, CAS), `/raspored` (kalendar W02 + Dogovori), `/profil/razgovor` (workerAiTurnIntentJournal, prepare/patch/save/abandon, glas).
- Gapovi: nema binding gapa; GAP-0027 (dominantan CTA kod prvog profila) je adresiran dinamičkim primarnim CTA-om — potvrditi device dokazom; GAP-0028 (raspored obećava obe namere) adresiran copy-jem „Ovo je raspored za JA MOGU" — canon: profil i dostupnost preko avatara ✓. UI: rework kandidati (progresivna aktivacija, kalendar rail).
- Status: CURRENT_COMPLETE.

### 3.2 Prilike: lista i mapa, detalj, prijava, moje prijave

- Korisnik i namera: uskočer traži zadatke blizu sebe ili na daljinu, filtrira, otvara detalj, pita, prijavljuje se sa cenom/ljudima/terminom, prati prijave, menja ili povlači ponudu, ulazi u Dogovor kad je izabran.
- Prirodan tok: otkrivanje Lista↔Mapa sa istim skupom i filterima → detalj (bezbedna lokacija, cena/ponude, uslovi, pitanja) → prijava jednim slanjem koje preživi prekid → „Moje prijave" sa stanjima i radnjama (zadrži/ažuriraj/povuci kad se zadatak promeni) → Dogovor.
- Trenutno: `/prilike` (+ `/mapa` tab isti component, `izvor.otvorenePrilike`), `/prilike/[id]` (bounded read, keš pri osvežavanju, rok za prijave), `/prilike/[id]/prijava` (applicationCommandJournal PKG-006, `rpc_submit_response`), `/moje-prijave` (withdraw/resolve sa observed() rekoncilijacijom, RU4).
- Gapovi: canon centralna zona „U / Zadaci" za uskočera je sada tab „Mapa" (lista skrivena) → OWNER_DECISION; dugme „+" za novi zadatak vidljivo uskočeru tiho menja nameru → UX pregled (minimalna korekcija: eksplicitna potvrda promene namere ili sakrivanje u JA MOGU); GAP-0030 (zatvorena preostala potraga i dalje nudi prijavu) — proveriti da `primaNovePrijave` server signal pokriva; prezentacija V2 tokeni.
- Status: CURRENT_COMPLETE sa UI rework i canon zastavicama.

## 4. SHARED (oba)

### 4.1 Profil i promena namere
- Korisnik: hoće da vidi ko je, kakvu reputaciju ima, promeni nameru, dođe do svih podešavanja, odjavi se. Trenutno `/profil` (settings lista, `ownProfileClientService`, `AccountReputation`, `signOutLocal` sa opozivom push-a), `/profil/podaci` (ime za prikaz, CAS), `/profil/fotografija` (avatar intent UPLOAD/APPLY/CLEAR/DISCARD). Gap: javni profil drugog korisnika (TARG-050) nema površinu; vizuelno settings lista. Status: `/profil` i `/profil/fotografija` CURRENT_BUT_UI_WEAK, `/profil/podaci` CURRENT_COMPLETE.

### 4.2 Obaveštenja i push
- Korisnik: hoće da vidi šta se promenilo, uđe direktno u Zadatak/Dogovor/Prijave, podesi kategorije, tihe sate, push po ulozi. Trenutno `/obavestenja` (inbox model, filteri po nameri, otvori → cilj + promena namere, pročitaj sve), `/profil/obavestenja` (PushPreferences: kategorije, tihi sati, HITNO, push po ulozi, stanje servera), `PushRuntime` (samo javna kopija, tap → inbox, rotacija tokena). Gap: GAP-0034 (kategorije/tihi sati) je već implementiran u current izvoru — stara matrica zastarela; device/transport dokaz ostaje (GAP-0009, PKG-020). Status: CURRENT_COMPLETE.

### 4.3 Bezbednost i blokiranje
- Korisnik: hoće da blokira/odblokira i privatno prijavi drugu osobu iz Dogovora ili liste; podrška vidi prijavu, druga strana ne. Trenutno `/bezbednost` (blok CAS + privatna prijava sa zadržanim ključem), `/profil/blokirani`. Status: CURRENT_COMPLETE (UI rework kandidat).

### 4.4 Podrška
- Korisnik: hoće privatno da opiše problem (sa kontekstom Zadatka/Dogovora/poruke), prati odgovore, dopuni, traži ponovni pregled; operater obrađuje. Trenutno `/podrska`, `/podrska/novi`, `/podrska/[id]`, `/podrska/operator` (SupportController; `rpc_support_submit_v5` 143 live). Status: CURRENT_COMPLETE (UI rework kandidat).

### 4.5 Izvoz podataka
- Korisnik: hoće kopiju svojih podataka na uređaju. Trenutno `/profil/izvoz` (zahtev → priprema → preuzimanje sa proverom heša → čuvanje fajla; opoziv/otkaz). Status: CURRENT_COMPLETE (device dokaz za čuvanje fajla).

### 4.6 Privatnost, rokovi čuvanja, zatvaranje naloga
- Korisnik: hoće da zna šta je javno/privatno, rokove čuvanja, i da zatvori nalog sa jasnim posledicama. Trenutno `/profil/privatnost` + `ClosureDialog` (prepare → review → start → CLOSED; closureIntentJournal). Gap: `rpc_review/start_account_closure_execution` (146) i closure worker nisu live → klijent namerno prikazuje „nije spremno" (PKG-014). Status: CURRENT_BUT_BINDING_INCOMPLETE (live).

### 4.7 Pravni dokumenti i obrađivači
- Trenutno `/profil/pravna` (LegalReviewController, prihvatanje pregledanih dokumenata po hash-u, mapa obrađivača). Status: CURRENT_COMPLETE.

### 4.8 Runtime stanja
- AppState pozadina/povratak i promena naloga su sistemski pokriveni (ključevanje po nalogu/reviziji/nameri, retire privatnih redova u pozadini, resume čitanja). Offline nema zaseban detektor: mrežni neuspeh → generična poruka „Proverite vezu" + eksplicitno ponovno čitanje (UX-002/003 zadovoljeno kopijom, ne stanjem).

## 5. Zbirni odgovori (redosled koji je vlasnik tražio)

**Šta stvarno postoji:** 47 ruta + 2 layout-a + native-intent; svih 74 V19 funkcija ima površinu ili radnju u current izvoru osim TARG-034 (poređenje kandidata kao prikaz) i TARG-050 (javni profil kao zasebna površina); nema ekrana čiji backend ne postoji u izvoru; svi zapisivači su canonical servisi sa readback-om.

**Funkcionalno kompletno, vizuelno slabo (presentation-only rework):** `/potrebe`, `/prilike`+`/mapa`, `/prilike/[id]`, `/prilike/[id]/prijava`, `/moje-prijave`, `/potrebe/[id]/pregled`, `/potrebe/[id]/kandidati`, `/nova`, `/novi-zadatak`, `/pregled-zadatka`, `/mesto-zadatka`, `/dogovori`, `/dogovor/[id]` (+ chat), `/dogovor/[id]/izmene`, `/dogovor/[id]/grupa`, `/oceni-dogovor`, `/profil`, `/profil/fotografija`, `/profil/radnik`, `/profil/razgovor`, `/raspored`, `/bezbednost`, `/podrska/*`, `/obavestenja`, `/fotografije-zadatka` (uz PKG-014 za otkazivanje), `/pitanja-zadatka` (uz 147). Prezentacija je uglavnom već odvojena (`ui/v2/*Presentation`, `ui/settings/*`, kontroleri), pa se može menjati bez dodira u vlasnike stanja.

**Binding gap (client binding postoji, server nije live):** `/rucni-zadatak` (kandidat PKG-003), `/fotografije-zadatka` otkazivanje (kandidat PKG-008), `/profil/privatnost` zatvaranje (146 + Edge worker), `/pitanja-zadatka` (147 aktivacija politike), `/pregled-zadatka` uslov identiteta (145). Ništa od toga se ne rešava u PKG-011; rešava PKG-014 promocija.

**Legacy:** `/pregled-nacrta` (nedostižan, RETIREMENT_CANDIDATE posle pariteta i odobrenja), `/prijave` (redirect za stare linkove), adapteri `aiCommandOverrides`/`aiProductionOverrides`/`productionAuthorityOverrides` (V19 REPL-093/015 — brisanje tek posle dokaza potrošača/ACL), `supabaseIzvor` kao baseline čitač (REPL-018/039), Google/Apple placeholder metode na `/auth`.

**V9:** nije primenljivo (web prototip, isključen odlukom vlasnika).

**Konflikti sa product canon-om / odluke vlasnika (OWNER_DECISION_REQUIRED):**
1. Centralna zona: canon `U / Novi` (naručilac) i `U / Zadaci` (uskočer) vs. trenutni zajednički tab „Mapa"; i otkrivanje Lista/Mapa unutar „Zadaci" za naručioca (sada preko „Istraži"). Minimalna korekcija: preimenovanje/preusmerenje centralne zone po nameri bez promene engine-a (isti `MarketplacePresentation`, isti čitači).
2. Implicitna promena namere na dugmadima „+"/„Moji" u `/prilike` za uskočera i pri otvaranju stavke inbox-a. Minimalna korekcija: vidljiva potvrda promene namere ili prikaz samo u odgovarajućoj nameri.
3. Poređenje kandidata (TARG-034) i javni profil (TARG-050) kao nove prezentacije nad postojećim čitačima — treba odluka da li ulaze u PKG-011 obim.
4. Permissions primer (canon S05) ne postoji; dozvole se traže u kontekstu (kamera, GPS, push) — potvrditi da je to prihvaćeno ponašanje.
5. Povlačenje `/pregled-nacrta` i placeholder Google/Apple metoda.

## 6. Sledeći korak

Plan zamene UI, liste H/I/J i dependency-safe redosled su u `PKG011_UI_REPLACEMENT_PLAN_20260916.md`. Do odluke vlasnika po tačkama 1–5 nema production UI izmena.
