# B3c DEV application receipt

2026-09-27. **APPLIED AND READBACK VERIFIED** on canonical DEV `leqcwgzvjsxugfgzdmth`. The owner explicitly approved live installation and all three certificate bindings. Root retained the separate P4/Edge scope.

The exact LF git blob from `82fd28b3b3b5cf1804db6bc02807e9572724841f` was applied once through the supported Supabase migration connector. Candidate SHA256: `3a22a168c115b966bd7ab178a797a1e91951a23ab9253d30ae74fab523cf4b27`. Ledger **208 → 209**, migration `20260927201030 dev_alpha_chat_b3c_private_invalidation`; its one stored SQL statement has that exact SHA256.

## Evidence and preflight

[Exact application CI 36345955454](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36345955454) passed 12 checks, seven refusal cases, four later-drift cases, both complete canonical closures, stages 01–26 and teardown. All 20 artifact source hashes match the immutable commit. The application report SHA256 is `7fd12e085fae6e0e00d106894276be7e3037d9756b16aa3390ed622f33a06ec8`.

Fresh DEV preflight at 20:06:40 UTC matched the preparation at 19:32:23 UTC: ledger 208, both full certificate rows, readiness definition, all 12 predecessor body/portable-metadata pins, empty publication membership, absent candidate objects and zero EXECUTING closures. No candidate changes or precondition exceptions were made.

## Verified application

Both complete certificate rows are now:

```json
{"singleton":true,"sha256":"f66818aa870492e397cb991e5e82f1f3d03262352b7830ce62c0d1aa9691755b"}
```

Both full-row MD5 values are `a45d727542f58b6e1502461f6065a805`. Readiness definition MD5 is `8bfe3af6ea5e67cfe40c9fb518f36ef1`; body MD5 is `ab11dc0dd359c75fb6b38885c023a368`. Comparison with the preflight definition and raw function metadata confirms exactly one old certificate literal changed and every other function field remained identical. Portable readiness metadata MD5 remains `60d41c1d50dbaedd8cbcd7a580fc21d2`.

All eight new/changed body hashes and authority pins matched. The body-free table has only Agreement ID/revision, forced RLS and authenticated SELECT. Its two canonical triggers are present. `supabase_realtime` publishes only INSERT/UPDATE and only this table; raw message tables remain outside the publication. The Agreement-message erasure dataset includes the cache. Postflight found zero EXECUTING closures.

The atomic candidate verified the complete old function/catalog baseline, exact new objects and permitted delta, no backfill, all three certificate updates, current source digest, readiness=true and matching erasure binding. Private helpers remain owner-only: the read-only connector did not gain execute authority or independently call them. The separate readback checked ledger SQL bytes, function bodies/authority, both full certificate rows, the exact readiness literal change, triggers, policy, constraints, publication and dataset metadata.

The machine-readable evidence is [the ledger receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3c_application.receipt.json). A first metadata-only readback used an incorrect dataset column name and failed without mutation; the corrected query succeeded. The migration itself was called once.

## Limits

No live messages, fixtures, closure, provider, Storage or device operations were performed. No Edge function or frozen migration file changed. The service was unwired at this application readback; subsequent client connection and native acceptance require their own evidence. Disposable closure success is not a live erasure or device-stream test.
