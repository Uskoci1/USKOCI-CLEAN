# USKOČI — Adaptive Bounded Dispatch Design

**Datum:** 29.08.2026 · **Status:** predlog, ništa nije implementirano
**Domen ostaje zamrznut** dok ne odobriš.

---

## 1. Donor ponašanje koje ostaje

Ceo cevovod ostaje. Menja se **samo politika** koja odgovara na tri pitanja:
*koliko*, *kada*, *koliko daleko*.

```
KNN (PostGIS)  →  jeftini filter  →  candidateLimit  →  deep match
                                                          ↓
                                            dispatchEligible = true
                                                          ↓
                                          order by score desc, pid
                                                          ↓
                                    ┌── ADAPTIVNA POLITIKA ──┐   ← jedino novo
                                    │ batch · window · radius │
                                    └─────────────────────────┘
                                                          ↓
                              opportunity_deliveries + r24_emit
```

**KEEP bez izmene:** KNN bounded retrieval, jeftini filter, deep match,
`candidateLimit`, sve hard eligibility provere, availability, capability,
vehicle/tool/licence, experience, team capacity, distance, ETA, route info,
`scoreComponents`, `reasonCodes`, deterministički `score desc, pid`, multi-seat
coverage, `dispatch_rounds`, `opportunity_deliveries`, delivery expiry,
`dedupe_key` sa revizijom, advisory lock, `response_deadline`, event generation,
push dispatch, odvojene NORMAL/HITNO merdevine, fail-closed urgent activation.

**Nalaz vredan isticanja:** jeftini filter već proverava
`pref.proactive_notifications = true`. **Anti-spam počinje u eligibility-ju**,
ne u dostavi. Korisnik koji je isključio proaktivna obaveštenja nikad ne uđe
ni u kandidatski skup — ne troši ni deep match ni routing poziv.

---

## 2. Problemi fiksnih talasa

Pet konkretnih, ne stilskih.

**P1 — Talas je slep za veličinu bazena.** Ako postoje tačno 3 eligible
kandidata, talas od 5 pošalje 3 i potroši jedan stepenik merdevina. Sledeći
talas nema kome da pošalje, ali se i dalje čeka `windowMinutes`.

**P2 — Talas je slep za kvalitet.** Kandidat sa `score` 95 i kandidat sa 40 ulaze
u isti batch. Za NORMAL to je spam: obavestili smo 20 ljudi kad su 3 bila odlična.

**P3 — Prozor je slep za vreme do početka.** Posao koji počinje za 30 minuta
dobija isti prozor od 15 minuta kao posao za sledeću nedelju. Dve merdevine
NORMAL-a potroše ceo raspoloživi rok.

**P4 — Radijus je implicitan.** KNN + `candidateLimit` znači da u Beogradu 40
kandidata staje u 2 km, a u malom gradu 40. kandidat je 60 km daleko i besmislen.
Ista brojka, potpuno različito značenje.

**P5 — Nema povratne sprege.** Ako je prvi talas dao 0 odgovora od 5, motor i
dalje čeka pun prozor pre drugog. Ne uči iz nereagovanja.

---

## 3. Predloženi algoritam

Politika je **čista funkcija** nad posmatranim stanjem. Ne dodiruje eligibility.

```
policy(need, waveNo, observed, config) → { batch, windowMinutes, radiusKm, stop }
```

### 3.1 Gustina tržišta — besplatno, iz KNN-a

Ne uvodim novu tabelu ni novi upit. KNN **već** vraća kandidate poređane po
udaljenosti. Uzmemo udaljenost k-tog:

```
gustina = distanceOf(k-tog kandidata) / k        [km po kandidatu]
```

| gustina | tumačenje | ponašanje |
|---|---|---|
| < 0.15 km/kand. | vrlo gusto (centar Beograda) | ne širi, sužavaj po kvalitetu |
| 0.15 – 0.5 | gusto (Novi Sad, Niš) | standardno |
| 0.5 – 2.0 | retko (mali grad) | širi ranije |
| > 2.0 | vrlo retko (ruralno) | širi odmah i agresivno |

**Ovo je jedini pošten način** — pragovi u kilometrima bi bili nagađanje, a
gustina se meri iz onoga što ionako računamo.

### 3.2 Kvalitetni prag — rešava P2

