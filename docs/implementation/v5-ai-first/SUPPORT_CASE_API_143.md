# Support143 native/server contract

Candidate only; AF-D17/18. No operator is seeded or activated. RPC names and DTO
keys below are frozen for parallel native integration; implementation/proofs are
in progress. All user RPCs require real authenticated session + expectedUser.

`rpc_support_submit_v5(p_expected_user_id uuid,p_client_request_id uuid,
p_kind text,p_case_id uuid|null,p_expected_revision integer|null,
p_payload_text text)` returns Command. CREATE has null case/revision; every
other action has exact existing case/revision. Payload is strict JSON with the
following keys in this client serialization order (all listed keys required):

| Kind | Payload |
| --- | --- |
| CREATE | `{channel,topic,title,body,desiredOutcome,context,evidence}` |
| AUTHOR_REPLY | `{body,evidence}` |
| CLAIM, CLOSE | `{}` |
| OPERATOR_REPLY, REQUEST_INFO | `{body}` |
| DECIDE, DECIDE_APPEAL | `{outcome,reasonCode,body,evidenceIds,appealId}` |
| APPEAL | `{decisionId,body}` |
| CLAIM_APPEAL | `{appealId}` |

DECIDE uses `appealId:null`; DECIDE_APPEAL requires its UUID. outcome is
ACCEPTED/REJECTED; reasonCode is an operator-authored safe code matching
`^[A-Z][A-Z0-9_]{0,63}$`, not a new policy/sanction. effect is always NONE.
Evidence IDs in decisions must already belong to the same case.

CREATE channels/topics: SERVICE = TECHNICAL/SERVICE_COMPLAINT/OTHER;
TASK = COLLABORATION/NO_SHOW/PUBLICATION_REVIEW;
LEGAL_PRIVACY = CONTENT_NOTICE/PRIVACY_RIGHTS. SAFETY/SAFETY_REPORT cases come
atomically from existing five-category safety authority, including approved
historical reports; use the existing safety form, not CREATE. Only PRIVACY_RIGHTS
and SAFETY do not consume ordinary case/reply quotas (exact AF-D17).

`desiredOutcome` is null or string. `context` is null or Reference; evidence is
Reference[]. Reference exact keys/order: `{kind,id,revision}`; kind TASK or
AGREEMENT or AGREEMENT_MESSAGE requires current Task/Agreement version; kind
GROUP_MESSAGE/TASK_REVIEW/SAFETY_REPORT requires revision:null. UUIDs lowercase.
COLLABORATION/NO_SHOW require AGREEMENT context; PUBLICATION_REVIEW requires
TASK_REVIEW context. Server checks visibility and constructs immutable snapshots;
no client-provided snapshot, arbitrary URL, raw photo, full chat or AI transcript.

Digest is lowercase SHA256 of UTF8:
`kind + '\n' + (caseId ?? '') + '\n' + (expectedRevision?.toString() ?? '') + '\n' + payloadText`.
Server computes this from received TEXT; no supplied hash is trusted. Client
uses JSON.stringify of the typed ordered object above and ordered References.
Only account/key/kind/case/revision/digest may persist locally; payloadText stays
in memory. Same key with different bytes/context rejects. No implicit replay.

Command exact shape:
`{accountId,clientRequestId,kind,state,caseId,expectedRevision,inputSha256,receipt,authoritative:true}`.
state ABSENT/COMMITTED/CANCELLED. ABSENT/CANCELLED have null kind/case/revision/hash/
receipt. COMMITTED receipt exact shape:
`{accountId,clientRequestId,kind,caseId,caseNumber,expectedRevision,inputSha256,eventId,sequence,caseRevision,createdAt,authoritative:true}`.
caseNumber/sequence are decimal strings. CREATE Command.caseId is the created ID,
while its digest binds the submitted null case. All other commands bind their
submitted case. Command recovery/cancel remain caller-owned after grant revocation.

- `rpc_support_read_command_v5(p_expected_user_id,p_client_request_id)` → Command.
- `rpc_support_cancel_command_v5(p_expected_user_id,p_client_request_id)` → Command;
  actor+key tombstone fences late submission; existing COMMITTED wins unchanged.
- `rpc_support_capabilities_v5(p_expected_user_id)` →
  `{accountId,operatorAvailable,canCreate,authoritative:true}`.
- `rpc_support_inbox_v5(p_expected_user_id,p_mode,p_before_case_number text|null)` →
  `{accountId,mode,operatorAvailable,cases,nextBeforeCaseNumber,authoritative:true}`.
  mode OWN/OPERATOR/SAFETY; operator modes require actual active grant. At most50.
  Inbox row: `{id,caseNumber,channel,topic,status,revision,lastSequence,createdAt,updatedAt,context,unread}`.
  Inbox context is `{kind,id,revision}` or null; never submitted narrative/title.
