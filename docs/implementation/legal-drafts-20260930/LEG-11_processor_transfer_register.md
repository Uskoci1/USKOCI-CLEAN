# LEG-11 · Registar obrađivača i prenosa podataka

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-11 (master plan, poglavlje 16.2) |
| Status | DRAFT-FROM-CODE (ugovori, regioni i pravni mehanizmi prenosa: DATA-PENDING-OWNER) |
| Izvor koda | repozitorijum `Uskoci1/USKOCI-CLEAN`, grana `work/uskoci-ui-unification-20260924`, commit `fc58f411598338c8589f5f177626a2790c92fb13`, pročitano 2026-09-30 samo za čitanje |
| Vezani nacrti | LEG-09 (registar obrade), LEG-10 (čuvanje i brisanje), LEG-12 (obaveštenja), LEG-04 (politika privatnosti) |

**OSVEŽENO 2026-10-02 (EX-07, slice S04):** registar je dopunjen stanjem razvojne baze od 2026-10-02 (odeljak 7: glasovne poruke Voice B1, komentar uz ocenu D12 i lični prikazi lista EX-04 ne uvode novog obrađivača; tri privatna kofera). **Upozorenja ovog registra (odstupanje u R-02 i neusklađenosti iz odeljka 4) ZADRŽANA su do završnog prolaza privatnosti** (AGENTS.md 4.5). Raniji tekst je zadržan; zamenjeni delovi su označeni „SUPERSEDED 2026-10-02”.


## 0. Kako se čita ovaj registar

Sve navedeno u koloni „Šta kod stvarno radi” potiče iz koda ili dokumenata repozitorijuma, sa putanjom i (gde je proverena) linijom. Ništa nije preuzeto „po sećanju”. Gde repozitorijum ne fiksira činjenicu (pravno lice davaoca, ugovor o obradi, region, rok čuvanja kod davaoca, pravni mehanizam prenosa), stoji jedna od tri oznake:

- `[[OPERATER: ...]]` - podatak koji daje operater USKOČI-ja;
- `[[ODLUKA VLASNIKA: ...]]` - odluka koju kod i dokumenti ne donose;
- `[[PROVERITI: ...]]` - činjenica koju treba potvrditi iz ugovora davaoca, konzole, izdanja ili pravnog pregleda.

Uloga davaoca (obrađivač, podobrađivač, samostalni rukovalac) je **predlog za pravni pregled**, ne zaključak. Aplikacija već ima tri vrednosti uloge za javnu mapu obrade (`PROCESSOR`, `SUBPROCESSOR`, `INDEPENDENT_CONTROLLER`, `src/ui/legal/LegalDocuments.tsx:18`, `src/contracts/processorMap.ts`).

**Ograničenje izvora.** Dokument `USKOCI_DATA_FLOW_TRUTH_2026-09-27.md` (290 linija) koji navodi master plan (poglavlje 23, L03) **nije pronađen** u repozitorijumu ni na proverenim lokalnim putanjama (Desktop, Downloads). Ovaj registar je zato izveden neposredno iz koda i iz `docs/implementation/v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md`. Kada se dostavi taj dokument, treba uporediti tabelu 1.

## 1. Pregled: ko šta prima

Kolona „Uključeno” navodi uslov pod kojim kod uopšte šalje podatke. Vrednosti serverskih prekidača u živom okruženju nisu ovde proveravane.

