// PKG-042: cancelled Agreement read parity; disposable SQL + actual Auth/PostgREST only.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const mode = process.argv[2], path = env.PRE_V3_ARTIFACT_DIR + '/pkg042-report.json';
const report = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {
  package: 'PKG-042', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, providerCalls: 0, checks: []};
const sha = text => createHash('sha256').update(text).digest('hex');
const save = () => writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
const pass = name => {report.checks.push({mode, name, result: 'PASS'}); save(); console.log('PASS ' + name);};
const closure = () => rows("select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready")[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const candidate = 'supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql';
const pins = JSON.parse(readFileSync('docs/implementation/v5-ai-first/pkg042/FUNCTION_PINS_20260922.json', 'utf8'));
if (mode === 'replay') {
  const text = readFileSync('supabase/candidates/pkg040a_qa_failure_settlement.sql', 'utf8');
  assert.equal(sha(text.replace(/\n$/, '')), 'a47d403705447ef89e35a6f08c5eccc7c3fbd42f44deec45a2dab97a723e31e9');
  sql(text);
  for (const p of pins) assert.equal(sql(`select md5(prosrc) from pg_proc where oid=${q(p.signature)}::regprocedure`), p.before);
  const c = closure(); assert.equal(c.ready, true); assert.equal(c.live, c.certified); report.closureBefore = c;
  pass('EXACT_PKG040_PREDECESSOR_READY'); process.exit(0);
}
if (mode === 'apply') {
  const before = surface(), c = closure(), text = readFileSync(candidate, 'utf8');
  report.migrationTextSha256 = sha(text.replace(/\n$/, ''));
  assert.throws(() => sql(text.replace(pins[0].before, '0'.repeat(32))), /PKG042A_PREDECESSOR_DRIFT/);
  assert.deepEqual(surface(), before); pass('DRIFT_REFUSED_ATOMICALLY');
  assert.throws(() => sql(text.replace("a.status <> 'CANCELLED'", "a.status <> 'COMPLETED'")), /PKG042A_BODY_MISMATCH/);
  assert.deepEqual(surface(), before); pass('BODY_TAMPER_REFUSED_ATOMICALLY');
  sql(text); assert.throws(() => sql(text), /PKG042A_ALREADY_APPLIED/); pass('APPLY_ONCE');
  const after = surface(), removed = before.filter(x => !after.includes(x)), added = after.filter(x => !before.includes(x));
  const names = list => list.map(x => x.split(':')[1].split('(')[0]).sort();
  assert.deepEqual(names(removed), pins.map(x => x.signature.split('(')[0]).sort());
  assert.deepEqual(names(added), names(removed));
  report.surfaceRemoved = removed; report.surfaceAdded = added; pass('ONLY_THREE_READ_FUNCTION_BODIES_CHANGED');
  assert.deepEqual(closure(), c); report.closureAfter = c; pass('CERTIFICATE_UNCHANGED_READY'); process.exit(0);
}
assert.ok(['before', 'after'].includes(mode));
const party = () => ({id: randomUUID(), requester: randomUUID(), worker: randomUUID()});
const insertParty = p => `insert into auth.users(id) values(${q(p.id)});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id+'@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city) values
    (${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad'),
    (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad');`;
const claim = id => `set local role authenticated; set local request.jwt.claim.sub=${q(id)};
  set local request.jwt.claim.role='authenticated'; set local request.jwt.claims=${q(JSON.stringify({sub:id,role:'authenticated'}))};`;
function fixture(owner, worker, {status='NOT_SELECTED', cancelled=true, stale=false, agreement=true, agreementStatus, count=1, needStatus='PUBLISHED'}={}) {
  const needs=[], apps=[], statements=[];
  for (let i=0; i<count; i++) {
    const nid=randomUUID(), rid=randomUUID(), sid=randomUUID(), aid=randomUUID(); needs.push(nid); apps.push(rid);
    const state = agreementStatus ?? (cancelled ? 'CANCELLED' : 'CONFIRMED');
    statements.push(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision)
      values(${q(nid)},${q(owner.id)},${q(owner.requester)},${q(needStatus)},'PKG042 task','Disposable read fixture','PROOF','OFFERS',1,2);
      insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,price_rsd,submitted_at)
      values(${q(rid)},${q(nid)},${q(worker.id)},${q(worker.worker)},'APPLICATION',${q(status)},${stale?1:2},1000,statement_timestamp());`);
    if (agreement) statements.push(`insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
      response_id,worker_account_id,worker_profile_id,selection_mode,status)
      values(${q(sid)},${q(nid)},2,${q(owner.id)},${q(sid)},1,${q(rid)},${q(worker.id)},${q(worker.worker)},'REQUESTER_SELECTS',${q(cancelled?'CANCELLED':'SELECTED')});
      insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,status)
      values(${q(aid)},${q(nid)},${q(sid)},${q(rid)},${q(owner.id)},${q(owner.requester)},${q(worker.id)},${q(worker.worker)},${q(state)});
      insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
      values(${q(aid)},1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}','0123456789abcdef',${q(owner.id)});
      insert into public.agreement_execution(agreement_id,agreement_version,state) values(${q(aid)},1,${q(state==='SUPERSEDED'?'CONFIRMED':state)});`);
  }
  return {needs, apps, text: statements.join('\n')};
}
const calls = ids => `jsonb_build_object('legacy',public.rpc_list_my_applications(),
  'page',public.rpc_list_my_applications_page('ALL',100),
  'active',public.rpc_list_my_applications_page('ACTIVE',100),
  'history',public.rpc_list_my_applications_page('HISTORY',100),
  'relations',public.rpc_get_my_task_relations(array[${ids.map(q).join(',')}]::uuid[]),'home',public.rpc_home_attention())`;
const cases = [
  ['cancelled', {}, 'CLOSED'], ['cancelledChanged', {stale:true}, 'STALE_REVIEW_REQUIRED'],
  ['cancelledWithdrawn', {status:'WITHDRAWN',stale:true}, 'WITHDRAWN'],
  ['cancelledExplicitStale', {status:'STALE_REVIEW_REQUIRED'}, 'STALE_REVIEW_REQUIRED'],
  ['cancelledRawSelected', {status:'SELECTED',stale:true}, 'SELECTED'],
  ['confirmed', {cancelled:false,stale:true}, 'SELECTED'],
  ['completed', {cancelled:false,agreementStatus:'COMPLETED'}, 'SELECTED'],
  ['superseded', {cancelled:false,agreementStatus:'SUPERSEDED'}, 'SELECTED'],
  ['noAgreement', {agreement:false,status:'SUBMITTED'}, 'SUBMITTED'],
  ['cancelledTerminalChanged', {needStatus:'COMPLETED',stale:true}, 'STALE_REVIEW_REQUIRED'],
  ['overflow', {stale:true,count:35}, 'STALE_REVIEW_REQUIRED'],
];
for (const [label, config, expected] of (mode==='before'?cases.slice(0,2):cases)) {
  const owner=party(), worker=party(), stranger=party(), f=fixture(owner,worker,config);
  const observed = JSON.parse(sql(`begin; set local session_replication_role=replica;
    ${insertParty(owner)} ${insertParty(worker)} ${insertParty(stranger)} ${f.text}
    set local session_replication_role=origin; ${claim(worker.id)} select ${calls(f.needs)}; rollback;`).split(/\r?\n/).pop());
  assert.equal(observed.legacy[0].state, expected, label);
  if (mode==='before') {
    assert.equal(observed.page.items[0].state, 'SELECTED');
    assert.equal(observed.relations.items[0].applicationState, 'SELECTED');
    assert.equal(observed.home.counts.activeApplications, 0);
    if (config.stale) assert.equal(observed.home.counts.attention, 0);
    pass('REPRODUCED_DISAGREEMENT_'+label); continue;
  }
  const active = ['SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED'].includes(expected);
  for (const item of observed.page.items) assert.equal(item.state, expected, label);
  for (const item of observed.relations.items) assert.equal(item.applicationState, expected, label);
  assert.equal(observed.home.counts.activeApplications, active ? f.apps.length : 0, label);
  const stale = expected==='STALE_REVIEW_REQUIRED';
  assert.equal(observed.home.counts.attention, stale ? f.apps.length : 0, label);
  assert.equal(observed.home.counts.attentionMore, stale ? Math.max(0,f.apps.length-3) : 0, label);
  assert.equal(observed.home.items.length, stale ? Math.min(3,f.apps.length) : 0, label);
  assert.equal(observed.home.counts.activitiesMore, active ? Math.max(0,f.apps.length-5) : 0, label);
  const belongsActive = active || (expected==='SELECTED' && !config.cancelled && config.cancelled!==undefined && config.agreementStatus!=='COMPLETED');
  assert.equal(observed.active.items.length, belongsActive ? f.apps.length : 0, label);
  assert.equal(observed.history.items.length, belongsActive ? 0 : f.apps.length, label);
  if (config.agreement!==false) assert.ok(observed.page.items.every(x=>x.agreementId!==null), 'history link preserved');
  pass('PARITY_AND_COUNTS_'+label);
}
// Real authenticated HTTP transport, no DEV identity or provider access.
const a=await rt.actor('pkg042-worker-'+mode), o=await rt.actor('pkg042-owner-'+mode), stranger=await rt.actor('pkg042-stranger-'+mode);
const withProfiles = actor => ({...actor, requester:sql(`select id from public.app_profiles where account_id=${q(actor.id)} and kind='REQUESTER'`),
  worker:sql(`select id from public.app_profiles where account_id=${q(actor.id)} and kind='WORKER'`)});
const f=fixture(withProfiles(o),withProfiles(a),{stale:true});
sql(`begin;set local session_replication_role=replica;${f.text}set local session_replication_role=origin;commit;`);
const legacy=await ok(a.client.rpc('rpc_list_my_applications',{})), page=await ok(a.client.rpc('rpc_list_my_applications_page',{p_scope:'ACTIVE',p_limit:30}));
const rel=await ok(a.client.rpc('rpc_get_my_task_relations',{p_need_ids:f.needs})), home=await ok(a.client.rpc('rpc_home_attention',{}));
assert.equal(legacy[0].state,'STALE_REVIEW_REQUIRED');
assert.equal(page.items.length,mode==='before'?0:1);assert.equal(rel.items[0].applicationState,mode==='before'?'SELECTED':'STALE_REVIEW_REQUIRED');
assert.equal(home.items.length,mode==='before'?0:1);
assert.equal((await ok(stranger.client.rpc('rpc_home_attention',{}))).counts.attention,0);
assert.deepEqual((await ok(stranger.client.rpc('rpc_get_my_task_relations',{p_need_ids:f.needs}))).items,[]);
assert.deepEqual((await ok(stranger.client.rpc('rpc_list_my_applications_page',{p_scope:'ALL',p_limit:30}))).items,[]);
assert.equal((await ok(o.client.rpc('rpc_get_my_task_relations',{p_need_ids:f.needs}))).items[0].relation,'OWNER');
await denied(rt.anon.rpc('rpc_home_attention',{})); await denied(rt.anon.rpc('rpc_list_my_applications_page',{}));
await denied(rt.anon.rpc('rpc_get_my_task_relations',{p_need_ids:f.needs}));
report.actualAuth=true;report.actualPostgrest=true;pass('ACTUAL_AUTH_REST_PARITY_OWNER_OUTSIDER_AND_ANON');
assert.deepEqual(closure(),mode==='before'?report.closureBefore:report.closureAfter);pass('CLOSURE_STAYS_READY');
