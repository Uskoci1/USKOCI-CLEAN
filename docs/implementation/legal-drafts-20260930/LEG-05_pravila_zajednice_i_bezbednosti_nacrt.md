# USKOČI - Pravila zajednice i bezbednosti

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-05 (master plan 16.2: dozvoljeno ponašanje i sadržaj, prijava i blokiranje, zabranjene ili regulisane potrebe, granice verifikacije) |
| Status | DRAFT-FROM-RC2 uz stvarnu politiku objave (`RS-MIN-001..016`); javni tekst ispod još nije za objavu |
| Osnova | RC2 „Safety, Community i regulisane usluge” (18.08.2026) i owner-locked minimum politike objave za Srbiju (`docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md`: „OWNER_LOCKED_MINIMUM / NOT_PRODUCTION_ACTIVATED”). RC2 interni statusi (ALLOW_WITH_WARNING, REQUIRE_VERIFICATION i sl.) zamenjeni su ishodima koje aplikacija zaista daje. |
| Verzija / stupanje na snagu | `[[ODLUKA VLASNIKA: oznaka verzije i datum]]` |
| Uklanja se pre objave | ova tabela, oznake `[[...]]` i „Prilog: sledljivost” |

**OSVEŽENO 2026-10-02 (EX-07, slice S04):** obećanja koja nadilaze implementirano ponašanje (prioritet bezbednosnih prijava, hitna zaštita, mere nad nalogom, obaveštenje o ishodu) skraćena su na ono što aplikacija i server stvarno rade. Raniji pasusi su zadržani i označeni „SUPERSEDED 2026-10-02”, zamene su označene „ZAMENA 2026-10-02”. Nacrt nije objavljen.


**Oznake:** `[[OPERATER: ...]]`, `[[ODLUKA VLASNIKA: ...]]`, `[[PROVERITI: ...]]` kao u LEG-02.

Ova pravila su prateći dokument Uslova korišćenja (LEG-02, odeljci 8, 18, 25, 26). Registar pravnih dokumenata u aplikaciji trenutno poznaje samo Uslove i Politiku privatnosti (`private.legal_document_versions`: `TERMS`, `PRIVACY`); zato se ova pravila ili ugrađuju u Uslove, ili objavljuju kao poseban javni dokument na koji Uslovi upućuju `[[ODLUKA VLASNIKA: kako se objavljuju i prihvataju, LEG-13]]`.

---

## 1. Osnovno pravilo

> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod (samo treća rečenica pasusa, deo „... a tamo gde je potrebno i čovek”):** rečenica obećava da u slučajevima gde je potrebno odlučuje i čovek; nijedan postupak u kome čovek menja ishod provere objave nije potvrđen (LEG-14 odeljci 0 i 2: odluka podrške ima dejstvo `NONE` i ne menja objavu). Ostale rečenice pasusa ostaju.

USKOČI nije oglasna tabla na kojoj je dozvoljeno sve što korisnik može da napiše. Provera pravila pri objavi je stvarna funkcija aplikacije. AI može da označi rizik, ali konačnu odluku o zabrani ili ručnom pregledu donose utvrđena pravila sa razlozima, a tamo gde je potrebno i čovek. AI oznaka nije automatska konačna sankcija.

**ZAMENA 2026-10-02 (odeljak 1, treća rečenica; javni tekst, nacrt):** AI može da označi rizik, ali ishod provere pri objavi određuju utvrđena pravila sa razlozima. Ishod „potreban pregled” samo zadržava objavu dok ne postoji pregledano pravilo; odluka podrške (tema „Pregled odluke o objavi”) je odgovor na zahtev i ne menja objavu. `[[PROVERITI: da li pravila zadržavaju ručni pregled pojedinačne objave; do potvrde se ne obećava da odluku donosi čovek]]`

## 2. Šta zaista objavljujemo: samo zadatke koje neko želi da uradi neko drugi

