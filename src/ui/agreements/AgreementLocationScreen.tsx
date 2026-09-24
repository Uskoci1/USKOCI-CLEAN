import { useCallback,useRef,useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router,useFocusEffect } from 'expo-router';
import { useSesija,sesijaSada } from '../../store/sesija';

import { AgreementLocationController,initialLocationState } from './AgreementLocationController';
import { AgreementLocationPresentation } from './AgreementLocationPresentation';
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
  return <AgreementLocationPresentation state={state} accountId={accountId} agreementId={agreementId}
    onBack={()=>{if(current()){if(router.canGoBack())router.back();else router.replace({pathname:'/dogovor/[id]',params:{id:agreementId}});}}}
    onRefresh={()=>run('refresh')} onShare={()=>{if(current())void controller?.send('SHARE');}} onRequest={()=>{if(current())void controller?.send('REQUEST');}}
    onStopCapture={()=>run('stopCapture')} onCancelUnknown={()=>run('cancelUnknown')} onAcknowledge={()=>run('acknowledge')}/>;
}
