# USKOČI - Brisanje naloga i podataka

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-08 (master plan 16.2: kako se pokreće u aplikaciji i van nje, potvrda identiteta, očekivani tok, šta se briše i šta opravdano ostaje; adresa radi bez instalirane aplikacije, ne objavljuje tuđe podatke) |
| Status | DRAFT-FROM-RC2 uz proveru stvarnog koda; putanja van aplikacije **ne postoji** i treba je osmisliti |
| Osnova | RC2 Privacy §17 („in-app account deletion initiation; spoljašnji web deletion request za Google Play; backend workflow; pravila aktivnih Dogovora; retention exemptions; potvrda izvršenog zahteva; DSR ticket/audit”), tekst ekrana „Zatvaranje naloga” u aplikaciji |
| Javna adresa | `[[OPERATER: HTTPS adresa ove stranice, LEG-01 OP-16]]`; ova adresa se navodi u Google Play konzoli (obrazac o bezbednosti podataka) i u opisu aplikacije `[[PROVERITI u konzoli: tačni zahtevi za sadržaj stranice]]` |
| Verzija / stupanje na snagu | `[[ODLUKA VLASNIKA: oznaka verzije i datum]]` |
| Uklanja se pre objave | ova tabela, oznake `[[...]]` i „Prilog: sledljivost” |

**OSVEŽENO 2026-10-02 (EX-07, slice S04):** zabeleženo je šta zatvaranje danas radi sa komentarom uz ocenu i glasovnim porukama i da zatvaranje staje kod izuzetaka (nema postupka oslobađanja ni poništavanja). Putanja van aplikacije i dalje **ne postoji**. Raniji tekst je zadržan; zamenjena napomena je označena „SUPERSEDED 2026-10-02”. Nacrt nije objavljen.


**Oznake:** `[[OPERATER: ...]]`, `[[ODLUKA VLASNIKA: ...]]`, `[[PROVERITI: ...]]` kao u LEG-02.

Ova stranica mora da radi bez instalirane aplikacije i ne sme da prikaže ničije podatke.

---

## 1. Ko može da zatraži brisanje

Brisanje naloga USKOČI može da zatraži samo vlasnik naloga. Zahtev se odnosi na nalog i podatke tog naloga; ne odnosi se na podatke druge osobe.

## 2. Kako se zahtev pokreće u aplikaciji

1. Prijavite se u aplikaciju USKOČI.
2. Otvorite **Profil - Privatnost i podaci - Zatvaranje naloga**.
3. Izaberite **Pripremi pregled**. Pregled pokazuje obaveze koje prvo morate da rešite i šta se dešava sa podacima.
4. Kada nema obaveza, izaberite **Pokreni zatvaranje naloga** i potvrdite.
5. Pratite stanje na istom ekranu (**Proveri stanje zahteva**). Ako se veza prekine, isti zahtev ostaje sačuvan i možete ga izričito ponoviti; zahtev se ne pravi dvaput.

Pre zatvaranja možete zatražiti kopiju svojih podataka (Profil - Privatnost i podaci - Izvoz podataka). `[[PROVERITI: izvoz je dostupan tek kada se objave pravila čuvanja; LEG-10]]`

## 3. Kako se zahtev pokreće van aplikacije

Ako ne možete da uđete u aplikaciju (na primer, izgubili ste uređaj ili ste je deinstalirali), zahtev za brisanje naloga možete podneti ovde: `[[OPERATER: obrazac ili email za zahtev za brisanje naloga]]`.

Da biste podneli zahtev, navedite email adresu naloga. Radi zaštite naloga, potvrdićemo da zahtev dolazi od vlasnika naloga (na primer, porukom na tu email adresu), a nećemo tražiti više podataka nego što je neophodno. Zahtev dobija evidencioni broj i potvrdu prijema; o ishodu vas obaveštavamo u roku od `[[OPERATER: rok odgovora]]`.

`[[ODLUKA VLASNIKA: postupak za osobu koja nema pristup nalogu ne postoji u aplikaciji ni u bazi; potrebno je odrediti ko ga obrađuje, kako se potvrđuje identitet bez novih podataka, kako se pokreće isto zatvaranje kao u aplikaciji (isti postupak i ista potvrda izvršenja) i kako se beleži evidencija (DSR ticket); LEG-15]]`

