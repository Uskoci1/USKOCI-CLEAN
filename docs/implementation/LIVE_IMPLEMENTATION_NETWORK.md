## 2026-09-10 — REUSE-first; location MERGED; shared capability validation in progress

Current observed canonical: bf6d1734710433b00f7d4e17f9cddccda740c8f4 after PR85.
Freshly read refs before continuing. Earlier pending cursors below are historical.
PR83 calendar and PR84 availability remain integrated. PR85 manual location reused
NEED_FACT_V2, human-confirmed facts, existing draft/edit authority, need_geography,
need_sensitive, app_profiles/preferences and serverReceipt; no second model.
Run34397439552 artifact10122216941 SHA256
4b525d205b43015f134f67f29dae99d67876a9c4c65aeb58232857e768d3be95 was inspected:
10 location +9 calendar +13 interval/scope +11 availability checks PASS.
PRE-P4, P2/P3, W01 web/Android and CodeQL passed at headff82226b. Its exact source
was reviewed; supplementary local TypeScript/94 location tests also passed.
Source integration does not attest final editor UI, GPS/geocoder/pin rendering,
precise routing or production activation.

Current unit: feat/w02-shared-capability-validation-20260910.
A concrete mismatch was found: Need V2 rejects blank resource-array entries,
while the existing profile guard accepted them and activation checked only count.
Extend the EXISTING guard_profile_write to invoke the EXISTING validate_need_v2_fact
for skills/tools/vehicles/licenses on changed inputs and DRAFT->ACTIVE.
No parallel capability catalog, vocabulary, table, activation RPC or matching engine.
Existing private.lower_arr stays the matching normalization owner. Do not invent
synonyms, licences, equipment or verification. No existing profile/Application/
Agreement snapshot is rewritten by the forward.
The existing workerProfileClientService is hardened, not replaced by another owner:
shared owned-result timeout/account fences, confirmed row identity, scoped writes,
single-flight, explicit unknown outcomes and known-only error messages. Its existing
manual screen remains the caller; no final visual or layout changes. Optional
self-declared licences use app_profiles.licenses and do not grant a trust badge.
The same bounded array parser serves the Need correction and profile paths.

Validation to date: TypeScript PASS; all85 suites/1192 tests PASS in three disjoint
Jest shards (29/347,28/369,28/476); all9 focused new negative cases failed on the
preceding client and passed after repair. Source migration integrity100/87/13 PASS.
Seven actual Auth/SDK/PostgREST/profile/matching checks are added to the existing
W02 workflow; their runtime result is still PENDING, not replaced by mocks.
Published Need resource fixtures are explicitly synthetic SQL. Profile capability
writes in that proof use the actual client or negative raw SDK attempts. No UI,
real AI, publication-policy, licence-verification or production journey is claimed.

REUSE ORDER: existing CLEAN -> adapt verified donor -> extend canonical owner ->
new only if necessary. Physical reuse review for this unit: existing Cloud Profile
foundation1.3b, RU1 readiness, NEED_FACT_V2 registry/validator, lower_arr matching,
CDL-A09 single writer, receipt and original W02 proof. Historical donor coverage
was read for lineage; its obsolete AUTO_FILL/reveal suggestions are not authority.
No donor source was copied into this unit. RC2 exists in Library and is owner-approved
for subsequent reconciliation; it has NOT yet been reconciled into live public text.

Latest 2026-09-10 owner-lock supersedes earlier owner-blocker notes: RC2 baseline,
Retention V1, OpenAI primary, Expo Push, MapLibre/OSM and free HITNO are approved.
Controlled live ordered-prefix promotion/activation is conditionally authorized,
not forbidden forever; it still requires exact current prefix, integrated proof,
no unknown drift, recovery/postflight and real deployment prerequisites. Public
launch still requires actual operator and contact facts. Positive fees/checkout OFF.
No live write in this unit. Fresh live read87 through20260907135905; guard prosrc MD5
e224209e831680e5b67fe3aa4ea2c7e9 matches the exact new forward predecessor.

Whole W02 remains OPEN. Regional country/area representation, remaining shared
semantics, precise-location matching/privacy-safe rendered pins and approved UI
binding still need actual closure; the capability-array fix does not stand for them.
Next: prove this exact current unit, review and integrate; finish W02 and existing
current debt/RC2 operational bindings per the latest owner-lock BEFORE W03.
Preserve .claude/, PRODUCT.md and final design-reference/composition/motion.

---

## 2026-09-09 — availability MERGED; manual location implementation in progress

The actual canonical is 5eb762695aef0059e57f3b189c0d6c425c7d3feb after PR84.
Calendar PR83 remains merged and unchanged. Do not use historical pending notes
below as rollback cursors. Latest owner command keeps full W02 OPEN until shared
semantics, manual/remote location, privacy and future UI acceptance are satisfied.

PR84 source 0a002547a9c88134b1b042d05316fd7a5e9c3ecb was proven at synthetic
merge c78c51c4ae4649685b687cde5717190d92538a41. Run34386790655 artifact10119323259
SHA256 312c05369e8ba7f4632fb7d59eb7de5e61dbb878236a40673dc95f771ba7aaf0:
11 availability + 9 calendar + 13 interval/scope checks PASS. Actual owned client
save/read, exceptions, both DST transitions, two observed competing saves and
third-account privacy passed. PRE-P4/P2/P3 and W01 Android/web recovery passed;
CodeQL reported no new alerts. Source integration is NOT production activation.

Current unit: feat/w02-location-shared-20260909, based on that actual merge.
It adds owned manual location review over existing ai_structured_facts, not a
second Need writer. Explicit user confirmation creates/supersedes the SAME V2
location facts. Existing reviewed draft/edit commands remain the only business
materializers. Public topology contains only coarse textual place refs; exact
address and access notes stay PRIVATE. Remote has no points/address/GPS. The
worker editor updates existing app_profiles city/radius and private coarse
worker_match_preferences, never creates precise profile-location storage.

No external geocoder/tiles choice is made. A provider-neutral boundary produces
only proposals and is PROVIDER_ACTIVATION_BLOCKED when no approved port exists.
Manual input needs neither that provider nor an OS location permission. New
forward20260909160000 preserves earlier SQL and tightens the shared V2 geography
validator for all producers. Owner revisions, identical replay, malformed fields,
private/public separation and stale account results are validated by the clients.
Local location client tests:94 PASS; TypeScript PASS. New runtime proof is PENDING.
It will exercise actual client -> facts -> reviewed draft -> projections with
normal Auth and three accounts; no location is populated by SQL. Non-location
AI proposals and public-status setup are explicit test fixtures, NOT real W03
model output or a user-facing publication/physical-device demonstration.

### W02 location input/storage/consumer map
| Input | Validation / confirmed command | Existing authoritative owner | Projection / consumer |
|---|---|---|---|
| Manual coarse Task place or REMOTE | normalizeTaskGeography; rpc_save_need_location_review | ai_structured_facts -> reviewed save -> need_geography.public_topology | Need city/area + public topology; matcher city fallback or REMOTE bypass |
| Exact address / access notes | private text limits; same confirmed location command | PRIVATE V2 facts -> need_sensitive | owner review and existing Agreement contact-grant path; never public topology |
| Worker city / radius | normalizeWorkerLocation; rpc_save_worker_location | app_profiles.city/radius_km | public city / private matching preferences |
| Optional approved coarse point | two-decimal bounded coordinates + explicit confirmation | worker_match_preferences.approximate_lat/lng | private proximity matcher; manual city edit can clear stale coordinates |
| Provider suggestion | locationResolver port; bounded sanitized response | none until human confirms | no GPS dependency, no auto-save, no default production provider |
| Weekly rules / exceptions / now intent | PR84 existing owned save and revision | existing rules/windows/profile/preferences | matching/dispatch, separate from Agreement occupancy |

Remaining shared categories/skills/tools/vehicles/licenses normalization is NOT
claimed complete by this location unit. W03 real provider/media/voice and W04
profile convergence remain next according to the ZIP prerequisites. Frozen
visual inputs (.claude/, PRODUCT.md, design-reference and final composition)
are unchanged. Latest live observation87 through20260907135905, calendar absent;
no live write, ALLOW/HITNO/verification/positive fee or provider activation.
New inventory99 =87 historical snapshot+12 pending. All forwards remain pending.

## 2026-09-09 W02 remainder — availability implementation, current proof pending

Current canonical was physically checked as b72f79f70eeac2677ebebb3e34a93ab7677c49a0.
PR83 IS MERGED. Its exact worker bookings, flexible nonblocking schedules, immutable
Application snapshots, lifecycle release and requester parallel engagements remain
intact. Older calendar-pending pointers below are historical, not a rollback cursor.
Existing continuation branch: feat/w02-availability-20260909. No canonical direct write.

Re-read W02 in the original 2026-09-08 Markdown and work-package JSON. ZIP SHA256
b3ea1efe19dac4d30287fb7d569e7d58b469c2d4b555a7561bad7f84ca1d2ff7 and all six manifest
entries match. Fresh live READ ONLY: 87 migrations through 20260907135905, calendar
absent. No live migration, provider activation or production write in this unit.

