# R18 emulator verification and handoff — 2026-09-25

## Installed source

- Source: `74f514d79fa323e135c9ddc23a6cb6b5b934c730`.
- Tree: `643d23914ab13dc603f422dd19b97194f863a687`.
- Build: [36183499333](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36183499333), completed successfully.
- Artifact: `USKOCI-DEV-APK`, x86_64 ABI verified.
- APK SHA-256: `ad4d820b624ed8de42c7c8462516c447f4401a3e126dcfc70825e8fe10fd1a01`.
- Both artifact attestations bind that source, tree, run and APK hash. `r18_verify_apk.py` passed before installation.
- Correct existing QA AVD: **USKOCI_V5_TEST**, now **emulator-5556**. `adb install -r` succeeded at `2026-09-25T20:27:27.537275+00:00`; the installed `base.apk` hash matches the artifact. Receipt: outer `outputs/r6-integration/r18-emulator/APK.json`.

## AVD selection correction

The previous `emulator-5554` disappeared while the build ran. Two configured AVDs existed. I initially restarted the first listed one, `Pixel_10`, on port 5554 instead of resolving the historical AVD name. This was a verification setup mistake: the R17 receipt names only the serial, but AGENTS and earlier native receipts identify **USKOCI_V5_TEST** as the QA AVD.

Pixel_10 received the same verified APK with `install -r`, but was signed out. Both gallery launches reached the protected-route login screen. One screenshot, `gallery-auth-blocked.png`, was actually viewed and is diagnostic only. It demonstrates neither an AI fixture nor a keyboard test. Its receipt, screenshot/XML, capture manifest and exact display restoration record are preserved separately under outer `outputs/r6-integration/r18-emulator-pixel10-diagnostic/`. No account was entered and the auth guard was not bypassed.

After the lead authorized a separate port, the existing **USKOCI_V5_TEST** was started on 5556 with its saved data. No wipe, reset, uninstall or data clearing occurred. Boot was slow; Android showed a System UI not responding dialog and **Wait** was selected. Installation then succeeded as above. The initial launch timeout during boot is not an application regression conclusion.

## Existing session and handoff

On the correct AVD, the existing authenticated session survived the installation. A read-only visit to `/profil` visibly showed:

- display name `msljivic031`;
- city `Novi Sad`;
- `5,0 · 2 ocene`;
- active worker profile.

Initially the lead reported the same visible display name on the phone, so the two-device setup did not establish two different accounts. The owner subsequently signed the **phone** into the existing second account; the lead observed **Milos SLJIVIC / 4.5 / 2 ratings**, while the emulator remained **msljivic031 / 5.0 / 2 ratings**. The prior account setup blocker was resolved through the owner's phone account switch, not by bypassing auth or logging into Pixel_10. The lead then completed the scoped live journey described below. No account identifier, credential or token was read from storage by this agent. Emulator control was handed to the lead on `/profil` for the separately authorized end-to-end scenario. This agent never controlled the phone.

## Native acceptance status

**Scoped real journey passed; full native resilience acceptance remains open.** Before the correct AVD was ready, the owner prioritized a two-account end-to-end scenario and the lead explicitly deferred the inert capture plan. The planned expanded task/worker AI checks at 320dp/font 2 and controlled latest/older-history/keyboard-close restoration matrix were not executed. A later normal-size live chat capture does show a real docked keyboard and reachable send control, with a clipped first draft line noted below. **R14-N01 remains open** for the full behavior matrix; successful installation and one short conversation do not close it.

The Pixel_10 login diagnostic was inspected. No R18 inert-gallery PNG was captured on USKOCI_V5_TEST in this pass. The diagnostic capture helper saved its PNG/XML/manifest successfully and then exited with a Windows cp1252 console-print error; this did not affect the saved screenshot or hash, and no capture success was inferred from the exit code. After handoff, this agent independently viewed a fixed first set of **12 root-captured PNGs** through `worker-skills-lower`, then **13 named final PNGs** from a manifest snapshot ending at `worker-completed-history`: **25 reviewed emulator PNGs in total**, plus the separate Pixel_10 diagnostic. Their SHA-256 values were checked against the manifest. Reviews are in outer `outputs/r6-integration/r18-emulator/REVIEWS.agent.json`; this sidecar avoids overwriting the manifest while the lead adds later captures. Other intermediate or later images are not implicitly reviewed.

## Completed scoped live journey

The owner explicitly authorized one new DEV test task from zero, use of the two existing accounts, necessary text-AI calls for this test, and addition of the smartphone they actually own to the worker profile. The lead performed the actions; this agent independently reviewed the saved emulator images and relevant source.

The final evidence shows the real equipment addition saved and verified, followed by **Prijava je poslata**, an active **Dogovoreno** Agreement with the same 100 RSD total / one-person terms, receipt of the requester's message, a sent worker reply, the worker's completion entering **Čeka se potvrda druge strane**, a reachable rating form, a saved **5 of 5** worker rating, no active Agreements, and the exact test Agreement in History as **Završeno** (history count 4). The lead separately confirmed requester completion, the requester's saved 5-star rating, and the parent task marked **Zatvoren** on the phone; those phone observations are lead evidence, not independently reviewed emulator images.

