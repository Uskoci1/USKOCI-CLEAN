import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { workerAiClientService as api, type WorkerAiPatch, type WorkerAiSnapshot, type WorkerAiTurnRecovery } from '../../../data/workerAiClientService';
import { workerAiTurnIntentJournal as journal, type WorkerAiTurnIntent } from '../../../data/workerAiTurnIntentJournal';
import type { Ishod } from '../../../data/ports';
import { uuid } from '../../../data/serverReceipt';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { workerAvailabilityPatch } from '../../../lib/workerAiAvailabilityPatch';
import { sesijaSada, useSesija } from '../../../store/sesija';

import { useHoldToTalk } from '../../../features/voice/useHoldToTalk';
import { VoiceComposer } from '../../../ui/aiFirst/VoiceComposer';
import { AiConversationShell } from '../../../ui/aiFirst/AiConversationShell';
import { brandAction, sys } from '../../../ui/system/tokens';
import { WorkerProfileFrame, WorkerProfileStatus } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { WorkerAiActivation, WorkerAiCard, WorkerAiManual, WorkerAiReviewDetails } from '../../../ui/workerProfile/WorkerAiPresentation';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { T } from '../../../ui/Text';
import { V2Action } from '../../../ui/v2/V2Action';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';

type Panel='chat'|'review'|'manual'|'availability';
type Attempt={id:string;text:string|null};
const unavailable=():Ishod<never>=>({ok:false,kod:'WORKER_AI_UNAVAILABLE',poruka:'Ponovo učitaj svoj radni profil.'});
export default function WorkerConversationRoute(){
  const session=useSesija(),params=useLocalSearchParams<{conversationId?:string|string[]}>();
  const cid=typeof params.conversationId==='string'?params.conversationId:undefined;
  return <OwnedWorkerConversation key={`${session.user?.id}:${session.accountRevision}:${cid??''}`}
    initialId={cid} invalid={params.conversationId!==undefined&&(!cid||!uuid(cid))}/>;
}
function OwnedWorkerConversation({initialId,invalid}:{initialId?:string;invalid:boolean}){
  const {user,accountRevision}=useSesija(),accountId=user?.id;
  const cid=useRef<string|null>(initialId??null),[openKey]=useState(noviUuidZahtevId);
  const focus=useRef<object|null>(null),active=useRef(!AppState.currentState||AppState.currentState==='active');
  const [foreground,setForeground]=useState(active.current),[resuming,setResuming]=useState(false);
  const abort=useRef<AbortController|null>(null),refreshRef=useRef<()=>Promise<void>>(async()=>{});
  const [panel,setPanel]=useState<Panel>('chat'),[input,setInput]=useState(''),[stream,setStream]=useState('');
  const draftText=useRef(input);draftText.current=input;
  const [recovery,setRecovery]=useState<WorkerAiTurnRecovery|null>(null),[,intentChanged]=useState(0);
  const pending=useRef<Attempt|null>(null),saveKey=useRef<{reviewId:string;key:string}|null>(null);
  // Leaving, or the app going to the background, makes an open question stale (its answer checks canAct), so it goes too.
  const confirmSheet=useConfirmSheet(),retireConfirmation=confirmSheet.close;
  useFocusEffect(useCallback(()=>{const token={};focus.current=token;return()=>{
    if(focus.current===token)focus.current=null;retireConfirmation();abort.current?.abort();abort.current=null;setStream('');
  };},[retireConfirmation]));
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{
    active.current=state==='active';setForeground(active.current);abort.current?.abort();setStream('');
    if(!active.current)retireConfirmation();
    if(active.current){setResuming(true);void refreshRef.current().finally(()=>{if(active.current)setResuming(false);});}
  });return()=>{subscription.remove();active.current=false;abort.current?.abort();};},[retireConfirmation]);
  const owns=useCallback(()=>!!accountId&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision,
    [accountId,accountRevision]);
  const read=useCallback(async():Promise<Ishod<WorkerAiSnapshot>>=>{
    const scope=focus.current;if(invalid||!scope||!owns()||!active.current)return unavailable();
    // Restore before opening a conversation or sending anything. Storage holds
    // only three IDs; canonical history restores text after an accepted turn.
    let saved:WorkerAiTurnIntent|null;
    try{saved=await journal.load(accountId!);}catch{return {ok:false,kod:'WORKER_AI_LOCAL_INTENT_INVALID',poruka:'Ne možemo da proverimo prethodno slanje. Pokušaj ponovo.'};}
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    if(saved){
      if(cid.current!==saved.conversationId){cid.current=saved.conversationId;router.setParams({conversationId:saved.conversationId});}
      if(pending.current?.id!==saved.clientRequestId){pending.current={id:saved.clientRequestId,text:null};intentChanged(n=>n+1);}
      const recovered=await api.recoverTurn(saved.conversationId,saved.clientRequestId);
      if(focus.current!==scope||!owns()||!active.current)return unavailable();
      if(!recovered.ok)return recovered;
      setRecovery(recovered.podatak);
      const terminal=recovered.podatak.conversationStatus!=='OPEN'||recovered.podatak.cancelled
        ||recovered.podatak.turn?.state==='SUCCEEDED'||recovered.podatak.turn?.state==='FAILED';
      if(terminal){
        try{await journal.clear(saved);}catch{return {ok:false,kod:'WORKER_AI_LOCAL_INTENT_INVALID',poruka:'Ishod je potvrđen. Ponovi proveru da nastaviš.'};}
        if(focus.current!==scope||!owns()||!active.current)return unavailable();
        const command=pending.current;
        if(recovered.podatak.turn?.state==='SUCCEEDED'&&command?.text)setInput(old=>old.trim()===command.text? '':old);
        pending.current=null;intentChanged(n=>n+1);setStream('');
      }
    }else if(pending.current){
      // A failed local save did not authorize network I/O. Keep the typed draft.
      pending.current=null;setRecovery(null);intentChanged(n=>n+1);
    }
    const result=cid.current?await api.read(cid.current):await api.open(openKey);
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    if(result.ok&&!cid.current){cid.current=result.podatak.conversationId;router.setParams({conversationId:cid.current});}
    return result;
  },[invalid,owns,openKey,accountId]);
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
  const send=async(body:string)=>{
    if(!canAct()||!writable||awaiting||!data||!body.trim()||(pending.current&&!recovery?.retryAllowed))return;
    await editor.save(async()=>{
      const command=pending.current??{id:noviUuidZahtevId(),text:body};
      if(!command.text)return unavailable();pending.current=command;intentChanged(n=>n+1);setRecovery(null);
      const controller=new AbortController();abort.current=controller;setStream('');
      try{
        await journal.save({accountId:accountId!,conversationId:data.conversationId,clientRequestId:command.id});
        if(!current()||controller.signal.aborted)return unavailable();
        const sent=await api.send(data.conversationId,command.text,command.id,{signal:controller.signal,
          onText:delta=>{if(current()&&!controller.signal.aborted&&pending.current===command)setStream(value=>value+delta);}});
        if(!current())return unavailable();
        // Both success and lost transport response are reconciled through the
        // durable turn. An unknown attempt cannot start a second provider call.
        const result=await read();if(!current())return unavailable();
        return result.ok?result:sent.ok?result:sent;
      }finally{if(abort.current===controller)abort.current=null;if(current())setStream('');}
    });
  };
  const keepTranscript=(text:string)=>{
    if(!canAct()||!writable||awaiting||pending.current)return false;
    const next=[draftText.current.trimEnd(),text.trim()].filter(Boolean).join('\n');
    if(!next||next.length>4000)return false;
    draftText.current=next;setInput(next);return true;
  };
  const voice=useHoldToTalk({conversationId:writable&&data?data.conversationId:null,
    onTranscript:payload=>payload.isCurrent()&&keepTranscript(payload.text)});
  const voiceBusy=voice.state.phase!=='IDLE';
  const enabled=canAct()&&!voiceBusy&&!awaiting&&!pending.current;
  const back=()=>{if(!current()||editor.busy)return;if(panel!=='chat'){setPanel('chat');return;}router.canGoBack()?router.back():router.replace('/profil/radnik');};
  const refresh=()=>{if(current()&&!editor.busy&&!voiceBusy)void editor.refresh();};
  const cancelPending=async()=>{
    const command=pending.current;if(!canAct()||voiceBusy||!data||!command||!recovery?.canCancel)return;
    await editor.save(async()=>{const result=await api.cancelTurn(data.conversationId,command.id);
      if(!current())return unavailable();if(!result.ok)return result;
      // Cancellation may lose to completion. Only the canonical read
      // can retire the journal; an abort alone never means cancellation.
      return read();});
  };
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
    confirmSheet.ask({title:'Pokrenuti nov razgovor?',message:'Predlog iz ovog razgovora ostaje u istoriji. Novi razgovor kreće od sačuvanog profila.',
      cancelLabel:'Nastavi ovaj razgovor',confirmLabel:'Novi razgovor',onConfirm:()=>{
        // Returned so the confirmation waits on the command it started instead of closing before it is sent.
        if(!canAct()||voiceBusy)return;return editor.save(async()=>{const result=await api.abandon(data.conversationId);if(!current())return unavailable();
          if(!result.ok)return result;
          const confirmed=await read();if(!current())return unavailable();
          if(confirmed.ok&&confirmed.podatak.status==='ABANDONED'&&!pending.current)router.replace('/profil/razgovor');return confirmed;});
      }});
  };
  const statusCopy=data?.saved?'Profil je sačuvan.':data?.status!=='OPEN'?'Ovaj razgovor je završen.':data.stale?'Sačuvani profil je promenjen. Novi razgovor će početi od tih podataka.':
    data.safety==='BLOCK'||data.safety==='REVIEW'?'Ovaj predlog trenutno ne može da se sačuva.':awaiting?turn?.state==='UNKNOWN_OUTCOME'?
      'Ishod prethodne poruke nije potvrđen. Proveri stanje; ista obrada se neće ponovo pokrenuti.':'AI još obrađuje poruku. Proveri stanje.':pending.current?'Proveri prethodno slanje. Novi unos i pregled su dostupni kada potvrdimo ishod.':
      recovery?.cancelled&&recovery.providerDispatched?'Odgovor je otkazan i podaci su ostali nepromenjeni. Pokušaj se ipak računa, jer je obrada već bila počela.':null;
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
      <V2Action label={editor.busy?'Čuvamo profil…':frozen.activate?'Sačuvaj i aktiviraj profil':'Sačuvaj profil'}
        disabled={!enabled||!writable||!frozen.canAccept||expired} onPress={()=>{void save();}} style={brandAction}/>
      {(expired||editor.uncertain||editor.error)?<V2Action label="Proveri stanje" onPress={refresh} disabled={editor.busy}/>:null}
    </>}>
      {data.saved?<T accessibilityRole="alert" variant="title" style={{color:sys.color.green}}>Profil je sačuvan{data.saved.profileStatus==='ACTIVE'?' i aktivan':''}.</T>:null}
      <WorkerAiReviewDetails review={frozen}/>
      {/* The save button below is grey for one of these reasons; the details above name a missing field themselves. */}
      {!data.saved&&(expired||!writable)?<T variant="meta" tone="muted">{expired?'Ovaj pregled više ne važi. Učitaj novi pregled pre čuvanja.':statusCopy??'Ovaj predlog trenutno ne može da se sačuva.'}</T>:null}
      {data.profileStatus==='DRAFT'&&!data.saved?<WorkerAiActivation activate={frozen.activate} disabled={!enabled} change={value=>{void review(value);}}/>:null}
      {expired&&!data.saved?<V2Action label="Učitaj novi pregled" disabled={!enabled} onPress={()=>{void review(frozen.activate);}}/>:null}
      {editor.error?<T accessibilityRole="alert" tone="danger">{editor.error}</T>:null}
      {!data.saved?<><V2Action label="Ručno uredi podatke" kind="quiet" disabled={!enabled} onPress={()=>setPanel('manual')}/>
        <V2Action label="Uredi nedelju i posebne datume" kind="quiet" disabled={!enabled} onPress={()=>setPanel('availability')}/>
        <V2Action label="Nastavi razgovor" kind="quiet" disabled={editor.busy} onPress={()=>setPanel('chat')}/></>:null}
    </WorkerProfileFrame>;
  }
  return <><AiConversationShell title="Tvoj radni profil" subtitle="Reci šta možeš da preuzmeš"
    card={compact=><WorkerAiCard profile={data.candidate} compact={compact} disabled={!enabled||!writable} review={()=>{void review();}}/>}
    messages={data.messages.map(m=>({id:m.id,fromAi:m.role==='ASSISTANT',body:m.body}))}
    welcome="Čime se baviš?" welcomeDetail="Opiši veštine, opremu, područje i vreme kada možeš da radiš. Sve ćemo složiti u jedan pregled."
    value={input} onChange={value=>{if(enabled&&writable)setInput(value);}} canEdit={!!enabled&&!!writable&&!pending.current}
    canSend={!!enabled&&!!writable&&!!input.trim()&&!pending.current} pending={!!pending.current} busy={editor.busy} streamingText={stream}
    onSend={()=>{if(!voiceBusy)void send(input.trim());}} onBack={back} onOptions={()=>{if(enabled&&writable)setPanel('manual');}}
    status={<>{statusCopy?<T variant="meta" tone="muted">{statusCopy}</T>:null}
      {editor.error?<T accessibilityRole="alert" variant="meta" tone="danger">{editor.error}</T>:null}</>}
    voice={writable?<VoiceComposer controller={voice.controller} state={voice.state} disabled={!enabled||!!pending.current}
      onKeepText={keepTranscript}/>:undefined}
    actions={<><V2Action label="Ručno uredi podatke" kind="quiet" disabled={!enabled||!writable} onPress={()=>setPanel('manual')}/>
      <V2Action label="Uredi nedelju i posebne datume" kind="quiet" disabled={!enabled||!writable} onPress={()=>setPanel('availability')}/>
      {(pending.current||awaiting||editor.uncertain||editor.error||data.saved)?<V2Action label="Proveri stanje razgovora" disabled={editor.busy||voiceBusy} onPress={refresh}/>:null}
      {pending.current&&recovery?.canCancel?<>
        <T variant="meta" tone="muted">Odustajanje sprečava da kasniji odgovor promeni podatke. Ako je odgovor već počeo da se sprema, taj pokušaj se ipak računa.</T>
        <V2Action label={recovery.providerDispatched?'Odustani od odgovora':'Otkaži prethodno slanje'} kind="quiet"
          disabled={!canAct()||voiceBusy} onPress={()=>{void cancelPending();}}/>
      </>:null}
      {pending.current?.text&&recovery?.retryAllowed?<V2Action label="Ponovi isto slanje" disabled={!canAct()||voiceBusy} onPress={()=>{if(pending.current?.text)void send(pending.current.text);}}/>:null}
      {data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>{if(current())router.replace('/profil/radnik');}}/>:null}
      {(pending.current||data.stale||data.status!=='OPEN'||turn?.state==='UNKNOWN_OUTCOME')?<V2Action label="Novi razgovor" kind="quiet" disabled={!canAct()} onPress={restart}/>:null}
    </>}/>{confirmSheet.sheet}</>;
}
