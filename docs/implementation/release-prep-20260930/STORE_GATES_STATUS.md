# USKOČI — status 28 Apple / Google kontrola i zajedničkih pravila

> **STATUS: PRIPREMNI DOKUMENT, samo dokumentacija.** Ovo nije PASS nijedne kontrole i nije dozvola za submit. Ne menja kod, server, konzole ni kontrolni registar (`docs/control/redovi.json` ostaje jedini registar). Ne postoji nijedna kontrola sa statusom DONE: nijedan repozitorijumski artefakt to ne dokazuje.

| | |
|---|---|
| Šta je ovo | Status postojećih 28 kontrola iz poglavlja 18.2 (APL-01..12), 18.3 (GPL-01..13) i 18.4 (BOTH-01..03) master plana (`docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`), uz 18.1, 16.2, 5.2, 20 i 21.1. Nije nova lista: oznake su iz plana. Veze: `LEG-xx` i `OP-xx` iz `docs/implementation/legal-drafts-20260930/`, redovi `N`, `P`, `S` iz `docs/control/redovi.json`, `C-xx` iz `RELEASE_CONFIG_MATRIX.md` u ovom folderu. |
| Izvor koda i registra | grana `work/uskoci-ui-unification-20260924`, commit `e649044599b4d97d217979f11d2d98df2ca91f94`, čitano 2026-09-30, samo za čitanje. |
| Ograničenje izvora | Dokument `USKOCI_APPLE_GOOGLE_RELEASE_GATES_2026-09-28.md` (plan L02, 81 linija) **nije u repozitorijumu** i nije nađen ni u Desktop, Downloads i Documents do dubine 5. Tekst kontrola je zato uzet iz tabela 18.2 do 18.4 plana, ne iz originala. |
| Brojač plana | `docs/control/master-plan-live-state.json` → `release.status: NOT READY`, `release.store.done: null` od 28. |
| Spoljni zahtevi | svaka činjenica sa weba ima datum provere (2026-09-30) i URL. Pisano je svojim rečima. Uslovi se menjaju: neposredno pred submit proveriti konzole (plan 18.1). |

**Statusi:** `NOT STARTED` · `DRAFT EXISTS` (nacrt u repozitorijumu, nije objavljen ni potvrđen) · `BLOCKED BY OWNER INPUT` · `BLOCKED BY PRODUCT WORK` · `DONE` (nijedna) · `N/A` (nije primenljivo, sa obrazloženjem i dokazom; nije PASS). Kada ima više blokada, prvi status je primarni, ostale su u tekstu. `INFER` = zaključak koji nije proveren; `PROVERITI` = ne može se utvrditi iz repozitorijuma ili sa prikazane stranice.

## 1. Zbirni pregled

| ID | Kontrola | Status | Primarni blokator |
|---|---|---|---|
| APL-01 | Toolchain | NOT STARTED | vlasnik (Apple nalog, bundle id) i proizvod (iOS build nikad napravljen; EAS provera odbija iOS) |
| APL-02 | App Privacy | NOT STARTED (ulazi: DRAFT EXISTS) | vlasnik (adresa politike, operater) i proizvod (dve odložene privacy grane) |
| APL-03 | Privacy manifest | NOT STARTED | proizvod (nema iOS artefakta) |
| APL-04 | Required Reason API | NOT STARTED | proizvod (nema iOS artefakta) |
| APL-05 | Brisanje naloga | BLOCKED BY PRODUCT WORK | E2E na disposable subjektu i oporavak na drugom uređaju (red N10) |
| APL-06 | UGC moderacija | BLOCKED BY OWNER INPUT | operater i kanal za prijave (LEG-14) |
| APL-07 | Login services | N/A (obrazloženo) | samo email prijava (AF-D16) |
| APL-08 | Pristup za recenzente | NOT STARTED | vlasnik (produkcioni review nalozi) |
| APL-09 | Uzrast | NOT STARTED | vlasnik (odluka o uzrastu) |
| APL-10 | Screenshotovi i metapodaci | NOT STARTED | proizvod (izgled nije zamrznut; nema iOS builda) |
| APL-11 | Fizički posao | DRAFT EXISTS | vlasnik (objava Uslova) |
| APL-12 | Digitalne funkcije | N/A dok je cena 0 RSD | — |
| GPL-01 | Target API | NOT STARTED | vlasnik (EAS i Play Console) i inženjering (provera AAB-a) |
| GPL-02 | Data Safety | NOT STARTED (ulazi: DRAFT EXISTS) | vlasnik (adresa politike) i proizvod (odložene grane) |
| GPL-03 | Politika privatnosti | DRAFT EXISTS | vlasnik (operater, domen) |
| GPL-04 | Brisanje naloga | BLOCKED BY PRODUCT WORK | web put za zahtev ne postoji |
| GPL-05 | UGC uslovi i saglasnost | BLOCKED BY PRODUCT WORK | kapija saglasnosti ne postoji |
| GPL-06 | Prijava, blokiranje, moderacija | BLOCKED BY OWNER INPUT | operater i kanal (LEG-14) |
| GPL-07 | Foto/video minimalni obim | NOT STARTED | provera spojenog manifesta na AAB-u |
| GPL-08 | IARC | NOT STARTED | vlasnik (odluka o uzrastu) |
| GPL-09 | Ciljna publika | BLOCKED BY OWNER INPUT | vlasnik (odluka) |
| GPL-10 | Pristup za recenzente | NOT STARTED | vlasnik (produkcioni review nalozi) |
| GPL-11 | Fizički posao | DRAFT EXISTS | vlasnik (objava Uslova) |
| GPL-12 | Digitalne funkcije | N/A dok je cena 0 RSD | — |
| GPL-13 | Podaci programera i aplikacije | BLOCKED BY OWNER INPUT | vlasnik (nalog, verifikacija, kontakti) |
| BOTH-01 | Istinitost dozvola | BLOCKED BY PRODUCT WORK | tekst dozvole mikrofona ne odgovara ponašanju (LEG-18) |
| BOTH-02 | Istinitost listinga | NOT STARTED | ne postoji listing |
| BOTH-03 | Dokaz izdanja | NOT STARTED | ne postoji RC manifest, AAB ni IPA |

