# USKOCI functional audit — 2026-09-22

Status: OWNER APPROVED the presented analysis and execution order on2026-09-22 ("odobram sve to").
Client implementation starts with F01-F04; see CLIENT_FOUNDATION.md. Server proposals remain separate.

Execution status has one source: `docs/control/redovi.json` and its generated table. This report and the48-section matrix are a dated analytical snapshot, not a second maintained status tracker. Every one of the62 control rows links to relevant matrix IDs via `funkcionalni_audit`; the mapping covers all48 analytical sections. Verified defects and current partial device evidence were copied into the appropriate control rows. Future work updates the control table per its README. Automatic route/import/test-file/catalog checks show structural evidence; they do not establish successful behavior, passing test execution or enabled server policy.

## Deliverables and scope

- Owner-facing Serbian matrix and report: `outputs/functional-audit-20260922/ANALIZA.html`.
- Structured owner matrix: `outputs/functional-audit-20260922/matrix.sr.json`.
- 48 analytical sections map all 48 tracked `src/app` route files, including layouts, redirects, panels and proposed capabilities. This is not 48 independently implemented screens or a disagreement with the draft's 45-screen count.
- Each section contains purpose, current implementation, gap, proposed placement, server dependency, and a three-part comparison with UX_NACRT: agreement, missing capability, and proposed deviation.
- Source baseline: `31598ac8b380d4a7029905b0143ed8ed35b7a42b`.
- Canonical DEV: `leqcwgzvjsxugfgzdmth`. Catalog and whitelisted policy reads only. No migration, production, personal-data mutation, test account, paid AI call or credential operation.
- Latest owner specifically requested reading and comparing `../v5-ai-first/UX_NACRT_20260922.md`. All 227 lines were read; SHA-256 `dc3a87b85f17e4906382e2f8a72db9f5dd621cd28f6e8632ff08d7b1020d98e5`. The source draft was not edited or staged.
- The prior broad deep-read audit was not repeated in full. Relevant route/controller/presentation bodies were read. Selected live contracts were compared with client callers; all endpoint execution paths were not exercised.
- Catalog discovery for reminder/repost/saved-search terms returned no matching function bodies/names. This is search evidence only, not proof that every equivalent mechanism is absent. Proposed reminder/subscription work must first inspect the existing event/dispatch machinery.

## Assessment

The app has substantial working implementation: task review/publication, protected mutation recovery, applications and selection, Agreement terms and changes, completion and reviews, worker availability including recurring rules/exceptions, private media, support, export and closure surfaces. Rebuilding these would discard useful behavior.

Functional completeness is limited by discoverability, data-contract gaps, read scalability, message freshness, device layout failures and operational readiness. A green suite is useful regression evidence, not proof that a person can complete every flow or that stores will approve the app.

Do not reuse the historical 61-findings percentage. This audit has a different scope and includes proposals, implementation gaps, verified defects and unverified release gates.

## Evidence-backed priorities

