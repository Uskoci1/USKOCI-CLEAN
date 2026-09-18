import type { ReceiptAccount } from '../../data/serverReceipt';
import { agreementCurrentLocationService, parseLocationJournal, type AgreementLocationContext, type LocationJournal } from '../../data/agreementCurrentLocationService';
import { captureCurrentLocation } from '../../data/nativeCurrentLocation';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { agreementPayloadHash } from './agreementActionsModel';
export type LocationState={phase:'LOADING'|'READY'|'CAPTURING'|'SENDING'|'UNKNOWN'|'CONFIRMED'|'ERROR';
  context:AgreementLocationContext|null;journal:LocationJournal|null;message:string|null};
export const initialLocationState:LocationState={phase:'LOADING',context:null,journal:null,message:null};
export class AgreementLocationController {
  private state:LocationState={...initialLocationState};private busy=false;private disposed=false;
  private capture:AbortController|null=null;private listeners=new Set<()=>void>();readonly key:string;
  constructor(private deps:{agreementId:string;account:ReceiptAccount;current:()=>boolean;
    storage:{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<unknown>;removeItem(k:string):Promise<unknown>};
    service?:typeof agreementCurrentLocationService;capture?:typeof captureCurrentLocation;uuid?:()=>string}){
    this.key=`uskoci:agreement-location:v5:${deps.account.accountId}:${deps.agreementId}`;
  }
  private get service(){return this.deps.service??agreementCurrentLocationService;}
  private current=()=>!this.disposed&&this.deps.current();
  snapshot=()=>this.state;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  dispose=()=>{this.disposed=true;this.capture?.abort();this.capture=null;this.state={...initialLocationState};this.listeners.clear();};
  stopCapture=()=>{if(this.state.phase==='CAPTURING')this.capture?.abort();};
  private update(p:Partial<LocationState>){if(!this.current())return;this.state={...this.state,...p};this.listeners.forEach(fn=>fn());}
  private async run(fn:()=>Promise<void>){if(this.busy||!this.current())return;this.busy=true;
    try{await fn();}catch{this.update({phase:this.state.journal?'UNKNOWN':'ERROR',message:'Ishod nije potvrđen. Proveri sačuvano stanje.'});}
    finally{this.busy=false;}}
  load=()=>this.run(async()=>{
    this.update({phase:'LOADING',context:null,message:null});
    const raw=await this.deps.storage.getItem(this.key);if(!this.current())return;
    const journal=raw===null?null:parseLocationJournal(raw,this.deps.agreementId);this.update({journal});
    if(journal){await this.recover();return;}
    await this.readContext();
  });
  private async readContext(){
    const result=await this.service.read(this.deps.agreementId,this.deps.account);if(!this.current())return;
    this.update({phase:result.ok?'READY':'ERROR',context:result.ok?result.podatak:null,message:result.ok?null:result.poruka});
  }
  private async recover(){
    const j=this.state.journal;if(!j)return;this.update({phase:'LOADING',message:null});
    const result=await this.service.recover(j,this.deps.account);if(!this.current())return;
    if(!result.ok||!result.podatak.found){this.update({phase:'UNKNOWN',message:'Potvrda još nije pronađena. Proveri ponovo ili zaustavi prvobitni zahtev.'});return;}
    this.confirm(result.podatak.command!.state);
  }
  private confirm(state:'COMMITTED'|'CANCELLED'){
    this.update({phase:'CONFIRMED',message:state==='CANCELLED'?'Prvobitni zahtev je zaustavljen.'
      :this.state.journal?.kind==='SHARE'?'Jedna lokacija je podeljena u ovom Dogovoru.':'Molba za lokaciju je poslata. Uskočer sam bira da li želi da je podeli.'});
  }
  refresh=()=>this.state.phase==='ERROR'?this.load():this.run(async()=>{if(this.state.journal)await this.recover();else{this.update({phase:'LOADING',context:null});await this.readContext();}});
  acknowledge=()=>this.run(async()=>{if(this.state.phase!=='CONFIRMED')return;
    await this.deps.storage.removeItem(this.key);if(!this.current())return;this.update({journal:null,phase:'LOADING',context:null,message:null});await this.readContext();});
  cancelUnknown=()=>this.run(async()=>{
    const j=this.state.journal;if(this.state.phase!=='UNKNOWN'||!j)return;this.update({phase:'SENDING',message:null});
    const result=await this.service.write(j,null,this.deps.account,true);if(!this.current())return;
    if(result.ok)this.confirm(result.podatak.state);else this.update({phase:'UNKNOWN',message:result.poruka});
  });
  send=(kind:'REQUEST'|'SHARE')=>this.run(async()=>{
    const context=this.state.context;if(this.state.phase!=='READY'||this.state.journal||!context
      || !(kind==='SHARE'?context.canShare:context.canRequest))return;
    let point=null;
    if(kind==='SHARE'){
      const capture=new AbortController();this.capture=capture;this.update({phase:'CAPTURING',message:null});
      const result=await (this.deps.capture??captureCurrentLocation)(capture.signal,this.current);this.capture=null;
      if(!this.current())return;
      if(capture.signal.aborted){this.update({phase:'READY',message:'Deljenje je prekinuto.'});return;}
      if(result.kind!=='POINT'){this.update({phase:'READY',message:result.kind==='DENIED'?'Lokacija nije podeljena. Dozvolu možeš promeniti u podešavanjima telefona.'
        :result.kind==='CANCELLED'?'Deljenje je prekinuto.':result.kind==='UNSUPPORTED'?'Deljenje trenutne lokacije dostupno je u mobilnoj aplikaciji.':'Nova lokacija nije dobijena. Pokušaj ponovo.'});return;}
      point=result.point;
    }
    if(!this.current())return;
    const clientRequestId=(this.deps.uuid??noviUuidZahtevId)();
    const j:LocationJournal={version:1,agreementId:this.deps.agreementId,agreementVersion:context.agreementVersion,clientRequestId,kind,
      inputSha256:agreementPayloadHash(JSON.stringify({agreementId:this.deps.agreementId,agreementVersion:context.agreementVersion,clientRequestId,kind,point}))};
    this.update({phase:'SENDING',message:null});
    // Only these opaque fields go to disk, before the first network write.
    await this.deps.storage.setItem(this.key,JSON.stringify(j));if(!this.current())return;this.update({journal:j});
    const result=await this.service.write(j,point,this.deps.account);point=null;if(!this.current())return;
    if(result.ok)this.confirm(result.podatak.state);else this.update({phase:'UNKNOWN',message:result.poruka});
  });
}
