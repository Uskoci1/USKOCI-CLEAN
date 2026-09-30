# USKOČI: scenariji za zatvoreno testiranje (J01 do J22)

| | |
|---|---|
| Status | **DRAFT for owner review.** Documentation only: nothing here was run, no account, device, build or backend was touched. Tester-facing text is in Serbian (Latin, "ti"); framing and every note marked **Owner note** is in English and must be removed before the cards are sent to testers. |
| Date | 2026-09-30 |
| Repository base read | branch `work/uskoci-ui-unification-20260924`, commit `e6490445` (read-only) |
| Live-state caveat | Statements about the DEV backend or the store build (legal registry rows, applied server packages, flags, Edge functions) come from `docs/control/dev_snapshot.json` (generated 2026-09-30T12:01Z, ledger 212, PKG045b applied at ledger 211, P6 rollout v3 applied at ledger 212), `docs/control/master-plan-live-state.json` and the master plan's 2026-09-29 DEV read. **Nothing was re-read live.** Re-check before submission. |
| Source of the scenario families | master plan `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html` chapter 19.2 (J01 to J22) and `docs/implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md` section 7.2. Each card is linked to the existing 32-step two-phone plan (I01 to I32 in `docs/control/redovi.json`, `test_dva_telefona`) and to the control rows; this file is **not** a third progress table (master plan 19.2). |
| Companion files | `STORE_LISTING_DRAFTS.md`, `DATA_DECLARATIONS_DRAFT.md`, `SCREENSHOT_PLAN.md`, `REVIEW_NOTES_DRAFT.md` |

## 1. Summary for the owner: what can be run today

Status legend: **RUNNABLE** (the flow exists in the current source, a tester can run it), **PARTIAL** (only part can be run by a non-technical tester, or it depends on something not yet set up), **BLOCKED** (cannot be run yet because a flow is not implemented, not applied, or not configured).

| Card | Scenario | Status | Why (evidence) |
|---|---|---|---|
| J01 | Sesija | RUNNABLE | expired-session case cannot be forced by hand |
| J02 | Email i oporavak | PARTIAL | email sender undefined (`legal-drafts-20260930/LEG-11` R-08, LEG-01 OP-43); control rows N02, N03 not accepted |
| J03 | AI, jedan lokalni zadatak | RUNNABLE | needs live AI provider and budget (control row A02; provider quality open) |
| J04 | Na daljinu / bez tačke | RUNNABLE | P6 grouping of remote and unlocated tasks still in progress |
| J05 | Više lokacija | PARTIAL | multi-stop correction is source-proven, native acceptance open (row A04) |
| J06 | Fotografije | RUNNABLE | native media acceptance open (row A05) |
| J07 | Pretraga, mapa, povratak | PARTIAL | P6 bounded reader not applied to the ordinary screen; the original "list disappears after return" defect is recorded as open (`AGENTS.md`, `docs/control/redovi.json` B04) |
| J08 | Ponuda, poređenje, izbor | RUNNABLE | earlier one-person remote journey passed (`docs/implementation/design-system/r18-continuity-20260925/REAL_JOURNEY.md`), full plan not |
| J09 | Poslednje mesto | PARTIAL | only the sequential variant is testable by hand; concurrency belongs to disposable CI proofs (runbook 7.2) |
| J10 | Izmene | RUNNABLE | source and CI exist, no phone evidence (row D06) |
| J11 | Završni statusi | PARTIAL | worker "done" has no phone evidence (D10); "close remaining search" (A15) is unverified |
| J12 | Poruke i prekid | PARTIAL | **voice messages are not implemented** (`docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md`: "VOICE UNSHIPPED"); text and photo can run |
| J13 | Istorija poruka | PARTIAL | needs a long conversation; native acceptance open |
| J14 | Push za istu poruku | **BLOCKED** | push is not configured for the store package `rs.uskoci` (`LEG-11` R-05) and exact-message routing was last recorded OFF |
| J15 | Profil, matching | PARTIAL | only eligibility can be seen by hand; dispatch and push cannot |
| J16 | Bezbednost, treći nalog | PARTIAL | reports are stored but nobody is assigned to receive them (LEG-14 not started) |
| J17 | Izvoz i zatvaranje naloga | **BLOCKED** (export), PARTIAL (closure) | export needs a published retention policy (`EXPORT_POLICY_NOT_READY`); closure can say "not available"; only disposable accounts may be used |
| J18 | Prekidi i A→B→A | RUNNABLE | account-isolation regressions have limited source proof only |
| J19 | Dozvole i mreža | RUNNABLE | |
| J20 | Obim i čitljivost | PARTIAL | large-volume part is a disposable-CI job, not a tester job |
| J21 | Nadogradnja | **BLOCKED** | needs two consecutive builds on the test track |
| J22 | Instalacija iz prodavnice | PARTIAL | Android only; no iOS build exists |

Three cards can only be **fully** run after something outside the app is decided or built: J14 (push), J17 (published retention policy) and J21 (a second build). Voice messages have no card of their own because the plan folds them into J12 and D03; the voice part of J12 is marked BLOCKED below.

## 2. How the closed test is organised (Google Play, fetched 2026-09-30)

- For a **personal** developer account created after **13 November 2023**, Google requires a **closed test with at least 12 testers opted in continuously for at least 14 days** before an application for production access; review "usually takes seven days or less" ([Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)). The account type and date are not confirmed anywhere in the repository (master plan 18.1, W03): `OWNER INPUT`.
- The master plan asks for **real feedback, not a formal waiting period** (18.1). Twelve testers means six pairs (A and B); the owner or a helper supplies the third account C for J16.
- iOS testing (TestFlight) is not possible until an iOS build with a bundle id exists (`app.json` has none).

**Suggested 14-day rhythm** (`INFERRED`, adjust freely): day 0 install and J22, J01; days 1 to 3 J02, J03, J04, J06; days 3 to 7 in pairs J08, J07, J10, J11, J12; days 7 to 10 J13, J15, J16, J18, J19, J20; days 10 to 14 J21 with a new build, J17 with disposable accounts, J14 only if push ships.

