# Discovery search and isolated review

Owner follow-up, 2026-09-22: continue implementation and checks while the owner cannot sign in
on the emulator. Do not wait for credentials or bypass application authentication. Keep the
actual-account/device acceptance gate separate from local presentation checks.

## Screen decision

The person should find a relevant task and narrow the displayed set without losing the current
map position or search. This is the discovery screen only; the existing owned-task sections stay.

Three compositions considered:

1. Search collapsed behind an icon: least chrome, but hides the first action and adds a tap.
2. Floating search/filters over the map: direct on the map, but overlaps content and differs from
   the list's controls, especially with a large keyboard or text.
3. Persistent search followed by a compact map/list switch and labelled filters: a little more
   height, but consistent in both views, discoverable and able to wrap on a narrow screen.

Choose 3. Use existing Inter, FactArt, tokens, TaskCard, Press and ProductSheet. No dependency.
The V28 discovery reference was visually inspected. Retain its clear search and labelled filter
control, with the existing brand/profile header and an explicit two-way view switch. Do not show
the prototype's unsupported sorting as if it worked.

## Implemented

- Discovery search is visible on entry without automatically raising the keyboard.
- Map/List uses the existing colored illustrations, distinct selected background and accessible
  selection. The existing view/viewport/query and filter application logic is unchanged.
- A selected price filter is named above the results and removable individually. Removing it
  preserves query, selected area, map position and view; selected task is cleared.
- The search clear target is 44dp. Tools wrap instead of shrinking labels.
- Empty/no-results/read-error states reuse existing artwork and actions. Map empty content gets
  the same horizontal room as the list. No invented offline cache or successful network result.
- Web review has selectable ready/loading/empty/no-results/error cases, explicitly labelled local
  examples with no account, backend, sending or paid AI. The public fixture no longer carries the
  owned-task discriminator, preventing the preview from drawing an owner's selection count.

## UX draft comparison

Matches sections 2, 5 and 7: visible search, distinguish view from filters, one explicit filter apply,
truthful count from the same displayed read, cancel without applying, recognizable empty states.
Preserves approved D2/D6/D7: no implicit offline sends, guessed geography, new matching or paged
reader substitution. F06/F07 remain open: server filtering/paging, time/remote/area/count parity,
sort and remaining-slots semantics still require the separately reviewed data-contract work.
This package does not add those controls, safety authority, HITNO activation or server endpoints.

## Verification

Focused presentation/view/owned-screen suites: 38 checks passed. Two added behavioral checks prove
that clearing the visible search preserves price/area and removing price preserves query/area/
viewport/mode without navigating. Existing cancellation, hardware Back, selected-pin, reduced
motion, real count and owned-section checks remain. After the final ARIA attributes and preview
fixture correction, TypeScript and all 242 suites / 4,700 tests passed. Results and source hashes
are recorded in DISCOVERY_SEARCH_RECEIPT.json. Existing Jest worker teardown warning remains.

Browser review uses the actual production component at 320 and 390px. Applied the offers filter
(two local tasks to one), removed it (one to two), searched for no matches, then cleared search
and recovered both cards. Checked selected/checked ARIA attributes, loading, empty and read-error
states. The fixed scenario error only checks rendering, not real network recovery. Screenshots
were inspected inline in the browser tool; no browser screenshot file is claimed.
This is not a native-map,
keyboard, TalkBack, account, server, push or whole-journey proof. The unmodified real application
stays at the welcome/auth entry in the emulator; no session or credential is copied or entered.

Device/independent Claude acceptance is pending. No server, guards, mutation recovery, runtime
dependencies or auth entry changed. Generated preview bundles do not enter src/app or the APK.

Both source-pinned discovery APKs succeeded and their hashes, attestations and ABI were verified.
The x86_64 build was installed with adb install -r and opened to the welcome/auth entry.
This proves installation/startup only; no account was entered. See the updated discovery receipt.

## Next contract preflight (analysis only, 2026-09-22)

Compared the full stored `rpc_list_open_tasks_v3` body in DISCOVERY_LIVE.json with
`supabaseIzvor.otvorenePrilike`, `marketplaceItems`, `publicPoint` and `publicBounds`.
This is a comparison with the audit snapshot, not a new read or change of canonical DEV.
Re-read and pin the live definition before any candidate or proof.

- The client currently walks all pages and then applies substring search over title, area and
  requirements. The stored server whitelist has no text query. Paging first and then running
  the same client search on one page would omit matching tasks on later pages.
- Current client area filtering tests the rounded public point against the requested bounds.
  The stored SQL uses a 0.01-degree margin in its numeric bounds predicates as well as its
  spatial prefilter. Pushing the same box is therefore not equivalent at the edges. Never
  upgrade pin precision to make this easier; keep the admitted public geography.
- Client bounds support a longitude wrap and equal edges. Stored SQL rejects west >= east,
  south >= north, latitude spans above 3 degrees and longitude spans above 5 degrees.
  A new reader needs explicit broad-map/wrapped-area behavior, not an automatic failing call.
- Bbox and remote-only cannot be combined. Model local-area tasks and remote tasks explicitly;
  a remote task has no map point. Do not silently discard remote results or invent a location.
- startsFrom/startsTo compare starts_at. Undated flexible schedules do not satisfy these
  comparisons. Preserve the agreed task timezone and define flexible-time filter semantics.
- Result order is published_at/id descending. The response has hasMore and asOf, but no
  total, arbitrary sort or snapshot cursor. Define a deterministic cursor per filter and
  reject stale-page responses after filter/account changes. Do not label page size as total.
- acceptsApplications reflects remaining slots and deadline; it does not itself remove those
  items in the stored SQL. Decide and prove available-results/count parity. Keep the independent
  application eligibility guard authoritative and retain task relationship/profile hydration.

First executable package should prove predicate parity, order, page boundaries, remote/flexible
time, empty/error and account/visibility isolation on a disposable database. Any added server
contract, index or grant is a separate reviewed candidate. No SQL or new client filtering contract
has been implemented here; the current bounded reader remains unchanged.