> **INTERNO - NAPOMENA 2026-10-02 (odluka vlasnika R12, `docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`; ukloniti pre objave):** ODLUČENO: zahteve za brisanje bez pristupa aplikaciji ručno obrađuje operater, identitet se proverava preko email adrese naloga, a stranica se objavljuje tek kada domen postoji. Ništa još nije objavljeno. Ostaje otvoreno i ostaje `[[OPERATER: ...]]`: ko je operater, obrazac ili email, tačan postupak provere, evidencija zahteva (DSR) i rok odgovora (LEG-01 OP-33, OP-53..OP-55; LEG-15 odeljak 4).

## 4. Šta mora da se završi pre zatvaranja

Zatvaranje se ne pokreće dok postoje:

- aktivni Dogovori (najpre ih završite);
- otvoreni zadaci (najpre ih zatvorite);
- aktivne prijave (najpre ih povucite ili završite);
- započeta obrada koja još nije završena;
- aktivno zadržavanje podataka koje sprečava zatvaranje;
- otpremanje fotografije ili datoteke čiji ishod još nije potvrđen.

Na ekranu „Zatvaranje naloga” svaka obaveza je navedena, sa vezom do mesta gde se rešava.

## 5. Šta se dešava i šta se briše

Zatvaranje ograničava pristup nalogu. Zatim se:

- brišu nezaštićene fotografije i datoteke naloga;
- uklanjaju obični lični i privatni podaci aplikacije (na primer: identifikatori profila, tekst poruka i činjenica koje ste napisali, tačna geografija, kopije ocena, prijava i potvrda, izvezena kopija podataka);
- uklanjaju podaci za prijavu (email, telefon, lozinka) i završavaju sesije.

Kada je zatvaranje završeno, aplikacija prikazuje potvrdu. Mrežni odgovor bez potvrde ne znači da su podaci obrisani.

**Pokrenuto zatvaranje ne možete poništiti iz aplikacije.**

**DOPUNA 2026-10-02 (odeljak 5; javni tekst, nacrt):** Uklanjaju se i komentar uz ocenu koji ste napisali i vaše glasovne poruke (datoteke i veza sa porukom). Ocena (zvezdice) ostaje u pseudonimnom obliku, a komentar koji su drugi napisali o vama ostaje skriven od prikaza dok njegov autor ne zatvori svoj nalog `[[ODLUKA VLASNIKA: rok čuvanja, LEG-10 odluka 14]]`. Izvor: LEG-10 odeljak 7.3.


## 6. Šta ostaje i zašto

- **Minimalni pseudonimni zapisi** potrebni za potvrde radnji i tehničku evidenciju (nasumični identifikator naloga bez ličnih podataka, zapisi o izvršenim radnjama). Rok čuvanja: `[[ODLUKA VLASNIKA: rok i osnov, LEG-10 redovi 1, 14]]`.
- **Sadržaj koji je napisala druga strana Dogovora** i zajednička evidencija Dogovora (pri čemu se vaši lični podaci u njoj uklanjaju). Nije predmet vašeg brisanja.
- **Izdvojeni dokazi koji se zasebno razmatraju** (na primer, bezbednosne prijave, slučajevi podrške, zaštićene fotografije kao dokaz, odluke koje koristi i drugi nalog). Ako takvi dokazi postoje, konačno zatvaranje može da sačeka njihovu proveru; u tom slučaju se možete obratiti podršci. Rok i osnov: `[[ODLUKA VLASNIKA: LEG-10 red 15]]`.
- **Podaci koje moramo da zadržimo zbog zakona ili odbrane pravnih zahteva**, samo koliko je neophodno i sa objašnjenim osnovom `[[PROVERITI: pravni pregled]]`.

