// EX-04 S1 (A09 Moji zadaci): the completed paged own-task reader, proved on a disposable SQL stack with actual Auth and PostgREST only.
// One process, five phases on ONE fixture: BEFORE (reproduce the gaps on the DEV-equivalent predecessor), APPLY (refusals, the atomic application, the exact catalog delta),
// AFTER (parity with the ordinary read, the client's own TypeScript rules, bounded cost, authority), REVERT (the exact inverse restores the whole catalog), REAPPLY.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from './ts_loader.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const OLD_PAGE_MD5 = 'dad1de3234e72d4e2f44be5e920eda61';
const PAGE = 'public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)';
const HELPER = 'private.own_task_counts(uuid)';
const candidate = readFileSync('supabase/candidates/ex04a_own_tasks_page.sql', 'utf8');
const revert = readFileSync('supabase/candidates/ex04a_own_tasks_page_revert.sql', 'utf8');
const postflight = readFileSync('supabase/proofs/ex04/ex04a_postflight.readonly.sql', 'utf8');
const reportPath = env.PRE_V3_ARTIFACT_DIR + '/ex04a-report.json';
const report = {package: 'EX-04 S1 (A09 Moji zadaci): paged own-task reader completed in place', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, providerCalls: 0, checks: []};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const pass = name => { report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name); };
const sha = text => createHash('sha256').update(text).digest('hex');
const trimmed = text => text.replace(/\n$/, '');
const bodyMd5 = signature => sql(`select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid=${q(signature)}::regprocedure`);
const helperExists = () => sql(`select to_regprocedure(${q(HELPER)}) is not null`) === 't';
const closure = () => rows('select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready')[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const withClaims = id => `select set_config('request.jwt.claim.sub',${q(id)},true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims',${q(JSON.stringify({sub: id, role: 'authenticated'}))},true);`;
const strip = ({sortAt, ...document}) => document;
const ids = list => list.map(item => item.id);

// ------------------------------------------------------------------ fixture
const party = () => ({id: randomUUID(), requester: randomUUID(), worker: randomUUID()});
const insertParty = (p, capacity = 3) => `insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values
  (${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',1,false),
  (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad','ACTIVE','{ciscenje}',${capacity},true);`;
const SPEC = [
  {k: 'draft1', status: 'DRAFT', mode: 'OFFERS'}, {k: 'draft2', status: 'DRAFT', mode: 'MY_PRICE', basis: 'TOTAL'}, {k: 'draft3', status: 'DRAFT', mode: 'OFFERS'},
  {k: 'wait_myprice', status: 'PUBLISHED', mode: 'MY_PRICE', basis: 'PER_PERSON', urgent: true, responses: [{status: 'SUBMITTED'}]},
  {k: 'wait_offers', status: 'PUBLISHED', mode: 'OFFERS', responses: [{status: 'SUBMITTED'}, {status: 'VIEWED'}]},
  {k: 'withdrawn_only', status: 'PUBLISHED', mode: 'MY_PRICE', basis: 'TOTAL', responses: [{status: 'WITHDRAWN'}]},
  {k: 'no_responses', status: 'PUBLISHED', mode: 'OFFERS'},
  {k: 'stale', status: 'PUBLISHED', mode: 'OFFERS', responses: [{status: 'SUBMITTED', stale: true}]},
  {k: 'partial', status: 'SELECTION', mode: 'OFFERS', selected: 1, responses: [{status: 'SUBMITTED', slots: 1}]},
  {k: 'full', status: 'SELECTION', mode: 'OFFERS', selected: 3, responses: [{status: 'SUBMITTED', slots: 1}]},
  {k: 'active1', status: 'ACTIVE', mode: 'OFFERS', selected: 3}, {k: 'active2', status: 'ACTIVE', mode: 'MY_PRICE', basis: 'PER_PERSON', selected: 3},
  {k: 'done1', status: 'COMPLETED', mode: 'OFFERS'}, {k: 'done2', status: 'COMPLETED', mode: 'OFFERS'},
  {k: 'cancel1', status: 'CANCELLED', mode: 'OFFERS'}, {k: 'cancel2', status: 'CANCELLED', mode: 'MY_PRICE', basis: 'TOTAL'},
  {k: 'expired1', status: 'EXPIRED', mode: 'OFFERS'}, {k: 'expired2', status: 'EXPIRED', mode: 'OFFERS'}, {k: 'archived', status: 'ARCHIVED', mode: 'OFFERS'},
];
const needSql = (need, owner, index) => `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,
  mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline,urgent,urgent_activated_at,urgent_expires_at,created_at) values(
  ${q(need.id)},${q(owner.id)},${q(owner.requesterProfile)},${q(need.status)},${q('EX04A ' + need.k)},'Disposable fixture','PROOF','{}','Novi Sad','Liman',
  ${q(need.mode)},3,'FLEXIBLE',${need.status === 'DRAFT' ? 'null' : "now()-interval '1 hour'"},'Europe/Belgrade',2,5000,${need.mode === 'MY_PRICE' ? q(need.basis) : 'null'},now()+interval '2 days',
  ${need.urgent ? 'true' : 'false'},${need.urgent ? "now()-interval '1 hour'" : 'null'},${need.urgent ? "now()+interval '1 day'" : 'null'},
  timestamptz '2026-03-01 10:00:00+00' + interval '${Math.floor(index / 2)} minutes');`;   // pairs share one created_at: the keyset tie-breaker is exercised
const responseSql = (need, worker, response, status = response.status) => {
  const id = randomUUID(), revision = response.stale ? 1 : 2, slots = response.slots ?? 2, hash = sha(id);
  return `insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note)
    values(${q(id)},${q(need.id)},${q(worker.id)},${q(worker.worker)},'OFFER',${q(status)},${revision},1,10000,${slots},'Proof scope');
    insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash,proposed_start_at,proposed_end_at)
    values(${q(id)},1,${revision},10000,${slots},'Proof scope',${q(hash)},null,null);`;
};
async function buildFixture() {
  const owner = await rt.actor('ex04a-owner'), bulk = await rt.actor('ex04a-bulk'), stranger = await rt.actor('ex04a-stranger');
  const profile = actor => rows(`select id from public.app_profiles where account_id=${q(actor.id)} and kind='REQUESTER'`)[0].id;
  owner.requesterProfile = profile(owner); bulk.requesterProfile = profile(bulk);
  const workers = [party(), party(), party(), party()];
  const needs = SPEC.map(item => ({...item, id: randomUUID()}));
  let text = workers.map(w => insertParty(w)).join('\n');
  needs.forEach((need, index) => {
    text += needSql(need, owner, index);
    (need.responses ?? []).forEach((response, i) => { text += responseSql(need, workers[i], response); });
    if (need.selected) {
      const previous = {status: 'SELECTED', slots: need.selected};
      const id = randomUUID();
      text += `insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note)
        values(${q(id)},${q(need.id)},${q(workers[3].id)},${q(workers[3].worker)},'OFFER','SELECTED',2,1,10000,${need.selected},'Proof scope');
        insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash,proposed_start_at,proposed_end_at)
        values(${q(id)},1,2,10000,${need.selected},'Proof scope',${q(sha(id))},null,null);
        insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,status,response_id,worker_account_id,worker_profile_id)
        values(${q(need.id)},2,${q(owner.id)},${q('ex04a-' + need.k)},${need.selected},'SELECTED',${q(id)},${q(workers[3].id)},${q(workers[3].worker)});`;
    }
  });
  // 150 plain tasks for another account: the cost of a page against the cost of the whole list.
  text += `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,
    schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline,created_at)
    select gen_random_uuid(),${q(bulk.id)},${q(bulk.requesterProfile)},(array['DRAFT','PUBLISHED','COMPLETED'])[1 + (i % 3)],'EX04A bulk ' || i,'Disposable fixture','PROOF','{}','Novi Sad','Liman','OFFERS',
    2,'FLEXIBLE',now()-interval '1 hour','Europe/Belgrade',2,null,null,now()+interval '2 days', timestamptz '2026-02-01 10:00:00+00' + (i || ' minutes')::interval
    from generate_series(1,150) i;`;
  sql(`begin; set local session_replication_role=replica; ${text} set local session_replication_role=origin; commit;`);
  return {owner, bulk, stranger, needs, workers};
}

// ------------------------------------------------------------------ reads
async function readPages(client, scope, limit) {
  const items = [], pages = []; let before = null, counts, guard = 0;
  for (;;) {
    const args = {p_scope: scope, p_limit: limit}; if (before) { args.p_before_at = before.at; args.p_before_id = before.id; }
    const page = await ok(client.rpc('rpc_list_my_needs_page', args));
    pages.push(page); items.push(...page.items);
    if (!before) counts = page.counts;
    if (!page.hasMore) break;
    const last = page.items[page.items.length - 1]; before = {at: last.sortAt, id: last.id};
    assert.ok(++guard < 1000, 'PAGING_DID_NOT_TERMINATE');
  }
  return {items, pages, counts};
}
const pagedClient = (client, limit) => ({auth: client.auth, rpc: async (name, args) => {
  if (name !== 'rpc_list_my_tasks') return client.rpc(name, args);
  return {data: (await readPages(client, 'ALL', limit)).items.map(strip), error: null};
}});

async function main() {
  // ---------------------------------------------------------------- BEFORE
  for (const [signature, md5] of [
    [PAGE, OLD_PAGE_MD5], ['public.rpc_list_my_tasks()', '2a8ff0fa8a1211414e5e1fc69c6fb4f7'], ['public.rpc_read_task(uuid)', '1e01db5140248f27ab374187f01fded3'],
    ['public.selectable_application_count(public.needs)', 'fe53442f8b661d6f33d22a54e2a468a8'], ['public.covered_slots(public.needs)', 'cbeb8f2a3da7d08965ef0386cfc437ba'],
    ['public.rpc_storage_account_open()', '7350621ef256678e209aa6a28c79b58b'], ['private.need_candidate_states_v5(uuid)', '6d65e304f41f3e130228f58874757f0d'],
  ]) assert.equal(bodyMd5(signature), md5, 'CHAIN_PREDECESSOR_DIFFERS_FROM_DEV:' + signature);
  pass('CHAIN_PREDECESSORS_EQUAL_THE_DEV_PINS');
  const closureBefore = closure(); assert.equal(closureBefore.ready, true); assert.equal(closureBefore.live, closureBefore.certified);
  const surfaceBefore = surface();
  assert.equal(helperExists(), false);
  const f = await buildFixture();
  const {owner, bulk, stranger} = f;
  const list = await ok(owner.client.rpc('rpc_list_my_tasks', {}));
  assert.equal(list.length, SPEC.length, 'FIXTURE_TASK_COUNT');
  const old = await readPages(owner.client, 'ALL', 100);
  assert.equal(old.items.length, SPEC.length);
  const waitingTask = old.items.find(item => item.title === 'EX04A wait_myprice');
  assert.ok(waitingTask, 'FIXTURE_WAITING_TASK_PRESENT');
  assert.equal('price_basis' in waitingTask || 'selectable_application_count' in waitingTask, false);
  assert.ok('selectable_application_count' in list.find(item => item.id === waitingTask.id));
  pass('REPRODUCED_PAGE_ITEM_LACKS_PRICE_BASIS_AND_SELECTABLE_COUNT');
  const activeBefore = await readPages(owner.client, 'ACTIVE', 100);
  assert.ok(activeBefore.items.some(item => item.status === 'DRAFT'), 'the old ACTIVE scope lists drafts');
  pass('REPRODUCED_ACTIVE_SCOPE_INCLUDES_DRAFTS');
  assert.equal(old.counts, undefined); await denied(owner.client.rpc('rpc_list_my_needs_page', {p_scope: 'DRAFTS', p_limit: 5}), 'INVALID_SCOPE');
  pass('REPRODUCED_NO_COUNTS_AND_NO_DRAFTS_SCOPE');

  // ---------------------------------------------------------------- APPLY
  const drift = candidate.replace(`'${OLD_PAGE_MD5}'`, `'${'0'.repeat(32)}'`); assert.notEqual(drift, candidate);
  assert.throws(() => sql(drift), /EX04A_PREDECESSOR_DRIFT/);
  assert.deepEqual(surface(), surfaceBefore); pass('PREDECESSOR_DRIFT_REFUSED_ATOMICALLY');
  assert.throws(() => sql(`begin; set local session_replication_role=replica; update private.closure_source_v5 set sha256=repeat('0',64) where singleton; ${candidate}\nrollback;`), /EX04A_CLOSURE_NOT_READY/);
  assert.deepEqual(surface(), surfaceBefore); assert.deepEqual(closure(), closureBefore); pass('UNCERTIFIED_CLOSURE_REFUSED_ATOMICALLY');
  sql(candidate);
  assert.throws(() => sql(candidate), /EX04A_ALREADY_APPLIED/); pass('APPLIED_ONCE_SECOND_RUN_REFUSED');
  const surfaceAfter = surface();
  const removed = surfaceBefore.filter(line => !surfaceAfter.includes(line)), added = surfaceAfter.filter(line => !surfaceBefore.includes(line));
  const names = list => list.map(line => line.split(':')[1].split('(')[0]).sort();
  assert.deepEqual(names(removed), ['public.rpc_list_my_needs_page']);
  assert.deepEqual(names(added), ['private.own_task_counts', 'public.rpc_list_my_needs_page']);
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  pass('ONLY_THE_READER_CHANGED_AND_ONLY_THE_HELPER_IS_NEW');
  assert.deepEqual(closure(), closureBefore); pass('CERTIFICATE_UNCHANGED_READY');
  const flight = JSON.parse(sql(postflight)); assert.deepEqual(flight.problems, []); report.postflight = flight; pass('DEV_POSTFLIGHT_FILE_EMPTY_ON_THE_CHAIN');
  report.candidateSha256 = sha(trimmed(candidate)); report.revertSha256 = sha(trimmed(revert)); report.postflightSha256 = sha(trimmed(postflight));

  // ---------------------------------------------------------------- AFTER
  const mods = loadModules({client: owner.client, accountId: owner.id}), service = mods.load('data/needClientService').needClientService, view = mods.load('data/marketplaceView');
  const mapped = await service.mojePotrebe({includeUrgency: false});
  assert.equal(mapped.length, SPEC.length);
  // The VM realm builds its own objects: the strict comparison against the server's counts needs a plain main-realm copy.
  const expectedCounts = JSON.parse(JSON.stringify(view.ownedTaskCounts(mapped)));
  assert.equal(expectedCounts.waiting, 3, 'FIXTURE_WAITING_COUNT'); assert.equal(expectedCounts.drafts, 3); assert.equal(expectedCounts.history, 7); assert.equal(expectedCounts.active, 9); assert.equal(expectedCounts.total, 19);
  report.clientSources = mods.sources;
  for (const limit of [1, 2, 3, 7, 100]) {
    const paged = await readPages(owner.client, 'ALL', limit);
    assert.deepEqual(paged.items.map(strip), list, 'PAGED_DOCUMENTS_EQUAL_THE_ORDINARY_READ_AT_LIMIT_' + limit);
    assert.equal(new Set(ids(paged.items)).size, paged.items.length, 'NO_DUPLICATE_ID');
    assert.equal(paged.pages.length, Math.ceil(SPEC.length / limit));
    assert.ok(paged.pages.every((page, i) => page.hasMore === (i < paged.pages.length - 1)));
    assert.ok(paged.items.every((item, i) => i === 0 || (item.sortAt < paged.items[i - 1].sortAt || (item.sortAt === paged.items[i - 1].sortAt && item.id < paged.items[i - 1].id))), 'ORDER_IS_CREATED_AT_THEN_ID_DESCENDING');
  }
  assert.ok(old.items.some((item, i) => i > 0 && item.sortAt === old.items[i - 1].sortAt), 'FIXTURE_HAS_TIES'); pass('PAGED_DOCUMENTS_EQUAL_THE_ORDINARY_READ_ACROSS_TIES_AND_LIMITS');
  const viaPages = await loadModules({client: pagedClient(owner.client, 7), accountId: owner.id}).load('data/needClientService').needClientService.mojePotrebe({includeUrgency: false});
  assert.deepEqual(JSON.parse(JSON.stringify(viaPages)), JSON.parse(JSON.stringify(mapped))); pass('THE_REAL_CLIENT_PROJECTION_OF_THE_PAGES_EQUALS_THE_ORDINARY_READ');
  const section = key => view.marketplaceItems(mapped, {...view.initialMarketplaceView(), section: key}, true).map(item => item.id);
  const expectedScopes = {ALL: section('all'), ACTIVE: section('active'), DRAFTS: section('drafts'), HISTORY: section('history'), WAITING: mapped.filter(view.hasNeedAttention).map(item => item.id)};
  for (const [scope, expected] of Object.entries(expectedScopes)) for (const limit of [1, 4, 100]) {
    const paged = await readPages(owner.client, scope, limit);
    assert.deepEqual(ids(paged.items), expected, `SCOPE_${scope}_EQUALS_THE_CLIENT_RULE_AT_LIMIT_${limit}`);
    assert.deepEqual(paged.items.map(strip), list.filter(item => expected.includes(item.id)));
  }
  pass('EVERY_SCOPE_EQUALS_THE_CLIENTS_OWN_SECTION_AND_ATTENTION_RULES');
  for (const scope of Object.keys(expectedScopes)) {
    const paged = await readPages(owner.client, scope, 2);
    assert.deepEqual(paged.counts, expectedCounts, 'COUNTS_EQUAL_ownedTaskCounts_' + scope);
    assert.ok(paged.pages.slice(1).every(page => page.counts === null), 'LATER_PAGES_DO_NOT_PAY_FOR_COUNTS');
  }
  pass('FIRST_PAGE_COUNTS_EQUAL_THE_CLIENT_COUNTS_AND_LATER_PAGES_CARRY_NONE');
  const dbCalls = text => Number(sql(`begin; set local track_functions='all'; ${withClaims(bulk.id)} ${text}
    select coalesce((select calls from pg_stat_xact_user_functions where funcid='public.rpc_read_task(uuid)'::regprocedure),0); rollback;`).split(/\r?\n/).pop());
  const pageCalls = dbCalls("select jsonb_array_length(public.rpc_list_my_needs_page('ALL',30,null,null)->'items');");
  const listCalls = dbCalls('select jsonb_array_length(public.rpc_list_my_tasks());');
  assert.ok(pageCalls <= 31, 'PAGE_READS_AT_MOST_LIMIT_PLUS_ONE_TASKS:' + pageCalls); assert.equal(listCalls, 150);
  report.cost = {pageOf30ReadTaskCalls: pageCalls, wholeListReadTaskCalls: listCalls}; pass('A_PAGE_READS_AT_MOST_LIMIT_PLUS_ONE_TASKS_THE_LIST_READS_ALL');
  const bulkPage = await ok(bulk.client.rpc('rpc_list_my_needs_page', {p_scope: 'ALL', p_limit: 30}));
  assert.equal(bulkPage.items.length, 30); assert.equal(bulkPage.hasMore, true); assert.equal(bulkPage.counts.total, 150);
  assert.ok(bulkPage.items.every(item => !ids(old.items).includes(item.id)), 'NO_FOREIGN_TASK'); pass('A_LONG_LIST_PAGES_AND_COUNTS_ITS_WHOLE_TOTAL');
  for (const args of [{p_limit: 0}, {p_limit: 101}, {p_limit: null}, {p_before_at: '2026-03-01T10:00:00+00:00'}, {p_before_id: randomUUID()}])
    await denied(owner.client.rpc('rpc_list_my_needs_page', {p_scope: 'ALL', ...args}), 'INVALID_PAGE');
  for (const scope of ['BOGUS', 'active', '', null]) await denied(owner.client.rpc('rpc_list_my_needs_page', {p_scope: scope, p_limit: 5}), 'INVALID_SCOPE');
  pass('INVALID_PAGE_AND_SCOPE_ARE_REFUSED_BY_NAME');
  const outsider = await ok(stranger.client.rpc('rpc_list_my_needs_page', {p_scope: 'ALL', p_limit: 30}));
  assert.deepEqual(outsider.items, []); assert.deepEqual(outsider.counts, {total: 0, active: 0, drafts: 0, history: 0, waiting: 0});
  await denied(rt.anon.rpc('rpc_list_my_needs_page', {p_scope: 'ALL', p_limit: 30}));
  assert.ok((await owner.client.rpc('own_task_counts', {a: owner.id})).error, 'THE_HELPER_IS_NOT_EXPOSED');
  pass('OUTSIDER_SEES_NOTHING_ANON_IS_DENIED_THE_HELPER_IS_NOT_CALLABLE');
  assert.deepEqual(closure(), closureBefore); pass('CLOSURE_STAYS_READY_AFTER_THE_READS');

  // ---------------------------------------------------------------- REVERT
  sql(revert);
  assert.equal(bodyMd5(PAGE), OLD_PAGE_MD5); assert.equal(helperExists(), false);
  assert.deepEqual(surface(), surfaceBefore, 'THE_WHOLE_CATALOG_IS_RESTORED_EXACTLY'); assert.deepEqual(closure(), closureBefore);
  assert.throws(() => sql(revert), /EX04A_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  pass('REVERT_RESTORES_THE_COMPLETE_CATALOG_AND_REFUSES_TO_RUN_TWICE');
  sql(candidate); assert.deepEqual(surface(), surfaceAfter, 'REAPPLY_PRODUCES_THE_SAME_CATALOG'); assert.deepEqual(closure(), closureBefore);
  assert.deepEqual(JSON.parse(sql(postflight)).problems, []);
  assert.deepEqual((await readPages(owner.client, 'ALL', 7)).items.map(strip), list); pass('REAPPLY_AGAIN_EQUAL_AND_PARITY_HOLDS');
  report.result = 'PASS'; save();
}
main().catch(error => { report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save(); console.error(report.failure); process.exit(1); });