**Owner inputs for the test itself** (`OWNER INPUT`): the feedback channel (Play Console lets the developer set an email or URL for testers), how testers obtain accounts (self-registration needs a working confirmation email; pre-created accounts avoid that), which "world" the test accounts and tasks live in so testers see each other's tasks and no real user sees them (DEV owner accounts are in the TEST world, PKG-029e), and the paid-AI budget that J03 to J06 will consume.

## 3. Uputstvo za testere (Serbian, copy to the tester handout)

**Pre nego što počneš**

1. Instaliraj aplikaciju samo preko linka za zatvoreno testiranje koji si dobio/la. Ne instaliraj druge verzije.
2. Radiš u paru: **Osoba A** objavljuje zadatak, **Osoba B** nudi pomoć. Zapiši ko je ko. Neki scenariji traže i **Osobu C** (nalog koji ti daje organizator).
3. Aplikacija je na srpskom. Sistemski prozori (dozvole, podešavanja) su na jeziku tvog telefona. Veličinu slova menjaj samo kad kartica to traži.
4. U **Profil > O aplikaciji** vidiš verziju aplikacije. Upiši je u svaku prijavu problema.

**Pravila za podatke (važno)**

- **Ne unosi prave lične podatke drugih ljudi**: ni pravu adresu stana, ni telefon, ni imena komšija. Izmisli podatke ili izaberi javno mesto (park, trg).
- Tekst koji upišeš u razgovor sa asistentom obrađuje AI servis treće strane (Google). Zato ne upisuj ništa što ne bi podelio/la sa trećom stranom. `[[OWNER INPUT: uskladiti ovu rečenicu sa obaveštenjem u aplikaciji, LEG-12 N-01]]`
- Zadaci i poruke u testu služe samo za probu. Niko neće stvarno doći. Ne prijavljuj prave osobe; prijave probaj samo na testnim nalozima.
- Ne šalji lozinke, tokene ni privatne poruke u prijavi problema.
- **Ne zatvaraj svoj nalog** (Profil > Privatnost i podaci > Zatvaranje naloga) osim ako ti to kartica J17 izričito kaže i imaš poseban nalog za to.

**Kako prijaviš problem** `[[OWNER INPUT: kanal za povratne informacije]]`

```text
Scenario: (na primer J07)
Uređaj i verzija Androida: (na primer Samsung A54, Android 14)
Verzija aplikacije: (Profil > O aplikaciji)
Uloga: A / B / C
Šta si radio/la, korak po korak:
Šta si očekivao/la:
Šta se stvarno desilo:
Koliko često: uvek / ponekad / samo jednom
Vreme kad se desilo:
Snimak ekrana ili snimak ekrana u pokretu: (priloži)
```

Prijavi i kad nisi siguran/na da je greška. „Nije mi jasno šta da uradim” je važna povratna informacija.

## 4. Kartice scenarija

Svaka kartica ima: uloge, pripremu, korake, šta treba da vidiš, kada da prijaviš problem i veze sa planom. Redovi „Owner note” nisu za testere.

---

### J01 · Sesija: povratak, nova i istekla sesija

| | |
|---|---|
| Uloge i uređaji | jedna osoba, jedan telefon |
| Priprema | postojeći nalog i mreža |
| Veze | master plan J01; I02, I03, I29; redovi S01, N01 |

**Koraci**

1. Prijavi se (email i lozinka) i sačekaj da se otvori Početna.
2. Potpuno zatvori aplikaciju (prevuci je iz liste nedavnih aplikacija).
3. Otvori aplikaciju ponovo.
4. Otvori Profil (ikonica „Moj profil” gore levo) i izaberi „Odjavi se”.
5. Zatvori i ponovo otvori aplikaciju.
6. Prijavi se ponovo.

**Treba da vidiš**

- Posle koraka 3 dolaziš direktno na Početnu, bez ponovnog traženja lozinke i bez kratkog prikaza privatnih podataka pre nego što se sve učita.
- Posle koraka 5 vidiš ekran za prijavu, ne Početnu.
- Nema ekrana koji se beskonačno učitava.

**Prijavi ako** aplikacija ostane na učitavanju duže od nekoliko sekundi, ako te vrati na pogrešan ekran, ili ako na trenutak vidiš podatke drugog naloga.

**Owner note:** the expired-session case (token past its lifetime) cannot be forced by a tester; it belongs to the release-like build check (master plan J01, control row S01). Status: RUNNABLE.

---

### J02 · Email i oporavak: registracija, potvrda, ponovno slanje, lozinka

| | |
|---|---|
| Uloge i uređaji | jedna osoba, telefon i pristup svom email sandučetu |
| Priprema | tvoja stvarna email adresa (ili adresa koju ti da organizator); poruke mogu završiti u neželjenoj pošti |
| Veze | master plan J02; I02, I03; redovi N02, N03 |

**Koraci (registracija)**

1. Na prvom ekranu izaberi „Napravi nalog”.
2. Unesi ime, prezime, grad, email i lozinku (najmanje 6 znakova) i potvrdi.
3. Otvori svoj email, pronađi poruku od USKOČI-ja (proveri i neželjenu poštu) i otvori link za potvrdu **na istom telefonu**.
4. Proveri da li se otvara aplikacija USKOČI i da li možeš da se prijaviš.
5. Ako poruka ne stiže, u aplikaciji izaberi „Pošalji ponovo potvrdu” i proveri da li stiže nova. Ako piše da otvaranje novih naloga trenutno nije dostupno, koristi nalog koji ti je dao organizator.

**Koraci (zaboravljena lozinka)**

6. Na ekranu za prijavu izaberi „Zaboravljena lozinka?” i unesi email.
7. Izaberi „Pošalji link”, otvori poruku, otvori link i unesi novu lozinku.
8. Prijavi se novom lozinkom.
9. Otvori isti link ponovo posle nekoliko minuta.

