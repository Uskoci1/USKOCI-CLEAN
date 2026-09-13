# Q&A policy — numeric limits and Gemini purpose approved

Existing authority: `PUBLIC_PRESELECTION_QA_CONTRACT.md`, OC-006 and V5 view53
require bounded text and server rate/abuse/duplicate checks. No approved numeric
limits were found. The current rate-authority function always returns NOT_READY.
Candidate133 adds owned readiness and exact command recovery only; it does not
open this gate. The owner explicitly approved the following values (AF-D11)
on2026-09-13; a separate implementation/proof will enforce them.

Approved numeric policy:

- Question at most500 characters; answer at most1000 characters.
- Per authenticated account: at most10 admitted questions in a rolling24 hours,
  at most3 on the same Task in rolling24 hours, and60 seconds between new asks.
- An identical normalized question for the same Task revision is a duplicate.
- Same-key command replay consumes no additional allowance. Enforce counts and
  admission atomically on the server, not with a local timer.

The owner explicitly approved the classification purpose (AF-D12): use the already approved Gemini3.8Flash model
on the proposed question/answer and the relevant public Task snapshot to assess
private contact/address leakage and whether an answer changes material Task
terms. Do not send private Task fields, account IDs, credentials or original
audio. Use the existing shared internalUSD5 reservation ledger and paid-test
gate; no separate budget, Files API archive or silent provider fallback.
Provider classification cannot publish a Task, alter agreed terms or replace
the existing owner/public Q&A visibility rules. Unknown calls keep their exact
attempt unresolved and cannot start another paid request automatically.

Both bounded decisions came from separate explicit owner answers, not an
inference from Task-photo moderation approval. No provider call or live
activation has occurred. Exact implementation, proof and concrete live batch
remain to be completed.
