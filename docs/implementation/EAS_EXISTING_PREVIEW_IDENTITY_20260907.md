# Existing EAS Android preview identity — 2026-09-07

State: **SOURCE CONFIGURED / READ-ONLY IDENTITY VERIFIED / BUILD AND PUSH NOT PROVEN**. Base canonical commit: `9d245f3053c8e79370a73e82b12d4250e3ed94b7` (PR #54). This unit retains current application source and links it to the owner's existing EAS project; it creates no project and imports no historical build code.

## Selected identity and evidence

| Boundary | Observed or configured value |
| --- | --- |
| App label / slug / owner | USKOČI / uskoci / sljivas-team |
| Existing EAS project | `1e6cc490-9851-4741-9226-128612122db6` / `@sljivas-team/uskoci` |
| Android application ID | `rs.uskoci.preview` |
| Expected existing team signing certificate SHA-256 | `df2edf3f91abcb1df10eac03802ba55caedc29aee3d7188846182e0e49015782` |
| Existing default Android build credential | `3125abb1-bb30-40e3-8528-495865839ffe` |
| Existing team keystore metadata ID | `d2eed5ee-6012-42e6-ba3e-009f5c6cbb6f` |
| Intended preview backend | `https://leqcwgzvjsxugfgzdmth.supabase.co` |
| Owner-confirmed Firebase project / number | `uskoci-ed59b` / `383421751370` |
| Owner-confirmed Firebase Android App ID | `1:383421751370:android:3e19dd87280aa317a986b3` |

The parent agent's existing-auth metadata snapshot at 10:28:09.547 UTC showed that the authenticated Expo account owns both the personal and team projects. The user delegated selection of an existing Play signing lineage if accessible, otherwise the existing team project. The parent's browser inspection after the owner's Google login showed a Play developer-account signup page, with no existing developer account accessible there. The existing team fallback was therefore selected. This observation does not prove that no Play account exists elsewhere.

Both EAS projects have the same application ID but different signing certificates. They are not interchangeable upgrades on an installed device merely because their package names match. No keystore or private signing material was downloaded or changed. The expected hash above comes from EAS credential metadata; a future APK must independently match it through its actual signing certificate.

Read-only CLI `eas-cli/23.2.0 win32-x64 node-v24.18.0` physically returned:
- `project:info`: `@sljivas-team/uskoci`, `1e6cc490-9851-4741-9226-128612122db6`.
- `build:version:get --platform android --profile preview --non-interactive --json`: `{}`. The CLI also reported no plain-text/sensitive variables in the preview environment.

Original safe metadata and command-result provenance are in [evidence](evidence/eas-existing-identity-20260907/). Only metadata was queried; credential contents, old application source and build artifacts were not read.

## Source changes and version boundary

`app.json` uses the selected existing project, owner, slug, name and Android package. Current source `version: 1.0.0` is retained. `eas.json` defines only an Android preview internal APK profile with remote credentials, remote version management and automatic build-version increment. It adds no submit profile, update channel or release activation.

The current remote Android counter is uninitialized; historical build records are not the remote counter. The observed latest team build was 33 and the personal project had 34. Source `android.versionCode: 35` provides an explicit floor above both observed historical builds. Installed CLI 23.2.0's `resolveRemoteVersionCodeAsync` reads a configured local version when the remote version is absent, then increments it under `autoIncrement: true`; with this state the first future build should use 36. This is a prediction from inspected code, not an observed APK version. If the remote counter changes, it takes precedence and must be re-read. No `build:version:set` or remote version mutation occurred. [Expo version management](https://docs.expo.dev/build-reference/app-versions/)

The dependency-free `eas-build-pre-install` hook fails early for wrong project/package/profile/version floor, missing or foreign backend URL, absent/nonpublic key form and every fake/test composition switch actually used by `src/data/index.ts` (`EXPO_PUBLIC_USE_FAKE_SOURCE=1`, `NODE_ENV=test`, or defined `JEST_WORKER_ID`). It accepts publishable-key syntax or an anon JWT with the confirmed project ref. This is a format/identity guard, not signature validation or an Auth test. Diagnostics never include supplied keys. It reads local JSON and environment only, before EAS dependency installation; existing local disposable proof workflows do not call it. [Expo lifecycle hooks](https://docs.expo.dev/build-reference/npm-hooks/)

## Remaining acceptance

The metadata snapshot contains configured FCM V1 service-account metadata referencing `uskoci-ed59b`; it does not establish working Firebase client configuration, token registration or delivery. A subsequent physical Firebase Console inspection by the parent agent confirmed project `uskoci-ed59b`, project number `383421751370`, Android app `1:383421751370:android:3e19dd87280aa317a986b3` and package `rs.uskoci.preview`. FCM V1 was enabled, Legacy was disabled and the Android SHA certificate grid was empty. This supersedes the earlier app-list access failure; the empty grid is an observed configuration value, not proof of a signing mismatch or working token registration.

The user reported downloading the public client `google-services.json`, but its actual filesystem path/file is still pending and it has not been found in Downloads at this checkpoint. No client configuration was fabricated or added. The next native Firebase source unit starts from that actual file and must preserve the disposable proof package overrides. EAS project environment metadata was empty in the recorded read. No EAS environment variables were written by this unit.

Before an authorized preview build, provide the required public backend environment through the selected EAS preview environment, re-read project/remote version/default signing metadata and finish the Firebase client configuration boundary as appropriate for the separately implemented native push unit. A future artifact must prove current source lineage, actual package/version/certificate, real Auth and product flows. Native permission/token lifecycle, backend registration, provider dispatch/tickets/receipts and device delivery remain separate proof. FCM credentials and the client config file serve different purposes. [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)

No EAS build, submit, update, remote version initialization, credential mutation, production database write or feature activation was performed. The existing N08 live85/pending0 checkpoint from PR #54 remains unchanged.

## Validation

- Installed EAS configuration schema and resolved Expo configuration: PASS.
- EAS preflight: 31 focused tests, including real CLI failure/log-redaction behavior: PASS.
- Full Jest: 38 suites / 263 tests PASS after restoring five CRLF-expanded proof-candidate working copies to their exact canonical Git blobs. The initial Windows checkout produced three EOL-only failures in two existing notification suites; no tracked candidate or migration content changed.
- TypeScript and migration integrity: PASS (`85 source / 85 recorded live / 0 pending`).
- Physical EAS APK, signing-artifact validation, Firebase client registration and native push: NOT EXECUTED by this unit.
