# LEG-12 · Obaveštenja u aplikaciji: AI, govor, lokacija, fotografije, push

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-12 (master plan 16.2): kratki tekstovi pre relevantne upotrebe, razdvojeni STT, glasovne poruke i AI odgovor; tekst odgovara onome što se stvarno šalje davaocu |
| Status | DRAFT-FROM-CODE (tekstovi su predlog; ništa u aplikaciji nije menjano) |
| Izvor koda | `Uskoci1/USKOCI-CLEAN`, grana `work/uskoci-ui-unification-20260924`, commit `fc58f411598338c8589f5f177626a2790c92fb13`, pročitano 2026-09-30, samo za čitanje |
| Vezani nacrti | LEG-09 (obrada P-xx), LEG-11 (primaoci R-xx), LEG-04 §5-§9, LEG-13, LEG-18 |

**OSVEŽENO 2026-10-02 (EX-07, slice S04):** dodata su dva nova predloga obaveštenja, **N-13** (glasovna poruka u Dogovoru) i **N-14** (pisani komentar uz ocenu), jer su serverski paketi Voice B1 i D12 primenjeni na razvojnu bazu (odeljak 8). Raniji tekst je zadržan; zamenjeni delovi su označeni „SUPERSEDED 2026-10-02”.


## 0. Pravila ovog dokumenta

1. Tekst u aplikaciji je u obliku „ti” (glas proizvoda, npr. „Drži mikrofon dok govoriš”), zato su predlozi niže napisani tako. Javni pravni tekstovi (LEG-02/04) koriste treće lice.
2. Svaki predlog navodi **šta se stvarno šalje** i u kom kodu to stoji. Ako se kod promeni, tekst se menja sa njim.
3. Ne tvrdi se ništa što kod ne radi: ne „samo EU”, ne „Google ne čuva”, ne „nikad ne vidi adresu” (dok grana `d18e830a` nije integrisana, vidi N-01).
4. Već odobreni tekstovi u aplikaciji se čuvaju doslovno; ovde se predlažu samo dopune tamo gde postoji praznina.
5. Odbijanje dozvole ne sme da blokira osnovnu upotrebu: uvek postoji ručna alternativa (RC2 Privacy §5: „Ako korisnik odbije GPS, gde je moguće treba ponuditi ručni unos adrese/oblasti”).
6. Razdvojene su tri stvari koje se lako mešaju (master plan 6, „Glas”): **govorni unos u AI razgovor** (postoji, Android, kontrolisani test), **glasovna poruka u Dogovoru** (nije isporučena, `docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md`) i **izgovoren AI odgovor** (ne postoji). Tekstovi niže pokrivaju samo prvu.

> **SUPERSEDED 2026-10-02 by odeljak 8.1 (u delu o glasovnoj poruci u Dogovoru):** stavka 6 kaže da glasovna poruka u Dogovoru „nije isporučena” i upućuje na ugovor sa statusom „VOICE UNSHIPPED”. Serverski paket Voice B1 je primenjen na razvojnu bazu 2026-10-01 (ledger 215), a klijent nije potvrđen kao isporučen. Podela na tri stvari (govorni unos u AI razgovor, glasovna poruka u Dogovoru, izgovoren AI odgovor) ostaje tačna.


## 1. Pregled

