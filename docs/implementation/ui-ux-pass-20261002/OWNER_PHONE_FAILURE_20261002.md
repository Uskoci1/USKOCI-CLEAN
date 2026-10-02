# Owner phone feedback — AI availability, speech and visual rejection

Installed artifact: build37051296452, source6fb39b301888527350701741c659bb32cbe617bd, SHA-256712b157892777b8131745ddf3cf0b88c556d3b6e5139bf8ab68f3f23c1fa0863. Owner supplied screenshots around21:22–21:23 Europe/Warsaw after the verified installation. Installation success is not functional or visual acceptance.

## Observed, not inferred

- AI screen shows unavailable processing and unknown outcome after an ordinary task message. A speech interruption is also visible. Recovery remains available; the owner rejects the visual composition as too uniform, green and crowded, with weak small illustrations.
- Read-only Supabase logs for19:18–19:28UTC: interview Edge51 request19:21:06.889UTC returns HTTP200 for SSE; its execution logs19:21:07.251UTC contain `GEMINI_STREAM_HTTP_FAILED 402 RESOURCE_EXHAUSTED UNKNOWN UNKNOWN` and `AI_PROVIDER_FAILED AI_STREAM_UNAVAILABLE`. HTTP200 here is a transport stream, not successful AI completion.
- Two commands created19:21:06.852316 and19:23:44.631970UTC are FAILED with provider_dispatched=true and no receipt. Claim and dispatch occurred; this evidence does not point to a location-confirmation regression. No new provider request or replay was made during diagnosis.
- Speech Edge15 upgraded a connection at19:23:41.815UTC. STT reservations19:20:57.757605 and19:23:41.757046 were settled FAILED_NO_USAGE within about300ms, with no recorded audio/transcript measurements. The exact upstream speech close reason is not present in the inspected logs. A shared billing cause is plausible but unconfirmed.
- The local reservation budget is enabled and its price validity is2027-01-01. Negative reservation headroom is bookkeeping, not a measurement of actual provider charges; it does not justify changing limits or credit without approval.

## Interpretation and remaining action

Google documents402/RESOURCE_EXHAUSTED as depleted Prepay credits: https://ai.google.dev/gemini-api/docs/generate-content/api-errors . Restoring text inference requires resolving the provider balance/billing condition. No billing change, purchase, budget bypass, provider substitution or secret read was performed. Speech availability needs its own confirmation after that condition is resolved; it is not established as a device microphone defect.

Client source currently maps all validated speech-service error events to generic capture failure, and transport errors to microphone unavailable. A narrow correction distinguishes unavailable service and lost connection while keeping text retention and cancellation guards. This improves diagnosis; it does not restore an unavailable service.

The existing AI stream reduces server errors to a generic unavailable message. A closed, explicitly versioned diagnostic may clarify provider402 for future clients; it must not authorize retry, clear a pending journal, invent success, or change command/certificate/budget state. Any Edge application remains a separately identified deployment.

## Visual response

The owner reference calls for a composed white screen with softer separation, clear type hierarchy, selective large dimensional artwork and real imagery when present. Changing text color alone is insufficient. First bounded response is the exact own-task screen from the screenshot; public details and other screens remain separately open. No animated robot or full-app premium acceptance is claimed.

Only existing logs/catalog/state were read. No paid probe, new test, real task mutation, resend, device UI navigation or additional server deployment was performed for this diagnosis.


Later owner reports credit paid. Earlier provider402 remains historical evidence; new availability is not inferred. Concrete client fixes and exact remaining uncertainties are recorded in VISUAL_FINISHING_20261002.md.
