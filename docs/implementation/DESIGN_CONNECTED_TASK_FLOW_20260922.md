# Connected task, application and Agreement design

Date: 2026-09-22. Scope: R5 design execution; independent local prototype and source-backed integration map.
Owner confirmed that Claude is concurrently implementing the V28/V31 appearance. This work does not
modify native source, tokens, fonts, database, dependencies, or the concurrent visual implementation.

## Owner correction

The previous proposal covered cards only. The owner needs a connected experience: list/map -> full
task -> application or candidate selection -> Agreement -> messages, retaining the clarity, colored
illustrations and inset navigation of V28. Photos appear when supplied. A task detail must expose all
relevant facts and conditions, not repeat a truncated card. The old native appearance is not the baseline.

The screenshot supplied on this turn provides direct visual evidence of the V28 list. Earlier analysis
of the reference HTML was static: the original page was not executed after the browser blocked it.

## Deliverable and limits

`outputs/design-v31-v28-20260922/TOK.html` is an independently authored, self-contained clickable study.
Run `python outputs/design-v31-v28-20260922/serve_flow.py` and visit
`http://127.0.0.1:8880/TOK.html`. Only that file is exposed. The original card proposal remains on 8879.

The study has no network connections. CSP blocks network/script dependencies; fixtures and local
messages remain in page memory. The two role controls are design-review viewpoints, not account
impersonation or a proposed runtime role switch. No success in this study is evidence of a server write.

Included: list/search, local filter, illustrated map composition, full task, public question context,
optional local photo gallery, application form/review, candidate comparison, selection review,
Agreement overview, accepted-offer context, messages and links back to the task. Supporting surfaces
show the intended destination and explicitly identify unimplemented behavior.

Not implemented here: geographic map rendering; backend integration; AI intake; payments; actual
notification delivery; private location or contact sharing; uploads; Agreement mutations/completion/
ratings; device install. Those existing native flows must not be replaced by the illustrative stubs.
The map is explicitly labeled as a composition diagram. The native map continues using its existing
renderer and source. Photos use local object URLs only if the reviewer selects files; no invented
job photo is displayed when the task has none. The gallery upload path has not been exercised on device.

The provided V28 vector illustrations are reused. Local Inter static fonts are read from the concurrent
work's existing `assets/fonts/inter` directory and embedded with their OFL text. No dependency is added.
If rebuilding without these files, the builder uses a system-font fallback. Static font weights are
declared separately. Motion uses CSS transitions and a short confirmation entrance, with a
prefers-reduced-motion fallback; no Lottie/Rive package has been installed or claimed.

## Functional responsibilities before composition

1. List/map: identify relevant tasks, distinguish one's own tasks/applications, expose actionable
   attention, and open the correct task without revealing a private location.
2. Task: explain work, scope, required people, pricing basis, time, location, photos, conditions,
   public questions and publisher; offer the correct next action for the caller's relation.
3. Application: express an offer with total price, covered people, proposed interval, message and
   captured self-declarations; review before submitting; reconcile unknown outcomes.
4. Candidate selection: compare offers with their actual scope, inspect evidence/profile, explicitly
   review the consequences, and form an Agreement only through the authoritative command.
5. Agreement: display the currently accepted version, people, next permitted action, private sharing
   consent and messages; retain access to the originating task and offer without rewriting history.

## Composition exploration and choice

| Surface | A | B | C | Recommended combination |
| --- | --- | --- | --- | --- |
| Task detail | Editorial title and fact grid, then requirements and description | Photo-led gallery, then title and facts | Compact title and grouped summary, then sections | A by default. B only when photos clarify the work. C for revisiting dense tasks. All three are selectable in TOK. |
| List/map | List with separate map view | Full map with selected task above navigation | Split map/list sheet | A plus B for the first native slice; evaluate C with gestures and keyboard on device. |
| Applications | One offer per card | Aligned comparison columns | Applicant detail first with next/previous navigation | A to scan, B as optional comparison, dedicated full offer before selection. |
| Agreement | Overview/Poruke, current terms in overview and compact context in messages | Chat-first with expandable accepted terms | Timeline-first with chat entry | A. Keep the current two-section functional convention because it separates work state from conversation clearly. |

Selection follows responsibility analysis, not retention of existing visual styling. Colored V28 facts,
clear white surfaces, green titles, warm occupancy and the illustrated inset navigation earned their
place for legibility and recognition. No visual choice authorizes a change to pricing or permissions.

## Verified native contracts and gaps

These conclusions come from the source bodies read this turn; they are not a new live-server audit.

