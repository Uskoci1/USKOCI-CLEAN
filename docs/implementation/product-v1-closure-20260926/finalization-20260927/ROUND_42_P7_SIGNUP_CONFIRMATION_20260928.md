# Round42 — P7 signup confirmation return and resend

Date: 2026-09-28. Functional source introduced at `e3c0f743c8afe8b1e73a1bf5447ddae5b5bd926c`; integrated regression correction at `22d0813b8fbbfe1110d0ef947526574602e968b3`.

## User-visible result

Email signup no longer relies only on the Supabase Site URL/default callback.

Native signup supplies the stable callback:

`uskociapp://auth?form=login`

The post-signup confirmation stage:
- tells the person to confirm email and that the link returns to USKOČI login;
- retains the entered email;
- offers **Pošalji ponovo potvrdu** when confirmation is required;
- reports only **Zahtev za novu potvrdu je prihvaćen** after the SDK accepts resend, never claims delivery;
- serializes duplicate taps through the existing Auth command boundary;
- keeps Edit email and Back to login.

The same callback is supplied to `supabase.auth.resend({type:'signup'})`.

## Ownership / recovery

Resend is allowed only while signed out. It captures the signed-out account revision and rejects a late completion if session/account generation changed. Invalid email is refused before provider I/O. Provider errors are mapped to bounded user copy rather than exposing raw URL/token/internal messages.

No password, token or email-link content is logged or written to repository evidence.

## Provider boundary

This source change does **not** prove:
- that the canonical Supabase project's Redirect URL allowlist contains `uskociapp://auth?form=login`;
- actual SMTP/Gmail delivery;
- expired-link behavior;
- native OS → app deep-link routing on the current APK;
- successful login after a real confirmation.

Supabase official JavaScript Auth documentation supports `emailRedirectTo` for signUp and signup resend; the real project allowlist remains an external runtime prerequisite.

## Exact source proof

GitHub Actions run [36429311101](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36429311101):

- TypeScript: PASS.
- Focused Auth: **4 suites / 66 tests PASS**.
- Full Jest: **347 suites / 7,288 tests PASS**.
- Existing PKG-002 safe-error payload proof was updated to require the new explicit redirect rather than deleting its safety assertion.

No database, Edge, Auth settings or provider configuration was changed in Round42.
