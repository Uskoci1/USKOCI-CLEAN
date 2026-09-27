# Round 18 — expanded map and optional read budget

## Product decisions and implementation

The native expanded public map was inspected on APK36330066989/dfe2836e, using an existing task in read-only mode. Its canvas was fixed at half the window height, leaving unused space below navigation. `LocationMapPreview` now keeps its header outside a flex content region. `LocationOverviewMap` accepts a fill mode for that region; numeric compact-preview heights remain unchanged. Short actions use their natural height; long stop lists and attribution links have bounded scrolling. A single valid point shows the brand mark without a redundant visual number; multiple/coincident points retain their numbers. Private grant, account, foreground, focus and external-navigation checks remain unchanged. Approximate public areas are still distinguished from exact authorized places. Evidence before the change: task-workspace `outputs/finalization-20260927/live-detail-map-expanded-settled.png` and XML.

Discovery's optional urgency enrichment previously allowed each RPC up to15 seconds and drained multiple batches. It could therefore consume the entire parent list deadline even after the public rows were available. `readNeedUrgencies` now shares one4-second budget across at most four workers. A linked abort boundary settles the validated receipt as well as the transport, retires queued requests, rejects late mutations and returns a copy of completed validated results only. Account/revision or caller cancellation returns no retained metadata. Unknown urgency remains absent, never a fabricated NORMAL value.

TaskCard, DiscoveryPeek, public list/filter/bbox semantics, dependencies, payments, DEV, Edge and certificates are unchanged. The collection still reads up to25x200 rows; this package improves waiting behavior, not backend scaling.

## Validation

- Map/navigation: four focused suites /63 tests PASS, including the private-location guards and external-link semantics.
- Urgency/public reads: three focused suites /43 tests PASS, including a hanging1000-row candidate pool, bounded dispatch, partial valid results, malformed metadata, shared deadline, cancellation, account retirement and late completions.
- Integrated `npx tsc --noEmit -p tsconfig.json`: PASS, exit0.
- Diff whitespace check: PASS. No full-suite run.
- New map layout and hanging-network behavior are not yet natively accepted; the consolidated APK/device receipt follows separately.

## Separate B3c proof result

[Run36333212694](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36333212694), source3dc23096b67d4fb84c49a9bfc7579af675de62d3, passed the exact disposable SQL/Auth proof. Four local actors, two disjoint Agreements and three admitted sessions were used. All five bounded stages passed, including SQL authorization/metadata assertions and independent rollback equality for catalog, certificates and fixture state. Candidate SHA256: `3fb8c1e9e3f645fb28f00ba5cf4c18b3b4b1bf8db8587bd44f1f1a94b1df3096`.

This is not websocket delivery, concurrency, certified erasure, DEV application or client subscription acceptance. The candidate remains non-deployable and leaves the changed disposable source uncertified until rollback. No certificate moved. The exact uploaded report is preserved beside this document as `ROUND_18_B3C_SQL_RECEIPT.json`.

## Next

Accept Round17 calendar containment in installed APK36332545768/eff72a25. Build this consolidated map/read-budget package, then check expanded maps and retained return paths. Continue the separate private realtime proof and bounded Discovery contract. P0 exact-public lookup still awaits the explicit application answer already requested. The hosted control page remains pending upload under its observed file-chooser failure; local generation is not publication.
