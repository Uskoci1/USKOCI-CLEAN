// Disposable fixture/read proof only. Never publication or production business proof.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../supabase/proofs/ru5_device_ui_local_guard.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha = value => createHash('sha256').update(value).digest('hex');
const uuid = value => { assert.equal(typeof value, 'string'); assert.equal(value.length, 36); assert.match(value, UUID); return value; };
const quote = value => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;

export function assertDiscoveryEnvironment(env) {
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(env.RU5_DEVICE_PACKAGE, 'rs.uskoci.n04proof');
  assert.equal(typeof env.GITHUB_SHA, 'string'); assert.equal(env.GITHUB_SHA.length, 40); assert.match(env.GITHUB_SHA, /^[0-9a-f]{40}$/);
  for (const name of ['RU5_DEVICE_REQUESTER_USER_ID', 'RU5_DEVICE_WORKER_USER_ID', 'RU5_DEVICE_NEED_ID']) uuid(env[name]);
  assert.notEqual(env.RU5_DEVICE_REQUESTER_USER_ID, env.RU5_DEVICE_WORKER_USER_ID);
  assert.ok(env.RU5_DEVICE_ARTIFACT_DIR, 'Explicit disposable artifact directory required');
}

export function fixturePlan(newId = randomUUID) {
  const plan = Array.from({ length: 34 }, (_, i) => {
    const n = i + 1;
    return { id: uuid(newId()), ordinal: n, title: `DISCOVERY_${String(n).padStart(2, '0')}_Lokalni_zadatak`,
      executionMode: n === 3 ? 'REMOTE' : 'STATIONARY', scheduleKind: n === 3 ? 'REMOTE_ANYTIME' : 'FLEXIBLE',
      city: n === 3 ? '' : 'Kragujevac', area: n === 3 ? '' : 'Priblizno podrucje',
      lat: [1, 2, 5].includes(n) ? 44.1 : null,
      lng: n === 1 ? 20.8 : n === 2 ? 20.81 : n === 5 ? 22.4 : null,
      mode: n % 2 === 0 || n === 5 ? 'MY_PRICE' : 'OFFERS',
      price: n % 2 === 0 || n === 5 ? 1200 + n * 100 : null,
      required: 2, privateSentinel: `LOCAL_ONLY_PRIVATE_DISCOVERY_${n}` };
  });
  assert.equal(new Set(plan.map(row => row.id)).size, plan.length);
  return plan;
}

const businessTables = [
  'public.app_profiles', 'public.ai_conversations', 'public.ai_messages', 'public.ai_structured_facts', 'public.agreement_messages',
  'public.needs', 'public.need_sensitive', 'public.marketplace_responses', 'public.need_selections', 'public.agreements',
  'public.user_activity_events', 'public.notification_deliveries', 'public.notification_preferences', 'public.notification_push_attempts',
  'private.connection_activations', 'private.publication_policy_bundles', 'private.need_publication_decisions',
  'private.preselection_qa_questions', 'private.preselection_qa_commands',
];

export function snapshotSql(table, excludedIds = []) {
  assert.ok(businessTables.includes(table), 'Snapshot table must be allowlisted');
  let where = '';
  if (excludedIds.length) {
    assert.ok(['public.needs', 'public.need_sensitive'].includes(table));
    where = ` where ${table === 'public.needs' ? 'id' : 'need_id'} not in (${excludedIds.map(id => quote(uuid(id))).join(',')})`;
  }
  return `select json_build_object('count',count(*),'hash',md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')))::text from ${table} t${where}`;
}

export function sourceReaders(client) {
  const allowed = new Map([
    ['src/data/discoveryClientService.ts', './discoveryClientService'],
    ['src/data/publicProfileClientService.ts', './publicProfileClientService'],
    ['src/data/discoveryView.ts', './discoveryView'],
    ['src/data/discoveryFormat.ts', './discoveryFormat'],
    ['src/data/publicTaskDetailProjection.ts', './publicTaskDetailProjection'],
  ]);
  const modules = new Map();
  const fingerprints = [];
  const load = specifier => {
    if (specifier === './supabaseClient') return { supabaseKlijent: () => client };
    const path = [...allowed].find(([, key]) => key === specifier)?.[0];
    assert.ok(path, 'Unexpected production source import in disposable read proof');
    if (modules.has(path)) return modules.get(path);
    const raw = readFileSync(join(ROOT, path));
    fingerprints.push({ path, bytes: raw.length, sha256: sha(raw) });
    const compiled = ts.transpileModule(raw.toString('utf8'), { fileName: path,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} }; modules.set(path, module.exports);
    vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, Map, Set, AbortController, Error, Promise, console },
      { filename: path, timeout: 10000 })(load, module, module.exports);
    return module.exports;
  };
  return { service: load('./discoveryClientService').discoveryClientService,
    pins: load('./discoveryView').discoveryPins, fingerprints };
}

