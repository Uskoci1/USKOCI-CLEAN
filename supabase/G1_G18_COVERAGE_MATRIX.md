# USKOČI — G1–G18 finalna coverage matrica

**Datum:** 30.08.2026 · **Baza:** clean DEV/ALPHA `leqcwgzvjsxugfgzdmth`
**Polazni dokument:** [DONOR_COVERAGE_AUDIT.md](DONOR_COVERAGE_AUDIT.md)

Gap se **ne zatvara zato što tabela postoji**. Zatvara se kad postoji ceo
autoritativni lanac. Statusi su namerno konzervativni.

| status | znači |
|---|---|
| `PROVEN` | radi i dokazano je izvršavanjem nad bazom |
| `IMPLEMENTED_NOT_RUNTIME_PROVEN` | postoji i statički je tačno, ali nije pokrenuto |
| `PARTIAL` | deo lanca radi, deo nedostaje — navedeno koji |
| `BLOCKED_OWNER_DECISION` | čeka produktnu odluku, ne tehniku |
| `BLOCKED_EXTERNAL_CONFIG` | čeka konfiguraciju van repozitorijuma |
| `NOT_IMPLEMENTED` | ne postoji |
| `RETIRED_BY_CANON` | noviji kanon ga je ukinuo — ne vraća se |

---

## Zbirno

| status | gapovi |
|---|---|
| `PROVEN` | G3, G9 |
| `PARTIAL` | G1, G2, G6, G10, G15, G17 |
| `IMPLEMENTED_NOT_RUNTIME_PROVEN` | G4, G14 |
| `NOT_IMPLEMENTED` | G5, G7, G11, G12, G13, G16 |
| `RETIRED_BY_CANON` | G8 |
| `BLOCKED_OWNER_DECISION` | G18 |

**Zatvoreno: 2 od 18.** Ovo nije pesimizam — marketplace motor jeste najveći
i najdokazaniji deo, ali ostalo je stvarno nedirnuto.

---

## G1 — Događaji i notifikacije · `PARTIAL`

| | |
|---|---|
| donor | `user_activity_events`, `notification_deliveries`, `_preferences`, `_push_devices`, `_push_attempts` |
| kanon | V8: „event → notifikacija → projekcija druge strane" |
| clean | svih 5 tabela + `private.emit_event()` kao jedini ulaz |
| migracija | `0016_clean_events_and_notifications`, `0017_clean_emit_event_engine` |
| RLS | korisnik vidi samo svoje; `push_attempts` nevidljivi svima |
| runtime | 363 događaja, 726 isporuka, 0 duplih `dedupe_key` |

Dokazano: durable event, idempotencija, kategorije, tihi sati, `SUPPRESSED` sa
razlogom (363× `PUSH_OFF`) — može se dokazati **zašto** neko nešto nije dobio.

**Šta nedostaje:** provajder. Nema Edge push dispatch-a, nema registrovanog
uređaja, nema receipt/retry/backoff. Lanac staje na `notification_deliveries`.
`DEVICE_PUSH_PROVEN` se **ne sme** tvrditi. Vidi G16.

## G2 — Planirani životni ciklus · `PARTIAL`

| | |
|---|---|
| donor | `r24_marketplace_tick` pod globalnim advisory lock-om |
| kanon | odluka vlasnika: bounded claim/queue, `FOR UPDATE SKIP LOCKED` |
| clean | `private.dispatch_schedule` + `dispatch_tick` + `expire_lifecycle` + `marketplace_tick` |
| migracija | `0026_clean_scheduled_lifecycle`, `0027_clean_cron_schedule` |
| runtime | pg_cron `* * * * *`, 5 uspešnih pokretanja iz zasebne sesije |

Advisory lock je namerno **odbačen** — bio je plafon od ~1.000 aktivnih Potreba.

