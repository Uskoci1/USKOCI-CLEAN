# PKG-045 — explicit task reads and public column privacy

Status: **A proven and applied to DEV; B proven and ON HOLD** for fresh explicit certificate approval
and compatible APK rollout. Finding7.17 is not yet closed on DEV.

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
   The existing paged owner reader retains its indexed owner filter and now checks account openness
   explicitly before an elevated read. Notification resolution remains invoker/RLS-bound: it reads
   only the task ID and uses `is_my_task(uuid)` for the owner boolean, never an internal account ID.
2. Build/install the compatible app. Own list/detail and public opportunity use those readers.
   The application pricing join and remaining-search timestamp read keep their existing RLS/columns.
3. **B, restriction:** remove table SELECT from PUBLIC/anon/authenticated, clear column grants on the
   known41-column inventory, grant authenticated the explicit38 allowed columns. Anonymous gets none.
   The three internal columns are unavailable even in filters, ordering and aliases. Five dependent
   owner predicates replace their internal-ID comparison with the same `is_my_task(n.id)` decision;
   their remaining RLS conditions/roles/commands are retained. This is necessary because policies
   on related tables also require SELECT privileges on referenced task columns.

**B requires fresh explicit owner approval of certificate movement AND verified compatible APK rollout.** The old owner filter and whole-row
PostgREST computed fields require the revoked columns. A alone does not close the vulnerability.
No client fallback to the exposed read is added. Future columns receive no implicit SELECT grant.

## Safety and proof

Candidates pin the current reader/count bodies and verify resulting MD5s. A keeps the ready closure
digest unchanged. B necessarily moves it: `closure_erasure_program_digest_v5()` includes every table's
ACL. Its transaction restores just the former table SELECT grants to reconstruct the exact old digest,
reapplies the restriction to recover the exact new one, then binds both certificate tables and only
the constant in `retention_ai_source_ready()`. All other readiness bytes are checked unchanged.
No existing marketplace row, table definition, constraint, trigger, erasure operation, provider, secret,
JWT setting or dependency is changed. Frozen source147 is untouched.
The privilege stage verifies A's bodies and refuses repeat application. A is also apply-once.

`supabase/proofs/pkg045/pkg045_proof.mjs` reconstructs all predecessors on a disposable stack, then
uses real local Auth/PostgREST. It demonstrates the internal-column disclosure before, verifies old
and new reads under A, proves direct/alias/filter/order/wildcard denial under B, and compares owner,
draft, public, participant-history, cross-world, restricted-account, map, computed-count, topology,
requirements and revision-bound price behavior. Actual TypeScript adapters run against that API.
After B, the actual closure worker must erase a fresh disposable account's draft and private address
to completion on the new certificate; an incomplete recertification must roll back atomically.
The proof includes column ACLs in addition to the historical general authority-surface snapshot.

Owner grants permit proven non-destructive DEV fixes; this package deliberately separates A from B's
fresh certificate decision and phone compatibility gates. No previous general approval authorizes B.

## Validation record

- Local types passed; focused client108 tests passed; source-reader boundary3 tests passed.
- Full Jest242 suites /4687 tests passed and the command exited0. Jest logged its existing delayed
  process-exit warning; the result is not inferred from a partial log.
- Initial focused run: one old query-shape assertion still inspected `.select`; replaced with the
  explicit RPC contract assertion. No product failure was hidden.
- First disposable run35707273918 reproduced the real REST disclosure and baseline access controls,
  then refused application because the candidate incorrectly pinned the DEV closure constant on the
  disposable reconstruction. Fixed to require that environment's live digest equals its certified
  value and readiness is true, then require it unchanged. Candidate A does not rebind the certificate.
- During the separate compatibility review, catalog inspection of all public invoker functions using
  `needs` found two additional affected readers: owner pagination and notification target resolution.
  Both are included with before/after API tests. `fn_need_urgency` uses only allowed columns.
- Second disposable run35707913098 refused the dependency pin: historical `covered_slots` uses CRLF
  on DEV and LF in the source replay. Its unchanged dependency pin now normalizes only CRLF to LF,
  as the existing authority-surface proof does. Changed function bodies remain exact MD5 pinned.
- Third run35708788704 proved A's exact bodies, unchanged certificate and real API compatibility.
  B then correctly rolled back at the unchanged-certificate guard. The omitted dependency was the
  table ACL inside the erasure-program digest (the schema digest alone does not include it).
  The final B candidate uses the proven PKG-032b / PKG-023f inverse/rebind method, explicitly HOLD.
- Fourth run35709805583 verified atomic policy/rebind refusal and blocked all tested disclosure paths,
  then caught a legitimate-read failure: PostgreSQL table REVOKE also clears column grants. The
  transaction-local certificate reconstruction now restores the exact38-column allowlist afterward
  and asserts every live column's allowed/denied state before commit. Reference:
  https://www.postgresql.org/docs/18/sql-revoke.html .
- Final disposable CI35710468643 on92f75b11 **PASS**:17 SQL/Auth/REST/actual-client checks,355 offline
  Edge tests,108 focused client tests, types and tracked source147 integrity. B's real closure worker
  reached CLOSED after75 calls, erased the disposable draft/private address and soft-deleted Auth;
  no provider calls or DEV fixtures. Receipt: `PROOF_35710468643.json`.
- APK35707463751 built successfully from05fa7232. Client source is unchanged in subsequent SQL/proof
  commits. Downloaded checksum, source/tree and both attestations match. Not installed.

## DEV application

Only A was applied as `dev_alpha_pkg045a_task_read_contract`, version20260922093241.
Ledger197 =147 source +50 dev_alpha. Ledger SQL SHA256 `a8aff720…` matches the proven candidate exactly
without its final newline. All six function bodies/ACLs/security modes/search paths match the proof.
Ready closure65980fce… is asserted unchanged inside the successful transaction; the certified table
value is also read back unchanged. Direct private digest execution was not independently repeated.
No marketplace row was changed. Receipt: `supabase/operations/dev-alpha/ledger/20260922_pkg045a_application.receipt.json`.

B was not applied. Fresh readback confirms broad SELECT remains until the controlled rollout;
there is no claim that A alone fixed public column privacy. Owner questions sent for B's certificate
approval and readiness to install/test the verified APK. No answer is implied by elapsed time.
- Local migration inventory still refuses the known foreign untracked148th file; left untouched.
  Tracked source147 validation passed in the first CI run.

## Separate observed CI debt

PKG-014B35704252850 fails its source fingerprint because the recorded intake hash predates PKG-043/044.
Its355 offline tests pass. This package does not silently relax that unrelated source assertion or
claim all workflows green; the manifest needs a separate evidence-bound update.