Availability now has one owned read/save command over the EXISTING rules/windows
and worker_match_preferences timezone, with content-revision conflict detection,
identical retry/no duplicate writes, finite times, weekday/date/zone validation,
private owner binding and bounded inputs. Authenticated raw child writes are retired
in favor of the owned editor; owner RLS reads remain. The old profile toggle remains
wired, with a new server trigger that makes its state persistent until OFF/safety.
No weekly calendar screen or final layout is introduced.

Matching/dispatch future scheduling consumes that stored authority, not the toggle
alone. OFF suppresses immediate opportunities, not eligible future work. ON overrides
the weekly baseline for an interval containing the current instant; no unapproved
minutes-to-start threshold or expiry is invented. Future flexible windows need some
available time, not an entire free day. Personal UNAVAILABLE and agreed hard bookings
remain stronger than ON. Weekly periods union across midnight/date boundaries and
are interpreted in the saved IANA zone; DST is tested. No automatic HITNO enrollment.

Written forwards: 20260909140000 and 20260909150000. All earlier SQL bytes unchanged.
Source inventory 98 / historical snapshot 87 / pending 11. Local TypeScript PASS,
82 suites / 1057 application tests PASS, including 73 new availability client cases.
These are SOURCE results, NOT yet current disposable/runtime acceptance. The existing
calendar workflow retains all original checks and adds real typed-client/Auth/RPC
save/read, replay/stale, three-account privacy, future/immediate matching, DST,
observed concurrent saves and unchanged hard-calendar assertions. Runtime pending.

Status: WRITTEN + LOCAL_TESTED; not MERGED, LIVE, new-editor UI_CONNECTED, runtime
PROVEN or production ACTIVATED. Existing legacy toggle only is already UI connected
in source; no production benefit is claimed until approved promotion and client use.
Entire W02 remains OPEN: shared semantic normalization and manual/location adapter
acceptance still need implementation/proof. W03/W04 remain next dependent work, not
silently marked complete. At most two unfinished units, no .claude/, PRODUCT.md,
design-reference or final visual changes. Continue at the exact current GitHub ref.

Next: run full-source disposable availability/calendar proof, review original report,
resolve real failures, integrate only with current gates. Then continue W02 shared/
location nonvisual boundaries, without recreating the calendar or changing canon.

### Bounded W02 authority map reviewed in canonical source

| Input | Validation / writer | Existing storage | Projection / consumer | Remaining boundary |
| --- | --- | --- | --- | --- |
| Task category/skills/tools/vehicles/licenses | NEED_FACT_V2 registry + human review + draft/edit RPC | needs.category/required_skills/required_tools/required_vehicles/required_licenses | public Task requirements; private.match_detail_without_calendar | Share normalized semantic vocabulary with Worker, no new registry invented here |
| Worker skills/tools/vehicles | current workerProfileClientService + profile guard | app_profiles.skills/tools/vehicles; licenses already part of schema | owned profile; private matcher | Manual/AI confirmed capability convergence is W04; current direct patch not assumed complete |
| Public Task place / remote | need_v2_location_ref_valid / task geography validation + Need V2 save | need_geography.public_topology; needs approximate fields/location mode | public topology read; matching coarse geography | Provider-neutral manual validator/adapter + privacy/no-GPS acceptance still open |
| Exact Task address/access | private NEED_FACT_V2 keys + canonical materializer | need_sensitive.exact_address/access_notes/exact coordinates | authorized Agreement operational read, not public topology | Confirm full manual save/read and third-account denial; do not copy exact place into public labels |
| Worker work area and radius | existing worker_match_preferences guard + profile owner | worker_match_preferences coarse point; app_profiles.radius_km | matcher radius/remote logic | Shared location editor boundary remains open; no production geocoder selected |
| Weekly / dated availability / timezone | rpc_save_worker_availability content revision + owner validation (new pending forward) | profile_availability_rules/windows; worker_match_preferences.timezone | rpc_get_worker_availability; schedule_fit + dispatch cheap and detailed consumers | Actual client/RPC proof pending; final editor UI deferred to approved design |
| Available now | existing profile toggle + persistent-state guard | app_profiles.available_now; retired expiry ignored | immediate dispatch intent; future schedules remain independent | Production activation NOT claimed |
| Confirmed occupancy | immutable accepted Agreement interval + existing lifecycle | private.worker_calendar_events | calendar client, matching conflict and selection/change protection | PR83 source MERGED, not live or final calendar UI |

Public/private location authorities are retained, not replaced. Location provider
activation is BLOCKED pending approval; no GPS or tiles dependency is added here.
This map records observed owners and explicit remaining work, not W02 closure.

## 2026-09-09 owner clarification — flexible calendar, worker-only conflicts

Latest explicit owner decision: only an agreed exact start/end occupies the
Uskočer. A day, week, flexible period, unknown time or unknown duration must not
reserve that whole period. The Naručilac may create/select simultaneous tasks
with different workers. Available-now is a matching/notification preference,
not a reservation and not automatic HITNO consent.

Fresh canonical is f8042c0478e5cff73255a7cdc2955829fbe5f844; PR83 remains the
existing work branch. Continue it, do not redo merged PR77/78/79/80/82.
Review found that discovery's calendar wrapper interpreted flexible Need bounds
as exact even though Selection already handled them correctly. The new forward
20260909130000_clean_w02_flexible_calendar_scope.sql fixes that input only.
Earlier SQL, Application snapshots, worker serialization and accepted-term
conflict guards are unchanged. No requester conflict gate is introduced.

Existing integrity proof now covers flexible day/week bounds, absent or partial
task times, retention in the actual Agreement-list client, later exact schedule
acceptance/conflict/release, explicit proposals on flexible tasks and a third
real Auth account proving simultaneous different workers for one requester.
All original lifecycle, privacy, completion and observed concurrency checks stay.
Local TypeScript and all 81 suites / 984 tests PASS. These additions still need
runtime CI proof and canonical integration; no new runtime PASS is asserted here.
Source inventory:96 SQL files,87 historical live snapshot,9 pending forwards.
Live read-only preflight:87 through20260907135905; private calendar absent.
No production mutation or activation, no visual/composition/design-reference
changes. Full W02 and the final calendar UI remain open; after proof/integration
continue the existing availability and other independent nonvisual work.

## 2026-09-09 W02 — exact interval and concurrency proof accepted

Application source cd30125426f35dbb287f8ed8f1094026022be917; tested synthetic
merge b9cadeb2f7e8f3e8cdb4e5d6a8bb3b4ecd321958. W02 run34319528297
passed all9 original calendar checks and all8 added integrity checks. Original
artifact10091435214 was independently downloaded and verified against SHA256
769c46c9ff752499ad353fa3ff913533dfdae21253af54c83408460ae2bb31c6.

Two concurrent authenticated selections were physically observed waiting;
exactly one conflicting booking succeeds. A stale REPEATABLE READ transaction
aborts with40001. Fixed-task and proposed intervals, unchanged Application
snapshots, accepted changes, cancellation, completion/reuse and the actual
TypeScript calendar client against disposable Auth/PostgREST are proven.
Fixture Needs are explicit test-only SQL, NOT a UI publication demonstration.

PRE-P4 run34319528259, P2 run34319528287, P3 run34319528291, CodeQL
no-new-alert check and Android/web recovery run34319528288 all passed.
Local source tests:81 suites/982 tests and TypeScript PASS. Source inventory95;
historical live snapshot87;8 pending forwards. No live mutation or activation.

This follow-up changes only these four continuation records. All application,
SQL, configuration, dependencies, proof harnesses, assets and design inputs are
byte-identical to cd301254. Root review accepts this bounded unit for canonical
integration; read current PR83/branch metadata for the actual merge outcome.
Full W02, calendar UI/physical handset, recurring availability/location, external
providers and production promotion are not claimed. Continue existing nonvisual
availability work without changing Claude's frozen design inputs.

Earlier pending-proof statements below remain dated historical checkpoints.

## 2026-09-09 W02 coordinating review — current canonical and forward repair

This checkpoint supersedes only older pending/current-cursor statements below;
retained historical proofs keep their original scope. Latest physical canonical
is f8042c0478e5cff73255a7cdc2955829fbe5f844. PR80 is merged at cc71a93;
PR79 is merged at 9614f55; PR77 is merged at be94ec6; PR82 is merged at f8042c0.
PR81 is superseded/closed. Do not redo those integrations or reset to earlier refs.

The existing W02 branch is now PR83. Its original b3445e1f source passed the
bounded calendar proof run34297635686 and fresh PR proof run34316154393.
Review identified limitations not covered by those passes: a null Application
schedule lost a fixed Need interval; a current Need could replace the displayed
agreed time; advisory locking alone did not protect stale higher-isolation writes.

The review adds forward 20260909120000_clean_w02_calendar_interval_integrity.sql
AFTER the unchanged original W02 forward. New selections freeze the exact reviewed
fixed Need interval only when no explicit proposal exists. Original Application
version/hash and old Agreement terms remain unchanged. Ambiguous old fixed-task
obligations block promotion for explicit reconciliation, rather than being inferred
from a mutable parent. A private per-worker MVCC fence serializes interval writes;
accepted finite times, completion/cancellation and actual proposed intervals are
checked. Existing source calendar and Agreement adapters now reject duplicate or
invalid times and use agreed terms, without changing screen composition.

