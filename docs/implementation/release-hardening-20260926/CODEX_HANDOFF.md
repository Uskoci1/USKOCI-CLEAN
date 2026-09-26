# Codex handoff — USKOČI media apply + bounded push proof

Base source: `e996cbc7fbc4a74116b5ffacb210a4aad9e34450` on `work/uskoci-ui-unification-20260924`.  
Canonical DEV: `leqcwgzvjsxugfgzdmth`.  
Read first: `docs/implementation/release-hardening-20260926/MEDIA_PUSH_PREFLIGHT.md` and current `NEXT.md`.

## Hard rules

- Do not deploy Edge, alter DEV data/config, activate push, register/send test events, or change provider settings until the owner says **`primeni`**.
- Never print/fetch service-role, provider, Firebase or other secret values.
- Do not create mass notifications.
- Bind every acceptance claim to exact source/tree/build/device.
- Preserve failed/unknown command journals and account/session fences.

## Package M1 — MEDIA_COMMAND_CANCELLED

No new source design is required.

Preflight:
1. Re-read branch head and deployed `uskoci-media`.
2. Require GitHub entry blob `544a5d2697be05302f115a65b088ec1e1ed39695`.
3. Require deployed v12 entrypoint to differ in exactly one line: missing `MEDIA_COMMAND_CANCELLED` in `safeCodes`.
4. Require shared sanitizer equality.
5. Run the focused media client regression and exact Edge synthetic tests; run full types/Jest if environment permits.

Only after owner says `primeni`:
6. Deploy the exact GitHub `uskoci-media/index.ts` plus exact shared sanitizer, preserving verify_jwt=true.
7. Re-read deployed function; assert new version, source contains exactly the expected safe-code line and shared file remains identical.
8. Do not manufacture a real media command just to prove the string. Use the existing disposable/synthetic proof unless owner separately authorizes a real upload/cancel scenario.
9. Update control: source/deployed/test/device separately. Do not mark whole media flow complete; RC-02 remains.

## Package P1 — bounded owner push proof

Do not start with a send.

Current observed baseline:
- 10 PUSH CREATED/unstarted;
- 0 attempts;
- 0 readiness rows;
- 0 active devices;
- one inactive requester Android device;
- requester push preference enabled;
- current `rs.uskoci.dev` R19 build is not a push proof build;
- 9/10 old PUSH rows have no expiry;
- transport is effectively disabled by the deployed v14 kill-switch behavior.

After owner says `primeni`, execute as two separately stoppable stages.

### P1A — backlog retirement with zero active devices

1. Reconfirm active-device count = 0 immediately before activation.
2. Reconfirm exact old unstarted backlog count and event-type summary.
3. Enable transport only for the minimum controlled tick needed to let server suppression run while no device exists.
4. Assert no provider attempt was created; old rows must become non-sendable/suppressed. If any attempt exists, disable and stop.
5. Disable transport again.
6. Reconfirm zero sendable historical backlog and zero active devices.

Do not invent SQL UPDATE cleanup if the canonical transport/suppression path can settle the rows. If environment/config control cannot be bounded safely, stop and return an operation plan instead.

### P1B — one owner device, one event

1. Produce a dedicated Android proof build with an applicationId that has a matching Firebase client; preserve explicit user permission and no automatic enrollment.
2. Install on the owner's physical phone. Do not use the current `rs.uskoci.dev` APK as push evidence.
3. Owner explicitly enables notifications. Require native token READY and exact server read-back of one active session-bound Android device.
4. Keep transport off.
5. Create exactly one owner-authorized event, preferably one test message in the already-existing R18 test Agreement from the approved second test account. No batch generation.
6. Verify exactly one new PUSH delivery exists for the event.
7. Enable transport only for this isolated window. Require one attempt, then provider ticket/receipt. Verify no unrelated attempts.
8. Verify lock-screen visibility and warm/cold tap to the correct current-account Inbox/destination.
9. Disable transport immediately after receipt/evidence; optionally disable/revoke the proof registration.
10. Save a receipt with counts, source/build hash, device, delivery state and provider outcome — never token/key values.

## After M1/P1

Resume current NEXT without rebuilding completed R19 surfaces:
1. R18-E01/E02 feedback truth and correction link, preserving uncertain-command identity.
2. Deep-return speed without losing the confirmed offset.
3. R18-E04 / multiline composer / post-selection Back.
4. Verified safety target name.
5. Avatar pending/absent recovery.
6. R18-E03 application projection.
7. Server proposal packages remain proof-first and require a separate `primeni`.
