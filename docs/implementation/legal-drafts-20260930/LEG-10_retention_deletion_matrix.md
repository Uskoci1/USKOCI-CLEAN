# LEG-10 · Matrica čuvanja i brisanja podataka

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-10 (master plan 16.2, ciljni dokument `USKOCI_RETENTION_AND_DELETION_MATRIX_V1`) |
| Status | DRAFT-FROM-CODE za stanje koda; **rokovi: DATA-PENDING-OWNER** (nijedan rok nije odobren) |
| Izvor koda | `Uskoci1/USKOCI-CLEAN`, grana `work/uskoci-ui-unification-20260924`, commit `fc58f411598338c8589f5f177626a2790c92fb13`, pročitano 2026-09-30, samo za čitanje |
| Vezani nacrti | LEG-09 (obrada), LEG-11 (primaoci), LEG-04 (politika privatnosti), LEG-08 (javna stranica za brisanje), LEG-15 (zahtevi lica) |

## 0. Pravilo ovog dokumenta

Rokove ne bira autor nacrta. Ovaj dokument (a) beleži šta kod **danas** radi pri brisanju i isteku, (b) prenosi kolonu „predlog” iz ranijeg tehničkog nacrta za pravnika (`docs/implementation/v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md`, „Kolona predlog roka je tehnički predlog i da bi važila mora da je potvrdi pravnik”), (c) navodi odluke koje vlasnik i pravnik moraju da donesu. Brojevi koji postoje u kodu (rok pregleda 15 minuta, zakupi, ponovni pokušaji 60/120 s, najduži prozor preuzimanja) **nisu** rokovi čuvanja (`docs/implementation/v5-ai-first/RETENTION_ACTIVATION_GAPS.md`).

Oznake: `[[OPERATER: ...]]`, `[[ODLUKA VLASNIKA: ...]]`, `[[PROVERITI: ...]]` kao u LEG-11.

RC2 §15 traži da produkciona tabela ima: kategoriju, svrhu, početak roka, rok, događaj brisanja/anonimizacije, izuzetak zbog zakonske obaveze ili pravnog zahteva i vlasnika procesa. Sve tri kolone koje fale (rok, izuzetak, vlasnik procesa) su otvorene niže.

## 1. Stanje na dan čitanja: šta postoji, a šta ne

Registar rasporeda (`private.retention_policy_sets`) je prazan: 0 objavljenih redova (master plan, DB01, čitano 2026-09-29 sa razvojnog projekta); isto važi za `legal_document_versions` i `processor_map_sets`. Posledica je opisana u koloni „Preduslov”.

