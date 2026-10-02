# LEG-14 · Moderacija i podrška: operativni postupci

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-14 (master plan 16.2, „Moderation / support operations”): ko prima, razvrstava i odlučuje; šta server dozvoljava operateru; šta se ne obećava |
| Status | DRAFT-FROM-CODE za stanje koda i baze; operater, kanali, radno vreme, rokovi i hitni postupak: DATA-PENDING-OWNER |
| Datum | 2026-10-02 (EX-07, slice S04) |
| Izvor | repozitorijum, grana `work/uskoci-ui-unification-20260924`, HEAD `0b9cd8c9`; razvojna baza `leqcwgzvjsxugfgzdmth`, samo čitanje (SELECT preko konektora) 2026-10-02, 08:39 do 09:24 UTC (na kraju čitanja ledger je i dalje 221 i svi pinovi tela funkcija su nepromenjeni), bez ličnih podataka i korisničkog teksta: samo brojevi, definicije i tela funkcija. Dalje: **DEV-čitanje 2026-10-02**. |
| Vezani nacrti | LEG-05 (pravila), LEG-07 (reklamacije i žalbe), LEG-10 (izuzeci zatvaranja), LEG-15 (zahtevi lica), LEG-01 (OP-07, OP-10..OP-14, OP-25, OP-50..OP-57) |

Oznake: `[[OPERATER: ...]]` (podatak operatera), `[[ODLUKA VLASNIKA: ...]]` (odluka), `[[PROVERITI: ...]]` (činjenica ili pravno pitanje) kao u LEG-02.

**Dopuna 2026-10-02 (ispravke posle pregleda):** nacrt je pisan na HEAD `0b9cd8c9`; odluke vlasnika od 2026-10-02 (`docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`, svih 75 predloga prihvaćeno u 11:02) uračunate su samo gde piše „ODLUČENO 2026-10-02” ili „odluka vlasnika”: A04 (odeljci 1 i 2) i A30 (odeljci 4.2, 5 i 6). Spisak izmena: `CHANGELOG_20261002.md`, odeljak „Review fixes (2026-10-02)”.

## 0. Pravila ovog dokumenta

1. Dokument beleži šta server **dozvoljava** i šta operater **ne može**. Ništa od sledećeg nije obećano jer ne postoji u kodu: prioritet, rok, dežurstvo, mera, sankcija (odeljak 2).
2. Svaki podatak operatera (ko, kako, kada, kojim kanalom) je `[[OPERATER: ...]]`. Ništa nije izmišljeno.
3. Odluka podrške je **zapis odgovora**: njeno polje `effect` može imati samo vrednost `NONE`. Odluka sama ne menja Dogovor, ocenu, objavu, nalog ni dug.
4. U privatnom testu jedini mogući operater je vlasnik projekta preko jednog postojećeg naloga (odluka AF-D18). To nije registrovano lice, služba koja dežura ni nezavisan žalbeni organ (`docs/implementation/v5-ai-first/SUPPORT_CASE_CONTRACT_PROPOSAL.md`, uvodni deo).

## 1. Šta server danas radi

