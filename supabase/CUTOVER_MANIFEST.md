# USKOČI — Clean Supabase Cutover Manifest

**Status:** ✅ **PRIMENJENO** 29.08.2026 na clean DEV/ALPHA projekat `leqcwgzvjsxugfgzdmth`
12 migracija (01–10 + dve bezbednosne ispravke). Production nije dirana.
**Cilj baze:** nov development/ALPHA projekat (prazan)
**Zabranjeno:** production deploy, production mutacija, GitHub push, CONTRACT pre dokaza

Donor je izvor **dokazanog motora**, ne kanonske istine.
Autoritet: najnovija owner odluka → V9 → V8 → V7 → V6 → donor dokaz → Wave CL (UI/UX).
Gde donor protivreči novijem kanonu — **noviji kanon pobeđuje**.

Cilj nije prepisati 184 migracije, nego iz njih rekonstruisati minimalan
kanonski backend koji zadržava sve dokazano korisno.

---

## Zatečeno stanje ciljne baze

| | |
|---|---|
| tabele | `app_accounts`, `app_profiles`, `profile_availability_windows`, `profile_availability_rules` |
| migracije | `cloud_profile_foundation_1_3b`, `lock_down_auth_trigger_functions_1_3b` |
| Edge funkcije | 0 |
| `rpc_*` funkcije | 0 |
| redovi | 0 u svim tabelama |

Auth/profil temelj **već postoji** i poklapa se sa donorom — to je početna prednost,
ne prepreka.

### Otvoren bezbednosni nalaz u zatečenoj bazi

`public.rls_auto_enable()` je `SECURITY DEFINER` i izvršiv od strane `anon`
preko `/rest/v1/rpc/rls_auto_enable`. Nalaz Supabase advisora, ne moja procena.
Odluka: **MODIFY** — oduzeti `EXECUTE` roli `anon` i `authenticated`.

---

## Odluke po objektima

### Temelj naloga i profila

| donor objekat | odluka | razlog | zamena / cilj |
|---|---|---|---|
| `app_accounts` | **KEEP** | već postoji u ciljnoj bazi, isti oblik | — |
| `app_profiles` | **KEEP** | isto | — |
| `profile_availability_windows` | **KEEP** | temelj dostupnosti, bez sukoba sa kanonom | — |
| `profile_availability_rules` | **KEEP** | isto | — |
| `rls_auto_enable()` | **MODIFY** | izvršiva od `anon` | `revoke execute from anon, authenticated` |

### Potreba

| donor objekat | odluka | razlog | zamena / cilj |
|---|---|---|---|
| `needs` | **KEEP** | nosi `revision`, `required_slots` i namerno grubu geografiju `numeric(6,2)` — tačna lokacija ne curi kroz javnu projekciju | — |
| `needs.status` enum | **MODIFY** | sadrži `AGREEMENT_PENDING`, ostatak starog lanca sa trećom potvrdom | ukloniti tu vrednost iz novog `check` |
| `need_selections` | **KEEP** | veže izbor za Potrebu | — |
| `need_sensitive` | **KEEP** | odvaja tačnu adresu od javnog dela | — |
| `need_plans`, `need_plan_parts` | **KEEP** | najnoviji rad u donoru (poslednja četvrtina migracija) | — |

### Prijava — M02 osnova

| donor objekat | odluka | razlog | zamena / cilj |
|---|---|---|---|
| `marketplace_responses` | **KEEP** | `submitted_against_need_revision` i `current_version` su **tačno** vezivanje koje M02 traži; `status` već sadrži `STALE` | — |
| `marketplace_response_versions` | **KEEP** | verzija nosi `need_revision` — bez toga nema tačnog izbora | — |
| unique index `one_live_per_worker_need` | **KEEP** | sprečava dve žive prijave istog Uskočera | — |

### Dogovor — ovde je sukob sa kanonom

| donor objekat | odluka | razlog | zamena / cilj |
|---|---|---|---|
| `agreements` | **KEEP** | struktura i veze su tačne | — |
| `agreements.status` = `AWAITING_CONFIRMATIONS` | **RETIRE** | **sukob:** M02 i M10 ukidaju treću potvrdu. Izbor atomski pravi `CONFIRMED`. | novi `check` bez te vrednosti |
| `agreement_confirmations` | **RETIRE** | cela tabela postoji za bilateralnu potvrdu koju kanon više ne traži | ne kreirati u clean setu; ne brisati u donoru |
| `agreement_versions` | **KEEP** | `terms jsonb` + `content_hash` + `supersedes_version` — tačno M05 model | — |
| `agreement_messages` | **KEEP** | jedna nit po Dogovoru, kako M03 traži | — |
| `agreement_execution` | **MODIFY** | `state` sadrži `EN_ROUTE`, `ARRIVED`, `AWAITING_APPROVAL` — merdevine koje M07 ukida | novi `check`: `CONFIRMED`, `AWAITING_REQUESTER`, `COMPLETED`, `CANCELLED` |

### Privatnost — drugi sukob

