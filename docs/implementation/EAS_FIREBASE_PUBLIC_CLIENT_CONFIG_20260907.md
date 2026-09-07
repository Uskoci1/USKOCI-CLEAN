# Existing preview Firebase client configuration — 2026-09-07

State: **IMPLEMENTED / LOCAL CONFIG PROVEN / REVIEW PENDING / APK AND PUSH UNPROVEN**. This extends the existing EAS identity unit in PR #56 from head `02fce212bd359b7f4f3e9c2efba1a63c793ff359`. It changes build configuration only; it is not the native push delivery unit or a UI redesign.

## Source and architecture boundary

The owner supplied `C:/Users/user/Downloads/google-services.json`. The copied public client file is exactly **671 bytes**, SHA-256 `44d16e473ec04afa35df40fd7fa5eb9d79c6c341f348236355f8098b369fcb91`. Its existing Firebase project is `uskoci-ed59b`, project number `383421751370`, Android app `1:383421751370:android:3e19dd87280aa317a986b3`, package `rs.uskoci.preview`. A targeted Git attribute preserves these exact bytes on Windows and Linux. Existing Git attributes are retained.

`config/firebase/google-services.json` is Firebase Android **public client configuration**: project/app identifiers and a public Android API key, with no private key or service-account credentials. It is distinct from a private FCM V1 service-account signing credential and from a server-only AI provider secret. This unit adds no AI credential, provider call, client AI authority, Supabase writer or business decision. The API key is not copied into Expo `extra`, logs or evidence summaries. Firebase client identifiers do not substitute for application authorization. [Firebase API-key scope](https://firebase.google.com/docs/projects/api-keys)

`app.config.js` consumes Expo's normalized incoming `app.json`. It preserves all incoming package/name/scheme/extra overrides used by the existing native workflows. Only `rs.uskoci.preview` receives the public Firebase file and the local enrollment-disable plugin; other packages have any inherited preview file reference removed. Actual resolution covers `rs.uskoci.n04proof`, `rs.uskoci.ru5proof`, `rs.uskoci.dev` and an unknown package. No additional Firebase app or parallel backend is created. [Expo dynamic configuration](https://docs.expo.dev/workflow/configuration/)

The existing dependency-free EAS pre-install guard validates the resolved preview identity, the public file path, the enrollment-disable plugin and the exact Firebase project/app/package. Missing/malformed public API-key form, foreign identities, multiple clients and private credential material fail with fixed diagnostics. The original public Supabase environment, fake-composition and signing/version boundaries remain unchanged. The guard uses local source/environment only and does not authenticate a key or contact a provider.

## Native enrollment remains disabled

No dependency or lockfile changed. Installed native dependency/autolinking inspection found no `expo-notifications` or Firebase Messaging SDK. Expo's built-in Google Services plugin configures a build resource/file; this unit adds no token acquisition, notification permission request, registry call or dispatcher.

`plugins/withFirebaseEnrollmentDisabled.js` additionally writes both documented manifest controls as `false`: `firebase_messaging_auto_init_enabled` and `firebase_analytics_collection_enabled`. Actual installed Expo 57.0.18 Android introspection produces exactly one of each and no Firebase messaging service. This is source/native configuration proof, not a built APK's merged dependency graph or observed device behavior. A future SDK/token lifecycle unit must explicitly review its runtime enrollment behavior, including existing installations, before activation. [Firebase auto-initialization controls](https://firebase.google.com/docs/cloud-messaging/android/get-started#prevent_auto_initialization)

## Verification and remaining acceptance

- 48 focused guard/config tests PASS, including actual Node/Expo resolution for preview and disposable packages, exact public-file bytes, foreign/private configuration rejection and actual Android manifest introspection.
- Full Jest: **39 suites / 280 tests PASS**. TypeScript, Node syntax checks and migration integrity PASS. The integrity result is **85/85/0 for this isolated unit's original base**, not a fresh claim about production or newer canonical migration counts.
- Safe local introspection evidence: [resolved-native-config.json](evidence/eas-firebase-client-20260907/resolved-native-config.json). It contains identity/hash/metadata flags and module names, not the public API-key value.

The old “downloaded public client file pending” blocker is closed by the exact supplied file. Preview environment inputs, future APK source/package/version/signature/Auth verification, native permission/token registration and actual provider/device delivery remain separate acceptance. Configured EAS FCM V1 metadata and Firebase Console enabled flags are not delivery proof. No EAS build/submit/update, environment or remote version write, credential mutation, production operation or push activation occurred. Source review is required before updating PR #56; its existing merge hold remains in force.
