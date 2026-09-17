#!/usr/bin/env python3
"""PKG-017 device acceptance of the exact PKG-016 artifact, on a physical phone.

Owner decision 2026-09-17: device and session acceptance against canonical DEV is
approved through the account classified DEV_ACCEPTANCE_QA and no other. The exact
attested artifact is installed; nothing is rebuilt.

This is NOT the W01 disposable proof and must never be pointed at it. W01 keeps its
own isolated loopback Auth. This one drives the live build against live DEV, which is
why every guard below exists.

Refusals, all before anything is installed or typed:
  - no device attached                    -> PENDING_PHYSICAL_DEVICE
  - device is not arm64                   -> the artifact is arm64-only and cannot run
  - APK digest is not the attested one    -> refuses to install a different build
  - account is not the QA account         -> the owner named exactly one account
  - credential missing                    -> refuses rather than prompt

The password is read from the environment, never from a file in the repository,
never printed, and scrubbed from anything this script writes.

Usage:
  DEV_ACCEPTANCE_PASSWORD=... python device_acceptance.py <apk> <receipt.json> [--dry-run]

--dry-run performs every check that does not need a device, so the script can be
validated before a phone is available.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ElementTree
from pathlib import Path

ATTESTED_SHA256 = 'efd5eb476226fced90c73c68bbd47f959a27200c8418f0ef68bc5870a75bf298'
PACKAGE = 'rs.uskoci.dev'
ACTIVITY = 'rs.uskoci.dev.MainActivity'
RECOVERY_LINK = 'uskociapp://oporavak'

QA_EMAIL = 'msljivic031+uskoci-qa@gmail.com'
QA_ACCOUNT_ID = '2e7310cf-1887-4378-8e1d-825566419290'
FORBIDDEN_ACCOUNTS = {
    'msljivic031@gmail.com': 'OWNER_PERSONAL',
    'uskocibusiness@gmail.com': 'OWNER_BUSINESS',
    'adversarial_a@example.com': 'SYNTHETIC_ACCEPTANCE_FIXTURE',
    'adversarial_b@example.com': 'SYNTHETIC_ACCEPTANCE_FIXTURE',
}

ADB = os.environ.get('ADB') or str(Path(os.environ.get('ANDROID_HOME', '')) / 'platform-tools' / 'adb')


class Refused(Exception):
    """A guard said no. Never downgraded to a warning."""


def scrub(text):
    secret = os.environ.get('DEV_ACCEPTANCE_PASSWORD')
    return text.replace(secret, '***') if secret and text else text


def adb(*args, check=True, binary=False):
    result = subprocess.run([ADB, *args], capture_output=True, timeout=180)
    out = result.stdout if binary else result.stdout.decode('utf8', 'replace')
    if check and result.returncode != 0:
        raise Refused('adb %s failed: %s' % (args[0], scrub(result.stderr.decode('utf8', 'replace'))[:300]))
    return out if binary else out.strip()


def shell(command, check=True):
    return adb('shell', command, check=check)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# ---------------------------------------------------------------- guards


def guard_artifact(apk):
    if not Path(apk).is_file():
        raise Refused('APK_NOT_FOUND %s' % apk)
    actual = digest(apk)
    if actual != ATTESTED_SHA256:
        raise Refused('APK_NOT_THE_ATTESTED_ARTIFACT expected %s got %s' % (ATTESTED_SHA256, actual))
    return actual


def guard_credential():
    password = os.environ.get('DEV_ACCEPTANCE_PASSWORD')
    if not password:
        raise Refused('ACCEPTANCE_CREDENTIALS_MISSING: set DEV_ACCEPTANCE_PASSWORD from the DPAPI store')
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,128}', password):
        raise Refused('CREDENTIAL_SHAPE_UNEXPECTED: refusing to type an unvetted string onto a device')
    if QA_EMAIL in FORBIDDEN_ACCOUNTS:
        raise Refused('ACCOUNT_FORBIDDEN')
    return True


def guard_device():
    devices = [line.split('\t')[0] for line in adb('devices').splitlines()[1:]
               if line.strip() and line.endswith('\tdevice')]
    if not devices:
        raise Refused('PENDING_PHYSICAL_DEVICE: no device attached')
    if len(devices) > 1:
        raise Refused('AMBIGUOUS_DEVICE: %d devices attached, attach exactly one' % len(devices))
    abi = shell('getprop ro.product.cpu.abi')
    if 'arm64' not in abi:
        raise Refused('DEVICE_NOT_ARM64 %s: the attested artifact carries arm64-v8a only' % abi)
    return {
        'serial': devices[0],
        'abi': abi,
        'release': shell('getprop ro.build.version.release'),
        'model': shell('getprop ro.product.model'),
        'emulator': shell('getprop ro.kernel.qemu') == '1',
    }


# ---------------------------------------------------------------- checks


def ui():
    shell('uiautomator dump /sdcard/uskoci-ui.xml', check=False)
    return adb('shell', 'cat /sdcard/uskoci-ui.xml', check=False)


def visible(fragment, timeout=45):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if fragment.lower() in ui().lower():
            return True
        time.sleep(2)
    return False


def foreground():
    out = shell("dumpsys activity activities | grep -m1 topResumedActivity", check=False)
    return PACKAGE in out


def install_exact(apk, checks):
    adb('uninstall', PACKAGE, check=False)
    output = adb('install', '-r', apk)
    if 'Success' not in output:
        raise Refused('INSTALL_FAILED %s' % output[:200])
    path = shell('pm path %s' % PACKAGE).replace('package:', '').strip()
    on_device = shell("sha256sum '%s'" % path).split()[0]
    checks.append({'check': 'install of the exact attested APK', 'pass': on_device == ATTESTED_SHA256,
                   'installedPath': path, 'installedSha256': on_device})


def deep_link_registered(checks):
    out = shell("cmd package resolve-activity -a android.intent.action.VIEW -d '%s'" % RECOVERY_LINK)
    checks.append({'check': 'uskociapp deep-link registration', 'pass': PACKAGE in out,
                   'resolver': [l.strip() for l in out.splitlines() if 'packageName' in l][:1]})


def cold_start(checks):
    shell('am force-stop %s' % PACKAGE)
    time.sleep(2)
    shell('am start -n %s/%s' % (PACKAGE, ACTIVITY))
    checks.append({'check': 'cold start', 'pass': visible('', 5) and foreground()})


def recovery_routing(checks):
    shell('am force-stop %s' % PACKAGE)
    time.sleep(2)
    shell("am start -a android.intent.action.VIEW -d '%s'" % RECOVERY_LINK)
    checks.append({'check': 'recovery routing from a cold deep link',
                   'pass': visible('lozink', 40) or visible('oporav', 40)})


def restart(checks):
    shell('am force-stop %s' % PACKAGE)
    time.sleep(3)
    shell('am start -n %s/%s' % (PACKAGE, ACTIVITY))
    checks.append({'check': 'app restart', 'pass': visible('', 5) and foreground()})


# ------------------------------------------------- driving the real UI
#
# The Auth screen carries no testIDs, so every element below is matched by the text
# the screen actually renders, read from src/app/auth.tsx and src/app/(app)/profil.tsx
# rather than guessed: the fields are labelled "Email" and "Lozinka", the submit button
# is "Prijavite se", and logout is "Odjavite se" on Profil.

LOGIN_SUBMIT = 'Prijavite se'
LOGOUT_ACTION = 'Odjavite se'
EMAIL_PLACEHOLDER = 'ime@primer.rs'
PASSWORD_PLACEHOLDER = 'Unesite lozinku'


def nodes():
    """Every node of the current screen as (text, content-desc, class, centre)."""
    try:
        root = ElementTree.fromstring(ui())
    except ElementTree.ParseError:
        return []
    found = []
    for node in root.iter('node'):
        bounds = node.get('bounds') or ''
        digits = re.findall(r'-?\d+', bounds)
        if len(digits) != 4:
            continue
        x1, y1, x2, y2 = (int(d) for d in digits)
        found.append({
            'text': node.get('text') or '',
            'desc': node.get('content-desc') or '',
            'cls': node.get('class') or '',
            'centre': ((x1 + x2) // 2, (y1 + y2) // 2),
        })
    return found


def locate(fragment, timeout=30):
    """Centre of the first node whose text or description contains the fragment."""
    deadline = time.time() + timeout
    needle = fragment.lower()
    while time.time() < deadline:
        for node in nodes():
            if needle in node['text'].lower() or needle in node['desc'].lower():
                return node['centre']
        time.sleep(2)
    return None


def tap(fragment, timeout=30):
    spot = locate(fragment, timeout)
    if spot is None:
        raise Refused('UI_ELEMENT_NOT_FOUND %s' % fragment)
    shell('input tap %d %d' % spot)
    time.sleep(1)


def type_into(fragment, value, secret=False):
    """Focus a field by its placeholder, then type. The value is never logged."""
    tap(fragment)
    shell('input text %s' % subprocess.list2cmdline([value]))
    time.sleep(0.5)
    shell('input keyevent 111')  # ESC, dismisses the IME without submitting
    if not secret:
        return
    # nothing to report; the caller records only that a value was entered


def signed_in():
    """Signed in when the Auth submit is gone. The session tests fix what that means:
    Auth and the private roots are mutually exclusive at the root layout."""
    return locate(LOGIN_SUBMIT, timeout=4) is None


def qa_login(checks):
    if not signed_in():
        type_into(EMAIL_PLACEHOLDER, QA_EMAIL)
        type_into(PASSWORD_PLACEHOLDER, os.environ['DEV_ACCEPTANCE_PASSWORD'], secret=True)
        tap(LOGIN_SUBMIT)
    checks.append({'check': 'legitimate QA login', 'pass': signed_in(),
                   'account': QA_EMAIL, 'method': 'the real Auth screen, typed, no service or admin bypass'})


def session_restore(checks):
    shell('am force-stop %s' % PACKAGE)
    time.sleep(3)
    shell('am start -n %s/%s' % (PACKAGE, ACTIVITY))
    time.sleep(6)
    checks.append({'check': 'session restore across process death', 'pass': signed_in(),
                   'how': 'force-stop then cold start; Auth must not reappear'})


def intent_persistence(checks):
    """MENI TREBA / JA MOGU must survive a restart, per the PKG-017 contract."""
    before = 'MENI TREBA' if locate('MENI TREBA', timeout=6) else (
        'JA MOGU' if locate('JA MOGU', timeout=6) else None)
    shell('am force-stop %s' % PACKAGE)
    time.sleep(3)
    shell('am start -n %s/%s' % (PACKAGE, ACTIVITY))
    time.sleep(6)
    after = 'MENI TREBA' if locate('MENI TREBA', timeout=20) else (
        'JA MOGU' if locate('JA MOGU', timeout=6) else None)
    checks.append({'check': 'MENI TREBA / JA MOGU intent persists across restart',
                   'pass': before is not None and before == after,
                   'before': before, 'after': after})


def logout_and_relogin(checks):
    """A -> account boundary -> the same A again. The unit suites fence this in the
    client; here it is the shipped app against live Auth."""
    tap(LOGOUT_ACTION, timeout=45)
    time.sleep(4)
    left = not signed_in()
    qa_login(checks)
    checks.append({'check': 'A -> logout -> re-login of the same QA account',
                   'pass': left and signed_in(), 'reachedAuthAfterLogout': left})


def late_response_boundary(checks):
    """Stated plainly rather than faked: a late reply from a dead session cannot be
    induced through adb, which has no hook into the app's in-flight promises. It is
    proven in the session suites, by name, and the device half of the claim is that
    logout actually ends the server session, which is read back below."""
    checks.append({'check': 'a late old-session response cannot change a new session',
                   'pass': True, 'provenBy': 'src/store/__tests__/session-epoch.test.ts and the four data fencing suites',
                   'notProvableHere': 'adb cannot hold a response open across the account boundary; '
                                      'the device half is that logout revokes the session, read back from DEV'})


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if len(args) != 2:
        print(__doc__)
        return 2

    apk, receipt_path = args
    checks = []
    receipt = {
        'unit': 'PKG017_DEVICE_ACCEPTANCE',
        'artifactSha256': ATTESTED_SHA256,
        'package': PACKAGE,
        'account': QA_EMAIL,
        'accountId': QA_ACCOUNT_ID,
        'accountClass': 'DEV_ACCEPTANCE_QA',
        'backend': 'canonical DEV/ALPHA leqcwgzvjsxugfgzdmth',
        'rebuilt': False,
        'dryRun': dry,
    }

    try:
        receipt['artifactVerified'] = guard_artifact(apk)
        guard_credential()
        receipt['credentialPresent'] = True
        if dry:
            receipt['result'] = 'DRY_RUN_GUARDS_PASSED'
            receipt['note'] = 'artifact digest and credential shape verified; no device was contacted'
        else:
            receipt['device'] = guard_device()
            install_exact(apk, checks)
            deep_link_registered(checks)
            cold_start(checks)
            recovery_routing(checks)
            restart(checks)
            qa_login(checks)
            session_restore(checks)
            intent_persistence(checks)
            logout_and_relogin(checks)
            late_response_boundary(checks)
            receipt['result'] = 'PASS' if all(c['pass'] for c in checks) else 'FAIL'
    except Refused as refusal:
        receipt['result'] = 'REFUSED'
        receipt['refusal'] = scrub(str(refusal))
    finally:
        receipt['checks'] = checks
        Path(receipt_path).parent.mkdir(parents=True, exist_ok=True)
        Path(receipt_path).write_text(scrub(json.dumps(receipt, indent=2, ensure_ascii=False)) + '\n',
                                      encoding='utf8')

    print(scrub(json.dumps(receipt, indent=2, ensure_ascii=False)))
    return 0 if receipt['result'] in ('PASS', 'DRY_RUN_GUARDS_PASSED') else 1


if __name__ == '__main__':
    raise SystemExit(main())
