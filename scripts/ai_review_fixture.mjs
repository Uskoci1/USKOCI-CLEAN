// Disposable typed proposals only. Never provider extraction or production evidence.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../supabase/proofs/ru5_device_ui_local_guard.mjs';

// Frozen reviewed PR57 dependency copied as proof SQL only. Native admission
// does not add/promote a forward migration or fabricate migration history.
export const REVIEWED_AI_DEPENDENCY = {
  file: 'supabase/proofs/ai/ai_draft_authority_candidate.sql',
  authoritySourceSha: '30b8fc167b1a243368bbd250e93a5bb1b58e37bf',
  bytes: 21141,
  sha256: 'ee0077ae883328f865a73eed0ebab9434a8c2e47add750b055de45950e5a77d1',
  predecessor_body_md5: {
    'public.rpc_ai_need_review_v2(uuid)': 'dd536d23cbe5685888376f6879745b8c',
    'public.rpc_save_need_draft_from_review(uuid,uuid,text)': '982f807ea395610cbce0f95748f36598',
  },
  candidate_body_md5: {
    'public.rpc_ai_need_review_v2(uuid)': '1e6b3f195bb47e09a7bb7887f087b9cd',
    'public.rpc_save_need_draft_from_review(uuid,uuid,text)': 'ea7ed77204774f618c1748831a1032d1',
  },
  unchanged_body_md5: {
    'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)': '9b87763c59ec6fb515c4128cc6864ad8',
    'public.rpc_ai_confirm_fact(uuid)': '4c982c3a2396cb4bf82543f8921fda42',
    'public.rpc_ai_correct_fact_v2(uuid,jsonb,text)': '7342a40473c094f77adffee74fbb777b',
    'public.rpc_publish_need(uuid,timestamptz)': '91ab1fadc4f681ed3c15aec53df41d33',
    'public.rpc_ai_publish_need(uuid,uuid)': '1fca28c3d65f583c5ffc9258ce713f8e',
    'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)': 'bf84266913d3c1f4e06257c7a037abfc',
  },
};

