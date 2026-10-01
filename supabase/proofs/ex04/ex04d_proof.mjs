// EX-04 S4 (A11 candidates and comparison): the candidate list of a task a keyset page at a time, proved on a disposable SQL stack with actual Auth and PostgREST only.
// One process, five phases on ONE fixture (a task with 136 applications in every state, a second task that is full, a stranger): BEFORE (the whole-list read and what it costs),
// APPLY (refusals, the atomic application, the exact catalog delta), AFTER (the documents and the states equal the whole-list read across ties and limits, the work of a page is the work of its own
// candidates, a walk survives a change between pages, authority, the real client TypeScript), REVERT, REAPPLY.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from './ts_loader.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const WHOLE = 'public.rpc_list_need_candidates(uuid)';
const STATES_OLD = 'private.need_candidate_states_v5(uuid)';
const STATES = 'private.need_candidate_states_v5(uuid,uuid[])';
const PAGE = 'public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)';
const candidate = readFileSync('supabase/candidates/ex04d_candidates_page.sql', 'utf8');
const revert = readFileSync('supabase/candidates/ex04d_candidates_page_revert.sql', 'utf8');
const postflight = readFileSync('supabase/proofs/ex04/ex04d_postflight.readonly.sql', 'utf8');
const reportPath = env.PRE_V3_ARTIFACT_DIR + '/ex04d-report.json';
const report = {package: 'EX-04 S4 (A11 candidates and comparison): the candidate list of a task a keyset page at a time', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, providerCalls: 0, checks: []};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const pass = name => { report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name); };
const sha = text => createHash('sha256').update(text).digest('hex');
const trimmed = text => text.replace(/\n$/, '');
const bodyMd5 = signature => sql(`select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid=${q(signature)}::regprocedure`);
const exists = signature => sql(`select to_regprocedure(${q(signature)}) is not null`) === 't';
const closure = () => rows('select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready')[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const json = value => JSON.parse(JSON.stringify(value));
const ids = list => list.map(item => item.responseId);
const withoutSortAt = ({sortAt, ...rest}) => rest;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const asClaims = (accountId, text) => `set local role authenticated; select set_config('request.jwt.claim.sub', ${q(accountId)}, true), set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claims', ${q(JSON.stringify({sub: accountId, role: 'authenticated'}))}, true); ${text}`;

// ------------------------------------------------------------------ fixture
const BASE = '2026-03-01 10:00:00+00';
const minute = value => `timestamptz '${BASE}' + interval '${value} minutes'`;
const insertParty = (p, {capacity = 3, status = 'ACTIVE', skills = '{ciscenje}'} = {}) => `insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values
  (${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',1,false),
  (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad',${q(status)},${q(skills)},${capacity},true);`;
const SPEC = [   // k, response status, covered slots (of the response and its version), revision it was written against, profile quirks, minutes after BASE (ties on purpose), snapshot
  {k: 'ok_1', raw: 'SUBMITTED', slots: 1, sub: 10, snapshot: true}, {k: 'ok_2', raw: 'SUBMITTED', slots: 2, sub: 10},
  {k: 'viewed', raw: 'VIEWED', slots: 1, sub: 20, snapshot: true}, {k: 'short', raw: 'SHORTLISTED', slots: 1, sub: 20}, {k: 'delivered', raw: 'DELIVERED', slots: 1, sub: 30},
  {k: 'overfill', raw: 'SUBMITTED', slots: 3, sub: 40, snapshot: true},
  {k: 'withdrawn', raw: 'WITHDRAWN', slots: 1, sub: 50}, {k: 'not_selected', raw: 'NOT_SELECTED', slots: 1, sub: 50, snapshot: true}, {k: 'expired', raw: 'EXPIRED', slots: 1, sub: 60},
  {k: 'stale_rev', raw: 'SUBMITTED', slots: 1, revision: 1, sub: 70}, {k: 'stale_status', raw: 'STALE_REVIEW_REQUIRED', slots: 1, sub: 70, snapshot: true},
  {k: 'inactive', raw: 'SUBMITTED', slots: 1, status: 'SUSPENDED', sub: 80}, {k: 'capacity', raw: 'SUBMITTED', slots: 2, capacity: 1, sub: 80},
  {k: 'no_skills', raw: 'SUBMITTED', slots: 1, skills: '{}', sub: 90}, {k: 'selected_extra', raw: 'SELECTED', slots: 1, sub: 90},
];
for (let i = 1; i <= 120; i++) SPEC.push({k: 'bulk_' + i, raw: 'SUBMITTED', slots: 1, sub: 100 + Math.floor(i / 2), snapshot: i % 2 === 0});
const needSql = (need, owner, {required, status = 'PUBLISHED', title}) => `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,
    mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline,created_at) values(
    ${q(need)},${q(owner.id)},${q(owner.profile)},${q(status)},${q(title)},'Disposable fixture','PROOF','{}','Novi Sad','Liman','OFFERS',${required},'FLEXIBLE',now() - interval '1 hour','Europe/Belgrade',2,null,null,
    now() + interval '2 days',${minute(-100)});`;
function candidateSql(need, item, index) {
  const party = {id: randomUUID(), requester: randomUUID(), worker: randomUUID()}, response = randomUUID(), revision = item.revision ?? 2, price = 1000 + index;
  let text = insertParty(party, {capacity: item.capacity ?? 3, status: item.status ?? 'ACTIVE', skills: item.skills ?? '{ciscenje}'});
  text += `insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note,submitted_at,created_at)
      values(${q(response)},${q(need)},${q(party.id)},${q(party.worker)},'OFFER',${q(item.raw)},${revision},1,${price},${item.slots},${q('Napomena ' + item.k)},${minute(item.sub)},${minute(item.sub)});
    insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash,proposed_start_at,proposed_end_at)
      values(${q(response)},1,${revision},${price},${item.slots},${q('Napomena ' + item.k)},${q(sha(response))},null,null);`;
  if (item.snapshot) text += `insert into private.response_application_snapshots(response_id,response_version,snapshot_schema,worker_profile_id,worker_team_capacity,covered_slots,need_required_slots,
      need_selected_slots_before_submit,need_remaining_slots_before_submit,pricing_mode,requester_price_rsd,worker_skills,worker_tools,worker_licenses,worker_vehicles)
      values(${q(response)},1,'APPLICATION_V1_SELF_DECLARED',${q(party.worker)},${item.capacity ?? 3},${item.slots},4,2,2,'OFFERS',null,array['ciscenje'],array[]::text[],array[]::text[],array['kombi']);`;
  return {text, response, party};
}
const previousSelection = (need, owner, slots) => {
  const party = {id: randomUUID(), requester: randomUUID(), worker: randomUUID()}, response = randomUUID();
  return `${insertParty(party)}
    insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note,submitted_at,created_at)
      values(${q(response)},${q(need)},${q(party.id)},${q(party.worker)},'OFFER','SELECTED',2,1,1000,${slots},'Raniji izbor',${minute(1)},${minute(1)});
    insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash,proposed_start_at,proposed_end_at)
      values(${q(response)},1,2,1000,${slots},'Raniji izbor',${q(sha(response))},null,null);
    insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,status,response_id,worker_account_id,worker_profile_id)
      values(${q(need)},2,${q(owner.id)},${q('ex04d-' + response)},${slots},'SELECTED',${q(response)},${q(party.id)},${q(party.worker)});`;
};
async function buildFixture() {
  const owner = await rt.actor('ex04d-owner'), stranger = await rt.actor('ex04d-stranger'), other = await rt.actor('ex04d-other');
  owner.profile = rows(`select id from public.app_profiles where account_id=${q(owner.id)} and kind='REQUESTER'`)[0].id;
  other.profile = rows(`select id from public.app_profiles where account_id=${q(other.id)} and kind='REQUESTER'`)[0].id;
  const need = randomUUID(), full = randomUUID(), emptyNeed = randomUUID(), foreign = randomUUID();
  let text = needSql(need, owner, {required: 4, title: 'EX04D many'}) + previousSelection(need, owner, 2);
  const made = SPEC.map((item, index) => ({...item, ...candidateSql(need, item, index)}));
  text += made.map(item => item.text).join('\n');
  // A second task that is already full: every candidate that could be chosen is FULL.
  text += needSql(full, owner, {required: 2, title: 'EX04D full'}) + previousSelection(full, owner, 2);
  const fullSpec = [{k: 'f1', raw: 'SUBMITTED', slots: 1, sub: 5}, {k: 'f2', raw: 'VIEWED', slots: 1, sub: 5}, {k: 'f3', raw: 'SHORTLISTED', slots: 1, sub: 6}, {k: 'f4', raw: 'WITHDRAWN', slots: 1, sub: 7}];
  const fullMade = fullSpec.map((item, index) => ({...item, ...candidateSql(full, item, 500 + index)}));
  text += fullMade.map(item => item.text).join('\n');
  text += needSql(emptyNeed, owner, {required: 1, title: 'EX04D empty'}) + needSql(foreign, other, {required: 1, title: 'EX04D foreign'});
  sql(`begin; set local session_replication_role=replica; ${text} set local session_replication_role=origin; commit;`);
  return {owner, stranger, other, need, full, emptyNeed, foreign, made, fullMade};
}

// ------------------------------------------------------------------ reads
const whole = (client, need) => ok(client.rpc('rpc_list_need_candidates', {p_need_id: need}));
async function readPages(client, need, limit) {
  const items = [], pages = []; let cursor = null;
  for (let guard = 0; guard < 500; guard++) {
    const args = {p_need_id: need, p_limit: limit}; if (cursor) Object.assign(args, {p_after_at: cursor.at, p_after_id: cursor.id});
    const page = await ok(client.rpc('rpc_list_need_candidates_page', args));
    pages.push(page); items.push(...page.items);
    if (!page.hasMore) return {items, pages};
    const last = page.items[page.items.length - 1]; cursor = {at: last.sortAt, id: last.responseId};
  }
  throw new Error('PAGING_DID_NOT_TERMINATE');
}
async function readerReady(client, need) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await client.rpc('rpc_list_need_candidates_page', {p_need_id: need, p_limit: 1});
    if (!result.error) return;
    await sleep(500);
  }
  throw new Error('READER_NOT_READY');
}
/** How many times each function ran inside ONE transaction that calls `expression` as the owner (track_functions = all). */
function costOf(owner, expression) {
  const profile = 'public.rpc_get_public_profile(uuid)', match = 'private.match_detail_for_calendar_interval(uuid,uuid,timestamp with time zone,timestamp with time zone)';
  const out = sql(`begin; set local track_functions='all'; ${asClaims(owner.id, `select (${expression}) is not null;`)}
    reset role; select coalesce((select calls from pg_stat_xact_user_functions where funcid=${q(profile)}::regprocedure),0) || ',' || coalesce((select calls from pg_stat_xact_user_functions where funcid=${q(match)}::regprocedure),0); rollback;`).split(/\r?\n/).pop();
  const [profiles, matches] = out.split(',').map(Number);
  return {profiles, matches};
}

