#!/usr/bin/env python3
"""Which Android device a QA script talks to (local runs): one small shared piece, no hard-coded serial.

Owner direction (2026-09-30): the physical HONOR phone is the PRIMARY local Android QA device where that is technically safe and sensible, the AVD
(USKOCI_V5_TEST) the secondary / regression device, the disposable CI journey stays for checkpoint proofs, and later two devices run ONE end-to-end
scenario together (phone = person A, emulator = person B, two separate test accounts). This module is what every local QA script uses to

  * choose a device explicitly (`--serial`, `QA_SERIAL` / `ANDROID_SERIAL`, or by kind), never by a default that names one device,
  * describe it (model, Android, ABI, screen, refresh rate, memory, battery, temperature, the installed build's version and APK hash),
  * read its screen and its log WITHOUT changing anything on it: the UI tree comes out over stdout (no file on the phone), the log is streamed to a
    local file (no `logcat -c`, no `logcat -G`, no setting changed), and only the app's own uid is kept, so nothing of any other app is saved.

It sends no input by itself; scripts do that through `Device.adb(...)`. It never clears app data, uninstalls, installs or changes a device setting.
`python scripts/qa_device.py --selftest` checks the parsing and the choice rules without a device; `python scripts/qa_device.py --list` prints what is attached.
"""
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ADB_BIN = os.environ.get('ADB', 'adb')


class DeviceError(RuntimeError):
    pass


def _run(args, timeout=60):
    return subprocess.run(args, capture_output=True, timeout=timeout).stdout


def parse_devices(text):
    """`adb devices -l` -> [{serial, state, model, product, kind}]. An emulator has an `emulator-NNNN` serial or an `sdk_*` / `emu*` product."""
    found = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(('List of devices', '*')):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        info = dict(p.split(':', 1) for p in parts[2:] if ':' in p)
        product = info.get('product', '')
        emulator = parts[0].startswith('emulator-') or product.startswith(('sdk_', 'emu'))
        found.append({'serial': parts[0], 'state': parts[1], 'model': info.get('model', ''), 'product': product, 'kind': 'emulator' if emulator else 'physical'})
    return found


def list_devices():
    return parse_devices(_run([ADB_BIN, 'devices', '-l'], 30).decode('utf-8', 'replace'))


def describe(devices):
    return ', '.join(f"{d['serial']} ({d['kind']}, {d['model'] or d['product'] or '?'}, {d['state']})" for d in devices) or 'none'


def pick(serial=None, prefer=None, devices=None, environ=None):
    """The one device to use. Order: an explicit serial, `QA_SERIAL` / `ANDROID_SERIAL`, the only attached device of the wanted kind (`prefer`
    'physical' | 'emulator'), the only attached device. Anything ambiguous or missing is an error that lists what is attached."""
    environ = os.environ if environ is None else environ
    devices = list_devices() if devices is None else devices
    want = serial or environ.get('QA_SERIAL') or environ.get('ANDROID_SERIAL')
    if want:
        for d in devices:
            if d['serial'] == want:
                if d['state'] != 'device':
                    raise DeviceError(f"{want} is attached but its state is '{d['state']}' (authorise USB debugging on the device); attached: {describe(devices)}")
                return d
        raise DeviceError(f'{want} is not attached; attached: {describe(devices)}')
    ready = [d for d in devices if d['state'] == 'device']
    if prefer == 'auto':                                       # the physical phone is the primary local device, the emulator the fallback
        physical = [d for d in ready if d['kind'] == 'physical']
        if len(physical) == 1:
            return physical[0]
        if physical:
            raise DeviceError(f'{len(physical)} physical devices attached: choose one with --serial; attached: {describe(devices)}')
        prefer = 'emulator'
    if prefer in ('physical', 'emulator'):
        of_kind = [d for d in ready if d['kind'] == prefer]
        if len(of_kind) == 1:
            return of_kind[0]
        raise DeviceError(f'expected exactly one {prefer} device, found {len(of_kind)}; attached: {describe(devices)}')
    if len(ready) == 1:
        return ready[0]
    raise DeviceError(f'{len(ready)} devices attached: choose one with --serial or --device physical|emulator; attached: {describe(devices)}')


