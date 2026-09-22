# USKOČI — integrated plan to the first public release

Updated: 2026-09-22. This is the single execution plan for engineering, mobile UX, push, operating the
service and App Store / Google Play submission. It replaces the earlier separate gate lists in this file.
Measured status and package receipts remain in USKOCI_CURRENT_STATUS.md; this plan does not grant new
permissions or certify store compliance. Owner reports are in plain Serbian; repository documents are English.

## 1. Release scope and current position

The first release is a marketplace in Serbia: one account can publish a task and offer to do work.
The complete journey is task creation → discovery → application → selection → Dogovor and communication
→ work completion → confirmation → review, with clear change, cancellation, problem and recovery paths.

Binding scope:
- Preserve the working server-owned product rules and the unified Home.
- The owner requires paid connection-service monetization before the first public release. The exact
  charge, payer, collection method and refund rules are undecided. Job escrow, worker payouts and
  purchased credits are not approved by implication.
- Voice in the first release means dictation → editable text → explicit Send. Full spoken AI dialogue
  is a later phase. Do not let a later-phase feature delay the agreed first release.
- Current UI, HTML and the old uskoci-design direction are reference material, not a visual baseline.
  Major screens require functional analysis and three materially different compositions before selection.
- Serbia is the initial market. Expansion across the Balkans needs an explicit country list and a
  separate check of payment, language, operating and legal requirements.

Measured starting point:
- Canonical DEV leqcwgzvjsxugfgzdmth, ledger 197 = 147 frozen source + 50 dev_alpha. No production project.
- PKG-045a applied. PKG-045b is proven and explicitly owner-approved, including certificate rebinding,
  AFTER verification of the new app. Phone readiness and active-device inventory remain pending.
- APK 35707463751 is built and verified, not installed. Full local Jest: 242 suites / 4,687 tests and
  types passed; PKG-045 disposable proof: 17 SQL/Auth/REST/client checks and real disposable closure.
- AI intake 50 is deployed; owner reports that replies work and are warmer. Broad quality evaluation remains.
- Push transport was last verified disabled. Real device delivery is not verified.
- Many lifecycle fixes are applied, but no complete latest two-person device journey is signed off.

A release percentage cannot be derived from test counts or closed findings. Keep evidence levels separate:
implemented → automated proof → DEV applied → app built → device verified → release accepted.

## 2. Execution order and dependencies

The rows below form one plan, not nine isolated projects. Engineering follows R1–R4 first; design
exploration in R5 and owner/operator preparation in R6–R7 begin alongside that work. R8 measurements and
R9 build preparation can also start early. Public rollout waits for all applicable release gates.

Work remains solo. “Alongside” means independent work while a build/proof runs, not permission to delegate.
When a phone or owner input is unavailable, continue the independent work described below.

| ID | Workstream | Starting status | Required result and completion evidence |
| --- | --- | --- | --- |
| R1 | Task privacy and compatible rollout | A applied; B proven/approved with device condition | Install compatible app with data preserved, verify actual task reads on active test devices, apply exact proven B, verify ledger bytes, permissions and new closure binding; record receipt. |
| R2 | Push and notification experience | Infrastructure exists; disabled; recovery defect observed in code | Reliable settings recovery, device registration, controlled delivery and correct navigation, final copy/icon/sound/grouping and native presentation; verify on Android and iOS. |
| R3 | Accounts, privacy, deletion and export | Closure preparation partly aligned; second-device recovery open; legal inputs missing | Consistent account states and recovery across devices, complete deletion and export/delivery journeys, public deletion-request page and accurate disclosure/consent. |
| R4 | Complete marketplace and client/server contracts | Core implemented; several fixes proven/applied; whole journey unverified | Every supported action has a valid entry, server outcome, clear refusal/recovery and correct next screen. Full flow matrix below passes, including interruptions and both participants. |
| R5 | New native product experience | No final app-wide direction accepted | Three compositions per major surface, selected original visual system, implemented components/states/motion, real-data and accessibility/device verification. |
| R6 | Safety, moderation and support operation | Report/block/support code exists; operational coverage unverified | Users can report relevant content/AI output, block abuse and reach support; an assigned operator can triage and resolve cases through tested permissions and procedures. |
| R7 | Operator, legal, charging and developer accounts | Owner/business inputs and commercial model unresolved | Real operator data, reviewed published documents, data/retention decisions, defined compliant charge/refund flow, verified publishing accounts and selected territories. Start now. |
| R8 | Performance, production and recovery | No measured capacity or production environment | Isolated load/recovery evidence, launch limits, approved production configuration, monitoring, backup/restore verification and incident ownership. |
| R9 | Distribution, pilot, store review and launch | Internal APK build exists; final Android/iOS route and store forms unverified | Signed distribution builds, relevant SDK/privacy checks, platform tests, pilot evidence, accurate listings and review access; owner-approved controlled rollout after acceptance. |