**Treba da vidiš**

- Poruka stiže u razumnom roku; link otvara instaliranu aplikaciju, ne samo pregledač.
- Stari ili već iskorišćen link daje razumljivu poruku i način da zatražiš novi.
- Nema ekrana koji ostaje prazan posle povratka iz emaila.

**Prijavi ako** poruka ne stiže, link otvara samo pregledač, ili ne znaš šta dalje posle otvaranja linka.

**Owner note:** the sign-up screen still carries the sentence "Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog pokretanja." (`src/app/auth.tsx:389`), and the legal documents are not published, so real-inbox tests collect real email addresses before a privacy text exists. Status: PARTIAL until the sender is chosen and the text is published.

---

### J03 · AI: jedan lokalni zadatak (razgovor, pregled, objava)

| | |
|---|---|
| Uloge i uređaji | **Osoba A**, jedan telefon |
| Priprema | prijavljen nalog; izmišljen zadatak, na primer „Treba mi pomoć da sklopim ormar u subotu ujutru, oko dva sata”; javno mesto umesto kućne adrese |
| Veze | master plan J03; I06, I07, I09; redovi A02, A06, A07 |

**Koraci**

1. Na Početnoj izaberi „Objavi zadatak”.
2. Opiši zadatak svojim rečima i odgovori na pitanja asistenta.
3. Kad se pojavi oznaka „Spremno za pregled”, izaberi „Pregledaj zadatak”.
4. Proveri prikaz „Ovako će drugi videti zadatak”: naslov, termin, broj ljudi, cena ili „Tražim ponude”, i mesto.
5. Proveri da piše da se javno prikazuje samo približno mesto.
6. Izaberi „Objavi zadatak”.
7. Otvori karticu Zadaci i pronađi svoj zadatak (pin na mapi i kartica u listi).

**Treba da vidiš**

- Sve što si rekao/la asistentu vidiš na pregledu i možeš da ispraviš pre objave.
- Javno se vidi samo približno područje, ne tačna adresa ili napomene za ulaz.
- Posle objave dolaziš do svog stvarnog zadatka (pin i kartica), a Back te vraća tamo odakle si krenuo/la, ne u završen razgovor.

**Prijavi ako** asistent ponavlja ista pitanja, pogrešno razume datum, broj ljudi ili cenu, ako se tvoja izmena izgubi, ili ako se posle objave ne vidi tvoj zadatak.

**Owner note:** every run costs paid provider calls (`legal-drafts-20260930/LEG-11` R-02) and there is no manual path to create a task (LEG-12 N-01). Provider quality is still open (rows A02, B00). Status: RUNNABLE, budget permitting.

---

### J04 · Zadatak na daljinu ili bez tačke na mapi

| | |
|---|---|
| Uloge i uređaji | **Osoba A** objavljuje, **Osoba B** traži; dva telefona |
| Priprema | zadatak koji se radi na daljinu, na primer „Treba mi pomoć oko pregleda kratkog teksta, može na daljinu” |
| Veze | master plan J04; I06, I09, I10; redovi A07, B04 |

**Koraci**

1. A: napravi zadatak kroz asistenta i reci da se radi **na daljinu**.
2. A: na pregledu proveri da piše „Na daljinu” i da ne postoji izmišljena tačka na mapi. Objavi.
3. B: otvori Zadaci i potraži zadatak u grupi „Na daljinu” u listi; probaj i pretragu („Kako se radi”, pa „Na daljinu”).
4. B: otvori detalj zadatka.

**Treba da vidiš**

- Zadatak nema lažan pin, ali se jasno može naći u listi „Na daljinu”.
- Ne nestaje kada menjaš pretragu ili filtere.

**Prijavi ako** zadatak nije moguće naći, ako se pojavi pin na mestu na kome ne treba da bude, ili ako broj zadataka „na ovoj mapi” uključuje zadatke koji nisu na mapi.

**Owner note:** discovery of remote and unlocated tasks is the P6 grouping contract; the P6 reader is not yet applied to the ordinary screen. Status: RUNNABLE on the current reader.

---

### J05 · Više lokacija: stanice, ispravka, Back i nastavak

| | |
|---|---|
| Uloge i uređaji | **Osoba A**, a za deo o deljenju lokacije i **Osoba B**; telefoni |
| Priprema | zadatak sa dve stanice, na primer „Pokupi paket na pošti i donesi ga do ulaza zgrade”; **koristi javna mesta, ne pravu adresu** |
| Veze | master plan J05; I07, I22; redovi A04, D08 |

**Koraci**

1. A: opiši zadatak sa dve stanice asistentu.
2. A: kad asistent predloži mesta, otvori mapu i proveri da li su stanice u pravom redosledu.
3. A: pomeri jedan pin, potvrdi, pa izaberi Back i vrati se u razgovor.
4. A: na pregledu proveri da su obe stanice i dalje tu, u istom redosledu, sa istim ulogama (početno i završno mesto).
5. A: objavi zadatak. B: izaberi zadatak i sastavi prijavu (vidi J08). Kad se sklopi Dogovor, A otvara „Lokacija i pristup” i bira „Podeli lokaciju”.
6. B: pre deljenja proveri da ne vidiš tačne tačke; posle deljenja izaberi „Prikaži privatnu lokaciju” i probaj „Otvori navigaciju”. A: izaberi „Opozovi deljenje lokacije” i proveri da B više ne vidi tačke.

**Treba da vidiš**

- Redosled i uloge tačaka se čuvaju kroz ispravku i Back.
- Tačne tačke se ne vide dok ih A ne podeli; posle opoziva nestaju.
- Navigacija otvara spoljnu mapu samo posle tvog dodira.

**Prijavi ako** se tačke zamene, izgube ili se vide pre nego što su podeljene.

**Owner note:** multi-stop AI correction has source proof only, no accepted native run (row A04); private location sharing has no phone evidence (D08). Status: PARTIAL.

---

### J06 · Fotografije: prekinut upload i ponovno čitanje

