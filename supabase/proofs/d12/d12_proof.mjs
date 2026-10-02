// D12 written comment with the star rating: the DISPOSABLE-CHAIN PROOF of the server candidate supabase/candidates/d12_review_comment.sql (and its exact revert).
// Disposable local Auth / PostgREST / Postgres / Storage only: actual Auth sessions, actual PostgREST (real JWTs), the real shipped review client (src/data/reviewsClientService.ts, exact git bytes)
// for the OLD-CLIENT phase, the REAL closure worker source for the closures. No DEV, no provider, no device. NOTHING IN THIS FILE HAS RUN AT THE TIME OF WRITING: the first CI run is the first
// observation of every outcome asserted below (the pure parts are covered by `node --test supabase/proofs/d12/*.test.mjs`).
//
// Chain: source147 -> PKG-050 (stages 03-18 of the Voice B1 workflow), A1/B3a/B3b (19-21), P0/P4/P5/B3c (22-25), B24 part 2 in relaxed pre-image mode (26), the exact Voice B1 DEV application (27),
// then EX-04a-d (28-31): the closure surface of DEV before D12. The chain is NOT DEV (label below); the pin gate reads every pinned md5 on the chain, FAILS on a core difference and builds a
// chain variant of the candidate that differs only at the replaced adjacent md5 literals.
//
// Phases (every check runs even after an earlier one failed, so one run reports every broken assertion; a check that needs the result of an earlier one is skipped with its reason):
//   P0 pin gate, certificate and chain state      P1 BEFORE (FAIL-BEFORE: the legacy star-only flow works and there is no comment surface)
//   P2 APPLY (refusals, the atomic application, exact delta accounting, certificate re-bound self-consistent)      P3 OLD-CLIENT PARITY (legacy byte-identical, five-argument call, replay both ways, v2 parity)
//   P4 VALIDATION MATRIX (SQL function, table CHECKs, real PostgREST)      P5 GATES (participants, completion, one review per side, request reuse, restricted reviewer, block, concurrency)
//   P6 VISIBILITY (the reader and its gates, no leak, own receipt, aggregate unchanged)      P7 RLS / ACL / immutability      P8 MODERATION (service role only: hides the text, nothing else)
//   P9 CLOSURE (two real closures: author erased, star row kept, subject hidden not erased, canary absent everywhere)      P10 EXPORT      P11 CERTIFICATE (isolation, drift fails closed, closure after apply)
//   P12 REVERT (refused while a comment exists, byte-for-byte restore, reapply)      P13 WEAKENING PROBES (non-vacuity: the proof turns RED when a rule is weakened)
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadPreV3Clients} from '../pre_v3/client_runtime.mjs';
import {loadClosureWorker} from '../pre_v3/v5_closure_edge_runtime.mjs';
import {invalidationCatalogSnapshot} from '../chat/private_invalidation_catalog_snapshot.mjs';
import * as lib from './d12_lib.mjs';
import * as pins from './d12_pins.mjs';
const {assert, sql, rows, q, randomUUID, env, service, anon} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(env.RU5_DEVICE_DB_URL, env.DB_URL);

const APPLICATION = 'supabase/candidates/d12_review_comment.sql', REVERT = 'supabase/candidates/d12_review_comment_revert.sql';
const PREFLIGHT = 'supabase/proofs/d12/d12_preflight.readonly.sql', POSTFLIGHT = 'supabase/proofs/d12/d12_postflight.readonly.sql';
const PINS_FILE = 'supabase/proofs/d12/d12_pins.json', PREIMAGE_FILE = 'supabase/proofs/d12/d12_preimage.json', GENERATOR = 'supabase/proofs/d12/build_d12.py', MANIFEST_FILE = 'supabase/proofs/d12/d12_manifest.json';
const PRIVATE = rt.out, PUBLIC = env.D12_ARTIFACT_DIR ?? PRIVATE;
mkdirSync(PRIVATE, {recursive: true}); mkdirSync(PUBLIC, {recursive: true});
const reportPath = PUBLIC + '/d12-report.json', markdownPath = PUBLIC + '/d12-report.md';
const DEADLINE_MS = 30000;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const flag = value => value === 't';
const hashJson = value => sha256(JSON.stringify(value));