Zbir: 0 DONE · 14 NOT STARTED · 3 DRAFT EXISTS · 4 BLOCKED BY OWNER INPUT · 4 BLOCKED BY PRODUCT WORK · 3 N/A (APL-07, APL-12, GPL-12) = 28. APL-07 ostaje N/A samo dok se ne ponudi društvena prijava; APL-12 i GPL-12 samo dok je cena 0 RSD.

## 2. Apple (APL-01 do APL-12)

### APL-01 · Toolchain
- **Plan traži:** podržan Xcode/SDK/minimalni OS i stvaran iOS build; dokaz: metapodaci builda, pregled zavisnosti, ispravan upload.
- **Status: NOT STARTED.** Nijedan iOS build ne postoji; `scripts/check-eas-preview.cjs:67-68` odbija sve osim Androida; `ios.bundleIdentifier` nije postavljen (C-02, C-08, C-09); `docs/control/redovi.json`, blokada B12 „Nema iOS verzije”: OTVORENO.
- **Vlasnik dostavlja:** Apple Developer članstvo (lični ili organizacioni nalog), odluku o `bundleIdentifier` (OP-40), pristup App Store Connect za EAS Submit, iPhone za dokaz (plan 19.3). Organizacija zahteva pravno lice, D-U-N-S broj i javno funkcionalan sajt sa domenom organizacije. Pošto operater još nije registrovan (AF-D10, `docs/implementation/v5-ai-first/OPEN_INPUTS.md:47`), organizacioni nalog nije moguć pre registracije pravnog lica; lični nalog prikazuje lično zakonsko ime kao prodavca u App Store (provereno 2026-09-30, https://developer.apple.com/programs/enroll/). Izbor tipa naloga je zato vezan za odluku o pravnom obliku operatera (OP-01).
- **Može bez vlasnika:** pregled najniže iOS verzije koju podržavaju React Native 0.86.3 i Expo SDK 57 (paketi u `package.json`), nacrt iOS profila i izmene EAS pre-install provere (inženjerski posao, van ovog dokumenta), read-only provera toolchain-a (plan 5.2).
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/news/upcoming-requirements/): aplikacije koje se otpremaju u App Store Connect moraju biti izgrađene sa Xcode 26 ili novijim i SDK-om iOS 26 (važi od 28.04.2026.), a od 09.09.2026. moraju ciljati iOS 13 ili noviji. Plan 18.1 to navodi ispravno; stvarni minimum zavisnosti može biti viši (proveriti na artefaktu).
- **Članarina** (provereno 2026-09-30, https://developer.apple.com/programs/enroll/): 99 USD godišnje (cena po regionu u lokalnoj valuti). Da li je Srbija na listi zemalja za upis: PROVERITI pri upisu (stranice koje sam otvorio ne navode listu; rezultat pretrage sa developer.apple.com govori o upisu u više od 220 zemalja i regiona, ta stranica nije otvarana).

### APL-02 · App Privacy
- **Plan traži:** LEG-04/09/11/16, stvarni SDK i lanac provajdera; konačni odgovori i objavljena adresa politike koji odgovaraju izdanju.
- **Status: NOT STARTED** za odgovore (LEG-16); ulazi su DRAFT EXISTS: `LEG-09`, `LEG-11`, `LEG-12`, `LEG-18`.
- **Blokade:** (a) vlasnik: adresa politike privatnosti (C-41), podaci operatera (LEG-01), odluke o čuvanju (LEG-10, 12 odluka); (b) proizvod: dve odložene grane nisu integrisane (`d18e830a` minimizacija AI konteksta menja šta stvarno odlazi Google-u, `1ab01e78` usklađuje tehnički spisak obrađivača), pa konačni odgovori čekaju završni prolaz privatnosti (odluka vlasnika 2026-09-28); (c) nema obaveštenja pre prve tekstualne AI poruke (`LEG-12` N-01, N-02).
- **Vlasnik dostavlja:** adresu politike na domenu, odobrenje odgovora; odgovore unosi Account Holder, Admin ili App Manager u App Store Connect.
- **Može bez vlasnika:** tabela mapiranja stvarnih podataka (nalog, lokacija zadatka, fotografije i poruke, identifikator korisnika i push token, podrška) na Apple kategorije, sa oznakom „povezano sa identitetom” i „praćenje”, izvedena iz `LEG-09/11/12/18`; deo koji zavisi od odloženih grana posebno označiti.
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/app-store/app-privacy-details/): podaci su obavezni za nove aplikacije i update-e; adresa politike privatnosti je obavezna; moraju se navesti i podaci koje prikupljaju SDK-ovi i partneri; „prikupljanje” znači slanje van uređaja tako da se podatak čuva duže nego što traje sam zahtev; odgovori se mogu menjati bez novog builda.
- **Dopuna koju plan ne navodi izričito:** Apple pravilo 5.1.2(i) traži jasno obaveštenje i izričitu dozvolu pre deljenja ličnih podataka sa trećim licima, uključujući AI treće strane (provereno 2026-09-30, https://developer.apple.com/app-store/review/guidelines/). Aplikacija šalje tekst razgovora i fotografije zadatka Google Gemini-ju (`LEG-11` R-02), a obaveštenje pre prve tekstualne AI poruke ne postoji (`LEG-12` N-01). Uklopiti u APL-02 i BOTH-01, ne otvarati novu kontrolu.

### APL-03 · Privacy manifest
- **Plan traži:** LEG-18, stvaran `PrivacyInfo.xcprivacy` gde je potreban; sadržaj manifesta iz artefakta i popis SDK-ova.
- **Status: NOT STARTED** (nema iOS artefakta). Inventar iz konfiguracije: DRAFT EXISTS (`LEG-18`); `ios.privacyManifests` nije postavljeno u `app.json` ni `app.config.js` (C-53).
- **Vlasnik dostavlja:** ništa osim omogućavanja iOS builda (APL-01).
- **Može bez vlasnika:** koraci iz `LEG-18` §6 (tačke 4 do 6); provera da nijedna zavisnost nije na Apple listi SDK-ova koji traže manifest i potpis (u `package.json` nema Firebase, Facebook ni Google prijavnih SDK-ova; Expo i React Native moduli donose svoje manifeste, INFER).
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/news/upcoming-requirements/ i https://developer.apple.com/support/third-party-SDK-requirements/): od 01.05.2024. pri otpremanju moraju biti navedeni odobreni razlozi za API-je sa liste, uključujući one koje koriste SDK-ovi; SDK-ovi sa Apple liste moraju imati privacy manifest i potpis.

### APL-04 · Required Reason API
- **Plan traži:** opravdani razlozi za relevantne API-je, bez izmišljenih razloga i bez fingerprintinga; pregled native upotrebe i odgovarajući manifest.
- **Status: NOT STARTED** (isti razlog kao APL-03).
- **Vlasnik / bez vlasnika / zahtev:** kao APL-03. Odluke o razlozima se donose tek posle čitanja spojenog manifesta iz stvarnog IPA.

### APL-05 · Brisanje naloga
- **Plan traži:** N10 + LEG-08/10/15; pokretanje brisanja iz aplikacije, ne samo odjava; odobren disposable E2E, oporavak i stvaran rezultat.
- **Status: BLOCKED BY PRODUCT WORK (delimično).** Pokretanje u aplikaciji postoji (`src/ui/closure/ClosureDialog.tsx`, `src/data/accountClosureClientService.ts:86`, ekran Profil → Privatnost i podaci, `src/app/(app)/profil/privatnost.tsx`), a raspored radnika je aktivan (C-17; to nije dokaz stvarnog brisanja, blokada B07 u `docs/control/redovi.json`). Nedostaju: odobren E2E na disposable subjektu sa stvarnim rezultatom, oporavak na drugom uređaju bez lokalnog START identifikatora (red N10), odobreni rokovi čuvanja (LEG-10). Nacrt javne stranice: `LEG-08`.
- **Vlasnik dostavlja:** odobren disposable subjekat (nikad vlasnikov nalog), odluke o čuvanju (`LEG-10` §6), pregled `LEG-08`.
- **Može bez vlasnika:** scenario E2E i oporavka, spisak šta se briše a šta ostaje (`LEG-10`).
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/support/offering-account-deletion-in-your-app/): aplikacije sa kreiranjem naloga moraju dozvoliti da se brisanje pokrene u aplikaciji; deaktivacija nije dovoljna, briše se ceo nalog sa ličnim podacima; veza ka web stranici je dozvoljena samo za završetak; aplikacije van visoko regulisanih industrija ne smeju tražiti poziv, email ni druge tokove podrške; poštovati lokalne zakone o čuvanju.

