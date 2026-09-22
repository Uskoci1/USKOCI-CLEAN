# PKG-043 — intake wire enum compatibility

2026-09-22. Edge-only correction; no SQL, client, dependency or credential change.

## Observed incident

The owner reported the intake error on the installed PKG-042 APK. The phone screenshot shows
AI service unavailable followed by the owned-outcome recovery button. Read-only DEV records show
four FAILED, provider-dispatched turns between 07:27 and 07:32 UTC, each settling in roughly
0.26–0.28 seconds without a success receipt. Three preceded the APK update.

After the owner signed in to the dashboard, intake47 logs at 07:32:07 UTC showed
`GEMINI_STREAM_HTTP_FAILED 400 INVALID_ARGUMENT UNKNOWN UNKNOWN` and
`AI_PROVIDER_FAILED AI_STREAM_UNAVAILABLE`. This establishes provider request rejection, not
provider quota exhaustion or a timeout. The closed log vocabulary does not identify the exact field.
No raw conversation, credential or provider error body is retained here.

## Change and evidence boundary

The actual outgoing `responseSchema` contained an empty enum member at
`dialogue.questionKey`. The Google developer forum contains first-hand Gemini3 reports of empty
schema enum values being rejected with400 (`enum[0]: cannot be empty`):
https://discuss.ai.google.dev/t/gemini-3-models-400-error-with-different-mcps/137117
The reports concern tool schemas, so they support a compatibility concern, not independent proof
of this incident's exact field. The official structured-output guidance is
https://ai.google.dev/gemini-api/docs/structured-output.

The provider schema and prompt now use the nonempty sentinel `NONE`. The decoder maps it back
to the existing internal empty marker, then applies every existing dialogue constraint. Previous
empty output remains readable for compatibility. ASK without a real question, ANSWER with a
question, unknown keys, extra keys and invalid facts remain rejected. The sentinel is never stored
as a task fact or shown as assistant prose. The database and native contracts do not change.

## Validation

- Two added regressions failed on the prior source: actual outgoing empty enum and rejection of
  the nonempty no-question sentinel. Three invalid-dialogue controls already passed.
- After the correction, all86 focused intake/context/wire tests pass, including these five.
- CI/disposable verification and hosted readback are pending at this initial commit.
- No agent-triggered provider generation. A successful owner retry is still required to attribute
  this incident conclusively and to demonstrate an actual response on the phone.

## Boundaries

Deploy only the intake bundle, retain verify_jwt=true, compare all four returned files byte-for-byte.
Do not reset budgets, rotate keys, write user data or resend the failed message automatically.
The owner can use Proveri ishod to retire the failed local pending command, then explicitly send.
