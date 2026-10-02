"""EX-07 S03 - HTTP-level proof of signup-confirmation and recovery callbacks against a DISPOSABLE GoTrue + Mailpit.

What this is: the provider half of gap G05 (EX07_CANONICAL_SCOPE_20261001.md): confirmations enabled, both app redirects
allowlisted, the message in the mailbox, the link, the callback shape, the used / wrong / expired link, the resend limit,
the redirect allowlist, the recovery chain and the session rule after a recovery. No app, no device, no mock: real GoTrue
over loopback HTTP, real Mailpit. The provider redirect is never followed: the callback is classified, not fetched.

What this is NOT: the hosted Supabase Auth dashboard (Site URL, allowlist, sender, templates), real e-mail delivery, a
physical handset, iOS. See the label and the `claims` block of the report.

Run by .github/workflows/ex07-s03-auth-callbacks-proof.yml (job provider-http-proof):  python3 s03_provider_proof.py
"""
from __future__ import annotations

import dataclasses
import json
import os
import secrets as _secrets
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable, Optional

import s03_core as core
import s03_http as net

ALLOWED = (core.SIGNUP_REDIRECT, core.RECOVERY_REDIRECT)
FOREIGN = ('https://attacker.example/cb', 'uskociapp://evil')
NEAR_MISS = ('uskociapp://auth?form=recovery', 'uskociapp://auth', 'uskociapp://auth?form=login&x=1',
             'uskociapp://oporavak?x=1', 'uskociapp://oporavak/extra')
RECOVERY_KEYS = {'access_token', 'refresh_token', 'type'}


class HarnessConfigError(RuntimeError):
    """The disposable stack is not configured the way this proof needs: a harness problem, never a finding."""


@dataclasses.dataclass
class Account:
    tag: str
    email: str
    password: str
    user_id: Optional[str] = None


class Ctx:
    def __init__(self, gt: net.GoTrue, mail: net.Mailbox, clock: net.Clock, report: core.Report, secrets: core.SecretSet,
                 suffix: Optional[str] = None) -> None:
        self.gt, self.mail, self.clock, self.report, self.secrets = gt, mail, clock, report, secrets
        self.suffix = suffix or _secrets.token_hex(4)
        self.known: set[str] = set()
        self.expiry: dict[str, tuple[Account, net.VerifyLink, float]] = {}
        self.sessions: dict[str, Any] = {}

    def account(self, tag: str) -> Account:
        return Account(tag, f'ex07-s03-{tag}-{self.suffix}@example.test', _secrets.token_hex(12) + 'Aa9')


def is_hourly_limit(message: str) -> bool:
    text = message.lower()
    return 'rate limit' in text and 'seconds' not in text


def guard_limits(resp: net.Resp) -> None:
    if resp.status == 429:
        code, msg = core.gotrue_error(resp.json())
        if is_hourly_limit(msg):
            raise HarnessConfigError('PROVIDER_EMAIL_HOURLY_LIMIT: raise [auth.rate_limit] email_sent in the disposable config')


def signup(ctx: Ctx, acct: Account, redirect: Optional[str] = core.SIGNUP_REDIRECT, data: Optional[dict[str, Any]] = None) -> net.Resp:
    resp = ctx.gt.signup(acct.email, acct.password, redirect=redirect, data=data)
    guard_limits(resp)
    body = resp.json()
    user = body.get('user') if isinstance(body.get('user'), dict) else body
    acct.user_id = user.get('id') if isinstance(user, dict) else None
    return resp


def mail_link(ctx: Ctx, acct: Account, kind: str = 'signup', timeout: float = 30.0) -> tuple[net.VerifyLink, int]:
    msgs = ctx.mail.wait_new(acct.email, ctx.known, timeout=timeout)
    ctx.known.update(m['ID'] for m in msgs if m.get('ID'))
    links = [link for m in msgs for link in core.verify_links(m)]
    chosen = [link for link in links if link.kind == kind]
    if not chosen:
        raise LookupError(f'NO_VERIFY_LINK kind={kind} messages={len(msgs)} links={len(links)}')
    return chosen[0], len(msgs)