This establishes the success path for this single remote/flexible/one-person task after correcting its real equipment declaration. It does not establish payments, cancellations, disputes, groups, offline recovery, automatic push delivery, every schedule/price basis, AI voice, full accessibility, or readiness of the entire application for publication. The rejected first attempt remains useful evidence of hard eligibility enforcement and the two UI weaknesses below.

### Normal-size live keyboard observation

`worker-chat-keyboard.png` now visibly shows a full **docked alphabetic keyboard**, with the received message, composer and send control above it; this is stronger than R17's floating toolbar evidence. However, the first line of the multiline draft is visibly clipped at the input's upper edge. `worker-reply-sent.png` shows the full outgoing message, cleared composer and closed keyboard afterward. These pictures support usable normal-size entry/send in this short thread, not complete multiline polish or preservation of an older reading position. No 320dp/font-2 or deliberate older-history test occurred in this live path.

## Owner-authorized live flow: application rejection findings

The lead created the single explicitly authorized remote test task on the second account and opened it from the emulator's first account. The first reviewed PNG set shows publication in Discovery, detail, a 100 RSD total / one-person draft, exact pre-send review, rejection and readback. The second reviewed set establishes the subsequent successful application and completed Agreement; the initial rejection is not mislabeled as a successful send.

### R18-E01: a known refusal still requires an outcome check

`worker-offer-sent.png` already displays the allowlisted worker eligibility refusal, but its primary action is **Proveri ishod**. `worker-offer-recovery.png`, after that explicit read, says **Ova ponuda nije primljena** and offers **Sastavi novu ponudu**. The first PNG does not literally contain an unknown-outcome sentence; the inconsistency is its recovery state/action despite a known refusal.

Source explanation: `src/hooks/useOwnedEditor.ts` marks every non-ok write `uncertain=true` and `reconcileRequired=true`. `src/app/(app)/prilike/[id]/prijava.tsx` retains the actual allowlisted rejection, but enables the new-offer reset only after the explicit read clears the editor's uncertainty. This explains the observed extra step without assuming a network timeout. A future fix must preserve current read-before-new-command protection and distinguish a conclusive refusal from transport uncertainty; no runtime change was made here.

### R18-E02: the exact eligibility reason is lost

The task visibly requires **Pametni telefon**. Initially the worker's **Alat i oprema** visibly contained **Pegla** and **Elektro alat**; **Mogu odmah** was already on. Source `private.match_detail_without_calendar`, retained from `20260829211632_clean_dispatch_engine.sql`, uses lowercased/trimmed array containment for required tools; missing containment adds `MISSING_REQUIRED_TOOL` to hard blockers. The PKG-031b amendment changes skill/exclusion matching but does not relax required tools. With the owner's explicit approval, the lead added the real smartphone; `worker-tool-saved.png` confirms saved-and-verified profile state, and `offer-accepted.png` then confirms successful application submission. The lead reports that this was the only eligibility-relevant change. This before/after result, together with the source gate, verifies the missing-tool explanation causally for this test. The raw original hard-blocker payload was not inspected and is not fabricated in this report.

`rpc_submit_response` raises `WORKER_NOT_ELIGIBLE` with the JSON hard-blocker list in `detail`. `applicationSelectionClientService.ts` checks calendar details only; `serverReceipt.ts` then maps the remaining error message to generic copy and discards other details. Consequently the UI cannot tell this user to review the missing required tool, and mentioning availability can misdirect them even though it is on.

For this remote, flexible, end-only task with no proposed exact interval, the source does not make radius, skill match, minimum fee or available-now hard gates for a manual application. Required tools/licenses/vehicles, experience, profile exclusions, identity requirement and relevant account/profile restrictions are hard gates. Calendar conflict only adds a blocker for an actual interval; `calendarFailure` has its own user-facing mapping. The UI path for the visible mismatch is **Profil → Veštine, alat i tim → Alat i oprema**. It must reflect equipment the owner actually has; no profile modification was performed by this agent.

### Other visual observation

`second-account-ready.png` renders three visible map markers as blank white circles with green outlines. No brand/count appears inside those circles in that capture. This is a bounded rendering observation, not proof that selection is broken. The new remote task correctly appears in the list and increases the displayed no-map-point count; its detail clearly identifies remote mode and the required tool.

## State preservation

Pixel_10's guarded display session finished with exact equality to its baseline: 1080×2424, physical density 420, font scale 1.0, original IME and hard-keyboard preference. The record explicitly identifies Pixel_10/emulator-5554. On USKOCI_V5_TEST no density, font, IME, keyboard preference or other display setting was changed. Both emulator processes were left running and identified to the lead; neither was silently stopped.

There were no provider calls, microphone commands, chat sends, uploads, task/application/agreement mutations or backend changes by this agent. The lead performed the explicitly owner-authorized live scenario; this report distinguishes those lead actions and phone observations from this agent's independent source/PNG review.