```
topScore     = score[0]
qualityFloor = topScore × qualityRatio        (config, predlog 0.72)
qualified    = count(candidates where score >= qualityFloor)
```

**NORMAL:** `batch = min(configBatch, qualified)`
Ako su samo 3 kandidata iznad praga, obavesti 3 — ne 20.

**HITNO:** `qualityRatio` je niži (predlog 0.55), jer je brzina pretežnija.

### 3.3 Veličina talasa

```
ocekivanaStopa   = observed.responseRate ?? config.priorResponseRate   (0.25)
prosecnaPokrivenost = observed.avgCoveragePerResponse ?? 1
potrebnoOdgovora = max(coverageGap / prosecnaPokrivenost, minChoice - activeResponses)
sirovBatch       = ceil(potrebnoOdgovora / ocekivanaStopa)

batch = clamp(sirovBatch, config.minBatch, config.maxBatch)
batch = min(batch, qualified)                    ← kvalitetni plafon
batch = min(batch, candidateLimit - vecPoslato)  ← tvrda granica ostaje
```

Kad prvi talas ne da nijedan odgovor, `responseRate` pada, `sirovBatch` raste —
motor sam širi. To je P5.

### 3.4 Prozor između talasa

```
preostaloTalasa = config.maxWaves - waveNo
vremeDoPocetka  = starts_at - now              (ako postoji)
budzet          = min(vremeDoPocetka, response_deadline - now)

window = clamp(budzet / max(preostaloTalasa, 1),
               config.minWindowMinutes,
               config.maxWindowMinutes)
```

Posao za 30 minuta sa 3 preostala talasa dobija prozore od ~10 min, ne 15. To je P3.

### 3.5 Radijus

```
if qualified >= batch × config.poolHeadroom     (predlog 2.0)
    radius = trenutni                            ← ima koga, ne širi
else
    radius = trenutni × config.radiusGrowth      (predlog 1.8)
    radius = min(radius, config.maxRadiusKm[gustinaProfil])
```

Širenje je **posledica nedostatka kandidata**, ne fiksni raspored. To je P4.

### 3.6 Značenje radijusa po režimu izvršenja

| `execution_location_mode` | šta radijus meri |
|---|---|
| `STATIONARY` | oko jedne tačke zadatka |
| `POINT_TO_POINT` | oko **polazišta** — radnik mora da stigne tamo; dužina rute je zasebna komponenta skora, ne radijus |
| `MULTI_STOP` | oko **prve stanice**; ukupna dužina rute teži u skoru |
| `AREA_BASED` | oko centroida područja, **uvećan za poluprečnik samog područja** |
| `REMOTE` | radijus je **isključen**; dispatch ide samo po capability-ju |

---

## 4. State machine

```
        ┌───────────┐
        │ PUBLISHED │
        └─────┬─────┘
              │ tick
              ▼
     ┌────────────────┐   stop=SLOTS_FILLED
     │  WAVE_PENDING  ├──────────────────────────┐
     └────────┬───────┘                          │
              │ policy() → batch>0               │
              ▼                                  │
     ┌────────────────┐                          │
     │   WAVE_SENT    │  deliveries + events     │
     └────────┬───────┘                          │
              │ window istekao                   │
              ▼                                  ▼
     ┌────────────────┐              ┌───────────────────┐
     │ EVALUATE_STOP  ├─────────────►│      STOPPED      │
     └────────┬───────┘  stop=true   │ SLOTS_FILLED      │
              │ stop=false           │ COVERAGE_AND_CHOICE│
              │                      │ WAVES_EXHAUSTED    │
              └──────► WAVE_PENDING  │ NO_ELIGIBLE        │
                                     │ NEED_NOT_OPEN      │
                                     │ DEADLINE_PASSED    │
                                     └───────────────────┘
```

Pseudokod politike:

```
function policy(need, waveNo, obs, cfg):
    if need.status not in (PUBLISHED, SELECTION):  return STOP(NEED_NOT_OPEN)
    if obs.remaining == 0:                         return STOP(SLOTS_FILLED)
    if now >= need.response_deadline:              return STOP(DEADLINE_PASSED)
    if waveNo > cfg.maxWaves:                      return STOP(WAVES_EXHAUSTED)

    if coverageSatisfied(obs) and choiceSatisfied(obs, need, cfg):
        return STOP(COVERAGE_AND_CHOICE)

    density  = distanceOf(obs.knn, k) / k
    profile  = densityProfile(density)
    floor    = obs.topScore * cfg[mode].qualityRatio
    qualified= count(obs.candidates where score >= floor)

    if qualified == 0:
        return EXPAND_RADIUS_OR_STOP(NO_ELIGIBLE)

    batch  = computeBatch(obs, cfg, qualified)
    window = computeWindow(need, waveNo, cfg)
    radius = computeRadius(qualified, batch, profile, cfg)

    return SEND(batch, window, radius)
```