| Mogućnost | Stanje | Izvor |
|---|---|---|
| Predmet podrške | Kanali: `SERVICE`, `TASK`, `SAFETY`, `LEGAL_PRIVACY`. Teme: `TECHNICAL`, `COLLABORATION`, `NO_SHOW`, `SERVICE_COMPLAINT`, `CONTENT_NOTICE`, `PRIVACY_RIGHTS`, `PUBLICATION_REVIEW`, `SAFETY_REPORT`, `OTHER`. Stanja: `RECEIVED`, `IN_REVIEW`, `WAITING_FOR_AUTHOR`, `DECIDED`, `CLOSED`. Naslov 1 do 200 znakova, poruka 1 do 4000, željeni ishod do 1000, obrazloženje odluke 1 do 4000. | DEV-čitanje 2026-10-02 (CHECK ograničenja tabela `private.support_cases_v5`, `support_events_v5`, `support_decisions_v5`); nazivi na ekranu: `src/ui/support/SupportPresentation.tsx:18-30` |
| Istorija je samo dodavanje | Događaji i odluke se ne menjaju ni ne brišu (okidač `support_immutable_v5`); predmet štiti okidač `support_case_guard_v5`. Nijedna funkcija u `public` ni `private` ne briše iz tabela predmeta, događaja, odluka, žalbi, dokaza ni bezbednosnih prijava (pretraga tela funkcija). | DEV-čitanje 2026-10-02 |
| Operater | Tabela `private.support_operator_grants_v5` ima ograničenje `singleton` (najviše jedan red) i svrhu `PRIVATE_TEST_OWNER_SUPPORT`. Grant se dodeljuje i opoziva samo servisnom funkcijom `rpc_support_set_operator_service_v5` (jedan aktivan nalog; pre promene mora opoziv). Na DEV je **0 grantova**. | DEV-čitanje 2026-10-02; `docs/implementation/v5-ai-first/SUPPORT_CASE_API_143.md` (odeljak „Service only”) |
| Pristup operatera se beleži | Tabela `private.support_operator_audit_v5` (radnja, predmet, revizija granta, vreme). | DEV-čitanje 2026-10-02 |
| Odluka | Ishod `ACCEPTED` ili `REJECTED`, šifra razloga po obrascu `^[A-Z][A-Z0-9_]{0,63}$`, obrazloženje, `effect` = `NONE`. Dokazi u odluci moraju već pripadati istom predmetu. | DEV-čitanje 2026-10-02 (CHECK `support_decisions_v5_effect_check`); `SUPPORT_CASE_API_143.md` |
| Žalba (ponovni pregled) | Posebna radnja na tačan identifikator odluke; stanja `RECEIVED`, `IN_REVIEW`, `DECIDED`. Isti jedini operater može da je razmotri; u aplikaciji se zove „ponovni pregled”, ne „nezavisni pregled”. | DEV-čitanje 2026-10-02; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 3; `SupportPresentation.tsx:217` |
| Bezbednosna prijava | Pet kategorija: `HARASSMENT`, `FRAUD`, `UNSAFE_WORK`, `DISCRIMINATION`, `OTHER`; razlog 1 do 200 znakova, opis do 2000. Svaka prijava otvara privatni predmet kanala `SAFETY` (okidač `support_safety_capture_v5`), a stanje prijave (`RECEIVED`, `IN_REVIEW`, `RESOLVED`) prati stanje predmeta (`rpc_support_submit_v5`). Prijavljena strana ne dobija tekst prijave. | DEV-čitanje 2026-10-02; `src/ui/safety/SafetyScreen.tsx:19,160` |
| Blokiranje | Red u `private.account_blocks` (par naloga, aktivno, revizija; bez teksta). Zaustavlja običan kontakt i nova povezivanja; završetak, otkazivanje i prijava problema u postojećem Dogovoru ostaju. | DEV-čitanje 2026-10-02 (kolone); `SafetyScreen.tsx:23` |
| Problem u Dogovoru | `rpc_report_problem` upisuje problem u poruke Dogovora; vide ga obe strane; **nije** prijava operateru i ne otvara predmet. | `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 2 |
| Prijava pitanja uz zadatak | Radnja „Prijavi pitanje” samo postavlja stanje pitanja `REPORTED` („Prijava zabeležena”); ne otvara predmet ni red za obradu. Rukovalac ne postoji (EX-07 G02). | `src/ui/qa/TaskQaPresentation.tsx:52,60`; `src/contracts/preselectionQa.ts:7` |
| Komentar uz ocenu (D12) | Moderacija je servisna funkcija `rpc_moderate_review_comment_service_v1(review, akcija, šifra razloga, ključ zahteva)`: `HIDE` ili `RESTORE`, **samo tekst komentara**; zvezdice, broj ocena i prosek se ne diraju. Beleži događaj `AGREEMENT_REVIEW_COMMENT_HIDDEN` ili `AGREEMENT_REVIEW_COMMENT_RESTORED` sa identifikatorima i šifrom, bez teksta. Nema obaveštenja autora, automatizma ni AI. Ponovljena ista akcija ne menja ništa; sakrivanje pod drugom šifrom traži prethodno vraćanje (`REVIEW_COMMENT_MODERATION_CONFLICT`, PT409). | DEV-čitanje 2026-10-02 (telo md5 `2de37076287d759515407eecccc92728`, jednak priznanici D12 `supabase/operations/dev-alpha/ledger/20261002_d12_review_comment_application.receipt.json`); `supabase/proofs/d12/README_D12_CANDIDATE.md` |
| Glasovne poruke | Nema moderacije, prepisa ni AI obrade. Prijava poruke nosi samo fiksnu oznaku „Glasovna poruka (zvuk nije deo prijave).”; u prvom izdanju podrška ne može da čuje prijavljenu glasovnu poruku (odluka vlasnika A04, 2026-10-02: poznato ograničenje, odeljak 2). | `docs/implementation/product-v1-closure-20260926/finalization-20260927/VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md` (odeljci 2 i 6) |
| Obaveštenja | Ne postoji vrsta događaja za odgovor podrške, ishod prijave, skrivanje komentara ni zatvaranje; ograničenje `user_activity_events_event_type_check` dozvoljava 24 vrste i nijedna nije vezana za podršku ili bezbednost. Jedini znak je oznaka „nepročitano” u inboxu (`rpc_support_mark_read_v5`). | DEV-čitanje 2026-10-02 |
| Kvote običnih predmeta | Do 5 novih predmeta u 24 sata po nalogu (`SUPPORT_CASE_DAILY_LIMIT`), najmanje 60 sekundi između dva nova (`SUPPORT_CREATE_COOLDOWN`), do 50 dopuna u 24 sata (`SUPPORT_REPLY_DAILY_LIMIT`). Od kvote je izuzeta samo tema `PRIVACY_RIGHTS` (i bezbednosni predmeti, koji nastaju iz prijave sa `ordinary=false`): vidi odeljak 4.1. | DEV-čitanje 2026-10-02 (`rpc_support_submit_v5`, telo md5 `c30469f1c599e23eaa56163dc1b5b362`; `private.support_safety_case_v5(private.safety_reports,boolean)`, telo md5 `dfa1e697149fa569ffb6b621dffeb21f`) |

## 2. Šta ne postoji (obećanja koja se ne daju)

| Obećanje koje se često očekuje | Stanje | Izvor |
|---|---|---|
| Prioritetna obrada bezbednosnih prijava | Nema polja prioriteta: tabela `private.support_cases_v5` nema kolonu `priority`. Operater ima zasebnu listu režima `SAFETY`; to je razdvajanje liste, ne obećanje vremena reakcije. „No fake SLA” je odredba ugovora. | DEV-čitanje 2026-10-02 (kolone); `SUPPORT_CASE_API_143.md`; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 3 |
| Hitna zaštitna mera pre izjašnjenja | Ugovor podrške ne poznaje takvu radnju: odluka ima `effect` = `NONE`, a stanje `SUSPENDED` nema pisca (red ispod). Platforma nije služba hitne pomoći. | DEV-čitanje 2026-10-02 (CHECK); `SUPPORT_CASE_API_143.md` |
| Upozorenje, ograničenje funkcije, suspenzija ili deaktivacija naloga | Stanje profila `SUSPENDED` postoji u ograničenju `app_profiles_status_check` i aplikacija ga prikazuje („Profil je obustavljen. Piši podršci.”), ali nijedna funkcija ne postavlja to stanje: u telima svih funkcija izvan sistemskih šema samo jedan čitač pominje reč `SUSPENDED`. Sankcije ne uvodi ni odluka (AF-D18, „no new sanctions”). | DEV-čitanje 2026-10-02; `src/app/(app)/profil.tsx:84` |
| Uklanjanje ili skrivanje zadatka, poruke, fotografije ili cele recenzije | Ne postoji. Jedini izuzetak je skrivanje **teksta komentara** uz ocenu (odeljak 1). | DEV-čitanje 2026-10-02 |
| Obaveštavanje i izjašnjenje druge strane | Ne postoji; poziv drugoj strani nije uključen (`SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 3). | isto |
| Nezavisan drugi pregled | Ne postoji; „ponovni pregled” radi isti operater. | odeljak 1 |
| Dežurstvo, radno vreme, rok odgovora, eskalacija | Ne postoje. `[[OPERATER: radno vreme i rokovi, LEG-01 OP-51]]` | `SUPPORT_CASE_API_143.md` („No fake SLA, push delivery or provider”) |
| Obaveštenje o odgovoru (push ili e-pošta) | Push: ne postoji (nema vrste događaja, odeljak 1, „Obaveštenja”). E-pošta: ugovor podrške je ne uključuje („Spoljni push/email ne uključuje se implicitno”). | DEV-čitanje 2026-10-02; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 6 |
| Obaveštenje o vansudskom rešavanju potrošačkih sporova na ekranu podrške | Ne postoji u aplikaciji (pretraga izraza o vansudskom rešavanju, ministarstvu i potrošaču u `src/` bez pogodaka, 2026-10-02). | pretraga `src/` |
| Da podrška čuje prijavljenu glasovnu poruku | **Poznato ograničenje (odluka vlasnika A04, 2026-10-02):** u prvom izdanju podrška ne može da čuje prijavljenu glasovnu poruku. Prijava nosi samo fiksnu oznaku „Glasovna poruka (zvuk nije deo prijave).”, a operater ne vidi zvuk (odeljak 3.6). Ograničenje se piše otvoreno; nijedan tekst ne sme da sugeriše da podrška sluša, ni ručno ni automatski. | `docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md` (A04); `docs/implementation/product-v1-closure-20260926/finalization-20260927/VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md` (odeljci 2 i 6) |

