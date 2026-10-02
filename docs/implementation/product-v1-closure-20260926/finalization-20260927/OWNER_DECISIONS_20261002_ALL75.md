# Owner decisions of 2026-10-02: all 75 proposals accepted

**Status: DECIDED by the owner.** On 2026-10-02 between 2026-10-02T09:02:17.016Z and 2026-10-02T09:02:53.804Z (11:02 Belgrade time) the owner pressed "Prihvati sve predloge" on the private answering page https://claude.ai/artifact/9JRQthzUMM6M3qw4ZxCK2a and then wrote in chat: "A svih 75 sam prihvatio". The durable record is the page's database (collection `odgovori`, 75 documents, every one `tip: predlog`, `izbor` equal to the proposal, no notes), read back by Claude the same day. The questions, the options and the reasons are in `OWNER_QUESTIONS_AND_PROPOSALS_20261002.md`; this file is the decision record and what follows from it.

The same message said "Primeni, a SAD radi na android emulatoru". Reading, recorded so that it is not mistaken for more: (1) "Primeni" is taken as "put the accepted decisions to work now". It names no server package, so it is NOT the exact word that AGENTS.md 3.1.2 requires for any DEV/PROD application: no package is ready for application today and each will need its own "PRIMENI <ime paketa>" after an approval block. (2) "SAD radi na android emulatoru": native QA moves to the Android emulator (AGENTS.md 3.2.1, amended). (3) The phone stays the owner's: used only on his word "sad".

## The 75 decisions

