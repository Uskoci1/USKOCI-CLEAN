# F2 and F4 — two small candidates, neither applied (2026-09-19)

The owner ordered each as its own small candidate with a stop before any DEV application. Both are written,
both are proven on a disposable database in the PKG-023f workflow, and **neither is applied anywhere**.

---

# F2 — the data export must not claim that no charge was ever measured

## 1. What the export contains today, exactly

An export is built by `private.data_export_snapshot(account, receipt, binding, cutoff)`. Three things decide
what a person receives:

1. **The row builders** inside that function — one `select` per dataset key, 37 of them, each building a
   `jsonb_build_object` from the account's own rows.
2. **The catalog**, `private.data_export_dataset_catalog()` — for each key, the `dataClass` and the exact
   list of field names that may ever be exported.
3. **The active retention policy**, `retention_policy_sets.export_delivery.datasets` — per key, `mode`
   `INCLUDE` with a list of fields (which must be a subset of the catalog's) or `EXCLUDE` with a reason
   code. `private.data_export_policy_binding()` returns null unless the policy matches the catalog, the
   privacy document and `private.data_export_projection_sha_v5()` — the digest of the six projection
   function bodies.

**On canonical DEV `private.retention_policy_sets` is empty.** `data_export_policy_binding()` is null and no
export can run there at all. The untrue sentence is in the code and in the catalog, not yet in any file a
person received.

The two rows that concern the AI test budget:

| Key | dataClass | Catalog fields | Built from |
| --- | --- | --- | --- |
| `testAdmission` | `AUDIT_SECURITY_LOGS` | `admittedAt`, `retiredAt` | `private.ai_test_accounts_v5` |
| `testAllocations` | `AUDIT_SECURITY_LOGS` | `allocatedMaximumMicrousd`, `createdAt`, `kind`, `measuredProviderCharge` | `private.ai_test_reservations_v5` |

and the builder says, for every row:

```sql
jsonb_build_object('kind',t.kind,'allocatedMaximumMicrousd',t.max_cost_microusd,
                   'measuredProviderCharge',false,'createdAt',t.created_at)
```

`false` is a literal. When it was written it was true of every row — a reservation was a worst-case hold and
nothing had ever been measured. Since `dev_alpha_pkg019b` (2026-09-17) a reservation can carry
`settled_microusd` with `settlement_basis = 'MEASURED'`, priced from the provider's own usage metadata, and
since `pkg019d` also `AUDIO_DURATION_AT_PUBLISHED_RATE`. On canonical DEV today: 173 reservations, 161
settled. So the export would tell a person that nothing about their AI use was ever measured, while the
database holds the measured amount.

## 2. The minimal diff

`supabase/candidates/pkg023h_export_settlement_truthful.sql`. Two bodies, at one anchor each, each of which
must occur exactly once in the live definition or the candidate refuses:

```
- 'measuredProviderCharge',false,'createdAt',t.created_at
+ 'measuredProviderCharge',coalesce(t.settlement_basis='MEASURED',false),
+ 'settledMicrousd',t.settled_microusd,'settlementBasis',t.settlement_basis,'settledAt',t.settled_at,
+ 'createdAt',t.created_at

- "fields":["allocatedMaximumMicrousd","createdAt","kind","measuredProviderCharge"]
+ "fields":["allocatedMaximumMicrousd","createdAt","kind","measuredProviderCharge","settledAt","settledMicrousd","settlementBasis"]
```

`measuredProviderCharge` then means what it says: true only where the amount came from provider-reported
usage. `AUDIO_DURATION_AT_PUBLISHED_RATE` is false — it is priced from measured audio at published rates,
not reported by the provider — and so are `CONSERVATIVE_ESTIMATE_UNMEASURED`, `FAILED_NO_USAGE` and a row
that is not settled at all. It changes no table, no policy, no grant and no other function, and it asserts
on itself that the closure source digest does not move. It does move
`data_export_projection_sha_v5()`, which is the point: a policy written against the old projection has to be
written again against this one.

## 3. Which measured usage and charge data should enter — proposal, not in the candidate

| Data | Where | Recommendation |
| --- | --- | --- |
| `settled_microusd`, `settlement_basis`, `settled_at` | `ai_test_reservations_v5` | **In the candidate.** Without them the corrected flag would be an unexplained boolean; with them a person can see what was charged against their use and on what basis. |
| `measured_audio_bytes`, `measured_transcript_chars` | same table | **Owner's call.** It is the measurement of their own speech, so it is theirs; it is also the most detailed thing we hold about a voice session. Not in the candidate. |
| model, prompt/output/total tokens, `recorded_at` | `private.ai_test_usage_v5` (99 rows, 2 accounts on DEV) | **Owner's call.** This is the measured usage itself. Adding it means a new catalog key (`testUsage`), a new row builder and a policy that lists it. Not in the candidate, because it is new data in an export rather than a correction of a false claim. |
| lineage class, operator `reason`, `source_ref` | `account_lineage_v5`, `..._events_v5` | **Not exported, deliberately.** The owner's instruction: internal security metadata is not exported just because it exists. The class is an operator's judgement about a person, not a fact the person supplied, and the note is free text about them. (It is also erased on closure by `pkg023f`.) |

## 4. The test that fails before and passes after

`supabase/proofs/pkg023f_closure_recert/pkg023f_closure_recert_proof.mjs`, section **S8**, on the disposable
database after the `dev_alpha` ledger replay, for the account that holds twenty settled reservations of
which exactly one is `MEASURED`:

- it asks the projection, through a synthetic binding, for exactly the four fields the catalog admits today;
- **before**: every row says `measuredProviderCharge: false`, including the measured one — the assertion
  `F2_EXPORT_ALREADY_TRUTHFUL` fails if that is ever not so;
- it applies `pkg023h`;
- **after**: exactly one row says `measuredProviderCharge: true`, it is exactly the row whose
  `settlementBasis` is `MEASURED`, every settled row carries a numeric `settledMicrousd`, and the row count
  is unchanged;
- the closure certificate does not move.

---

# F4 — two service-only functions were executable by anon and authenticated

## 1. Why

`dev_alpha_pkg019c` and `dev_alpha_pkg019d` created their functions with `revoke all on function … from
public` and then `grant execute … to service_role`. Revoking from `PUBLIC` does not remove a grant a role
holds by name, and this project's default privileges give `anon`, `authenticated` and `service_role`
EXECUTE on every new function in `public`. Their siblings from `pkg014b`/`pkg019b` used `revoke all … from
public, anon, authenticated, service_role` and are not affected.

ACL on canonical DEV, 2026-09-19:
`{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` for both
`public.rpc_ai_test_release_unused_reservation_service(uuid)` and
`public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)`.

**It is not an exposure.** Both bodies open with `if auth.role() is distinct from 'service_role' then raise
exception 'SERVICE_ROLE_REQUIRED'`. Verified on canonical DEV in a rolled-back transaction: `anon` and
`authenticated` both get `P0001 SERVICE_ROLE_REQUIRED` from each function. What is wrong is that the door is
open and only the inner lock holds.

## 2. Call sites, confirmed read-only

| Caller | How |
| --- | --- |
| `supabase/functions/_shared/aiTestBudget.ts` line 75 | `POST /rest/v1/rpc/rpc_ai_test_release_unused_reservation_service` with `apikey` and `Authorization: Bearer` = the Edge function's `SUPABASE_SERVICE_ROLE_KEY` |
| `supabase/functions/_shared/aiTestBudget.ts` line 96 | `POST /rest/v1/rpc/rpc_ai_test_settle_audio_service`, same headers |

A search of `src`, `supabase`, `scripts` and `.github` for either name finds nothing else but the ledger
texts that created them and the surface snapshots that record them. No client module, no proof, no script
and no workflow calls either function, as any role.

## 3. The candidate

`supabase/candidates/pkg023g_ai_test_service_least_privilege.sql`: two `revoke execute … from anon,
authenticated`, nothing else. It pins the md5 of both bodies before and after, so it cannot revoke on a
function that has changed; it asserts that `service_role` keeps EXECUTE, that the `SECURITY DEFINER`
envelope and `search_path` are untouched, and that the closure source digest does not move.

The proof, section **S7**: before the candidate both roles reach the body and get `SERVICE_ROLE_REQUIRED`;
after it they get `permission denied for function`; the service caller still reaches the body and gets the
body's own answer (`AI_RELEASE_ALREADY_SETTLED`); the certificate does not move.

## 4. Not touched

The advisor lists two more `anon`-executable `SECURITY DEFINER` functions, `public.rpc_closure_api_guard()`
and `public.rpc_get_legal_bundle()`. Both are meant to be reachable without signing in — the legal bundle is
what a signed-out person reads — and neither was part of this finding. `public.rls_auto_enable()` had its
`anon`/`authenticated` EXECUTE revoked by source migration `20260829183528` and is fine.

---

**Both candidates stop here. Neither may be applied to canonical DEV without the owner's separate word.**