| # | Primalac | Predložena uloga | Šta prima | Ko šalje | Uključeno kada |
|---|---|---|---|---|---|
| R-01 | Supabase (platforma: baza, Auth, Storage, Edge funkcije) | obrađivač | svi podaci naloga i aplikacije (vidi LEG-09) | uređaj i Edge funkcije | uvek (jedini backend) |
| R-02 | Google (Gemini API, `generativelanguage.googleapis.com`) - tekstualni AI | obrađivač (uz plaćene uslove) | tekst razgovora, činjenice zadatka, javna polja zadatka, do 6 fotografija zadatka | Edge funkcije | `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`, `USKOCI_GEMINI_PAID_TEST_ENABLED=true` (+ posebni prekidači niže) |
| R-03 | Google (Gemini Live, isti domen, WebSocket) - govor u tekst | obrađivač (uz plaćene uslove) | prolazni zvuk (PCM 16 kHz) dok se drži mikrofon | Edge funkcija `uskoci-speech-session` | `USKOCI_GEMINI_PAID_TEST_ENABLED=true` i `USKOCI_SPEECH_CONTROLLED_TEST_ENABLED=true` |
| R-04 | Expo Push Service (`exp.host`) | obrađivač | Expo push token uređaja, fiksni opšti tekst obaveštenja, tip događaja | Edge funkcija `uskoci-push-transport` | `EXPO_PUSH_TRANSPORT_ENABLED=true` |
| R-05 | Google FCM (Android) / Apple APNs (iOS) | podobrađivač Expo-a (predlog) | push token i isti opšti tekst | Expo | posle R-04; FCM u izdanju traži Firebase konfiguraciju paketa |
| R-06 | LocationIQ (`eu1.locationiq.com`) | obrađivač | unet tekst adrese ili tačne koordinate (obrnuto), šifra države | Edge funkcija `uskoci-location-search` | pri pretrazi adrese i pri obrnutom pretraživanju; traži `LOCATIONIQ_ACCESS_TOKEN` |
| R-07 | OpenFreeMap (`tiles.openfreemap.org`) | samostalna javna usluga (predlog) | IP adresa uređaja i tražene pločice mape (posredno prikazano područje) | uređaj direktno | pri svakom prikazu mape |
| R-08 | Provajder email poruka za Auth (potvrda, oporavak) | obrađivač | email adresa, tekst poruke | Supabase Auth | pri registraciji i oporavku lozinke; pošiljalac nije određen u repozitorijumu |

Nisu obrađivači podataka korisnika (vidi odeljak 3): EAS Build, GitHub/GitHub Actions, Apple i Google prodavnice, spoljna navigacija (Google mape kao veza koju korisnik sam otvara).

## 2. Detaljni unosi

### R-01 · Supabase

| Stavka | Sadržaj |
|---|---|
| Funkcija | Baza podataka (PostgreSQL), autentifikacija (Auth), privatni Storage (`profile-media`, `data-export-artifacts`), Edge funkcije (11 funkcija: `uskoci-ai-interview`, `uskoci-worker-interview`, `uskoci-qa-classify`, `uskoci-publication-evaluate`, `uskoci-speech-session`, `uskoci-location-search`, `uskoci-media`, `uskoci-push-transport`, `uskoci-data-export-worker`, `uskoci-data-export-download`, `uskoci-account-closure-worker`) |
| Podaci | Sve kategorije iz LEG-09. Sesija klijenta je u lokalnom skladištu uređaja (`AsyncStorage`, `src/data/supabaseClient.ts:23-29`). |
| Region | Razvojni/probni projekat `leqcwgzvjsxugfgzdmth` je prijavljen kao Frankfurt (eu-central-1): `docs/implementation/product-v1-closure-20260926/finalization-20260927/ROUND_01.md` (metapodaci konektora, 2026-09-27) i `docs/implementation/v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md`. Produkcioni projekat **ne postoji** (master plan 17.1). `[[ODLUKA VLASNIKA: produkcioni projekat i region]]` `[[PROVERITI: region iz Supabase konzole za projekat koji će služiti izdanju]]` |
| Ugovor o obradi | `[[PROVERITI: Supabase DPA - da li je prihvaćen, u ime kog pravnog lica, na kom planu]]` |
| Čuvanje kod davaoca | Rezervne kopije baze i Storage-a, kao i platformski dnevnici zahteva nisu opisani u repozitorijumu. `[[PROVERITI: plan, PITR/backup retencija, retencija dnevnika]]` |
| Kontrole u kodu | Edge funkcije ne upisuju sadržaj adresa, tokena ni odgovora davaoca u dnevnike (komentari u `uskoci-location-search/index.ts:235-237`, `uskoci-push-transport/index.ts:4-5`); ovo nije dokaz o dnevnicima na nivou platforme. |
| Otvoreno | Na razvojnom okruženju spisak obrađivača u bazi (`private.processor_provider_inventory`) je zastareo, vidi odeljak 4. |


> **OSVEŽENO 2026-10-02:** red „Funkcija” unosa R-01 navodi dva privatna kofera (`profile-media`, `data-export-artifacts`); živo stanje ima **tri** (`agreement-voice` je dodat primenom Voice B1). Vidi odeljak 7.1. Ostalo u R-01 nije menjano.

