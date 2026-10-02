# B22 measurement scripts (frozen evidence artefacts, 2026-10-02)

`window4_baseline.py` (one `adb install -r` + the list routine) and `window5_tour.py` (the read-only screen tour) with the helpers they import (`ui.py`, `ex04_boundary.py`, `ex04_boundary3.py`). They are evidence of HOW the numbers were produced, not reusable tooling: they hardcode the serial of the owner's phone. Rules they obey: taps, swipes, Back and reads only (plus the one install in window 4), a foreground guard before every input, a hard time budget, a stop when a call is in progress. The AFTER measurement must run `window5_tour.py` UNCHANGED on the patched build.

## Emulator drivers (added 2026-10-02, reusable)

`emu.py` and `emu_tour1.py` drive the Android emulator `USKOCI_V5_TEST` (owner direction 2026-10-02: everyday native QA runs on the emulator; the HONOR only on his word "sad"). They reuse `ui.py` with the emulator serial `emulator-5554` and the emulator geometry (1080x2424, `wm density 480` = 360 dp, font scale 1.15, time zone Europe/Belgrade). Same rules as above: taps, swipes, Back and reads only, no text input, never `pm clear`, never sign out, never import the P6 journey driver. Screenshots go OUTSIDE the repository (`$USKOCI_EMU_SHOTS` or the system temp folder) because they show the owner test account.

- `python emu.py inv | shot NAME | tab Pocetna|Zadaci|Dogovori` (run from this directory).
- `python emu_tour1.py` takes the 16 screenshots of the wave-1 critique (critique: `docs/implementation/ui-ux-pass-20261002/EMULATOR_CRITIQUE_W1_20261002.md`).
- The B22 probes P1 (sheet spring), P2 (Mapa pill exit) and P4 (pin peek) are NOT run yet: protocol in `B22_REANIMATED_PATCH_20261002.md` section 9; run them on the emulator when the machine is quiet and label the numbers AVD, never mix them with phone numbers.
- Traps: a System UI ANR dialog under load is dismissed with "Wait" (`dismiss_anr()`); check `mCurrentFocus` before every screenshot (`focus_ok()`); tabs are tapped by position, never by label ("Zadaci" also matches "Moji zadaci").
