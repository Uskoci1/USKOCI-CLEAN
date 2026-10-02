// EX-06 S04: the SQL text the dispatch-lifecycle proof sends to the DISPOSABLE chain. Pure builders (no database here), ASCII only, LF only, no tab, no backslash.
//
// Two kinds, kept apart on purpose:
//   READ_BUILDERS   read-only SELECTs (the ledger of a task, the matcher and the gates, the push suppression decision, the schema contract). They contain no write verb (tested).
//   WRITE_BUILDERS  the LABELLED fixture and isolation writes that the product has no writer for (an account closure request, a re-publication after a confirmed edit) or that keep one
//                   scenario from crowding the next (cancelling the finished tasks, clearing foreign schedule rows). They touch a disposable database only: closure_runtime.mjs refuses any
//                   target that is not the loopback proof stack. Their names say what they are.
// Every identifier goes through quote(), the same contract as the proof adapter's q().
export const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const uuid = value => `${quote(value)}::uuid`;
const uuidList = list => `array[${list.map(item => uuid(item)).join(', ')}]::uuid[]`;
const stamp = value => `${quote(value)}::timestamptz`;

/**
 * The tables and columns the proof reads or writes directly (the product RPCs it calls are not listed: they are pinned). Every name was read from canonical DEV information_schema on
 * 2026-10-02; the proof checks them against the chain BEFORE the first scenario, so a column that does not exist on the chain is reported as a precondition and not as a product finding.
 */
export const SCHEMA_CONTRACT = Object.freeze({
  'public.needs': ['id', 'requester_account_id', 'status', 'title', 'description', 'category', 'approximate_city', 'approximate_area', 'approximate_lat', 'approximate_lng', 'schedule_kind', 'starts_at',
    'ends_at', 'required_slots', 'mode', 'requester_price_rsd', 'required_skills', 'required_tools', 'required_vehicles', 'required_licenses', 'verified_identity_required', 'public_photo_paths',
    'minimum_experience_years', 'execution_location_mode', 'revision', 'published_at', 'response_deadline', 'remaining_search_closed_at', 'task_timezone'],
  'public.opportunity_deliveries': ['id', 'worker_account_id', 'worker_profile_id', 'need_id', 'need_revision', 'dispatch_round_id', 'match_score', 'status', 'expires_at', 'created_at'],
  'public.dispatch_rounds': ['id', 'need_id', 'need_revision', 'round_no', 'batch_size', 'status', 'stop_reason', 'deadline_at'],
  'private.dispatch_schedule': ['need_id', 'next_run_at', 'locked_until', 'attempts', 'last_status', 'last_reason'],
  'public.user_activity_events': ['id', 'recipient_user_id', 'recipient_role', 'event_type', 'entity_type', 'entity_id', 'entity_version', 'urgency', 'dedupe_key', 'created_at'],
  'public.notification_deliveries': ['id', 'event_id', 'recipient_user_id', 'recipient_role', 'channel', 'state', 'suppression_reason', 'expires_at', 'push_started_at', 'created_at'],
  'public.marketplace_responses': ['id', 'need_id', 'worker_account_id', 'status', 'covered_slots', 'submitted_against_need_revision', 'created_at'],
  'public.app_profiles': ['id', 'account_id', 'kind', 'profile_status', 'available_now', 'team_capacity', 'skills', 'tools', 'vehicles', 'licenses', 'exclusions', 'rating_worker', 'city'],
  'public.worker_match_preferences': ['worker_profile_id', 'worker_account_id', 'proactive_notifications'],
  'private.account_closure_requests': ['account_id', 'state', 'revision'],
  'private.account_blocks': ['blocker_account_id', 'blocked_account_id', 'active'],
  'public.notification_preferences': ['user_id', 'role_context', 'push_enabled', 'quiet_hours_enabled'],
});

