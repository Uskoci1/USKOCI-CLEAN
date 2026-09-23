# Round 1 critique — build d7152e9f on the emulator

Two separate critics (flow and look) read the round-1 emulator captures (`R1_SCREENS.png`, `R1_WIDTHS_AND_TEXT.png`)
against `USKOCI_MASTER_PLAN_DIZAJNA.md` and the owner's rules. Verdict: no screen is finished; each needs another loop in
its own step. Items are routed to the owner's 12-step order; "done in" is filled when a later commit closes one.

## Process corrections (applied immediately)

- **Time zone.** The emulator ran in Europe/Warsaw, so every time carried "(po vremenu u Srbiji)", which a phone in
  Serbia never shows; that skewed wraps on Dogovori and the cards. The emulator is now Europe/Belgrade (system
  settings, 2026-09-24). One separate pass in another zone keeps the diaspora case honest.
- **Coverage.** Zadaci at 320 dp and font 1.3 was not captured (the density change reset to Početna); Moji zadaci,
  Moje prijave, a Dogovor after rating, first-run Home, error states and long names still need captures (step 12).
- **Font scale.** Android reports its Large setting as 1.2999999523, so `fontScale >= 1.3` never fires there
  (Početna tiles, candidate comparison). Fixed with the round-2 integration.

## Flow (UX)

| # | Screen | Finding | Fix | Sev. | Step |
| --- | --- | --- | --- | --- | --- |
| A1 | Početna | "Čeka te" opens the Dogovori list, four taps from the rating | one due → `/oceni-dogovor`; more → Dogovori; verb first: "Oceni završen Dogovor" / "Oceni 2 završena Dogovora" | major | 3 |
| A2 | Dogovori | the "Oceni saradnju" strip looks like a button but opens the Dogovor | own Press to `/oceni-dogovor`, label "Oceni saradnju, <naslov>" | major | 8 |
| A3 | Dogovori | a finished Dogovor without a time says "Termin nije potvrđen" | finished/cancelled: "Bez tačnog termina" | major | 8 |
| A4 | all | initials computed four ways ("MI" vs "M" vs "MS"); a missing name invents letters | one `inicijali()` + one Avatar; no name → person glyph | major | 2 |
| A5 | Zadaci | Lista/Mapa toggle plus "Pogledaj listu": three controls for one idea | the list sheet replaces both | major | 4 |
| A6 | Zadaci | 4 of 6 tasks have no pin; only a footnote says so | sheet opens half when ≥ half lack a pin or ≤ 3 tasks; unpinned tasks are listed | major | 4 |
| A7 | Zadaci | "2 tvoja zadatka su sakrivena · Prikaži" contradicts the IA | remove it and the toggle | minor | 4 |
| A8 | cards | offer tasks leave the value slot empty | slot always filled: amount, or "Tražim ponude" as a muted label | major | 5 |
| A9 | cards | requirement chip cut mid-word | a fact line with the vehicle art, two lines max | major | 5 |
| A10 | cards | price basis said three ways | cards "ukupno" / "po osobi"; the sentence on the detail | minor | 5 |
| A11 | Dogovori | "Svi" tab and "2 Dogovora" repeat counts | Aktivni and Istorija only; no count line | minor | 8 |
| A12 | Dogovori | four header elements (calendar) | calendar moves to the tab row as a quiet icon | minor | 3 |
| A13 | Dogovor | person, status and "1 osoba" said two or three times | 1:1 drops the participants block; "osoba" hidden at 1; status once | major | 8 |
| A14 | Dogovor | link rows explain themselves | "Zadatak", "Tvoja prijava", no subtitles | minor | 8 |
| A15 | Kalendar | finished and requester-side work missing; empty day untrue | merge every timed Dogovor ("Uskačeš" / "Tvoj zadatak"), finished muted | major | 10 |
| A16 | Kalendar | orange day dot, "Otvori sve Dogovore" duplicates Back, heading | green dot; remove the button; "Četvrtak, 24. sep" | minor | 10 |
| A17 | Dostupnost | "Mogu odmah" is a switch that applies only on Save | form semantics or save on toggle; unsaved guard on Back | major | 10 |
| A18 | Dostupnost | a week is seven separate "+" flows | "Isto za sve radne dane", "Kopiraj na…" | major | 10 |
| A19 | Dostupnost | subtitle explains the screen | delete; zone line only outside Serbia | minor | 10 |

