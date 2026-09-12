import type { WorkerLocation } from '../contracts/location';
import type { WorkerAvailabilityInput, AvailabilityRule, AvailabilityWindow } from '../contracts/workerAvailability';
import type { Ishod } from './ports';
import { capabilityTerms } from '../lib/capabilityTerms';
import { countryCode } from '../lib/market';
import { normalizeWorkerAvailability } from '../lib/workerAvailability';
import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import { requestAiTurnStream, type AiTurnStreamOptions } from './aiNeedTurnStream';

export type WorkerAiProfile = Readonly<{
  displayName: string; bio: string; skills: string[]; tools: string[]; vehicles: string[]; licenses: string[];
  teamCapacity: number; location: Omit<WorkerLocation,'profileId'|'accountId'|'revision'>; availability: WorkerAvailabilityInput;
}>;
export type WorkerAiPatch = Partial<Pick<WorkerAiProfile,'displayName'|'bio'|'skills'|'tools'|'vehicles'|'licenses'|'teamCapacity'>> & {
  location?: Partial<WorkerAiProfile['location']>;
  availability?: Partial<Pick<WorkerAvailabilityInput,'timezone'|'availableNow'>> & {
    ruleChanges?: { ruleId: string | null; weekdays: number[]; value: Omit<AvailabilityRule,'id'|'weekdays'> | null }[];
    windowsUpsert?: (Omit<AvailabilityWindow,'id'> & { id: string | null })[]; windowIdsRemove?: string[];
  };
};
export type WorkerAiTurn = Readonly<{ turnId: string; conversationId: string; clientRequestId: string; attemptId: string;
  state: 'PROCESSING'|'SUCCEEDED'|'FAILED'|'UNKNOWN_OUTCOME'; retryAllowed: false; authoritative: true }>;
export type WorkerAiReview = Readonly<{ schemaVersion:'WORKER_PROFILE_V1'; reviewId:string; conversationId:string; accountId:string;
  profileId:string; revision:number; profile:WorkerAiProfile; activate:boolean; missingRequired:string[]; canAccept:boolean;
  expiresAt:string; displayedContentDigest:string }>;
export type WorkerAiSaved = Readonly<{ reviewId:string; conversationId:string; accountId:string; profileId:string;
  profileStatus:'DRAFT'|'ACTIVE'; saved:true; authoritative:true }>;
export type WorkerAiSnapshot = Readonly<{ schemaVersion:'WORKER_PROFILE_V1'; conversationId:string; accountId:string; profileId:string;
  status:'OPEN'|'COMPLETED'|'ABANDONED'; profileStatus:'DRAFT'|'ACTIVE'; revision:number; candidate:WorkerAiProfile;
  safety:'ALLOW'|'CLARIFY'|'REVIEW'|'BLOCK'; stale:boolean;
  messages:{ id:string; role:'USER'|'ASSISTANT'; body:string; sequence:number }[];
  turn:WorkerAiTurn|null; review:WorkerAiReview|null; saved:WorkerAiSaved|null }>;