| ID | Obaveštenje | Gde se prikazuje | Stanje danas | Prioritet |
|---|---|---|---|---|
| N-01 | AI razgovor za zadatak | pre prve poruke (dijalog „O obradi i privatnosti”) | **ne postoji** | visok |
| N-02 | AI razgovor za radni profil | pre prve poruke | **ne postoji** | visok |
| N-03 | Govorni unos | link „O govornom unosu i privatnosti”; sistemska dozvola mikrofona | dijalog **postoji** (odobren); sistemski tekst dozvole se **razilazi** sa ponašanjem | srednji |
| N-04 | Provera zadatka pre objave | ekran pregleda | ne postoji (postoji samo napomena o fotografijama) | srednji |
| N-05 | Fotografije | pri izboru fotografije | **postoji** (odobren tekst); predlog dopune | nizak |
| N-06 | Javna pitanja i odgovori | forma pitanja | delimično (anonimnost, ne kontakt) | nizak |
| N-07 | Lokacija: „U blizini” (GPS) | dozvola i dugme | dozvola **postoji**; dopuna na ekranu | nizak |
| N-08 | Lokacija: tačka zadatka i privatna adresa | uređivač mesta | delimično | srednji |
| N-09 | Lokacija: pretraga adrese | polje za pretragu | samo veza „izvori podataka” | srednji |
| N-10 | Lokacija: radna oblast izvođača | ekran „Područje rada” | ne postoji | nizak |
| N-11 | Mapa (pozadina) | „O aplikaciji” i Privatnost | samo natpisi izvora | nizak |
| N-12 | Push obaveštenja | „Podešavanja obaveštenja” | delimično (postoji jedna rečenica) | srednji |

## 2. Tekstovi

### N-01 · AI razgovor za zadatak

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno šalje | Do 30 poslednjih poruka razgovora (svaka najviše 4.000 znakova) i trenutna poruka, uz sve aktuelne činjenice razgovora osim potvrđene tačke (`need.resolved_location`), Google-ovom AI servisu (`gemini-3.8-flash`) preko USKOČI servera. Ne šalju se nalog, email, telefon, push token ni poruke Dogovora. `uskoci-ai-interview/index.ts:519-529`; `supabase/migrations/20260910172132_clean_w03_owned_ai_intake_authority.sql:66-99`. Privatne činjenice `need.exact_address` i `need.access_notes` **jesu** među činjenicama kada su sačuvane: korak „Mesto zadatka” ih upisuje kao potvrđene činjenice razgovora (`src/contracts/needFactsV2.ts:42-43`; `supabase/migrations/20260910121926_clean_w02_regional_country_authority.sql:192-209`), pa ih svaka sledeća AI poruka u tom razgovoru nosi Google-u. |
| Predlog teksta (verzija A - ponašanje danas) | **Naslov:** O obradi razgovora i privatnosti. **Tekst:** „AI pomaže da sastaviš zadatak. Ono što upišeš ili izgovoriš u razgovoru, zajedno sa podacima zadatka koje smo do sada izdvojili iz razgovora, šalje se Google-ovom AI servisu (Gemini) radi predloga. To uključuje i tačnu adresu i napomene za pristup ako si ih već sačuvao u toku razgovora. Ne upisuj tuđe lične podatke. AI samo predlaže: ti proveravaš i sam odlučuješ o objavi. Google može privremeno obrađivati podatke i van Evrope radi bezbednosti plaćenog servisa.” `[[PROVERITI: da li je u tokovima aplikacije moguće završiti izbor mesta posle poslednje AI poruke, pa dodati savet o redosledu]]` |
| Predlog teksta (verzija B - posle integracije grane `d18e830a` i potvrde) | Isto, ali poslednja rečenica o adresi glasi: „Tačna adresa i napomene za pristup koje si već sačuvao ne šalju se AI servisu; ono što ukucaš u poruku, šalje se.” Menja se tek kada se filter stvarno primeni i proveri. |
| Ako odbiješ | **Trenutno nema alternative bez AI obrade**: zadatak nastaje kroz razgovor, a ručni unos je uklonjen odlukom (`docs/control/redovi.json`, blokada B02; u pročitanom kodu nema ručnog puta za novi zadatak). Pregled zadatka dozvoljava dopunu i izmenu polja, ali tek posle razgovora. Ovo je važno za pravni osnov: obrada ne može da počiva na dobrovoljnoj saglasnosti ako druge mogućnosti nema. `[[ODLUKA VLASNIKA: da li se uvodi ručni put bez slanja teksta AI servisu]]` `[[PROVERITI: pravni osnov, LEG-09 P-05]]` |
| Gde | Postojeći obrazac: u praznom razgovoru već stoji link „O govornom unosu i privatnosti” koji otvara dijalog (`src/ui/aiFirst/AiConversationShell.tsx:149,222-227`); link se prikazuje samo kada je govor dostupan. Predlog: isti dijalog sa širim nazivom, uvek prikazan. |
| Pravni osnov | `[[PROVERITI]]` (LEG-09, P-05) |