| | |
|---|---|
| Uloge i uređaji | **Osoba A** i **Osoba B**; dva telefona |
| Priprema | dve fotografije koje si ti napravio/la (nameštaj, kutije, zid), bez lica i bez podataka o tebi |
| Veze | master plan J06; I08; redovi A05, D04 |

**Koraci**

1. A: tokom pravljenja zadatka izaberi „Fotografije zadatka” i dodaj jednu fotografiju.
2. A: dok se šalje druga fotografija, uključi mod rada u avionu na nekoliko sekundi, pa ga isključi.
3. A: vrati se u aplikaciju i proveri stanje. Ako piše da je slanje neuspešno, ponovi.
4. A: objavi zadatak.
5. B: otvori detalj zadatka i prelistaj fotografije na vrhu.
6. Zatim, u Dogovoru (vidi J08) A šalje jednu fotografiju u „Poruke”; B je otvara.

**Treba da vidiš**

- Nacrt i fotografije ostaju posle prekida; ponovni pokušaj ne pravi dvostruku fotografiju.
- Fotografije zadatka se vide samo u detalju zadatka (ne na mapi ni na karticama u listi).
- Fotografiju u poruci vide samo učesnici Dogovora.

**Prijavi ako** se fotografija duplira, izgubi, ako se vidi tuđa fotografija, ili ako je „poslato” a druga strana ništa ne vidi.

**Owner note:** the server re-encodes photos and strips location metadata (`supabase/functions/_shared/mediaImageSanitizer.mjs`); task photos may be sent to the AI provider for review when that switch is on (`LEG-11` R-02). Status: RUNNABLE.

---

### J07 · Pretraga, mapa, pin, lista i povratak

| | |
|---|---|
| Uloge i uređaji | **Osoba B**, jedan telefon; potrebno je bar 8 do 10 objavljenih zadataka u istom gradu |
| Priprema | organizator objavi zadatke; B ima nalog |
| Veze | master plan J07; I10, I11; redovi B04, B05, S03 |

**Koraci**

1. Otvori karticu Zadaci. Pomeri i približi mapu; proveri da se pinovi menjaju kako menjaš prikaz.
2. Izaberi polje za pretragu. Otvori „Gde”, „Kada”, „Kako se radi”, „Koliko vas dolazi” i „Cena”, izaberi uslove i izaberi „Prikaži … zadataka” (piše broj). Na kraju probaj „Obriši uslove”.
3. Dodirni jedan pin: pojavljuje se kartica zadatka. Dodirni drugi pin.
4. Povuci donji panel sa listom zadataka do vrha ekrana (otvara se cela lista) i skroluj.
5. Dodirni karticu i otvori detalj, pa se vrati unazad (Back).
6. Ponovi korake 4 i 5 pet puta zaredom.
7. Izaberi „U blizini”. Prvi put dozvoli lokaciju, a drugi put (posle promene u podešavanjima telefona) je odbij.

**Treba da vidiš**

- Isti uslovi, isti broj, ista pozicija mape, isti izabrani pin i ista pozicija liste posle povratka; ništa ne nestaje sa ekrana.
- Broj zadataka odgovara onome što se vidi; ako filteri ne daju rezultate, piše da nema zadataka za te uslove.
- Bez lokacije mapu pomeraš rukom ili tražiš mesto.

**Prijavi ako** posle povratka iz detalja nestane cela lista ili panel (to je poznat otvoren problem, prijavi svaki put kad ga vidiš), ako se pin i kartica ne poklapaju, ako se broj menja bez razloga, ili ako aplikacija zastane duže od nekoliko sekundi.

**Owner note:** P6 (bounded server reader) is open and not applied to this screen; "FULL list disappears after navigation return" is recorded as an open native defect (`docs/control/redovi.json` B04; AGENTS.md ROUND32). This is the card that should produce the most useful tester evidence. Status: PARTIAL.

---

### J08 · Posao sa dve strane: ponuda, poređenje, izbor

| | |
|---|---|
| Uloge i uređaji | **A**, **B** i po mogućstvu **C**; tri telefona (ili dva, C kasnije) |
| Priprema | objavljen zadatak koji je napravio A |
| Veze | master plan J08; I12, I13, I14, I15, I17, I19; redovi B06, B09, B10, A11, A12, D02 |

**Koraci**

1. B: Zadaci > izaberi zadatak > „Sastavi prijavu”.
2. B: unesi cenu (ili predloži termin i broj ljudi), izaberi „Pregledaj ponudu”, proveri sažetak i izaberi „Pošalji ovu Prijavu”.
3. B: proveri da piše „Prijava je poslata.” i da se ponuda vidi u „Moje prijave”.
4. C (ako postoji): pošalji drugu, drugačiju ponudu za isti zadatak.
5. A: Početna > „Moji zadaci” > zadatak > „Pregledaj prijave”; proveri da vidiš obe ponude.
6. A: izaberi „Uporedi prijave”, otvori profil osobe B, vrati se, i izaberi „Izaberi ovu ponudu”.
7. A i B: otvorite Dogovor (kartica Dogovori). Uporedite prihvaćene uslove: cena, termin, broj ljudi.

**Treba da vidiš**

- A vidi iste iznose i uslove koje je B poslao; nepoznata ocena ne izgleda kao nula.
- Posle izbora piše da je Dogovor sklopljen; obe osobe vide **iste** prihvaćene uslove.
- Ponudu osobe C više nije moguće izabrati ako nema slobodnih mesta.

**Prijavi ako** se iznos razlikuje kod dve strane, ako se Dogovor ne pojavi kod jedne osobe, ili ako pritisak na „Izaberi ovu ponudu” ništa ne uradi.

**Owner note:** a one-person remote journey was run earlier (R18 REAL_JOURNEY); the full 32-step plan was not. Status: RUNNABLE.

---

### J09 · Poslednje slobodno mesto

| | |
|---|---|
| Uloge i uređaji | **A**, **B**, **C**; tri telefona |
| Priprema | zadatak za **jednu** osobu i dve ponude (B i C) |
| Veze | master plan J09; I18; red A12 |

