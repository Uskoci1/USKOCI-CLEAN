# USKOČI — Runtime dokazi za migracije 15–18

**Datum:** 29.08.2026 · **Baza:** clean DEV/ALPHA `leqcwgzvjsxugfgzdmth`
**Production nije dirana. Nema GitHub push-a.**

Fixture: 61 test naloga (`@uskoci.test`), 60 radnika oko Novog Sada, 45 sa
traženom veštinom. **Obrisan posle merenja** — baza je vraćena na 0 redova u
svim tabelama osim 3 reda konfiguracije.

---

## Šta je traženo i šta je izmereno

| # | zahtev vlasnika | rezultat | oznaka |
|---|---|---|---|
| 1 | bez full-table scan-a | KNN `Index Scan` sa `Order By`, 41/60 reda | **izmereno na 60 redova** |
| 2 | bez duplog delivery/push-a | 363 isporuke, **0** duplih na sva tri nivoa | **PROVEN** |
| 3 | tvrda kvalifikacija se ne relaksira | 2 Potrebe → **0** isporuka | **PROVEN** |
| 4 | multi-seat coverage | 10 mesta → budžet **96** | **PROVEN** |
| 5 | NORMAL→HITNO po novoj politici | runda 2 kreće od batch **10** | **PROVEN** |
| 6 | fallback na fiksne talase | nevažeća konfiguracija → **FIXED 40** | **PROVEN** |
| 7 | bounded tick ne preskače ni ne duplira | 60/60 obrađeno, **0** duplih rundi | **delimično** |

---

## 1. Bez full-table scan-a

```
Limit (actual time=16.681..16.724 rows=40)
  -> Incremental Sort
       -> Index Scan using worker_match_preferences_geog_idx  (rows=41)
            Index Cond: approximate_geog && _st_expand(...)
            Order By:  approximate_geog <-> task_geog
```

Pravi KNN index scan sa `Order By`, ne sort posle skeniranja. Streaming staje
na 41. reda od 60.

**Ograničenje koje moram da navedem:** 60 redova je premalo da planer uopšte
poželi seq scan. Ovo dokazuje da je indeks *upotrebljen i uređen*, **ne** da
ponašanje ostaje isto na 100.000 profila. Za to je potreban load test.

## 2. Bez duplog delivery-ja i push-a

Posle 4 talasa na jednoj Potrebi i 70 rundi ukupno:

| mera | vrednost |
|---|---|
| isporuka | 363 |
| različitih radnika | 363 |
| **duplih `(radnik, Potreba, revizija)`** | **0** |
| **duplih `dedupe_key` događaja** | **0** |
| **duplih `(event, channel)` notifikacija** | **0** |

Tri nezavisne odbrane: jeftini filter isključuje već isporučeno, `unique`
ograničenje na isporuci, `dedupe_key unique` na događaju.

Notifikacije: 363 `IN_APP` = `CREATED`, 363 `PUSH` = `SUPPRESSED` sa razlogom
`PUSH_OFF`. **Zašto neko nije dobio push je zapisano, ne prećutano.**

## 3. Tvrda kvalifikacija se nikad ne relaksira

| Potreba | uslov | isporuka | stop_reason |
|---|---|---|---|
| A dozvola | `required_licenses = {viljuskar-C1}` koju niko nema | **0** | `NO_ELIGIBLE_CANDIDATES` |
| B identitet | `verified_identity_required = true` | **0** | `NO_ELIGIBLE_CANDIDATES` |

B je fail-closed po dizajnu: `private.identity_admitted()` vraća `false` jer
sistem verifikacije identiteta **ne postoji** u clean setu. Bolje nula
kandidata nego tiho otvorena kapija. Vidi *Otvoreni nedostaci*.

## 4. O-1 budžet — formula je u motoru, ne samo u dokumentu

| stanje | budžet | `budget_source` | doc predviđa |
|---|---|---|---|
| 1 mesto | 40 | `ADAPTIVE_FLOOR` | 40 ✓ |
| 10 mesta, 0 pokriveno | **96** | `ADAPTIVE_COMPUTED` | 96 ✓ |
| 10 mesta, 3 pokrivena | 72 | `ADAPTIVE_COMPUTED` | — |
| 10 mesta, 6 pokrivenih | 48 | `ADAPTIVE_COMPUTED` | — |
| 20 mesta | 120 | `ADAPTIVE_CAPPED` | 120 ✓ |

Budžet se **smanjuje** kako se mesta popunjavaju. Obična Potreba od 1 mesta
dobija donorovih 40 — za 95% slučajeva ništa se nije promenilo.

`routingCallsUsed` je uvek **0**: routing provajder nije povezan.
`maxRoutingCallsPerWave` je rezervisan, **nije dokazan**.

## 5. NORMAL → HITNO

