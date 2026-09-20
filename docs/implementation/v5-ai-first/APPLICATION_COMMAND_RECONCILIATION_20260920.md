# Named application command readback — 2026-09-20

Base: `40ca9b2eeee771633d03fc3698ef444a40de288b`, branch
`work/pre-v3-engine-integration-20260911`. This is the client prerequisite to paging
My applications (release-plan R15), not the paging implementation or a Home rewrite.

## Behavior

Previously `moje-prijave.tsx` reconciled a pending withdrawal/KEEP/UPDATE against
the returned list. An omitted subject could never confirm withdrawal, while merely
reading the list unlocked retries without establishing the named subject's state.

`readApplicationCommandState` now reads the exact response id, need id and current
account through existing table SELECT authority. It requests persisted command facts
only, with no Need join or profile/location/contact data. This remains usable for an
owned response when its task stops being public. It deliberately does not filter by
the old response version: KEEP/UPDATE advances it. Missing, malformed, inaccessible,
regressed-version or timed-out rows do not complete reconciliation.

The screen reads the list and, only when reconciling a settled pending command,
the named row. It retires the previous reconciliation before every read. Its focus,
background, account-incarnation and read-generation fences guard both results.
Only a valid named read permits the existing immutable-key retry or explicit review.

- Withdrawal still requires a persisted WITHDRAWN row at the original or a later version.
- KEEP/UPDATE still require the validated command receipt; a similar stored offer
  without the receipt never proves which request committed.
- The receipt plus exact incremented response version, submitted Need revision,
  price, people and note establish the saved offer against the reviewed revision.
- UPDATE additionally compares both proposed instants at PostgreSQL microsecond
  precision, including equivalent timezone offsets and explicit nulls.
- A subsequent Need edit/closure changes the current server projection, not whether
  this command was saved against the reviewed revision. Success wording explicitly
  refers to that reviewed revision; the existing list displays today's lifecycle.
  No client replacement for `private.my_application_state` was introduced.
- KEEP's interval preservation remains certified by the existing server command;
  that interval is not available in the list projection and is not invented here.

The existing list remains unpaged. Notification landing, scope/tab counts, Home
aggregates and active-list paging require their own integration. Pending intents
remain screen-session scoped as before; no new durable command journal is claimed.

## Authority checked

Read-only canonical DEV metadata confirmed `responses_worker_read` permits only
`worker_account_id = auth.uid()` and the restrictive `v5_closed_account_visibility`
policy applies `rpc_storage_account_open()`. The explicit client owner predicate
also excludes rows visible only through the requester's response-reading policy.
The decoder rechecks both subject ids and account ownership.

Live check constraints confirmed version/revision positivity, positive price,
people 1..50, persisted statuses and paired/increasing nullable proposed instants.
A read-only `WHERE false` query verified the requested column shape without
returning personal data. These metadata/shape checks do not simulate authenticated
PostgREST, impersonate any account or prove a phone flow.

No migration, dependency, provider call, DEV fixture, permission change or device
installation occurred in this packet. The separately approved pkg023j remains
installed at ledger165; frozen source147 and pkg023c/price_basis holds are unchanged.

## Verification

- Before implementation: nine new screen regression cases failed against the old
  production code; the two existing matched cases passed.
- After implementation: three affected suites / 79 tests passed.
- Regression coverage includes list omission, failed/absent named reads, unknown
  outcome replay, task re-edit, microsecond disagreement/equivalence, stale callback
  retirement, account A-to-B-to-A, navigation, background and bounded waiting.
- TypeScript (`npx tsc --noEmit -p tsconfig.json`): exit 0.
- First full `npx jest`: 232 suites / 4,491 tests passed; the known Windows
  load timeout in `w02-location-native.test.tsx` failed (exit 1). That entire
  location suite then passed alone: 22 tests, exit 0. The failure is retained.
- Full sequential `npx jest --runInBand`: 233 suites / 4,492 tests passed,
  exit 0. Jest printed a delayed-exit warning and then exited naturally.
- The three affected suites with `--detectOpenHandles`: 79 tests, exit 0,
  no open handle reported. The whole-suite delayed-exit cause is not established.
- Migration integrity: PASS, frozen147 unchanged. `git diff --check`: passed.

Device and full authenticated network verification remain open. Passing mocked
client tests is not a claim of App Store / Google Play readiness.
