# AI availability diagnostic — UNAPPLIED source candidate

Baseline: `632eb46f46b0d9d5f062df5d173e75342ae12ebb`. `MANIFEST.json` pins all eight changed/new files before and after. No canonical or frozen AI-LOCATION package edits; no SQL, deployment, provider calls, tests or reruns performed here.

## Observed incident and scope

Root supplied DEV Edge 51 logs at 19:21:07 UTC: Gemini HTTP 402 RESOURCE_EXHAUSTED, then AI_PROVIDER_FAILED / AI_STREAM_UNAVAILABLE. Both affected text turns were FAILED, provider_dispatched=true, without a completion receipt. Google's [Gemini API error reference](https://ai.google.dev/gemini-api/docs/generate-content/api-errors) identifies HTTP 402 as depleted Prepay credit. STT FAILED_NO_USAGE is a separate observed failure; its cause is not established by this evidence.

This candidate reports that closed provider status safely. It does not restore provider credit, authorize another attempt, change billing, or repair STT. Ordinary users see `AI je privremeno nedostupan. Pokušaj kasnije.` Generic need and worker service failure becomes `AI trenutno nije dostupan.` The existing pending status and Proveri ishod remain authoritative. Root-owned UI must not display the raw credit diagnostic code as a user-facing title.

## Changed files

- `src/contracts/aiAvailability.ts`: one closed code, concise copy and capability/header constants.
- `src/data/aiNeedTurnStream.ts`: exact safe-error allowlist extension, opt-in capability and bounded response-header decoder.
- `src/data/aiNeedV2Production.ts`: JSON opt-in and closed diagnostic mapping; shorter generic copy.
- `src/data/workerAiClientService.ts`: the same two user-facing messages.
- `src/data/locationDialogueClientService.ts`: location JSON opt-in and diagnostic mapping, retaining the current-context fence.
- `supabase/functions/_shared/geminiTaskStream.ts`: typed error created only from actual HTTP 402, never provider prose.
- `supabase/functions/uskoci-ai-interview/index.ts`: opt-in normal/location JSON and SSE diagnostic, including non-stream Gemini calls.
- `supabase/functions/uskoci-worker-interview/index.ts`: opt-in worker SSE diagnostic.

## Compatibility and preserved behavior

New clients send the already permitted `x-client-info: uskoci-app/ai-availability-v1`. This deliberately replaces the SDK telemetry identifier on these calls; it is not authentication or authorization. Both existing Edge CORS request-header allowlists remain unchanged. New clients with old Edge receive the original generic failure; old clients with new Edge receive the original generic protocol. Only explicitly opted-in clients receive the new exact safe_error code or HTTP 503 with our closed response header. New Edge exposes that response header for browser access. No arbitrary provider body/text reaches users.

Claim identity, dispatch admission, budgets, paid-call count, retire/fail ordering, durable outcome, command journal, completion receipt parsing, recovery, focus/account guards, retries and refunds are unchanged. In particular, a service diagnostic is not proof that a pending command is safe to replay. Normal JSON 409 recovery handling remains before this diagnostic branch. No new automatic retries or fallback providers are added.

## Exact candidate bundles and application boundary

`BUNDLE_MANIFEST.json` pins the complete local import bundles under `edge-bundle/`. Need Edge requires six files: its entry point, geminiTaskStream, aiAvailability, aiTestBudget, needFactsV2 and locationReply. Worker Edge requires four: its entry point, geminiTaskStream, aiAvailability and aiTestBudget. Both preserve verify_jwt=true. All unchanged dependencies are included byte-for-byte from the canonical source; the frozen AI-LOCATION manifest and bundle are not modified.

Root independently read worker Edge 17 / JWT true: entry and budget match canonical bytes; Gemini helper differs only in line endings. Root previously verified interview Edge 51 against the five-file location package. These are source/readback observations, not runtime acceptance of this new diagnostic.

Client source may be integrated with its new contract while server changes remain UNAPPLIED: old Edge compatibility is preserved by the existing allowed header. A new APK is needed for opt-in users to see the specific diagnostic after both functions are deployed. The server source needs a separate explicit deployment decision for these exact two bundles; no database migration, flags, secrets or provider/billing changes are requested. Immediately before application, compare current live versions/bundles with the recorded predecessor and retain exact live rollback bundles. Rollback only these two Edge bundles; do not revert the AI-LOCATION SQL package.

Only source inspection and manifest preparation were performed. No compile or native acceptance is claimed by this candidate.
