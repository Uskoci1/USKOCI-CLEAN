# PKG-024a — the two Dogovor reads name each side's public profile

**Status: APPLIED to canonical DEV `leqcwgzvjsxugfgzdmth` on 2026-09-20.**
Candidate: `supabase/candidates/pkg024a_agreement_profile_ids.sql`
Ledger row: version `20260920102238`, name `dev_alpha_pkg024a_agreement_profile_ids`.

### Readback

| | |
| --- | --- |
| `requesterProfileId` / `workerProfileId` | exactly once in each body |
| `requesterAccountId` / `workerAccountId` | still exactly once in each body |
| envelope | `prosecdef`, `stable`, `search_path=pg_catalog` — unchanged in both |
| grants | `anon` no, `authenticated` yes — unchanged in both |
| new body md5 | `06a6485e5bf6c12b6d4c22d1668ecf76` · `c5239ccdc2ffe8f54c661fb7cbf2e335` |
| `private.retention_ai_source_ready()` | still `true` — the closure source digest was not disturbed |
| ledger | **166 = 147 frozen source + 19 dev_alpha** |

**The stored statement's sha256 is `73338bd165d62df273274311080b5c63c8547cc9a6a5fe31f672a6db17f4236c`,
identical to the candidate file's.** Byte for byte, nothing was mangled in transit — which is why the
escape sequence was taken out of the file first.

## The finding

The person you agreed to work with is the only human left in the product drawn as two letters in a
circle — in the Dogovori list and in the Dogovor itself. Everywhere else (the offer list, the offer
screen, the public Task) a face is shown.

This is not a screen problem and cannot be fixed in the client. Traced:

| | |
| --- | --- |
| `src/data/agreementClientService.ts:39-41` | `myId` / `otherId` := `requesterAccountId` / `workerAccountId` |
| `UcesnikProjekcija.id` | therefore an **account** id |
| `ProfilePhoto` | needs a **profile** id |

Asking the media service for a photograph with an account id is the wrong question. It must not be
asked at all rather than asked and allowed to fail quietly.

Both server reads already **join** `public.app_profiles` on the agreement's own
`requester_profile_id` / `worker_profile_id` to take a display name from it. The values are already
in scope. Only the two keys are missing from the returned object.

## What the candidate does

Adds exactly two keys to two function bodies, on the anchor's own line:

```
'requesterProfileId', a.requester_profile_id, 'workerProfileId', a.worker_profile_id,
```

- `public.rpc_get_agreement_workspace(uuid)`
- `public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)`

Nothing else changes: no table, policy, grant, index or trigger, no name, no contact, no
photograph, no new row. Both account ids stay exactly where they are —
`agreementClientService` decides which side is "I" by comparing `requesterAccountId` with the
session user, so losing one would be a silent identity bug.

## Why this is not new disclosure

`app_profiles.id` is already a public identifier in this product: `public.rpc_list_open_tasks_v3`
returns `requesterProfileId` for every open task to every signed-in viewer, and the public Task
detail reads that profile through the existing public-profile port.

This adds the same class of id, to the two people who are already parties to the same Dogovor, and
who already see each other's display name and — on explicit directed consent — phone number. It is
strictly less than a stranger is given about whoever published a task. The photograph itself is
still read through the existing authorised public-profile path, under that path's own rules.

## Predecessors, read from canonical DEV `leqcwgzvjsxugfgzdmth` on 2026-09-20

| function | body md5 | chars |
| --- | --- | --- |
| `rpc_get_agreement_workspace(uuid)` | `287afdd70b8c027fba4d50f9e41245cd` | 2572 |
| `rpc_list_my_agreements_page(text,integer,timestamptz,uuid)` | `f834365bd8dd43b1eac6c8213624e1dc` | 3583 |

Both: `prosecdef = true`, `provolatile = 's'`, `proconfig = {search_path=pg_catalog}`,
`EXECUTE` granted to `authenticated`, **not** granted to `anon`. The candidate pins every one of
these before and after.

## What was verified, read-only, and what was not

Verified against live DEV with `SELECT` only — nothing was executed, created or replaced:

1. Both signatures resolve, including the `timestamptz` spelling used in the candidate.
2. Both bodies match their pinned md5 exactly.
3. Neither body contains `ProfileId` yet, so the candidate is not a re-run.
4. `a.requester_profile_id`, `a.worker_profile_id`, `requesterAccountId` and `workerAccountId` each
   occur exactly once per body — which is what the anchor relies on.
5. The anchor `'workerAccountId', a.worker_account_id,` occurs exactly once in each
   `pg_get_functiondef`.
6. The resulting text was computed with the same `replace` the candidate performs and read back:
   both bodies gain the two keys in the right place, and each keeps its own indentation, which is
   six spaces in the workspace read and eight in the page read.

**Not verified here:** the executable proof — applying the candidate to a disposable CI database
with real accounts, asserting the client's decoder fails before and passes after. That is the house
harness, it needs CI, and it has not been run. Until it has, this document claims only that the
preconditions hold and the edit lands where it is meant to.

## Client work — done, once the server was sending it

`UcesnikProjekcija` carries `profilId`, and its type says in words that `id` is an ACCOUNT id that
must not be used to read a photograph. `agreementClientService` fills it from the two new keys, and a
missing or malformed one stays `null` rather than becoming a wrong read. `AgreementPeople` and the
Dogovori row draw `ProfilePhoto` where there is a profile to draw it by, and keep the initials
exactly as they were where there is not.

## What is still not proven

The executable CI proof — applying to a disposable database with real accounts and asserting the
client's decoder fails before and passes after — has **not** been run. What stands instead is the
read-only preflight below, the transaction's own fourteen assertions, and the readback at the top.
That is weaker than the house harness and this document does not pretend otherwise.

The device pass for this change is also outstanding: the photo in the Dogovor has been wired but not
yet seen on a phone.
