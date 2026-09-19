# The one measure, the one register — 2026-09-18

Owner instruction, in his order: first the type sizes and the corner radii ("to pogađa svih 48
ekrana odjednom"), then Profil, then Prijava. This records what the first two did, what the numbers
were before and after, and what was deliberately left alone.

## Before

Measured on the branch head at `ca425aa~1`, over `src/ui` and `src/app`:

| | Before | After |
| --- | --- | --- |
| Raw hex colours | 169 | 132, almost all definitions and locked artwork |
| Distinct raw `fontSize` values | 18 | the scale only, outside auth and the entry art |
| Distinct raw `borderRadius` values | 27 | the scale only, outside auth and the entry art |
| Radius scales in the repository | 2 that disagree, plus 2 alias views | 1 |

The two radius scales were `theme/tokens.radius` (8/12/16/20) and `sys.radius`
(9/13/16/17/18/22/28). Corners that nearly agree are worse than corners that differ: nothing lines
up and nothing looks deliberate.

## What the scale now says

`theme/tokens.ts` holds the one radius scale, named by role: `badge` 9, `chip` 13, `control` 16,
`primary` 17, `cardCompact` 18, `card` 22, `sheet` 28, `pill` 999. `sys.radius` is a view onto it.
The `aiFirst` and `v2` token modules no longer carry a radius of their own.

Two rules replaced the loose numbers:

- **A circle or a capsule is `pill`, never half of its own width.** A 44px control with radius 22, a
  6px dot with radius 3 and a 40x4 sheet handle with radius 2 were three ways of writing the same
  idea; they now say the same thing and cannot drift when a size changes.
- **A segment inside a padded track is `nested(track, padding)`.** An inner corner that ignores its
  padding does not follow the outer one; the segmented control and the role switch both had a
  hand-picked number for it.

For type, three screens had each written out `28/33/-0.8` on top of `hero`. That is not drift, it is
a role the scale was missing, so it exists: `pageTitle`, the name of what a screen is about. So do
`speech` (a sentence read as speech in the conversation), `tab`, `cardTitleCompact`, `priceLarge`,
`priceSmall` and `monogram`. Each was lifted from what the screens already agreed on.

Two defects fell out of the sweep rather than being looked for:

- the map's tile attribution rendered at **10px**, below the 12px minimum `theme/tokens.ts` sets for
  anything carrying meaning; it is now `label` at 12;
- the same 96px avatar wrote its letter at **36px** on the public profile sheet and **30px** on the
  work profile. Both are `monogram`. The three 96px avatars also disagreed on shape — two rounded
  squares and one circle — and are now all rounded squares.

## Profil

The hub asked to be read in two registers at once: rows saying "Tvoji Dogovori" and "Ime koje
prikazuješ" next to buttons saying "Uredite" and "Odjavite se".

Three of its six account rows carried the same `ShieldCheck`, which is the same as carrying none,
and the two rows under "USKOČI" carried no icon at all, so their text began at a different x than
every other row on the screen. Every row now has an icon that means something, and the six-row block
is now "Nalog" (what you are) and "Privatnost" (what others see and what leaves the app).

## The register

977 lines across 104 source files and 54 test files moved from "Vi" to "ti".

A word rule alone gets Serbian wrong, so this took three passes:

1. the imperative is the plural minus `te` — `Proverite` → `Proveri` — which is safe and covers most
   of it;
2. `da biste <participle>` is not an imperative at all but `da <2nd person singular>`, so
   `Prijavi se da biste nastavili` is `Prijavi se da nastaviš`. 40 error maps carried that sentence;
3. **a past participle after `ste` carries grammatical gender.** `Ako ste dobili poruku` must not
   become `Ako si dobio poruku`: that addresses every woman using the app as a man. Those sentences
   were rewritten to have no gender — `Već ste ocenili ovaj Dogovor` → `Ovaj Dogovor je već ocenjen`,
   `Prijavili ste vi` → `Prijava je tvoja`, and `kada budeš spremni` was simply removed.

Every rewritten sentence was read back; the automatic pass left seven half-converted sentences
(`Možeš da nastavi`, `ne možeš da objavite`, `Potvrdi ili ispravite`), which are fixed.

## Left alone, deliberately

- **The V4.9 entry composition and its brand copy.** The sweep changed the slogan
  `Čovek tamo gde Vi niste` and it was restored byte for byte. AGENTS.md locks this.
- **The auth sheet.** Its dark palette (`ui/auth/authTheme.ts`) is a designed second surface, not
  drift — its orange is already the system orange. Its own raw sizes and radii stay until the owner
  decides on the sheet, which is his third item and still an open decision from PKG-011B.
- **The inbox fixtures** that mirror notification titles the server sends.

## Proof

Typecheck clean. Full suite 227 of 228 suites, 4385 tests. The single failure,
`pkg003-manual-entry-source`, is the known local CRLF artifact and fails identically with these
changes stashed.

Commits: `f493453` (corners), `230309a` (sizes), `731b0e0` (Profil), `8d14a20` (register).