| # | Mehanizam | Šta radi u kodu | Preduslov aktivacije | Šta ne radi | Izvor |
|---|---|---|---|---|---|
| M-1 | **Zatvaranje naloga** (adapter `OWNER_AF_D22_EVENT_ERASURE_V1`, worker `uskoci-account-closure-worker`) | Ograničava pristup nalogu; briše nezaštićene datoteke iz Storage-a uz proveru odsustva; u ograničenim koracima uklanja obične lične i privatne podatke iz relacija (identifikatori profila i naloga, tekst poruka i činjenica, tačna geografija, kopije ocena, prijava i potvrda, izvoz); zatim briše Auth identitet (`should_soft_delete`) i izdaje potvrdu `CLOSED`. Pseudonimni identifikator naloga i minimalni tehnički zapisi ostaju. | Nema aktivnih blokera (aktivni Dogovori, otvoreni zadaci, aktivne prijave, započeta obrada, zadržavanje, neizvesno otpremanje datoteka); prekidač `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED=true` (podrazumevano isključen); sertifikovan izvor. **Ne traži** objavljen raspored čuvanja niti pravne dokumente (`legalPolicyAttested:false`). | Ne briše dokaze izdvojene za zasebnu proveru (bezbednosne prijave, podrška, zaštićene fotografije, zajedničke odluke): zatvaranje staje i traži pregled. Ne briše nalog Auth-a fizički, ne briše rezervne kopije ni dnevnike davalaca. Nema kasnijeg čišćenja zadržanih pseudonimnih zapisa po roku. | `supabase/migrations/20260913081147_clean_v5_event_bound_account_erasure.sql:438-452`; `supabase/functions/uskoci-account-closure-worker/index.ts:9`, `closure.ts`; `docs/implementation/v5-ai-first/ACCOUNT_ERASURE_API_146.md`; `src/ui/closure/ClosurePresentation.tsx:103-142,192` |
| M-2 | **Čišćenje privremene kopije izvoza** | Posle isteka zabranjuje preuzimanje, briše privremeni snimak u bazi i objekat u privatnom Storage-u (`data-export-artifacts`), proverava odsustvo tačnog objekta. | Tipizirano vezivanje u aktivnom rasporedu čuvanja (`export_delivery`) sa životnim vekom artefakta, snimka i preuzimanja; aktivna Politika privatnosti; izričito prihvaćeni svi kompajlirani skupovi podataka kataloga izvoza (18 u P2 dokumentu iz 2026-09-10, kasnije proširen na 50-51, `OWN_ACCOUNT_V5_8`); radnik sa servisnim ključem. Bez toga izvoz se ne generiše (`EXPORT_POLICY_NOT_READY`). | Ne briše izvorne podatke ni evidenciju zahteva. Fajl koji je korisnik već sačuvao ne može se opozvati. | `supabase/functions/uskoci-data-export-worker/index.ts:7-9`; `docs/implementation/P2_EXPORT_DELIVERY_20260910.md` |
| M-3 | **Brisanje napuštenih AI razgovora** (adapter `P3_AI_ABANDONED_UNBOUND_V1`) | Briše razgovore tipa `NEED_INTAKE` koji su primećeno napušteni, nikad vezani za zadatak i bez činjenica, predloga i pregleda, najviše 100 poruka. Poziva se iz `marketplace_tick`. | Vezivanje `retention_execution` u aktivnom rasporedu sa pozitivnim brojem sekundi, aktivna Politika privatnosti sa tačnim hešom; samo novo posmatrano napuštanje. | Ne obuhvata radni profil, prihvaćene zadatke, ostale AI podatke ni zatvaranje naloga. Stanje `ABANDONED` nastaje samo izričitom radnjom odbacivanja nacrta (`rpc_ai_abandon_need_conversation_v2`, `src/data/aiNeedV2Production.ts:402`); otvoreni razgovori se nikad ne „stare” u napuštene. | `docs/implementation/P3_RETENTION_EXECUTION_20260910.md`; `supabase/migrations/20260910162955_clean_p3_retention_execution_authority.sql` |
| M-4 | **Istek statusa** zadatka i prijava | Menja stanje (npr. zadatak čiji je prozor prošao se zatvara; prijava ističe) i uklanja operativne redove `private.dispatch_schedule`. To je promena statusa, ne brisanje sadržaja. | radi u postojećem rasporedu | Ne briše naslov, opis, poruke ni ostali lični sadržaj. | `supabase/migrations/20260829212146_clean_scheduled_lifecycle.sql:40,100,113`; `20260830070448_clean_need_response_deadline_expiry.sql:33`; `docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md` |
| M-5 | **Zadržavanja (holds)** | `private.retention_holds` sprečava zatvaranje i brisanje pojedinačnog razgovora/naloga; proverava se pre svake nepovratne radnje. | postavlja ih servisna strana | Ne postoji radnja koja zadržavanje oslobađa po isteku roka; ko sme da ga postavi i oslobodi nije određeno. | `docs/implementation/v5-ai-first/RETENTION_ACTIVATION_GAPS.md` |
| M-6 | **Ostalo koje NE POSTOJI** | - | - | Opšti izvršilac isteka za sve klase; brisanje ili anonimizacija zadržanih klasa po roku; čišćenje odbačenih ili nezavršenih otpremanja slika van zatvaranja naloga; kasniji purge završenih zatvaranja; obrada isteka `AUDIT`/`COMMAND` zapisa; pravilo za nalog koji nikad ne bude zatvoren (neaktivan nalog). | isto |

## 2. Odluke vlasnika koje već važe (ne pitati ponovo)

| Odluka | Sadržaj | Izvor |
|---|---|---|
| AF-D22 | Istorija završenih zadataka, Dogovora, poruka i fotografija ostaje dok nalog postoji; **nema** automatskog brisanja posle 30 dana. Pri zatvaranju naloga primenjuje se tok brisanja/anonimizacije ličnog i privatnog sadržaja, uz samo neophodne tehničke i pravne izuzetke. Odluka ne određuje trajanje izuzetaka i ne dozvoljava ni bezuslovno večno čuvanje. | `docs/implementation/v5-ai-first/OWNER_PRIVATE_TEST_DECISIONS_20260913.md` (tačka 4) |
| AF-D02 | Audio je prolazan: nema USKOČI arhive zvuka; završni tekst ostaje u privatnom razgovoru. Ne određuje rok za transkripte, činjenice, potvrde ni Google-ove sopstvene zapise. | `RETENTION_ACTIVATION_GAPS.md`; `supabase/functions/uskoci-speech-session/proxy.ts:9,155` |
| AF-D21 | Fotografije u privatnoj prepisci: najviše 6 po poruci, 10 MB po originalu, najviše 1.600 px, uklanjanje EXIF/GPS; privatni Storage bez javnih adresa. Ne određuje rok čuvanja. | `OWNER_PRIVATE_TEST_DECISIONS_20260913.md` (tačka 3) |
| D-0141 | Običan medij koji se odbaci razlikuje se od prihvaćenog dokaza (Dogovor, prijava, problem, revizija, hold). Uklanjanje iz prikaza nije fizičko uništenje; kada odobreni rok istekne i nema važećeg holda, server treba da obriše zadržani objekat i izvedene grantove. `DEFER_POLICY`: ne odobrava ni trenutno brisanje ni „zauvek”. | `RETENTION_ACTIVATION_GAPS.md`; `docs/authority/sources/owner-history/03_HISTORICAL_C12/105_PRODUCT_DECISION_REGISTER.md` |
| Naplata | Launch je besplatan (0 RSD); ne postoje računi, plaćanja ni novčane knjige koje bi imale zakonski rok čuvanja dok se naplata ne uvede. | RC2 §15; master plan 3.2 |