| id | question | accepted option |
| --- | --- | --- |
| A01 | Kako se snima glasovna poruka u razgovoru o Dogovoru? | A: Držiš pa otpustiš i šalje se; pristupačni režim zadržava pregled |
| A02 | Tekst dozvole mikrofona za glasovne poruke | A: Prihvatam nacrt: „Mikrofon se koristi samo dok držiš dugme za snimanje glasovne poruke u razgovoru o Dogovoru.“ |
| A03 | Instalacija expo-audio (zvuk za glasovne poruke) | A: Da, odobravam instalaciju i premeštanje |
| A04 | Može li podrška da čuje prijavljenu glasovnu poruku? | A: Ne u V1; piše se kao poznato ograničenje |
| A05 | Šta znači „brisanje“ glasovne poruke? | A: To je dovoljno za V1 |
| A06 | Tekst koji vidi stara aplikacija: „Glasovna poruka. Ažuriraj aplikaciju da je poslušaš.“ | A: Prihvatam |
| A07 | Grupni čet: šta je dovoljno za V1? | A: Dovoljna je tekstualna grupa sa osvežavanjem na dodir |
| A08 | Probe sa porukama, fotografijama i glasom na DEV-u | A: Odobravam svaku probu posebno, kad sam u prozoru sa telefonom; unapred ništa |
| A09 | Odluka 16: komentar o osobi koju je autor blokirao | A: Osoba vidi komentar, lice autora je sakriveno i može da ga prijavi (funkcija bez pomeranja sertifikata) |
| A10 | Odluka 17: prosek i pojedinačne ocene uz komentar | A: Ostaje kako si odlučio (ocena se vidi uz tekst); u tekstovima ne obećavamo anonimnost |
| A11 | Odluka 7: jedna lista komentara pod oba lica osobe | B: Lista po ulozi: komentar o radniku samo pod radnikom, o tražiocu samo pod tražiocem (funkcija bez pomeranja sertifikata) |
| A12 | Kada se pisani komentar uključuje za ljude? | A: Uključi samo u DEV APK za test sa tvojim nalozima; prodavnica isključena dok ne bude pravnih tekstova |
| A13 | Zadatak sa samo jednom granicom vremena (samo „od“ ili samo „do“) | A: Poklapaj radnike čija dostupnost pokriva zadatu granicu; druga granica ostaje otvorena |
| A14 | „Sutra“ i „ove nedelje“: od kog dana se računa? | A: Jedna istina na serveru: od dana objave; ekran samo prikazuje |
| A15 | Elektro i vodoinstalaterski radovi: običan ili regulisan posao? | A: Ostaje „nepoznata vrsta“ dok ti ne odrediš politiku |
| A16 | Nove vrste poslova iz korpusa: rad na daljinu, postavljanje podova, kućni ljubimci, pakovanje | A: Ne dodaju se; ostaju „nepoznato“ dok ne pregledaš korpus |
| A17 | Šta zatvara meru „relevantno obaveštenje“ za EX-06? | A: Trajni događaj OPPORTUNITY_AVAILABLE koji stiže samo podobnim radnicima, vidi se u Inbox-u i otvara zadatak (bez push-a) |
| A18 | Budžet za plaćeni AI test (EX-06 korpus i živi lanac) | A: Nema plaćenih poziva dok ne dam provajdera, model, broj poziva, gornju granicu i naloge; korpus ostaje sintetički |
| A19 | Privatnost korpusa za AI | A: Potvrđujem: korpus je samo sintetički ili moji tekstovi; nijedan stvarni tekst korisnika ne ide provajderu |
| A20 | Sme li javni naslov, zaokružena udaljenost ili cena na zaključan ekran? | A: Ne: ostaje opšti tekst obaveštenja |
| A21 | HITNO (hitna objava) u V1? | A: Van V1; politika ostaje isključena |
| A22 | Podsetnik pre termina (P05) u V1? | A: Eksplicitno odložen posle V1 |
| A23 | Push: kako se uključuje (ako uopšte)? | A: Pripremi paket „jedan primalac, jedan događaj“ (kandidat, povratak, dokaz) umesto globalnog uključivanja i ispravi tu rečenicu u AGENTS.md |
| A24 | Zaostale push isporuke na DEV-u i primalac dokaza | A: Ne diraj ih; primalac dokaza je moj nalog; paket mora da zaobiđe nepovezane redove |
| A25 | Kada se EX-07 (Nalog) smatra gotovim? | A: Po meri reda: iskrene kontrole, jasni blokatori izdanja, pripremljene matrice i kandidati; dokaz sa telefona po kartici ide posebno |
| A26 | Šta sve pripada EX-07? | A: N01–N10, S01, S02 i bezbednosna polovina N06; D12 ostaje u EX-04; „Prijava pitanja“ je otkrivena granica; hub i pregled Dogovora idu u UI prolaz |
| A27 | N10: otkrivanje zatvaranja naloga sa drugog uređaja | A: Pripremi kandidata i dokaz; primena samo uz tvoj poseban „PRIMENI“ koji imenuje re-bind |
| A28 | Lični grad (N05): ko ga piše? | A: U V1 samo prikaz, bez olovke za izmenu |
| A29 | Obaveštenja o izvozu, odgovoru podrške i završetku zatvaranja | A: U V1 samo status u aplikaciji; kvote prijava ostaju kako je prihvaćeno (AF-D17) |
| A30 | Granica zatvaranja naloga sa slučajem podrške ili prijavom (AF-D22) | A: Prihvatam i javno objavljujem ovu granicu |
| A31 | Ko je operater podrške i bezbednosti? | A: Ja sam jedini operater; grant se postavlja tek na moj „PRIMENI“; test nalozi autor i treći tek uz moje odobrenje |
| A32 | Jednokratan nalog na DEV-u za pravi izvoz i zatvaranje | A: Da: jedan jednokratni nalog kad ti javim prozor |
| A33 | Pomoćne trake paralelno sa glavnim radom | A: Da, pokreni ih odmah |
| U01 | Boja ikona | A: Da: jedan ton, UI zelena #076E4E, uz A/B karticu na dizajn-tabli |
| U02 | Vrata na Početnoj | A: Fotografije na ograničenim belim vratima; FactArt crteži kao rezerva ako ti se ne dopadnu na telefonu |
| U03 | Ikona taba Dogovori | A: Zadrži mehurić sa štiklom; ponude dobijaju cenovnu etiketu; rukovanje se pokazuje kao A/B |
| U04 | Tab bar | A: Zalepljen pun širine 64 dp, samo ako geometrija lista Zadaci ostane ista |
| U05 | Redosled u Zadaci | A: Redosled sa servera ostaje, samo oznaka; bez menjanja redosleda |
| U06 | Dodir na traku u Zadaci | A: Jedan dodir vodi na punu listu; dugme Mapa nestaje pri skrolu |
| U07 | Podloga mape | A: Bez promene palete; jače ivice kontrola; tamnija podloga kao A/B |
| U08 | Prazno stanje u Zadaci | A: Zeleno primarno „Osveži zadatke“ (tiho „Dopuni radni profil“) |
| U09 | Catalog27 slike (tvoji crteži) | A: Povuci ih sa Podrška, Privatnost i Pravna dokumenta u korist FactArt-a; galerija ih zadržava |
| U10 | Haptika | A: Bez tika pri dodiru za navigaciju; tik samo za promene stanja i potvrđene ishode |
| U11 | Poruke u Dogovoru | A: Vidljiv tab „Poruke“ umesto ikone (menja raniju odluku tima R21) |
| U12 | Boja mog balona u razgovoru | A: Objedini sa brend zelenom #076E4E (beli tekst, isti kontrast) |
| U13 | Fotografija zadatka na kartici i cena na pinu mape | A: Ne za sada |
| U14 | Naslovi i cene tintom umesto zelenom | A: Zadrži zelene naslove (tvoj zapis: zeleni naslovi su izričito dobrodošli) |
| U15 | Dogovor kao tamna „šumska“ površina (#0E3D37) | A: Ne: Dogovor ostaje bela čitljiva površina; šumska kao A/B na tabli |
| U16 | Kapsule za akcije i segmente | A: Kapsula za segmente (tabove) da; akcije kao A/B |
| U17 | Cena u kapsuli na pinu | A: Kasnije (talas 7), kao A/B |
| U18 | Ravne ikone u tab baru | A: Da (talas 2.1 koristi ravni presek kad ikona nije izabrana) |
| U19 | Offline izvor (nova zavisnost za stanje mreže) | A: Ne sada; preporuka za kasnije |
| R01 | iOS u prvom izdanju? | A: Ne: prvo Android; iOS je zapisano ograničenje |
| R02 | Push u prvom izdanju prodavnice? | A: Ne (dok ne postoji Firebase aplikacija za rs.uskoci) |
| R03 | Besplatno 0 RSD ili naknada pre prvog javnog izdanja? | A: Besplatno 0 RSD u prvom izdanju; plaćanje posle |
| R04 | Produkcija: gde živi? | A: Novi zaseban Supabase projekat sa plaćenim planom i kopijama; DEV ostaje za test |
| R05 | Google Play nalog i paket | A: Potvrđujem rs.uskoci kao trajan paket; javljam tip naloga i datum otvaranja |
| R06 | Zemlje, minimalni uzrast i zabranjene vrste poslova | A: Srbija prvo; 18+ (dodaje se potvrda pri registraciji); spisak zabranjenih poslova pišem ja |
| R07 | Pravna forma i podaci operatera | A: Dajem podatke kad registrujem firmu; do tada ostaju [[OPERATER]] polja |
| R08 | Domen, hosting i javne stranice | A: Kupujem domen; stranice idu na njega; fascikla USKOCI-SAJT/Vercel je domaćin (potvrdi) |
| R09 | Pošiljalac mejla i Supabase Auth | A: Podesiću pošiljaoca (SPF, DKIM, DMARC) i Auth (Site URL, lista preusmeravanja) kad domen postoji; tim priprema listu polja |
| R10 | Rokovi čuvanja (12 odluka u LEG-10) i pravni pregled | A: Dajem uz pravnika; do tada mehanizam bez vrednosti |
| R11 | Pravni registar i saglasnost | A: Aneks Uslova; saglasnost pri prvom ulasku; bez saglasnosti nema pristupa; 18+ |
| R12 | Brisanje naloga bez aplikacije (veb) | A: Ručna obrada zahteva od operatera; identitet preko email adrese naloga; stranica se objavljuje tek kad domen postoji |
| R13 | Vidljivost padova i ANR-a | A: Samo konzole prodavnica u prvom izdanju (bez nove zavisnosti) |
| R14 | Geokoder i pločice mape za produkciju | A: Odluka pre javnog izdanja; do tada kao u internom testu |
| R15 | „U blizini“ (lokacija uređaja) | A: Da, ali tek kad osnovni tokovi prođu na telefonu |
| R16 | Plaćeni resursi | B: Odobravam pojedinačno, kad zatreba |
| R17 | Završni prolaz privatnosti (EX-08): kada? | A: Posle UI prolaza, pre zamrzavanja kandidata za izdanje |
| R18 | Javni repozitorijum i dva procurela Google ključa | A: Rotiram ili ograničavam oba ključa i prebacujem repozitorijum u privatan do izdanja |
| R19 | Konačna vizuelna referenca i tekstovi prodavnica | A: Odlučujem posle UI prolaza, kad je izgled zamrznut; pravi screenshotovi tek tada |
| R20 | Koje zastavice nosi javni build? | A: Samo zastavice dokazane na telefonu; D12 komentar isključen dok A12 nije zatvoren |
| R21 | Glasovne poruke u prvom izdanju: koje platforme? | A: Samo Android dok iOS ne postoji |
| T01 | Zatvaranje B22 (Reanimated) | A: Zatvori B22 kad probe prođu; ja prijavim rezultate, ti kažeš reč |
| T02 | Promenljiva repozitorijuma RNR01_PUBLISH_PATCHED | A: Postavi na „yes“ kad se B22 zatvori |

## What follows (by decision)

### Voice and chat (A01-A08, R21)

Hold-to-talk sends on release with the accessible review mode; the microphone text draft is approved; `expo-audio ~57.0.4` may be installed together with the Android dictation migration behind NativeSpeechAdapter and its 7-row parity list (AGENTS.md 3.1.5 amended); support cannot hear a reported voice message in V1 and that limit is written down; "brisanje" means discard before sending plus erasure at account closure; the old-client placeholder text stays; the group chat stays text-only with refresh on tap; voice is Android-only until iOS exists. Every probe that writes on DEV (messages, photos, voice rows) still needs his prior word, one by one (A08); the first voice row on DEV ends the proven clean revert of Voice B1.

### Written comment D12 (A09-A12)

A function-only follow-up candidate (working name D12a, certificate-neutral) shows the reviewed person the comment when the AUTHOR blocked them, with the author's face masked and the agreement id returned so they can report it, and makes the comment list role-scoped (a comment about the worker only under the worker profile, about the requester only under the requester profile). It needs its own disposable proof and its own approval block ("PRIMENI D12a"). The public aggregate stays next to the ratings and no text anywhere may promise anonymity. The client stays behind `EXPO_PUBLIC_D12_REVIEW_COMMENT`, switched ON only in DEV APKs (not in store builds) after review.

### Matching (A13-A22)

A task with one stored time bound matches workers whose availability covers that bound, without inventing the other (a function-only candidate, working name ex06c); "sutra" and "ove nedelje" are computed on the server from the publication day and the screen only displays (a client change); electrical, plumbing and the four new work kinds stay "unknown" (nothing is added to the eleven kinds); the EX-06 notification measure is the durable OPPORTUNITY_AVAILABLE event visible in the in-app Inbox; no paid AI call without provider, model, call count, ceiling and accounts from the owner; the corpus stays synthetic; no task text on the lock screen; HITNO is out of V1 and the P05 reminder is explicitly deferred (both become visible deferrals in the registry).

### Push (A23, A24, R02)

No push in the first store release. A single-target admission package (one owner device, one event; candidate, revert, postflight, disposable proof) is prepared for its own approval; the AGENTS.md 3.1.7 sentence about the "zero-device backlog retirement" is corrected (done); the 2 stale WORKER deliveries and the unsettled 2026-09-26 attempt on DEV are left untouched and the package must bypass them; the proof recipient is the owner's account.

### Account, support, law (A25-A33, R06-R12)

EX-07 closes on its row measure with explicit limits; its scope is N01-N10, S01, S02 and the safety half of N06; the N10 candidate (second-device closure discovery, certificate-moving) is prepared for its own approval block naming the re-bind; the personal city is display-only; export, support-reply and closure-complete stay in-app status only; the closure-exception limit (AF-D22) is accepted and will be published in the public text; the owner is the only support/safety operator (the DEV grant is a later "PRIMENI" with his key); a single disposable account for the real export and closure test: Claude cannot create accounts, so the owner creates it when the window is announced. The auxiliary lanes EX-05 S00-S05 and EX-09 S00-S11 run now. Release inputs stay the owner's: operator data and legal form, domain and hosting, mail sender and Supabase Auth settings, retention numbers with counsel, the closure of the 12 LEG-10 decisions; Serbia first, 18+; legal registry as an annex of the Terms with consent at first entry.

### Appearance (U01-U19)

The UI waves continue with the accepted defaults: one brand tone in small icons with the UI green #076E4E; photographs on bounded white Home doors (FactArt fallback); the bubble-and-check Dogovori icon stays and offers get a price-tag glyph; a docked full-width 64 dp tab bar only if the Zadaci sheet geometry stays unchanged; the server order of Zadaci stays; one tap on the strip opens the full list and the Mapa pill slides away on scroll; no map palette change (a darker ground only as A/B); a green primary "Osveži zadatke" on the empty Zadaci; Catalog27 PNGs retire from Podrška, Privatnost and Pravna dokumenta; haptics only for state changes and confirmed outcomes; a visible "Poruke" tab in the Dogovor workspace; the own chat bubble becomes #076E4E; no task photo on cards and no price label on pins for now; titles and prices stay green (ink titles rejected), the Dogovor stays a white reading surface, capsule segments yes and capsule actions as A/B, the price-capsule pin later as A/B, flat tab icons, no offline-source dependency now.

### Release and money (R01-R05, R13-R20)

Android first and iOS an explicit limit; free launch at 0 RSD with the payment questions P1-P12 postponed; production will be a NEW separate Supabase project with a paid plan and backups (the owner creates it: it is his account and his cost), DEV stays test and the TEST world (pkg029e) is removed before real users; package `rs.uskoci` is permanent; crash visibility through the store consoles only; geocoder and map tiles are chosen before the public release; "U blizini" (`expo-location`) only after the core flows pass on a phone; paid resources are approved one by one, never by category (R16); the final privacy pass (EX-08) runs after the UI pass and before the release candidate is frozen; the public repository and the two leaked Google keys are the owner's hygiene action; store texts and screenshots wait for the frozen look; the public build carries only flags proven on a phone (D12 comment off until the legal texts exist).

### B22 (T01, T02)

B22 closes after the animation probes P1, P2 and P4 pass and the owner says the word (the probes now run on the emulator, labelled as AVD evidence); after that the repository variable RNR01_PUBLISH_PATCHED is set to "yes" so the published dev APK carries the patch.

## What this does NOT authorize

- No server, Edge or certificate application: each package needs its own exact "PRIMENI <ime>" after its approval block (AGENTS.md 3.1.2, 3.1.4). The decisions above only say which packages to PREPARE.
- No DEV or PROD write by an agent, no account creation by an agent, no password typed by an agent, no paid call, no purchase, no publication, no store action.
- No use of the HONOR without his word "sad". The Android emulator is used from now on; signing in on it is his own action.
- Nothing here marks any flow DONE: phone/emulator evidence per build is still the measure (AGENTS.md 3.2).
