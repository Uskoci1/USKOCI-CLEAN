import {useCallback,useRef,useState} from 'react';
import {ActivityIndicator,AppState,KeyboardAvoidingView,Platform,TextInput,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {sesijaSada,useSesija} from '../../store/sesija';
import {qaRecoveryClientService,type QaContext} from '../../data/qaRecoveryClientService';
import {preselectionQaClientService as qa} from '../../data/preselectionQaClientService';
import type {OwnerPreselectionQuestion,PublicPreselectionQa} from '../../contracts/preselectionQa';
import {noviUuidZahtevId} from '../../lib/idempotencija';
import {qaIntentJournal,matchesQaReceipt,type QaIntent} from './qaIntent';
import {qaTextHash} from './qaTextHash';
import {SettingsScreen,SettingsIntro,SettingsPanel,SettingsText as T,SettingsAction} from '../settings/SettingsPresentation';
import {v2} from '../v2/tokens';

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
      setContext(null);setRows([]);setMessage('Zadatak je izmenjen. Osvežite pitanja.');return;
    }
    setContext(c);setRows(feed.podatak);
  }
  async function readIntent(i:QaIntent,token:object):Promise<'FOUND'|'ABSENT'|'UNKNOWN'> {
    const result=await qaRecoveryClientService.read(i.needId,i.clientRequestId,account);
    if(!live(token))return 'UNKNOWN';
    if(!result.ok){setAbsent(false);setMessage(result.poruka);return 'UNKNOWN';}
    if(!result.podatak.found){setAbsent(true);return 'ABSENT';}
    const c=result.podatak.command!;
    if(!matchesQaReceipt(i,c)){setAbsent(false);setMessage('Potvrda se ne podudara sa sačuvanom radnjom. Slanje ostaje zaustavljeno.');return 'UNKNOWN';}
    await qaIntentJournal.clear(accountId!,i.needId,i.clientRequestId);
    if(!live(token))return 'UNKNOWN';
    setIntent(null);setAbsent(false);setTarget(null);setText('');
    setReceipt(c.receipt.status==='PENDING_ANSWER'?'Pitanje je poslato. Javno se prikazuje kada naručilac odgovori.':c.receipt.status==='ANSWERED_PUBLIC'?'Odgovor je objavljen.':c.receipt.status==='IGNORED'?'Pitanje je sklonjeno iz neodgovorenih.':'Prijava pitanja je zabeležena. To ne znači da je pregled već završen.');
    return 'FOUND';
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
    try{await work(token!);}catch{if(live(token))setMessage('Stanje radnje nije potvrđeno. Proverite ponovo pre slanja.');}
    finally{if(live(token)){lock.current=false;setBusy(false);}}
  }
  useFocusEffect(useCallback(()=>{
    const token={};focus.current=token;active.current=AppState.currentState==='active';lock.current=false;
    if(needId&&accountId)void run(restore);else{setBusy(false);setMessage('Ponovo otvorite zadatak sa prijavljenog naloga.');}
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
    const result=i.type==='ASK'?await qa.askQuestion(i.needId,i.needRevision,body,i.clientRequestId)
      :i.type==='ANSWER'?await qa.answerQuestion(i.questionId,body,i.clientRequestId)
      :await qa.dispositionQuestion(i.questionId,i.action,i.clientRequestId);
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
      if(!action&&((q?context.answerMaxChars:context.questionMaxChars)??Infinity)<Array.from(body).length){setMessage('Tekst je duži od dozvoljenog. Skratite ga pre slanja.');return;}
      const common={accountId:accountId!,needId:needId!,needRevision:q?.needRevision??context.needRevision,clientRequestId:noviUuidZahtevId()};
      const i:QaIntent=action?{...common,type:'DISPOSITION',questionId:q!.questionId,action,textSha256:null}
        :q?{...common,type:'ANSWER',questionId:q.questionId,textSha256:qaTextHash(body)}
        :{...common,type:'ASK',textSha256:qaTextHash(body)};
      await qaIntentJournal.save(i);if(!live(token))return;
      setIntent(i);setAbsent(false);setReceipt('');await send(i,body,token);
    });
  }
  const retry=()=>run(async token=>{
    if(renderGeneration!==viewGeneration.current)return;
    if(!intent||!absent)return;
    const body=text.trim();
    if(intent.textSha256!==null&&qaTextHash(body)!==intent.textSha256){setMessage('Za isti zahtev unesite potpuno isti tekst. Prethodni tekst se ne čuva na uređaju.');return;}
    if(await readIntent(intent,token)!=='ABSENT'||!live(token))return;
    await send(intent,body,token);
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
      <SettingsIntro kicker="PRE DOGOVORA" title={context?.title??'Razjasnite zadatak.'}>Pitanja su anonimna. Javno se prikazuju pitanja sa odgovorom naručioca. Ne unosite kontakt, preciznu adresu ni podatke za pristup.</SettingsIntro>
      {busy?<ActivityIndicator color={v2.color.teal} accessibilityLabel="Proveravamo pitanja"/>:null}
      {message?<T accessibilityRole="alert">{message}</T>:null}
      {receipt?<T accessibilityLiveRegion="polite">{receipt}</T>:null}
      {intent?<SettingsPanel soft><T variant="bodyStrong">Provera prethodne radnje</T><T>Sačuvan je identifikator zahteva. Izlazak iz prikaza ne šalje ponovo radnju i ne poništava ono što server već obrađuje.</T>
        {intent.type!=='DISPOSITION'?<><T>Za ručno ponavljanje unesite isti tekst. Tekst se ne čuva na uređaju.</T><TextInput accessibilityLabel="Isti tekst prethodne radnje" value={text} onChangeText={setText} editable={!busy} multiline style={input}/></>:null}
        {absent?<SettingsAction label="Ponovi isti zahtev" kind="secondary" disabled={busy} onPress={()=>void retry()}/>:null}
      </SettingsPanel>:null}
      {context?.mode==='PUBLIC'&&!context.canAsk?<SettingsPanel soft><T>{!context.activeWorker?'Za postavljanje pitanja potreban je aktivan Radni profil.':context.ratePolicyState==='NOT_READY'?'Slanje novih pitanja trenutno nije dostupno. Objavljeni odgovori ostaju vidljivi.':'Pitanja za ovu verziju zadatka trenutno nisu dostupna.'}</T></SettingsPanel>:null}
      {!intent&&(target||context?.canAsk)?<SettingsPanel soft><T variant="heading">{target?'Odgovor naručioca':'Vaše pitanje'}</T>
        {target?<T>{target.questionText}</T>:null}
        {target?<T tone="muted">Odgovor razjašnjava postojeće uslove. Za promenu uslova vratite se na zadatak i izmenite ga kroz pregled i objavu.</T>:null}
        <TextInput accessibilityLabel={target?'Tekst odgovora':'Tekst pitanja'} value={text} onChangeText={setText} editable={!busy} multiline textAlignVertical="top" style={input}/>
        {target&&target.needRevision!==context?.needRevision?<T accessibilityRole="alert">Zadatak je izmenjen. Zatvorite odgovor i pregledajte aktuelna pitanja pre slanja.</T>:null}
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
const input={minHeight:120,borderWidth:1,borderColor:v2.color.line,borderRadius:12,padding:14,fontSize:16,lineHeight:24,color:v2.color.ink,backgroundColor:v2.color.surface};
