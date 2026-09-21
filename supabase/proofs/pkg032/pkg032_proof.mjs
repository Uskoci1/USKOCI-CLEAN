// PKG-032 proof: the cancellation reason is kept (7.15) and the remaining-search guard is null-safe (12.8), with the
// certified closure source re-bound for the guard. Disposable local stack only; it refuses any other target and
// holds no hosted secret.
//
//   replay   after pkg031's replay: the two PKG-031 rows from the exact text canonical DEV recorded, until every body
//            PKG-032 reads or patches is canonical DEV's
//   before   the reason is thrown away; an owner stamps their own draft's remaining_search_* columns directly
//   apply    tampered pins are refused and leave nothing behind; both candidates apply; a second application of each is
//            refused; the surface changes by exactly the cancel function, the guard and the readiness constant; the
//            certificate moves once and is bound in all three places
//   after    the reason is the canceller's message and the other party is told where; a blocked pair gets no message
//            and still cancels; a long reason is cut to what a message holds; the direct stamp is refused and the
//            server-owned path still works
//   closure  on the re-bound certificate a real account, whose cancellation reason is stored, closes end to end with
//            the exact closure worker, and the reason does not survive the erasure
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';

const db = process.env.DB_URL;
assert.equal(db, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', 'DISPOSABLE_LOCAL_TARGET_ONLY');
const out = process.env.PRE_V3_ARTIFACT_DIR;
assert.ok(out, 'PRE_V3_ARTIFACT_DIR');
mkdirSync(out, {recursive: true});
const mode = process.argv[2];
const sha256 = x => createHash('sha256').update(x).digest('hex');
const q = v => "'" + String(v).replaceAll("'", "''") + "'";
const fail = (label, e) => { const error = new Error(label + ': ' + String(e.stderr ?? e.message).slice(-3000)); error.stderr = String(e.stderr ?? ''); return error; };
const sql = (text, label = 'SQL') => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
      {input: text, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']}).trim();
  } catch (e) { throw fail(label, e); }
};
const psqlFile = path => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path],
      {encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) { throw fail(path, e); }
};
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8'), 'SURFACE').split('\n').filter(Boolean);
const report = JSON.parse(existsSync(`${out}/pkg032-report.json`) ? readFileSync(`${out}/pkg032-report.json`, 'utf8') :
  JSON.stringify({package: 'PKG-032', sourceSha: process.env.GITHUB_SHA, disposableDbOnly: true, canonicalDevAccess: false,
    providerCalls: false, deviceTest: false, checks: []}));
const pass = name => { report.checks.push({mode, name, result: 'PASS'}); console.log('PASS ' + name); };
const save = () => writeFileSync(`${out}/pkg032-report.json`, JSON.stringify(report, null, 1) + '\n');
const certificate = () => JSON.parse(sql(`select jsonb_build_object('live', private.closure_source_digest_v5(),
  'source', (select sha256 from private.closure_source_v5 where singleton),
  'erasure', (select sha256 from private.closure_erasure_source_v5 where singleton),
  'readyConstant', (select (regexp_matches(prosrc, '[0-9a-f]{64}'))[1] from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure),
  'readyMasked', (select md5(regexp_replace(prosrc, '[0-9a-f]{64}', '<CERTIFIED>', 'g')) from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure),
  'ready', private.retention_ai_source_ready(),
  'binding', private.closure_erasure_binding_v5()->>'sourceSha256')`));
