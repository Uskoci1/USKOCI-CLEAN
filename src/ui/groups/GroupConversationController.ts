import { groupConversationService, parseGroupJournal, groupBody, groupBodyHash, normalizeGroupBody,
 type GroupContext, type GroupJournal, type GroupMessage, type GroupReceipt } from '../../data/groupConversationService';
import type { ReceiptAccount } from '../../data/serverReceipt';
import { noviUuidZahtevId } from '../../lib/idempotencija';
export type GroupState={phase:'LOADING'|'READY'|'SENDING'|'UNKNOWN'|'CONFIRMED'|'ERROR';context:GroupContext|null;messages:GroupMessage[];
 before:string|null;journal:GroupJournal|null;receipt:GroupReceipt|null;canRetry:boolean;message:string|null};
export const initialGroupState:GroupState={phase:'LOADING',context:null,messages:[],before:null,journal:null,receipt:null,canRetry:false,message:null};
export class GroupConversationController{
 private state:GroupState={...initialGroupState};private busy=false;private disposed=false;private journalLoaded=false;private inMemoryBody:string|null=null;private listeners=new Set<()=>void>();
 readonly key:string;
 constructor(private deps:{agreementId:string;account:ReceiptAccount;current:()=>boolean;storage:{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<unknown>;removeItem(k:string):Promise<unknown>};
 service?:typeof groupConversationService;uuid?:()=>string}){this.key=`uskoci:group-message:v5:${deps.account.accountId}:${deps.agreementId}`;}
 private get service(){return this.deps.service??groupConversationService;}
 private current=()=>!this.disposed&&this.deps.current();snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 dispose=()=>{this.disposed=true;this.inMemoryBody=null;this.state={...initialGroupState};this.listeners.clear();};
 private update(patch:Partial<GroupState>){if(!this.current())return;this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 private async run(fn:()=>Promise<void>){if(this.busy||!this.current())return;this.busy=true;try{await fn();}
 catch{this.update({phase:this.state.journal?'UNKNOWN':'ERROR',canRetry:false,message:'Provera nije završena. Osveži sačuvano stanje.'});}finally{this.busy=false;}}
 load=()=>this.run(async()=>{
  this.journalLoaded=false;this.update({...initialGroupState});const raw=await this.deps.storage.getItem(this.key);if(!this.current())return;
  const journal=raw===null?null:parseGroupJournal(raw);this.journalLoaded=true;this.update({journal});
  if(!await this.context())return;
  if(journal){if(journal.groupId!==this.state.context?.group?.groupId){this.update({phase:'ERROR',message:'Sačuvani zahtev ne pripada ovom razgovoru.'});return;}await this.recover();}
  else await this.page();
 });
 private async context(){const result=await this.service.context(this.deps.agreementId,this.deps.account);if(!this.current())return false;
  if(!result.ok){this.update({phase:this.state.journal?'UNKNOWN':'ERROR',context:null,messages:[],before:null,canRetry:false,message:result.poruka});return false;}
  if(this.state.journal&&this.state.journal.groupId!==result.podatak.group?.groupId){
   this.update({phase:'ERROR',context:null,messages:[],before:null,canRetry:false,message:'Sačuvani zahtev ne pripada ovom razgovoru.'});return false;
  }
  this.update({context:result.podatak,...(!result.podatak.group?{messages:[],before:null}:{})});return true;
 }
 private async page(before?:string){const group=this.state.context?.group;if(!group){this.update({phase:'READY'});return;}
  const result=await this.service.messages(group.groupId,this.deps.account,before?{before}:{});if(!this.current())return;
  if(!result.ok){this.update({phase:'ERROR',messages:[],before:null,message:result.poruka});return;}
  const merged=before?[...result.podatak.messages,...this.state.messages]:result.podatak.messages;
  // De-duplicate a boundary without inventing messages from the command receipt.
  const ids=new Set<string>(),messages=merged.filter(m=>!ids.has(m.messageId)&&!!ids.add(m.messageId));
  this.update({phase:'READY',messages,before:result.podatak.nextBeforeSequence,message:null});
 }
 refresh=()=>!this.journalLoaded?this.load():this.run(async()=>{
  this.update({phase:'LOADING',canRetry:false,message:null});if(!await this.context())return;
  if(this.state.journal)await this.recover();else await this.page();
 });
 older=()=>this.run(async()=>{if(this.state.phase==='READY'&&this.state.before){const before=this.state.before;this.update({phase:'LOADING'});await this.page(before);}});
 managementNext=()=>this.run(async()=>{const g=this.state.context?.group;if(this.state.phase!=='READY'||g?.role!=='REQUESTER'||!g.managementNextId)return;
  const result=await this.service.context(this.deps.agreementId,this.deps.account,g.managementNextId);if(!this.current())return;
  if(!result.ok){this.update({message:result.poruka});return;}const next=result.podatak.group;
  if(!next||next.groupId!==g.groupId||next.role!=='REQUESTER'){this.update({phase:'ERROR',context:null,message:'Upravljanje nije dostupno.'});return;}
  this.update({context:{...result.podatak,group:{...next,management:[...(g.management??[]),...(next.management??[])]}}});
 });
 private async recover(){const j=this.state.journal;if(!j)return;this.update({canRetry:false});
  const result=await this.service.recover(j,this.deps.account);if(!this.current())return;
  if(!result.ok){this.update({phase:'UNKNOWN',canRetry:false,message:result.poruka});return;}
  if(result.podatak.found){this.confirm(result.podatak.receipt!);return;}
  this.update({phase:'UNKNOWN',canRetry:!!this.state.context?.group?.canSend,message:'Potvrda prvobitne poruke nije pronađena. Za ponovni pokušaj unesi istu poruku.'});
 }
 private confirm(receipt:GroupReceipt){this.inMemoryBody=null;this.update({phase:'CONFIRMED',receipt,canRetry:false,message:'Poruka je sačuvana u ovom grupnom razgovoru.'});}
 send=(input:string)=>this.run(async()=>{
  const body=normalizeGroupBody(input),g=this.state.context?.group;if(this.state.phase!=='READY'||this.state.journal||!g?.canSend||!groupBody(body))return;
  const journal:GroupJournal={version:1,groupId:g.groupId,clientRequestId:(this.deps.uuid??noviUuidZahtevId)(),bodySha256:groupBodyHash(body)};
  this.update({phase:'SENDING',message:null,canRetry:false});
  // Persist four opaque identity/hash fields before dispatch. No group text is
  // written locally. A restart may recover a receipt or require exact re-entry.
  await this.deps.storage.setItem(this.key,JSON.stringify(journal));if(!this.current())return;
  this.inMemoryBody=body;this.update({journal});await this.write(body);
 });
 private async write(body:string){const j=this.state.journal;if(!j)return;
  this.update({phase:'SENDING',canRetry:false,message:null});const result=await this.service.send(j,body,this.deps.account);if(!this.current())return;
  if(result.ok)this.confirm(result.podatak);else this.update({phase:'UNKNOWN',canRetry:false,message:result.poruka});
 }
 retry=(reentry?:string)=>this.run(async()=>{
  const j=this.state.journal,body=reentry===undefined?this.inMemoryBody:normalizeGroupBody(reentry);
  if(this.state.phase!=='UNKNOWN'||!this.state.canRetry||!j||!this.state.context?.group?.canSend)return;
  if(!groupBody(body)||groupBodyHash(body)!==j.bodySha256){this.update({message:'Tekst se razlikuje od prvobitne poruke. Unesi prvobitnu poruku bez izmene.'});return;}
  await this.write(body);
 });
 acknowledge=()=>this.run(async()=>{if(this.state.phase!=='CONFIRMED')return;await this.deps.storage.removeItem(this.key);if(!this.current())return;
  this.update({journal:null,receipt:null,phase:'LOADING',message:null});if(await this.context())await this.page();
 });
 markVisible=(ids:string[])=>this.run(async()=>{
  const g=this.state.context?.group;if(this.state.phase!=='READY'||!g||!ids.length)return;
  const allowed=new Set(this.state.messages.map(m=>m.messageId)),unique=[...new Set(ids)].filter(id=>allowed.has(id)).slice(0,50);if(!unique.length)return;
  // The native list supplies only presently viewable rows. No page-wide mark
  // for off-screen content, no new visibility grants and no optimistic count.
  const result=await this.service.markRead(g.groupId,unique,this.deps.account);if(!this.current())return;
  if(result.ok)await this.context();
 });
}