### N-02 · AI razgovor za radni profil

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno šalje | Do 30 poslednjih poruka i kandidat profila: prikazno ime, opis, veštine, alat, vozila, dozvole (koje je korisnik sam naveo), kapacitet tima, država, grad, radijus, pravila dostupnosti. `uskoci-worker-interview/index.ts:136-148`. |
| Predlog teksta | „AI pomaže da sastaviš radni profil. Ono što upišeš ili izgovoriš, zajedno sa podacima profila koje već imamo (ime, opis, veštine, alat, vozila, dozvole koje si sam naveo, radna oblast i dostupnost), šalje se Google-ovom AI servisu (Gemini). Navedene dozvole nisu proverene i ne prikazuju se kao potvrđene. Ti proveravaš predlog pre nego što se profil sačuva.” |
| Ako odbiješ | Radni profil se može popuniti ručno (`/profil/radnik`, red B01). |

### N-03 · Govorni unos (postoji)

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno šalje | Prolazni zvuk PCM 16 kHz dok se drži mikrofon, preko USKOČI servera Google-ovom servisu za govor u tekst (`gemini-3.5-transcribe-live`, jezik `sr-RS`); tekst se vraća; zvuk se ne čuva kod nas (`UskociVoiceModule.kt:16`; `uskoci-speech-session/proxy.ts:9,52-56,155`). |
| Postojeći tekst dijaloga (odobren 2026-09-24, čuva se) | „Zvuk se prolazno šalje Google servisu radi transkripcije. USKOČI ne čuva audio snimke. Kad pustiš mikrofon, ili u glasovnom režimu ponovo dodirneš, izgovoreni tekst odmah odlazi u razgovor. Ako uključiš „Pregledaj tekst pre slanja” ili koristiš čitač ekrana, tekst najpre stiže u polje za poruku i šalje se tek kad izabereš Pošalji. Google može privremeno obrađivati podatke globalno radi bezbednosti plaćenog servisa.” (`src/features/voice/useHoldToTalk.ts:17`) |
| Predložena dopuna (jedna rečenica) | „Tekst koji nastane ostaje u razgovoru kao i ostale poruke.” (odluka AF-D02: završni tekst ostaje u privatnom razgovoru) |
| **Neusklađenost** | Sistemski tekst dozvole mikrofona (iOS `NSMicrophoneUsageDescription`, Android objašnjenje) glasi: „Drži mikrofon za razgovor sa USKOČI asistentom. Puštanje završava transkript koji možeš da izmeniš; poruku šalješ tek kada izabereš Pošalji.” (`app.config.js`, opcija `microphonePermission`). Podrazumevano ponašanje je drugačije: puštanje odmah šalje tekst u razgovor, pregled je opcija. Predlog: „USKOČI koristi mikrofon dok držiš dugme za govor u razgovoru sa asistentom. Zvuk se prolazno šalje Google servisu radi pretvaranja u tekst; USKOČI ne čuva snimak.” |
| Ako odbiješ dozvolu | Razgovor se nastavlja kucanjem. Postojeći tekst: „Mikrofon nije dozvoljen. Dozvolu možeš promeniti u podešavanjima telefona ili nastaviti kucanjem.” (`src/features/voice/holdToTalk.ts:24`; `nativeSpeechAdapter.ts:23-31`). |
| Platforma | Samo Android (iOS modul ne postoji). Na iOS-u ne prikazivati obaveštenje niti mikrofon dok se funkcija ne isporuči. |
| Glasovne poruke između korisnika | Ne postoje; kada se isporuče, potreban je zaseban tekst: poruka se čuva na serveru (privatni Storage), dostupna učesnicima, i **nije** deo ovog obaveštenja (`CHAT_VOICE_CONTRACT.md`). |


> **SUPERSEDED 2026-10-02 by N-13 u odeljku 8.2:** red „Glasovne poruke između korisnika” u unosu N-03 kaže „Ne postoje; kada se isporuče, potreban je zaseban tekst”. Serverski deo postoji na razvojnoj bazi (Voice B1); zaseban tekst je predložen kao N-13.

