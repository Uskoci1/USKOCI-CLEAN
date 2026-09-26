# Codex handoff — USKOČI media and strictly bounded push proof

Branch: `work/uskoci-ui-unification-20260924`, repository `Uskoci1/USKOCI-CLEAN`.  
Canonical DEV: `leqcwgzvjsxugfgzdmth`.  
Read current `AGENTS.md`, `NEXT.md`, the control table and `PUSH_ROLE_RECHECK.json` before continuing. Historical preflight source was `e996cbc7`; always resolve current HEAD instead of resetting to that source.

## Hard rules

- Do not deploy Edge, alter DEV data/config, activate push, register devices/create test events or change provider settings until the owner explicitly authorizes the named package with **`primeni`**.
- Do not request or display keys, tokens, private message bodies or raw personal data.
- Do not activate mass notifications or retire another user's queue as test setup.
- A brief global enable window is NOT a one-event send limit. The former zero-device/global-tick backlog-retirement plan is withdrawn.
- Bind acceptance to exact source, test run, deployed version, build and physical device; distinguish those layers.
- Preserve unknown-outcome journals and account/session/focus fences.

## M1 — MEDIA_COMMAND_CANCELLED

Historical comparison found one entrypoint difference: GitHub blob `544a5d2697be05302f115a65b088ec1e1ed39695` admits `MEDIA_COMMAND_CANCELLED` in safeCodes; deployed media v12 did not. Shared sanitizer was identical.

1. Re-read current GitHub and deployed `uskoci-media` files, including relative dependencies. If the difference was already applied, record that and do not deploy again.
2. Keep the existing safe-code fix rather than redesigning uploads. Run the focused client regression and an exact Edge-handler test that returns the cancelled RPC error. A mocked client HTTP response alone is not an Edge execution proof.
3. Preserve the no-retry rule, sanitization, immutable object identity, ownership checks and unknown-state behavior. RC-02 concurrency remains a separate package.
4. Prepare a manifest of exact files/hashes, before/after test results and rollback source. Do not apply it to canonical DEV/Edge before explicit approval.
5. After approval, deploy only the named package with verify_jwt preserved; fetch it again and compare actual content. Do not create a real upload/cancel command without an approved scenario.

## P1 — correct current observations

Read-only check `2026-09-26T11:55:24.347655Z` joined BOTH `user_id` and `role_context` to the delivery recipient:

- 10 PUSH CREATED/unstarted deliveries target REQUESTER.
- None has a matching REQUESTER preference row, so push is false for that role.
- None has an active recipient device; 9 lack expiry.
- Earlier account-wide aggregation incorrectly treated a preference in another role as REQUESTER consent. Do not repeat that claim.
- Earlier observed attempt/readiness counts were both 0. Recheck them before further work.
- Source/config inspection found that the R19 `rs.uskoci.dev` build lacks the matching Firebase configuration; UI success is not token-registration proof.
- The disabled transport flag is a supported inference, NOT a directly observed env value. HTTP 200 alone does not establish its body or provider activity. Use an existing safe boolean/status observation if available; otherwise retain this limitation.

These are multiple independent preconditions, not a fully proven end-to-end diagnosis.

## P1A — read-only diagnosis before any test

1. Bind the owner's exact authenticated account and device; do not assume the R18 requester or any matching display name is the owner.
2. For one approved task/profile pair inspect current task status/revision/deadline, task type/location/time, worker profile readiness, required tools/licences/vehicles/experience, exclusions and calendar conflicts.
3. Separately inspect automatic-discovery gates: availability, preferred area, proactive notification setting and quiet hours. Manual application eligibility and proactive delivery eligibility are not interchangeable.
4. Trace the matching opportunity and activity event, then the exact-role notification preference, category, suppression reason, delivery row, registered session-bound device and transport attempt. Stop at the first unproved transition; do not manufacture missing records.
5. Check native package/provider capability and permission separately from server preferences. Neither cron success nor an ACTIVE Edge function proves dispatch or display on a phone.
6. Save only safe counts/statuses/reason codes and exact source references. No secret retrieval is needed.

## P1B — prepare enforceable isolation; do not globally enable

The existing general queue claim must not be called as a one-notification test merely because a precheck sees one device.

Prepare a separate candidate/proof, or use an already existing equivalent only after inspecting it, that enforces:

- exactly one approved account + current recipient role + device registration revision + event/delivery identity;
- a hard maximum of one provider dispatch, with durable attempt identity;
- no claim, send, acknowledgement or suppression of unrelated queue rows;
- explicit consent, category, quiet-hour, block, closure and session checks;
- concurrency protection so a second worker/retry cannot send twice;
- no replay after an unknown provider outcome, and expiry of the test authorization.

Prove wrong-account/device/event rejection and unchanged unrelated backlog in a disposable environment. Do not implement only an interface toggle or rely on time-window shutdown. Any server candidate, configuration change or test authorization still waits for the owner's explicit `primeni`.

## P1C — one real approved test after isolation exists

1. Agree the exact owner account/device and test state, for example locked screen followed by cold-start tap.
2. Build/install a push-capable package with the correct applicationId/provider configuration. Let the owner grant OS permission and enable the intended role; verify exact registration/readback.
3. Create only the approved event using the ordinary authorized app path and an approved counterpart account. Keep ordinary global sending disabled.
4. Admit only that event/delivery/device under the bounded test authorization. Observe at most one provider dispatch and its ticket/receipt.
5. Confirm actual phone display and tap to the correct account/destination. Provider acceptance is not proof of display.
6. Record the result and close the test authorization. Leave unrelated backlog unchanged. Warm-start, denied-permission and other scenarios need separate bounded tests; do not claim them from one cold-start notification.

No stage above has been executed on a real phone by this handoff.

## Current client continuation

The R18 refusal-recovery candidate is already written in `348c2ec6ac0d3afe2e51e5a15e7620b023646ca5`. Its exact proof is run `36240045849`; read the final run/receipt rather than assuming it passed. Preserve failed runs `36237862251`, `36238087977` and `36239846013` as historical evidence.

Do not rebuild completed R19 UI. After the current client package is accepted in tests, next verify the exact APK/profile-return behavior and separately close reset/storage-failure races. Then follow current NEXT for deep-return speed, accessibility/multiline chat, verified safety target, avatar recovery and additive application facts. Server packages remain proof-first and separately approved.
