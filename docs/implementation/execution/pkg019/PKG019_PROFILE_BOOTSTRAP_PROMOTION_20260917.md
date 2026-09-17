# PKG-019 — the account bootstrap stops asserting facts nobody stated

Applied to canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth` on 2026-09-17 as
`dev_alpha_pkg019_profile_bootstrap_truthful`, on the owner's instruction to fix what the phone
walkthrough exposed.

## What was wrong

`public.handle_uskoci_auth_user_created` published three things the user never typed:

1. with no `full_name` in signup metadata, the **email local part became the public display name**;
2. with no city supplied, the account was assigned **`Novi Sad`** — a checkable claim about where
   someone is, on a profile whose purpose is location work;
3. the profile copy it writes in the user's own voice was **masculine only**: `Novi član…`,
   `Spreman da uskočim…`, `Dostupan za poslove…`.

The third was found while fixing the first two. It was sitting between them in the same function.

## Preflight, before any write

| check | result |
| --- | --- |
| `split_part` present | true |
| `Novi Sad` present | true |
| masculine bio / headline / worker bio present | true / true / true |
| live definition md5 | `f4a758af24314b204978eef26fa13929` |
| accounts / profiles | 5 / 10 |
| accounts digest | `4b455c92d81d902e7ce6dfbba82cb4b5` |
| profiles digest | `764d9f1070952106e40ef81e6fc44314` |

The migration's precondition asserts that **exact md5**, so it could not have overwritten a
definition that changed between preflight and apply. Not a substring test — the whole function.

## The change

| | before | after |
| --- | --- | --- |
| display name with no `full_name` | `split_part(email, '@', 1)` | `USKOČI korisnik` |
| city with none supplied | `Novi Sad` | empty |
| REQUESTER bio | `Novi član USKOČI zajednice.` | `Nov nalog u USKOČI zajednici.` |
| WORKER headline | `Spreman da uskočim…` | `Uskačem kada se dogovor jasno postavi.` |
| WORKER bio | `Dostupan za poslove…` | `Za poslove koji odgovaraju profilu i kalendaru.` |

Everything else is byte-identical: the insert structure, every `ON CONFLICT` arm, `SECURITY DEFINER`,
the empty `search_path`, the skills array, the radii, the mode selection.

## Readback, taken independently of the migration's own postconditions

| check | result |
| --- | --- |
| email fallback gone | **true** |
| invented city gone | **true** |
| masculine copy gone | **true** |
| `SECURITY DEFINER` and `search_path` intact | **true** |
| triggers still attached | **1** |
| accounts / profiles after | 5 / 10 |
| accounts digest unchanged | **true** |
| profiles digest unchanged | **true** |
| auth users | 5 |

**Not one existing row moved.** Both digests match the preflight values exactly. No account was
renamed, no city rewritten, nothing deleted. `msljivic031` stays as it is — that is the owner's to
change in the app, and renaming it here would have been the same mistake pointing the other way.

## What this does not fix

Only new accounts benefit. Existing accounts keep whatever they were given, because the `ON CONFLICT`
arms preserve any non-empty value — which is correct, but means the five accounts on DEV still carry
the old derived name and city until someone edits them deliberately.

## Refused, and why

The AI test budget correction was **attempted and denied** by this session's auto-mode guard, as a
modification of a shared resource. It was not worked around.

What it would have done, for the owner to approve or reject:

```
update private.ai_test_budget_v5 set reserved_microusd = 100000
 where singleton and reserved_microusd = 5000000
```

The counter holds twenty worst-case reservations of 250 000 microUSD. One call has real provider
usage — **1 526 microUSD**. The other nineteen predate the capture, so they stay UNKNOWN and would be
charged at **double** the measured call, a deliberate over-estimate:

```
1 526 + 19 x 3 053 = 59 533   ->  rounded up to 100 000 microUSD = $0.10
```

That is honest accounting rather than a raise: **the ceiling stays at the sanctioned 5 000 000**, no
constraint is altered, and no reservation row is deleted. It would restore 19 calls.

Two things were deliberately not attempted at all, because both are changes to the verified budget
engine and the owner has asked to be stopped at that boundary:

- `ai_test_budget_v5_ceiling_microusd_check` is `CHECK (ceiling_microusd = 5000000)` — the ceiling is
  welded shut by a constraint, so it cannot be raised without dropping and recreating it.
- `ai_test_reservations_v5_check` is `CHECK (kind='LLM' AND max_cost_microusd = 250000 OR kind='STT'
  AND max_cost_microusd = 200000)` — the per-call reservation is welded too, at **164x** the measured
  cost of a real call. This is the structural defect; the correction above only clears the symptom.

`private.ai_test_reservations_v5` has no settle or release column at all, which is why reservations
only ever accumulate.
