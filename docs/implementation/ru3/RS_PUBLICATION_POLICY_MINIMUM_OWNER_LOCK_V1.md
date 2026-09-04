# USKOČI — RS PUBLICATION POLICY MINIMUM OWNER LOCK V1

Status: `OWNER_LOCKED_MINIMUM / NOT_PRODUCTION_ACTIVATED`
Jurisdiction: `RS`
Scope: minimum platform/publication rules for whether a user-created **Zadatak** may become public inventory on USKOČI.

This is intentionally a small baseline. It does not attempt to solve every regulated/legal category now. Broader legal/research rules remain deferred and fail-closed until reviewed.

## Product boundary

USKOČI public inventory contains only **Zadaci that a person wants someone else to do**.

There is no public "I offer services" listing type. Skills, tools, vehicles, experience, availability and descriptive capability text belong to the **Radni profil**, not to Marketplace cards or map pins.

## Minimum outcomes

- `ALLOW` — clear concrete requested Zadatak with no basic prohibited signal.
- `CLARIFY` — potentially acceptable, but public text/facts must first be corrected or clarified.
- `BLOCK` — not publishable on USKOČI.
- `REVIEW` — unresolved/high-risk/regulatory case; not public until a later reviewed rule exists.

Only `ALLOW` is publishable.

## Minimum owner-locked rules

| Rule ID | Rule | Outcome |
|---|---|---|
| `RS-MIN-001` | Clear, concrete request for another person to perform a task/service, with no prohibited or unresolved high-risk signal | `ALLOW` |
| `RS-MIN-002` | Text is actually a service offer/self-advertisement (e.g. "Nudim krečenje", "Radim selidbe") rather than a requested Zadatak | `BLOCK` |
| `RS-MIN-003` | Sale/rental/classified listing rather than a requested service task | `BLOCK` |
| `RS-MIN-004` | Spam, promotion, referral, affiliate or unrelated advertising | `BLOCK` |
| `RS-MIN-005` | Profanity/vulgar wording in an otherwise acceptable Zadatak, without targeted abuse | `CLARIFY` — clean the public wording |
| `RS-MIN-006` | Targeted insult, harassment, humiliation, hateful abuse or discriminatory abuse toward another person/group | `BLOCK` |
| `RS-MIN-007` | Threat, intimidation, violence, request to harm or frighten someone | `BLOCK` |
| `RS-MIN-008` | Theft, fraud, forgery, deceptive impersonation, tax/evasion or other explicit request to bypass the law | `BLOCK` |
| `RS-MIN-009` | Stalking, covert surveillance abuse, doxxing or obtaining/exposing another person's private data without lawful authority | `BLOCK` |
| `RS-MIN-010` | Sexual exploitation, trafficking, paid sexual-service objective, or sexual content involving minors | `BLOCK` |
| `RS-MIN-011` | Illegal drugs / controlled-substance bypass, weapons/ammunition harmful procurement/transfer, or pyrotechnics as ordinary marketplace task | `BLOCK` |
| `RS-MIN-012` | Public phone/email, exact home address, QR, identity document or other private data that should not be public | `CLARIFY` — remove it from the public revision |
| `RS-MIN-013` | Materially unclear task: we do not understand what is actually requested or an essential fact is missing | `CLARIFY` |
| `RS-MIN-014` | Clearly high-risk or regulated category for which this minimum policy does not contain a reviewed specific rule | `REVIEW` — no publication for now |
| `RS-MIN-015` | `HITNO` is present | `NO_OVERRIDE` — urgency never bypasses policy |
| `RS-MIN-016` | Policy state/evaluator/current rule is missing, stale, conflicting or not applicable | `REVIEW` — fail closed |

## Plain-language examples

- "Treba mi neko sutra da prenese ormar iz sobe u kombi." → `ALLOW`
- "Potrebno 6 ljudi sutra da istovare 300 blokova i prenesu ih 20 m." → `ALLOW` if the task is otherwise clear/safe.
- "Potrebno 6 ljudi za rad na gradilištu." → `CLARIFY` — ask what exactly they will do.
- "Nudim keramičarske usluge, povoljno." → `BLOCK` — this is not a Zadatak.
- "Prodajem telefon." → `BLOCK` — classified sale, not a Zadatak.
- "Treba mi neko da prenese ovaj jebeno težak ormar." → `CLARIFY` — clean wording, task itself may remain valid.
- "Treba mi neko da ode kod njega i zaplaši ga." → `BLOCK`.
- "Treba mi 6 neprijavljenih radnika, na crno." → `BLOCK` because the Zadatak itself explicitly requests unlawful circumvention.

## What this minimum policy intentionally does not decide yet

It does not decide every detailed rule for alcohol, medicines, waste, passenger transport, postal/courier patterns, childcare, private security, professional licences, construction subcategories, money handling, or other regulated/high-risk domains. Those remain deferred to reviewed policy content.

It also does not certify whether the person who later applies for a Zadatak has every licence, tax status, registration, insurance, permit or right-to-work condition. Publication admission and performer compliance are separate concerns unless USKOČI explicitly verifies a specific fact in a future feature.

## Activation note

This is an owner-locked minimum **product policy baseline**, not a claim that every listed item is a complete statement of Serbian law. Production activation still requires the D-0140 reviewed/current server-owned policy-bundle gate and proof required by the master implementation plan.
