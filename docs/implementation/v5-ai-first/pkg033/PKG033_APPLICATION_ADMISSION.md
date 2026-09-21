# PKG-033 — application admission after a task edit

Status: candidate and disposable proof prepared; **not applied to DEV**.

Deep-read findings 3.1 / 7.3 / 12.6: the ordinary application checks fixed-price basis, current capacity and a
ready owned profile, while KEEP/UPDATE after a task edit skips those checks and the capability snapshot.
Selection previously copied that unchecked price into Agreement terms. WITHDRAW on this path emitted no event.

## Change

`pkg033a_application_admission_parity.sql` extracts the existing price rule into a private invoker helper, callable
only by the owner of the existing security-definer RPCs. Submission, reconfirmation and selection all use it.
Reconfirmation checks the current visibility world, deadline, profile readiness, remaining and team capacity,
and the actual proposed calendar interval; it writes the same capability snapshot and canonical content hash
as submission. Withdrawal emits the existing withdrawn event and expires pending notifications. Existing rows,
prices, agreements, table definitions, triggers, grants on existing objects and the closure certificate are unchanged.

The candidate pins all three live predecessor bodies measured on 2026-09-21, asserts each patch anchor once,
checks exact resulting bodies and existing function authority, and refuses if the live closure source is not
certified and ready before the change or differs after it. It does not rebind the certificate.

## Evidence and limits

The CI workflow reconstructs source147 plus the exact 41 recorded DEV candidates through PKG-032. It checks
the three reconstructed predecessor bodies against DEV before testing. Synthetic accounts and tasks exist
only in rolled-back transactions on the disposable local stack; the harness refuses other database URLs.

The before phase reproduces the price/readiness/capacity/deadline gaps and missing withdrawal event.
The apply phase rejects a tampered pin without changing the surface, applies once, rejects a second application,
and checks that only three functions and one new private helper differ. The after phase checks both admission
paths, valid fixed and negotiated prices, exact retry replay, snapshots, content hashes, selection and withdrawal.

No CI pass is claimed until its report is downloaded and inspected. Initial run `35650880508` reproduced all
eight admission gaps, then exposed an invalid 32-character fixture hash at selection; the fixture now carries
SHA-256, as the real version writer does. The failed proof did not reach candidate application.

The client now reads the current task price mode/basis, amount and required places together with the existing
version-bound interval. Missing or inconsistent pricing refuses editing. A per-person price follows headcount;
a total price locks the offer to all required places. Negotiated offers remain editable. Known server refusals
reach the screen as definite outcomes and permit fresh review after readback, instead of an unknown network result.

Local validation: TypeScript clean; full Jest **240 suites / 4,596 tests passed**. Both new monetary screen tests
were run against the previous production screen files (`fe2269d1`) and failed, then pass with the fix. The old
files were restored to the new working copies in a `finally` block. No device test has been run; the previously
reported APK does not include these new client changes.

The resumed DEV connection denied execution of the private closure digest function. The owner has been asked
for the nonsecret live/certified/ready result; no DEV mutation is allowed before the prerequisite is confirmed.
The migration rechecks it inside its own transaction as well.

Local source-integrity checker currently refuses the owner's explicitly excluded, untracked foreign migration
`20260913090000_clean_v5_fix_application_spam_and_resolution.sql`. It has been left untouched and excluded from
commits. CI evaluates the tracked inventory; this local refusal must not be described as a passing local check.