**DOPUNA 2026-10-02 (odeljak 6, izuzeci; javni tekst, nacrt):** Ako nalog ima predmet podrške ili bezbednosnu prijavu (kao podnosilac ili kao osoba na koju se prijava odnosi), aktivno zadržavanje razgovora, zaštićen Dogovor ili zaštićenu fotografiju, zatvaranje se ne završava: obični podaci i datoteke se uklone i pristup se ograniči, ali nalog za prijavu ostaje dok se izuzetak ne reši. USKOČI danas nema postupak ni rok za rešavanje izuzetka, a pokrenuto zatvaranje ne može da se poništi iz aplikacije. `[[ODLUKA VLASNIKA: pravila i rokovi za izuzetke, LEG-10 odluka 5 i 15]]` `[[OPERATER: ko odlučuje o oslobađanju izuzetka, LEG-01 OP-56]]`

> **INTERNO - NAPOMENA 2026-10-02 (odluka vlasnika A30, `docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`; ukloniti pre objave):** ODLUČENO: vlasnik prihvata ovu granicu (nalog sa predmetom podrške ili prijavom ostaje u stanju `EXCEPTIONS_PENDING`) i objavljuje je u javnom tekstu; ništa još nije objavljeno, a tekst ostaje NACRT do pravnog pregleda. Oznake `[[ODLUKA VLASNIKA: ...]]` i `[[OPERATER: ...]]` iznad ostaju samo za ono što A30 ne rešava: pravila oslobađanja izuzetka, rokove, čuvanje dokaza i ko odlučuje o oslobađanju (LEG-10 odluke 5 i 15; LEG-01 OP-56).


## 7. Kopije kod davalaca usluga i rezervne kopije

Brisanje u aplikaciji ne znači istovremeno brisanje kopija koje čuvaju davaoci usluga (na primer, bezbednosni zapisi AI servisa, rezervne kopije baze) prema svojim pravilima i rokovima. `[[PROVERITI: rokovi po davaocu, LEG-10 odeljak 5, LEG-11]]` Opis obrade i davalaca je u Politici privatnosti.

## 8. Šta se dešava sa vašim javnim podacima

Lični podaci u vašem profilu se uklanjaju (odeljak 5). Ono što je druga strana već videla ili sačuvala u svom nalogu (na primer, poruke koje vam je pisala, ili njen sopstveni zapis Dogovora) ostaje u njenom nalogu u meri opisanoj u odeljku 6. `[[PROVERITI: kako se uklonjen profil prikazuje drugim korisnicima u postojećim Dogovorima]]`

## 9. Koliko traje

Zahtev ulazi u red za obradu; pristup je ograničen dok se proverava i završava. Uklanjanje se izvršava u koracima i završava tek posle svih provera. `[[OPERATER: očekivano trajanje ili izjava da ono zavisi od izdvojenih dokaza]]`

## 10. Vaša druga prava

Pored brisanja imate pravo na pristup, ispravku, ograničenje obrade, prigovor i prenosivost podataka, tamo gde se primenjuju (Politika privatnosti, odeljak 15). Zahtevi: `[[OPERATER: email ili obrazac za privatnost]]`. Imate pravo i na pritužbu nadležnom organu (Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti).

## 11. Kontakt

Pitanja o brisanju naloga: `[[OPERATER: email ili obrazac]]`. Poštanska adresa: `[[OPERATER: adresa]]`.

---

## Prilog: sledljivost (INTERNO - ukloniti pre objave)

| Odeljak | Izvor |
|---|---|
| 2 | `src/ui/closure/ClosurePresentation.tsx:48,86,171,196-202` (nazivi radnji „Pripremi pregled”, „Pokreni zatvaranje naloga”, „Proveri stanje zahteva”); `src/app/(app)/profil/privatnost.tsx:44` („Privatnost i podaci”); `docs/implementation/v5-ai-first/CLOSURE_EXECUTOR.md` („Native command and recovery”: sačuvan ključ, isti zahtev se ne pravi dvaput) |
| 3 | RC2 Privacy §16-17; master plan LEG-08, APL-05, GPL-04; nema izvora u kodu (nema web puta) |
| 4 | `src/data/closureExecutionClientService.ts:6` (`closureBlockerLabels`) |
| 5 | `ClosurePresentation.tsx:103-142,192`; `docs/implementation/v5-ai-first/ACCOUNT_ERASURE_API_146.md`; `supabase/functions/uskoci-account-closure-worker/closure.ts` (`decodeClosed`) |
| 6 | `ClosurePresentation.tsx:139`; `closureExecutionClientService.ts:7` (`erasureExceptionLabels`); LEG-10 |
| 7 | `docs/implementation/v5-ai-first/RETENTION_ACTIVATION_GAPS.md` („Lokalni DB/Storage purge nije dokaz brisanja Google/Supabase provider logova ili backup-a”); `TaskPhotosPresentation.tsx:86` |
| 8-9 | `ClosurePresentation.tsx:103-105,137-142` |
| 10 | RC2 Privacy §16 |

