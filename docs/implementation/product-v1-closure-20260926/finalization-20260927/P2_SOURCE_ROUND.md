# P2 connected work and nested navigation — source round

Date: 2026-09-27. Baseline: `6bf4e0a0`. Status: **SOURCE PREPARED / UNVERIFIED**.

This bounded round follows the current `AGENTS.md` entry and closure `PLAN.md`. It changes existing callback ownership and admission of the existing Agreement notification acknowledgment. There is no new screen, route, layout, copy, server operation or product flow. Tests, TypeScript, builds, device checks and business actions were not run, as directed by the owner. No database, Edge, provider, dependency, secret, fixture or control-matrix change belongs to this round.

## Implemented

### Profile hub callbacks belong to the visit that rendered them

Before this change, `beginAction()` read `actionScope.current` at invocation time. A retained account-A callback could therefore acquire the new account-B scope after B had rendered. The existing live-account check then accepted B's scope: a stale logout callback could request B's logout, or a stale photo callback could navigate with A's captured profile ID. The same ownership substitution was possible after blur/refocus of one account.

`src/app/(app)/profil.tsx:29` now stores the rendered action scope in state. The focus effect publishes the same object at line 36; `beginAction()` captures that rendered object at line 49 and requires the existing ref/account/revision checks at line 42. Blur still retires the ref. Publishing the new owner in state also guarantees that a refocused screen gets fresh callbacks even if other state is unchanged.

The existing busy mutex, local-sign-out arguments and late-result fencing remain in place (`profil.tsx:47`, `:66`). Photo and all existing hub navigation use this same entry guard (`:56`, `:89`, `:104`). No auth call was executed during this source round.

### Notification settings cannot reuse a retired discard/navigation callback

Before this change, changing the settings set (`REQUESTER` / `WORKER`) could call `setRole()` and clear dirty/writing without any focus or account check. A retained role callback could therefore switch a later visit's set. A callback captured while clean could also skip the discard question after the form became dirty. The sheet's normal dismissal does not give the route's own retained closures current ownership.

`src/app/(app)/profil/obavestenja.tsx:38` now publishes a rendered focus/account owner, and lines 39–40 keep an identity for the rendered role/dirty/writing state. `current()` at line 48 checks both identities and the live account revision. Back, discard entry, discard confirmation and role changes use this guard (`:53`, `:58`, `:63`, `:66`). A confirmation is valid only for the same visit and form state that asked it.

The existing unsaved-changes question, accessibility announcement during a write, hardware-Back policy, child `PushPreferences` and notification services are unchanged. No registration, permission or provider operation was executed.

### Agreement overview rating and safety links require current focus

`src/app/dogovor/[id].tsx:331` and `:441` previously checked account, foreground and read readiness but omitted the route's rendered focus token. A retained same-account callback could therefore navigate after the Agreement blurred. Both now use the existing `formCurrent()` check at line 249, matching the task and change links. This preserves the account/foreground/readiness checks and additionally requires the current focus and Agreement membership. The integrator confirmed this exact two-line ownership before the edit. Completion and other business commands were not changed.

### Existing coarse message acknowledgment waits for a visible, owned thread

The integrator then requested a bounded review and fix of the existing read-acknowledgment effect. Previously it required only the Poruke tab, a non-null message array (including an empty array), and no message error. Messages and the workspace load independently. On cold entry or foreground resume, messages can finish first while the route still renders its loading status. That earlier effect could settle notifications without displaying the conversation. It also lacked its own focus/account/foreground dispatch fence.

`src/app/dogovor/[id].tsx:205` now requires a nonempty successful message read, a loaded/error-free/non-uncertain workspace with the current account as a participant, and the visible Poruke state outside resume. At line 211 the effect checks the exact rendered focus against the live ref, the live account revision, immediate foreground/freshness refs and native AppState. Readiness is an effect dependency, so a message read that finishes before the workspace can be admitted after workspace readiness catches up.

The focus effect explicitly publishes its token through state at line 91. Previously the rendered token was only sampled from a ref and depended on independent reads causing another render; this effect now has an explicit focus dependency. Blur still retires the live ref synchronously. A ref records the attempted focus/message-array pair at line 208 so readiness changes do not repeatedly acknowledge the same snapshot. Returning from Pregled preserves the previous explicit tab-entry behavior by clearing that attempt marker outside Poruke.

This is still the existing Agreement-level `oznaciPorukeProcitanim(id)` call (`:217`), whose adapter calls `rpc_mark_agreement_messages_read` with only the Agreement ID (`src/data/supabaseIzvor.ts:359`). It does not prove individual messages were visible and does not implement the separate exact-message server candidate. It cannot cancel an RPC already dispatched while the thread was eligible. No RPC was executed during this source work.

## Bounded route and lifecycle inspection

The inspected destinations exist in the current route tree. This is source evidence, not device navigation acceptance.

