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
as a task fact or passed to the client as dialogue metadata. The database and native contracts do not change.

## Validation

- Two added regressions failed on the prior source: actual outgoing empty enum and rejection of
  the nonempty no-question sentinel. Three invalid-dialogue controls already passed.
- After the correction, all86 focused intake/context/wire tests pass, including these five.
- Types pass locally. CI35701314667 on e2d34bdacd395e0be761e572944b428dddb24270 passes all351
  offline Edge tests and the existing25-check PKG-042 disposable SQL/Auth/REST regression proof.
  The SQL proof validates unchanged integration boundaries; it is not a provider-schema acceptance test.
- Deployed intake48 with verify_jwt=true. All four hosted files match that commit byte-for-byte;
  unauthenticated POST returns401. DEV ledger remains196 (147 source +49 dev_alpha). No SQL executed
  except read-only checks; no new independent certificate computation is claimed.
- No agent-triggered provider generation. The owner retried after deployment and confirmed a response.
  Read-only DEV evidence: subsequent attempts at07:53:51 and07:54:15 UTC both SUCCEEDED with receipts,
  taking3.056 and5.463 seconds. A fresh phone screenshot shows actual replies. Together with the narrow
  wire-only change, this supports the empty enum as the cause of the earlier request rejection.
- The same real-use check exposed a separate semantic defect: ASK prose is always replaced by a generic
  field question. Geography clarification therefore repeats the same generic location question even
  after the owner supplies partial route information. This is NOT closed by the transport fix; follow-up
  PKG-044 preserves contextual questions for genuinely missing fields.

## Boundaries

Deploy only the intake bundle, retain verify_jwt=true, compare all four returned files byte-for-byte.
Do not reset budgets, rotate keys, write user data or resend the failed message automatically.
The owner can use Proveri ishod to retire the failed local pending command, then explicitly send.
