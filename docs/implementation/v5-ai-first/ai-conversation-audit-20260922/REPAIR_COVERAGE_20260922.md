# AI semantic findings — current repair coverage

Updated2026-09-22. Read the original REPORT.md as the historical baseline; use package receipts for
deployment facts. This matrix is deliberately not an "AI accuracy" score. No paid model evaluation
or phone journey was run. Mocked provider outputs prove application boundaries, not model obedience.

| Finding | Implemented protection | Remaining evidence / limit |
| --- | --- | --- |
| C01 repeated recap / multiple questions | PKG-038 requires a dialogue action and exact target; ASK becomes one missing-field question; ACK becomes one brief update. | ANSWER/CLARIFY prose and the model's choice of action still need real conversational evaluation. |
| C02 finish / profile loop | Task and worker finish-only utterances cannot fabricate terms; handoff goes to explicit review. Profile prompt forbids endless optional questions and uses ti. | Other phrasings and general worker question quality remain model-dependent. No save or activation is inferred from prose. |
| C03 unseen map/photo | Removed instructions that required the model to repeatedly request state it cannot see; native controls own those steps. | No new persistent declined-offer state or map/photo progress metadata was introduced. |
| C04 different task inherits terms | DIFFERENT_TASK/UNCLEAR classification withholds all proposals and directs to new-task/clarification. | Correct classification itself is unproven; there is no automatic destructive reset. |
| C05 daily price / repeated days | PER_DAY/PER_HOUR/REPEATED classification withholds material proposals and asks for supported terms. | Owner choice remains pending. Do not claim daily pricing or repeated shifts are supported. |
| C06 relative dates | PKG-038 checks simple day utterances; PKG-041 additionally checks literal day evidence against a typed schedule/start inside a full sentence. | Conflicts ask for an exact date. Complex wording, quoting and general interpretation are not solved by this narrow rule. |
| C07 unclear input | Prompt and dialogue schema provide explicit clarification; material ambiguity states withhold proposals. | Model confidence is not independent evidence. Dictation is editable text, not proof of what was said/heard. |
| C08 context loss | Complete typed current facts replace the broken8k substring; no duplicate display strings; request size still bounded. | Only last30 messages; durable optional preferences and long-history model behavior remain open. |
| C09 UI repeats facts | Current facts stay on the card/full review; old messages no longer acquire changing fact chips. UNKNOWN is not known. | Native tests and APK prove implementation/build; phone behavior remains untested. |
| C10 identical fact versions | Equal typed values omitted; UNKNOWN can still be replaced. | This does not validate a changed proposal's meaning. |
| C11 full review cap22 vs23 | Registry-derived23-key cap, actual SQL/Auth/REST proof and DEV application in PKG-038. | Device full-review journey still pending. |

Separate reliability work: PKG-037 publication; PKG-039 task/profile interview; PKG-040 Q&A.
Consult each package's current status; candidate existence never proves deployment. The crash sweep
grace is separate from bounded handler cleanup, and an owned unknown result never licenses paid replay.

## Human acceptance route once explicitly authorized

Use the owner's account, real intended task and editable text on the phone; never fabricate a DEV
account or a successful flow. First use typing; speech only with explicit readiness. Ask about one
missing value, correct headcount, distinguish total/per-person, mention tomorrow near a day boundary,
finish, and inspect the exact full review. Confirm that only intended facts changed and publication
still needs explicit approval. Repeat profile finish and a task question after transport interruption.
Record actual outcomes without raw personal conversations in repository reports.

A real-provider quality evaluation is a separate authorization from running these offline proofs.
Avoid extra provider calls for grading or automatic retry. No claimed rate of semantic correctness,
completion, latency or user capacity exists yet.
