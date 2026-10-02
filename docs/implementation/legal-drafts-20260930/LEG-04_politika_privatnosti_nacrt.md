# USKOČI - Politika privatnosti

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-04 (master plan 16.2) |
| Status | DRAFT-FROM-RC2 uz proveru stvarnog koda; javni tekst ispod još nije za objavu |
| Osnova | RC2 „Privatnost, AI, matching i lokacija” (18.08.2026) + stvarno ponašanje aplikacije (commit `fc58f411598338c8589f5f177626a2790c92fb13`); RC2 kaže da ovaj dokument „ne može postati finalna Politika privatnosti dok se ne potvrde identitet rukovaoca, processor mapa, regioni obrade i retention rokovi” |
| Verzija / stupanje na snagu | `[[ODLUKA VLASNIKA: oznaka verzije i datum stupanja na snagu]]` (registar dokumenata čuva verziju, HTTPS adresu i SHA-256, vidi LEG-13) |
| Uklanja se pre objave | ova tabela, sve oznake `[[...]]` (popunjene ili rešene) i „Prilog: sledljivost” na kraju |

**Kako čitati oznake:** `[[OPERATER: ...]]` - podatak koji daje operater; `[[ODLUKA VLASNIKA: ...]]` - odluka; `[[PROVERITI: ...]]` - činjenica ili pravno pitanje koje treba potvrditi pre objave.

---

## 1. Ko obrađuje vaše podatke

Rukovalac podacima o ličnosti je `[[OPERATER: puno poslovno ime i pravna forma]]`, PIB `[[OPERATER: PIB]]`, matični broj `[[OPERATER: matični broj, ako postoji]]`, sa sedištem na adresi `[[OPERATER: adresa]]` (u daljem tekstu: „Operater”).

Kontakt za prava lica i pitanja o privatnosti: `[[OPERATER: email ili obrazac za privatnost]]`.
Lice za zaštitu podataka o ličnosti: `[[OPERATER: kontakt lica ili izjava da nije određeno]]`.

USKOČI je mobilna aplikacija koja omogućava da korisnici objave zadatak ili se prijave da pomognu, razmene prijave i potvrde Dogovor. Ova politika opisuje koje podatke USKOČI obrađuje, zašto, ko ih još prima i kakva prava imate.

## 2. Načela

Obrađuju se samo podaci koji imaju određenu svrhu i odgovarajući pravni osnov. Podaci se ne koriste zato što je korisnik jednom „prihvatio sve”. Primenjujemo minimizaciju, tačnost, ograničenje svrhe, ograničenje čuvanja, integritet i poverljivost i odgovornost za ono što radimo.

## 3. Koje podatke obrađujemo

### 3.1. Nalog

- email adresa, lozinka (obrađuje usluga prijave; aplikacija je ne čuva na uređaju), ime, prezime i grad koje unesete pri registraciji;
- podaci potrebni za rad naloga (izabrani režim, završetak uvodnih koraka, vremena);
- sesija: znak prijave čuva se u lokalnom skladištu vašeg uređaja.

### 3.2. Profil

- za sve korisnike: prikazno ime, grad, fotografija profila;
- za korisnike koji nude pomoć: kratak opis (biografija), veštine, alat, vozila, dozvole koje sami navedete, kapacitet tima, radna oblast (država, grad, radijus i, ako izaberete, približna tačka), dostupnost i kalendar;
- oznake i ocene koje dobijate od druge strane posle završenog Dogovora.

Dozvole i identitet koje sami navedete prikazuju se kao samoprijavljeni podaci. USKOČI trenutno **ne** proverava identitet dokumentom ni selfijem i ne prikazuje oznaku „verifikovan”. `[[PROVERITI: potvrditi u izdanju]]`

### 3.3. Zadatak, prijave i Dogovor

- opis zadatka (tekst, izgovoreni tekst pretvoren u tekst, fotografije), termin, broj ljudi, cena i osnova cene, potrebne veštine i alat, kritični uslovi;
- **približna oblast** zadatka (javno) i **tačna adresa, napomene za pristup i tačne koordinate** (privatno, vidi odeljak 6);
- pitanja i odgovori pre izbora, prijave (ponude) sa cenom i kratkom porukom, izbor, verzije Dogovora, izmene, razlog otkazivanja, prijava problema;
- poruke i fotografije u Dogovoru;
- stanje izvršenja i ocena.