Javni oglasi na USKOČI-ju su isključivo **Zadaci**: stvari koje osoba želi da neko drugi uradi. Ne postoji javni oglas „nudim usluge”. Veštine, alat, vozila, iskustvo i dostupnost pripadaju radnom profilu, a ne javnoj objavi.

Obično su dozvoljeni, uz redovnu proveru: sačekati majstora u stanu uz ovlašćen pristup; fotografisati stanje prostora koji korisnik ima pravo da fotografiše; sačekati u redu; doneti dozvoljen dokument ili paket; pomoći da se unese ormar; sklapanje nameštaja; pratnja odrasle osobe do lekara bez pružanja zdravstvene usluge; kupovina svakodnevnih namirnica; šetanje psa ili uobičajena briga o kućnom ljubimcu; društvo i pomoć odrasloj osobi koja nije profesionalna zdravstvena ili socijalna nega.

## 3. Šta se dešava pri objavi

Pre objave zadatak prolazi proveru pravila. Ishod je jedan od četiri:

| Ishod | Šta znači |
|---|---|
| **Objava dozvoljena** | jasan, konkretan zahtev bez zabranjenog ili nerazrešenog rizičnog signala |
| **Potrebno pojašnjenje ili ispravka** | zadatak može biti prihvatljiv, ali se javni tekst ili činjenice prvo moraju ispraviti ili dopuniti |
| **Potreban pregled** | nerazrešen, visokorizičan ili regulisan slučaj; ne objavljuje se dok ne postoji pregledano pravilo |
| **Nije moguće objaviti** | zadatak se ne može objaviti na USKOČI-ju |

Samo ishod „objava dozvoljena” dovodi do objave. Oznaka **HITNO** nikada ne zaobilazi pravila. Ako je proveru nemoguće završiti (pravilo nedostaje, zastarelo je ili je u sukobu), ishod je „potreban pregled”, ne objava. Ishod možete osporiti kroz podršku (tema „Pregled odluke o objavi”).

## 4. Šta se ne objavljuje

Zadatak se ne može objaviti ako:

1. je zapravo ponuda usluge ili samoreklama („Nudim krečenje”, „Radim selidbe”);
2. je prodaja, izdavanje ili drugi oglas, a ne traženi zadatak;
3. je neželjena poruka, promocija, preporuka uz proviziju ili nepovezano oglašavanje;
4. sadrži ciljano vređanje, uznemiravanje, poniženje, govor mržnje ili diskriminatoran napad na drugo lice ili grupu;
5. sadrži pretnju, zastrašivanje, nasilje ili zahtev da se neko povredi ili uplaši;
6. traži krađu, prevaru, falsifikovanje, lažno predstavljanje, utaju poreza ili drugo izričito zaobilaženje zakona (uključujući „radnike na crno”);
7. traži uhođenje, tajni nadzor, objavljivanje tuđih privatnih podataka ili prikupljanje tuđih naloga, lozinki ili privatnih podataka bez ovlašćenja;
8. ima za cilj seksualnu eksploataciju, trgovinu ljudima, plaćene seksualne usluge ili sadrži seksualni sadržaj koji uključuje maloletnike;
9. traži nabavku, prodaju ili prenos nezakonitih droga ili zaobilaženje kontrole opojnih sredstava, štetnu nabavku ili prenos oružja i municije, ili pirotehniku kao običan zadatak.

Primeri: „Treba mi neko da ode kod njega i zaplaši ga” - nije moguće objaviti. „Treba mi 6 neprijavljenih radnika, na crno” - nije moguće objaviti.

## 5. Šta se mora ispraviti pre objave

- vulgarne reči u inače prihvatljivom zadatku (bez ciljanog vređanja): očistiti javni tekst;
- javno objavljen telefon, email, tačna kućna adresa, QR kod, isprava ili drugi privatni podatak koji ne treba da bude javan: ukloniti iz javne izmene (privatni podaci se unose u polja za privatnu adresu i napomene za pristup);
- zadatak koji nije dovoljno jasan ili mu fali bitna činjenica: dopuniti.

