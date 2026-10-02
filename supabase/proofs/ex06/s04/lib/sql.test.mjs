// EX-06 S04: offline tests of the SQL builders (no database). node --test supabase/proofs/ex06/s04/lib/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {READ_BUILDERS, SCHEMA_CONTRACT, WRITE_BUILDERS, quote, schemaColumnsSql} from './sql.mjs';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const SAMPLE = {
  needId: ID, profileId: ID2, accountId: ID2, a: ID, b: ID2, deliveryId: ID, needIds: [ID, ID2], revision: 2, at: '2026-10-02T10:00:00.000Z', deliveryIds: [ID, ID2],
  signature: 'private.push_suppression(public.notification_deliveries)',
};

test('quote doubles single quotes and wraps the text (the same contract as the proof adapter q)', () => {
  assert.equal(quote("a'b"), "'a''b'");
  assert.equal(quote(5), "'5'");
  assert.equal(quote("'; drop table x; --"), "'''; drop table x; --'");
});

test('every builder produces ASCII, LF only, no tab, no unicode escape text, no backslash', () => {
  const all = [...Object.entries(READ_BUILDERS), ...Object.entries(WRITE_BUILDERS)];
  assert.ok(all.length >= 20, 'the builders exist: ' + all.length);
  for (const [name, build] of all) {
    const text = build(SAMPLE);
    assert.equal(typeof text, 'string', name);
    assert.ok(text.trim().length > 20, name + ' is not empty');
    assert.match(text, /^[\x20-\x7e\n]+$/, name + ' is printable ASCII plus LF only');
    assert.ok(!text.includes('\t') && !text.includes('\r'), name + ' has no tab and no CR');
    assert.ok(!/\\u[0-9a-fA-F]{4}/.test(text) && !text.includes('\\'), name + ' has no unicode escape text and no backslash');
  }
});

test('every identifier goes through quote: a hostile id cannot leave its literal', () => {
  const hostile = "x'; select pg_sleep(100); --";
  const sample = {...SAMPLE, needId: hostile, profileId: hostile, accountId: hostile, a: hostile, b: hostile, deliveryId: hostile, needIds: [hostile], deliveryIds: [hostile], at: hostile, signature: hostile};
  for (const [name, build] of [...Object.entries(READ_BUILDERS), ...Object.entries(WRITE_BUILDERS)]) {
    const text = build(sample);
    assert.ok(!text.includes(hostile), name + ' never embeds the raw hostile text');
  }
});

test('read builders contain no write verb', () => {
  for (const [name, build] of Object.entries(READ_BUILDERS)) {
    const text = build(SAMPLE).toLowerCase();
    assert.ok(!/\b(insert|update|delete|truncate|drop|alter|create)\b/.test(text), name + ' must be read-only: ' + text.slice(0, 120));
  }
});

test('write builders are labelled fixtures on the disposable chain and say which writes they make', () => {
  const names = Object.keys(WRITE_BUILDERS);
  for (const name of names) assert.match(name, /Fixture|Isolation|[Dd]uplicate/, name + ' is named as a fixture, an isolation write or a duplicate-insert probe');
  assert.match(WRITE_BUILDERS.closureFixture(SAMPLE), /insert into private\.account_closure_requests\(account_id, state, revision\) values \('22222222-2222-4222-8222-222222222222'::uuid, 'READY', 1\)/);
  assert.match(WRITE_BUILDERS.retireNeedsIsolation(SAMPLE), /session_replication_role = replica/);
  assert.match(WRITE_BUILDERS.retireNeedsIsolation(SAMPLE), /set status = 'CANCELLED'/);
  assert.match(WRITE_BUILDERS.republishFixture(SAMPLE), /set_config\('uskoci\.need_lifecycle', 'PUBLISH', true\)/);
  assert.match(WRITE_BUILDERS.republishFixture(SAMPLE), /status = 'DRAFT'/);
  assert.match(WRITE_BUILDERS.duplicateDeliveryInsert(SAMPLE), /insert into public\.opportunity_deliveries/);
  assert.match(WRITE_BUILDERS.duplicateDeliveryOnConflict(SAMPLE), /on conflict do nothing returning id/);
  assert.match(WRITE_BUILDERS.deleteOtherSchedulesIsolation(SAMPLE), /where need_id <> '11111111-1111-4111-8111-111111111111'::uuid/);
  assert.match(WRITE_BUILDERS.retireAllNeedsIsolation(), /update public\.needs set status = 'CANCELLED' where status in \('DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE'\)/);
  assert.match(WRITE_BUILDERS.retireAllNeedsIsolation(), /delete from private\.dispatch_schedule/);
  assert.match(WRITE_BUILDERS.responseDeadlineFixture(SAMPLE), /set response_deadline = '2026-10-02T10:00:00.000Z'::timestamptz where id = '11111111-1111-4111-8111-111111111111'::uuid/);
  assert.match(WRITE_BUILDERS.responseDeadlineFixture(SAMPLE), /session_replication_role = replica/);
});

