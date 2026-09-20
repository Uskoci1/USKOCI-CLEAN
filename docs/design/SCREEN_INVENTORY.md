# USKOČI — current screen inventory

2026-09-20. 45 route/screen files plus 3 navigation infrastructure files. This is a capability inventory, not 45 unique approved designs. All new visual compositions remain unapproved. Source presence is not runtime proof.

Read the primary source names below as direct route dependencies. Some are controllers/hooks that call further services; the inventory does not claim a direct database call from each screen. Shared semantic groups define the user goal, next decision and state checklist.

## Functional groups

### HOME
- Primary user: Any signed-in person.
- Goal / first two seconds: Understand both entry paths and current obligations.
- Primary action: Start a task or open the next required decision.
- Secondary / disclosure: Explore work; open activities, profile or inbox.
- Important states: loading/partial/unavailable/empty/attention/active/long titles.
- Redesign priority: P1 / first five.

### MAP
- Primary user: Person exploring work; owner checking tasks.
- Goal / first two seconds: Find an eligible task and retain its spatial context.
- Primary action: Open the selected task.
- Secondary / disclosure: Search, filter, switch list/map, clear selection.
- Important states: loading/refresh/error/empty/filtered/remote/no pin/selected/cluster.
- Redesign priority: P1 / first five.

### TASK_DETAIL
- Primary user: Task owner or potential applicant.
- Goal / first two seconds: Understand scope, terms and permitted next step.
- Primary action: Apply, edit or inspect candidates as permitted.
- Secondary / disclosure: Questions, photos, profile, location and back.
- Important states: missing/stale/closed/own/applied/partial/long facts.
- Redesign priority: P1 / first five.

### CREATE_TASK
- Primary user: Person publishing a task.
- Goal / first two seconds: Produce and review a correct task brief.
- Primary action: Send input, confirm edited fact, or explicitly publish.
- Secondary / disclosure: Correct facts; add location/photos/time; preserve draft on back.
- Important states: draft/restored/pending/unknown/error/keyboard/permission/long text.
- Redesign priority: P1 / first five.

### AI_INTERVIEW
- Primary user: Person describing work capability.
- Goal / first two seconds: Express skills and turn them into inspectable profile facts.
- Primary action: Send an answer or confirm the current profile step.
- Secondary / disclosure: Edit understood facts; return to profile.
- Important states: empty/restored/streaming/pending/error/keyboard/dictation review.
- Redesign priority: P1 / second journey.

### WORKER_PROFILE
- Primary user: Person offering work; viewer of a candidate.
- Goal / first two seconds: Understand capability, area and availability.
- Primary action: Edit the relevant capability or open its dedicated editor.
- Secondary / disclosure: Interview, location, availability and reputation.
- Important states: loading/missing/partial/no photo/many skills/unavailable.
- Redesign priority: P1 / trust journey.

### REQUESTER_PROFILE
- Primary user: Account owner or authorized profile viewer.
- Goal / first two seconds: Recognize the person and genuine reputation.
- Primary action: Open the relevant account or profile action.
- Secondary / disclosure: Worker capability, settings, safety and back.
- Important states: loading/no photo/no reviews/partial/long name.
- Redesign priority: P2 / trust journey.

### APPLICATION
- Primary user: Applicant or owner comparing applications.
- Goal / first two seconds: Make or evaluate an exact offer.
- Primary action: Submit/review/retain/update/select as permitted.
- Secondary / disclosure: Task context, interval, public profile, withdraw/cancel.
- Important states: loading/empty/pending/unknown/stale/closed/disabled/keyboard.
- Redesign priority: P1 / first five.

### AGREEMENT
- Primary user: Participant in an agreement.
- Goal / first two seconds: Understand accepted terms, current state and next responsibility.
- Primary action: Perform the one currently permitted next action.
- Secondary / disclosure: Chat, location, changes, problem, review, history.
- Important states: awaiting/confirmed/completed/cancelled/problem/proposal/unknown.
- Redesign priority: P1 / first five.

### CHAT
- Primary user: Authorized agreement/group participant.
- Goal / first two seconds: Communicate with context and honest delivery state.
- Primary action: Send the current message explicitly.
- Secondary / disclosure: Read older messages, attachments and relevant agreement.
- Important states: empty/history/sending/confirmed/unknown/failed/terminal/keyboard.
- Redesign priority: P1 / first five.

