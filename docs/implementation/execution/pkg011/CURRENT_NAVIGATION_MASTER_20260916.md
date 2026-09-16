# CURRENT_NAVIGATION_MASTER — 20260916

## Shell and guards (source: `src/app/_layout.tsx`, `src/app/(app)/_layout.tsx`, `src/app/+native-intent.tsx`)

- Root `Stack`: `Stack.Protected guard={!session}` → `auth`; `guard={!!session}` → `(app)`, `dogovor/[id]`, `obavestenja`, `prijave`; `oporavak` public. Unauthenticated inside the shell → `replace /auth` (`form=login` unless pathname is `/`); a session on `/auth` → `replace /`. Stack keyed by user id + accountRevision (A→B→A remount). Splash: BrandMark + spinner until `isLoaded`/`intentReady`.
- Completed pre-auth intent (povratniCilj) is consumed once → role set → `/prilike` (WORKER) or `/nova` (REQUESTER), or the saved target `REQUESTER_DRAFT` (`/nova?conversationId`), `NEED` (`/potrebe/[id]/pregled`), `DOGOVOR` (`/dogovor/[id]`).
- Tabs keyed by intent, `backBehavior=history`; initial `potrebe` (narucilac) / `moje-prijave` (uskocer). Visible zones: **Zadaci** (`potrebe`, requester only) · **Prijave** (`moje-prijave`, worker only) · **Mapa** (center mark, both) · **Dogovori** (both). Every other route is `href: null` (hidden, URL kept). Profile is reached through the avatar; the bell opens `/obavestenja`.
- `+native-intent`: `uskociapp://oporavak` → `passwordRecoveryIntent.publish` → `/oporavak` (never token-bearing params).
- `PushRuntime` (root): tap on a valid INBOX push → `router.push(/obavestenja)` once per identifier, only when the owning account is current.

## Canon comparison (docs/product-design-truth/USKOCI_PRODUCT_CANON.md, 8 Sep 2026 correction)

- Canon: MENI TREBA = `Zadaci | U / Novi | Dogovori`; JA MOGU = `Prijave | U / Zadaci | Dogovori`; Home and Profile are not tabs; Map and List belong inside Zadaci for both intents.
- Current: center tab is **Mapa** for both intents (shared discovery map); requester `Zadaci` tab shows own Needs with sections and a `+` button to `/novi-zadatak`; worker discovery list lives on hidden `/prilike` (reached via the `Istraži` switch or the map tab). → **OWNER_DECISION_REQUIRED (center zone semantics)**: keep shared Mapa center, or restore canon `U / Novi` (requester) and `U / Zadaci` (worker) labels/targets. This is a product-navigation decision, not a presentation detail.
- Canon: discovery List/Map inside Zadaci for both intents. Current: requester reaches discovery only through `Istraži` (→ `/prilike`) or the Mapa tab. → partial alignment; flagged in `/potrebe`.

## Route graph (static edges from route files and their UI modules; dynamic = `router.back()`/computed paths)