| donor objekat | odluka | razlog | zamena / cilj |
|---|---|---|---|
| `private_access_grants` | **REBUILD** | **sukob:** jedan grant po `(agreement, version)` je *combined reveal*, koji M10 izričito ukida. Kanon traži odvojene i **usmerene** dozvole. | nova tabela sa `channel` (`PHONE`/`LOCATION`) i `direction` (ko kome deli) |
| kombinovani reveal u RPC lancu | **RETIRE** | isti razlog | zameniti po-kanalnim komandama |

### AI motor — najvredniji deo donora

| donor objekat | odluka | razlog | zamena / cilj |
|---|---|---|---|
| `ai_conversations` | **KEEP** | — | — |
| `ai_structured_facts` | **KEEP** | nosi `status`, `source`, `scope='NEED_DRAFT'`, `evidence_excerpt` i **`superseded_at`** — to je tačno `AI_PROPOSED → HUMAN_CONFIRMED` i mehanizam ispravke | — |
| `ai_action_proposals` | **KEEP** | — | — |
| `private.ai_conversation_provenance_events` | **KEEP** | dokaz porekla činjenice | — |
| `rpc_ai_propose_fact` / `rpc_ai_confirm_fact` | **KEEP** | dva odvojena koraka; AI ne može da upiše potvrđeno | — |
| Edge `uskoci-ai-interview` | **KEEP** | — | — |
| Edge `uskoci-ai-transcribe` | **KEEP** | — | — |

**Zašto KEEP a ne REBUILD:** klijentski model u `src/data/lazniAi.ts` je već
preslikan iz ovog oblika. Zamena lažnog izvora pravim RPC-om ne dira ekran.

### Notifikacije i događaji

| donor objekat | odluka | razlog |
|---|---|---|
| `notification_deliveries`, `notification_preferences` | **KEEP** | temelj postoji |
| `notification_push_devices`, `notification_push_attempts` | **KEEP** | — |
| `opportunity_deliveries`, `dispatch_rounds` | **KEEP** | isporuka prilika |
| Edge `uskoci-push-dispatch` | **KEEP** | — |

### Nasleđe koje se ne prenosi

| donor objekat | odluka | razlog |
|---|---|---|
| `alpha_needs`, `alpha_offers`, `alpha_profiles`, `alpha_notifications` | **RETIRE** | mrtva generacija — pominjanja padaju sa 140 na **0** kroz istoriju migracija |
| `uskoci_preview_chunks` | **RETIRE** | artefakt prototipa |

---

## Redosled čistih migracija

Po V7: **EXPAND → PROVE → CUT CLIENT → PROVE AGAIN → CONTRACT**.
CONTRACT se ne izvršava dok novi put nije dokazan.

| # | migracija | sadržaj | reverzibilna |
|---|---|---|---|
| 01 | `clean_security_hardening` | oduzimanje `EXECUTE` sa `rls_auto_enable` | da |
| 02 | `clean_need_foundation` | `needs`, `need_sensitive`, `need_selections` | da (drop) |
| 03 | `clean_response_foundation` | `marketplace_responses`, `..._versions`, unique index | da |
| 04 | `clean_agreement_foundation` | `agreements`, `agreement_versions`, `agreement_messages`, `agreement_execution` — **bez** `AWAITING_CONFIRMATIONS` i **bez** `agreement_confirmations` | da |
| 05 | `clean_directional_access_grants` | nova po-kanalna, usmerena tabela dozvola | da |
| 06 | `clean_ai_persistence` | `ai_conversations`, `ai_structured_facts`, `ai_action_proposals` | da |
| 07 | `clean_rls_policies` | RLS za sve gore | da |
| 08 | `clean_rpc_selection` | atomski `rpc_select_response` (M02) | da |
| 09 | `clean_rpc_agreement_lifecycle` | izmena, otkazivanje, završetak, 48h tick (M05/M06/M07) | da |
| 10 | `clean_rpc_ai_intake` | propose / confirm / publish (R02) | da |

---

## Šta je potrebno od vlasnika

1. Potvrda da je zatečeni prazan projekat ciljni development/ALPHA — ili drugi
   projekat na kome smem da radim.
2. Ništa drugo. Migracije se pišu i bez toga; primena čeka tu jednu reč.

## Post-apply dokaz

| provera | rezultat |
|---|---|
| tabela u `public` | 17 (4 zatečene + 13 novih) |
| `rpc_*` funkcija | 11 |
| RLS politika | 32 |
| tabela **bez** RLS | **0** |
| `agreement_confirmations` | **ne postoji** — treća potvrda penzionisana |
| `private_access_grants` | **ne postoji** — combined reveal penzionisan |

Kanon je sada zapisan u samoj bazi, ne samo u dokumentu:

```
agreements_status_check          CONFIRMED, SUPERSEDED, CANCELLED, COMPLETED
                                 (nema AWAITING_CONFIRMATIONS)
agreement_execution_state_check  CONFIRMED, AWAITING_REQUESTER, COMPLETED, CANCELLED
                                 (nema EN_ROUTE, ARRIVED)
agreement_execution_check        AWAITING_REQUESTER zahteva postavljen rok
```

### Matrica izvršnih dozvola

