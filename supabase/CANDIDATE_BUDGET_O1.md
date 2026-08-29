# O-1 — Bounded Dynamic Candidate Budget

**Status:** predlog pre implementacije · ništa nije izvršeno

Problem iz simulacija 9/10: Potreba od 10 mesta iscrpi fiksni `candidateLimit`
40 pre nego što postigne pokrivenost. Rešenje **nije** globalno podizanje limita
ni slepi peti talas.

---

## 1. Formula

Budžet se izvodi iz **preostale pokrivenosti**, ne iz `required_slots` — kako
mesta budu popunjavana, budžet se sam smanjuje.

```
remaining        = required_slots - activeCoverage
neededResponses  = ceil(remaining / avgCoveragePerResponse)
expectedContacts = neededResponses / responseRate
budget           = clamp(ceil(expectedContacts × safetyFactor),
                         baseLimit,          -- pod
                         hardMaxLimit)       -- plafon
```

| parametar | vrednost | oznaka |
|---|---|---|
| `baseLimit` | 40 | donorov limit ostaje **pod**, ne plafon |
| `hardMaxLimit` | 120 | tvrda granica, konfigurabilna |
| `avgCoveragePerResponse` | 1.3 | `EXPERIMENTAL_DEFAULT` |
| `responseRate` | 0.25 NORMAL / 0.35 HITNO | `EXPERIMENTAL_DEFAULT` |
| `safetyFactor` | 3.0 | `EXPERIMENTAL_DEFAULT` |

**Obična Potreba nikad ne gubi zaštitu:** za 1–2 mesta izračunata vrednost je
ispod 40, pa `clamp` vraća donorovih 40. Ništa se ne menja za 95% slučajeva.

### Routing budžet je ODVOJEN

Ovo je ključno za trošak. Broj poziva ka routing provajderu **ne sme** da raste
sa brojem kandidata:

```
routingBudget = min(candidateBudget, config.maxRoutingCallsPerWave)   -- 20
```

Kandidati preko tog broja dobijaju **geodetsku procenu** i `reasonCode`
`GEODESIC_DISTANCE_FALLBACK`. Rangiranje ostaje ispravno jer su sortirani po
KNN udaljenosti — najbliži, kojima ETA najviše znači, dobijaju pravu rutu.

---

## 2. Simulacije

`responseRate` 0.25 · `avgCoverage` 1.3 · `safety` 3.0

| mesta | remaining | needed | expected | ×3 | **budžet** | vs donor 40 |
|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 4 | 12 | **40** (pod) | isto |
| 2 | 2 | 2 | 8 | 24 | **40** (pod) | isto |
| 5 | 5 | 4 | 16 | 48 | **48** | +20% |
| 10 | 10 | 8 | 32 | 96 | **96** | +140% |
| 20 | 20 | 16 | 64 | 192 | **120** (plafon) | +200% |

### Budžet se smanjuje kako se popunjava

Potreba od 10 mesta kroz životni ciklus:

| trenutak | activeCoverage | remaining | budžet |
|---|---|---|---|
| objava | 0 | 10 | 96 |
| posle T1 | 3 | 7 | 66 |
| posle T2 | 6 | 4 | 40 (pod) |
| posle T3 | 9 | 1 | 40 (pod) |

Trošak prati stvarnu potrebu, ne najgori slučaj.

---

## 3. Worst-case trošak

Najgori scenario: Potreba od 20 mesta, budžet 120, četiri talasa, nula reakcije.

| korak | po talasu | ×4 talasa |
|---|---|---|
| KNN index tuple | ~300 | 1.200 |
| jeftini filter (redova) | ≤120 | 480 |
| deep match | ~45 | 180 |
| **routing pozivi** | **≤20** | **≤80** |
| deliveries insert | ≤25 | ≤100 |
| events + notifications | ≤50 | ≤200 |

Poređenje sa običnom Potrebom (1 mesto): ~400 index čitanja, ~80 deep, ~30
routing kroz ceo ciklus.

**Najgora velika Potreba košta ~3× obične po deep matchu, ali samo ~2.6× po
routingu** — jer je routing ograničen nezavisno. To je i bila poenta.

Pri 1.000 istovremenih Potreba od kojih je 5% veliko:
`950 × 400 + 50 × 1.200 = 440k` index čitanja kroz ciklus. Postgres to nosi.

---

## 4. Otkazi

| slučaj | ponašanje |
|---|---|
| `responseRate` nema podataka | koristi se `EXPERIMENTAL_DEFAULT`; budžet nikad ispod `baseLimit` |
| konfiguracija nevažeća | `fallbackToFixedWaves` → donorov fiksni limit 40 |
| `hardMaxLimit` premašen računom | `clamp` seče; nikad neograničeno |
| `remaining` ≤ 0 | dispatch već stao na `SLOTS_FILLED` |

---

## 5. Šta ovo dodaje u konfiguraciju

```json
"candidateBudget": {
  "baseLimit": 40,
  "hardMaxLimit": 120,
  "maxRoutingCallsPerWave": 20,
  "avgCoveragePerResponse": 1.3,
  "safetyFactor": 3.0,
  "_note": "EXPERIMENTAL_DEFAULT — meriti pre nego što se tretira kao istina"
}
```

Bez migracije pri promeni. `fallbackToFixedWaves` i dalje vraća donorovo
ponašanje u celini.