| ID | Finding and user impact | Evidence | Proposed treatment |
| --- | --- | --- | --- |
| F01 | Notification settings disable their own retry after an error. The person cannot recover in place. | `src/ui/notifications/PushPreferences.tsx:141`: locked = busy || error; the error recovery button at 146 uses locked. | Client fix, preserving write lock and existing recovery rules; prove error then successful read. |
| F02 | Map legend collapses into a narrow text column on the attached phone. | Device screenshot `audit-phone-map-ready.png`; `MarketplacePresentation.tsx` mapLegend row contains flex:1/minWidth:0 text and two trailing actions. Honor 361 logical px, font scale1.15. | Client layout fix first; full-width legend or separate actions; no tiny font workaround. |
| F03 | Notification timestamp uses font11, below owner minimum12. | `src/app/obavestenja.tsx:117`. | Client typography correction. Audit scaling/minimumFontScale separately; numeric source scan alone is insufficient. |
| F04 | Hidden nested tab routes can lose the primary selected-tab indication. | `src/app/(app)/_layout.tsx`: href:null routes are separate Tabs screens; primary FactArt state depends only on focused. | Preserve originating primary section. Decide focused full-screen bar exception with owner (D8). |
| F05 | Task/profile safety entrance is missing and cannot safely use profileId as accountId. | Live public profile lacks accountId; live submit/block accept target account UUID; context guard constrains allowed reports. | Small safe target/context contract before UI wiring. Include cross-world, restricted, blocked, wrong target and self cases in disposable proof. |
| F06 | Discovery reads up to25 pages of200 before local filtering and fails if more pages remain. | `src/data/supabaseIzvor.ts` / discovery reader and live `rpc_list_open_tasks_v3`. Profile hydration and extra reads add latency. | Server filtering/paging contract with parity; not a blind one-page swap. |
| F07 | Existing discovery filter support is partial. | Live whitelist: category, priceMode, urgentOnly, remote, startsFrom, startsTo; bbox supported. No text query/radius/sort/total. Fixed-time comparison omits flexible null dates. | Define time, area/remote semantics, sort, count consistency and remaining-slots filter before UI. |
| F08 | Paged own-needs reader lacks fields required by current cards. | Live `rpc_list_my_needs_page` does not return priceBasis or selectable-application count. | Extend reviewed projection with proof, then replace full-reader path. |
| F09 | HITNO functions exist but the policy is disabled. | Live policy enabled=false, allowedCategories=[], chargesFee=false; preview and activate bodies saved. | Owner decision about enabling policy/categories; UI preview only after eligibility/fee/expiry/recovery contract is respected. |
| F10 | Application submission has no separate final review; candidate cards omit message preview. | ApplicationSelectionPresentation and application route; candidate selection itself already has a review confirmation. | Add review without changing command identity, price arithmetic or validation. Named post-submit destination. |
| F11 | Missing rating is called 'Nov na USKOČI'. Missing reputation does not prove account age. | ApplicationSelectionPresentation lines181,193,218. | Distinguish unavailable from known zero reviews; preserve actual server facts. |
| F12 | Agreement workspace lacks source task/selected application IDs; current chronology contains only creation. | Live workspace body; agreementClientService:111. | Optional source projection extension; truthful stage display now. Do not invent arrival/ETA or events. |
| F13 | Agreement chat has explicit refresh, an unpaged ascending read, and an all-message ScrollView. | AgreementChat, Agreement route, supabaseIzvor.poruke. Local outgoing scroll following already exists. | Fresh incoming updates and paginated history under same authorization/outbox. Never replace protected engine with a vendor demo. |
| F14 | In-app event resolver is coarser than UX draft's desired destinations. | inboxClientService accepts AGREEMENT/APPLICATIONS/CANDIDATES/OWN_NEED/OPPORTUNITY. Current navigation does not directly select chat for MESSAGE_RECEIVED. | Per-event emitter/recipient/privacy/target/delivery proof. Do not infer target from free-form body. |
| F15 | Review implementation exists, including eligibility, immutable receipt, stars/tags and aggregate. Live copy still includes formal address. | Saved REVIEWS_LIVE.json; rpc_submit_agreement_review emits 'Dobili ste ocenu za završen Dogovor.' | Preserve review mechanism; proposed server copy adjustment separately approved. No claim that all prior text corrections are still complete. |
| F16 | Unconfirmed task-photo cancellation reaches a missing server RPC. This is not proof that normal upload or avatar handling is broken. | Task photos route cancel handler calls mediaClientService.cancelUploadCommand; fresh catalog count for public.rpc_cancel_media_upload=0. Avatar route uses read/apply/discard/clear instead. | Review existing PKG-008 candidate and prove delayed-send fencing/cancellation before separate approval. Preserve pending-command identity. Control N05's shared-module server alarm is indirect and documented as such. |

## Corrections to initial assumptions

1. Safety RPC availability does not mean a safe target is already available in every UI context.
2. `rpc_get_my_safety_report` is a receipt read, not investigation progress. Current uncertain-command recovery already uses a dedicated command reader. An unused RPC is not automatically a missing product feature.
3. Discovery does not silently truncate at5000: it throws when the bound is exceeded.
4. Availability, reviews, Agreement changes, export, Q&A and empty states already have significant UI/logic. Do not mark them all absent.
5. Remote geography intentionally carries no physical address/pin. It is not a fabricated location bug.
6. Private current location is a single authorized captured point, not continuous tracking.
7. The named-pending application reconciliation now exists in `moje-prijave.tsx`; do not repeat the old blocker without checking today's body.
8. Compatibility routes `prijave.tsx` and `pregled-nacrta.tsx` serve old entry points; they are not deletion candidates merely because a newer screen exists.
9. A support case decision is explicitly not automatic Agreement/task/price/rating modification. The actual dispute/moderation operational outcome needs separate verification.
10. One account still has two role-specific profile records. Shared identity/avatar/contact behavior requires deliberate authority, not silent mirroring.

