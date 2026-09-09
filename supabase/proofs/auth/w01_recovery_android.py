"""Installed Android APK -> real disposable Auth/SMTP -> OS deep link -> password.
Uses two synthetic accounts through the public Auth API. No live target, SQL,
admin key, JS state injection, or mocked network. This is an emulator, not a
physical handset or external email-delivery claim.
"""
from __future__ import annotations
import hashlib
import html
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
import xml.etree.ElementTree as ET

API = os.environ.get('EXPO_PUBLIC_SUPABASE_URL', '')
assert API == 'http://127.0.0.1:54321', 'Only disposable loopback Auth is permitted'
KEY = os.environ['EXPO_PUBLIC_SUPABASE_ANON_KEY']
MAIL = 'http://127.0.0.1:54324'
CALLBACK = 'uskociapp://oporavak'
PACKAGE = 'rs.uskoci.w01proof'
OUT = Path('artifacts/w01-auth-recovery-native')
OUT.mkdir(parents=True, exist_ok=True)
report = {
    'schemaVersion': 1,
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'environment': 'disposable-android-api34-emulator-and-local-gotrue-mailpit',
    'package': PACKAGE, 'result': 'RUNNING', 'checks': [], 'screenshots': [],
    'productionAccessed': False, 'productionApplied': False,
    'physicalHandsetVerified': False, 'externalSmtpDelivered': False,
    'mockAuthResponses': False, 'directSqlFixtureWrites': False,
    'marketplaceMigrationsReplayed': False,
}
stage = 'setup'


def adb(*args: str, check: bool = True, binary: bool = False):
    result = subprocess.run(['adb', *args], capture_output=True, text=not binary, timeout=45)
    # Never include args/stdout/stderr in an exception: OS launch output can contain tokens.
    if check and result.returncode != 0:
        raise RuntimeError('ADB_COMMAND_FAILED')
    return result


def request(url: str, body: dict | None = None, *, auth: bool = False):
    target = urlsplit(url)
    assert target.hostname == '127.0.0.1' and target.port in (54321, 54324), 'Foreign proof target refused'
    headers = {'Content-Type': 'application/json'}
    if auth: headers['apikey'] = KEY
    req = Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try:
        with urlopen(req, timeout=15) as response:
            return response.status, json.loads(response.read() or b'{}')
    except HTTPError as error:
        return error.code, json.loads(error.read() or b'{}')


def mailbox_link(email: str, excluded: set[str]) -> tuple[str, str]:
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        status, listing = request(MAIL + '/api/v1/messages')
        assert status == 200
        for item in listing.get('messages', []):
            identifier = item['ID']
            if identifier in excluded or not any(x.get('Address') == email for x in item.get('To', [])):
                continue
            status, message = request(MAIL + '/api/v1/message/' + identifier)
            assert status == 200
            for raw in re.findall(r'href=[\"\']([^\"\']+)', message.get('HTML', '')):
                link = html.unescape(raw)
                url = urlsplit(link); params = parse_qs(url.query)
                if (url.hostname == '127.0.0.1' and url.port == 54321 and url.path == '/auth/v1/verify'
                        and params.get('type') == ['recovery']):
                    assert params.get('redirect_to') == [CALLBACK], 'Foreign recovery callback refused'
                    return identifier, link
        time.sleep(0.4)
    raise AssertionError('SMTP_MESSAGE_NOT_RECEIVED')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def provider_callback(link: str) -> str:
    # Provider verification is real; only HTTP -> OS handoff is performed by ADB.
    url = urlsplit(link)
    assert url.hostname == '127.0.0.1' and url.port == 54321 and url.path == '/auth/v1/verify'
    try:
        with build_opener(NoRedirect).open(link, timeout=15):
            raise AssertionError('PROVIDER_REDIRECT_MISSING')
    except HTTPError as response:
        assert response.code in (302, 303), 'PROVIDER_REDIRECT_REFUSED'
        location = response.headers.get('Location', '')
        assert location.startswith(CALLBACK + '#'), 'Unexpected callback destination'
        return location


def tree():
    adb('shell', 'uiautomator', 'dump', '/sdcard/w01-window.xml')
    raw = adb('shell', 'cat', '/sdcard/w01-window.xml').stdout
    return ET.fromstring(raw)


