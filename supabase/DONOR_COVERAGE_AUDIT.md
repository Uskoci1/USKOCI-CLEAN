# USKOČI — Full Donor Backend Coverage Audit

**Datum:** 29.08.2026
**Cilj:** dokazati da nijedna korisna sposobnost nije izgubljena pri destilaciji
184 donor migracije → clean backend. Nije cilj vratiti 90 tabela.

**Status clean backenda tokom audita:** nedirnut. Nijedna izmena nije izvršena.
Stari `uskoci-alpha` i production nisu dodirnuti.

Autoritet: latest owner decision → V9 → V8 → V7 → V6 → verified donor evidence.

---

## 1. Inventar donora — mereno, ne procenjeno

| objekat | broj |
|---|---|
| `create table` naredbi | 93 |
| distinct tabela | ~90 |
| distinct funkcija | **235** (134 `rpc_*`, 99 pomoćnih/privatnih) |
| `create policy` naredbi | 123 |
| triggera | **46** |
| indeksa | 195 |
| view-ova | 1 |
| materialized view-ova | **0** |
| custom `type`/`enum` | **0** — sve je `text` + `check` |
| Edge funkcija | 6 žive + `_retired` |
| storage bucketa | 3 deklaracije |
| cron poslova | **3** |
| Realtime publikacija | 1 — **samo na mrtvim `alpha_*` tabelama** |

### Šta ovo odmah menja

- **Nema custom tipova.** Sve je `text` + `check`. Moj clean backend je isti pristup — dobro, nema tipskog duga.
- **Realtime je vezan samo za `alpha_*`**, mrtvu generaciju. → **NOT NEEDED** za clean.
- **Tri cron posla** su živi serverski mehanizmi koje clean backend **nema**.

---

## 2. Coverage po domenima

Legenda: ✅ pokriveno · ⚠️ delimično · ❌ nedostaje

### 2.1 Need / NeedPlan / multi-stop

| donor objekat | odluka | razlog | clean status |
|---|---|---|---|
| `needs` | **KEEP/MODIFY** | nosi `revision`, `required_slots`, grubu geografiju | ✅ primenjeno |
| `needs.response_deadline` | **KEEP** | tick po njemu gasi Potrebu | ❌ **kolona nedostaje** |
| `needs.approximate_city` | KEEP | index `needs_market_idx` ga koristi za pretragu | ✅ postoji |
| `need_sensitive` | KEEP | odvaja tačnu adresu | ✅ primenjeno |
| `need_selections` | **MODIFY** | donor ima `response_id`, `worker_*`, `selection_mode`, `status`; moj ima samo `client_request_id` | ⚠️ **nepotpuno** |
| `need_plans`, `need_plan_parts` | **KEEP** | najnoviji rad u donoru; multi-stop/compound Potreba | ❌ **nema ih** |
| `need_clarifications` | **KEEP** | anonimna pitanja pre izbora (kanon) | ❌ **nema** |
| `need_requirement_facts` | KEEP | strukturisani uslovi | ❌ nema |

**Nalaz:** `selection_mode` (`AUTO_FILL` / `REQUESTER_SELECTS` / `BIDDING`) je kanonski
koncept koji clean backend ne poznaje. Bez njega ne postoji razlika između
„Naručilac bira" i „prvi koji prihvati".

### 2.2 Applications / Offers / versioning

| donor objekat | odluka | razlog | clean status |
|---|---|---|---|
| `marketplace_responses` | KEEP | `submitted_against_need_revision`, `current_version`, `STALE` | ✅ primenjeno |
| `marketplace_response_versions` | KEEP | `content_hash` po verziji | ✅ primenjeno |
| `marketplace_response_team_snapshot` | **KEEP** | model tima iz kanona (`rpc_r37_set_response_team`) | ❌ **nema** |
| `requester_shortlist` | KEEP | uži izbor pre selekcije | ❌ nema |

### 2.3 Atomic selection / multi-seat

| | odluka | clean status |
|---|---|---|
| vezivanje revizije + verzije + hash | KEEP | ✅ `rpc_select_response` |
| idempotencija `client_request_id` | **NEW** (kanon, donor nema) | ✅ primenjeno |
| `need_selections.status` za pokrivenost | KEEP | ❌ **moj `fn_need_covered_slots` broji preko `agreements`, donor preko `need_selections.status`** |
| `selection_mode` | KEEP | ❌ nema |

### 2.4 Agreements / Dogovor

