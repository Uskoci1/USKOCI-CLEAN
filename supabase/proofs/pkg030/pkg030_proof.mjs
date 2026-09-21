// PKG-030 proof: the Edge workers take the server key on the apikey header, so the scheduled tick can reach them on a
// project whose server key is a secret key (sb_secret_), as canonical DEV's is. No hosted secret and no hosted target.
//
//   gate <root> <before|after>
//           no database. The three workers, compiled from <root> exactly as they are deployed, run in an environment
//           shaped like canonical DEV's (the server key is a secret key). Each is asked with every way a caller can
//           present a key, and must answer exactly the recorded table. "before" is the source canonical DEV runs
//           today; "after" differs from it in one row only: the secret key on apikey is accepted.
//   replay  after pkg029's replay (the workflow runs it first): the five PKG-029 rows from the exact text canonical DEV
//           recorded, until the tick and everything it reads have their canonical DEV bodies
//   before  the tick sends the key as "Authorization: Bearer"
//   apply   a tampered pin is refused and leaves nothing behind; the candidate applies; a second application is
//           refused; the surface changes by the tick only; the certified closure source does not move
//   after   the tick sends the key on apikey and nothing else about it changed
//   e2e     the real workers served with JWT verification off, as they are deployed after PKG-030: without a key each
//           worker refuses by itself; a signed-in person still reaches the export worker's own path and a stranger
//           does not; with the right key on apikey a confirmed deletion is carried to CLOSED by the cron-fired tick
//           alone, and the push and export workers accept exactly what the tick sends
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomBytes, randomUUID, webcrypto} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';

const mode = process.argv[2];
const out = process.env.PRE_V3_ARTIFACT_DIR;
assert.ok(out, 'PRE_V3_ARTIFACT_DIR');
mkdirSync(out, {recursive: true});
const sha256 = x => createHash('sha256').update(x).digest('hex');
const reportPath = `${out}/pkg030-report.json`;
const report = JSON.parse(existsSync(reportPath) ? readFileSync(reportPath, 'utf8') :
  JSON.stringify({package: 'PKG-030', sourceSha: process.env.GITHUB_SHA ?? null, disposableDbOnly: true,
    canonicalDevAccess: false, providerCalls: false, deviceTest: false, checks: []}));
const pass = name => { report.checks.push({mode, name, result: 'PASS'}); console.log('PASS ' + name); };
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 1) + '\n');

