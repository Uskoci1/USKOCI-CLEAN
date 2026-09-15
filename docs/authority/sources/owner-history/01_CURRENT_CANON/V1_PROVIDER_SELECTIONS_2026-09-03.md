# USKOČI — V1 PROVIDER SELECTIONS — 2026-09-03

**Status:** `IMPLEMENTATION SELECTIONS LOCKED; CREDENTIAL/DEVICE PROOF PENDING`

| Domain | V1 selection | Product boundary | Release caveat |
|---|---|---|---|
| Database/Auth/RLS/RPC | Supabase project `leqcwgzvjsxugfgzdmth` | canonical server authority | live advisor closure still required |
| AI | Current server adapter: Gemini when configured, OpenAI fallback; provider-neutral contract | model is proposal/interpretation only | provider secrets server-side; D-0140 server gate final |
| Map | `react-native-maps` + Google Maps SDK Android/iOS | `MapPort`; map is presentation, not business truth | restricted platform keys + billing config; recheck pricing before release |
| Device location | `expo-location` | `LocationPort`; transient near-me separate from saved work area | permission/device proof |
| Push | `expo-notifications` + Expo Push Service → FCM/APNs | event truth stays server-side; push is optional transport | 600/s/project observed limit; queue/backpressure and native-token escape hatch |
| Payments | **NONE for V1** | Povezivanje cost 0 RSD; task payment not held by platform | future paid provider is later owner/legal/accounting decision |
| Voice | adapter to same AI intake; concrete speech provider may be selected later | transcript never separate business truth | text fallback mandatory |
| Observability | provider not yet selected | domain event/error contract must stay vendor-neutral | choose during PP-7 without product redesign |

## Key handling

- AI/service secrets never in Expo/mobile bundle/GitHub.
- Google Maps mobile API keys must be application-restricted and API-restricted; they are not service-role secrets.
- Push provider credentials remain server/EAS/native configuration as appropriate.
- Provider failure never manufactures a successful business mutation.