---

## 5. NORMAL politika

Optimizuje **relevantnost + dovoljnu pokrivenost + anti-spam**.

| parametar | predlog | zašto |
|---|---|---|
| `qualityRatio` | 0.72 | odseca osrednje; ako su 3 odlična, ide 3 |
| `minBatch` | 3 | ispod toga nema smisla slati talas |
| `maxBatch` | 20 | donorov najveći talas ostaje plafon |
| `minWindowMinutes` | 8 | ispod toga je spam |
| `maxWindowMinutes` | 20 | |
| `maxWaves` | 4 | isto kao donor `[5,5,10,20]` |
| `poolHeadroom` | 2.0 | širi tek kad nema dvostruko više od potrebnog |
| `radiusGrowth` | 1.8 | |
| `minChoice` | 3 | **donorov `targetResponses` ostaje default** |
| `priorResponseRate` | 0.25 | dok nema podataka |

## 6. HITNO politika

**Isti motor. Samo politika je drugačija.** Nema paralelnog marketplace-a.

| parametar | NORMAL | HITNO | zašto |
|---|---|---|---|
| `qualityRatio` | 0.72 | **0.55** | brzina pretežnija od savršenog spoja |
| `minBatch` | 3 | **8** | veći početni zamah |
| `maxBatch` | 20 | **25** | |
| `minWindowMinutes` | 8 | **2** | |
| `maxWindowMinutes` | 20 | **5** | |
| `maxWaves` | 4 | **3** | isto kao donor `[10,10,20]` |
| `radiusGrowth` | 1.8 | **2.4** | brže širenje |
| `minChoice` | 3 | **2** | konfigurabilno, vidi §7 |
| ETA težina u skoru | normalna | **povećana** | vreme dolaska presuđuje |
| push prioritet | normalan | **visok** | vidi §11 |

**Hard requirements su identični.** Hitnost ne pretvara neodgovarajućeg
kandidata u odgovarajućeg — nijedan `MISSING_REQUIRED_*` se ne relaksira.

Fail-closed aktivacija ostaje, sa svih 13 reason codes.
`maxMinutesToStart = 360` ostaje default, konfigurabilan.

---

## 7. Stop politika — odgovor na tvoju primedbu

Rekao si: za 1 mesto i 1 prijavu, `coverage >= remaining` je zadovoljen, ali
Naručilac nema izbor. Slažem se. Predlog:

```
coverageSatisfied = activeCoverage >= remaining
choiceSatisfied   = activeResponses >= minChoice(mode)

stop = coverageSatisfied AND choiceSatisfied
```

Ali sa **vremenskim ventilom**, jer pred sam početak jedan kandidat vredi više
od nijednog:

```
if timeToStart <= cfg.choiceReliefMinutes:        (predlog: NORMAL 45, HITNO 15)
    choiceSatisfied = activeResponses >= 1
```

I sa **ventilom praznog bazena**, jer se ne može čekati izbor koji ne postoji:

```
if qualified == 0 and waveNo >= 2:
    choiceSatisfied = activeResponses >= 1
```

Tri uslova zajedno balansiraju pokrivenost, izbor, hitnost, vreme i bazen.
`minChoice` ostaje **konfigurabilan po režimu**; donorova 3 ostaju NORMAL default
dok podaci ne pokažu bolje.

---

## 8. Multi-seat ponašanje

Donorova coverage-aware logika ostaje netaknuta i pojačana:

```
coverageGap = remaining - activeCoverage
```

- Potreba 1 mesto, prijava pokriva 1 → gap 0 → čeka se samo `minChoice`
- Potreba 2 mesta, prijava pokriva 2 → gap 0 → jedna prijava zaustavlja pokrivenost
- Potreba 5 mesta, 3 prijave po 1 → gap 2 → **dispatch se nastavlja**, iako je
  `activeResponses >= 3`