### APL-06 · UGC moderacija
- **Plan traži:** N06/N07/N08 + LEG-05/14; prijava, blokiranje, obrada prijave i objavljen kontakt.
- **Status: BLOCKED BY OWNER INPUT.** U aplikaciji postoje prijava i blokiranje (`src/data/safetyClientService.ts:113,128`, ulaz „Prijavi ili blokiraj” na javnom profilu i zadatku; redovi N06, N07, N08 su DELIMIČNO). Nedostaju operater, red, eskalacija i javni kanal (LEG-14 NOT-STARTED, C-47). Nacrti: `LEG-05`, `LEG-07`. PROVERITI: postoji li filtriranje neprikladnog sadržaja poruka između korisnika; u kodu postoje AI pregled objave zadatka i klasifikator pitanja i odgovora (`LEG-11` R-02).
- **Vlasnik dostavlja:** odgovornu osobu (OP-07), prijemni kanal (OP-13) i javne kontakte (OP-10..OP-14).
- **Može bez vlasnika:** postupak obrade (ko, rok, eskalacija, trag odluke), probni scenario prijave, tekst pravila zajednice.
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/app-store/review/guidelines/, pravilo 1.2): aplikacije sa sadržajem korisnika moraju imati način filtriranja neprikladnog sadržaja, mehanizam prijave sa pravovremenim odgovorom, mogućnost blokiranja zlonamernih korisnika i objavljene kontakt podatke; programer je odgovoran da ukloni sadržaj koji krši pravila.

### APL-07 · Login services
- **Plan traži:** stvaran skup prijava; proveriti pravilo 4.8 kada je primenljiva prijava trećeg lica; aktivan iOS tok prijave i obrazloženje primenljivosti.
- **Status: N/A (obrazloženo).** Aplikacija nudi samo email prijavu: odluka AF-D16 (`docs/implementation/v5-ai-first/OPEN_INPUTS.md:37`), u `src/` nema `signInWithOAuth`, `signInWithIdToken` ni Google/Apple SDK-a (C-25). Nije PASS; važi samo dok se to ne promeni.
- **Vlasnik / bez vlasnika:** ništa; ako se ponudi Google ili druga društvena prijava, kontrola postaje primenljiva.
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/app-store/review/guidelines/, pravilo 4.8): kada aplikacija koristi prijavu trećeg lica ili društvenu prijavu za primarni nalog, mora ponuditi i „equivalent” drugu opciju prijave koja ograničava podatke na ime i email, dozvoljava skrivanje emaila i ne prati radi oglasa bez saglasnosti; aplikacije koje koriste isključivo sopstveni sistem naloga su izuzete. Sign in with Apple je jedna od mogućnosti, ne jedina.

