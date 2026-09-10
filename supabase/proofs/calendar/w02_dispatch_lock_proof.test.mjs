import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {admitDispatchLockReport, dispatchLockChecks, dispatchLockCases, observedDeadlock} from './w02_dispatch_lock_proof.mjs';

const sqlFile = 'supabase/migrations/20260910214845_clean_dispatch_need_lock_order.sql';
const manifestFile = 'supabase/proofs/calendar/w02_dispatch_lock_files.json';
const proofFile = 'supabase/proofs/calendar/w02_dispatch_lock_proof.mjs';
const digest = (bytes, algorithm='sha256') => createHash(algorithm).update(bytes).digest('hex');
const sha = 'a'.repeat(40);
const observed = (waiter,holder) => ({waiter_pid:waiter,holder_pid:holder,wait_event_type:'Lock',blocked_by_holder:true});
// Synthetic admission fixtures only. These tests never claim database execution.
function receipt() {
  const first = observed(12,13), second = observed(13,12);
  const edges = [first,second].map((edge,index)=>({...edge,mode:'ShareLock',transaction_id:400+index}));
  return {unit:'W02_DISPATCH_NEED_LOCK_ORDER',source_sha:sha,result:'PASS',source_migration_count:108,registry_history_count:105,
    applied_authority:'REGISTRY105_PLUS_UNRECORDED_DISPATCH108',actual_postgres_major:17,
    observed_predecessor_body_md5:{'private.dispatch_tick(integer,timestamptz)':'6bbd8765aa833b3c27209c82da99e5e4',
      'private.expire_lifecycle(timestamptz)':'fa0ae36b9d1c63ebe4b8f9a7c3b1e26d'},
    ...Object.fromEntries(['candidate_applied','actual_auth','original_selection_rolled_back','original_cancellation_rolled_back',
      'original_history_preserved','all_function_metadata_preserved_except_two_named_bodies','all_existing_rows_preserved_at_apply',
      'same_request_key_selected_once','actual_owner_cancellation_preserved','no_fixture_blocking_calendar_events',
      'registry_history_unchanged','due_child_predicates_preserved'].map(key=>[key,true])),
    ...Object.fromEntries(['live_access','live_promotion','provider_called','mocked_database','mocked_rpc_responses','mobile_proof','scheduler_disabled'].map(key=>[key,false])),
    checks:dispatchLockChecks.map(name=>({name,result:'PASS'})),
    lock_interleavings:[
      {case:dispatchLockCases[0],sqlstate:'40P01',edges,waiting_tick:first,waiting_owner:second},
      {case:dispatchLockCases[1],sqlstate:'40P01',edges,waiting_expiry:first,waiting_cancel:second},
      {case:dispatchLockCases[2],owner_pid:12,target_queue_unchanged:true,actual_selection_succeeded:true},
      {case:dispatchLockCases[3],owner_pid:12,batch:1,target_queue_unchanged:true,next_free_target_processed:true,skipped_need_lock_released:true},
      {case:dispatchLockCases[4],...first,actual_selection_succeeded:true},
      {case:dispatchLockCases[5],owner_pid:12,due_children_unchanged:true,actual_cancellation_succeeded:true},
      {case:dispatchLockCases[6],...first,actual_cancellation_succeeded:true,due_children_expired_before_rollback:true},
    ],
    fixture_event_cleanup:{released_event_ids:['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'],removed_count:2,calendar_baseline_empty:true},
    candidate:JSON.parse(readFileSync(manifestFile,'utf8')),
    input_sha256:Object.fromEntries([sqlFile,manifestFile,proofFile].map(file=>[file,digest(readFileSync(file))])),
  };
}

test('admits only the exact 105 registry plus unrecorded 108 correction boundary',()=>{
  assert.deepEqual(admitDispatchLockReport(receipt(),sha),{unit:'W02_DISPATCH_NEED_LOCK_ORDER',source_sha:sha,
    registry_history_count:105,applied_authority:'REGISTRY105_PLUS_UNRECORDED_DISPATCH108',
    changed_bodies:receipt().candidate.changed_bodies,checks:10,lock_interleavings:7});
});
for (const [name,change] of [
  ['failed result',r=>r.result='FAIL'], ['wrong source',r=>r.source_sha='b'.repeat(40)],
  ['invented contiguous history',r=>r.registry_history_count=106], ['missing check',r=>r.checks.pop()],
  ['failed check',r=>r.checks[1].result='FAIL'], ['missing lock case',r=>r.lock_interleavings.pop()],
  ['old failure without deadlock',r=>r.lock_interleavings[0].sqlstate='55P03'],
  ['unobserved lock',r=>r.lock_interleavings[4].blocked_by_holder=false],
  ['foreign cycle process',r=>r.lock_interleavings[1].waiting_expiry={...r.lock_interleavings[1].waiting_expiry,waiter_pid:99}],
  ['batch queue starvation',r=>r.lock_interleavings[3].next_free_target_processed=false],
  ['retained skipped Need lock',r=>r.lock_interleavings[3].skipped_need_lock_released=false],
  ['legacy expiry predecessor',r=>r.observed_predecessor_body_md5['private.expire_lifecycle(timestamptz)']='3aba08b19f04bd19c06452bcd6e2e3a9'],
  ['missing observed predecessor',r=>delete r.observed_predecessor_body_md5],
  ['wrong current body',r=>r.candidate.changed_bodies[0].current_md5='0'.repeat(32)],
  ['missing metadata preservation',r=>delete r.all_function_metadata_preserved_except_two_named_bodies],
  ['changed source bytes',r=>r.input_sha256[sqlFile]='0'.repeat(64)],
  ['missing source binding',r=>delete r.input_sha256[proofFile]],
  ['duplicate fixture cleanup',r=>r.fixture_event_cleanup.released_event_ids[1]=r.fixture_event_cleanup.released_event_ids[0]],
  ['scheduler waiver',r=>r.scheduler_disabled=true],
]) test('rejects '+name,()=>{const r=receipt();change(r);assert.throws(()=>admitDispatchLockReport(r,sha));});