def confirm_account(ctx: Ctx, tag: str) -> Account:
    acct = ctx.account(tag)
    signup(ctx, acct)
    link, _ = mail_link(ctx, acct)
    out = ctx.gt.follow_verify(link.url, core.SIGNUP_REDIRECT)
    if out.callback:
        ctx.secrets.add_callback(out.callback)
    if out.kind != 'REDIRECT' or out.refused:
        raise HarnessConfigError('CONFIRMATION_FIXTURE_FAILED')
    status, _, uid, _ = login_ids(ctx, acct)           # the account is confirmed when the provider lets it sign in
    if status != 200 or uid != acct.user_id:
        raise HarnessConfigError('CONFIRMATION_FIXTURE_NOT_CONFIRMED')
    return acct


def login_ids(ctx: Ctx, acct: Account, password: Optional[str] = None) -> tuple[int, str, Optional[str], dict[str, Any]]:
    resp = ctx.gt.password_login(acct.email, password or acct.password)
    body = resp.json()
    code, _ = core.gotrue_error(body)
    user = body.get('user') if isinstance(body.get('user'), dict) else {}
    return resp.status, code, user.get('id'), body


# ------------------------------------------------------------------------------------------------ scenarios
def s_settings(ctx: Ctx) -> None:
    resp = ctx.gt.settings()
    body = resp.json()
    ext = body.get('external') if isinstance(body.get('external'), dict) else {}
    ok = (resp.status == 200 and ext.get('email') is True and isinstance(ext.get('phone'), bool)
          and body.get('disable_signup') is False and body.get('mailer_autoconfirm') is False)
    ctx.report.expect('P01', ok, 'public settings projection', status=resp.status, email=ext.get('email'), phone=ext.get('phone'),
                      disableSignup=body.get('disable_signup'), mailerAutoconfirm=body.get('mailer_autoconfirm'))


def s_expiry_setup(ctx: Ctx) -> None:
    """Create the two links that must EXPIRE now, so the 60 s window runs while the other scenarios work."""
    c = ctx.account('expired-signup')
    signup(ctx, c)
    link_c, _ = mail_link(ctx, c)
    ctx.expiry['signup'] = (c, link_c, ctx.clock.now())
    g = confirm_account(ctx, 'expired-recovery')
    resp = ctx.gt.recover(g.email, redirect=core.RECOVERY_REDIRECT)
    guard_limits(resp)
    link_g, _ = mail_link(ctx, g, 'recovery')
    ctx.expiry['recovery'] = (g, link_g, ctx.clock.now())


def s_signup_happy(ctx: Ctx) -> None:
    r, gt, mail = ctx.report, ctx.gt, ctx.mail
    a = ctx.account('a')
    resp = signup(ctx, a, core.SIGNUP_REDIRECT, data={'first_name': 'Test', 'last_name': 'Proof', 'city': 'Test'})
    body = resp.json()
    user = body.get('user') if isinstance(body.get('user'), dict) else body
    no_session = 'access_token' not in body and not isinstance(body.get('session'), dict)
    r.expect('P02', resp.status == 200 and no_session and bool(a.user_id) and not user.get('email_confirmed_at'),
             'signup answer', status=resp.status, hasAccessToken='access_token' in body, confirmed=bool(user.get('email_confirmed_at')))
    link, count = mail_link(ctx, a)
    after = mail.count_for(a.email)
    r.expect('P03', link.kind == 'signup' and link.redirect_to == core.SIGNUP_REDIRECT
             and (link.host, link.port) == ('127.0.0.1', 54321) and count == 1 and after == 1,
             'confirmation message', link=link.public(), messagesToAddress=after)
    status, code, _, login_body = login_ids(ctx, a)
    r.expect('P04', status == 400 and code == 'email_not_confirmed' and 'access_token' not in login_body,
             'sign-in before confirmation', status=status, errorCode=code)
    # The resend limit: a repeat inside max_frequency is refused and sends nothing.
    again = gt.resend(a.email, core.SIGNUP_REDIRECT)
    guard_limits(again)
    code2, _ = core.gotrue_error(again.json())
    ctx.clock.sleep(1.5)
    r.expect('P09', again.status == 429 and mail.count_for(a.email) == 1, 'resend inside the frequency window',
             status=again.status, errorCode=code2, messagesToAddress=mail.count_for(a.email))
    out = gt.follow_verify(link.url, core.SIGNUP_REDIRECT)
    cb = out.callback
    if cb:
        ctx.secrets.add_callback(cb)
    shaped = (out.kind == 'REDIRECT' and out.has_session_tokens and cb.base_matches
              and cb.callback_type == 'signup' and not cb.tokens_in_query)
    s2, _, uid, _ = login_ids(ctx, a)
    r.expect('P05', shaped and s2 == 200 and uid == a.user_id, 'confirmation callback and sign-in afterwards',
             outcome=out.public(), signInStatus=s2, sameUser=(uid == a.user_id))
    used = gt.follow_verify(link.url, core.SIGNUP_REDIRECT)
    r.expect('P06', used.refused, 'replay of a used link', outcome=used.public())


