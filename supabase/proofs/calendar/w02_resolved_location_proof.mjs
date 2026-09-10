// Real owner clients/Auth/PostgREST against the existing disposable W02 database.
// Private coordinates are written only through location review and canonical RPCs.
// Publication status is the pre-existing labelled fixture helper, not policy activation.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export async function proveResolvedLocation(ctx) {
  const { owner, worker, third, anon, fixtureService, a, open, save, review, completeDraft, publishFixture, ok, sql, q, env, out } = ctx;
  const report={unit:'W02_RESOLVED_LOCATION',source_sha:env.GITHUB_SHA,result:'RUNNING',checks:[],input_sha256:{},
    live_access:false,live_promotion:false,mocked_rpc_responses:false,location_fixture_sql:false,
    provider_called:false,provider_attestation:false,ui_journey:false,
    synthetic_nonlocation_ai_facts:true,published_status_fixture_sql:true,real_response_selection_agreement:true};
  let stage='PREFLIGHT';
  const begin=name=>{stage=name;console.log('START_RESOLVED '+name);};
  const pass=()=>{report.checks.push({name:stage,result:'PASS'});console.log('PASS_RESOLVED '+stage);};
  const reject=async promise=>{const r=await promise;assert.ok(r.error,'RPC must reject');return r.error;};
  const deep=x=>JSON.parse(JSON.stringify(x));
  const point=(slot,extra={})=>({slot,latitudeE6:45251234,longitudeE6:19831234,origin:{kind:'MANUAL_PIN'},...extra});
  const physical=(geography,points,details={})=>{
    const input={taskCountryCode:'RS',geography,exactAddress:null,accessNotes:null,...details};
    return {...input,resolvedLocation:{version:1,binding:{taskCountryCode:input.taskCountryCode,geography,exactAddress:input.exactAddress},points}};
  };
  const rawSave=(cid,value,revision,confirmed=true)=>owner.rpc('rpc_save_need_location_review',{
    p_conversation_id:cid,p_expected_revision:revision,p_confirmed:confirmed,p_value:value});
  const sensitive=nid=>ok(owner.from('need_sensitive').select('*').eq('need_id',nid).single());
  const material=nid=>JSON.parse(sql(`select private.need_full_edit_snapshot(${q(nid)}::uuid)`));
  const activeFact=(cid,key)=>ok(owner.from('ai_structured_facts').select('*').eq('conversation_id',cid).eq('fact_key',key).is('superseded_at',null).single());
  const edit=async nid=>ok(owner.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:nid}));
  const confirmEdit=(nid,e,key='resolved-edit-'+randomUUID())=>ok(owner.rpc('rpc_confirm_need_edit_from_review_v2',{
    p_need_id:nid,p_expected_revision:e.revision,p_conversation_id:e.conversationId,p_client_request_id:key}));
  try {
    for(const file of ['supabase/proofs/calendar/w02_resolved_location_proof.mjs','supabase/migrations/20260910130851_clean_w02_resolved_location_authority.sql',
      'src/lib/location.ts','src/contracts/location.ts','src/data/locationClientService.ts'])report.input_sha256[file]=createHash('sha256').update(readFileSync(file)).digest('hex');

    begin('MANUAL_PRIVATE_FACT_ACTUAL_CLIENT_OWNER_REPLAY_AND_UNTRUSTED_PROVIDER_HINT');
    const permissions=JSON.parse(sql(`select jsonb_build_object(
      'draft_auth',has_function_privilege('authenticated','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE'),
      'draft_service',has_function_privilege('service_role','public.rpc_save_need_draft_from_review(uuid,uuid,text)','EXECUTE'),
      'inner_auth',has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE'),
      'inner_service',has_function_privilege('service_role','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE'),
      'inner_anon',has_function_privilege('anon','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE'),
      'wrapper_auth',has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text)','EXECUTE'),
      'wrapper_anon',has_function_privilege('anon','public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text)','EXECUTE'))`));
    assert.deepEqual(permissions,{draft_auth:true,draft_service:true,inner_auth:false,inner_service:false,inner_anon:false,wrapper_auth:true,wrapper_anon:false});
    await reject(owner.rpc('rpc_confirm_need_edit_from_review',{p_need_id:randomUUID(),p_expected_revision:1,p_conversation_id:randomUUID(),p_client_request_id:'forbidden-inner'}));
    report.predecessor_writer_acl_verified=true;
    const geo={mode:'MULTI_STOP',start:{city:'Novi Sad',area:'Liman'},waypoints:[{city:'Novi Sad',label:'Second place'}],end:{city:'Novi Sad',area:'Centar'}};
    const input=physical(geo,[point('start',{address:'  PRIVATE START 12  ',accessNotes:'PRIVATE DOOR\nBell'}),
      point('waypoints/0',{latitudeE6:45260000,longitudeE6:19840000,origin:{kind:'PROVIDER_CANDIDATE',providerHint:'isolated-test-provider',candidateHint:'  candidate-1  '},address:'PRIVATE STOP'}),
      point('end',{latitudeE6:45270000,longitudeE6:19850000,address:null,accessNotes:null})]);
    const cid=await open(),before=await review(a,cid),saved=await save(a,cid,input);
    const normalized=saved.review.value;
    assert.equal(normalized.resolvedLocation.points[0].address,'PRIVATE START 12');
    assert.equal(normalized.resolvedLocation.points[1].origin.candidateHint,'candidate-1');
    assert.equal('address' in normalized.resolvedLocation.points[2],false);
    const fact=await activeFact(cid,'need.resolved_location');
    assert.equal(fact.source,'EXPLICIT_USER_ANSWER');assert.equal(fact.status,'CONFIRMED');assert.equal(fact.confirmed_by_user_id,env.RU5_DEVICE_REQUESTER_USER_ID);
    assert.equal(fact.evidence_excerpt,null);assert.equal(fact.value_type,'OBJECT');assert.ok(fact.confirmed_at);
    assert.equal((await save(a,cid,input,before.revision)).idempotentReplay,true);
    assert.equal((await activeFact(cid,'need.resolved_location')).id,fact.id);
    const registry=JSON.parse(sql("select to_jsonb(r) from private.need_fact_registry r where fact_key='need.resolved_location'"));
    assert.equal(registry.privacy_class,'PRIVATE');assert.equal(registry.material,true);assert.equal(registry.required_for_draft,false);
    await reject(third.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));
    await reject(anon.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));
    assert.deepEqual(await ok(third.from('ai_structured_facts').select('fact_value').eq('conversation_id',cid)),[]);
    pass();

    begin('ALL_EXISTING_TOPOLOGIES_PARTIAL_AND_TWENTY_WAYPOINTS_WITHOUT_NEW_ROUTE_MODEL');
    const cases=[
      physical({mode:'STATIONARY',start:{city:'Novi Sad'}},[point('start',{latitudeE6:0,longitudeE6:0})]),
      physical({mode:'POINT_TO_POINT',start:{city:'Novi Sad'},end:{city:'Novi Sad'}},[point('end'),point('start')]),
      physical({mode:'MULTI_STOP',start:{city:'Novi Sad'},waypoints:Array.from({length:20},(_,i)=>({label:'Place '+i}))},[point('start'),...Array.from({length:20},(_,i)=>point('waypoints/'+i))]),
      physical({mode:'AREA_BASED',serviceArea:{city:'Novi Sad',area:'Liman'},start:{city:'Novi Sad'}},[point('serviceArea'),point('start')]),
      physical({mode:'AREA_BASED',start:{city:'Novi Sad'}},[point('start')]),
      physical({mode:'MULTI_STOP',start:{city:'Novi Sad'},end:{city:'Novi Sad'}},[point('end')]),
    ];
    for(const example of cases){const c=await open();const r=await save(a,c,example);assert.equal(r.review.confirmed,true);assert.equal(r.review.value.resolvedLocation.points.length,example.resolvedLocation.points.length);}
    assert.equal((await save(a,await open(),cases[0])).review.value.resolvedLocation.points[0].latitudeE6,0);
    pass();

    begin('STRICT_SLOT_E6_PRIVATE_FIELD_AND_BINDING_NEGATIVES_ARE_ATOMIC');
    const malformed=[];
    const bad=mutate=>{const x=deep(normalized);mutate(x);malformed.push(x);};
    bad(x=>x.resolvedLocation.points.push(deep(x.resolvedLocation.points[0])));
    for(const slot of ['waypoints/01','waypoints/-1','waypoints/1.0','waypoints/20','waypoints/1','serviceArea'])bad(x=>x.resolvedLocation.points[0].slot=slot);
    for(const num of [45251234.5,90000001,'45251234',null])bad(x=>x.resolvedLocation.points[0].latitudeE6=num);
    bad(x=>x.resolvedLocation.points[0].longitudeE6=-180000001);
    bad(x=>x.resolvedLocation.points[0].origin={kind:'SERVER_GEOCODED'});
    bad(x=>x.resolvedLocation.points[0].origin={kind:'PROVIDER_CANDIDATE',providerHint:'https://invalid.test',candidateHint:null});
    bad(x=>x.resolvedLocation.points[0].address='x'.repeat(1001));
    bad(x=>x.resolvedLocation.points[0].accessNotes='x'.repeat(2001));
    bad(x=>x.resolvedLocation.points[0].address='\u0000');
    bad(x=>x.resolvedLocation.binding.taskCountryCode='BA');
    bad(x=>x.resolvedLocation.binding.geography.start.area='OTHER PUBLIC PLACE');
    bad(x=>x.resolvedLocation.binding.exactAddress='OTHER PRIVATE ADDRESS');
    bad(x=>x.geography.waypoints.push({city:'Novi Sad'}));
    bad(x=>x.resolvedLocation.points=[]);
    bad(x=>x.resolvedLocation.confirmedByAccountId=env.RU5_DEVICE_WORKER_USER_ID);
    for(const x of malformed)await reject(rawSave(cid,x,saved.review.revision));
    await reject(rawSave(cid,normalized,saved.review.revision,false));
    assert.deepEqual(await review(a,cid),saved.review);
    const objectOrder=deep(normalized);objectOrder.resolvedLocation.binding.geography={end:geo.end,waypoints:geo.waypoints,start:{area:' Liman ',city:'Novi Sad'},mode:'MULTI_STOP'};
    assert.equal((await ok(rawSave(cid,objectOrder,saved.review.revision))).idempotentReplay,true);
    pass();

    begin('SIXTY_FOUR_KIB_BOUNDARY_IS_UTF8_BOUNDED_WITH_NO_TRUNCATION');
    const largeGeo={mode:'MULTI_STOP',start:{city:'Novi Sad'},waypoints:Array.from({length:20},(_,i)=>({label:'Slot '+i}))};
    const large=physical(largeGeo,[point('start'),...Array.from({length:20},(_,i)=>point('waypoints/'+i,{address:'š'.repeat(1000),accessNotes:'ž'.repeat(2000)}))]);
    assert.ok(Buffer.byteLength(JSON.stringify(large),'utf8')>65536);
    await reject(rawSave(cid,large,saved.review.revision));
    assert.deepEqual(await review(a,cid),saved.review);
    pass();

    begin('AI_SERVICE_AND_GENERIC_FACT_COMMANDS_CANNOT_ORIGINATE_MANUAL_CONFIRMATION');
    await reject(fixtureService.rpc('rpc_ai_apply_interview_turn_v2_service',{p_account_id:env.RU5_DEVICE_REQUESTER_USER_ID,p_conversation_id:cid,
      p_user_message:'Synthetic forbidden coordinate proposal',p_assistant_message:'Synthetic',p_safety:'REVIEW',
      p_proposals:[{key:'need.resolved_location',value:normalized.resolvedLocation,displayValue:'Not human',evidence:'Synthetic',confidence:1}]}));
    await reject(owner.rpc('rpc_ai_correct_fact_v2',{p_fact_id:fact.id,p_value:normalized.resolvedLocation,p_display_value:'Bypass'}));
    await reject(owner.rpc('rpc_ai_confirm_fact',{p_fact_id:fact.id}));
    const spoof={...fact,id:randomUUID()};delete spoof.created_at;
    await reject(fixtureService.from('ai_structured_facts').insert({...spoof,conversation_id:await open()}));
    assert.equal((await activeFact(cid,'need.resolved_location')).id,fact.id);
    pass();

    begin('PUBLIC_SLOT_TEXT_COUNTRY_WITNESS_AND_PRIVATE_ADDRESS_INVALIDATE_OLD_PINS');
    const c=await open();await save(a,c,normalized);
    const current=await activeFact(c,'need.task_geography');
    const changed=deep(geo);changed.waypoints[0].label='Changed public stop';
    await ok(owner.rpc('rpc_ai_correct_fact_v2',{p_fact_id:current.id,p_value:changed,p_display_value:'Changed public stop'}));
    assert.equal((await review(a,c)).value.resolvedLocation,null);
    const old=await ok(owner.from('ai_structured_facts').select('superseded_at,fact_value').eq('conversation_id',c).eq('fact_key','need.resolved_location').single());
    assert.ok(old.superseded_at);assert.deepEqual(old.fact_value,normalized.resolvedLocation);
    const c2=await open();await save(a,c2,normalized);
    await ok(fixtureService.rpc('rpc_ai_apply_interview_turn_v2_service',{p_account_id:env.RU5_DEVICE_REQUESTER_USER_ID,p_conversation_id:c2,
      p_user_message:'Synthetic corrected public place',p_assistant_message:'Synthetic',p_safety:'REVIEW',
      p_proposals:[{key:'need.task_geography',value:changed,displayValue:'Changed public stop',evidence:'Synthetic',confidence:1}]}));
    assert.equal((await review(a,c2)).value.resolvedLocation,null);
    await reject(rawSave(cid,{...normalized,exactAddress:'NEW ADDRESS'},saved.review.revision));
    const manuallyChanged={...normalized,exactAddress:'NEW ADDRESS',resolvedLocation:null};
    await save(a,c2,manuallyChanged);assert.equal((await review(a,c2)).value.resolvedLocation,null);
    pass();

    begin('CANONICAL_DRAFT_PRIVATE_ENVELOPE_START_SCALAR_COARSE_ANCHOR_AND_PUBLIC_PRIVACY');
    const nid=await completeDraft(cid),stored=await sensitive(nid);
    assert.deepEqual(stored.resolved_location.value,normalized.resolvedLocation);
    assert.equal(stored.resolved_location.confirmedByAccountId,fact.confirmed_by_user_id);
    assert.equal(Date.parse(stored.resolved_location.confirmedAt),Date.parse(fact.confirmed_at));
    assert.equal(Number(stored.exact_lat),45.251234);assert.equal(Number(stored.exact_lng),19.831234);
    assert.equal(stored.exact_address,''); // per-stop address never overwrites the legacy global scalar
    const publicNeed=await ok(owner.from('needs').select('approximate_lat,approximate_lng').eq('id',nid).single());
    assert.deepEqual(publicNeed,{approximate_lat:45.25,approximate_lng:19.83});
    assert.deepEqual(material(nid).privateLocation.resolvedLocation,stored.resolved_location);
    publishFixture(nid);
    const publicRows=await ok(third.from('need_geography').select('*').eq('need_id',nid));
    assert.deepEqual(publicRows[0].public_topology,geo);
    const exposed=JSON.stringify(publicRows)+JSON.stringify(await ok(third.from('needs').select('*').eq('id',nid)));
    for(const secret of ['PRIVATE START','PRIVATE STOP','PRIVATE DOOR','candidate-1','45251234'])assert.equal(exposed.includes(secret),false);
    assert.deepEqual(await ok(third.from('need_sensitive').select('*').eq('need_id',nid)),[]);
    pass();

    begin('CLONE_PRESERVES_HUMAN_METADATA_AND_PIN_ONLY_EDIT_IS_MATERIAL_WITH_REPLAY');
    const e=await edit(nid),cloned=await activeFact(e.conversationId,'need.resolved_location');
    assert.deepEqual(cloned.fact_value,normalized.resolvedLocation);assert.equal(cloned.source,'EXPLICIT_USER_ANSWER');
    assert.equal(Date.parse(cloned.confirmed_at),Date.parse(fact.confirmed_at));
    const noChange=await owner.rpc('rpc_confirm_need_edit_from_review_v2',{p_need_id:nid,p_expected_revision:e.revision,p_conversation_id:e.conversationId,p_client_request_id:'resolved-nochange-'+randomUUID()});
    assert.ok(noChange.error);assert.equal(noChange.error.message,'NO_MATERIAL_CHANGE');
    const change=deep(normalized);change.resolvedLocation.points[1].latitudeE6+=1;
    await save(a,e.conversationId,change);
    const key='resolved-material-'+randomUUID(),updated=await confirmEdit(nid,e,key);
    assert.equal(updated.revision,e.revision+1);assert.equal(updated.requiresReadmission,true);
    assert.equal((await confirmEdit(nid,e,key)).idempotentReplay,true);
    assert.equal((await sensitive(nid)).resolved_location.value.points[1].latitudeE6,change.resolvedLocation.points[1].latitudeE6);
    const changedMaterial=material(nid);
    await reject(owner.from('needs').update({approximate_lat:1}).eq('id',nid));
    assert.deepEqual(material(nid),changedMaterial);
    pass();

    begin('OLD_CLIENT_OMISSION_AND_LEGACY_SCALAR_MATERIAL_WRITER_CLEAR_RESOLVED_STATE');
    publishFixture(nid);const e2=await edit(nid);const omitted=deep(normalized);delete omitted.resolvedLocation;
    const read=await review(a,e2.conversationId);await ok(rawSave(e2.conversationId,omitted,read.revision));
    await confirmEdit(nid,e2);
    const clear=await sensitive(nid);assert.equal(clear.resolved_location,null);assert.equal(clear.exact_lat,null);assert.equal(clear.exact_lng,null);
    assert.equal(material(nid).approximateLat,null);assert.equal(material(nid).approximateLng,null);
    const c3=await open();await save(a,c3,normalized);const legacyNeed=await completeDraft(c3);publishFixture(legacyNeed);
    const snapshot=material(legacyNeed);delete snapshot.taskCountryCode;delete snapshot.taskTimezone;delete snapshot.publicTopology;delete snapshot.criticalConditions;
    snapshot.title='Legacy scalar edit clears private route';
    await reject(owner.rpc('rpc_confirm_need_edit',{p_need_id:legacyNeed,p_expected_revision:1,p_client_request_id:'legacy-bypass-'+randomUUID(),p_material:snapshot}));
    delete snapshot.privateLocation.resolvedLocation;
    snapshot.privateLocation.exactAddress='Legacy new address must retire old confirmed coordinates';
    await ok(owner.rpc('rpc_confirm_need_edit',{p_need_id:legacyNeed,p_expected_revision:1,p_client_request_id:'legacy-clear-'+randomUUID(),p_material:snapshot}));
    const retired=await sensitive(legacyNeed);
    assert.equal(retired.resolved_location,null);assert.equal(retired.exact_lat,null);assert.equal(retired.exact_lng,null);
    assert.equal(material(legacyNeed).approximateLat,null);
    // Execute the canonical predecessor expression against the exact same legacy row.
    // The ephemeral helper changes no Need data and disappears with this psql session.
    const predecessorFile='supabase/migrations/20260904103000_clean_ru3_need_publication_decision.sql';
    const predecessorSource=readFileSync(predecessorFile,'utf8');
    report.input_sha256[predecessorFile]=createHash('sha256').update(predecessorSource).digest('hex');
    const original=predecessorSource.match(/create\s+(?:or\s+replace\s+)?function\s+private\.need_publication_fingerprint_snapshot\([\s\S]*?\bas\s+(\$\w*\$)[\s\S]*?\1;/i)?.[0];
    assert.ok(original,'canonical predecessor fingerprint function exists');
    const compare=sql(original.replace('private.need_publication_fingerprint_snapshot','pg_temp.w02_predecessor_fingerprint')+`\nselect jsonb_build_object(
      'legacy',pg_temp.w02_predecessor_fingerprint(${q(legacyNeed)}::uuid),
      'current',private.need_publication_fingerprint_snapshot(${q(legacyNeed)}::uuid));`);
    const fingerprints=JSON.parse(compare.split('\n').find(line=>line.startsWith('{')));
    assert.deepEqual(fingerprints.current,fingerprints.legacy,'unresolved legacy row retains the exact V1 payload, private marker and fingerprint');
    report.legacy_publication_fingerprint_preserved=true;
    pass();

    begin('AREA_ANCHOR_IS_COARSE_WITHOUT_FALSE_START_AND_REMOTE_CLEARS_ALL_PHYSICAL_POINTS');
    const area=physical({mode:'AREA_BASED',serviceArea:{city:'Novi Sad',area:'Liman'}},[point('serviceArea')]);
    const areaCid=await open();await save(a,areaCid,area);const areaNeed=await completeDraft(areaCid),areaSensitive=await sensitive(areaNeed);
    assert.equal(areaSensitive.exact_lat,null);assert.equal(areaSensitive.exact_lng,null);assert.equal(material(areaNeed).approximateLat,45.25);
    publishFixture(areaNeed);const areaEdit=await edit(areaNeed);
    await save(a,areaEdit.conversationId,{taskCountryCode:'RS',geography:{mode:'REMOTE'},exactAddress:null,accessNotes:null,resolvedLocation:null});
    await confirmEdit(areaNeed,areaEdit);
    const noPhysical=await sensitive(areaNeed);assert.equal(noPhysical.resolved_location,null);assert.equal(noPhysical.exact_lat,null);assert.equal(noPhysical.exact_address,'');
    assert.equal(material(areaNeed).approximateLat,null);assert.equal(material(areaNeed).approximateLng,null);
    assert.deepEqual((await ok(owner.from('need_geography').select('public_topology').eq('need_id',areaNeed).single())).public_topology,{mode:'REMOTE'});
    pass();

    begin('COORDINATE_ONLY_EXISTING_DIRECTIONAL_GRANT_REVEAL_REVOKE_EXPIRY_AND_TERMINAL');
    const grantCid=await open();await save(a,grantCid,normalized);const grantNeed=await completeDraft(grantCid);publishFixture(grantNeed);
    const workerProfile=sql(`select id from public.app_profiles where account_id=${q(env.RU5_DEVICE_WORKER_USER_ID)}::uuid and kind='WORKER'`);
    const response=await ok(worker.rpc('rpc_submit_response',{p_need_id:grantNeed,p_need_revision:1,p_worker_profile_id:workerProfile,p_covered_slots:1,p_price_rsd:3000,
      p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:'Isolated resolved location grant proof',p_client_request_id:'resolved-response-'+randomUUID()}));
    const aid=await ok(owner.rpc('rpc_select_response',{p_need_id:grantNeed,p_need_revision:response.needRevision,p_response_id:response.responseId,
      p_response_version:response.version,p_content_hash:response.contentHash,p_client_request_id:'resolved-select-'+randomUUID()}));
    assert.match(aid,/^[0-9a-f-]{36}$/);
    await reject(worker.rpc('rpc_reveal_contact',{p_agreement_id:aid,p_channel:'EXACT_LOCATION'}));
    await reject(worker.rpc('rpc_set_contact_grant',{p_agreement_id:aid,p_channel:'EXACT_LOCATION',p_granted:true}));
    await ok(owner.rpc('rpc_set_contact_grant',{p_agreement_id:aid,p_channel:'EXACT_LOCATION',p_granted:true}));
    const revealed=await ok(worker.rpc('rpc_reveal_contact',{p_agreement_id:aid,p_channel:'EXACT_LOCATION'}));
    assert.equal(revealed.authoritative,true);assert.equal(revealed.needId,grantNeed);assert.equal(revealed.exactAddress,'');assert.ok(revealed.grantId);
    assert.deepEqual(revealed.resolvedLocation.value,normalized.resolvedLocation);assert.equal(revealed.resolvedLocation.value.points[0].address,'PRIVATE START 12');
    await reject(third.rpc('rpc_reveal_contact',{p_agreement_id:aid,p_channel:'EXACT_LOCATION'}));
    await reject(owner.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:grantNeed}));
    await ok(owner.rpc('rpc_set_contact_grant',{p_agreement_id:aid,p_channel:'EXACT_LOCATION',p_granted:false}));
    await reject(worker.rpc('rpc_reveal_contact',{p_agreement_id:aid,p_channel:'EXACT_LOCATION'}));
    await ok(owner.rpc('rpc_set_contact_grant',{p_agreement_id:aid,p_channel:'EXACT_LOCATION',p_granted:true}));
    // Only the existing grant expiry is time-fixtured; no location is SQL-written.
    sql(`update public.access_grants set expires_at=statement_timestamp()-interval '1 second' where agreement_id=${q(aid)}::uuid and channel='EXACT_LOCATION'`);
    report.grant_expiry_clock_fixture_sql=true;
    await reject(worker.rpc('rpc_reveal_contact',{p_agreement_id:aid,p_channel:'EXACT_LOCATION'}));
    await ok(owner.rpc('rpc_set_contact_grant',{p_agreement_id:aid,p_channel:'EXACT_LOCATION',p_granted:true}));
    await ok(owner.rpc('rpc_cancel_agreement',{p_agreement_id:aid,p_reason:'Isolated resolved-location proof complete'}));
    await reject(worker.rpc('rpc_reveal_contact',{p_agreement_id:aid,p_channel:'EXACT_LOCATION'}));
    pass();

    report.result='PASS';
  } catch(error) {
    report.result='FAIL';report.failed_stage=stage;
    report.error_type=error?.code==='ERR_ASSERTION'?'ASSERTION':'RPC_OR_SQL';
    report.failed_source_line=Number(error?.stack?.match(/w02_resolved_location_proof\.mjs:(\d+):/)?.[1])||null;
    throw error;
  } finally {
    writeFileSync(out+'/resolved-location-proof-report.json',JSON.stringify(report,null,2)+'\n');
    console.log(report.result+' W02_RESOLVED_LOCATION '+(report.failed_stage??''));
  }
}
