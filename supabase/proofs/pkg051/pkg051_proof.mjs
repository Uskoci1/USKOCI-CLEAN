// PKG-051: a versioned platform price list (cenovnik) for Povezivanje and HITNO, every price 0 RSD, payments off.
// Disposable SQL plus the actual local Auth/PostgREST stack; no DEV, no provider, no payment. The price list is read
// and written only as the database owner, the way the owner will use the SQL editor; the API must not reach it.
// The free Povezivanje path is exercised the way real selections are made: a published task, a real offer and a
// real selection through the same RPCs the app calls.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync, execFile} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {sqlProcessFailure} from '../pre_v3/history_snapshot.mjs';
const {assert, sql, rows, q, randomUUID, ok, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const sha = s => createHash('sha256').update(s).digest('hex');
const report = {package: 'PKG-051', result: 'RUNNING', sourceSha: env.GITHUB_SHA, disposableOnly: true, providerCalls: 0,
  paymentCalls: 0, checks: [], tampers: []};
const save = () => writeFileSync(env.PRE_V3_ARTIFACT_DIR + '/pkg051-report.json', JSON.stringify(report, null, 2) + '\n');
// A failure anywhere (a replay, the setup or a check) still leaves an artifact that says FAIL, why, and after which
// check, like rt.prove(). The monitor only records: Node still prints the error and exits 1. It also sees a failed
// top-level await, which Node raises as an uncaught exception.
process.on('uncaughtExceptionMonitor', e => {
  if (report.result === 'PASS') return;
  report.result = 'FAIL';
  report.failure = String(e?.message ?? e).slice(0, 1100);
  report.failedAfter = report.checks.at(-1)?.name ?? null;
  try { save(); } catch (saveError) { console.error('PKG051_REPORT_NOT_SAVED: ' + saveError.message); }
});
// kind: BASELINE holds on the predecessor by design; NEW needs the candidate (its objects are absent before);
// NO_REGRESSION must hold before and after; TAMPER proves a refusal rolls everything back.
const pass = (name, kind) => {report.checks.push({name, kind, result: 'PASS'}); save(); console.log('PASS ' + name);};

// The candidate runs its whole-surface comparison twice, so it gets a longer process bound than rt.sql's 20 s.
const psql = (text, timeout) => {
  try {
    return execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
      {input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout, maxBuffer: 32 * 1024 * 1024}).trim();
  } catch (e) { throw new Error(sqlProcessFailure(e)); }
};
const apply = text => psql('\\set VERBOSITY verbose\n' + text, 180000);
// Session-local helper (pg_temp, outside every surface): runs one statement and returns OK or SQLSTATE:MESSAGE[:DETAIL].
const TRY = `create function pg_temp.try(s text) returns text language plpgsql as $try$
declare v_state text; v_message text; v_detail text;
begin
  execute s;
  return 'OK';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text, v_detail = pg_exception_detail;
  return v_state || ':' || v_message || coalesce(':' || nullif(v_detail, ''), '');
end $try$;
`;
const TRY_JSON = `create function pg_temp.try_json(s text) returns jsonb language plpgsql as $tj$
declare v_result jsonb; v_state text; v_message text;
begin
  execute s into v_result;
  return jsonb_build_object('ok', v_result);
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  return jsonb_build_object('error', v_state || ':' || v_message);
end $tj$;
`;
const tryOf = stmt => `select pg_temp.try(${q(stmt)});`;
const attempt = stmt => sql(TRY + tryOf(stmt));
const rollbackProbe = body => sql(`begin;\n${TRY}${body}\nrollback;`).split('\n');
const asyncAttempt = stmt => new Promise((resolve, reject) => {
  const child = execFile('psql', [env.RU5_DEVICE_DB_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    {encoding: 'utf8', timeout: 30000},
    (error, stdout, stderr) => error ? reject(new Error(sqlProcessFailure({...error, stderr}))) : resolve(stdout.trim()));
  child.stdin.on('error', () => {});
  child.stdin.end(TRY + tryOf(stmt));
});

const closure = () => rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,(select sha256 from private.closure_erasure_source_v5 where singleton) erasure,private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5()->>'sourceSha256' binding")[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const FN = {
  enabled: 'private.platform_payments_enabled()',
  canonical: 'private.platform_price_canonical(text,integer,bigint,text,text,text,timestamptz,timestamptz,text)',
  versions: 'private.platform_price_versions()',
  listAt: 'private.platform_price_list_at(timestamptz)',
  add: 'private.platform_price_add_version(text,integer,bigint,text,text,timestamptz,text)',
};
const NEW_LINE = /^function:private\.(platform_payments_enabled|platform_price_canonical|platform_price_versions|platform_price_list_at|platform_price_add_version)\(/;
const exists = sig => sql(`select (to_regprocedure(${q(sig)}) is not null)::text`) === 'true';
const md5 = sig => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = ${q(sig)}::regprocedure`);
const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
const configRows = () => rows('select key, value::text as value, updated_at::text as "updatedAt" from private.marketplace_config').sort(byKey);
const isPriceKey = key => key === 'platform_payments' || key.startsWith('platform_price');
const priceKeyCount = () => sql("select count(*) from private.marketplace_config where key = 'platform_payments' or starts_with(key, 'platform_price')");
const listAt = expr => JSON.parse(sql(`select private.platform_price_list_at(${expr})::text`));
const entry = (list, product) => list.products.find(p => p.product === product);
const stored = () => JSON.parse(sql('select private.platform_price_versions()::text')).products;
const addVersion = args => JSON.parse(sql(`select private.platform_price_add_version(${args})::text`));
const head = () => JSON.parse(sql("select value::text from private.marketplace_config where key = 'platform_price_head'"));
// The canonical hash, recomputed outside the database from the stored fields.
const versionSha = v => sha(['PLATFORM_PRICE_V1', v.product, v.version, v.amountMinor, v.currency, v.payerRole, v.unitBasis,
  v.effectiveAt, v.recordedAt, v.previousSha256 ?? ''].join('|'));
const projection = v => { const {schema, product, previousSha256, ...rest} = v; return rest; };

const SEED_AT = '2026-09-23T22:00:00.000000Z';
const SEED = {
  CONNECTION: {schema: 'PLATFORM_PRICE_V1', product: 'CONNECTION', version: 1, amountMinor: 0, currency: 'RSD',
    payerRole: 'REQUESTER', unitBasis: 'HEADCOUNT', effectiveAt: SEED_AT, recordedAt: SEED_AT, previousSha256: null,
    sha256: '3df2b860def7e5a08b388caeaff1a19fb6e8fd678c9989b15b32d9624226b1f6'},
  URGENT_BOOST: {schema: 'PLATFORM_PRICE_V1', product: 'URGENT_BOOST', version: 1, amountMinor: 0, currency: 'RSD',
    payerRole: 'REQUESTER', unitBasis: 'FLAT', effectiveAt: SEED_AT, recordedAt: SEED_AT, previousSha256: null,
    sha256: '4ed7b18ecad29f5005f17cc8e5f8ea6bc5e04f0924c67614ba6f3976de477abb'},
};
for (const v of Object.values(SEED)) assert.equal(versionSha(v), v.sha256, 'SEED_PIN_' + v.product);
const LIST_AT_SEED = {schema: 'PLATFORM_PRICE_LIST_V1', asOf: SEED_AT, paymentsEnabled: false, products: [
  {product: 'CONNECTION', latestVersion: 1, current: projection(SEED.CONNECTION), next: null},
  {product: 'URGENT_BOOST', latestVersion: 1, current: projection(SEED.URGENT_BOOST), next: null}]};
const SWITCH_ON = '{"schema": "PLATFORM_PAYMENTS_SWITCH_V1", "enabled": true}';
const SWITCH_OFF = '{"schema": "PLATFORM_PAYMENTS_SWITCH_V1", "enabled": false}';
const setSwitch = value => value === null ? "delete from private.marketplace_config where key = 'platform_payments';"
  : `update private.marketplace_config set value = ${q(value)}::jsonb where key = 'platform_payments';`;
const DISABLED = product => '55000:PLATFORM_PAYMENTS_DISABLED:' + product;
const BROKEN = detail => '55000:PRICE_LIST_INTEGRITY_FAILED:' + detail;

// 1. The exact predecessor chain canonical DEV carries (ledger 201 = 147 + 54): the workflow replayed source147 and
//    every dev_alpha row up to PKG-040; PKG-042a to PKG-050a are applied here from their exact bytes. PKG-045b stays
//    unapplied, as on DEV. Then the certificate must be ready and nothing of this package may exist.
for (const [file, pin] of [['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql', 'f0b7356c9f66067e91b2acf63a7f30a6729debc22e1f0e2bc45af6524e145670'],
  ['supabase/candidates/pkg045a_task_read_contract.sql', 'a8aff72039f283683c630f99f211e0c40356951f3c353b872cc8b7af8c5032c3'],
  ['supabase/candidates/pkg046a_media_upload_cancellation.sql', 'd49bf0c85487fbf89312d52a05f2bc5f2c46b17f86fb1ccee89f4582e89750de'],
  ['supabase/candidates/pkg047a_safety_target.sql', '95c448063dbb7433330dad2e3442bfcaf7f93b4d22140a4cd335b8bd611234b5'],
  ['supabase/candidates/pkg048a_agreement_source_links.sql', '80c0512ed490b6145d21bd8a7ea291156d919fda00cce679617885ce66578832'],
  ['supabase/candidates/pkg050a_agreement_messages_read.sql', '502cfcfbaa1cbdf239fdcb69c5a81aec9c524f92b6f39fc51d8537ff009c26c8']]) {
  const text = readFileSync(file, 'utf8'); assert.equal(sha(text.replace(/\n$/, '')), pin, file); sql(text);
}
report.closureBefore = closure();
assert.equal(report.closureBefore.ready, true);
assert.equal(report.closureBefore.live, report.closureBefore.certified);
assert.equal(report.closureBefore.live, report.closureBefore.erasure);
assert.equal(report.closureBefore.binding, report.closureBefore.live);
for (const sig of Object.values(FN)) assert.equal(exists(sig), false, sig);
assert.equal(priceKeyCount(), '0');
const FREE_PATH = {
  'public.rpc_select_response(uuid,integer,uuid,integer,text,text)': '7cbb83905c1c983be4a7d92ff505411e',
  'private.reject_connection_ledger_mutation()': '577e554a42da691160731eb097a726a6',
  'private.require_connection_activation_for_new_agreement()': '7eda7b4af744abe5175e612f475a11d9'};
for (const [sig, pin] of Object.entries(FREE_PATH)) assert.equal(md5(sig), pin, sig);
const FREE_ROW = [{policy_key: 'REQUESTER_SELECTION_V1', version: 1, beneficiary_role: 'REQUESTER', activation_reason: 'SELECTION',
  charge_mode: 'PROMOTIONAL_FREE', unit_basis: 'HEADCOUNT', platform_cost_rsd: 0}];
const freeRow = () => rows('select policy_key, version, beneficiary_role, activation_reason, charge_mode, unit_basis, platform_cost_rsd from private.connection_policy_versions');
assert.deepEqual(freeRow(), FREE_ROW);
// HITNO bodies, recorded (the DEV snapshot of 2026-09-19 is compared for information only).
const HITNO = ['private.urgent_activation_decision(uuid,uuid,timestamptz)', 'public.rpc_urgent_activation_preview(uuid)',
  'public.rpc_activate_urgent(uuid,integer)', 'private.expire_urgent(timestamptz)', 'private.guard_urgent_need()', 'public.fn_need_urgency(uuid)'];
report.hitnoBodies = Object.fromEntries(HITNO.map(sig => [sig, md5(sig)]));
report.hitnoBodiesMatchDevSnapshot20260919 = report.hitnoBodies['private.urgent_activation_decision(uuid,uuid,timestamptz)'] === 'fb4550627671becb50f1c1aa234ec78a'
  && report.hitnoBodies['public.rpc_urgent_activation_preview(uuid)'] === 'e0d15c6769a737e23041283d20f84db9'
  && report.hitnoBodies['public.rpc_activate_urgent(uuid,integer)'] === '209115e0b7b033ce70f77383f1bdb3a9';
const configBefore = configRows();
for (const key of ['dispatch_normal', 'dispatch_urgent', 'urgent_activation_policy']) assert.ok(configBefore.some(r => r.key === key), key);
assert.equal(JSON.parse(configBefore.find(r => r.key === 'urgent_activation_policy').value).chargesFee, false);
report.configKeysBefore = configBefore.map(r => r.key);
const baselineSurface = surface();
// A requester, a committed published task for the HITNO preview, and a rolled-back task for the dispatch reader.
const requester = await rt.actor('pkg051-requester');
const faces = id => Object.fromEntries(rows(`select kind, id from public.app_profiles where account_id = ${q(id)}`).map(r => [r.kind, r.id]));
const requesterProfile = faces(requester.id).REQUESTER;
const needInsert = (id, title) => `select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
values(${q(id)},${q(requester.id)},${q(requesterProfile)},'PUBLISHED',${q(title)},'Disposable SQL fixture',
  'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());
`;
const hitnoNeed = randomUUID();
sql(`begin;\n${needInsert(hitnoNeed, 'PKG-051 HITNO preview')}commit;`);
const hitnoPreview = async () => {
  const d = await ok(requester.client.rpc('rpc_urgent_activation_preview', {p_need_id: hitnoNeed}));
  delete d.candidateExpiresAt; return d;
};
const dispatchProbe = () => {
  const id = randomUUID();
  const out = sql(`begin;\n${TRY_JSON}${needInsert(id, 'PKG-051 dispatch probe')}
select jsonb_build_object('call', pg_temp.try_json(${q(`select private.dispatch_next_wave(${q(id)}::uuid)`)}),
  'rounds', (select coalesce(jsonb_agg(jsonb_build_object('urgency', r.urgency, 'batchSize', r.batch_size,
     'targetResponses', r.target_responses, 'candidateLimit', r.candidate_limit_used, 'budgetSource', r.budget_source,
     'status', r.status, 'stopReason', r.stop_reason) order by r.round_no), '[]'::jsonb)
     from public.dispatch_rounds r where r.need_id = ${q(id)}::uuid))::text;
rollback;`);
  const result = JSON.parse(out.split('\n').pop());
  if (result.call.ok) delete result.call.ok.deadlineAt;
  return result;
};
report.hitnoBefore = await hitnoPreview();
report.dispatchBefore = dispatchProbe();
assert.ok(!/DISPATCH_CONFIG/.test(report.dispatchBefore.call.error ?? ''), JSON.stringify(report.dispatchBefore));
assert.deepEqual(configRows(), configBefore);
pass('EXACT_PREDECESSOR_REPLAY_READY_CERTIFICATE_NO_PRICE_LIST', 'BASELINE');

// 2. Before: there is nothing to read or write. Holds on the predecessor by design; the exact refusals are recorded.
report.beforeRead = attempt('select private.platform_price_list_at(now())');
report.beforeWrite = attempt("select private.platform_price_add_version('CONNECTION', 1, 0, 'REQUESTER', 'HEADCOUNT')");
assert.match(report.beforeRead, /^42883:function private\.platform_price_list_at\(/);
assert.match(report.beforeWrite, /^42883:function private\.platform_price_add_version\(/);
assert.equal(priceKeyCount(), '0');
pass('BASELINE_NOTHING_TO_READ_OR_WRITE_BEFORE', 'BASELINE');

// 3. Tampers: each aborts with its own code and SQLSTATE 55000, and leaves the surface, the certificate, every config
//    row and the absence of the five functions exactly as they were. Anchors must be unique in the candidate.
const candidate = 'supabase/candidates/pkg051a_platform_price_list.sql', text = readFileSync(candidate, 'utf8');
report.candidateSha256 = sha(text.replace(/\n$/, '')); report.candidateChars = text.replace(/\n$/, '').length;
const intact = () => {
  assert.deepEqual(surface(), baselineSurface); assert.deepEqual(closure(), report.closureBefore);
  assert.deepEqual(configRows(), configBefore);
  for (const sig of Object.values(FN)) assert.equal(exists(sig), false, sig);
};
const once = (source, from, to) => {
  assert.equal(source.split(from).length, 2, 'ANCHOR_NOT_UNIQUE: ' + from.slice(0, 80)); return source.replace(from, () => to);
};
const AFTER_PRE = '\n$pre$;\n', BEFORE_PRE = '\ndo $pre$\n';
const inject = statement => once(text, AFTER_PRE, AFTER_PRE + statement + '\n');
// Drift that already exists when the candidate's own checks run: the statement is placed inside the candidate's
// transaction just before $pre$, so the refusal rolls the drift back together with everything else.
const preInject = statement => once(text, BEFORE_PRE, '\n' + statement + BEFORE_PRE);
const refused = (tampered, code) => {
  assert.throws(() => apply(tampered), e => { assert.match(e.message, new RegExp('ERROR:\\s+55000: ' + code + '\\b'), e.message); return true; });
  intact(); report.tampers.push(code);
};
const LIST_AT_REVOKE = 'revoke all on function private.platform_price_list_at(timestamptz) from public, anon, authenticated, service_role;\n';
const ENABLED_HEADER = 'create function private.platform_payments_enabled()\nreturns boolean\nlanguage sql\nstable\nset search_path = pg_catalog\n';
refused(once(text, '7cbb83905c1c983be4a7d92ff505411e', '0'.repeat(32)), 'PKG051_PREDECESSOR_DRIFT');
refused(once(text, '-- Current: the highest version number already in effect at p_at.\n', '-- Current: the highest version number already in effect at p_at. \n'), 'PKG051_BODY_MISMATCH');
refused(once(text, ENABLED_HEADER, ENABLED_HEADER.replace('pg_catalog\n', 'pg_catalog, public\n')), 'PKG051_FUNCTION_AUTHORITY_MISMATCH');
refused(once(text, LIST_AT_REVOKE, LIST_AT_REVOKE + 'grant execute on function private.platform_price_list_at(timestamptz) to authenticated;\n'), 'PKG051_ACL_MISMATCH');
// A seed that disagrees with the free policy row (payer WORKER) is caught before the seed pins are read.
refused(once(text, "('CONNECTION', 'REQUESTER', 'HEADCOUNT')", "('CONNECTION', 'WORKER', 'HEADCOUNT')"), 'PKG051_FREE_POLICY_MISMATCH');
// An enabled switch seed plus a stand-in charge ledger created inside the same transaction: the in-transaction probe
// then writes a price above 0, which is exactly what the kill-switch check exists to catch.
refused(once(inject('create table private.platform_charges(id integer);'), "'enabled', false)", "'enabled', true)"), 'PKG051_KILL_SWITCH_NOT_CLOSED');
// The same enabled switch seed without a charge ledger stays off, so the probe passes and the exact seed check refuses.
refused(once(text, "'enabled', false)", "'enabled', true)"), 'PKG051_SEED_MISMATCH');
// Real pre-existing drift, one per guard that pins state rather than candidate text: a disabled ledger trigger (the
// free path would lose its immutability), HITNO charging a fee or no longer saying so, forced RLS on the config
// table, and a certificate that is no longer consistent.
refused(preInject('alter table private.connection_policy_versions disable trigger connection_policy_versions_immutable_trg;'), 'PKG051_FREE_POLICY_DRIFT');
refused(preInject("update private.marketplace_config set value = jsonb_set(value, '{chargesFee}', 'true') where key = 'urgent_activation_policy';"), 'PKG051_URGENT_POLICY_DRIFT');
refused(preInject("update private.marketplace_config set value = value - 'chargesFee' where key = 'urgent_activation_policy';"), 'PKG051_URGENT_POLICY_DRIFT');
refused(preInject('alter table private.marketplace_config force row level security;'), 'PKG051_CONFIG_SHAPE_DRIFT');
refused(preInject("update private.closure_source_v5 set sha256 = repeat('0', 64) where singleton;"), 'PKG051_CERTIFICATE_NOT_READY');
refused(once(text, "timestamptz '2026-09-23 22:00:00+00'", "timestamptz '2999-01-01 00:00:00+00'"), 'PKG051_CLOCK_BEFORE_SEED');
refused(inject("update private.marketplace_config set updated_at = updated_at + interval '1 second' where key = 'dispatch_normal';"), 'PKG051_CONFIG_CHANGED');
refused(inject('alter function public.rpc_urgent_activation_preview(uuid) security invoker;'), 'PKG051_EXISTING_OBJECT_CHANGED');
refused(inject("update private.closure_source_v5 set sha256 = repeat('0', 64) where singleton;"), 'PKG051_CERTIFICATE_CHANGED');
// A foreign row under a price key: the candidate refuses to share the namespace.
sql("insert into private.marketplace_config(key, value) values ('platform_price:SUBSCRIPTION:000001', '{}'::jsonb);");
assert.throws(() => apply(text), e => { assert.match(e.message, /ERROR:\s+55000: PKG051_CONFIG_KEY_CONFLICT\b/, e.message); return true; });
sql("delete from private.marketplace_config where key = 'platform_price:SUBSCRIPTION:000001';");
intact(); report.tampers.push('PKG051_CONFIG_KEY_CONFLICT');
assert.equal(report.tampers.length, 17, JSON.stringify(report.tampers));
pass('TAMPERS_ROLL_BACK_ATOMICALLY', 'TAMPER');

// 4. Apply once; a second run refuses. Five function lines appear and nothing else in the surface moves; the
//    certificate is byte-identical; the three existing config rows keep value and updated_at; four rows are added.
apply(text);
assert.throws(() => apply(text), e => { assert.match(e.message, /ERROR:\s+55000: PKG051_ALREADY_APPLIED\b/, e.message); return true; });
report.closureAfter = closure();
assert.deepEqual(report.closureAfter, report.closureBefore);
const afterSurface = surface(), removed = baselineSurface.filter(x => !afterSurface.includes(x)), added = afterSurface.filter(x => !baselineSurface.includes(x));
assert.equal(removed.length, 0, JSON.stringify(removed));
assert.equal(added.length, 5, JSON.stringify(added));
assert.ok(added.every(x => NEW_LINE.test(x)), JSON.stringify(added));
report.surface = {removed, added};
const PINS = Object.fromEntries([...text.matchAll(/\('(private\.platform_[a-z_]+\([^']*\))', '([0-9a-f]{32})', '([sv])', '(sql|plpgsql)'\)/g)].map(m => [m[1], m[2]]));
assert.deepEqual(Object.keys(PINS).sort(), Object.values(FN).sort());
report.bodyMd5 = {};
for (const sig of Object.values(FN)) {
  report.bodyMd5[sig] = md5(sig); assert.equal(report.bodyMd5[sig], PINS[sig], sig);
  assert.equal(sql(`select proacl::text || ':' || prosecdef::text || ':' || array_to_string(proconfig, ',') from pg_proc where oid = ${q(sig)}::regprocedure`),
    '{postgres=X/postgres}:false:search_path=pg_catalog', sig);
}
const configAfterApply = configRows();
assert.deepEqual(configAfterApply.filter(r => !isPriceKey(r.key)), configBefore);
const seeded = configAfterApply.filter(r => isPriceKey(r.key));
assert.deepEqual(seeded.map(r => r.key), ['platform_payments', 'platform_price:CONNECTION:000001', 'platform_price:URGENT_BOOST:000001', 'platform_price_head']);
assert.deepEqual(JSON.parse(seeded[0].value), JSON.parse(SWITCH_OFF));
assert.deepEqual(JSON.parse(seeded[1].value), SEED.CONNECTION);
assert.deepEqual(JSON.parse(seeded[2].value), SEED.URGENT_BOOST);
assert.deepEqual(JSON.parse(seeded[3].value), {schema: 'PLATFORM_PRICE_HEAD_V1', heads: {
  CONNECTION: {version: 1, sha256: SEED.CONNECTION.sha256}, URGENT_BOOST: {version: 1, sha256: SEED.URGENT_BOOST.sha256}}});
report.seedSha256 = {CONNECTION: SEED.CONNECTION.sha256, URGENT_BOOST: SEED.URGENT_BOOST.sha256};
pass('APPLIED_ONCE_FIVE_FUNCTIONS_FOUR_ROWS_CERTIFICATE_UNMOVED', 'NEW');

// 5. The readers of the existing rows see exactly what they saw before: the dispatch wave reader of dispatch_normal
//    (same outcome for the same kind of task) and HITNO (still off, still no fee), with unchanged bodies.
report.dispatchAfter = dispatchProbe();
assert.deepEqual(report.dispatchAfter, report.dispatchBefore);
if (report.dispatchAfter.call.ok) {
  assert.equal(report.dispatchAfter.call.ok.urgency, 'NORMAL');
  assert.equal(report.dispatchAfter.call.ok.batchSize, JSON.parse(configBefore.find(r => r.key === 'dispatch_normal').value).waveSizes[0]);
}
report.hitnoAfter = await hitnoPreview();
assert.deepEqual(report.hitnoAfter, report.hitnoBefore);
assert.equal(report.hitnoAfter.allowed, false);
assert.equal(report.hitnoAfter.chargesFee, false);
assert.ok(report.hitnoAfter.reasonCodes.includes('URGENT_POLICY_DISABLED'), JSON.stringify(report.hitnoAfter));
assert.ok(report.hitnoAfter.reasonCodes.includes('URGENT_CATEGORIES_NOT_ADMITTED'), JSON.stringify(report.hitnoAfter));
assert.deepEqual(Object.fromEntries(HITNO.map(sig => [sig, md5(sig)])), report.hitnoBodies);
pass('DISPATCH_AND_HITNO_READERS_UNCHANGED', 'NO_REGRESSION');

// 6. The owner's read: both products at 0 RSD from the seed moment, nothing scheduled, payments off. The stored
//    hashes recompute outside the database. A future version with a Belgrade time lands at the right UTC instant.
assert.deepEqual(listAt("timestamptz '2026-09-23T22:00:00Z'"), LIST_AT_SEED);
const nowList = listAt('clock_timestamp()');
assert.equal(nowList.paymentsEnabled, false);
for (const product of ['CONNECTION', 'URGENT_BOOST']) {
  assert.deepEqual(entry(nowList, product), {product, latestVersion: 1, current: projection(SEED[product]), next: null});
}
assert.deepEqual(stored(), {CONNECTION: [SEED.CONNECTION], URGENT_BOOST: [SEED.URGENT_BOOST]});
assert.equal(sql('select private.platform_payments_enabled()::text'), 'false');
assert.equal(listAt("timestamptz '2026-09-23T21:59:59.999999Z'").products.every(p => p.current === null && p.next?.version === 1), true);
// The owner's form, a Belgrade wall-clock text. The date follows the clock (midnight on the first of the month two
// months ahead), so a later re-run never falls into the past or beyond the writer's 366-day window.
const exampleMonth = new Date(); exampleMonth.setUTCDate(1); exampleMonth.setUTCMonth(exampleMonth.getUTCMonth() + 2);
const exampleLocal = exampleMonth.toISOString().slice(0, 8) + '01 00:00';
const example = rollbackProbe(`select private.platform_price_add_version('CONNECTION', 1, 0, 'REQUESTER', 'HEADCOUNT', ${q(exampleLocal + ' Europe/Belgrade')})::text;
select private.platform_price_list_at(clock_timestamp())::text;
select to_char((timestamp ${q(exampleLocal)} at time zone 'Europe/Belgrade') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');`);
assert.equal(example.length, 3, JSON.stringify(example));
const exampleVersion = JSON.parse(example[0]), exampleList = JSON.parse(example[1]);
assert.equal(exampleVersion.effectiveAt, example[2]);
// Independently of the database's zone rules: that instant is Belgrade midnight at UTC+1 (winter) or UTC+2 (summer).
const belgradeOffset = Date.parse(exampleLocal.replace(' ', 'T') + ':00Z') - Date.parse(exampleVersion.effectiveAt.slice(0, 19) + 'Z');
assert.ok(belgradeOffset === 3600000 || belgradeOffset === 7200000, 'BELGRADE_OFFSET:' + belgradeOffset);
assert.match(exampleVersion.effectiveAt, /T2[23]:00:00\.000000Z$/);
report.belgradeExample = {given: exampleLocal + ' Europe/Belgrade', effectiveAt: exampleVersion.effectiveAt};
assert.equal(exampleVersion.previousSha256, SEED.CONNECTION.sha256);
assert.equal(versionSha(exampleVersion), exampleVersion.sha256);
assert.equal(entry(exampleList, 'CONNECTION').latestVersion, 2);
assert.equal(entry(exampleList, 'CONNECTION').current.version, 1);
assert.deepEqual(entry(exampleList, 'CONNECTION').next, projection(exampleVersion));
assert.deepEqual(configRows(), configAfterApply);
pass('OWNER_READ_RETURNS_ZERO_RSD_FOR_BOTH_PRODUCTS', 'NEW');

// 7. The seed repeats today's canon: Povezivanje is the free policy row (payer, basis, 0 RSD in para), HITNO is 0
//    and its config still charges no fee.
const connection = entry(nowList, 'CONNECTION').current, urgent = entry(nowList, 'URGENT_BOOST').current;
assert.equal(connection.payerRole, FREE_ROW[0].beneficiary_role);
assert.equal(connection.unitBasis, FREE_ROW[0].unit_basis);
assert.equal(connection.amountMinor, FREE_ROW[0].platform_cost_rsd * 100);
assert.equal(urgent.amountMinor, 0);
assert.equal(JSON.parse(configRows().find(r => r.key === 'urgent_activation_policy').value).chargesFee, false);
pass('SEED_MATCHES_FREE_POLICY_AND_HITNO_CONFIG', 'NEW');

// 8. The free Povezivanje path is byte-identical and still works: a real offer and a real selection create the
//    Agreement and a 0 RSD PROMOTIONAL_FREE activation under REQUESTER_SELECTION_V1/1; the ledger stays immutable.
const worker = await rt.actor('pkg051-worker');
const workerProfile = faces(worker.id).WORKER;
sql(`update public.app_profiles set city='Novi Sad', skills='{"Fizicki poslovi"}' where id=${q(workerProfile)};`);
await ok(worker.client.rpc('rpc_complete_worker_profile', {p_profile_id: workerProfile}));
const needId = randomUUID();
sql(`begin;\n${needInsert(needId, 'PKG-051 free selection')}commit;`);
const offer = await ok(worker.client.rpc('rpc_submit_response', {p_need_id: needId, p_need_revision: 1,
  p_worker_profile_id: workerProfile, p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null,
  p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID()}));
const agreementId = await ok(requester.client.rpc('rpc_select_response', {p_need_id: needId, p_need_revision: offer.needRevision,
  p_response_id: offer.responseId, p_response_version: offer.version, p_content_hash: offer.contentHash,
  p_client_request_id: randomUUID()}));
assert.ok(agreementId, 'NO_AGREEMENT');
assert.deepEqual(rows(`select policy_key, policy_version, platform_cost_rsd, state, units from private.connection_activations where agreement_id = ${q(agreementId)}`),
  [{policy_key: 'REQUESTER_SELECTION_V1', policy_version: 1, platform_cost_rsd: 0, state: 'SATISFIED', units: 1}]);
assert.deepEqual(freeRow(), FREE_ROW);
assert.equal(attempt("update private.connection_policy_versions set created_at = created_at where policy_key = 'REQUESTER_SELECTION_V1'"),
  '55000:CONNECTION_LEDGER_IMMUTABLE');
for (const [sig, pin] of Object.entries(FREE_PATH)) assert.equal(md5(sig), pin, sig);
assert.deepEqual(configRows(), configAfterApply);
pass('FREE_SELECTION_PATH_UNCHANGED', 'NO_REGRESSION');

// 9. While payments are off, a price above 0 is refused for either product, now or scheduled, and nothing is written.
for (const [call, product] of [
  ["select private.platform_price_add_version('CONNECTION', 1, 1, 'REQUESTER', 'HEADCOUNT')", 'CONNECTION'],
  ["select private.platform_price_add_version('CONNECTION', 1, 9900, 'REQUESTER', 'FLAT')", 'CONNECTION'],
  ["select private.platform_price_add_version('CONNECTION', 1, 9900, 'WORKER', 'FLAT', clock_timestamp() + interval '30 days')", 'CONNECTION'],
  ["select private.platform_price_add_version('URGENT_BOOST', 1, 19900, 'REQUESTER', 'FLAT')", 'URGENT_BOOST']]) {
  assert.equal(attempt(call), DISABLED(product), call);
  assert.deepEqual(configRows(), configAfterApply);
}
pass('POSITIVE_PRICE_REFUSED_WHILE_PAYMENTS_OFF_NOTHING_WRITTEN', 'NEW');

// 10. The switch fails closed: a missing row, a string "true", no schema, a scalar, an array, an extra key (the
//     architecture's environment field) and even the exact enabled object without a charge ledger all stay off. Only
//     the exact object plus a (stand-in) charge ledger turns payments on. Turning them off again hides a positive
//     current or next price, and a zero version, which can always be appended, makes the list readable again.
//     Every probe is rolled back on the disposable database.
const positive = "select private.platform_price_add_version('CONNECTION', 1, 9900, 'REQUESTER', 'HEADCOUNT')";
for (const [label, value] of [['missing', null],
  ['stringTrue', '{"schema": "PLATFORM_PAYMENTS_SWITCH_V1", "enabled": "true"}'], ['noSchema', '{"enabled": true}'],
  ['scalar', 'true'], ['array', '[true]'], ['extraKey', '{"schema": "PLATFORM_PAYMENTS_SWITCH_V1", "enabled": true, "environment": "SANDBOX"}'],
  ['exactButNoChargeLedger', SWITCH_ON]]) {
  assert.deepEqual(rollbackProbe(`${setSwitch(value)}\nselect private.platform_payments_enabled()::text;\n${tryOf(positive)}`),
    ['false', DISABLED('CONNECTION')], label);
}
const onNow = rollbackProbe(`create table private.platform_charges(id integer);
${setSwitch(SWITCH_ON)}
select private.platform_payments_enabled()::text;
select private.platform_price_add_version('CONNECTION', 1, 9900, 'REQUESTER', 'HEADCOUNT')::text;
select private.platform_price_list_at(clock_timestamp())::text;
${setSwitch(SWITCH_OFF)}
${tryOf('select private.platform_price_list_at(clock_timestamp())')}
${tryOf("select private.platform_price_add_version('CONNECTION', 2, 9900, 'REQUESTER', 'HEADCOUNT')")}
select private.platform_price_add_version('CONNECTION', 2, 0, 'REQUESTER', 'HEADCOUNT')::text;
select private.platform_price_list_at(clock_timestamp())::text;`);
assert.equal(onNow.length, 7, JSON.stringify(onNow));
assert.equal(onNow[0], 'true');
const paid = JSON.parse(onNow[1]), paidList = JSON.parse(onNow[2]), zero = JSON.parse(onNow[5]), zeroList = JSON.parse(onNow[6]);
assert.equal(paid.amountMinor, 9900); assert.equal(paid.version, 2);
assert.equal(paidList.paymentsEnabled, true); assert.deepEqual(entry(paidList, 'CONNECTION').current, projection(paid));
assert.equal(onNow[3], DISABLED('CONNECTION'));
assert.equal(onNow[4], DISABLED('CONNECTION'));
assert.equal(zero.amountMinor, 0); assert.equal(zero.version, 3); assert.equal(zero.previousSha256, paid.sha256);
assert.equal(zeroList.paymentsEnabled, false);
assert.deepEqual(entry(zeroList, 'CONNECTION').current, projection(zero)); assert.equal(entry(zeroList, 'CONNECTION').next, null);
const onNext = rollbackProbe(`create table private.platform_charges(id integer);
${setSwitch(SWITCH_ON)}
select private.platform_price_add_version('CONNECTION', 1, 9900, 'WORKER', 'FLAT', clock_timestamp() + interval '1 day')::text;
${setSwitch(SWITCH_OFF)}
${tryOf('select private.platform_price_list_at(clock_timestamp())')}
select private.platform_price_add_version('CONNECTION', 2, 0, 'REQUESTER', 'HEADCOUNT')::text;
select private.platform_price_list_at(clock_timestamp())::text;
select private.platform_price_list_at(clock_timestamp() + interval '2 days')::text;`);
assert.equal(onNext.length, 5, JSON.stringify(onNext));
const scheduled = JSON.parse(onNext[0]), cancel = JSON.parse(onNext[2]);
assert.equal(scheduled.amountMinor, 9900);
assert.equal(onNext[1], DISABLED('CONNECTION'));
assert.equal(cancel.amountMinor, 0);
for (const line of [onNext[3], onNext[4]]) {
  const e = entry(JSON.parse(line), 'CONNECTION');
  assert.deepEqual(e.current, projection(cancel)); assert.equal(e.next, null);
}
assert.equal(sql("select (to_regclass('private.platform_charges') is null)::text"), 'true');
assert.deepEqual(configRows(), configAfterApply);
pass('SWITCH_FAILS_CLOSED_AND_A_ZERO_VERSION_ALWAYS_APPENDS', 'NEW');

// 11. Later prices are new versions. v2 (WORKER, FLAT, in two days) and v3 (REQUESTER, HEADCOUNT, in one day) chain
//     to their predecessors; the current price is the highest version already in effect, so v3 supersedes v2 before
//     v2 ever starts. v1's stored text never changes and the head names v3.
const v1Text = configAfterApply.find(r => r.key === 'platform_price:CONNECTION:000001').value;
const v2 = addVersion("'CONNECTION', 1, 0, 'WORKER', 'FLAT', clock_timestamp() + interval '2 days'");
const v3 = addVersion("'CONNECTION', 2, 0, 'REQUESTER', 'HEADCOUNT', clock_timestamp() + interval '1 day'");
assert.equal(v2.version, 2); assert.equal(v2.previousSha256, SEED.CONNECTION.sha256); assert.equal(versionSha(v2), v2.sha256);
assert.equal(v3.version, 3); assert.equal(v3.previousSha256, v2.sha256); assert.equal(versionSha(v3), v3.sha256);
assert.ok(v2.effectiveAt > v2.recordedAt && v3.effectiveAt > v3.recordedAt && v3.recordedAt >= v2.recordedAt);
const atNow = listAt('clock_timestamp()'), atMid = listAt("clock_timestamp() + interval '36 hours'"), atLate = listAt("clock_timestamp() + interval '3 days'");
assert.deepEqual(entry(atNow, 'CONNECTION'), {product: 'CONNECTION', latestVersion: 3, current: projection(SEED.CONNECTION), next: projection(v3)});
assert.deepEqual(entry(atMid, 'CONNECTION'), {product: 'CONNECTION', latestVersion: 3, current: projection(v3), next: null});
assert.deepEqual(entry(atLate, 'CONNECTION'), {product: 'CONNECTION', latestVersion: 3, current: projection(v3), next: null});
for (const list of [atNow, atMid, atLate]) assert.deepEqual(entry(list, 'URGENT_BOOST'), {product: 'URGENT_BOOST', latestVersion: 1, current: projection(SEED.URGENT_BOOST), next: null});
assert.equal(configRows().find(r => r.key === 'platform_price:CONNECTION:000001').value, v1Text);
assert.deepEqual(head(), {schema: 'PLATFORM_PRICE_HEAD_V1', heads: {CONNECTION: {version: 3, sha256: v3.sha256}, URGENT_BOOST: {version: 1, sha256: SEED.URGENT_BOOST.sha256}}});
assert.deepEqual(stored().CONNECTION, [SEED.CONNECTION, v2, v3]);
assert.deepEqual(configRows().filter(r => !isPriceKey(r.key)), configBefore);
report.appended = {v2: v2.sha256, v3: v3.sha256};
pass('NEW_VERSIONS_APPEND_OLD_UNCHANGED_CURRENT_BY_EFFECTIVE_TIME', 'NEW');

// 12. Bad input is refused with its own code and writes nothing, including a start in the past (now() is the start
//     of the caller's transaction, so it is already past) and a start more than 366 days ahead.
const configBeforeBad = configRows();
const w = rest => `select private.platform_price_add_version(${rest})`;
for (const [call, expected] of [
  [w("null, 3, 0, 'REQUESTER', 'HEADCOUNT'"), '22023:PRICE_PRODUCT_UNKNOWN'],
  [w("'SUBSCRIPTION', 3, 0, 'REQUESTER', 'HEADCOUNT'"), '22023:PRICE_PRODUCT_UNKNOWN'],
  [w("'CONNECTION', null, 0, 'REQUESTER', 'HEADCOUNT'"), '22023:PRICE_EXPECTED_VERSION_REQUIRED'],
  [w("'CONNECTION', 0, 0, 'REQUESTER', 'HEADCOUNT'"), '22023:PRICE_EXPECTED_VERSION_REQUIRED'],
  [w("'CONNECTION', 3, null, 'REQUESTER', 'HEADCOUNT'"), '22023:PRICE_AMOUNT_INVALID'],
  [w("'CONNECTION', 3, -1, 'REQUESTER', 'HEADCOUNT'"), '22023:PRICE_AMOUNT_INVALID'],
  [w("'CONNECTION', 3, 10000001, 'REQUESTER', 'HEADCOUNT'"), '22023:PRICE_AMOUNT_INVALID'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT', p_currency => 'EUR'"), '22023:PRICE_CURRENCY_UNSUPPORTED'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT', p_currency => null"), '22023:PRICE_CURRENCY_UNSUPPORTED'],
  [w("'CONNECTION', 3, 0, 'BOTH', 'HEADCOUNT'"), '22023:PRICE_PAYER_ROLE_INVALID'],
  [w("'CONNECTION', 3, 0, null, 'HEADCOUNT'"), '22023:PRICE_PAYER_ROLE_INVALID'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'PERCENT'"), '22023:PRICE_UNIT_BASIS_INVALID'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'PRICE_BAND'"), '22023:PRICE_UNIT_BASIS_INVALID'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', null"), '22023:PRICE_UNIT_BASIS_INVALID'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT', clock_timestamp() - interval '1 minute'"), '22023:PRICE_EFFECTIVE_IN_PAST'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT', now()"), '22023:PRICE_EFFECTIVE_IN_PAST'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT', '-infinity'"), '22023:PRICE_EFFECTIVE_IN_PAST'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT', clock_timestamp() + interval '400 days'"), '22023:PRICE_EFFECTIVE_TOO_FAR'],
  [w("'CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT', 'infinity'"), '22023:PRICE_EFFECTIVE_TOO_FAR'],
  ['select private.platform_price_list_at(null)', '22023:PRICE_AS_OF_REQUIRED'],
  ["select private.platform_price_list_at('infinity')", '22023:PRICE_AS_OF_INVALID']]) {
  assert.equal(attempt(call), expected, call);
}
assert.deepEqual(configRows(), configBeforeBad);
pass('WRITER_AND_READER_REFUSE_BAD_INPUT_AND_WRITE_NOTHING', 'NEW');

// 13. The same call twice (a double run in the SQL editor) appends once; the second is stale and names the latest.
const configBeforeTwice = configRows();
assert.equal(attempt("select private.platform_price_add_version('URGENT_BOOST', 1, 0, 'REQUESTER', 'FLAT')"), 'OK');
assert.equal(attempt("select private.platform_price_add_version('URGENT_BOOST', 1, 0, 'REQUESTER', 'FLAT')"), '40001:PRICE_VERSION_STALE:latest=2');
assert.equal(stored().URGENT_BOOST.length, 2);
assert.equal(configRows().length, configBeforeTwice.length + 1);
pass('SAME_CALL_TWICE_IS_STALE', 'NEW');

// 14. Two writers with the same expected version: the second waits on the head row (an observed lock edge, not a
//     sleep), then finds itself stale. Exactly one version is appended and the chain stays valid.
const race = "select private.platform_price_add_version('CONNECTION', 3, 0, 'REQUESTER', 'HEADCOUNT')";
report.raceLoser = await rt.lockedRace(race, () => asyncAttempt(race));
assert.equal(report.raceLoser, '40001:PRICE_VERSION_STALE:latest=4');
const afterRace = stored();
assert.equal(afterRace.CONNECTION.length, 4);
const v4 = afterRace.CONNECTION[3];
assert.equal(v4.previousSha256, v3.sha256); assert.equal(versionSha(v4), v4.sha256);
// v4 takes effect at once and, being the highest version, also cancels the scheduled v2 and v3.
assert.deepEqual(entry(listAt('clock_timestamp()'), 'CONNECTION'), {product: 'CONNECTION', latestVersion: 4, current: projection(v4), next: null});
assert.deepEqual(entry(listAt("clock_timestamp() + interval '3 days'"), 'CONNECTION').current, projection(v4));
pass('CONCURRENT_WRITERS_ONE_WINS', 'NEW');

// 15. Hand edits of the stored rows (rolled back): every read and every write refuses with the reason in DETAIL until
//     the list is repaired. A consistent forgery of a positive price is not served while payments are off, and a zero
//     version can still be appended over it. Two edits by the database owner are NOT detectable, by design of a
//     chain whose head is itself an editable row; they are recorded here as the known limit, not hidden.
const readCall = 'select private.platform_price_versions()', listCall = 'select private.platform_price_list_at(clock_timestamp())';
const writeCall = "select private.platform_price_add_version('CONNECTION', 4, 0, 'REQUESTER', 'HEADCOUNT')";
const V = n => `'platform_price:CONNECTION:${String(n).padStart(6, '0')}'`;
const headTo = (n, source = n) => `update private.marketplace_config set value = jsonb_set(value, '{heads,CONNECTION}',
  jsonb_build_object('version', ${n}, 'sha256', (select v.value->'sha256' from private.marketplace_config v where v.key = ${V(source)})))
  where key = 'platform_price_head';`;
const HAND = [
  ['CONTENT:CONNECTION:1', `update private.marketplace_config set value = jsonb_set(value, '{payerRole}', '"WORKER"') where key = ${V(1)};`],
  ['CONTENT:CONNECTION:1', `update private.marketplace_config set value = jsonb_set(value, '{effectiveAt}', '"2026-02-30T00:00:00.000000Z"') where key = ${V(1)};`],
  ['CONTENT:CONNECTION:1', `update private.marketplace_config set value = jsonb_set(value, '{version}', '1.0') where key = ${V(1)};`],
  ['CONTENT:CONNECTION:1', `update private.marketplace_config set value = value || '{"note": "x"}' where key = ${V(1)};`],
  ['CONTENT:CONNECTION:1', `update private.marketplace_config set value = '0'::jsonb where key = ${V(1)};`],
  ['CHAIN:CONNECTION:2', `update private.marketplace_config c set value = private.platform_price_canonical('CONNECTION', 1, 0, 'RSD', 'WORKER',
    'HEADCOUNT', (c.value->>'effectiveAt')::timestamptz, (c.value->>'recordedAt')::timestamptz, null) where c.key = ${V(1)};`],
  ['HEAD:CONNECTION', `delete from private.marketplace_config where key = ${V(4)};`],
  ['HEAD:MISSING', "delete from private.marketplace_config where key = 'platform_price_head';"],
  ['HEAD:CONNECTION', "update private.marketplace_config set value = jsonb_set(value, '{heads,CONNECTION,version}', '3') where key = 'platform_price_head';"],
  ['GAP:CONNECTION:99', `insert into private.marketplace_config(key, value) select ${V(99)}, private.platform_price_canonical('CONNECTION', 99, 0,
    'RSD', 'REQUESTER', 'HEADCOUNT', n.t, n.t, repeat('0', 64)) from (select clock_timestamp() as t) n;`],
  ['KEY', "insert into private.marketplace_config(key, value) values ('platform_price:SUBSCRIPTION:000001', '{}'::jsonb);"],
  ['KEY', "insert into private.marketplace_config(key, value) values ('platform_prices', '{}'::jsonb);"],
  ['PRODUCT_MISSING:URGENT_BOOST', "delete from private.marketplace_config where starts_with(key, 'platform_price:URGENT_BOOST:');"],
  ['TIME:CONNECTION:4', `update private.marketplace_config c set value = private.platform_price_canonical('CONNECTION', 4, 0, 'RSD', 'REQUESTER',
    'HEADCOUNT', (c.value->>'recordedAt')::timestamptz - interval '1 day', (c.value->>'recordedAt')::timestamptz, c.value->>'previousSha256')
    where c.key = ${V(4)};
${headTo(4)}`]];
report.handEdits = [];
for (const [detail, edit] of HAND) {
  // The reader, the list and the writer (whose own head lock reports HEAD:MISSING) all refuse with the same reason.
  assert.deepEqual(rollbackProbe(`${edit}\n${tryOf(readCall)}\n${tryOf(listCall)}\n${tryOf(writeCall)}`), Array(3).fill(BROKEN(detail)), detail);
  report.handEdits.push(detail);
}
// The clock is read once: platform_price_canonical is never inlined (it has a SET clause), so two clock_timestamp()
// arguments could differ by a microsecond and make the forgery fail the TIME check instead of being consistent.
const forged = rollbackProbe(`insert into private.marketplace_config(key, value)
select ${V(5)}, private.platform_price_canonical('CONNECTION', 5, 9900, 'RSD', 'REQUESTER', 'HEADCOUNT', n.t, n.t, v.value->>'sha256')
  from private.marketplace_config v cross join (select clock_timestamp() as t) n where v.key = ${V(4)};
${headTo(5)}
${tryOf(readCall)}
${tryOf(listCall)}
${tryOf("select private.platform_price_add_version('CONNECTION', 5, 0, 'REQUESTER', 'HEADCOUNT')")}
${tryOf(listCall)}`);
assert.deepEqual(forged, ['OK', DISABLED('CONNECTION'), 'OK', 'OK']);
report.knownLimits = {
  truncateNewestAndPointHeadBack: rollbackProbe(`delete from private.marketplace_config where key = ${V(4)};
${headTo(3)}
${tryOf(readCall)}
${tryOf(listCall)}
select (private.platform_price_list_at(clock_timestamp())->'products'->0->>'latestVersion');`),
  rewriteNewestConsistently: rollbackProbe(`update private.marketplace_config c set value = private.platform_price_canonical('CONNECTION', 4, 0, 'RSD', 'WORKER',
    'FLAT', (c.value->>'effectiveAt')::timestamptz, (c.value->>'recordedAt')::timestamptz, c.value->>'previousSha256') where c.key = ${V(4)};
${headTo(4)}
${tryOf(readCall)}
${tryOf(listCall)}
select (private.platform_price_list_at(clock_timestamp())->'products'->0->'current'->>'payerRole');`),
  // A consistent version dated back to v4's recording moment: the price in effect at that past moment changes.
  backdatedConsistentVersion: rollbackProbe(`select private.platform_price_list_at((select (value->>'recordedAt')::timestamptz from private.marketplace_config where key = ${V(4)}))->'products'->0->'current'->>'version';
insert into private.marketplace_config(key, value)
select ${V(5)}, private.platform_price_canonical('CONNECTION', 5, 0, 'RSD', 'WORKER', 'FLAT', (v.value->>'recordedAt')::timestamptz,
  (v.value->>'recordedAt')::timestamptz, v.value->>'sha256') from private.marketplace_config v where v.key = ${V(4)};
${headTo(5)}
${tryOf(readCall)}
select private.platform_price_list_at((select (value->>'recordedAt')::timestamptz from private.marketplace_config where key = ${V(4)}))->'products'->0->'current'->>'version';`)};
assert.deepEqual(report.knownLimits.truncateNewestAndPointHeadBack, ['OK', 'OK', '3']);
assert.deepEqual(report.knownLimits.rewriteNewestConsistently, ['OK', 'OK', 'WORKER']);
assert.deepEqual(report.knownLimits.backdatedConsistentVersion, ['4', 'OK', '5']);
assert.deepEqual(stored(), afterRace);
pass('HAND_EDITS_FAIL_CLOSED_AND_THE_KNOWN_LIMIT_IS_RECORDED', 'NEW');

// 16. Access: the grants are exactly the owner's, and the config table's ACL and RLS flags are unchanged.
//     The PostgREST probes are BASELINE: `private` is not an exposed schema, so PGRST202 holds whatever a function's
//     ACL says. What carries the claim is the SQL probe below: each API role is given USAGE on `private` inside a
//     rolled-back transaction, so the only barrier left is EXECUTE, and the refusal must name the function itself.
//     On the predecessor that probe gives 42883 (no such function); a stray grant would let the call through or
//     fail on something else.
const stranger = await rt.actor('pkg051-stranger');
report.restRefusals = []; report.restRefusalsKind = 'BASELINE';
for (const [label, client] of [['anon', rt.anon], ['signedIn', stranger.client], ['service', rt.service]]) {
  for (const [fn, args] of [['platform_price_list_at', {p_at: new Date().toISOString()}], ['platform_price_versions', {}],
    ['platform_payments_enabled', {}], ['platform_price_add_version', {p_product: 'CONNECTION', p_expected_latest_version: 4,
      p_amount_minor: 0, p_payer_role: 'REQUESTER', p_unit_basis: 'HEADCOUNT'}],
    ['platform_price_canonical', {p_product: 'CONNECTION', p_version: 1, p_amount_minor: 0, p_currency: 'RSD', p_payer_role: 'REQUESTER',
      p_unit_basis: 'HEADCOUNT', p_effective_at: SEED_AT, p_recorded_at: SEED_AT, p_previous_sha256: null}]]) {
    const r = await client.rpc(fn, args);
    assert.ok(r.error, 'EXPECTED_REFUSAL:' + label + ':' + fn);
    assert.equal(r.error.code, 'PGRST202', label + ':' + fn + ':' + r.error.message);
    report.restRefusals.push(label + ':' + fn + ':' + r.error.code);
  }
}
const refusedAs = (role, stmt) => {
  let error;
  try { sql(`\\set VERBOSITY verbose\nbegin;\ngrant usage on schema private to ${role};\nset local role ${role};\n${stmt};\nrollback;`); } catch (e) { error = e; }
  assert.ok(error, 'EXPECTED_SQL_REFUSAL:' + role + ':' + stmt);
  const m = /ERROR:\s+([0-9A-Z]{5}): ([^\n]*)/.exec(error.message);
  assert.ok(m, error.message);
  return m[1] + ':' + m[2].trim();
};
report.sqlRefusals = [];
for (const role of ['anon', 'authenticated', 'service_role']) {
  for (const [fn, stmt] of [['platform_price_list_at', 'select private.platform_price_list_at(now())'],
    ['platform_price_versions', 'select private.platform_price_versions()'],
    ['platform_payments_enabled', 'select private.platform_payments_enabled()'],
    ['platform_price_add_version', writeCall],
    ['platform_price_canonical', "select private.platform_price_canonical('CONNECTION', 1, 0, 'RSD', 'REQUESTER', 'HEADCOUNT', now(), now(), null)"]]) {
    const r = refusedAs(role, stmt);
    assert.equal(r, '42501:permission denied for function ' + fn, role + ':' + stmt);
    report.sqlRefusals.push(role + ':' + r);
  }
}
assert.equal(sql("select has_schema_privilege('anon', 'private', 'USAGE')::text || has_schema_privilege('authenticated', 'private', 'USAGE')::text || has_schema_privilege('service_role', 'private', 'USAGE')::text"),
  'falsefalsefalse');
for (const sig of Object.values(FN)) {
  assert.equal(sql(`select proacl::text from pg_proc where oid = ${q(sig)}::regprocedure`), '{postgres=X/postgres}', sig);
  assert.equal(sql(`select has_function_privilege('anon', ${q(sig)}, 'EXECUTE')::text || has_function_privilege('authenticated', ${q(sig)}, 'EXECUTE')::text || has_function_privilege('service_role', ${q(sig)}, 'EXECUTE')::text`), 'falsefalsefalse', sig);
}
assert.ok(afterSurface.includes('table:private.marketplace_config:rls=true:force=false:acl=default'));
pass('API_AND_ROLES_CANNOT_REACH_THE_PRICE_LIST', 'NEW');

// 17. Price writes are data: after every committed write above, the certificate and the surface are exactly where
//     the application left them, and the existing config rows are untouched.
assert.deepEqual(closure(), report.closureBefore);
assert.deepEqual(surface(), afterSurface);
assert.deepEqual(configRows().filter(r => !isPriceKey(r.key)), configBefore);
report.finalHead = head();
pass('PRICE_WRITES_NEVER_MOVE_CERTIFICATE_OR_SURFACE', 'NO_REGRESSION');
report.result = 'PASS'; save();
