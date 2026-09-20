# PKG-025a — a task can say what its price is for

**Status: APPLIED to canonical DEV `leqcwgzvjsxugfgzdmth` on 2026-09-20** as
`dev_alpha_pkg025a_price_basis_column`.

### Readback

| | |
| --- | --- |
| `needs.price_basis` | `text`, nullable, no default |
| rows with a basis | **0** — nothing was backfilled |
| the rule | `CHECK (price_basis IS NULL OR (price_basis = ANY (ARRAY['TOTAL','PER_PERSON']) AND mode = 'MY_PRICE'))` |
| `needs` | 41 columns, 16 CHECK constraints |
| digest | moved `9205c7df…` → **`f61a57c0…`**, and the pin matches it in all three places |
| `private.retention_ai_source_ready()` | **true** |
| ledger | **167 = 147 frozen source + 20 dev_alpha** |

**The stored statement's sha256 is `66509ce4cb73310b59c177710c73ce4dd9fa95336ef87ba6308026c0ce20bb39`,
identical to the file's.** Byte for byte, as with pkg024a, which is what writing the candidate without
a single escape character buys.

Candidate: `supabase/candidates/pkg025a_price_basis_column.sql` · sha256
`66509ce4cb73310b59c177710c73ce4dd9fa95336ef87ba6308026c0ce20bb39` · 9785 bytes · **no escape
characters at all**, because this text travels through a connector to be applied.

## The gap, in the owner's words

`needs.mode` is `MY_PRICE` or `OFFERS`, and `needs.requester_price_rsd` is one amount. For a task
for **one** person that amount is at once the total and the per-person price. For a task for **six**
it is neither, and nothing in the product says which.

What the owner wants expressible (2026-09-19): **TOTAL** (the whole task), **PER_PERSON** (one
covered slot), **OFFERS**. His example: six people, PER_PERSON, 3000 → one slot 3000, three slots
9000, all six 18000.

## Why this was blocked until today, and why it is not any more

Two locks, both now open.

**1. The closure source digest.** `private.closure_schema_digest_v5_139()` hashes every column of
every table, so any new column moves `private.closure_source_digest_v5()` and
`private.retention_ai_source_ready()` goes false — account erasure and AI retention stop reporting
ready. Since 2026-09-17 the pin had not matched at all, so a candidate that re-bound would have
certified, in passing, schema changes it did not make. Section 0 of the slice-3 plan therefore made
a reviewed re-certification the prerequisite for any price basis.

**That re-certification is `pkg023f`, and it is applied.** Read from live DEV on 2026-09-20:

```
retention_ai_source_ready()  true
live digest                  9205c7df...
pinned digest                9205c7df...   (identical, in all three places)
```

**2. The installed APK.** The recorded compatibility plan says publishing with a basis stays off
"until the new APK is the installed one". Four APKs were built and installed on the owner's device
on 2026-09-20, so that condition is now one the project can meet rather than wait for.

## What this candidate does — and what it refuses to do

- one nullable column `public.needs.price_basis`
- one CHECK: it is null, **or** it is `TOTAL` / `PER_PERSON` **and** the task is `MY_PRICE`
- re-binds the closure pin in all three of its places, in the same transaction

`NULL` is the existing meaning, unchanged. **Nothing is backfilled**, no existing row is
reinterpreted, and a postcondition refuses the transaction if any row comes out non-null. `mode`
keeps its two values, because the installed client rejects a receipt whose `pricingMode` is anything
else. **No function body changes**: `rpc_submit_response` still applies today's equality rule,
which is correct while every row's basis is null.

## Why a new column does not disturb the two guards that read a whole row

`guard_need_write` (md5 `314b93f7f89d3d52dbcf17a2a2552502`) compares
`to_jsonb(new) - array['urgent','updated_at']` against the same of `old` for terminal immutability.
That **subtracts** keys rather than allow-listing them, so a column that is null on both sides is
invisible to it. Its material-change list names fields explicitly, so the new column is simply not
material yet — which is exactly what step 4 of section 8 says to add later.

`closure_guard_owned_write` md5 `f13117fd601dcb82de423b78f25acb4f`. The candidate pins both md5s
before and after: if either guard has been rewritten, the reasoning above has not been checked and
the transaction refuses.

## Preflight — read-only against live DEV, 2026-09-20

Ten checks, all green. Nothing was executed, created or replaced.

