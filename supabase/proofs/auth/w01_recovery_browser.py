"""Actual Expo web -> disposable GoTrue -> SMTP mailbox -> callback -> password.
No mocked Auth response, admin key, production access, or direct SQL fixture write.
This does not assert native linking, external SMTP delivery, or full marketplace DB replay.
"""
from __future__ import annotations
import functools
import hashlib
import html
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright

API = os.environ.get('EXPO_PUBLIC_SUPABASE_URL', '')
WEB = 'http://127.0.0.1:4173'
MAIL = 'http://127.0.0.1:54324'
assert API == 'http://127.0.0.1:54321', 'Only isolated loopback Auth is permitted'
assert os.environ.get('EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL') == WEB + '/oporavak'
KEY = os.environ['EXPO_PUBLIC_SUPABASE_ANON_KEY']
OUT = Path('artifacts/w01-auth-recovery')
OUT.mkdir(parents=True, exist_ok=True)
ROOT = Path('dist-w01').resolve()
report = {
    'schemaVersion': 1,
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'result': 'RUNNING', 'checks': [], 'screenshots': [],
    'environment': 'disposable-loopback-gotrue-mailpit-and-actual-expo-web',
    'productionAccessed': False, 'productionApplied': False,
    'mockAuthResponses': False, 'directSqlFixtureWrites': False,
    'marketplaceMigrationsReplayed': False, 'nativeDeviceVerified': False,
    'externalSmtpDelivered': False,
}
stage = 'setup'

def request(url: str, body: dict | None = None, *, auth: bool = False):
    target = urlsplit(url)
    assert target.hostname == '127.0.0.1' and target.port in (54321, 54324), 'Foreign proof request refused'
    headers = {'Content-Type': 'application/json'}
    if auth: headers['apikey'] = KEY
    req = Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try:
        with urlopen(req, timeout=15) as response:
            return response.status, json.loads(response.read() or b'{}')
    except HTTPError as error:
        return error.code, json.loads(error.read() or b'{}')

def mailbox_link(email: str, excluded: set[str]) -> tuple[str, str]:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        status, listing = request(MAIL + '/api/v1/messages')
        assert status == 200, 'Disposable mailbox unavailable'
        for item in listing.get('messages', []):
            identifier = item['ID']
            if identifier in excluded: continue
            if not any(recipient.get('Address') == email for recipient in item.get('To', [])): continue
            status, message = request(MAIL + '/api/v1/message/' + identifier)
            assert status == 200, 'Disposable message unavailable'
            for raw in re.findall(r'href=[\"\']([^\"\']+)', message.get('HTML', '')):
                link = html.unescape(raw)
                url = urlsplit(link)
                params = parse_qs(url.query)
                if url.hostname == '127.0.0.1' and url.port == 54321 and url.path == '/auth/v1/verify' and params.get('type') == ['recovery']:
                    assert params.get('redirect_to') == [WEB + '/oporavak'], 'Unexpected recovery redirect'
                    return identifier, link
        time.sleep(0.25)
    raise AssertionError('Recovery message was not received by the isolated SMTP mailbox')

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        candidate = ROOT / path.lstrip('/')
        if path != '/' and not candidate.is_file() and Path(str(candidate) + '.html').is_file(): self.path = path + '.html'
        super().do_GET()
    def log_message(self, *_args):
        pass  # Request URLs can carry recovery credentials.

