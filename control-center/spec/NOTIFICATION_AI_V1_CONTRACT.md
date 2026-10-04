# Notification + AI Inspector v1

SOURCE ONLY. No DEV apply.

## Notification Inspector
Input: durable event ID.

Shows:
- event metadata without payload;
- notification preferences relevant to the recipient/role;
- IN_APP/PUSH delivery state/timestamps/suppression;
- push attempt transport state/outcome/platform/error code;
- transport readiness authority.

Never shows notification body, push token or provider ticket ID.

Important: transport readiness and provider acceptance are not physical phone delivery proof. `deviceDeliveryProof` remains UNKNOWN until an explicit app/device acknowledgment signal exists.

## AI Inspector
Input: AI conversation ID.

Shows:
- purpose/status/bound Need;
- message counts, role counts, safety buckets and message metadata;
- active structured-fact keys and status/source counts;
- action-proposal counts.

Never shows message body, fact value or evidence excerpt.
Provider latency/token/cost stays UNKNOWN until an authoritative provider telemetry projection exists.