const report = {
  package: 'D12 written comment with the star rating: disposable-chain proof of the server candidate', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, devAccess: false, providerCalls: 0, nativeProof: false,
  label: null, labelShort: 'D12 PINS NOT READ YET', result: 'RUNNING', chain: {}, pinGate: null, checks: [], failures: [], skipped: [], refusals: [], residuals: [], nonVacuity: [], gaps: [], notVerified: [],
  phases: {before: {}, apply: {}, parity: {}, validation: {}, gates: {}, visibility: {}, rls: {}, moderation: {}, closure: {}, export: {}, certificate: {}, revert: {}, weakening: null}, candidate: {}, auth: {accountsCreated: 0, rateLimited: 0, waitedMs: 0}, transientRetries: 0,
};
const save = () => { try { writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); } catch { /* the report is best effort once the run is over */ } };
const state = {}; // results that later checks lean on (a check whose prerequisite failed is skipped, not guessed)
async function check(id, fn, {needs = []} = {}) {
  const missing = needs.filter(key => state[key] === undefined || state[key] === null);
  if (missing.length) { report.skipped.push({id, reason: 'PREREQUISITE_FAILED: ' + missing.join(', ')}); console.error('SKIP ' + id + ' (needs ' + missing.join(', ') + ')'); save(); return false; }
  try { await fn(); report.checks.push({id, labelShort: report.labelShort, result: 'PASS'}); console.log(lib.passLine(report.labelShort, id)); save(); return true; }
  catch (error) { const message = String(error?.stack ?? error).slice(0, 1600); report.failures.push({id, message}); console.error('FAIL ' + id + ': ' + message); save(); return false; }
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// transport: one PostgREST request with a deadline and a plain {status, data, error} answer (a refusal is data, never a throw)
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function settle(label, factory) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  let response;
  try { response = await factory().abortSignal(controller.signal); }
  catch (error) { throw new Error(`HTTP_TRANSPORT_FAILURE ${label}: ${String(error?.message ?? error).slice(0, 200)}`); }
  finally { clearTimeout(timer); }
  if (response.status === 0 || /abort/i.test(String(response.error?.message ?? ''))) throw new Error(`HTTP_DEADLINE_${DEADLINE_MS}ms ${label} (a SQLSTATE 40001 retried without end by PostgREST 14 would hang here)`);
  return {status: response.status, data: response.data ?? null, error: response.error ? {code: response.error.code ?? null, message: response.error.message ?? null, details: response.error.details ?? null, hint: response.error.hint ?? null} : null};
}
/** PostgREST answers PGRST000/001/002 (HTTP 503) while it reloads its schema cache after DDL: the request was NOT executed, so it is sent again (counted). Nothing else is ever retried. */
const SCHEMA_CACHE_UNAVAILABLE = new Set(['PGRST000', 'PGRST001', 'PGRST002']);
async function resend(send) {
  for (let attempt = 0; ; attempt++) {
    const answer = await send();
    if (answer.error && (SCHEMA_CACHE_UNAVAILABLE.has(answer.error.code) || answer.status === 503) && attempt < 20) { report.transientRetries += 1; await sleep(500); continue; }
    return answer;
  }
}
const call = (client, name, args = {}) => resend(() => settle(name, () => client.rpc(name, args)));
const mustOk = (response, label) => { assert.equal(response.error, null, `${label}: expected success, got ${JSON.stringify(response.error)}`); return response.data; };
function mustRefuse(response, message, sqlstate, label, {anon: isAnon = false, status = undefined} = {}) {
  const statuses = status === undefined ? lib.statusesFor(sqlstate, {anon: isAnon}) : status;
  assert.ok(lib.isRefusal(response, message, sqlstate, statuses), `${label}: expected ${sqlstate} ${message}${statuses ? ' HTTP ' + statuses.join('/') : ''}, got ${JSON.stringify(lib.outcomeOf(response))}`);
}
/** Waits until PostgREST knows a function (its schema cache reloads after DDL) and FAILS when it never does. */
async function functionReady(client, name, args) {
  for (let attempt = 0; attempt < 80; attempt++) { const answer = await settle(name, () => client.rpc(name, args)); if (answer.error?.code !== 'PGRST202' && !SCHEMA_CACHE_UNAVAILABLE.has(answer.error?.code ?? '')) return true; await sleep(500); }
  throw new Error('FUNCTION_NOT_READY ' + name + ' (PostgREST never learned it)');
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// SQL: through psql as postgres on the disposable stack. `psql` returns {ok, stdout, sqlstate, message} (VERBOSITY=verbose prints the SQLSTATE) and never throws on a SQL error.
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
function psqlRun(args, input, timeoutMs) {
  try {
    const stdout = execFileSync('psql', args, {input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, killSignal: 'SIGKILL', env: {...env, PGAPPNAME: 'uskoci-d12-proof'}});
    return {ok: true, stdout: stdout.trim(), stderr: '', sqlstate: null, message: null};
  } catch (error) {
    const stderr = String(error?.stderr ?? ''), parsed = lib.parsePsqlError(stderr);
    return {ok: false, stdout: String(error?.stdout ?? '').trim(), stderr: stderr.slice(0, 2000), sqlstate: parsed?.sqlstate ?? null, message: parsed?.message ?? null, code: error?.code ?? null, timedOut: error?.code === 'ETIMEDOUT'};
  }
}
const PSQL_BASE = [env.RU5_DEVICE_DB_URL, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
const psql = (script, {timeoutMs = 60000} = {}) => psqlRun(PSQL_BASE, script, timeoutMs);
const psqlFile = (path, {timeoutMs = 240000} = {}) => psqlRun([...PSQL_BASE, '-f', path], undefined, timeoutMs);
/** ONE text as ONE simple Query message (`psql -c`): the integrity guard (a DO block hashing substr(current_query(), ...)) sees the whole text it is sent with, exactly as a connector execute_sql / apply_migration would send it. */
const psqlCommand = (text, {timeoutMs = 240000} = {}) => psqlRun([...PSQL_BASE, '-c', text], undefined, timeoutMs);
/** The generator is the ONE implementation of the guard: it wraps a text file into guard + text. */
function wrapFile(inputPath, outputPath) {
  const answer = execFileSync('python3', [GENERATOR, '--wrap', inputPath, '--wrap-out', outputPath], {encoding: 'utf8'});
  return {text: readFileSync(outputPath, 'utf8'), answer: answer.trim()};
}
/** A script that must succeed; returns the text of its last output. */
const must = (script, label, opts) => { const result = psql(script, opts); assert.ok(result.ok, `${label}: ${result.message ?? result.stderr}`); return result.stdout; };
/** `begin; <statements>; rollback;` as a plain refusal probe: returns {sqlstate, message} of the FIRST failing statement or {ok: true, out}. */
const tryInTransaction = (statements, opts) => { const result = psql('begin;\n' + statements + '\nrollback;', opts); return result.ok ? {ok: true, out: result.stdout} : {ok: false, sqlstate: result.sqlstate, message: result.message, stderr: result.stderr}; };
const claims = (accountId, role = 'authenticated') => `set local role ${role}; select set_config('request.jwt.claim.sub', ${q(accountId)}, true), set_config('request.jwt.claim.role', ${q(role)}, true), set_config('request.jwt.claims', ${q(JSON.stringify({sub: accountId, role}))}, true);`;
const serviceClaims = "select set_config('request.jwt.claim.role', 'service_role', true), set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true);";
const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`) || null;
const exists = signature => sql(`select to_regprocedure(${q(signature)}) is not null`) === 't';
const tableExists = () => sql(`select to_regclass(${q(lib.TABLE)}) is not null`) === 't';
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split(/\r?\n/).filter(Boolean);
const snapshot = () => invalidationCatalogSnapshot(rt);
const closureState = () => rows(`select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, (select sha256 from private.closure_erasure_source_v5 where singleton) erasure,
  private.retention_ai_source_ready() ready, private.closure_erasure_binding_v5()->>'sourceSha256' binding`)[0];
const certificateConsistent = c => c.ready === true && c.live === c.certified && c.certified === c.erasure && c.erasure === c.binding;
const roster = () => JSON.parse(sql('select to_jsonb(private.closure_redaction_relations_v5())::text'));
const canExecute = (role, signature) => flag(sql(`select has_function_privilege(${q(role)}, ${q(signature)}, 'EXECUTE')`));
const canTable = (role, privilege) => flag(sql(`select has_table_privilege(${q(role)}, ${q(lib.TABLE)}, ${q(privilege)})`));

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// people and Dogovori. People go through REAL Auth (GoTrue rate limit: a bounded retry, counted). Real Dogovori go through the product RPCs; the volume Dogovori of the gate and reader
// phases are seeded as SQL fixtures (every state, both ways round) exactly as the EX-04 proofs seed theirs, and every REVIEW on them still goes through the real PostgREST RPCs.
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const RATE_LIMIT = /\b429\b|over_request_rate_limit|over_email_send_rate_limit|rate limit|too many requests/i;
async function newAccount(label) {
  let waitedHere = 0;
  for (;;) {
    try { const made = await rt.actor('d12-' + label); report.auth.accountsCreated += 1; return made; }
    catch (error) {
      const wait = 20000;
      if (!RATE_LIMIT.test(String(error?.message ?? error)) || waitedHere + wait > 330000) throw error;
      report.auth.rateLimited += 1; report.auth.waitedMs += wait; waitedHere += wait; await sleep(wait);
    }
  }
}
const faces = id => Object.fromEntries(rows(`select kind, id from public.app_profiles where account_id = ${q(id)}`).map(row => [row.kind, row.id]));
async function person(label, {name = null} = {}) {
  const actor = await newAccount(label), ids = faces(actor.id);
  assert.ok(ids.REQUESTER && ids.WORKER, 'BOTH_PROFILES_EXIST ' + label);
  actor.label = label; actor.profile = ids;
  if (name) sql(`update public.app_profiles set display_name = ${q(name)} where id = ${q(ids.REQUESTER)}; update public.app_profiles set display_name = ${q(name + ' (radnik)')} where id = ${q(ids.WORKER)};`);
  return actor;
}
const prepared = new Set();
async function prepareWorker(worker) {
  if (prepared.has(worker.id)) return;
  sql(`update public.app_profiles set city = 'Novi Sad', skills = '{"Fizicki poslovi"}' where id = ${q(worker.profile.WORKER)}`);
  mustOk(await call(worker.client, 'rpc_complete_worker_profile', {p_profile_id: worker.profile.WORKER}), 'complete worker profile ' + worker.label);
  prepared.add(worker.id);
}
/** An Agreement through the product path: a published task (the same lifecycle token the app's publication uses), an application, a selection. */
async function activeAgreement(requester, worker, title) {
  await prepareWorker(worker);
  const needId = randomUUID();
  sql(`begin; select set_config('uskoci.need_lifecycle', 'PUBLISH', true);
    insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, mode, required_slots, schedule_kind, response_deadline, published_at)
    values(${q(needId)}, ${q(requester.id)}, ${q(requester.profile.REQUESTER)}, 'PUBLISHED', ${q('D12 ' + title)}, 'Disposable D12 fixture', 'PROOF', 'Novi Sad', 'Liman', 'OFFERS', 1, 'FLEXIBLE', statement_timestamp() + interval '2 days', statement_timestamp()); commit;`);
  const offer = mustOk(await call(worker.client, 'rpc_submit_response', {p_need_id: needId, p_need_revision: 1, p_worker_profile_id: worker.profile.WORKER, p_covered_slots: 1, p_price_rsd: 3000,
    p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID()}), 'submit response ' + title);
  const id = mustOk(await call(requester.client, 'rpc_select_response', {p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId, p_response_version: offer.version,
    p_content_hash: offer.contentHash, p_client_request_id: randomUUID()}), 'select response ' + title);
  assert.match(id, /^[0-9a-f-]{36}$/);
  return {id, needId, requester, worker, title};
}
/** The product completion: the worker marks the work done, the requester confirms. Both the Agreement and its execution must be COMPLETED afterwards. */
async function completeAgreement(agreement) {
  mustOk(await call(agreement.worker.client, 'rpc_mark_work_done', {p_agreement_id: agreement.id}), 'mark work done ' + agreement.title);
  mustOk(await call(agreement.requester.client, 'rpc_confirm_completion', {p_agreement_id: agreement.id}), 'confirm completion ' + agreement.title);
  assert.deepEqual(rows(`select a.status, e.state from public.agreements a join public.agreement_execution e on e.agreement_id = a.id where a.id = ${q(agreement.id)}`), [{status: 'COMPLETED', state: 'COMPLETED'}], 'COMPLETED_BOTH_PLACES ' + agreement.title);
  return agreement;
}
const realCompleted = async (requester, worker, title) => completeAgreement(await activeAgreement(requester, worker, title));
/** The real product path, with a RECORDED fallback to a SQL-seeded completed Agreement when the product flow cannot be driven on this chain (never silent: the report names it). */
async function completedAgreement(requester, worker, title) {
  try { return await realCompleted(requester, worker, title); }
  catch (error) { report.gaps.push('REAL_COMPLETION_FAILED_FOR "' + title + '" (' + String(error?.message ?? error).slice(0, 160) + '): a SQL-seeded completed Agreement was used instead'); return seedAgreement(requester, worker, {title: 'seeded instead of ' + title}); }
}
const BASE_TIME = '2026-03-01 10:00:00+00';
let seededMinutes = 0;
/** A SQL-seeded Agreement (replica role: no trigger, no FK) in the given state: the review functions read only the Agreement row and its execution row. */
function seedAgreement(requester, worker, {status = 'COMPLETED', exec = 'COMPLETED', need = 'COMPLETED', title = 'seeded'} = {}) {
  const needId = randomUUID(), id = randomUUID(), at = `timestamptz '${BASE_TIME}' + interval '${++seededMinutes} minutes'`;
  let text = `insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, mode, schedule_kind, created_at)
      values(${q(needId)}, ${q(requester.id)}, ${q(requester.profile.REQUESTER)}, ${q(need)}, ${q('D12 ' + title)}, 'Disposable fixture', 'PROOF', 'OFFERS', 'FLEXIBLE', ${at});
    insert into public.agreements(id, need_id, selection_id, selected_response_id, requester_account_id, requester_profile_id, worker_account_id, worker_profile_id, status, created_at, updated_at)
      values(${q(id)}, ${q(needId)}, ${q(randomUUID())}, ${q(randomUUID())}, ${q(requester.id)}, ${q(requester.profile.REQUESTER)}, ${q(worker.id)}, ${q(worker.profile.WORKER)}, ${q(status)}, ${at}, ${at});
    insert into public.agreement_versions(agreement_id, version, status, terms, content_hash, created_by_account_id)
      values(${q(id)}, 1, ${q(status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED')}, '{"price_rsd":4000,"currency":"RSD"}'::jsonb, ${q(sha256(id))}, ${q(requester.id)});`;
  if (exec) text += `insert into public.agreement_execution(agreement_id, agreement_version, mode, state, requester_deadline_at, updated_at)
      values(${q(id)}, 1, 'PHYSICAL', ${q(exec)}, ${exec === 'AWAITING_REQUESTER' ? "now() + interval '1 day'" : 'null'}, ${at});`;
  must(`begin; set local session_replication_role = replica; ${text} set local session_replication_role = origin; commit;`, 'seed agreement ' + title);
  return {id, needId, requester, worker, title};
}
const otherParty = (agreement, person) => person.id === agreement.requester.id ? agreement.worker : agreement.requester;
const reviewArgs = (agreement, reviewer, {rating = 5, tags = ['RELIABLE'], key = randomUUID(), comment} = {}) => ({p_agreement_id: agreement.id, p_target_account_id: otherParty(agreement, reviewer).id,
  p_rating: rating, p_tags: tags, p_client_request_id: key, ...(comment === undefined ? {} : {p_comment: comment})});
const submitV2 = (reviewer, args) => call(reviewer.client, 'rpc_submit_agreement_review_v2', args);
const submitLegacy = (reviewer, args) => call(reviewer.client, 'rpc_submit_agreement_review', args);
const contextV2 = (viewer, agreementId) => call(viewer.client, 'rpc_get_my_agreement_review_v2', {p_agreement_id: agreementId});
const contextLegacy = (viewer, agreementId) => call(viewer.client, 'rpc_get_my_agreement_review', {p_agreement_id: agreementId});
const readerPage = (viewer, profileId, args = {}) => call(viewer.client, 'rpc_list_review_comments_v1', {p_profile_id: profileId, ...args});
/** What a command left behind for one Agreement: star rows, comment rows (when the table exists), REVIEW_RECEIVED events, review audit rows. */
const written = id => rows(`select (select count(*) from private.agreement_reviews where agreement_id = ${q(id)}) stars,
  ${tableExists() ? `(select count(*) from private.agreement_review_comments_v1 c join private.agreement_reviews r on r.id = c.review_id where r.agreement_id = ${q(id)})` : '0'} comments,
  (select count(*) from public.user_activity_events where entity_id = ${q(id)} and event_type = 'REVIEW_RECEIVED') events,
  (select count(*) from private.marketplace_audit_log where entity_id = ${q(id)} and event_type like 'AGREEMENT_REVIEW%') audits`)[0];
const starRows = id => rows(`select * from private.agreement_reviews where agreement_id = ${q(id)} order by reviewer_account_id`);
const commentRows = id => rows(`select c.* from private.agreement_review_comments_v1 c join private.agreement_reviews r on r.id = c.review_id where r.agreement_id = ${q(id)} order by c.author_account_id`);
const reputationOf = async (viewer, accountId) => mustOk(await call(viewer.client, 'rpc_get_account_reputation', {p_account_id: accountId}), 'reputation');
const publicProfile = (viewer, profileId) => call(viewer.client, 'rpc_get_public_profile', {p_profile_id: profileId});
const starFormula = row => sql(`select encode(extensions.digest(jsonb_build_object('agreementId', ${q(row.agreement_id)}::uuid, 'target', ${q(row.target_account_id)}::uuid, 'rating', ${Number(row.rating)}, 'tags', ${q(JSON.stringify(row.tags))}::jsonb)::text, 'sha256'), 'hex')`);
const enableNotifications = async person => { for (const role of ['REQUESTER', 'WORKER']) await rt.prefs(person.client, person.id, role, {in_app_enabled: true, push_enabled: true, dogovor_enabled: true, quiet_hours_enabled: false}); };
const blockAccount = async (blocker, target, blocked) => {
  const current = mustOk(await call(blocker.client, 'rpc_get_account_block', {p_target_account_id: target.id}), 'get block');
  return mustOk(await call(blocker.client, 'rpc_set_account_block', {p_target_account_id: target.id, p_blocked: blocked, p_expected_revision: current.revision, p_client_request_id: randomUUID()}), 'set block');
};
/** A closure-restricted account as the EX-04 fixtures make one (a READY closure request; replica role so no trigger runs): the platform fences it at the API, the predicates see it as restricted. */
const restrictAccount = person => must(`begin; set local session_replication_role = replica; insert into private.account_closure_requests(account_id, state, revision) values(${q(person.id)}, 'READY', 1) on conflict (account_id) do nothing; commit;`, 'restrict ' + person.label);
const unrestrictAccount = person => must(`begin; set local session_replication_role = replica; delete from private.account_closure_requests where account_id = ${q(person.id)} and state = 'READY' and revision = 1; commit;`, 'unrestrict ' + person.label);
const putInTestWorld = person => sql(`insert into private.account_lineage_v5(account_id, lineage, reason, source_ref) values (${q(person.id)}, 'DEV_ACCEPTANCE_QA', 'D12 proof fixture account', 'd12-proof') on conflict do nothing`);

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// export snapshot, canary search, closure driver
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const exportCatalog = () => JSON.parse(sql('select private.data_export_dataset_catalog()::text'));
function exportSnapshot(accountId) {
  const entry = exportCatalog().find(item => item.key === 'ownAgreementReviews');
  assert.ok(entry, 'THE_OWN_REVIEWS_DATASET_EXISTS');
  const binding = {delivery: {datasets: [{key: 'ownAgreementReviews', mode: 'INCLUDE', fields: entry.fields}]}, policyId: null, policyVersion: null, privacyDocumentId: null, privacyContentSha256: null, sha256: null};
  return JSON.parse(sql(`select private.data_export_snapshot(${q(accountId)}::uuid, ${q(randomUUID())}::uuid, ${q(JSON.stringify(binding))}::jsonb, clock_timestamp())`));
}
/** Every table of public, private, auth and storage whose rows contain the text (a whole-row text cast): returns ['schema.table:rows', ...]. The canary of AF22 requiredProofs: absent everywhere. */
function canaryHits(canary) {
  const script = `create function pg_temp.d12_hits(p text) returns jsonb language plpgsql as $f$
declare r record; n bigint; hits text[] := '{}'; skipped text[] := '{}'; scanned integer := 0;
begin
  for r in select nsp.nspname s, c.relname t from pg_class c join pg_namespace nsp on nsp.oid = c.relnamespace
    where c.relkind in ('r','p') and nsp.nspname in ('public','private','auth','storage','supabase_migrations') order by 1, 2 loop
    begin
      execute format('select count(*) from %I.%I x where x::text like $1', r.s, r.t) into n using '%' || p || '%';
      scanned := scanned + 1;
      if n > 0 then hits := hits || (r.s || '.' || r.t || ':' || n); end if;
    exception when others then skipped := skipped || (r.s || '.' || r.t);
    end;
  end loop;
  return jsonb_build_object('hits', to_jsonb(hits), 'scanned', scanned, 'skipped', to_jsonb(skipped));
end $f$;
select pg_temp.d12_hits(${q(canary)})::text;`;
  const result = JSON.parse(must(script, 'canary scan', {timeoutMs: 180000}));
  report.phases.canaryScan = {tablesScanned: result.scanned, tablesSkipped: result.skipped};
  assert.ok(result.scanned > 100, 'THE_CANARY_SCAN_COVERS_THE_WHOLE_DATABASE (scanned ' + result.scanned + ', skipped ' + result.skipped.length + ')');
  // round-1 finding: a scan that silently skips a table is vacuous for that table. A table of public or private that could not be scanned FAILS the scan, naming it (a skipped auth/storage/supabase_migrations table is reported).
  const unscannedAppTables = result.skipped.filter(name => /^(public|private)\./.test(name));
  assert.deepEqual(unscannedAppTables, [], 'THE_CANARY_SCAN_COULD_NOT_READ ' + unscannedAppTables.join(', '));
  return result.hits;
}
/** The text is in EXACTLY the named places (the comment table and nothing else): the exact-hit scan of the round-1 finding, replacing "includes". */
const assertOnlyInTheCommentTable = (canary, label, rowsExpected = 1) => assert.deepEqual(canaryHits(canary), [lib.TABLE + ':' + rowsExpected], 'THE_TEXT_IS_ONLY_IN_THE_COMMENT_TABLE ' + label);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const closingAllowed = new Set();
const workerCalls = {rpc: 0, auth: 0, storage: 0};
let closureRuntime = null;
function loadWorker() {
  if (closureRuntime) return closureRuntime;
  const allowedRpc = new Set(['rpc_claim_account_closure_action_service', 'rpc_dispatch_account_closure_action_service', 'rpc_redact_account_closure_step_service', 'rpc_complete_account_closure_action_service', 'rpc_finalize_account_closure_service']);
  closureRuntime = loadClosureWorker({env: name => ({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED: 'true', SUPABASE_URL: env.RU5_DEVICE_SUPABASE_URL, SUPABASE_ANON_KEY: env.RU5_DEVICE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.RU5_DEVICE_SERVICE_ROLE_KEY})[name], fetch: async (url, init) => {
    const parsed = new URL(url); assert.equal(parsed.origin, new URL(env.RU5_DEVICE_SUPABASE_URL).origin); assert.equal(parsed.search, '');
    const name = parsed.pathname.replace('/rest/v1/rpc/', ''), id = parsed.pathname.replace('/auth/v1/admin/users/', '');
    if (parsed.pathname.startsWith('/storage/v1/')) { workerCalls.storage += 1; assert.ok(['GET', 'DELETE'].includes(init.method)); return fetch(url, init); }
    assert.ok((parsed.pathname === '/rest/v1/rpc/' + name && allowedRpc.has(name) && init.method === 'POST') || (parsed.pathname === '/auth/v1/admin/users/' + id && closingAllowed.has(id) && ['GET', 'DELETE'].includes(init.method)),
      'WORKER_REQUEST_NOT_ADMITTED:' + parsed.pathname);
    workerCalls[parsed.pathname.startsWith('/auth/') ? 'auth' : 'rpc'] += 1;
    return fetch(url, init);
  }});
  return closureRuntime;
}
/** Prepares, reviews, starts and (unless `stopAfterStart`) completes ONE canonical closure through the real worker source. Returns what the proof needs. */
async function closeAccount(who, {stopAfterStart = false} = {}) {
  closingAllowed.add(who.id);
  mustOk(await call(who.client, 'rpc_prepare_account_closure', {p_expected_user_id: who.id, p_expected_revision: 0, p_client_request_id: randomUUID()}), 'prepare closure ' + who.label);
  const ready = mustOk(await call(who.client, 'rpc_review_account_closure_execution', {p_expected_user_id: who.id}), 'review closure ' + who.label);
  assert.equal(ready.ready, true, 'CLOSURE_READY ' + who.label + ' blockers=' + JSON.stringify(ready.blockers)); assert.deepEqual(ready.blockers, []);
  assert.equal(ready.adapterVersion, 'OWNER_AF_D22_EVENT_ERASURE_V1');
  const args = {p_expected_user_id: who.id, p_request_id: ready.requestId, p_expected_revision: ready.revision, p_client_request_id: randomUUID(), p_policy_sha256: ready.policySha256};
  const started = mustOk(await call(who.client, 'rpc_start_account_closure_execution', args), 'start closure ' + who.label);
  assert.equal(started.state, 'EXECUTING');
  const total = Number(sql('select cardinality(private.closure_redaction_relations_v5())'));
  if (stopAfterStart) return {started, ready, total, closed: null, calls: 0};
  const runtime = loadWorker();
  let closed = null, calls = 0;
  for (; calls < total + 80 && !closed; calls++) {
    const response = await runtime.handler(new Request('http://127.0.0.1/closure', {method: 'POST', headers: {apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY, 'content-type': 'application/json'},
      body: JSON.stringify({accountId: who.id, generation: started.generation})}));
    const value = await response.json();
    if (response.status !== 200) throw new Error('CLOSURE_WORKER_STEP_FAILED:' + response.status + ':' + String(value?.code).slice(0, 80) + ':call' + (calls + 1));
    if (value.state === 'CLOSED') closed = value;
  }
  assert.ok(closed, 'CLOSURE_REACHED_CLOSED ' + who.label);
  assert.equal(closed.authoritative, true); assert.equal(closed.relationalOutcome, 'ORDINARY_PERSONAL_CONTENT_ERASED'); assert.equal(closed.authOutcome, 'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED');
  return {started, ready, total, closed, calls};
}
const finishClosure = async (who, started) => {
  const runtime = loadWorker(); let closed = null, calls = 0;
  for (; calls < 200 && !closed; calls++) {
    const response = await runtime.handler(new Request('http://127.0.0.1/closure', {method: 'POST', headers: {apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY, 'content-type': 'application/json'}, body: JSON.stringify({accountId: who.id, generation: started.generation})}));
    const value = await response.json();
    if (response.status !== 200) throw new Error('CLOSURE_WORKER_STEP_FAILED:' + response.status + ':' + String(value?.code).slice(0, 80));
    if (value.state === 'CLOSED') closed = value;
  }
  assert.ok(closed, 'CLOSURE_FINISHED ' + who.label); return closed;
};

// ==================================================================================================================================================================
// P0 the pin gate, the chain variant, the certificate before
// ==================================================================================================================================================================
const pinRows = pins.loadPins(readFileSync(PINS_FILE, 'utf8'));
const original = {application: readFileSync(APPLICATION, 'utf8'), preflight: readFileSync(PREFLIGHT, 'utf8'), postflight: readFileSync(POSTFLIGHT, 'utf8'), revert: readFileSync(REVERT, 'utf8')};
const preimage = JSON.parse(readFileSync(PREIMAGE_FILE, 'utf8'));
const EX04_POSTFLIGHTS = ['a', 'b', 'c', 'd'].map(letter => 'supabase/proofs/ex04/ex04' + letter + '_postflight.readonly.sql');

await check('P0_GENERATED_FILES_EQUAL_THE_COMMITTED_ONES_AND_THE_CHAIN_STATE_IS_RECORDED', async () => {
  const generated = execFileSync('python3', [GENERATOR, '--check', '--syntax'], {encoding: 'utf8'});
  report.candidate = {generatorCheck: generated.trim().split(/\r?\n/), applicationSha256: sha256(original.application), revertSha256: sha256(original.revert), preflightSha256: sha256(original.preflight),
    postflightSha256: sha256(original.postflight), pinsSha256: sha256(readFileSync(PINS_FILE)), preimageSha256: sha256(readFileSync(PREIMAGE_FILE))};
  // round-1 finding: the bytes this run applies are the bytes the owner is shown. The committed manifest holds the sha256 of the four generated files (read as BYTES: a carriage return changes it).
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')); state.manifest = manifest;
  for (const [path, text] of [[APPLICATION, original.application], [REVERT, original.revert], [PREFLIGHT, original.preflight], [POSTFLIGHT, original.postflight]]) {
    assert.equal(sha256(readFileSync(path)), manifest.files[path].sha256, 'THE_COMMITTED_FILE_EQUALS_THE_MANIFEST_BYTE_FOR_BYTE ' + path); assert.ok(!text.includes('\r'), 'LF_ONLY ' + path);
    assert.ok(!/[^\x00-\x7F]/.test(text), 'ASCII_ONLY ' + path); assert.deepEqual(lib.findEscapeTexts(text), [], 'NO_UNICODE_ESCAPE_TEXT (a connector would resolve it) ' + path);
  }
  report.candidate.manifest = {unit: manifest.unit, files: Object.fromEntries(Object.entries(manifest.files).map(([path, entry]) => [path, entry.sha256])), guarded: manifest.guarded};
  const facts = rows(`select cardinality(private.closure_redaction_relations_v5()) roster, (private.closure_redaction_relations_v5())[cardinality(private.closure_redaction_relations_v5())] last_relation,
    to_regclass('private.agreement_voice_uploads_v1') is not null voice_present, jsonb_array_length(private.data_export_dataset_catalog()) datasets,
    (select count(*) from private.retention_data_classes where required and active) classes, (select count(*) from private.agreement_reviews) reviews,
    (select count(*) from supabase_migrations.schema_migrations) ledger, current_setting('server_version') server_version,
    (select datctype from pg_database where datname = current_database()) lc_ctype, (select datcollate from pg_database where datname = current_database()) lc_collate,
    private.data_export_projection_sha_v5() projection_sha, (select count(*) from private.closure_executions_v5) closures,
    (select count(*) from private.retention_policy_sets) policy_sets, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private','rls_private')) functions`)[0];
  report.chain = {...report.chain, ...facts, ledgerIsTheChainLedgerNotDev: true}; state.chainFacts = facts;
  assert.equal(facts.voice_present, true, 'THE_CHAIN_CARRIES_THE_VOICE_B1_APPLICATION (workflow stage 27)');
  assert.equal(facts.roster, 75); assert.equal(facts.last_relation, 'public.app_accounts'); assert.equal(facts.datasets, 52); assert.equal(facts.classes, 15);
  assert.equal(tableExists(), false); for (const signature of lib.NEW_FUNCTIONS) assert.equal(exists(signature), false, 'ABSENT_BEFORE ' + signature);
  report.chain.ex04Postflights = {};
  for (const path of EX04_POSTFLIGHTS) { const flight = JSON.parse(sql(readFileSync(path, 'utf8'))); report.chain.ex04Postflights[path.split('/').pop()] = flight.problems; }
  // informational, never a gate: the ratingDue readers D12 leans on are pinned (adjacent) by the pin gate, and P6 records whether the fact is present
  const lacking = Object.entries(report.chain.ex04Postflights).filter(([, problems]) => problems.length).map(([name]) => name);
  if (lacking.length) report.gaps.push('EX-04 postflight problems on the chain (the chain is then less DEV-like for those readers): ' + lacking.join(', '));
});

await check('P0_PIN_GATE_READS_EVERY_PINNED_MD5_ON_THE_CHAIN_AND_FAILS_ON_A_CORE_DIFFERENCE', async () => {
  const observations = JSON.parse(sql(pins.chainReadSql(pinRows, q)));
  const gate = pins.classifyPins(pinRows, observations), evaluation = pins.evaluatePinGate(gate);
  report.label = pins.gateLabel(gate); report.labelShort = pins.gateLabelShort(gate);
  // round-2 finding (certificate #6): every difference is printed, one line each, BEFORE the assertion (a failure record is cut at 1600 characters; the complete table is in report.pinGate and in the markdown), so one run shows all of them
  const allDifferences = pins.listAllPinDifferences(gate, evaluation); report.pinGate = {allDifferences}; for (const line of allDifferences) console.error('PIN_GATE ' + line);
  report.pinGate = {ok: evaluation.ok, failures: evaluation.failures, warnings: evaluation.warnings, equal: gate.equal.length, total: gate.total, core: {total: gate.core.total, equal: gate.core.equal}, adjacent: {total: gate.adjacent.total, equal: gate.adjacent.equal},
    different: gate.different, missing: gate.missing, allDifferences, readinessComparedMasked: pins.READINESS_MASKED_BODY_MD5, markdown: pins.renderPinGateMarkdown(gate, evaluation)};
  console.log('LABEL: ' + report.label); save();
  // The run CONTINUES with the chain variant when the only failures are UNEXPLAINED adjacent differences (so that one run reports everything it can), but its verdict is red until each one is explained; a core
  // difference, a missing pin or a broken read stops everything that depends on the gate.
  const stopping = evaluation.failures.filter(item => !item.startsWith('ADJACENT_PIN_UNEXPLAINED_DIFFERENCE'));
  if (stopping.length === 0) state.gate = gate;
  state.exactBytes = pins.appliesTheCommittedBytes(gate); report.pinGate.appliesTheCommittedBytes = state.exactBytes;
  assert.equal(evaluation.failures.length, 0, 'PIN_GATE_FAILED (' + evaluation.failures.length + ' failure(s); the full list is printed above, in report.pinGate.allDifferences and in the markdown): ' + evaluation.failures.join(' | '));
});
// D12_PIN_GATE_ONLY=1: stop after the pin gate (a cheap first cycle that shows EVERY pin difference of a new chain before the full proof runs)
if (env.D12_PIN_GATE_ONLY === '1') {
  report.result = report.failures.length ? 'PIN_GATE_ONLY_FAIL' : 'PIN_GATE_ONLY_PASS';
  try { writeFileSync(markdownPath, '# D12 pin gate only\n\n' + (report.pinGate?.markdown ?? '') + '\n'); } catch { /* the JSON report is the record */ }
  save(); console.log(report.result + ' D12 pin gate only [' + report.labelShort + ']'); process.exit(report.failures.length ? 1 : 0);
}

await check('P0_CHAIN_VARIANT_OF_THE_CANDIDATE_DIFFERS_FROM_THE_GENERATED_FILE_ONLY_AT_THE_REPLACED_MD5_LITERALS', async () => {
  const app = pins.buildChainVariant(original.application, state.gate, {requireFound: true}), pre = pins.buildChainVariant(original.preflight, state.gate, {requireFound: true});
  const post = pins.buildChainVariant(original.postflight, state.gate, {requireFound: false});
  for (const [name, source, variant] of [['application', original.application, app], ['preflight', original.preflight, pre], ['postflight', original.postflight, post]])
    assert.ok(pins.variantDiffersOnlyAtPins(source, variant.text, variant.applied), 'VARIANT_DIFFERS_ONLY_AT_PINS ' + name);
  const paths = {application: PUBLIC + '/d12_application.chain.sql', preflight: PUBLIC + '/d12_preflight.chain.sql', postflight: PUBLIC + '/d12_postflight.chain.sql'};
  writeFileSync(paths.application, app.text); writeFileSync(paths.preflight, pre.text); writeFileSync(paths.postflight, post.text);
  state.variants = {application: app.text, preflight: pre.text, postflight: post.text, paths, replaced: app.applied.filter(item => item.replaced > 0)};
  // THE EXACT BYTES (round-1 finding): when the chain equals DEV in every pinned function, the text this run applies IS the committed file, byte for byte, behind the committed guard; otherwise the variant differs only at the listed md5 literals.
  const guardedPath = PUBLIC + '/d12_application.chain.guarded.sql', guarded = wrapFile(paths.application, guardedPath); state.variants.guardedPath = guardedPath; state.variants.guarded = guarded.text;
  const identical = app.text === original.application;
  assert.equal(identical, app.applied.filter(item => item.replaced > 0).length === 0, 'THE_VARIANT_IS_THE_COMMITTED_FILE_EXACTLY_WHEN_NO_PIN_WAS_REPLACED');
  if (state.exactBytes) {
    assert.equal(identical, true, 'THE_PROOF_APPLIES_THE_COMMITTED_BYTES'); assert.equal(sha256(app.text), state.manifest.files[APPLICATION].sha256);
    assert.equal(sha256(guarded.text), state.manifest.guarded[APPLICATION].guardedSha256, 'THE_GUARDED_TEXT_THE_PROOF_SENDS_IS_THE_GUARDED_TEXT_OF_THE_MANIFEST');
  }
  report.candidate.chainVariant = {identicalToTheDevFile: identical, appliesTheCommittedBytes: state.exactBytes, applicationSha256: sha256(app.text), guardedApplicationSha256: sha256(guarded.text), guardBytes: guarded.text.length - app.text.length,
    replacedAdjacentPins: state.variants.replaced.map(({signature, kind, replaced}) => ({signature, kind, replaced}))};
}, {needs: ['gate']});

await check('P0_PREFLIGHT_ON_THE_CHAIN_HAS_NO_PROBLEM_AND_THE_CERTIFICATE_IS_CERTIFIED_READY_AND_BOUND', async () => {
  const result = psql(state.variants.preflight); assert.ok(result.ok, 'PREFLIGHT_RAN: ' + (result.message ?? result.stderr));
  const flight = JSON.parse(result.stdout);
  assert.deepEqual(flight.problems, []); assert.equal(flight.ready, true); assert.equal(flight.erasureBindingMatches, true); assert.equal(flight.closureExecutionsExecuting, 0);
  assert.equal(flight.certifiedSource, flight.liveDigest); assert.equal(flight.redactionRelations, 75); assert.equal(flight.exportDatasets, 52);
  assert.equal(flight.certifiedSourceIsTheRecordedDevOne, false, 'THE_CHAIN_CERTIFICATE_IS_NOT_THE_DEV_ONE (OID-dependent digest: chain-internal only)');
  report.chain.preflight = {metadataPinsChecked: flight.metadataPinsChecked, bodyPinsChecked: flight.bodyPinsChecked, certifiedSourcePrefix: flight.certifiedSource.slice(0, 8), devDigestPrefix: pins.DEV_PINS_SOURCE.closureDigestPrefix};
  state.closureBefore = closureState(); assert.ok(certificateConsistent(state.closureBefore));
}, {needs: ['variants']});

await check('P0_PREFLIGHT_UNDER_THE_APPLICATIONS_OWN_SEARCH_PATH_HAS_NO_PROBLEM', async () => {
  // The application runs every predicate under search_path = pg_catalog; pg_get_constraintdef / regclass::text change their output with the path. A predicate that is right under the default path and wrong under pg_catalog is invisible otherwise (round-3 review: the star-table constraints pin).
  const result = psql('set search_path = pg_catalog;\n' + state.variants.preflight); assert.ok(result.ok, 'PREFLIGHT_UNDER_PG_CATALOG_RAN: ' + (result.message ?? result.stderr));
  const flight = JSON.parse(result.stdout.split('\n').filter(Boolean).pop()); assert.deepEqual(flight.problems, [], 'PREFLIGHT_PROBLEMS_UNDER_PG_CATALOG ' + JSON.stringify(flight.problems));
}, {needs: ['variants']});

// ==================================================================================================================================================================
// P1 BEFORE: the legacy star-only flow works, there is no comment surface (FAIL-BEFORE)
// ==================================================================================================================================================================
const P = {};                      // the people
const legacyClient = actor => {    // the REAL shipped client over the actual PostgREST session of one person
  const session = {user: {id: actor.id}, accountRevision: 1}, transport = {rpc: (name, input) => actor.client.rpc(name, input)};
  const loader = loadPreV3Clients({sourceSha: env.GITHUB_SHA, client: () => transport, session: () => session});
  return {loader, module: loader.load('src/data/reviewsClientService.ts')};
};
const accepted = async promise => { const result = await promise; assert.equal(result.ok, true, 'CLIENT_RESULT ' + JSON.stringify(result.kod ?? result)); return result.podatak; };
const plain = value => JSON.parse(JSON.stringify(value));
const legacyBodies = () => Object.fromEntries([...lib.LEGACY_FUNCTIONS, 'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)', 'public.rpc_home_attention()'].map(signature => [signature, bodyMd5(signature)]));

await check('P1_LEGACY_STAR_ONLY_FLOW_WORKS_BEFORE_AND_THERE_IS_NO_COMMENT_SURFACE_ANYWHERE', async () => {
  P.rq = await person('requester', {name: 'D12 Narucilac'}); P.wk = await person('worker', {name: 'D12 Majstor'});
  await enableNotifications(P.rq); await enableNotifications(P.wk);
  P.a0 = await completedAgreement(P.rq, P.wk, 'before: reviewed by the legacy function');
  P.a1 = await completedAgreement(P.rq, P.wk, 'before: left open for the replay matrix');
  // FAIL-BEFORE: nothing of D12 exists
  assert.equal(tableExists(), false);
  for (const signature of lib.NEW_FUNCTIONS) assert.equal(exists(signature), false, signature);
  assert.equal(sql("select count(*) from information_schema.columns where table_schema = 'private' and table_name = 'agreement_reviews' and column_name ~* 'comment|text|note|body'"), '0');
  const noV2 = await contextV2(P.rq, P.a0.id); assert.equal(noV2.error?.code, 'PGRST202', 'NO_V2_CONTEXT_BEFORE (PostgREST does not know the function): ' + JSON.stringify(lib.outcomeOf(noV2))); assert.equal(noV2.status, 404);
  assert.equal((await readerPage(P.rq, P.wk.profile.WORKER)).error?.code, 'PGRST202', 'NO_READER_BEFORE');
  assert.equal((await submitV2(P.rq, reviewArgs(P.a0, P.rq, {comment: 'x'}))).error?.code, 'PGRST202', 'NO_V2_SUBMIT_BEFORE: a comment can not be sent to any function');
  assert.equal((await call(service, 'rpc_moderate_review_comment_service_v1', {p_review_id: randomUUID(), p_action: 'HIDE', p_reason_code: 'ABUSE', p_client_request_id: randomUUID()})).error?.code, 'PGRST202', 'NO_MODERATION_BEFORE');
  assert.equal((await submitLegacy(P.rq, {...reviewArgs(P.a0, P.rq), p_comment: 'x'})).error?.code, 'PGRST202', 'THE_LEGACY_FUNCTION_CANNOT_CARRY_TEXT_BEFORE_EITHER');
  assert.ok(!roster().includes(lib.TABLE)); assert.deepEqual(exportCatalog().find(item => item.key === 'ownAgreementReviews').fields, ['agreementId', 'createdAt', 'id', 'rating', 'tags']);
  // the legacy flow: the requester reviews the worker star-only, through the real PostgREST path
  const context = mustOk(await contextLegacy(P.rq, P.a0.id), 'legacy context before'); assert.equal(context.eligible, true); assert.equal(context.review, null);
  const key = randomUUID(), receipt = mustOk(await submitLegacy(P.rq, reviewArgs(P.a0, P.rq, {rating: 5, tags: ['RELIABLE', 'ON_TIME'], key})), 'legacy submit before');
  assert.equal(receipt.idempotentReplay, false); assert.ok(!('comment' in receipt));
  const after = mustOk(await contextLegacy(P.rq, P.a0.id), 'legacy context after the review'); assert.equal(after.eligible, false); assert.equal(after.review.reviewId, receipt.reviewId);
  const reputation = await reputationOf(P.rq, P.wk.id); assert.equal(reputation.reviewCount, 1);
  const trust = mustOk(await publicProfile(P.rq, P.wk.profile.WORKER), 'public profile before').trust;
  state.legacyBefore = {receiptKeys: Object.keys(receipt).sort(), contextKeys: Object.keys(context).sort(), reviewKeys: Object.keys(after.review).sort(), reputationKeys: Object.keys(reputation).sort(), trustKeys: Object.keys(trust).sort(),
    reviewId: receipt.reviewId, key, rating: 5, tags: ['ON_TIME', 'RELIABLE']};
  P.a0Review = receipt;
  // the real shipped client, exact git bytes: context, submit (a replay), reputation
  try {
    const client = legacyClient(P.rq), viaClient = await accepted(client.module.reviewsClientService.context(P.a0.id)); assert.equal(viaClient.review.reviewId, receipt.reviewId);
    report.chain.legacyClientSourceHashes = client.loader.sourceHashes;
    state.legacyClientBefore = {contextKeys: Object.keys(plain(viaClient)).sort(), reviewKeys: Object.keys(plain(viaClient.review)).sort()};
  } catch (error) { report.gaps.push('THE_REAL_SHIPPED_REVIEW_CLIENT_COULD_NOT_BE_DRIVEN (' + String(error?.message ?? error).slice(0, 200) + '): the old-client phases use the raw five-argument calls only'); }
  state.legacyBodiesBefore = legacyBodies(); state.starBaseline = sql("select count(*) || ':' || md5(coalesce(string_agg(id::text || ':' || input_hash, ',' order by id), '')) from private.agreement_reviews");
  report.phases.before = {legacyBodies: state.legacyBodiesBefore, starBaseline: state.starBaseline, shapes: state.legacyBefore};
});

// ==================================================================================================================================================================
// P2 APPLY: refusals (nothing changes), the atomic application, the exact delta accounting
// ==================================================================================================================================================================
/**
 * The POST-STATE body md5 of a rewritten function in the application text. The text carries THREE (signature, md5) rows for it, in this order: the METADATA pin, the predecessor BODY pin and the rewritten-body pin of step 4.
 * Round-1 finding: "the first value that differs from the body pin" is the metadata md5 (the refusal then names D12_APPLICATION_METADATA_DRIFT). The post-state pin is the LAST row, and it must be a third value.
 */
const postMd5Of = (text, signature) => {
  const found = [...text.matchAll(new RegExp("\\('" + signature.replace(/[()]/g, '\\$&') + "','([0-9a-f]{32})'\\)", 'g'))].map(match => match[1]), row = pinRows.find(item => item.signature === signature);
  assert.equal(found.length, 3, 'THREE_PIN_ROWS_FOR_A_REWRITTEN_FUNCTION (metadata, predecessor body, post-state body) ' + signature + ': ' + found.length);
  const post = found.at(-1);
  assert.notEqual(post, row.bodyMd5, 'THE_POST_STATE_PIN_IS_NOT_THE_PREDECESSOR_BODY'); assert.notEqual(post, row.metadataMd5, 'THE_POST_STATE_PIN_IS_NOT_THE_METADATA_PIN');
  assert.deepEqual(found.slice(0, 2), [row.metadataMd5, row.bodyMd5], 'THE_FIRST_TWO_ROWS_ARE_THE_METADATA_AND_THE_PREDECESSOR_BODY_PINS'); return post;
};
const defaultAcls = () => sql("select coalesce(string_agg(defaclnamespace::regnamespace::text || ':' || defaclobjtype::text || ':' || defaclacl::text, ' | ' order by defaclnamespace::regnamespace::text, defaclobjtype::text), '') from pg_default_acl");
/** A refusal probe ALWAYS ends in `rollback`: a tamper that fails silently can never leave a committed application behind (the probe would report EXPECTED_REFUSAL instead). */
function refuseApplication(name, script, pattern, sqlstate = '55000', pre = '') {
  const before = hashJson(snapshot()), result = psql('begin;\n' + pre + '\n' + script + '\nrollback;', {timeoutMs: 240000});
  assert.equal(result.ok, false, 'EXPECTED_REFUSAL:' + name + ' (the application ran to the end and was rolled back)');
  assert.ok(pattern.test(String(result.message)), `REFUSAL_NAME:${name} expected ${pattern} got ${result.message ?? result.stderr}`);
  assert.equal(result.sqlstate, sqlstate, 'REFUSAL_SQLSTATE:' + name);
  assert.equal(hashJson(snapshot()), before, 'CATALOG_CHANGED_BY_REFUSAL:' + name);
  report.refusals.push({phase: 'APPLY', name, message: result.message, sqlstate: result.sqlstate, completeCatalogUnchanged: true});
}
await check('P2_PREDECESSOR_DRIFT_AND_UNSAFE_STATE_REFUSE_THE_WHOLE_APPLICATION_AND_LEAVE_THE_COMPLETE_CATALOG_UNCHANGED', async () => {
  const text = state.variants.application, observed = Object.fromEntries(JSON.parse(sql(pins.chainReadSql(pinRows, q))).map(item => [item.signature, item]));
  const zeros = '0'.repeat(32), chainBody = signature => observed[signature].bodyMd5, chainMetadata = signature => observed[signature].metadataMd5;
  const replaced = (from, to) => { assert.equal(text.split(from).length - 1, 1, 'THE_TAMPER_ANCHOR_OCCURS_EXACTLY_ONCE_IN_THE_FILE ' + from.slice(0, 80)); return text.replace(from, () => to); };
  refuseApplication('BODY_PIN', replaced(chainBody(lib.SIG.publicProfile), zeros), /^D12_APPLICATION_BODY_DRIFT: /);
  refuseApplication('METADATA_PIN', replaced(chainMetadata(lib.SIG.legacyContext), zeros), /^D12_APPLICATION_METADATA_DRIFT: /);
  refuseApplication('METADATA_TAMPER', text, /^D12_APPLICATION_METADATA_DRIFT: /, '55000', 'alter function private.closure_account_restricted(uuid) cost 4321;');
  refuseApplication('READINESS_METADATA_TAMPER', text, /^D12_APPLICATION_METADATA_DRIFT: /, '55000', 'alter function private.retention_ai_source_ready() cost 4321;');
  refuseApplication('LEGACY_BODY_TAMPER', text, /^D12_APPLICATION_(BODY|METADATA)_DRIFT: /, '55000',
    `do $t$ declare d text := pg_get_functiondef(${q(lib.SIG.legacyContext)}::regprocedure); begin if position('REVIEW_NOT_ALLOWED' in d) = 0 then raise exception 'TAMPER_ANCHOR_ABSENT'; end if; execute replace(d, 'REVIEW_NOT_ALLOWED', 'REVIEW_NOT_ALLOWED2'); end $t$;`);
  refuseApplication('CERTIFICATES_DISAGREE', text, /^D12_APPLICATION_CLOSURE_PREDECESSOR_NOT_READY$/, '55000', "update private.closure_erasure_source_v5 set sha256 = repeat('0', 64) where singleton;");
  refuseApplication('UNREVIEWED_TABLE_MOVES_THE_DIGEST', text, /^D12_APPLICATION_CLOSURE_PREDECESSOR_NOT_READY$/, '55000', 'create table private.d12_unreviewed_source(id integer);');
  refuseApplication('OBJECT_ALREADY_PRESENT', text, /^D12_APPLICATION_ALREADY_PRESENT$/, '55000', 'create function private.review_comment_input_v1(a jsonb) returns text language sql as $x$ select 1 $x$;');
  const post = postMd5Of(text, lib.SIG.relations); assert.ok(post, 'THE_REWRITTEN_BODY_PIN_IS_IN_THE_FILE');
  refuseApplication('POST_STATE_PIN_OF_A_REWRITTEN_BODY', replaced(post, zeros), /^D12_APPLICATION_REWRITTEN_BODY_DELTA: /);
  for (const signature of [lib.SIG.scope, lib.SIG.patch, lib.SIG.exportCatalog, lib.SIG.exportSnapshot, lib.SIG.exportBinding]) refuseApplication('POST_STATE_PIN_OF_' + signature.split('(')[0], replaced(postMd5Of(text, signature), zeros), /^D12_APPLICATION_REWRITTEN_BODY_DELTA: /);
  // round-1 additions (each would have been accepted before): the predecessor shape of the STAR table inside the statement, the composite-typed functions' authority, the retention class text, and the isolation probe's own refusal paths
  refuseApplication('STAR_TABLE_SHAPE_CHANGED', text, /^D12_APPLICATION_STAR_TABLE_DRIFT$/, '55000', 'alter table private.agreement_reviews add column d12_extra text;');
  refuseApplication('STAR_TABLE_POLICY_ADDED', text, /^D12_APPLICATION_STAR_TABLE_DRIFT$/, '55000', 'create policy d12_probe_policy on private.agreement_reviews for select using (false);');
  refuseApplication('COMPOSITE_FUNCTION_AUTHORITY_CHANGED', text, /^D12_APPLICATION_COMPOSITE_METADATA_DRIFT: private\.review_receipt/, '55000', 'alter function private.review_receipt(private.agreement_reviews, boolean) security definer;');
  refuseApplication('RETENTION_CLASS_TEXT_CHANGED', text, /^D12_APPLICATION_RETENTION_CLASS_PREDECESSOR_DRIFT$/, '55000', "update private.retention_data_classes set description = description || ' ' where code = 'AGREEMENT_REVIEWS';");
  refuseApplication('ISOLATION_PROBE_DOES_NOT_RESTORE_THE_SCOPE_FUNCTION', replaced('    execute pre_scope;\n', ''), /^D12_APPLICATION_DIGEST_NOT_ISOLATED: /);
  refuseApplication('ISOLATION_PROBE_DOES_NOT_DROP_THE_TABLE', replaced('    drop table private.agreement_review_comments_v1;\n    raise exception', '    raise exception'), /^D12_APPLICATION_DIGEST_NOT_ISOLATED: /);
  refuseApplication('ISOLATION_PROBE_IS_NOT_ROLLED_BACK', replaced("raise exception 'D12_ISOLATION_PROBE' using errcode='55000',detail=private.closure_source_digest_v5();", 'probe_digest:=private.closure_source_digest_v5();'), /^D12_APPLICATION_PROBE_NOT_ROLLED_BACK$/);
  // the apply-time integrity guard: one changed character of the candidate part is refused by the DATABASE before anything runs
  const guardedProbe = state.variants.guarded, marker = 'D12_APPLICATION_OWNER_REQUIRED', at = guardedProbe.indexOf(marker); assert.ok(at > 0, 'THE_GUARD_TAMPER_ANCHOR_IS_IN_THE_GUARDED_TEXT');
  const before = hashJson(snapshot()), refused = psqlCommand(guardedProbe.slice(0, at) + 'D12_APPLICATION_OWNER_REQUIREX' + guardedProbe.slice(at + marker.length));
  assert.equal(refused.ok, false, 'A_ONE_CHARACTER_CHANGE_IS_REFUSED_BY_THE_GUARD'); assert.equal(refused.message, 'D12_APPLY_TEXT_INTEGRITY'); assert.equal(refused.sqlstate, '55000'); assert.equal(hashJson(snapshot()), before, 'THE_GUARD_REFUSAL_CHANGED_NOTHING');
  report.refusals.push({phase: 'APPLY', name: 'GUARD_TEXT_INTEGRITY', message: refused.message, sqlstate: refused.sqlstate, completeCatalogUnchanged: true});
  // a closure that is EXECUTING blocks the application (the digest would change under it); the closure is then finished through the real worker
  const throwaway = await person('throwaway-closure'); const inFlight = await closeAccount(throwaway, {stopAfterStart: true});
  refuseApplication('CLOSURE_IN_FLIGHT', text, /^D12_APPLICATION_CLOSURE_IN_FLIGHT$/);
  const closed = await finishClosure(throwaway, inFlight.started); assert.equal(closed.state, 'CLOSED');
  report.phases.apply = {refusals: report.refusals.filter(item => item.phase === 'APPLY').length, closureBeforeApplyCompletedThroughTheRealWorker: true, rosterAtThatClosure: inFlight.total};
}, {needs: ['variants', 'legacyBefore']});

await check('P2_THE_GUARD_ACCEPTS_THE_TEXT_WITH_OR_WITHOUT_ITS_FINAL_LINE_FEED_AND_WITH_A_CONNECTOR_TRAILER_AND_REFUSES_EVERY_OTHER_TEXT_WITH_A_NAMED_ERROR', async () => {
  // Round-2 finding (certificate #3): the guard is the SAME generator function that wraps the application, here wrapped around a harmless one-statement text so that the real database decides what it accepts. execute_sql appends a trailer
  // comment to every statement (measured read-only on 2026-10-01) and a typed text usually loses its final line feed: neither may change what the guard hashes; a changed character, a truncated text or ANY text before the guard is refused.
  const probePath = PUBLIC + '/d12_guard_probe.sql'; writeFileSync(probePath, "select 'D12_GUARD_PROBE_BODY';\n");
  const wrapped = wrapFile(probePath, PUBLIC + '/d12_guard_probe.guarded.sql').text, trailer = lib.CONNECTOR_TRAILER, noFinalLf = wrapped.replace(/\n+$/, '');
  assert.ok(wrapped.endsWith(";\n") && noFinalLf.endsWith(';'), 'THE_PROBE_TEXTS_ARE_AS_DESCRIBED');
  const accepted = [];
  for (const [name, text] of [['AS_GENERATED', wrapped], ['WITHOUT_THE_FINAL_LINE_FEED', noFinalLf], ['WITH_A_CONNECTOR_TRAILER', wrapped + trailer], ['WITHOUT_THE_FINAL_LINE_FEED_AND_WITH_A_CONNECTOR_TRAILER', noFinalLf + trailer], ['WITH_TWO_FINAL_LINE_FEEDS', wrapped + '\n']]) {
    const result = psqlCommand(text); assert.ok(result.ok, 'THE_GUARD_ACCEPTS ' + name + ': ' + (result.message ?? result.stderr)); assert.equal(result.stdout, 'D12_GUARD_PROBE_BODY', 'THE_STATEMENT_AFTER_THE_GUARD_RAN ' + name); accepted.push(name);
  }
  const refused = [], mustRefuseText = (name, text) => { const result = psqlCommand(text); assert.equal(result.ok, false, 'THE_GUARD_REFUSES ' + name); assert.equal(result.message, 'D12_APPLY_TEXT_INTEGRITY', 'THE_REFUSAL_IS_NAMED ' + name + ': ' + result.message); assert.equal(result.sqlstate, '55000'); refused.push(name); };
  mustRefuseText('ONE_CHANGED_CHARACTER', wrapped.replace('D12_GUARD_PROBE_BODY', 'D12_GUARD_PROBE_BODX')); mustRefuseText('A_TRUNCATED_TEXT', wrapped.replace('_PROBE_BODY', '_PROBE_BOD'));
  mustRefuseText('TEXT_BEFORE_THE_GUARD', '-- a prefix\n' + wrapped); mustRefuseText('A_SPACE_BEFORE_THE_GUARD', ' ' + wrapped);
  // whatever FOLLOWS the candidate must be only line feeds and `--` comment lines: a statement, a space, a block comment or a carriage return that ends a comment is refused with the same named error (nothing rides behind the candidate)
  mustRefuseText('A_STATEMENT_AFTER_THE_CANDIDATE', wrapped + "select 'D12_GUARD_PROBE_TAIL';"); mustRefuseText('A_COMMENT_THEN_A_STATEMENT_AFTER_THE_CANDIDATE', wrapped + "-- a comment\nselect 'D12_GUARD_PROBE_TAIL';");
  mustRefuseText('A_CARRIAGE_RETURN_THAT_ENDS_A_TRAILER_COMMENT', wrapped + "-- a comment\rselect 'D12_GUARD_PROBE_TAIL';"); mustRefuseText('A_TRAILING_SPACE', noFinalLf + ' '); mustRefuseText('A_BLOCK_COMMENT_AFTER', wrapped + '/* a comment */');
  report.phases.apply = {...report.phases.apply, guard: {acceptedTexts: accepted, refusedTexts: refused, connectorTrailer: 'accepted (the span ends at the last character of the candidate that is not a line feed; the tail may be line feeds and -- comment lines only)', anythingBeforeTheGuard: 'refused (the start position is absolute: fail closed)', statementAfterTheCandidate: 'refused'}};
  report.refusals.push({phase: 'APPLY', name: 'GUARD_TEXT_INTEGRITY_VARIANTS', message: 'D12_APPLY_TEXT_INTEGRITY', sqlstate: '55000', completeCatalogUnchanged: true});
}, {needs: ['variants']});

await check('P2_THE_ATOMIC_APPLICATION_APPLIES_ONCE_AND_A_SECOND_APPLICATION_IS_REFUSED', async () => {
  state.snapshotBefore = snapshot(); state.surfaceBefore = surface(); state.closureBefore = closureState(); state.defaultAclsBefore = defaultAcls(); state.changedBodiesBefore = Object.fromEntries(lib.CHANGED_FUNCTIONS.map(signature => [signature, bodyMd5(signature)]));
  assert.ok(certificateConsistent(state.closureBefore));
  state.preApplySnapshotHash = hashJson(state.snapshotBefore); state.classesBefore = rows('select * from private.retention_data_classes order by code');
  // the application is sent the way a connector sends it (the Voice B1 method): the integrity guard and the candidate as ONE text, ONE simple Query message. The guard (a DO block that hashes substr(current_query(), ...)) must PASS,
  // so the statement the database ran is, byte for byte, the committed file (state.exactBytes) or its listed chain variant.
  const started = Date.now(), result = psqlCommand(state.variants.guarded);
  assert.ok(result.ok, 'APPLICATION_APPLIED_BEHIND_THE_INTEGRITY_GUARD: ' + (result.message ?? result.stderr));
  report.phases.apply = {...report.phases.apply, applicationMilliseconds: Date.now() - started, appliedBehindTheIntegrityGuard: true, appliedTextIsTheCommittedFile: state.exactBytes === true};
  state.applied = true;
  await functionReady(P.rq.client, 'rpc_get_my_agreement_review_v2', {p_agreement_id: randomUUID()});
  await functionReady(P.rq.client, 'rpc_list_review_comments_v1', {p_profile_id: randomUUID()});
  const snapshotAfter = snapshot(); state.snapshotAfter = snapshotAfter; state.surfaceAfter = surface(); state.closureAfter = closureState();
  const second = psqlCommand(state.variants.guarded); assert.equal(second.ok, false); assert.match(String(second.message), /^D12_APPLICATION_ALREADY_PRESENT$/);
  assert.equal(hashJson(snapshot()), hashJson(snapshotAfter), 'A_SECOND_APPLICATION_CHANGES_NOTHING');
  report.refusals.push({phase: 'APPLY', name: 'SECOND_APPLICATION', message: second.message, sqlstate: second.sqlstate, completeCatalogUnchanged: true});
}, {needs: ['variants', 'legacyBefore']});

await check('P2_EXACT_DELTA_ONLY_THE_REVIEWED_FUNCTIONS_THE_NEW_TABLE_AND_ITS_OBJECTS_CHANGED_AND_NO_POLICY_NO_DEFAULT_ACL_NO_PUBLICATION', async () => {
  const diff = lib.surfaceDiff(state.surfaceBefore, state.surfaceAfter), cls = lib.classifySurfaceDelta(diff.removed, diff.added);
  assert.deepEqual(cls.unexpectedRemoved, [], 'NO_UNEXPECTED_REMOVED_SURFACE_LINE'); assert.deepEqual(cls.unexpectedAdded, [], 'NO_UNEXPECTED_ADDED_SURFACE_LINE'); assert.ok(cls.ok, JSON.stringify(cls));
  assert.equal(cls.changedFunctions.length, 7); assert.equal(cls.newFunctions.length, 6);
  const need = [`table:${lib.TABLE}:`, ...lib.COLUMNS.map(name => `column:${lib.TABLE}.${name}:`), ...lib.CONSTRAINTS.map(name => `constraint:${lib.TABLE}.${name}:`), ...lib.TRIGGERS.map(name => `trigger:${lib.TABLE}.${name}:`), ...lib.INDEXES.map(name => `index:private.${name}:`)];
  for (const prefix of need) assert.ok(cls.newTableLines.some(line => line.startsWith(prefix)), 'NEW_TABLE_LINE ' + prefix);
  assert.equal(cls.newTableLines.length, need.length, 'EXACTLY_THE_NEW_TABLE_OBJECTS'); assert.ok(!state.surfaceAfter.some(line => line.startsWith('policy:private.' + lib.TABLE_NAME)), 'NO_POLICY');
  assert.equal(defaultAcls(), state.defaultAclsBefore, 'DEFAULT_ACLS_UNCHANGED');
  // the catalog as the platform's own snapshot sees it: only the changed functions (by OID), the new ones, one new table authority row, the AGREEMENT_REVIEWS class row
  const before = state.snapshotBefore, after = state.snapshotAfter;
  const mapOf = list => new Map(list.map(([oid, md5]) => [String(oid), md5]));
  const was = mapOf(before.state.other_function_metadata), now = mapOf(after.state.other_function_metadata);
  const changed = [...was].filter(([oid, md5]) => now.has(oid) && now.get(oid) !== md5).map(([oid]) => oid).sort(), removed = [...was.keys()].filter(oid => !now.has(oid)), created = [...now.keys()].filter(oid => !was.has(oid)).sort();
  const oidOf = signature => sql(`select to_regprocedure(${q(signature)})::oid`);
  assert.deepEqual(removed, [], 'NO_FUNCTION_REMOVED');
  assert.deepEqual(changed, lib.REWRITTEN_FUNCTIONS.map(oidOf).sort(), 'ONLY_THE_SIX_REWRITTEN_FUNCTIONS_CHANGED_OUTSIDE_THE_READINESS_FUNCTION');
  assert.deepEqual(created, lib.NEW_FUNCTIONS.map(oidOf).sort(), 'ONLY_THE_SIX_NEW_FUNCTIONS_ARE_NEW');
  assert.equal(after.state.table_authority.length, before.state.table_authority.length + 1); assert.deepEqual(after.history, before.history, 'THE_MIGRATION_LEDGER_IS_UNCHANGED');
  assert.deepEqual(after.state.publications, before.state.publications); assert.deepEqual(after.state.publication_tables, before.state.publication_tables);
  const datasetsOf = snap => Object.fromEntries(snap.state.datasets.map(item => [item.data_class, item.relations]));
  assert.deepEqual(datasetsOf(after).AGREEMENT_REVIEWS, ['private.agreement_reviews', lib.TABLE]);
  assert.deepEqual({...datasetsOf(after), AGREEMENT_REVIEWS: null}, {...datasetsOf(before), AGREEMENT_REVIEWS: null}, 'EVERY_OTHER_RETENTION_CLASS_IS_UNCHANGED');
  assert.equal(state.chainFacts.classes, Number(sql('select count(*) from private.retention_data_classes where required and active')), 'STILL_FIFTEEN_REQUIRED_CLASSES');
  // round-1 finding: the retention class text names the free text now, and ONLY that one description changed (every other class row, and the updated_at of this one, is byte for byte what it was)
  const classesAfter = rows('select * from private.retention_data_classes order by code');
  assert.equal(state.classesBefore.find(item => item.code === lib.RETENTION_CLASS).description, lib.RETENTION_DESCRIPTION_OLD, 'THE_PREDECESSOR_DESCRIPTION_IS_THE_DEV_TEXT');
  assert.deepEqual(classesAfter, state.classesBefore.map(item => item.code === lib.RETENTION_CLASS ? {...item, description: lib.RETENTION_DESCRIPTION_NEW} : item), 'ONLY_THE_DESCRIPTION_OF_AGREEMENT_REVIEWS_CHANGED');
  assert.ok(!/[0-9]+ (day|month|year)|retention period of/i.test(lib.RETENTION_DESCRIPTION_NEW.replace('sets no retention period', '')), 'THE_NEW_DESCRIPTION_INVENTS_NO_PERIOD');
  report.phases.apply.delta = {changedFunctions: cls.changedFunctions, newFunctions: cls.newFunctions, newTableObjects: need.length};
}, {needs: ['applied', 'snapshotAfter']});

await check('P2_THE_NEW_TABLE_AND_THE_NEW_FUNCTIONS_HAVE_EXACTLY_THE_DESIGNED_AUTHORITY', async () => {
  const table = rows(`select c.relowner::regrole::text owner, (c.relacl = acldefault('r', c.relowner)) acl_is_owner_only, c.relacl::text acl, c.relrowsecurity rls, c.relforcerowsecurity forced, c.relkind kind, c.relpersistence persistence,
    (select count(*) from pg_policy where polrelid = c.oid) policies, (select count(*) from pg_publication_tables where schemaname = 'private' and tablename = ${q(lib.TABLE_NAME)}) published,
    (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and a.attacl is not null) column_acls from pg_class c where c.oid = to_regclass(${q(lib.TABLE)})`)[0];
  assert.equal(table.owner, 'postgres'); assert.equal(table.acl_is_owner_only, true, 'RELACL_IS_THE_OWNER_DEFAULT_ONLY ' + table.acl); assert.equal(table.rls, true); assert.equal(table.forced, true);
  assert.equal(table.kind, 'r'); assert.equal(table.persistence, 'p'); assert.equal(table.policies, 0); assert.equal(table.published, 0); assert.equal(table.column_acls, 0);
  assert.equal(sql('select count(*) from pg_publication where puballtables'), '0', 'NO_FOR_ALL_TABLES_PUBLICATION_EXISTS_THAT_COULD_STREAM_THE_TEXT'); assert.equal(sql("select count(*) from pg_publication_tables where schemaname = 'private'"), '0', 'NO_PRIVATE_TABLE_IS_PUBLISHED');
  for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(canTable(role, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), false, 'NO_TABLE_PRIVILEGE ' + role);
  for (const role of ['anon', 'authenticated']) assert.equal(sql(`select has_schema_privilege(${q(role)}, 'private', 'USAGE')`), 'f', 'NO_SCHEMA_PRIVATE_USAGE ' + role);
  table.serviceRoleHasSchemaPrivateUsage = flag(sql("select has_schema_privilege('service_role', 'private', 'USAGE')"));
  const expectation = {[lib.SIG.guard]: {definer: true, authenticated: false, service_role: false}, [lib.SIG.input]: {definer: false, authenticated: false, service_role: false},
    [lib.SIG.submitV2]: {definer: true, authenticated: true, service_role: false}, [lib.SIG.contextV2]: {definer: true, authenticated: true, service_role: false},
    [lib.SIG.reader]: {definer: true, authenticated: true, service_role: false}, [lib.SIG.moderate]: {definer: true, authenticated: false, service_role: true}};
  const matrix = {};
  for (const signature of lib.NEW_FUNCTIONS) {
    const meta = rows(`select p.prosecdef definer, coalesce(array_to_string(p.proconfig, ';'), '') config, p.provolatile volatility, p.proowner::regrole::text owner, coalesce(p.proacl::text, 'default') acl from pg_proc p where p.oid = to_regprocedure(${q(signature)})`)[0];
    const want = expectation[signature];
    assert.equal(meta.definer, want.definer, 'SECURITY_ ' + signature); assert.equal(meta.config, 'search_path=pg_catalog', 'SEARCH_PATH ' + signature); assert.equal(meta.owner, 'postgres');
    const actual = {anon: canExecute('anon', signature), authenticated: canExecute('authenticated', signature), service_role: canExecute('service_role', signature)};
    assert.equal(actual.anon, false, 'ANON_CANNOT_EXECUTE ' + signature); assert.equal(actual.authenticated, want.authenticated, 'AUTHENTICATED_ ' + signature); assert.equal(actual.service_role, want.service_role, 'SERVICE_ROLE_ ' + signature);
    matrix[signature] = {...meta, ...actual};
  }
  report.phases.apply.authority = {table, functions: matrix};
}, {needs: ['applied']});

await check('P2_THE_CERTIFICATE_IS_RE_BOUND_SELF_CONSISTENT_AND_READY_AND_ONLY_THE_DESIGNED_PLACES_MOVED', async () => {
  const before = state.snapshotBefore.state, after = state.snapshotAfter.state, now = state.closureAfter;
  assert.ok(certificateConsistent(now), 'LIVE_EQUALS_CERTIFIED_EQUALS_ERASURE_EQUALS_BINDING_READY ' + JSON.stringify(now)); assert.notEqual(now.live, state.closureBefore.live, 'THE_DIGEST_MOVED');
  assert.equal(after.digest, now.live); assert.equal(after.ready, true); assert.equal(after.binding.sourceSha256, now.live);
  assert.deepEqual(after.source, {...before.source, sha256: now.live}, 'closure_source_v5 changed in its digest only'); assert.deepEqual(after.erasure, {...before.erasure, sha256: now.live}, 'closure_erasure_source_v5 changed in its digest only');
  assert.equal(after.readiness_definition, before.readiness_definition.replace(before.source.sha256, now.live), 'retention_ai_source_ready changed ONLY by its one 64-hex literal');
  assert.notEqual(after.schema_digest, before.schema_digest, 'THE_SCHEMA_PART_MOVED (the new table)'); assert.notEqual(after.erasure_program_digest, before.erasure_program_digest, 'THE_PROGRAM_PART_MOVED (ACL, flags, triggers, rewritten bodies)');
  assert.equal(state.closureAfter.live, sql('select private.closure_source_digest_v5()'));
  const flight = JSON.parse(must(state.variants.postflight, 'postflight')); assert.deepEqual(flight.problems, [], 'POSTFLIGHT_PROBLEMS ' + JSON.stringify(flight.problems));
  { const under = psql('set search_path = pg_catalog;\n' + state.variants.postflight); assert.ok(under.ok, 'POSTFLIGHT_UNDER_PG_CATALOG_RAN: ' + (under.message ?? under.stderr)); assert.deepEqual(JSON.parse(under.stdout.split('\n').filter(Boolean).pop()).problems, [], 'POSTFLIGHT_PROBLEMS_UNDER_PG_CATALOG'); }
  assert.equal(flight.appliedBodyPinsChecked, 6); assert.equal(flight.newFunctionPinsChecked, 6); assert.equal(flight.ready, true); assert.equal(flight.erasureBindingMatches, true); assert.equal(flight.redactionRelations, 76);
  assert.equal(flight.exportDatasets, 52); assert.equal(flight.commentRows, 0); report.chain.exportPolicyBindingIsNull = flight.exportPolicyBindingIsNull;
  assert.equal(flight.reviewIdHashBaseline, sql("select md5(string_agg(id::text || ':' || input_hash, ',' order by id)) from private.agreement_reviews"));
  assert.deepEqual(roster().slice(-2), ['public.app_accounts', lib.TABLE]); assert.equal(roster().length, 76);
  report.phases.apply.certificate = {before: state.closureBefore.live.slice(0, 12), after: now.live.slice(0, 12), placesChanged: 3, ready: true, postflightProblems: flight.problems};
}, {needs: ['applied', 'snapshotAfter', 'closureAfter']});

// ==================================================================================================================================================================
// P3 OLD-CLIENT PARITY: the legacy functions are byte-identical, the five-argument call still works, replay interoperates, v2 without a comment IS the legacy command
// ==================================================================================================================================================================
/** Letters and spaces only (no digit run for the contact floor to read as a phone number): a canary no rule can refuse. */
const canaryText = label => 'Odlican majstor ' + label + ' ' + randomUUID().replace(/-/g, '').replace(/[0-9]/g, digit => 'ghijklmnop'[digit]);
const lineOf = (lines, signature) => lines.filter(line => line.startsWith('function:' + signature.split('(')[0] + '('));
const replaceIds = (value, ids) => { let text = JSON.stringify(value); for (const [name, id] of Object.entries(ids)) text = text.split(id).join('<' + name + '>'); return JSON.parse(text); };
/** A stored row without what legitimately differs between two commands (ids, timestamps, the Agreement-bound hash): the rest must be identical. */
const comparable = (row, ids) => replaceIds(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'id' && !key.endsWith('_at') && key !== 'input_hash')), ids);
const eventRows = id => rows(`select * from public.user_activity_events where entity_id = ${q(id)} and event_type = 'REVIEW_RECEIVED' order by id`);
const auditRows = id => rows(`select * from private.marketplace_audit_log where entity_id = ${q(id)} and event_type like 'AGREEMENT_REVIEW%' order by id`);

