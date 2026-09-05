#!/usr/bin/env bash
set -euo pipefail

PKG='rs.uskoci.visualproofall'
OUT='visual-all'
mkdir -p "$OUT"

adb install -r "$OUT/USKOCI-ALL-SCREENS.apk"
adb shell wm size 1080x2400
adb shell wm density 420

capture_current() {
  local name="$1"
  sleep 4
  adb exec-out screencap -p > "$OUT/${name}.png"
  adb shell uiautomator dump "/sdcard/${name}.xml" >/dev/null 2>&1 || true
  adb pull "/sdcard/${name}.xml" "$OUT/${name}.xml" >/dev/null 2>&1 || true
  adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | tail -4 >> "$OUT/crawl.log" 2>&1 || true
  printf '%s\n' "CAPTURED $name" | tee -a "$OUT/crawl.log"
}

open_route() {
  local name="$1"
  local uri="$2"
  printf '%s\n' "=== $name :: $uri ===" | tee -a "$OUT/crawl.log"
  adb shell am start -W -a android.intent.action.VIEW -d "$uri" -p "$PKG" >> "$OUT/crawl.log" 2>&1 || true
  capture_current "$name"
}

# Launch the real native app. The proof-only session keeps protected routes open.
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >> "$OUT/crawl.log" 2>&1
capture_current '01-requester-home'

open_route '02-potrebe' 'uskociapp:///potrebe'
open_route '03-nova-ai' 'uskociapp:///nova'
open_route '04-pregled-nacrta' 'uskociapp:///pregled-nacrta?conversationId=visual-proof-conversation'
open_route '05-prijave-kandidata' 'uskociapp:///prijave'
open_route '06-potreba-pregled' 'uskociapp:///potrebe/ormar/pregled'
open_route '07-kandidati' 'uskociapp:///potrebe/ormar/kandidati'
open_route '08-dogovori-requester' 'uskociapp:///dogovori'
open_route '09-dogovor-requester' 'uskociapp:///dogovor/d-1'
open_route '10-profil-requester' 'uskociapp:///profil'

# Switch role through the real Profile UI control, not by mutating runtime state externally.
adb shell uiautomator dump /sdcard/profile-switch.xml >/dev/null 2>&1
adb pull /sdcard/profile-switch.xml "$OUT/profile-switch.xml" >/dev/null 2>&1
python3 <<'PY'
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

path = 'visual-all/profile-switch.xml'
root = ET.parse(path).getroot()
match = None
for node in root.iter('node'):
    hay = (node.attrib.get('content-desc', '') + ' ' + node.attrib.get('text', '')).strip()
    if 'Pređi u prostor Uskočera' in hay or 'Predji u prostor Uskocera' in hay:
        match = node
        break
if match is None:
    print('ROLE_SWITCH_NODE_NOT_FOUND', file=sys.stderr)
    sys.exit(2)
bounds = match.attrib.get('bounds', '')
m = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds)
if not m:
    print(f'ROLE_SWITCH_BOUNDS_INVALID: {bounds}', file=sys.stderr)
    sys.exit(3)
x1, y1, x2, y2 = map(int, m.groups())
subprocess.check_call(['adb', 'shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2)])
print(f'ROLE_SWITCH_TAPPED {bounds}')
PY
capture_current '11-worker-home'

open_route '12-moje-prijave' 'uskociapp:///moje-prijave'
open_route '13-prilike' 'uskociapp:///prilike'
open_route '14-prilika-detalj' 'uskociapp:///prilike/ormar'
open_route '15-prijava-na-priliku' 'uskociapp:///prilike/ormar/prijava'
open_route '16-profil-radnika' 'uskociapp:///profil/radnik'
open_route '17-dogovori-worker' 'uskociapp:///dogovori'
open_route '18-dogovor-worker' 'uskociapp:///dogovor/d-1'
open_route '19-profil-worker' 'uskociapp:///profil'

adb logcat -d > "$OUT/logcat.txt" || true
adb shell dumpsys window > "$OUT/window-dumpsys.txt" || true
