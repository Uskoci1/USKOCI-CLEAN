# Matching / Dispatch Inspector v1

SOURCE ONLY. No DEV apply.

Aggregate view reads only recorded dispatch truth:
- dispatch_rounds (last 20);
- opportunity_deliveries for current Need revision;
- response status buckets;
- delivered positive reason-code counts.

It does NOT run match_detail across all workers.

Optional worker drill-down calls canonical private.match_detail() once for one worker profile and labels the result CURRENT_RECOMPUTE.

Historical semantics:
- an existing opportunity_delivery is positive historical proof that the worker was delivered for that revision;
- absence of a delivery is NOT proof of the historical exclusion reason;
- for a non-delivered worker, historicalExclusionProof stays UNAVAILABLE_NOT_RECORDED unless a separate durable audit source is added later.

No exact coordinates/address, email or phone are returned.