### N-04 · Provera zadatka pre objave

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno šalje | Javna polja zadatka (naslov, opis, kategorija, termin, broj ljudi, cena, zahtevi, približna oblast) i broj fotografija; do 6 obrađenih fotografija samo kada je uključena provera slika (`USKOCI_GEMINI_IMAGE_REVIEW_ENABLED`); bez privatne adrese, koordinata, ID-eva naloga (`uskoci-publication-evaluate/index.ts:137-166,282,362-365`). |
| Predlog teksta (na pregledu, uz dugme „Objavi zadatak”) | „Pre objave proveravamo da li zadatak ispunjava pravila zajednice. U proveri učestvuje Google-ov AI servis: dobija javni deo zadatka i izabrane fotografije, ne i tačnu adresu. Ishod možeš da osporiš kroz podršku.” |
| Ako odbiješ | Provera je uslov objave: objava traži najnoviji tačan ishod `ALLOW` (`rpc_publish_need_canonical`, `docs/implementation/v5-ai-first/PUBLICATION_ACTIVATION_READINESS.md`, odeljak 2). Ishod „potrebna provera” vodi u podršku (tema „Pregled odluke o objavi”, `src/ui/support/SupportPresentation.tsx:23`). |

### N-05 · Fotografije

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno dešava | Server dekodira i ponovo kodira sliku u JPEG, najduža strana najviše 1.600 px, uklanja EXIF, GPS, XMP, ICC i komentare; ulaz najviše 10 MB, izlaz najviše 5 MB; čuva se u privatnom Storage-u (`_shared/mediaImageSanitizer.mjs:3-4,34-40`). Fotografije **zadatka** (do 6) mogu ići Google-ovom AI servisu na proveru pre objave (N-04). Fotografije u prepisci Dogovora (do 6 po poruci) i profilna fotografija ne idu AI servisu u kodu koji je pročitan. |
| Postojeći tekst (odobren, čuva se) | „Izabrane fotografije šaljemo Google Gemini servisu radi provere sadržaja pre objave. Obrada može biti van Evrope i uključuje privremene bezbednosne zapise kod Google-a.” (`src/ui/objava/TaskPhotosPresentation.tsx:86`) |
| Predložena dopuna | „Iz fotografije uklanjamo podatke o lokaciji i uređaju i smanjujemo je. Fotografije zadatka vide prijavljeni korisnici aplikacije; fotografije u poruci vide samo učesnici Dogovora.” |
| Sistemski tekstovi dozvola (tačni, čuvaju se) | kamera: „USKOČI koristi kameru kada želiš da dodaš fotografiju zadatka ili profila.” fotografije: „Izaberi fotografiju za svoj zadatak ili profil.” (`app.config.js`) |
| Ako odbiješ | Zadatak i profil se mogu objaviti bez fotografije. |

### N-06 · Javna pitanja i odgovori pre izbora

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno šalje | Tekst pitanja (do 500) ili odgovora (do 1.000 znakova) i javna polja zadatka Google-ovom AI servisu na proveru, kada je uključen `USKOCI_QA_CLASSIFIER_ENABLED` (`uskoci-qa-classify/index.ts:118-131,191-192`). |
| Postojeći tekst (odobren, čuva se) | „Pitanja su anonimna. Javno se prikazuju samo pitanja na koja je odgovoreno. Ne unosiš kontakt, preciznu adresu ni podatke za pristup.” (`src/ui/qa/TaskQaPresentation.tsx:77`) |
| Napomena 2026-10-02 (A10) | Odluka vlasnika A10 (`docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`: „Odluka 17: prosek i pojedinačne ocene uz komentar”) odnosi se na ocene i komentare uz ocenu, ne na ovaj odobreni tekst o javnim pitanjima: rečenica „Pitanja su anonimna.” ostaje kako je u aplikaciji. Da li ta rečenica sme da ostane u javnim tekstovima, imajući u vidu pravilo da se u tekstovima ne obećava anonimnost, je `[[PROVERITI]]`. |
| Predložena dopuna | „Pre objave tekst se automatski proverava; u proveri učestvuje Google-ov AI servis.” |

