// EX-04 S3 (RC-03: the rating state of a finished Dogovor): two existing readers completed in place, proved on a disposable SQL stack with actual Auth and PostgREST only.
// One process, five phases on ONE fixture: BEFORE (the authority's answer per Dogovor, the readers as they are, the old client path that asks once per finished Dogovor),
// APPLY (refusals, the atomic application, the exact catalog delta), AFTER (the page and the home aggregate equal the authority for every participant and every awkward state, every
// other key is unchanged, the real client makes no request per Dogovor for 0, 1 and a long history and a stalled review read withholds nothing), REVERT, REAPPLY.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from './ts_loader.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const LIST = 'public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)';
const HOME = 'public.rpc_home_attention()';
const LIST_OLD_MD5 = 'c5239ccdc2ffe8f54c661fb7cbf2e335';
const HOME_OLD_MD5 = '8a8feab5eb2ba727c637322b0ef044c1';
const candidate = readFileSync('supabase/candidates/ex04c_rating_state.sql', 'utf8');
const revert = readFileSync('supabase/candidates/ex04c_rating_state_revert.sql', 'utf8');
const postflight = readFileSync('supabase/proofs/ex04/ex04c_postflight.readonly.sql', 'utf8');
const reportPath = env.PRE_V3_ARTIFACT_DIR + '/ex04c-report.json';
const report = {package: 'EX-04 S3 (RC-03): the rating state of a finished Dogovor in the Dogovori page and in the home attention answer', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, providerCalls: 0, checks: []};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const pass = name => { report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name); };
const sha = text => createHash('sha256').update(text).digest('hex');
const trimmed = text => text.replace(/\n$/, '');
const bodyMd5 = signature => sql(`select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid=${q(signature)}::regprocedure`);
const closure = () => rows('select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready')[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const json = value => JSON.parse(JSON.stringify(value));
const ids = list => list.map(item => item.id);
const withoutRating = ({ratingDue, ...rest}) => rest;
const withoutAsOf = ({asOf, ...rest}) => rest;

// ------------------------------------------------------------------ fixture
const BASE = '2026-03-01 10:00:00+00';
const minute = value => `timestamptz '${BASE}' + interval '${value} minutes'`;
async function account(label) {
  const actor = await rt.actor('ex04c-' + label);
  for (const kind of ['REQUESTER', 'WORKER']) {
    if (!rows(`select 1 from public.app_profiles where account_id=${q(actor.id)} and kind=${q(kind)}`).length)
      sql(`insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values(${q(randomUUID())},${q(actor.id)},${q(kind)},'Proof ${label}','Novi Sad','ACTIVE',${kind === 'WORKER' ? "'{ciscenje}'" : "'{}'"},${kind === 'WORKER' ? 3 : 1},${kind === 'WORKER'});`);
  }
  actor.profile = Object.fromEntries(rows(`select kind, id from public.app_profiles where account_id=${q(actor.id)}`).map(row => [row.kind, row.id]));
  actor.label = label;
  return actor;
}
// status = agreement.status, exec = agreement_execution.state (null: no row), reviews = who reviewed ('requester', 'worker' or both).
const agreementSql = (spec, requester, worker, minutes) => {
  const need = randomUUID(), id = randomUUID(), at = minute(minutes);
  let text = `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,schedule_kind,created_at)
      values(${q(need)},${q(requester.id)},${q(requester.profile.REQUESTER)},${q(spec.need ?? 'ACTIVE')},${q('EX04C ' + spec.k)},'Disposable fixture','PROOF','OFFERS','FLEXIBLE',${at});
    insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,status,created_at,updated_at)
      values(${q(id)},${q(need)},${q(randomUUID())},${q(randomUUID())},${q(requester.id)},${q(requester.profile.REQUESTER)},${q(worker.id)},${q(worker.profile.WORKER)},${q(spec.status)},${at},${at});
    insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
      values(${q(id)},1,${q(spec.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED')},'{"price_rsd":4000,"currency":"RSD"}'::jsonb,${q(sha(id))},${q(requester.id)});`;
  if (spec.exec) text += `insert into public.agreement_execution(agreement_id,agreement_version,mode,state,requester_deadline_at,updated_at)
      values(${q(id)},1,'PHYSICAL',${q(spec.exec)},${spec.exec === 'AWAITING_REQUESTER' ? "now() + interval '1 day'" : 'null'},${at});`;
  for (const side of spec.reviews ?? []) {
    const reviewer = side === 'requester' ? requester : worker, target = side === 'requester' ? worker : requester;
    text += `insert into private.agreement_reviews(agreement_id,reviewer_account_id,target_account_id,rating,tags,client_request_id,input_hash,created_at)
      values(${q(id)},${q(reviewer.id)},${q(target.id)},5,array['RELIABLE']::text[],${q(randomUUID())},${q(sha(id + side))},${at});`;
  }
  return {id, text};
};
// P and Q: every state a Dogovor can be in, both ways round (the requester of one is the worker of the next).
const SPEC = [
  {k: 'unrated', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED'},
  {k: 'rated_by_requester', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED', reviews: ['requester']},
  {k: 'rated_by_worker', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED', reviews: ['worker']},
  {k: 'rated_by_both', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED', reviews: ['requester', 'worker']},
  {k: 'unrated_2', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED'},
  {k: 'status_done_exec_open', status: 'COMPLETED', exec: 'CONFIRMED'},
  {k: 'status_open_exec_done', status: 'CONFIRMED', exec: 'COMPLETED'},
  {k: 'no_execution_row', status: 'COMPLETED', exec: null},
  {k: 'confirmed', status: 'CONFIRMED', exec: 'CONFIRMED'},
  {k: 'awaiting_requester', status: 'CONFIRMED', exec: 'AWAITING_REQUESTER'},
  {k: 'cancelled', status: 'CANCELLED', exec: 'CANCELLED', need: 'CANCELLED'},
  {k: 'superseded', status: 'SUPERSEDED', exec: 'CONFIRMED'},
];
async function buildFixture() {
  const P = await account('p'), Q = await account('q'), S = await account('s'), E = await account('empty'), U = await account('single'), R = await account('restricted'),
    B1 = await account('bulk-1'), B2 = await account('bulk-2'), O = await account('other');
  let text = '', minutes = 0;
  const made = [];
  SPEC.forEach((spec, index) => {
    const [requester, worker] = index % 2 === 0 ? [P, Q] : [Q, P];
    const built = agreementSql(spec, requester, worker, ++minutes * 7); text += built.text; made.push({...spec, id: built.id, requester, worker});
  });
  // Q and S have a Dogovor of their own that P must never see; the third person U has exactly ONE finished Dogovor that waits for a rating, among others.
  const outsider = agreementSql({k: 'q_with_s', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED'}, Q, S, ++minutes * 7); text += outsider.text;
  const single = [{k: 'u_due', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED'}, {k: 'u_rated_1', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED', reviews: ['requester']},
    {k: 'u_rated_2', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED', reviews: ['requester']}, {k: 'u_active', status: 'CONFIRMED', exec: 'CONFIRMED'}].map(spec => {
    const built = agreementSql(spec, U, O, ++minutes * 7); text += built.text; return {...spec, id: built.id};
  });
  const restricted = agreementSql({k: 'r_unrated', status: 'COMPLETED', exec: 'COMPLETED', need: 'COMPLETED'}, R, O, ++minutes * 7); text += restricted.text;
  text += `insert into private.account_closure_requests(account_id,state,revision) values(${q(R.id)},'READY',1);`;
  // 230 Dogovori between B1 and B2: 150 finished (some rated by one side or the other), the rest active.
  const bulk = [];
  for (let i = 1; i <= 230; i++) {
    const spec = {k: 'bulk_' + i, status: i <= 150 ? 'COMPLETED' : 'CONFIRMED', exec: i <= 150 ? 'COMPLETED' : 'CONFIRMED', need: i <= 150 ? 'COMPLETED' : 'ACTIVE',
      reviews: i <= 150 ? [...(i % 3 === 0 ? ['requester'] : []), ...(i % 5 === 0 ? ['worker'] : [])] : []};
    const [requester, worker] = i % 2 === 0 ? [B1, B2] : [B2, B1];
    const built = agreementSql(spec, requester, worker, 1000 + i); text += built.text; bulk.push({...spec, id: built.id, requester, worker});
  }
  sql(`begin; set local session_replication_role=replica; ${text} set local session_replication_role=origin; commit;`);
  return {P, Q, S, E, U, R, O, B1, B2, made, single, bulk, outsiderId: outsider.id, restrictedId: restricted.id};
}

// ------------------------------------------------------------------ reads
async function readPages(client, scope = 'ALL', limit = 100) {
  const items = [], pages = []; let cursor = null;
  for (let guard = 0; guard < 100; guard++) {
    const page = await ok(client.rpc('rpc_list_my_agreements_page', {p_scope: scope, p_limit: limit, p_before_at: cursor?.at ?? null, p_before_id: cursor?.id ?? null}));
    pages.push(page); items.push(...page.items);
    if (!page.hasMore) return {items, pages};
    const last = page.items[page.items.length - 1]; cursor = {at: last.sortAt, id: last.id};
  }
  throw new Error('PAGING_DID_NOT_TERMINATE');
}
const eligible = async (client, id) => (await ok(client.rpc('rpc_get_my_agreement_review', {p_agreement_id: id}))).eligible;
// The authority: for every Dogovor an account is a party to, the answer of the review read itself.
async function truthOf(client, items) {
  const truth = new Map();
  for (const item of items) truth.set(item.id, await eligible(client, item.id));
  return truth;
}
const home = client => ok(client.rpc('rpc_home_attention'));
/** A client that counts every request, can hide the new fact (an older server) and can stall every review read. */
function counting(client, {strip = false, stall = false} = {}) {
  const calls = [];
  return {calls, auth: client.auth, rpc: (name, args) => {
    calls.push(name);
    if (name === 'rpc_get_my_agreement_review' && stall) return new Promise(() => {});
    const result = client.rpc(name, args);
    return strip && name === 'rpc_list_my_agreements_page'
      ? Promise.resolve(result).then(response => ({...response, data: response.data && {...response.data, items: response.data.items.map(withoutRating)}})) : result;
  }};
}
const tally = (calls, name) => calls.filter(call => call === name).length;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // ---------------------------------------------------------------- BEFORE
  for (const [signature, md5] of [[LIST, LIST_OLD_MD5], [HOME, HOME_OLD_MD5], ['public.rpc_get_my_agreement_review(uuid)', '75a8b78ec8a5e6334f42366b4461c14c'],
    ['private.closure_account_restricted(uuid)', 'f4999250c315e0253374d4611291c7ad'], ['public.rpc_storage_account_open()', '7350621ef256678e209aa6a28c79b58b'],
    ['private.my_application_state(text,integer,integer,text,boolean)', '236c6c9c9625e4fb92522c6c3a1bfe03'], ['public.covered_slots(public.needs)', 'cbeb8f2a3da7d08965ef0386cfc437ba'],
    ['public.selectable_application_count(public.needs)', 'fe53442f8b661d6f33d22a54e2a468a8']]) assert.equal(bodyMd5(signature), md5, 'CHAIN_PREDECESSOR_DIFFERS_FROM_DEV:' + signature);
  pass('CHAIN_PREDECESSORS_EQUAL_THE_DEV_PINS');
  const closureBefore = closure(); assert.equal(closureBefore.ready, true); assert.equal(closureBefore.live, closureBefore.certified);
  const surfaceBefore = surface();
  const f = await buildFixture();
  const {P, Q, S, E, U, R, B1, B2, made, single, bulk} = f;
  const accounts = {P, Q, S, E, U, B1, B2};
  const before = {};
  for (const [name, actor] of Object.entries({...accounts, R})) {
    const listed = await readPages(actor.client);
    before[name] = {items: listed.items, truth: await truthOf(actor.client, listed.items), pages: listed.pages.length, home: name === 'R' ? null : await home(actor.client)};
  }
  assert.equal(before.P.items.length, SPEC.length); assert.equal(before.Q.items.length, SPEC.length + 1); assert.equal(before.S.items.length, 1); assert.equal(before.E.items.length, 0);
  assert.equal(before.U.items.length, 4); assert.equal(before.B1.items.length, 230); assert.equal(before.B1.pages, 3);
  assert.ok(!ids(before.P.items).includes(f.outsiderId), 'A_DOGOVOR_OF_TWO_OTHER_PEOPLE_IS_NOT_P_S');
  for (const name of Object.keys(before)) assert.ok(before[name].items.every(item => !('ratingDue' in item)), 'REPRODUCED_THE_PAGE_HAS_NO_RATING_FACT');
  for (const name of Object.keys(before).filter(name => name !== 'R')) assert.ok(!('ratings' in before[name].home), 'REPRODUCED_THE_HOME_ANSWER_HAS_NO_RATING_AGGREGATE');
  // The authority itself: the awkward states are not eligible, and each side's own review decides for that side only.
  const byKey = Object.fromEntries(made.map(item => [item.k, item]));
  const truthFor = (name, key) => before[name].truth.get(byKey[key].id);
  assert.equal(truthFor('P', 'unrated'), true); assert.equal(truthFor('Q', 'unrated'), true);
  for (const key of ['status_done_exec_open', 'status_open_exec_done', 'no_execution_row', 'confirmed', 'awaiting_requester', 'cancelled', 'superseded']) assert.equal(truthFor('P', key), false, 'NOT_ELIGIBLE_' + key);
  assert.equal(new Set(made.filter(item => item.reviews?.length === 1).map(item => item.reviews[0])).size, 2);
  const reviewedByP = made.filter(item => (item.reviews ?? []).some(side => (side === 'requester' ? item.requester : item.worker) === P)).map(item => item.id);
  assert.ok(reviewedByP.length > 0 && reviewedByP.every(id => before.P.truth.get(id) === false), 'MY_OWN_REVIEW_MAKES_IT_NOT_DUE_FOR_ME');
  assert.ok(made.some(item => before.P.truth.get(item.id) !== before.Q.truth.get(item.id)), 'THE_TWO_SIDES_CAN_DIFFER');
  assert.equal([...before.R.truth.values()].filter(Boolean).length, 0, 'A_CLOSURE_RESTRICTED_ACCOUNT_IS_NEVER_ELIGIBLE');
  assert.equal([...before.U.truth.values()].filter(Boolean).length, 1);
  const dueCount = name => [...before[name].truth.values()].filter(Boolean).length;
  assert.ok(dueCount('P') >= 2 && dueCount('B1') > 20);
  // RC-03 as it is: the old client path asks once per finished Dogovor.
  const mapped = async (actor, options) => {
    const wrapper = counting(actor.client, options), mods = loadModules({client: wrapper, accountId: actor.id});
    return {wrapper, mods, rows: await mods.load('data/agreementClientService').agreementClientService.mojiDogovori()};
  };
  const oldPath = await mapped(B1, {strip: true});
  const finishedB1 = oldPath.rows.filter(row => row.stanje === 'COMPLETED').length;
  assert.equal(finishedB1, 150); assert.equal(tally(oldPath.wrapper.calls, 'rpc_get_my_agreement_review'), 150); assert.equal(tally(oldPath.wrapper.calls, 'rpc_list_my_agreements_page'), 3);
  report.rc03 = {oldPathRequestsForTheLongHistory: {pages: 3, reviewReads: 150}};
  pass('REPRODUCED_RC_03_THE_OLD_PATH_ASKS_ONCE_PER_FINISHED_DOGOVOR_AND_THE_READERS_HAVE_NO_RATING_FACT');

  // ---------------------------------------------------------------- APPLY
  const drift = candidate.replace(`'${LIST_OLD_MD5}'`, `'${'0'.repeat(32)}'`); assert.notEqual(drift, candidate);
  assert.throws(() => sql(drift), /EX04C_PREDECESSOR_DRIFT/);
  assert.deepEqual(surface(), surfaceBefore); pass('PREDECESSOR_DRIFT_REFUSED_ATOMICALLY');
  assert.throws(() => sql(`begin; set local session_replication_role=replica; update private.closure_source_v5 set sha256=repeat('0',64) where singleton; ${candidate}\nrollback;`), /EX04C_CLOSURE_NOT_READY/);
  assert.deepEqual(surface(), surfaceBefore); assert.deepEqual(closure(), closureBefore); pass('UNCERTIFIED_CLOSURE_REFUSED_ATOMICALLY');
  sql(candidate);
  assert.throws(() => sql(candidate), /EX04C_ALREADY_APPLIED/); pass('APPLIED_ONCE_SECOND_RUN_REFUSED');
  const surfaceAfter = surface();
  const removed = surfaceBefore.filter(line => !surfaceAfter.includes(line)), added = surfaceAfter.filter(line => !surfaceBefore.includes(line));
  const names = lines => lines.map(line => line.split(':')[1].split('(')[0]).sort();
  assert.deepEqual(names(removed), ['public.rpc_home_attention', 'public.rpc_list_my_agreements_page']); assert.deepEqual(names(added), names(removed));
  assert.equal(removed.length, 2); assert.equal(added.length, 2);
  assert.ok(removed.every(line => line.includes(':definer=true:volatility=s:config=search_path=pg_catalog:acl={postgres=X/postgres,authenticated=X/postgres}')) && added.every(line => line.includes(':definer=true:volatility=s:config=search_path=pg_catalog:acl={postgres=X/postgres,authenticated=X/postgres}')), 'SECURITY_AND_ACL_UNCHANGED');
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  pass('ONLY_THE_TWO_READERS_CHANGED_AND_NO_FUNCTION_WAS_ADDED');
  assert.deepEqual(closure(), closureBefore); pass('CERTIFICATE_UNCHANGED_READY');
  assert.equal(sql(`select obj_description(${q(HOME)}::regprocedure,'pg_proc') is not null`), 't', 'THE_COMMENT_OF_THE_HOME_READER_STAYS');
  const flight = JSON.parse(sql(postflight)); assert.deepEqual(flight.problems, []); report.postflight = flight; pass('DEV_POSTFLIGHT_FILE_EMPTY_ON_THE_CHAIN');
  report.candidateSha256 = sha(trimmed(candidate)); report.revertSha256 = sha(trimmed(revert)); report.postflightSha256 = sha(trimmed(postflight));
  await sleep(1500);

  // ---------------------------------------------------------------- AFTER
  const after = {};
  for (const [name, actor] of Object.entries({...accounts, R})) {
    const listed = await readPages(actor.client);
    after[name] = {items: listed.items, pages: listed.pages.length, home: name === 'R' ? null : await home(actor.client)};
    assert.equal(listed.items.length, before[name].items.length);
    for (const item of listed.items) {
      assert.equal(typeof item.ratingDue, 'boolean', 'EVERY_ITEM_CARRIES_THE_FACT');
      assert.equal(item.ratingDue, before[name].truth.get(item.id), `RATING_DUE_EQUALS_THE_AUTHORITY_${name}_${item.id}`);
      assert.equal(item.ratingDue, await eligible(actor.client, item.id), 'THE_AUTHORITY_ANSWERS_THE_SAME_AFTER');
    }
    assert.deepEqual(listed.items.map(withoutRating), before[name].items, `EVERY_OTHER_KEY_IS_UNCHANGED_${name}`);
  }
  pass('THE_PAGE_FACT_EQUALS_THE_AUTHORITY_FOR_EVERY_PARTY_AND_EVERY_AWKWARD_STATE_AND_NOTHING_ELSE_CHANGED');
  for (const name of Object.keys(accounts)) {
    const due = [...before[name].truth.entries()].filter(([, value]) => value).map(([id]) => id);
    assert.deepEqual(after[name].home.ratings, {due: due.length, dueAgreementId: due.length === 1 ? due[0] : null}, 'HOME_AGGREGATE_EQUALS_THE_AUTHORITY_' + name);
    assert.deepEqual(withoutAsOf((({ratings, ...rest}) => rest)(after[name].home)), withoutAsOf(before[name].home), 'EVERY_OTHER_KEY_OF_THE_HOME_ANSWER_IS_UNCHANGED_' + name);
  }
  assert.equal(after.E.home.ratings.due, 0); assert.equal(after.E.home.ratings.dueAgreementId, null);
  assert.equal(after.U.home.ratings.due, 1); assert.equal(after.U.home.ratings.dueAgreementId, single[0].id);
  assert.ok(after.B1.home.ratings.due > 20 && after.B1.home.ratings.dueAgreementId === null);
  pass('THE_HOME_AGGREGATE_EQUALS_THE_AUTHORITY_FOR_NONE_ONE_AND_MANY_AND_NOTHING_ELSE_CHANGED');
  // The closure-restricted account: never due, on the page and by the authority; the home answer is its own gate's.
  assert.ok(after.R.items.every(item => item.ratingDue === false));
  const restrictedHome = await R.client.rpc('rpc_home_attention');
  assert.ok(restrictedHome.error ? restrictedHome.error.message === 'ACCOUNT_NOT_OPEN' : restrictedHome.data.ratings.due === 0, 'A_RESTRICTED_ACCOUNT_HAS_NO_RATINGS_DUE');
  pass('A_CLOSURE_RESTRICTED_ACCOUNT_IS_NEVER_DUE');
  // The scopes keep their meaning and carry the fact too; invalid input is still refused by name.
  for (const scope of ['ACTIVE', 'HISTORY']) {
    const scoped = (await readPages(P.client, scope, 3)).items;
    assert.ok(scoped.every(item => typeof item.ratingDue === 'boolean'));
    assert.deepEqual(ids(scoped), ids(after.P.items.filter(item => (['CONFIRMED', 'AWAITING_REQUESTER'].includes(item.status)) === (scope === 'ACTIVE'))));
  }
  for (const args of [{p_limit: 0}, {p_limit: 101}, {p_before_at: '2026-03-01T10:00:00+00:00'}]) await denied(P.client.rpc('rpc_list_my_agreements_page', {p_scope: 'ALL', ...args}), 'INVALID_PAGE');
  await denied(P.client.rpc('rpc_list_my_agreements_page', {p_scope: 'BOGUS'}), 'INVALID_SCOPE');
  await denied(rt.anon.rpc('rpc_list_my_agreements_page', {p_scope: 'ALL'})); await denied(rt.anon.rpc('rpc_home_attention'));
  assert.deepEqual(ids((await readPages(S.client)).items), [f.outsiderId], 'AN_OUTSIDER_SEES_ONLY_THEIR_OWN');
  pass('SCOPES_KEEP_THEIR_MEANING_INVALID_INPUT_IS_REFUSED_BY_NAME_ANON_IS_DENIED');

  // The real client TypeScript: the requests are the pages, never one per finished Dogovor, for 0, 1 and a long history.
  const cases = [['none', E, 1], ['one', U, 1], ['a few', P, 1], ['a long history', B1, 3]];
  report.requests = {};
  for (const [label, actor, pages] of cases) {
    const fresh = await mapped(actor, {}), old = await mapped(actor, {strip: true});
    assert.equal(tally(fresh.wrapper.calls, 'rpc_list_my_agreements_page'), pages, 'PAGES_' + label);
    assert.equal(tally(fresh.wrapper.calls, 'rpc_get_my_agreement_review'), 0, 'NO_REVIEW_READ_PER_DOGOVOR_' + label);
    const finished = fresh.rows.filter(row => row.stanje === 'COMPLETED').length;
    assert.equal(tally(old.wrapper.calls, 'rpc_get_my_agreement_review'), finished, 'THE_OLD_PATH_ASKS_ONCE_PER_FINISHED_' + label);
    // The same rows, rating state included, whichever way the state arrived.
    assert.deepEqual(json(fresh.rows), json(old.rows), 'THE_RESULT_IS_THE_SAME_AS_THE_OLD_PATH_' + label);
    for (const row of fresh.rows) if (row.stanje === 'COMPLETED') {
      assert.equal(row.ocenaMoguca, before[actor.label === 'p' ? 'P' : actor.label === 'bulk-1' ? 'B1' : actor.label === 'single' ? 'U' : 'E'].truth.get(row.id));
      assert.equal(row.stanjeProvereOcene, row.ocenaMoguca ? 'DUE' : 'NOT_DUE');
    }
    report.requests[label] = {pages, finishedDogovori: finished, reviewReadsNow: 0, reviewReadsBefore: finished};
  }
  pass('THE_REAL_CLIENT_MAKES_NO_REQUEST_PER_DOGOVOR_FOR_NONE_ONE_AND_A_LONG_HISTORY_AND_THE_RESULT_EQUALS_THE_OLD_PATH');
  const stalled = counting(B1.client, {stall: true}), stalledMods = loadModules({client: stalled, accountId: B1.id});
  const started = Date.now();
  const stalledRows = await Promise.race([stalledMods.load('data/agreementClientService').agreementClientService.mojiDogovori(), sleep(8000).then(() => 'TIMED_OUT')]);
  assert.notEqual(stalledRows, 'TIMED_OUT', 'A_STALLED_REVIEW_READ_WITHHOLDS_NOTHING'); assert.equal(stalledRows.length, 230); assert.ok(Date.now() - started < 8000);
  assert.equal(tally(stalled.calls, 'rpc_get_my_agreement_review'), 0);
  pass('A_STALLED_REVIEW_READ_WITHHOLDS_NOTHING_BECAUSE_NONE_IS_STARTED');
  // Početna: the real decoder and composition. The number is the server's, and a failed Dogovori read withholds the Dogovori, never the number.
  let lastMods;
  for (const [name, actor] of [['E', E], ['U', U], ['P', P], ['B1', B1]]) {
    const mods = lastMods = loadModules({client: actor.client, accountId: actor.id});
    const preview = await mods.load('data/homeAttentionClientService').homeAttentionClientService.paznjaZaPocetnu();
    const compose = mods.load('data/homeSnapshot').composeHome, due = [...before[name].truth.entries()].filter(([, value]) => value).map(([id]) => id);
    const rowsKnown = await mods.load('data/agreementClientService').agreementClientService.mojiDogovori();
    const known = value => ({kind: 'known', value}), unavailable = {kind: 'unavailable'};
    const snapshot = compose({needs: known([]), applications: known([]), agreements: known(rowsKnown)}, known(preview));
    assert.equal(snapshot.ratingsDue, due.length); assert.equal(snapshot.ratingDueAgreementId, due.length === 1 ? due[0] : null);
    const failed = compose({needs: known([]), applications: known([]), agreements: unavailable}, known(preview));
    assert.equal(failed.ratingsDue, due.length, 'A_FAILED_DOGOVORI_READ_WITHHOLDS_THE_DOGOVORI_NEVER_THE_NUMBER'); assert.equal(failed.partial, true);
  }
  pass('POCETNA_NUMBER_IS_THE_SERVERS_AGGREGATE_AND_SURVIVES_A_FAILED_DOGOVORI_READ');
  report.clientSources = lastMods.sources;
  assert.deepEqual(closure(), closureBefore); pass('CLOSURE_STAYS_READY_AFTER_THE_READS');

  // ---------------------------------------------------------------- REVERT
  sql(revert);
  assert.equal(bodyMd5(LIST), LIST_OLD_MD5); assert.equal(bodyMd5(HOME), HOME_OLD_MD5);
  assert.deepEqual(surface(), surfaceBefore, 'THE_WHOLE_CATALOG_IS_RESTORED_EXACTLY'); assert.deepEqual(closure(), closureBefore);
  assert.equal(sql(`select obj_description(${q(HOME)}::regprocedure,'pg_proc') is not null`), 't');
  assert.throws(() => sql(revert), /EX04C_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  await sleep(1500);
  const reverted = await readPages(P.client);
  assert.deepEqual(reverted.items, before.P.items, 'THE_PAGE_IS_BYTE_FOR_BYTE_THE_OLD_ONE'); assert.ok(!('ratings' in await home(P.client)));
  pass('REVERT_RESTORES_THE_COMPLETE_CATALOG_AND_REFUSES_TO_RUN_TWICE');
  sql(candidate); assert.deepEqual(surface(), surfaceAfter, 'REAPPLY_PRODUCES_THE_SAME_CATALOG'); assert.deepEqual(closure(), closureBefore);
  assert.deepEqual(JSON.parse(sql(postflight)).problems, []);
  await sleep(1500);
  assert.deepEqual((await readPages(P.client)).items.map(withoutRating), before.P.items); assert.equal((await home(U.client)).ratings.due, 1); pass('REAPPLY_AGAIN_EQUAL_AND_PARITY_HOLDS');
  report.result = 'PASS'; save();
}
main().catch(error => { report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save(); console.error(report.failure); process.exit(1); });
