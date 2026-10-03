# Personal worker profile — 2026-10-03

## Owner decision and scope
The owner explicitly requested implementation of the preceding discussion: one personal worker profile, AI-led setup, no licenses and no permanent team size; people provided are specified for an individual task offer. Continue the existing white, dimensional USKOČI visual direction.

Runtime source: `4081d682f51045661d76b8f6e760db3dc6ee5f3e`. No new app, service, dependency or account role.

## Screen and flow
| Surface / entry | Goal and primary action | Secondary action / Back | Preserved state and exceptional paths |
| --- | --- | --- | --- |
| Profile hub → Radni profil | Read own capabilities; open AI conversation | Area, availability, calendar remain direct links | Current owned profile, loading/error/retry |
| Radni profil | AI conversation above a readable personal summary | Explicit edit buttons; one editor at a time | Local draft retained across section changes; pending term is revealed on failed save |
| Manual correction | Save only changed supported fields | Dirty Back requires discard confirmation | Busy/unknown save cannot be discarded by toolbar/hardware Back; readback decides success |
| AI conversation | Explain actual work and available resources; inspect draft | Existing manual and calendar editors | Legacy V1 envelope retained; no license/team provider patch; previous messages remain historical |
| Frozen AI review | Inspect full supported values, then save | New conversation after confirmed stale review | No silent normalization of an older reviewed license/team change; recovery and explicit confirmation retained |
| Application → selection | Commit people for this offer | Existing price and calendar semantics | Backend candidate removes profile-capacity gate, preserving slot/price/ownership/revision guards |

## Design review
| Before | After | Why |
| --- | --- | --- |
| Permanent expanded fields and finite equipment catalogues | Summary, AI entry and deliberate manual corrections | An individual can describe equipment that no icon catalogue can exhaust |
| Team size and licenses dominate setup | Personal capabilities, area, availability, tools and vehicles | Matches the owner's new product model |
| Equal text treatment for identity and detail | Name emphasis, secondary biography, separated fact groups | Clearer scan without a card around every fact |
| Long lists can occupy many screens | Three-line long summaries with explicit full expansion | Area and availability remain reachable; full authored content stays available |
| Unfinished term hidden by switching editor | Save opens the editor containing it | Clear repair path without dropping input |
| Back can lose a local edit | Explicit discard sheet; unresolved save remains owned | Avoids accidental data loss |
| Seven empty weekday rows in AI review | Actual recurring rules and dated exceptions | Full schedule information without a wall of empty metadata |

Large-text/narrow mode stacks the conversation artwork and copy. Existing press/haptic behavior and shared reduced-motion policy remain; no ornamental input animation or extra dependency.

## Checks recorded before native review
- TypeScript passed.
- Main profile/hub/onboarding/presentation: 91 checks in four focused suites.
- AI review/manual: 12; recovery: 59.
- Worker Edge: 30; task Edge context: 81; focused registry assertions: 2.
These are scoped checks, not whole-app/native/provider/push acceptance.

## Backend and version compatibility
Candidate WPP01 changes eight existing function bodies: five offer-capacity authorities, two license matcher authorities and the AI review writer. It preserves legacy columns and snapshot history. New review saves cannot silently change hidden deprecated fields. Both closure digests and function metadata must remain unchanged; no certificate rebind is included.

The deployed interview bundles predate the separately prepared AI-availability diagnostics. The personal-profile deployment must preserve the exact deployed dependencies and apply only the current approved product delta; it must not smuggle in that unrelated pending bundle.

## Remaining connected product work
The existing nine-key WORKER_PROFILE_V1 envelope has no separate desired-work or notification-preference fields. `app_profiles.exclusions` is a hard eligibility block, including manual applications; it cannot be relabeled as “do not notify me”. `worker_match_preferences.proactive_notifications` and `same_day_urgent_notifications` exist but are not included in the current AI source hash or interview writer.

A versioned personal-profile contract is still required for separate desired work, explicit exclusions, relevant/HITNO preferences, source revision protection, review, persistence, export/erasure and matching consumption. No screen in this slice claims those settings were saved. Existing working push evidence is preserved; no provider call, new message or global push activation belongs to this slice.

## Native and server evidence
Pending while APK run 37141671693 and the bounded SQL proof run. This section is updated from actual results before the final report; compilation alone is not visual acceptance.

