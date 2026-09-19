# GAP-0042 — synthetic acceptance data is not isolated from real users

Recorded 2026-09-17 by owner instruction, after PKG-015's census proved it. Read-only: nothing in
this document changed the engine or any data.

**Number assigned locally**, because GAP-0041 is the highest currently referenced in this repository.
The owner should renumber it against V19 if V19 already uses 0042.

## The finding in one sentence

Nothing in the engine distinguishes a synthetic acceptance account from a real one, so every isolation
that holds today holds only because canonical DEV happens to contain no real users.

## 1. Which tables and read models this affects

The exposure is not spread evenly. It concentrates in one policy.

| Surface | Mechanism | Exposed to |
| --- | --- | --- |
| `public.needs` | RLS policy `needs_public_discovery`, `SELECT` for `authenticated` `USING (status IN ('PUBLISHED','SELECTION'))` | **every authenticated account**, with no owner, lineage or origin condition |
| `public.rpc_get_public_profile(uuid)` | `EXECUTE` granted to `authenticated` | every authenticated account, for any profile id it can reach |
| `public.opportunity_deliveries` | dispatch writes a delivery row per matched worker | the matched worker |
| `private.agreement_reviews` and `app_profiles.rating_requester` / `rating_worker` | written when an agreement completes | both parties, and anyone who reads the public profile |
| `public.notification_push_devices` and the push transport | a delivery or agreement event notifies the account | the device owner |

Surfaces that are **not** affected, checked rather than assumed:

- `public.app_profiles` direct reads are own-account only, through `app_profiles_select_own`.
- `public.agreements` reads are limited to the two parties.
- `public.marketplace_responses` reads are limited to the worker who wrote them and the requester who owns the need.

So the leak is a discovery leak first. Everything else follows from it.

## 2. What a real user could see today

Live reading on 2026-09-17, and the number is the whole point:

| Measure | Value |
| --- | --- |
| needs visible to any authenticated account | 4 |
| of those, owned by the synthetic fixture pair | 4 |

**Every single task discoverable on canonical DEV is synthetic.** A real person creating an account
on this project right now would open the app and see a marketplace composed entirely of
`adversarial_a`'s test tasks, would be able to read that fixture's public profile card, and would
have no way to tell any of it was fake.

## 3. What can leak into discovery, reputation and notifications

The three named subsystems are not independent. They are one chain, and discovery is the door.

1. **Discovery.** A fixture's `PUBLISHED` need is readable by a real account. This is live today.
2. **Application and selection.** That real user applies. `marketplace_responses` accepts the response
   because nothing tests the need owner's lineage.
3. **Agreement.** The fixture selects them. A real agreement now exists between a real person and a
   synthetic account.
4. **Reputation.** On completion, `agreement_reviews` and the profile rating columns record a rating
   for the real user, earned from a counterparty that does not exist. `agreement_reviews` is empty
   today, so this is reachable rather than realised.
5. **Notifications.** Delivery and agreement events notify the real user's device through the push
   transport. `notification_push_attempts` is 0 today and the one registered device is inactive, so
   again reachable rather than realised.

The dispatcher itself was checked directly: `private.marketplace_tick` neither inserts
`opportunity_deliveries` nor touches notifications, and, more importantly, **filters on no lineage or
test marker at all**. There is nothing for it to filter on.

Reputation and notifications are therefore **reachable but not yet realised**. Discovery is realised
now.

## 4. Minimal future isolation design

The smallest design that closes this without redesigning the marketplace. It is deliberately not
implemented here.

1. **One predicate, already built.** PKG-015 delivers `private.account_is_non_production(uuid)`,
   which is fail-closed: an unclassified account reads as real. Isolation consumes that predicate and
   adds nothing new.
2. **One boundary rule.** A non-production account and a real account may not discover, match, apply
   to, contract with, review or notify each other. Same-class interaction stays fully open, so
   acceptance runs keep working exactly as they do now.
3. **One policy change, not many.** Extend `needs_public_discovery` so that a viewer sees a need only
   when the requester's class and the viewer's class are on the same side of that boundary. Because
   discovery is the door, closing it removes steps 2 through 5 of the chain above without touching
   agreements, reviews, dispatch or the push transport.
4. **Two narrower follow-ups.** Apply the same predicate in `rpc_get_public_profile` and in whatever
   writes `opportunity_deliveries`, so a direct profile read or a dispatch cannot route around
   discovery.
5. **Fail closed, and prove it.** With no classification present, every account reads as real, so the
   rule degrades into today's behaviour rather than into a silent exemption. The proof must include a
   real account that cannot see a fixture need, a fixture that cannot see a real need, and two
   fixtures that still see each other.

What this design explicitly does **not** do: delete or hide existing data, change any writer, or
touch reputation and notification code. It is one predicate applied at the boundary.

## 5. Which package this belongs to

Not PKG-015. That package is a registry and states so in its own header; folding enforcement into it
would change the verified engine inside a batch approved as minimal.

This is enforcement, it changes RLS on a live discovery path, and it needs its own disposable proof
of the fail-closed behaviour. It therefore belongs in its own package, and it has a hard prerequisite:
**PKG-015 must be promoted and every account actually classified first**, because an enforcement rule
built on an empty registry would either block everything or exempt everything.

The owner's constraint is recorded as the package's acceptance bar: before any public or production
use, it must be impossible for synthetic acceptance data to affect real users. Note that AF-D26 keeps
production a separate project behind a separate gate, so the immediate risk on DEV is low. The risk
becomes real the moment any project with real users shares this engine.
