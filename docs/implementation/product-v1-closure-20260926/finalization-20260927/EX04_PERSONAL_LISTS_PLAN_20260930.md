# EX-04 Posao (P2) — canonical scope (checked 2026-10-01) and its first open row: personal lists

**Status (2026-10-01): SCOPE ALIGNED TO THE CANONICAL SOURCES; NO SERVER OR CLIENT CHANGE YET, NOTHING APPLIED.** The owner asked for a canonical check before any EX-04 work ("Ne želim da EX-04 proširuješ po pretpostavci"). The plan of 2026-09-30 below is kept as history; where section 5 says it is superseded, section 5 and 6 win. EX-04 is recorded in the existing registry rows (LIVE plan §5.4: "Izlaz se beleži u postojećim kontrolnim redovima"), not in a new tracker: `docs/control/redovi.json` → `finalization.ex04`.

## 1. What EX-04 is, from the canonical sources
| Source | Text |
| --- | --- |
| LIVE Master Plan §5.4 (work packages) | "**EX-04 Posao** — Šta se predaje: B09 authority, projekcije, pun P2 lifecycle. Preduslov: funkcionalne promene + odobren UI zajedno. Merilo: oba učesnika završavaju posao i oporavak." "Oznake EX su samo radne celine unutar postojećeg plana, ne novi tracker." |
| LIVE plan chapter 9 (P2 — završiti ceo posao između dve osobe) | 9.1 Home, personal lists and the order of facts; 9.2 offer, fixed price, selection; 9.3 changes, cancellation, completion, ratings. |
| LIVE plan §6.7 | "Jedan zbirni Home broj ne sme zavisiti od cele istorije ocena; paginated lične liste moraju sačuvati cenu, selectable counts, redosled, remote i krajnji datum." |
| Runbook P2 + Appendix A | "Cover A01/A08–A16/B06–B12/D01–D13 with explicit state scenarios, not one reused happy-path screenshot." Home: do not "fetch full completed history to draw a badge". |
| P6 closure receipt | **L7**: A09 / A11 / B10 personal lists are read whole by the client; "explicit next row EX-04, not P6 scope by the owner's decision (ii)". **L10**: RC-03 ratings reads on Home / Agreements are mitigated, not aggregated; "P2 package". |
| Owner directive 2026-09-30, point 4 (as recorded in the session memory, not his verbatim words) | "Personal lists without client paging are NOT finished (A09, B10, A11) … carry them as an EXPLICIT open next row (EX-04/P2), never as done." |
| Independent audit 2026-09-24 | **RC-03**: reading Agreements starts one review RPC per completed Agreement; one stalled review can withhold the list / Home section. F08: the own-task page projection lacks facts the card needs. |

**Why two names.** "Posao" is the name of the whole package (§5.4). "Lične liste" is the label of ONE open row inside it, the one the owner told us to carry (directive point 4; L7). The registry, the P6 receipt and AGENTS.md use "EX-04" for that row; the 2026-09-30 plan and the receipts of 2026-10-01 ("EX-04 Posao / personal lists") blurred the two. Personal lists are the first slice, not the definition.