export function validateAiFixture(env) {
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(env.RU5_DEVICE_PACKAGE, 'rs.uskoci.n04proof');
  assert.equal(env.RU5_DEVICE_PROOF_DIR, '/tmp/uskoci-ru5-device-ui');
  assert.equal(env.RU5_DEVICE_ARTIFACT_DIR, 'artifacts/ai-review-device');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
}
export function proposedFacts(nonce, start, end) {
  assert.match(nonce, /^[a-f0-9]{8}$/);
  assert.ok(Date.parse(end) > Date.parse(start));
  const title = `AI review proof ${nonce}`;
  const values = [
    ['need.title', title, title],
    ['need.description', 'Generička pomoć pri prenosu stvari uz ljude i kombi.', 'Generička pomoć pri prenosu stvari uz ljude i kombi.'],
    ['need.category', 'pomoc', 'Pomoć'], ['need.price_mode', 'OFFERS', 'Očekujete ponude'],
    ['need.schedule_kind', 'FIXED_WINDOW', 'Dogovoren termin'],
    ['need.people_needed', 2, '2'],
    ['need.task_geography', { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', area: 'Centar' }, end: { city: 'Novi Sad', area: 'Liman' } }, 'Centar, Novi Sad → Liman, Novi Sad'],
    ['need.starts_at', start, start], ['need.ends_at', end, end], ['need.required_vehicles', ['Kombi'], 'Kombi'],
  ];
  return values.map(([key, value, displayValue]) => ({ key, value, displayValue,
    evidence: 'Sintetički lokalni fixture za dokaz ljudske potvrde; nije provider izlaz.', confidence: 0.8 }));
}

export async function main(mode, env = process.env) {
  validateAiFixture(env); // Before files, credentials, SQL, clients or any external operation.
  assert.ok(['admit', 'create-account', 'seed', 'observe'].includes(mode));
  const out = env.RU5_DEVICE_ARTIFACT_DIR;
  mkdirSync(out, { recursive: true });
  const file = name => join(out, name);
  const write = (name, data) => writeFileSync(file(name), JSON.stringify(data, null, 2) + '\n');
  const sql = query => {
    try { return execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At'],
      { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
    catch { throw new Error('AI_REVIEW_LOCAL_SQL_FAILED'); }
  };
  const lit = value => `'${String(value).replaceAll("'", "''")}'`;
  const uuid = value => { assert.match(String(value), /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i); return value; };
  const rows = query => JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  if (mode === 'admit') {
    const manifest = REVIEWED_AI_DEPENDENCY;
    assert.equal(manifest.file, 'supabase/proofs/ai/ai_draft_authority_candidate.sql');
    const bytes = readFileSync(manifest.file);
    assert.equal(bytes.length, manifest.bytes); assert.equal(sha256(bytes), manifest.sha256);
    assert.deepEqual(bytes, execFileSync('git', ['show', `${env.GITHUB_SHA}:${manifest.file}`]));
    assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '79');
    assert.equal(sql("select to_regprocedure('public.rpc_list_inbox(text,integer,timestamptz,uuid)') is not null"), 't');
    const historySql = "select md5(jsonb_agg(to_jsonb(x) order by version)::text) from supabase_migrations.schema_migrations x";
    const history = sql(historySql);
    for (const [signature, digest] of Object.entries({ ...manifest.predecessor_body_md5, ...manifest.unchanged_body_md5 }))
      assert.equal(sql(`select md5(prosrc) from pg_proc where oid=${lit(signature)}::regprocedure`), digest);
    // Exact reviewed two-RPC extension; no fabricated migration-history entry.
    try { execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-f', manifest.file], { stdio: 'pipe' }); }
    catch { throw new Error('AI_REVIEW_EXACT_LOCAL_ADMISSION_FAILED'); }
    for (const [signature, digest] of Object.entries({ ...manifest.candidate_body_md5, ...manifest.unchanged_body_md5 }))
      assert.equal(sql(`select md5(prosrc) from pg_proc where oid=${lit(signature)}::regprocedure`), digest);
    assert.equal(sql(historySql), history);
    sql("notify pgrst,'reload schema'");
    write('ai-review-admission.json', { sourceSha: env.GITHUB_SHA, localOnly: true, providerProof: false,
      nativeDependencyBoundary: 'HISTORICAL79_PLUS_N02_N03_PLUS_REVIEWED_AI_TWO_RPC_EXTENSION',
      canonicalFullReplay: false, historyCount: 79, historyFingerprint: history, candidate: manifest });
    console.log('PASS AI_REVIEW_LOCAL_ADMISSION historical79 N02 N03 exact_two_rpc_extension before_original27');
    return;
  }
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const client = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY, options);
  const service = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_SERVICE_ROLE_KEY, options);
  const ok = async call => { const result = await call; if (result.error) throw new Error(`AI_REVIEW_LOCAL_RPC_FAILED_${result.error.code ?? 'UNKNOWN'}`); return result.data; };
  if (mode === 'create-account') {
    const nonce = randomUUID(), email = `ai-review-${nonce}@proof.invalid`;
    const signed = await ok(client.auth.signUp({ email, password: env.RU5_DEVICE_PASSWORD,
      options: { data: { first_name: 'AI', last_name: 'Review proof', city: 'Novi Sad' } } }));
    const accountId = uuid(signed.user?.id);
    assert.ok(![env.RU5_DEVICE_REQUESTER_USER_ID, env.RU5_DEVICE_WORKER_USER_ID].includes(accountId));
    if (!signed.session) await ok(service.auth.admin.updateUserById(accountId, { email_confirm: true }));
    await ok(client.auth.signInWithPassword({ email, password: env.RU5_DEVICE_PASSWORD }));
    const profile = await ok(client.from('app_profiles').select('id,profile_status').eq('account_id', accountId).eq('kind', 'REQUESTER').single());
    assert.equal(profile.profile_status, 'ACTIVE');
    assert.equal(sql(`select count(*) from public.ai_conversations where account_id=${lit(accountId)}::uuid`), '0');
    const start = new Date(); start.setUTCDate(start.getUTCDate() + 7); start.setUTCHours(7, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600_000);
    write('ai-review-fixture.json', { sourceSha: env.GITHUB_SHA, localOnly: true, providerProof: false,
      humanConfirmationProof: true, accountId, email, profileId: uuid(profile.id),
      proposals: proposedFacts(nonce.slice(0, 8), start.toISOString(), end.toISOString()) });
    appendFileSync(env.GITHUB_ENV, `AI_REVIEW_ACCOUNT_ID=${accountId}\nAI_REVIEW_EMAIL=${email}\n`);
    console.log('PASS AI_REVIEW_REAL_LOCAL_AUTH isolated_third_owner no_conversation_preopen');
    return;
  }
  const fixture = JSON.parse(readFileSync(file('ai-review-fixture.json'), 'utf8'));
  assert.equal(fixture.sourceSha, env.GITHUB_SHA); assert.equal(fixture.localOnly, true); assert.equal(fixture.providerProof, false);
  const account = uuid(fixture.accountId);
  const login = await ok(client.auth.signInWithPassword({ email: fixture.email, password: env.RU5_DEVICE_PASSWORD }));
  assert.equal(login.user.id, account);
  const conversations = rows(`select id,purpose,status,fact_schema_version from public.ai_conversations where account_id=${lit(account)}::uuid`);
  assert.equal(conversations.length, 1, 'Must observe exactly the isolated UI-opened conversation');
  const conversationId = uuid(conversations[0].id);
  assert.equal(conversations[0].purpose, 'NEED_INTAKE'); assert.equal(conversations[0].fact_schema_version, 'NEED_FACT_V2');
  if (mode === 'seed') {
    assert.equal(conversations[0].status, 'OPEN');
    assert.equal(sql(`select count(*) from public.ai_messages where conversation_id=${lit(conversationId)}::uuid`), '0');
    assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${lit(conversationId)}::uuid`), '0');
    const applied = await ok(service.rpc('rpc_ai_apply_interview_turn_v2_service', { p_account_id: account,
      p_conversation_id: conversationId, p_user_message: 'Sintetički lokalni primer: dve osobe i kombi između javnih područja.',
      p_assistant_message: 'Lokalni fixture predloga za proveru ljudske potvrde. Provider nije pozvan.',
      p_safety: 'ALLOW', p_proposals: fixture.proposals }));
    assert.equal(applied.proposedCount, fixture.proposals.length);
    const review = await ok(client.rpc('rpc_ai_need_review_v2', { p_conversation_id: conversationId }));
    assert.equal(review.safety, 'ALLOW'); assert.equal(review.canSaveDraft, false);
    assert.equal(review.facts.length, 10);
    assert.ok(review.facts.every(fact => fact.status === 'NEEDS_CONFIRMATION' && fact.source === 'AI_INFERENCE'));
    write('ai-review-fixture.json', { ...fixture, conversationId, initialReview: review });
    console.log('PASS AI_REVIEW_TYPED_PENDING_FIXTURE actual_service_writer no_provider no_human_confirmation');
    return;
  }
  const label = env.AI_REVIEW_OBSERVATION;
  assert.match(label ?? '', /^[A-Z][A-Z0-9_]{0,70}$/);
  const review = await ok(client.rpc('rpc_ai_need_review_v2', { p_conversation_id: conversationId }));
  const needs = rows(`select n.*,g.public_topology from public.needs n left join public.need_geography g on g.need_id=n.id where n.requester_account_id=${lit(account)}::uuid`);
  const facts = rows(`select id,fact_key,fact_value,source,status,confirmed_at,confirmed_by_user_id,superseded_at,superseded_by from public.ai_structured_facts where conversation_id=${lit(conversationId)}::uuid order by created_at,id`);
  const receipts = rows(`select client_request_id,conversation_id,need_id,result from private.need_draft_save_commands where account_id=${lit(account)}::uuid`);
  const observation = { sourceSha: env.GITHUB_SHA, accountId: account, conversationId, review, facts, needs, receipts };
  write(`AI_STATE_${label}.json`, observation);
  console.log(`PASS AI_REVIEW_STATE ${label} owned_read_only_observation`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