Status at this checkpoint: WRITTEN / LOCAL_FOCUSED_TESTED / NOT_INTEGRATED /
NOT_APPLIED_LIVE. The expanded disposable proof must pass before merge.
Nine newly added client regressions were observed failing before their fixes;
all 63 focused read/error tests pass after those fixes. No runtime claim is inferred
from TypeScript or from the earlier narrower PASS.

Fresh live read-only check: 87 migrations, latest 20260907135905; calendar absent;
existing public availability rules/windows present; Edge uskoci-ai-interview v11
ACTIVE, verify_jwt=true. No live mutation. Source registry adds pending files only.
0 RSD, closed production ALLOW/HITNO/verification/paid activation remain unchanged.

Exact next action: execute/review current PR83 exact-source interval/concurrency,
completion, real-client and inherited proofs plus CI/security; integrate only if
all applicable gates pass. Then continue existing availability/other nonvisual
units. Calendar UI, requester agenda and full W02 location/capability/availability
closure are NOT claimed here. Claude design synthesis remains read-only; .claude/,
PRODUCT.md, design-reference material and final visual composition are untouched.

## W00/W01 functional continuation checkpoint

This is a dated checkpoint in the existing continuation records, not a new MASTER.
The owner froze new visual design/composition while Claude performs read-only synthesis.
Do not modify .claude/, PRODUCT.md, design-reference materials, styling or composition.

Source of scope: USKOCI_KOMPLETAN_PLAN_2026-09-08.zip, SHA256
b3ea1efe19dac4d30287fb7d569e7d58b469c2d4b555a7561bad7f84ca1d2ff7;
all six SHA256.json entries were verified. Original dependencies/canon remain authoritative.

Last observed canonical: b0f6851c1957cf27da8e135fdf05c0b55321f754 (PR78 merged).
Always read actual refs before continuing; do not restore this historical SHA.

W01 recovery application source: aee6d56f81b69a5474f7076640d0cd13bcf3e66b, PR80.
Exact tested merge: e069d0899b354124a8458b131076c50a58030e4d.
Run 34288483397 passed both actual Expo web and installed Android API34 emulator
recovery using real disposable GoTrue and SMTP mailbox; no mocked Auth responses.
Old password rejected, new password opens the same user, second account unchanged,
cold/warm native links, reused/expired links, explicit login return and nonpersisted
web credentials verified. All fifteen screenshots were visually reviewed.
Artifacts: native 10081018711, web 10080530999. Native ZIP SHA256
7c4c600ca369c0b62ec7c7bdf5310744ae7d2b20070207aae3eb8014bf7a4836;
web ZIP SHA256 98c1a18889c645c73ff823f7fd05485aa50b273d0c078ab917768ee1b56e1a92.
Local complete source regression: 77 suites / 816 tests; TypeScript passed.
PRE-P4 run34288483394 and P3 run34288483403 passed for the same PR head.

Since that proof, 22ba47adad13d6a55f7462514aa83bb20efc6ac0 changes only the
loopback browser proof server: static /auth and /oporavak mapping replaces
request-controlled filesystem probes reported by CodeQL. Application bytes
are unchanged; verify the current CI/security result before root integration.

Written: recovery + exact build identity. UI-connected: recovery/identity.
Proven: web and Android emulator recovery. Not claimed: physical handset,
external production SMTP, production recovery configuration/activation,
complete W00/W01 closure or full marketplace lifecycle. No live mutation.
The last live read-only observation remains 87 migrations through 20260907135905;
no source migration has been newly declared applied by this checkpoint.

Independent W11 continuation is the existing PR77 branch feat/p2-data-export-20260908.
Source 3cd547c8c1bf90fc107367186dde4255532a65ce hardens export-request receipts,
account revision guards and timeouts; 88 unit tests passed. db4e6d02c7e9d67ff6073bf98df6a413160e49bb
adds actual-client/PostgREST proof and exact P3-successor replay; inspect current CI.
It is intake/status/cancellation, NOT a generated export, UI delivery or live activation.

Exact next action: verify current PR80 refs, CI and review threads; root merge only
if all applicable gates pass. Then reconcile PR77 against the new canonical,
prove its actual client and complete source migration stack, update these same
records and integrate. Do not overwrite completed work or run blind db push.
Missing production approvals, positive charging, HITNO, verification and ALLOW
stay closed. Do not stop independent nonvisual implementation for design approval.

Older sections below remain historical evidence; they are not a rollback cursor.

Checkpoint recorded: 2026-09-08T23:27:57.178941+00:00

## Current entry acceptance — original Android sequence and 34 checkpoints reviewed

PR66 source `82a99fc115ff813327e9548c66fedd8413d29bff` is **IMPLEMENTED / SOURCE PROVEN / SCOPED ANDROID PROVEN / ROOT REVIEW ACCEPTED / CANONICAL PROMOTION PENDING**. Fresh canonical remains `80e091ee31930b28cc5c2e0af6b6e876a4926362` and is already integrated. Native run34163510260 passed; original artifact10033887904 is 5,847,655 bytes, SHA-256 `c82d1206009dd410c303b2a3517f6abbd68e4e07fbffc975bc62be8661de3386`. All 34 original PNG/XML pairs were individually reviewed: 7 entry, 17 account/navigation and 10 Inbox checkpoints. Both real local accounts, logout to the two-field login form, three-zone intents, full Agreement schedule/amount and current W04 Back pass.

Root reviewed all 70 original decoded video frames through the actual-PTS grid and full original frames 50/51/52/64. The beginning is now visible: bodies/handshake at 7.685922s, smile/pin at 8.124889s, blink/squash, shrink/reposition, ordered wordmark appearance and welcome at 11.764744s. No old blue Expo placeholder or competing Auth slide obscures the sequence. **Motion behavior is proven; capture timing/performance remain limited.** The unchanged source UI clock is 4500ms; this variable 4.69fps capture does not measure frame-perfect 4500ms or prove 60fps/physical-handset performance. Historical c1 run34160744232 remains partial for motion at its own boundary and is superseded only by this exact82 replay.

Exact-source PRE-P4 run34163513828 passes 64 suites/600 tests, TypeScript and 87 source/87 snapshot/0 pending integrity. CodeQL run34163510667 has three actual analyses (1737819620, 1737818245, 1737818206), all with zero results/errors/warnings. Root additionally observed the real local web DOM at exact82: reveal a dummy password, switch to Registration, and the remounted password controls are masked (`type=password`) and empty; no Auth submission occurred. This does not claim signup, recovery or email delivery.

The latest checked Figma file currently exposes only cover nodes 66:17/66:18; clarification of the owner's current design location is pending. The explicit user requirement to preserve the original supplied assets remains binding. Bundled original SVGs and 12 motion tracks retain their saved source provenance; this acceptance does not invent a replacement Figma authority or declare final visual/all-47 completion.

Public evidence is credential-redacted before any Git-directory write, with original PNG/XML/MP4/ZIP bytes retained. Raw logs remain outside Git; public logs are normalized/redacted copies with original SHA256 headers. The archive has 178 public files including its manifest, which contains 177 hashed entries; 422 source/build/config/plugins/vendor/test/SQL inputs are frozen for the documentation-only follow-up. Final candidate PRE-P4/CodeQL and Root merge remain required. A redundant docs-triggered native run may be canceled only after all 422 blobs and the entire added-material boundary are verified unchanged/non-product.

Scope remains synthetic local Auth and historical79+N02/N03 DB, not full87 live replay. Novi opens one owned local conversation without messages/provider/publication; the entry/navigation UI adds no Application/Selection mutation or push proof. The inherited disposable fixture setup does create a real Selection and Agreement. Registration stills cover the upper scroll viewport, recovery stays visibly gated, and one anonymous off-scroll Agreement XML container has known clipped bounds. Existing live87/Edge11, 0 RSD, closed gates and all earlier accepted units are preserved without new live reads or production changes. See [the exact82 evidence](<evidence/spoj-entry-20260907/run34163510260/native-review-summary.json>) and [the entry report](<SPOJ_ENTRY_IMPLEMENTATION_20260907.md>). Earlier checkpoints below retain their exact historical boundaries.

---

## Current entry replay — original Android journey passed; route motion repair pending proof

Canonical PR64 is merged at `80e091ee31930b28cc5c2e0af6b6e876a4926362` with exact canonical PRE-P4/CodeQL/CONTROL-0 PASS. It is integrated additively here; W04/W05 source is preserved. PR66 original source `c1b803285e2b5b97c57680ea09c9f17a6934d32d` has SUCCESS native run34160744232 and34 reviewed original PNG/XML checkpoints (7 entry +27 account/Inbox/navigation). Artifact10033052964 is5,932,807 bytes, SHA-256 `c0932b714237ae92d3ba78fd372d06ce13da5f571e32a7a5aa9b3a3c0b7ff602`. These static journeys are proven in their source scope; the full visible owner intro is not accepted.