/** The SELECT that lists the columns of every contract table that exist on the chain: (table, column) pairs. */
export function schemaColumnsSql() {
  const pairs = Object.keys(SCHEMA_CONTRACT).map(table => `('${table.split('.')[0]}', '${table.split('.')[1]}')`).join(', ');
  return `select table_schema || '.' || table_name as t, column_name from information_schema.columns where (table_schema, table_name) in (${pairs}) order by 1, 2`;
}

/** Contract columns that the chain does not have: [{table, column}]. found = the rows of schemaColumnsSql. Pure. */
export function missingColumns(found, contract = SCHEMA_CONTRACT) {
  const have = new Set((found ?? []).map(row => `${row.t}.${row.column_name}`));
  return Object.entries(contract).flatMap(([table, columns]) => columns.filter(column => !have.has(`${table}.${column}`)).map(column => ({table, column})));
}

export const READ_BUILDERS = {
  /** The row of a task that decides whether a wave may run. */
  needState: ({needId}) => `select n.status, n.revision, n.published_at, n.response_deadline, (n.remaining_search_closed_at is not null) as search_closed, n.required_slots, n.schedule_kind, n.approximate_city, n.task_timezone
    from public.needs n where n.id = ${uuid(needId)}`,
  /** Every opportunity delivery of a task with the round it belongs to, best score first inside a round. */
  deliveries: ({needId}) => `select d.worker_account_id, d.worker_profile_id, d.need_revision, d.status, d.match_score::float8 as match_score, d.expires_at, d.created_at, r.round_no, r.status as round_status, r.stop_reason
    from public.opportunity_deliveries d left join public.dispatch_rounds r on r.id = d.dispatch_round_id where d.need_id = ${uuid(needId)}
    order by r.round_no nulls last, d.match_score desc, d.worker_profile_id`,
  /** One row per notification delivery (IN_APP, PUSH) of every OPPORTUNITY_AVAILABLE event of a task; an event without delivery rows still appears once (channel null). */
  opportunityNotifications: ({needId}) => `select e.id as event_id, e.recipient_user_id, e.entity_version, e.urgency, e.dedupe_key, n.id as delivery_id, n.channel, n.state, n.suppression_reason, n.expires_at, n.push_started_at
    from public.user_activity_events e left join public.notification_deliveries n on n.event_id = e.id
    where e.entity_type = 'NEED' and e.entity_id = ${uuid(needId)} and e.event_type = 'OPPORTUNITY_AVAILABLE' order by e.created_at, e.id, n.channel`,
  /** The notification rows of the opportunity events of a task that are still pending (not yet closed): channel, state, count. */
  pendingOpportunityNotifications: ({needId}) => `select n.channel, n.state, count(*)::integer as n
    from public.notification_deliveries n join public.user_activity_events e on e.id = n.event_id
    where e.entity_type = 'NEED' and e.entity_id = ${uuid(needId)} and e.event_type = 'OPPORTUNITY_AVAILABLE' group by 1, 2 order by 1, 2`,
  /** How many schedule rows a tick at `at` would claim (due and not locked). */
  scheduleDueCount: ({at}) => `select count(*)::integer as due from private.dispatch_schedule where next_run_at <= ${stamp(at)} and (locked_until is null or locked_until < ${stamp(at)})`,
  /** How many schedule rows belong to another task than the one given. */
  scheduleRowsExcept: ({needId}) => `select count(*)::integer as other from private.dispatch_schedule where need_id <> ${uuid(needId)}`,
  /** The cheap candidate gate of the wave (private.candidate_profile_ids keeps only the profiles it admits). */
  cheapGate: ({needId, profileId}) => `select private.dispatch_cheap_candidate_admitted(${uuid(needId)}, ${uuid(profileId)}) as admitted`,
  /** Whether an active block exists between two accounts, either direction. */
  pairBlocked: ({a, b}) => `select private.safety_pair_blocked(${uuid(a)}, ${uuid(b)}) as blocked`,
  /** Whether the account is under a closure restriction (a closure request in READY, EXECUTING, FAILED or CLOSED). */
  accountRestricted: ({accountId}) => `select private.closure_account_restricted(${uuid(accountId)}) as restricted`,
  /** The world (REAL or TEST) the dispatch admission reads for an account. */
  accountWorld: ({accountId}) => `select private.account_visibility_world(${uuid(accountId)}) as world`,
  /** The stored state of a worker profile. */
  profileState: ({profileId}) => `select p.profile_status, p.available_now, p.team_capacity, p.skills, p.tools, p.vehicles, p.licenses, p.exclusions, p.rating_worker::float8 as rating_worker
    from public.app_profiles p where p.id = ${uuid(profileId)}`,
  /** The applications of a task: worker account, status, covered slots, revision. */
  responsesOf: ({needId}) => `select r.worker_account_id, r.status, r.covered_slots, r.submitted_against_need_revision from public.marketplace_responses r where r.need_id = ${uuid(needId)} order by r.created_at, r.id`,
  /** What the push sender's own gate says about a delivery: the reason text, or '<null>' when nothing suppresses it. The function reads, it never sends. */
  pushSuppression: ({deliveryId}) => `select coalesce(private.push_suppression(d), '<null>') as reason from public.notification_deliveries d where d.id = ${uuid(deliveryId)}`,
  /** The stored state of one notification delivery. */
  notificationDelivery: ({deliveryId}) => `select n.id, n.channel, n.state, n.suppression_reason, n.push_started_at, n.expires_at from public.notification_deliveries n where n.id = ${uuid(deliveryId)}`,
  /** The stored state of several notification deliveries. */
  notificationDeliveries: ({deliveryIds}) => `select n.id, n.channel, n.state, n.suppression_reason, n.push_started_at, n.expires_at from public.notification_deliveries n where n.id = any(${uuidList(deliveryIds)}) order by n.id`,
  /** The full material snapshot of a task in the shape rpc_confirm_need_edit demands: exactly its 22 keys. */
  materialSnapshot: ({needId}) => `select jsonb_build_object('title', n.title, 'description', n.description, 'category', n.category, 'requiredSlots', n.required_slots, 'mode', n.mode,
    'requesterPriceRsd', n.requester_price_rsd, 'requiredSkills', to_jsonb(n.required_skills), 'requiredTools', to_jsonb(n.required_tools), 'requiredVehicles', to_jsonb(n.required_vehicles),
    'requiredLicenses', to_jsonb(n.required_licenses), 'minimumExperienceYears', n.minimum_experience_years, 'verifiedIdentityRequired', n.verified_identity_required, 'scheduleKind', n.schedule_kind,
    'startsAt', n.starts_at, 'endsAt', n.ends_at, 'executionLocationMode', n.execution_location_mode, 'approximateLat', n.approximate_lat, 'approximateLng', n.approximate_lng,
    'approximateCity', n.approximate_city, 'approximateArea', n.approximate_area, 'publicPhotoPaths', to_jsonb(n.public_photo_paths), 'privateLocation', 'null'::jsonb) as material
    from public.needs n where n.id = ${uuid(needId)}`,
  /**
   * Replays the exact emit the wave makes for one worker: the durable event is idempotent on its dedupe key, so a second emit returns NULL (shown as the nil uuid) and adds no row.
   * revision is the task revision the original delivery was made for.
   */
  emitEventReplay: ({accountId, needId, revision}) => `select coalesce(private.emit_event(${uuid(accountId)}, 'WORKER', 'OPPORTUNITY_AVAILABLE', 'NEED', ${uuid(needId)}, ${Number(revision)}::integer, 'S04 replay', 'S04 replay',
    ${quote(`opp:${needId}:${revision}:${accountId}`)}, 'NORMAL', '{}'::jsonb, null), '00000000-0000-0000-0000-000000000000'::uuid) as event_id`,
  /** The body text of a function of the chain (carriage returns removed with chr(13), so the text has no backslash): for the static claims the report makes about a pinned body. */
  functionBody: ({signature}) => `select replace(p.prosrc, chr(13), '') as body from pg_proc p where p.oid = ${quote(signature)}::regprocedure`,
  /** Columns of the contract tables that exist on the chain. */
  schemaColumns: () => schemaColumnsSql(),
};