### N-07 · Lokacija: „U blizini” (GPS)

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno dešava | Jedno očitavanje položaja u prednjem planu, samo posle dodira; centrira mapu; **ne čuva se, ne šalje se mreži i ne koristi geokoder**; nema pozadinskog praćenja (`src/ui/v2/discovery/nearbyCapture.ts:1`; `app.config.js`: pozadinska dozvola isključena). |
| Postojeći sistemski tekst (tačan, čuva se) | „USKOČI koristi jednu lokaciju kada pritisneš „U blizini”, da prikaže mapu zadataka oko tebe.” |
| Predložena dopuna uz dugme | „Položaj se koristi samo da pomeri mapu. Ne čuva se i ne šalje se.” |
| Ako odbiješ | Mapa se pomera ručno, ili se traži mesto pretragom. |

### N-08 · Lokacija: tačka zadatka i privatna adresa

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno dešava | Potvrđena tačka, privatna adresa (do 1.000) i napomene za pristup (do 2.000) čuvaju se kao privatni podaci zadatka; javno se prikazuje samo približna oblast (`src/ui/location/LocationPointEditor.tsx:198-206`, `LocationMapPreview.tsx:119`). Izbor „Koristi moju lokaciju” koristi jedno očitavanje i ništa ne čuva dok tačku ne potvrdiš (`LocationPointEditor.tsx:140-160`). |
| Postojeći tekstovi (čuvaju se) | „Izaberi tačno mesto i potvrdi ga. Tačka i detalji ispod ostaju privatni.” / „Prikazano je približno područje, ne tačna adresa.” / „Pristup lokaciji nije dozvoljen. Možeš ga dozvoliti u podešavanjima ili upisati mesto iznad.” |
| Predložena dopuna | „Tačnu adresu vidi samo osoba koju izabereš, kada oboje potvrdite Dogovor i ti dozvoliš prikaz.” `[[PROVERITI: tačan uslov otkrivanja u izdanju (RC2 Uslovi §13; kontrolni red D08)]]` Napomena: postojeće „ostaju privatni” znači da ih drugi korisnici ne vide; ono što sačuvaš u koraku „Mesto zadatka” ulazi i u kontekst AI razgovora (N-01), što ovaj tekst ne sme da opovrgne. |

### N-09 · Lokacija: pretraga adrese

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno šalje | Tekst koji uneseš (do 1.000 znakova) i šifra države, ili tačne koordinate pri „Pronađi adresu za ovaj pin”, šalju se preko USKOČI servera servisu LocationIQ; ne šalju se ime, nalog ni token (`uskoci-location-search/index.ts:23-24,194-217`; obrnuta pretraga samo na izričit dodir, `LocationPointEditor.tsx:165-172,294-295`). |
| Postojeći prikaz | Veza „Pretraga: LocationIQ · izvori podataka” (`WorkerAreaSearch.tsx:79`, `LocationPointEditor.tsx:245`). |
| Predlog teksta | „Da predložimo mesto, tekst koji upišeš šalje se servisu za pretragu adresa (LocationIQ) preko našeg servera. Servis ne dobija tvoje ime ni nalog. Predlog ništa ne objavljuje dok ne potvrdiš tačku.” |

### N-10 · Lokacija: radna oblast izvođača

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno dešava | Država, grad, radijus (1-200 km) i opciona približna tačka čuvaju se u profilu i koriste za preporuke zadataka; nema praćenja (`src/app/(app)/profil/lokacija.tsx`; `supabase/migrations/20260829211632_clean_dispatch_engine.sql:100-201`). |
| Predlog teksta | „Radna oblast se koristi da ti predložimo zadatke u blizini. Čuvamo grad, radijus i, ako je izabereš, približnu tačku. Ne pratimo tvoje kretanje.” |