### 3.4. Tehnički podaci i evidencija

- Expo token uređaja i podešavanja obaveštenja;
- evidencija važnih radnji (ko je šta uradio i kada), ključevi komandi koji sprečavaju dvostruko izvršenje radnje, potvrde;
- podaci o pravnom prihvatanju: verzija, otisak dokumenta i vreme.

### 3.5. Bezbednost i podrška

- prijave (kategorija, razlog, opis), blokade, predmeti podrške, dopune, odluke i žalbe.

### 3.6. Podaci koje ne prikupljamo

USKOČI ne prikuplja pozadinsku lokaciju, ne prati vaše kretanje, ne čuva audio snimke, ne traži isprave niti biometrijske podatke, ne šalje marketinške poruke i, prema trenutnoj konfiguraciji, ne sadrži SDK-ove za analitiku ili oglašavanje. `[[PROVERITI: potvrditi popisom SDK-ova i manifestom izdanja, LEG-18]]`

## 4. Zašto obrađujemo podatke i na kom osnovu

Pravni osnov za svaku obradu mora potvrditi odgovorno lice; polje „Osnov” je radni predlog iz RC2 i **nije konačan**.

| Svrha | Osnov |
|---|---|
| Otvaranje i vođenje naloga, prijava | izvršenje ugovora ili radnje pre zaključenja ugovora |
| Objava zadatka, prijave i odgovori, pretraga i preporuke | izvršenje usluge platforme |
| Dogovor, poruke i privatni pristup | izvršenje usluge i bezbednost |
| Bezbednost, moderacija, sprečavanje prevare, prijave i blokade | legitimni interes i/ili pravna obaveza, zavisno od obrade |
| Precizna lokacija zadatka | samo nužna svrha i odgovarajući osnov; dozvola uređaja sama po sebi nije pravni osnov |
| Obrada koju obavljaju AI servisi i servis za govor, geokodiranje, obaveštenja | `[[PROVERITI: pravni osnov za svaku od ovih obrada]]` |
| Čuvanje koje nalaže zakon | pravna obaveza |
| Odbrana pravnih zahteva | legitimni interes u ograničenom periodu |

USKOČI ne šalje marketinške poruke. Operativna obaveštenja o nalogu, Dogovoru i bezbednosti su odvojena od marketinga.

## 5. Kako se koriste podaci o lokaciji

USKOČI razdvaja pet vrsta lokacije:

1. **Približna oblast zadatka** - dovoljna da odlučite pre Dogovora; prikazuje se prijavljenim korisnicima aplikacije.
2. **Tačna privatna adresa i tačke** - drugim korisnicima se otkrivaju samo ovlašćenim učesnicima (odeljak 6); davaoci usluga koji mogu da ih prime opisani su u odeljcima 7 i 12.
3. **Radna oblast osobe koja nudi pomoć** - država, grad, radijus i, po želji, približna tačka; koristi se za preporuke zadataka, ne za praćenje.
4. **Trenutan položaj uređaja** - koristi se samo posle vašeg dodira, jednom, dok je aplikacija otvorena: za pomeranje mape („U blizini”) ili za predlog tačke zadatka. Položaj se ne čuva dok tačku ne potvrdite, a za „U blizini” se ne čuva niti šalje. Nema pozadinskog praćenja.
5. **Izračunata udaljenost** - server računa udaljenost između približne tačke zadatka i radne oblasti radi preporuka; to nije javna istorija kretanja.

Ako odbijete dozvolu za lokaciju, možete pomeriti mapu ručno ili upisati mesto u pretragu.

Kada pretražujete adresu, uneti tekst (ili, kada izričito zatražite adresu za tačku, koordinate te tačke) šalje se preko USKOČI servera servisu za pretragu adresa (odeljak 12). Taj servis ne dobija vaše ime ni nalog.

## 6. Tačna adresa

Tačna adresa, napomene za pristup i tačne koordinate su privatni podaci zadatka. Drugim korisnicima ostaju maskirani dok server ne potvrdi uslove za privatni pristup, a to su, u skladu sa pravilima platforme, potvrđen Dogovor i vaše izričito otkrivanje. Prikaz nije trajno otvoren profil, i ne daje pravo da se podaci koriste za druge svrhe ili objave. `[[PROVERITI: tačan uslov otkrivanja u izdanju, RC2 Uslovi §13]]`

