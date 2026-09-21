# PKG-028: the Edge workers run, and tasks whose time is over close

**Owner decision, 2026-09-21.** The owner asked whether anything was left unsolved. They were told what the deep
read still holds and which three items should come next. The answer was "kreni". That covers:
- fixing 8.10 in the client;
- preparing and proving 4.2/6.1 and 5.1 on a disposable database.

Applying them to canonical DEV was approved separately. The owner answered "kreni" to the written plan whose step 2 is
"primenim pkg028a i pkg028b na DEV", after being told that three of their own tasks would close.

## What each candidate fixes

| candidate | ledger | what happens today | after |
| --- | --- | --- | --- |
| `pkg028a_edge_workers_scheduled` | 4.2, 6.1 | Three deployed Edge workers drain queues that nothing ever drains. A confirmed account deletion locks the account and never erases it. A data export has sat in REQUESTED since 2026-09-13. Push has never run. | Once a minute the tick calls each worker that has work, with the service key. A confirmed deletion runs to CLOSED on its own. |
| `pkg028b_past_tasks_close` | 5.1 | A fixed-time task published without a response deadline is never refused and never expired. Three such tasks still take applications. Since PKG-027a they are also offered to workers again. | The minute tick expires a fixed-time task once its end has passed and nobody is selected. Publishing one whose start has passed is refused. |

In the client, the refusal has its words in both copy tables. `acceptAndPublish` says it before the paid publication
check, so nobody pays for an evaluation that can only end in that refusal.

## What the owner has to do, and why it cannot be done for them

The workers accept a call only with the project's service key: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`,
the value the Edge functions receive. That key is a secret. It is never put in a file, a migration or a log. So:

1. **Store the key in Vault**, once, in the Supabase SQL editor. Paste the key yourself; nobody else sees it:
   `select vault.create_secret('<service_role key>', 'uskoci_edge_worker_key', 'USKOČI Edge workers');`
   The key is under Project Settings → API Keys → the legacy `service_role` key, the value the Edge functions
   receive as `SUPABASE_SERVICE_ROLE_KEY`. Until it is stored, the tick sends nothing and answers
   `NOT_CONFIGURED`.
2. **Switch on the closure worker.** Set the Edge secret `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED=true`. Without it the
   worker answers `DISABLED`, and a confirmed deletion still waits.
3. **Push is your separate choice.** `EXPO_PUSH_TRANSPORT_ENABLED=true` turns real pushes on. Leave it off and the
   push worker answers `DISABLED` without touching the queue.

After step 1, the first ticks show on canonical DEV exactly what each worker answered, in `net._http_response`. A
403 or 401 means the key is not the one the Edge functions have.

## Why this shape

- **Nothing moves the certified closure source.**
  - pg_net lives in schema `net`, the key and the address in Vault, and the schedule in `cron.job`.
  - The tick is a new private function; the two patched functions are not on the certified list and are not
    trigger functions of a redaction relation.
  - Each candidate asserts that the digest is the same before and after.
- **pg_net stays as the platform installs it, and clients cannot reach it.**
  - The platform's event trigger grants `USAGE` on schema `net` to anon and authenticated so that database
    webhooks can run as any role. The grant is made by `supabase_admin`.
  - The first proof run showed that the database owner cannot take it back ("no privileges could be revoked").
    Every Supabase project that uses pg_net has the same grant.
  - Neither role can log in, so the API is the only way either could reach `net`. The proof asks it, as anon and as
    a signed-in person, for `net.http_post`, `net._http_response` and the tick. Every answer is 406 `PGRST106`:
    the schema is not exposed.
  - The tick itself is executable by nobody but the database owner.
- **Only when there is work, and never overlapping.**
  - Each worker gets at most one call a minute, and only when its queue has something.
  - "Has work" may be wider than what the worker would take, never narrower.
  - Every worker finishes or gives up inside 55 seconds, so two calls to the same worker never overlap.
  - A request that no delivery policy covers is not work for the export worker, exactly as its own claim sees it.
- **A closure advances one step a call.** The closure worker's maintenance takes one step per account per call. An
  account has one step per redaction relation, plus its storage deletions and the auth erasure. In the proof a fresh
  account needed 75 calls (one fired by cron, 74 by the tick), so at one call a minute a deletion takes about an hour
  and a quarter. The account is locked the whole time, as it already is from the moment of confirmation.
- **Refusing publication is checked early and privately.**
  - The check runs before the publication context, so a past start is refused before anything else is weighed.
  - It runs only on the caller's own task, so nobody learns another person's schedule from the error.
  - Expiry waits for the end of the window, not its start. A task that has begun may still take someone for its
    remainder.

## Proof