await check('P3_LEGACY_REVIEW_FUNCTIONS_ARE_BYTE_IDENTICAL_WITH_UNCHANGED_METADATA_AND_ACL_AND_NO_SECOND_OVERLOAD_EXISTS', async () => {
  assert.equal(sql("select count(*) || ':' || md5(coalesce(string_agg(id::text || ':' || input_hash, ',' order by id), '')) from private.agreement_reviews"), state.starBaseline, 'THE_APPLICATION_DID_NOT_TOUCH_ONE_STORED_STAR_ROW');
  const now = legacyBodies();
  assert.deepEqual(now, state.legacyBodiesBefore, 'EVERY_LEGACY_BODY_IS_BYTE_IDENTICAL_BEFORE_AND_AFTER');
  const pinned = {};
  for (const row of pinRows) if (now[row.signature] !== undefined) pinned[row.signature] = {devPin: row.bodyMd5, chain: now[row.signature], equalsTheDevPin: row.bodyMd5 === now[row.signature]};
  report.phases.parity.legacyBodies = pinned;
  for (const signature of Object.keys(now)) assert.deepEqual(lineOf(state.surfaceAfter, signature), lineOf(state.surfaceBefore, signature), 'SURFACE_LINE_UNCHANGED (body, security, config, ACL) ' + signature);
  for (const name of ['rpc_submit_agreement_review', 'rpc_get_my_agreement_review']) assert.equal(sql(`select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = ${q(name)}`), '1', 'NO_SECOND_OVERLOAD ' + name);
  assert.equal(canExecute('authenticated', lib.SIG.legacySubmit), true); assert.equal(canExecute('anon', lib.SIG.legacySubmit), false); assert.equal(canExecute('service_role', lib.SIG.legacySubmit), false);
  const star = rows("select (select string_agg(attname::text || ':' || format_type(atttypid, atttypmod), ',' order by attnum) from pg_attribute where attrelid = 'private.agreement_reviews'::regclass and attnum > 0 and not attisdropped) columns, (select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid = 'private.agreement_reviews'::regclass and not tgisinternal) triggers, (select count(*) from pg_policy where polrelid = 'private.agreement_reviews'::regclass) policies")[0];
  assert.equal(star.triggers, 'pre_v3_closure_review,pre_v3_review_immutable'); assert.equal(star.policies, 0); assert.ok(!/comment/.test(star.columns), 'THE_STAR_TABLE_HAS_STILL_NO_TEXT_COLUMN');
  report.phases.parity.starTable = star;
}, {needs: ['applied']});

P.o = null;
await check('P3_THE_EXACT_FIVE_ARGUMENT_CALL_AND_THE_REAL_SHIPPED_CLIENT_STILL_WORK_STAR_ONLY_WITH_THE_SAME_SHAPE_AND_NEVER_CARRY_A_COMMENT', async () => {
  P.o = await person('outsider', {name: 'D12 Stranac'});
  const s1 = seedAgreement(P.rq, P.wk, {title: 'five-argument call'}), key = randomUUID();
  const raw = {p_agreement_id: s1.id, p_target_account_id: P.wk.id, p_rating: 5, p_tags: ['RELIABLE', 'ON_TIME'], p_client_request_id: key};
  assert.deepEqual(Object.keys(raw).sort(), ['p_agreement_id', 'p_client_request_id', 'p_rating', 'p_tags', 'p_target_account_id'], 'EXACTLY_THE_FIVE_KEYS_OF_EVERY_INSTALLED_BUILD');
  const receipt = mustOk(await submitLegacy(P.rq, raw), 'five-argument submit after the application');
  assert.deepEqual(Object.keys(receipt).sort(), state.legacyBefore.receiptKeys, 'THE_RECEIPT_SHAPE_IS_UNCHANGED'); assert.ok(!('comment' in receipt));
  assert.deepEqual(written(s1.id), {stars: 1, comments: 0, events: 1, audits: 1}); assert.equal(starFormula(starRows(s1.id)[0]), starRows(s1.id)[0].input_hash, 'THE_STAR_HASH_FORMULA_IS_THE_LEGACY_ONE');
  const context = mustOk(await contextLegacy(P.rq, s1.id), 'legacy context'); assert.deepEqual(Object.keys(context).sort(), state.legacyBefore.contextKeys); assert.ok(!('commentPolicy' in context)); assert.deepEqual(Object.keys(context.review).sort(), state.legacyBefore.reviewKeys);
  const replay = mustOk(await submitLegacy(P.rq, raw), 'legacy replay'); assert.equal(replay.idempotentReplay, true); assert.equal(replay.reviewId, receipt.reviewId);
  // no installed client can carry text: the legacy function has no p_comment, PostgREST cannot resolve it, nothing is written
  const attempt = await submitLegacy(P.wk, {...reviewArgs(s1, P.wk), p_comment: 'x'}); assert.equal(attempt.error?.code, 'PGRST202'); assert.deepEqual(written(s1.id), {stars: 1, comments: 0, events: 1, audits: 1});
  // the legacy refusals keep their names; none of them is a D12 name
  for (const [label, args] of [['rating', reviewArgs(s1, P.wk, {rating: 0})], ['tags', reviewArgs(s1, P.wk, {tags: ['NOPE']})], ['duplicate', reviewArgs(s1, P.rq)]]) {
    const refusal = await submitLegacy(label === 'duplicate' ? P.rq : P.wk, args); assert.ok(refusal.error); assert.ok(!/^REVIEW_COMMENT_/.test(refusal.error.message), 'NO_NEW_ERROR_NAME_ON_THE_LEGACY_PATH ' + label);
  }
  // the REAL shipped client (exact git bytes): the worker reviews the requester on the real Dogovor A1, replays, reads the reputation (when the client can be driven on this chain; otherwise the raw call does the same)
  const input = {agreementId: P.a1.id, targetAccountId: P.rq.id, rating: 4, tags: ['CAREFUL'], clientRequestId: randomUUID()};
  if (state.legacyClientBefore) {
    const client = legacyClient(P.wk), service_ = client.module.reviewsClientService;
    const viaClient = await accepted(service_.submit(input)); assert.equal(viaClient.idempotentReplay, false); assert.ok(!('comment' in plain(viaClient)));
    const replayed = await accepted(service_.submit(input)); assert.equal(replayed.idempotentReplay, true); assert.equal(replayed.reviewId, viaClient.reviewId);
    const context2 = await accepted(service_.context(P.a1.id)); assert.deepEqual(Object.keys(plain(context2)).sort(), state.legacyClientBefore.contextKeys, 'THE_REAL_CLIENT_DECODES_THE_SAME_SHAPE_AFTER'); assert.equal(context2.review.reviewId, viaClient.reviewId);
    const reputation = await accepted(service_.reputation(P.rq.id)); assert.equal(reputation.reviewCount, 1);
    report.phases.parity.fiveArgument = {receiptKeys: Object.keys(receipt).sort(), clientSourceHashes: client.loader.sourceHashes};
  } else {
    const viaRaw = mustOk(await submitLegacy(P.wk, {p_agreement_id: input.agreementId, p_target_account_id: input.targetAccountId, p_rating: input.rating, p_tags: input.tags, p_client_request_id: input.clientRequestId}), 'raw legacy review of A1'); assert.equal(viaRaw.idempotentReplay, false);
    report.phases.parity.fiveArgument = {receiptKeys: Object.keys(receipt).sort(), clientSourceHashes: null};
  }
  assert.deepEqual(written(P.a1.id), {stars: 1, comments: 0, events: 1, audits: 1});
}, {needs: ['applied', 'legacyBefore']});

await check('P3_REPLAY_INTEROPERATES_BOTH_WAYS_AND_A_STAR_ONLY_REVIEW_NEVER_GAINS_A_COMMENT_LATER', async () => {
  // (1) the star-only review written BEFORE the application (A0, by the legacy function): the seven DEV reviews are this case
  const k0 = state.legacyBefore.key, text = canaryText('late');
  const same = mustOk(await submitV2(P.rq, reviewArgs(P.a0, P.rq, {rating: 5, tags: ['ON_TIME', 'RELIABLE'], key: k0})), 'v2 star-only replay of a legacy review');
  assert.equal(same.idempotentReplay, true); assert.equal(same.reviewId, state.legacyBefore.reviewId); assert.equal(same.comment, null);
  const before = written(P.a0.id);
  mustRefuse(await submitV2(P.rq, reviewArgs(P.a0, P.rq, {rating: 5, tags: ['ON_TIME', 'RELIABLE'], key: k0, comment: text})), 'REQUEST_ID_REUSED', '22023', 'SAME_KEY_PLUS_A_COMMENT_ON_A_STAR_ONLY_REVIEW');
  mustRefuse(await submitV2(P.rq, reviewArgs(P.a0, P.rq, {rating: 5, tags: ['ON_TIME', 'RELIABLE'], comment: text})), 'REVIEW_ALREADY_SUBMITTED', '55000', 'NEW_KEY_PLUS_A_COMMENT_ON_A_STAR_ONLY_REVIEW');
  mustRefuse(await submitV2(P.rq, reviewArgs(P.a0, P.rq, {rating: 5, tags: ['ON_TIME', 'RELIABLE']})), 'REVIEW_ALREADY_SUBMITTED', '55000', 'NEW_KEY_STAR_ONLY_ON_A_REVIEWED_SIDE');
  mustRefuse(await submitV2(P.rq, reviewArgs(P.a0, P.rq, {rating: 4, tags: ['ON_TIME', 'RELIABLE'], key: k0})), 'REQUEST_ID_REUSED', '22023', 'SAME_KEY_OTHER_STARS');
  assert.deepEqual(written(P.a0.id), before, 'NOTHING_WAS_WRITTEN_BY_ANY_REFUSAL'); assert.equal(commentRows(P.a0.id).length, 0, 'THE_STAR_ONLY_REVIEW_HAS_NO_COMMENT');
  // (2) a comment through v2 on the real Dogovor A1 (the requester side), then the SAME key through the LEGACY function and again through v2
  const key = randomUUID(), comment = canaryText('replay'), args = reviewArgs(P.a1, P.rq, {rating: 5, tags: ['RELIABLE'], key, comment});
  const first = mustOk(await submitV2(P.rq, args), 'v2 submit with a comment'); assert.equal(first.idempotentReplay, false); assert.equal(first.comment, comment);
  assert.deepEqual(written(P.a1.id), {stars: 2, comments: 1, events: 2, audits: 2});
  // round-1 finding (no-leak evidence): the exact-hit scan of the WHOLE database right after the first v2 comment: the text is in the comment table and in no other table (events, deliveries, push attempts, audit, receipts, request logs)
  assertOnlyInTheCommentTable(comment, 'after the first v2 comment');
  const viaLegacy = mustOk(await submitLegacy(P.rq, {p_agreement_id: P.a1.id, p_target_account_id: P.wk.id, p_rating: 5, p_tags: ['RELIABLE'], p_client_request_id: key}), 'legacy replay of a v2 review');
  assert.equal(viaLegacy.idempotentReplay, true); assert.equal(viaLegacy.reviewId, first.reviewId); assert.ok(!('comment' in viaLegacy), 'THE_LEGACY_RECEIPT_NEVER_CARRIES_THE_COMMENT'); assert.ok(!JSON.stringify(viaLegacy).includes(comment));
  const again = mustOk(await submitV2(P.rq, args), 'v2 replay'); assert.equal(again.idempotentReplay, true); assert.equal(again.comment, comment); assert.equal(again.reviewId, first.reviewId);
  mustRefuse(await submitV2(P.rq, {...args, p_comment: canaryText('other')}), 'REQUEST_ID_REUSED', '22023', 'SAME_KEY_OTHER_COMMENT');
  const dropped = {...args}; delete dropped.p_comment; mustRefuse(await submitV2(P.rq, dropped), 'REQUEST_ID_REUSED', '22023', 'SAME_KEY_THE_COMMENT_CANNOT_BE_DROPPED_SILENTLY');
  mustRefuse(await submitV2(P.rq, {...args, p_client_request_id: randomUUID()}), 'REVIEW_ALREADY_SUBMITTED', '55000', 'NEW_KEY_ON_A_REVIEWED_SIDE');
  assert.deepEqual(written(P.a1.id), {stars: 2, comments: 1, events: 2, audits: 2}, 'ONE_STAR_ROW_ONE_COMMENT_ROW_ONE_EVENT_PER_REVIEW');
  const stored = commentRows(P.a1.id); assert.equal(stored.length, 1); assert.equal(stored[0].comment, comment); assert.equal(stored[0].comment_sha256, lib.sha256Hex(comment)); assert.equal(stored[0].review_id, first.reviewId);
  assert.equal(stored[0].author_account_id, P.rq.id); assert.equal(stored[0].target_account_id, P.wk.id); assert.equal(stored[0].hidden_at, null);
  const star = starRows(P.a1.id).find(row => row.reviewer_account_id === P.rq.id); assert.equal(starFormula(star), star.input_hash, 'THE_STAR_HASH_IS_THE_LEGACY_FORMULA_FOR_A_V2_REVIEW_TOO');
  state.a1Comment = {text: comment, reviewId: first.reviewId, key};
}, {needs: ['applied', 'legacyBefore']});

