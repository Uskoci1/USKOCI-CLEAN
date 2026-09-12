// Actual disposable Auth/Postgres proof. Legal documents here are synthetic
// fixture rows, never legal content, publication approval or a live mutation.
import {createHash} from 'node:crypto';
import {assert,randomUUID,sql,rows,q,ok,denied,requester,worker,anon,service,requesterId,workerId,
 login,prove,apply,pass,agreement,actor,lockedRace} from './closure_runtime.mjs';

const hash=text=>createHash('sha256').update(text).digest('hex');
const keys=(value,expected)=>assert.deepEqual(Object.keys(value).sort(),expected.slice().sort());
const legalArgs=(key,terms,privacy)=>({p_client_request_id:key,p_terms_sha256:terms,p_privacy_sha256:privacy});
const readLegal=(client,key)=>client.rpc('rpc_read_my_legal_acceptance',{p_client_request_id:key});
const legalRows=(uid,key)=>rows(`select * from public.account_legal_acceptance_events where account_id=${q(uid)}::uuid and request_id=${q(key)}`);
const documentSql=(id,kind,label,digest)=>`insert into private.legal_document_versions
 (id,document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active)
 values(${q(id)}::uuid,${q(kind)},${q(label)},${q(digest)},${q('https://proof.invalid/legal/'+label)},
 statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 minute',true)`;

