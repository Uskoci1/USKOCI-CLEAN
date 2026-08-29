# USKOČI — Marketplace Engine Reconciliation Pass

**Datum:** 29.08.2026
**Domen zamrznut:** matching, opportunity delivery, dispatch rounds,
notifications/push, availability, geography/radius, HITNO.
**Ništa iz ovog domena nije implementirano.** Ovo je predlog, ne izvršenje.

Izvor: donor migracije, pročitane do finalne definicije funkcija — ne po imenu
ni datumu. Autoritet: latest owner decision → V9 → V8 → V7 → V6 → donor dokaz.

---

## 1. Kako donor danas odlučuje

Sve što sledi je pročitano iz `private.r24_dispatch_next_wave`,
`private.r24_marketplace_tick`, `private.p1_urgent_activation_decision`
i `private.r24_marketplace_config`.

### 1.1 Ko je eligible — tri sita, ne jedno

```
1. private.r24_postgis_candidate_profile_ids(need_id)
   PostGIS KNN pretraga. Vraća profile PORAĐANE PO BLIZINI,
   sa candidate_rank kao rednim brojem.

2. private.r24_dispatch_cheap_candidate_admitted(need_id, profile_id)
   Jeftin pred-filter. Odbacuje očigledno neodgovarajuće pre skupog računa.

3. candidateLimit (40)
   Tvrda granica. Motor nikad ne skenira ceo grad.

4. private.r24_match_detail(need_id, profile_id)
   Skup račun. Vraća { score, scoreComponents, reasonCodes,
                       dispatchEligible, distanceToStartKm,
                       arrivalEtaMinutes, ... }

5. Prolaze samo oni sa dispatchEligible = true.
```

Ovo je **streaming bounded retrieval** — verzija `P1_STREAMING_BOUNDED_GEO_KNN_V3`.
Nije „nađi sve pa sortiraj".

### 1.2 Kako se rangira

```sql
order by (detail->>'score')::numeric desc, pid
```

`pid` je stabilan tie-breaker — isti ulaz daje isti redosled, uvek.

### 1.3 Koliko kandidata dobija svaki talas

Iz `private.r24_marketplace_config`, **već konfigurabilno**, nije zakucano:

| ključ | waveSizes | windowMinutes | targetResponses | candidateLimit |
|---|---|---|---|---|
| `dispatch_normal` | `[5, 5, 10, 20]` | 15 | 3 | 40 |
| `dispatch_urgent` | `[10, 10, 20]` | 3 | 3 | 40 |

**Nalaz:** ono što si zvao „magic 5/10/15" već je konfiguracija u bazi.
Ne treba graditi konfigurabilnost — treba je zadržati.

### 1.4 Kada se talas širi

Tick svakog minuta poziva sledeći talas ako prethodni nije zaustavljen.
Broj talasa se broji **po hitnosti odvojeno**:

```sql
select count(*)+1 into policy_wave_no
  from dispatch_rounds
 where need_id=nid and need_revision=n.revision
   and urgency = case when n.urgent then 'URGENT' else 'NORMAL' end;
```

Posledica: ako Potreba pređe iz NORMAL u HITNO, **merdevine talasa kreću
iz početka** za hitni režim. To je namerno — hitno ne nasleđuje potrošene talase.

### 1.5 Kada se staje — i sa kojim razlogom

| stop_reason | uslov |
|---|---|
| `NEED_NOT_OPEN` | status nije `PUBLISHED` ni `SELECTION` |
| `SLOTS_FILLED` | `remaining = 0` |
| `RESPONSE_TARGET_AND_COVERAGE_REACHED` | `active >= targetResponses` **I** `active_coverage >= remaining` |
| `WAVES_EXHAUSTED` | potrošeni svi talasi za taj režim |
| `NO_ELIGIBLE_CANDIDATES` | talas nije uspeo da ubaci nijednog |

### 1.6 Kako multi-seat utiče na sledeći talas — **ovo je najpametniji deo**

