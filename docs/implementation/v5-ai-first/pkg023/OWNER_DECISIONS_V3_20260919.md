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
| 2 | A task's budget is the total for the whole task. An application's price is the total for the people that application brings. The budget is **advisory**, not a hard cap. | True for "Tražim ponude": `price_rsd` sits beside `covered_slots` in responses and in `agreement_versions.terms`, nothing multiplies or divides a price, and `rpc_select_response` has no budget rule, so that side is copy only. **Not true for "Moja cena" with more than one place:** `rpc_submit_response` raises `FIXED_PRICE_MISMATCH` unless every application carries exactly the task's price, whatever number of people it brings. Found while doing the copy on 2026-09-19, after the forensic review had called the whole decision copy-only; see open question 4. |
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

## The four questions put to the owner on 2026-09-19 — answered the same day

1. Tasks already published when the grid changes: stay on the old point until their place changes
   (recommended), or be recomputed once.
2. The public task row carries the requester's account id, which with a ~100 m pin makes it easier
   to tie several tasks to one house: accept for the first phase and record the risk
   (recommended), or expose only the profile.
3. The worker's own location: stay on the ~1 km grid (recommended) or move to ~100 m as well.
4. "Moja cena" on a task that needs more than one person. Today the engine makes each application
   carry the task's full price, so choosing a team of two and then one more person makes two
   Dogovori at the full price each. Decision 2 says the task's price is for the whole task. The two
   cannot both hold. Either a fixed price is offered only on one-person tasks and tasks for more
   people ask for offers (recommended: no engine change, and every published multi-person task on
   canonical DEV is already "Tražim ponude"), or the engine lets a partial application name its own
   total under a fixed-price task, which is a forward migration of `rpc_submit_response`.

**Answered 2026-09-19.** After the second slice's report repeated the four questions, each with its
recommendation, the owner wrote "Prihvatiću tvoje predloge". The recommended answer stands for each:

1. Tasks already published stay on the old point until their place changes. Nothing is recomputed.
2. The requester's account id stays in the public task row for the first phase. The risk is
   recorded here: with a ~100 m pin, several tasks of one account can be tied to one house.
3. The worker's own location stays on the ~1 km grid.
4. A fixed price ("Moja cena") is offered only on a task for one person; a task for more people asks
   for offers. No engine change: `rpc_submit_response` keeps FIXED_PRICE_MISMATCH as it is.

These are answers, not an approval to build. The third slice still needs the owner's own word, and
its two backend parts are forward migrations on canonical DEV.

## Recorded for a later slice — a place said in the AI conversation (owner, 2026-09-19)

Recorded on the owner's instruction while the second slice was in progress. **Not part of the second
slice and not to be implemented until an AI/location slice is approved.**

When a person says a concrete enough place in the AI conversation, by text or by voice — for example
"Bulevar oslobođenja 78, Novi Sad":

1. the address is taken from the conversation;
2. the geocoder finds a candidate place;
3. if the result is unambiguous enough, the same AI flow shows the address with a small map preview
   and pin;
4. the person confirms the place deliberately, by a tap or by a clear spoken confirmation;
5. if there are several possible results, or the person is not satisfied, the flow shows the
   candidates or "Izaberi na mapi";
6. the full-screen map is for a precise choice or for moving the pin when that is needed;
7. after "Potvrdi mesto" the person returns to the same AI conversation with its context kept;
8. for a point-to-point task the same holds separately for the start and for the destination;
9. the AI and the geocoder may propose a place, and may never mark it confirmed without the
   person's explicit confirmation;
10. the exact place stays private; the public projection uses the approved approximate place.

The voice flow stays hold and speak → release → editable transcript → Pošalji. The one exception is
a clearly defined local confirmation such as "Da, to je ta lokacija", which may confirm a candidate
already on screen, if that can be bound safely to the exact location slot and revision.

## The first slice that "Odobravam implementaciju" authorises