**Koraci**

1. B i C pošalju po jednu ponudu za isti zadatak (vidi J08).
2. A izabere ponudu osobe B.
3. C: osveži „Moje prijave” i otvori svoju ponudu.
4. A: vrati se na „Prijave” i pogledaj ponudu osobe C.

**Treba da vidiš**

- Za zadatak od jedne osobe nastaje tačno jedan Dogovor.
- C jasno vidi da više nema slobodnih mesta („Sva mesta su popunjena”), i ne dobija „prazan” Dogovor.
- Ponuda osobe C kod osobe A više ne može da se izabere.

**Prijavi ako** nastanu dva Dogovora, ili ako C misli da je izabran/a a nije.

**Owner note:** the concurrent variant (two selections at the same instant) is a disposable-CI proof, not a manual test (runbook 7.2: "Use disposable CI fixtures for large volume, negative/third-account and destructive cases"). Status: PARTIAL (sequential only).

---

### J10 · Izmene Dogovora: predlog, prihvatanje, odbijanje, povlačenje

| | |
|---|---|
| Uloge i uređaji | **A** i **B**; dva telefona |
| Priprema | postojeći Dogovor (vidi J08) |
| Veze | master plan J10; I23; red D06 |

**Koraci**

1. A: u Dogovoru izaberi „Izmene i otkazivanje Dogovora” i predloži drugu cenu ili termin.
2. B: otvori Dogovor, izaberi „Odgovori na predlog” i **odbij**.
3. A: predloži izmenu ponovo. B: **prihvati**.
4. A: predloži treću izmenu, pa je **povuci** pre nego što B odgovori.
5. Na oba telefona otvori pregled Dogovora i uporedi uslove.

**Treba da vidiš**

- Dok B ne prihvati, predlog nije prihvaćen uslov; prihvaćeni uslovi ostaju stari.
- Posle prihvatanja obe strane vide nove uslove; posle povlačenja predlog nestaje sa čekanja.
- Istorija („Tok Dogovora”) pokazuje šta se desilo.

**Prijavi ako** neko vidi uslove koje druga strana ne vidi, ako se stari predlog može prihvatiti, ili ako se tok ne vidi u istoriji.

**Owner note:** control row D06 has source and CI proof, no phone evidence. Status: RUNNABLE.

---

### J11 · Završni statusi: otkazivanje, zatvaranje potrage, završetak, ocena

| | |
|---|---|
| Uloge i uređaji | **A** i **B**; dva telefona |
| Priprema | dva odvojena Dogovora (jedan za završetak, jedan za otkazivanje); po želji zadatak za dve osobe |
| Veze | master plan J11; I25, I26, I27; redovi D07, D10, D11, D12, A15 |

**Koraci (završetak)**

1. B: u Dogovoru izaberi „Posao je gotov” i potvrdi.
2. A: otvori Dogovor; treba da piše da čeka tvoju potvrdu. Izaberi „Potvrdi završetak”.
3. A i B: izaberite „Oceni saradnju”, izaberite zvezdice i sačuvajte ocenu.
4. Pokušaj da oceniš ponovo.

**Koraci (otkazivanje)**

5. U drugom Dogovoru A bira „Izmene i otkazivanje Dogovora” i otkazuje uz razlog. B otvara Dogovor.

**Koraci (zatvaranje preostale potrage)**

6. A: u zadatku za dve osobe sa jednom izabranom osobom otvori meni „···” i izaberi „Ne traži više nikoga”; proveri šta se desilo sa izabranom osobom i sa ostalim prijavama.

**Treba da vidiš**

- Samo dozvoljeni prelazi; posle završetka i obe ocene Dogovor je završen i ne može se ponovo oceniti.
- Razlog otkazivanja se vidi drugoj strani; stanje ostaje trajno.
- Zatvaranje potrage ne menja već sklopljen Dogovor.

**Prijavi ako** se ocena upiše dvaput, ako jedna strana vidi drugačije stanje, ili ako dugme „Potvrdi završetak” postoji a ništa ne radi.

**Owner note:** worker completion has no phone evidence (D10: NIJE); "close remaining search" is listed as open (A15). Written rating comments do not exist and must not be tested (LEG-09 G-10). Status: PARTIAL.

---

### J12 · Poruke i prekid: tekst, slika, glas uz gubitak veze

| | |
|---|---|
| Uloge i uređaji | **A** i **B**; dva telefona |
| Priprema | postojeći Dogovor |
| Veze | master plan J12; I20, I21; redovi D03, D04, S03 |

**Koraci (tekst i slika: mogu odmah)**

1. A: otvori Dogovor > „Poruke” i pošalji kratku poruku. B: proveri da je stigla jednom.
2. A: uključi mod rada u avionu i pošalji još jednu poruku. Proveri kako je označena.
3. A: isključi mod rada u avionu i sačekaj.
4. A: pošalji fotografiju; prekini vezu tokom slanja pa je vrati.
5. B: otvori fotografiju.
6. A: pošalji poruku i odmah prebaci aplikaciju u pozadinu, pa se vrati posle pola minuta.

**Koraci (glas: još ne može)**

7. Glasovne poruke između korisnika **još ne postoje u aplikaciji**. Ne traži ih. Kad budu isporučene, ova kartica dobija korake za snimanje, pregled i slanje.

**Treba da vidiš**

- Poruka bez veze je jasno označena kao nepotvrđena, i ne izgleda kao poslata.
- Kad se veza vrati, poruka stiže tačno **jednom** (ne dvaput i ne nestaje).
- Fotografija ne duplira, i otvara se samo učesnicima Dogovora.

**Prijavi ako** se poruka duplira, izgubi, ili ostane „u toku” zauvek.

**Owner note:** voice messages are mandatory for V1 but unshipped (`docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md`: "VOICE UNSHIPPED"); D03 is not V1 done without them (master plan flow card D03). Status: PARTIAL (voice BLOCKED).

---