### R-02 · Google Gemini API - tekstualni AI (četiri Edge funkcije)

Model koji kod prihvata je samo `gemini-3.8-flash`; funkcije odbijaju rad bez tačno tog modela, `AI_PROVIDER=gemini` i `USKOCI_GEMINI_PAID_TEST_ENABLED=true` (`uskoci-ai-interview/index.ts:757-769`, `uskoci-worker-interview/index.ts:143`, `uskoci-qa-classify/index.ts:191-192`). Ključ davaoca je samo u serverskom okruženju (`uskoci-ai-interview/index.ts:2-4`).

| Funkcija | Šta se šalje davaocu | Izvor |
|---|---|---|
| `uskoci-ai-interview` (razgovor za zadatak) | Sistemska uputstva sa serverskim vremenom (Europe/Belgrade); do 30 poslednjih poruka razgovora, svaka skraćena na 4.000 znakova; trenutna poruka (do 4.000 znakova); sve aktuelne (nezamenjene) činjenice razgovora osim `need.resolved_location` | `uskoci-ai-interview/index.ts:519-529`; `supabase/migrations/20260910172132_clean_w03_owned_ai_intake_authority.sql:66-99` |
| `uskoci-worker-interview` (razgovor za radni profil) | Do 30 poslednjih poruka i kandidat profila: prikazno ime, opis, veštine, alat, vozila, dozvole (samoprijavljene), kapacitet tima, država/grad/radijus, pravila dostupnosti | `uskoci-worker-interview/index.ts:136-148`; šema `workerProviderSchema` u istom fajlu |
| `uskoci-qa-classify` (provera javnog pitanja/odgovora pre izbora; traži i `USKOCI_QA_CLASSIFIER_ENABLED=true`) | Javna polja zadatka (naslov, opis, kategorija, termin, broj mesta, cena, zahtevi, približna oblast) + tekst pitanja (do 500) ili odgovora (do 1.000 znakova) + pravila politike; bez ID-eva naloga, privatnih polja, tačnih lokacija i fotografija (komentar u kodu) | `uskoci-qa-classify/index.ts:93-131` (funkcije `publicTask`, `providerContext`), `:191-192` |
| `uskoci-publication-evaluate` (provera zadatka pre objave) | Ista javna polja zadatka + broj fotografija; **do 6 obrađenih fotografija zadatka** (base64 JPEG, zbir do 12 MB) samo kada je uključen `USKOCI_GEMINI_IMAGE_REVIEW_ENABLED=true` | `uskoci-publication-evaluate/index.ts:137-166, 282, 362-365` |

Odstupanje koje treba uneti u javne tekstove (vidi LEG-12, LEG-04): u kontekst razgovora za zadatak ulazi svaka aktuelna činjenica iz registra osim `need.resolved_location`. Činjenice `need.exact_address` i `need.access_notes` su privatne, ali **nisu** ograničene na ručni unos (`src/contracts/needFactsV2.ts:42-43`): AI ih može predložiti iz teksta, a **standardni korak „Mesto zadatka” ih sam upisuje kao potvrđene činjenice razgovora** (izvor `EXPLICIT_USER_ANSWER`, obim `NEED_DRAFT`; `supabase/migrations/20260910121926_clean_w02_regional_country_authority.sql:192-209`; ključevi koraka u `src/app/(app)/pregled-zadatka.tsx:526`). Posle toga svaka sledeća AI poruka u istom razgovoru nosi i tačnu adresu i napomene za pristup Google-u. Grana `work/legal-privacy-ai-context-minimization-20260927` (`d18e830a`) to menja, ali **nije integrisana** (`docs/implementation/product-v1-closure-20260926/finalization-20260927/BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md`, odluka vlasnika 2026-09-28 o odlaganju). Ni ta grana ne filtrira tekst koji korisnik ukuca u trenutnoj poruci.

