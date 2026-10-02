# EX-07 S03 - signup-confirmation and recovery callbacks, proved on a DISPOSABLE chain

**Evidence label: DISPOSABLE EMULATOR evidence.** It is evidence about the app's code and a *disposable* GoTrue + Mailpit. It is **not** evidence about the hosted Supabase Auth project (Site URL, redirect allowlist, sender, templates), real e-mail delivery, a physical handset or iOS. CI-emulator numbers are never phone numbers. Slice: `EX07-S03` of `docs/implementation/product-v1-closure-20260926/finalization-20260927/EX07_CANONICAL_SCOPE_20261001.md` (gap G05, cards N02/N03). Round note: `docs/implementation/product-v1-closure-20260926/finalization-20260927/ex07/EX07_S03_AUTH_CALLBACKS_PROOF_20261002.md`.

Status of this folder: **SOURCE + offline tests. No CI run has happened yet** (the root pushes, then the workflow runs). Nothing here touches DEV or production, adds a dependency, or needs a secret.

## What it proves

The existing harness (`supabase/proofs/auth/w01_*`, frozen) allowlists only the recovery redirects and runs with `enable_confirmations = false`; it never opened a *signup* link. This folder is a NEW harness (W01 is not edited) with:

* a disposable stack with **e-mail confirmations ON** and **both** app redirects allowlisted (`uskociapp://auth?form=login`, `uskociapp://oporavak`), `otp_expiry` 60 s, `max_frequency` 10 s, no provider rate limit that could starve the proof (`ex07_s03_env.sh`);
* an **HTTP-level proof** of the provider side (no app, no device): the message in Mailpit, the link, the shape of the callback (tokens in the *fragment*), used / wrong / expired links, the resend limit, the redirect allowlist, the recovery chain, and what the provider does with sessions after a recovery (`s03_provider_proof.py`);
* an **emulator proof** of the real app against that stack: UI sign-up, UI resend and its limit, the confirmation callback opened warm and cold, error callbacks, the callback of another account while someone is signed in, a recovery callback while another account is signed in, an old (used) callback replayed, recovery in the UI; and, for everything above, a search of the **logcat** and of the **app's private storage** for every callback credential (`s03_android_proof.py`);
* a **Jest contract** (`src/data/__tests__/ex07-auth-callback-routing.test.ts`, SOURCE/Jest level): the installed Expo Router with the real `+native-intent` and root layout keeps credentials out of router state, route params and the console; the real recovery parser refuses everything that is not a recovery callback; the driver's words still exist in the app source.

## Assertions

`where` = where it can only be shown. `observation` rows record what the provider or the OS does so that a human can judge it; they are never a verdict.

| id | where | kind | what it shows |
| --- | --- | --- | --- |
| `P01` | HTTP-level | assertion | Provider settings require email confirmation with email and signup on (the fields the app availability projection reads) |
| `P02` | HTTP-level | assertion | Signup with the allowlisted confirmation redirect returns no session and an unconfirmed user |
| `P03` | HTTP-level | assertion | The confirmation message reaches Mailpit exactly once; its link is a provider verify link of type signup with redirect_to exactly uskociapp://auth?form=login |
| `P04` | HTTP-level | assertion | Password sign-in is refused before confirmation (email_not_confirmed) and issues no session |
| `P05` | HTTP-level | assertion | The confirmation link redirects to the allowlisted destination with the session tokens in the URL fragment only; the account becomes confirmed and signs in as the same user id |
| `P06` | HTTP-level | assertion | A used confirmation link is refused: error redirect, no tokens |
| `P07` | HTTP-level | assertion | A wrong (tampered) confirmation token is refused: error redirect, no tokens, the account stays unconfirmed |
| `P08` | HTTP-level | assertion | An expired confirmation link is refused: error redirect, no tokens, the account stays unconfirmed |
| `P09` | HTTP-level | assertion | Resend is rate-limited by the configured frequency (429, no message) and an accepted resend produces a new message with a new token |
| `P09b` | HTTP-level | observation | Whether a resend supersedes the older confirmation link |
| `P10` | HTTP-level | assertion | Both allowlisted redirects appear verbatim in provider links; a foreign redirect_to never appears as the link destination |
| `P10b` | HTTP-level | observation | What the provider does with near-miss redirect variants of the allowlisted URLs |
| `P11` | HTTP-level | assertion | The recovery link redirects to uskociapp://oporavak with type=recovery tokens in the fragment only (the shape the app parser requires) |
| `P12` | HTTP-level | assertion | Used, wrong and expired recovery links are refused (error redirect, no tokens) and change no password |
| `P13` | HTTP-level | assertion | Recovery tokens identify exactly their own account; the password change affects only that account (old rejected, new accepted, another account untouched) |
| `P14` | HTTP-level | observation | Session invalidation rule after a recovery password change (other sessions; the recovery session itself) |
| `P15` | HTTP-level | assertion | A signup token cannot act as a recovery token and a recovery token cannot confirm a signup (type mismatch refused) |
| `E01` | emulator | assertion | Fresh install, cold uskociapp://auth?form=login opens the LOGIN form |
| `E02` | emulator | assertion | UI sign-up shows the confirmation stage without a session; the message in Mailpit carries the redirect the app really sent (exactly the allowlisted one) |
| `E03` | emulator | assertion | In-app sign-in before confirmation is refused and stores no session |
| `E04` | emulator | assertion | UI resend says the request was accepted (never delivered), produces a second message; a repeat inside the frequency window shows the rate-limit copy and sends nothing |
| `E05` | emulator | assertion | Warm confirmation callback (app in background): app returns to the Auth surface, adopts no session, shows no token; Back to login and sign-in then work |
| `E06` | emulator | assertion | Cold confirmation callback opens the LOGIN form (not a session); nothing is stored; the confirmed account then signs in |
| `E07` | emulator | assertion | Used, expired and wrong-token confirmation callbacks open the LOGIN form with no session adopted and no provider text or token on screen |
| `E08` | emulator | assertion | A confirmation callback of ANOTHER account opened while someone is signed in leaves that session untouched and adopts nothing |
| `E09` | emulator | assertion | Recovery in the UI: the form shows the callback account, a mismatch writes nothing, the save changes only that account |
| `E10` | emulator | assertion | A recovery callback opened while ANOTHER account is signed in is refused (no form), changes no password and leaves the session untouched; the same callback applied at the provider would have worked (positive control) |
| `E11` | emulator | assertion | An OLD (already used) recovery callback replayed while another account is signed in is refused and changes nobody |
| `E12` | emulator | observation | What the app shows when a used recovery callback is replayed while signed out |
| `E13` | emulator | assertion | No callback token appears in the logcat lines written by the app (app-uid capture) during the whole run |
| `E14` | emulator | assertion | No callback token is persisted in the app private storage (databases, files, shared_prefs, cache) |
| `E15` | emulator | assertion | No callback token or provider text from a callback is visible on any screen the driver read |
| `E16` | emulator | observation | Whether the operating system itself keeps the callback URL: in its activity records and in the system log lines (not written by the app) |

