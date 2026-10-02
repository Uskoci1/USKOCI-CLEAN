# USKOČI - Reklamacije, podrška, žalbe i vansudsko rešavanje sporova

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-07 (master plan 16.2: put obraćanja Platformi, razlika u odnosu na spor između korisnika, nadležni kontakt i stvarno primenljiva pravila) |
| Status | DRAFT-FROM-RC2 uz proveru stvarnog koda; javni tekst ispod još nije za objavu |
| Osnova | RC2 „Reklamacije, podrška, žalbe i ADR” (18.08.2026); nazivi tema i stanja predmeta usklađeni sa aplikacijom (`src/ui/support/SupportPresentation.tsx`). RC2 navodi da „finalna verzija mora sadržati stvarni identitet operatera i hyperlink ka zvaničnoj ADR platformi” i da pravni pregled treba da potvrdi „tačan mapping člana 63” Zakona o zaštiti potrošača na ovu uslugu. |
| Verzija / stupanje na snagu | `[[ODLUKA VLASNIKA: oznaka verzije i datum]]` |
| Uklanja se pre objave | ova tabela, oznake `[[...]]` i „Prilog: sledljivost” |

**OSVEŽENO 2026-10-02 (EX-07, slice S04):** obećanja koja nadilaze implementirano ponašanje (zakonski rok odgovora, obaveštenje o vansudskom rešavanju, prioritetna obrada i hitna zaštitna mera bezbednosnih prijava, mere i njihovo trajanje, zaštita od zloupotrebe prijava) skraćena su na ono što aplikacija i server stvarno rade. Zabeležene su i dve razlike: obim kvote predmeta (reklamacija i prijava sadržaja troše običnu kvotu) i zatvaranje naloga koje staje kod izuzetaka. Raniji pasusi su zadržani i označeni „SUPERSEDED 2026-10-02”, zamene su označene „ZAMENA 2026-10-02”. Nacrt nije objavljen.


**Oznake:** `[[OPERATER: ...]]`, `[[ODLUKA VLASNIKA: ...]]`, `[[PROVERITI: ...]]` kao u LEG-02.

Ovaj tekst je prateći dokument Uslova korišćenja (LEG-02, odeljak 22) i Pravila zajednice i bezbednosti (LEG-05).

---

## 1. Zašto postoji više kanala

Jedan opšti kanal „Kontaktirajte podršku” nije dovoljan, jer postoje najmanje četiri različita slučaja, svaki sa drugom svrhom, rokom, pristupom dokazima i mogućim ishodom:

1. **reklamacija potrošača na USKOČI uslugu** (digitalnu, platformsku uslugu);
2. **spor između Strana** oko konkretnog zadatka;
3. **bezbednosna prijava ili prijava zloupotrebe**;
4. **prijava nezakonitog sadržaja, povrede autorskog prava ili privatnosti**.

Pravo lica u vezi sa podacima o ličnosti (pristup, izvoz, brisanje) ima zaseban kanal (Politika privatnosti, odeljak 15).

## 2. Reklamacija na USKOČI uslugu

Reklamacija na USKOČI uslugu odnosi se na samu digitalnu uslugu Platforme. Primeri: platformska naknada je pogrešno obračunata (kada se naplata uvede); funkcija za koju je Platforma preuzela obavezu nije pružena; drugi nedostatak USKOČI usluge.

To **nije** isto što i tvrdnja da druga Strana nije dobro obavila posao.

## 3. Kako se podnosi i šta dobijate

Reklamaciju podnosite u aplikaciji: Podrška - novi zahtev - „Reklamacija na USKOČI uslugu”. `[[OPERATER: kanal van aplikacije (email ili obrazac) za osobe koje ne mogu da uđu u nalog]]`

Za svaku reklamaciju treba da su vidljivi:

- izbor „Reklamacija na USKOČI uslugu”;
- vaš nalog i, gde je relevantno, događaj na koji se odnosi;
- kratak opis i željeni ishod;
- potvrda prijema, evidencioni broj i vreme prijema;
- status predmeta;
- odluka i obrazloženje;
- datumi odgovora i rešenja.