await check('P3_V2_WITHOUT_A_COMMENT_IS_THE_LEGACY_COMMAND_STAR_ROW_AUDIT_ROW_EVENT_AND_ERROR_OUTCOMES_ARE_IDENTICAL', async () => {
  const legacySide = seedAgreement(P.rq, P.wk, {title: 'parity legacy'}), v2Side = seedAgreement(P.rq, P.wk, {title: 'parity v2'});
  const args = agreement => reviewArgs(agreement, P.rq, {rating: 4, tags: ['ON_TIME', 'RELIABLE']});
  const legacy = mustOk(await submitLegacy(P.rq, args(legacySide)), 'legacy'), v2 = mustOk(await submitV2(P.rq, args(v2Side)), 'v2');
  const idsOf = (agreement, receipt) => ({AGREEMENT: agreement.id, REVIEW: receipt.reviewId, REVIEWER: P.rq.id, TARGET: P.wk.id});
  const shape = (receipt, ids) => { const {comment, ...rest} = receipt; return {rest: replaceIds(Object.fromEntries(Object.entries(rest).filter(([key]) => key !== 'createdAt' && key !== 'clientRequestId')), ids), comment}; };
  const a = shape(legacy, idsOf(legacySide, legacy)), b = shape(v2, idsOf(v2Side, v2));
  assert.deepEqual(a.rest, b.rest, 'THE_RECEIPT_IS_THE_LEGACY_RECEIPT_PLUS_THE_COMMENT_KEY'); assert.equal(a.comment, undefined); assert.equal(b.comment, null);
  const starA = comparable(starRows(legacySide.id)[0], {...idsOf(legacySide, legacy), CLIENT: legacy.clientRequestId}), starB = comparable(starRows(v2Side.id)[0], {...idsOf(v2Side, v2), CLIENT: v2.clientRequestId});
  assert.deepEqual(starA, starB, 'THE_STORED_STAR_ROW_IS_IDENTICAL'); assert.equal(starFormula(starRows(legacySide.id)[0]), starRows(legacySide.id)[0].input_hash); assert.equal(starFormula(starRows(v2Side.id)[0]), starRows(v2Side.id)[0].input_hash);
  const eventA = eventRows(legacySide.id), eventB = eventRows(v2Side.id); assert.equal(eventA.length, 1); assert.equal(eventB.length, 1);
  assert.deepEqual(comparable(eventA[0], idsOf(legacySide, legacy)), comparable(eventB[0], idsOf(v2Side, v2)), 'THE_REVIEW_RECEIVED_EVENT_IS_IDENTICAL_NO_TEXT_NO_RATING'); assert.deepEqual(eventB[0].payload, {});
  const auditA = auditRows(legacySide.id), auditB = auditRows(v2Side.id); assert.equal(auditA.length, 1); assert.equal(auditB.length, 1);
  assert.deepEqual(comparable(auditA[0], idsOf(legacySide, legacy)), comparable(auditB[0], idsOf(v2Side, v2)), 'THE_AUDIT_ROW_IS_IDENTICAL'); assert.deepEqual(Object.keys(auditB[0].detail), ['reviewId']);
  assert.equal(written(v2Side.id).comments, 0);
  // the refusals: identical message, SQLSTATE and HTTP status (a stateless refusal is asked of the same Dogovor twice; a stateful one of two equivalent Dogovori)
  const notDone = seedAgreement(P.rq, P.wk, {exec: 'CONFIRMED', need: 'ACTIVE', title: 'parity not completed'}), done = seedAgreement(P.rq, P.wk, {title: 'parity stateless'});
  const base = reviewArgs(done, P.rq), tagsOf = list => ({...base, p_tags: list}), ratingOf = value => ({...base, p_rating: value});
  const cases = [['NOT_COMPLETED', P.rq, reviewArgs(notDone, P.rq)], ['OUTSIDER_TARGETING_THE_REQUESTER', P.o, {...base, p_target_account_id: P.rq.id}], ['WRONG_TARGET', P.rq, {...base, p_target_account_id: P.o.id}],
    ['SELF_TARGET', P.rq, {...base, p_target_account_id: P.rq.id}], ['NO_SUCH_AGREEMENT', P.rq, {...base, p_agreement_id: randomUUID()}], ['RATING_ZERO', P.rq, ratingOf(0)], ['RATING_SIX', P.rq, ratingOf(6)],
    ['RATING_FRACTION', P.rq, ratingOf(1.5)], ['RATING_TEXT', P.rq, ratingOf('4')], ['RATING_NULL', P.rq, ratingOf(null)], ['TAGS_NOT_AN_ARRAY', P.rq, tagsOf('RELIABLE')], ['TAGS_UNKNOWN', P.rq, tagsOf(['NOPE'])],
    ['TAGS_FOUR', P.rq, tagsOf(['AS_AGREED', 'CAREFUL', 'ON_TIME', 'RELIABLE'])], ['TAGS_DUPLICATE', P.rq, tagsOf(['RELIABLE', 'RELIABLE'])], ['TAGS_NUMBER', P.rq, tagsOf([3])]];
  report.phases.parity.refusalPairs = [];
  for (const [name, actor, input] of cases) {
    const l = await submitLegacy(actor, input), n = await submitV2(actor, input);
    assert.ok(l.error, 'LEGACY_REFUSES ' + name); assert.ok(lib.sameOutcome(l, n), `IDENTICAL_OUTCOME ${name}: legacy ${JSON.stringify(lib.outcomeOf(l))} v2 ${JSON.stringify(lib.outcomeOf(n))}`);
    report.phases.parity.refusalPairs.push({name, ...lib.outcomeOf(l)});
  }
  assert.deepEqual(written(notDone.id), {stars: 0, comments: 0, events: 0, audits: 0}); assert.deepEqual(written(done.id), {stars: 0, comments: 0, events: 0, audits: 0}, 'NOTHING_WRITTEN_BY_ANY_REFUSAL');
  // anonymous, and the stateful pairs (duplicate, request reuse)
  const anonL = await call(anon, 'rpc_submit_agreement_review', base), anonN = await call(anon, 'rpc_submit_agreement_review_v2', base); assert.ok(anonL.error && lib.sameOutcome(anonL, anonN), 'ANON_IDENTICAL ' + JSON.stringify([lib.outcomeOf(anonL), lib.outcomeOf(anonN)]));
  const dupL = seedAgreement(P.rq, P.wk, {title: 'dup legacy'}), dupN = seedAgreement(P.rq, P.wk, {title: 'dup v2'});
  mustOk(await submitLegacy(P.rq, reviewArgs(dupL, P.rq)), 'dup legacy first'); mustOk(await submitV2(P.rq, reviewArgs(dupN, P.rq)), 'dup v2 first');
  const d1 = await submitLegacy(P.rq, reviewArgs(dupL, P.rq)), d2 = await submitV2(P.rq, reviewArgs(dupN, P.rq)); assert.ok(d1.error && lib.sameOutcome(d1, d2), 'DUPLICATE_IDENTICAL'); mustRefuse(d2, 'REVIEW_ALREADY_SUBMITTED', '55000', 'DUPLICATE_NAME');
  const reuseKeyL = randomUUID(), reuseKeyN = randomUUID(), reuseL = seedAgreement(P.rq, P.wk, {title: 'reuse legacy'}), reuseN = seedAgreement(P.rq, P.wk, {title: 'reuse v2'});
  mustOk(await submitLegacy(P.rq, reviewArgs(reuseL, P.rq, {key: reuseKeyL})), 'reuse legacy first'); mustOk(await submitV2(P.rq, reviewArgs(reuseN, P.rq, {key: reuseKeyN})), 'reuse v2 first');
  const r1 = await submitLegacy(P.rq, reviewArgs(reuseL, P.rq, {key: reuseKeyL, rating: 2})), r2 = await submitV2(P.rq, reviewArgs(reuseN, P.rq, {key: reuseKeyN, rating: 2}));
  assert.ok(r1.error && lib.sameOutcome(r1, r2), 'REUSE_IDENTICAL'); mustRefuse(r2, 'REQUEST_ID_REUSED', '22023', 'REUSE_NAME');
  // a closure-restricted reviewer is fenced by the platform on BOTH paths with the same answer (the pre-request guard is path-based: a new function needs no edit)
  P.rs = await person('restricted'); const restrictedAgreement = seedAgreement(P.rs, P.wk, {title: 'restricted reviewer'}); restrictAccount(P.rs);
  try {
    const rl = await submitLegacy(P.rs, reviewArgs(restrictedAgreement, P.rs)), rn = await submitV2(P.rs, reviewArgs(restrictedAgreement, P.rs, {comment: canaryText('restricted')}));
    mustRefuse(rl, 'ACCOUNT_CLOSING', '42501', 'LEGACY_RESTRICTED'); mustRefuse(rn, 'ACCOUNT_CLOSING', '42501', 'V2_RESTRICTED'); assert.ok(lib.sameOutcome(rl, rn));
    for (const [name, response] of [['context', await contextV2(P.rs, restrictedAgreement.id)], ['reader', await readerPage(P.rs, P.wk.profile.WORKER)]]) mustRefuse(response, 'ACCOUNT_CLOSING', '42501', 'NEW_FUNCTIONS_ARE_FENCED_TOO ' + name);
  } finally { unrestrictAccount(P.rs); }
  assert.deepEqual(written(restrictedAgreement.id), {stars: 0, comments: 0, events: 0, audits: 0});
}, {needs: ['applied', 'legacyBefore']});

await check('P3_AN_OLD_CLIENT_NEVER_SEES_A_COMMENT_NOT_IN_ITS_OWN_RECEIPT_NOT_IN_THE_AGGREGATE_NOT_IN_THE_PUBLIC_PROFILE_AND_THE_REAL_CLIENT_STILL_DECODES', async () => {
  const {text} = state.a1Comment;
  // the author's legacy context: the star review, no comment key, no policy key, and the text nowhere
  const own = mustOk(await contextLegacy(P.rq, P.a1.id), 'legacy context of the author'); assert.ok(!('comment' in own.review)); assert.ok(!('commentPolicy' in own)); assert.ok(!JSON.stringify(own).includes(text));
  assert.deepEqual(Object.keys(own.review).sort(), state.legacyBefore.reviewKeys);
  // the reviewed person: their own legacy context, their reputation and public profile carry no text
  const target = mustOk(await contextLegacy(P.wk, P.a1.id), 'legacy context of the target'); assert.ok(!JSON.stringify(target).includes(text));
  const reputation = await reputationOf(P.wk, P.wk.id); assert.ok(!JSON.stringify(reputation).includes(text)); assert.deepEqual(Object.keys(reputation).sort(), state.legacyBefore.reputationKeys);
  const profile = mustOk(await publicProfile(P.rq, P.wk.profile.WORKER), 'public profile'); assert.ok(!JSON.stringify(profile).includes(text)); assert.deepEqual(Object.keys(profile.trust).sort(), state.legacyBefore.trustKeys);
  assert.equal(profile.trust.reviewCount, reputation.reviewCount, 'THE_COUNT_COUNTS_STARS_NEVER_COMMENTS');
  const starsAbout = Number(sql(`select count(*) from private.agreement_reviews where target_account_id = ${q(P.wk.id)}`)); assert.equal(reputation.reviewCount, starsAbout);
  if (state.legacyClientBefore) {
    const viaClient = legacyClient(P.rq), context = await accepted(viaClient.module.reviewsClientService.context(P.a1.id)); assert.equal(context.review.reviewId, state.a1Comment.reviewId); assert.ok(!JSON.stringify(plain(context)).includes(text));
    assert.deepEqual(Object.keys(plain(context)).sort(), state.legacyClientBefore.contextKeys); assert.deepEqual(Object.keys(plain(context.review)).sort(), state.legacyClientBefore.reviewKeys);
  }
  assert.equal(sql(`select count(*) from public.user_activity_events where payload::text like ${q('%' + text + '%')} or dedupe_key like ${q('%' + text + '%')}`), '0', 'NO_EVENT_CARRIES_THE_TEXT');
  assert.equal(sql(`select count(*) from private.marketplace_audit_log where detail::text like ${q('%' + text + '%')}`), '0', 'NO_AUDIT_ROW_CARRIES_THE_TEXT');
}, {needs: ['a1Comment']});

// ==================================================================================================================================================================
// P4 VALIDATION MATRIX: the SQL function, the table CHECKs as a second wall, and the real PostgREST path (exact name + SQLSTATE + HTTP status, nothing written)
// ==================================================================================================================================================================
const MATRIX = lib.buildMatrix();
function runMatrix(cases) {
  const payload = cases.map((item, ord) => ({id: item.id, ord, sql_null: item.sqlNull === true, json: lib.caseJson(item.value)}));
  const script = `create function pg_temp.d12_try(p jsonb) returns jsonb language plpgsql as $f$
declare v text;
begin
  v := private.review_comment_input_v1(p);
  return jsonb_build_object('outcome', case when v is null then 'ABSENT' else 'ACCEPTED' end, 'value', v);
exception when others then
  return jsonb_build_object('outcome', 'REFUSED', 'sqlstate', sqlstate, 'message', sqlerrm);
end $f$;
select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'result', pg_temp.d12_try(case when c.sql_null then null else c.json::jsonb end)) order by c.ord), '[]'::jsonb)
from jsonb_to_recordset(${q(JSON.stringify(payload))}::jsonb) as c(id text, ord integer, sql_null boolean, json text);`;
  return JSON.parse(must(script, 'validation matrix', {timeoutMs: 120000}));
}
const observedOf = result => result.outcome === 'REFUSED' ? {outcome: 'REFUSED', name: result.message, sqlstate: result.sqlstate} : result.outcome === 'ACCEPTED' ? {outcome: 'ACCEPTED', value: result.value} : {outcome: 'ABSENT'};

await check('P4_THE_VALIDATION_MATRIX_THROUGH_THE_SQL_FUNCTION_EQUALS_THE_INTENDED_RULES_AND_THE_JS_MIRROR_AND_THE_KNOWN_RESIDUALS_ARE_PINNED', async () => {
  const ids = MATRIX.map(item => item.id); assert.equal(new Set(ids).size, ids.length, 'MATRIX_IDS_UNIQUE');
  const results = runMatrix(MATRIX), byId = new Map(results.map(item => [item.id, observedOf(item.result)]));
  assert.equal(results.length, MATRIX.length);
  const groups = {}, mismatches = [];
  for (const item of MATRIX) {
    const observed = byId.get(item.id), group = groups[item.group] ??= {total: 0, ABSENT: 0, ACCEPTED: 0, REFUSED: 0};
    group.total += 1; group[observed.outcome] += 1;
    if (!lib.outcomeMatches(observed, item.expect)) mismatches.push({id: item.id, expected: item.expect, observed});
    const mirror = lib.classifyComment(item.value);
    if (!lib.outcomeMatches(observed, mirror)) mismatches.push({id: item.id, mirror, observed, kind: 'THE_JS_MIRROR_DISAGREES_WITH_THE_SQL'});
    if (observed.outcome === 'ACCEPTED') assert.equal(observed.value, item.value, 'ACCEPTED_TEXT_IS_RETURNED_VERBATIM_NEVER_NORMALISED ' + item.id);
    if (item.group === 'KNOWN_RESIDUAL') report.residuals.push({id: item.id, observed: observed.outcome === 'REFUSED' ? observed.name : observed.outcome, note: item.note});
  }
  assert.deepEqual(mismatches, [], 'MATRIX_MISMATCHES ' + JSON.stringify(mismatches).slice(0, 1200));
  // non-vacuous: every rule has cases on BOTH sides of it
  for (const group of ['ABSENT', 'TYPE', 'LENGTH', 'TRIM', 'CONTROL', 'BIDI_ZERO_WIDTH', 'INVISIBLE_FORBIDDEN', 'INVISIBLE_ALLOWED', 'ALLOWED', 'CONTACT', 'FORBIDDEN_RANGE_POINTS', 'FORBIDDEN_RANGE_NEIGHBOURS']) assert.ok(groups[group]?.total > 0, 'GROUP_HAS_CASES ' + group);
  // round-2 finding (security #1): every forbidden range is exercised at both ends and in the middle (inside text: always refused; alone: refused unless it is white space) and both neighbours of every range are exercised (accepted unless they belong to the table)
  assert.ok(groups.FORBIDDEN_RANGE_POINTS.REFUSED > 0 && groups.FORBIDDEN_RANGE_POINTS.ABSENT > 0 && groups.FORBIDDEN_RANGE_NEIGHBOURS.ACCEPTED > 0, 'THE_RANGE_GROUPS_HAVE_CASES_ON_BOTH_SIDES');
  assert.ok(groups.LENGTH.ACCEPTED > 0 && groups.LENGTH.REFUSED > 0 && groups.TRIM.ACCEPTED > 0 && groups.TRIM.REFUSED > 0 && groups.ABSENT.ABSENT === groups.ABSENT.total && groups.ALLOWED.ACCEPTED === groups.ALLOWED.total && groups.INVISIBLE_ALLOWED.ACCEPTED === groups.INVISIBLE_ALLOWED.total);
  assert.equal(groups.CONTROL.REFUSED, groups.CONTROL.total); assert.equal(groups.BIDI_ZERO_WIDTH.REFUSED, groups.BIDI_ZERO_WIDTH.total); assert.equal(groups.INVISIBLE_FORBIDDEN.REFUSED, groups.INVISIBLE_FORBIDDEN.total); assert.equal(groups.CONTACT.REFUSED, groups.CONTACT.total);
  // the bodies contain no SQLSTATE that PostgREST 14 retries without end, and every refusal name is a 22023 (or the immutability / moderation names below)
  for (const signature of lib.NEW_FUNCTIONS) assert.equal(sql(`select position('40001' in prosrc) from pg_proc where oid = to_regprocedure(${q(signature)})`), '0', 'NO_40001_ANYWHERE_IN ' + signature + ' (PostgREST 14 retries it without end; not even a comment mentions it: a plain-text scan finds none)');
  const names = new Set(results.filter(item => item.result.outcome === 'REFUSED').map(item => item.result.message + ':' + item.result.sqlstate));
  assert.deepEqual([...names].sort(), ['REVIEW_COMMENT_CONTACT_NOT_PUBLIC:22023', 'REVIEW_COMMENT_INVALID:22023', 'REVIEW_COMMENT_TOO_LONG:22023']);
  report.phases.validation = {cases: MATRIX.length, groups, lcCtype: state.chainFacts.lc_ctype, lcCollate: state.chainFacts.lc_collate,
    note: 'every outcome is locale independent: the blank class is an EXPLICIT list (ASCII white space U+0009..U+000D and U+0020, U+0085, the Unicode separators; never POSIX [[:space:]], which also matches U+001C..U+001F in en_US.UTF-8), and the closed invisible-character classes (every default-ignorable code point of Unicode 17.0 except four allowed-inside groups, plus the controls) are exercised on both sides: INVISIBLE_FORBIDDEN refused alone and inside text, FORBIDDEN_RANGE_POINTS at both ends and in the middle of every range, FORBIDDEN_RANGE_NEIGHBOURS on both sides, INVISIBLE_ALLOWED accepted inside text, ABSENT alone'};
  state.matrixResults = results;
}, {needs: ['applied']});

await check('P4_THE_TABLE_CHECKS_ARE_A_SECOND_WALL_WHEN_THE_FUNCTION_IS_BYPASSED_AS_THE_DATABASE_OWNER', async () => {
  const review = rows(`select id, reviewer_account_id, target_account_id from private.agreement_reviews where id = ${q(state.legacyBefore.reviewId)}`)[0]; assert.ok(review);
  const before = Number(sql('select count(*) from private.agreement_review_comments_v1'));
  const insert = (comment, o = {}) => `insert into private.agreement_review_comments_v1(review_id, author_account_id, target_account_id, comment, comment_sha256, hidden_at, hidden_reason_code)
    values (${q(o.review ?? review.id)}, ${q(o.author ?? review.reviewer_account_id)}, ${q(o.target ?? review.target_account_id)}, ${comment === null ? 'null' : q(comment)}, ${q(o.sha ?? 'a'.repeat(64))},
      ${o.hiddenAt ? 'clock_timestamp()' : 'null'}, ${o.reason === undefined ? 'null' : q(o.reason)});`;
  const control = psql('begin;\n' + insert('Odlican posao') + "\nselect count(*) from private.agreement_review_comments_v1 where review_id = " + q(review.id) + ';\nrollback;');
  assert.ok(control.ok && control.stdout.split(/\r?\n/).pop() === '1', 'POSITIVE_CONTROL_A_VALID_ROW_IS_ACCEPTED ' + (control.message ?? control.stdout));
  const astral = psql('begin;\n' + insert(String.fromCodePoint(0x1F600).repeat(500)) + '\nrollback;'); assert.ok(astral.ok, 'THE_OCTET_BOUND_NEVER_BINDS_500_ASTRAL_CHARACTERS_ARE_2000_OCTETS ' + astral.message);
  const unknown = randomUUID(), cases = [
    ['LENGTH_501', insert('a'.repeat(501)), 'check', constraintName('text_length_check')], ['LENGTH_EMPTY', insert(''), 'check', constraintName('text_length_check')],
    ['TRIM_LEADING_SPACE', insert(' a'), 'check', constraintName('text_trim_check')], ['TRIM_TRAILING_SPACE', insert('a '), 'check', constraintName('text_trim_check')], ['TRIM_LEADING_LF', insert('\na'), 'check', constraintName('text_trim_check')],
    ['CHARS_TAB', insert('a\tb'), 'check', constraintName('text_chars_check')], ['CHARS_CR', insert('a\rb'), 'check', constraintName('text_chars_check')], ['CHARS_RLO', insert('a\u202Eb'), 'check', constraintName('text_chars_check')],
    ['CHARS_ZWSP', insert('a\u200Bb'), 'check', constraintName('text_chars_check')], ['CHARS_NEL', insert('a\u0085b'), 'check', constraintName('text_chars_check')],
    ['SHA_SHORT', insert('ok', {sha: 'XYZ'}), 'check', constraintName('sha_check')], ['SHA_UPPER_CASE', insert('ok', {sha: 'A'.repeat(64)}), 'check', constraintName('sha_check')],
    ['HIDDEN_WITHOUT_REASON', insert('ok', {hiddenAt: true}), 'check', constraintName('hidden_check')], ['REASON_WITHOUT_HIDDEN', insert('ok', {reason: 'ABUSE'}), 'check', constraintName('hidden_check')],
    ['REASON_LOWER_CASE', insert('ok', {hiddenAt: true, reason: 'abuse'}), 'check', constraintName('hidden_check')], ['REASON_TOO_LONG', insert('ok', {hiddenAt: true, reason: 'A'.repeat(65)}), 'check', constraintName('hidden_check')],
    ['AUTHOR_IS_THE_TARGET', insert('ok', {author: review.target_account_id}), 'check', constraintName('parties_check')],
    ['NO_SUCH_REVIEW', insert('ok', {review: unknown}), 'foreign key', constraintName('review_fkey')], ['NO_SUCH_AUTHOR', insert('ok', {author: randomUUID()}), 'foreign key', constraintName('author_fkey')],
    ['NO_SUCH_TARGET', insert('ok', {target: randomUUID()}), 'foreign key', constraintName('target_fkey')], ['NULL_COMMENT', insert(null), 'not-null', 'comment'],
  ];
  report.phases.validation.tableChecks = [];
  for (const [name, statement, kind, constraint] of cases) {
    const result = psql('begin;\n' + statement + '\nrollback;'); assert.equal(result.ok, false, 'EXPECTED_CONSTRAINT_VIOLATION ' + name);
    const sqlstate = kind === 'check' ? '23514' : kind === 'foreign key' ? '23503' : '23502'; assert.equal(result.sqlstate, sqlstate, 'SQLSTATE ' + name + ': ' + result.message);
    assert.ok(String(result.message).includes('"' + constraint + '"') || String(result.message).includes(constraint), `THE_NAMED_CONSTRAINT_REFUSES ${name}: ${result.message}`);
    report.phases.validation.tableChecks.push({name, sqlstate: result.sqlstate, constraint});
  }
  const dup = psql('begin;\n' + insert('ok') + '\n' + insert('ok again') + '\nrollback;'); assert.equal(dup.sqlstate, '23505'); assert.ok(String(dup.message).includes(constraintName('pkey')), 'ONE_COMMENT_PER_REVIEW_IS_THE_PRIMARY_KEY');
  assert.equal(Number(sql('select count(*) from private.agreement_review_comments_v1')), before, 'NO_ROW_SURVIVED_THE_PROBES');
}, {needs: ['applied', 'legacyBefore']});
function constraintName(suffix) { return lib.TABLE_NAME + '_' + suffix; }

await check('P4_THE_TABLE_CHECKS_AGREE_WITH_THE_FUNCTION_ON_THE_WHOLE_MATRIX_SO_THE_CHECK_VIOLATION_DETAIL_THAT_QUOTES_THE_ROW_IS_UNREACHABLE_THROUGH_THE_FUNCTION', async () => {
  // Round-1 finding (log-leak channel): a CHECK violation prints "Failing row contains (..., <the text>, ...)" in its DETAIL and in the Postgres log. It is reachable only if the function and the table CHECKs DIVERGE. So the WHOLE matrix
  // (not a curated list) is inserted directly as the database owner, each in a nested block that is always rolled back, and the two walls must AGREE: a text the function ACCEPTS must pass the CHECKs, a text the function refuses as
  // INVALID or TOO_LONG must violate a CHECK. (ABSENT stores nothing and the contact floor is a function-only rule: neither has a CHECK.)
  const review = rows(`select id from private.agreement_reviews where id = ${q(state.legacyBefore.reviewId)}`)[0]; assert.ok(review);
  const cases = MATRIX.filter(item => typeof item.value === 'string').map((item, ord) => ({id: item.id, ord, json: lib.caseJson(item.value)}));
  const script = `create function pg_temp.d12_wall(p text) returns text language plpgsql as $f$
declare cname text;
begin
  begin
    insert into private.agreement_review_comments_v1(review_id, author_account_id, target_account_id, comment, comment_sha256)
      select r.id, r.reviewer_account_id, r.target_account_id, p, repeat('a', 64) from private.agreement_reviews r where r.id = ${q(review.id)};
    raise exception 'D12_WALL_ACCEPTED' using errcode = 'P0001';
  exception
    when check_violation then get stacked diagnostics cname = constraint_name; return 'CHECK:' || coalesce(cname, '?');
    when sqlstate 'P0001' then if sqlerrm = 'D12_WALL_ACCEPTED' then return 'ACCEPTED'; end if; raise;
  end;
end $f$;
select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'wall', pg_temp.d12_wall((c.json::jsonb) #>> '{}')) order by c.ord), '[]'::jsonb)
from jsonb_to_recordset(${q(JSON.stringify(cases))}::jsonb) as c(id text, ord integer, json text);`;
  const wall = new Map(JSON.parse(must(script, 'second wall parity', {timeoutMs: 120000})).map(item => [item.id, item.wall]));
  const functionOutcome = new Map(state.matrixResults.map(item => [item.id, observedOf(item.result)]));
  const disagreements = [], summary = {functionAcceptedWallAccepted: 0, functionRefusedWallViolated: 0, notCompared: 0};
  for (const item of MATRIX) {
    if (typeof item.value !== 'string') continue;
    const observed = functionOutcome.get(item.id), walled = wall.get(item.id);
    assert.ok(walled !== undefined, 'THE_WALL_ANSWERED ' + item.id);
    if (observed.outcome === 'ACCEPTED') { if (walled === 'ACCEPTED') summary.functionAcceptedWallAccepted += 1; else disagreements.push({id: item.id, function: 'ACCEPTED', wall: walled}); }
    else if (observed.outcome === 'REFUSED' && ['REVIEW_COMMENT_INVALID', 'REVIEW_COMMENT_TOO_LONG'].includes(observed.name)) { if (walled.startsWith('CHECK:')) summary.functionRefusedWallViolated += 1; else disagreements.push({id: item.id, function: observed.name, wall: walled}); }
    else summary.notCompared += 1;
  }
  assert.deepEqual(disagreements, [], 'THE_FUNCTION_AND_THE_TABLE_CHECKS_DISAGREE ' + JSON.stringify(disagreements).slice(0, 1200));
  assert.ok(summary.functionAcceptedWallAccepted >= 80 && summary.functionRefusedWallViolated >= 220, 'BOTH_SIDES_OF_THE_PARITY_ARE_EXERCISED (the matrix has 83 accepted and 227 refused string cases) ' + JSON.stringify(summary));
  assert.equal(Number(sql('select count(*) from private.agreement_review_comments_v1 where review_id = ' + q(review.id))), 0, 'EVERY_WALL_PROBE_WAS_ROLLED_BACK');
  report.phases.validation.secondWallParity = summary;
  report.notVerified.push('The Postgres SERVER LOG was not scanned for comment text: a malformed JSON string (a NUL or a lone surrogate) is rejected by PostgreSQL with a CONTEXT line that quotes a fragment of the JSON body, and a CHECK violation prints the failing row. The function/CHECK parity above makes the second unreachable through the function; the first is outside what a disposable database proves.');
}, {needs: ['applied', 'matrixResults', 'legacyBefore']});

await check('P4_REAL_POSTGREST_REFUSALS_ARE_EXACT_AND_WRITE_NOTHING_AND_ACCEPTED_COMMENTS_ARE_STORED_VERBATIM_AND_ABSENT_ONES_STORE_NOTHING', async () => {
  const ag = seedAgreement(P.rq, P.wk, {title: 'validation refusals'}), none = {stars: 0, comments: 0, events: 0, audits: 0}, refusals = [];
  const refuse = async (name, value, message) => {
    const response = await submitV2(P.rq, reviewArgs(ag, P.rq, {comment: value})); mustRefuse(response, message, '22023', name);
    assert.equal(response.status, 400, 'HTTP_400 ' + name); assert.deepEqual(written(ag.id), none, 'NOTHING_WRITTEN_BY ' + name); refusals.push({name, message, status: response.status});
  };
  await refuse('CONTROL_CHARACTER', 'a\tb', 'REVIEW_COMMENT_INVALID'); await refuse('LEADING_SPACE', ' a', 'REVIEW_COMMENT_INVALID'); await refuse('RIGHT_TO_LEFT_OVERRIDE', 'a\u202Eb', 'REVIEW_COMMENT_INVALID');
  await refuse('ZERO_WIDTH_SPACE', 'a\u200Bb', 'REVIEW_COMMENT_INVALID');
  // round-2 finding (security #1): the rest of the default-ignorable set through the real PostgREST path (an ideographic variation selector, the reserved U+2065, and a phone number split by the selector)
  await refuse('IDEOGRAPHIC_VARIATION_SELECTOR', 'a\u{E0100}b', 'REVIEW_COMMENT_INVALID'); await refuse('RESERVED_DEFAULT_IGNORABLE_U2065', 'a\u2065b', 'REVIEW_COMMENT_INVALID'); await refuse('PHONE_SPLIT_BY_AN_IDEOGRAPHIC_VARIATION_SELECTOR', 'zovi 064\u{E0100}1234567', 'REVIEW_COMMENT_INVALID');
  await refuse('A_LONE_CONTROL_THAT_IS_NOT_WHITE_SPACE', '\u001F', 'REVIEW_COMMENT_INVALID'); await refuse('NOT_A_STRING_NUMBER', 5, 'REVIEW_COMMENT_INVALID'); await refuse('NOT_A_STRING_OBJECT', {text: 'a'}, 'REVIEW_COMMENT_INVALID');
  await refuse('TOO_LONG_501', 'a'.repeat(501), 'REVIEW_COMMENT_TOO_LONG'); await refuse('TOO_LONG_ASTRAL_501', String.fromCodePoint(0x1F600).repeat(501), 'REVIEW_COMMENT_TOO_LONG');
  await refuse('PHONE', 'Zovi 064 123 4567', 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC'); await refuse('EMAIL', 'pisi ime@posta.rs', 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC');
  await refuse('LINK', 'vidi https://primer.rs', 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC'); await refuse('HANDLE', 'javi se @pera_m', 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC');
  report.phases.validation.postgrestRefusals = refusals;
  // the refusals consumed nothing: the SAME Dogovor still takes a valid command
  const good = canaryText('after refusals'), receipt = mustOk(await submitV2(P.rq, reviewArgs(ag, P.rq, {comment: good})), 'valid command after the refusals'); assert.equal(receipt.comment, good);
  assert.deepEqual(written(ag.id), {stars: 1, comments: 1, events: 1, audits: 1});
  // NUL and lone surrogates are not D12 names: JSON/jsonb stop them before the function runs (or the platform replaces a surrogate); recorded as observed
  const odd = [];
  for (const [name, value] of [['NUL', 'a\u0000b'], ['LONE_HIGH_SURROGATE', 'a\ud800b'], ['LONE_LOW_SURROGATE', 'a\udc00b']]) {
    const own = seedAgreement(P.rq, P.wk, {title: 'odd ' + name}), response = await submitV2(P.rq, reviewArgs(own, P.rq, {comment: value}));
    if (response.error) {
      assert.ok(response.status >= 400 && response.status < 500, 'CLIENT_ERROR_STATUS ' + name + ' ' + response.status); assert.ok(!/^REVIEW_COMMENT_/.test(response.error.message), 'NOT_A_D12_NAME ' + name);
      assert.deepEqual(written(own.id), none); odd.push({name, outcome: 'REFUSED_BEFORE_THE_FUNCTION', status: response.status, code: response.error.code});
    } else {
      assert.equal(name === 'NUL', false, 'A_NUL_CHARACTER_MUST_NEVER_BE_STORED'); const stored = commentRows(own.id);
      assert.equal(stored.length, 1); assert.ok(!/[\ud800-\udfff]/.test(stored[0].comment), 'NO_LONE_SURROGATE_IS_STORED'); odd.push({name, outcome: 'PLATFORM_REPLACED_THE_SURROGATE', stored: JSON.stringify(stored[0].comment)});
    }
  }
  report.phases.validation.oddCharacters = odd;
  // accepted comments are stored verbatim (no normalisation) and read back identically through the author's own context; the length is counted in code points
  const stored = [];
  for (const id of ['one_character', 'ascii_500', 'astral_500', 'mixed_astral_last_500', 'family_emoji_zwj', 'serbian_latin', 'devanagari_zwj', 'inner_lf', 'trailing_nbsp_is_not_trimmed', 'residual_obfuscated_email']) {
    const item = MATRIX.find(entry => entry.id === id), own = seedAgreement(P.rq, P.wk, {title: 'verbatim ' + id}), response = mustOk(await submitV2(P.rq, reviewArgs(own, P.rq, {comment: item.value})), 'accepted ' + id);
    assert.equal(response.comment, item.value, 'THE_RECEIPT_ECHOES_THE_TEXT_VERBATIM ' + id);
    const row = commentRows(own.id)[0]; assert.equal(row.comment, item.value, 'THE_STORED_TEXT_IS_VERBATIM ' + id); assert.equal(row.comment_sha256, lib.sha256Hex(item.value));
    assert.equal(Number(sql(`select char_length(comment) from private.agreement_review_comments_v1 where review_id = ${q(row.review_id)}`)), lib.codePoints(item.value)); assert.equal(Number(sql(`select octet_length(comment) from private.agreement_review_comments_v1 where review_id = ${q(row.review_id)}`)), lib.utf8Octets(item.value));
    const context = mustOk(await contextV2(P.rq, own.id), 'own context ' + id); assert.equal(context.review.comment, item.value); assert.deepEqual(written(own.id), {stars: 1, comments: 1, events: 1, audits: 1});
    stored.push({id, codePoints: lib.codePoints(item.value), octets: lib.utf8Octets(item.value)});
  }
  report.phases.validation.verbatim = stored;
  // an absent comment stores nothing and is no error (a client that typed nothing omits the key)
  for (const [name, value] of [['EMPTY_STRING', ''], ['WHITE_SPACE_ONLY', ' \n '], ['JSON_NULL', null], ['OMITTED', undefined], ['A_LONE_VARIATION_SELECTOR', '\uFE00'], ['ASCII_WHITE_SPACE_CONTROLS_ONLY', '\r\u000B\u000C']]) {
    const own = seedAgreement(P.rq, P.wk, {title: 'absent ' + name}), receipt = mustOk(await submitV2(P.rq, reviewArgs(own, P.rq, {comment: value})), 'absent comment ' + name);
    assert.equal(receipt.comment, null); assert.deepEqual(written(own.id), {stars: 1, comments: 0, events: 1, audits: 1}, 'NO_ROW_IS_STORED_FOR_AN_ABSENT_COMMENT ' + name);
    mustRefuse(await submitV2(P.rq, reviewArgs(own, P.rq, {comment: canaryText('late')})), 'REVIEW_ALREADY_SUBMITTED', '55000', 'A_LATER_COMMENT_CANNOT_BE_ADDED ' + name);
  }
}, {needs: ['applied']});