## 7. Veštačka inteligencija

USKOČI koristi AI servis kompanije Google (Gemini) da vam pomogne da sastavite zadatak i radni profil, da proveri zadatak pre objave i da proveri javna pitanja i odgovore pre izbora.

**Šta se šalje:**

- **Razgovor za zadatak:** do 30 poslednjih poruka razgovora i trenutna poruka, uz činjenice zadatka koje smo do tada izdvojili iz razgovora. To uključuje tačnu adresu i napomene za pristup ako ste ih sačuvali u koraku „Mesto zadatka” pre nove poruke u istom razgovoru. Ne šalju se nalog, email, telefon, poruke iz Dogovora ni ocene. `[[PROVERITI: ažurirati ovaj opis posle završnog prolaza privatnosti (filter privatnih činjenica); ne objavljivati dok nije potvrđen]]`
- **Razgovor za radni profil:** poruke i podaci profila koje već imamo (ime, opis, veštine, alat, vozila, dozvole koje ste sami naveli, radna oblast i dostupnost).
- **Provera zadatka pre objave:** javni deo zadatka i, kada je to uključeno, izabrane fotografije zadatka; ne i tačna adresa.
- **Provera javnog pitanja ili odgovora:** javni deo zadatka i tekst pitanja ili odgovora.

**Kako AI učestvuje u odlukama:** AI samo predlaže. Činjenice koje predloži ostaju predlog dok ih vi ne potvrdite kroz pregled zadatka. AI ne bira drugu stranu, ne prihvata ponudu, ne zaključuje Dogovor, ne otkriva tačnu adresu i ne izriče sankciju. Ne postoji potpuno automatizovana odluka sa pravnim ili sličnim značajnim dejstvom po vas. `[[PROVERITI: potvrditi pred objavu]]`

**Gde i koliko dugo:** obrada kod Google-a može se odvijati i van Evrope i uključuje privremene bezbednosne zapise. Konkretne uslove (region, upotreba za unapređenje modela, rok čuvanja bezbednosnih zapisa) `[[PROVERITI: uslovi Gemini API plaćenih usluga]]`. USKOČI ne obećava da se podaci obrađuju samo u Evropi niti da kod davaoca ne ostaje nikakav trag.

**Ne unosite tuđe lične podatke** (imena, adrese, brojeve telefona trećih lica) osim ako je to zaista neophodno za zadatak.

## 8. Govorni unos

Na Android uređajima možete da držite dugme mikrofona i govorite umesto da kucate. Zvuk se prolazno šalje preko USKOČI servera Google-ovom servisu koji ga pretvara u tekst. USKOČI ne čuva audio snimke; tekst koji nastane ostaje u razgovoru kao i ostale poruke. Snimanje traje najviše 120 sekundi, samo dok je aplikacija otvorena i dok držite dugme. Mikrofon se koristi samo uz vašu dozvolu; ako je odbijete, nastavljate kucanjem.

Glasovne poruke između korisnika u Dogovoru `[[ODLUKA VLASNIKA: uključiti ovaj pasus tek kada se funkcija isporuči; do tada ne postoji]]`.

## 9. Fotografije

Fotografije zadatka (najviše 6), fotografija profila i fotografije u porukama Dogovora (najviše 6 po poruci) se pri slanju obrađuju na serveru: uklanjaju se podaci o lokaciji i uređaju (EXIF, GPS i slično), slika se smanjuje (najduža strana najviše 1.600 piksela) i čuva u privatnom skladištu bez javne adrese. Fotografije zadatka vide prijavljeni korisnici aplikacije; fotografije u poruci vide samo učesnici Dogovora. Fotografije zadatka se mogu poslati Google-ovom AI servisu na proveru pre objave (odeljak 7).

## 10. Preporuke i profilisanje

Preporuke zadataka izračunava server iz podataka koje ste dali. Prvo se primenjuju **tvrdi uslovi** (npr. potrebna dozvola, alat ili vozilo, minimalno iskustvo, stanje naloga). Zatim se uzimaju u obzir: podudarnost veština, termin, udaljenost u odnosu na vašu radnu oblast, resursi (alat, vozilo, dozvole), pouzdanost izvedena iz ocena i uravnoteženje koje sprečava da isti mali broj profila dobija sve prilike. Lični izbori (radijus, dostupnost, pauza obaveštenja) utiču na automatska obaveštenja o prilikama, ne na to da li zadatak možete ručno da pogledate. Tačne težine i pragovi za sprečavanje zloupotrebe ne objavljuju se.

