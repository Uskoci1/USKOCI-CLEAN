# HITNO — pending owner decision, not activated

The complete V5 command §303 retains HITNO in scope. Current canonical code is
`20260829211904_clean_urgency_projection.sql`: `rpc_urgent_activation_preview`,
`rpc_activate_urgent`, `fn_need_urgency`, dispatch and expiration authority exist.
The stored initial policy is disabled with an empty exact category allowlist.
Its 360-minute start horizon, 60-minute lifetime and minimum choice 2 are source
defaults, not evidence of an accepted product decision. No canonical category
registry exists; the six old demo categories must not become a live allowlist.

Known decisions remain: an explicit requester action, physical task only,
separate from availability or booking; no new fee under promotional-free launch;
quiet hours apply unless the worker has separately opted into urgent bypass.
Safety, eligibility, closed/filled tasks and current revision still govern.

Proposed owner decision:

- Eligibility includes any physical Task that passed the existing reviewed
  publication policy. Free-text category spelling is not an extra gate.
- The explicit start must be in the next 6 hours, or the canonical schedule is
  today's flexible window. A past explicit start cannot be newly activated.
- An activation lasts at most 60 minutes, shortened to the earlier explicit
  start or response deadline. It cannot silently extend beyond either boundary.
- The initial urgent dispatch target is at least 2 eligible candidates when
  available; this is not a promise that two people exist or will respond.
- The final action and review show server expiry and the absence of an added
  connection fee. This decision alone does not authorize live configuration.

Implementation: extend the existing decision and activation seam, retaining
canonical dispatch and projection. Add owner/revision/policy-bound preparation,
an opaque UUID command and exact readback so app restart cannot reactivate an
expired window under a new key. Recheck publication/eligibility and closure at
the final lock. Native entry lives in the owned Task workspace, with readiness,
review, activation, unknown/readback and actual expiry states. No local timer
publishes an urgent flag and no new scheduler or paid provider is introduced.

Required proof: disabled/malformed policy, role/ownership, stale policy/revision,
open/filled/remote/time boundaries, duplicate and cancellation races, expired
same-key replay, one dispatch, ordinary safety and quiet-hour behavior. Real
push delivery remains a separate physical-device proof.
