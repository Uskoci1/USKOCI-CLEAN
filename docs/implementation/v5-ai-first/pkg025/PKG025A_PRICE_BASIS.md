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

## The steps after this one, each with its own review

1. `rpc_submit_response` by basis: `NULL` → today's equality untouched; `PER_PERSON` → price equals
   the per-person amount times `covered_slots`; `TOTAL` → one application must cover **all**
   `people_needed` and its price equals the total (owner's decision, 2026-09-19: no proportional
   split, no rounding).
2. The application content hash, the publication fingerprint, the material snapshot and
   `guard_need_write`'s material list gain `price_basis` **only where it is not null**, so no old
   hash or fingerprint changes.
3. A new fact key `need.price_basis` in the shared registry, admitted by the validator chain.
4. Edge: the prompt asks "ukupno ili po osobi" when there is more than one person and a fixed price.
5. Client: the review editor, `3.000 RSD po osobi · 6 osoba · ukupno 18.000` on the card and the
   detail, and the composer showing the computed amount read-only.

`rpc_select_response` needs no change at any step: the Agreement terms already carry that
application's own total.
