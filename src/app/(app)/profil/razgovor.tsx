import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
import { AiConversationShell } from '../../../ui/aiFirst/AiConversationShell';
import { ActionSheet } from '../../../ui/system/ActionSheet';
import { brandAction, sys } from '../../../ui/system/tokens';
import { WorkerProfileFrame, WorkerProfileStatus } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { WorkerAiActivation, WorkerAiCard, WorkerAiManual, WorkerAiReviewDetails } from '../../../ui/workerProfile/WorkerAiPresentation';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { CalendarScreen } from '../../../ui/calendar/CalendarControls';
import { T } from '../../../ui/Text';
import { V2Action } from '../../../ui/v2/V2Action';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';

type Panel='chat'|'review'|'manual'|'availability';
type SubmittedDraft={value:string;revision:number};
type Attempt={id:string;text:string|null;submittedDraft:SubmittedDraft|null};
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
  const panelScope=useRef<object>({}),renderedPanel=panelScope.current,panelWrite=useRef(false);
  const showPanel=(next:Panel)=>{panelScope.current={};setPanel(next);};
  const [leaving,setLeaving]=useState(false);
  const [menu,setMenu]=useState(false);
  const draftText=useRef(input);draftText.current=input;
  const draftRevision=useRef(0);
  const [recovery,setRecovery]=useState<WorkerAiTurnRecovery|null>(null),[,intentChanged]=useState(0);
  const pending=useRef<Attempt|null>(null),saveKey=useRef<{reviewId:string;key:string}|null>(null);
  // Leaving, or the app going to the background, makes an open question stale (its answer checks canAct), so it goes too.
  const confirmSheet=useConfirmSheet(),retireConfirmation=confirmSheet.close;
  useFocusEffect(useCallback(()=>{const token={};focus.current=token;setLeaving(false);return()=>{
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
      if(pending.current?.id!==saved.clientRequestId){pending.current={id:saved.clientRequestId,text:null,submittedDraft:null};intentChanged(n=>n+1);}
      const recovered=await api.recoverTurn(saved.conversationId,saved.clientRequestId);
      if(focus.current!==scope||!owns()||!active.current)return unavailable();
      if(!recovered.ok)return recovered;
      setRecovery(recovered.podatak);
      const terminal=recovered.podatak.conversationStatus!=='OPEN'||recovered.podatak.cancelled
        ||recovered.podatak.turn?.state==='SUCCEEDED'||recovered.podatak.turn?.state==='FAILED';
      if(terminal){
        try{await journal.clear(saved);}catch{return {ok:false,kod:'WORKER_AI_LOCAL_INTENT_INVALID',poruka:'Ishod je potvrđen. Ponovi proveru da nastaviš.'};}
        if(focus.current!==scope||!owns()||!active.current)return unavailable();
        // Text equality cannot establish ownership: spoken turns and restored IDs own no typed
        // draft. A typed Send owns only the raw value and edit revision captured at admission.
        const submittedDraft=pending.current?.submittedDraft;
        if(recovered.podatak.turn?.state==='SUCCEEDED'&&submittedDraft)setInput(value=>
          draftRevision.current===submittedDraft.revision&&value===submittedDraft.value?'':value);
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
  const canAct=()=>current()&&panelScope.current===renderedPanel&&!resuming&&!editor.busy&&!editor.loading&&!editor.uncertain&&!!data;
  const savePanel=(command:()=>Promise<Ishod<WorkerAiSnapshot>>)=>editor.save(async()=>{
    panelWrite.current=true;try{return await command();}finally{panelWrite.current=false;}
  });
  const turn=data?.turn,awaiting=turn?.state==='PROCESSING'||turn?.state==='UNKNOWN_OUTCOME';
  const writable=data?.status==='OPEN'&&!data.stale&&data.safety!=='BLOCK'&&data.safety!=='REVIEW';
  const send=async(body:string,submittedDraft:SubmittedDraft|null=null)=>{
    if(!canAct()||!writable||awaiting||!data||!body.trim()||(pending.current&&!recovery?.retryAllowed))return;
    await editor.save(async()=>{
      const command=pending.current??{id:noviUuidZahtevId(),text:body,submittedDraft};
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
    draftRevision.current+=1;draftText.current=next;setInput(next);return true;
  };
  const voice=useHoldToTalk({conversationId:!leaving&&writable&&data?data.conversationId:null,
    onTranscript:payload=>{
      if(!payload.isCurrent())return false;
      // Held microphone: what was said is the message, sent through `send` (the same journal, key and guards as the
      // send button) the moment the finger lifts, as in the task conversation (owner, 2026-09-23). The typed draft stays.
      // The accessible start/stop mode keeps the review: its text lands in the draft, and only Send writes the turn.
      if(payload.session?.mode!=='accessible'){
        const spoken=payload.text.trim();
        if(!spoken||spoken.length>4000||!canAct()||!writable||awaiting||pending.current)return false;
        void send(spoken);return true;
      }
      return keepTranscript(payload.text);
    }});
  const voiceBusy=voice.state.phase!=='IDLE';
  const enabled=canAct()&&!voiceBusy&&!awaiting&&!pending.current;
  const leave=(navigate:()=>void)=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    // Retire immediately, before navigation emits blur. Aborting the local stream is not a
    // server cancellation: the journal stays owned by this turn for readback on return.
    focus.current=null;setLeaving(true);setMenu(false);retireConfirmation();
    voice.controller.cancel('navigation');abort.current?.abort();abort.current=null;setStream('');navigate();
  };
  const back=()=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    if(panel!=='chat'){if(!editor.busy&&!panelWrite.current)showPanel('chat');return;}
    leave(()=>router.canGoBack()?router.back():router.replace('/profil/radnik'));
  };
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
    if(!canAct()||!enabled||!writable||!data)return;
    await savePanel(async()=>{
      const prepared=await api.prepare(data.conversationId,data.revision,activate);
      if(!current())return unavailable();if(!prepared.ok)return prepared;
      const next=await read();if(next.ok&&current())showPanel('review');return next;
    });
  };
  const patch=async(value:WorkerAiPatch)=>{
    if(!canAct()||!enabled||!writable||!data)return;
    await savePanel(async()=>{const result=await api.patch(data.conversationId,data.revision,value);
      if(current()&&result.ok){showPanel('chat');saveKey.current=null;}return current()?result:unavailable();});
  };
  const save=async()=>{
    const reviewed=data?.review;if(!canAct()||!enabled||!writable||!data||!reviewed||!reviewed.canAccept||reviewed.revision!==data.revision||Date.parse(reviewed.expiresAt)<=Date.now())return;
    if(saveKey.current?.reviewId!==reviewed.reviewId)saveKey.current={reviewId:reviewed.reviewId,key:noviUuidZahtevId()};
    const key=saveKey.current.key;
    await savePanel(async()=>{const saved=await api.save(reviewed,key);if(!current())return unavailable();
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
  if(leaving||!data||!foreground||resuming)return <WorkerProfileFrame back={back}><WorkerProfileStatus loading={leaving||editor.loading||!foreground||resuming}
    error={leaving?null:editor.error} retry={refresh}/></WorkerProfileFrame>;
  const busyPanelCopy=editor.busy?<T accessibilityRole="alert" variant="meta" tone="muted">Sačekaj potvrdu pre povratka u razgovor.</T>:null;
  // The form owns its scroll and sticky save controls. A scrolling profile frame with a fixed
  // minimum height left those controls below a second scroll on smaller Android screens.
  if(panel==='availability')return <CalendarScreen title="Dostupnost za rad" back={back} scroll={false}
    footer={<>{busyPanelCopy}{editor.error?<T accessibilityRole="alert">{editor.error}</T>:null}
      <V2Action label="Proveri stanje razgovora" onPress={refresh} disabled={editor.busy}/></>}>
    <AvailabilityForm availability={data.candidate.availability} busy={editor.busy} uncertain={editor.uncertain} candidateMode
      onSave={value=>{if(canAct()&&enabled)void patch(workerAvailabilityPatch(data.candidate.availability,value));}}/>
  </CalendarScreen>;
  if(panel==='manual')return <WorkerProfileFrame back={back}><WorkerAiManual key={data.revision} profile={data.candidate} disabled={!enabled}
    apply={value=>{void patch(value);}}/>{busyPanelCopy}{editor.error?<T accessibilityRole="alert">{editor.error}</T>:null}
    <V2Action label="Proveri stanje razgovora" onPress={refresh} disabled={editor.busy}/></WorkerProfileFrame>;
  if(panel==='review'&&data.review){const frozen=data.review,expired=Date.parse(frozen.expiresAt)<=Date.now()||frozen.revision!==data.revision;
    return <WorkerProfileFrame back={back} footer={data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))}/>:<>
      <V2Action label={editor.busy?'Čuvamo profil…':frozen.activate?'Sačuvaj i aktiviraj profil':'Sačuvaj profil'}
        disabled={!enabled||!writable||!frozen.canAccept||expired} onPress={()=>{void save();}} style={brandAction}/>
      {(expired||editor.uncertain||editor.error)?<V2Action label="Proveri stanje" onPress={refresh} disabled={editor.busy}/>:null}
    </>}>
      {data.saved?<T accessibilityRole="alert" variant="title" style={{color:sys.color.green}}>Profil je sačuvan{data.saved.profileStatus==='ACTIVE'?' i aktivan':''}.</T>:null}
      <WorkerAiReviewDetails review={frozen}/>
      {busyPanelCopy}
      {/* The save button below is grey for one of these reasons; the details above name a missing field themselves. */}
      {!data.saved&&(expired||!writable)?<T variant="meta" tone="muted">{expired?'Ovaj pregled više ne važi. Učitaj novi pregled pre čuvanja.':statusCopy??'Ovaj predlog trenutno ne može da se sačuva.'}</T>:null}
      {data.profileStatus==='DRAFT'&&!data.saved?<WorkerAiActivation activate={frozen.activate} disabled={!enabled} change={value=>{void review(value);}}/>:null}
      {expired&&!data.saved?<V2Action label="Učitaj novi pregled" disabled={!enabled} onPress={()=>{void review(frozen.activate);}}/>:null}
      {editor.error?<T accessibilityRole="alert" tone="danger">{editor.error}</T>:null}
      {!data.saved?<><V2Action label="Ručno uredi podatke" kind="quiet" disabled={!enabled} onPress={()=>{if(canAct()&&enabled)showPanel('manual');}}/>
        <V2Action label="Uredi nedelju i posebne datume" kind="quiet" disabled={!enabled} onPress={()=>{if(canAct()&&enabled)showPanel('availability');}}/>
        <V2Action label="Nastavi razgovor" kind="quiet" disabled={editor.busy} onPress={back}/></>:null}
    </WorkerProfileFrame>;
  }
  // Editing by hand and the week are "sometimes" actions: they live behind "···", not at the end of every conversation.
  // A grey row says its own reason (review r4 ra item 16): the wait for an answer was named for every cause.
  const unavailableNow=enabled?undefined:voiceBusy?'Dostupno kad završiš govor.'
    :awaiting||pending.current?'Dostupno kad razgovor ne čeka odgovor.'
      :editor.uncertain?'Prvo proveri stanje razgovora.'
        :editor.loading||resuming?'Dostupno kad se razgovor učita.':'Dostupno kad se završi prethodna radnja.';
  // The worker side stores the person's message the moment its turn is claimed, and the read returns every stored
  // message, so a turn that is still processing (a lost answer, a return to the app, "Proveri stanje razgovora") already
  // shows it in the thread. Drawing it again as "šalje se" said the same sentence twice (verify r4b ra item A); it is
  // "not yet read back" only until the thread's last message is that very sentence.
  const sent=pending.current?.text??null,lastMessage=data.messages[data.messages.length-1];
  const unread=sent&&!(lastMessage?.role==='USER'&&lastMessage.body.trim()===sent.trim())?sent:null;
  const hasProfileContent = data.messages.some(message => message.role === 'USER')
    || data.candidate.skills.length > 0 || data.candidate.tools.length > 0 || data.candidate.licenses.length > 0
    || data.candidate.vehicles.length > 0 || data.candidate.bio.trim().length > 0;
  return <><AiConversationShell conversationKey={data.conversationId} title="Tvoj radni profil"
    card={compact=>hasProfileContent?<WorkerAiCard profile={data.candidate} compact={compact} disabled={!enabled||!writable} review={()=>{void review();}}/>:null}
    messages={data.messages.map(m=>({id:m.id,fromAi:m.role==='ASSISTANT',body:m.body}))}
    welcome="Šta umeš da radiš?" welcomeDetail="Reci šta umeš i kakvu opremu imaš. Svoj profil pregledaš pre čuvanja."
    openings={['Radim popravke i montažu', 'Imam vozilo za prevoz', 'Mogu da pomognem oko']}
    placeholder="Opiši šta radiš"
    value={input} onChange={value=>{if(canAct()&&enabled&&writable){draftRevision.current+=1;draftText.current=value;setInput(value);}}} canEdit={!!enabled&&!!writable&&!pending.current}
    canSend={!!enabled&&!!writable&&!!input.trim()&&!pending.current} pending={!!pending.current} busy={editor.busy} streamingText={stream}
    // What was just sent and is not yet read back stays on screen (review r4 ra item 2): without it, voice mode fell
    // back to the previous exchange and showed the old answer as the reply to what was just said. A recovered intent
    // has no text (storage holds only ids), and then nothing is shown. Once the read holds it, the thread shows it once.
    sentMessage={unread}
    onSend={()=>{if(!voiceBusy)void send(input.trim(),{value:input,revision:draftRevision.current});}} onBack={back} onOptions={writable?()=>{if(current()&&panelScope.current===renderedPanel)setMenu(true);}:undefined}
    // A fragment is truthy even when empty, which drew an empty recovery panel in the thread; the slot is filled only
    // when there is something to say.
    status={statusCopy||editor.error?<>{statusCopy?<T variant="meta" tone="muted">{statusCopy}</T>:null}
      {editor.error?<T accessibilityRole="alert" variant="meta" tone="danger">{editor.error}</T>:null}</>:undefined}
    // The shell draws the microphone, its notice and voice mode from this one controller; every transcript comes back
    // through `onTranscript` above.
    voice={writable?{controller:voice.controller,state:voice.state,disabled:!enabled||!!pending.current,onKeepText:keepTranscript}:undefined}
    actions={<>
      {(pending.current||awaiting||editor.uncertain||editor.error||data.saved)?<V2Action label="Proveri stanje razgovora" disabled={editor.busy||voiceBusy} onPress={refresh}/>:null}
      {pending.current&&recovery?.canCancel?<>
        <T variant="meta" tone="muted">Odustajanje sprečava da kasniji odgovor promeni podatke. Ako je odgovor već počeo da se sprema, taj pokušaj se ipak računa.</T>
        <V2Action label={recovery.providerDispatched?'Odustani od odgovora':'Otkaži prethodno slanje'} kind="quiet"
          disabled={!canAct()||voiceBusy} onPress={()=>{void cancelPending();}}/>
      </>:null}
      {pending.current?.text&&recovery?.retryAllowed?<V2Action label="Ponovi isto slanje" disabled={!canAct()||voiceBusy} onPress={()=>{if(pending.current?.text)void send(pending.current.text);}}/>:null}
      {data.saved?<V2Action label="Otvori sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))}/>:null}
      {(pending.current||data.stale||data.status!=='OPEN'||turn?.state==='UNKNOWN_OUTCOME')?<V2Action label="Novi razgovor" kind="quiet" disabled={!canAct()} onPress={restart}/>:null}
    </>}/>{confirmSheet.sheet}
    {menu?<ActionSheet label="Opcije profila" onClose={()=>setMenu(false)} actions={[
      {key:'manual',label:'Ručno uredi podatke',icon:'document',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>{if(canAct()&&enabled&&writable)showPanel('manual');}},
      {key:'week',label:'Uredi nedelju i posebne datume',icon:'calendar',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>{if(canAct()&&enabled&&writable)showPanel('availability');}},
    ]}/>:null}</>;
}
