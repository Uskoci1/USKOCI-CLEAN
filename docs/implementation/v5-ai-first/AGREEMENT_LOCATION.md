# D0144 — one voluntary location observation

The locked source is `105_PRODUCT_DECISION_REGISTER.md` D-0144, lines265–279.
This feature uses one existing requester/worker Agreement. It does not create a
group location grant, alter execution steps, update a profile, infer arrival,
estimate a route or enable tracking.

The requester can ask for location. This stores an owned command timestamp and
never starts a sensor. The worker's explicit sharing action explains its
recipient, requests foreground OS permission and takes one new observation
through the already installed MapLibre native module. Coarse Android permission
is accepted. No new provider, dependency, background permission or audio/media
file is introduced. Leaving the view, backgrounding, account/intent changes,
timeout or cancellation retires capture. Synchronously replayed cached points
are ignored; a cleanup bridge failure cannot strand the caller or produce a
successful share.

The native journal contains only version, Agreement ID/version, command UUID,
kind and SHA-256. It is written before the first server write. Coordinates stay
in memory for that attempt. After an unknown result or restart, recovery reads
the exact original command; it never recaptures or automatically sends. Explicit
cancellation serializes with the write and can tombstone an absent request.
An already committed write wins and is reported honestly.

SQL138 stores private points separately from opaque receipts. Only participants
of the active physical Agreement and its current accepted version can read the
latest permitted point. Existing block/closure barriers apply; unblocking never
resurrects old grants. Completion, cancellation, REMOTE mode or changed accepted
version removes access. An own command receipt can remain readable without
returning coordinates. The screen labels device capture time and server receipt
time and says that the point does not establish the present location.

Points extend existing NEED_SENSITIVE retention coverage, commands extend
COMMAND_LEDGERS. No retention duration is invented. Export advances the reviewed
projection to41 datasets / OWN_ACCOUNT_V5_3: a worker can export their own points;
the requester gets only their own request metadata. Changed source closes any
older executable export binding until reviewed again.

Focused verification:93 Jest tests across actual controller/service/renderer
source and native adapter with a mocked native boundary; TypeScript passes.
`v5_agreement_location_proof.mjs` is the separate actual Auth/PostgreSQL proof
after137. It has been written and syntax checked but has not yet executed.
Physical GPS/permission behavior and the final Android source build remain
device verification work. No live RPC, GPS observation or provider call has
been made by writing or testing this implementation.