## 3. Postupak operatera (kostur: bez vrednosti)

Nijedna stavka ispod nije izvršena. Svaka je mesto za podatak operatera.

### 3.1 Imenovanje i pristup
Operater: `[[OPERATER: ime i uloga, LEG-01 OP-50]]`. Nalog kome se dodeljuje pristup: `[[OPERATER: nalog]]`. Ko odobrava dodelu i opoziv: `[[OPERATER: odgovorno lice, OP-07]]`. Dodela ide servisnom funkcijom (odeljak 1), uz vlasnikovo „primeni” za svaku DEV radnju (AGENTS.md 3.1.8); ključ servisne uloge nikad ne ide u chat, repozitorijum ni dnevnike. Tačan postupak dodele i opoziva, proveru posle i povratak treba da napiše EX-07 slice S05 (u radnom stablu 2026-10-02 ga **nema**).

### 3.2 Prijem
U aplikaciji: Podrška (teme iz odeljka 1) i privatna bezbednosna prijava. Van aplikacije: `[[OPERATER: kanali za bezbednost, reklamacije, sadržaj i prava lica, LEG-01 OP-10..OP-14]]`. Zahtev koji stigne van aplikacije ne postaje predmet sam od sebe: `[[OPERATER: kako se unosi u evidenciju]]`.

