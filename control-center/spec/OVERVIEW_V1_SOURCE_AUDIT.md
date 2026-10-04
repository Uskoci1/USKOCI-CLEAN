# Overview read-model v1 — source-only candidate

This is not applied to DEV.

## What is authoritative in the draft

- registered accounts: public.app_accounts
- active worker profiles / available now: public.app_profiles
- task status buckets: public.needs
- application/offer status buckets: public.marketplace_responses
- Agreement status buckets: public.agreements
- review counts: private.agreement_reviews
- push delivery/attempt status buckets: notification_deliveries / notification_push_attempts
- AI conversation purpose/status buckets: public.ai_conversations

## Deliberately UNKNOWN

activeAccounts24h is NULL/UNKNOWN. app_accounts.updated_at is not a reliable cross-app activity signal, and push-device last_seen_at does not cover every account. A canonical activity definition must be chosen before this KPI exists.

## Privacy

The result contains no email, phone, exact address/coordinate, push token, chat body or AI message body.

## Before any DEV apply

1. direct read-only canonical DEV schema/ACL readback;
2. verify exact relation/column/status presence and current function-name availability;
3. EXPLAIN (ANALYZE, BUFFERS) on representative DEV-safe/disposable data;
4. confirm service_role-only EXECUTE and anon/authenticated denial;
5. test output shape and missing/zero distinction;
6. owner approval for the exact candidate.