### APL-08 · Pristup za recenzente
- **Plan traži:** dve korisničke namere dostupne recenzentu; važeći review nalozi i uputstva u bezbednoj konzoli; backend dostupan.
- **Status: NOT STARTED** (`docs/control/redovi.json`, `prodavnice`: „Pristup za recenzente: NIJE SPREMNO”; C-50).
- **Vlasnik dostavlja:** review naloge u produkcionom okruženju (ne u TEST-world), akreditive samo u App Store Connect, dostupan backend tokom pregleda.
- **Može bez vlasnika:** uputstvo za oba toka (zadatak → prijava → Dogovor, i radnik), plan seed podataka, napomene za recenzenta; email potvrda ne sme da blokira recenzenta (nalozi unapred potvrđeni).
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/app-store/review/guidelines/, pravilo 2.1): recenzent mora imati pun pristup; za funkcije sa nalogom daje se aktivan demo nalog ili potpun demo režim (demo režim umesto naloga traži prethodnu saglasnost Apple-a).

### APL-09 · Uzrast
- **Plan traži:** LEG-19 prema UGC-u, komunikaciji i AI mogućnostima; tačni odgovori, bez oslanjanja na stariji upitnik.
- **Status: NOT STARTED** (LEG-19). Odluka o uzrastu nije doneta (OP-30); RC2 predviđa 18+, a u aplikaciji nema provere uzrasta (`legal-drafts-20260930/README.md`, nalaz 4).
- **Vlasnik dostavlja:** odluku o uzrastu i zemljama.
- **Može bez vlasnika:** nacrt odgovora (sadržaj korisnika: da; poruke i razgovori: da; oglasi: ne; kockanje: ne); PROVERITI pitanje o neograničenom web pristupu (aplikacija otvara spoljne veze, ne prikazuje proizvoljan web sadržaj u sopstvenom pregledaču, INFER).
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/): skala je 4+, 9+, 13+, 16+ i 18+; upitnik pokriva kontrole u aplikaciji (roditeljske kontrole, provera uzrasta), mogućnosti (neograničen web pristup, sadržaj korisnika, društvene mreže, poruke i razgovori, oglasi), zrele teme, medicinske i wellness teme i ostalo; popunjava se za svaku aplikaciju; nova skala važi na uređajima sa iOS 26 i novijim.

### APL-10 · Screenshotovi i metapodaci
- **Plan traži:** LEG-20, stvaran završni izgled; screenshot format i uređaji provereni u konzoli; opis ne obećava nedostupno.
- **Status: NOT STARTED** (`prodavnice`: „Slike i opis u prodavnici: NIJE SPREMNO”). Proizvod: izgled nije zamrznut (P6 otvoren), iOS build ne postoji pa nema pravih iPhone snimaka.
- **Vlasnik dostavlja:** potvrdu naziva, opisa, ključnih reči, kategorije, zemalja i adresu podrške (C-42).
- **Može bez vlasnika:** plan snimaka, srpski tekstovi, napomene za recenzenta; ne predstavljati slike iz prototipa kao stvaran build (plan 5.2).
- **Spoljni zahtev:** tačni formati i uređaji za snimke nisu proveravani; PROVERITI u App Store Connect pri pripremi.

### APL-11 · Fizički posao
- **Plan traži:** jasno odvojena cena rada od usluge Platforme; uslovi i UI odgovaraju besplatnom launch-u i direktnom dogovoru strana.
- **Status: DRAFT EXISTS** (`LEG-02` §8 do 13 sadrži LEG-03). Blokada vlasnika: objava Uslova i potvrda besplatnog launch-a (OP-31).
- **Vlasnik dostavlja:** potvrdu da je launch besplatan i da se cena rada dogovara direktno između strana.
- **Može bez vlasnika:** pregled tekstova o ceni u aplikaciji naspram Uslova.
- **Spoljni zahtev** (provereno 2026-09-30, https://developer.apple.com/app-store/review/guidelines/, pravilo 3.1.3): usluge koje se koriste van aplikacije mogu se naplaćivati metodama različitim od kupovine u aplikaciji; pri besplatnom launch-u naplate nema.

### APL-12 · Digitalne funkcije
- **Plan traži:** klasifikacija buduće pretplate/otključavanja/boosta; za 0 RSD nema lažno aktivne prodaje; pre naplate poseban billing i regionalni pregled.
- **Status: N/A dok je cena 0 RSD.** Cenovnik je verzionisan na 0 RSD, serverski prekidač `platform_payments_enabled()` je isključen, nema payment SDK-a (C-55; `docs/implementation/v5-ai-first/pkg051/PKG051_PLATFORM_PRICE_LIST.md`). Nije PASS.
- **Vlasnik:** nova odluka pre bilo kakve naplate. Spoljni zahtev nije proveravan (nema plaćenih funkcija).

## 3. Google (GPL-01 do GPL-13)

### GPL-01 · Target API
- **Plan traži:** release AAB sa odgovarajućim target/compile okruženjem; manifest i metapodaci builda; relevantne native kompatibilnosti.
- **Status: NOT STARTED.** AAB ne postoji (`prodavnice`: „Potpisan Android AAB: NIJE DOKAZANO”). Indikativno: ranije CI gradnje su imale `targetSdk 36` i `minSdk 24` (`docs/implementation/execution/pkg017/PKG017_PHYSICAL_DEVICE_20260918.md:40`), ali to nije provera izdanja. Provera 16 KB poravnanja ne postoji nigde u repozitorijumu (C-52).
- **Vlasnik dostavlja:** EAS pristup za `eas build --profile production --platform android` (C-07), aplikaciju u Play Console sa paketom `rs.uskoci` (C-01), promenljive okruženja `production` (C-11, C-23).
- **Može bez vlasnika:** skript za proveru artefakta (aapt, bundletool, poravnanje ELF biblioteka), spisak provera spojenog manifesta.
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/11926878): od 31.08.2026. nove aplikacije i update-i moraju ciljati Android 16 (API 36) ili više; za postojeće aplikacije se zahtev za produženje do 01.11.2026. podnosi kroz Policy status u Play Console; postojeće aplikacije koje ne ciljaju bar API 35 nisu dostupne novim korisnicima na novijim verzijama Androida.
- **16 KB stranice memorije** (provereno 2026-09-30): https://developer.android.com/guide/practices/page-sizes (stranica ažurirana 2026-09-16) navodi da aplikacije koje ciljaju Android 15 i više moraju podržavati 16 KB na 64-bitnim uređajima i da se od 01.02.2027. update-i bez te podrške ne mogu izdati; https://support.google.com/googleplay/android-developer/answer/17492799 navodi da aplikacije sa native kodom moraju podržavati 16 KB i da native kod mora podržavati 64-bitne arhitekture. Provera: APK Analyzer, `check_elf_alignment.sh`, `zipalign -P 16` ili `bundletool dump config` (poravnanje 16K).
- **Play App Signing** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/9842756): novi projekti se automatski upisuju; upload key i app signing key su različiti; izgubljen upload key se resetuje kroz konzolu (C-07).

