# AI test budget: real spend versus internal cap

Recorded 2026-09-17 for the owner's decision on whether to raise the internal test budget.
Read-only: no budget value, reservation row or Edge function was changed to produce this report.

## The headline, before any numbers

**The internal cap is not money. It is a call counter.** `private.ai_test_budget_v5` holds a fixed
ceiling of 5 000 000 microUSD and every LLM reservation is a fixed 250 000 microUSD, enforced by a
`check` constraint in the source, not a computed price. So the cap allows exactly **20 LLM calls,
ever**, and nothing in the system ever releases a reservation. "4 750 000 of 5 000 000 spent" means
19 of 20 calls have been made. It does not mean 4.75 US dollars left Google's meter.

## 1. Every real provider call

One reservation row equals one admitted provider dispatch. All 19 are LLM calls to
`gemini-3.8-flash`; there are no STT reservations.

### This acceptance cycle, 2026-09-16, dedicated QA account (12 calls)

| # | Belgrade time | Chain | Turn outcome | What it was |
| --- | --- | --- | --- | --- |
| 1 | 22:26:48 | WORKER | SUCCEEDED | worker scenario turn 1 |
| 2 | 22:26:51 | WORKER | SUCCEEDED | worker scenario turn 2 |
| 3 | 22:26:55 | WORKER | SUCCEEDED | worker scenario turn 3 |
| 4 | 22:26:58 | WORKER | SUCCEEDED | worker scenario turn 4 |
| 5 | 22:27:08 | WORKER | SUCCEEDED | worker scenario turn 5 |
| 6 | 22:27:11 | WORKER | SUCCEEDED | worker scenario turn 6 |
| 7 | 22:30:03 | NEED | FAILED | first NEED turn, provider returned 400; later closed through canonical recovery |
| 8 | 22:41:30 | NEED | PROCESSING | diagnostic probe 1, provider returned 400 |
| 9 | 22:44:29 | NEED | PROCESSING | diagnostic probe 2, provider returned 400 and named the rejected node |
| 10 | 22:47:59 | WORKER | PROCESSING | control turn, provider returned 400; this is what proved the wrapper was the defect |
| 11 | 22:52:01 | NEED | SUCCEEDED | NEED acceptance after the wire fix |
| 12 | 22:53:05 | NEED | SUCCEEDED | NEED acceptance correction turn |

Eight of these produced a real generated answer. Four were rejected by the provider with
`400 INVALID_ARGUMENT` before any generation.

### Earlier session, 2026-09-13, owner account (7 calls)

| # | Belgrade time | Note |
| --- | --- | --- |
| 13–18 | 15:09:25 to 15:34:31 | six calls from the 2026-09-13 session |
| 19 | 15:42:39 | the turn that is still `PROCESSING`, client request `41cf65f2…` |

These seven are not part of this acceptance cycle, but they consume the same never-released cap.
They are the reason only one call remains.

## 2. Token usage and provider metadata: UNKNOWN, and exactly why

| Field | Value | Basis |
| --- | --- | --- |
| model | `gemini-3.8-flash` | proven: the `GEMINI_MODEL` secret digest equals sha256 of that string, and both Edge handlers refuse to dispatch unless the model matches exactly |
| input token usage | **UNKNOWN** | never captured |
| output token usage | **UNKNOWN** | never captured |
| provider usage metadata | **UNKNOWN** | never captured |
| actual cost per call | **UNKNOWN** | cannot be computed without token counts |

This is not a gap in the report, it is a gap in the system, and it is verifiable: the strings
`usageMetadata`, `promptTokenCount`, `candidatesTokenCount` and `totalTokenCount` do not appear
anywhere under `supabase/functions/` or `src/`. The stream reader in
`supabase/functions/_shared/geminiTaskStream.ts` walks each event's candidate parts, keeps `text`,
skips anything marked `thought`, and discards every other field. Gemini does return usage in the
final response, so the data existed on the wire and was thrown away. Nothing is stored that could
be recovered later, and Edge logs record only a closed failure vocabulary, never usage.

**The only authoritative source for real spend is Google's own billing or usage console for the
`GEMINI_API_KEY`.** I cannot read it, and I will not estimate what it says.

## 3. A rigorous upper bound, which is not a guess

Actual spend is unknown, but it is provably bounded, because the source enforces hard caps before
any dispatch. `AI_TEST_LIMITS` sets `llmRequestBytes` to 131 072 and `llmMaxOutputTokens` to 8 192,
and the handler refuses the call when the body exceeds the byte cap.

A token is at least one byte, so input tokens can never exceed 131 072 for one call. Official
Gemini 3.8 Flash pricing is 0.75 USD per million input tokens and 3.75 USD per million output
tokens during the introductory period that runs to 2026-12-31.