### NOTIFICATIONS
- Primary user: Signed-in account holder.
- Goal / first two seconds: Understand a change and reach its precise subject.
- Primary action: Open event or confirm settings update.
- Secondary / disclosure: Filter, read state, permissions, refresh.
- Important states: loading/paging/empty/error/unread/stale subject/denied permission.
- Redesign priority: P1 recovery; P2 redesign.

### REVIEWS
- Primary user: Eligible participant after collaboration.
- Goal / first two seconds: Give a valid rating and understand its finality.
- Primary action: Submit eligible rating or read saved receipt.
- Secondary / disclosure: Choose allowed tags; return to agreement.
- Important states: loading/ineligible/editable/disabled/pending/unknown/receipt/error.
- Redesign priority: P1 / completion journey.

### AVAILABILITY
- Primary user: Person offering work or viewing own schedule.
- Goal / first two seconds: Understand available intervals and commitments.
- Primary action: Confirm an interval or inspect a scheduled agreement.
- Secondary / disclosure: Edit exceptions/working hours; change date; back.
- Important states: loading/empty/conflict/time zone/invalid interval/pending/error.
- Redesign priority: P2 / capability journey.

### SERVICE
- Primary user: Account holder; operator only where authorized.
- Goal / first two seconds: Complete a precise settings, safety or support task.
- Primary action: Confirm the current explicit action.
- Secondary / disclosure: Read consequences; recover; return without data loss.
- Important states: loading/permission/validation/pending/unknown/error/disabled/keyboard.
- Redesign priority: P1 recovery/safety; P2 presentation.

### AUTH
- Primary user: Unauthenticated or recovering account holder.
- Goal / first two seconds: Understand the service and safely regain account access.
- Primary action: Complete the current authentication step.
- Secondary / disclosure: Recovery, back and legal information.
- Important states: initial/invalid input/pending/error/recovery/session transition/keyboard.
- Redesign priority: P1 regression gate; P2 redesign.

### COMPAT
- Primary user: Person following an older link.
- Goal / first two seconds: Arrive at the current supported destination.
- Primary action: Automatic guarded redirect.
- Secondary / disclosure: Preserve back and named object context.
- Important states: valid/malformed/unavailable target.
- Redesign priority: P2 compatibility gate.

## Every current route

