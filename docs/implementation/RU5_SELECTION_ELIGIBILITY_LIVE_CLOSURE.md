# RU-5 Manual Selection Eligibility Revalidation — live closure evidence

Status: `CLOSED / CANONICAL / LIVE / DO NOT REDO`

- proof head: `d71c6e08b518e2955020c21538c1238358b14df3`
- proof run: `34017442269` — PASS
- implementation PR #23 PRE-P4: `34017443678` — PASS
- implementation PR #23 CodeQL: `34017442615` — Actions/Python/JavaScript-TypeScript PASS
- canonical implementation merge: `c0dd1434c436578e0f517520a2156b72ec5d3eaa`
- implementation canonical PRE-P4: `34017639405` — PASS
- implementation canonical CodeQL: `34017639038` — PASS
- implementation canonical Control-0: `34017639343` — PASS
- closure/provenance PR #24 head: `3a37f316f1b02910bc8c995ce411cf0c9b56b9b5`
- closure PR PRE-P4: `34018929991` — PASS
- closure PR CodeQL: `34018929257` — Actions/Python/JavaScript-TypeScript PASS
- closure/provenance canonical merge: `cc507910a10515db52f0b0db6d86478cfd19ea05`
- closure canonical PRE-P4: `34019026629` — PASS
- closure canonical CodeQL: `34019026435` — Actions/Python/JavaScript-TypeScript PASS
- closure canonical Control-0: `34019026661` — PASS
- canonical source: `20260906010000_clean_ru5_selection_eligibility_revalidation.sql`
- canonical MD5 / bytes: `6ddb7d5d141e7cb3a454fa7e6ca1280d / 17954`
- live Supabase: `leqcwgzvjsxugfgzdmth`
- live migration: `20260906065758_clean_ru5_selection_eligibility_revalidation`
- live recorded statement: one statement, exact MD5 `6ddb7d5d141e7cb3a454fa7e6ca1280d`, `17954` UTF-8 bytes
- `rpc_select_response(...)` live definition MD5: `ea1c1c40783dbfb9eeab527c128f9dd0`
- `rpc_list_need_candidates(uuid)` live definition MD5: `1978ce1d5852cef46f94e81468d37bba`
- final fresh live business counts preserved: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- historical selected state preserved: `2` SELECTED responses / `2` SELECTED need_selections / `2` Agreements
- open legacy state preserved, not rewritten: `2` SUBMITTED Applications
- snapshot rows remain `0`
- both current SUBMITTED rows satisfy the new current-read `STALE` branch (`2/2`)
- authenticated response direct DML remains denied
- `need_selections` RLS remains enabled with one SELECT policy and zero DML policies
- D0140 inventories remain `0 / 0 / 0`; production ALLOW remains fail-closed
- RU-4B governed inventories remain all `0`; public Q&A remains activation blocked
- monetization remains `FREE / 0 RSD`
- Povezivanje remains not activated
- RU-5B Application AI remains gated

The connected live SQL inspection role is `supabase_read_only_user`, which intentionally cannot execute requester-only `rpc_list_need_candidates`. No production grant was widened to manufacture a live authenticated replay. Authenticated runtime behavior was proved on the disposable proof stack; live postflight proves exact migration bytes, exact resulting function definitions/grants, preserved rows and that the two current legacy Applications satisfy the same new STALE predicate.

Explicit non-claims: durable Selection payload-idempotency receipt, R05 retry identity, hard calendar conflicts, Agreement/shared-Dogovor redesign, Povezivanje, bounded-note policy, D0140 activation, RU-4B activation, monetization and Application AI are separate work.

Next cursor: fresh frozen-plan + current physical reconciliation of remaining manual Selection/Agreement dependencies. Do not invent a new P0D/RU number. Durable Selection command identity/idempotency plus R05 retry identity is the first physically proven unresolved Selection risk, but remains only a candidate next unit until governing-plan reconciliation admits it; calendar hard-conflict authority remains separate RU-6A work.
