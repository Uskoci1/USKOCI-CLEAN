# Native connected product surfaces — 2026-09-22

This implements the owner's request to transfer the connected design into the real app and use the USB phone for review. It extends Claude's V28/Inter/FactArt/TaskCard foundation without modifying those shared files. It does not certify the whole app as finished.

## Functional responsibility before composition

The prior three-composition exploration is recorded in DESIGN_V31_V28_EXECUTION_20260922.md and DESIGN_CONNECTED_TASK_FLOW_20260922.md. Functional data and guards were read independently of the old layout. This slice selects these compositions:

| Surface and responsibility | Alternatives considered | Selection and reason |
| --- | --- | --- |
| Task detail: decide whether to apply, or manage one's own task | Grid of facts; image-led hero; reading page with explicit facts | Reading page. Location/time/people/price precede full requirements, description, actual photos, approximate map, Q&A and publisher. Photos are optional, so absence must not create a broken hero. |
| Candidate list and offer: compare actual terms and make one deliberate selection | Dense table; large person/offer cards; step-by-step candidate carousel | Cards plus optional comparison. Larger faces, full names, total price, people and actual proposed time. Comparison becomes one column below 360dp or at fontScale >=1.3. It does not hide people behind swiping. |
| Agreement: understand accepted terms, action needed and private conversation | Chat-first page; dashboard of boxes; overview/chat with compact shared context | Overview/chat. Accepted Agreement terms remain authoritative. Open problems and required actions keep their existing logic. The full hero becomes a readable document; the chat header stays compact. |
| Discovery and own tasks: switch view, narrow results, return without losing context | Large segmented bands; tabs plus separate filter screen; compact underlined views with a filter sheet | Underlined views and a sheet. Owner sections can scroll at larger text sizes. Price and attention are draft choices until Apply. Cancel does not change the list. |
| AI and settings: enter information and retain a clear way back | Repeated cards; full-screen wizard per field; shared quiet frame | Shared branded frame. AI preserves transcript, owned draft, pending/error recovery and dictation. Settings keeps its existing form/controller logic. |

No global requester/worker switch was introduced. Početna / Mapa / Dogovori remain the three primary destinations. Both OBJAVI ZADATAK and USKOČI I ZARADI continue to use one account.

## Actual changes

- New pure presentation building blocks in src/ui/product/ProductDetails.tsx: real brand mark, 48dp back target, green title, colored fact illustrations, all requirements and a 72dp publisher identity.
- PublicNeedPresentation and NeedPresentation now share the reading order. Loading/stale/action gates, actual media authorization, location privacy, Q&A and owner controls remain in their existing callers.
- ApplicationSelectionPresentation uses 64dp candidate faces and an 80dp offer identity; actual proposed time appears in the list. Total/per-person validation and immutable uncertain-command recovery are unchanged.
- AgreementPresentation and src/app/dogovor/[id].tsx share the visual language and 64dp participant identities. All accepted terms/actions still come from the Agreement projection.
- Segmented has an opt-in underlined appearance; existing pill callers are unchanged.
- MarketplacePresentation fixes a real inconsistency: attention used to mutate the live filter immediately while price waited for Apply. Both now commit together; cancel/system back discard the draft.
- ScreenHeader, SettingsPresentation and AiConversationShell carry the real mark. AI opening targets are at least 48dp. Typing animations cancel on unmount/reduced-motion changes.
- App navigation uses the existing colored FactArt illustrations and honors system reduced motion on secondary transitions. Peer-tab switching stays instant.

## Research and reuse

These are source-backed capabilities, followed by our design judgment; they are not claims that another product's implementation has been copied.