## Look (visual)

| # | Screen | Finding | Fix | Sev. | Step |
| --- | --- | --- | --- | --- | --- |
| B1 | Početna, Dogovori | orange budget blown (bell glyph, tile, strip border, card borders and footers) | one orange fill per screen plus dots/badges; green bell glyph; attention cards on hairline, orange dot, warn text | major | 2, 3, 8 |
| B2 | chrome | five icon-button shapes | one IconButton: 44 circle (48 hit), surface, 1px line, Phosphor 22 ink; Back is the same | major | 2 |
| B3 | Početna | lone "i" in "Uskoči i zaradi", uneven tile wraps at 360 | art above title (28), 18/22 title, 14/18 hint, flex-start, no-break "i zaradi", hint "Nađi posao blizu" | major | 3 |
| B4 | Početna 320 | stacked tiles waste height; last row under the bar | stacked tile as a 72 dp row; bottom padding clears the bar | minor | 3 |
| B5 | cards | border and shadow together | list cards: hairline, no shadow; shadows only on floating layers | minor | 2 |
| B6 | tokens | radius 16/17 near-duplicates | scale 12 / 24 / 28 / pill | minor | 2 |
| B7 | tab bar | two inactive greys; label touches the capsule at 1.3 | one muted icon treatment; labels 13/16, max multiplier 1.2; capsule inset 4 | minor | 3 |
| B8 | Zadaci | "Pretraži ovu oblast" full-width, reads as the primary | auto-width pill 40–44, centred under the tools | minor | 4 |
| B9 | Zadaci | attribution slab is the heaviest text on the map | 12 px muted with a halo, no slab, multiplier 1 (keep OSM attribution visible) | minor | 4 |
| B10 | Zadaci | pins carry no information | price-pill pins; offers "Ponude" muted, never money-styled; selected green | major | 4 |
| B11 | Zadaci | two floating zoom squares | one 44×88 capsule above the sheet | polish | 4 |
| B12 | Zadaci | filled orange "+" is the loudest control | same IconButton as the filter, orange glyph | minor | 4 |
| B13 | cards | card anatomy wraps unpredictably | fixed lines: title + value slot, place, time, requirement | major | 5 |
| B14 | cards | title squeezed by the basis note | short basis note | minor | 5 |
| B15 | Dogovori | date broken over three lines | date line full width; zone note on its own muted line | major | 8 |
| B16 | Dogovori | two arrows per card | drop the caret; the strip keeps its arrow | minor | 8 |
| B17 | Dogovor | fact block takes 20% of the screen | art 24, 36 dp rows, 17/22 | minor | 8 |
| B18 | Kalendar | three boxes for nothing on an empty day | unfilled day chips; one muted line; availability as a plain row | minor | 10 |
| B19 | Dostupnost | card bottom gap, default teal switch thumb, "Nema redovnih termina" ×7 | even 16 padding; white thumb; 56 dp rows with slots or a quiet "Dodaj" | minor | 10 |
| B20 | Početna | spacing without rhythm | section 32, title→content 8, rows ≥ 64 | polish | 3, 12 |

## Five highest-value changes

1. Rating in one tap and truthful (A1–A4).
2. The Zadaci IA for real: the sheet replaces the toggle, starting height by pin coverage, price pins, no own-tasks
   line (A5–A7, B10).
3. One card rule for Zadaci and Dogovori (A8–A10, B13–B15).
4. Orange budget and one IconButton (B1, B2, B12, A12).
5. Kalendar and Dostupnost honest (A15, A17, A18).
