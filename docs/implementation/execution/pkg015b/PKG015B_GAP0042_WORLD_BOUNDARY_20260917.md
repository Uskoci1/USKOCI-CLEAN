# PKG-015B — GAP-0042 closed: synthetic data can no longer reach a real user

Applied to canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth` on 2026-09-17 as
`dev_alpha_pkg015b_gap0042_world_boundary`.

## The owner's decision, and why it mattered

Checking the live predicate before writing showed that `private.account_is_non_production` counts
`OWNER_PERSONAL` and `OWNER_BUSINESS` as non-production. Built on that, the boundary would have
protected strangers perfectly and changed nothing on the owner's own phone, because the owner would
have stayed on the same side as the test data.

The owner chose **variant B**: the owner's accounts sit on the REAL side and see the app exactly as a
stranger would. `account_is_non_production` was deliberately **not** edited — it answers a factual
question, "is this a customer", and the owner is not one. Visibility uses a separate rule.

| world | classes |
| --- | --- |
| TEST | `DEV_ACCEPTANCE_QA`, `SYNTHETIC_ACCEPTANCE_FIXTURE`, `OPERATOR` |
| REAL | `OWNER_PERSONAL`, `OWNER_BUSINESS`, `REAL_USER`, and anything unclassified |

Unclassified reads as REAL, so a missing classification degrades to today's behaviour instead of
silently exempting an account.

## Preflight

- Accounts: QA and both fixtures TEST; both owner accounts REAL.
- **Zero** cross-world agreements, responses and opportunity deliveries — so the boundary breaks no
  existing relationship.
- The discovery policy text and both public RPCs pinned by exact text and md5.

## The change — one rule, four places

1. **Discovery** — `needs_public_discovery` now also requires the requester and the viewer to be in the
   same world. This is the door; reputation, agreements, reviews and push all sit behind it.
2. **Dispatch admission** — `private.dispatch_cheap_candidate_admitted` gains one line, so nobody is
   offered work from the other world.
3. **Public profile** — `rpc_get_public_profile` returns nothing across the boundary.
4. **Response submission** — `rpc_submit_response` reports a need in the other world as
   `NEED_NOT_FOUND`, so its existence is not disclosed to someone holding its id.

Each function change is exactly one inserted guard at an anchor asserted unique; `SECURITY DEFINER`
is asserted intact on all three. Nothing is deleted and no row is written.

**Privilege shape.** The two-account comparison is not granted to `authenticated`, so a user cannot
probe which world an arbitrary account belongs to. Row security uses a viewer-only form that compares
against the caller and nothing else.

## Proof before writing

Rolled-back transaction under the `authenticated` role, change applied inside it:

| viewer | synthetic needs before | after |
| --- | --- | --- |
| owner (personal) | 4 | **0** |
| owner (business) | 4 | **0** |
| unclassified stranger | — | **0** |
| QA | 4 | 4 |
| fixture | 4 | 4 |

## Proof after writing, on the live state, both directions

Rolled back; a REAL published need was created inside the transaction to test the reverse direction.

| check | result |
| --- | --- |
| synthetic needs visible to owner / stranger | **0 / 0** |
| synthetic needs visible to QA / fixture | 4 / 4 |
| a REAL need visible to owner / stranger / **fixture** | 1 / 1 / **0** |
| profile owner → fixture | **null** |
| profile fixture → fixture | visible |
| profile fixture → owner | **null** |
| owner submits a response to a fixture need | **`NEED_NOT_FOUND`** |

Dispatch admission is proven by the guard's presence rather than by behaviour: the predicate also
filters on skills, licences, fees and more, so a single cross-world call returning false would not by
itself isolate the new line.

## What the owner will see

On the next open, the map and "Otvoreni zadaci" show **no tasks** for the owner — the six synthetic
ones are no longer visible, and there are no real published tasks yet. That empty screen is the
correct result: it is what a stranger sees today.

The QA account and the fixtures keep working exactly as before, so acceptance runs are unaffected.

## GAP-0042

Closed on canonical DEV. The owner's bar — before any public or production use it must be impossible
for synthetic acceptance data to affect real users — holds at discovery, dispatch, submission and
profile. It remains a gate for production: a future production project must carry the same rule.