def s_wrong_token(ctx: Ctx) -> None:
    b = ctx.account('wrong')
    signup(ctx, b)
    link, _ = mail_link(ctx, b)
    out = ctx.gt.follow_verify(core.tamper_token(link.url), core.SIGNUP_REDIRECT)
    status, code, _, _ = login_ids(ctx, b)
    ctx.report.expect('P07', out.refused and code == 'email_not_confirmed', 'tampered token',
                      outcome=out.public(), signInErrorCode=code)


def s_resend_supersede(ctx: Ctx) -> None:
    d = ctx.account('resend')
    t0 = ctx.clock.now()
    signup(ctx, d)
    link1, _ = mail_link(ctx, d)
    ctx.clock.sleep_until(t0 + core.MAX_FREQUENCY_SECONDS + 1.0)
    resp = ctx.gt.resend(d.email, core.SIGNUP_REDIRECT)
    guard_limits(resp)
    link2, _ = mail_link(ctx, d)
    ctx.report.expect('P09', resp.status == 200 and link2.url != link1.url, 'accepted resend gives a new message with a new token',
                      status=resp.status, tokenChanged=(link2.url != link1.url))
    out1 = ctx.gt.follow_verify(link1.url, core.SIGNUP_REDIRECT)
    out2 = ctx.gt.follow_verify(link2.url, core.SIGNUP_REDIRECT)
    for out in (out1, out2):
        if out.callback:
            ctx.secrets.add_callback(out.callback)
    ctx.report.observe('P09b', 'older link after a resend', olderLinkStillConfirms=out1.has_session_tokens,
                       older=out1.public(), newer=out2.public())


def _redirect_outcome(ctx: Ctx, tag: str, redirect: str) -> dict[str, Any]:
    acct = ctx.account(tag)
    resp = signup(ctx, acct, redirect)
    if resp.status >= 400:
        code, _ = core.gotrue_error(resp.json())
        return {'requested': redirect, 'outcome': 'REFUSED', 'status': resp.status, 'errorCode': code}
    try:
        link, _ = mail_link(ctx, acct, timeout=10.0)
    except TimeoutError:
        return {'requested': redirect, 'outcome': 'NO_MESSAGE', 'status': resp.status}
    return {'requested': redirect, 'outcome': core.evaluate_redirect_to(link.redirect_to, redirect, ALLOWED),
            'observedRedirect': link.redirect_to}


def _recover_outcome(ctx: Ctx, acct: Account, redirect: str) -> dict[str, Any]:
    resp = ctx.gt.recover(acct.email, redirect=redirect)
    guard_limits(resp)
    if resp.status >= 400:
        code, _ = core.gotrue_error(resp.json())
        return {'requested': redirect, 'outcome': 'REFUSED', 'status': resp.status, 'errorCode': code}
    try:
        link, _ = mail_link(ctx, acct, 'recovery', timeout=15.0)
    except TimeoutError:
        return {'requested': redirect, 'outcome': 'NO_MESSAGE', 'status': resp.status}
    return {'requested': redirect, 'outcome': core.evaluate_redirect_to(link.redirect_to, redirect, ALLOWED),
            'observedRedirect': link.redirect_to}