// ==================================================================================================================================================================
// P5 GATES: participants only, only after the Agreement AND its execution are COMPLETED, one review per side, request reuse, restricted people, concurrency
// ==================================================================================================================================================================
const NONE = {stars: 0, comments: 0, events: 0, audits: 0};
await check('P5_ONLY_PARTICIPANTS_REVIEW_AND_ONLY_AFTER_THE_AGREEMENT_AND_ITS_EXECUTION_ARE_BOTH_COMPLETED', async () => {
  const done = seedAgreement(P.rq, P.wk, {title: 'gates'}), text = canaryText('gates');
  mustRefuse(await submitV2(P.o, {...reviewArgs(done, P.rq), p_target_account_id: P.rq.id, p_comment: text}), 'REVIEW_NOT_ALLOWED', '42501', 'OUTSIDER_TARGETING_THE_REQUESTER');
  mustRefuse(await submitV2(P.o, {...reviewArgs(done, P.rq), p_target_account_id: P.wk.id, p_comment: text}), 'REVIEW_NOT_ALLOWED', '42501', 'OUTSIDER_TARGETING_THE_WORKER');
  mustRefuse(await submitV2(P.rq, {...reviewArgs(done, P.rq), p_target_account_id: P.o.id, p_comment: text}), 'REVIEW_NOT_ALLOWED', '42501', 'PARTICIPANT_WITH_A_WRONG_TARGET');
  mustRefuse(await submitV2(P.rq, {...reviewArgs(done, P.rq), p_target_account_id: P.rq.id, p_comment: text}), 'REVIEW_INPUT_INVALID', '22023', 'SELF_TARGET');
  mustRefuse(await contextV2(P.o, done.id), 'REVIEW_NOT_ALLOWED', '42501', 'AN_OUTSIDER_HAS_NO_REVIEW_CONTEXT');
  assert.deepEqual(written(done.id), NONE);
  // every state the Agreement and its execution can be in without being completed in BOTH places: refused with the same name as the stars
  const states = [['status_done_exec_confirmed', {exec: 'CONFIRMED', need: 'ACTIVE'}], ['status_confirmed_exec_done', {status: 'CONFIRMED'}], ['no_execution_row', {exec: null}], ['confirmed', {status: 'CONFIRMED', exec: 'CONFIRMED', need: 'ACTIVE'}],
    ['awaiting_requester', {status: 'CONFIRMED', exec: 'AWAITING_REQUESTER', need: 'ACTIVE'}], ['cancelled', {status: 'CANCELLED', exec: 'CANCELLED', need: 'CANCELLED'}], ['superseded', {status: 'SUPERSEDED', exec: 'CONFIRMED', need: 'ACTIVE'}]];
  for (const [name, spec] of states) {
    const agreement = seedAgreement(P.rq, P.wk, {title: 'state ' + name, ...spec});
    mustRefuse(await submitV2(P.rq, reviewArgs(agreement, P.rq, {comment: text})), 'REVIEW_NOT_COMPLETED', '55000', 'NOT_COMPLETED_' + name); mustRefuse(await submitV2(P.wk, reviewArgs(agreement, P.wk)), 'REVIEW_NOT_COMPLETED', '55000', 'STAR_ONLY_NOT_COMPLETED_' + name);
    assert.equal(mustOk(await contextV2(P.rq, agreement.id), 'context ' + name).eligible, false, 'ELIGIBLE_FALSE_' + name); assert.deepEqual(written(agreement.id), NONE);
  }
  // the SAME real Dogovor: refused while it is active, refused when only the worker marked the work done, accepted the moment it is really completed (non-vacuous: the gate flips with the real state)
  P.active = await activeAgreement(P.rq, P.wk, 'gate flips with the real state');
  assert.equal(mustOk(await contextV2(P.rq, P.active.id), 'context while active').eligible, false);
  mustRefuse(await submitV2(P.rq, reviewArgs(P.active, P.rq, {comment: text})), 'REVIEW_NOT_COMPLETED', '55000', 'REAL_ACTIVE_DOGOVOR');
  mustOk(await call(P.wk.client, 'rpc_mark_work_done', {p_agreement_id: P.active.id}), 'mark work done');
  mustRefuse(await submitV2(P.rq, reviewArgs(P.active, P.rq, {comment: text})), 'REVIEW_NOT_COMPLETED', '55000', 'REAL_WORK_DONE_BUT_NOT_CONFIRMED');
  assert.deepEqual(written(P.active.id), NONE);
  mustOk(await call(P.rq.client, 'rpc_confirm_completion', {p_agreement_id: P.active.id}), 'confirm completion');
  assert.equal(mustOk(await contextV2(P.rq, P.active.id), 'context after completion').eligible, true);
  const requesterText = canaryText('requester side'), workerText = canaryText('worker side');
  const a = mustOk(await submitV2(P.rq, reviewArgs(P.active, P.rq, {comment: requesterText})), 'requester side'), b = mustOk(await submitV2(P.wk, reviewArgs(P.active, P.wk, {comment: workerText, rating: 3})), 'worker side');
  assert.equal(a.comment, requesterText); assert.equal(b.comment, workerText);
  assert.deepEqual(written(P.active.id), {stars: 2, comments: 2, events: 2, audits: 2}, 'AT_MOST_TWO_COMMENTS_PER_AGREEMENT_ONE_PER_SIDE');
  mustRefuse(await submitV2(P.rq, reviewArgs(P.active, P.rq, {comment: canaryText('second')})), 'REVIEW_ALREADY_SUBMITTED', '55000', 'SECOND_REQUESTER_REVIEW'); mustRefuse(await submitV2(P.wk, reviewArgs(P.active, P.wk, {comment: canaryText('second')})), 'REVIEW_ALREADY_SUBMITTED', '55000', 'SECOND_WORKER_REVIEW');
  const rows_ = commentRows(P.active.id); assert.deepEqual(rows_.map(row => row.author_account_id).sort(), [P.rq.id, P.wk.id].sort()); assert.equal(new Set(rows_.map(row => row.review_id)).size, 2);
  const own = mustOk(await contextV2(P.rq, P.active.id), 'own context'); assert.equal(own.review.comment, requesterText); assert.ok(!JSON.stringify(own).includes(workerText), 'THE_COUNTERPARTS_COMMENT_IS_NOT_IN_MY_RECEIPT');
  assert.equal(own.eligible, false); assert.deepEqual(own.commentPolicy, {supported: true, maxLength: 500, version: 'REVIEW_COMMENT_V1'}); assert.deepEqual(own.tagCatalog.tags, ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL']);
  assert.equal(own.tagCatalog.version, 'PRE_V3_REVIEW_TAGS_V1'); assert.equal(own.tagCatalog.maxTags, 3); assert.equal(own.authoritative, true); assert.equal(own.agreementId, P.active.id); assert.equal(own.accountId, P.rq.id); assert.equal(own.targetAccountId, P.wk.id);
  state.activeComments = {requesterText, workerText};
}, {needs: ['applied']});

await check('P5_A_RESTRICTED_REVIEWER_IS_REFUSED_AT_THE_TRIGGER_TOO_AND_THE_COUNTERPART_MAY_STILL_REVIEW_A_RESTRICTED_TARGET', async () => {
  const restricted = await person('restricted-two'), agreement = seedAgreement(restricted, P.wk, {title: 'restricted reviewer trigger level'}), seededOther = seedAgreement(P.rq, restricted, {title: 'restricted target'});
  restrictAccount(restricted);
  try {
    // the platform fences the API; the predicate and the row triggers are reached with the claims set directly (as the EX-04 proofs do)
    const viaClaims = psql('begin;\n' + claims(restricted.id) + `\nselect public.rpc_submit_agreement_review_v2(${q(agreement.id)}::uuid, ${q(P.wk.id)}::uuid, '5'::jsonb, '[]'::jsonb, ${q(randomUUID())}::uuid, to_jsonb(${q(canaryText('trigger'))}::text));\nrollback;`);
    assert.equal(viaClaims.ok, false); assert.equal(viaClaims.sqlstate, '42501'); assert.equal(viaClaims.message, 'ACCOUNT_CLOSING', 'THE_STAR_TRIGGER_REFUSES_A_RESTRICTED_REVIEWER_ON_THE_V2_PATH ' + viaClaims.message);
    const context = psql('begin;\n' + claims(restricted.id) + `\nselect (public.rpc_get_my_agreement_review_v2(${q(agreement.id)}::uuid)->>'eligible');\nrollback;`); assert.ok(context.ok); assert.equal(context.stdout.split(/\r?\n/).pop(), 'false', 'A_RESTRICTED_ACCOUNT_IS_NEVER_ELIGIBLE');
    // the comment table has its own closure guard (BEFORE INSERT): a direct insert for a restricted author is refused with the same name
    const review = seedAgreement(P.rq, restricted, {title: 'restricted author direct insert'}); const direct = psql(`begin;\nset local session_replication_role = replica;\ninsert into private.agreement_reviews(agreement_id, reviewer_account_id, target_account_id, rating, tags, client_request_id, input_hash, created_at) values (${q(review.id)}, ${q(restricted.id)}, ${q(P.rq.id)}, 5, '{}', ${q(randomUUID())}, ${q('b'.repeat(64))}, now());\nset local session_replication_role = origin;\ninsert into private.agreement_review_comments_v1(review_id, author_account_id, target_account_id, comment, comment_sha256) select id, reviewer_account_id, target_account_id, 'direct', ${q('a'.repeat(64))} from private.agreement_reviews where agreement_id = ${q(review.id)};\nrollback;`);
    assert.equal(direct.ok, false); assert.equal(direct.message, 'ACCOUNT_CLOSING', 'THE_COMMENT_TABLE_HAS_ITS_OWN_CLOSURE_GUARD ' + direct.message);
    // D-DEC-9: the counterpart may still review a closure-restricted TARGET (the tested canon behaviour), comment included
    const text = canaryText('restricted target'), receipt = mustOk(await submitV2(P.rq, reviewArgs(seededOther, P.rq, {comment: text})), 'a review of a restricted target is accepted'); assert.equal(receipt.comment, text);
    assert.deepEqual(written(seededOther.id), {stars: 1, comments: 1, events: written(seededOther.id).events, audits: 1});
  } finally { unrestrictAccount(restricted); }
  assert.deepEqual(written(agreement.id), NONE);
  report.phases.gates = {...report.phases.gates, restricted: 'REVIEWER_REFUSED_AT_API_TRIGGER_AND_COMMENT_TABLE_GUARD; TARGET_STILL_REVIEWABLE'};
}, {needs: ['applied']});

await check('P5_CONCURRENCY_EXACTLY_ONE_STAR_ROW_AND_ONE_COMMENT_ROW_NO_RETRY_LOOP_AND_THE_TWO_SIDES_DO_NOT_BLOCK_EACH_OTHER', async () => {
  const sameKey = seedAgreement(P.rq, P.wk, {title: 'race same key'}), key = randomUUID(), text = canaryText('race');
  const pair = await Promise.all([submitV2(P.rq, reviewArgs(sameKey, P.rq, {key, comment: text})), submitV2(P.rq, reviewArgs(sameKey, P.rq, {key, comment: text}))]);
  for (const response of pair) mustOk(response, 'racing identical command'); assert.deepEqual(pair.map(response => response.data.idempotentReplay).sort(), [false, true]); assert.equal(pair[0].data.reviewId, pair[1].data.reviewId);
  assert.deepEqual(written(sameKey.id), {stars: 1, comments: 1, events: 1, audits: 1});
  const many = seedAgreement(P.rq, P.wk, {title: 'race eight times'}), manyKey = randomUUID(), manyText = canaryText('race eight');
  const eight = await Promise.all(Array.from({length: 8}, () => submitV2(P.rq, reviewArgs(many, P.rq, {key: manyKey, comment: manyText})))); for (const response of eight) mustOk(response, 'racing 8 identical commands');
  assert.equal(eight.filter(response => response.data.idempotentReplay === false).length, 1, 'EXACTLY_ONE_COMMAND_WRITES'); assert.deepEqual(written(many.id), {stars: 1, comments: 1, events: 1, audits: 1});
  const different = seedAgreement(P.rq, P.wk, {title: 'race different keys'}), textA = canaryText('race a'), textB = canaryText('race b');
  const race = await Promise.all([submitV2(P.rq, reviewArgs(different, P.rq, {comment: textA})), submitV2(P.rq, reviewArgs(different, P.rq, {comment: textB}))]);
  const winners = race.filter(response => !response.error), losers = race.filter(response => response.error);
  assert.equal(winners.length, 1); assert.equal(losers.length, 1); mustRefuse(losers[0], 'REVIEW_ALREADY_SUBMITTED', '55000', 'THE_LOSER_OF_A_RACE_BETWEEN_TWO_COMMANDS_OF_ONE_SIDE');
  assert.deepEqual(written(different.id), {stars: 1, comments: 1, events: 1, audits: 1}); assert.equal(commentRows(different.id)[0].comment, winners[0].data.comment, 'THE_STORED_COMMENT_IS_THE_WINNERS');
  const sides = seedAgreement(P.rq, P.wk, {title: 'race two sides'}), both = await Promise.all([submitV2(P.rq, reviewArgs(sides, P.rq, {comment: canaryText('side a')})), submitV2(P.wk, reviewArgs(sides, P.wk, {comment: canaryText('side b')}))]);
  for (const response of both) mustOk(response, 'the two sides race'); assert.deepEqual(written(sides.id), {stars: 2, comments: 2, events: 2, audits: 2});
  const mixed = seedAgreement(P.rq, P.wk, {title: 'race v2 against legacy'}), mixedKey = randomUUID(), mixedText = canaryText('race mixed');
  // v2 (with a comment) against the legacy function (star-only) under ONE request id: whoever commits first decides, and both outcomes are lawful
  const [byV2, byLegacy] = await Promise.all([submitV2(P.rq, reviewArgs(mixed, P.rq, {key: mixedKey, comment: mixedText})), submitLegacy(P.rq, reviewArgs(mixed, P.rq, {key: mixedKey}))]);
  assert.equal(starRows(mixed.id).length, 1, 'ONE_STAR_ROW_WHOEVER_WINS'); mustOk(byLegacy, 'the legacy side never fails');
  let crossing;
  if (!byV2.error) { assert.equal(byV2.data.idempotentReplay === false, byLegacy.data.idempotentReplay === true, 'EXACTLY_ONE_OF_THE_TWO_WROTE'); assert.equal(written(mixed.id).comments, 1); crossing = 'v2 won: the star row and the comment were written together, the legacy call replayed'; }
  else { mustRefuse(byV2, 'REQUEST_ID_REUSED', '22023', 'THE_LEGACY_STAR_ONLY_WINNER_MAKES_THE_COMMENT_A_DIFFERENT_COMMAND'); assert.equal(byLegacy.data.idempotentReplay, false); assert.equal(written(mixed.id).comments, 0); crossing = 'legacy won: star-only, the v2 command with a comment is REQUEST_ID_REUSED'; }
  report.phases.gates = {...report.phases.gates, concurrency: {identicalPair: 'one write, one replay', eightIdentical: 'one write, seven replays', differentKeys: 'one winner, the loser REVIEW_ALREADY_SUBMITTED', twoSides: 'both written', v2AgainstLegacy: crossing, noRetryLoop: 'every call returned within ' + DEADLINE_MS + ' ms'}};
}, {needs: ['applied']});

await check('P5_SOFT_THE_AUTO_COMPLETION_TICK_GATES_THE_COMMENT_LIKE_THE_STARS', async () => {
  const agreement = await activeAgreement(P.rq, P.wk, 'auto completion');
  mustOk(await call(P.wk.client, 'rpc_mark_work_done', {p_agreement_id: agreement.id}), 'mark work done');
  must(`begin; set local session_replication_role = replica; update public.agreement_execution set requester_deadline_at = now() - interval '1 minute' where agreement_id = ${q(agreement.id)}; commit;`, 'age the requester deadline');
  const tick = await call(service, 'rpc_tick_auto_completion', {});
  const states = rows(`select a.status, e.state from public.agreements a join public.agreement_execution e on e.agreement_id = a.id where a.id = ${q(agreement.id)}`)[0];
  if (tick.error || states.status !== 'COMPLETED' || states.state !== 'COMPLETED') { report.gaps.push('AUTO_COMPLETION_NOT_REACHED_BY_THE_FIXTURE (tick ' + JSON.stringify(lib.outcomeOf(tick)) + ', states ' + JSON.stringify(states) + '): D-DEC-11 is covered by the confirm path only'); return; }
  const text = canaryText('auto completed'); assert.equal(mustOk(await submitV2(P.rq, reviewArgs(agreement, P.rq, {comment: text})), 'a comment after the auto-completion').comment, text);
  report.phases.gates = {...report.phases.gates, autoCompletion: 'REACHED: the comment is accepted exactly like the stars'};
}, {needs: ['applied']});

// ==================================================================================================================================================================
// P6 VISIBILITY: the gated reader, the author's own receipt, no leak, aggregate and ratingDue unchanged
// ==================================================================================================================================================================
const C = {};                                          // the cast of the reader phase
const listKeys = ['authoritative', 'hasMore', 'items', 'nextAfter', 'profileId'], itemKeys = ['agreementId', 'author', 'comment', 'createdAt', 'rating', 'reviewId'], authorKeys = ['avatarPath', 'displayName', 'profileId', 'role'];
const commentsOf = response => mustOk(response, 'reader').items.map(item => item.comment);
const ratingFacts = async person => {
  const page = mustOk(await call(person.client, 'rpc_list_my_agreements_page', {p_scope: 'ALL', p_limit: 100, p_before_at: null, p_before_id: null}), 'agreements page'), facts = {};
  for (const item of page.items) facts[item.id] = {ratingDue: item.ratingDue, eligible: mustOk(await contextV2(person, item.id), 'authority').eligible};
  const home = mustOk(await call(person.client, 'rpc_home_attention', {}), 'home attention'); return {facts, ratings: home.ratings ?? null};
};
await check('P6_FIXTURE_THE_CAST_OF_THE_READER_PHASE_WITH_COMMENTS_STAR_ONLY_REVIEWS_BOTH_ROLES_AND_TWO_WORLDS', async () => {
  C.t = await person('subject', {name: 'D12 Subjekt'}); await prepareWorker(C.t); C.a1 = await person('author-one', {name: 'D12 Autor Jedan'}); C.a2 = await person('author-two', {name: 'D12 Autor Dva'}); await prepareWorker(C.a2);
  C.a3 = await person('author-three', {name: 'D12 Autor Tri'}); C.v = await person('viewer', {name: 'D12 Gledalac'}); C.v2 = await person('viewer-two', {name: 'D12 Gledalac Dva'});
  C.s2 = await person('subject-two', {name: 'D12 Subjekt Dva'}); C.x4 = await person('test-author', {name: 'D12 Test Autor'}); C.x5 = await person('test-subject', {name: 'D12 Test Subjekt'}); putInTestWorld(C.x4); putInTestWorld(C.x5);
  // fields that must never reach the reader: phone, full name, city of the account
  for (const [index, who] of [C.a1, C.a2, C.a3, C.t, C.s2].entries()) sql(`update public.app_accounts set phone = '+38160000${1000 + index}', full_name = ${q('D12LEAKNAME ' + who.label)}, city = 'D12LEAKCITY' where id = ${q(who.id)}`);
  // round-1 finding: the reader returns avatarPath VERBATIM and its first path segment is the account id (as on DEV: 2 of 2 avatars). One author gets such a path, so the no-account-id assertion below is no longer vacuous.
  C.avatar = C.a1.id + '/avatar-d12.jpg'; sql(`update public.app_profiles set avatar_path = ${q(C.avatar)} where id = ${q(C.a1.profile.REQUESTER)}`);
  C.text = {c1: canaryText('c1'), c2: canaryText('c2'), c4: canaryText('c4'), c6: canaryText('c6'), c7: canaryText('c7')};
  C.g1 = seedAgreement(C.a1, C.t, {title: 'reader g1'}); mustOk(await submitV2(C.a1, reviewArgs(C.g1, C.a1, {rating: 5, comment: C.text.c1})), 'c1');
  C.g2 = seedAgreement(C.t, C.a2, {title: 'reader g2'}); mustOk(await submitV2(C.a2, reviewArgs(C.g2, C.a2, {rating: 3, comment: C.text.c2})), 'c2');
  C.g3 = seedAgreement(C.a3, C.t, {title: 'reader g3 star only'}); mustOk(await submitV2(C.a3, reviewArgs(C.g3, C.a3, {rating: 4})), 'star-only review');
  C.g4 = seedAgreement(C.a1, C.s2, {title: 'reader g4'}); mustOk(await submitV2(C.a1, reviewArgs(C.g4, C.a1, {rating: 5, comment: C.text.c4})), 'c4');
  C.g6 = seedAgreement(C.x4, C.x5, {title: 'reader g6 test world'}); mustOk(await submitV2(C.x4, reviewArgs(C.g6, C.x4, {rating: 5, comment: C.text.c6})), 'c6');
  C.g7 = seedAgreement(C.a2, C.x5, {title: 'reader g7 real author about a test subject'}); mustOk(await submitV2(C.a2, reviewArgs(C.g7, C.a2, {rating: 2, comment: C.text.c7})), 'c7');
  assert.equal(sql(`select count(*) from private.agreement_review_comments_v1 where target_account_id = ${q(C.t.id)}`), '2'); assert.equal(starRows(C.g3.id).length, 1);
  state.reader = true;
}, {needs: ['applied']});

await check('P6_THE_READER_LISTS_ONLY_COMMENTED_REVIEWS_NEWEST_FIRST_WITH_THE_AUTHOR_FACE_OF_THE_AGREEMENT_ROLE_AND_NO_ACCOUNT_ID_PHONE_NAME_OR_ADDRESS', async () => {
  const list = mustOk(await readerPage(C.v, C.t.profile.WORKER), 'reader as a third viewer');
  assert.deepEqual(Object.keys(list).sort(), listKeys); assert.equal(list.profileId, C.t.profile.WORKER); assert.equal(list.hasMore, false); assert.equal(list.nextAfter, null); assert.equal(list.authoritative, true);
  assert.deepEqual(list.items.map(item => item.comment), [C.text.c2, C.text.c1], 'ONLY_COMMENTED_REVIEWS_NEWEST_FIRST_THE_STAR_ONLY_REVIEW_IS_NOT_LISTED');
  for (const item of list.items) { assert.deepEqual(Object.keys(item).sort(), itemKeys); assert.deepEqual(Object.keys(item.author).sort(), authorKeys); assert.ok(!Number.isNaN(Date.parse(item.createdAt))); assert.equal(item.agreementId, null, 'A_THIRD_VIEWER_NEVER_LEARNS_THE_AGREEMENT_ID'); }
  const [newest, older] = list.items;
  assert.equal(older.rating, 5); assert.deepEqual(older.author, {profileId: C.a1.profile.REQUESTER, role: 'REQUESTER', displayName: 'D12 Autor Jedan', avatarPath: C.avatar}, 'THE_AUTHOR_FACE_IS_THE_REQUESTER_PROFILE_OF_THAT_AGREEMENT');
  assert.equal(older.author.avatarPath, sql(`select avatar_path from public.app_profiles where id = ${q(C.a1.profile.REQUESTER)}`), 'THE_AVATAR_PATH_IS_THE_PROFILES_OWN_PATH');
  assert.ok(JSON.stringify(mustOk(await publicProfile(C.v, C.a1.profile.REQUESTER), 'public profile of the author')).includes(C.avatar), 'rpc_get_public_profile returns the SAME path (the owner accepted this disclosure on 2026-09-22); the reader adds no new exposure');
  assert.equal(newest.rating, 3); assert.deepEqual(newest.author, {profileId: C.a2.profile.WORKER, role: 'WORKER', displayName: 'D12 Autor Dva (radnik)', avatarPath: null}, 'THE_AUTHOR_FACE_IS_THE_WORKER_PROFILE_OF_THAT_AGREEMENT');
  const viaRequesterProfile = mustOk(await readerPage(C.v, C.t.profile.REQUESTER), 'reader by the other profile of the same account'); assert.deepEqual(viaRequesterProfile.items, list.items, 'THE_LIST_IS_ACCOUNT_LEVEL_BOTH_PROFILES_SHOW_THE_SAME_REVIEWS');
  // no leak: no account id, no e-mail, no phone, no account name, no city, no address of anyone
  const text = JSON.stringify(list), emails = rows(`select email from auth.users where id = any(array[${[C.t, C.a1, C.a2, C.a3, C.v].map(who => q(who.id)).join(',')}]::uuid[])`).map(row => row.email);
  // no account id ANYWHERE except as the first segment of an avatarPath, exactly as rpc_get_public_profile returns it (the claim the README makes; round-1 finding)
  const withoutAvatarPaths = JSON.stringify(list, (key, value) => key === 'avatarPath' ? null : value);
  for (const who of [C.t, C.a1, C.a2, C.a3, C.v]) assert.ok(!withoutAvatarPaths.includes(who.id), 'NO_ACCOUNT_ID_EXCEPT_INSIDE_AN_AVATAR_PATH ' + who.label);
  assert.ok(text.includes(C.a1.id), 'POSITIVE_CONTROL_THE_ACCOUNT_ID_OF_THE_AUTHOR_WITH_AN_AVATAR_IS_PRESENT_INSIDE_ITS_AVATAR_PATH_ONLY');
  for (const email of emails) assert.ok(email && !text.includes(email) && !text.includes('proof.invalid'), 'NO_EMAIL');
  for (const leak of ['D12LEAKNAME', 'D12LEAKCITY', '+38160000', 'Novi Sad']) assert.ok(!text.includes(leak), 'NO_LEAK ' + leak);
  report.phases.visibility = {itemKeys, authorKeys, listKeys, items: list.items.length};
}, {needs: ['reader']});

await check('P6_THE_SUBJECT_AND_THE_AUTHOR_SEE_THEIR_OWN_VIEW_THE_SUBJECT_LEARNS_THE_AGREEMENT_ID_AND_THE_OWN_RECEIPT_SHOWS_ONLY_THE_OWN_COMMENT', async () => {
  const asSubject = mustOk(await readerPage(C.t, C.t.profile.WORKER), 'reader as the subject'); assert.deepEqual(asSubject.items.map(item => item.comment), [C.text.c2, C.text.c1]);
  assert.deepEqual(asSubject.items.map(item => item.agreementId), [C.g2.id, C.g1.id], 'THE_REVIEWED_PERSON_GETS_THE_AGREEMENT_ID_TO_REPORT_THROUGH_THE_EXISTING_CHANNELS');
  const asAuthor = mustOk(await readerPage(C.a1, C.t.profile.WORKER), 'reader as an author'); assert.deepEqual(asAuthor.items.map(item => item.comment), [C.text.c2, C.text.c1]); assert.ok(asAuthor.items.every(item => item.agreementId === null));
  const own = mustOk(await contextV2(C.a1, C.g1.id), 'own receipt of the author'); assert.equal(own.review.comment, C.text.c1); assert.equal(own.eligible, false); assert.ok(own.commentPolicy.supported);
  const target = mustOk(await contextV2(C.t, C.g1.id), 'receipt of the reviewed person'); assert.equal(target.review, null, 'THE_REVIEWED_PERSON_HAS_NO_REVIEW_OF_THEIR_OWN_HERE'); assert.equal(target.eligible, true); assert.ok(!JSON.stringify(target).includes(C.text.c1), 'THE_AUTHORS_COMMENT_IS_NOT_IN_THE_TARGETS_RECEIPT');
  const ownTarget = mustOk(await contextV2(C.t, C.g2.id), 'receipt of the subject in g2'); assert.equal(ownTarget.eligible, true); assert.equal(ownTarget.review, null);
}, {needs: ['reader']});

await check('P6_STARS_THE_COUNT_THE_AVERAGE_AND_THE_RATING_DUE_FACT_DO_NOT_DEPEND_ON_ANY_COMMENT', async () => {
  const reputation = await reputationOf(C.v, C.t.id), expected = rows(`select count(*)::integer n, round(avg(rating), 2)::float8 average from private.agreement_reviews where target_account_id = ${q(C.t.id)}`)[0];
  assert.equal(reputation.reviewCount, 3); assert.equal(reputation.reviewCount, expected.n); assert.equal(reputation.averageRating, expected.average); assert.equal(reputation.averageRating, 4);
  const profile = mustOk(await publicProfile(C.v, C.t.profile.WORKER), 'public profile'); assert.equal(profile.trust.reviewCount, 3); assert.equal(profile.trust.ratingAverage, 4); assert.ok(!JSON.stringify(profile).includes(C.text.c1) && !JSON.stringify(profile).includes(C.text.c2));
  state.facts = {a1: await ratingFacts(C.a1), t: await ratingFacts(C.t)};
  for (const who of ['a1', 't']) for (const [id, fact] of Object.entries(state.facts[who].facts)) if (fact.ratingDue !== undefined) assert.equal(fact.ratingDue, fact.eligible, `RATING_DUE_EQUALS_THE_AUTHORITY ${who} ${id}`);
  assert.equal(state.facts.a1.facts[C.g1.id].eligible, false, 'THE_AUTHOR_OF_A_COMMENT_HAS_REVIEWED_SO_IT_IS_NOT_DUE_FOR_THEM'); assert.equal(state.facts.t.facts[C.g1.id].eligible, true, 'THE_REVIEWED_PERSON_STILL_OWES_THEIR_OWN_REVIEW');
  state.facts.reputation = {count: reputation.reviewCount, average: reputation.averageRating};
  report.phases.visibility.ratingDueFact = Object.values(state.facts.t.facts).some(fact => fact.ratingDue !== undefined) ? 'present and equal to the authority' : 'ABSENT ON THE CHAIN (EX-04c readers not carrying ratingDue): only the authority was compared';
}, {needs: ['reader']});

await check('P6_PAGING_IS_KEYSET_STABLE_UNDER_A_NEW_COMMENT_CLAMPED_AND_REFUSES_A_BAD_CURSOR_ANON_IS_DENIED_AND_THE_SAFE_FAILURES_HOLD', async () => {
  const one = mustOk(await readerPage(C.v, C.t.profile.WORKER, {p_limit: 1}), 'page 1'); assert.deepEqual(one.items.map(item => item.comment), [C.text.c2]); assert.equal(one.hasMore, true);
  assert.deepEqual(Object.keys(one.nextAfter).sort(), ['createdAt', 'reviewId']); assert.equal(one.nextAfter.reviewId, one.items[0].reviewId);
  // a NEW, newer comment arrives between the pages: the cursor of page 1 still yields the rest, without a duplicate and without the newcomer
  const g9 = seedAgreement(C.a3, C.t, {title: 'reader g9 newer'}), c9 = canaryText('c9'); mustOk(await submitV2(C.a3, reviewArgs(g9, C.a3, {comment: c9})), 'c9');
  const two = mustOk(await readerPage(C.v, C.t.profile.WORKER, {p_limit: 1, p_after: one.nextAfter}), 'page 2'); assert.deepEqual(two.items.map(item => item.comment), [C.text.c1]); assert.equal(two.hasMore, false); assert.equal(two.nextAfter, null);
  assert.deepEqual(commentsOf(await readerPage(C.v, C.t.profile.WORKER)), [c9, C.text.c2, C.text.c1], 'A_FRESH_READ_STARTS_WITH_THE_NEWEST');
  const all = []; let cursor = null; for (let guard = 0; guard < 6; guard++) { const page = mustOk(await readerPage(C.v, C.t.profile.WORKER, {p_limit: 1, p_after: cursor}), 'walk'); all.push(...page.items.map(item => item.comment)); if (!page.hasMore) break; cursor = page.nextAfter; }
  assert.deepEqual(all, [c9, C.text.c2, C.text.c1], 'A_FULL_WALK_VISITS_EVERY_COMMENT_ONCE');
  assert.equal(commentsOf(await readerPage(C.v, C.t.profile.WORKER, {p_limit: 0})).length, 1, 'LIMIT_0_IS_CLAMPED_TO_1'); assert.equal(commentsOf(await readerPage(C.v, C.t.profile.WORKER, {p_limit: 100})).length, 3); assert.equal(commentsOf(await readerPage(C.v, C.t.profile.WORKER, {p_limit: null})).length, 3);
  for (const [name, cursorValue] of [['A_STRING', 'x'], ['A_BAD_TIME', {createdAt: 'not a time', reviewId: randomUUID()}], ['A_BAD_ID', {createdAt: '2026-03-01T10:00:00+00:00', reviewId: 'nope'}], ['A_NUMBER_TIME', {createdAt: 5, reviewId: randomUUID()}], ['MISSING_KEYS', {}]])
    mustRefuse(await readerPage(C.v, C.t.profile.WORKER, {p_after: cursorValue}), 'INVALID_PAGE', '22023', 'CURSOR_' + name);
  mustRefuse(await readerPage(C.v, null), 'PROFILE_ID_REQUIRED', '22023', 'NO_PROFILE'); assert.equal((await readerPage(C.v, randomUUID())).data, null, 'AN_UNKNOWN_PROFILE_READS_AS_NOTHING_HERE');
  assert.deepEqual(mustOk(await readerPage(C.v, C.v.profile.REQUESTER), 'reader about myself').items, [], 'A_PERSON_WITH_NO_COMMENT_HAS_AN_EMPTY_LIST_NOT_AN_ERROR');
  const denied_ = await call(anon, 'rpc_list_review_comments_v1', {p_profile_id: C.t.profile.WORKER}); assert.ok(denied_.error); assert.equal(denied_.error.code, '42501'); assert.ok([401, 403].includes(denied_.status), 'ANON_DENIED ' + denied_.status);
  // the plan can use the partial index (a bounded read), measured with sequential scans off because the fixture is tiny
  const plan = must(`begin;\nset local enable_seqscan = off;\nexplain (format json) select c.review_id from private.agreement_review_comments_v1 c where c.target_account_id = ${q(C.t.id)} and c.hidden_at is null order by c.created_at desc, c.review_id desc limit 21;\nrollback;`, 'explain');
  assert.ok(plan.includes(lib.TABLE_NAME + '_target_idx'), 'THE_PARTIAL_INDEX_SERVES_THE_READ ' + plan.slice(0, 300));
  const started = Date.now(); mustOk(await readerPage(C.v, C.t.profile.WORKER, {p_limit: 50}), 'timed read'); assert.ok(Date.now() - started < 8000, 'UNDER_THE_8_SECOND_AUTHENTICATED_STATEMENT_TIMEOUT');
  state.c9 = c9;
}, {needs: ['reader']});

await check('P6_THE_READER_GATES_BLOCKS_RESTRICTION_AND_WORLD_ARE_READ_TIME_ONLY_NEVER_A_WRITE_REFUSAL_AND_EACH_GATE_FLIPS_BOTH_WAYS', async () => {
  const baseline = commentsOf(await readerPage(C.v, C.t.profile.WORKER)); assert.equal(baseline.length, 3); const t = C.t.profile.WORKER, c9 = state.c9;
  const gate = async (name, apply, undo, expectations) => {
    await apply();
    try { for (const [viewer, profile, expected] of expectations) { const response = await readerPage(viewer, profile); assert.equal(response.error, null, `NO_ERROR_THAT_REVEALS_THE_GATE ${name}`); const actual = response.data === null ? null : response.data.items.map(item => item.comment); assert.deepEqual(actual, expected, `GATE ${name} viewer ${viewer.label}`); } }
    finally { await undo(); }
    assert.deepEqual(commentsOf(await readerPage(C.v, t)), baseline, 'AFTER_THE_GATE_IS_LIFTED_THE_LIST_IS_BACK ' + name);
  };
  // (a) the subject blocks the viewer: nothing, no error; another viewer is unaffected
  await gate('SUBJECT_BLOCKS_VIEWER', () => blockAccount(C.t, C.v, true), () => blockAccount(C.t, C.v, false), [[C.v, t, null], [C.v2, t, baseline]]);
  // (b) the viewer blocks one author: that author's comment is not listed FOR THAT VIEWER only
  await gate('VIEWER_BLOCKS_AUTHOR', () => blockAccount(C.v, C.a1, true), () => blockAccount(C.v, C.a1, false), [[C.v, t, baseline.filter(text => text !== C.text.c1)], [C.v2, t, baseline]]);
  // (c) ROUND-1 BLOCKER (the old reader gated on safety_pair_blocked(author, subject), which is TRUE when EITHER party blocked the other, so the text vanished for EVERY viewer): the subject blocks an author. The comment
  // disappears for THE SUBJECT ONLY (the viewer who blocked its author); the two third viewers still see it; the author, whom the subject blocked, reads the profile as "nothing here".
  const without = text => baseline.filter(item => item !== text);
  await gate('SUBJECT_BLOCKS_AUTHOR', () => blockAccount(C.t, C.a1, true), () => blockAccount(C.t, C.a1, false), [[C.v, t, baseline], [C.v2, t, baseline], [C.t, t, without(C.text.c1)], [C.a1, t, null]]);
  // (c2) the AUTHOR blocks the subject: the author cannot un-publish its own comment for everybody by toggling a block (the edit/delete path the owner forbade, through a side door); only the subject (the blocked person) no longer sees it
  await gate('AUTHOR_BLOCKS_SUBJECT', () => blockAccount(C.a1, C.t, true), () => blockAccount(C.a1, C.t, false), [[C.v, t, baseline], [C.v2, t, baseline], [C.t, t, without(C.text.c1)], [C.a1, t, null]]);
  // (c3) the two-viewer matrix over a toggle: at no point of "block, unblock, block, unblock" does a third viewer's list change
  for (const toggle of ['first', 'second']) await gate('SUBJECT_TOGGLES_A_BLOCK_ON_THE_AUTHOR_' + toggle, () => blockAccount(C.t, C.a1, true), () => blockAccount(C.t, C.a1, false), [[C.v, t, baseline], [C.v2, t, baseline]]);
  // (d) the AUTHOR is closure-restricted: the comment stays stored and is not listed
  await gate('AUTHOR_IS_CLOSURE_RESTRICTED', async () => restrictAccount(C.a1), async () => unrestrictAccount(C.a1), [[C.v, t, baseline.filter(text => text !== C.text.c1)]]);
  assert.equal(sql(`select count(*) from private.agreement_review_comments_v1 where author_account_id = ${q(C.a1.id)}`), '2', 'A_HIDDEN_COMMENT_IS_STILL_STORED');
  // (e) the SUBJECT is closure-restricted: the whole list reads as nothing here
  const s2 = C.s2.profile.REQUESTER; assert.deepEqual(commentsOf(await readerPage(C.v, s2)), [C.text.c4], 'S2_BASELINE');
  await gate2(async () => restrictAccount(C.s2), async () => unrestrictAccount(C.s2), [[C.v, s2, null]]);
  assert.deepEqual(commentsOf(await readerPage(C.v, s2)), [C.text.c4]);
  // (f) the two worlds: a REAL viewer sees nothing about a TEST subject; inside the TEST world the viewer sees the TEST author but not the REAL author
  const x5 = C.x5.profile.REQUESTER; assert.equal((await readerPage(C.v, x5)).data, null, 'A_REAL_VIEWER_READS_A_TEST_SUBJECT_AS_NOTHING_HERE');
  assert.deepEqual(commentsOf(await readerPage(C.x4, x5)), [C.text.c6], 'INSIDE_THE_TEST_WORLD_THE_TEST_AUTHOR_IS_LISTED_AND_THE_REAL_AUTHOR_IS_NOT');
  assert.equal(sql(`select count(*) from private.agreement_review_comments_v1 where target_account_id = ${q(C.x5.id)}`), '2', 'BOTH_COMMENTS_ARE_STORED');
  async function gate2(apply, undo, expectations) { await apply(); try { for (const [viewer, profile, expected] of expectations) { const response = await readerPage(viewer, profile); assert.equal(response.error, null); assert.deepEqual(response.data === null ? null : response.data.items.map(item => item.comment), expected); } } finally { await undo(); } }
  // (g) a BLOCKED author can still WRITE (the stars may be written about a blocker and a refusal would reveal the block): the text is hidden at read time while the block lasts
  const g8 = seedAgreement(C.v, C.t, {title: 'reader g8 blocked author writes'}), c8 = canaryText('c8');
  await blockAccount(C.t, C.v, true);
  try {
    const receipt = mustOk(await submitV2(C.v, reviewArgs(g8, C.v, {comment: c8})), 'a blocked author is accepted'); assert.equal(receipt.comment, c8); assert.equal(written(g8.id).comments, 1);
    assert.ok(commentsOf(await readerPage(C.v2, t)).includes(c8), 'WHILE_THE_SUBJECT_BLOCKS_ITS_AUTHOR_THE_TEXT_STAYS_LISTED_FOR_THIRD_VIEWERS (the block hides it from the blocker only)');
    assert.ok(!commentsOf(await readerPage(C.t, t)).includes(c8), 'THE_SUBJECT_WHO_BLOCKED_THE_AUTHOR_DOES_NOT_SEE_THE_TEXT');
  } finally { await blockAccount(C.t, C.v, false); }
  assert.ok(commentsOf(await readerPage(C.v2, t)).includes(c8) && commentsOf(await readerPage(C.t, t)).includes(c8), 'AFTER_THE_BLOCK_IS_LIFTED_THE_TEXT_IS_LISTED_FOR_EVERYONE'); state.c8 = c8;
  report.phases.visibility.gates = ['SUBJECT_BLOCKS_VIEWER', 'VIEWER_BLOCKS_AUTHOR', 'SUBJECT_BLOCKS_AUTHOR (third viewers unaffected)', 'AUTHOR_BLOCKS_SUBJECT (third viewers unaffected)', 'BLOCK_TOGGLES_TWO_VIEWER_MATRIX', 'AUTHOR_IS_CLOSURE_RESTRICTED', 'SUBJECT_IS_CLOSURE_RESTRICTED', 'REAL_VIEWER_TEST_SUBJECT',
    'TEST_VIEWER_REAL_AUTHOR', 'BLOCKED_AUTHOR_WRITES_HIDDEN_FROM_THE_BLOCKER_ONLY'];
  report.gaps.push('A non-ACTIVE author profile hiding its comment (ap.profile_status) is not exercised here: no product path makes an author profile non-ACTIVE without a closure.');
}, {needs: ['reader']});

// ==================================================================================================================================================================
// P7 RLS / ACL / IMMUTABILITY
// ==================================================================================================================================================================
const accessToken = async person => (await person.client.auth.getSession()).data.session.access_token;
const GUARD_MARKER = "select set_config('uskoci.review_comment_moderation', 'on', true);";
await check('P7_NO_CLIENT_ROLE_REACHES_THE_TABLE_BY_REST_OR_SQL_AND_EVERY_ORDINARY_UPDATE_OR_DELETE_RAISES_EXCEPT_THE_TWO_NARROW_CARVE_OUTS', async () => {
  // REST: the table is in schema private, which PostgREST does not expose: no data, whichever key or profile header is sent
  const rest = async (headers, path) => { const response = await fetch(env.RU5_DEVICE_SUPABASE_URL + '/rest/v1/' + path, {headers: {apikey: env.RU5_DEVICE_ANON_KEY, ...headers}}); return {status: response.status, text: await response.text()}; };
  const token = await accessToken(P.rq), results = {};
  for (const [name, headers] of [['anon', {}], ['authenticated', {Authorization: 'Bearer ' + token}], ['authenticated_private_profile', {Authorization: 'Bearer ' + token, 'Accept-Profile': 'private'}], ['service_role_private_profile', {apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.RU5_DEVICE_SERVICE_ROLE_KEY, 'Accept-Profile': 'private'}]]) {
    const answer = await rest(headers, lib.TABLE_NAME + '?select=*'); results[name] = answer.status;
    assert.ok(answer.status >= 400, 'NO_2XX_FOR_THE_PRIVATE_TABLE_OVER_REST ' + name + ' ' + answer.status); assert.ok(!answer.text.includes('review_id'), 'NO_ROW_OVER_REST ' + name);
  }
  report.phases.rls = {restStatuses: results};
  // SQL as the client roles: no table privilege at all
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const statement of [`select count(*) from ${lib.TABLE}`, `insert into ${lib.TABLE}(review_id) values (gen_random_uuid())`, `update ${lib.TABLE} set comment = 'x'`, `delete from ${lib.TABLE}`]) {
      const result = psql('begin;\nset local role ' + role + ';\n' + statement + ';\nrollback;'); assert.equal(result.ok, false, `ROLE_CANNOT ${role}: ${statement}`); assert.equal(result.sqlstate, '42501', 'PERMISSION_DENIED ' + role + ' ' + result.message);
    }
  }
  // the ordinary mutation matrix as the database owner (every attempt is rolled back): a comment is part of an immutable review
  const rid = state.a1Comment.reviewId, row = `where review_id = ${q(rid)}`, immutable = (name, statements) => {
    const result = tryInTransaction(statements); assert.equal(result.ok, false, 'EXPECTED_REFUSAL ' + name); assert.equal(result.sqlstate, '42501', 'SQLSTATE ' + name + ': ' + result.message); assert.equal(result.message, 'REVIEW_COMMENT_IMMUTABLE', 'NAME ' + name); };
  immutable('UPDATE_TEXT', `update ${lib.TABLE} set comment = 'changed' ${row};`);
  immutable('UPDATE_HIDDEN_WITHOUT_ANY_CLAIM', `update ${lib.TABLE} set hidden_at = clock_timestamp(), hidden_reason_code = 'ABUSE' ${row};`);
  immutable('DELETE', `delete from ${lib.TABLE} ${row};`);
  immutable('SERVICE_CLAIMS_WITHOUT_THE_MARKER_UPDATE', `${serviceClaims}\nupdate ${lib.TABLE} set hidden_at = clock_timestamp(), hidden_reason_code = 'ABUSE' ${row};`);
  immutable('SERVICE_CLAIMS_WITHOUT_A_CERTIFICATE_DELETE', `${serviceClaims}\ndelete from ${lib.TABLE} ${row};`);
  immutable('MARKER_WITHOUT_THE_SERVICE_CLAIMS', `${GUARD_MARKER}\nupdate ${lib.TABLE} set hidden_at = clock_timestamp(), hidden_reason_code = 'ABUSE' ${row};`);
  immutable('MARKER_PLUS_CLAIMS_BUT_THE_TEXT_CHANGES', `${serviceClaims}\n${GUARD_MARKER}\nupdate ${lib.TABLE} set comment = 'changed', hidden_at = clock_timestamp(), hidden_reason_code = 'ABUSE' ${row};`);
  immutable('MARKER_PLUS_CLAIMS_BUT_THE_AUTHOR_CHANGES', `${serviceClaims}\n${GUARD_MARKER}\nupdate ${lib.TABLE} set author_account_id = target_account_id, target_account_id = author_account_id ${row};`);
  immutable('MARKER_PLUS_CLAIMS_BUT_A_DELETE', `${serviceClaims}\n${GUARD_MARKER}\ndelete from ${lib.TABLE} ${row};`);
  immutable('MARKER_PLUS_CLAIMS_BUT_THE_HASH_CHANGES', `${serviceClaims}\n${GUARD_MARKER}\nupdate ${lib.TABLE} set comment_sha256 = repeat('b', 64), hidden_at = clock_timestamp(), hidden_reason_code = 'ABUSE' ${row};`);
  // the carve-out is real (non-vacuous): service claims + the transaction-local marker + ONLY the two hide columns pass
  const carve = tryInTransaction(`${serviceClaims}\n${GUARD_MARKER}\nupdate ${lib.TABLE} set hidden_at = clock_timestamp(), hidden_reason_code = 'ABUSE' ${row};\nselect hidden_at is not null from ${lib.TABLE} ${row};`);
  assert.ok(carve.ok && carve.out.split(/\r?\n/).pop() === 't', 'THE_MODERATION_CARVE_OUT_PASSES_ONLY_THE_HIDE_COLUMNS ' + (carve.message ?? carve.out));
  // the star table: still immutable for every role
  for (const statement of ['update private.agreement_reviews set rating = 1', 'delete from private.agreement_reviews']) { const result = tryInTransaction(statement + ';'); assert.equal(result.ok, false); assert.equal(result.message, 'REVIEW_IMMUTABLE'); assert.equal(result.sqlstate, '42501'); }
  const truncate = tryInTransaction(`truncate ${lib.TABLE};`); report.residuals.push({id: 'owner_can_truncate_the_comment_table', observed: truncate.ok ? 'TRUNCATE_SUCCEEDED_IN_A_ROLLED_BACK_TRANSACTION' : 'REFUSED ' + truncate.message, note: 'a row trigger does not see TRUNCATE (the star table has the same property): only the database owner can do it'});
  assert.equal(Number(sql(`select count(*) from ${lib.TABLE} ${row}`)), 1, 'EVERY_PROBE_WAS_ROLLED_BACK');
  report.phases.rls = {...report.phases.rls, immutableMatrix: 'UPDATE/DELETE refused for the owner, with service claims alone, with the marker alone, with both when the text, the author, the hash or a DELETE is attempted; passed only for the two hide columns under claims + marker'};
}, {needs: ['a1Comment']});

