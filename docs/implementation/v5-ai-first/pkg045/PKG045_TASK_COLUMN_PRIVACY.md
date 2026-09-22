# PKG-045 — explicit task reads and public column privacy

Status: candidate/client implemented; proof not yet run; **neither candidate applied to DEV**.

## Boundary and measured baseline

Deep-read7.17 remains open. Fresh read-only catalog inspection on20260922 finds ledger196 and41
`needs` columns readable by authenticated through the table grant. RLS permits same-world public
discovery. A caller choosing its own REST projection can therefore request the internal
`requester_account_id`, `remaining_search_closed_by_account_id` and free-text
`remaining_search_close_reason`. The ordinary UI projection does not secure these columns.
This finding is not evidence of exposure of an exact private address or an observed real-user leak.

## Two-stage rollout

1. **A, additive:** `rpc_read_task(uuid)` keeps existing task/relation RLS, outputs an explicit document,
   and supplies only an ID to existing composite count functions. `rpc_list_my_tasks()` elevates only
   the owner enumeration, requires an open authenticated account and filters by server `auth.uid()`;
   it accepts no caller account. The existing invoker list/map RPC replaces both whole-row references
   with explicit columns and an ID-only computed-field input. Installed old clients still work.
2. Build/install the compatible app. Own list/detail and public opportunity use those readers.
   The application pricing join and remaining-search timestamp read keep their existing RLS/columns.
3. **B, restriction:** remove table SELECT from PUBLIC/anon/authenticated, clear column grants on the
   known41-column inventory, grant authenticated the explicit38 allowed columns. Anonymous gets none.
   The three internal columns are unavailable even in filters, ordering and aliases. No RLS rewrite.

**Do not apply B before the compatible APK rollout is verified.** The old owner filter and whole-row
PostgREST computed fields require the revoked columns. A alone does not close the vulnerability.
No client fallback to the exposed read is added. Future columns receive no implicit SELECT grant.

## Safety and proof

Candidates pin the current list/count/readiness bodies, verify their resulting MD5s, check the ready
closure digest before/after, and never rebind it. No existing user row, table, constraint, trigger,
erasure function, provider, secret, JWT setting or dependency is changed. Frozen source147 is untouched.
The privilege stage verifies A's bodies and refuses repeat application. A is also apply-once.

`supabase/proofs/pkg045/pkg045_proof.mjs` reconstructs all predecessors on a disposable stack, then
uses real local Auth/PostgREST. It demonstrates the internal-column disclosure before, verifies old
and new reads under A, proves direct/alias/filter/order/wildcard denial under B, and compares owner,
draft, public, participant-history, cross-world, restricted-account, map, computed-count, topology,
requirements and revision-bound price behavior. Actual TypeScript adapters run against that API.
The proof includes column ACLs in addition to the historical general authority-surface snapshot.

Owner grants permit proven non-destructive DEV fixes; this package deliberately separates the
compatibility gate from the authorization to apply A. B is held until installation/device readiness.
Phone interaction and any certificate movement still follow the owner's explicit boundaries.

## Validation record

- Local types passed; focused client108 tests passed; source-reader boundary3 tests passed.
- Initial focused run: one old query-shape assertion still inspected `.select`; replaced with the
  explicit RPC contract assertion. No product failure was hidden.
- Disposable CI, full Jest, DEV application and device verification: pending.
