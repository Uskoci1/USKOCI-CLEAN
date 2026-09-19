# V3 third slice, backend part — migration PLAN, third version (2026-09-19)

**Status, evening of 2026-09-19: `pkg023a`, `pkg023b` and `pkg023d` ARE APPLIED to canonical DEV**, on the
owner's word ("PKG023 A / B / D — DEV PRIMENA ODOBRENA"), in that order, each after a read-only preflight and
followed by a readback; the receipts are section 14. **`pkg023c` is NOT applied and stays on HOLD.** The
closure source digest was forensically reviewed and a re-certification candidate was written and proven on a
disposable database; **it is NOT applied** and waits for the owner's review (section 15 and
`CLOSURE_FORENSIC_REVIEW_20260919.md`). No price change exists anywhere; section 8 carries the owner's TOTAL
decision and the read-only finding about the installed APK.

What follows below this block is the second version, corrected where today's facts changed it.

**Status of the second version, earlier the same day: NOTHING WAS APPLIED TO CANONICAL DEV.** The owner approved the first version of this plan
"u osnovi" and approved writing the candidate SQL and its proofs on an isolated database, asked for
four additions and a paging proof, and then, mid-work, re-opened the price model. This version carries
all of that. The candidates exist in `supabase/candidates/pkg023*.sql` and are proven only by
`.github/workflows/pkg023-v3-reads-and-pin-proof.yml` on a disposable database. Applying any of them
needs the owner's separate word.

Every fact below was read from canonical DEV `leqcwgzvjsxugfgzdmth` with read-only catalog queries on
2026-09-19, or from the committed tree.

## 0. One finding that changes the plan: the closure source digest

`private.closure_schema_digest_v5_139()` hashes **every column, constraint and trigger (with the md5 of
its function) of every table** in `public` and `private`; `private.closure_erasure_program_digest_v5()`
hashes the erasure program, `closure_redaction_patch_v5` included; `private.closure_source_digest_v5()`
combines them; `private.closure_source_v5.sha256` and a constant inside
`private.retention_ai_source_ready()` pin the result. Account erasure and AI retention report "ready"
only while the pin matches. Source migrations 145–147 re-bind the pin in the same transaction as their
schema change, from a predecessor they first verify is ready.

- **On canonical DEV the pin has not matched since 2026-09-17.** Live digest `ac50680b…`, pinned
  `68ae9916…`, `retention_ai_source_ready()` = **false**, zero closure executions. The `dev_alpha`
  migrations of that day created and altered tables (`pkg015`, `pkg014b`, `pkg019b`–`d`) and none of them
  re-bound the pin. On 2026-09-16 (PKG-014) it was true. This was recorded nowhere.
- A candidate that only adds functions and plain indexes does not move the digest. `pkg023a`, `b` and
  `d` are of that kind, and each proves it on itself: it raises if the digest is different after it.
- **Any new column on `needs`, any changed trigger function, any change to the erasure patch moves it.**
  That is `pkg023c` (the ~100 m pin) and any price-basis column. Such a candidate has to re-bind, and a
  re-bind is only honest from a ready predecessor. `pkg023c` does exactly what migration 145 does, and
  therefore **refuses to run on DEV today** (`PKG023C_CLOSURE_SOURCE_NOT_READY`) rather than certify, in
  passing, schema changes it did not make.
- Prerequisite for `pkg023c` and for a price basis on DEV: a separate, reviewed **re-certification of
  the 17.09 drift** — do the new tables (`account_lineage_v5`, `ai_test_usage_v5`, the altered
  `ai_test_reservations_v5`) hold anything account erasure must cover — and only then a re-bind. That
  review is a privacy decision, not a formality, and it is not part of this plan.

Related, also unrecorded until now: the SQL of three live DEV migrations — `pkg015b_gap0042_world_boundary`,
`pkg019c_failed_reservation_release`, `pkg019d_stt_audio_duration_settlement` — is in the live ledger's
`statements` and in no file under `supabase/candidates/`.

## 1. How a DEV migration is made here (existing procedure, unchanged)

`supabase/migrations/` is the frozen source-147 inventory. A DEV change is a candidate file with a
preflight that checks the md5 of every live body it replaces, applied as `dev_alpha_pkgNNN_*`, proven
on a disposable database first. The DEV ledger was 157 rows (147 source + 10 `dev_alpha`) before this slice and is
**160 rows (147 + 13) after it**. The exact text of all 13 `dev_alpha` rows, byte for byte as the database recorded it,
is now in the repository: `supabase/operations/dev-alpha/ledger/` with `LEDGER_MANIFEST.json`.

## 2. The candidates

