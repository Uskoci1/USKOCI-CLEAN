# AI conversation: intent, implementation and observed behavior

Date: 2026-09-22. Source baseline: `e447f124`. Canonical DEV: `leqcwgzvjsxugfgzdmth`.

Current coverage: REPAIR_COVERAGE_20260922.md separates each semantic protection from real-provider
quality, device and owner-decision limits. PKG-039 now deploys bounded interview recovery; PKG-041
adds relative-day evidence checks in full descriptions. Their own receipts supersede historical versions.

Follow-up: PKG-038 repairs part of this baseline on 2026-09-22. See
`../pkg038/PKG038_CONVERSATION_SEMANTICS.md` for exact scope,321 offline Edge tests,11 disposable SQL
checks, DEV ledger193 and byte-verified intake v45 / worker v16. Native repetition cleanup passes full
Jest but still needs a build/device pass. The original eight diagnostic cases below intentionally
document the pre-fix behavior; their old-source assertions are not current regression tests. Model
interpretation, complex relative dates, long history and interview recovery remain separate limits.

This is a read-only product/semantic investigation, not an implementation or deployment receipt.
The owner asked why the AI repeats understood information, writes long replies and sometimes fails
to behave like the intended short interview. No database/Edge/client behavior was changed. No provider
call, secret read, account impersonation, device test or new dependency was used. DEV ledger stays 192.

## Conclusion

The intended product is a conversation that extracts the person's information, asks only material
missing questions, allows corrections, then hands off to one deliberate review. The implementation
has substantial ownership, validation and transaction safeguards, but next-question selection,
completion of the interview and semantic consistency are largely delegated to free model prose.
The current output schema is essentially `assistantMessage + safety + facts` (or a profile patch).
It has no explicit question target, ambiguity decision, task-switch decision or review-handoff intent.

The visible repetition is mostly repeated narration, not repeated database writes. There are also
material semantic defects: a wrong relative date, retained terms after a task switch, and a daily
multi-day price represented as a whole-task per-person price. These must not be treated as copy polish.
The selected affected conversations remain OPEN and unbound to a published task; no financial loss
or completed incorrect transaction was observed. Human final review remains a protection, not a
substitute for correct extraction.

## Evidence and scope

- Read owner decisions AF-01/02/03/04 in `../EXECUTION.md`, current handoffs/AGENTS and V3 decisions.
  They supersede the historical per-field confirmation UI. A text command saying publish/save does
  not replace the explicit accepted review.
- Read current task Edge preparation, context, prompt/schema, parser, dispatch, completion and stream;
  task route/data adapter/conversation shell/review handoff; worker prompt/schema/context/completion
  and profile route; speech-to-text handoff; Q&A and publication classification responsibilities.
- Read 13 live SQL bodies in full. Definitions and MD5 pins: `LIVE_FUNCTIONS.json`.
- Fresh Edge readback: task intake v44, worker v15, both JWT enabled. Both entrypoints and the intake
  fact registry byte-match the inspected local source. Receipt: `READ_ONLY_EVIDENCE.json`.
- Semantically read 38 stored task replies and their preceding inputs from 15 conversations since
  September20 UTC. 13 replies were stored after v44 deployed at `2026-09-20T22:45:55.241Z`.
  Older replies are not presented as tests of v44. Read all 24 stored profile replies in two nonempty
  conversations; 18 postdate v15. These are stored DEV dialogues, not new real-person tests.
- Read selected facts attached to the same message sequences, plus current active facts, to distinguish
  what the AI said from what the database holds. No raw dialogue, address, contact or account ID is
  copied into these repository documents.
- Executed 123 existing boundary tests across four files: exit 0. These use synthetic provider/SQL
  transport. Executed eight new offline diagnostic observations against the exact handler: exit 0.
  `OFFLINE_OBSERVATIONS.json` records reproduced limitations, NOT a corrected or quality-approved AI.
  The new diagnostics exercise the handler's non-streaming path and shared prompt/parser. They do not
  run the native UI, actual provider, SQL persistence or an end-to-end streamed conversation.

Measured descriptive counts (not error rates):

| Sample | Replies | Mean / longest characters | Common acknowledgment prefixes | More than one question mark |
| --- | ---: | ---: | ---: | ---: |
| Task replies since September20 | 38 | 210 / 420 | 24 | 5 |
| Subset after current v44 deployment | 13 | 215 / 310 | 11 | 5 |

A single question mark can contain four unrelated topics. Acknowledging a changed value is not itself
a defect. Of 157 AI-origin structured proposals created since September20, two equal the previous
value for the same conversation/key. Thus the repeated wording is not evidence of wholesale repeated
fact persistence. Neither dataset measures completion rate, general user satisfaction or model capacity.