Zaustavljanje **nije** „stiglo je 3 prijave". Uslov je:

```
active >= targetResponses  I  active_coverage >= remaining
```

`active_coverage` je zbir `covered_slots` živih prijava.

Znači: za Potrebu od 2 mesta, **jedna prijava koja pokriva oba mesta zaustavlja
dispatch** — ne čeka se da stignu tri. A tri prijave koje pokrivaju po jedno
mesto za Potrebu od 5 mesta **ne zaustavljaju** dispatch, jer pokrivenost nije
dovoljna.

Motor razume razliku između broja odgovora i količine pokrivenosti.

### 1.7 Koje reason_codes proizvodi

Iz `r24_match_detail` i pratećih:

```
MISSING_REQUIRED_VEHICLE      MISSING_REQUIRED_TOOL
MISSING_REQUIRED_LICENSE      MINIMUM_EXPERIENCE_NOT_MET
EXPERIENCE_REQUIREMENT_MET    TEAM_CAPACITY_AVAILABLE
GEODESIC_DISTANCE_FALLBACK    GEODESIC_FALLBACK_UNAVAILABLE
AVAILABILITY_ACTIVE_REQUIRED  NEED_ALREADY_FILLED
```

Uz njih ide `scoreComponents` sa mernim vrednostima:

```
distanceToStartKm          arrivalEtaMinutes
totalTravelDistanceKm      taskRouteDistanceKm
taskRouteDurationMinutes   taskLocationMode
distanceSource             routingProvider
routingEstimateExpiresAt
```

**Ovo je tačno kanonsko rešenje**: CARD dobija razlog rečima, a sirov procenat
ostaje u bazi i ne izlazi u UI.

### 1.8 Kada nastaje notification event / push

Unutar iste petlje koja ubacuje isporuku:

```sql
perform private.r24_emit(
  worker_uid, 'WORKER', 'OPPORTUNITY_AVAILABLE', 'NEED', need_id,
  'Nova prilika koja može da Vam odgovara', left(title,140),
  'opp:'||need_id||':'||revision||':'||worker_uid,   -- dedupe_key
  null,
  jsonb_build_object('needRevision',…, 'reasonCodes',…, 'remainingSlots',…),
  deadline);
```

Dva važna detalja:

- **`dedupe_key` sadrži reviziju.** Isti radnik za istu reviziju dobija tačno
  jedno obaveštenje. Materijalna izmena Potrebe diže reviziju → nova isporuka
  je legitimna, ne spam.
- **payload nosi `reasonCodes`** — objašnjenje putuje sa obaveštenjem.

Push ide odvojeno, kroz `p2_invoke_push_dispatch` na cron-u (`* * * * *` za
slanje, `*/5 * * * *` za potvrde prijema).

### 1.9 Šta se dešava kad niko ne reaguje

```
isporuka expires_at = now + windowMinutes  →  status EXPIRED
talas bez ijednog kandidata                →  dispatch_rounds STOPPED
                                              stop_reason NO_ELIGIBLE_CANDIDATES
potrošeni talasi                           →  WAVES_EXHAUSTED
needs.response_deadline prošao             →  needs.status = EXPIRED
```

Sve pod `pg_try_advisory_xact_lock('USKOCI_R24_MARKETPLACE_TICK')` — dva ticka
se ne mogu preklopiti.

---

## 2. HITNO — šta stvarno postoji

### 2.1 Postoji

| element | stanje |
|---|---|
| `needs.urgent` boolean | postoji |
| `needs.urgent_activated_at` / `_expires_at` / `_policy_version` | postoje |
| `dispatch_urgent` config | postoji, `[10,10,20]` / 3 min |
| `dispatch_rounds.urgency` `NORMAL`\|`URGENT` | postoji |
| `p1_urgent_activation_decision` | **fail-closed kapija sa 13 reason codes** |
| `urgent_activation_policy` config | postoji |

### 2.2 Ali je isključeno

