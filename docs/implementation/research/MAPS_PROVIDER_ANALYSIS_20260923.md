# USKOČI maps: provider analysis and the ideal map UX

Research date: 2026-09-23. This was a read-only review of worktree `uskoci-kompletan-audit-2e715e` at `240723c4`. Every external fact has a source at the end, all accessed 2026-09-23. Cost figures depend on usage assumptions, which are labelled as assumptions. Nothing here needs a key, an account or a paid call.

---

## Sažetak za vlasnika

Ostajemo na MapLibre mapi i besplatnim OpenFreeMap slojevima mape. Za USKOČI su to najbolji izbor: ne traže ključ, već rade na novoj arhitekturi, sami grupišu pinove i ništa ne šalju Google-u. Google nije toliko bolji za ono što nama treba da bi se prelazak isplatio. Njegova pravila zabranjuju da se njegova pretraga adresa prikazuje na tuđoj mapi i da se koordinate čuvaju duže od 30 dana, a mi tačku zadatka čuvamo trajno. Na tvom telefonu mapa sada piše „Belgrade Београд" i „Serbia"; nazive prebacujemo na srpsku latinicu, bez ključa i bez troška. Pretraga adresa (LocationIQ, EU server) šalje upit na engleskom, bez tvog grada kao prednosti; to popravljamo odmah. Pre javnog puštanja treba tvoja odluka: plaćeni LocationIQ (oko 100 $ mesečno) ili naša pretraga iz državnog Adresnog registra (besplatni otvoreni podaci). Razlog je što besplatni plan dozvoljava čuvanje rezultata samo 48 sati. Mapa i lista postaju jedan ekran sa listom koja se povlači odozdo, pinovi pokazuju cenu i HITNO, a tvoja lokacija se uzima samo na dugme „Blizu mene", približno, i ostaje na telefonu.

---

## 1. What the app does today (read from code)

| Layer | Implementation | Where |
|---|---|---|
| Renderer | `@maplibre/maplibre-react-native` **11.3.10**: new architecture only, Expo config plugin added in `app.config.js`, `androidView="texture"` | `package.json:8`, `app.config.js:523-534` |
| Basemap | `https://tiles.openfreemap.org/styles/positron`, no key; one constant used everywhere | `src/ui/location/ResolvedPinMap.types.ts` (`RESOLVED_PIN_MAP_STYLE`) |
| Discovery map | Native GeoJSON clustering (`clusterRadius 48`, `clusterMaxZoom 16`, camera `maxZoom 18`); circle pins; urgent pins red, selected pin with an orange ring plus a `ViewAnnotation`; "Pretraži ovu oblast"; zoom ± buttons; honest load-failure state | `src/ui/v2/DiscoveryMap.tsx` |
| Public point | Server rounds to 2 decimals (`round(latitudeE6/1e6, 2)`); the client re-rounds and sends only `{needId}` plus the point to the SDK | `supabase/migrations/20260910130851_clean_w02_resolved_location_authority.sql:230`, `src/data/marketplaceView.ts:11-18,56-61` |
| Point picker and read-only maps | `ResolvedPinMap`: tap or drag the pin, coarse mode (zoom 10, max 13), read-only mini map at height 184 on task detail | `src/ui/location/ResolvedPinMap.tsx`, `src/app/(app)/prilike/[id].tsx:136`, `potrebe/[id]/pregled.tsx:181` |
| Geocoding | Client, then Edge `uskoci-location-search` (JWT checked, market allowlist, ≤10 calls per minute per user), then **LocationIQ EU** (`eu1.locationiq.com/v1/search` and `/reverse`). The token exists only as an Edge secret. Responses are normalised to a provider-neutral envelope `{candidates:[{label,countryCode,position,providerHint,candidateId}]}` | `supabase/functions/uskoci-location-search/index.ts`, `src/data/configuredLocationResolver.ts`, `src/data/productionLocationResolver.ts` |
| Device location | **Exists.** A one-shot foreground capture through MapLibre's `LocationManager`, used for Dogovor sharing (`AgreementLocationController`) and for "Koristi gde sam" in the point editor (`LocationPointEditor.tsx:113-127`). `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are declared. Discovery uses no location. | `src/data/nativeCurrentLocation.ts`, `app.config.js:515-519` |
| Discovery data | All open tasks are loaded (up to 25 pages × 200 via `rpc_list_open_tasks_v3`). "Pretraži ovu oblast" is a client-side filter over that set. | `src/data/supabaseIzvor.ts:165-180`, `marketplaceView.ts:46-51` |

**A correction to the brief.** The app is not free of GPS. It has two explicit, one-shot, foreground captures. It never tracks and never uses location on discovery.

### Defects found (evidence first)

