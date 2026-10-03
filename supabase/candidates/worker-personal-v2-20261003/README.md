# WPP02 — radni profil V2, izolovan ugovor

**CONTRACT CANDIDATE ONLY — NOT APPLICABLE.** Nema instalacionog SQL-a, migracije, runtime importa, deploy-a ili promene poslovnih podataka.

Glavni [ugovor i preostali rad](../../../docs/implementation/ui-ux-pass-20261002/WORKER_V2_CONTRACT_20261003.md) određuju najmanji atomski V2 rez. WPP01 i postojeći AI/push ostaju netaknuti.

| Fajl | Namena |
| --- | --- |
| `contract.json` | Predlog kanonskih polja/verzija, poznati baseline i otvoreni uslovi. |
| `preferences.contract.mjs` | Izvršiva čista specifikacija, nije povezana sa aplikacijom, Edge-om ili bazom. |
| `preferences.contract.test.mjs` | Lokalna semantika i integritet zamrznutih funkcijskih pinova. |
| `preflight.readonly.sql` | Isključivo poređenje 45 funkcijskih pinova sa katalogom; nije potpun preflight/admission i nije izvršen u ovoj izradi. |
| `evidence/` | Metapodaci pročitani 2026-10-03 19:35–19:40 UTC: funkcije, kolone, constraints, ACL/triggers, registry/binding stanje; bez korisničkih redova. |
| `LOCAL_CHECKS.json` | Rezultat lokalne provere i SHA256 fajlova specifikacije. |

Pokretanje bez novih zavisnosti, iz korena repozitorijuma:

```text
node --test supabase/candidates/worker-personal-v2-20261003/preferences.contract.test.mjs
```

Rezultat: **18 testova PASS**. To ne dokazuje SQL ponašanje, Auth/RLS, stvarnu konkurentnost, export, brisanje, sertifikat, UI, model ili dostavu push-a.

Slobodan izraz „Mogu da nosim, ne mogu da prevozim” čuva se tačno u opisnim `workNotes`. Nije izvršiv filter i ne sme proizvesti obećanje da takvi poslovi neće stizati. Široka `SELIDBE_PREVOZ` grupa ne rešava to fino razlikovanje.

Trenutno `retention_policy_sets` ima 0 redova i export-policy binding je null. To je **zatečeno stanje**, ne V2 delta i ne tiho popravljena prepreka. Source readiness=true ne čini export spremnim. Ugovor ne izmišlja policy/legal podatke.

Za sledeću primenu nedostaju ceo SQL/kompatibilni rollback, disposable Auth/concurrency/matching/export/erasure dokaz, razrešenje postojećeg export-policy stanja, tačan certificate/export admission i V1/V2 client/Edge/native integracija. Zato ne postoji `candidate.sql` niti zahtev za odobrenje nepotpunog paketa.

