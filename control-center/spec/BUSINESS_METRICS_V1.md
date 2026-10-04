# USKOČI CONTROL — Business metrics v1

These definitions are frozen before live runtime wiring.

- **registeredTotal**: count of `public.app_accounts`.
- **registered24h**: accounts with `created_at` in the last 24 hours.
- **active24h**: **UNKNOWN** until one canonical cross-app activity signal is approved. Profile updates, push-device last_seen and event receipt are not substitutes.
- **active worker profiles**: WORKER profiles with `profile_status='ACTIVE'`.
- **available now**: active WORKER profiles with `available_now=true`.
- **Need byStatus**: exact database status buckets.
- **active Needs**: status in `PUBLISHED | SELECTION | ACTIVE`.
- **open for applications**: status in `PUBLISHED | SELECTION` and response deadline absent or still in the future.
- **published24h**: `published_at` in the last 24 hours.
- **response created24h**: response row created in the last 24 hours; may include DRAFT.
- **response submitted24h**: `submitted_at` in the last 24 hours. This is the number to label as submitted applications/offers.
- **active Agreements**: Agreement status `CONFIRMED`.
- **completed24h**: Agreement status `COMPLETED` AND execution state `COMPLETED` with `completed_at` in the last 24 hours.
- **completionMismatchCount**: Agreement/Execution completion truth disagrees. This is an anomaly, not a successful completion.
- **review created24h**: immutable Agreement review created in the last 24 hours.
- **push overdue backlog**: PUSH delivery still CREATED/QUEUED/FAILED_RETRYABLE for more than 15 minutes and not expired.
- **push outcomes**: transport-attempt outcome buckets; do not label them phone delivery unless a stronger receipt exists.
- **AI conversations24h**: purpose/status buckets for conversations created in the last 24 hours.

Never collapse these into one generic "active" number. UI labels must reflect the exact source semantics.