| Route | Purpose / group | Current component | Direct data/controller imports | Evidence / design status |
|---|---|---|---|---|
| `/bezbednost` — `src/app/(app)/bezbednost.tsx` | Safety and reporting; SERVICE | SettingsScreen, SafetyScreen | ../../data/serverReceipt; ../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/dogovori` — `src/app/(app)/dogovori.tsx` | Agreement collection; AGREEMENT | AgreementCollectionPresentation | ../../hooks/useFocusedResource; ../../store/sesija; ../../store/uloga | SOURCE + DEVICE (observed states only); RETHINK unless compatibility-only |
| `/fotografije-zadatka` — `src/app/(app)/fotografije-zadatka.tsx` | Task photos; CREATE_TASK | SettingsScreen | ../../data/mediaClientService; ../../features/media/nativePhotoPicker; ../../store/sesija; ../../data/serverReceipt | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/` — `src/app/(app)/index.tsx` | Home; HOME | HomePresentation | ../../data/homeSnapshot; ../../hooks/useFocusedResource; ../../store/sesija; ../../store/uloga | SOURCE + DEVICE (observed states only); RETHINK unless compatibility-only |
| `/mapa` — `src/app/(app)/mapa.tsx` | Map destination wrapper; MAP | Inline route / shared primitives | Feature UI/controller wrapper; see import inventory | SOURCE + DEVICE (observed states only); RETHINK unless compatibility-only |
| `/mesto-zadatka` — `src/app/(app)/mesto-zadatka.tsx` | Task location; CREATE_TASK | LocationScreen | ../../data/locationClientService; ../../hooks/useOwnedEditor; ../../data/productionLocationResolver | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/moje-aktivnosti` — `src/app/(app)/moje-aktivnosti.tsx` | My activities overview; HOME | ActivitiesPresentation | ../../data/homeSnapshot; ../../hooks/useFocusedResource; ../../store/sesija; ../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/moje-prijave` — `src/app/(app)/moje-prijave.tsx` | My applications and revision review; APPLICATION | MyApplicationsPresentation | ../../data/ports; ../../data/applicationSelectionClientService; ../../data/myApplicationsClientService; ../../data/ru4Production; ../../data/serverReceipt; ../../hooks/useOwnedEditor; ../../store/sesija; ../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/nova` — `src/app/(app)/nova.tsx` | AI task conversation; CREATE_TASK | IntakePresentation | ../../data/aiTurnIntentJournal; ../../data/ports; ../../data/serverReceipt; ../../hooks/useOwnedEditor; ../../store/sesija; ../../features/voice/useHoldToTalk | SOURCE + DEVICE (observed states only); RETHINK unless compatibility-only |
| `/oceni-dogovor` — `src/app/(app)/oceni-dogovor.tsx` | Agreement review; REVIEWS | AgreementReviewScreen | ../../store/sesija; ../../data/serverReceipt | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/pitanja-zadatka` — `src/app/(app)/pitanja-zadatka.tsx` | Preselection task questions; TASK_DETAIL | TaskQaScreen | ../../store/sesija; ../../data/serverReceipt | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/podrska` — `src/app/(app)/podrska/index.tsx` | Support inbox; SERVICE | SupportInboxScreen | ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/podrska/novi` — `src/app/(app)/podrska/novi.tsx` | New support request; SERVICE | SupportNewScreen | ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/podrska/operator` — `src/app/(app)/podrska/operator.tsx` | Restricted support operator inbox; SERVICE | SupportInboxScreen | ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/podrska/[id]` — `src/app/(app)/podrska/[id].tsx` | Support request detail; SERVICE | SupportDetailScreen | ../../../data/serverReceipt; ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/potrebe/[id]/kandidati` — `src/app/(app)/potrebe/[id]/kandidati.tsx` | Candidate list and selection; APPLICATION | CandidateListPresentation, CandidateSelectionPresentation | ../../../../data/ports; ../../../../data/applicationSelectionClientService; ../../../../hooks/useOwnedEditor; ../../../../store/sesija; ../../../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/potrebe/[id]/pregled` — `src/app/(app)/potrebe/[id]/pregled.tsx` | Owned task detail; TASK_DETAIL | NeedPresentation | ../../../../data/ports; ../../../../data/serverReceipt; ../../../../data/ru4Production; ../../../../data/remainingSearchCloseAttempt; ../../../../data/needPublicationReadiness; ../../../../hooks/useOwnedEditor; ../../../../store/sesija; ../../../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/potrebe` — `src/app/(app)/potrebe.tsx` | Owned tasks, drafts and history; MAP | MarketplacePresentation | ../../hooks/useFocusedResource; ../../data/marketplaceView; ../../store/sesija; ../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/pregled-nacrta` — `src/app/(app)/pregled-nacrta.tsx` | Legacy draft-review redirect; COMPAT | Redirect | ../../data/serverReceipt | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/pregled-zadatka` — `src/app/(app)/pregled-zadatka.tsx` | Final task review and corrections; CREATE_TASK | { SupportContextEntry }; { T } | ../../data/aiTaskReviewClientService; ../../data/aiNeedV2Ui; ../../data/ports; ../../data/serverReceipt; ../../hooks/useOwnedEditor; ../../store/sesija; ../../data/locationClientService; ../../data/productionLocationResolver | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/prilike/[id]/prijava` — `src/app/(app)/prilike/[id]/prijava.tsx` | Task application form; APPLICATION | ApplicationSelectionPresentation | ../../../../data/ports; ../../../../data/applicationSelectionClientService; ../../../../data/applicationCommandJournal; ../../../../hooks/useOwnedEditor; ../../../../store/sesija; ../../../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/prilike/[id]` — `src/app/(app)/prilike/[id].tsx` | Public task detail; TASK_DETAIL | PublicNeedPresentation | ../../../store/uloga; ../../../data/taskRelation; ../../../store/sesija; ../../../hooks/useFocusedResource | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/prilike` — `src/app/(app)/prilike.tsx` | Public discovery list/map; MAP | MarketplacePresentation | ../../hooks/useFocusedResource; ../../data/marketplaceView; ../../store/sesija; ../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/blokirani` — `src/app/(app)/profil/blokirani.tsx` | Blocked accounts; SERVICE | SettingsScreen | ../../../data/safetyClientService; ../../../hooks/useOwnedEditor; ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/dostupnost` — `src/app/(app)/profil/dostupnost.tsx` | Availability editor; AVAILABILITY | CalendarScreen | ../../../hooks/useOwnedEditor; ../../../hooks/useFocusedResource; ../../../data/workerAvailabilityClientService; ../../../data/ownProfileClientService; ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/fotografija` — `src/app/(app)/profil/fotografija.tsx` | Profile photo editor; REQUESTER_PROFILE | SettingsScreen | ../../../data/mediaClientService; ../../../features/media/nativePhotoPicker; ../../../hooks/useOwnedEditor; ../../../store/sesija; ../../../data/serverReceipt; ../../../data/ports | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/izvoz` — `src/app/(app)/profil/izvoz.tsx` | Account-data export; SERVICE | SettingsScreen | ../../../data/dataExportClientService; ../../../data/ports; ../../../data/serverReceipt; ../../../hooks/useOwnedEditor; ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/lokacija` — `src/app/(app)/profil/lokacija.tsx` | Worker service area; WORKER_PROFILE | LocationScreen | ../../../data/locationClientService; ../../../hooks/useOwnedEditor; ../../../data/configuredLocationResolver | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/o-aplikaciji` — `src/app/(app)/profil/o-aplikaciji.tsx` | App/build information; SERVICE | SettingsScreen | Feature UI/controller wrapper; see import inventory | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/obavestenja` — `src/app/(app)/profil/obavestenja.tsx` | Notification preferences; NOTIFICATIONS | Stack.Screen | ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/podaci` — `src/app/(app)/profil/podaci.tsx` | Account data; REQUESTER_PROFILE | SettingsScreen | ../../../data/requesterProfileClientService; ../../../hooks/useOwnedEditor; ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/pravna` — `src/app/(app)/profil/pravna.tsx` | Legal documents and acceptance state; SERVICE | SettingsScreen | ../../../data/legalClientService; ../../../data/processorMapClientService; ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/privatnost` — `src/app/(app)/profil/privatnost.tsx` | Privacy and account closure; SERVICE | SettingsScreen | ../../../data/retentionPolicyClientService; ../../../hooks/useFocusedResource; ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/radnik` — `src/app/(app)/profil/radnik.tsx` | Work capability profile; WORKER_PROFILE | { T }; { brandAction, sys } | ../../../data/ports; ../../../hooks/useOwnedEditor; ../../../store/sesija; ../../../store/uloga | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil/razgovor` — `src/app/(app)/profil/razgovor.tsx` | AI work-profile interview; AI_INTERVIEW | AiConversationShell | ../../../data/workerAiClientService; ../../../data/workerAiTurnIntentJournal; ../../../data/ports; ../../../data/serverReceipt; ../../../hooks/useOwnedEditor; ../../../store/sesija; ../../../features/voice/useHoldToTalk | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/profil` — `src/app/(app)/profil.tsx` | Own profile and account hub; REQUESTER_PROFILE | SettingsScreen | ../../store/sesija; ../../data/authClientService; ../../data/ownProfileClientService; ../../hooks/useFocusedResource | SOURCE + DEVICE (observed states only); RETHINK unless compatibility-only |
| `/raspored` — `src/app/(app)/raspored.tsx` | Personal agreement schedule; AVAILABILITY | { DetailTopBar }; { sys } | ../../data/workerCalendarClientService; ../../data/agreementClientService; ../../hooks/useFocusedResource | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/auth` — `src/app/auth.tsx` | Entry and authentication; AUTH | { AuthIntro, authStageForm }; { AuthSheet } | ../data/authClientService; ../hooks/useAuthAvailability; ../hooks/useAuthFormCommand; ../data/entryIntentClientService; ../store/sesija; ../hooks/useEntrySplashReady | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/dogovor/[id]/grupa` — `src/app/dogovor/[id]/grupa.tsx` | Group conversation; CHAT | GroupConversationScreen | ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/dogovor/[id]/izmene` — `src/app/dogovor/[id]/izmene.tsx` | Agreement changes and consequential actions; AGREEMENT | AgreementActionsScreen | ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/dogovor/[id]/lokacija` — `src/app/dogovor/[id]/lokacija.tsx` | Authorized agreement location; AGREEMENT | AgreementLocationScreen | ../../../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/dogovor/[id]` — `src/app/dogovor/[id].tsx` | Agreement workspace and conversation; AGREEMENT | WorkspaceCard, WorkspaceRows, WorkspaceRow, WorkspaceNote, WorkspaceFooter | ../../data/ports; ../../store/uloga; ../../hooks/useFocusedResource; ../../hooks/useOwnedEditor; ../../hooks/useAgreementOutbox; ../../hooks/useAgreementPhotos; ../../data/agreementPhotoClientService; ../../store/sesija; ../../data/needDetailPresentation; ../../data/agreementClientService; ../../data/agreementCompletion | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/obavestenja` — `src/app/obavestenja.tsx` | Activity inbox; NOTIFICATIONS | Stack.Screen | ../hooks/useInbox | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/oporavak` — `src/app/oporavak.tsx` | Account recovery; AUTH | { AuthIntro, authStageForm }; { authTheme as c } | ../store/passwordRecoveryIntent; ../hooks/usePasswordRecovery; ../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |
| `/prijave` — `src/app/prijave.tsx` | Legacy applications redirect; COMPAT | Redirect | ../store/sesija | SOURCE structure / runtime unverified this pass; RETHINK unless compatibility-only |

