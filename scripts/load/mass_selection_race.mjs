#!/usr/bin/env node
/**
 * Scalable Selection contention harness for a disposable local source147 DB.
 * Reuses the same pre-V3 runtime and canonical RPCs as PKG-006; this is a scale
 * wrapper, not a second Selection implementation.
 *
 * Required: the standard disposable runtime used by PKG-006 must already be up.
 * Optional:
 *   MASS_RACES        default 20, range 1..500
 *   MASS_CONCURRENCY  default 10, range 1..50
 *   MASS_OUT          default artifacts/mass-user-chaos
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert as rtAssert, sql, login, worker, requester, randomUUID, q, ok, denied, actor } from '../../supabase/proofs/pre_v3/closure_runtime.mjs';
import * as rt from '../../supabase/proofs/pre_v3/closure_runtime.mjs';

void rtAssert; void denied;
const races = Number(process.env.MASS_RACES ?? 20);
const concurrency = Number(process.env.MASS_CONCURRENCY ?? 10);
const outDir = resolve(process.env.MASS_OUT ?? 'artifacts/mass-user-chaos');
if (!Number.isInteger(races) || races < 1 || races > 500) throw new Error('MASS_RACES_INVALID');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) throw new Error('MASS_CONCURRENCY_INVALID');

const timings = [];
const loserCodes = new Map();
const createdNeeds = [];
const count = s => Number(sql(s));
const revision = id => Number(sql(`select revision from public.needs where id=${q(id)}::uuid`));
const outcome = r => r.error ? { ok: false, code: r.error.message, detail: String(r.error.details ?? '') } : { ok: true, data: r.data };

function fixture(label) {
  const id = randomUUID();
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${q(id)}::uuid,${q(rt.requesterId)}::uuid,${q(rt.rp)}::uuid,'PUBLISHED',${q('MASSRACE '+label)},'Disposable scale race','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());
    select set_config('uskoci.need_lifecycle','',true);commit;`);
  createdNeeds.push(id);
  return id;
}
function submitArgs(pid, needId) {
  return { p_need_id: needId, p_need_revision: revision(needId), p_worker_profile_id: pid, p_covered_slots: 1,
    p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID() };
}
function selectArgs(needId, app) {
  return { p_need_id: needId, p_need_revision: app.needRevision, p_response_id: app.responseId,
    p_response_version: app.version, p_content_hash: app.contentHash, p_client_request_id: randomUUID() };
}
async function newWorker(label) {
  const a = await actor(label);
  let p = await ok(a.client.from('app_profiles').select('id').eq('account_id', a.id).eq('kind', 'WORKER').maybeSingle());
  if (!p) p = await ok(a.client.from('app_profiles').insert({ account_id: a.id, kind: 'WORKER', display_name: 'Mass Race B', skills: [], tools: [], vehicles: [], bio: '' }).select('id').single());
  await ok(a.client.from('app_profiles').update({ display_name: 'Mass Race B', skills: ['Proof'], tools: [], vehicles: ['Kombi'], licenses: [] }).eq('id', p.id));
  const loc = await ok(a.client.rpc('rpc_get_worker_location', {}));
  await ok(a.client.rpc('rpc_save_worker_location', { p_expected_revision: loc.revision,
    p_value: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 15, approximatePosition: { latitude: 45.25, longitude: 19.85 } }, p_confirmed: true }));
  await ok(a.client.rpc('rpc_complete_worker_profile', { p_profile_id: p.id }));
  return { ...a, pid: p.id };
}
async function pool(items, limit, fn) {
  let next = 0; const errors = [];
  async function runner() {
    while (true) {
      const i = next++; if (i >= items.length) return;
      try { await fn(items[i], i); } catch (error) { errors.push({ i, error }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  if (errors.length) throw errors[0].error;
}
function pct(values, p) {
  const a = [...values].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.ceil(a.length * p / 100) - 1))];
}

await login();
assert.equal(sql("select count(*)::text||'/'||max(version) from supabase_migrations.schema_migrations"), '147/20260913081242');
const workerB = await newWorker(`mass-race-b-${randomUUID()}`);
const jobs = Array.from({ length: races }, (_, i) => i);

await pool(jobs, concurrency, async (_job, i) => {
  const needId = fixture(`${i}-${randomUUID().slice(0, 8)}`);
  const [appA, appB] = await Promise.all([
    ok(worker.rpc('rpc_submit_response', submitArgs(rt.wp, needId))),
    ok(workerB.client.rpc('rpc_submit_response', submitArgs(workerB.pid, needId))),
  ]);
  const started = performance.now();
  const results = (await Promise.all([
    requester.rpc('rpc_select_response', selectArgs(needId, appA)),
    requester.rpc('rpc_select_response', selectArgs(needId, appB)),
  ])).map(outcome);
  timings.push(Math.round((performance.now() - started) * 100) / 100);
  const winners = results.filter(x => x.ok), losers = results.filter(x => !x.ok);
  assert.equal(winners.length, 1, JSON.stringify({ needId, results }));
  assert.equal(losers.length, 1, JSON.stringify({ needId, results }));
  const allowed = ['NEED_NOT_OPEN', 'RESPONSE_NOT_SELECTABLE', 'OVERFILL', 'RESPONSE_ALREADY_SELECTED'];
  assert.ok(allowed.includes(losers[0].code), losers[0].code);
  loserCodes.set(losers[0].code, (loserCodes.get(losers[0].code) ?? 0) + 1);

  assert.equal(count(`select count(*) from public.agreements where need_id=${q(needId)}::uuid`), 1);
  assert.equal(count(`select count(*) from public.need_selections where need_id=${q(needId)}::uuid and status='SELECTED'`), 1);
  assert.equal(count(`select public.fn_need_covered_slots(${q(needId)}::uuid)`), 1);
});

const bad = sql(`select count(*) from (
  select n.id from public.needs n where n.title like 'MASSRACE %'
  and (public.fn_need_covered_slots(n.id)>n.required_slots
    or (select count(*) from public.agreements a where a.need_id=n.id)<>1
    or (select count(*) from public.need_selections s where s.need_id=n.id and s.status='SELECTED')<>1)
) x`);
assert.equal(Number(bad), 0, 'MASS_RACE_INVARIANT_FAILED');

const report = {
  unit: 'MASS_SELECTION_RACE', result: 'PASS', disposableLocalOnly: true, providerCalled: false,
  races, concurrency, exactlyOneWinner: races, invariantViolations: Number(bad),
  loserCodes: Object.fromEntries(loserCodes),
  latencyMs: { count: timings.length, min: Math.min(...timings), p50: pct(timings, 50), p95: pct(timings, 95), p99: pct(timings, 99), max: Math.max(...timings) },
  createdAt: new Date().toISOString(),
};
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'mass-selection-race-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS MASS_SELECTION_RACE races=${races} exactly_one_winner=${races} invariant_violations=0 provider_calls=0`);