| Route | Inbound | Outbound | Dynamic |
|---|---|---|---|
| `/` | /_layout, /obavestenja | — | — |
| `/(app)/_layout` | **NONE** | — | — |
| `/+native-intent` | **NONE** | — | — |
| `/_layout` | **NONE** | /, /dogovor/[id], /nova, /obavestenja, /potrebe/[id]/pregled | replace |
| `/auth` | /oporavak, RootLayout(protected) | — | — |
| `/bezbednost` | /dogovor/[id], /profil/blokirani | /profil | back |
| `/dogovor/[id]` | /_layout, /dogovor/[id]/grupa, /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /obavestenja, /potrebe/[id]/kandidati, /raspored, RootLayout(return DOGOVOR) | /bezbednost, /dogovor/[id]/grupa, /dogovor/[id]/izmene, /dogovor/[id]/lokacija, /dogovori, /oceni-dogovor, /podrska/[id], /podrska/novi | back |
| `/dogovor/[id]/grupa` | /dogovor/[id] | /dogovor/[id], /podrska/[id], /podrska/novi | — |
| `/dogovor/[id]/izmene` | /dogovor/[id] | /dogovor/[id] | back |
| `/dogovor/[id]/lokacija` | /dogovor/[id] | /dogovor/[id] | back |
| `/dogovori` | /dogovor/[id], /oceni-dogovor, /potrebe/[id]/pregled, /raspored, TAB(both) | /dogovor/[id], /obavestenja, /profil, /raspored | navigate |
| `/fotografije-zadatka` | /nova, /pregled-zadatka, /rucni-zadatak | /nova | back |
| `/mapa` | /pitanja-zadatka, TAB(both) | — | — |
| `/mesto-zadatka` | /pregled-nacrta, /rucni-zadatak | /pregled-zadatka | back |
| `/moje-prijave` | /obavestenja, /prilike/[id]/prijava, RootLayout(/ redirect), TAB(worker) | /dogovor/${p.dogovorId}, /obavestenja, /prilike | back, navigate |
| `/nova` | /_layout, /fotografije-zadatka, /nova, /novi-zadatak, /pregled-nacrta, /pregled-zadatka, /prilike, /rucni-zadatak, RootLayout(return target REQUESTER_DRAFT/NONE) | /fotografije-zadatka, /nova, /potrebe, /pregled-zadatka | back |
| `/novi-zadatak` | /potrebe | /nova, /potrebe, /rucni-zadatak | back |
| `/obavestenja` | /_layout, /dogovori, /moje-prijave, /potrebe, /prilike, InboxBell, PushRuntime tap | /, /dogovor/[id], /moje-prijave, /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /prilike/[id], /profil/obavestenja | back |
| `/oceni-dogovor` | /dogovor/[id] | /dogovori | back |
| `/oporavak` | +native-intent, RootLayout(public) | /auth | replace |
| `/pitanja-zadatka` | /potrebe/[id]/pregled, /prilike/[id] | /mapa | back |
| `/podrska` | /podrska/[id], /podrska/novi, /profil, /profil/privatnost | /podrska/[id], /podrska/novi, /podrska/operator, /profil, /profil/blokirani, /profil/privatnost | back |
| `/podrska/[id]` | /dogovor/[id], /dogovor/[id]/grupa, /podrska, /podrska/[id], /podrska/novi, /podrska/operator, /pregled-zadatka | /podrska, /podrska/[id] | back |
| `/podrska/novi` | /dogovor/[id], /dogovor/[id]/grupa, /podrska, /podrska/operator, /pregled-zadatka | /podrska, /podrska/[id], /profil/privatnost | back |
| `/podrska/operator` | /podrska, /podrska/operator | /podrska/[id], /podrska/novi, /podrska/operator, /profil, /profil/blokirani, /profil/privatnost | back |
| `/potrebe` | /nova, /novi-zadatak, /potrebe/[id]/kandidati, /potrebe/[id]/pregled, /prilike, RootLayout(/ redirect), TAB(requester) | /novi-zadatak, /obavestenja, /potrebe/[id]/pregled, /prilike, /profil | — |
| `/potrebe/[id]/kandidati` | /obavestenja, /potrebe/[id]/pregled | /dogovor/[id], /potrebe, /potrebe/[id]/pregled | back |
| `/potrebe/[id]/pregled` | /_layout, /obavestenja, /potrebe, /potrebe/[id]/kandidati, /pregled-nacrta, /pregled-zadatka, RootLayout(return NEED) | /dogovori, /pitanja-zadatka, /potrebe, /potrebe/[id]/kandidati | back, push |
| `/pregled-nacrta` | **NONE** | /mesto-zadatka, /nova, /potrebe/[id]/pregled | back |
| `/pregled-zadatka` | /mesto-zadatka, /nova, /rucni-zadatak | /fotografije-zadatka, /nova, /podrska/[id], /podrska/novi, /potrebe/[id]/pregled | — |
| `/prijave` | **NONE** | — | — |
| `/prilike` | /moje-prijave, /potrebe, /prilike/[id], /prilike/[id]/prijava, RootLayout(return target WORKER) | /nova, /obavestenja, /potrebe, /prilike/[id], /profil | — |
| `/prilike/[id]` | /obavestenja, /prilike, /prilike/[id]/prijava | /pitanja-zadatka, /prilike, /prilike/[id]/prijava | back |
| `/prilike/[id]/prijava` | /prilike/[id] | /moje-prijave, /prilike, /prilike/[id] | back |
| `/profil` | /bezbednost, /dogovori, /podrska, /podrska/operator, /potrebe, /prilike, /profil/blokirani, /profil/dostupnost, /profil/fotografija, /profil/lokacija, /profil/o-aplikaciji, /profil/obavestenja, /profil/podaci, /profil/pravna, /profil/privatnost, /profil/radnik | /podrska, /profil/blokirani, /profil/dostupnost, /profil/fotografija, /profil/izvoz, /profil/lokacija, /profil/o-aplikaciji, /profil/obavestenja, /profil/podaci, /profil/pravna, /profil/privatnost, /profil/radnik, /raspored | back, replace |
| `/profil/blokirani` | /podrska, /podrska/operator, /profil | /bezbednost, /profil | back |
| `/profil/dostupnost` | /profil, /raspored | /profil | back |
| `/profil/fotografija` | /profil | /profil | back |
| `/profil/izvoz` | /profil, /profil/privatnost | — | back |
| `/profil/lokacija` | /profil | /profil | back |
| `/profil/o-aplikaciji` | /profil | /profil, /profil/pravna, /profil/privatnost | back |
| `/profil/obavestenja` | /obavestenja, /profil | /profil | back |
| `/profil/podaci` | /profil | /profil | back |
| `/profil/pravna` | /profil, /profil/o-aplikaciji | /profil | back |
| `/profil/privatnost` | /podrska, /podrska/novi, /podrska/operator, /profil, /profil/o-aplikaciji | /podrska, /profil, /profil/izvoz | back |
| `/profil/radnik` | /profil, /profil/razgovor | /profil, /profil/razgovor | back, navigate |
| `/profil/razgovor` | /profil/radnik, /profil/razgovor | /profil/radnik, /profil/razgovor | back, setParams |
| `/raspored` | /dogovori, /profil | /dogovor/[id], /dogovori, /profil/dostupnost | back |
| `/rucni-zadatak` | /novi-zadatak | /fotografije-zadatka, /mesto-zadatka, /nova, /pregled-zadatka | — |