### GPL-02 · Data Safety
- **Plan traži:** LEG-17 iz stvarnog data i SDK inventara; konzola i Privacy usklađeni.
- **Status: NOT STARTED** (LEG-17); ulazi i blokade kao APL-02.
- **Vlasnik dostavlja:** adresu politike, potvrdu odgovora u Play Console.
- **Može bez vlasnika:** nacrt odgovora iz `LEG-09/11/12/18` (prikupljanje, deljenje, zaštita u prenosu, mogućnost zahteva brisanja); deo koji zavisi od odloženih grana posebno označiti.
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/10787469): obrazac popunjavaju svi programeri čije su aplikacije na zatvorenom, otvorenom ili produkcionom testu (izuzeti su samo aplikacije isključivo na internom testu, sistemski servisi i privatne aplikacije); adresa politike privatnosti je obavezna; obuhvataju se i podaci koje obrađuju biblioteke i SDK-ovi; programer odgovara za tačnost.

### GPL-03 · Politika privatnosti
- **Plan traži:** LEG-04 i pristup iz aplikacije; javni ispravan URL i stvaran sadržaj.
- **Status: DRAFT EXISTS** (`LEG-04`), **BLOCKED BY OWNER INPUT** (operater, domen, rokovi čuvanja). U aplikaciji Profil → Pravila i saglasnosti (`src/app/(app)/profil/pravna.tsx`) kaže da dokumenti nisu objavljeni; server ima 0 objavljenih dokumenata (C-21).
- **Vlasnik dostavlja:** podatke operatera (LEG-01), domen (OP-16), odobrenje teksta.
- **Može bez vlasnika:** postupak verzije i SHA-256 (`LEG-13` §5.6), tekst bez `[[...]]` polja kad podaci stignu.
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/9859455): politika privatnosti mora biti povezana sa stranicom aplikacije i unutar aplikacije za aplikacije sa osetljivim dozvolama.

### GPL-04 · Brisanje naloga
- **Plan traži:** N10 + LEG-08, put u aplikaciji i spoljni web put; oba ulaza i izvršavanje/oporavak bez curenja podataka.
- **Status: BLOCKED BY PRODUCT WORK.** Put u aplikaciji je delimičan (APL-05); **web put za zahtev ne postoji** (C-43; `prodavnice`: „Zahtev za brisanje preko veba: NIJE DOKAZANO”).
- **Vlasnik dostavlja:** odluku ko obrađuje zahtev van aplikacije i kako se potvrđuje identitet bez novih podataka (`LEG-08` §3), domen.
- **Može bez vlasnika:** dizajn stranice i obrasca, evidencija zahteva, veza sa istim postupkom zatvaranja.
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/13327111): aplikacije koje dozvoljavaju kreiranje naloga moraju imati put za brisanje u aplikaciji i adresu web resursa za zahtev brisanja, deklarisano u obrascu Data safety; zadržavanje podataka je dozvoljeno iz zakonitih razloga (bezbednost, prevare, propisi) uz objavu u politici. Rokovi iz 2023. i 2024. su istekli.

### GPL-05 · UGC uslovi i saglasnost
- **Plan traži:** LEG-02/05/13, prikaz i prihvatanje relevantnih pravila; verzionisana potvrda i oporavak; nema lažnog prihvatanja.
- **Status: BLOCKED BY PRODUCT WORK.** Prihvatanje ne traži nijedna komanda; registracija prikazuje samo „Ovo je test verzija…”; jedini pravi put je dobrovoljan (Profil → Pravila i saglasnosti) (`LEG-13` §1, §2). Uz to: objavljeni Uslovi ne postoje (BLOCKED BY OWNER INPUT). Nacrti `LEG-02`, `LEG-05`, `LEG-13` postoje.
- **Vlasnik dostavlja:** kada se traži prihvatanje i šta se dešava pri odbijanju (`LEG-13` §5 tačka 2), izjavu o uzrastu, objavljene Uslove.
- **Može bez vlasnika:** tekst; serverska kapija saglasnosti je inženjerski posao uz odobrenje, ne samo klijentska provera (`LEG-13` §4).
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/9876937): korisnici moraju prihvatiti uslove ili pravila pre kreiranja ili slanja sadržaja; uslovi definišu neprihvatljiv sadržaj; potrebna je stalna moderacija; potreban je sistem u aplikaciji za prijavu i blokiranje, a aplikacije sa interakcijom jedan na jedan moraju imati blokiranje korisnika.

### GPL-06 · Prijava, blokiranje, moderacija
- **Plan traži:** N06/N07/N08 + stvarna operativa; prijava stiže odgovornoj osobi i može se obraditi.
- **Status: BLOCKED BY OWNER INPUT** (isto kao APL-06; C-47). Spoljni zahtev: GPL-05.

