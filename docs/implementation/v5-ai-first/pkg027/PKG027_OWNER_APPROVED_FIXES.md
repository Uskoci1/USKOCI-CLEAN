# PKG-027 — the fixes the owner approved on 2026-09-21

**Owner decision, 2026-09-21:** after the deep read (`DEEP_READ_LEDGER_20260921.md`, Area 12) the owner asked
whether the state was real and solvable, was told which fixes the first round would contain, and answered
"odobravam sve to" ("I approve all of that"). That approval covers the five candidates below, their proof on a
disposable database, their application to canonical DEV `leqcwgzvjsxugfgzdmth`, rewriting the notification texts
already stored, emptying the invented profile sentences already stored, and deploying the push text. It does not
cover anything else found in the read (the stale-application price door 3.1, the Q&A status set 7.47, the
phone filter 12.5, the remote/physical execution mode 12.7 …): each of those still needs its own decision.

## What each candidate fixes

| candidate | ledger | what the person sees before | after |
| --- | --- | --- | --- |
| `pkg027a_dispatch_keeps_looking` | 12.1 | A task stops being offered to workers about 20 minutes after it is published, for good: four checks that find nobody use up the four "waves", and the task leaves the queue. All 12 open DEV tasks are out of it. | A check that finds nobody does not use up a wave. An open task is re-checked at most every six hours, and at once when a worker saves availability, location or capacity or activates the profile. The 12 open tasks go back in the queue. |
| `pkg027b_ai_turn_sweep` | 8.17, 11.1, 12.3 | An AI reply that never arrives freezes the conversation and blocks account closure forever. | Ten minutes after its lease ended the turn is marked failed (Q&A: cancelled) by the one-minute tick. It is never retried; the person can write again. Leaving a worker-profile conversation also ends its open turn. |
| `pkg027c_notification_ti_copy` | 8.13 | Notifications say "Imate", "Vaša", "Naručilac", "Uskočer", "Potreba". | Every stored and every new notification addresses the person as "ti" and uses the product's words. |
| `pkg027d_profile_text_truthful` | 12.4 | Sign-up writes a headline and bio the person never wrote; other people read them on the public profile. | Sign-up leaves both empty; the seven sentences the server ever invented are emptied; anything a person wrote stays. |
| `pkg027e_price_basis_survives_edit` | 12.2 | Editing a "po osobi" task can silently drop the basis; changing only "ukupno ↔ po osobi" is refused as "nothing changed". | The edit starts with the basis the task has; the basis is part of what counts as a change. |

Plus the push transport Edge function: the only text a phone shows for any push becomes
"Imaš novo obaveštenje. Otvori aplikaciju." (the app already accepts both wordings).

## Why this shape

- **Nothing moves the certified closure source.** Every change is a function body or data. The two notification
  emitters that are trigger functions (`after_need_revision`, `pre_v3_application_event`) sit inside the certified
  closure source, so their texts are mapped in one place, `private.emit_event`, through one copy table
  (`private.notification_copy_v5`), instead of editing 17 functions. Every candidate asserts the digest is the same
  before and after.
- **Pinned and exact.** Every candidate refuses to run unless each function it reads or patches has the md5 it has
  on canonical DEV today, patches by anchors that must occur exactly once, and proves the result equals
  `replace(old body, anchor, new)` with the grants unchanged. Each refuses a second application.
- **Not in the publication fingerprint.** The price basis is added to the material snapshot, not to the publication
  fingerprint: adding it there would invalidate every recorded publication decision and every open edit.
- **What stays as it was, on purpose.** A failed turn is never retried by the server (the provider may have run);
  `rpc_fail_worker_ai_turn_service` is unchanged — the sweep owns expired turns.

## Proof

`.github/workflows/pkg027-owner-approved-fixes-proof.yml` + `supabase/proofs/pkg027/pkg027_proof.mjs`, disposable
database only: source 147, then every dev_alpha migration of canonical DEV from the exact text DEV recorded
(sha256 checked; `pkg026` added to `supabase/operations/dev-alpha/ledger/`, byte-identical to DEV), until the
fifteen functions involved have the canonical DEV bodies; committed seeds; every defect reproduced before;
tampered pins refused with nothing left behind; the five candidates applied; second application refused; the
surface changed by exactly thirteen patched and three new server-only functions; the same scenarios fixed after.

## Still open

- Device check of the notification texts, the profile screens and the edit flow.
- The owner's eight real tasks remain visible only in the REAL world (ledger 12.11); that is a decision, not a fix.