def s_redirects(ctx: Ctx) -> None:
    r = ctx.report
    allowed = _redirect_outcome(ctx, 'allow-oporavak', core.RECOVERY_REDIRECT)
    foreign = [_redirect_outcome(ctx, f'foreign{i}', url) for i, url in enumerate(FOREIGN)]
    near = [_redirect_outcome(ctx, f'near{i}', url) for i, url in enumerate(NEAR_MISS)]
    # a foreign destination asked of the recovery endpoint, for an existing account
    recover_outcome = _recover_outcome(ctx, confirm_account(ctx, 'redirect-recover'), FOREIGN[0])
    safe = {'REFUSED', 'SITE_URL', 'ABSENT'}
    ok = (allowed['outcome'] == 'EXACT' and all(f['outcome'] in safe for f in foreign + [recover_outcome]))
    r.expect('P10', ok, 'allowlisted redirects verbatim, foreign ones never the destination',
             allowlisted=allowed, foreign=foreign, recover=recover_outcome)
    r.observe('P10b', 'near-miss variants', variants=near,
              accepted=[n['requested'] for n in near if n['outcome'] == 'EXACT'])


def s_recovery_main(ctx: Ctx) -> None:
    r, gt = ctx.report, ctx.gt
    f = confirm_account(ctx, 'recover')
    other = confirm_account(ctx, 'bystander')
    ctx.sessions['bystander'] = other
    status0, _, uid0, body0 = login_ids(ctx, f)                  # an earlier session of the same account (another device)
    s0_refresh = body0.get('refresh_token') if status0 == 200 else None
    resp = gt.recover(f.email, redirect=core.RECOVERY_REDIRECT)
    guard_limits(resp)
    link, _ = mail_link(ctx, f, 'recovery')
    out = gt.follow_verify(link.url, core.RECOVERY_REDIRECT)
    cb = out.callback
    if cb:
        ctx.secrets.add_callback(cb)
    keys_ok = bool(cb) and RECOVERY_KEYS.issubset(set(cb.fragment_keys))
    r.expect('P11', resp.status == 200 and link.redirect_to == core.RECOVERY_REDIRECT and out.kind == 'REDIRECT'
             and out.has_session_tokens and cb.base_matches and cb.callback_type == 'recovery'
             and not cb.tokens_in_query and keys_ok, 'recovery link and callback shape',
             requestStatus=resp.status, link=link.public(), outcome=out.public())
    if not (cb and cb.kind == 'SESSION_TOKENS'):
        raise HarnessConfigError('RECOVERY_CALLBACK_HAS_NO_TOKENS')
    secrets_by_label = dict(cb.secrets)
    access, refresh = secrets_by_label['access_token'], secrets_by_label['refresh_token']
    who = gt.get_user(access)
    who_id = (who.json() or {}).get('id')
    new_password = _secrets.token_hex(12) + 'Bb7'
    put = gt.put_user(access, new_password)
    old_status, old_code, _, _ = login_ids(ctx, f)
    new_status, _, new_uid, _ = login_ids(ctx, f, new_password)
    by_status, _, by_uid, _ = login_ids(ctx, other)
    r.expect('P13', who.status == 200 and who_id == f.user_id and put.status == 200 and old_status == 400
             and old_code == 'invalid_credentials' and new_status == 200 and new_uid == f.user_id
             and by_status == 200 and by_uid == other.user_id, 'recovery tokens act on their own account only',
             tokenUserMatches=(who_id == f.user_id), updateStatus=put.status, oldPasswordStatus=old_status,
             newPasswordStatus=new_status, bystanderStatus=by_status, bystanderSameUser=(by_uid == other.user_id))
    used = gt.follow_verify(link.url, core.RECOVERY_REDIRECT)
    still, _, _, _ = login_ids(ctx, f, new_password)
    r.expect('P12', used.refused and still == 200, 'replay of a used recovery link', outcome=used.public(), passwordStillNew=(still == 200))
    # P14: the existing session rule, as observed
    user_after = gt.get_user(access)
    old_refresh = gt.refresh(s0_refresh) if s0_refresh else None
    recovery_refresh = gt.refresh(refresh)
    r.observe('P14', 'sessions after the recovery password change',
              otherSessionRefreshStatus=(old_refresh.status if old_refresh else None),
              otherSessionRevoked=(None if old_refresh is None else old_refresh.status >= 400),
              recoverySessionUserStatus=user_after.status, recoverySessionRefreshStatus=recovery_refresh.status,
              recoverySessionSurvivesPasswordChange=(user_after.status == 200),
              note='the callback tokens stay usable for their own account while this is true')


