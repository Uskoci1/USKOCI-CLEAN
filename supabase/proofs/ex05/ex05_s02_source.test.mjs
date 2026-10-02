// Offline source-hygiene tests of the EX-05 S02 proof: it can only ever talk to the disposable loopback database, writes only what it says it writes,
// carries no secret, no DEV reference in code and no user text, and every own file is plain ASCII with LF.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import {emitSqlTemplates} from './ex05_s02_sql.mjs';

const DIR = 'supabase/proofs/ex05/';
const own = readdirSync(DIR).filter(name => !name.startsWith('__') && !name.endsWith('.pyc')).map(name => DIR + name);
const read = path => readFileSync(path, 'utf8');
const WORKFLOW = '.github/workflows/ex05-s02-rc02-proof.yml';

test('every own file is ASCII with LF only and ends with a line feed', () => {
  assert.ok(own.length >= 12, own.join(','));
  for (const path of [...own, WORKFLOW]) {
    const bytes = readFileSync(path);
    assert.ok(bytes.every(byte => byte < 0x80), 'ASCII ' + path);
    assert.ok(!bytes.includes(13), 'LF ' + path);
    assert.ok(!bytes.includes(9), 'no tab ' + path);
    assert.equal(bytes.at(-1), 10, 'final line feed ' + path);
  }
});