### J13 · Istorija poruka: čitanje starijih dok stižu nove

| | |
|---|---|
| Uloge i uređaji | **A** i **B**; dva telefona |
| Priprema | duga prepiska (bar 60 poruka): B pošalje brojeve „1”, „2”, „3” i tako redom |
| Veze | master plan J13; I20; red D03 |

**Koraci**

1. A: otvori Dogovor > „Poruke” i skroluj naviše do starijih poruka.
2. B: dok A čita, pošalji nekoliko novih poruka.
3. A: proveri da li te aplikacija sama vuče na dno.
4. A: potraži oznaku za nove poruke i dodirni je.
5. A: izađi iz razgovora i vrati se.

**Treba da vidiš**

- Dok čitaš starije poruke, ekran ostaje gde je; pojavljuje se oznaka da ima novih poruka.
- Kad se vratiš na dno, poruke koje si zaista video/la su pročitane; one koje nisi nisu.
- Listanje je tečno i na dugoj prepisci.

**Prijavi ako** te ekran sam skoči, ako se preskoče poruke, ili ako se poruke označe pročitane a nisi ih video/la.

**Owner note:** paged history (B3a) and the displayed-message read boundary are implemented; native acceptance is open. Status: PARTIAL.

---

### J14 · Push za istu poruku (hladan start, topao start, otvoren razgovor)

| | |
|---|---|
| Uloge i uređaji | **A** i **B**; dva Android telefona |
| Priprema | uključena obaveštenja u Profil > „Podešavanja obaveštenja” |
| Veze | master plan J14; I28; redovi P01 do P04 |

**Koraci (za kad funkcija bude dostupna)**

1. B: uključi obaveštenja i dozvoli ih u sistemu.
2. A: pošalji B-u novu poruku u Dogovoru.
3. B (aplikacija zatvorena): sačekaj obaveštenje na zaključanom ekranu i dodirni ga.
4. Ponovi kad je aplikacija u pozadini, pa kad je već otvoren isti razgovor.
5. Ponovi sa pogrešnim nalogom (B se prijavi kao C pre dodira).

**Treba da vidiš**

- Obaveštenje kaže samo da ima nova poruka, bez teksta poruke.
- Dodir otvara upravo taj Dogovor i tu poruku; sa pogrešnim nalogom ne otvara tuđu poruku.
- Otvoren razgovor ne pravi dvostruko obaveštenje.

**Owner note (BLOCKED):** the store package `rs.uskoci` has no Firebase configuration, the transport switch and the exact-message flag were last recorded OFF, and the same-message chain has never been proven (`legal-drafts-20260930/LEG-11` R-05; `AGENTS.md` P4). Do not send this card until push is part of the release; edit the store texts accordingly (`STORE_LISTING_DRAFTS.md` section 8).

---

### J15 · Radni profil i podobnost za zadatak

| | |
|---|---|
| Uloge i uređaji | **A** i **B**; dva telefona |
| Priprema | A objavi zadatak koji traži određen alat (na primer „bušilica”); B nema taj alat u profilu |
| Veze | master plan J15; I04; redovi B01, B02, B03, B00 |

**Koraci**

1. B: Profil > „Kako mogu da uskočim” > „Veštine, alat i tim”. Proveri da alat nije upisan.
2. B: pokušaj da sastaviš prijavu za zadatak koji traži alat. Zapiši šta se desi.
3. B: dodaj alat u profil (na primer „bušilica”), sačuvaj.
4. B: vrati se na zadatak i pokušaj ponovo.
5. B: promeni „Područje rada” (grad i poluprečnik) i „Dostupnost”, sačuvaj, i proveri da se promena zaista sačuvala (izađi i vrati se).

**Treba da vidiš**

- Bez potrebnog alata ne možeš da pošalješ prijavu (i aplikacija treba da kaže zašto); posle dopune profila možeš.
- Dozvole koje si sam/a naveo/la prikazane su kao tvoj navod, bez oznake „proveren”.
- Promena područja i dostupnosti ostaje sačuvana.

**Prijavi ako** nema promene u ponašanju posle dopune, ako aplikacija ne kaže zašto ne možeš da se prijaviš, ili ako vidiš oznaku „verifikovan”.

**Owner note:** only eligibility is visible to a tester; the worker AI interview (B00) and dispatch/notification are provider-, activation- and push-dependent (master plan 12.5). Status: PARTIAL.

---

### J16 · Bezbednost: prijava, blokiranje i treći nalog

| | |
|---|---|
| Uloge i uređaji | **A**, **B** i **C**; tri telefona ili tri prijave |
| Priprema | A i B imaju Dogovor; C nema nikakvu vezu sa njima; **koristi samo testne naloge** |
| Veze | master plan J16; I15, I16, I31; redovi N06, N07, N08, B08 |

**Koraci**

1. A: u „Pregledaj prijave” otvori javni profil osobe B i izaberi „Prijavi ili blokiraj osobu”. (B može isto da prijavi A preko menija „···” na zadatku.)
2. A: izaberi kategoriju, upiši kratak razlog i pošalji **privatnu prijavu**. Proveri poruku o prijemu.
3. A: u Dogovoru izaberi „Bezbednost i privatna prijava” i probaj **blokiranje**; proveri objašnjenje i posledice. Zatim otvori Profil > „Blokirani korisnici” i odblokiraj.
4. C: otvori Zadaci i pogledaj A-ov javni zadatak. Otvori javni profil osobe A.
5. C: pokušaj da nađeš Dogovor između A i B ili poruke u njemu (u „Dogovori” ne treba da postoji).
6. A: Profil > „Podrška” > novi zahtev sa temom „Prijava sadržaja ili recenzije”.

**Treba da vidiš**

- Prijava je privatna: druga strana ne vidi kategoriju, razlog ni opis.
- Blokiranje i odblokiranje rade i imaju razumljivo objašnjenje.
- C vidi samo javne podatke (približno mesto, naslov, javni profil), nikad tačnu adresu, poruke ili Dogovor.

