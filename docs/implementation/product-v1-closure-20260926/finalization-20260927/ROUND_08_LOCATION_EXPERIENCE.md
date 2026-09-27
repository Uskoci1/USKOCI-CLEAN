# Round 08 — from a spoken place to confirmed points and usable maps

2026-09-27. Client source package. Read `ROUND_08_CHECKS.json` for exact executed checks; native acceptance is still pending.

| Field | Decision and evidence |
| --- | --- |
| Problem | AI location confirmation hid earlier stops when advancing; detail mini-maps had no dedicated expanded view; granted private points showed raw coordinates and one selected marker instead of the whole task. |
| Cause | The inline editor rendered only the first unconfirmed slot. Detail screens reused an editing canvas as a read-only preview. Private presentation reduced the granted set to one point. |
| Product decision | A location belongs to a task and its actual topology. Each confirmed stop remains visible and can be explicitly corrected. A small map opens the same authorized points in a full-screen view and closes back to the same detail. |
| UX/UI | White map controls, existing brand and type, numbered USKOCI pins, orange selection; one active inline editor, clear confirmation state per stop. Full-screen view supports pan/zoom, stop selection, all-stop overview and explicit navigation. The existing TaskCard and DiscoveryPeek are unchanged. |
| Implementation | `ConversationPointAsk` adds a point selector and protects an unconfirmed edit when switching. `LocationOverviewMap` renders sanitized points and fits their bounds. `LocationMapPreview` owns each modal visit and external-link attempt. Task details use coarse previews; `AgreementPrivateLocation` uses only the already revealed, grant-bound exact set. |
| Backend/RPC | No new calls, schema writes or deploys. AI retains existing `rpc_get_need_location_review` / `rpc_save_need_location_review`, expected revision and `confirmed: true`. Private reveal and grant validation are unchanged. Public task projections still expose only one approximate point. |
| Files | `src/ui/location/ConversationPointAsk.tsx`, `LocationOverviewMap.tsx`, `.web.tsx`, `.types.ts`, `LocationMapPreview.tsx`, `locationMapLinks.ts`; `src/ui/AgreementPrivateLocation.tsx`; `src/app/(app)/prilike/[id].tsx`; `src/app/(app)/potrebe/[id]/pregled.tsx`; corresponding focused regressions. |
| Tests | Exact commands, initial failures, corrected reruns and hashes are in `ROUND_08_CHECKS.json`. Initial TypeScript caught two nonexistent radius tokens and one removed StyleSheet type member; corrected to existing system controls and explicit absolute edges. A legacy detail assertion was updated for the new read-only preview contract. |
| Review correction | An independent source review caught callbacks retained from a closed map modal. Each expansion now gets a new synchronous ownership token; old navigation, stop selection and close callbacks cannot affect a later visit. Regression includes close → reopen. |
| Device proof | NOT RUN. No APK, installation, native fit/gesture/screenshot, external Maps launch or voice/paid AI call in this round. Tests do not prove device rendering. |
| Regression boundary | Public coordinates round to two decimals before native geometry and external search. Exact navigation exists only in the private grant-bound view. Account revision, focus, background, grant refresh/expiry and route revision continue retiring private content. |
| Git | Recorded in the enclosing source commit and later control refresh; source hashes bind the check receipt without a self-referential commit ID. |
| Status | CLIENT IMPLEMENTED; executed verification is in the check receipt. Not full-app READY, not native accepted. |
| Next | One approved consolidated native pass: single place; start/end; multiple stops; correction; preview → expanded map → selected stop → external Maps → return; font scaling, Android Back and grant expiry. |

## Honest route and privacy boundaries

- The overview displays confirmed points; it does **not** invent a road route or duration. Actual routing is delegated only after the person's explicit external-map action.
- Public/owner detail data currently contains one coarse point, not a public ordered coordinate set. Public multi-stop overview remains a separate read-model proposal; private coordinates must never be substituted. Remote tasks stay without an invented pin.
- In an authorized Dogovor, the ordered set comes from `locationSlots(binding.geography)`, not the order in which the person confirmed points. Full-route handoff is available only when every required stop is confirmed.
- Universal Google Maps URLs need no new library/key and open the installed Maps app or browser. Three intermediate stops is the mobile-browser limit; tasks beyond that keep explicit navigation to each stop and never silently drop stops. Some Maps products may ignore waypoints, so the UI asks the person to check their order before departure. See [official Maps URL directions](https://developers.google.com/maps/documentation/urls/get-started#directions-action).
- URLs contain coordinates only: no account, task, grant ID, private address or access note. Approximate areas use search, not turn-by-turn navigation to a fictional exact address.
- Coincident points share a pin listing their stop numbers. Attribution remains visible and clickable. No dependency or provider configuration changed.

## Remaining work is explicit

This round improves the **location portion** of AI intake; it does not certify every AI extraction, multilingual ambiguity, paid provider response, voice input or full-route geocoding. It does not change the AI prompt. A full road route in-app needs an approved provider/contract; public route pins need an approved coarse server projection. Existing private grant semantics are retained, not expanded.