| donor objekat | odluka | razlog | clean status |
|---|---|---|---|
| `agreements` | KEEP | ✅ | ✅ |
| `agreements.status='AWAITING_CONFIRMATIONS'` | **RETIRE** | M02/M10 ukidaju treću potvrdu | ✅ nema ga |
| `agreement_confirmations` | **RETIRE** | postojala samo za tu potvrdu | ✅ nije kreirana |
| `agreement_versions` | KEEP | `terms` + `content_hash` + `supersedes_version` | ✅ |
| `agreement_execution` | **MODIFY** | `EN_ROUTE`/`ARRIVED` penzionisani (M07) | ✅ novi enum |
| `agreement_change_proposals` | **MODIFY** | moj model radi bez zasebne tabele predloga | ⚠️ svesno pojednostavljeno |
| `agreement_evidence_metadata` | KEEP | dokazi o izvršenju | ❌ nema |
| `agreement_reviews` | KEEP | ocene posle završetka | ❌ **nema** |

### 2.5 Chat / messages

| | odluka | clean status |
|---|---|---|
| `agreement_messages` | KEEP — jedna nit, M03 | ✅ primenjeno |
| privatno/grupno razdvajanje | **NOT NEEDED** dok vlasnik ne ratifikuje | ⚠️ predlog stoji u HTML-u |
| `original_language_tag` (multijezičnost) | KEEP | ❌ kolona nema |

### 2.6 Directional privacy / contact / location

| donor objekat | odluka | razlog | clean status |
|---|---|---|---|
| `private_access_grants` | **REBUILD** | combined reveal, M10 ga ukida | ✅ zamenjen `access_grants` |
| usmerenost + kanal | **NEW** (kanon) | | ✅ primenjeno + RLS |
| `app_private_access_grants` | RETIRE | duplikat iz `app_` generacije | ✅ nije prenet |

### 2.7 Cancellation / replacement

| | odluka | clean status |
|---|---|---|
| jednostrano otkazivanje | KEEP | ✅ `rpc_cancel_agreement` |
| oslobađanje samo te alokacije | KEEP | ✅ |
| **bounded replacement entitlement** | **KEEP** | ❌ **nema** — `connection_access_ledger.state='RESTORED'` je taj mehanizam |
| `recovery_cases` | KEEP | ❌ nema |

### 2.8 Completion + 48h

| | odluka | clean status |
|---|---|---|
| prozor od 48h, serverski sat | KEEP | ✅ `rpc_mark_work_done` |
| problem blokira auto-zatvaranje | KEEP | ✅ |
| **scheduler koji zove tick** | **KEEP** | ❌ **nema cron posla** |

### 2.9 Profiles / capabilities / availability

| donor objekat | odluka | clean status |
|---|---|---|
| `app_profiles` | KEEP | ✅ zatečeno |
| `profile_availability_windows` / `_rules` | KEEP | ✅ zatečeno |
| `profile_resource_availability_overrides` | KEEP | ❌ nema |
| `worker_capability_facts` | KEEP | ❌ nema |
| `worker_calendar_events` | KEEP | ❌ **nema** — bez toga nema provere zauzetosti |
| `worker_match_preferences` | KEEP | ❌ nema |

### 2.10 Marketplace / matching / explainability

| donor objekat | odluka | razlog | clean status |
|---|---|---|---|
| `dispatch_rounds` | **KEEP** | bounded dispatch po rundama, coverage-aware | ❌ **nema** |
| `opportunity_deliveries` | **KEEP** | `match_score`, `score_components`, **`reason_codes`** | ❌ **nema** |
| `private.r24_marketplace_tick()` | **KEEP** | advisory lock + expiry + dispatch | ❌ **nema** |
| `private.r24_marketplace_config` | KEEP | parametri dispatch-a | ❌ nema |

**Ovo je najveći gap.** `reason_codes` je tačno ono što kanon traži: objašnjenje
bez sirovog procenta. Moj klijent trenutno izmišlja „razlog preporuke" lokalno.

### 2.11 Geography / distance / routes

| | odluka | clean status |
|---|---|---|
| gruba javna geografija `numeric(6,2)` | KEEP | ✅ |
| tačna u `need_sensitive` | KEEP | ✅ |
| `private.worker_need_arrival_route_estimates` | KEEP | ❌ nema |
| Edge `uskoci-location-resolve` | KEEP | ❌ nije deployovana |

### 2.12 Notifications / events