def wm_size(text):
    """`wm size` output -> (width, height); an override (a person's own setting) is what the screen really shows."""
    override = re.search(r'Override size:\s*(\d+)x(\d+)', text)
    physical = re.search(r'Physical size:\s*(\d+)x(\d+)', text)
    m = override or physical
    return (int(m.group(1)), int(m.group(2))) if m else None


def refresh_rate(display_dump):
    """The active refresh rate the display service reports (`mActiveSfDisplayMode ... vsyncRate=90.0`) and the modes it supports, or (None, [])."""
    active = re.search(r'mActiveSfDisplayMode=DisplayMode\{[^}]*?vsyncRate=([\d.]+)', display_dump)
    supported = re.search(r'mSupportedRefreshRates=\[([^\]]*)\]', display_dump)
    rates = [round(float(x)) for x in supported.group(1).split(',') if x.strip()] if supported else []
    return (round(float(active.group(1))) if active else None), rates


class Device:
    def __init__(self, target, adb_bin=None):
        info = target if isinstance(target, dict) else {'serial': target, 'kind': None, 'model': '', 'product': '', 'state': 'device'}
        self.serial, self.info, self.adb_bin = info['serial'], info, adb_bin or ADB_BIN
        self._kind = info.get('kind')

    @property
    def prefix(self):
        return [self.adb_bin, '-s', self.serial]

    @property
    def kind(self):
        if self._kind is None:
            self._kind = 'emulator' if self.serial.startswith('emulator-') or self.getprop('ro.kernel.qemu') == '1' else 'physical'
        return self._kind

    def adb(self, *args, timeout=120):
        return subprocess.run(self.prefix + list(args), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout).stdout

    def adb_bytes(self, *args, timeout=90):
        return subprocess.run(self.prefix + list(args), capture_output=True, timeout=timeout).stdout

    def shell(self, command, timeout=60):
        return self.adb('shell', command, timeout=timeout)

    def getprop(self, name):
        return self.adb('shell', 'getprop', name).strip()

    def clock(self):
        """The device's own wall clock, 'MM-DD HH:MM:SS.mmm' (the clock its log lines use)."""
        return self.adb('shell', 'date "+%m-%d %H:%M:%S.%N"').strip()[:18]

    def foreground(self):
        """(package, activity) of the app that has the screen right now, or None (a locked or dark screen, the launcher's own name when no app is in front). The grep runs on the
        device, so only one line comes back."""
        out = self.adb('shell', 'dumpsys activity activities | grep -m1 topResumedActivity', timeout=30)
        m = re.search(r'topResumedActivity=ActivityRecord\{\S+ u\d+ ([\w.$]+)/(\S+?)[\s}]', out)
        return (m.group(1), m.group(2)) if m else None

    def now_iso(self):
        """The device's own wall clock with the year, 'YYYY-MM-DD HH:MM:SS' (the clock `dumpsys activity exit-info` stamps its records with)."""
        return self.adb('shell', 'date "+%Y-%m-%d %H:%M:%S"').strip()

    def screen_size(self):
        return wm_size(self.adb('shell', 'wm', 'size'))

    def uia_dump(self):
        """The UI tree as XML text. It comes out over stdout, so no file is written on the device; a device without `/dev/tty` support falls back to a
        temporary file that is removed at once."""
        raw = self.adb('exec-out', 'uiautomator', 'dump', '/dev/tty', timeout=90)
        start = raw.find('<hierarchy')
        if start >= 0 and '</hierarchy>' in raw:
            return raw[start:raw.index('</hierarchy>') + len('</hierarchy>')]
        self.adb('shell', 'uiautomator', 'dump', '/sdcard/qa_ui.xml')
        raw = self.adb('exec-out', 'cat', '/sdcard/qa_ui.xml')
        self.adb('shell', 'rm', '-f', '/sdcard/qa_ui.xml')
        return raw[raw.index('<hierarchy'):]

    def screenshot_png(self):
        return self.adb_bytes('exec-out', 'screencap', '-p')

    def package_info(self, package):
        dump = self.adb('shell', 'dumpsys', 'package', package, timeout=90)

        def field(pattern):
            m = re.search(pattern, dump)
            return m.group(1) if m else None
        path = (self.adb('shell', 'pm', 'path', package).strip().splitlines() or [''])[0].replace('package:', '').strip()
        uid = re.search(r'uid:(\d+)', self.adb('shell', 'pm', 'list', 'packages', '-U', package)) or re.search(r'appId=(\d+)', dump)
        return {'package': package, 'installed': bool(path), 'versionName': field(r'versionName=(\S+)'), 'versionCode': field(r'versionCode=(\d+)'),
                'uid': uid.group(1) if uid else None, 'lastUpdateTime': field(r'lastUpdateTime=([^\r\n]+)'), 'firstInstallTime': field(r'firstInstallTime=([^\r\n]+)'),
                'installer': field(r'installerPackageName=(\S+)'), 'primaryCpuAbi': field(r'primaryCpuAbi=(\S+)'), 'signature': field(r'signatures=\[?([0-9a-f]{6,})\]?') or field(r'signatures:\[([0-9a-f]+)\]'),
                'apkPath': path, 'apkSha256': (self.adb('shell', 'sha256sum', path).split() or [None])[0] if path else None}

    def battery(self):
        dump = self.adb('shell', 'dumpsys', 'battery')
        level = re.search(r'level:\s*(\d+)', dump)
        charging = re.search(r'status:\s*(\d+)', dump)
        temp = re.search(r'temperature:\s*(\d+)', dump)
        return {'level': int(level.group(1)) if level else None, 'charging': (charging.group(1) == '2') if charging else None,
                'tenthsC': int(temp.group(1)) if temp else None}

    def thermal(self):
        dump = self.adb('shell', 'dumpsys', 'thermalservice')
        status = re.search(r'Thermal Status:\s*(\d+)', dump)
        cpu = [float(x) for x in re.findall(r'mValue=([\d.]+), mType=0, mName=CPU\d', dump)]
        return {'status': int(status.group(1)) if status else None, 'cpuMaxC': max(cpu) if cpu else None}

    def profile(self, package=None):
        """Everything a receipt needs to say WHICH device produced a number. Read-only."""
        display = self.adb('shell', 'dumpsys', 'display', timeout=90)
        active_hz, supported_hz = refresh_rate(display)
        mem = re.search(r'MemTotal:\s+(\d+)', self.adb('shell', 'cat', '/proc/meminfo'))
        density = re.search(r'(?:Override|Physical) density:\s*(\d+)', self.adb('shell', 'wm', 'density'))
        profile = {'serial': self.serial, 'kind': self.kind, 'manufacturer': self.getprop('ro.product.manufacturer'), 'model': self.getprop('ro.product.model'),
                   'android': self.getprop('ro.build.version.release'), 'sdk': self.getprop('ro.build.version.sdk'), 'abi': self.getprop('ro.product.cpu.abi'),
                   'buildId': self.getprop('ro.build.display.id'), 'soc': self.getprop('ro.soc.model') or self.getprop('ro.board.platform'),
                   'screenPx': self.screen_size(), 'densityDpi': int(density.group(1)) if density else None, 'refreshHzActive': active_hz, 'refreshHzSupported': supported_hz,
                   'ramKb': int(mem.group(1)) if mem else None, 'timezone': self.getprop('persist.sys.timezone'), 'battery': self.battery(), 'thermal': self.thermal()}
        if package:
            profile['app'] = self.package_info(package)
        return profile