## The actual path

1. Speech is transcribed separately. The person sees editable text and presses Send. The task endpoint
   receives text, conversation ID and request ID; it does not receive the audio, STT confidence or an
   input-origin field. It cannot independently attest that it heard clear audio.
2. The client creates/resumes an owned conversation, preserves one request identity and prevents
   simultaneous new turns while an outcome is unknown. Account/focus changes fence late responses.
3. Auth and SQL claim bind the attempt to the owned conversation and a hash of its context. SQL reads
   the latest 40 messages and current unsuperseded facts. Manual location/photo witnesses remain in
   the hash, but are excluded from provider facts.
4. The Edge sends the latest 30 messages, current input, typed-fact registry, server date in Serbia,
   and known facts to Gemini. The common instruction serializes known facts then cuts that string at
   8,000 characters. Both extraction and the next reply are requested in one provider call.
5. The model returns prose plus proposed facts. The Edge checks shape, types, allowed fields, length
   and numeric confidence, but not whether a question is already answered or whether prose agrees
   with the proposed facts/evidence. The live SQL writer validates facts and supersedes the same key;
   other keys survive. Proposed facts remain unconfirmed until review.
6. The app displays the model's prose unchanged, a current task card and fact chips. Streamed prose
   is provisional; confirmed facts/card come from server readback. The same information can therefore
   appear in the prose, the card and chips. Refreshing the transcript does not itself ask the model
   another question.
7. Final review is separate. It is source/hash/revision bound; an explicit action confirms the exact
   reviewed material and saves a draft, then the publication path performs its distinct policy check.
   The model cannot publish just by saying that a task is ready.

For the worker, current candidate + last 30 messages feed a separate WORKER_PROFILE_V1 prompt. Its
patch is applied to the candidate, not directly activated. Q&A is a policy classifier for people's
questions/answers, not a chat author. Publication is likewise a classification of a saved task and
selected photos; it is not a general conversational fact-correction engine.

## Findings

### C01 — Repetition and multi-topic questions: observed UX defect

The task prompt explicitly asks for one most important question, at most two closely related ones,
and no repeated confirmation. Nearby instructions also ask for a price-basis explanation, per-person
total, a photo suggestion and a map handoff. The model often combines these duties in one reply.
Source: `supabase/functions/uskoci-ai-interview/index.ts::commonInstruction/v2Instruction`.

After the person adds only a location, stored reply340 restates workers, dates, hours and daily price.
Reply342 asks about price basis and timing and includes a long explanation. Replies326/328/330 ask
several separate topics. In contrast, reply338 asks one relevant location question and reply344 asks
for duration, which was actually missing. Repeating the price-basis question in322 is not evidence of
forgetting: the previous user reply answered the type of work, not price basis.

No planner/response contract specifies the next field or checks it against known facts. The 1,200-character
Edge limit is a transport bound, not a concise-conversation rule. Offline KNOWN_FIELD_QUESTION and
MULTI_TOPIC_QUESTION show these outputs reaching the completion boundary. The SQL writer likewise has
no conversational relevance check. Existing tests mostly supply synthetic model wording rather than
evaluating the quality of a model's independently generated wording.

### C02 — Interview has no reliable finish/handoff decision: observed worker defect

In the profile dialogue after v15, the person says they are done (sequence251); reply252 still asks
about current availability. After another answer,254 asks about the calendar. The person then asks to
save;256 again asks whether working hours/availability are correct. This matches the owner's complaint.

`uskoci-worker-interview::instruction` requires one missing-data question, but defines no explicit
ready/stop state and no rule to stop opening optional topics after a finish request. Its output is
only `assistantMessage/safety/patch`. The native review control already exists. Correct behavior is
to route the person to that review when mandatory information is available, while preserving the
explicit save action. It is not correct to silently save from conversational text.

The worker prompt also lacks the task prompt's explicit informal "ti" instruction. Current-version
stored profile replies use formal addressing. The prior global copy pass did not establish all
generated model wording as compliant.

### C03 — Map/photo state is absent from model context: confirmed mechanism, possible repetition

`private.ai_need_turn_context` excludes `need.resolved_location`, `need.public_photo_paths` and identity
verification from provider facts. Excluding raw private witnesses is correct. No safe replacement such
as map-slot completeness or photo-present count is supplied. The prompt nevertheless says not to repeat
photo suggestions if photos already exist and universally tells the model to mention a missing map.
That instruction cannot reliably depend on UI facts the model does not receive.

