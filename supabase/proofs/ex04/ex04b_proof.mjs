// EX-04 S2 (B10 Moje prijave): the completed paged own-application reader, proved on a disposable SQL stack with actual Auth and PostgREST only.
// One process, five phases on ONE fixture: BEFORE (reproduce the gaps on the DEV-equivalent predecessor), APPLY (refusals, the atomic application, the exact catalog delta),
// AFTER (the whole-list order and card facts kept across ties and limits, the task facts, the screen's own sections and counts through the real client TypeScript, a walk that
// survives a change between pages, bounded pages, authority), REVERT (the exact inverse restores the whole catalog), REAPPLY.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from './ts_loader.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const OLD_PAGE_MD5 = '0e0b1c3fc0cf0612d734c8b3071b1f44';
const OLD_PAGE = 'public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid)';
const PAGE = 'public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)';
const HELPER = 'private.own_application_rows(uuid)';
const candidate = readFileSync('supabase/candidates/ex04b_own_applications_page.sql', 'utf8');
const revert = readFileSync('supabase/candidates/ex04b_own_applications_page_revert.sql', 'utf8');
const postflight = readFileSync('supabase/proofs/ex04/ex04b_postflight.readonly.sql', 'utf8');
const reportPath = env.PRE_V3_ARTIFACT_DIR + '/ex04b-report.json';
const report = {package: 'EX-04 S2 (B10 Moje prijave): paged own-application reader completed, one shared row builder', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, providerCalls: 0, checks: []};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const pass = name => { report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name); };
const sha = text => createHash('sha256').update(text).digest('hex');
const trimmed = text => text.replace(/\n$/, '');
const bodyMd5 = signature => sql(`select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid=${q(signature)}::regprocedure`);
const exists = signature => sql(`select to_regprocedure(${q(signature)}) is not null`) === 't';
const closure = () => rows('select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready')[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const json = value => JSON.parse(JSON.stringify(value));
const ids = list => list.map(item => item.id);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pure = loadModules({client: {}, accountId: 'pure'});   // the client's own TypeScript rules, used as the oracle and for the cursor
const rankOf = item => pure.load('data/ownApplicationsPage').applicationRank({stanje: item.state, traziPaznju: item.attentionRequired});

// ------------------------------------------------------------------ fixture
const BASE = '2026-03-01 10:00:00+00';
const FACTS = [   // the task facts the card needs, cycled over the applications so every kind of term, place and price is present
  {kind: 'FIXED_WINDOW', loc: 'STATIONARY', starts: '2026-10-05 08:00:00+00', ends: '2026-10-05 10:00:00+00', tz: 'Europe/Belgrade', mode: 'OFFERS', basis: null, slots: 3, city: 'Novi Sad', area: 'Liman'},
  {kind: 'REMOTE_ANYTIME', loc: 'REMOTE', starts: null, ends: null, tz: null, mode: 'MY_PRICE', basis: 'TOTAL', price: 8000, slots: 1, city: '', area: ''},
  {kind: 'FLEXIBLE', loc: 'STATIONARY', starts: null, ends: '2026-10-09 21:59:59+00', tz: 'UTC', mode: 'OFFERS', basis: null, slots: 2, city: 'Beograd', area: 'Vračar, Beograd'},
  {kind: 'FIXED_WINDOW', loc: 'POINT_TO_POINT', starts: '2026-10-05 08:00:00+00', ends: '2026-10-12 16:00:00+00', tz: 'Europe/Belgrade', mode: 'MY_PRICE', basis: 'PER_PERSON', price: 2500, slots: 4, city: 'Niš', area: ''},
  {kind: 'WEEK_FLEXIBLE', loc: 'AREA_BASED', starts: '2026-10-05 00:00:00+00', ends: null, tz: 'Europe/Belgrade', mode: 'OFFERS', basis: null, slots: 2, city: 'Kragujevac', area: 'Centar'},
  {kind: 'REMOTE_ANYTIME', loc: 'REMOTE', starts: null, ends: '2026-10-20 21:59:59+00', tz: 'Europe/Belgrade', mode: 'OFFERS', basis: null, slots: 1, city: '', area: ''},
  {kind: 'TOMORROW_FLEXIBLE', loc: 'MULTI_STOP', starts: null, ends: null, tz: 'UTC', mode: 'MY_PRICE', basis: 'PER_PERSON', price: 3000, slots: 3, city: 'Subotica', area: ''},
];
// k, raw response status, need status, minutes after BASE the application was submitted (ties on purpose), optional: created (minutes), submitted against revision, agreement.
const SPEC = [
  // rank 0: what waits for me
  {k: 'sel_live', raw: 'SELECTED', need: 'ACTIVE', sub: 50, created: -7 * 1440, agreement: 'CONFIRMED'},
  {k: 'sel_done', raw: 'SELECTED', need: 'COMPLETED', sub: 50, agreement: 'COMPLETED'},
  {k: 'sel_raw', raw: 'SELECTED', need: 'ACTIVE', sub: 40},
  {k: 'stale_raw', raw: 'STALE_REVIEW_REQUIRED', need: 'PUBLISHED', sub: 40},
  {k: 'stale_rev', raw: 'SUBMITTED', need: 'PUBLISHED', sub: 30, against: 1},
  {k: 'stale_old', raw: 'STALE', need: 'SELECTION', sub: 20},
  // rank 1: still open
  {k: 'open_a', raw: 'SUBMITTED', need: 'PUBLISHED', sub: 90, created: -3 * 1440},
  {k: 'open_b', raw: 'DELIVERED', need: 'PUBLISHED', sub: 90},
  {k: 'viewed', raw: 'VIEWED', need: 'PUBLISHED', sub: 80},
  {k: 'short', raw: 'SHORTLISTED', need: 'SELECTION', sub: 80},
  {k: 'open_sel', raw: 'SUBMITTED', need: 'SELECTION', sub: 70},
  {k: 'cancelled_agreement', raw: 'SUBMITTED', need: 'PUBLISHED', sub: 60, agreement: 'CANCELLED'},
  // rank 2: the rest
  {k: 'withdrawn', raw: 'WITHDRAWN', need: 'PUBLISHED', sub: 100},
  {k: 'not_selected', raw: 'NOT_SELECTED', need: 'ACTIVE', sub: 100},
  {k: 'expired_raw', raw: 'EXPIRED', need: 'PUBLISHED', sub: 95},
  {k: 'need_completed', raw: 'SUBMITTED', need: 'COMPLETED', sub: 95},
  {k: 'need_cancelled', raw: 'SUBMITTED', need: 'CANCELLED', sub: 20},
  {k: 'need_expired', raw: 'SUBMITTED', need: 'EXPIRED', sub: 20},
  {k: 'need_archived', raw: 'VIEWED', need: 'ARCHIVED', sub: 10},
];
const minute = value => `timestamptz '${BASE}' + interval '${value} minutes'`;
const fixtureSql = (item, index, owner, workerProfile) => {
  const need = randomUUID(), response = randomUUID(), f = FACTS[index % FACTS.length];
  const requesterAccount = randomUUID(), requesterProfile = randomUUID();
  const status = item.need, published = status === 'DRAFT' ? 'null' : "now() - interval '1 hour'";
  let text = `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,
      mode,required_slots,schedule_kind,starts_at,ends_at,execution_location_mode,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline,created_at) values(
      ${q(need)},${q(requesterAccount)},${q(requesterProfile)},${q(status)},${q('EX04B ' + item.k)},'Disposable fixture','PROOF','{}',${q(f.city)},${q(f.area)},
      ${q(f.mode)},${f.slots},${q(f.kind)},${f.starts ? q(f.starts) : 'null'},${f.ends ? q(f.ends) : 'null'},${q(f.loc)},${published},${f.tz ? q(f.tz) : 'null'},2,
      ${f.price ?? 'null'},${f.basis ? q(f.basis) : 'null'},now() + interval '2 days',${minute(-1000)});
    insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note,submitted_at,created_at)
      values(${q(response)},${q(need)},${q(owner)},${q(workerProfile)},'OFFER',${q(item.raw)},${item.against ?? 2},1,${3000 + index * 100},${Math.min(f.slots, 2)},${item.k === 'open_a' ? q('Mogu pre podne') : "''"},
      ${item.raw === 'DRAFT' ? 'null' : minute(item.sub)},${minute(item.created ?? item.sub)});`;
  if (item.agreement) text += `insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,status,created_at,updated_at)
      values(${q(randomUUID())},${q(need)},${q(randomUUID())},${q(response)},${q(requesterAccount)},${q(requesterProfile)},${q(owner)},${q(workerProfile)},${q(item.agreement)},${minute(item.sub)},${minute(item.sub)});`;
  return {text, need, response};
};
const SPEC_ALL = [...SPEC, {k: 'draft', raw: 'DRAFT', need: 'PUBLISHED', sub: 0}];
async function buildFixture() {
  const worker = await rt.actor('ex04b-worker'), bulk = await rt.actor('ex04b-bulk'), stranger = await rt.actor('ex04b-stranger');
  const profile = actor => rows(`select id from public.app_profiles where account_id=${q(actor.id)} and kind='WORKER'`)[0]?.id ?? randomUUID();
  const made = SPEC_ALL.map((item, index) => ({...item, ...fixtureSql(item, index, worker.id, profile(worker))}));
  let text = made.map(item => item.text).join('\n');
  text += fixtureSql({k: 'stranger_own', raw: 'SUBMITTED', need: 'PUBLISHED', sub: 5}, 3, stranger.id, profile(stranger)).text;
  // 150 applications of another account in all three sections: a long list to page through.
  text += `with n as (insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,
      schedule_kind,starts_at,ends_at,execution_location_mode,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline,created_at)
    select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'PUBLISHED','EX04B bulk ' || i,'Disposable fixture','PROOF','{}','Novi Sad','Liman','OFFERS',2,'FLEXIBLE',null,null,'STATIONARY',
      now() - interval '1 hour','Europe/Belgrade',2,null,null,now() + interval '2 days',${minute(-2000)}
    from generate_series(1,150) i returning id, title)
    insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note,submitted_at,created_at)
    select gen_random_uuid(), n.id, ${q(bulk.id)}, ${q(profile(bulk))}, 'OFFER', (array['SUBMITTED','WITHDRAWN','VIEWED','SELECTED'])[1 + (substr(n.title, 12)::integer % 4)], 2, 1, 5000, 1, '',
      timestamptz '${BASE}' + (substr(n.title, 12)::integer % 37 || ' minutes')::interval, timestamptz '${BASE}' + (substr(n.title, 12)::integer % 37 || ' minutes')::interval from n;`;
  sql(`begin; set local session_replication_role=replica; ${text} set local session_replication_role=origin; commit;`);
  return {worker, bulk, stranger, made};
}

// ------------------------------------------------------------------ reads
async function readPagesOld(client, scope, limit) {
  const items = []; let before = null, guard = 0;
  for (;;) {
    const args = {p_scope: scope, p_limit: limit}; if (before) { args.p_before_at = before.at; args.p_before_id = before.id; }
    const page = await ok(client.rpc('rpc_list_my_applications_page', args));
    items.push(...page.items);
    if (!page.hasMore) break;
    const last = page.items[page.items.length - 1]; before = {at: last.sortAt, id: last.id};
    assert.ok(++guard < 1000, 'OLD_PAGING_DID_NOT_TERMINATE');
  }
  return items;
}
async function readPages(client, scope, limit) {
  const items = [], pages = []; let cursor = null, counts, guard = 0;
  for (;;) {
    const args = {p_scope: scope, p_limit: limit}; if (cursor) Object.assign(args, {p_before_at: cursor.at, p_before_id: cursor.id, p_before_rank: cursor.rank});
    const page = await ok(client.rpc('rpc_list_my_applications_page', args));
    pages.push(page); items.push(...page.items);
    if (!cursor) counts = page.counts;
    if (!page.hasMore) break;
    const last = page.items[page.items.length - 1]; cursor = {at: last.sortAt, id: last.id, rank: rankOf(last)};
    assert.ok(++guard < 1000, 'PAGING_DID_NOT_TERMINATE');
  }
  return {items, pages, counts};
}
// PostgREST learns a new signature from the DDL it is told about: wait until the reader answers by the arguments of the signature that is meant to exist.
async function readerReady(client, withRank) {
  const args = {p_scope: 'ALL', p_limit: 1, ...(withRank ? {p_before_at: null, p_before_id: null, p_before_rank: null} : {})};
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await client.rpc('rpc_list_my_applications_page', args);
    if (!result.error) return;
    await sleep(500);
  }
  throw new Error('READER_NOT_READY');
}
const whole = client => ok(client.rpc('rpc_list_my_applications'));
const section = item => (item.attentionRequired ? 'attention' : ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(item.state) ? 'active' : 'finished');
const expectedState = {sel_live: 'SELECTED', sel_done: 'SELECTED', sel_raw: 'SELECTED', stale_raw: 'STALE_REVIEW_REQUIRED', stale_rev: 'STALE_REVIEW_REQUIRED', stale_old: 'STALE_REVIEW_REQUIRED',
  open_a: 'SUBMITTED', open_b: 'SUBMITTED', viewed: 'VIEWED', short: 'SHORTLISTED', open_sel: 'SUBMITTED', cancelled_agreement: 'SUBMITTED', withdrawn: 'WITHDRAWN',
  not_selected: 'CLOSED', expired_raw: 'CLOSED', need_completed: 'CLOSED', need_cancelled: 'CLOSED', need_expired: 'CLOSED', need_archived: 'CLOSED'};

