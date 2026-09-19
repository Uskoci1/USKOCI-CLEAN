# F7 — the repo's copy of the auth bootstrap function is repaired (2026-09-19)

**No database was touched.** The owner's instruction: "Live DEV funkciju NE menjaj. Ispravi pokvarena č/Č
slova u repo kopiji `public.handle_uskoci_auth_user_created()` koristeći tačan canonical UTF-8 izvor iz live
ledgera/funkcije. Dokaži da posle toga repo source više ne proizvodi lažni predecessor/hash drift. Bez
deploy-a baze samo zbog ovog source-repair-a."

## 1. What was wrong

`supabase/migrations/20260825115040_cloud_profile_foundation_1_3b.sql` carried three lines whose Serbian
letters had been through a UTF-8 → CP437 → UTF-8 round trip: `Tra┼╛im pouzdanu pomo─ç`, `Novi ─ìlan USKO─îI`,
`Spreman da usko─ìim`, `USKO─îI korisnik`. The file is the one that created
`public.handle_uskoci_auth_user_created()` in August.

Canonical DEV never ran those bytes. Two independent records say so:

| Record | Value |
| --- | --- |
| live `md5(prosrc)` on 2026-09-07 (`docs/implementation/evidence/ai-live87-20260907/00-functions-parsed.json`) | `73eacd1dba1dac3e5dacc75332ccaf4c` |
| the repository file as committed, same rendering | `a256174f22be0ad6a18817c1fa82a0ae` |
| `md5(pg_get_functiondef(...))` that `dev_alpha_pkg019_profile_bootstrap_truthful` pinned as its predecessor before replacing the function on 2026-09-17 | `f4a758af24314b204978eef26fa13929` |
| the repository file as committed, same rendering | `11bd51c68b8953d5a80962b957e7d07a` (this is the value CI computed on a source-147 replay) |

So the repository file was a faulty transcription of an applied migration: it never matched what was
applied. Repairing it restores the invariant that `supabase/migrations/` holds the bytes that ran; it does
not rewrite an applied migration's meaning, and nothing is applied anywhere because of it.

## 2. The repair, and its proof

The exact inverse of the corruption, `text.encode('cp437').decode('utf-8')`, applied to the whole file.
Three lines change, 15 295 bytes become 15 276:

```
line 141  ... split_part(COALESCE(NEW.email,''), '@', 1), 'USKOČI korisnik');
line 156  ... 'Tražim pouzdanu pomoć uz jasan dogovor.','Novi član USKOČI zajednice.',10,false)
line 160  ... 'Spreman da uskočim kada se dogovor jasno postavi.','Dostupan za poslove ...'
```

**The repaired text reproduces both live values exactly**, which is the whole proof that the encoding was
the only difference:

| | before | after the repair | the live record it must equal |
| --- | --- | --- | --- |
| `md5(prosrc)` | `a256174f…` | **`73eacd1dba1dac3e5dacc75332ccaf4c`** | the 2026-09-07 live evidence |
| `md5(pg_get_functiondef(…))` | `11bd51c6…` | **`f4a758af24314b204978eef26fa13929`** | the predecessor `pkg019` pinned |
| file md5 | `4051bc4c7873fe715707269a3714f12d` | `03f836c72c7d587861a6459978470bdf` | — |

Nothing else in the repository carried the same corruption: a scan of every `.sql` under
`supabase/migrations`, `supabase/proofs`, `supabase/candidates` and `supabase/operations` for the CP437 box
characters finds those three lines and nothing else.

## 3. What had to be re-frozen with it

Ten constants, in nine files, are derived from those bytes by one formula — the md5 of each of the first N
migration files, joined as `md5  file` lines, then sha256. They exist to detect an unreviewed byte change;
after the repair they detect one from the repaired baseline. Every one was recomputed, none by hand:

| File | Constant | Before | After |
| --- | --- | --- | --- |
| `supabase/migrations/MD5_MANIFEST.txt` | line 1 | `4051bc4c…` | `03f836c7…` |
| `supabase/proofs/ai/ai_draft_authority_predecessor_files.json` | `historical_inventory_sha256` (85) | `7a255831…` | `c819979b…` |
| `supabase/proofs/completion/p0e_completion_guards_predecessor_files.json` | `historical_inventory_sha256` (87) | `52561c10…` | `e75f4f24…` |
| `supabase/proofs/legal/p1_legal_consent_predecessor_files.json` | same (87) | `52561c10…` | `e75f4f24…` |
| `supabase/proofs/legal/p2_data_export_predecessor_files.json` | same (87) | `52561c10…` | `e75f4f24…` |
| `supabase/proofs/legal/p3_retention_schedule_predecessor_files.json` | same (87) | `52561c10…` | `e75f4f24…` |
| `supabase/proofs/legal/p4_processor_map_predecessor_files.json` | same (87) | `52561c10…` | `e75f4f24…` |
| `supabase/proofs/policy/d0140a_bundle_registration_predecessor_files.json` | same (87) | `52561c10…` | `e75f4f24…` |
| `supabase/proofs/historical_source108_fixture.mjs` | `INVENTORY_SHA256` (108) | `5e8b987d…` | `db1b81dc…` |
| `supabase/proofs/source147_admission.json` | `inventory_sha256` (147) | `e768cd57…` | `d2b058a6…` |

Outside `docs/`, each old value appears in exactly one place, and each was replaced exactly once. The
`docs/implementation/evidence/**` records that mention the old values are left alone: they are what was true
in the runs they describe, and they stay that way. The committed PKG-023 surface snapshot
`supabase/proofs/pkg023f_closure_recert/evidence/source147_surface_ci_run_35446129464.txt` is one of those:
it records the replay of CI run 35446129464, before this repair, where the body md5 was `a256174f…`.

No file was added or removed, the inventory is still 147 files, and no `.sql` other than the repaired one
changed by one byte.

## 4. That the false drift is gone

- `python supabase/migrations/check_migration_integrity.py` → `PASS migration_integrity files=147
  live_snapshot=87 pending=60 191500=RECORDED_STATEMENT_RECONSTRUCTION exact_byte_mirror=false
  participant_contract=PASS`.
- `supabase/proofs/pkg023f_closure_recert/pkg023f_closure_recert_proof.mjs` replays the `dev_alpha`
  migrations from the exact ledger text on a source-147 database. It used to need one substitution — the
  predecessor md5 `pkg019` pins — and reported it. It now asserts **`substitutions` is empty**: every pinned
  predecessor md5 in every ledger text is the md5 the replay actually has. It also asserts that after
  `pkg019` the replayed function is `734ca70188a3cab8cef2f8b38bcd8ca6` as its definition md5 (prosrc `187aa3a262ce940f39ae7faba720963e`), which is what canonical DEV
  carries today.
- PRE-P4 integrity runs the whole pre_v3 proof chain over the repaired inventory.

CI result: **PKG-023f run 35455415211 on `3dbbff3b`, 11 of 11 green, `predecessorPinsThatDifferInTheReplay`
is `[]`** — no pin had to be substituted, which is the proof asked for. **PRE-P4 integrity green on the same
commit** (run 35455419735), so the whole pre_v3 chain accepts the repaired inventory.
