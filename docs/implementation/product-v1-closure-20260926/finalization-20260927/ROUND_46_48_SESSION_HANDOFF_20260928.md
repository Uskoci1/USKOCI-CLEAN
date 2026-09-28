# Round46–48 — measured P6 continuation checkpoint

This is a continuation/evidence addendum, not a release declaration. Always resolve the latest HEAD of work/uskoci-ui-unification-20260924 before proceeding. Do not restore an older recorded commit.

## Verified prior packages

Round46 source 2b04f863b78e7182657600dd1dbfe8534818faa4, run36451155987, evidence commit7f85f28a705eedef935a9db1fcd91ee261ae6fa5: 11 original SQL groups,120 timings and three nested ANALYZE BUFFERS plans. Ten parser regressions reject missing/duplicate samples or wrapper-only plans. The query-proof package passed, but PAGE/MAP/PLACES failed its1000ms SQL screening ceiling. The original42501 instrumentation attempt is retained in ROUND_46_FAIL_36449434649.json.

Round47 source1af01119ffbc6aba75ce82c0c85405a0982cc58f, run36454436800, evidence commit5a179c00724eeae37ffcd09e00d2c5b07c5ccea5: guarded cost_v2 delta,13 SQL groups plus explicit-date parity and240 paired timings. It preserved every compared payload field except observation timestamps and used shared valid anchors. It did not meet the SQL ceiling; the original candidate and its failures remain unchanged.

## Round48 accepted package

Tested source0fe9e47c8e2f51fffd9d3943e6329c056c591851, run36458016326, evidence/control HEAD3d1fc6adef45c40851d380a1b00f354be04f893c. All SQL, HTTP, teardown, real control generation and guarded publication steps completed successfully and the resulting branch was independently read back. See ROUND_48_P6_LAZY_LOCALITY.md and ROUND_48_P6_COST_CHECKS.json.

The optimized candidate preserves full normalized payloads, date ranges, text/locality/capability matching and canonical nonzero coverage. Thirteen SQL groups,240 timings and eleven real local Auth/PostgREST/current-decoder groups pass, using three local password sessions and47 HTTP requests. The normalized read-only metadata comparison matches the observed eleven function bodies and column/policy/index dimensions on seven tables, including all41 Need columns. This is not complete current-ledger or certificate acceptance.

Accepted-run p95 milliseconds (original -> optimized): PAGE770.152 ->651.550; MAP801.197 ->629.871; PLACES899.456 ->675.763; EXACT_PUBLIC2.713 ->2.747. The same SQL bytes exceeded1000ms in the previous runner. The original baseline also changed substantially between runs. Do not attribute that cross-run difference to a code change or declare sustained performance proven. The paired same-run ratios are useful; cross-environment reliability, distribution/capacity/concurrency and native budgets remain open. The optional function profiler did NOT execute (available=false, samples=0); no privilege was elevated.

The original plus guarded cost_v2 and cost_v3 remain proposed source-only SQL, not an applied migration. Their SHA256 values are recorded in the receipt. No data/authority migration was performed on canonical DEV.

## Superseded Round47 run, not current acceptance

Run36453644351 tested c58cd06d8969a522091dd8ac5fdbbf234bb666a7. The then-current test set passed, but the candidate omitted range_from from its MAP/PLACES no-date shortcut. Source review caught this before acceptance. The corrected source1af01119 added `and range_from is null` and six explicit-range comparisons. The older workflow's unchanged-HEAD guard refused to publish after the branch moved. Its receipt is preserved exactly, not relabeled FAIL internally or reused as evidence for the corrected source.

Original artifact10985082025; ZIP SHA2561b6bf1e92d10dfb4fd07f895d56d388b3271c7351c236aa58bf64ba1c9aefc854. Exact JSON SHA256bbf14d8c4eb4f4244a87050396c16eec2bf4ffa1655bf3a4bc28221a6a302874, Git blob79826845ecfffbec681ba1bd84af80006392d6da. See ROUND_47_SUPERSEDED_36453644351.json. Never apply its artifact patch over later source.

## Failed Round48 wrapper attempt retained

Run36457367511/source924bba292bc2e2e2ed3898f85233b8c8039a882e completed its SQL and underlying HTTP phase checks, then its receipt wrapper failed before record/publication. Source review and an executable local regression reproduced the undefined generatedHarnessSha256 shorthand. Commit0fe9e47 fixes the binding and executes the same serializer assertions in early admission. The corrected full run was not accepted until all steps and its branch push passed.

ROUND_48_ATTEMPT_36457367511.json records the phase-level disposition and source of the diagnosis without pretending private CI logs were recovered. Raw SQL and HTTP phase receipts are preserved byte-for-byte in round48-attempt-36457367511/. The enclosing workflow remains failed; do not reinterpret those phase PASS values as a successful old package. Original artifact10986637824, ZIP SHA2563ce76e945e435dbd235aaccfd460a9eae79cd1c0aad9be8332c7ade4f0dec5ac.

## Invariants and limitations

Canonical DEV was accessed read-only for catalog information, not private user rows. No canonical package, ledger entry, existing authority/certificate, paid provider, native dependency, payment or exact-push flag was changed. PKG045b retains its already documented conditional compatible-device rollout gate; do not ask for a duplicate broad approval or force an old precondition.

Production Discovery remains on its old reader. TaskCard/Peek and the logical FULL/native-remount return correction are untouched. No Android/iOS binary or device proof was produced, and no previous APK proof is inherited. Local Auth is not external email delivery, signup confirmation, a physical device or store acceptance. SQL timing is not network/native end-to-end latency.

The complete P6 server candidate still needs wider distributions/capacity/load budgets, the live rollout/precondition procedure, paging ownership/stale fencing/map/locality adapters and exact native acceptance. Voice, external push/AI/email provider, account/safety/export/closure, final privacy/legal and store gates are not closed by these packages. Remaining engineering must not be described as merely waiting for owner approval.

## Control, archival scope and next exact action

The existing generator ran inside each accepted package. B04/B05, redovi.json and generated stanje.json/FINALIZATION_MATRIX.md/tabla.html are already committed with their receipts. This archival addendum changes only implementation evidence and clarifies the Round48 narrative; it does not manually edit generated output or change its correctly scoped per-run screening result. Hosted control publication remains unverified.

The next engineering package should establish a controlled performance baseline and isolate the remaining cost before further optimization, then extend distribution/capacity/load proof and the paging/stale-request/map/locality adapters. Safe preparation does not need another broad owner approval. Applying a canonical server package, modifying certificate-controlled definitions, new native dependencies and external provider/device/store acceptance retain their specific gates.

These record writers intentionally refuse overwriting existing round receipts; do not blindly rerun a one-shot publication workflow after its round has been recorded. Reuse its proof methodology in an explicit new round with fresh source hashes and preserved earlier outcomes. The final archive commit is docs-only; all accepted executable proof stays bound to the exact tested source above. No later or background work is claimed.