Assertions that **only the CI emulator run can show**: all of `E01`-`E16`. The `P` rows need the CI run too (a real GoTrue; there is no local Postgres or Docker on the owner's PC) but no device. The Jest contract and the offline tests run locally and prove the *script* and the app-side routing, never the provider or the app on a device.

## Reading a result

Every run ends with `RESULT <level> <result> pass=.. fail=.. error=.. not_run=.. unavailable=.. observations=.. head=<sha> run=<id> label="DISPOSABLE EMULATOR evidence"`.

| result | meaning |
| --- | --- |
| `PASS` | every assertion passed (observations are recorded, never judged) |
| `FINDINGS` | at least one assertion evaluated false: a provider or app behaviour that differs from the design. Read the `detail` and the `observed` block. It is a finding, never "adjusted away" |
| `HARNESS_BROKEN` | a script/stack problem (an exception, a stack that is not configured as expected). **Not** a finding about the app |
| `PARTIAL` | some assertions could not run (`NOT_RUN` = a precondition did not hold; `UNAVAILABLE` = the proof cannot see it, e.g. `run-as` cannot read the app storage) |

Any result other than `PASS` makes the job red; the `evidence` job merges both levels into `ex07-s03-evidence.json` (artifact `EX07-S03-EVIDENCE-<run id>`): exact head, run id, label, a per-assertion table with where each ran, and an explicit list of what the document is **not** evidence for.

## Files

| file | role |
| --- | --- |
| `s03_core.py` | pure logic: link/callback parsing, secrets and redaction, logcat/tar/UI scanning, screen classification, guards, report and verdict |
| `s03_http.py` | loopback-only HTTP to GoTrue and Mailpit (the provider redirect is read, never followed) |
| `s03_provider_proof.py` | the HTTP-level proof (`P01`-`P15`) |
| `s03_device.py` | adb, uiautomator, the app's private storage; refuses any device that is not an emulator |
| `s03_android_proof.py` | the emulator proof (`E01`-`E16`) |
| `s03_evidence.py` | merges the per-job reports into one evidence document |
| `ex07_s03_env.sh` | the disposable stack (confirmations ON, both redirects allowlisted) |
| `ex07_s03_build_apk.sh` | the x86_64 proof APK `rs.uskoci.ex07s03proof`, bound to `10.0.2.2:54321` |
| `ex07_s03_run_native.sh` | runs inside the emulator step; never uploads the logcat |
| `ui_labels.json` | the exact on-screen words the driver waits for (pinned against the app source) |
| `callback_shapes.json` | one table of callback shapes read by Python (classifier) and Jest (the REAL parser) |
| `fakes.py`, `fake_app.py` | test doubles (a model of GoTrue and of the auth surface of the app): NOT evidence. `fake_app.py` models ONE copy for a refused sign-in (the bad-credentials sentence); after EX07-S02 the real app has six sign-in failure classes (`src/data/authFailureClasses.ts`, `SIGN_IN_FAILURE_COPY`). The proof never depends on that copy: a refused sign-in is judged by UI state (the login form stays, its button comes back) and by the absence of a stored session, so the model need not follow the classes |
| `test_s03_*.py` | offline tests (python `unittest`) |
| `run_marker.txt` | change it to re-run the workflow without a code change |

## Running

* **CI** (`.github/workflows/ex07-s03-auth-callbacks-proof.yml`): starts on a push to `work/uskoci-ui-unification-20260924` that touches the workflow or this folder (not the `.md` files). `workflow_dispatch` exists too (inputs `scope`: all / provider-only / native-only, and `apk_variant`: release / debug) but GitHub offers it only once the file is on the default branch. Jobs: `offline-logic` -> `provider-http-proof` (parallel) -> `native-apk` -> `native-emulator-proof` -> `evidence`.
* **Offline, locally** (no Docker, no device, no network):
  `python -m unittest discover -s supabase/proofs/ex07/s03 -p "test_*.py"` and
  `npx jest --runTestsByPath src/data/__tests__/ex07-auth-callback-routing.test.ts`.
* **Never** run the emulator driver against a phone: it refuses (`NOT_AN_EMULATOR`). `pm clear` is refused unless the device is an emulator, the package is `rs.uskoci.ex07s03proof`, `GITHUB_ACTIONS=true` and `EX07_S03_ALLOW_CLEAR=1`.

## First failures to expect, and what each means

* `HARNESS_BROKEN` with `PROVIDER_EMAIL_HOURLY_LIMIT`: the stack ignored `[auth.rate_limit]`; the proof stops rather than report a provider limit as a finding. Fix the config, not the assertion.
* `UNAVAILABLE` on `E02`/`E05`/`E08`/`E14`...: `run-as` cannot read the app (the APK is not debuggable). The build script records `debuggable.txt`; re-run with `apk_variant: debug` (the W01 recipe).
* `UI_ELEMENT_NOT_REACHED <label-id> state=<STATE>` (a `HARNESS_BROKEN` scenario with a screenshot and the visible words): the screen is not what `ui_labels.json` expects. A copy change is caught earlier by the contract tests; a layout change shows up here. The words are never guessed: edit `ui_labels.json`, the Jest and Python contract tests then prove the new words exist in the source.
* `E12` and `P14` are observations: if the provider keeps the recovery session valid after the password change, a used recovery callback can still show the recovery form for **its own** account (never for another). Whether the app should sign that session out is a product decision, not a harness one.

## Traps this folder is built around

* `.gitattributes` forces LF under `supabase/proofs/**` and `.github/workflows/*.yml` (a CRLF workflow script is refused by the runner). Bracket patterns in a workflow `paths:` filter make GitHub reject the whole file: none are used.
* The workflow does not start on `src/` pushes (that would restart a 50-minute proof for every UI edit); the label contract catches copy drift in the ordinary Jest run instead.
* The journey drivers (`scripts/p6_native_journey.py`, the RU5 drivers) run a journey at import and `pm clear` whatever emulator is attached: this folder never imports them (a contract test checks it).
* The entry screen stays in the accessibility tree behind the auth sheet with the same words: the driver presses the topmost match, never the first.
* adb output is never printed or kept (an OS launch line can carry a callback credential). Two logcat captures are searched after the run and stay `*.private.txt`, which the workflow never uploads: the lines the app uid wrote (what `E13` judges) and every buffer (the operating system's own lines are reported in `E16`, never as an app finding). If a credential is ever visible on screen (`E15`), every screenshot is withheld.
* An unreadable app store is never an empty one: `read_storage()` returns `None` (`UNAVAILABLE`) unless the data directory could be listed and every database file copied and parsed; a torn copy of a live database is retried, then `None`.

## How to continue (another agent, no memory of the session)

1. The root commits and pushes (explicit pathspecs: the workflow, this folder, the round note, `src/data/__tests__/ex07-auth-callback-routing.test.ts`); the workflow starts by itself. A re-run without a code change: edit `run_marker.txt`.
2. Read the `evidence` job and the artifacts `EX07-S03-EVIDENCE-<run id>`, `EX07-S03-PROVIDER-<run id>`, `EX07-S03-NATIVE-<run id>`. Quote every result with the exact head, the run id and the label above.
3. Triage in this order: `provider-http-proof` `HARNESS_BROKEN` (stack config, or a real GoTrue answer that differs from the model in `fakes.py`: change the model and the assertion together and write the finding down) -> `native-apk` (`debuggable.txt`; try `apk_variant: debug`) -> `UI_ELEMENT_NOT_REACHED <label-id>` (edit `ui_labels.json`; the Jest and Python contract tests prove the words exist in the app source) -> a real `FAIL` is a finding and is never adjusted away.
4. Round note with the verified results, the design findings and the highest-risk assumptions: `docs/implementation/product-v1-closure-20260926/finalization-20260927/ex07/EX07_S03_AUTH_CALLBACKS_PROOF_20261002.md`.
* The device's time zone is set to Europe/Belgrade on a best-effort basis (as for the QA emulator); nothing here depends on it.