class LogStream:
    """The device log of ONE app streamed to local files for the whole run, so nothing on the device is cleared or resized (`logcat -c` / `-G` are not used)
    and a burst of native warnings cannot push the app's own trace lines out of the device's small ring buffer. The app stream keeps only the app's uid;
    the system stream keeps only ActivityManager / AndroidRuntime / crash lines, and readers filter it to the package. `mark()` is a byte offset."""

    def __init__(self, device, path, uid=None, system_tags=('ActivityManager:I', 'AndroidRuntime:E', 'DEBUG:I')):
        self.device, self.path, self.uid, self.system_tags = device, Path(path), uid, system_tags
        self.sys_path = self.path.with_name(self.path.stem + '-system' + self.path.suffix)
        self.procs, self.files = [], []

    def start(self):
        app_cmd = self.device.prefix + ['logcat', '-v', 'threadtime'] + ([f'--uid={self.uid}'] if self.uid else [])
        sys_cmd = self.device.prefix + ['logcat', '-v', 'threadtime'] + list(self.system_tags) + ['*:S']
        for cmd, path in ((app_cmd, self.path), (sys_cmd, self.sys_path)):
            handle = open(path, 'wb')
            self.files.append(handle)
            self.procs.append(subprocess.Popen(cmd, stdout=handle, stderr=subprocess.DEVNULL))
        time.sleep(1.0)
        return self

    def mark(self):
        return self.path.stat().st_size if self.path.exists() else 0

    def since(self, mark, system=False):
        path = self.sys_path if system else self.path
        if not path.exists():
            return ''
        with open(path, 'rb') as f:
            f.seek(mark if not system else 0)
            return f.read().decode('utf-8', 'replace')

    def stop(self):
        for p in self.procs:
            p.terminate()
        for p in self.procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        for f in self.files:
            f.close()
        self.procs, self.files = [], []

    def __enter__(self):
        return self.start()

    def __exit__(self, *_exc):
        self.stop()
        return False


