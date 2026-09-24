import pathlib, subprocess, sys, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
ROOT = pathlib.Path(__file__).resolve().parent
ADB = ['C:/Users/user/AppData/Local/Android/Sdk/platform-tools/adb.exe', '-s', 'emulator-5554']
def require_app():
    state = subprocess.check_output(ADB + ['shell', 'dumpsys', 'activity', 'activities'], text=True, encoding='utf-8')
    if not any('rs.uskoci.dev/' in line for line in state.splitlines() if 'topResumedActivity=' in line):
        raise SystemExit('USKOCI not foreground; no UI collected')
require_app()
if len(sys.argv) > 3 and sys.argv[1] == 'tap':
    subprocess.run(ADB + ['shell', 'input', 'tap', sys.argv[2], sys.argv[3]], check=True)
    sys.argv = [sys.argv[0]] + sys.argv[4:]
require_app()
subprocess.run(ADB + ['shell', 'uiautomator', 'dump', '/sdcard/uskoci-audit-ui.xml'], check=True, capture_output=True)
raw = subprocess.check_output(ADB + ['shell', 'cat', '/sdcard/uskoci-audit-ui.xml'])
require_app()
tree = ET.fromstring(raw)
for node in tree.iter('node'):
    if node.get('package') == 'rs.uskoci.dev' and (node.get('text') or node.get('content-desc')):
        print((node.get('text'), node.get('content-desc'), node.get('bounds')))
if len(sys.argv)>1:
    require_app()
    pixels = subprocess.check_output(ADB + ['exec-out', 'screencap', '-p'])
    require_app()
    (ROOT / pathlib.Path(sys.argv[1]).name).write_bytes(pixels)