### N-11 · Mapa (pozadina)

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno dešava | Podlogu mape (stil i pločice) uređaj učitava direktno sa `tiles.openfreemap.org`; taj servis vidi IP adresu uređaja i koje delove mape tražiš (`ResolvedPinMap.types.ts:17`, `mapStyle.ts:15`). |
| Postojeći prikaz | „© OpenStreetMap”, „© OpenMapTiles”, „OpenFreeMap” (`LocationOverviewMap.types.ts:34-38`). |
| Predlog teksta (u „O aplikaciji” / Privatnost) | „Podloga mape dolazi sa javnog servisa OpenFreeMap (podaci OpenStreetMap). Taj servis vidi IP adresu tvog uređaja i deo mape koji gledaš, ali ne i tvoj nalog.” `[[PROVERITI: uslovi i politika OpenFreeMap-a]]` |

### N-12 · Push obaveštenja

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno šalje | Expo push servisu (pa Google FCM / Apple APNs): Expo token uređaja i opšti tekst tipa događaja („Nova poruka u Dogovoru / Imaš novu poruku.”), bez teksta poruke, imena, adrese ni cene; prioritet, kanal, `ttl: 0` (`_shared/pushNotificationCopy.mjs`; `uskoci-push-transport/index.ts:129-134`). Dozvola se traži tek kada uključiš obaveštenja u podešavanjima (`src/data/nativePushDevice.ts:8-23`). |
| Postojeći tekst (čuva se) | „Na zaključanom ekranu prikazujemo samo da imaš novo obaveštenje. Poruke i privatne lokacije ostaju u aplikaciji.” (`src/ui/notifications/PushPreferences.tsx:188`) |
| Predložena dopuna | „Obaveštenje nosi samo opšti naslov, npr. „Nova poruka u Dogovoru”, bez sadržaja poruke. Šalje se preko Expo servisa, a zatim Google-a (Android) ili Apple-a (iPhone). Možeš ih isključiti u bilo kom trenutku; račun i poruke i dalje vidiš u aplikaciji.” |
| Ako odbiješ | Obaveštenja u aplikaciji (zvonce) rade bez push-a. |
| Otvoreno | Push u izdanju prodavnice nije konfigurisan u repozitorijumu (LEG-11, R-05); tekst se aktivira zajedno sa funkcijom. |

## 3. Šta ovim tekstovima nije rešeno

- Pravni osnov i saglasnost za AI, govor i push su u LEG-09 označeni `[[PROVERITI]]`; tekst obaveštenja ne zamenjuje pravni osnov.
- Nema pojedinačne saglasnosti (checkbox) za bilo koje od ovih obaveštenja; odluka da li je za AI/govor potrebna izričita saglasnost je `[[ODLUKA VLASNIKA]]` posle pravnog pregleda.
- Obaveštenja o tuđim podacima u slobodnom tekstu (N-01) treba proveriti u DPIA (LEG-09, odeljak 4).
- Iste tekstove treba preslikati u odgovore za Apple App Privacy i Google Data Safety (LEG-16/17) i u Politiku privatnosti (LEG-04).

## 8. Osvežavanje 2026-10-02 (EX-07, slice S04)

> **Osvežen tehnički nacrt, nije pravni savet. Tekstovi su predlozi; ništa u aplikaciji nije menjano.** Tekstovi u aplikaciji su u obliku „ti” i bez gramatičkog roda. Pravni osnov i saglasnost ostaju `[[PROVERITI]]`. Izvori: repozitorijum (HEAD `0b9cd8c9`) i **DEV-čitanje 2026-10-02** (samo čitanje razvojne baze, definicije i brojevi, bez ličnih podataka; LEG-09 odeljak 7.1).

### 8.1 Šta se promenilo

