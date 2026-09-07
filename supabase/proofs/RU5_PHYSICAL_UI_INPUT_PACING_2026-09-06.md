# RU-5 physical Android input pacing follow-up

Prior entry and focus incidents: `RU5_PHYSICAL_UI_SAFE_AREA_INCIDENT_2026-09-06.md`.

## Run 34061253678: native focus passed, full email readback failed

Proof head `a95d25a2d02d6e55f76042359bd4b621a389d435`, job `101562089162`, passed TypeScript, 150 Jest tests, 9 Python input tests, disposable live-79 reconstruction, APK build and the local-only bundle check. Artifact `9997811502` was downloaded (ZIP SHA-256 `d68f57aa11e68846da43ce4eada8382ec03ea48b19c50da33f71d7d4f8ef8e93`). `proof-build.txt` binds APK SHA-256 `109871b0da833f9b864da334fee6d05e4666c0efde976fc7ebc8d70d782c0a18` to the run/source.

The entry auth sheet again opened on attempt 1. Four attempts obtained native email focus but failed exact readback. Both timeout/failure XMLs show the same 50-character prefix of the generated 68-character email, without its remaining UUID/domain; the real PNG shows the caret at that truncated end. Password remains its placeholder. No login submit or marketplace journey was performed. Auth source has no maxLength restriction. The artifact proves a native-input mismatch, not a 50-character product policy or a particular RN root cause.

## Minimal next correction

Harness-only paced typing issues one real `adb shell input text` character at a time, with a 150 ms inter-character pause, retaining native focus verification, keyboard select-all/delete, exact full plaintext readback and masked password-length readback. Its bounded 180-second input deadline is a harness timeout, not a product policy. Only transport-safe synthetic fixture characters are accepted by this helper; production input rules are unchanged. No prefix is accepted as success, no credential is shortened, no accessibility setText or direct Auth/RPC is used. Full real Auth and all 13 states still require a new physical run.

Fourteen deterministic input tests pass locally, including a full-length 68-character fixture, a dropped character/replacement retry, partial password rejection, bounded deadline and secret-safe diagnostics. These are harness unit tests, not device evidence.

## Fixture target safety, before any disposable seed write

The existing fixture checked environment presence but did not itself validate API/DB targets before creating clients and performing writes. All inspected runs used loopback targets; no production write incident is claimed. Add an explicit pre-write guard for the existing local reconstruction contract (`http://127.0.0.1:54321` and PostgreSQL loopback port 54322/postgres), reject remote/spoofed/credentialed API URLs and malformed DB targets, and avoid credentials in errors. Nineteen Node tests pass locally and are wired before reconstruction/fixture in CI. This does not modify live Supabase or the production application.

Current status: physical UI unit NOT PROVEN; aggregate RU-5 NOT CLOSED / DECISION-REQUIRED. No PR, merge, live write, gated activation or new release unit is implied by these corrections.
