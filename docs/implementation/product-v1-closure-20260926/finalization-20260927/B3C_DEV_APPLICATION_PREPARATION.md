# B3c atomic application candidate preparation

2026-09-27. **SOURCE PREPARED; EXACT APPLICATION CI PENDING; DEV UNAPPLIED.**

The owner authorized disposable recertification, not a live certificate replacement.
The successful historical disposable run is recorded in
[B3C_DISPOSABLE_RECERTIFICATION_RECEIPT.md](B3C_DISPOSABLE_RECERTIFICATION_RECEIPT.md).
Its original candidate and proof files remain unchanged. This document describes a
separate application candidate; the historical result does not prove these new bytes.

## Exact application unit

- `supabase/candidates/chat_b3c_private_invalidation_dev_application.sql` is one
  atomic DO statement. It embeds the proved install fragment unchanged, excluding
  only the artificial disposable admission. It then changes the SHA field in each
  of the two existing certificate rows and the single certified-source literal in
  the existing readiness function. There is no test mode or alternate authority.
- It locks closure execution writes and both certificate rows' tables before checking
  that no closure is EXECUTING. A concurrent start cannot pass between that check
  and commit. Lock timeout is five seconds; the candidate refuses a busy target.
- Twelve predecessor functions have fresh complete portable metadata pins; the
  original exact body/ACL/configuration checks remain. Both certificate rows must
  match the current complete source digest, and readiness and erasure binding must
  already be valid before installation.
- The final checks compare all old public/private/rls_private function metadata.
  Only four exact modified bodies and the readiness literal can change. New
  function metadata/bodies, table columns/constraints/ACL/RLS/index, policy,
  two triggers, dataset relation append and publication flags/membership are
  constrained explicitly. Existing relations, columns, constraints, user triggers,
  policies and indexes must otherwise remain unchanged.
- The application creates no historical cache rows, starts no closure, erases no
  account content, changes no client, and calls no Edge/provider/Storage API.

The metadata pin removes only database-local function/namespace/owner/language
OIDs, resolves their names, and checks the function body separately. All other
pg_proc fields, including cost, parallelism, strictness and argument defaults,
remain pinned. The readiness body masks only its one pre-existing certificate
literal. This permits the same candidate bytes in disposable CI without accepting
an uncertified predecessor or inventing a future OID-dependent digest.

## Fresh DEV evidence and mandatory application preflight

The supported read-only connector returned canonical project
`leqcwgzvjsxugfgzdmth` at 2026-09-27 19:32 UTC: ledger 208, B3c absent,
zero EXECUTING closures and empty supabase_realtime membership. Both certificate
SHA fields were
`cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7`;
readiness definition MD5 was `092bab686aa5e8c32ce528cbb9767447`.
The adjacent JSON records the exact predecessor body and portable metadata pins.

Before any future approved live application, repeat that exact DEV preflight,
including both full certificate rows and readiness definition, and verify the
candidate hash against the successful exact-source application CI receipt. If any
predecessor value changes, stop and review the delta; do not refresh a pin silently.
Private digest/readiness helpers remain owner-only. The read-only connector was
not granted access; the candidate must execute its mandatory checks atomically
under the existing migration owner's authority.

The new digest is deliberately not predicted: it includes database-local catalog
identity. After application, an independent readback must verify the exact new
objects and body/authority hashes, both full certificate rows, the single readiness
literal replacement, and the unchanged remainder. The transaction itself requires
the new digest, readiness and erasure binding to agree.

## Disposable proof of the final candidate

`chat-b3c-dev-application-proof.yml` has manual dispatch with no inputs and a
narrow three-file push trigger on the canonical work branch. It reuses the exact
existing predecessor stages through B3b, then applies the already-live P0/P4/P5
candidates only to the disposable database. PKG-051 is excluded.

The existing B3c SQL/Auth proof first rolls back. The new
`private_invalidation_dev_application_proof.mjs` verifies all twenty source pins
against its immutable commit and checks byte-for-byte install-fragment equivalence.
It then exercises:

1. Five predecessor drift refusals with independent complete-catalog equality.
2. A real local account's canonical closure start inside a transaction, an explicit
   EXECUTING witness, and refusal of the application; the entire start rolls back.
3. The exact application bytes followed by rollback and independent catalog equality.
4. The exact application bytes committed on the local database, all three certificate
   bindings, preserved history, and refusal of a repeated application.
5. Real authenticated member/stranger row visibility, canonical message/cancel cleanup,
   and explicitly synthetic residual cache rows for non-vacuous erasure checks.
6. Four later source changes that invalidate readiness/binding and then roll back.
7. Both complete canonical requester and worker closures through the unchanged actual
   closure worker, including owned-content erasure, peer preservation, session refusal
   and unchanged unrelated Agreement/catalog/publication/history.

The planned result has twelve checks, seven refusals and four later drift checks.
These are expected assertions, **not passing runtime evidence yet**. Setup and raw
runtime logs stay outside the uploaded directory. Only five whitelisted sanitized
artifact files are uploaded, and teardown always discards the database without backup.

## Verification and limits

Local checks passed: JavaScript syntax; YAML parsing and narrow trigger/no-input
admission; Bash syntax of every workflow run block; identical embedded install
fragment; sanitized artifact/always-teardown contract; and six actual pre-IO
refusals for remote/redirected database or Auth configuration.

The new workflow does not claim a fresh websocket observation. That behavior has
the separate historical SQL/Realtime/closure receipt for the identical install
fragment. This new workflow specifically proves the combined atomic application
and full erasure path. No media objects exist in these fixtures, so Storage object
deletion is not newly proved. No device, client-subscription, concurrent workload,
query-cost or production acceptance is claimed.

Root owns commit/push, exact CI monitoring and any future concrete approval
question. No DEV application or approval request was performed by this preparation.