This can also be inappropriate for REMOTE tasks. A statement from the user in recent history can help,
but is not a server-confirmed UI state. Preserve privacy by passing minimal bounded state, not raw
coordinates or photo paths. A persisted declined-offer flag is also absent; old declines can fall outside
the 30-message history. Current stored samples do not establish an actual endless map-confirmation loop.

### C04 — Task-switch ambiguity carries earlier terms forward: observed material defect

One dialogue changes from construction work to unrelated personal assistance. The AI recognizes the
change in its replies. At readback, the conversation's active title describes household assistance,
while the old 5,000 price, PER_PERSON basis and TODAY_FLEXIBLE schedule remain. Both title and price
are unconfirmed; conversation OPEN, no bound task. References: sequences320–334.

The schema has only fact upserts. `rpc_ai_apply_interview_turn_v2_service` supersedes a key only when
that key is proposed again; omission never means removal or invalidation. There is no structured
distinction between correcting this task and starting another task. Old terms may be intentionally
retained for a correction, so globally clearing them is not a fix. Ask a targeted task-switch clarification,
then use an explicit reviewed transition/invalidation mechanism. Never delete an existing task or
silently carry its terms into a different one.

### C05 — A daily multi-day price does not match the supported price unit: observed material defect

In sequences337–340 the person describes three workers, three days, 5,000 per person per day. The AI
reply describes 15,000 per day. Stored facts are `price_rsd=5000`, `price_basis=PER_PERSON`, people3,
and a single FIXED_WINDOW from September21 08:00 to September23 16:00. They are unconfirmed and unbound.

Current `private.assert_application_price_v5` multiplies the task's amount only by covered people,
not by days. The client's `needPriceText/needPriceBasisNote` does the same. A 3-person application under
those terms would be 15,000, while the described three-day total is 45,000. No such application was
made in this investigation. The continuous time range also fails to represent separate daily shifts.

Do not add a daily pricing model silently. The smallest safe product approach is to clarify whether
one task covers all the dates, calculate/propose the amount for that whole period for explicit review,
and explain unsupported repeated daily schedules rather than representing them as one continuous shift.
Product behavior for multi-day/recurring work must be agreed before implementation.

### C06 — Relative date contradicts the person's words: observed material defect after v44

Input319 at `2026-09-20T22:59Z` is already September21 in Serbia and says tomorrow. Reply320 names
September21; its proposal stores TODAY_FLEXIBLE with evidence "sutra". The next Serbian date is
September22. The deployed code supplies the correct Serbia clock, so this example is not explained by
the client failing to send today's date. The model misinterpreted it and the parser accepted the
well-formed but wrong enum. Its self-reported confidence was0.9, which is not independent validation.

Offline RELATIVE_DATE_CONTRADICTION reproduces that lack of input/value checking. Add deterministic
checks for simple unambiguous relative dates, preserving correction/negation/context handling. Never
replace natural language interpretation with a naive substring rule that also catches "not today".

### C07 — Unclear input is converted into assumed understanding: observed, source of uncertainty

Reply334 turns an unclear food-related transcript into a confident household-meal task and proposes
headcount1. The writer validates the type and evidence length, not whether the evidence actually supports
that interpretation. A low-confidence or unknown-input decision is not required before a material patch.

The STT handoff sends text only; the task model has no acoustic evidence and cannot diagnose the microphone.
An older stored reply270 claims it hears the person clearly, although this endpoint receives no audio.
This is a capability wording problem; the audio quality itself was not tested. Resolve ambiguous work,
numbers and places before proposing material facts. Keep the editable transcript and explicit Send.

### C08 — Rich or long conversation context can lose useful information: reproduced latent risk

The latest 30-message window is intentional bounded context, not unlimited memory. Known facts outside
that window usually survive in structured state, but conversational preferences such as a declined photo
offer do not. Separately, the 8,000-character substring can end inside a valid fact's JSON text and omit
later facts. Offline FACT_TEXT_TRUNCATION demonstrates this with allowed-size description/access fields.
No incidence of that truncation was measured on DEV. It should not be claimed as the cause of the short
observed dialogues' repetition.

Use a typed, priority-preserving context budget and minimal persistent dialogue state. Never remove privacy
filters or transmit a raw private map witness to solve memory. A structure-aware compact summary should
preserve exact material values, not paraphrase away price/date/consent.

### C09 — The UI repeats facts too: confirmed source behavior, no new device claim