### 3.3 Razvrstavanje i redosled
Servis ne daje prioritet; redosled obrade bira operater. `[[OPERATER: kriterijumi redosleda i šta se računa kao neposredna opasnost]]`. Neposredna opasnost se ne rešava preko aplikacije: `[[OPERATER: postupak i kontakt prema nadležnim službama, LEG-01 OP-52]]`.

### 3.4 Obrada predmeta
Preuzimanje (`CLAIM`), zahtev za dopunu (`REQUEST_INFO`), odgovor (`OPERATOR_REPLY`), odluka (`DECIDE`), zatvaranje (`CLOSE`); žalba: `CLAIM_APPEAL`, `DECIDE_APPEAL` (`SUPPORT_CASE_API_143.md`). Kada je operater istovremeno podnosilac predmeta, uloga podnosioca ima prednost: nema lažno nezavisnog odlučivanja. Šabloni odgovora: `[[OPERATER: šabloni]]`.

### 3.5 Odluke
Ishod i šifra razloga su na operateru; obrazloženje je obavezno. Odluka ne menja ništa osim što se vidi u predmetu (`effect` = `NONE`). Ako je za stvarnu posledicu potreban drugi autoritet (objava zadatka, otkazivanje, ocena), on se zasebno definiše i ovde se ne obećava. Spisak šifara razloga: `[[OPERATER: šifre]]`.

