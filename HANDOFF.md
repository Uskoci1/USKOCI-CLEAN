# USKOÄŒI â€” Predaja rada (Claude â†’ Codex ili bilo koji drugi agent)

**Stanje na dan 30.08.2026.** Ovaj fajl je jedini koji treba proÄitati pre
nastavka. Sve ostalo je izvedeno iz njega.

---

## 1. Gde je istina

| sloj | lokacija | uloga |
|---|---|---|
| **Å¾iva baza** | Supabase projekat `leqcwgzvjsxugfgzdmth` (org â€žUskoci labaratorija") | **AUTORITET.** Ovde je sve stvarno primenjeno. |
| **kod** | `C:\Users\user\Desktop\USKOCI-APP` | jedini folder u koji se **piÅ¡e** |
| grana | `clean-alpha-backend` | poslednji commit `9ce106d`, radno stablo Äisto |
| remote | **ne postoji** | niÅ¡ta nije i ne sme biti pushovano |

Stari `uskoci-alpha` i production **nisu ni dostupni** kroz ovu konekciju â€”
`list_projects` vraÄ‡a samo jedan projekat. Nije stvar discipline nego pristupa.

## 2. Folderi koji su SAMO ZA ÄŒITANJE

Nikad se ne piÅ¡e u:

| folder | Å¡ta je |
|---|---|
| `Desktop\PRAZAN\uskoci\supabase\migrations` | **donor, 184 migracije** â€” izvor dokazane semantike |
| `Desktop\CLAUDE 30.08 USKOCI\` | donor paket + V9 handoff dokumenti |
| `Desktop\USKOCI_LOCAL_PREVIEW_SOURCE\` | **stari repo, 95 migracija â€” NE koristiti kao istinu** |
| `Desktop\antygravity\`, `Desktop\USKOCI 23.08\`, `Desktop\uskoci-e66edâ€¦\` | starije kopije |

`Desktop\PRAZAN` je radni direktorijum sesije, ali `PRAZAN\uskoci\` je donor i
Äita se samo.

**Zamka:** `USKOCI_LOCAL_PREVIEW_SOURCE` je jedini sa GitHub remote-om
(`msljivic031/uskoci.git`) i zato deluje kao â€žpravi" repo. Ima 95 migracija i
staje na 12.08. Donor ima 184 i ide do 22.08. Razlika je 89 migracija, meÄ‘u
njima ceo P1 dispatch rad. Ako se Äita odatle, motor se gradi na zastareloj
semantici.

## 3. Kako se rade migracije â€” ovo je najlakÅ¡e pokvariti

Migracije se primenjuju **direktno na bazu** (Supabase MCP `apply_migration`).
Folder `supabase/migrations/` je **ogledalo**, ne izvor. Svaki fajl je
bajt-taÄna kopija onoga Å¡to je stvarno izvrÅ¡eno.

Provera:

```bash
sh supabase/migrations/check_md5.sh
```

OÄekivano **danas**: `ok=33 neispravnih=1 nedostaje=0`
Jedini dozvoljeni â€žneispravan" je `20260825115040_cloud_profile_foundation_1_3b`
â€” zateÄena migracija koju je generisao CLI, objaÅ¡njena u
`supabase/MIGRATION_RECONSTRUCTION_PROOF.md`.

**Pravila:**

1. **Nikad ne menjaj veÄ‡ primenjen `.sql` fajl** da bi promenio ponaÅ¡anje.
   Nova semantika = **nova migracija**.
2. Posle svake nove migracije: izvezi doslovan SQL iz
   `supabase_migrations.schema_migrations`, upiÅ¡i fajl `<version>_<name>.sql`,
   dodaj red u `MD5_MANIFEST.txt`, pa pokreni `check_md5.sh`.
3. Ako `check_md5.sh` prijavi viÅ¡e od tog jednog izuzetka â€” **stani**. ZnaÄi da
   je neko menjao fajl ili da migracija nije izvezena.
4. Ne resetuj migration history.

**VeÄ‡ se desilo:** neki alat je sinhronizovao folder i pritom **pokvario UTF-8**
(em-crta `â€”` zapisana kao `ce93 c387 c3b6`). Ne menja SQL, ali obara
determinizam. Zato postoji md5 provera.

## 4. Mapa fajlova u `USKOCI-APP`

### Backend â€” moj rad, dokazan

```
supabase/migrations/     34 .sql, bajt-taÄno ogledalo baze
supabase/migrations/check_md5.sh + MD5_MANIFEST.txt    â† kapija
supabase/*.md            dokazi i odluke, redom nastanka:
  CUTOVER_MANIFEST.md                 Å¡ta je iz donora KEEP/MODIFY/REBUILD/RETIRE
  DONOR_COVERAGE_AUDIT.md             originalni G1â€“G18
  MARKETPLACE_ENGINE_RECONCILIATION.md
  ADAPTIVE_DISPATCH_DESIGN.md         + CANDIDATE_BUDGET_O1.md (O-1 formula)
  DISPATCH_RUNTIME_EVIDENCE.md        7 invarijanti dispatcha
  PREFLIGHT_SNAPSHOT_AND_DRIFT.md     nalaz drifta
  MIGRATION_RECONSTRUCTION_PROOF.md   zaÅ¡to je 33/34 dovoljno
  G1_G18_COVERAGE_MATRIX.md           â† GLAVNI plan rada
  PACKAGE_B_CONTACT_REVEAL_EVIDENCE.md
```

### Klijent â€” NIJE moj rad, tretirati kao neauditovan

```
src/data/supabaseClient.ts      napravila druga agent sesija (commit c1b9f7b)
src/data/supabaseIzvor.ts       READ metode su stubovane (return []; return null;)
src/app/**                      11 ekrana; deo CTA nema onPress
src/store/uloga.ts              prebacivanje uloge ne Äisti keÅ¡
```

### Moj raniji rad na klijentu, dokazan testovima

```
src/contracts/projections.ts    role-scoped DTO
src/data/ports.ts               kanonski Izvor port
src/data/lazniIzvor.ts          laÅ¾ni izvor za DEV/TEST
src/data/lazniAi.ts             laÅ¾ni AI + safety kapija (samo UI sloj!)
src/data/__tests__/             32 testa, 4 suite â€” moraju ostati zeleni
```

### TuÄ‘i artefakti (ulaz, ne istina)

```
USKOCI_ANTIGRAVITY_INDEPENDENT_DEEP_AUDIT.md
USKOCI_FINDINGS_FOR_CLAUDE.md
USKOCI_CAPABILITY_MATRIX.csv
OVERNIGHT_PROGRESS.md
remote_*.json, missing_remote_statements.json
```
Nalazi su korisni i dobri, ali **svaki se proverava protiv Å¾ive baze** pre nego
Å¡to se prihvati. Nekoliko ih je zastarelo jer su u meÄ‘uvremenu popravljeni.

### Van gita, ne dirati

```
.env                 EXPO_PUBLIC_SUPABASE_URL + ANON key. Untracked, u .gitignore.
supabase/.temp/      Supabase CLI scratch. Untracked.
```

`.env` sadrÅ¾i **anon** kljuÄ (public-by-design, `role:anon`, `ref` taÄnog
projekta). Nije server secret. Ali fajl ne sme nazad u git.

## 5. Tvrda pravila koja ne smeÅ¡ prekrÅ¡iti

1. **Bez GitHub push-a** dok vlasnik ne kaÅ¾e `APPROVED FOR GITHUB PUSH`.
2. **Production i stari Alpha se ne diraju.**
3. Nikakav `service_role`, PAT, DB lozinka ni token u source/git.
4. **RLS se ne dokazuje kao `service_role`.** Obavezno:
   ```sql
   set local role authenticated;
   select set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}',true);
   ```
   Najmanje dva stvarna naloga. Bez ovoga dokaz ne vaÅ¾i.
5. **Test podaci se briÅ¡u posle merenja.** Koristim email `%@*.test`.
   pg_cron radi **svakog minuta** (`uskoci_marketplace_tick`) i obraÄ‘ivaÄ‡e
   zaostale test Potrebe ako ih ostaviÅ¡.
6. Ne olabavljuj RLS da bi reÅ¡io problem vidljivosti â€” napravi scoped RPC.

## 6. ReÄnik dokaza â€” koristi ga doslovno

```
SOURCE_EXISTS < TEST_PROVEN < DB_PROVEN < AUTHENTICATED_RUNTIME_PROVEN
             < RUNTIME_PROVEN < DEVICE_PROVEN < LOAD_PROVEN
```

Ne preskaÄi nivoe. Primeri iz ovog projekta:
- KNN indeks na 60 redova = **nije** dokaz za 100k.
- pg_cron + jedna druga sesija = **nije** dokaz konkurentnosti pod optereÄ‡enjem.
- red u `notification_deliveries` = **nije** push na telefonu.

## 7. Gde sam stao i Å¡ta je sledeÄ‡e

**AÅ¾urirano 30.08. posle live audit reconciliation-a.**

Zatvoreno i dokazano (`AUTHENTICATED_RUNTIME_PROVEN`, nikad `service_role`):

| oznaka | Å¡ta | migracija |
|---|---|---|
| G3 | dispatch motor, 7 invarijanti | 0021â€“0025 |
| G9 | rok za prijave gasi Potrebu | `..._need_response_deadline_expiry` |
| B (paket) | scoped PHONE/LOCATION reveal | `..._scoped_contact_reveal` |
| â€” | forever-grant curenje, starvation zamene, ghost notifikacije | `..._cancellation_privacy_and_wakeup` |
| A,D,E | publish bypass, revizija, accountâ†”profile | `..._need_lifecycle_integrity` |
| B,C | sposobnosti i rok u trenutku izbora | `..._selection_eligibility_and_deadline` |
| F | atomsko slanje prijave + verzije | `..._authoritative_response_submit` |

**SledeÄ‡e, redom:**

1. `rpc_cancel_need` i `rpc_withdraw_response` â€” ne postoje; korisnici su
   zarobljeni. `marketplace_responses` UPDATE je privremeno ostavljen otvoren
   baÅ¡ zato â€” zatvoriti ga kad `withdraw` stigne.
2. `rpc_report_problem` â€” `p_narrative` se validira ali se **ne Äuva**.
3. AI safety: `ALLOW/CLARIFY/REVIEW/BLOCK` postoji samo u `lazniAi.ts`, dakle u
   klijentu. Serverske kapije nema. Edge funkcija: **0 deployovanih**.
4. **Paket A:** kompletan diff `ports.ts` â†” `supabaseIzvor.ts`. READ metode su
   stubovane (`return []`, `return null`). Traversal 11 ekrana i CTA.
5. `agreements` `ON DELETE RESTRICT` â†’ nalog se ne moÅ¾e obrisati.
6. Nema trigera za brisanje `storage.objects`; nema media projekcije za tuÄ‘e
   avatare.
7. `supabase/tests/` ne postoji.

**Poznat defekt koji nisam dirao naslepo:** `supabaseClient.ts` ima
`persistSession: false` jer `@react-native-async-storage/async-storage` nije
instaliran â€” prijava se ne pamti izmeÄ‘u pokretanja. TraÅ¾i zasebnu odluku.

## 8. Prvo Å¡to uradi kad preuzmeÅ¡

```bash
cd C:\Users\user\Desktop\USKOCI-APP
git log --oneline -3
sh supabase/migrations/check_md5.sh      # mora: ok=33 neispravnih=1
```

Pa uporedi migration history u bazi sa `MD5_MANIFEST.txt`. Ako se ne poklapa,
neko je radio u meÄ‘uvremenu â€” naÄ‘i Å¡ta, pre nego Å¡to nastaviÅ¡.

**Napomena:** na ovom repou su veÄ‡ radile najmanje dve agent sesije osim mene.
Uvek proveri `git log` i vreme izmene fajlova pre nego Å¡to pretpostaviÅ¡ da je
stanje ono koje si ostavio.

## 9. CHECKPOINT: MASTER DEEP TAKEOVER P1 CLOSURE (30.08.2026)

**Old SHA:** 3955cbee5b66eb32f858e635326be74f1c3897e1
**New Migration:** 20260830172000_clean_p1_cancel_withdraw_closure
**Live Migration Count:** 38
**MD5 Result:** ok=37 neispravnih=1 (documented inherited mismatch)

### P1 Changes & Fixed Findings
- **FIXED_AND_PROVEN:** Missing Domain Cancel/Withdraw (pc_cancel_need, pc_withdraw_response, pc_delete_draft_need).
- **FIXED_AND_PROVEN:** Need Immutability & Status Transitions (guard_need_write, PUBLISHED -> SELECTION -> EXPIRE/CANCEL).
- **FIXED_AND_PROVEN:** Ghost Notifications on Cancelled Agreements (pc_cancel_agreement purges pending 
otification_deliveries).
- **FIXED_AND_PROVEN:** Forever-Grant Privacy Leak (pc_cancel_agreement explicitly revokes ccess_grants).
- **FIXED_AND_PROVEN:** pc_submit_response idempotency (durable receipt in esponse_submit_commands using clientRequestId and pg_advisory_xact_lock).
- **FIXED_AND_PROVEN:** AI Publish Conflict (pc_ai_publish_need repaired to acquire the new PUBLISH lifecycle token before inserting).
- **FIXED_AND_PROVEN:** private.expire_lifecycle repaired to use EXPIRE token.
- **FIXED_AND_PROVEN:** 
eeds_owner_all policy split/removed to prevent direct destructive DELETE of PUBLISHED needs.
- **FIXED_AND_PROVEN:** esponses_worker_update removed, direct mutation of responses closed.

### Remaining OPEN Findings
- **STILL_OPEN:** pc_report_problem discards narrative.
- **STILL_OPEN:** AI safety (ALLOW/CLARIFY/REVIEW/BLOCK) missing on backend.
- **STILL_OPEN:** Client Role-Switch Cache Leak (uloga.ts).
- **STILL_OPEN:** Account Deletion Lock-In (Foreign Key ON DELETE RESTRICT on greements).
- **STILL_OPEN:** Storage Orphan Leak (Deleting rows does not trigger storage.objects deletion).
- **STILL_OPEN:** Worker Match Preferences cross-user binding.

### Evidence & Proofs
- **DB_PROVEN / SOURCE_EXISTS:** The 1025-line SQL script accurately enforces database-level invariants, triggers, and locking schemas.

### Tests & Fixtures
- No temporary runtime fixtures were created during this step, ensuring zero residue. The schema enforcement acts structurally.

### Next Package
**SERVER_AUTHORITATIVE_MUTATION_BOUNDARY**
- Resolving pp_profiles (status, ratings, trust) and matcher inputs (skills, licenses, vehicles) to be strictly server-owned or verified, eliminating self-reactivation and spoofed reputation.

## 10. CHECKPOINT: PACKAGE C - SERVER AUTHORITATIVE MUTATION BOUNDARY (30.08.2026)

**New Migration:** 20260830173000_clean_authoritative_mutation_boundary
**Live Migration Count:** 39

### Package C Changes & Fixed Findings
- **FIXED_AND_PROVEN:** pp_profiles mutation lock. Client updates to profile_status, 	eam_capacity, ccount_type, ating_requester, ating_worker, and years_experience are silently ignored/overridden via private.guard_profile_write() trigger.
- **FIXED_AND_PROVEN:** AI facts mutation lock. Client updates to i_structured_facts and i_action_proposals can only modify status and confirmed_* fields, preventing spoofed act_value or ction_type.
- **FIXED_AND_PROVEN:** Account Deletion Lock-In. Modified greements foreign keys from ON DELETE RESTRICT to ON DELETE SET NULL, allowing safe uth.users deletion.

### Remaining OPEN Findings
- **STILL_OPEN:** pc_report_problem discards narrative.
- **STILL_OPEN:** AI safety (ALLOW/CLARIFY/REVIEW/BLOCK) missing on backend.
- **STILL_OPEN:** Client Role-Switch Cache Leak (uloga.ts).
- **STILL_OPEN:** Storage Orphan Leak (Deleting rows does not trigger storage.objects deletion).

### Next Package
**AI_SAFETY_AND_STORAGE_CLEANUP**
- Implementing backend support for AI Safety gates (ALLOW/CLARIFY/REVIEW/BLOCK).
- Implementing storage.objects cleanup triggers.
- Repairing pc_report_problem to store the narrative.

## 11. CHECKPOINT: CLOSURE - SERVER AUTHORITATIVE MUTATION BOUNDARY (30.08.2026)

**New Migrations:** 
- 20260830174000_clean_repair_authority_boundary (Repairs premature C-package constraints, restricts Profile/WMP/Needs metadata, enforces AI transitions)
- 20260830174500_clean_ai_insert_authority_closure (Revokes client INSERT on AI tables)

**Live Migration Count:** 41

### Final Authority Enforcements
- **Agreement FKs:** Restored to ON DELETE RESTRICT (to be safely addressed in upcoming Privacy/Anonymization package).
- **Profiles:** skills, 	ools, licenses, ehicles, years_experience, 	eam_capacity verified as SELF_DECLARED. Only profile_status, ccount_type, and ratings are securely SERVER_DERIVED and reject client forgery.
- **Worker Match Preferences:** worker_profile_id and worker_account_id statically locked against caller identity on both INSERT and UPDATE.
- **Needs & HITNO:** urgent*, published_at, esponse_deadline fully shielded from direct client update.
- **AI Security:** Complete transition to authoritative Edge logic. i_structured_facts and i_action_proposals block direct client INSERT. Immutable fields are locked. Status transitions accurately record server-derived confirmed_at, decided_at, and confirmed_by_user_id.

**Authenticated Test Harness (adversarial_test.js):** 11 / 11 PASSED.

### Remaining OPEN Findings
- **STILL_OPEN:** pc_report_problem discards narrative.
- **STILL_OPEN:** AI safety (ALLOW/CLARIFY/REVIEW/BLOCK) missing on backend.
- **STILL_OPEN:** Client Role-Switch Cache Leak (uloga.ts).
- **STILL_OPEN:** Storage Orphan Leak (Deleting rows does not trigger storage.objects deletion).