Actual MP4 frames show the Auth route sliding over the owner sequence: frame55 at7.535878s is partial-width, frame56 at7.953489s first fully visible assembled mark, welcome at11.466433s. The old blue Expo splash is gone. The narrow repair disables the competing Stack transition only for Auth; all original SVGs and12 motion tracks retain their4500ms timeline. A separately reproduced revealed-password carry across Login/Signup is repaired by remounting that field per mode, preserving its value and masking it again. Its actual component regression fails before and passes after the change. Tab selected state already exists; an AX Value0 alone was not a source defect.

Integrated pre-repair source passes64 suites/599 tests; final focused4 suites/36 tests and TypeScript pass. The new source requires a fresh standalone Android replay, original motion inspection and exact-head CI/CodeQL before merge. No60fps, production/provider, full Auth/release or47-item closure is claimed. No SQL, secret or feature-gate change occurred. Prior checkpoints below retain their exact historical boundaries.

---

## SPOJ entry replay — original Android failure reviewed

Canonical `d4d8cd09bf44dd54c7355605b0c256813b46ab1b` is integrated with accepted D03/PR61 and Metro65 preserved. PR66 is **SOURCE PROVEN / ORIGINAL ANDROID PARTIAL / FRESH ANDROID AND CANONICAL PROMOTION PENDING**. Original source `95dd6f67e514140f6f631c4acdaae9d02db645b9`, run `34150271309`, failed on the obsolete post-logout welcome selector while the real direct login form was visible. The harness now requires exactly Email/Lozinka plus absence of private tabs and logs the second account in through that observed form. Busy Auth buttons retain their accessible title/state.

Original ENTRY stills and video were physically reviewed; the video showed Expo's old blue native splash covering an already-running owner animation. Approximately one hidden second is inferred, not instrumented. The repair uses a warm native background/transparent drawable and a paused first-frame scene, then layout → hide request completion → two frame callbacks → unchanged 4500ms clock. The 1s readiness failure skips animation and the 500ms storage bound remains. Full visible timing and the complete two-account journey need a new exact-source native artifact; no 60fps claim is inferred from mocks or sampled video.

Integrated 61 suites / 540 tests, TypeScript, 21 selector tests and AST 78/30/0 PASS. Source fingerprints are in `evidence/spoj-entry-20260907/replay-source/client-architecture.json`; existing workflow commit/APK/driver hashes provide the next native identity. Final CI/CodeQL and original-artifact review remain pending. Read `SPOJ_ENTRY_IMPLEMENTATION_20260907.md`. No SQL, Edge, provider, account, price or production mutation/new live observation occurs in this checkpoint. Earlier source/live proof boundaries and the separate remaining 47-item backlog are preserved below.

## SPOJ entry implementation — 2026-09-07

Owner-selected visual direction: Figma `DovAtPfVaLKL6xnXtQImbf`, splash15:487, welcome3:123, auth3:182. Original handshake U, outlined wordmark and all12 recorded4500ms motion tracks are retained. Light full-page Auth replaces the obscuring sheet. Implemented Auth methods are intersected with fresh public server settings; unsupported providers/recovery remain gated. Guest intent uses the existing account-owned return store through a client service, with5s cancellation/rollback. Form single-flight/account revision and intro storage/reduced-motion/lifetime cases are source-tested.

State: **IMPLEMENTED / LOCAL SOURCE PROVEN / WEB SIGNED-OUT SURFACES OBSERVED / ANDROID AND CANONICAL PENDING**. This does not close all47 backlog items, account registration delivery, recovery, all deep-link returns, native smoothness, shared maps or final release. Full physical Auth/account/Inbox/navigation proof is queued for the exact source; no production fixture, SQL, Edge, secret or pricing mutation. Fresh live read17:09UTC remains87 migrations/Edgev11/0RSD/HITNO-off/publication gated; older Edge checkpoints below are historical. See `SPOJ_ENTRY_IMPLEMENTATION_20260907.md`.


Metro recovery PR65 is now canonical7eacc627833187d58b1fef803e5c9f0c2cb05fbc; exact-source/canonical CI and CodeQL passed. This integration retains its Windows-only32-operation queue unchanged.

---

## Current W04/W05 acceptance — original43-pair Android proof; merge pending

PR64 source `3f73321927ff5a0d01eb4b884c347d73a30258a3` is **IMPLEMENTED / SOURCE PROVEN / SCOPED ANDROID PROVEN / ROOT REVIEW ACCEPTED / NOT YET CANONICAL**. Original run34159176253 passed; artifact10032628812 ZIP SHA-256 `cca131ad9a0dfb86e7a7f4be16232ab981b9caceb0f449fe1b0e58f909b13ab9` was independently downloaded and digest-verified. All43 original PNG/XML pairs are retained and reviewed:27 inherited account/Inbox/navigation plus16 W04/W05 recovery. The formerly failing retained-tab Back→re-entry→Retry opens the existing form without submission; five exact local REST restores and deadline-driven CTA closure pass with the original business/0RSD/gates checks.

The first screenshot named `W04_cold_read_error` shows cached re-entry after an earlier visit; this native evidence does not establish a fresh-process uncached failure. The database is the labelled historical79 plus N02/N03 environment, not full87 replay. APK hash is runner-reported; the APK binary was not independently downloaded. Final source gates passed57 suites/528 tests, TSC,45 Python,24 Node,87/87/0 integrity and three actual CodeQL analyses with0 results/errors. All382 non-document input blobs remain identical to tested3f73321 in this evidence-only follow-up. Final documentation-head CI/CodeQL and Root merge remain required; an automatically triggered duplicate native run can be identified by this unchanged input boundary.

Canonical base remains `d4d8cd09bf44dd54c7355605b0c256813b46ab1b` with accepted PR61 Chat/PR65 Metro preserved. No production, provider, migration, feature-gate or final visual change belongs to this unit. Current recorded live87/Edge11 and earlier provider proof limits are preserved. See [the W04/W05 report](W04_W05_RECOVERY_20260907.md) and retained original evidence. Previous pending/failed checkpoints below remain historical at their exact boundaries.

---

## Current W04/W05 source — retained-tab Retry repair; Android pending

Canonical `d4d8cd09bf44dd54c7355605b0c256813b46ab1b` is integrated, including accepted PR61 Chat and PR65 Windows Metro recovery. The actual run34150043928 again stopped on W05 Retry after Back and return to the same hidden tab: all27 inherited checkpoints and10 recovery checkpoints completed, while three actual source adapters with real disposable Auth/RLS passed. The original artifact10029703587 SHA-256 `5fb36d7888394ffeeae736ab669f0f13c7c08f3da3158aa307e551054778a4fb` was downloaded, digest-verified and its failure screen inspected. This is a failed native boundary, not full acceptance.

W05 remained mounted when blurred, retaining its Back action latch and old read error. The narrow fix binds reads/reset to screen focus and discards late blurred responses; submission payload/key/server engine remain unchanged. Two exact component reproductions fail against50d6714 and pass with the fix; final integrated57 suites/528 tests, TypeScript,45 Python,24 local-target Node,87/87/0 integrity and AST67/26/0 pass. The fixed APK's strict43-pair Android proof and exact-head CI/CodeQL remain pending. No SQL, Edge, provider, pricing or production mutation occurred. See [the W04/W05 report](W04_W05_RECOVERY_20260907.md) and its retained-tab evidence. Earlier checkpoints below remain historical.

---

## Current integration — W04/W05 recovery review, LIVE87 and Edge v11 configuration

Fresh canonical `7c83a1bf09faad1edb7fd0bc2e9199bee645dd41` includes PR49, PR55/56, PR57/58, PR62 and PR63. The existing W04/W05 recovery branch is integrated without conflicts; the four reviewed production files remain identical. At integration all16 unit blobs were preserved; a later narrow harness fix admits the actual `ghcr.io/supabase/postgrest:v16.1` namespace and rejects five spoof variants while retaining exact local targets/container/socket guards. W04 distinguishes failed/absent reads, keeps real Back/retry, marks a display-only stale cache and suppresses application entry when the public task gate/deadline is unavailable. W05 read recovery preserves the existing submission engine. This is **IMPLEMENTED / LOCAL SOURCE PROVEN / REVIEW PENDING**, not new canonical or Android proof. Full52 suites/452 tests, TypeScript,45 Python and22 local-target Node tests pass; AST64 client/25 presentation files has0 findings. The dedicated native harness retains27 original checkpoints plus16 recovery checkpoints; physical execution/inspection and exact-head CI/CodeQL remain required. UI remains a testable scaffold; final Figma design and Fable asset work remain separate.

Recorded current production is **LIVE87 / Edge v11 ACTIVE / JWT true**, from the root's supplied14:44 observation. Historical14:26 Edge v8 promotion retains its exact source/proof and then-unchanged secrets; later owner setup at14:38–14:42 changes configuration, not the26,775-byte handler/4,097-byte registry or EZBR. Names-only metadata observed all three required provider entries at14:41:53; model/selector values are owner-confirmed manual saves, not independently read back. Actual provider success is **NOT PROVEN**. This W04 integration records supplied observations only and makes no live call. Source87/live87/pending0, existing price modes,0 RSD and all closed SQL/proof boundaries remain preserved. Do not reapply migrations or relabel earlier Android/provider evidence. Review `docs/implementation/W04_W05_RECOVERY_20260907.md` and its committed evidence; earlier pointers below remain historical at their own boundaries.
## Current composition — canonical Metro65 with accepted D03 native source

