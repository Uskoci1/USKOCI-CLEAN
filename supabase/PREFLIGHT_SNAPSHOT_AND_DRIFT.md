# USKOČI — Pre-flight snapshot + nalaz drifta

**Datum:** 30.08.2026 · **Baza:** clean DEV/ALPHA `leqcwgzvjsxugfgzdmth`
**Status:** sekcija 0 direktive završena. Nastavak gejtovan nalazom drifta.

---

## 1. Inventar žive baze

| | |
|---|---|
| migracija u istoriji | 30 |
| tabela u `public` | 25 |
| tabela u `private` | 2 (`marketplace_config`, `dispatch_schedule`) |
| `rpc_*` funkcija | 13 |
| `fn_*` funkcija | 3 |
| `private` funkcija | 22 |
| RLS politika | 48 |
| **tabela bez RLS** | **0** |
| cron poslova | 1 — `uskoci_marketplace_tick` `* * * * *` |
| storage bucketa | 1 — `profile-media` (zatečen) |
| Edge funkcija | **0** |

## 2. Test fixture je uklonjen

`auth.users` 0 · `app_profiles` 0 · `needs` 0 · `opportunity_deliveries` 0 ·
`user_activity_events` 0 · `storage.objects` 0.
Ostaju samo 3 reda konfiguracije.

## 3. Ranije popravke i dalje važe

| provera | rezultat |
|---|---|
| PostGIS shema | `extensions` (ne `public`) |
| `st_*` funkcija u `public` | **0** |
| precizna geografija na `app_profiles` | **ne postoji** |
| SECURITY DEFINER bez `search_path` | **0** |
| `fn_need_urgency` | `SECURITY INVOKER`, `search_path=pg_catalog` |
| HITNO `enabled` | **false** |
| HITNO `allowedCategories` | **[]** |
| HITNO `minChoice` | 2 |
| `fallbackToFixedWaves` | true na oba dispatch profila |
| `urgent_overrides_quiet_hours` default | **false** |

---

## 4. NALAZ DRIFTA

Živa baza se **poklapa sa sopstvenom migration istorijom** — svih 30 migracija
je zapisano u `supabase_migrations.schema_migrations`. Nema objekta koji ne
potiče iz zabeležene migracije. **Nema semantičkog drifta u bazi.**

Drift je između baze i **lokalnog foldera**:

### 4.1 Osamnaest migracija nije postojalo na disku

`supabase/migrations/` je imao samo `0001`–`0010`. Migracije `0011`–`0028`
postojale su **isključivo u bazi**. `supabase db reset` bi obrisao ceo rad od
migracije 11 nadalje — uključujući ceo marketplace motor.

**Zatvoreno.** Baza čuva doslovan primenjeni SQL; izvezeno je svih 18 i svaki
fajl je proveren md5 sumom protiv baze:

Verifikacija je ponovljiva: `sh supabase/migrations/check_md5.sh`.
Trenutni izlaz:

```
ok=18  neispravnih=10  nedostaje=0
```

`ok=18` su vracene migracije 0011-0028 — sve bajt-tacne.
`neispravnih=10` su fajlovi 0001-0010 iz tacke 4.2, koji su namerno ostavljeni
u manifestu da bi otvorena stavka bila vidljiva dok se ne resi.

### 4.2 Fajlovi 0002–0010 su zastarele verzije — OTVORENO

| fajl | bajt-identičan | semantički identičan (bez komentara) | struktura objekata |
|---|---|---|---|
| 0001 | ne | **da** | ista |
| 0002–0010 | ne | **ne** | ista |

„Struktura objekata" = broj `create table` / `create index` / `create policy` /
`create or replace function` po fajlu. Poklapa se u svih devet.

**Šta je provereno i nije problem:** raniji nalaz da se broj `grant`/`revoke`
razlikuje u `0005` i `0007` je **lažna uzbuna** — regex je hvatao reč „grants"
unutar `access_grants` i imena politika. Nema razlike u dozvolama.

**Šta ostaje nepoznato:** normalizovani heš kaže da se SQL tekst razlikuje, ali
ne i gde. Pošto se struktura poklapa, najverovatnije su u pitanju formulacije i
raspored — ali to **nije dokazano**, pa se ne tvrdi.

**Rizik:** folder `0001`–`0010` ne rekonstruiše dokazano ovu bazu. Živa baza je
autoritet; ti fajlovi su nacrti od pre primene.

**Predlog:** zameniti `0002`–`0010` doslovnim tekstom iz baze, istim
md5-proverenim postupkom kao za `0011`–`0028`. Posle toga folder rekonstruiše
bazu dokazano, a ne pretpostavljeno.

---

## 5. Zašto je nastavak zaustavljen ovde

Direktiva, sekcija 0: *„Ako live clean ALPHA odstupa od migration source-a:
STOP i prijavi drift pre nastavka."* Drift postoji i prijavljen je.

Sekcije 1–16 (G1–G18 matrica, kategorije, notifikacioni lanac, Edge/safety,
AI provenance, Q&A privatnost, Povezivanje, otkazivanje, storage, security pass,
client binding, testovi) nisu započete.

**Bitno:** ništa u ovom nalazu ne blokira sam backend — živa baza je ispravna i
dokazana. Blokada je isključivo oko rekonstruktivnosti izvornog koda.
