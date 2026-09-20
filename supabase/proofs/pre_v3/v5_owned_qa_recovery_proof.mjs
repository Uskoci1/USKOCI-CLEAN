// Disposable database/Auth proof only. Exact command fixtures are synthetic;
// this proof never fabricates or activates an approved moderation/rate policy.
import {assert,sql,prove,pass,apply,login,need,requester,worker,anon,service,ok,denied,requesterId,workerId,randomUUID,q} from './closure_runtime.mjs';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const context=(c,a,n)=>c.rpc('rpc_read_preselection_qa_context',{p_expected_user_id:a,p_need_id:n});
const read=(c,a,n,k)=>c.rpc('rpc_read_preselection_qa_command',{p_expected_user_id:a,p_need_id:n,p_client_request_id:k});
await prove('V5_OWNED_QA_RECOVERY','v5-owned-qa-recovery-report.json',async report=>{
 await apply(report,'20260912234201_clean_v5_owned_qa_recovery.sql',132);await login();
 const n=need('QA owned recovery'),other=need('QA other task'),question=randomUUID(),askKey=randomUUID(),answerKey=randomUUID(),secondKey=randomUUID(),pending=randomUUID();
 const before=Number(sql('select count(*) from private.preselection_qa_commands'));
 const c=await ok(context(worker,workerId,n));assert.equal(c.mode,'PUBLIC');assert.equal(c.canAsk,false);assert.equal(c.questionMaxChars,null);assert.equal(c.ratePolicyCode,'RU4B_RATE_POLICY_NOT_READY');
 assert.equal((await ok(context(requester,requesterId,n))).mode,'OWNER');
 await denied(context(worker,requesterId,n),'AUTH_CONTEXT_CHANGED');await denied(context(anon,workerId,n));
 await denied(read(service,workerId,n,askKey));assert.equal(Number(sql('select count(*) from private.preselection_qa_commands')),before);
 for(const fn of ['public.rpc_read_preselection_qa_context(uuid,uuid)','public.rpc_read_preselection_qa_command(uuid,uuid,uuid)']){
  assert.equal(sql(`select has_function_privilege('authenticated',${q(fn)},'EXECUTE')`),'t');
  for(const role of ['anon','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(fn)},'EXECUTE')`),'f');
 }
 pass(report,'READ_ONLY_OWNED_CONTEXT_FAIL_CLOSED_RATE_NO_POLICY_SEED_AND_EXACT_GRANTS');
 const questionText='Da li postoji lift?',first='Lift postoji.',second='Lift je dostupan.',fixture={ok:true,questionId:question,status:'PENDING_ANSWER',needRevision:1,idempotentReplay:false};
 sql(`insert into private.preselection_qa_questions(id,need_id,need_revision,asker_account_id,question_text,question_fingerprint,status,answered_at)
 values(${q(question)}::uuid,${q(n)}::uuid,1,${q(workerId)}::uuid,${q(questionText)},${q('a'.repeat(64))},'ANSWERED_PUBLIC',clock_timestamp()),
 (${q(pending)}::uuid,${q(n)}::uuid,1,${q(workerId)}::uuid,'PRIVATE_PENDING_SENTINEL',${q('b'.repeat(64))},'PENDING_ANSWER',null);
 insert into private.preselection_qa_answer_versions(question_id,answer_version,answer_text,answer_fingerprint,answered_by_account_id) values
 (${q(question)}::uuid,1,${q(first)},${q('c'.repeat(64))},${q(requesterId)}::uuid),
 (${q(question)}::uuid,2,${q(second)},${q('d'.repeat(64))},${q(requesterId)}::uuid);
 insert into private.preselection_qa_commands(actor_account_id,request_id,command_type,semantic_hash,result) values
 (${q(workerId)}::uuid,${q(askKey)}::uuid,'ASK',${q('e'.repeat(64))},${q(JSON.stringify(fixture))}::jsonb),
 (${q(requesterId)}::uuid,${q(answerKey)}::uuid,'ANSWER',${q('f'.repeat(64))},${q(JSON.stringify({ok:true,questionId:question,status:'ANSWERED_PUBLIC',answerVersion:1,edited:false,idempotentReplay:false}))}::jsonb),
 (${q(requesterId)}::uuid,${q(secondKey)}::uuid,'ANSWER',${q('f'.repeat(64))},${q(JSON.stringify({ok:true,questionId:question,status:'ANSWERED_PUBLIC',answerVersion:2,edited:true,idempotentReplay:false}))}::jsonb);`);
 const a=await ok(read(worker,workerId,n,askKey));assert.equal(a.found,true);assert.equal(a.command.receipt.status,'PENDING_ANSWER');assert.equal(a.command.textSha256,hash(questionText));
 const b=await ok(read(requester,requesterId,n,answerKey));assert.equal(b.command.textSha256,hash(first));assert.equal(b.command.receipt.answerVersion,1);assert.equal(b.command.receipt.edited,false);
 assert.equal((await ok(read(requester,requesterId,n,secondKey))).command.textSha256,hash(second));
 for(const raw of [a,b]){assert.ok(!JSON.stringify(raw.command).includes(questionText));assert.ok(!JSON.stringify(raw.command).includes(first));assert.ok(!JSON.stringify(raw.command).includes(workerId));}
 assert.equal((await ok(read(requester,requesterId,n,askKey))).found,false);
 assert.equal((await ok(read(worker,workerId,other,askKey))).found,false);
 assert.equal((await ok(read(worker,workerId,n,randomUUID()))).found,false);
 await denied(read(worker,requesterId,n,askKey),'AUTH_CONTEXT_CHANGED');
 pass(report,'EXACT_ACTOR_TASK_KEY_ORIGINAL_IMMUTABLE_VERSION_RECOVERY_WITHOUT_BODY_OR_IDENTITY_LEAK');
 const pub=await ok(worker.rpc('rpc_ru4b_public_preselection_qa',{p_need_id:n}));assert.equal(pub.length,1);assert.equal(pub[0].answer_text,second);assert.equal(pub[0].edited,true);
 assert.ok(!JSON.stringify(pub).includes('PRIVATE_PENDING_SENTINEL'));assert.ok(!JSON.stringify(pub).includes(workerId));
 const own=await ok(requester.rpc('rpc_ru4b_owner_preselection_questions',{p_need_id:n}));assert.equal(own.length,2);assert.ok(!JSON.stringify(own).includes(workerId));
 const dkey=randomUUID(),d=await ok(requester.rpc('rpc_ru4b_disposition_preselection_question',{p_question_id:pending,p_action:'IGNORE',p_request_id:dkey}));assert.equal(d.status,'IGNORED');
 const recovered=await ok(read(requester,requesterId,n,dkey));assert.equal(recovered.command.receipt.status,'IGNORED');assert.equal(recovered.command.textSha256,null);
 const block=await ok(worker.rpc('rpc_get_account_block',{p_target_account_id:requesterId}));
 await ok(worker.rpc('rpc_set_account_block',{p_target_account_id:requesterId,p_blocked:true,p_expected_revision:block.revision,p_client_request_id:randomUUID()}));
 try{await denied(context(worker,workerId,n),'NEED_NOT_FOUND');assert.deepEqual(await ok(worker.rpc('rpc_ru4b_public_preselection_qa',{p_need_id:n})),[]);}
 finally{const state=await ok(worker.rpc('rpc_get_account_block',{p_target_account_id:requesterId}));await ok(worker.rpc('rpc_set_account_block',{p_target_account_id:requesterId,p_blocked:false,p_expected_revision:state.revision,p_client_request_id:randomUUID()}));}
 pass(report,'CURRENT_ANSWERED_PUBLIC_FEED_PRIVATE_PENDING_OWNER_ONLY_REAL_DISPOSITION_READBACK_BLOCK_HIDES_PUBLIC_FEED');
});
