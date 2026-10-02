// EX05-S01: the FIXED SQL statements the proofs run, as small pure builders. Why a module: there is no local Postgres on the authoring machine, so the grammar of every statement is
// checked offline (sql_syntax.test.mjs, pglast) and every identifier is validated here before it reaches a statement (uuid(), int()). The column and table names are copied from statements
// that already ran green in the frozen proofs (voice_b1_feature_proof, private_history_read_proof, message_window_proof, exact_message_event_resolver_proof, push_event_transport_proof,
// d03_message_retry_proof, v5_group_conversation_proof); nothing here is a new schema assumption.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[a-f0-9]{64}$/;
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const rawUuid = value => { if (!UUID.test(String(value))) throw new Error('SQL_UUID_REQUIRED'); return String(value); };
const uuid = value => q(rawUuid(value));
const int = value => { if (!Number.isInteger(value)) throw new Error('SQL_INTEGER_REQUIRED'); return String(value); };
const hex64 = value => { if (!HEX64.test(String(value))) throw new Error('SQL_HEX64_REQUIRED'); return q(value); };

export const SQL = {
  profileOf: (accountId, kind) => `select id from public.app_profiles where account_id=${uuid(accountId)} and kind=${q(kind)}`,
  prepareWorkerProfile: profileId => `update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${uuid(profileId)}`,
  insertPublishedNeed: ({needId, requesterId, requesterProfileId, label, slots}) => `begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${uuid(needId)},${uuid(requesterId)},${uuid(requesterProfileId)},'PUBLISHED',${q(label)},'Disposable EX05-S01 proof','PROOF','Novi Sad','Liman','OFFERS',${int(slots)},'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`,
  eventOfMessage: messageId => `select id,recipient_user_id,recipient_role,entity_version,payload,dedupe_key,read_at from public.user_activity_events where dedupe_key=${q('agreement_message:' + rawUuid(messageId))}`,
  deliveriesOfEvent: eventId => `select id,channel,state,suppression_reason,dedupe_key from public.notification_deliveries where event_id=${uuid(eventId)} order by channel,id`,
  insertPhotoUploadFixture: ({assetId, uploadId, accountId, agreementId, inputHash, outputHash}) => `insert into private.agreement_photo_uploads_v5(id,account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,admitted_at,sanitized_sha256,storage_path,width,height,byte_size,dispatch_state,dispatch_outcome)
    values(${uuid(assetId)},${uuid(accountId)},${uuid(agreementId)},1,${uuid(uploadId)},'READY',${hex64(inputHash)},12,'image/jpeg',clock_timestamp(),${hex64(outputHash)},${q(rawUuid(accountId) + '/agreement-v5/' + rawUuid(assetId) + '/' + outputHash + '.jpg')},10,10,12,'SETTLED','STORED')`,
  authenticatedStatement: (accountId, statement) => `begin;set local role authenticated;select set_config('request.jwt.claim.sub',${uuid(accountId)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub: rawUuid(accountId), role: 'authenticated'}))},true);${statement};commit;`,
  sendV2Statement: (accountId, agreementId, key, body) => `select public.rpc_send_agreement_message_v2(${uuid(accountId)},${uuid(agreementId)},${q(key)},${q(body)})`,
  isolatePushTransport: () => `update public.notification_deliveries set state='SUPPRESSED',suppression_reason='SYNTHETIC_FIXTURE_ISOLATION'
    where channel='PUSH';update public.notification_push_attempts set transport_state='FINAL',outcome='FATAL',
    lease_id=null,lease_until=null where transport_state is not null;`,
  expireAttemptLease: attemptId => `update public.notification_push_attempts set lease_until=clock_timestamp()-interval '1 second' where id=${uuid(attemptId)}`,
  pauseSchedulers: () => `begin;set local lock_timeout='5s';select cron.alter_job(job_id:=j.jobid::bigint,active:=false) from cron.job j where j.active;commit;`,
  insertHistoryFixture: ({agreementId, senderId, ids, bodyPrefix}) => {
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('SQL_IDS_REQUIRED');
    return `insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body,created_at)
    select x.id,${uuid(agreementId)},1,${uuid(senderId)},${q(bodyPrefix)}||x.ord,
      date_trunc('day',statement_timestamp())-interval '1 day'+((x.ord/3)::integer)*interval '1 microsecond'
    from unnest(array[${ids.map(uuid).join(',')}]::uuid[]) with ordinality x(id,ord);`;
  },
  messageCounts: () => `select (select count(*) from public.agreement_messages)::int messages,(select count(*) from public.user_activity_events where event_type='MESSAGE_RECEIVED')::int message_events,(select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id where e.event_type='MESSAGE_RECEIVED')::int message_deliveries`,
  notificationCounts: () => `select (select count(*) from public.agreement_messages)::int messages,(select count(*) from public.user_activity_events)::int events,(select count(*) from public.notification_deliveries)::int deliveries,(select count(*) from public.agreement_invalidations_v1)::int invalidations`,
  unreadMessageEventCount: (accountId, agreementId) => `select count(*) from public.user_activity_events e join public.notification_deliveries d on d.event_id=e.id and d.recipient_user_id=e.recipient_user_id and d.channel='IN_APP' and d.state<>'SUPPRESSED'
    where e.recipient_user_id=${uuid(accountId)} and e.entity_type='AGREEMENT' and e.entity_id=${uuid(agreementId)} and e.event_type='MESSAGE_RECEIVED' and e.read_at is null`,
  faultTriggerInstall: () => `create function private.ex05_fault() returns trigger language plpgsql as $f$ begin raise exception 'EX05_FORCED_EVENT_FAILURE';end $f$;
    create trigger ex05_fault before insert on public.user_activity_events for each row execute function private.ex05_fault();`,
  faultTriggerRemove: () => `drop trigger if exists ex05_fault on public.user_activity_events;drop function if exists private.ex05_fault();`,
  messageByKey: (accountId, key) => `select id,body from public.agreement_messages where sender_account_id=${uuid(accountId)} and client_message_id=${q(key)}`,
  invalidationRevision: agreementId => `select revision from public.agreement_invalidations_v1 where agreement_id=${uuid(agreementId)}`,
  readStateDigest: () => `select jsonb_build_object(
    'messages',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.agreement_messages r),
    'events',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.user_activity_events r),
    'deliveries',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.notification_deliveries r),
    'attempts',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.notification_push_attempts r))`,
  readStateInApp: () => `select jsonb_build_object(
    'messages',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.agreement_messages r),
    'events',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.user_activity_events r),
    'inAppDeliveries',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.notification_deliveries r where r.channel='IN_APP'))`,
  attemptState: attemptId => `select transport_state,send_count from public.notification_push_attempts where id=${uuid(attemptId)}`,
  deviceSessionId: deviceId => `select bound_session_id from public.notification_push_devices where id=${uuid(deviceId)}`,
  deactivateDevice: deviceId => `update public.notification_push_devices set active=false where id=${uuid(deviceId)}`,
  reactivateDevice: deviceId => `update public.notification_push_devices set active=true where id=${uuid(deviceId)}`,
  emitExecutionEvent: (recipientId, agreementId, dedupe) => `select private.emit_event(${uuid(recipientId)},'REQUESTER','EXECUTION_STATE_CHANGED','AGREEMENT',${uuid(agreementId)},1,'SYNTHETIC PRIVATE TITLE','SYNTHETIC PRIVATE BODY',${q(dedupe)})`,
  changeEventRecipient: (eventId, accountId) => `update public.user_activity_events set recipient_user_id=${uuid(accountId)} where id=${uuid(eventId)}`,
  changeEventRole: (eventId, role) => `update public.user_activity_events set recipient_role=${q(role)} where id=${uuid(eventId)}`,
  deleteEvent: eventId => `delete from public.user_activity_events where id=${uuid(eventId)}`,
  sessionNotAfter: sessionId => `select not_after from auth.sessions where id=${uuid(sessionId)}`,
  expireSession: sessionId => `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${uuid(sessionId)}`,
  restoreSession: (sessionId, notAfter) => `update auth.sessions set not_after=${notAfter === null ? 'null' : q(notAfter)} where id=${uuid(sessionId)}`,
  deleteMessage: messageId => `delete from public.agreement_messages where id=${uuid(messageId)}`,
  insertClosureRequest: accountId => `insert into private.account_closure_requests(account_id,state,revision) values(${uuid(accountId)},'READY',1)`,
  deleteClosureRequest: accountId => `delete from private.account_closure_requests where account_id=${uuid(accountId)}`,
  groupMessageCount: groupId => `select count(*) from private.group_messages_v5 where group_id=${uuid(groupId)}`,
  groupVisibilityGranted: (messageId, accountId) => `select exists(select 1 from private.group_message_visibility_v5 where message_id=${uuid(messageId)} and account_id=${uuid(accountId)})`,
};

