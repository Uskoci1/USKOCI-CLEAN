# USKOČI device walkthroughs (Maestro)

These flows **look**; they do not act. Nothing here sends an offer, cancels a Dogovor, blocks a person,
writes a message or deletes anything. They open screens on a real phone that is already signed in, and take
screenshots, so that a control-table row can say "seen on this build" instead of "not proven".

Any flow that would change real data is out of scope and stays out of scope: the owner's account is a real
account on canonical DEV.

## Prerequisites

- the phone connected over USB with debugging on (`adb devices` shows it);
- the development APK of the exact commit under test installed (`rs.uskoci.dev`);
- the person already signed in on that phone. **Nothing here signs in**: no password is typed, read or
  stored, and a signed-out phone simply ends the flow at the entry screen.

## Running

```bash
maestro test .maestro/walkthrough.yaml
```

Screenshots land in `~/.maestro/tests/<timestamp>/`. Copy the ones that matter into the package's evidence
folder and name the build they came from; a screenshot without its commit proves nothing.

## Selectors

The app carries few `testID`s today, so these flows select by the Serbian text a person actually reads.
That is stable while the copy is stable and it breaks loudly when the copy changes, which is the honest
trade for now. When a screen gets a `testID`, prefer it here.

## Files

| file | what it walks |
| --- | --- |
| `walkthrough.yaml` | the main read-only pass: entry → Početna → Zadaci/Mapa → a Zadatak → Dogovori → a Dogovor (overview, the new source rows, Poruke tab) → Obaveštenja → Profil |
| `flows/open-tab.yaml` | sub-flow: open a bottom-navigation tab by its label |
