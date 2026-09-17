# Owner walkthrough on a real phone, 2026-09-17 — findings

The owner installed the attested artifact `efd5eb47…` on their own Android phone, ran it, and sent
15 screenshots. This is the first time the shipped build has been exercised on real hardware against
canonical DEV.

**It also settles PKG-017's biggest open question by accident:** the arm64 artifact installs, cold
starts, signs in and navigates on a real phone. Server-side confirmation, from `auth.sessions`: a
session created `2026-09-17 09:04:17Z` with `user_agent = okhttp/4.12.0` — the Android client inside
the app, not a browser and not a script. The owner drove it, not me, and no QA credential was used.

Everything below was verified against source or canonical DEV. Nothing here is read off a screenshot
alone.

## A. Live defects, proven

### A1. The public display name is derived from the email address

`public.handle_uskoci_auth_user_created`, still live on DEV — checked with `pg_get_functiondef`
today, not read from a migration file:

```sql
profile_name text := COALESCE(
  NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
  split_part(COALESCE(NEW.email,''), '@', 1),      -- <-- here
  'USKOČI korisnik');
```

When signup metadata carries no `full_name`, **the local part of the email becomes the public display
name**. On DEV right now: `app_accounts.full_name = 'msljivic031'` and
`app_profiles.display_name = 'msljivic031'`, which is what the Radni profil screen shows to other
users.

This is a privacy defect, not a cosmetic one. An email local part is frequently a real name, an
employer handle or something the person would not choose to publish, and here it is published on a
work profile without the user ever typing it.

### A2. The city is silently invented

Same function, next line:

```sql
profile_city text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'city'), ''), 'Novi Sad');
```

If no city is supplied, the account is assigned **Novi Sad**. Not empty, not "unknown" — a specific
Serbian city, asserted publicly on the profile. For this owner it happens to be correct, which is
exactly why it went unnoticed.

For a marketplace this is worse than A1: the profile screen shows the city under the name, and
`Područje rada — gde možete da uskočite` is location work. A fabricated city feeds discovery and
matching with a fact the user never stated.

### A3. Open tasks carry no coordinates, so Map and List disagree

Every open need on DEV has `approximate_lat` and `approximate_lng` **NULL**. The map therefore has
nothing to plot and shows `0`, while the list shows `4` — and the banner between them states
*"Izabrana oblast sa mape · isti zadaci u Listi i Mapi"*, which is false for exactly these rows.

The missing coordinates are a property of the fixture data. **The false claim in the banner is not**:
nothing enforces that the two views hold the same set, so a real task saved without coordinates would
disappear from the map with the banner still promising it is there.

### A4. Stored text carries its own quotation marks

```
title            = "Hitno prenošenje troseda"     -- the quotes are inside the value
approximate_area = "Vračar, Beograd"
approximate_city = ''                             -- empty, while the city sits in area
```

Six rows, all from the fixture accounts. A value was written as a JSON string without being decoded.
Fixture data again — but it shows there is no normalization on the write path that would have caught
it, and the city/area split was filled in wrongly with nothing objecting.

### A5. Push readiness has never been recorded

`private.push_runtime_readiness` holds **0 rows**. The status screen's *"Nema sveže potvrde da je
slanje na serveru dostupno"* is therefore accurate, and `Osveži stanje` has nothing to find, because
that row has never been written by anything.

The only row in `notification_push_devices` belongs to the **business** account, `active = false`,
from 2026-09-13. The personal account has no device at all, so *"Ovaj uređaj još nije povezan"* is
also accurate.

Worth saying plainly: these screens are honest. They separate *"the sending system is in this state"*
from *"your notification arrived"*, which is the correct distinction and rare to get right. The defect
is underneath them — the readiness probe never runs.

## B. GAP-0042, no longer hypothetical

The owner signed in on their own phone with their own account, and the only open tasks the app had to
show were **six synthetic rows created by `adversarial_a` and `adversarial_b` on 2026-08-30**,
statuses PUBLISHED and ACTIVE, all titled `"Hitno prenošenje troseda"` in Vračar.

The owner's own need is a DRAFT, so it correctly does not appear. That is the whole open-task surface
of the product, as seen by a real user: test residue.

This is what GAP-0042 predicted, observed happening.

## C. Design and copy, the owner's call rather than defects

- **Mixed ti/Vi inside one screen.** The login screen greets with *"Dobro došao."* — informal, and
  masculine only — while its own fields say *"Unesite lozinku"* and its button says *"Prijavite se"*,
  both formal. This is direct evidence for the ti/Vi decision left open in PKG-011B. The masculine
  greeting is a separate point: it addresses half the audience.
- **The signup form shows its call to action before its required fields.** `Napravite nalog` sits
  under Ime, Prezime, Grad and Email, while password, password confirmation and the consent checkbox
  — all of which `src/app/auth.tsx` requires — are below the fold with nothing indicating more
  follows.
- **`Napravi nalog` is clipped at the bottom edge of the entry screen** on this device.
- **Two different screens are both titled "Zadaci".** The bottom-nav tab labelled *Mapa* opens a
  screen titled *Zadaci* with a Lista/Mapa switch showing other people's tasks; the tab labelled
  *Zadaci* opens a screen also titled *Zadaci*, with Aktivni/Nacrti/Istorija, showing your own.

## D. What came out clean

The icon renders as the canonical mark on the launcher, in the app header and in the signup sheet.
Dogovori correctly shows zero. Aktivni zadaci correctly shows zero, because the owner's only need is a
DRAFT. The notification tabs give a consistent empty state. The filter sheet and the profile screens
render correctly, and the bottom navigation changes to `Prijave | Mapa | Dogovori` in JA MOGU, which is
the intended role behaviour.

## E. Where these belong

A1 and A2 are auth/profile engine defects and do not belong to PKG-017. A3's banner claim belongs with
the discovery surface. A5 belongs with notifications. B is GAP-0042 and already has PKG-015B.

None of them was introduced by PKG-016 or PKG-017, and none is fixed here — they are recorded, with
their proof, for the owner to schedule.
