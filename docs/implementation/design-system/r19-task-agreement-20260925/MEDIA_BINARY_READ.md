# R19: preserve JPEG bytes in authorized media reads

Date: 2026-09-25. Status: client fix implemented; targeted regression and type checks passed. Native confirmation is owned by the integrator and is not claimed here.

## Confirmed cause

The installed `@supabase/supabase-js` and `@supabase/functions-js` are both **2.112.4**. `FunctionsClient.invoke()` (`node_modules/@supabase/functions-js/src/FunctionsClient.ts:308–326`) chooses `response.blob()` only for `application/octet-stream` and `application/pdf`. An `image/jpeg` response reaches `response.text()` instead. By the time `mediaClientService.readMedia()` previously tested `data instanceof Blob`, its original response body had already been consumed as text.

This is a client transport failure, not evidence of a failed upload or missing stored image. It affects every existing contextual JPEG read that uses the shared service: profile/avatar, task, support case and Agreement photos.

The integrator separately reported an installed R18 avatar unavailable state while the picker/removal controls were available and the existing DEV asset was READY/selected with its storage object present. This reviewer did not inspect DEV or a device. The separate hypothetical stalled-avatar-intent recovery gap in `MEDIA_AUDIT.md` was **not reproduced** by that observation and is not fixed by this transport change.

## Exact reproduction and fix

`src/data/__tests__/media-binary-read.test.ts` runs the **actual installed Functions SDK** with a mocked fetch returning the genuine checked-in `assets/brand/entry-v49/worker.jpg`, MIME `image/jpeg`:

- 239,882 bytes; SHA-256 `c25266122c8c47f96994c6cff05f9e5e5b7428de4a9d78521eb6f4084612d3d3`.
- The SDK returns a string with `response.bodyUsed === true`; UTF-8 re-encoding differs from the original JPEG.
- The desired service test requires a successful read and byte-for-byte equality. **Before the patch: 1 test passed, 1 failed**, with the service returning `ok: false`.
- **After the patch: both initial tests passed**. Later tests add failure, timeout and account-lifetime coverage.

New helper `src/data/mediaBinaryRead.ts` uses the configured, fixed `/functions/v1/uskoci-media` endpoint and the existing client's public `auth.getSession()` API. It sends the current user authorization plus configured public API key as headers, and reads the untouched successful response with `Response.arrayBuffer()`. No token, headers, response details or image bytes are logged or persisted. No secret was retrieved through tools.

The integration in `src/data/mediaClientService.ts` changes **readMedia only**. Context validation and the existing `readOwnedResult` account/revision fence remain. Gallery JSON reads, uploads, cancellation, apply-avatar and all RPC paths still use their previous implementation.

## Preserved boundaries

- The request still carries the exact asset and one validated context; Agreement reads use `agreement-read` and preserve the optional canonical message id. It never accepts a storage path or arbitrary destination.
- SDK session user must match the captured owner. Account id and account revision are checked before/after asynchronous stages. A changed account cannot start a late network request or receive late bytes.
- Parent cancellation is forwarded through a private abort controller. The entire operation, including session retrieval, is bounded to 15 seconds. Retirement prevents a late stalled auth result from starting a request after timeout; an explicit later retry can succeed.
- HTTPS configuration only; no URL credentials/query/hash, no `sb_secret_` key, no cross-origin caller-supplied URL. Relay failure and non-success HTTP results are rejected. The request asks for no cache and redirect refusal; the current RN `whatwg-fetch` transport does not implement all browser Request options, so these are not a claim that native HTTP redirects are prevented. The fixed trusted configured endpoint remains the destination boundary. Where `response.redirected` exists, an indicated redirect is rejected.
- Success requires JPEG MIME and a genuine `ArrayBuffer` of 1–5,242,880 bytes. An oversized declared content length is rejected before body decoding, and actual length is checked regardless of that header.
- Error content is discarded into the existing safe unavailable/invalid response outcomes. No JSON/server body is used as an image or displayed to the person.
- No database, Edge Function, server MIME, SDK code, package/dependency, global fetch, global Supabase client or storage policy changed.

## React Native support checked

The installed `react-native/Libraries/Network/fetch.js` loads `whatwg-fetch`. Its `Response.arrayBuffer()` (`node_modules/whatwg-fetch/dist/fetch.umd.js:296–312`) reads native Blob-backed responses using `FileReader.readAsArrayBuffer` (`:192–196`). The installed RN `Libraries/Blob/FileReader.js:74–100` implements that method through the native data reader. The fix deliberately uses this supported response method rather than assuming native `Blob.arrayBuffer()` exists. This is source-level compatibility evidence, not a substitute for the new APK's device check.

## Executed validation

Before/after execution-output excerpts are retained in [`MEDIA_BINARY_READ_PROOF.log`](MEDIA_BINARY_READ_PROOF.log). They were copied from the actual tool results, not produced by rerunning or rewriting the old implementation after integration began.

- `npx jest src/data/__tests__/media-binary-read.test.ts src/data/__tests__/media-client.test.ts --runInBand --testTimeout=30000`: **2 suites, 62 tests passed** (2.266 s reported Jest time).
- Coverage includes actual SDK corruption, exact JPEG equality, exact Agreement context, disallowed MIME, zero/oversized actual bytes, oversized declared length, 401/403/404/500 sanitization, absent/wrong SDK user, account round trip during auth and body reading, parent abort with a fetch that ignores cancellation, stalled auth timeout then explicit successful retry, and relay refusal.
- Existing media-client tests retain context ambiguity rejection, exact owner/context binding, command cancellation, upload/apply behavior and account retirement. Their read transport seam now targets the binary helper rather than pretending the JSON SDK can return JPEG Blobs.
- `npx tsc --noEmit -p tsconfig.json`: **passed**, exit 0.
- `git diff --check` for the changed tracked media service/test files: **passed** (only the pre-existing checkout line-ending warning).
- No full Jest suite, build, device operation, paid/provider call or DEV write was performed for this subtask. The integrator runs the combined release checks and verifies the existing avatar on the new APK.