| # | Finding | Evidence | Fix (no key needed) |
|---|---|---|---|
| F1 | **Place labels come out as English exonyms plus Cyrillic.** The owner's phone shows "Belgrade / Београд" and "Serbia". Positron's `text-field` joins `name:latin` and `name:nonlatin`, and falls back to `name_en`. | `docs/implementation/design-audit-20260923/phone-80464ecc/06-mapa.png`; style JSON | OpenFreeMap tiles already carry `name:sr-Latn` (TileJSON `vector_layers`). Patch the style's label layers to `["coalesce",["get","name:sr-Latn"],["get","name:latin"],["get","name"]]`. v11 `mapStyle` accepts `string \| StyleSpecification` (`Map.d.ts:234`). |
| F2 | **Tasks at the same rounded point cannot be reached on the map.** Every task in the same ~1.1 × 0.8 km cell gets an identical coordinate. Above `clusterMaxZoom 16` they draw on top of each other, and `pressFeature` takes only `features[0]`. The phone screenshot shows a "2" cluster. | `DiscoveryMap.tsx:39,75` | When a cluster is tapped: call `getClusterLeaves` (in the v11 API). If the leaves share one coordinate, or the expansion zoom is past the cap, open the list sheet filtered to those IDs ("2 zadatka na ovom mestu"). |
| F3 | **Geocoder queries are unlocalised and unbiased.** The Edge function sends no `accept-language`, and LocationIQ defaults to `en`. It sends no `viewbox`, so "Bulevar oslobođenja 12" can come back as Novi Sad or Belgrade in arbitrary order. | `index.ts:212-214`; LocationIQ docs | Add `accept-language=sr-Latn,sr,en`, `viewbox=<task city or map viewport>` with `bounded=0`, and `normalizeaddress=1`. Build a short label ("Bulevar oslobođenja 12, Novi Sad") instead of the long `display_name`. Verify `sr-Latn` with a golden set (§5). |
| F4 | **Licence risk on stored coordinates.** The free LocationIQ plan allows caching for 48 h only. USKOČI persists the chosen candidate's coordinates and `place_id` (`origin: PROVIDER_CANDIDATE`) in `need_sensitive.resolved_location` and derives the public point from them. | LocationIQ pricing page; `LocationPointEditor.tsx` `selectCandidate` / `confirm` | Owner gate: a paid plan, or our own RGZ geocoder (§5). Ask LocationIQ in writing whether a user-confirmed coordinate counts as a cached response. |
| F5 | **The iOS purpose string is incomplete.** It mentions only Dogovor sharing, but "Koristi gde sam" also asks for location. | `app.config.js:518` | "USKOČI koristi tvoju lokaciju samo kada to izabereš: da postaviš tačku zadatka ili da je u Dogovoru podeliš sa naručiocem." |
| F6 | **Attribution is duplicated and incomplete.** A custom row shows "© OpenStreetMap OpenFreeMap" and hides the "Serbia" label; the native (i) button is shown as well. OpenFreeMap requires "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". | Screenshot; `DiscoveryMap.tsx:101-102`; `ResolvedPinMap.tsx:197-200` | Show one compact credit, "© OpenStreetMap · OpenMapTiles · OpenFreeMap", tappable to a small sheet with links. Derive it from provider config (§6). |
| F7 | **The zoom invites false precision.** Discovery allows zoom 18 over points that can be about 0.68 km off (half the cell diagonal). | `DiscoveryMap.tsx:74` | Cap discovery at zoom 15. Show a soft ~700 m area for the selected task (§7). |
| F8 | **"Search this area" only filters what is already loaded.** It does not scale. | `marketplaceView.ts:46-51` | For now, the list follows the viewport client-side (§7). Later, a server bbox read: PostGIS is already installed (`20260829210650_clean_geo_foundation.sql`). |
| F9 | **The map is re-created on every List→Map switch.** It is only mounted in map mode, so each switch pays for a new GL context and style load. | `MarketplacePresentation.tsx:209-213` | One screen with the map always mounted under the list sheet (§7). |
| F10 | **Location capture is coupled to the renderer.** Any renderer swap silently breaks Dogovor sharing. | `nativeCurrentLocation.ts:17-19` | Put it behind a `LocationSensor` port (§6). |
| F11 | **No navigation handoff in the Dogovor.** No `geo:` or Maps URL anywhere (grep). | grep `src` | "Otvori navigaciju" through keyless Maps URLs (§7). |
| F12 | **OpenFreeMap has no SLA** and "may discontinue at any time". | OpenFreeMap ToS | A configurable fallback style profile (§4, §6). |
| F13 | **The discovery map is mostly empty.** 4 of 6 tasks are "bez tačke" in the phone screenshot, because points are rarely confirmed (see the PKG-022 audits). | Screenshot; `PKG022_LOCATION_FUNCTION_AUDIT_20260918.md` | A provider change fixes nothing here. The location-capture flow is the bottleneck. |

---

## 2. Provider comparison

### 2.1 Capability matrix

| | **MapLibre + OpenFreeMap** (current) | MapLibre + MapTiler | MapLibre + Stadia | MapLibre + Protomaps (self-hosted PMTiles) | **Google** (react-native-maps, Google provider + Places/Geocoding) | Mapbox (`@rnmapbox/maps`) | HERE |
|---|---|---|---|---|---|---|---|
| RN / Expo, new architecture | v11 is new-architecture only; Expo plugin; dev build (not Expo Go). **Already integrated.** | same renderer | same renderer | same renderer | react-native-maps ≥1.26.1 needs RN ≥0.81.1 on new architecture; Expo plugin (`androidGoogleMapsApiKey` / `iosGoogleMapsApiKey`). `expo-maps` is **alpha**, Google on Android only, Apple on iOS. | Expo plugin; Mapbox SDK v11 **requires an access token** | **No official RN SDK** (Android, iOS, Flutter only) |
| Clustering | **Native GeoJSON clustering**, plus `getClusterLeaves` / `getClusterExpansionZoom` | same | same | same | **Not built in.** Needs supercluster or a clustering library, which is a new dependency. | native | n/a in RN |
| Map look / UX | Vector styles, fully restylable; Positron is calm | Many polished styles | Good styles | Protomaps styles, fully owned | Best-known look, POI-rich | Excellent | Good |
| Serbian Latin labels | `name:sr-Latn` in tiles (verified) | OSM-based | OSM-based | Serbian Latin supported | `language=sr-Latn` supported | `sr` limited coverage | not verified |
| Geocoding / reverse | Via LocationIQ (Nominatim-style, OSM) | MapTiler Search (included) | Pelias (OSM, OpenAddresses, WOF) | none; bring your own | **Strongest** POI/business search, commercial address data | Good; Serbian "limited" | Commercial data; not verified here |
| Address data in Serbia | OSM. The RGZ national address register (2.4 M house numbers, open data since 2022-12) was **70 % imported by 2024-03**. Nominatim transliterates all scripts to Latin, so Latin queries match Cyrillic `addr:street`. | OSM plus own | OSM + OpenAddresses | — | Commercial | Mixed | Commercial |
| Routing | Not needed in-app; hand off to a nav app | Not needed | Routing 20 credits per request | none | Routes $5/1k | Directions 100k free | yes |
| Storing results | ODbL: individual geocoding results may be stored with our data **without share-alike** (OSMF Geocoding Guideline). LocationIQ free plan: 48 h; paid plan: "as long as you're a customer". | check terms | check terms | yours | **lat/lng ≤ 30 days**; only place IDs may be stored indefinitely | Temporary geocoding **may not be cached**; permanent geocoding $5/1k | not verified |
| Use with another map | fine | fine | fine | fine | **Forbidden**: "will not use the Google Maps Core Services with or near a non-Google Map". EEA-only terms (since 2025-07-08) do not cover a Serbian billing account. | Geocoding "only … in conjunction with a Mapbox map" | not verified |
| Keys | **none** | public key in tile URL | API key | none | Android/iOS key inside the APK (restricted by package + SHA-1 / bundle ID) plus a server key | token | key |
| SLA | **none** | Custom plan 99.9 % | paid plans | your CDN | yes | yes | yes |
| Lock-in | Lowest: open renderer, open data, swap style by URL | low | low | lowest | **Highest**: renderer, data and ToS move together | high: proprietary SDK plus token | medium |

