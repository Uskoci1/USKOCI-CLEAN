// Disposable Chat B3 predecessor preparation only. SOURCE PREPARED / NOT RUN.
// Reuses PKG-050's local replay; never calls a push/provider/Edge handler.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {migrationSnapshotQuery} from '../pre_v3/history_snapshot.mjs';
const {assert, sql, rows, q, env} = rt;
// closure_runtime validates both loopback URLs before it creates any client.
const candidatePath = 'supabase/candidates/20260926175504_clean_notification_push_event_type.sql';
const predecessorPath = 'supabase/migrations/20260910193029_clean_n09_expo_push_transport.sql';
const signature = 'public.rpc_begin_push_send(uuid,uuid)';
const digest = (algorithm, value) => createHash(algorithm).update(value).digest('hex');
const closure = () => rows(`select private.closure_source_digest_v5() live,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) certificate,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
  private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5() binding,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition`)[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const pushRows = () => Object.fromEntries(['user_activity_events', 'notification_deliveries',
  'notification_push_devices', 'notification_push_attempts'].map(table => [table,
  sql(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.${table} t`)]));
const sourceBody = text => {
  const match = /create (?:or replace )?function public\.rpc_begin_push_send\([^]*?\bas (\$[a-z_]+\$)([^]*?)\1;/i.exec(text);
  assert.ok(match, 'PUSH_BEGIN_SOURCE_BODY_NOT_FOUND');
  return match[2].replaceAll('\r\n', '\n');
};
const functionState = () => rows(`select md5(replace(prosrc,E'\\r\\n',E'\\n')) body_md5,
  prosecdef,provolatile,proconfig,proacl,proowner from pg_proc where oid=to_regprocedure(${q(signature)})`)[0];
const acl = () => rows(`select has_function_privilege('anon',${q(signature)},'EXECUTE') anon,
  has_function_privilege('authenticated',${q(signature)},'EXECUTE') authenticated,
  has_function_privilege('service_role',${q(signature)},'EXECUTE') service_role`)[0];

await rt.prove('CHAT_B3_PREPARE_NOTIFICATION_A1', 'chat-b3-a1-preparation.json', async report => {
  report.providerCalls = 0; report.storageCalls = 0; report.pushSendCalled = false;
  report.requiredPredecessor = 'source147 + recorded dev_alpha/PKG replay through PKG-050; PKG-051 excluded';
  report.sourceArtifactHashes = {};
  for (const path of [candidatePath, predecessorPath, 'supabase/proofs/chat/prepare_notification_a1.mjs',
    '.github/workflows/chat-b3-history-proof.yml', 'supabase/proofs/pkg050/pkg050_proof.mjs',
    'supabase/proofs/pre_v3/closure_runtime.mjs', 'supabase/proofs/pre_v3/history_snapshot.mjs',
    'supabase/proofs/ru5_device_ui_local_guard.mjs', 'supabase/proofs/pkg023/pkg023_surface.sql']) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', env.GITHUB_SHA + ':' + path]), 'SOURCE_BYTES_DIFFER:' + path);
    report.sourceArtifactHashes[path] = digest('sha256', bytes);
  }
  const pkg050 = JSON.parse(readFileSync(rt.out + '/pkg050-report.json', 'utf8'));
  assert.equal(pkg050.result, 'PASS'); assert.equal(pkg050.sourceSha, env.GITHUB_SHA);
  assert.equal(pkg050.disposableOnly, true); assert.equal(pkg050.providerCalls, 0);
  for (const name of ['rpc_read_agreement_messages_page_v1', 'rpc_mark_displayed_agreement_messages_v1',
    'rpc_read_agreement_message_window_v1']) {
    assert.equal(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=${q(name)}`), '0', 'B3_MUST_NOT_ALREADY_EXIST');
  }
  const candidate = readFileSync(candidatePath, 'utf8');
  const before = surface(), certified = closure(), history = rows(migrationSnapshotQuery()), data = pushRows();
  report.closureBefore = certified;
  assert.equal(certified.ready, true); assert.equal(certified.live, certified.certificate.sha256);
  assert.equal(certified.live, certified.erasure.sha256); assert.equal(certified.live, certified.binding.sourceSha256);
  const expectedBefore = digest('md5', sourceBody(readFileSync(predecessorPath, 'utf8')));
  const expectedAfter = digest('md5', sourceBody(candidate));
  const beforeFunction = functionState();
  assert.ok(beforeFunction); assert.equal(beforeFunction.body_md5, expectedBefore, 'A1_PREDECESSOR_BODY_DRIFT');
  assert.equal(beforeFunction.prosecdef, true); assert.equal(beforeFunction.provolatile, 'v');
  assert.deepEqual(beforeFunction.proconfig, ['search_path=pg_catalog']);
  assert.deepEqual(acl(), {anon: false, authenticated: false, service_role: true});
  rt.pass(report, 'EXACT_SOURCE_BYTES_PKG050_AND_LOCAL_A1_PREDECESSOR');

  // This is disposable setup, not a new migration, recertification or DEV apply.
  sql('begin;\n' + candidate + "\ncommit;notify pgrst,'reload schema';");
  const afterFunction = functionState();
  assert.deepEqual(afterFunction, {...beforeFunction, body_md5: expectedAfter});
  assert.deepEqual(acl(), {anon: false, authenticated: false, service_role: true});
  const after = surface(), removed = before.filter(line => !after.includes(line)), added = after.filter(line => !before.includes(line));
  assert.equal(removed.length, 1); assert.equal(added.length, 1);
  for (const line of [...removed, ...added]) assert.ok(line.startsWith('function:public.rpc_begin_push_send('));
  assert.deepEqual(rows(migrationSnapshotQuery()), history); assert.deepEqual(pushRows(), data);
  assert.deepEqual(closure(), certified);
  report.beforeBodyMd5 = expectedBefore; report.afterBodyMd5 = expectedAfter;
  report.surface = {removed, added}; report.closureAfter = closure();
  report.historyUnchanged = true; report.pushRowsUnchanged = true;
  rt.pass(report, 'ONLY_A1_BEGIN_BODY_CHANGED_WITH_SERVICE_ONLY_ACL_UNCHANGED_DATA_HISTORY_AND_CERTIFICATE');
});
