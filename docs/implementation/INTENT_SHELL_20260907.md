# Intent shell / first UI reconstruction slice — 2026-09-07

The former five-tab shell opened a redundant Home, displayed Profile as a permanent tab, and exposed a placeholder discovery mode. The Profile screen showed invented identity/reputation and inactive actions. This slice installs the current owner's three-zone navigation and real own-profile reads while retaining the admitted marketplace services.

Authority: the current session explicitly adopts Execution Master V2 and both 06.09 UI documents, now preserved under `docs/governance/2026-09-07/`. The later V3 execution addendum was read in full and adopted during this slice without repeating admission or discarding in-flight work; V3 supersedes older execution method where different. The frozen 03.09 governing package retains its backend/owner authority (SHA-256 `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`); newer documents supersede its conflicting UI/navigation assumptions. Admission fetched canonical `7a94c19f8f79a97a91cec45f21c6e349345b122e`, inspected PR45/46/47 and successful current gates, and physically confirmed live project `leqcwgzvjsxugfgzdmth`. N07 promotion has separate provenance and does not depend on this UI change.

## Implemented boundary

- MENI TREBA: Zadaci / canonical U with Novi / Dogovori. JA MOGU: Prijave / canonical U with Zadaci / Dogovori. Compatibility `/` redirects to the appropriate existing root. All route URLs remain registered; hidden leaves cannot become extra tabs. Existing bottom safe-area clearance remains.
- Root lists expose the real Inbox bell and an avatar leading to the appropriate own-profile hub. Explicit mode switching opens requester tasks or worker discovery. Repeated navigation uses existing destinations; mode/profile actions acquire a synchronous guard before navigating.
- Profile reads only the authenticated account's matching REQUESTER or WORKER identity fields. Foreign/malformed scope is rejected; missing, loading and failure remain distinct. Real worker editing and local-device sign-out are available. Invented ratings and inactive profile/review/settings rows are removed.
- R03, W03, Dogovori and profile reads belong to a focused account, intent and request generation. Focus and foreground reread; late completion after blur/account change/intent change or a newer retry cannot publish. Errors clear current eligibility/identity and expose retry. The account-keyed root remounts private screen state when identity changes.
- W03 is a real discovery list. An actual source error no longer produces a false empty result. Kombinovano and the placeholder map control are absent. Whole cards open W04; empty results lead to the existing worker editor. Root empty states offer a next action.
- Proof assets use LF checkout bytes so Windows does not corrupt the existing exact candidate-versus-migration assertions. No SQL contents or applied migration bytes change.

## Verification and limits

Local TypeScript, migration integrity and 38 Jest suites / 232 tests passed. Existing navigation/safe-area assertions now test the newer three-zone authority; 24 added tests cover own-profile scoping and interaction, request ordering, focus invalidation and discovery failure/retry. These are source/component checks, not native navigation proof. Android run, exact source, artifacts and inspection results are recorded below when available.

This is a bounded shell and root-read slice, not closure of all 28 surfaces. It does not establish final task-centered multi-person Dogovor, hard calendar conflict authority, W02 AI profile, map/filter/viewport persistence, reviews, requester profile editing, account export/closure, native push delivery, media, publication-policy activation, iOS or Store readiness. W06's existing application mutation protocol and other detail/Chat lifecycle gaps remain separate work. Current platform charge remains 0 RSD; HITNO, D0140, public Q&A and unsupported controls remain gated.

## Physical proof

Pending the new disposable Android intent-shell journey. Prior accepted N04 and RU5 runs remain historical proof at their exact source boundaries; they do not prove this changed shell.
