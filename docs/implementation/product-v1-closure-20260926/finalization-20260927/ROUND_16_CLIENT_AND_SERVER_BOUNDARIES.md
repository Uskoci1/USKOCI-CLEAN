# Round 16 — retained chat intent and exact-public adapter

Date: 2026-09-27. Client source is based on `df29d078`. No DEV, Edge, certificate, dependency, payment or business-data mutation belongs to this round.

| Field | Evidence / decision |
| --- | --- |
| Problem / cause | A retained Agreement initialized its tab only on mount. A subsequent route request for `tab=poruke` could leave the person on Pregled. |
| Product / UX | A changed route request opens the requested tab once; the person's later Back or tab choice remains authoritative. |
| Implementation | Consume a changed requested tab without remounting the same account/Agreement owner. Keep reading-position, history and immutable outbox identity; no read acknowledgement follows merely from routing. |
| Files | `src/app/dogovor/[id].tsx`; `src/data/__tests__/agreement-screen-recovery.test.tsx`. |
| Regression | The added retained-route test failed first, then passed. It covers pending outbox identity, reading-position identity, absence of extra workspace/history reads or ACK, and manual Back through render/focus/background return. Both Agreement route suites: 131 tests PASS. |
| Limitation | Repeated identical tab parameters have no new identity. Exact notification-to-message landing still needs a separately reviewed event identity/resolver contract; this is not that contract. |
| Exact-public preparation | `ports.ts`, `supabaseIzvor.ts`, `lazniIzvor.ts` add `otvorenaPrilika(id,{signal?})`, returning an admitted public item with positive revision or an admitted empty result plus server time. Current runtime routes do **not** call it. |
| Validation / isolation | One exact-ID call, maximum one row, no `hasMore`, valid server timestamp/ID/revision and strict public projection. Abort/account-revision fences cover transport and optional enrichment. An old-server refusal stays an error; no private/collection fallback can masquerade as exact proof. The ordinary list preserves its existing output contract. |
| Tests | Exact adapter, ordinary list and cancellation: 3 suites / 70 tests PASS. Integrated `npx tsc --noEmit -p tsconfig.json`: PASS. A concurrent earlier type pass ran before the new port declaration was saved and failed on that incomplete interface; it is superseded by the settled-source pass, not hidden. `git diff --check` PASS. No full-suite run. |
| Backend / RPC | Exact P0 SQL candidate passed 9 groups on disposable run36330122549; bytes verified against the source-bound receipt. Explicit `primeni` requested and still pending. No live exact-mode call, apply or route activation. |
| Realtime | [Fresh catalog](ROUND_16_CHAT_REALTIME.md) proves no published tables or private broadcast policy. Raw-message publication would not inherit B3's session admission. A separate body-free invalidation/closure-integrated candidate is being prepared, not deployed. |
| Device proof | APK run36330066989 builds the previous consolidated client `dfe2836e`; it does not contain this retained-tab fix or unused adapter. Native review is separately bound to that APK and cannot certify this round. |
| Dashboard | Local generation succeeded. On 2026-09-27 at about15:45UTC the signed-in owner page still showed 2026-09-24 / b9aed185. The supported input/file-chooser operation again timed out; the visible version stayed unchanged. Upload remains pending, not published. Sharing settings were not changed. |
| Git / status | Committed/pushed by the root integrator after the checks above. Client source checked; P0 prepared but inactive; direct realtime and exact-message push remain open. |
| Next | Complete the current emulator checkpoint. Apply/activate P0 only after the owner approval and fresh predecessor checks. Continue the separate realtime candidate without moving the closure certificate under general approval. |