| donor objekat | odluka | razlog | clean status |
|---|---|---|---|
| `user_activity_events` | **KEEP/MODIFY** | `dedupe_key unique` = idempotencija; enum sadrži penzionisani `AGREEMENT_CONFIRMATION_REQUIRED` | ❌ **nema** |
| `notification_deliveries` | KEEP | pun state machine + dedupe | ❌ nema |
| `notification_preferences` | KEEP | po ulozi i kategoriji | ❌ nema |
| `notification_push_devices` / `_attempts` | KEEP | ❌ nema |
| Edge `uskoci-push-dispatch` + 2 cron posla | KEEP | ❌ nema |

**Bez ovoga druga strana ne saznaje ništa** — a V8 lanac to izričito traži.

### 2.13 AI

| donor objekat | odluka | clean status |
|---|---|---|
| `ai_conversations` | KEEP | ✅ primenjeno |
| `ai_structured_facts` | KEEP | ✅ primenjeno + `EVIDENCE_REQUIRED` constraint (novo) |
| `ai_action_proposals` | KEEP | ✅ primenjeno |
| `private.ai_conversation_provenance_events` | KEEP | ❌ nema |
| `private.ai_application_response_snapshots` | KEEP | ❌ nema |
| Edge `uskoci-ai-interview` | KEEP | ❌ nije deployovana |
| Edge `uskoci-ai-transcribe` | KEEP | ❌ nije deployovana |
| safety gate ALLOW/CLARIFY/REVIEW/BLOCK | KEEP | ❌ **nema serverski** — samo u lažnom izvoru |
| `private.need_moderation_decisions` | KEEP | ❌ nema |

### 2.14 Monetizacija / Povezivanje — **SUKOB SA KANONOM**

| donor objekat | odluka | razlog |
|---|---|---|
| `connection_access_ledger` | **REBUILD** | vidi ispod |
| `worker_platform_entitlements` | **MODIFY** | isto |
| `app_request_entitlements` | MODIFY | isto |
| `market_configs` | KEEP | konfiguracija po tržištu |

**Sukob:** donor vezuje ledger za `worker_account_id` sa `quota_month` — model
gde **Uskočer** troši kvotu da otključa kontakt.

V9 kanon: *„Naručilac je payer/beneficiary, potrošnja je po pokrivenoj osobi."*

Noviji kanon pobeđuje → ledger mora da se preusmeri na Naručioca.
`access_basis` (`UNMETERED`/`FREE_QUOTA`/`PRO`/`PAID_CONNECTION`) i
`state` (`UNLOCKED`/`RESTORED`/`REVOKED`) se **zadržavaju** — `RESTORED` je
mehanizam bounded replacement-a.

Clean backend trenutno **nema ništa** od ovoga; `Povezivanje aktivirano · bez
naknade` postoji samo kao tekst u lažnoj hronologiji.

### 2.15 Storage / attachments

| | odluka | clean status |
|---|---|---|
| 3 bucketa sa `file_size_limit` i `allowed_mime_types` | KEEP | ❌ nema |
| `storage.objects` politike (8 migracija) | KEEP | ❌ nema |
| `needs.public_photo_paths` | KEEP | ✅ kolona postoji, bez bucketa |

### 2.16 Audit / idempotency / security

| | odluka | clean status |
|---|---|---|
| `private.r24_marketplace_audit_log` | KEEP | ❌ nema |
| `dedupe_key` idempotencija događaja | KEEP | ❌ nema |
| `client_request_id` idempotencija izbora | NEW | ✅ |
| advisory lock u ticku | KEEP | ❌ nema |
| `r24_set_updated_at()` trigger na 8 tabela | **KEEP** | ❌ **nema nijedan** |
| security definer + revoke obrazac | KEEP | ✅ + ispravljen |

### 2.17 Penzionisano / nije potrebno

| | odluka | razlog |
|---|---|---|
| `alpha_*` (4 tabele) | **RETIRE** | pominjanja padaju 140 → 0 kroz istoriju |
| Realtime na `alpha_*` | **NOT NEEDED** | vezan za mrtvu generaciju |
| `uskoci_preview_chunks` | RETIRE | artefakt prototipa |
| `app_organization_*` (5 tabela) | **NOT NEEDED za V1** | organizacije nisu u V1 obimu |
| `consumer_complaint_*` (3) | **NOT NEEDED za V1** | pravni proces, posle launcha |
| `data_export_requests`, `retention_policy_*` | NOT NEEDED za V1 | OD-14 nije odlučen |
| `support_case_*` (4) | NOT NEEDED za V1 | |
| `agreement_confirmations` | RETIRE | ✅ dokazano odsutna |
| `private_access_grants` | RETIRE | ✅ dokazano odsutna |