### GPL-07 · Foto/video minimalni obim
- **Plan traži:** sistemski izbor fotografija i samo nužne dozvole prema stvarnoj upotrebi; release audit dozvola i test odbijanja i opoziva.
- **Status: NOT STARTED** (audit artefakta). Kod koristi sistemski izbornik: kamera traži samo dozvolu kamere, a biblioteka ide kroz `launchImageLibraryAsync` bez zahteva za dozvolu medija (`src/features/media/nativePhotoPicker.ts:31-38`). Spojeni manifest nije pročitan (`LEG-18` §2.3 tačka 5, C-35).
- **Vlasnik dostavlja:** ništa osim AAB-a (GPL-01).
- **Može bez vlasnika:** lista dozvola iz AAB-a (aapt2), scenario odbijanja i opoziva.
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/14115180): `READ_MEDIA_IMAGES` i `READ_MEDIA_VIDEO` sme da traži samo aplikacija kojoj sistemski izbornik ne omogućava osnovnu funkciju, uz obrazloženje u konzoli; rok usaglašavanja (28.05.2025.) je istekao.

### GPL-08 · IARC
- **Plan traži:** LEG-19, sadržaj i komunikacija izdavaoca; popunjen upitnik i rezultat u konzoli.
- **Status: NOT STARTED** (LEG-19). **Vlasnik:** odluka o uzrastu (kao APL-09) i unos odgovora. **Bez vlasnika:** nacrt odgovora (sadržaj korisnika, komunikacija, lokacija).
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/9859655): upitnik je obavezan za sve aplikacije; ponavlja se kada se sadržaj ili funkcije promene.

### GPL-09 · Ciljna publika
- **Plan traži:** stvarno izabrana publika i odgovarajući režim; deklaracija, tekst i funkcije usklađeni.
- **Status: BLOCKED BY OWNER INPUT** (odluka o uzrastu; RC2 predviđa 18+, u aplikaciji nema provere uzrasta). **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/9859455): ciljna uzrasna grupa se deklariše u odeljku „App content”.

### GPL-10 · Pristup za recenzente
- **Plan traži:** LEG-20, oba marketplace toka; ponovljiva prijava i jasne instrukcije bez spoljnog ručnog odobravanja svake radnje.
- **Status: NOT STARTED** (C-50). **Vlasnik:** akreditivi samo u Play Console (deklaracija pristupa aplikaciji). **Bez vlasnika:** uputstvo i seed podaci (kao APL-08).
- **Spoljni zahtev** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/9859455): ako je deo aplikacije ograničen prijavom, u konzoli se daju instrukcije za pristup.

### GPL-11 · Fizički posao
- **Plan traži:** odvojeno plaćanje stvarnog rada; UI i Terms ne mešaju cenu posla sa digitalnim otključavanjem.
- **Status: DRAFT EXISTS** (`LEG-02`); blokada vlasnika: objava Uslova. Spoljni zahtev nije posebno proveravan (nema naplate).

### GPL-12 · Digitalne funkcije
- **Status: N/A dok je cena 0 RSD** (kao APL-12). Pre naplate: posebna matrica monetizacije i pregled pravila Play Billing za tačan SKU i tržište (plan).