Preporuka nije odluka: osoba koja objavljuje zadatak sama bira koga prihvata, a osoba koja se prijavljuje sama odlučuje da li će odgovoriti. Ako smatrate da je podatak koji utiče na preporuke netačan, možete ga ispraviti u profilu ili se obratiti podršci (odeljak 15).

## 11. Ocene

Ocena je vezana za stvarno završen Dogovor i može je dati samo učesnik tog Dogovora. Javno se prikazuje samo ono što je potrebno za poverenje i izbor (prosečna ocena i broj ocena), bez privatnih podataka.

## 12. Ko još prima podatke

Podatke obrađuju i sledeći davaoci usluga. Spisak je izrađen iz stvarnog rada aplikacije; ugovorne strane, regioni i mehanizmi prenosa `[[PROVERITI: LEG-11]]`.

| Davalac | Za šta se koristi | Koje podatke prima |
|---|---|---|
| Supabase | baza, prijava, privatno skladište, serverske funkcije | svi podaci aplikacije iz odeljka 3 |
| Google (Gemini AI, servis za govor u tekst) | razgovori sa asistentom, provera zadatka i pitanja, govorni unos | vidi odeljke 7 i 8 |
| Expo, zatim Google (Android) i Apple (iPhone) | slanje push obaveštenja | token uređaja i opšti tekst obaveštenja bez sadržaja poruke |
| LocationIQ | pretraga adrese i predlog tačke | unet tekst adrese ili koordinate tačke |
| OpenFreeMap | podloga mape | IP adresa uređaja i deo mape koji gledate |
| Pošiljalac email poruka `[[PROVERITI: naziv]]` | potvrda registracije i oporavak lozinke | email adresa i tekst poruke |

Kada otvorite navigaciju do zadatka, aplikacija otvara vezu ka Google mapama (u aplikaciji Google mape ili u pregledaču) sa odredištem koje ste vi izabrali; od tog trenutka to je samostalna usluga sa sopstvenom politikom privatnosti.

## 13. Prenos van Srbije

Deo obrađivača nalazi se ili obrađuje podatke van Republike Srbije, uključujući u nekim slučajevima države van Evropskog ekonomskog prostora. Prenos se vrši uz odgovarajući mehanizam i uz ovo obaveštenje, u skladu sa primenljivim pravom. `[[PROVERITI: region baze i mehanizam prenosa za svakog davaoca, LEG-11 odeljak 5]]` Region baze podataka nije dokaz da se svi podaci obrađuju samo u tom regionu.

## 14. Koliko dugo čuvamo podatke

Ne primenjuje se jedno pravilo „čuvamo zauvek” niti „brišemo sve odmah”. Istorija zadataka, Dogovora, poruka i fotografija ostaje dok nalog postoji. Kada zatvorite nalog, obični lični i privatni podaci se uklanjaju, a ostaju minimalni pseudonimni zapisi potrebni za potvrde radnji i tehničku evidenciju, kao i podaci koje moramo da zadržimo zbog zakona, bezbednosti ili odbrane pravnih zahteva. Sadržaj koji je napisala druga strana Dogovora ne briše se zbog zatvaranja vašeg naloga. Konkretni rokovi: `[[ODLUKA VLASNIKA: rokovi iz LEG-10; do odluke ne upisivati brojeve]]`.

Kopije kod davalaca i rezervne kopije mogu se čuvati po njihovim pravilima; brisanje u aplikaciji ne znači istovremeno brisanje tih kopija. `[[PROVERITI: LEG-10 odeljak 5]]`

## 15. Vaša prava

U skladu sa primenljivim pravom imate pravo na pristup, ispravku, brisanje, ograničenje obrade, prigovor, prenosivost tamo gde se primenjuje, povlačenje saglasnosti kada je saglasnost osnov, zaštitu u vezi sa automatizovanim odlučivanjem i profilisanjem kada su ispunjeni uslovi, kao i pravo na pritužbu nadležnom organu (Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti).

Kako ih ostvarujete:

