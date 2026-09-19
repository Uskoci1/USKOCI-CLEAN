# V3 third slice, backend part — migration PLAN (2026-09-19)

**Status: PLAN ONLY. Nothing here is applied, and no candidate SQL exists yet.** The owner approved
"samo plan, ne izvršenje" on 2026-09-19. Every fact below was read from canonical DEV
`leqcwgzvjsxugfgzdmth` with read-only catalog queries on that day, or from the committed tree at
`130028de`.

Scope, as the owner named it: A) bounded, paginated own reads; B) a single-task relation read;
C) Agreement summary additions; D) a ~100 m public task location. Outside it and untouched: exact
matching, the worker's own location grid, discovery paging, price engine, wallet, Edge functions.

## How a DEV migration is made here (existing procedure, unchanged)

`supabase/migrations/` is the frozen source-147 inventory; a 148th file fails seven assertions of the
source-admission harness. A DEV change is therefore a **candidate**: `supabase/candidates/pkgNNN_*.sql`,
opening with a `do $preflight$` block that compares `md5(pg_get_functiondef(...))` of every live body
it replaces and raises if any differs, applied through `apply_migration` under the name
`dev_alpha_pkgNNN_*`, with a runtime proof `supabase/proofs/pkgNNN_*_runtime_proof.sql` and a workflow
that rebuilds a disposable database, applies the candidate and runs the proof (as PKG-003, 008, 014B
and 015 do). The ledger on DEV is 157 rows today: 147 source + 10 dev_alpha.

## The three candidates

| # | Candidate file | Applied as | Covers |
| --- | --- | --- | --- |
| 1 | `supabase/candidates/pkg023a_own_reads_paged.sql` | `dev_alpha_pkg023a_own_reads_paged` | A and C |
| 2 | `supabase/candidates/pkg023b_task_relations.sql` | `dev_alpha_pkg023b_task_relations` | B |
| 3 | `supabase/candidates/pkg023c_public_pin_100m.sql` | `dev_alpha_pkg023c_public_pin_100m` | D |

Proofs: `supabase/proofs/pkg023a_…`, `pkg023b_…`, `pkg023c_…_runtime_proof.sql`. One workflow,
`.github/workflows/pkg023-v3-reads-and-pin-proof.yml`, applies the three in order on a disposable
database. 1 and 2 only add objects. 3 adds two columns and replaces eight function bodies.

---

## A + C — `pkg023a_own_reads_paged`

**What is there today.**

| Read | How the client does it | Bound |
| --- | --- | --- |
| my tasks | direct `from('needs').select(NEED_SELECT).eq('requester_account_id', uid)` under RLS | none |
| my applications | `rpc_list_my_applications()` | none; and **no index leads with `worker_account_id`**, so it scans `marketplace_responses` |
| my Dogovori | `rpc_list_my_agreements()` | none; two `EXISTS` and a phone lookup per row |

**What is added. Nothing existing is altered or dropped.**

1. `public.rpc_list_my_needs_page(p_scope text default 'ALL', p_limit integer default 30, p_before_at timestamptz default null, p_before_id uuid default null) returns jsonb` —
   `STABLE`, **`SECURITY INVOKER`**, `search_path=pg_catalog`. Invoker on purpose: today this read
   stands on RLS (`needs_owner_select`, and the restrictive `v5_closed_account_visibility`), and an
   invoker function inherits exactly those policies instead of re-stating them. Same fields as
   `NEED_SELECT`, with the application count as a number instead of an embedded id list.
2. `public.rpc_list_my_applications_page(same four parameters) returns jsonb` — `STABLE SECURITY DEFINER`,
   `search_path=pg_catalog`, `auth.uid()` required, like its sibling (it must read a task that has
   left `PUBLISHED`, which RLS would hide from the applicant). Same item fields and the same state
   vocabulary as `rpc_list_my_applications`.
3. `public.rpc_list_my_agreements_page(same four parameters) returns jsonb` — definer, as its sibling.
   Same item fields as `rpc_list_my_agreements`, **plus C:** `pendingChange`, which is `null` or
   `{ id, proposedByMe, createdAt }`, read from `agreement_change_proposals where status='PENDING'`
   through the existing index `(agreement_id, status, created_at desc)`.
