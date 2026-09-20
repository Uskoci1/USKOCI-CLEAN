# PKG-011 — Slice 1: coherent system, Zadaci / Mapa / Prijave list, Dogovori, explicit intent transition

Date: 2026-09-16. Branch `work/pre-v3-engine-integration-20260911`, base `687b7d0` (+ owner decisions `PKG011_OWNER_DECISIONS_20260916.md`). Presentation and navigation only; no writer, RPC, Edge, Storage, lifecycle, session or idempotency change. One agent, no subagents.

## What the user gets

- **One visual system for inner screens** (`src/ui/system/tokens.ts`): white surfaces on a faint green ground, ink `#183A30`, quiet `#586B62`, USKOČI green `#176B55` for status/orientation, orange `#FF850F` as the single brand action per screen with ink text (white on orange fails AA at 2.4:1; ink on orange is 5.1:1), tabular figures for money and counts. Scale (4/8 spacing, radii, type, motion, 44pt targets) is shared with `theme/tokens`. Entry/HOME/mascot are untouched.
- **Zadaci (both intents)** — `MarketplacePresentation`: header eyebrow now names the intent (*Meni treba* / *Ja mogu*), title *Zadaci*; segmented *Moji | Istraži*; search; *Aktivni | Nacrti | Istorija | Svi* or *Lista | Mapa* as a real tab list (selected = raised white pill + heavier type, not color alone); filter and *Dodaj zadatak* as 46pt tools; loading as static skeleton cards with a spoken status (no spinner, no shimmer); empty/error states with one brand action; price-mode filter as radios in a bottom sheet with handle; map preview card as a raised sheet.
- **TaskCard**: status → title → where → when → price (tabular, money green) → people pill; owner drafts show *Privatan nacrt* and *Nastavi uređivanje*, never an application count; a Task that needs the owner's action gets an orange border and warm status; requirements as two quiet chips + `+N uslova`.
- **Dogovori** — `AgreementCollectionPresentation`: same header pattern, segmented sections, *Čeka moju potvrdu* checkbox, `AgreementCard` as a scan block (status with tone: green confirmed, warm awaiting, muted cancelled → title → place/time → agreed price + people → other party with *Ti naručuješ / Ti radiš* → open-problem chip in words). Agreement detail hero/tabs/people/sections (`AgreementPresentation`) moved to the same tokens.
- **Tab bar**: white bar, line top border, ink/muted tints, brand mark tile in the center with an orange ring when focused. Zones unchanged and equal to owner decision 1.
- **Explicit intent transition** (`src/ui/system/IntentTransition.tsx`, owner decision 2): a worker's *+* or *Moji* in Zadaci, and an inbox item of the other intent, open a sheet stating "Prelazite u MENI TREBA / JA MOGU", the plain reason, and "Sada ste u …". One confirm does the switch (`postaviUlogu`, the only writer) and the navigation, under the same ownership guard as any navigation; *Ostani u …*, scrim and hardware back leave everything as is. Items of the current intent open directly.
- Shared `V2Action` restyled in place (kinds unchanged; `quiet` is green text), `InboxBell` and `ScreenHeader`/`Segmented`/`Skeleton` primitives added.

## Decisions taken under the owner's 2026-09-16 mandate ("smisli najbolji prirodan mobile UX")

| Area | Decision | Why |
|---|---|---|
| List/Map state | One `MarketplaceView` for both modes; switching modes keeps query, filters, viewport and selection; panning never filters until *Pretraži ovu oblast*. | Existing verified state; the user never loses a search by changing view. |
| Pin → detail | Tap a pin → raised compact card + *Otvori detalj Zadatka*; cluster tap zooms to expansion; selected pin larger with orange ring. | Two-step keeps the map in view; the card is the same TaskCard, so detail feels continuous. |
| CTA hierarchy | Exactly one brand (orange) action per screen state; secondary white; quiet actions green text; destructive in words. | DESIGN.md "one dominant next action"; tests pin the single brand action in the filter sheet. |
| Recovery | Loading = skeleton with spoken status; error = concrete message + retry as the brand action; empty = one useful action. | DESIGN.md state language; no spinner-only states. |
| Transitions | Sheets slide (none under reduced motion); press feedback on press-in via `Press`; no decorative entrance motion on lists. | Frequent surfaces get no decorative motion (owner motion gate). |
| Intent visibility | Every tab surface names the intent in its eyebrow; no slogan captions. | Owner decision 2: the user must always know the context. |
| Ownership on discovery | Deferred to the detail slice: a requester who meets their own Task in *Istraži* should see *Vaš Zadatak* and open the owned detail. Needs the own public profile id on the client; if absent it is a binding gap, not a new writer. | Natural behaviour, but depends on a read the client may not have yet. |

## What did not change (state owners kept)

`useFocusedResource`, route ownership guards (`current()`, focus latch, AppState), `marketplaceView` filtering/public point rules, `DiscoveryMap` session/ownership, `useInbox`/`createInboxModel`, `povratniCilj`, `uloga` store (still the only intent writer), all copies asserted by the existing suites.

## Proof

- Before (head `687b7d0`): 5 suites / 33 tests green (`marketplace-presentation`, `agreement-collection-presentation`, `agreement-collection-screen`, `marketplace-owned-screens`, `marketplace-intent-entry`).
- After: those suites green unchanged except two harness-only lines (`marketplace-owned-screens` isolates the new sheet like it already isolates the presentation; `marketplace-intent-entry` re-pins the explicit transition instead of the silent switch), `inbox-native` extended for ask/confirm/stay/retired-ownership, new `pkg011-intent-transition`, `pkg011-discovery-intent-transition`, `pkg011-slice1-presentation` (header/tablist/skeleton/draft/radio/brand-action/agreement facts). 23 neighbouring suites importing the restyled shared modules: 22 green; `pkg003-manual-entry-source` fails on a SQL text assertion that is independent of this slice (see receipt note). `tsc` clean. Full Jest run recorded in the receipt.
- Accessibility: roles `tab`/`tablist`/`radio`/`radiogroup`/`checkbox`/`header`; skeletons hidden from assistive tech with a polite live status; reduced motion removes sheet slides; all targets ≥ 44pt; layout uses wrapping rows so 200% text stacks instead of clipping (device check remains in PKG-017/021).

## Next slices (dependency-safe order from the plan)

Dogovor workspace + chat → Moje prijave, public Task detail, application composer → own Task detail, candidates (+ comparison view, owner decision 3) → AI intake/review/location → worker profile suite → shared settings → PKG-014-dependent surfaces.