---

## 3. GAPS — šta kanon traži, a clean backend nema

Poređano po tome koliko blokira V8 lanac.

### Blokira lanac odmah

| # | gap | zašto blokira |
|---|---|---|
| G1 | **`user_activity_events` + `notification_deliveries` + `_preferences`** | V8 traži „event/notification → projekcija druge strane". Bez toga druga strana ne saznaje ništa. |
| G2 | **cron scheduler za `rpc_tick_auto_completion`** | 48h auto-zatvaranje ne sme da zavisi od otvorenog ekrana. Sada ne zove ga niko. |
| G3 | **`opportunity_deliveries` + `dispatch_rounds`** | bez njih nema isporuke prilika, ni `reason_codes` za objašnjenje bez procenta |
| G4 | **`need_selections` nepotpun** | nedostaju `response_id`, `worker_*`, `selection_mode`, `status` |
| G5 | **`agreement_reviews`** | M07 kaže da ocena postaje moguća posle završetka — nema gde da se upiše |

### Blokira pojedine ekrane

| # | gap | ekran |
|---|---|---|
| G6 | `worker_calendar_events` + `worker_match_preferences` | W09 dostupnost, provera zauzetosti |
| G7 | `need_clarifications` | anonimna pitanja pre izbora |
| G8 | `marketplace_response_team_snapshot` | model tima u prijavi |
| G9 | `needs.response_deadline` kolona | isticanje Potrebe |
| G10 | storage buckets + politike | fotografije Potrebe, avatar |

### Motor bez kojeg V1 radi, ali nepotpuno

| # | gap | |
|---|---|---|
| G11 | `connection_access_ledger` preusmeren na Naručioca | Povezivanje sa cenom 0 je sada samo tekst |
| G12 | `recovery_cases` + `state='RESTORED'` | bounded replacement |
| G13 | serverski safety gate | sada postoji samo u lažnom izvoru |
| G14 | `r24_set_updated_at()` triggeri | `updated_at` se održava samo ručno u RPC-evima |
| G15 | audit log | nema traga o tome ko je šta uradio |
| G16 | Edge funkcije (4) | AI interview, transcribe, location resolve, push dispatch |
| G17 | `ai_conversation_provenance_events` | dokaz porekla AI tvrdnje |
| G18 | `need_plans` / `need_plan_parts` | multi-stop / compound Potreba |

---

## 4. Predlog additive migracija 13+ — NIJE IZVRŠENO

Redosled je po zavisnosti, ne po važnosti.

| # | migracija | pokriva | rizik |
|---|---|---|---|
| 13 | `clean_updated_at_triggers` | G14 | nizak |
| 14 | `clean_need_selection_completeness` | G4, G9 | nizak — additive kolone |
| 15 | `clean_events_and_notifications` | G1 | srednji — nov domen |
| 16 | `clean_scheduled_lifecycle` | G2 | srednji — traži `pg_cron` |
| 17 | `clean_opportunity_dispatch` | G3 | visok — najveći domen |
| 18 | `clean_reviews` | G5 | nizak |
| 19 | `clean_worker_availability` | G6 | srednji |
| 20 | `clean_clarifications_and_team` | G7, G8 | nizak |
| 21 | `clean_storage_buckets` | G10 | nizak |
| 22 | `clean_connection_ledger_requester_payer` | G11, G12 | **visok — sukob sa kanonom, traži odluku vlasnika** |
| 23 | `clean_audit_and_provenance` | G15, G17 | nizak |
| 24 | `clean_need_plans` | G18 | srednji |

Edge funkcije (G16) i serverski safety gate (G13) nisu migracije nego deploy —
traže `OPENAI_API_KEY` i odluku po OD-04.

---

## 5. Zaključak

Destilacija 184 → 12 migracija je **zadržala jezgro tačno**: Potreba, prijava,
atomski izbor, Dogovor, privatnost, AI persistence. Penzionisane semantike su
dokazano odsutne.

Ali **nije zadržala sve korisno**. Osamnaest sposobnosti postoji u donoru a ne
u clean backendu, i pet od njih blokira V8 lanac odmah.

Najveći pojedinačni propust je **isporuka prilika sa objašnjenjem**
(`opportunity_deliveries.reason_codes`) — moj klijent trenutno izmišlja razlog
preporuke lokalno, umesto da ga dobije od servera.

Ništa nije menjano. Čeka se odluka koje od migracija 13–24 izvršiti.
