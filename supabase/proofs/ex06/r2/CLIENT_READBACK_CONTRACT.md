# EX-06E R2 — proposed owner readback / client contract

Source proposal only. No client import, screen, RPC read function or DEV deployment is implied by this document.

## Immutable command

`rpc_reopen_remaining_search(p_need_id uuid, p_expected_revision integer, p_expected_closed_at timestamptz, p_client_request_id text, p_reason text)`.

Use the exact closedAt text read from the server; never round through JavaScript Date. The actor and shared-ledger key are bound server-side. A first command binds the observed closure; its replay is immutable history, not a claim about current state. Different payload under a used key is refused.

The wire result carries command=REOPEN_REMAINING_SEARCH_V1, Need/revision, observedClosedAt, authoritative=true, original selected/remaining slots and replay flag. The client validates all of these, not merely HTTP success.

## Two reads answer different questions

CURRENT STATE answers: is this search closed now, how much capacity is missing, and which action is permitted now? COMMAND HISTORY answers: did this exact earlier request commit?

The existing closure-field read is insufficient to authorize a reopen button by itself. A minimal future owner-only projection should extend an existing suitable owner read with authoritative serverAsOf, Need id/revision/status; requiredSlots, coveredSlots and missingSlots; searchAuthority OPEN/CLOSED and exact closedAt; canReopen and a finite reason code; and references to permitted existing Dogovor actions where applicable, without exposing private participant terms.

This is a proposed projection, NOT an existing/live endpoint. The final reader must use the same time/capacity predicates as the writer. Phone clock/loaded list counts never grant permission. Even canReopen is advisory until the command rechecks under its lock. Completed allocations are not reopened as missing work, and invitation recipient count is not coverage.

An unknown-outcome journal needs either an owner-only read of the exact command ledger receipt or an explicit same-command retry. Calling the mutation RPC is NOT read-only reconciliation: a delayed first call could execute. Automatic startup reconciliation therefore reads only; a retry requires an explicit user action and retains the original key/closure witness. Do not infer receipt history from a currently open task.

## UI

Show missing capacity and manual search closure independently. When permitted: `Potraga je zatvorena. Nedostaje još N.` and `Ponovo traži ljude`. After submission reread CURRENT STATE. If another device has closed the search since this command committed, show the new closed state, not the old successful receipt as a current-open banner.

If time has passed: `Termin je prošao. Proveri Dogovor i izaberi sledeći korak.` Reuse existing completion/confirmation/problem/change/cancel capabilities. Do not auto-complete, silently extend the search, change required_slots or mutate accepted Agreement terms. `Nastavi bez njih` is meaningful only where existing remaining participants can complete the current work; zero coverage is not a completed job.

## Required integration proof (not executed in R2)

Same immutable key after network loss/restart; account-switch isolation; old callback fencing; two-device closure/reopen race; exact current state after a successful historical replay; expired time with no enabled reopen; existing parent Need/Agreement navigation; physical notification tap/readback. Source/server proof is not phone acceptance.