Client only. No migration, no Edge deploy, no new dependency.

1. This record.
2. An editor for the two `TIMESTAMPTZ` facts and the five `TEXT_ARRAY` facts in the review, where
   "Izmeni" used to leave the screen without a word.
3. A pending change proposal shown on the Dogovor with what it changes and a way to answer it.
4. The withdrawal receipt no longer fills in a missing server version with the client's own.
5. "Sačuvaj nacrt" when the review can be accepted, by accepting the displayed review and stopping
   before evaluation (`rpc_accept_ai_task_review`, which is what writes the DRAFT). The standalone
   `rpc_save_need_draft_from_review` is not the route: it refuses facts not yet CONFIRMED, and
   confirming them is what acceptance does.
6. The basis of every price on the applying side said in words: an application's price is the total
   for the people it brings. The task side waits for open question 4.
7. Owner actions on a task follow ownership of that task, not the mode the app happens to be in.

The second slice (stable tabs, Početna, the role removed from the cache guards) and the third (the
grid migration and bounded reads) each need their own word from the owner.

## The second slice — "ODOBRENJE ZA DRUGI ZAHVAT" (owner, 2026-09-19)

Client only, again: no migration, no Edge function, no dependency, no RPC signature touched.

**What the global mode was.** A client-only value (`src/store/uloga.ts`, persisted per account by
`accountIntentPreference.ts`). The server has never had a notion of it: no function, policy or
column reads it. It had 180 references in 50 production files, in five kinds:

| Kind | Where | What became of it |
| --- | --- | --- |
| A. a term in a staleness guard | `useFocusedResource`, `useOwnedEditor`, `useAgreementOutbox`, `useAgreementPhotos` and about thirty screens | Removed. Account id, `accountRevision`, session epoch, source, focus and app state still fence every read and write, and `forget()` is unchanged. |
| B. shell and navigation | `(app)/_layout`, `(app)/index`, root `_layout`, `sesija.ts`, `obavestenja`, `prilike`, `profil`, `potrebe`, `potrebe/[id]/pregled` | Replaced by one static shell and by destinations. A notification or a deep link opens its object; nothing is switched first. |
| C. presentation and permission | `dostupnost`, `raspored`, `dogovori`, `profil`, `pitanja-zadatka`, `prilike/[id]`, the v2 presentations | Replaced by the relation to the object: ownership from my own tasks, application from my own applications, the side from the Dogovor's own participants. |
| D. fake source | `lazniIzvor.ts` | A constant. The fake source is reachable only under its explicit flag or Jest. |
| E. server-side role filter | `rpc_list_inbox`, `rpc_mark_inbox_read`, the two notification preference sets | **Kept.** These are a filter the person chooses and two real server-side sets, not a mode. The inbox filter is local to that screen ("Sve", "Moji zadaci", "Moje prijave"); the settings screen chooses the set locally. |

Nothing sets a mode, waits for one and sets it back. `accountIntentPreference.ts`,
`CrossIntentNotice.tsx` and `IntentTransition.tsx` are deleted. A record an older build left under
`uskoci:account-intent:v1:*` is neither read nor rewritten. `src/store/__tests__/v3-no-global-mode.test.ts`
fails if any of this returns.

**The shell.** `Početna | Mapa | Dogovori`, static, not keyed, `backBehavior="history"` so Back
returns to where the person came from. Every earlier destination still answers its URL, only no
longer as a tab: `/potrebe`, `/moje-prijave`, `/prilike`, `/pregled-nacrta`, `/mesto-zadatka`
inside the shell, and `/prijave` beside it.

**Početna v1** is composed in `src/data/homeSnapshot.ts` from three reads that already existed —
`mojePotrebe`, `mojePrijave`, `mojiDogovori` — and the inbox bell's own unread count. Each read is
bounded at 15 s and fails on its own: a section that did not load says so and offers the read again,
and three failed reads are a failed screen, never an empty account. No total is shown that was not
counted; a row only navigates, to the exact task, candidates list, application or Dogovor.