`AiConversationShell` shows `body` verbatim. `IntakePresentation` also shows the summary card and per-turn
fact chips. This compounds prose repetition. The UI does not generate those long answers; the model does.
Chips are looked up against current active fact IDs, so superseded historical proposals can disappear from
older bubbles; this is not proof their messages were lost. Redesign should assign one clear purpose to
the card, transcript and change feedback while preserving all review data and accessibility.

### C10 — No-op proposals can create new fact versions: permitted, uncommon in measured sample

The task prompt does not explicitly require omission of unchanged fields (the worker prompt does).
The Edge forwards unchanged values and SQL always supersedes the same key, resetting a proposed row to
NEEDS_CONFIRMATION. Two of157 recent AI-origin proposals matched the preceding same-key value. This is
not the main measured cause of verbal repetition. If optimized, preserve evidence updates and the exact
context/receipt hashes; never treat a same-looking display label as value equality.

### C11 — Full-registry review cap still says22: additional latent compatibility finding

The TypeScript registry now has23 keys, but live `rpc_prepare_ai_task_review` still rejects more than22
facts before projection. The client limit is registry-derived. A maximally populated historical/manual
task could therefore fail review. This is source-confirmed but was not exercised with synthetic rows on
DEV; no such rows were created. Prove the real full-registry case on a disposable database before changing
the guard. It is separate from reply style and was not marked fixed by this audit.

## What already follows the design

- One conversation can take multiple facts at once; not every field requires its own question.
- Corrections to the same key supersede prior values and preserve history.
- The observed transport correctly distinguishes workers from passengers in the selected example.
- Price-basis clarification is necessary when multiple people and an ambiguous amount are supplied.
- Auth, owned context, request/attempt fencing, current-state readback and no automatic paid replay
  are real implemented controls. They do not establish semantic accuracy.
- Final exact-content review and explicit save/publish remain. Do not remove them to shorten the chat.
- Publication recovery PKG-037 is separate from the still-open interview recovery11.1. A shorter prompt
  alone does not fix timeout/settlement behavior.

## Recommended repair sequence (proposal, not an applied change)

1. Build a reusable evaluation set with the cases below; judge meaning and exact material data, not an
   exact preferred phrase. Preserve existing security/idempotency/streaming tests.
2. Define a small shared dialogue contract: acknowledge a change, ask one missing item, clarify an
   ambiguity, or hand off to review. Include the targeted field/reason and changed facts. Completion
   is explicit; optional suggestions do not keep a finished interview open. Both task/profile use "ti".
3. Supply safe server-derived progress: known/missing/conflicting facts, relevant map-slot completion
   and whether photos already exist. Persist only the minimal declined-offer/finish state required,
   within retention/closure boundaries. Do not expose private witnesses or create a new engine.
4. Fix material semantics first: relative date, price/time unit, task switch and contradictory inputs.
   Clarify unsupported multi-day behavior; do not silently add recurring tasks or daily price units.
5. Generate one brief useful reply, usually one question. Show established data in the card/review;
   repeat an amount when confirming its basis/total is necessary. Allow explanation when the person
   asks for one. Avoid a rigid field-by-field questionnaire.
6. Make validation precede authoritative display. Current streaming exposes draft prose before full
   parsing/persistence; a new semantic checker added after the text has already streamed cannot take
   those words back. Design this ordering with latency and the existing provisional/final boundary.
   Reuse one paid attempt; do not introduce a second provider call to grade every answer.
7. Prove SQL changes on the disposable stack, preserve all closure/request/source pins, then follow
   existing DEV approval rules. Certificate moves remain separately approved. Run a specifically
   authorized real-provider quality evaluation later; offline mocked outputs cannot prove model obedience.
8. When the owner is ready, verify dictation, interruption, correction, map/photo return and final review
   on the phone. No new libraries or app-wide visual redesign are needed to resolve the semantic core.

Evaluation cases: all facts in one message; only one missing fact; change only headcount; explicit total
vs per-person; daily amount across several days; tomorrow near midnight; a negated/corrected date; unclear
dictation; unrelated task switch; already confirmed map; already added/declined photos; long history and
rich facts; profile complete + done/save; a genuine unanswered necessary question; same-key replay;
provider timeout/lost ACK; full23-key review. Prefer one material question, preserve supplied values,
never falsely promise saved/published/verified status, and never create chargeable retries automatically.

## Reproduce the offline observations

```text
node supabase/proofs/ai/conversation_semantics_audit.mjs
```

The eight observations deliberately show what the existing boundary permits. They are not permanent
tests endorsing that behavior; convert them to before/after regressions as fixes land. No full Jest/type
rerun or APK build is claimed for this documentation-only investigation. The last full application
result remains the separately recorded PKG-037 result.
