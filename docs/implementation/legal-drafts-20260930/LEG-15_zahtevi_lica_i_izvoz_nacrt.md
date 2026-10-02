# LEG-15 · Zahtevi lica na koje se podaci odnose: izvoz, pristup, ispravka, brisanje

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-15 (master plan 16.2, „Rights requests / export”); sadrži mapu obima izvoza naspram zatvaranja naloga po klasama podataka (EX-07 praznina G16) |
| Status | DRAFT-FROM-CODE za stanje koda i baze; postupci, rokovi, kanali i identitet operatera: DATA-PENDING-OWNER |
| Datum | 2026-10-02 (EX-07, slice S04) |
| Izvor | repozitorijum, grana `work/uskoci-ui-unification-20260924`, HEAD `0b9cd8c9`; razvojna baza `leqcwgzvjsxugfgzdmth`, samo čitanje (SELECT preko konektora) 2026-10-02, 08:39 do 09:24 UTC (na kraju čitanja ledger je i dalje 221 i svi pinovi tela funkcija su nepromenjeni), bez ličnih podataka i korisničkog teksta: samo brojevi, definicije i tela funkcija. Dalje: **DEV-čitanje 2026-10-02**. |
| Vezani nacrti | LEG-04 §15-16, LEG-08, LEG-09 (P-24, P-25), LEG-10, LEG-14, LEG-01 (OP-12, OP-33, OP-50..OP-57) |

Oznake: `[[OPERATER: ...]]` (podatak operatera), `[[ODLUKA VLASNIKA: ...]]` (odluka), `[[PROVERITI: ...]]` (činjenica ili pravno pitanje) kao u LEG-02.

**Dopuna 2026-10-02 (ispravke posle pregleda):** nacrt je pisan na HEAD `0b9cd8c9`; odluka vlasnika od 2026-10-02 (`docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`, svih 75 predloga prihvaćeno u 11:02) uračunata je samo gde piše „ODLUČENO 2026-10-02”: R12 (odeljak 4). Spisak izmena: `CHANGELOG_20261002.md`, odeljak „Review fixes (2026-10-02)”.

## 0. Pravila ovog dokumenta

1. Nijedan operativni podatak nije izmišljen: ko prima i obrađuje zahtev, kanal, rok odgovora, način provere identiteta i evidencija su `[[OPERATER: ...]]`.
2. Pravna pitanja (osnov, zakonski rokovi, obim prava) su `[[PROVERITI: ...]]`. Nijedan rok čuvanja ni rok odgovora nije upisan.
3. Izvoz **nije** „svi tvoji podaci”: to je pregledana JSON projekcija, „not a claim that every internal database field or binary object is included” (`docs/implementation/v5-ai-first/EXPORT_PROJECTION.md`). Izraz „svi tvoji podaci” i slični (kompletna kopija) ne koriste se u aplikaciji, javnim tekstovima, odgovorima za prodavnice ni u odgovorima licima.
4. Dokument opisuje šta kod i baza **danas** rade. Izvoz danas ne može da se pokrene (odeljak 2.2), pa nijedan tekst ne sme da obeća kopiju.

## 1. Prava iz LEG-04 §15 i šta za njih danas postoji

Spisak prava preuzet je iz LEG-04 §15 („u skladu sa primenljivim pravom”); koja prava stvarno važe je `[[PROVERITI]]`.

| Pravo | Šta postoji danas | Šta ne postoji | Izvor |
|---|---|---|---|
| Pristup i kopija podataka | Komanda izvoza u aplikaciji (Profil - Privatnost i podaci - Izvoz podataka). Server je odbija sa `DATA_EXPORT_POLICY_NOT_READY` dok vezivanje isporuke nije aktivno; na DEV je vezivanje prazno (`data_export_policy_binding()` je `null`). Nijedan fajl izvoza nije nastao (0 redova u `private.data_export_artifacts`). Jedan zahtev (datum 2026-09-13) je u stanju `REQUESTED`. | Objavljena pravila čuvanja, aktivna Politika privatnosti, objava vezivanja isporuke (odeljak 2.2); obaveštenje „kopija je spremna” (nema vrste događaja, EX-07 G20); prikaz uslova pre dodira dugmeta (EX-07 G03, slice S01) | DEV-čitanje 2026-10-02 (`rpc_request_data_export(text)` telo md5 `1276797dea9502ea261e2dead96ba9ff`; `private.data_export_artifacts` 0 redova; `public.data_export_requests` 1 red, stanje `REQUESTED`, datum 2026-09-13); `src/data/dataExportClientService.ts:14` |
| Prenosivost | Izvoz je JSON (`data-export-artifacts` prima samo `application/json`). | Tvrdnja da je format „uobičajen, mašinski čitljiv” i da obuhvata sve što se prenosi `[[PROVERITI]]` | DEV-čitanje 2026-10-02 (`storage.buckets`: `data-export-artifacts`, privatan, ograničenje 8388608 bajtova, `application/json`) |
| Ispravka | U aplikaciji: prikazno ime naručioca (komanda sa proverom revizije), polja radnog profila, podaci zadatka. | Grad iz registracije, email adresa i lozinka nemaju uređivač (lozinka samo preko veze za oporavak). Tekst komentara uz ocenu se ne menja ni ne briše posle slanja (odluka D12: nema izmene ni brisanja). Ostalo: podrška. | `src/data/requesterProfileClientService.ts`; `src/data/workerProfileClientService.ts`; EX-07 scope `EX07_CANONICAL_SCOPE_20261001.md` (ispravka tvrdnje PA-01); `supabase/proofs/d12/README_D12_CANDIDATE.md` (odluke koje obavezuju kandidata) |
| Brisanje | Zatvaranje naloga u aplikaciji: `rpc_review_account_closure_execution`, `rpc_start_account_closure_execution`, `rpc_read_account_closure_execution`. Obični lični sadržaj se briše ili zamenjuje, pa se briše Auth identitet, osim kada postoji izuzetak (odeljak 5). Poništavanja pokrenutog zatvaranja nema (nijedna `public` funkcija sa „closure” i „cancel” u imenu). | Put van aplikacije (nema stranice, obrasca ni Edge prijema); rešavanje izuzetaka; javni tekst koji objašnjava izuzetke i rokove | DEV-čitanje 2026-10-02 (`pg_proc`: 13 `public` funkcija sa „closure” u imenu, 7 za `authenticated`); EX-07 scope G13, G14; `docs/implementation/v5-ai-first/ACCOUNT_ERASURE_API_146.md` |
| Ograničenje obrade, prigovor, pritužba na odluku, ostala prava | Tema podrške „Privatnost i prava” (`PRIVACY_RIGHTS`); jedina tema koja ne troši običnu kvotu predmeta. Predmet obrađuje ručno ovlašćeni operater. | Operater, kanal van aplikacije, rok odgovora, postupak provere identiteta, evidencija zahteva (DSR) | DEV-čitanje 2026-10-02 (`rpc_support_submit_v5` telo md5 `c30469f1c599e23eaa56163dc1b5b362`: `v_ordinary:=p->>'topic'<>'PRIVACY_RIGHTS'`; 0 operaterskih grantova); LEG-14 |
| Povlačenje saglasnosti | Prihvatanje pravnih dokumenata je dobrovoljno i ništa ne zavisi od njega; nijedna obrada se ne oslanja na zabeležen pristanak. | Odluka kada se saglasnost traži i šta znači povlačenje `[[PROVERITI]]` | DEV-čitanje 2026-10-02 (`public.account_legal_acceptance_events` 0 redova; tabelu čitaju samo `rpc_accept_legal_bundle`, `rpc_get_legal_bundle`, `rpc_read_my_legal_acceptance` i snimak izvoza; nijedna politika, pogled ni okidač je ne pominje); LEG-13 |
| Automatizovano odlučivanje | AI samo predlaže; ishod objave zadatka daje pravilo; Dogovor potvrđuju ljudi (LEG-09 odeljak 4). | Pravna ocena `[[PROVERITI]]` | LEG-09 odeljak 4 |

