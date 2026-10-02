"""Test doubles for the EX-07 S03 proof (NOT evidence): an in-process model of the disposable GoTrue + Mailpit and a fake clock.

The model follows what the proof EXPECTS of the real provider (and of GoTrue's documented behaviour), with switches that
break one rule at a time, so the tests can show that the proof turns red for the right reason. It proves the SCRIPT, never
the provider: only the CI run against the real GoTrue does that.
"""
from __future__ import annotations

import base64
import hashlib
import html
import json
from typing import Any, Optional
from urllib.parse import parse_qs, quote, urlencode, urlsplit

import s03_core as core
import s03_http as net

API = 'http://127.0.0.1:54321'


class FakeClock(net.Clock):
    def __init__(self) -> None:
        self.t = 1000.0

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.t += max(0.0, seconds)


def _b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode().rstrip('=')


class User:
    def __init__(self, uid: str, email: str, password: str) -> None:
        self.id, self.email, self.password = uid, email, password
        self.confirmed = False
        self.confirm_tokens: set[str] = set()
        self.confirm_sent_at: Optional[float] = None
        self.recovery_token: Optional[str] = None
        self.recovery_sent_at: Optional[float] = None


class FakeProvider:
    """GoTrue (127.0.0.1:54321) and Mailpit (127.0.0.1:54324) in one object. `transport` is a net.Transport."""

    def __init__(self, clock: FakeClock, *, confirmations: bool = True, site_url: str = core.SITE_URL,
                 allowlist: tuple[str, ...] = (core.SIGNUP_REDIRECT, core.RECOVERY_REDIRECT), otp_expiry: float = core.OTP_EXPIRY_SECONDS,
                 max_frequency: float = core.MAX_FREQUENCY_SECONDS, hourly_limit: Optional[int] = None,
                 # one switch per rule the proof checks:
                 echo_foreign_redirect: bool = False, links_are_reusable: bool = False, ignore_expiry: bool = False,
                 no_frequency_limit: bool = False, tokens_in_query: bool = False, supersede_on_resend: bool = True,
                 revoke_other_sessions: bool = True, recovery_session_survives: bool = True,
                 confirm_without_tokens: bool = False, accept_cross_type: bool = False) -> None:
        self.clock = clock
        self.cfg = dict(confirmations=confirmations, site_url=site_url, allowlist=tuple(allowlist), otp_expiry=otp_expiry,
                        max_frequency=max_frequency, hourly_limit=hourly_limit, echo_foreign_redirect=echo_foreign_redirect,
                        links_are_reusable=links_are_reusable, ignore_expiry=ignore_expiry, no_frequency_limit=no_frequency_limit,
                        tokens_in_query=tokens_in_query, supersede_on_resend=supersede_on_resend,
                        revoke_other_sessions=revoke_other_sessions, recovery_session_survives=recovery_session_survives,
                        confirm_without_tokens=confirm_without_tokens, accept_cross_type=accept_cross_type)
        self.users: dict[str, User] = {}
        self.sessions: dict[str, dict[str, Any]] = {}
        self.messages: list[dict[str, Any]] = []
        self.emails_sent = 0
        self.requests: list[tuple[str, str]] = []   # (method, path) of every provider request, for "no call was made" checks
        self._n = 0

    # ---------------------------------------------------------------- helpers
    def _next(self) -> int:
        self._n += 1
        return self._n

    def _jwt(self, uid: str, sid: str) -> str:
        n = self._next()
        return 'eyJhbGciOiJIUzI1NiIsImtpZCI6InN5bnRoIn0.' + _b64(json.dumps({'sub': uid, 'sid': sid, 'n': n})) + '.' + _b64(f'signature-synthetic-{n:06d}-padding')

    def _new_session(self, user: User) -> dict[str, Any]:
        sid = f'sess-{self._next()}'
        session = {'id': sid, 'user': user.email, 'access': self._jwt(user.id, sid),
                   'refresh': hashlib.sha1(f'r{self._next()}'.encode()).hexdigest()[:12], 'alive': True}
        self.sessions[sid] = session
        return session

    def _find_session(self, *, access: Optional[str] = None, refresh: Optional[str] = None) -> Optional[dict[str, Any]]:
        for s in self.sessions.values():
            if (access and s['access'] == access) or (refresh and s['refresh'] == refresh):
                return s
        return None

    def _token_payload(self, session: dict[str, Any], kind: Optional[str] = None) -> dict[str, str]:
        payload = {'access_token': session['access'], 'expires_at': str(int(self.clock.now()) + 3600), 'expires_in': '3600',
                   'refresh_token': session['refresh'], 'token_type': 'bearer'}
        if kind:
            payload['type'] = kind
        return payload

    def _effective_redirect(self, requested: Optional[str]) -> Optional[str]:
        site = urlsplit(self.cfg['site_url'])
        if not requested:
            return self.cfg['site_url']
        if requested in self.cfg['allowlist'] or (urlsplit(requested).scheme == 'http' and urlsplit(requested).hostname == site.hostname):
            return requested
        return requested if self.cfg['echo_foreign_redirect'] else self.cfg['site_url']

    def _send(self, user: User, kind: str, token: str, requested_redirect: Optional[str]) -> None:
        self.emails_sent += 1
        redirect = self._effective_redirect(requested_redirect)
        url = f'{API}/auth/v1/verify?token={token}&type={kind}&redirect_to={quote(redirect or "", safe="")}'
        mid = f'msg-{self._next()}'
        self.messages.append({'ID': mid, 'To': [{'Name': '', 'Address': user.email}], 'From': {'Address': 'noreply@example.test'},
                              'Subject': 'Confirm Your Signup' if kind == 'signup' else 'Reset Your Password',
                              'Created': f'{self.clock.now():014.3f}', 'HTML': f'<p><a href="{html.escape(url)}">link</a></p>', 'Text': ''})

    def _hourly_exceeded(self) -> bool:
        limit = self.cfg['hourly_limit']
        return limit is not None and self.emails_sent >= limit

    @staticmethod
    def _error(status: int, code: str, msg: str) -> net.Resp:
        return net.Resp(status, {'content-type': 'application/json'}, json.dumps({'code': status, 'error_code': code, 'msg': msg}).encode())

    @staticmethod
    def _json(status: int, body: Any, headers: Optional[dict[str, str]] = None) -> net.Resp:
        return net.Resp(status, {'content-type': 'application/json', **(headers or {})}, json.dumps(body).encode())

    def _frequency_limited(self, sent_at: Optional[float]) -> bool:
        return (not self.cfg['no_frequency_limit'] and sent_at is not None
                and self.clock.now() - sent_at < self.cfg['max_frequency'])

    def _frequency_error(self) -> net.Resp:
        return self._error(429, 'over_email_send_rate_limit', f"For security purposes, you can only request this after {int(self.cfg['max_frequency'])} seconds.")

    def _hourly_error(self) -> net.Resp:
        return self._error(429, 'over_email_send_rate_limit', 'email rate limit exceeded')

    # ---------------------------------------------------------------- transport
    def transport(self, method: str, url: str, headers: dict[str, str], body: Optional[bytes]) -> net.Resp:
        parts = urlsplit(url)
        qs = parse_qs(parts.query)
        data = json.loads(body) if body else {}
        if parts.port == 54324:
            return self._mail(method, parts.path)
        if parts.port != 54321 or not parts.path.startswith('/auth/v1/'):
            raise ValueError('FAKE_UNKNOWN_TARGET ' + url)
        route = parts.path[len('/auth/v1'):]
        self.requests.append((method, route))
        auth = headers.get('Authorization', '')
        bearer = auth[7:] if auth.startswith('Bearer ') else None
        if route == '/settings' and method == 'GET':
            return self._json(200, {'external': {'email': True, 'phone': False}, 'disable_signup': False,
                                    'mailer_autoconfirm': not self.cfg['confirmations']})
        if route == '/signup' and method == 'POST':
            return self._signup(data, qs)
        if route == '/resend' and method == 'POST':
            return self._resend(data, qs)
        if route == '/recover' and method == 'POST':
            return self._recover(data, qs)
        if route == '/token' and method == 'POST':
            grant = (qs.get('grant_type') or [''])[0]
            return self._password(data) if grant == 'password' else self._refresh(data)
        if route == '/user' and method == 'GET':
            return self._get_user(bearer)
        if route == '/user' and method == 'PUT':
            return self._put_user(bearer, data)
        if route == '/verify' and method == 'GET':
            return self._verify(qs)
        return self._error(404, 'not_found', 'no such route')

    # ---------------------------------------------------------------- Mailpit
    def _mail(self, method: str, path: str) -> net.Resp:
        if method == 'DELETE' and path == '/api/v1/messages':
            self.messages.clear()
            return self._json(200, 'ok')
        if method == 'GET' and path == '/api/v1/messages':
            ordered = sorted(self.messages, key=lambda m: m['Created'], reverse=True)
            summary = [{k: m[k] for k in ('ID', 'To', 'From', 'Subject', 'Created')} for m in ordered]
            return self._json(200, {'total': len(summary), 'messages': summary})
        if method == 'GET' and path.startswith('/api/v1/message/'):
            mid = path.rsplit('/', 1)[1]
            for m in self.messages:
                if m['ID'] == mid:
                    return self._json(200, m)
            return self._json(404, {'error': 'not found'})
        return self._json(404, {})

    # ---------------------------------------------------------------- GoTrue routes
    def _signup(self, data: dict[str, Any], qs: dict[str, list[str]]) -> net.Resp:
        email, password = data.get('email'), data.get('password')
        if self.cfg['confirmations'] and self._hourly_exceeded():
            return self._hourly_error()
        user = User(f'user-{self._next()}', email, password)
        self.users[email] = user
        redirect = (qs.get('redirect_to') or [None])[0]
        if not self.cfg['confirmations']:
            user.confirmed = True
            session = self._new_session(user)
            return self._json(200, {**self._token_payload(session), 'user': {'id': user.id, 'email': email}})
        token = hashlib.sha256(f'c{self._next()}'.encode()).hexdigest()[:32]
        user.confirm_tokens = {token}
        user.confirm_sent_at = self.clock.now()
        self._send(user, 'signup', token, redirect)
        return self._json(200, {'id': user.id, 'email': email, 'confirmation_sent_at': 'now', 'email_confirmed_at': None})

    def _resend(self, data: dict[str, Any], qs: dict[str, list[str]]) -> net.Resp:
        user = self.users.get(data.get('email'))
        if not user or user.confirmed:
            return self._json(200, {})
        if self._hourly_exceeded():
            return self._hourly_error()
        if self._frequency_limited(user.confirm_sent_at):
            return self._frequency_error()
        token = hashlib.sha256(f'c{self._next()}'.encode()).hexdigest()[:32]
        user.confirm_tokens = {token} if self.cfg['supersede_on_resend'] else (user.confirm_tokens | {token})
        user.confirm_sent_at = self.clock.now()
        self._send(user, 'signup', token, (qs.get('redirect_to') or [None])[0])
        return self._json(200, {})

    def _recover(self, data: dict[str, Any], qs: dict[str, list[str]]) -> net.Resp:
        user = self.users.get(data.get('email'))
        if not user or not user.confirmed:
            return self._json(200, {})
        if self._hourly_exceeded():
            return self._hourly_error()
        if self._frequency_limited(user.recovery_sent_at):
            return self._frequency_error()
        user.recovery_token = hashlib.sha256(f'r{self._next()}'.encode()).hexdigest()[:32]
        user.recovery_sent_at = self.clock.now()
        self._send(user, 'recovery', user.recovery_token, (qs.get('redirect_to') or [None])[0])
        return self._json(200, {})

    def _password(self, data: dict[str, Any]) -> net.Resp:
        user = self.users.get(data.get('email'))
        if not user or user.password != data.get('password'):
            return self._error(400, 'invalid_credentials', 'Invalid login credentials')
        if not user.confirmed:
            return self._error(400, 'email_not_confirmed', 'Email not confirmed')
        session = self._new_session(user)
        return self._json(200, {**self._token_payload(session), 'user': {'id': user.id, 'email': user.email}})

    def _refresh(self, data: dict[str, Any]) -> net.Resp:
        session = self._find_session(refresh=data.get('refresh_token'))
        if not session or not session['alive']:
            return self._error(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
        session['refresh'] = hashlib.sha1(f'r{self._next()}'.encode()).hexdigest()[:12]
        user = self.users[session['user']]
        session['access'] = self._jwt(user.id, session['id'])
        return self._json(200, {**self._token_payload(session), 'user': {'id': user.id, 'email': user.email}})

    def _get_user(self, bearer: Optional[str]) -> net.Resp:
        session = self._find_session(access=bearer) if bearer else None
        if not session:
            return self._error(401, 'bad_jwt', 'invalid JWT')
        if not session['alive']:
            return self._error(403, 'session_not_found', 'Session from session_id claim in JWT does not exist')
        user = self.users[session['user']]
        return self._json(200, {'id': user.id, 'email': user.email})

    def _put_user(self, bearer: Optional[str], data: dict[str, Any]) -> net.Resp:
        session = self._find_session(access=bearer) if bearer else None
        if not session or not session['alive']:
            return self._error(401, 'bad_jwt', 'invalid JWT')
        user = self.users[session['user']]
        if data.get('password') == user.password:
            return self._error(422, 'same_password', 'New password should be different from the old password.')
        user.password = data['password']
        if self.cfg['revoke_other_sessions']:
            for other in self.sessions.values():
                if other['user'] == user.email and other['id'] != session['id']:
                    other['alive'] = False
        if not self.cfg['recovery_session_survives']:
            session['alive'] = False
        return self._json(200, {'id': user.id, 'email': user.email})

    def _verify(self, qs: dict[str, list[str]]) -> net.Resp:
        token = (qs.get('token') or [''])[0]
        kind = (qs.get('type') or [''])[0]
        redirect = self._effective_redirect((qs.get('redirect_to') or [None])[0])
        error = redirect + '#' + urlencode({'error': 'access_denied', 'error_code': 'otp_expired',
                                            'error_description': 'Email link is invalid or has expired'})
        found: Optional[User] = None
        sent_at: Optional[float] = None
        acts_as = kind
        for user in self.users.values():
            if kind == 'signup' and token in user.confirm_tokens:
                found, sent_at = user, user.confirm_sent_at
            elif kind == 'recovery' and user.recovery_token == token:
                found, sent_at = user, user.recovery_sent_at
            elif self.cfg['accept_cross_type'] and (token in user.confirm_tokens or token == user.recovery_token):
                is_signup = token in user.confirm_tokens
                found, sent_at = user, user.confirm_sent_at if is_signup else user.recovery_sent_at
                acts_as = 'signup' if is_signup else 'recovery'
        expired = found is not None and not self.cfg['ignore_expiry'] and (self.clock.now() - (sent_at or 0)) > self.cfg['otp_expiry']
        if not found or expired:
            return net.Resp(303, {'location': error}, b'')
        if acts_as == 'signup':
            found.confirmed = True
            if not self.cfg['links_are_reusable']:
                found.confirm_tokens = set()
        else:
            if not self.cfg['links_are_reusable']:
                found.recovery_token = None
        session = self._new_session(found)
        payload = self._token_payload(session, acts_as)
        if self.cfg['confirm_without_tokens']:
            return net.Resp(303, {'location': redirect}, b'')
        location = (redirect + '?' + urlencode(payload)) if self.cfg['tokens_in_query'] else (redirect + '#' + urlencode(payload))
        return net.Resp(303, {'location': location}, b'')

    # ---------------------------------------------------------------- convenience for tests
    def provider_state(self, email: str) -> User:
        return self.users[email]
