import {useCallback,useRef,useState} from 'react';
import {ActivityIndicator,AppState,KeyboardAvoidingView,Platform,TextInput,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {sesijaSada,useSesija} from '../../store/sesija';
import {qaRecoveryClientService,type QaContext,type QaRecoveredCommand} from '../../data/qaRecoveryClientService';
import {qaSubmissionClientService as ai,type QaSubmissionStatus,type QaSubmissionIdentity} from '../../data/qaSubmissionClientService';
import {preselectionQaClientService as qa} from '../../data/preselectionQaClientService';
import type {OwnerPreselectionQuestion,PublicPreselectionQa} from '../../contracts/preselectionQa';
import {noviUuidZahtevId} from '../../lib/idempotencija';
import {qaIntentJournal,matchesQaReceipt,type QaIntent} from './qaIntent';
import {qaTextHash} from './qaTextHash';
import {SettingsScreen,SettingsIntro,SettingsPanel,SettingsText as T,SettingsAction} from '../settings/SettingsPresentation';
import { sys } from '../system/tokens';

type Question=OwnerPreselectionQuestion|PublicPreselectionQa;
// These are explicit transactional SQL rejections, never a transport/decoder
// failure. An absent read alone is not evidence that a write was rejected.
const rejected=new Set(['RU4B_BLOCK_AUTHORITY_NOT_READY','RU4B_RATE_POLICY_NOT_READY','PRESELECTION_QA_POLICY_NOT_READY','RU4B_MATERIALITY_NOT_READY','EMPTY_CONTENT','QUESTION_REQUIRED','ANSWER_REQUIRED','EMAIL_NOT_PUBLIC','PHONE_NOT_PUBLIC','OFF_PLATFORM_LINK_NOT_PUBLIC','SOCIAL_HANDLE_NOT_PUBLIC','STALE_NEED_REVISION','QUESTION_STALE_AFTER_NEED_REVISION','NEED_NOT_FOUND','NEED_NOT_PUBLIC','REQUESTER_CANNOT_ASK_OWN_TASK','ACTIVE_WORKER_REQUIRED','RU4B_MATERIAL_REQUIRES_RU4_EDIT','QUESTION_NOT_FOUND','QUESTION_NOT_ANSWERABLE','QUESTION_NOT_PENDING','NOT_NEED_OWNER','RU4B_DISPOSITION_INVALID']);

export function TaskQaScreen({needId,onBack}:{needId:string|null;onBack:()=>void}) {
  const session=useSesija(),accountId=session.user?.id,accountRevision=session.accountRevision;
  const account={accountId:accountId??'',accountRevision};
  const focus=useRef<object|null>(null),active=useRef(AppState.currentState==='active'),lock=useRef(false);
  const viewGeneration=useRef(0),renderGeneration=viewGeneration.current;
  const [context,setContext]=useState<QaContext|null>(null),[rows,setRows]=useState<Question[]>([]);
  const [intent,setIntent]=useState<QaIntent|null>(null),[absent,setAbsent]=useState(false);
  const [classification,setClassification]=useState<QaSubmissionStatus|null>(null),[material,setMaterial]=useState(false);
  const [target,setTarget]=useState<OwnerPreselectionQuestion|null>(null),[text,setText]=useState('');
  const [busy,setBusy]=useState(true),[message,setMessage]=useState(''),[receipt,setReceipt]=useState('');
  const live=(token:object|null)=>!!token&&token===focus.current&&active.current&&!!needId&&!!accountId&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision;

  async function readFeed(token:object) {
    viewGeneration.current++;
    const result=await qaRecoveryClientService.context(needId!,account);
    if(!live(token))return;
    if(!result.ok){setContext(null);setRows([]);setMessage(result.poruka);return;}
    const c=result.podatak;
    const feed=c.mode==='OWNER'?await qa.ownerQuestions(needId!):await qa.publicQa(needId!);
    if(!live(token))return;
    if(!feed.ok){setContext(null);setRows([]);setMessage(feed.poruka);return;}
    if(c.mode==='PUBLIC'&&feed.podatak.some(q=>q.needRevision!==c.needRevision)) {
      // One answer belonging to an older revision used to blank the whole public feed: every
      // question and every answer vanished, including the asker's own, with a message offering no
      // way forward. An answer written for an older version of the task is still that person's
      // answer; it is the ones that do not match the version on screen that are set aside.
      const current=feed.podatak.filter(q=>q.needRevision===c.needRevision);
      setContext(c);setRows(current);
      setMessage(current.length
        ?'Zadatak je izmenjen posle nekih pitanja. Prikazana su ona koja pripadaju važećoj verziji.'
        :'Zadatak je izmenjen. Ranija pitanja pripadaju starijoj verziji.');
      return;
    }
    setContext(c);setRows(feed.podatak);
  }
  async function finish(i:QaIntent,c:QaRecoveredCommand,token:object):Promise<'FOUND'|'UNKNOWN'> {
    if(!matchesQaReceipt(i,c)){setAbsent(false);setMessage('Potvrda se ne podudara sa sačuvanom radnjom. Slanje ostaje zaustavljeno.');return 'UNKNOWN';}
    await qaIntentJournal.clear(accountId!,i.needId,i.clientRequestId);
    if(!live(token))return 'UNKNOWN';
    setIntent(null);setAbsent(false);setClassification(null);setMaterial(false);setTarget(null);setText('');
    setReceipt(c.receipt.status==='PENDING_ANSWER'?'Pitanje je poslato. Javno se prikazuje kada naručilac odgovori.':c.receipt.status==='ANSWERED_PUBLIC'?'Odgovor je objavljen.':c.receipt.status==='IGNORED'?'Pitanje je sklonjeno iz neodgovorenih.':'Prijava pitanja je zabeležena. To ne znači da je pregled već završen.');
    return 'FOUND';
  }
  async function consumeAi(i:Exclude<QaIntent,{type:'DISPOSITION'}>,s:QaSubmissionStatus,token:object):Promise<'FOUND'|'ABSENT'|'UNKNOWN'|'TERMINAL'> {
    if(!live(token))return 'UNKNOWN';
    if(s.state!=='ABSENT'&&(s.type!==i.type||s.needRevision!==i.needRevision||s.textSha256!==i.textSha256||s.questionId!==(i.type==='ANSWER'?i.questionId:null))){
      setClassification(null);setAbsent(false);setMessage('Potvrda obrade ne odgovara sačuvanom zahtevu. Proveri stanje ponovo.');return 'UNKNOWN';
    }
    setClassification(s);setAbsent(s.state==='ABSENT'||s.state==='READY');
    if(s.state==='COMMITTED')return finish(i,{type:i.type,needRevision:i.needRevision,textSha256:i.textSha256,receipt:s.receipt!},token);
    if(['CANCELLED','REJECTED','STALE'].includes(s.state)) {
      await qaIntentJournal.clear(accountId!,i.needId,i.clientRequestId);if(!live(token))return 'UNKNOWN';
      setIntent(null);setAbsent(false);setClassification(null);setMaterial(s.materiality==='MATERIAL');
      setReceipt(s.state==='CANCELLED'?'Slanje je otkazano na serveru. Ova radnja neće naknadno objaviti tekst.'
        :s.state==='STALE'?'Zadatak ili pravila su promenjeni. Pregledaj aktuelna pitanja pre novog slanja.'
         :s.materiality==='MATERIAL'?'Odgovor menja uslove zadatka. Izmeni zadatak kroz pregled i objavu.'
          :s.safeReasonCodes.some(c=>['QA_ACCOUNT_DAILY_LIMIT','QA_TASK_DAILY_LIMIT','QA_ASK_COOLDOWN'].includes(c))?'Dostignuto je ograničenje slanja pitanja. Pokušaj kasnije.'
           :s.safeReasonCodes.includes('QA_DUPLICATE_QUESTION')?'Isto pitanje je već postavljeno za ovu verziju zadatka.'
            :s.outcome==='CLARIFY'?'Tekst treba jasnije da opiše pitanje ili odgovor. Doradi ga pre novog slanja.'
             :s.outcome==='REVIEW'?'Predloženi tekst trenutno nije odobren za javnu objavu.'
              :'Predloženi tekst nije objavljen. Pregledaj ga pre novog slanja.');
      return 'TERMINAL';
    }
    if(s.state==='PROCESSING'){setMessage('Prethodni zahtev se obrađuje. Proveri ishod ili izričito otkaži slanje.');return 'UNKNOWN';}
    if(s.state==='READY')setMessage('Provera teksta je završena. Isti zahtev možeš ručno nastaviti do objave.');
    return 'ABSENT';
  }
  async function readIntent(i:QaIntent,token:object):Promise<'FOUND'|'ABSENT'|'UNKNOWN'|'TERMINAL'> {
    setClassification(null);setAbsent(false);
    const result=await qaRecoveryClientService.read(i.needId,i.clientRequestId,account);
    if(!live(token))return 'UNKNOWN';
    if(!result.ok){setMessage(result.poruka);return 'UNKNOWN';}
    if(result.podatak.found)return finish(i,result.podatak.command!,token);
    if(i.type==='DISPOSITION'){setAbsent(true);return 'ABSENT';}
    const status=await ai.recover(i.needId,i.clientRequestId,account);
    if(!live(token))return 'UNKNOWN';
    if(!status.ok){setMessage(status.poruka);return 'UNKNOWN';}
    return consumeAi(i,status.podatak,token);
  }
  async function restore(token:object) {
    const saved=await qaIntentJournal.load(accountId!,needId!);
    if(!live(token))return;
    setIntent(saved);setAbsent(false);
    if(saved)await readIntent(saved,token);
    if(live(token))await readFeed(token);
  }
  async function run(work:(token:object)=>Promise<void>) {
    const token=focus.current;if(!live(token)||lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try{await work(token!);}catch{if(live(token))setMessage('Stanje radnje nije potvrđeno. Proveri ponovo pre slanja.');}
    finally{if(live(token)){lock.current=false;setBusy(false);}}
  }
  useFocusEffect(useCallback(()=>{
    const token={};focus.current=token;active.current=AppState.currentState==='active';lock.current=false;
    if(needId&&accountId)void run(restore);else{setBusy(false);setMessage('Ponovo otvori zadatak sa prijavljenog naloga.');}
    const subscription=AppState.addEventListener('change',next=>{
      active.current=next==='active';
      if(!active.current){focus.current=null;lock.current=false;}
      else if(focus.current===null){focus.current={};void run(restore);}
    });
    return()=>{focus.current=null;lock.current=false;subscription.remove();};
  // The screen is keyed by Task and account incarnation, and explicitly checks
  // that identity before every asynchronous boundary and network dispatch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[needId,accountId,accountRevision]));

  async function send(i:QaIntent,body:string,token:object) {
    if(!live(token))return;
    if(i.type!=='DISPOSITION') {
      const result=await ai.submit({type:i.type,needId:i.needId,needRevision:i.needRevision,clientRequestId:i.clientRequestId,
        ...(i.type==='ANSWER'?{questionId:i.questionId}:{}),text:body},account);
      if(!live(token))return;
      if(result.ok)await consumeAi(i,result.podatak,token);else{setMessage(result.poruka);await readIntent(i,token);}
      if(live(token))await readFeed(token);return;
    }
    const result=await qa.dispositionQuestion(i.questionId,i.action,i.clientRequestId);
    if(!live(token))return;
    if(!result.ok)setMessage(result.poruka);
    const outcome=await readIntent(i,token);
    if(!live(token))return;
    if(!result.ok&&rejected.has(result.kod)&&outcome==='ABSENT') {
      await qaIntentJournal.clear(accountId!,i.needId,i.clientRequestId);
      if(!live(token))return;setIntent(null);setAbsent(false);
    }
    if(live(token))await readFeed(token);
  }
  function submit(action?:'IGNORE'|'REPORT',question?:OwnerPreselectionQuestion) {
    if(renderGeneration!==viewGeneration.current)return;
    void run(async token=>{
      if(!context||intent)return;
      const q=question??target,body=text.trim();
      if(action?context.mode!=='OWNER'||q?.status!=='PENDING_ANSWER'
        :q?(!context.canComposeAnswer||q.needRevision!==context.needRevision||!body)
        :(!context.canAsk||!body))return;
      if(!action&&((q?context.answerMaxChars:context.questionMaxChars)??Infinity)<Array.from(body).length){setMessage('Tekst je duži od dozvoljenog. Skrati ga pre slanja.');return;}
      const common={accountId:accountId!,needId:needId!,needRevision:q?.needRevision??context.needRevision,clientRequestId:noviUuidZahtevId()};
      const i:QaIntent=action?{...common,type:'DISPOSITION',questionId:q!.questionId,action,textSha256:null}
        :q?{...common,type:'ANSWER',questionId:q.questionId,textSha256:qaTextHash(body)}
        :{...common,type:'ASK',textSha256:qaTextHash(body)};
      await qaIntentJournal.save(i);if(!live(token))return;
      setIntent(i);setAbsent(false);setClassification(null);setMaterial(false);setReceipt('');await send(i,body,token);
    });
  }
  const retry=()=>run(async token=>{
    if(renderGeneration!==viewGeneration.current)return;
    if(!intent||!absent)return;
    const body=text.trim();
    if(intent.textSha256!==null&&qaTextHash(body)!==intent.textSha256){setMessage('Za isti zahtev unesi potpuno isti tekst. Prethodni tekst se ne čuva na uređaju.');return;}
    if(await readIntent(intent,token)!=='ABSENT'||!live(token))return;
    await send(intent,body,token);
  });
  const cancel=()=>run(async token=>{
    if(renderGeneration!==viewGeneration.current||!intent||intent.type==='DISPOSITION'||!classification?.canCancel)return;
    const outcome=await readIntent(intent,token);if(!live(token)||outcome==='FOUND'||outcome==='TERMINAL')return;
    const identity:QaSubmissionIdentity={type:intent.type,needId:intent.needId,needRevision:intent.needRevision,clientRequestId:intent.clientRequestId,textSha256:intent.textSha256,
      ...(intent.type==='ANSWER'?{questionId:intent.questionId}:{})};
    const result=await ai.cancel(identity,account);if(!live(token))return;
    if(result.ok)await consumeAi(intent,result.podatak,token);else{setMessage(result.poruka);await readIntent(intent,token);}
    if(live(token))await readFeed(token);
  });
  const choose=(q:OwnerPreselectionQuestion)=>{if(renderGeneration===viewGeneration.current&&live(focus.current)&&!lock.current&&!intent){setTarget(q);setText(q.answerText??'');setReceipt('');}};
  const current=rows.filter(q=>q.needRevision===context?.needRevision);
  const pending=current.filter((q):q is OwnerPreselectionQuestion=>'status'in q&&q.status==='PENDING_ANSWER');
  const answered=current.filter(q=>!('status'in q)||q.status==='ANSWERED_PUBLIC');
  const historical=rows.filter(q=>q.needRevision!==context?.needRevision);
  const renderQuestion=(q:Question,history=false)=><SettingsPanel key={q.questionId}>
    <T variant="label" tone="muted">{history?`Ranija verzija zadatka · ${q.needRevision}`:'Anonimno pitanje'}</T><T variant="bodyStrong">{q.questionText}</T>
    {q.answerText!==null?<><T variant="label" tone="muted">Odgovor naručioca{q.edited?' · izmenjen':''}</T><T>{q.answerText}</T></>:null}
    {'status'in q&&q.status==='IGNORED'?<T tone="muted">Sklonjeno iz neodgovorenih</T>:null}
    {'status'in q&&q.status==='REPORTED'?<T tone="muted">Prijava zabeležena</T>:null}
    {!history&&context?.mode==='OWNER'&&'status'in q&&(q.status==='PENDING_ANSWER'||q.status==='ANSWERED_PUBLIC')?<>
      {context.canComposeAnswer?<SettingsAction label={q.status==='ANSWERED_PUBLIC'?'Izmeni odgovor':'Odgovori'} kind="secondary" disabled={busy||!!intent} onPress={()=>choose(q)}/>:null}
      {q.status==='PENDING_ANSWER'?<><SettingsAction label="Preskoči pitanje" kind="quiet" disabled={busy||!!intent} onPress={()=>submit('IGNORE',q)}/><SettingsAction label="Prijavi pitanje" kind="quiet" disabled={busy||!!intent} onPress={()=>submit('REPORT',q)}/></>:null}
    </>:null}
  </SettingsPanel>;

  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
    <SettingsScreen title="Pitanja o zadatku" onBack={()=>{if(live(focus.current))onBack();}}>
      <SettingsIntro kicker="PRE DOGOVORA" title={context?.title??'Razjasni zadatak.'}>Pitanja su anonimna. Javno se prikazuju pitanja sa odgovorom naručioca. Ne unosiš kontakt, preciznu adresu ni podatke za pristup.</SettingsIntro>
      {busy?<ActivityIndicator color={sys.color.green} accessibilityLabel="Proveravamo pitanja"/>:null}
      {message?<T accessibilityRole="alert">{message}</T>:null}
      {receipt?<T accessibilityLiveRegion="polite">{receipt}</T>:null}
      {material?<SettingsAction label="Vrati se na zadatak radi izmene" kind="secondary" onPress={()=>{if(live(focus.current)&&!lock.current)onBack();}} disabled={busy}/>:null}
      {intent?<SettingsPanel soft><T variant="bodyStrong">Provera prethodne radnje</T><T>Sačuvan je identifikator zahteva. Izlazak iz prikaza ne šalje ponovo radnju i ne poništava ono što server već obrađuje.</T>
        {intent.type!=='DISPOSITION'?<><T>Za ručno ponavljanje unesi isti tekst. Tekst se ne čuva na uređaju.</T><TextInput accessibilityLabel="Isti tekst prethodne radnje" value={text} onChangeText={setText} editable={!busy} multiline style={input}/></>:null}
        {absent?<SettingsAction label="Ponovi isti zahtev" kind="secondary" disabled={busy} onPress={()=>void retry()}/>:null}
        {classification?.canCancel?<SettingsAction label="Odustani od ovog slanja" kind="quiet" disabled={busy} onPress={()=>void cancel()}/>:null}
      </SettingsPanel>:null}
      {context?.mode==='PUBLIC'&&!context.canAsk?<SettingsPanel soft><T>{!context.activeWorker?'Za postavljanje pitanja potreban je aktivan Radni profil.':context.ratePolicyState==='NOT_READY'?'Slanje novih pitanja trenutno nije dostupno. Objavljeni odgovori ostaju vidljivi.':'Pitanja za ovu verziju zadatka trenutno nisu dostupna.'}</T></SettingsPanel>:null}
      {!intent&&(target||context?.canAsk)?<SettingsPanel soft><T variant="heading">{target?'Odgovor naručioca':'Tvoje pitanje'}</T>
        {target?<T>{target.questionText}</T>:null}
        {target?<T tone="muted">Odgovor razjašnjava postojeće uslove. Za promenu uslova vrati se na zadatak i izmeni ga kroz pregled i objavu.</T>:null}
        <TextInput accessibilityLabel={target?'Tekst odgovora':'Tekst pitanja'} value={text} onChangeText={setText} editable={!busy} multiline textAlignVertical="top" style={input}/>
        {target&&target.needRevision!==context?.needRevision?<T accessibilityRole="alert">Zadatak je izmenjen. Zatvori odgovor i pregledaj aktuelna pitanja pre slanja.</T>:null}
        <SettingsAction label={target?'Objavi odgovor':'Pošalji pitanje'} disabled={busy||!text.trim()||!!target&&target.needRevision!==context?.needRevision} onPress={()=>submit()}/>
        {target?<SettingsAction label="Zatvori odgovor" kind="quiet" disabled={busy} onPress={()=>{setTarget(null);setText('');}}/>:null}
      </SettingsPanel>:null}
      {context?.mode==='OWNER'&&pending.length?<><T variant="heading">Čekaju odgovor</T>{pending.map(q=>renderQuestion(q))}</>:null}
      {context?<><T variant="heading">Objavljena pitanja i odgovori</T>{answered.length?answered.map(q=>renderQuestion(q)):<SettingsPanel><T tone="muted">Još nema objavljenih odgovora za ovu verziju zadatka.</T></SettingsPanel>}</>:null}
      {context?.mode==='OWNER'?current.filter(q=>'status'in q&&['IGNORED','REPORTED'].includes(q.status)).map(q=>renderQuestion(q)):null}
      {context?.mode==='OWNER'&&historical.length?<><T variant="heading">Prethodne verzije</T><T tone="muted">Ovi odgovori ne opisuju aktuelne uslove zadatka.</T>{historical.map(q=>renderQuestion(q,true))}</>:null}
      <View style={{marginVertical:16}}><SettingsAction label="Osveži pitanja i ishod radnje" kind="secondary" disabled={busy} onPress={()=>void run(restore)}/></View>
    </SettingsScreen>
  </KeyboardAvoidingView>;
}
const input={minHeight:120,borderWidth:1,borderColor:sys.color.line,borderRadius:12,padding:14,fontSize:16,lineHeight:24,color:sys.color.ink,backgroundColor:sys.color.surface};
