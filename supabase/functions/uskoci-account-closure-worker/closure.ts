/** Generation-bound account closure. External responses are evidence, never authorizers. */
import { only, row, uuid, hash, instant, objectAbsent, parseJSON, type Row } from '../_shared/data-export.ts';
export type ClosureAction = {
 accountId:string;requestId:string;generation:string;actionId:string;attemptId:string;
 kind:'STORAGE_DELETE'|'AUTH_IDENTITY_ERASE';state:'PENDING'|'DISPATCHED'|'VERIFIED';
 bucket:'profile-media'|'data-export-artifacts'|null;objectPath:string|null;policySha256:string;
};
export type ClosureTransport = {
 signal:AbortSignal;
 rpc(name:string,args:Row,service?:boolean,limit?:number):Promise<unknown>;
 request(path:string,init:RequestInit,service?:boolean):Promise<Response>;
};
export class ClosureRejected extends Error { constructor(readonly code:string){super(code);} }
const failure=()=>new ClosureRejected('CLOSURE_RESPONSE_INVALID');
function assertLive(signal:AbortSignal){if(signal.aborted)throw new ClosureRejected('CLOSURE_OUTCOME_UNKNOWN');}
export function decodeAction(value:unknown,accountId:string,generation:string):ClosureAction {
 const a=row(value);
 if(!a||!only(a,['accountId','requestId','generation','actionId','attemptId','kind','state','bucket','objectPath','policySha256'])
  ||a.accountId!==accountId||a.generation!==generation||!uuid(a.accountId)||!uuid(a.requestId)||!uuid(a.generation)||!uuid(a.actionId)||!uuid(a.attemptId)||!hash(a.policySha256)
  ||!['PENDING','DISPATCHED','VERIFIED'].includes(String(a.state)))throw failure();
 if(a.kind==='STORAGE_DELETE'){
  if(!['profile-media','data-export-artifacts'].includes(String(a.bucket))||typeof a.objectPath!=='string'||a.objectPath.length>1024
   ||!a.objectPath.startsWith(accountId+'/')||!a.objectPath.split('/').every(part=>/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part)&&part!=='.'&&part!=='..'))throw failure();
  if(a.bucket==='data-export-artifacts'&&!new RegExp('^'+accountId+'/[a-f0-9-]{36}/[a-f0-9-]{36}\\.json$').test(a.objectPath))throw failure();
 }else if(a.kind!=='AUTH_IDENTITY_ERASE'||a.bucket!==null||a.objectPath!==null)throw failure();
 return a as ClosureAction;
}
function keys(a:ClosureAction){return {p_account_id:a.accountId,p_generation:a.generation,p_action_id:a.actionId,p_attempt_id:a.attemptId};}
function same(a:ClosureAction,b:ClosureAction){return Object.keys(a).every(k=>k==='state'||a[k as keyof ClosureAction]===b[k as keyof ClosureAction]);}
export function decodeClosed(value:unknown,accountId:string,generation:string){
 const r=row(value);
 if(!r||!only(r,['accountId','requestId','generation','state','closedAt','policySha256','authOutcome','mediaOutcome','relationalOutcome','retainedDatasets','authoritative'])
  ||r.accountId!==accountId||r.generation!==generation||!uuid(r.requestId)||r.state!=='CLOSED'||!instant(r.closedAt)||!hash(r.policySha256)
  ||r.authOutcome!=='AUTH_IDENTITY_ERASED_SUBJECT_RETAINED'||r.mediaOutcome!=='OWNED_OBJECTS_DELETED'||r.relationalOutcome!=='RETAINED_RESTRICTED'
  ||!Array.isArray(r.retainedDatasets)||r.retainedDatasets.length!==15||r.authoritative!==true)throw failure();
 return r;
}
async function verify(a:ClosureAction,t:ClosureTransport){
 assertLive(t.signal);
 if(a.kind==='STORAGE_DELETE'){
  const response=await t.request(`/storage/v1/object/${a.bucket}/${a.objectPath}`,{method:'GET'},true);
  assertLive(t.signal);const absent=await objectAbsent(response,t.signal);assertLive(t.signal);return absent;
 }
 const response=await t.request(`/auth/v1/admin/users/${a.accountId}`,{method:'GET'},true);assertLive(t.signal);
 if(!response.ok){void response.body?.cancel().catch(()=>undefined);return false;}
 const r=row(await parseJSON(response.body,65536,t.signal));assertLive(t.signal);
 // Hard absence is not the policy-approved subject-retaining erasure outcome.
 return r?.id===a.accountId&&instant(r.deleted_at)&&row(r.user_metadata)!==null&&Object.keys(row(r.user_metadata)!).length===0
  &&row(r.app_metadata)!==null&&Object.keys(row(r.app_metadata)!).length===0;
}
export async function executeClosureStep(t:ClosureTransport,accountId:string,generation:string):Promise<Row>{
 if(!uuid(accountId)||!uuid(generation))throw new ClosureRejected('CLOSURE_INPUT_INVALID');assertLive(t.signal);
 const claim=await t.rpc('rpc_claim_account_closure_action_service',{p_account_id:accountId,p_generation:generation},true);assertLive(t.signal);
 const c=row(claim);
 if(c?.kind==='CLOSED'&&only(c,['kind','receipt']))return decodeClosed(c.receipt,accountId,generation);
 if(c?.kind==='FINALIZE'&&only(c,['kind','accountId','generation'])&&c.accountId===accountId&&c.generation===generation){
  const closed=await t.rpc('rpc_finalize_account_closure_service',{p_account_id:accountId,p_generation:generation},true);assertLive(t.signal);return decodeClosed(closed,accountId,generation);
 }
 let a=decodeAction(claim,accountId,generation);
 if(a.state==='PENDING'){
  const admission=row(await t.rpc('rpc_dispatch_account_closure_action_service',keys(a),true));assertLive(t.signal);
  if(!admission||!only(admission,['admitted','action'])||typeof admission.admitted!=='boolean')throw failure();
  const dispatched=decodeAction(admission.action,accountId,generation);
  if(!same(a,dispatched)||(admission.admitted&&dispatched.state!=='DISPATCHED'))throw failure();a=dispatched;
  if(admission.admitted){
   assertLive(t.signal);
   const response=a.kind==='STORAGE_DELETE'
    ?await t.request(`/storage/v1/object/${a.bucket}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[a.objectPath]})},true)
    :await t.request(`/auth/v1/admin/users/${a.accountId}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({should_soft_delete:true})},true);
   assertLive(t.signal);void response.body?.cancel().catch(()=>undefined);
   // An HTTP success is insufficient, and an error can hide a committed action.
   // Reconcile by a separate exact read; never retry the destructive request.
  }
 }
 if(a.state==='PENDING')throw failure();
 if(!await verify(a,t))return {accountId,generation,kind:'PENDING',code:'CLOSURE_OUTCOME_UNKNOWN'};
 assertLive(t.signal);
 const evidence=a.kind==='STORAGE_DELETE'?'STORAGE_OBJECT_ABSENT':'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED';
 const complete=row(await t.rpc('rpc_complete_account_closure_action_service',{...keys(a),p_evidence:evidence},true));assertLive(t.signal);
 if(!complete||complete.evidence!==evidence)throw failure();
 const {evidence:_e,...rest}=complete;const settled=decodeAction(rest,accountId,generation);
 if(!same(a,settled)||settled.state!=='VERIFIED')throw failure();
 return {accountId,generation,kind:'STEP_VERIFIED',actionId:a.actionId};
}