| Stavka | Sadržaj |
|---|---|
| Podaci o korisniku koji ne idu davaocu | Nalog, email, telefon, push token, poruke Dogovora, ocene, potvrđene tačke (objekat `need.resolved_location` je izuzet iz konteksta). **Privatna adresa i napomene za pristup nisu izuzete**: idu kao činjenice razgovora (vidi iznad). |
| Region i prenos | U aplikaciji već stoji odobreno obaveštenje: „Obrada može biti van Evrope i uključuje privremene bezbednosne zapise kod Google-a” (`src/ui/objava/TaskPhotosPresentation.tsx:86`) i „Google može privremeno obrađivati podatke globalno radi bezbednosti plaćenog servisa” (`src/features/voice/useHoldToTalk.ts:17`). Odluka o prihvatanju plaćenog Google okvira: `docs/implementation/v5-ai-first/OPEN_INPUTS.md`. **Ne tvrditi „samo EU” niti „bez zadržavanja kod davaoca”.** `[[PROVERITI: Gemini API uslovi za plaćene usluge - upotreba za unapređenje modela, rok čuvanja bezbednosnih zapisa, regioni obrade]]` |
| Pravno lice davaoca | `[[PROVERITI: koje pravno lice je ugovorna strana za Gemini API prema nalogu koji je vlasnik otvorio]]` |
| Ugovor | `[[PROVERITI: prihvaćeni uslovi i nalog za naplatu; ko je ugovorna strana (operater ili vlasnik lično)]]` |
| Zaštite u kodu | Model je fiksiran u kodu; izlaz je strukturisan JSON koji se strogo dekodira, a AI izlaz je samo predlog činjenica (u kodu ne postoji put kojim AI potvrđuje Dogovor ili otkriva privatnu adresu, `uskoci-ai-interview/index.ts:465-505`); interna kvota rezervacija po pozivu (`_shared/aiTestBudget.ts`; „interni zajednički limit od $5” u `docs/implementation/v5-ai-first/OPEN_INPUTS.md` je test-kontrola operatera, ne korisnička naknada). |

### R-03 · Google Gemini Live - govor u tekst

| Stavka | Sadržaj |
|---|---|
| Tok | Ugrađeni Android modul `UskociVoice` hvata PCM 16 kHz mono dok korisnik drži mikrofon („Foreground-only transient PCM; never creates an audio file or starts a service”, `modules/uskoci-voice/android/src/main/java/expo/modules/uskocivoice/UskociVoiceModule.kt:16`), šalje ga preko WebSocket-a funkciji `uskoci-speech-session`, koja ga prosleđuje Google-u (`wss://generativelanguage.googleapis.com/ws/...BidiGenerateContent`, `uskoci-speech-session/index.ts:80`) uz model `gemini-3.5-transcribe-live`, izlaz samo TEKST, verbatim transkripcija, jezik `sr-RS` (`proxy.ts:52-56`, `src/features/voice/speechProtocol.ts:3`). |
| Ograničenja | Najviše 120 s snimanja i 3.840.000 bajtova; transkript do 4.000 znakova (`speechProtocol.ts:4-5`). Dozvoljena samo za otvoren razgovor tipa `NEED_INTAKE` ili `PROFILE` istog naloga (`uskoci-speech-session/index.ts:61-65`). |
| Zadržavanje kod nas | Audio ostaje u ograničenoj memoriji funkcije; „Do not retain audio in session state, storage or logs” (`proxy.ts:9, 155`). Konačan tekst je deo razgovora u bazi (odluka AF-D02, `docs/implementation/v5-ai-first/RETENTION_ACTIVATION_GAPS.md`). |
| Platforma | Samo Android (`requireOptionalNativeModule('UskociVoice')`, `src/features/voice/nativeSpeechAdapter.ts:21`); iOS modul ne postoji (`modules/uskoci-voice/expo-module.config.json`). |
| Region, ugovor, čuvanje kod Google-a | isto kao R-02; dodatno `[[PROVERITI: da li zvuk kod davaoca ostaje u bezbednosnim zapisima i koliko dugo]]`. |
| Otvoreno | Govorne poruke između korisnika u Dogovoru **nisu isporučene** (`docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md`, status „VOICE UNSHIPPED”); ovaj unos ih ne pokriva. |