| Source consulted | Relevant behavior | USKOČI choice |
| --- | --- | --- |
| [Apple sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | Scoped work while retaining the context underneath | Filters remain a temporary choice with Apply/Cancel. |
| [Airtasker assigning a Tasker](https://support.airtasker.com/hc/en-gb/articles/201581974-How-do-I-assign-a-Tasker-to-my-task) | Review offers before assigning | Put actual person, price, people and time before the selection confirmation. Do not copy its charging model. |
| [Airbnb Messages](https://www.airbnb.com/resources/hosting-homes/a/getting-the-most-out-of-the-messages-tab-678) | A unified communication surface with relevant filters | Keep one identity and context-specific views; do not introduce a role switch. |
| [Reanimated accessibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/) | System reduced-motion handling | Keep motion for continuity/feedback and stop decorative repeated motion when reduced. |

Already installed and reused: Reanimated4.5.1, Gesture Handler~2.32.0, expo-image~57.0.3, react-native-svg15.15.4, Phosphor and Expo controls. Inter and FactArt are the existing approved local foundation.

Candidate additions, not installed or purchased:
- [Galeria](https://github.com/nandorojo/galeria): native pinch/double-tap zoom, multi-image viewing and close gesture; MIT. Requires the New Architecture and iOS16.4+ in its current guidance. Check against our AuthorizedPhoto memory-only authorization, cachePolicy=none, account revision and focus cleanup before selection. A generic remote-URL viewer is not a drop-in security match.
- [Gorhom Bottom Sheet](https://gorhom.dev/react-native-bottom-sheet/): gesture-driven sheets, dynamic sizing and keyboard/scroll integration. Evaluate the exact version against our Reanimated4.5.1/RN0.86; the front page's compatibility text still names Reanimated1–3. Do not infer compatibility from a marketing demo.
- [React Native Chat](https://github.com/kesha-antonov/react-native-chat): MIT UI candidate, with keyboard-controller among its peers. The available feature list is not independent evidence of maturity in our app. An adapter must preserve clientMessageId/sender/body/photo reconciliation, unknown-send retry, account invalidation, read-only Agreement state and support evidence. Read/delivery ticks, replies and reactions need real server contracts before display.
- Rive/Lottie graphic assets remain selective additions after the concrete asset/license and runtime are chosen. No paid asset or service was purchased. No Stream migration, new chat service or dependency upgrade was made.

## Server contract evidence and remaining link

Read-only inspection of deployed public.rpc_get_agreement_workspace(uuid) produced body md5 06a6485e5bf6c12b6d4c22d1668ecf76. It scopes the caller and returns the accepted terms, participants and permitted actions. It does not return needId, selectedResponseId or the original accepted application snapshot. Therefore Agreement → original task/application cannot safely be manufactured from a title or local guess. It remains a small forward-only server candidate with disposable proof, separate from this visual slice.

Deployed public.rpc_home_attention() body md5 8a8feab5eb2ba727c637322b0ef044c1 retains four authoritative attention reasons. This slice does not replace the unified Home source or infer its counts.

No DEV mutation, JWT change, certificate move or paid AI call occurred.

## Verification

- Full Jest: exit0, 242 suites / 4,689 tests passed. Earlier failed runs exposed outdated Reanimated mocks and the old requirement-disclosure expectation; these were corrected without removing engine assertions.
- TypeScript: npx tsc --noEmit -p tsconfig.json passed. The final follow-up is recorded separately below when complete.
- After concise pluralized candidate copy: 38 focused application-selection and marketplace checks passed.
- Real components rendered through outputs/native-product-review-20260922, using explicitly labeled local fixtures and no account/backend/media/provider. Task and candidate layouts inspected at 390dp; comparison inspected at 320dp (single column) and 390dp (two columns). This is not native-device behavior proof.
- The isolated web harness initially selected native-only SafeArea imports. Its web resolver was corrected locally; production Metro config was not changed.
- Tracked SQL inventory remains147. The owner's excluded foreign SQL remains untracked and untouched; no source migration was added or rewritten.
- Phone found over USB (Honor VKP_NX9, rs.uskoci.dev versionCode35). Opened existing signed-in Home and captured the pre-update screen. At that point it was the previous APK; new source was not yet installed.
- New APK build/install and phone rendering: pending at this document's first commit. Add an exact source/artifact/device receipt after execution.

## Next connected slices

1. Build this source and verify on the actual phone: navigation, task details, candidate/offer screens where existing data permits, Agreement overview/chat and AI keyboard without sending.
2. Finish the full chat/gallery experience with a concrete package compatibility decision and preserved server contracts.
3. Implement the missing Agreement subject links through a proved additive server contract.
4. Continue AI review, worker interview/profile, account and remaining map/filter states using the same visual system.
5. Keep release, legal/charging decisions, push-device delivery and PKG-045b conditional rollout tracked in APP_FINISHING_PLAN_20260922.md. This visual change does not close them.