export async function main(env = process.env, mode = process.argv[2]) {
  assertDiscoveryEnvironment(env); // First: no client, SQL, file mutation or supplied URL logging before this.
  assert.ok(mode === 'seed' || mode === 'postflight', 'Use seed or postflight');
  const sql = query => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const snapshot = () => Object.fromEntries(businessTables.map(table => [table, JSON.parse(sql(snapshotSql(table)))]));
  const history = () => JSON.parse(sql("select json_build_object('count',count(*),'head',max(version),'hash',md5(string_agg(row_to_json(h)::text,E'\\n' order by version))) from supabase_migrations.schema_migrations h"));
  const artifact = resolve(env.RU5_DEVICE_ARTIFACT_DIR);
  const path = join(artifact, 'shared-discovery-fixture.json');
  const currentHistory = history();
  assert.equal(currentHistory.count, 79); assert.equal(currentHistory.head, '20260906141409');
  if (mode === 'postflight') {
    const recorded = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(recorded.sourceSha, env.GITHUB_SHA); assert.equal(recorded.localOnly, true);
    assert.deepEqual(currentHistory, recorded.history);
    const after = snapshot(); assert.deepEqual(after, recorded.beforeJourney);
    writeFileSync(join(artifact, 'shared-discovery-postflight.json'), JSON.stringify({ sourceSha: env.GITHUB_SHA,
      localOnly: true, businessRowsUnchanged: true, historyUnchanged: true, tables: after,
      scope: 'All rows of the explicitly listed business tables, new discovery journey only; preceding inherited N04 fixtures/read marks are outside this frozen interval. Auth sessions legitimately change.' }, null, 2) + '\n');
    console.log('PASS SHARED_DISCOVERY_POSTFLIGHT listed_full_business_rows_and_history_unchanged auth_sessions_excluded');
    return;
  }
  mkdirSync(artifact, { recursive: true });
  const navigation = JSON.parse(readFileSync(join(artifact, 'navigation-fixture.json'), 'utf8'));
  assert.equal(navigation.localOnly, true); assert.equal(navigation.sourceSha, env.GITHUB_SHA);
  assert.equal(navigation.requesterId, env.RU5_DEVICE_REQUESTER_USER_ID); uuid(navigation.needId);
  const initial = snapshot();
  const profileId = uuid(sql(`select id from public.app_profiles where account_id=${quote(env.RU5_DEVICE_REQUESTER_USER_ID)}::uuid and kind='REQUESTER' and profile_status='ACTIVE'`));
  const plan = fixturePlan();
  // Exact canonical source supplies this schema. Do not create a second schema,
  // add grants, bypass RLS in the app, or alter the historical migration record.
  const columns = JSON.parse(sql("select json_object_agg(column_name,data_type) from information_schema.columns where table_schema='public' and table_name='needs'"));
  for (const name of ['execution_location_mode', 'schedule_kind', 'approximate_city', 'approximate_area']) assert.equal(columns[name], 'text');
  for (const name of ['approximate_lat', 'approximate_lng']) assert.equal(columns[name], 'numeric');
  for (const name of ['created_at', 'starts_at', 'ends_at', 'response_deadline']) assert.equal(columns[name], 'timestamp with time zone');
  assert.equal(columns.required_slots, 'integer');
  assert.equal(sql("select count(*) from public.needs where title like 'DISCOVERY_%'"), '0');
  const rows = plan.map(row => `(${quote(row.id)},${quote(env.RU5_DEVICE_REQUESTER_USER_ID)},${quote(profileId)},'PUBLISHED',${quote(row.title)},
    'Disposable shared discovery fixture','PROOF',${quote(row.city)},${quote(row.area)},${row.lat ?? 'null'},${row.lng ?? 'null'},
    ${quote(row.executionMode)},${quote(row.scheduleKind)},${quote(row.mode)},${row.price ?? 'null'},2,
    statement_timestamp()+interval '2 days',statement_timestamp(),statement_timestamp()-${row.ordinal}*interval '1 millisecond')`).join(',');
  sql(`begin; select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,approximate_lat,approximate_lng,execution_location_mode,schedule_kind,mode,requester_price_rsd,
      required_slots,response_deadline,published_at,created_at) values ${rows};
    insert into public.need_sensitive(need_id,exact_address,access_notes) values ${plan.map(row => `(${quote(row.id)},${quote(row.privateSentinel)},'LOCAL_PRIVATE_ACCESS_NOTE')`).join(',')};
    select set_config('uskoci.need_lifecycle','',true); commit;`);
  const afterSeed = snapshot();
  assert.equal(afterSeed['public.needs'].count, initial['public.needs'].count + 34);
  assert.equal(afterSeed['public.need_sensitive'].count, initial['public.need_sensitive'].count + 34);
  for (const table of ['public.needs', 'public.need_sensitive']) {
    assert.deepEqual(JSON.parse(sql(snapshotSql(table, plan.map(row => row.id)))), initial[table]);
  }
  for (const table of businessTables.filter(name => !['public.needs', 'public.need_sensitive'].includes(name))) assert.deepEqual(afterSeed[table], initial[table]);
  assert.deepEqual(history(), currentHistory);
  const allPublic = JSON.parse(sql("select coalesce(json_agg(json_build_object('id',id,'title',title) order by created_at desc,id desc),'[]') from public.needs where status in ('PUBLISHED','SELECTION')"));
  assert.equal(allPublic.length, 35); // New34 plus the preserved existing NAV row.
  assert.deepEqual(allPublic.slice(0, 34).map(row => row.id), plan.map(row => row.id));
  const observations = [];
  for (const [role, account, email] of [['requester', env.RU5_DEVICE_REQUESTER_USER_ID, env.RU5_DEVICE_REQUESTER_EMAIL],
    ['worker', env.RU5_DEVICE_WORKER_USER_ID, env.RU5_DEVICE_WORKER_EMAIL]]) {
    const calls = [];
    const client = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (url, options = {}) => {
        const target = new URL(String(url)), method = options.method ?? 'GET';
        assert.equal(target.origin, 'http://127.0.0.1:54321');
        assert.ok((method === 'GET' && ['/rest/v1/needs', '/rest/v1/need_sensitive', '/auth/v1/user'].includes(target.pathname))
          || (method === 'POST' && ['/auth/v1/token', '/rest/v1/rpc/rpc_get_public_profile'].includes(target.pathname)), 'Unexpected local read request');
        const response = await fetch(url, { ...options, redirect: 'error' });
        calls.push({ path: target.pathname, method, status: response.status }); return response;
      } },
    });
    const login = await client.auth.signInWithPassword({ email, password: env.RU5_DEVICE_PASSWORD });
    assert.equal(login.error, null); assert.equal(login.data.user.id, account);
    const { service, pins, fingerprints } = sourceReaders(client);
    const first = await service.otvorenePrilikeStrana(), second = await service.otvorenePrilikeStrana({ cursor: first.nextCursor });
    assert.equal(first.items.length, 30); assert.equal(second.items.length, 5); assert.equal(second.nextCursor, null);
    const items = [...first.items, ...second.items];
    assert.deepEqual(items.map(item => item.id), allPublic.map(row => row.id));
    assert.deepEqual(pins(items).features.map(feature => feature.id), plan.filter(row => row.lat !== null).map(row => row.id));
    assert.equal(JSON.stringify(items).includes('LOCAL_ONLY_PRIVATE'), false);
    for (const row of plan) {
      const item = items.find(value => value.id === row.id);
      assert.equal(item.executionLocationMode, row.executionMode); assert.equal(item.scheduleKind, row.scheduleKind);
      assert.equal(item.pokrivenost.ukupno, 2); assert.equal(item.pokrivenost.popunjeno, 0);
      assert.equal(item.rezimCene, row.mode);
      if (row.mode === 'MY_PRICE') {
        assert.equal(item.ponudjenaCena.iznos, row.price); assert.equal(item.ponudjenaCena.valuta, 'RSD');
      } else assert.equal(item.ponudjenaCena, undefined);
      if (row.lat === null) assert.equal(item.priblizno, null);
    }
    if (role === 'worker') {
      const sensitive = await client.from('need_sensitive').select('need_id,exact_address').in('need_id', plan.map(row => row.id));
      assert.equal(sensitive.error, null); assert.deepEqual(sensitive.data, []);
    }
    observations.push({ role, firstPageIds: first.items.map(item => item.id), allIds: items.map(item => item.id),
      pinIds: pins(items).features.map(feature => feature.id), calls, source: fingerprints });
  }
  assert.deepEqual(snapshot(), afterSeed);
  writeFileSync(path, JSON.stringify({ sourceSha: env.GITHUB_SHA, localOnly: true, publicationProof: false,
    providerProof: false, historicalBoundary: 'Reconstructed79 plus exact N02/N03 candidates; not a full live87 replay',
    history: currentHistory, plan, allPublic, observations, beforeJourney: afterSeed,
    requesterId: env.RU5_DEVICE_REQUESTER_USER_ID, workerId: env.RU5_DEVICE_WORKER_USER_ID }, null, 2) + '\n');
  console.log('PASS SHARED_DISCOVERY_FIXTURE 34_real_local_rows 35_public 30_plus5 actual_source_both_actors same_ids 3_pins remote_no_pin private_rls');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`SHARED_DISCOVERY_FIXTURE_FAILED ${error?.name ?? 'Error'}`);
    // Only source locations; never assertion payload, SQL, URL, headers or command argv.
    for (const location of String(error?.stack ?? '').matchAll(/shared_discovery_fixture\.mjs:(\d+):(\d+)/g)) {
      console.error(`FAILURE_FRAME shared_discovery_fixture.mjs:${location[1]}:${location[2]}`);
    }
    process.exitCode = 1;
  });
}