**Moje aktivnosti** is the same three reads with the filters Sve / Objavio sam / Prijavio sam se and
Aktivno / Istorija. **Dogovori** is one list for both sides, each row saying "Objavio si" or
"Uskočio si". **Mapa** and the list under it label "Tvoj zadatak" and "Prijava poslata" from
`src/data/taskRelation.ts`; a task I own offers my view of it, one I applied to offers my
application or my Dogovor, and a relation that could not be read is never a licence to apply.
**Profil** is one hub: identity and "Kako mogu da uskočim" side by side, no switch.

### What the second slice had to leave, with the evidence — input to the third

1. `mojePotrebe`, `mojePrijave` and `mojiDogovori` return whole lists. Početna and the relation
   labels read all of it to show five rows. A bounded, paged read needs a new RPC (READ_CONTRACT).
2. The relation of one task costs two whole lists. A per-task reader needs a server read.
3. The Dogovor list row has no start instant and no `actionState`, so Početna orders Dogovori as
   the server returns them and cannot show a pending change proposal; only the Dogovor itself can.
4. ~~"Naručilac" and "Uskočer" in user-facing copy.~~ Done in the first part of the third slice.
5. ~~Eight test files with an inert `mockIntent`/`mockRole`.~~ Done in the same part.

## The third slice, first part — steps 1 and 2 only (owner, 2026-09-19)

Asked how far "Prihvatiću tvoje predloge" reaches, the owner chose "Samo koraci 1 i 2": no database
change, no Edge function, no deploy. Steps 3 (bounded reads) and 4 (the ~100 m grid) are forward
migrations on canonical DEV and wait for a separate word with an exact plan.

**Step 1 — PKG-010 had been red on every head since 2026-09-17.** Two layers, found one after the
other because the first hid the second:

- `supabase/proofs/pre_v3/v5_self_reported_identity_proof.mjs` still asserted the Gemini wire from
  before `dda5513f` (2026-09-16): its loopback provider stub read
  `generationConfig.responseFormat.text`, threw inside `fetch`, and the handler reported a provider
  failure (`ACTUAL_EDIT_EDGE_502_AI_PROVIDER_FAILED`). The stub now asserts the documented
  `responseMimeType` / `responseSchema` wire; the proof passes with 11 checks (run 35439383767).
- With the chain through, the next step ran for the first time since 18.09 and ten cases of
  `supabase/proofs/ai/ai_edge_context.test.mjs` fail. **These tests are right and were not changed.**
  `169ce727` (2026-09-18) made the handler log a cause beside `AI_PROVIDER_FAILED`, as
  `providerError.message`. For our own thrown names that is a closed vocabulary. For a runtime error
  it is not: when the provider answers with something that is not JSON, the log line is
  `Unexpected token 'P', "PRIVATE_PR"... is not valid JSON` — the first ten characters of the raw
  provider output, which is what "logs fixed categories only" exists to forbid. The same line is in
  the deployed `uskoci-ai-interview` v40 on canonical DEV (deployed 2026-09-18 20:55 UTC, read back
  on 2026-09-19). Function logs are visible to project members only and the snippet is ten
  characters, so the exposure is small; the rule is still broken and PKG-010 stays red until it is
  fixed. The fix is three lines in the Edge function (log the message only when it matches our own
  `^[A-Z][A-Z0-9_]+$` names or is an HTTP status, otherwise the error's `name`), the ten expectations
  updated to the category they now receive, and a redeploy. An Edge function and a deploy are outside
  what was approved, so the item stops here with this evidence.

## The Edge fix — "EDGE FIX — ODOBRENO" (owner, 2026-09-19)

The owner approved the fix of the logging defect, its tests, a deploy to canonical DEV as v41, a
readback and a PKG-010 rerun; and ruled that no part of a raw provider response may be logged, that
a truncation limit or a mask is not a fix, and that prompt, model, schema and AI behaviour stay as
they are.

- **Source, `130028de`.** One line of `supabase/functions/uskoci-ai-interview/index.ts` logged
  `providerError.message`. It now logs `providerFailureClass(providerError)`: one of the function's
  own 23 thrown names, one of five runtime classes (`OUTPUT_NOT_JSON`, `RUNTIME_TYPE_ERROR`,
  `RUNTIME_RANGE_ERROR`, `ABORTED`, `TIMED_OUT`), or `UNKNOWN`. A thrown text merely shaped like one
  of our names is `UNKNOWN`. Nothing else in the function changed.
- **The exposure was wider than the ten characters first reported.** The proof threw its synthetic
  failures from its own realm, where they fail `instanceof Error` inside the handler's VM and read as
  `UNKNOWN`. Thrown with the handler's own constructors, as a runtime does, the old line logged the
  whole message — in the synthetic case the key, the user's text and the provider output together.
  In production the runtime's messages are what they are (a parse error's snippet, a fetch error's
  URL); the principle, not a particular leak, is what was broken.
