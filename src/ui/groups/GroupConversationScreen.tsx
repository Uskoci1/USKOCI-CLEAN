import { useCallback,useMemo,useRef,useState } from 'react';
import { AppState,FlatList,KeyboardAvoidingView,Platform,StyleSheet,TextInput,View,type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router,useFocusEffect } from 'expo-router';
import { useSesija,sesijaSada } from '../../store/sesija';
import { useUloga,ulogaSada } from '../../store/uloga';
import { groupBody,normalizeGroupBody,type GroupMessage } from '../../data/groupConversationService';
import { GroupConversationController,initialGroupState } from './GroupConversationController';
import { ProfilePhoto } from '../media/ContextPhotos';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { aiFirst as a } from '../aiFirst/tokens';
const date=(value:string)=>new Date(value).toLocaleString('sr-Latn-RS',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const status=(value:string)=>({CONFIRMED:'Važeći Dogovor',AWAITING_REQUESTER:'Čeka potvrdu završetka',COMPLETED:'Završen',CANCELLED:'Otkazan'}[value]??'Dogovor');
export function GroupConversationScreen({agreementId}:{agreementId:string}){
 const {user,accountRevision}=useSesija(),accountId=user?.id??'',intent=useUloga();
 const [state,setState]=useState(initialGroupState),[epoch,setEpoch]=useState(0),[generation,setGeneration]=useState(0),[draft,setDraft]=useState(''),[showPeople,setShowPeople]=useState(false);
 const owner=useRef<object|null>(null),engine=useRef<GroupConversationController|null>(null),input=useRef('');
 useFocusEffect(useCallback(()=>{
  const scope={};owner.current=scope;setGeneration(x=>x+1);setState(initialGroupState);input.current='';setDraft('');setShowPeople(false);
  const current=()=>owner.current===scope&&!['background','inactive'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId
   &&sesijaSada().accountRevision===accountRevision&&ulogaSada()===intent;
  const controller=new GroupConversationController({agreementId,account:{accountId,accountRevision},current,storage:AsyncStorage});engine.current=controller;
  controller.subscribe(()=>{if(current()){const next=controller.snapshot();setState(next);if(next.phase==='CONFIRMED'){input.current='';setDraft('');}}});void controller.load();
  const listener=AppState.addEventListener('change',next=>{if(next!=='active'){controller.dispose();owner.current=null;input.current='';setDraft('');setState(initialGroupState);}else setEpoch(x=>x+1);});
  return()=>{listener.remove();controller.dispose();if(owner.current===scope)owner.current=null;if(engine.current===controller)engine.current=null;input.current='';};
 },[agreementId,accountId,accountRevision,intent,epoch]));
 const renderedOwner=owner.current,controller=engine.current;
 const current=()=>renderedOwner!==null&&owner.current===renderedOwner&&engine.current===controller&&controller?.snapshot()===state
  &&!['background','inactive'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision&&ulogaSada()===intent;
 const invoke=(method:'refresh'|'older'|'acknowledge'|'managementNext')=>{if(current())void controller?.[method]();};
 const change=(value:string)=>{if(current()&&(state.phase==='READY'||state.phase==='UNKNOWN')){input.current=value;setDraft(value);}};
 const group=state.context?.group,ready=state.phase==='READY',retry=state.phase==='UNKNOWN'&&state.canRetry;
 const onVisible=useMemo(()=>({viewableItems}:{viewableItems:ViewToken<GroupMessage>[]})=>{
  // The current controller owns the list; blur/background disposal suppresses
  // late callbacks. Only actually viewable message IDs enter the bounded RPC.
  if(renderedOwner!==null&&owner.current===renderedOwner&&engine.current===controller)void controller?.markVisible(viewableItems.filter(x=>x.isViewable).map(x=>x.item.messageId));
 },[renderedOwner,controller]);
 const viewability=useRef({viewAreaCoveragePercentThreshold:60,minimumViewTime:600}).current;
 const openAgreement=(id:string)=>{if(current())router.push({pathname:'/dogovor/[id]',params:{id}});};
 return <SafeAreaView edges={['top','bottom']} style={s.screen}><KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
  <FlatList key={generation} data={state.messages} keyExtractor={item=>item.messageId} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
   onViewableItemsChanged={onVisible} viewabilityConfig={viewability} refreshing={state.phase==='LOADING'} onRefresh={()=>invoke('refresh')}
   ListHeaderComponent={<View style={s.stack}>
    <V2Action label="Nazad na Dogovor" kind="quiet" onPress={()=>openAgreement(agreementId)}/>
    <T accessibilityRole="header" style={s.title}>Grupni razgovor</T>
    {group?<><T style={s.heading}>{group.title}</T><T style={s.copy}>Zajedničke poruke za koordinaciju Zadatka. Cenu, lične uslove i probleme dogovarajte u svom privatnom Dogovoru.</T>
     <T style={s.meta}>{group.unreadCount} nepročitanih · {group.terminal?'Razgovor je završen':group.canSend?'Poruke su dostupne':'Dostupna istorija razgovora'}</T>
     <V2Action label={showPeople?'Sakrij učesnike':'Učesnici razgovora'} kind="quiet" onPress={()=>{if(current())setShowPeople(x=>!x);}}/>
     {showPeople?<View style={s.stack}>{group.members.map(member=><View key={member.accountId} style={s.member}>
      <View style={s.avatar}><ProfilePhoto profileId={member.profileId} size={44} fallback={<T style={s.initial}>{member.displayName.slice(0,1).toLocaleUpperCase('sr-Latn-RS')}</T>}/></View>
      <View style={s.memberText}><T style={s.copy}>{member.displayName}</T><T style={s.meta}>{member.role==='REQUESTER'?'Naručilac':'Učesnik'}</T></View>
     </View>)}{group.members.length===0?<T style={s.meta}>Prikazana je ranije dostupna istorija.</T>:null}</View>:null}
     {group.role==='REQUESTER'&&showPeople?<View style={s.privatePanel}><T style={s.heading}>Vaši pojedinačni Dogovori</T><T style={s.meta}>Ovo upravljanje vidite samo vi.</T>
      {(group.management??[]).map(item=><View key={item.agreementId} style={s.stack}><T style={s.copy}>{group.members.find(m=>m.accountId===item.accountId)?.displayName??'Učesnik'} · {status(item.executionState??item.status)}</T>
       {item.problemOpened?<T style={s.meta}>Privatan problem u Dogovoru</T>:null}<V2Action label="Otvori pojedinačni Dogovor" onPress={()=>openAgreement(item.agreementId)}/></View>)}
      {group.managementNextId?<V2Action label="Još pojedinačnih Dogovora" onPress={()=>invoke('managementNext')}/>:null}
     </View>:null}
    </>:state.phase==='READY'?<T style={s.copy}>Grupni razgovor se otvara kada su u ovom Zadatku izabrana najmanje dva nezavisna učesnika. Vaš privatni Dogovor je i dalje dostupan.</T>:null}
    {state.message?<T accessibilityLiveRegion="polite" style={s.copy}>{state.message}</T>:null}
    {state.before?<V2Action label="Starije poruke" disabled={!ready} onPress={()=>invoke('older')}/>:null}
    {ready&&group&&state.messages.length===0?<T style={s.copy}>Još nema poruka u istoriji dostupnoj vašem nalogu.</T>:null}
   </View>}
   renderItem={({item})=><View style={[s.bubble,item.mine?s.mine:s.peer]}><T style={s.meta}>{item.mine?'Vi':group?.members.find(m=>m.accountId===item.senderAccountId)?.displayName??'Učesnik'}</T>
    <T style={s.copy}>{item.body}</T><T style={s.meta}>{date(item.createdAt)}</T></View>}
   ListFooterComponent={<View style={s.stack}>
    {(ready&&group?.canSend)||retry?<View style={s.composer}>
     <T style={s.heading}>{retry?'Prvobitna poruka':'Poruka grupi'}</T>
     <TextInput accessibilityLabel={retry?'Unesite prvobitnu poruku':'Poruka grupi'} multiline value={draft} onChangeText={change} style={s.input}
      placeholder="Dogovorite zajedničke korake…" placeholderTextColor={a.color.muted} maxLength={4000}/>
     <T style={s.meta}>{Array.from(normalizeGroupBody(draft)).length} / 2.000 znakova</T>
     <V2Action label={retry?'Ponovi slanje iste poruke':'Pošalji poruku grupi'} kind="primary" disabled={!groupBody(normalizeGroupBody(draft))}
      onPress={()=>{if(current()){if(retry)void controller?.retry(input.current);else void controller?.send(input.current);}}}/>
    </View>:null}
    {state.phase==='SENDING'?<T accessibilityLiveRegion="polite" style={s.copy}>Čekam potvrdu slanja…</T>:null}
    {state.phase==='UNKNOWN'?<V2Action label="Proveri prvobitno slanje" onPress={()=>invoke('refresh')}/>:null}
    {state.phase==='CONFIRMED'?<V2Action label="Prikaži razgovor" onPress={()=>invoke('acknowledge')}/>:null}
    {ready||state.phase==='ERROR'?<V2Action label="Osveži poruke" kind="quiet" onPress={()=>invoke('refresh')}/>:null}
   </View>}/>
 </KeyboardAvoidingView></SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:a.color.surface},content:{padding:20,paddingBottom:28,gap:16},stack:{gap:12},title:{...a.text.title,fontSize:28,lineHeight:36,color:a.color.ink},
 heading:{...a.text.card,fontSize:18,lineHeight:25,color:a.color.ink},copy:{...a.text.body,color:a.color.ink},meta:{...a.text.meta,color:a.color.muted},
 bubble:{padding:16,borderRadius:20,gap:7,maxWidth:'94%'},mine:{alignSelf:'flex-end',backgroundColor:a.color.wash},peer:{alignSelf:'flex-start',backgroundColor:a.color.warm},
 composer:{borderRadius:20,borderWidth:1,borderColor:a.color.line,padding:16,gap:12},input:{fontSize:16,lineHeight:24,color:a.color.ink,minHeight:90,textAlignVertical:'top',padding:10,borderWidth:1,borderColor:a.color.line,borderRadius:12},
 member:{flexDirection:'row',alignItems:'center',gap:12},memberText:{flex:1},avatar:{height:44,width:44,borderRadius:22,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:a.color.wash},initial:{fontSize:20,color:a.color.green},
 privatePanel:{backgroundColor:a.color.wash,padding:16,borderRadius:20,gap:16}});