## 2. Flows (27 rows tagged P2 in `docs/control/redovi.json`)
A01 Početna · A08 Moj zadatak (detalj) · A09 Moji zadaci · A10 Pitanja o mom zadatku · A11 Prijave i poređenje · A12 Izbor prijave → Dogovor · A13 Izmena zadatka · A14 Otkaži zadatak / obriši nacrt · A15 Zatvori preostalu potragu · A16 HITNO · B06 Detalj prilike · B07 Pitanje pre ponude · B08 Javni profil i ugled · B09 Pošalji ponudu · B10 Moje prijave · B11 Izmeni / povuci ponudu · B12 Raspored · D01 Lista Dogovora · D02 Dogovor · D06 Izmene Dogovora · D07 Otkaži Dogovor · D08 Kontakt i tačna adresa · D09 Prijavi problem · D10 Završio sam · D11 Potvrdi završetak · D12 Ocena · D13 Koraci napretka. (The runbook's exit range also names D03–D05; the registry tags those P3/P4, so they belong to EX-05.)

## 3. In and out of EX-04
| Item | In EX-04? | Basis |
| --- | --- | --- |
| A09 Moji zadaci paging (price basis, selectable count, tabs, scroll) | **Yes, explicit** | A09 card, L7 |
| B10 Moje prijave paging (remote, end date, order, attention) | **Yes, explicit** | B10 card, L7 |
| A11 candidates, bounded or paged | **Yes, explicit** (no paged RPC exists) | A11 card, L7 |
| RC-03: aggregated ratings projection for Home (A01) and the Agreements list (D01) | **Yes, explicit** | A01 card ("dopuni postojeću serversku projekciju … bounded agregatom"), L10, audit RC-03 |
| `rpc_home_summary()` as a named new RPC | **No** — it is in no canonical source; it was this plan's own mechanism (withdrawn, section 5) | — |
| B09 server price authority (PKG-049) | **Yes, but an owner gate**: "Serverski predlog PKG-049 (cena u MY_PRICE režimu) čeka tvoje odobrenje"; §9.2: "Ovaj plan ne izmišlja novu politiku cene" | registry B09, Round 35, §9.2 |
| Lifecycle rows A08, A10, A12–A16, B06–B08, B11, B12, D01, D02, D06–D13 | **Yes**, as state scenarios and the two-account proof; new code only for a reproduced hole | §9.3, runbook P2 exit |
| D12 star rating | **Yes** | D12 row |
| D12 written comment | **No** — "zaseban server/privacy/moderation ugovor i odvojeno prihvatanje" (§9.3; D12 row) | §9.3 |
| Agreements list paging (D01) | Already done in P6 (`rpc_list_my_agreements_page` is wired) | P6 round73 |
| "Sačuvani zadaci" | **No** — no such flow exists among the 62 rows or in the plan ("sačuvan zadatak" there means a persisted task) | registry, plan |
| Inbox P01, messages D03–D05, blocked list N06, reminders P05 | **No** — EX-05 / EX-07 | registry priorities |

## 4. DONE
- **Package** (§5.4): both participants finish the job and recover. **§9.3**: "odobreni dvonaložni scenario prolazi novim zajedničkim kandidatom, uključujući konkurentnost, izmene, terminalna stanja i oporavak. Već dokazani source delovi ostaju, a novi kod se piše samo za stvarno reprodukovanu rupu." **Runbook exit**: both roles understand current truth and next action; routes keep context; accepted terms cannot be overwritten by later draft edits; concurrent and terminal cases fail and recover correctly.
- **Per flow** ("DONE samo za ovaj tok"): A09 — the list is bounded, the card semantically the same, cursor and native return stable. B10 — the paged list shows the complete real facts in the intended order and keeps context. A11 — the comparison leads to the exact confirmation without lost context, a false status or unbounded reads. A01 — the first usable Home and the real attention work without N+1 history, with a kept position and a bounded native proof.
- Each of these includes native evidence. Source, CI and a disposable proof are only the first levels (LIVE §4.2: SOURCE → CI-PROVEN → DEV-APPLIED → CLIENT-WIRED → DEVICE-PROVEN → RELEASE-READY).

## 5. Where the 2026-09-30 plan disagrees with the canonical sources (corrected here, nothing invented)
1. **Scope wording.** The plan covered only the personal-lists slice and was titled as if it were EX-04. Corrected: it is the first slice; B09 authority and the lifecycle are carried explicitly in section 3.
2. **`rpc_home_summary()` is withdrawn as a named deliverable.** The canonical Home item is RC-03 (aggregated ratings projection) through the EXISTING projection. `rpc_home_attention()` already returns bounded server counts (`ownActiveTasks`, `activeApplications`, `activeAgreements`, `activities`); what Home still reads whole is the three lists (for the front-door counts and the next accepted Agreement) and the Agreements pages plus one review check per completed Agreement (for the ratings-due count). Whatever Home needs beyond that is added to the existing projection only if the proof shows it is needed, never as a new dashboard.
3. **B10 order.** The registry recorded two ways (server keyset by attention, time, id; or an app-side "waits for you" section) as a PROPOSAL ("Predlažem (2)"). The plan called it a decision. It is not an owner decision; the implementing team chooses within the canonical wording, and the choice is proven (section 6, S2).
4. **Contracts completed in place.** The cards say "dopuni postojeću projekciju". The plan's new function names (`rpc_list_my_tasks_page`) are replaced by completing `rpc_list_my_needs_page` and `rpc_list_my_applications_page` in place: neither has a caller on DEV or in `src/`, so no client can regress.

## 6. Aligned order of work (design choices of the implementing team inside the canonical wording; every server candidate is proven on a disposable database before any DEV word)
- **S1 — A09.** Complete `rpc_list_my_needs_page` so that each item IS the `rpc_read_task` document (the builder `rpc_list_my_tasks` already uses: the card, the price basis and the selectable count cannot drift) plus `sortAt`; scopes for the tabs Aktivni / Nacrti / Istorija; keyset `(created_at, id)`, limit ≤ 100. Client: a cursor owner (the Discovery owner pattern), "Prikaži još" with the existing components, account/focus/stale-page fencing, tab and scroll kept (A09 card checks). `rpc_list_my_tasks` stays for old builds. The client is not wired before the server has the contract (build flag, default off).
- **S2 — B10.** Complete `rpc_list_my_applications_page` with the facts the old projection carries (remote mode, end date, price basis, people), reusing its builder; order and attention decided and proven for duplicates and skips between pages; no new server status "radi dizajnerskog segmenta" (B10 card). Client: one cursor owner per set or tab, scroll and exact application detail kept after Back.
- **S3 — RC-03 (A01, D01).** Put the rating state in the existing Agreements page items and the ratings-due count (and its single id) and the next accepted Agreement in the existing `rpc_home_attention` answer, so Home and the Agreements list stop making one review call per completed Agreement and stop walking all pages. Request-count and stalled-read tests for 0, 1 and a long history (A01 card). Additive fields only.
- **S4 — A11.** Decide, from what the comparison screen shows at once, between a paged reader and an explicit cap stated in the contract (never silent). Last, because candidates per task are bounded by that task's applications (P6 round73).
- **Boundary order for each:** disposable proof (fails before, passes after; old callers untouched; ACL, security and the certificate digest asserted unchanged) → receipt → **the owner's `PRIMENI`** → DEV application with the integrity guard → client flag on → native check (HONOR only in his window; the AVD is secondary).

## 7. Owner gates that stay his (none blocks S1–S4 source work)
1. `PRIMENI` for every DEV application. 2. **B09 / PKG-049** — whether the server must enforce the requester's fixed price (§9.2: this plan does not invent a price policy). 3. **D12 written comment** — a separate server/privacy/moderation package with its own acceptance. 4. The HONOR window for native evidence. 5. UI: EX-04's precondition says functional changes and an approved UI go together; this slice changes behaviour only (a "Prikaži još" footer and retry in the existing styles) and leaves the TaskCard / Peek design untouched, as ordered.

---

## Original plan of 2026-09-30 (kept as history; superseded where section 5 says so)

Status: **PLAN ONLY. No server or client change, nothing applied.** Owner directive (2026-09-30, point 4): personal lists without client paging are NOT finished; carry them as an explicit open row (EX-04 / P2), never as done. Registry rows A09 (Moji zadaci), A11 (candidates) and B10 (Moje prijave), and the open note RC-03 on A01 (Home).

## What the client reads today (read in source, 2026-09-30)
| Screen | Reader | Shape | Used for |
| --- | --- | --- | --- |
| Home (`src/app/(app)/index.tsx`) | `mojePotrebe`, `mojePrijave`, `mojiDogovori` all whole, plus the bounded `rpc_home_attention` | full lists | task counts (`ownedTaskCounts`), application counts (`applicationCounts`), the next Agreement (an accepted FUTURE start across ALL active Agreements), the ratings-due count and its single id (`composeHome`, `src/data/homeSnapshot.ts`) |
| Moji zadaci (`src/app/(app)/potrebe.tsx`) | `rpc_list_my_tasks` | `jsonb_agg(rpc_read_task(n.id))` for every own task | the list, its sections and the attention filter |
| Moje prijave (`src/app/(app)/moje-prijave.tsx`, also the offer screen) | `rpc_list_my_applications` | every own application | the list, its tabs, the exact-row reconciliation of a pending command |
| Candidates of one task | `rpc_list_need_candidates(p_need_id)` | every candidate of that task, each with `rpc_get_public_profile` and the application evidence | comparison and selection |

The comment in `homeSnapshot.ts` already says it: the counts and the next Agreement still need complete lists; limiting the reads would lose ordering and totals; attention integration alone does not make them bounded.

## What exists on DEV (read-only, ledger 213)
- `rpc_list_my_needs_page(scope, limit, before_at, before_id)` and `rpc_list_my_applications_page(...)` since PKG-023a (keyset `(created_at, id)`, `{items, hasMore, asOf}`, scope ALL | ACTIVE | HISTORY), `rpc_list_my_agreements_page`, `rpc_list_inbox`. No client calls the first two.
- The needs page restates the pre-PKG-045 table columns by hand (no price basis, no selectable-application count): a swap would break the task card (registry A09). `rpc_list_my_tasks` is the contract the client decodes (`rpc_read_task` per task).
- The applications page has the same card fields and the same state function, but a strict newest-first order, while the current read lifts "what waits for me" to the top; it also lacks Na daljinu and the end date (registry B10, R18-E03).
- `rpc_list_need_candidates` has no paging and no limit.

## Plan (each step test-first; every server candidate proven on a disposable database before any DEV word)
1. **`rpc_home_summary()` (additive, read-only, no certificate move).** One bounded answer: own task counts {total, active, waiting, drafts, history}, application counts {total, attention, active, finished}, the next Agreement (id and the accepted start, chosen by the same rule as `composeHome`), the ratings-due count with the single id when there is exactly one, and an explicit `unknown` for a rating check that cannot be answered. Each rule is stated once in SQL from the same server functions that produce the row fields (selectable-application classifier of PKG-035, `private.my_application_state`), and **proven equal to the TypeScript rules over a mixed dataset** (the P6 parity method). Home then reads the summary plus the one Agreement it names, and keeps the existing `rpc_home_attention`.
2. **`rpc_list_my_tasks_page(scope, limit, before_at, before_id)` (additive).** Items are exactly the `rpc_read_task` document (so `mapNeed` and the card stay unchanged) plus `sortAt`; scopes ALL | ACTIVE | DRAFTS | HISTORY | WAITING (waiting = the `hasNeedAttention` rule), because the list's own sections are the same sets the Home counts name.
3. **Moje prijave:** decision already recorded in B10: a short "waits for you" section from the server attention flag above, and below it the paged list; the page gains Na daljinu and the end date as an additive contract (`rpc_list_my_applications_page` stays as it is, a v2 is added). The reconciliation of a pending command already reads its exact owned row and does not depend on the displayed list (APPLICATION_COMMAND_RECONCILIATION_20260920).
4. **Candidates:** a paged, bounded reader only after the comparison screen says how many candidates it must show at once (it compares them side by side); until then the unpaged reader stays and its row count is capped by a stated limit in the contract, never silently.
5. **Client:** services with a cursor and an account/focus-fenced owner (the Discovery owner pattern), "Prikaži još" at the list end, stale-page fencing, unknown-outcome and empty states kept; Home without the three whole reads.
6. **Order of work:** (1) first, because it removes the Home reads that run on every focus; then (2), then (3). Candidate SQL and proof workflow first, client after the owner's "primeni" for that candidate (the client can be written against the proven contract but is not wired before the server has it).

## Owner gates
Each candidate needs his separate "primeni" for DEV. No dependency, no certificate change, no payment, no change of the card or map design. The two SQL readers above are additive, SECURITY DEFINER with the same own-account predicate as `rpc_list_my_tasks`, executable by `authenticated` only.

## Not claimed
Nothing here is measured. The row counts on DEV are tiny (a handful of tasks), so the benefit is scale readiness, not a speed-up today; it must be measured on a seeded disposable database before any claim.