4. `private.my_application_state(raw_status text, submitted_rev integer, current_rev integer, need_status text, has_agreement boolean) returns text` —
   `IMMUTABLE`, not executable by any client role. The exact `CASE` of `rpc_list_my_applications`,
   so the paged read and the relation read (B) cannot drift apart. The old function keeps its own
   inline copy, untouched.
5. `create index marketplace_responses_worker_idx on public.marketplace_responses (worker_account_id, submitted_at desc, id desc) where status <> 'DRAFT'`.
   Needed by 2 and by B; it also speeds up the old unpaged read, which today has no usable index.

**C needs less than the second slice said.** `rpc_list_my_agreements` already returns `startsAt` and
the accepted `terms`; the client only turns them into text. Ordering Dogovori by start time is a
client mapping change with no migration. Only `pendingChange` is new on the server.

**Limit / cursor / order contract** — the one `rpc_list_inbox` already uses, so there is one paging
idiom in the app:

- `p_limit` 1…100, default 30. `p_before_at` and `p_before_id` are given together or not at all.
  Anything else raises `INVALID_PAGE` (`22023`). `p_scope` ∈ `ALL | ACTIVE | HISTORY`, else `INVALID_SCOPE`.
- Keyset, never offset: `(sort_at, id) < (p_before_at, p_before_id)`, order `sort_at desc, id desc`,
  `limit p_limit + 1`. A row inserted between two pages can neither repeat nor hide a row.
- `sort_at`: tasks `created_at`; applications `coalesce(submitted_at, created_at)`; Dogovori `created_at`.
- Returns `{ items, hasMore, asOf }`; each item carries `sortAt` and `id`, which are the next cursor.
- `ACTIVE`: tasks `DRAFT, PUBLISHED, SELECTION, ACTIVE`; applications whose mapped state is
  `SUBMITTED, VIEWED, SHORTLISTED, STALE_REVIEW_REQUIRED`, or `SELECTED` with a live Dogovor; Dogovori
  whose `coalesce(execution.state, status)` is `CONFIRMED` or `AWAITING_REQUESTER`. `HISTORY` is the
  complement. The vocabularies are the live `CHECK` constraints.

**Grants.** `revoke all on function … from public, anon; grant execute … to authenticated`. No
`service_role` grant: nothing server-side calls them.

**Query behaviour, before → after.**

| Read | Before | After |
| --- | --- | --- |
| my tasks | every owned row with three embedded relations | range scan of `needs_requester_idx`, at most `limit+1` rows |
| my applications | sequential scan + one `agreements` sub-select per row | scan of the new worker index, at most `limit+1` rows |
| my Dogovori | every row on both sides; 2 `EXISTS` + 1 phone lookup each | the same per row, for at most `limit+1` rows |
| Početna | three whole lists to show ten rows | three calls with `p_scope='ACTIVE', p_limit=10` |

## B — `pkg023b_task_relations`

`public.rpc_get_my_task_relations(p_need_ids uuid[]) returns jsonb` — `STABLE SECURITY DEFINER`,
`search_path=pg_catalog`, `auth.uid()` required, 1…100 ids or `INVALID_INPUT` (`22023`). A single task
is an array of one; the map and the lists send one call for the rows they show, instead of one call
per row.

Returns `{ items: [{ needId, relation: 'OWNER' | 'APPLIED', applicationId, applicationState, agreementId }], asOf }`.
**Only tasks the caller owns or has applied to are listed. Every other id — unrelated, not visible
to the caller, or not existing — is simply absent, with the same shape.** The function is therefore
no oracle for the existence or state of a task; the client reads "absent" as `NONE`, and a failed
call as `UNKNOWN`, exactly as `src/data/taskRelation.ts` does now. Lookups: `needs_pkey`, the unique
partial index `(need_id, worker_account_id)`, and `agreements_selected_response_id_key`. Same grants
as A.