| Tema | Stanje 2026-10-02 | Izvor |
|---|---|---|
| Glasovna poruka u Dogovoru | Serverski paket Voice B1 je primenjen na DEV 2026-10-01 (ledger 215): tabela `private.agreement_voice_uploads_v1`, privatni kofer `agreement-voice`, funkcije za slanje i čitanje. Klijent (snimanje, reprodukcija) nije potvrđen kao isporučen; zastavica klijenta `EXPO_PUBLIC_VOICE_MESSAGES` je u priznanici isključena. Zato je potreban zaseban tekst pre prvog snimanja (N-13). 0 otpremanja i 0 poruka sa glasom na DEV. | `supabase/operations/dev-alpha/ledger/20261001_chat_voice_b1_application.receipt.json`; DEV-čitanje 2026-10-02 |
| Pisani komentar uz ocenu | Serverski paket D12 je primenjen na DEV 2026-10-02 (ledger 221); 0 komentara; klijent u trenutku primene nije postojao. Zato je potreban zaseban tekst (N-14). | `supabase/operations/dev-alpha/ledger/20261002_d12_review_comment_application.receipt.json` |
| Govorni unos u AI razgovor (N-03) | Nepromenjen: zvuk se ne čuva; to **nije** glasovna poruka. | odeljak 2, N-03 |
| Sistemski tekst dozvole mikrofona | Nije menjan. Za glasovne poruke potreban je zaseban tekst: odluke o iOS tekstu mikrofona i o `expo-audio` (uslovno odobren) čekaju. | `VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md` (odeljak 6, tačka 4) |

### 8.2 Predlozi obaveštenja

#### N-13 · Glasovna poruka u Dogovoru

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno dešava | 1. Snimanje je samo u prednjem planu, a mikrofon se traži tek kada izričito započneš snimanje (ugovor; klijent nije potvrđen). 2. Snimak (MPEG-4, `audio/mp4`, do 300000 ms i 4194304 bajtova) šalje se USKOČI serveru i čuva kao privatna datoteka u kofu `agreement-voice`; proverava se samo struktura datoteke; snimak se ne prepisuje u tekst i ne šalje se nijednom davaocu osim Supabase-u, na kome je aplikacija (LEG-11 R-01). 3. Slušaju je samo učesnici Dogovora; reprodukcija traži novo ovlašćenje. 4. Push obaveštenje nosi samo opšti tekst. 5. Podrška ne sluša zvuk; prijava nosi samo fiksnu oznaku. 6. Pri zatvaranju naloga pošiljaoca zvuk se briše (dokazano na jednokratnom lancu, ne na razvojnoj bazi); izuzeci zatvaranja važe (LEG-10 odeljak 7.5). |
| Izvor | `docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md` (odeljci „Product behavior”, „Storage”, „Durable upload”, „Read / playback”, „Notifications”); DEV-čitanje 2026-10-02 (`storage.buckets`, CHECK ograničenja `private.agreement_voice_uploads_v1`); `VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md` (odeljci 2 i 4) |
| Predlog teksta (verzija A) | „Glasovna poruka se šalje USKOČI serveru i čuva kao privatna datoteka dok postoji tvoj nalog. Slušaju je samo učesnici ovog Dogovora. USKOČI je ne prepisuje u tekst i ne šalje je AI servisu. Podrška je ne sluša automatski. Kada zatvoriš nalog, tvoje glasovne poruke se brišu, osim ako postoji izdvojen predmet koji zadržava zatvaranje.” `[[PROVERITI]]` |
| Predlog teksta (verzija A), ZAMENA 2026-10-02 (A04) | „Glasovna poruka se šalje USKOČI serveru i čuva kao privatna datoteka dok postoji tvoj nalog. Slušaju je samo učesnici ovog Dogovora. USKOČI je ne prepisuje u tekst i ne šalje je AI servisu. U prvom izdanju podrška ne može da čuje prijavljenu glasovnu poruku. Kada zatvoriš nalog, tvoje glasovne poruke se brišu, osim ako postoji izdvojen predmet koji zadržava zatvaranje.” Rečenica „Podrška je ne sluša automatski.” iz reda iznad je SUPERSEDED odlukom vlasnika A04 (`docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`): podrška ne može da čuje prijavljenu glasovnu poruku u V1 i to se piše kao poznato ograničenje; nijedan tekst ne sme da sugeriše da podrška sluša, ni ručno. `[[PROVERITI]]` ostaje samo za pravni osnov. |
| Ako odbiješ dozvolu mikrofona | Poruke ostaju tekst i fotografije. |
| Gde | Pre prvog snimanja; oblik i trenutak `[[ODLUKA VLASNIKA]]`. |
| Sistemski tekst dozvole | Postojeći tekst je napisan za govorni unos u AI razgovor (N-03); za glasovne poruke potreban je zaseban tekst `[[ODLUKA VLASNIKA]]`. |
| Pravni osnov | `[[PROVERITI]]` (LEG-09 P-29) |