- Potreba 10 mesta → `batch` raste kroz `coverageGap / responseRate`

Motor razlikuje broj odgovora od količine pokrivenosti — to je zadržano.

---

## 9. Notifikacije

Kanonski tok, bez razbacane push logike u dispatch-u:

```
domenski događaj
   → user_activity_events        (durable, dedupe_key sa revizijom)
   → notification_deliveries     (po kanalu: IN_APP, PUSH)
   → provera preference          (kategorija + uloga + tihi sati)
   → notification_push_attempts  (retry, backoff)
   → provider (Expo)
   → rezultat / potvrda prijema  (cron */5)
```

Dispatch **samo emituje događaj**. Ne zna za push.

NORMAL i HITNO koriste **isti motor**; razlikuju se samo `priority` poljem na
dostavi.

### Tihi sati i HITNO

HITNO **ne zaobilazi** preference. Predlog:

```
notification_preferences dobija:
  quiet_hours_start, quiet_hours_end,
  urgent_overrides_quiet_hours boolean NOT NULL DEFAULT false
```

Podrazumevano **false**. Korisnik mora izričito da uključi
„Obaveštavaj me o HITNO prilikama i tokom tihog režima". Bez toga HITNO čeka
kraj tihih sati ili ide samo kao IN_APP.

---

## 10. Autoritativna urgency projekcija

Jedna funkcija, jedan izvor za sve potrošače:

```
fn_need_urgency(need_id) → {
  level:        'NORMAL' | 'HITNO',
  activatedAt:  timestamptz | null,
  expiresAt:    timestamptz | null,
  policyVersion:text | null,
  reasonCodes:  text[]        -- samo za vlasnika/dijagnostiku
}
```

Čitaju je: Requester preview, Worker CARD, Need Detail, Opportunity Detail,
Lista, Mapa, Kombinovano, pin, push, i Dogovor gde je istorijski relevantno.

**Nijedan potrošač ne računa hitnost sam.** `reasonCodes` se ne prikazuju
Uskočeru — samo Naručiocu i u dijagnostici.

---

## 11. UI projekcija

Ista premium kartica. Bez drugog tipa. Bez crvenog alarma.

### CARD

```
┌────────────────────────────────────────┐
│ ● HITNO · ističe za 42 min             │  ← narandžasta traka, 100% širine
├────────────────────────────────────────┤   pozadina #FFF0E2, tekst #C23C00
│ ● PRILIKA              Tražim ponude   │
│ Prenos ormara sa Limana na Detelinaru  │
│ ↗ Liman → Detelinara  ⏱ Danas · 17h    │
│ 🚐 Kombi   ⬛ 4. sprat                  │
├────────────────────────────────────────┤
│ MŠ Miloš ★4,9              Detalji ›   │
└────────────────────────────────────────┘
```

Kartica dobija **traku iznad kickera** i narandžasti okvir 1.5px. Ništa drugo
se ne menja — isti raspored, isti podaci, ista visina sadržaja.

### Detail

Ista traka pri vrhu, plus jedan red: *„Hitne Potrebe imaju kraći rok za prijavu."*
Odbrojavanje se prikazuje **u minutima do isteka**, iz `expiresAt`, ne računa se lokalno.

### Pin na mapi

| stanje | normalan | HITNO |
|---|---|---|
| običan | narandžasta kap, znak unutra | **isti + prsten 2px `#C23C00`** |
| izabran | uvećan 1.15× | isti + prsten, **bez pulsiranja** |

Bez animacije koja skreće pažnju — mapa sa deset hitnih pinova koji pulsiraju je neupotrebljiva.

### Lista / Mapa / Kombinovano

Isti dataset. HITNO se **ne izdvaja u zasebnu sekciju** — samo se sortira više
unutar iste liste, jer `expiresAt` prirodno diže prioritet.

### Push

```
NORMAL:  "Nova prilika koja može da Vam odgovara"
         Prenos ormara sa Limana na Detelinaru

HITNO:   "HITNO · prilika u Vašoj blizini"
         Prenos ormara · počinje za 40 min
```

Bez velikih slova u telu, bez uzvičnika, bez emodžija.

---

## 12. Šema konfiguracije

Sve u `private.r24_marketplace_config`, **bez migracije pri promeni**:

