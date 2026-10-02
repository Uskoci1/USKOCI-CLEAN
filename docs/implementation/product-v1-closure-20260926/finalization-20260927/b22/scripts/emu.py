#!/usr/bin/env python3
"""Emulator driver (owner direction 2026-10-02: everyday native QA runs on the Android emulator USKOCI_V5_TEST, the HONOR only on his word "sad").
Reuses the ui.py helpers with the emulator serial and the emulator geometry.

Emulator geometry: 1080x2424 physical, `wm density 480` (= 360 dp wide), font scale 1.15, time zone Europe/Belgrade (set with `cmd alarm set-timezone`).
Taps, swipes, Back and reads only; screenshots go to a directory OUTSIDE the repository (they show the owner's test account and must never be committed):
  $USKOCI_EMU_SHOTS or <system temp>/uskoci_emu_shots.
Never `pm clear`, never sign out, no text input here (the owner signs in himself); never import the P6 journey driver (it pm-clears the app).

Traps met on 2026-10-02 (see docs/implementation/product-v1-closure-20260926/finalization-20260927/b22/B22_REANIMATED_PATCH_20261002.md section 9):
- A System UI "Application Not Responding" dialog under host load is dismissed by tapping "Wait" (about x321 y1383): dismiss_anr().
- Check mCurrentFocus before every screenshot (focus_ok()): a notification shade can sit over the app while topResumedActivity still reports it.
- The bottom bar is a fixed band; tab() taps by position, never by label ("Zadaci" would also match "Moji zadaci").
usage: emu.py inv | shot NAME | tab Pocetna|Zadaci|Dogovori"""
import os, re, subprocess, sys, tempfile, time
from pathlib import Path
import ui

ui.SERIAL = 'emulator-5554'
SHOTS = Path(os.environ.get('USKOCI_EMU_SHOTS') or (Path(tempfile.gettempdir()) / 'uskoci_emu_shots'))
SHOTS.mkdir(parents=True, exist_ok=True)
W, H = 1080, 2424


def swipe(direction, ms=350):
    ui.guard()
    x = int(W * 0.5)
    y1, y2 = (int(H * 0.72), int(H * 0.32)) if direction == 'up' else (int(H * 0.32), int(H * 0.72))
    ui.adb('shell', 'input', 'swipe', str(x), str(y1), str(x), str(y2), str(ms))


ui.swipe = swipe


def shot(name):
    p = SHOTS / (name + '.png')
    p.write_bytes(ui.adb('exec-out', 'screencap', '-p', raw=True))
    return p


def dismiss_anr():
    out = ui.adb('shell', 'dumpsys window | grep mCurrentFocus')
    if 'Application Not Responding' in out:
        ui.adb('shell', 'input', 'tap', '321', '1383')
        time.sleep(2)
        return True
    return False


def focus_ok():
    return 'rs.uskoci.dev/rs.uskoci.dev.MainActivity' in ui.adb('shell', 'dumpsys window | grep mCurrentFocus')


def tap_label(prefix, wait=2.5, nth=0, exact=False):
    root = ui.dump()
    n = ui.find(root, prefix, exact=exact, nth=nth)
    if not n:
        return False
    ui.tap((n['b'][0] + n['b'][2]) // 2, (n['b'][1] + n['b'][3]) // 2)
    time.sleep(wait)
    return True


def tab(name, wait=3.0):
    """Tap a bottom-bar tab by its position (the bar is a fixed band at the bottom)."""
    x = {'Pocetna': 150, 'Zadaci': 540, 'Dogovori': 930}[name]
    ui.guard()
    ui.adb('shell', 'input', 'tap', str(x), '2300')
    time.sleep(wait)


def back(wait=1.8):
    ui.guard()
    ui.adb('shell', 'input', 'keyevent', '4')
    time.sleep(wait)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'inv'
    dismiss_anr()
    if cmd == 'inv':
        print('\n'.join(ui.inv()))
    elif cmd == 'shot':
        print(shot(sys.argv[2]))
    elif cmd == 'tab':
        tab(sys.argv[2])
        print(shot('tab_' + sys.argv[2]))