Primeri: „Potrebno 6 ljudi za rad na gradilištu” - potrebno pojašnjenje šta tačno rade.

## 6. Regulisane i visokorizične oblasti

Za oblasti u kojima pravila Platforme nemaju posebno pregledan propis, zadatak dobija ishod „potreban pregled” i za sada se ne objavljuje. To se odnosi na jasno visokorizične ili regulisane kategorije, a Platforma ne tvrdi da je ovaj spisak potpun niti da svaka objavljena kategorija ispunjava sve zakonske uslove. Ne proverava se da li osoba koja se kasnije prijavi ima sve licence, poreski status, registraciju, osiguranje, dozvolu ili pravo na rad, osim ako USKOČI izričito proveri konkretnu činjenicu u posebnoj funkciji. `[[PROVERITI: tačna granica između „dozvoljeno” i „potreban pregled” za svaku oblast pre objave; pravila nisu pravno pregledana]]`

Polazna razmatranja po oblastima (izvor RC2; primena zavisi od pregledanog pravila):

- **Težak fizički rad i bezbednost:** za nošenje tereta, istovar, rad na visini, alat, električnu ili gasnu opasnost prikupljaju se činjenice (težina, broj ljudi, sprat i lift, oprema, alat, pristup, poznati rizik). Korisnik uvek može odbiti da započne ili nastavi rad koji je razumno nebezbedan ili materijalno različit od potvrđenog Dogovora.
- **Elektrika, gas, građevina i stručni radovi:** „sklopite policu” nije isto što i stručan rad na električnoj ili gasnoj instalaciji; posebne licence, ovlašćenja i nadzor ostaju obavezni.
- **Prevoz stvari i putnika:** pomoć pri selidbi ili nošenju može biti običan zadatak; profesionalni komercijalni prevoz tuđe robe i prevoz putnika za novac imaju poseban pravni režim i ne objavljuju se kao običan zadatak bez pravno potvrđenog modela.
- **Zdravstvo:** pratnja do lekara i donošenje stvari nisu zdravstvena usluga. Injekcije, dijagnostika, terapija i profesionalna nega traže licencirani model ili se blokiraju. HITNO ne zamenjuje hitnu medicinsku službu.
- **Privatno obezbeđenje:** „sačekajte dostavu u mojoj kući” nije nužno obezbeđenje; čuvanje objekta ili lica kao obezbeđenje ulazi u regulisanu oblast.
- **Deca i ranjiva lica:** čuvanje deteta, profesionalna nega nemoćnog lica i drugi visokorizični zadaci traže poseban bezbednosni i pravni model; do tada se ne objavljuju.
- **Životinje i lekovi:** šetanje, hranjenje i uobičajena briga mogu biti dozvoljeni; veterinarska dijagnostika, injekcije i lečenje traže licencu. Kupovina ili preuzimanje leka zavisi od režima izdavanja i ovlašćenja; Platforma ne podstiče zaobilaženje recepta ni neovlašćenu prodaju leka.
- **Duvan, nikotin, pirotehnika, alkohol, otpad, poštanske usluge:** duvan, nikotin i pirotehnika se ne objavljuju; alkohol, opasan otpad, šut, baterije, ulje i hemikalije, azbest i sistematski poštanski ili kurirski prenos zahtevaju poseban model ili se ne objavljuju. Premeštanje stvari nije isto što i odbacivanje stvari. `[[PROVERITI: ova RC2 razmatranja još nisu pravila politike objave (izvor: RC2 sloj usklađivanja §6-8); uskladiti sa pregledanim pravilima]]`
- **Pravo na rad stranaca i prekogranični zadaci:** nalog ne potvrđuje pravo na rad u državi izvršenja.
- **Novac i ovlašćenja:** kupovina uz povraćaj novca, avans, podizanje gotovine, službena dokumenta i pravne radnje u tuđe ime zahtevaju dodatnu pažnju; Platforma ne drži novac za kupovinu.

