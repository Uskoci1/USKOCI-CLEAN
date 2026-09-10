import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { main, proposedFacts, validateAiFixture, assertManualNoviSad, syntheticPolicySql } from './ai_review_fixture.mjs';
import { admittedPath, localUpstream, forwardedHeaders, boundedBody, syntheticProviderEnvelope, syntheticPublicationEnvelope, loadPublicationHandler, PUBLICATION_PROOF_ORIGIN, publicationUpstream } from './ai_review_edge_server.mjs';
import { loadOwnedIntakeHandler } from '../supabase/proofs/ai/owned_intake_edge_runtime.mjs';

const env = { RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1:54321',
  RU5_DEVICE_DB_URL: 'postgresql://postgres:test-only@127.0.0.1:54322/postgres',
  RU5_DEVICE_PACKAGE: 'rs.uskoci.n04proof', RU5_DEVICE_PROOF_DIR: '/tmp/uskoci-ru5-device-ui',
  RU5_DEVICE_ARTIFACT_DIR: 'artifacts/ai-review-device', GITHUB_SHA: 'a'.repeat(40) };

test('exact local proof identity is admitted without requiring credentials', () => validateAiFixture(env));
test('all entry modes refuse remote targets before file/client/SQL work without exposing URL secrets', async () => {
  for (const mode of ['admit', 'create-account', 'observe', 'verify', 'prepare-marketplace','bind-marketplace']) {
    for (const changes of [
      { RU5_DEVICE_SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co' },
      { RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1.attacker.invalid:54321' },
      { RU5_DEVICE_DB_URL: 'postgresql://postgres:DO_NOT_PRINT@remote.invalid:54322/postgres' },
      { RU5_DEVICE_DB_URL: 'postgresql://postgres:DO_NOT_PRINT@127.0.0.1:54322/postgres?host=remote.invalid' },
      { RU5_DEVICE_PACKAGE: 'rs.uskoci.production' }, { RU5_DEVICE_PROOF_DIR: '/tmp/another-project' },
      { RU5_DEVICE_ARTIFACT_DIR: 'artifacts/another-proof' }, { GITHUB_SHA: 'branch-name' },
    ]) await assert.rejects(main(mode, { ...env, ...changes }), error => !error.message.includes('DO_NOT_PRINT'));
  }
});
test('synthetic proposals preserve typed people, vehicle, route, OFFERS and fixed endpoints without confirmation fields', () => {
  const facts = proposedFacts('a1b2c3d4', '2026-10-12T07:00:00Z', '2026-10-12T09:00:00Z');
  assert.equal(facts.length, 11);
  const byKey = Object.fromEntries(facts.map(f => [f.key, f]));
  assert.equal(Object.keys(byKey).length, 11);
  assert.equal(byKey['need.task_country_code'].value, 'RS');
  assert.equal(byKey['need.people_needed'].value, 2);
  assert.deepEqual(byKey['need.required_vehicles'].value, ['Kombi']);
  assert.equal(byKey['need.price_mode'].value, 'OFFERS');
  assert.equal(byKey['need.schedule_kind'].value, 'FIXED_WINDOW');
  assert.equal(byKey['need.task_geography'].value.mode, 'POINT_TO_POINT');
  assert.notDeepEqual(byKey['need.task_geography'].value.start, byKey['need.task_geography'].value.end);
  for (const fact of facts) {
    assert.deepEqual(Object.keys(fact).sort(), ['key', 'value', 'displayValue', 'evidence', 'confidence'].sort());
    assert.match(fact.evidence, /nije stvarni provider izlaz/);
  }
  assert.throws(() => proposedFacts('../bad', '2026-10-12T07:00:00Z', '2026-10-12T09:00:00Z'));
  assert.throws(() => proposedFacts('a1b2c3d4', '2026-10-12T09:00:00Z', '2026-10-12T07:00:00Z'));
});

test('the native fixture passes the actual strict Edge provider parser and preserves typed values', async () => {
  const proposals=proposedFacts('a1b2c3d4','2026-10-12T07:00:00Z','2026-10-12T09:00:00Z');
  const [accountId,conversationId,clientRequestId,turnId,attemptId,userMessageId,assistantMessageId]=[1,2,3,4,5,6,7]
    .map(n=>`${String(n).repeat(8)}-1111-4111-8111-111111111111`);
  const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
  for(const oldInvalidEnvelope of [false,true]) {
    let completed=null,failed=0;
    const turn=state=>({conversationId,clientRequestId,turnId,state,retryAllowed:state==='FAILED',receipt:state==='SUCCEEDED'
      ? {userMessageId,assistantMessageId,proposedCount:proposals.length,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true}:null});
    const runtime=loadOwnedIntakeHandler({env:name=>({SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_ANON_KEY:'synthetic-anon',
      SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',AI_PROVIDER:'openai',OPENAI_API_KEY:'synthetic-provider',OPENAI_MODEL:'synthetic-model'})[name],
      fetch:async(input,init={})=>{
        const url=new URL(String(input));
        if(url.href==='https://api.openai.com/v1/responses') {
          const payload=syntheticProviderEnvelope(proposals);
          if(oldInvalidEnvelope){const output=JSON.parse(payload.output_text);output.facts=proposals;payload.output_text=JSON.stringify(output);}
          return json(payload);
        }
        assert.equal(url.origin,'http://127.0.0.1:54321');
        if(url.pathname==='/auth/v1/user')return json({id:accountId});
        if(url.pathname==='/rest/v1/ai_conversations')return json([{id:conversationId,account_id:accountId,fact_schema_version:'NEED_FACT_V2',status:'OPEN'}]);
        if(url.pathname.endsWith('/rpc_ai_claim_need_turn_v2_service'))return json({turn:turn('PROCESSING'),claim:{attemptId,
          leaseExpiresAt:new Date(Date.now()+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:[]}}});
        if(url.pathname.endsWith('/rpc_ai_complete_need_turn_v2_service')){completed=JSON.parse(init.body);return json(turn('SUCCEEDED'));}
        if(url.pathname.endsWith('/rpc_ai_fail_need_turn_v2_service')){failed++;return json(turn('FAILED'));}
        assert.fail('UNEXPECTED_SYNTHETIC_ROUTE');
      }});
    const response=await runtime.handler(new Request('http://127.0.0.1:54329/functions/v1/uskoci-ai-interview',{
      method:'POST',headers:{Authorization:'Bearer synthetic-user','Content-Type':'application/json'},body:JSON.stringify({conversationId,clientRequestId,text:'Dve osobe i kombi za prenos stvari u Novom Sadu.'})}));
    if(oldInvalidEnvelope){assert.equal(response.status,502);assert.equal(completed,null);assert.equal(failed,1);}
    else {assert.equal(response.status,200);assert.equal((await response.json()).state,'SUCCEEDED');assert.deepEqual(completed.p_proposals,proposals);assert.equal(failed,0);}
  }
});

test('proof adapter admits only exact Auth/REST/current handler routes', () => {
  for (const path of ['/auth/v1/token?grant_type=password','/auth/v1/user','/rest/v1/needs?select=id','/rest/v1/rpc/rpc_ai_read_need_turn_v2'])assert.ok(admittedPath(path));
  assert.equal(admittedPath('/functions/v1/uskoci-ai-interview'),'handler');
  for (const path of ['https://outside.invalid','//outside.invalid/auth/v1/user','/rest/v1/../auth/v1/user','/rest/v1/%2e%2e/auth/v1/user',
    '/rest/v1/%2fneeds','/auth/v1/admin/users','/storage/v1/object/private','/functions/v1/other','/auth/v1/user#fragment','/rest\\v1/needs'])assert.equal(admittedPath(path),null,path);
});
test('only application request headers pass; forwarded host and credentials cannot be invented', () => {
  const h=forwardedHeaders({authorization:'Bearer fixture',apikey:'fixture-anon',host:'evil.invalid',connection:'keep-alive',
    'x-forwarded-host':'evil.invalid','content-length':'999','content-type':'application/json',cookie:'private'});
  assert.deepEqual([...h.keys()].sort(),['apikey','authorization','content-type']);
  assert.equal(h.get('authorization'),'Bearer fixture');
});
test('request paths and queries cannot control the fixed loopback upstream authority', () => {
  for(const raw of ['//outside.invalid/auth/v1/user','http://outside.invalid/rest/v1/needs','/\\outside.invalid/auth/v1/user',
    '/rest/v1/%2f%2foutside.invalid','/auth/v1/user#@outside.invalid'])assert.equal(localUpstream(raw),null);
  for(const raw of ['/auth/v1/token?grant_type=password','/rest/v1/needs?select=id&x=https://outside.invalid',
    '/rest/v1/rpc/rpc_ai_read_need_turn_v2?value=%2F%2Foutside.invalid']) {
    const target=localUpstream(raw);assert.ok(target);
    assert.equal(target.origin,'http://127.0.0.1:54321');assert.equal(target.username,'');assert.equal(target.password,'');
    assert.equal(target.hash,'');assert.equal(target.pathname+target.search,raw);
  }
});
test('streamed bodies are bounded by actual bytes', async () => {
  assert.equal((await boundedBody(Readable.from([Buffer.from('ab'),Buffer.from('cd')]),4)).toString(),'abcd');
  await assert.rejects(boundedBody(Readable.from([Buffer.from('ab'),Buffer.from('cde')]),4),/PROOF_BODY_LIMIT/);
});

test('marketplace is an explicit closed scope; default proxy cannot invoke publication or geocoder', async()=>{
  const path='/functions/v1/uskoci-publication-evaluate';
  assert.equal(admittedPath(path),null);assert.equal(localUpstream(path),null);
  assert.equal(admittedPath(path,true),'publication');assert.equal(localUpstream(path,true).origin,'http://127.0.0.1:54321');
  for(const path of ['/functions/v1/uskoci-location-search','/functions/v1/uskoci-publication-evaluate/extra','//outside.invalid/functions/v1/uskoci-publication-evaluate'])assert.equal(admittedPath(path,true),null);
  assert.throws(()=>validateAiFixture({...env,AI_REVIEW_SCOPE:'production'}));
  for(const mode of ['prepare-marketplace','bind-marketplace'])await assert.rejects(main(mode,env));
});

test('manual pin oracle requires both actual distinct Novi Sad points and exact public topology binding',()=>{
  const geography=proposedFacts('a1b2c3d4','2026-10-12T07:00:00Z','2026-10-12T09:00:00Z').find(p=>p.key==='need.task_geography').value;
  const point={latitudeE6:45250000,longitudeE6:19835000,origin:{kind:'MANUAL_PIN'}};
  const value={version:1,binding:{taskCountryCode:'RS',geography,exactAddress:null},points:[{...point,slot:'start'},{...point,slot:'end',longitudeE6:19835200}]};
  assertManualNoviSad(value,geography);
  for(const change of [v=>v.points.pop(),v=>v.points[1].longitudeE6=19835000,v=>v.points[0].latitudeE6=0,
    v=>v.points[0].origin={kind:'PROVIDER_CANDIDATE',providerHint:'invented'},v=>v.binding.taskCountryCode='HR',
    v=>v.binding.geography.start.city='Beograd']){
    const changed=structuredClone(value);change(changed);assert.throws(()=>assertManualNoviSad(changed,geography));
  }
});

test('disposable reviewed policy setup retains the existing owner registry and never writes Need or decision',()=>{
  const sql=syntheticPolicySql('11111111-1111-4111-8111-111111111111');
  assert.ok(sql.includes('evaluatorContentSha256'));assert.ok(sql.includes('DISPOSABLE_SYNTHETIC_ONLY'));
  assert.ok(sql.includes("rule_id='RS-MIN-015' then '[]'::jsonb"));
  assert.ok(!/\b(?:insert|delete|create|grant|alter)\b/i.test(sql));
  assert.ok(!/public\.needs|need_publication_decisions|need_publish_commands/.test(sql));
  assert.throws(()=>syntheticPolicySql("x'; update public.needs set status='PUBLISHED';--"));
});

test('actual publication handler accepts native adapter provider shape and only its B06 writer; corruption closes before writer',async()=>{
  const [user,need,bundle,decision]=[1,2,3,4].map(n=>`${String(n).repeat(8)}-1111-4111-8111-111111111111`);
  const geography={mode:'POINT_TO_POINT',start:{city:'Novi Sad',area:'Centar'},end:{city:'Novi Sad',area:'Liman'}};
  const ctx={kind:'READY',needId:need,needRevision:1,authoritativeDecision:false,
    binding:{needId:need,needRevision:1,schemaVersion:'NEED_PUBLICATION_FINGERPRINT_V1',canonicalFingerprint:'a'.repeat(64),privateMaterialityMarker:'b'.repeat(64),
      taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',policyBundleId:bundle,policyId:'RS_PUBLICATION_POLICY_MINIMUM',policyVersion:1,jurisdiction:'RS',policyContentSha256:'c'.repeat(64)},
    location:{mode:'POINT_TO_POINT',complete:true,missingSlots:[]},
    policy:{schemaVersion:'USKOCI_PUBLICATION_POLICY_V1',instructions:'DISPOSABLE TEST ONLY; no production legal content.',
      rules:[{ruleId:'RS-MIN-001',instructions:'DISPOSABLE TEST ONLY',outcomes:['ALLOW','BLOCK','CLARIFY','REVIEW'],safeReasonCodes:['TEST_ALLOW']}]},
    publicNeed:{title:'AI review proof a1b2c3d4',description:'Synthetic task',category:'pomoc',scheduleKind:'FIXED_WINDOW',startsAt:'2026-10-12T07:00:00Z',endsAt:'2026-10-12T09:00:00Z',
      requiredSlots:3,priceMode:'OFFERS',requesterPriceRsd:null,requiredSkills:[],requiredTools:[],requiredVehicles:['Kombi'],requiredLicenses:[],minimumExperienceYears:null,
      verifiedIdentityRequired:false,criticalConditions:[],publicMediaRefs:[],publicGeography:{executionLocationMode:'POINT_TO_POINT',approximateCity:'Novi Sad',approximateArea:'Centar',
        approximateLat:45.25,approximateLng:19.84,topology:geography}}};
  const receipt={decisionId:decision,decisionSequence:1,needId:need,needRevision:1,canonicalFingerprint:ctx.binding.canonicalFingerprint,policyBundleId:bundle,policyVersion:1,jurisdiction:'RS',
    outcome:'ALLOW',decisionAt:'2026-09-11T00:00:00Z',ruleIds:['RS-MIN-001'],safeReasonCodes:['TEST_ALLOW'],publishable:true,authoritative:true};
  for(const corrupt of [false,true]) {
    const calls=[],json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
    const runtime=loadPublicationHandler({env:name=>({SUPABASE_URL:PUBLICATION_PROOF_ORIGIN,SUPABASE_ANON_KEY:'synthetic-anon',
      SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',OPENAI_API_KEY:'synthetic-provider',OPENAI_MODEL:'SYNTHETIC_NATIVE_PUBLICATION_PROOF'})[name],
      fetch:async(input,init={})=>{
        const url=new URL(String(input));calls.push(url.pathname);
        if(url.href==='https://api.openai.com/v1/responses') {
          const payload=JSON.parse(String(init.body));assert.equal(payload.store,false);
          for(const forbidden of ['approximateLat','approximateLng',need,user,'canonicalFingerprint','privateMaterialityMarker'])assert.ok(!String(init.body).includes(forbidden));
          const envelope=syntheticPublicationEnvelope();if(corrupt)envelope.output[0].content[0].text=JSON.stringify({outcome:'ALLOW',ruleIds:['UNKNOWN_RULE'],safeReasonCodes:['TEST_ALLOW']});
          return json(envelope);
        }
        assert.equal(publicationUpstream(url).origin,'http://127.0.0.1:54321');
        if(url.pathname==='/auth/v1/user')return json({id:user,role:'authenticated'});
        if(url.pathname==='/rest/v1/rpc/rpc_get_need_publication_context'){assert.deepEqual(JSON.parse(init.body),{p_need_id:need,p_expected_revision:1});return json(ctx);}
        assert.equal(url.pathname,'/rest/v1/rpc/rpc_record_need_publication_decision_service');
        const write=JSON.parse(init.body);assert.equal(write.p_outcome,'ALLOW');assert.deepEqual(write.p_service_provenance.evaluationContext,ctx.binding);return json(receipt);
      }});
    const result=await runtime.handler(new Request('http://127.0.0.1:54329/functions/v1/uskoci-publication-evaluate',{method:'POST',headers:{Authorization:'Bearer synthetic-user','Content-Type':'application/json'},body:JSON.stringify({needId:need,expectedRevision:1})}));
    const body=await result.json();assert.equal(result.status,200);
    if(corrupt){assert.equal(body.kind,'NOT_READY');assert.equal(body.code,'EVALUATOR_INVALID_RESPONSE');assert.equal(calls.length,3);}
    else {assert.deepEqual(body,{kind:'DECISION',decision:receipt});assert.equal(calls.length,4);}
    assert.equal(Object.keys(runtime.sourceHashes).length,1);
  }
});

test('publication proof transport maps only3 fixed handler paths without altering production TLS guard',()=>{
  for(const path of ['/auth/v1/user','/rest/v1/rpc/rpc_get_need_publication_context','/rest/v1/rpc/rpc_record_need_publication_decision_service'])assert.equal(publicationUpstream(PUBLICATION_PROOF_ORIGIN+path).href,'http://127.0.0.1:54321'+path);
  for(const url of ['https://outside.invalid/auth/v1/user',PUBLICATION_PROOF_ORIGIN+'/auth/v1/user?target=remote',PUBLICATION_PROOF_ORIGIN+'/rest/v1/needs',PUBLICATION_PROOF_ORIGIN+'/rest/v1/rpc/rpc_publish_need_canonical'])assert.throws(()=>publicationUpstream(url));
});
