# Round 25 — voice structure and owned license application proof

2026-09-27. **Voice remains unshipped. P5 awaits explicit application approval.**

Problem/cause/product decision: the existing B0 helper treated a raw codec marker and declared duration as sufficient structure. Voice must be a real message type with its own bounded media lifecycle. This source package narrows admission to a single local mono AAC-LC track and reconciled duration/sample/chunk tables, without pretending to decode sound. No microphone button or partial writer was added.

Implementation/files: voiceM4a.mjs, its existing Node suite and P3_B0_AUDIO_STRUCTURE_20260927.md. Root additionally updates CHAT_VOICE_CONTRACT.md so its status accurately distinguishes this source validator, applied B3 history/ACK, pending realtime/voice and the unapproved proposed audio dependency. Strict current B3 client compatibility must be addressed before a voice writer is enabled.

Tests/regression:36/36 local Node checks PASS; the same suite against old bytes24FAIL/12PASS. Syntax/diff PASS. Synthetic structural samples are not native recordings or decoder/playability evidence. Parser still has no production import. No TS/client change, full Jest, build, microphone/provider/Storage/DEV/Edge/certificate operation was needed for this source-only helper.

P5 run36341487304 at89bd392d passed7SQL-role checks using the revised application candidateSHA38d4ec8a408d9e283414ae89059dddfa7b887f57ce8802fb083e55df742717ad. All seven Git source hashes independently match; catalog/certificates and fixtures restored, teardownPASS. P5_LICENSES_APPLICATION_PASS_20260927.json preserves exact evidence. Explicit apply+wire approval was requested; current manual profile runtime still has its existing projection. This source proof is not a live application or matching-quality claim.

Device/status: consolidated client APK36341487306 at89bd392d is building and includes MyTasks criteria scroll, Home retry and Agreement exit retirement. It excludes this later inactive B0 source change. Previous f526a736 emulator map/Privacy acceptance remains scoped. Control refreshed locally; same artifact republish remains pending. Next: install and check consolidated client; apply P0/P4/P5 only after their explicit approvals; B3c disposable certificate work and native audio dependency keep separate gates.
