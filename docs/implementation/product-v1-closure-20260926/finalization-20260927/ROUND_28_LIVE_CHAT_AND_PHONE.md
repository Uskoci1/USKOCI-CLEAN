# Round28 — approved servers applied, chat connected, physical phone updated

2026-09-27. **DEV210 / PUSH EDGE22 / CLIENT CONNECTED / SCOPED PHONE PASS.**
Whole-product release, native realtime stream and exact provider push remain unproved.

## Problem and cause

The prepared private conversation invalidation channel was not live or connected.
The push worker could not accept the new event hint while preserving legacy clients.
The connected physical phone still ran the previous build.

## Product and UX decision

An open, admitted Agreement conversation now receives only body-free revision hints,
then rereads existing authenticated bounded history. Push and CDC share one read owner,
so simultaneous signals do not start duplicate reads. This changes freshness, not the
TaskCard, Peek, chat layout, message authority, outbox or displayed-message ACK rule.
Leaving, backgrounding or changing account/session retires both hint sources.

## Implementation and files

- src/data/agreementInvalidationService.ts: strict body-free row decoder, current-owner
  channel lifecycle, SDK reconnect hints and cleanup.
- src/data/agreementIncomingRefresh.ts and src/hooks/useAgreementIncomingRefresh.ts:
  one shared coalescer for native notifications and PostgreSQL changes; one active and
  at most one trailing read. Supabase-only channel; existing native fallback retained.
- Three focused tests and B3C_CLIENT_SOURCE.md record ownership, malformed payload,
  partial registration, cross-source bursts and lifecycle regressions.
- Two immutable live application receipts under supabase/operations/dev-alpha/ledger.
  No frozen migration, new dependency, payments, raw-message publication or key change.

## Backend / RPC

Owner explicitly approved both live packages after prerequisites, including all three
B3c closure-certificate bindings. B3c exact application proof36345955454 passed before
DEV208→209, migration20260927201030, SHA3a22a168…cf4b27. Both certificate rows now match
f66818aa870492e397cb991e5e82f1f3d03262352b7830ce62c0d1aa9691755b. Readiness changed only
its approved literal; atomic guards verified true readiness and matching binding.

Push proof36345502344 passed. Authenticated Dashboard name search confirmed absence of
EXPO_PUSH_MESSAGE_TARGET_ENABLED without reading values. Compatible Edge22 was deployed
first from exact proved Git-LF bytes; both files read back identically. After more than
90 seconds and zero outstanding sends/leases, the identical guarded SQL was applied as
20260927201531, DEV209→210, SHA bd4957d6…e450. Body/ACL/ledger/certificate readback passed.
This second package moved no certificate. Exact payload remains OFF; legacy INBOX remains
compatible. Regional execution logs were not independently attested; the recorded drain
is exact ACTIVE deployment metadata, elapsed bounds and aggregate attempt state.

## Tests and regression

B3c service/hook/coalescer:3 suites /73 tests PASS. A review found duplicate cross-source
read scheduling; the shared coordinator fixed it and same-turn/inflight regressions pass.
Final integrated TypeScript: PASS (exit0). No full Jest was rerun. Prior P4 client
4 suites/226PASS and isolated13PASS remain bound to b589994e; no claim all tests ran here.

P6 PAGE/EXACT_PUBLIC proof36346675417 at5749b656 passed8 SQL groups,208 actual current-client
parity vectors and1,004 rows. All reported source hashes independently match Git. It is
still local rollback-only, not applied or wired. MAP/PLACES, actual Auth/PostgREST and
query cost are not proven. See P6_PAGE_RUNTIME_RECEIPT.md/.json.

## Device proof

Phone preview35 build36345891205/sourceb589994e was signature-checked and installed with
-r. Installed APK SHA a13bdc574255b18600b0d50a9a398929e86bee4012cc8ecebff6d3318acc06ab
matches the downloaded artifact. Existing account remained signed in. Own Profile loaded.
Existing READ notification22:43 opened the corresponding closed TestR18 chat/message.
On-screen Back returned the Agreement overview with accepted terms and saved-rating state.
No message/task/provider/paid AI or profile write was performed.

Emulator source04b66de6 independently showed self-declared license controls, existing
READ notification22:42→corresponding chat and Back→overview. PHONE_ROUND27_RECEIPT.json
records exact packages and screenshot/XML hashes; screenshots remain local.

The installed phone includes the compatible P4 ingress but not this new B3c client.
The emulator excludes both new direct ingress and B3c client. Neither proves a new
provider send, native three-field push response or live B3c arrival/reconnect.

## Status and next step

Commit/push this coherent package, produce one consolidated matching client build, then
validate realtime arrival/reconnect between the existing two accounts in an authorized
active test Agreement. Keep exact push transport OFF until active registrations are known
compatible and a separately admitted controlled send can establish event→push→tap→window→ACK.
Do not restore Edge21 alone after the new SQL. Voice recording/playback, complete bounded
Discovery, deeper variants, iOS, legal/operator/retention and store gates remain open.

Control data is regenerated locally. Hosted artifact publication has separate evidence;
do not label local generation or a file chooser attempt as a shared update.