| Bound | Calculation | Result |
| --- | --- | --- |
| worst case input, one call | 131 072 × 0.75 / 1 000 000 | 0.0983 USD |
| worst case output, one call | 8 192 × 3.75 / 1 000 000 | 0.0307 USD |
| **absolute worst case, one call** | | **0.129 USD** |
| worst case, 12 calls this cycle | | 1.55 USD |
| worst case, all 19 calls ever | | 2.45 USD |

Two things follow. The 0.25 USD per-call guard is about double the absolute worst case, so the
guard is conservative by design. And the true figure is far below these bounds, because a real
request is a system instruction plus at most thirty short chat turns, nowhere near 131 KB, and four
of the twelve calls were rejected before generation. A `400 INVALID_ARGUMENT` is a validation
refusal that normally carries no token billing, but I mark that **UNKNOWN** rather than assert it,
since only Google's meter can confirm it.

## 4. The requested summary fields

| Field | Value |
| --- | --- |
| `REAL_SPEND_USD` | **UNKNOWN** from our systems. Provably at most **2.45 USD** lifetime across all 19 calls, and realistically a small fraction of that. Only Google's console is authoritative. |
| `INTERNAL_TEST_BUDGET_CAP_USD` | **5.00**, which is really a limit of 20 LLM calls at a fixed 0.25 USD guard each |
| `REMAINING_ALLOWED_CALLS` | **1** |
| guard, not spend | the ceiling, the 250 000 per-call reservation, `reserved_microusd`, and every row in `private.ai_test_reservations_v5` |
| actual spend | nothing in our database represents it |

One more property worth knowing before any decision: `price_valid_until` is 2027-01-01, and the
reservation function refuses every call once that moment passes. That date is not arbitrary. It is
exactly when Gemini 3.8 Flash introductory pricing ends and the rate doubles to 1.50 and 7.50 USD
per million tokens. The guard is designed to stop rather than silently keep spending at a price
nobody approved.

## 5. What I recommend, for the owner to decide

Raising the ceiling is safe from a cost standpoint: the proven worst case for another twenty calls
is about 2.60 USD. But raising it without fixing the measurement means the next report will be just
as blind as this one.

The cheap fix is to capture what the provider already sends. Reading `usageMetadata` from the final
stream event and recording `promptTokenCount` and `candidatesTokenCount` on the reservation row
would turn every future cycle into real numbers instead of bounds. That touches the verified Edge
stream helper and the budget schema, so it is a separate reviewed change and **I have not made it**.

Three options, in the order I would suggest them:

1. Raise the ceiling and add usage capture in the same reviewed package, so the next cycle reports
   actual spend.
2. Raise the ceiling now and add usage capture later, accepting one more blind cycle.
3. Leave the ceiling and ask Google's console for the real figure first, then decide with it in
   hand. This costs nothing and answers the question this report cannot.

Sources for the pricing used above: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing), [What's new in Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/latest-model).

---

## 6. Update, 2026-09-17: the measurement gap is closed, the ceiling is not raised

The owner's instruction was capture first, ceiling later. Both halves were honoured.

`PKG-014B` now captures the `usageMetadata` the provider already sends. The shared stream helper
validates the counts and hands them to an optional callback; both Edge handlers record them through
a service-only recorder **after the turn is already confirmed**, so accounting can never decide
whether a user's answer is delivered, and a failed record is swallowed rather than allowed to fail a
turn that succeeded.

The verified budget engine was not touched, and that is asserted rather than claimed. No column was
added to the reservation table, no function of the budget was replaced, and the ceiling is still the
reviewed constant. Usage lives in its own table keyed by the same operation id. The live domain
surface digest before and after promotion is identical at `9033299ca197a009b4ba03a20491b08c`.

Live on canonical DEV after `20260917055559_dev_alpha_pkg014b_ai_provider_usage`:

| Field | Value |
| --- | --- |
| `providerCalls` | 19 |
| `callsWithReportedUsage` | 0 |
| `callsWithoutReportedUsage` | 19 |
| `inputTokens` | null, meaning UNKNOWN |
| `outputTokens` | null, meaning UNKNOWN |
| `REAL_SPEND_USD` | null, meaning UNKNOWN |
| `INTERNAL_TEST_BUDGET_CAP_USD` | 5.00 |
| internal reserved | 4.75 |
| `REMAINING_ALLOWED_CALLS` | 1 |
| `capIsACallCounter` | true |

Two things this table is careful about. The 19 calls already made have **no** recorded usage and
never will, so the report counts them separately instead of implying they used zero tokens. And
`realSpendUsd` stays null because this database holds no approved price table; the provider's own
billing console remains the only authority for money. The proof asserts that a zero there would be a
lie.

**The next real provider call will be the first with real numbers.** The ceiling stays at 5.00 USD,
one call, until the owner decides with those numbers in hand.
