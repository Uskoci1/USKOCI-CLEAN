#!/usr/bin/env node
/**
 * Disposable unknown-outcome / lost-ACK proof at scale boundary.
 * Uses the established PKG-006 Auth runtime and canonical marketplace RPCs.
 * The first successful responses are intentionally discarded; only retry and
 * authoritative DB state are used to prove recovery. Zero provider calls.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sql, login, worker, requester, randomUUID as ruuid, q, ok, denied } from '../../supabase/proofs/pre_v3/closure_runtime.mjs';
import * as rt from '../../supabase/proofs/pre_v3/closure_runtime.mjs';

const outDir = resolve(process.env.MASS_OUT ?? '/tmp/mass-user-chaos');
const count = s => Number(sql(s));
const revision = id => Number(sql(`select revision from public.needs where id=${q(id)}::uuid`));

function fixture(label) {
  const id = ruuid();
  sql(`begin; select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${q(id)}::uuid,${q(rt.requesterId)}::uuid,${q(rt.rp)}::uuid,'PUBLISHED',${q('MASSFAULT '+label)},'Unknown outcome fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());
    select set_config('uskoci.need_lifecycle','',true); commit;`);
  return id;
}

await login();
assert.equal(sql("select count(*)::text||'/'||max(version) from supabase_migrations.schema_migrations"), '147/20260913081242');

const needId = fixture(randomUUID().slice(0, 8));
const submitKey = randomUUID();
const submitArgs = {
  p_need_id: needId, p_need_revision: revision(needId), p_worker_profile_id: rt.wp,
  p_covered_slots: 1, p_price_rsd: 4100, p_proposed_start_at: null, p_proposed_end_at: null,
  p_scope_note: 'lost-ack', p_client_request_id: submitKey,
};

// First ACK is deliberately ignored.
await ok(worker.rpc('rpc_submit_response', submitArgs));
const submitReplay = await ok(worker.rpc('rpc_submit_response', submitArgs));
assert.equal(submitReplay.idempotentReplay, true);
assert.equal(count(`select count(*) from public.marketplace_responses where need_id=${q(needId)}::uuid`), 1);
assert.equal(count(`select count(*) from private.response_submit_commands where worker_account_id=${q(rt.workerId)}::uuid and client_request_id=${q(submitKey)}`), 1);
await denied(worker.rpc('rpc_submit_response', { ...submitArgs, p_price_rsd: 4101 }), 'IDEMPOTENCY_KEY_REUSED');

const selectKey = randomUUID();
const selectArgs = {
  p_need_id: needId, p_need_revision: submitReplay.needRevision,
  p_response_id: submitReplay.responseId, p_response_version: submitReplay.version,
  p_content_hash: submitReplay.contentHash, p_client_request_id: selectKey,
};
// Again, drop the first ACK and recover only by exact retry.
await ok(requester.rpc('rpc_select_response', selectArgs));
const agreementId = await ok(requester.rpc('rpc_select_response', selectArgs));
assert.match(String(agreementId), /^[0-9a-f-]{36}$/i);
assert.equal(count(`select count(*) from public.agreements where need_id=${q(needId)}::uuid`), 1);
assert.equal(count(`select count(*) from private.selection_commands where requester_account_id=${q(rt.requesterId)}::uuid and client_request_id=${q(selectKey)}`), 1);
const wrongHash = (submitReplay.contentHash[0] === '0' ? '1' : '0') + submitReplay.contentHash.slice(1);
await denied(requester.rpc('rpc_select_response', { ...selectArgs, p_content_hash: wrongHash }), 'IDEMPOTENCY_KEY_REUSED');

await ok(worker.rpc('rpc_mark_work_done', { p_agreement_id: agreementId }));
const completed = await ok(requester.rpc('rpc_confirm_completion', { p_agreement_id: agreementId }));
assert.equal(completed.state, 'COMPLETED');

const reviewKey = randomUUID();
const reviewArgs = {
  p_agreement_id: agreementId, p_target_account_id: rt.workerId, p_rating: 5,
  p_tags: ['AS_AGREED'], p_client_request_id: reviewKey,
};
await ok(requester.rpc('rpc_submit_agreement_review', reviewArgs));
const reviewReplay = await ok(requester.rpc('rpc_submit_agreement_review', reviewArgs));
assert.equal(reviewReplay.idempotentReplay, true);
assert.equal(count(`select count(*) from private.agreement_reviews where agreement_id=${q(agreementId)}::uuid and reviewer_account_id=${q(rt.requesterId)}::uuid`), 1);
await denied(requester.rpc('rpc_submit_agreement_review', { ...reviewArgs, p_rating: 4 }), 'REQUEST_ID_REUSED');

const report = {
  unit: 'MASS_UNKNOWN_OUTCOME', result: 'PASS', providerCalled: false, disposableLocalOnly: true,
  application: { exactRetry: true, changedPayloadDenied: true, rows: 1, commandRows: 1 },
  selection: { exactRetry: true, changedPayloadDenied: true, agreements: 1, commandRows: 1 },
  review: { exactRetry: true, changedPayloadDenied: true, rows: 1 },
  agreementId, createdAt: new Date().toISOString(),
};
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'mass-unknown-outcome-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('PASS MASS_UNKNOWN_OUTCOME application=1 selection=1 review=1 duplicate_semantic_commands=0 provider_calls=0');