```json
{"enabled": false, "policyVersion": "P1_URGENT_V1",
 "allowedCategories": [], "maxMinutesToStart": 360, "maxLifetimeMinutes": 60}
```

`enabled:false` **i** prazan `allowedCategories`. Dve nezavisne brave.
Danas nijedna Potreba ne može da postane HITNA.

### 2.3 Uslovi koje kapija proverava

```
URGENT_POLICY_DISABLED              politika ugašena
URGENT_CATEGORIES_NOT_ADMITTED      nijedna kategorija nije dozvoljena
URGENT_CATEGORY_NOT_ADMITTED        ova kategorija nije na listi
URGENT_POLICY_BOUNDS_INVALID        parametri van granica
URGENT_PHYSICAL_TASK_REQUIRED       daljinski posao ne može biti hitan
URGENT_START_ALREADY_PASSED         početak prošao pre >15 min
URGENT_TOO_EARLY                    početak dalji od maxMinutesToStart (6h)
URGENT_CURRENT_TIME_WINDOW_REQUIRED nema starts_at ni TODAY_FLEXIBLE
NEED_NOT_OPEN · NEED_ALREADY_FILLED · NEED_RESPONSE_WINDOW_EXPIRED
FORBIDDEN · NEED_NOT_FOUND
```

Trajanje hitnosti: `min(now + maxLifetimeMinutes, response_deadline, starts_at)`.
Hitnost **ističe sama** — nije trajno stanje.

### 2.4 Šta nedostaje

| nedostaje | posledica |
|---|---|
| **UI signal za HITNO** | nema ni na CARD-u, ni na pinu, ni u push-u |
| **jedna autoritativna urgency projekcija** | svaki potrošač bi računao sam |
| odluka koje kategorije smeju HITNO | `allowedCategories` je prazan |
| odluka da li se HITNO uopšte pali u V1 | `enabled:false` |

---

## 3. Šta moja clean šema nema — nalazi iz ovog prolaza

Čitao sam **finalnu** šemu, ne prvi `create table`. Kopirao sam ranu verziju.

| kolona / vrednost | status u clean |
|---|---|
| `needs.urgent` + 3 `urgent_*` kolone | ❌ nema |
| `needs.execution_location_mode` (`STATIONARY`, `POINT_TO_POINT`, `MULTI_STOP`, `AREA_BASED`, `REMOTE`) | ❌ nema |
| `needs.minimum_experience_years` | ❌ nema |
| `schedule_kind`: `TODAY_FLEXIBLE`, `TOMORROW_FLEXIBLE`, `WEEK_FLEXIBLE` | ❌ nema — imam samo 3 od 6 |
| PostGIS ekstenzija | ❌ nije uključena |

**`TODAY_FLEXIBLE` posebno**: bez njega HITNO kapija ne može da prođe za Potrebu
bez tačnog `starts_at` — a to je najčešći hitan slučaj.

---

## 4. Predlog canonical V1 motora

### 4.1 DONOR KEEP — bez izmene

| element | zašto |
|---|---|
| tri sita eligibility-ja (KNN → cheap → deep) | ograničava skup račun; `candidateLimit` sprečava skeniranje grada |
| `order by score desc, pid` | stabilan i deterministički |
| konfiguracija u `r24_marketplace_config` | već je konfigurabilno; ne graditi ponovo |
| `active >= target AND coverage >= remaining` | jedini uslov koji ispravno razume multi-seat |
| `dedupe_key` sa revizijom | anti-spam koji dozvoljava legitimnu ponovnu isporuku |
| `reasonCodes` + `scoreComponents` odvojeno | objašnjenje bez sirovog procenta |
| advisory lock u ticku | sprečava preklapanje |
| revoke sa `authenticated`, grant samo `service_role` | klijent nikad ne pokreće dispatch |
| brojanje talasa po hitnosti odvojeno | hitno ne nasleđuje potrošene talase |
| isticanje isporuke po `windowMinutes` | |