## UX_NACRT comparison — deviations to disclose before implementation

| ID | Draft section | Proposed interpretation/deviation |
| --- | --- | --- |
| D1 | 4,7: confirm publication when fields are missing | Show missing data and a path to correction; mandatory data blocks publication. Confirmation must never override validation. |
| D2 | 8: always show last data offline; sends wait; no spinner | Reuse last data only under matching account/context/authorization and label freshness. Only existing eligible outbox paths may wait; never queue all business commands automatically. Short command/link verification can use an indicator; content loading uses a skeleton where meaningful. |
| D3 | 4,5: linear status sequences and automatic completion | Viewed/shortlisted are optional states. Closed search, filled task, cancelled task and completed work are different. Auto-completion depends on server deadline and eligibility; open problem/pending changes/restricted state cannot be ignored. |
| D4 | 9: server already has safety and urgent | Safety lacks a safe public target projection. Urgent is policy-disabled. Receipt is not moderation decision. Separate contract/policy work before active UI. |
| D5 | 9: task sharing is client only | Native sharing of sanitized text is client work. A useful public link also needs a configured safe web/deep-link destination and sign-in return behavior. |
| D6 | 9: paginated reads already exist | Existing page contracts lack display/search parity. Preserve priceBasis, selectable count, flexible time and remote behavior before replacing readers. |
| D7 | 7,10: people filter now, distance/sort later | Define needed vs unfilled slots; live RPC lacks that filter. Basic area and useful ordering are early in discovery; distance must not pretend precision from coarse pins. |
| D8 | 2,3,7: bottom navigation everywhere and panels | Propose full-screen for long edits/comparisons at large font, and focused editor without tab bar but with Back. Wherever bar is shown, originating section stays selected. Owner chooses if literal always-visible bar is desired. |
| D9 | 4–6: notifications and success copy | Treat24 rows as a proposed matrix, not verified delivery. Validate emitter, recipient, preferences, channel, target and privacy. Message snippet on locked screen needs deliberate privacy choice. Do not promise push while disabled. |
| D10 | 10: start directly with discovery | Prepend a small proven-defect/safety foundation package, then follow B, A, Agreement, Home/notifications and profile. Accessibility/useful motion accompany each screen, not only final polish. |

The Serbian matrix contains comparison for every analytical section, not only these shared deviations. No source-draft edits or UI decisions were applied silently.

## Full route coverage map

The owner matrix uses analytical IDs. All paths below are relative to `src/app/`; each tracked route is represented. Repeated IDs refer to shared presentations or subflows, not duplicated implementations.

A concurrent local-only route, `src/app/dizajn-pregled.tsx`, was also read in full. It renders six hard-coded TaskCard samples with inert open handlers and is excluded by `.git/info/exclude`; it is not a real user flow or evidence of real data. The current filesystem therefore contains 49 route files, of which 48 are tracked. Git exclusion protects a clean CI checkout, but does not itself prevent a local Expo bundle from including that route. Check local build inputs before any later local release. This file was not edited or staged. Concurrent commits 8adb5be0 and e20626cc added documentation/control files only; no tracked app source changed from the measured31598ac8 baseline at this check.