async function main() {
  // ---------------------------------------------------------------- BEFORE
  for (const [signature, md5] of [[OLD_PAGE, OLD_PAGE_MD5], ['public.rpc_list_my_applications()', 'fb0f3053c6b9d3cf0464c433f0504f3b'],
    ['private.my_application_state(text,integer,integer,text,boolean)', '236c6c9c9625e4fb92522c6c3a1bfe03']]) assert.equal(bodyMd5(signature), md5, 'CHAIN_PREDECESSOR_DIFFERS_FROM_DEV:' + signature);
  pass('CHAIN_PREDECESSORS_EQUAL_THE_DEV_PINS');
  const closureBefore = closure(); assert.equal(closureBefore.ready, true); assert.equal(closureBefore.live, closureBefore.certified);
  const surfaceBefore = surface();
  assert.equal(exists(HELPER), false); assert.equal(exists(PAGE), false);
  const f = await buildFixture();
  const {worker, bulk, stranger, made} = f, client = worker.client;
  const list = await whole(client);
  assert.equal(list.length, SPEC.length, 'FIXTURE_APPLICATION_COUNT (the draft is not an application)');
  const byKey = Object.fromEntries(made.map(item => [item.k, item]));
  for (const item of list) {   // the whole list says the state we built each application to have
    const key = made.find(entry => entry.response === item.applicationId)?.k;
    assert.equal(item.state, expectedState[key], 'FIXTURE_STATE_' + key);
  }
  assert.equal(list.find(item => item.applicationId === byKey.cancelled_agreement.response).agreementId !== null, true);
  const old = await readPagesOld(client, 'ALL', 100);
  assert.equal(old.length, SPEC.length);
  assert.notDeepEqual(ids(old), list.map(item => item.applicationId), 'the old page order is the creation order, not the whole-list order');
  pass('REPRODUCED_PAGE_ORDER_IS_NOT_THE_WHOLE_LIST_ORDER');
  assert.ok(old.every(item => !('endsAt' in item) && !('executionLocationMode' in item) && !('taskTimezone' in item) && !('priceBasis' in item) && !('requiredSlots' in item)));
  pass('REPRODUCED_PAGE_ITEM_LACKS_THE_TASK_FACTS');
  const oldActive = await readPagesOld(client, 'ACTIVE', 100);
  assert.ok(oldActive.some(item => item.attentionRequired), 'the old ACTIVE scope lists what waits for me');
  const oldFirst = await ok(client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 5}));
  assert.equal(oldFirst.counts, undefined); await denied(client.rpc('rpc_list_my_applications_page', {p_scope: 'ATTENTION', p_limit: 5}), 'INVALID_SCOPE');
  pass('REPRODUCED_NO_COUNTS_AND_THE_SECTIONS_ARE_NOT_THE_SCREENS');

  // ---------------------------------------------------------------- APPLY
  const drift = candidate.replace(`'${OLD_PAGE_MD5}'`, `'${'0'.repeat(32)}'`); assert.notEqual(drift, candidate);
  assert.throws(() => sql(drift), /EX04B_PREDECESSOR_DRIFT/);
  assert.deepEqual(surface(), surfaceBefore); pass('PREDECESSOR_DRIFT_REFUSED_ATOMICALLY');
  assert.throws(() => sql(`begin; set local session_replication_role=replica; update private.closure_source_v5 set sha256=repeat('0',64) where singleton; ${candidate}\nrollback;`), /EX04B_CLOSURE_NOT_READY/);
  assert.deepEqual(surface(), surfaceBefore); assert.deepEqual(closure(), closureBefore); pass('UNCERTIFIED_CLOSURE_REFUSED_ATOMICALLY');
  sql(candidate);
  assert.throws(() => sql(candidate), /EX04B_ALREADY_APPLIED/); pass('APPLIED_ONCE_SECOND_RUN_REFUSED');
  const surfaceAfter = surface();
  const removed = surfaceBefore.filter(line => !surfaceAfter.includes(line)), added = surfaceAfter.filter(line => !surfaceBefore.includes(line));
  const names = lines => lines.map(line => line.split(':')[1].split('(')[0]).sort();
  assert.deepEqual(names(removed), ['public.rpc_list_my_applications_page']); assert.equal(removed.length, 1);
  assert.deepEqual(names(added), ['private.own_application_rows', 'public.rpc_list_my_applications_page']); assert.equal(added.length, 2);
  assert.ok(added.some(line => line.includes('p_before_rank integer')), 'the reader gained its cursor rank');
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  pass('ONLY_THE_READER_CHANGED_AND_ONLY_THE_BUILDER_IS_NEW');
  assert.deepEqual(closure(), closureBefore); pass('CERTIFICATE_UNCHANGED_READY');
  const flight = JSON.parse(sql(postflight)); assert.deepEqual(flight.problems, []); report.postflight = flight; pass('DEV_POSTFLIGHT_FILE_EMPTY_ON_THE_CHAIN');
  report.candidateSha256 = sha(trimmed(candidate)); report.revertSha256 = sha(trimmed(revert)); report.postflightSha256 = sha(trimmed(postflight));
  await readerReady(client, true);

  // ---------------------------------------------------------------- AFTER
  const wholeIds = list.map(item => item.applicationId);
  for (const limit of [1, 2, 3, 4, 5, 7, 100]) {
    const paged = await readPages(client, 'ALL', limit);
    assert.deepEqual(ids(paged.items), wholeIds, 'PAGED_ORDER_EQUALS_THE_WHOLE_LIST_ORDER_AT_LIMIT_' + limit);
    assert.equal(new Set(ids(paged.items)).size, paged.items.length, 'NO_DUPLICATE_ID');
    assert.equal(paged.pages.length, Math.ceil(SPEC.length / limit));
    assert.ok(paged.pages.every((page, i) => page.items.length <= limit && page.hasMore === (i < paged.pages.length - 1)));
    assert.ok(paged.pages.slice(1).every(page => page.counts === null), 'LATER_PAGES_DO_NOT_PAY_FOR_COUNTS');
    for (const item of paged.items) {   // every field of the whole-list card is the same; the page adds only its keyset value and the task facts
      const {id, sortAt, endsAt, scheduleKind, executionLocationMode, taskTimezone, priceMode, priceBasis, requiredSlots, ...card} = item;
      assert.deepEqual(card, list.find(entry => entry.applicationId === item.id), 'CARD_FACTS_EQUAL_THE_WHOLE_LIST_' + item.id);
    }
  }
  assert.ok(wholeIds.some((id, i) => i > 0 && list[i].submittedAt === list[i - 1].submittedAt), 'FIXTURE_HAS_TIES');
  assert.ok(made.some(item => item.created !== undefined) && rows(`select 1 from public.marketplace_responses where submitted_at <> created_at`).length > 0, 'FIXTURE_HAS_RESUBMISSIONS');
  pass('PAGED_ORDER_AND_CARD_FACTS_EQUAL_THE_WHOLE_LIST_ACROSS_TIES_AND_LIMITS');
  const all = (await readPages(client, 'ALL', 100)).items;
  for (const item of all) {   // the task facts are the task's own columns, never inferred
    const row = rows(`select n.starts_at, n.ends_at, n.schedule_kind, n.execution_location_mode, n.task_timezone, n.mode, n.price_basis, n.required_slots, r.submitted_at
      from public.marketplace_responses r join public.needs n on n.id = r.need_id where r.id = ${q(item.id)}`)[0];
    assert.deepEqual([item.startsAt, item.endsAt, item.scheduleKind, item.executionLocationMode, item.taskTimezone, item.priceMode, item.priceBasis, item.requiredSlots, item.sortAt],
      [row.starts_at, row.ends_at, row.schedule_kind, row.execution_location_mode, row.task_timezone, row.mode, row.price_basis, row.required_slots, row.submitted_at], 'TASK_FACTS_EQUAL_THE_TABLE_' + item.id);
  }
  assert.ok(all.some(item => item.executionLocationMode === 'REMOTE' && item.approximateCity === null) && all.some(item => item.endsAt !== null && item.startsAt === null)
    && all.some(item => item.priceBasis === 'PER_PERSON') && all.some(item => item.priceBasis === 'TOTAL') && all.some(item => item.taskTimezone === null), 'FIXTURE_COVERS_THE_FACTS');
  assert.ok(!all.some(item => item.id === byKey.draft.response), 'A_DRAFT_IS_NOT_AN_APPLICATION');
  pass('TASK_FACTS_ARE_THE_TASKS_OWN_COLUMNS_AND_A_DRAFT_IS_ABSENT');

  // The real client TypeScript: the sections, the counts and the cards, over the actual PostgREST client.
  const mods = loadModules({client, accountId: worker.id}), service = mods.load('data/applicationClientService').applicationClientService,
    view = mods.load('data/myApplicationsView'), pageRules = mods.load('data/ownApplicationsPage');
  report.clientSources = mods.sources;
  const mapped = await service.mojePrijave();
  assert.equal(mapped.length, SPEC.length);
  const readThroughClient = async (scope, limit) => {
    const got = [], firstCounts = []; let cursor = null;
    for (let guard = 0; guard < 1000; guard++) {
      const page = await service.mojePrijaveStrana({scope, limit, cursor});
      got.push(...page.items); if (cursor === null) firstCounts.push(page.counts); else assert.equal(page.counts, null);
      if (!page.hasMore) return {items: got, counts: json(firstCounts[0])};
      cursor = page.cursor;
    }
    throw new Error('CLIENT_PAGING_DID_NOT_TERMINATE');
  };
  const sets = {ALL: mapped, ATTENTION: mapped.filter(row => view.applicationSection(row) === 'attention'), ACTIVE: mapped.filter(row => view.applicationSection(row) === 'active'),
    HISTORY: mapped.filter(row => view.applicationSection(row) === 'finished')};
  assert.ok(sets.ATTENTION.length > 0 && sets.ACTIVE.length > 0 && sets.HISTORY.length > 0);
  const expectedCounts = json(view.applicationCounts(mapped));
  for (const [scope, expected] of Object.entries(sets)) for (const limit of [1, 4, 100]) {
    const got = await readThroughClient(scope, limit);
    assert.deepEqual(got.items.map(row => row.prijavaId), expected.map(row => row.prijavaId), `SCOPE_${scope}_EQUALS_THE_CLIENT_RULE_AT_LIMIT_${limit}`);
    assert.deepEqual(got.counts, expectedCounts, `COUNTS_EQUAL_applicationCounts_${scope}_${limit}`);
    for (const row of got.items) {
      const {zadatak, podrucjeTekst, vremeTekst, ...paged} = row, {zadatak: none, podrucjeTekst: p2, vremeTekst: v2, ...older} = mapped.find(entry => entry.prijavaId === row.prijavaId);
      assert.deepEqual(json(paged), json(older), 'THE_REAL_CLIENT_CARD_EQUALS_THE_WHOLE_LIST_CARD'); assert.ok(zadatak);
      if (zadatak.rezimLokacije === 'REMOTE') assert.equal(podrucjeTekst, 'Na daljinu', 'REMOTE_IS_NEVER_A_CITY');
      if (zadatak.raspored.endsAt) assert.ok(vremeTekst.length > 0 && vremeTekst !== 'Fleksibilno', 'THE_END_OF_THE_TERM_IS_KEPT');
    }
  }
  pass('THE_REAL_CLIENT_SECTIONS_COUNTS_AND_CARDS_EQUAL_THE_WHOLE_LIST_RULES');
  // Every state the fixture builds is in exactly the section the client puts it in.
  assert.deepEqual(json(expectedCounts), {total: SPEC.length, attention: 6, active: 6, finished: 7});
  pass('FIXTURE_SECTIONS_ARE_THE_SIX_SIX_AND_SEVEN_THE_SPEC_BUILDS');

  // A walk that survives a change between pages: nothing that did not change is skipped or repeated, and what moved to a later section is seen once more there.
  {
    const first = await ok(client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 8}));
    const seen = ids(first.items), last = first.items[first.items.length - 1];
    assert.equal(rankOf(last), 1, 'the first page ends inside the open section');
    const returnedOpen = first.items.filter(item => rankOf(item) === 1), laterOpen = all.filter(item => rankOf(item) === 1 && !seen.includes(item.id));
    assert.ok(returnedOpen.length > 0 && laterOpen.length > 0);
    const moved = returnedOpen[0], pending = laterOpen[0], fresh = randomUUID(), freshNeed = randomUUID();
    // Between two pages: one application the first page showed is withdrawn (it moves to the last section), one the walk has not reached yet is withdrawn too, and a brand new
    // application arrives (the newest of all, so it belongs before the cursor).
    sql(`begin; set local session_replication_role=replica;
      update public.marketplace_responses set status='WITHDRAWN' where id in (${q(moved.id)},${q(pending.id)});
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,schedule_kind,created_at)
        values(${q(freshNeed)},${q(randomUUID())},${q(randomUUID())},'PUBLISHED','EX04B newest','Disposable fixture','PROOF','OFFERS','FLEXIBLE',now());
      insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note,submitted_at)
        values(${q(fresh)},${q(freshNeed)},${q(worker.id)},${q(randomUUID())},'OFFER','SUBMITTED',1,1,1000,1,'',${minute(500)});
      commit;`);
    let cursor = {at: last.sortAt, id: last.id, rank: rankOf(last)}, rest = [];
    for (let guard = 0; guard < 100; guard++) {
      const page = await ok(client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 5, p_before_at: cursor.at, p_before_id: cursor.id, p_before_rank: cursor.rank}));
      rest.push(...ids(page.items)); if (!page.hasMore) break;
      const tail = page.items[page.items.length - 1]; cursor = {at: tail.sortAt, id: tail.id, rank: rankOf(tail)};
    }
    const walked = [...seen, ...rest], counts = new Map(); walked.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    assert.deepEqual([...counts].filter(([, n]) => n > 1).map(([id]) => id), [moved.id], 'ONLY_THE_ONE_THAT_MOVED_TO_A_LATER_SECTION_IS_SEEN_TWICE');
    assert.ok(all.every(item => counts.has(item.id)), 'NOTHING_THAT_EXISTED_IS_SKIPPED');
    assert.equal(counts.get(pending.id), 1); assert.ok(!counts.has(fresh), 'A_NEWER_APPLICATION_NEVER_APPEARS_IN_A_WALK_THAT_STARTED_BEFORE_IT');
    sql(`begin; set local session_replication_role=replica;
      update public.marketplace_responses r set status = x.raw from (values (${q(moved.id)}::uuid, ${q(rawStatus(made, moved.id))}), (${q(pending.id)}::uuid, ${q(rawStatus(made, pending.id))})) x(id, raw) where r.id = x.id;
      delete from public.marketplace_responses where id = ${q(fresh)}; delete from public.needs where id = ${q(freshNeed)}; commit;`);
    assert.deepEqual(ids((await readPages(client, 'ALL', 100)).items), wholeIds, 'THE_FIXTURE_IS_RESTORED');
  }
  pass('A_WALK_SURVIVES_A_CHANGE_BETWEEN_PAGES_WITHOUT_SKIPS_OR_REPEATS_OF_WHAT_DID_NOT_CHANGE');

  // A long list: a page reads at most its limit, the counts name the whole list.
  const bulkAll = await whole(bulk.client);
  assert.equal(bulkAll.length, 150);
  const bulkPage = await ok(bulk.client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 30}));
  assert.equal(bulkPage.items.length, 30); assert.equal(bulkPage.hasMore, true);
  assert.deepEqual(bulkPage.counts, {total: 150, attention: bulkAll.filter(item => section(item) === 'attention').length, active: bulkAll.filter(item => section(item) === 'active').length,
    finished: bulkAll.filter(item => section(item) === 'finished').length});
  assert.deepEqual(ids((await readPages(bulk.client, 'ALL', 100)).items), bulkAll.map(item => item.applicationId), 'A_LONG_LIST_KEEPS_THE_WHOLE_LIST_ORDER');
  assert.ok(bulkPage.items.every(item => !wholeIds.includes(item.id)), 'NO_FOREIGN_APPLICATION');
  const started = performance.now(); await ok(bulk.client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 30})); const pageMs = performance.now() - started;
  const startedWhole = performance.now(); await whole(bulk.client); const wholeMs = performance.now() - startedWhole;
  report.timing = {note: 'informational only, one CI run, no claim', pageOf30Ms: Math.round(pageMs), wholeListOf150Ms: Math.round(wholeMs)};
  pass('A_LONG_LIST_PAGES_IN_THE_WHOLE_LIST_ORDER_AND_COUNTS_ITS_WHOLE_TOTAL');

  // Invalid pages and scopes are refused by name.
  const at = '2026-03-01T10:00:00+00:00', someId = randomUUID();
  for (const args of [{p_limit: 0}, {p_limit: 101}, {p_limit: null}, {p_before_at: at}, {p_before_id: someId}, {p_before_rank: 1}, {p_before_at: at, p_before_id: someId},
    {p_before_at: at, p_before_rank: 1}, {p_before_id: someId, p_before_rank: 1}, {p_before_at: at, p_before_id: someId, p_before_rank: 3}, {p_before_at: at, p_before_id: someId, p_before_rank: -1}])
    await denied(client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', ...args}), 'INVALID_PAGE');
  await denied(client.rpc('rpc_list_my_applications_page', {p_scope: 'ATTENTION', p_limit: 5, p_before_at: at, p_before_id: someId, p_before_rank: 1}), 'INVALID_PAGE');
  await denied(client.rpc('rpc_list_my_applications_page', {p_scope: 'HISTORY', p_limit: 5, p_before_at: at, p_before_id: someId, p_before_rank: 0}), 'INVALID_PAGE');
  for (const scope of ['BOGUS', 'active', '', null, 'DRAFTS']) await denied(client.rpc('rpc_list_my_applications_page', {p_scope: scope, p_limit: 5}), 'INVALID_SCOPE');
  pass('INVALID_PAGE_AND_SCOPE_ARE_REFUSED_BY_NAME');

  // Authority: the outsider sees only their own, anon is denied, the builder is not callable.
  const outsider = await ok(stranger.client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 30}));
  assert.equal(outsider.items.length, 1); assert.deepEqual(outsider.counts, {total: 1, attention: 0, active: 1, finished: 0}); assert.ok(!wholeIds.includes(outsider.items[0].id));
  const nobody = await rt.actor('ex04b-nobody');
  const empty = await ok(nobody.client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 30}));
  assert.deepEqual({...empty, asOf: null}, {items: [], hasMore: false, counts: {total: 0, attention: 0, active: 0, finished: 0}, asOf: null});
  await denied(rt.anon.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 30}));
  assert.ok((await client.rpc('own_application_rows', {p_account: worker.id})).error, 'THE_BUILDER_IS_NOT_EXPOSED');
  pass('OUTSIDER_SEES_ONLY_THEIR_OWN_ANON_IS_DENIED_THE_BUILDER_IS_NOT_CALLABLE');
  assert.deepEqual(closure(), closureBefore); pass('CLOSURE_STAYS_READY_AFTER_THE_READS');

  // ---------------------------------------------------------------- REVERT
  sql(revert);
  assert.equal(bodyMd5(OLD_PAGE), OLD_PAGE_MD5); assert.equal(exists(HELPER), false); assert.equal(exists(PAGE), false);
  assert.deepEqual(surface(), surfaceBefore, 'THE_WHOLE_CATALOG_IS_RESTORED_EXACTLY'); assert.deepEqual(closure(), closureBefore);
  assert.throws(() => sql(revert), /EX04B_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  await readerReady(client, false);
  assert.equal((await ok(client.rpc('rpc_list_my_applications_page', {p_scope: 'ALL', p_limit: 100}))).items.length, SPEC.length);
  assert.deepEqual(await whole(client), list, 'THE_WHOLE_LIST_IS_UNTOUCHED_BY_APPLY_AND_REVERT');
  pass('REVERT_RESTORES_THE_COMPLETE_CATALOG_AND_REFUSES_TO_RUN_TWICE');
  sql(candidate); assert.deepEqual(surface(), surfaceAfter, 'REAPPLY_PRODUCES_THE_SAME_CATALOG'); assert.deepEqual(closure(), closureBefore);
  assert.deepEqual(JSON.parse(sql(postflight)).problems, []);
  await readerReady(client, true);
  assert.deepEqual(ids((await readPages(client, 'ALL', 7)).items), wholeIds); pass('REAPPLY_AGAIN_EQUAL_AND_PARITY_HOLDS');
  report.result = 'PASS'; save();
}
const rawStatus = (made, response) => made.find(item => item.response === response).raw;
main().catch(error => { report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save(); console.error(report.failure); process.exit(1); });
