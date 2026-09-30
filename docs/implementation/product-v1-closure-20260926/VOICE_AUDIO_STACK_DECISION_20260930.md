# Voice: which audio stack — compatibility check and decision (2026-09-30)

Status: **CONDITION CHECKED — `expo-audio` IS COMPATIBLE; NOTHING INSTALLED YET; THE PLAN AVOIDS A PERMANENT PARALLEL AUDIO STACK.** Documentation only: no dependency, source, server or device change.

Owner directive (2026-09-30): `expo-audio` is approved **conditionally**, after a compatibility check against the CURRENT Expo SDK and the EXISTING audio code, and **no parallel audio stack may be introduced if the existing one can be safely migrated**. This record is that check.

## 1. What is installed and what the SDK pins

| Fact | Value | Where read |
| --- | --- | --- |
| Expo SDK | `expo ~57.0.18` (installed 57.0.18), React Native 0.86.3, React 19.2.3, `reactCompiler` on | `package.json`, `node_modules/expo/package.json`, `app.json` |
| SDK-pinned `expo-audio` | **`~57.0.4`** (`npx expo install expo-audio` selects it) | `node_modules/expo/bundledNativeModules.json` |
| `expo-av` | not part of SDK 57 (no entry in `bundledNativeModules.json`); not installed | same |
| Already installed and useful | `expo-file-system ~57.0.6` (move/read/delete a recording), `expo-notifications` | `bundledNativeModules.json`, `node_modules` |
| No audio library in the app today | `package.json` has no `expo-audio`, `expo-av`, `expo-speech` | `package.json` |

Official documentation checked 2026-09-30: <https://docs.expo.dev/versions/latest/sdk/audio/> (the page links `versions/v57.0.0`, i.e. it is the SDK 57 page). Facts used from it: `useAudioRecorder` with `RecordingPresets` (`HIGH_QUALITY` = `.m4a`, AAC, MPEG-4), custom `RecordingOptions` (extension, sample rate, channels, bit rate, per-platform `outputFormat`/`audioEncoder`, `directory: 'cache' | 'document'`), `useAudioPlayer` (remote `uri` with `headers`, `downloadFirst`), **`useAudioStream`** ("native audio stream for real-time PCM microphone capture": `sampleRate` requested, `channels`, `encoding: 'int16' | 'float32'`, `onBuffer`, `start()`/`stop()`, actual `sampleRate` reported after `start()`; Android, iOS, tvOS, web), `requestRecordingPermissionsAsync`, `setAudioModeAsync`, and the config plugin flags below.

## 2. The existing audio code (what it does, exactly)

| Piece | What it is |
| --- | --- |
| `modules/uskoci-voice` (`expo-module.config.json`: platforms `["android"]`) | A first-party **Android-only** Expo module. `UskociVoiceModule.kt`: `AudioRecord`, source `VOICE_RECOGNITION`, **16 kHz mono PCM16**, 1,600-sample (100 ms) chunks delivered as base64 `pcm` events with a sequence number and an RMS level; audio focus `GAIN_TRANSIENT_EXCLUSIVE` with `USAGE_VOICE_COMMUNICATION`; **foreground only** (an `interrupted` event on background/destroy); 120 s cap; one active session; buffers zeroed after use; header comment: *"Foreground-only transient PCM; never creates an audio file or starts a service"*. Manifest: only `RECORD_AUDIO`. |
| `src/features/voice/nativeSpeechAdapter.ts` | The only JS user of that module (`requireOptionalNativeModule('UskociVoice')`, Android only; on iOS the adapter answers `'unavailable'`). Streams the chunks over a websocket to the Edge function `uskoci-speech-session` (protocol `USKOCI_SPEECH_V1`, `speechProtocol.ts`: 16,000 Hz, ≤ 3,200 bytes per chunk, ≤ 3,840,000 bytes total, strict sequence numbers, model `gemini-3.5-transcribe-live`). |
| `src/features/voice/holdToTalk.ts`, `useHoldToTalk.ts` | The hold-to-talk state machine and hook (AI conversation input; sends on release). It talks to the platform **only through the `NativeSpeechAdapter` interface** (`requestPermission`, `createCapture` → `start / stopCapture / finalize / dispose`). Five test files cover it. |

So today's audio code is **speech input only**: transient PCM to a live-transcription socket, never a file, never played back, Android only.

## 3. What voice messages need (contract `CHAT_VOICE_CONTRACT.md`)

A stored recording: **AAC in MPEG-4 / M4A, mono, 64 kbps target, 300 ms – 5 min, ≤ 4 MiB**, preview, upload to a private bucket, playback of received messages, a durable client journal/outbox, Android **and** iOS, background recording disabled. None of it exists in the custom module (no file, no encoder, no player, no iOS).

## 4. Overlap, and the decision

| Capability | Existing | `expo-audio` (SDK 57) |
| --- | --- | --- |
| Real-time PCM microphone capture for speech-to-text | `UskociVoice` (Android) | `useAudioStream` (Android + iOS) |
| M4A/AAC recording to a file | — | `useAudioRecorder` |
| Playback (remote private URL, headers) | — | `useAudioPlayer` |

