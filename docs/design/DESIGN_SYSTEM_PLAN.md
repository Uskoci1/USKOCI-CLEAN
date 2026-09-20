# USKOČI — design system and execution plan

2026-09-20. Research/setup only. Root `DESIGN.md` is the proposed constitution; owner approval is required before redesign implementation. Reference diversity is a separate gate: at least five inspected relevant examples from three independent sources per major surface. A source homepage, an unviewed screenshot or five copies of one flow do not satisfy it.

## Architecture

1. **Functional layer:** existing contracts, controllers, hooks, domain projections and command receipts. No UI primitive calls Supabase or decides lifecycle permissions.
2. **Semantic foundation:** retain one runtime authority through `src/theme/tokens.ts` and `src/ui/system/tokens.ts`; simplify aliases deliberately. Figma variables mirror chosen semantics after approval, not vice versa by accident.
3. **Native primitives:** text, accessible press/action, page/insets, header, row, surface, separator and restrained state/motion utilities. Reuse working native behavior without inheriting weak composition.
4. **Product components:** task brief, selected pin/preview, person evidence, agreement summary, conversation turn/composer and review control. Keep capability-specific APIs; no enormous universal card.
5. **Surface composition:** feature presentations arrange these for a particular decision. Route guards, focus behavior, retry identity and data services stay outside visual components.

## Concrete component and file map

These are likely future edit locations, not changes made by this phase. A new file below is explicitly marked proposed.

| Responsibility | Current files / proposed extraction | Key contract / reason |
|---|---|---|
| Foundations | `src/theme/tokens.ts`, `src/ui/system/tokens.ts`, compatibility aliases in `ui/v2` and `ui/aiFirst` | Semantic color/type/spacing/radius, no domain behavior |
| Text and touch | `src/ui/Text.tsx`, `src/ui/Press.tsx`, `src/ui/Button.tsx`, `src/ui/v2/V2Action.tsx`, `src/ui/auth/AuthControls.tsx` | Accessible targets, same callbacks and disabled/pending semantics |
| Page/insets | Existing Settings/Calendar/Location screen wrappers; proposed `src/ui/system/Page.tsx` only if actual shared inset behavior warrants it | Explicit ownership of top/bottom/keyboard inset, no double padding |
| Header/section | `src/ui/system/ScreenHeader.tsx`, `DetailTopBar.tsx`, `Detail.tsx` | Contextual actions and wrapping; avoid oversized heading plus four controls |
| Home | `src/ui/home/HomePresentation.tsx`, `HomeIllustration.tsx`, `ActivitiesPresentation.tsx` | Preserve snapshot meaning and action destinations; replace arrangement from first principles |
| Navigation presentation | `src/app/(app)/_layout.tsx`, root `_layout.tsx` where needed | Preserve route/deep-link/session behavior; only after approved visible destination model |
| Task brief | `src/ui/v2/TaskCard.tsx`, `NeedPresentation.tsx`, `PublicNeedPresentation.tsx` | Shared fact order, different compact/detail compositions; no universal enclosing card |
| Map and preview | `src/ui/v2/MarketplacePresentation.tsx`, `DiscoveryMap.tsx`, `.types.ts`, `.web.tsx` | Pin/selected ID/list continuity, approximate coordinates, fallback; no provider swap |
| Task intake | `src/ui/v2/IntakePresentation.tsx`, `src/ui/aiFirst/AiConversationShell.tsx`, `VoiceComposer.tsx`, `FactValueEditors.tsx`, `ResponseDeadlineEditor.tsx` | Preserve draft and explicit send/review; input mode independent of draft existence |
| Final review | `src/app/(app)/pregled-zadatka.tsx`, `src/ui/needs/NeedLifecycleActions.tsx` | Review authoritative facts before command; stale/unknown handling remains |
| Location/photos/calendar | `src/ui/location/*`, `src/ui/media/*`, `src/ui/calendar/*` | Exact/private versus public, picker permission, civil time and scope guards |
| Offers/candidates | `src/ui/v2/ApplicationSelectionPresentation.tsx`, `MyApplicationsPresentation.tsx` | Actual offer terms, comparison, revision and exact-row pending-command reconciliation |
| Agreement | `src/ui/v2/AgreementCollectionPresentation.tsx`, `AgreementPresentation.tsx`, `src/ui/agreements/AgreementWorkspace.tsx`, `AgreementActionsScreen.tsx` | Next permitted action and accepted terms; no new transition or assumed resolver |
| Conversation | `src/ui/AgreementChat.tsx`, `src/ui/groups/GroupConversationScreen.tsx`, `src/ui/media/AgreementPhotoComposer.tsx` | Delivery truth, private attachments, retained draft, safe retry identity |
| Trust/person | `src/ui/system/PublicProfileSheet.tsx`, `src/ui/reviews/AccountReputation.tsx`, worker-profile presenters | Real signals only; explicit absent/unavailable distinction |
| Review entry | `src/ui/reviews/AgreementReviewScreen.tsx` | Rating/tag eligibility and immutable receipt; contrast-safe controls |
| Inbox/settings | `src/app/obavestenja.tsx`, `src/ui/notifications/PushPreferences.tsx`, `src/ui/settings/SettingsPresentation.tsx` | Subject deep links, unread semantics and available recovery after read failure |
| Auth/support/safety | `src/ui/auth/*`, `src/ui/support/*`, `src/ui/safety/*`, `src/ui/closure/*`, `src/ui/legal/*` | Consequences, permission boundaries and guarded actions remain clear |
| Feedback/motion | `src/ui/system/Appear.tsx`, `motion.ts`, `Skeleton.tsx`, `PermissionRecovery.tsx` | No replayed history or false success; reduced-motion parity |