Canonical `7eacc627833187d58b1fef803e5c9f0c2cb05fbc` is integrated additively. All application, SQL/Edge, dependencies, fixtures and native harness blobs remain identical to accepted Android6ef2c65. Of366 recorded non-document inputs,365 remain identical; only PRE-P4 changes, with the canonical Metro configuration and its test newly added. This is not whole-build byte identity. The canonical configuration returns Expo's unmodified default on Linux and wraps cache operations only on Windows. All7 actual Metro tests and serial TSC pass. The coordinating reviewer accepts this bounded composition with the already-reviewed38-pair native proof; final combined CI/CodeQL remain mandatory. A parallel local TSC run exhausted host memory and one Firebase test child exited134; that local run is not reported as a full PASS. See `canonical65-composition.json` beside the D03 evidence for exact blobs and limits. No production or owner process was changed.

## D03 mobile acceptance — original Android evidence reviewed

PR61 source `6ef2c654713c5acf4d3fdd29d3f539da79256ace` has accepted native run34146855714: all38 original PNG/XML pairs reviewed (27 inherited +11 Chat), two real participants, visible composer above the observed IME, two rapid taps yielding one message/event, actual guarded REST outage, native-observed stable-key manual retry, three unique messages/events, terminal read-only and Back. Exact-head54 suites/469 tests, TSC,57 Python,48 admission/guard tests,87/87/0 integrity and three actual CodeQL analyses with zero results PASS. This record accompanies PR61 canonical promotion; no production or final visual promotion occurs. All366 frozen native inputs remain unchanged in the documentation follow-up. See the D03 Chat report and original evidence manifest. Earlier failures below retain their exact boundaries. Realtime, pagination, attachments/groups, never-submitted draft durability and final user-owned design remain separate.

## Current D03 replay checkpoint — harness recorder repair

Fresh GitHub at 17:05 UTC still has canonical `7c83a1bf09faad1edb7fd0bc2e9199bee645dd41`. Native run34136396782 at `6cd0c6b4147e3399763187374d201ad311fa9f53` failed in Python before sending: the keyboard check called undefined `check`. Its original PNG and parsed WindowManager geometry show composer/send above IME; the aggregate report remains FAIL. This repair calls the existing `checkpoint` recorder and adds three actual-function regressions. All57 Python and48 source-admission/local-target tests plus87/87/0 integrity PASS; application, server, dependency and build source remain identical6cd0c6b. A fresh27+11 native replay and original-artifact review are still required. No live observation/write or final visual acceptance is added. See the current D03 Chat report for exact evidence and limits; older checkpoints below retain their own boundaries.

## Current D03 mobile checkpoint — observed native limits

Fresh canonical is `7c83a1bf09faad1edb7fd0bc2e9199bee645dd41` including the recorded AI live87 / Edge7 promotion and the server provider-selector source. This branch preserves that incoming SQL, provenance and server source; no new production/provider action occurs here. Recorded source/live migration inventory is87/87, pending0.

Original native run34132073163 at`e0682e050f3ac21b43e9a572a028168ca611cf41` passed27 inherited Inbox/navigation checkpoints, exact N07/N08/D03 local admission, and the first5 D03 screenshot/XML checkpoints. Two taps36ms apart persisted one message/event, and both real participants read counterpart messages. Its original artifact10023469575 ZIP SHA256 is `05d8e9a1a15a90a42075cbb4de98392b260cb4a7163d0e4cac1a5c4eb3d0ecd9`. The run then failed before stopping REST because the local identity allowlist omitted the observed `ghcr.io/supabase/postgrest:v16.1` namespace. Offline retry and terminal Back remain unproven in that run. Visual review also found the composer hidden behind the open keyboard: IME visibility was true but its upper boundary was unknown, so the former screen-only check was insufficient.

Current status is **D03 MOBILE SOURCE IMPLEMENTED / TWO-PARTY SEND-READ PARTIALLY PROVEN / KEYBOARD AND OUTAGE REPAIR SOURCE TESTED, NATIVE REPLAY PENDING / NOT CANONICAL**. The accepted backend D03 proof/live boundary remains separate. A fresh APK must prove the corrected keyboard boundary, actual outage/retry and terminal behavior. See [the Chat report](D03_CHAT_RECOVERY_20260907.md). Earlier checkpoints below remain historical and are superseded only by the explicit observations above.


The narrow source repair moves the single keyboard-avoiding view to the full-screen SafeArea boundary, enabled only for Poruke. The harness now requires actual visible WindowManager IME geometry and rejects unknown/conflicting/occluding bounds. Only the exact GHCR Supabase namespace was added to the existing Docker identity allowlist. Full54 suites/469 tests, TypeScript,54 Python harness tests,48 source-admission/local-target tests, integrity87/87/0 and AST67/26/0 pass on the integrated working tree. These are source tests; the changed UI requires a fresh standalone APK and physical replay.

---

### Retained historical D03 source checkpoint

## Current D03 mobile integration — canonical AI authority and Edge source

Fresh canonical is `6701311d89047c0a1058332362887fb7b396df5a`, including accepted PR57 AI DRAFT authority and PR58 Edge context source. This Chat branch preserves canonical SQL, Edge and their proof inputs, plus the existing reviewed D03 app and native journey. The only new harness behavior is exact N07 source admission: the five forward files retain their approved two-line provenance header plus the unchanged candidate; N08/D03 remain direct byte mirrors. All MD5/SHA and provenance bindings are checked before disposable setup and APK build.

Original native run34128121944 at9d5962f passed the10 Inbox and17 navigation checkpoints and their business postflight, then stopped before D03 setup because the old admission check compared N02's2287-byte forward file with its2137-byte raw candidate. Original artifact10021851979 ZIP SHA-256 `799054c27299fc2a23e8470cac5b801378ea16f1196dfb6c92137fd0bf4fa10d` was downloaded and verified. No D03 screenshot or Chat proof passed in that run. The reviewed fixa792a46 has29 source admission tests plus19 local guard tests and3 existing canonical admission tests passing. Final integrated validation passes54 suites/467 tests, TypeScript, integrity87/recorded86/pending1,44 Python harness tests and AST67/26/0. Exact-source native replay remains pending.

Current status is **D03 MOBILE SOURCE IMPLEMENTED / PRIOR27 NATIVE CHECKPOINTS PROVEN AT9D5962F / D03 NATIVE REPLAY PENDING / NOT CANONICAL**. The existing backend D03 proof/live boundary remains accepted. Source inventory is87 / recorded live86 / pending1; this preserves incoming provenance and is not a new live observation. Root owns the separate completed AI promotion/provenance and any Edge deployment; this branch performs no production/provider action. See [the current Chat report](D03_CHAT_RECOVERY_20260907.md). UI remains a testable scaffold for later Figma/Fable work. Earlier checkpoints below retain their own source/evidence boundaries where superseded here.

## Source unit — Windows Metro cache recovery pending review

Canonical base `7c83a1bf09faad1edb7fd0bc2e9199bee645dd41` is preserved. Windows Metro delegates cache get/set through one queue of at most 32 operations; application/domain behavior and Linux/macOS defaults remain unchanged. Local evidence: seven focused tests including installed Expo disk values and controlled EMFILE comparison; 49 suites / 395 tests, TSC, integrity 87/87/0 and AST 64/25/0 PASS. Cold/warm server-module transformation succeeded without EMFILE; static export remained blocked by deliberately absent public backend configuration.

This node is **SOURCE IMPLEMENTED / LOCAL SOURCE AND DISK PROVEN / PR REVIEW PENDING**, not native/browser/provider or production proof. No live state was inspected or changed. Preserve existing engine/proof boundaries and follow [the unit report](WINDOWS_METRO_CACHE_RECOVERY_20260907.md) through CI/CodeQL and review. Historical live checkpoints below are not refreshed by this tooling unit.

---

## Current checkpoint — AI authority LIVE87 and Edge context v7

Canonical `6701311d89047c0a1058332362887fb7b396df5a` includes PR57 `c4c6b624446f3273a40e8393bfadc8c49dff5494` and PR58. AI review/save authority is **IMPLEMENTED / AUTHENTICATED DISPOSABLE PROVEN / CANONICAL / LIVE STRUCTURAL PROVEN**. Actual86→87 proof34128347708 and final canonical gates preceded exact live alias `20260907135905_clean_ai_need_draft_safety_authority`. All21141 source bytes match the live statement; all86 complete prior history records,127 other function bodies,129 function metadata/ACLs and12 table catalogs remain unchanged. The same47 policies/53 RLS settings and72 advisor entries remain; immediate before/after business counts and0 RSD/gates are unchanged. Source87/live87/pending0; do not reapply closed SQL.

PR58 final handler proof34129593102 has17 actual-handler mocked-transport tests, Deno/TSC and49 suites395 tests PASS. Its canonical gates preceded existing Edge v6→v7 promotion: exact26346-byte handler and4097-byte registry verified after deployment; ACTIVE/JWT true. This is **SOURCE PROVEN / CANONICAL / LIVE SOURCE VERIFIED**, not a successful provider interview. Normal owner login and empty Novi are now observed; the owner-reported unknown AI turn and actual owner human-review/DRAFT/card remain unresolved. No synthetic production fixture or provider success is asserted. Provider secrets are server-only; current UI remains a testable scaffold, with later Figma/Fable work separate.