| | |
| --- | --- |
| predecessor is ready | ✅ |
| the certified value agrees in all three places | ✅ |
| live digest equals the certified one (no drift) | ✅ |
| the column does not exist (not a re-run) | ✅ |
| `guard_need_write` is the reviewed body | ✅ |
| `closure_guard_owned_write` is the reviewed body | ✅ |
| `needs` has 40 columns | ✅ |
| `needs` has 15 CHECK constraints | ✅ |
| the constraint name is free | ✅ |

The transaction asserts every one of them again itself, plus the postconditions: the column is text,
nullable, without a default; every row is null; the constraint names both halves; the counts become
41 and 16; both guards are unchanged; the digest **moved** (a new column that did not move it would
mean the schema digest does not see this table, and certifying would be a lie); the pin is re-bound
in all three places; readiness is true again; and the readiness function is still private.

## What is NOT proven

The executable CI proof on a disposable database — apply, then assert that an application under a
`PER_PERSON` task is priced per slot — has **not** been run, and cannot be until the writer step
exists. What stands is the preflight, the transaction's own assertions, and the fact that this step
changes no behaviour at all while every basis is null.

## Step 2 — pkg025b, APPLIED the same day

`supabase/candidates/pkg025b_submit_response_by_basis.sql`, applied as
`dev_alpha_pkg025b_submit_response_by_basis`. `public.rpc_submit_response` now prices an application
by its task's basis: `NULL` keeps today's equality untouched, `PER_PERSON` multiplies the per-person
amount by what **this** application covers, and `TOTAL` refuses an application that does not cover
all required slots and then requires the total.

Readback: body md5 `7d8d9673c1de83adfa6667aadc0736e9`, 12936 chars, all three arms present, the
security envelope and grants unchanged, the digest **unchanged** at `f61a57c0…` (a function body is
not part of the schema digest, which the transaction asserts), readiness still true, ledger 168. The
stored statement's sha256 equals the file's.

**The first attempt was refused by its own postcondition** — `PKG025B_BODY_NOT_AS_REVIEWED`, because
the count of `PER_PERSON` was written as two when the text contains three (the branch, the detail it
formats, and the comment saying why `TOTAL` is not it). Nothing was applied; the count was corrected
and the transaction re-run. That is the postcondition doing the job it exists for.

The installed APK is safe without any change: it locks its price field to the task's amount, so
under `PER_PERSON` covering one slot it sends exactly the right number and is accepted, and every
other combination is **refused** rather than silently accepted. The client gained the Serbian copy
for the two new refusals in `applicationSelectionClientService`.

## pkg025d - the interview can state a basis, and the draft keeps it (WRITTEN, NOT APPLIED)

`supabase/candidates/pkg025d_price_basis_fact.sql`. Until this step nobody can WRITE a basis: a
review is a set of confirmed facts, and there was no fact for it, so the column could only ever be
null in practice. It adds three things - the registry row `need.price_basis` (ENUM, PUBLIC, not
required for a draft, `target_owner = needs.price_basis`), the validator's rule (TOTAL or PER_PERSON
and nothing else), and the write in both `rpc_save_need_draft_from_review` and
`rpc_confirm_need_edit_from_review`.

The basis is computed where it is written rather than in a new variable, so each writer takes one
edit instead of three: `case when v_mode='MY_PRICE' then ... end` yields null for OFFERS, which is
what the table's CHECK requires. Both of the draft writer's lists are appended at their end, so no
value shifts position.

**Why this does not need the material list first.** Section 8 lists the guard's material list as
step 2, before the fact. Read on the live guard body, that ordering is not required, and the reason
is worth writing down rather than assuming:

- `private.guard_need_write` returns early inside `if token = 'CONFIRM_EDIT'`, **before** `material`
  is ever consulted. The confirm path checks status, revision, the Dogovor lock and cleared
  publication metadata - none of which a new column touches.
- The whole-row subtraction `to_jsonb(new) - array['urgent','updated_at']` applies only when
  `old.status` is terminal, and a confirm edit requires DRAFT/PUBLISHED/SELECTION.
- `material` is consulted only on the direct-UPDATE path, to refuse editing a live task outside the
  confirm command. RLS already makes that unreachable: `needs_owner_update` restricts a requester's
  direct UPDATE to `status = 'DRAFT'` in both `using` and `with check`. On a draft, changing the
  basis is as permitted as changing the title, because a draft is not yet an offer to anyone.

What step 2 still buys is the **edit history**: `previous_material_snapshot` / `new_material_snapshot`
will not record that a basis changed between revisions until the column joins the snapshot. That is
an audit gap, not a safety hole, and it stays in its own step.

