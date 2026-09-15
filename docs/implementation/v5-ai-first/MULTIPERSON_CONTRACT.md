# Multi-person cooperation: existing decisions and remaining boundaries

Source review: 2026-09-13. This is an implementation record, not a new product
master. V5 requires the feature; it has not been deferred or removed.

## Already locked

`docs/authority/sources/owner-history/01_OWNER_LOCKS/OWNER_LOCKED_DECISIONS.md`
L-007A/B/C/C.1, L-021/L-022 and
`docs/authority/sources/owner-history/01_CURRENT_CANON/OWNER_REVIEW_21_FINAL_COMPLETE_SOURCE.md`
item20 establish:

- One actual Task group conversation for requester and selected participants;
  existing individual Agreements remain the business authority.
- Requester can privately message each participant. No automatic participant
  to participant private channel.
- Prices, individual terms, application details and private problems remain in
  the individual Agreement. Only requester sees the management roster/statuses.
- Participants see names/avatars as common chat membership, not others' private
  lifecycle or replacement management.
- Completing one's Agreement retains group participation until overall terminal
  state. Cancellation/removal ends sending and all future-message access.
- Previously legitimate history remains subject to retention/privacy rules.
  Overall terminal group is read-only. No copied messages across private chats.
- Replacement uses the same Task and ordinary application/selection, without
  changing the remaining Agreements.

These decisions must not be asked again. The earlier screen inventory overstated
the missing product contract: the missing work is primarily implementation.

## Additional owner approvals, 2026-09-13

1. AF-D13: owner approved messages from the newly selected/replacement
   participant's admission onward only. Requester can deliberately repeat common
   instructions. This grants no access to earlier messages.
2. AF-D14: owner approved hiding future messages between the blocked pair and
   rejecting new group sends by a participant blocked with the requester. Other
   eligible participants continue ordinary coordination. Do not expose who
   blocked whom. Existing private safe exits remain available.

Both answers were explicit in this task. The implementation must use
transactional membership boundaries, server sequence cursors, actor-scoped
receipts, and recheck before message delivery/read, including queued push.
No retention duration, group provider, automatic invitation or live activation
is established here.