Stanja predmeta koja vidite u aplikaciji: „Zahtev je primljen”, „U obradi”, „Čeka tvoju dopunu”, „Odgovor sa odlukom”, „Predmet je zatvoren”. Potvrda „Zahtev je primljen” znači da je zahtev primljen; ne znači da ga je operater već pregledao.

## 4. Rokovi


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” na kraju odeljka 4:** sledeći uvod i tri tačke obećavaju odgovor „najkasnije u zakonskom roku od 8 dana” i organizaciju postupka; aplikacija ne meri niti garantuje rok, operater nije imenovan, a primenljivost zakona nije potvrđena.

Kada se na konkretnu reklamaciju primenjuje režim reklamacije iz Zakona o zaštiti potrošača („Sl. glasnik RS” 35/2026), Operater organizuje postupak tako da:

- odgovor potrošaču dostavi bez odlaganja, a najkasnije u zakonskom roku od 8 dana;
- u odgovoru navede da li se reklamacija prihvata, a ako se ne prihvata, obrazloži odbijanje;
- ako se prihvata, navede način i rok rešavanja, u okviru zakonskog roka za konkretnu uslugu.

`[[PROVERITI: pravni pregled treba da potvrdi kako se odgovarajući član zakona primenjuje na USKOČI digitalnu uslugu i moguće posebne odredbe za digitalne usluge]]` Operativni rok Operatera ne sme biti duži od zakonskog maksimuma. Rokovi za ostale slučajeve (tehnička pomoć, pomoć oko saradnje) nisu zakonski određeni ovim dokumentom `[[OPERATER: rokovi i radno vreme podrške]]`; USKOČI ne obećava neprekidnu podršku ni odgovor u unapred nenavedenom roku.

**ZAMENA 2026-10-02 (odeljak 4; javni tekst, nacrt):** Aplikacija ne meri niti garantuje rok odgovora na reklamaciju. Stanja predmeta su „Zahtev je primljen”, „U obradi”, „Čeka tvoju dopunu”, „Odgovor sa odlukom” i „Predmet je zatvoren”; „Zahtev je primljen” znači samo da je zahtev primljen. Rok odgovora, radno vreme i način obaveštavanja: `[[OPERATER: rok i radno vreme, LEG-01 OP-51]]` `[[PROVERITI: zakonski rok i primenljivost režima reklamacije na ovu uslugu; osmodnevni rok iz izvora RC2 je zabeležen sadržaj izvora, ne proverena tvrdnja o važećem pravu]]`. Obaveštenje o odgovoru se ne obećava: aplikacija nema vrstu događaja za odgovor podrške, pa push obaveštenje o njemu ne postoji, a obaveštenje e-poštom ugovor podrške ne uključuje.



> **SUPERSEDED 2026-10-02 (uslovno) by „ZAMENA 2026-10-02” na kraju odeljka 6:** odeljci 5 i 6 obećavaju obaveštenje o vansudskom rešavanju potrošačkih sporova u odgovoru, na sajtu i na ekranu podrške. Aplikacija nema takav tekst (pretraga izvora 2026-10-02), operater nije imenovan ni registrovan (AF-D10), a obaveza nije potvrđena. Tekst odeljaka 5 i 6 važi samo ako operater i pravnik potvrde obavezu; do tada se ne objavljuje.

## 5. Ako se reklamacija odbije

Ako Operater odbije reklamaciju na koju se primenjuje potrošački režim, odgovor objašnjava mogućnost vansudskog rešavanja potrošačkog spora i zvanični kanal ili tela.

## 6. Vansudsko rešavanje potrošačkih sporova (ADR)

> **Vansudsko rešavanje potrošačkog spora**
> Ako ste potrošač i niste zadovoljni načinom na koji smo rešili reklamaciju na USKOČI uslugu, možete, nakon prethodno izjavljene reklamacije, pokrenuti vansudsko rešavanje potrošačkog spora preko sistema nadležnog ministarstva. Kada je USKOČI operater po zakonu obavezan da učestvuje, učestvovaće u tom postupku u skladu sa važećim propisima.