// ==================================================================================================================================================================
// P8 MODERATION: the service role HIDES or RESTORES the text of one comment and nothing else; no automatic moderation
// ==================================================================================================================================================================
const commentKeyOf = reviewId => sql(`select client_request_id from private.agreement_reviews where id = ${q(reviewId)}`);
const moderate = (client, reviewId, action, reason, key = randomUUID()) => call(client, 'rpc_moderate_review_comment_service_v1', {p_review_id: reviewId, p_action: action, p_reason_code: reason, p_client_request_id: key});
await check('P8_THE_SERVICE_ROLE_HIDES_AND_RESTORES_THE_TEXT_ONLY_STARS_AGGREGATE_AND_RATING_DUE_ARE_UNTOUCHED_THE_READER_HIDES_IT_THE_AUTHOR_STILL_SEES_IT_AND_AN_AUDIT_ROW_HOLDS_IDS_ONLY', async () => {
  const review = commentRows(C.g1.id)[0], reviewId = review.review_id, text = C.text.c1;
  assert.equal(Number(sql('select count(*) from private.agreement_review_comments_v1 where hidden_at is not null')), 0, 'NO_COMMENT_IS_HIDDEN_BEFORE_AN_OPERATOR_ACTS_THERE_IS_NO_AUTOMATIC_MODERATION');
  const starsBefore = hashJson(rows('select * from private.agreement_reviews order by id')), reputationBefore = await reputationOf(C.v, C.t.id), factsBefore = {a1: await ratingFacts(C.a1), t: await ratingFacts(C.t)};
  // who may NOT: authenticated (no EXECUTE), anon; the author cannot hide or restore their own text either
  for (const [name, client, anonymous] of [['AUTHENTICATED', C.a1.client, false], ['ANON', anon, true]]) {
    const response = await moderate(client, reviewId, 'HIDE', 'ABUSE_REPORT'); assert.ok(response.error, name); assert.equal(response.error.code, '42501'); assert.match(response.error.message, /permission denied for function rpc_moderate_review_comment_service_v1/);
    assert.ok(lib.statusesFor('42501', {anon: anonymous}).includes(response.status), 'STATUS ' + name + ' ' + response.status);
  }
  assert.equal(commentRows(C.g1.id)[0].hidden_at, null);
  // HIDE
  const hidden = mustOk(await moderate(service, reviewId, 'HIDE', 'ABUSE_REPORT'), 'hide'); assert.deepEqual(hidden, {reviewId, hidden: true, reasonCode: 'ABUSE_REPORT', changed: true, authoritative: true});
  const after = commentRows(C.g1.id)[0]; assert.ok(after.hidden_at); assert.equal(after.hidden_reason_code, 'ABUSE_REPORT');
  const {hidden_at: h1, hidden_reason_code: r1, ...restAfter} = after, {hidden_at: h0, hidden_reason_code: r0, ...restBefore} = review; assert.deepEqual(restAfter, restBefore, 'ONLY_THE_TWO_HIDE_COLUMNS_CHANGED');
  assert.equal(hashJson(rows('select * from private.agreement_reviews order by id')), starsBefore, 'EVERY_STAR_ROW_IS_UNTOUCHED');
  const reputationAfter = await reputationOf(C.v, C.t.id); assert.deepEqual(reputationAfter, reputationBefore, 'THE_COUNT_AND_THE_AVERAGE_DO_NOT_MOVE');
  assert.deepEqual({a1: await ratingFacts(C.a1), t: await ratingFacts(C.t)}, factsBefore, 'THE_RATING_DUE_FACT_DOES_NOT_MOVE');
  assert.ok(!commentsOf(await readerPage(C.v, C.t.profile.WORKER)).includes(text), 'THE_READER_NO_LONGER_LISTS_THE_HIDDEN_TEXT'); assert.ok(commentsOf(await readerPage(C.v, C.t.profile.WORKER)).includes(C.text.c2), 'THE_OTHER_COMMENTS_STAY');
  assert.ok(!commentsOf(await readerPage(C.t, C.t.profile.WORKER)).includes(text), 'NOT_EVEN_THE_REVIEWED_PERSON_SEES_IT');
  assert.equal(mustOk(await contextV2(C.a1, C.g1.id), 'own receipt').review.comment, text, 'THE_AUTHOR_STILL_SEES_THEIR_OWN_TEXT'); assert.equal(mustOk(await submitV2(C.a1, reviewArgs(C.g1, C.a1, {rating: 5, key: commentKeyOf(reviewId), comment: text})), 'replay of the hidden comment').comment, text, 'A_REPLAY_ECHOES_THE_STORED_TEXT');
  // the audit row: ids and the reason code only, never a character of the text, no actor account
  const audits = rows(`select * from private.marketplace_audit_log where entity_id = ${q(C.g1.id)} and event_type = 'AGREEMENT_REVIEW_COMMENT_HIDDEN'`); assert.equal(audits.length, 1);
  assert.deepEqual(Object.keys(audits[0].detail).sort(), ['reasonCode', 'requestId', 'reviewId']); assert.equal(audits[0].detail.reasonCode, 'ABUSE_REPORT'); assert.equal(audits[0].detail.reviewId, reviewId); assert.equal(audits[0].actor_user_id, null); assert.equal(audits[0].entity_type, 'AGREEMENT'); assert.ok(!JSON.stringify(audits[0]).includes(text));
  // idempotent by state: the same action again changes and writes nothing; another reason needs a RESTORE first (PT409, never 40001)
  const again = mustOk(await moderate(service, reviewId, 'HIDE', 'ABUSE_REPORT'), 'hide again'); assert.equal(again.changed, false); assert.equal(Number(sql(`select count(*) from private.marketplace_audit_log where entity_id = ${q(C.g1.id)} and event_type like 'AGREEMENT_REVIEW_COMMENT_%'`)), 1);
  const conflict = await moderate(service, reviewId, 'HIDE', 'OTHER_REASON'); mustRefuse(conflict, 'REVIEW_COMMENT_MODERATION_CONFLICT', 'PT409', 'HIDE_UNDER_ANOTHER_REASON'); assert.equal(conflict.status, 409);
  // RESTORE
  const restored = mustOk(await moderate(service, reviewId, 'RESTORE', null), 'restore'); assert.deepEqual(restored, {reviewId, hidden: false, reasonCode: null, changed: true, authoritative: true});
  assert.equal(commentRows(C.g1.id)[0].hidden_at, null); assert.ok(commentsOf(await readerPage(C.v, C.t.profile.WORKER)).includes(text), 'RESTORED_THE_READER_LISTS_IT_AGAIN');
  assert.equal(mustOk(await moderate(service, reviewId, 'RESTORE', null), 'restore again').changed, false);
  assert.equal(Number(sql(`select count(*) from private.marketplace_audit_log where entity_id = ${q(C.g1.id)} and event_type = 'AGREEMENT_REVIEW_COMMENT_RESTORED'`)), 1);
  assert.deepEqual(await ratingFacts(C.t), factsBefore.t); assert.deepEqual(await reputationOf(C.v, C.t.id), reputationBefore);
  // the OPERATOR PROCEDURE (round-1 finding; owner decision: the owner as operator only in a controlled test, no automatic access): the function demands the SERVICE ROLE. Path A is exactly the call above (PostgREST with the service key, which is
  // never printed). Path B, from a SQL editor as the database owner, needs the claims set in the SAME transaction; a plain session without claims is refused. Both probes are rolled back.
  const viaClaims = tryInTransaction(`${serviceClaims}\nselect public.rpc_moderate_review_comment_service_v1(${q(reviewId)}::uuid, 'HIDE', 'ABUSE_REPORT', ${q(randomUUID())}::uuid)::text;`);
  assert.ok(viaClaims.ok && JSON.parse(viaClaims.out.split(/\r?\n/).pop()).changed === true, 'THE_SQL_EDITOR_PATH_WORKS_WITH_THE_CLAIMS_SET_IN_THE_SAME_TRANSACTION ' + (viaClaims.message ?? viaClaims.out));
  const withoutClaims = tryInTransaction(`select public.rpc_moderate_review_comment_service_v1(${q(reviewId)}::uuid, 'HIDE', 'ABUSE_REPORT', ${q(randomUUID())}::uuid);`);
  assert.equal(withoutClaims.ok, false); assert.equal(withoutClaims.message, 'SERVICE_ROLE_REQUIRED', 'A_PLAIN_OWNER_SESSION_WITHOUT_CLAIMS_IS_REFUSED_BY_THE_FUNCTION');
  assert.equal(commentRows(C.g1.id)[0].hidden_at, null, 'BOTH_OPERATOR_PATH_PROBES_WERE_ROLLED_BACK');
  // refusals by exact name
  for (const [name, args, message, sqlstate] of [['BAD_ACTION', [reviewId, 'DELETE', 'ABUSE'], 'REVIEW_COMMENT_MODERATION_INVALID', '22023'], ['LOWER_CASE_ACTION', [reviewId, 'hide', 'ABUSE'], 'REVIEW_COMMENT_MODERATION_INVALID', '22023'],
    ['HIDE_WITHOUT_REASON', [reviewId, 'HIDE', null], 'REVIEW_COMMENT_MODERATION_INVALID', '22023'], ['LOWER_CASE_REASON', [reviewId, 'HIDE', 'abuse'], 'REVIEW_COMMENT_MODERATION_INVALID', '22023'],
    ['REASON_TOO_LONG', [reviewId, 'HIDE', 'A'.repeat(65)], 'REVIEW_COMMENT_MODERATION_INVALID', '22023'], ['RESTORE_WITH_A_REASON', [reviewId, 'RESTORE', 'ABUSE'], 'REVIEW_COMMENT_MODERATION_INVALID', '22023'],
    ['NO_SUCH_COMMENT', [randomUUID(), 'HIDE', 'ABUSE'], 'REVIEW_COMMENT_NOT_FOUND', 'P0002'], ['NO_REVIEW_ID', [null, 'HIDE', 'ABUSE'], 'REVIEW_COMMENT_MODERATION_INVALID', '22023']])
    mustRefuse(await moderate(service, ...args), message, sqlstate, name);
  mustRefuse(await call(service, 'rpc_moderate_review_comment_service_v1', {p_review_id: reviewId, p_action: 'HIDE', p_reason_code: 'ABUSE', p_client_request_id: null}), 'REVIEW_COMMENT_MODERATION_INVALID', '22023', 'NO_REQUEST_ID');
  assert.equal(commentRows(C.g1.id)[0].hidden_at, null, 'EVERY_REFUSAL_LEFT_THE_COMMENT_VISIBLE');
  assert.equal(Number(sql(`select count(*) from private.marketplace_audit_log where entity_id = ${q(C.g1.id)} and event_type like 'AGREEMENT_REVIEW_COMMENT_%'`)), 2, 'NO_REFUSAL_WROTE_AN_AUDIT_ROW (one HIDDEN and one RESTORED exist)');
  // one comment stays hidden for the export phase: the author must still be able to export their OWN text
  const kept = commentRows(C.g4.id)[0]; mustOk(await moderate(service, kept.review_id, 'HIDE', 'ABUSE_REPORT'), 'hide for the export phase'); state.hiddenComment = {reviewId: kept.review_id, text: C.text.c4, author: C.a1};
  report.phases.moderation = {hide: 'text only', restore: 'text only', auditKeys: ['reasonCode', 'requestId', 'reviewId'], conflict: 'PT409 / HTTP 409', operator: 'service_role only (the owner in a controlled test); no automatic moderation, no notification, no AI'};
}, {needs: ['reader']});

// ==================================================================================================================================================================
// P9 CLOSURE (two REAL closures through the real worker source) and P10 EXPORT
// A closing account is BOTH an author (its own comment is erased through the certified executor, the star row stays) and a subject (the comment ABOUT it is hidden by the reader gates, never erased).
// ==================================================================================================================================================================
const X = {};
const hardBlockers = id => JSON.parse(sql(`select coalesce(to_jsonb(private.closure_erasure_hard_blockers_v5(${q(id)}::uuid)), '[]')`));
const reputationRow = id => JSON.parse(sql(`select private.account_reputation(${q(id)}::uuid)::text`));
/**
 * CHAIN-ONLY FIXTURE (round-1 finding): in a real export the author's text is ALSO stored in private.data_export_artifacts.snapshot_text (and in the data-export-artifacts bucket) for up to the policy lifetime. No export policy exists on the chain,
 * so the row is inserted with the REAL data_export_snapshot() output as its snapshot_text (replica role: the foreign keys to a request and a policy are not enforced; every CHECK, including the sha256/md5 identity of the text, is). No Storage object.
 */