| Candidate | Covers | Touches existing objects | Closure digest | DEV |
| --- | --- | --- | --- | --- |
| `pkg023a_own_reads_paged.sql` | A + C | no | unchanged, self-asserted | **APPLIED 2026-09-19**, ledger `20260919141813` |
| `pkg023b_task_relations.sql` | B | no | unchanged, self-asserted | **APPLIED 2026-09-19**, ledger `20260919142333` |
| `pkg023d_marketplace_bounded.sql` | owner addition 1, and 3 | no | unchanged, self-asserted | **APPLIED 2026-09-19**, ledger `20260919142713` |
| `pkg023c_public_pin_100m.sql` | D, owner addition 4 | 9 bodies + 2 columns | re-bound from a ready predecessor | **HOLD** (section 0); no old task is backfilled |
| `pkg023f_closure_recertification.sql` | the 17.09 closure drift | one constant, one catalog row | re-bound only if the reviewed additions are the only change | **NOT APPLIED — owner reviews first** (section 15) |
| ~~`pkg023e_price_gate.sql`~~ | ~~owner addition 2~~ | — | — | **withdrawn before it was committed** (section 8) |

## 3. A + C — own reads, paged

Three readers beside the unpaged ones, which stay as they are: `rpc_list_my_needs_page` (SECURITY
INVOKER: it stands on the RLS the direct read stands on today), `rpc_list_my_applications_page` and
`rpc_list_my_agreements_page` (definer, like their siblings, own rows only). One shared private function
for the application state vocabulary. One plain index, `marketplace_responses_worker_idx`: today no index
leads with `worker_account_id`, so "my applications" scans the table. `pendingChange` on the Dogovor page
is C; the start instant was already in `rpc_list_my_agreements` and needs only a client mapping.

Contract, the one `rpc_list_inbox` uses: `p_limit` 1–100 (default 30); `p_before_at` and `p_before_id`
together or not at all, else `INVALID_PAGE`; `p_scope` ∈ `ALL | ACTIVE | HISTORY`, else `INVALID_SCOPE`;
returns `{ items, hasMore, asOf }`, each item carrying `sortAt` and `id`. Execute: `authenticated` only.

### The paging claim, stated exactly