| Area | Existing source evidence |
| --- | --- |
| Home to tasks, candidates, applications and Agreements | `src/app/(app)/index.tsx:43` fences account/revision/focus/source; `:47` maps the four concrete destinations. Shortcuts are at `:56`–`:64`. |
| Own-task list to detail/candidates | `src/app/(app)/potrebe.tsx:36` fences ownership; `:46` and `:52` require a known current row before navigation. |
| Own-task detail and return | `src/app/(app)/potrebe/[id]/pregled.tsx:104` checks focus/lifecycle/data ownership; `:126` serializes navigation. Back has a cold-entry fallback to `/potrebe` at `:214`; candidates carry the task ID at `:215`. Publication logic was not changed. |
| Candidate list and selected Agreement | `src/app/(app)/potrebe/[id]/kandidati.tsx:63` fences focus/read revision/account; task navigation is at `:115`; linked and confirmed Agreement navigation are at `:140` and `:153`. |
| My applications | `src/app/(app)/moje-prijave.tsx:130` checks current row identity. Agreement opening requires selected state and a real Agreement ID at `:224`; task opening carries its task ID at `:225`. |
| Agreement collection | `src/app/(app)/dogovori.tsx:35` publishes a new focus owner. `:56` checks foreground/read generation/account/source; `:65` admits only the current row. Agreement and rating destinations are at `:70` and `:77`. |
| Agreement overview to task/applications/changes | `src/app/dogovor/[id].tsx:74` keys the workspace by account revision and Agreement ID. `:249` defines the focus guard. Task, application and change links use it at `:401`, `:430`, `:437`. Chat changes are limited to the explicitly requested coarse acknowledgment fence above. |
| Profile destinations and registration | `src/ui/profile/ProfileHubPresentation.tsx:20` defines the destination union. Nested profile/support routes are registered in `src/app/(app)/_layout.tsx:212`–`:229`; need detail/candidates at `:237`–`:238`; Agreement is in `src/app/_layout.tsx:139`. |
| About, privacy and legal links | `src/app/(app)/profil/o-aplikaciji.tsx:16` publishes a focus token; `:35` and `:37` open legal/privacy. Privacy navigation is guarded at `src/app/(app)/profil/privatnost.tsx:37`; legal ownership and link opening are at `src/app/(app)/profil/pravna.tsx:35` and `:38`. |
| Support nested actions | `src/ui/support/useSupportController.ts:14` owns focus and target identity, and `:40`–`:46` fence navigation against the current controller/snapshot/account/foreground. Inbox links at `SupportInboxScreen.tsx:40`–`:80`, detail Back at `SupportDetailScreen.tsx:65`, and new-case success at `SupportNewScreen.tsx:63` use that navigation path. |

No missing destination was found in this bounded inspection. This does not certify every route or business transition in the app.

## Remaining and deferred evidence

1. For Agreement overview verification, retain rating/safety callbacks, blur the route or change its account revision, then invoke them. They must not navigate. Fresh current-member callbacks must still open the existing rating/safety destinations. This is a deferred check, not an executed result.
2. When verification is authorized, retain old profile logout/photo/navigation callbacks, then rerender a new account, advance account revision through A → B → A, and blur/refocus the same account. Old callbacks must do nothing; callbacks from the new visit must work, including after returning from a nested screen. Verify that late logout failure cannot alter the new visit.
3. For settings, retain clean and dirty role/Back/confirm callbacks. Change dirty state, begin a write, switch account/revision and blur/refocus before invoking them. Old callbacks must not change the set, clear current flags or navigate. Fresh discard/cancel and the existing writing announcement must still work.
4. After the owner authorizes exact-build device acceptance, walk Home → own tasks → candidates → Agreement → task → Back, and Home → applications → Agreement → Back. Also exercise Profile → nested setting → Back, support inbox → new/detail → Back, cold-entry fallbacks, repeated return and account switches. This round does not claim native navigation, performance or product acceptance.
5. New visual hierarchy or navigation flow proposals remain subject to owner approval. These changes preserve existing visuals and user paths.
6. Coarse acknowledgment checks remain unexecuted: messages resolve before workspace on cold Poruke entry; messages resolve during a pending foreground workspace read; blur/account change before dispatch; empty messages; failed/uncertain/non-member workspace; readiness finally permits one attempt; subsequent workspace-only renders do not repeat that snapshot. Existing `pkg011-agreement-workspace.test.tsx:355` and `:375` expect an acknowledgment for an empty list, through the shared `render()` fixture at line 65; those assertions predate the newly requested nonempty condition and need alignment when test work is authorized. Existing recovery tests cover workspace hiding at `agreement-screen-recovery.test.tsx:641` and `:690`, but do not assert this acknowledgment boundary.

## Independent review requested by the integrator

The concurrent `GroupConversationController.ts` patch was reviewed read-only. No concrete defect was found in the queued visibility, independent read-receipt lock and operation-revision fence: queued IDs are revalidated against the current group/message set, command/read work advances the revision, and the optional receipt context refresh rechecks its revision and context identity after awaiting. No group source was edited and no execution was performed for this review. Group implementation and its remaining evidence belong to P3.