| Route | Matrix IDs |
| --- | --- |
| `_layout.tsx` | 48 |
| `(app)/_layout.tsx` | 48 |
| `(app)/bezbednost.tsx` | 24, 44 |
| `(app)/dogovori.tsx` | 20 |
| `(app)/fotografije-zadatka.tsx` | 32 |
| `(app)/index.tsx` | 04 |
| `(app)/mapa.tsx` | 08, 09 |
| `(app)/mesto-zadatka.tsx` | 31 |
| `(app)/moje-aktivnosti.tsx` | 05 |
| `(app)/moje-prijave.tsx` | 15 |
| `(app)/nova.tsx` | 29 |
| `(app)/oceni-dogovor.tsx` | 27 |
| `(app)/pitanja-zadatka.tsx` | 13 |
| `(app)/podrska/[id].tsx` | 45 |
| `(app)/podrska/index.tsx` | 45 |
| `(app)/podrska/novi.tsx` | 45 |
| `(app)/podrska/operator.tsx` | 46 |
| `(app)/potrebe.tsx` | 06 |
| `(app)/potrebe/[id]/kandidati.tsx` | 12, 17 |
| `(app)/potrebe/[id]/pregled.tsx` | 16, 18, 19 |
| `(app)/pregled-nacrta.tsx` | 30, 48 |
| `(app)/pregled-zadatka.tsx` | 30 |
| `(app)/prilike.tsx` | 07, 09, 10 |
| `(app)/prilike/[id].tsx` | 11, 12, 19 |
| `(app)/prilike/[id]/prijava.tsx` | 14 |
| `(app)/profil.tsx` | 33 |
| `(app)/profil/blokirani.tsx` | 44 |
| `(app)/profil/dostupnost.tsx` | 39 |
| `(app)/profil/fotografija.tsx` | 35 |
| `(app)/profil/izvoz.tsx` | 42 |
| `(app)/profil/lokacija.tsx` | 38 |
| `(app)/profil/o-aplikaciji.tsx` | 47 |
| `(app)/profil/obavestenja.tsx` | 10, 41 |
| `(app)/profil/podaci.tsx` | 34 |
| `(app)/profil/pravna.tsx` | 43 |
| `(app)/profil/privatnost.tsx` | 42, 43 |
| `(app)/profil/radnik.tsx` | 36 |
| `(app)/profil/razgovor.tsx` | 37 |
| `(app)/raspored.tsx` | 28 |
| `+native-intent.tsx` | 03, 48 |
| `auth.tsx` | 01, 02 |
| `dogovor/[id].tsx` | 21, 22, 24 |
| `dogovor/[id]/grupa.tsx` | 26 |
| `dogovor/[id]/izmene.tsx` | 23 |
| `dogovor/[id]/lokacija.tsx` | 25 |
| `obavestenja.tsx` | 40 |
| `oporavak.tsx` | 03 |
| `prijave.tsx` | 48 |

## Capability placement and release gates

- Core discovery/post/application/selection/Agreement/review paths belong in their existing context, not separate role-specific apps.
- Saved alerts, reposting, reminder scheduling and public sharing are explicit capability proposals with missing contract/infrastructure checks.
- Connecting-fee monetization is an owner requirement from earlier discussion, distinct from collecting/paying the job price. Define payer, moment, entitlement, amount, review, payment result, receipt/history/refund and store/provider compatibility in a separate decision. No presumed bank-payment exemption or token model.
- Legal acceptance, published operator contact, retention and data export/closure availability need real operator/legal input and end-to-end verification.
- Actual push delivery, revoked permissions, blocked pairs, quiet hours and cold-start destinations need two-device checks.
- Live arrival, full spoken AI dialogue, audio messages, reactions and individual public review history are later scope unless explicitly selected. Do not add them merely because competitors offer them.
- Test both account relationships, multi-person totals, simultaneous selections, stale proposals, expired tasks, problems, cancellations, changed terms and interrupted commands.
- Use existing allowed components/libraries first. New runtime packages, provider services or changed guard behavior are not authorized by an analysis approval.

## Proposed execution order

0. Owner reviews matrix and D1–D10. No new screen implementation until approval.
1. Correct verified client dead ends/readability/navigation and propose safety context contract.
2. Path B: discovery data-contract parity, map/list/filters, detail, submission review and named sent result.
3. Path A: AI creation/review/location/photos, own task, candidate message/context/comparison, preserving selection confirmation.
4. Agreement stages/source links, fresh/paged chat, changes/problem/completion/review.
5. Home attention priority and notification emitter/recipient/destination/delivery matrix.
6. Profile/interview/availability, privacy/export/legal/support presentation.
7. Separately approved extensions and release gates, connecting-fee flow, full Android/iOS acceptance.

Each screen: purpose, alternative composition evaluation, one implementation, all states, relevant tests/types, image, APK/phone and independent Claude review. New server package: candidate, disposable fail-before/pass-after proof, owner approval, apply/readback/receipt. Protected closure certificate changes still require explicit approval.

## Reference research

These are publicly documented primary sources, not a claim of logged-in end-to-end competitor testing or paid Mobbin access.