### GPL-13 · Podaci programera i aplikacije
- **Plan traži:** LEG-01/20, pravi podaci i spreman nalog; završene verifikacije i obavezna polja.
- **Status: BLOCKED BY OWNER INPUT.** Tip i stanje Google naloga nisu zabeleženi u repozitorijumu (C-54).
- **Vlasnik dostavlja:** tip naloga (lični ili organizacija), verifikaciju identiteta, jednokratnu naknadu, javne kontakte (email, telefon, sajt) i podatke operatera (OP-01..OP-16, OP-41). Pošto operater nije registrovan (AF-D10), organizacioni nalog zahteva prethodnu registraciju i D-U-N-S broj; lični nalog javno prikazuje vlasnikovo zakonsko ime, državu i email programera.
- **Može bez vlasnika:** spisak polja i tekst listinga.
- **Spoljni zahtev** (provereno 2026-09-30): Srbija je na listi za registraciju programera i trgovca (https://support.google.com/googleplay/android-developer/answer/9306917); jednokratna naknada je 25 USD (https://support.google.com/googleplay/android-developer/answer/14659200); organizacioni nalog traži D-U-N-S broj, lični ne (https://support.google.com/googleplay/android-developer/answer/13628312); za lični nalog javno se prikazuju zakonsko ime, država i email programera, a za organizaciju zakonsko ime, adresa, email i telefon (isti izvor); oba tipa naloga imaju iste funkcije i mogu naplaćivati (https://support.google.com/googleplay/android-developer/answer/13634885).

### Zatvoreno testiranje (deo BOTH-03 i plana 5.2, 18.1)
- **Status: NOT STARTED.** Tip Google naloga nije poznat, pa nije poznato da li se pravilo primenjuje.
- **Pravilo** (provereno 2026-09-30, https://support.google.com/googleplay/android-developer/answer/14151465): lični nalozi otvoreni posle 13.11.2023. moraju pre zahteva za produkcioni pristup imati zatvoreni test sa najmanje 12 testera koji su neprekidno uključeni najmanje 14 dana; interni test se ne računa; zahtev se podnosi iz Play Console, a obrada obično traje do sedam dana. Stranica pravilo opisuje samo za lične naloge; da organizacioni nalozi nisu obuhvaćeni je zaključak iz teksta, potvrditi u konzoli (INFER).
- **Vlasnik dostavlja:** najmanje 12 testera i način njihovog uključivanja (lista adresa ili grupa: proveriti u konzoli), tip naloga.
- **Može bez vlasnika:** uputstvo za testere, scenariji (oba toka, oporavak, push ako je uključen), obrazac za povratne informacije, plan praćenja 14 dana.
- **Redosled (INFER iz gornje dve stranice):** zatvoreni test traži popunjen obrazac Data safety i adresu politike privatnosti (GPL-02, GPL-03), pa je javna adresa politike na kritičnom putu pre početka 14-dnevnog brojanja. Najkraći razmak od početka brojanja do dobijanja produkcionog pristupa je zato 14 dana plus obrada zahteva (obično do sedam dana); to je računica iz gornjih činjenica, ne obećanje roka: Google ne garantuje odobrenje (plan 20.2).

## 4. Zajedničke kontrole

### BOTH-01 · Istinitost dozvola
- **Plan traži:** lokacija, mikrofon, fotografije/kamera i notifikacije imaju stvaran razlog; odbijanje ne postaje odobrenje.
- **Status: BLOCKED BY PRODUCT WORK.** Opis dozvole mikrofona ne odgovara ponašanju (puštanje odmah šalje tekst, opis kaže da se šalje tek na „Pošalji”), a iOS dobija deklaraciju mikrofona iako govorni modul postoji samo na Androidu (`LEG-18` §2.3 tačke 1 i 2, `LEG-12` N-03; C-35). Lokacija je usklađena (jedno očitavanje u prednjem planu, bez pozadinskih režima: `app.config.js:9,14-37`).
- **Vlasnik dostavlja:** odobrenje novih tekstova dozvola (`LEG-12`).
- **Može bez vlasnika:** predlozi tekstova (postoje), test matrica odbijanja i opoziva po dozvoli.
- **Spoljni zahtev:** Apple 5.1.2(i) (APL-02) i Google politike dozvola (GPL-07).

### BOTH-02 · Istinitost listinga
- **Plan traži:** opis, screenshotovi, demo i javna obećanja odgovaraju funkcijama dostupnim običnom korisniku.
- **Status: NOT STARTED** (listing ne postoji). Poznati rizici obećanja: govor ne postoji na iOS-u (C-31), govorne poruke između korisnika nisu isporučene, nema plaćanja, nema verifikovanih bedževa (identitet je samoprijavljen: `OPEN_INPUTS.md:28`).

### BOTH-03 · Dokaz izdanja
- **Plan traži:** tačan source, backend i odgovarajući Android/iOS artefakti imaju E2E, provider i store dokaz; COVERED_IN_SPEC nije izvršeno.
- **Status: NOT STARTED.** Ne postoji zamrznut RC manifest (plan 20.1), potpisan AAB ni IPA, ni dokaz iz prodavnice; `master-plan-live-state.json` ne upisuje broj PASS bez dokaza po kontroli.
- **Vlasnik dostavlja:** odobrenje kandidata, zemalja i trenutka submit-a (plan 20.2).

## 5. Šta postojeće kontrole ne navode izričito (predlog dopune postojećih, ne nova lista)

| Zahtev prodavnice | Gde se uklapa | Napomena (provereno 2026-09-30) |
|---|---|---|
| Izvozna usaglašenost šifrovanja (`ITSAppUsesNonExemptEncryption`) | APL-01 (metapodaci builda) | Apple (https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/ i rezultat pretrage koji navodi https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption): ključ u Info.plist preskače pitanja pri svakom uploadu; standardna šifra koju daje OS (npr. HTTPS) je obično izuzeta. U repozitorijumu nije postavljen (C-53). Odluku o vrednosti donosi vlasnik uz proveru. |
| Deljenje ličnih podataka sa AI trećih strana (pravilo 5.1.2(i)) | APL-02, BOTH-01, LEG-12 | vidi APL-02 |
| Deklaracija „Ads” u Play Console | GPL-02 / GPL-09 | Deklaracija o oglasima je deo odeljka „App content” (https://support.google.com/googleplay/android-developer/answer/9859455); aplikacija nema oglasne SDK-ove (LEG-18 §3). |
| Play App Signing | GPL-01, C-07 | vidi GPL-01 |
| Zatvoreno testiranje sa 12 testera | BOTH-03, plan 5.2 | vidi odeljak 3 |
| DSA status trgovca (EU) | APL-09/GPL-13, odluka o zemljama (OP-30) | Apple traži status trgovca za aplikacije distribuirane u EU (https://developer.apple.com/news/upcoming-requirements/). Za Google Play stranica koju sam otvorio to ne navodi: PROVERITI ako se nudi u EU. |
| Kvalitet u Play Console (crash 1,09%, ANR 0,47% ukupno) | BOTH-03 | https://support.google.com/googleplay/android-developer/answer/17492799: pragovi važe sada; mera je „user-perceived” stopa, potreban je monitoring posle izlaska (C-45, C-46). |

## 6. Datumi i rokovi koji će se menjati (ideja plana 18.1)

| Datum | Šta | Izvor (provereno 2026-09-30) |
|---|---|---|
| 31.01.2026. (prošao) | Apple: odgovori na novi upitnik o uzrastu | https://developer.apple.com/news/upcoming-requirements/ |
| 28.04.2026. (prošao) | Apple: Xcode 26 i iOS 26 SDK za otpremanje | isto |
| 31.08.2026. (prošao) | Google: nove aplikacije i update-i ciljaju API 36 | https://support.google.com/googleplay/android-developer/answer/11926878 |
| 09.09.2026. (prošao) | Apple: otpremljene iOS aplikacije moraju ciljati iOS 13 ili noviji | https://developer.apple.com/news/upcoming-requirements/ |
| 30.09.2026. (danas) | Google: provera programera za instalaciju na sertifikovanim uređajima u Brazilu, Indoneziji, Singapuru i Tajlandu; globalno 2027. Programeri koji distribuiraju samo preko Google Play uglavnom ne rade ništa dodatno ako su već verifikovani; Srbija nije u prvom talasu. Odnosi se na distribuciju APK-a van Play (npr. DEV APK sa GitHub-a) | https://developer.android.com/developer-verification/guides (stranica ažurirana 2026-08-18) |
| 01.11.2026. | Google: krajnji rok produženja za postojeće aplikacije koje su zatražile odlaganje | https://support.google.com/googleplay/android-developer/answer/11926878 |
| 01.02.2027. | Google: update-i bez podrške za 16 KB stranice ne mogu se izdati (aplikacije koje ciljaju API 35+) | https://developer.android.com/guide/practices/page-sizes (ažurirano 2026-09-16) |
| februar 2027. | Google Play kvalitet: optimizacija i skraćivanje koda (najmanje 25% za aplikacije sa više od 10 MB DEX koda) i novi pragovi memorije | https://support.google.com/googleplay/android-developer/answer/17492799 |
| april 2027. | Google Play: podrška za obnovu prijave bez dodira (Restore Credentials) za aplikacije sa prijavom | isto |

Pravilo Google-a o ciljnom API nivou ponavlja se svake godine; sledeći korak je INFER (Android 17, API 37) i mora se proveriti kad se objavi. Pravilo o 12 testera se već menjalo; ne pretpostavljati da ostaje.

## 7. Neslaganja i zastarele tvrdnje

1. **Registar `prodavnice`, red „Google / Apple prijava”:** „Ako se nudi Google, Apple zahteva i Apple prijavu.” Netačno pojednostavljeno: pravilo 4.8 zahteva ekvivalentnu opciju sa tri svojstva privatnosti, a Sign in with Apple je samo jedan od načina; postoje i izuzeci (isključivo sopstveni sistem naloga). Sam APL-07 u planu je ispravno formulisan (https://developer.apple.com/app-store/review/guidelines/). Trenutno nije primenljivo (C-25).
2. **Plan 5.2, red „Google zatvoreni test”:** „pokrenuti odgovarajući track čim postoji upotrebljiv kompatibilan build i konzola to dozvoli.” Nije netačno, ali nepotpuno: Google traži obrazac Data safety i adresu politike privatnosti i za zatvorene testove (samo interni test je izuzet), a plan te isporuke (LEG-04, LEG-17) stavlja pred kraj redosleda objave (16.3). Za lični nalog to je, po svemu sudeći, uslov za početak 14-dnevnog brojanja (INFER; činjenica o obrascu je sa https://support.google.com/googleplay/android-developer/answer/10787469, zaključak o redosledu nije proveren u konzoli).
3. **Plan 18.1 o 16 KB:** „Android release pregled treba da uključi i 16 KB page-size kompatibilnost native biblioteka prema važećim uputstvima”. Nije kontradikcija, ali nema datuma, a danas postoje dva zvanična izvora: stranica Play Console o tehničkom kvalitetu navodi da aplikacije sa native kodom moraju podržavati 16 KB (https://support.google.com/googleplay/android-developer/answer/17492799), a stranica Android Developers (ažurirana 2026-09-16) navodi 01.02.2027. kao datum posle kog se update-i bez te podrške ne mogu izdati (https://developer.android.com/guide/practices/page-sizes). Upisati oba u dokaz pregleda GPL-01.
4. **Plan 18.1 o ciljnom API nivou:** „Google od 31.08.2026. za nove obične mobilne aplikacije i update-e zahteva target Android 16/API 36 ili više”. Tačno (https://support.google.com/googleplay/android-developer/answer/11926878), ali izostavlja mogućnost produženja do 01.11.2026. i pravilo da postojeće aplikacije koje ne ciljaju bar API 35 nisu dostupne novim korisnicima na novijim verzijama Androida. Dopuna, ne kontradikcija.
5. **Plan 18.2 i 18.3** nemaju red za: izvoznu usaglašenost (Apple), pravilo 5.1.2(i) o deljenju podataka sa AI trećih strana (Apple), deklaraciju o oglasima i Play App Signing (Google). Uklopljeno u postojeće kontrole u odeljku 5.
6. **`docs/implementation/RELEASE_CHECKLIST_GOOGLE_PLAY_20260923.md` (linije 59-60):** „organizacioni nalozi su izuzeti” od pravila o 12 testera. Stranica Google-a pravilo opisuje samo za lične naloge; izuzeće za organizacije je razuman zaključak, ne izričita rečenica (INFER; potvrditi u konzoli).
7. **Registar `prodavnice`, red „Target/min SDK”** (stanje 16.09.: NEPOZNATO): delimično zastareo jer ranije gradnje (2026-09-12, 2026-09-18) pokazuju `targetSdk 36`; i dalje nije provera izdanja.
8. **Plan L02 (`USKOCI_APPLE_GOOGLE_RELEASE_GATES_2026-09-28.md`)** je naveden kao izvor oznaka, ali nije u repozitorijumu: oznake i opisi u ovom dokumentu potiču iz tabela plana.

### 7.1 Provereno kao usklađeno sa važećim pravilima (2026-09-30)

- Plan 18.1: „Apple navodi Xcode 26+ i iOS 26 SDK+ od 28.04.2026. i najmanje iOS 13 target za upload od 09.09.2026.” (https://developer.apple.com/news/upcoming-requirements/).
- Plan 18.1: „Za novi lični Google developer nalog obuhvaćen pravilom, otvoren posle 13.11.2023, potrebno je najmanje 12 testera neprekidno uključenih u zatvoreni test najmanje 14 dana pre zahteva za production pristup.” (https://support.google.com/googleplay/android-developer/answer/14151465).
- Plan 5.2, kolona „Ne sme se preuranjeno”: „Računati preuzimanje APK-a ili internal track kao izvršeni closed-test uslov.” Interni test se ne računa (isti izvor).
- Plan APL-05 i GPL-04 (brisanje u aplikaciji, uz spoljni web put za Google), APL-07 (pravilo 4.8 samo kada je primenljiva prijava trećeg lica), GPL-05 (prihvatanje pravila pre sadržaja korisnika), GPL-07 (sistemski izbor fotografija), APL-09 („bez oslanjanja na stariji upitnik”): opisi odgovaraju pravilima citiranim u odeljcima 2 i 3.

## 8. Šta ovaj dokument namerno ne radi

Ne piše odgovore za Data safety i App Privacy (to su LEG-16 i LEG-17 i čekaju vlasnika, završni prolaz privatnosti i stvarni artefakt). Ne daje pravno mišljenje. Ne objavljuje ništa niti kontaktira konzole. Redosled i rokovi su ovde tačni na 2026-09-30.