async function main() {
  // ---------------------------------------------------------------- BEFORE
  for (const [signature, md5] of [[WHOLE, '15cb0fd9d891a4ce6d4fdc7ea79abcd1'], [STATES_OLD, '6d65e304f41f3e130228f58874757f0d'], ['public.rpc_get_public_profile(uuid)', '9ecc0b69096f1167d02e0bb7b9656bc0'],
    ['private.match_detail_for_calendar_interval(uuid,uuid,timestamp with time zone,timestamp with time zone)', '781956cab666befab216b3ce2334ca1d'],
    ['private.assert_application_price_v5(public.needs,integer,integer)', 'bd7ef02925c03d99ff7fd549219214cb'], ['public.fn_need_covered_slots(uuid)', '5a1d10aa69cda3c3095550b6f8e4c03f']])
    assert.equal(bodyMd5(signature), md5, 'CHAIN_PREDECESSOR_DIFFERS_FROM_DEV:' + signature);
  pass('CHAIN_PREDECESSORS_EQUAL_THE_DEV_PINS');
  const closureBefore = closure(); assert.equal(closureBefore.ready, true); assert.equal(closureBefore.live, closureBefore.certified);
  const surfaceBefore = surface();
  assert.equal(exists(STATES), false); assert.equal(exists(PAGE), false);
  const f = await buildFixture();
  const {owner, stranger, other, need, full, emptyNeed, foreign, made, fullMade} = f;
  const old = await whole(owner.client, need), oldFull = await whole(owner.client, full);
  assert.equal(old.length, SPEC.length + 1, 'FIXTURE_CANDIDATE_COUNT (the earlier selection is one of them)');
  const states = Object.fromEntries(Object.entries(old.reduce((acc, item) => { acc[item.state] = (acc[item.state] ?? 0) + 1; return acc; }, {})));
  for (const state of ['SELECTABLE', 'OVERFILL', 'WITHDRAWN', 'CLOSED', 'STALE', 'SELECTED']) assert.ok(states[state] > 0, 'FIXTURE_HAS_STATE_' + state);
  assert.ok(oldFull.some(item => item.state === 'FULL'), 'FIXTURE_HAS_STATE_FULL');
  assert.ok(old.some(item => item.applicationEvidence.schema === 'LEGACY_UNPROVEN') && old.some(item => item.applicationEvidence.schema === 'APPLICATION_V1_SELF_DECLARED'), 'FIXTURE_HAS_BOTH_EVIDENCE_KINDS');
  report.states = states;
  const oracleStates = rows(`select response_id, candidate_state from private.need_candidate_states_v5(${q(need)}::uuid)`);
  assert.equal(oracleStates.length, old.length);
  const oldCost = costOf(owner, `public.rpc_list_need_candidates(${q(need)}::uuid)`);
  assert.equal(oldCost.profiles, old.length, 'REPRODUCED_THE_WHOLE_LIST_READS_ONE_PUBLIC_PROFILE_PER_CANDIDATE'); assert.ok(oldCost.matches > 100, 'REPRODUCED_AND_MATCHES_EVERY_SELECTABLE_CANDIDATE');
  report.cost = {whole: oldCost};
  pass('REPRODUCED_THE_WHOLE_LIST_READS_AND_MATCHES_EVERY_CANDIDATE_OF_THE_TASK');

  // ---------------------------------------------------------------- APPLY
  const drift = candidate.replace(`'${'15cb0fd9d891a4ce6d4fdc7ea79abcd1'}'`, `'${'0'.repeat(32)}'`); assert.notEqual(drift, candidate);
  assert.throws(() => sql(drift), /EX04D_PREDECESSOR_DRIFT/);
  assert.deepEqual(surface(), surfaceBefore); pass('PREDECESSOR_DRIFT_REFUSED_ATOMICALLY');
  assert.throws(() => sql(`begin; set local session_replication_role=replica; update private.closure_source_v5 set sha256=repeat('0',64) where singleton; ${candidate}\nrollback;`), /EX04D_CLOSURE_NOT_READY/);
  assert.deepEqual(surface(), surfaceBefore); assert.deepEqual(closure(), closureBefore); pass('UNCERTIFIED_CLOSURE_REFUSED_ATOMICALLY');
  sql(candidate);
  assert.throws(() => sql(candidate), /EX04D_ALREADY_APPLIED/); pass('APPLIED_ONCE_SECOND_RUN_REFUSED');
  const surfaceAfter = surface();
  const removed = surfaceBefore.filter(line => !surfaceAfter.includes(line)), added = surfaceAfter.filter(line => !surfaceBefore.includes(line));
  const names = lines => lines.map(line => line.split(':')[1].split('(')[0]).sort();
  assert.equal(removed.length, 0, 'NOTHING_THAT_EXISTED_CHANGED'); assert.deepEqual(names(added), ['private.need_candidate_states_v5', 'public.rpc_list_need_candidates_page']); assert.equal(added.length, 2);
  report.surfaceAdded = added;
  pass('ONLY_TWO_FUNCTIONS_ARE_NEW_AND_NOTHING_THAT_EXISTED_CHANGED');
  assert.deepEqual(closure(), closureBefore); pass('CERTIFICATE_UNCHANGED_READY');
  const flight = JSON.parse(sql(postflight)); assert.deepEqual(flight.problems, []); report.postflight = flight; pass('DEV_POSTFLIGHT_FILE_EMPTY_ON_THE_CHAIN');
  report.candidateSha256 = sha(trimmed(candidate)); report.revertSha256 = sha(trimmed(revert)); report.postflightSha256 = sha(trimmed(postflight));
  await readerReady(owner.client, need);

  // ---------------------------------------------------------------- AFTER
  const oldDocs = json(old);
  for (const limit of [1, 2, 3, 7, 50, 100]) {
    const paged = await readPages(owner.client, need, limit);
    assert.deepEqual(paged.items.map(withoutSortAt), oldDocs, 'PAGED_DOCUMENTS_EQUAL_THE_WHOLE_LIST_AT_LIMIT_' + limit);
    assert.equal(new Set(ids(paged.items)).size, paged.items.length, 'NO_DUPLICATE_ID');
    assert.equal(paged.pages.length, Math.ceil(old.length / limit)); assert.ok(paged.pages.every((page, i) => page.items.length <= limit && page.hasMore === (i < paged.pages.length - 1)));
    assert.deepEqual(paged.pages[0].counts, {total: old.length}); assert.ok(paged.pages.slice(1).every(page => page.counts === null), 'LATER_PAGES_DO_NOT_PAY_FOR_THE_TOTAL');
    assert.ok(paged.items.every((item, i) => i === 0 || item.sortAt > paged.items[i - 1].sortAt || (item.sortAt === paged.items[i - 1].sortAt && item.responseId > paged.items[i - 1].responseId)), 'ORDER_IS_SUBMISSION_THEN_ID_ASCENDING');
  }
  assert.ok(oldDocs.some((item, i) => i > 0 && made.find(m => m.response === item.responseId)?.sub === made.find(m => m.response === oldDocs[i - 1].responseId)?.sub), 'FIXTURE_HAS_TIES');
  const pagedFull = await readPages(owner.client, full, 2);
  assert.deepEqual(pagedFull.items.map(withoutSortAt), json(oldFull)); assert.ok(pagedFull.items.some(item => item.state === 'FULL'));
  const empty = (await readPages(owner.client, emptyNeed, 5)).pages[0]; assert.deepEqual({...empty, asOf: null}, {items: [], hasMore: false, counts: {total: 0}, asOf: null});
  pass('PAGED_DOCUMENTS_EQUAL_THE_WHOLE_LIST_ACROSS_TIES_STATES_AND_LIMITS');
  // The state function for a set of responses: the whole function's answer, restricted.
  const allIds = old.map(item => item.responseId), oracle = Object.fromEntries(oracleStates.map(row => [row.response_id, row.candidate_state]));
  const statesFor = list => Object.fromEntries(rows(`select response_id, candidate_state from private.need_candidate_states_v5(${q(need)}::uuid, ${list === null ? 'null::uuid[]' : `array[${list.map(id => q(id) + '::uuid').join(',')}]::uuid[]`})`).map(row => [row.response_id, row.candidate_state]));
  assert.deepEqual(statesFor(allIds), oracle, 'THE_STATES_OF_ALL_EQUAL_THE_WHOLE_FUNCTION');
  const subset = allIds.filter((_, i) => i % 7 === 0);
  assert.deepEqual(statesFor(subset), Object.fromEntries(subset.map(id => [id, oracle[id]])), 'THE_STATES_OF_A_SUBSET_ARE_THE_SAME_STATES');
  assert.deepEqual(statesFor([]), {}); assert.deepEqual(statesFor(null), {});
  assert.deepEqual(statesFor([...subset.slice(0, 3), randomUUID(), fullMade[0].response]), Object.fromEntries(subset.slice(0, 3).map(id => [id, oracle[id]])), 'AN_ID_OF_ANOTHER_TASK_OR_NONE_IS_IGNORED');
  pass('THE_STATES_FOR_A_SET_OF_RESPONSES_ARE_THE_WHOLE_FUNCTIONS_STATES');
  // The work of a page is the work of its own candidates.
  const pageCost = costOf(owner, `public.rpc_list_need_candidates_page(${q(need)}::uuid, 30)`);
  assert.ok(pageCost.profiles <= 30 && pageCost.matches <= 30, 'A_PAGE_WORKS_FOR_ITS_OWN_CANDIDATES_ONLY: ' + JSON.stringify(pageCost)); assert.ok(pageCost.profiles > 0);
  const oneCost = costOf(owner, `public.rpc_list_need_candidates_page(${q(need)}::uuid, 5)`); assert.ok(oneCost.profiles <= 5 && oneCost.matches <= 5);
  report.cost = {whole: oldCost, pageOf30: pageCost, pageOf5: oneCost};
  pass('A_PAGE_PAYS_ONLY_FOR_ITS_OWN_CANDIDATES_THE_WHOLE_LIST_PAYS_FOR_ALL');
  // A walk that survives a change between pages: states move, a newer application arrives; nothing that did not change is skipped or repeated.
  {
    const first = await ok(owner.client.rpc('rpc_list_need_candidates_page', {p_need_id: need, p_limit: 30}));
    const seen = ids(first.items), last = first.items[first.items.length - 1];
    const shownEarly = made.find(item => item.raw === 'SUBMITTED' && item.k.startsWith('ok_')), later = made.filter(item => item.k.startsWith('bulk_') && !seen.includes(item.response)).slice(0, 2);
    assert.ok(shownEarly && seen.includes(shownEarly.response) && later.length === 2);
    const arrival = candidateSql(need, {k: 'arrival', raw: 'SUBMITTED', slots: 1, sub: 9999}, 900);
    sql(`begin; set local session_replication_role=replica;
      update public.marketplace_responses set status='WITHDRAWN' where id in (${q(shownEarly.response)},${q(later[0].response)});
      ${arrival.text} commit;`);
    let cursor = {at: last.sortAt, id: last.responseId}; const rest = [];
    for (let guard = 0; guard < 100; guard++) {
      const page = await ok(owner.client.rpc('rpc_list_need_candidates_page', {p_need_id: need, p_limit: 25, p_after_at: cursor.at, p_after_id: cursor.id}));
      rest.push(...page.items); if (!page.hasMore) break;
      const tail = page.items[page.items.length - 1]; cursor = {at: tail.sortAt, id: tail.responseId};
    }
    const walked = [...seen, ...ids(rest)], count = new Map(); walked.forEach(id => count.set(id, (count.get(id) ?? 0) + 1));
    assert.ok([...count.values()].every(n => n === 1), 'NOTHING_IS_SEEN_TWICE'); assert.ok(old.every(item => count.has(item.responseId)), 'NOTHING_THAT_EXISTED_IS_SKIPPED');
    assert.ok(count.has(arrival.response), 'A_NEWER_APPLICATION_ARRIVES_AT_THE_END_OF_THE_WALK');
    assert.equal(rest.find(item => item.responseId === later[0].response).state, 'WITHDRAWN', 'A_CHANGE_BEFORE_THE_WALK_REACHES_IT_IS_SEEN_AS_IT_IS_NOW');
    sql(`begin; set local session_replication_role=replica; update public.marketplace_responses set status='SUBMITTED' where id in (${q(shownEarly.response)},${q(later[0].response)});
      delete from private.response_application_snapshots where response_id=${q(arrival.response)}; delete from public.marketplace_response_versions where response_id=${q(arrival.response)};
      delete from public.marketplace_responses where id=${q(arrival.response)}; commit;`);
    assert.deepEqual((await readPages(owner.client, need, 50)).items.map(withoutSortAt), oldDocs, 'THE_FIXTURE_IS_RESTORED');
  }
  pass('A_WALK_SURVIVES_A_CHANGE_BETWEEN_PAGES_WITHOUT_SKIPS_OR_REPEATS');
  // Authority and input.
  await denied(stranger.client.rpc('rpc_list_need_candidates_page', {p_need_id: need, p_limit: 5}), 'NOT_REQUESTER');
  await denied(owner.client.rpc('rpc_list_need_candidates_page', {p_need_id: foreign, p_limit: 5}), 'NOT_REQUESTER');
  await denied(owner.client.rpc('rpc_list_need_candidates_page', {p_need_id: randomUUID(), p_limit: 5}), 'NEED_NOT_FOUND');
  await denied(owner.client.rpc('rpc_list_need_candidates_page', {p_need_id: null, p_limit: 5}), 'NEED_ID_REQUIRED');
  for (const args of [{p_limit: 0}, {p_limit: 101}, {p_limit: null}, {p_after_at: '2026-03-01T10:00:00+00:00'}, {p_after_id: randomUUID()}])
    await denied(owner.client.rpc('rpc_list_need_candidates_page', {p_need_id: need, ...args}), 'INVALID_PAGE');
  await denied(rt.anon.rpc('rpc_list_need_candidates_page', {p_need_id: need, p_limit: 5}));
  assert.ok((await owner.client.rpc('need_candidate_states_v5', {p_need_id: need, p_response_ids: allIds.slice(0, 2)})).error, 'THE_STATE_FUNCTION_IS_NOT_CALLABLE');
  pass('AUTHORITY_AND_INPUT_ARE_THE_WHOLE_LISTS_AND_THE_PRIVATE_FUNCTION_IS_NOT_CALLABLE');
  // The real client TypeScript: the same candidates, whichever way they were read.
  const mods = loadModules({client: owner.client, accountId: owner.id}), service = mods.load('data/candidateClientService').candidateClientService;
  const wholeMapped = await service.prijaveZaPotrebu(need);
  const got = []; let cursor = null, firstCounts;
  for (let guard = 0; guard < 100; guard++) {
    const page = await service.prijaveZaPotrebuStrana(need, {limit: 50, cursor});
    got.push(...page.items); if (cursor === null) firstCounts = json(page.counts); else assert.equal(page.counts, null);
    if (!page.hasMore) break; cursor = page.cursor;
  }
  assert.deepEqual(json(got), json(wholeMapped), 'THE_REAL_CLIENT_PROJECTION_OF_THE_PAGES_EQUALS_THE_WHOLE_LIST'); assert.deepEqual(firstCounts, {total: old.length});
  assert.equal(got.filter(row => row.mozeIzabrati).length, old.filter(item => item.canSelect).length);
  report.clientSources = mods.sources;
  pass('THE_REAL_CLIENT_PROJECTION_OF_THE_PAGES_EQUALS_THE_WHOLE_LIST_PROJECTION');
  assert.deepEqual(closure(), closureBefore); pass('CLOSURE_STAYS_READY_AFTER_THE_READS');

  // ---------------------------------------------------------------- REVERT
  sql(revert);
  assert.equal(exists(STATES), false); assert.equal(exists(PAGE), false);
  assert.deepEqual(surface(), surfaceBefore, 'THE_WHOLE_CATALOG_IS_RESTORED_EXACTLY'); assert.deepEqual(closure(), closureBefore);
  assert.throws(() => sql(revert), /EX04D_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  assert.deepEqual(json(await whole(owner.client, need)), oldDocs, 'THE_WHOLE_LIST_IS_UNTOUCHED_BY_APPLY_AND_REVERT');
  pass('REVERT_RESTORES_THE_COMPLETE_CATALOG_AND_REFUSES_TO_RUN_TWICE');
  sql(candidate); assert.deepEqual(surface(), surfaceAfter, 'REAPPLY_PRODUCES_THE_SAME_CATALOG'); assert.deepEqual(closure(), closureBefore);
  assert.deepEqual(JSON.parse(sql(postflight)).problems, []);
  await sleep(1500); await readerReady(owner.client, need);
  assert.deepEqual((await readPages(owner.client, need, 40)).items.map(withoutSortAt), oldDocs); pass('REAPPLY_AGAIN_EQUAL_AND_PARITY_HOLDS');
  report.result = 'PASS'; save();
}
main().catch(error => { report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save(); console.error(report.failure); process.exit(1); });