> **SUPERSEDED 2026-10-02 by odeljak 7.1 (red „Glasovne poruke”):** red „Otvoreno” unosa R-03 tvrdi da govorne poruke između korisnika u Dogovoru nisu isporučene (status „VOICE UNSHIPPED”). Serverski paket Voice B1 je primenjen na razvojnu bazu 2026-10-01 (ledger 215); klijent nije potvrđen kao isporučen (zastavica isključena u priznanici). Glasovne poruke **nisu** deo R-03: ne idu Google-u nego se čuvaju samo u R-01.

### R-04 / R-05 · Expo Push Service, FCM, APNs

| Stavka | Sadržaj |
|---|---|
| Šta se šalje | Za svaku isporuku: Expo push token, naslov i tekst iz fiksne tabele bez korisničkog sadržaja (`_shared/pushNotificationCopy.mjs:1-2`, npr. „Nova poruka u Dogovoru / Imaš novu poruku.”), `data` = `{kind:'INBOX'}` (uz tačan ID događaja poruke samo kada je `EXPO_PUSH_MESSAGE_TARGET_ENABLED=true`), kanal `default`, prioritet, `ttl: 0` (`uskoci-push-transport/index.ts:129-134`). Potvrde isporuke se čitaju sa `getReceipts` (`:142`). |
| Uključenje | `EXPO_PUSH_TRANSPORT_ENABLED=true`; bez toga funkcija vraća `DISABLED` bez ikakvog spoljnog poziva (`:73, 85`). Stanje prekidača u živom okruženju ovde nije čitano: zapisi su `DISABLED` (PKG-030, 2026-09-21) pa jedno ograničeno slanje radi dokaza (`docs/implementation/release-hardening-20260926/PUSH_REAL_DEVICE_EVIDENCE.md`); prekidač tačnog cilja poruke (`EXPO_PUSH_MESSAGE_TARGET_ENABLED`) je prema poslednjem zapisu ISKLJUČEN (`BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md`). `[[PROVERITI: aktuelno stanje oba prekidača pre izdanja]]` |
| Registracija uređaja | Token se traži tek kada korisnik u podešavanjima obaveštenja uključi obaveštenja; otvaranje ekrana ne traži dozvolu (`src/data/nativePushDevice.ts:8-23`). Server čuva token i platformu (`rpc_set_push_device_owned`, `src/data/pushDeviceClientService.ts:50`). |
| Konfiguracija izdanja | Firebase konfiguracija postoji samo za probni paket `rs.uskoci.preview`; za paket prodavnice `rs.uskoci` `googleServicesFile` se briše (`app.config.js`), a obične probne gradnje isključuju automatsko pokretanje FCM i Firebase analitike (`plugins/withFirebaseEnrollmentDisabled.js`). Push za izdanje prodavnice zato **nije konfigurisan u repozitorijumu**. `[[ODLUKA VLASNIKA: da li push ulazi u prvo izdanje]]` `[[PROVERITI: FCM/APNs ključevi i identiteti paketa]]` |
| Region, ugovor, čuvanje | `[[PROVERITI: Expo uslovi i DPA, čuvanje sadržaja poruka i tokena kod Expo-a, FCM/APNs kao podobrađivači]]` |

### R-06 · LocationIQ

| Stavka | Sadržaj |
|---|---|
| Tok | Uređaj šalje upit ovlašćenom Edge funkciji; ona proverava Auth korisnika i da je država dostupna (`rpc_list_location_markets`), pa poziva `https://eu1.locationiq.com/v1/search` ili `/v1/reverse` (`uskoci-location-search/index.ts:23-24, 194-217`). Uređaj **ne** komunicira sa LocationIQ direktno. |
| Šta prima | Pretraga: unet tekst adrese/mesta (do 1.000 znakova), šifra države, ograničenje 10 rezultata. Obrnuto: tačne koordinate i zoom. Ključ davaoca je deo URL-a pri pozivu (`:212-214`). Ne šalju se ID naloga, ime, email niti token korisnika (`:215-216`). |
| Ograničenja | Po korisniku: jedan zahtev odjednom, najmanje 1 s razmaka, najviše 10/min (izolat lokalno) (`:58-84`); rok 7 s (`:21`). |
| Šta se vraća i čuva | Do 10 predloga (naziv, država, koordinate, neprozirni ID); predlog nikad sam ne postaje potvrđena tačka (`:1-6, 148-150`). Potvrđena tačka koju korisnik izabere čuva se kao privatni podatak zadatka (LEG-09, P-11). |
| Prikaz izvora | U aplikaciji stoji veza „Pretraga: LocationIQ · izvori podataka” (`src/ui/location/WorkerAreaSearch.tsx:79`, `LocationPointEditor.tsx:245`). |
| Region | Završna tačka je `eu1` (odobren EU endpoint, `uskoci-location-search/index.ts:2`). `[[PROVERITI: pravno lice i lokacija obrade iza eu1 tačke, DPA, uslovi plana o čuvanju i keširanju rezultata]]` |
| Spisak u bazi | LocationIQ **nije** u tehničkom spisku obrađivača u bazi (odeljak 4). |