```json
{
  "key": "dispatch_policy_v2",
  "value": {
    "engine": "ADAPTIVE_BOUNDED_V1",
    "fallbackToFixedWaves": true,

    "normal": {
      "qualityRatio": 0.72, "minBatch": 3, "maxBatch": 20,
      "minWindowMinutes": 8, "maxWindowMinutes": 20, "maxWaves": 4,
      "poolHeadroom": 2.0, "radiusGrowth": 1.8,
      "minChoice": 3, "choiceReliefMinutes": 45,
      "priorResponseRate": 0.25
    },
    "urgent": {
      "qualityRatio": 0.55, "minBatch": 8, "maxBatch": 25,
      "minWindowMinutes": 2, "maxWindowMinutes": 5, "maxWaves": 3,
      "poolHeadroom": 1.5, "radiusGrowth": 2.4,
      "minChoice": 2, "choiceReliefMinutes": 15,
      "priorResponseRate": 0.35
    },

    "densityProfiles": {
      "veryDense": { "maxKmPerCandidate": 0.15, "startRadiusKm": 3,  "maxRadiusKm": 15 },
      "dense":     { "maxKmPerCandidate": 0.5,  "startRadiusKm": 5,  "maxRadiusKm": 25 },
      "sparse":    { "maxKmPerCandidate": 2.0,  "startRadiusKm": 12, "maxRadiusKm": 60 },
      "verySparse":{ "maxKmPerCandidate": null, "startRadiusKm": 25, "maxRadiusKm": 120 }
    },

    "candidateLimit": 40,
    "routeEstimateTtlMinutes": 120
  }
}
```

`fallbackToFixedWaves: true` znači: ako adaptivna politika baci grešku ili
konfiguracija ne prođe validaciju, **motor se vraća na donorove fiksne talase**.
Dokazani put je uvek dostupan.

---

## 13. Simulacije

Pretpostavke: `responseRate` 0.25 NORMAL / 0.35 HITNO, `candidateLimit` 40.
`Q` = broj kandidata iznad kvalitetnog praga.

| # | scenario | gustina | talasi (batch/window) | ishod |
|---|---|---|---|---|
| 1 | 1 osoba, NORMAL, gusto | 0.1 | Q=28 → **12/20min** | 3 prijave u T1 → STOP `COVERAGE_AND_CHOICE` |
| 2 | 1 osoba, NORMAL, retko | 1.4 | Q=4 → **4/20** · r×1.8 → **7/20** | STOP posle T2, 2 prijave, ventil praznog bazena |
| 3 | 1 osoba, HITNO, gusto | 0.1 | Q=33 → **9/2min** | 3 prijave u T1 → STOP |
| 4 | 1 osoba, HITNO, retko | 1.4 | Q=6 → **8/2** · r×2.4 → **14/3** | T2 daje 1 → `choiceRelief` (15min) → STOP |
| 5 | 2 osobe, NORMAL | 0.3 | Q=22 → **12/15** | 1 prijava pokriva 2 → coverage OK, ali choice 1<3 → T2 **6/15** → STOP |
| 6 | 2 osobe, HITNO | 0.3 | Q=25 → **10/3** | 2 prijave, coverage 2 ≥ 2, choice 2 ≥ 2 → **STOP posle T1** |
| 7 | 5 osoba, NORMAL | 0.3 | gap 5 → **20/15** (maxBatch) | 4 prijave, coverage 4 → gap 1 → T2 **8/15** → STOP |
| 8 | 5 osoba, HITNO | 0.3 | **25/3** (maxBatch) | coverage 5 posle T1 i T2 |
| 9 | 10 osoba, NORMAL | 0.2 | **20/15** × 4 talasa | `candidateLimit` 40 iscrpljen → `WAVES_EXHAUSTED`, coverage 7/10 → **traži ručno proširenje** |
| 10 | 10 osoba, HITNO | 0.2 | **25/2** × 3 | isto ograničenje — vidi §16, otvoreno pitanje |
| 11 | POINT_TO_POINT | 0.4 | radijus oko **polazišta** | ruta 18 km ulazi u skor, ne u radijus |
| 12 | MULTI_STOP | 0.4 | radijus oko **prve stanice** | ukupna ruta 40 km snižava skor svima podjednako |
| 13 | REMOTE + HITNO | — | — | `URGENT_PHYSICAL_TASK_REQUIRED` → **fail-closed**, ostaje NORMAL |
| 14 | mnogo kandidata, niko ne reaguje | 0.1 | T1 **12**, rate→0 → T2 **20**, T3 **20** | `WAVES_EXHAUSTED`; fiksni model bi poslao 5→5→10→20 = sporije |
| 15 | malo kandidata, svi odlični | 1.0 | Q=3 → **3/20** | **3 obaveštenja umesto 5** — anti-spam radi |
| 16 | prvi talas dovoljan coverage | 0.2 | T1 **12** | STOP odmah, T2 se ne šalje |
| 17 | 3 prijave, coverage nedovoljan | 0.3 | Potreba 5, 3×1 = 3 | `choice` OK ali `coverage` 3<5 → **nastavlja** |
| 18 | NORMAL → HITNO usred toka | 0.3 | 2 NORMAL talasa potrošena | urgency merdevine **kreću od 1** → **8/2** |
| 19 | materijalna izmena Potrebe | 0.3 | revizija 1→2 | `dedupe_key` se menja → **legitimna nova dostava**, ne spam |

