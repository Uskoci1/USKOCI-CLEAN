# The map layer, audited end to end

Written 2026-09-18 after the owner ran `pkg022-b9231a3` on his phone. The conversation ask
worked: his screenshot shows *Fali još mesto na mapi, da radnik zna gde da dođe. Dve tačke, dva
dodira.* with the **Pokaži na mapi** button, in the thread, exactly as intended.

The map behind it did not. His words: it is grey, it is not connected to his location, and
whenever he opens it, it shows half the world.

All three observations are correct. They have three different causes, and one of them was mine.

## How it is physically wired

| layer | what it is |
| --- | --- |
| basemap tiles | `https://tiles.openfreemap.org/styles/positron`, in `ResolvedPinMap.types.ts`. Public, no API key. Attribution `© OpenStreetMap`. |
| map component | `@maplibre/maplibre-react-native`, rendered by `ResolvedPinMap.tsx` with `androidView="texture"` |
| place search | `LocationPointEditor` → a resolver → Edge function `uskoci-location-search` (ACTIVE, v13) → LocationIQ. The provider token exists only in Edge; the client never holds it. |
| the resolver | `createProductionLocationResolver()` builds the configured one. `createConfiguredLocationResolver()` **with no argument** builds an unconfigured one. |
| the point | `ConfirmedLocationPoint` with `latitudeE6`/`longitudeE6` and a `MANUAL_PIN` or `PROVIDER_CANDIDATE` origin, written only through `rpc_save_need_location_review` with `confirmed: true` |
| device GPS | `captureCurrentLocation` in `nativeCurrentLocation.ts` |

## Cause 1 — the search never left the phone. Mine.

`ScopedPointEditor`:

```ts
const [defaultResolver] = useState(() => createConfiguredLocationResolver());
const resolver = injectedResolver ?? defaultResolver;
```

`createConfiguredLocationResolver()` with no config gives `configured(undefined) → null`, and then
every lookup short-circuits:

```ts
if (!config) return { status: 'PROVIDER_ACTIVATION_BLOCKED' };
```

No request is made at all. `mesto-zadatka.tsx` and `pregled-zadatka.tsx` have always created
`createProductionLocationResolver()` and passed it down through `NeedLocationForm`. **My
`ConversationPointAsk` did not**, so the sheet fell back to the resolver that cannot search.

Proven, not inferred. In the edge logs for 2026-09-18 the sheet's own read appears four times —
`rpc_get_need_location_review` at 05:14:39, 05:15:13, 05:16:18 and 06:12:03Z, the last matching the
08:12 clock in his screenshot — and `uskoci-location-search` appears **not once** after 04:35:30Z,
which was his older attempt on the previous build. The sheet opened, read the review, and never
asked anyone where the address is.

So `autoLocate` fired and resolved to `PROVIDER_ACTIVATION_BLOCKED`. The editor's copy for that
state is *Pretraga mesta još nije aktivirana. Tačku možete izabrati na mapi.* — which is doubly
unhelpful here, because the search **is** activated; only my wiring was missing.

The mechanism itself was never broken: four new tests in `locationPointEditor.test.tsx` show
`autoLocate` performs exactly one lookup of the seeded query, does nothing when not asked, never
moves an already-confirmed point, and ignores an empty seed.

**Fixed.** The ask now builds the production resolver and passes it, cancels it on unmount, and a
test asserts the editor receives it, so this cannot regress quietly.

## Cause 2 — with no pin, the camera is pointed at the middle of the ocean

`ResolvedPinMap.tsx`:

```ts
const initial = useRef(pin ? { center: [pin.longitude, pin.latitude], zoom: coarse ? 10 : 15 }
  : { center: [0, 0], zoom: 1 });
```

With no pin the camera starts at longitude 0, latitude 0 — the Gulf of Guinea — at zoom 1, which
is a hemisphere. That is his *pola sveta*, precisely.

Because of cause 1 the pin never arrived, so this was the view every single time. With the
resolver wired the candidate lands and the camera jumps to zoom 15, so in the normal case this no
longer shows. It still shows whenever a lookup fails or returns nothing, and it shows in the long
form too for any fresh point.

**Not fixed, deliberately.** The honest default would be the task's own country or city, and the
map has no coordinates for either until something resolves them. Inventing a centre would mean
shipping made-up geography. The options are listed below.

## Cause 3 — grey is largely the basemap, by choice

`positron` is a deliberately desaturated style: pale grey land, white water, few labels. It is the
right choice for a map whose job is to carry one pin and not compete with it. But at zoom 1 over
open ocean, a pale style with no labels is indistinguishable from a broken map — which is what he
reported, and a reasonable reading of what he saw.

So "grey" is not evidence of a tile failure. Nothing in the code suggests one: the style needs no
key, and `DiscoveryMap` uses the same constant.

**Nothing to fix here**, beyond fixing what the camera points at. Worth revisiting only if a real
tile failure is ever observed, which would look like uniform grey with the pin visible on top and
no coastlines at any zoom.

## Cause 4 — there is no "use where I am"

`captureCurrentLocation` exists and works, but `grep` finds exactly one consumer:
`AgreementLocationController`. Neither `LocationPointEditor` nor `ResolvedPinMap` nor
`NeedLocationForm` ever asks the device where it is, and `mesto-zadatka` states the policy openly:
*GPS dozvola nije potrebna.*

That was a deliberate decision, and a defensible one — a task's place is frequently not where the
person is standing when they post it. But for the common case, *the work starts at my house*, "use
my location" is the shortest possible path to a point, and its absence is exactly what the owner
noticed.

**Not implemented.** It is a feature, not a repair, and it needs his decision because it adds a
runtime permission prompt to a flow that currently has none.

## How it should work, against how it stands

| step | should | stands now |
| --- | --- | --- |
| the conversation notices a point is missing | says so in the thread, offers the map | **works** |
| the sheet opens on the address already said | pin standing on it | **fixed today**; shipped build never searched |
| the map shows where that is | street-level, centred on the pin | **fixed today** for the resolved case |
| no result, or no address yet | somewhere plausible — the task's city | **half the world** |
| "the work starts where I am" | one tap | absent |
| both ends of a route seen together | one map, two pins, drag either | one at a time |
| correcting a typo afterwards | keep the points still valid, warn first | silently discards both |
| the draft that cannot be published | says so, and leads to the map | says *pregled i objava jednim korakom* |

## Options for what remains, in the order they are worth doing

1. **A plausible centre when nothing is resolved yet.** Cheapest honest version: remember the last
   confirmed point on this account and open there; failing that, the country from
   `need.task_country_code` resolved through the same Edge search once, rather than a hardcoded
   table. No invented coordinates.
2. **"Use where I am"**, as an explicit button that asks for the permission only when pressed, and
   drops a `MANUAL_PIN` the person still confirms. Owner decision: it introduces a permission
   prompt.
3. **One map, both pins, drag either.** The largest change, and the one that makes a route
   comprehensible.
4. **Warn before an edit discards confirmed points.** Twenty-two tests pin the current
   discard-immediately behaviour, so this is real work, not a tweak.
5. **The draft says it cannot be published.** Blocked on the owner's need projection carrying no
   point information; needs either a server field or the review screen to own the message.

Items 3, 4 and 5 were approved on 2026-09-18 as part of variant A. Items 1 and 2 are new, found by
this audit, and are not started.
