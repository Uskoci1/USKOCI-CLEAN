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
certificate. All synthetic records are inside rolled-back transactions on the disposable database.
No existing data, trigger, policy, table, certificate, JWT setting, dependency or provider is changed.

Pending: run and inspect CI proof, client regression tests, read-only DEV preflight and authorized apply.