**Scenario 15 je ključan dokaz** da adaptivni model rešava P2: fiksni bi poslao
5 (od kojih 2 osrednja), adaptivni šalje 3 odlična.

**Scenario 14 dokazuje P5**: adaptivni širi brže kad nema reakcije.

**Scenario 9 i 10 otkrivaju granicu** — vidi §16.

---

## 14. Simulacija na 100.000 naloga

**Ključna tvrdnja: nijedan korak ne skenira ceo skup.**

Po jednoj Potrebi, jedan talas:

| korak | dodiruje | zašto ograničeno |
|---|---|---|
| KNN PostGIS | **~40–120 tuple-ova** | GiST indeks, `ORDER BY geom <-> point LIMIT n` |
| jeftini filter | **≤ 40 redova** | index join na `app_profiles`, `worker_match_preferences` |
| deep match | **~15–30** | samo oni koji prođu jeftini filter |
| routing/ETA | **~5–15 poziva** | keš sa `routeEstimateTtlMinutes` 120; ponovljeni parovi se ne računaju |
| `opportunity_deliveries` insert | **batch (3–25)** | |
| `user_activity_events` insert | = batch | |
| `notification_deliveries` insert | ≤ batch | preference već filtrirane u §1 |
| push pozivi | ≤ batch | |

**Od 100.000 profila, deep match vidi ~20.** To je 0.02%.

### Trošak po Potrebi (ceo životni ciklus, 4 talasa)

```
index čitanja      ~400
deep match         ~80
routing pozivi     ~30 (sa kešom ~10)
DB upisi           ~120
push               ~50
```

### Istovremenost

| aktivnih Potreba | KNN/min | deep/min | upisi/min | procena |
|---|---|---|---|---|
| 100 | 12k | 2k | 3k | trivijalno |
| 1.000 | 120k | 20k | 30k | Postgres u redu |
| 5.000 | 600k | 100k | 150k | **tick postaje usko grlo** |

### Usko grlo — najvažniji nalaz

```sql
pg_try_advisory_xact_lock(hashtext('USKOCI_R24_MARKETPLACE_TICK'))
```

**Brava je globalna.** Jedan tick za celo tržište. Pri 5.000 aktivnih Potreba i
cron-u od 1 minuta, tick mora da obradi sve za <60 s. Neće.

**Predlog N-4 (novo):** šardovanje brave

```sql
pg_try_advisory_xact_lock(hashtext('USKOCI_TICK_' || (hashtext(need_id::text) % 16)))
```

16 šardova → 16 paralelnih tickova → plafon se pomera sa ~1.000 na ~16.000
aktivnih Potreba. Uz to, tick uzima **ograničen odsečak** po ciklusu
(`select ... limit 200 for update skip locked`), pa nikad ne radi neograničeno.

### Ostala uska grla, po redu pojavljivanja

| sloj | granica | ublažavanje |
|---|---|---|
| **pg_cron** | 1 min najfinija granulacija | HITNO prozor od 2 min je na ivici; predlog: poseban cron `*/1` samo za urgent red |
| **routing provider** | rate limit + novac | keš 120 min; geodetska rezerva; ETA se ne traži za kandidate ispod kvalitetnog praga |
| **push provider** | batch limiti | slanje u paketima, `push_attempts` sa backoff-om |
| **PostGIS** | GiST radi dobro do ~milion tačaka | u redu |
| **Edge Functions** | hladan start | tick ostaje u bazi, Edge samo za push i AI |
| **Realtime** | — | **ne koristi se** — vezan samo za mrtve `alpha_*` |

