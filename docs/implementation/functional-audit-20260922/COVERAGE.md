# Functional audit — working evidence ledger

Owner instruction, 2026-09-22: analyse the whole application's functional completeness, show a screen-by-screen matrix and proposed implementation order, then wait for approval before new screen implementation. This is not authorization for server, recovery, validation or dependency changes. The already approved bottom-sheet build/device verification may finish.

Source baseline: `31598ac8b380d4a7029905b0143ed8ed35b7a42b`. Canonical DEV: `leqcwgzvjsxugfgzdmth`. Read-only catalog inspection; no personal records, keys or provider calls. Earlier package reports are historical evidence, not fresh universal verification.

## Completed semantic reads

- Home/activities/discovery routes: index, moje-aktivnosti, prilike, mapa, potrebe and tab layout.
- Presentations: HomePresentation, ActivitiesPresentation, MarketplacePresentation, DiscoveryMap native/web, ProductSheet; marketplaceView and public task mapping.
- SafetyScreen, safetyClientService, bezbednost, profil/blokirani; PublicProfileSheet and publicProfileClientService.
- Live bodies: submit_safety_report/context_allowed, set_account_block, get_my_safety_report; urgent_activation_preview/decision/activate; list_my_needs_page and list_open_tasks_v3. Exact catalog responses are saved alongside this ledger.
- supabaseIzvor remainder read, including unpaged ascending Agreement messages and worker-profile mapping.
- Task/application/selection: public and owned task detail, composer, named pending application reconciliation, candidate list/full detail/comparison/confirmation, lifecycle actions, Q&A and their presentations.
- Agreement routes and presentations: overview/actions/problem, changes, current location, group, review, collection and weekly schedule; AgreementChat and current message reader.
- Creation: entire new-task controller, current publication review, legacy draft redirect, location editor (all geography modes), task photographs and availability editors.
- Profile: hub, personal data, worker editor and AI interview, area, availability, avatar, blocked users, privacy/export/legal/about, notification settings and PushPreferences.
- Auth/entry: auth phases, recovery, root/app layouts, native intent and compatibility redirect. Closure dialog reviewed without executing closure.
- Support routes and user/operator presentations: inbox, new case, detail, decisions and capability-gated operator view. Full operational moderation execution is not proven by reading those views.
- Live public profile/Agreement workspace/notification preferences and review/reputation bodies; policy fields show urgent activation disabled. Saved catalog files contain 15 functions total, not a full server recertification.
- Entire owner UX draft (227 lines), SHA-256 dc3a87b85f17e4906382e2f8a72db9f5dd621cd28f6e8632ff08d7b1020d98e5. Every owner matrix row compares agreement/missing/proposed difference; REPORT D1-D10 lists conflicts before implementation.

## Confirmed distinctions

1. Public task discovery walks 200-row pages, at most25, and throws if another page exists. It does not silently return a truncated5000 list. Query/price/area filtering happens afterward on the phone. Profile hydration is per distinct public profile, plus urgency/relations reads.
2. The live list RPC supports bbox and category/priceMode/urgentOnly/remote/startsFrom/startsTo. It does NOT support arbitrary search, distance radius, sorting or total count. Fixed startsFrom/To comparisons omit flexible null dates. Pagination must preserve these semantics.
3. Safety report submission and block commands require an account UUID; the public profile client exposes a profile UUID, not an account UUID. A safe target contract/resolver must be verified before adding entry points. Do not substitute these identifiers.
4. rpc_get_my_safety_report returns receipt, not investigation status. Existing UI uses rpc_read_my_safety_report_command for uncertain-outcome recovery, so an unused RPC is not automatically a missing feature.
5. The paged own-needs RPC lacks priceBasis and selectable-application count; replacing the full reader directly would regress price/count presentation.
6. Urgent activation is a previewed, revision-checked server command with policy/eligibility/expiry and possible chargesFee, not a visual switch.
7. Nested hidden tab routes can leave all primary tab illustrations gray. Verify retained origin and phone behavior before redesigning navigation.

## Completed analysis, remaining proof boundaries

The 48 owner-matrix sections cover all 48 tracked route files, including shared layouts and compatibility URLs; this is not a claim of 48 distinct screens all exercised live. The concurrent ignored dizajn-pregled.tsx was also read: six fixture cards, not a product flow. There are 49 local route files; REPORT documents the local-build inclusion risk. The matrix is at outputs/functional-audit-20260922/ANALIZA.html with structured matrix.sr.json. Sources are the official Wolt, Airbnb, Uber, TaskRabbit and Airtasker pages linked in REPORT.md.

Still unproved: exact emitter/recipient/transport/subdestination parity for all 24 events in UX_NACRT; reminder/subscription infrastructure equivalence; complete operational dispute resolution; real legal/export readiness; all iOS/Android permission, recovery, offline and two-person journeys. These are recorded approval-gated implementation/acceptance work, not silently marked complete.

## Verification boundary

Existing native-sheet implementation: types clean; Jest242 suites/4691 tests pass (exit0; teardown warning recorded elsewhere); APK run35731932400 succeeded and install-r succeeded. Device showed Home, loaded map, open filters and draft count6-to-0. Map legend fails at the real device/font size. Further device checks and independent Claude review remain pending (DEVICE_CHECK.json). These checks do not establish whole-app functional completeness. No new implementation starts until the owner reviews and approves the audit and disclosed UX draft deviations.