Veza ka zvaničnoj platformi za vansudsko rešavanje potrošačkih sporova: `[[OPERATER: hiperlink na zvaničnu ADR platformu i spisak tela; proveriti neposredno pre objave]]`. Prema zakonu koji navodi RC2, potrošač pre ADR-a prethodno izjavljuje reklamaciju trgovcu, a standardni zakonski maksimum postupka je 90 dana uz mogućnost produženja za složen predmet `[[PROVERITI]]`.

Obaveštenje o ovoj mogućnosti mora biti lako dostupno i na veb sajtu i na ekranu podrške u aplikaciji `[[PROVERITI: ekran u aplikaciji trenutno nema ovaj tekst]]`, kada Operater nastupa kao trgovac prema potrošaču.

**ZAMENA 2026-10-02 (odeljci 5 i 6; javni tekst, nacrt):** Obaveštenje o vansudskom rešavanju potrošačkih sporova nije deo aplikacije. Ono se uključuje u odgovor na odbijenu reklamaciju i na ekran podrške tek kada operater potvrdi da nastupa kao trgovac prema potrošaču i kada su poznati stvaran identitet operatera i zvanična veza `[[OPERATER: identitet operatera i veza, LEG-01 OP-23]]` `[[PROVERITI: obaveza obaveštenja i tačan sadržaj]]`.


## 7. Spor između Strana nije reklamacija na USKOČI

Ako se dve privatne Strane spore oko kvaliteta posla, cene ili štete iz njihovog Dogovora, to nije automatski reklamacija na USKOČI uslugu niti automatski ADR spor između potrošača i Operatera. USKOČI može omogućiti evidenciju činjenica i internu pomoć, ali ne obećava da će državna potrošačka ADR procedura odlučiti svaki privatni spor između korisnika.

U aplikaciji su za to dostupni: „Prijavi problem” u samom Dogovoru (vide ga obe Strane; ne utvrđuje krivicu) i tema podrške „Pomoć oko saradnje” (privatan zahtev). Prijava nedolaska je posebna tema („Prijava nedolaska”) i beleži tvrdnju, ne presudu.

## 8. Predmet podrške

> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod (samo prva rečenica pasusa):** rečenica navodi da svaki formalni predmet prolazi kroz „obrazloženje; rok ili dejstvo; žalba ili drugi pregled kada je dozvoljen”; server nema rok, a odluka podrške uvek ima dejstvo `NONE` (LEG-14 odeljci 0 i 2). Druga rečenica pasusa ostaje.

Formalni predmet podrške ima nepromenljiv vremenski tok: predmet otvoren; dodatne informacije; zahtev za dokaz; odgovor podrške; odluka; obrazloženje; rok ili dejstvo; žalba ili drugi pregled kada je dozvoljen. Nova dopuna vraća predmet iz čekanja u obradu.

**ZAMENA 2026-10-02 (odeljak 8, prva rečenica; javni tekst, nacrt):** Istorija predmeta podrške samo se dopunjava: događaji i odluke se ne menjaju ni ne brišu. Predmet prolazi stanja „Zahtev je primljen”, „U obradi”, „Čeka tvoju dopunu”, „Odgovor sa odlukom” i „Predmet je zatvoren”. Odluka sadrži ishod (prihvaćen ili odbijen), šifru razloga i obrazloženje i nema dejstvo na nalog, Dogovor, objavu ni ocenu; aplikacija ne određuje rok odluke. Ponovni pregled odluke je moguć i radi ga isti operater (odeljak 9). `[[OPERATER: rokovi, LEG-01 OP-51]]` `[[PROVERITI: da li se „rok ili dejstvo” iz izvora RC2 uopšte navodi u javnom tekstu]]`

Teme u aplikaciji: tehnička pomoć; pomoć oko saradnje; prijava nedolaska; reklamacija na USKOČI uslugu; prijava sadržaja ili recenzije; privatnost i prava; pregled odluke o objavi; drugo. Bezbednosna prijava je zaseban, privatan tok (Pravila zajednice i bezbednosti, odeljak 9).