**Prijavi ako** C vidi bilo šta privatno, ako prijava ostane „u toku” bez potvrde, ili ako piše da je poslata a nema traga.

**Owner note:** the reports are stored, but no operator is assigned and no public intake channel exists (LEG-14 not started; `docs/implementation/v5-ai-first/SUPPORT_CASE_CONTRACT_PROPOSAL.md`: the private-test operator is the project owner). "A report that reaches a person" cannot be verified by testers. The earlier finding that `public.needs` granted broad SELECT (LEG-09 G-09, finding 7.17) is addressed by PKG045b, applied on canonical DEV on 2026-09-30 (ledger 211, `docs/control/dev_snapshot.json:494`); the compatible client build must be the one on the test track, and the live grants were not re-read here. Status: PARTIAL.

---

### J17 · Izvoz podataka i zatvaranje naloga (samo poseban probni nalog)

| | |
|---|---|
| Uloge i uređaji | jedna osoba sa **posebnim, odbačivim nalogom** koji je organizator odobrio za ovu probu |
| Priprema | nalog bez aktivnih Dogovora, otvorenih zadataka i aktivnih prijava (ili sa njima, da vidiš spisak obaveza) |
| Veze | master plan J17; redovi N09, N10, N11 |

**Koraci (izvoz, kad postane dostupan)**

1. Profil > „Privatnost i podaci” > „Izvoz podataka”. Zatraži kopiju svojih podataka.
2. Kad bude spremna, preuzmi je i proveri da je tvoja (ne sme sadržati tuđe privatne podatke).

**Koraci (zatvaranje)**

3. Profil > „Privatnost i podaci” > „Zatvaranje naloga” > „Pripremi pregled”. Pročitaj obaveze i šta se dešava sa podacima.
4. Ako je nalog spreman, izaberi „Pokreni zatvaranje naloga” i potvrdi (ne može se poništiti iz aplikacije).
5. Izaberi „Proveri stanje zahteva”. Pokušaj da se prijaviš istim nalogom.

**Treba da vidiš**

- Pre zatvaranja vidiš šta moraš da završiš (aktivni Dogovori, otvoreni zadaci, aktivne prijave), sa vezom do mesta gde se to rešava.
- Posle zatvaranja aplikacija prikazuje potvrdu, a prijava više ne radi.

**Prijavi ako** ekran kaže da zatvaranje nije dostupno, ako se stanje ne menja, ili ako podaci ostanu vidljivi posle potvrđenog zatvaranja.

**Owner note (BLOCKED for export):** export needs a published Privacy Policy and a retention schedule with the export binding, otherwise the worker answers `EXPORT_POLICY_NOT_READY` (`legal-drafts-20260930/LEG-09` G-05). The closure screen can answer "Zatvaranje naloga trenutno nije dostupno. Potpuna pravila zatvaranja i čuvanja još nisu objavljena." (`src/ui/closure/ClosurePresentation.tsx:175-177`). Recovery on a second device (row N10) is an open engineering gap. Never use a real tester's or the owner's account (master plan 19.3: destructive tests use a disposable subject). Status: BLOCKED (export), PARTIAL (closure).

---

### J18 · Prekidi: A→B→A, pozadina, ubijena aplikacija, izgubljen odgovor

| | |
|---|---|
| Uloge i uređaji | jedna osoba sa **dva naloga** (A i B) na **jednom** telefonu |
| Priprema | dva naloga; u A započni razgovor sa asistentom ali ga ne šalji do kraja |
| Veze | master plan J18; I29, I30; redovi S02, S03 |

**Koraci**

1. Prijavi se kao A, otvori „Objavi zadatak” i upiši poruku, ali je ne šalji.
2. Odjavi se, prijavi kao B. Proveri da ne vidiš ništa od A (nacrt, fotografije, poruke).
3. U nalogu B započni radnju (na primer sastavi prijavu) pa se odjavi bez slanja.
4. Prijavi se ponovo kao A. Proveri da li je nacrt tu.
5. Tokom slanja neke radnje (objava, poruka) prebaci aplikaciju u pozadinu, zatim je potpuno zatvori i otvori.
6. Proveri da li je radnja jednom potvrđena ili jasno nepotvrđena, i da nema duplikata.

**Treba da vidiš**

- Ništa što pripada nalogu A ne pojavljuje se u nalogu B, ni na trenutak.
- Tvoj nacrt se vraća u istom nalogu; nema dupliranih radnji.

**Prijavi ako** vidiš bilo šta iz drugog naloga, ako se radnja izvrši dvaput, ili ako se izgubi.

**Owner note:** account-isolation regressions have limited source proof; the full A→B→A native run is open (row S02). Status: RUNNABLE.

---

### J19 · Dozvole i mreža: odbijanje, opoziv, bez interneta, spora veza

| | |
|---|---|
| Uloge i uređaji | jedna osoba, jedan telefon |
| Priprema | nalog; pristup podešavanjima telefona |
| Veze | master plan J19; redovi S03, P02 |

**Koraci**

1. Zadaci > „U blizini”: **odbij** dozvolu lokacije. Proveri poruku i da li možeš da tražiš mesto ili pomeraš mapu.
2. U podešavanjima telefona opozovi dozvolu za kameru; u aplikaciji probaj da dodaš fotografiju zadatka.
3. Ponovo dozvoli kameru i probaj.
4. Uključi mod rada u avionu i otvori Početnu, Zadaci i jedan Dogovor. Zapiši šta piše.
5. Isključi mod rada u avionu i izaberi „Pokušaj ponovo” gde postoji.
6. Na sporoj mreži (na primer na mestu sa lošim signalom) otvori Zadaci i pošalji poruku.

**Treba da vidiš**

- Odbijanje nikoga ne blokira: uvek postoji alternativa (ručni unos, pomeranje mape, zadatak bez fotografije).
- Bez veze piše jasno šta nije učitano i nudi „Pokušaj ponovo”; ne piše „nema zadataka” kada podaci zapravo nisu stigli.
- Ništa se ne šalje „polovično” i ne beleži kao poslato bez potvrde.