### R-07 · OpenFreeMap (podloga mape)

| Stavka | Sadržaj |
|---|---|
| Tok | Aplikacija čita stil `https://tiles.openfreemap.org/styles/positron` (`src/ui/location/ResolvedPinMap.types.ts:17`), prilagođava natpise na srpsku latinicu lokalno i predaje ga mapi (`src/ui/location/mapStyle.ts`); pločice, sprajtove i fontove učitava biblioteka `@maplibre/maplibre-react-native` sa adresa iz stila. |
| Šta davalac neizbežno vidi | IP adresu uređaja, vreme, tražene pločice (grubo prikazano područje). Kod navodi da „nothing about the person enters this request” (`mapStyle.ts:15`); nema naloga, tokena ni koordinata u zahtevu za stil. |
| Prikaz izvora | „© OpenStreetMap”, „© OpenMapTiles”, „OpenFreeMap” sa vezama (`src/ui/location/LocationOverviewMap.types.ts:34-38`). |
| Otvoreno | `[[PROVERITI: uslovi korišćenja usluge (javna usluga bez ugovora), politika privatnosti davaoca, pravni osnov da se IP adresa uređaja šalje spoljnoj javnoj usluzi, da li je potreban zaseban obraćajući tekst u politici]]` `[[ODLUKA VLASNIKA: da li se za produkciju ostaje na javnoj usluzi ili se uvodi ugovorni davalac podloga]]` |

### R-08 · Email za Auth (potvrda i oporavak)

Registracija šalje email, lozinku i, kao metapodatke Auth-a, ime, prezime i grad (`src/data/authClientService.ts:44-52`, `src/app/auth.tsx`), uz adresu povratka u aplikaciju (`emailRedirectTo`); potvrda i oporavak lozinke idu preko Supabase Auth email tokova. Pošiljalac (podrazumevani Supabase ili sopstveni SMTP) nije određen u repozitorijumu; stvarna isporuka i povratak u aplikaciju nisu prihvaćeni (`docs/control/redovi.json`, red N02; `BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md`). `[[PROVERITI: izabrani pošiljalac, njegov ugovor, region i čuvanje sadržaja poruka]]`

## 3. Nisu obrađivači podataka korisnika (za jasnoću)

| Subjekat | Zašto nije unet | Napomena |
|---|---|---|
| EAS Build (Expo) | Obrađuje izvorni kod i potpisne akreditive, ne podatke korisnika (`docs/implementation/P4_PROCESSOR_MAP_20260908.md`) | Nalog: `owner: "sljivas-team"` u `app.json`; `[[PROVERITI: nalog i vlasnik potpisa]]` |
| GitHub / GitHub Actions | CI koristi samo jednokratne probne baze i sintetičke podatke | Ne pokretati CI protiv podataka korisnika |
| Apple App Store / Google Play | Distribucija aplikacije i sopstvena telemetrija prodavnica (samostalni rukovaoci) | Ulazi u odgovore o podacima za prodavnice (LEG-16/17), ne u ovaj registar |
| Google mape (spoljna navigacija) | Aplikacija samo otvara `https://www.google.com/maps/...` kada korisnik dodirne „Otvori navigaciju” (`src/ui/location/locationMapLinks.ts:12-21`); tačne koordinate idu tek kada korisnik ima privatni pristup | Veza koju korisnik sam pokreće; Google je tada samostalni rukovalac |

## 4. Neusklađenosti između koda i registra u bazi

Stanje čitano 2026-09-28 (`BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md`) i 2026-09-29 (master plan, DB01):