Operater vidi samo tekst koji ste poslali, izabrane reference i neophodan kontekst; ne dobija ceo privatni razgovor, tuđu prijavu, privatnu cenu, tačnu adresu, kontakt, GPS tačku ni izvorni AI razgovor osim ako ih namerno izdvojite i prihvatite da ih operater vidi. Pristup operatera evidentira se. Podrška se obrađuje ručno i ne prosleđuje se AI servisu. `[[PROVERITI: potvrditi u izdanju; u privatnom testu jedini ovlašćeni operater je vlasnik projekta, što nije zamena za odgovorno lice, LEG-14]]`

## 9. Žalba i drugi pregled


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod (samo rečenica „Za značajnu meru korisnik treba da zna ...”):** rečenica pretpostavlja meru sa ograničenim funkcijama i trajanjem; odluka podrške nema dejstvo na nalog (`effect` = `NONE`). Prve dve rečenice pasusa ostaju.

Žalba se vezuje za konkretnu odluku; originalna odluka se ne briše. Drugi pregled razmatra razlog žalbe i relevantne nove činjenice i daje zasebno obrazloženje. Za značajnu meru korisnik treba da zna: šta je odlučeno, koje funkcije su ograničene, osnovni razlog, kada mera počinje i koliko traje ako je privremena, i da li i kako može da traži drugi pregled.

**ZAMENA 2026-10-02 (odeljak 9, rečenica o značajnoj meri; javni tekst, nacrt):** Odluka podrške ne sadrži meru nad nalogom: u predmetu se vide ishod (prihvaćen ili odbijen), šifra razloga i obrazloženje, i može se zatražiti ponovni pregled. Ponovni pregled radi isti operater (u privatnom testu jedino lice sa pristupom), pa nije nezavisan.


U aplikaciji se ovo zove „ponovni pregled” (zahtev za ponovni pregled, odluka posle ponovnog pregleda). To nije nezavisan organ. `[[PROVERITI: ozbiljne sankcije naloga ne uvode se pre stvarnog drugog pregleda ili valjanog alternativnog kanala (RC2 Otkazivanje §12; SUPPORT_CASE_CONTRACT_PROPOSAL §3)]]`

## 10. Bezbednosna prijava


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod (prva rečenica pasusa):** „prioritetna obrada i mogućnost hitne zaštitne mere” nisu implementirani: server nema polje prioriteta, a ne postoji ni funkcija hitne mere. Ostale rečenice pasusa ostaju.

Bezbednosna prijava ima prioritetnu obradu i mogućnost hitne zaštitne mere. Prijava ne mora uvek odmah biti prosleđena prijavljenom korisniku ako bi to ugrozilo žrtvu, istragu ili dokaz. Status „primljeno” znači da je prijava primljena u sistem. `[[OPERATER: ko prima bezbednosne prijave i kako se obrađuju, LEG-14]]`

**ZAMENA 2026-10-02 (odeljak 10, prva rečenica; javni tekst, nacrt):** Bezbednosna prijava je privatna i vodi se u zasebnoj listi operatera; aplikacija ne daje prioritet, rok reakcije ni hitnu zaštitnu meru, a ova prijava nije hitna služba. U neposrednoj opasnosti treba pozvati nadležnu službu u svojoj državi `[[OPERATER: izjava o hitnim službama, LEG-01 OP-52]]`.


## 11. Prijava nezakonitog sadržaja, autorskog prava ili privatnosti


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod (rečenica „... uz zaštitu od zloupotrebe sistema prijava”):** zaštita od zloupotrebe postoji samo kao dnevna granica običnih zahteva (koja važi i za ovu temu), dok za bezbednosne prijave granice nema. Ostale rečenice pasusa ostaju.

Zaseban tok omogućava prijavu nezakonitog sadržaja, povrede autorskog prava, privatnosti ili drugog prava (u aplikaciji: tema „Prijava sadržaja ili recenzije”). Platforma čuva razlog, odluku i potrebnu evidenciju, uz zaštitu od zloupotrebe sistema prijava. Prijava ne briše sam sadržaj ni recenziju. `[[OPERATER: email ili obrazac za pravna obaveštenja i autorska prava]]`

