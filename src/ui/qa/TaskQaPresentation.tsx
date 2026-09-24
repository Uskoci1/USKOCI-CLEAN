import {KeyboardAvoidingView,Platform,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowClockwise,X} from 'phosphor-react-native';
import type {OwnerPreselectionQuestion,PublicPreselectionQa} from '../../contracts/preselectionQa';
import {T} from '../Text';
import {V2Action} from '../v2/V2Action';
import {ChromeIconButton,ScreenChrome} from '../system/ScreenChrome';
import {StateView} from '../system/StateView';
import {PillComposer,PillNote} from '../system/PillComposer';
import {useConfirmSheet} from '../system/ConfirmSheet';
import {brandAction,field,inset,sys} from '../system/tokens';

export type Question=OwnerPreselectionQuestion|PublicPreselectionQa;
type Recovery={kind:'TEXT'|'DISPOSITION';absent:boolean;canCancel:boolean};
type Composer={answering:string|null;revisionChanged:boolean;maxChars:number|null};
export type TaskQaPresentationProps={
  title:string|null;mode:'OWNER'|'PUBLIC'|null;loaded:boolean;busy:boolean;message:string;receipt:string;canRetryRead:boolean;material:boolean;
  recovery:Recovery|null;cannotAsk:string|null;composer:Composer|null;text:string;canAnswer:boolean;
  pending:OwnerPreselectionQuestion[];answered:Question[];set:Question[];historical:Question[];
  onBack:()=>void;onRefresh:()=>void;onText:(value:string)=>void;onSend:()=>void;onRetry:()=>void;onCancel:()=>void;
  onChoose:(q:OwnerPreselectionQuestion)=>void;onDispose:(action:'IGNORE'|'REPORT',q:OwnerPreselectionQuestion)=>void;onCloseAnswer:()=>void;onEditTask:()=>void;
};

/**
 * The questions of one task as a calm public thread (round 6): the question, the owner's answer behind a green rule, and
 * the pill to write in docked above the keyboard, as in Poruke. Presentation only: the screen above owns every read,
 * guard, journal and command, and the gallery draws this with fixtures.
 */
