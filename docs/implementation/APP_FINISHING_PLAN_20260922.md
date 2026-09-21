# USKOČI — finishing and controlled-release execution plan

Date: 2026-09-22. Execution plan, not a release approval or new product decision.
Current facts and receipts remain in `USKOCI_CURRENT_STATUS.md`. Owner reports are in plain Serbian.
The latest owner boundaries govern: no paid probes, fabricated DEV users, new dependencies, destructive
operations or production deployment by implication. Work solo. Preserve functional truth; redesign visual legacy.

## Assessment

The project has a substantial marketplace engine and repeatable disposable proofs. That is a basis for
finishing, not a measured claim of release readiness or capacity. Remaining work crosses reliability,
privacy, client/server contracts, device behavior, design and operating the service. Counts of closed
audit items cannot express a completion percentage. There is no production project.

## Ordered delivery gates

| Gate | Concrete output | Evidence required to call it complete | User impact |
| --- | --- | --- | --- |
| 1. Publication recovery | PKG-037, audit 11.2; bounded evaluation, one settlement, expired-claim recovery | Local regressions, disposable SQL/Auth/REST plus exact Edge handler, DEV candidate receipt, exact deployed bundle/JWT readback, matching client build | A slow answer can finish; lost acknowledgements cannot authorize duplicate paid requests or leave a permanent review lock |
| 2. Remaining interview recovery | Audit 11.1 across intake, worker and QA | Deployed bundle comparison, read full dispatch/failure/completion bodies, before/after faults, no replay after dispatch, client/server deadlines tested together | A broken or interrupted conversation has an honest, recoverable outcome |
| 3. Privacy and account lifecycle | 7.17 public/detail/owner boundary; 7.41 and remaining 8.18 | Actual local REST for strangers, owner, participant and restricted account; old/new client compatibility; second-device recovery | Private task/account fields stay private; account status and recovery agree across devices |
| 4. Client contract completion | Remaining 7.1 call families, full Home attention integration | Each called function and adapter compared; refusal, lost ACK and stale revision cases; no whole-list reconciliation broken by pagination | Clear refusal/recovery, correct attention/counts and fewer unnecessary reads |
| 5. One complete marketplace journey | Publish → discover → apply → select → Dogovor/chat → done → confirm → review | Two real devices when owner is ready; interrupted/offline/background/restart paths plus change, cancellation and problem paths | The whole job can be completed, not just isolated screens |
| 6. New product experience | Functional inventory per surface; three materially different compositions; chosen components/states/motion implemented | Owner sees the short plan first; consistent native behavior, text scaling, keyboard, touch targets, reduced motion and real-data states on devices | A clearer, substantially new USKOČI experience preserving working behavior |
| 7. Operating the service | Legal/operator/retention, support ownership, push delivery, monetization route | Reviewed real texts and operator decisions; real delivery/deep-link proof before push activation; verified collection/store approach | Truthful consent, reachable support, useful notifications and understandable charges |
| 8. Controlled release and growth | Production setup plan, monitored pilot, capacity evidence, Android/iOS release artifacts and store materials | See growth gates below; owner approval for production/shared resources and non-routine operations | Reliable onboarding and recovery as usage expands |

Gates describe dependencies, not a ban on independent work. Design exploration and asset research can
proceed while backend proofs run. Major screens still require functional responsibility → three fresh
compositions → comparison → selection, before reuse of current visuals.

## Capacity is measured separately

No current test result establishes a supported number of users. Registered accounts, daily active users,
simultaneous sessions, requests per second and concurrent AI streams are different quantities.

1. Define the launch geography, pilot cohort and busiest expected concurrent journeys with the owner.
2. On an isolated environment, build synthetic datasets at increasing history sizes and traffic levels.
   Simulate external AI/payment/push transports; never load-test paid providers or canonical DEV.
3. Measure list/detail/Home/chat latency, database connections/locks/query plans, scheduled work backlog,
   upload contention, error rate, memory and cost estimates. Report p50/p95/p99 and dataset/concurrency,
   not an unsupported user-capacity headline.
4. Verify recoverability during timeouts, duplicate delivery, app restarts and worker interruption.
   Receipts, access boundaries and attempt identity must hold under concurrent load too.
5. Choose launch thresholds only after baseline measurements. Fix the measured bottleneck, then repeat
   the affected scenario. Do not add caches, services or dependencies merely to claim scalability.
6. Before public release, document monitoring, incident ownership, recovery/backup checks and a rollback
   plan for compatible client/server versions. A small invited pilot precedes wider availability.

Specific known growth work: the full Home attention aggregate is not yet integrated. The new PKG-037
sweep limits writes to 100 review commands per invocation; that does not bound rows scanned. A read-only
catalog check on 2026-09-22 found only the review primary key and account/request unique index on
`private.ai_task_review_commands`, no state/lease index. Measure the query with larger isolated history;
any index/schema change follows the certificate and owner-approval rules. Do not call this scale-tested.

## Owner-dependent inputs

- Phone readiness for installation and the real journey; speech only with separate explicit readiness.
- Optional profile phone decision remains unanswered; do not build it from silence.
- Operator identity, reviewed legal texts and retention decisions.
- Paid connection-service terms and collection route in Serbia. Job escrow, worker payouts and credits
  are not implied. Store acceptance has not been established by an owner billing preference.
- Approval of the design direction; supplied HTML is reference material, not an immutable specification.

## Reporting contract

For every delivered slice report: the original user-visible failure, what changed, exact evidence and
its limits, where the change is active (source / CI / DEV / APK / phone), next work and any owner decision.
Do not call an APK installed, a provider exercised, push delivered, or a journey completed without observing it.