## 7. Diskriminacija

Zabranjeni su zadaci i kriterijumi koji nezakonito diskriminišu po zaštićenom ličnom svojstvu. Legitiman bezbednosni ili licencni uslov nije diskriminacija samo zato što ograničava podobnost, ali mora imati stvaran pravni ili bezbednosni razlog. Preporuke ne koriste zaštićena svojstva za nelegitimno isključivanje.

## 8. Ponašanje korisnika u komunikaciji

Korisnici ne smeju: vređati ili pretiti; uznemiravati; slati neželjeni seksualni sadržaj; objavljivati tuđe privatne podatke; slati neželjene poruke; lažno ocenjivati ili pokušavati da manipulišu reputacijom; organizovati nezakonite aktivnosti van Platforme preko poruka.

## 9. Prijava i blokiranje

Svaki korisnik može:

- **prijaviti** osobu ili sadržaj kroz aplikaciju: izborom kategorije (uznemiravanje, prevara, nebezbedan rad, diskriminacija, drugo), kratkim razlogom i opisom. Prijava je privatna: druga strana ne dobija tekst prijave, njen broj ni identitet podnosioca;
- **blokirati** drugog korisnika; blokada može prekinuti običan kontakt tokom aktivnog Dogovora, uz očuvane bezbedne izlaze: prijava i podrška ostaju dostupne i kada običan razgovor više nije dozvoljen;
- **prijaviti sadržaj ili recenziju** kroz podršku (tema „Prijava sadržaja ili recenzije”) i zatražiti pregled odluke.


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod:** pasus obećava „prioritet” za prijavu neposredne opasnosti; server nema polje prioriteta ni garantovan rok, postoji samo zasebna lista bezbednosnih prijava za operatera.

Prijava koja opisuje neposrednu opasnost dobija prioritet. Platforma nije služba hitne pomoći: u opasnosti pozovite nadležnu službu. `[[OPERATER: broj hitnih službi u državi izdanja; ko prima i obrađuje bezbednosne prijave i u kom roku; LEG-14]]`

**ZAMENA 2026-10-02 (odeljak 9, poslednji pasus; javni tekst, nacrt):** Platforma nije služba hitne pomoći: u neposrednoj opasnosti pozovite nadležnu službu u svojoj državi `[[OPERATER: izjava o hitnim službama u državi izdanja, LEG-01 OP-52]]`. Bezbednosne prijave se vode u zasebnoj listi koju ručno obrađuje lice koje USKOČI odredi `[[OPERATER: ko, LEG-01 OP-50]]`; aplikacija ne daje prioritet, rok reakcije ni hitnu meru, a status „primljeno” znači samo da je prijava primljena.


## 10. Kako sprovodimo pravila


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod:** pasus obećava trenutnu hitnu zaštitu, upozorenje, ograničenje funkcije, suspenziju i deaktivaciju, kao i obaveštenje o razlogu i žalbi; takvi postupci i funkcije ne postoje, a odluka podrške ima dejstvo `NONE`.

Hitna zaštita može biti trenutna kada postoji ozbiljan bezbednosni signal. Ostale mere su proporcionalne, imaju razlog i evidentiraju se. Mere mogu biti upozorenje, ograničenje funkcije, suspenzija ili deaktivacija (Uslovi, odeljak 26). Prijava sama po sebi nije dokaz krivice. Kada je mera značajna, korisnik dobija obaveštenje o razlogu, dejstvu i načinu pregleda ili žalbe (Reklamacije, podrška, žalbe). `[[PROVERITI: ozbiljne sankcije se ne uvode bez stvarnog drugog pregleda ili drugog kanala (RC2 Otkazivanje §12); proveriti stanje procesa]]`

