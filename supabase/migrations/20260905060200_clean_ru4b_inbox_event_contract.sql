-- USKOCI RU-4B — extend existing durable Inbox event contract for public preselection Q&A.
-- Proof-only candidate. It only admits the two owner-locked clarification event types
-- and the CLARIFICATION entity; all existing allowed values remain unchanged.

alter table public.user_activity_events
  drop constraint if exists user_activity_events_event_type_check;

alter table public.user_activity_events
  add constraint user_activity_events_event_type_check
  check (
    event_type = any (
      array[
        'OPPORTUNITY_AVAILABLE'::text,
        'RESPONSE_RECEIVED'::text,
        'RESPONSE_UPDATED'::text,
        'RESPONSE_VIEWED'::text,
        'RESPONSE_SHORTLISTED'::text,
        'RESPONSE_SELECTED'::text,
        'RESPONSE_NOT_SELECTED'::text,
        'RESPONSE_STALE'::text,
        'RESPONSE_WITHDRAWN'::text,
        'RESPONSE_EXPIRED'::text,
        'NEED_REVISED'::text,
        'NEED_CANCELLED'::text,
        'AGREEMENT_VERSION_CHANGED'::text,
        'AGREEMENT_CHANGE_PROPOSED'::text,
        'AGREEMENT_CHANGE_REJECTED'::text,
        'EXECUTION_STATE_CHANGED'::text,
        'COMPLETION_REQUIRED'::text,
        'MESSAGE_RECEIVED'::text,
        'PRIVATE_ACCESS_GRANTED'::text,
        'RECOVERY_OPENED'::text,
        'REVIEW_RECEIVED'::text,
        'CLARIFICATION_CREATED'::text,
        'CLARIFICATION_ANSWERED'::text
      ]
    )
  );

alter table public.user_activity_events
  drop constraint if exists user_activity_events_entity_type_check;

alter table public.user_activity_events
  add constraint user_activity_events_entity_type_check
  check (
    entity_type = any (
      array[
        'NEED'::text,
        'RESPONSE'::text,
        'AGREEMENT'::text,
        'CLARIFICATION'::text
      ]
    )
  );

comment on constraint user_activity_events_event_type_check on public.user_activity_events is
  'RU-4B extends the existing durable Inbox event vocabulary with CLARIFICATION_CREATED and CLARIFICATION_ANSWERED; previous values remain valid.';

comment on constraint user_activity_events_entity_type_check on public.user_activity_events is
  'RU-4B extends the existing durable Inbox entity vocabulary with CLARIFICATION; previous values remain valid.';