export function TaskQaPresentation(p:TaskQaPresentationProps) {
  const confirm=useConfirmSheet();
  const owner=p.mode==='OWNER',locked=p.busy||!!p.recovery;
  const ask=(action:'IGNORE'|'REPORT',q:OwnerPreselectionQuestion)=>confirm.ask(action==='IGNORE'
    ?{title:'Preskočiti pitanje?',message:'Pitanje se sklanja iz neodgovorenih i ne objavljuje se.',confirmLabel:'Preskoči',onConfirm:()=>p.onDispose(action,q)}
    :{title:'Prijaviti pitanje?',message:'Pitanje ide na proveru i sklanja se iz neodgovorenih.',confirmLabel:'Prijavi',tone:'danger',onConfirm:()=>p.onDispose(action,q)});
  const item=(q:Question,history=false)=>{
    const status='status'in q?q.status:null;
    return <View key={q.questionId} style={s.item}>
      {history?<T variant="label" tone="muted">Ranija verzija zadatka</T>:null}
      <T variant="bodyStrong">{q.questionText}</T>
      {q.answerText!==null?<View style={s.answer}><T variant="meta" tone="muted">{q.edited?'Odgovor · izmenjen':'Odgovor'}</T><T>{q.answerText}</T></View>:null}
      {status==='IGNORED'?<T variant="meta" tone="muted">Sklonjeno iz neodgovorenih</T>:null}
      {status==='REPORTED'?<T variant="meta" tone="muted">Prijava zabeležena</T>:null}
      {!history&&owner&&'status'in q&&(q.status==='PENDING_ANSWER'||q.status==='ANSWERED_PUBLIC')?<View style={s.actions}>
        {p.canAnswer?<V2Action label={q.status==='ANSWERED_PUBLIC'?'Izmeni odgovor':'Odgovori'} compact disabled={locked} onPress={()=>p.onChoose(q)}/>:null}
        {q.status==='PENDING_ANSWER'?<>
          <V2Action label="Preskoči pitanje" kind="quiet" compact disabled={locked} onPress={()=>ask('IGNORE',q)}/>
          <V2Action label="Prijavi pitanje" kind="destructive" compact disabled={locked} onPress={()=>ask('REPORT',q)}/></>:null}
      </View>:null}
    </View>;
  };
  const c=p.composer,length=Array.from(p.text.trim()).length,over=!!c&&c.maxChars!==null&&length>c.maxChars;
  const canSend=!!c&&!p.busy&&length>0&&!over&&!c.revisionChanged;
  // A failed read with nothing else to show; a saved action in doubt keeps its own panel, which carries the message.
  const trouble=!p.loaded&&!p.busy&&!!p.message&&!p.recovery;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
    <SafeAreaView edges={['top','bottom']} style={s.screen}>
      <ScreenChrome variant="detail" onBack={p.onBack} title={p.title??'Pitanja o zadatku'} subtitle={p.title?'Pitanja o zadatku':undefined}
        right={<ChromeIconButton label="Osveži pitanja i ishod radnje" icon={ArrowClockwise} disabled={p.busy} onPress={p.onRefresh}/>}/>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        {!p.loaded&&p.busy?<StateView kind="loading" title="Učitavamo pitanja…" skeleton={{count:3,rows:2}}/>
          :trouble?<StateView kind="error" art="chat" title="Pitanja nisu učitana" body={p.message}
            primary={p.canRetryRead?{label:'Pokušaj ponovo',onPress:p.onRefresh}:undefined}/>:null}
        {p.loaded||p.recovery?<>
          {/* The rule of the thread, said once: it holds for reading as much as for writing. */}
          <T variant="copy" tone="muted">Pitanja su anonimna. Javno se prikazuju samo pitanja na koja je odgovoreno. Ne unosiš kontakt, preciznu adresu ni podatke za pristup.</T>
          {p.busy?<T variant="meta" tone="muted" accessibilityLiveRegion="polite">Proveravamo pitanja…</T>:null}
          {p.message?<T tone="danger" accessibilityRole="alert">{p.message}</T>:null}
          {p.receipt?<T accessibilityLiveRegion="polite">{p.receipt}</T>:null}
          {p.material?<V2Action label="Nazad na zadatak radi izmene" onPress={p.onEditTask} disabled={p.busy}/>:null}
          {p.recovery?<View style={s.notice}><T variant="bodyStrong">Provera prethodne radnje</T><T>Sačuvan je identifikator zahteva. Izlazak iz prikaza ne šalje ponovo radnju i ne poništava ono što je već u obradi.</T>
            {p.recovery.kind==='TEXT'?<><T>Za ručno ponavljanje unesi isti tekst. Tekst se ne čuva na uređaju.</T>
              <TextInput accessibilityLabel="Isti tekst prethodne radnje" value={p.text} onChangeText={p.onText} editable={!p.busy} multiline style={s.field}/></>:null}
            {p.recovery.absent?<V2Action label="Ponovi isti zahtev" style={brandAction} disabled={p.busy} onPress={p.onRetry}/>:null}
            {p.recovery.canCancel?<V2Action label="Odustani od ovog slanja" kind="quiet" disabled={p.busy} onPress={p.onCancel}/>:null}
          </View>:null}
          {p.cannotAsk?<View style={s.notice}><T>{p.cannotAsk}</T></View>:null}
        </>:null}
        {p.loaded&&owner&&p.pending.length?<View style={s.section}>
          <T variant="heading" accessibilityRole="header">Čekaju odgovor <T variant="heading" tone="muted">· {p.pending.length}</T></T>
          {p.pending.map(q=>item(q))}</View>:null}
        {p.loaded?<View style={s.section}>
          <T variant="heading" accessibilityRole="header">Pitanja i odgovori</T>
          {p.answered.length?p.answered.map(q=>item(q))
            :<StateView kind="empty" art="chat" title="Još nema objavljenih odgovora" body="Odgovoreno pitanje se ovde prikazuje javno."/>}
        </View>:null}
        {p.loaded&&owner&&p.set.length?<View style={s.section}><T variant="heading" accessibilityRole="header">Sklonjena pitanja</T>{p.set.map(q=>item(q))}</View>:null}
        {p.loaded&&owner&&p.historical.length?<View style={s.section}><T variant="heading" accessibilityRole="header">Prethodne verzije</T>
          <T variant="copy" tone="muted">Ovi odgovori ne opisuju aktuelne uslove zadatka.</T>{p.historical.map(q=>item(q,true))}</View>:null}
      </ScrollView>
      {c?<PillComposer value={p.text} onChange={p.onText} label={c.answering!==null?'Tekst odgovora':'Tekst pitanja'}
        placeholder={c.answering!==null?'Napiši odgovor…':'Napiši pitanje…'} sendLabel={c.answering!==null?'Objavi odgovor':'Pošalji pitanje'}
        canSend={canSend} editable={!p.busy} onSend={p.onSend}
        reason={length===0?(c.answering!==null?'Upiši odgovor pre objave.':'Upiši pitanje pre slanja.'):null}
        above={<>
          {c.answering!==null?<View style={s.answering}>
            <View style={s.answeringText}><T variant="meta" tone="muted">Odgovor na</T><T variant="bodyStrong" numberOfLines={3}>{c.answering}</T></View>
            <ChromeIconButton label="Zatvori odgovor" icon={X} quiet disabled={p.busy} onPress={p.onCloseAnswer}/>
          </View>:null}
          {c.answering!==null?<PillNote>Odgovor razjašnjava postojeće uslove. Za promenu uslova vrati se na zadatak i izmeni ga kroz pregled i objavu.</PillNote>:null}
          {c.revisionChanged?<PillNote tone="danger" alert>Zadatak je izmenjen. Zatvori odgovor i pregledaj aktuelna pitanja pre slanja.</PillNote>:null}
          {over?<PillNote tone="danger">{length.toLocaleString('sr-Latn-RS')} / {c.maxChars!.toLocaleString('sr-Latn-RS')} znakova — skrati tekst.</PillNote>:null}
        </>}/>:null}
      {confirm.sheet}
    </SafeAreaView>
  </KeyboardAvoidingView>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:sys.color.ground},
  content:{paddingHorizontal:sys.space.lg,paddingTop:sys.space.sm,paddingBottom:sys.space.xl,gap:sys.space.base},
  section:{gap:sys.space.md,paddingTop:sys.space.sm},
  // A question is a bare item on the page, parted from the next by a hairline: the thread is one list, not a stack of cards.
  item:{gap:sys.space.sm,paddingVertical:sys.space.md,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:sys.color.cardLine},
  // The answer stands behind the green rule, so the two voices of the thread differ at a glance.
  answer:{gap:sys.space.xs,paddingLeft:sys.space.md,borderLeftWidth:3,borderLeftColor:sys.color.green},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:sys.space.sm},
  notice:{...inset,gap:sys.space.sm,backgroundColor:sys.color.wash},
  field:{...field,minHeight:96,textAlignVertical:'top'},
  answering:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.sm},
  answeringText:{flex:1,gap:2,paddingTop:sys.space.xs},
});
