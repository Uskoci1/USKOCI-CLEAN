# Owner decision: leave an unknown dispatched AI response

Proposal only. No SQL, native behavior, paid call or live setting is changed by
this document. Existing automatic retry prohibitions and shared test budget stay.

## Concrete failure

At dc0f08aaaefd35ee3b5c88903d81f8759ad25ab1, a Task AI request can remain
PROCESSING after provider dispatch if the app/Edge stream is interrupted before
durable completion. Expiry does not prove the provider did not run. Candidate132
therefore forbids retry and cancellation of that dispatched request.

The account's opaque local journal correctly preserves the unresolved operation
across restart. In `src/app/(app)/nova.tsx`, it blocks starting another conversation
until the old operation is resolved or authoritatively fenced. An unbound intake
has the existing abandonment escape. A Task edit conversation has boundNeedId;
both its native abandonment action and canonical106 abandonment RPC reject it.
An unresolved dispatched turn in that edit can therefore block even a new Task.
Candidate141 deliberately has the same pre-dispatch-only cancellation boundary
for Worker AI. Simply clearing the local journal or retrying is not a fix.

## Proposed explicit owner action

For both Task and Worker AI, offer “Odustani od odgovora” for an unresolved
dispatched response. State clearly that the provider may already be processing
it and its reserved/actual cost is not refunded by this action.

The action would durably fence the exact account/conversation/request under the
same locks used by dispatch/completion. If cancellation wins, no delayed result
can append assistant output, change facts/profile candidates, or publish/save.
The provider request itself is not represented as physically cancelled. Keep its
dispatch evidence, cancellation timestamp and conservative budget reservation;
do not mark the key retryable, issue a refund, delete history, or invoke AI again.

If completion wins the race, return the actual completed receipt and show it.
If the cancellation acknowledgement is lost, recover the same server operation
before clearing the local journal. A cancelled exact key cannot be reclaimed.
Only a later, explicit new message may request another provider call and reserve
its cost within the existing approved test ceiling. Saved Task/profile data are
unchanged by the cancellation action itself.

## Required verification if approved

Actual disposable Auth/Postgres races: dispatch/cancel, completion/cancel, lost
acknowledgement/restart, key reuse, wrong account/conversation, and late completion
after cancellation. Native checks: accurate action label/cost copy, restored
journal and renewed editor access only after authoritative readback. Check both
Task and Worker paths and existing source/export/retention guards without adding
a retention duration or changing provider/privacy scope.

This changes the permitted owner action after dispatch and requires the owner's
new product decision. Until answered, the existing conservative behavior remains.