- **Kopija podataka:** u aplikaciji, Profil - Privatnost i podaci - Izvoz podataka. `[[PROVERITI: dostupnost izvoza u izdanju; funkcija zavisi od objavljenih pravila čuvanja]]`
- **Zatvaranje naloga i brisanje podataka:** u aplikaciji, Profil - Privatnost i podaci - Zatvaranje naloga; van aplikacije: `[[OPERATER: adresa javne stranice za brisanje, LEG-08]]`.
- **Ispravka:** u profilu i u podacima zadatka; ostalo kroz podršku.
- **Ostalo (pristup, ograničenje, prigovor, pritužba na odluku):** podrška, tema „Privatnost i prava”, ili `[[OPERATER: email za privatnost]]`.

Pre odgovora možemo tražiti proveru identiteta podnosioca, bez prikupljanja više podataka nego što je neophodno.

## 16. Zatvaranje naloga i izvoz podataka

Zatvaranje ograničava pristup nalogu, briše nezaštićene fotografije i datoteke, uklanja obične lične i privatne podatke i podatke za prijavu, pa završava sesije. Ne možete ga poništiti iz aplikacije. Pre zatvaranja moraju se završiti aktivni Dogovori, zatvoriti otvoreni zadaci i povući ili završiti aktivne prijave. Izdvojeni dokazi (na primer bezbednosne prijave, slučajevi podrške, zaštićene fotografije i odluke koje koristi i drugi nalog) rešavaju se zasebno i mogu odložiti konačno zatvaranje.

## 17. Bezbednost

Primenjujemo, između ostalog: pristup po ovlašćenju i provere vlasništva na serveru, tajne ključeve samo u serverskom okruženju, ograničenja učestalosti zahteva, evidenciju kritičnih radnji, izbegavanje sadržaja u serverskim dnevnicima i šifrovan prenos između aplikacije i servera. `[[PROVERITI: rezervne kopije i vraćanje, postupak povrede, pregled davalaca]]` Aplikacija čuva znak prijave u lokalnom skladištu uređaja koje nije dodatno šifrovano na nivou aplikacije; zaštitite uređaj zaključavanjem.

O povredi podataka koja ugrožava vaša prava obaveštavamo nadležni organ i, kada zakon to nalaže, vas. `[[OPERATER: odgovorno lice i postupak]]`

## 18. Obaveštenja i marketing

Push obaveštenja se šalju samo za događaje u vezi sa vašim nalogom, prijavama i Dogovorima; tekst je opšti („Nova poruka u Dogovoru”) i ne sadrži sadržaj poruka, imena, adrese ni cene. Uključujete ih sami u podešavanjima i možete ih isključiti u svakom trenutku. Marketinške poruke se ne šalju.

## 19. Maloletna lica

USKOČI je namenjen punoletnim korisnicima (18+). `[[PROVERITI: mehanizam potvrde uzrasta; trenutno ne postoji, LEG-13, LEG-19]]` Ako se ikada uvede funkcija koja obrađuje podatke dece kao lica na koje se zadatak odnosi, prethodno je potrebna posebna procena uticaja.

## 20. Izmene ove politike

Materijalne izmene objavljujemo pre nego što stupe na snagu; kada je to pravno potrebno, tražimo novo prihvatanje pre nastavka korišćenja pogođenih funkcija. Prethodne verzije ostaju dostupne.

## 21. Kontakt

Pitanja o privatnosti: `[[OPERATER: email ili obrazac]]`. Poštanska adresa: `[[OPERATER: adresa]]`. Reklamacije, podrška i bezbednosne prijave imaju zasebne kanale (LEG-07, LEG-05).

---

## Prilog: sledljivost (INTERNO - ukloniti pre objave)

