# USKOČI Information Architecture

## Global shell

```text
Launch
├─ Brand introduction
├─ Intent: Meni treba / Ja mogu
├─ Authentication / Registration / Recovery
└─ Authenticated app
   ├─ Bell → Notifications / Inbox
   ├─ Naručilac tabs
   │  ├─ Početna
   │  ├─ Potrebe
   │  ├─ + (New Need)
   │  ├─ Dogovori
   │  └─ Profil
   └─ Uskočer tabs
      ├─ Početna
      ├─ Prijave
      ├─ USKOČI / Prilike
      ├─ Dogovori
      └─ Profil
```

## Shared hierarchy

- **Notifications**
  - role filter/context
  - unread/read feed
  - resolved deep link
  - unavailable target state
- **Profile hub**
  - current intent switch
  - personal/requester profile
  - worker profile
  - reputation and verification
  - Settings
- **Settings**
  - notification preferences
  - account and sessions
  - privacy and data rights
  - support and safety
  - terms and privacy policy
  - account closure

## Naručilac hierarchy

- **Početna**
  - active Need / continue draft
  - Applications requiring attention
  - next Dogovor
  - quick create
- **Potrebe**
  - lifecycle filters
  - compact Need cards
  - full Need detail
    - edit through AI/manual correction
    - structured review
    - publish
    - candidate list/comparison
    - close remaining search
    - cancel
- **+ / New Need**
  - AI conversation
  - live compact card
  - optional voice/media
  - structured review
  - save draft / publish
- **Dogovori** → shared Dogovor workspace
- **Profil** → shared Profile hub in requester context

## Uskočer hierarchy

- **Početna**
  - availability
  - top opportunities
  - Applications requiring attention
  - next Dogovor
- **Prijave**
  - lifecycle list
  - stale review
  - withdraw
  - open selected Dogovor
- **USKOČI / Prilike**
  - search and filters
  - list mode
  - map mode
    - clusters/pins
    - compact pin sheet
  - full Opportunity detail
  - public requester profile
  - Application composer
- **Dogovori** → shared Dogovor workspace
- **Profil**
  - worker profile
  - skills/tools/licenses/vehicles
  - availability/calendar
  - shared Settings

## Dogovor workspace

```text
Dogovor list
└─ Dogovor workspace
   ├─ Pregled
   │  ├─ accepted version
   │  ├─ participants and coverage
   │  ├─ price and schedule
   │  ├─ route / exact location access
   │  ├─ directional phone sharing
   │  └─ embedded timeline
   ├─ Poruke
   ├─ Propose / respond to change
   ├─ Cancel
   ├─ Report problem
   └─ Completion
      └─ Review (target; backend missing)
```

## Navigation rules

- Back returns to the exact originating list, filter, map viewport or Inbox context.
- Switching role preserves identity and should preserve per-role tab history.
- A push or Inbox deep link sets the correct role context before opening its target.
- A stale or deleted target resolves to an honest unavailable state with a route back to the relevant top-level tab.
- Full details are full screens. Compact cards and map sheets never become scroll-heavy substitutes for detail.