test('rejects modified manifest bytes even when a report mirrors their hash',()=>{
  const directory=mkdtempSync(join(tmpdir(),'uskoci-dispatch-admission-'));
  try {
    for(const file of [sqlFile,manifestFile,proofFile]) {mkdirSync(dirname(join(directory,file)),{recursive:true});writeFileSync(join(directory,file),readFileSync(file));}
    const r=receipt();r.candidate.changed_bodies[1].current_md5='0'.repeat(32);
    writeFileSync(join(directory,manifestFile),JSON.stringify(r.candidate));r.input_sha256[manifestFile]=digest(readFileSync(join(directory,manifestFile)));
    assert.throws(()=>admitDispatchLockReport(r,sha,{root:directory}));
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('deadlock parser keeps exact two observed process edges and omits raw SQL',()=>{
  const raw='ERROR:  40P01: deadlock detected\nDETAIL: Process 12 waits for ShareLock on transaction 400; blocked by process 13.\nProcess 13 waits for ShareLock on transaction 401; blocked by process 12.\nCONTEXT: private fixture secret';
  assert.deepEqual(observedDeadlock(raw,12,13),{sqlstate:'40P01',edges:[{waiter_pid:12,holder_pid:13,transaction_id:400,mode:'ShareLock'},{waiter_pid:13,holder_pid:12,transaction_id:401,mode:'ShareLock'}]});
  assert.throws(()=>observedDeadlock(raw,12,99));
  assert.throws(()=>observedDeadlock(raw.replace('40P01','55P03'),12,13));
});

const source=file=>readFileSync(file,'utf8').replaceAll('\r\n','\n');
const definition=(text,name)=>text.match(new RegExp('create or replace function '+name.replaceAll('.','\\.')+'\\s*\\(.*?\\bas (\\$[a-zA-Z_]*\\$)(.*?)\\1;','si'))?.[2];
function currentExpiryPredecessor() {
  const original=definition(source('supabase/migrations/20260830172000_clean_p1_cancel_withdraw_closure.sql'),'private.expire_lifecycle');
  const migration=source('supabase/migrations/20260909150000_clean_w02_persistent_availability_matching.sql');
  const patch=migration.slice(migration.indexOf("signature:='private.expire_lifecycle"));
  const anchor=patch.match(/anchor:=\$code\$([\s\S]*?)\$code\$;/)?.[1];
  const replacement=patch.match(/replacement:='([^']*)';/)?.[1];
  assert.ok(anchor&&replacement); assert.equal(original.split(anchor).length-1,1);
  return original.replace(anchor,replacement);
}
test('dispatch processing, retries, exceptions and return stay byte-identical to their predecessor',()=>{
  const old=definition(source('supabase/migrations/20260829212146_clean_scheduled_lifecycle.sql'),'private.dispatch_tick');
  const current=definition(source(sqlFile),'private.dispatch_tick');
  const tail='  for r in select unnest(claimed)';
  assert.equal(current.slice(current.indexOf(tail)),old.slice(old.indexOf(tail)));
});
test('expiry body differs only by parent acquisition and original predicate scope',()=>{
  const old=currentExpiryPredecessor();
  let current=definition(source(sqlFile),'private.expire_lifecycle');
  current=current.replace('  locked_needs uuid[];\n','');
  const start=current.indexOf('\n\n  -- Parent fencing'),end=current.indexOf('\n\n  with expired_needs',start);
  assert.ok(start>0&&end>start);current=current.slice(0,start)+current.slice(end);
  current=current.replace('where x.id = any(locked_needs)\n       and x.status','where x.status')
    .replace("where need_id = any(locked_needs)\n     and status in ('READY','SEEN')","where status in ('READY','SEEN')")
    .replace("where need_id = any(locked_needs)\n     and status = 'SENT'","where status = 'SENT'");
  assert.equal(current,old);
});
test('current dynamic availability owner remains persistent before and after SQL108',()=>{
  const predecessor=currentExpiryPredecessor();
  assert.equal(digest(predecessor,'md5'),'fa0ae36b9d1c63ebe4b8f9a7c3b1e26d');
  for(const body of [predecessor,definition(source(sqlFile),'private.expire_lifecycle')]) {
    assert.ok(body.includes('av := 0; -- Persistent owner intent has no automatic expiration.'));
    assert.doesNotMatch(body,/update public\.app_profiles|available_now_expires_at/i);
  }
});
test('six exact predecessor guards and two actual body fingerprints match source',()=>{
  const text=source(sqlFile),m=receipt().candidate;
  assert.equal((text.match(/DISPATCH_LOCK_PREDECESSOR_MISMATCH/g)||[]).length,1);
  assert.equal((text.split('as p(signature,body_md5) loop')[0].match(/\('[^']+','[0-9a-f]{32}'\)/g)||[]).length,6);
  assert.equal((text.match(/create or replace function /gi)||[]).length,2);
  for(const changed of m.changed_bodies){const name=changed.signature.split('(')[0];assert.equal(digest(definition(text,name),'md5'),changed.current_md5);assert.ok(text.includes(changed.predecessor_md5));}
  assert.doesNotMatch(text,/\b(?:grant|revoke|insert into supabase_migrations)\b/i);
});