Completed source/proof/live records: [AI live promotion](AI_LIVE87_EDGE7_PROMOTION_20260907.md). Earlier pending/deployment/current-head checkpoints below are historical where superseded here. Continue current mobile/provider execution without restarting the engine.

---

## Current integration — fresh LIVE86 provenance plus AI Edge context

Fresh fetched canonical is `c4c6b624446f3273a40e8393bfadc8c49dff5494`, preserving accepted Auth/navigation, configured application identity, D03 canonical/live86 provenance and the canonical AI DRAFT authority source unchanged. This branch changes only the existing AI Edge time reference, newest history window and sanitized failure logging, with actual-handler source proof: **SOURCE IMPLEMENTED / CI MOCKED TRANSPORT PROVEN AT B9376F1 / FINAL CANONICAL INTEGRATION PENDING / NOT DEPLOYED / ACTUAL PROVIDER NOT PROVEN**.

The frozen Edge is26,346 bytes / SHA-256 `4861e371c2da01122f013516826008e15a9c9a752f52188523510ff9b7da9704`; the shared fact registry is unchanged. Integrated run34128479788 atb9376f1 passed Deno, TypeScript,17 actual-handler checks and49 suites/395 tests, with three actual zero-result CodeQL analyses. Original artifact10021094289 ZIP SHA-256 `d3eb59dcbec33aa010feb12b685f29f73cd2f3ff3e761bec682578bccf745afa` was physically verified. Earlier committed evidence and precise limits remain in [the unit report](AI_EDGE_SERVER_CONTEXT_20260907.md). The final integrated source run after canonical PR57 and its gates will be recorded after execution. This unit uses synthetic fetch/environment only; no provider call, database write, deployment or gate activation is part of source proof.

Source87 / recorded live86 / pending1 are retained from canonical provenance; this branch adds no SQL migration. Root accepted PR57's unchanged AI SQL atf5b9550 with actual86→87 proof34128347708; its separate live promotion remains root-owned. Follow user-adopted V3 and06.09 guidance. Root reviews final source/proof/gates, then fresh live v6 source/config before any existing Edge promotion. Actual owner intake, human confirmation/correction and truthful DRAFT card remain a separate functional boundary. Production is not a synthetic fixture sandbox. Current UI is a testable scaffold; final Figma design and Fable remain separate. Underlying checkpoints retain their historical boundaries where superseded here.

---

## Current integration — fresh LIVE86 provenance plus AI DRAFT authority proof

Fresh fetched canonical is `f055d6415b5153aa6ef0db735d63dddea7806ead`. Auth/navigation, configured application identity and the existing D03 command source/live alias are canonical at their accepted proof boundaries. This branch adds only the two-RPC AI DRAFT authority repair and its proof integration: **SOURCE IMPLEMENTED / AUTHENTICATED DISPOSABLE PROVEN AT17659 / FINAL D03 INTEGRATION REPLAY PENDING / NOT LIVE**. Exact AI SQL remains21,141 bytes / SHA-256 `ee0077ae883328f865a73eed0ebab9434a8c2e47add750b055de45950e5a77d1`.

Original run34121379016 at17659 passed15 AI checks plus6 N07/12 N08,37 suites/232 tests and four physically observed lock interleavings; the inspected original artifact and zero-result CodeQL analyses are linked in [the unit report](AI_DRAFT_AUTHORITY_20260907.md). The new source-derived predecessor step admits only exact canonical D03, preserves all original full history records and rejects unknown/missing/changed files. Its final integrated runtime result remains pending.

Inventory at this source checkpoint: **87 source / recorded live86 / pending1**. This is source/provenance reconciliation, not a new production observation. The D03 live86 reconciliation is preserved unchanged; AI remains unpromoted. Provider execution, Edge context deployment, native AI review/card flow and policy activation are separate proof boundaries. Current UI is a testable scaffold; final Figma design and Fable remain separate. Continue V3/06.09 guidance and do not restart closed engine or native Auth work. All underlying checkpoints retain their historical boundaries where superseded here.

---

## Current integration — D03 canonical and LIVE86

Fresh canonical is `4ff2dc0f4862cccb2a432851657b68929b8bdc35`, including PR56 merged at13:17:59 UTC. D03 source was promoted by PR55 as `a0dfc9f7bec6d1d6cc0c7f71b71ded23e38a114a` at12:58:53 UTC after exact-head proof34124166375. D03 stable message retry is **IMPLEMENTED / AUTHENTICATED DISPOSABLE PROVEN / CANONICAL / LIVE STRUCTURAL PROVEN**. The completed exact forward promotion is live as **86 migrations / `20260907130151_clean_d03_message_retry`**; source86 / live86 / pending0. Do not reapply or rename the source SQL.

All4277 source bytes match the single live statement (MD5 `ea4ebf5cc6f24f103bdb9c854f55463d`, SHA-256 `f7768b8feaefa54090bfdc66a7183089dd72fda21995dcc2beeb0dd6d6494889`). Postflight13:02:34Z retained all85 complete historical records, original2 message rows, existing RLS/table grants/N01/emitter and0 keyed messages. The new RPC is authenticated-only with its reviewed body and fixed search path. Final disposable proof passed11 D03,6 N07 and12 N08 checks; canonical PRE-P4 passed47 suites/347 tests and TSC, and canonical CodeQL/CONTROL-0 passed with3 actual zero-result/error analyses. Final aggregate gates at13:18:42Z remain0, including notification events/deliveries/push attempts, publication bundles/decisions and Q&A rows; requester connection policy remains PROMOTIONAL_FREE /0 RSD. Advisors changed71→72 with exactly one reviewed authenticated SECURITY DEFINER warning and all prior71 warning identities preserved; no errors or blanket warning closure is claimed. This follow-up records completed promotion only; it executes no production SQL.

PR56 EAS/Firebase configuration source is now canonical; all its application/config/test blobs and original evidence are preserved from4ff2dc0. Actual preview APK/signing/Auth/provider acceptance remains unproven. PR49 remains canonical at65d2802 with accepted exact-source292 Android evidence. UI remains a **testable functional scaffold**; future Figma owns final visual design and Fable remains separate. Continue separate D03 mobile binding and functional AI work; broader Chat, native retry/provider/final-visual/Store closure is not claimed. N07/N08 and accepted core proofs remain closed at their recorded boundaries. See `D03_LIVE86_PROMOTION_20260907.md` and `D03_MESSAGE_RETRY_20260907.md`; older pending-forward/live85 statements below are historical where superseded here.


The retained PR56 pending-merge and recorded-live85 checkpoints below describe their earlier source/proof boundaries and are superseded by this current pointer.

---

<!-- EAS_D03_CANONICAL_INTEGRATION_20260907 -->
## Current source — canonical Auth and D03; EAS/Firebase PR56 pending

Fresh GitHub fetch confirms `a0dfc9f7bec6d1d6cc0c7f71b71ded23e38a114a`, the PR55 merge on top of canonical PR49. Auth/account/Inbox and D03 stable-send source are canonical at their existing recorded proof boundaries. D03 mobile recovery is a separate source unit. The older pending-merge checkpoints below are preserved as historical evidence.

PR56 is being reconciled onto this fresh canonical source. All eight EAS/Firebase source/test blobs remain identical to reviewed source170686a; the exact public Firebase file and preview/proof package overrides are preserved. Imported Auth and D03 application source remains identical to canonical. No build, token/provider call, EAS remote mutation or database access occurred in this integration. EAS/Firebase APK, signing/Auth and push acceptance remain unproven. Current UI is a functional scaffold; final Figma design is separate.

Root's separate D03 structural postflight at 2026-09-07 13:02:34 UTC confirms live86 with head `20260907130151_clean_d03_message_retry`. This branch still retains the canonical repository's recorded live85/pending1 provenance until the dedicated alias reconciliation is merged. These are distinct observed-live and recorded-source boundaries. Do not reapply D03 based on the older recorded metadata; this EAS integration made no live call.

See [PR55 integration and validation](EAS_PR55_CANONICAL_INTEGRATION_20260907.md). Local source checks and final-head CI/CodeQL must pass before PR56 merge; this checkpoint is not canonical PR56 or new live evidence.

---

<!-- EAS_CANONICAL_INTEGRATION_20260907 -->
## Current source integration — canonical PR49 and pending EAS/Firebase PR56

Fresh GitHub fetch confirms canonical `65d280270ead4d13dcb41f7342a74b164c41e4d9`, the merge of PR49. Its recorded Auth/account/Inbox native proof remains tied to source29271e6 and run34119448882; it is now canonical at that scoped boundary. The older “NOT MERGED” paragraphs below describe their recorded pre-merge checkpoints and are superseded here.

PR56's existing team EAS identity and exact public Firebase configuration are being integrated onto that canonical source. The eight EAS/Firebase source/test Git blobs remain identical to170686a, including the671-byte Firebase file and package-aware proof/dev overrides. The only package.json delta from canonical is the existing EAS pre-install guard hook. No EAS build, key/environment/version mutation, provider call, Supabase write or final UI redesign occurred. Preview/APK certificate/Auth/token/provider acceptance remains unproven.

