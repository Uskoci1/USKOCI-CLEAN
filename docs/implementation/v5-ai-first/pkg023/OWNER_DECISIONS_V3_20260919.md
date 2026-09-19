# V3 — owner decisions (2026-09-19, binding)

Recorded from the owner's messages of 2026-09-19. The owner supplied the V3 3.1 architecture package
(`USKOCI_V3_PRODUCT_ARCHITECTURE_DEEP_20260919.md`, master SHA-256
`7838d47beba4c16a9e46428da705a24fa142304301e00d4f8da821bc93b5b33c`, with its forensic task F01–F20),
was asked eight merged product questions, and answered **"sve DA"** — every recommendation accepted.
After the read-only forensic review he wrote **"Odobravam implementaciju"**, which authorises the
first slice listed at the end of this file and nothing beyond it.

The package itself is a proposal and stays outside the repository. What binds the UI is this file.

## The eight decisions

| # | Decision | What the forensic review found on `fca3eac` and canonical DEV |
| --- | --- | --- |
| 1 | One application with no global role. Stable navigation **Početna \| Mapa \| Dogovori**; the two actions are **Objavi zadatak** and **Uskoči i zaradi**. | The server has no notion of an account intent: no function reads one. The role lives in 49 client files (cache identity, the tab shell, a few display branches). Client work only. |
| 2 | A task's budget is the total for the whole task. An application's price is the total for the people that application brings. The budget is **advisory**, not a hard cap. | Already the shape of the data: `price_rsd` sits beside `covered_slots` in responses and in `agreement_versions.terms`, nothing multiplies or divides a price, and `rpc_select_response` has no budget rule. Copy only. |
| 3 | The entry may be short and light; the final look is chosen on a real phone render. | The 4.38 s scene already plays once per install, signed-out only (`src/hooks/useEntryIntro.ts`). What remains of this decision is the light palette for entry and auth. The mark, the mascot and the photographs are not superseded. |
| 4 | The exact place stays private; the public pin is within roughly 100 m, as a deterministic grid with no randomness. The owner accepts that in a village one cell may be one house. | Today the grid is 0.01° (about 1.11 × 0.78 km): `private.materialize_resolved_location` rounds to two decimals and `check_need_resolved_location_binding` plus the publication fingerprint enforce it. Three decimals give about 111 × 78 m. This is a forward migration, not part of the first slice. |
| 5 | A guest does not browse before signing in. Not now. | `anon` can call only `rpc_get_legal_bundle` and `rpc_closure_api_guard`. No change. |
| 6 | A person's own tasks are shown in their calendar and do not block them as a worker. | `rpc_get_worker_calendar` reads worker-side agreements only. The engine already does not block; showing the requester side is client composition. |
| 7 | Outside the first phase: wallet, payments, companies with several operators, recurring tasks, ETA, KYC. | — |
| 8 | Google and Apple sign-in stay hidden until they work. | Already removed from `src/app/auth.tsx` on 2026-09-18. |

## What these supersede

- **PKG-011 owner decision 1 (2026-09-16)**, the two tab shells `Zadaci | Mapa | Dogovori` and
  `Prijave | Mapa | Dogovori`, is superseded by decision 1 above. Until the second slice lands the
  two shells remain what the app renders; nothing in the first slice changes the tab layout.
- **PKG-011 owner decision 2 (2026-09-16)**, no silent intent switch, stays in force for as long as
  an intent exists. Decision 1 removes the intent rather than the rule.
- The instruction that entry and auth keep their own dark palette is superseded for the palette
  only. The V4.9 mark, mascot, photographs and HOME signature stay preserved.

## Still open — three questions put to the owner on 2026-09-19

1. Tasks already published when the grid changes: stay on the old point until their place changes
   (recommended), or be recomputed once.
2. The public task row carries the requester's account id, which with a ~100 m pin makes it easier
   to tie several tasks to one house: accept for the first phase and record the risk
   (recommended), or expose only the profile.
3. The worker's own location: stay on the ~1 km grid (recommended) or move to ~100 m as well.

None of the three blocks the first slice.

## The first slice that "Odobravam implementaciju" authorises

Client only. No migration, no Edge deploy, no new dependency.

1. This record.
2. An editor for the two `TIMESTAMPTZ` facts and the five `TEXT_ARRAY` facts in the review, where
   "Izmeni" used to leave the screen without a word.
3. A pending change proposal shown on the Dogovor with what it changes and a way to answer it.
4. The withdrawal receipt no longer fills in a missing server version with the client's own.
5. "Sačuvaj nacrt" once the required facts are confirmed, through the existing
   `rpc_save_need_draft_from_review`.
6. The basis of every price said in words: a task's budget is for the whole task, an application's
   price is the total for the people it brings.
7. Owner actions on a task follow ownership of that task, not the mode the app happens to be in.

The second slice (stable tabs, Početna, the role removed from the cache guards) and the third (the
grid migration and bounded reads) each need their own word from the owner.