## Findings

- `/pregled-nacrta` (SCR-018, R07 per-fact draft review) has **no inbound edge** from current source: only `/mesto-zadatka` and `/rucni-zadatak` are its neighbours by outbound, and `/nova` now routes to `/pregled-zadatka`. It remains a valid URL. → LEGACY, retirement candidate after parity (V19 REPL-092 LEGACY_RETIRE; GAP-0039 back-stack fallback was fixed in PKG-003 by `mesto-zadatka` returning to `/pregled-zadatka`).
- `/prijave` (root) is a retired redirect kept for old links (V19 REPL-029 AUDIT_FIRST): `/` when signed in, otherwise `/auth?form=login`.
- `/` is a compatibility redirect by intent (`/potrebe` | `/moje-prijave`); its only static inbound edge is the `/obavestenja` back fallback.
- Intent switches inside navigation: `/prilike` `+` and `Moji` for a worker call `postaviUlogu(narucilac)` before navigating; `/obavestenja` sets the intent to the item role before opening its target; `/profil` offers the explicit switch. All follow the one-account/two-intents canon; the implicit switches are UX review items, not engine changes.
- Deep-link surfaces with owner parameters: `/bezbednost?targetAccountId&needId?&agreementId?`, `/podrska/novi?contextKind&contextId&contextRevision`, `/pitanja-zadatka?needId`, `/fotografije-zadatka?conversationId`, `/mesto-zadatka?conversationId`, `/nova?conversationId|entryKey`, `/rucni-zadatak?conversationId`, `/pregled-zadatka?conversationId`, `/oceni-dogovor?agreementId`, `/profil/fotografija?profileId`, `/profil/razgovor?conversationId`.

