import { useCallback,useRef,useState } from 'react';
import { AppState,ScrollView,StyleSheet,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router,useFocusEffect } from 'expo-router';
import { useSesija,sesijaSada } from '../../store/sesija';

import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys, card } from '../system/tokens';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { DetailTopBar } from '../system/DetailTopBar';
import { ResolvedPinMap } from '../location/ResolvedPinMap';
import { AgreementLocationController,initialLocationState } from './AgreementLocationController';
import { vreme } from '../../lib/vreme';
const date=(value:string)=>vreme(value);
export function AgreementLocationScreen({agreementId}:{agreementId:string}){
  const {user,accountRevision}=useSesija(),accountId=user?.id??'';
  const [state,setState]=useState(initialLocationState),[epoch,setEpoch]=useState(0);
  const owner=useRef<object|null>(null),engine=useRef<AgreementLocationController|null>(null);
  useFocusEffect(useCallback(()=>{
    const scope={};owner.current=scope;setState(initialLocationState);
    const current=()=>owner.current===scope&&!['background','inactive'].includes(AppState.currentState)
      &&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision;
    const controller=new AgreementLocationController({agreementId,account:{accountId,accountRevision},current,storage:AsyncStorage});engine.current=controller;
    controller.subscribe(()=>{if(current())setState(controller.snapshot());});void controller.load();
    const listener=AppState.addEventListener('change',next=>{
      if(next!=='active'){controller.dispose();owner.current=null;setState(initialLocationState);}else setEpoch(value=>value+1);
    });
    return()=>{listener.remove();controller.dispose();if(owner.current===scope)owner.current=null;if(engine.current===controller)engine.current=null;};
  },[agreementId,accountId,accountRevision,epoch]));
  const renderedOwner=owner.current,controller=engine.current;
  const current=()=>renderedOwner!==null&&owner.current===renderedOwner&&engine.current===controller
    &&controller?.snapshot()===state&&!['background','inactive'].includes(AppState.currentState)
    &&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision;
  const run=(action:'refresh'|'acknowledge'|'cancelUnknown'|'stopCapture')=>{if(current())void controller?.[action]();};
  const point=state.context?.point,ready=state.phase==='READY';
  return <SafeAreaView edges={['top','bottom']} style={s.screen}>
    <DetailTopBar eyebrow="Dogovor" title="Trenutna lokacija"
      onBack={()=>{if(current()){if(router.canGoBack())router.back();else router.replace({pathname:'/dogovor/[id]',params:{id:agreementId}});}}}/>
    <ScrollView contentContainerStyle={s.content}>
    <T style={s.copy}>Jedna tačka, podeljena dobrovoljno u ovom Dogovoru. Prikaz se ne pomera i ne prati putovanje.</T>
    {state.message&&state.message.includes('podešavanjima telefona')?<PermissionRecovery message={state.message}/>
      :state.message?<T accessibilityLiveRegion="polite" style={s.copy}>{state.message}</T>:null}
    {state.phase==='LOADING'||state.phase==='SENDING'?<T accessibilityLiveRegion="polite" style={s.copy}>{state.phase==='SENDING'?'Čekam potvrdu servera…':'Proveravamo Dogovor…'}</T>:null}
    {state.phase==='CAPTURING'?<View style={s.group}><T accessibilityLiveRegion="polite" style={s.copy}>Uzimam jednu novu lokaciju telefona…</T>
      <V2Action label="Prekini deljenje" kind="quiet" onPress={()=>run('stopCapture')}/></View>:null}
    {ready&&state.context?.requestedAt?<T style={s.copy}>Lokacija je zatražena: {date(state.context.requestedAt)}. Deljenje je opciono.</T>:null}
    {ready&&point?<View style={s.group}>
      <T style={s.heading}>Poslednja podeljena tačka</T><T style={s.copy}>Zabeležena: {date(point.capturedAt)} · poslata: {date(point.sharedAt)}</T>
      <T style={s.copy}>Preciznost oko {Math.ceil(point.accuracyMeters)} m.</T>
      <T style={s.copy}>Ovo je ranije zabeležena tačka. Ne potvrđuje sadašnji položaj.</T>
      <ResolvedPinMap position={{latitude:point.latitude,longitude:point.longitude}} onChoose={()=>{}} disabled scopeKey={`${accountId}:${agreementId}:${point.sharedAt}`}/>
    </View>:null}
    {ready&&state.context?.canShare?<View style={s.group}><T style={s.copy}>Dugme uzima novu lokaciju uz dozvolu telefona i šalje je drugoj strani ovog Dogovora. Možeš nastaviti Dogovor i bez deljenja.</T>
      <V2Action label="Podeli jednu trenutnu lokaciju" onPress={()=>{if(current())void controller?.send('SHARE');}}/></View>:null}
    {ready&&state.context?.canRequest?<V2Action label="Zatraži trenutnu lokaciju" onPress={()=>{if(current())void controller?.send('REQUEST');}}/>:null}
    {ready&&!state.context?.canShare&&!state.context?.canRequest?<T style={s.copy}>Deljenje je dostupno samo učesnicima aktivnog fizičkog Dogovora kada važe dozvole za kontakt.</T>:null}
    {state.phase==='UNKNOWN'?<View style={s.group}><V2Action label="Proveri prvobitni zahtev" onPress={()=>run('refresh')}/>
      <V2Action label="Zaustavi zahtev ako još nije poslat" kind="quiet" onPress={()=>run('cancelUnknown')}/>
      <T style={s.copy}>Ako je server već prihvatio zahtev, prikazaće se ta potvrda. Prekid čekanja ne povlači već podeljenu tačku.</T></View>:null}
    {state.phase==='CONFIRMED'?<V2Action label="Prikaži stanje lokacije" onPress={()=>run('acknowledge')}/>:null}
    {ready||state.phase==='ERROR'?<V2Action label="Osveži prikaz" kind="quiet" onPress={()=>run('refresh')}/>:null}
  </ScrollView></SafeAreaView>;
}
/** PKG-011: same controller and copies; ground, cards and type on the shared system. */
const s=StyleSheet.create({screen:{flex:1,backgroundColor:sys.color.ground},content:{padding:20,paddingBottom:40,gap:16},
  heading:{...sys.type.heading,color:sys.color.ink},
  copy:{...sys.type.body,color:sys.color.muted},
  group:{...card,gap:12}});