test('the ledger reads select exactly the columns the observers use', () => {
  assert.match(READ_BUILDERS.needState(SAMPLE), /n\.approximate_city, n\.task_timezone\s+from public\.needs n where n\.id = /);
  assert.match(READ_BUILDERS.deliveries(SAMPLE), /select d\.worker_account_id, d\.worker_profile_id, d\.need_revision, d\.status, d\.match_score::float8 as match_score, d\.expires_at, d\.created_at, r\.round_no, r\.status as round_status, r\.stop_reason/);
  assert.match(READ_BUILDERS.opportunityNotifications(SAMPLE), /left join public\.notification_deliveries n on n\.event_id = e\.id/);
  assert.match(READ_BUILDERS.opportunityNotifications(SAMPLE), /e\.event_type = 'OPPORTUNITY_AVAILABLE'/);
  assert.match(READ_BUILDERS.pushSuppression(SAMPLE), /coalesce\(private\.push_suppression\(d\), '<null>'\)/);
  assert.match(READ_BUILDERS.cheapGate(SAMPLE), /private\.dispatch_cheap_candidate_admitted\('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid\)/);
  assert.match(READ_BUILDERS.emitEventReplay(SAMPLE), /'opp:11111111-1111-4111-8111-111111111111:2:22222222-2222-4222-8222-222222222222'/);
  assert.match(READ_BUILDERS.functionBody(SAMPLE), /replace\(p\.prosrc, chr\(13\), ''\) as body from pg_proc p where p\.oid = 'private\.push_suppression\(public\.notification_deliveries\)'::regprocedure/);
});

test('the material snapshot carries exactly the 22 keys rpc_confirm_need_edit demands (no more, no fewer)', () => {
  const text = READ_BUILDERS.materialSnapshot(SAMPLE);
  const keys = [...text.matchAll(/'([A-Za-z]+)', /g)].map(match => match[1]);
  const wanted = ['title', 'description', 'category', 'requiredSlots', 'mode', 'requesterPriceRsd', 'requiredSkills', 'requiredTools', 'requiredVehicles', 'requiredLicenses', 'minimumExperienceYears',
    'verifiedIdentityRequired', 'scheduleKind', 'startsAt', 'endsAt', 'executionLocationMode', 'approximateLat', 'approximateLng', 'approximateCity', 'approximateArea', 'publicPhotoPaths', 'privateLocation'];
  assert.deepEqual(keys.sort(), [...wanted].sort());
  assert.equal(wanted.length, 22);
  assert.match(text, /'privateLocation', 'null'::jsonb/);
});

test('the schema contract names every table the builders read or write, with columns, and the query asks for exactly those', () => {
  const tables = Object.keys(SCHEMA_CONTRACT);
  assert.ok(tables.includes('public.needs') && tables.includes('public.opportunity_deliveries') && tables.includes('private.dispatch_schedule'));
  for (const table of tables) {
    assert.match(table, /^(public|private)\.[a-z_]+$/);
    assert.ok(SCHEMA_CONTRACT[table].length >= 2, table);
    assert.equal(new Set(SCHEMA_CONTRACT[table]).size, SCHEMA_CONTRACT[table].length, table + ' has no duplicate column');
  }
  const query = schemaColumnsSql();
  for (const table of tables) assert.ok(query.includes(`('${table.split('.')[0]}', '${table.split('.')[1]}')`), table + ' is asked for');
  // every table the builders touch is in the contract
  const touched = new Set();
  for (const build of [...Object.values(READ_BUILDERS), ...Object.values(WRITE_BUILDERS)]) {
    for (const match of build(SAMPLE).matchAll(/\b(?:from|join|into|update)\s+((?:public|private)\.[a-z_]+)/g)) touched.add(match[1]);
  }
  for (const table of touched) assert.ok(tables.includes(table), table + ' is touched by a builder but missing from the schema contract');
});

test('every column a builder names on a contract table is in the contract (alias.column references of the ledger reads)', () => {
  const aliases = {needs: {n: 'public.needs'}};
  const text = READ_BUILDERS.needState(SAMPLE);
  for (const match of text.matchAll(/\bn\.([a-z_]+)/g)) assert.ok(SCHEMA_CONTRACT[aliases.needs.n].includes(match[1]), 'needs.' + match[1]);
  const rounds = READ_BUILDERS.deliveries(SAMPLE);
  for (const match of rounds.matchAll(/\bd\.([a-z_]+)/g)) assert.ok(SCHEMA_CONTRACT['public.opportunity_deliveries'].includes(match[1]), 'opportunity_deliveries.' + match[1]);
  for (const match of rounds.matchAll(/\br\.([a-z_]+)/g)) assert.ok(SCHEMA_CONTRACT['public.dispatch_rounds'].includes(match[1]), 'dispatch_rounds.' + match[1]);
  const notes = READ_BUILDERS.opportunityNotifications(SAMPLE);
  for (const match of notes.matchAll(/\be\.([a-z_]+)/g)) assert.ok(SCHEMA_CONTRACT['public.user_activity_events'].includes(match[1]), 'user_activity_events.' + match[1]);
  for (const match of notes.matchAll(/\bn\.([a-z_]+)/g)) assert.ok(SCHEMA_CONTRACT['public.notification_deliveries'].includes(match[1]), 'notification_deliveries.' + match[1]);
});