test('the proof reaches the database only through the local loopback adapter and psql, never through a hosted URL, a key or the DEV project', () => {
  const code = own.filter(path => path.endsWith('.mjs') && !path.endsWith('.test.mjs')).map(path => [path, read(path)]);
  assert.ok(code.length >= 6);
  for (const [path, text] of code) {
    assert.ok(!text.includes('leqcwgzvjsxugfgzdmth'), 'no DEV project reference in ' + path);
    assert.ok(!/https?:\/\//.test(text), 'no URL in ' + path);
    assert.ok(!/supabase\.co|apply_migration|execute_sql|deploy_edge/.test(text), 'no hosted tool in ' + path);
    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|ANON_KEY|SECRET|PASSWORD|TOKEN/.test(text.replace(/RU5_DEVICE_[A-Z_]+/g, '')), 'no secret name in ' + path);
    assert.ok(!/\bexecSync\b|(?<![.\w])exec\(|shell:\s*true/.test(text), 'no shell in ' + path);
    assert.ok(!/console\.(log|error)\([^)]*\.(body|detail|context)\b/.test(text), 'no free text to the console in ' + path);
  }
  const proof = read(DIR + 'ex05_s02_proof.mjs');
  assert.match(proof, /from '\.\.\/pre_v3\/closure_runtime\.mjs'/, 'the loopback guard of the shared adapter runs on import');
  assert.match(proof, /execFileSync\('psql'/);
  assert.match(proof, /spawn\('psql'/);
  assert.ok(!/update cron\.job|cron\.unschedule/i.test(proof), 'the scheduler is paused through cron.alter_job only');
  const engine = read(DIR + 'ex05_s02_engine.mjs');
  assert.ok(!/child_process/.test(engine), 'the engine takes its spawner as a parameter');
});

test('the only statements that write are the named fixtures, the named gates, the scratch schema and the pause of the scheduler', () => {
  const templates = emitSqlTemplates();
  const writes = /\b(insert into|delete from|truncate|drop schema|drop table|alter table|create schema|create or replace|create function|grant execute|update public|update private)\b/i;
  const allowed = new Map([
    ['gate:closureKeyRestrict', /insert into private\.account_closure_requests/],
    ['cleanup:closureRequest', /delete from private\.account_closure_requests where account_id = /],
    ['catalog:needInsert', /insert into public\.needs/],
    ['catalog:workerProfileUpdate', /update public\.app_profiles set city/],
    ['catalog:scratchSetup', /create schema if not exists ex05_scratch/],
    ['catalog:scratchGrant', /grant execute on function ex05_scratch\./],
    ['catalog:scratchDrop', /drop schema if exists ex05_scratch cascade/],
  ]);
  for (const [name, text] of Object.entries(templates)) {
    if (name === 'catalog:census') continue; // the census pattern is DATA: a regular expression that names the statements it looks for
    const stripped = text.replace(/for update/gi, 'for lock');
    const hit = writes.exec(stripped);
    if (!hit) continue;
    const key = [...allowed.keys()].find(prefix => name === prefix || name.startsWith(prefix + ':'));
    assert.ok(key, `${name} writes (${hit[0]}) without being named`);
    assert.match(stripped, allowed.get(key), name);
  }
  assert.ok(Object.keys(templates).filter(name => allowed.has(name.split(':').slice(0, 2).join(':'))).length >= 7);
  for (const name of Object.keys(templates)) assert.ok(!/(^|:)(drop|truncate)(:|$)/.test(name));
});

test('the proof never touches the product tables it reads except through the registered fixtures and the named statements', () => {
  const proof = read(DIR + 'ex05_s02_proof.mjs');
  for (const forbidden of [/truncate/i, /drop table/i, /delete from/i, /insert into/i, /update private\./i, /alter table/i, /alter function/i]) assert.ok(!forbidden.test(proof), String(forbidden));
  const sqlModule = read(DIR + 'ex05_s02_sql.mjs');
  assert.ok(!/truncate|drop table|alter table|alter function|alter role|create role/i.test(sqlModule));
});

test('the proof fails loudly without a steerable deadlock_timeout, leaves a RUNNING marker first and still writes its report when it is interrupted', () => {
  const proof = read(DIR + 'ex05_s02_proof.mjs');
  assert.match(proof, /if \(!deadlockSettable\) fail\('DEADLOCK_TIMEOUT_NOT_SETTABLE:/, 'a weaker proof is a listed failure, never a quiet PASS');
  assert.ok(!/note\('NOTE deadlock_timeout/.test(proof));
  const marker = proof.indexOf("save(); // a RUNNING marker");
  assert.ok(marker > 0 && marker < proof.indexOf('const query = '), 'the first report is written before any database call');
  assert.match(proof, /process\.on\('SIGTERM', \(\) => terminate\('SIGTERM'\)\)/);
  assert.match(proof, /process\.on\('SIGINT', \(\) => terminate\('SIGINT'\)\)/);
  assert.match(proof, /report\.resultLabel = C\.resultLabel\(report\)/, 'the JSON report carries the partial-aware label');
  assert.match(proof, /pinGateOnly: PIN_GATE_ONLY/, 'the partial marker exists from the start, even when the run dies early');
  assert.match(proof, /scope: PIN_GATE_ONLY \? 'PIN_GATE_ONLY' : \(ONLY\.length \? 'FILTERED' : 'FULL'\)/);
});

test('the workflow runs the unit tests and the checker before the long chain and discards and uploads in every outcome', () => {
  const text = read(WORKFLOW);
  const steps = text.split('\n      - ');
  assert.ok(text.indexOf('check_ex05_s02.py --check --syntax') < text.indexOf('replay_source147.py'));
  assert.ok(text.indexOf('node --test supabase/proofs/ex05/*.test.mjs') < text.indexOf('replay_source147.py'));
  assert.ok(steps.length >= 9);
  assert.match(text, /Always discard the disposable database\n        if: always\(\)/);
  assert.match(text, /Upload only bounded source and result summaries including failures\n        if: always\(\)/);
  assert.match(text, /if: \$\{\{ !cancelled\(\) \}\}\n        env:\n          EX05_PIN_GATE_ONLY_INPUT: \$\{\{ inputs\.pin_gate_only \}\}\n          EX05_ONLY_INPUT: \$\{\{ inputs\.only \}\}/);
  assert.ok(!text.includes('${{ inputs.only }}\n          set') && !/run: \|[^]*\$\{\{ inputs\./.test(text.split('The EX-05 S02 proof')[1].split('env:')[1].split('run: |')[1] ?? ''), 'inputs reach the script through env only');
  assert.ok(text.includes('stage 27') || text.includes('27-voice-b1-application'));
  assert.ok(!text.includes('28-ex04') && !text.includes('ex04a_own_tasks_page'), 'EX-04 and D12 are not part of this chain');
  assert.ok(text.includes('PGOPTIONS=\'-c b24.preimage=relaxed\''));
  assert.ok(text.includes('actions/checkout@11d5960a326750d5838078e36cf38b85af677262') && text.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'));
  assert.ok(text.includes('timeout-minutes: 180'));
  for (const stage of ['03-source147', '18-pkg042-to-pkg050', '21-b3b', '25-b3c-application']) assert.ok(text.includes(stage), stage);
});

test('the chain stages of the workflow are exactly the stages of the DEV closure surface before D12 (frozen here, not read from another workflow)', () => {
  const expected = [
    ['03-source147', 'python3 supabase/proofs/pkg023j/replay_source147.py'],
    ['04-dev-alpha-to-pkg026', 'node supabase/proofs/pkg027/pkg027_proof.mjs replay'],
    ['05-pkg027', 'node supabase/proofs/pkg028/pkg028_proof.mjs replay'],
    ['06-pkg028', 'node supabase/proofs/pkg029/pkg029_proof.mjs replay'],
    ['07-pkg029', 'node supabase/proofs/pkg030/pkg030_proof.mjs replay'],
    ['08-pkg030', 'node supabase/proofs/pkg031/pkg031_proof.mjs replay'],
    ['09-pkg031', 'node supabase/proofs/pkg032/pkg032_proof.mjs replay'],
    ['10-pkg032', 'node supabase/proofs/pkg033/pkg033_proof.mjs replay'],
    ['11-pkg033', 'node supabase/proofs/pkg034/pkg034_proof.mjs replay'],
    ['12-pkg034', 'node supabase/proofs/pkg035/pkg035_proof.mjs replay'],
    ['13-pkg035', 'node supabase/proofs/pkg037/pkg037_proof.mjs replay'],
    ['14-pkg037', 'node supabase/proofs/pkg038/pkg038_proof.mjs replay'],
    ['15-pkg038', 'node supabase/proofs/pkg039/pkg039_proof.mjs replay'],
    ['16-pkg039', 'node supabase/proofs/pkg040/pkg040_proof.mjs replay'],
    ['17-pkg040', 'node supabase/proofs/pkg042/pkg042_proof.mjs replay'],
    ['18-pkg042-to-pkg050', 'node supabase/proofs/pkg050/pkg050_proof.mjs'],
    ['19-a1-preparation', 'node supabase/proofs/chat/prepare_notification_a1.mjs'],
    ['20-b3a', 'node supabase/proofs/chat/private_history_read_proof.mjs'],
    ['21-b3b', 'node supabase/proofs/chat/message_window_proof.mjs'],
    ['22-p0', 'psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/candidates/discovery_p0_exact_public_landing.sql'],
    ['23-p4', 'psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/candidates/chat_p4_exact_message_event_resolver.sql'],
    ['24-p5', 'psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/candidates/worker_profile_licenses_owned_projection.sql'],
    ['25-b3c-application', 'psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -1 -f supabase/candidates/chat_b3c_private_invalidation_dev_application.sql'],
  ];
  const mine = read(WORKFLOW);
  const found = [...mine.matchAll(/^\s+run_stage (\d\d-[a-z0-9-]+) (.+)$/gm)].map(match => [match[1], match[2].trim()]);
  assert.deepEqual(found, expected);
  for (const [, command] of expected) {
    const path = /(supabase\/[A-Za-z0-9_/.-]+)/.exec(command)[1];
    assert.ok(readFileSync(path).length > 0, 'the stage file exists: ' + path);
  }
});