### 3.6 Dokazi
Operater vidi samo tekst koji je podnosilac poslao, izabrane reference i neophodan kontekst koji server sam sastavlja kao nepromenljiv snimak; ne vidi ceo razgovor, tuđu prijavu, privatnu cenu, tačnu adresu, kontakt ni zvuk (`SUPPORT_CASE_API_143.md`; `SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 3).

### 3.7 Komentari uz ocenu
1. Nađi komentar po identifikatoru Dogovora i autoru, preko postojećih kanala prijave (`supabase/proofs/d12/README_D12_CANDIDATE.md`, odeljak „Operator procedure for moderation”).
2. `HIDE` sa šifrom razloga, ili `RESTORE`; ništa drugo ne postoji (nema brisanja ni izmene teksta).
3. Autor i ocenjena osoba se ne obaveštavaju; ishod se ne može videti u aplikaciji osim kao nestanak teksta.
4. Šifre razloga i pravila odlučivanja: `[[OPERATER: spisak šifara i ko odlučuje, LEG-01 OP-57]]`.
5. Rok odgovora na prijavu komentara: `[[OPERATER: rok]]`; nijedan broj nije obećan.
6. Zapis o skrivanju ne sadrži tekst komentara. Ocenjena osoba ne dobija tekst komentara ni u izvozu (LEG-15 odeljak 3.4).

### 3.8 Hitni slučajevi
Aplikacija nema hitnu liniju ni dežurnu službu. Tekst za korisnike: `[[OPERATER: izjava o hitnim službama u državi izdanja, LEG-01 OP-52]]`. Obećanja o prioritetu, brzini i hitnim merama se ne daju (odeljak 2).

### 3.9 Povreda podataka
Odgovorno lice, kontakt nadležnog organa i evidencija: `[[OPERATER: postupak, LEG-01 OP-25]]`. U repozitorijumu nema postupka (LEG-09 odeljak 4).

### 3.10 Rokovi i dostupnost
`[[OPERATER: radno vreme i rokovi odgovora, LEG-01 OP-51]]`. Zakonski rok od RC2 (LEG-07 §4) je zabeležen sadržaj izvora, a ne proverena tvrdnja o važećem pravu i ne generički rok podrške (`SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 7).

## 4. Razlike između usvojenog ugovora i servera (za odluku, bez ispravke koda)

### 4.1 Obim kvote predmeta
Usvojeni ugovor kaže da bezbednosni, privatnost (prava lica) i formalni pravni ili potrošački kanali ne troše običnu kvotu (`SUPPORT_CASE_CONTRACT_PROPOSAL.md` odeljak 5, poslednji red; `SUPPORT_CASE_API_143.md`: „Only PRIVACY_RIGHTS and SAFETY do not consume ordinary case/reply quotas”). Server izuzima samo temu `PRIVACY_RIGHTS` (`v_ordinary:=p->>'topic'<>'PRIVACY_RIGHTS'`). Zato **troše kvotu** i teme `SERVICE_COMPLAINT` („Reklamacija na USKOČI uslugu”) i `CONTENT_NOTICE` („Prijava sadržaja ili recenzije”), kao i sve ostale obične teme. Posledica za tekstove: LEG-07 ne sme da obeća da reklamacija ili prijava sadržaja nisu ograničene. Izmena izuzetka je izmena funkcije koju obuhvata sertifikat zatvaranja (telo `private.closure_source_digest_v5()` imenuje `rpc_support_submit_v5`, DEV-čitanje 2026-10-02) i zato pomera sertifikat (EX-07 G19; `EX07_CANONICAL_SCOPE_20261001.md` odeljak 11). Odluka vlasnika: prihvatiti i objaviti razliku, ili tražiti izmenu (zaseban paket sa „primeni” i imenovanim ponovnim vezivanjem sertifikata), ili odrediti kanal van aplikacije `[[OPERATER: kanal]]`.

