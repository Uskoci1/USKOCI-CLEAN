import { useCallback,useRef,useState } from 'react';
import { AppState } from 'react-native';
import { router,useFocusEffect } from 'expo-router';
import { groupConversationService } from '../../data/groupConversationService';
import { sesijaSada,useSesija } from '../../store/sesija';
import { ulogaSada,useUloga } from '../../store/uloga';
import { V2Action } from '../v2/V2Action';
import { T } from '../Text';
export function GroupConversationEntry({agreementId}:{agreementId:string}){
 const session=useSesija(),intent=useUloga(),accountId=session.user?.id??'',revision=session.accountRevision;
 const [entry,setEntry]=useState<{groupId:string;unread:number}|null>(null),owner=useRef<object|null>(null),[epoch,setEpoch]=useState(0);
 // Until a second independent person is chosen on the same Zadatak this rendered nothing at all,
 // and the sentence that explains why lives on the screen the missing button would have opened —
 // so it could never be read. The explanation belongs where the absence is.
 const [available,setAvailable]=useState<boolean|null>(null);
 useFocusEffect(useCallback(()=>{const scope={};owner.current=scope;setEntry(null);setAvailable(null);
  const current=()=>owner.current===scope&&!['inactive','background'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===revision&&ulogaSada()===intent;
  void groupConversationService.context(agreementId,{accountId,accountRevision:revision}).then(result=>{if(current()&&result.ok)setAvailable(result.podatak.available===true);if(current()&&result.ok&&result.podatak.group)setEntry({groupId:result.podatak.group.groupId,unread:result.podatak.group.unreadCount});});
  const listener=AppState.addEventListener('change',next=>{if(next!=='active'){owner.current=null;setEntry(null);setAvailable(null);}else setEpoch(x=>x+1);});
  return()=>{listener.remove();if(owner.current===scope)owner.current=null;};
 },[agreementId,accountId,revision,intent,epoch]));
 const renderedOwner=owner.current;
 return entry?<V2Action label={`Grupni razgovor${entry.unread>0?` · ${entry.unread} nepročitanih`:''}`} onPress={()=>{
  if(renderedOwner!==null&&owner.current===renderedOwner&&!['inactive','background'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===revision&&ulogaSada()===intent)
   router.push({pathname:'/dogovor/[id]/grupa',params:{id:agreementId}});
 }}/>:available===false?<T variant="meta" tone="muted">Grupni razgovor se otvara kada su u ovom Zadatku izabrana najmanje dva nezavisna učesnika.</T>:null;
}
