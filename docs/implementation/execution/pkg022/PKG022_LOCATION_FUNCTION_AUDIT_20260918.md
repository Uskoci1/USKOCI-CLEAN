# The location path, audited as functions

Written 2026-09-18 after the owner used the voice path successfully on his own phone and asked
for a complete analysis of how these functions behave as functions, and what is wrong with them.
His words for the symptom: the AI does not register or ask whether the address or the route can
be adjusted, it only writes text; so he has to add it by hand and chase around the map; and the
interface for it looks thirty years old.

Everything below is read from source and from live state. Nothing is inferred from memory.

## The one structural fault

`src/contracts/needFactsV2.ts:39`:

```ts
'need.resolved_location': { valueType: 'OBJECT', privacyClass: 'PRIVATE',
                            requiredForDraft: false, manualOnly: true, label: 'Potvrđene tačke' },
```

Two flags decide the whole story.

- `requiredForDraft: false` — the AI has **no obligation** to obtain it, so a conversation that
  never mentions a map point is a complete conversation. `missingRequired` comes back `[]`.
- `manualOnly: true` — and `AI_PROPOSABLE_NEED_FACT_V2_KEYS` at line 51 filters every
  `manualOnly` key out, so the AI is **structurally forbidden** from proposing it. It could not
  offer the pin even if it wanted to.

Meanwhile `private.need_publication_context` refuses to publish without confirmed points. Live,
for all three of the owner's drafts:

```
NOT_READY / LOCATION_INCOMPLETE / missingSlots: ["start","end"]
```

So the single fact that publishing cannot do without is the one fact the AI is neither required
nor permitted to produce. Every conversation therefore ends in a draft that looks finished and
cannot be published, and the only way across the gap is a manual form. This is not a bug inside
a function. It is two contracts disagreeing, and the user standing in the gap.

## What each function actually does

| step | function | what it writes | does it touch the point? |
| --- | --- | --- | --- |
| conversation | `uskoci-ai-interview` → `rpc_ai_apply_interview_turn_v2_service` | `need.task_geography` as `{mode, start{city,area,label}, end{…}, waypoints[]}`, plus `need.exact_address` | no, and cannot |
| save draft | `rpc_save_need_draft_from_review` | `public.needs`, `public.need_geography`, `public.need_sensitive` | no |
| open a saved draft | `rpc_ai_open_need_edit_conversation_v2` | reseeds facts as `SYSTEM_DERIVED`; **clones** `resolved_location` if one already exists | only copies, never creates |
| review | `rpc_prepare_ai_task_review` | the envelope; `location.resolvedLocation` is `null` when no point exists | no |
| publish gate | `private.need_publication_context` | nothing; it reports | **requires** it |
| the only writer | `rpc_save_need_location_review`, reached from `NeedLocationForm` | `need_sensitive.resolved_location` | yes, and nothing else does |

`src/data/locationClientService.ts` is the only client that calls the two location-review RPCs,
and `mesto-zadatka.tsx` plus `pregled-zadatka.tsx` are the only screens that import it.

## What is wrong, item by item

### 1. The conversation never asks

Proven above. The AI collects place names because `task_geography` is `requiredForDraft: true`,
and stops there. It has no prompt to say *is this the right spot on the map?* because it has no
fact to write the answer into.

### 2. The form asks again, in fields, for what was already said out loud

`src/ui/location/NeedLocationForm.tsx`. For a plain two-point route the user meets, in order:

- `Država Zadatka` — a country select
- `Način rada` — five options: `Na jednoj lokaciji`, `Od mesta do mesta`, `Više stanica`,
  `Na području`, `Na daljinu`
- `Polazište` — three text fields: *grad ili mesto*, *deo grada (opciono)*, *javni opis (opciono)*
- `Odredište` — the same three again
- `Privatni detalji` — *Tačna adresa*, *Napomene za pristup*
- `Potvrdite tačke na mapi` — and only here does a map appear