function seedExportArtifact(who) {
  const text = JSON.stringify(exportSnapshot(who.id)), requestId = randomUUID(), assetId = randomUUID(), path = `${who.id}/${requestId}/${assetId}.json`;
  must(`begin; set local session_replication_role = replica;
    insert into private.data_export_artifacts(id, receipt_id, account_id, attempt_number, policy_id, policy_sha256, policy_binding, snapshot_text, byte_length, sha256, md5, object_path, lease_until, artifact_expires_at, snapshot_expires_at, cleanup_not_before, verified_at)
    values (${q(assetId)}, ${q(requestId)}, ${q(who.id)}, 1, ${q(randomUUID())}, ${q('5'.repeat(64))}, '{}', ${q(text)}, octet_length(${q(text)}), encode(extensions.digest(convert_to(${q(text)}, 'UTF8'), 'sha256'), 'hex'), md5(${q(text)}), ${q(path)},
      clock_timestamp() + interval '1 hour', clock_timestamp() + interval '1 hour', clock_timestamp() + interval '1 hour', clock_timestamp() + interval '1 hour', clock_timestamp());
    commit;`, 'seed a chain-only export artifact for ' + who.label);
  return {assetId, requestId, path, bytes: Buffer.byteLength(text)};
}
/** The audit rows the MODERATION actions of one fixture left behind (ids and a reason code only; entity = the Agreement). */
const moderationAudits = agreementId => rows(`select event_type, actor_user_id, detail from private.marketplace_audit_log where entity_id = ${q(agreementId)} and event_type in (${q(lib.AUDIT_EVENT_TYPES.hide)}, ${q(lib.AUDIT_EVENT_TYPES.restore)}) order by event_type, detail::text`);
async function closureFixture(role) {
  // Round-2 finding (privacy #1): the fixture is DESCRIBED as data (lib.closureFixtureDescription) and the rows it must leave behind are DERIVED from that description (lib.expectedWritesOfClosureFixture): the WORKER fixture moderates the
  // closing author's comment before the closure, which writes one more audit row, so its expected audit count is 3 and the REQUESTER fixture's is 2.
  const description = lib.closureFixtureDescription(role), subjectHidden = lib.subjectIsHidden(description);
  const requester = await person(`close-${role.toLowerCase()}-requester`, {name: 'D12 Zatvara ' + role + ' narucilac'}), worker = await person(`close-${role.toLowerCase()}-worker`, {name: 'D12 Zatvara ' + role + ' radnik'});
  // round-1 finding: notifications are ON for the closure fixtures too (the delivery rows exist either way, but the push preference is on, so a push attempt is what a worker would see)
  await enableNotifications(requester); await enableNotifications(worker);
  const agreement = await completedAgreement(requester, worker, 'closure fixture ' + role), subject = role === 'REQUESTER' ? requester : worker, peer = role === 'REQUESTER' ? worker : requester;
  const subjectText = canaryText('closing author ' + role), peerText = canaryText('peer author ' + role);
  const [subjectSpec, peerSpec] = [description.reviews.find(item => item.author === 'SUBJECT'), description.reviews.find(item => item.author === 'PEER')];
  const own = mustOk(await submitV2(subject, reviewArgs(agreement, subject, {rating: subjectSpec.rating, comment: subjectText})), 'closing author comment'), theirs = mustOk(await submitV2(peer, reviewArgs(agreement, peer, {rating: peerSpec.rating, comment: peerText})), 'peer comment');
  const reviewOf = {SUBJECT: own, PEER: theirs};
  for (const action of description.moderation) mustOk(await moderate(service, reviewOf[action.review].reviewId, action.action, action.reasonCode ?? null), 'fixture moderation ' + action.action + ' of the ' + action.review + ' comment');
  const profileOf = (account, kind) => account.profile[kind];
  return {role, description, expectedWrites: lib.expectedWritesOfClosureFixture(description), subject, peer, agreement, subjectText, peerText, subjectHidden, subjectReviewId: own.reviewId, peerReviewId: theirs.reviewId, subjectProfile: profileOf(subject, role === 'REQUESTER' ? 'REQUESTER' : 'WORKER'), peerProfile: profileOf(peer, role === 'REQUESTER' ? 'WORKER' : 'REQUESTER')};
}
await check('P9_FIXTURE_TWO_CLOSING_ACCOUNTS_EACH_WITH_A_COMPLETED_AGREEMENT_AND_A_CANARY_COMMENT_IN_BOTH_DIRECTIONS', async () => {
  X.REQUESTER = await closureFixture('REQUESTER'); X.WORKER = await closureFixture('WORKER');
  for (const f of [X.REQUESTER, X.WORKER]) {
    assert.deepEqual(hardBlockers(f.subject.id), [], 'NO_CLOSURE_BLOCKER ' + f.role);
    assert.deepEqual(written(f.agreement.id), f.expectedWrites, 'THE_ROWS_THE_FIXTURE_LEFT_BEHIND_ARE_EXACTLY_WHAT_ITS_DESCRIPTION_SAYS ' + f.role + ' (stars, comments, events and audits: the moderated WORKER fixture has one audit row more)');
    // the moderation audit rows: exactly one per applied action, ids and a reason code only, no actor, no text
    f.moderationAuditsBefore = moderationAudits(f.agreement.id); assert.equal(f.moderationAuditsBefore.length, f.description.moderation.length, 'ONE_MODERATION_AUDIT_ROW_PER_APPLIED_ACTION ' + f.role);
    for (const row of f.moderationAuditsBefore) { assert.equal(row.actor_user_id, null, 'THE_MODERATION_ACTOR_IS_THE_SERVICE_ROLE_NO_ACCOUNT'); assert.deepEqual(Object.keys(row.detail).sort(), ['reasonCode', 'requestId', 'reviewId'], 'THE_AUDIT_DETAIL_HOLDS_IDS_AND_A_REASON_CODE_ONLY'); assert.ok(!JSON.stringify(row).includes(f.subjectText) && !JSON.stringify(row).includes(f.peerText), 'THE_MODERATION_AUDIT_ROW_CARRIES_NO_COMMENT_TEXT'); }
    assert.deepEqual(commentsOf(await readerPage(C.v, f.subjectProfile)), [f.peerText], 'BEFORE_THE_COMMENT_ABOUT_THE_SUBJECT_IS_LISTED'); assert.deepEqual(commentsOf(await readerPage(C.v, f.peerProfile)), f.subjectHidden ? [] : [f.subjectText], 'BEFORE_THE_COMMENT_BY_THE_SUBJECT_IS_LISTED_UNLESS_A_MODERATOR_HID_IT');
    // round-1 finding (no-leak evidence): BOTH REVIEW_RECEIVED events of this Agreement, with their IN_APP and PUSH delivery rows, exist BEFORE the closure and carry no text; the peer's delivery is addressed to the CLOSING account (the closure patch deletes it),
    // so only a scan BEFORE the closure can see a leak into it.
    const events = rows(`select id from public.user_activity_events where entity_id = ${q(f.agreement.id)} and event_type = 'REVIEW_RECEIVED' order by id`); assert.equal(events.length, 2, 'TWO_REVIEW_RECEIVED_EVENTS ' + f.role);
    for (const event of events) {
      const deliveries = rows(`select channel, state, title, body, dedupe_key from public.notification_deliveries where event_id = ${q(event.id)} order by channel`); assert.deepEqual(deliveries.map(item => item.channel), ['IN_APP', 'PUSH'], 'EVERY_EVENT_HAS_ITS_DELIVERY_ROWS_SO_THE_DELIVERY_SCAN_IS_NOT_VACUOUS ' + f.role);
      for (const item of deliveries) for (const text of [f.subjectText, f.peerText]) assert.ok(!JSON.stringify(item).includes(text), 'A_DELIVERY_ROW_CARRIES_NO_COMMENT_TEXT');
    }
    f.artifact = seedExportArtifact(f.subject);
    // EXACT hits (not "includes"): the closing author's text is in the comment table AND in its own export artifact, nowhere else; the peer's text is in the comment table only (the export never carries received text)
    f.hitsBefore = canaryHits(f.subjectText); assert.deepEqual(f.hitsBefore, [lib.TABLE + ':1', 'private.data_export_artifacts:1'], 'POSITIVE_CONTROL_AND_NO_OTHER_COPY_BEFORE_THE_CLOSURE ' + f.role);
    assertOnlyInTheCommentTable(f.peerText, 'the peer text before the closure ' + f.role);
    f.starsBefore = starRows(f.agreement.id); f.reputationBefore = {subject: reputationRow(f.subject.id), peer: reputationRow(f.peer.id)}; assert.equal(f.reputationBefore.subject.reviewCount, 1); assert.equal(f.reputationBefore.peer.reviewCount, 1);
  }
  state.closureFixtures = true;
  report.notVerified.push('The Storage object contents of an export artifact (the data-export-artifacts bucket) are not exercised: the artifact row with its snapshot_text is a CHAIN-ONLY fixture without a Storage object, so the ERASURE_STORAGE_NOT_CLEAN branch was not hit.');
  report.notVerified.push('Author closure of a PROTECTED Agreement (a completed Agreement with an open problem or a safety report) is not exercised: the claim that the comment is erased even then rests on the reading of the DEV bodies (the DELETE branch of closure_redaction_patch_v5 has no protection test; the Auth step is what the scoped-evidence exception holds), not on a run.');
}, {needs: ['applied', 'reader']});

await check('P10_EXPORT_CARRIES_THE_AUTHORS_OWN_COMMENT_ONLY_NEVER_RECEIVED_TEXT_THE_DATASET_COUNT_STAYS_52_AND_THE_PROJECTION_MOVED_AS_DESIGNED', async () => {
  const catalog = exportCatalog(), entry = catalog.find(item => item.key === 'ownAgreementReviews');
  assert.equal(catalog.length, 52); assert.equal(new Set(catalog.map(item => item.key)).size, 52); assert.deepEqual(entry.fields, ['agreementId', 'createdAt', 'id', 'rating', 'tags', 'comment']); assert.equal(entry.dataClass, 'AGREEMENT_REVIEWS'); assert.equal(typeof entry.ownershipFilter, 'string');
  const f = X.REQUESTER, mine = exportSnapshot(f.subject.id), theirs = exportSnapshot(f.peer.id);
  assert.equal(mine.projectionVersion, 'OWN_ACCOUNT_V5_10', 'THE_PROJECTION_VERSION_MOVED'); assert.equal(theirs.projectionVersion, 'OWN_ACCOUNT_V5_10');
  const mineRows = mine.datasets.ownAgreementReviews, theirRows = theirs.datasets.ownAgreementReviews; assert.equal(mineRows.length, 1); assert.equal(theirRows.length, 1);
  assert.deepEqual(Object.keys(mineRows[0]).sort(), [...entry.fields].sort(), 'THE_ROW_CARRIES_EXACTLY_THE_CATALOG_FIELDS_NO_MODERATION_STATE_NO_HASH_NO_ACCOUNT_ID');
  assert.equal(mineRows[0].comment, f.subjectText); assert.equal(mineRows[0].id, f.subjectReviewId); assert.equal(mineRows[0].agreementId, f.agreement.id); assert.equal(mineRows[0].rating, 5); assert.equal(theirRows[0].comment, f.peerText);
  assert.ok(!JSON.stringify(mine).includes(f.peerText), 'A_COMMENT_RECEIVED_ABOUT_ME_IS_NEVER_EXPORTED_IT_IS_THE_AUTHORS_DATA'); assert.ok(!JSON.stringify(theirs).includes(f.subjectText));
  // every row an account WROTE: the stored comment or null (a star-only review exports comment: null); the hidden own comment is still the author's own text
  const rqSnap = exportSnapshot(P.rq.id).datasets.ownAgreementReviews, rqDb = rows(`select r.id, c.comment from private.agreement_reviews r left join private.agreement_review_comments_v1 c on c.review_id = r.id where r.reviewer_account_id = ${q(P.rq.id)} order by r.id`);
  assert.deepEqual(rqSnap.map(row => [row.id, row.comment]).sort(), rqDb.map(row => [row.id, row.comment]).sort(), 'THE_EXPORT_EQUALS_THE_DATABASE_ROW_FOR_ROW'); assert.ok(rqSnap.some(row => row.comment === null) && rqSnap.some(row => row.comment !== null), 'BOTH_STAR_ONLY_AND_COMMENTED_ROWS_ARE_PRESENT');
  const a1Snap = exportSnapshot(C.a1.id).datasets.ownAgreementReviews; assert.ok(a1Snap.some(row => row.comment === state.hiddenComment.text), 'A_HIDDEN_COMMENT_IS_STILL_EXPORTED_TO_ITS_AUTHOR'); assert.ok(a1Snap.every(row => !('hiddenAt' in row) && !('hidden' in row)));
  const tSnap = exportSnapshot(C.t.id); assert.deepEqual(tSnap.datasets.ownAgreementReviews, []); for (const text of [C.text.c1, C.text.c2]) assert.ok(!JSON.stringify(tSnap).includes(text), 'THE_SUBJECT_EXPORT_HAS_NONE_OF_THE_RECEIVED_TEXT');
  // the sources: the snapshot and the policy binding carry the new projection version only, the binding still demands 52 datasets, and the projection sha moved to the designed value
  const snapshotSource = sql(`select prosrc from pg_proc where oid = ${q(lib.SIG.exportSnapshot)}::regprocedure`), bindingSource = sql(`select prosrc from pg_proc where oid = ${q(lib.SIG.exportBinding)}::regprocedure`);
  for (const source of [snapshotSource, bindingSource]) { assert.ok(source.includes("'OWN_ACCOUNT_V5_10'")); assert.ok(!source.includes("'OWN_ACCOUNT_V5_9'")); }
  assert.ok(bindingSource.includes('<>52'), 'THE_BINDING_STILL_DEMANDS_52_DATASETS'); assert.ok(snapshotSource.includes('private.agreement_review_comments_v1'));
  const shas = [...state.variants.application.matchAll(/data_export_projection_sha_v5\(\) is distinct from '([0-9a-f]{64})'/g)].map(match => match[1]); assert.equal(shas.length, 2); const [shaBefore, shaAfter] = shas;
  const projection = sql('select private.data_export_projection_sha_v5()'); assert.equal(projection, shaAfter, 'THE_PROJECTION_SHA_IS_THE_DESIGNED_VALUE'); assert.notEqual(projection, shaBefore);
  report.phases.export = {datasets: catalog.length, fields: entry.fields, projectionVersion: mine.projectionVersion, projectionShaBeforeMatchesTheDevValue: state.chainFacts.projection_sha === shaBefore, projectionShaAfter: shaAfter, policyBinding: 'NOT EXERCISED: no published retention policy on the chain (export cannot run, as on DEV); the snapshot function was called directly with a synthetic binding'};
  report.notVerified.push('A published export policy bound to the NEW projectionSha256 and the rejection of a stale sha: no policy exists on the chain or on DEV (binding is NULL), so only the snapshot and the sources are proved.');
}, {needs: ['closureFixtures', 'hiddenComment', 'reader']});

for (const role of ['REQUESTER', 'WORKER']) {
  await check(`P9_${role}_FULL_CANONICAL_CLOSURE_ERASES_THE_OWN_COMMENT_THROUGH_THE_CERTIFIED_EXECUTOR_KEEPS_THE_STAR_ROWS_AND_HIDES_THE_COMMENT_ABOUT_THE_SUBJECT_WITHOUT_ERASING_IT`, async () => {
    const f = X[role], result = await closeAccount(f.subject), {closed} = result;
    assert.equal(result.total, 76, 'THE_ROSTER_HAS_76_STEPS'); assert.equal(closed.state, 'CLOSED');
    const steps = rows(`select relation_name, state, affected_rows from private.closure_redaction_steps_v5 where generation = ${q(result.started.generation)} order by ordinal`);
    assert.equal(steps.length, 76); assert.ok(steps.every(step => step.state === 'VERIFIED'), 'EVERY_STEP_IS_VERIFIED'); assert.deepEqual(steps.at(-1), {relation_name: lib.TABLE, state: 'VERIFIED', affected_rows: 1}, 'THE_NEW_RELATION_IS_THE_LAST_STEP_AND_DELETED_EXACTLY_THE_AUTHORS_ONE_ROW');
    assert.equal(sql('select count(*) from private.closure_redaction_certificate_v5'), '0', 'THE_EXECUTOR_CERTIFICATES_ARE_CONSUMED');
    // the author side: the comment row is gone, the canary is nowhere, the star row is byte-identical
    const remaining = commentRows(f.agreement.id); assert.equal(remaining.length, 1, 'ONLY_THE_COMMENT_ABOUT_THE_CLOSED_ACCOUNT_REMAINS'); assert.equal(remaining[0].author_account_id, f.peer.id); assert.equal(remaining[0].comment, f.peerText); assert.equal(remaining[0].hidden_at, null);
    assert.deepEqual(canaryHits(f.subjectText), [], 'THE_CANARY_OF_THE_CLOSING_AUTHOR_IS_ABSENT_FROM_EVERY_TABLE_INCLUDING_ITS_EXPORT_ARTIFACT_COPY');
    // round-1 finding: the export-artifact copy of the author's text is erased by the SAME closure (its own roster step deleted the one artifact row), and a comment a moderator had HIDDEN is erased like any other
    const artifactStep = steps.find(step => step.relation_name === 'private.data_export_artifacts'); assert.ok(artifactStep && artifactStep.state === 'VERIFIED' && artifactStep.affected_rows === 1, 'THE_EXPORT_ARTIFACT_STEP_DELETED_THE_ONE_ARTIFACT_ROW ' + JSON.stringify(artifactStep));
    assert.equal(sql(`select count(*) from private.data_export_artifacts where account_id = ${q(f.subject.id)}`), '0', 'NO_EXPORT_ARTIFACT_OF_THE_CLOSED_ACCOUNT_REMAINS');
    assert.equal(sql(`select count(*) from private.agreement_review_comments_v1 where author_account_id = ${q(f.subject.id)}`), '0', 'THE_AUTHORS_COMMENT_IS_GONE_HIDDEN_OR_NOT ' + (f.subjectHidden ? '(it WAS hidden)' : '(it was visible)'));
    // the moderation audit row is NOT erased by the author's closure (README item 8: pseudonymous, ids and a reason code; its scope is the actor and the Needs/responses of the closing account, and its actor is empty): unchanged, still without any text
    assert.deepEqual(moderationAudits(f.agreement.id), f.moderationAuditsBefore, 'THE_MODERATION_AUDIT_ROWS_ARE_UNCHANGED_BY_THE_AUTHORS_CLOSURE ' + f.role);
    assert.deepEqual(starRows(f.agreement.id), f.starsBefore, 'EVERY_STAR_ROW_IS_BYTE_IDENTICAL_THE_PSEUDONYMOUS_MINIMUM_STAYS');
    assert.deepEqual({subject: reputationRow(f.subject.id), peer: reputationRow(f.peer.id)}, f.reputationBefore, 'COUNT_AND_AVERAGE_OF_BOTH_SIDES_ARE_UNCHANGED');
    // the subject side: the comment ABOUT the closed account is hidden at read time and NOT erased
    assertOnlyInTheCommentTable(f.peerText, 'THE_COMMENT_ABOUT_THE_CLOSED_ACCOUNT_IS_RETAINED_IN_THE_COMMENT_TABLE_ONLY (owner default: hidden by the reader gates, retained, no period set)');
    const readSubject = await readerPage(C.v, f.subjectProfile); assert.equal(readSubject.error, null); assert.equal(readSubject.data, null, 'THE_CLOSED_SUBJECT_READS_AS_NOTHING_HERE'); assert.deepEqual(commentsOf(await readerPage(C.v, f.peerProfile)), [], 'THE_ERASED_COMMENT_IS_NOT_LISTED_ABOUT_THE_PEER');
    assert.equal(mustOk(await contextV2(f.peer, f.agreement.id), 'peer receipt after the closure').review.comment, f.peerText, 'THE_COUNTERPARTS_OWN_COMMENT_STAYS_IN_THEIR_RECEIPT');
    assert.equal(sql(`select deleted_at is not null from auth.users where id = ${q(f.subject.id)}`), 't'); assert.equal(sql(`select count(*) from auth.sessions where user_id = ${q(f.subject.id)}`), '0');
    assert.equal(hashJson(snapshot()), hashJson(state.snapshotAfter), 'THE_COMPLETE_CATALOG_AND_THE_CERTIFICATE_ARE_UNCHANGED_BY_THE_CLOSURE'); assert.ok(certificateConsistent(closureState()));
    report.phases.closure = {...report.phases.closure, [role]: {steps: steps.length, calls: result.calls, authorCommentErased: true, authorCommentWasHiddenBeforeTheClosure: f.subjectHidden, exportArtifactCopyErased: true, starRowsIdentical: true, subjectCommentRetainedAndHidden: true, canaryAbsentFromEveryTable: true, exceptions: closed.exceptions ?? [], workerRequests: {...workerCalls}}};
  }, {needs: ['closureFixtures']});
}

// ==================================================================================================================================================================
// P11 CERTIFICATE: the digest moved because of the certified surface ONLY (isolation, both halves), later drift fails closed, a closure ran after the application (P9)
// ==================================================================================================================================================================
const preDefinitions = Object.fromEntries(preimage.functions.map(item => [item.signature, item.definition]));
// Round-1 finding: P11 was ONE check, so one failing assertion hid the whole drift matrix. It is split into four independent checks.
const restoreOf = signatures => signatures.map(signature => { assert.ok(preDefinitions[signature], 'PRE_IMAGE_DEFINITION ' + signature); return preDefinitions[signature] + ';'; }).join('\n');
const digestAfter = statements => { const result = psql('begin;\n' + statements + '\nselect private.closure_source_digest_v5();\nrollback;'); assert.ok(result.ok, 'PROBE_RAN ' + (result.message ?? result.stderr)); return result.stdout.split(/\r?\n/).pop(); };
await check('P11A_THE_DIGEST_MOVED_BECAUSE_OF_THE_CERTIFIED_SURFACE_ONLY_UNDOING_ONLY_THAT_SURFACE_RETURNS_THE_OLD_VALUE_AND_NEITHER_HALF_ALONE_DOES', async () => {
  const old = state.closureBefore.live, now = state.closureAfter.live, threeFunctions = [lib.SIG.relations, lib.SIG.scope, lib.SIG.patch];
  assert.equal(digestAfter(''), now, 'CONTROL_NO_CHANGE_GIVES_THE_CURRENT_DIGEST');
  // the application's own probe, replayed from the outside: the three certified definitions are restored FIRST, then the table is dropped (the only order that does not raise)
  assert.equal(digestAfter(restoreOf(threeFunctions) + `\ndrop table ${lib.TABLE};`), old, 'ISOLATION_UNDOING_ONLY_THE_CERTIFIED_SURFACE_RETURNS_THE_OLD_CERTIFIED_VALUE');
  // half 1: the three definitions restored, the table KEPT (an unreviewed table moves the digest)
  const half1 = digestAfter(restoreOf(threeFunctions)); assert.notEqual(half1, old, 'HALF_1_FUNCTIONS_RESTORED_TABLE_KEPT_DOES_NOT_RETURN_THE_OLD_VALUE'); assert.notEqual(half1, now, 'HALF_1_MOVES_THE_VALUE');
  // half 2 (the round-1 fix): restore ONLY the roster function, then drop the table. The scope and the patch stay rewritten, so the digest is neither the old value nor the current one, and (the roster no longer naming the table) nothing raises.
  const half2 = digestAfter(restoreOf([lib.SIG.relations]) + `\ndrop table ${lib.TABLE};`); assert.notEqual(half2, old, 'HALF_2_ROSTER_RESTORED_TABLE_DROPPED_DOES_NOT_RETURN_THE_OLD_VALUE'); assert.notEqual(half2, now, 'HALF_2_MOVES_THE_VALUE'); assert.notEqual(half2, half1);
  report.phases.certificate = {...report.phases.certificate, isolationProbe: 'old digest returned when ONLY the certified surface is undone (functions first, then the table); each half alone moves it to a third value'};
}, {needs: ['applied', 'closureAfter']});

await check('P11B_DROPPING_THE_TABLE_WHILE_THE_ROSTER_STILL_NAMES_IT_MAKES_THE_DIGEST_RAISE_42P01_A_DOCUMENTED_FAIL_CLOSED_PROPERTY', async () => {
  const result = psql(`begin;\ndrop table ${lib.TABLE};\nselect private.closure_source_digest_v5();\nrollback;`);
  assert.equal(result.ok, false, 'THE_DIGEST_CANNOT_BE_COMPUTED_FOR_A_ROSTER_THAT_NAMES_A_MISSING_RELATION'); assert.equal(result.sqlstate, '42P01', 'UNDEFINED_TABLE ' + result.message);
  assert.ok(tableExists(), 'THE_PROBE_WAS_ROLLED_BACK');
  report.phases.certificate = {...report.phases.certificate, rosterNamingAMissingTable: 'the digest raises 42P01 (the certificate cannot be bound to a state the roster contradicts): fail closed'};
}, {needs: ['applied', 'closureAfter']});

await check('P11C_OUTSIDE_THE_CERTIFICATE_THE_READERS_COST_AND_AN_INDEX_DO_NOT_MOVE_THE_DIGEST_STATED_NOT_BLESSED', async () => {
  const now = state.closureAfter.live;
  assert.equal(digestAfter(`alter function ${lib.SIG.reader} cost 4321;`), now, 'A_NON_CERTIFIED_FUNCTION_IS_OUTSIDE_THE_DIGEST');
  assert.equal(digestAfter(`drop index private.${lib.TABLE_NAME}_target_idx;`), now, 'INDEXES_ARE_OUTSIDE_THE_DIGEST');
  report.residuals.push({id: 'certificate_does_not_cover_indexes_or_the_new_non_certified_functions', observed: 'DIGEST_UNCHANGED_BY_DROPPING_THE_TARGET_INDEX_OR_ALTERING_THE_READER', note: 'by design of the closure digest (the 88 pinned functions, tables, columns, constraints, triggers, ACL and RLS); the postflight pins the functions and the index by name'});
}, {needs: ['applied', 'closureAfter']});

const readinessAfter = statements => { const result = psql('begin;\n' + statements + "\nselect private.retention_ai_source_ready()::text || ':' || (private.closure_erasure_binding_v5() is null)::text;\nrollback;"); assert.ok(result.ok, 'DRIFT_PROBE_RAN ' + (result.message ?? result.stderr)); return result.stdout.split(/\r?\n/).pop(); };
await check('P11D_EVERY_LATER_DRIFT_OF_THE_CERTIFIED_SURFACE_FAILS_CLOSED_AND_A_CLOSURE_RAN_AFTER_THE_APPLICATION', async () => {
  const drifts = [
    ['TRIGGER_FUNCTION_BODY_CHANGED', `do $d$ declare d text := pg_get_functiondef(${q(lib.SIG.guard)}::regprocedure); begin if position('REVIEW_COMMENT_IMMUTABLE' in d) = 0 then raise exception 'ANCHOR'; end if; execute replace(d, 'REVIEW_COMMENT_IMMUTABLE', 'REVIEW_COMMENT_IMMUTABLE_'); end $d$`],
    ['MUTATION_TRIGGER_DISABLED', `alter table ${lib.TABLE} disable trigger ${lib.TRIGGERS[1]}`], ['CLOSURE_TRIGGER_DISABLED', `alter table ${lib.TABLE} disable trigger ${lib.TRIGGERS[0]}`],
    ['TABLE_MADE_CLIENT_READABLE', `grant select on ${lib.TABLE} to authenticated`], ['FORCE_RLS_REMOVED', `alter table ${lib.TABLE} no force row level security`], ['COLUMN_ADDED', `alter table ${lib.TABLE} add column d12_extra text`],
    ['CONSTRAINT_DROPPED', `alter table ${lib.TABLE} drop constraint ${lib.TABLE_NAME}_text_chars_check`],
    ['CERTIFIED_FUNCTION_AUTHORITY_CHANGED', `alter function ${lib.SIG.scope} set search_path = public`],
    ['CERTIFIED_FUNCTION_BODY_CHANGED', `do $d$ declare d text := pg_get_functiondef(${q(lib.SIG.scope)}::regprocedure); begin if position('t.author_account_id=$1' in d) = 0 then raise exception 'ANCHOR'; end if; execute replace(d, 't.author_account_id=$1', 't.author_account_id=$1 or true'); end $d$`],
    ['UNREVIEWED_TABLE', 'create table private.d12_later_source(id integer)'],
  ];
  const drifted = [];
  const readiness = readinessAfter;
  assert.equal(readiness(''), 'true:false', 'CONTROL_THE_CERTIFICATE_IS_READY_AND_BOUND');
  for (const [name, change] of drifts) { assert.equal(readiness(change + ';'), 'false:true', 'DRIFT_NOT_DETECTED ' + name); drifted.push(name); }
  assert.deepEqual(closureState(), state.closureAfter, 'EVERY_DRIFT_PROBE_WAS_ROLLED_BACK'); assert.ok(certificateConsistent(closureState()));
  report.phases.certificate = {...report.phases.certificate, driftFailsClosed: drifted, closureAfterTheApplication: 'two full closures ran through the real worker after the application (P9)'};
}, {needs: ['applied', 'closureAfter']});

await check('P11E_A_POLICY_ADDED_TO_THE_COMMENT_TABLE_IS_OUTSIDE_THE_CERTIFICATE_GRANTS_NOTHING_BY_ITSELF_AND_THE_POSTFLIGHT_NAMES_IT_A_KNOWN_LIMIT_STATED_NOT_BLESSED', async () => {
  // Round-2 finding (certificate #2): the closure digest covers the columns, constraints and triggers of every table of public and private, the owner / ACL / row-security flags of those tables, the trigger state and 88 functions; it does NOT cover
  // pg_policy of a private table (read on DEV 2026-10-02 in closure_schema_digest_v5_139 and closure_erasure_program_digest_v5; no body of the digest mentions pg_policy). So a permissive policy does NOT make the certificate drift: it is stated here, not blessed.
  const policy = `create policy d12_open on ${lib.TABLE} for select to authenticated using (true)`, now = state.closureAfter;
  assert.equal(readinessAfter(policy + ';'), 'true:false', 'A_POLICY_DOES_NOT_MOVE_THE_DIGEST (the certificate stays ready and bound): the known limit');
  // what holds the line instead: the table has NO client grant (the digest covers the ACL), so even a permissive policy lets an authenticated session read nothing: permission denied for table
  const read = tryInTransaction(`${policy};\nset local role authenticated;\nselect count(*) from ${lib.TABLE};`); assert.equal(read.ok, false, 'THE_PERMISSIVE_POLICY_ALONE_EXPOSES_NOTHING'); assert.equal(read.sqlstate, '42501', 'PERMISSION_DENIED_FOR_THE_TABLE ' + read.message);
  // ... and the read-only postflight names it (the table shape check demands zero policies), so the owner's own check finds it
  const flight = JSON.parse(must('begin;\n' + policy + ';\n' + state.variants.postflight + '\nrollback;', 'postflight with a policy on the comment table'));
  assert.ok(flight.problems.some(item => item.kind === 'COMMENT_TABLE_DRIFT'), 'THE_POSTFLIGHT_REPORTS_A_POLICY_ON_THE_COMMENT_TABLE ' + JSON.stringify(flight.problems)); assert.equal(flight.ready, true, 'while the certificate itself still reads ready');
  assert.equal(sql(`select count(*) from pg_policies where schemaname = 'private' and tablename = ${q(lib.TABLE_NAME)}`), '0', 'EVERY_PROBE_WAS_ROLLED_BACK'); assert.deepEqual(closureState(), now);
  report.residuals.push({id: 'certificate_does_not_cover_policies_of_the_comment_table', observed: 'READINESS_STAYS_TRUE_AND_BOUND_WITH_A_PERMISSIVE_POLICY', note: 'a policy on a private table is outside the closure digest; the lines that hold are: no client table GRANT (covered by the digest through the ACL), forced RLS (covered), and the postflight COMMENT_TABLE_DRIFT predicate (pg_policies = 0)'});
  report.phases.certificate = {...report.phases.certificate, policyOnTheCommentTable: 'outside the digest (known limit); exposes nothing without a GRANT; named by the postflight (COMMENT_TABLE_DRIFT)'};
}, {needs: ['applied', 'closureAfter']});

// ==================================================================================================================================================================
// P12 REVERT: refused while a comment exists, byte-for-byte restore, certificate back, old clients unaffected, a REAPPLY reproduces the surface
// ==================================================================================================================================================================
const refuseRevert = (name, script, pattern, pre = '') => {
  const before = hashJson(snapshot()), result = psql('begin;\n' + pre + '\n' + script + '\nrollback;', {timeoutMs: 240000});
  assert.equal(result.ok, false, 'EXPECTED_REFUSAL:' + name + ' (the revert ran to the end and was rolled back)'); assert.ok(pattern.test(String(result.message)), `REFUSAL_NAME:${name} expected ${pattern} got ${result.message ?? result.stderr}`);
  assert.equal(result.sqlstate, '55000', 'REFUSAL_SQLSTATE:' + name); assert.equal(hashJson(snapshot()), before, 'CATALOG_CHANGED_BY_REFUSAL:' + name);
  report.refusals.push({phase: 'REVERT', name, message: result.message, sqlstate: result.sqlstate, completeCatalogUnchanged: true});
};
const commentCount = () => Number(sql('select count(*) from private.agreement_review_comments_v1'));
await check('P12_THE_REVERT_REFUSES_WHILE_A_COMMENT_EXISTS_OR_A_CLOSURE_EXECUTES_AND_CHANGES_NOTHING', async () => {
  const generatedPath = PUBLIC + '/d12_revert.generated.sql';
  execFileSync('python3', [GENERATOR, '--revert-digest', state.closureBefore.live, '--revert-out', generatedPath], {encoding: 'utf8'});
  const generated = readFileSync(generatedPath, 'utf8'), devDigest = /target_source constant text := '([0-9a-f]{64})'/.exec(original.revert)[1];
  assert.equal(generated.split(state.closureBefore.live).join(devDigest), original.revert, 'THE_CHAIN_REVERT_DIFFERS_FROM_THE_COMMITTED_ONE_ONLY_IN_THE_DIGEST_IT_RESTORES');
  const variant = pins.buildChainVariant(generated, state.gate, {requireFound: true}); assert.ok(pins.variantDiffersOnlyAtPins(generated, variant.text, variant.applied));
  const path = PUBLIC + '/d12_revert.chain.sql'; writeFileSync(path, variant.text); const guardedRevert = wrapFile(path, PUBLIC + '/d12_revert.chain.guarded.sql');
  state.revert = {text: variant.text, path, sha256: sha256(variant.text), guarded: guardedRevert.text};
  if (state.exactBytes) { assert.equal(sha256(generated.split(state.closureBefore.live).join(devDigest)), state.manifest.files[REVERT].sha256, 'THE_CHAIN_REVERT_IS_THE_COMMITTED_REVERT_EXCEPT_THE_DIGEST'); }
  report.candidate.revertChainVariant = {sha256: state.revert.sha256, restoresDigestPrefix: state.closureBefore.live.slice(0, 12), replacedAdjacentPins: variant.applied.filter(item => item.replaced > 0).map(({signature, kind, replaced}) => ({signature, kind, replaced}))};
  assert.ok(commentCount() > 0, 'COMMENTS_EXIST_AT_THIS_POINT');
  refuseRevert('COMMENTS_PRESENT', state.revert.text, /^D12_REVERT_COMMENTS_PRESENT$/);
  const throwaway = await person('throwaway-revert'), inFlight = await closeAccount(throwaway, {stopAfterStart: true});
  refuseRevert('CLOSURE_IN_FLIGHT', state.revert.text, /^D12_REVERT_CLOSURE_IN_FLIGHT$/);
  assert.equal((await finishClosure(throwaway, inFlight.started)).state, 'CLOSED');
}, {needs: ['applied', 'gate', 'closureBefore']});

