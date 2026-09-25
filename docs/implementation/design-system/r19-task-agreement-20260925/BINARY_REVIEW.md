# Independent R19 media binary read review

Date: 2026-09-25. Code-only review plus one focused local test run. No device, server, secret,
provider, upload or real-data operation was performed by this reviewer.

## Result

No blocking byte-decoding, account-retirement or public-error regression was found in the inspected
patch. Native real-avatar acceptance is still required and is not established by these Node tests.

Reviewed source snapshots (SHA-256):

- `src/data/mediaBinaryRead.ts`: `450fe2024db050d0361eb844a3d113defdc602c86115aa0c623fe47da0ca9991`
- `src/data/mediaClientService.ts`: `2f70479a1d31cfeb500859ebd0826cf79cecdbfd98e93acfa03ce084670946e5`
- `src/data/__tests__/media-binary-read.test.ts`: `14b5f7ac465bc55273bf6830241307d074dbeb42caeda96572c73d9ea779da34`

Subsequent edits need their own final integrated check; these hashes identify the reviewed snapshot.

## Checked boundaries

- **Bytes:** the installed Functions SDK handles `image/jpeg` through `response.text()`. Its body is
  consumed and cannot be reconstructed losslessly. The new path reads the untouched response through
  `response.arrayBuffer()`, checks JPEG MIME and the actual 1..5,242,880-byte length, and does not turn
  text back into bytes. Declared oversize is rejected before body conversion.
- **Native feasibility:** the checked-in installed `whatwg-fetch` uses Blob/FileReader for that method.
  The installed React Native FileReader implements `readAsArrayBuffer` through the native data-URL
  reader and `base64-js`; the historical unimplemented-method concern does not apply to this source.
  This source inspection is not a substitute for native rendering evidence.
- **Authentication:** the existing Supabase client supplies the session. Session user must match the
  captured reader, and current account ID/revision is checked before and after asynchronous stages.
  Existing `readOwnedResult` performs the final retirement check. A round-trip account switch is not
  accepted as the same account incarnation.
- **Context:** `readMedia` retains UUID/context validation and the exact `read` versus `agreement-read`
  operation. The latter preserves Agreement/message context. Authorization remains server-owned;
  the client does not create a storage URL or widen a media grant.
- **Transport:** the endpoint is built from the existing configured HTTPS Supabase origin and the fixed
  `/functions/v1/uskoci-media` path, never from an asset-provided URL. Parent abort reaches fetch. A
  15-second race also retires stalled session lookup/body reading and prevents late work from returning
  an image. Cancellation/HTTP/relay failures have sanitized public errors, not server bodies or tokens.
- **Unchanged operations:** the diff leaves upload, JSON galleries and their `functions.invoke` paths
  intact. No second auth client, dependency, persistent image cache or server implementation was added.

## Verification actually run

`npx jest --runInBand --testTimeout=30000 --runTestsByPath src/data/__tests__/media-binary-read.test.ts`

**1 suite / 20 tests passed.** The actual installed FunctionsClient demonstrates the old lossy JPEG
parse; the new service returns the genuine checked-in JPEG byte-for-byte. Other assertions cover
context, malformed MIME/length, HTTP failure privacy, SDK-session mismatch, account revision changes,
parent abort, late responses and stalled-session deadline. Network responses are local mocks, not DEV.

## Precisely bounded redirect evidence

The helper requests `redirect: 'error'` and rejects `response.redirected`, but the installed React Native
`whatwg-fetch` Request does not implement the redirect option and its Response does not supply the
`redirected` flag. It exposes final `response.url` from XHR instead. Therefore this review does **not**
certify native redirect prevention. The test with redirect in its name checks a relay-error response,
not an actual native redirect. This was reported to the root and media owner before final integration.

The current endpoint is fixed from trusted configuration and no actual redirect or credential leak was
observed. Final-response URL comparison can reject unexpected returned media, but cannot retroactively
prevent a platform-followed request. Do not equate these different guarantees in the release evidence.