## 2. Izvoz u aplikaciji: tok i preduslovi

### 2.1 Tok (kako je izgrađen)

| Korak | Šta radi | Izvor |
|---|---|---|
| Zahtev | `rpc_request_data_export(text)`: traži prijavljenog korisnika i ključ zahteva; ponovljen isti ključ vraća isti zapis; najviše jedan otvoren zahtev po nalogu (`REQUESTED` ili `PROCESSING`); beleži događaj `DATA_EXPORT_REQUESTED` u evidenciji. Greške: `AUTH_REQUIRED`, `INVALID_CLIENT_REQUEST_ID`, `DATA_EXPORT_POLICY_NOT_READY`, `DATA_EXPORT_REQUEST_ALREADY_OPEN`. | DEV-čitanje 2026-10-02 (telo funkcije) |
| Obrada | Radnik `uskoci-data-export-worker` (Edge) poziva servisnu funkciju `rpc_claim_data_export`; ona iznutra sastavlja JSON snimak (`private.data_export_snapshot(...)`) i vraća ga radniku, koji upisuje privremeni objekat u privatni Storage i potvrđuje ishod (`rpc_complete_data_export`, a pri grešci `rpc_fail_data_export`); `rpc_renew_data_export_lease` produžava zakup. | DEV-čitanje 2026-10-02 (telo `rpc_claim_data_export(uuid,uuid)` poziva `private.data_export_snapshot`; ACL: ove funkcije su samo za servisnu ulogu); `supabase/functions/uskoci-data-export-worker/index.ts` |
| Preuzimanje | Edge `uskoci-data-export-download` poziva `rpc_authorize_data_export_download` (prijavljen korisnik) i `rpc_resolve_data_export_download` (servisna uloga), pa čita objekat; korisnik može da otkaže zahtev (`rpc_cancel_data_export`) ili da opozove preuzimanje (`rpc_revoke_data_export_download`). | DEV-čitanje 2026-10-02 (ACL); `supabase/functions/uskoci-data-export-download/index.ts`; `src/data/dataExportClientService.ts` |
| Čišćenje | Posle isteka vezanog roka briše se privremeni snimak i objekat (`rpc_claim_data_export_cleanup`, `rpc_complete_data_export_cleanup`, `private.data_export_maintenance`). Fajl koji je korisnik već sačuvao ne može se opozvati. | DEV-čitanje 2026-10-02; LEG-10 M-2 |

Verzije Edge funkcija nisu ponovo čitane 2026-10-02; poslednje zapisano stanje: radnik izvoza v14 i preuzimanje v14 (`docs/implementation/product-v1-closure-20260926/finalization-20260927/EX07_CANONICAL_SCOPE_20261001.md`, odeljak 3, čitano 2026-10-01).

### 2.2 Preduslovi koje funkcija proverava (`private.data_export_policy_binding()`)

Izvor: DEV-čitanje 2026-10-02, telo funkcije md5 `3695d063e7c8fa9f835b5e8cc34b5926`. Funkcija vraća `null` (izvoz se odbija) osim ako su **svi** uslovi ispunjeni:

| # | Uslov | Stanje na DEV 2026-10-02 |
|---|---|---|
| 1 | Postoji aktivan skup pravila čuvanja (`private.retention_policy_sets`, nije povučen, stupio na snagu) | 0 redova |
| 2 | Njegovo polje `export_delivery` ima tačno predviđene ključeve, `schemaVersion` = `USKOCI_EXPORT_DELIVERY_V2`, `projectionVersion` = `OWN_ACCOUNT_V5_10`, `cleanupMode` = `DELETE_EXPORT_COPY`, `snapshotCleanupMode` = `DELETE_TEMP_SNAPSHOT`, i sopstveni SHA-256 sadržaja | nema skupa pa nema polja |
| 3 | `projectionSha256` je jednak živoj projekciji `53848e48d1a01082fcbd1413e4f9210b43153a9eb75e7af2723aa8c40f32b597` (funkcija `private.data_export_projection_sha_v5()`) | projekcija postoji, vezivanje ne |
| 4 | Tri vremena trajanja (`artifactLifetimeSeconds`, `snapshotLifetimeSeconds`, `downloadLifetimeSeconds`) su pozitivni celi brojevi koji ne prelaze gornje granice zapisane u kodu: 2592000, 2592000 i 900 sekundi; trajanje preuzimanja ne sme biti duže od trajanja fajla. **Ovo su tehničke gornje granice provere, nisu ni rok čuvanja ni predlog roka.** | nisu zadata |
| 5 | Postoji aktivan, stupio na snagu dokument `PRIVACY` u `private.legal_document_versions` sa istim `privacyDocumentId` i `privacyContentSha256` | 0 redova |
| 6 | Za svaku aktivnu obaveznu klasu podataka postoji pravilo čuvanja i bar jedan skup izvoza te klase | klase: 15 od 15 aktivne i obavezne; skupovi izvoza postoje za svih 15 (odeljak 3); pravila čuvanja: 0 |
| 7 | `datasets` ima tačno 52 unosa; svaki je `INCLUDE` (1 do 64 polja iz kataloga) ili `EXCLUDE` (sa `reasonCode`); `account` ne sme da se isključi i mora da sadrži `id`; skupovi `mediaMetadata`, `ownedMediaAssets`, `ownAgreementPhotos`, `ownAgreementVoice` i `ownSupportEvidence` moraju da sadrže `bytesIncluded` | nema pregleda skupova |

Postupak objave **ne postoji**: nijedna funkcija u `public` ni `private` ne piše u `private.legal_document_versions` (pretraga tela funkcija, 0 pogodaka), a `rpc_publish_retention_policy` (samo servisna uloga, telo md5 `8eee1f6a742990990392b4e2e8bd7b21`) ne pominje `export_delivery`. Kandidat za mehanizam (bez vrednosti) treba da napiše EX-07 slice S09 (u radnom stablu 2026-10-02 ga **nema**). Do tada izvoz ostaje nedostupan i aplikacija to iskreno kaže.

### 2.3 Šta izvoz sadrži (52 skupa, 15 klasa)

Projekcija `OWN_ACCOUNT_V5_10` (DEV-čitanje 2026-10-02, `private.data_export_dataset_catalog()` telo md5 `b19598a0ad6547de9609da121f5d4a3e`): 52 skupa, svaki sa fiksnom listom polja i filterom vlasništva. Od D12 skup `ownAgreementReviews` nosi i **sopstveni** komentar autora (`comment`), nikad primljeni. Glasovne poruke ulaze samo kao metapodaci (`ownAgreementVoice`: identifikatori, stanje, trajanje, veličina; nikad zvuk), što važi i za fotografije (`bytesIncluded`). Izvor: `supabase/operations/dev-alpha/ledger/20261002_d12_review_comment_application.receipt.json`; `supabase/operations/dev-alpha/ledger/20261001_chat_voice_b1_application.receipt.json`.

## 3. Mapa obima: izvoz naspram zatvaranja naloga, po klasama podataka (EX-07 G16)

### 3.1 Metod i pinovi

Poređeni su: (a) katalog izvoza `private.data_export_dataset_catalog()` (52 skupa); (b) katalog klasa zatvaranja `private.closure_dataset_catalog_v5` (15 klasa); (c) spisak relacija programa brisanja `private.closure_redaction_relations_v5()` (redosled i opseg po relaciji); (d) telo funkcije `private.closure_redaction_patch_v5(...)` (šta se radi sa kojom relacijom); (e) telo funkcije `private.data_export_snapshot(...)`: koje relacije čita (pretraga `FROM`/`JOIN` u telu; tri pomoćne funkcije `data_export_scalar_v5`, `data_export_task_facts_v5`, `data_export_worker_candidate_v5` ne čitaju nijednu tabelu, DEV-čitanje 2026-10-02).

| Pin (DEV-čitanje 2026-10-02) | md5 tela |
|---|---|
| `private.closure_redaction_relations_v5()` | `ba362b6d0045d06e6207fc0a8f0592d4` |
| `private.closure_redaction_scope_v5(text)` | `aec26bb057ec0022245a5d8641a47585` |
| `private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)` | `3891fe77d38af04e06cfe4c9e4abb96f` |
| `private.data_export_dataset_catalog()` | `b19598a0ad6547de9609da121f5d4a3e` |
| `private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)` | `a50e4f7203df2a65cff264ee2471c13c` |

Ovi md5 su jednaki vrednostima iz priznanice primene D12 (`supabase/operations/dev-alpha/ledger/20261002_d12_review_comment_application.receipt.json`, polje `newBodies`). Ako se bilo koja od ovih funkcija promeni, mapu treba ponoviti. Mapa je izvedena iz tela funkcija i kataloga; **nije** pregled po skupu i nije pravni zaključak.

Zbirno: 107 relacija je u katalogu klasa (15 klasa), 76 je u programu zatvaranja, 31 je van njega; izvoz čita 53 relacije (36 iz programa zatvaranja, 17 van njega). Dakle 40 relacija iz programa zatvaranja izvoz ne čita (među njima 1 koju zatvaranje ostavlja bez izmene (red 68) i 1 sa samo heš kolonama (red 52)), a 14 relacija ostaje posle zatvaranja i ne ulazi ni u izvoz.

### 3.2 Po klasama