**Šta nedostaje:** 48h auto-završetak je implementiran ispravno
(`requester_deadline_at` na redu, `problem_opened_at` ga blokira) ali **nikad
nije izvršen nad pravim Dogovorom**. Tick ga poziva; sam put nije dokazan.

## G3 — Isporuka prilika i objašnjivost · `PROVEN`

| | |
|---|---|
| clean | `dispatch_rounds`, `opportunity_deliveries`, matcher, KNN pretraga, O-1 budžet |
| migracija | `0021`–`0023`, `0025` |
| RLS | radnik vidi samo svoje isporuke; `dispatch_rounds` deny-all |
| runtime | 7 invarijanti dokazano — vidi [DISPATCH_RUNTIME_EVIDENCE.md](DISPATCH_RUNTIME_EVIDENCE.md) |

`reason_codes` i `score_components` se upisuju uz svaku isporuku, pa objašnjenje
nikad nije procenat bez pokrića.

**Ograničenje koje ostaje:** 60 redova nije dokaz za 100k. `LOAD_PROVEN` ne.

## G4 — Kompletnost `need_selections` · `IMPLEMENTED_NOT_RUNTIME_PROVEN`

Dodati `response_id`, `worker_account_id`, `worker_profile_id`, `selection_mode`
(`AUTO_FILL`/`REQUESTER_SELECTS`/`BIDDING`), `status`
(`SELECTED`/`CANCELLED`/`SUPERSEDED`), `updated_at`. Pokrivenost se računa iz
`need_selections`, kako donor i radi — `0014`, poravnanje RPC-a u `0015`.

Unique indeks drži jednu živu selekciju po prijavi.

**Nije dokazano:** `rpc_select_response` nije izvršen nad pravim prijavljenim
nalogom. Jest korišćen u G9 testu, ali samo kao upis reda, ne kroz RPC.

## G5 — Ocene posle završetka · `NOT_IMPLEMENTED`

M07 kaže da ocena postaje moguća posle završetka. `agreement_reviews` **ne
postoji**. `app_profiles.rating_worker` / `rating_requester` postoje i matcher
ih čita za komponentu `reliability` — dakle skor se oslanja na vrednost koju
ništa ne može da upiše. To je tiha rupa, ne samo nedostatak tabele.

## G6 — Kalendar, dostupnost, match preference · `PARTIAL`

| deo | stanje |
|---|---|
| `worker_match_preferences` | **postoji**, grube koordinate + geog + preference — `PROVEN` kroz dispatch |
| `profile_availability_windows` / `_rules` | postoje, `private.schedule_fit` ih čita fail-closed |
| `worker_calendar_events` | **ne postoji** |

Posledica: nema tvrdog kalendarskog konflikta. Radnik koji već ima potvrđen
Dogovor u istom terminu i dalje može da dobije prilíku — `schedule_fit` vidi
prozore i pravila, ali ne i zauzeća.

## G7 — Pitanja pre izbora · `NOT_IMPLEMENTED`

`need_clarifications` ne postoji. Nema anonimnog Q&A pre izbora, a time ni
mesta gde bi se sprovela zabrana razmene kontakta pre Povezivanja.

## G8 — Snapshot tima u prijavi · `RETIRED_BY_CANON`

Donorov `r37_linked_team_offer_snapshot` **jeste** penzionisan novijim kanonom.
`r40_simplified_multi_person_successor` doslovno kaže:

> „Latest product authority: ONE SUBMITTER → COVERED_SLOTS = X → X places filled."

i da R37 tabele ostaju samo kao nepromenljiva istorija, te da vezivanje
organizacije/tima **nije** preduslov ni autoritet za kapacitet.

Clean set to već implementira preko `covered_slots`, i multi-seat pokrivenost je
runtime-dokazana. **Ne vraća se.**

## G9 — Rok za prijave · `PROVEN`

Kolona je postojala od `0014`, ali je **niko nije sprovodio** — Potreba sa
isteklim rokom ostajala je `PUBLISHED` zauvek i trošila talase. Zatvoreno
migracijom `clean_need_response_deadline_expiry`, doslovno po donoru.