### Šta keširati

- rutu/ETA po paru (radnik, polazište) — TTL 120 min ✅ već postoji
- gustinu po gradu/oblasti — TTL 24 h ⟵ novo, jeftino
- `qualified` skup unutar iste revizije — samo za trajanje ticka

### Šta nikad ne računati ponovo

- deep match za istog radnika i istu reviziju — već sprečeno preko
  `unique(worker_account_id, need_id, need_revision)`

---

## 15. Otkazi i sigurnost

| otkaz | ponašanje |
|---|---|
| PostGIS nedostupan | **fail-closed**: dispatch staje sa `GEO_UNAVAILABLE`. Ne šalje se nasumično. |
| routing nedostupan | **fail-soft**: geodetska udaljenost, `reasonCode` `GEODESIC_DISTANCE_FALLBACK`, ETA `null`, skor bez ETA komponente |
| ETA se ne može dobiti | isto; kandidat ostaje eligible ako prolazi hard uslove |
| push provider pao | događaj **ostaje durable**; `push_attempts` sa backoff-om; IN_APP nije pogođen |
| cron preskočio ciklus | tick je idempotentan; sledeći nadoknađuje po `deadline_at` |
| dva ticka istovremeno | advisory lock (šardovan) → drugi vraća `SKIPPED_LOCKED` |
| ponovljen delivery insert | `unique(worker, need, revision)` + `on conflict do nothing` |
| Potreba zatvorena usred talasa | `for update` na `needs` na početku; sledeći talas vraća `NEED_NOT_OPEN` |
| mesta popunjena usred talasa | isto; petlja proverava `remaining` pre svakog insert-a |
| revizija promenjena usred obrade | talas je vezan za `need_revision`; nova revizija pravi nove runde |
| HITNO isteklo tokom dispatch-a | `fn_need_urgency` vraća `NORMAL`; sledeći talas koristi NORMAL politiku; već poslate dostave ostaju |

**Nikad se ne sme desiti:** dupli push, dupla dostava, slanje zatvorene Potrebe,
curenje tačne lokacije (nikad nije u `opportunity_deliveries`), full-table scan.

---

## 16. DONOR KEEP / MODIFY / NEW

| # | stavka | odluka | obrazloženje |
|---|---|---|---|
| 1 | KNN + jeftini filter + deep match | **KEEP** | zreo, ograničen, dokazan |
| 2 | `candidateLimit` | KEEP | tvrda zaštita |
| 3 | svi hard eligibility uslovi | **KEEP, nikad se ne relaksiraju** | |
| 4 | `score desc, pid` | KEEP | determinizam |
| 5 | `reasonCodes` / `scoreComponents` | KEEP | objašnjenje bez procenta |
| 6 | coverage-aware zaustavljanje | KEEP | jedino ispravno za multi-seat |
| 7 | `dedupe_key` sa revizijom | KEEP | anti-spam koji dozvoljava legitimno ponavljanje |
| 8 | preference u jeftinom filteru | KEEP | anti-spam pre troška |
| 9 | fiksni talasi | **KEEP kao fallback** | `fallbackToFixedWaves: true` |
| 10 | veličina talasa | **MODIFY** | adaptivna, ograničena min/max |
| 11 | prozor | **MODIFY** | izveden iz vremena do početka |
| 12 | radijus | **MODIFY** | izveden iz gustine, ne fiksne merdevine |
| 13 | stop uslov | **MODIFY** | + `choiceSatisfied` + dva ventila |
| 14 | `targetResponses` | **MODIFY** | postaje `minChoice`, po režimu |
| 15 | urgency projekcija | **NEW** | `fn_need_urgency`, jedan izvor |
| 16 | `waveRadiusKm` / density profili | **NEW** | konfiguracija, bez migracije |
| 17 | šardovana advisory brava | **NEW** | plafon 1.000 → 16.000 |
| 18 | `urgent_overrides_quiet_hours` | **NEW** | podrazumevano `false` |
| 19 | HITNO UI signal | **NEW** | traka + prsten na pinu |
| 20 | keš gustine po oblasti | **NEW** | TTL 24 h |

---

## 17. Posledice po migracije

