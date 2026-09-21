// PKG-033: application admission after an edit. Disposable Postgres only; each scenario rolls back.
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
const report = JSON.parse(existsSync(`${out}/pkg033-report.json`) ? readFileSync(`${out}/pkg033-report.json`, 'utf8') :
  JSON.stringify({package: 'PKG-033', sourceSha: process.env.GITHUB_SHA, disposableDbOnly: true, canonicalDevAccess: false,
    providerCalls: false, deviceTest: false, checks: []}));
const pass = name => { report.checks.push({mode, name, result: 'PASS'}); console.log('PASS ' + name); };
const save = () => writeFileSync(`${out}/pkg033-report.json`, JSON.stringify(report, null, 1) + '\n');
const closure = () => JSON.parse(sql(`select jsonb_build_object('live', private.closure_source_digest_v5(),
  'certified', (select sha256 from private.closure_source_v5 where singleton), 'ready', private.retention_ai_source_ready())`));
const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`);


const NAME = 'pkg033a_application_admission_parity';
const PKG032 = [
  ['pkg032a_cancel_reason_kept','164006ecee1cb4f807160bd0df861d94e086b6749ce5d9e4653c69ec82988b6b'],
  ['pkg032b_guard_null_safe_rebind','724766cada068fe79ddff8fc0f32e61d4fbbc257c6c3300b8a9015a0f64ba944'],
];
const DEV_BODIES = {
  'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)': '7d8d9673c1de83adfa6667aadc0736e9',
  'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)': '77390882ec8d5bd391859447184ed41e',
  'public.rpc_select_response(uuid,integer,uuid,integer,text,text)': '22a27e65592eb11ce1df486185b08d0a',
};
if (mode === 'replay') {
  for (const [name, digest] of PKG032) {
    const path = 'supabase/candidates/' + name + '.sql';
    assert.equal(sha256(readFileSync(path,'utf8').replace(/\n$/,'')),digest,'RECORDED_TEXT_MISMATCH '+name);
    psqlFile(path);
  }
  for (const [sig, digest] of Object.entries(DEV_BODIES)) assert.equal(bodyMd5(sig),digest,'REPLAY_DIFFERS_FROM_DEV '+sig);
  pass('ALL_THREE_PREDECESSOR_BODIES_EQUAL_CANONICAL_DEV');
  const c = closure(); assert.equal(c.live,c.certified); assert.equal(c.ready,true); report.closureAfterReplay=c;
  pass('REPLAY_CLOSURE_CERTIFIED_AND_READY'); save(); process.exit(0);
}
const party = () => ({id:randomUUID(),requester:randomUUID(),worker:randomUUID()});
const insertParty = (p,{capacity=3,skills='{ciscenje}'}={}) => `
  insert into auth.users(id,email) values(${q(p.id)},${q(p.id+'@proof.invalid')});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id+'@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now)
  values(${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',1,false),
        (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad','ACTIVE',${q(skills)},${capacity},true);`;
const need = (n,r,c={}) => `
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,
    approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline)
  values(${q(n)},${q(r.id)},${q(r.requester)},'PUBLISHED','PKG-033 fixture','Disposable fixture','PROOF','{}',
    'Novi Sad','Liman',${q(c.mode??'MY_PRICE')},3,'FLEXIBLE',statement_timestamp()-interval '1 hour','Europe/Belgrade',2,5000,
    ${c.basis===null||c.mode==='OFFERS'?'null':q(c.basis??'PER_PERSON')},statement_timestamp()+interval '${c.expired?'-1':'2'} hours');`;
const response = (a,n,w,c={}) => `
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note)
  values(${q(a)},${q(n)},${q(w.id)},${q(w.worker)},'OFFER',${q(c.select?'SUBMITTED':'STALE_REVIEW_REQUIRED')},
    ${c.select?2:1},1,${c.price??10000},${c.covered??2},'Proof scope');
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(${q(a)},1,${c.select?2:1},${c.price??10000},${c.covered??2},'Proof scope',encode(sha256(convert_to(${q(a)},'UTF8')),'hex'));`;
const asPerson = id => `set local role authenticated;
  set local request.jwt.claim.sub=${q(id)}; set local request.jwt.claim.role='authenticated';
  set local request.jwt.claims=${q(JSON.stringify({sub:id,role:'authenticated'}))};`;
const asPostgres = `reset role; set local request.jwt.claim.sub=''; set local request.jwt.claim.role=''; set local request.jwt.claims='';`;
const scenario = (label,fixtures,body) => JSON.parse(sql(`begin;
  set local statement_timeout='120s';
  create temporary table pkg033_obs(k text primary key,v jsonb) on commit drop;
  grant all on pkg033_obs to authenticated;
  set local session_replication_role=replica; ${fixtures}
  set local session_replication_role=origin; ${body}
  select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from pkg033_obs; rollback;`,label).split(/\r?\n/).pop());
const catching = (key,expr) => `do $c$ begin
  insert into pkg033_obs values(${q(key)},to_jsonb(${expr}));
  exception when others then insert into pkg033_obs values(${q(key)},to_jsonb(sqlerrm)); end $c$;`;
const svalue = x => x==null?'null':q(x);
function application(label,c={}) {
  const r=party(), w=party(), other=party(), n=randomUUID(), a=randomUUID(), previous=randomUUID(), request='pkg033-'+randomUUID();
  const fixtures = insertParty(r)+insertParty(w,{capacity:c.capacity,skills:c.skills})+insertParty(other)+need(n,r,c)
    +(c.fresh?'':response(a,n,w,c))
    +(c.differentWorld?`insert into private.account_lineage_v5(account_id,lineage,reason,source_ref)
      values(${q(w.id)},'SYNTHETIC_ACCEPTANCE_FIXTURE','Disposable test only','PKG-033');`:'')
    +(c.selected?response(previous,n,other,{select:true,covered:c.selected})+`
      insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,status,response_id,worker_account_id,worker_profile_id)
      values(${q(n)},2,${q(r.id)},'pkg033-existing-selection',${c.selected},'SELECTED',${q(previous)},${q(other.id)},${q(other.worker)});`:'');
  const args = [c.covered??2,c.price??10000,svalue(c.start),svalue(c.end),q('Proof scope')].join(',');
  const call = c.fresh?`public.rpc_submit_response(${q(n)},2,${q(w.worker)},${args},${q(request)})`
    :c.select?`public.rpc_select_response(${q(n)},2,${q(a)},1,encode(sha256(convert_to(${q(a)},'UTF8')),'hex'),${q(request)})`
    :`public.rpc_resolve_stale_response_after_need_edit(${q(a)},1,2,${q(request)},${q(c.action??'UPDATE')},${args})`;
  return scenario(label,fixtures,`
    ${asPerson(c.select?r.id:w.id)} ${catching('result',call)}
    ${c.replay?catching('replay',call):''}
    ${c.changedReplay?catching('changedReplay',call.replace(q('Proof scope'),q('Changed scope'))):''}
    ${asPostgres}
    insert into pkg033_obs values('snapshots',to_jsonb((select count(*) from private.response_application_snapshots s
      join public.marketplace_responses r on r.id=s.response_id where r.need_id=${q(n)})));
    insert into pkg033_obs values('versions',to_jsonb((select count(*) from public.marketplace_response_versions v
      join public.marketplace_responses r on r.id=v.response_id where r.need_id=${q(n)} and r.worker_account_id=${q(w.id)})));
    insert into pkg033_obs values('response',coalesce((select to_jsonb(r) from public.marketplace_responses r
      where r.need_id=${q(n)} and r.worker_account_id=${q(w.id)}),'null'));
    insert into pkg033_obs values('agreements',to_jsonb((select count(*) from public.agreements where need_id=${q(n)})));
    insert into pkg033_obs values('withdrawEvents',to_jsonb((select count(*) from public.user_activity_events
      where entity_id=${q(a)} and event_type='RESPONSE_WITHDRAWN')));
    insert into pkg033_obs values('canonicalHash',coalesce((select to_jsonb(v.content_hash=encode(sha256(convert_to(jsonb_build_object(
      'needRevision',2,'pricingMode',${q(c.mode??'MY_PRICE')},'priceRsd',v.price_rsd,'coveredSlots',v.covered_slots,
      'proposedStartAt',v.proposed_start_at,'proposedEndAt',v.proposed_end_at,'scopeNote',btrim(v.scope_note),
      'snapshotSchema','APPLICATION_V1_SELF_DECLARED','workerTeamCapacity',p.team_capacity,
      'workerSkills',to_jsonb(p.skills),'workerTools',to_jsonb(p.tools),'workerLicenses',to_jsonb(p.licenses),
      'workerVehicles',to_jsonb(p.vehicles))::text,'UTF8')),'hex'))
      from public.marketplace_response_versions v join public.marketplace_responses r on r.id=v.response_id
      join public.app_profiles p on p.id=r.worker_profile_id
      where r.need_id=${q(n)} and r.worker_account_id=${q(w.id)} and v.version=r.current_version), 'false'));`);
}
const invalid = [
  ['perPersonPrice',{price:5000},'FIXED_PRICE_MISMATCH'],
  ['legacyPrice',{basis:null,price:6000},'FIXED_PRICE_MISMATCH'],
  ['totalPartial',{basis:'TOTAL',price:5000,covered:2},'TOTAL_PRICE_REQUIRES_ALL_SLOTS'],
  ['totalWrongPrice',{basis:'TOTAL',price:6000,covered:3},'FIXED_PRICE_MISMATCH'],
  ['teamCapacity',{capacity:1},'TEAM_CAPACITY_EXCEEDED'],
  ['remainingCapacity',{selected:2},'NEED_REMAINING_CAPACITY_EXCEEDED'],
  ['emptySkills',{skills:'{}'},'WORKER_PROFILE_NOT_READY'],
  ['expired',{expired:true},'RESPONSE_WINDOW_EXPIRED'],
  ['differentWorld',{differentWorld:true},'NEED_NOT_FOUND'],
  ['halfInterval',{start:'2026-12-01T10:00:00Z'},'INVALID_PROPOSED_INTERVAL'],
];
const valid = [
  ['perPerson',{}], ['legacy',{basis:null,price:5000}], ['total',{basis:'TOTAL',price:5000,covered:3}],
  ['offers',{mode:'OFFERS',price:4321}], ['keep',{action:'KEEP'}],
];
if(mode==='before'){
  report.before={};
  for(const [name,c] of invalid.filter(([n])=>!['halfInterval','differentWorld'].includes(n))){
    const s=application(name,c); report.before[name]=s;
    assert.equal(s.result.status,'SUBMITTED',name+' '+JSON.stringify(s));
    assert.equal(s.snapshots,0); pass('BEFORE_ACCEPTS_'+name.toUpperCase());
  }
  const selected=application('selection-bad-price',{select:true,price:5000});
  assert.equal(selected.agreements,1,JSON.stringify(selected)); report.before.selection=selected;
  pass('BEFORE_SELECTION_TURNS_WRONG_PRICE_INTO_AGREEMENT');
  const withdrawn=application('withdraw',{action:'WITHDRAW',skills:'{}'});
  assert.equal(withdrawn.result.status,'WITHDRAWN'); assert.equal(withdrawn.withdrawEvents,0);
  report.before.withdraw=withdrawn; pass('BEFORE_WITHDRAW_DOES_NOT_NOTIFY_OWNER');
  save(); process.exit(0);
}
if(mode==='apply'){
  const before=surface(), c=closure();
  const path='supabase/candidates/'+NAME+'.sql';
  const refuses=(file,code)=>{let failure;try{psqlFile(file);}catch(e){failure=e;}
    assert.ok(failure,'MUST_REFUSE '+code);assert.ok(failure.stderr.includes(code),failure.stderr);};
  const tampered=out+'/pkg033a-tampered.sql';
  writeFileSync(tampered,readFileSync(path,'utf8').replace("'77390882ec8d5bd391859447184ed41e'","'00000000000000000000000000000000'"));
  refuses(tampered,'PKG033A_PREDECESSOR_DRIFT');
  assert.deepEqual(surface(),before); pass('TAMPERED_PIN_REFUSED_WITHOUT_CHANGE');
  psqlFile(path); pass('CANDIDATE_APPLIES');
  refuses(path,'PKG033A_ALREADY_APPLIED'); pass('SECOND_APPLICATION_REFUSED');
  const after=surface(), removed=before.filter(x=>!after.includes(x)), added=after.filter(x=>!before.includes(x));
  const name=line=>line.split(':').slice(0,2).join(':').replace(/\(.*$/,'');
  const patched=['public.rpc_submit_response','public.rpc_resolve_stale_response_after_need_edit','public.rpc_select_response'].map(x=>'function:'+x);
  assert.deepEqual(removed.map(name).sort(),patched.sort());
  assert.deepEqual(added.map(name).sort(),[...patched,'function:private.assert_application_price_v5'].sort());
  report.surfaceRemoved=removed; report.surfaceAdded=added;
  writeFileSync(out+'/pkg033-surface-before.txt',before.join('\n')+'\n');
  writeFileSync(out+'/pkg033-surface-after.txt',after.join('\n')+'\n');
  pass('ONLY_THREE_PATCHED_AND_ONE_PRIVATE_FUNCTION');
  assert.deepEqual(closure(),c); report.closure=c; pass('CLOSURE_CERTIFICATE_UNCHANGED_AND_READY');
  save();process.exit(0);
}
if(mode==='after'){
  report.after={};
  for(const [name,c,code] of invalid){
    for(const fresh of [false,true]){
      const s=application(name,{...c,fresh}); report.after[name+(fresh?'Fresh':'Reconfirm')]=s;
      assert.equal(s.result,code,name+' '+JSON.stringify(s)); assert.equal(s.snapshots,0);
      assert.equal(s.versions,fresh?0:1); assert.equal(s.agreements,0);
      if(!fresh)assert.equal(s.response.status,'STALE_REVIEW_REQUIRED');
    }
    pass('BOTH_DOORS_REFUSE_'+name.toUpperCase()+'_WITHOUT_WRITES');
  }
  for(const [name,c] of valid){
    for(const fresh of name==='keep'?[false]:[false,true]){
      const s=application(name,{...c,fresh,replay:true,changedReplay:true}); report.after[name+(fresh?'Fresh':'Reconfirm')]=s;
      assert.equal(s.result.status,'SUBMITTED',JSON.stringify(s));
      assert.equal(s.snapshots,1); assert.equal(s.versions,fresh?1:2); assert.equal(s.canonicalHash,true);
      assert.equal(s.replay.idempotentReplay,true); assert.equal(s.replay.contentHash,s.result.contentHash);
      assert.equal(s.changedReplay,'IDEMPOTENCY_KEY_REUSED');
    }
    pass('VALID_'+name.toUpperCase()+'_HAS_SNAPSHOT_CANONICAL_HASH_AND_EXACT_REPLAY');
  }
  for(const [name,c,code] of invalid.slice(0,4)){
    const s=application('selection-'+name,{...c,select:true}); report.after['selection-'+name]=s;
    assert.equal(s.result,code,JSON.stringify(s)); assert.equal(s.agreements,0);
    assert.equal(s.response.status,'SUBMITTED'); pass('SELECTION_REFUSES_'+name.toUpperCase());
  }
  for(const [name,c] of valid.slice(0,4)){
    const s=application('selection-'+name,{...c,select:true,replay:true}); report.after['selection-'+name]=s;
    assert.equal(s.agreements,1,JSON.stringify(s)); assert.equal(s.result,s.replay);
    assert.equal(s.response.status,'SELECTED');pass('SELECTION_ACCEPTS_'+name.toUpperCase()+'_AND_REPLAYS');
  }
  const w=application('withdraw',{action:'WITHDRAW',skills:'{}',differentWorld:true,replay:true});
  report.after.withdraw=w;
  assert.equal(w.result.status,'WITHDRAWN');assert.equal(w.withdrawEvents,1);assert.equal(w.replay.idempotentReplay,true);
  assert.equal(w.versions,1);assert.equal(w.snapshots,0);
  pass('WITHDRAW_STILL_ALLOWED_WITHOUT_READY_PROFILE_OR_SAME_WORLD_AND_NOTIFIES_ONCE');
  const c=closure();assert.equal(c.live,c.certified);assert.equal(c.ready,true);
  save();process.exit(0);
}
throw new Error('UNKNOWN_MODE '+mode);