## D — `pkg023c_public_pin_100m`

**What is there today.** `needs.approximate_lat numeric(6,2)` and `approximate_lng numeric(7,2)`.
The scale is in the **column type**, not only in the `round(…, 2)` of
`private.materialize_resolved_location`. A generated column, `approx_geog`, and its GiST index are
built on those two columns; the constraint trigger `check_need_resolved_location_binding` demands
`approximate_* = round(anchor, 2)`; matching reads them; the publication fingerprint includes them;
account erasure nulls them.

**Therefore: add, do not alter.** Changing the type would rewrite the table, collide with the
generated column, move every fingerprint and force a decision about old rows. Instead:

```sql
alter table public.needs
  add column public_lat numeric(7,3),
  add column public_lng numeric(8,3),
  add constraint needs_public_pin_pair_check check (
    (public_lat is null) = (public_lng is null)
    and (public_lat is null or (public_lat between -90 and 90 and public_lng between -180 and 180)));
```

Nullable, no default: no table rewrite, **no backfill**. Every existing row keeps `public_* = null`.

Eight live bodies are replaced, each pinned by md5 in the preflight. The rule for all of them:
**`public_*` follows the life of `approximate_*` and is only ever set by the materializer.**

| Function | Change |
| --- | --- |
| `private.materialize_resolved_location(uuid, uuid)` | also sets `public_* = round(anchor, 3)`; `approximate_*` still `round(anchor, 2)` |
| `private.check_need_resolved_location_binding()` | when `public_*` is not null it must equal `round(anchor, 3)`, else `LOCATION_BINDING_CHANGED`; null is allowed (old tasks) |
| `private.guard_need_write()` | `public_lat`, `public_lng` join the columns that cannot change after publication |
| `public.rpc_confirm_need_edit(...)` | where it clears `approximate_*` it clears `public_*`; it never takes `public_*` from the client |
| `public.rpc_confirm_need_edit_from_review(...)` | the same keep-or-null `CASE` for `public_*` as for `approximate_*` |
| `private.closure_redaction_patch_v5(...)` | the `needs` patch also nulls `public_lat`, `public_lng` — otherwise account erasure would leave a 100 m pin behind |
| `private.need_material_snapshot(uuid)`, `private.need_publication_fingerprint_snapshot(uuid)` | `publicLat` / `publicLng` are added **only when not null**, so the fingerprint of every existing task stays byte-identical and no accepted review in flight is invalidated |
| `private.need_publication_location_readiness(uuid)` | the `REMOTE` branch also requires `public_*` to be null |

Signatures of all eight are unchanged. `closure_redaction_allowed_v5` and
`rpc_redact_account_closure_step_service` are read in full while authoring and changed only if their
allowed-key derivation requires it.

**Deliberately unchanged:** `approximate_*`, `approx_geog` and its index; `private.candidate_profile_ids`
and `private.match_detail_without_calendar` (matching stays on the ~1 km grid: "NOT exact matching");
every RLS policy; and the worker side entirely — `worker_match_preferences.approximate_* numeric(6,2)`
and `rpc_save_worker_location`, which still refuses `lat <> round(lat, 2)`.

**2 → 3 decimals, for a person.** A new task's pin moves from a ~1.1 × 0.78 km cell to a ~110 × 78 m
cell, deterministically, with no randomness. A task already published keeps its old pin until its
place changes (owner answer 1). The exact point stays in `need_sensitive` and is never exposed.

**Client.** The discovery reads add `public_lat, public_lng` to their select; the pin is
`public_* ?? approximate_*`.

---

## Compatibility with an APK already installed

Everything is additive. The old APK calls `rpc_list_my_applications()` and `rpc_list_my_agreements()`
with no arguments and selects named columns of `needs`; all of that is untouched and returns what it
returns today, and it never sees the new columns or functions. Order of promotion is database first,
APK second, so the new APK never meets a database without them; for one release it still falls back
to the old unpaged readers if a paged function is missing (`PGRST202`).