Runtime dokaz, obe grane:

| Potreba | rok prošao | izabran izvršilac | ishod |
|---|---|---|---|
| „G9 bez izbora" | da | ne | **EXPIRED** |
| „G9 sa izborom" | da | da | ostaje **PUBLISHED** |

Druga grana je suština: rok ne sme da ubije Potrebu za koju je posao već dodeljen.
Gašenje Potrebe povlači i zaustavljanje rundi, isticanje prilika i izbacivanje
iz reda za dispatch.

## G10 — Storage i politike · `PARTIAL`

| bucket | stanje |
|---|---|
| `profile-media` | postoji (zatečen iz `cloud_profile_foundation`) |
| fotografije Potrebe | **nema bucket-a** — a `needs.public_photo_paths` postoji |
| prilozi u chatu | **nema bucket-a** |
| dokaz o završetku | nije definisan za V1 |

`public_photo_paths` je kolona koja pokazuje na nepostojeće mesto. Bucket se
neće praviti „zato što ga donor ima" — pravi se onaj koji kanonski upload
zaista traži, i to sa politikom, ne samo sa imenom.

## G11 — Povezivanje / ledger · `NOT_IMPLEMENTED`

Odluka vlasnika je jasna i ima prioritet nad donorovim worker-quota modelom:
**Naručilac je payer/beneficiary, cena 0, FREE launch koristi pravi motor.**

Ne postoji `connection_access_ledger`, ni `access_basis`
(`UNMETERED`/`FREE_QUOTA`/`PRO`/`PAID_CONNECTION`), ni stanja
`UNLOCKED`/`RESTORED`/`REVOKED`.

Rizik ako se preskoči: „besplatno" se odsutnošću ledgera pretvara u *nepostojeću*
arhitekturu, pa uvođenje naplate kasnije traži prepravku Povezivanja umesto
promene jedne vrednosti. Cena 0 mora da prođe kroz **isti** put kao naplaćena.

## G12 — Otkazivanje, zamena, RESTORED · `NOT_IMPLEMENTED`

`recovery_cases` ne postoji. `agreement_execution.state` ima
`CONFIRMED / AWAITING_REQUESTER / COMPLETED / CANCELLED` — **nema `RESTORED`**.

Postoji ono što je dokazano tačno: jednostrano otkazivanje oslobađa **samo** tu
alokaciju (`0015`), bez globalnog kredita. Ali nema bounded replacement-a, ni
roka zamene, ni `RESTORED` stanja.

## G13 — Serverski safety gate · `NOT_IMPLEMENTED`

Kapija `ALLOW / CLARIFY / REVIEW / BLOCK` postoji **samo u lažnom klijentskom
izvoru** (`src/data/lazniAi.ts`). Na serveru je nema.

To znači: AI trenutno nije serverski ograničen. Dok se ovo ne zatvori, AI ne
sme da dobije nijedan autoritativni put. Deo je i `BLOCKED_EXTERNAL_CONFIG` —
model provajder traži secret koji ne postoji u projektu.

## G14 — `updated_at` konzistentnost · `IMPLEMENTED_NOT_RUNTIME_PROVEN`

`private.set_updated_at()` + 8 trigera (`0013`), `search_path` fiksiran u
`0028`. Triger na `opportunity_deliveries` jeste okidan tokom dispatch testova,
ali nije napravljen namenski test koji dokazuje da direktan `UPDATE` van RPC-a
podiže `updated_at` na svakoj tabeli.

## G15 — Audit trag · `PARTIAL`

Donor ima `private.r24_marketplace_audit_log`. Clean nema tabelu — svesna odluka:
dokaz o svakom talasu živi u samoj rundi (`candidate_limit_used`,
`budget_source`, `stop_reason`, `batch_size`).

To pokriva dispatch i **ništa drugo**. Nema traga o tome ko je izabrao, otkazao,
izmenio Dogovor ili podelio kontakt. Za sporove i za `RECOVERY_OPENED` to nije
dovoljno.