const U = '11111111-1111-4111-8111-111111111111', V = '22222222-2222-4222-8222-222222222222';
/** One sample call per builder (the grammar test parses every one of them; a builder without a sample fails the unit test). */
export const SQL_SAMPLES = {
  profileOf: [U, 'WORKER'],
  prepareWorkerProfile: [U],
  insertPublishedNeed: [{needId: U, requesterId: V, requesterProfileId: U, label: 'Sample label', slots: 3}],
  eventOfMessage: [U],
  deliveriesOfEvent: [U],
  insertPhotoUploadFixture: [{assetId: U, uploadId: V, accountId: U, agreementId: V, inputHash: 'a'.repeat(64), outputHash: 'b'.repeat(64)}],
  authenticatedStatement: [U, SQL.sendV2Statement(U, V, 'key-12345678', 'body')],
  sendV2Statement: [U, V, 'key-12345678', 'body'],
  isolatePushTransport: [],
  expireAttemptLease: [U],
  pauseSchedulers: [],
  insertHistoryFixture: [{agreementId: U, senderId: V, ids: [U, V], bodyPrefix: 'History fixture '}],
  messageCounts: [],
  notificationCounts: [],
  unreadMessageEventCount: [U, V],
  faultTriggerInstall: [],
  faultTriggerRemove: [],
  messageByKey: [U, 'ex05-key-12345678'],
  invalidationRevision: [U],
  readStateDigest: [],
  readStateInApp: [],
  attemptState: [U],
  deviceSessionId: [U],
  deactivateDevice: [U],
  reactivateDevice: [U],
  emitExecutionEvent: [U, V, 'p4-push:sample'],
  changeEventRecipient: [U, V],
  changeEventRole: [U, 'WORKER'],
  deleteEvent: [U],
  sessionNotAfter: [U],
  expireSession: [U],
  restoreSession: [U, null],
  deleteMessage: [U],
  insertClosureRequest: [U],
  deleteClosureRequest: [U],
  groupMessageCount: [U],
  groupVisibilityGranted: [U, V],
};