### Immediate next actions

1. R2 source/proof work can proceed now: reproduce and fix the disabled settings-recovery button.
2. When the owner is ready, install/verify the already prepared compatible APK and complete R1 under the
   existing conditional approval. Do not ask again for pkg045b approval. If a newer app is built first,
   verify its own source/hash and compatibility rather than silently reusing the older APK receipt.
3. Complete R2 registration/transport and controlled device-delivery checks. Only then enable general delivery.
4. Continue R3 closure recovery and R4 remaining client-call comparisons, with before/after proof packages.
5. Start the R7 decision worksheet now; collect inputs while engineering proceeds. Prepare R5 explorations
   against real functional requirements instead of waiting for the last technical fix.
6. Run the first complete two-person journey, fix its observed failures, then repeat the affected paths on
   the selected design and final distribution builds. Do not postpone all device testing until after redesign.

## 3. Complete flow coverage (R3–R4)

For every row, record source/proof/build/device evidence separately. Test valid action, definite refusal,
stale data, duplicate tap, lost acknowledgement, offline/background/restart and account change where applicable.
No successful message, payment or deletion is inferred from a spinner ending.

| Surface / journey | Acceptance coverage |
| --- | --- |
| Registration and access | Sign-up, login, logout, password recovery and links, expired session, return to the intended screen, published legal consent, denied permissions and account isolation. |
| AI task intake and publication | Text and approved dictation path; one relevant missing question, correction of prior facts, dates/timezone, location, people and total/per-person price; review, edit, publish and recovery without blind paid replay. |
| Worker profile | AI interview, skills/tools/vehicles/team/availability, review, activate and later edit; honest missing data and no invented qualifications or identity-verification claims. |
| Discovery and task detail | Search, filters, map/list, empty results, owner/public/historical participant visibility, current counts and status; public Q&A bound to the correct task revision. |
| Applications and selection | Submit, withdraw, edit/reconfirm after task change, price/headcount parity, capacity, choose candidates, double selection and recovery to the existing Dogovor. |
| Dogovor and communication | Bilateral/group messages, attachments, photos, permitted location/contact sharing, calendar, changed terms, stale proposals and blocked-contact boundaries. |
| Completion and exceptions | Mark done, confirm, auto-completion, ratings, cancelled task versus cancelled Dogovor, partial teams, closed search, reported problem and its resolution, support escalation. |
| Home and activities | Unified tasks/applications/agreements, server-owned attention and counts, meaningful empty/unavailable states, bounded previews with row-specific command reconciliation. |
| Notification entry paths | In-app item and push tap, cold/warm launch, login return, duplicate/stale item, deleted/inaccessible subject and correct account-owned destination. |
| Account data and safety | Profile, optional phone only if approved, report/block, support, legal/AI consent, export/request/download/expiry, deletion request/progress and second-device recovery. |

Known engineering work still open:
- Closure's legacy preparation/read path and restricted-account execution recovery need a compatible design.
  The execution reader depends on a locally saved START request ID; another device cannot discover it.
  Certified functions need a separately proven rebind and fresh owner approval for that future package.
- Remaining 7.1 client-call families need body-to-adapter-to-screen comparison. PKG-036's 11 lifecycle RPCs
  are partial coverage, not a completed audit of every caller.
- Home attention is integrated; activity/upcoming previews and owner lists still include full-list reads.
  Pagination must not break pending-command reconciliation.
- AI fault recovery has server/Edge proofs. Complex dates, long history and real conversational quality need
  device examples and bounded regression coverage. User-initiated AI evaluation is distinct from agent-paid calls.
- PKG-014B run 35704252850 has an observed stale source fingerprint after AI changes; fix the manifest only
  against exact source evidence. Do not weaken its checks. Owner-accepted CodeQL debt remains untouched.

## 4. Push delivery and appearance (R2)

Current source facts:
- The worker sends the same public title/body and data kind INBOX; tapping opens /obavestenja.
- Foreground presentation admits an explicit copy allowlist. A new worker string alone can be rejected by
  the existing client. Direct push-to-task/Dogovor is new work and needs an account-owned resolver.
- Android uses a PRIVATE, DEFAULT-importance channel. OS settings control actual sound/presentation.
- PushPreferences has category/quiet-hour controls. Its locked = busy || error also disables “Proveri stanje”
  after a failed read or uncertain registration. This is a source-observed defect, not a phone reproduction.
- Token registration, successful scheduler invocation and provider acceptance do not prove device delivery.