| Odeljak | Izvor |
|---|---|
| 1 | RC2 Privacy §1; LEG-01 |
| 2 | RC2 Privacy §2 |
| 3.1 | `src/data/authClientService.ts:44-52`; `src/data/supabaseClient.ts:23-29`; LEG-09 P-01 |
| 3.2 | `20260905133000_clean_ru5_public_profile_projection.sql`; `AF22_CLOSURE_INVENTORY_144.json` (`app_profiles`, `worker_match_preferences`); `OWNER_PRIVATE_TEST_DECISIONS_20260913.md` (AF-D23); `20260829211632_clean_dispatch_engine.sql` (`identity_admitted` = false) |
| 3.3 | `src/contracts/needFactsV2.ts:16-44`; LEG-09 P-04, P-09, P-15..P-19 |
| 3.4 | `pushDeviceClientService.ts:50`; `20260912222338_clean_v5_owner_safety_legal_reads.sql:44-88` |
| 3.5 | `src/data/safetyClientService.ts:5`; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` |
| 3.6 | `app.config.js` (nema pozadinske lokacije); `nearbyCapture.ts:1`; `proxy.ts:155`; pretraga `marketing`, SDK-ovi u `package.json` |
| 4 | RC2 Privacy §4 |
| 5 | RC2 Privacy §5; `nearbyCapture.ts`; `LocationPointEditor.tsx:140-172`; `20260829211632_clean_dispatch_engine.sql:100-201` |
| 6 | RC2 Privacy §6; RC2 Marketplace §6 |
| 7 | RC2 Privacy §7-8; `uskoci-ai-interview/index.ts:519-529`; `uskoci-worker-interview/index.ts:136-148`; `uskoci-publication-evaluate/index.ts:137-166,282,362-365`; `uskoci-qa-classify/index.ts:93-131`; `TaskPhotosPresentation.tsx:86`; `BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md` |
| 8 | `UskociVoiceModule.kt:16`; `uskoci-speech-session/proxy.ts`; `speechProtocol.ts:3-6`; `useHoldToTalk.ts:17`; `CHAT_VOICE_CONTRACT.md` |
| 9 | `_shared/mediaImageSanitizer.mjs:3-4,34-40`; `uskoci-media/index.ts` |
| 10 | RC2 Privacy §9-11; `20260829211632_clean_dispatch_engine.sql:100-201` |
| 11 | RC2 Privacy §12; `supabase/migrations/20260905133000_clean_ru5_public_profile_projection.sql` |
| 12 | LEG-11 R-01..R-08; `locationMapLinks.ts:12-21` |
| 13 | RC2 Privacy §14; LEG-11 §5 |
| 14 | RC2 Privacy §15; LEG-10; `OWNER_PRIVATE_TEST_DECISIONS_20260913.md` (AF-D22); `ClosurePresentation.tsx:137-142,192` |
| 15 | RC2 Privacy §16-17; `ExportPresentation.tsx`; `ClosurePresentation.tsx`; `SupportPresentation.tsx:22-24` |
| 16 | `ClosurePresentation.tsx:103-142,192`; `closureExecutionClientService.ts:6-7`; `ACCOUNT_ERASURE_API_146.md` |
| 17 | RC2 Privacy §18; `uskoci-location-search/index.ts:58-84,235-237`; `marketplace_audit_log` (LEG-09 P-26) |
| 18 | RC2 Privacy §20; `pushNotificationCopy.mjs`; `PushPreferences.tsx:188` |
| 19 | RC2 Privacy §21, Uslovi §4 |
| 20 | RC2 Uslovi §3, §33 |

## D12 napomena (kandidat, NIJE primenjen)

> Dodato 2026-10-01. Paket „D12 pisani komentar uz ocenu“ je samo kandidat u repozitorijumu (`supabase/candidates/d12_review_comment.sql`); nije primenjen na DEV i zahteva izričitu odluku vlasnika. Do tada tvrdnje iznad o oceni bez slobodnog teksta ostaju tačne i ovaj dokument se ne menja. Ako se paket primeni, uticaj na ovaj dokument je ograničen na: odeljak 11 (Ocene): javno se i dalje prikazuje prosek i broj ocena; komentar bi bio vidljiv prijavljenim korisnicima u čitaču komentara, uz ime i ocenu autora. Opcioni pisani komentar postoji dok postoji nalog autora; briše se pri zatvaranju naloga autora; komentar koji je moderacijom skriven i komentar o osobi koja je zatvorila nalog se zadržavaju (skriveni od prikaza); rok čuvanja je unos vlasnika/pravnika i nijedan broj nije izmišljen. Pravni osnov, DPIA, moderator i rok odgovora ostaju `[[PROVERITI]]`. Izvor: `supabase/proofs/d12/README_D12_CANDIDATE.md`, `docs/implementation/product-v1-closure-20260926/finalization-20260927/d12/D12_CLOSURE_INVENTORY_SUCCESSOR_20261001.json`.