def selftest():
    text = ('List of devices attached\n'
            'A8QDVB6522001205       device product:VKP-NX9EEA model:VKP_NX9 device:HNVKPX transport_id:2\n'
            'emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1\n'
            'BADONE                 unauthorized transport_id:9\n'
            '* daemon started successfully\n')
    devices = parse_devices(text)
    assert [d['serial'] for d in devices] == ['A8QDVB6522001205', 'emulator-5554', 'BADONE'], devices
    assert [d['kind'] for d in devices] == ['physical', 'emulator', 'physical'], devices
    assert pick(devices=devices, environ={}, prefer='physical')['serial'] == 'A8QDVB6522001205'
    assert pick(devices=devices, environ={}, prefer='emulator')['serial'] == 'emulator-5554'
    assert pick(serial='emulator-5554', devices=devices, environ={'ANDROID_SERIAL': 'A8QDVB6522001205'})['serial'] == 'emulator-5554'      # explicit beats the environment
    assert pick(devices=devices, environ={'QA_SERIAL': 'A8QDVB6522001205'})['serial'] == 'A8QDVB6522001205'
    for bad in (dict(serial='BADONE'), dict(serial='nope'), dict(), dict(prefer='physical')):     # unauthorised / absent / ambiguous / two "physical" (one unauthorised is not ready, so this one is fine)
        try:
            got = pick(devices=devices, environ={}, **bad)
        except DeviceError:
            continue
        assert bad == dict(prefer='physical') and got['serial'] == 'A8QDVB6522001205', (bad, got)
    assert pick(devices=devices, environ={}, prefer='auto')['serial'] == 'A8QDVB6522001205'                     # physical first
    assert pick(devices=devices[1:2], environ={}, prefer='auto')['serial'] == 'emulator-5554'                   # then the emulator
    two_phones = [dict(devices[0], serial='PHONE_B'), devices[0]]
    try:
        pick(devices=two_phones, environ={}, prefer='auto')
        raise AssertionError('two physical devices must be ambiguous')
    except DeviceError:
        pass
    only = [devices[0]]
    assert pick(devices=only, environ={})['serial'] == 'A8QDVB6522001205'
    assert wm_size('Physical size: 1264x2728\nOverride size: 1080x2340') == (1080, 2340)
    assert wm_size('Physical size: 1080x2424') == (1080, 2424)
    hz = refresh_rate('mActiveSfDisplayMode=DisplayMode{id=1, width=1264, height=2728, xDpi=458.6, yDpi=458.9, peakRefreshRate=90.0, vsyncRate=90.0, x=1}\n'
                      'mSupportedRefreshRates=[120.00001, 90.0, 60.000004]')
    assert hz == (90, [120, 90, 60]), hz
    print('selftest OK')


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest()
    else:
        for d in list_devices():
            print(d['serial'], d['kind'], d['state'], d['model'] or d['product'])
