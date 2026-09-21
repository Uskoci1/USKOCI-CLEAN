# PKG-035 — actionable applications are distinct from history

Status: candidate, not applied to canonical DEV. No device verification yet.

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

Pending: inspect final CI proof, read-only DEV preflight and authorized apply. No phone installation.