See [canonical integration and validation](EAS_PR49_CANONICAL_INTEGRATION_20260907.md). This merge is reviewable source work pending Root acceptance/commit/push; do not label it canonical PR56 or new live evidence. Frozen governing documents and all historical evidence retain their original bytes. The current UI remains a functional scaffold; final Figma design is separate.

---


## CURRENT SOURCE CHECKPOINT — 2026-09-07 / EXISTING EAS PREVIEW IDENTITY

Existing team EAS identity is source-configured and read-only verified: `@sljivas-team/uskoci`, project `1e6cc490-9851-4741-9226-128612122db6`, package `rs.uskoci.preview`. Source review/merge is pending for this unit. The preview profile uses existing remote credentials and automatic remote versioning with local seed35; the fresh remote-version read returned no initialized counter. The EAS-only pre-install guard rejects wrong identity, missing/foreign public backend environment and fake/test data composition.

Read [existing identity, signing reference and proof limits](EAS_EXISTING_PREVIEW_IDENTITY_20260907.md) and the [public Firebase configuration extension](EAS_FIREBASE_PUBLIC_CLIENT_CONFIG_20260907.md). The exact 671-byte owner-supplied file is now integrated for preview only; disposable package overrides resolve without it. Native FCM auto-init and Analytics collection are explicitly disabled. All 48 focused config/guard tests and 39 suites/280 tests pass. No SDK install, build, submit, update, remote version/credential/environment mutation or database write occurred. Firebase Console identity/FCM flags and client config are not APK certificate/Auth or token/provider delivery proof. N08 live85/pending0 below is the original PR54 base checkpoint, not a fresh live inventory or an override of newer canonical evidence.

---

## CURRENT SOURCE CHECKPOINT — 2026-09-07 / D03 STABLE MESSAGE RETRY

The D03 stable-send unit is **IMPLEMENTED / AUTHENTICATED DISPOSABLE PROVEN / PENDING CANONICAL AND LIVE ADMISSION**. It extends the existing message table with a sender-owned command key and an account-bound RPC that invokes the unchanged N01 writer. The same command returns the original message UUID after retry or terminal completion; it creates no duplicate message/event. Overall Chat remains PARTIAL: this unit does not activate UI, group channels, attachments, read receipts or push delivery.

Read [D03 contract and original proof](D03_MESSAGE_RETRY_20260907.md). Exact source `04132b98ff189abeae5481a73a95245289b4e0f6`, run34113306660, artifact10015325641:11 D03 checks plus6 N07 and12 N08 checks,38 suites/266 tests and TypeScript PASS. Inventory is **86 source files / recorded live85 / pending1**. Live remains the verified N08 baseline below; this source unit made no production write. Next: reviewed canonical merge, fresh live preflight and accepted exact forward promotion, then real D03 screen binding and physical Android proof.
<!-- EXECUTION_V3_CHECKPOINT_20260907 -->
## Current execution — reviewed scaffold and native Auth/account proof

The owner's latest steering keeps the current UI a **testable functional scaffold**. Future Figma work owns final visual design; Fable is separate asset work. Current three-zone capability/navigation remains, with Profile behind the avatar and no permanent Home/Profile tab or combined discovery mode. Frozen governance bytes remain unchanged; V3 governs execution and the preserved06.09 documents resolve older UI/product conflicts.