| Kod (ovaj registar) | Tehnički spisak u bazi (`private.processor_provider_inventory`) |
|---|---|
| Google Gemini - da | `GOOGLE_GEMINI_AI` aktivan |
| OpenAI - **ne poziva se** (u `supabase/functions` jedini AI domen je `generativelanguage.googleapis.com`; OpenAI se pominje samo u komentaru, `uskoci-ai-interview/index.ts:276`) | `OPENAI_AI` aktivan i obavezan (zastareo) |
| Expo push - da (kada je prekidač uključen) | `EXPO_PUSH` neaktivan (ne meša se sa prekidačem slanja) |
| LocationIQ - da | nema unosa |
| OpenFreeMap - direktno sa uređaja | nema unosa |
| Supabase - da | `SUPABASE_PLATFORM` aktivan |
| Objavljena mapa obrade (`private.processor_map_sets`) | **0 redova** - u aplikaciji stoji „Mapa obrade još nije objavljena” (`src/ui/legal/LegalDocuments.tsx`); isto važi za `legal_document_versions` i `retention_policy_sets` (0/0/0) |

Popravka spiska ( grana `work/legal-privacy-processor-inventory-truth-20260927`, `1ab01e78`) **nije integrisana**; vlasnik ju je odložio za završni prolaz privatnosti (2026-09-28). Tabela iznad je zato izvor za tu popravku.


> **ZADRŽANO 2026-10-02 (do završnog prolaza privatnosti):** tabela iznad i odstupanje u R-02 ostaju kakvi jesu; grane `d18e830a` i `1ab01e78` nisu integrisane. Stanje spiska obrađivača u bazi ponovo je čitano 2026-10-02 i nije se promenilo (odeljak 7.1).

## 5. Matrica prenosa van Srbije (radna)

Uslov za popunjavanje: prvo se određuje operater i država njegovog poslovanja (`LEG-01`), pa tek onda pravni mehanizam prenosa za svaki red. Ništa dole nije pravni zaključak.

| Primalac | Lokacija obrade koju kod/dokumenti pominju | Mehanizam prenosa | Status |
|---|---|---|---|
| Supabase | Frankfurt (razvojni projekat) | `[[PROVERITI]]` | `[[ODLUKA VLASNIKA: region produkcije]]` |
| Google (Gemini, Live) | „može biti van Evrope”, „globalno” (tekst u aplikaciji) | `[[PROVERITI]]` | otvoreno |
| Expo / FCM / APNs | nije zabeleženo | `[[PROVERITI]]` | otvoreno |
| LocationIQ | `eu1` | `[[PROVERITI]]` | otvoreno |
| OpenFreeMap | nije zabeleženo | `[[PROVERITI]]` | otvoreno |
| Pošiljalac email poruka | nije određen | `[[PROVERITI]]` | otvoreno |

Master plan (15.2) izričito upozorava: „EU region baze nije dokaz da svi spoljni transferi ostaju u EU.”

## 6. Zadaci za zatvaranje ovog registra

1. Dostaviti ili pronaći `USKOCI_DATA_FLOW_TRUTH_2026-09-27.md` i uporediti.
2. Za svakog primaoca R-01..R-08 dobiti: pravno lice, ugovor/DPA (ili potvrdu da ne postoji), region, rok čuvanja, podobrađivače, pravni mehanizam prenosa (`[[PROVERITI]]` polja).
3. Odlučiti produkcioni region i pošiljaoca email poruka `[[ODLUKA VLASNIKA]]`.
4. Posle integracije grana `d18e830a` i `1ab01e78` ponovo pročitati R-02 i odeljak 4 iz stvarnog koda i stanja baze.
5. Objaviti mapu obrade u serverski registar tek kada su svi redovi potvrđeni; tek tada aplikacija prikazuje „Obrađivači podataka” (`src/ui/legal/LegalDocuments.tsx`). Mapa obrade **nije** preduslov za izvoz podataka (preduslov su aktivna Politika privatnosti i raspored čuvanja, vidi LEG-10 i LEG-15); P4 ne uvodi ni blokadu poziva davalaca (`runtimeProviderGateAdmitted` je uvek `false`, `docs/implementation/P4_PROCESSOR_MAP_20260908.md`).

## 7. Osvežavanje 2026-10-02 (EX-07, slice S04)

