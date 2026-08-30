# USKOČI — Dokaz rekonstruktivnosti migracija

**Datum:** 30.08.2026 · **Baza:** clean DEV/ALPHA `leqcwgzvjsxugfgzdmth`
**Cilj:** `supabase/migrations` mora biti verna i deterministička rekonstrukcija
primenjenog clean ALPHA stanja.

Verifikacija je ponovljiva: `sh supabase/migrations/check_md5.sh`

```
---- ok=29 neispravnih=1 nedostaje=0
```

---

## Rezultat

| | |
|---|---|
| migracija u `supabase_migrations.schema_migrations` | 30 |
| `.sql` fajlova na disku | 30 |
| fajlova bez para u istoriji | **0** |
| migracija bez fajla | **0** |
| **bajt-tačnih prema primenjenom SQL-u** | **29 / 30** |
| objašnjenih izuzetaka | 1 (zatečena migracija, vidi dole) |

Svih **28 migracija clean seta** je bajt-tačno jednako doslovnom SQL-u koji je
stvarno izvršen nad bazom. Poređenje je md5 nad sadržajem fajla (bez CR i
završnih praznih redova) protiv `md5(statements[1])` iz migration history.

## Šta se zateklo i moralo da se ispravi

Folder se između dva poteza promenio van moje kontrole: fajlovi su preimenovani
u Supabase konvenciju `<version>_<name>.sql`, a nedostajuće migracije su
povučene iz baze. Vremena izmene to i pokazuju — moji fajlovi zadržali su
23:52–00:04, novopovučeni nose 01:21–01:23.

Taj sync je uneo **oštećenje UTF-8**. Em-crta `—` (`e2 80 94`) zapisana je kao
`ce 93 c3 87 c3 b6`, tj. mojibake `ΓÇö`. Pogođena su tri fajla:

| fajl | ispravka |
|---|---|
| `..._clean_directional_access_grants` | prepisan doslovnim SQL-om iz baze |
| `..._clean_rls_policies` | bajtovi popravljeni na licu mesta |
| `..._clean_rpc_agreement_lifecycle` | bajtovi popravljeni na licu mesta |

Pored toga, `..._clean_security_hardening` je bio moj stari nacrt (semantički
identičan, tekstualno različit) i zamenjen je primenjenim tekstom.

**Zašto ovo nije kozmetika:** oštećen bajt u komentaru ne menja ponašanje SQL-a,
ali obara determinističku rekonstrukciju — folder više ne bi dokazano davao istu
bazu. Sada daje.

## Jedini preostali izuzetak

`20260825115040_cloud_profile_foundation_1_3b` — zatečena migracija od 25.08,
nastala pri postavljanju projekta, **nije deo clean build-a**.

| provera | rezultat |
|---|---|
| bajt-tačan | ne |
| ima mojibake | ne |
| `create table` | 4 / 4 |
| `create function` | 5 / 5 |
| `create policy` | 17 / 17 |
| `create trigger` | 6 / 6 |
| `create index` | 3 / 3 |

Lokalni fajl je CLI-generisana rekonstrukcija (umotana u `BEGIN; … COMMIT;`), ne
originalni primenjeni tekst. Struktura objekata se poklapa 1:1, ali normalizovan
tekst se razlikuje i to **nije prikriveno**. Autoritet za taj sloj je živa šema,
koja je nezavisno provereno tačna.

## Bezbednosni nalazi iz secret scan-a

1. **`.env` je bio praćen u gitu.** `.gitignore` je ignorisao samo `.env*.local`.
   Sklonjen iz indeksa (`git rm --cached`), fajl ostaje na disku, `.env` dodat u
   `.gitignore`. Ništa nije bilo pushovano, pa nije napustilo mašinu.
   Sadržaj je bio **anon** ključ — public-by-design, namenjen klijentskom
   bundle-u. Nije server secret. Ali da je iko ikad dodao `service_role` u isti
   fajl, bio bi commitovan automatski.
2. **BOM na početku `.env`** — prva promenljiva se kod nekih dotenv parsera čita
   kao `﻿EXPO_PUBLIC_SUPABASE_URL`. Uklonjen.
3. `service_role` ključ, DB lozinka ili provajder token — **nigde u repozitorijumu.**

## Posledica za client binding

`.env` već sadrži `EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Dekodiran anon token: `ref = leqcwgzvjsxugfgzdmth`, `role = anon` — tačan clean
DEV/ALPHA projekat, ispravna vrsta kredencijala.

**`EXTERNAL_CONFIG_REQUIRED` za client binding je zatvoren.** Ništa se ne traži
od vlasnika; nijedan secret nije potreban ni prikazan.