def find(label: str, *, field: bool = False, timeout: int = 40, scroll: bool = False):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            root = tree()
        except ET.ParseError:
            time.sleep(0.3); continue
        for node in root.iter():
            if field and node.get('class') != 'android.widget.EditText': continue
            values = (' '.join((node.get(key) or '').split()) for key in ('text', 'content-desc'))
            if ' '.join(label.split()) in values:
                bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
                if bounds and int(bounds[3]) > int(bounds[1]) and int(bounds[4]) > int(bounds[2]):
                    return node
        if scroll:
            width, height = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1])
            adb('shell', 'input', 'swipe', str(width // 2), str(int(height * .8)), str(width // 2), str(int(height * .35)), '350')
        time.sleep(0.5)
    raise AssertionError('UI_ELEMENT_NOT_REACHED')


def tap(label: str, *, field: bool = False):
    node = find(label, field=field, scroll=True)
    numbers = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
    assert numbers, 'UI_BOUNDS_MISSING'
    x1, y1, x2, y2 = map(int, numbers.groups())
    assert x2 > x1 and y2 > y1, 'UI_ELEMENT_NOT_VISIBLE'
    x, y = str((x1 + x2) // 2), str((y1 + y2) // 2)
    adb('shell', 'input', 'touchscreen', 'swipe', x, y, x, y, '120')
    time.sleep(0.3)


def fill(label: str, value: str):
    # Fixtures use an explicitly bounded shell-safe alphabet. Password bytes are exact.
    assert re.fullmatch(r'[A-Za-z0-9@._-]+', value)
    tap(label, field=True)
    adb('shell', 'input', 'text', shlex.quote(value))
    adb('shell', 'input', 'keyevent', '4')  # Hide keyboard, not an app navigation command.
    time.sleep(0.3)


def open_app(link: str, *, cold: bool):
    assert link.startswith('uskociapp://')
    if cold: adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', shlex.quote(link), PACKAGE)


def shot(name: str):
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p', binary=True).stdout)
    report['screenshots'].append(name + '.png')


try:
    suffix = secrets.token_hex(5)
    email_a, email_b = 'w01-native-a-' + suffix + '@example.test', 'w01-native-b-' + suffix + '@example.test'
    old_password, new_password, other_password = [secrets.token_hex(16) + 'A9' for _ in range(3)]
    stage = 'create-two-disposable-accounts'
    status, first = request(API + '/auth/v1/signup', {'email': email_a, 'password': old_password}, auth=True)
    assert status == 200 and first.get('user', {}).get('id')
    status, second = request(API + '/auth/v1/signup', {'email': email_b, 'password': other_password}, auth=True)
    assert status == 200 and second.get('user', {}).get('id')
    account_a, account_b = first['user']['id'], second['user']['id']
    del first, second
    adb('install', '-r', 'android/app/build/outputs/apk/debug/app-debug.apk')
    adb('shell', 'settings', 'put', 'global', 'window_animation_scale', '0')
    adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', '0')
    adb('shell', 'settings', 'put', 'global', 'animator_duration_scale', '0')

    stage = 'native-recovery-request'
    open_app('uskociapp://auth?form=login', cold=True)
    tap('Zaboravili ste lozinku?')
    fill('Email', email_a)
    shot('01-native-request')
    tap('Pošaljite link')
    find('Zahtev za oporavak je prihvaćen.')
    shot('02-native-accepted')
    message_id, link = mailbox_link(email_a, set())
    report['checks'].append('Installed APK requested recovery and the real local SMTP mailbox received the provider link')

    stage = 'cold-os-recovery-deep-link'
    callback = provider_callback(link)
    open_app(callback, cold=True)
    find('Nova lozinka', field=True)
    shot('03-native-verified')
    stage = 'native-password-save'
    fill('Nova lozinka', new_password)
    fill('Potvrdite novu lozinku', new_password)
    tap('Sačuvajte novu lozinku')
    find('Lozinka je promenjena.')
    find('Prijavite se')
    shot('04-native-confirmed')
    report['checks'].append('Cold OS deep link opened the native recovery form; actual provider password update returned the native success screen')

    stage = 'provider-account-isolation'
    status, rejected = request(API + '/auth/v1/token?grant_type=password', {'email': email_a, 'password': old_password}, auth=True)
    assert status == 400 and rejected.get('error_code') == 'invalid_credentials'
    status, accepted = request(API + '/auth/v1/token?grant_type=password', {'email': email_a, 'password': new_password}, auth=True)
    assert status == 200 and accepted.get('user', {}).get('id') == account_a
    status, untouched = request(API + '/auth/v1/token?grant_type=password', {'email': email_b, 'password': other_password}, auth=True)
    assert status == 200 and untouched.get('user', {}).get('id') == account_b
    del rejected, accepted, untouched
    report['checks'].append('Provider rejects old password, accepts new password for the same account and preserves the other account')

    stage = 'warm-os-used-link'
    invalid_callback = provider_callback(link)
    open_app(invalid_callback, cold=False)
    find('Link je nevažeći ili je istekao. Zatražite novi link.')
    assert not any(node.get('class') == 'android.widget.EditText' for node in tree().iter())
    shot('05-native-used-link')
    report['checks'].append('Warm OS deep link for a reused provider link shows the native invalid-link state without password controls')
    stage = 'native-return-to-login'
    tap('Nazad na prijavu')
    find('Email', field=True)
    shot('06-native-back-to-login')
    report['checks'].append('Explicit return reaches native login, without fabricating a marketplace session')
    report['result'] = 'PASS'
except Exception as error:
    report['result'] = 'FAIL'
    report['failedStage'] = stage
    report['errorType'] = type(error).__name__
    try:
        shot('failure-' + stage)
    except Exception:
        pass
    # No raw exceptions, hierarchy dumps or logcat: they can expose credential URLs.
finally:
    report['artifactHashes'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.png')}
    (OUT / 'native-proof-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ('result', 'sourceCommit', 'checks')}, indent=2))
    if report['result'] != 'PASS':
        print('W01_NATIVE_RECOVERY_FAILED_STAGE=' + str(report.get('failedStage', 'unknown')))
        raise SystemExit(1)