> **Osvežen tehnički nacrt, nije pravni savet.** Ugovori, regioni i mehanizmi prenosa ostaju `[[PROVERITI: ...]]` i `[[ODLUKA VLASNIKA: ...]]`.

### 7.1 Šta se promenilo za primaoce i obrađivače (stanje DEV 2026-10-02)

| Tema | Stanje | Izvor |
|---|---|---|
| Novi obrađivač | **Nijedan.** Paket D12 (komentar uz ocenu) i EX-04 (lični prikazi lista) ne pozivaju nijednog davaoca: njihove funkcije su SQL funkcije u bazi (R-01). Odluka vlasnika za D12: bez automatske AI moderacije i bez plaćene usluge. | `supabase/proofs/d12/README_D12_CANDIDATE.md` (odeljak „Owner decisions that bind this candidate”); `supabase/operations/dev-alpha/ledger/20261001_ex04_s1_s4_application.receipt.json` |
| Glasovne poruke (Voice B1) | Čuvaju se samo u bazi i u privatnom Storage-u Supabase-a (kofer `agreement-voice`), dakle kod R-01. Ne šalju se Google-u (R-02, R-03), LocationIQ-u (R-06) ni drugom primaocu, osim opšteg teksta push obaveštenja (R-04, R-05). R-03 (Google Gemini Live) ostaje isključivo za govorni unos u AI razgovor, koji se ne čuva. Podrška ne dobija zvuk. | `docs/implementation/product-v1-closure-20260926/finalization-20260927/VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md`; `docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md` |
| R-01, privatni Storage | Tri privatna kofera: `profile-media` (ograničenje 5242880 bajtova; `image/jpeg`, `image/png`, `image/webp`), `data-export-artifacts` (8388608; `application/json`) i `agreement-voice` (4194304; `audio/mp4`). Nijedan nije javan. | DEV-čitanje 2026-10-02 (`storage.buckets`) |
| R-01, Edge funkcije | Poslednje zapisano stanje (`list_edge_functions` 2026-10-01 07:00 UTC, priznanica Voice B1): 11 aktivnih funkcija; `uskoci-media` v14 nosi i operacije za glas; `uskoci-account-closure-worker` v4. **Nije ponovo čitano 2026-10-02.** | `supabase/operations/dev-alpha/ledger/20261001_chat_voice_b1_application.receipt.json` (polje `edge`) |
| Spisak obrađivača u bazi | Nepromenjen: 4 reda; `SUPABASE_PLATFORM`, `OPENAI_AI` (zastareo, aktivan i obavezan) i `GOOGLE_GEMINI_AI` aktivni, `EXPO_PUSH` neaktivan; nema LocationIQ ni OpenFreeMap; `updated_at` 2026-09-10; objavljena mapa obrade 0 redova | DEV-čitanje 2026-10-02 (`private.processor_provider_inventory`, `private.processor_map_sets`) |
| Push, prekidači, FCM | Nisu čitani 2026-10-02. | - |

### 7.2 Upozorenja koja se ZADRŽAVAJU do završnog prolaza privatnosti

Do završnog prolaza privatnosti cele aplikacije pre javnog izdanja (AGENTS.md 4.5) ostaje nepromenjeno:

1. odstupanje u R-02: privatna adresa i napomene za pristup mogu biti u kontekstu AI razgovora; grana `d18e830a` nije integrisana;
2. neusklađenost spiska obrađivača u bazi iz odeljka 4; grana `1ab01e78` nije integrisana;
3. nijedan javni tekst ne sme da kaže da privatna adresa nikad ne stiže Google-u.

Ovaj registar se ne objavljuje i ne povezuje sa aplikacijom pre toga. Izvor: `AGENTS.md` odeljak 4.5; `docs/implementation/product-v1-closure-20260926/finalization-20260927/EX07_CANONICAL_SCOPE_20261001.md` (odeljak 11, rizik „Legal drafts can be mistaken for approved content”).

### 7.3 Dopune zadataka za zatvaranje (odeljak 6)

1. Ugovor o obradi sa Supabase treba da obuhvati i glasovne datoteke (`agreement-voice`) i komentare uz ocene (u bazi).
2. Region i čuvanje rezervnih kopija važe i za glasovne datoteke: `[[PROVERITI: plan i retencija kopija, LEG-10 odeljak 5]]`.