- [Wolt discovery/navigation](https://press.wolt.com/en-WW/259625-wolt-app-updated-a-new-way-to-discover-everything-around-you/): convenient search and less backtracking; adapt to three USKOCI primary areas.
- [Airbnb messaging](https://www.airbnb.co.uk/help/article/3558): unified messages for multiple account contexts, with quick filters; do not infer support for its advanced message features in USKOCI.
- [TaskRabbit hiring](https://support.taskrabbit.com/hc/en-us/articles/46260422073755-How-Do-I-Hire-a-Tasker): clear profile/terms/review before committing; retain USKOCI multi-person and immediate-selection model.
- [Airtasker task alerts](https://support.airtasker.com/hc/en-au/articles/360015124312-How-do-I-set-up-task-alerts): saved interests by keyword/location/mode, separate from general worker suitability.
- [Airtasker reporting](https://support.airtasker.com/hc/en-au/articles/6686450288281-How-can-I-report-an-inappropriate-task-or-comment): report in the context where content is encountered.
- [Uber sharing](https://www.uber.com/ca/en/ride/how-it-works/share-status/): contextual location/status sharing; USKOCI currently has a single-point contract.
- [Apple UGC](https://developer.apple.com/app-store/review/guidelines/#user-generated-content), [Google Play UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en): reporting/blocking/moderation/contact are product obligations. Exact placement proposed here is design judgment, not a quoted store layout mandate. This audit is not store approval.

## Verification record

The earlier owner-approved Gorhom work was committed at31598ac8. Its full type check and Jest242 suites/4691 tests passed (exit0; teardown-worker warning recorded in existing delivery notes). The audit itself changes documentation, not app code, so those tests were not rerun solely for prose edits.

APK run35731932400 succeeded. Artifact SHA-256, icon and recovery attestations matched31598ac8. `adb install -r` succeeded. Device inspection confirmed restored Home, real map rendering, filter sheet opening, and draft price count6→0. The map legend failed readability on that phone. Full dismissal/apply/reset/Back, selected pin→detail, keyboard and iOS checks remain pending; user was using another app at follow-up. Do not label the sheet or screen fully accepted. See DEVICE_CHECK.json.

Read-only policy/body capture files:
- SAFETY_URGENT_LIVE.json (5 public functions)
- DISCOVERY_LIVE.json (2 private +2 public functions)
- AGREEMENT_PROFILE_LIVE.json (3 public functions)
- REVIEWS_LIVE.json (3 public functions)
- URGENT_POLICY_LIVE.json (whitelisted policy facts)

The browser URL policy blocked opening the local HTML artifact. No alternate URL/surface workaround was attempted. The artifact is supplied as a file; structural/content validation is separate from visual browser verification.

Artifact verification passed: all48 tracked route files covered, all48 draft comparisons present, all15 captured function bodies match verified MD5, both linked device images exist, matrix links/columns and inline JavaScript syntax pass. Every control row maps to the analytical matrix; generated control JSON matches its HTML payload and its script syntax passes. The integrity check caught three inconsistent previously recorded MD5 metadata values. Those bodies were re-read using base64 and compared byte-for-byte: the bodies were unchanged; the metadata was corrected from fresh verified readback (CAPTURE_CORRECTION.json). No server function was changed.

Control table regenerated:62 rows,25 requiring attention,37 without a recorded problem but lacking whole-flow acceptance,0 fully accepted. This is not25 new bugs or37 proven working flows. Existing historical store/DEV claims remain dated, not independently re-certified. Corrected the obsolete free-first-release note to the owner's requirement for connecting-fee monetization before public release.

Publication: owner authorized the same Claude URL and completed sign-in. A parallel publisher subsequently added an owner-only JSON uploader and published the audit changes. Codex observed the online header5faff9c6 /2026-09-22T14:10:45Z,62 rows,25 attention,37 not accepted,0 complete, the corrected structural-evidence explanation and connecting-fee requirement. No new paid AI chat was started and Codex did not change sharing settings.

The owner's next instruction was to upload docs/control/stanje.json after each refresh. Inspection found that the generator omitted meta.osvezeno, which the new uploader uses to select newer data. The generator now retains the timestamp; generated JSON and the HTML-embedded data are equal. Fresh snapshot2026-09-22T14:13:13Z passed structural/parity checks. Upload through the supported browser filechooser API timed out after both click and Enter activation of the actual input#fajl. No unsupported API or native-control workaround was used. The online audit content is observed, but this latest JSON upload is NOT confirmed. See CONTROL_PUBLICATION.json for exact observed versus pending states.

Follow-up: the owner completed the file selection. The browser displayed the successful upload
acknowledgement for2026-09-22T14:13:13Z /5faff9c6. The preceding timeout remains historical;
CONTROL_PUBLICATION.json records the confirmed owner-assisted upload.

The foreign frozen-migration SQL remains untracked and untouched. Concurrent UX_NACRT creation is separate work; it was read, not edited or staged by this audit (Claude committed it during the audit). Current ledger/certificate/worker health was not re-certified by this UI audit. No full semantic-every-function or all-flows-pass claim.