export const WRITE_BUILDERS = {
  /** LABELLED FIXTURE: a closure request in READY, which private.closure_account_restricted reads. No product writer is used: the real closure needs a preparation, a policy and an executor. */
  closureFixture: ({accountId}) => `insert into private.account_closure_requests(account_id, state, revision) values (${uuid(accountId)}, 'READY', 1)`,
  /** The plain insert of a second delivery for the same (worker, need, revision): the unique constraint must refuse it (23505). */
  duplicateDeliveryInsert: ({accountId, profileId, needId, revision}) => `insert into public.opportunity_deliveries(worker_account_id, worker_profile_id, need_id, need_revision, match_score, status)
    values (${uuid(accountId)}, ${uuid(profileId)}, ${uuid(needId)}, ${Number(revision)}::integer, 1, 'READY')`,
  /** The insert the wave itself makes (on conflict do nothing): it must add no row. */
  duplicateDeliveryOnConflict: ({accountId, profileId, needId, revision}) => `insert into public.opportunity_deliveries(worker_account_id, worker_profile_id, need_id, need_revision, match_score, status)
    values (${uuid(accountId)}, ${uuid(profileId)}, ${uuid(needId)}, ${Number(revision)}::integer, 1, 'READY') on conflict do nothing returning id`,
  /**
   * LABELLED FIXTURE: re-publication of a task that rpc_confirm_need_edit turned into a DRAFT of the next revision. The product re-publishes through a new review, acceptance and evaluation; this
   * does the one UPDATE of that path (token PUBLISH, DRAFT to PUBLISHED, published_at set) so that the triggers of the publication (the dispatch enqueue) run for the new revision.
   */
  republishFixture: ({needId}) => `begin; select set_config('uskoci.need_lifecycle', 'PUBLISH', true);
    update public.needs set status = 'PUBLISHED', published_at = statement_timestamp() where id = ${uuid(needId)} and status = 'DRAFT'; commit;`,
  /** ISOLATION: the finished tasks of a scenario are cancelled (triggers off) and leave the schedule, so that a later worker write cannot re-queue them into a later tick. */
  retireNeedsIsolation: ({needIds}) => `begin; set local session_replication_role = replica;
    update public.needs set status = 'CANCELLED' where id = any(${uuidList(needIds)}) and status in ('DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE');
    delete from private.dispatch_schedule where need_id = any(${uuidList(needIds)}); commit;`,
  /** ISOLATION: every schedule row of another task is removed, so that a tick claims this scenario's task only. */
  deleteOtherSchedulesIsolation: ({needId}) => `delete from private.dispatch_schedule where need_id <> ${uuid(needId)}`,
  /**
   * ISOLATION, once at the start: every task that already exists on the chain (the earlier stages of the replay left some PUBLISHED) is cancelled and leaves the schedule. A worker write of
   * this proof requeues every open task, and a tick claims every due one, so a foreign open task would be dispatched to the proof's workers.
   */
  retireAllNeedsIsolation: () => `begin; set local session_replication_role = replica;
    update public.needs set status = 'CANCELLED' where status in ('DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE'); delete from private.dispatch_schedule; commit;`,
  /** LABELLED FIXTURE: the response deadline of a task (the product path's deadline parameter is not proved yet; the sweep under test reads the stored column). */
  responseDeadlineFixture: ({needId, at}) => `begin; set local session_replication_role = replica; update public.needs set response_deadline = ${stamp(at)} where id = ${uuid(needId)}; commit;`,
};