| Klasa (`data_class`) | Skupovi izvoza (ključevi) | Relacija u katalogu | U programu zatvaranja (radnje u Prilogu A) | Van programa (ostaje, Prilog B) | U programu, a izvoz ih ne čita | Van programa, a izvoz ih ne čita |
|---|---|---|---|---|---|---|
| `ACCOUNT_IDENTITY` | 1: `account` | 1 | 1 | 0 | 0 | 0 |
| `AGREEMENT_CORE` | 2: `agreements`, `ownGroupMemberships` | 7 | 3 | 4 | 3 | 2 |
| `AGREEMENT_MESSAGES` | 2: `ownAgreementMessages`, `ownGroupMessages` | 4 | 4 | 0 | 2 | 0 |
| `AGREEMENT_REVIEWS` | 1: `ownAgreementReviews` | 2 | 1 | 1 | 0 | 0 |
| `AI_VOLATILE` | 5: `aiMessages`, `workerAiDrafts`, `workerAiReviews`, `taskAiReviews`, `taskAiFacts` | 8 | 8 | 0 | 1 | 0 |
| `AUDIT_SECURITY_LOGS` | 10: `ownAudit`, `ownSafetyReports`, `ownBlocks`, `testAdmission`, `testAllocations`, `ownSupportCases`, `ownSupportEvents`, `ownSupportDecisions`, `ownSupportAppeals`, `ownSupportEvidence` | 18 | 8 | 10 | 6 | 2 |
| `COMMAND_LEDGERS` | 13: `exportRequests`, `workerAiTurns`, `workerAiSaves`, `taskReviewCommands`, `taskAiTurns`, `qaClassifications`, `qaCommands`, `closureRequests`, `closureExecution`, `closureActions`, `ownLocationCommands`, `ownSupportCommands`, `ownErasureSteps` | 30 | 20 | 10 | 12 | 6 |
| `LEGAL_CONSENT` | 1: `consent` | 1 | 0 | 1 | 0 | 0 |
| `MEDIA_OBJECTS` | 5: `mediaMetadata`, `ownedMediaAssets`, `ownAcceptedTaskMedia`, `ownAgreementPhotos`, `ownAgreementVoice` | 6 | 3 | 3 | 0 | 2 |
| `NEED_PUBLIC` | 1: `needs` | 4 | 3 | 1 | 2 | 1 |
| `NEED_SENSITIVE` | 2: `needPrivate`, `ownLocationSnapshots` | 4 | 4 | 0 | 2 | 0 |
| `NOTIFICATION_DELIVERY` | 2: `notifications`, `ownSupportReadMarkers` | 8 | 8 | 0 | 6 | 0 |
| `PRESELECTION_QA` | 2: `ownQuestions`, `ownAnswers` | 4 | 4 | 0 | 2 | 0 |
| `PROFILE_DATA` | 4: `profiles`, `availabilityWindows`, `availabilityRules`, `calendar` | 6 | 6 | 0 | 2 | 0 |
| `RESPONSES_SELECTION` | 1: `responses` | 4 | 3 | 1 | 2 | 1 |
| **Ukupno** | **52** | **107** | **76** | **31** | **40** | **14** |

Kako se čita: „U programu zatvaranja” je broj relacija klase koje obrađuje program zatvaranja (briše, menja ili, za dve relacije, ostavlja bez izmene; radnje u Prilogu A). „Van programa” ostaje posle zatvaranja (pseudonimni minimum, dokazi, potvrde; Prilog B). „Izvoz ih ne čita” znači da se naziv relacije ne pojavljuje u telu funkcije `data_export_snapshot`.

### 3.3 Razlike na nivou kolona (samo gde se imena poklapaju)

| Relacija / skup izvoza | Kolone koje zatvaranje menja | U skupu izvoza | Menja se, a nije u skupu |
|---|---|---|---|
| `public.app_accounts` / `account` | `city`, `email`, `full_name`, `phone` | sva četiri (`city`, `email`, `fullName`, `phone`) | nijedna |
| `public.app_profiles` / `profiles` | 21 kolona | 7 (`bio`, `city`, `display_name`, `headline`, `operating_country_code`, `profile_status`, `skills`) | 14: `available_now`, `available_now_expires_at`, `avatar_path`, `exclusions`, `licenses`, `minimum_fee_rsd`, `portfolio`, `radius_km`, `rating_requester`, `rating_worker`, `team_capacity`, `tools`, `vehicles`, `years_experience` |
| `public.needs` / `needs` | 21 kolona | 4 (`description`, `ends_at`, `starts_at`, `title`) | 17: `approximate_area`, `approximate_city`, `approximate_lat`, `approximate_lng`, `category`, `public_photo_paths`, `remaining_search_close_reason`, `requester_price_rsd`, `required_licenses`, `required_skills`, `required_tools`, `required_vehicles`, `response_deadline`, `urgent`, `urgent_activated_at`, `urgent_expires_at`, `urgent_policy_version` |
| `public.marketplace_responses` / `responses` | `scope_note`, `bounded_message` | `scopeNote`, `message` | nijedna |
| `public.agreement_messages` / `ownAgreementMessages` | `body`, `photo_asset_ids`, `voice_asset_id` | `body`, `assetIds`, `voiceAssetId` | nijedna |

Napomena: kolone „menja se, a nije u skupu” mogu delimično da se pojave u drugim skupovima (na primer u `taskAiFacts` ili `workerAiDrafts`); ova mapa to ne prati. Poređenje je po imenu, ne po sadržaju.

### 3.4 Šta izvoz ne sadrži po konstrukciji (filter vlasništva)