#### N-14 · Pisani komentar uz ocenu

| Stavka | Sadržaj |
|---|---|
| Šta se stvarno dešava | 1. Komentar je opcion, najviše 500 znakova, moguć tek posle stvarno završenog Dogovora; po jedna ocena sa svake strane. 2. Objavljuje se odmah; vide ga prijavljeni korisnici na profilu ocenjene osobe, uz tvoje ime, fotografiju i ocenu. 3. Posle slanja ne može da se izmeni ni obriše; briše se kada zatvoriš nalog. 4. USKOČI može da sakrije tekst komentara (ne i ocenu); autor se o tome ne obaveštava. 5. Filter odbija e-poštu, veze, oznake sa @ i brojeve telefona koji počinju sa 0, 00, + ili 381; ne garantuje da u tekstu nema ličnih podataka. 6. Prosečna ocena i broj ocena su javni; pojedinačna ocena se vidi uz komentar. |
| Izvor | `supabase/proofs/d12/README_D12_CANDIDATE.md` (odeljci „Text rules”, „Reader semantics”, „What the owner's PRIMENI must knowingly accept”, tačke 3 do 9, 16 i 17); DEV-čitanje 2026-10-02 (CHECK ograničenja `private.agreement_review_comments_v1`) |
| Predlog teksta | „Komentar je opcion. Vide ga prijavljeni korisnici, uz tvoje ime, fotografiju i ocenu. Posle slanja ne možeš da ga izmeniš ni obrišeš; briše se kada zatvoriš nalog. Ne upisuj telefon, email ni tuđe lične podatke. USKOČI može da sakrije tekst koji krši pravila.” `[[PROVERITI]]` |
| Šta tekst ne sme da kaže | Da ocene bez komentara ostaju samo u zbiru (nije tačno, D12 tačka 17); da se komentar može izmeniti ili povući; da se autor obaveštava o skrivanju. |
| Šta je vlasnik prihvatio, a predlog to ne pominje (da li se saopštava: `[[ODLUKA VLASNIKA]]`) | Senka komentara uz blokadu (D12 tačka 16); jedna lista pod oba lica profila (tačka 7). |
| ODLUČENO 2026-10-02 (A09, A10, A11) | Do primene nastavka D12a (NIJE primenjen; kandidat još ne postoji u radnom stablu 2026-10-02) razvojna baza se ponaša kako opisuju prethodna dva reda. A09 će promeniti tačku 16 (osoba koju je autor blokirao videće komentar o sebi, uz sakriveno lice autora, i moći će da ga prijavi), a A11 tačku 7 (lista po ulozi: komentar o radniku samo pod radnikom, o tražiocu samo pod tražiocem); oba uz zaseban dokaz i vlasnikovo „PRIMENI D12a”, a predlog teksta N-14 se tada usklađuje. A10 je prihvaćen: pojedinačna ocena ostaje uz komentar i NIJEDAN tekst ne sme da obeća anonimnost (predlog iznad to ne čini). |
| Ako odbiješ | Ostaje samo ocena zvezdicama; komentar je opcion. |
| Pravni osnov | `[[PROVERITI]]` (LEG-09 P-30) |

### 8.3 Šta ovim tekstovima nije rešeno

- Pravni osnov, saglasnost i procena uticaja (komentar i glasovna poruka mogu da sadrže podatke trećih lica); nema pojedinačne saglasnosti (checkbox).
- Da li N-13 i N-14 traže izričit korak prihvatanja (uslovi prodavnica za sadržaj koji korisnici objavljuju: `docs/implementation/release-prep-20260930/DATA_DECLARATIONS_DRAFT.md` odeljak 7): LEG-13 odeljak 6.
- Pregled N-14 od pravnika zbog javnog prikaza pojedinačnih ocena uz komentar.