**This is LIVE pagination, not snapshot-consistent paging** (owner's note, 2026-09-19). Every page is read from
the data as it is at that moment. `asOf` says when; it is not a snapshot and nothing is read "as of" it. What
the keyset guarantees is narrower and is exactly this: while the sort value of a row does not change, a row
inserted or removed between two pages neither repeats nor hides another row. For `needs.created_at`
specifically the sort value CAN change (the owner of a DRAFT can rewrite it), and **a change of the sort value
can move that row between refresh cycles**: a not-yet-seen row moved later is missing from the rest of that
walk and appears on the next fresh first page; a seen row moved earlier would be seen twice in that walk. The
client must treat every refresh as a new walk from the first page and must key rows by `id`.

"A row inserted between two pages neither repeats nor hides a row" is true **because the sort key is
immutable and the comparison is a strict keyset**, and for no other reason. `asOf` is when that page
was read; it is returned for display and **does not parameterise later pages and is not a snapshot**.

| List | Sort column | Who can change it | Tie-breaker | If the sort value changed between page 1 and page 2 |
| --- | --- | --- | --- | --- |
| my tasks | `needs.created_at` | No server function writes it after insert. **The owner of a DRAFT can**, through the table UPDATE grant and the owner-DRAFT policy. | `needs.id` | A not-yet-seen row moved later drops out of the rest of that walk and is first in a fresh one; a seen row moved earlier would repeat. It can only happen to that owner's own list, by that owner's own write. The proof records which way the grant behaves and asserts exactly this. |
| my applications | `marketplace_responses.created_at` | Nobody: no client UPDATE path, no server writer. **`submitted_at` is deliberately not used**: `rpc_submit_response` and `rpc_resolve_stale_response_after_need_edit` rewrite it on re-submission. | `marketplace_responses.id` | Cannot happen. The proof rewrites `submitted_at` of an unseen row between pages and the row stays where it was. |
| my Dogovori | `agreements.created_at` | Nobody: there is a column grant but no UPDATE policy, and no server writer. | `agreements.id` | Cannot happen. |
| marketplace | `needs.published_at` | Only `rpc_publish_need_canonical` sets it; `guard_need_write` refuses a client change (`PUBLISHED_AT_IS_SERVER_OWNED`); an edit clears it only after taking the task out of the open set. | `needs.id` | Cannot happen while the task is open. The proof tries as the owner and is refused. |

A row whose *other* fields change between pages (title, status within the scope, slots) is returned once,
with its current values. A row that leaves the scope between pages is simply not returned later; a row
already seen stays on the client until it refreshes. New rows appear only on a fresh first page.

## 4. B — the task relation, as an overlay

`rpc_get_my_task_relations(uuid[])`, 1–100 ids, definer, `authenticated` only. It lists only tasks the
caller owns or has applied to; every other id — unrelated, invisible, or not existing — is absent, and
the three are indistinguishable. It is never part of a public result.

## 5. Owner addition 1 — the marketplace / map read, bounded (`pkg023d`)

Today Mapa and the list read **every** open task: a direct table read, ordered by `created_at`, no limit,
no geography, plus one public-profile call per distinct requester. `rpc_list_open_tasks_v3(p_bbox,
p_filters, p_limit, p_before_at, p_before_id)`:

- **Geographic scope.** `p_bbox {west,south,east,north}`, at most 3° × 5° (about 330 × 390 km here), else
  `INVALID_BBOX`. With a bbox: only tasks with a pin inside it. Without: the list, every open task,
  `REMOTE` ones included.
- **Server hard limit.** 1–200, default 50. There is no way to ask for more.
- **Stable paging.** Keyset on `(published_at, id)`, newest first (table above). On a map `hasMore` means
  "zoom in or fetch the next page"; no server-side clustering in this version.
- **Filter semantics.** `p_filters` may hold only `category` (exact), `priceMode`, `urgentOnly`, `remote`
  (`INCLUDE|ONLY|EXCLUDE`, list mode only), `startsFrom`, `startsTo`; anything else is `INVALID_FILTER`.
  Always applied, as today: `remaining_search_closed_at is null`.
- **Late-response protection on the client** (to be built with the client part): each viewport or
  filter change takes the next number of a per-screen query generation; a response is applied only if
  its generation is still the latest **and** the existing account / `accountRevision` / session-epoch
  fence holds; the previous request is aborted. A page is appended only if it was asked with the cursor
  the list currently ends on. Pure helper + tests, no new dependency.
- **Public-safe allowlist.** Each item is built field by field from a fixed list of keys (28; 29 once
  `pkg023c` adds `legacyPin`); the proof compares the exact key set. No `requester_account_id`, no exact coordinate, no address, no description.
- **Relation overlay, separate.** The result is byte-identical for whoever asks (the proof compares two
  accounts); "Tvoj zadatak" / "Prijava poslata" come from B for the ids of the page.
- **Visibility** is SECURITY INVOKER: the RLS policies that decide it today decide it here, the DEV-only
  same-world boundary included; the function restates none of them and cannot widen them.
- **Old APK.** Untouched: the table read, its grants and policies stay. Retiring them is a separate decision.

**Index.** The existing GiST index `needs_approx_geog_idx` is partial on `status = 'PUBLISHED'`. The open
set is `PUBLISHED` **and** `SELECTION`, which that predicate does not imply, so it **cannot** serve this
reader; the proof shows the plan without the new index. New: `needs_open_geog_idx` (GiST on `approx_geog`,
partial on the open set) and `needs_open_published_idx` (`published_at desc, id desc`, same predicate).
The proof asserts both are used. The viewport is filtered on the coarse point with a 0.01° margin and an
exact numeric re-check, so a task whose fine pin is inside the viewport is not cut off at its edge.

## 6. Owner addition 3 — `requester_account_id` in public

- **Does the V3 public UI use it?** No. The discovery reads never select it; they select
  `requester_profile_id`. Its only client use is the filter of the owner's own list.
- **Does relation logic use it?** No. The client reads its own lists; the new overlay compares it to
  `auth.uid()` on the server and never returns it.
- **Can a public identifier replace it?** Yes, already: `requester_profile_id`, which is what
  `rpc_get_public_profile` takes, and whose answer carries no account id.

So **the V3 reader does not return it**, and the proof asserts neither it nor any account id is in the
result. **HOLD, with the reason:** the column stays readable through the legacy direct table read, because
the installed APK — and today's own-list read — filter on that very column; revoking it breaks both. It
closes when the legacy direct reads are retired, which is its own decision.

## 7. Owner addition 4 — ~100 m, and both client generations (`pkg023c`, HOLD for DEV)

Two nullable columns, `needs.public_lat numeric(7,3)` and `public_lng numeric(8,3)`; **no backfill**.
`approximate_lat/lng numeric(6,2)/(7,2)`, the generated `approx_geog` and its indexes are untouched. The
reason for adding rather than altering: the scale lives in the column type and a generated geography
column stands on the old pair.

- **Exact private location stays the authority.** `need_sensitive.resolved_location` is the one confirmed
  record; `private.materialize_resolved_location` is the only writer of either projection and writes both
  from it in one statement: `round(anchor, 2)` and `round(anchor, 3)`.
- **Old client:** reads `approximate_*` from the table, as today, for old and new tasks alike.
- **V3 client:** `pin` = the ~100 m point where the task has one, else the coarse one, with its
  `precision`; `legacyPin` always the coarse one.
- **Both bound.** The deferred constraint trigger refuses either projection if it is not the projection of
  the record, and refuses a `public_*` that has no record at all (a client can write the columns of its own
  DRAFT through the table grant). Immutable after publication, erased with the account, null for `REMOTE`,
  never taken from a client.
- **Old fingerprint stable, new one binding.** `publicLat/publicLng` enter the fingerprint and the
  material snapshot only where they exist. The proof publishes a task **before** the candidates, records
  its fingerprint, and compares it byte for byte after; and shows the new task's fingerprint carries the
  new point.
- **No client gets the exact coordinate to draw with**: asserted on the wire, and `need_sensitive` stays
  unreadable to a stranger.
- A task that is *edited* returns to DRAFT and is republished as a new revision; its pin is
  re-materialized from the re-confirmed record and then carries both projections. A task nobody edits is
  never touched.
- The worker grid is untouched: `worker_match_preferences numeric(6,2)`, `rpc_save_worker_location` still
  refuses three decimals (asserted). Matching stays on the coarse pair.

The test the owner asked for is section S3 of the proof: NEW LOCATION → old client projection gets the
legacy coarse point → V3 projection gets the ~100 m point → both computed in SQL from the same
`resolved_location` record of the same task.

## 8. Price — the gate is withdrawn; the model is re-opened (PLAN ONLY, nothing written)

The rule "people > 1 ⇒ OFFERS" was drafted as a gate in `need_publication_context` and **withdrawn before
it was committed**, on the owner's update of 2026-09-19. What the owner now wants to be expressible:
`TOTAL`, `PER_PERSON`, `OFFERS`; e.g. 6 people, `PER_PERSON`, 3000 → one slot 3000, three slots 9000,
all six 18000.

**What exists today.**

| Piece | Today |
| --- | --- |
| task | `needs.mode` ∈ `MY_PRICE | OFFERS` (CHECK), `needs.requester_price_rsd`; facts `need.price_mode`, `need.price_rsd` |
| slots | `needs.required_slots`, `needs.covered_slots`; `marketplace_responses.covered_slots` |
| response writer | `rpc_submit_response`: under `MY_PRICE` the application's `price_rsd` must **equal** the task's price, **whatever slots it covers** (`FIXED_PRICE_MISMATCH`). The installed client locks the field to that value. |
| selection | `rpc_select_response` copies the application's `price_rsd` and `covered_slots` into the Agreement terms. **An Agreement amount is the application's amount, a total for that Dogovor.** Nothing multiplies or divides anywhere. |
| fingerprint | `priceMode`, `requesterPriceRsd` are in the publication fingerprint and the material snapshot |
| AI schema | registry keys `need.price_mode` (ENUM) and `need.price_rsd`; the Edge prompt knows `MY_PRICE | OFFERS`; the DB validator chain enforces it |
| installed client | validates a submit receipt strictly: `pricingMode` must be `MY_PRICE` or `OFFERS`, else the receipt is rejected |

So an existing `MY_PRICE` row means: *this exact amount per application / per Dogovor*. For a one-person
task that is at once the total and the per-person price. For a task for several people it is neither —
which is the ambiguity the owner noticed.

**The smallest safe migration.**

1. **A new nullable column `needs.price_basis`**, CHECK `in ('TOTAL','PER_PERSON')`, allowed only with
   `mode = 'MY_PRICE'`. **`NULL` = the existing meaning, exactly as today.** No backfill, no existing row
   reinterpreted. `mode` keeps its two values, because the installed client rejects any third.
2. `rpc_submit_response`, by basis: `NULL` → today's equality, untouched; `PER_PERSON` → `price =
   per-person amount × covered_slots`; `TOTAL` → **decided by the owner on 2026-09-19 ("PRICE BASIS — TOTAL
   ODLUKA"): TOTAL is the price of the whole task. ONE selected application or team must cover ALL
   `people_needed`, and ONE Agreement carries the whole TOTAL amount. There is no proportional split and no
   rounding. A requester who wants to hire people independently uses PER_PERSON. OFFERS stays. Existing
   NULL / legacy price semantics are not reinterpreted.** So under `TOTAL` an application with
   `covered_slots < required_slots` is refused, and its price must equal the total.
3. The application content hash gains `priceBasis` only where it is not null (old hashes unchanged).
   `rpc_select_response` needs **no change**: the terms already carry that application's total.
4. The fingerprint, the material snapshot and the publication context gain `priceBasis` only where it is
   not null (old fingerprints unchanged — the technique section 7 proves); `guard_need_write` adds it to
   the material list; the erasure patch nulls it.
5. A new fact key `need.price_basis` in the shared registry (`src/contracts/needFactsV2.ts`, which is also
   an Edge source), admitted by the validator chain, written by `rpc_save_need_draft_from_review` and
   `rpc_confirm_need_edit_from_review`, seeded by `rpc_ai_open_need_edit_conversation_v2`; the legacy
   scalar edit clears it.
6. Then Edge (the prompt asks "ukupno ili po osobi" when there is more than one person and a fixed price)
   and client (review editor, "3.000 RSD po osobi · 6 osoba · ukupno 18.000", the composer showing the
   computed amount read-only). Both are later stages, each with its own approval.

About twelve function bodies, one column, one Edge deploy, client work. **It moves the closure digest, so
it shares `pkg023c`'s prerequisite (section 0).**

**Installed APK — read-only check, 2026-09-19 (owner: "PRE IMPLEMENTACIJE PER_PERSON PROVERI STARI APK").**
The paragraph that stood here said the old APK "would display 3000 with no po osobi". The owner does not
accept that, and the source shows it is worse than a display problem. For `people_needed = 6`,
`price_basis = PER_PERSON`, `requester_price_rsd = 3000`, `mode = MY_PRICE`, the installed client would:

| Screen | Source | What the person sees |
| --- | --- | --- |
| list / map card | `src/ui/v2/TaskCard.tsx` (`price`, `needPeopleText`) | **"3.000 RSD"** beside "6 osoba" — reads as the task's price |
| task detail | `src/ui/v2/PublicNeedPresentation.tsx` | **"Budžet: 3.000 RSD"**, "Potrebno: 6 osoba" — reads as the total budget |
| application composer | `src/ui/v2/ApplicationSelectionPresentation.tsx` | field **"Ukupna cena za ljude koje dovodiš (RSD)"**, LOCKED to 3000; footer **"3000 RSD ukupno · dolaze 3 osobe"** |
| what it sends | `rpc_submit_response(p_price_rsd = 3000, p_covered_slots = 3)` | today's equality accepts it; `rpc_select_response` copies 3000 into the Agreement: **three people for 3000 instead of 9000** |

There is no client-version mechanism in the backend or the client (none found: no minimum version, no version
header, no forced update). RLS cannot tell an old APK from a new one.

**The safest compatibility plan (recommended; nothing implemented):**

1. **A PER_PERSON amount is never written into the legacy price columns.** A PER_PERSON task is stored, for
   every reader that does not know the basis, as `mode = 'OFFERS'`, `requester_price_rsd = NULL`; the amount
   lives only in new columns (`price_basis = 'PER_PERSON'`, `price_per_person_rsd`). The old APK then shows
   **"Tražim ponude"** on the card, in the detail and in the composer. It can never show "3.000 RSD" as if it
   were the task's total, because it never receives that number.
2. **The server, not the client, decides the amount, and only for a client that showed the basis.**
   `rpc_submit_response` gains one optional argument, `p_acknowledged_price_basis` (default NULL; the old APK's
   call still resolves to the function). For a task whose `price_basis` is not NULL the call is refused unless
   the argument equals the task's basis; then `PER_PERSON` requires `price = per-person × covered_slots` and
   `TOTAL` requires all slots and the total. An old APK can therefore never create an application on such a
   task — it gets a refusal and its generic failure text — and no Agreement with a wrong amount can exist.
   Legacy (NULL basis) tasks behave exactly as today, for both APK generations.
3. **TOTAL needs the same handshake**: the old composer would let one person apply for one of six places at the
   full, locked total. The legacy columns may keep the total (it IS the total, so "18.000 RSD · 6 osoba" is
   true), but the application is refused without the acknowledgement.
4. **Rollout gate: publishing with a basis stays switched off** (the AI does not ask, the review editor does
   not offer it, and the server refuses a non-NULL basis at publication) until the new APK is the one installed
   on every test phone and the owner says so. This is the owner's "odložiti dok novi APK ne bude authority",
   kept as the switch, with 1–3 as the guarantee that a forgotten old APK can neither mislead nor write.

Considered and not recommended: **hiding PER_PERSON tasks from the legacy reader** — the legacy reader is a
direct table read under RLS; RLS cannot know the client version, so this needs either header sniffing in a
policy (spoofable, brittle) or moving visibility into a SECURITY DEFINER reader that restates the rules
(`pkg023d` deliberately restates none); detail screens and dispatch notifications on an old APK would end in
"Zadatak nije dostupan". **A minimum app version**: no such mechanism exists; building one (server gate, client
gate, store of versions) is larger than the price feature and belongs to the production release work.

This costs one more column than the earlier sketch (`price_per_person_rsd`) and one optional argument; the
rest of the list above (fingerprint, facts, Edge, client) is unchanged. It moves the closure digest, so it
still comes after the re-certification and after `pkg023c`'s prerequisite is met. **NOTHING OF THIS IS
IMPLEMENTED.**

**Open inside this model:** `private.dispatch_cheap_candidate_admitted` and
`private.match_detail_without_calendar` compare the task price with the worker's `minimum_fee_rsd`. Under
`PER_PERSON` comparing the unit price is right and needs no change; under `TOTAL` for several people it
overstates. To be decided with 2(a)/(b).

## 9. Compatibility with an installed APK

Everything that is ready for DEV is additive; the old APK calls and reads exactly what it does today.
Signatures untouched: `rpc_list_my_applications()`, `rpc_list_my_agreements()`,
`rpc_get_agreement_workspace`, `rpc_list_inbox`, `rpc_submit_response`, `rpc_select_response`,
`rpc_withdraw_response`, `rpc_accept_ai_task_review`, `rpc_publish_accepted_ai_task_review`,
`rpc_publish_need_canonical`, `rpc_save_worker_location`; and, body only in `pkg023c`,
`rpc_confirm_need_edit`, `rpc_confirm_need_edit_from_review`.

## 10. The tests, which fail first

`pkg023_v3_backend_proof.mjs` runs on the disposable database with real accounts, real RLS, real
PostgREST and the real RPC authority (conversation → review with a confirmed place → accepted draft →
evaluation → publication → application → selection), no provider. The workflow runs it **before** the
candidates, where it must fail, and **after**, where every section must pass; snapshots the whole domain
surface (every function body, grant, column, constraint, trigger, policy, index) and proves a, b, d added
exactly nine lines and changed none, and c changed exactly the eleven functions it names; proves a
candidate cannot be applied twice; and reproduces DEV's drift to show c refusing it.

### Proof status — run 35446129464 on `1a872140`, disposable database, every step green

| Step | Result |
| --- | --- |
| Source-147 predecessor: closure source bound and `retention_ai_source_ready()` true | yes |
| A task with a confirmed place published through the real authority **before** any candidate | done; fingerprint and coarse point recorded |
| The proof **before** the candidates | **FAIL**, as required (`S0`: the objects do not exist) |
| a, b, d applied; whole-surface diff | exactly 9 lines added (6 functions, 3 plain indexes), **0 changed**; closure digest unchanged |
| c applied; whole-surface diff | exactly the 11 functions it names changed (its 9, the re-bound `retention_ai_source_ready`, and the reader of `pkg023d`); 2 columns and 1 constraint added; closure source re-bound and ready |
| The proof **after** the candidates | **PASS**, 6 of 6 sections |
| Re-applying any candidate | refused: `PKG023A/B/D/C_ALREADY_APPLIED` |
| c on a predecessor with an unbound table (DEV's situation, reproduced) | refused: `PKG023C_CLOSURE_SOURCE_NOT_READY` |

Facts the proof recorded rather than assumed:

- **The owner of a DRAFT can rewrite `needs.created_at`** through the table grant. The proof did it between
  two pages: the moved row was absent from the rest of that walk, first in a fresh walk, and no other
  account's list changed. `marketplace_responses.created_at`, `agreements.created_at` and
  `needs.published_at` could not be moved; the last was tried as the owner and refused.
- A re-submission's rewrite of `submitted_at`, done between two pages, moved nothing.
- **The existing GiST index cannot serve the open set.** Without the new indexes the viewport query is a
  sequential scan even with sequential scans disabled. With `needs_open_geog_idx` the viewport condition
  is an index condition (`Index Cond: approx_geog && …`). With `needs_open_published_idx` a list page is
  an ordered index-only scan under a limit, with no sort. On a table of a few rows the planner prefers the
  small btree and filters the geography; that is the planner being right about a small table, and the
  proof records that plan too.
- The public result was byte-identical for two different accounts, held exactly the 29 allowlisted keys,
  and no account id, exact coordinate, `latitudeE6` or `requester_account_id` appeared anywhere in it.
- A task whose only slot was selected left the open set and was no longer advertised.
- Both pins of a new task came from one confirmed record: coarse 45.25 / 19.83 for the legacy read, fine
  45.251 / 19.831 for V3, exact 45.251234 readable by nobody but the owner. Moving either projection away
  from the record raised `LOCATION_BINDING_CHANGED`; a client writing `public_*` on a draft without a
  record was refused; the fingerprint of the task published before the candidates was unchanged to the
  byte and carried no `publicLat`; the erasure patch nulls the new columns; the worker's location still
  refuses a third decimal.
- One defect of the first draft was found by the proof, not by reading: `needs.covered_slots` is not a
  column but the computed field `public.covered_slots(needs)`. Both readers now call it.

Locally on the same tree: Jest 232 suites / 4447 tests, `tsc` clean, the node proof tests 895 of 898 with
the three known CRLF-only local failures that pass on Linux.

## 11. Rollback and fallback

Forward-only. a, b, d: the client falls back to the old readers, which stay for one release; a successor
may drop the new functions. c: the candidate lists the md5 of every previous body; a successor restores
them and leaves the two inert columns. Every preflight raises before anything is applied if a live body
differs from the md5 it was written against.

## 12. Order of promotion on canonical DEV — every step reported, stop on any mismatch

0. The owner approves this version of the plan.
1. Read-only preflight on DEV: the md5 of every predecessor body, the ledger tail, the digest.
2. The owner's explicit word. `pkg023a` → postflight. `pkg023b` → postflight. `pkg023d` → postflight
   (functions, exact grants, indexes used, **digest unchanged**, security advisors).
3. Client: paged readers with fallback, relation overlay, bounded marketplace with the generation gate,
   Dogovori ordered by start. Jest, APK. The old APK works throughout.
4. Separately, and first of all for anything that touches a table: the re-certification of the 17.09
   closure drift. Only after it: `pkg023c`, and later the price basis.
5. Ledger and entry map.

## 13. Open points and new findings

- **New on 2026-09-19 (evening):** the closure forensic review's findings F1–F7
  (`CLOSURE_FORENSIC_REVIEW_20260919.md`): three account-linked tables outside the closure dataset catalog; the
  data export still says `measuredProviderCharge: false` and knows nothing of measured usage or lineage; an
  append-only trigger that would refuse the cascade of a HARD auth delete (closure does a soft one); two
  service functions whose ACL includes `anon` and `authenticated` although their bodies refuse both; policies
  are outside the digest; no account closure could start on DEV since 2026-09-17; and the repository's
  2026-08-25 file of the auth bootstrap function is mis-encoded, so it never was byte for byte what DEV ran.

- The closure digest drift on DEV since 2026-09-17, and the three DEV migrations whose SQL is not in the
  repo (section 0).
- `needs.created_at` is writable by the owner of a DRAFT, and the **legacy public list is ordered by it**:
  a manipulated client could pin its task to the top of today's list. The V3 reader orders by the
  server-owned `published_at`.
- The legacy public list makes one public-profile call per distinct requester; bounded pages bound that too.
- `rpc_confirm_need_edit` (the legacy scalar edit) takes `approximate_lat/lng` from the client. `pkg023c`
  never takes `public_*` from a client.

## 14. Receipts — `pkg023a`, `pkg023b`, `pkg023d` on canonical DEV, 2026-09-19

Order, as the owner set it: read-only preflight → a → readback → b → readback → d → readback. Nothing differed
from what had been proven, so nothing stopped. `pkg023c` was not applied.

**Preflight (read-only).** Ledger 157 rows, newest `20260917230145`; whole domain surface 3179 objects, md5
`482837025aa1aae0b611010279b3222c`; closure digest `ac50680b…`; prerequisites present; no `pkg023` object.
The candidates had been re-proven self-verifying on a disposable database in run 35448018164 on `3e883a50`.

| | a | b | d |
| --- | --- | --- | --- |
| ledger row | `20260919141813 dev_alpha_pkg023a_own_reads_paged` | `20260919142333 dev_alpha_pkg023b_task_relations` | `20260919142713 dev_alpha_pkg023d_marketplace_bounded` |
| ledger rows after | 158 | 159 | 160 |
| recorded text = repo file | sha256 `7e0e518c…`, 20908 chars, identical | sha256 `a0f7f99f…`, 5338 chars, identical | sha256 `f7bc5fe3…`, 14990 chars, identical |
| created | `private.my_application_state` (`236c6c9c…`), `rpc_list_my_needs_page` (`efb30525…`, INVOKER), `rpc_list_my_applications_page` (`bc4545fd…`), `rpc_list_my_agreements_page` (`f834365b…`), index `marketplace_responses_worker_idx` | `rpc_get_my_task_relations(uuid[])` (`8bed3339…`, DEFINER) | `rpc_list_open_tasks_v3` (`04a8f14a…`, INVOKER), indexes `needs_open_geog_idx` (GiST) and `needs_open_published_idx`, both valid and ready |
| grants | public functions `{postgres, authenticated}`; the private one `{postgres}` | `{postgres, authenticated}` | `{postgres, authenticated}` |
| everything else | surface md5 without the `pkg023` objects still `48283702…` | still `48283702…` | still `48283702…`; whole surface 3188 objects, md5 `f04811bd…` |
| closure digest | unchanged `ac50680b…` | unchanged | unchanged |
| old readers / old APK contract | `rpc_list_my_applications()` `6ce809c2…`, `rpc_list_my_agreements()` `f4c56eca…`, same ACL | same | `needs` policies (6, same md5), table ACL and the legacy open-set read (5 rows, same fingerprint) unchanged; old GiST index unchanged |

**Runtime, in rolled-back transactions, with a user id that is no account (no real account was impersonated):**

- a — three empty pages `{items: [], hasMore: false, asOf}`; `INVALID_PAGE` for limit 0, limit 101 and a half
  cursor; `INVALID_SCOPE`; `AUTH_REQUIRED` (28000) without a user id; `anon` denied (42501) on all three.
- b — nine ids (published, unpublished, non-existent) → `{items: []}`: no oracle; `INVALID_INPUT` for an empty,
  NULL, NULL-containing or 101-element array, 100 accepted; `AUTH_REQUIRED`; `anon` denied.
- d — with RLS bypassed by the table owner and a synthetic user id: 5 open tasks, the 28 allowlisted keys and
  no account id, address, description or exact coordinate; pins `COARSE_1KM` or none; the same ids as the
  legacy open read; one task in a viewport over Serbia, none over Iceland; pages of two do not overlap. As the
  `authenticated` role with a stranger's id: the V3 reader and the legacy read see the same one task (the
  reader cannot widen RLS). `INVALID_BBOX` (13° × 6°), `INVALID_FILTER` (unknown key, `remote: ONLY` in a
  viewport, a bad timestamp), `INVALID_PAGE` (201), `AUTH_REQUIRED`, `anon` denied.
- Security advisors after d: the three new DEFINER readers appear in the "signed-in users can execute a
  SECURITY DEFINER function" list with the other 152 — intended, they are own-row readers. Nothing new for
  `anon`. The four `anon` entries that exist are older (F4 of the forensic review).

## 15. The closure source digest — reviewed, and re-certified on 2026-09-19

`CLOSURE_FORENSIC_REVIEW_20260919.md` is the review; its section 10 is the receipt. In one paragraph: the
exact text of every `dev_alpha` row was reconstructed from the ledger and is in the repository; source 147
plus those texts reproduces the whole canonical DEV surface, with nothing unledgered; a read-only query
showed that the digest **without** the reviewed additions was exactly the certified value, so they were the
only change the digest could see; the additions hold no user-authored content, but two of them hold what an
operator wrote *about* a person, and on the owner's condition that free text no longer survives a closure.
`pkg023f` was applied on 2026-09-19 (ledger `20260919164420`), byte-identical to its candidate: it put the
two lineage relations into the erasure program, catalogued the three tables, and re-bound the certificate.
`retention_ai_source_ready()` is true again and an account can be closed on DEV.

**`pkg023c` still needs its own approval, and must first be regenerated**: it pins the md5 of
`private.closure_redaction_patch_v5`, which `pkg023f` changed.

## 16. The client side — what is wired, and what the rest waits for (2026-09-19)

**Done: the relation overlay (B).** Discovery and the task detail used to answer "my task / I applied" by
reading my whole task list and my whole application list, for one label on one card. They now ask
`rpc_get_my_task_relations` for the ids on the page, at most a hundred per call. The port gained
`odnosiPremaZadacima`; the Supabase source calls it in chunks and refuses an answer it cannot stand behind
(an id nobody asked about, a repeated answer, an unknown relation or state, a missing application id); the
demo source answers from the rows it already holds. The rules the old code had are kept and now tested
against the server's own shape, which `supabase/proofs/pkg023/pkg023_v3_backend_proof.mjs` pins with
`deepEqual`: a task the server did not name is NONE **only if it was asked about**, a task nobody asked
about is UNKNOWN, a failed read is UNKNOWN and never a licence to apply, and a withdrawn or closed
application leaves the task open to apply to again. 232 suites / 4447 tests.

**Blocked, with the fix written: the bounded marketplace (D).** The list and the map cannot move to
`rpc_list_open_tasks_v3` yet. The client's shared public projection reads three fields the reader does not
carry — `task_timezone`, `task_country_code`, `verified_identity_required` — and without the zone
`needScheduleText` falls back to UTC, so a task at 15:00 in Belgrade would be shown to everyone as 13:00.
`supabase/candidates/pkg023i_open_tasks_timezone.sql` adds exactly those three, all of them already public
on the task detail any signed-in viewer can open, and **keeps the description out**: the list would ship
fifty descriptions to every viewer of every page, while the marketplace search matches title, area and
conditions and the detail screen reads the description for one task when a person opens it. It is proven as
S9 of the PKG-023f run and **applied nowhere**.

**Not done, and not a quick win: the paged own-lists (A + C).** Three findings from reading the consumers:

1. `moje-prijave` is not a list screen but a command-reconciliation screen: a pending withdrawal is
   reconciled against *the list that comes back*. Paging it without moving that reconciliation onto the row
   it names would make a pending command on page two read as unreconciled. That is a correctness change in
   an idempotency path, not a rendering change.
2. `Početna` and `Moje aktivnosti` do not want a page at all. They want "what needs me", and they compute it
   by scanning every application and every Dogovor for `traziPaznju` and a stale review. A first page would
   silently miss the fourth thing that needs a person, which is exactly the thing that must not be missed.
   What that screen needs is a small server aggregate, not a cursor — already recorded in `homeSnapshot.ts`
   and in the decision record as a READ_CONTRACT item.
3. `Dogovori` and `Raspored` are the two lists where a cursor is honest and cheap, because they only show
   rows; they are the place to start when this is taken up.

So the paged readers on DEV are used by nothing yet, deliberately. Nothing was truncated to look finished.
