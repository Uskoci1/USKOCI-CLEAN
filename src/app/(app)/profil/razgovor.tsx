import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { workerAiClientService as api, type WorkerAiPatch, type WorkerAiSnapshot } from '../../../data/workerAiClientService';
import type { Ishod } from '../../../data/ports';
import { uuid } from '../../../data/serverReceipt';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { workerAvailabilityPatch } from '../../../lib/workerAiAvailabilityPatch';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { ulogaSada, useUloga } from '../../../store/uloga';
import { useHoldToTalk } from '../../../features/voice/useHoldToTalk';
import { VoiceComposer } from '../../../ui/aiFirst/VoiceComposer';
import { AiConversationShell } from '../../../ui/aiFirst/AiConversationShell';
import { aiFirst as a } from '../../../ui/aiFirst/tokens';
import { WorkerProfileFrame, WorkerProfileStatus } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { WorkerAiActivation, WorkerAiCard, WorkerAiManual, WorkerAiReviewDetails } from '../../../ui/workerProfile/WorkerAiPresentation';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { T } from '../../../ui/Text';
import { V2Action } from '../../../ui/v2/V2Action';

type Panel='chat'|'review'|'manual'|'availability';
type Attempt={id:string;text:string;voice:boolean};
const unavailable=():Ishod<never>=>({ok:false,kod:'WORKER_AI_UNAVAILABLE',poruka:'Ponovo učitaj svoj radni profil.'});
export default function WorkerConversationRoute(){
  const session=useSesija(),intent=useUloga(),params=useLocalSearchParams<{conversationId?:string|string[]}>();
  const cid=typeof params.conversationId==='string'?params.conversationId:undefined;
  return <OwnedWorkerConversation key={`${session.user?.id}:${session.accountRevision}:${intent}:${cid??''}`}
    initialId={cid} invalid={params.conversationId!==undefined&&(!cid||!uuid(cid))}/>;
}
function OwnedWorkerConversation({initialId,invalid}:{initialId?:string;invalid:boolean}){
  const {user,accountRevision}=useSesija(),accountId=user?.id,intent=useUloga();
  const cid=useRef<string|null>(initialId??null),[openKey]=useState(noviUuidZahtevId);
  const focus=useRef<object|null>(null),active=useRef(!AppState.currentState||AppState.currentState==='active');
  const [foreground,setForeground]=useState(active.current),[resuming,setResuming]=useState(false);
  const abort=useRef<AbortController|null>(null),refreshRef=useRef<()=>Promise<void>>(async()=>{});
  const [panel,setPanel]=useState<Panel>('chat'),[input,setInput]=useState(''),[stream,setStream]=useState('');
  const pending=useRef<Attempt|null>(null),saveKey=useRef<{reviewId:string;key:string}|null>(null);
  useFocusEffect(useCallback(()=>{const token={};focus.current=token;return()=>{
    if(focus.current===token)focus.current=null;abort.current?.abort();abort.current=null;setStream('');
  };},[]));
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{
    active.current=state==='active';setForeground(active.current);abort.current?.abort();setStream('');
    if(active.current){setResuming(true);void refreshRef.current().finally(()=>{if(active.current)setResuming(false);});}
  });return()=>{subscription.remove();active.current=false;abort.current?.abort();};},[]);
  const owns=useCallback(()=>!!accountId&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision&&ulogaSada()===intent,
    [accountId,accountRevision,intent]);
  const read=useCallback(async():Promise<Ishod<WorkerAiSnapshot>>=>{
    const scope=focus.current;if(invalid||!scope||!owns()||!active.current)return unavailable();
    const result=cid.current?await api.read(cid.current):await api.open(openKey);
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    if(result.ok&&!cid.current){cid.current=result.podatak.conversationId;router.setParams({conversationId:cid.current});}
    return result;
  },[invalid,owns,openKey]);
  const editor=useOwnedEditor(read);refreshRef.current=editor.refresh;
  const data=editor.data,renderedFocus=focus.current;
  const [,expireReview]=useState(0);
  useEffect(()=>{
    if(!data?.review||data.saved)return;
    const delay=Date.parse(data.review.expiresAt)-Date.now();if(delay<=0)return;
    const timer=setTimeout(()=>expireReview(value=>value+1),delay+1);return()=>clearTimeout(timer);
  },[data?.review?.reviewId,data?.review?.expiresAt,data?.saved]);
  const current=()=>!!renderedFocus&&focus.current===renderedFocus&&owns()&&active.current;
  const canAct=()=>current()&&!resuming&&!editor.busy&&!editor.loading&&!editor.uncertain&&!!data;
  const turn=data?.turn,awaiting=turn?.state==='PROCESSING'||turn?.state==='UNKNOWN_OUTCOME';
  const writable=data?.status==='OPEN'&&!data.stale&&data.safety!=='BLOCK'&&data.safety!=='REVIEW';
  const voiceRequest=useRef<string|null>(null);
  useEffect(()=>{
    if(!turn||!pending.current||turn.clientRequestId!==pending.current.id)return;
    if(turn.state==='SUCCEEDED'){if(!pending.current.voice)setInput('');pending.current=null;setStream('');}
    else if(turn.state==='FAILED'){pending.current=null;setStream('');}
  },[turn]);
  const send=async(body:string,supplied?:{id:string;signal:AbortSignal;isCurrent:()=>boolean})=>{
    let outcome:'accepted'|'rejected'|'unknown'='unknown';
    if(!canAct()||!writable||awaiting||!data||!body.trim()||(supplied&&!supplied.isCurrent()))return {kind:outcome};
    await editor.save(async()=>{
      const command=pending.current??{id:supplied?.id??noviUuidZahtevId(),text:body,voice:!!supplied};pending.current=command;
      const controller=new AbortController();abort.current=controller;const stop=()=>controller.abort();supplied?.signal.addEventListener('abort',stop,{once:true});
      if(supplied?.signal.aborted)stop();setStream('');
      try{
        const sent=await api.send(data.conversationId,command.text,command.id,{signal:controller.signal,
          onText:delta=>{if(current()&&!controller.signal.aborted&&pending.current===command)setStream(value=>value+delta);}});
        if(!current())return unavailable();
        // Both success and lost transport response are reconciled through the
        // durable turn. An unknown attempt cannot start a second provider call.
        const result=await read();if(!current())return unavailable();
        if(result.ok&&result.podatak.turn?.clientRequestId===command.id){
          if(result.podatak.turn.state==='SUCCEEDED')outcome='accepted';
          else if(result.podatak.turn.state==='FAILED')outcome='rejected';
          return result;
        }
        return sent.ok?result:sent;
      }finally{supplied?.signal.removeEventListener('abort',stop);if(abort.current===controller)abort.current=null;if(current())setStream('');}
    });return {kind:outcome as 'accepted'|'rejected'|'unknown'};
  };
  const voice=useHoldToTalk({conversationId:data?.conversationId??null,submit:payload=>{
    voiceRequest.current=payload.clientRequestId;return send(payload.text,{id:payload.clientRequestId,signal:payload.signal,isCurrent:payload.isCurrent});
  }});
  useEffect(()=>{if(!turn||voiceRequest.current!==turn.clientRequestId)return;
    if(turn.state==='SUCCEEDED'||turn.state==='FAILED'){voice.controller.resolveSubmission(turn.clientRequestId,{kind:turn.state==='SUCCEEDED'?'accepted':'rejected'});voiceRequest.current=null;}
  },[turn,voice.controller]);
  const voiceBusy=voice.state.phase!=='IDLE'&&voice.state.phase!=='UNKNOWN_OUTCOME';
  const enabled=canAct()&&!voiceBusy&&!awaiting;
  const back=()=>{if(!current()||editor.busy)return;if(panel!=='chat'){setPanel('chat');return;}router.canGoBack()?router.back():router.replace('/profil/radnik');};
  const refresh=()=>{if(current()&&!editor.busy&&!voiceBusy)void editor.refresh();};
  const review=async(activate=data?.profileStatus==='DRAFT')=>{
    if(!enabled||!writable||!data)return;
    await editor.save(async()=>{
      const prepared=await api.prepare(data.conversationId,data.revision,activate);
      if(!current())return unavailable();if(!prepared.ok)return prepared;
      const next=await read();if(next.ok&&current())setPanel('review');return next;
    });
  };
  const patch=async(value:WorkerAiPatch)=>{
    if(!enabled||!writable||!data)return;
    await editor.save(async()=>{const result=await api.patch(data.conversationId,data.revision,value);
      if(current()&&result.ok){setPanel('chat');saveKey.current=null;}return current()?result:unavailable();});
  };
  const save=async()=>{
    const reviewed=data?.review;if(!enabled||!writable||!data||!reviewed||!reviewed.canAccept||reviewed.revision!==data.revision||Date.parse(reviewed.expiresAt)<=Date.now())return;
    if(saveKey.current?.reviewId!==reviewed.reviewId)saveKey.current={reviewId:reviewed.reviewId,key:noviUuidZahtevId()};
    const key=saveKey.current.key;
    await editor.save(async()=>{const saved=await api.save(reviewed,key);if(!current())return unavailable();
      const result=await read();if(result.ok&&result.podatak.saved?.reviewId===reviewed.reviewId)return result;return saved.ok?result:saved;});
  };
  const restart=()=>{
    if(!canAct()||voiceBusy||!data)return;
    Alert.alert('Pokrenuti nov razgovor?','Predlog iz ovog razgovora ostaje u istoriji. Novi razgovor kreće od sačuvanog profila.',[
      {text:'Nastavi ovaj razgovor',style:'cancel'},{text:'Novi razgovor',onPress:()=>{
        if(!canAct())return;void editor.save(async()=>{const result=await api.abandon(data.conversationId);if(!current())return unavailable();
          if(result.ok)router.replace('/profil/razgovor');return result;});
      }}]);
  };
  const statusCopy=data?.saved?'Profil je sačuvan.':data?.status!=='OPEN'?'Ovaj razgovor je završen.':data.stale?'Sačuvani profil je promenjen. Novi razgovor će početi od tih podataka.':
    data.safety==='BLOCK'||data.safety==='REVIEW'?'Ovaj predlog trenutno ne može da se sačuva.':awaiting?turn?.state==='UNKNOWN_OUTCOME'?
      'Ishod prethodne poruke nije potvrđen. Proveri stanje; ista obrada se neće ponovo pokrenuti.':'AI još obrađuje poruku. Proveri stanje.':null;
  if(!data||!foreground||resuming)return <WorkerProfileFrame back={back}><WorkerProfileStatus loading={editor.loading||!foreground||resuming}
    error={editor.error} retry={refresh}/></WorkerProfileFrame>;
  if(panel==='availability')return <WorkerProfileFrame back={back}><View style={{minHeight:650}}><AvailabilityForm
    availability={data.candidate.availability} busy={editor.busy} uncertain={editor.uncertain} candidateMode
    onSave={value=>{if(enabled)void patch(workerAvailabilityPatch(data.candidate.availability,value));}}/></View>
    {editor.error?<T accessibilityRole="alert">{editor.error}</T>:null}<V2Action label="Proveri stanje razgovora" onPress={refresh} disabled={editor.busy}/></WorkerProfileFrame>;
  if(panel==='manual')return <WorkerProfileFrame back={back}><WorkerAiManual key={data.revision} profile={data.candidate} disabled={!enabled}
    apply={value=>{void patch(value);}}/>{editor.error?<T accessibilityRole="alert">{editor.error}</T>:null}
    <V2Action label="Proveri stanje razgovora" onPress={refresh} disabled={editor.busy}/></WorkerProfileFrame>;
  if(panel==='review'&&data.review){const frozen=data.review,expired=Date.parse(frozen.expiresAt)<=Date.now()||frozen.revision!==data.revision;
    return <WorkerProfileFrame back={back} footer={data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>{if(current())router.replace('/profil/radnik');}}/>:<>
      <V2Action label={editor.busy?'Čuvamo profil…':frozen.activate?'Sačuvaj i aktiviraj profil':'Sačuvaj profil'} kind="primary"
        disabled={!enabled||!writable||!frozen.canAccept||expired} onPress={()=>{void save();}} style={{backgroundColor:a.color.green}}/>
      {(expired||editor.uncertain||editor.error)?<V2Action label="Proveri stanje" onPress={refresh} disabled={editor.busy}/>:null}
    </>}>
      {data.saved?<T accessibilityRole="alert" style={{...a.text.title,color:a.color.green}}>Profil je sačuvan{data.saved.profileStatus==='ACTIVE'?' i aktivan':''}.</T>:null}
      <WorkerAiReviewDetails review={frozen}/>
      {data.profileStatus==='DRAFT'&&!data.saved?<WorkerAiActivation activate={frozen.activate} disabled={!enabled} change={value=>{void review(value);}}/>:null}
      {expired&&!data.saved?<V2Action label="Učitaj novi pregled" disabled={!enabled} onPress={()=>{void review(frozen.activate);}}/>:null}
      {editor.error?<T accessibilityRole="alert" style={{color:a.color.danger}}>{editor.error}</T>:null}
      {!data.saved?<><V2Action label="Ručno uredi podatke" kind="quiet" disabled={!enabled} onPress={()=>setPanel('manual')}/>
        <V2Action label="Uredi nedelju i posebne datume" kind="quiet" disabled={!enabled} onPress={()=>setPanel('availability')}/>
        <V2Action label="Nastavi razgovor" kind="quiet" disabled={editor.busy} onPress={()=>setPanel('chat')}/></>:null}
    </WorkerProfileFrame>;
  }
  return <AiConversationShell title="Tvoj radni profil" subtitle="Reci šta možeš da preuzmeš"
    card={compact=><WorkerAiCard profile={data.candidate} compact={compact} disabled={!enabled||!writable} review={()=>{void review();}}/>}
    messages={data.messages.map(m=>({id:m.id,fromAi:m.role==='ASSISTANT',body:m.body}))}
    welcome="Čime se baviš?" welcomeDetail="Opiši veštine, opremu, područje i vreme kada možeš da radiš. Sve ćemo složiti u jedan pregled."
    value={input} onChange={value=>{if(enabled&&writable)setInput(value);}} canEdit={!!enabled&&!!writable&&!pending.current}
    canSend={!!enabled&&!!writable&&!!input.trim()&&!pending.current} pending={!!pending.current} busy={editor.busy} streamingText={stream}
    onSend={()=>{if(!voiceBusy)void send(input.trim());}} onBack={back} onOptions={()=>{if(enabled&&writable)setPanel('manual');}}
    status={<>{statusCopy?<T style={{...a.text.meta,color:a.color.muted}}>{statusCopy}</T>:null}
      {editor.error?<T accessibilityRole="alert" style={{...a.text.meta,color:a.color.danger}}>{editor.error}</T>:null}</>}
    voice={writable?<VoiceComposer controller={voice.controller} state={voice.state} disabled={!enabled||!!pending.current}
      onKeepText={value=>{if(canAct()&&writable&&!pending.current)setInput(old=>old?old+'\n'+value:value);}}/>:undefined}
    actions={<><V2Action label="Ručno uredi podatke" kind="quiet" disabled={!enabled||!writable} onPress={()=>setPanel('manual')}/>
      <V2Action label="Uredi nedelju i posebne datume" kind="quiet" disabled={!enabled||!writable} onPress={()=>setPanel('availability')}/>
      {(awaiting||editor.uncertain||editor.error||data.saved)?<V2Action label="Proveri stanje razgovora" disabled={editor.busy||voiceBusy} onPress={refresh}/>:null}
      {data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>{if(current())router.replace('/profil/radnik');}}/>:null}
      {(data.stale||data.status!=='OPEN'||turn?.state==='UNKNOWN_OUTCOME')?<V2Action label="Novi razgovor" kind="quiet" disabled={!canAct()} onPress={restart}/>:null}
    </>}/>;
}