| runda | hitnost | batch | status | stop_reason |
|---|---|---|---|---|
| 1 | NORMAL | 5 | STOPPED | `URGENT_ACTIVATED` |
| 2 | URGENT | **10** | SENT | — |

10 je `dispatch_urgent.waveSizes[0]` — hitna lestvica kreće **od prvog**
stepenika, ne nastavlja normalnu (koja bi dala 5).

Odbijanja koja su takođe izmerena:
- aktivacija sa ugašenom politikom → `55000 URGENT_ACTIVATION_NOT_ALLOWED`
  (`URGENT_POLICY_DISABLED`, `URGENT_CATEGORIES_NOT_ADMITTED`)
- direktan `update needs set urgent=true` → `22023 URGENT_ACTIVATION_RPC_REQUIRED`

Politika je za vreme dokaza uključena i **odmah vraćena na `enabled:false`,
`allowedCategories:[]`**. Provereno upitom posle.

Već aktivirana Potreba ostaje HITNO do isteka prozora — gašenje politike
sprečava nove aktivacije, ne poništava postojeće. To je namerno.

Push je nosio `urgency='HITNO'` na 10 događaja i `priority='HIGH'` na 20
isporuka notifikacija.

## 6. Fallback na fiksne talase

Konfiguracija sa `baseLimit:0, hardMaxLimit:5, responseRate:9` (nevažeća):
→ **`limit:40, source:FIXED`**. Nevažeća konfiguracija nikad ne otvara budžet.

## 7. Ograničeni tick pod kontencijom

65 Potreba u redu, batch 25, tri uzastopna tick-a **plus pg_cron koji je u
istom periodu odradio 5 uspešnih pokretanja iz zasebne sesije**.

| mera | vrednost |
|---|---|
| Potreba obrađeno | **60/60** — nijedna preskočena |
| duplih rundi `(need, revizija, round_no)` | **0** |
| duplih isporuka | **0** |
| grešaka | **0** |
| zaglavljenih `locked_until` | **0** |

**Zašto je ovo označeno „delimično": ** pg_cron jeste zasebna sesija, pa je
konkurentnost stvarna, ali kontencija je bila niska — nije dokazano da dve
sesije koje istovremeno pogađaju **isti** red daju isti rezultat pod
opterećenjem. Za `PROVEN` je potreban load test sa N paralelnih konekcija.

---

## Otvoreni nedostaci — prijavljeni, ne zaobiđeni

| oznaka | šta nedostaje | posledica sada |
|---|---|---|
| **G-IDENT** | nema sistema verifikacije identiteta | Potreba sa `verified_identity_required` dobija **0** kandidata |
| **G-KAT** | nema kanonskog registra kategorija | HITNO ostaje ugašeno, allowlist prazan (O-2) |
| **G-DEEP** | nema r31 deep capability matcher-a | nema `deepCapability` bonusa u skoru |
| **G-KAL** | nema `worker_calendar_events` | nema tvrdog kalendarskog konflikta |
| **G-ROUTE** | nema routing provajdera | sve razdaljine su geodetske |
| **G-OVR** | nema `profile_resource_availability_overrides` | radijus je samo `clamp(1,300)` |

Nijedan od ovih nije aproksimiran. Gde ulaza nema, kapija je zatvorena ili je
komponenta izostavljena — nikad procenjena.

## Bezbednosni nalazi

Dva stvarna nalaza nađena i zatvorena migracijom `clean_advisor_hardening`:

1. `private.set_updated_at`, `category_of_event`, `in_quiet_hours` nisu imale
   fiksiran `search_path` (propust iz migracije 15).
2. `fn_need_urgency` je bio `SECURITY DEFINER` i zaobilazio RLS na `needs` —
   svaki prijavljen korisnik je mogao da ispituje proizvoljan UUID. Prebačen
   na `SECURITY INVOKER`.

Preostalo, **namerno**:
- `dispatch_rounds`, `private.marketplace_config`, `private.dispatch_schedule`
  imaju RLS bez politika = deny-all. To je motorna evidencija, ne projekcija.
- 13 `rpc_*` funkcija su `SECURITY DEFINER` dostupne prijavljenom korisniku.
  To je autoritativni obrazac: svaka sama proverava `auth.uid()`.

## Status

| sloj | oznaka |
|---|---|
| šema, RLS, RPC, motor dispatcha | **IMPLEMENTED** |
| invarijante 2–6 | **PROVEN** na fixture-u od 60 radnika |
| ponašanje indeksa na 100k | **nije PROVEN** — nema load testa |
| konkurentnost pod opterećenjem | **nije PROVEN** — nema paralelnog testa |
| klijent → Supabase | **EXTERNAL CONFIG REQUIRED** |
| push isporuka do uređaja | **nije PROVEN** — nema registrovanih uređaja |
