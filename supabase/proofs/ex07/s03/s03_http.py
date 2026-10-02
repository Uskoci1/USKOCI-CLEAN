"""EX-07 S03 - the thin HTTP layer to the DISPOSABLE GoTrue and Mailpit (loopback only, no redirect following).

The transport and the clock are injectable, so test_s03_*.py drive the same code against an in-process fake
provider (fakes.py) without a socket or a sleep. Nothing here prints a credential; callers receive Resp objects
and keep tokens in memory only.
"""
from __future__ import annotations

import dataclasses
import json
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Optional
from urllib.parse import quote, urlencode, urlsplit

import s03_core as core

ALLOWED_PORTS = (54321, 54324)


class Clock:
    def now(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        time.sleep(max(0.0, seconds))

    def sleep_until(self, deadline: float) -> None:
        self.sleep(deadline - self.now())


@dataclasses.dataclass
class Resp:
    status: int
    headers: dict[str, str]
    body: bytes = b''

    def json(self) -> Any:
        try:
            return json.loads(self.body or b'{}')
        except ValueError:
            return {}

    @property
    def location(self) -> Optional[str]:
        return self.headers.get('location')


Transport = Callable[[str, str, dict[str, str], Optional[bytes]], Resp]


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401 - never follow
        return None


def urllib_transport(method: str, url: str, headers: dict[str, str], body: Optional[bytes]) -> Resp:
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(request, timeout=20) as response:
            return Resp(response.status, {k.lower(): v for k, v in response.headers.items()}, response.read())
    except urllib.error.HTTPError as error:
        return Resp(error.code, {k.lower(): v for k, v in error.headers.items()}, error.read() or b'')


def assert_loopback(url: str, ports: tuple[int, ...] = ALLOWED_PORTS) -> None:
    parts = urlsplit(url)
    if parts.scheme != 'http' or parts.hostname != '127.0.0.1' or parts.port not in ports:
        raise ValueError('FOREIGN_TARGET_REFUSED')


class Http:
    def __init__(self, transport: Transport = urllib_transport, ports: tuple[int, ...] = ALLOWED_PORTS) -> None:
        self.transport = transport
        self.ports = ports

    def request(self, method: str, url: str, *, json_body: Any = None, headers: Optional[dict[str, str]] = None) -> Resp:
        assert_loopback(url, self.ports)
        hdrs = {'Accept': 'application/json'}
        body = None
        if json_body is not None:
            hdrs['Content-Type'] = 'application/json'
            body = json.dumps(json_body).encode('utf-8')
        hdrs.update(headers or {})
        return self.transport(method, url, hdrs, body)


@dataclasses.dataclass(frozen=True)
class VerifyOutcome:
    """What following a provider verify link did. `location` carries credentials on success: never printed."""
    kind: str                                  # REDIRECT | JSON_ERROR | UNEXPECTED
    status: int
    location: Optional[str]
    callback: Optional[core.CallbackInfo]
    error_code: str = ''

    @property
    def has_session_tokens(self) -> bool:
        return bool(self.callback and self.callback.kind == 'SESSION_TOKENS')

    @property
    def refused(self) -> bool:
        """An error redirect or an error body, and no session tokens anywhere."""
        if self.has_session_tokens:
            return False
        return self.kind == 'JSON_ERROR' or bool(self.callback and self.callback.kind == 'PROVIDER_ERROR')

    def public(self) -> dict[str, Any]:
        return {'kind': self.kind, 'status': self.status, 'errorCode': self.error_code or (self.callback.error_code if self.callback else None),
                'callback': self.callback.public() if self.callback else None}


class GoTrue:
    def __init__(self, http: Http, api: str, anon_key: str) -> None:
        self.http, self.api, self.anon = http, api.rstrip('/'), anon_key

    def _headers(self, bearer: Optional[str] = None) -> dict[str, str]:
        headers = {'apikey': self.anon}
        if bearer:
            headers['Authorization'] = 'Bearer ' + bearer
        return headers

    @staticmethod
    def _redirect_query(redirect: Optional[str]) -> str:
        return ('?' + urlencode({'redirect_to': redirect})) if redirect else ''

    def settings(self) -> Resp:
        return self.http.request('GET', self.api + '/auth/v1/settings', headers=self._headers())

    def signup(self, email: str, password: str, redirect: Optional[str] = None, data: Optional[dict[str, Any]] = None) -> Resp:
        body: dict[str, Any] = {'email': email, 'password': password}
        if data:
            body['data'] = data
        return self.http.request('POST', self.api + '/auth/v1/signup' + self._redirect_query(redirect), json_body=body, headers=self._headers())

    def resend(self, email: str, redirect: Optional[str] = None) -> Resp:
        return self.http.request('POST', self.api + '/auth/v1/resend' + self._redirect_query(redirect),
                                 json_body={'type': 'signup', 'email': email}, headers=self._headers())

    def recover(self, email: str, redirect: Optional[str] = None) -> Resp:
        return self.http.request('POST', self.api + '/auth/v1/recover' + self._redirect_query(redirect),
                                 json_body={'email': email}, headers=self._headers())

    def password_login(self, email: str, password: str) -> Resp:
        return self.http.request('POST', self.api + '/auth/v1/token?grant_type=password',
                                 json_body={'email': email, 'password': password}, headers=self._headers())

    def refresh(self, refresh_token: str) -> Resp:
        return self.http.request('POST', self.api + '/auth/v1/token?grant_type=refresh_token',
                                 json_body={'refresh_token': refresh_token}, headers=self._headers())

    def get_user(self, access_token: str) -> Resp:
        return self.http.request('GET', self.api + '/auth/v1/user', headers=self._headers(access_token))

    def put_user(self, access_token: str, password: str) -> Resp:
        return self.http.request('PUT', self.api + '/auth/v1/user', json_body={'password': password}, headers=self._headers(access_token))

    def follow_verify(self, url: str, expected_base: Optional[str] = None) -> VerifyOutcome:
        """GET the provider link WITHOUT following its redirect: the app, not a script, receives the callback."""
        parsed = core.parse_verify_link(url)
        if parsed is None:
            raise ValueError('NOT_A_VERIFY_LINK')
        resp = self.http.request('GET', url, headers={'Accept': '*/*'})
        if resp.status in (301, 302, 303, 307, 308) and resp.location:
            return VerifyOutcome('REDIRECT', resp.status, resp.location, core.classify_callback(resp.location, expected_base))
        if resp.status >= 400:
            code, _ = core.gotrue_error(resp.json())
            return VerifyOutcome('JSON_ERROR', resp.status, None, None, code)
        return VerifyOutcome('UNEXPECTED', resp.status, resp.location, None)


class Mailbox:
    def __init__(self, http: Http, base: str, clock: Clock) -> None:
        self.http, self.base, self.clock = http, base.rstrip('/'), clock

    def listing(self) -> dict[str, Any]:
        resp = self.http.request('GET', self.base + '/api/v1/messages?limit=500')
        if resp.status != 200:
            raise RuntimeError('MAILBOX_UNAVAILABLE')
        return resp.json()

    def ids(self) -> set[str]:
        return set(core.message_ids(self.listing()))

    def clear(self) -> None:
        resp = self.http.request('DELETE', self.base + '/api/v1/messages')
        if resp.status >= 400:
            raise RuntimeError('MAILBOX_CLEAR_REFUSED')

    def detail(self, message_id: str) -> dict[str, Any]:
        resp = self.http.request('GET', self.base + '/api/v1/message/' + quote(message_id, safe=''))
        if resp.status != 200:
            raise RuntimeError('MESSAGE_UNAVAILABLE')
        return resp.json()

    def count_for(self, email: str) -> int:
        return len(core.messages_to(self.listing(), email))

    def wait_new(self, email: str, known: set[str], timeout: float = 30.0, settle: float = 1.2) -> list[dict[str, Any]]:
        """Message details addressed to `email` that are not in `known`; waits for the first, then settles to catch duplicates."""
        deadline = self.clock.now() + timeout
        while True:
            fresh = [m for m in core.messages_to(self.listing(), email) if m.get('ID') not in known]
            if fresh:
                self.clock.sleep(settle)
                fresh = [m for m in core.messages_to(self.listing(), email) if m.get('ID') not in known]
                return [self.detail(m['ID']) for m in fresh]
            if self.clock.now() >= deadline:
                raise TimeoutError('SMTP_MESSAGE_NOT_RECEIVED')
            self.clock.sleep(0.4)
