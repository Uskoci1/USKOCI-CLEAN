# PKG-031: the owner's rules of 2026-09-21

**Owner decision, 2026-09-21.** The owner was given ten numbered proposals and answered "odobravam sve". This
package carries the ones that change the product's rules. Other packages carry the rest.

| item | owner's rule | where |
| --- | --- | --- |
| 1 (7.16) | Once the worker says the work is done, the requester cannot cancel. They confirm completion or report a problem. With no answer, the work completes on its own after 48 hours. | server `pkg031a`, client copy |
| 2 (8.27, 7.8) | Every time is shown in Serbian time, the same on both phones. If a phone is set to another zone, the time says "po vremenu u Srbiji". | client |
| 3 (9.2, 9.3) | People never see or choose a category. A short hidden list of kinds of work is used only to match a task with the right worker. | server `pkg031b`, client removes the category label |

## Item 1: no cancel after the worker says done

`pkg031a` changes two function bodies:
- `private.agreement_action_state` offers cancel in `AWAITING_REQUESTER` to the worker only.
- `rpc_cancel_agreement` refuses the requester there with `AGREEMENT_WORK_REPORTED_DONE`.

What does not change:
- Before the worker says done, both parties cancel as before.
- The worker's own path is unchanged. The owner's rule names the requester only.
- Confirming completion, reporting a problem and the 48-hour auto-completion are untouched.

In the app, the cancel button already follows the server's `canCancel`, so it disappears for the requester. A
screen that is out of date and still tries gets a sentence instead of a generic failure.

## Item 3: hidden kinds of work

`pkg031b` adds `private.work_kinds_v5(text[])`. It reads any spelling and returns the kinds of work the text names,
from a closed set of eleven:
- SELIDBE_PREVOZ, FIZICKI_POSLOVI, MONTAZA_NAMESTAJA, SITNE_POPRAVKE;
- MOLERSKI_RADOVI, ELEKTRO, VODOINSTALATER, CISCENJE;
- PRANJE_PEGLANJE, BASTA_DVORISTE, DOSTAVA.

It accepts Serbian with or without diacritics, English and snake_case. Text that names none of them returns nothing,
so an unknown word never matches another unknown word.

Matching keeps its exact comparison and also compares kinds, in two places:
- `private.match_detail_without_calendar`: the hard `PROFILE_EXCLUSION` gate and the service match;
- `private.dispatch_cheap_candidate_admitted`: the same two tests in the dispatch prefilter.

**No stored row changes.** The kind is read from the existing text at every match. So:
- the 18 tasks and the workers' skills and exclusions on canonical DEV keep their text;
- they now match by kind;
- nothing shows the kind to people.

This was chosen over rewriting `needs.category`, which would have meant:
- a data migration through the need guard, a trigger function inside the certified closure source;
- a change to the AI's instructions, an Edge function that cannot be deployed byte-exactly through the connector.

Neither is needed for the owner's rule.

## Why this shape

- **No re-certification.** Function bodies and one new function. No table, column, constraint or trigger function
  changes, and none of the functions is on the certified erasure list. Each candidate asserts that the certified
  closure digest is the same before and after.
- **Pinned and exact.** As in PKG-027 to PKG-030:
  - md5 pins on every body patched;
  - anchors that must occur exactly once;
  - a post-check that each body equals `replace(old, anchor, new)`, with privileges unchanged;
  - a second application refused.

## Proof

- Workflow: `.github/workflows/pkg031-owner-rules-proof.yml`.
- Script: `supabase/proofs/pkg031/pkg031_proof.mjs`.
- Disposable database only. The chain replays source 147 and every dev_alpha row through PKG-030, from the texts
  canonical DEV recorded.

**Before**
- The requester is offered cancel after the worker said done, and the cancel succeeds.
- A worker who excluded "selidbe" is still offered "transport_selidbe".
- "Ciscenje stana" never meets "čišćenje stana".

**After**
- The requester is not offered cancel. Their cancel is refused with `AGREEMENT_WORK_REPORTED_DONE` and changes nothing.
- The worker after done, and the requester before done, still cancel.
- The exclusion holds for the same kind and only for it: "moleraj" does not keep out moving.
- The same skill in other letters matches. Another trade, "electrician", still does not.
- A control worker passes the dispatch prefilter throughout, so each observation is about skills and exclusions alone.