- Workflow: `.github/workflows/pkg028-workers-and-past-tasks-proof.yml`.
- Script: `supabase/proofs/pkg028/pkg028_proof.mjs`.
- Disposable local stack only.

Passing run: https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35602743935 on `04841d27`, 25 of 25 checks.

**Replay.** Source 147 was replayed, then every dev_alpha row, including the five PKG-027 rows, from the exact text
canonical DEV recorded. Every function PKG-028 patches or depends on then has its canonical DEV body, and the closure
source is certified and ready.

**Before.**
- pg_net is absent, and the only job stays inside the database.
- A fixed-time task whose time is over stays PUBLISHED and queued.
- Publishing one whose start has passed is treated exactly like one in the future: both are refused with
  `PUBLICATION_CONTEXT_NOT_READY`.

**Apply.**
- A tampered pin is refused and leaves nothing behind.
- Both candidates apply, and a second application of each is refused.
- The surface changes by exactly one new function (`edge_worker_tick_v5`) and two patched ones.
- The closure digest is unchanged and ready.
- pg_net 0.20.4 is installed, the version canonical DEV offers.

**After.**
- Only the task whose time is over expires, and it leaves the dispatch queue.
- A task tomorrow and a flexible task stay published.
- Publishing a past start is refused with `FIXED_WINDOW_START_PASSED`. A future start meets exactly the refusal it met
  before. Another person's past-start draft still answers `NEED_NOT_OWNED`, so nothing about it leaks.
- The tick sends nothing in any of these cases:
  - without a key;
  - to an address that is neither a Supabase project nor the stack's gateway;
  - with a key that is too short, contains a space, or is longer than 4096 characters.
- anon and authenticated cannot run the tick (42501).

**End to end, with the three real workers served on the local stack.**
- With no work, nothing is sent.
- A person confirms the deletion of their account through the real Auth and RPCs. A wrong key is then refused by the
  gateway (401) and nothing moves.
- With the right key, the cron job fires the tick by itself. The closure worker accepts the call and takes a step.
- The tick alone carries the deletion to CLOSED in 74 more calls, with 0 blocked. The auth identity is erased, the
  account's email is emptied, and the tick then stops calling.
- The push worker accepts the tick's call and answers `DISABLED`, because its own switch is off.
- The export worker accepts the tick's exact request (`TICK_COMPLETED`). A request with no delivery policy is not work.

The e2e step also caught a real defect in the first version of the candidate. The key check
`{16,4096}` is not a valid PostgreSQL regular expression, because a repetition count cannot exceed 255. The tick
would have failed the moment the owner stored a key. The length is now checked apart.

## Applied to canonical DEV (2026-09-21)

Receipt: `supabase/operations/dev-alpha/ledger/20260921_pkg028_application.receipt.json`.

- Ledger **178 = 147 + 31 dev_alpha**. Both recorded texts are the files without their final newline:
  - 028a: `385dbd8e…`;
  - 028b: `e695991b…`.
- The three bodies equal the proof surface. The digest is unchanged, and the source is ready.
- 028a: pg_net 0.20.4 is installed and the job `uskoci_edge_workers` is active. The tick answers
  `NOT_CONFIGURED` / `WORKER_KEY` until the owner stores the key.
- The API check for `net` was not repeated on DEV, because the agent environment's guard refused the outbound
  request. The disposable proof shows PGRST106.
- 028b: the 14:49 UTC tick expired the three tasks below and sent no notification. The dispatch queue went from 12
  to 9.

## What canonical DEV sees

- 028a: the tick answers `NOT_CONFIGURED` until the owner stores the key. Today no deletion is running and no push is
  waiting. The export request of 2026-09-13 is not work while no delivery policy exists (6.2).
- 028b: on the first tick three published tasks expire, all the owner's own and none with an application:
  - "Prevoz i prenos stvari: 4 kutije i 2 ormara", 18.09. 10:00–13:00;
  - "Prevoz i nošenje dva velika ormara", 20.09. 06:38–09:38;
  - "Prevoz ormara sa Petrovaradina", 20.09. 13:06–15:06.

  The fourth fixed-time task (today 16:00–20:00) follows after 20:00.

## Still open

- **"danas" / "sutra" / "ove nedelje" tasks never expire either.** `TODAY_FLEXIBLE`, `TOMORROW_FLEXIBLE` and
  `WEEK_FLEXIBLE` carry no date at all. A "danas" task published at 03:52 on 2026-09-20 (Belgrade) was still open the
  next day. What "today" is measured from is a product decision, so it is not guessed here.
- 6.2: a data export is still accepted when no delivery policy exists. With the tick it is not worked on either; the
  honest refusal at request time is its own change.
- 4.1: push is off by default per role, even once the transport runs.
- The push worker sends one push per tick, so at most one a minute.
- No device check.