// ---------------------------------------------------------------------------------------------------------
// gate: no database, no network. Every outgoing request is answered by the table below and recorded.
// ---------------------------------------------------------------------------------------------------------
if (mode === 'gate') {
  const root = resolve(process.argv[3] ?? '.'), side = process.argv[4];
  assert.ok(['before', 'after'].includes(side), 'gate <root> <before|after>');
  const ts = (await import('typescript')).default;
  const FILES = {
    shared: 'supabase/functions/_shared/data-export.ts',
    push: 'supabase/functions/uskoci-push-transport/index.ts',
    exportWorker: 'supabase/functions/uskoci-data-export-worker/index.ts',
    closureStep: 'supabase/functions/uskoci-account-closure-worker/closure.ts',
    closure: 'supabase/functions/uskoci-account-closure-worker/index.ts',
  };
  const compiled = {}, hashes = {};
  for (const [name, path] of Object.entries(FILES)) {
    const bytes = readFileSync(resolve(root, path));
    hashes[path] = sha256(bytes);
    const result = ts.transpileModule(bytes.toString('utf8'), {fileName: path, reportDiagnostics: true,
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}});
    assert.deepEqual(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error), [], path);
    compiled[name] = result.outputText;
  }

  // Shaped like canonical DEV: the server key is a secret key, the anon key a publishable key. All synthetic.
  const token = n => randomBytes(n * 2).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, n);
  const jwt = payload => [{alg: 'HS256', typ: 'JWT'}, payload].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.' + token(43);
  const SECRET = `sb_secret_${token(22)}_${token(8)}`, PUBLISHABLE = `sb_publishable_${token(22)}_${token(8)}`;
  const LEGACY = jwt({iss: 'supabase', ref: 'synthetic', role: 'service_role', iat: 1787654535, exp: 2103230535});
  const PERSON = jwt({sub: randomUUID(), role: 'authenticated', aal: 'aal1'});
  assert.ok(SECRET.length > 30 && PUBLISHABLE.length > 30);
  const ORIGIN = 'https://synthetic.supabase.co';
  const ENV = {SUPABASE_URL: ORIGIN, SUPABASE_ANON_KEY: PUBLISHABLE, SUPABASE_SERVICE_ROLE_KEY: SECRET,
    USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED: 'true'};
  const label = v => v === null ? null : v === SECRET ? 'SECRET' : v === 'Bearer ' + SECRET ? 'Bearer SECRET'
    : v === PUBLISHABLE ? 'PUBLISHABLE' : v === 'Bearer ' + PERSON ? 'Bearer PERSON' : v === 'Bearer ' + LEGACY ? 'Bearer LEGACY' : 'OTHER';
  const reply = (x, status = 200) => new Response(JSON.stringify(x), {status, headers: {'content-type': 'application/json'}});
  // What the project answers. Auth refuses every token it is shown here (canonical DEV's Auth refused the legacy
  // service JWT: "missing sub claim"); a queue with no work answers NONE or [].
  const ANSWERS = {
    '/auth/v1/user': () => reply({code: 403, error_code: 'bad_jwt'}, 403),
    '/rest/v1/rpc/rpc_list_account_closure_work_service': () => reply([]),
    '/rest/v1/rpc/rpc_claim_data_export': () => reply({kind: 'NONE'}),
    '/rest/v1/rpc/rpc_claim_data_export_cleanup': () => reply({kind: 'NONE'}),
  };
  const load = (worker, calls) => {
    let handler;
    const fetch = async (url, init = {}) => {
      const u = new URL(url), h = new Headers(init.headers);
      calls.push({origin: u.origin, path: u.pathname, apikey: label(h.get('apikey')), authorization: label(h.get('authorization'))});
      if (!ANSWERS[u.pathname]) throw new Error('UNEXPECTED_REQUEST ' + u.pathname);
      return ANSWERS[u.pathname]();
    };
    const refuseLog = () => { throw new Error('WORKER_LOGGED'); };
    const context = vm.createContext({Request, Response, Headers, URL, TextEncoder, TextDecoder, ReadableStream, AbortController,
      crypto: webcrypto, Date, setTimeout, clearTimeout, fetch, console: {log: refuseLog, warn: refuseLog, error: refuseLog},
      Deno: {env: {get: k => ENV[k]}, serve: f => { assert.equal(handler, undefined); handler = f; }}});
    const run = (code, require) => new vm.Script(`(function(exports,require){${code}\nreturn exports;})`).runInContext(context)({}, require);
    const none = n => { throw new Error('UNDECLARED_IMPORT ' + n); };
    if (worker === 'push') run(compiled.push, none);
    else {
      const shared = run(compiled.shared, none);
      if (worker === 'export') run(compiled.exportWorker, n => { assert.equal(n, '../_shared/data-export.ts'); return shared; });
      else {
        const step = run(compiled.closureStep, n => { assert.equal(n, '../_shared/data-export.ts'); return shared; });
        run(compiled.closure, n => n === './closure.ts' ? step : n === '../_shared/data-export.ts' ? shared : none(n));
      }
    }
    assert.equal(typeof handler, 'function', worker);
    return handler;
  };
  const BODIES = {push: {action: 'tick'}, export: {action: 'tick'}, closure: {action: 'maintenance', maxSteps: 8}};
  const CASES = {
    secretOnApikey: {apikey: SECRET},                                   // what the tick sends after PKG-030a
    secretAsBearer: {authorization: 'Bearer ' + SECRET},                // the platform gateway refuses this before any worker
    legacyAsBearer: {authorization: 'Bearer ' + LEGACY},                // canonical DEV, 2026-09-21: what the tick sent
    legacyOnApikey: {apikey: LEGACY},
    noKey: {},
    secretPlusOne: {apikey: SECRET + 'A'},
    secretMinusOne: {apikey: SECRET.slice(0, -1)},
    secretInOtherHeader: {'x-api-key': SECRET},
    person: {apikey: PUBLISHABLE, authorization: 'Bearer ' + PERSON},   // a signed-in person from the app
    publishableOnly: {apikey: PUBLISHABLE},
  };
  const observed = {};
  for (const worker of Object.keys(BODIES)) {
    observed[worker] = {};
    for (const [name, headers] of Object.entries(CASES)) {
      const calls = [], handler = load(worker, calls);
      const response = await handler(new Request(ORIGIN + '/functions/v1/synthetic', {method: 'POST',
        headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(BODIES[worker])}));
      const text = await response.text();
      assert.ok(!text.includes(SECRET) && !text.includes(LEGACY) && !text.includes(PERSON), 'a key came back in a response');
      let body = null; try { body = JSON.parse(text); } catch {}
      for (const c of calls) assert.equal(c.origin, ORIGIN, 'a request left the project');
      observed[worker][name] = {status: response.status, answer: body?.kind ?? body?.code ?? null,
        calls: calls.map(({path, apikey, authorization}) => ({path, apikey, authorization}))};
    }
  }

  // The recorded table. A service call is made with the server key on both headers, as every worker already did.
  const svc = path => ({path, apikey: 'SECRET', authorization: 'Bearer SECRET'});
  const ACCEPTED = {
    push: {status: 200, answer: 'DISABLED', calls: []},
    export: {status: 200, answer: 'TICK_COMPLETED', calls: [svc('/rest/v1/rpc/rpc_claim_data_export'), svc('/rest/v1/rpc/rpc_claim_data_export_cleanup')]},
    closure: {status: 200, answer: 'MAINTENANCE_CHECKED', calls: [svc('/rest/v1/rpc/rpc_list_account_closure_work_service')]},
  };
  const refused = (worker, name) => {
    if (worker === 'push') return {status: 403, answer: 'FORBIDDEN', calls: []};
    // A caller with a Bearer that is not the server key is taken for a person: the export worker asks Auth who it
    // is (with that token, never the server key), the closure worker refuses it outright.
    const bearer = CASES[name].authorization;
    if (worker === 'export') return bearer ? {status: 401, answer: 'AUTH_REQUIRED', calls: [{path: '/auth/v1/user',
      apikey: 'PUBLISHABLE', authorization: label(bearer)}]} : {status: 401, answer: 'AUTH_REQUIRED', calls: []};
    return bearer ? {status: 403, answer: 'SERVICE_ROLE_REQUIRED', calls: []} : {status: 401, answer: 'AUTH_REQUIRED', calls: []};
  };
  const acceptedCases = side === 'after' ? ['secretOnApikey', 'secretAsBearer'] : ['secretAsBearer'];
  const expected = {};
  for (const worker of Object.keys(BODIES)) {
    expected[worker] = {};
    for (const name of Object.keys(CASES)) expected[worker][name] = acceptedCases.includes(name) ? ACCEPTED[worker] : refused(worker, name);
  }
  report.gate = {...(report.gate ?? {}), [side]: {sourceHashes: hashes, observed}};
  save();
  assert.deepEqual(observed, expected, 'the workers do not answer the recorded table');
  if (side === 'before') {
    pass('BEFORE_THE_SECRET_KEY_ON_APIKEY_IS_REFUSED_BY_ALL_THREE_WORKERS');
    pass('BEFORE_THE_LEGACY_KEY_IS_REFUSED_EXACTLY_AS_CANONICAL_DEV_ANSWERED_403_401_403');
    pass('BEFORE_ONLY_THE_SECRET_KEY_AS_A_BEARER_IS_ACCEPTED_AND_THE_GATEWAY_REFUSES_THAT_FORM');
  } else {
    pass('AFTER_THE_SECRET_KEY_ON_APIKEY_IS_ACCEPTED_BY_ALL_THREE_WORKERS');
    pass('AFTER_EVERY_OTHER_WAY_OF_PRESENTING_A_KEY_IS_ANSWERED_EXACTLY_AS_BEFORE');
    pass('A_PERSON_IS_NEVER_TAKEN_FOR_THE_SERVICE_AND_NO_KEY_COMES_BACK_IN_A_RESPONSE');
    if (report.gate.before) {
      const changed = [];
      for (const worker of Object.keys(BODIES)) for (const name of Object.keys(CASES))
        if (JSON.stringify(report.gate.before.observed[worker][name]) !== JSON.stringify(observed[worker][name])) changed.push(worker + ':' + name);
      report.gate.changedRows = changed;
      assert.deepEqual(changed, ['push:secretOnApikey', 'export:secretOnApikey', 'closure:secretOnApikey']);
      pass('THE_ONLY_ROWS_THAT_CHANGED_ARE_THE_SECRET_KEY_ON_APIKEY');
    }
  }
  save();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// database modes: the disposable local stack only