- `rpc_support_detail_v5(p_expected_user_id,p_case_id,p_after_sequence text='0')` →
  `{accountId,case,viewerRole,operatorAvailable,allowedActions,events,decisions,appeals,evidence,nextAfterSequence,authoritative:true}`.
  viewerRole AUTHOR/OPERATOR. Case:
  `{id,caseNumber,authorAccountId,channel,topic,title,desiredOutcome,context,status,revision,lastSequence,createdAt,updatedAt}`.
  context is server `{kind,id,revision,content}` or `{}`. Case states
  RECEIVED/IN_REVIEW/WAITING_FOR_AUTHOR/DECIDED/CLOSED. Each detail page has at
  most50 events; associated decisions/appeals/evidence refer only to that page.
  Event: `{id,caseId,sequence,kind,authorRole,body,createdAt,decisionId,appealId}`.
  Decision: `{id,caseId,caseRevision,outcome,reasonCode,explanation,effect,evidenceIds,priorDecisionId,createdAt,reviewType}`;
  reviewType INITIAL/RECONSIDERATION. Appeal:
  `{id,caseId,decisionId,status,decisionResultId,createdAt}`; status RECEIVED/IN_REVIEW/DECIDED.
  Evidence: `{id,eventId,reference,createdAt}`; reference is server snapshot.
- `rpc_support_mark_read_v5(p_expected_user_id,p_case_id,p_sequence text)` →
  `{accountId,caseId,sequence,authoritative:true}`. Explicit visible-event ack;
  reads do not acknowledge or claim cases automatically. Returned sequence is
  the monotonic max(previous watermark,submitted sequence), so an older page ack
  may return a larger sequence; it can never reduce an existing marker.
- `rpc_support_find_context_v5(p_expected_user_id,p_kind,p_id)` →
  `{accountId,caseId,authoritative:true}`; newest OWN case by caseNumber whose
  context or explicitly submitted evidence matches kind/id. For example, an
  Agreement context with a selected message in evidence is found again from
  that message. An adjacent unselected message does not match. No operator
  fallback or other author's case is included; null if no own match exists.

The server's allowedActions governs buttons, not email/metadata. Author role
takes precedence when the operator is also the submitter: no false independent
adjudication. Positive support decisions cannot publish Task/Q&A or change
Agreement/cancellation/debt/review/sanction. New public policy exceptions remain
a separate explicit decision/adapter. No fake SLA, push delivery or provider.

Service only, for a separately reviewed exact grant batch:
`rpc_support_set_operator_service_v5(p_account_id,p_active,p_expected_revision,p_client_request_id)`
→ `{accountId,purpose:'PRIVATE_TEST_OWNER_SUPPORT',active,revision,authoritative:true}`.
No email/name/client metadata lookup. Exactly one active account; revoke before
switching. No user-facing service key, grant seed or current operator assertion.

Finite rendering vocabulary: allowedActions is a subset of
AUTHOR_REPLY/CLAIM/OPERATOR_REPLY/REQUEST_INFO/DECIDE/APPEAL/CLAIM_APPEAL/DECIDE_APPEAL/CLOSE.
Event kind is CREATE/SAFETY_REPORT or one of those actions. authorRole is
AUTHOR/OPERATOR. Event body is string|null (SAFETY_REPORT may be empty string).
No generic JSON rendering is required. Reference content keys are exact:

| Reference kind | Server content |
| --- | --- |
| TASK | `{title,description,status,createdAt,executionMode,countryCode,submitterRole,media}`; submitterRole REQUESTER/READER |
| AGREEMENT | `{needId,status,createdAt,submitterRole}`; REQUESTER/WORKER |
| AGREEMENT_MESSAGE | `{agreementId,body,createdAt,mine}` |
| GROUP_MESSAGE | `{groupId,sequence,body,createdAt,mine}` |
| TASK_REVIEW | `{draftId,draftRevision,displayedContentDigest,publicFacts,safety,createdAt,policy,evaluation,media}` |
| SAFETY_REPORT | `{category,needId,agreementId,createdAt}` |

Media is `{assetId,sha256,width,height}[]` from registered sanitized Task assets;
no account/path/URL bytes. User intentionally submits the selected Task/review
reference; its photos receive143 evidence holds. Future image byte read must
still check exact private case authorization, not use a public Storage grant.

TASK_REVIEW policy exact `{bundleId,version,contentSha256}` with nullable fields;
evaluation null or `{kind,outcome,safeReasonCodes}` with nullable fields.
PublicFacts is existing strict V2 exported fact projection
`{key,value,displayValue,status}[]`; keys exclude need.exact_address,
need.access_notes, need.resolved_location and need.public_photo_paths. The value
uses the existing V2 fact-key schema, primitive arrays and explicit public
geography labels only. Unknown fact keys are omitted server-side. String fields
may be null only where existing canonical schema permits absence (Task draft
text/country/mode; fact displayValue; review draftId/policy/evaluation).
Message bodies/timestamps/UUID identity fields are required, mine is boolean.
SAFETY category is the five existing categories; needId/agreementId are nullable.

At most50 submitted references and50 decision evidenceIds per command (bounded
transport, not a new case quota). Decision evidenceIds/priorDecisionId may refer
to an earlier page of the same case; detail does not silently fetch that history.

The byte adapter may call service-only
`rpc_support_media_service_v5(p_account_id,p_session_id,p_case_id,p_asset_id)`
after validating the original human JWT. This additionally checks a live Auth
session, current case ownership/operator grant and exact143 media-evidence ref,
auditing the operator read. Service DTO:
`{assetId,caseId,bucket:'profile-media',path,sha256,contentType:'image/jpeg',byteSize,authoritative:true}`.
Path is for internal Storage retrieval only, never native projection/public URL.
