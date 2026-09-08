// Public material read proof. Only an explicitly guarded disposable local stack.
// Setup creates declared fixture rows; the subsequent SDK/native interval is read-only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertDiscoveryEnvironment, sourceReaders } from './shared_discovery_fixture.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const uuid = value => {
  assert.equal(typeof value, 'string'); assert.equal(value.length, 36);
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i); return value;
};

export function assertMaterialEnvironment(env) {
  assertDiscoveryEnvironment(env);
  assert.equal(env.RU5_DEVICE_PROOF_DIR, '/tmp/uskoci-ru5-device-ui');
}

export function assertMaterialRequest(input, init = {}, phase = 'read', privateProbe = false) {
  assert.ok(phase === 'setup' || phase === 'read');
  const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert.equal(target.origin, 'http://127.0.0.1:54321', 'PUBLIC_MATERIAL_NONLOCAL_HTTP');
  assert.ok(!target.username && !target.password && !target.hash);
  const method = String(init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const allowed = {
    '/rest/v1/needs': ['GET'], '/rest/v1/rpc/rpc_get_public_profile': ['POST'],
    '/auth/v1/user': ['GET'],
  };
  if (privateProbe) allowed['/rest/v1/need_sensitive'] = ['GET'];
  if (phase === 'setup') {
    allowed['/auth/v1/token'] = ['POST'];
    allowed['/auth/v1/admin/users'] = ['POST'];
    allowed['/rest/v1/rpc/rpc_submit_response'] = ['POST'];
    allowed['/rest/v1/rpc/rpc_select_response'] = ['POST'];
  }
  assert.ok(allowed[target.pathname]?.includes(method), 'PUBLIC_MATERIAL_HTTP_BOUNDARY');
  if (target.pathname === '/auth/v1/token') assert.equal(target.searchParams.get('grant_type'), 'password');
  return { method, path: target.pathname };
}

export function rowSnapshotSql(table) {
  assert.equal(typeof table, 'string');
  assert.match(table, /^(public|private)\.[a-z_][a-z0-9_]*$/);
  assert.ok(!table.includes('\n'));
  return `select coalesce(jsonb_agg(h order by h),'[]'::jsonb)::text from
    (select md5(to_jsonb(t)::text) h from ${table} t) row_hashes`;
}

export function assertOriginalRowsPreserved(original, current) {
  assert.deepEqual(Object.keys(current).sort(), Object.keys(original).sort(), 'PUBLIC_MATERIAL_TABLE_INVENTORY_CHANGED');
  for (const [table, rows] of Object.entries(original)) {
    const remaining = new Map();
    for (const hash of current[table]) remaining.set(hash, (remaining.get(hash) ?? 0) + 1);
    for (const hash of rows) {
      assert.ok((remaining.get(hash) ?? 0) > 0, 'PUBLIC_MATERIAL_ORIGINAL_ROW_CHANGED');
      remaining.set(hash, remaining.get(hash) - 1);
    }
  }
}
const summary = rows => Object.fromEntries(Object.entries(rows).map(([table, hashes]) =>
  [table, { count: hashes.length, sha256: sha(JSON.stringify(hashes)) }]));

function schemaSql() {
  return `select jsonb_build_object(
    'relations',(select jsonb_agg(to_jsonb(x) order by oid) from
      (select c.oid,c.relname,c.relnamespace,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text
       from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','rls_private')) x),
    'columns',(select jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum) from pg_attribute a
      join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private','rls_private') and a.attnum>0),
    'constraints',(select jsonb_agg(to_jsonb(x) order by oid) from
      (select p.oid,pg_get_constraintdef(p.oid) definition from pg_constraint p
       join pg_namespace n on n.oid=p.connamespace where n.nspname in ('public','private','rls_private')) x),
    'defaults',(select jsonb_agg(to_jsonb(x) order by oid) from
      (select d.oid,d.adrelid,d.adnum,pg_get_expr(d.adbin,d.adrelid) definition from pg_attrdef d
       join pg_class c on c.oid=d.adrelid join pg_namespace n on n.oid=c.relnamespace
       where n.nspname in ('public','private','rls_private')) x),
    'indexes',(select jsonb_agg(to_jsonb(x) order by oid) from
      (select c.oid,pg_get_indexdef(c.oid) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname in ('public','private','rls_private') and c.relkind='i') x),
    'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p join pg_class c on c.oid=p.polrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','rls_private')),
    'triggers',(select jsonb_agg(to_jsonb(x) order by oid) from
      (select t.oid,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid
       join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','rls_private')) x),
    'functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'hash',md5(to_jsonb(p)::text)) order by p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','rls_private'))
  )::text`;
}

export async function main(env = process.env, mode = process.argv[2]) {
  assertMaterialEnvironment(env); // Must precede SQL, clients and filesystem mutations.
  assert.ok(['seed', 'postflight'].includes(mode));
  const sql = text => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const parsed = text => JSON.parse(sql(text));
  const history = () => parsed(`select jsonb_build_object('count',count(*),'head',max(version),
    'hash',md5(coalesce(string_agg(to_jsonb(h)::text,E'\\n' order by version),''))) from supabase_migrations.schema_migrations h`);
  const currentHistory = history();
  assert.equal(currentHistory.count, 79); assert.equal(currentHistory.head, '20260906141409');
  const tables = parsed(`select coalesce(jsonb_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname),'[]')
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind in ('r','p')`);
  const snapshot = () => Object.fromEntries(tables.map(table => [table, parsed(rowSnapshotSql(table))]));
  const metadata = () => sha(sql(schemaSql()));
  const artifact = resolve(env.RU5_DEVICE_ARTIFACT_DIR);
  const fixturePath = join(artifact, 'public-task-material-fixture.json');
  const gateQuery = `select jsonb_build_object(
    'publicationBundles',(select count(*) from private.publication_policy_bundles),
    'publicationDecisions',(select count(*) from private.need_publication_decisions),
    'freePolicy',(select count(*) from private.connection_policy_versions where policy_key='REQUESTER_SELECTION_V1'
      and version=1 and beneficiary_role='REQUESTER' and activation_reason='SELECTION' and charge_mode='PROMOTIONAL_FREE'
      and unit_basis='HEADCOUNT' and platform_cost_rsd=0),
    'pushAttempts',(select count(*) from public.notification_push_attempts))`;
  const gates = () => parsed(gateQuery);
  if (mode === 'postflight') {
    const recorded = JSON.parse(readFileSync(fixturePath, 'utf8'));
    assert.equal(recorded.result, 'PASS'); assert.equal(recorded.sourceSha, env.GITHUB_SHA);
    assert.equal(recorded.localOnly, true); assert.equal(recorded.publicationProof, false);
    assert.deepEqual(history(), recorded.history);
    assert.equal(metadata(), recorded.schemaHash);
    assert.deepEqual(gates(), recorded.gates);
    const after = summary(snapshot()); assert.deepEqual(after, recorded.beforeJourney);
    writeFileSync(join(artifact, 'public-task-material-postflight.json'), JSON.stringify({
      observedAt: new Date().toISOString(), sourceSha: env.GITHUB_SHA, localOnly: true, result: 'PASS',
      allPublicPrivateRowsUnchanged: true, schemaUnchanged: true, fullHistoryUnchanged: true,
      gatesUnchanged: true, tables: after, authSessionsExcluded: true,
    }, null, 2) + '\n');
    console.log('PASS PUBLIC_TASK_MATERIAL_POSTFLIGHT all_public_private_rows schema history gates unchanged');
    return;
  }
  mkdirSync(artifact, { recursive: true });
  let stage = 'INITIAL_CATALOG';
  try {
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), env.GITHUB_SHA);
    const original = snapshot(), originalSchema = metadata(), initialGates = gates();
    assert.deepEqual(initialGates, { publicationBundles: 0, publicationDecisions: 0, freePolicy: 1, pushAttempts: 0 });
    const childCatalog = parsed(`select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,
      'authenticatedSelect',has_table_privilege('authenticated',c.oid,'SELECT'),'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),
      'primaryNeedId',(select count(*) from pg_constraint p where p.conrelid=c.oid and p.contype='p'
        and pg_get_constraintdef(p.oid)='PRIMARY KEY (need_id)'),
      'foreignNeedId',(select count(*) from pg_constraint p where p.conrelid=c.oid and p.contype='f'
        and p.confrelid='public.needs'::regclass)) order by c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('need_geography','need_requirement_details')`);
    assert.equal(childCatalog.length, 2);
    for (const child of childCatalog) assert.deepEqual({ ...child, table: undefined }, {
      table: undefined, rls: true, authenticatedSelect: true, anonSelect: false, primaryNeedId: 1, foreignNeedId: 1,
    });
    const trace = []; let phase = 'setup';
    function client(key = env.RU5_DEVICE_ANON_KEY, privateProbe = false) {
      return createClient(env.RU5_DEVICE_SUPABASE_URL, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (input, init = {}) => {
          const safe = assertMaterialRequest(input, init, phase, privateProbe);
          const signals = [AbortSignal.timeout(15_000), init.signal].filter(Boolean);
          const response = await fetch(input, { ...init, redirect: 'error', signal: AbortSignal.any(signals) });
          trace.push({ ...safe, phase, status: response.status }); return response;
        } },
      });
    }
    const ok = async pending => {
      const response = await pending;
      assert.equal(response.error, null, 'PUBLIC_MATERIAL_LOCAL_AUTH_OR_COMMAND_FAILED');
      return response.data;
    };
    const requester = client(), worker = client(), outsider = client(), anon = client(), privateReader = client(undefined, true);
    stage = 'LOCAL_AUTH_SETUP';
    for (const [sdk, email, account] of [
      [requester, env.RU5_DEVICE_REQUESTER_EMAIL, env.RU5_DEVICE_REQUESTER_USER_ID],
      [worker, env.RU5_DEVICE_WORKER_EMAIL, env.RU5_DEVICE_WORKER_USER_ID],
      [privateReader, env.RU5_DEVICE_WORKER_EMAIL, env.RU5_DEVICE_WORKER_USER_ID],
    ]) assert.equal((await ok(sdk.auth.signInWithPassword({ email, password: env.RU5_DEVICE_PASSWORD }))).user.id, account);
    const admin = client(env.RU5_DEVICE_SERVICE_ROLE_KEY);
    const outsiderEmail = `public-material-outsider-${randomUUID()}@proof.invalid`, password = `Material${randomUUID()}Aa1`;
    const outsiderId = uuid((await ok(admin.auth.admin.createUser({ email: outsiderEmail, password, email_confirm: true,
      user_metadata: { first_name: 'Local', last_name: 'Outsider', city: 'Grad' } }))).user.id);
    assert.equal((await ok(outsider.auth.signInWithPassword({ email: outsiderEmail, password }))).user.id, outsiderId);
    const profileId = uuid(sql(`select id from public.app_profiles where account_id=${quote(env.RU5_DEVICE_REQUESTER_USER_ID)} and kind='REQUESTER' and profile_status='ACTIVE'`));
    const workerProfileId = uuid(sql(`select id from public.app_profiles where account_id=${quote(env.RU5_DEVICE_WORKER_USER_ID)} and kind='WORKER' and profile_status='ACTIVE'`));
    const publicNeedId = randomUUID(), legacyNeedId = randomUUID(), terminalNeedId = randomUUID();
    const sentinel = `LOCAL_PRIVATE_MATERIAL_${randomUUID()}`;
    const expected = { title: 'PUBLIC_MATERIAL_Javni_prevoz', description: 'Dve osobe prenose nekoliko kutija između dva područja.',
      category: 'Selidbe', skills: ['Prenos'], tools: ['Kolica'], vehicles: ['Kombi'], licenses: ['B'],
      minimumExperience: 2, verifiedIdentityRequired: true,
      topology: { mode: 'POINT_TO_POINT', start: { city: 'Grad A', area: 'Centar' }, end: { city: 'Grad B', area: 'Zapad' } },
      criticalConditions: ['Drugi sprat bez lifta', 'Potrebne zaštitne rukavice'] };
    stage = 'DECLARED_LOCAL_MATERIAL_SETUP';
    sql(`begin; select set_config('uskoci.need_lifecycle','PUBLISH',true);
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
        approximate_city,approximate_area,execution_location_mode,schedule_kind,starts_at,ends_at,mode,required_slots,
        required_skills,required_tools,required_vehicles,required_licenses,minimum_experience_years,verified_identity_required,
        response_deadline,published_at)
      values(${quote(publicNeedId)},${quote(env.RU5_DEVICE_REQUESTER_USER_ID)},${quote(profileId)},'PUBLISHED',
        ${quote(expected.title)},${quote(expected.description)},${quote(expected.category)},'Grad A','Centar','POINT_TO_POINT','FIXED_WINDOW',
        statement_timestamp()+interval '3 days',statement_timestamp()+interval '3 days 2 hours','OFFERS',2,
        array['Prenos'],array['Kolica'],array['Kombi'],array['B'],2,true,statement_timestamp()+interval '2 days',statement_timestamp());
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
        approximate_city,approximate_area,execution_location_mode,schedule_kind,mode,required_slots,response_deadline,published_at)
      values(${quote(legacyNeedId)},${quote(env.RU5_DEVICE_REQUESTER_USER_ID)},${quote(profileId)},'PUBLISHED',
        'PUBLIC_MATERIAL_Nedostupan_dodatak','Stariji zadatak bez dodatnih javnih redova.','PROOF','Grad','Centar','STATIONARY','FLEXIBLE','OFFERS',1,
        statement_timestamp()+interval '2 days',statement_timestamp()),
        (${quote(terminalNeedId)},${quote(env.RU5_DEVICE_REQUESTER_USER_ID)},${quote(profileId)},'PUBLISHED',
        'PUBLIC_MATERIAL_Zatvorene_prijave','Zadatak za stvarni izbor učesnika u lokalnom dokazu.','PROOF','Grad','Centar','STATIONARY','FLEXIBLE','OFFERS',1,
        statement_timestamp()+interval '2 days',statement_timestamp());
      insert into public.need_geography(need_id,public_topology) values
        (${quote(publicNeedId)},${quote(JSON.stringify(expected.topology))}::jsonb),
        (${quote(terminalNeedId)},'{"mode":"STATIONARY","start":{"city":"Grad","area":"Centar"}}'::jsonb);
      insert into public.need_requirement_details(need_id,critical_conditions) values
        (${quote(publicNeedId)},array['Drugi sprat bez lifta','Potrebne zaštitne rukavice']),
        (${quote(terminalNeedId)},array['Javno pre izbora']);
      insert into public.need_sensitive(need_id,exact_address,access_notes) values
        (${quote(publicNeedId)},${quote(sentinel)},${quote(sentinel)}),
        (${quote(terminalNeedId)},${quote(sentinel)},${quote(sentinel)});
      select set_config('uskoci.need_lifecycle','',true); commit;`);
    const readers = new Map([['owner', sourceReaders(requester)], ['worker', sourceReaders(worker)],
      ['outsider', sourceReaders(outsider)], ['anon', sourceReaders(anon)]]);
    for (const reader of readers.values()) for (const file of reader.fingerprints) {
      const gitBytes = execFileSync('git', ['show', `HEAD:${file.path}`], { cwd: ROOT });
      assert.equal(sha(gitBytes), file.sha256, 'PUBLIC_MATERIAL_SOURCE_NOT_EXACT_HEAD');
    }
    const beforeSelection = await readers.get('worker').service.detaljiPrilike(terminalNeedId);
    assert.equal(beforeSelection.javnaGeografija.state, 'available');
    assert.equal(beforeSelection.kriticniUslovi.state, 'available');
    stage = 'AUTHENTICATED_PARTICIPANT_SETUP';
    const revision = Number(sql(`select revision from public.needs where id=${quote(terminalNeedId)}`));
    const response = await ok(worker.rpc('rpc_submit_response', { p_need_id: terminalNeedId, p_need_revision: revision,
      p_worker_profile_id: workerProfileId, p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null,
      p_proposed_end_at: null, p_scope_note: null, p_client_request_id: `material-submit-${randomUUID()}` }));
    const agreementId = uuid(await ok(requester.rpc('rpc_select_response', { p_need_id: terminalNeedId, p_need_revision: revision,
      p_response_id: response.responseId, p_response_version: response.version, p_content_hash: response.contentHash,
      p_client_request_id: `material-select-${randomUUID()}` })));
    assert.equal(sql(`select status from public.needs where id=${quote(terminalNeedId)}`), 'ACTIVE');
    assert.equal(sql(`select status from public.agreements where id=${quote(agreementId)}
      and worker_account_id=${quote(env.RU5_DEVICE_WORKER_USER_ID)} and need_id=${quote(terminalNeedId)}`), 'CONFIRMED');
    const frozen = snapshot(); assertOriginalRowsPreserved(original, frozen);
    assert.equal(metadata(), originalSchema); assert.deepEqual(history(), currentHistory); assert.deepEqual(gates(), initialGates);
    stage = 'FROZEN_AUTHENTICATED_READ_MATRIX'; phase = 'read'; const observations = [];
    let expectedSummaryText;
    for (const actor of ['owner', 'worker', 'outsider']) {
      const firstTrace = trace.length;
      const material = await readers.get(actor).service.detaljiPrilike(publicNeedId);
      assert.equal(material.opis, expected.description); assert.equal(material.kategorija, expected.category);
      assert.equal(material.primaNovePrijave, true);
      assert.deepEqual(JSON.parse(JSON.stringify(material.zahtevi)), { vestine: expected.skills, alati: expected.tools,
        vozila: expected.vehicles, licence: expected.licenses, minimalnoIskustvoGodina: 2, zahtevaProverenIdentitet: true });
      assert.equal(JSON.stringify(material.javnaGeografija), JSON.stringify({ state: 'available', value: expected.topology }));
      assert.equal(JSON.stringify(material.kriticniUslovi), JSON.stringify({ state: 'available', value: expected.criticalConditions }));
      assert.equal(JSON.stringify(material).includes(sentinel), false);
      if (actor === 'worker') expectedSummaryText = [material.naslov, material.statusTekst, material.podrucjeTekst,
        material.vremeTekst, `Popunjeno ${material.pokrivenost.popunjeno} od ${material.pokrivenost.ukupno} mesta`, 'Traži ponude'];
      assert.equal(trace.slice(firstTrace).filter(call => call.path === '/rest/v1/needs').length, 1);
      const legacy = await readers.get(actor).service.detaljiPrilike(legacyNeedId);
      assert.equal(legacy.javnaGeografija.state, 'unavailable'); assert.equal(legacy.kriticniUslovi.state, 'unavailable');
      assert.equal(legacy.zahtevi.minimalnoIskustvoGodina, null); assert.equal(legacy.zahtevi.zahtevaProverenIdentitet, false);
      const terminal = await readers.get(actor).service.detaljiPrilike(terminalNeedId);
      if (actor === 'outsider') assert.equal(terminal, null);
      else {
        assert.equal(terminal.id, terminalNeedId); assert.equal(terminal.primaNovePrijave, false);
        for (const key of ['javnaGeografija', 'kriticniUslovi']) assert.equal(terminal[key].state, actor === 'owner' ? 'available' : 'unavailable');
      }
      observations.push({ actor, openMaterial: 'PASS', missingChildren: 'PASS', terminal: actor === 'outsider' ? 'ABSENT'
        : actor === 'owner' ? 'PARENT_AND_CHILDREN' : 'PARENT_ONLY_CHILDREN_UNAVAILABLE', oneNeedRequest: true });
    }
    let anonOutcome = 'UNEXPECTED_PROJECTION';
    try { if (await readers.get('anon').service.detaljiPrilike(publicNeedId) === null) anonOutcome = 'ABSENT'; }
    catch (error) { assert.ok(['42501', 'PGRST301', 'PGRST302'].includes(error?.code)); anonOutcome = `DENIED_${error.code}`; }
    assert.notEqual(anonOutcome, 'UNEXPECTED_PROJECTION');
    const sensitive = await privateReader.from('need_sensitive').select('need_id,exact_address,access_notes').eq('need_id', publicNeedId);
    if (sensitive.error) assert.equal(sensitive.error.code, '42501'); else assert.deepEqual(sensitive.data, []);
    assert.equal(JSON.stringify(sensitive.data).includes(sentinel), false);
    assert.deepEqual(snapshot(), frozen); assert.equal(metadata(), originalSchema);
    assert.deepEqual(history(), currentHistory); assert.deepEqual(gates(), initialGates);
    const report = { observedAt: new Date().toISOString(), sourceSha: env.GITHUB_SHA, result: 'PASS', localOnly: true,
      liveAccess: false, providerCalled: false, publicationProof: false,
      historicalBoundary: 'Existing reconstructed79 plus exact N02/N03 candidates; not a full87 replay',
      participantBoundary: 'Actual authenticated selection: CONFIRMED Agreement / ACTIVE Need with closed application entry. COMPLETED is not tested here.',
      publicNeedId, publicNeedTitle: expected.title, legacyNeedId, legacyNeedTitle: 'PUBLIC_MATERIAL_Nedostupan_dodatak',
      terminalNeedId, terminalNeedTitle: 'PUBLIC_MATERIAL_Zatvorene_prijave', agreementId, requesterId: env.RU5_DEVICE_REQUESTER_USER_ID,
      workerId: env.RU5_DEVICE_WORKER_USER_ID, outsiderId, expected, expectedSummaryText,
      expectedPublicText: [expected.description, expected.category, ...expected.skills, ...expected.tools,
        ...expected.vehicles, ...expected.licenses, 'Centar, Grad A', 'Zapad, Grad B', ...expected.criticalConditions,
        'Traženo iskustvo: najmanje 2 god.', 'Za ovaj zadatak traži se proveren identitet.'],
      observations, anonOutcome,
      privateReadDeniedOrFiltered: true, originalPublicPrivateRowsPreserved: true,
      allReadPhaseRowsUnchanged: true, schemaHash: originalSchema, history: currentHistory, gates: initialGates,
      childCatalog, originalBeforeSetup: summary(original), beforeJourney: summary(frozen),
      source: readers.get('worker').fingerprints, trace, authSessionsExcluded: true };
    writeFileSync(fixturePath, JSON.stringify(report, null, 2) + '\n');
    console.log('PASS PUBLIC_TASK_MATERIAL_READ_MATRIX real_auth left_children private_denial original_rows schema history unchanged');
  } catch (error) {
    writeFileSync(join(artifact, 'public-task-material-failure.json'), JSON.stringify({ sourceSha: env.GITHUB_SHA,
      observedAt: new Date().toISOString(), localOnly: true, result: 'FAIL', stage,
      category: error?.code === 'ERR_ASSERTION' ? 'ASSERTION_MISMATCH' : 'LOCAL_PROOF_EXECUTION_FAILED' }, null, 2) + '\n');
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  console.error('PUBLIC_TASK_MATERIAL_PROOF_FAILED');
  for (const match of String(error?.stack ?? '').matchAll(/public_task_material_proof\.mjs:(\d+):(\d+)/g)) {
    console.error(`FAILURE_FRAME public_task_material_proof.mjs:${match[1]}:${match[2]}`);
  }
  process.exitCode = 1;
});