server = ThreadingHTTPServer(('127.0.0.1', 4173), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()

try:
    suffix = secrets.token_hex(6)
    email_a, email_b = 'w01-test-a-' + suffix + '@example.test', 'w01-test-b-' + suffix + '@example.test'
    old_password, other_password, new_password = [secrets.token_urlsafe(24) + 'Aa!9' for _ in range(3)]
    stage = 'create-two-disposable-auth-accounts-through-api'
    status, signup_a = request(API + '/auth/v1/signup', {'email': email_a, 'password': old_password}, auth=True)
    assert status == 200 and signup_a.get('user', {}).get('id'), 'First disposable signup failed'
    status, signup_b = request(API + '/auth/v1/signup', {'email': email_b, 'password': other_password}, auth=True)
    assert status == 200 and signup_b.get('user', {}).get('id'), 'Second disposable signup failed'
    account_a, account_b = signup_a['user']['id'], signup_b['user']['id']
    del signup_a, signup_b
    report['checks'].append('Two isolated accounts created through normal Auth API, without SQL/admin key')

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
        page = context.new_page()
        runtime_errors: list[str] = []
        page.on('pageerror', lambda error: runtime_errors.append(type(error).__name__))
        def screenshot(name: str):
            page.screenshot(path=str(OUT / (name + '.png')), full_page=True)
            report['screenshots'].append(name + '.png')
        stage = 'actual-ui-recovery-request'
        page.goto(WEB + '/auth?form=login', wait_until='networkidle')
        page.get_by_role('button', name='Zaboravili ste lozinku?').click()
        page.get_by_label('Email', exact=True).fill(email_a)
        screenshot('01-request')
        page.get_by_role('button', name='Pošaljite link', exact=True).click()
        page.get_by_text('Zahtev za oporavak je prihvaćen.', exact=True).wait_for()
        screenshot('02-request-accepted')
        message_id, first_link = mailbox_link(email_a, set())
        report['checks'].append('Current app requested recovery and the real local SMTP mailbox received the provider email')

        stage = 'actual-provider-email-link-and-isolated-recovery-session'
        page.goto(first_link, wait_until='networkidle')
        page.get_by_label('Nova lozinka', exact=True).wait_for()
        screenshot('03-verified')
        # Record only structural booleans, never a credential-bearing URL.
        report['callbackLocation'] = page.evaluate('''() => ({
            correctOrigin: location.origin === 'http://127.0.0.1:4173',
            correctPath: location.pathname === '/oporavak',
            hasSearch: Boolean(location.search), hasHash: Boolean(location.hash)
        })''')
        assert page.url == WEB + '/oporavak', 'Credentials remained in browser URL or Auth redirected into marketplace'
        page.get_by_label('Nova lozinka', exact=True).fill(new_password)
        page.get_by_label('Potvrdite novu lozinku', exact=True).fill('mismatch')
        page.get_by_role('button', name='Sačuvajte novu lozinku').click()
        page.get_by_text('Lozinke se ne poklapaju.', exact=True).wait_for()
        screenshot('04-local-validation')
        page.get_by_label('Potvrdite novu lozinku', exact=True).fill(new_password)
        stage = 'actual-provider-password-update-through-ui'
        page.get_by_role('button', name='Sačuvajte novu lozinku').click()
        page.get_by_text('Lozinka je promenjena.', exact=False).wait_for()
        screenshot('05-confirmed')
        page.get_by_role('button', name='Podaci o verziji').click()
        page.get_by_text('Izvor: ' + report['sourceCommit'], exact=True).wait_for()
        page.get_by_text('Lokalno test okruženje', exact=True).wait_for()
        screenshot('09-build-identity')
        report['checks'].append('In-app version details identify the exact tested source and local backend without claiming live activation')
        assert page.url == WEB + '/oporavak', 'Recovery unexpectedly became marketplace login'
        values = page.evaluate('Object.values(localStorage)')
        assert not any('access_token' in value or 'refresh_token' in value for value in values), 'Recovery tokens persisted'
        report['checks'].append('Callback verified on GoTrue; UI saved the password; no primary login or persisted recovery credentials')

        stage = 'verify-password-and-second-account-isolation'
        status, rejected = request(API + '/auth/v1/token?grant_type=password', {'email': email_a, 'password': old_password}, auth=True)
        assert status == 400 and rejected.get('error_code') == 'invalid_credentials', 'Old password was not rejected'
        status, accepted = request(API + '/auth/v1/token?grant_type=password', {'email': email_a, 'password': new_password}, auth=True)
        assert status == 200 and accepted.get('user', {}).get('id') == account_a, 'New password did not open the same account'
        status, other = request(API + '/auth/v1/token?grant_type=password', {'email': email_b, 'password': other_password}, auth=True)
        assert status == 200 and other.get('user', {}).get('id') == account_b, 'Other account credentials changed'
        del rejected, accepted, other
        report['checks'].append('Real provider rejects old password, accepts new password for same account, and leaves second account unchanged')

        stage = 'used-provider-link-rejected'
        page.goto(first_link, wait_until='networkidle')
        page.get_by_text('Link je nevažeći ili je istekao. Zatražite novi link.', exact=True).wait_for()
        assert page.get_by_label('Nova lozinka', exact=True).count() == 0
        screenshot('06-used-link')
        report['checks'].append('Reused provider verification link is rejected and gives no password form')

        stage = 'expired-provider-link-rejected'
        page.get_by_role('button', name='Zatražite novi link').click()
        page.get_by_label('Email', exact=True).fill(email_a)
        page.get_by_role('button', name='Pošaljite link', exact=True).click()
        page.get_by_text('Zahtev za oporavak je prihvaćen.', exact=True).wait_for()
        _, expired_link = mailbox_link(email_a, {message_id})
        time.sleep(62)  # The retained disposable config sets an explicit 60s OTP expiry.
        page.goto(expired_link, wait_until='networkidle')
        page.get_by_text('Link je nevažeći ili je istekao. Zatražite novi link.', exact=True).wait_for()
        assert page.get_by_label('Nova lozinka', exact=True).count() == 0
        screenshot('07-expired-link')
        report['checks'].append('Fresh unopened provider link expires under the explicit isolated 60s policy and cannot recover')

        stage = 'narrow-viewport-and-reduced-motion'
        page.set_viewport_size({'width': 320, 'height': 740})
        page.goto(WEB + '/auth?form=recovery', wait_until='networkidle')
        page.get_by_label('Email', exact=True).wait_for()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
        screenshot('08-narrow-320')
        report['checks'].append('Actual web form fits 320px viewport; browser reduced motion is enabled')
        report['runtimeErrorCount'] = len(runtime_errors)
        assert not runtime_errors, 'Browser runtime errors occurred'
        report['result'] = 'PASS'
        browser.close()
except Exception as error:
    report['result'] = 'FAIL'
    report['failedStage'] = stage
    report['errorType'] = type(error).__name__
    # Never print the exception: browser exceptions can include bearer-token URLs.
finally:
    server.shutdown()
    report['artifactHashes'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.png')}
    (OUT / 'proof-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ('result', 'sourceCommit', 'checks')}, indent=2))
    if report['result'] != 'PASS':
        print('W01_RECOVERY_FAILED_STAGE=' + str(report.get('failedStage', 'unknown')))
        raise SystemExit(1)