### Client and Edge, done in the same pass

The Edge function derives the model's allowed key enum and the registry it hands the model from
`AI_PROPOSABLE_NEED_FACT_V2_KEYS` in `src/contracts/needFactsV2.ts`. So the contract entry does most
of step 4 by itself, and what remained was genuinely small:

- `src/contracts/needFactsV2.ts` - the key, not `manualOnly`, so the AI may propose it.
- `supabase/functions/uskoci-ai-interview/index.ts` - `PRICE_BASES`, a case in
  `valueMatchesContract`, and one instruction: ask **once**, only when the task needs more than one
  person and the requester named a price, never assume, and say plainly that choosing "ukupno" means
  one application covers the whole task.
- `src/data/aiNeedV2Ui.ts` - the review shows "Po osobi" / "Ukupno za ceo zadatak" instead of the
  stored enum, and the correction editor accepts those words and **refuses** anything else.
- `src/data/aiNeedV2Production.ts`, `src/data/aiTaskReviewClientService.ts` - the read decoders.

All four places had the same hole: an ENUM with no case falls through to "accept anything", so a bad
value travelled to the server and the person was shown `V2_PRICE_BASIS_INVALID`. A refusal belongs
where the typing happened.

`ru2-ai-v2-ui` pins the key counts (22 -> 23, 19 -> 20 AI-proposable) and **failed on the first run**,
which is what it is for: a key added to that file silently widens what the AI may write the moment
the Edge function is redeployed. Counts updated deliberately, with the reason in the test.

Local proof: typecheck clean, **234 suites / 4519 tests** (was 4508; +11 for the basis in the review).

### Preflight, measured read-only on canonical DEV 2026-09-20

The earlier note in this file said the connector needed re-authorization and the candidate could not
be preflighted. That was a misreading: the `plugin:supabase` duplicate needs auth, the Supabase
connector actually in use is connected. The preflight was run and every precondition holds.

| measured | value |
| --- | --- |
| `validate_need_v2_fact_pre_fastest_retirement` | md5 `e12a5ba0...`, 6730 chars - as pinned |
| `rpc_save_need_draft_from_review` | md5 `a334717a...`, 10543 chars - as pinned |
| `rpc_confirm_need_edit_from_review` | md5 `2126c674...`, 13555 chars - as pinned |
| `price_basis` in any of the three | 0 |
| each of the four anchors | exactly 1 |
| `v_facts` in scope in both writers | 32 uses each |
| registry rows / `need.price_basis` rows | 22 / 0 |
| `need.price_mode.target_owner` | `needs.mode` |
| digest live = certified, readiness | `67730f62...`, true |
| ledger | 170 |

Two things worth recording. The registry holds **22** V2 rows and `NEED_FACT_V2_KEYS` holds 22 keys:
server and client count the same facts, and this step takes both to 23 - the client mirror is a real
mirror, not a hopeful copy. And the digest is `67730f62...`, not the `f61a57c0...` left after
pkg025b: `dev_alpha_pkg026_ai_test_cap_optional` landed between pkg025b and pkg025c, moved the schema
digest and re-bound it properly. It touches none of the three bodies here.

The validator reading also confirms the shape: it takes `value_type` from the registry and raises
`V2_FACT_KEY_INVALID` when the row is absent, so the registry row is what admits the key; for `ENUM`
it requires a JSON string and leaves it trimmed and non-null in `v_text`, which is the variable the
new arm tests. The arm is byte-for-byte the shape of its `need.price_mode` neighbour.

### What is not proven
- It sits on the publication path, and the house proof for that (disposable database, real accounts,
  fail-before/pass-after) cannot be run from here.
- The Edge function is edited but **not deployed**. Deploy by the owner's CLI route, not the
  connector, which has previously resolved literal escape sequences in source text.
- No device pass.

## The steps still to come, each with its own review
2. The application content hash, the publication fingerprint, the material snapshot and
   `guard_need_write`'s material list gain `price_basis` **only where it is not null**, so no old
   hash or fingerprint changes. Not a precondition for pkg025d - see the guard reading above - but
   it is what makes an edit history record that the basis changed.
6. Apply pkg025d to canonical DEV, and deploy the Edge function by the owner's CLI route.
7. A device pass on the one thing none of this has been seen doing: a task for several people, a
   fixed price, the AI asking which it is, and the amount reading correctly on the card, the detail
   and the application.

`rpc_select_response` needs no change at any step: the Agreement terms already carry that
application's own total.