const exact=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const revision=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=2_147_483_647;
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function decodeWorkerAiProfile(raw:unknown):WorkerAiProfile|null {
  const v=record(raw),loc=record(v?.location);
  if(!v||!exact(v,['displayName','bio','skills','tools','vehicles','licenses','teamCapacity','location','availability'])
    ||!text(v.displayName,160)||!text(v.bio,4000)||!revision(v.teamCapacity)||v.teamCapacity<1||v.teamCapacity>50
    ||!loc||!exact(loc,['operatingCountryCode','city','radiusKm','approximatePosition'])||!text(loc.city,160)
    ||!revision(loc.radiusKm)||loc.radiusKm<1||loc.radiusKm>200) return null;
  const country=loc.operatingCountryCode===null?null:countryCode(loc.operatingCountryCode);
  if(loc.operatingCountryCode!==null&&!country)return null;
  let approximatePosition:WorkerAiProfile['location']['approximatePosition']=null;
  if(loc.approximatePosition!==null) {
    const point=record(loc.approximatePosition);
    if(!point||!exact(point,['latitude','longitude'])||typeof point.latitude!=='number'||!Number.isFinite(point.latitude)
      ||typeof point.longitude!=='number'||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180
      ||Math.abs(Math.round(point.latitude*100)/100-point.latitude)>1e-10||Math.abs(Math.round(point.longitude*100)/100-point.longitude)>1e-10)return null;
    approximatePosition={latitude:point.latitude,longitude:point.longitude};
  }
  const skills=capabilityTerms(v.skills),tools=capabilityTerms(v.tools),vehicles=capabilityTerms(v.vehicles),licenses=capabilityTerms(v.licenses);
  const availability=normalizeWorkerAvailability(v.availability);
  if(!skills||!tools||!vehicles||!licenses||!availability)return null;
  return {displayName:v.displayName,bio:v.bio,skills,tools,vehicles,licenses,teamCapacity:v.teamCapacity,
    location:{operatingCountryCode:country,city:loc.city,radiusKm:loc.radiusKm,approximatePosition},availability};
}
export function decodeWorkerAiTurn(raw:unknown,cid:string,key?:string):WorkerAiTurn|null {
  const v=record(raw);
  if(!v||!exact(v,['turnId','conversationId','clientRequestId','attemptId','state','retryAllowed','authoritative'])
    ||!uuid(v.turnId)||!sameId(v.conversationId,cid)||!uuid(v.clientRequestId)||(key&&!sameId(v.clientRequestId,key))||!uuid(v.attemptId)
    ||(v.state!=='PROCESSING'&&v.state!=='SUCCEEDED'&&v.state!=='FAILED'&&v.state!=='UNKNOWN_OUTCOME')||v.retryAllowed!==false||v.authoritative!==true)return null;
  return {turnId:v.turnId,conversationId:v.conversationId,clientRequestId:v.clientRequestId,attemptId:v.attemptId,state:v.state,retryAllowed:false,authoritative:true};
}
export function decodeWorkerAiReview(raw:unknown,account:string,cid:string):WorkerAiReview|null {
  const v=record(raw),profile=decodeWorkerAiProfile(v?.profile);
  if(!v||!exact(v,['schemaVersion','reviewId','conversationId','accountId','profileId','revision','profile','activate','missingRequired','canAccept','expiresAt','displayedContentDigest'])
    ||v.schemaVersion!=='WORKER_PROFILE_V1'||!uuid(v.reviewId)||!sameId(v.conversationId,cid)||!sameId(v.accountId,account)||!uuid(v.profileId)
    ||!revision(v.revision)||!profile||typeof v.activate!=='boolean'||typeof v.canAccept!=='boolean'||!Array.isArray(v.missingRequired)
    ||v.missingRequired.length>4||v.missingRequired.some(x=>!['Ime','Mesto rada','Veštine','Država i mesto rada'].includes(x))
    ||v.canAccept!==(v.missingRequired.length===0)||!text(v.expiresAt,40)||calendarInstant(v.expiresAt)===null||!digest(v.displayedContentDigest))return null;
  return {schemaVersion:'WORKER_PROFILE_V1',reviewId:v.reviewId,conversationId:v.conversationId,accountId:v.accountId,profileId:v.profileId,
    revision:v.revision,profile,activate:v.activate,missingRequired:[...v.missingRequired],canAccept:v.canAccept,expiresAt:v.expiresAt,displayedContentDigest:v.displayedContentDigest};
}
export function decodeWorkerAiSaved(raw:unknown,review:WorkerAiReview):WorkerAiSaved|null {
  const v=record(raw);
  if(!v||!exact(v,['reviewId','conversationId','accountId','profileId','profileStatus','saved','authoritative'])
    ||!sameId(v.reviewId,review.reviewId)||!sameId(v.conversationId,review.conversationId)||!sameId(v.accountId,review.accountId)||!sameId(v.profileId,review.profileId)
    ||(v.profileStatus!=='DRAFT'&&v.profileStatus!=='ACTIVE')||(review.activate&&v.profileStatus!=='ACTIVE')||v.saved!==true||v.authoritative!==true)return null;
  return {reviewId:v.reviewId,conversationId:v.conversationId,accountId:v.accountId,profileId:v.profileId,profileStatus:v.profileStatus,saved:true,authoritative:true};
}
export function decodeWorkerAiSnapshot(raw:unknown,account:string,cid?:string):WorkerAiSnapshot|null {
  const v=record(raw),candidate=decodeWorkerAiProfile(v?.candidate);
  if(!v||!exact(v,['schemaVersion','conversationId','accountId','profileId','status','profileStatus','revision','candidate','safety','stale','messages','turn','review','saved'])
    ||v.schemaVersion!=='WORKER_PROFILE_V1'||!uuid(v.conversationId)||(cid&&!sameId(v.conversationId,cid))||!sameId(v.accountId,account)||!uuid(v.profileId)
    ||!revision(v.revision)||!candidate||typeof v.stale!=='boolean'||(v.status!=='OPEN'&&v.status!=='COMPLETED'&&v.status!=='ABANDONED')
    ||(v.profileStatus!=='DRAFT'&&v.profileStatus!=='ACTIVE')||(v.safety!=='ALLOW'&&v.safety!=='CLARIFY'&&v.safety!=='REVIEW'&&v.safety!=='BLOCK')
    ||!Array.isArray(v.messages)||v.messages.length>100)return null;
  const messages:WorkerAiSnapshot['messages']=[];const ids=new Set<string>();let seq=0;
  for(const rawMessage of v.messages){const m=record(rawMessage);
    if(!m||!exact(m,['id','role','body','sequence'])||!uuid(m.id)||ids.has(m.id)||(m.role!=='USER'&&m.role!=='ASSISTANT')||!text(m.body,4000)||!m.body.trim()
      ||!revision(m.sequence)||m.sequence<=seq)return null;
    ids.add(m.id);seq=m.sequence;messages.push({id:m.id,role:m.role,body:m.body,sequence:m.sequence});
  }
  const turn=v.turn===null?null:decodeWorkerAiTurn(v.turn,v.conversationId);
  const review=v.review===null?null:decodeWorkerAiReview(v.review,account,v.conversationId);
  const saved=v.saved===null?null:review?decodeWorkerAiSaved(v.saved,review):null;
  if((v.turn!==null&&!turn)||(v.review!==null&&!review)||(v.saved!==null&&!saved)|| (review&&!sameId(review.profileId,v.profileId))
    ||(saved&&v.status!=='COMPLETED'))return null;
  return {schemaVersion:'WORKER_PROFILE_V1',conversationId:v.conversationId,accountId:v.accountId,profileId:v.profileId,status:v.status,
    profileStatus:v.profileStatus,revision:v.revision,candidate,safety:v.safety,stale:v.stale,messages,turn,review,saved};
}
const ERRORS:Readonly<Record<string,string>>={
  AUTH_REQUIRED:'Prijavite se da biste uredili radni profil.',WORKER_AI_DENIED:'Ponovo otvorite svoj radni profil.',
  WORKER_AI_STALE:'Profil je promenjen. Sačuvani podaci ostaju; pokrenite nov razgovor iz aktuelnog profila.',
  WORKER_AI_NOT_EDITABLE:'Ovaj razgovor se ne može menjati. Otvorite sačuvani profil.',
  WORKER_PROFILE_RESTRICTED:'Profil trenutno ne može da se menja.',WORKER_AI_TURN_PENDING:'Prethodna poruka još nema potvrđen ishod. Proverite stanje.',
  WORKER_AI_PATCH_INVALID:'Proverite unos profila, radnog područja i dostupnosti.',WORKER_AI_REQUEST_CONFLICT:'Ovaj zahtev je već vezan za drugi unos. Proverite sačuvano stanje.',
  WORKER_AI_RATE_LIMITED:'Poslali ste više poruka. Sačekajte kratko i proverite razgovor.',
};
const scope=():ReceiptAccount|undefined=>{const s=sesijaSada();return s.user?{accountId:s.user.id,accountRevision:s.accountRevision}:undefined;};
function call<T>(name:string,args:Record<string,unknown>,decode:(v:unknown,aid:string)=>T|null,write=false):Promise<Ishod<T>>{
  const account=scope(); if(!account)return Promise.resolve(failure('AUTH_REQUIRED',ERRORS.AUTH_REQUIRED));
  return readOwnedResult({account,errors:ERRORS,write,fallback:'WORKER_AI_UNCONFIRMED',invalid:'WORKER_AI_INVALID_RESPONSE',
    request:()=>supabaseKlijent().rpc(name,args),decode:v=>decode(v,account.accountId)});
}
export const workerAiClientService={
  open:(clientRequestId:string)=>!uuid(clientRequestId)?Promise.resolve(failure('WORKER_AI_ID_REQUIRED','Ponovo otvorite radni profil.')):
    call('rpc_open_worker_ai',{p_client_request_id:clientRequestId},decodeWorkerAiSnapshot,true),
  read:(conversationId:string)=>!uuid(conversationId)?Promise.resolve(failure('WORKER_AI_ID_REQUIRED','Ponovo otvorite razgovor.')):
    call('rpc_read_worker_ai',{p_conversation_id:conversationId},(v,a)=>decodeWorkerAiSnapshot(v,a,conversationId)),
  patch:(conversationId:string,expectedRevision:number,patch:WorkerAiPatch)=>call('rpc_patch_worker_ai',
    {p_conversation_id:conversationId,p_expected_revision:expectedRevision,p_patch:JSON.parse(JSON.stringify(patch))},(v,a)=>decodeWorkerAiSnapshot(v,a,conversationId),true),
  prepare:(conversationId:string,expectedRevision:number,activate:boolean)=>call('rpc_prepare_worker_ai_review',
    {p_conversation_id:conversationId,p_expected_revision:expectedRevision,p_activate:activate},(v,a)=>decodeWorkerAiReview(v,a,conversationId),true),
  save:(review:WorkerAiReview,clientRequestId:string)=>{
    const owner=scope(),frozen=owner?decodeWorkerAiReview(review,owner.accountId,review.conversationId):null;
    if(!frozen||!uuid(clientRequestId)||!frozen.canAccept)return Promise.resolve(failure('WORKER_AI_REVIEW_REQUIRED','Otvorite potpun pregled profila.'));
    return call('rpc_save_worker_ai_review',{p_review_id:frozen.reviewId,p_displayed_digest:frozen.displayedContentDigest,p_client_request_id:clientRequestId},
      (v,a)=>a===frozen.accountId?decodeWorkerAiSaved(v,frozen):null,true);
  },
  abandon:(conversationId:string)=>call('rpc_abandon_worker_ai',{p_conversation_id:conversationId},(v,a)=>decodeWorkerAiSnapshot(v,a,conversationId),true),
  async send(conversationId:string,body:string,clientRequestId:string,stream:AiTurnStreamOptions):Promise<Ishod<WorkerAiTurn>>{
    const account=scope(),session=sesijaSada().session,url=process.env.EXPO_PUBLIC_SUPABASE_URL,anonKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if(!account||!session?.access_token||!url||!anonKey)return failure('AUTH_REQUIRED',ERRORS.AUTH_REQUIRED);
    if(!uuid(conversationId)||!uuid(clientRequestId)||!text(body,4000)||!body.trim())return failure('WORKER_AI_INPUT_INVALID','Unesite poruku do 4000 znakova.');
    return readOwnedResult({account,errors:ERRORS,write:true,fallback:'WORKER_AI_UNCONFIRMED',invalid:'WORKER_AI_INVALID_RESPONSE',
      request:()=>requestAiTurnStream({...stream,endpoint:'uskoci-worker-interview',url,anonKey,accessToken:session.access_token,
        conversationId,clientRequestId,text:body,deadline:Date.now()+15000,
        current:()=>sesijaSada().user?.id===account.accountId&&sesijaSada().accountRevision===account.accountRevision}),
      decode:v=>decodeWorkerAiTurn(v,conversationId,clientRequestId)});
  },
};