### 2.2 Licences and attribution USKOČI must show

- **OSM / ODbL:** "© OpenStreetMap" with a link to `/copyright`. Individual geocoding results are an insubstantial extract. Only systematic aggregation of a substantial part of OSM becomes a Derivative Database.
- **OpenFreeMap:** "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". OpenFreeMap's own credit is optional.
- **LocationIQ free plan:** a visible link, "Search by LocationIQ.com". The app already shows "Pretraga: LocationIQ · izvori podataka".
- **Google:** Places results must sit on a Google map with the Google logo, or carry the Google logo when no map is shown.
- **Serbian address register:** Serbian Open Data Licence.

### 2.3 Privacy (GDPR-aligned Serbian ZZPL, Sl. glasnik 87/2018)

| Flow | What leaves the device | Recipient / location |
|---|---|---|
| Tiles (OpenFreeMap) | IP address and viewed tile coordinates, which approximate the area being looked at | Hyperknot Software Kft. (Hungary, EU). No IP logging by default (up to 30 days during security incidents), no cookies; Cloudflare CDN may be used |
| Place search | Typed text (through our Edge), no account ID | LocationIQ EU endpoint (already in `PRAVNIK_PODACI_I_ROKOVI_20260921.md`, rows 25-26) |
| Dogovor share, "Koristi gde sam" | One precise point, on explicit press | Our Supabase |
| **Google variant** | Typed text and coordinates to Google (US) | Transfers to the US need a ZZPL mechanism. The Commissioner asked for the US to be removed from the adequacy list after Privacy Shield, so standard clauses are needed. That is a legal gate. |

Google Play Data safety: location used only on the device is not "collected". A proposed "Blizu mene" that only moves the camera stays undisclosed. The existing Dogovor share is collection and must be declared as precise location.

---

## 3. Cost at 1k, 10k and 100k monthly active users

### 3.1 Usage assumptions (not measured; replace with telemetry once available)

