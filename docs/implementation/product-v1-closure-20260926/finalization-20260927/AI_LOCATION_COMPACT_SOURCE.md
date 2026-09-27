# AI task location: compact proposal in the conversation

2026-09-27. **CLIENT SOURCE PREPARED; focused checks PASS; screenshots/device acceptance pending.** This follows the owner's request for a small map and proposed pin, concise confirmation, map or conversational correction, and no wall of picker controls.

## Before and after

The conversation used the full point form: query field, search/GPS actions, candidate rows, address adoption, cancellation, reverse lookup and private-detail fields appeared together. The already-seeded lookup did not place any proposed pin. A single-point task also repeated a selectable slot card and several introductory instructions.

The explicit `presentation="conversation"` branch now places the first **already validated provider result as an unconfirmed proposal**. It asks “Je l’ ovde?”, shows the actual candidate label, a compact editable map and explicit confirmation. The first result is not asserted to be unique, correct, AI-verified or confirmed. “Nije ovde” reveals other actual results and map-correction guidance; “Ispravi u razgovoru” uses the existing guarded close flow to return to the normal composer. No fake map point or confidence value is supplied.

An empty result asks the person to mark the map. Unavailable search, rate limiting, invalid input and unavailable activation have distinct copy; a transport failure is not described as “no match.” An unconfirmed manual point still requires the same confirmation. The single-slot radio and repeated introduction are removed; multi-stop selectors, their current slot/status and saved-point summaries remain.

The existing lookup seed now combines the start's private street with its already-known label/area/city and deduplicates comma-separated text case-insensitively. Previously any exact address discarded the known locality entirely. The private start address is never included in another slot. No inferred locality is added.

## Authority and lifetime

The existing seeded lookup still runs only for the active editor/slot. No new prefetch, GPS prompt, reverse lookup, provider retry, quota, provider request or AI prompt is introduced. Alternative selection and map movement make proposals only. Candidate labels do not become private addresses automatically.

Explicit confirmation still emits the existing point/origin; the parent commits only a complete, manually confirmed set using the existing review revision and receipt validation. Saved pins and private notes are retained. Focus/account/scope/disabled guards, request cancellation, stale-handler retirement, save recovery and unknown-outcome behavior are unchanged. Natural-language correction cannot send beside an active location decision: it uses the existing close/discard guard, and the composer is unlocked by the parent's existing close callback. Cancelling that decision keeps the confirmed baseline and unsaved points; explicitly discarding follows the previously reviewed warning.

The full manual location form keeps its controls. No resolver, location service, map renderer, route, server, dependency, TaskCard or Peek changes are included.

## Files and validation

Changed UI: `LocationPointEditor.tsx`, `ConversationPointAsk.tsx`, and the repeated preamble in `IntakePresentation.tsx`. Existing editor/point-ask/intake tests cover proposal versus confirmation, no address adoption, hidden/reopened ambiguity, distinct failure states, manual correction, saved details, retired callbacks, locality seed, guarded composer return and multi-stop completion.

Focused command:

```text
npx jest src/data/__tests__/locationPointEditor.test.tsx src/data/__tests__/conversation-point-ask.test.tsx src/data/__tests__/ai-owned-intake-screen.test.tsx src/data/__tests__/ai-conversation-layout.test.tsx --runInBand --silent
```

The command passed 4 suites / 230 tests on its first run. The locality regression was then expanded to cover both street-only input and a street already containing its city; the affected point-ask suite passed all 50 tests. Final coverage is 4 distinct suites / 231 tests. Scoped whitespace check passed. Root owns consolidated TypeScript, commit/build and exact-device inspection. No real AI/geocoder/GPS/provider or emulator operation ran for this package. Native screenshots, actual pin dragging and visual density on the new APK remain unverified.