def s_recovery_wrong(ctx: Ctx) -> None:
    g = confirm_account(ctx, 'recover-wrong')
    resp = ctx.gt.recover(g.email, redirect=core.RECOVERY_REDIRECT)
    guard_limits(resp)
    link, _ = mail_link(ctx, g, 'recovery')
    out = ctx.gt.follow_verify(core.tamper_token(link.url), core.RECOVERY_REDIRECT)
    status, _, uid, _ = login_ids(ctx, g)
    ctx.report.expect('P12', out.refused and status == 200 and uid == g.user_id, 'tampered recovery token',
                      outcome=out.public(), passwordUnchanged=(status == 200))


def s_cross_type(ctx: Ctx) -> None:
    h = ctx.account('cross-signup')
    signup(ctx, h)
    link_h, _ = mail_link(ctx, h)
    swapped = ctx.gt.follow_verify(core.swap_link_type(link_h.url, 'recovery'), core.RECOVERY_REDIRECT)
    status_h, code_h, _, _ = login_ids(ctx, h)
    f2 = confirm_account(ctx, 'cross-recovery')
    resp = ctx.gt.recover(f2.email, redirect=core.RECOVERY_REDIRECT)
    guard_limits(resp)
    link_f, _ = mail_link(ctx, f2, 'recovery')
    as_signup = ctx.gt.follow_verify(core.swap_link_type(link_f.url, 'signup'), core.SIGNUP_REDIRECT)
    status_f, _, uid_f, _ = login_ids(ctx, f2)
    ctx.report.expect('P15', swapped.refused and code_h == 'email_not_confirmed' and as_signup.refused and status_f == 200 and uid_f == f2.user_id,
                      'type mismatch', signupTokenAsRecovery=swapped.public(), recoveryTokenAsSignup=as_signup.public(),
                      signupAccountStillUnconfirmed=(code_h == 'email_not_confirmed'), recoveryAccountUnchanged=(status_f == 200))


def s_expiry_checks(ctx: Ctx) -> None:
    c, link_c, t_c = ctx.expiry['signup']
    g, link_g, t_g = ctx.expiry['recovery']
    ctx.clock.sleep_until(max(t_c, t_g) + core.OTP_EXPIRY_SECONDS + 3.0)
    out_c = ctx.gt.follow_verify(link_c.url, core.SIGNUP_REDIRECT)
    status_c, code_c, _, _ = login_ids(ctx, c)
    ctx.report.expect('P08', out_c.refused and code_c == 'email_not_confirmed', 'expired signup link',
                      outcome=out_c.public(), signInErrorCode=code_c, waitedSeconds=round(ctx.clock.now() - t_c))
    out_g = ctx.gt.follow_verify(link_g.url, core.RECOVERY_REDIRECT)
    status_g, _, uid_g, _ = login_ids(ctx, g)
    ctx.report.expect('P12', out_g.refused and status_g == 200 and uid_g == g.user_id, 'expired recovery link',
                      outcome=out_g.public(), passwordUnchanged=(status_g == 200))


SCENARIOS: list[tuple[str, tuple[str, ...], Callable[[Ctx], None]]] = [
    ('settings', ('P01',), s_settings),
    ('expiry-setup', ('P08', 'P12'), s_expiry_setup),
    ('signup-happy-path', ('P02', 'P03', 'P04', 'P05', 'P06', 'P09'), s_signup_happy),
    ('wrong-token', ('P07',), s_wrong_token),
    ('resend', ('P09', 'P09b'), s_resend_supersede),
    ('redirect-allowlist', ('P10', 'P10b'), s_redirects),
    ('recovery-main', ('P11', 'P12', 'P13', 'P14'), s_recovery_main),
    ('recovery-wrong-token', ('P12',), s_recovery_wrong),
    ('cross-type', ('P15',), s_cross_type),
    ('expiry-checks', ('P08', 'P12'), s_expiry_checks),
]