Napomena za urednika: kada je zatvaranje moguće u aplikaciji a putanja van aplikacije ne postoji, Google Play zahtev za spoljašnji veb resurs za brisanje nije ispunjen (RC2 Privacy §17; master plan, GPL-04). Isto važi za dokaz da radnik brisanja stvarno radi na izdanju (kontrolni red N10).


> **SUPERSEDED 2026-10-02 by „DOPUNA 2026-10-02” u odeljcima 5 i 6:** sledeća napomena kaže da je paket D12 samo kandidat i da nije primenjen. Paket je primenjen na razvojnu bazu 2026-10-02 (migracija `20261002044950`, ledger 221); napomena ostaje kao istorija.

## D12 napomena (kandidat, NIJE primenjen)

> Dodato 2026-10-01. Paket „D12 pisani komentar uz ocenu“ je samo kandidat u repozitorijumu (`supabase/candidates/d12_review_comment.sql`); nije primenjen na DEV i zahteva izričitu odluku vlasnika. Do tada tvrdnje iznad o oceni bez slobodnog teksta ostaju tačne i ovaj dokument se ne menja. Ako se paket primeni, uticaj na ovaj dokument je ograničen na: odeljak o tome šta se uklanja i šta ostaje: komentar autora se uklanja zajedno sa kopijama ocena; komentar o osobi koja je zatvorila nalog ostaje skriven. Opcioni pisani komentar postoji dok postoji nalog autora; briše se pri zatvaranju naloga autora; komentar koji je moderacijom skriven i komentar o osobi koja je zatvorila nalog se zadržavaju (skriveni od prikaza); rok čuvanja je unos vlasnika/pravnika i nijedan broj nije izmišljen. Pravni osnov, DPIA, moderator i rok odgovora ostaju `[[PROVERITI]]`. Izvor: `supabase/proofs/d12/README_D12_CANDIDATE.md`, `docs/implementation/product-v1-closure-20260926/finalization-20260927/d12/D12_CLOSURE_INVENTORY_SUCCESSOR_20261001.json`.

## INTERNO - dopune sledljivosti 2026-10-02 (ukloniti pre objave)

| Dopuna | Izvor |
|---|---|
| Odeljak 5 (komentar i glas) | DEV-čitanje 2026-10-02: `private.closure_redaction_patch_v5` (telo md5 `3891fe77d38af04e06cfe4c9e4abb96f`): komentar se briše (`DELETE`), `agreement_messages` dobija fiksan tekst, prazne fotografije i `voice_asset_id` = `null`, red otpremanja glasa se briše; LEG-15 Prilog A (relacije 32, 62 i 76) |
| Odeljak 6 (izuzeci) | DEV-čitanje 2026-10-02: `private.closure_erasure_exceptions_v5(uuid)` telo md5 `727910cbb39ab9413e12d99cf39c5116`; `rpc_claim_account_closure_action_service(uuid,uuid)` telo md5 `eedef6f857cc753d8597dc6d2d263956` (`EXCEPTIONS_PENDING`); nijedna `public` funkcija sa „closure” i „cancel” u imenu; LEG-10 odeljak 7.5; LEG-14 odeljak 4.2 |
| Putanja van aplikacije | i dalje ne postoji (EX-07 G14; `docs/implementation/release-prep-20260930/RELEASE_CONFIG_MATRIX.md` C-43); postupak: LEG-15 odeljak 4 |
