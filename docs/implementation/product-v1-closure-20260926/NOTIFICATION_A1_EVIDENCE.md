# Notification A1 evidence — 26.09.2026

Status: **SOURCE / CI PASS — RUNTIME BINDING NEXT**.

- Source commit: `edfc14680353bc289a75eed7ed7d7f76bf6e9d8b`
- CI: `36258688611`
- Matrix tests: **28 / 28 PASS**
- Existing N09 Edge transport regressions: **44 / 44 PASS**
- DEV/Edge/database changes from this A1 package: **none**
- provider send from this A1 package: **none**

## Contract proven

`supabase/functions/_shared/pushNotificationCopy.mjs` accepts only `eventType` and urgency. It has fixed copy for all 24 currently admitted event types. It has no parameter for message text, address, contact details, task title or arbitrary event payload.

Unknown, malformed or future event types fail closed to:

- title: `USKOČI`
- body: `Imaš novo obaveštenje. Otvori aplikaciju.`

`HITNO` changes only the `OPPORTUNITY_AVAILABLE` headline. It cannot turn a chat/account event into an urgent marketing-style notification.

## Runtime boundary still required

The current live `rpc_begin_push_send` deliberately returns only attempt/lease/token/priority. It does not return title/body/event/entity/private payload.

The next package should add **only an allowlisted event-type signal** to the service begin contract (or an equivalent narrow service projection), then consume this fixed formatter in the Edge worker. Do not expose raw `notification_deliveries.title/body` or arbitrary `user_activity_events.payload` merely to get richer push copy.

A2 distance, locality, price and “Traže se ponude” wait for a separately typed safe facts projection described in `NOTIFICATION_MATRIX.md`.
