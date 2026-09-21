# PKG-037 — bounded publication evaluation and durable recovery

Date: 2026-09-22. Baseline `5f54a788`. Deep-read **11.2**; interview/worker/QA finding 11.1 remains separate.
Status: implementation written; local tests passed; disposable proof / DEV application / Edge deployment pending.

## Problem and behavior

A single 12-second signal covered authentication, media, provider and completion. If it expired after the
review was claimed, the same aborted signal prevented recording failure. The client stopped waiting after
15 seconds. An isolate lost after claim left a durable EVALUATING/UNKNOWN_OUTCOME with no terminal exit.

The proposed change preserves the one acceptance / one provider attempt boundary:

- Edge: 15 seconds for preparation, a separate 30-second provider window and an independent five-second
  metadata settlement window. Their maximum combined 50 seconds fits within the existing 60-second lease.
- One memoized settlement per invocation. A lost ALLOW acknowledgement never triggers a contradictory
  failure write. Late provider results after abort cannot become publication authority.
- Client: only accepted-review evaluation waits up to 55 seconds; ordinary receipt reads still use 15.
  Durable owner-bound readback remains mandatory; no timeout callback starts another paid request.
- SQL candidate: the existing minute sweep ends up to 100 expired publication claims per tick as an
  existing EVALUATED / NOT_READY receipt. No new state, table, trigger, provider call, publication or refund.
  Locked rows are skipped; terminal and unexpired commands remain unchanged. Attempt and request IDs remain.
- Existing review UI can then offer its supported edit-draft exit. The user explicitly reviews/accepts a
  new draft revision; this package never retries an uncertain paid attempt automatically.

The sweep is the recovery path for an isolate crash or a lost claim/settlement acknowledgement. It is
bounded by lease expiry and the next healthy scheduled tick, not a promise of recovery during a database outage.
No applied migration is rewritten. Certificate movement and JWT changes are outside this package.

## Measured baseline

- DEV ledger191. Four ACCEPTED, two EVALUATED, nine PUBLISHED review commands; no current EVALUATING row.
  This is a latent failure mode reproduced in tests, not a claim of present user data corruption.
- `uskoci-publication-evaluate` v13, `verify_jwt=true`: entry bytes identical to git, SHA256
  `be8a5a72509687347b6c5d585bde42f389d2f3e8a1d37ff12aa18d39c47ee293`.
- Deployed budget helper `3153216c…` differs from git `2ef0c3a1…` only by the latter's two additional speech
  settlement exports. The reservation function and constants are unchanged; publication imports neither export.
- Live sweep source MD5 `3aa616ba34af5dadc798c1765128be96`; completion authority `d8ace4d564121c88e62009b1f908df76`.
  These are `md5(prosrc)` with LF normalization, not the earlier investigation's full-definition MD5s.
- Sweep and review completion are absent from the certified erasure function list; the command table has
  no trigger. Candidate still asserts unchanged closure digest/readiness atomically.

## Verification and application gates

- Six initial Edge regressions: old source **5 fail / 1 pass**, updated source **6 pass**.
- Initial slow-client regression fails before, passes after. Focused review-client and native review suites:
  80 tests passed, including the longer bounded wait and readback without provider replay.
- Complete Edge suite: 47 tests passed, including failed photo fetch after claim. TypeScript passed.
- Disposable proof reconstructs source147 plus all applied dev_alpha texts through PKG-035; compares
  unchanged certificate, exact changed surface, predecessor/body tampering and second application refusal.
- Actual local Auth/PostgREST, review claim/completion/read/publication RPCs and exact Edge handler are
  composed in the proof. Budget admission and provider output are explicitly synthetic, with external IO denied.
- Required cases: expired/unexpired/accepted, no reclaim or unauthorized publish, foreign read refusal,
  lost claim ACK, provider timeout, transport failure, lost completion ACK preserving ALLOW, terminal
  publication preservation, bounded batch, unchanged certificate. Local transport cases include photo failure,
  caller disconnect, cleanup timeout and late result rejection.

No paid provider call or DEV test account. No phone verification. Deploy only after the disposable proof passes,
read back exact Edge bytes, preserve `verify_jwt=true`, verify migration ledger text and record receipts.

## Runtime reference

Supabase's [background-task documentation](https://supabase.com/docs/guides/functions/background-tasks)
clarifies that handler/background lifetimes remain bounded. This implementation awaits bounded metadata
settlement; the SQL sweep provides durable crash recovery rather than assuming an isolate stays alive.