Adding `expo-audio` for messages **and** keeping `UskociVoice` for speech input would leave two stacks that both own the microphone. Because `useAudioStream` covers the one capability the custom module has, and adds iOS, the **existing module can be migrated, not paralleled**:

1. Adopt `expo-audio` as THE audio stack (one dependency, one permission flow, one set of audio-mode rules).
2. Re-implement the speech capture as a second implementation of the SAME `NativeSpeechAdapter` interface on top of `useAudioStream` (the state machine, protocol, Edge function and tests stay).
3. Keep `UskociVoice` only as a build-time fallback until the migrated adapter is proven **on a physical Android phone** (parity list below), then delete `modules/uskoci-voice` (a C0/C1 cleanup item). At no point are two captures active: one adapter is selected per build.

"Safely" is the open condition — §5 lists what must be shown before the custom module is removed. This record does not claim parity; it shows the migration is feasible and gives it a gate.

## 5. Parity list for the migrated speech adapter (each item needs evidence before `UskociVoice` is removed)

| Behavior of `UskociVoice` | With `useAudioStream` | Mitigation / how it is verified |
| --- | --- | --- |
| 16 kHz PCM16 mono, 100 ms chunks, sequence numbers | The requested rate "may differ"; buffers arrive in arbitrary sizes | Request `sampleRate: 16000, channels: 1, encoding: 'int16'`; refuse (or resample) if the reported rate differs; re-chunk to 3,200-byte pieces with our own sequence; unit tests on the chunker, then a device run that logs the reported rate/buffer sizes |
| Source `VOICE_RECOGNITION` (speech-tuned DSP) | Source not documented | Compare transcript quality on a physical phone (the emulator's virtual microphone cannot judge STT quality) |
| Transient exclusive audio focus, `USAGE_VOICE_COMMUNICATION` | `setAudioModeAsync({ interruptionMode: 'doNotMix', allowsRecording: true })` | Check focus loss/gain and a playing voice message being paused when capture starts |
| `interrupted` events (BACKGROUND, AUDIO_INTERRUPTED, CAPTURE_TIMEOUT, CAPTURE_FAILED) | Only `audioStreamStatus.isStreaming` | Derive in JS: `AppState` for background, a 120 s timer, a status drop while capture is still wanted; one test per code |
| Foreground-only, no service | Plugin flags below must keep it so | `enableBackgroundRecording: false`; inspect the merged manifest of the built APK |
| Buffer zeroing / never a file | Not documented | Zero the `ArrayBuffer` views after sending; assert (device) that no file appears in cache/document dirs during a capture |
| Android only | Also iOS | iOS behavior is a NEW capability: needs `NSMicrophoneUsageDescription`, and a real iPhone before it is claimed |

## 6. Configuration and store implications (decide now, apply at install)

`app.json` plugin entry, when the dependency is installed:

```json
["expo-audio", {
  "microphonePermission": "<owner-approved Serbian purpose text>",
  "recordAudioAndroid": true,
  "enableBackgroundRecording": false,
  "enableBackgroundPlayback": false
}]
```

- **`enableBackgroundPlayback` defaults to `true`** and would add `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and a media-playback foreground service to the manifest: chat voice messages do not need it, and an unneeded foreground-service permission is a Play Console declaration and review burden. It is set to `false`.
- `enableBackgroundRecording` stays `false` (the default; the contract forbids background recording; `true` would add a recording foreground service with a persistent notification).
- `RECORD_AUDIO` is already declared by the custom module's manifest; the merged manifest de-duplicates it.
- The iOS permission string is a product/legal text: the voice privacy wording the owner approved on 2026-09-24 is the source, not a new text.

## 7. Recording storage and privacy (for B1/B2, not decided here)

`expo-audio` records to the **cache** directory by default (the system may delete it). A recording that must survive until the durable outbox has uploaded it needs `directory: 'document'`, and must be deleted after the server acknowledges it or the person cancels; playback of a private message needs a short-lived authorized URL (`headers` are supported) and must not leave an unbounded cache (`downloadFirst` writes to the tmp directory). These belong to the B1 (private asset authority, closure/export) and B2 (client journal) packages in `CHAT_VOICE_CONTRACT.md`.

## 8. Sequence and gates

1. **Now:** this record only. No install.
2. **B2 start (after P6, checkpoint, C0, Discovery polish and the Posao package, per the plan order):** `npx expo install expo-audio` (resolves `~57.0.4`), plugin entry as in §6, a JS capture arbiter (exactly one of: speech capture, message recording; playback pauses for either), the message recorder/player, then the speech adapter on `useAudioStream` behind the existing interface.
3. **Gate to delete `modules/uskoci-voice`:** every row of §5 evidenced on a physical Android phone (the owner's rule: emulator only until the consolidated device pass), plus a green existing hold-to-talk test suite against the new adapter.
4. **Still owner decisions, unchanged:** the B1 DEV application, the recording/review/player UI proposal, any certificate rebind.

## 9. Not verified here

The package's TypeScript types (`useAudioStream` exists in the SDK 57 documentation; the installed types are checked at install), behavior on any device, iOS, transcription quality, and the built APK's merged manifest. Nothing in this record was executed on a device.