// ---------------------------------------------------------------------------------------------------------
const db = process.env.DB_URL;
assert.equal(db, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', 'DISPOSABLE_LOCAL_TARGET_ONLY');
const q = v => "'" + String(v).replaceAll("'", "''") + "'";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = (label, e) => { const error = new Error(label + ': ' + String(e.stderr ?? e.message).slice(-3000)); error.stderr = String(e.stderr ?? ''); return error; };
const sql = (text, label = 'SQL') => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
      {input: text, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']}).trim();
  } catch (e) { throw fail(label, e); }
};
const psqlFile = path => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path],
      {encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) { throw fail(path, e); }
};
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8'), 'SURFACE').split('\n').filter(Boolean);
const closure = () => JSON.parse(sql(`select jsonb_build_object('live', private.closure_source_digest_v5(),
  'certified', (select sha256 from private.closure_source_v5 where singleton), 'ready', private.retention_ai_source_ready())`));
const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`);
const TICK = 'private.edge_worker_tick_v5(timestamptz)';
const tickBody = () => sql(`select prosrc from pg_proc where oid = to_regprocedure(${q(TICK)})`);

// The five PKG-029 rows canonical DEV recorded on 2026-09-21 (receipt 20260921_pkg029_application.receipt.json).
const PKG029 = [
  ['pkg029a_notifications_reach', '40ee85a23378061d0f3535d35b6c8cb89c931ddc8561c3e40ab6bb5dde49ea34'],
  ['pkg029b_lifecycle_truth', '574e263daa3a12957d9010057b172c61efffe42990f858ab76836c160740c552'],
  ['pkg029c_questions_while_recruiting', 'fc6a07ad52b2db4fb86844304658217b40b90946d2170a57f547812f8e06a7d4'],
  ['pkg029d_export_honest', '5ed963623f8cc0d59f7479959e139dd0dbfdd72bcebf04652c21f758cf60c356'],
  ['pkg029e_owner_in_test_world', 'eaab7e19612d836bb15b967c8290a95af823d271b4daf93e3d3cb57557e1a4df'],
];
// md5(prosrc) on canonical DEV, 2026-09-21, after PKG-029: the tick, what it reads, and every body PKG-029 left.
const DEV_BODIES = {
  [TICK]: '2d898a940870c281e7efa312bb4a3000',
  'private.data_export_policy_binding()': '2dbe3d1f343c37c5b3d722c97d9bcb70',
  'private.closure_erasure_binding_v5()': 'd6d7e7f6f108fff45a4df5126949fa04',
  'private.account_visibility_world(uuid)': '876cfc16f0ed1c4d32b128e8e18bdcda',
  'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)': '67413effbbb3fa227397d355e0d4edfb',
  'private.expire_lifecycle(timestamptz)': '2e13f16eb5f760c1a8a3ebbf59fb60a9',
  'private.relative_schedule_end_v5(text,timestamptz,text)': '7164c2ba0d23a0387376fec67f7154b9',
  'private.ru4b_public_floor_reason(text)': '3462ec034f1f9df9760e4729aa0d2c18',
  'private.sync_need_completion(uuid)': '9a1f77966f5a22514db8d85c4a390f9e',
  'public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text)': '54f5a213e0d8035cf579311a49474f29',
  'public.rpc_close_remaining_search(uuid,integer,text,text)': '1e3e98db30a8260c5896909df94b1506',
  'public.rpc_list_my_applications()': 'fb0f3053c6b9d3cf0464c433f0504f3b',
  'public.rpc_read_preselection_qa_context(uuid,uuid)': 'b3c6e0a20ec3acd2064a3f0f9a00ac4c',
  'public.rpc_request_data_export(text)': '1276797dea9502ea261e2dead96ba9ff',
  'public.rpc_ru4b_answer_preselection_question(uuid,text,uuid)': '6e14c4c6d24fbc11d6b388083ef01ec9',
  'public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid)': 'b99044a38fc54eb901d157e5785f07da',
  'public.rpc_ru4b_public_preselection_qa(uuid)': '8d0a35f53bfcdffaddae41472ff025c8',
  'public.rpc_select_response(uuid,integer,uuid,integer,text,text)': '22a27e65592eb11ce1df486185b08d0a',
  'public.rpc_tick_auto_completion()': 'b617890420e11846dbe528ffc4d800d7',
};
const DEV_BASE = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const SENDS_BEARER = "'Authorization', 'Bearer ' || v_key", SENDS_APIKEY = "'apikey', v_key";

// ---------------------------------------------------------------------------------------------------------
if (mode === 'replay') {
  for (const [name, sha] of PKG029) {
    const path = `supabase/candidates/${name}.sql`, bytes = readFileSync(path, 'utf8');
    assert.equal(sha256(bytes.replace(/\n$/, '')), sha, 'NOT_THE_TEXT_CANONICAL_DEV_RECORDED ' + name);
    psqlFile(path);
  }
  pass('THE_FIVE_PKG029_ROWS_REPLAYED_FROM_THE_EXACT_TEXT_CANONICAL_DEV_RECORDED');
  const differing = Object.entries(DEV_BODIES).filter(([signature, md5]) => bodyMd5(signature) !== md5)
    .map(([signature, md5]) => ({signature, onCanonicalDev: md5, inReplay: bodyMd5(signature)}));
  report.bodiesThatDifferFromCanonicalDev = differing;
  assert.deepEqual(differing, [], 'REPLAY_IS_NOT_CANONICAL_DEV ' + JSON.stringify(differing));
  pass('THE_TICK_WHAT_IT_READS_AND_EVERY_PKG029_BODY_EQUAL_CANONICAL_DEV');
  assert.equal(sql("select count(*) from cron.job where jobname = 'uskoci_edge_workers' and not active"), '1', 'pkg029 replay pauses the worker tick');
  const c = closure(); assert.equal(c.ready, true); assert.equal(c.live, c.certified); report.closureAfterReplay = c;
  pass('THE_CLOSURE_SOURCE_IS_CERTIFIED_AND_READY_AS_ON_CANONICAL_DEV');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'before') {
  const body = tickBody();
  assert.ok(body.includes(SENDS_BEARER), 'the tick sends the key as a Bearer');
  assert.ok(!body.includes(SENDS_APIKEY));
  pass('BEFORE_THE_TICK_SENDS_THE_KEY_AS_AUTHORIZATION_BEARER');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
const refuses = (name, code, path = `supabase/candidates/${name}.sql`) => {
  let failure = null;
  try { psqlFile(path); } catch (e) { failure = e; }
  assert.ok(failure, `${name} applied where it must refuse (${code})`);
  assert.ok(failure.stderr.includes(code), `${name}: expected ${code}, got ${failure.stderr.slice(-600)}`);
};
const changed = line => line.split(':').slice(0, 2).join(':').replace(/\(.*$/, '');
const tickShape = () => JSON.parse(sql(`select jsonb_build_object('acl', p.proacl::text, 'secdef', p.prosecdef, 'config', p.proconfig::text,
  'job', (select j.schedule || ' ' || j.command from cron.job j where j.jobname = 'uskoci_edge_workers'))
  from pg_proc p where p.oid = to_regprocedure(${q(TICK)})`));

if (mode === 'apply') {
  const before = surface(), closureBefore = closure(), shapeBefore = tickShape(), bodyBefore = tickBody();
  writeFileSync(`${out}/pkg030-surface-before.txt`, before.join('\n') + '\n');
  const tampered = `${out}/pkg030a_edge_workers_apikey.tampered.sql`;
  writeFileSync(tampered, readFileSync('supabase/candidates/pkg030a_edge_workers_apikey.sql', 'utf8')
    .replace("'2d898a940870c281e7efa312bb4a3000'", "'00000000000000000000000000000000'"));
  refuses('pkg030a (tampered)', 'PKG030A_PREDECESSOR_DRIFT', tampered);
  assert.deepEqual(surface(), before, 'A_REFUSED_CANDIDATE_LEFT_SOMETHING_BEHIND');
  pass('A_TAMPERED_PIN_IS_REFUSED_AND_LEAVES_NOTHING_BEHIND');
  psqlFile('supabase/candidates/pkg030a_edge_workers_apikey.sql');
  pass('THE_CANDIDATE_APPLIES');
  refuses('pkg030a_edge_workers_apikey', 'PKG030A_ALREADY_APPLIED');
  pass('A_SECOND_APPLICATION_IS_REFUSED');
  const after = surface();
  writeFileSync(`${out}/pkg030-surface-after.txt`, after.join('\n') + '\n');
  const removed = before.filter(l => !after.includes(l)), added = after.filter(l => !before.includes(l));
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  assert.deepEqual(removed.map(changed), ['function:private.edge_worker_tick_v5']);
  assert.deepEqual(added.map(changed), ['function:private.edge_worker_tick_v5']);
  pass('THE_SURFACE_CHANGES_BY_THE_TICK_ONLY');
  assert.deepEqual(tickShape(), shapeBefore, 'privileges, security or schedule changed');
  const bodyAfter = tickBody();
  assert.equal(bodyAfter.split(SENDS_BEARER).length, 1); assert.equal(bodyAfter.split(SENDS_APIKEY).length, 2);
  // Apart from the header and two comment lines, the body is the one canonical DEV runs.
  const strip = b => b.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.equal(strip(bodyAfter), strip(bodyBefore).replace(SENDS_BEARER, SENDS_APIKEY));
  report.tickBodyMd5After = bodyMd5(TICK);
  pass('THE_TICK_NOW_SENDS_THE_KEY_ON_APIKEY_AND_NOTHING_ELSE_IN_IT_CHANGED');
  const c = closure();
  assert.equal(c.live, closureBefore.live); assert.equal(c.live, c.certified); assert.equal(c.ready, true);
  report.closure = c;
  pass('THE_CERTIFIED_CLOSURE_SOURCE_DID_NOT_MOVE');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'after') {
  const body = tickBody();
  assert.ok(body.includes(SENDS_APIKEY) && !body.includes(SENDS_BEARER) && !body.includes("'Authorization'"));
  // Without a key nothing is sent, as before.
  assert.equal(sql("select count(*) from vault.secrets where name = 'uskoci_edge_worker_key'"), '0');
  assert.deepEqual(JSON.parse(sql('select private.edge_worker_tick_v5()')), {kind: 'NOT_CONFIGURED', missing: 'WORKER_KEY'});
  assert.equal(sql('select count(*) from net.http_request_queue'), '0');
  pass('AFTER_THE_TICK_SENDS_THE_KEY_ON_APIKEY_AND_STILL_SENDS_NOTHING_WITHOUT_ONE');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'e2e') {
  const rt = await import('../pre_v3/closure_runtime.mjs');
  const kong = process.env.PKG030_KONG, key = process.env.RU5_DEVICE_SERVICE_ROLE_KEY, api = process.env.RU5_DEVICE_SUPABASE_URL;
  assert.match(kong ?? '', /^http:\/\/supabase_kong_[a-z0-9_-]+:8000$/, 'PKG030_KONG');
  assert.match(api ?? '', /^http:\/\/(127\.0\.0\.1|localhost):54321$/, 'the local API');
  assert.ok(key && /^[A-Za-z0-9._~-]{16,4096}$/.test(key), 'the local service key');
  const setBase = value => sql(`select vault.update_secret((select id from vault.secrets where name='uskoci_edge_base_url'), ${q(value)})`, 'BASE');
  const setKey = value => sql(`do $k$ begin
      if exists (select 1 from vault.secrets where name='uskoci_edge_worker_key') then
        perform vault.update_secret((select id from vault.secrets where name='uskoci_edge_worker_key'), ${q(value)});
      else perform vault.create_secret(${q(value)}, 'uskoci_edge_worker_key'); end if; end $k$;`, 'KEY');
  const base = () => sql("select decrypted_secret from vault.decrypted_secrets where name='uskoci_edge_base_url'");
  // Never store a key while the address is canonical DEV's.
  assert.equal(base(), DEV_BASE); setBase(kong); assert.equal(base(), kong);
  pass('THE_TICK_POINTS_AT_THIS_STACKS_OWN_GATEWAY_BEFORE_ANY_KEY_EXISTS');

  // Straight to each worker through this stack's gateway, which verifies no JWT for them (as on canonical DEV now).
  const call = async (slug, body, headers = {}) => {
    const r = await fetch(`${api}/functions/v1/${slug}`, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
    const text = await r.text(); let parsed = null; try { parsed = JSON.parse(text); } catch {}
    assert.ok(!text.includes(key), 'the key came back in a response');
    return {status: r.status, answer: parsed?.kind ?? parsed?.code ?? null};
  };
  const PUSH = ['uskoci-push-transport', {action: 'tick'}], EXPORT = ['uskoci-data-export-worker', {action: 'tick'}],
    CLOSE = ['uskoci-account-closure-worker', {action: 'maintenance', maxSteps: 8}];
  const direct = {};
  for (const [name, [slug, body]] of Object.entries({push: PUSH, export: EXPORT, closure: CLOSE})) {
    direct[name] = {
      noKey: await call(slug, body),
      wrongKeyOnApikey: await call(slug, body, {apikey: 'pkg030-well-formed-but-wrong-key'}),
      anonKeyOnApikey: await call(slug, body, {apikey: process.env.RU5_DEVICE_ANON_KEY}),
      rightKeyOnApikey: await call(slug, body, {apikey: key}),
    };
  }
  report.direct = direct;
  assert.deepEqual(direct.push, {noKey: {status: 403, answer: 'FORBIDDEN'}, wrongKeyOnApikey: {status: 403, answer: 'FORBIDDEN'},
    anonKeyOnApikey: {status: 403, answer: 'FORBIDDEN'}, rightKeyOnApikey: {status: 200, answer: 'DISABLED'}});
  assert.deepEqual(direct.closure, {noKey: {status: 401, answer: 'AUTH_REQUIRED'}, wrongKeyOnApikey: {status: 401, answer: 'AUTH_REQUIRED'},
    anonKeyOnApikey: {status: 401, answer: 'AUTH_REQUIRED'}, rightKeyOnApikey: {status: 200, answer: 'MAINTENANCE_CHECKED'}});
  assert.deepEqual(direct.export, {noKey: {status: 401, answer: 'AUTH_REQUIRED'}, wrongKeyOnApikey: {status: 401, answer: 'AUTH_REQUIRED'},
    anonKeyOnApikey: {status: 401, answer: 'AUTH_REQUIRED'}, rightKeyOnApikey: {status: 200, answer: 'TICK_COMPLETED'}});
  pass('WITH_NO_GATEWAY_CHECK_EACH_WORKER_REFUSES_BY_ITSELF_AND_TAKES_ONLY_THE_SERVER_KEY');

  // A signed-in person still reaches the export worker's own path; a stranger's token is refused by the worker.
  const person = await rt.actor('pkg030-person');
  const session = (await person.client.auth.getSession()).data.session;
  assert.ok(session?.access_token);
  const own = await call(EXPORT[0], {action: 'prepare', receiptId: randomUUID()}, {apikey: process.env.RU5_DEVICE_ANON_KEY, Authorization: 'Bearer ' + session.access_token});
  const forged = await call(EXPORT[0], {action: 'prepare', receiptId: randomUUID()}, {apikey: process.env.RU5_DEVICE_ANON_KEY,
    Authorization: 'Bearer ' + session.access_token.split('.').slice(0, 2).join('.') + '.' + 'A'.repeat(43)});
  await sleep(1100); // the worker admits one call a second per person
  const personTick = await call(EXPORT[0], {action: 'tick'}, {apikey: process.env.RU5_DEVICE_ANON_KEY, Authorization: 'Bearer ' + session.access_token});
  const personClosure = await call(CLOSE[0], CLOSE[1], {apikey: process.env.RU5_DEVICE_ANON_KEY, Authorization: 'Bearer ' + session.access_token});
  report.people = {own, forged, personTick, personClosure};
  assert.deepEqual(own, {status: 200, answer: 'NOT_READY'});
  assert.deepEqual(forged, {status: 401, answer: 'AUTH_REQUIRED'});
  assert.deepEqual(personTick, {status: 400, answer: 'EXPORT_REQUEST_INVALID'});
  assert.deepEqual(personClosure, {status: 403, answer: 'SERVICE_ROLE_REQUIRED'});
  pass('A_PERSON_REACHES_ONLY_THEIR_OWN_EXPORT_PATH_AND_A_FORGED_TOKEN_IS_REFUSED_BY_THE_WORKER');

  const tick = () => JSON.parse(sql('select private.edge_worker_tick_v5()', 'TICK'));
  const answer = async id => {
    for (let i = 0; i < 180; i++) {
      const r = sql(`select coalesce((select jsonb_build_object('status', status_code, 'content', content::text, 'timedOut', timed_out,
        'error', error_msg)::text from net._http_response where id = ${Number(id)}), '')`);
      if (r) { const v = JSON.parse(r); try { v.body = JSON.parse(v.content); } catch { v.body = null; } delete v.content; return v; }
      await sleep(500);
    }
    throw new Error('PKG030_NO_RESPONSE ' + id);
  };
  const state = id => sql(`select coalesce((select state from private.closure_executions_v5 where account_id=${q(id)}::uuid order by requested_at desc limit 1), 'NONE')`);

  setKey(key);
  const idle = tick();
  report.idle = idle;
  assert.deepEqual(idle.workers, {PUSH: 'IDLE', DATA_EXPORT: 'IDLE', ACCOUNT_CLOSURE: 'IDLE'});
  pass('WITH_NO_WORK_NOTHING_IS_SENT');

  const closing = await rt.actor('pkg030-closing');
  await rt.ok(closing.client.rpc('rpc_prepare_account_closure', {p_expected_user_id: closing.id, p_expected_revision: 0, p_client_request_id: randomUUID()}));
  const ready = await rt.ok(closing.client.rpc('rpc_review_account_closure_execution', {p_expected_user_id: closing.id}));
  assert.equal(ready.ready, true, 'a fresh account can close');
  const started = await rt.ok(closing.client.rpc('rpc_start_account_closure_execution', {p_expected_user_id: closing.id,
    p_request_id: ready.requestId, p_expected_revision: ready.revision, p_client_request_id: randomUUID(), p_policy_sha256: ready.policySha256}));
  assert.equal(started.state, 'EXECUTING'); assert.equal(state(closing.id), 'EXECUTING');
  pass('A_CONFIRMED_DELETION_IS_EXECUTING_AND_THE_ACCOUNT_IS_LOCKED');

  setKey('pkg030-well-formed-but-wrong-key');
  const wrong = tick();
  assert.ok(Number.isInteger(wrong.workers.ACCOUNT_CLOSURE?.requestId), 'the tick calls the closure worker when it has work');
  const refused = await answer(wrong.workers.ACCOUNT_CLOSURE.requestId);
  report.wrongKey = {status: refused.status, body: refused.body};
  assert.equal(refused.status, 401); assert.equal(refused.body?.code, 'AUTH_REQUIRED');
  assert.equal(state(closing.id), 'EXECUTING');
  assert.equal(sql(`select count(*) from private.closure_actions_v5 where account_id=${q(closing.id)}::uuid and state<>'PENDING'`), '0');
  pass('A_WRONG_KEY_ON_APIKEY_IS_REFUSED_BY_THE_WORKER_AND_NOTHING_MOVES');

  setKey(key);
  const lastBefore = Number(sql('select coalesce(max(id), 0) from net._http_response'));
  const runsBefore = Number(sql("select count(*) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = 'uskoci_edge_workers'"));
  sql("select cron.alter_job(j.jobid, active := true) from cron.job j where j.jobname = 'uskoci_edge_workers'", 'RESUME');
  let fired = null;
  try {
    for (let i = 0; i < 150 && !fired; i++) {
      await sleep(1000);
      const run = sql(`select coalesce((select jsonb_build_object('status', d.status, 'message', d.return_message)::text from cron.job_run_details d
        join cron.job j on j.jobid = d.jobid where j.jobname = 'uskoci_edge_workers' and d.status in ('succeeded','failed')
        order by d.start_time desc limit 1), '')`);
      const runs = Number(sql("select count(*) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = 'uskoci_edge_workers' and d.status in ('succeeded','failed')"));
      if (runs > runsBefore && run) fired = JSON.parse(run);
    }
  } finally {
    sql("select cron.alter_job(j.jobid, active := false) from cron.job j where j.jobname = 'uskoci_edge_workers'", 'PAUSE');
  }
  assert.ok(fired, 'the cron job did not run within 150 seconds');
  assert.equal(fired.status, 'succeeded', 'the cron run failed: ' + fired.message);
  let cronRequest = 0;
  for (let i = 0; i < 120 && !cronRequest; i++) {
    cronRequest = Number(sql(`select coalesce(min(id), 0) from net._http_response where id > ${lastBefore}`));
    if (!cronRequest) await sleep(500);
  }
  assert.ok(cronRequest > 0, 'the cron-fired tick sent no request');
  const first = await answer(cronRequest);
  report.cronFired = {run: fired, status: first.status, body: first.body};
  assert.equal(first.status, 200, 'the worker refused the cron-fired call: ' + JSON.stringify(first));
  assert.equal(first.body?.kind, 'MAINTENANCE_CHECKED');
  pass('THE_CRON_JOB_FIRES_THE_TICK_AND_THE_WORKER_ACCEPTS_THE_KEY_ON_APIKEY');

  const steps = [];
  for (let i = 0; i < 240; i++) {
    if (state(closing.id) === 'CLOSED') break;
    const t = tick();
    if (t.workers.ACCOUNT_CLOSURE === 'IDLE') break;
    const r = await answer(t.workers.ACCOUNT_CLOSURE.requestId);
    assert.equal(r.status, 200, 'step ' + i + ': ' + JSON.stringify(r));
    steps.push(r.body);
  }
  report.closureSteps = {calls: steps.length, last: steps.at(-1), totals: steps.reduce((a, s) => ({
    verified: a.verified + (s?.verified ?? 0), pending: a.pending + (s?.pending ?? 0), closed: a.closed + (s?.closed ?? 0),
    blocked: a.blocked + (s?.blocked ?? 0)}), {verified: 0, pending: 0, closed: 0, blocked: 0})};
  assert.equal(state(closing.id), 'CLOSED', 'the deletion did not reach CLOSED: ' + JSON.stringify(report.closureSteps));
  assert.equal(report.closureSteps.totals.blocked, 0);
  assert.equal(sql(`select deleted_at is not null from auth.users where id=${q(closing.id)}::uuid`), 't');
  assert.equal(sql(`select email='' from public.app_accounts where id=${q(closing.id)}::uuid`), 't');
  assert.equal(tick().workers.ACCOUNT_CLOSURE, 'IDLE');
  pass('THE_TICK_ALONE_CARRIES_A_CONFIRMED_DELETION_TO_CLOSED_AND_THEN_STOPS_CALLING');

  // Push: a waiting push makes the tick call the push worker, which answers for itself (its switch is off here).
  const p = {id: randomUUID()};
  sql(`insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
    insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')}) on conflict (id) do nothing;`, 'PUSH_PERSON');
  sql(`select private.emit_event(${q(p.id)},'REQUESTER','MESSAGE_RECEIVED','AGREEMENT',${q(randomUUID())},1,'Nova poruka','Imaš novu poruku u Dogovoru.',${q('pkg030:' + randomUUID())})`, 'EMIT');
  sql(`update public.notification_deliveries set state='CREATED', suppression_reason=null, push_started_at=null
        where channel='PUSH' and recipient_user_id=${q(p.id)}::uuid`, 'PUSH_DUE');
  const pushTick = tick();
  assert.ok(Number.isInteger(pushTick.workers.PUSH?.requestId), 'the tick calls the push worker when a push is waiting');
  const pushAnswer = await answer(pushTick.workers.PUSH.requestId);
  report.push = {status: pushAnswer.status, body: pushAnswer.body};
  assert.equal(pushAnswer.status, 200); assert.equal(pushAnswer.body?.kind, 'DISABLED');
  sql(`update public.notification_deliveries set state='SUPPRESSED', suppression_reason='PKG030_FIXTURE_DONE'
        where channel='PUSH' and recipient_user_id=${q(p.id)}::uuid`, 'PUSH_DONE');
  pass('THE_PUSH_WORKER_ACCEPTS_THE_TICKS_CALL_AND_ITS_OWN_SWITCH_STILL_DECIDES');

  // Export: the very request the tick would send, from the database.
  const exportRequest = Number(sql(`select net.http_post(url := ${q(kong + '/functions/v1/uskoci-data-export-worker')}, body := '{"action":"tick"}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','apikey',(select decrypted_secret from vault.decrypted_secrets where name='uskoci_edge_worker_key')),
    timeout_milliseconds := 60000)`, 'EXPORT_DIRECT'));
  const exportAnswer = await answer(exportRequest);
  report.export = {status: exportAnswer.status, body: exportAnswer.body};
  assert.equal(exportAnswer.status, 200); assert.equal(exportAnswer.body?.kind, 'TICK_COMPLETED');
  pass('THE_EXPORT_WORKER_ACCEPTS_THE_KEY_ON_APIKEY_FROM_THE_DATABASE');

  // Leave the disposable database as canonical DEV's was before the owner acted: no key, DEV's address.
  sql("delete from vault.secrets where name = 'uskoci_edge_worker_key'", 'CLEAN_KEY'); setBase(DEV_BASE);
  report.responsesInThisRun = Number(sql('select count(*) from net._http_response'));
  save();
  process.exit(0);
}

throw new Error('UNKNOWN_MODE ' + mode);