**ZAMENA 2026-10-02 (odeljak 10; javni tekst, nacrt):** Pravila se danas sprovode na tri načina: proverom zadatka pre objave (odeljak 3), blokiranjem koje korisnik sam postavlja (odeljak 9) i skrivanjem teksta komentara uz ocenu koji krši pravila. Odluka podrške je odgovor na zahtev i sama po sebi nema dejstvo na nalog, Dogovor, objavu ni ocenu. USKOČI nema postupak upozorenja, ograničenja funkcija, suspenzije ni deaktivacije naloga, niti trenutne zaštite pre izjašnjenja. Prijava sama po sebi nije dokaz krivice. `[[ODLUKA VLASNIKA: da li se mere nad nalogom uvode i kojim postupkom]]`


## 11. Ocene


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” ispod:** pasus govori samo o oceni bez teksta; paket D12 (opcioni pisani komentar) je primenjen na razvojnu bazu 2026-10-02, pa pravila sadržaja važe i za tekst komentara.

Ocena se daje samo za stvarno završen Dogovor. Plaćene, lažne, naručene ocene i osvetnički sadržaj nisu dozvoljeni; ocena ne sme sadržati pretnje, privatne podatke, govor mržnje ni neosnovanu optužbu za krivično delo. Platforma ne uklanja legitimnu negativnu ocenu samo zato što je negativna (Uslovi, odeljak 23).

**ZAMENA 2026-10-02 (odeljak 11; javni tekst, nacrt):** Ocena (zvezdice i oznake) daje se samo za stvarno završen Dogovor. Uz ocenu može da stoji opcioni pisani komentar. Plaćene, lažne, naručene ocene i osvetnički sadržaj nisu dozvoljeni; komentar ne sme sadržati pretnje, privatne podatke, govor mržnje ni neosnovanu optužbu za krivično delo. USKOČI ne uklanja ocenu zato što je negativna; tekst komentara koji krši pravila može da se sakrije, a ocena i prosek ostaju. Komentar ne može da se izmeni ni obriše posle slanja. Prijava komentara ide kroz podršku (tema „Prijava sadržaja ili recenzije”); aplikacija ne obećava rok ni obaveštenje o odluci. Vidi i Uslove, odeljak 23.


## 12. Šta pravila ne obećavaju

Pravila ne garantuju da će svaka povreda biti otkrivena ni da je svaki korisnik pouzdan. Oznaka ili podatak koji je korisnik sam naveo (identitet, licenca, veština) nije garancija. Verifikacija identiteta nije isto što i stručna licenca, pravo na rad ili provera prošlosti. Zabrana je uvek konkretna i sa razlogom, ne generički otkaz odgovornosti.

## 13. Kontakt

Bezbednosne prijave: u aplikaciji i `[[OPERATER: email za bezbednost]]`. Prijava nezakonitog sadržaja, povrede autorskih prava ili privatnosti: `[[OPERATER: email ili obrazac, LEG-07]]`.

---

## Prilog: sledljivost (INTERNO - ukloniti pre objave)

