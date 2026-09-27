# B3c disposable recertification and erasure receipt

2026-09-27. **PASS on a disposable database. DEV unchanged; no live certificate approval.**

[Verified CI run 36344033190](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36344033190) completed successfully at source `04b66de6f2dbcd85aaf448152e7582085aabb1af`, tree `b61f9046abc2eb12f0127a5e1ee3ff0e1ac39587`. The source URL was read from GitHub run metadata. The earlier conversational link with a different repository name was incorrect.

The downloaded artifact contains only source binding/manifest/stage summaries and three sanitized reports. Every source hash in all three reports was independently compared with the exact committed bytes. Stages 01 through 24 and unconditional teardown all exited zero. Raw setup, database and runtime logs were not uploaded.

- chat-b3c-report.json: SHA256 `694ee81d5d058f6f171cf69a94da4e09b096fb720f1f4af5d2368a349caa02ad`; 5 checks PASS.
- chat-b3c-realtime-report.json: SHA256 `d3e1b4b018ee5d579c00ed04e462e6ffc134cd21e5676a65546318a09782d0f5`; 10 checks PASS.
- chat-b3c-closure-report.json: SHA256 `b8ed24367f3c86bda89566ceaea137793b1d4c8d431a3aa3b4beaffdb9be770c`; 11 checks PASS.

The closure phase changed exactly three certificate bindings: the two existing certificate SHA fields and the single certified-source literal in the readiness function. Its other metadata stayed unchanged. Nine refused admission/drift attempts preserved the complete catalog; four later source changes invalidated readiness and binding and then rolled back.

Both requester and worker completed the canonical review/start/replay/worker/finalize closure path. Each used 76 worker calls and 74 redaction steps. The proof verified owned message and cancellation-reason erasure, peer-message preservation, Auth identity soft erasure, zero remaining sessions, canonical rejection of the old session, and an unchanged unrelated Agreement. The final catalog, publication and migration history matched the recertified state.

Canonical cancellation first removed the invalidation cache. A separately labelled synthetic residual cache row for each closing account then made the erasure DELETE assertion non-vacuous. This is not presented as a naturally surviving canonical cache row.

## Limits

- Disposable local database only; no DEV application or certificate rebind.
- No provider or Storage calls; media/object deletion is not newly proved by these fixtures.
- No device, client subscription, concurrent race or load acceptance.
- Requester and worker canonical closure flows include explicitly synthetic residual cache rows, after canonical cancellation already removed its cache.
- Historical proved disposable candidate remains unchanged and is not a DEV application candidate.
- A separate exact application candidate must pass disposable proof and receive explicit approval before live certificate changes.

The adjacent JSON preserves the complete body-free reports, exact check names, source hashes, source binding and stage evidence. The original preparation document remains historical; this receipt supersedes its pending-CI status for this exact disposable source only.