def run_all(ctx: Ctx, scenarios: Optional[list[tuple[str, tuple[str, ...], Callable[[Ctx], None]]]] = None) -> None:
    for name, ids, fn in (scenarios or SCENARIOS):
        started = ctx.clock.now()
        try:
            fn(ctx)
            ctx.report.step(name, outcome='OK', seconds=round(ctx.clock.now() - started, 1))
        except Exception as error:      # a harness problem: every check of the scenario is ERROR, never a finding
            for check_id in ids:
                ctx.report.error(check_id, error)
            ctx.report.step(name, outcome='ERROR', seconds=round(ctx.clock.now() - started, 1),
                            error=core.sanitize_exception(error, ctx.secrets))


# ------------------------------------------------------------------------------------------------ entry point
def git_head() -> str:
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return 'unknown'


def source_block() -> dict[str, Any]:
    env = os.environ
    return {'head': git_head(), 'githubSha': env.get('GITHUB_SHA'), 'runId': env.get('GITHUB_RUN_ID', 'local'),
            'runAttempt': env.get('GITHUB_RUN_ATTEMPT'), 'workflow': env.get('GITHUB_WORKFLOW'), 'ref': env.get('GITHUB_REF')}


def print_summary(data: dict[str, Any]) -> None:
    for row in data['assertions']:
        print(f"{row['status']:<11} {row['id']:<5} {row['title'][:96]}")
        if row['status'] not in ('PASS', 'OBSERVATION') and row.get('detail'):
            print('            ' + row['detail'][:300])
    for step in data['timeline']:
        print('step', json.dumps(step, sort_keys=True))
    print(core.result_line(data))


def main(argv: Optional[list[str]] = None, *, transport: Optional[net.Transport] = None, clock: Optional[net.Clock] = None) -> int:
    env = os.environ
    api = env.get('EX07_API_URL', '')
    mail_url = env.get('EX07_MAIL_URL', '')
    anon = env.get('EX07_ANON_KEY', '')
    if api != 'http://127.0.0.1:54321' or mail_url != 'http://127.0.0.1:54324' or not anon:
        print('REFUSED: only the disposable loopback GoTrue and Mailpit may be used (EX07_API_URL, EX07_MAIL_URL, EX07_ANON_KEY)')
        return 2
    out_dir = Path(env.get('EX07_OUT', 'artifacts/ex07-s03-provider'))
    out_dir.mkdir(parents=True, exist_ok=True)
    secrets = core.SecretSet()
    http = net.Http(transport or net.urllib_transport)
    clock = clock or net.Clock()
    meta = {'schemaVersion': 1, 'slice': core.SLICE, 'label': core.LABEL, 'labelDetail': core.LABEL_DETAIL, 'source': source_block(),
            'environment': {'kind': 'disposable-loopback-gotrue-and-mailpit', 'gotrueImage': env.get('EX07_GOTRUE_IMAGE'),
                            'supabaseCli': env.get('EX07_SUPABASE_CLI'), 'otpExpirySeconds': core.OTP_EXPIRY_SECONDS,
                            'maxFrequencySeconds': core.MAX_FREQUENCY_SECONDS, 'siteUrl': core.SITE_URL,
                            'allowlist': list(ALLOWED)}}
    report = core.Report('HTTP', meta, secrets)
    ctx = Ctx(net.GoTrue(http, api, anon), net.Mailbox(http, mail_url, clock), clock, report, secrets)
    try:
        ctx.mail.clear()
    except Exception as error:
        report.step('mailbox-clear', outcome='ERROR', error=core.sanitize_exception(error, secrets))
    started = time.time()
    run_all(ctx)
    data = report.finalize()
    data['seconds'] = round(time.time() - started)
    text = json.dumps(data, indent=2, ensure_ascii=False)
    assert not secrets.find_in_text(text), 'the report would contain a credential'
    (out_dir / 'provider-report.json').write_text(text + '\n', encoding='utf-8')
    print_summary(data)
    return 0 if data['result'] == 'PASS' else 1


if __name__ == '__main__':
    sys.exit(main())