### 4.2 Zatvaranje naloga staje kod izuzetaka
Nalog sa predmetom podrške, bezbednosnom prijavom (kao podnosilac **ili kao ciljna osoba**), zadržavanjem razgovora, zaštićenim Dogovorom ili medijem ne može da stigne do `CLOSED`: obični podaci se obrišu, pristup se ograniči, a Auth identitet ostaje (`EXCEPTIONS_PENDING`). Nijedna funkcija ne oslobađa izuzetak, ne briše predmet ni prijavu, i nema poništavanja pokrenutog zatvaranja. Dakle, svako ko je bezbednosnom prijavom prijavljen, ili je podneo prijavu ili predmet podrške, ostaje u tom stanju dok ne postoji pravilo i postupak. Vidi LEG-15 odeljak 5 i LEG-10 odluka 5. Nije viđeno uživo (0 zatvaranja na DEV) i dokazano je samo na jednokratnom lancu (`EX07_CANONICAL_SCOPE_20261001.md` G13).

**ODLUČENO 2026-10-02 (A30, `docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`):** vlasnik prihvata ovu granicu i objavljuje je u javnom tekstu; ništa još nije objavljeno, a tekst ostaje NACRT do pravnog pregleda. Otvoreno ostaje samo ono što A30 ne rešava: ko oslobađa izuzetak i kojim pravilom, rokovi i čuvanje dokaza za takve slučajeve (LEG-10 odluka 5 i ostatak odluke 15; LEG-01 OP-56).

### 4.3 Operater je vlasnikov nalog
U privatnom testu operater je vlasnikov nalog; za probu toka potreban je drugi nalog (autor) jer uloga autora ima prednost (`EX07_CANONICAL_SCOPE_20261001.md` G09).

### 4.4 Nema obaveštenja
Odgovor, odluka, skrivanje komentara i ishod prijave ne šalju push ni obaveštenje u aplikaciji: za njih ne postoji vrsta događaja (jedini znak je oznaka „nepročitano” u inboxu). Dodavanje vrste događaja menja ograničenje (sertifikat zatvaranja) i dodiruje push (EX-07 G20).

## 5. Provera pre nego što se kaže da se prijave obrađuju

| # | Uslov | Stanje 2026-10-02 |
|---|---|---|
| 1 | Imenovan operater i izvršen grant | **ne** (0 grantova) |
| 2 | Kanal za podnosioce van aplikacije | **ne** |
| 3 | Zapisan i odobren postupak i rokovi | **ne** |
| 4 | Dokaz sa dva naloga i operaterom: prijava, automatski predmet, preuzimanje, odluka, podnosilac vidi ishod, žalba (EX-07 slice S05) | **nije urađeno** (0 predmeta, 0 prijava) |
| 5 | Odluka o kvoti (odeljak 4.1) | otvoreno |
| 6 | Granica izuzetaka zatvaranja (odeljak 4.2) i pravila za njih | granica: **ODLUČENO 2026-10-02 (A30)**: prihvaćena i objavljuje se; pravila oslobađanja, rokovi i čuvanje dokaza: otvoreno |
| 7 | Obaveštenje o vansudskom rešavanju, ako operater nastupa kao trgovac prema potrošaču | **ne** `[[PROVERITI]]` |
| 8 | Postupak moderacije komentara i obaveštavanje autora (odeljak 3.7) | otvoreno |

## 6. Odluke i ulazi vlasnika (nijedan nije dat ovim dokumentom)

1. Imenovani operater, nalog i način odobravanja (LEG-01 OP-50) i vlasnikova reč za dodelu granta na DEV.
2. Kanali van aplikacije, radno vreme, rokovi i hitni postupak (OP-10..OP-14, OP-51, OP-52).
3. Kvota predmeta (odeljak 4.1).
4. Izuzeci zatvaranja i rok čuvanja bezbednosnih prijava i predmeta (LEG-10 odluka 5; OP-56). Granicu je vlasnik prihvatio i objavljuje je (A30, 2026-10-02); otvoreno ostaju pravila oslobađanja, rokovi i čuvanje dokaza.
5. Pravila moderacije komentara, šifre razloga i obaveštavanje autora (OP-57).
6. Da li prijava pitanja uz zadatak dobija rukovaoca (EX-07 G02) ili se tekst ekrana prilagođava stanju.
7. Pravni status operatera prema potrošačima i obaveštenje o vansudskom rešavanju (LEG-07 odeljak 6).