**Prijavi ako** aplikacija insistira na dozvoli, prikaže prazno stanje umesto greške, ili izgubi ono što si upisao/la.

**Owner note:** BOTH-01 permission truthfulness; the microphone string mismatch is a separate finding (`REVIEW_NOTES_DRAFT.md` C.2). Status: RUNNABLE.

---

### J20 · Obim i čitljivost: prazno, jedan, mnogo, dug tekst, veliki font, bez slike

| | |
|---|---|
| Uloge i uređaji | jedna osoba; jedan telefon |
| Priprema | novi nalog bez zadataka; sistemska veličina slova najveća, pa podrazumevana |
| Veze | master plan J20; redovi A01, A09, B04, D01 |

**Koraci**

1. Sa potpuno novim nalogom otvori Početnu, „Moji zadaci”, „Moje prijave” i Dogovori. Zapiši prazna stanja.
2. Napravi zadatak sa veoma dugim opisom i naslovom, i zadatak bez fotografije.
3. U podešavanjima telefona postavi najveći font i prođi Početnu, Zadaci, detalj zadatka, sastavljanje prijave i Dogovor.
4. Otvori Zadaci u oblasti u kojoj nema zadataka i u oblasti u kojoj ih ima mnogo.

**Treba da vidiš**

- Prazna stanja predlažu sledeći korak, ne izgledaju kao greška.
- Dugi tekst i veliki font ne seku važne rečenice ni dugmad; dugme za glavnu radnju je dostupno iznad tastature.
- Broj zadataka odgovara onome što se vidi.

**Prijavi ako** se tekst seče, dugme nije dostupno, ili broj ne odgovara.

**Owner note:** 0 / 1 / 50 / 1,000 / 3,000 rows are a disposable-CI dataset job (runbook P6 item 8: never bulk-seed the canonical DEV project); a tester covers the first three visually only. Status: PARTIAL.

---

### J21 · Nadogradnja sa prethodne verzije

| | |
|---|---|
| Uloge i uređaji | jedna osoba; jedan telefon |
| Priprema | dve uzastopne verzije na test kanalu (N-1 i N); instalirana starija verzija sa nalogom i podacima |
| Veze | master plan J21; I01 |

**Koraci**

1. Sa starijom verzijom napravi zadatak i Dogovor (ili koristi postojeće) i zapiši šta vidiš na Početnoj.
2. Ažuriraj aplikaciju preko prodavnice na novu verziju (bez brisanja podataka).
3. Otvori aplikaciju: proveri da si i dalje prijavljen/a i da su zadaci, prijave i Dogovori isti.
4. Otvori stari link iz emaila ili obaveštenja ako ga imaš.

**Treba da vidiš** da se sesija i podaci očuvaju i da stari linkovi rade.

**Owner note (BLOCKED):** needs two consecutive builds on the test track; nothing exists yet. Status: BLOCKED.

---

### J22 · Instalacija iz prodavnice

| | |
|---|---|
| Uloge i uređaji | jedna osoba; jedan Android telefon (iOS kasnije) |
| Priprema | link za zatvoreno testiranje; nalog na telefonu |
| Veze | master plan J22; I01, I32; blokade prodavnica |

**Koraci**

1. Otvori link za testiranje na telefonu i instaliraj iz Google Play-a (ne iz datoteke).
2. Proveri naziv i ikonicu aplikacije.
3. Otvori aplikaciju: ne treba da vidiš nikakve interne ekrane ni oznake „test”.
4. Registruj se ili prijavi (vidi J02) i otvori link za potvrdu iz emaila: treba da otvori instaliranu aplikaciju.
5. Prođi dozvole redom kojim se traže (lokacija samo posle „U blizini”, kamera samo pri dodavanju fotografije, obaveštenja samo kad ih uključiš).
6. U Profil > O aplikaciji zapiši verziju.

**Treba da vidiš**

- Instalacija iz prodavnice, pravi naziv i ikonica, dozvole samo kad su potrebne i sa opisom koji objašnjava zašto.
- Nikakvi razvojni ekrani ni banneri.

**Prijavi ako** vidiš ekran koji ne pripada običnom korisniku, poruku „test verzija”, ili dozvolu koja se traži bez razloga.

**Owner note:** Android only; no iOS build (no `ios.bundleIdentifier`). The line "Ovo je test verzija..." on the sign-up screen (`src/app/auth.tsx:389`) is a known text that reviewers would see. The `dizajn-*` internal routes answer "Nije dostupno." in this package (`SCREENSHOT_PLAN.md` section 2). Status: PARTIAL.

---

## 5. Coverage and limits of this document (owner-facing)

- All 22 scenario families (J01 to J22) have a card. Mapping to the 32-step two-phone plan: I01 (J21, J22), I02 and I03 (J01, J02), I04 (J15), I06 to I09 (J03 to J06), I10 and I11 (J04, J07), I12 to I19 (J08, J09; I15 and I16 also J16), I20 and I21 (J12, J13), I22 (J05), I23 (J10), I25 to I27 (J11), I28 (J14), I29 and I30 (J01, J18), I31 (J16), I32 (J22). J17, J19 and J20 have no step of their own in that plan (export and closure, permissions and network, volume cut across the whole plan).
- **I05** (manual task creation) and **I24** (group conversation) have no card: I05 was retired by decision (there is no manual path to create a task), and the group conversation needs three approved accounts and a real multi-member proof (row D05) that pairs of testers cannot provide.
- Passing a card on one phone is not acceptance. Measurement and receipt rules are in master plan 19.3 and 19.6 (one receipt per batch: source SHA, device and OS, network, expected and actual, log or video reference, and what is explicitly not covered).
- **Inputs still missing for the whole package** (`OWNER INPUT`): feedback channel, how testers obtain accounts, the "world" (TEST or real) the test accounts live in, the paid-AI budget, the names of the 12 testers, and confirmation of the Google account type and date.
