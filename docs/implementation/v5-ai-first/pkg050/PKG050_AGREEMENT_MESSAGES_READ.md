# PKG-050 — reading the conversation settles its "Nova poruka" notifications

**Status: WRITTEN, proof pending.** Control rows D03 and P01. Owner decision 2026-09-23.

## What was seen

Two-party run, 2026-09-23 (`docs/implementation/functional-audit-20260922/device-20260923/dve-strane/TWO_PARTY_RECEIPT.json`,
step 8). The requester had the Dogovor's Poruke tab open on the phone when the worker's reply arrived; he pulled
down and read it. His `MESSAGE_RECEIVED` event stayed unread on the server. The owner's words: he never left the
chat, and once the message is seen in the chat, the notification has to be settled too.

## Why

`public.user_activity_events.read_at` is written in exactly two places today:

| writer | what it settles | why it does not fit |
| --- | --- | --- |
| `rpc_mark_activity_event_read(p_event_id)` (md5 `89729d59…`) | one event, by id | the conversation never has the event id; only the inbox list does |
| `rpc_mark_inbox_read(p_through, p_role)` (md5 `577d1582…`) | everything for a role up to a moment | would also silence notifications about other tasks and Agreements the person has not seen |

Nothing settles "the message events about this Dogovor", which is what a person in the conversation has read.

## What changes

**Server, `pkg050a_agreement_messages_read.sql`** (function-only, the certified closure digest must not move):
`public.rpc_mark_agreement_messages_read(p_agreement_id uuid) returns integer`, authenticated only,
security definer, `search_path = pg_catalog`.

- `AUTH_REQUIRED` without a session; `INVALID_AGREEMENT` for null; `AGREEMENT_NOT_FOUND` (P0002) unless the caller
  is the requester or the worker of that Agreement — the same refusal the workspace gives a stranger.
- Marks `read_at = statement_timestamp()` on the caller's own `MESSAGE_RECEIVED` events whose `entity_type = 'AGREEMENT'`
  and `entity_id = p_agreement_id`, unread, and — exactly as `rpc_mark_activity_event_read` — only when an `IN_APP`
  delivery exists that was not `SUPPRESSED`.
- Touches nothing of the other party's and no other event kind (`RESPONSE_*`, `COMPLETION_REQUIRED`, …).
- Returns the number settled: 0 means "nothing was unread", not failure.

**App:**

- `Izvor.oznaciPorukeProcitanim(dogovorId): Promise<number>` in `src/data/ports.ts`; `supabaseIzvor` calls the RPC and
  throws `MESSAGES_READ_UNCONFIRMED` on any refusal or malformed answer; `lazniIzvor` returns 0.
- `src/app/dogovor/[id].tsx`: whenever the **Poruke** tab is showing and the message list has loaded without error,
  the screen calls it once for that list. Best effort — a refusal or a hung call changes nothing in the conversation.
  Opening the Pregled tab does not settle anything; the person has not read the messages there.

## Proof

`supabase/proofs/pkg050/pkg050_proof.mjs`, run by `.github/workflows/pkg050-agreement-messages-read-proof.yml` on a
disposable database with the real local Auth/PostgREST stack:

1. exact replay of the DEV chain up to PKG-048a (five pins), certificate ready, the function absent, both existing
   writers at their pinned md5;
2. a real Dogovor (published task → offer → selection) with three real messages; both sides hold unread
   `MESSAGE_RECEIVED` events with in-app deliveries; the requester also holds an unread `RESPONSE_RECEIVED`;
3. before: no such writer, events stay unread;
4. tampers (drifted predecessor pin, changed body) roll back atomically;
5. applied once, refuses twice, only one function added to the surface, certificate byte-identical;
6. the requester settles exactly its two message events; the worker's event and the `RESPONSE` event are untouched;
   a second call settles 0;
7. the worker settles its side; a new message is unread again until read;
8. stranger, unknown id, null and anon are refused; certificate unmoved.

Focused client regressions: `pkg011-agreement-workspace.test.tsx` (Poruke tab settles, Pregled does not),
`agreement-screen-recovery.test.tsx`; `tsc` clean.

## Not in this package

- Marking `notification_deliveries.read_at` — no existing writer does, and no reader depends on it.
- Settling other Agreement events (selection, completion) by opening the Pregled tab: a separate owner decision.
- Push delivery: the transport is off; this changes nothing there.
