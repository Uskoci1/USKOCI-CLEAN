# USKOČI — Predaja rada (Claude → Codex ili bilo koji drugi agent)

**Stanje na dan 30.08.2026.** Ovaj fajl je jedini koji treba pročitati pre
nastavka. Sve ostalo je izvedeno iz njega.

---

## 1. Gde je istina

| sloj | lokacija | uloga |
|---|---|---|
| **živa baza** | Supabase projekat `leqcwgzvjsxugfgzdmth` (org „Uskoci labaratorija") | **AUTORITET.** Ovde je sve stvarno primenjeno. |
| **kod** | `C:\Users\user\Desktop\USKOCI-APP` | jedini folder u koji se **piše** |
| grana | `clean-alpha-backend` | poslednji commit `9ce106d`, radno stablo čisto |
| remote | **ne postoji** | ništa nije i ne sme biti pushovano |

Stari `uskoci-alpha` i production **nisu ni dostupni** kroz ovu konekciju —
`list_projects` vraća samo jedan projekat. Nije stvar discipline nego pristupa.

## 2. Folderi koji su SAMO ZA ČITANJE

Nikad se ne piše u:

| folder | šta je |
|---|---|
| `Desktop\PRAZAN\uskoci\supabase\migrations` | **donor, 184 migracije** — izvor dokazane semantike |
| `Desktop\CLAUDE 30.08 USKOCI\` | donor paket + V9 handoff dokumenti |
| `Desktop\USKOCI_LOCAL_PREVIEW_SOURCE\` | **stari repo, 95 migracija — NE koristiti kao istinu** |
| `Desktop\antygravity\`, `Desktop\USKOCI 23.08\`, `Desktop\uskoci-e66ed…\` | starije kopije |

`Desktop\PRAZAN` je radni direktorijum sesije, ali `PRAZAN\uskoci\` je donor i
čita se samo.

**Zamka:** `USKOCI_LOCAL_PREVIEW_SOURCE` je jedini sa GitHub remote-om
(`msljivic031/uskoci.git`) i zato deluje kao „pravi" repo. Ima 95 migracija i
staje na 12.08. Donor ima 184 i ide do 22.08. Razlika je 89 migracija, među
njima ceo P1 dispatch rad. Ako se čita odatle, motor se gradi na zastareloj
semantici.

## 3. Kako se rade migracije — ovo je najlakše pokvariti

Migracije se primenjuju **direktno na bazu** (Supabase MCP `apply_migration`).
Folder `supabase/migrations/` je **ogledalo**, ne izvor. Svaki fajl je
bajt-tačna kopija onoga što je stvarno izvršeno.

Provera:

```bash
sh supabase/migrations/check_md5.sh
```

Očekivano **danas**: `ok=33 neispravnih=1 nedostaje=0`
Jedini dozvoljeni „neispravan" je `20260825115040_cloud_profile_foundation_1_3b`
— zatečena migracija koju je generisao CLI, objašnjena u
`supabase/MIGRATION_RECONSTRUCTION_PROOF.md`.

**Pravila:**

1. **Nikad ne menjaj već primenjen `.sql` fajl** da bi promenio ponašanje.
   Nova semantika = **nova migracija**.
2. Posle svake nove migracije: izvezi doslovan SQL iz
   `supabase_migrations.schema_migrations`, upiši fajl `<version>_<name>.sql`,
   dodaj red u `MD5_MANIFEST.txt`, pa pokreni `check_md5.sh`.
3. Ako `check_md5.sh` prijavi više od tog jednog izuzetka — **stani**. Znači da
   je neko menjao fajl ili da migracija nije izvezena.
4. Ne resetuj migration history.

**Već se desilo:** neki alat je sinhronizovao folder i pritom **pokvario UTF-8**
(em-crta `—` zapisana kao `ce93 c387 c3b6`). Ne menja SQL, ali obara
determinizam. Zato postoji md5 provera.

## 4. Mapa fajlova u `USKOCI-APP`

### Backend — moj rad, dokazan

```
supabase/migrations/     34 .sql, bajt-tačno ogledalo baze
supabase/migrations/check_md5.sh + MD5_MANIFEST.txt    ← kapija
supabase/*.md            dokazi i odluke, redom nastanka:
  CUTOVER_MANIFEST.md                 šta je iz donora KEEP/MODIFY/REBUILD/RETIRE
  DONOR_COVERAGE_AUDIT.md             originalni G1–G18
  MARKETPLACE_ENGINE_RECONCILIATION.md
  ADAPTIVE_DISPATCH_DESIGN.md         + CANDIDATE_BUDGET_O1.md (O-1 formula)
  DISPATCH_RUNTIME_EVIDENCE.md        7 invarijanti dispatcha
  PREFLIGHT_SNAPSHOT_AND_DRIFT.md     nalaz drifta
  MIGRATION_RECONSTRUCTION_PROOF.md   zašto je 33/34 dovoljno
  G1_G18_COVERAGE_MATRIX.md           ← GLAVNI plan rada
  PACKAGE_B_CONTACT_REVEAL_EVIDENCE.md
```

### Klijent — NIJE moj rad, tretirati kao neauditovan

```
src/data/supabaseClient.ts      napravila druga agent sesija (commit c1b9f7b)
src/data/supabaseIzvor.ts       READ metode su stubovane (return []; return null;)
src/app/**                      11 ekrana; deo CTA nema onPress
src/store/uloga.ts              prebacivanje uloge ne čisti keš
```

### Moj raniji rad na klijentu, dokazan testovima

```
src/contracts/projections.ts    role-scoped DTO
src/data/ports.ts               kanonski Izvor port
src/data/lazniIzvor.ts          lažni izvor za DEV/TEST
src/data/lazniAi.ts             lažni AI + safety kapija (samo UI sloj!)
src/data/__tests__/             32 testa, 4 suite — moraju ostati zeleni
```

### Tuđi artefakti (ulaz, ne istina)

```
USKOCI_ANTIGRAVITY_INDEPENDENT_DEEP_AUDIT.md
USKOCI_FINDINGS_FOR_CLAUDE.md
USKOCI_CAPABILITY_MATRIX.csv
OVERNIGHT_PROGRESS.md
remote_*.json, missing_remote_statements.json
```
Nalazi su korisni i dobri, ali **svaki se proverava protiv žive baze** pre nego
što se prihvati. Nekoliko ih je zastarelo jer su u međuvremenu popravljeni.

### Van gita, ne dirati

```
.env                 EXPO_PUBLIC_SUPABASE_URL + ANON key. Untracked, u .gitignore.
supabase/.temp/      Supabase CLI scratch. Untracked.
```

`.env` sadrži **anon** ključ (public-by-design, `role:anon`, `ref` tačnog
projekta). Nije server secret. Ali fajl ne sme nazad u git.

## 5. Tvrda pravila koja ne smeš prekršiti

1. **Bez GitHub push-a** dok vlasnik ne kaže `APPROVED FOR GITHUB PUSH`.
2. **Production i stari Alpha se ne diraju.**
3. Nikakav `service_role`, PAT, DB lozinka ni token u source/git.
4. **RLS se ne dokazuje kao `service_role`.** Obavezno:
   ```sql
   set local role authenticated;
   select set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}',true);
   ```
   Najmanje dva stvarna naloga. Bez ovoga dokaz ne važi.
5. **Test podaci se brišu posle merenja.** Koristim email `%@*.test`.
   pg_cron radi **svakog minuta** (`uskoci_marketplace_tick`) i obrađivaće
   zaostale test Potrebe ako ih ostaviš.
6. Ne olabavljuj RLS da bi rešio problem vidljivosti — napravi scoped RPC.

## 6. Rečnik dokaza — koristi ga doslovno

```
SOURCE_EXISTS < TEST_PROVEN < DB_PROVEN < AUTHENTICATED_RUNTIME_PROVEN
             < RUNTIME_PROVEN < DEVICE_PROVEN < LOAD_PROVEN
```

Ne preskači nivoe. Primeri iz ovog projekta:
- KNN indeks na 60 redova = **nije** dokaz za 100k.
- pg_cron + jedna druga sesija = **nije** dokaz konkurentnosti pod opterećenjem.
- red u `notification_deliveries` = **nije** push na telefonu.

## 7. Gde sam stao i šta je sledeće

**Ažurirano 30.08. posle live audit reconciliation-a.**

Zatvoreno i dokazano (`AUTHENTICATED_RUNTIME_PROVEN`, nikad `service_role`):

| oznaka | šta | migracija |
|---|---|---|
| G3 | dispatch motor, 7 invarijanti | 0021–0025 |
| G9 | rok za prijave gasi Potrebu | `..._need_response_deadline_expiry` |
| B (paket) | scoped PHONE/LOCATION reveal | `..._scoped_contact_reveal` |
| — | forever-grant curenje, starvation zamene, ghost notifikacije | `..._cancellation_privacy_and_wakeup` |
| A,D,E | publish bypass, revizija, account↔profile | `..._need_lifecycle_integrity` |
| B,C | sposobnosti i rok u trenutku izbora | `..._selection_eligibility_and_deadline` |
| F | atomsko slanje prijave + verzije | `..._authoritative_response_submit` |

**Sledeće, redom:**

1. `rpc_cancel_need` i `rpc_withdraw_response` — ne postoje; korisnici su
   zarobljeni. `marketplace_responses` UPDATE je privremeno ostavljen otvoren
   baš zato — zatvoriti ga kad `withdraw` stigne.
2. `rpc_report_problem` — `p_narrative` se validira ali se **ne čuva**.
3. AI safety: `ALLOW/CLARIFY/REVIEW/BLOCK` postoji samo u `lazniAi.ts`, dakle u
   klijentu. Serverske kapije nema. Edge funkcija: **0 deployovanih**.
4. **Paket A:** kompletan diff `ports.ts` ↔ `supabaseIzvor.ts`. READ metode su
   stubovane (`return []`, `return null`). Traversal 11 ekrana i CTA.
5. `agreements` `ON DELETE RESTRICT` → nalog se ne može obrisati.
6. Nema trigera za brisanje `storage.objects`; nema media projekcije za tuđe
   avatare.
7. `supabase/tests/` ne postoji.

**Poznat defekt koji nisam dirao naslepo:** `supabaseClient.ts` ima
`persistSession: false` jer `@react-native-async-storage/async-storage` nije
instaliran — prijava se ne pamti između pokretanja. Traži zasebnu odluku.

## 8. Prvo što uradi kad preuzmeš

```bash
cd C:\Users\user\Desktop\USKOCI-APP
git log --oneline -3
sh supabase/migrations/check_md5.sh      # mora: ok=33 neispravnih=1
```

Pa uporedi migration history u bazi sa `MD5_MANIFEST.txt`. Ako se ne poklapa,
neko je radio u međuvremenu — nađi šta, pre nego što nastaviš.

**Napomena:** na ovom repou su već radile najmanje dve agent sesije osim mene.
Uvek proveri `git log` i vreme izmene fajlova pre nego što pretpostaviš da je
stanje ono koje si ostavio.