Complete these checks:
- [ ] Reproduce and fix settings recovery; permit authoritative reread while fencing duplicate writes.
- [ ] Verify native build/provider configuration, permission and session-bound registration without revealing credentials.
- [ ] Verify opt-in categories, both account activities, quiet hours and explicit urgent override.
- [ ] Review the queued work and recipient scope before controlled activation; no broadcast or fabricated DEV events.
- [ ] Observe a real agreed event on the owner's ready devices: queued, provider accepted, device visible and opened.
- [ ] Check foreground/background/cold-start, denied permission, logout/account change and duplicate/stale events.
- [ ] Define per-event concise copy, icon, sound, grouping and in-app read/unread presentation.
- [ ] Keep private message/address data private. More specific lock-screen text is a proposal, not current behavior.
- [ ] Update sender payload, client validation, owned destination and old/new compatibility together for richer notifications.
- [ ] Verify the final Android/iOS appearance and record real delivery/navigation evidence before general activation.

Controlled activation is necessary for real delivery testing and is distinct from general delivery.
Appearance design and source fixes do not depend on phone availability or a completed app-wide redesign.

## 5. Design system and implementation (R5)

For each major surface: describe its functional responsibility → ignore visual legacy → explore at least
three materially different compositions → compare tradeoffs → select/combine → implement → verify with
real states. Reuse an old pattern only if it earns its place in the selected solution.

Cover entry/auth, unified Home, discovery/map, task detail, AI task/worker interviews, review/publication,
applications/candidate selection, profiles/reviews, Dogovor/chat, notification center and settings/safety/data.
Include loading, empty, error, offline, stale, success, long text and large-text states.

Use Figma for editable approved design where available; connect selected components to native code.
Reference Airtasker, Taskrabbit, Wolt, Airbnb and Uber for the relevant problem without copying their
identity. Mobbin requires an account/plan the owner does not currently have; do not make it a dependency.
Use existing native components and animation libraries first. Evaluate ready-made chat interfaces, sheets,
icons and selective Lottie/Rive assets by compatibility, license and actual need. No new package or paid
service is authorized by this plan. Preserve the current chat backend and privacy guarantees unless a
separate architectural decision justifies a replacement.

Completion includes keyboard behavior, touch targets, text scaling, accessibility labels/focus, reduced
motion, app performance, both platform conventions and store-ready screenshots of the implemented app.
Full spoken AI conversation remains out of the first-release scope.

## 6. Safety, legal, privacy and commercial decisions (R3, R6, R7)

Use the existing lawyer worksheet v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md as a historical
technical inventory, then reconcile it with the final implementation. Do not treat its proposed periods
or old processor/payload descriptions as current approved policy.

Deliver:
- Identified operator and publishing owner, contact/support details, initial countries and intended audience.
- Reviewed and published terms, privacy policy, retention rules and version-bound consent.
- Actual account deletion and export journeys, plus a public deletion-request route usable without the app.
- Data inventory covering client, server and every SDK/processor: personal data, location, photos, messages,
  voice, push and diagnostics. Match store forms and disclosures to actual collection/use/sharing.
- Clear disclosure and appropriate explicit permission before personal data is shared with third-party AI.
  Audit existing UI/server coverage before claiming this is missing or complete.
- Report/block/filter coverage across public tasks, profiles, photos, messages and AI output; verify existing
  controls and fill missing entry points. Staff the operator queue and define response/escalation procedures.
- A defined connection charge: who pays, for what event, when charged, what failed connection/cancellation
  means, refunds/receipts and disputes. Determine the permitted payment route for each selected storefront.
  Calling a purchase “connection service” does not establish that bank payment is permitted; digital contact
  access versus an outside-app service must be assessed from the actual purchase flow.
- Implement and verify the selected payment flow before first release, including duplicate callbacks, failed
  or pending payment, reconciliation and refunds. Use an approved sandbox; no live charge by implication.
- Optional profile phone: owner decision remains pending. Do not imply SMS/identity verification.
- Developer-account type/identity verification. If external social login is used, check applicable Apple
  login requirements against the actual offered login choices; do not add a feature from a generic checklist.

## 7. Performance, production and service operation (R8)

Define expected pilot activity and workload first. Registered users, daily users, concurrent sessions and
concurrent AI streams are different metrics; no supported user count is established yet.

On an isolated environment, grow synthetic history and traffic, simulate external paid transports and
measure p50/p95/p99 latency, query plans, locks/connections, queue backlog, uploads, error rate, memory and
cost estimates. Include duplicate delivery, restarts, concurrent actions and unavailable workers.
Do not load-test canonical DEV or paid providers.

Known query to measure: the PKG-037 review sweep bounds writes to 100 commands, not rows scanned.
The September22 catalog check found no state/lease index on private.ai_task_review_commands. Add an
index only if measurement justifies it and follow certificate/approval rules. Also measure Home/list/chat
history before claiming scaling is finished.