## G16 — Edge funkcije · `NOT_IMPLEMENTED`

**Deployovanih Edge funkcija: 0.** Nedostaju sve četiri iz donora:
AI interview, transcribe, push dispatch, location/route resolve.

Posledice koje se već vide drugde: G1 nema provajdera, G13 nema kapiju,
matcher nema routing (sve razdaljine su geodetske).

## G17 — AI provenance · `PARTIAL`

Ono što **postoji i tačno je** — `ai_structured_facts` nosi:

| kolona | vrednosti |
|---|---|
| `status` | `CONFIRMED`, `INFERRED`, `UNKNOWN`, `NEEDS_CONFIRMATION` |
| `source` | `EXPLICIT_USER_ANSWER`, `CONFIRMED_PROFILE`, `AI_INFERENCE`, `SYSTEM_DERIVED` |
| `scope` | `STABLE_PROFILE`, `LIVE_OVERRIDE`, `NEED_DRAFT` |
| ispravka | `superseded_at`, `superseded_by` |
| dokaz | `evidence_excerpt`, `confirmed_by_user_id`, `confirmed_at` |

To je tačno `AI_PROPOSED → HUMAN_CONFIRMED` sa mogućnošću ispravke bez brisanja.

**Nedostaje:** `ai_conversation_provenance_events` — log porekla na nivou
razgovora. I, ozbiljnije, ceo lanac ide kroz `rpc_ai_*` bez serverskog
rezonovanja (G16) i bez safety kapije (G13).

## G18 — NeedPlan / složena Potreba · `BLOCKED_OWNER_DECISION`

`need_plans` / `need_plan_parts` ne postoje. Donor ih ima kao najnoviji rad.
`needs.execution_location_mode` već poznaje `MULTI_STOP`, ali nema gde da se
zapišu same stanice.

**Pitanje za vlasnika:** da li su složene / multi-stop Potrebe u V1?
Neću ih graditi na osnovu toga što donor ima tabele.

---

# Reconciliation 89 migracija (local-preview 95 → donor 184)

Stari `USKOCI_LOCAL_PREVIEW_SOURCE` repo staje na `20260812_r4722`. Donor ide do
`20260822_need_plan_advisor_hardening`. Razlika je **89 migracija**.

**Ne vraćamo projekat na staru semantiku.** Iz razlike se uzimaju samo
capability-ji. Klasifikacija je po grupama, ne po fajlu.

