import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const c=fs.readFileSync(new URL('../../candidates/ex06d_f5_already_applied_admission.sql',import.meta.url),'utf8');
const r=fs.readFileSync(new URL('../../candidates/ex06d_f5_already_applied_admission_revert.sql',import.meta.url),'utf8');
const p=fs.readFileSync(new URL('./ex06d_f5_postflight.readonly.sql',import.meta.url),'utf8');
const d=fs.readFileSync(new URL('./README_EX06D_F5.md',import.meta.url),'utf8');
test('F5 is one-function exact-revision active-response admission only',()=>{
 assert.match(c,/dispatch_cheap_candidate_admitted\(uuid,uuid\)/);
 assert.match(c,/submitted_against_need_revision = n\.revision/);
 assert.match(c,/SUBMITTED.*DELIVERED.*VIEWED.*SHORTLISTED.*SELECTED/s);
 assert.match(c,/e51de37e0883fcd3cd4e6e3c42fb6ee1/); assert.match(c,/887c8b4c5cdc9062d04277bdd05d2167/);
 assert.equal(/alter\s+table|create\s+index|drop\s+index|insert\s+into\s+public\.|update\s+public\.|delete\s+from\s+public\./i.test(c),false);
});
test('F5 intentionally leaves unproven response-state semantics unchanged',()=>{
 for(const s of ['DRAFT','WITHDRAWN','NOT_SELECTED','EXPIRED','STALE','STALE_REVIEW_REQUIRED']) assert.match(d,new RegExp('`'+s+'`'));
});
test('revert and postflight pin exact bodies',()=>{ assert.match(r,/887c8b4c5cdc9062d04277bdd05d2167/); assert.match(r,/e51de37e0883fcd3cd4e6e3c42fb6ee1/); assert.match(p,/BODY_MISMATCH/); assert.match(p,/LIVE_RESPONSE_INDEX_MISSING/); });
test('named apply boundary remains explicit',()=>{ assert.match(d,/DISPOSABLE PROOF PENDING/); assert.match(d,/NOT APPLIED TO DEV/); assert.match(d,/PRIMENI EX-06 ex06d-F5/); });
