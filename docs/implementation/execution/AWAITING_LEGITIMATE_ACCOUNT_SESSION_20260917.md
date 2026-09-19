# AWAITING_LEGITIMATE_ACCOUNT_SESSION — one historical AI turn

Owner decision, 2026-09-17. This replaces the earlier working label
`LEGACY_OWNER_SESSION_BLOCKER`, which wrongly implied the turn blocks something. It does not.

## The row, exactly as it stands

Read-only from canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth` on 2026-09-17. Nothing was written.

| Field | Value |
| --- | --- |
| account | `uskocibusiness@gmail.com` |
| conversation | `23e74284-3eee-462e-b6f5-6a1c40857587`, status `OPEN`, purpose `NEED_INTAKE`, bound need: none |
| client request | `41cf65f2-021c-45f6-b9c2-08b6ac44fa10` |
| turn state | `PROCESSING` |
| provider dispatched | `true` |
| created | 2026-09-13 15:42:39 Europe/Belgrade |

`provider_dispatched = true` with no completion is the system's honest record of an **unknown
outcome**: the request reached Gemini and the answer never came back. That is a real state the
engine is designed to represent, not corruption.

## What must not happen to it

The owner's instruction, and the reason for each part:

- **No impersonation.** `rpc_ai_cancel_need_turn_v2` is `SECURITY DEFINER` and takes only
  `p_conversation_id` and `p_client_request_id`. It has no "expected user" argument, so it derives
  the actor from `auth.uid()` alone. The only way to call it for this row is to be signed in as
  that account.
- **No service-role or admin shortcut**, and no direct `UPDATE` or `DELETE` on the row, merely to
  make the dashboard look clean. Editing it would destroy the one honest record that a provider
  call was dispatched without a known result.
- **No falsified success.** Cancellation must leave `provider_dispatched` true. A cancelled turn is
  recorded as `FAILED` with the dispatch still visible, never as if it had succeeded.

## The exact procedure, for when the owner really signs in to that account

This is an ordinary user action in the app. It needs no script and no elevated access.

1. Sign in to the app as `uskocibusiness@gmail.com` with that account's own credentials. A real
   Supabase Auth session is what makes `auth.uid()` correct.
2. Open the AI task-creation screen, `/nova`. It resumes the stored conversation
   `23e74284-3eee-462e-b6f5-6a1c40857587` from its durable coordinates.
3. The screen reads the unresolved command through `rpc_ai_recover_need_turn_v2` and only offers the
   cancel action when the server itself reports `recovery.canCancel`. Use that action.
4. It calls `rpc_ai_cancel_need_turn_v2(p_conversation_id, p_client_request_id)` under that
   account's own identity, then re-reads the canonical state rather than trusting the response.

**Expected result, already proven on a different turn during PKG-014:** state becomes `FAILED`,
`provider_dispatched` stays `true`, the row is not deleted, and no success is claimed. Verify with
a readback of `private.ai_need_turn_commands` for that client request id.

If the app no longer offers the action because the conversation has moved on, that is also an
acceptable outcome: the state is honest either way, and nothing depends on closing it.

## A second legitimate path, later and automatic

This conversation is `NEED_INTAKE` with no bound need, which is exactly the population the retention
purge adapter `P3_AI_ABANDONED_UNBOUND_V1` is written for. Its conversation status is `OPEN`, not
`ABANDONED`, so it is not currently eligible. If approved retention periods are ever published and
that adapter's source gate opens, the turn could be retired by policy without anyone signing in.
That path is described in `docs/implementation/v5-ai-first/RETENTION_ACTIVATION_GAPS.md` and needs
owner-approved durations first.

## Scope: this blocks nothing

It does not block PKG-015 or any later package unless that package's own acceptance criteria name
this conversation, and none of them do. PKG-015 is about DEV data lineage and isolated test
accounts; this row is in fact an example of the kind of pre-existing DEV data that PKG-015 will
classify, not an obstacle to it.

Treat it as a known, labelled, historical row. Do not schedule work to "fix" it.
