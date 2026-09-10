// Current W03 native proof: real local Auth/SQL, synthetic model only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../supabase/proofs/ru5_device_ui_local_guard.mjs';

export function validateAiFixture(env) {
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
  assert.equal(env.RU5_DEVICE_PACKAGE,'rs.uskoci.n04proof');
  assert.equal(env.RU5_DEVICE_PROOF_DIR,'/tmp/uskoci-ru5-device-ui');
  assert.equal(env.RU5_DEVICE_ARTIFACT_DIR,'artifacts/ai-review-device');
  assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
  assert.ok(['intake','marketplace'].includes(env.AI_REVIEW_SCOPE??'intake'));
}
export function proposedFacts(nonce,start,end) {
  assert.match(nonce,/^[a-f0-9]{8}$/);assert.ok(Date.parse(end)>Date.parse(start));
  const title=`AI review proof ${nonce}`;
  return [
    ['need.title',title,title],['need.description','Pomoc pri prenosu stvari uz ljude i kombi.','Pomoc pri prenosu stvari uz ljude i kombi.'],
    ['need.category','pomoc','Pomoć'],['need.price_mode','OFFERS','Očekujete ponude'],
    ['need.schedule_kind','FIXED_WINDOW','Dogovoren termin'],['need.people_needed',2,'99'],
    ['need.task_country_code','RS','Srbija'],
    ['need.task_geography',{mode:'POINT_TO_POINT',start:{city:'Novi Sad',area:'Centar'},end:{city:'Novi Sad',area:'Liman'}},'Centar, Novi Sad → Liman, Novi Sad'],
    ['need.starts_at',start,start],['need.ends_at',end,end],['need.required_vehicles',['Kombi'],'Kombi'],
  ].map(([key,value,displayValue])=>({key,value,displayValue,
    evidence:'Sintetički lokalni primer; nije stvarni provider izlaz.',confidence:0.8}));
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
const validId=value=>{assert.match(String(value),/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);return value;};
export function assertManualNoviSad(resolved,geography) {
  assert.equal(resolved.version,1);assert.deepEqual(resolved.binding,{taskCountryCode:'RS',geography,exactAddress:null});
  assert.deepEqual(resolved.points.map(p=>p.slot),['start','end']);
  for(const p of resolved.points){assert.deepEqual(p.origin,{kind:'MANUAL_PIN'});
    assert.ok(Number.isSafeInteger(p.latitudeE6)&&p.latitudeE6>45_200_000&&p.latitudeE6<45_300_000);
    assert.ok(Number.isSafeInteger(p.longitudeE6)&&p.longitudeE6>19_750_000&&p.longitudeE6<19_900_000);}
  assert.notDeepEqual(resolved.points[0],{...resolved.points[1],slot:'start'});
}
export function syntheticPolicySql(bundle) {
  validId(bundle);
  // Exact disposable policy review mechanism from publication_authority_proof.
  // Neither this content nor its activation is production policy authority.
  const head={schemaVersion:'USKOCI_PUBLICATION_POLICY_V1',instructions:'DISPOSABLE TEST ONLY. Classify synthetic fixtures using these synthetic rules. No production legal content.'};
  return `begin;
    update private.publication_policy_bundles set review_provenance=review_provenance||jsonb_build_object('evaluatorPolicy',${lit(JSON.stringify(head))}::jsonb,'testBoundary','DISPOSABLE_SYNTHETIC_ONLY') where id=${lit(bundle)};
    update private.publication_policy_rule_refs set rule_provenance=rule_provenance||jsonb_build_object('evaluation',jsonb_build_object(
      'instructions','DISPOSABLE TEST ONLY '||rule_id,'outcomes',case when rule_id='RS-MIN-015' then '[]'::jsonb else '["ALLOW","CLARIFY","REVIEW","BLOCK"]'::jsonb end,
      'safeReasonCodes','["TEST_ALLOW","TEST_CLARIFY","TEST_REVIEW","TEST_BLOCK"]'::jsonb)) where bundle_id=${lit(bundle)};
    update private.publication_policy_bundles b set review_provenance=review_provenance||jsonb_build_object(
      'evaluatorContentSha256',encode(extensions.digest(convert_to(((review_provenance->'evaluatorPolicy')||jsonb_build_object('rules',(
        select jsonb_agg(jsonb_build_object('ruleId',r.rule_id,'instructions',r.rule_provenance#>>'{evaluation,instructions}',
        'outcomes',r.rule_provenance#>'{evaluation,outcomes}','safeReasonCodes',r.rule_provenance#>'{evaluation,safeReasonCodes}') order by r.rule_id)
        from private.publication_policy_rule_refs r where r.bundle_id=b.id)))::text,'UTF8'),'sha256'),'hex')) where b.id=${lit(bundle)};
    update private.publication_policy_bundles set is_reviewed=true,is_complete=true,is_active=true,
      reviewed_at=statement_timestamp(),activated_at=statement_timestamp() where id=${lit(bundle)};
    commit;`;
}
export async function admitMarketplaceNativeBoundary(env=process.env) {
  validateAiFixture(env);assert.equal(env.AI_REVIEW_SCOPE,'marketplace');
  const {admitNativeSuccessors}=await import('./ci/owned-intake-proof.mjs');
  const report=admitNativeSuccessors(env); // Central read-only exact107/108 source+DB authority.
  assert.equal(report.result,'PASS');assert.equal(report.unit,'NATIVE_MARKETPLACE_SOURCE108');
  assert.equal(report.source_sha,env.GITHUB_SHA);assert.equal(report.source_migration_count,108);
  assert.equal(report.original_history_count,106);assert.equal(report.history_count,108);
  for(const key of ['original_history_preserved','business_and_policy_rows_preserved','localOnly'])assert.equal(report[key],true);
  for(const key of ['live_access','live_promotion','provider_called','policy_activated','transport_enabled','concurrency_proven'])assert.equal(report[key],false);
  return report;
}
export async function main(mode,env=process.env) {
  validateAiFixture(env); // Before files, credentials, SQL or network.
  assert.ok(['admit','create-account','observe','verify','prepare-marketplace','bind-marketplace'].includes(mode));
  const marketplace=env.AI_REVIEW_SCOPE==='marketplace';
  if(mode.endsWith('-marketplace'))assert.equal(marketplace,true);
  const nativeBoundary=marketplace&&mode!=='admit'?await admitMarketplaceNativeBoundary(env):null;
  const nativeHistory=nativeBoundary?108:106;
  const out=env.RU5_DEVICE_ARTIFACT_DIR;mkdirSync(out,{recursive:true});
  const file=name=>join(out,name),read=name=>JSON.parse(readFileSync(file(name),'utf8'));
  const write=(name,data)=>writeFileSync(file(name),JSON.stringify(data,null,2)+'\n');
  const sql=query=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-v','ON_ERROR_STOP=1','-At'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000,maxBuffer:8*1024*1024}).trim();}
    catch{throw new Error('AI_REVIEW_LOCAL_SQL_FAILED');}};
  const rows=query=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (${query}) x`));
  if(mode==='admit') {
    const manifest=JSON.parse(readFileSync('supabase/proofs/ai/owned_intake_files.json','utf8'));
    const path='supabase/migrations/'+manifest.forward_file,bytes=readFileSync(path);
    assert.equal(bytes.length,manifest.bytes);assert.equal(hash(bytes),manifest.sha256);
    assert.deepEqual(bytes,execFileSync('git',['show',`${env.GITHUB_SHA}:${path}`]));
    assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'105');
    assert.equal(sql('select md5(statements[1]) from supabase_migrations.schema_migrations order by version desc limit 1'),manifest.predecessor105_md5);
    const before=rows('select * from supabase_migrations.schema_migrations order by version');
    sql(bytes.toString('utf8'));
    sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${lit(manifest.forward_version)},${lit(manifest.forward_name)},array[${lit(bytes.toString('utf8'))}])`);
    assert.deepEqual(rows(`select * from supabase_migrations.schema_migrations where version<>${lit(manifest.forward_version)} order by version`),before);
    assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'106');
    assert.equal(sql('select private.retention_ai_source_ready()'),'t');
    const baseline={publication:sql('select md5(coalesce(jsonb_agg(to_jsonb(x) order by id),\'[]\'::jsonb)::text) from private.publication_policy_bundles x'),
      decisions:sql('select count(*) from private.need_publication_decisions'),retention:sql('select count(*) from private.retention_policy_sets where retention_execution is not null')};
    write('ai-review-admission.json',{sourceSha:env.GITHUB_SHA,historyCount:106,manifest,baseline,localOnly:true,
      actualAuth:true,providerProof:false,gatewayProof:false,publicationProof:false,predecessor105Preserved:true,
      nativeDependencyBoundary:'EXACT106_REAL_AUTH_RPC_ACTUAL_HANDLER_SYNTHETIC_PROVIDER'});
    console.log('PASS AI_REVIEW_EXACT106_ADMISSION');return;
  }
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const client=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
  const service=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
  const ok=async promise=>{const r=await promise;if(r.error)throw new Error('AI_REVIEW_LOCAL_RPC_FAILED');return r.data;};
  if(mode==='create-account') {
    const identities=[];
    for(const role of ['owner','other']) {
      const nonce=randomUUID(),email=`ai-review-${role}-${nonce}@proof.invalid`;
      const signed=await ok(client.auth.signUp({email,password:env.RU5_DEVICE_PASSWORD,options:{data:{first_name:'AI',last_name:'Review proof',city:'Novi Sad'}}}));
      const accountId=validId(signed.user?.id);
      assert.ok(![env.RU5_DEVICE_REQUESTER_USER_ID,env.RU5_DEVICE_WORKER_USER_ID].includes(accountId));
      if(!signed.session)await ok(service.auth.admin.updateUserById(accountId,{email_confirm:true}));
      await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
      const profile=await ok(client.from('app_profiles').select('id,profile_status').eq('account_id',accountId).eq('kind','REQUESTER').single());
      assert.equal(profile.profile_status,'ACTIVE');
      assert.equal(sql(`select count(*) from public.ai_conversations where account_id=${lit(accountId)}`),'0');
      identities.push({accountId,email,profileId:validId(profile.id),nonce:nonce.slice(0,8)});
      await ok(client.auth.signOut());
    }
    const start=new Date();start.setUTCDate(start.getUTCDate()+7);start.setUTCHours(7,0,0,0);
    const end=new Date(start.getTime()+2*3600_000);
    write('ai-review-fixture.json',{sourceSha:env.GITHUB_SHA,localOnly:true,providerProof:false,gatewayProof:false,
      ...identities[0],other:identities[1],marketplace,input:'Dve osobe i kombi za prenos stvari u Novom Sadu.',
      proposals:proposedFacts(identities[0].nonce,start.toISOString(),end.toISOString())});
    console.log('PASS AI_REVIEW_FRESH_REAL_AUTH no_conversation_preopen');return;
  }
  const fixture=read('ai-review-fixture.json');assert.equal(fixture.sourceSha,env.GITHUB_SHA);
  const account=validId(fixture.accountId);await ok(client.auth.signInWithPassword({email:fixture.email,password:env.RU5_DEVICE_PASSWORD}));
  const conversations=rows(`select id,purpose,status,fact_schema_version from public.ai_conversations where account_id=${lit(account)}`);
  assert.equal(conversations.length,1,'Exactly one owner UI-opened conversation');
  const conversationId=validId(conversations[0].id);assert.equal(conversations[0].fact_schema_version,'NEED_FACT_V2');
  const review=await ok(client.rpc('rpc_ai_need_review_v2',{p_conversation_id:conversationId}));
  const facts=rows(`select id,fact_key,fact_value,source,status,confirmed_at,confirmed_by_user_id,superseded_at,superseded_by from public.ai_structured_facts where conversation_id=${lit(conversationId)} order by created_at,id`);
  const needs=rows(`select n.*,g.public_topology from public.needs n left join public.need_geography g on g.need_id=n.id where n.requester_account_id=${lit(account)}`);
  const receipts=rows(`select client_request_id,conversation_id,need_id,result from private.need_draft_save_commands where account_id=${lit(account)}`);
  const turns=rows(`select client_request_id,conversation_id,turn_id,state,receipt from private.ai_need_turn_commands where account_id=${lit(account)}`);
  const observation={sourceSha:env.GITHUB_SHA,accountId:account,conversationId,review,facts,needs,receipts,turns};
  if(mode==='observe') {
    const label=env.AI_REVIEW_OBSERVATION;assert.match(label??'',/^[A-Z][A-Z0-9_]{0,70}$/);
    if(!fixture.conversationId)write('ai-review-fixture.json',{...fixture,conversationId});
    write(`AI_STATE_${label}.json`,observation);console.log('PASS AI_REVIEW_STATE '+label);return;
  }
  if(mode.endsWith('-marketplace')) {
    const prior=read('proof-report.json');assert.equal(prior.result,'PASS');assert.equal(prior.sourceSha,env.GITHUB_SHA);
    assert.equal(prior.publicationProof,false);assert.equal(fixture.marketplace,true);
    assert.equal(needs.length,1);assert.equal(receipts.length,1);assert.equal(turns.length,1);
    const n=needs[0],needId=validId(n.id);assert.equal(receipts[0].need_id,needId);assert.equal(review.boundNeedId,needId);
    assert.equal(n.required_slots,3);assert.deepEqual(n.required_vehicles,['Kombi']);assert.equal(n.task_country_code,'RS');
    const sensitive=rows(`select resolved_location from public.need_sensitive where need_id=${lit(needId)}`);
    assert.equal(sensitive.length,1);assertManualNoviSad(sensitive[0].resolved_location,n.public_topology);
    const tableHash=table=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x`);
    if(mode==='prepare-marketplace') {
      assert.equal(n.status,'DRAFT');assert.equal(sql(`select count(*) from private.need_publication_decisions where need_id=${lit(needId)}`),'0');
      const immutable={need:hash(JSON.stringify(n)),history:tableHash('supabase_migrations.schema_migrations'),retention:tableHash('private.retention_policy_sets'),markets:tableHash('private.location_market_configs')};
      await ok(client.auth.signOut());await ok(client.auth.signInWithPassword({email:fixture.other.email,password:env.RU5_DEVICE_PASSWORD}));
      assert.equal((await ok(client.auth.getUser())).user.id,fixture.other.accountId);
      const wp=await ok(client.from('app_profiles').select('id').eq('kind','WORKER').eq('account_id',fixture.other.accountId).single());
      // Actual owner REST and existing location/activation RPCs. Preserve the
      // AI-created requirements: team of3, Kombi, exact fixed interval.
      await ok(client.from('app_profiles').update({display_name:'AI Vertical Worker',city:'Novi Sad',skills:['Prenos stvari'],
        tools:[],vehicles:['Kombi'],team_capacity:3,available_now:false,radius_km:50}).eq('id',wp.id).eq('account_id',fixture.other.accountId));
      const wl=await ok(client.rpc('rpc_get_worker_location'));
      await ok(client.rpc('rpc_save_worker_location',{p_expected_revision:wl.revision,p_confirmed:true,
        p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:50,approximatePosition:{latitude:45.25,longitude:19.83}}}));
      await ok(client.rpc('rpc_complete_worker_profile',{p_profile_id:wp.id}));
      const worker=await ok(client.from('app_profiles').select('id,profile_status,team_capacity,vehicles,available_now').eq('id',wp.id).single());
      assert.equal(worker.profile_status,'ACTIVE');assert.equal(worker.team_capacity,3);assert.deepEqual(worker.vehicles,['Kombi']);assert.equal(worker.available_now,false);
      const bundle=validId(sql("select id from private.publication_policy_bundles where policy_id='RS_PUBLICATION_POLICY_MINIMUM' and jurisdiction='RS' and version=1"));
      sql(syntheticPolicySql(bundle));
      assert.equal(hash(JSON.stringify(rows(`select n.*,g.public_topology from public.needs n left join public.need_geography g on g.need_id=n.id where n.id=${lit(needId)}`)[0])),immutable.need);
      for(const [key,table] of Object.entries({history:'supabase_migrations.schema_migrations',retention:'private.retention_policy_sets',markets:'private.location_market_configs'}))assert.equal(tableHash(table),immutable[key]);
      write('marketplace-policy-fixture.json',{sourceSha:env.GITHUB_SHA,localOnly:true,productionPolicyActivation:false,
        syntheticReviewedPolicy:true,legalContentProof:false,bundleId:bundle,needId,workerProfileId:wp.id,immutable});
      console.log('PASS MARKETPLACE_LOCAL_POLICY_AND_OWNED_WORKER no_Need_or_decision_write');return;
    }
    const setup=read('marketplace-policy-fixture.json');assert.equal(setup.sourceSha,env.GITHUB_SHA);assert.equal(setup.needId,needId);
    assert.equal(n.status,'PUBLISHED');
    const decisions=rows(`select id,decision_sequence,need_revision,canonical_fingerprint,policy_bundle_id,outcome,decision_source,provider_ref,model_ref from private.need_publication_decisions where need_id=${lit(needId)}`);
    const published=rows(`select requester_account_id,client_request_id,need_id,expected_revision,decision_id,decision_sequence,canonical_fingerprint,policy_bundle_id,result from private.need_publish_commands where need_id=${lit(needId)}`);
    assert.equal(decisions.length,1);assert.equal(published.length,1);const d=decisions[0],p=published[0];
    assert.equal(d.outcome,'ALLOW');assert.equal(d.decision_source,'PUBLICATION_EVALUATOR_V1');assert.equal(d.provider_ref,'openai');assert.equal(d.model_ref,'SYNTHETIC_NATIVE_PUBLICATION_PROOF');
    assert.equal(p.requester_account_id,account);assert.equal(p.expected_revision,d.need_revision);assert.equal(p.decision_id,d.id);
    assert.equal(String(p.decision_sequence),String(d.decision_sequence));assert.equal(p.canonical_fingerprint,d.canonical_fingerprint);
    assert.equal(p.policy_bundle_id,d.policy_bundle_id);assert.equal(d.policy_bundle_id,setup.bundleId);assert.equal(p.result.needId,needId);
    assert.equal(p.result.status,'PUBLISHED');assert.equal(n.revision,p.expected_revision);
    assert.equal(p.result.idempotentReplay,false);assert.equal(p.result.responseDeadline,null);
    assert.equal(Date.parse(p.result.publishedAt),Date.parse(n.published_at));
    const adapter=read('ai-edge-adapter.json');assert.equal(adapter.publicationProviderCalls,1);assert.equal(adapter.publicationHandlerCalls,1);
    await ok(client.auth.signOut());await ok(client.auth.signInWithPassword({email:fixture.other.email,password:env.RU5_DEVICE_PASSWORD}));
    const publicNeed=await ok(client.from('needs').select('id,status,approximate_lat,approximate_lng').eq('id',needId).single());
    assert.equal(publicNeed.status,'PUBLISHED');assert.ok(Number.isFinite(publicNeed.approximate_lat)&&Number.isFinite(publicNeed.approximate_lng));
    assert.deepEqual(await ok(client.from('need_sensitive').select('*').eq('need_id',needId)),[]);
    const foreign=await client.rpc('rpc_ai_read_need_turn_v2',{p_conversation_id:conversationId,p_client_request_id:turns[0].client_request_id});assert.ok(foreign.error);
    for(const table of ['marketplace_responses','need_selections','agreements'])assert.equal(sql(`select count(*) from public.${table} where need_id=${lit(needId)}`),'0');
    for(const [key,table] of Object.entries({history:'supabase_migrations.schema_migrations',retention:'private.retention_policy_sets',markets:'private.location_market_configs'}))assert.equal(tableHash(table),setup.immutable[key]);
    const publication={result:'PASS',sourceSha:env.GITHUB_SHA,localOnly:true,historyCount:nativeHistory,nativeBoundary,needId,conversationId,requesterId:account,
      workerId:fixture.other.accountId,actualNativePins:true,actualB06:true,actualB07:true,publicationProof:true,
      providerProof:false,gatewayProof:false,productionPolicyActivation:false,legalContentProof:false,
      privateLocationHiddenFromWorker:true,decision:d,publish:p,adapter};
    write('marketplace-publication.json',publication);
    const baseline=Object.fromEntries(Object.entries({publication:'private.publication_policy_bundles',decisions:'private.need_publication_decisions',retention:'private.retention_policy_sets',markets:'private.location_market_configs'}).map(([k,t])=>[k,tableHash(t)]));
    write('core-fixture.json',{result:'PASS',sourceSha:env.GITHUB_SHA,localOnly:true,preparationHistory:nativeHistory,nativeHistoryRequired:nativeHistory,
      syntheticFixturePrecondition:false,publicationProof:true,productionPolicyActivation:false,providerProof:false,aiProof:true,
      baseline,needId,needTitle:n.title,searchToken:fixture.nonce,requesterId:account,workerId:fixture.other.accountId,
      needRevision:n.revision,startAt:n.starts_at,endAt:n.ends_at,requiredSlots:3,publicPoint:{lat:n.approximate_lat,lng:n.approximate_lng},
      publicationSha256:hash(readFileSync(file('marketplace-publication.json')))});
    console.log('PASS MARKETPLACE_SAME_AI_NEED_PUBLICATION_BINDING actual_B06_B07 private_pins');return;
  }
  assert.equal(needs.length,1);assert.equal(receipts.length,1);assert.equal(turns.length,1);
  assert.equal(needs[0].id,review.boundNeedId);assert.equal(needs[0].id,receipts[0].need_id);assert.equal(needs[0].status,'DRAFT');
  assert.equal(turns[0].state,'SUCCEEDED');assert.equal(turns[0].receipt.proposedCount,11);
  assert.equal(sql(`select count(*) from public.ai_messages where conversation_id=${lit(conversationId)}`),'2');
  assert.equal(sql(`select count(*) from private.ai_need_open_commands where account_id=${lit(account)}`),'1');
  const active=facts.filter(f=>f.superseded_at===null);assert.equal(active.length,marketplace?12:11);
  if(marketplace)assertManualNoviSad(active.find(f=>f.fact_key==='need.resolved_location')?.fact_value,needs[0].public_topology);
  assert.ok(active.every(f=>f.status==='CONFIRMED'&&f.confirmed_by_user_id===account&&f.confirmed_at));
  assert.equal(needs[0].required_slots,3);assert.deepEqual(needs[0].required_vehicles,['Kombi']);
  assert.equal(needs[0].task_country_code,'RS');assert.equal(needs[0].requester_price_rsd,null);
  for(const table of ['marketplace_responses','need_selections','agreements'])assert.equal(sql(`select count(*) from public.${table} where need_id=${lit(needs[0].id)}`),'0');
  const adapter=read('ai-edge-adapter.json');assert.equal(adapter.sourceSha,env.GITHUB_SHA);
  assert.equal(adapter.providerCalls,1);assert.equal(adapter.committedResponseDropped,true);assert.equal(adapter.handlerCalls,1);
  await ok(client.auth.signOut());await ok(client.auth.signInWithPassword({email:fixture.other.email,password:env.RU5_DEVICE_PASSWORD}));
  const foreign=await client.rpc('rpc_ai_read_need_turn_v2',{p_conversation_id:conversationId,p_client_request_id:turns[0].client_request_id});assert.ok(foreign.error);
  assert.equal((await ok(client.from('needs').select('id').eq('id',needs[0].id))).length,0);
  assert.equal(sql(`select count(*) from public.needs where requester_account_id=${lit(validId(fixture.other.accountId))}`),'0');
  const prior=read('ai-review-admission.json');
  assert.equal(sql('select md5(coalesce(jsonb_agg(to_jsonb(x) order by id),\'[]\'::jsonb)::text) from private.publication_policy_bundles x'),prior.baseline.publication);
  assert.equal(sql('select count(*) from private.need_publication_decisions'),prior.baseline.decisions);
  assert.equal(sql('select count(*) from private.retention_policy_sets where retention_execution is not null'),prior.baseline.retention);
  write('proof-report.json',{result:'PASS',sourceSha:env.GITHUB_SHA,historyCount:nativeHistory,...(nativeBoundary?{nativeBoundary}:{}),localOnly:true,actualAuth:true,
    actualNativeClient:true,actualHandler:true,actualSql:true,providerProof:false,gatewayProof:false,publicationProof:false,
    downstreamTaskDetailV2Parity:false,entryMotionProven:false,realProviderLocationProven:false,
    nativeRoundtrip:'COMPOSER_UNKNOWN_READBACK_HUMAN_CORRECTION_CONFIRM_SAVE_OTHER_ACCOUNT',
    oneTurn:true,oneDraft:true,oneSaveReceipt:true,gatesUnchanged:true,adapter});
  console.log('PASS AI_REVIEW_ARTIFACT_CHAIN');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv[2]).catch(()=>{console.error('AI_REVIEW_FIXTURE_FAILED');process.exitCode=1;});
