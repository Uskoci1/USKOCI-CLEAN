# P4 opaque push transport — disposable PASS receipt

**SQL/Auth and actual Edge handler PASS; DEV application, Edge deployment and
native push delivery remain unproved by this package.** Client integration is a
separate workstream; this receipt does not attest its installed state.

[Run 36345502344](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36345502344)
passed at exact commit `b4561a9ccb0f49cbdb78782aa16232857cfb8fda`:

- 10 transport checks, including real Auth/PostgreSQL, service-only begin receipt,
  malformed/foreign/deleted event and lease/device/session/preference refusals.
- 13 unchanged P4 resolver checks and 101 synthetic Edge/copy tests.
- Actual Edge → local SQL → two intercepted Expo sends → owned resolver → exact
  message window. Legacy data and opt-in message data both pass; no read ACK.
- Full catalog restored, certificate/binding unchanged, all 23 stages and teardown
  successful. Zero real provider or Storage calls; three disposable actors and one
  agreement.

Independent validation recomputed all 14 report source hashes and the entire
712-file source manifest from Git blobs. The unchanged SQL candidate SHA-256 is
`bd4957d6a2534d892c64839e0dd8fbd6b03267c9bd18159a6cf7b6ae1824e450`;
new begin body MD5 is `ea801be7205a8b07c7c94e20af3bd90e`.
`P4_PUSH_TRANSPORT_RECEIPT.json` contains the hashes, complete checks, run metadata
and retained failed-run evidence.

The previous run `36344974563` failed because its synthetic fixture reused one
provider ticket for two sends; the existing unique index correctly rejected the
second completion. Only fixture tickets and fixed diagnostic stages changed.
Candidate SQL and Edge bytes match the failed run, successful run and current
source recorded in the receipt.

Metadata-only DEV read at `2026-09-27T19:54:43.313707Z` matches the A1/P4 bodies,
authority and configuration at ledger 208. Both complete certificate rows and the
readiness-definition fingerprint are unchanged. SEND_LEASED, SEND_STARTED and all
unexpired lease counts are zero; current worker metadata is ACTIVE v21. Privileged
digest/binding/readiness functions were not executed, environment names/values were
not retrieved, and this snapshot cannot prove a future deployment has drained old
executions. The JSON receipt records these limits and exact admission requirements.

The next deployment boundary is explicit authorization and live preconditions:
confirm names-only absence of the optional exact-target flag; deploy and read back
the compatible Edge with legacy data; drain old executions and leases; then apply
the exact guarded SQL and verify ledger/authority/certificate invariance. Preserve
existing gateway, credentials, cron and formatter. Do not roll back Edge alone
after SQL. See `P4_PUSH_EVENT_TRANSPORT_20260927.md` for the concrete sequence.

Real Android/iOS transport, cold/live tap, current-account ownership and measured
viewport ACK still require device evidence. The global exact-payload switch stays
separate until every active push registration's supported installed client is
compatible. One upgraded phone is insufficient; older clients reject the extra
metadata, and this package provides no per-device capability negotiation.