## 3. Matrica po klasama podataka

Šifre klasa su iz registra rasporeda (`private.retention_data_classes`, 14 klasa iz `supabase/migrations/20260908150000_clean_p3_retention_schedule_registry.sql:58-71` + `AGREEMENT_REVIEWS` iz kasnije migracije). Redni broj klase je isti kao u kolonama „LEG-10” u LEG-09 i u ranijem tehničkom nacrtu za pravnika.

Kolona **Predlog roka** je *tehnički predlog* iz `PRAVNIK_PODACI_I_ROKOVI_20260921.md` i **nije odobren**. Praznina znači da ni taj nacrt nije dao predlog. U svakom redu važi: `[[ODLUKA VLASNIKA: rok]]`, `[[OPERATER: vlasnik procesa]]`.

| # | Klasa (šifra) i sadržaj | Svrha | Početak roka | Predlog roka (nije odobren) | Događaj brisanja / anonimizacije | Izuzetak / hold |
|---|---|---|---|---|---|---|
| 1 | **Nalog** (`ACCOUNT_IDENTITY`): email, ime, prezime, grad, telefon, datum otvaranja | prijava i kontakt | otvaranje naloga; kraj: `CLOSURE_REQUESTED` | dok nalog postoji | zatvaranje: identifikatori se uklanjaju, Auth identitet se briše, ostaje pseudonimni UUID | pseudonimni identifikator: koliko dugo? `[[ODLUKA VLASNIKA]]` |
| 2 | **Profili** (`PROFILE_DATA`): prikazno ime, grad, veštine, alat, vozila, dozvole, opis, radna oblast, dostupnost, kalendar | prikaz i spajanje zadatka i izvođača | otvaranje profila; kraj: zatvaranje | dok nalog postoji | zatvaranje: redakcija profila, brisanje pravila dostupnosti i kalendara | nema |
| 3 | **Zadaci, javni deo** (`NEED_PUBLIC`): naslov, opis, termin, grad i oblast, broj ljudi, cena, kritični uslovi | objava zadatka | objava; kraj: zatvaranje naloga | dok nalog postoji (AF-D22) | zatvaranje: redakcija sadržaja zadatka | zajednički Dogovor (druga strana ima pravo na svoju evidenciju) |
| 4 | **Zadaci, privatni deo** (`NEED_SENSITIVE`): tačna adresa, napomene za pristup, tačne koordinate, potvrđene tačke, lokacija izvođača podeljena tokom posla | izvršenje posla; vidi ga samo izabrani izvođač | unos; kraj: zatvaranje naloga | dok nalog postoji (AF-D22); **pitanje**: brisati ranije (npr. čim se Dogovor završi)? | zatvaranje: brisanje redova | zaštićen izvor pod holdom |
| 5 | **Prijave i izbor** (`RESPONSES_SELECTION`): ponuda (cena, poruka), snimak radnog profila u trenutku prijave, izbor | tržište | slanje prijave | dok nalog postoji | zatvaranje: redakcija teksta prijave autora; izbor ostaje pseudonimno | zajednički Dogovor |
| 6 | **Pitanja i odgovori pre izbora** (`PRESELECTION_QA`) | dogovaranje | postavljanje pitanja | dok nalog postoji | zatvaranje: redakcija teksta autora | dokazni hold |
| 7 | **Dogovori** (`AGREEMENT_CORE`): uslovi, verzije, predlozi izmena, izvršenje, opis problema, razlog otkazivanja | dokaz šta je dogovoreno | nastanak Dogovora | dok nalog postoji; **pitanje**: koliko dugo posle zatvaranja naloga čuvati uslove kao dokaz? | zatvaranje: redakcija sadržaja čiji je autor nalog; struktura Dogovora ostaje pseudonimno | zajednički Dogovor; problem/bezbednost |
| 8 | **Poruke** (`AGREEMENT_MESSAGES`): poruke u Dogovoru, grupne poruke, veze na fotografije | komunikacija dve strane | slanje | dok nalog postoji; pri zatvaranju se brišu (dokazano u probnom okruženju 2026-09-21) | zatvaranje: redakcija tela poruka autora | dokazni hold (izabrane poruke u predmetu podrške) |
| 9 | **Ocene** (`AGREEMENT_REVIEWS`): ocena i oznake saradnje | poverenje | davanje ocene | dok nalog postoji | zatvaranje: ostaje pseudonimni minimum | zajednički Dogovor |
| 10 | **Pristanak na uslove** (`LEGAL_CONSENT`): verzija, otisak dokumenta, vreme | dokaz pristanka | prihvatanje | **pitanje**: koliko dugo posle zatvaranja naloga (samo verzija, otisak, vreme)? | zatvaranje: ostaje pseudonimni minimum | `LEGAL_ACCEPTANCE` |
| 11 | **Obaveštenja** (`NOTIFICATION_DELIVERY`): podešavanja, događaji, naslov i tekst, Expo token, pokušaji slanja, isporuke prilika | obaveštavanje | nastanak događaja; token: registracija | istorija obaveštenja 12 meseci; token do odjave ili zatvaranja naloga | zatvaranje: brisanje događaja, tokena, isporuka i pokušaja | nema |
| 12 | **AI razgovori** (`AI_VOLATILE`): poruke, izdvojene činjenice, predlozi radnji, pregledi | pravljenje zadatka i profila | otvaranje razgovora | napušten razgovor koji nije postao zadatak: 30 dana; ono što je postalo zadatak prati zadatak | zatvaranje: brisanje sadržaja; napuštene nevezane razgovore briše M-3 kada se aktivira | dokazni hold |
| 13 | **Fotografije** (`MEDIA_OBJECTS`): zadatka, profila, Dogovora | prikaz i dokaz | otpremanje | dok nalog postoji (AF-D22) | zatvaranje: brisanje nezaštićenih datoteka i metapodataka | zaštićena fotografija kao dokaz (D-0141) |
| 14 | **Tehnički zapisi** (`COMMAND_LEDGERS`): ključevi radnji, snimci odluka, zapisi izvoza i zatvaranja, rezervacije AI kvote | pouzdanost i dokaz izvršenja | radnja | 12 meseci; zapisi o zatvaranju duže (odlučuje pravnik) | zatvaranje: minimizacija polja rezultata i potvrda; redovi ostaju radi jednokratnosti komandi | `SUBJECT_TOMBSTONE` |
| 15 | **Bezbednost i podrška** (`AUDIT_SECURITY_LOGS` + prijave, blokiranja, slučajevi, odluke, žalbe): razlog, opis, dnevnik radnji | zaštita korisnika, rešavanje sporova | prijava / otvaranje predmeta | **pitanje**: koliko dugo posle zatvaranja naloga, u pseudonimnom obliku? | zatvaranje: `marketplace_audit_log.detail` se minimizuje; prijave i podrška se **ne brišu automatski** (zasebna provera) | `PROBLEM_OR_SAFETY`, `SUPPORT_SOURCE_REVIEW` |
| E | **Fajl izvoza podataka** (`data-export-artifacts`, snimak u bazi) | pravo na kopiju | generisanje | fajl dostupan 7 dana, pa se briše | M-2 | nema |
| L | **Dnevnici i rezervne kopije** (Supabase, Google, Expo, LocationIQ, OpenFreeMap) | rad i bezbednost usluge | - | nije određeno | van kontrole USKOČI-ja | `[[PROVERITI]]` (odeljak 5) |

