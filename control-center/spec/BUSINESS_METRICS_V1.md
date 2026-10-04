# Business metric semantics v1

These formulas are the owner-facing meaning of Overview cards.

- **Registered total** = all `app_accounts`.
- **New accounts 24h** = `app_accounts.created_at` in the last 24 hours.
- **Active users 24h** = **UNKNOWN** until a canonical cross-app activity signal is approved. Never infer it from profile updates or push-device timestamps.
- **Available workers now** = active WORKER profiles with `available_now=true`.
- **Open for matching** = Needs in `PUBLISHED + SELECTION`.
- **Active tasks** = Needs in `PUBLISHED + SELECTION + ACTIVE`.
- **Applications / offers 24h** = marketplace responses created in the last 24 hours.
- **Active Agreements** = Agreements in `CONFIRMED`.
- **Completed 24h** = `agreement_execution.state=COMPLETED` with `completed_at` in the last 24 hours.
- **Reviews 24h** = agreement reviews created in the last 24 hours.
- **Push backlog** = PUSH deliveries still CREATED/QUEUED/FAILED_RETRYABLE for more than 15 minutes and not expired.
- **Push success %** = OK / (OK + RETRYABLE + FATAL) push attempts in the last 24 hours. QUEUED is excluded from the denominator.
- **AI conversations 24h** = sum of canonical conversation purpose/status buckets in the last 24 hours.

No metric may silently convert UNKNOWN into zero.
