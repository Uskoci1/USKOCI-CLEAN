// EX05-S01 offline unit tests of the fixed SQL snippets the proofs run (lib/sql_snippets.mjs): identifier safety, parameter wiring and sample coverage.
// The grammar check of every snippet is in sql_syntax.test.mjs (pglast). The column names are copied from statements that already ran green in the frozen proofs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SQL, SQL_SAMPLES} from './sql_snippets.mjs';

const U = '11111111-1111-4111-8111-111111111111', V = '22222222-2222-4222-8222-222222222222';

test('every snippet builder has a sample call and every sample names a builder', () => {
  assert.deepEqual(Object.keys(SQL).sort(), Object.keys(SQL_SAMPLES).sort());
  for (const [name, args] of Object.entries(SQL_SAMPLES)) assert.equal(typeof SQL[name](...args), 'string', name);
});

test('an identifier that is not a UUID, or a number that is not an integer, is refused before any SQL is built', () => {
  assert.throws(() => SQL.eventOfMessage("x'; drop table y; --"), /SQL_UUID_REQUIRED/);
  assert.throws(() => SQL.deliveriesOfEvent(null), /SQL_UUID_REQUIRED/);
  assert.throws(() => SQL.insertPublishedNeed({needId: U, requesterId: U, requesterProfileId: U, label: 'x', slots: 1.5}), /SQL_INTEGER_REQUIRED/);
  assert.throws(() => SQL.insertPublishedNeed({needId: U, requesterId: U, requesterProfileId: U, label: 'x', slots: '3; drop'}), /SQL_INTEGER_REQUIRED/);
});

test('text literals are quoted and a single quote cannot end a literal early', () => {
  const sql = SQL.insertPublishedNeed({needId: U, requesterId: V, requesterProfileId: U, label: "it's a label", slots: 3});
  assert.ok(sql.includes("'it''s a label'"));
  assert.ok(sql.includes("required_slots") && sql.includes(',3,'));
  assert.ok(sql.startsWith("begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);") && sql.trimEnd().endsWith('commit;'));
});

test('the authenticated statement wraps the call in a role switch with the JWT claims of that account only', () => {
  const sql = SQL.authenticatedStatement(U, SQL.sendV2Statement(U, V, 'key-12345678', "body 'x'"));
  assert.ok(sql.startsWith('begin;set local role authenticated;'));
  assert.ok(sql.includes("set_config('request.jwt.claim.sub','" + U + "',true)"));
  assert.ok(sql.includes('"role":"authenticated"') && sql.includes('"sub":"' + U + '"'));
  assert.ok(sql.includes("select public.rpc_send_agreement_message_v2('" + U + "','" + V + "','key-12345678','body ''x''')"));
  assert.ok(sql.trimEnd().endsWith('commit;'));
});

test('the photo upload fixture row binds the account, the agreement, the asset path and the settled state', () => {
  const sql = SQL.insertPhotoUploadFixture({assetId: U, uploadId: V, accountId: U, agreementId: V, inputHash: 'a'.repeat(64), outputHash: 'b'.repeat(64)});
  assert.ok(sql.includes('private.agreement_photo_uploads_v5'));
  assert.ok(sql.includes("'READY'") && sql.includes("'SETTLED','STORED'"));
  assert.ok(sql.includes(U + '/agreement-v5/' + U + '/' + 'b'.repeat(64) + '.jpg'));
});

test('the push isolation statement closes every PUSH delivery and every attempt, and nothing else', () => {
  const sql = SQL.isolatePushTransport();
  assert.ok(sql.includes("update public.notification_deliveries set state='SUPPRESSED',suppression_reason='SYNTHETIC_FIXTURE_ISOLATION'"));
  assert.ok(sql.includes("where channel='PUSH'"));
  assert.ok(sql.includes("update public.notification_push_attempts set transport_state='FINAL'"));
  assert.ok(!/delete|drop|truncate/i.test(sql));
});

test('the scheduler pause deactivates every active cron job inside a bounded transaction', () => {
  const sql = SQL.pauseSchedulers();
  assert.ok(sql.includes("set local lock_timeout='5s'") && sql.includes('cron.alter_job') && sql.includes('active:=false'));
});

test('the history fixture inserts one row per supplied UUID with tied microsecond timestamps', () => {
  const ids = [U, V];
  const sql = SQL.insertHistoryFixture({agreementId: U, senderId: V, ids, bodyPrefix: 'History fixture '});
  assert.ok(sql.includes("array['" + U + "','" + V + "']::uuid[]") && sql.includes('with ordinality'));
  assert.ok(sql.includes("interval '1 microsecond'"));
  assert.throws(() => SQL.insertHistoryFixture({agreementId: U, senderId: V, ids: [], bodyPrefix: 'x'}), /SQL_IDS_REQUIRED/);
});