Vlasnik procesa za svaki red (RC2 §15): `[[OPERATER: odgovorno lice]]`.

## 4. Zatvaranje naloga danas: šta korisnik čita u aplikaciji

Ovo je tekst koji je vlasnik odobrio za ekran „Zatvaranje naloga” i koji javna stranica (LEG-08) i politika (LEG-04) ne smeju da protivreče (`src/ui/closure/ClosurePresentation.tsx`):

- „Pristup običnim funkcijama se ograničava. Uklanjaju se nezaštićene datoteke, obični lični i privatni podaci, pa podaci za prijavu i sesije. Minimalni pseudonimni zapisi potvrda ostaju. Izdvojeni dokazi se zasebno rešavaju; ako postoje, konačno zatvaranje čeka njihovu proveru. Pokrenuto uklanjanje ne možeš poništiti iz aplikacije.” (`:192`)
- „Podaci za prijavu su uklonjeni i sesije su završene. Fotografije i datoteke naloga su obrisane.” / „Obični lični i privatni podaci aplikacije su uklonjeni. Ostaju minimalni pseudonimni zapisi potrebni za potvrde radnji i tehničku evidenciju.” (`:137-139`)
- Obaveze pre zatvaranja (`src/data/closureExecutionClientService.ts:6`): „Najpre završi aktivne dogovore.” / „Najpre zatvori otvorene zadatke.” / „Najpre povuci ili završi aktivne prijave.” / „Sačekaj završetak započete obrade.” / „Nalog ima aktivno zadržavanje podataka koje sprečava zatvaranje.” / ishod slanja fotografije nije potvrđen / datoteke traže dodatnu proveru / „Za zaštićene podatke još nije odobreno pravilo čuvanja.”
- Izdvojeni izuzeci koji mogu da zadrže konačno zatvaranje (`:7`): izdvojeni predmet ili dokaz; zaštićena fotografija ili njena veza sa dokazom; izvor dela zajedničke istorije; odluka koju koristi i drugi nalog.

