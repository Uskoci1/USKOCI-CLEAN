# USKOČI CONTROL — private read-model contract

Status: DESIGN/SOURCE CONTRACT ONLY. No DEV migration, Edge deployment, data write or production change is authorized by this file.

## 1. Purpose

The private runtime layer must let the owner inspect marketplace health without exposing privileged Supabase credentials to the browser and without redefining USKOČI business truth.

The canonical application/backend remains authoritative. USKOČI CONTROL is an observer.

## 2. Hard boundaries

- Browser never receives service_role / secret keys.
- First runtime release is read-only.
- No direct unrestricted table browser.
- No private chat body by default; show metadata/counts until a justified support/moderation flow exists.
- Exact address / precise coordinates stay masked outside an authorized Agreement-support context.
- Snapshot data must show captured_at; stale data is never labelled live.
- A missing value is UNKNOWN, never silently zero.
- Control queries must be bounded, paged and cacheable.
- Existing product RPCs are not repurposed as global owner analytics unless their contract already supports it.
- Any future write/admin command requires a separate owner-approved package and audit log.

## 3. Owner surfaces and minimum read-model

### Overview
Returns small aggregates only:
- registered accounts
- active accounts in selected period
- open/published Needs
- Applications submitted / stale / withdrawn
- active Agreements
- completion/review counts
- unread operational anomalies
- push health summary
- AI request/turn health summary

### User Inspector
Search by internal ID / permitted identity fields. Returns:
- account/profile summary
- requester + worker profile state
- counts for owned Needs, Applications, Agreements, Reviews
- availability/work-area summary
- activity timeline composed from bounded authoritative events
- no raw secrets/tokens

### Task Inspector
For one Need:
- public task facts
- private location only as masked/support-authorized fields
- revision/status/search authority
- required_slots / covered_slots
- Applications and selections summary
- Agreements summary
- lifecycle receipt/events
- dispatch/matching summary
- notification trail references

### Agreement Inspector
For one Agreement:
- accepted authoritative terms
- parties by safe profile summary
- current lifecycle/completion state
- pending change state
- message metadata counts and last activity
- reviews state
- no raw chat body in default view

### Matching Inspector
For one Need:
- candidate counts after each authoritative filter
- reason codes for exclusion/admission
- availability/radius/skills/tools/vehicles/licenses/team-capacity stages
- selected/revalidated outcome
- no second matching algorithm in Control

### Notification Inspector
For one event/recipient:
event -> preference -> device readiness -> delivery -> push attempt -> provider/transport result -> app acknowledgment where evidence exists.

### AI Inspector
For NEED and WORKER conversations:
- conversation state
- turn counts
- structured-fact status
- validation/provider outcome metadata
- latency/token/cost only when authoritative source exists
- message content hidden by default

## 4. Known source families from canonical repository

| Domain | Canonical source family | Default Control exposure |
|---|---|---|
| accounts/profiles | app_accounts, app_profiles | safe summary |
| worker area | worker_match_preferences | coarse area/radius only |
| availability | profile_availability_rules/windows | summarized |
| tasks | needs, need_sensitive | public + masked private |
| applications | marketplace_responses, response versions | bounded summary/detail |
| selection | need_selections | detail for one Need |
| agreements | agreements, agreement_execution | bounded summary/detail |
| chat | agreement messages / group messages | metadata by default |
| activity | user_activity_events | bounded timeline |
| notifications | notification_deliveries/preferences | summary/detail |
| push | notification_push_devices/attempts | token never returned |
| AI | ai_conversations/messages/structured_facts | metadata/fact status |
| reviews | agreement_reviews / review RPC truth | summary/detail |

Table names here are source-discovered candidates, not authorization to expose them directly.

## 5. API shape

Control browser should call a private server layer, conceptually:

- GET /api/control/overview?window=24h
- GET /api/control/search?q=...
- GET /api/control/users/:id
- GET /api/control/tasks/:id
- GET /api/control/tasks/:id/matching
- GET /api/control/agreements/:id
- GET /api/control/notifications/:id
- GET /api/control/ai/:conversationId
- GET /api/control/system

Exact SQL/RPC names are deliberately not frozen until canonical DEV can be read directly again.

## 6. Performance budgets

- overview: one small projection, no fan-out per entity
- list endpoints: keyset pagination; no unbounded list
- inspector: bounded parallel reads with request cancellation
- refresh: manual + modest interval; not 5-second global polling
- historical analytics: pre-aggregated hourly/daily facts when scale requires
- expensive counts: cached/materialized only after measured need
- Control must expose its own query/request volume

## 7. Freshness classes

- LIVE: direct authenticated read from canonical environment in this request
- FRESH_SNAPSHOT: captured <= 15 min
- STALE_SNAPSHOT: captured > 15 min
- SOURCE_ONLY: inferred from repository/schema contract, not runtime
- UNKNOWN: source unavailable

Every card that depends on runtime state must carry one of these classes.

## 8. Next safe implementation gate

Before writing SQL:
1. regain read-only access to canonical DEV leqcwgzvjsxugfgzdmth;
2. inventory exact current tables/functions/ACL/RLS;
3. compare with this contract;
4. prepare the smallest owner-only read candidate;
5. run security/performance proof;
6. present candidate + proof before any DEV apply.