Redosled se menja u odnosu na audit — **notifikacije pre dispatch-a**.

| # | migracija | dodaje |
|---|---|---|
| 15 | `clean_events_and_notifications` | + `quiet_hours_*`, `urgent_overrides_quiet_hours`, `priority` |
| 15b | `clean_needs_schema_completion` | `urgent` + 3 `urgent_*`, `execution_location_mode`, `minimum_experience_years`, 3 `schedule_kind` vrednosti |
| 16 | `clean_geo_foundation` | **PostGIS**, geom kolone, GiST indeksi |
| 17 | `clean_opportunity_dispatch` | `dispatch_rounds`, `opportunity_deliveries`, config, politika |
| 17b | `clean_urgency_projection` | `fn_need_urgency` |
| 18 | `clean_scheduled_lifecycle` | **pg_cron**, šardovan tick |

---

## 18. Test plan

| nivo | šta | dokaz |
|---|---|---|
| jedinični | `policy()` kao čista funkcija — svih 19 scenarija iz §13 | determinističke tabele ulaz→izlaz |
| invarijante | hard uslov se nikad ne relaksira ni na kom radijusu | property test nad nasumičnim konfiguracijama |
| invarijante | `deliveries ≤ candidateLimit` po reviziji | |
| invarijante | nema dostave za `status ∉ (PUBLISHED, SELECTION)` | |
| konkurentnost | dva ticka nad istom Potrebom → jedan `SKIPPED_LOCKED` | |
| konkurentnost | 16 šardova paralelno, bez duplih dostava | |
| otkazi | PostGIS oboren → `GEO_UNAVAILABLE`, nula dostava | |
| otkazi | routing oboren → geodetska rezerva, dostave se nastavljaju | |
| end-to-end | dva stvarna naloga, HITNO Potreba, push do uređaja | **runtime dokaz** |

---

## 19. Otvorene odluke — samo gde stvarno nema dokaza

| # | pitanje | zašto ne mogu sam |
|---|---|---|
| **O-1** | **Scenario 9/10**: Potreba od 10 mesta iscrpi `candidateLimit` 40 pre pokrivenosti. Podići limit za velike Potrebe, ili uvesti peti talas sa `limit` 80? | trošak vs pokrivenost je poslovna odluka |
| **O-2** | Koje kategorije smeju HITNO (`allowedCategories`)? | rizik i zloupotreba su tvoja procena |
| **O-3** | `minChoice` za HITNO — 2 ili 1? | 1 je brže, 2 daje izbor |
| **O-4** | Da li HITNO sme da traži novac (buduće), ili ostaje besplatno u V1? | monetizacija |
| **O-5** | Početne vrednosti `qualityRatio` 0.72 / 0.55 su **procena bez podataka** | treba nedelja stvarnog saobraćaja |

---

## 20. Preporuka

### **B) Donor + ograničena adaptacija**

Ne A, ne C.

**Zašto ne A (zadržati fiksne talase):** scenario 15 pokazuje da fiksni model
šalje 5 obaveštenja kad su 3 kandidata odlična — to je merljiv spam. Scenario 14
pokazuje da sporo reaguje na nereagovanje. Scenario 3 pokazuje da HITNO troši
prozore koje nema. Tri konkretna gubitka, ne stilska primedba.

**Zašto ne C (pun adaptive):** početne vrednosti `qualityRatio`, `responseRate`
i pragova gustine su **procene bez ijednog stvarnog podatka**. Pun adaptivni
motor koji uči iz izmišljenih pretpostavki je gori od dokazanog fiksnog.

**B konkretno znači:**

1. Zadržati ceo donorov cevovod netaknut.
2. Dodati politiku kao **čistu funkciju** iznad njega — batch, window, radius.
3. `fallbackToFixedWaves: true` — na svaku grešku ili nevažeću konfiguraciju,
   motor se vraća na dokazane `[5,5,10,20]`.
4. Sve granice konfigurabilne, bez migracije.
5. Meriti nedelju dana, pa tek onda razmatrati C.

Adaptacija koja se u svakom trenutku može isključiti jednim JSON poljem nije
rizik — to je merenje sa sigurnosnom mrežom.

**Najhitnija stavka nije adaptivnost nego šardovanje brave (N-4).** Globalna
advisory brava je plafon na ~1.000 aktivnih Potreba, i to je istina i za fiksni
i za adaptivni model.
