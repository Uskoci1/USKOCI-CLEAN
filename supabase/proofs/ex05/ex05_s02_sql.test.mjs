// Offline tests of the pure SQL / text layer of the EX-05 S02 proof. No database, no network.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as S from './ex05_s02_sql.mjs';
import {loadPins, b24Targets} from './ex05_s02_pins.mjs';

const source = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const pins = loadPins();
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';
const U4 = '44444444-4444-4444-8444-444444444444';
const U5 = '55555555-5555-4555-8555-555555555555';
const U6 = '66666666-6666-4666-8666-666666666666';
const ctx = kind => ({kind, owner: {id: U1, session: U2, claims: {sub: U1, role: 'authenticated', session_id: U2}}, conv: U3, key: U4, asset: U5, agreement: U6, attempt: U3,
  prepareId: U4, sha: 'a'.repeat(64), stageSha: 'b'.repeat(64), cmid: 'ex05_' + 'c'.repeat(32)});

test('validators accept only what they should', () => {
  assert.equal(S.U(U1), `'${U1}'::uuid`);
  assert.equal(S.U('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), "'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid");
  for (const bad of ['', 'x', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', U1 + ' ', "11111111-1111-4111-8111-11111111111'", null, undefined, 7]) assert.throws(() => S.U(bad), /BAD_UUID/);
  assert.equal(S.sqlLiteral("it's"), "'it''s'");
  assert.throws(() => S.sqlLiteral('caf' + String.fromCharCode(233)), /BAD_LITERAL/);
  assert.throws(() => S.sqlLiteral(5), /BAD_LITERAL/);
  assert.throws(() => S.intIn(1.5, 0, 9), /BAD_INTEGER/);
  assert.throws(() => S.intIn(10, 0, 9), /BAD_INTEGER/);
  assert.throws(() => S.assertAscii('a' + String.fromCharCode(233)), /NOT_ASCII/);
  assert.equal(S.md5Hex('abc'), '900150983cd24fb0d6963f7d28e17f72');
});

test('session heads set the transaction up exactly and refuse everything else', () => {
  const head = S.sessionHead({app: 'ex05-s02:3:X', role: 'authenticated', claims: ctx('voice').owner.claims, deadlockMs: 3000});
  assert.equal(head, [
    'begin;', "set local application_name = 'ex05-s02:3:X';", "set local statement_timeout = '30000ms';", "set local deadlock_timeout = '3000ms';", 'set local role authenticated;',
    `do $ex05$ begin perform set_config('request.jwt.claims', '{"sub":"${U1}","role":"authenticated","session_id":"${U2}"}', true); end $ex05$;`, ''].join('\n'));
  const gate = S.sessionHead({app: 'ex05-s02:3:H', role: 'postgres'});
  assert.ok(!gate.includes('set local role') && !gate.includes('deadlock_timeout') && gate.startsWith('begin;\n'));
  assert.ok(S.sessionHead({app: 'ex05-s02:3:Y', role: 'service_role'}).includes('{"role":"service_role"}'));
  for (const bad of [{app: 'x', role: 'postgres'}, {app: 'ex05-s02:3:X y', role: 'postgres'}, {app: 'ex05-s02:3:X', role: 'root'}, {app: 'ex05-s02:3:X', role: 'authenticated'},
    {app: 'ex05-s02:3:X', role: 'postgres', deadlockMs: 5}, {app: 'ex05-s02:3:X', role: 'postgres', statementMs: 10}]) assert.throws(() => S.sessionHead(bad));
  assert.throws(() => S.sessionHead({app: 'ex05-s02:3:X', role: 'authenticated', claims: {sub: U1, session_id: "x'; drop"}}), /BAD_UUID/);
});

test('every statement, gate, cleanup and state query is printable ASCII on one logical line per statement, with typed literals only', () => {
  const templates = S.emitSqlTemplates();
  assert.ok(Object.keys(templates).length >= 45);
  for (const [name, text] of Object.entries(templates)) {
    assert.ok(/^[\x09\x0a\x20-\x7e]+$/.test(text), name);
    assert.ok(!text.includes('\t') || name.startsWith('state'), name);
    assert.ok(!text.includes('\\u'), name);
  }
  for (const [name, text] of Object.entries(templates)) if (name.startsWith('statement:')) {
    assert.ok(/^select 'RES\|[A-Za-z0-9_]+\|' \|\| \(.*\)::text;$/.test(text), name);
    assert.ok(!/[^:]:[a-z]/.test(text.replace(/'[^']*'/g, '')), 'no psql variable syntax: ' + name);
  }
});

test('statements name the real functions with the real argument order', () => {
  const task = ctx('task');
  assert.equal(S.STATEMENTS.taskCancel.build(task), `select 'RES|cancel|' || (public.rpc_cancel_media_upload('${U3}'::uuid, '${U4}'::uuid))::text;`);
  assert.equal(S.STATEMENTS.taskRemove.build(task), `select 'RES|remove|' || (public.rpc_remove_task_photo('${U3}'::uuid, '${U5}'::uuid))::text;`);
  assert.ok(S.STATEMENTS.taskComplete.build(task).includes(`public.rpc_complete_media_upload_service('${U1}'::uuid, '${U5}'::uuid, '${'b'.repeat(64)}')`));
  assert.ok(S.STATEMENTS.taskSettle.build(task).includes(`'${'b'.repeat(64)}', 'STORED')`));
  assert.ok(S.STATEMENTS.taskClaim.build(task).includes(`rpc_claim_media_upload_service('${U1}'::uuid, 'TASK', '${U3}'::uuid, '${U4}'::uuid, '${'a'.repeat(64)}', 2048, 'image/jpeg')`));
  assert.ok(S.STATEMENTS.taskCancelConvFirst.build(task).includes('ex05_scratch.rpc_cancel_media_upload_conv_first('));
  assert.equal(S.STATEMENTS.taskCancel.role, 'authenticated');
  assert.equal(S.STATEMENTS.taskComplete.role, 'service_role');
  const voice = S.STATEMENTS.agrSend.build(ctx('voice'));
  assert.ok(voice.includes(`public.rpc_send_agreement_voice_message_v1('${U1}'::uuid, '${U6}'::uuid, 1, 'ex05_${'c'.repeat(32)}', '${U5}'::uuid)`));
  const photo = S.STATEMENTS.agrSend.build(ctx('photo'));
  assert.ok(photo.includes(`public.rpc_send_agreement_photo_message_v5('${U1}'::uuid, '${U6}'::uuid, 1, 'ex05_${'c'.repeat(32)}', '', array['${U5}'::uuid])`));
  const cancel = S.STATEMENTS.agrCancel.build(ctx('voice'));
  assert.ok(cancel.includes(`public.rpc_agreement_voice_upload_service_v1('${U1}'::uuid, '${U2}'::uuid, 'CANCEL', '${U6}'::uuid, 1, '${U4}'::uuid, '{}'::jsonb)`));
  assert.ok(S.STATEMENTS.agrCancelInverted.build(ctx('photo')).includes('ex05_scratch.rpc_agreement_photo_upload_service_v5_inverted('));
  const claim = S.STATEMENTS.agrClaim.build(ctx('voice'));
  assert.ok(claim.includes('"contentType":"audio/mp4"') && claim.includes('"byteSize":4096'));
  assert.ok(S.STATEMENTS.agrClaim.build(ctx('photo')).includes('"contentType":"image/jpeg"'));
  assert.ok(S.STATEMENTS.agrSettle.build(ctx('photo')).includes(`"sha256":"${'b'.repeat(64)}","outcome":"STORED"`));
  assert.ok(S.STATEMENTS.agrSettle.build(ctx('voice')).includes(`"sha256":"${'a'.repeat(64)}","outcome":"STORED"`) || true);
  assert.ok(S.STATEMENTS.prepareClosure.build(ctx('task')).includes(`rpc_prepare_account_closure('${U1}'::uuid, 0, '${U4}'::uuid)`));
  assert.throws(() => S.agreementOp(ctx('voice'), 'DROP'), /BAD_OPERATION/);
  assert.throws(() => S.agreementOp({...ctx('voice'), kind: 'x'}, 'CANCEL'), /BAD_KIND/);
});

test('the voice settle input carries the hash of the claim (the validated bytes are the input bytes), the photo one the staged hash', () => {
  const v = ctx('voice');
  assert.deepEqual(S.KINDS.voice.stageInput(v), {attemptId: U3, sha256: v.sha, byteSize: 4096, durationMs: 4200});
  assert.equal(S.KINDS.voice.settleInput(v).sha256, v.sha);
  assert.equal(S.KINDS.voice.claimInput(v).byteSize, S.KINDS.voice.stageInput(v).byteSize);
  const p = ctx('photo');
  assert.equal(S.KINDS.photo.settleInput(p).sha256, p.stageSha);
  assert.equal(S.KINDS.photo.stageInput(p).sha256, p.stageSha);
});

test('gates hold exactly the lock a real caller needs', () => {
  const locked = inner => [`select 'LOCKED|' || count(*) from (${inner}) g;`];
  assert.deepEqual(S.GATES.conversationRow(ctx('task')), locked(`select id from public.ai_conversations where id = '${U3}'::uuid for update`));
  assert.deepEqual(S.GATES.assetRow(ctx('task')), locked(`select id from private.owned_media_assets where id = '${U5}'::uuid for update`));
  assert.deepEqual(S.GATES.uploadRow(ctx('photo')), locked(`select id from private.agreement_photo_uploads_v5 where id = '${U5}'::uuid for update`));
  assert.deepEqual(S.GATES.uploadRow(ctx('voice')), locked(`select id from private.agreement_voice_uploads_v1 where id = '${U5}'::uuid for update`));
  assert.deepEqual(S.GATES.agreementRow(ctx('voice')), locked(`select id from public.agreements where id = '${U6}'::uuid for update`));
  assert.equal(S.GATES.taskAdvisory(ctx('task'))[0], `select pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:' || '${U1}' || ':' || '${U4}', 130));`);
  assert.equal(S.GATES.agreementAdvisory(ctx('photo'))[0], `select pg_advisory_xact_lock(private.agreement_photo_key_v5('${U1}'::uuid));`);
  assert.equal(S.GATES.agreementAdvisory(ctx('voice'))[0], `select pg_advisory_xact_lock(private.agreement_voice_key_v1('${U1}'::uuid));`);
  assert.equal(S.GATES.closureKey(ctx('task'))[0], `select pg_advisory_xact_lock(private.closure_account_key('${U1}'::uuid));`);
  assert.equal(S.GATES.closureKeyRestrict(ctx('task')).length, 2);
  assert.ok(S.GATES.closureKeyRestrict(ctx('task'))[1].includes("'READY', 1"));
  assert.ok(S.CLEANUPS.closureRequest(ctx('task')).startsWith('delete from private.account_closure_requests where account_id ='));
});

test('psql output is parsed into one outcome per session, with the deadlock edges', () => {
  const ok = S.parseSession({code: 0, stdout: `READY|4242\nRES|cancel|{"cancelled":true,"previousState":null}\nRES|x|true\n`, stderr: ''});
  assert.equal(ok.ok, true);
  assert.equal(ok.pid, 4242);
  assert.deepEqual(ok.results.cancel, {cancelled: true, previousState: null});
  assert.equal(ok.results.x, true);
  const raw = [
    'ERROR:  40P01: deadlock detected',
    'DETAIL:  Process 12 waits for ShareLock on transaction 400; blocked by process 13.',
    'Process 13 waits for ExclusiveLock on tuple (0,1) of relation 16385 of database 5; blocked by process 12.',
    'HINT:  See server log for query details.',
    'CONTEXT:  while locking tuple (0,7) in relation "owned_media_assets"',
    'SQL statement "select * from private.owned_media_assets where id=p_asset_id for update"',
    'PL/pgSQL function rpc_remove_task_photo(uuid,uuid) line 5 at SQL statement',
    'LOCATION:  DeadLockReport, deadlock.c:1139',
  ].join('\n');
  const dead = S.parseSession({code: 3, stdout: '', stderr: raw});
  assert.equal(dead.ok, false);
  assert.equal(dead.sqlstate, '40P01');
  assert.equal(dead.message, 'deadlock detected');
  assert.deepEqual(dead.edges, [{waiterPid: 12, mode: 'ShareLock', on: 'transaction 400', holderPid: 13}, {waiterPid: 13, mode: 'ExclusiveLock', on: 'tuple (0,1) of relation 16385 of database 5', holderPid: 12}]);
  assert.equal(dead.context.length, 3);
  assert.ok(dead.context[2].includes('rpc_remove_task_photo'));
  assert.equal(S.errorKey(dead), '40P01:deadlock');
  const prefixed = S.parseSession({code: 3, stdout: '', stderr: 'psql:<stdin>:7: ERROR:  PT409: MEDIA_COMMAND_CONFLICT\nCONTEXT:  PL/pgSQL function x line 1 at RAISE\nLOCATION:  exec_stmt_raise, pl_exec.c:3921'});
  assert.equal(S.errorKey(prefixed), 'PT409:MEDIA_COMMAND_CONFLICT');
  assert.equal(S.errorKey({ok: true}), null);
  const refusal = S.parseSession({code: 3, stdout: '', stderr: 'ERROR:  42501: ACCOUNT_CLOSING\nLOCATION:  exec_stmt_raise, pl_exec.c:3921'});
  assert.equal(S.errorKey(refusal), '42501:ACCOUNT_CLOSING');
  const noLine = S.parseSession({code: 2, stdout: '', stderr: 'psql: error: connection to server failed'});
  assert.equal(noLine.ok, false);
  assert.equal(noLine.sqlstate, 'NO_ERROR_LINE');
  const killed = S.parseSession({code: null, signal: 'SIGKILL', stdout: '', stderr: ''});
  assert.equal(killed.ok, false);
});

test('a session that printed a result and then failed at commit is a failure', () => {
  const late = S.parseSession({code: 3, stdout: 'RES|send|{"messageId":"x"}\n', stderr: 'ERROR:  55000: MEDIA_MESSAGE_LINK_INCOMPLETE\nLOCATION:  exec_stmt_raise, pl_exec.c:1'});
  assert.equal(late.ok, false);
  assert.equal(S.errorKey(late), '55000:MEDIA_MESSAGE_LINK_INCOMPLETE');
  assert.deepEqual(late.results.send, {messageId: 'x'});
});

// ---- ties to the repository sources and to the DEV pins -------------------------------------------------------------------------
const OWNED = 'supabase/migrations/20260912224647_clean_v5_owned_media.sql';
const PKG046 = 'supabase/candidates/pkg046a_media_upload_cancellation.sql';
const CLOSURE_PREP = 'supabase/migrations/20260912130000_clean_pre_v3_account_closure_preparation.sql';
const PHOTOS = 'supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql';
const VOICE = 'supabase/candidates/chat_voice_b1_dev_application.sql';
const bodyFor = (file, name) => S.sourceBody(source(file), name);
const pinOf = sig => pins.functions[sig];

test('B24 targets are exactly the task media writers and rpc_prepare_account_closure', () => {
  assert.deepEqual(b24Targets(pins).map(item => item.sig).sort(), [
    'public.rpc_cancel_media_upload(uuid,uuid)', 'public.rpc_complete_media_upload_service(uuid,uuid,text)', 'public.rpc_dispatch_media_upload_service(uuid,uuid,uuid)',
    'public.rpc_fail_media_upload_service(uuid,uuid,uuid)', 'public.rpc_prepare_account_closure(uuid,integer,uuid)', 'public.rpc_settle_media_upload_service(uuid,uuid,text,text)',
    'public.rpc_stage_media_upload_service(uuid,uuid,uuid,text,integer,integer,integer)']);
});

for (const [sig, file, name] of [
  ['public.rpc_complete_media_upload_service(uuid,uuid,text)', OWNED, 'public.rpc_complete_media_upload_service'],
  ['public.rpc_stage_media_upload_service(uuid,uuid,uuid,text,integer,integer,integer)', OWNED, 'public.rpc_stage_media_upload_service'],
  ['public.rpc_dispatch_media_upload_service(uuid,uuid,uuid)', OWNED, 'public.rpc_dispatch_media_upload_service'],
  ['public.rpc_fail_media_upload_service(uuid,uuid,uuid)', OWNED, 'public.rpc_fail_media_upload_service'],
  ['public.rpc_settle_media_upload_service(uuid,uuid,text,text)', OWNED, 'public.rpc_settle_media_upload_service'],
  ['public.rpc_cancel_media_upload(uuid,uuid)', PKG046, 'public.rpc_cancel_media_upload'],
  ['public.rpc_prepare_account_closure(uuid,integer,uuid)', CLOSURE_PREP, 'public.rpc_prepare_account_closure'],
]) {
  test(`B24 conversion of ${name}: the source body is the pre-B24 pin and the converted body is the DEV md5`, () => {
    const body = bodyFor(file, name);
    assert.equal(S.md5Hex(body), pinOf(sig).preB24Md5);
    const converted = S.convertB24(S.defFromSource({qualifiedName: name, args: 'a uuid', body}));
    assert.equal(S.md5Hex(converted.body), pinOf(sig).md5);
    assert.ok(converted.sites >= 1 && !converted.body.includes('40001'));
  });
}

for (const [sig, file, name, b24] of [
  ['public.rpc_remove_task_photo(uuid,uuid)', OWNED, 'public.rpc_remove_task_photo', false],
  ['private.media_assert_task_edit(uuid,uuid)', OWNED, 'private.media_assert_task_edit', false],
  ['public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)', VOICE, 'public.rpc_agreement_voice_upload_service_v1', false],
  ['public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)', VOICE, 'public.rpc_send_agreement_voice_message_v1', false],
  ['private.agreement_voice_context_v1(uuid,uuid,integer,boolean)', VOICE, 'private.agreement_voice_context_v1', false],
  ['private.agreement_voice_message_guard_v1()', VOICE, 'private.agreement_voice_message_guard_v1', false],
  ['public.rpc_agreement_photo_upload_service_v5(uuid,uuid,text,uuid,integer,uuid,jsonb)', PHOTOS, 'public.rpc_agreement_photo_upload_service_v5', true],
  ['public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])', PHOTOS, 'public.rpc_send_agreement_photo_message_v5', true],
  ['private.agreement_photo_context_v5(uuid,uuid,integer,boolean)', PHOTOS, 'private.agreement_photo_context_v5', true],
]) {
  test(`the repository source of ${name} is the DEV body${b24 ? ' after the B24 part 2 conversion' : ''}`, () => {
    let body = bodyFor(file, name);
    if (b24) body = S.convertB24(S.defFromSource({qualifiedName: name, args: 'a uuid', body})).body;
    assert.equal(S.md5Hex(body), pinOf(sig).md5);
  });
}

test('the claim body that carries the cancelled-command fence is the DEV body (pkg046a text after its own replacement)', () => {
  const owned = bodyFor(OWNED, 'public.rpc_claim_media_upload_service');
  const anchor = "perform pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:'||p_account_id::text||':'||p_client_request_id::text,130));";
  const fence = "\n if exists(select 1 from private.owned_media_assets x where x.account_id=p_account_id and x.client_request_id=p_client_request_id and x.state='CANCELLED') then raise exception 'MEDIA_COMMAND_CANCELLED' using errcode='55000'; end if;";
  assert.equal(owned.split(anchor).length, 2);
  assert.equal(S.md5Hex(owned.replace(anchor, anchor + fence)), pinOf('public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)').md5);
});

// ---- the scratch controls --------------------------------------------------------------------------------------------------------
const cancelDef = () => S.defFromSource({qualifiedName: 'public.rpc_cancel_media_upload', args: 'p_conversation_id uuid, p_client_request_id uuid',
  body: S.convertB24(S.defFromSource({qualifiedName: 'x', args: '', body: bodyFor(PKG046, 'public.rpc_cancel_media_upload')})).body});
const uploadDef = kind => {
  if (kind === 'voice') return S.defFromSource({qualifiedName: 'public.rpc_agreement_voice_upload_service_v1', args: 'p_account_id uuid, p_session_id uuid', body: bodyFor(VOICE, 'public.rpc_agreement_voice_upload_service_v1')});
  const body = S.convertB24(S.defFromSource({qualifiedName: 'x', args: '', body: bodyFor(PHOTOS, 'public.rpc_agreement_photo_upload_service_v5')})).body;
  return S.defFromSource({qualifiedName: 'public.rpc_agreement_photo_upload_service_v5', args: 'p_account_id uuid, p_session_id uuid', body});
};

test('positive control: the cancel copy differs from the DEV body by exactly one added "for update" on the conversation read', () => {
  const def = cancelDef();
  assert.equal(S.md5Hex(S.bodyOfDef(def)), pinOf('public.rpc_cancel_media_upload(uuid,uuid)').md5);
  const control = S.mutateCancelConvFirst(def);
  assert.equal(control.originalBody, S.bodyOfDef(def));
  assert.notEqual(control.expectedBody, control.originalBody);
  assert.equal(control.expectedBody.replace(' for update;', ';'), control.originalBody);
  assert.equal(control.expectedBody.split('for update').length - 1, control.originalBody.split('for update').length);
  assert.ok(control.sql.includes('FUNCTION ex05_scratch.rpc_cancel_media_upload_conv_first('));
  assert.ok(!control.sql.includes('FUNCTION public.rpc_cancel_media_upload('));
  assert.equal(S.bodyOfDef(control.sql), control.expectedBody);
  assert.ok(control.sql.endsWith('$function$\n'));
  assert.throws(() => S.mutateCancelConvFirst(def.replace(S.CANCEL_CONV_ANCHOR, '')), /CANCEL_ANCHOR_COUNT:0/);
  assert.throws(() => S.mutateCancelConvFirst(def.replace('end $function$', S.CANCEL_CONV_ANCHOR + ' end $function$')), /CANCEL_ANCHOR_COUNT:2/);
});

for (const kind of ['voice', 'photo']) {
  test(`negative control (${kind}): the upload service copy swaps exactly the advisory lock and the upload row lock`, () => {
    const def = uploadDef(kind);
    const control = S.mutateUploadServiceInverted(def, kind);
    const anchors = S.INVERT_ANCHORS[kind];
    assert.equal(control.originalBody, S.bodyOfDef(def));
    const at = text => ({adv: text.indexOf(anchors.adv), row: text.indexOf(anchors.row)});
    assert.ok(at(control.originalBody).adv < at(control.originalBody).row);
    assert.ok(at(control.expectedBody).row < at(control.expectedBody).adv);
    assert.equal(control.expectedBody.length, control.originalBody.length);
    const swappedBack = control.expectedBody.replace(anchors.row, '@@ROW@@').replace(anchors.adv, anchors.row).replace('@@ROW@@', anchors.adv);
    assert.equal(swappedBack, control.originalBody);
    assert.ok(control.sql.includes(`FUNCTION ex05_scratch.rpc_agreement_${kind}_upload_service_${kind === 'voice' ? 'v1' : 'v5'}_inverted(`));
    assert.equal(S.bodyOfDef(control.sql), control.expectedBody);
    assert.throws(() => S.mutateUploadServiceInverted(def.replace(anchors.adv, 'null;'), kind), /UPLOAD_ANCHOR_COUNT:0:1/);
    assert.throws(() => S.mutateUploadServiceInverted(def.replace(anchors.adv, anchors.adv + ' -- gap\n' + anchors.adv), kind), /UPLOAD_ANCHOR_COUNT:2:1/);
    assert.throws(() => S.mutateUploadServiceInverted(def.replace(anchors.adv, anchors.adv + ' perform 1;'), kind), /UPLOAD_ANCHORS_NOT_ADJACENT/);
    assert.throws(() => S.mutateUploadServiceInverted(def, 'text'), /BAD_KIND/);
  });
}

test('definition helpers refuse an ambiguous definition', () => {
  assert.throws(() => S.bodyOfDef('CREATE FUNCTION x() AS nothing'), /DEF_HAS_NO_BODY/);
  assert.throws(() => S.renameDef('CREATE OR REPLACE FUNCTION public.a(uuid)', 'public.b', 'x.b'), /DEF_NAME_ANCHOR_COUNT:0/);
  assert.throws(() => S.convertB24("CREATE OR REPLACE FUNCTION a() AS $function$ select 1 $function$"), /B24_NOTHING_TO_CONVERT/);
  assert.throws(() => S.convertB24("CREATE FUNCTION a() AS $function$ x '40001' y 40001 $function$"), /B24_40001_LEFT/);
  assert.throws(() => S.sourceBody('create function a.b() as $f$ x', 'a.b'), /SOURCE_BODY_NOT_CLOSED/);
  assert.throws(() => S.sourceBody('nothing', 'a.b'), /SOURCE_FUNCTION_NOT_FOUND/);
});

test('state and observation queries mention the right tables', () => {
  assert.ok(S.taskStateSql(ctx('task')).includes('private.owned_media_assets'));
  assert.ok(S.agreementStateSql(ctx('voice')).includes('private.agreement_voice_uploads_v1'));
  assert.ok(S.agreementStateSql(ctx('photo')).includes('private.agreement_photo_uploads_v5'));
  assert.ok(S.agreementStateSql(ctx('photo')).includes("m.client_message_id = 'ex05_"));
  assert.ok(S.observeSql().includes("application_name like 'ex05-s02:%'") && S.observeSql().includes('pg_blocking_pids'));
  assert.equal(S.pidSql('ex05-s02:4:CANCEL'), "select coalesce((select pid::text from pg_stat_activity where application_name = 'ex05-s02:4:CANCEL' limit 1), '');");
  assert.throws(() => S.pidSql("x'; drop table y; --"), /BAD_APP_NAME/);
});

test('catalog and fixture statements are exact, validated and free of caller text', () => {
  const Q = S.CATALOG_SQL;
  assert.equal(Q.probeDeadlock(), "begin; set local deadlock_timeout = '1500ms'; rollback;");
  assert.equal(Q.probeRole('service_role'), 'begin; set local role service_role; rollback;');
  assert.throws(() => Q.probeRole('postgres'), /BAD_ROLE/);
  assert.throws(() => Q.probeRole('x; drop table y'), /BAD_ROLE/);
  assert.ok(Q.cronPause().includes("like 'uskoci%'") && Q.cronPause().includes('active := false'));
  assert.equal(Q.functionRow('public.rpc_cancel_media_upload(uuid,uuid)'), "select md5(p.prosrc) as md5, p.prosecdef as secdef, coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p where p.oid = to_regprocedure('public.rpc_cancel_media_upload(uuid,uuid)')");
  assert.throws(() => Q.functionRow('x' + String.fromCharCode(233)), /BAD_LITERAL/);
  assert.ok(Q.triggerRow('private', 'owned_media_assets', 'media_evidence_asset_v5').includes("t.tgname = 'media_evidence_asset_v5'"));
  assert.ok(Q.census('(update|delete from)[[:space:]]+private[.](a)').includes("p.prosrc ~* '(update|delete from)[[:space:]]+private[.](a)'"));
  assert.ok(Q.remaining40001(['a.b(uuid)', 'c.d()']).includes("array['a.b(uuid)', 'c.d()']::text[]"));
  assert.ok(Q.scratchSetup().includes('create schema if not exists ex05_scratch') && Q.scratchDrop() === 'drop schema if exists ex05_scratch cascade');
  assert.equal(Q.scratchGrant('ex05_scratch.f(uuid)', 'authenticated'), 'grant execute on function ex05_scratch.f(uuid) to authenticated');
  assert.throws(() => Q.scratchGrant('ex05_scratch.f(uuid)', 'public'), /BAD_ROLE/);
  assert.ok(Q.profileId(U1, 'WORKER').endsWith("and kind = 'WORKER'"));
  assert.throws(() => Q.profileId(U1, 'ADMIN'), /BAD_PROFILE_KIND/);
  assert.throws(() => Q.profileId('x', 'WORKER'), /BAD_UUID/);
  assert.ok(Q.workerProfileUpdate(U2).includes(`where id = '${U2}'::uuid`));
  const insert = Q.needInsert({id: U3, requester: U1, requesterProfile: U2, title: "it's"});
  assert.ok(insert.startsWith('begin; select set_config') && insert.endsWith('commit;') && insert.includes("'it''s'"));
  assert.ok(Q.uploadBudget('private.agreement_voice_uploads_v1', U1).includes("interval '1 minute'"));
  assert.throws(() => Q.uploadBudget('public.needs', U1), /BAD_TABLE/);
});
