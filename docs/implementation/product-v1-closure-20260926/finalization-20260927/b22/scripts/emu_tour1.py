#!/usr/bin/env python3
"""Emulator tour 1 (read-only navigation, no text input, no state change): the main screens of a DEV build on the emulator USKOCI_V5_TEST,
for a UX and a VISUAL critique. Writes <shots dir>/t1_*.png and <shots dir>/emu_tour1.json (the shots dir is outside the repository, see emu.py).
It was run once on UI wave-1 build 1f909660 on 2026-10-02 (critique: docs/implementation/ui-ux-pass-20261002/EMULATOR_CRITIQUE_W1_20261002.md).
Run it from this directory: python emu_tour1.py  (the emulator must be booted, the app installed and signed in by the owner)."""
import json, time
import emu, ui

OUT = {'steps': {}, 'inv': {}}


def settle(wait=2.5):
    time.sleep(wait)
    emu.dismiss_anr()


def snap(name, wait=0.0):
    if wait:
        settle(wait)
    emu.dismiss_anr()
    if not emu.focus_ok():
        OUT['steps'][name] = 'NO FOCUS'
        return
    emu.shot('t1_' + name)
    OUT['inv'][name] = ui.inv()[:60]
    OUT['steps'][name] = 'ok'


def go_home():
    for _ in range(4):
        root = ui.dump()
        sel = [n for n in ui.nodes(root) if n['sel'] == 'true' and ui.label(n) == 'Početna']
        if sel:
            return True
        emu.back(1.2)
    emu.tab('Pocetna', 2.5)
    return True


def step(name, fn):
    try:
        fn()
    except SystemExit:
        OUT['steps'][name] = 'STOP guard'
        raise
    except Exception as e:  # noqa
        OUT['steps'][name] = 'ERROR ' + repr(e)[:160]


emu.dismiss_anr()
go_home()
step('home_top', lambda: snap('01_home_top', 1.0))
step('home_scrolled', lambda: (ui.swipe('up'), settle(1.5), snap('02_home_scrolled')))
step('home_back_top', lambda: (ui.swipe('down'), settle(1.2)))

# Zadaci
step('zadaci', lambda: (emu.tab('Zadaci', 4.0), snap('03_zadaci')))
step('zadaci_full_list', lambda: (emu.tap_label('zadataka', 2.5), snap('04_zadaci_list_full', 1.0)))
step('zadaci_card_open', lambda: (emu.tap_label('Otvori priliku', 3.0), snap('05_zadaci_detail', 1.0)))
step('zadaci_detail_scrolled', lambda: (ui.swipe('up'), settle(1.2), snap('06_zadaci_detail_scrolled')))
step('zadaci_back1', lambda: emu.back(2.0))
step('zadaci_back2', lambda: emu.back(2.0))

# Dogovori
step('dogovori', lambda: (emu.tab('Dogovori', 3.5), snap('07_dogovori')))
step('dogovor_open', lambda: (emu.tap_label('Krečenje', 3.5), snap('08_dogovor_workspace', 1.0)))
step('dogovor_scrolled', lambda: (ui.swipe('up'), settle(1.2), snap('09_dogovor_scrolled')))
step('dogovor_back', lambda: emu.back(2.0))
step('dogovori_istorija', lambda: (emu.tap_label('Istorija', 2.5), snap('10_dogovori_istorija')))

# Home -> Moji zadaci, Moje prijave, profil, obavestenja
go_home()
step('moji_zadaci', lambda: (ui.swipe('up'), settle(1.2), emu.tap_label('Moji zadaci', 3.0), snap('11_moji_zadaci', 1.0)))
step('moji_zadaci_open', lambda: (emu.tap_label('Otvori', 3.0), snap('12_moj_zadatak_pregled', 1.0)))
step('moj_zadatak_scrolled', lambda: (ui.swipe('up'), settle(1.2), snap('13_moj_zadatak_scrolled')))
go_home()
step('moje_prijave', lambda: (ui.swipe('up'), settle(1.2), emu.tap_label('Moje prijave', 3.0), snap('14_moje_prijave', 1.0)))
go_home()
step('profil', lambda: (ui.swipe('down'), settle(1.0), emu.tap_label('Moj profil', 3.0), snap('15_profil_hub', 1.0)))
go_home()
step('obavestenja', lambda: (emu.tap_label('Obaveštenja', 3.0), snap('16_obavestenja', 1.0)))
go_home()
OUT['final'] = {'gfx': ui.gfx(), 'fg': ui.fg(), 'font': ui.adb('shell', 'settings', 'get', 'system', 'font_scale').strip()}
json.dump(OUT, open(str(emu.SHOTS / 'emu_tour1.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(OUT['steps'], ensure_ascii=False))
print(OUT['final'])
