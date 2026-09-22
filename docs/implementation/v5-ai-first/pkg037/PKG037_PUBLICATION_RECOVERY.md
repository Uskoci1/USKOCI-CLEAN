# PKG-037 — bounded publication evaluation and durable recovery

Date: 2026-09-22. Baseline `5f54a788`. Deep-read **11.2**; interview/worker/QA finding 11.1 remains separate.
Status: disposable proof passed, SQL applied on canonical DEV, Edge v14 deployed and byte-verified.
Client APK built and hash/source/attestations verified; device verification pending.

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

## Proven and applied

Proof run [35669180188](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35669180188), source `2d6f0bc5`,
passed all 18 checks. Downloaded report is preserved as `DISPOSABLE_PROOF_RECEIPT_20260922.json`.
The earlier run `35668792526` refused the fixture's obsolete omission of intake dispatch; the fixture was
corrected to perform the actual dispatch and assert SUCCEEDED, without weakening any production rule.
Full local Jest: 241 suites / 4646 tests, exit 0. PKG-007 regression run `35668792540` passed on identical
production source; the second commit changes only proof and planning documentation.

DEV migration `20260921235240_dev_alpha_pkg037a_publication_review_expiry` applied after fresh body pins.
Ledger is **192 = source147 + dev_alpha45**. Recorded SQL SHA256
`cb4f0c605739dbd87a48775648db18bbaf4b6bab7a5d0b593f921cc6afada472` equals the committed candidate without
its last newline. Live sweep source MD5 is `9d89b9af2e893bc608e7598d175551b7`; owner, ACL, definer and search
path are unchanged. The transaction asserted live certificate/readiness and unchanged digest before commit;
certified `65980fce…` reads back unchanged. No separate private-function execution is claimed.

Review counts before/after application remain four ACCEPTED, two EVALUATED, nine PUBLISHED, zero EVALUATING.
No existing user row was rewritten by application. Both existing cron jobs remain active every minute.
Receipt: `supabase/operations/dev-alpha/ledger/20260922_pkg037_application.receipt.json`.

The first exact-byte deployment using the already cached Supabase CLI 2.117.0 returned upstream HTTP520;
readback confirmed unchanged v13. The retry succeeded. **v14 is ACTIVE, verify_jwt=true**, and both files
read back byte-identical to the proven source: entry `3321cd13…`, budget helper `2ef0c3a1…` (full hashes in
the receipt). The CLI used exact committed files staged under ignored artifacts; no dependency installed
or credentials read. APK run35669226055 succeeded on source2d6f0bc5; its downloaded 68,550,407 bytes have
SHA256 `e47955fdb6ed8f7fea6029f4deb3e7c391a03d2c6c988ee2650aef51b90b9749`, matching the checksum and
both source-bound recovery/icon attestations. See `APK_RECEIPT_20260922.json`. Device verification remains pending.

Unauthenticated POST to the deployed gateway returns HTTP401 without invoking a provider. The existing
marketplace cron readback shows five successful runs and zero failures in five minutes. There was no real
expired review to recover; cron health is not a claim that a paid end-to-end publication was exercised.

## Runtime reference

Supabase's [background-task documentation](https://supabase.com/docs/guides/functions/background-tasks)
clarifies that handler/background lifetimes remain bounded. This implementation awaits bounded metadata
settlement; the SQL sweep provides durable crash recovery rather than assuming an isolate stays alive.