Fresh canonical remains `9d245f3053c8e79370a73e82b12d4250e3ed94b7` (PR #54), already an ancestor of PR49. N08/live85 is canonical: **85 / `20260907102458_clean_n08_notification_preferences`**, source85 / pending0. This slice changes no migration or production state. Do not reapply N08/N07. Current charge remains0 RSD; unsupported capabilities stay gated.

PR #49 is **IMPLEMENTED / SOURCE PROVEN / SCOPED ANDROID PROVEN / NOT MERGED**. New Android run `34119448882` passed at exact source `29271e6be7fc519e40941531d37c6d48b0db7ef3`, which includes central Auth commands and identity revision. All27 original PNG/XML pairs were inspected, including real UI logout, second-account login without storage clearing and both readable Agreement rows. Artifact `10018537383`, ZIP SHA-256 `e87d3f887870505942806faa3824f80c699234835f18e31ca5ebd582f62a1acc`. Original source86 and earlier failures remain separately scoped historical evidence.

PR49's required source boundary review passed: UI-issued Auth commands cross the SDK-free contract into `authClientService`; existing Auth runtime owns session subscription/restore. Monotonic `accountRevision` closes batched A→B→A ownership gaps while same-account token refresh retains navigation/drafts. The actual native run passed TypeScript,46 suites /313 tests,34 Python tests and integrity85; all6 source checks succeeded, with3 actual CodeQL analyses and zero errors/results. AST62 client files /25 presentation files /0 findings is a bounded static check, not complete AI/domain-authority proof. Batched concurrency cases are source/component proof, not invented native scenarios.

This follow-up changes documentation/evidence only. All138 frozen native/source/assets/config/vendor/proof Git blobs remain identical to tested source29271e6; the Android artifact remains tied to that source. Final documentation-head CI/CodeQL must pass, and Root must accept before merge. Continue the separate functional AI vertical and its authority work; no final visual/product/provider/Store claim is made. See `docs/implementation/INTENT_SHELL_20260907.md`, `docs/implementation/AUTH_CLIENT_BOUNDARY_20260907.md` and `docs/implementation/evidence/intent-shell-auth-20260907/run34119448882/inspection.md`. Older cursor claims below are historical where superseded here.

---

## CURRENT CHECKPOINT — 2026-09-07 / N08 LIVE85

N08 is **CANONICAL / AUTHENTICATED DISPOSABLE PROVEN / LIVE STRUCTURAL PROVEN**. PR53 merged as `06d8ce1a14c87ca2237d94aa5a60cd7230899ff6`; exact forward promotion is live at **85 migrations / `20260907102458_clean_n08_notification_preferences`**. Inventory is **85 source files / live85 / pending0**. All original84 full history metadata and statement fingerprints remain unchanged. Do not reapply N08 or N07.

Read [N08 live promotion and evidence](N08_LIVE85_PROMOTION_20260907.md) and [the owner contract](N08_NOTIFICATION_PREFERENCES_20260907.md). Exact final-head proof run34110025856 passed12 authenticated N08 checks,6 N07 checks,37 suites/232 tests and TSC; canonical PRE-P4/CodeQL passed. Fresh live postflight confirmed expected function bytes, owner-only RPC grants, RLS, monotonic revision trigger and zero opt-in. No visible settings control, provider delivery, production business fixture or activation is claimed; event/message/Inbox/device engines,0 RSD, HITNO-off and other gates remain unchanged. Continue the next real product gap under the user's V3 execution method and06.09 UI priority.

---

## HISTORICAL CHECKPOINT — 2026-09-07 / N07 LIVE84

N01/N02/N03/N05/N06 are now **CANONICAL / DISPOSABLE PROVEN / LIVE STRUCTURAL PROVEN**. Exact forward promotion completed at 09:07:48 UTC on confirmed project `leqcwgzvjsxugfgzdmth`: **84 migrations / `20260907090645_clean_n06_push_device_registry`**. All five live statement SHA-256/MD5/byte counts equal the frozen canonical files; original79 statement bytes remain unchanged. Current owner execution instructions authorize the completed proof → review → promotion flow.

Read [N07 live promotion and evidence](N07_LIVE84_PROMOTION_20260907.md) and the current status owner before the next narrow preflight. N04's Inbox backend dependency is now LIVE; its recorded Android proof remains valid at its own source boundary. Native token lifecycle, provider dispatch/tickets/receipts, remaining Chat/product work and Store acceptance remain open. No provider/business test call, backfill, HITNO/D0140/Q&A/Application-AI activation or pricing change occurred; 0 RSD remains current.

PR #48 is also CANONICAL at `79e6f3380029b0a9e9494fe54f4ed2e6ca274c98`: six third-party Action references pinned across five workflows; canonical PRE-P4/CodeQL/Control-0 SUCCESS, all six alerts #1/#2/#3/#4/#6/#8 FIXED at09:12:05 UTC and canonical open-alert API empty. This changes workflow supply-chain references only. Evidence is linked from the N07 report.

All retained earlier pending-production, live79 and read-blocked checkpoints below are **HISTORICAL / SUPERSEDED by this pointer**. Do not reapply N07 or restart closed core proofs.

---

<!-- RU5_PHYSICAL_CANONICAL_20260907 -->
## CURRENT CHECKPOINT — 2026-09-07

This checkpoint supersedes older active-cursor claims below; all retained sections are historical provenance, not instructions to repeat closed RU/CDL/P0C/P0D units.

- Canonical merge `940fd1fdf34a314f5d8a0c0fdb9cc3753e55ce01` / PR #37 preserves proof lineage ending `65443681732fe6b290a8216d72d045a1c1b2f840`.
- Physical Android run `34086225039`, job `101630669388`: SUCCESS. All 13 original PNG/XML pairs reviewed; final PASS and disposable business postflight verified.
- PR PRE-P4 `34086227221`, CodeQL `34086225561` and actual security-result check `101630762720`: GREEN. Canonical PRE-P4 `34087979355`, CodeQL `34087978664`, Control-0 `34087979396`: GREEN.
- Physical happy-path unit: **PROVEN / CANONICAL**. Aggregate RU-5: **NOT CLOSED / bounded-note DECISION-REQUIRED**. Application AI stays gated.
- **Fresh live Supabase preflight was safety-blocked; no SQL executed and no alternative access attempted.** Prior `79 / 20260906141409_clean_ru5_fastest_autofill_retirement` is historical, not a current production observation. No live migration or activation occurred.
- Evidence: `docs/implementation/RU5_PHYSICAL_ANDROID_PROOF_ACCEPTANCE_20260907.md` and `RU5_PHYSICAL_ANDROID_EVIDENCE_20260907.json`.
- Next: retain the outstanding permitted live read as OWNER-ACTION, resolve bounded-note authority only from an approved owner source, and proceed with independent current-source gap reconstruction / Notifications-Inbox-Push proof units. No live promotion while its preflight is blocked. Do not rerun the accepted physical journey solely because an older section says pending.

# USKOČI — LIVE IMPLEMENTATION NETWORK

Current authoritative network checkpoint: `2026-09-06` after RU-5 FASTEST/AUTO_FILL retirement became canonical/live/proven and the automated two-account authenticated Application journey became canonical/proven.

Historical network checkpoints that previously occupied this file are preserved byte-for-byte in `LIVE_IMPLEMENTATION_NETWORK_HISTORY_PRE_RU5_RETIREMENT_20260906.md` and in Git history. They remain evidence, but they do not override this newer checkpoint.

## Governing source

- master: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`
- SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- canonical repository/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`

## Current canonical implementation checkpoint

RU-5 FASTEST/AUTO_FILL retirement:

- exact proof head/run: `e7b5ce501c2b9708bd176075ab4b41575edf0832` / `34034993845` PASS
- implementation PR: `#32`
- PR PRE-P4 / CodeQL: `34038248027` / `34038246172` PASS
- canonical merge: `6ee5c611fadf6861b7cc029ffda77437a847ca8c`
- canonical PRE-P4 / CodeQL / Control-0: `34038380354` / `34038380028` / `34038380360` PASS
- source migration: `20260906130000_clean_ru5_fastest_autofill_retirement.sql`
- source MD5/bytes: `25bf03d6bed27d0d9af27ec65d59a63c` / `7363`

RU-5 automated two-account authenticated journey:

- prerequisite W03→W04 routing fix canonical merge: `bc49e8ae423b91b37321787e1dc3a1dada90583e` (PR `#34`)
- proof branch head: `bedca53d2d0bff336a2ea912b3489f4fbf5402aa`
- proof run/job: `34045287333 / 101519151761` PASS
- PR `#35` PRE-P4 / CodeQL: `34045560199 / 34045558347` PASS
- canonical merge: `55f218d1f2cd9a79fdaba9b8c058e92664be758f`
- canonical PRE-P4 / CodeQL / Control-0: `34045636959 / 34045636726 / 34045636967` PASS
- TypeScript: PASS
- regression suite: `23/23` suites PASS, `146/146` tests PASS
- closure evidence: `RU5_TWO_ACCOUNT_AUTH_JOURNEY_PROOF_CLOSURE.md`

## Current live Supabase checkpoint

Project: `leqcwgzvjsxugfgzdmth`

Fresh read-only post-proof checkpoint:

- migration count/head: `79 / 20260906141409_clean_ru5_fastest_autofill_retirement`
- live recorded statement MD5/bytes: `04466b38e780a59a7eab6f4b928544a0` / `6743`
- exact byte identity: `false`
- normalization: remove SQL `--` line comments and whitespace
- canonical/live normalized MD5: `c99a1ded1106ae52f2dbf47289192ce0`
- verdict: comment/whitespace-only transport reconciliation; executable semantics proven equivalent; applied history unchanged; no repair migration

Admissible current contract:

- Need/Application price modes: `MY_PRICE | OFFERS`
- Selection modes: `REQUESTER_SELECTS | BIDDING`

Retired inventory:

- FASTEST Needs: `0`
- FASTEST V2 AI facts: `0`
- FASTEST Application snapshots: `0`
- AUTO_FILL Selections: `0`

Fresh continuity after automated journey proof:

- profiles `6`
- Needs `6`
- responses `4`
- selections `2`
- Agreements `2`
- D0140 policy bundles `0`
- D0140 publication decisions `0`
- RU-4B questions `0`
- RU-4B answer versions `0`
- RU-4B policy decisions `0`
- RU-4B materiality decisions `0`
- RU-4B commands `0`
- connection activations `0`
- Selection function MD5 `4c2b68cdee2fe66facf7fe1c46cef43f`
- Candidate function MD5 `1978ce1d5852cef46f94e81468d37bba`

The automated proof was disposable-only and left zero external/production residue.

## Current live Edge checkpoint

`uskoci-ai-interview`:

- `ACTIVE v6`
- `verify_jwt=true`
- EZBR SHA-256 `012507310cd74cf9e769021aea71f8cfdd4e483406edbff0ee35e0b527e98954`
- V2 price modes `MY_PRICE | OFFERS`
- FASTEST is retired from the live AI price-mode contract

## Preserved closed units

- RU-0 — `CLOSED / LIVE / DO NOT REDO`
- RU-1 — `CLOSED / LIVE / DO NOT REDO`
- RU-2 — `CLOSED / LIVE / DO NOT REDO`
- RU-4 — `CLOSED / LIVE / DO NOT REDO`
- Client Data Layer — `CLOSED / CANONICAL / DO NOT REDO`
- RU-5 P0C-01 — `CLOSED / LIVE`
- RU-5 P0C-02 — `CLOSED / LIVE`
- RU-5 P0C-03 — `CLOSED / LIVE`
- RU-5 P0D-01 — `CLOSED / LIVE`
- RU-5 Manual Selection Eligibility Revalidation — `CLOSED / CANONICAL / LIVE`
- P0D-02 — `CLOSED / CANONICAL / LIVE`
- P0D-03 — `CLOSED / CANONICAL / LIVE / PROVEN`
- RU-5 FASTEST/AUTO_FILL retirement — `CLOSED / CANONICAL / LIVE / PROVEN`
- RU-5 automated two-account authenticated journey — `CLOSED / CANONICAL / PROVEN`

P0D-03 remains exactly:

`REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`

No Worker debit and no historical connection-activation backfill were introduced.

## Automated journey network proof

The canonical automated proof uses two distinct real GoTrue Auth sessions and proves:

`W03 public opportunity read → W04 exact Need read → W05 authenticated Application submit → W06 own Application projection → R05 owner-only candidate projection → exact Application version/hash Selection`

It additionally proves:

- same submit key + same payload replay PASS;
- same submit key + changed payload DENY;
- authenticated Selection replay under P0D-02;
- selected-state W06 reload;
- P0D-03 Requester-beneficiary, promotional-free, headcount, `0 RSD` semantics;
- zero external residue.

This is a backend/client-authority integration proof. It does **not** claim physical UI taps on an emulator/device.

## Fail-closed/deferred network

- RU-3 — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- D0140 production ALLOW — `FAIL_CLOSED`; policy bundle rows `0`; publication decision rows `0`
- RU-4B — `LIVE FOUNDATION / PUBLIC ACTIVATION BLOCKED-DEFERRED`; governed production inventories remain zero
- monetization — `FREE / 0 RSD`; no paid/wallet/checkout/packages activation
- HITNO production activation — unchanged/disabled
- Application AI / RU-5B — gated
- RU-6A hard calendar authority / immutable Agreement Snapshot V2 — separate future unit
- RU-6B shared multi-person Dogovor — separate future unit

## Aggregate RU-5 status

`RU-5 = IN PROGRESS`.

The automated two-account integration blocker is closed. Two separate aggregate gates remain:

1. **Bounded / preselection note governance** — frozen RU-5 requires a bounded note and denial of contact/payment/exact-private-location bypass content according to current policy. Current governing sources do not owner-approve a numeric max length, regex/block list, moderation threshold or numeric rate. Values under `06_DRAFT_EVIDENCE` remain draft-only. Do not invent policy.
2. **Physical device/emulator UI journey proof** — the automated `W03 → W04 → W05 → W06 → R05` journey is proven, but no physical mobile click-through proof has been executed. Android build success is not a substitute. No device proof may be claimed until an actual device/emulator or equivalent mobile E2E harness executes the path.

## Exact next cursor

1. merge this current-state/proof reconciliation through normal PR and canonical push gates;
2. preserve all closed RU-5 constituent units and do not redo them;
3. resolve bounded-note governing authority without invention;
4. establish the smallest trustworthy mobile E2E/device harness for `W03/W04/W05/W06/R05` without production contamination;
5. execute physical device/emulator proof only when the environment is actually available and retain evidence;
6. keep RU-5B gated until both remaining aggregate RU-5 gates are physically closed.

Explicit non-claims: bounded-note policy values, physical device proof, Application AI, calendar hard-conflict authority, Agreement Snapshot V2, shared Dogovor, D0140 production ALLOW, RU-4B public activation, HITNO activation or paid monetization.

Principle: **AI agent is replaceable. Canonical project state is not.**