That is two selects and eight text fields before the map, to express "from Lenke Dunđerski 11 to
the Petrovaradin fortress" — a sentence he had already spoken and the AI had already parsed
correctly into exactly those two places.

### 3. The map is entered one point at a time, through a picker

`Tačka koju uređujete` is a `LocationChoice`, and `LocationPointEditor` is mounted for the
selected slot only, keyed `${pinEpoch}:${selectedSlot}`. The counter reads
`Potvrđeno tačaka: 0 od 2`.

So confirming a route is: pick slot, type a query, press `Pronađi na mapi`, choose a proposal,
confirm, switch slot, repeat. Never one map with two pins you can see together and drag. For a
route, the relationship between the two ends is the whole point, and the UI never shows it.

### 4. Correcting a typo destroys the confirmed points

The form's own words: *Promena države, javnog mesta, redosleda stanica ili tačne adrese traži
novu potvrdu tačaka.* So after confirming both ends, fixing one letter in the address discards
both. The invalidation is deliberate — a point must stay bound to the text it was resolved from —
but the user is given no way to keep a point that is still correct, and no warning before the
edit rather than after.

### 5. Reordering stops is a button per stop

`Pomeri stanicu ${index + 1} ranije` and `Ukloni stanicu ${index + 1}`, up to 20 stops. With
three text fields per stop that is up to 60 fields plus 22 point confirmations, driven by
"move this one earlier" buttons. This is the specific thing that reads as thirty years old: it is
a form-and-buttons list where a drag would do.

### 6. The way in is hidden

On the draft screen the `Mesto: Lenke Dunđerski, Novi Sad` row is **not** tappable — verified on
the device. The only route to the form is `Izmeni` on the `Tačna adresa` row inside the review
card, which is below the fold of a long review. Nothing on the draft says the task cannot be
published, or why.

### 7. It is all in the Vi form

`Unesite mesto gde je potrebna pomoć`, `Potvrdite tačke na mapi`, `Izaberite tačno mesto`,
`Pregled možete sačuvati`. The owner asked for ti across the app.

## The measurement that settles it

Place search is not the obstacle: `uskoci-location-search` is ACTIVE at version 13, and it
answered **HTTP 200** twice, once at 23:10:28Z and once at 04:35:30Z during the owner's own
attempt. The resolver is wired through the Edge function with the LocationIQ token held only
server-side, and it works.

And yet:

| | |
| --- | --- |
| drafts | 3 |
| drafts with an exact address saved | 2 |
| successful place searches | 1 |
| **confirmed points, across all three drafts** | **0** |

One search, zero confirmations. The form is reachable, the search behind it works, and still
nobody has ever finished it. That is the finding: not a broken function, an uncompletable flow.

## What would fix it

Two options. The first does not touch any contract.

**A — the conversation asks, and opens the map itself.**
Give the AI a question it is allowed to ask (*je li ovo to mesto?*) and let the answer open the
point editor as a sheet over the conversation, pre-filled with the address the AI already has,
with one pin to accept or drag. The human still confirms every point, so `manualOnly` stays
true and the audit trail keeps its human confirmation. Only the route changes: from a buried
form to one step inside the conversation that already knows the answer.

**B — let the AI propose the point, the human confirm it.**
Drop `manualOnly` from `need.resolved_location` and let the AI resolve the address it already
parsed into a candidate point, marked `AI_INFERENCE` and `NEEDS_CONFIRMATION` like every other
inferred fact, which the human then confirms or moves. Fewer steps than A, but it changes a
contract and widens what the AI may write about a private field. That needs the owner's explicit
decision, not an assumption.

Independently of A or B, four things are worth fixing because they are wrong on their own terms:

1. One map for a route, both pins visible, drag to adjust — instead of a slot picker.
2. Warn **before** an edit that will discard confirmed points, and keep the ones still valid.
3. Make the draft say it cannot be published yet, and make the `Mesto` row the way in.
4. Drag to reorder stops.

## Not started

Nothing in this document has been changed. It is an analysis, written because the owner asked
for one, and the location work has not been approved.
