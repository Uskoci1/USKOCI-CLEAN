# Resume verification, 2026-09-21

Starting source: `942d42d6`, branch `work/pre-v3-engine-integration-20260911`.
The handoff, AGENTS and the entire deep-read ledger were read before changes.

## Independently measured

- PKG-010 run 35646676736: completed successfully (source `64a5b6e8`).
- Canonical DEV ledger: 188 rows, 41 named `dev_alpha*`, hence 147 source rows.
- Both `uskoci_marketplace_tick` and `uskoci_edge_workers`: active, every minute;
  each had 120 successful and zero failed runs in the preceding two hours.
- `npx --no-install tsc --noEmit -p tsconfig.json`: exit 0.
- `npx --no-install jest --json --outputFile=jest-resume-result.json`: 239 suites,
  4566 tests passed. Jest warned that a worker needed forced teardown; no test failed.
- APK run 35643721833: succeeded at `54eaf5ec`; artifact `USKOCI-DEV-APK`,
  35,784,644 bytes, not expired (expiry 2026-10-05). No later commits changed `src`,
  app.config.js, package manifests or modules. No device was read or changed here.

## Not independently established through this connection

- Calling `private.closure_source_digest_v5()` returned PostgreSQL 42501,
  permission denied. No role change or grant workaround was attempted. Current
  live/certified equality and readiness must be checked through an authorized
  connection before any DEV candidate is applied.
- Worker authenticated responses are documented in PKG-030's final check. This
  resume did not invoke a worker or handle a key. Successful cron rows do not prove
  an actual work item completed.

## Ledger reconciliation

29 findings now carry dated, scoped status annotations grounded in the referenced
commits and package records. Historical observations are retained.
Do not present the previous `50 fixed` count as a freshly proved completion rate:
8.18's confirmation is fixed, but other-device closure recovery is still open;
8.7's copy is honest, but it does not supply an operator; 7.28 clears messages on
explicit logout only, best-effort on storage failure. Device validation is pending.

The untracked migration `20260913090000_clean_v5_fix_application_spam_and_resolution.sql`
is untouched and must remain uncommitted.
