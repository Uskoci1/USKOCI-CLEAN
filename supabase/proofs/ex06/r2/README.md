# EX-06E R2 — reopen identity and Need-time hardening

SOURCE/DISPOSABLE ONLY. NOT APPLIED TO DEV. This is a bounded continuation of EX-06E, not a new product or tracker.

R1's green run 37230071628 and exact input hashes are preserved. `build.mjs` deterministically produces a combined candidate and exact code revert from those frozen inputs plus these source patches; apply only the combined output, never a partially patched R1. Each generated output carries a SHA-256 in manifest.json. A changed predecessor or source anchor fails generation.

## Proposed delta

Existing dispatch_next_wave and rpc_cancel_agreement use a fresh clock after the Need lock. dispatch_tick keeps the two terminal stop reasons. The existing closure trigger and existing close command stay byte-identical. The new private time helper also honours an explicit generic FLEXIBLE end and treats the exact endpoint as closed; it never invents an end from a generic start alone.

The new canonical signature is `rpc_reopen_remaining_search(uuid,integer,timestamptz,text,text)`: Need, revision, exact observed closedAt, immutable command key, reason. The unsafe four-argument form is absent. The request hash binds operation and closure instant; the stored receipt also identifies the operation. Shared-ledger locking uses exactly the close command's key space/seed. Cross-operation collisions are refusals, never interpreted as success. A delayed first reopen cannot clear a newer manual closure. Replays return history, not a claim about current search state.

Code revert first checks both new bodies, ownership, grants, argument names/defaults and function attributes. It refuses later drift instead of silently deleting it. It restores the three original bodies and removes the two new functions; it does not rewind user data or delete command history.

## Intended evidence

Retain all nine R1 groups; add seven R2 groups, including two actual blocked API requests that begin before expiry and finish after it. Observe pg_blocking_pids, query_start and database time, not only a timer. Reproduce the original closed-search retry before the candidate and after code revert. Prove refusal on duplicate apply/new-body/grant/volatility drift and exact reapply/revert.

All Auth/PostgREST/SQL activity in these scripts is guarded loopback. No paid providers, physical phone, new dependency or live DEV write. Synthetic time fixtures are labelled. CI results are not presumed until artifacts are read.

## Still outside this bounded proof

A differing accepted Agreement window versus its parent Need, per-cancelled-allocation replacement time authority and the full newer DEV replay remain open. No blanket +24h replacement window is introduced. The helper here is intentionally a Need-time gate, not a fabricated per-person replacement ledger.

Client/UI remain unconnected: capture exact server closedAt without millisecond rounding, retain the same command on unknown outcomes, reread current owner state after a receipt, and add an owner-authoritative canReopen/time-reason projection before showing the new action. Existing Dogovor completion/problem/change actions remain the post-window next-action contract. F5 and large code cleanup remain outside this work.
