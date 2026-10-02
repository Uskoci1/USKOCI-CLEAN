// EX05-S01 offline tests of the workflow contract (.github/workflows/ex05-s01-chat-reproof.yml): the chain stages equal the recorded D12 chain, every proof and tool of this slice is run,
// the workflow never reaches DEV, a provider or a secret, and the jobs the evidence table names exist. The workflow YAML is parsed with the `yaml` package that node_modules already carries.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = path => readFileSync(root + path, 'utf8').replace(/\r\n/g, '\n');
const text = read('.github/workflows/ex05-s01-chat-reproof.yml');
const d12 = read('.github/workflows/d12-review-comment-proof.yml');
const workflow = YAML.parse(text);
const stages = source => new Map([...source.matchAll(/^\s*run_stage (\d\d-[a-z0-9-]+) (.+)$/gm)].map(match => [match[1], match[2].trim()]));
const pickRange = (map, from, to) => [...map].filter(([name]) => Number(name.slice(0, 2)) >= from && Number(name.slice(0, 2)) <= to);

test('the workflow parses and defines the four jobs the evidence table names, with the evidence job last and always running', () => {
  assert.deepEqual(Object.keys(workflow.jobs), ['offline', 'chain', 'd03-position', 'evidence']);
  assert.deepEqual(workflow.jobs.evidence.needs, ['offline', 'chain', 'd03-position']);
  assert.equal(workflow.jobs.evidence.if, '${{ always() }}');
  assert.equal(workflow.permissions.contents, 'read');
  assert.ok(workflow.on.push.paths.includes('supabase/proofs/ex05_s01/**') && workflow.on.push.paths.includes('.github/workflows/ex05-s01-chat-reproof.yml'));
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.pin_gate_mode.options, ['report', 'enforce']);
  assert.equal(workflow.on.workflow_dispatch.inputs.pin_gate_mode.default, 'report');
});

test('stages 03-21 (source147 to B3b) and 22-25 (P0, P4, P5, B3c application) are exactly the stages the D12 workflow records', () => {
  const mine = stages(text), recorded = stages(d12);
  const mineFirst = pickRange(mine, 3, 21), recordedFirst = pickRange(recorded, 3, 21);
  assert.equal(mineFirst.length, 19); assert.deepEqual(mineFirst, recordedFirst);
  const mineSecond = pickRange(mine, 22, 25).filter(([name]) => !name.startsWith('25b')), recordedSecond = pickRange(recorded, 22, 25);
  assert.equal(mineSecond.length, 4); assert.deepEqual(mineSecond, recordedSecond);
});

test('the P4 transport candidate, B24 part 1 (variant), part 2 (relaxed) with the fidelity check, Voice B1 (required) and EX-04a-d are applied in the DEV order', () => {
  const order = ['25b-p4-push-transport', '26a-b24-part1-derive', '26b-b24-part2', '26b-b24-fidelity', '27-voice-b1-application', '28-ex04a', '29-ex04b', '30-ex04c', '31-ex04d'];
  let cursor = -1;
  for (const marker of order) { const index = text.indexOf(marker, cursor + 1); assert.ok(index > cursor, marker + ' is missing or out of order'); cursor = index; }
  assert.match(text, /PGOPTIONS='-c b24\.preimage=relaxed' psql .*b24_part1\.chain\.sql/);
  assert.match(text, /PGOPTIONS='-c b24\.preimage=relaxed' psql .*b24_nonretried_conflicts_part2_certified\.sql/);
  assert.match(text, /stage 27-voice-b1-application supabase\/candidates\/chat_voice_b1_dev_application\.sql required/);
});

test('the existing P4 proofs run at their position with the three exact artifact directories they assert, before the P0 stage', () => {
  assert.equal(workflow.jobs.chain.env.PRE_V3_ARTIFACT_DIR, '/tmp/chat-p4-private');
  assert.equal(workflow.jobs.chain.env.P4_ARTIFACT_DIR, '/tmp/chat-p4-artifacts');
  assert.equal(workflow.jobs.chain.env.P4_PUSH_ARTIFACT_DIR, '/tmp/chat-p4-push-artifacts');
  const resolver = text.indexOf('exact_message_event_resolver_proof.mjs'), transport = text.indexOf('push_event_transport_proof.mjs'), p0 = text.indexOf('22-p0 psql');
  assert.ok(resolver > 0 && transport > resolver && p0 > transport);
});

test('every post-state proof, the pin gate, the offline suites and the frozen d03 chain are run', () => {
  for (const name of ['text', 'readers', 'photo', 'group', 'voice', 'push']) assert.match(text, new RegExp('run_proof \\d\\d-' + name + ' ex05_s01_' + name + '_proof\\.mjs'));
  assert.match(text, /pin_gate\.mjs --out-dir/);
  for (const file of ['voice_m4a.test.mjs', 'voice_media_edge.test.mjs', 'n09_push_transport_edge.test.mjs', 'n10_push_copy.test.mjs', 'v5_agreement_photos.test.mjs']) assert.ok(text.includes(file), file);
  for (const file of ['n07_forward_promotion_proof.mjs', 'n08_preferences_proof.mjs', 'd03_message_retry_proof.mjs']) assert.ok(text.includes(file), file);
  assert.match(text, /node --test supabase\/proofs\/ex05_s01\/lib\/\*\.test\.mjs/);
});

test('the workflow never reaches DEV or PROD, a provider, a secret or a linked project', () => {
  assert.ok(!/\$\{\{\s*secrets\./.test(text));
  for (const forbidden of ['leqcwgzvjsxugfgzdmth', '--linked', 'supabase db push', 'project-ref', 'deploy_edge_function', 'SUPABASE_ACCESS_TOKEN', 'EXPO_ACCESS_TOKEN']) assert.ok(!text.includes(forbidden), forbidden);
  assert.match(text, /DB_URL: postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(text, /assertLocalDeviceProofTargets/);
});

test('every step that follows a possible failure and must still capture evidence runs with !cancelled() or always()', () => {
  const steps = workflow.jobs.chain.steps;
  const named = pattern => steps.find(step => pattern.test(step.name ?? ''));
  assert.equal(named(/pin gate/).if, '${{ !cancelled() }}');
  assert.equal(named(/six updated post-state proofs/).if, '${{ !cancelled() }}');
  assert.equal(named(/discard the disposable database/).if, 'always()');
  assert.equal(named(/Upload bounded/).if, 'always()');
});