- **Tests.** The ten cases assert the exact class; two new cases throw a name-shaped text and a
  runtime `TypeError`; every case asserts that no fragment of the thrown text reaches a log; a source
  case keeps the closed list complete against every `new Error(...)` in the function and its two
  helpers and forbids `.message` / `.stack` in any log call. `supabase/proofs/ai`: 297 of 297. The
  frozen-source manifest is refrozen and names the three commits of 18.09 it absorbs.
- **Deploy.** `uskoci-ai-interview` **v41**, ACTIVE, `verify_jwt` true,
  `ezbr_sha256 48491ea3210c8861b01e141f7d15a83aeb0c814eecd66d5b6237fc119a5eb8dc`, deployed through
  the Supabase connector (no CLI token exists in this environment). Readback against `130028de`:
  `index.ts`, `needFactsV2.ts` and `aiTestBudget.ts` are byte-identical. **`_shared/geminiTaskStream.ts`
  differs in one line, 34**, a file this fix did not touch: the connector's transport turned the
  regex text `\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f` into the characters those escapes
  denote (15 102 bytes deployed against 15 137 committed). The character class is the same set, and
  `assistantPrefix` behaves identically for all 63 488 non-surrogate code points, which was run. v40
  had been deployed with the CLI and was byte-identical in all four files; byte identity returns
  with the next CLI deploy (`npx supabase functions deploy uskoci-ai-interview --project-ref
  leqcwgzvjsxugfgzdmth --use-api`), which only the owner can run. The function boots: `OPTIONS`
  answers 200 with the handler's own CORS header list; no authenticated or paid call was made.
- **PKG-010 is green** on `130028de`, run 35441972130, every step — the first green since 2026-09-16.

**CodeQL — recorded debt, not touched (owner, 2026-09-19).** The PR check reports six alerts, five
high and one medium, in code from 2026-09-13; none comes from the V3 slices. The remedy needs a
secure random source (`expo-crypto`), and no dependency is added for it now. It belongs to a separate
security / dependency slice.

**The backend part of the third slice is a plan, not a change:**
`docs/implementation/v5-ai-first/pkg023/V3_SLICE3_MIGRATION_PLAN_20260919.md`. Nothing in it is
applied until the owner approves it, and then approves the apply separately.

**Step 2 — no text the app can show names an internal side of a task.** 42 lines in 17 production
files; a person is told what they did ("Ti · objavio si zadatak", "Ti · uskočio si"), what the other
person did ("Objavio zadatak", "Uskočio"), or "druga strana" of this Dogovor.
`src/data/__tests__/v3-copy-no-internal-sides.test.ts` scans every production module. Texts the
server composes (inbox event titles) were not read for this and are not covered by that scan.
