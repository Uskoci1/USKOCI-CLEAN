# PKG-035 — actionable applications are distinct from history

Status: proved and applied to canonical DEV, 2026-09-21. No device verification yet.

Deep read 7.32: Home and task cards used all visible responses as applications waiting for selection.
Withdrawn, selected, stale and closed responses belong to history, not actionable attention.

The candidate introduces one private candidate-state reader, used by the existing candidate list and an
owner-bound computed `selectable_application_count(needs)` field. The app can read this in its existing
task query at one database snapshot; it adds no per-task client round trips. The Home aggregate uses the
same count. Historical totals and candidate identities remain intact. A caller-supplied composite supplies
only an ID: the stored task must belong to the current open account; another account receives null.

The classifier checks current task state/deadline, version, worker readiness, capacity, requirements,
the actual proposed agreement interval and PKG-033's shared price assertion. This is a snapshot of
application eligibility, not a reservation or a guarantee against concurrent changes or a future unavailable
connection policy. Final selection still owns locking, idempotency and admission. The reader preserves
the installed candidate-state vocabulary and receipt shape.

Proof: exact replay through PKG-034, before/after scenarios using actual readers and final selection,
owner/spoof/anonymous controls, total-history preservation, precise surface diff and unchanged closure
certificate. SQL scenarios use rolled-back transactions. A separate real Auth/PostgREST check uses local
synthetic accounts and a committed local task, discarded with the disposable stack; no DEV fixtures.
No existing data, trigger, policy, table, certificate, JWT setting, dependency or provider is changed.

Client: Home attention, marketplace attention, task card and task detail use the separate selectable
count; task history retains its total. The mapper rejects missing/invalid server counts rather than
guessing from history. Null is preserved for viewers who are not the owner. Existing clients continue
reading the old fields; deploy the server before installing this new client.

Local validation: types clean; 240 suites / 4606 tests pass. Three new Home/detail regressions fail on
the previous production source and pass after the change. Seven mapper tests cover the computed field,
invalid data and a non-owner null. The historical PKG-023j replay adapter explicitly keeps its old
attention-count semantics; it does not claim to prove current eligibility. PKG-035 owns that proof.

The first disposable run reproduced the old defects, applied atomically and kept the certificate, but
caught a bug in the new classifier: duplicate record field names read the obsolete response interval.
Explicit version_start/version_end aliases fix it. A complete rerun is required before DEV application.

Final run `35658331088` at `3eaa5e55bfdce2ccf29754c1372688010a2226a1` passed **38/38** checks.
Downloaded report and source binding inspected. Real local Auth/PostgREST verifies the computed query,
owner isolation, spoofed composite refusal, anonymous refusal and four selectable tasks out of nine:
three attention rows plus +1. The REST fixture was corrected to reuse Auth-created profiles and omit
generated geography columns; no product restrictions were relaxed to make that fixture pass.

DEV preflight: ledger 190 = 147 + 43; both new readers absent; all six predecessor/dependency pins
matched; five historical response rows, three in selected/non-active states. Applied the committed LF text
without its final newline as `20260921214247_dev_alpha_pkg035a_selectable_application_counts`.
Ledger after: **191 = 147 + 44**. All four body hashes, owners, definer/volatility/configuration and ACLs
match the proof. Migration text SHA-256:
`c0931ffa78e8f5ac7d185343bbadd672675b2c2c08b37181b6af3710f7f781b4`.
Successful transaction asserts the ready certified source before and unchanged digest/readiness after.
Direct private digest execution remains unavailable through this connector; no privilege escalation or
independent post-execution claim. No existing user rows, JWT setting or certificate changed.

Receipt: `supabase/operations/dev-alpha/ledger/20260921_pkg035_application.receipt.json`.
Compact evidence: `PROOF_SUMMARY_20260921.json`. Related CI on client commit `62e90e92` passed:
PKG-004 `35657744872`, PKG-007 `35657745051`, historical PKG-023j `35657744862`.
Local inventory check still refuses the owner's foreign untracked migration; the CI tracked 147-source
inventory passes. The foreign file is neither changed nor committed.

New APK run `35657828926` succeeded from `fe60a385` (includes client `62e90e92`). Downloaded APK
SHA-256 `2afcefc1044bc9b0c6f74c89ebe90d9c8411cf9616883cd4bb8462122ada4855` matches its checksum
and both PASS attestations; see `APK_RECEIPT_20260921.json`. It has not been installed/tested on a phone.
Old verified APK `35654417281` has SHA-256
`af669ad295a70d8443aead32d3abfc1877e20e2a78bb681de3813e94c39d9675`, but lacks PKG-035.
The complete Home aggregate remains unwired; this package fixes actionable facts, not all list reads.
