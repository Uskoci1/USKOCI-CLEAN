# PKG-029: the rest of the server round

**Owner decision, 2026-09-21.** The owner was given a written command and answered "dozvoljavam sve". The command
covers:
- every remaining deep-read fix: each one proven on a disposable database first, then applied to canonical DEV
  without a separate question;
- the proposals stated in it:
  - "danas" ends at midnight of the publication day, "sutra" at midnight of the next day, "ove nedelje" after 7 days;
  - the owner's real tasks are seen by test workers while testing.

The command also sets the stop conditions. The work stops and asks when something deletes or changes real data beyond
what is described, or needs a secret, a legal text or the phone.

## What each candidate fixes

| candidate | ledger | today | after |
| --- | --- | --- | --- |
| `pkg029a_notifications_reach` | 4.1 | A role without its own preference row gets push off; push switched on as a worker never reached the same person as a requester. | That role takes the other role's push choice. A person who never chose stays off. |
| | 1.2 | Auto-completion after the requester's deadline tells nobody. | The worker is told, with the same event and dedupe key as a requester's confirmation. |
| | 12.9 | Closing the remaining search expires every open application silently. | Each applicant is told ("Potraga je zatvorena"), as a cancelled task already does. |
| `pkg029b_lifecycle_truth` | 1.1 | A task whose remaining search was closed can never complete. | It completes when every selected person's Agreement has; an open search still waits for every place. |
| | 7.49 | After a cancelled Agreement, "Moje prijave" shows the application chosen, needing attention, forever. | A cancelled Agreement no longer makes an application chosen. |
| | 12.7 | Remote or physical is decided from the schedule. | From the place; the schedule decides only for a task without a place mode. |
| | new, found with 5.1 | "danas" / "sutra" / "ove nedelje" tasks have no date and never expire. | They expire as the owner's rule states, in the task's own timezone. |
| `pkg029c_questions_while_recruiting` | 7.47 | Questions close while a task is still recruiting (SELECTION) and stay open when it is fully staffed (ACTIVE). | Questions follow recruiting: PUBLISHED and SELECTION. |
| | 12.5 | "12.10.2026" and "15000 - 20000" are refused as phone numbers. | A phone number must start like one (0, 00, +, 381) and hold 8 to 13 digits; a date shape is not one. |
| `pkg029d_export_honest` | 6.2 | An export is accepted although nothing can ever deliver it (no retention policy). | Refused as `DATA_EXPORT_POLICY_NOT_READY`, the way account closure already refuses. The app says why. |
| `pkg029e_owner_in_test_world` | 12.11 | The owner's accounts are REAL and every worker is a test account, so nobody can see the owner's tasks. | While testing, `OWNER_PERSONAL` and `OWNER_BUSINESS` share the TEST world. Every other lineage keeps its world. **Temporary: take it out before real users arrive.** |

## Why this shape

- **Function bodies only.**
  - None of the patched functions is on the certified closure list, and none is a trigger function.
  - Each candidate asserts that the certified digest is the same before and after.
  - The guard on `needs` (12.8) is a trigger function inside the certified source, so it is not in this round.
- **Pinned and exact.** As in PKG-027 and PKG-028:
  - md5 pins on every body read or patched;
  - anchors that must occur exactly the stated number of times;
  - a post-check that each body equals `replace(old, anchor, new)`, with grants unchanged;
  - a second application refused.

## Not in this round, and why

- **7.15** (the cancellation reason is thrown away).
  - It needs a place to keep the reason. A new column on `agreements` moves the certified closure source.
  - Showing free text to the other party needs the same contact filter as questions.
- **3.1 / 12.6** (the stale-application door skips price, world, readiness and evidence checks). This needs its own
  design against `rpc_submit_response`, not a line patch.
- **7.16** (the requester can cancel after the worker says the work is done). This is a product rule and waits for the
  owner's word.
- **8.27 / 7.8** (which timezone an agreed time is shown in). The proposal is the task's own timezone everywhere. The
  payloads do not carry it yet.
- **9.2 / 9.3** (free-text categories and exact-text matching). A closed category list is the owner's to name.
- **11.1 / 11.2** (AI time limits). These are Edge changes, with their own proof and deploy.
- **12.8** (a guard that is not null-safe). It is a trigger function inside the certified source, so fixing it needs
  re-certification.
- **12.10** (preparation and start disagree about running jobs). It is low risk, now that PKG-027b sweeps stuck turns.
- **8.2** (the legal consent is neither backed nor recorded). It waits for the owner's legal texts and operator data.

## Proof

- Workflow: `.github/workflows/pkg029-server-round-proof.yml`.
- Script: `supabase/proofs/pkg029/pkg029_proof.mjs`.
- Disposable database only.

The proof replays source 147 and every dev_alpha row up to PKG-028, from the exact texts canonical DEV recorded. Each
scenario:
1. builds synthetic rows with triggers off;
2. turns the triggers back on;
3. calls the real functions (as the person where it matters);
4. is rolled back.

Passing run: https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35619942561.

- **Before:** all ten defects reproduce on the unchanged surface.
- **Apply:**
  - A tampered pin is refused and leaves nothing behind.
  - All five candidates apply, and a second application of each is refused.
  - The surface changes by exactly fifteen patched functions and one new one.
  - The certified digest does not move.
- **After:** every scenario shows the fixed behaviour, and what must not change did not:
  - a person who never chose push keeps it off;
  - an open search still waits for every place;
  - a "danas" task published now stays open, and an "ove nedelje" task two days old stays open;
  - real phone numbers are still refused;
  - a real person who is not the owner stays out of the test world.

Two faults in the first drafts were found by the proof, not on DEV:
- a CASE inside an IF condition, which PL/pgSQL cuts at the first bare THEN;
- a refusal code that already named a client outcome, renamed `DATA_EXPORT_POLICY_NOT_READY`.

## Applied to canonical DEV (2026-09-21)

Receipt: `supabase/operations/dev-alpha/ledger/20260921_pkg029_application.receipt.json`.

- Ledger **183 = 147 + 36 dev_alpha**. The five recorded texts are the files without their final newline.
- All sixteen bodies equal the proof surface. The digest is `67730f62` live = certified, and the source is ready.
- The first tick expired the owner's "danas" task of 20.09. The "sutra" task expires at midnight, Belgrade time.
- The owner's open tasks now share the test world, so dispatch and the public list reach the test workers.