**ZAMENA 2026-10-02 (odeljak 11; javni tekst, nacrt):** Prijava sadržaja ili recenzije je zahtev podrške (tema „Prijava sadržaja ili recenzije”) i troši dnevnu granicu običnih zahteva po nalogu; za bezbednosne prijave takva granica ne postoji `[[ODLUKA VLASNIKA: da li se granica navodi u tekstu, LEG-14 odeljak 4.1]]`. Prijava ne briše ni ne skriva sadržaj. Jedino što operater može da sakrije jeste tekst komentara uz ocenu, po sopstvenoj odluci, bez obaveštenja prijavioca i autora.


## 12. Dokazi

Dokazi u predmetu podrške ili problema nisu nužno vidljivi obema stranama. Bezbednost, privatnost i prava trećih lica mogu zahtevati ograničen prikaz ili redakciju.

## 13. Kontakti

| Namena | Kanal |
|---|---|
| Reklamacije na USKOČI uslugu | u aplikaciji (Podrška); `[[OPERATER: email ili obrazac]]` |
| Privatnost i prava lica | `[[OPERATER: email ili obrazac]]`; u aplikaciji tema „Privatnost i prava” |
| Bezbednost | u aplikaciji (Prijava); `[[OPERATER: email]]` |
| Pravna obaveštenja i autorska prava | `[[OPERATER: email ili obrazac]]` |
| Poštanska adresa Operatera | `[[OPERATER: adresa]]` |

Bez ovih podataka ovaj dokument ne treba objaviti.

---

## Prilog: sledljivost (INTERNO - ukloniti pre objave)