await prove('V5_OWNER_SAFETY_LEGAL','v5-owner-safety-legal-report.json',async report=>{
 await apply(report,'20260912222338_clean_v5_owner_safety_legal_reads.sql',128);await login();
 report.policyFixture='DISPOSABLE_SYNTHETIC_ONLY_NOT_LEGAL_CONTENT';
 const signatures=['public.rpc_list_my_account_blocks(uuid)','public.rpc_read_my_safety_report_command(uuid)',
  'public.rpc_accept_reviewed_legal_bundle(text,text,text)','public.rpc_read_my_legal_acceptance(text)'];
 for(const fn of signatures){
  assert.equal(sql(`select has_function_privilege('authenticated',${q(fn)},'EXECUTE')`),'t');
  for(const role of ['anon','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(fn)},'EXECUTE')`),'f');
 }
 await denied(anon.rpc('rpc_list_my_account_blocks',{}));
 await denied(anon.rpc('rpc_read_my_safety_report_command',{p_client_request_id:randomUUID()}));
 await denied(anon.rpc('rpc_accept_reviewed_legal_bundle',legalArgs(randomUUID(),'a'.repeat(64),'b'.repeat(64))));
 await denied(anon.rpc('rpc_read_my_legal_acceptance',{p_client_request_id:randomUUID()}));
 for(const table of ['private.account_blocks','private.safety_reports','private.legal_document_versions','public.account_legal_acceptance_events']){
  assert.equal(sql(`select relrowsecurity from pg_class where oid=${q(table)}::regclass`),'t');
  for(const role of ['anon','authenticated'])assert.equal(sql(`select has_table_privilege(${q(role)},${q(table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
 }
 pass(report,'ACTUAL_ANON_DENIAL_AUTHENTICATED_RPC_ONLY_PRIVATE_TABLES_REMAIN_RLS_AND_NO_DIRECT_GRANTS');

 const owner=await actor('v5-outgoing-owner'),incoming=await actor('v5-incoming-owner');
 const targets=[workerId];
 // Each FK target has an actual disposable Auth account. No sign-up email is sent.
 for(let offset=0;offset<51;offset+=10){
  const batch=await Promise.all(Array.from({length:Math.min(10,51-offset)},async()=>{
   const result=await ok(service.auth.admin.createUser({email:`v5-page-${randomUUID()}@proof.invalid`,password:randomUUID()+'Aa8!',email_confirm:true}));
   return result.user.id;
  }));targets.push(...batch);
 }
 const active=targets.slice(0,51).sort(),inactive=targets[51];
 // Read-scope fixtures; the existing block writer is independently proven in118.
 sql(`insert into private.account_blocks(blocker_account_id,blocked_account_id,active,revision,last_blocked_at)
  values ${active.map((id,index)=>`(${q(owner.id)}::uuid,${q(id)}::uuid,true,${index+1},clock_timestamp())`).join(',')},
  (${q(owner.id)}::uuid,${q(inactive)}::uuid,false,1,null),
  (${q(incoming.id)}::uuid,${q(owner.id)}::uuid,true,1,clock_timestamp())`);
 const page1=await ok(owner.client.rpc('rpc_list_my_account_blocks',{}));
 keys(page1,['accountId','items','nextCursor','authoritative']);assert.equal(page1.accountId,owner.id);assert.equal(page1.authoritative,true);
 assert.equal(page1.items.length,50);assert.deepEqual(page1.items.map(x=>x.targetAccountId),active.slice(0,50));
 assert.equal(page1.nextCursor,active[49]);
 for(const item of page1.items){
  keys(item,['accountId','targetAccountId','blocked','revision','authoritative','displayName']);
  assert.equal(item.accountId,owner.id);assert.equal(item.blocked,true);assert.equal(item.authoritative,true);
  assert.ok(item.displayName===null||typeof item.displayName==='string');
 }
 const page2=await ok(owner.client.rpc('rpc_list_my_account_blocks',{p_after:page1.nextCursor}));
 assert.equal(page2.items.length,1);assert.equal(page2.nextCursor,null);
 assert.deepEqual([...page1.items,...page2.items].map(x=>x.targetAccountId),active);
 assert.ok(![...page1.items,...page2.items].some(x=>x.targetAccountId===inactive||x.targetAccountId===incoming.id));
 const incomingView=await ok(incoming.client.rpc('rpc_list_my_account_blocks',{}));
 assert.equal(incomingView.accountId,incoming.id);assert.deepEqual(incomingView.items.map(x=>x.targetAccountId),[owner.id]);
 assert.equal((await ok(owner.client.rpc('rpc_list_my_account_blocks',{p_after:active.at(-1)}))).items.length,0);
 assert.ok(!JSON.stringify(page1).includes('@proof.invalid'));
 pass(report,'DIRECTIONAL_OUTGOING_ONLY_50_PLUS_CURSOR_NO_DUPLICATES_NO_INACTIVE_OR_INCOMING_DISCLOSURE');

 const a=await agreement('v5 owner report command'),reportKey=randomUUID();
 const reportArgs={p_target_account_id:workerId,p_need_id:a.needId,p_agreement_id:a.id,p_category:'HARASSMENT',
  p_reason:'PRIVATE_V5_REASON_SENTINEL',p_narrative:'PRIVATE_V5_NARRATIVE_SENTINEL',p_client_request_id:reportKey};
 const received=await ok(requester.rpc('rpc_submit_safety_report',reportArgs));
 const found=await ok(requester.rpc('rpc_read_my_safety_report_command',{p_client_request_id:reportKey}));
 keys(found,['accountId','clientRequestId','found','authoritative','receipt']);assert.equal(found.accountId,requesterId);
 assert.equal(found.clientRequestId,reportKey);assert.equal(found.found,true);assert.equal(found.authoritative,true);
 keys(found.receipt,['reportId','received','createdAt','clientRequestId','idempotentReplay','authoritative']);
 assert.equal(found.receipt.reportId,received.reportId);assert.equal(found.receipt.createdAt,received.createdAt);
 assert.equal(found.receipt.received,true);assert.equal(found.receipt.idempotentReplay,true);
 assert.ok(!JSON.stringify(found).includes('PRIVATE_V5_'));assert.ok(!JSON.stringify(found).includes(a.id));
 const peer=await ok(worker.rpc('rpc_read_my_safety_report_command',{p_client_request_id:reportKey}));
 assert.equal(peer.accountId,workerId);assert.equal(peer.found,false);assert.equal(peer.receipt,null);
 assert.ok(!JSON.stringify(peer).includes(received.reportId));
 await denied(requester.rpc('rpc_read_my_safety_report_command',{p_client_request_id:null}),'SAFETY_REPORT_INPUT_INVALID');
 const readRace=await Promise.all([ok(requester.rpc('rpc_read_my_safety_report_command',{p_client_request_id:reportKey})),
  ok(requester.rpc('rpc_read_my_safety_report_command',{p_client_request_id:reportKey}))]);
 assert.ok(readRace.every(x=>x.receipt.reportId===received.reportId));
 assert.equal(sql(`select count(*) from private.safety_reports where reporter_account_id=${q(requesterId)}::uuid and client_request_id=${q(reportKey)}::uuid`),'1');
 assert.equal(sql("select count(*) from public.user_activity_events where payload::text like '%PRIVATE_V5_NARRATIVE_SENTINEL%'"),'0');
 pass(report,'ACTUAL_PRIVATE_REPORT_WRITE_OWN_KEY_READBACK_NO_PEER_RECEIPT_OR_PRIVATE_PAYLOAD_NO_READ_SIDE_EFFECT');

 const originalActive=rows('select id from private.legal_document_versions where is_active');
 const termsId=randomUUID(),privacyId=randomUUID(),nextTermsId=randomUUID();
 const suffix=randomUUID(),terms=hash('DISPOSABLE SYNTHETIC TERMS '+suffix),privacy=hash('DISPOSABLE SYNTHETIC PRIVACY '+suffix);
 const nextTerms=hash('DISPOSABLE SYNTHETIC NEXT TERMS '+suffix);
 try{
  sql('update private.legal_document_versions set is_active=false where is_active');
  const notReady=await ok(owner.client.rpc('rpc_get_legal_bundle',{}));assert.equal(notReady.ready,false);
  const closedKey=randomUUID();await denied(owner.client.rpc('rpc_accept_reviewed_legal_bundle',legalArgs(closedKey,terms,privacy)),'LEGAL_DOCUMENTS_NOT_PUBLISHED');
  assert.equal(legalRows(owner.id,closedKey).length,0);
  sql(documentSql(termsId,'TERMS','V5_TERMS_'+suffix,terms));
  sql(documentSql(privacyId,'PRIVACY','V5_PRIVACY_'+suffix,privacy));
  const bundle=await ok(owner.client.rpc('rpc_get_legal_bundle',{}));assert.equal(bundle.ready,true);assert.equal(bundle.acceptedCurrentBundle,false);
  assert.deepEqual(bundle.documents.map(x=>[x.kind,x.sha256]),[['TERMS',terms],['PRIVACY',privacy]]);
  for(const patch of [{p_terms_sha256:'f'.repeat(64)},{p_privacy_sha256:'e'.repeat(64)},{p_terms_sha256:'INVALID'},{p_privacy_sha256:null}]){
   const key=randomUUID();await denied(owner.client.rpc('rpc_accept_reviewed_legal_bundle',{...legalArgs(key,terms,privacy),...patch}),'LEGAL_REVIEW_CHANGED');
   assert.equal(legalRows(owner.id,key).length,0);
  }
  for(const key of ['short',' '+randomUUID()+' ','x'.repeat(97),'invalid.request.identifier']){
   await denied(owner.client.rpc('rpc_accept_reviewed_legal_bundle',legalArgs(key,terms,privacy)),'INVALID_CLIENT_REQUEST_ID');
   await denied(readLegal(owner.client,key),'INVALID_CLIENT_REQUEST_ID');
   assert.equal(legalRows(owner.id,key.trim()).length,0);
  }
  pass(report,'SYNTHETIC_LEGAL_REGISTRY_FAILS_CLOSED_WRONG_DIGEST_OR_NONCANONICAL_KEY_CREATES_NO_ACCEPTANCE');

  const key=randomUUID(),args=legalArgs(key,terms,privacy);
  const race=await Promise.all([ok(owner.client.rpc('rpc_accept_reviewed_legal_bundle',args)),ok(owner.client.rpc('rpc_accept_reviewed_legal_bundle',args))]);
  assert.deepEqual(race.map(x=>x.idempotentReplay).sort(),[false,true]);assert.equal(legalRows(owner.id,key).length,1);
  const receipt=race.find(x=>!x.idempotentReplay);
  assert.equal(receipt.accountId,owner.id);assert.equal(receipt.clientRequestId,key);assert.equal(receipt.authoritative,true);
  assert.equal(receipt.termsSha256,terms);assert.equal(receipt.privacySha256,privacy);assert.equal(receipt.accepted,true);
  const restored=await ok(readLegal(owner.client,key));
  keys(restored,['accountId','clientRequestId','found','authoritative','receipt']);
  assert.equal(restored.accountId,owner.id);assert.equal(restored.clientRequestId,key);assert.equal(restored.found,true);assert.equal(restored.authoritative,true);
  keys(restored.receipt,['accepted','idempotentReplay','acceptedAt','termsVersion','termsSha256','privacyVersion','privacySha256']);
  assert.deepEqual(restored.receipt,{accepted:true,idempotentReplay:true,acceptedAt:receipt.acceptedAt,termsVersion:receipt.termsVersion,
   termsSha256:terms,privacyVersion:receipt.privacyVersion,privacySha256:privacy});
  const ledger=legalRows(owner.id,key)[0];assert.equal(ledger.terms_document_id,termsId);assert.equal(ledger.privacy_document_id,privacyId);
  assert.equal(ledger.terms_content_sha256,terms);assert.equal(ledger.privacy_content_sha256,privacy);
  const foreign=await ok(readLegal(incoming.client,key));assert.equal(foreign.accountId,incoming.id);assert.equal(foreign.found,false);assert.equal(foreign.receipt,null);
  assert.equal((await ok(owner.client.rpc('rpc_get_legal_bundle',{}))).acceptedCurrentBundle,true);
  assert.equal((await ok(incoming.client.rpc('rpc_get_legal_bundle',{}))).acceptedCurrentBundle,false);
  pass(report,'OBSERVED_CONCURRENT_SAME_KEY_ONE_IMMUTABLE_LEGAL_LEDGER_EXACT_ACCOUNT_AND_DIGEST_READBACK_NO_PEER_RECEIPT');

  const staleKey=randomUUID();
  await denied(lockedRace(`update private.legal_document_versions set is_active=false where id=${q(termsId)}::uuid;
   ${documentSql(nextTermsId,'TERMS','V5_TERMS_NEXT_'+suffix,nextTerms)}`,
   ()=>owner.client.rpc('rpc_accept_reviewed_legal_bundle',legalArgs(staleKey,terms,privacy))),'LEGAL_REVIEW_CHANGED');
  assert.equal(legalRows(owner.id,staleKey).length,0);
  assert.equal((await ok(readLegal(owner.client,staleKey))).found,false);
  assert.equal((await ok(readLegal(owner.client,key))).receipt.termsSha256,terms);
  await denied(owner.client.rpc('rpc_accept_reviewed_legal_bundle',legalArgs(key,nextTerms,privacy)),'LEGAL_ACCEPTANCE_REQUEST_REUSED_FOR_DIFFERENT_BUNDLE');
  assert.equal(legalRows(owner.id,key).length,1);
  const nextKey=randomUUID();const next=await ok(owner.client.rpc('rpc_accept_reviewed_legal_bundle',legalArgs(nextKey,nextTerms,privacy)));
  assert.equal(next.accepted,true);assert.equal(next.termsSha256,nextTerms);assert.equal(legalRows(owner.id,nextKey).length,1);
  pass(report,'ACTUAL_PG_BLOCKING_EDGE_BUNDLE_POINTER_CHANGE_REJECTS_STALE_REVIEW_BEFORE_WRITE_OLD_RECEIPT_IMMUTABLE');
 }finally{
  sql(`update private.legal_document_versions set is_active=false where id in(${[termsId,privacyId,nextTermsId].map(id=>q(id)+'::uuid').join(',')})`);
  if(originalActive.length)sql(`update private.legal_document_versions set is_active=true where id in(${originalActive.map(x=>q(x.id)+'::uuid').join(',')})`);
 }
 assert.deepEqual(rows('select id from private.legal_document_versions where is_active order by id'),originalActive.sort((a,b)=>a.id.localeCompare(b.id)));
 report.syntheticLegalRegistryRestored=true;
 pass(report,'PREEXISTING_LEGAL_ACTIVE_POINTERS_RESTORED_NO_PROVIDER_NO_REAL_LEGAL_PUBLICATION');
});