await check('P12_THE_REVERT_RESTORES_EVERY_PIN_AND_THE_CERTIFICATE_BYTE_FOR_BYTE_OLD_CLIENTS_ARE_UNAFFECTED_AND_A_REAPPLY_REPRODUCES_THE_SURFACE', async () => {
  // CHAIN-ONLY FIXTURE: the revert refuses while any comment exists, so the remaining rows are removed with triggers off (the certified delete path is proved in P9)
  const count = commentCount(); assert.ok(count > 0); must('begin; set local session_replication_role = replica; delete from private.agreement_review_comments_v1; commit;', 'chain-only removal of the comment rows'); assert.equal(commentCount(), 0);
  // round-1 finding: the revert window ends at the FIRST CLOSURE too. Every closure after the application wrote one step that NAMES the comment table; with no comment row left, the revert must STILL refuse until that history is gone.
  const history = Number(sql(`select count(*) from private.closure_redaction_steps_v5 where relation_name = ${q(lib.TABLE)}`)); assert.ok(history >= 3, 'CLOSURE_HISTORY_NAMES_THE_TABLE_AFTER_THE_REAL_CLOSURES (found ' + history + ')');
  refuseRevert('CLOSURE_HISTORY_PRESENT', state.revert.text, /^D12_REVERT_CLOSURE_HISTORY_PRESENT$/);
  must(`begin; set local session_replication_role = replica; delete from private.closure_redaction_steps_v5 where relation_name = ${q(lib.TABLE)}; commit;`, 'chain-only removal of the closure history that names the comment table'); assert.equal(Number(sql(`select count(*) from private.closure_redaction_steps_v5 where relation_name = ${q(lib.TABLE)}`)), 0);
  report.phases.revert = {commentRowsRemovedByTheChainOnlyFixture: count, closureHistoryRowsRemovedByTheChainOnlyFixture: history};
  refuseRevert('CERTIFICATES_DISAGREE', state.revert.text, /^D12_REVERT_APPLIED_STATE_NOT_CERTIFIED$/, "update private.closure_erasure_source_v5 set sha256 = repeat('0', 64) where singleton;");
  refuseRevert('A_NEW_FUNCTION_WAS_TAMPERED_WITH', state.revert.text, /^D12_REVERT_NEW_FUNCTION_DRIFT: /, `do $t$ declare d text := pg_get_functiondef(${q(lib.SIG.reader)}::regprocedure); begin if position('authoritative' in d) = 0 then raise exception 'ANCHOR'; end if; execute replace(d, 'authoritative', 'authoritative2'); end $t$;`);
  refuseRevert('THE_RETENTION_CLASS_TEXT_WAS_TAMPERED_WITH', state.revert.text, /^D12_REVERT_RETENTION_CLASS_DRIFT$/, "update private.retention_data_classes set description = description || ' ' where code = 'AGREEMENT_REVIEWS';");
  refuseRevert('A_REWRITTEN_BODY_WAS_TAMPERED_WITH', state.revert.text, /^D12_REVERT_APPLIED_BODY_DRIFT: /, `do $t$ declare d text := pg_get_functiondef(${q(lib.SIG.exportBinding)}::regprocedure); begin if position('OWN_ACCOUNT_V5_10' in d) = 0 then raise exception 'ANCHOR'; end if; execute replace(d, 'OWN_ACCOUNT_V5_10', 'OWN_ACCOUNT_V5_10 '); end $t$;`);
  const started = Date.now(), result = psqlCommand(state.revert.guarded); assert.ok(result.ok, 'REVERT_APPLIED_BEHIND_THE_INTEGRITY_GUARD: ' + (result.message ?? result.stderr)); report.phases.revert.revertMilliseconds = Date.now() - started;
  for (let attempt = 0; attempt < 60; attempt++) { const probe = await settle('rpc_get_my_agreement_review_v2', () => P.rq.client.rpc('rpc_get_my_agreement_review_v2', {p_agreement_id: randomUUID()})); if (probe.error?.code === 'PGRST202') break; await sleep(500); }
  assert.deepEqual(surface(), state.surfaceBefore, 'THE_WHOLE_CATALOG_SURFACE_IS_RESTORED_EXACTLY'); assert.deepEqual(closureState(), state.closureBefore, 'THE_CERTIFICATE_IS_BACK_AT_THE_PRE_APPLICATION_VALUE');
  assert.equal(hashJson(snapshot()), state.preApplySnapshotHash, 'THE_COMPLETE_PLATFORM_SNAPSHOT_IS_THE_PRE_APPLICATION_ONE');
  for (const signature of lib.CHANGED_FUNCTIONS) assert.equal(bodyMd5(signature), state.changedBodiesBefore[signature], 'RESTORED_BYTE_FOR_BYTE ' + signature);
  assert.deepEqual(legacyBodies(), state.legacyBodiesBefore); assert.equal(tableExists(), false); for (const signature of lib.NEW_FUNCTIONS) assert.equal(exists(signature), false, 'REMOVED ' + signature);
  assert.equal(sql(`select count(*) from pg_trigger where tgname = any(array[${lib.TRIGGERS.map(q).join(',')}])`), '0'); assert.equal(roster().length, 75); assert.ok(!roster().includes(lib.TABLE));
  assert.deepEqual(exportCatalog().find(item => item.key === 'ownAgreementReviews').fields, ['agreementId', 'createdAt', 'id', 'rating', 'tags']);
  const flight = JSON.parse(must(state.variants.preflight, 'preflight after the revert')); assert.deepEqual(flight.problems, [], 'EVERY_PREDECESSOR_PIN_OF_THE_APPLICATION_HOLDS_AGAIN ' + JSON.stringify(flight.problems)); assert.equal(flight.metadataPinsChecked > 0 && flight.bodyPinsChecked > 0, true);
  assert.equal(sql("select count(*) || ':' || md5(coalesce(string_agg(id::text || ':' || input_hash, ',' order by id), '')) from private.agreement_reviews").split(':')[1].length, 32, 'THE_STAR_TABLE_IS_THERE');
  assert.deepEqual(rows('select * from private.retention_data_classes order by code'), state.classesBefore, 'THE_RETENTION_CLASS_TEXT_AND_EVERY_OTHER_CLASS_ROW_ARE_BACK_BYTE_FOR_BYTE');
  const again = psqlCommand(state.revert.guarded); assert.equal(again.ok, false); assert.match(String(again.message), /^D12_REVERT_NOT_APPLIED$/);
  // old clients: the legacy flow and the real shipped client keep working on the reverted chain, and a new client's v2 call reads as "not supported" (PGRST202)
  const s = seedAgreement(P.rq, P.wk, {title: 'after the revert'}), receipt = mustOk(await submitLegacy(P.rq, reviewArgs(s, P.rq)), 'legacy after the revert'); assert.equal(receipt.idempotentReplay, false); assert.equal((await submitV2(P.wk, reviewArgs(s, P.wk))).error?.code, 'PGRST202');
  if (state.legacyClientBefore) { const viaClient = await accepted(legacyClient(P.rq).module.reviewsClientService.context(s.id)); assert.equal(viaClient.review.reviewId, receipt.reviewId); }
  // REAPPLY: the same application, the same surface, a self-consistent certificate (the digest may differ: it is OID-dependent, recorded)
  const reapply = psqlCommand(state.variants.guarded); assert.ok(reapply.ok, 'REAPPLY_BEHIND_THE_INTEGRITY_GUARD: ' + (reapply.message ?? reapply.stderr));
  await functionReady(P.rq.client, 'rpc_get_my_agreement_review_v2', {p_agreement_id: randomUUID()}); await functionReady(P.rq.client, 'rpc_list_review_comments_v1', {p_profile_id: randomUUID()});
  assert.deepEqual(surface(), state.surfaceAfter, 'THE_REAPPLIED_SURFACE_EQUALS_THE_FIRST_APPLICATION'); const closureAgain = closureState(); assert.ok(certificateConsistent(closureAgain)); assert.notEqual(closureAgain.live, state.closureBefore.live);
  const flightAgain = JSON.parse(must(state.variants.postflight, 'postflight after the reapply')); assert.deepEqual(flightAgain.problems, []);
  state.closureReapplied = closureAgain; state.surfaceReapplied = surface(); report.phases.revert = {...report.phases.revert, restoredDigestEqualsPreApplication: true, secondRevertRefused: true, reappliedSurfaceEqualsFirstApplication: true, reappliedDigestEqualsFirstApplication: closureAgain.live === state.closureAfter.live,
    note: 'the digest hashes OIDs, so a reapplication may differ from the first application; only self-consistency is asserted'};
  const fresh = seedAgreement(P.rq, P.wk, {title: 'after the reapply'}), text = canaryText('reapplied'); assert.equal(mustOk(await submitV2(P.rq, reviewArgs(fresh, P.rq, {comment: text})), 'v2 after the reapply').comment, text);
  assert.ok(commentsOf(await readerPage(P.o, P.wk.profile.WORKER)).includes(text), 'THE_READER_WORKS_AGAIN'); state.reapplied = true;
}, {needs: ['revert']});

// ==================================================================================================================================================================
// P13 WEAKENING PROBES (runtime non-vacuity): each probe weakens ONE rule by an exact-once anchor edit of the LIVE definition, reads the OBSERVED outcome of the predicate that rule guards (it must flip),
// and restores the definition byte for byte. A probe whose anchor does not match fails the run: a weakening that cannot be applied proves nothing.
// ==================================================================================================================================================================
const fnOutcome = value => observedOf(runMatrix([{id: 'probe', value}])[0].result);
await check('P13_THE_PROOF_TURNS_RED_WHEN_A_RULE_IS_WEAKENED_AND_EVERY_WEAKENED_DEFINITION_IS_RESTORED_BYTE_FOR_BYTE', async () => {
  const fx = {};
  const agreementFx = seedAgreement(P.rq, P.wk, {title: 'probe fixture'}); const own = mustOk(await submitV2(P.rq, reviewArgs(agreementFx, P.rq, {comment: canaryText('probe')})), 'probe fixture comment'); fx.reviewId = own.reviewId;
  const hiddenAg = seedAgreement(C.a3, C.t, {title: 'probe hidden fixture'}); fx.hiddenText = canaryText('probe hidden'); const hiddenReceipt = mustOk(await submitV2(C.a3, reviewArgs(hiddenAg, C.a3, {comment: fx.hiddenText})), 'probe hidden fixture'); mustOk(await moderate(service, hiddenReceipt.reviewId, 'HIDE', 'ABUSE_REPORT'), 'hide the fixture');
  // round-1 blocker probe: a VISIBLE comment by an author about the subject (the earlier fixtures were removed by the chain-only revert fixture)
  const visibleAg = seedAgreement(C.a3, C.t, {title: 'probe visible fixture'}); fx.visibleText = canaryText('probe visible'); mustOk(await submitV2(C.a3, reviewArgs(visibleAg, C.a3, {comment: fx.visibleText})), 'probe visible fixture');
  const refusedWith = (outcome, name, token) => outcome.outcome === 'REFUSED' && outcome.name === name ? {holds: true, observed: 'REFUSED'} : {holds: false, observed: token ?? outcome.outcome + ':' + (outcome.name ?? '')};
  const PREDICATES = {
    CONTACT_FLOOR_REFUSES_A_PHONE: async () => { const outcome = fnOutcome('Zovi 064 123 4567'); return refusedWith(outcome, 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', outcome.outcome === 'ACCEPTED' ? 'ACCEPTED_TEXT' : undefined); },
    FUNCTION_REFUSES_501_CODE_POINTS: async () => { const outcome = fnOutcome('a'.repeat(501)); return refusedWith(outcome, 'REVIEW_COMMENT_TOO_LONG', outcome.outcome === 'ACCEPTED' ? 'ACCEPTED_TEXT' : undefined); },
    FUNCTION_REFUSES_A_RIGHT_TO_LEFT_OVERRIDE: async () => { const outcome = fnOutcome('a\u202Eb'); return refusedWith(outcome, 'REVIEW_COMMENT_INVALID', outcome.outcome === 'ACCEPTED' ? 'ACCEPTED_TEXT' : undefined); },
    FUNCTION_REFUSES_AN_IDEOGRAPHIC_VARIATION_SELECTOR: async () => { const outcome = fnOutcome('a\u{E0100}b'); return refusedWith(outcome, 'REVIEW_COMMENT_INVALID', outcome.outcome === 'ACCEPTED' ? 'ACCEPTED_TEXT' : undefined); },
    A_LONE_VARIATION_SELECTOR_IS_NO_COMMENT: async () => { const outcome = fnOutcome('\uFE00'); return outcome.outcome === 'ABSENT' ? {holds: true, observed: 'ABSENT'} : {holds: false, observed: outcome.outcome === 'REFUSED' ? 'REFUSED:' + outcome.name : outcome.outcome}; },
    NORMALISED_FLOOR_REFUSES_FULLWIDTH_DIGITS: async () => { const outcome = fnOutcome('zovi ' + [...'0641234567'].map(digit => String.fromCodePoint(0xFF10 + Number(digit))).join('')); return refusedWith(outcome, 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', outcome.outcome === 'ACCEPTED' ? 'ACCEPTED_TEXT' : undefined); },
    A_BLOCK_BETWEEN_AUTHOR_AND_SUBJECT_NEVER_CENSORS_A_THIRD_VIEWER: async () => { await blockAccount(C.t, C.a3, true); try { const texts = commentsOf(await readerPage(C.v2, C.t.profile.WORKER)); return texts.includes(fx.visibleText) ? {holds: true, observed: 'LISTED_FOR_THE_THIRD_VIEWER'} : {holds: false, observed: 'COMMENT_CENSORED_FOR_EVERYONE'}; } finally { await blockAccount(C.t, C.a3, false); } },
    AN_ORDINARY_UPDATE_IS_REFUSED: async () => { const result = tryInTransaction(`update ${lib.TABLE} set comment = comment || 'x' where review_id = ${q(fx.reviewId)};`); return result.ok === false && result.message === 'REVIEW_COMMENT_IMMUTABLE' ? {holds: true, observed: 'REFUSED'} : {holds: false, observed: result.ok ? 'UPDATE_SUCCEEDED' : String(result.message)}; },
    AUTHENTICATED_IS_REFUSED_BY_THE_ACL: async () => { const response = await moderate(P.o.client, fx.reviewId, 'HIDE', 'ABUSE_REPORT'); const message = response.error?.message ?? ''; const observed = !response.error ? 'HIDE_SUCCEEDED' : /permission denied for function/.test(message) ? 'REFUSED_BY_THE_ACL' : message === 'SERVICE_ROLE_REQUIRED' ? 'REFUSED_BY_THE_FUNCTION_CHECK' : message === 'REVIEW_COMMENT_IMMUTABLE' ? 'REFUSED_BY_THE_ROW_TRIGGER' : message; return {holds: observed === 'REFUSED_BY_THE_ACL', observed}; },
    A_BLOCKED_VIEWER_SEES_NOTHING: async () => { await blockAccount(C.t, C.v, true); try { const response = await readerPage(C.v, C.t.profile.WORKER); return response.error ? {holds: false, observed: 'ERROR ' + response.error.message} : response.data === null ? {holds: true, observed: 'NULL'} : {holds: false, observed: 'LIST_RETURNED'}; } finally { await blockAccount(C.t, C.v, false); } },
    A_HIDDEN_COMMENT_IS_NOT_LISTED: async () => { const texts = commentsOf(await readerPage(C.v2, C.t.profile.WORKER)); return texts.includes(fx.hiddenText) ? {holds: false, observed: 'HIDDEN_COMMENT_LISTED'} : {holds: true, observed: 'NOT_LISTED'}; },
    A_NOT_COMPLETED_AGREEMENT_IS_REFUSED: async () => { const open = seedAgreement(P.rq, P.wk, {exec: 'CONFIRMED', need: 'ACTIVE', title: 'probe not completed'}); const response = await submitV2(P.rq, reviewArgs(open, P.rq, {comment: canaryText('probe gate')})); return response.error?.message === 'REVIEW_NOT_COMPLETED' ? {holds: true, observed: 'REFUSED'} : {holds: false, observed: response.error ? response.error.message : 'REVIEW_ACCEPTED'}; },
    SAME_KEY_OTHER_COMMENT_IS_REFUSED: async () => { const fresh = seedAgreement(P.rq, P.wk, {title: 'probe reuse'}), key = randomUUID(); mustOk(await submitV2(P.rq, reviewArgs(fresh, P.rq, {key})), 'probe star-only'); const response = await submitV2(P.rq, reviewArgs(fresh, P.rq, {key, comment: canaryText('probe reuse')})); return response.error?.message === 'REQUEST_ID_REUSED' ? {holds: true, observed: 'REFUSED'} : {holds: false, observed: response.error ? response.error.message : 'REPLAY_WITHOUT_ERROR'}; },
    AN_OUTSIDER_IS_REFUSED: async () => { const fresh = seedAgreement(P.rq, P.wk, {title: 'probe outsider'}); const response = await submitV2(P.o, {...reviewArgs(fresh, P.rq), p_target_account_id: P.rq.id, p_comment: canaryText('probe outsider')}); return response.error?.message === 'REVIEW_NOT_ALLOWED' ? {holds: true, observed: 'REFUSED'} : {holds: false, observed: response.error ? response.error.message : 'REVIEW_ACCEPTED'}; },
  };
  const control = {};
  for (const name of [...new Set(lib.WEAKENINGS.map(item => item.predicate))]) { control[name] = await PREDICATES[name](); assert.equal(control[name].holds, true, 'CONTROL_THE_UNWEAKENED_RULE_HOLDS ' + name + ' ' + JSON.stringify(control[name])); }
  const surfaceBefore = surface(), closureBefore = closureState(), outcomes = [];
  for (const probe of lib.WEAKENINGS) {
    const original = sql(`select pg_get_functiondef(to_regprocedure(${q(probe.signature)}))`), md5Before = bodyMd5(probe.signature);
    const edited = probe.edits.length ? lib.applyEdits(original, probe.edits) : {applied: true, reason: 'NO_BODY_EDIT (ACL only)', text: original}; assert.equal(edited.applied, true, `PROBE_NOT_APPLICABLE ${probe.id}: ${edited.reason} (a weakening that cannot be applied proves nothing)`);
    let observed;
    try { if (probe.edits.length) must(edited.text, 'weaken ' + probe.id); if (probe.sqlBefore) must(probe.sqlBefore, 'weaken ACL ' + probe.id); observed = await PREDICATES[probe.predicate](); }
    finally { must(original, 'restore ' + probe.id); if (probe.sqlAfter) must(probe.sqlAfter, 'restore ACL ' + probe.id); }
    assert.equal(bodyMd5(probe.signature), md5Before, 'RESTORED_BYTE_FOR_BYTE ' + probe.id);
    const detected = observed.holds === false && observed.observed === probe.weakened;
    outcomes.push({id: probe.id, guards: probe.guards, predicate: probe.predicate, expectedWeakenedOutcome: probe.weakened, observed: observed.observed, detected});
    assert.equal(detected, true, `PROBE_NOT_DETECTED ${probe.id}: the weakened rule should read "${probe.weakened}", the proof observed ${JSON.stringify(observed)}`);
    assert.equal((await PREDICATES[probe.predicate]()).holds, true, 'AFTER_THE_RESTORE_THE_RULE_HOLDS_AGAIN ' + probe.id);
  }
  assert.deepEqual(surface(), surfaceBefore, 'EVERY_WEAKENED_DEFINITION_AND_ACL_IS_BACK_THE_WHOLE_SURFACE_IS_UNCHANGED'); assert.deepEqual(closureState(), closureBefore, 'THE_CERTIFICATE_IS_BACK'); assert.ok(certificateConsistent(closureState()));
  report.phases.weakening = {control, probes: outcomes, applied: outcomes.length, detected: outcomes.filter(item => item.detected).length};
  report.nonVacuity.push(...outcomes.map(item => `${item.predicate} -> ${item.id}: observed "${item.observed}" (expected "${item.expectedWeakenedOutcome}")`));
}, {needs: ['reapplied']});

// ==================================================================================================================================================================
// the report
// ==================================================================================================================================================================
const STATIC_NON_VACUITY = [
  'ROUND 1 (this round): P0 manifest -> the committed files equal the sha256 manifest (bytes: a CR changes it); the transport-safety scan (no escape text, ASCII only) would have failed the 47 backslash-u escapes of the first candidate',
  'ROUND 1: P2 applies the candidate BEHIND the integrity guard with psql -c (one Query message): a one-character change is refused by the database (GUARD_TEXT_INTEGRITY) before anything runs',
  'ROUND 1: P2 refusals STAR_TABLE_SHAPE_CHANGED / STAR_TABLE_POLICY_ADDED / COMPOSITE_FUNCTION_AUTHORITY_CHANGED / RETENTION_CLASS_TEXT_CHANGED and the three isolation-probe refusals (DIGEST_NOT_ISOLATED twice, PROBE_NOT_ROLLED_BACK) each ran the whole application to the end before the matching guard existed',
  'ROUND 1: P2 postMd5Of picks the POST-STATE pin (the third row), so the five POST_STATE_PIN refusals name D12_APPLICATION_REWRITTEN_BODY_DELTA instead of the metadata drift',
  'ROUND 2: P0 pin gate compares the readiness body MASKED (its certified literal is chain-internal): the first CI run would have been red deterministically with the raw md5; every pin difference is printed at once; D12_PIN_GATE_ONLY=1 stops after the gate',
  'ROUND 2: P4 invisible characters: every forbidden range (all of Default_Ignorable_Code_Point of Unicode 17.0 except four allowed-inside groups, plus the controls) at both ends and in the middle, inside text and alone, and both neighbours; probes W13 (plane 14 narrowed to the tag block) and W14 (variation selectors no longer blank) flip an observed outcome',
  'ROUND 2: P2 the guard accepts the text with or without its final line feed and with a connector trailer, and refuses a changed character, a truncated text and anything before the guard, each with the named error D12_APPLY_TEXT_INTEGRITY',
  'ROUND 2: P9 the closure fixtures are DESCRIBED as data and the rows they leave behind are DERIVED from the description (the moderated WORKER fixture writes one audit row more); the moderation audit row stays after the author closure and carries no text',
  'ROUND 2: P11E states that a policy on the comment table is outside the closure digest (readiness stays true), exposes nothing without a GRANT, and is named by the postflight',
  'ROUND 1: P3/P9 exact-hit scans (the text is in the comment table and in nowhere else; before the closure the delivery rows, the peer text and the export-artifact copy are covered) replace "includes"; a skipped public/private table fails the scan by name',
  'ROUND 1: P4 second wall: the WHOLE matrix is inserted directly as the owner; the function and the CHECKs must agree (a divergence is the only way a CHECK DETAIL could quote a comment)',
  'ROUND 1: P4 invisible/compatibility characters: INVISIBLE_FORBIDDEN refused alone and inside text, INVISIBLE_ALLOWED accepted inside text, ABSENT alone, the contact floor catches full-width and Arabic-Indic digits, soft hyphen / CGJ / ZWNJ splits and the full-width @ (probe W12 removes the normalised copy and the case flips)',
  'ROUND 1: P6 per-viewer block semantics: SUBJECT_BLOCKS_AUTHOR and AUTHOR_BLOCKS_SUBJECT leave the two third viewers unchanged (probe W11 re-introduces the viewer-independent gate and the comment disappears for everyone)',
  'ROUND 1: P9 export-artifact copy (chain-only fixture) is erased by the closure; a comment a moderator HID before the closure is erased too',
  'ROUND 1: P11 split into A-D (the 42P01 property is its own check), P12 refuses on closure history that names the table (the revert window ends at the first closure) and restores the retention class text',
  'P1 FAIL-BEFORE (no table, no v2/reader/moderation function, roster 75, export fields without comment) -> pass the same facts as true after P2: a candidate that creates nothing turns P2 red',
  'P2 refusals (body pin, metadata pin, tampered legacy body, certificates disagree, unreviewed table, object present, post-state pin, closure in flight) -> weaken a pin or a guard in the candidate and the matching refusal runs the whole application to the end and is rolled back (EXPECTED_REFUSAL)',
  'P2 delta (exactly 7 changed + 6 new functions, 24 new table objects) -> any extra or missing object (a stray index, a policy, a seventh function) fails classifySurfaceDelta',
  'P3 byte-identical legacy bodies and ACL -> edit rpc_submit_agreement_review in the candidate (e.g. add p_comment) and the body md5 / surface line changes',
  'P3 replay both ways and star-only-never-gains-a-comment -> remove the REQUEST_ID_REUSED comment check (probe W9) and the same-key-plus-comment call succeeds',
  'P3 v2-vs-legacy parity (star row, audit row, event, refusal pairs) -> change any line of the v2 re-implementation (audit detail, event payload, validation order) and the paired outcome differs',
  'P4 matrix (3 refusal names, absent/accepted/refused on both sides of every rule, JS mirror) -> drop the contact floor (W1), the length bound (W2) or the control/bidi class (W3) and the case flips; the table CHECKs are a second wall proved by direct inserts',
  'P5 gates -> remove the completion gate (W8) or the participant check (W10) and the refusal becomes an accepted review; the real Dogovor flips from refused to accepted when it is really completed',
  'P5 concurrency -> drop the advisory locks and two racing commands would write two rows (eight identical commands must still write exactly one)',
  'P6 reader gates (block, restriction, world, hidden) -> remove the block gate (W6) or the hidden filter (W7); each gate is shown to flip both ways (lifted gate restores the list)',
  'P7 immutability -> remove the REVIEW_COMMENT_IMMUTABLE raise (W4) and an ordinary UPDATE succeeds; the carve-out passes only the two hide columns under claims + marker',
  'P8 moderation (service role only, text only) -> open the ACL (W5A) or remove the function check (W5B): the observed refusal layer changes; star/aggregate/ratingDue are compared before and after',
  'P9 closure -> remove the table from closure_redaction_relations_v5 / the DELETE branch of the patch function and the author comment survives (the canary scan finds it: positive control before the closure)',
  'P10 export -> keep the old catalog or projection version and the comment field / V5_10 assertions fail',
  'P11 certificate -> skip the three-place re-bind and ready/binding/live=certified fail; isolation probe: each half of the certified surface moves the digest, the whole returns the old value',
  'P12 revert -> a revert that does not restore a rewritten body, the digest or the roster fails surface/pin/snapshot equality; a revert that ignores existing comments is refused by the first check',
];
report.nonVacuity.unshift(...STATIC_NON_VACUITY);
report.notVerified.push('Everything in this file has not run at the time of writing: the first CI run is the first observation of every SQL, PostgREST and closure outcome.',
  'The new client (v2 submit/context/reader services, the comment field, the capability gate, the error-name map) is not written: only the SERVER contract and the OLD shipped client are proved.',
  'Native (device) behaviour: nothing here is native acceptance; the chain is not DEV (ledger, OIDs, DEV-only items), its digest is chain-internal.',
  'Coupled privacy records: the frozen AF22 144 inventory and v5_account_erasure_proof are intentionally NOT edited (the erasure proof deep-equals the actual columns of its own historical stage, which never has the D12 table); the successor record docs/.../d12/D12_CLOSURE_INVENTORY_SUCCESSOR_20261001.json, EXPORT_PROJECTION.md and the legal/store drafts carry additive D12 notes. A published export policy bound to the new projection sha is not exercised.',
  'The apply-time integrity guard assumes psql -c sends the whole string as ONE simple Query message (PostgreSQL documents it). If it did not, the guard would refuse (D12_APPLY_TEXT_INTEGRITY) and nothing would be applied: the run would be RED, never wrongly green.',
  'Hosted lock behaviour of the isolation probe: dropping a table that owns foreign keys takes ACCESS EXCLUSIVE locks on public.app_accounts and private.agreement_reviews inside the nested block (released at its abort) while CREATE TABLE already holds SHARE ROW EXCLUSIVE until commit; lock_timeout 5s makes it fail closed. Acceptable on DEV; a hot-table stall to be re-measured before any production project.',
  'Retention period, lawful basis, DPIA, a production operator and response time for moderation, notification of the author, retaliation exposure (D-DEC-8): owner/legal inputs, not claimed closed.',
  'The 48h auto-completion and confirm-after-problem completion paths are covered only when the fixture reaches them (see gaps); a non-ACTIVE author profile and a published export policy are not exercised.');
// The statements a check pushes only when it PASSES must also be on record when it fails or is skipped (a red run is still honest about what it does not cover).
for (const line of ['The Postgres SERVER LOG was not scanned for comment text (a malformed JSON string is rejected with a CONTEXT line that quotes a fragment of the JSON body; a CHECK violation prints the failing row).',
  'The Storage object contents of an export artifact (the data-export-artifacts bucket) are not exercised: the artifact row with its snapshot_text is a CHAIN-ONLY fixture without a Storage object.',
  'Author closure of a PROTECTED Agreement (an open problem or a safety report) is not exercised: the claim that the comment is erased even then rests on the reading of the DEV bodies, not on a run.',
  'A published export policy bound to the NEW projectionSha256 and the rejection of a stale sha: no policy exists on the chain or on DEV (binding is NULL), so only the snapshot and the sources are proved.']) {
  if (!report.notVerified.some(item => item.startsWith(line.slice(0, 38)))) report.notVerified.push(line);
}
report.result = report.failures.length ? 'FAIL' : report.skipped.length ? 'FAIL_WITH_SKIPPED_CHECKS' : 'PASS';
report.summary = {checks: report.checks.length, failures: report.failures.length, skipped: report.skipped.length, refusals: report.refusals.length, residuals: report.residuals.length, label: report.label};
try {
  const markdown = ['# D12 written comment: disposable-chain proof', '', '**' + (report.label ?? 'label not computed') + '**', '', 'Result: ' + report.result + ' (' + report.checks.length + ' passed, ' + report.failures.length + ' failed, ' + report.skipped.length + ' skipped)', '',
    'The chain is not DEV. Nothing here is native acceptance. Residuals are behaviours the candidate has TODAY and the proof pins without blessing them.', '',
    '## Failures', ...(report.failures.length ? report.failures.map(item => '- ' + item.id + ': ' + item.message.split('\n')[0]) : ['none']), '', '## Skipped', ...(report.skipped.length ? report.skipped.map(item => '- ' + item.id + ': ' + item.reason) : ['none']), '',
    '## Known residuals (pinned, not blessed)', ...report.residuals.map(item => '- ' + item.id + ': ' + item.observed + (item.note ? ' (' + item.note + ')' : '')), '', '## Gaps', ...(report.gaps.length ? report.gaps.map(item => '- ' + item) : ['none']), '',
    '## Not verified', ...report.notVerified.map(item => '- ' + item), '', report.pinGate?.markdown ?? ''].join('\n');
  writeFileSync(markdownPath, markdown + '\n');
} catch { /* the JSON report is the record */ }
save();
console.log(report.result + ' D12_REVIEW_COMMENT_CHAIN_PROOF (' + report.checks.length + ' passed, ' + report.failures.length + ' failed, ' + report.skipped.length + ' skipped) [' + report.labelShort + ']');
if (report.failures.length || report.skipped.length) { for (const item of report.failures) console.error(' - ' + item.id + ': ' + item.message.split('\n')[0]); for (const item of report.skipped) console.error(' - SKIPPED ' + item.id + ': ' + item.reason); process.exitCode = 1; }