| Odeljak | Izvor |
|---|---|
| 1-2 | RC2 Reklamacije §1-2 |
| 3 | RC2 Reklamacije §3; `SupportPresentation.tsx:18-30` (nazivi stanja i tema); `SupportNewScreen.tsx:21` (spisak tema); `SUPPORT_CASE_CONTRACT_PROPOSAL.md` (odeljak 6: `RECEIVED` nastaje atomskim upisom, „prvi otvoreni ekran ne sme značiti operater je pogledao”) |
| 4 | RC2 Reklamacije §4; master plan (poglavlje 22, N08): „ne obećavaj neorganizovanu podršku 24/7” |
| 5-6 | RC2 Reklamacije §5-7 (predloženi in-app ADR tekst doslovno) |
| 7 | RC2 Reklamacije §8; `20260908120000_clean_p0e_completion_guards.sql` (`rpc_report_problem`, `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 2) |
| 8 | RC2 Reklamacije §9, §13; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` (odeljci 2-3); `SupportPresentation.tsx:18-30` |
| 9 | RC2 Reklamacije §10; `SupportPresentation.tsx:18-30` („Zahtev za ponovni pregled”); `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 3 („UI to zove ponovni pregled”) |
| 10 | RC2 Reklamacije §11; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 2 |
| 11 | RC2 Reklamacije §12; `SupportPresentation.tsx:24` |
| 13 | RC2 Reklamacije §14; LEG-01 OP-10..OP-14 |


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” u odeljku 11:** sledeća napomena kaže da je paket D12 samo kandidat i da nije primenjen. Paket je primenjen na razvojnu bazu 2026-10-02 (migracija `20261002044950`, ledger 221); napomena ostaje kao istorija.

## D12 napomena (kandidat, NIJE primenjen)

> Dodato 2026-10-01. Paket „D12 pisani komentar uz ocenu“ je samo kandidat u repozitorijumu (`supabase/candidates/d12_review_comment.sql`); nije primenjen na DEV i zahteva izričitu odluku vlasnika. Do tada tvrdnje iznad o oceni bez slobodnog teksta ostaju tačne i ovaj dokument se ne menja. Ako se paket primeni, uticaj na ovaj dokument je ograničen na: tema „Prijava sadržaja ili recenzije“: moderacija kandidata sakriva samo tekst komentara, nikada ocenu ni prosek. Opcioni pisani komentar postoji dok postoji nalog autora; briše se pri zatvaranju naloga autora; komentar koji je moderacijom skriven i komentar o osobi koja je zatvorila nalog se zadržavaju (skriveni od prikaza); rok čuvanja je unos vlasnika/pravnika i nijedan broj nije izmišljen. Pravni osnov, DPIA, moderator i rok odgovora ostaju `[[PROVERITI]]`. Izvor: `supabase/proofs/d12/README_D12_CANDIDATE.md`, `docs/implementation/product-v1-closure-20260926/finalization-20260927/d12/D12_CLOSURE_INVENTORY_SUCCESSOR_20261001.json`.

## INTERNO - dopune sledljivosti 2026-10-02 (ukloniti pre objave)

| Zamena ili zapis | Izvor |
|---|---|
| Odeljak 4 (rok i stanja) | `src/ui/support/SupportPresentation.tsx:18-30`; `docs/implementation/v5-ai-first/SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 7 (osmodnevni rok je „zabeležen sadržaj RC2 izvora, nije proverena tvrdnja o važećem pravu niti generički support SLA”); DEV-čitanje 2026-10-02: ograničenje `user_activity_events_event_type_check` nema vrstu događaja za podršku (24 vrste) |
| Odeljci 5 i 6 (vansudsko rešavanje) | pretraga izraza o vansudskom rešavanju, ministarstvu i potrošaču u `src/` bez pogodaka (2026-10-02); `docs/implementation/legal-drafts-20260930/LEG-01_operator_data_checklist.md` OP-23 |
| Odeljak 9 (mera) | DEV-čitanje 2026-10-02: `support_decisions_v5_effect_check` (`effect` = `NONE`); `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 3 |
| Odeljak 10 (prioritet, hitna mera) | DEV-čitanje 2026-10-02: tabela `private.support_cases_v5` nema kolonu `priority`; LEG-14 odeljak 2 |
| Odeljak 11 (zaštita od zloupotrebe) | DEV-čitanje 2026-10-02: `rpc_support_submit_v5` telo md5 `c30469f1c599e23eaa56163dc1b5b362`; skrivanje teksta komentara: `rpc_moderate_review_comment_service_v1` telo md5 `2de37076287d759515407eecccc92728` |
| **Razlika kvote (zapis)** | Usvojeni ugovor izuzima od obične kvote i bezbednost, i prava lica, i formalne pravne i potrošačke kanale (`SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 5, poslednji red). Server izuzima samo temu `PRIVACY_RIGHTS` (`v_ordinary:=p->>'topic'<>'PRIVACY_RIGHTS'`) i bezbednosne predmete (`ordinary=false` u `private.support_safety_case_v5`). Zato `SERVICE_COMPLAINT` (reklamacija) i `CONTENT_NOTICE` (prijava sadržaja ili recenzije) troše granicu: 5 novih zahteva u 24 sata po nalogu, 60 sekundi razmaka, 50 dopuna u 24 sata (DEV-čitanje 2026-10-02). Izmena je izmena funkcije koju obuhvata sertifikat zatvaranja (DEV-čitanje 2026-10-02: telo `private.closure_source_digest_v5()` imenuje `rpc_support_submit_v5`) i pomera sertifikat: LEG-14 odeljak 4.1, odluka vlasnika. |
| **Zatvaranje staje kod izuzetaka (zapis)** | Nalog sa predmetom podrške ili bezbednosnom prijavom (kao podnosilac ili ciljna osoba) ne stiže do `CLOSED`; nijedna funkcija ne oslobađa izuzetak niti poništava zatvaranje: LEG-14 odeljak 4.2, LEG-10 odeljak 7.5, LEG-15 odeljak 5 |

Nepromenjeno u ovom osvežavanju: odeljci 1 do 3, 7, 8, 12 i 13.

**Ispravka 2026-10-02 (pregled ispravki):** odeljak 8 (prva rečenica) više nije nepromenjen: označen je (SUPERSEDED i ZAMENA). Nepromenjeni su odeljci 1 do 3, 7, 12 i 13.