## Navigation infrastructure

| Source | Responsibility | Boundary |
|---|---|---|
| `src/app/_layout.tsx` | Root session/auth routing, providers and stack | Preserve session/account revision and recovery behavior |
| `src/app/(app)/_layout.tsx` | Current Home / Map / Agreements tab shell and hidden routes | Visible composition may change after research; destination reachability and Back must survive |
| `src/app/+native-intent.tsx` | Native incoming intent adaptation | Preserve supported links; do not remove because it has no visual screen |

## Embedded surfaces that routes alone miss

| Surface | Current owner | Group / important states |
|---|---|---|
| Public profile sheet | `src/ui/system/PublicProfileSheet.tsx` | WORKER_PROFILE / REQUESTER_PROFILE; absent/partial/reputation/no photo |
| Discovery filters / selected task preview | `src/ui/v2/MarketplacePresentation.tsx` | MAP; draft/applied filters, close/back, selected pin, long content |
| Candidate detail and interval selection | `src/ui/v2/ApplicationSelectionPresentation.tsx` | APPLICATION; comparison, unavailable terms, pending command, date/zone |
| AI facts and response deadline editors | `src/ui/aiFirst/FactValueEditors.tsx`, `ResponseDeadlineEditor.tsx` | CREATE_TASK / AI_INTERVIEW; validation, pending, keyboard, corrected facts |
| Dictation/transcript surface | `src/ui/aiFirst/VoiceComposer.tsx` | Permission, listening, processing, transcript review, cancel/error; not voice-tested |
| Private photo selection / message attachment | `src/ui/media/*` | Permission, picking, upload, pending, authorized read, failed attachment |
| Interval/calendar native picker | `src/ui/calendar/CalendarControls.tsx` | AVAILABILITY; iOS sheet/Android picker, valid range, Back |
| Location candidate and pin editor | `src/ui/location/LocationPointEditor.tsx` | Public/private distinction, invalidated selection, lookup failure, denied permission |
| Account closure dialog | `src/ui/closure/ClosureDialog.tsx` | SERVICE; explicit consequence, pending/unknown/blocked/completed; never exercised destructively |
| Entry animation and auth sheet | `src/ui/entry/*`, `src/ui/auth/AuthSheet.tsx` | AUTH; initial/returning, keyboard, reduced motion, error |

## Coverage and next evidence

Phone observations currently cover only the specific Home, agreement-list, map, selected-map, profile and restored-draft intake states described in CURRENT_UI_TRUTH.md. All other state combinations are pending visual QA. Loading/refresh, offline, errors, large Serbian text, no/many results, screen readers, reduced motion, small screens, iOS and S23 must not be inferred from the route inventory.

Reference groups live in `docs/design/references/01_HOME.md` through `15_NAVIGATION.md`. SERVICE and AUTH use onboarding, navigation, notification and task-form references with their own consequence/permission requirements. No screen is approved until its composition, states and actual render pass review.