Prepare a production setup and migration plan distinct from DEV, compatible client rollout order,
monitoring/alerts without private-content leakage, AI cost limits, backup/restore proof and incident
ownership. Set release thresholds from measurements, and record how to halt rollout or recover safely.
Production/shared-resource changes require owner authorization; a plan is not that authorization.

## 8. Distribution, testing and store submission (R9)

The inspected eas.json has only an internal preview APK profile. That observation does not establish the
state of external developer accounts or all CI distribution workflows. Verify those before configuring
the final Android App Bundle and signed iOS distribution build.

Complete:
- [ ] Verify Apple/Google publishing accounts, legal identity and any account-specific testing requirements.
- [ ] Final package/bundle identity, signing, versioning, release environment and backend availability.
- [ ] Applicable Android target SDK / Apple build SDK, native permissions, SDK privacy manifests and required API reasons.
- [ ] Accurate App Privacy / Data Safety, deletion URL, age/content rating and content/permission declarations.
- [ ] Final device journeys on Android and iPhone, including push and denied permissions; beta/pilot feedback and regressions.
- [ ] Store title, description, category, screenshots, icon, support/privacy links, content licenses and review instructions.
- [ ] An approved review-access arrangement that exercises the real features without real-user impersonation or fabricated DEV data.
- [ ] Relevant Google closed test and production-access application; TestFlight distribution/review as applicable.
- [ ] Applicable fixes closed, pilot acceptance recorded, support/monitoring staffed, payment/legal gates complete.
- [ ] Owner go/no-go, store submission, review responses, controlled rollout and observation before wider distribution.

Current official reference points were checked on 2026-09-22. Recheck when submitting:
- New Google submissions/updates target API 36+ from August31,2026; Apple uploads use Xcode26+/iOS26 SDK+
  from April28,2026. These are build requirements, not the minimum OS every user's phone must run.
- New personal Google accounts created after November13,2023 require at least12 opted-in testers for
  14 consecutive days before applying for production access. Do not apply that condition indiscriminately
  to organization accounts or claim that completing the test guarantees access.
- Store completeness, privacy, moderation, billing and review access are independent of passing our tests.
  Export/retention details and Serbian legal compliance require appropriate operator/legal decisions;
  do not invent a universal store-mandated retention period or separate export-button requirement.

## 9. Decisions, permissions and work that can proceed

| Input | State / next step | Independent work meanwhile |
| --- | --- | --- |
| pkg045b certificate change | Explicitly approved AFTER new-app verification. Do not re-ask. | Source work and regression proofs. |
| Phone readiness and number of active devices | Pending. No install or phone operation implied by approval alone. | R2 settings fix, R3/R4 investigation and proofs, R5 exploration. |
| Push activation and controlled recipients | Separate controlled test when the owner is ready; general delivery remains off. | Sender/client contract, copy/icon designs and tests. |
| Operator/legal/retention | Real inputs missing; use the reconciled worksheet. | Data inventory, draft form structure and technical paths. |
| Paid connection model and countries | Needs concrete commercial decision and policy assessment. | Compare viable flows and prepare a decision proposal, without enabling a payment mechanism. |
| Profile phone | Optional unverified field decision unanswered. | Other profile and account work. |
| Visual choices/assets | Show three compositions and obtain the relevant direction; no fixed old-style constraint. | Functional maps, references and existing-library evaluation. |
| Later certificate/JWT/production changes | Follow the owner's separate explicit-approval boundaries. | Complete concrete proof/proposal before requesting approval. |

Standing boundaries remain: work solo; never handle or print secrets; no paid AI/provider probes, fake DEV
accounts/data, destructive operations, uninstall/clear, dependency changes without approval, force-push,
new PR, CodeQL work, repair branch or pkg023c. Frozen migrations stay untouched. The known untracked
148th migration remains outside commits. This plan authorizes none of those actions.

## 10. Reporting and closeout rule

For every slice record the user-visible problem, chosen change, exact tests/proof and their limitations,
deployment/build/device status, residual risk, next step and any real owner decision.
Use one state per item: not started / implemented / proven / applied / device verified / ready for release.
Preserve package receipts and the current-status index; do not create competing completion percentages.

“Ready for first public release” means the agreed first-release flows and exception paths pass, applicable
store obligations are satisfied, payment/legal/support are operational, production recovery is verified,
and the owner approves controlled launch. A successful upload or store acceptance alone is not operational
readiness; neither implies every later-phase feature has been built.

## Official policy sources

The list supports the planning criteria, not a claim of current compliance:
- [Apple review: completeness, privacy/AI sharing, billing and review access](https://developer.apple.com/app-store/review/guidelines/)
- [Apple app privacy](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- [Apple required-reason API declarations](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- [Apple SDK requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)
- [Google user data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Google account deletion including the web route](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Google user-generated content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
- [Google AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en-GB)
- [Google payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [Google target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Google new personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google developer verification](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)