| Per MAU per month | Value | Reasoning |
|---|---|---|
| Map loads | **30** | 10 discovery opens + 20 mini maps (task detail, Dogovor, profile area) |
| Vector tile requests | **800** | 10 × ~60 + 20 × ~8 ≈ 760 (before MapLibre's on-device cache, so an upper bound) |
| Forward searches S | **1.2** | ~25 % of MAUs set a location each month × ~4–5 lookups |
| Reverse lookups R | **0.3** | "Pronađi adresu za ovaj pin" |
| Geocoder calls, submit mode | **1.5** | S + R |
| Autocomplete requests (as-you-type mode) | **7.2** | 6 per search after a 300 ms debounce and 3-character minimum |

| Totals | 1k MAU | 10k MAU | 100k MAU |
|---|---|---|---|
| Tiles | 0.8 M | 8 M | 80 M |
| Map loads | 30 k | 300 k | 3 M |
| Geocoder calls (submit mode) | 1.5 k | 15 k | 150 k |
| Autocomplete requests | 7.2 k | 72 k | 720 k |

### 3.2 Arithmetic with current public prices

**A. MapLibre + OpenFreeMap + LocationIQ (current).** Tiles cost $0.
- LocationIQ free plan: 5,000 requests/day, 2 requests/s, 48 h caching.
- Developer plan: $100/month, 25,000 requests/day. Startup: $200/month, 60,000 requests/day.

| MAU | LocationIQ load | Plan |
|---|---|---|
| 1k | 50/day | Free fits by volume; **$100 if permanent storage requires a paid plan** |
| 10k | 500/day | $100 |
| 100k | ~5,000/day on average, peaks above | Developer **$100** |
| 100k, autocomplete | (720k + 120k + 30k) = 870k/month ≈ 29k/day | Startup **$200** |

**B. Protomaps self-hosted on Cloudflare (tiles only) + LocationIQ.**
- Prices: Workers free 100k requests/day; Paid $5/month includes 10 M, then $0.30/M. R2: Class B reads $0.36/M after 10 M free; storage $0.015/GB after 10 GB free; egress free.
- 1k MAU: 0.8 M/month ≈ 27k/day, within the free tier: **$0**.
- 10k MAU: 8 M/month ≈ 267k/day, above the free daily limit, so Paid: **$5**.
- 100k MAU: $5 + (80 − 10) M × $0.30/M = $5 + $21 = **$26**. Worst case with zero cache hits adds R2 reads: 70 M × $0.36/M = $25.20, so at most **$51.20**.
- Add LocationIQ from A.
- A Serbia or Balkans extract is well under 10 GB (the planet file is ~120 GB); measure it with `pmtiles extract`.

**C. MapLibre + MapTiler (Flex $30/month).** Flex includes 25k map sessions and 3k search sessions; overage is $2.50 per 1k sessions of either kind. The free plan is non-commercial. **Every map initialisation, including each mini map, is a session.**
- 1k: (30k − 25k) × $2.5/1k = $12.50, plus $30 = **$42.50**.
- 10k: 275k × $2.5/1k = $687.50, plus 9k search × $2.5/1k = $22.50, plus $30 = **$740**.
- 100k: 2,975k × $2.5/1k = $7,437.50, plus 117k × $2.5/1k = $292.50, plus $30 = **$7,760**.
- Variant with mini maps replaced by static images (10 sessions per MAU): 1k **$30**; 10k $187.50 + $22.50 + $30 = **$240**; 100k $2,437.50 + $292.50 + $225 (1.5 M static requests × $0.15/1k) + $30 = **$2,985**.

**D. MapLibre + Stadia (tiles + Pelias).** A tile costs 1 credit, a forward or reverse geocode 20 credits, autocomplete v2 1 credit. Free is non-commercial.
- 1k: 0.8 M + 30k = 0.83 M credits, so Starter **$20** (1 M credits).
- 10k: 8 M + 0.3 M = 8.3 M, so Standard $80 (7.5 M) + 0.8 M × $0.02/1k = $16, total **$96**.
- 100k: 80 M + 3 M = 83 M, so Professional $250 (25 M) + 58 M × $0.015/1k = $870, total **$1,120**.
- Autocomplete adds at most $10.80 at 100k.

**E. Google (react-native-maps Google provider).**
- The mobile Maps SDK is **free and unlimited**. The $200 monthly credit was replaced on 2025-03-01 by free calls per SKU: 10k for Essentials, 5k for Pro.
- Submit mode, Geocoding at $5/1k for forward and reverse: 1k **$0**; 10k 5k × $5/1k = **$25**; 100k 140k × $5/1k = **$700**.
- Autocomplete mode: requests 1–12 of each session are billed at $2.83/1k, plus Place Details Essentials at $5/1k per completed session, plus reverse via Geocoding.
  - 1k: all within the free caps, **$0**.
  - 10k: 62k × $2.83/1k = $175.46, plus 2k × $5/1k = $10, total **$185.46**.
  - 100k: 710k × $2.83/1k = $2,009.30, plus 110k × $5/1k = $550, plus 20k × $5/1k = $100, total **$2,659.30**.
- The 100k figures are upper bounds at the first-tier price; volume tiers above 100k are cheaper.
- Not included: re-fetching stored coordinates every 30 days to stay within the caching rule.

**F. Mapbox.** Storage requires permanent geocoding: $5/1k with no free tier. The SDK is free up to 25k MAU, then $4 per 1k MAU.
- 1k: 1.5k × $5/1k = **$7.50**.
- 10k: **$75**.
- 100k: 75k MAU × $4/1k = $300, plus 150k × $5/1k = $750, total **$1,050**.

**G. HERE.** The official price page did not render machine-readably. Third-party summaries (not official) cite about 30k free transactions/month and ~$0.75/1k for geocoding, with a ~6 % rise from 2026-04-01. **Unverified. Not used in the decision.**

### 3.3 Summary, dollars per month (submit mode unless noted)

| MAU | A: current (OFM + LIQ) | B: Protomaps self-hosted + LIQ | C: MapTiler | D: Stadia | E: Google (autocomplete) | F: Mapbox |
|---|---|---|---|---|---|---|
| 1k | 0 (free LIQ, storage caveat) / 100 | 100 | 42.50 | 20 | 0 | 7.50 |
| 10k | 100 | 105 | 740 (240 with static mini maps) | 96 | 185 | 75 |
| 100k | 100–200 | 126–251 | 7,760 (2,985) | 1,120 | ≤2,659 | 1,050 |

Google and Mapbox are cheap at small scale. Cost is not what rules them out; the terms are (§4).

---

## 4. Recommendation

**Keep MapLibre and OpenFreeMap as the default. Keep LocationIQ EU as the geocoder, fix it now (F3), and decide on storage before launch (F4). Add a configurable fallback tile profile. Do not adopt Google.**

The decisive reasons:

1. **The data model conflicts with Google's and Mapbox's terms.** USKOČI permanently stores a confirmed point per task and derives the public approximate point from it.
   - Google allows lat/lng for at most 30 days and forbids using its geocoding or places "with or near a non-Google map".
   - Mapbox temporary geocoding cannot be cached and must be used with a Mapbox map.
   - Either path forces a full renderer switch, plus a coordinate-refresh job or a legal opinion that a user-confirmed pin is our own content.
   - OSM-based geocoding results may be stored with our data without share-alike (OSMF guideline). Only the LocationIQ plan term remains, and it is a billing decision.
2. **The best RN renderer is already integrated.** MapLibre v11 is new-architecture only, has an Expo plugin, and offers native clustering with leaf queries. react-native-maps would need a new clustering dependency. `expo-maps` is alpha and inconsistent across platforms. HERE has no RN SDK.
3. **Privacy and keys.** No key sits in the app or repository. The tile operator is in the EU and logs no IPs by default. The geocoder is on an EU endpoint behind our JWT-checked Edge function. There is no transfer to the US.
4. **Resilience at bounded cost.** The only structural weakness is OpenFreeMap's missing SLA. A style-profile swap (§6) to a self-hosted Protomaps extract costs about $0–51/month at 100k MAU; Stadia costs $20–1,120/month with an SLA. Either is a config change, not a rewrite.
5. **Where Google is genuinely better: POI and business search, and possibly house-number completeness** where the RGZ import has not landed in OSM. USKOČI mostly needs street addresses and the owner's own city, not businesses. That is a measurable question (§5), not a reason to switch blindly.

**Next priorities, in order:**
- F1 labels, F2 stacked pins, F3 geocoder parameters, F5 purpose string, F6 attribution.
- The abstraction (§6).
- The merged map and list screen (§7).
- A decision on F4: paid LocationIQ, or our own RGZ geocoder.

---

## 5. Better address search: three paths, with approval gates

**Step 0: measure first (no gate).** Build a golden set of about 60 real Serbian addresses:
- Latin and Cyrillic;
- with and without diacritics ("Djure Djakovica" / "Đure Đakovića");
- urban, suburban and rural;
- house numbers with letters ("12a");
- place-only queries ("Liman 3").

Run it server-side through the current Edge adapter before and after F3. Record top-1 and top-3 hits against ground truth. The recorded result becomes a repo artifact.

**Path 1: our own Serbian address geocoder from RGZ (preferred if tuned LocationIQ falls short).**
- The Adresni registar is open (Serbian Open Data Licence), in CSV/GPKG with x/y per house number, updated weekly.
- Load it into a private Supabase table with a trigram index over a transliterated Latin key (Cyrillic → Latin, diacritics folded). Serve it from the same Edge function as provider `rgz`, falling back to LocationIQ for places and POIs.
- Unit cost $0. No third-party storage terms. Better house-number coverage than OSM wherever the import has not reached.
- **Gate:** this is a new DEV migration and follows the project's proof-then-apply rule with the owner's explicit approval. Attribution for the licence goes on the search result line.

**Path 2: paid LocationIQ.**
- Developer plan at $100/month clears the 48 h limit ("as long as you're a customer").
- **Gate:** billing, done by the owner. Confirm in writing that a user-confirmed coordinate may be kept after the subscription ends. Otherwise Path 1 is the permanent answer.

**Path 3: Google. Only if Step 0 shows a material gap that Paths 1 and 2 cannot close** (for example, top-1 hit rate ≥15 points worse on rural or house-number queries), and the owner accepts a full-stack switch.

| Phase | Work | Gate |
|---|---|---|
| G0 | Abstraction (§6); golden-set harness; LocationIQ fixes | none |
| G1 | Owner creates a Google Cloud project and billing account with **daily quota caps** on Geocoding, Places Autocomplete and Place Details, plus budget alerts; creates a **server key** restricted to those APIs and stores it only as a Supabase Edge secret. Run the golden set server-side: ~60–120 calls, inside the free 10k, so $0. | **Owner: account, billing, key** |
| G2 | Decision memo: measured gain vs. ToS consequences (Google renderer on every map screen; attribution; lat/lng ≤30 days; US transfer) | **Owner: legal/privacy + product** |
| G3 | Implement the `google` renderer adapter (react-native-maps + a clustering library, both new dependencies) and the Edge `providers/google.ts` (Places Autocomplete (New) with session tokens, Place Details Essentials with a field mask of location and formatted address). Data model stores `placeId` and the user-confirmed pin; either a lawyer confirms the confirmed pin is our content, or a 30-day refresh job re-fetches location by `placeId`. Android key restricted to package `rs.uskoci` + SHA-1 of the Play App Signing and upload certificates; iOS key to the bundle ID. App keys via EAS `production` environment variables, never in git. | **Owner: new packages, keys, privacy policy, Play Data safety update** |
| G4 | Flagged rollout; attribution and logo audit; rollback = config flip back to the `maplibre` renderer and `locationiq` provider (possible only because of §6) | **Owner: store release** |

---

## 6. Provider abstraction (implementable now, without keys or new packages)

### 6.1 Invariants carried over from the current code

- Public screens hand the SDK only IDs and server-rounded points. Pill text is added only from fields that are already public: price or "Ponuda", and HITNO.
- No map input becomes a business fact. A picked point stays a candidate until the form confirms it.
- Geocoder responses cross the wire only as the existing bounded envelope; provider extras are dropped.
- No secret in the client. Style URLs containing `key=` or `access_token=` are refused unless an owner-approved profile allows them.

### 6.2 Files and interfaces

```ts
// src/lib/map/types.ts: provider-neutral, no SDK import
export type LngLat = readonly [lng: number, lat: number];
export type Bounds = readonly [west: number, south: number, east: number, north: number];
export type Viewport = Readonly<{ center: LngLat; zoom: number; bounds: Bounds }>;
export type PublicMapPoint = Readonly<{ id: string; at: LngLat; tone: 'normal' | 'urgent'; pill?: string }>;
export type ClusterHit = Readonly<{ ids: readonly string[]; at: LngLat; stacked: boolean; expansionZoom: number | null }>;
export type MapStatus = 'loading' | 'ready' | 'failed';

export type MapSurfaceProps = Readonly<{
  profile: MapProfile;                        // from mapConfig(); style + attribution + font stack
  initial: { bounds: Bounds } | { center: LngLat; zoom: number };
  zoom: { min: number; max: number };
  points?: readonly PublicMapPoint[];
  cluster?: { radiusPx: number; maxZoom: number };
  selectedId?: string | null;
  approximateArea?: { at: LngLat; radiusM: number } | null;  // soft circle instead of a precise pin
  interactive?: boolean;                      // false = mini map, no gestures
  insets?: { top: number; bottom: number };   // sheet/card padding for camera fitting
  onPointPress?(id: string): void;
  onClusterPress?(hit: ClusterHit): void;
  onViewport?(v: Viewport, cause: 'gesture' | 'program'): void;
  onMapPress?(at: LngLat): void;              // picker only
  onStatus?(s: MapStatus): void;
  accessibilityLabel: string;
}>;
export type MapHandle = { easeTo(c: LngLat, zoom: number): void; fitBounds(b: Bounds, paddingPx?: number): void };
```

```ts
// src/data/location/ports.ts
export interface Geocoder { search(q: { text: string; countryCode: CountryCode; scopeKey: string; bias?: Bounds },
  signal?: AbortSignal): Promise<ConfiguredLocationResolution>; cancel(): void }
export interface ReverseGeocoder { reverse(q: { position: LatLng; countryCode: CountryCode; scopeKey: string },
  signal?: AbortSignal): Promise<ConfiguredLocationResolution> }
export interface PlaceSearch {          // as-you-type; later, behind the same Edge function
  suggest(q: { text: string; countryCode: CountryCode; session: string; bias?: Bounds }, signal?: AbortSignal): Promise<Suggestions>;
  resolve(candidateId: string, session: string, signal?: AbortSignal): Promise<ConfiguredLocationResolution> }
export interface LocationSensor { captureOnce(signal: AbortSignal, current: () => boolean,
  precision: 'coarse' | 'precise'): Promise<CurrentLocationResult> }
export interface NavigationHandoff { open(to: LatLng, label?: string): Promise<boolean> }
```

| Concern | Lives in | Today's code that moves there |
|---|---|---|
| Types, config, profiles | `src/lib/map/types.ts`, `src/lib/map/config.ts` | `RESOLVED_PIN_MAP_STYLE`; zoom caps now scattered in components |
| Serbian-Latin label patch | `src/lib/map/labels.ts`: fetch the style once, rewrite `text-field` on symbol layers, memoise, fall back to the URL | new |
| Geometry | `src/lib/map/geometry.ts`: bounds, haversine, metres→pixels for the approximate circle | `publicInitialBounds` helpers |
| Navigation handoff | `src/lib/map/handoff.ts`: Android `geo:lat,lng?q=lat,lng(label)`, iOS `https://maps.apple.com/?daddr=lat,lng`, universal `https://www.google.com/maps/dir/?api=1&destination=lat,lng` (Maps URLs need no key) | new |
| Renderer entry | `src/ui/map/MapSurface.tsx` (re-exports the configured adapter), `MapSurface.web.tsx` | — |
| MapLibre adapter | `src/ui/map/maplibre/MapLibreSurface.tsx`, `MapLibrePinPicker.tsx` (the drag logic from `ResolvedPinMap`), `layers.ts` (cluster, pill, urgent, selected, approximate-area specs) | bodies of `DiscoveryMap.tsx` and `ResolvedPinMap.tsx` |
| Screens | `DiscoveryMap.tsx` and `ResolvedPinMap.tsx` become thin compositions over `MapSurface` / `MapLibrePinPicker` | — |
| Geocoder (client) | `src/data/location/edgeGeocoder.ts`, which is today's `configuredLocationResolver` and `productionLocationResolver`. It accepts any `providerHint` from an allowlist (`locationiq`, `rgz`, `stadia`, `maptiler`, `google`) instead of the hard-coded `'locationiq'`. | `configuredLocationResolver.ts:83`, `productionLocationResolver.ts:8` |
| Location sensor | `src/data/location/maplibreLocationSensor.ts`; add `coarse` (Android requests only `ACCESS_COARSE_LOCATION`) | `nativeCurrentLocation.ts` |
| Geocoder (server) | `supabase/functions/uskoci-location-search/providers/{types,locationiq,rgz}.ts`, selected by the non-secret env `USKOCI_GEOCODER_PROVIDER` (default `locationiq`); each adapter maps provider JSON to the existing `Candidate` | `index.ts:207-231` |

### 6.3 Swapping by configuration

- **Tile host / style:** `EXPO_PUBLIC_MAP_PROFILE ∈ {openfreemap, protomaps-self, stadia, maptiler}`. Each profile is defined in code with its style URL, attribution lines and font stack, so an attribution cannot be forgotten. Keyed profiles stay disabled until the owner supplies a restricted key. Default: `openfreemap`.
- **Geocoder:** the server env `USKOCI_GEOCODER_PROVIDER`. The client needs no rebuild.
- **Renderer:** build-time only. Adding `google` or `mapbox` means a new package and a key, which is an owner gate by definition.

### 6.4 Guard tests (Jest, alongside existing style tests like `v3-no-global-mode`)

1. Only files under `src/ui/map/maplibre/` and `src/data/location/maplibre*` import `@maplibre/maplibre-react-native`.
2. `mapConfig()` never yields a URL containing `key=` or `access_token=` for the default profile.
3. Every profile has non-empty attribution that includes "OpenStreetMap" whenever its data is OSM-derived.
4. `publicFeatures` output keys are limited to `needId` plus pill fields.
5. The patched style's label expression starts with `name:sr-Latn`.

Existing suites that mock MapLibre need their mock paths updated (`src/ui/location/ResolvedPinMap/__tests__/renderer.test.tsx`, `src/data/__tests__/discovery-map.test.tsx`).

---

## 7. The ideal USKOČI map UX

Discovery is a ROOT screen. It follows the design rules already in force: one green primary per screen, orange only as an accent, no eyebrow or orientation copy, Inter, text never under 12 px, 44 dp targets, `vreme()` time format, reduced motion honoured.

### 7.1 One screen: map with a draggable list sheet

- **Top (fixed):** the search field "Naslov, mesto ili uslov…" and one "Filteri" button with a count badge. Applied filters appear as removable chips underneath.
- **Body:** the map is full-bleed and **always mounted** (fixes F9).
- **Sheet** (`@gorhom/bottom-sheet` 5.2.14, already approved), three snap points:
  - **peek ≈ 112 dp:** grabber plus "18 zadataka u ovoj oblasti". With remote tasks: "· 3 na daljinu".
  - **half ≈ 50 %:** a list of compact TaskCards.
  - **full:** list mode; the map is hidden behind.
- **Mode switching:** a floating pill "Mapa" / "Lista" at bottom centre, for one-tap switching and accessibility. Android Back steps full → half → peek, then clears the selection, then leaves the screen.
- **Motion:** sheet snaps use a spring; under reduced motion they snap without animation. Scroll position and filters are shared across modes; there is one state.
- **Accessibility:** the list is the canonical, accessible representation. The map's label summarises it: "Mapa: 18 zadataka u prikazu". The grabber exposes actions "Proširi listu" / "Skupi listu".

### 7.2 Camera and first open

Initial camera, in priority order (never `[0,0]` / zoom 1):
1. The last viewport for this account (local).
2. The worker's saved coarse area (`profil/lokacija`) at zoom 11.
3. The bounds of all open tasks.
4. The admitted market's configured bounds.

Zoom range: discovery 5–15 (F7), mini map 9–13, picker 5–18. No rotation or pitch, as today.

### 7.3 Pins

| State | Look | Rule |
|---|---|---|
| Cluster (z < 11, or overlapping) | Green circle, white count (≥14 px), 3 px white ring | Tap: zoom to the expansion zoom. If `stacked` or the expansion zoom is above 14, open the sheet at half with "N zadatka na ovom mestu" (fixes F2). |
| Task (z ≥ 11) | **Price pill**: white fill, green bold amount "3.000 RSD". Without a fixed price: "Ponuda" in ink, never an amount. | Pill text ≥13 px. Collisions are handled by clustering (`clusterMaxZoom 14`), not by hiding. |
| Urgent | Danger-red fill, white "HITNO · 3.000" | Always drawn above others (`symbol-sort-key`). Colour is never the only signal. |
| Selected | Green fill, white text, scale 1.12, raised, 180 ms ease (jump under reduced motion), select haptic | Camera pans so the pin stays above the preview card (`insets.bottom`). Tapping empty map clears. |
| Approximate area | Soft green circle, ~700 m radius, 12 % opacity, only for the **selected** task at z ≥ 12 | Radius in px = 700 m ÷ metres-per-pixel. At ~44.5° N that is ≈51 px at z12, ≈103 px at z13, ≈206 px at z14. |

The pill glyphs come from the tile host (Noto Sans) until we self-host Inter glyph PBFs, which the OFL permits, with a self-hosted style.

### 7.4 Task preview card (pin tap)

The sheet peek grows into one compact TaskCard, using the system `cardCompact` look:
- title (2 lines);
- the amount, large, or "Ponuda";
- "Približno · Liman, Novi Sad";
- time as "25. sep · 09:00";
- HITNO if urgent;
- optionally "~3 km od tvoje oblasti", computed locally from coarse points.

The whole card opens the detail. There is no second button. Swiping horizontally between visible pins sorted by distance can come later.

### 7.5 "Search this area"

The list in the sheet **follows the visible bounds automatically**: debounced 400 ms after a gesture-caused `onRegionDidChange`, using camera insets. The peek count updates live. The explicit "Pretraži ovu oblast" button goes away.

When there are no tasks in view, the peek reads "Nema zadataka ovde" with a secondary action "Umanji mapu". The client-side filter is free today. When a server bbox read arrives (F8, PostGIS installed), keep the same behaviour and show a quiet "Učitavam…" in the peek.

### 7.6 Filters

The existing sheet keeps: price mode (Moja cena / Ponude), "Samo HITNO", and when (Danas / Ove nedelje). **No category filter**, per the owner rule from PKG-031 that no category is shown to people. Remote tasks never appear as pins; they appear as a row in the list, "Na daljinu · 3".

### 7.7 Current location

- **No blue dot and no automatic prompt.**
- A 44 dp "Blizu mene" button sits above the sheet. The first press shows a one-line explanation sheet: "Pomeramo mapu do tebe. Lokacija ostaje na telefonu." Only then comes the OS dialog, asking for **coarse only** (Android 12+ lets the person choose approximate).
- On grant: ease to zoom 12 and draw an accuracy halo, not a precise dot. Nothing is stored or sent.
  - Honest caveat: the tiles for that area are fetched from the tile host, as with any panning.
- On denial: an inline line with a path to settings. The fallback centre is the saved worker area.
- Play Data safety: on-device use only, so this is not "collected".
- Fix the iOS string first (F5).

### 7.8 Mini map on task detail

- A gesture-free live map, height 160–184, zoom 12.5, showing the **approximate circle, not a pin**.
- Line under it: "Približna lokacija · Liman, Novi Sad".
- Tap opens a full-screen map sheet centred there.
- MapLibre v11 exposes no snapshot API in its typings (checked `Map.d.ts`), so keep a single live mini map per screen.
- No directions before the Dogovor.

### 7.9 Precise vs. approximate location

| Before the Dogovor (everyone) | Inside an active Dogovor (the two parties only) |
|---|---|
| Server-rounded point, rendered as a soft area; area text | Precise pin on an interactive map (pan and zoom, no editing), private address text with "Kopiraj adresu", access notes |
| "Tačnu adresu vidiš kada se dogovorite." | **"Otvori navigaciju"** (white button, green label): hands off through keyless Maps URLs or `geo:`, as the person's explicit action (fixes F11) |
| — | The existing one-shot "Podeli gde sam" |
| — | Route tasks (from place to place): pins A and B joined by a dashed straight line, labelled "~12 km vazdušnom linijom". Honest, and needs no routing API. |

When the Dogovor ends, the precise data leaves the view. How long it is retained is an open question for the lawyer (`PRAVNIK_PODACI_I_ROKOVI_20260921.md`, row 52).

**Privacy note for the owner (privacy gate).** Deterministic 0.01° grid snapping is ~1.11 km north–south by ~0.79 km east–west at 45° N. In sparse rural cells that can narrow a task to a handful of houses. Options are a coarser grid in low-density areas or snapping to the settlement centroid. This is a server and privacy decision, so it goes to the owner.

### 7.10 Point picker (task creation)

- Keep the confirm-by-human rule.
- Open on the address the conversation already has (the PKG-022 fix) with the viewbox bias from §5.
- Suggestions appear as you type, once `PlaceSearch` lands.
- "Koristi gde sam" stays precise and explicit.
- Show both pins of a route on one map (approved PKG-022 item 3).

### 7.11 Performance

- One GL context per screen.
- Replace `JSON.stringify(data)` per render (`DiscoveryMap.tsx:26`) with a memoised version key.
- Carry selection and urgency as feature properties or feature-state, not as re-built `literal` arrays in `paint`, to avoid restyling on every render.
- Keep `androidView="texture"` only where overlays need it; measure against SurfaceView on the emulator.
- Up to 5,000 points (today's read ceiling) is well within native clustering.

---

## 8. Decisions that need the owner (and only these)

1. **Geocoder storage (F4):** paid LocationIQ Developer at $100/month, or the RGZ own-geocoder package (DEV migration approval), or both.
2. **Fallback tile profile:** a Cloudflare account for self-hosted Protomaps (≈$0–51/month at 100k MAU), or a Stadia plan ($20–1,120/month), kept ready but unused.
3. **Privacy:** whether rural points need a coarser public grid (§7.9); the retention of precise Dogovor location.
4. **Google (or Mapbox):** only after the §5 measurement, and then the whole G1–G4 path: accounts, billing, keys, packages, legal, store.

Everything else (F1–F3, F5–F13, §6 and §7) proceeds without a gate, following the emulator screenshot loop.

---

## Sources (all accessed 2026-09-23)

- OpenFreeMap: https://openfreemap.org/ · ToS: https://openfreemap.org/tos/ · Privacy: https://openfreemap.org/privacy/ · Style: https://tiles.openfreemap.org/styles/positron · TileJSON (attribution, `name:sr-Latn`): https://tiles.openfreemap.org/planet
- MapLibre RN v11 (new architecture only): https://github.com/maplibre/maplibre-react-native/releases/tag/v11.0.0 · v11.4.0 (2026-09-19): https://github.com/maplibre/maplibre-react-native/releases/tag/v11.4.0 · Expo setup: https://maplibre.org/maplibre-react-native/docs/setup/expo/
- Google pricing: https://mapsplatform.google.com/pricing/ · SKU list: https://developers.google.com/maps/billing-and-pricing/pricing · Session pricing (updated 2026-09-17): https://developers.google.com/maps/documentation/places/web-service/session-pricing
- Google terms: https://cloud.google.com/maps-platform/terms · Service Specific Terms (30-day lat/lng caching): https://cloud.google.com/maps-platform/terms/maps-service-terms · EEA terms: https://cloud.google.com/terms/maps-platform/eea and https://developers.google.com/maps/comms/eea/faq
- Google policies: Places https://developers.google.com/maps/documentation/places/web-service/policies · Geocoding https://developers.google.com/maps/documentation/geocoding/policies · Languages (sr, sr-Latn): https://developers.google.com/maps/faq#languagesupport · Maps URLs (no key): https://developers.google.com/maps/documentation/urls/get-started
- React Native map libraries: react-native-maps https://github.com/react-native-maps/react-native-maps · Expo docs https://docs.expo.dev/versions/latest/sdk/map-view/ · expo-maps (alpha) https://docs.expo.dev/versions/latest/sdk/maps/
- Mapbox: pricing https://www.mapbox.com/pricing · Geocoding (temporary/permanent, Mapbox map only) https://docs.mapbox.com/api/search/geocoding/ · MAU billing https://docs.mapbox.com/android/maps/guides/pricing/ · SDK https://github.com/rnmapbox/maps
- MapTiler: https://www.maptiler.com/cloud/pricing/ · Stadia Maps: https://stadiamaps.com/pricing/
- Protomaps: downloads/licence https://docs.protomaps.com/basemaps/downloads · localisation https://docs.protomaps.com/basemaps/localization · Cloudflare deploy https://docs.protomaps.com/deploy/cloudflare
- Cloudflare: R2 pricing https://developers.cloudflare.com/r2/pricing/ · Workers pricing https://developers.cloudflare.com/workers/platform/pricing/
- HERE: pricing https://www.here.com/get-started/pricing (not machine-readable; figures unverified) · third-party summary https://local-eyes.nl/here-maps-api-costs-in-2024/ · platforms https://github.com/heremaps/here-sdk-examples
- LocationIQ: pricing and caching https://locationiq.com/pricing · search params (accept-language default `en`) https://docs.locationiq.com/reference/search · autocomplete https://docs.locationiq.com/reference/autocomplete · reverse https://docs.locationiq.com/reference/reverse-api
- OSM and Nominatim: Nominatim usage policy https://operations.osmfoundation.org/policies/nominatim/ · transliteration https://nominatim.org/tutorials/customize-transliteration.html · OSM copyright https://www.openstreetmap.org/copyright · OSMF Geocoding Guideline https://osmfoundation.org/wiki/Licence/Community_Guidelines/Geocoding_-_Guideline
- Serbian address data: RGZ address import https://wiki.openstreetmap.org/wiki/Serbia/Projekti/Adresni_registar · https://lists.openstreetmap.org/pipermail/talk-rs/2023-March/000438.html · Adresni registar open data https://data.gov.rs/sr/datasets/adresni-registar/ · https://www.rgz.gov.rs/adresni-registar
- Privacy and store rules: Serbian transfers https://zzpl.rs/en/zzpl/v-transfer-of-personal-data-to-other-countries-and-international-organisations/ · https://www.b92.net/o/info/vesti/index?yyyy=2020&mm=08&dd=11&nav_id=1717936 · https://cms.law/en/int/expert-guides/cms-expert-guide-to-data-protection-and-cyber-security-laws/serbia · Play Data safety https://support.google.com/googleplay/android-developer/answer/10787469

Repository files cited (absolute paths, worktree root `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\uskoci-kompletan-audit-2e715e`):
- `…\src\ui\v2\DiscoveryMap.tsx`
- `…\src\ui\location\ResolvedPinMap.tsx`
- `…\src\ui\location\ResolvedPinMap.types.ts`
- `…\src\ui\location\LocationPointEditor.tsx`
- `…\src\data\configuredLocationResolver.ts`
- `…\src\data\productionLocationResolver.ts`
- `…\src\data\nativeCurrentLocation.ts`
- `…\src\data\marketplaceView.ts`
- `…\src\data\supabaseIzvor.ts`
- `…\src\ui\v2\MarketplacePresentation.tsx`
- `…\supabase\functions\uskoci-location-search\index.ts`
- `…\app.config.js`
- `…\docs\implementation\design-audit-20260923\phone-80464ecc\06-mapa.png`
- `…\docs\implementation\execution\pkg022\PKG022_MAP_LAYER_AUDIT_20260918.md`
- `…\docs\implementation\execution\pkg022\PKG022_LOCATION_FUNCTION_AUDIT_20260918.md`
- `…\docs\implementation\v5-ai-first\legal\PRAVNIK_PODACI_I_ROKOVI_20260921.md`