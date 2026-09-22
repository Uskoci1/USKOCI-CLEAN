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
CI, exact hosted readback and owner follow-up are pending at this initial commit.
