# V3 third slice, backend part — migration PLAN, second version (2026-09-19)

**Status: NOTHING IS APPLIED TO CANONICAL DEV.** The owner approved the first version of this plan
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
on a disposable database first. The DEV ledger is 157 rows: 147 source + 10 `dev_alpha`.

## 2. The candidates

| Candidate | Covers | Touches existing objects | Closure digest | DEV |
| --- | --- | --- | --- | --- |
| `pkg023a_own_reads_paged.sql` | A + C | no | unchanged, self-asserted | ready for the owner's word |
| `pkg023b_task_relations.sql` | B | no | unchanged, self-asserted | ready for the owner's word |
| `pkg023d_marketplace_bounded.sql` | owner addition 1, and 3 | no | unchanged, self-asserted | ready for the owner's word |
| `pkg023c_public_pin_100m.sql` | D, owner addition 4 | 9 bodies + 2 columns | re-bound from a ready predecessor | **HOLD** (section 0) |
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
   requester_price_rsd × covered_slots`; `TOTAL` → **owner decision needed** between (a) the application
   must cover every remaining slot and carry the total, or (b) a proportional share, which then requires
   the total to divide evenly by `required_slots` at publication. (a) is the smaller and has no rounding.
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

**Installed APK.** It sees `mode = MY_PRICE` and a price, without the basis. A one-slot application to a
`PER_PERSON` task works (3000 × 1 is what it sends). A multi-slot one is refused with
`FIXED_PRICE_MISMATCH`: a refusal, never a wrong Agreement. It would display "3000" with no "po osobi".

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

- The closure digest drift on DEV since 2026-09-17, and the three DEV migrations whose SQL is not in the
  repo (section 0).
- `needs.created_at` is writable by the owner of a DRAFT, and the **legacy public list is ordered by it**:
  a manipulated client could pin its task to the top of today's list. The V3 reader orders by the
  server-owned `published_at`.
- The legacy public list makes one public-profile call per distinct requester; bounded pages bound that too.
- `rpc_confirm_need_edit` (the legacy scalar edit) takes `approximate_lat/lng` from the client. `pkg023c`
  never takes `public_*` from a client.