Napomena: potvrda `CLOSED` je stvarna tek sa korelisanom serverskom potvrdom (`decodeClosed`, `closure.ts`); mrežni uspeh bez potvrde ne znači brisanje.

## 5. Rezervne kopije, kopije davalaca, dnevnici

| Kopija | Šta je poznato | Otvoreno |
|---|---|---|
| Supabase rezervne kopije i vraćanje | Repozitorijum ne opisuje plan, PITR ni rok čuvanja kopija. Master plan 17.4: plan mora zasebno pokriti bazu, Storage, konfiguraciju i tajne; dokaz vraćanja u izolovanom okruženju | `[[PROVERITI: plan i retencija]]` `[[ODLUKA VLASNIKA: postupak kada se obrisani podatak nalazi u kopiji]]` |
| Google (Gemini, Live) | Lokalno brisanje ne dokazuje brisanje kod davaoca: „Lokalni DB/Storage purge nije dokaz brisanja Google/Supabase provider logova ili backup-a” (`RETENTION_ACTIVATION_GAPS.md`). U aplikaciji: „privremeni bezbednosni zapisi kod Google-a” | `[[PROVERITI: rok čuvanja bezbednosnih zapisa]]` |
| Expo push, FCM, APNs | Sadržaj push poruke je fiksan i opšti; token se briše pri zatvaranju | `[[PROVERITI: čuvanje kod Expo-a]]` |
| LocationIQ | Upiti adresa idu bez identiteta korisnika | `[[PROVERITI: čuvanje i keširanje]]` |
| OpenFreeMap | IP adresa i pločice | `[[PROVERITI]]` |
| Uređaj | Sesija, žurnali komandi, nacrti i redovi poruka su u lokalnom skladištu (LEG-09, P-27); ne postoji dokumentovano pravilo brisanja pri odjavi za svaki ključ | `[[PROVERITI: koji ključevi se brišu pri odjavi i zatvaranju]]` |

## 6. Odluke koje fale (za vlasnika i pravnika)

1. Rok i osnov zadržavanja pseudonimnog identifikatora naloga posle zatvaranja (red 1).
2. Koliko dugo posle zatvaranja čuvati uslove Dogovora kao dokaz (red 7) i zašto.
3. Da li tačnu adresu i podeljenu lokaciju brisati ranije, po završetku Dogovora (red 4).
4. Rok za dokaz o pristanku posle zatvaranja: verzija, otisak, vreme (red 10).
5. Rok i oblik čuvanja bezbednosnih prijava, podrške, odluka i žalbi posle zatvaranja; ko sme da postavi i oslobodi hold; rok za pravne zahteve (red 15, M-5).
6. Potvrda ili izmena predloga za redove 11, 12 i 14 i za fajl izvoza (7 dana).
7. Pravilo za nalog koji se nikad ne zatvori (neaktivan nalog): ne postoji nigde u repozitorijumu ni u RC2.
8. Rok čuvanja ocena druge strane kada se nalog jednog učesnika zatvori (red 9).
9. Rokovi za dnevnike i rezervne kopije (odeljak 5) i postupak kada je obrisan podatak u kopiji.
10. Vlasnik procesa za svaku klasu (RC2 §15) i ko odlučuje o zahtevu za brisanje (LEG-15).
11. Da li se čuvaju zapisi koji bi imali fiskalni rok kada se naplata jednom uvede (sada 0 RSD): odluka se ne donosi unapred.
12. Posle odluka: objaviti raspored (`rpc_publish_retention_policy`), vezati izvoz i (ako se odluči) AI purge, ponoviti dokaz na jednokratnom subjektu (master plan 15.4, `RETENTION_ACTIVATION_GAPS.md`, odeljak „Dokaz pre aktivacije”).

Rokovi u ovoj matrici se **ne** ugrađuju u javne tekstove dok ih vlasnik ne odobri; do tada javni tekstovi (LEG-04, LEG-08) koriste opise „dok nalog postoji” i „u skladu sa objavljenim pravilima”, bez brojeva.

## Prilog A · Relacije i predviđena radnja pri zatvaranju (izvor: `AF22_CLOSURE_INVENTORY_144.json`)