**RPC signatures left exactly as they are:** `rpc_list_my_applications()`, `rpc_list_my_agreements()`,
`rpc_get_agreement_workspace(uuid)`, `rpc_list_inbox(text, integer, timestamptz, uuid)`,
`rpc_submit_response`, `rpc_select_response`, `rpc_withdraw_response`, `rpc_accept_ai_task_review`,
`rpc_publish_accepted_ai_task_review`, `rpc_save_worker_location`, and — signature only, body extended
in D — `rpc_confirm_need_edit`, `rpc_confirm_need_edit_from_review`.

## Tests that fail first

On a disposable database, before the candidate exists (function or column missing), then pass:

- **pkg023a:** 35 tasks of account A → page 1 has 30 and `hasMore`, page 2 has 5, no overlap and no
  gap; a task inserted between the two calls neither repeats nor hides a row; `p_limit` 0 and 101
  and a half cursor raise `INVALID_PAGE`; account B receives none of A's rows; `anon` is denied;
  `ACTIVE` / `HISTORY` partition the rows; `pendingChange` is null → `{proposedByMe:true}` for the
  proposer and `false` for the other side → null again after the answer; `EXPLAIN` of the
  applications page uses `marketplace_responses_worker_idx`.
- **pkg023b:** `OWNER`; `APPLIED` with state and Dogovor id; an unrelated published task, an invisible
  draft of somebody else and a random uuid are all absent and indistinguishable; 101 ids raise
  `INVALID_INPUT`; `anon` is denied.
- **pkg023c:** a newly materialized task has `approximate_* = round(anchor,2)` and
  `public_* = round(anchor,3)`; a tampered `public_lat` raises `LOCATION_BINDING_CHANGED`; after
  publication `public_*` cannot be updated; **the fingerprint of a task published before the
  candidate is byte-identical after it**; account erasure nulls `public_*`; a `REMOTE` task has all
  four null; `rpc_save_worker_location` still refuses three decimals.
- **Client (Jest):** the three paged readers (cursor passed back, `hasMore`, a malformed page
  rejected, fallback on `PGRST202`), the relation reader (absent → `NONE`, failure → `UNKNOWN`),
  Početna reading `ACTIVE` pages of 10, Dogovori ordered by start, the map preferring `public_*`.

## Rollback and fallback

Migrations are forward-only; an applied one is never rewritten.

- A, B, C only add objects. Fallback is the client using the old readers, which stay in the code for
  one release. A removal, if ever wanted, is a successor candidate that drops the new functions.
- D keeps the previous body of each of the eight functions verbatim in the candidate (as a commented
  block with its md5). Rollback is a successor candidate that restores those bodies and leaves the two
  columns in place; columns that are no longer written are inert, and the client already falls back
  to `approximate_*`.
- The preflight raises before anything is applied if any live body differs from the md5 recorded
  when the candidate was written.

## Order of promotion on canonical DEV — every step reported, stop on any mismatch

0. The owner approves this plan.
1. Candidates, runtime proofs, workflow and client tests are written. CI is green on the disposable
   database. **DEV is not touched.**
2. Read-only preflight on DEV: md5 of the eight live bodies, fingerprints of the published tasks, row
   counts, the ledger tail.
3. The owner's explicit word to apply. Then `pkg023a` → postflight (functions exist, grants exact,
   index used).
4. `pkg023b` → postflight.
5. `pkg023c` → postflight: fingerprints of existing tasks unchanged, `public_*` null on every old row,
   security advisors read.
6. Client change, Jest, APK build. The old APK keeps working throughout.
7. Ledger and entry map: 160 rows = 147 source + 13 dev_alpha.

## Open points, stated rather than hidden

- `rpc_confirm_need_edit` writes `approximate_lat` from `p_material.approximateLat`. It has to be read in
  full before its candidate body is written; `public_*` will never be accepted from a client.
- Whether the data export snapshot enumerates `needs` columns (and must list `public_*`) is checked
  while authoring D.
- The discovery read itself (`prilike`) stays a direct, unbounded table read. It is not in A–D; it is
  the bbox / paging redesign the owner set aside, and the next scaling item after this one.
