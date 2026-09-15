# USKOČI — OWNER IMPLEMENTATION CLOSURE — 2026-09-03

**Status:** `OWNER-LOCKED FOR V1 IMPLEMENTATION`  
**Purpose:** remove avoidable ambiguity before implementation without pretending external/device/legal proof already exists.

This addendum is newer than v9/v8/V16 source material. It does not overwrite 21/21 product truth; it closes implementation-level choices that are compatible with it.

## OC-001 — V1 monetization is operationally closed as FREE / 0 RSD

- V1 launch has **no platform checkout** and no payment provider dependency.
- `Povezivanje` remains an immutable activation/receipt concept with platform monetary cost `0 RSD`.
- Work price is separate from platform monetization and USKOČI V1 does not hold task funds/escrow.
- Historical 99 RSD/subscription/package ideas remain future provenance only.
- Future paid monetization must plug into the existing Selection/Povezivanje authority boundary; it may not redesign Zadatak/Prijava/Dogovor.

**Effect:** paid monetization is no longer an implementation blocker for V1. Future paid launch remains owner/legal/accounting/payment work.

## OC-002 — V1 map/location provider selection

- RN map component: **`react-native-maps`** behind `MapPort`.
- V1 native map provider: **Google Maps SDK** on Android and iOS for consistent map behavior/styling.
- Device location: **`expo-location`** behind `LocationPort`.
- Only map display is enabled by default. Places, Routes, Street View or other billable APIs are separate opt-in capabilities and are not silently enabled.
- API keys must be platform-restricted and never stored as unrestricted secrets in source. Mobile-restricted map keys are configuration credentials, not business authority.
- Public marketplace receives only coarse/public-safe geography. Exact location is never required for W03/W04 map rendering.
- Exact Dogovor map use is a separate authorized/private context and must be reflected in privacy/provider inventory.

Observed provider evidence on 2026-09-03: Expo documents `react-native-maps` as supported; Google Maps SDK mobile map usage currently has unlimited free usage in the Maps SDK SKU, while billing/key configuration is still required. Recheck pricing before release.

## OC-003 — V1 push provider selection

- Client: **`expo-notifications`**.
- Initial transport: **Expo Push Service**, which forwards to FCM/APNs.
- Backend event truth remains `user_activity_event`; push is only a delivery attempt.
- Store both Expo push token and native device token where technically available, so the transport can move directly to FCM/APNs later without changing business events.
- Queue/fan-out must respect provider throughput. Current Expo documentation states 600 notifications/second/project; burst handling must queue/backpressure rather than drop business events.
- Delayed push always revalidates current state when tapped; payload contains no unnecessary private data.

## OC-004 — AI provider is implementation-neutral; server authority is not

- Product behavior must not depend on Gemini/OpenAI brand choice.
- Current live Edge implementation may keep its observed provider order: Gemini when configured, OpenAI fallback when configured.
- Provider secret stays server-side only.
- AI interprets/proposes; **D-0140 server policy gate** owns publication outcome.
- Provider fail or policy uncertainty cannot become implicit ALLOW.

## OC-005 — D-0140 implementation may start before legal activation, but publish remains fail-closed

- Build versioned policy-bundle registry, rule IDs, fingerprinted decisions and canonical publish gate now.
- Seed **no invented active legal rules**.
- Until an approved/current policy bundle exists, production publication decision is `REVIEW` / not public.
- Documents marked `NEEDS SERBIAN LEGAL REVIEW` remain evidence/draft, not production normative authority.
- Policy bundle activation requires explicit reviewed provenance.

## OC-006 — Public preselection Q&A is part of V1

This restores the V16 `NEED-09 / B10 Anonymous clarifications` capability under current 21/21 naming and privacy rules.

### Placement
- Embedded in **W04 Zadatak detail** and **R04 Zadatak workspace**.
- No 29th top-level surface.

### Who can ask
- Authenticated user with an ACTIVE Worker profile who can currently view the admitted Zadatak.
- Cannot ask on own Zadatak.
- Block/safety/rate limits apply.

### Public identity
- Question text is public-safe.
- Asker identity is **anonymous to the Requester and other users before Selection**.
- Server retains actor identity for authorization, anti-abuse and audit.

### Content boundary
Questions and answers may not publish:
- phone numbers, email addresses or social handles;
- exact private addresses/access instructions;
- external contact/coordination details designed to bypass USKOČI connection flow;
- unsafe/prohibited content under the active D-0140 bundle;
- secrets/private third-party data.

V1 may use deterministic contact/PII floors plus AI semantic interpretation, but the server gate owns the final public decision.

### Flow
`W04 draft question → server auth/rate/block check → public-safe/D-0140 policy gate → ALLOW/CLARIFY/REVIEW/BLOCK → current-revision public question → event/Inbox to Requester`

Requester answer:
- non-material answer → policy gate → public answer;
- material answer → **cannot silently become truth**; it enters canonical `REVISE_TO_DRAFT → Human Review/readmission → ALLOW → republish` path;
- affected unselected Applications become stale by the existing revision rules;
- existing Agreements remain frozen to their selected snapshot.

Questions bind to exact Zadatak revision. Old-revision unanswered questions are not projected as current after a material revision.

### Not a chat
- one question + owner answer is a structured clarification object;
- no unrestricted preselection messaging;
- full messaging begins in Dogovor according to final group/private channel model.

## OC-007 — Three command/event bindings are closed

- R04 `Ne traži više nikoga` → `CAPACITY_CLOSED`.
- S07 unblock → `ACCOUNT_BLOCK_REMOVED`.
- W06 `Zadrži` reviewed revised Zadatak → `APPLICATION_REBASED_TO_NEED_REVISION`.

The W06 command creates/records an immutable current Application version/rebase binding to the reviewed Need revision; it never silently keeps a stale revision selectable.

## OC-008 — 35-domain matrix is reconstructed, not fabricated as the lost historical file

The previous 30-row current matrix omitted five capabilities that are explicitly present in V16 capability/dependency evidence. Current matrix therefore adds:
1. Need media pipeline;
2. Public preselection Q&A;
3. Identity attestation/verified badge;
4. Application AI assistant;
5. Agreement evidence attachments.

This closes the packaging/provenance ambiguity while preserving the original 30-row v9 matrix in provenance.

## OC-009 — Complex Dogovor behavior is closed; visual implementation must follow the dedicated closure contract

Dogovor remains:
- one task-centered shared aggregate;
- individual immutable participant Agreements;
- exactly `Pregled | Poruke`;
- group channel + requester↔participant private channels inside Poruke;
- membership intervals and future-message cutoff;
- participant-by-participant status/capacity;
- same-Zadatak missing-capacity recovery;
- terminal read-only behavior.

The dedicated visual closure document defines exact screen hierarchy for D01/D02/D03/D05. HTML donor behavior that conflicts is superseded.

## OC-010 — Proof is a gate, not an owner ambiguity

The following do **not** need more product decisions before implementation:
- live RLS/security proof;
- two-account proof;
- device proof;
- load/concurrency proof;
- signed release/store proof.

They remain mandatory exit gates and cannot be marked complete by documentation alone.

## OC-011 — One live implementation network is the governing progress tracker

`LIVE_IMPLEMENTATION_NETWORK.md` is the human-readable live network.  
`09_IMPLEMENTATION_TRACKING/IMPLEMENTATION_STATUS_LEDGER.csv` is its machine-readable mirror.

After every implementation unit, the agent must update actual Git SHA, migration head, status/proof, physical owners and remaining blockers. No separate competing status document may silently override this tracker.
