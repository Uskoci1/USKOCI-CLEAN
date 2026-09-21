import {useCallback,useRef,useState} from 'react';
import {AppState,Modal,View,ActivityIndicator} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {sesijaSada,useSesija} from '../../store/sesija';
import {accountClosureClientService} from '../../data/accountClosureClientService';
import {closureExecutionClientService,closureBlockerLabels,closureClassLabels,erasureAdapter,erasureExceptionLabels,type ClosureExecutionReview,type ClosureExecutionState,type ClosureStartIntent} from '../../data/closureExecutionClientService';
import {authClientService} from '../../data/authClientService';
import {noviUuidZahtevId} from '../../lib/idempotencija';
import {closureIntentJournal,type ClosureIntent} from './closureIntent';
import {SettingsScreen,SettingsIntro,SettingsPanel,SettingsInfo,SettingsText as T,SettingsAction} from '../settings/SettingsPresentation';
import { sys } from '../system/tokens';
import { plural } from '../system/plural';
export function ClosureEntry(){
 const [open,setOpen]=useState(false);useFocusEffect(useCallback(()=>()=>setOpen(false),[]));
 return <><SettingsInfo title="Zatvaranje naloga" last>Pregledaj dostupnost, obaveze i pravila čuvanja pre pokretanja zahteva.</SettingsInfo>
  <SettingsAction label="Pregledaj zatvaranje" kind="secondary" onPress={()=>setOpen(true)}/>
  {open?<Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={()=>setOpen(false)}><ClosureDialog onClose={()=>setOpen(false)}/></Modal>:null}</>;
}
const duration=(n:number)=>n%86400===0?plural(n/86400,'dan','dana','dana'):n%3600===0?plural(n/3600,'sat','sata','sati'):plural(n,'sekunda','sekunde','sekundi');
export function ClosureDialog({onClose}:{onClose:()=>void}){
 const router=useRouter();
 const session=useSesija(),accountId=session.user?.id,accountRevision=session.accountRevision;
 const owner={accountId:accountId??'',accountRevision};const focus=useRef<object|null>(null),active=useRef(AppState.currentState!=='background'&&AppState.currentState!=='inactive'),locked=useRef(false);
 const [busy,setBusy]=useState(true),[message,setMessage]=useState(''),[review,setReview]=useState<ClosureExecutionReview|null>(null),[intent,setIntent]=useState<ClosureIntent|null>(null),[state,setState]=useState<ClosureExecutionState|null>(null),[absent,setAbsent]=useState(false),[confirmingStart,setConfirmingStart]=useState(false);
 const live=(token:object|null)=>token!==null&&focus.current===token&&active.current&&!!accountId&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision;
 async function readIntent(i:ClosureIntent,token:object){
  if(i.kind==='START'){
   const result=await closureExecutionClientService.read(i.clientRequestId,owner);if(!live(token))return;
   if(!result.ok){setMessage(result.poruka);return;}setAbsent(!result.podatak.found);setState(result.podatak.execution);
   setMessage(result.podatak.found?'':'Server još nema potvrdu ovog zahteva. Isti zahtev ostaje sačuvan; možeš ga izričito ponoviti.');
  }else{
   const result=await accountClosureClientService.readReceipt(i.clientRequestId,owner);if(!live(token))return;
   if(!result.ok){setMessage(result.poruka);return;}
   if(!result.podatak.found){setAbsent(true);setMessage('Priprema još nema potvrdu. Možeš ponoviti isti zahtev.');return;}
   await closureIntentJournal.clear(i.accountId,i.clientRequestId);if(!live(token))return;setIntent(null);setAbsent(false);await readReview(token);
  }
 }
 async function readReview(token:object){const result=await closureExecutionClientService.review(owner);if(!live(token))return;if(!result.ok){setMessage(result.poruka);return;}setReview(result.podatak);}
 async function restore(token:object){
  const saved=await closureIntentJournal.load(owner.accountId);if(!live(token))return;setIntent(saved);setAbsent(false);
  if(saved)await readIntent(saved,token);else await readReview(token);
 }
 async function run(work:(token:object)=>Promise<void>){const token=focus.current;if(!live(token)||locked.current)return;locked.current=true;setBusy(true);setMessage('');
  try{await work(token!);}catch{if(live(token))setMessage('Stanje zahteva nije potvrđeno. Sačuvani zahtev ostaje za proveru.');}
  finally{if(live(token)){locked.current=false;setBusy(false);}}
 }
 useFocusEffect(useCallback(()=>{
  const token={};focus.current=token;locked.current=true;setBusy(true);
  void restore(token).catch(()=>{if(live(token))setMessage('Sačuvani zahtev trenutno nije dostupan. Pokušaj ponovo.');}).finally(()=>{if(live(token)){locked.current=false;setBusy(false);}});
  const subscription=AppState.addEventListener('change',next=>{active.current=next==='active';if(!active.current){focus.current=null;locked.current=false;}else if(focus.current===null){focus.current={};void run(restore);}});
  return()=>{focus.current=null;locked.current=false;subscription.remove();};
 // Scope follows account incarnation; token refresh leaves the pending intent intact.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[accountId,accountRevision]));
 async function send(i:ClosureIntent,token:object){
  if(!live(token))return;
  const result=i.kind==='START'?await closureExecutionClientService.start(i,owner):await accountClosureClientService.prepare({expectedRevision:i.expectedRevision,clientRequestId:i.clientRequestId},owner);
  if(!live(token))return;if(!result.ok)setMessage(result.poruka);await readIntent(i,token);
 }
 const prepare=()=>run(async token=>{
  const status=await accountClosureClientService.read(owner);if(!live(token))return;if(!status.ok){setMessage(status.poruka);return;}
  const i:ClosureIntent={kind:'PREPARE',accountId:owner.accountId,clientRequestId:noviUuidZahtevId(),expectedRevision:status.podatak.revision};
  await closureIntentJournal.save(i);if(!live(token))return;setIntent(i);await send(i,token);
 });
 const start=()=>run(async token=>{
  if(!review?.ready||!review.requestId||!review.policySha256||intent)return;
  const i:ClosureStartIntent={kind:'START',accountId:owner.accountId,clientRequestId:noviUuidZahtevId(),requestId:review.requestId,expectedRevision:review.revision,policySha256:review.policySha256};
  await closureIntentJournal.save(i);if(!live(token))return;setIntent(i);setAbsent(false);await send(i,token);
 });
 const refresh=()=>run(async token=>{setReview(null);await restore(token);});
 const retry=()=>run(async token=>{if(!intent||!absent)return;await readIntent(intent,token);if(!live(token))return;
  // A read immediately before replay might now find the receipt. Never rely on
  // stale React state; read again and submit only when this exact key is absent.
  const known=intent.kind==='START'?await closureExecutionClientService.read(intent.clientRequestId,owner):await accountClosureClientService.readReceipt(intent.clientRequestId,owner);
  if(!live(token)||!known.ok||known.podatak.found)return;await send(intent,token);
 });
 const logout=()=>run(async token=>{if(!live(token))return;await authClientService.signOutLocal(owner);});
 const terminal=state?.state==='CLOSED';
 const erasure=(state?.adapterVersion??review?.adapterVersion)===erasureAdapter;
 const pendingExceptions=state?.exceptions??review?.exceptions??[];
 const support=()=>{if(!live(focus.current)||busy)return;onClose();router.push('/podrska');};
 return <SettingsScreen title="Zatvaranje naloga" onBack={()=>{if(live(focus.current))onClose();}}>
  <SettingsIntro kicker="KONTROLA NALOGA" title={terminal?'Nalog je zatvoren.':state?'Zahtev je pokrenut.':'Pregled pre zatvaranja.'}>
   {terminal?'Pristup nalogu je ugašen. Potvrda ispod opisuje završene radnje i podatke koji se čuvaju.':state?'Zahtev je u redu za obradu. Pristup je ograničen dok server proverava i završava pokrenuti zahtev.':'Pre pokretanja proveri obaveze i šta se događa sa tvojim podacima.'}
  </SettingsIntro>
  {busy?<View accessibilityRole="progressbar" style={{gap:8,flexDirection:'row'}}><ActivityIndicator color={sys.color.green}/><T>Proveravamo stanje…</T></View>:null}
  {message?<T accessibilityRole="alert">{message}</T>:null}
  {state?<SettingsPanel soft><T variant="bodyStrong">{terminal?'Završene radnje':'Obrada na serveru'}</T>
   <T>{terminal?'Podaci za prijavu su uklonjeni i sesije su završene. Fotografije i datoteke naloga su obrisane.':'Zatvaranje još nije završeno. Nepotvrđen mrežni odgovor ne znači da su podaci obrisani.'}</T>
   {erasure?<>
    <T>{terminal?'Obični lični i privatni podaci aplikacije su uklonjeni. Ostaju minimalni pseudonimni zapisi potrebni za potvrde radnji i tehničku evidenciju.':state.ordinaryContentErased?'Obični podaci aplikacije su uklonjeni. Podaci za prijavu još nisu potvrđeno obrisani i nalog nije zatvoren.':'Server postupno uklanja obične podatke aplikacije. Završetak se potvrđuje tek posle svih provera.'}</T>
    {!terminal&&state.totalSteps?<T tone="muted">Provereni koraci: {state.completedSteps} od {state.totalSteps}.</T>:null}
   </>:<T>Identifikator naloga i evidencije obuhvaćene objavljenim pravilima ostaju ograničeno dostupni tokom propisanog čuvanja.</T>}
   {terminal?<T tone="muted">Završeno: {new Date(state.closedAt!).toLocaleString('sr-Latn')}</T>:null}
  </SettingsPanel>:null}
  {!intent&&!state&&review?<>
   {!review.ready?<SettingsPanel soft><T>{review.code==='CLOSURE_POLICY_NOT_READY'?(erasure?'Provereni postupak zatvaranja trenutno nije dostupan. Sačuvani podaci nisu označeni kao obrisani.':'Zatvaranje naloga trenutno nije dostupno. Potpuna pravila zatvaranja i čuvanja još nisu objavljena.'):review.code==='CLOSURE_PREPARATION_REQUIRED'?'Pripremi pregled trenutnih obaveza pre zatvaranja.':'Najpre reši obaveze navedene ispod.'}</T>
    {review.blockers.map(code=><T key={code}>{closureBlockerLabels[code]}</T>)}
    {review.code==='CLOSURE_PREPARATION_REQUIRED'?<SettingsAction label="Pripremi pregled" kind="secondary" disabled={busy} onPress={prepare}/>:null}
   </SettingsPanel>:<SettingsPanel soft><T variant="bodyStrong">Posle pokretanja</T><T>{erasure?'Pristup običnim funkcijama se ograničava. Server uklanja nezaštićene datoteke, obične lične i privatne podatke, pa podatke za prijavu i sesije. Minimalni pseudonimni zapisi potvrda ostaju. Izdvojeni dokazi se zasebno rešavaju; ako postoje, konačno zatvaranje čeka njihovu proveru. Pokrenuto uklanjanje ne možeš poništiti iz aplikacije.':'Pristup nalogu se gasi. Podaci za prijavu, aktivne sesije i datoteke naloga biće uklonjeni. Identifikator i evidencije iz pregleda ostaju u skladu sa pravilima čuvanja. Pokrenuto zatvaranje ne možeš otkazati iz aplikacije.'}</T></SettingsPanel>}
  </>:null}
  {erasure&&pendingExceptions.length>0?<SettingsPanel soft><T variant="bodyStrong">Pre konačnog zatvaranja</T>
   <T>Ovi izdvojeni podaci još zahtevaju rešavanje. Nepovezani obični podaci mogu se ukloniti dok ta provera traje.</T>
   {pendingExceptions.map(code=><T key={code}>{erasureExceptionLabels[code]}</T>)}
   <SettingsAction label="Otvori privatnu podršku" kind="secondary" disabled={busy} onPress={support}/>
  </SettingsPanel>:null}
  {(terminal?state.retainedDatasets:review?.retainedDatasets)?.map(d=><SettingsInfo key={d.dataClass} title={closureClassLabels[d.dataClass]} last>Ograničeno čuvanje: {duration(d.retentionSeconds)} od pokretanja zahteva.</SettingsInfo>)}
  {/* Deep read 8.18: the irreversible start used to be one tap. Now it runs, so it asks once more. */}
  {!intent&&review?.ready&&!state&&!confirmingStart?<SettingsAction label="Pokreni zatvaranje naloga" kind="destructive" disabled={busy} onPress={()=>setConfirmingStart(true)}/>:null}
  {!intent&&review?.ready&&!state&&confirmingStart?<SettingsPanel><T variant="bodyStrong">Da li sigurno zatvaraš nalog?</T>
   <T>Posle ovog koraka nalog se zaključava i podaci se uklanjaju. To ne možeš da poništiš.</T>
   <SettingsAction label="Da, trajno zatvori nalog" kind="destructive" disabled={busy} onPress={start}/>
   <SettingsAction label="Odustani" kind="quiet" disabled={busy} onPress={()=>setConfirmingStart(false)}/>
  </SettingsPanel>:null}
  {intent&&absent&&!state?<SettingsAction label={intent.kind==='START'?'Ponovi isti zahtev za zatvaranje':'Ponovi istu pripremu'} kind="destructive" disabled={busy} onPress={retry}/>:null}
  <SettingsAction label="Proveri stanje zahteva" kind="secondary" disabled={busy} onPress={refresh}/>
  {state?<SettingsAction label="Odjavi se sa ovog uređaja" kind="quiet" disabled={busy} onPress={logout}/>:null}
 </SettingsScreen>;
}