| Odeljak | Izvor |
|---|---|
| 1 | RC2 Safety §1 |
| 2 | `RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md` („Product boundary”); RC2 Safety §3 |
| 3 | `RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md` („Minimum outcomes”, RS-MIN-001, 015, 016); `PUBLICATION_ACTIVATION_READINESS.md`; `SupportPresentation.tsx:23` |
| 4 | RS-MIN-002, 003, 004, 006, 007, 008, 009, 010, 011; primeri iz istog dokumenta |
| 5 | RS-MIN-005, 012, 013 |
| 6 | RS-MIN-014; RC2 Safety §4-13; RC2 sloj usklađivanja §6-8 (poštanske usluge, otpad, regulisana roba); `RS_PUBLICATION_POLICY...` („What this minimum policy intentionally does not decide yet”) |
| 7 | RC2 Safety §14 |
| 8 | RC2 Safety §19 |
| 9 | `src/data/safetyClientService.ts:5`; `src/ui/safety/SafetyScreen.tsx:19`; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` (odeljci 1-2, AF-D05); `SupportPresentation.tsx:24` |
| 10 | RC2 Safety §21; RC2 Otkazivanje §12 |
| 11 | RC2 Uslovi §23 |
| 12 | RC2 Uslovi §5; Safety §1 |
| 13 | RC2 Uslovi §1; Reklamacije §14; LEG-01 OP-13, OP-14 |


> **SUPERSEDED 2026-10-02 by „ZAMENA 2026-10-02” u odeljku 11:** sledeća napomena kaže da je paket D12 samo kandidat i da nije primenjen. Paket je primenjen na razvojnu bazu 2026-10-02 (migracija `20261002044950`, ledger 221); napomena ostaje kao istorija.

## D12 napomena (kandidat, NIJE primenjen)

> Dodato 2026-10-01. Paket „D12 pisani komentar uz ocenu“ je samo kandidat u repozitorijumu (`supabase/candidates/d12_review_comment.sql`); nije primenjen na DEV i zahteva izričitu odluku vlasnika. Do tada tvrdnje iznad o oceni bez slobodnog teksta ostaju tačne i ovaj dokument se ne menja. Ako se paket primeni, uticaj na ovaj dokument je ograničen na: odeljak 11 (Ocene): pravila sadržaja bi važila i za tekst komentara. Opcioni pisani komentar postoji dok postoji nalog autora; briše se pri zatvaranju naloga autora; komentar koji je moderacijom skriven i komentar o osobi koja je zatvorila nalog se zadržavaju (skriveni od prikaza); rok čuvanja je unos vlasnika/pravnika i nijedan broj nije izmišljen. Pravni osnov, DPIA, moderator i rok odgovora ostaju `[[PROVERITI]]`. Izvor: `supabase/proofs/d12/README_D12_CANDIDATE.md`, `docs/implementation/product-v1-closure-20260926/finalization-20260927/d12/D12_CLOSURE_INVENTORY_SUCCESSOR_20261001.json`.

## INTERNO - dopune sledljivosti 2026-10-02 (ukloniti pre objave)

| Zamena | Izvor |
|---|---|
| Odeljak 9 (prioritet, hitne službe) | DEV-čitanje 2026-10-02: tabela `private.support_cases_v5` nema kolonu `priority`; operaterska lista režima `SAFETY` je razdvajanje liste (`docs/implementation/v5-ai-first/SUPPORT_CASE_API_143.md`: „No fake SLA”); `docs/implementation/legal-drafts-20260930/LEG-14_moderacija_i_podrska_operativni_postupci.md` odeljak 2; `src/ui/safety/SafetyScreen.tsx` ne sadrži izraz o hitnim službama (pretraga 2026-10-02) |
| Odeljak 10 (mere) | DEV-čitanje 2026-10-02: `support_decisions_v5_effect_check` (`effect` = `NONE`); nijedna funkcija ne postavlja `SUSPENDED`; `rpc_moderate_review_comment_service_v1` skriva samo tekst komentara; AF-D18 „no new sanctions” |
| Odeljak 11 (ocene i komentar) | `supabase/proofs/d12/README_D12_CANDIDATE.md` (odeljak „Text rules” i tačke 8, 16, 17); LEG-02 odeljak 23; **tvrdnja da ocene bez komentara ostaju samo u zbiru ne sme da se koristi**. Senka komentara uz blokadu (tačka 16) i javni zbir uz pojedinačne ocene (tačka 17) su posledice koje je vlasnik prihvatio primenom D12; da li se saopštavaju korisnicima je `[[ODLUKA VLASNIKA]]` (LEG-09 odeljak 7.3.1, LEG-12 N-14). |

Nepromenjeno u ovom osvežavanju: odeljci 1 do 8, 12 i 13.

**Ispravka 2026-10-02 (pregled ispravki):** odeljak 1 (treća rečenica) više nije nepromenjen: označen je (SUPERSEDED i ZAMENA). Nepromenjeni su odeljci 2 do 8, 12 i 13.