Izvorni popis je izveden iz koda (ordinal migracije 144, 115 relacija, od toga 98 vezanih za nalog i 17 globalnih). Kodovi radnji su **dizajn** („Design codes only; not existing SQL enums, active policies or commands”); izvršni spisak koraka određuje adapter 146, a stvarni katalog baze nije ovde proveren. Popis dopunjuju migracije 145 i 146.

| Radnja (kod iz popisa) | Značenje | Relacija | Polja sa ličnim sadržajem | Zavisnost izuzetka |
|---|---|---|---|---|
| `IDENTITY_REDACT` | ukloniti identifikatore iz reda naloga | `public.app_accounts` | email, full_name, city, phone | SUBJECT_TOMBSTONE |
| `PROFILE_REDACT` | ukloniti lične atribute iz profila | `public.app_profiles` | display_name, city, headline, bio, avatar_path, portfolio, skills, tools, licenses, vehicles, exclusions, years_experience, radius_km, available_now, team_capacity, minimum_fee_rsd, rating_requester, rating_worker, available_now_expires_at, operating_country_code | SUBJECT_TOMBSTONE |
| `TASK_REDACT` | ukloniti sadržaj zadatka (uz izuzetak zajedničkog Dogovora) | `public.needs` | title, description, category, approximate_city, approximate_area, approximate_lat, approximate_lng, approx_geog, starts_at, ends_at, required_skills, required_tools, required_vehicles, required_licenses, public_photo_paths, requester_price_rsd, task_country_code, task_timezone, remaining_search_close_reason | SHARED_AGREEMENT |
| `SHARED_AUTHORED_REDACT` | ukloniti tekst čiji je autor nalog koji se zatvara, uz očuvanje tuđeg sadržaja | `public.marketplace_responses` | scope_note, bounded_message, proposed_start_at, proposed_end_at, price_rsd | SHARED_AGREEMENT |
|  |  | `public.marketplace_response_versions` | scope_note, proposed_start_at, proposed_end_at, price_rsd | SHARED_AGREEMENT |
|  |  | `public.agreement_messages` | body, photo_asset_ids | EXACT_SOURCE_HOLD |
|  |  | `public.agreement_execution` | problem_narrative | PROBLEM_OR_SAFETY |
|  |  | `public.agreement_change_proposals` | proposed_terms, reason | SHARED_AGREEMENT |
|  |  | `private.preselection_qa_questions` | question_text | EXACT_SOURCE_HOLD |
|  |  | `private.preselection_qa_answer_versions` | answer_text | EXACT_SOURCE_HOLD |
|  |  | `private.response_application_snapshots` | worker_skills, worker_tools, worker_licenses, worker_vehicles | SHARED_AGREEMENT |
|  |  | `private.group_messages_v5` | body | EXACT_SOURCE_HOLD |
| `SHARED_SNAPSHOT_REDACT` | ukloniti kopije sadržaja iz zajedničkih snimaka | `public.agreement_versions` | terms | SHARED_AGREEMENT |
|  |  | `private.need_revision_events` | previous_material_snapshot, new_material_snapshot | SHARED_AGREEMENT |
| `DELETE_OWN_LEAF` | obrisati sopstvene završne redove | `public.profile_availability_windows` | label, starts_at, ends_at | NONE_SPECIFIC |
|  |  | `public.profile_availability_rules` | label, weekdays, start_time, end_time, starts_on, ends_on | NONE_SPECIFIC |
|  |  | `public.need_sensitive` | exact_address, access_notes, exact_lat, exact_lng, resolved_location | EXACT_SOURCE_HOLD |
|  |  | `public.notification_preferences` | quiet_start, quiet_end, quiet_timezone | NONE_SPECIFIC |
|  |  | `public.worker_match_preferences` | timezone, approximate_lat, approximate_lng, approximate_geog, buffer_minutes | NONE_SPECIFIC |
|  |  | `public.dispatch_rounds` | - | UNKNOWN_PRODUCER |
|  |  | `public.opportunity_deliveries` | score_components | NONE_SPECIFIC |
|  |  | `private.dispatch_schedule` | - | UNKNOWN_PRODUCER |
|  |  | `public.need_geography` | public_topology | EXACT_SOURCE_HOLD |
|  |  | `public.need_requirement_details` | critical_conditions | SHARED_AGREEMENT |
|  |  | `private.worker_calendar_events` | starts_at, ends_at | SHARED_AGREEMENT |
|  |  | `private.worker_calendar_serialization` | - | NONE_SPECIFIC |
|  |  | `private.agreement_location_points` | latitude, longitude, accuracy_meters, captured_at | EXACT_SOURCE_HOLD |
|  |  | `private.support_read_markers_v5` | - | NONE_SPECIFIC |
| `REVOKE_DELETE_LEAF` | opozvati pristup i obrisati završne redove | `public.access_grants` | - | NONE_SPECIFIC |
|  |  | `private.group_message_visibility_v5` | - | NONE_SPECIFIC |
| `AI_CONTENT_DELETE` | obrisati sadržaj AI razgovora, činjenica i predloga | `public.ai_structured_facts` | fact_value, evidence_excerpt, display_value | EXACT_SOURCE_HOLD |
|  |  | `public.ai_action_proposals` | payload | EXACT_SOURCE_HOLD |
|  |  | `public.ai_messages` | body | EXACT_SOURCE_HOLD |
|  |  | `private.ai_task_reviews` | envelope | EXACT_SOURCE_HOLD |
|  |  | `private.worker_ai_sessions` | candidate | EXACT_SOURCE_HOLD |
|  |  | `private.worker_ai_reviews` | envelope | EXACT_SOURCE_HOLD |
| `AI_GRAPH_MINIMIZE` | svesti graf razgovora na minimum | `public.ai_conversations` | - | EXACT_SOURCE_HOLD |
| `EVENT_AND_PUSH_DELETE` | obrisati događaje, uređaje, isporuke i pokušaje slanja | `public.user_activity_events` | payload | NONE_SPECIFIC |
|  |  | `public.notification_push_devices` | expo_push_token, bound_session_id | UNKNOWN_PRODUCER |
|  |  | `public.notification_deliveries` | title, body | UNKNOWN_PRODUCER |
|  |  | `public.notification_push_attempts` | provider_ticket_id, rejected_ticket_ids | UNKNOWN_PRODUCER |
| `MEDIA_BYTES_AND_METADATA` | obrisati datoteke i metapodatke (osim zaštićenih dokaza) | `private.owned_media_assets` | storage_path, avatar_apply_receipt | EXACT_MEDIA_EVIDENCE |
|  |  | `private.agreement_photo_uploads_v5` | storage_path | EXACT_MEDIA_EVIDENCE |
| `EXPORT_DELETE` | obrisati privremene izvozne snimke | `private.data_export_artifacts` | snapshot_text, object_path | UNKNOWN_PRODUCER |
| `PSEUDONYM_MINIMUM` | zadržati samo pseudonimni minimum | `public.need_selections` | - | SHARED_AGREEMENT |
|  |  | `public.agreements` | - | SHARED_AGREEMENT |
|  |  | `private.selection_commands` | - | SHARED_AGREEMENT |
|  |  | `private.connection_activations` | - | SHARED_AGREEMENT |
|  |  | `public.account_legal_acceptance_events` | - | LEGAL_ACCEPTANCE |
|  |  | `private.retention_scan_cursors` | - | NONE_SPECIFIC |
|  |  | `private.ai_need_open_commands` | - | SUBJECT_TOMBSTONE |
|  |  | `private.account_blocks` | - | SUBJECT_TOMBSTONE |
|  |  | `private.agreement_reviews` | rating, tags | SHARED_AGREEMENT |
|  |  | `private.group_conversations_v5` | - | SHARED_AGREEMENT |
|  |  | `private.group_memberships_v5` | - | SHARED_AGREEMENT |
|  |  | `private.support_operator_audit_v5` | - | OPERATOR_AUDIT |
| `COMMAND_MINIMIZE` | minimizovati potvrde komandi | `private.response_submit_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `private.response_withdraw_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `private.need_draft_save_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `private.need_publication_decisions` | public_geography_snapshot, public_media_refs, reviewer_provenance, service_provenance | EXACT_SOURCE_HOLD |
|  |  | `private.need_publish_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `private.need_edit_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `private.response_revision_resolution_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `private.remaining_search_close_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `private.preselection_qa_policy_decisions` | service_provenance | EXACT_SOURCE_HOLD |
|  |  | `private.preselection_qa_materiality_decisions` | service_provenance | EXACT_SOURCE_HOLD |
|  |  | `private.preselection_qa_commands` | result | SUBJECT_TOMBSTONE |
|  |  | `public.data_export_requests` | - | UNKNOWN_PRODUCER |
|  |  | `private.retention_jobs` | result | UNKNOWN_PRODUCER |
|  |  | `private.ai_need_turn_commands` | receipt | UNKNOWN_PRODUCER |
|  |  | `private.requester_identity_commands` | receipt | SUBJECT_TOMBSTONE |
|  |  | `private.account_block_commands` | receipt | SUBJECT_TOMBSTONE |
|  |  | `private.ai_task_review_commands` | evaluation_binding, evaluation, published | UNKNOWN_PRODUCER |
|  |  | `private.worker_ai_turns` | - | UNKNOWN_PRODUCER |
|  |  | `private.worker_ai_saves` | receipt | SUBJECT_TOMBSTONE |
|  |  | `private.qa_ai_commands` | receipt | UNKNOWN_PRODUCER |
|  |  | `private.agreement_location_commands` | - | SUBJECT_TOMBSTONE |
|  |  | `private.support_commands_v5` | receipt | SUBJECT_TOMBSTONE |
|  |  | `private.support_grant_commands_v5` | receipt | OPERATOR_AUDIT |
| `AUDIT_MINIMIZE` | minimizovati detalj evidencije | `private.marketplace_audit_log` | detail | EXACT_SOURCE_HOLD |
| `CLOSURE_RECEIPT_MINIMIZE` | minimizovati potvrde zatvaranja | `private.account_closure_requests` | preparation, execution_receipt | SUBJECT_TOMBSTONE |
|  |  | `private.account_closure_commands` | receipt | SUBJECT_TOMBSTONE |
|  |  | `private.closure_executions_v5` | receipt | SUBJECT_TOMBSTONE |
|  |  | `private.closure_actions_v5` | object_path | SUBJECT_TOMBSTONE |
|  |  | `private.closure_start_commands_v5` | receipt | SUBJECT_TOMBSTONE |
| `EVIDENCE_SCOPE_REVIEW` | zasebna provera dokaza (ne briše se automatski) | `private.retention_holds` | hold_key | EXACT_SOURCE_HOLD |
|  |  | `private.safety_reports` | reason, narrative | PROBLEM_OR_SAFETY |
|  |  | `private.agreement_media_snapshots_v5` | assets | EXACT_MEDIA_EVIDENCE |
|  |  | `private.media_evidence_refs_v5` | - | EXACT_MEDIA_EVIDENCE |
|  |  | `private.media_evidence_gaps_v5` | - | UNRESOLVED_MEDIA_SOURCE |
|  |  | `private.support_cases_v5` | title, desired_outcome, context | SUPPORT_SOURCE_REVIEW |
|  |  | `private.support_events_v5` | body | SUPPORT_SOURCE_REVIEW |
|  |  | `private.support_decisions_v5` | explanation | SUPPORT_SOURCE_REVIEW |
|  |  | `private.support_appeals_v5` | - | SUPPORT_SOURCE_REVIEW |
|  |  | `private.support_evidence_v5` | snapshot | SUPPORT_SOURCE_REVIEW |
| `REVOKE_ADMISSION` | opozvati dozvolu | `private.ai_test_accounts_v5` | - | SUBJECT_TOMBSTONE |
| `REVOKE_OPERATOR` | opozvati operatersku dozvolu | `private.support_operator_grants_v5` | - | OPERATOR_AUDIT |
| `PRESERVE_ACCOUNTING_MINIMUM` | zadržati minimum obračuna kvote | `private.ai_test_reservations_v5` | - | SUBJECT_TOMBSTONE |

Globalne relacije bez ličnih podataka naloga (izuzete iz zatvaranja): `private.marketplace_config`, `private.need_fact_registry`, `private.publication_policy_bundles`, `private.publication_policy_rule_refs`, `private.connection_policy_versions`, `private.legal_document_versions`, `private.processor_provider_inventory`, `private.processor_map_sets`, `private.processor_map_entries`, `private.retention_data_classes`, `private.retention_policy_sets`, `private.retention_policy_rules`, `private.location_market_configs`, `private.push_runtime_readiness`, `private.ai_test_budget_v5`, `private.closure_dataset_catalog_v5`, `private.closure_source_v5`.

## D12 napomena (kandidat, NIJE primenjen)

> Dodato 2026-10-01. Paket „D12 pisani komentar uz ocenu“ je samo kandidat u repozitorijumu (`supabase/candidates/d12_review_comment.sql`); nije primenjen na DEV i zahteva izričitu odluku vlasnika. Do tada tvrdnje iznad o oceni bez slobodnog teksta ostaju tačne i ovaj dokument se ne menja. Ako se paket primeni, uticaj na ovaj dokument je ograničen na: red 9 (Ocene, `AGREEMENT_REVIEWS`) i otvorena odluka 8; opis klase u katalogu dobija rečenicu o komentaru, bez ikakvog roka. Opcioni pisani komentar postoji dok postoji nalog autora; briše se pri zatvaranju naloga autora; komentar koji je moderacijom skriven i komentar o osobi koja je zatvorila nalog se zadržavaju (skriveni od prikaza); rok čuvanja je unos vlasnika/pravnika i nijedan broj nije izmišljen. Pravni osnov, DPIA, moderator i rok odgovora ostaju `[[PROVERITI]]`. Izvor: `supabase/proofs/d12/README_D12_CANDIDATE.md`, `docs/implementation/product-v1-closure-20260926/finalization-20260927/d12/D12_CLOSURE_INVENTORY_SUCCESSOR_20261001.json`.