| funkcija | `anon` | prijavljen | namera |
|---|---|---|---|
| `rls_auto_enable` | ne | ne | administrativna, poziva je event trigger |
| `fn_is_party` | ne | ne | interni pomoćnik |
| `fn_need_covered_slots` | ne | ne | interni pomoćnik |
| `rpc_tick_auto_completion` | ne | ne | samo scheduler servisnim ključem |
| ostalih 9 `rpc_*` | ne | **da** | autoritativni put; svaka sama proverava `auth.uid()` |

**Ništa nije dostupno neprijavljenom korisniku.**

### Dve greške uhvaćene posle primene

1. **Revoke od `anon` nije bio dovoljan.** Funkcije podrazumevano imaju
   `GRANT EXECUTE TO PUBLIC`, koji `anon` nasleđuje. Migracija 01 je bila
   nedovoljna; ispravljeno migracijom `clean_revoke_public_execute`.
2. **Ni revoke od `PUBLIC` nije bio dovoljan** za pomoćne funkcije. Supabase
   ima `ALTER DEFAULT PRIVILEGES` koji **imenovano** dodeljuje `EXECUTE` roli
   `authenticated` na svaku novu funkciju. Ispravljeno migracijom
   `clean_revoke_helper_execute_from_authenticated`.

## Status oznaka

| sloj | oznaka |
|---|---|
| šema, RLS, RPC na clean ALPHA | **IMPLEMENTED** |
| kanonska pravila u `check` ograničenjima | **PROVEN** — provereno upitom |
| matrica dozvola | **PROVEN** — provereno upitom |
| klijent → Supabase | **EXTERNAL CONFIG REQUIRED** — nema URL/anon key u aplikaciji |
| end-to-end lanac sa pravim korisnikom | **nije PROVEN** — nema auth korisnika ni podataka |

---

# Nastavak: migracije 15–18 (29.08.2026)

Primenjeno na isti clean DEV/ALPHA projekat. Production nije dirana.
Runtime dokazi: [DISPATCH_RUNTIME_EVIDENCE.md](DISPATCH_RUNTIME_EVIDENCE.md).

| # | migracija | sadržaj |
|---|---|---|
| 15 | `clean_events_and_notifications` | 5 tabela događaja i notifikacija, quiet hours, `SUPPRESSED` sa razlogom |
| 15 | `clean_emit_event_engine` | `private.emit_event()` — jedini ulaz za događaje |
| 15b | `clean_needs_schema_completion` | `urgent*`, `execution_location_mode`, 6 `schedule_kind` vrednosti |
| 16 | `clean_geo_foundation` | PostGIS, geometrija, GiST |
| 16b | `clean_geo_foundation_repair` | **ispravka 16** — PostGIS u `extensions`, `worker_match_preferences` |
| 17a | `clean_dispatch_foundation` | `dispatch_rounds`, `opportunity_deliveries`, `marketplace_config` |
| 17b | `clean_dispatch_engine` | matcher, jeftina admisija, streaming KNN pretraga |
| 17c | `clean_dispatch_wave` | O-1 budžet + talas |
| 17d | `clean_urgency_projection` | `fn_need_urgency`, politika HITNO, anti-bypass trigger |
| 17e | `clean_urgent_min_choice_floor` | O-3 pod izbora za HITNO |
| 18 | `clean_scheduled_lifecycle` | `dispatch_schedule`, claim `FOR UPDATE SKIP LOCKED`, isticanja |
| 18b | `clean_cron_schedule` | pg_cron, `marketplace_tick(25)` svakog minuta |
| — | `clean_advisor_hardening` | dva bezbednosna nalaza zatvorena |

## Dve greške uhvaćene u ovom talasu

3. **PostGIS je otišao u `public`** (≈500 funkcija) umesto u `extensions`, gde
   ga donor schema-kvalifikuje. Ispravljeno u 16b; `public` sada ima 0 `st_*`.
4. **Radnička geografija je bila na `app_profiles` u `numeric(9,6)`** — puna
   preciznost na redu profila, tj. kućna adresa radnika. Donor je drži na
   `worker_match_preferences` u `numeric(6,2)/(7,2)`, isto grubo kao Potrebu.
   Ispravljeno u 16b pre nego što je išta zavisilo od nje.

Obe su nađene poređenjem sa **finalnom** donor semantikom, ne sa ranom
definicijom tabele — po uputstvu vlasnika.

## Odstupanja od donora i razlog

| donor | clean | razlog |
|---|---|---|
| globalni advisory lock oko dispatcha | `FOR UPDATE SKIP LOCKED` claim/queue | odluka vlasnika; advisory lock je bio plafon od ~1.000 aktivnih Potreba |
| fiksni `candidateLimit` 40 | O-1 ograničeni dinamički budžet, pod 40 | odluka vlasnika (opcija B) |
| `r24_marketplace_audit_log` | `dispatch_rounds.candidate_limit_used` + `budget_source` | dokaz živi u samoj rundi, bez zasebne tabele |
| regionalni novac (`task_currency_code`) | samo RSD | clean set je RSD |
| `r31` deep matcher, kalendar, routing | izostavljeno | vidi *Otvoreni nedostaci* u dokazima |