### 4.2 MODIFY — noviji kanon menja semantiku

| # | izmena | razlog |
|---|---|---|
| M-1 | **`targetResponses` postaje `targetCoverage`-svesan po režimu** | Danas je `target=3` fiksno za oba režima. Za HITNO 3 odgovora pre nego što se stane je sporo. Predlog: HITNO staje na `active_coverage >= remaining` bez uslova broja odgovara. |
| M-2 | **jedna autoritativna urgency projekcija** | Uvesti `fn_need_urgency(need_id) → {level, expiresAt, reasonCodes}`. CARD, DETAIL, mapa/pin i push čitaju **isto**. Bez toga svaki potrošač računa sam — to je paralelna logika koju si zabranio. |
| M-3 | **`urgent_activation_policy.enabled` ostaje `false` do tvoje odluke** | fail-closed. Motor se gradi, kapija ostaje zatvorena dok ne odlučiš kategorije. |
| M-4 | **radius expansion po talasu** | Danas je KNN ograničen `candidateLimit`-om, ali radius nije eksplicitno širen po talasu. Predlog: `waveRadiusKm: [5, 10, 20, 40]` uz `waveSizes`, pa se svaki talas gleda dalje. |
| M-5 | **notification priority po hitnosti** | HITNO push mora da ide sa višim prioritetom i da ignoriše tihe sate; normalan ne. |

### 4.3 NEW — ne postoji u donoru

| # | novo | zašto |
|---|---|---|
| N-1 | **UI signal za HITNO na CARD-u i pinu** | Ne pravi se paralelni model Potrebe. Ista `PrilikaProjekcija` dobija `hitnost: { nivo: 'NORMALNO' \| 'HITNO', istice: string \| null }`. CARD dobija narandžastu traku, pin dobija prsten — jedan izvor, tri prikaza. |
| N-2 | `fn_need_urgency` kao jedina projekcija | vidi M-2 |
| N-3 | `waveRadiusKm` u konfiguraciji | vidi M-4 |

### 4.4 Šta NE predlažem

- **Ne diram wave veličine [5,5,10,20].** Nemam dokaz da su loše; menjati ih bez
  podataka je nagađanje. Ostaju konfigurabilne, pa se menjaju bez migracije.
- **Ne uvodim novi scoring.** Donorov je zreo i ima komponente. Zamena bi bila
  paralelna logika.
- **Ne palim HITNO.** To je tvoja odluka o kategorijama i riziku.

---

## 5. Posledice predloga

| odluka | posledica |
|---|---|
| KEEP tri sita | traži **PostGIS** ekstenziju na clean projektu |
| KEEP dispatch | traži `needs.urgent`, `execution_location_mode`, 3 `schedule_kind` vrednosti |
| KEEP notifikacije | traži `user_activity_events` + `notification_deliveries` pre dispatch-a |
| KEEP cron | traži `pg_cron` na clean projektu |
| M-2 urgency projekcija | menja `PrilikaProjekcija` u klijentu — dodaje `hitnost` |
| M-4 radius expansion | menja konfiguraciju, ne šemu |
| N-1 UI signal | menja CARD i mapu; ne menja model Potrebe |

**Redosled koji iz ovoga sledi** razlikuje se od audita: notifikacije moraju
pre dispatch-a, jer dispatch emituje događaje.

```
15 events+notifications  →  17 dispatch  →  16 scheduler
```

---

## 6. Šta mi treba od tebe pre implementacije

1. **HITNO u V1 — da ili ne.** Ako da, koje kategorije i da li `maxMinutesToStart`
   ostaje 6h.
2. **M-1** — da li HITNO sme da stane samo na pokrivenosti, bez uslova od 3 odgovora.
3. **M-4** — da li uvodimo `waveRadiusKm` ili radius ostaje implicitan u KNN-u.
4. Potvrda da smem da uključim **PostGIS** i **pg_cron** na clean projektu.

Do tvog odgovora ne diram ovaj domen.
