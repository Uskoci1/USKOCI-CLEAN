# PKG-011 — Slice 4: own Task detail, New Task entry, location flow, manual entry

Date: 2026-09-16. Base `4c4ccdf` (slice 3). Presentation and navigation only; RU4 remaining-search close, edit-conversation opening, the location client/resolver, the manual per-fact writer and every pinned route string are unchanged. One agent, no subagents.

## What the user gets

- **Own Task detail** (`NeedPresentation`, `/potrebe/[id]/pregled`): eyebrow = Task state with tone (muted draft/closed, green otherwise), hero card (HITNO, category, title, where/when, price in money green, people pill, "N osobe potrebno"), *Šta treba uraditi*, photos; a draft gets a warm *Spremi zadatak za objavu* card; a published Task gets the **Prijave za ovaj zadatak** row with an orange count badge and *Izmeni Zadatak* under it while no one is engaged; *Mesto izvršenja* / *Svi uslovi* rows with progressive disclosure; the remaining-search decision explained in a card before *Ne traži više nikoga*; lifecycle actions as a card; one brand action in the footer (*Pregledaj za objavu* for a draft, *Pogledaj prijave* otherwise). Loading = skeleton with spoken status; error = card with the one orange retry.
- **Novi zadatak** chooser: back + eyebrow *Meni treba*, *Razgovorom* card marked *Preporučeno* with the AI path as the strong action (pinned `kind="primary"`), *Ručno* as a quiet action; warnings as warm notices.
- **Location flow** (`LocationControls`, `NeedLocationForm`, `LocationPointEditor`, `CountryField`): ground + white cards, labels above inputs in quiet type, choice sheet with handle and green selected row, confirmation checkbox in green, private note with lock; each place block is a card; the pin editor keeps its exact behaviour. The AI/manual review screen (`/pregled-zadatka`) and the V5 conversation (`/nova`) are untouched: they are the owner-approved V5 experience.
- **Ručni unos** (`/rucni-zadatak`): the fifteen per-fact fields are grouped into four cards — *Šta treba uraditi*, *Ljudi i cena*, *Termin*, *Uslovi* — each field with a *Sačuvano* / *Nedostaje* chip, error state on the input, and its own save (quiet once saved); location and photos as cards; a progress line ("Sačuvano N od 15 podataka") and *Pregledaj zadatak* as the brand action once the server marks the draft complete. The screen still depends on PKG-014 for the live RPC; nothing here claims it works on DEV.
- `NeedLifecycleActions` panel as a card on the shared system.

## Mobile behaviours decided here

| Area | Decision |
|---|---|
| Owner Task CTA | The footer action follows the state: draft → review, published → applications; edit and close-search are secondary and explained where they apply. |
| Applications signal | Count badge in orange only when there is something to look at; the row copy stays truthful ("Još nema pristiglih ponuda."). |
| Forms | Labels above fields in quiet type, one card per topic, chips for saved/missing instead of shouted all-caps flags. |
| Recovery | Unconfirmed per-fact saves keep their command id and say so under the field (existing logic); error inputs get a danger border plus the message. |

## Proof

- `publication-screen`, `v5-need-lifecycle-screen`, `pkg004-lifecycle-recovery`, `w02-location-native`, `locationPointEditor`, `pkg003-location-return`, `draft-review-screen`, `v5-review-screen`, `workerAreaSearch`, `v5-task-photos-screen` green unchanged; `pkg003-manual-entry-source` route/string pins green (its SQL text case fails only on the CRLF working copy).
- New `pkg011-slice4-presentation`: published Task hierarchy, applications row with count, single brand action per state, draft card, remaining-search states, loading/error.
- `tsc` clean; full Jest recorded in the receipt.

## Next

Worker profile suite (`/profil/radnik`, `/profil/razgovor`, `/profil/lokacija`, `/profil/dostupnost`, `/raspored`), then the shared settings system (`SettingsPresentation`) which also carries photos, Q&A, support, safety, export, privacy, legal.