Svaki skup se filtrira po autoru ili vlasniku (ključ `ownershipFilter` u elementima kataloga). Zato izvoz ne sadrži: poruke koje je napisala druga strana Dogovora, ocene i komentare koje su drugi dali o osobi (`ownAgreementReviews` je filtriran po autoru ocene), prijave u kojima je osoba samo ciljna strana, blokade koje su drugi postavili, ni zbirnu reputaciju (`rating_requester`, `rating_worker`). Posledica koju je vlasnik prihvatio pri primeni D12 (tačka 3 priznanice): **osoba o kojoj je napisan komentar ne može da dobije kopiju onoga što su drugi napisali o njoj**, dok ekran zatvaranja kaže da se obični podaci uklanjaju. Da li to ispunjava pravo na pristup je `[[PROVERITI]]`. Izvor: `supabase/proofs/d12/README_D12_CANDIDATE.md` (tačka 3 odeljka „What the owner's PRIMENI must knowingly accept”).

### 3.5 Šta se sme reći o obimu

| Dozvoljeno (činjenica) | Nije dozvoljeno |
|---|---|
| „Kopija sadrži podatke koji su navedeni u Politici privatnosti i spisku skupova izvoza” (kada spisak postoji) | „svi tvoji podaci”, „kompletna kopija”, „sve što čuvamo o tebi” |
| „Fotografije i glasovne poruke ulaze u kopiju samo kao opis (bez fajla)” | „kopija sadrži tvoje fotografije i snimke” |
| „Ono što su drugi napisali o tebi nije u kopiji” (dok je tako) | tvrdnja da kopija obuhvata ocene, komentare ili poruke koje su ti drugi poslali |
| „Posle zatvaranja naloga ostaju pseudonimni zapisi i izdvojeni dokazi” | „posle zatvaranja ne ostaje ništa” |

## 4. Zahtev bez pristupa nalogu (van aplikacije)

Ne postoji: nema stranice, obrasca, Edge prijema ni evidencije zahteva (EX-07 G14; `docs/implementation/release-prep-20260930/RELEASE_CONFIG_MATRIX.md` C-43). Šta mora da se odredi (nijedna vrednost nije data):

| Stavka | Vrednost |
|---|---|
| Ko prima i obrađuje zahteve | `[[OPERATER: ime i uloga odgovornog lica, LEG-01 OP-33]]` |
| Kanal (adresa, obrazac) | `[[OPERATER: kanal za prava lica, LEG-01 OP-12, OP-16]]` |
| Provera identiteta bez novih podataka | `[[OPERATER: postupak, LEG-01 OP-53]]` |
| Evidencija zahteva (DSR) | `[[OPERATER: gde i kako se beleži; zasebna tabela je nova relacija i menja sertifikat zatvaranja]]` |
| Rok odgovora | `[[OPERATER: rok]]` `[[PROVERITI: zakonski rok]]` |
| Kako se pokreće isto zatvaranje kao u aplikaciji | `[[ODLUKA VLASNIKA: postupak]]` (LEG-08 odeljak 3) |

**ODLUČENO 2026-10-02 (R12, `docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`), detalji i dalje `[[OPERATER]]` i `[[PROVERITI]]`:** zahteve bez pristupa nalogu ručno obrađuje operater; identitet se proverava preko email adrese naloga; stranica se objavljuje tek kada domen postoji (do tada putanja van aplikacije ne postoji). Ostaje otvoreno i ostaje `[[OPERATER: ...]]`: ko je operater, kanal (adresa ili obrazac), tačan postupak provere, evidencija zahteva (DSR) i rok odgovora (LEG-01 OP-33, OP-53..OP-55).

## 5. Izuzeci i ograničenja prava

| Situacija | Šta kod radi danas | Izvor |
|---|---|---|
| Nalog ima predmet podrške, bezbednosnu prijavu (kao podnosilac **ili kao ciljna osoba**), zadržavanje razgovora, zaštićen Dogovor ili zaštićen medij | Zatvaranje briše obične podatke, ograničava pristup i staje na stanju `EXCEPTIONS_PENDING`; Auth identitet ostaje. Nijedna funkcija ne oslobađa izuzetak ni ne briše predmet ili prijavu, i nema poništavanja. Zato se zatvaranje takvog naloga ne završava dok ne postoji pravilo i postupak (LEG-10 odluka 5). | DEV-čitanje 2026-10-02 (`private.closure_erasure_exceptions_v5(uuid)` telo md5 `727910cbb39ab9413e12d99cf39c5116`; `rpc_claim_account_closure_action_service(uuid,uuid)` telo md5 `eedef6f857cc753d8597dc6d2d263956` vraća `EXCEPTIONS_PENDING` kada je sledeći korak brisanje Auth identiteta, a spisak izuzetaka nije prazan; pretraga tela funkcija u `public` i `private`: nijedna ne briše iz tabela predmeta podrške ni bezbednosnih prijava); `docs/implementation/v5-ai-first/ACCOUNT_ERASURE_API_146.md` |
| Sadržaj druge strane Dogovora | Ne briše se zbog zatvaranja naloga koji se zatvara | LEG-10 redovi 3, 5, 7, 8 |
| Komentar uz ocenu o osobi koja zatvara nalog | Skriven pri čitanju, **zadržan bez datuma isteka dok njegov autor ne zatvori svoj nalog** | `supabase/proofs/d12/README_D12_CANDIDATE.md` tačka 4 |
| Kopije kod davalaca, rezervne kopije, dnevnici | Van kontrole USKOČI-ja | LEG-10 odeljak 5 |

## 6. Operativni postupak (kostur, bez vrednosti)

1. Prijem zahteva: `[[OPERATER: kanali]]`; potvrda prijema i evidencioni broj `[[OPERATER: način]]`.
2. Provera identiteta: `[[OPERATER: postupak bez prikupljanja dodatnih podataka]]`.
3. Razvrstavanje: pristup / kopija / ispravka / brisanje / ograničenje / prigovor / drugo.
4. Izvršenje u aplikaciji kada je moguće (izvoz kada postane dostupan; zatvaranje kroz postojeći tok); inače ručno `[[OPERATER: ko i kako]]`.
5. Odgovor i obrazloženje (uključujući izuzetke iz odeljka 5) `[[OPERATER: šablon]]`.
6. Evidencija ishoda bez prepisivanja sadržaja zahteva u dnevnike.
7. Rokovi: `[[OPERATER: rok]]` `[[PROVERITI: zakonski rok]]`.

Sve što ovaj dokument ne daje ostaje otvoreno do odluka u odeljku 8.

## 7. Redosled aktivacije izvoza (nije izvršen, ništa ne sme da se primeni bez vlasnikovog „primeni”)

1. Odluke i pravni pregled: pravila čuvanja za svih 15 klasa i tri trajanja (LEG-10 odeljak 6), tekst i adresa Politike privatnosti (LEG-01).
2. Mehanizam objave bez vrednosti (EX-07 slice S09): u radnom stablu 2026-10-02 ga nema.
3. Dokaz na jednokratnom lancu: objava sa sintetičkim vrednostima, zahtev, radnik, fajl, preuzimanje, istek.
4. Vlasnikovo „primeni” za DEV, uz zapisano da li pomera sertifikat zatvaranja (AGENTS.md 3.1.2, 3.1.4).
5. Provera prekidača radnika (ne mogu se pročitati spolja) i probni izvoz na jednokratnom nalogu uz vlasnikovu reč.

## 8. Odluke i ulazi vlasnika (nijedan nije dat ovim dokumentom)

1. Pravila čuvanja za svih 15 klasa i trajanja fajla, snimka i preuzimanja (LEG-10 odluke 1-12) `[[ODLUKA VLASNIKA]]` i pregled pravnika.
2. Da li izvoz treba da obuhvati ono što su drugi napisali o osobi (komentari, ocene, poruke) ili se prihvata trenutno stanje (odeljak 3.4) `[[ODLUKA VLASNIKA]]` `[[PROVERITI]]`.
3. Da li se u izvoz dodaju relacije iz programa zatvaranja koje izvoz ne čita (40 relacija, Prilog A) ili se prihvata da su operativne `[[ODLUKA VLASNIKA]]`.
4. Obaveštenje „kopija je spremna” (nova vrsta događaja menja sertifikat zatvaranja i dodiruje push) ili samo stanje u aplikaciji (EX-07 G20).
5. Operater, kanal, provera identiteta i rok za zahteve van aplikacije (odeljak 4).
6. Rešavanje izuzetaka zatvaranja (odeljak 5, LEG-10 odluka 5).

## Prilog A · Relacije programa zatvaranja (76), redosled izvršenja i čitanje u izvozu

Izvor: DEV-čitanje 2026-10-02 (spisak i redosled: `private.closure_redaction_relations_v5()`; radnja: čitanje tela `private.closure_redaction_patch_v5(...)`; „Izvoz čita relaciju”: telo `private.data_export_snapshot(...)`).

Oznake radnje: **DELETE** briše se red; **DELETE\*** briše se red osim zaštićenih dokaza (zaštita se proverava po objektu); **UPDATE** menjaju se navedene kolone fiksnom oznakom ili praznom vrednošću; **UPDATE?** menja se uslovno (uslov u koloni „Šta se menja”); **RECEIPT** potvrde komande (`receipt`, `result`) zamenjuju se fiksnom oznakom, a kolone heševa izvedene iz sadržaja heš vrednošću; **HASH** nema zamene sadržaja (samo kolone heševa izvedene iz sadržaja, ako postoje); **KEPT** ostaje bez izmene (samo metapodaci). Aktivno zadržavanje razgovora, zaštićen Dogovor ili medij i nezavršeno otpremanje mogu da zadrže ili odlože red (telo funkcije).

| # | Relacija | Klasa | Radnja pri zatvaranju | Šta se menja | Izvoz čita relaciju |
|---|---|---|---|---|---|
| 1 | `private.requester_identity_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 2 | `private.worker_ai_saves` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | da |
| 3 | `private.ai_task_review_commands` | `COMMAND_LEDGERS` | UPDATE | evaluation_binding, evaluation, published (fiksna oznaka, ako nisu null) | da |
| 4 | `private.ai_task_reviews` | `AI_VOLATILE` | UPDATE | envelope | da |
| 5 | `private.worker_ai_reviews` | `AI_VOLATILE` | UPDATE | envelope | da |
| 6 | `private.worker_ai_sessions` | `AI_VOLATILE` | UPDATE | candidate | da |
| 7 | `public.ai_action_proposals` | `AI_VOLATILE` | DELETE | - | ne |
| 8 | `public.ai_structured_facts` | `AI_VOLATILE` | DELETE | prvo se razvezuje superseded_by | da |
| 9 | `public.ai_messages` | `AI_VOLATILE` | DELETE | - | da |
| 10 | `private.ai_need_turn_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | da |
| 11 | `private.worker_ai_turns` | `AI_VOLATILE` | RECEIPT | receipt, result | da |
| 12 | `public.ai_conversations` | `AI_VOLATILE` | HASH | - | da |
| 13 | `private.need_draft_save_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 14 | `private.need_edit_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 15 | `private.need_publish_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 16 | `private.response_submit_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 17 | `private.response_withdraw_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 18 | `private.response_revision_resolution_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 19 | `private.remaining_search_close_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 20 | `private.preselection_qa_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | da |
| 21 | `private.qa_ai_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | da |
| 22 | `private.need_publication_decisions` | `COMMAND_LEDGERS` | UPDATE | public_geography_snapshot, public_media_refs, reviewer_provenance, service_provenance | ne |
| 23 | `private.need_revision_events` | `NEED_PUBLIC` | UPDATE | new_material_snapshot, previous_material_snapshot | ne |
| 24 | `private.preselection_qa_answer_versions` | `PRESELECTION_QA` | UPDATE | answer_text | da |
| 25 | `private.preselection_qa_questions` | `PRESELECTION_QA` | UPDATE | question_text | da |
| 26 | `private.preselection_qa_policy_decisions` | `PRESELECTION_QA` | UPDATE | service_provenance | ne |
| 27 | `private.preselection_qa_materiality_decisions` | `PRESELECTION_QA` | UPDATE | service_provenance | ne |
| 28 | `private.response_application_snapshots` | `RESPONSES_SELECTION` | UPDATE | worker_licenses, worker_skills, worker_tools, worker_vehicles | ne |
| 29 | `public.marketplace_response_versions` | `RESPONSES_SELECTION` | UPDATE | scope_note (ne za zaštićen Dogovor) | ne |
| 30 | `public.marketplace_responses` | `RESPONSES_SELECTION` | UPDATE | scope_note, bounded_message (ne za zaštićen Dogovor) | da |
| 31 | `public.agreement_invalidations_v1` | `AGREEMENT_MESSAGES` | DELETE | - | ne |
| 32 | `public.agreement_messages` | `AGREEMENT_MESSAGES` | UPDATE | body, photo_asset_ids, voice_asset_id | da |
| 33 | `private.group_messages_v5` | `AGREEMENT_MESSAGES` | UPDATE | body | da |
| 34 | `public.agreement_versions` | `AGREEMENT_CORE` | UPDATE? | scope_note unutar terms, samo kada je autor nalog koji se zatvara i Dogovor nije zaštićen | ne |
| 35 | `public.agreement_change_proposals` | `AGREEMENT_CORE` | UPDATE? | scope_note unutar proposed_terms i reason, samo za sopstveni predlog i ako Dogovor nije zaštićen | ne |
| 36 | `public.agreement_execution` | `AGREEMENT_CORE` | UPDATE? | problem_narrative se ne menja kada je prijava problema otvorena (izuzetak: ostaje) | ne |
| 37 | `private.agreement_location_points` | `NEED_SENSITIVE` | DELETE | - | da |
| 38 | `private.agreement_location_commands` | `COMMAND_LEDGERS` | HASH | - | da |
| 39 | `public.need_sensitive` | `NEED_SENSITIVE` | DELETE | - | da |
| 40 | `public.need_geography` | `NEED_SENSITIVE` | DELETE | - | ne |
| 41 | `public.need_requirement_details` | `NEED_PUBLIC` | DELETE | - | ne |
| 42 | `public.needs` | `NEED_PUBLIC` | UPDATE | approximate_area, approximate_city, approximate_lat, approximate_lng, category, description, ends_at, public_photo_paths, remaining_search_close_reason, requester_price_rsd, required_licenses, required_skills, required_tools, required_vehicles, response_deadline, starts_at, title, urgent, urgent_activated_at, urgent_expires_at, urgent_policy_version | da |
| 43 | `public.data_export_requests` | `COMMAND_LEDGERS` | UPDATE | active_export_attempt_id, export_revoked_at | da |
| 44 | `private.data_export_artifacts` | `COMMAND_LEDGERS` | DELETE | objekat u Storage-u mora prvo da nestane | ne |
| 45 | `public.notification_push_attempts` | `NOTIFICATION_DELIVERY` | DELETE | - | ne |
| 46 | `public.notification_deliveries` | `NOTIFICATION_DELIVERY` | DELETE | - | da |
| 47 | `public.user_activity_events` | `AUDIT_SECURITY_LOGS` | UPDATE | payload (redovi čiji je primalac nalog se brišu) | ne |
| 48 | `public.notification_push_devices` | `NOTIFICATION_DELIVERY` | DELETE | - | ne |
| 49 | `public.notification_preferences` | `NOTIFICATION_DELIVERY` | DELETE | - | ne |
| 50 | `public.opportunity_deliveries` | `NOTIFICATION_DELIVERY` | DELETE | - | ne |
| 51 | `private.dispatch_schedule` | `NOTIFICATION_DELIVERY` | DELETE | - | ne |
| 52 | `public.dispatch_rounds` | `NOTIFICATION_DELIVERY` | HASH | - | ne |
| 53 | `public.access_grants` | `NEED_SENSITIVE` | DELETE | - | ne |
| 54 | `public.profile_availability_rules` | `PROFILE_DATA` | DELETE | - | da |
| 55 | `public.profile_availability_windows` | `PROFILE_DATA` | DELETE | - | da |
| 56 | `public.worker_match_preferences` | `PROFILE_DATA` | DELETE | - | ne |
| 57 | `private.worker_calendar_events` | `PROFILE_DATA` | DELETE | - | da |
| 58 | `private.worker_calendar_serialization` | `PROFILE_DATA` | DELETE | - | ne |
| 59 | `private.support_read_markers_v5` | `NOTIFICATION_DELIVERY` | DELETE | - | da |
| 60 | `private.owned_media_assets` | `MEDIA_OBJECTS` | DELETE* | zaštićeni objekti ostaju; objekat u Storage-u se briše zasebnim korakom | da |
| 61 | `private.agreement_photo_uploads_v5` | `MEDIA_OBJECTS` | DELETE* | zaštićeni objekti ostaju; objekat u Storage-u se briše zasebnim korakom | da |
| 62 | `private.agreement_voice_uploads_v1` | `MEDIA_OBJECTS` | DELETE | ne dok je otpremanje u toku; objekat u Storage-u mora prvo da nestane | da |
| 63 | `private.account_block_commands` | `COMMAND_LEDGERS` | RECEIPT | receipt, result | ne |
| 64 | `private.marketplace_audit_log` | `AUDIT_SECURITY_LOGS` | UPDATE | detail | da |
| 65 | `private.retention_jobs` | `AUDIT_SECURITY_LOGS` | RECEIPT | receipt, result | ne |
| 66 | `private.retention_holds` | `AUDIT_SECURITY_LOGS` | UPDATE | hold_key (samo neaktivna zadržavanja) | ne |
| 67 | `private.support_commands_v5` | `COMMAND_LEDGERS` | KEPT | samo metapodaci; potvrde komandi podrške ne diraju se | da |
| 68 | `private.support_grant_commands_v5` | `COMMAND_LEDGERS` | KEPT | samo metapodaci; potvrde komandi ne diraju se | ne |
| 69 | `private.account_lineage_events_v5` | `AUDIT_SECURITY_LOGS` | UPDATE | reason, source_ref | ne |
| 70 | `private.account_lineage_v5` | `AUDIT_SECURITY_LOGS` | UPDATE | reason, source_ref | ne |
| 71 | `private.group_message_visibility_v5` | `AGREEMENT_MESSAGES` | DELETE | - | ne |
| 72 | `private.ai_test_accounts_v5` | `AUDIT_SECURITY_LOGS` | UPDATE? | retired_at, ako je prazno | da |
| 73 | `private.support_operator_grants_v5` | `AUDIT_SECURITY_LOGS` | UPDATE? | active=false i revizija, ako je grant aktivan | ne |
| 74 | `public.app_profiles` | `PROFILE_DATA` | UPDATE | available_now, available_now_expires_at, avatar_path, bio, city, display_name, exclusions, headline, licenses, minimum_fee_rsd, operating_country_code, portfolio, profile_status, radius_km, rating_requester, rating_worker, skills, team_capacity, tools, vehicles, years_experience | da |
| 75 | `public.app_accounts` | `ACCOUNT_IDENTITY` | UPDATE | city, email, full_name, phone | da |
| 76 | `private.agreement_review_comments_v1` | `AGREEMENT_REVIEWS` | DELETE | komentar autora; briše se i za zaštićen Dogovor | da |

## Prilog B · Relacije u katalogu koje ostaju posle zatvaranja (31)

Oznaka je dizajnerski kod iz zamrznutog popisa `docs/implementation/v5-ai-first/AF22_CLOSURE_INVENTORY_144.json` (ordinal 144; „-” znači da relacije nema u tom popisu jer je nastala kasnije ili je globalna).

| Relacija | Klasa | Oznaka u AF22 popisu (dizajn) | Izvoz čita relaciju |
|---|---|---|---|
| `private.connection_activations` | `AGREEMENT_CORE` | PSEUDONYM_MINIMUM | ne |
| `private.group_conversations_v5` | `AGREEMENT_CORE` | PSEUDONYM_MINIMUM | ne |
| `private.group_memberships_v5` | `AGREEMENT_CORE` | PSEUDONYM_MINIMUM | da |
| `public.agreements` | `AGREEMENT_CORE` | PSEUDONYM_MINIMUM | da |
| `private.agreement_reviews` | `AGREEMENT_REVIEWS` | PSEUDONYM_MINIMUM | da |
| `private.account_blocks` | `AUDIT_SECURITY_LOGS` | PSEUDONYM_MINIMUM | da |
| `private.ai_test_reservations_v5` | `AUDIT_SECURITY_LOGS` | PRESERVE_ACCOUNTING_MINIMUM | da |
| `private.ai_test_usage_v5` | `AUDIT_SECURITY_LOGS` | - | ne |
| `private.safety_reports` | `AUDIT_SECURITY_LOGS` | EVIDENCE_SCOPE_REVIEW | da |
| `private.support_appeals_v5` | `AUDIT_SECURITY_LOGS` | EVIDENCE_SCOPE_REVIEW | da |
| `private.support_cases_v5` | `AUDIT_SECURITY_LOGS` | EVIDENCE_SCOPE_REVIEW | da |
| `private.support_decisions_v5` | `AUDIT_SECURITY_LOGS` | EVIDENCE_SCOPE_REVIEW | da |
| `private.support_events_v5` | `AUDIT_SECURITY_LOGS` | EVIDENCE_SCOPE_REVIEW | da |
| `private.support_evidence_v5` | `AUDIT_SECURITY_LOGS` | EVIDENCE_SCOPE_REVIEW | da |
| `private.support_operator_audit_v5` | `AUDIT_SECURITY_LOGS` | PSEUDONYM_MINIMUM | ne |
| `private.account_closure_commands` | `COMMAND_LEDGERS` | CLOSURE_RECEIPT_MINIMIZE | ne |
| `private.account_closure_requests` | `COMMAND_LEDGERS` | CLOSURE_RECEIPT_MINIMIZE | da |
| `private.ai_need_open_commands` | `COMMAND_LEDGERS` | PSEUDONYM_MINIMUM | ne |
| `private.closure_actions_v5` | `COMMAND_LEDGERS` | CLOSURE_RECEIPT_MINIMIZE | da |
| `private.closure_executions_v5` | `COMMAND_LEDGERS` | CLOSURE_RECEIPT_MINIMIZE | da |
| `private.closure_redaction_certificate_v5` | `COMMAND_LEDGERS` | - | ne |
| `private.closure_redaction_steps_v5` | `COMMAND_LEDGERS` | - | da |
| `private.closure_scope_sources_v5` | `COMMAND_LEDGERS` | - | ne |
| `private.closure_start_commands_v5` | `COMMAND_LEDGERS` | CLOSURE_RECEIPT_MINIMIZE | ne |
| `private.selection_commands` | `COMMAND_LEDGERS` | PSEUDONYM_MINIMUM | ne |
| `public.account_legal_acceptance_events` | `LEGAL_CONSENT` | PSEUDONYM_MINIMUM | da |
| `private.agreement_media_snapshots_v5` | `MEDIA_OBJECTS` | EVIDENCE_SCOPE_REVIEW | da |
| `private.media_evidence_gaps_v5` | `MEDIA_OBJECTS` | EVIDENCE_SCOPE_REVIEW | ne |
| `private.media_evidence_refs_v5` | `MEDIA_OBJECTS` | EVIDENCE_SCOPE_REVIEW | ne |
| `private.need_fact_registry` | `NEED_PUBLIC` | - (globalna konfiguracija) | ne |
| `public.need_selections` | `RESPONSES_SELECTION` | PSEUDONYM_MINIMUM | ne |
