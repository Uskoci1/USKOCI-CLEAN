# PKG-044 — preserve contextual intake questions

2026-09-22. Follow-up to the successful owner retry after PKG-043.

## Observed defect

The owner and a fresh USB screenshot show repeated generic location questions, including after
partial pickup/destination information and a question about the repetition. Server turns succeed;
transport failure is not the cause. Read-only fact metadata shows private address/country facts but
no complete task geography. No real address, conversation text or screenshot is committed here.

`guardConversationTurn` overwrote EVERY ASK assistantMessage with the canned string for that fact
key. Thus a specific pickup-city or destination clarification could never reach the person: the
guard turned both into the same generic location question. Raw provider prose from the real attempt
was not stored, so no claim is made about exactly which sentence Gemini originally generated.

## Bounded correction

- Preserve the validated provider wording when ASK names a genuinely missing field. A partially
  specified route may need a specific component, not the entire location repeated.
- Retain retargeting when the requested field is already known. Existing typed-fact validation,
  material ambiguity guards, owned completion, review handoff and no-op filtering stay in force.
- Prompt explicitly prioritizes a direct explanation/complaint as ANSWER instead of another field
  question and asks for the precise missing route component without guessing a city from a street.
- No new provider call, client build, SQL migration, secret, dependency or permission is involved.

## Proof boundary

Three behavior regressions fail on intake48: contextual pickup, destination and schedule wording
are replaced by generic questions. One direct-answer preservation control already passes.
After the change all90 focused context/wire tests pass. They exercise actual code with synthetic
provider outputs; they do not establish the provider's real interpretation or overall dialogue quality.

Local typecheck passes. CI35702324170 on7b6478a868a10edeec2af55d6a4b19f772ee9536 passes355 offline
Edge tests and the existing25-check disposable PKG-042 SQL/Auth/REST proof. This additional database
proof validates the unchanged integration, not real provider language quality.

Intake49 deployed with verify_jwt=true. All four hosted files compare byte-for-byte to the proven
commit (EDGE_RECEIPT_20260922.json); unauthenticated POST returns401. No database mutation performed.
No new APK is needed; installed client35698097121 calls the updated server. Owner follow-up requested
after deployment; actual response quality remains pending at this receipt.