const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`);

const CANDIDATES = {pkg032a_cancel_reason_kept: 'PKG032A', pkg032b_guard_null_safe_rebind: 'PKG032B'};
// The two PKG-031 rows canonical DEV recorded on 2026-09-21 (receipt 20260921_pkg031_application.receipt.json).
const PKG031 = [['pkg031a_no_cancel_after_done', '093df82ccfa859e85ed6418dd8b8c022f6e436ca4da4788e9d94a2791206190d'],
  ['pkg031b_work_kinds_for_matching', '4414f2373a73887275fa05ccd96e34af11bde4ea32115841f50be48287bf37de']];
// On canonical DEV, 2026-09-21, after PKG-031.
const DEV_BODIES = {
  'public.rpc_cancel_agreement(uuid,text)': '53577455a31c526c1b373a1ae82e6bb9',
  'private.guard_remaining_search_close_fields()': '0e8a1f49fd552d7e799df791a8622c19',
  'private.agreement_action_state(uuid,uuid)': 'fdda79c270eb331bf1679dc12c654263',
  'private.work_kinds_v5(text[])': '2113eb46ab7ea968b873e76d1de12377',
};
const DEV_CERTIFIED = '67730f62a46c6359ed8dab01e2e26d5247682569ffb93d3e137791fc6b977ef0';
const DEV_READY_MASKED = '397094d2982821e4f2c48c02fb073c7c';

// ---------------------------------------------------------------------------------------------------------
if (mode === 'replay') {
  for (const [name, sha] of PKG031) {
    const path = `supabase/candidates/${name}.sql`, bytes = readFileSync(path, 'utf8');
    assert.equal(sha256(bytes.replace(/\n$/, '')), sha, 'NOT_THE_TEXT_CANONICAL_DEV_RECORDED ' + name);
    psqlFile(path);
  }
  pass('THE_TWO_PKG031_ROWS_REPLAYED_FROM_THE_EXACT_TEXT_CANONICAL_DEV_RECORDED');
  const differing = Object.entries(DEV_BODIES).filter(([signature, md5]) => bodyMd5(signature) !== md5)
    .map(([signature, md5]) => ({signature, onCanonicalDev: md5, inReplay: bodyMd5(signature)}));
  report.bodiesThatDifferFromCanonicalDev = differing;
  assert.deepEqual(differing, [], 'REPLAY_IS_NOT_CANONICAL_DEV ' + JSON.stringify(differing));
  pass('EVERY_BODY_PKG032_READS_OR_PATCHES_IS_CANONICAL_DEVS');
  // The replayed stack certifies its own value: its source digest differs from canonical DEV's in what the harness
  // substitutes (as PKG-023f recorded), and the readiness function is canonical DEV's with that constant aside.
  const c = certificate(); report.certificateAfterReplay = c; report.canonicalDevCertified = DEV_CERTIFIED;
  assert.deepEqual({source: c.source, erasure: c.erasure, readyConstant: c.readyConstant, binding: c.binding, readyMasked: c.readyMasked, ready: c.ready},
    {source: c.live, erasure: c.live, readyConstant: c.live, binding: c.live, readyMasked: DEV_READY_MASKED, ready: true});
  pass('THE_CERTIFICATE_IS_BOUND_IN_ALL_THREE_PLACES_READY_AND_THE_READINESS_FUNCTION_IS_CANONICAL_DEVS_CONSTANT_ASIDE');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// synthetic rows, inside one transaction that is rolled back
// ---------------------------------------------------------------------------------------------------------
const party = () => ({id: randomUUID(), requester: randomUUID(), worker: randomUUID()});
const insertParty = p => `insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,available_now)
    values(${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',false),
          (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad','ACTIVE','{}',false);`;
const need = (id, owner, status) => `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,
    category,approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,task_timezone)
  values(${q(id)},${q(owner.id)},${q(owner.requester)},${q(status)},'PKG-032 fixture','Disposable SQL fixture','PROOF','Novi Sad','Liman',
    'OFFERS',1,'FLEXIBLE',${status === 'DRAFT' ? 'null' : "statement_timestamp()-interval '1 day'"},'Europe/Belgrade');`;
const agreementFixture = (a, n, resp, sel, r, w, workerProfile = w.worker, workerAccount = w.id) => `
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,price_rsd,covered_slots)
    values(${q(resp)},${q(n)},${q(workerAccount)},${q(workerProfile)},'APPLICATION','SELECTED',1,3000,1);
  insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,status,response_id,worker_account_id,worker_profile_id)
    values(${q(sel)},${q(n)},1,${q(r.id)},${q('pkg032-sel-' + sel)},1,'SELECTED',${q(resp)},${q(workerAccount)},${q(workerProfile)});
  insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,status,current_version)
    values(${q(a)},${q(n)},${q(sel)},${q(resp)},${q(r.id)},${q(r.requester)},${q(workerAccount)},${q(workerProfile)},'CONFIRMED',1);
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
    values(${q(a)},1,'CONFIRMED',jsonb_build_object('price_rsd',3000,'covered_slots',1,'need_revision',1,'response_version',1,
      'scope_note','','proposed_start_at',null,'proposed_end_at',null),md5(${q(a)}),${q(r.id)});
  insert into public.agreement_execution(agreement_id,agreement_version,state,mode) values(${q(a)},1,'CONFIRMED','PHYSICAL');`;
const asPerson = id => `set local role authenticated;
  set local request.jwt.claim.sub = ${q(id)}; set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claims = ${q(JSON.stringify({sub: id, role: 'authenticated'}))};`;
const asPostgres = `reset role; set local request.jwt.claim.sub = ''; set local request.jwt.claim.role = ''; set local request.jwt.claims = '';`;
const scenario = (label, fixtures, body) => JSON.parse(sql(`begin;
  set local statement_timeout = '120s';
  create temporary table pkg032_obs(k text primary key, v jsonb) on commit drop;
  grant all on pkg032_obs to authenticated;
  set local session_replication_role = replica;
  ${fixtures}
  set local session_replication_role = origin;
  ${body}
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from pkg032_obs;
  rollback;`, label).split(/\r?\n/).pop());
const catching = (key, statement) => `do $c$ begin ${statement}; insert into pkg032_obs values (${q(key)}, '"OK"'); exception when others then insert into pkg032_obs values (${q(key)}, to_jsonb(sqlerrm)); end $c$;`;
const REASON = 'Kiša je potopila prilaz, ne mogu da dođem ovog vikenda.';

function scenarios() {
  const o = {};
  // 7.15: a requester cancels with a reason; what the worker can read afterwards.
  const cancel = (label, reason, {blocked = false} = {}) => {
    const r = party(), w = party(), n = randomUUID(), resp = randomUUID(), sel = randomUUID(), a = randomUUID();
    return scenario(label, `${insertParty(r)}${insertParty(w)}${need(n, r, 'ACTIVE')}${agreementFixture(a, n, resp, sel, r, w)}
      ${blocked ? `insert into private.account_blocks(blocker_account_id, blocked_account_id, active, revision, last_blocked_at)
        values (${q(w.id)}, ${q(r.id)}, true, 1, statement_timestamp());` : ''}`, `
      ${asPerson(r.id)}
      ${catching('cancel', `perform public.rpc_cancel_agreement(${q(a)}, ${q(reason)})`)}
      ${asPostgres}
      insert into pkg032_obs values ('agreement', to_jsonb((select status from public.agreements where id=${q(a)})));
      insert into pkg032_obs values ('messages', coalesce((select jsonb_agg(jsonb_build_object('sender', case when sender_account_id=${q(r.id)}::uuid then 'REQUESTER' else 'OTHER' end,
        'body', body, 'length', char_length(body))) from public.agreement_messages where agreement_id=${q(a)}), '[]'::jsonb));
      insert into pkg032_obs values ('workerTold', coalesce((select jsonb_agg(body) from public.notification_deliveries
        where recipient_user_id=${q(w.id)} and channel='IN_APP' and title='Dogovor je otkazan'), '[]'::jsonb));`);
  };
  o.cancelWithReason = cancel('CANCEL_WITH_REASON', REASON);
  o.cancelLongReason = cancel('CANCEL_LONG_REASON', 'Razlog. '.repeat(500));
  o.cancelBlockedPair = cancel('CANCEL_BLOCKED_PAIR', REASON, {blocked: true});
  // 12.8: the owner of a draft writes the server-owned remaining_search_* columns directly.
  {
    const r = party(), n = randomUUID();
    o.guard = scenario('GUARD', `${insertParty(r)}${need(n, r, 'DRAFT')}`, `
      ${asPerson(r.id)}
      ${catching('directStamp', `update public.needs set remaining_search_closed_at = statement_timestamp(),
        remaining_search_close_reason = 'direct' where id = ${q(n)}`)}
      ${asPostgres}
      insert into pkg032_obs values ('stampedAfterDirect', to_jsonb((select remaining_search_closed_at is not null from public.needs where id=${q(n)})));
      ${catching('serverOwnedPath', `perform set_config('uskoci.need_lifecycle', 'CLOSE_REMAINING_SEARCH', true);
        update public.needs set remaining_search_close_reason = 'server path' where id = ${q(n)}`)}
      insert into pkg032_obs values ('reasonAfterServerPath', to_jsonb((select remaining_search_close_reason from public.needs where id=${q(n)})));`);
  }
  return o;
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'before') {
  const s = scenarios(); report.before = s;
  assert.equal(s.cancelWithReason.cancel, 'OK'); assert.equal(s.cancelWithReason.agreement, 'CANCELLED');
  assert.deepEqual(s.cancelWithReason.messages, [], JSON.stringify(s.cancelWithReason));
  assert.deepEqual(s.cancelWithReason.workerTold, ['Druga strana je otkazala Dogovor.']);
  pass('7_15_BEFORE_THE_REASON_IS_THROWN_AWAY_AND_THE_WORKER_READS_A_FIXED_SENTENCE');
  assert.equal(s.guard.directStamp, 'OK', JSON.stringify(s.guard)); assert.equal(s.guard.stampedAfterDirect, true);
  pass('12_8_BEFORE_AN_OWNER_STAMPS_THEIR_OWN_DRAFTS_SERVER_OWNED_COLUMNS_DIRECTLY');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
const refuses = (name, code, path = `supabase/candidates/${name}.sql`) => {
  let failure = null;
  try { psqlFile(path); } catch (e) { failure = e; }
  assert.ok(failure, `${name} applied where it must refuse (${code})`);
  assert.ok(failure.stderr.includes(code), `${name}: expected ${code}, got ${failure.stderr.slice(-600)}`);
};
const changed = line => line.split(':').slice(0, 2).join(':').replace(/\(.*$/, '');

if (mode === 'apply') {
  const before = surface(), certBefore = certificate();
  writeFileSync(`${out}/pkg032-surface-before.txt`, before.join('\n') + '\n');
  for (const [name, code, pin] of [['pkg032a_cancel_reason_kept', 'PKG032A_PREDECESSOR_DRIFT', "'53577455a31c526c1b373a1ae82e6bb9'"],
    ['pkg032b_guard_null_safe_rebind', 'PKG032B_PREDECESSOR_DRIFT', "'0e8a1f49fd552d7e799df791a8622c19'"]]) {
    const tampered = `${out}/${name}.tampered.sql`;
    const text = readFileSync(`supabase/candidates/${name}.sql`, 'utf8');
    assert.ok(text.includes(pin), 'the pin to tamper is in ' + name);
    writeFileSync(tampered, text.replace(pin, "'00000000000000000000000000000000'"));
    refuses(name + ' (tampered)', code, tampered);
    assert.deepEqual(surface(), before, 'A_REFUSED_CANDIDATE_LEFT_SOMETHING_BEHIND ' + name);
    assert.deepEqual(certificate(), certBefore, 'A_REFUSED_CANDIDATE_MOVED_THE_CERTIFICATE ' + name);
  }
  pass('TAMPERED_PINS_ARE_REFUSED_AND_LEAVE_NOTHING_BEHIND');
  psqlFile('supabase/candidates/pkg032a_cancel_reason_kept.sql');
  const certAfterA = certificate();
  assert.deepEqual(certAfterA, certBefore, 'pkg032a must not move the certificate');
  pass('PKG032A_APPLIES_AND_THE_CERTIFICATE_DOES_NOT_MOVE');
  psqlFile('supabase/candidates/pkg032b_guard_null_safe_rebind.sql');
  const certAfterB = certificate(); report.certificate = {before: certBefore, after: certAfterB};
  assert.notEqual(certAfterB.live, certBefore.live);
  assert.deepEqual({source: certAfterB.source, erasure: certAfterB.erasure, readyConstant: certAfterB.readyConstant, binding: certAfterB.binding},
    {source: certAfterB.live, erasure: certAfterB.live, readyConstant: certAfterB.live, binding: certAfterB.live});
  assert.equal(certAfterB.readyMasked, certBefore.readyMasked); assert.equal(certAfterB.ready, true);
  pass('PKG032B_APPLIES_THE_CERTIFICATE_MOVES_ONCE_AND_IS_BOUND_IN_ALL_THREE_PLACES_AND_READY');
  for (const [name, code] of Object.entries(CANDIDATES)) refuses(name, code + '_ALREADY_APPLIED');
  assert.deepEqual(certificate(), certAfterB);
  pass('A_SECOND_APPLICATION_OF_EACH_IS_REFUSED');
  const after = surface();
  writeFileSync(`${out}/pkg032-surface-after.txt`, after.join('\n') + '\n');
  const removed = before.filter(l => !after.includes(l)), added = after.filter(l => !before.includes(l));
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  const expected = ['function:private.guard_remaining_search_close_fields', 'function:private.retention_ai_source_ready',
    'function:public.rpc_cancel_agreement'];
  assert.deepEqual([...new Set(removed.map(changed))].sort(), expected, JSON.stringify(removed));
  assert.deepEqual([...new Set(added.map(changed))].sort(), expected, JSON.stringify(added));
  pass('THE_SURFACE_CHANGES_BY_EXACTLY_THE_CANCEL_FUNCTION_THE_GUARD_AND_THE_READINESS_CONSTANT');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'after') {
  const s = scenarios(); report.after = s;
  const c = s.cancelWithReason;
  assert.equal(c.cancel, 'OK'); assert.equal(c.agreement, 'CANCELLED');
  assert.deepEqual(c.messages.map(m => [m.sender, m.body]), [['REQUESTER', 'Otkazujem Dogovor. Razlog: ' + REASON]]);
  assert.deepEqual(c.workerTold, ['Druga strana je otkazala Dogovor. Razlog je u Porukama.']);
  pass('7_15_AFTER_THE_REASON_IS_THE_CANCELLERS_MESSAGE_AND_THE_WORKER_IS_TOLD_WHERE');
  assert.equal(s.cancelLongReason.cancel, 'OK'); assert.equal(s.cancelLongReason.agreement, 'CANCELLED');
  assert.equal(s.cancelLongReason.messages.length, 1); assert.equal(s.cancelLongReason.messages[0].length, 2000);
  pass('7_15_A_REASON_LONGER_THAN_A_MESSAGE_IS_CUT_TO_2000_AND_THE_CANCEL_STILL_HAPPENS');
  // A blocked pair: whatever the cancel did before, it does now, and no message crosses the block.
  const blockedBefore = report.before?.cancelBlockedPair;
  assert.ok(blockedBefore, 'the before mode recorded the blocked pair');
  assert.equal(s.cancelBlockedPair.cancel, blockedBefore.cancel); assert.equal(s.cancelBlockedPair.agreement, blockedBefore.agreement);
  assert.deepEqual(s.cancelBlockedPair.messages, []);
  assert.deepEqual(s.cancelBlockedPair.workerTold.filter(x => x.includes('Porukama')), []);
  pass('7_15_A_BLOCKED_PAIR_GETS_NO_MESSAGE_AND_ITS_CANCEL_BEHAVES_AS_BEFORE');
  assert.equal(s.guard.directStamp, 'REMAINING_SEARCH_STATE_IS_SERVER_OWNED', JSON.stringify(s.guard));
  assert.equal(s.guard.stampedAfterDirect, false);
  assert.equal(s.guard.serverOwnedPath, 'OK'); assert.equal(s.guard.reasonAfterServerPath, 'server path');
  pass('12_8_AFTER_THE_DIRECT_STAMP_IS_REFUSED_AND_THE_SERVER_OWNED_PATH_STILL_WRITES');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'closure') {
  const rt = await import('../pre_v3/closure_runtime.mjs');
  const {loadClosureWorker} = await import('../pre_v3/v5_closure_edge_runtime.mjs');
  const env = process.env;
  const cert = certificate(); report.closureCertificate = cert;
  assert.equal(cert.ready, true); assert.equal(cert.live, cert.source);
  assert.notEqual(cert.live, report.certificate?.before?.live, 'the closure runs on the re-bound certificate');
  // A real account (Auth sign-up and its own profiles) works a task for a synthetic requester and cancels it with a
  // reason, through the real API as itself.
  const closing = await rt.actor('pkg032-closing');
  const workerProfile = sql(`select id from public.app_profiles where account_id=${q(closing.id)}::uuid and kind='WORKER'`);
  assert.match(workerProfile, /^[0-9a-f-]{36}$/);
  const r = party(), n = randomUUID(), resp = randomUUID(), sel = randomUUID(), a = randomUUID();
  sql(`begin; set local session_replication_role = replica; ${insertParty(r)}${need(n, r, 'ACTIVE')}
    ${agreementFixture(a, n, resp, sel, r, null, workerProfile, closing.id)} commit;`, 'FIXTURE');
  const reason = 'PKG032-ERASE-ME ' + randomUUID();
  await rt.ok(closing.client.rpc('rpc_cancel_agreement', {p_agreement_id: a, p_reason: reason}));
  assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id=${q(a)} and sender_account_id=${q(closing.id)}::uuid
    and body like ${q('%' + reason + '%')}`), '1');
  pass('A_REAL_ACCOUNT_CANCELS_THROUGH_THE_API_AND_ITS_REASON_IS_STORED_AS_ITS_MESSAGE');
  // The closure, end to end, on the re-bound certificate.
  await rt.ok(closing.client.rpc('rpc_prepare_account_closure', {p_expected_user_id: closing.id, p_expected_revision: 0, p_client_request_id: randomUUID()}));
  const ready = await rt.ok(closing.client.rpc('rpc_review_account_closure_execution', {p_expected_user_id: closing.id}));
  report.closureReview = {ready: ready.ready, blockers: ready.blockers ?? null, exceptions: ready.exceptions ?? null};
  assert.equal(ready.ready, true, 'the account cannot close: ' + JSON.stringify(ready));
  const started = await rt.ok(closing.client.rpc('rpc_start_account_closure_execution', {p_expected_user_id: closing.id,
    p_request_id: ready.requestId, p_expected_revision: ready.revision, p_client_request_id: randomUUID(), p_policy_sha256: ready.policySha256}));
  assert.equal(started.state, 'EXECUTING');
  const runtime = loadClosureWorker({env: name => ({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED: 'true', SUPABASE_URL: env.RU5_DEVICE_SUPABASE_URL,
    SUPABASE_ANON_KEY: env.RU5_DEVICE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.RU5_DEVICE_SERVICE_ROLE_KEY})[name],
    fetch: async (url, init) => { assert.equal(new URL(url).origin, new URL(env.RU5_DEVICE_SUPABASE_URL).origin); return fetch(url, init); }});
  const invoke = () => runtime.handler(new Request('http://127.0.0.1/closure', {method: 'POST',
    headers: {apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY, 'content-type': 'application/json'},
    body: JSON.stringify({accountId: closing.id, generation: started.generation})}));
  let closed = null; const kinds = [];
  for (let i = 0; i < 400 && !closed; i++) {
    const response = await invoke(); assert.equal(response.status, 200, 'step ' + i);
    const body = await response.json(); kinds.push(body.kind ?? body.state);
    if (body.state === 'CLOSED') closed = body;
  }
  report.closureSteps = {calls: kinds.length, last: kinds.at(-1)};
  assert.ok(closed, 'PKG032_CLOSURE_DID_NOT_CLOSE ' + kinds.slice(-5).join(','));
  assert.equal(closed.relationalOutcome, 'ORDINARY_PERSONAL_CONTENT_ERASED'); assert.deepEqual(closed.exceptions, []);
  assert.equal(sql(`select deleted_at is not null from auth.users where id=${q(closing.id)}::uuid`), 't');
  pass('ON_THE_RE_BOUND_CERTIFICATE_THE_ACCOUNT_CLOSES_END_TO_END_WITH_THE_EXACT_WORKER');
  assert.equal(sql(`select count(*) from public.agreement_messages where body like ${q('%' + reason + '%')}`), '0');
  report.reasonAfterClosure = sql(`select coalesce(jsonb_agg(jsonb_build_object('sender', sender_account_id=${q(closing.id)}::uuid, 'length', char_length(body))), '[]')
    from public.agreement_messages where agreement_id=${q(a)}`);
  pass('THE_CANCELLATION_REASON_DOES_NOT_SURVIVE_THE_CLOSURE');
  save(); process.exit(0);
}

throw new Error('UNKNOWN_MODE ' + mode);