| Path/body | What was read | Integration requirement |
| --- | --- | --- |
| `src/ui/v2/PublicNeedPresentation.tsx` | Full task facts, description, photo/QA/map slots, requester profile; footer branches for OWNER/APPLIED/UNKNOWN/NONE | Recompose presentation while preserving relation-specific action and unknown/retry state. |
| `src/app/(app)/prilike/[id].tsx` | Freshness, account/focus/request scoping, deadline and relation guards, scoped public profile/photos, approximate map | Keep existing readers and callbacks; the design layer must not create direct application writes or expose exact coordinates. |
| `src/ui/v2/NeedPresentation.tsx` | Own task details, draft readiness, selection counts, remaining search and lifecycle entry points | Preserve actionable selection count separately from historical application count, unknown separately from zero. |
| `src/app/(app)/potrebe/[id]/pregled.tsx` | Scoped owner reads and editor/publication/remaining-search commands | Preserve revision fences, command replay identity and readback before success. |
| `src/data/needDetailPresentation.ts` | Titles, exact/flexible schedules, TOTAL/PER_PERSON display and fixed application rules, geography and requirements | Reuse canonical formatters; do not copy the prototype's simplified price/date example into production. |
| `src/ui/v2/ApplicationSelectionPresentation.tsx` | Composer, comparison, full offer, review, confirmed and unknown outcomes, saved self-declarations, linked Agreement resolver | Restyle these existing states without removing confirmation or retry distinctions. Public profile updates must not rewrite application evidence. |
| `src/ui/v2/AgreementPresentation.tsx` | AgreementHero facts, compact context back to overview, participants, tabs and disclosures | Accepted terms already exist. Full-task/accepted-application links are additional work, not supplied by the current hero. |
| `src/app/dogovor/[id].tsx` | Overview/messages assembly, command permissions, pending/uncertain handling, problem receipt, location/contact consent, group/safety/history sections | Preserve radnje and freshness gates. No new appearance may infer completion/cancellation permission from a color or status label alone. |
| `src/contracts/projections.ts` -> `DogovorProjekcija` | Full projection type | No task ID, selected application ID or full immutable original-application snapshot currently appears in this projection. |
| `src/data/agreementClientService.ts` -> `mapAgreement`, `dogovor` | `rpc_get_agreement_workspace` mapping; price from terms; acceptedSchedule(terms), people and revision | The mapper currently carries no task/application navigation IDs. Do not match titles to recover a link. |

### Concrete connection work: Agreement -> full task / chosen application

The desired links in the prototype are **not yet implemented in native**. They require an authoritative
relationship, not a button pointing at a guessed ID. Next bounded engineering package:

1. Read the currently deployed workspace RPC body and contract. Determine whether task/application IDs
   and immutable selected-offer facts already exist in its response; source absence is not proof of
   server absence.
2. If present, add validated, nullable fields through the mapper/projection. If absent, prepare the
   smallest server candidate with disposable proof under the existing approval/certificate rules.
3. Choose task destination using confirmed caller relation; handle closed/inaccessible/deleted task
   without losing the accepted Agreement terms. Unknown relation must not enable a new application.
4. Show original application evidence separately from the current accepted Agreement revision. The
   task may change after selection; its current price/schedule cannot silently replace accepted terms.
5. Scope the read to account + Agreement + current request; discard late results on switching accounts
   or navigating away. Avoid list scans/title matches and do not expose other applications.
6. Prove foreign relationship rejection, unavailable old task/application, changed parent terms and
   correct second-candidate navigation. Then test the whole path on the compatible phone build.

The clickable study intentionally makes that product destination concrete before implementation.
It does not claim the missing native relationship is fixed.

## Preserve the attention hub

The owner previously required one home gathering published tasks and applications. The three-tab
navigation sketch cannot remove that responsibility. Before native navigation changes, explicitly
place the existing four authoritative attention reasons: requester completion waiting; active open
problem; caller application stale/server attention; own task with selectable applications. Preserve
their counts and destinations. The study's Istraži/Moji zadaci/Moje prijave is a navigation proposal,
not approval to drop composeHome/rpc_home_attention functionality or rename routes without checking.

## Parallel implementation boundary

Claude owns the live visual implementation (cards, typography, palette, FactArt and subsequent visual
slices). This turn only writes uniquely named design artifacts and this integration note. Do not
merge an illustrative HTML state machine into the native client. For each native slice, reuse real
readers/commands and check loading, empty, error, changed/stale and success/unknown separately.
No broad format, shared-token change or whole-repository commit is justified by this study.

## Verification performed

- Built the self-contained HTML and checked its embedded JavaScript with `node --check -`.
- Opened it with the Codex browser and visually inspected the task detail.
- Followed task -> application -> review -> local sent state. Entering `5.000` displayed `5.000 RSD`
  in review, with two people and the typed message preserved.
- Followed candidate comparison -> second offer (Ana, 6,500 RSD) -> selection review -> local success
  -> Agreement -> messages. Identity and accepted amount remained consistent.
- Sent a local example message and observed it in the local conversation; no read receipt fabricated.
- Checked all three detail compositions at 320/360/390/430 widths with base text increased to 20px;
  no horizontal overflow observed in the phone or content container. This is not a native dynamic-type
  or screen-reader certification.
- Recovery and other checks are recorded in the companion flow verification JSON after completion.

No full Jest/tsc run is claimed for this turn: no native application source was changed. No database
checks, DEV mutations, paid AI calls, dependency installation or phone tests occurred.