Do not add every named primitive as a new file in advance. Extract only demonstrated shared behavior. `WorkerCard`, `InfoRow`, `Avatar`, `Rating` and `EmptyState` may become small primitives once repeated use and actual variants justify them.

## First five redesign surfaces, by product impact

| Order | Surface | Why it matters | Required reference categories |
|---|---|---|---|
| 1 | Home and its visible navigation | Explains the two purposes and the next real obligation on every return | Consumer service discovery; personal work overview; one-account multi-intent navigation; empty/populated contrast; native tab behavior |
| 2 | Map + task list + selected-task preview | Core earning discovery; current overlapping actions affect use | Spatial selection; clusters; task summaries; contextual sheet; persistent query/list continuity; Android Back |
| 3 | AI task creation, input and final brief | Turns an imprecise need into a publishable task; current composer problems matter | Conversation; dictation review; direct fact correction; service request; long text/keyboard; confirm-before-publish |
| 4 | Task detail → offer → candidate decision | People need enough truthful information to make a commitment | Local listing hierarchy; provider trust; numeric/time offer forms; proposal comparison; stale terms |
| 5 | Agreement workspace with chat | Makes the commitment understandable through changes, work, completion and problems | Accepted terms; current action; human conversation; event history; explicit consequential confirmation |

These are connected surfaces, not claims that every associated screen can be finished in one pass. Profile/interview, review, availability, notifications, auth and support follow as complete journeys; they remain in the inventory and cannot be dropped from release work. UI-04 recovery can be a separate small verified correction after approval, not a reason to postpone it until a full settings redesign.

## Stages and gates

**Now:** current truth, legacy audit, access registry, references, Figma index, constitution and recommendation. No production UI changes.

**Next, after the owner reviews this setup:** create three genuinely different **Home** compositions in Figma using empty, active and attention states plus long Serbian content. Apply the 5-example/3-source gate first. Compare the actual renders, not only verbal concepts. Recommend one and request visual direction approval before native implementation.

**Then:** implement the approved Home as one bounded surface and close relevant interaction defects with appropriate tests and real-device captures. Continue through the five priorities. Follow with worker interview/profile, reviews, availability, notification recovery and service/account surfaces. Broader data wiring, payment decisions and release work retain their separate backlog and approval boundaries.

**Release readiness is a later engineering gate**, including coherent end-to-end journeys, production setup, distribution/signing, policies, purchase model and device evidence. A design board does not satisfy it.

## Figma and code relationship

Figma is the primary visual workspace. A frame becomes implementation authority only when approval is recorded with its node ID, date and scope. Existing frames are not approved by existence. Reference, experiment, legacy and incomplete work remain visibly separate. Root DESIGN.md records principles and the repository records functional contracts.

Use component sets/variants and semantic variables for proven reusable pieces; preserve an original brand family. Add [Code Connect](https://developers.figma.com/docs/code-connect/) mappings after the actual component API and design are stable. No Code Connect integration is currently verified in this repository.

Existing runtime tools are sufficient for normal motion and icons: Reanimated 4.5.1, Gesture Handler ~2.32.0, Phosphor ^3.0.6, SVG 15.15.4, Expo haptics ~57.0.2 and MapLibre 11.3.10. Rive/Lottie are not installed. No new dependency, font or paid service is authorized by design setup.

## Content and state verification

Local design specimens must be clearly marked **design specimens, not real marketplace records** and never inserted into DEV. Use Serbian content such as “Prevoz troseda iz stana bez lifta i pomoć pri unošenju na četvrti sprat”, a long display name, “Bulevar kralja Aleksandra, šire područje”, remote work without address, a small and a large RSD amount, no reviews, many skills, a long message and 1/50-result lists. They test geometry, not completed flows or fake social proof.

Every significant surface needs an explicit state matrix and recorded N/A decisions. Minimum device checks: connected Android, small width, large width, large text, keyboard open/closed, gesture inset, Back, scrolling/sheets, offline/retry, denied permission and reduced motion. S23/iOS are currently coverage gaps, not assumed passes.

## Assets and references

Each reference records observed pattern, evidence type, weakness, what not to copy and USKOČI translation. Source accessibility is independent of asset licensing. Public screenshot access does not grant a license to copy product artwork. Keep real-account phone screenshots local; never send user drafts or private coordinates to external design tools.

New art must have provenance, license, editable source, native renderer, light/dark assumptions, reduced-motion/static fallback and size/performance check. Curating this material is the agent's job; no paid asset or service is necessary to begin.

## One exact next action

Complete the Home reference gate and present three Figma Home compositions with populated, empty and attention states. Do not implement them until the owner approves the resulting direction.