| grupa | migracija | odluka | obrazloženje |
|---|---|---|---|
| PostGIS / KNN pretraga | 4 | **KEEP** (već REBUILT) | `0019`,`0020`,`0022` — u clean setu i runtime-dokazano |
| HITNO lifecycle | 1 | **KEEP** (već REBUILT) | `0024`,`0025` — dokazano, fail-closed |
| coverage-aware dispatch | 2 | **KEEP** (već REBUILT) | `0021`–`0023` + O-1 budžet |
| push infrastruktura | 6 | **REBUILD** | G1/G16 — scheduler, queue health, receipts, expiry uz očuvanje in-flight |
| routing / location provajder | 2 | **REBUILD** | G16 — sada su sve razdaljine geodetske |
| agreement evidence retention | 5 | **REBUILD** | G15 — dokaz za sporove; donor ga drži fail-closed |
| recovery restart idempotency | 1 | **REBUILD** | G12 |
| preconnection boundary + card guard | 4 | **REBUILD** | G7 — zabrana razmene kontakta pre Povezivanja |
| media path privacy | 1 | **REBUILD** | G10 — putanja ne sme da oda vlasnika |
| public worker profile minimization | 1 | **REBUILD** | privatnost javnog profila |
| security definer hardening | 3 | **MODIFY** | clean već ima strožu matricu; uzeti samo provere koje nedostaju |
| need_completion iz Dogovora | 1 | **MODIFY** | vezati za M07 lanac koji clean već ima |
| material clarification → revizija | 1 | **MODIFY** | M05 delimično postoji; uskladiti |
| future fixed schedule dispatch gate | 1 | **MODIFY** | Potreba u budućnosti ne sme da troši talase sada |
| AI draft projekcija + browse polja | 2 | **MODIFY** | R02 postoji; nedostaju browse polja |
| need_plan | 2 | **BLOCKED_OWNER_DECISION** | G18 — da li su složene Potrebe u V1 |
| pravni/RC2 blok (consent, export, retention, subprocessors, safety report, appeal, complaint) | 8 | **BLOCKED_OWNER_DECISION** | nije potrebno za zatvorenu alfu; **jeste** pre javnog lansiranja |
| multilingual conversation | 1 | **BLOCKED_OWNER_DECISION** | V1 je srpski |
| `retire_*` (legacy app tables, remote marketplace, auto-fill) | 3 | **RETIRE** | clean ih nikad nije ni preneo — ništa se ne radi |
| test driveri (`service_only_*`, `test_driver_*`) | 5 | **NOT_NEEDED** | donorska skela za testove |
| product analytics aggregate | 1 | **NOT_NEEDED** | nije V1 |
| forensic numeric/uuid/ambiguity popravke | ~10 | **NOT_NEEDED** | popravke donorovog koda koji je clean set ponovo napisao |
| ostale kompozitne „closure" migracije | ~25 | **MODIFY** po potrebi | sadrže mešavinu; uzima se pojedinačna provera, ne fajl |

Zbir odluka: **9 grupa REBUILD/MODIFY je stvaran posao koji ostaje**, 3 grupe su
već pokrivene, 3 su RETIRE/NOT_NEEDED, 3 čekaju vlasnika.

---

# Tačan sledeći korak

Redosled je izabran tako da svaki sledeći paket zavisi od prethodnog:

1. **G5 + G15** — `agreement_reviews` i audit trag. G5 je hitniji nego što
   deluje: matcher već boduje `rating_worker` koji ništa ne može da upiše.
2. **G12** — `recovery_cases`, `RESTORED`, bounded replacement.
3. **G7** — `need_clarifications` + granica razmene kontakta.
4. **G11** — `connection_access_ledger` + `access_basis`, cena 0 kroz pravi put.
5. **G6** — `worker_calendar_events`, tvrdi kalendarski konflikt.
6. **G10** — bucket-i i politike za fotografije Potrebe.
7. **G13 + G16** — Edge funkcije i serverska safety kapija.
8. **Runtime dokaz sa dva prijavljena naloga** — tek tada se RLS sme zvati
   dokazanim; `service_role` ne dokazuje ništa o RLS-u.

Čeka odluku vlasnika: **G18** (složene Potrebe u V1?), **RC2 pravni blok**
(pre javnog lansiranja), **multilingual** (V1 srpski?).

---

# Dopuna 30.08 — paket B (scoped contact reveal)

Novi capability koji nije bio u originalnoj G-listi, ali pripada privatnosti.
Detalji: [PACKAGE_B_CONTACT_REVEAL_EVIDENCE.md](PACKAGE_B_CONTACT_REVEAL_EVIDENCE.md)

| stavka | status |
|---|---|
| directional PHONE reveal | `AUTHENTICATED_RUNTIME_PROVEN` |
| directional EXACT_LOCATION reveal | `AUTHENTICATED_RUNTIME_PROVEN` |
| latentna rupa u izdavanju granta | zatvorena, `AUTHENTICATED_RUNTIME_PROVEN` |
| lifecycle granta (opoziv, istek) | `AUTHENTICATED_RUNTIME_PROVEN` |
| klijentski put do reveal-a | **nije dodirnut** — paket A |

Utiče i na G10/privatnost: `need_sensitive` politika više se ne oslanja na
ugnežđenu RLS `agreements` kao slučajnu odbranu.
